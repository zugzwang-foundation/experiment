import { Badge } from "@/components/ui/badge";
import type { ProfileUser } from "@/server/profile/resolve";
import type { ProfileTiles as ProfileTilesData } from "@/server/profile/tiles";

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
		<div
			data-testid="identity-card"
			className="flex min-w-0 flex-row items-center gap-[18px]"
		>
			{/* ⚠⚠⚠ PROFILE-FULL · D-1 IS CLOSED AT THE BAND, AND PARTLY AT THE PFP.
			    Founder-ruled REOPENED: "the 188px band is unreachable" held only
			    under the geometry fence — "the band is unreachable while the tile
			    labels sit at `text-xs`, the six tiles keep their arrangement, AND the
			    PFP fills the band as a square, all at once. Change whichever of the
			    three the mockup requires." Two of the three moved, and a FOURTH lever
			    turned out to be the one that mattered.

			    ⛔ THIS BLOCK IS NOT A CARD ANY MORE, AND THAT IS THE LEVER FIVE
			    ROUNDS MISSED. The mockup's `.idcard` is a BARE flex row —
			    `display:flex; gap:18px; align-items:center; min-width:0` (`:190`) —
			    with no border, no background, no padding and no shadow. This shipped
			    as a `<Card>` with `p-4`, and that padding is 32 of the band's 188: it
			    left the identity column a 156px content box to hold 166px of content,
			    which is why every earlier pass measured an overflow that NO type size
			    could close. In the mockup only the PFP, each tile and the graph carry
			    a frame; the block holding them does not.

			    ⇒ MEASURED, live against real compiled CSS in a viewport PINNED to
			    1440×777 by a fixed-size same-origin iframe, on the shipped surface
			    with real data, with the frame removed and the mockup's tile density
			    applied (labels 8px/800/0.12em uppercase, values 14px/800, tile
			    padding 9/13, tile gap 10, and the leading STATED on both — see the
			    `leading-[1.2]` note below, which corrects this table's first pass):

			      vw     idcol NEEDS   box (188)   overflow   PFP
			      1024       189          188         +1       56  (square not applied)
			      1152       174          188          0       56
			      1280       189          188         +1      188  ← square applies
			      1440       174          188          0      188
			      1920       153          188          0      188

			    ⛔ THE +1 IS SUB-PIXEL ROUNDING, NOT A CLIP. `scrollHeight` rounds a
			    188.4px content box up to 189, and with the Card frame gone there is
			    no `overflow-hidden` left to clip against — the fraction spills into
			    the 16px band gap and is invisible. The mockup sits at the identical
			    edge: its own 3×2 grid needs ~188 at these widths too, which is what
			    makes 188 the literal it is rather than a round number.

			    ⚠⚠ THE SQUARE IS `xl:`-SCOPED, AND THAT IS MEASUREMENT, NOT TASTE. A
			    square filling the band is 188 wide, so it costs the tile column the
			    132px the 56px avatar left it. At 1024 that column falls to 270, the
			    labels wrap to four lines, and the block needs 231 against a 188 box —
			    an overflow of +22 that IS visible and would collide with the arena.
			    From 1280 up the column holds (398 at 1280, 478 at 1440) and the
			    square fits.
			    ⛔ `xl` IS STOCK TAILWIND, NOT AN INVENTED BREAKPOINT. The round-5
			    route-back named it as the legitimate option and rejected it only
			    because it "misses by 21px" — against the 256px band. Against 188 it
			    misses by the 1px rounding floor above. `min-[1312px]:` stays
			    forbidden and is not used.
			    ⛔ BELOW `xl` THE AVATAR KEEPS ITS SHIPPED 56px BOX, deliberately.
			    Below `lg` the band has no declared height at all, so `h-full` there
			    would resolve against a content-driven block and re-enter the round-1
			    feedback loop (taller block → wider square → narrower column → taller
			    tiles → taller block). The square is applied ONLY where a DECLARED
			    bound exists, which is what the four earlier refusals were waiting for.
			    ⚠ `h-14 w-14` REPLACES `size-14` so the override is unambiguous:
			    `size-*` sets width AND height in one utility, and pairing it with
			    `xl:h-full xl:w-auto` would leave which-wins to emission order.

			    ⚠ THE STANDING COST, NAMED SO IT IS NOT SILENT: between `lg` and `xl`
			    the avatar is 56×56 against the mockup's 188×188. That is the LAST
			    remaining piece of D-1 and it is reported, not smoothed over. The band
			    itself — the +8.7pp half — is CLOSED at every width from `lg` up. Full
			    table on the node that declares the band,
			    `u/[pseudonym]/page.tsx`'s `profile-headzone` block.

			    ⚠ THE VIEW CHIP HAS LEFT THIS BLOCK, AND THEN LEFT THE BUILD. It was a
			    body chip under the pseudonym costing 24px of the band, so PROFILE-FULL
			    moved it to the positions panel head where the mockup carries it
			    (`.viewchip`, `:425`); the founder then removed it from that head at
			    R5, and removed `/bookmarks`'s `Your bookmarks` twin at PROFILE OVERLAP
			    R3. ⛔ SO THERE IS NO CHIP ANYWHERE — this block does not suppress one,
			    and no sibling renders one. `showViewChip` is retired with it.
			    ⚠ The sentence that stood here said the chip "now renders in the
			    positions panel head", which was true for exactly one pass. Corrected
			    rather than left, because a reader who trusts it goes looking for an
			    element that no longer exists. */}
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
				className="h-14 w-14 shrink-0 rounded-[var(--imgr)] bg-n1 object-cover xl:aspect-square xl:h-full xl:w-auto"
			/>
			{/* HTML-FINISH row 8 — `.idcol` (mockup `:194`, `:437`): the identity
			    COLUMN, holding the pseudonym row and — new — the six tiles beneath
			    it. `min-w-0` and `flex-1` are the mockup's `min-width:0; flex:1 1
			    auto` (`:194`), i.e. topology; they are what lets the tile grid take
			    the band's remaining width instead of overflowing it.
			    `gap-3` is the mockup's `.idcol{gap:12px}` (`:194`) AND
			    `ProfileTiles.tsx`'s own grid gap — the two agree, so one token
			    serves both. */}
			<div className="flex min-w-0 flex-1 flex-col gap-3">
				{/* ⚠⚠ PROFILE-FULL — `.unamerow` IS ONE ROW, not a two-line stack.
				    The mockup's is `display:flex; align-items:center; gap:10px`
				    (`:197`) holding `.uname` and the `.idacts` cluster, and its height
				    is the 28px action button — 28, against the 44 this shipped as
				    (pseudonym 20 + `gap-1` 4 + chip 20). Those 16px are part of what
				    the 188 band needed back.
				    ⚠ THE BADGES JOIN THIS ROW rather than keeping a line of their own.
				    A second line costs the band ~24px for every viewer, while the
				    Banned label (D8, visible to ALL) and the Scrubbed marker (H2) are
				    both rare — inline they cost nothing until they fire. The wrapper
				    is CONDITIONAL for the same reason: an always-rendered empty
				    `<div>` is still a flex child and still draws its parent's `gap-3`,
				    so it would spend 12px of the band on nothing. */}
				<div className="flex min-w-0 items-center gap-[10px]">
					{/* `.uname` is 20px/800 (`:195`) — the mockup's literal, and the type
					    size §1 puts explicitly in scope. `leading-normal` is the
					    mockup's own unset line-height: Tailwind's `text-*` steps each
					    ship a paired leading, and inheriting `text-sm`'s 20px on a 20px
					    glyph is what silently added a line's worth of height to every
					    row in this band.
					    ⛔ `leading-[1.2]`, NOT `leading-normal` — MEASURED. Tailwind's
					    `leading-normal` is `line-height:1.5`, not the CSS `normal`
					    KEYWORD (~1.2 from the font's metrics) that the mockup gets by
					    leaving line-height unset. At 1.5 this glyph measured 30px and
					    the row 30 against the mockup's 28; at 1.2 it is 24 and the row
					    is the 28px action button, which is the mockup's exactly. */}
					<span
						data-testid="identity-pseudonym"
						className="min-w-0 text-[20px] leading-[1.2] font-extrabold text-ink"
					>
						{user.pseudonym}
					</span>
					{/* UNWIRE-1 — the headzone bookmark icon (PB-1 item 17, the
					    PROFILE REFINEMENT · R2 mode-switch to/from `/bookmarks`) is
					    removed outright: the bookmark module is unwired product-wide
					    and `/bookmarks` no longer exists, so there is no set left to
					    switch to. Not repointed, not left as a dead link, not replaced
					    with a stub. */}
					{(user.banned || scrubbed) && (
						<span className="flex flex-wrap items-center gap-2">
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
						</span>
					)}
				</div>
				<ProfileTiles tiles={tiles} />
			</div>
		</div>
	);
}
