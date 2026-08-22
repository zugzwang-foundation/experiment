import { eq } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";
import { afterEach, describe, expect, it } from "vitest";
import { GET } from "@/app/(public)/m/[slug]/export/route";
import { db } from "@/db";
import { lots, markets, modActions, pools, users } from "@/db/schema";
import { topOrder } from "@/lib/ranking";
import { DEFAULT_RANKING_CONFIG } from "@/lib/ranking.config";
import { place } from "@/server/bets/place";
import { sell } from "@/server/bets/sell";
import { runBetTransaction } from "@/server/bets/transaction";
import { loadRankingSubstrate } from "@/server/debate-view/ranking-substrate";

import { testClient, testDb } from "../../db/_fixtures/db";
import { truncateTables } from "../../db/_fixtures/truncate";

/**
 * RANK-3 — **the count differential, and the noun the traction lane counts.**
 * DB-backed, driven through the real engine (`place`), with the export exercised
 * through its REAL route handler and NO session — which is the whole point of
 * (a): the surface is public.
 *
 * **(a) THE LEAK — SC-1, introduced by RANK-2.** RANK-2 excluded self-authored
 * replies from the attracted aggregates. It did not exclude them from the reply
 * LANE, which is unfiltered and includes removed stubs. Before RANK-2 those two
 * numbers were equal for every post; after it, **their difference is the
 * self-reply count** — and both are printed in the same public `.md` export.
 * A removed reply's author is deliberately withheld (the removed DTO variant
 * carries no `author`), so subtracting attributes it to a named pseudonym.
 *
 * **(b) THE NOUN.** `n` is `COUNT(rb.id)` — replies typed, not people arguing.
 * The thesis is `K · n > C`, where `n` is the number of PEOPLE holding the
 * knowledge. One account replying five times to a rival's post clears
 * `floorLane.n = 5` on its own. Those replies are CROSS-authored, so RANK-2's
 * self-exclusion does not touch them.
 *
 * ⚠ **Both halves are RED on `a3cf3f6`** and are the acceptance criteria.
 *
 * **(c) THE PRICE OF WHAT (b) LEAVES OPEN.** Not an acceptance test — a receipt.
 * R-3 prices the post-R-2 floor at five accounts; (c) measures **three**, because
 * `n` is the sum of two per-side DISTINCT aggregates and the ratified flip path
 * puts one `user_id` on both sides. It is GREEN before and after this change and
 * exists so the number in ADR-0039 P3 and RANKING.md §2 has something behind it.
 */

const SEED = "1000.000000000000000000";
const CFG = DEFAULT_RANKING_CONFIG;

const TABLES = [
	"mod_actions",
	"lots",
	"bets",
	"comments",
	"positions",
	"dharma_ledger",
	"events",
	"bet_receipts",
	"pools",
	"markets",
	"users",
];

function meta(userId: string) {
	return {
		request_id: "test-count-differential",
		flow_id: "F-BET-1",
		user_id: userId,
		actor_id: userId,
		idempotency_key: null,
		ip: "test",
		user_agent: "vitest",
	};
}

async function seedUser(tag: string): Promise<string> {
	const [user] = await testDb
		.insert(users)
		.values({
			name: "Differential User",
			email: `${tag}@example.com`,
			pseudonym: tag,
			tosAcceptedAt: new Date("2026-01-01T00:00:00Z"),
			lastAllowanceAccruedAt: new Date(),
		})
		.returning({ id: users.id });
	const userId = user?.id ?? "";
	const { appendLedgerRow } = await import("@/server/dharma/persist");
	await testDb.transaction((tx) =>
		appendLedgerRow(tx, { userId, amount: "5000", entryType: "initial_grant" }),
	);
	return userId;
}

async function seedOpenMarketWithPool(slug: string): Promise<string> {
	const [market] = await testDb
		.insert(markets)
		.values({
			slug,
			title: "Differential Market",
			status: "Open",
			resolutionDeadline: new Date("2027-01-01T00:00:00Z"),
		})
		.returning({ id: markets.id });
	const marketId = market?.id ?? "";
	await testDb
		.insert(pools)
		.values({ marketId, yesReserves: SEED, noReserves: SEED });
	return marketId;
}

async function placeBet(args: {
	userId: string;
	marketId: string;
	side: "YES" | "NO";
	stake: string;
	parentCommentId?: string | null;
}): Promise<{ betId: string; commentId: string }> {
	const r = await runBetTransaction(
		{ marketId: args.marketId, flow: "F-BET-1" },
		(ctx) =>
			place(ctx, {
				userId: args.userId,
				marketId: args.marketId,
				side: args.side,
				stake: args.stake,
				body: `differential argument ${uuidv7()}`,
				parentCommentId: args.parentCommentId ?? null,
				idempotencyKey: uuidv7(),
				bodyFingerprint: uuidv7(),
				betEventId: uuidv7(),
				commentEventId: uuidv7(),
				creditEventId: uuidv7(),
				metadata: meta(args.userId),
			}),
	);
	return { betId: r.betId, commentId: r.commentId };
}

/** Exit one argument entirely, through the shipped per-lot sell path (R3). */
async function exitArgumentFully(args: {
	userId: string;
	marketId: string;
	betId: string;
}): Promise<void> {
	const [lot] = await testDb
		.select()
		.from(lots)
		.where(eq(lots.betId, args.betId));
	await runBetTransaction({ marketId: args.marketId, flow: "F-BET-3" }, (ctx) =>
		sell(ctx, {
			userId: args.userId,
			marketId: args.marketId,
			shares: lot?.survivingShares ?? "0",
			lotId: lot?.id,
			sellEventId: uuidv7(),
			syntheticBetId: uuidv7(),
			idempotencyKey: uuidv7(),
			bodyFingerprint: uuidv7(),
			metadata: { ...meta(args.userId), flow_id: "F-BET-3" },
		}),
	);
}

/** The audited masking gate's own row shape — a `content_removed` mod action. */
async function removeComment(commentId: string): Promise<void> {
	await testDb.insert(modActions).values({
		targetCommentId: commentId,
		reason: "content_removed",
		verdict: null,
		categories: {},
		actorId: "admin-singleton",
	});
}

/** Fetch the PUBLIC export exactly as a signed-out reader would. */
async function exportText(slug: string): Promise<string> {
	const res = await GET(new Request(`http://localhost/m/${slug}/export`), {
		params: Promise.resolve({ slug }),
	});
	return res.text();
}

describe("RANK-3 — the displayed count and the ranking input are two numbers", () => {
	afterEach(async () => {
		await truncateTables(testClient, TABLES);
	});

	it("⛔ RED: the public export's own two numbers reveal a removed self-reply", async () => {
		const author = await seedUser("diff-author");
		const outsider = await seedUser("diff-outsider");
		const slug = "m-diff-leak";
		const marketId = await seedOpenMarketWithPool(slug);

		const post = await placeBet({
			userId: author,
			marketId,
			side: "YES",
			stake: "100",
		});
		// The author replies to their OWN post, and that reply is then removed.
		// Its authorship is withheld from every reader by the masking gate.
		const hidden = await placeBet({
			userId: author,
			marketId,
			side: "YES",
			stake: "50",
			parentCommentId: post.commentId,
		});
		await removeComment(hidden.commentId);
		// One genuine cross-authored reply, visible and attributed.
		await placeBet({
			userId: outsider,
			marketId,
			side: "YES",
			stake: "70",
			parentCommentId: post.commentId,
		});

		const md = await exportText(slug);

		// The two numbers the export prints, both from the same file.
		const laneTotal = Number(/^replies: (\d+)$/m.exec(md)?.[1] ?? "-1");
		// ⚠ Scoped to the Support/Counter aggregate LINE, not the whole document:
		// the export prepends a version-pinned `zugzwang.md` context block, and a
		// bare `/(\d+) support/g` over the file would sum whatever that block
		// happens to say. Brittle in a way that is silent, which is the worst kind.
		const attributed = [
			...md.matchAll(/^- \*\*Support \/ Counter:\*\* (\d+) support/gm),
		].reduce((n, m) => n + Number(m[1]), 0);

		// The lane is unfiltered: two replies exist, one of them a removed stub.
		expect(laneTotal).toBe(2);

		// ⛔ THE LEAK. On `a3cf3f6` the attributed count is 1 — the self-reply is
		// excluded — so `2 − 1 = 1` tells an anonymous reader that exactly one of
		// these replies is the post author's own. Only one row is unattributed:
		// the removed stub. The removal is therefore attributable to a named
		// pseudonym, from a signed-out page, with arithmetic.
		expect(laneTotal - attributed).toBe(0);
	});

	it("⛔ RED: one sybil's five replies clear the traction floor on their own", async () => {
		const rival = await seedUser("diff-rival");
		const sybil = await seedUser("diff-sybil");
		const quiet = await seedUser("diff-quiet");
		const marketId = await seedOpenMarketWithPool("m-diff-distinct");

		// The rival's post — the slot being captured.
		const target = await placeBet({
			userId: rival,
			marketId,
			side: "YES",
			stake: "10",
		});
		// ONE account, FIVE replies. Cross-authored, so RANK-2's self-exclusion
		// does not touch them; `floorLane.n = 5` and `clears()` is `>=`.
		const sybilBets: string[] = [];
		for (let i = 0; i < 5; i++) {
			const r = await placeBet({
				userId: sybil,
				marketId,
				side: "YES",
				stake: "50",
				parentCommentId: target.commentId,
			});
			sybilBets.push(r.betId);
		}
		// A quiet post with ten times the conviction and no manufactured volume.
		const honest = await placeBet({
			userId: quiet,
			marketId,
			side: "YES",
			stake: "100",
		});

		// ⚠ THE SELL IS NOT OPTIONAL TO THE ATTACK, and finding that out was the
		// point of running this test before believing it. At the shipped floors
		// five replies at BET_MIN_STAKE_REPLY are Đ250, which clears
		// `floorLane.D = 200` on its own — so while the sybil still HOLDS, the
		// post ranks on the STAKE lane and ranks there legitimately: that is real,
		// currently-held attraction and RANK-1 already governs it.
		//
		// The count axis only becomes reachable once the money leaves. RANK-1's
		// decay takes D to zero; the count does not move, because counts are taken
		// over Bucket-A rows. THAT is the residue this task is about.
		for (const betId of sybilBets) {
			await exitArgumentFully({ userId: sybil, marketId, betId });
		}

		const posts = await loadRankingSubstrate(db, { marketId });
		const captured = posts.find((p) => p.id === target.commentId);
		if (!captured) {
			throw new Error("expected the target post in the substrate");
		}

		// The stake decayed with the exit (RANK-1) …
		expect(Number(captured.supportDharma)).toBe(0);
		// …and the five replies are still there, still counted for DISPLAY …
		expect(captured.supportCountTotal).toBe(5);
		// ⛔ RED ON `a3cf3f6`: traction counted REPLIES, so this read 5 and cleared
		// `floorLane.n`. `n` is meant to be the number of PEOPLE who hold the
		// knowledge — and one person is one person however often they type.
		expect(captured.supportCount).toBe(1);

		// …and with n = 1 the post is BELOW_FLOOR on every lane, so the order
		// falls to the §3.4 tie chain: Đ100 of held conviction beats Đ10.
		expect(topOrder(posts, CFG).map((p) => p.id)).toEqual([
			honest.commentId,
			target.commentId,
		]);
	});

	it("prices the residual: the flip path buys TWO people-units per account, so the floor is THREE", async () => {
		const rival = await seedUser("flip-rival");
		const quiet = await seedUser("flip-quiet");
		const marketId = await seedOpenMarketWithPool("m-flip-floor");

		const target = await placeBet({
			userId: rival,
			marketId,
			side: "YES",
			stake: "10",
		});
		const honest = await placeBet({
			userId: quiet,
			marketId,
			side: "YES",
			stake: "100",
		});

		// ⚠ THE RESIDUAL IS NOT WHAT R-3 PRICES IT AT, and this is the receipt.
		// `n` is `supportCount + counterCount` (ranking.ts::derive), and the two
		// are SEPARATE per-side DISTINCT aggregates — so one user_id appearing on
		// both sides of the same post is counted once in EACH. The flip is a
		// shipped, ratified path: `place` rejects only a HELD opposite side
		// (`getHeldPosition` is quantity > 0), so sell-to-zero re-opens the other
		// side, and INV-3 freezes each reply on the side it was posted from.
		//
		// ⇒ one account = two people-units. R-2 raises the floor from ONE account
		// to THREE, not to five.
		for (const tag of ["flip-a", "flip-b", "flip-c"]) {
			const acct = await seedUser(tag);
			const yes = await placeBet({
				userId: acct,
				marketId,
				side: "YES",
				stake: "50",
				parentCommentId: target.commentId,
			});
			await exitArgumentFully({ userId: acct, marketId, betId: yes.betId });
			await placeBet({
				userId: acct,
				marketId,
				side: "NO",
				stake: "50",
				parentCommentId: target.commentId,
			});
		}

		const posts = await loadRankingSubstrate(db, { marketId });
		const captured = posts.find((p) => p.id === target.commentId);
		if (!captured) {
			throw new Error("expected the target post in the substrate");
		}

		// Three accounts, six replies, counted as three people on each side.
		expect(captured.supportCount).toBe(3);
		expect(captured.counterCount).toBe(3);
		expect(captured.supportCountTotal).toBe(3);
		expect(captured.counterCountTotal).toBe(3);
		// n = 6 >= floorLane.n = 5 — TRACTION CLEARS on three accounts.
		expect(
			captured.supportCount + captured.counterCount,
		).toBeGreaterThanOrEqual(CFG.floorLane.n);
		// …while the money stayed below its own floor: the YES halves were sold to
		// zero, so only the three NO replies survive (Đ150 < floorLane.D = 200).
		// The capture is bought on the COUNT axis, which is the axis that does not
		// decay, and it is bought for Đ150 that the fee-less CPMM returns on exit.
		expect(Number(captured.supportDharma)).toBe(0);
		expect(Number(captured.counterDharma)).toBe(150);
		expect(
			Number(captured.supportDharma) + Number(captured.counterDharma),
		).toBeLessThan(Number(CFG.floorLane.D));

		// Sole floor-clearer on traction ⇒ SENTINEL_MAX ⇒ #1 outright, over a post
		// holding ten times the conviction. Counts never decay, so this is
		// permanent — neither removal nor a ban decrements it.
		expect(topOrder(posts, CFG).map((p) => p.id)).toEqual([
			target.commentId,
			honest.commentId,
		]);
	});
});
