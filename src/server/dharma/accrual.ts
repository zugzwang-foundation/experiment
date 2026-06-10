import "server-only";

import { eq, sql } from "drizzle-orm";
import type { z } from "zod";

import type { DbTransaction } from "@/db";
import { users } from "@/db/schema";
import { DAILY_CREDIT_DHARMA } from "@/server/config/limits";
import { CpmmDecimal } from "@/server/cpmm/decimal";
import { insertEvent } from "@/server/events/insert";
import {
	type eventMetadataSchema,
	numericString,
} from "@/server/events/schemas";

import { DharmaInputError } from "./errors";
import { appendLedgerRow } from "./persist";

/**
 * ENGINE.12 — the Daily Credit producer (ADR-0018 + SPEC.1 §10.4). A flat
 * issuance paid ONCE per UTC day, ONLY inside a committed comment-bearing bet
 * (post or reply; never a sell), accrued lazily at the `place()` seam. The
 * complete write set is exactly three (R2): cursor UPDATE +
 * `dharma_ledger(daily_allowance)` + `events(dharma.credited)` — no
 * `user_events` row.
 *
 * **Day authority (R3).** Tx-frozen DB `now()` is the SINGLE day authority:
 * the decision read fetches the cursor AND the tx clock in one statement; the
 * cursor UPDATE (`now()`), the ledger row's `created_at` (DEFAULT `now()`),
 * the payload's `creditedForDate`, and the backstop-index expression all
 * derive from that ONE frozen clock. A midnight-straddling retry is a fresh
 * tx — one clock, one day; the aborted attempt's writes vanish. The ONE
 * divergence: the events ROW timestamp derives from the handler-entry UUIDv7
 * ms prefix (`insert.ts`) — that is the event-row timestamp, NOT the accrual
 * key; `creditedForDate` computes from tx `now()`, never from the event_id.
 *
 * **Serialization (R3, discharges `persist.ts` D-2 for ENGINE.12).** The
 * cursor write is the serialization point: two same-user txs that both read
 * an unpaid cursor collide on the `users` row write — cursor-first ordering
 * (D-N1) makes the first conflict deterministically `40001` (retryable), the
 * W-1 wrapper re-runs the whole callback, and the rerun sees the cursor and
 * skips. The bet always proceeds; the credit pays exactly once. The UNIQUE
 * partial expression index `dharma_ledger_daily_allowance_day_uq` is a
 * storage backstop that can only fire on a future logic bug (23505, loud).
 *
 * **LOCK-ORDER NOTE (mandatory).** The W-1 wrapper acquires the POOL row
 * FIRST (`transaction.ts` `FOR NO KEY UPDATE`); the users-row write happens
 * SECOND, inside the callback. Global order **pools → users** — no cycle.
 * Different-market same-user races hold different pool rows, then collide on
 * the one users row → serialization failure → wrapper retry (NOT deadlock —
 * the order is consistent across all writers). Same-market same-user is
 * already fully serialized by the pool lock. ADR-0013 §5.12 Patch record
 * canonicalizes the extension; no other code path writes `users` inside a
 * pool-locked transaction.
 */

/**
 * UTC calendar day (YYYY-MM-DD) of an instant. The day math BOTH decision
 * operands flow through — both are DB-sourced timestamps from the same tx
 * snapshot, so the single-clock rule holds (R3).
 */
export function utcDayOf(d: Date): string {
	return d.toISOString().slice(0, 10);
}

/**
 * The P2 producer guard: the credit amount must be a strictly positive
 * `numericString`. The ledger core enforces only the overdraft floor
 * (`ledger.ts` — per-tag sign is producer-owned); this is the producer's
 * side. `"-0"` is not strictly positive (the `_probe-decimal-negzero`
 * landmine — `numericString` admits it; the sign guard must not).
 */
export function validateCreditAmount(amount: string): void {
	if (!numericString.safeParse(amount).success) {
		throw new DharmaInputError(
			`daily credit amount is not a numericString: ${amount}`,
		);
	}
	if (!new CpmmDecimal(amount).greaterThan(0)) {
		throw new DharmaInputError(
			`daily credit amount must be strictly positive: ${amount}`,
		);
	}
}

export interface AccrueDailyCreditArgs {
	userId: string;
	/** The balance already read by the caller in this locked snapshot (`readBalance`) — chained, never re-read. */
	previousBalance: string;
	/** Minted ONCE at handler entry, closed over (P1 retry-purity) — NEVER regenerated per attempt. */
	creditEventId: string;
	/** Same 7-field shape as the bet events' metadata (`schemas.ts`) — typed from events, not from bets (no type cycle). */
	metadata: z.infer<typeof eventMetadataSchema>;
}

export interface AccrueDailyCreditResult {
	credited: boolean;
	/** Post-credit balance when credited; `previousBalance` unchanged when not. */
	balanceAfter: string;
	/** The committing tx's UTC day when credited; null when not. */
	creditedForDate: string | null;
}

/**
 * Accrue the Daily Credit if the user is unpaid for the tx's UTC day. Runs
 * INSIDE the caller's W-1 SERIALIZABLE locked snapshot, between the balance
 * read and the friendly pre-check (R4 — the day's credit funds the day's
 * first bet).
 *
 * Decision read: ONE statement fetching the cursor + the tx clock together.
 * Unpaid ⇔ `last_allowance_accrued_at IS NULL || utcDayOf(cursor) !==
 * utcDayOf(txNow)`. An already-paid day is a PURE READ — no users write, no
 * added lock — so steady-state hot-path contention is unchanged (F3c).
 *
 * Write set when unpaid, in the R-CP1 RULED order (D-N1 — cursor FIRST so a
 * same-user race's first conflict is the retryable users-row `40001`, never
 * the backstop index's terminal `23505`):
 *   1. cursor UPDATE (`last_allowance_accrued_at = now()`, `updated_at =
 *      now()` — F3a: the column exists);
 *   2. `appendLedgerRow` — `daily_allowance`, `bet_id` NULL (P2), chained off
 *      `previousBalance`;
 *   3. `insertEvent` — `dharma.credited`, aggregate `dharma_account`/userId.
 *
 * Atomicity delivers ADR-0018's conditionality for free: any in-tx failure
 * rolls back credit + cursor together — "paid only on placing a commented
 * bet" is enforced by rollback, not by a check. The cursor is a derivable
 * projection (ADR-0005): reconstructible as
 * `max((timezone('UTC', created_at))::date)` over the user's
 * `daily_allowance` rows — mutating it in place is the SPEC-named
 * idempotency-cursor pattern, not state-in-place drift.
 */
export async function accrueDailyCredit(
	tx: DbTransaction,
	args: AccrueDailyCreditArgs,
): Promise<AccrueDailyCreditResult> {
	const rows = await tx
		.select({
			cursor: users.lastAllowanceAccruedAt,
			// `.mapWith` is LOAD-BEARING: a bare sql<Date> fragment has NO runtime
			// decoder (drizzle's postgres-js driver parses timestamptz transparently
			// as a wire string), while the `cursor` column decodes via its column
			// decoder. Borrowing that same decoder keeps both operands congruent
			// Dates — the single-clock rule at the type AND runtime layer.
			txNow: sql`now()`.mapWith(users.lastAllowanceAccruedAt),
		})
		.from(users)
		.where(eq(users.id, args.userId));

	const row = rows[0];
	if (row === undefined) {
		// Caller bug — the gate-1 auth+ban read already proved the row exists
		// (the `lockPool` missing-row precedent). Non-retryable, bubbles.
		throw new Error(`accrueDailyCredit: no users row for ${args.userId}`);
	}

	const { cursor, txNow } = row;
	if (cursor !== null && utcDayOf(cursor) === utcDayOf(txNow)) {
		return {
			credited: false,
			balanceAfter: args.previousBalance,
			creditedForDate: null,
		};
	}

	validateCreditAmount(DAILY_CREDIT_DHARMA);

	// 1. Cursor UPDATE — the serialization point (D-N1: FIRST write).
	await tx
		.update(users)
		.set({
			lastAllowanceAccruedAt: sql`now()`,
			updatedAt: sql`now()`,
		})
		.where(eq(users.id, args.userId));

	// 2. Ledger append — chained off the caller's already-read balance
	// (`persist.ts` chaining contract: same-user multi-row tx).
	const { balanceAfter } = await appendLedgerRow(tx, {
		userId: args.userId,
		amount: DAILY_CREDIT_DHARMA,
		entryType: "daily_allowance",
		betId: null,
		previousBalance: args.previousBalance,
	});

	// 3. Event — id minted at handler entry (P1); `creditedForDate` from the
	// tx clock, never from the event_id.
	const creditedForDate = utcDayOf(txNow);
	await insertEvent(tx, {
		eventId: args.creditEventId,
		eventType: "dharma.credited",
		aggregateType: "dharma_account",
		aggregateId: args.userId,
		payload: {
			userId: args.userId,
			amount: DAILY_CREDIT_DHARMA,
			creditedForDate,
		},
		metadata: args.metadata,
	});

	return { credited: true, balanceAfter, creditedForDate };
}
