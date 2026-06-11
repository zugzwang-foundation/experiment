import "server-only";

import { CpmmDecimal } from "@/server/cpmm/decimal";

import { canonicalize } from "./canonical";
import { DharmaInputError, DharmaPoolTagError } from "./errors";
import { type DharmaEntryType, FLOW_TAGS, POOL_DORMANT_TAGS } from "./tags";

/** Pure mismatch report — no `reason` field; `discrepancy = actual − expected`. */
export type ConservationResult =
	| { ok: true }
	| { ok: false; expected: string; actual: string; discrepancy: string };

const POOL_TAGS = new Set<DharmaEntryType>(POOL_DORMANT_TAGS);
const FLOW_SET = new Set<DharmaEntryType>(FLOW_TAGS);

/**
 * The per-market conservation identity (★, plan R-2/A1/A2/A8):
 *
 *   Σ amount over FLOW_TAGS (the market's bet-tied rows)  ==  NetAdminPoolInjection
 *
 * `uncollectable` is PRESENT-BUT-IGNORED — the forgiveness/audit record,
 * excluded from the flow sum (A1, independently re-derived). A stray pool tag
 * → `DharmaPoolTagError` (A8, same sentinel as the write path). A stray
 * `initial_grant` / `daily_allowance` (the `bet_id`-NULL issuance rows the
 * gathering query MUST exclude) → `DharmaInputError`. `ok: false` is returned
 * ONLY on a numeric mismatch — never on a tag violation (those throw).
 *
 * All inputs (flow amounts + `netAdminPoolInjection`) are canonicalized
 * DEFENSIVELY inside the checker — DB-sourced strings are NOT assumed
 * canonical (A9). `discrepancy = canonicalize(actual − expected)` (RATIFIED at
 * CP-1): positive ⇒ user-side flows exceed injection (over-issuance
 * direction). Equality is exact canonical-decimal value equality.
 */
export function checkMarketConservation(args: {
	ledgerFlows: readonly { amount: string; entryType: DharmaEntryType }[];
	netAdminPoolInjection: string;
}): ConservationResult {
	let actual = new CpmmDecimal(0);

	for (const flow of args.ledgerFlows) {
		if (POOL_TAGS.has(flow.entryType)) {
			throw new DharmaPoolTagError(
				`pool tag in conservation input (R-2): ${flow.entryType}`,
			);
		}
		if (flow.entryType === "uncollectable") {
			continue; // excluded from (★)
		}
		if (!FLOW_SET.has(flow.entryType)) {
			throw new DharmaInputError(
				`non-flow tag in conservation input (gathering query must exclude bet_id-NULL rows): ${flow.entryType}`,
			);
		}
		actual = actual.plus(canonicalize(flow.amount));
	}

	const expected = canonicalize(args.netAdminPoolInjection);
	if (actual.equals(expected)) {
		return { ok: true };
	}
	return {
		ok: false,
		expected,
		actual: actual.toFixed(18),
		discrepancy: actual.minus(expected).toFixed(18),
	};
}

/**
 * The correction-variant sibling (ENGINE.9, identity (ii) — plan
 * §Conservation; S2 option b / C-5; the shipped (★) body above is untouched):
 *
 *   Σ FLOW == netAdminPoolInjection − reverseRecordedTotal
 *                                   + applyRecordedTotal + uncollectableTotal
 *
 * All operands from RECORDED rows, never recomputed (R-9.8 corollary):
 * `reverseRecordedTotal` = Σ |correction_reverse payout legs| (≥ 0, the
 * recorded entitlements — NOT the floored ledger sum); `applyRecordedTotal`
 * = Σ correction_apply payout legs; `uncollectableTotal` = Σ |uncollectable
 * ledger rows| — the EXPLICIT named operand (R-9.6 explicitness over
 * tolerance). An `uncollectable` row inside `ledgerFlows` THROWS
 * `DharmaInputError` ("pass the total explicitly") — the loss is a named
 * operand, never an absorbed row. Pool tags throw (`DharmaPoolTagError`);
 * stray issuance tags throw (`DharmaInputError`); same A9 defensive
 * canonicalization as (★). With zero correction operands this degenerates
 * to (★) exactly.
 */
export function checkCorrectedMarketConservation(args: {
	ledgerFlows: readonly { amount: string; entryType: DharmaEntryType }[];
	netAdminPoolInjection: string;
	reverseRecordedTotal: string;
	applyRecordedTotal: string;
	uncollectableTotal: string;
}): ConservationResult {
	let actual = new CpmmDecimal(0);

	for (const flow of args.ledgerFlows) {
		if (POOL_TAGS.has(flow.entryType)) {
			throw new DharmaPoolTagError(
				`pool tag in conservation input (R-2): ${flow.entryType}`,
			);
		}
		if (flow.entryType === "uncollectable") {
			throw new DharmaInputError(
				"uncollectable row in correction-conservation input — pass the total explicitly (R-9.6)",
			);
		}
		if (!FLOW_SET.has(flow.entryType)) {
			throw new DharmaInputError(
				`non-flow tag in conservation input (gathering query must exclude bet_id-NULL rows): ${flow.entryType}`,
			);
		}
		actual = actual.plus(canonicalize(flow.amount));
	}

	const expected = new CpmmDecimal(canonicalize(args.netAdminPoolInjection))
		.minus(canonicalize(args.reverseRecordedTotal))
		.plus(canonicalize(args.applyRecordedTotal))
		.plus(canonicalize(args.uncollectableTotal));
	if (actual.equals(expected)) {
		return { ok: true };
	}
	return {
		ok: false,
		expected: expected.toFixed(18),
		actual: actual.toFixed(18),
		discrepancy: actual.minus(expected).toFixed(18),
	};
}
