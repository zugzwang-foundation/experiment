import { v7 as uuidv7 } from "uuid";
import { afterEach, describe, expect, it, vi } from "vitest";

// ⚠ TEST-BRANCH ONLY (`test/seed-depth2-load`, not for merge). A reply TO a
// reply (depth 2) is not writable through the public route (REPLY_DEPTH_MAX = 1)
// but the dummy seed writes them, so every read surface must thread, label and
// mask them without crashing. Covers:
//   · loadDebateView — depth-2 rows nest under their depth-1 parent (they were
//     silently dropped before), post aggregates still count DIRECT children
//     only, SC-1 masking holds for a removed depth-2 body, and a removed depth-1
//     parent keeps its children.
//   · serializeDebateExport — depth-2 blocks appear, relation relative to the
//     depth-1 parent, removed body absent.
//   · loadProfileArguments / loadProfilePositions — a depth-2 reply deep-links
//     to its ROOT post's ordinal and names its immediate parent as replied-to
//     (null when that parent is removed).
//
// DB-backed (local Postgres :54322), patterned on load-debate-view.integration
// and profile/positions tests. TRUNCATE in afterEach.

vi.mock("@sentry/nextjs", () => ({
	captureMessage: vi.fn(),
	addBreadcrumb: vi.fn(),
	captureException: vi.fn(),
}));
vi.mock("@/server/storage/sign-read", () => ({
	signRead: vi.fn(async (key: string) => `https://signed.example/${key}`),
	signReadSingleUse: vi.fn(
		async (key: string) => `https://signed.example/${key}`,
	),
}));
vi.mock("@/server/storage/r2", () => ({
	mintReadUrl: vi.fn(
		async (bucket: string, key: string) =>
			`https://signed.example/${bucket}/${key}`,
	),
}));

import {
	bets,
	comments,
	markets,
	modActions,
	pools,
	positions,
	users,
} from "@/db/schema";
import { serializeDebateExport } from "@/server/debate-export/serialize";
import {
	type DebateReply,
	deriveTitleTeaser,
	loadDebateView,
} from "@/server/debate-view/load-debate-view";
import type { MarketSummary } from "@/server/markets/get-by-slug";
import { loadProfileArguments } from "@/server/profile/arguments";
import { loadProfilePositions } from "@/server/profile/positions";

import { testClient, testDb } from "../../db/_fixtures/db";
import { seedLotForBet } from "../../db/_fixtures/lots";
import { truncateTables } from "../../db/_fixtures/truncate";

const POOL = "100.000000000000000000";
const dp18 = (n: string) => `${n}.000000000000000000`;
const at = (s: number) => new Date(Date.UTC(2026, 8, 15, 0, 0, s));

async function seedUser(tag: string): Promise<string> {
	const id = uuidv7();
	await testDb.insert(users).values({
		id,
		name: `Depth2 ${tag}`,
		email: `d2-${tag}-${id}@example.com`,
		pseudonym: `d2-${tag}-${id.slice(-6)}`,
		emailVerified: false,
	});
	return id;
}

async function seedMarket(): Promise<MarketSummary> {
	const [m] = await testDb
		.insert(markets)
		.values({
			slug: `d2-${uuidv7()}`,
			title: "Depth two market",
			description: "Criterion.",
			status: "Open",
			resolutionDeadline: new Date("2026-11-01T00:00:00Z"),
		})
		.returning({
			id: markets.id,
			slug: markets.slug,
			title: markets.title,
			description: markets.description,
			status: markets.status,
		});
	const market = m as MarketSummary;
	await testDb
		.insert(pools)
		.values({ marketId: market.id, yesReserves: POOL, noReserves: POOL });
	return market;
}

/** A comment + its riding bet + the lot `place()` would mint (INV-1). */
async function seedArg(args: {
	userId: string;
	marketId: string;
	side: "YES" | "NO";
	body: string;
	parentCommentId: string | null;
	createdAt: Date;
	stake?: string;
}): Promise<string> {
	const commentId = uuidv7();
	await testDb.insert(comments).values({
		id: commentId,
		userId: args.userId,
		marketId: args.marketId,
		body: args.body,
		sideAtPostTime: args.side,
		parentCommentId: args.parentCommentId,
		createdAt: args.createdAt,
	});
	const betId = uuidv7();
	const stake = args.stake ?? dp18("10");
	await testDb.insert(bets).values({
		id: betId,
		userId: args.userId,
		marketId: args.marketId,
		side: args.side,
		stake,
		shareQuantity: dp18("5"),
		priceAtBet: "0.500000000000000000",
		commentId,
		createdAt: args.createdAt,
	});
	await seedLotForBet(testDb, {
		betId,
		userId: args.userId,
		marketId: args.marketId,
		side: args.side,
		shares: dp18("5"),
		stake,
	});
	return commentId;
}

async function remove(commentId: string): Promise<void> {
	await testDb.insert(modActions).values({
		targetCommentId: commentId,
		reason: "content_removed",
		categories: {},
		actorId: "admin-singleton",
	});
}

/**
 * Post 1 (NO, earlier) · Post 2 (YES) ← R1 (NO, counter) ← { C1 NO, C2 YES,
 * C3 NO removed } ; Post 2 ← R2 (YES, support), no children.
 */
async function seedThread() {
	const market = await seedMarket();
	const a = await seedUser("a");
	const b = await seedUser("b");
	const c = await seedUser("c");
	const d = await seedUser("d");
	const post1 = await seedArg({
		userId: d,
		marketId: market.id,
		side: "NO",
		body: "Earlier post one",
		parentCommentId: null,
		createdAt: at(1),
	});
	const post2 = await seedArg({
		userId: a,
		marketId: market.id,
		side: "YES",
		body: "Root post two",
		parentCommentId: null,
		createdAt: at(2),
	});
	const r1 = await seedArg({
		userId: b,
		marketId: market.id,
		side: "NO",
		body: "Depth one counter reply",
		parentCommentId: post2,
		createdAt: at(3),
	});
	const r2 = await seedArg({
		userId: d,
		marketId: market.id,
		side: "YES",
		body: "Depth one support reply",
		parentCommentId: post2,
		createdAt: at(4),
	});
	const c1 = await seedArg({
		userId: c,
		marketId: market.id,
		side: "NO",
		body: "Depth two agrees with the counter",
		parentCommentId: r1,
		createdAt: at(5),
	});
	const c2 = await seedArg({
		userId: a,
		marketId: market.id,
		side: "YES",
		body: "Depth two pushes back on the counter",
		parentCommentId: r1,
		createdAt: at(6),
	});
	const c3 = await seedArg({
		userId: c,
		marketId: market.id,
		side: "NO",
		body: "REMOVED depth two body must never serialize",
		parentCommentId: r1,
		createdAt: at(7),
	});
	await remove(c3);
	return { market, a, b, c, d, post1, post2, r1, r2, c1, c2, c3 };
}

describe("TEST-BRANCH depth-2 replies — read surfaces", () => {
	afterEach(async () => {
		await truncateTables(testClient, [
			"events",
			"payout_events",
			"resolution_events",
			"dharma_ledger",
			"bets",
			"comments",
			"positions",
			"pools",
			"markets",
			"mod_actions",
			"users",
		]);
		vi.clearAllMocks();
	});

	it("loadDebateView nests depth-2 under the depth-1 parent, oldest-first, masked", async () => {
		const t = await seedThread();
		const vm = await loadDebateView(testDb, { market: t.market });

		// Only the two top-level posts are posts.
		expect(vm.posts.map((p) => p.id).sort()).toEqual([t.post1, t.post2].sort());
		const post2 = vm.posts.find((p) => p.id === t.post2);
		if (!post2) throw new Error("post2 missing");

		// Post aggregates still count DIRECT children only (R1 counter, R2 support).
		expect(post2.aggregate.supportCount).toBe(1);
		expect(post2.aggregate.counterCount).toBe(1);
		expect(post2.replies.counter.map((r) => r.id)).toEqual([t.r1]);
		expect(post2.replies.support.map((r) => r.id)).toEqual([t.r2]);

		const r1 = post2.replies.counter[0] as DebateReply;
		expect(r1.subReplies?.map((r) => r.id)).toEqual([t.c1, t.c2, t.c3]);
		// A childless depth-1 reply carries an empty list; depth-2 carries none.
		expect(post2.replies.support[0]?.subReplies).toEqual([]);
		for (const child of r1.subReplies ?? []) {
			expect(child).not.toHaveProperty("subReplies");
		}
		// Stance relative to the IMMEDIATE parent (R1 is NO).
		const [c1, c2, c3] = r1.subReplies ?? [];
		expect(c1?.side === r1.side).toBe(true); // Support
		expect(c2?.side === r1.side).toBe(false); // Counter
		// SC-1 — the removed depth-2 row is the body-less variant, and its body is
		// nowhere in the serialized model.
		expect(c3?.removed).toBe(true);
		expect(c3).not.toHaveProperty("body");
		expect(c3).not.toHaveProperty("author");
		expect(JSON.stringify(vm)).not.toContain("REMOVED depth two body");
		// The present depth-2 rows carry their content.
		expect(c1?.removed === false && c1.body).toBe(
			"Depth two agrees with the counter",
		);

		// Header totals count every reply (depth 1 + depth 2).
		expect(vm.market.totals.postCount).toBe(2);
		expect(vm.market.totals.replyCount).toBe(5);
	});

	it("a removed depth-1 reply keeps its depth-2 children", async () => {
		const t = await seedThread();
		await remove(t.r1);
		const vm = await loadDebateView(testDb, { market: t.market });
		const post2 = vm.posts.find((p) => p.id === t.post2);
		const r1 = post2?.replies.counter[0];
		expect(r1?.removed).toBe(true);
		expect(r1?.subReplies?.map((r) => r.id)).toEqual([t.c1, t.c2, t.c3]);
		expect(JSON.stringify(vm)).not.toContain("Depth one counter reply");
	});

	it("the .md export prints depth-2 blocks relative to their parent, masked", async () => {
		const t = await seedThread();
		const vm = await loadDebateView(testDb, { market: t.market });
		const md = serializeDebateExport({
			model: vm,
			meta: {
				outcome: null,
				resolvedAt: null,
				resolutionReason: null,
				participants: 4,
				totalStakeDharma: dp18("70"),
			},
			context: "CTX",
			exportedAt: "2026-09-15T00:00:00Z",
		});
		expect(md).toContain("replies: 5");
		expect(md).toContain("Support (same side as the reply it answers)");
		expect(md).toContain("Counter (opposite side from the reply it answers)");
		expect(md).toMatch(/##### Reply \d+\.\d+\.1 — Support \(NO\)/);
		expect(md).toMatch(/##### Reply \d+\.\d+\.2 — Counter \(YES\) — /);
		expect(md).toMatch(
			/##### Reply \d+\.\d+\.3 — Support \(NO\) — \[removed by moderator\]/,
		);
		expect(md).toContain("Depth two pushes back on the counter");
		expect(md).not.toContain("REMOVED depth two body");
	});

	it("profile arguments: a depth-2 reply deep-links to its ROOT post and names its parent", async () => {
		const t = await seedThread();
		const items = await loadProfileArguments(testDb, { userId: t.c });
		const c1 = items.find((i) => i.id === t.c1);
		expect(c1?.removed).toBe(false);
		if (c1?.removed === false && c1.kind === "reply") {
			expect(c1.ordinal).toBe(2); // post2's ordinal, not 0
			expect(c1.repliedToTitle).toBe(
				deriveTitleTeaser("Depth one counter reply").title,
			);
		}
		const c3 = items.find((i) => i.id === t.c3);
		expect(c3?.removed).toBe(true);
		expect(c3?.ordinal).toBe(2);
		expect(JSON.stringify(items)).not.toContain("REMOVED depth two body");

		// A removed depth-1 parent yields a null replied-to title (no leak).
		await remove(t.r1);
		const after = await loadProfileArguments(testDb, { userId: t.c });
		const c1b = after.find((i) => i.id === t.c1);
		if (c1b?.removed === false && c1b.kind === "reply") {
			expect(c1b.repliedToTitle).toBeNull();
		} else {
			throw new Error("c1 should be present");
		}
		expect(JSON.stringify(after)).not.toContain("Depth one counter reply");
	});

	it("profile positions: a depth-2 opener carries its ROOT post's ordinal", async () => {
		const t = await seedThread();
		// `c` holds NO from C1 (and the removed C3); a held position makes a row.
		await testDb.insert(positions).values({
			userId: t.c,
			marketId: t.market.id,
			side: "NO",
			quantity: dp18("10"),
		});
		const rows = await loadProfilePositions(testDb, { userId: t.c });
		expect(rows.length).toBe(1);
		const cell = rows[0]?.argument;
		expect(cell?.removed).toBe(false);
		if (cell && cell.removed === false) {
			expect(cell.commentId).toBe(t.c1);
			expect(cell.isReply).toBe(true);
			expect(cell.postOrdinal).toBe(2);
			expect(cell.repliedToTitle).toBe(
				deriveTitleTeaser("Depth one counter reply").title,
			);
		}
		expect(JSON.stringify(rows)).not.toContain("REMOVED depth two body");
	});
});
