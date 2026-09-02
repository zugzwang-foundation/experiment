import { v7 as uuidv7 } from "uuid";
import { afterEach, describe, expect, it } from "vitest";
import { db } from "@/db";
import { markets, pools, users } from "@/db/schema";
import { badgeFor, rankReplies, topOrder } from "@/lib/ranking";
import { DEFAULT_RANKING_CONFIG } from "@/lib/ranking.config";
import { place } from "@/server/bets/place";
import { runBetTransaction } from "@/server/bets/transaction";
import { loadRankingSubstrate } from "@/server/debate-view/ranking-substrate";
import { loadReplySubstrate } from "@/server/debate-view/reply-substrate";
import { loadProfileArguments } from "@/server/profile/arguments";

import { testClient, testDb } from "../../db/_fixtures/db";
import { truncateTables } from "../../db/_fixtures/truncate";

/**
 * RANK-2 — **self-authored replies are not attraction.** DB-BACKED, driven
 * through the real engine (`place`), never through hand-written rows: the whole
 * point is what the shipped write path permits, and a fixture that hand-inserts
 * `comments` would prove nothing about that.
 *
 * **The attack RANK-1 left open.** RANK-1 moved every *stake* input onto
 * surviving lot basis, so a bought slot is released when the money leaves. It
 * moved no *count* input, because there were none in its ruling. But three
 * ranking inputs are counts — traction `n`, the dominance split `lop`, and the
 * contestation badge `n^b` — and `support_count` / `counter_count` are plain
 * `COUNT(...)` over Bucket-A rows with **no survival predicate**. A count can
 * never move, by any mechanism in the system, including moderation (RANKING.md
 * is explicit that removed items remain counted).
 *
 * So, with one account and `DEFAULT_RANKING_CONFIG`: post at the Đ10 post floor,
 * reply to your OWN post six times at the Đ50 reply floor — there is no
 * self-reply guard, no per-post reply cap, and no uniqueness on
 * `(user, parent_comment_id)` — and `n = 6` clears `floorLane.n = 5` while
 * `lop = 1` clears the `floorSplit = 6` gate. Sole clearer ⇒ `SENTINEL_MAX` ⇒
 * **`topOrder` #1 outright**, plus the Most Debated badge, plus the Discovery
 * hero panel. Then sell everything back through a fee-less CPMM for dust. The
 * counts never move; the slot is permanent.
 *
 * **THE RULING (ADR-0039 patch record, RANK-2).** *Self-authored replies do not
 * count as attraction.* A reply whose author is the parent post's author is
 * excluded from the count lanes and from the attracted-value aggregates — and
 * from **nothing else**. It keeps its own stake, its own lane position, its own
 * ranking weight as an argument, and its place in the author's Arguments count.
 * The argument still happened and R9 still holds. What changes is only this: a
 * post attracting its own author is not attracting anything, and attraction is
 * what those inputs measure.
 *
 * ⚠ **Counts could not simply be made to decay**, which is why the fix removes
 * the attack's *other* leg. Decaying a count would say an argument someone made
 * and then exited never got made — and R9 makes Sold permanent precisely
 * because it did.
 *
 * ⚠ **The `#1 outright` half of this file is RED on `4c64e40`** and is the
 * acceptance criterion. The self-reply half — that the replies keep their own
 * lane — passes both before and after, deliberately: it is the control proving
 * the fix removed attraction and nothing else.
 */

const SEED = "1000.000000000000000000";
const CFG = DEFAULT_RANKING_CONFIG;
/** 18-dp decimal string → exact scaled integer (no JS float; CLAUDE.md §2). */
const units = (v: string): bigint => BigInt(v.replace(".", ""));

const TABLES = [
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
		request_id: "test-self-reply-capture",
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
			name: "Capture User",
			email: `${tag}@example.com`,
			pseudonym: tag,
			tosAcceptedAt: new Date("2026-01-01T00:00:00Z"),
			lastAllowanceAccruedAt: new Date(),
		})
		.returning({ id: users.id });
	const userId = user?.id ?? "";
	const { appendLedgerRow } = await import("@/server/dharma/persist");
	await testDb.transaction((tx) =>
		appendLedgerRow(tx, {
			userId,
			amount: "5000",
			entryType: "initial_grant",
		}),
	);
	return userId;
}

async function seedOpenMarketWithPool(slug: string): Promise<string> {
	const [market] = await testDb
		.insert(markets)
		.values({
			slug,
			title: "Capture Market",
			status: "Open",
			resolutionDeadline: new Date("2026-11-01T00:00:00Z"),
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
				body: `capture argument ${uuidv7()}`,
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

/**
 * The attack, exactly as an attacker would run it: ONE account, the two floors,
 * six self-replies. Plus one honest post by a different author that stakes TEN
 * TIMES as much and attracts nothing — so the ordering question is purely
 * "does volume the author manufactured for itself outrank real conviction".
 */
async function seedSelfReplyCapture(slug: string) {
	const attacker = await seedUser(`${slug}-attacker`);
	const honest = await seedUser(`${slug}-honest`);
	const marketId = await seedOpenMarketWithPool(slug);

	// Placed FIRST, so if the two ever tie on stake the attacker would win the
	// earlier-wins tiebreak — the fix must not depend on ordering luck.
	const captured = await placeBet({
		userId: attacker,
		marketId,
		side: "YES",
		stake: "10", // BET_MIN_STAKE_POST
	});
	const selfReplies: string[] = [];
	for (let i = 0; i < 6; i++) {
		const r = await placeBet({
			userId: attacker,
			marketId,
			side: "YES", // same side as their own holding — F-BET-10 never fires
			stake: "50", // BET_MIN_STAKE_REPLY
			parentCommentId: captured.commentId,
		});
		selfReplies.push(r.commentId);
	}

	const genuine = await placeBet({
		userId: honest,
		marketId,
		side: "YES",
		stake: "100", // 10x the attacker's conviction, zero manufactured volume
	});

	return { attacker, honest, marketId, captured, genuine, selfReplies };
}

describe("RANK-2 — a post attracting its own author is not attracting anything", () => {
	afterEach(async () => {
		await truncateTables(testClient, TABLES);
	});

	it("the engine PERMITS the attack setup — six self-replies, no guard", async () => {
		// Not an assertion about ranking; an assertion about what is reachable.
		// If any of these ever starts failing, the attack is closed by a guard
		// somewhere else and this whole file needs re-reading rather than fixing.
		const f = await seedSelfReplyCapture("m-self-reply-permitted");
		expect(f.selfReplies.length).toBe(6);
		expect(new Set(f.selfReplies).size).toBe(6); // no uniqueness collapse
	});

	it("⛔ RED ON MAIN: six self-replies take topOrder #1 outright", async () => {
		const f = await seedSelfReplyCapture("m-self-reply-capture");
		const posts = await loadRankingSubstrate(db, { marketId: f.marketId });
		const captured = posts.find((p) => p.id === f.captured.commentId);
		const genuine = posts.find((p) => p.id === f.genuine.commentId);
		if (!captured || !genuine) {
			throw new Error("expected both posts in the substrate");
		}

		// The manufactured volume must not reach the lanes at all.
		expect(captured.supportCount).toBe(0);
		expect(captured.counterCount).toBe(0);
		expect(units(captured.supportDharma)).toBe(BigInt(0));
		expect(units(captured.counterDharma)).toBe(BigInt(0));

		// With n = 0 the post is BELOW_FLOOR on every lane, so the order falls to
		// the §3.4 tie chain — author conviction still held. Đ100 beats Đ10.
		expect(topOrder(posts, CFG).map((p) => p.id)).toEqual([
			f.genuine.commentId,
			f.captured.commentId,
		]);

		// …and it earns no badge from volume it manufactured for itself.
		expect(badgeFor(captured, posts, CFG)).toBeNull();
	});

	it("OVER-exclusion control: a CROSS-USER reply still counts, at both remaining app sites", async () => {
		// ⛔ THE MUTATION THIS CATCHES, and nothing else in the suite does: an
		// exclusion written as `rc.user_id <> rc.user_id` (or any predicate that
		// is simply always false) would satisfy the parity regex, satisfy every
		// assertion in the tests above — which only ever check that self-replies
		// are GONE — and ship a product where NO reply ever counts as attraction.
		// Under-exclusion is loud; over-exclusion is silent. This is the control.
		//
		// Sites 2 and 3 had textual coverage only before this test: the parity
		// scan proves the predicate is PRESENT, never that it is CORRECT.
		const f = await seedSelfReplyCapture("m-cross-user-counts");
		const outsider = await seedUser("m-cross-user-counts-outsider");
		await placeBet({
			userId: outsider,
			marketId: f.marketId,
			side: "YES",
			stake: "70",
			parentCommentId: f.captured.commentId,
		});

		// Site 1 — the debate view SUBSTRATE, which is where the ranking counts
		// live and the only place they are allowed to live (RANK-3 R-1).
		const posts = await loadRankingSubstrate(db, { marketId: f.marketId });
		const captured = posts.find((p) => p.id === f.captured.commentId);
		// The RANKING count: one person — the outsider, not the six selves. Since
		// RANK-3 this is DISTINCT PEOPLE, so it would read 1 for the outsider even
		// if they had replied repeatedly.
		expect(captured?.supportCount).toBe(1);
		expect(units(captured?.supportDharma ?? "0")).toBe(
			units("70.000000000000000000"),
		);
		// The DISPLAY total, on the same row: every reply, self-authored included.
		// Six self-replies + one outsider = 7. A reader can count seven, so seven
		// is what a surface must show.
		expect(captured?.supportCountTotal).toBe(7);

		// Site 2 — the profile, read as the POST's author.
		//
		// ⚠ ASSERTED DIFFERENTLY SINCE RANK-3, and the change is the point: this
		// line used to read `aggregate.supportCount === 1`, because the DTO then
		// carried the ranking count. R-1 makes the DTO carry the DISPLAY total —
		// the ranking count must reach no client — so the same field now correctly
		// reads 7. The over-exclusion property has not been dropped; it moved to
		// the DHARMA, which is still self-exclusive and still on the DTO. That is
		// the stronger probe anyway: an always-false predicate would make it 370
		// and an always-true one would make it 0.
		const items = await loadProfileArguments(db, { userId: f.attacker });
		const item = items.find((i) => i.id === f.captured.commentId);
		if (item === undefined || item.removed || item.kind !== "post") {
			throw new Error("expected the captured post on the attacker's profile");
		}
		expect(item.aggregate.supportCount).toBe(7);
		expect(units(item.aggregate.supportDharma)).toBe(
			units("70.000000000000000000"),
		);

		// ⚠ SITE 3 (the cross-author bookmark read) WAS HERE AND IS GONE. The
		// bookmark module was removed from `main` by `unwire-1` while this branch
		// was open, so there are now THREE aggregate sites, not four. Recorded
		// rather than silently dropped: if bookmarks ever return, they return with
		// a copy of this query and will need the predicate and this control.
	});

	it("the self-replies KEEP their own stake, lane and weight (the ruling's other half)", async () => {
		// The control. The exclusion must remove ATTRACTION and nothing else —
		// R9 holds, the arguments still happened, and they still rank among
		// themselves on their own surviving basis.
		const f = await seedSelfReplyCapture("m-self-reply-preserved");
		const posts = await loadRankingSubstrate(db, { marketId: f.marketId });
		const parent = posts.find((p) => p.id === f.captured.commentId);
		const byParent = await loadReplySubstrate(db, { marketId: f.marketId });
		const replies = byParent.get(f.captured.commentId) ?? [];

		// Every self-reply is still loaded, still carries its stake, and is still
		// ranked in the parent's Support lane.
		expect(replies.length).toBe(6);
		for (const r of replies) {
			expect(units(r.stake)).toBe(units("50.000000000000000000"));
			expect(r.sold).toBe(false);
		}
		const ranked = rankReplies(replies, parent?.parentSide ?? "YES", CFG);
		expect(ranked.support.length).toBe(6);
		expect(ranked.counter.length).toBe(0);
	});
});
