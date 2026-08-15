import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { BookmarksArena } from "@/components/bookmarks/BookmarksArena";
import { BOOKMARKS_COPY } from "@/components/bookmarks/copy";
import { ProfileGraph } from "@/components/profile/graph/ProfileGraph";
import { IdentityCard } from "@/components/profile/IdentityCard";
import { PageContainer } from "@/components/shell/PageContainer";
import { db } from "@/db";
import { auth } from "@/server/auth";
import { loadBookmarks } from "@/server/bookmarks/list";
import { loadProfileGraphSeries } from "@/server/profile/graph-series";
import { loadProfilePositions } from "@/server/profile/positions";
import { resolveProfileUser } from "@/server/profile/resolve";
import { loadProfileTiles } from "@/server/profile/tiles";

/** Re-exported under its original name so POLISH.6's tests and any other
 *  consumer keep their handle; the strings themselves moved to `copy.ts`
 *  byte-unchanged, where every string on this surface now names its source. */
export const BOOKMARKS_EMPTY_COPY = BOOKMARKS_COPY.empty;

/**
 * The /bookmarks surface (ADR-0032; plan §3.3), composed into the ADR-0023
 * `(public)/` shell. The session user's saved pointers at OTHER authors'
 * arguments.
 *
 * ⚠⚠ R2 — THE SURFACE IS THE PROFILE PAGE, and R1 got that wrong. R1 read the
 * arrangement off the SHIPPED PROFILE, which renders a plain list because recon
 * A-1 struck the replica there. Measured this round: that strike was taken on
 * **SPEC.1 §23's enumeration of the profile page**, and SPEC.1 names this route
 * exactly once — `:1665`, *"This surface hosts a bookmark mode at A6 (design-
 * canon ruling 1) — specified by A6's own ADR, not here."* The strike is
 * therefore SURFACE-BOUND and does not travel. The delegated spec, **ADR-0032
 * D-5**, rules the page *"reuses the Profile surface in forced-visitor mode"*
 * with *"the list retitled 'Bookmarks'"*; canon §6's **Bookmark** line says the
 * same in copy terms. Hence: top band, two-panel arena, table + replica.
 *
 * ⚠ THE TOP BAND IS THE VIEWER'S OWN RECORD, and asking "does `BookmarkItem`
 * carry it?" was the wrong question — it never could. The right question is
 * whether THIS ROUTE can render it, and it can: the page holds `viewerId`, and
 * the A5 loaders are exported and `{ userId }`-scoped. Calling them is not an
 * edit to `src/server/**`. Precedent on this very route: `(public)/layout.tsx`
 * `:67-74` already calls `getHeaderBalance(db, session.user.id)` and
 * `getHeaderPortfolio(db, session.user.id)` — which is where the header's
 * PORTFOLIO / BALANCE figures come from today.
 *
 * ⚠ `resolveProfileUser` takes a PSEUDONYM, not a userId — measured. The session
 * carries one (`session.user.pseudonym`, the Better Auth `additionalFields`
 * column `(public)/layout.tsx:69` already reads), so the identity card resolves
 * with no new lookup shape.
 *
 * ⚠⚠ FIVE READS ON A ROUTE THAT USED TO MAKE ONE — RECORDED, NOT HIDDEN. This
 * adds `loadProfilePositions`, `loadProfileTiles`, `loadProfileGraphSeries` and
 * `resolveProfileUser` beside `loadBookmarks`. Staging was diagnosed hours ago
 * exhausting the Supabase session-mode pooler at `pool_size: 15`, and more
 * concurrent reads per render is the axis that exhausts it. The profile page
 * already carries exactly this load, so this is parity rather than a new class
 * of cost — but it is the wrong direction while that defect is open, and it is
 * flagged for the founder rather than absorbed silently.
 *
 * AUTH-GATED: there is no anonymous bookmark set (ADR-0032 D-6). `viewerId` is
 * ALWAYS `session.user.id`, never client-supplied, and `loadBookmarks` scopes
 * the read `WHERE user_id = $viewer`. Masking + author scrub are applied inside
 * `loadBookmarks` before any DTO crosses to the client (D-7).
 */
export default async function BookmarksPage(): Promise<React.JSX.Element> {
	const session = await auth.api.getSession({ headers: await headers() });
	const viewerId = session?.user?.id;
	if (!viewerId) {
		redirect("/sign-in");
	}

	const [items, positions, graph] = await Promise.all([
		loadBookmarks(db, { viewerId }),
		loadProfilePositions(db, { userId: viewerId }),
		loadProfileGraphSeries(db, { userId: viewerId }),
	]);
	// Tiles inherit the positions rows (the FI-2 law: one holding, one value —
	// the tile never recomputes Đb), so this one follows rather than joins the
	// parallel batch, exactly as `u/[pseudonym]/page.tsx:62-70` orders it.
	const tiles = await loadProfileTiles(db, { userId: viewerId, positions });
	const viewerPseudonym = session?.user?.pseudonym ?? null;
	const viewer =
		typeof viewerPseudonym === "string"
			? await resolveProfileUser(db, viewerPseudonym)
			: null;

	return (
		/* The container and the height chain are R1's, ruled and unchanged: `wide`
		   + `flex min-h-0 flex-1 flex-col`, byte-carried from profile's call site,
		   with site 2's `now`/`movedBy` row in `page-container.test.ts` carrying
		   the ruling that authorises them. */
		<PageContainer preset="wide" className="flex min-h-0 flex-1 flex-col gap-4">
			{/* THE TOP BAND — two side-by-side columns, byte-carried from
			    `u/[pseudonym]/page.tsx:134` (`grid gap-6 lg:grid-cols-2`), including
			    the `lg:` breakpoint that page ruled FROM MEASUREMENT rather than
			    chose. The band deliberately does NOT grow: only the arena divides
			    the leftover height. */}
			<div
				data-testid="bookmarks-headzone"
				className="grid gap-6 lg:grid-cols-2"
			>
				{/* ⛔ THE IDENTITY CARD RENDERS ONLY IF THE VIEWER RESOLVES. It is the
				    viewer's OWN identity — this route is their private saved set
				    (ADR-0032 D-6), not a pseudonym-keyed public page, so there is no
				    conflict with canon §10 `C-BOOKMARKS-1` ground 2, which objects to
				    attributing ONE person's figures to a list of OTHER people's
				    arguments. These figures are the viewer's and are labelled as the
				    viewer's; the per-item figures in the arena remain each bookmarked
				    AUTHOR's, exactly as ruling 1 requires.
				    ⚠ `owner` is TRUE by construction: the subject IS the session user.
				    That is what makes the six tiles the viewer's own record, and it is
				    why tile 4 (`Arguments`) counts arguments the VIEWER authored —
				    `loadProfileTiles` counts by `userId`, which is the viewer. */}
				{viewer && <IdentityCard user={viewer} owner tiles={tiles} />}
				<ProfileGraph series={graph} />
			</div>
			{/* THE ARENA — `flex-1 min-h-0` is the growing element, and the two halves
			    share the headzone's `lg:` breakpoint, because a band that went
			    two-column while the arena below it stayed stacked would read as a
			    mistake. Byte-carried from `u/[pseudonym]/page.tsx:156-159`. */}
			<div
				data-testid="bookmarks-arena"
				className="grid min-h-0 flex-1 gap-6 lg:grid-cols-2"
			>
				<BookmarksArena items={items} />
			</div>
		</PageContainer>
	);
}
