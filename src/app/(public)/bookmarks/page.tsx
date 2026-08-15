import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { BookmarkCard } from "@/components/bookmarks/BookmarkCard";
import { PageContainer } from "@/components/shell/PageContainer";
import { Badge } from "@/components/ui/badge";
import { EmptyBlock } from "@/components/ui/empty-block";
import { db } from "@/db";
import { auth } from "@/server/auth";
import { loadBookmarks } from "@/server/bookmarks/list";

/** W2.11 P1 copy — web-authored, carried VERBATIM from the state-kit mockup's
 *  "Empty Bookmarks · id 18" block (`:198`, `:199`), ratified as OD-1. Tests
 *  import these; they are never re-typed inline. */
export const BOOKMARKS_EMPTY_COPY = {
	msg: "No bookmarks yet.",
	sub: "Saved arguments will appear here.",
} as const;

/**
 * The /bookmarks surface (ADR-0032 D-5 / D-6; plan §3.3), composed into the
 * ADR-0023 `(public)/` shell. The session user's saved pointers at OTHER
 * authors' arguments, rendered in FORCED-VISITOR mode: list titled "Bookmarks,"
 * a "Your bookmarks" chip, NO Sell mount ever (every item is someone else's
 * content by D-3), each card's bookmark icon ACTIVE (un-bookmark).
 *
 * AUTH-GATED: there is no anonymous bookmark set, so an anonymous visitor is
 * redirected to /sign-in. `viewerId` is ALWAYS `session.user.id` — never a
 * client-supplied value — and `loadBookmarks` scopes the read `WHERE
 * user_id = $viewer`, so a viewer only ever sees their OWN bookmarks. UNCACHED /
 * dynamic v1 (§7 S1 — `cacheComponents` absent; the retrofit rides the named
 * foundational follow-up). Content masking + author scrub are applied inside
 * `loadBookmarks` before any DTO crosses to the client (D-7).
 */
export default async function BookmarksPage(): Promise<React.JSX.Element> {
	const session = await auth.api.getSession({ headers: await headers() });
	const viewerId = session?.user?.id;
	if (!viewerId) {
		redirect("/sign-in");
	}

	const items = await loadBookmarks(db, { viewerId });

	return (
		/* ⚠⚠ ROUND 3 C1 — THE WIDE CONTAINER. Founder-ruled: `/bookmarks` takes the
		   Profile arrangement as it ships on `main`. `wide` is the preset Profile
		   uses (`u/[pseudonym]/page.tsx:139`) and it is CONSUMED here, never
		   re-minted — `PageContainer.tsx` is read-only this round.
		   ⛔ `reading` (max-w-3xl px-4) cannot hold a two-column arena: it caps at
		   768, which is BELOW the `lg` breakpoint at which the arena is allowed to
		   become two columns at all, so the surface would render its two-column
		   layout at its own minimum on every screen and never widen — the measured
		   defect HTML-FINISH row 20 minted `wide` to fix on Profile.
		   ⚠ `flex min-h-0 flex-1 flex-col gap-6` is byte-carried from Profile's
		   call site (`:140`) minus the `lg:` one-screen pair, which lands at C7. */
		<PageContainer preset="wide" className="flex min-h-0 flex-1 flex-col gap-6">
			<div className="flex flex-wrap items-center gap-2">
				<h1 className="font-semibold text-ink text-lg">Bookmarks</h1>
				<Badge variant="outline">Your bookmarks</Badge>
			</div>
			{items.length === 0 ? (
				<EmptyBlock
					message={BOOKMARKS_EMPTY_COPY.msg}
					messageTestId="bookmarks-empty"
					sub={BOOKMARKS_EMPTY_COPY.sub}
				/>
			) : (
				<div data-testid="bookmark-list" className="flex flex-col gap-3">
					{items.map((item) => (
						<BookmarkCard key={item.id} item={item} />
					))}
				</div>
			)}
		</PageContainer>
	);
}
