import { afterEach, describe, expect, it } from "vitest";
import { bets, comments, markets, modActions, pools, users } from "@/db/schema";
import { loadDebateView } from "@/server/debate-view/load-debate-view";
// UI.A2 §9 slice 4 tests-first (plan §3.4 / §6 / §7 resolver-integration row)
// — the deep-link `?post=<N>` ordinal resolver against real Postgres.
// GREENFIELD module: `@/server/debate-view/resolve-post-param` is not built
// until the writer lands it → this file is RED at COLLECTION (module not
// found); the `DebatePost.ordinal` assertions in the round-trip scenario are
// assertion-RED behind it (today's DebatePost carries no `ordinal` field —
// the ratified OQ-5c additive field, SG-3).
//
// Semantics under test (ratified OQ-4, ADR-0016 D6 "natural ordering"): N is
// the market's 1-based TOP-LEVEL post ordinal — rank by (created_at, id)
// ascending over comments with `parent_comment_id IS NULL`. Removed posts
// stay IN the domain (append-only ⇒ ordinals permanent; the removed-target
// fallback is the PAGE layer's job, not the resolver's). Replies are NEVER in
// the domain. Out-of-range → null.
//
// Fixtures bypass the app layer (SPEC.2 §6.6). Scenarios 1–6 seed BARE
// comments (no bets) deliberately: the resolver's domain is the `comments`
// table alone, and a bare comment is storage-legal (`comments.bet_id` is
// deliberately nullable — AGENTS.md "Deliberate schema choices"). The
// round-trip scenario seeds full comment+bet nodes because
// `loadRankingSubstrate` INNER-JOINs each post's entry bet (a post without
// its bet never reaches the view model).
//
// DB-backed (local Postgres :54322). TRUNCATE in afterEach.
import { resolvePostParam } from "@/server/debate-view/resolve-post-param";
import type { MarketSummary } from "@/server/markets/get-by-slug";

import { testClient, testDb } from "../db/_fixtures/db";
import { truncateTables } from "../db/_fixtures/truncate";

const DEADLINE = new Date("2027-01-01T00:00:00.000Z");
const POOL_SEED = "100.000000000000000000";

/** Deterministic timeline: BASE + n seconds — every seed's explicit createdAt. */
const BASE_MS = Date.parse("2026-06-01T10:00:00.000Z");
const ts = (offsetSeconds: number): Date =>
	new Date(BASE_MS + offsetSeconds * 1000);

async function seedUser(tag: string): Promise<string> {
	const [u] = await testDb
		.insert(users)
		.values({
			name: "Post Param User",
			email: `${tag.toLowerCase()}@example.com`,
			pseudonym: tag,
		})
		.returning({ id: users.id });
	return u?.id ?? "";
}

async function seedMarket(slug: string): Promise<MarketSummary> {
	const [m] = await testDb
		.insert(markets)
		.values({
			slug,
			title: "Will the deep-link ordinal survive the freeze?",
			description: "Resolves YES if ?post=N round-trips forever.",
			status: "Open",
			resolutionDeadline: DEADLINE,
		})
		.returning({
			id: markets.id,
			slug: markets.slug,
			title: markets.title,
			description: markets.description,
			status: markets.status,
		});
	return m as MarketSummary;
}

/** Direct-seed a BARE comment — the resolver's domain is `comments` alone. */
async function seedComment(args: {
	userId: string;
	marketId: string;
	parentCommentId: string | null;
	side: "YES" | "NO";
	body: string;
	createdAt: Date;
}): Promise<string> {
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
	return c?.id ?? "";
}

/**
 * Comment + its riding entry bet (reached via `bets.comment_id`, never
 * `comments.bet_id`) — the shape `loadDebateView`'s substrate requires.
 */
async function seedNode(args: {
	userId: string;
	marketId: string;
	parentCommentId: string | null;
	side: "YES" | "NO";
	body: string;
	createdAt: Date;
}): Promise<string> {
	const commentId = await seedComment(args);
	await testDb.insert(bets).values({
		userId: args.userId,
		marketId: args.marketId,
		side: args.side,
		stake: "10.000000000000000000",
		shareQuantity: "0",
		priceAtBet: "0.5",
		commentId,
		createdAt: args.createdAt,
	});
	return commentId;
}

/** Record a `content_removed` mod_action against a target comment. */
async function removeComment(commentId: string): Promise<void> {
	await testDb.insert(modActions).values({
		targetCommentId: commentId,
		reason: "content_removed",
		verdict: null,
		categories: {},
		actorId: "admin-singleton",
	});
}

const resolve = (marketId: string, post: string): Promise<string | null> =>
	resolvePostParam(testDb, { marketId, post });

afterEach(async () => {
	await truncateTables(testClient, [
		"mod_actions",
		"bets",
		"comments",
		"pools",
		"markets",
		"users",
	]);
});

describe("UI.A2 §3.4 — resolvePostParam ordinal resolution (deep-link ?post=)", () => {
	it("post-param::resolves-ordinals-in-created-order", async () => {
		const market = await seedMarket("post-param-order");
		const author = await seedUser("PostParamOrder1");

		const p1 = await seedComment({
			userId: author,
			marketId: market.id,
			parentCommentId: null,
			side: "YES",
			body: "Post one — earliest.",
			createdAt: ts(0),
		});
		// Reply interleaved BETWEEN p1 and p2 by createdAt — never in the domain.
		const reply = await seedComment({
			userId: author,
			marketId: market.id,
			parentCommentId: p1,
			side: "NO",
			body: "Reply under post one.",
			createdAt: ts(30),
		});
		const p2 = await seedComment({
			userId: author,
			marketId: market.id,
			parentCommentId: null,
			side: "NO",
			body: "Post two.",
			createdAt: ts(60),
		});
		const p3 = await seedComment({
			userId: author,
			marketId: market.id,
			parentCommentId: null,
			side: "YES",
			body: "Post three — latest.",
			createdAt: ts(120),
		});

		const resolved = [
			await resolve(market.id, "1"),
			await resolve(market.id, "2"),
			await resolve(market.id, "3"),
		];
		expect(resolved).toEqual([p1, p2, p3]);
		// The reply's id is NEVER a resolution result.
		expect(resolved).not.toContain(reply);
	});

	it("post-param::out-of-range-null", async () => {
		const market = await seedMarket("post-param-range");
		const author = await seedUser("PostParamRange1");
		for (const [n, body] of [
			[0, "Range post one."],
			[60, "Range post two."],
			[120, "Range post three."],
		] as const) {
			await seedComment({
				userId: author,
				marketId: market.id,
				parentCommentId: null,
				side: "YES",
				body,
				createdAt: ts(n),
			});
		}

		// One past the end of a 3-post market → null (plan §6).
		expect(await resolve(market.id, "4")).toBeNull();

		// "1" on a ZERO-post market → null (plan §6: `?post=1` on empty market).
		const empty = await seedMarket("post-param-empty");
		expect(await resolve(empty.id, "1")).toBeNull();
	});

	it("post-param::created-at-tie-breaks-by-id", async () => {
		const market = await seedMarket("post-param-tie");
		const author = await seedUser("PostParamTie1");

		// IDENTICAL createdAt — the (created_at, id) total order falls to id.
		const tieAt = ts(0);
		const a = await seedComment({
			userId: author,
			marketId: market.id,
			parentCommentId: null,
			side: "YES",
			body: "Tie post A.",
			createdAt: tieAt,
		});
		const b = await seedComment({
			userId: author,
			marketId: market.id,
			parentCommentId: null,
			side: "NO",
			body: "Tie post B.",
			createdAt: tieAt,
		});

		// Postgres compares uuid bytewise; the canonical lowercase-hex text form
		// is lexicographically byte-order-isomorphic, so JS default string sort
		// predicts the DB's id-ascending tiebreak.
		const [first, second] = [a, b].sort();
		expect(await resolve(market.id, "1")).toBe(first);
		expect(await resolve(market.id, "2")).toBe(second);
	});

	it("post-param::ordinal-stability-under-append", async () => {
		const market = await seedMarket("post-param-append");
		const author = await seedUser("PostParamAppend1");
		const seedPost = (body: string, at: Date): Promise<string> =>
			seedComment({
				userId: author,
				marketId: market.id,
				parentCommentId: null,
				side: "YES",
				body,
				createdAt: at,
			});

		const p1 = await seedPost("Append post one.", ts(0));
		const p2 = await seedPost("Append post two.", ts(60));
		const p3 = await seedPost("Append post three.", ts(120));

		expect(await resolve(market.id, "1")).toBe(p1);
		expect(await resolve(market.id, "2")).toBe(p2);
		expect(await resolve(market.id, "3")).toBe(p3);
		expect(await resolve(market.id, "4")).toBeNull();

		// Append a 4th post — ordinals 1..3 are PERMANENT (append-only ⇒ an
		// ordinal, once minted, never re-points; new posts only extend the domain).
		const p4 = await seedPost("Append post four — new.", ts(180));

		expect(await resolve(market.id, "1")).toBe(p1);
		expect(await resolve(market.id, "2")).toBe(p2);
		expect(await resolve(market.id, "3")).toBe(p3);
		expect(await resolve(market.id, "4")).toBe(p4);
	});

	it("post-param::removed-post-keeps-its-slot", async () => {
		const market = await seedMarket("post-param-removed");
		const author = await seedUser("PostParamRemoved1");
		const seedPost = (body: string, at: Date): Promise<string> =>
			seedComment({
				userId: author,
				marketId: market.id,
				parentCommentId: null,
				side: "NO",
				body,
				createdAt: at,
			});

		const p1 = await seedPost("Removed-scenario post one.", ts(0));
		const p2 = await seedPost(
			"Removed-scenario post two — gets removed.",
			ts(60),
		);
		const p3 = await seedPost("Removed-scenario post three.", ts(120));

		await removeComment(p2);

		// Removed posts stay IN the domain: "2" STILL resolves to post 2's id
		// (the removed-target fallback is the page layer's, not the resolver's),
		// and "3" is NOT renumbered.
		expect(await resolve(market.id, "1")).toBe(p1);
		expect(await resolve(market.id, "2")).toBe(p2);
		expect(await resolve(market.id, "3")).toBe(p3);
	});

	it("post-param::reply-excluded-from-domain", async () => {
		const market = await seedMarket("post-param-replies");
		const author = await seedUser("PostParamReplies1");

		// 3 posts + 2 replies interleaved by createdAt: p1, r1, p2, r2, p3.
		const p1 = await seedComment({
			userId: author,
			marketId: market.id,
			parentCommentId: null,
			side: "YES",
			body: "Interleave post one.",
			createdAt: ts(0),
		});
		await seedComment({
			userId: author,
			marketId: market.id,
			parentCommentId: p1,
			side: "NO",
			body: "Interleave reply one.",
			createdAt: ts(30),
		});
		const p2 = await seedComment({
			userId: author,
			marketId: market.id,
			parentCommentId: null,
			side: "NO",
			body: "Interleave post two.",
			createdAt: ts(60),
		});
		await seedComment({
			userId: author,
			marketId: market.id,
			parentCommentId: p2,
			side: "YES",
			body: "Interleave reply two.",
			createdAt: ts(90),
		});
		const p3 = await seedComment({
			userId: author,
			marketId: market.id,
			parentCommentId: null,
			side: "YES",
			body: "Interleave post three.",
			createdAt: ts(120),
		});

		// Ordinals count ONLY top-level posts — replies never shift the rank.
		expect(await resolve(market.id, "1")).toBe(p1);
		expect(await resolve(market.id, "2")).toBe(p2);
		expect(await resolve(market.id, "3")).toBe(p3);
		// Domain size is 3 (posts), not 5 (comments).
		expect(await resolve(market.id, "4")).toBeNull();
		expect(await resolve(market.id, "5")).toBeNull();
	});

	it("post-param::round-trip-with-view-ordinal", async () => {
		const market = await seedMarket("post-param-roundtrip");
		await testDb.insert(pools).values({
			marketId: market.id,
			yesReserves: POOL_SEED,
			noReserves: POOL_SEED,
		});
		const author = await seedUser("PostParamRound1");
		const replier = await seedUser("PostParamRound2");

		// Full nodes (comment + entry bet) — the view-model substrate shape.
		const p1 = await seedNode({
			userId: author,
			marketId: market.id,
			parentCommentId: null,
			side: "YES",
			body: "Round-trip post one.",
			createdAt: ts(0),
		});
		const p2 = await seedNode({
			userId: author,
			marketId: market.id,
			parentCommentId: null,
			side: "NO",
			body: "Round-trip post two — gets removed.",
			createdAt: ts(60),
		});
		const p3 = await seedNode({
			userId: author,
			marketId: market.id,
			parentCommentId: null,
			side: "YES",
			body: "Round-trip post three.",
			createdAt: ts(120),
		});
		// A reply node must not perturb the post ordinal domain.
		await seedNode({
			userId: replier,
			marketId: market.id,
			parentCommentId: p1,
			side: "NO",
			body: "Round-trip reply under post one.",
			createdAt: ts(30),
		});
		await removeComment(p2);

		const model = await loadDebateView(testDb, { market });
		expect(model.posts).toHaveLength(3);

		// `ordinal` (OQ-5c, additive on BOTH union variants — SG-3) carries the
		// same (created_at, id)-ascending rank the resolver serves, removed
		// posts included.
		const expectedOrdinalById = new Map<string, number>([
			[p1, 1],
			[p2, 2],
			[p3, 3],
		]);
		for (const post of model.posts) {
			expect(typeof post.ordinal).toBe("number");
			expect(post.ordinal).toBe(expectedOrdinalById.get(post.id));
		}

		// The REMOVED variant carries the field too (the plan pins BOTH variants).
		const removedPost = model.posts.find((p) => p.removed);
		if (!removedPost) {
			throw new Error("expected the removed post variant in the view model");
		}
		expect(removedPost.id).toBe(p2);
		expect(removedPost.ordinal).toBe(2);

		// Ordinals over the model are exactly the set 1..N.
		const ordinals = model.posts.map((p) => p.ordinal).sort((x, y) => x - y);
		expect(ordinals).toEqual([1, 2, 3]);

		// THE consistency pin: every rendered ordinal resolves back to its post —
		// the minted URL (`?post=N` via replaceState) and the server resolver can
		// never disagree.
		for (const post of model.posts) {
			expect(await resolve(market.id, String(post.ordinal))).toBe(post.id);
		}
	});
});
