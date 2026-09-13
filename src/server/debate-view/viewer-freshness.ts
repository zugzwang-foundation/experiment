import "server-only";

import { and, desc, eq } from "drizzle-orm";

import type { DbClient, DbTransaction } from "@/db";
import { comments } from "@/db/schema";

/**
 * CACHE-KEY-1 (ADR-0051) — when did THIS viewer last post in THIS market?
 *
 * ⛔⛔ WHAT THIS EXISTS TO REPLACE IS AN ACCIDENT, AND THAT IS THE WHOLE POINT.
 * Every comment rides a bet (**INV-1**), and until CACHE-KEY-1
 * `getCachedDebateView` was keyed on the pool reserves. So posting moved the
 * pool, changed the key, forced a miss, and the author's own `router.refresh()`
 * came back carrying their comment. **That behaviour was real, load-bearing and
 * written down nowhere** — it was a side effect of a cache key, and it
 * disappears the moment the key becomes a clock.
 *
 * ⚠ AND IT DOES NOT DEGRADE GRACEFULLY WHEN IT GOES. The author does not see
 * their argument "late"; they see NOTHING. `DebateView`'s `landed` fires on the
 * refreshed payload's object identity — which changes on a cache HIT too, since
 * the RSC payload is deserialized afresh — and then `findPostedNode` searches a
 * model that does not contain the comment and returns `null`. No jump, no card,
 * no error: the silent branch designed for a comment REMOVED between submit and
 * refresh, reached instead by an ordinary successful post.
 *
 * ⇒ So `/m/[slug]` asks this question and, for a viewer who posted inside the
 * last `SHARED_VIEW_MIN_WINDOW_MS`, calls `loadDebateView` DIRECTLY instead of
 * the cached wrapper.
 *
 * ⛔ WHY A BYPASS AND NOT AN OPTIMISTIC RENDER, which is the obvious answer and
 * is the one this codebase has already rejected in writing. `find-posted.ts`
 * spells it out: the `place()` receipt carries neither `ordinal` (a read-time
 * rank over EVERY top-level comment in the market), nor `badge` (a full ADR-0017
 * ranking pass), nor `entryPrice` (`price_at_bet`, the price PAID — the receipt
 * holds `newPrice`, the price AFTER). Three fields a reconstruction gets wrong,
 * **and no jsdom test in this repo could tell**. A confirmation showing a wrong
 * ordinal teaches the author to distrust the surface. So the post stays FOUND,
 * in the real read model, and this function only decides which read produced it.
 *
 * ⛔ NOTHING VIEWER-SCOPED REACHES THE CACHE BECAUSE OF THIS. The cached
 * function's signature SHRANK to one market argument at CACHE-KEY-1; the viewer
 * is read on the page, outside the boundary, exactly where
 * `loadViewerMarketContext` already is. The page CHOOSES a function — it does
 * not pass a viewer into one.
 *
 * ⚠ THE TIME BOUND IS THE WHOLE SAFETY ARGUMENT, not a nicety. Compare-against-
 * the-model's-newest-comment would be the precise test and it is the wrong one:
 * a comment REMOVED seconds after posting is absent from the cached model AND
 * from an uncached re-read, so a content comparison would pin the bypass on for
 * that viewer forever. A clock cannot do that. The bypass costs at most one
 * window of uncached renders per post, per viewer, and then stops on its own.
 *
 * ⚠ IT READS NO BODY — `created_at` ONLY — so SC-1 (CLAUDE.md §5.14) has
 * nothing to bite on here. That is not an exemption from removal masking; it is
 * the absence of anything to mask. Whichever read this function's answer
 * selects, `loadDebateView` and `getCachedDebateView` both apply
 * `loadRemovedSet` inside themselves, upstream of every DTO, unchanged.
 * Deliberately NOT filtered on removal for the same reason: a removed comment
 * still means "this viewer just posted", and excluding it would send the author
 * back to the cached model to look for something the uncached one is equally
 * right to withhold.
 *
 * One statement, served by `comments_user_id_idx` and bounded to one user's
 * rows in one market. Read-only. `null` when this viewer has never posted here
 * — the common case, and the whole cost for a reader who is only reading.
 */
export async function loadViewerLatestCommentAt(
	client: DbClient | DbTransaction,
	args: { userId: string; marketId: string },
): Promise<Date | null> {
	const rows = await client
		.select({ createdAt: comments.createdAt })
		.from(comments)
		.where(
			and(
				eq(comments.userId, args.userId),
				eq(comments.marketId, args.marketId),
			),
		)
		.orderBy(desc(comments.createdAt))
		.limit(1);

	return rows[0]?.createdAt ?? null;
}

/**
 * The decision itself, extracted so it is testable without a database and
 * without a clock — `now` is an argument for exactly that reason (the
 * `utcDayOf` posture in `dharma/accrual.ts`).
 *
 * ⚠ STRICTLY `<`, so the boundary instant falls OUTSIDE the bypass. Which side
 * of the boundary a millisecond lands on is not important on its own; having
 * the test and the code agree about it is, and an inequality is the cheapest
 * place for the two to disagree silently.
 */
export function postedWithinWindow(
	latestCommentAt: Date | null,
	now: number,
	windowMs: number,
): boolean {
	return latestCommentAt !== null && now - latestCommentAt.getTime() < windowMs;
}
