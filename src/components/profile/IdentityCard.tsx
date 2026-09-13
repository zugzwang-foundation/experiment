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
 * resolved PFP URL — no email/name/googleId ever reaches this surface). The URL
 * is a public R2 link built from `pfp_filename` by
 * `server/identity-pool/pfp-url.ts` (PFP-1); `pfp_filename` is a coarsening of
 * the already-public pseudonym — `<colour>-<animal>.webp`, with the number
 * dropped — so it discloses nothing the DTO did not already carry.
 *
 * The dedicated scrubbed-user silhouette asset is UNDEFINED (a brand ruling is
 * owed — values-log §278); a scrubbed row carries `pfp_filename` NULL and so
 * reuses the shared `pfp-placeholder.svg`, which is now the fallback rather
 * than the universal case it was before PFP-1. Surfaced for Gate C.
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
			// ⚠⚠ MOBILE-2e · R-P4 — BELOW 640px THIS IS TWO ROWS, NOT TWO COLUMNS,
			// and it gets there by WRAPPING rather than by re-nesting. The ruled phone
			// header is: the PFP beside the pseudonym, then the six tiles across the
			// full width. Today the tiles live in the column to the RIGHT of a 56px
			// avatar, so at 360px they are squeezed into 230px — two columns of 110px,
			// which is why four of the six labels already wrap to two lines there.
			// Giving the identity column `display:contents` at phone width dissolves
			// it, the pseudonym row and the tile grid become items of THIS row, and a
			// `basis-full` on the grid sends it to a line of its own with the whole
			// 304px to spend. Nothing moves in the DOM, so ≥640px is untouched.
			// ⚠ `gap-y-3` replaces what the dissolved column's own `gap-3` used to
			// supply; without it the 18px horizontal gap would set the vertical rhythm
			// too, and the tiles would sit 6px lower than the mockup for no reason
			// anyone could find later.
			className="flex min-w-0 flex-row items-center gap-[18px] max-mobile:flex-wrap max-mobile:gap-y-3"
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
			    element that no longer exists.

			    ⚠⚠ PFP-UI-1 (2026-08-26): EVERY SIZING UTILITY THIS BLOCK ARGUES FOR
			    NOW LIVES ON THE WRAPPER BELOW, NOT ON THE `<img>`. The reasoning is
			    unchanged and still governs — `h-14 w-14` over `size-14`, the `xl:`
			    scope, the 188 box, the named lg/xl cost — it simply attaches one
			    element out. Read the wrapper's own block for WHY it had to move; the
			    short version is that a wrapper between the grid item and the image
			    breaks the percentage-height chain these numbers depend on. */}
			{/* ⚠⚠ PFP-UI-1 — THE WRAPPER EXISTS TO CARRY THE RING, AND IT COSTS THE
			    SIZING CHAIN IF THE UTILITIES DO NOT COME WITH IT.
			    This mount was the only one of the eight with NO ring. It cannot take
			    one from `ui/avatar.tsx` without adopting the radix primitive, and
			    adopting the primitive would delete the only coverage in the repo that
			    proves this hero renders the right image (the primitive defers its
			    `<img>` under jsdom — `grep AvatarImage tests/` returns zero hits
			    across the whole suite). So the ring arrives on a wrapper instead,
			    carrying the identical declaration `ui/avatar.tsx:34` uses — copied,
			    not imported, because extracting a shared constant would mean editing
			    a file serving six mounts across five surfaces to dedupe a string.
			    ⛔ THE WRAPPER IS NOT FREE, AND THE COST WAS MEASURED, NOT REASONED.
			    The 188px box exists because the card root is a grid item stretched to
			    the 188px row, which gives `xl:h-full` a definite percentage base. A
			    naive wrapper makes that base `auto`; `w-auto` + `aspect-ratio:1/1`
			    then fall back to the intrinsic asset size and the image renders
			    256×256 — 68px larger in BOTH axes, overflowing the band. Measured at
			    1440 in a pinned iframe. The fix is to give the wrapper the sizing
			    utilities and the `<img>` `size-full`, which restores 188×188 at ≥xl
			    and leaves the 56px box and its 66px centring untouched below xl.
			    ⚠ `bg-n1` stays on the `<img>`: it is the loading-state fill and must
			    sit on the element that is loading. `rounded-full` is on BOTH — the
			    `<img>` for the crop, the wrapper's `::after` for the ring.
			    ⛔ NO AUTOMATED TEST CAN SEE ANY OF THIS. jsdom performs no layout, so
			    the suite proves only that the classes sit on the right elements; the
			    256×256 blow-out, a 56×56 collapse and an ellipse all pass it. The
			    proof is the founder visual pass at ≥1280. */}
			<span className="relative shrink-0 h-14 w-14 xl:aspect-square xl:h-full xl:w-auto after:absolute after:inset-0 after:rounded-full after:[border:var(--avatar-ring)]">
				{/* A plain <img> (not the radix Avatar, which defers the img until
				    load and shows only its fallback under jsdom).
				    ⚠ THE SUPPRESSION'S PREMISE CHANGED AT PFP-1 AND ITS CONCLUSION
				    DID NOT. This is no longer "a tiny static SVG placeholder" — it is
				    a 256×256 R2 webp, median 4.7KB, resolved per user. `next/image`
				    still buys nothing here, but for a different and harder reason:
				    `next.config.ts` declares no `images.remotePatterns`, so
				    `next/image` on an R2 host THROWS at render. The reason string is
				    re-stated rather than deleted, because a suppression whose stated
				    cause is false is one a later reader deletes on sight.
				    A scrubbed user shows the same placeholder until the owed
				    scrubbed-silhouette asset lands (surfaced for Gate C).
				    ⛔ A `biome-ignore` ATTACHES TO THE NODE THAT FOLLOWS IT, so no
				    comment may be inserted between this block and the element — the
				    wrapper above therefore opens OUTSIDE this block, never between
				    it and the `<img>`. Because both an orphaned suppression and the
				    un-suppressed `noImgElement` are WARNINGS, `just verify` stays
				    EXIT=0 while reporting both, so nothing fails loudly if this is
				    got wrong. Measured at HTML-FINISH row 16, which did exactly that.
				    biome-ignore lint/performance/noImgElement: an absolute R2 URL on a host absent from images.remotePatterns — next/image would throw at render */}
				<img
					src={user.pfpUrl}
					alt=""
					width={56}
					height={56}
					className="size-full rounded-full bg-n1 object-cover"
				/>
			</span>
			{/* HTML-FINISH row 8 — `.idcol` (mockup `:194`, `:437`): the identity
			    COLUMN, holding the pseudonym row and — new — the six tiles beneath
			    it. `min-w-0` and `flex-1` are the mockup's `min-width:0; flex:1 1
			    auto` (`:194`), i.e. topology; they are what lets the tile grid take
			    the band's remaining width instead of overflowing it.
			    `gap-3` is the mockup's `.idcol{gap:12px}` (`:194`) AND
			    `ProfileTiles.tsx`'s own grid gap — the two agree, so one token
			    serves both. */}
			{/* ⚠ `max-mobile:contents` — see the root's note. The box goes away below
			    640px so its two children become the wrapping row's own items; above it
			    the column is exactly what it was. */}
			<div className="flex min-w-0 flex-1 flex-col gap-3 max-mobile:contents">
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
