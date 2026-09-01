/**
 * TIME-1 — how long ago an argument was written, as a string.
 *
 * The whole correctness surface of the feature is this function, and it is a
 * pure function of two integers: no React, no DOM, no `Date` object, no
 * timezone. A DELTA HAS NO TIMEZONE — two instants subtract to a duration
 * whatever calendar either one was written in — which is what makes this
 * testable with synthetic milliseconds and what keeps a real row of any
 * particular age off the test path entirely.
 *
 * ⛔ FOUR OUTPUT SHAPES AND NO OTHERS:
 *
 *     delta < 60s        → `just now`
 *     60s ≤ delta < 1h   → `1m ago` … `59m ago`
 *     1h  ≤ delta < 24h  → `1h ago` … `23h ago`
 *     delta ≥ 24h        → `1d ago`, `2d ago`, … unbounded
 *
 * ⛔ NEVER COMPOUNDED (`1h 5m ago` is wrong) and NEVER a zero unit (`0m ago`).
 * The zero is structurally impossible rather than filtered: each branch is
 * entered only once the delta has reached one whole unit, so the floor of the
 * division cannot be less than 1. That is why there is no `=== 0` check
 * anywhere below — a check would imply the case can arise.
 *
 * ⛔ NO WEEKS, MONTHS OR YEARS BUCKET. The experiment's live window is ~51 days
 * (15 Sep – 5 Nov 2026), so `51d ago` is the practical ceiling and an unbounded
 * day count is the honest end of the ladder. A `w`/`mo` bucket would be code
 * for a state this build cannot reach.
 *
 * ⚠ TRUNCATION IS TOWARD ZERO AT EVERY BOUNDARY, so 3599 s is `59m ago` and
 * 3600 s is `1h ago`. `Math.floor` and truncation agree here because every
 * branch that divides has already established a positive delta.
 */

const MINUTE_MS = 60_000;
const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

/**
 * @param nowMs     the reading clock, epoch ms
 * @param createdMs the instant the argument was written, epoch ms
 */
export function formatRelativeTime(nowMs: number, createdMs: number): string {
	const delta = nowMs - createdMs;

	// The clamp. A reader's device clock running ahead of the server's is
	// ordinary, and the alternative output on a negative delta is a card
	// reading `-1m ago` or `in 2 minutes` — a claim about the future made by a
	// surface whose whole subject is what has already been argued. Zero and
	// negative both land here, and so does a non-finite delta: `Date.parse` of
	// anything unparseable yields NaN, and every comparison below would be
	// false, walking an unguarded NaN into `NaNd ago`. One clause, four cases,
	// and the answer is the least-claiming of the four shapes.
	if (!Number.isFinite(delta) || delta < MINUTE_MS) {
		return "just now";
	}
	if (delta < HOUR_MS) {
		return `${Math.floor(delta / MINUTE_MS)}m ago`;
	}
	if (delta < DAY_MS) {
		return `${Math.floor(delta / HOUR_MS)}h ago`;
	}
	return `${Math.floor(delta / DAY_MS)}d ago`;
}
