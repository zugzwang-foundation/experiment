import "server-only";

import { CpmmDecimal, floor18, toFixed18 } from "@/server/cpmm/decimal";

const CANONICAL_ZERO = "0.000000000000000000";

type Side = "YES" | "NO";

/**
 * The pure pro-rata splitter (R-9.8). Splits `total` (the position-level
 * truth) across `rows` proportionally to `weight`, EXACTLY:
 *
 *   - rows sorted by `id` ascending (UUIDv7 — stable, deterministic; NOT
 *     chronological, which is irrelevant here);
 *   - rows 1..n−1: `amount_i = floor18(total × weight_i / Σ weights)` — the
 *     division computed exactly at CpmmDecimal precision 50 per row (never a
 *     rounded scalar `f`; rounding compounds);
 *   - row n: `amount_n = total − Σ amount_{1..n−1}` — the deterministic
 *     last-row remainder. Floors under-allocate, so `amount_n ≥` its exact
 *     share `≥ 0` (defensively asserted);
 *   - invariants: `Σ amounts == total` EXACTLY; every amount ≥ 0;
 *     `total = 0` ⇒ all zeros; empty rows require total = 0 (else throw —
 *     caller bug). All outputs canonical 18-dp strings (CLAUDE.md §2).
 */
export function prorate(args: {
	rows: readonly { id: string; weight: string }[];
	total: string;
}): { id: string; amount: string }[] {
	const total = new CpmmDecimal(args.total);
	if (total.lessThan(0)) {
		throw new Error(`prorate: negative total ${args.total}`);
	}
	if (args.rows.length === 0) {
		if (!total.isZero()) {
			throw new Error(
				`prorate: non-zero total ${args.total} with no rows to allocate onto`,
			);
		}
		return [];
	}

	const sorted = [...args.rows].sort((a, b) =>
		a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
	);

	if (total.isZero()) {
		return sorted.map((row) => ({ id: row.id, amount: CANONICAL_ZERO }));
	}

	const sumWeights = sorted.reduce(
		(acc, row) => acc.plus(row.weight),
		new CpmmDecimal(0),
	);
	if (sumWeights.lessThanOrEqualTo(0)) {
		throw new Error(
			`prorate: non-zero total ${args.total} over non-positive weight sum`,
		);
	}

	const out: { id: string; amount: string }[] = [];
	let allocated = new CpmmDecimal(0);
	for (const row of sorted.slice(0, -1)) {
		const amount = floor18(total.times(row.weight).dividedBy(sumWeights));
		allocated = allocated.plus(amount);
		out.push({ id: row.id, amount });
	}

	const last = sorted[sorted.length - 1];
	if (last === undefined) {
		throw new Error("prorate: unreachable — rows verified non-empty");
	}
	const remainder = total.minus(allocated);
	if (remainder.lessThan(0)) {
		throw new Error(
			`prorate: negative last-row remainder ${remainder.toFixed(18)} (caller bug — floors cannot over-allocate)`,
		);
	}
	out.push({ id: last.id, amount: toFixed18(remainder) });
	return out;
}

/**
 * The settle/correct per-bet basis (R-9.8): for every bet in the market, the
 * paying-side surviving payout — `prorate` per (user, payingSide) with
 * weights = the bets' `share_quantity` and total = that user's paying-side
 * position quantity (absent row ⇒ 0). Losing-side and fully-sold (f = 0)
 * bets map to 0. Returns betId → canonical 18-dp amount, EVERY bet present
 * (§3.6 uniformity — zero legs are real rows).
 */
export function applySideBasis(args: {
	bets: readonly {
		id: string;
		userId: string;
		side: Side;
		shareQuantity: string;
	}[];
	positions: readonly { userId: string; side: Side; quantity: string }[];
	payingSide: Side;
}): Map<string, string> {
	const quantityByUser = new Map<string, string>();
	for (const position of args.positions) {
		if (position.side === args.payingSide) {
			quantityByUser.set(position.userId, position.quantity);
		}
	}

	const amounts = new Map<string, string>(
		args.bets.map((bet) => [bet.id, CANONICAL_ZERO]),
	);
	const byUser = new Map<string, { id: string; weight: string }[]>();
	for (const bet of args.bets) {
		if (bet.side !== args.payingSide) continue;
		const rows = byUser.get(bet.userId) ?? [];
		rows.push({ id: bet.id, weight: bet.shareQuantity });
		byUser.set(bet.userId, rows);
	}

	for (const [userId, rows] of byUser) {
		const total = quantityByUser.get(userId) ?? "0";
		for (const row of prorate({ rows, total })) {
			amounts.set(row.id, row.amount);
		}
	}
	return amounts;
}

/**
 * The void refund basis (R-9.8): per (user, held side),
 * `T_u = floor18(quantity × Σ stakes / Σ share_quantity)` over that user's
 * held-side bets, distributed per-bet by `prorate` with weights = `stake_i`
 * — refund per bet `= f × stake_i` with the exact-sum remainder. Sold-out
 * sides: f = 0, refund 0 (sale proceeds stand). Returns betId → canonical
 * 18-dp refund, EVERY bet present (zero legs included).
 */
export function refundBasis(args: {
	bets: readonly {
		id: string;
		userId: string;
		side: Side;
		stake: string;
		shareQuantity: string;
	}[];
	positions: readonly { userId: string; side: Side; quantity: string }[];
}): Map<string, string> {
	const quantityByUserSide = new Map<string, string>();
	for (const position of args.positions) {
		quantityByUserSide.set(
			`${position.userId}:${position.side}`,
			position.quantity,
		);
	}

	const amounts = new Map<string, string>(
		args.bets.map((bet) => [bet.id, CANONICAL_ZERO]),
	);
	const groups = new Map<
		string,
		{ id: string; stake: string; shareQuantity: string }[]
	>();
	for (const bet of args.bets) {
		const key = `${bet.userId}:${bet.side}`;
		const rows = groups.get(key) ?? [];
		rows.push({
			id: bet.id,
			stake: bet.stake,
			shareQuantity: bet.shareQuantity,
		});
		groups.set(key, rows);
	}

	for (const [key, rows] of groups) {
		const quantity = new CpmmDecimal(quantityByUserSide.get(key) ?? "0");
		if (quantity.isZero()) continue; // f = 0 — zeros already mapped
		const sumStakes = rows.reduce(
			(acc, row) => acc.plus(row.stake),
			new CpmmDecimal(0),
		);
		const sumShares = rows.reduce(
			(acc, row) => acc.plus(row.shareQuantity),
			new CpmmDecimal(0),
		);
		const total = floor18(quantity.times(sumStakes).dividedBy(sumShares));
		const split = prorate({
			rows: rows.map((row) => ({ id: row.id, weight: row.stake })),
			total,
		});
		for (const row of split) {
			amounts.set(row.id, row.amount);
		}
	}
	return amounts;
}

/**
 * Producer sign guards (C-4, §Sign table) — ENGINE.9 enforces at its ledger
 * write sites (the `validateCreditAmount` precedent); 0014's per-type CHECKs
 * are the storage mirror on `payout_events`.
 */
export function assertStrictlyPositive(amount: string, site: string): void {
	if (!new CpmmDecimal(amount).greaterThan(0)) {
		throw new Error(`${site}: amount must be strictly positive: ${amount}`);
	}
}

export function assertStrictlyNegative(amount: string, site: string): void {
	if (!new CpmmDecimal(amount).lessThan(0)) {
		throw new Error(`${site}: amount must be strictly negative: ${amount}`);
	}
}
