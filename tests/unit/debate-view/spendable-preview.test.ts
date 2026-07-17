import { describe, expect, it } from "vitest";

import { DAILY_CREDIT_DHARMA } from "@/server/config/limits";
import { CpmmDecimal } from "@/server/cpmm/decimal";
// GREENFIELD VALUE IMPORT (the RED driver): `@/server/debate-view/
// viewer-context` lands with UI.A2 §9 slice 3 — until then this suite fails
// to resolve. That unresolved-import RED state is the goal (the
// dharma/accrual.test.ts precedent).
import { computeSpendableToday } from "@/server/debate-view/viewer-context";
import { utcDayOf } from "@/server/dharma/accrual";

// UI.A2 §9 slice 3 — `computeSpendableToday`, the PURE read-only Daily-Credit
// preview (@docs/plans/UI-A2.md §3.3 + §6 + §7 row 3). No IO, no DB.
//
// Pinned contract (plan §3.3):
//   unpaid ⇔ `cursor === null || utcDayOf(cursor) !== utcDayOf(now)` — the
//   SHARED `utcDayOf` import from @/server/dharma/accrual, NEVER re-derived
//   day math (plan self-critique #4; the DB-backed parity twin is
//   tests/integration/viewer-context.integration.test.ts).
//   unpaid → new CpmmDecimal(balance).plus(DAILY_CREDIT_DHARMA).toFixed(18)
//   paid   → `balance` returned UNCHANGED (byte-identical pass-through).
//
// DAILY_CREDIT_DHARMA is imported live (never a literal "10") so the HARDEN.5
// number-tuning pass keeps these tests honest. Money values are decimal
// STRINGS via CpmmDecimal — never JS floats (CLAUDE.md §2).

/** The unpaid expectation, computed live from the constant. */
function plusCredit(balance: string): string {
	return new CpmmDecimal(balance).plus(DAILY_CREDIT_DHARMA).toFixed(18);
}

describe("computeSpendableToday — read-only Daily-Credit preview (UI.A2 §3.3)", () => {
	const NOW = new Date("2026-07-17T12:00:00.000Z");

	it("spendable-preview::unpaid-null-cursor-adds-credit", () => {
		// Never paid (cursor NULL) → balance + DAILY_CREDIT_DHARMA, exact 18-dp
		// decimal-string add.
		expect(
			computeSpendableToday({
				balance: "1000.000000000000000000",
				cursor: null,
				now: NOW,
			}),
		).toBe(plusCredit("1000.000000000000000000"));
	});

	it("spendable-preview::unpaid-yesterday-cursor-adds-credit", () => {
		// Paid YESTERDAY (UTC) relative to now → unpaid today → credit previews.
		expect(
			computeSpendableToday({
				balance: "1000.000000000000000000",
				cursor: new Date("2026-07-16T18:30:00.000Z"),
				now: NOW,
			}),
		).toBe(plusCredit("1000.000000000000000000"));
	});

	it("spendable-preview::paid-same-day-returns-balance-unchanged", () => {
		// Paid earlier the SAME UTC day → the balance comes back UNCHANGED.
		expect(
			computeSpendableToday({
				balance: "123.450000000000000000",
				cursor: new Date("2026-07-17T00:10:00.000Z"),
				now: NOW,
			}),
		).toBe("123.450000000000000000");

		// Byte-identity is the pin (plan §3.3 "paid → balance returned
		// unchanged"): the paid path PASSES THROUGH — it never re-quantizes. A
		// non-canonical input comes back byte-identical.
		expect(
			computeSpendableToday({
				balance: "1000",
				cursor: new Date("2026-07-17T00:10:00.000Z"),
				now: NOW,
			}),
		).toBe("1000");
	});

	it("spendable-preview::utc-midnight-boundary-both-sides", () => {
		// 2s across UTC midnight (cursor 23:59:59Z → now 00:00:01Z next day):
		// the UTC day flipped → unpaid → credit previews.
		expect(
			computeSpendableToday({
				balance: "200.000000000000000000",
				cursor: new Date("2026-07-16T23:59:59.000Z"),
				now: new Date("2026-07-17T00:00:01.000Z"),
			}),
		).toBe(plusCredit("200.000000000000000000"));

		// Paid 1s past midnight; now at 23:59:59 the SAME UTC day → paid →
		// balance unchanged.
		expect(
			computeSpendableToday({
				balance: "200.000000000000000000",
				cursor: new Date("2026-07-17T00:00:01.000Z"),
				now: new Date("2026-07-17T23:59:59.000Z"),
			}),
		).toBe("200.000000000000000000");
	});

	it("spendable-preview::paid-unpaid-flip-tracks-shared-utcDayOf-exactly", () => {
		// Congruence pin (plan self-critique #4): the preview's paid/unpaid flip
		// MUST track the SHARED utcDayOf equality exactly — the same day math
		// accrueDailyCredit runs (unpaid ⇔ cursor NULL || utcDayOf(cursor) !==
		// utcDayOf(now)). A re-derived day comparison (local-tz day, ms-diff,
		// 24h-window…) diverges on at least one of these pairs.
		const BALANCE = "500.000000000000000000";
		const pairs: ReadonlyArray<{ cursor: Date | null; now: Date }> = [
			{ cursor: null, now: NOW },
			// Same UTC day, opposite ends of it → paid.
			{
				cursor: new Date("2026-07-17T00:00:00.000Z"),
				now: new Date("2026-07-17T23:59:59.999Z"),
			},
			// 1ms across midnight → unpaid.
			{
				cursor: new Date("2026-07-16T23:59:59.999Z"),
				now: new Date("2026-07-17T00:00:00.000Z"),
			},
			// Identical instants → paid.
			{ cursor: NOW, now: NOW },
			// Year straddle → unpaid.
			{
				cursor: new Date("2026-12-31T23:59:59.999Z"),
				now: new Date("2027-01-01T00:00:00.000Z"),
			},
			// Offset-notation cursor: 01:30+05:30 = 20:00Z the PREVIOUS calendar
			// date — the SAME UTC day as `now`, so PAID (a local-day
			// re-derivation flips this one).
			{
				cursor: new Date("2026-07-11T01:30:00+05:30"),
				now: new Date("2026-07-10T21:00:00.000Z"),
			},
		];

		for (const { cursor, now } of pairs) {
			const unpaid = cursor === null || utcDayOf(cursor) !== utcDayOf(now);
			expect(computeSpendableToday({ balance: BALANCE, cursor, now })).toBe(
				unpaid ? plusCredit(BALANCE) : BALANCE,
			);
		}
	});

	it("spendable-preview::canonical-zero-balance-adds-exactly", () => {
		// The canonical zero (readBalance's no-rows return) + credit is an exact
		// 18-dp decimal-string add — never a float path.
		const result = computeSpendableToday({
			balance: "0.000000000000000000",
			cursor: null,
			now: NOW,
		});
		expect(result).toBe(
			new CpmmDecimal("0.000000000000000000")
				.plus(DAILY_CREDIT_DHARMA)
				.toFixed(18),
		);
		// 18-dp canonical shape pin on the unpaid output.
		expect(result).toMatch(/^\d+\.\d{18}$/);
	});
});
