import { Badge } from "@/components/ui/badge";
import type { Badge as BadgeKind } from "@/lib/ranking";
import { cn } from "@/lib/utils";

import { formatPricePercent } from "./format";
import type { Marker, Side } from "./types";

/**
 * V11 — the Discovery hero chip geometry (`.sidechip.md`,
 * surface_discovery_v1_0.html:115-116). The DEFAULT is today's built render, so
 * the eight other `SideBadge` call sites have a zero pixel delta.
 *
 * ⚠ NOT primitive-wide, and it cannot be: `.sidechip.md` is 9px on Discovery and
 * 10px on d5 (surface_d5_v1_0.html:540), and Profile specifies `.sm` at 8.5px.
 * The same class name carries different numbers per surface, so applying one
 * surface's geometry to the shared primitive would import it onto two surfaces
 * that have their own ratified numbers. d5's and Profile's presets are
 * POLISH.3 / POLISH.6 rows.
 */
const CHIP = {
	// Byte-identical to the pre-C3 string, hairline included and in the SAME
	// position, so the eight call sites that pass no `size` emit the exact class
	// attribute they emitted before — not merely an equivalent one.
	base: "rounded-sm px-1.5 font-mono text-[10px] tracking-wide [border:var(--hairline)]",
	hero: "rounded-[var(--r)] px-[7px] py-[2px] text-[9px] font-extrabold tracking-[0.06em] [border:var(--hairline)]",
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
	/** The bet's `price_at_bet` — the canonical YES probability at execution. */
	price?: string;
	size?: "hero";
}) {
	// PCT.ROUND (SPEC.1 §10.8): `price_at_bet` is the canonical YES probability,
	// so the author's OWN entry price is YES → that value, NO → 100 − it. That is
	// exactly `formatPricePercent`'s paired rule — YES canonical, NO derived —
	// so the entry price rides the PAIRED formatter and needs no
	// `formatPercentUnpaired` hatch. The `no` field is never read (format.ts:204
	// documents this); the YES price alone determines both sides.
	//
	// Deriving matters here: the d5 fixtures give the YES post `entry:27` and the
	// NO post `entry:55` (surface_d5_v1_0.html:1496, :1512), i.e. the price of
	// the side the author BOUGHT. Rendering the raw YES probability instead would
	// print `NO @ 27%` when the NO price was 73% — a wrong number sitting beside
	// the literal side, which is the pole-adjacent defect class of this whole PR.
	const pct =
		price === undefined
			? null
			: formatPricePercent({ yes: price, no: price }, side);
	return (
		<Badge
			aria-label={
				pct === null ? `${side} side` : `${side} side, entry price ${pct}`
			}
			className={cn(
				// Pole edges are carried by the standard #404040 border on BOTH
				// poles (values-log v0_3 §3) — without it the black YES fill is
				// invisible on the n0 card. Carried inside each preset above.
				size === "hero" ? CHIP.hero : CHIP.base,
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
