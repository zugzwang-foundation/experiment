import { afterEach, beforeEach, describe, expect, it } from "vitest";
// GREENFIELD route — `@/app/(public)/m/[slug]/export/route` is not built until the
// writer lands it → RED at collection (module not found), NOT on a DB assertion.
// The test drives the REAL `GET` through the REAL `loadDebateView` +
// `loadExportMarketMeta` against a seeded debate (incl. an injected `mod_actions`
// `content_removed` row) — the masking / identity-non-leak path end to end.
// DB-BACKED (local Postgres :54322). Fixtures bypass the app layer (SPEC.2 §6.6).
import { GET } from "@/app/(public)/m/[slug]/export/route";
import {
	bets,
	comments,
	markets,
	modActions,
	pools,
	resolutionEvents,
	users,
} from "@/db/schema";

import { testClient, testDb } from "../db/_fixtures/db";
import { truncateTables } from "../db/_fixtures/truncate";

/** Canonical 18-dp NUMERIC from a whole number (stakes). */
const c18 = (n: number): string => `${n}.000000000000000000`;
/** Canonical 18-dp NUMERIC from a decimal string (prices). */
const p18 = (s: string): string => {
	const [int, frac = ""] = s.split(".");
	return `${int}.${(frac + "0".repeat(18)).slice(0, 18)}`;
};
const DEADLINE = new Date("2027-01-01T00:00:00.000Z");

async function seedUser(pseudonym: string): Promise<string> {
	const [u] = await testDb
		.insert(users)
		.values({
			name: "Seed User",
			email: `${pseudonym.toLowerCase()}@example.com`,
			pseudonym,
			tosAcceptedAt: new Date("2026-01-01T00:00:00.000Z"),
			lastAllowanceAccruedAt: new Date(),
		})
		.returning({ id: users.id });
	return u?.id ?? "";
}

async function seedMarket(args: {
	slug: string;
	status: "Open" | "Resolved";
	resolutionOutcome?: "YES" | "NO" | "VOID" | null;
	resolvedAt?: Date | null;
	withPool?: boolean;
}): Promise<string> {
	const [m] = await testDb
		.insert(markets)
		.values({
			slug: args.slug,
			title: "Will the seeded debate export cleanly before the freeze?",
			description: "Resolves YES if the export route serializes with no leak.",
			status: args.status,
			resolutionDeadline: DEADLINE,
			resolutionOutcome: args.resolutionOutcome ?? null,
			resolvedAt: args.resolvedAt ?? null,
		})
		.returning({ id: markets.id });
	const marketId = m?.id ?? "";
	if (args.withPool !== false) {
		await testDb.insert(pools).values({
			marketId,
			yesReserves: c18(1000),
			noReserves: c18(1000),
		});
	}
	return marketId;
}

/** Insert a comment + its riding bet (reached via `bets.comment_id`, never `comments.bet_id`). */
async function seedNode(args: {
	userId: string;
	marketId: string;
	parentCommentId: string | null;
	side: "YES" | "NO";
	stake: number;
	price: string;
	body: string;
	createdAt: Date;
}): Promise<{ commentId: string; betId: string }> {
	const [c] = await testDb
		.insert(comments)
		.values({
			userId: args.userId,
			marketId: args.marketId,
			parentCommentId: args.parentCommentId,
			body: args.body,
			sideAtPostTime: args.side,
			createdAt: args.createdAt,
		})
		.returning({ id: comments.id });
	const commentId = c?.id ?? "";
	const [b] = await testDb
		.insert(bets)
		.values({
			userId: args.userId,
			marketId: args.marketId,
			side: args.side,
			stake: c18(args.stake),
			shareQuantity: c18(1),
			priceAtBet: args.price,
			commentId,
			createdAt: args.createdAt,
		})
		.returning({ id: bets.id });
	return { commentId, betId: b?.id ?? "" };
}

function exportRequest(slug: string): Promise<Response> {
	return GET(new Request(`http://localhost/m/${slug}/export`), {
		params: Promise.resolve({ slug }),
	});
}

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

// Visible node stakes: A 100 + B 200 + reply 30 + reply 40 = 370.
// Removed Post C stake 280 is masked OFF the node but STILL in the total + count.
const STAKE = { postA: 100, postB: 200, postC: 280, replyD: 30, replyE: 40 };
const VISIBLE_SUM = STAKE.postA + STAKE.postB + STAKE.replyD + STAKE.replyE; // 370
const TOTAL = VISIBLE_SUM + STAKE.postC; // 650

const REMOVED_BODY = "REMOVED-POST-SECRET-BODY-must-never-appear";
const REMOVED_PSEUDONYM = "RemovedGhost999";
// Post C's masked entry price (0.37) must never surface; the pool is 0.50/0.50
// so 0.37 appears nowhere by coincidence.
const REMOVED_PRICE_DISPLAY = "0.37";

afterEach(async () => {
	await truncateTables(testClient, [
		"mod_actions",
		"payout_events",
		"resolution_events",
		"bets",
		"comments",
		"positions",
		"pools",
		"markets",
		"users",
	]);
});

describe("debate-export route — masking + gap-fills (open market, injected content_removed)", () => {
	let seeded: {
		slug: string;
		userIds: string[];
		commentIds: string[];
		betIds: string[];
	};

	beforeEach(async () => {
		const slug = "export-it-mumbai";
		const marketId = await seedMarket({ slug, status: "Open" });

		const userA = await seedUser("CrimsonHawk207");
		const userB = await seedUser("GoldenLynx288");
		const userC = await seedUser(REMOVED_PSEUDONYM); // the removed author
		const userD = await seedUser("TealOwl118");
		const userE = await seedUser("AzureBison330");

		const postA = await seedNode({
			userId: userA,
			marketId,
			parentCommentId: null,
			side: "YES",
			stake: STAKE.postA,
			price: p18("0.42"),
			body: "The corridor carries this volume by design.",
			createdAt: new Date("2026-05-18T07:40:00.000Z"),
		});
		const postB = await seedNode({
			userId: userB,
			marketId,
			parentCommentId: null,
			side: "NO",
			stake: STAKE.postB,
			price: p18("0.55"),
			body: "Anchor on the actual ridership number.",
			createdAt: new Date("2026-05-21T12:30:00.000Z"),
		});
		// The post that gets moderator-removed (its body + author must be masked).
		const postC = await seedNode({
			userId: userC,
			marketId,
			parentCommentId: null,
			side: "NO",
			stake: STAKE.postC,
			price: "0.370000000000000000",
			body: REMOVED_BODY,
			createdAt: new Date("2026-05-26T19:05:00.000Z"),
		});
		// Reply under a VISIBLE post.
		const replyD = await seedNode({
			userId: userD,
			marketId,
			parentCommentId: postA.commentId,
			side: "YES",
			stake: STAKE.replyD,
			price: p18("0.48"),
			body: "The monsoon multiplier is underrated.",
			createdAt: new Date("2026-05-19T10:12:00.000Z"),
		});
		// SURVIVING reply under the REMOVED post (thread integrity — must render).
		const replyE = await seedNode({
			userId: userE,
			marketId,
			parentCommentId: postC.commentId,
			side: "NO",
			stake: STAKE.replyE,
			price: p18("0.51"),
			body: "Even setting tone aside, the throughput math holds.",
			createdAt: new Date("2026-05-27T07:15:00.000Z"),
		});

		// Inject the content_removed mod-action on Post C (the ONLY masking input).
		await testDb.insert(modActions).values({
			targetCommentId: postC.commentId,
			reason: "content_removed",
			verdict: null,
			categories: {},
			actorId: "admin-singleton",
		});

		seeded = {
			slug,
			userIds: [userA, userB, userC, userD, userE],
			commentIds: [
				postA.commentId,
				postB.commentId,
				postC.commentId,
				replyD.commentId,
				replyE.commentId,
			],
			betIds: [
				postA.betId,
				postB.betId,
				postC.betId,
				replyD.betId,
				replyE.betId,
			],
		};
	});

	it("debate-export-leak::output-emits-no-user_id-uuid-or-email", async () => {
		const body = await (await exportRequest(seeded.slug)).text();
		// Posts are positional `post-{rank}`, authors are pseudonyms — the export
		// legitimately emits ZERO UUIDs, so ANY match is a real deanonymization.
		expect(body).not.toMatch(UUID_RE);
		expect(body).not.toContain("@example.com");
		for (const id of [
			...seeded.userIds,
			...seeded.commentIds,
			...seeded.betIds,
		]) {
			expect(body).not.toContain(id);
		}
	});

	it("debate-export-leak::removed-node-body-and-author-are-masked", async () => {
		const body = await (await exportRequest(seeded.slug)).text();
		// The injected content_removed node: body + author + entry price withheld.
		expect(body).not.toContain(REMOVED_BODY);
		expect(body).not.toContain(REMOVED_PSEUDONYM);
		expect(body).not.toContain(REMOVED_PRICE_DISPLAY);
		expect(body).toContain("[removed by moderator]");
		// Its surviving reply is OTHER users' staked argument — it renders.
		expect(body).toContain(
			"Even setting tone aside, the throughput math holds.",
		);
		expect(body).toContain("AzureBison330");
	});

	it("debate-export-totals::total_stake_dharma-includes-removed-node-stake", async () => {
		const body = await (await exportRequest(seeded.slug)).text();
		// §10.5: removal hides voice, not balance — the removed 280 stays in the
		// total. 650 = visible 370 + removed 280, never the visible sum alone.
		expect(TOTAL).toBe(VISIBLE_SUM + STAKE.postC);
		expect(body).toContain(`total_stake_dharma: ${TOTAL}`);
		expect(body).not.toContain(`total_stake_dharma: ${VISIBLE_SUM}`);
		expect(body).toContain(`**Total staked:** ${TOTAL} Đ`);
	});

	it("debate-export-participants::count-includes-the-removed-author", async () => {
		const body = await (await exportRequest(seeded.slug)).text();
		// COUNT(DISTINCT user_id) over the market's bets = 5 (A,B,C,D,E) — the
		// removed author C is counted even though masked off its node.
		expect(body).toContain("participants: 5");
		expect(body).toContain("**Participants:** 5");
	});

	it("debate-export-gapfill::per-node-entry-price-from-price_at_bet", async () => {
		const body = await (await exportRequest(seeded.slug)).text();
		// Entry price = bets.price_at_bet rendered at 2 dp (CpmmDecimal.toFixed(2)).
		expect(body).toContain("**Entry price:** 0.42");
		expect(body).toContain("**Entry price:** 0.55");
	});

	it("debate-export-headers::markdown-attachment-no-store", async () => {
		const res = await exportRequest(seeded.slug);
		expect(res.status).toBe(200);
		expect(res.headers.get("content-type")).toBe(
			"text/markdown; charset=utf-8",
		);
		expect(res.headers.get("content-disposition")).toBe(
			'attachment; filename="export-it-mumbai.md"',
		);
		expect(res.headers.get("cache-control")).toBe("no-store");
	});
});

describe("debate-export route — resolved market final state", () => {
	let slug: string;

	beforeEach(async () => {
		slug = "export-it-resolved";
		const marketId = await seedMarket({
			slug,
			status: "Resolved",
			resolutionOutcome: "YES",
			resolvedAt: new Date("2026-07-01T00:00:00.000Z"),
		});
		const author = await seedUser("EmeraldFinch512");
		await seedNode({
			userId: author,
			marketId,
			parentCommentId: null,
			side: "YES",
			stake: 100,
			price: p18("0.6"),
			body: "The criterion was met well before the freeze.",
			createdAt: new Date("2026-05-10T00:00:00.000Z"),
		});
		// Chain-tip terminal resolution event — the reason gap-fill source.
		await testDb.insert(resolutionEvents).values({
			marketId,
			eventKind: "resolve",
			outcome: "YES",
			correctsEventId: null,
			reason: "Criterion met per MMRC figures.",
		});
	});

	it("debate-export-resolved::front-matter-carries-outcome-resolved_at-reason", async () => {
		const body = await (await exportRequest(slug)).text();
		expect(body).toContain("status: resolved");
		expect(body).toContain("outcome: YES");
		expect(body).toContain("resolved_at: 2026-07-01T00:00:00.000Z");
		expect(body).toContain(
			'resolution_reason: "Criterion met per MMRC figures."',
		);
	});

	it("debate-export-resolved::in-body-final-price-not-current", async () => {
		const body = await (await exportRequest(slug)).text();
		expect(body).toContain("Final price");
		expect(body).not.toContain("Current price");
	});
});
