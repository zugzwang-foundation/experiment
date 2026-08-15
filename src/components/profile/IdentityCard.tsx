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
			{/* HTML-FINISH row 16 — THE PFP FILLS THE BAND AS A SQUARE. The mockup's
			    `.pfp` is `height:100%; aspect-ratio:1/1; flex:0 0 auto` (`:191-193`,
			    markup `:436`) — it takes the identity band's height and derives its
			    width from that, rather than sitting at a fixed box. All three of
			    those are TOPOLOGY, so all three port: `h-full aspect-square
			    shrink-0`. `w-auto` is load-bearing and is not decoration — the
			    `width={56}` attribute below is a presentational hint that would
			    otherwise pin the width and silently disable `aspect-ratio` (both
			    axes specified); an author rule outranks the hint, so `w-auto` is
			    what hands the width back to the ratio. The attributes STAY, as the
			    intrinsic-ratio hint the browser uses before the image loads.
			    ⚠ NO NEW VALUE. `min-h-14` is `size-14`'s OWN 3.5rem re-expressed as
			    a FLOOR instead of a fixed height — the move `HeroPanels.tsx:138`
			    already ships at HTML-FINISH row 9 ("`h-24` becomes `min-h-24` — the
			    SAME 6rem, as a FLOOR rather than a fixed height"). It is what stops
			    the PFP collapsing in the three route states that do not yet frame it
			    in a band.
			    `object-cover` is a FIT RULE, not a value (precedent:
			    `HeroPanels.tsx:113`): once the box is height-derived, a non-square
			    source would otherwise stretch, and "fill it as a square" would ship
			    as "fill it as a squashed rectangle". */}
			{/* A plain <img> (not the radix Avatar, which defers the img until load
			    and shows only its fallback under jsdom) — the PFP is a tiny static
			    SVG placeholder; next/image would rewrite its src and add no value.
			    A scrubbed user shows the same placeholder until the R2 PFP builder +
			    the owed scrubbed-silhouette asset land (surfaced for Gate C).
			    ⛔ THIS BLOCK MUST STAY THE LAST COMMENT BEFORE THE ELEMENT. A
			    `biome-ignore` attaches to the node that FOLLOWS it, so inserting a
			    comment between the two detaches the suppression — and because both
			    the orphaned suppression and the un-suppressed `noImgElement` are
			    WARNINGS, `just verify` stays EXIT=0 while reporting both. Measured
			    here at HTML-FINISH row 16, which did exactly that.
			    biome-ignore lint/performance/noImgElement: static SVG placeholder — next/image is not warranted */}
			<img
				src={user.pfpUrl}
				alt=""
				width={56}
				height={56}
				className="aspect-square h-full min-h-14 w-auto shrink-0 rounded-[var(--imgr)] bg-n1 object-cover"
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
