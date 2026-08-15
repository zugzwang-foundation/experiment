import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { BookmarksArena } from "@/components/bookmarks/BookmarksArena";
import { ProfileGraph } from "@/components/profile/graph/ProfileGraph";
import { IdentityCard } from "@/components/profile/IdentityCard";
import { PageContainer } from "@/components/shell/PageContainer";
import { Badge } from "@/components/ui/badge";
import { db } from "@/db";
import { auth } from "@/server/auth";
import { loadBookmarks } from "@/server/bookmarks/list";
import { loadProfileGraphSeries } from "@/server/profile/graph-series";
import { loadProfilePositions } from "@/server/profile/positions";
import { resolveProfileUser } from "@/server/profile/resolve";
import { loadProfileTiles } from "@/server/profile/tiles";

/** W2.11 P1 copy — web-authored, carried VERBATIM from the state-kit mockup's
 *  "Empty Bookmarks · id 18" block (`:198`, `:199`), ratified as OD-1. Tests
 *  import these; they are never re-typed inline.
 *
 *  ⚠ ROUND 3 C3 — THE DEFINITION MOVED, THE EXPORT DID NOT. The empty arm now
 *  lives inside `BookmarksTable`, with the list it replaces, so the const moved
 *  there and is RE-EXPORTED here. ⛔ It is re-exported rather than re-typed:
 *  every existing importer keeps its handle, and the two strings still exist in
 *  exactly one place. */
export { BOOKMARKS_EMPTY_COPY } from "@/components/bookmarks/BookmarksTable";

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

	/* ⚠⚠ ROUND 3 C2 — THE TOP BAND. `/bookmarks` takes Profile's arrangement, and
	   Profile's headzone is [identity card + six tiles] | [graph]. All three
	   regions are VIEWER-KEYED, and the viewer's id is already in hand — so all
	   three have a loader and NONE is blocked.
	   ⛔ CALLING an existing exported loader is not an EDIT to `src/server/**`.
	   Nothing under `src/server/` is modified by this round; these four are the
	   same functions Profile's own page calls, with `viewerId` where Profile
	   passes the resolved profile user's id.
	   ⚠ THE PSEUDONYM COMES FROM THE SESSION, never from a param — this route has
	   no `[pseudonym]` segment and must not grow one. `resolveProfileUser` is the
	   shipped resolver and re-reads the CURRENT row, so a scrub or a ban shows
	   here exactly as it shows on `/u/…`.
	   ⚠ POSITIONS FIRST, THEN TILES — the FI-2 inheritance law Profile records at
	   `u/[pseudonym]/page.tsx:59-61`: one holding, one value. `loadProfileTiles`
	   takes the positions it must agree with rather than re-deriving them.
	   ⚠ COST, RECORDED NOT DISCOVERED: this adds four server reads to a route
	   that previously issued one. They run in ONE `Promise.all` with the
	   bookmarks read (tiles excepted, which must follow positions), so the
	   wall-clock cost is one round-trip, not four. */
	const [items, viewer, positions, graph] = await Promise.all([
		loadBookmarks(db, { viewerId }),
		resolveProfileUser(db, session?.user?.pseudonym ?? ""),
		loadProfilePositions(db, { userId: viewerId }),
		loadProfileGraphSeries(db, { userId: viewerId }),
	]);
	const tiles = await loadProfileTiles(db, { userId: viewerId, positions });

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
		   call site (`:140`).

		   ⚠⚠ C7 — THE ONE-SCREEN FIT, byte-carried whole from Profile's container.
		   The route occupies exactly the viewport below the header at `lg`+: no
		   page scrollbar, every region that can overflow scrolling INSIDE itself.
		   ⛔ THE FIGURE IS `<main>`'s OWN — `calc(100vh-60px-2px)` is byte-identical
		   to the floor `(public)/layout.tsx` already declares (60px is
		   `GlobalHeader`'s `h-[60px]` row, 2px its `border-y`), so `<main>`'s
		   `min-h` is satisfied EXACTLY and it never grows: header 62 + main
		   (100vh − 62) = 100vh. ⛔ `(public)/layout.tsx` is NOT touched — the bound
		   is scoped to this route's own container, exactly as Profile scoped it.
		   ⛔ `lg:flex-none` IS LOAD-BEARING, NOT TIDINESS. `flex-1` is
		   `flex: 1 1 0%` and a 0% basis WINS over `height` on the main axis — with
		   the height applied and `flex-1` still on, Profile measured the page STILL
		   scrolling (document 1577 against a 725 viewport). With `flex:none` the
		   basis returns to `auto` and the height binds.
		   ⚠ BELOW `lg` THE PAGE STILL GROWS AND SCROLLS, deliberately: the arena
		   stacks to one column there and cannot fit a short viewport. */
		<PageContainer
			preset="wide"
			className="flex min-h-0 flex-1 flex-col gap-6 lg:h-[calc(100vh-60px-2px)] lg:flex-none"
		>
			<div className="flex flex-wrap items-center gap-2">
				<h1 className="font-semibold text-ink text-lg">Bookmarks</h1>
				<Badge variant="outline">Your bookmarks</Badge>
			</div>
			{/* ⚠⚠ ROUND 3 C2 — THE HEADZONE, byte-carried from Profile's
			    (`u/[pseudonym]/page.tsx:257-266`): `grid gap-6 lg:grid-cols-2`, the
			    identity card (which renders the six tiles inside it) on the left and
			    the graph slot on the right. ⚠ The declared `lg:h-[256px]` is NOT here
			    yet — it is part of the height chain and lands at C7 with the
			    one-screen bound, exactly as Profile shipped them together.
			    ⚠ `owner` IS TRUE AND THAT IS NOT A GUESS: `/bookmarks` is auth-gated
			    and `viewerId` is always `session.user.id`, so the viewer IS the user
			    whose band this is. The visitor arm cannot occur on this route.
			    ⚠ ONE WART, NAMED NOT HIDDEN: `IdentityCard`'s owner arm renders a
			    Bookmark icon linking to `/bookmarks`, so on THIS route it is a
			    self-link. `src/components/profile/**` is read-only here, so it is
			    reported rather than special-cased — and a self-link is inert, not
			    broken.
			    ⛔ NOTHING IN THE BAND IS BLOCKED. Every region is viewer-keyed and
			    every loader exists; no region renders empty and none is flagged. */}
			<div
				data-testid="bookmarks-headzone"
				className="grid gap-6 lg:h-[256px] lg:grid-cols-2"
			>
				{/* ⚠ `resolveProfileUser` returns `ProfileUser | null` and the null is
				    kept rather than asserted away. It cannot occur for an onboarded
				    viewer — the route is auth-gated and Better Auth persists
				    `pseudonym` as a required user field — but a null here would mean
				    the identity genuinely could not be resolved, and the honest render
				    for that is NOTHING, not a fabricated card. The empty cell holds
				    the grid so the graph stays in its own column. */}
				{viewer === null ? (
					<div data-testid="bookmarks-identity-unresolved" />
				) : (
					<IdentityCard user={viewer} owner={true} tiles={tiles} />
				)}
				<ProfileGraph series={graph} />
			</div>
			{/* ⚠⚠ ROUND 3 C3 — THE ARENA BAND, byte-carried from Profile's
			    (`u/[pseudonym]/page.tsx:282-283`). The stacked card list is replaced
			    by Profile's five-column table inside a bordered panel; the EMPTY arm
			    moved inside that panel with it, so the state is framed rather than
			    floating bare in the page column.
			    ⚠ C6 FILLED THE SECOND CELL. `BookmarksArena` holds the shared
			    selection and returns a FRAGMENT, so both panels stay DIRECT children
			    of this grid and remain its two columns — and this band keeps its
			    className here, where the C7 height-chain guard reads it. */}
			<div
				data-testid="bookmarks-arena"
				className="grid min-h-0 flex-1 gap-6 lg:grid-cols-2"
			>
				<BookmarksArena items={items} />
			</div>
		</PageContainer>
	);
}
