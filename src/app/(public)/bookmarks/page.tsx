import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { BookmarkCard } from "@/components/bookmarks/BookmarkCard";
import { BookmarksPanel } from "@/components/bookmarks/BookmarksPanel";
import { PageContainer } from "@/components/shell/PageContainer";
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
		/* HTML-FINISH · BOOKMARKS R1 — THE CONTAINER MOVES, ON A RULING.
		   The previous round REFUSED this edit and recorded why: the tag is SITE 2
		   of `tests/unit/shell/page-container.test.ts`, which asserts class-set
		   equality against its verbatim `c5892bc` baseline and pins the
		   enumeration of ruled moves; that file sat outside the write allow-list,
		   so the move was a ruling rather than an edit. The founder ruled it on
		   2026-08-15 and extended the allow-list by exactly that one file. The
		   guard's own `now`/`movedBy` mechanism carries the move — the same
		   mechanism #337 used for site 5, in the same commit as the move.

		   ⛔ THE VALUES ARE BYTE-CARRIED FROM PROFILE'S OWN CALL SITE ON THIS
		   BRANCH (`u/[pseudonym]/page.tsx`'s container tag), not retyped: the
		   `wide` preset and `flex min-h-0 flex-1 flex-col`. `wide` is
		   `max-w-[1440px] px-6 py-6`, itself byte-carried from
		   `GlobalHeader.tsx` at #337 — so this surface aligns to the same chrome
		   Profile does, and nothing is read off a mockup.

		   ⚠ `gap-4` IS THIS SURFACE'S OWN AND DELIBERATELY DOES NOT MOVE TO
		   PROFILE'S `gap-6`. The ruling names three changes — the preset and the
		   two chain classes — and a gap is CONTENT layout, neither a container
		   axis nor a chain link. It is also inert here either way: the arena is
		   ONE panel, so there is no sibling for a gap to space. Moving it would be
		   an unrequested value change wearing the shape of a ruled one. */
		<PageContainer preset="wide" className="flex min-h-0 flex-1 flex-col gap-4">
			{/* HTML-FINISH · BOOKMARKS — the arena panel. The header row that used
			    to sit here MOVED into the panel's header bar (it is the same pair,
			    relocated, never copied); the list and the empty state are now the
			    panel BODY's children, which is where Profile's two halves put
			    theirs. See `BookmarksPanel.tsx` for the per-token trace and for
			    why this surface has ONE panel where Profile has two. */}
			<BookmarksPanel>
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
			</BookmarksPanel>
		</PageContainer>
	);
}
