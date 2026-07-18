import { afterEach, describe, expect, it, vi } from "vitest";

// UI.A4 Slice 3 tests-first (plan §2 row 3 / §3 / §11) — the RED driver for
// `selectHeroTopPosts`, the SAFETY-CRITICAL hero read-model (SPEC.1 §22
// F-DISC-2, mirroring §9 F-DEBATE-1): per side, the FIRST post in the §9 Top
// order whose id is NOT in the `content_removed` set; Track-B-hidden content
// must NEVER surface to public/non-admin viewers.
//
// RED target: `@/server/discovery/hero` does NOT exist yet — this file fails
// at COLLECTION on that unresolvable import until Slice 3's implement phase
// lands the selector (+ the OQ-3 B extraction of `loadRemovedSet` /
// `deriveTitleTeaser` from load-debate-view.ts).
//
// The five it() names are the SPEC.1 §17-registry `discovery::*` F-DISC-2
// rows VERBATIM (3 registry rows) plus the two plan-kept extras (plan §11
// F-3): `next-eligible-when-top-removed`, `side-empty-when-none-eligible`.
// No extra blocks.
//
// Contract pins (plan §3 + kickoff):
// - The hero pick rides the PURE `topOrder` (§9 Top) — NOT `buildTopList`:
//   the ADR-0017 P2 latest-interleave is display cadence and must not
//   influence the pick. The authoritative expected pick is derived IN-TEST
//   via `topOrder(await loadRankingSubstrate(...))` filtered per side.
// - Masking keys ONLY on `mod_actions.reason = 'content_removed'`;
//   `user_banned` does NOT mask (ban removes voice, not past content —
//   ADR-0021 §4). The ban-arm row here deliberately TARGETS B's comment so a
//   reason-blind masker would wrongly hide B.
// - Body/author resolve ONLY for the ≤2 picked posts — a removed post's
//   argument/author can never serialize into the DTO. The testable half is
//   the `JSON.stringify` never-echo sweep (marker string + pseudonym absent
//   anywhere in the serialized result); the never-READ half is the
//   @security-auditor's implementation-review concern.
// - `ordinal` = the 1-based (created_at, id)-ASC rank over ALL the market's
//   top-level comments, REMOVED INCLUDED (append-only ⇒ permanent — the
//   UI.A2 `?post=N` deep-link congruence, OQ-4 A).
// - title/teaser = `deriveTitleTeaser(body)`: first line ≤125 chars / second
//   paragraph trimmed ("" if none).
//
// Each post/reply rides a `bets` row — `bets.comment_id` is the populated FK
// direction; `comments.bet_id` stays NULL (SPEC.2 §14.1). Reply-bets on the
// parent's side are Support Dharma (read-time relation). DB-backed (local
// Postgres :54322). TRUNCATE in afterEach. Money crosses as a STRING
// end-to-end (CLAUDE.md §2). R2 + Sentry are mocked at the module boundary
// because test 5 imports `@/server/discovery/list` → media.ts →
// `@/server/storage/r2` (the list.test.ts precedent).

vi.mock("@sentry/nextjs", () => ({
	captureMessage: vi.fn(),
	addBreadcrumb: vi.fn(),
	captureException: vi.fn(),
}));

vi.mock("@/server/storage/r2", () => ({
	mintReadUrl: vi.fn(
		async (bucket: string, key: string, ttlSeconds: number) =>
			`https://signed.test/${bucket}/${key}?ttl=${ttlSeconds}`,
	),
}));

import { bets, comments, markets, modActions, pools, users } from "@/db/schema";
import { buildTopList, topOrder } from "@/lib/ranking";
import { loadRankingSubstrate } from "@/server/debate-view/ranking-substrate";
// RED import: the greenfield Slice-3 selector under test (fails collection).
import { selectHeroTopPosts } from "@/server/discovery/hero";
import { listOpenMarkets } from "@/server/discovery/list";

import { testClient, testDb } from "../../db/_fixtures/db";
import { truncateTables } from "../../db/_fixtures/truncate";

const POOL_SEED = "100.000000000000000000";

/** Deterministic distinct timestamps — i seconds past a fixed UTC base. */
function at(i: number): Date {
	return new Date(Date.UTC(2026, 8, 15, 0, 0, i));
}

async function seedUser(tag: string): Promise<string> {
	const [user] = await testDb
		.insert(users)
		.values({
			name: "Hero User",
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
			title: "Hero Market",
			status: "Open",
			resolutionDeadline: new Date("2026-11-01T00:00:00Z"),
		})
		.returning({ id: markets.id });
	return market?.id ?? "";
}

async function seedPool(marketId: string): Promise<void> {
	await testDb
		.insert(pools)
		.values({ marketId, yesReserves: POOL_SEED, noReserves: POOL_SEED });
}

/** Direct-seed a post/reply + its riding bet (the stake/aggregate source). */
async function seedCommentWithBet(args: {
	userId: string;
	marketId: string;
	side: "YES" | "NO";
	stake: string;
	body: string;
	parentCommentId: string | null;
	createdAt: Date;
}): Promise<string> {
	const [c] = await testDb
		.insert(comments)
		.values({
			userId: args.userId,
			marketId: args.marketId,
			body: args.body,
			sideAtPostTime: args.side,
			parentCommentId: args.parentCommentId,
			betId: null,
			createdAt: args.createdAt,
		})
		.returning({ id: comments.id });
	const commentId = c?.id ?? "";
	await testDb.insert(bets).values({
		userId: args.userId,
		marketId: args.marketId,
		side: args.side,
		stake: args.stake,
		shareQuantity: "0",
		priceAtBet: "0.5",
		commentId,
		createdAt: args.createdAt,
	});
	return commentId;
}

/**
 * Seed `count` Support reply-bets (reply side = parent side) of Đ50 each on a
 * post — the dominance source: 5 replies clear BOTH the traction floor (n ≥ 5)
 * and the stake floor (D = 250 ≥ 200) of the default ranking config, so the
 * parent is a real §9 Top floor-clearer, not a created_at accident.
 */
async function seedSupportReplies(args: {
	userId: string;
	marketId: string;
	parentCommentId: string;
	side: "YES" | "NO";
	count: number;
	firstAt: number;
}): Promise<void> {
	for (let i = 0; i < args.count; i++) {
		await seedCommentWithBet({
			userId: args.userId,
			marketId: args.marketId,
			side: args.side,
			stake: "50.000000000000000000",
			body: `support reply ${i + 1}`,
			parentCommentId: args.parentCommentId,
			createdAt: at(args.firstAt + i),
		});
	}
}

/** Record a `content_removed` mod_action against a target comment (the
 * Track-B-hidden masking input — the load-debate-view fixture precedent). */
async function removeComment(commentId: string): Promise<void> {
	await testDb.insert(modActions).values({
		targetCommentId: commentId,
		reason: "content_removed",
		verdict: null,
		categories: {},
		actorId: "admin-singleton",
	});
}

/** Narrow a nullable hero side — throws (fails the test) when null. */
function requirePost<T>(post: T | null): T {
	if (post === null) {
		throw new Error("expected a hero post on this side, got null");
	}
	return post;
}

describe("UI.A4 §22 — discovery hero top-posts + Track-B masking (F-DISC-2)", () => {
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
			"market_media",
			"markets",
			"mod_actions",
			"users",
		]);
		vi.clearAllMocks();
	});

	it("hero-top-post-per-side-by-top-ranking", async () => {
		const marketId = await seedMarket("hero-top-per-side");
		const yesAuthor = await seedUser("hero-yes-author");
		const noAuthor = await seedUser("hero-no-author");
		const bystander = await seedUser("hero-bystander");
		const replier = await seedUser("hero-replier");

		// Bodies with a title line + blank line + teaser paragraph so the
		// deriveTitleTeaser pins are non-trivial: the YES teaser carries
		// padding (trimmed away); the NO title line overflows the 125-char
		// clamp (sliced).
		const yesTitle = "Hero YES title line — the dominant YES argument";
		const yesTeaser =
			"Hero YES teaser paragraph — the second paragraph rides the hero card.";
		const yesBody = `${yesTitle}\n\n   ${yesTeaser}   \n\nHero YES third paragraph — full body only, never the teaser.`;
		const noTitleLine = `NO hero title line padded past the 125-char clamp ${"x".repeat(90)}`;
		const noTeaser = "NO hero teaser paragraph — trimmed second paragraph.";
		const noBody = `${noTitleLine}\n\n${noTeaser}`;
		expect(noTitleLine.length).toBeGreaterThan(125);

		// Six top-level posts, distinct created_at, sides interleaved. The
		// dominant post on each side is NEITHER the first-created NOR the
		// newest on its side (defeats a lazy created_at pick): per side the
		// order is [sibling, DOMINANT, sibling].
		const yesFirst = await seedCommentWithBet({
			userId: bystander,
			marketId,
			side: "YES",
			stake: "10.000000000000000000",
			body: "YES sibling one — zero activity.",
			parentCommentId: null,
			createdAt: at(1),
		});
		const noFirst = await seedCommentWithBet({
			userId: bystander,
			marketId,
			side: "NO",
			stake: "10.000000000000000000",
			body: "NO sibling one — zero activity.",
			parentCommentId: null,
			createdAt: at(2),
		});
		const yesTop = await seedCommentWithBet({
			userId: yesAuthor,
			marketId,
			side: "YES",
			stake: "40.000000000000000000",
			body: yesBody,
			parentCommentId: null,
			createdAt: at(3),
		});
		const noTop = await seedCommentWithBet({
			userId: noAuthor,
			marketId,
			side: "NO",
			stake: "35.000000000000000000",
			body: noBody,
			parentCommentId: null,
			createdAt: at(4),
		});
		const yesNewest = await seedCommentWithBet({
			userId: bystander,
			marketId,
			side: "YES",
			stake: "12.000000000000000000",
			body: "YES sibling two — zero activity, newest on side.",
			parentCommentId: null,
			createdAt: at(5),
		});
		const noNewest = await seedCommentWithBet({
			userId: bystander,
			marketId,
			side: "NO",
			stake: "12.000000000000000000",
			body: "NO sibling two — zero activity, newest on side.",
			parentCommentId: null,
			createdAt: at(6),
		});

		// Dominance under the REAL scoring: yesTop clears traction (n=6),
		// stake (D=300), and the gated dominance-split lane (n ≥ floorSplit);
		// noTop clears traction (n=5) + stake (D=250). Siblings are
		// zero-activity → below every floor.
		await seedSupportReplies({
			userId: replier,
			marketId,
			parentCommentId: yesTop,
			side: "YES",
			count: 6,
			firstAt: 10,
		});
		await seedSupportReplies({
			userId: replier,
			marketId,
			parentCommentId: noTop,
			side: "NO",
			count: 5,
			firstAt: 20,
		});

		// The AUTHORITATIVE expected picks — the pure §9 Top order over the
		// live substrate, filtered per side (the F-DISC-2 normative rule).
		const ranked = topOrder(await loadRankingSubstrate(testDb, { marketId }));
		const yesOrder = ranked
			.filter((p) => p.parentSide === "YES")
			.map((p) => p.id);
		const noOrder = ranked
			.filter((p) => p.parentSide === "NO")
			.map((p) => p.id);
		// Fixture sanity: the designed dominants ARE the §9 picks (siblings
		// fall to the §3.4 tiebreak — higher author stake first).
		expect(yesOrder).toEqual([yesTop, yesNewest, yesFirst]);
		expect(noOrder).toEqual([noTop, noNewest, noFirst]);

		const hero = await selectHeroTopPosts(testDb, marketId);
		const yes = requirePost(hero.yes);
		const no = requirePost(hero.no);

		// The pick per side = the first post in Top order on that side.
		expect(yes.id).toBe(yesOrder[0]);
		expect(no.id).toBe(noOrder[0]);
		expect(yes.side).toBe("YES");
		expect(no.side).toBe("NO");

		// deriveTitleTeaser pins: title = first line ≤125 chars (the NO line
		// is sliced); teaser = second paragraph, trimmed (the YES padding is
		// stripped).
		expect(yes.title).toBe(yesTitle);
		expect(yes.teaser).toBe(yesTeaser);
		expect(no.title).toBe(noTitleLine.slice(0, 125));
		expect(no.teaser).toBe(noTeaser);

		// Author identity + the post's own entry-bet stake (18-dp string).
		expect(yes.author.pseudonym).toBe("hero-yes-author");
		expect(no.author.pseudonym).toBe("hero-no-author");
		expect(yes.authorStake).toBe("40.000000000000000000");
		expect(no.authorStake).toBe("35.000000000000000000");

		// Deep-link ordinal: 1-based (created_at, id)-ASC rank over ALL the
		// market's top-level comments (replies never count) — yesTop is the
		// 3rd top-level comment, noTop the 4th.
		expect(yes.ordinal).toBe(3);
		expect(no.ordinal).toBe(4);

		// createdAt = the comment's timestamp, ISO.
		expect(yes.createdAt).toBe(at(3).toISOString());
		expect(no.createdAt).toBe(at(4).toISOString());

		// ── Folded (code-review MEDIUM): the topOrder-vs-buildTopList
		// regression pin. Below the P2 interleave interval the two orders
		// coincide, so a fixture ≥ interval+1 posts is needed to DISCRIMINATE:
		// 10 dominant-tiebreak NO posts fill the first ranked cadence, so
		// buildTopList's next slot is the RECENCY injection — the newest post
		// (a weak YES) — while the §9 Top order still puts the stronger YES
		// first. The hero must follow topOrder (F-DISC-2 normative rule), so
		// a "simplification" of hero.ts to buildTopList fails here loudly.
		const market2 = await seedMarket("hero-interleave-discriminant");
		const divAuthor = await seedUser("hero-div-author");
		// 10 NO posts, stakes descending 30…21 → tiebreak ranks them 0-9.
		for (let i = 0; i < 10; i++) {
			await seedCommentWithBet({
				userId: divAuthor,
				marketId: market2,
				side: "NO",
				stake: `${30 - i}.000000000000000000`,
				body: `NO filler ${i} — tiebreak rank ${i}.`,
				parentCommentId: null,
				createdAt: at(30 + i),
			});
		}
		// The YES top by rank (stake 20 > 10) — created BEFORE the newest.
		const divYesTop = await seedCommentWithBet({
			userId: divAuthor,
			marketId: market2,
			side: "YES",
			stake: "20.000000000000000000",
			body: "YES stronger — the §9 Top pick.",
			parentCommentId: null,
			createdAt: at(41),
		});
		// The NEWEST post overall — a weaker YES the interleave injects early.
		const divYesNewest = await seedCommentWithBet({
			userId: divAuthor,
			marketId: market2,
			side: "YES",
			stake: "10.000000000000000000",
			body: "YES newest — the recency injection, NOT the Top pick.",
			parentCommentId: null,
			createdAt: at(42),
		});

		const substrate2 = await loadRankingSubstrate(testDb, {
			marketId: market2,
		});
		const rankedFirstYes = topOrder(substrate2).find(
			(p) => p.parentSide === "YES",
		)?.id;
		const builtFirstYes = buildTopList(substrate2).find(
			(p) => p.parentSide === "YES",
		)?.id;
		// THE DISCRIMINATING PREMISE — the two orders genuinely diverge on
		// this fixture (if a config change collapses them, fail loudly HERE,
		// not by silently passing the hero assert).
		expect(rankedFirstYes).toBe(divYesTop);
		expect(builtFirstYes).toBe(divYesNewest);

		const hero2 = await selectHeroTopPosts(testDb, market2);
		expect(requirePost(hero2.yes).id).toBe(divYesTop);
		expect(requirePost(hero2.yes).id).not.toBe(builtFirstYes);
	});

	it("hero-masks-track-b-hidden-from-public", async () => {
		const marketId = await seedMarket("hero-track-b-mask");
		// A DISTINCTIVE author pseudonym for the removed post (a second user)
		// + a DISTINCTIVE body marker, planted in BOTH the title line and the
		// teaser paragraph so ANY derivation surface leaking carries it.
		const maskedAuthor = await seedUser("masked-track-b-pseudonym");
		const visibleAuthor = await seedUser("hero-visible-author");
		const replier = await seedUser("hero-mask-replier");

		const maskedMarker = "TRACK-B-MASKED-MARKER-9f2c";
		const maskedBody = `${maskedMarker} removed YES title line\n\n${maskedMarker} removed YES teaser paragraph.`;

		const postA = await seedCommentWithBet({
			userId: maskedAuthor,
			marketId,
			side: "YES",
			stake: "60.000000000000000000",
			body: maskedBody,
			parentCommentId: null,
			createdAt: at(1),
		});
		const postB = await seedCommentWithBet({
			userId: visibleAuthor,
			marketId,
			side: "YES",
			stake: "20.000000000000000000",
			body: "Second YES argument — survives the ban arm.",
			parentCommentId: null,
			createdAt: at(2),
		});
		// 5 Support replies × Đ50 on A → A clears the traction + stake floors;
		// B is zero-activity.
		await seedSupportReplies({
			userId: replier,
			marketId,
			parentCommentId: postA,
			side: "YES",
			count: 5,
			firstAt: 10,
		});

		// Fixture sanity — THE DISCRIMINATING PREMISE: unmasked §9 Top ranks
		// A first, so a masking failure WOULD surface A.
		const ranked = topOrder(await loadRankingSubstrate(testDb, { marketId }));
		expect(
			ranked.filter((p) => p.parentSide === "YES").map((p) => p.id),
		).toEqual([postA, postB]);

		await removeComment(postA);

		const hero = await selectHeroTopPosts(testDb, marketId);
		const yes = requirePost(hero.yes);
		// The Track-B-hidden post is NOT eligible — the next eligible post on
		// the side surfaces (F-DISC-2 safety-critical rule).
		expect(yes.id).toBe(postB);
		expect(yes.author.pseudonym).toBe("hero-visible-author");
		// Removed-INCLUDED ordinal domain: A holds slot 1 forever
		// (append-only ⇒ permanent), so B's deep-link ordinal stays 2.
		expect(yes.ordinal).toBe(2);

		// THE NEVER-ECHO SWEEP: the removed post's argument (title line AND
		// teaser paragraph both carry the marker), its author's pseudonym,
		// its comment UUID, and its distinctive stake appear NOWHERE in the
		// serialized DTO (@security-auditor LOW fold: id + stake added; the
		// surviving pick's own stake pinned as B's, not A's).
		const json = JSON.stringify(hero);
		expect(json).not.toContain(maskedMarker);
		expect(json).not.toContain("masked-track-b-pseudonym");
		expect(json).not.toContain(postA);
		expect(json).not.toContain("60.000000000000000000");
		expect(yes.authorStake).toBe("20.000000000000000000");

		// A `user_banned` mod_action against B does NOT mask B — ban removes
		// voice, not past content (ADR-0021 §4). The row deliberately targets
		// B's COMMENT so a reason-blind masker would wrongly hide it; masking
		// keys on reason = 'content_removed' ONLY.
		await testDb.insert(modActions).values({
			targetCommentId: postB,
			targetUserId: visibleAuthor,
			reason: "user_banned",
			verdict: null,
			categories: {},
			actorId: "admin-singleton",
		});

		const heroAfterBan = await selectHeroTopPosts(testDb, marketId);
		const yesAfterBan = requirePost(heroAfterBan.yes);
		// B still returned, content intact (title derived from its body;
		// single-line body → "" teaser per the contract).
		expect(yesAfterBan.id).toBe(postB);
		expect(yesAfterBan.title).toBe(
			"Second YES argument — survives the ban arm.",
		);
		expect(yesAfterBan.teaser).toBe("");
		expect(yesAfterBan.author.pseudonym).toBe("hero-visible-author");
		// The sweep holds after the ban row too (id + stake included).
		const jsonAfterBan = JSON.stringify(heroAfterBan);
		expect(jsonAfterBan).not.toContain(maskedMarker);
		expect(jsonAfterBan).not.toContain("masked-track-b-pseudonym");
		expect(jsonAfterBan).not.toContain(postA);
		expect(jsonAfterBan).not.toContain("60.000000000000000000");
	});

	it("next-eligible-when-top-removed", async () => {
		const marketId = await seedMarket("hero-next-eligible");
		const author = await seedUser("hero-chain-author");
		const replier = await seedUser("hero-chain-replier");

		// Three YES posts in strictly decreasing §9 dominance: p1 (n=6,
		// D=300 + the gated split lane) > p2 (n=5, D=250) > p3 (zero
		// activity, below every floor).
		const p1 = await seedCommentWithBet({
			userId: author,
			marketId,
			side: "YES",
			stake: "50.000000000000000000",
			body: "Chain post one — top of the Top order.",
			parentCommentId: null,
			createdAt: at(1),
		});
		const p2 = await seedCommentWithBet({
			userId: author,
			marketId,
			side: "YES",
			stake: "40.000000000000000000",
			body: "Chain post two — second in Top order.",
			parentCommentId: null,
			createdAt: at(2),
		});
		const p3 = await seedCommentWithBet({
			userId: author,
			marketId,
			side: "YES",
			stake: "30.000000000000000000",
			body: "Chain post three — third in Top order.",
			parentCommentId: null,
			createdAt: at(3),
		});
		await seedSupportReplies({
			userId: replier,
			marketId,
			parentCommentId: p1,
			side: "YES",
			count: 6,
			firstAt: 10,
		});
		await seedSupportReplies({
			userId: replier,
			marketId,
			parentCommentId: p2,
			side: "YES",
			count: 5,
			firstAt: 20,
		});

		// The authoritative expected order via the in-test topOrder walk.
		const ranked = topOrder(await loadRankingSubstrate(testDb, { marketId }));
		const yesOrder = ranked
			.filter((p) => p.parentSide === "YES")
			.map((p) => p.id);
		expect(yesOrder).toEqual([p1, p2, p3]);

		// Baseline — nothing removed: the Top pick surfaces.
		const baseline = await selectHeroTopPosts(testDb, marketId);
		expect(requirePost(baseline.yes).id).toBe(yesOrder[0]);

		// Remove the Top pick → the SECOND-in-Top-order surfaces.
		await removeComment(p1);
		const afterFirst = await selectHeroTopPosts(testDb, marketId);
		const firstFallback = requirePost(afterFirst.yes);
		expect(firstFallback.id).toBe(yesOrder[1]);
		// Removed p1 keeps ordinal slot 1 (removed-INCLUDED domain).
		expect(firstFallback.ordinal).toBe(2);

		// Remove that too → the THIRD surfaces on the next call.
		await removeComment(p2);
		const afterSecond = await selectHeroTopPosts(testDb, marketId);
		const secondFallback = requirePost(afterSecond.yes);
		expect(secondFallback.id).toBe(yesOrder[2]);
		expect(secondFallback.ordinal).toBe(3);
	});

	it("side-empty-when-none-eligible", async () => {
		const marketId = await seedMarket("hero-yes-only");
		const author = await seedUser("hero-empty-author");

		const yesA = await seedCommentWithBet({
			userId: author,
			marketId,
			side: "YES",
			stake: "20.000000000000000000",
			body: "YES-only post A.",
			parentCommentId: null,
			createdAt: at(1),
		});
		const yesB = await seedCommentWithBet({
			userId: author,
			marketId,
			side: "YES",
			stake: "10.000000000000000000",
			body: "YES-only post B.",
			parentCommentId: null,
			createdAt: at(2),
		});

		// YES posts only → no side has no eligible post: null, never a
		// placeholder object; yes side non-null (the derived Top pick).
		const ranked = topOrder(await loadRankingSubstrate(testDb, { marketId }));
		expect(
			ranked.filter((p) => p.parentSide === "YES").map((p) => p.id),
		).toEqual([yesA, yesB]);
		const before = await selectHeroTopPosts(testDb, marketId);
		expect(before.no).toBeNull();
		expect(requirePost(before.yes).id).toBe(yesA);

		// Remove ALL YES posts → yes === null too (the side renders no hero
		// post — never a placeholder object).
		await removeComment(yesA);
		await removeComment(yesB);
		const after = await selectHeroTopPosts(testDb, marketId);
		expect(after).toStrictEqual({ yes: null, no: null });

		// Fold: a market with ZERO posts → both sides null.
		const emptyMarketId = await seedMarket("hero-zero-posts");
		const empty = await selectHeroTopPosts(testDb, emptyMarketId);
		expect(empty).toStrictEqual({ yes: null, no: null });
	});

	it("hero-single-market-static", async () => {
		// Exactly ONE Open market in the DB (afterEach truncated), with posts
		// on both sides and a pool row so the Slice-1 card pricing is real.
		const marketId = await seedMarket("hero-solo");
		await seedPool(marketId);
		const author = await seedUser("hero-solo-author");
		const yesPost = await seedCommentWithBet({
			userId: author,
			marketId,
			side: "YES",
			stake: "25.000000000000000000",
			body: "Solo YES post — static hero.",
			parentCommentId: null,
			createdAt: at(1),
		});
		const noPost = await seedCommentWithBet({
			userId: author,
			marketId,
			side: "NO",
			stake: "30.000000000000000000",
			body: "Solo NO post — static hero.",
			parentCommentId: null,
			createdAt: at(2),
		});

		// Slice 1's list authority sees exactly this one market — the whole
		// carousel rotation domain is a single index.
		const cards = await listOpenMarkets(testDb);
		expect(cards).toHaveLength(1);
		const card = cards[0];
		expect(card.id).toBe(marketId);
		expect(card.slug).toBe("hero-solo");

		// The static-hero data contract: two consecutive server reads are
		// DEEPLY EQUAL — deterministic, no rotation source server-side. The
		// client no-auto-advance assertion for this same §17 registry row
		// lands at Slice 5 (render layer, fake timers); this is the server
		// half.
		const first = await selectHeroTopPosts(testDb, marketId);
		const second = await selectHeroTopPosts(testDb, marketId);
		expect(second).toStrictEqual(first);
		expect(requirePost(first.yes).id).toBe(yesPost);
		expect(requirePost(first.no).id).toBe(noPost);
	});
});
