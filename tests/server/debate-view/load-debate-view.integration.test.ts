import { afterEach, describe, expect, it, vi } from "vitest";

// DEBATE.4 §8 tests-first — THE SAFETY-CRITICAL GATE (plan §6, the removal-masking
// derivation). `loadDebateView` is the SINGLE place masking is enforced: a
// `content_removed` comment's BODY / derived title / teaser / image AND AUTHOR
// IDENTITY (pseudonym / PFP) must NEVER serialize to the client. The returned
// view-model is a discriminated union — a removed entry carries NO content/author
// field at the type level (a leak is a compile error) AND, asserted here, at
// runtime. Thread integrity survives: a removed parent keeps its slot + frozen
// side + reply aggregate + replies (other users' arguments). `users.banned_at`
// does NOT mask — only `content_removed` does (plan §6.6 / ADR-0021 §4).
//
// RED target: `@/server/debate-view/load-debate-view` does NOT yet exist, so this
// file fails at COLLECTION until the implement phase lands the aggregator.
//
// `signRead` is MOCKED so non-removed images don't hit real R2 AND so the test
// can assert it is NEVER called with a REMOVED comment's r2 key (a strong
// withholding assertion: the loader never even mints the URL for masked media).
//
// Each comment that needs a stake/aggregate rides a `bets` row via
// `bets.comment_id` (`comments.bet_id` stays NULL — SPEC.2 §14.1). Posts/replies
// are otherwise direct-seeded (the loader is a pure read).
//
// DB-backed (local Postgres :54322). TRUNCATE in afterEach (mod_actions
// included). Money/side cross as STRING / "YES"|"NO" (CLAUDE.md §2).

vi.mock("@sentry/nextjs", () => ({
	captureMessage: vi.fn(),
	addBreadcrumb: vi.fn(),
	captureException: vi.fn(),
}));

const { mockSignRead, mockMintReadUrl } = vi.hoisted(() => ({
	mockSignRead: vi.fn(async (key: string) => `https://signed.example/${key}`),
	mockMintReadUrl: vi.fn(
		async (bucket: string, key: string) =>
			`https://signed.example/${bucket}/${key}`,
	),
}));

vi.mock("@/server/storage/sign-read", () => ({
	signRead: mockSignRead,
}));

// ⚠ A SECOND, DIFFERENT SEAM. Market media is signed through `storage/r2.ts`'s
// `mintReadUrl("market-media", …)`, NOT through `signRead`, which is hardcoded
// to the participant `"uploads"` bucket and must not serve admin market media
// (ADR-0026 / SPEC.2 §12.1). Mocking only `sign-read` leaves the market-media
// arm unstubbed, where it throws for want of R2 credentials and
// `getDefaultMarketMediaUrl` degrades it to `null` — which is exactly how the
// first version of the test below failed, and exactly why `@code-reviewer`
// MEDIUM-4 flagged this arm as uncovered.
vi.mock("@/server/storage/r2", () => ({
	mintReadUrl: mockMintReadUrl,
}));

import {
	bets,
	comments,
	imageUploads,
	marketMedia,
	markets,
	modActions,
	pools,
	users,
} from "@/db/schema";
// The RED import: greenfield aggregator under test (the masking gate).
import { loadDebateView } from "@/server/debate-view/load-debate-view";
import type { MarketSummary } from "@/server/markets/get-by-slug";

import { testClient, testDb } from "../../db/_fixtures/db";
import { truncateTables } from "../../db/_fixtures/truncate";

const SEED = "100.000000000000000000";

// The forbidden keys a removed entry must NEVER carry (body / derived title /
// teaser / image / author identity / live overlays). Structural keys survive.
const CONTENT_KEYS = [
	"body",
	"title",
	"teaser",
	"imageUrl",
	"author",
	"marker",
	"badge",
	"authorStake",
] as const;
const REPLY_CONTENT_KEYS = ["body", "author", "marker", "stake"] as const;

async function seedUser(args: {
	tag: string;
	bannedAt?: Date | null;
}): Promise<string> {
	const [user] = await testDb
		.insert(users)
		.values({
			name: "View User",
			email: `${args.tag}@example.com`,
			pseudonym: args.tag,
			bannedAt: args.bannedAt ?? null,
		})
		.returning({ id: users.id });
	return user?.id ?? "";
}

async function seedMarket(slug: string): Promise<MarketSummary> {
	const [market] = await testDb
		.insert(markets)
		.values({
			slug,
			title: "Debate View Market",
			description: "Resolution criterion text.",
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
	// ⚠ The `.returning()` above must project EVERY `MarketSummary` column. The
	// assertion below compiles either way (the target is assignable to the
	// source), so a missing column silently produces `undefined` where the DTO
	// promises `string | null` — `@code-reviewer` LOW-3.
	const m = market as MarketSummary;
	await testDb
		.insert(pools)
		.values({ marketId: m.id, yesReserves: SEED, noReserves: SEED });
	return m;
}

async function seedImageUpload(userId: string): Promise<{
	id: string;
	r2Key: string;
}> {
	const r2Key = `uploads/${userId}-${Math.random().toString(36).slice(2)}.webp`;
	const [img] = await testDb
		.insert(imageUploads)
		.values({
			userId,
			r2ObjectKey: r2Key,
			contentType: "image/webp",
			byteSize: 1000,
		})
		.returning({ id: imageUploads.id });
	return { id: img?.id ?? "", r2Key };
}

/** Direct-seed a post/reply + its riding bet (the stake/aggregate source). */
async function seedCommentWithBet(args: {
	userId: string;
	marketId: string;
	side: "YES" | "NO";
	stake: string;
	body: string;
	parentCommentId: string | null;
	imageUploadsId?: string | null;
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
			imageUploadsId: args.imageUploadsId ?? null,
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

/** Locate a post in the VM by id (Top order means index is not stable). */
function findPost(
	vm: { posts: Array<{ id: string }> },
	id: string,
): Record<string, unknown> {
	const entry = vm.posts.find((p) => p.id === id);
	if (!entry) throw new Error(`post ${id} not in view-model`);
	return entry as unknown as Record<string, unknown>;
}

/** Recursively assert no removed entry (post OR reply) carries a `body`/author. */
function walkAssertNoLeak(node: unknown): void {
	if (Array.isArray(node)) {
		for (const item of node) walkAssertNoLeak(item);
		return;
	}
	if (node && typeof node === "object") {
		const obj = node as Record<string, unknown>;
		if (obj.removed === true) {
			expect(obj).not.toHaveProperty("body");
			expect(obj).not.toHaveProperty("author");
			expect(obj).not.toHaveProperty("title");
			expect(obj).not.toHaveProperty("teaser");
			expect(obj).not.toHaveProperty("imageUrl");
		}
		for (const v of Object.values(obj)) walkAssertNoLeak(v);
	}
}

describe("DEBATE.4 §6 — loadDebateView removal-masking gate (body/author never serialize)", () => {
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

	// ── 1. Removed post masks content + author, keeps structure ────────────────
	it("removed post withholds body/title/teaser/image/author; structure survives", async () => {
		const market = await seedMarket("masking-post");
		const u1 = await seedUser({ tag: "mask-author-1" });
		const u2 = await seedUser({ tag: "mask-author-2" });

		const post1 = await seedCommentWithBet({
			userId: u1,
			marketId: market.id,
			side: "YES",
			stake: "100.000000000000000000",
			body: "Removed argument — should NEVER serialize.",
			parentCommentId: null,
			createdAt: new Date("2026-09-15T00:00:01Z"),
		});
		const post2 = await seedCommentWithBet({
			userId: u2,
			marketId: market.id,
			side: "NO",
			stake: "80.000000000000000000",
			body: "Present argument — survives intact.",
			parentCommentId: null,
			createdAt: new Date("2026-09-15T00:00:02Z"),
		});
		await removeComment(post1);

		const vm = await loadDebateView(testDb, { market });

		const e1 = findPost(vm, post1);
		// Discriminant set.
		expect(e1.removed).toBe(true);
		// NONE of the content/author/overlay keys present at runtime.
		for (const k of CONTENT_KEYS) {
			expect(e1).not.toHaveProperty(k);
		}
		// Structure survives: id, frozen side, createdAt, aggregate, replies.
		expect(e1.id).toBe(post1);
		expect(e1.sideAtPostTime).toBe("YES");
		expect(e1).toHaveProperty("aggregate");
		expect(e1).toHaveProperty("replies");

		// post2 is fully present.
		const e2 = findPost(vm, post2);
		expect(e2.removed).toBe(false);
		expect(e2.body).toBe("Present argument — survives intact.");
		expect(e2).toHaveProperty("author");

		// The body string must not appear anywhere in the serialized VM.
		expect(JSON.stringify(vm)).not.toContain(
			"Removed argument — should NEVER serialize.",
		);
	});

	// ── 1b. Masking is STABLE across repeated invocation (F-DEBATE-4) ──────────
	// The polled refresh re-invokes THIS loader on an interval rather than
	// fetching a separate read endpoint (SPEC.1 1.0.25 §9 F-DEBATE-4), so the
	// question "does masking survive a poll?" reduces to "is masking a pure
	// function of the same inputs?". Extended here rather than minted in a new
	// file: one masking gate, one masking suite (ADR-0034 D-4). Supports SPEC.1
	// §17 `debate-view::poll-preserves-removal-masking`; the structural half —
	// that no second read path exists to diverge from this one — lives in
	// `tests/server/debate-view/poll-contract.test.ts`.
	it("masks identically across repeated invocation (the polled read's shape)", async () => {
		const market = await seedMarket("masking-repeat");
		const u1 = await seedUser({ tag: "repeat-author-1" });
		const u2 = await seedUser({ tag: "repeat-author-2" });

		const removed = await seedCommentWithBet({
			userId: u1,
			marketId: market.id,
			side: "YES",
			stake: "100.000000000000000000",
			body: "Removed argument — must stay masked on every poll.",
			parentCommentId: null,
			createdAt: new Date("2026-09-15T00:00:01Z"),
		});
		await seedCommentWithBet({
			userId: u2,
			marketId: market.id,
			side: "NO",
			stake: "80.000000000000000000",
			body: "Present argument — survives every poll.",
			parentCommentId: null,
			createdAt: new Date("2026-09-15T00:00:02Z"),
		});
		await removeComment(removed);

		// Four consecutive reads — the shape a 15 s poll produces.
		const runs = [
			await loadDebateView(testDb, { market }),
			await loadDebateView(testDb, { market }),
			await loadDebateView(testDb, { market }),
			await loadDebateView(testDb, { market }),
		];

		for (const vm of runs) {
			const entry = findPost(vm, removed);
			expect(entry.removed).toBe(true);
			for (const k of CONTENT_KEYS) {
				expect(entry).not.toHaveProperty(k);
			}
			walkAssertNoLeak(vm);
			expect(JSON.stringify(vm)).not.toContain(
				"Removed argument — must stay masked on every poll.",
			);
		}

		// Byte-identical across polls: no viewer state, no per-invocation drift.
		const serialized = runs.map((vm) => JSON.stringify(vm));
		expect(new Set(serialized).size).toBe(1);
	});

	// ── 2. Thread intact under a removed parent ────────────────────────────────
	it("a removed parent keeps its replies (other users' arguments survive)", async () => {
		const market = await seedMarket("masking-thread");
		const parentAuthor = await seedUser({ tag: "thread-parent" });
		const replierA = await seedUser({ tag: "thread-reply-a" });
		const replierB = await seedUser({ tag: "thread-reply-b" });

		const post1 = await seedCommentWithBet({
			userId: parentAuthor,
			marketId: market.id,
			side: "YES",
			stake: "100.000000000000000000",
			body: "Parent removed.",
			parentCommentId: null,
			createdAt: new Date("2026-09-15T00:00:01Z"),
		});
		const replyA = await seedCommentWithBet({
			userId: replierA,
			marketId: market.id,
			side: "YES",
			stake: "30.000000000000000000",
			body: "Reply A survives.",
			parentCommentId: post1,
			createdAt: new Date("2026-09-15T01:00:00Z"),
		});
		const replyB = await seedCommentWithBet({
			userId: replierB,
			marketId: market.id,
			side: "NO",
			stake: "40.000000000000000000",
			body: "Reply B survives.",
			parentCommentId: post1,
			createdAt: new Date("2026-09-15T01:00:01Z"),
		});
		await removeComment(post1);

		const vm = await loadDebateView(testDb, { market });
		const e1 = findPost(vm, post1);
		expect(e1.removed).toBe(true);

		// Both replies present with full content despite the removed parent.
		const replies = e1.replies as {
			support: Array<Record<string, unknown>>;
			counter: Array<Record<string, unknown>>;
		};
		const allReplies = [...replies.support, ...replies.counter];
		const byId = new Map(allReplies.map((r) => [r.id, r]));
		const a = byId.get(replyA);
		const b = byId.get(replyB);
		expect(a?.removed).toBe(false);
		expect(a?.body).toBe("Reply A survives.");
		expect(a).toHaveProperty("author");
		expect(b?.removed).toBe(false);
		expect(b?.body).toBe("Reply B survives.");
		expect(b).toHaveProperty("author");
	});

	// ── 3. Removed reply masks itself; siblings intact ─────────────────────────
	it("a removed reply withholds its own body/author; sibling reply survives", async () => {
		const market = await seedMarket("masking-reply");
		const postAuthor = await seedUser({ tag: "reply-mask-post" });
		const replierA = await seedUser({ tag: "reply-mask-a" });
		const replierB = await seedUser({ tag: "reply-mask-b" });

		const post = await seedCommentWithBet({
			userId: postAuthor,
			marketId: market.id,
			side: "YES",
			stake: "100.000000000000000000",
			body: "Present post.",
			parentCommentId: null,
			createdAt: new Date("2026-09-15T00:00:01Z"),
		});
		const removedReply = await seedCommentWithBet({
			userId: replierA,
			marketId: market.id,
			side: "YES",
			stake: "30.000000000000000000",
			body: "Removed reply — never serialize.",
			parentCommentId: post,
			createdAt: new Date("2026-09-15T01:00:00Z"),
		});
		const okReply = await seedCommentWithBet({
			userId: replierB,
			marketId: market.id,
			side: "NO",
			stake: "40.000000000000000000",
			body: "Sibling survives.",
			parentCommentId: post,
			createdAt: new Date("2026-09-15T01:00:01Z"),
		});
		await removeComment(removedReply);

		const vm = await loadDebateView(testDb, { market });
		const e = findPost(vm, post);
		expect(e.removed).toBe(false);

		const replies = e.replies as {
			support: Array<Record<string, unknown>>;
			counter: Array<Record<string, unknown>>;
		};
		const byId = new Map(
			[...replies.support, ...replies.counter].map((r) => [r.id, r]),
		);
		const removed = byId.get(removedReply);
		const ok = byId.get(okReply);

		expect(removed?.removed).toBe(true);
		for (const k of REPLY_CONTENT_KEYS) {
			expect(removed).not.toHaveProperty(k);
		}
		// Structural reply fields survive on the removed reply.
		expect(removed?.id).toBe(removedReply);
		expect(removed?.side).toBe("YES");

		expect(ok?.removed).toBe(false);
		expect(ok?.body).toBe("Sibling survives.");
		expect(JSON.stringify(vm)).not.toContain(
			"Removed reply — never serialize.",
		);
	});

	// ── 4. Image withheld on removed; minted on present ────────────────────────
	it("removed post: signRead NEVER called for its r2 key; present post: image URL minted", async () => {
		const market = await seedMarket("masking-image");
		const u1 = await seedUser({ tag: "img-removed" });
		const u2 = await seedUser({ tag: "img-present" });

		const removedImg = await seedImageUpload(u1);
		const presentImg = await seedImageUpload(u2);

		const removedPost = await seedCommentWithBet({
			userId: u1,
			marketId: market.id,
			side: "YES",
			stake: "100.000000000000000000",
			body: "Removed-with-image.",
			parentCommentId: null,
			imageUploadsId: removedImg.id,
			createdAt: new Date("2026-09-15T00:00:01Z"),
		});
		const presentPost = await seedCommentWithBet({
			userId: u2,
			marketId: market.id,
			side: "NO",
			stake: "80.000000000000000000",
			body: "Present-with-image.",
			parentCommentId: null,
			imageUploadsId: presentImg.id,
			createdAt: new Date("2026-09-15T00:00:02Z"),
		});
		await removeComment(removedPost);

		const vm = await loadDebateView(testDb, { market });

		const eRemoved = findPost(vm, removedPost);
		expect(eRemoved.removed).toBe(true);
		expect(eRemoved).not.toHaveProperty("imageUrl");
		// The loader must NEVER mint a signed URL for a removed comment's media.
		expect(mockSignRead).not.toHaveBeenCalledWith(
			removedImg.r2Key,
			expect.anything(),
		);

		const ePresent = findPost(vm, presentPost);
		expect(ePresent.removed).toBe(false);
		// Present image → signed URL minted via signRead and surfaced.
		expect(mockSignRead).toHaveBeenCalledWith(
			presentImg.r2Key,
			expect.anything(),
		);
		expect(ePresent.imageUrl).toBe(
			`https://signed.example/${presentImg.r2Key}`,
		);
	});

	// ── 4b. The SAME rule on REPLIES — the path row 26 opened ──────────────────
	it("removed REPLY: signRead NEVER called for its r2 key; present reply: image URL minted", async () => {
		// ⛔ SC-1 (CLAUDE.md §5.14). HTML-FINISH · MARKET DETAIL row 26 widened
		// `mintImageUrls` from posts-only to every VISIBLE comment, which is the
		// first time a reply's media key reaches the presign at all. Test 4 above
		// proves the rule for posts and CANNOT see this path — it seeds only
		// top-level comments, so it would stay green with reply masking entirely
		// absent. That is exactly the "second body-read path" SC-1 was minted from.
		const market = await seedMarket("masking-reply-image");
		const parentAuthor = await seedUser({ tag: "rimg-parent" });
		const u1 = await seedUser({ tag: "rimg-removed" });
		const u2 = await seedUser({ tag: "rimg-present" });

		const removedImg = await seedImageUpload(u1);
		const presentImg = await seedImageUpload(u2);

		const parent = await seedCommentWithBet({
			userId: parentAuthor,
			marketId: market.id,
			side: "YES",
			stake: "100.000000000000000000",
			body: "Parent post for the reply-image case.",
			parentCommentId: null,
			createdAt: new Date("2026-09-15T00:00:01Z"),
		});
		const removedReply = await seedCommentWithBet({
			userId: u1,
			marketId: market.id,
			side: "YES",
			stake: "40.000000000000000000",
			body: "Removed reply with an image — never serialize.",
			parentCommentId: parent,
			imageUploadsId: removedImg.id,
			createdAt: new Date("2026-09-15T00:00:02Z"),
		});
		await seedCommentWithBet({
			userId: u2,
			marketId: market.id,
			side: "NO",
			stake: "30.000000000000000000",
			body: "Present reply with an image.",
			parentCommentId: parent,
			imageUploadsId: presentImg.id,
			createdAt: new Date("2026-09-15T00:00:03Z"),
		});
		await removeComment(removedReply);

		const vm = await loadDebateView(testDb, { market });
		const payload = JSON.stringify(vm);

		// ⛔ THE BODY'S ABSENCE, NOT THE ROW'S (SC-1). A row-level assertion
		// ("the removed reply is not in the list") would pass on a build that
		// excluded the row from one read and leaked its body from another.
		expect(payload).not.toContain("Removed reply with an image");
		// …and the same for its MEDIA, which is the field this row added.
		expect(payload).not.toContain(removedImg.r2Key);
		expect(mockSignRead).not.toHaveBeenCalledWith(
			removedImg.r2Key,
			expect.anything(),
		);

		// Positive control — the present reply's image IS minted and surfaced, so
		// the absences above are not merely "replies never get images".
		expect(mockSignRead).toHaveBeenCalledWith(
			presentImg.r2Key,
			expect.anything(),
		);
		expect(payload).toContain(`https://signed.example/${presentImg.r2Key}`);

		// The removed reply keeps its slot (ADR-0020/0021 thread integrity) and
		// carries no content keys at all.
		walkAssertNoLeak(vm);
	});

	// ── 4c. The one statement this task spent — the market media read ──────────
	it("mediaImageUrl is the lowest-display_order NON-default market_media row, presigned for read (MEDIA-SECOND-ROW Slice 1)", async () => {
		// ⚠ The task's ENTIRE read budget is this one statement, and nothing under
		// tests/server covered it — `@code-reviewer` MEDIUM-4. It goes through
		// `signReadMarketMedia` → `mintReadUrl("market-media", …)`, a DIFFERENT
		// bucket arm from the `signRead("uploads")` seam this file mocks, so the
		// render tests prove the component and nothing proved the read.
		//
		// ⚠ MEDIA-SECOND-ROW Slice 1 (2026-08-21): this call moved from
		// `getDefaultMarketMediaUrl` to `getSecondaryMarketMediaUrl` — the panel
		// now reads the lowest-`display_order` NON-default row, falling back to
		// the `is_default` row only when it is the market's sole row (see the
		// dedicated `market-media-selection.integration.test.ts` suite for the
		// selection rule itself; this test's job is only to prove
		// `loadDebateView` actually calls the new function, not the old one, and
		// that it's still one statement). The fixture below is unchanged from
		// before this slice — same two rows, same discriminator — only the
		// EXPECTED row flipped, because the row this read is supposed to resolve
		// flipped.
		const market = await seedMarket("market-media-read");

		await testDb.insert(marketMedia).values([
			{
				marketId: market.id,
				r2ObjectKey: `m/${market.id}/not-default.png`,
				displayOrder: 1,
				isDefault: false,
			},
			{
				marketId: market.id,
				r2ObjectKey: `m/${market.id}/default.png`,
				displayOrder: 0,
				isDefault: true,
			},
		]);

		const vm = await loadDebateView(testDb, { market });

		// The NON-default row, not merely "a" row — the default sibling is the
		// discriminator, so a read that reverted to `getDefaultMarketMediaUrl`
		// (or dropped the `is_default ASC` ordering) fails.
		expect(vm.market.mediaImageUrl).toContain(`m/${market.id}/not-default.png`);
		expect(vm.market.mediaImageUrl).not.toContain("/default.png");
		// …signed against the `market-media` bucket arm, never the participant
		// `uploads` one.
		expect(mockMintReadUrl).toHaveBeenCalledWith(
			"market-media",
			`m/${market.id}/not-default.png`,
			expect.anything(),
		);
	});

	// ── 5. Decoupling — a banned author is NOT masked ──────────────────────────
	it("a banned author's NON-removed comment is fully present (ban removes voice, not content)", async () => {
		const market = await seedMarket("masking-banned");
		const bannedAuthor = await seedUser({
			tag: "banned-author",
			bannedAt: new Date("2026-09-20T00:00:00Z"),
		});

		const post = await seedCommentWithBet({
			userId: bannedAuthor,
			marketId: market.id,
			side: "YES",
			stake: "100.000000000000000000",
			body: "Banned author, content NOT removed — survives.",
			parentCommentId: null,
			createdAt: new Date("2026-09-15T00:00:01Z"),
		});
		// NO content_removed row for this comment.

		const vm = await loadDebateView(testDb, { market });
		const e = findPost(vm, post);

		// Banned != removed. Full content + author present.
		expect(e.removed).toBe(false);
		expect(e.body).toBe("Banned author, content NOT removed — survives.");
		expect(e).toHaveProperty("author");
	});

	// ── 6. Title/teaser/body derivation (D6) ───────────────────────────────────
	it("derives title = first line ≤125 chars, teaser = next paragraph, body = full", async () => {
		const market = await seedMarket("derivation");
		const u = await seedUser({ tag: "deriv-author" });

		const title = "This is the first line and the card title";
		const teaser = "This is the next paragraph, used as the teaser.";
		const rest = "And here is a third paragraph in the full body.";
		const fullBody = `${title}\n\n${teaser}\n\n${rest}`;

		const post = await seedCommentWithBet({
			userId: u,
			marketId: market.id,
			side: "YES",
			stake: "100.000000000000000000",
			body: fullBody,
			parentCommentId: null,
			createdAt: new Date("2026-09-15T00:00:01Z"),
		});

		const vm = await loadDebateView(testDb, { market });
		const e = findPost(vm, post);
		expect(e.removed).toBe(false);
		expect(e.title).toBe(title);
		expect(e.teaser).toBe(teaser);
		expect(e.body).toBe(fullBody);
	});

	// ── 7. Aggregate + author-stake threading ──────────────────────────────────
	it("threads the per-post aggregate and the author's own entry-bet stake", async () => {
		const market = await seedMarket("aggregate");
		const author = await seedUser({ tag: "agg-author" });
		const r1 = await seedUser({ tag: "agg-r1" });
		const r2 = await seedUser({ tag: "agg-r2" });
		const r3 = await seedUser({ tag: "agg-r3" });

		// Post on YES, author stake 150. Two Support (YES) replies Đ20 + Đ30,
		// one Counter (NO) reply Đ70.
		const post = await seedCommentWithBet({
			userId: author,
			marketId: market.id,
			side: "YES",
			stake: "150.000000000000000000",
			body: "Post with replies.",
			parentCommentId: null,
			createdAt: new Date("2026-09-15T00:00:01Z"),
		});
		await seedCommentWithBet({
			userId: r1,
			marketId: market.id,
			side: "YES",
			stake: "20.000000000000000000",
			body: "Support 1.",
			parentCommentId: post,
			createdAt: new Date("2026-09-15T01:00:00Z"),
		});
		await seedCommentWithBet({
			userId: r2,
			marketId: market.id,
			side: "YES",
			stake: "30.000000000000000000",
			body: "Support 2.",
			parentCommentId: post,
			createdAt: new Date("2026-09-15T01:00:01Z"),
		});
		await seedCommentWithBet({
			userId: r3,
			marketId: market.id,
			side: "NO",
			stake: "70.000000000000000000",
			body: "Counter 1.",
			parentCommentId: post,
			createdAt: new Date("2026-09-15T01:00:02Z"),
		});

		const vm = await loadDebateView(testDb, { market });
		const e = findPost(vm, post);
		expect(e.removed).toBe(false);

		const agg = e.aggregate as {
			supportCount: number;
			counterCount: number;
			supportDharma: string;
			counterDharma: string;
		};
		expect(agg.supportCount).toBe(2);
		expect(agg.counterCount).toBe(1);
		expect(Number(agg.supportDharma)).toBe(50); // 20 + 30
		expect(Number(agg.counterDharma)).toBe(70);

		// authorStake = the post's own entry-bet stake.
		expect(Number(e.authorStake as string)).toBe(150);
	});

	// ── 8. VM is serializable; no removed entry carries body/author after round-trip ─
	it("the whole VM JSON-round-trips with NO body/author under any removed entry", async () => {
		const market = await seedMarket("serializable");
		const u1 = await seedUser({ tag: "ser-1" });
		const u2 = await seedUser({ tag: "ser-2" });
		const u3 = await seedUser({ tag: "ser-3" });

		const removedPost = await seedCommentWithBet({
			userId: u1,
			marketId: market.id,
			side: "YES",
			stake: "100.000000000000000000",
			body: "Removed post body — never serialize.",
			parentCommentId: null,
			createdAt: new Date("2026-09-15T00:00:01Z"),
		});
		const okPost = await seedCommentWithBet({
			userId: u2,
			marketId: market.id,
			side: "NO",
			stake: "80.000000000000000000",
			body: "Present post.",
			parentCommentId: null,
			createdAt: new Date("2026-09-15T00:00:02Z"),
		});
		const removedReply = await seedCommentWithBet({
			userId: u3,
			marketId: market.id,
			side: "NO",
			stake: "30.000000000000000000",
			body: "Removed reply body — never serialize.",
			parentCommentId: okPost,
			createdAt: new Date("2026-09-15T01:00:00Z"),
		});
		await removeComment(removedPost);
		await removeComment(removedReply);

		const vm = await loadDebateView(testDb, { market });

		// Does not throw, and round-trips losslessly enough to walk.
		const json = JSON.stringify(vm);
		expect(() => JSON.parse(json)).not.toThrow();
		const parsed = JSON.parse(json) as unknown;

		// Belt: no removed entry (post or reply) carries body/author/title/etc.
		walkAssertNoLeak(parsed);

		// Neither removed body string leaks anywhere in the serialized payload.
		expect(json).not.toContain("Removed post body — never serialize.");
		expect(json).not.toContain("Removed reply body — never serialize.");

		// Market header is fully present and serialized.
		const vmShape = vm as unknown as {
			market: { pricing: unknown; totals: unknown };
			posts: unknown[];
		};
		expect(vmShape.market.pricing).not.toBeUndefined();
		expect(vmShape.market.totals).not.toBeUndefined();
		expect(vmShape.posts.length).toBe(2);
	});
});
