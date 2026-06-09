import "server-only";

import { addBreadcrumb, captureMessage } from "@sentry/nextjs";
import { eq, sql } from "drizzle-orm";

import { type DbTransaction, db } from "@/db";
import { markets, pools } from "@/db/schema";
import type { MarketStatus } from "@/server/markets/transitions";

import { BetSerializationExhaustedError, MarketNotOpenError } from "./errors";

/**
 * The bet/comment write flows that all funnel through the single W-1 write path
 * (SPEC.2 §3.2; reply-as-bet means every comment rides a bet). W-2 is retired.
 */
export type BetFlow =
	| "F-BET-1"
	| "F-BET-2"
	| "F-BET-3"
	| "F-COMMENT-1"
	| "F-COMMENT-2"
	| "F-COMMENT-3";

/** The CPMM reserve row, locked `FOR NO KEY UPDATE`, handed to the callback. */
export interface LockedPool {
	id: string;
	marketId: string;
	yesReserves: string;
	noReserves: string;
}

/**
 * Full-jitter backoff bases (ms), one per retry. Budget = 1 initial attempt +
 * `BACKOFF_BASES_MS.length` retries = 4 attempts. These are ADR-0013 DECISION
 * PARAMETERS, NOT tunables (SPEC.2 §9:1003) — co-located here, not in config.
 * Reference: Marc Brooker, "Exponential Backoff And Jitter" (AWS, 2015).
 */
const BACKOFF_BASES_MS = [50, 100, 200] as const;

/** serialization_failure + deadlock_detected — the only retryable SQLSTATEs. */
const RETRYABLE_SQLSTATES = new Set(["40001", "40P01"]);

/**
 * Postgres knobs SET LOCAL inside the bet tx (ADR-0013 recommendations).
 * `statement_timeout` bounds every statement INCLUDING the lock-acquire wait, so
 * a stuck tx never holds the pool lock indefinitely (it covers the very first
 * lock-acquire — the moment the spine could otherwise hang). Once SET, the
 * following `idle_in_transaction_session_timeout` then bounds idle gaps between
 * the SUBSEQUENT statements (an orphaned tx the client stops driving mid-flight).
 * SET LOCAL (not a connection option) keeps this in-module — `src/db/` is out of
 * ENGINE.7's scope. Values are recommendations, not tuned constants (HARDEN.*).
 * (A `statement_timeout` abort raises SQLSTATE 57014, which is NOT retryable —
 * it bubbles to ENGINE.8 rather than firing alarm-3; the 57014↔alarm-3 question
 * is a HARDEN.* observability call — see claude-progress.md.)
 */
const STATEMENT_TIMEOUT_MS = 1000;
const IDLE_IN_TRANSACTION_TIMEOUT_MS = 30_000;

/**
 * The generic W-1 bet-transaction wrapper. Opens ONE SERIALIZABLE transaction,
 * locks the pool row by `market_id` with `FOR NO KEY UPDATE`, applies a coarse
 * market-state gate, runs the per-flow `callback` (which owns the 4-table spine
 * `pools → positions → dharma_ledger → events` + any comment/bet appends), and
 * wraps the whole thing in a full-jitter retry loop on SQLSTATE 40001/40P01.
 *
 * It is FLOW-AGNOSTIC: it knows nothing of CPMM math, Dharma tags, event types,
 * idempotency, moderation, or min-bet floors — all of those live in the
 * ENGINE.8 callback. It owns exactly: SERIALIZABLE open · pool-row lock · coarse
 * gate · retry · alarm-3 · `BetSerializationExhaustedError`.
 *
 * **`FOR NO KEY UPDATE`, not `FOR UPDATE`** (SPEC.2 §9:983; ADR-0013 §1): the
 * bet UPDATE touches only `yes_reserves`/`no_reserves` (never a PK/FK-target
 * column), so the weaker lock suffices AND stays compatible with the `FOR KEY
 * SHARE` Postgres takes implicitly when a child INSERT validates its FK — `FOR
 * UPDATE` would needlessly serialize those. Predicate is `market_id` (the caller
 * knows it; `pools.id` PK ≠ market id — ADR-0013 §1's snippet conflated them).
 *
 * **Coarse market-state gate** (plan ruling a): after the lock, a plain
 * UNLOCKED `SELECT markets.status` in the same snapshot. NO row lock on
 * `markets` — it must NOT enter the lock-order spine (a `pools → markets → …`
 * order risks deadlock vs W-3 resolution's `markets → …`). SSI catches a
 * concurrent status flip as 40001 → retry (no lost-update). Open → run the
 * callback; non-Open → `MarketNotOpenError` (NOT retried). The fine F-BET-6
 * in-flight window is deferred (no `markets.resolving_at` column yet — S1); the
 * coarse gate conservatively rejects ALL non-Open bets.
 *
 * **Retry-purity contract (load-bearing — the wrapper re-runs the ENTIRE
 * callback on every attempt).** Each attempt is a fresh tx + fresh pool lock +
 * fresh pool read + fresh callback invocation. A failed attempt rolls back
 * FULLY, so exactly-once is guaranteed by rollback. Therefore every caller
 * (ENGINE.8) MUST generate all IDs — the `event_id` passed to `insertEvent`, and
 * any `events.metadata.idempotency_key` — at HANDLER ENTRY, ONCE, and close over
 * them in the callback; NEVER regenerate per attempt. `insertEvent` derives
 * `created_at` from the `event_id`'s UUIDv7 millisecond prefix and dedupes via
 * `ON CONFLICT (event_id, created_at)`; a per-attempt-regenerated `event_id`
 * would drift `created_at` and defeat that dedupe. `bets.id` / `comments.id` are
 * DB-default `uuidv7()` and safe under full rollback — the contract governs the
 * CALLER-SUPPLIED `event_id`. The events-idempotency property test is its
 * enforcement surface.
 *
 * Second caller obligation (retry correctness): a retryable driver error
 * (SQLSTATE 40001/40P01) raised INSIDE the callback MUST propagate with its
 * `.code` / `.cause.code` intact. A callback that catches and re-wraps a driver
 * error in a custom class without preserving the SQLSTATE makes it invisible to
 * the retry filter, so a genuine serialization failure bubbles as a hard error
 * instead of retrying (fail-safe direction — never a silent commit, but a lost
 * retry).
 */
export async function runBetTransaction<T>(
	args: { marketId: string; flow: BetFlow },
	callback: (ctx: { tx: DbTransaction; pool: LockedPool }) => Promise<T>,
): Promise<T> {
	let lastSqlstate = "";

	for (let attempt = 0; attempt <= BACKOFF_BASES_MS.length; attempt++) {
		try {
			return await db.transaction(
				async (tx) => {
					await applyTxTimeouts(tx);
					const pool = await lockPool(tx, args.marketId);
					await assertMarketOpen(tx, args.marketId);
					// `await` (not a bare return): db.transaction awaits the arrow
					// either way, but awaiting here preserves the async stack frame
					// for Sentry attribution and is safe against a future try/finally.
					return await callback({ tx, pool });
				},
				{ isolationLevel: "serializable" },
			);
		} catch (err) {
			const sqlstate = retryableSqlstate(err);

			// Non-retryable (MarketNotOpenError, PositionSingleSideError, validation,
			// FK violations, etc.) → bubble immediately, no retry.
			if (sqlstate === null) {
				throw err;
			}

			lastSqlstate = sqlstate;

			// Retryable but the budget is spent → alarm 3, then the product error.
			if (attempt === BACKOFF_BASES_MS.length) {
				captureMessage("bet_serialization_exhausted", {
					level: "error",
					tags: { sqlstate, flow: args.flow },
				});
				throw new BetSerializationExhaustedError({
					sqlstate,
					flow: args.flow,
				});
			}

			// Retryable + budget remains → breadcrumb + full-jitter backoff, retry.
			addBreadcrumb({
				category: "bet.transaction.retry",
				level: "warning",
				message: `bet tx retry ${attempt + 1}/${BACKOFF_BASES_MS.length} on SQLSTATE ${sqlstate}`,
				data: { attempt: attempt + 1, sqlstate, flow: args.flow },
			});
			await sleep(fullJitter(BACKOFF_BASES_MS[attempt] ?? 0));
		}
	}

	// Unreachable: the final iteration always returns or throws above. Present so
	// the function is total for the type-checker.
	throw new BetSerializationExhaustedError({
		sqlstate: lastSqlstate,
		flow: args.flow,
	});
}

/**
 * SET LOCAL the per-tx timeouts. `SET` does not accept bind parameters, so the
 * (constant, non-user) millisecond values are inlined via `sql.raw`.
 */
async function applyTxTimeouts(tx: DbTransaction): Promise<void> {
	await tx.execute(
		sql.raw(`SET LOCAL statement_timeout = ${STATEMENT_TIMEOUT_MS}`),
	);
	await tx.execute(
		sql.raw(
			`SET LOCAL idle_in_transaction_session_timeout = ${IDLE_IN_TRANSACTION_TIMEOUT_MS}`,
		),
	);
}

/**
 * Lock the pool row for `marketId` with `FOR NO KEY UPDATE` and project it into
 * a `LockedPool`. Uses the Drizzle CORE builder `.for('no key update')` (the
 * relational query API has no `.for()`); `LockStrength` includes `'no key
 * update'` and the dialect renders ` for no key update` (drizzle-orm 0.45 — the
 * first in-repo call site, verified at execute). A missing pool row is a
 * caller/setup bug (every Open market is seeded a pool), surfaced as a plain
 * throw — non-retryable, bubbles.
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
		throw new Error(`runBetTransaction: no pool row for market ${marketId}`);
	}
	return pool;
}

/**
 * The coarse gate: a plain UNLOCKED `SELECT markets.status` in the locked
 * snapshot (NO `markets` row lock — see the wrapper docstring). Open → proceed;
 * non-Open → `MarketNotOpenError` carrying the observed status. A missing market
 * row is a caller bug (the pool FK guarantees the market exists) → plain throw.
 */
async function assertMarketOpen(
	tx: DbTransaction,
	marketId: string,
): Promise<void> {
	const rows = await tx
		.select({ status: markets.status })
		.from(markets)
		.where(eq(markets.id, marketId));

	const status: MarketStatus | undefined = rows[0]?.status;
	if (status === undefined) {
		throw new Error(`runBetTransaction: no market row for ${marketId}`);
	}
	if (status !== "Open") {
		throw new MarketNotOpenError(status);
	}
}

/**
 * The retryable SQLSTATE, or `null` if the error is not a retryable
 * serialization failure. Drizzle 0.45 wraps query-builder driver errors in a
 * `DrizzleQueryError` with the postgres-js SQLSTATE on `.cause`, leaving it
 * undefined at the top level; raw `tx.execute` / COMMIT-time failures carry
 * `.code` at the top level. So read `.cause.code` FIRST, then `.code` (the
 * `positions/persist.ts` `isSingleSideViolation` precedent). `as` at the trust
 * boundary — the driver error shape.
 */
function retryableSqlstate(err: unknown): string | null {
	const e = err as { code?: unknown; cause?: { code?: unknown } };
	const code = e.cause?.code ?? e.code;
	if (typeof code === "string" && RETRYABLE_SQLSTATES.has(code)) {
		return code;
	}
	return null;
}

/** Full jitter: `wait = random_uniform(0, base)` (AWS 2015). */
function fullJitter(baseMs: number): number {
	return Math.floor(Math.random() * baseMs);
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
