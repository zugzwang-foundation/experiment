import "server-only";

import { addBreadcrumb, captureMessage } from "@sentry/nextjs";
import { eq, sql } from "drizzle-orm";
import type { z } from "zod";

import { type DbTransaction, db } from "@/db";
import { markets, pools } from "@/db/schema";
import type { eventMetadataSchema } from "@/server/events/schemas";
import type { MarketStatus } from "@/server/markets/transitions";

import {
	ResolutionSerializationExhaustedError,
	ResolutionStateError,
} from "./errors";

/** The four resolution flows that funnel through the single W-3 write path. */
export type ResolutionFlow =
	| "F-ADMIN-3"
	| "F-RESOLVE-1"
	| "F-RESOLVE-2"
	| "F-RESOLVE-3";

/** The markets row, locked `FOR NO KEY UPDATE`, handed to the callback. */
export interface LockedMarket {
	id: string;
	status: MarketStatus;
	resolutionOutcome: "YES" | "NO" | "VOID" | null;
}

/**
 * The CPMM reserve row, locked `FOR NO KEY UPDATE` (when `lockPool`), handed
 * to the callback. Deliberately DUPLICATED from `bets/transaction.ts` rather
 * than imported — the C-3 constraint is W-1 stays untouched and uncoupled;
 * extracting shared pieces would put W-1 in this stratum's blast radius.
 */
export interface LockedPool {
	id: string;
	marketId: string;
	yesReserves: string;
	noReserves: string;
}

/** The SPEC.2 §3.7 metadata block every flow threads into its emits. */
export type ResolutionEventMetadata = z.infer<typeof eventMetadataSchema>;

/**
 * Full-jitter backoff bases (ms) — ADR-0013 decision parameters, mirrored
 * VERBATIM from W-1 (C-3). Budget = 1 initial attempt + 3 retries.
 */
const BACKOFF_BASES_MS = [50, 100, 200] as const;

/** serialization_failure + deadlock_detected — the only retryable SQLSTATEs. */
const RETRYABLE_SQLSTATES = new Set(["40001", "40P01"]);

/**
 * `statement_timeout` is PARAMETERISED per OQ-1 (RATIFIED): default 1_000 (the
 * W-1 value; the trigger uses it), the fan-out flows (settle/correct/void)
 * pass 5_000 — their batched INSERTs over thousands of bets can exceed W-1's
 * single-row budget, and a 57014 abort mid-settle is a stranded-Resolving
 * operator event. ADR-0013-style decision parameters; HARDEN re-tunes.
 */
const DEFAULT_STATEMENT_TIMEOUT_MS = 1000;
const IDLE_IN_TRANSACTION_TIMEOUT_MS = 30_000;

/**
 * The generic W-3 resolution-transaction wrapper — the lean sibling of W-1
 * (`bets/transaction.ts`), C-3. Opens ONE SERIALIZABLE transaction, locks the
 * `markets` row FIRST with `FOR NO KEY UPDATE` (consuming the lock-order slot
 * W-1 reserved — `bets/transaction.ts:79-82`), gates the LOCKED row's status
 * against `expectedStatus` (non-member → `ResolutionStateError`, not
 * retried), then (if `lockPool`) locks the pool row by `market_id`, runs the
 * per-flow callback, and retries the whole thing on SQLSTATE 40001/40P01
 * with full jitter.
 *
 * **Lock order (C-2 / ADR-0013 §5.12 P2):** global order `markets → pools →
 * positions → dharma_ledger → events`, preserving the P1 `pools → users`
 * suffix. No-cycle argument: W-1 acquires `pools` first and NEVER locks
 * `markets` (its status read is deliberately unlocked), W-3 acquires
 * `markets` then `pools` — a lock cycle needs two paths acquiring the same
 * two locks in opposite orders, and `markets` is locked by W-3 only, so no
 * path acquires `pools → markets`. Cross-wrapper contention lands as
 * retryable 40001 (consistent order ⇒ never 40P01).
 *
 * **The pool lock is the in-flight fence (R-9.4 / §Wrapper b):** a W-1 tx
 * that read `Open` and is still uncommitted holds the pool row, so
 * settle/void's `lockPool` BLOCKS until it commits or aborts; the flow then
 * reads `bets`/`positions` AFTER acquiring the lock and sees the committed
 * bet. A W-1 tx that has not yet reached its pool lock blocks behind W-3
 * instead; SSI detects the rw-antidependency and aborts one side with 40001.
 * The trigger needs no pool lock: it writes nothing the fence protects, and
 * its `Closed` precondition means no W-1 traffic gates open.
 *
 * **Retry-purity contract (mirrored from W-1, load-bearing):** every caller
 * mints all event ids at HANDLER ENTRY and closes over them (ADR-0016 D1);
 * `resolution_events.id` / `payout_events.id` / ledger ids are DB-default
 * `uuidv7()` read via `RETURNING` — tx-scoped, safe under full rollback.
 */
export async function runResolutionTransaction<T>(
	args: {
		marketId: string;
		flow: ResolutionFlow;
		/** Per-flow gate, evaluated on the LOCKED markets row. */
		expectedStatus: readonly MarketStatus[];
		/** trigger=false; settle/correct/void=true (the §Wrapper b fence). */
		lockPool: boolean;
		/** OQ-1: default 1_000 (W-1 mirror); fan-out flows pass 5_000. */
		statementTimeoutMs?: number;
	},
	callback: (ctx: {
		tx: DbTransaction;
		market: LockedMarket;
		pool: LockedPool | null;
	}) => Promise<T>,
): Promise<T> {
	const statementTimeoutMs =
		args.statementTimeoutMs ?? DEFAULT_STATEMENT_TIMEOUT_MS;
	if (!Number.isInteger(statementTimeoutMs) || statementTimeoutMs <= 0) {
		throw new Error(
			`runResolutionTransaction: invalid statementTimeoutMs ${statementTimeoutMs}`,
		);
	}

	let lastSqlstate = "";

	for (let attempt = 0; attempt <= BACKOFF_BASES_MS.length; attempt++) {
		try {
			return await db.transaction(
				async (tx) => {
					await applyTxTimeouts(tx, statementTimeoutMs);
					const market = await lockMarket(tx, args.marketId);
					if (!args.expectedStatus.includes(market.status)) {
						throw new ResolutionStateError({
							flow: args.flow,
							expected: args.expectedStatus,
							observed: market.status,
						});
					}
					const pool = args.lockPool ? await lockPool(tx, args.marketId) : null;
					return await callback({ tx, market, pool });
				},
				{ isolationLevel: "serializable" },
			);
		} catch (err) {
			const sqlstate = retryableSqlstate(err);

			// Non-retryable (ResolutionStateError, CorrectionOutcomeError,
			// validation, defensive throws…) → bubble immediately, no retry.
			if (sqlstate === null) {
				throw err;
			}

			lastSqlstate = sqlstate;

			// Retryable but the budget is spent → alarm, then the product error.
			if (attempt === BACKOFF_BASES_MS.length) {
				captureMessage("resolution_serialization_exhausted", {
					level: "error",
					tags: { sqlstate, flow: args.flow },
				});
				throw new ResolutionSerializationExhaustedError({
					sqlstate,
					flow: args.flow,
				});
			}

			addBreadcrumb({
				category: "resolution.transaction.retry",
				level: "warning",
				message: `resolution tx retry ${attempt + 1}/${BACKOFF_BASES_MS.length} on SQLSTATE ${sqlstate}`,
				data: { attempt: attempt + 1, sqlstate, flow: args.flow },
			});
			await sleep(fullJitter(BACKOFF_BASES_MS[attempt] ?? 0));
		}
	}

	// Unreachable: the final iteration always returns or throws above. Present
	// so the function is total for the type-checker.
	throw new ResolutionSerializationExhaustedError({
		sqlstate: lastSqlstate,
		flow: args.flow,
	});
}

/** SET LOCAL the per-tx timeouts (constant/validated ints — `sql.raw` safe). */
async function applyTxTimeouts(
	tx: DbTransaction,
	statementTimeoutMs: number,
): Promise<void> {
	await tx.execute(
		sql.raw(`SET LOCAL statement_timeout = ${statementTimeoutMs}`),
	);
	await tx.execute(
		sql.raw(
			`SET LOCAL idle_in_transaction_session_timeout = ${IDLE_IN_TRANSACTION_TIMEOUT_MS}`,
		),
	);
}

/**
 * Lock the markets row FIRST (`FOR NO KEY UPDATE` — status/outcome writes
 * never touch a PK/FK-target column). A missing market row is a caller bug →
 * plain throw, non-retryable.
 */
async function lockMarket(
	tx: DbTransaction,
	marketId: string,
): Promise<LockedMarket> {
	const rows = await tx
		.select({
			id: markets.id,
			status: markets.status,
			resolutionOutcome: markets.resolutionOutcome,
		})
		.from(markets)
		.where(eq(markets.id, marketId))
		.for("no key update");

	const market = rows[0];
	if (market === undefined) {
		throw new Error(`runResolutionTransaction: no market row for ${marketId}`);
	}
	return market;
}

/**
 * Lock the pool row by `market_id` SECOND (the W-1 lock, acquired after
 * `markets` — the consistent global order). A missing pool row is a
 * caller/setup bug → plain throw, non-retryable.
 */
async function lockPool(
	tx: DbTransaction,
	marketId: string,
): Promise<LockedPool> {
	const rows = await tx
		.select({
			id: pools.id,
			marketId: pools.marketId,
			yesReserves: pools.yesReserves,
			noReserves: pools.noReserves,
		})
		.from(pools)
		.where(eq(pools.marketId, marketId))
		.for("no key update");

	const pool = rows[0];
	if (pool === undefined) {
		throw new Error(
			`runResolutionTransaction: no pool row for market ${marketId}`,
		);
	}
	return pool;
}

/**
 * The retryable SQLSTATE, or `null` — `.cause.code` FIRST, then `.code` (the
 * W-1 extraction shape, duplicated per C-3). `as` at the trust boundary.
 */
function retryableSqlstate(err: unknown): string | null {
	const e = err as { code?: unknown; cause?: { code?: unknown } };
	const code = e.cause?.code ?? e.code;
	if (typeof code === "string" && RETRYABLE_SQLSTATES.has(code)) {
		return code;
	}
	return null;
}

/** Full jitter: `wait = random_uniform(0, base)` (AWS 2015; W-1 mirror). */
function fullJitter(baseMs: number): number {
	return Math.floor(Math.random() * baseMs);
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
