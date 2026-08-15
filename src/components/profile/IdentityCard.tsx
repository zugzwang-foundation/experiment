import { Bookmark } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { ProfileUser } from "@/server/profile/resolve";
import type { ProfileTiles as ProfileTilesData } from "@/server/profile/tiles";

import { PROFILE_COPY } from "./copy";
import { ProfileTiles } from "./ProfileTiles";

/**
 * The profile identity band (SPEC.1 §23) — PFP + pseudonym + the owner/visitor
 * view chip. A `Banned` label (D8) shows for a banned user (visible to ALL). A
 * scrubbed user (H2 — the pseudonym is a bracketed placeholder like
 * `[scrubbed_user_4729]`) renders the scrubbed marker + the shared placeholder
 * avatar; NO PII (the DTO carries only the pseudonym, banned flag, and the
 * placeholder PFP — no email/name/googleId ever reaches this surface).
 *
 * The dedicated scrubbed-user silhouette asset is UNDEFINED (a brand ruling is
 * owed — values-log §278); v1 reuses the shared `pfp-placeholder.svg` (the same
 * avatar every identity shows until the R2 PFP builder is wired). Surfaced for
 * Gate C.
 */
export function IdentityCard({
	user,
	owner,
	tiles,
}: {
	user: ProfileUser;
	owner: boolean;
	/**
	 * HTML-FINISH row 8 — the six account tiles now live INSIDE this block
	 * (mockup `:437`: `.idcol` is `[.unamerow][.tiles]`), so the card owns them
	 * rather than standing beside them as a sibling band. Required, not optional
	 * (O-1): an optional `tiles` would let a call site silently drop the band.
	 */
	tiles: ProfileTilesData;
}): React.JSX.Element {
	const scrubbed = user.pseudonym.startsWith("[");

	return (
		<Card
			data-testid="identity-card"
			className="flex flex-row items-center gap-4 p-4"
		>
			{/* ⛔⛔ HTML-FINISH row 16 — REFUSED ON MEASUREMENT, AND THE MEASUREMENT
			    IS THE REASON. The row asks the PFP to "fill the identity band's
			    height as a square": the mockup's `.pfp` is `height:100%;
			    aspect-ratio:1/1; flex:0 0 auto` (`:191-193`). That was built —
			    `h-full aspect-square w-auto shrink-0 min-h-14` — and then measured
			    in a browser against real compiled CSS, in a viewport PINNED to
			    390px by a fixed-width same-origin iframe. It is a DEFECT:

			      WITH row 16      PFP 324 × 578 · idcol width 0 · tiles width 0
			                       (tile content clipped: scrollWidth 89 vs
			                       clientWidth 0) · card scrollWidth 445 > 356
			      WITHOUT row 16   PFP  56 ×  56 · idcol width 252 · tiles 252
			                       · card height 596 → 356, nothing clipped

			    THE PREMISE THE ROW RESTS ON IS ABSENT FROM THE BUILD. The mockup's
			    PFP fills a band that is `flex:0 0 188px` (`.headzone`, `:189`) —
			    a BOUNDED height. This build has no such bound: HTML-FINISH row 20
			    and the height chain are both HALTED (`tests/unit/design/
			    profile-height-chain.test.ts` states why), so `height:100%` here
			    resolves against a card whose height is driven by the TILE COLUMN
			    row 8 just put beside it. That is a feedback loop — taller tiles →
			    taller card → wider square → narrower column → taller tiles — and it
			    settles with the tiles at zero width and clipped by the Card's own
			    `overflow-hidden`.

			    ⛔ NOT SATISFIED LITERALLY WITH AN INVENTED BOUND. Capping the
			    growth needs a number, and the only number available is the mockup's
			    188px band — a light-prototype VALUE, and one that would be wrong
			    the moment the real band exists.
			    `object-cover` is kept — a FIT RULE, not a value (precedent
			    `HeroPanels.tsx:113`), and it is right for a square box regardless.

			    ⛔⛔ RE-ATTEMPTED IN ROUND 2 AND REFUSED AGAIN — ON THE PRECONDITION,
			    which is the cleaner refusal. Round 2 was authorised to retry this
			    "only after row 1's band actually has a DECLARED height". It has
			    none. The band is `grid gap-6 lg:grid-cols-2` — no `h-*`, no
			    `min-h-*`, no aspect. The ONLY thing in the whole headzone subtree
			    that produces a height is `graph/ProfileGraphCard.tsx:46`'s
			    `aspect-[2/1]`, which is a RATIO ON THE GRAPH'S OWN WIDTH — so the
			    band's height is a function of the column width and moves with the
			    viewport. Content-derived, never declared.

			    THAT IS THE SAME DEFECT AS ROUND 1, NOT A DIFFERENT ONE. `h-full`
			    resolves against this card, whose height is the grid row's, which is
			    `max(card content, graph content)`. On any viewport where the CARD
			    is the taller of the two, the round-1 feedback loop re-enters
			    unchanged — wider square → narrower identity column → taller tiles →
			    taller card → wider square — and round 1 measured where that
			    settles: PFP 324 × 578, identity column and tile band at ZERO width.
			    And where the GRAPH wins, the outcome is not "the PFP fills the
			    band" but "the PFP becomes the band": at 1440 the measured headzone
			    is 358px, so `h-full aspect-square` computes to a 326 × 326 avatar
			    beside six tiles squeezed into the remaining ~310px.

			    ⇒ ROUTED BACK, unchanged: this row becomes correct — with no new
			    value — only once the headzone has a height of its own. That is a
			    DESIGN decision about the band (the mockup's is `flex:0 0 188px`),
			    not something this row can supply for itself.

			    ⛔⛔ FOURTH ATTEMPT, ROUND 4 item 4 — REFUSED ON ITS OWN CLAUSE ("if
			    the tile column still collapses, REFUSE ITEM 4 ONLY and report the
			    numbers"). Round 4 restored the mockup's EQUAL split, which is the
			    fairest test this row has had: at `1fr 1fr` the identity column's
			    WIDTH no longer depends on the PFP at all. It collapses anyway,
			    through the row HEIGHT. Measured live against real compiled CSS:

			                item 3 revert only              + item 4 PFP
			      1024  band 258 · PFP 56 · idcol 370   band 378 · PFP 360 · idcol 66
			            tiles 370×184 · tile 115×86     tiles 66×344 · tile 26×166
			                                            ⛔ TILE GRID CLIPPED
			      1440  band 358 · PFP 56 · idcol 578   band 358 · PFP 340 · idcol 294
			            tiles 578×144 · tile 185×66     tiles 294×224 · tile 90×106

			    At 1024 each tile is 26px wide and the grid clips — round 1's
			    collapse at a viewport two and a half times wider. `h-full` resolves
			    against the grid ROW, the row is `max(identity content, graph)`, and
			    a taller card widens the square → narrows the column → heightens the
			    tiles → heightens the card.
			    ⇒ AND THE UNBLOCK IS ITSELF BLOCKED THIS ROUND: declaring the band
			    height spills the graph 140px over the arena at 1440, because the
			    graph's height is `(colWidth − 32)/2 + 32` inside
			    `graph/ProfileGraphCard.tsx` — a file this task may not edit. Both
			    halves now trace to that ONE symbol; see `page.tsx`'s headzone block
			    for the full table. */}
			{/* A plain <img> (not the radix Avatar, which defers the img until load
			    and shows only its fallback under jsdom) — the PFP is a tiny static
			    SVG placeholder; next/image would rewrite its src and add no value.
			    A scrubbed user shows the same placeholder until the R2 PFP builder +
			    the owed scrubbed-silhouette asset land (surfaced for Gate C).
			    ⛔ A `biome-ignore` ATTACHES TO THE NODE THAT FOLLOWS IT, so no
			    comment may be inserted between the block above and this element —
			    and because both an orphaned suppression and the un-suppressed
			    `noImgElement` are WARNINGS, `just verify` stays EXIT=0 while
			    reporting both. Measured at HTML-FINISH row 16, which did exactly
			    that; the suppression therefore rides the LAST block, which is this
			    one — and it was moved OFF the row-16 block above precisely because
			    that block stopped being last when this one was written.
			    biome-ignore lint/performance/noImgElement: static SVG placeholder — next/image is not warranted */}
			<img
				src={user.pfpUrl}
				alt=""
				width={56}
				height={56}
				className="size-14 shrink-0 rounded-[var(--imgr)] bg-n1 object-cover"
			/>
			{/* HTML-FINISH row 8 — `.idcol` (mockup `:194`, `:437`): the identity
			    COLUMN, holding the pseudonym row and — new — the six tiles beneath
			    it. `min-w-0` and `flex-1` are the mockup's `min-width:0; flex:1 1
			    auto` (`:194`), i.e. topology; they are what lets the tile grid take
			    the band's remaining width instead of overflowing it.
			    `gap-3` is `ProfileTiles.tsx`'s OWN grid gap, reused here rather
			    than the mockup's `.idcol{gap:12px}` — same-file trace, not a
			    prototype value. The existing pseudonym/chip pair keeps its `gap-1`
			    exactly, in its own nested column, so nothing inside it moves. */}
			<div className="flex min-w-0 flex-1 flex-col gap-3">
				<div className="flex flex-col gap-1">
					<div className="flex items-center gap-2">
						<span
							data-testid="identity-pseudonym"
							className="font-medium text-ink"
						>
							{user.pseudonym}
						</span>
						{/* PB-1 (item 17) — the headzone bookmark icon, OWNER-ONLY by the
					    founder ruling of 2026-07-31: it is navigation to the viewer's
					    OWN saved set, so a visitor never sees it. Before this, the
					    `/bookmarks` route was live, auth-gated and ORPHANED from the
					    navigation graph — zero href literals anywhere in `src/`.
					    ⛔ BOOKMARK ONLY. W2.13 R2 struck the download icon that sits
					    beside it in the tier-4 shell; building both would ship an
					    affordance a ratified design review already removed.
					    ⛔ It lands INSIDE this text block, not on the root `Card`: that
					    row has no `justify-between`, so a third child there would
					    left-pack against this block rather than float right.
					    Icon + `aria-label`, no visible text — `surface.test.tsx:303`
					    asserts the whole identity-card subtree contains no "@". */}
						{owner && (
							<Link
								href="/bookmarks"
								aria-label="Bookmarks"
								className="text-n5 outline-none hover:text-ink focus-visible:shadow-(--state-focus-ring)"
							>
								<Bookmark className="size-4" />
							</Link>
						)}
					</div>
					<div className="flex flex-wrap items-center gap-2">
						<Badge data-testid="profile-chip" variant="secondary">
							{owner ? PROFILE_COPY.chip.owner : PROFILE_COPY.chip.visitor}
						</Badge>
						{user.banned && (
							<Badge data-testid="identity-banned" variant="destructive">
								Banned
							</Badge>
						)}
						{scrubbed && (
							<Badge data-testid="identity-scrubbed" variant="outline">
								Scrubbed
							</Badge>
						)}
					</div>
				</div>
				<ProfileTiles tiles={tiles} />
			</div>
		</Card>
	);
}
