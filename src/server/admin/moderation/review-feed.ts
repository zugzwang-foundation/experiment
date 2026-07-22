import "server-only";

import { and, desc, eq, inArray, notExists, sql } from "drizzle-orm";

import { db } from "@/db";
import {
	comments,
	dharmaLedger,
	imageUploads,
	markets,
	modActions,
	users,
} from "@/db/schema";
import type { CategoryScore } from "@/server/admin/moderation/audit-view";
import { READ_URL_TTL_SECONDS_MODERATION } from "@/server/config/limits";
import { loadRemovedSet } from "@/server/debate-view/load-debate-view";
import { signRead } from "@/server/storage/sign-read";

// UI.6 S3(a) — the live-content review-feed reader (F-ADMIN-4 partial;
// ADR-0021). Returns every LIVE comment across ALL markets in chronological
// (newest-first) order — NO market filter, NO ranking (ADR-0021: the admin
// reviews the stream by eye). "Live" = a `comments` row that persisted (Track
// A/B never insert one) MINUS the reactive `content_removed` set. Completeness
// is load-bearing (§3 #6): removal is an in-SQL `NOT EXISTS` anti-join against
// the SAME masking source of truth as `loadRemovedSet`
// (`mod_actions.reason='content_removed'`), so the 200 cap applies to LIVE rows
// — a removed row in the window can never silently displace an older live one.
//
// Pagination is NOT a filter (D-4): the newest-first window caps at 200 with a
// truncation flag + a `nextCursor` the operator uses to reach older rows. A
// banned author's non-removed content STILL appears (ban ≠ removal, ADR-0021).
//
// This reader is READ-ONLY and PAGE-gated (the `/admin/moderation` page runs
// `requireAdminPage()` before calling it) — mirroring `loadModerationAuditFeed`.
// Images are minted server-side, short-TTL, admin-gated (see IMAGE below).

export const REVIEW_FEED_CAP = 200;

/** Max characters of a reply's collapsed parent-body snippet. */
const PARENT_SNIPPET_MAX = 140;

/**
 * A reply's parent reference. `null` = a post (no parent) — a DISTINCT fact from
 * a reply whose parent is `content_removed`. The `{ removed: true }` variant
 * carries NO snippet field, so a removed parent's body is un-renderable BY
 * CONSTRUCTION: masking is a property of every body read, not just of rows.
 */
export type ReviewFeedParent =
	| null
	| { removed: true }
	| { removed: false; snippet: string };

export interface ReviewFeedRow {
	id: string;
	kind: "post" | "reply";
	/**
	 * For replies: the parent reference. A `content_removed` parent yields
	 * `{ removed: true }` (placeholder, no body); a live parent yields its
	 * snippet; a post yields `null`.
	 */
	parent: ReviewFeedParent;
	marketId: string;
	marketSlug: string;
	marketTitle: string;
	marketStatus: string;
	side: "YES" | "NO";
	body: string;
	/** Short-TTL admin-viewable signed URL (60s); NEVER a raw R2 key. */
	imageUrl: string | null;
	/**
	 * Whether the comment CARRIES an image (`image_uploads_id` present) — distinct
	 * from `imageUrl` being minted. On a transient R2 presign failure `imageUrl`
	 * degrades to null; `hasImage` stays true so the feed renders an
	 * "image unavailable" marker rather than silently reading as text-only
	 * (F-ADMIN-4's false-negative coverage role — image content must never hide).
	 */
	hasImage: boolean;
	authorUserId: string;
	authorPseudonym: string;
	authorDharma: string;
	authorBanned: boolean;
	priorFlagCount: number;
	createdAt: Date;
	/**
	 * OpenAI moderation category scores, rendered ONLY where the row's
	 * `mod_actions` record carries them. In v1 a live row provably carries NONE:
	 * a `pass` writes no `mod_actions` row (its gate categories are discarded —
	 * D-3/OQ-3), Track-A/B never publish a comment, and `content_removed` rows
	 * are anti-joined out. Full annotation would need persisting gate categories
	 * on pass = a schema change = out of scope (docketed; SPEC.1 §15 rider).
	 */
	categoryScores: CategoryScore[];
}

export interface ReviewFeedResult {
	rows: ReviewFeedRow[];
	cap: number;
	/** True when live rows exist beyond this newest-first window. */
	truncated: boolean;
	/** The (createdAt, id) to page older from; null when nothing older remains. */
	nextCursor: { createdAt: string; id: string } | null;
}

export interface LoadReviewFeedOptions {
	limit?: number;
	/**
	 * Exclusive "older than" keyset cursor for the "load older" control.
	 * `createdAt` is a MICROSECOND-precision UTC string (`YYYY-MM-DDTHH:MM:SS.ffffffZ`)
	 * — NOT a JS `Date`. `comments.created_at` is `timestamptz` (µs); a `Date`
	 * cursor truncates to ms, so a live row sharing the boundary's millisecond
	 * would be silently skipped (it is `>` the ms-floored bound yet older than the
	 * boundary row) — a completeness hole (§3 #6, D-4). The cursor is emitted at
	 * full µs precision by `loadReviewFeed` and compared with a `::timestamptz`
	 * cast so pagination never drops a row.
	 */
	before?: { createdAt: string; id: string };
}

export async function loadReviewFeed(
	options: LoadReviewFeedOptions = {},
): Promise<ReviewFeedResult> {
	const cap = options.limit ?? REVIEW_FEED_CAP;
	const before = options.before;

	// Fetch cap+1 to detect truncation without a second COUNT. The anti-join
	// keeps only live rows, so the +1 (if present) is a genuine older live row.
	const fetched = await db
		.select({
			id: comments.id,
			parentCommentId: comments.parentCommentId,
			body: comments.body,
			sideAtPostTime: comments.sideAtPostTime,
			imageUploadsId: comments.imageUploadsId,
			createdAt: comments.createdAt,
			authorUserId: comments.userId,
			marketId: comments.marketId,
			marketSlug: markets.slug,
			marketTitle: markets.title,
			marketStatus: markets.status,
			authorPseudonym: users.pseudonym,
			authorBannedAt: users.bannedAt,
			// Full µs-precision UTC cursor string (the DTO `createdAt` Date is
			// ms-precision and display-only; keyset paging MUST use µs — see
			// LoadReviewFeedOptions.before).
			createdAtCursor: sql<string>`to_char(${comments.createdAt} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`,
		})
		.from(comments)
		.innerJoin(markets, eq(comments.marketId, markets.id))
		.innerJoin(users, eq(comments.userId, users.id))
		.where(
			and(
				notExists(
					db
						.select({ one: sql`1` })
						.from(modActions)
						.where(
							and(
								eq(modActions.targetCommentId, comments.id),
								eq(modActions.reason, "content_removed"),
							),
						),
				),
				before
					? sql`(${comments.createdAt}, ${comments.id}) < (${before.createdAt}::timestamptz, ${before.id}::uuid)`
					: undefined,
			),
		)
		.orderBy(desc(comments.createdAt), desc(comments.id))
		.limit(cap + 1);

	const truncated = fetched.length > cap;
	const page = truncated ? fetched.slice(0, cap) : fetched;
	const last = page.at(-1);
	const nextCursor =
		truncated && last ? { createdAt: last.createdAtCursor, id: last.id } : null;

	// ── Enrichments — all set-based over the page (no N+1). ──────────────────

	// IMAGE (A1): mint a short-TTL, admin-gated signed URL per image from the
	// R2 key — NEVER a raw key in the DTO/DOM. A presign failure degrades that
	// row to no image (a single unavailable object must not 500 the feed).
	const imageUploadIds = [
		...new Set(
			page
				.map((r) => r.imageUploadsId)
				.filter((id): id is string => id !== null),
		),
	];
	const imageUrlByComment = new Map<string, string>();
	if (imageUploadIds.length > 0) {
		const keyRows = await db
			.select({ id: imageUploads.id, key: imageUploads.r2ObjectKey })
			.from(imageUploads)
			.where(inArray(imageUploads.id, imageUploadIds));
		const keyById = new Map(keyRows.map((r) => [r.id, r.key]));
		await Promise.all(
			page
				.filter((r) => r.imageUploadsId !== null)
				.map(async (r) => {
					const key = keyById.get(r.imageUploadsId as string);
					if (!key) return;
					try {
						imageUrlByComment.set(
							r.id,
							await signRead(key, READ_URL_TTL_SECONDS_MODERATION),
						);
					} catch {
						// R2 unavailable for this object → degrade to no image.
					}
				}),
		);
	}

	// PARENT SNIPPET: a reply carries a collapsed snippet of its parent's body —
	// but a `content_removed` parent must yield NO body. Intersect the parent
	// lookup with the SAME `content_removed` masking the main query anti-joins,
	// via the shared `loadRemovedSet` predicate; a removed parent's body is never
	// even read from the DB (only LIVE parent ids are fetched).
	const parentIds = [
		...new Set(
			page
				.map((r) => r.parentCommentId)
				.filter((id): id is string => id !== null),
		),
	];
	const removedParents =
		parentIds.length > 0
			? await loadRemovedSet(db, parentIds)
			: new Set<string>();
	const snippetByParent = new Map<string, string>();
	const liveParentIds = parentIds.filter((id) => !removedParents.has(id));
	if (liveParentIds.length > 0) {
		const parents = await db
			.select({ id: comments.id, body: comments.body })
			.from(comments)
			.where(inArray(comments.id, liveParentIds));
		for (const p of parents) {
			snippetByParent.set(p.id, p.body.slice(0, PARENT_SNIPPET_MAX));
		}
	}

	const authorIds = [...new Set(page.map((r) => r.authorUserId))];

	// DHARMA: the author's current balance = the latest ledger row by the A2
	// total-order `seq` (ADR-0029), one DISTINCT ON per author (no N+1).
	const dharmaByUser = new Map<string, string>();
	if (authorIds.length > 0) {
		const balances = await db
			.selectDistinctOn([dharmaLedger.userId], {
				userId: dharmaLedger.userId,
				balanceAfter: dharmaLedger.balanceAfter,
			})
			.from(dharmaLedger)
			.where(inArray(dharmaLedger.userId, authorIds))
			.orderBy(dharmaLedger.userId, desc(dharmaLedger.seq));
		for (const b of balances) dharmaByUser.set(b.userId, b.balanceAfter);
	}

	// PRIOR-FLAG COUNT: how many mod_actions have targeted this author (gate
	// blocks + bans; `content_removed` rows carry no target_user_id).
	const flagByUser = new Map<string, number>();
	if (authorIds.length > 0) {
		const counts = await db
			.select({
				userId: modActions.targetUserId,
				count: sql<number>`count(*)::int`,
			})
			.from(modActions)
			.where(inArray(modActions.targetUserId, authorIds))
			.groupBy(modActions.targetUserId);
		for (const c of counts) {
			if (c.userId !== null) flagByUser.set(c.userId, c.count);
		}
	}

	const rows: ReviewFeedRow[] = page.map((r) => ({
		id: r.id,
		kind: r.parentCommentId !== null ? "reply" : "post",
		parent:
			r.parentCommentId === null
				? null
				: removedParents.has(r.parentCommentId)
					? { removed: true }
					: {
							removed: false,
							snippet: snippetByParent.get(r.parentCommentId) ?? "",
						},
		marketId: r.marketId,
		marketSlug: r.marketSlug,
		marketTitle: r.marketTitle,
		marketStatus: r.marketStatus,
		side: r.sideAtPostTime,
		body: r.body,
		imageUrl: imageUrlByComment.get(r.id) ?? null,
		hasImage: r.imageUploadsId !== null,
		authorUserId: r.authorUserId,
		authorPseudonym: r.authorPseudonym,
		authorDharma: dharmaByUser.get(r.authorUserId) ?? "0",
		authorBanned: r.authorBannedAt !== null,
		priorFlagCount: flagByUser.get(r.authorUserId) ?? 0,
		createdAt: r.createdAt,
		// v1: provably empty (see ReviewFeedRow.categoryScores — D-3/rider).
		categoryScores: [],
	}));

	return { rows, cap, truncated, nextCursor };
}
