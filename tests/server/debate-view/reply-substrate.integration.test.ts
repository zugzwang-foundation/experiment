import { afterEach, describe, expect, it, vi } from "vitest";

// DEBATE.4 §8 tests-first (plan §5a) — the RED driver for `loadReplySubstrate`,
// the NEW per-market reply-substrate loader. It returns a Map keyed by
// parentCommentId of `ReplySubstrate { id, side, stake, createdAt }`, where each
// reply's `stake` is its reply-bet's `bets.stake` reached via the circular pair
// `bets.comment_id = comments.id` (NEVER `comments.bet_id`, which is
// deliberately NULL — SPEC.2 §14.1 / CLAUDE.md §2). The consumer feeds
// `rankReplies(map.get(postId) ?? [], post.parentSide)`.
//
// RED target: `@/server/debate-view/reply-substrate` does NOT yet exist, so this
// file fails at COLLECTION until the implement phase lands the loader.
//
// Where a reply's STAKE matters (it always does here), a `bets` row is inserted
// with `comment_id` pointing at the reply comment — the only path to a stake.
// Posts/replies are otherwise direct-seeded (the loader is a pure read; INV-1
// bet↔comment atomicity is owned by I-ATOMICITY-001, not re-litigated here).
//
// DB-backed (local Postgres :54322; DATABASE_URL defaulted by
// tests/_setup/env.ts). TRUNCATE in afterEach. Money/side cross as STRING /
// "YES"|"NO" (CLAUDE.md §2).

vi.mock("@sentry/nextjs", () => ({
	captureMessage: vi.fn(),
	addBreadcrumb: vi.fn(),
	captureException: vi.fn(),
}));

import { bets, comments, markets, pools, users } from "@/db/schema";
// The RED import: greenfield loader under test. Value import → collection fails
// until `src/server/debate-view/reply-substrate.ts` lands.
import { loadReplySubstrate } from "@/server/debate-view/reply-substrate";

import { testClient, testDb } from "../../db/_fixtures/db";
import { truncateTables } from "../../db/_fixtures/truncate";

const SEED = "100.000000000000000000";

async function seedUser(tag: string): Promise<string> {
	const [user] = await testDb
		.insert(users)
		.values({
			name: "Reply User",
			email: `${tag}@example.com`,
			pseudonym: tag,
		})
		.returning({ id: users.id });
	return user?.id ?? "";
}

async function seedMarket(slug: string): Promise<string> {
	const [market] = await testDb
		.insert(markets)
		.values({
			slug,
			title: "Reply Substrate Market",
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

/** Direct-seed a post (parent_comment_id NULL) WITHOUT a bet (pure-read fixture). */
async function seedPost(args: {
	userId: string;
	marketId: string;
	side: "YES" | "NO";
	createdAt: Date;
}): Promise<string> {
	const [c] = await testDb
		.insert(comments)
		.values({
			userId: args.userId,
			marketId: args.marketId,
			body: "post body",
			sideAtPostTime: args.side,
			parentCommentId: null,
			betId: null,
			createdAt: args.createdAt,
		})
		.returning({ id: comments.id });
	return c?.id ?? "";
}

/**
 * Direct-seed a reply comment + its reply-bet. The stake is reached ONLY via
 * `bets.comment_id = reply.id` — `comments.bet_id` stays NULL (the deliberate
 * direction; SPEC.2 §14.1). Returns the reply comment id.
 */
async function seedReplyWithBet(args: {
	userId: string;
	marketId: string;
	parentCommentId: string;
	side: "YES" | "NO";
	stake: string;
	createdAt: Date;
	/**
	 * FF-1 / ADR-0058 — the declared stance. OPTIONAL and defaulting to `false`
	 * so every pre-existing fixture above keeps the shape it had; only the
	 * friendly-fire describe below states it.
	 */
	friendlyFire?: boolean;
}): Promise<string> {
	const [reply] = await testDb
		.insert(comments)
		.values({
			userId: args.userId,
			marketId: args.marketId,
			body: "reply body",
			sideAtPostTime: args.side,
			parentCommentId: args.parentCommentId,
			friendlyFire: args.friendlyFire ?? false,
			betId: null,
			createdAt: args.createdAt,
		})
		.returning({ id: comments.id });
	const replyId = reply?.id ?? "";
	await testDb.insert(bets).values({
		userId: args.userId,
		marketId: args.marketId,
		side: args.side,
		stake: args.stake,
		shareQuantity: "0",
		priceAtBet: "0.5",
		commentId: replyId,
		createdAt: args.createdAt,
	});
	return replyId;
}

/**
 * A counting Proxy over `testDb` that increments `count.execute` on every
 * `.execute` property access (the loader uses `client.execute(sql\`...\`)`,
 * mirroring `loadRankingSubstrate`). Lets the test assert EXACTLY ONE DB
 * round-trip regardless of post/reply count — the no-N+1 guard. Adapted from
 * the `countingClient` in marker.test.ts (which counts `.select` instead).
 */
function countingClient(count: { execute: number }): typeof testDb {
	return new Proxy(testDb, {
		get(target, prop, receiver) {
			if (prop === "execute") {
				count.execute += 1;
			}
			const value = Reflect.get(target, prop, receiver);
			return typeof value === "function" ? value.bind(target) : value;
		},
	}) as typeof testDb;
}

describe("DEBATE.4 §5a — loadReplySubstrate (per-parent reply grouping)", () => {
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

	it("groups replies under each parent; stake via reply-bet; side = frozen side", async () => {
		const marketId = await seedMarket("reply-grouping-market");
		const u = await seedUser("reply-grp");

		const postA = await seedPost({
			userId: u,
			marketId,
			side: "YES",
			createdAt: new Date("2026-09-15T00:00:01Z"),
		});
		const postB = await seedPost({
			userId: u,
			marketId,
			side: "NO",
			createdAt: new Date("2026-09-15T00:00:02Z"),
		});

		// postA: one Support (YES) reply stake 300, one Counter (NO) reply stake 70.
		const a1 = await seedReplyWithBet({
			userId: u,
			marketId,
			parentCommentId: postA,
			side: "YES",
			stake: "300.000000000000000000",
			createdAt: new Date("2026-09-15T01:00:00Z"),
		});
		const a2 = await seedReplyWithBet({
			userId: u,
			marketId,
			parentCommentId: postA,
			side: "NO",
			stake: "70.000000000000000000",
			createdAt: new Date("2026-09-15T01:00:01Z"),
		});
		// postB: one reply stake 42.
		const b1 = await seedReplyWithBet({
			userId: u,
			marketId,
			parentCommentId: postB,
			side: "NO",
			stake: "42.000000000000000000",
			createdAt: new Date("2026-09-15T01:00:02Z"),
		});

		const map = await loadReplySubstrate(testDb, { marketId });

		// (1) per-parent grouping — postA has its two replies, postB has its one.
		const aReplies = map.get(postA) ?? [];
		const bReplies = map.get(postB) ?? [];
		expect(new Set(aReplies.map((r) => r.id))).toEqual(new Set([a1, a2]));
		expect(bReplies.map((r) => r.id)).toEqual([b1]);

		// (2) stake = the reply-bet's bets.stake (via bets.comment_id); side =
		// the reply's frozen side_at_post_time. Decimal posture: stake is a string.
		const a1Sub = aReplies.find((r) => r.id === a1);
		const a2Sub = aReplies.find((r) => r.id === a2);
		expect(a1Sub?.stake).toBe("300.000000000000000000");
		expect(a1Sub?.side).toBe("YES");
		expect(a2Sub?.stake).toBe("70.000000000000000000");
		expect(a2Sub?.side).toBe("NO");
		expect(bReplies[0]?.stake).toBe("42.000000000000000000");
		expect(bReplies[0]?.side).toBe("NO");
		// createdAt is a Date the ranking model can compare.
		expect(a1Sub?.createdAt).toBeInstanceOf(Date);
	});

	it("a post with NO replies is ABSENT from the map (consumer does map.get(id) ?? [])", async () => {
		const marketId = await seedMarket("no-replies-market");
		const u = await seedUser("noreply");

		const lonelyPost = await seedPost({
			userId: u,
			marketId,
			side: "YES",
			createdAt: new Date("2026-09-15T00:00:01Z"),
		});

		const map = await loadReplySubstrate(testDb, { marketId });

		// No replies → no key. The consumer falls back to [] via `?? []`.
		expect(map.has(lonelyPost)).toBe(false);
		expect(map.get(lonelyPost) ?? []).toEqual([]);
	});

	it("issues EXACTLY ONE DB round-trip regardless of post/reply count (no N+1)", async () => {
		const marketId = await seedMarket("no-n1-market");
		const u = await seedUser("no-n1");

		// Three posts, several replies each — a per-post query would be O(posts).
		for (let p = 0; p < 3; p++) {
			const post = await seedPost({
				userId: u,
				marketId,
				side: "YES",
				createdAt: new Date(`2026-09-15T00:0${p}:00Z`),
			});
			for (let r = 0; r < 2; r++) {
				await seedReplyWithBet({
					userId: u,
					marketId,
					parentCommentId: post,
					side: r === 0 ? "YES" : "NO",
					stake: "10.000000000000000000",
					createdAt: new Date(`2026-09-15T0${p + 1}:0${r}:00Z`),
				});
			}
		}

		const count = { execute: 0 };
		const map = await loadReplySubstrate(countingClient(count), { marketId });

		// One set-based query for the whole market (the §5a LATERAL contract).
		expect(count.execute).toBe(1);
		// Sanity: three parents grouped, two replies each.
		expect(map.size).toBe(3);
		for (const replies of map.values()) {
			expect(replies.length).toBe(2);
		}
	});
});

// FF-1 · G9 (loader half) — `ReplySubstrate.friendlyFire`, ADR-0058 A-6.
//
// The stance is a property of the REPLY ROW, not of the side it sits on, and
// this loader is the only path by which it reaches the reply tag. The
// engine-driven arithmetic for the aggregates lives beside this file in
// `friendly-fire-substrate.integration.test.ts`; what is asserted here is the
// narrower claim this loader owns — that the column travels, per row, in the
// partition the lane already builds.
//
// ⛔ REJECTS the plausible shortcut: deriving the stance at read time from
// `side === parentSide`. Every reply below is on the SAME side as its parent,
// so a derivation would report the same value for all four and would still
// satisfy a test written only over a flagged/unflagged pair on opposite sides.
//
// Direct-seeded, matching this file's stated posture (the loader is a pure
// read). RED today: `loadReplySubstrate` selects no `rc.friendly_fire` and the
// DTO carries no such key.
describe("FF-1 G9 — loadReplySubstrate carries the declared stance", () => {
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

	it("reply-substrate::friendly-fire-travels-per-row", async () => {
		const marketId = await seedMarket("ff-reply-flag-market");
		const author = await seedUser("ff-reply-author");
		const other = await seedUser("ff-reply-other");

		const post = await seedPost({
			userId: author,
			marketId,
			side: "YES",
			createdAt: new Date("2026-09-15T00:00:01Z"),
		});

		// FOUR replies, ALL on the parent's own side — so side carries no
		// information about the stance and only the column can.
		const plain = await seedReplyWithBet({
			userId: other,
			marketId,
			parentCommentId: post,
			side: "YES",
			stake: "50.000000000000000000",
			createdAt: new Date("2026-09-15T01:00:00Z"),
			friendlyFire: false,
		});
		const flagged = await seedReplyWithBet({
			userId: other,
			marketId,
			parentCommentId: post,
			side: "YES",
			stake: "50.000000000000000000",
			createdAt: new Date("2026-09-15T01:00:01Z"),
			friendlyFire: true,
		});
		// The author's own flagged reply — excluded from every aggregate and from
		// NOTHING here: the lane does not filter self-replies (ADR-0039 P2's other
		// half, which the substrate-site parity test asserts textually).
		const selfFlagged = await seedReplyWithBet({
			userId: author,
			marketId,
			parentCommentId: post,
			side: "YES",
			stake: "50.000000000000000000",
			createdAt: new Date("2026-09-15T01:00:02Z"),
			friendlyFire: true,
		});
		// …and one that leaves the flag unstated, so `false` is asserted against
		// the column DEFAULT as well as against an explicit write.
		const defaulted = await seedReplyWithBet({
			userId: other,
			marketId,
			parentCommentId: post,
			side: "YES",
			stake: "50.000000000000000000",
			createdAt: new Date("2026-09-15T01:00:03Z"),
		});

		const map = await loadReplySubstrate(testDb, { marketId });
		const replies = map.get(post) ?? [];
		expect(replies.length).toBe(4);
		const flagOf = (id: string) =>
			replies.find((r) => r.id === id)?.friendlyFire;

		expect(flagOf(flagged)).toBe(true);
		expect(flagOf(selfFlagged)).toBe(true);
		// ⚠ `false`, never `undefined`. A loader that dropped the key gives
		// `undefined` here, which renders as "no tag" and so LOOKS correct on the
		// surface while being unrepresentable in the export and the dataset.
		expect(flagOf(plain)).toBe(false);
		expect(flagOf(defaulted)).toBe(false);
	});
});
