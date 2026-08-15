import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { ArgumentList } from "@/components/profile/ArgumentList";
import { ProfileGraph } from "@/components/profile/graph/ProfileGraph";
import { IdentityCard } from "@/components/profile/IdentityCard";
import { PositionsTable } from "@/components/profile/PositionsTable";
import { PageContainer } from "@/components/shell/PageContainer";
import { db } from "@/db";
import { auth } from "@/server/auth";
import { loadProfileArguments } from "@/server/profile/arguments";
import { loadProfileGraphSeries } from "@/server/profile/graph-series";
import { buildPositionsPayload } from "@/server/profile/owner-view";
import { loadProfilePositions } from "@/server/profile/positions";
import { resolveProfileUser } from "@/server/profile/resolve";
import { loadProfileTiles } from "@/server/profile/tiles";

/**
 * The participant profile surface (SPEC.1 §23 / F-PROF-1) — the permanent
 * public accountability page at `/u/[pseudonym]`, composed into the ADR-0023
 * `(public)/` shell. RSC: resolve the CURRENT `users.pseudonym` (D6 — a
 * pseudonym slug, never a raw UUID), `notFound()` on an unknown OR pre-scrub
 * name (the identity is retired; N-9). A scrubbed user resolves under the
 * placeholder pseudonym. Then assemble the read-time model — six tiles, the
 * Dharma graph, the cross-market positions table, the argument list (all
 * viewer-INDEPENDENT; masking is applied inside `loadProfileArguments` /
 * `loadProfilePositions` before any DTO crosses to the client) — and the
 * identity band's owner/visitor chip.
 *
 * Owner detection is `session.user.id === profileUser.id` — the owner deltas
 * are the identity chip + the owner-only Sell mount (F-PROF-3, via the
 * `buildPositionsPayload` owner arm). Public-read (not middleware-gated);
 * UNCACHED / dynamic v1 (§7 S1 — `cacheComponents` is absent; the retrofit
 * rides the named foundational follow-up). `params`/`searchParams` are Promises
 * (Next 16).
 */
export default async function ProfilePage({
	params,
	searchParams,
}: {
	params: Promise<{ pseudonym: string }>;
	searchParams: Promise<{ market?: string | string[] }>;
}) {
	const { pseudonym } = await params;
	// A malformed percent-encoding is an UNKNOWN pseudonym → 404 (never a 500):
	// `decodeURIComponent` throws URIError on `/u/%` or `/u/abc%2`, and the route
	// law is unknown → notFound (F-PROF-1).
	let decoded: string;
	try {
		decoded = decodeURIComponent(pseudonym);
	} catch {
		notFound();
	}
	const profileUser = await resolveProfileUser(db, decoded);
	if (profileUser === null) {
		notFound();
	}

	// The positions read is the tiles' `positionsValue` source (the FI-2
	// inheritance law — one holding, one value), so tiles follows it; the
	// remaining reads run in parallel with positions.
	const [positions, argumentItems, graph] = await Promise.all([
		loadProfilePositions(db, { userId: profileUser.id }),
		loadProfileArguments(db, { userId: profileUser.id }),
		loadProfileGraphSeries(db, { userId: profileUser.id }),
	]);
	const tiles = await loadProfileTiles(db, {
		userId: profileUser.id,
		positions,
	});

	const session = await auth.api.getSession({ headers: await headers() });
	const owner = session?.user?.id === profileUser.id;

	// F-PROF-3: the Sell affordance exists ONLY on the owner payload arm; the
	// visitor arm carries no `sellEligible` field (the DTO boundary).
	const positionsPayload = buildPositionsPayload(positions, owner);

	// OQ-5 B — the W2.10-C click-through preselects the positions market filter
	// via `?market=<slug>` (a slug, matched against the rows in PositionsTable;
	// an unknown/repeated value falls back to "all", never rendered raw).
	const { market } = await searchParams;
	const initialMarketSlug = typeof market === "string" ? market : undefined;

	return (
		/* HTML-FINISH row 20 — THE WIDTH. `wide` is minted additively in
		   `PageContainer.tsx`; the census and the byte-carry are recorded there.
		   The allow-list was extended by one path this round, so site 5's pin in
		   `tests/unit/shell/page-container.test.ts` moves WITH this change, in
		   the same commit, and records it as a deliberate move rather than
		   absorbing it into the `c5892bc` baseline that field is contracted to
		   hold verbatim. */
		/* HTML-FINISH row 3 / §4 — THE HEIGHT CHAIN STARTS HERE. `flex-1` takes
		   the height `<main>`'s `min-h-[calc(100vh-60px-2px)]` floor provides;
		   `min-h-0` is what lets the arena below shrink to it instead of pushing
		   past it, which is the difference between the positions panel scrolling
		   INSIDE itself and the whole page growing.
		   ⛔ `min-h-*`, never `h-*` (RULED A1): the floor is a FLOOR, so when the
		   headzone's own content exceeds the viewport the page still GROWS and
		   SCROLLS rather than clipping. Both hold at once — the page grows for
		   content that cannot scroll, the arena scrolls for content that can. */
		<PageContainer preset="wide" className="flex min-h-0 flex-1 flex-col gap-6">
			{/* HTML-FINISH row 1 — TWO BANDS OF TWO SIDE-BY-SIDE COLUMNS, replacing
			    five full-width sections stacked in one column. Canon §2 (Profile):
			    "Two bands. Top: identity card … + six account tiles … + the graph
			    slot. Bottom 'arena': Positions table … + the argument [list]".
			    The mockup's `.headzone` and `.arena` are both `grid-template-
			    columns:1fr 1fr` (`:189`, `:221-222`).
			    ⚠⚠ `lg:`, NOT `md:` — RULED FROM MEASUREMENT, NOT CHOSEN. The arena
			    is two columns ONLY where each half clears the positions table's
			    fixed-track requirement. Measured in a browser against real
			    compiled CSS, on the shipped table with real data:

			      fixed track (Position 64 + Staked 58 + arrow 31 + Current 61)
			                                                        = 214px
			      Argument column min-content                       = 115px
			      ⇒ a half that clears both needs a 329px table,
			        + 26px panel chrome (p-3 ×2 + hairline ×2)      = 355px
			      ⇒ two halves + the 24px gap + px-6 ×2             = 782px

			    At `md` (768) each half measured 356px and the Argument column
			    rendered at 117px against its own 115px min-content — pinned, with
			    nothing left to give, which is the eight-character symptom. `md`
			    therefore MEETS the track and never clears it. At `lg` (1024) the
			    same column gets ~244px.
			    ⛔ NO BREAKPOINT VALUE IS INVENTED: `lg` is a shipped token, already
			    used at `DiscoveryGrid.tsx:35`, `LoadingSkeleton.tsx:48` and
			    `SlotHeader.tsx:81`. Below it the two columns STACK — the posture
			    `HeroPanels.tsx:82` ships for Discovery's hero.
			    ⚠ The mockup contributes NOTHING here: it is a fixed-desktop
			    prototype and declares no breakpoint at all (recon A.4).
			    `gap-6` is the gap ALREADY on this container's className for the
			    same inter-section role; no new spacing value is introduced. */}
			{/* ⚠⚠ ROUND 4 item 3 — `3fr 2fr` REVERTED TO THE MOCKUP'S EQUAL SPLIT,
			    ON FOUNDER ORDER. Round 3 narrowed the graph column to stop the
			    graph's 2:1 aspect driving the band. The founder ruled that the wrong
			    lever: the mockup's `.headzone` is `grid-template-columns:1fr 1fr`
			    (`:189`) and this task exists to match the mockup's composition, so
			    the ratio goes back and the height was to be DECLARED instead.
			    ⛔⛔ THE DECLARED HEIGHT IS REFUSED ON MEASUREMENT — the other half of
			    item 3, and the refusal is about the GRAPH, not about the guard.
			    Measured live in a browser against real compiled CSS, on the shipped
			    surface with real data, at three container widths with `1fr 1fr`
			    restored (the identity card's INTRINSIC height taken with
			    `align-self:start`, i.e. with the grid stretch removed):

			      vw    identity needs   graph needs   overflow if the band is
			                                           declared at what identity needs
			      1024      258              258            0
			      1280      258              318           60
			      1440      218              358          140

			    ⇒ AT 1440 THE DECLARED HEIGHT IS 218 AND THE GRAPH STILL WANTS 358.
			    Declared at 218, the graph card does NOT fill the band and does NOT
			    shrink: it measures 684 × 358 with the band's clientHeight at 218 and
			    its scrollHeight at 358 — 140px of chart painting over the arena
			    (graph bottom 444 against arena top 328). The graph's height is
			    `(columnWidth − 32)/2 + 32` and it lives in
			    `graph/ProfileGraphCard.tsx`'s `aspect-[2/1] w-full`, which §1 puts
			    OUT OF BOUNDS (POLISH.5 PR C owns those symbols). From outside that
			    file the ONLY way to make the graph fit a shorter band is to cap its
			    WIDTH to 2H − 32 (404px at 1440, inside a 684px column) — which is
			    the column-narrowing lever this revert exists to undo, just moved
			    from the template into the cell.
			    ⇒ "The graph slot FILLS its cell at that height instead of driving
			    it" is therefore not reachable this round. REPORTED, NOT DODGED: no
			    height is declared, no `overflow-hidden` hides the spill, and the
			    band stays content-sized so nothing clips.
			    ⚠ NOTE FOR THE NEXT ROUND — at 1024 the band is ALREADY tile-derived
			    (258 = 258, exactly). The dead space the founder marked is a
			    ≥1280 phenomenon and is entirely the 2:1 aspect on a wide column, so
			    the fix has to land inside the graph card, not beside it. */}
			<div data-testid="profile-headzone" className="grid gap-6 lg:grid-cols-2">
				{/* HTML-FINISH row 8 — THE TILES MOVE INSIDE THE IDENTITY BLOCK, to
				    the right of the PFP and under the pseudonym row (mockup `:437`:
				    `.idcol` is `[.unamerow][.tiles]`). They are no longer a sibling
				    band, so `IdentityCard` renders them and this file no longer
				    mounts `ProfileTiles` directly. */}
				<IdentityCard user={profileUser} owner={owner} tiles={tiles} />
				<ProfileGraph series={graph} />
			</div>
			{/* The arena band — `lg:` for the same measured reason as the headzone
			    above, and the two bands MUST share one breakpoint or the identity
			    band would go two-column while the arena below it was still
			    stacked.
			    HTML-FINISH row 3 / §4 — THE GROWING ELEMENT. `flex-1 min-h-0` is
			    the mockup's `.arena{flex:1 1 auto; min-height:0}` (`:221-222`),
			    topology on both halves. The headzone deliberately does NOT grow —
			    it is `flex:0 0 188px` in the mockup, i.e. fixed, and here it is
			    content-height; only the arena divides the leftover.
			    ⚠ `min-h-0` is REQUIRED here and is not belt-and-braces: without
			    it this grid's automatic minimum size is its content, so the panels
			    would push the band past the container instead of scrolling
			    internally, and row 3 would have no bound to divide. */}
			<div
				data-testid="profile-arena"
				className="grid min-h-0 flex-1 gap-6 lg:grid-cols-2"
			>
				<PositionsTable
					payload={positionsPayload}
					initialMarketSlug={initialMarketSlug}
				/>
				{/* HTML-FINISH row 4 — the head cluster's identity. Every argument in
				    this list is authored by the profile user, so the avatar and
				    pseudonym come from the ALREADY-RESOLVED `profileUser` rather than
				    from a per-item field: `loadProfileArguments` is untouched and no
				    new read is issued. */}
				<ArgumentList
					items={argumentItems}
					owner={owner}
					author={profileUser}
				/>
			</div>
		</PageContainer>
	);
}
