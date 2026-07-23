import { formatDharma } from "../format";
import { ComposerDecimal } from "./sell-convert";

/**
 * UI.A3 slice 3 — the focused-post split-bar math (plan §4: `SUPPORT Đ n ─
 * Đ total STAKED ─ Đ n COUNTER`, canon §6 grammar + the d5 bar fill).
 * Read-time aggregates over reply-bets (ADR-0017) — exact decimal strings
 * via the composer decimal clone, never JS floats (CLAUDE.md §2).
 */
export function computeSplitBar(args: {
	supportDharma: string;
	counterDharma: string;
}): { totalDharma: string; supportPct: string } {
	const support = new ComposerDecimal(args.supportDharma);
	const total = support.plus(args.counterDharma);
	if (!total.greaterThan(0)) {
		// No reply-bets yet — the division-by-zero belt.
		return { totalDharma: total.toFixed(), supportPct: "0%" };
	}
	// Integer-TRUNCATED fill: a full bar must mean literally zero counter
	// Dharma (never rounds up past 100).
	const pct = support
		.times(100)
		.dividedBy(total)
		.toFixed(0, ComposerDecimal.ROUND_DOWN);
	return { totalDharma: total.toFixed(), supportPct: `${pct}%` };
}

/**
 * The DISPLAYED split-bar total (DROUND R2 / SPEC.1 §10.8): the sum of the
 * DISPLAYED (0-dp) Support and Counter figures, so the three adjacent numbers
 * on the bar are always arithmetically consistent on screen — the §23
 * tile-identity treatment applied to the Support / Total / Counter row. Each
 * part is rounded through the single shared display formatter, then summed as
 * exact decimals, never a JS float (CLAUDE.md §2). Distinct from
 * `computeSplitBar.totalDharma`, which is the EXACT sum (the bar-fill basis /
 * money-law contract): `round0(137.7) + round0(137.7) = 276`, not `round0(275.4) = 275`.
 * Both operands arrive pre-rounded (0 dp); `toFixed` pins ROUND_HALF_UP at the
 * call site so ComposerDecimal's inherited ROUND_HALF_EVEN default can never apply.
 */
export function displaySplitTotal(
	supportDharma: string,
	counterDharma: string,
): string {
	return new ComposerDecimal(formatDharma(supportDharma))
		.plus(formatDharma(counterDharma))
		.toFixed(0, ComposerDecimal.ROUND_HALF_UP);
}
