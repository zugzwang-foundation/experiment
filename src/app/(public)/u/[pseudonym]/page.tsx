import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { ProfileGraph } from "@/components/profile/graph/ProfileGraph";
import { IdentityCard } from "@/components/profile/IdentityCard";
import { ProfileArena } from "@/components/profile/ProfileArena";
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

		   ⚠⚠⚠ ROUND 5 item A — ONE-SCREEN FIT AT `lg`+, AND THIS IS THE NODE THAT
		   DOES IT. The founder ruled the profile route a one-screen design: no
		   page scrollbar, every region that can overflow scrolling INSIDE itself.
		   ⇒ THIS REVERSES RECON A-5 FOR THIS SURFACE ONLY. A-5 struck the mockup's
		   `html,body{overflow:hidden}` as a fixed-viewport prototype affordance;
		   the founder has now ruled the one-screen design IN. It is scoped HERE, on
		   the profile's own container — ⛔ `(public)/layout.tsx` is NOT touched, so
		   every other `(public)` surface keeps growing and scrolling exactly as
		   before.

		   ⛔ THE FIGURE IS `<main>`'s OWN, NOT A NEW ONE. `calc(100vh-60px-2px)` is
		   byte-identical to the floor `(public)/layout.tsx` already declares — 60px
		   is `GlobalHeader`'s `h-[60px]` row and 2px its `border-y`. Bounding the
		   container at exactly that figure satisfies `<main>`'s `min-h` EXACTLY, so
		   main never grows: header 62 + main (100vh − 62) = 100vh.

		   ⛔ `lg:flex-none` IS LOAD-BEARING, NOT TIDINESS — MEASURED. `flex-1` is
		   `flex: 1 1 0%`, and a 0% basis WINS over `height` on the main axis, so
		   the height alone did nothing: measured with `h-[calc(…)]` applied and
		   `flex-1` still on, the page still scrolled (document 1577 against a 725
		   viewport) and main was still 1515. With `flex:none` the basis returns to
		   `auto`, the height binds, and the page stops scrolling (document 725 ==
		   viewport 725, main 663).

		   ⚠ BELOW `lg` THE PAGE STILL GROWS AND SCROLLS, deliberately. The arena
		   stacks to one column there and cannot fit a short viewport; the mockup is
		   a fixed-desktop prototype and declares no breakpoint at all. So `flex-1
		   min-h-0` stays unprefixed and only the `lg:` pair bounds.

		   ⛔ NOTHING IS LOST — a bound with a scroll is not a clip. Every bounded
		   region below keeps `overflow-y-auto`, and reachability was measured, not
		   assumed: at 1440 × {1080, 768, 600, 500, 360} every position row and
		   every argument is reachable by scrolling (`scrollIntoView` then intersect
		   the viewport) — ZERO unreachable at every height.
		   ⚠ AND THE FALLBACK IS THE RIGHT ONE. At absurd viewport heights (≲360)
		   the band alone exceeds the container; the container's overflow stays
		   `visible`, so the content spills and the PAGE scrolls to it — measured
		   zero unreachable there too. An `overflow-y-auto` safety was tried and
		   REJECTED: it buys nothing measurable and trades a page scrollbar nobody
		   sees at realistic heights for an inner one. */
		/* ⚠⚠ PROFILE-DIMS R2 · D-4 — THIS ROUTE TAKES THE `screen` PRESET.
		   Founder-ruled, and it is the SAME ruling `/m/[slug]` already runs on:
		   full bleed, `max-w-none px-7 py-4`.
		   ⛔ CONSUMED, NEVER RE-MINTED. `screen` already exists at
		   `PageContainer.tsx:108` — it arrived with #341 — so this round authors no
		   preset and leaves all six byte-identical. Site 5's row in
		   `page-container.test.ts` moves WITH this change, in the same commit, via
		   that guard's own `now`/`movedBy` mechanism.

		   ⛔ WHY `wide` WAS WRONG, AND WHAT I COULD AND COULD NOT MEASURE. `wide`
		   caps at `max-w-[1440px]`; the mockup's `.content` is full bleed inside a
		   28px inset (`:186`). At the pinned 1440 the cap is nearly invisible — the
		   container measured 1392 against the mockup's 1384 — but it BINDS above
		   it, and site 9's preset docblock records the measurement: at 1800 the
		   same band is 1744 (96.9%) full-bleed against 1392 (77.3%) capped, a
		   −19.6pp delta every region inside inherits.
		   ⚠ I COULD NOT OBSERVE THAT DIRECTLY — `screen.availWidth` on this display
		   is 1440, so a viewport wider than the cap cannot be produced in a real
		   browser here. That is a MEASUREMENT GAP, not evidence the cap is
		   harmless, and D-4 rules it either way.
		   ⇒ AT THE PINNED VIEWPORT THE EFFECT IS MEASURABLE AND IS AN IMPROVEMENT:
		   1392 → 1384, i.e. 96.7% → 96.1% of the viewport, and the mockup's is
		   96.1% — Δ 0.0pp.

		   ⚠ `gap-3`, NOT `gap-6` — the mockup's own literal: `.arena` carries
		   `margin-top:12px` (`:222`), and `/m/[slug]` pairs `screen` with `gap-3`
		   (`DebateView.tsx:512`). This hands 12px back to the arena band.

		   ⚠ `100dvh`, NOT `100vh` — the dynamic viewport unit, so a collapsing
		   mobile browser chrome cannot leave the bound taller than the visible
		   screen. `/m/[slug]` declares `h-[calc(100dvh-60px-2px)]` and its guard
		   carries a test named `the-page-declares-100dvh-and-NEVER-100vh`; this
		   route was the outlier. ⛔ THE FIGURE IS UNCHANGED — still `<main>`'s own
		   `60px + 2px` — so the arithmetic above still holds exactly.

		   ⛔ THE `lg:` SCOPING IS KEPT, AND IS DELIBERATELY NOT A COPY OF
		   `/m/[slug]`. That route bounds UNPREFIXED; this one must not, for the
		   reason the block above records — below `lg` the two bands stack and the
		   page must stay free to grow and scroll. D-4 rules the PRESET (the three
		   container axes), never another surface's content className. */
		<PageContainer
			preset="screen"
			className="flex min-h-0 flex-1 flex-col gap-3 lg:h-[calc(100dvh-60px-2px)] lg:flex-none"
		>
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
			{/* ⚠⚠⚠ ROUND 5 item B — THE BAND HEIGHT IS DECLARED, AND THE GRAPH NOW
			    FITS IT INSTEAD OF SETTING IT. This is the HARD COMMAND that three
			    earlier rounds refused, and what unblocked it was the founder opening
			    `graph/ProfileGraphCard.tsx` to a sizing-only fence: its
			    `aspect-[2/1] w-full` is what made the card's height
			    `(colWidth − 32)/2 + 32`, i.e. the reason the GRAPH set the band. It
			    is now `h-full w-full` on a `min-h-0` card, so the card fills its
			    cell. See that file for the two-token diff and what was NOT touched.

			    ⛔ 256px IS DERIVED FROM THE IDENTITY CARD, NOT COPIED. The mockup's
			    band is `flex:0 0 188px` (`:189`) and is NOT the source. Measured
			    live against real compiled CSS on the shipped surface with real data,
			    `1fr 1fr` restored, taking the identity card's INTRINSIC height with
			    the grid stretch removed (`align-self:start`) and sweeping the band
			    height for the smallest value at which its content fits:

			      vw     smallest band height that fits the identity card + tiles
			      1024        256   ← the binding case: tiles 370×184, tile 115 wide
			      1280        256
			      1440        216
			      1920        216

			    ⇒ ONE NUMBER FOR ALL OF `lg`+, so it is the WORST case: 256.
			    ⚠ SWEPT, NOT SPOT-CHECKED: every width from 1024 to 2560 in 16px
			    steps was measured at 256 — ZERO breaks, worst case 255 of 256 used.
			    ⚠ AND ROBUST TO THE DATA: re-measured with `Đ 999,999` in every tile,
			    the identity card still needs 255 at 1024 and 254 at 1440/1920. The
			    tile grid's height is driven by its fixed LABEL copy wrapping, not by
			    the value widths, so a large balance cannot break the band.

			    ⇒ WHAT THE FOUNDER ASKED FOR, IN PIXELS — the band SHRINKS and every
			    pixel goes to the arena:
			      1024   258 → 256   (−2)
			      1440   358 → 256   (−102)
			      1920   478 → 256   (−222)

			    ⛔ `lg:`-SCOPED, NOT UNCONDITIONAL. Below `lg` the two bands stack to
			    one column and the identity card sits above a full-width graph; a
			    256px cap there would crush both. The page still grows and scrolls
			    below `lg` (item A), so no height is declared there.
			    ⛔ THE EQUAL SPLIT STAYS. Round 3's `3fr 2fr` was the wrong lever and
			    was reverted at round 4; `1fr 1fr` is the mockup's (`:189`). */}
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
			    it" was therefore not reachable AT ROUND 4.
			    ✅ DISCHARGED AT ROUND 5, and the round-4 note above called it: "the
			    fix has to land inside the graph card, not beside it." The founder
			    opened `ProfileGraphCard.tsx` under a sizing-only fence, the
			    `aspect-[2/1]` is gone, and the band height IS declared — see the
			    round-5 block above. This paragraph is kept because it is the
			    measurement that proved WHERE the blocker was, and a reader who meets
			    `lg:h-[256px]` should be able to find out why three rounds could not
			    write it. ⛔ It is no longer a live refusal. */}
			{/* ⚠⚠⚠ D-1 · THE MOCKUP'S 188px BAND IS UNREACHABLE, AND THAT IS AN
			    ACCEPTED, FOUNDER-RULED COST — recorded HERE, on the node that
			    diverges, so it is a named cost with its measurement rather than a
			    silent divergence. (Same posture as `/m/[slug]`'s truncated market
			    question: "THE TRUNCATION IS A REAL COST AND IT IS REPORTED, NOT
			    SMOOTHED OVER", `MarketHeader.tsx:206`.)

			    THE MOCKUP SAYS 188. `.headzone{flex:0 0 188px}` (`:189`) is a
			    LITERAL, and §2 says copy a literal. This band is **256**.

			    ⛔ IT DOES NOT FIT, AND THE MEASUREMENT IS WHY. Measured live at a
			    pinned 1440×777, sweeping the container width across `lg`+ with the
			    band left at its natural height:

			      width   tile w × h    tiles block   unamerow   idcol NEEDS
			      1024    115 × 86      370 × 184     44         240
			      1152    137 × 86      434 × 184     44         240
			      1280    158 × 86      498 × 184     44         240
			      1440    185 × 66      578 × 144     44         200

			    A 188px band leaves the identity card `188 − 16` = **172px** of
			    content box. It needs **240 at 1024–1280** and **200 at 1440**.
			    ⇒ MECHANISM: the tile LABEL wraps to a second line at every tile
			    width ≤158px — every container below 1440 — taking each tile 66 → 86
			    and the block 144 → 184. 256 is the DERIVED worst case, not a
			    preference.

			    ⛔ AND THE PFP IS THE SAME IMPOSSIBILITY, NOT A SECOND ONE. The
			    mockup's `.pfp` is `height:100%; aspect-ratio:1/1` — a 188×188 square
			    filling the band (13.1% × 24.2% of the viewport). This ships 56×56
			    (3.9% × 7.2%). With the square restored at a 188 band the card
			    overflows by **+75 at 1024**, +47 at 1152, +35 at 1280 and 1440.
			    ⇒ Band +8.7pp, PFP −17.0pp and arena −12.6pp are ONE impossibility
			    reported three ways, and they close together or not at all.

			    ⛔ FORCING IT WOULD CLIP, AND CLIPPING TO HIT A NUMBER IS A FAILURE
			    (§1). §3 likewise: do not shrink a card or an image below what the
			    mockup shows to make a total work — report the conflict. The three
			    ways out are all outside this task's fence and are the founder's:
			    (1) let the tile grid drop to 2 columns below ~1312 — canon §2 pins
			    3×2, a DESIGN change; (2) scope the square above a width — an
			    invented breakpoint; (3) shorten the tile LABEL copy — §1 bans copy.

			    ⚠ AND THE MOCKUP CANNOT ARBITRATE IT. It is a fixed-desktop
			    prototype authored at ONE width, and its own tile labels are **8px**
			    type (`.tile .tl{font-size:8px}`, `:208`) against this build's
			    ratified `text-xs`. Its 188 is proven at exactly one viewport; this
			    build must hold every width from `lg` up. That is §2's own warning —
			    "its px reproduce only at that width" — landing on the single most
			    load-bearing literal the mockup has.

			    ⇒ RULED UNREACHABLE (D-1). ⛔ Do not "fix" this to 188. What the
			    ruling DOES permit was closed in the same round: the container took
			    the `screen` preset (width 96.7% → 96.1%, the mockup's exactly) and
			    the band→arena gap took the mockup's 12px, handing the arena back
			    every pixel that was available to give. */}
			<div
				data-testid="profile-headzone"
				className="grid gap-6 lg:h-[256px] lg:grid-cols-2"
			>
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
				{/* ROUND 4 item 7 — THE TWO PANELS SHARE ONE SELECTION, so the holder
				    sits between this band and them. It renders a FRAGMENT: both
				    panels stay direct children of this grid and remain its two
				    columns, and this band keeps its className here where the height
				    chain reads it.
				    HTML-FINISH row 4 — the head cluster's identity. Every argument in
				    the list is authored by the profile user, so the avatar and
				    pseudonym come from the ALREADY-RESOLVED `profileUser` rather than
				    from a per-item field: `loadProfileArguments` is untouched and no
				    new read is issued — by this row or by item 7, which renders only
				    fields the list already carries. */}
				<ProfileArena
					positions={positionsPayload}
					argumentItems={argumentItems}
					owner={owner}
					author={profileUser}
					initialMarketSlug={initialMarketSlug}
				/>
			</div>
		</PageContainer>
	);
}
