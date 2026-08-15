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
		/* ⛔⛔ HTML-FINISH · BOOKMARKS — THE CONTAINER DOES NOT MOVE, AND THE
		   REASON IS A PIN, NOT A PREFERENCE. This round was to consume #337's
		   minted `wide` preset here and start the height chain from this tag.
		   Both are BLOCKED by one file: `tests/unit/shell/page-container.test.ts`
		   declares this call site as SITE 2 and asserts CLASS-SET EQUALITY of
		   `cn(preset, className)` against its verbatim `c5892bc` baseline
		   `mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-6`, and separately
		   pins the enumeration of ruled moves at `[5]` — profile's, and only
		   profile's. Changing the preset OR adding `flex-1 min-h-0` here reddens
		   both rows. That file is OUTSIDE this round's write allow-list, and its
		   own `now`/`movedBy` mechanism is how a deliberate move is recorded — the
		   same mechanism #337 used for site 5, in the same commit as the move.
		   ⇒ The move needs a ruling that extends the allow-list by that one file.
		   It is REFUSED here rather than worked around: reshaping the tag to dodge
		   the guard's regex would defeat the exact regression the guard exists to
		   catch. Asserted, by name, in
		   `tests/unit/design/bookmarks-height-chain.test.ts`. */
		<PageContainer preset="reading" className="flex flex-col gap-4">
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
