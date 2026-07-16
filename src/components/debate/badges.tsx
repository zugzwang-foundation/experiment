import { Badge } from "@/components/ui/badge";
import type { Badge as BadgeKind } from "@/lib/ranking";
import { cn } from "@/lib/utils";

import type { Marker, Side } from "./types";

/**
 * The frozen YES/NO side badge (INV-3 / design-language §3.1). Bound to the
 * SIDE poles: YES → black (`--color-yes`), NO → white (`--color-no`) — never the
 * Support/Counter relation (D3). Set at post-time and never changes; rendered on
 * every post and reply. `aria-label` carries the side for screen readers (the
 * colour is paired with the literal text, AGENTS.md §8).
 */
export function SideBadge({ side }: { side: Side }) {
	return (
		<Badge
			aria-label={`${side} side`}
			className={cn(
				// Pole edges are carried by the standard #404040 border on BOTH
				// poles (values-log v0_3 §3) — without it the black YES fill is
				// invisible on the n0 card.
				"rounded-sm px-1.5 font-mono text-[10px] tracking-wide [border:var(--hairline)]",
				side === "YES" ? "bg-yes text-no" : "bg-no text-yes",
			)}
		>
			{side}
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
