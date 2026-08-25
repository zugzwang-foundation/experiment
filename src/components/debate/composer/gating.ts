import {
	BET_MAX_STAKE,
	BET_MIN_STAKE_POST,
	BET_MIN_STAKE_REPLY,
} from "@/server/config/limits";
import { ComposerDecimal } from "./sell-convert";

/**
 * UI.A3 slice 1 — composer amount gating + the F-3 opposite-side predicate +
 * the Support/Counter side derivation (plan §3.2/§4/§6 + Ratification F-3).
 * PURE decision logic over decimal strings (never JS floats — CLAUDE.md §2);
 * the components render what this module decides.
 *
 * `@/server/config/limits` is a zero-import pure-data module (no
 * `server-only`) — binding the REAL floors/cap here is the SG-6 law.
 */

export type Side = "YES" | "NO";
export type ComposerKind = "post" | "reply";

/** ADR-0018 floor selection by composer kind (post 10 / reply 50 today). */
export function floorFor(kind: ComposerKind): string {
	return kind === "post" ? BET_MIN_STAKE_POST : BET_MIN_STAKE_REPLY;
}

const PLAIN_DECIMAL = /^\d+(\.\d+)?$/;

/** A parseable, strictly-positive decimal string (the amount validity gate). */
export function isPositiveAmount(value: string): boolean {
	return PLAIN_DECIMAL.test(value) && new ComposerDecimal(value).greaterThan(0);
}

/**
 * The T3 input bound (INV-2 display half): an amount above `spendableToday`
 * clamps to it; otherwise the input's bytes pass through untouched (the
 * comparison is decimal-exact, the output byte-exact).
 */
export function clampAmountToSpendable(
	amount: string,
	spendableToday: string,
): string {
	return new ComposerDecimal(amount).greaterThan(spendableToday)
		? spendableToday
		: amount;
}

export type AmountAssessment = {
	clampedAmount: string;
	/** Floor-above-balance: spendableToday < the kind's floor (strict <). */
	composerDisabled: boolean;
	/** W2.10-D: clamped amount STRICTLY above BET_MAX_STAKE — strip + disable. */
	overCap: boolean;
	belowFloor: boolean;
	submitEnabled: boolean;
};

/**
 * Clamp-then-evaluate (T3 first, then the cap/floor reads on the clamped
 * value): the over-cap strip is reachable only in the (spendableToday > cap)
 * window; a degenerate amount (empty / non-numeric / ≤ 0) reads as
 * below-floor, never over-cap. The server's F-BET-4 check + floors stay
 * authoritative — this is the display-grade bound over the SAME
 * `spendableToday` field the place path makes real (§1 faucet narrative).
 */
export function assessAmount(args: {
	kind: ComposerKind;
	amount: string;
	spendableToday: string;
}): AmountAssessment {
	const floor = floorFor(args.kind);
	const composerDisabled = new ComposerDecimal(args.spendableToday).lessThan(
		floor,
	);
	if (!isPositiveAmount(args.amount)) {
		return {
			clampedAmount: args.amount,
			composerDisabled,
			overCap: false,
			belowFloor: true,
			submitEnabled: false,
		};
	}
	const clampedAmount = clampAmountToSpendable(
		args.amount,
		args.spendableToday,
	);
	const clamped = new ComposerDecimal(clampedAmount);
	const overCap = clamped.greaterThan(BET_MAX_STAKE);
	const belowFloor = clamped.lessThan(floor);
	return {
		clampedAmount,
		composerDisabled,
		overCap,
		belowFloor,
		submitEnabled: !composerDisabled && !overCap && !belowFloor,
	};
}

/**
 * F-3 (ratified OQ-5a): disable ⇔ RESULTING side ≠ held side, uniform across
 * market poles and reply triggers. The predicate runs on the RESULTING side,
 * never the slot the composer renders in (slot ≠ side — §1 INV-3 narrative).
 * The server's `opposite_side_held` 400 stays authoritative.
 */
export function isEntryDisabled(args: {
	resultingSide: Side;
	heldSide: Side | null;
}): boolean {
	return args.heldSide !== null && args.heldSide !== args.resultingSide;
}

/**
 * The INV-3 derivation (plan §1 row 3): a reply's WIRE side derives from the
 * parent's side and the relation — Support inherits, Counter opposes. Fixed
 * at composer open, immutable per instance.
 */
export function deriveReplySide(args: {
	parentSide: Side;
	relation: "support" | "counter";
}): Side {
	if (args.relation === "support") {
		return args.parentSide;
	}
	return args.parentSide === "YES" ? "NO" : "YES";
}

/**
 * RPLY-1 · R1 — the pole column a REPLY composer hosts in: the one OPPOSITE the
 * side being bet.
 *
 * ⛔⛔ IT TAKES THE RELATION, AND THAT IS THE WHOLE POINT OF ITS SIGNATURE. The
 * shipped expression was `opposite(post.sideAtPostTime)` — a function of the
 * PARENT's side alone — so Support and Counter could not produce different
 * columns. Support coincided with the correct answer by arithmetic accident (a
 * Support bet inherits its parent's side, so opposite-the-parent IS
 * opposite-the-bet); Counter did not, and opened the composer on top of the very
 * side it was betting.
 *
 * ⚠ THE RULE WAS FAILING ITS OWN STATED REASON. design-canon §3.3 gives it as
 * "the bet's side stays visible" — and the bet's side was exactly what the
 * composer covered on every Counter.
 *
 * ⇒ EXPORTED RATHER THAN INLINED, deliberately: taking `relation` as a required
 * argument makes the dependency TYPE-VISIBLE, so a revert to keying off the
 * parent alone is a compile error at the call site rather than a silent
 * re-inversion. O-1 — structural beats procedural. It also makes the four-row
 * matrix assertable as BEHAVIOUR over shipped code rather than as a string
 * match against a component that cannot be mounted without the whole bet stack.
 *
 * ⚠ The side derivation is REUSED, never re-implemented — this composes
 * `deriveReplySide` so the column and the badge cannot disagree about a
 * relation. Both are pure, so deriving the side twice cannot drift.
 */
export function replyComposerColumn(args: {
	parentSide: Side;
	relation: "support" | "counter";
}): Side {
	return deriveReplySide(args) === "YES" ? "NO" : "YES";
}
