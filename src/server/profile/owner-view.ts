import "server-only";

import { CpmmDecimal } from "@/server/cpmm/decimal";

import type { ProfilePositionRow } from "./positions";

/**
 * The owner-vs-visitor positions payload (F-PROF-3 — SPEC.1 §23 "Owner vs
 * visitor"). Sell-eligibility exists ONLY on the owner arm; the visitor arm is
 * the plain `ProfilePositionRow[]` — structurally no `sellEligible` field, so
 * "Sell is never present in a visitor payload" is enforced at the DTO boundary,
 * not just at render (plan §3/§13 item 2).
 */
export type SellablePositionRow = ProfilePositionRow & {
	sellEligible: boolean;
};

export type ProfilePositionsPayload =
	| { owner: false; rows: ProfilePositionRow[] }
	| { owner: true; rows: SellablePositionRow[] };

/**
 * A holding is sellable IFF its market is `Open` AND a positive quantity is
 * held (SPEC.1 §23 "sellable iff its market is `Open` and `quantity > 0`";
 * buys and sells require `Open`, §7). Closed/Resolving/Resolved/Voided/Frozen
 * (`statusLabel === "Closed"`) and settled rows are never sellable. The read
 * model's `quantity > 0` row domain makes the quantity check defensive.
 */
export function isSellEligible(row: ProfilePositionRow): boolean {
	return (
		row.statusLabel === "Open" &&
		!row.settled &&
		new CpmmDecimal(row.quantity).greaterThan(0)
	);
}

/**
 * Build the viewer-appropriate positions payload. The visitor arm passes the
 * rows through untouched (no sell affordance); the owner arm decorates each row
 * with `sellEligible`. Pure — the RSC computes `owner` server-side
 * (`session.user.id === profileUser.id`) and never exposes the owner arm to a
 * visitor.
 */
export function buildPositionsPayload(
	rows: ProfilePositionRow[],
	owner: boolean,
): ProfilePositionsPayload {
	if (!owner) {
		return { owner: false, rows };
	}
	return {
		owner: true,
		rows: rows.map((r) => ({ ...r, sellEligible: isSellEligible(r) })),
	};
}
