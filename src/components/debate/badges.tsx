import { Badge } from "@/components/ui/badge";
import type { Badge as BadgeKind } from "@/lib/ranking";
import { cn } from "@/lib/utils";

import { formatPercentUnpaired } from "./format";
import type { Marker, Side } from "./types";

/**
 * V11 — the Discovery hero chip geometry (`.sidechip.md`,
 * surface_discovery_v1_0.html:115-116). The DEFAULT is today's built render, so
 * every other `SideBadge` call site has a zero pixel delta.
 *
 * ⚠ NOT primitive-wide, and it cannot be: `.sidechip.md` is 9px on Discovery and
 * 10px on d5 (surface_d5_v1_0.html:540), and Profile specifies `.sm` at 8.5px.
 * The same class name carries different numbers per surface, so applying one
 * surface's geometry to the shared primitive would import it onto two surfaces
 * that have their own ratified numbers. d5's and Profile's presets are
 * POLISH.3 / POLISH.5 rows.
 *
 * PRIMITIVES-2 D6 — PRESETS ARE NAMED BY SURFACE, NEVER BY MOCKUP CLASS. The
 * mockup class name is not a stable key: `.sidechip.md` is 9px on Discovery and
 * 10px on d5, so a preset named `md` would carry d5's number under a name
 * meaning Discovery's — three lines below `hero`, which already IS Discovery's
 * `.md`. A stale-name defect minted at birth. `detail` / `profile` name the
 * SURFACE that ratified the numbers, matching `PriceBar`'s `hero`/`card`/
 * `detail`.
 *
 * ⚠ EACH VALUE IS A FLATTENED CASCADE, not a transcription of its modifier
 * rule. The mockups are cascading CSS — a `.sidechip` base PLUS a `.md`/`.sm`
 * modifier — and this component has NO cascade: one preset is one complete
 * standalone string. Every property the modifier inherits from the base must be
 * written out explicitly or it falls through to shadcn's `badgeVariants`, whose
 * base declares `text-xs font-medium` — so an omitted `font-extrabold` lands on
 * 500, not the mockups' 800. `hero` is the existing precedent: Discovery's base
 * declares `font-weight:800` and its `.md` does not, and `hero` carries
 * `font-extrabold` anyway.
 *
 * ⚠ ONE PROPERTY IS NOT THE MOCKUP'S AND CANNOT BE: `badgeVariants` sets
 * `h-5`, and NEITHER mockup declares a height on `.sidechip`, so the chip's box
 * is 20px regardless of the padding a preset carries. `profile`'s `2px 7px` on
 * 8.5px text computes to roughly 14px of content, so the rendered box is taller
 * than the mockup's. This is NOT a dropped property — there is nothing to drop
 * — and it is identical in kind to the already-ratified `hero`. Recorded
 * because these presets have no consumer, so nothing measures their box until
 * POLISH.3 / POLISH.5 look at 1440, and that is where the divergence would
 * first be seen.
 *
 * PRIMITIVES-2 D7 — `base` is a REAL KEY, and the preset is resolved by MAP
 * LOOKUP (`CHIP[size ?? "base"]`), never by the binary ternary the call site
 * below previously carried. A ternary resolves every unlisted member to `base`
 * SILENTLY: correct today only by accident of its shape, and a wrong render the
 * moment a third preset exists. Through the map, a union member added without a
 * `CHIP` entry is a COMPILE ERROR (CLAUDE.md §8 O-1 — structural beats
 * procedural). This commit adds no preset and no value; it changes only how one
 * is chosen, so every call site's emitted class attribute is unmoved.
 */
const CHIP = {
	// Byte-identical to the pre-C3 string, hairline included and in the SAME
	// position, so every call site that passes no `size` emits the exact class
	// attribute they emitted before — not merely an equivalent one.
	base: "rounded-sm px-1.5 font-mono text-[10px] tracking-wide [border:var(--hairline)]",
	hero: "rounded-[var(--r)] px-[7px] py-[2px] text-[9px] font-extrabold tracking-[0.06em] [border:var(--hairline)]",
	// d5's `.sidechip.md` — surface_d5_v1_0.html:540 (font-size, padding) over
	// the base at :538 (font-weight, letter-spacing) and the grouped radius rule
	// at :742. POLISH.3 adopts; NOT wired here (D5 — the seam lands, the call
	// site is `.3`'s).
	detail:
		"rounded-[var(--r)] px-[9px] py-[3px] text-[10px] font-extrabold tracking-[0.1em] [border:var(--hairline)]",
	// Profile's `.sidechip.sm` — surface_profile_v1_0.html:279 (font-size,
	// padding, letter-spacing) over the base at :278 (font-weight, radius).
	// POLISH.5 adopts — `.5`, not `.6`: that mockup is POLISH.5's surface.
	//
	// ⚠ DO NOT REUSE THIS FOR d5's `.sm` SITES, even though d5's `.sm` modifier
	// (`:541`) is BYTE-IDENTICAL to Profile's (`:279`). The equality holds at the
	// modifier and nowhere else: d5 carries two CONTEXTUAL overrides Profile has
	// no equivalent of — `.panel.vm .sidechip.sm{border-radius:4px}` (`:882`) and
	// `.replylist.vp .sidechip.sm{border-radius:4px}` (`:911`). A flattened
	// preset has no cascade to express them, so wiring `profile` into a d5 `.sm`
	// site would silently render `var(--r)` where the mockup ratified 4px. Two
	// independent reasons not to wire it, then: that adoption is POLISH.3's
	// decision, AND this value is wrong for those sites.
	profile:
		"rounded-[var(--r)] px-[7px] py-[2px] text-[8.5px] font-extrabold tracking-[0.08em] [border:var(--hairline)]",
} as const;

/**
 * The frozen YES/NO side badge (INV-3 / design-language §3.1). Bound to the
 * SIDE poles: YES → black (`--color-yes`), NO → white (`--color-no`) — never the
 * Support/Counter relation (D3). Set at post-time and never changes; rendered on
 * every post and reply. `aria-label` carries the side for screen readers (the
 * colour is paired with the literal text, AGENTS.md §8).
 *
 * V10 — `price` optionally renders the author's ENTRY PRICE beside the side
 * (`YES @ 27%`, the d5 chip pattern at surface_d5_v1_0.html:1701). It is
 * OPTIONAL because three call sites have no entry price IN EXISTENCE — a column
 * header (`DebateColumn`) and two pre-commit composers (`BetComposer`,
 * `SellModule`) — and a required prop would force them to invent one.
 *
 * ⚠ The SIDE is not touched by either addition. `side === "YES" ? "bg-yes
 * text-no" : "bg-no text-yes"` is the invariant (INV-3, and the reference
 * implementation C0's guard measures every other site against); the price is a
 * sibling, never a substitute.
 *
 * ⚠ The mockup's `.sidechip.yes{background:var(--ink)}` is DELIBERATELY NOT
 * PORTED: the mockups are light-theme, `--color-ink` is #fafafa here, and
 * porting it by name would render YES near-WHITE — the exact inversion C4/C4b
 * fix on two other surfaces.
 */
export function SideBadge({
	side,
	price,
	size,
}: {
	side: Side;
	/**
	 * The bet's `price_at_bet` — the effective price of THE SIDE THE AUTHOR
	 * BOUGHT, already side-scoped by the engine. ⚠ NOT the YES probability:
	 * `bets/place.ts:162` stores `computeBuy(...).pEff`, computed at
	 * `cpmm/calculate.ts:73-97` as `stake ÷ shares` where `a = reserves[side]` is
	 * the BOUGHT side (and `p0 = b/(a+b)`, matching `getPrices`' per-side
	 * orientation) — so a NO bet stores the NO price.
	 *
	 * Rendered RAW. Deriving `100 − x` would print `NO @ 45%` for an author who
	 * entered NO at 55%, and would disagree with the shipped `.md` export, which
	 * renders the same field unmodified (debate-export/serialize.ts:320, :348).
	 */
	price?: string;
	/**
	 * OPTIONAL, deliberately — and this is the OPPOSITE call from `PriceBar`'s
	 * REQUIRED `size` (`PriceBar.tsx:31-33`) on the same primitive class. The
	 * asymmetry is driven by the call-site census, not by a change of principle:
	 * TWELVE of `SideBadge`'s thirteen render sites pass no `size` and ride
	 * `CHIP.base`, so requiring it is a twelve-site edit whose every edit writes
	 * the same string the `?? "base"` default already resolves to — cost without
	 * a defect fixed. `PriceBar` has three sites and all three pass one, so
	 * `required` cost it nothing there.
	 *
	 * O-1's structural guarantee is not weakened by that: what turns a missing
	 * preset into a compile error here is the MAP, not the required-ness. A
	 * required `size` would only have moved which argument goes missing.
	 *
	 * `detail` and `profile` have ZERO call sites by design (D5): the SEAM lands
	 * at this primitive, the ADOPTION is POLISH.3's and POLISH.5's. Wiring one
	 * here would re-skin a surface before it has been inspected. Their only
	 * coverage is therefore the direct render tests, at both poles.
	 */
	size?: "hero" | "detail" | "profile";
}) {
	// pctround-allow: a single HISTORICAL value for ONE bet — a point in time,
	// not one half of a live pair (SPEC.1 §10.8). Rendered RAW because the stored
	// value is ALREADY the bought side's price; see the `price` prop above.
	const pct = price === undefined ? null : formatPercentUnpaired(price);
	return (
		<Badge
			aria-label={
				pct === null ? `${side} side` : `${side} side, entry price ${pct}`
			}
			className={cn(
				// Pole edges are carried by the standard #404040 border on BOTH
				// poles (values-log v0_3 §3) — without it the black YES fill is
				// invisible on the n0 card. Carried inside each preset above.
				CHIP[size ?? "base"],
				side === "YES" ? "bg-yes text-no" : "bg-no text-yes",
			)}
		>
			{pct === null ? side : `${side} @ ${pct}`}
		</Badge>
	);
}

/**
 * The live position marker (F-DEBATE-2 / design-language §4.2) — whether the
 * author still holds the side they argued. `none` (still on side) renders
 * nothing (the default); `Flipped` / `Exited` render a neutral-grey chip. Placed
 * after the side badge, before the stake (D5).
 */
export function PositionMarker({ marker }: { marker: Marker }) {
	if (marker === "none") {
		return null;
	}
	return (
		<Badge
			variant="secondary"
			className="rounded-sm px-1.5 text-[10px] font-normal text-muted-foreground"
			aria-label={`Author ${marker}`}
		>
			{marker}
		</Badge>
	);
}

/**
 * The lane-dominance badge (RANKING.md §5 / ADR-0017 P3 / D2) — Most Debated /
 * Highest Stakes / Contested. NOT a sort selector (there is none in v1); a
 * read-time label on a post that dominates a lane. `null` → no badge (the
 * majority).
 */
export function LaneBadge({ badge }: { badge: BadgeKind | null }) {
	if (!badge) {
		return null;
	}
	return (
		<Badge variant="outline" className="rounded-sm text-[10px] font-normal">
			{badge}
		</Badge>
	);
}
