import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { BookmarkCard } from "@/components/bookmarks/BookmarkCard";
import { Badge } from "@/components/ui/badge";
import { db } from "@/db";
import { auth } from "@/server/auth";
import { loadBookmarks } from "@/server/bookmarks/list";

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
		<main className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-6">
			<div className="flex flex-wrap items-center gap-2">
				<h1 className="font-semibold text-ink text-lg">Bookmarks</h1>
				<Badge variant="outline">Your bookmarks</Badge>
			</div>
			{items.length === 0 ? (
				<p
					data-testid="bookmarks-empty"
					className="py-8 text-center text-n5 text-sm"
				>
					No bookmarks yet.
				</p>
			) : (
				<div data-testid="bookmark-list" className="flex flex-col gap-3">
					{items.map((item) => (
						<BookmarkCard key={item.id} item={item} />
					))}
				</div>
			)}
		</main>
	);
}
