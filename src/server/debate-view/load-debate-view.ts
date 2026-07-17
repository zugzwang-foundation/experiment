import "server-only";

import { and, eq, inArray } from "drizzle-orm";

import type { DbClient, DbTransaction } from "@/db";
import { imageUploads, modActions } from "@/db/schema";
import {
	type Badge,
	badgeFor,
	buildTopList,
	type PostSubstrate,
	type ReplySubstrate,
	rankReplies,
	type Side,
	twoSlot,
} from "@/lib/ranking";
import type { MarketSummary } from "@/server/markets/get-by-slug";
import type { Marker } from "@/server/positions/compute";
import { signRead } from "@/server/storage/sign-read";

import { type DebateComment, listMarketComments } from "./list-comments";
import { getMarketPricing } from "./market-pricing";
import { getMarketTotals } from "./market-totals";
import { loadRankingSubstrate } from "./ranking-substrate";
import { loadReplySubstrate } from "./reply-substrate";
import { type AuthorIdentity, resolveAuthors } from "./resolve-authors";

/** A bound read client — top-level `db` OR a caller's transaction. */
type DebateViewReader = DbClient | DbTransaction;

/** D9 — the DEBATE.4 render-path presigned-GET TTL (sign-read.ts seam tag). */
const READ_URL_TTL_SECONDS = 3600;

/**
 * Defensive author fallback. Every `comments.user_id` is a real `users` row
 * (FK), so a non-removed comment's author is always resolved; this keeps a
 * single missing identity from 500-ing a public read render. Carries no real
 * pseudonym — never a leak.
 */
const UNKNOWN_AUTHOR: AuthorIdentity = {
	pseudonym: "—",
	pfpUrl: "/pfp-placeholder.svg",
};

// ── The masked view-model (the type-level safety boundary) ───────────────────
// A removed entry is a DISTINCT union variant carrying NO body / title / teaser
// / image / author / live-overlay field — so a removed comment's argument or
// author CANNOT serialize into the client payload (a leak is a compile error).
// Structural fields (id, frozen side, createdAt, reply aggregate, the replies)
// survive on both variants (ADR-0020/0021 thread integrity).

/** Re-time aggregate over a post's reply-bets (design-language §3.1). */
export type ReplyAggregate = {
	supportCount: number;
	counterCount: number;
	supportDharma: string;
	counterDharma: string;
};

export type DebateReply =
	| { removed: true; id: string; side: Side; createdAt: string }
	| {
			removed: false;
			id: string;
			side: Side;
			createdAt: string;
			body: string;
			marker: Marker;
			author: AuthorIdentity;
			stake: string;
			/** EXPORT.1 — per-node entry price (`price_at_bet`); non-removed ONLY. */
			entryPrice: string;
	  };

/** A post's replies, ranked + partitioned by relation, plus the two-slot default. */
export type ReplyGroups = {
	support: DebateReply[];
	counter: DebateReply[];
	twoSlot: DebateReply[];
};

export type DebatePost =
	| {
			removed: true;
			id: string;
			/** UI.A2 §3.4 (OQ-5c) — the permanent 1-based deep-link ordinal; carried on BOTH variants (a removed post keeps its slot). */
			ordinal: number;
			sideAtPostTime: Side;
			createdAt: string;
			aggregate: ReplyAggregate;
			replies: ReplyGroups;
	  }
	| {
			removed: false;
			id: string;
			/** UI.A2 §3.4 (OQ-5c) — the permanent 1-based deep-link ordinal. */
			ordinal: number;
			sideAtPostTime: Side;
			createdAt: string;
			title: string;
			teaser: string;
			body: string;
			imageUrl: string | null;
			marker: Marker;
			badge: Badge | null;
			author: AuthorIdentity;
			authorStake: string;
			/** EXPORT.1 — per-node entry price (`price_at_bet`); non-removed ONLY. */
			entryPrice: string;
			aggregate: ReplyAggregate;
			replies: ReplyGroups;
	  };

export type DebateMarketHeader = MarketSummary & {
	pricing: { yes: string; no: string } | null;
	totals: { dharmaStaked: string; postCount: number; replyCount: number };
};

export type DebateViewModel = {
	market: DebateMarketHeader;
	posts: DebatePost[];
};

/**
 * The debate-view aggregator and the SINGLE place removal-masking is enforced
 * (DEBATE.4 §6 / ADR-0020/0021) — the gate `listMarketComments` requires before
 * it backs a public surface (SPEC.2 §5.4). It assembles the read-models, applies
 * the Top order + per-post badge (pure `ranking.ts`), and WITHHOLDS removed
 * content SERVER-SIDE: a comment whose id is in the `content_removed` set
 * becomes the `{ removed: true }` union variant with no body / title / image /
 * author — the client never receives those fields, so they cannot serialize into
 * HTML or JSON. Thread integrity survives: a removed parent keeps its slot,
 * frozen side, reply aggregate, and its replies (other users' arguments).
 *
 * Masking is keyed ONLY on `mod_actions.reason = 'content_removed'`.
 * `users.banned_at` does NOT mask — ban removes voice, not past content
 * (ADR-0021 §4 / §6.6). Author identity and image URLs are resolved ONLY for
 * non-removed comments, so a removed comment's pseudonym/PFP is never read and
 * its media URL is never even minted.
 *
 * Read-only; viewer-independent (no session param — DEBATE.4 is a public render,
 * C1). Frozen-by-construction at resolution (INV-4): every input is append-only
 * and new writes require `Open`, so a terminal market's view is stable forever.
 */
export async function loadDebateView(
	client: DebateViewReader,
	args: { market: MarketSummary },
): Promise<DebateViewModel> {
	const marketId = args.market.id;

	// Substrate reads. Sequential — the client may be a single-connection
	// transaction; the per-market volume is bounded (D11, load-all v1).
	const comments = await listMarketComments(client, { marketId });
	const postSubstrate = await loadRankingSubstrate(client, { marketId });
	const replyMap = await loadReplySubstrate(client, { marketId });
	const pricing = await getMarketPricing(client, marketId);
	const totals = await getMarketTotals(client, marketId);

	const commentById = new Map(comments.map((c) => [c.id, c]));

	// The masking input — content_removed ONLY (never banned_at). Scoped to this
	// market's comments via `mod_actions_target_comment_idx` + `_reason_idx`.
	const removedSet = await loadRemovedSet(
		client,
		comments.map((c) => c.id),
	);

	// Author identity + image URLs are resolved ONLY for NON-removed comments —
	// a removed comment's author is never read, its media URL never minted.
	const visible = comments.filter((c) => !removedSet.has(c.id));
	const authorMap = await resolveAuthors(
		client,
		visible.map((c) => c.userId),
	);
	// Only POSTS render an image (the DebateReply view-model carries none), so
	// only post images are minted — a reply image presign would be wasted work
	// (D9 per-render minting cost).
	const imageUrlByComment = await mintImageUrls(
		client,
		visible.filter((c) => c.parentCommentId === null),
	);

	// Top order over the WHOLE substrate (removed posts keep their slot/position).
	const ordered = buildTopList(postSubstrate);

	// UI.A2 §3.4 (ratified OQ-5c) — the deep-link ordinal: 1-based rank by
	// (created_at, id) ascending over ALL top-level comments, removed INCLUDED
	// (append-only ⇒ permanent). Mirrors resolve-post-param's query order
	// exactly — the round-trip integration test pins the two together. uuidv7
	// text order is byte-order-isomorphic to Postgres uuid comparison.
	const ordinalById = new Map<string, number>();
	comments
		.filter((c) => c.parentCommentId === null)
		.sort(
			(a, b) =>
				a.createdAt.getTime() - b.createdAt.getTime() ||
				(a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
		)
		.forEach((c, i) => {
			ordinalById.set(c.id, i + 1);
		});

	const posts: DebatePost[] = ordered.map((sub) => {
		const comment = commentById.get(sub.id);
		const removed = removedSet.has(sub.id);
		const aggregate: ReplyAggregate = {
			supportCount: sub.supportCount,
			counterCount: sub.counterCount,
			supportDharma: sub.supportDharma,
			counterDharma: sub.counterDharma,
		};
		const replies = buildReplyGroups(
			sub,
			replyMap,
			commentById,
			removedSet,
			authorMap,
		);

		// Defensive 0 only on the unreachable no-comment branch (the substrate
		// derives from comments+bets, so a substrate post always has its comment).
		const ordinal = ordinalById.get(sub.id) ?? 0;

		if (removed || !comment) {
			return {
				removed: true,
				id: sub.id,
				ordinal,
				sideAtPostTime: sub.parentSide,
				createdAt: (comment?.createdAt ?? new Date(0)).toISOString(),
				aggregate,
				replies,
			};
		}

		const { title, teaser } = deriveTitleTeaser(comment.body);
		return {
			removed: false,
			id: sub.id,
			ordinal,
			sideAtPostTime: comment.sideAtPostTime,
			createdAt: comment.createdAt.toISOString(),
			title,
			teaser,
			body: comment.body,
			imageUrl: imageUrlByComment.get(sub.id) ?? null,
			marker: comment.marker,
			badge: badgeFor(sub, postSubstrate),
			author: authorMap.get(comment.userId) ?? UNKNOWN_AUTHOR,
			authorStake: sub.authorStake,
			entryPrice: sub.priceAtBet,
			aggregate,
			replies,
		};
	});

	return {
		market: { ...args.market, pricing, totals },
		posts,
	};
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * The removed-comment id set — `content_removed` mod-actions over THIS market's
 * comments. The ONLY masking input (ADR-0021 §4: ban ≠ content removal).
 */
async function loadRemovedSet(
	client: DebateViewReader,
	commentIds: string[],
): Promise<Set<string>> {
	if (commentIds.length === 0) {
		return new Set();
	}
	const rows = await client
		.select({ id: modActions.targetCommentId })
		.from(modActions)
		.where(
			and(
				eq(modActions.reason, "content_removed"),
				inArray(modActions.targetCommentId, commentIds),
			),
		);
	const set = new Set<string>();
	for (const r of rows) {
		if (r.id !== null) {
			set.add(r.id);
		}
	}
	return set;
}

/**
 * Mint presigned GET URLs (D9) for the NON-removed comments that carry an image.
 * One batched key read (`comments_image_uploads_idx` → `image_uploads.id`), then
 * a local HMAC presign per image. A presign failure degrades that comment to no
 * image — a single unavailable object must not 500 the whole read render.
 */
async function mintImageUrls(
	client: DebateViewReader,
	visibleComments: DebateComment[],
): Promise<Map<string, string>> {
	const withImage = visibleComments.filter((c) => c.imageUploadsId !== null);
	if (withImage.length === 0) {
		return new Map();
	}
	const imageIds = [
		...new Set(withImage.map((c) => c.imageUploadsId as string)),
	];
	const rows = await client
		.select({ id: imageUploads.id, key: imageUploads.r2ObjectKey })
		.from(imageUploads)
		.where(inArray(imageUploads.id, imageIds));
	const keyById = new Map(rows.map((r) => [r.id, r.key]));

	const urlByComment = new Map<string, string>();
	await Promise.all(
		withImage.map(async (c) => {
			const key = keyById.get(c.imageUploadsId as string);
			if (!key) {
				return;
			}
			try {
				urlByComment.set(c.id, await signRead(key, READ_URL_TTL_SECONDS));
			} catch {
				// R2 unavailable for this object → degrade to no image (resilient
				// read render). The bet/comment are untouched.
			}
		}),
	);
	return urlByComment;
}

/**
 * D6 — the card title/teaser derivation against the single `comments.body`
 * column: title = the first line (≤125 chars); teaser = the next paragraph; the
 * full body rides on the `body` field (the pop-up). Coupling point if the write
 * slice ever adds a `comments.title` column (plan §1 D6 flag).
 */
function deriveTitleTeaser(body: string): { title: string; teaser: string } {
	const firstLine = body.split("\n", 1)[0] ?? "";
	const title = firstLine.slice(0, 125);
	const paragraphs = body.split(/\n\s*\n/);
	const teaser = (paragraphs[1] ?? "").trim();
	return { title, teaser };
}

/** Build a post's ranked + masked reply groups (Support/Counter + two-slot). */
function buildReplyGroups(
	post: PostSubstrate,
	replyMap: Map<string, ReplySubstrate[]>,
	commentById: Map<string, DebateComment>,
	removedSet: Set<string>,
	authorMap: Map<string, AuthorIdentity>,
): ReplyGroups {
	const ranked = rankReplies(replyMap.get(post.id) ?? [], post.parentSide);
	const slot = twoSlot(ranked);
	const toReply = (sub: ReplySubstrate): DebateReply =>
		buildReply(sub, commentById.get(sub.id), removedSet.has(sub.id), authorMap);
	return {
		support: ranked.support.map(toReply),
		counter: ranked.counter.map(toReply),
		twoSlot: slot.map(toReply),
	};
}

/** Build one reply's masked view-model (removed → no body/author/marker/stake). */
function buildReply(
	sub: ReplySubstrate,
	comment: DebateComment | undefined,
	removed: boolean,
	authorMap: Map<string, AuthorIdentity>,
): DebateReply {
	if (removed || !comment) {
		return {
			removed: true,
			id: sub.id,
			side: sub.side,
			createdAt: sub.createdAt.toISOString(),
		};
	}
	return {
		removed: false,
		id: sub.id,
		side: sub.side,
		createdAt: comment.createdAt.toISOString(),
		body: comment.body,
		marker: comment.marker,
		author: authorMap.get(comment.userId) ?? UNKNOWN_AUTHOR,
		stake: sub.stake,
		entryPrice: sub.priceAtBet,
	};
}
