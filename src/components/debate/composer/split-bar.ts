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
