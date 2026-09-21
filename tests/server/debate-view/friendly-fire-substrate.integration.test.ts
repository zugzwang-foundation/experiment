import { eq } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";
import { afterEach, describe, expect, it } from "vitest";
import { db } from "@/db";
import { comments, lots, markets, pools, users } from "@/db/schema";
import { place } from "@/server/bets/place";
import { sell } from "@/server/bets/sell";
import { runBetTransaction } from "@/server/bets/transaction";
import { loadRankingSubstrate } from "@/server/debate-view/ranking-substrate";
import { loadReplySubstrate } from "@/server/debate-view/reply-substrate";
import { loadProfileArguments } from "@/server/profile/arguments";

import { testClient, testDb } from "../../db/_fixtures/db";
import { truncateTables } from "../../db/_fixtures/truncate";

/**
 * FF-1 · G9 — **the three new aggregates, read off rows the ENGINE wrote**
 * (ADR-0058 outcome 4; RANKING.md §2 as amended).
 *
 * ADR-0058 splits one question into two. *How much attention did this post
 * attract?* is `support_dharma` / `counter_dharma` / the two `_count` pairs, and
 * the flag must not move ANY of them. *How contested is it?* is the new
 * `endorse_count` / `contest_count` pair, and the flag is the only thing that
 * moves those. A meter or a balance term reading the wrong bucket is the defect
 * this file exists to reject, and no amount of unit testing over hand-built
 * substrate literals can catch it — the buckets are SQL FILTER clauses, so they
 * have to be asked of real rows.
 *
 * The fixture drives `place` and `sell` through `runBetTransaction` exactly as
 * `tests/server/lots/rank-decay-parity.test.ts` does, so every reply has a real
 * `lots` row and the surviving-basis substitution is live rather than assumed.
 * ⚠ Direct-seeding `comments` + `bets` would have been shorter and would have
 * produced NO lots, which is the one arrangement in which the sell half of this
 * test cannot fail.
 *
 * The fixture, on one YES post by P (Đ200):
 *
 *   | replier | side | flag  | stake | counts toward                          |
 *   |---------|------|-------|-------|----------------------------------------|
 *   | A       | YES  | false | 50    | support_dharma, support_count, ENDORSE |
 *   | B       | YES  | TRUE  | 50    | support_dharma, support_count, CONTEST |
 *   |         |      |       |       | **and** friendly_fire_dharma           |
 *   | C       | NO   | false | 50    | counter_dharma, counter_count, CONTEST |
 *   | P       | YES  | TRUE  | 50    | NOTHING — self-authored (ADR-0039 P2)  |
 *
 * ⚠ **B is in `support_dharma` AND in `contest_count` at once, and that is the
 * design rather than a leak.** `support_dharma` is attracted value and B's Đ50
 * really is backing YES; `contest_count` is declared stance and B really did
 * contest. The two numbers answer different questions, which is why ADR-0058
 * added a pair rather than re-pointing the existing one.
 *
 * ⚠ **P's self-friendly-fire is the trap.** It is a legal reply that keeps its
 * own lane position and its own tag, and it must appear in the DISPLAY total
 * (`support_count_total = 3`) while contributing to NONE of the ranking or
 * attraction aggregates. A `friendly_fire_dharma` written without
 * `rc.user_id <> p.user_id` reads Đ100 here instead of Đ50, and the meter then
 * says a post is half-contested by its own author.
 *
 * Then B sells to zero: `friendly_fire_dharma` → 0 and `support_dharma` → 50
 * (surviving basis, ADR-0039 R4), while EVERY count stays put — counts are
 * `COUNT(...)` over Bucket-A rows and do not decay, by ruling (RANKING.md §2,
 * R9). ⛔ REJECTS a `friendly_fire_dharma` written over `bets.stake`, which
 * would still read Đ50 after a full exit.
 *
 * RED posture today: `loadRankingSubstrate` returns no `friendlyFireDharma`,
 * `endorseCount` or `contestCount`, and `loadReplySubstrate` rows carry no
 * `friendlyFire`; `place` ignores the flag, so every `comments.friendly_fire` is
 * the column default.
 */

const SEED = "1000.000000000000000000";
const units = (v: string): bigint => BigInt(v.replace(".", ""));
const dp18 = (v: string): string => {
	const [int, frac = ""] = v.split(".");
	return `${int}.${frac.padEnd(18, "0")}`;
};

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

function meta(userId: string, flowId: string) {
	return {
		request_id: "test-friendly-fire-substrate",
		flow_id: flowId,
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
			name: "FF Substrate User",
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

/**
 * The REAL W-1 write. `friendlyFire` is passed explicitly on every call — the
 * plan makes it a `PlaceParams` field, and stating it at each site means a
 * fixture can never rely on a default to express a stance.
 */
async function placeBet(args: {
	userId: string;
	marketId: string;
	side: "YES" | "NO";
	stake: string;
	parentCommentId?: string | null;
	friendlyFire: boolean;
}): Promise<{ betId: string; commentId: string }> {
	const flow = args.parentCommentId ? "F-COMMENT-2" : "F-BET-1";
	const r = await runBetTransaction({ marketId: args.marketId, flow }, (ctx) =>
		place(ctx, {
			userId: args.userId,
			marketId: args.marketId,
			side: args.side,
			stake: args.stake,
			body: `friendly-fire fixture argument ${uuidv7()}`,
			parentCommentId: args.parentCommentId ?? null,
			friendlyFire: args.friendlyFire,
			idempotencyKey: uuidv7(),
			bodyFingerprint: uuidv7(),
			betEventId: uuidv7(),
			commentEventId: uuidv7(),
			creditEventId: uuidv7(),
			metadata: meta(args.userId, flow),
		}),
	);
	return { betId: r.betId, commentId: r.commentId };
}

/** Exit a lot ENTIRELY — the surviving-basis branch the meter must follow. */
async function sellAll(args: {
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
			metadata: meta(args.userId, "F-BET-3"),
		}),
	);
}

async function seedFixture(slug: string) {
	const author = await seedUser(`${slug}-author`);
	const plain = await seedUser(`${slug}-plain`);
	const flagger = await seedUser(`${slug}-flagger`);
	const counter = await seedUser(`${slug}-counter`);

	const [market] = await testDb
		.insert(markets)
		.values({
			slug,
			title: "Friendly Fire Substrate Market",
			status: "Open",
			resolutionDeadline: new Date("2026-11-01T00:00:00Z"),
		})
		.returning({ id: markets.id });
	const marketId = market?.id ?? "";
	await testDb
		.insert(pools)
		.values({ marketId, yesReserves: SEED, noReserves: SEED });

	const post = await placeBet({
		userId: author,
		marketId,
		side: "YES",
		stake: "200",
		friendlyFire: false,
	});
	const plainReply = await placeBet({
		userId: plain,
		marketId,
		side: "YES",
		stake: "50",
		parentCommentId: post.commentId,
		friendlyFire: false,
	});
	const flaggedReply = await placeBet({
		userId: flagger,
		marketId,
		side: "YES",
		stake: "50",
		parentCommentId: post.commentId,
		friendlyFire: true,
	});
	const counterReply = await placeBet({
		userId: counter,
		marketId,
		side: "NO",
		stake: "50",
		parentCommentId: post.commentId,
		friendlyFire: false,
	});
	// The author friendly-fires their OWN post. Legal, tagged, lane-positioned —
	// and invisible to every aggregate below (ADR-0039 P2: a post attracting its
	// own author is not attracting anything).
	const selfReply = await placeBet({
		userId: author,
		marketId,
		side: "YES",
		stake: "50",
		parentCommentId: post.commentId,
		friendlyFire: true,
	});

	return {
		marketId,
		author,
		plain,
		flagger,
		counter,
		post,
		plainReply,
		flaggedReply,
		counterReply,
		selfReply,
	};
}

describe("FF-1 G9 — the friendly-fire aggregates on engine-written rows", () => {
	afterEach(async () => {
		await truncateTables(testClient, TABLES);
	});

	it("friendly-fire-substrate::buckets-split-endorse-from-support", async () => {
		const f = await seedFixture("ff-sub-buckets");
		const rows = await loadRankingSubstrate(db, { marketId: f.marketId });
		const row = rows.find((r) => r.id === f.post.commentId);
		if (row === undefined) {
			throw new Error("expected the post's substrate row");
		}

		// ── ATTRACTION — unchanged by the flag (ADR-0058 Driver 5) ───────────
		// A + B, both on the post's own side. `support_dharma` STILL INCLUDES the
		// flagged Đ50; the meter's numerator is a SUBSET of it, never a slice cut
		// out of it.
		expect(units(row.supportDharma)).toBe(units(dp18("100")));
		expect(units(row.counterDharma)).toBe(units(dp18("50")));
		expect(row.supportCount).toBe(2);
		expect(row.counterCount).toBe(1);

		// ── THE METER'S NUMERATOR — B only. P's self-flag is excluded. ────────
		// ⚠ The SHAPE is asserted before the arithmetic. A missing field would
		// otherwise surface as a TypeError inside `units()`, naming the helper
		// instead of the contract — a true refusal reported with a misleading
		// cause (O-3). It is also the decimal-string posture: an 18-dp NUMERIC
		// sum, never a JS number.
		expect(typeof row.friendlyFireDharma).toBe("string");
		expect(units(row.friendlyFireDharma)).toBe(units(dp18("50")));

		// ── DECLARED STANCE — the new pair, and the whole point of the ADR ────
		// endorse = same side, NO flag, not self → A alone.
		expect(row.endorseCount).toBe(1);
		// contest = opposite side OR same side WITH the flag, not self, each
		// person once → B (flagged Support) + C (Counter).
		expect(row.contestCount).toBe(2);

		// ⚠ THE READING THAT MAKES THIS WORTH ASSERTING. Under the pre-ADR side
		// formula this post is b = min(2,1)/max(2,1) = 0.5. Under declared stance
		// it is b = min(1,2)/max(1,2) = 0.5 as well — equal here by arithmetic
		// accident, which is precisely why the two counts are asserted separately
		// above rather than inferred from a badge.

		// ── DISPLAY TOTALS — self-INCLUSIVE, so three on the own side ─────────
		expect(row.supportCountTotal).toBe(3);
		expect(row.counterCountTotal).toBe(1);

		// ── n AND D — the two lanes the flag must never reach ─────────────────
		// `derive` is module-private, so its two inputs are recomputed here from
		// the substrate it would read. n counts PEOPLE on the side axis, never
		// the stance axis; D sums attraction, which the flag does not partition.
		expect(row.supportCount + row.counterCount).toBe(3);
		expect(units(row.supportDharma) + units(row.counterDharma)).toBe(
			units(dp18("150")),
		);
	});

	it("friendly-fire-substrate::exit-drains-the-meter-but-not-the-counts", async () => {
		const f = await seedFixture("ff-sub-exit");

		// Pre-state, so the drop below is a measured change and not a reading of
		// a fixture that was never non-zero (OVN-V3).
		const before = await loadRankingSubstrate(db, { marketId: f.marketId });
		const beforeRow = before.find((r) => r.id === f.post.commentId);
		expect(units(beforeRow?.friendlyFireDharma ?? "0")).toBe(units(dp18("50")));

		// B exits their flagged reply entirely.
		await sellAll({
			userId: f.flagger,
			marketId: f.marketId,
			betId: f.flaggedReply.betId,
		});

		const after = await loadRankingSubstrate(db, { marketId: f.marketId });
		const row = after.find((r) => r.id === f.post.commentId);
		if (row === undefined) {
			throw new Error("expected the post's substrate row after the sell");
		}

		// ⛔ Both aggregates key off SURVIVING basis. A `friendly_fire_dharma`
		// written over `bets.stake` reads Đ50 here forever — a meter reporting
		// conviction that has already left.
		expect(units(row.friendlyFireDharma)).toBe(BigInt(0));
		expect(units(row.supportDharma)).toBe(units(dp18("50")));
		expect(units(row.counterDharma)).toBe(units(dp18("50")));

		// ⚠ AND NOT ONE COUNT MOVES. Counts do not decay by ruling: B argued, and
		// exiting the position does not un-argue it (RANKING.md §2, R9).
		expect(row.endorseCount).toBe(1);
		expect(row.contestCount).toBe(2);
		expect(row.supportCount).toBe(2);
		expect(row.counterCount).toBe(1);
		expect(row.supportCountTotal).toBe(3);
		expect(row.counterCountTotal).toBe(1);
	});

	it("friendly-fire-substrate::reply-rows-carry-the-flag", async () => {
		const f = await seedFixture("ff-sub-replies");
		const byParent = await loadReplySubstrate(db, { marketId: f.marketId });
		const replies = byParent.get(f.post.commentId) ?? [];
		const flagOf = (id: string) =>
			replies.find((r) => r.id === id)?.friendlyFire;

		// All four replies are present — the lane filters nothing, self-replies
		// included (the other half of the ADR-0039 P2 ruling).
		expect(replies.length).toBe(4);

		// The flag reaches the DTO per row, which is what the reply tag renders.
		expect(flagOf(f.flaggedReply.commentId)).toBe(true);
		expect(flagOf(f.selfReply.commentId)).toBe(true);
		// …and `false`, not `undefined`, on the unflagged ones: a row whose flag
		// simply went missing would satisfy a truthiness check on the tag while
		// being unrenderable as an explicit "plain Support".
		expect(flagOf(f.plainReply.commentId)).toBe(false);
		expect(flagOf(f.counterReply.commentId)).toBe(false);

		// …and each mirrors the stored column, so the loader is reading the row
		// rather than deriving the stance from the side it happens to be on.
		const stored = await testDb
			.select({ id: comments.id, friendlyFire: comments.friendlyFire })
			.from(comments)
			.where(eq(comments.marketId, f.marketId));
		for (const reply of replies) {
			const column = stored.find((c) => c.id === reply.id)?.friendlyFire;
			expect(reply.friendlyFire).toBe(column);
		}
	});

	it("friendly-fire-substrate::profile-aggregate-is-unmoved-by-the-flag", async () => {
		// The profile query is a byte-mirror of the ranking one (G11 pins the
		// three spellings textually, which is where the endorse/contest parity is
		// actually asserted — the ranking counts may never reach a DTO, RANK-3).
		// What IS observable at this surface is the purity half of ADR-0058: the
		// footer a reader sees must be byte-identical to what it would be with no
		// flag anywhere, INCLUDING the flagged stake inside `supportDharma`.
		const f = await seedFixture("ff-sub-profile");
		const items = await loadProfileArguments(db, { userId: f.author });
		const item = items.find((i) => i.id === f.post.commentId);
		if (item === undefined || item.removed || item.kind !== "post") {
			throw new Error("expected a present post item on the author's profile");
		}

		// The DISPLAY totals (self-inclusive) and the attracted sums — the flag
		// partitions none of them.
		expect(item.aggregate.supportCount).toBe(3);
		expect(item.aggregate.counterCount).toBe(1);
		expect(units(item.aggregate.supportDharma)).toBe(units(dp18("100")));
		expect(units(item.aggregate.counterDharma)).toBe(units(dp18("50")));

		// ⛔ AND THE RANKING PAIR IS STILL NOT HERE. `endorseCount` /
		// `contestCount` are ranking inputs; a DTO carrying them re-opens the
		// SC-1 differential the same way `supportCount` did (RANK-3). This is a
		// positive assertion of an absence and is meant to stay green.
		expect(JSON.stringify(item)).not.toContain("endorseCount");
		expect(JSON.stringify(item)).not.toContain("contestCount");
		expect(JSON.stringify(item)).not.toContain("friendlyFireDharma");
	});
});
