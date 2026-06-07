import "server-only";

import { desc, eq } from "drizzle-orm";

import type { DbTransaction } from "@/db";
import { dharmaLedger } from "@/db/schema";

import { computeLedgerRow } from "./ledger";
import type { DharmaEntryType } from "./tags";

const CANONICAL_ZERO = "0.000000000000000000";

/**
 * Reads the user's latest `balance_after` inside the caller's transaction —
 * the running-total cursor. `ORDER BY created_at DESC, id DESC LIMIT 1` is a
 * deterministic TOTAL order (`id` is the unique secondary key), but `id` is
 * NOT a sub-millisecond chronological tie-break — the userspace `uuidv7()`
 * fills trailing bits randomly (ADR-0016). This single-append read is correct
 * for ONE row per user per tx; for >1 row in one tx (`created_at` ties on the
 * frozen `now()`) the caller MUST use the `previousBalance` chaining contract
 * (see `appendLedgerRow`), not this ordering. Returns the canonical zero
 * string when the user has no rows yet (first ledger row).
 */
async function readLatestBalance(
	tx: DbTransaction,
	userId: string,
): Promise<string> {
	const rows = await tx
		.select({ balanceAfter: dharmaLedger.balanceAfter })
		.from(dharmaLedger)
		.where(eq(dharmaLedger.userId, userId))
		.orderBy(desc(dharmaLedger.createdAt), desc(dharmaLedger.id))
		.limit(1);
	return rows[0]?.balanceAfter ?? CANONICAL_ZERO;
}

/**
 * Appends one Dharma ledger row on the caller's bound transaction (V3
 * precedent — `insertEvent(tx, …)`; compile-error to pass top-level `db`).
 *
 * Per-user write serialization is the CALLER's obligation (D-2): read-latest-
 * then-insert is a write-skew shape; under SERIALIZABLE, SSI aborts one of two
 * concurrent same-user appends (40001) and the caller retries (ADR-0013).
 * Grant / daily-credit / resolution writes sit outside the ADR-0013 pool lock;
 * their callers (auth/onboarding, ENGINE.12, ENGINE.9) supply equivalent
 * per-user serialization.
 *
 * `previousBalance` is optional: when supplied it SKIPS the in-tx latest read.
 * It is REQUIRED for >1 row for the same user in one tx — `now()` is tx-frozen,
 * so `created_at` ties; the caller MUST chain via the prior call's returned
 * `balanceAfter` (live case: ENGINE.9 reverse+uncollectable pair). The PK is a
 * DB DEFAULT `uuidv7()` (ADR-0016 — no app-side id).
 */
export async function appendLedgerRow(
	tx: DbTransaction,
	args: {
		userId: string;
		amount: string;
		entryType: DharmaEntryType;
		betId?: string | null;
		previousBalance?: string;
	},
): Promise<{ id: string; balanceAfter: string }> {
	const previousBalance =
		args.previousBalance ?? (await readLatestBalance(tx, args.userId));

	const { amount, balanceAfter } = computeLedgerRow({
		previousBalance,
		amount: args.amount,
		entryType: args.entryType,
	});

	const inserted = await tx
		.insert(dharmaLedger)
		.values({
			userId: args.userId,
			betId: args.betId ?? null,
			entryType: args.entryType,
			amount,
			balanceAfter,
		})
		.returning({ id: dharmaLedger.id });

	const id = inserted[0]?.id;
	if (id === undefined) {
		throw new Error("appendLedgerRow: INSERT … RETURNING produced no row");
	}
	return { id, balanceAfter };
}
