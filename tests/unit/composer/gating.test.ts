import { describe, expect, it } from "vitest";
import {
	assessAmount,
	clampAmountToSpendable,
	deriveReplySide,
	floorFor,
	isEntryDisabled,
} from "@/components/debate/composer/gating";
import {
	BET_MAX_STAKE,
	BET_MIN_STAKE_POST,
	BET_MIN_STAKE_REPLY,
} from "@/server/config/limits";

// UI.A3 §5.6 tests-first — composer amount gating + the F-3 opposite-side
// predicate + the Support/Counter side derivation (plan §3.2 + §4 + §6 edges +
// Ratification F-3). PURE / DB-INDEPENDENT: REDs NOW on the unresolvable
// greenfield import and GREENs when the module lands.
//
// Plan-§1 invariant rows asserted here:
//   - 2.2 INV-2 (no overdraft) — the bounds matrix: the amount input clamps to
//     `spendableToday` (T3) and `spendableToday < floor` disables the composer
//     (floor-above-balance); the client binds to the SAME field the server's
//     pay-credit-then-check path makes real (§1 faucet-adjacent narrative).
//   - 2.3 INV-3 (side frozen at post-time) — the relation→side derivation
//     matrix (Support/Counter × YES/NO parent → the WIRE side; row 3's named
//     assertion). Slot ≠ side, permanently.
//   - I-SINGLE-SIDE (via F-3) — the disable predicate RESULTING side ≠ held
//     side, uniform over market poles × reply triggers (preempts
//     `opposite_side_held`; the server 400 stays authoritative).
//   - Floors (ADR-0018) — floor selection by composer kind (post 10 / reply
//     50), read LIVE so HARDEN tuning can't stale them.
//   - Buy-only clamp (W2.10 Option A) — over-cap = STRICTLY > BET_MAX_STAKE,
//     reachable only in the (spendableToday > cap) window.
//
// PINNED PUBLIC-API CONTRACT (the implementer matches these names exactly):
//   type Side = "YES" | "NO"
//   type ComposerKind = "post" | "reply"
//   floorFor(kind: ComposerKind): string
//     — post → BET_MIN_STAKE_POST, reply → BET_MIN_STAKE_REPLY (live imports)
//   clampAmountToSpendable(amount: string, spendableToday: string): string
//     — T3: amount > spendable → spendable; BYTE-IDENTICAL passthrough
//       otherwise (comparison decimal-exact, output bytes untouched)
//   type AmountAssessment = { clampedAmount: string; composerDisabled: boolean;
//     overCap: boolean; belowFloor: boolean; submitEnabled: boolean }
//   assessAmount(args: { kind: ComposerKind; amount: string;
//     spendableToday: string }): AmountAssessment
//     — clamps FIRST (T3), then evaluates on the clamped value:
//       composerDisabled ⇔ spendableToday < floorFor(kind);
//       overCap ⇔ clampedAmount > BET_MAX_STAKE STRICTLY;
//       belowFloor ⇔ clampedAmount < floor (empty / non-numeric / "0" /
//       negative → belowFloor true, overCap false, submitEnabled false);
//       submitEnabled ⇔ none of the three blocks holds.
//   isEntryDisabled(args: { resultingSide: Side; heldSide: Side | null }):
//     boolean — F-3: RESULTING side ≠ held side, uniform
//   deriveReplySide(args: { parentSide: Side;
//     relation: "support" | "counter" }): Side
//
// All comparisons are DECIMAL-string exact (NUMERIC(38,18) domain — never JS
// floats, CLAUDE.md §2). Fixture values are DERIVED from the live constants
// (BigInt on the integer part — the floors.test.ts pattern; BigInt() calls,
// never bigint literals: tsconfig targets ES2017 where `1n` is TS2737).

const ONE = BigInt(1);
function intOf(value: string): bigint {
	return BigInt(value.split(".")[0] ?? value);
}

// Derived fixtures (values under today's constants in trailing comments).
const SPEND_ABOVE_CAP = String(intOf(BET_MAX_STAKE) + BigInt(5000)); // "15000"
const AMOUNT_OVER_EVERYTHING = String(intOf(BET_MAX_STAKE) + BigInt(10000)); // "20000"
const SPEND_BELOW_CAP = String(intOf(BET_MAX_STAKE) - BigInt(2000)); // "8000"
const CAP_PLUS_ONE = String(intOf(BET_MAX_STAKE) + ONE); // "10001"
const POST_FLOOR_MINUS_ONE = String(intOf(BET_MIN_STAKE_POST) - ONE); // "9"
const REPLY_EPS_BELOW = `${String(intOf(BET_MIN_STAKE_REPLY) - ONE)}.999999999999999999`; // "49.999999999999999999"
const POST_EPS_ABOVE = `${BET_MIN_STAKE_POST}.000000000000000001`; // "10.000000000000000001"
/** Ample spendable: exactly the cap — over both floors, never strip-territory. */
const AMPLE = BET_MAX_STAKE;

describe("floorFor — ADR-0018 floor selection by composer kind", () => {
	it("gating::floor-for-post-is-the-live-post-floor", () => {
		expect(floorFor("post")).toBe(BET_MIN_STAKE_POST);
	});

	it("gating::floor-for-reply-is-the-live-reply-floor", () => {
		expect(floorFor("reply")).toBe(BET_MIN_STAKE_REPLY);
	});
});

describe("clampAmountToSpendable — the T3 input bound (INV-2)", () => {
	it("gating::amount-over-spendable-clamps-to-spendable", () => {
		expect(
			clampAmountToSpendable(AMOUNT_OVER_EVERYTHING, SPEND_BELOW_CAP),
		).toBe(SPEND_BELOW_CAP);
	});

	it("gating::passthrough-is-byte-identical", () => {
		// Bytes untouched — "100.10" must NOT come back "100.1".
		expect(clampAmountToSpendable("100.10", AMPLE)).toBe("100.10");
	});

	it("gating::equal-amount-passes-through", () => {
		expect(clampAmountToSpendable(SPEND_BELOW_CAP, SPEND_BELOW_CAP)).toBe(
			SPEND_BELOW_CAP,
		);
	});

	it("gating::decimal-equal-is-not-greater-bytes-kept", () => {
		// The comparison is DECIMAL-exact, the output byte-exact: an amount
		// decimal-equal to spendable (trailing zeros) is NOT clamped and its
		// bytes survive.
		const padded = `${SPEND_BELOW_CAP}.000000000000000000`;
		expect(clampAmountToSpendable(padded, SPEND_BELOW_CAP)).toBe(padded);
	});
});

describe("assessAmount — clamp-then-evaluate matrix (T3 / W2.10-D)", () => {
	it("gating::over-cap-strip-window-spendable-above-cap", () => {
		// Plan §6 edge: the strip is reachable ONLY when spendableToday > cap.
		// amount 20000, spendable 15000 → clamped 15000, overCap true,
		// submit disabled.
		expect(
			assessAmount({
				kind: "post",
				amount: AMOUNT_OVER_EVERYTHING,
				spendableToday: SPEND_ABOVE_CAP,
			}),
		).toEqual({
			clampedAmount: SPEND_ABOVE_CAP,
			composerDisabled: false,
			overCap: true,
			belowFloor: false,
			submitEnabled: false,
		});
	});

	it("gating::t3-balance-bound-wins-over-the-cap", () => {
		// Plan §6 edge: amount 20000, spendable 8000 → the T3 clamp lands
		// UNDER the cap, so overCap is FALSE and submit is enabled (post kind).
		expect(
			assessAmount({
				kind: "post",
				amount: AMOUNT_OVER_EVERYTHING,
				spendableToday: SPEND_BELOW_CAP,
			}),
		).toEqual({
			clampedAmount: SPEND_BELOW_CAP,
			composerDisabled: false,
			overCap: false,
			belowFloor: false,
			submitEnabled: true,
		});
	});

	it("gating::amount-exactly-cap-is-not-over-cap (strict >)", () => {
		// Plan §6 edge 1 — mirrors clampStakeToMax's strict inequality.
		expect(
			assessAmount({
				kind: "post",
				amount: BET_MAX_STAKE,
				spendableToday: SPEND_ABOVE_CAP,
			}),
		).toEqual({
			clampedAmount: BET_MAX_STAKE,
			composerDisabled: false,
			overCap: false,
			belowFloor: false,
			submitEnabled: true,
		});
	});

	it("gating::cap-plus-one-is-over-cap", () => {
		expect(
			assessAmount({
				kind: "post",
				amount: CAP_PLUS_ONE,
				spendableToday: SPEND_ABOVE_CAP,
			}),
		).toEqual({
			clampedAmount: CAP_PLUS_ONE,
			composerDisabled: false,
			overCap: true,
			belowFloor: false,
			submitEnabled: false,
		});
	});

	it("gating::floor-above-balance-disables-the-post-composer (INV-2 row)", () => {
		expect(
			assessAmount({
				kind: "post",
				amount: BET_MIN_STAKE_POST,
				spendableToday: POST_FLOOR_MINUS_ONE,
			}),
		).toEqual({
			clampedAmount: POST_FLOOR_MINUS_ONE,
			composerDisabled: true,
			overCap: false,
			belowFloor: true,
			submitEnabled: false,
		});
	});

	it("gating::floor-above-balance-reply-decimal-exact", () => {
		// spendable 49.999999999999999999 < the reply floor 50 by exactly
		// 1e-18 — a float comparison would collapse this; decimal must not.
		expect(
			assessAmount({
				kind: "reply",
				amount: BET_MIN_STAKE_REPLY,
				spendableToday: REPLY_EPS_BELOW,
			}),
		).toEqual({
			clampedAmount: REPLY_EPS_BELOW,
			composerDisabled: true,
			overCap: false,
			belowFloor: true,
			submitEnabled: false,
		});
	});

	it("gating::spendable-exactly-at-floor-is-not-disabled", () => {
		// composerDisabled is STRICT < — at-floor balance can place the
		// minimum bet.
		expect(
			assessAmount({
				kind: "post",
				amount: BET_MIN_STAKE_POST,
				spendableToday: BET_MIN_STAKE_POST,
			}),
		).toEqual({
			clampedAmount: BET_MIN_STAKE_POST,
			composerDisabled: false,
			overCap: false,
			belowFloor: false,
			submitEnabled: true,
		});
	});

	it("gating::floor-selection-reply-rejects-a-post-floor-amount", () => {
		// The §1 floors narrative: a reply amount at the (lower) post floor is
		// belowFloor — the selection matrix never falls through to the post
		// floor. Only meaningful while POST < REPLY (defensive skip mirrors
		// floors.test.ts).
		if (intOf(BET_MIN_STAKE_POST) >= intOf(BET_MIN_STAKE_REPLY)) return;
		expect(
			assessAmount({
				kind: "reply",
				amount: BET_MIN_STAKE_POST,
				spendableToday: AMPLE,
			}),
		).toEqual({
			clampedAmount: BET_MIN_STAKE_POST,
			composerDisabled: false,
			overCap: false,
			belowFloor: true,
			submitEnabled: false,
		});
		// The same amount under the POST kind is at-floor → enabled.
		expect(
			assessAmount({
				kind: "post",
				amount: BET_MIN_STAKE_POST,
				spendableToday: AMPLE,
			}),
		).toEqual({
			clampedAmount: BET_MIN_STAKE_POST,
			composerDisabled: false,
			overCap: false,
			belowFloor: false,
			submitEnabled: true,
		});
	});

	it("gating::mid-floor-spendable-disables-reply-not-post", () => {
		if (intOf(BET_MIN_STAKE_POST) >= intOf(BET_MIN_STAKE_REPLY)) return;
		const midFloorSpendable = String(
			(intOf(BET_MIN_STAKE_POST) + intOf(BET_MIN_STAKE_REPLY)) / BigInt(2),
		); // "30"
		expect(
			assessAmount({
				kind: "reply",
				amount: BET_MIN_STAKE_REPLY,
				spendableToday: midFloorSpendable,
			}).composerDisabled,
		).toBe(true);
		expect(
			assessAmount({
				kind: "post",
				amount: BET_MIN_STAKE_POST,
				spendableToday: midFloorSpendable,
			}),
		).toEqual({
			clampedAmount: BET_MIN_STAKE_POST,
			composerDisabled: false,
			overCap: false,
			belowFloor: false,
			submitEnabled: true,
		});
	});

	it("gating::epsilon-above-the-post-floor-clears-it (decimal-exact)", () => {
		// 10.000000000000000001 > 10 must hold at full NUMERIC(38,18) width.
		expect(
			assessAmount({
				kind: "post",
				amount: POST_EPS_ABOVE,
				spendableToday: AMPLE,
			}),
		).toEqual({
			clampedAmount: POST_EPS_ABOVE,
			composerDisabled: false,
			overCap: false,
			belowFloor: false,
			submitEnabled: true,
		});
	});

	it("gating::degenerate-amounts-are-below-floor-never-over-cap", () => {
		// Empty / non-numeric / zero / negative → belowFloor true, overCap
		// false, submit disabled (clampedAmount unspecified for these).
		for (const amount of ["", "abc", "0", "-5"]) {
			const assessed = assessAmount({
				kind: "post",
				amount,
				spendableToday: AMPLE,
			});
			expect(assessed.belowFloor).toBe(true);
			expect(assessed.overCap).toBe(false);
			expect(assessed.submitEnabled).toBe(false);
			expect(assessed.composerDisabled).toBe(false);
		}
	});
});

describe("isEntryDisabled — the F-3 predicate matrix", () => {
	it("gating::f3-no-held-side-never-disables", () => {
		expect(isEntryDisabled({ resultingSide: "YES", heldSide: null })).toBe(
			false,
		);
		expect(isEntryDisabled({ resultingSide: "NO", heldSide: null })).toBe(
			false,
		);
	});

	it("gating::f3-same-resulting-side-is-enabled", () => {
		expect(isEntryDisabled({ resultingSide: "YES", heldSide: "YES" })).toBe(
			false,
		);
		expect(isEntryDisabled({ resultingSide: "NO", heldSide: "NO" })).toBe(
			false,
		);
	});

	it("gating::f3-opposite-resulting-side-is-disabled", () => {
		expect(isEntryDisabled({ resultingSide: "NO", heldSide: "YES" })).toBe(
			true,
		);
		expect(isEntryDisabled({ resultingSide: "YES", heldSide: "NO" })).toBe(
			true,
		);
	});

	it("gating::f3-named-row-yes-holder-on-a-no-post", () => {
		// THE F-3 row (plan §6 + Ratification F-3): viewer holds YES, focused
		// post is NO. Support derives the post's side (NO) → DISABLED; Counter
		// derives the opposite (YES) → ENABLED. The predicate runs on the
		// RESULTING side, never the slot the composer renders in.
		const supportSide = deriveReplySide({
			parentSide: "NO",
			relation: "support",
		});
		expect(supportSide).toBe("NO");
		expect(
			isEntryDisabled({ resultingSide: supportSide, heldSide: "YES" }),
		).toBe(true);
		const counterSide = deriveReplySide({
			parentSide: "NO",
			relation: "counter",
		});
		expect(counterSide).toBe("YES");
		expect(
			isEntryDisabled({ resultingSide: counterSide, heldSide: "YES" }),
		).toBe(false);
	});

	it("gating::f3-yes-holder-on-a-yes-post", () => {
		// Plan §6: Support (→YES) enabled; Counter (→NO) disabled.
		expect(
			isEntryDisabled({
				resultingSide: deriveReplySide({
					parentSide: "YES",
					relation: "support",
				}),
				heldSide: "YES",
			}),
		).toBe(false);
		expect(
			isEntryDisabled({
				resultingSide: deriveReplySide({
					parentSide: "YES",
					relation: "counter",
				}),
				heldSide: "YES",
			}),
		).toBe(true);
	});
});

describe("deriveReplySide — the INV-3 derivation matrix (plan §1 row 3)", () => {
	it("gating::support-inherits-the-parent-side", () => {
		expect(deriveReplySide({ parentSide: "YES", relation: "support" })).toBe(
			"YES",
		);
		expect(deriveReplySide({ parentSide: "NO", relation: "support" })).toBe(
			"NO",
		);
	});

	it("gating::counter-takes-the-opposite-side", () => {
		expect(deriveReplySide({ parentSide: "YES", relation: "counter" })).toBe(
			"NO",
		);
		expect(deriveReplySide({ parentSide: "NO", relation: "counter" })).toBe(
			"YES",
		);
	});
});
