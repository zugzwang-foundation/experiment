import "server-only";

import { desc, eq } from "drizzle-orm";

import type { DbTransaction } from "@/db";
import { dharmaLedger } from "@/db/schema";

import { computeLedgerRow } from "./ledger";
import type { DharmaEntryType } from "./tags";

const CANONICAL_ZERO = "0.000000000000000000";

/**
 * Reads the user's latest `balance_after` inside the caller's transaction —
 * the running-total cursor. `ORDER BY seq DESC LIMIT 1` is the TOTAL-ORDER
 * contract (ADR-0029, migration 0020): `seq` is `GENERATED ALWAYS AS
 * IDENTITY`, so per-user seq order ≡ insert order ≡ chain order under the
 * caller's per-user write serialization (D-2). The previous
 * `(created_at DESC, id DESC)` ordering was NOT chain-safe: `created_at` is
 * tx-frozen `now()` (ties across one tx's appends) and the userspace
 * `uuidv7()` fills trailing bits randomly (ADR-0016) — a cross-tx read over
 * a tie-group could return the chain-earlier row, minting/burning Dharma off
 * the stale base (the A2 defect, AUDIT-FIX-B2). The `previousBalance`
 * chaining contract (see `appendLedgerRow`) remains the in-tx optimization.
 * Returns the canonical zero string when the user has no rows yet (first
 * ledger row).
 */
async function readLatestBalance(
	tx: DbTransaction,
	userId: string,
): Promise<string> {
	const rows = await tx
		.select({ balanceAfter: dharmaLedger.balanceAfter })
		.from(dharmaLedger)
		.where(eq(dharmaLedger.userId, userId))
		.orderBy(desc(dharmaLedger.seq))
		.limit(1);
	return rows[0]?.balanceAfter ?? CANONICAL_ZERO;
}

/**
 * Exported balance read (carry-forward 2) — the public alias of the module's
 * `readLatestBalance` cursor. ENGINE.8's bet handlers read it inside the locked
 * snapshot for the friendly `insufficient_dharma` (F-BET-4) pre-check, then
 * thread the value into `appendLedgerRow({ previousBalance })`. The
 * `DharmaOverdraftError` + storage `CHECK (balance_after >= 0)` remain the
 * authoritative INV-2 backstop; this read is the user-facing courtesy gate only.
 */
export { readLatestBalance as readBalance };

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
 * Multi-row-per-user txs chain via the prior call's returned `balanceAfter`
 * (live case: ENGINE.9 reverse+uncollectable pair). Post-0020 the auto-read
 * is seq-ordered and correct even over same-tx `created_at` ties (ADR-0029);
 * chaining stays as the convention — it saves the read and keeps multi-leg
 * intent explicit. The PK is a DB DEFAULT `uuidv7()` (ADR-0016 — no
 * app-side id).
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
