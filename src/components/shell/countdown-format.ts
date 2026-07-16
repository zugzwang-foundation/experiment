/**
 * Freeze-countdown display math (UI.A1 §4.2 / values-log R-2): digits-only
 * `DD:HH:MM` — days zero-pad to 2 and grow to 3 pre-launch (>99 days; the
 * ratified OQ-8 rule keys the chessboard row-2 cell count off this string,
 * 9 cells → 8 once days < 100). Hours/minutes are always 2. Sub-minute
 * remainders floor (minute granularity — the display never overstates the
 * time left); at/after the freeze instant the display clamps to `00:00:00`
 * (no negatives — plan §6 "arithmetic honesty"). Pure math, shared by the
 * RSC seed render and the client tick; the target is always the built
 * `FREEZE_INSTANT_UTC` pin (F2), passed in as epoch millis.
 */
export function formatCountdown(nowMs: number, targetMs: number): string {
	const remainingMinutes = Math.max(0, Math.floor((targetMs - nowMs) / 60_000));
	const days = Math.floor(remainingMinutes / 1_440);
	const hours = Math.floor((remainingMinutes % 1_440) / 60);
	const minutes = remainingMinutes % 60;
	return [days, hours, minutes]
		.map((part) => String(part).padStart(2, "0"))
		.join(":");
}
