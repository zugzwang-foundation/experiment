import "server-only";

import { CpmmDecimal } from "@/server/cpmm/decimal";
import { canonicalize } from "@/server/dharma/canonical";
import { DharmaInputError } from "@/server/dharma/errors";

import { PositionInputError, PositionOversellError } from "./errors";

/**
 * Canonicalize a quantity string through the shared NUMERIC(38,18) authority
 * (`dharma/canonical` — `numericString` gate + `CpmmDecimal.toFixed(18)`),
 * translating its module-local `DharmaInputError` to this module's
 * `PositionInputError`. The dharma sentinel must not leak across the position
 * boundary (the unit test asserts `PositionInputError`).
 */
function toCanonical(value: string, label: string): string {
	try {
		return canonicalize(value);
	} catch (e) {
		if (e instanceof DharmaInputError) {
			throw new PositionInputError(
				`not a NUMERIC(38,18) decimal string: ${label}=${JSON.stringify(value)}`,
			);
		}
		throw e;
	}
}

/**
 * Apply a signed share delta to a position quantity. Pure — no IO, no clock, no
 * randomness. `newQuantity = previousQuantity + shareDelta`, exact 18-dp via
 * `CpmmDecimal` (no float ever — CLAUDE.md §2). Oversell-guarded: `< 0` throws
 * `PositionOversellError` (the application mirror of the storage CHECK — R-3);
 * `== 0` is allowed (the sell-to-zero / flip path). Returns the canonical 18-dp
 * string.
 *
 * `previousQuantity` is `"0.000…0"` for a new `(user, market, side)`;
 * `shareDelta` is signed (`+s` on a buy of cpmm shares `s`, `−sharesSold` on a
 * sell). Both are canonicalized internally — `add/sub` on ≤18-dp operands is
 * exact (no rounding).
 */
export function applyPositionDelta(args: {
	previousQuantity: string;
	shareDelta: string;
}): string {
	const previous = toCanonical(args.previousQuantity, "previousQuantity");
	const delta = toCanonical(args.shareDelta, "shareDelta");

	const next = new CpmmDecimal(previous).plus(delta);
	if (next.lessThan(0)) {
		throw new PositionOversellError(
			`position oversell: ${previous} + ${delta} = ${next.toFixed(18)} < 0`,
		);
	}
	return next.toFixed(18);
}

/** The emergent debate marker (F-DEBATE-2). */
export type Marker = "Flipped" | "Exited" | "none";

/**
 * Compute the emergent marker (R-4 — pure read; no snapshot table, no stored
 * marker). `sideAtPostTime` is `comments.side_at_post_time`, frozen at
 * post-time (INV-3) — this function only READS it, never moves the frozen
 * badge. `heldSide` is the user's current held side (`null` = no position).
 *
 * F-DEBATE-2 truth table: held === frozen → `"none"` (default, no badge);
 * held === opposite → `"Flipped"`; held === null → `"Exited"`.
 */
export function computeMarker(args: {
	sideAtPostTime: "YES" | "NO";
	heldSide: "YES" | "NO" | null;
}): Marker {
	if (args.heldSide === null) {
		return "Exited";
	}
	return args.heldSide === args.sideAtPostTime ? "none" : "Flipped";
}
