import { describe, expect, it } from "vitest";

import {
	isWritesPaused,
	writesPausedRetryAfterSeconds,
} from "@/server/config/writes-paused";

/**
 * AWS-MIGRATION-3 item 5, tests-first (CLAUDE.md §5.6) — the write-pause gate's
 * two pure predicates. Plan `docs/plans/AWS-MIGRATION-3.md` §"Test plan" row 3:
 * exact-value gate; boolean-shaped values are NOT paused; retry-after
 * default/parse.
 *
 * ⛔ WHY THE GATE IS AN EXACT VALUE AND NOT A BOOLEAN, AND WHY THE POLARITY IS
 * THE OPPOSITE OF THE STAGING RUNNERS'. The staging intent tokens fail CLOSED —
 * a boolean-shaped value refuses the destructive act. This flag fails OPEN, on
 * purpose: taking the product read-only is itself the destructive act here, so
 * a stray `ZUGZWANG_WRITES_PAUSED=true` in a Doppler config, a leftover CI
 * variable, or a copy-pasted `1` must NOT silently stop every bet on the live
 * surface. A pause is a deliberate operator act with one named spelling; the
 * flag says `paused` or the product writes.
 *
 * ⚠ THE `""` ROW IS NOT PEDANTRY. `docs/aws-migration/` and `src/db/index.ts`
 * both record the same operational fact: the natural way to unset a value in the
 * Doppler or Vercel dashboard is to CLEAR THE FIELD, which is stored as an empty
 * string rather than as an absent key. So "unpause by clearing the box" has to
 * mean unpaused, and an implementation testing truthiness of the raw string
 * would already agree — while one testing `!== undefined` would leave the
 * product frozen after the operator believed they had released it.
 *
 * PURE. Both functions take the env record as an argument (defaulting to
 * `process.env`), so this file passes literals and never mutates the real
 * environment — no `beforeEach`/restore dance, and no cross-test leakage.
 */

describe("isWritesPaused — the exact-value gate", () => {
	it("writes-paused::the-exact-value-pauses", () => {
		expect(isWritesPaused({ ZUGZWANG_WRITES_PAUSED: "paused" })).toBe(true);
	});

	it("writes-paused::boolean-shaped-values-are-not-paused", () => {
		// The whole point of the exact-value rule: each of these is a plausible
		// thing somebody types into a flag field, and none of them may take the
		// product read-only.
		for (const value of ["true", "1", "yes", "on", "TRUE", "y"]) {
			expect(isWritesPaused({ ZUGZWANG_WRITES_PAUSED: value })).toBe(false);
		}
	});

	it("writes-paused::an-empty-string-is-not-paused", () => {
		// The cleared-dashboard-field spelling — see the docblock.
		expect(isWritesPaused({ ZUGZWANG_WRITES_PAUSED: "" })).toBe(false);
	});

	it("writes-paused::an-absent-variable-is-not-paused", () => {
		expect(isWritesPaused({})).toBe(false);
		expect(isWritesPaused({ ZUGZWANG_WRITES_PAUSED: undefined })).toBe(false);
	});

	it("writes-paused::near-misses-of-the-exact-value-are-not-paused", () => {
		// No case-folding and no trimming. A gate that accepted `PAUSED` or
		// ` paused ` would be a gate that accepts almost-anything by degrees, and
		// the operator would have no way to know which spellings are live.
		for (const value of ["Paused", "PAUSED", " paused", "paused ", "pause"]) {
			expect(isWritesPaused({ ZUGZWANG_WRITES_PAUSED: value })).toBe(false);
		}
	});

	it("writes-paused::unrelated-variables-never-pause", () => {
		// ⛔ POSITIVE-CONTROL SHAPE — proves the predicate reads THE named key and
		// not merely "any set variable". Both records below are non-empty.
		expect(
			isWritesPaused({
				ZUGZWANG_ENV: "prod",
				ZZ_STAGING_WRITES_PAUSED: "paused",
			}),
		).toBe(false);
		expect(
			isWritesPaused({
				ZUGZWANG_ENV: "prod",
				ZUGZWANG_WRITES_PAUSED: "paused",
			}),
		).toBe(true);
	});
});

describe("writesPausedRetryAfterSeconds — default and parse", () => {
	it("writes-paused::retry-after-defaults-to-300", () => {
		// The plan's Values table: `…_RETRY_AFTER` default 300. Five minutes is
		// long enough that a client's own retry lands after a short data sync
		// rather than hammering a paused surface.
		expect(writesPausedRetryAfterSeconds({})).toBe(300);
	});

	it("writes-paused::parses-a-positive-integer", () => {
		expect(
			writesPausedRetryAfterSeconds({
				ZUGZWANG_WRITES_PAUSED_RETRY_AFTER: "42",
			}),
		).toBe(42);
		expect(
			writesPausedRetryAfterSeconds({
				ZUGZWANG_WRITES_PAUSED_RETRY_AFTER: "900",
			}),
		).toBe(900);
		expect(
			writesPausedRetryAfterSeconds({
				ZUGZWANG_WRITES_PAUSED_RETRY_AFTER: "1",
			}),
		).toBe(1);
	});

	it("writes-paused::garbage-falls-back-to-300", () => {
		// ⛔ A SLOPPY `parseInt` IS THE FAILURE MODE, AND IT FAILS IN THE WORST
		// DIRECTION. `Number.parseInt("1.5", 10)` is `1`, `parseInt("5m")` is `5` —
		// so a mistyped value silently becomes a one-second Retry-After, i.e. the
		// clients are told to come straight back at the surface that is paused.
		// The parse must therefore be strict over the WHOLE string, not a prefix.
		for (const value of [
			"abc",
			"",
			" ",
			"-5",
			"0",
			"1.5",
			"5m",
			"300s",
			"1e3",
			"+30",
			" 30 ",
			"Infinity",
			"NaN",
		]) {
			expect(
				writesPausedRetryAfterSeconds({
					ZUGZWANG_WRITES_PAUSED_RETRY_AFTER: value,
				}),
			).toBe(300);
		}
	});

	it("writes-paused::retry-after-is-independent-of-the-pause-flag", () => {
		// The two variables are read independently: the retry-after value is
		// meaningful whether or not the pause is currently on, so the proxy can
		// read one without branching on the other.
		expect(
			writesPausedRetryAfterSeconds({
				ZUGZWANG_WRITES_PAUSED: "paused",
				ZUGZWANG_WRITES_PAUSED_RETRY_AFTER: "60",
			}),
		).toBe(60);
		expect(
			writesPausedRetryAfterSeconds({
				ZUGZWANG_WRITES_PAUSED_RETRY_AFTER: "60",
			}),
		).toBe(60);
	});
});
