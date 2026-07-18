import "server-only";

import { and, asc, eq, inArray, isNull } from "drizzle-orm";

import type { DbClient, DbTransaction } from "@/db";
import { comments } from "@/db/schema";
import { type PostSubstrate, type Side, topOrder } from "@/lib/ranking";
import {
	deriveTitleTeaser,
	loadRemovedSet,
} from "@/server/debate-view/load-debate-view";
import { loadRankingSubstrate } from "@/server/debate-view/ranking-substrate";
import {
	type AuthorIdentity,
	resolveAuthors,
} from "@/server/debate-view/resolve-authors";

/** A bound read client — top-level `db` OR a caller's transaction. */
type DiscoveryReader = DbClient | DbTransaction;

/**
 * Defensive author fallback — mirrors the `loadDebateView` posture (every
 * `comments.user_id` is a real `users` row, so this is unreachable in
 * practice; it keeps a single missing identity from 500-ing the public
 * Discovery render). Carries no real pseudonym — never a leak.
 */
const UNKNOWN_AUTHOR: AuthorIdentity = {
	pseudonym: "—",
	pfpUrl: "/pfp-placeholder.svg",
};

/**
 * A hero panel's top post (SPEC.1 §22 F-DISC-2). ALWAYS a non-removed post —
 * a Track-B-hidden post is ineligible and skipped entirely, so no masked
 * union variant exists on this DTO (there is nothing to mask; the removed
 * post's body/author are never even read). `ordinal` is the permanent
 * 1-based deep-link rank (`/m/[slug]?post=N`, UI.A2 / OQ-4 A).
 */
export type HeroPost = {
	id: string;
	ordinal: number;
	side: Side;
	title: string;
	teaser: string;
	author: AuthorIdentity;
	authorStake: string;
	createdAt: string;
};

export type HeroTopPosts = { yes: HeroPost | null; no: HeroPost | null };

/**
 * The Discovery hero's top post per side (SPEC.1 §22 F-DISC-2; plan §3,
 * OQ-3 = B — the LEAN selector): `loadRankingSubstrate` → the pure §9
 * **Top** order (`topOrder` — NOT `buildTopList`: the ADR-0017 P2
 * latest-interleave is display cadence below the top slot and must not
 * influence the hero pick; F-DISC-2 pins "the highest-ranked post on each
 * side under the §9 Top order") → per side, the FIRST post not in
 * `loadRemovedSet` — the SAME masking primitive F-DEBATE-1's debate view
 * enforces (extracted-and-exported, never re-implemented; `content_removed`
 * ONLY — a ban removes voice, not past content, ADR-0021 §4). A side with no
 * eligible post is `null`, never a placeholder.
 *
 * **Masking is safety-critical:** body, author identity, and title/teaser
 * are resolved ONLY for the ≤2 picked (non-removed) posts — a Track-B-hidden
 * post's argument or author cannot serialize into this DTO because it is
 * never read. Read-only; viewer-independent (the public render, no session).
 */
export async function selectHeroTopPosts(
	client: DiscoveryReader,
	marketId: string,
): Promise<HeroTopPosts> {
	const substrate = await loadRankingSubstrate(client, { marketId });
	if (substrate.length === 0) {
		return { yes: null, no: null };
	}

	const removedSet = await loadRemovedSet(
		client,
		substrate.map((s) => s.id),
	);

	const ordered = topOrder(substrate);
	const pick = (side: Side): PostSubstrate | null =>
		ordered.find((p) => p.parentSide === side && !removedSet.has(p.id)) ?? null;
	const yesPick = pick("YES");
	const noPick = pick("NO");
	if (!yesPick && !noPick) {
		return { yes: null, no: null };
	}

	// Body + author for the PICKED (non-removed) posts only.
	const pickedIds = [yesPick, noPick]
		.filter((p): p is PostSubstrate => p !== null)
		.map((p) => p.id);
	const rows = await client
		.select({
			id: comments.id,
			userId: comments.userId,
			body: comments.body,
			createdAt: comments.createdAt,
		})
		.from(comments)
		.where(inArray(comments.id, pickedIds));
	const rowById = new Map(rows.map((r) => [r.id, r]));
	const authorMap = await resolveAuthors(
		client,
		rows.map((r) => r.userId),
	);

	// The deep-link ordinal domain: ALL top-level comments, removed INCLUDED
	// (append-only ⇒ permanent), ranked (created_at, id) ASC — the EXACT
	// Postgres order `resolvePostParam` resolves against (congruence by
	// construction; never a JS Date re-sort, which would truncate to ms).
	const ordinalRows = await client
		.select({ id: comments.id })
		.from(comments)
		.where(
			and(eq(comments.marketId, marketId), isNull(comments.parentCommentId)),
		)
		.orderBy(asc(comments.createdAt), asc(comments.id));
	const ordinalById = new Map(ordinalRows.map((r, i) => [r.id, i + 1]));

	const toHeroPost = (p: PostSubstrate | null): HeroPost | null => {
		if (!p) {
			return null;
		}
		const row = rowById.get(p.id);
		if (!row) {
			// Unreachable (the substrate derives from comments) — defensive null
			// rather than a 500 on the public render.
			return null;
		}
		const { title, teaser } = deriveTitleTeaser(row.body);
		return {
			id: p.id,
			ordinal: ordinalById.get(p.id) ?? 0,
			side: p.parentSide,
			title,
			teaser,
			author: authorMap.get(row.userId) ?? UNKNOWN_AUTHOR,
			authorStake: p.authorStake,
			createdAt: row.createdAt.toISOString(),
		};
	};

	return { yes: toHeroPost(yesPick), no: toHeroPost(noPick) };
}
