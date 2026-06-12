import "server-only";

import { addBreadcrumb, captureMessage } from "@sentry/nextjs";
import { eq, sql } from "drizzle-orm";
import type { z } from "zod";

import { type DbTransaction, db } from "@/db";
import { markets } from "@/db/schema";
import type { eventMetadataSchema } from "@/server/events/schemas";

import {
	LifecycleSerializationExhaustedError,
	MarketLifecycleStateError,
} from "./errors";
import type { MarketStatus } from "./transitions";

/** The three lifecycle flows that funnel through the single W-4 write path. */
export type LifecycleFlow = "F-ADMIN-1" | "F-ADMIN-2" | "W-4-CLOSE";

/** The markets row, locked `FOR NO KEY UPDATE`, handed to the callback. */
export interface LockedMarket {
	id: string;
	status: MarketStatus;
	resolutionDeadline: Date;
}

/** The SPEC.2 §3.7 metadata block every lifecycle flow threads into emits. */
export type LifecycleEventMetadata = z.infer<typeof eventMetadataSchema>;

/** Full-jitter bases (ms) — ADR-0013 params, W-1/W-3 VERBATIM; 1+3 attempts. */
const BACKOFF_BASES_MS = [50, 100, 200] as const;

/** serialization_failure + deadlock_detected — the only retryable SQLSTATEs. */
const RETRYABLE_SQLSTATES = new Set(["40001", "40P01"]);

/** R-14.2: 1_000 ms for ALL three flows — no lifecycle write fans out. */
const STATEMENT_TIMEOUT_MS = 1000;
const IDLE_IN_TRANSACTION_TIMEOUT_MS = 30_000;

/**
 * The generic W-4 lifecycle-transaction wrapper — duplicates the W-3 spine
 * (`resolution/transaction.ts`) per the C-3 doctrine: no shared extraction;
 * W-1 and W-3 stay byte-untouched (R-14.2, standing constraint). Opens ONE
 * SERIALIZABLE transaction. On the LOCKED branch (open/close,
 * `marketId` non-null) it acquires the `markets` row FIRST with
 * `FOR NO KEY UPDATE` (status writes never touch a PK/FK-target column —
 * the W-3 justification holds verbatim), then gates the LOCKED row's status
 * against `expectedStatus` (non-member → `MarketLifecycleStateError`, not
 * retried). On the CREATE branch (`marketId: null` — §Wrapper (c)) it
 * acquires NO row lock: no row exists yet; SSI's predicate handling covers
 * the slug race (D-14.a — two same-slug creates both predicate-read
 * "absent" → SSI aborts one with 40001 → the retry's pre-check surfaces the
 * typed `MarketSlugTakenError`). Retries the whole transaction on SQLSTATE
 * 40001/40P01 with full jitter.
 *
 * **Lock order (ADR-0013 §5.12 P3):** W-4 is the SECOND markets-first
 * writer beside W-3. Global order `markets → pools → positions →
 * dharma_ledger → events` is conformed: open's `pools` INSERT follows its
 * `markets` lock; the middle tables (`positions`, `dharma_ledger`, `users`)
 * are NEVER touched by any lifecycle flow (zero ledger rows — R-14.1/R-2);
 * no W-4 path acquires `pools → markets`. Create acquires no row locks
 * (`markets → events` trivially conforms).
 *
 * **Close vs. bets — the SSI story (§Wrapper (b)):** W-1 deliberately reads
 * `markets.status` UNLOCKED (`bets/transaction.ts:78-86`) and never locks
 * `markets`, so no `pools → markets` acquisition path exists — W-4
 * introduces no new deadlock geometry. A bet in flight at the deadline
 * crossing races close's status write purely through SSI: either the bet
 * serializes first (it commits against a still-`Open` snapshot — inside the
 * R-14.3 accepted window), or the close serializes first and the bet's
 * snapshot read conflicts → 40001 → W-1's own retry re-reads `Closed` →
 * `MarketNotOpenError`. No interleaving produces a half-applied state.
 * SPEC.1's G6 (in-flight commit-or-timeout) governs the Resolving flag and
 * is untouched here.
 *
 * **Open's pool INSERT cannot collide with W-1 (§Wrapper (d)):** the coarse
 * gate rejects all non-`Open` bets and the `pools` row does not exist until
 * the open transaction creates it — no pre-`Open` W-1 traffic exists. The
 * `pools.market_id` UNIQUE is the silent belt behind opened-exactly-once
 * (the `expectedStatus ['Draft']` gate already enforces it logically).
 *
 * **Retry-purity contract (W-1/W-3 mirror, load-bearing):** every flow
 * resolves its event id ONCE at service entry, BEFORE this wrapper runs,
 * and closes over it — a retried attempt re-emits the same id and
 * `insertEvent`'s ON CONFLICT dedupes (ADR-0016 D1; the settle.ts idiom).
 */
export async function runLifecycleTransaction<T>(
	args: {
		/** null = the create branch: no row exists to lock (§Wrapper (c)). */
		marketId: string | null;
		flow: LifecycleFlow;
		/** Per-flow gate on the LOCKED row; null on the create branch. */
		expectedStatus: readonly MarketStatus[] | null;
	},
	callback: (ctx: {
		tx: DbTransaction;
		/** Non-null exactly when `args.marketId` is non-null. */
		market: LockedMarket | null;
	}) => Promise<T>,
): Promise<T> {
	let lastSqlstate = "";

	for (let attempt = 0; attempt <= BACKOFF_BASES_MS.length; attempt++) {
		try {
			return await db.transaction(
				async (tx) => {
					await applyTxTimeouts(tx);
					let market: LockedMarket | null = null;
					if (args.marketId !== null) {
						market = await lockMarket(tx, args.marketId);
						if (
							args.expectedStatus !== null &&
							!args.expectedStatus.includes(market.status)
						) {
							throw new MarketLifecycleStateError(
								`market is not in a legal state for ${args.flow} (observed ${market.status}, expected ${args.expectedStatus.join("|")})`,
							);
						}
					}
					return await callback({ tx, market });
				},
				{ isolationLevel: "serializable" },
			);
		} catch (err) {
			const sqlstate = retryableSqlstate(err);

			// Non-retryable (MarketLifecycleStateError, validation, defensive
			// throws, 23505…) → bubble immediately, no retry.
			if (sqlstate === null) {
				throw err;
			}

			lastSqlstate = sqlstate;

			// Retryable but the budget is spent → alarm, then the product error.
			if (attempt === BACKOFF_BASES_MS.length) {
				captureMessage("lifecycle_serialization_exhausted", {
					level: "error",
					tags: { sqlstate, flow: args.flow },
				});
				throw new LifecycleSerializationExhaustedError(
					`lifecycle transaction exhausted the serialization retry budget (last SQLSTATE ${sqlstate}, flow ${args.flow})`,
				);
			}

			addBreadcrumb({
				category: "lifecycle.transaction.retry",
				level: "warning",
				message: `lifecycle tx retry ${attempt + 1}/${BACKOFF_BASES_MS.length} on SQLSTATE ${sqlstate}`,
				data: { attempt: attempt + 1, sqlstate, flow: args.flow },
			});
			await sleep(fullJitter(BACKOFF_BASES_MS[attempt] ?? 0));
		}
	}

	// Unreachable — the final iteration returns or throws; totality for tsc.
	throw new LifecycleSerializationExhaustedError(
		`lifecycle transaction exhausted the serialization retry budget (last SQLSTATE ${lastSqlstate}, flow ${args.flow})`,
	);
}

/** SET LOCAL the per-tx timeouts (constant ints — `sql.raw` safe). */
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
 * Lock the markets row FIRST (`FOR NO KEY UPDATE`): `id, status,
 * resolution_deadline` — D-14.c + the close edge read the deadline from the
 * LOCKED row, never a separate pre-read. Missing row = caller bug → throw.
 */
async function lockMarket(
	tx: DbTransaction,
	marketId: string,
): Promise<LockedMarket> {
	const rows = await tx
		.select({
			id: markets.id,
			status: markets.status,
			resolutionDeadline: markets.resolutionDeadline,
		})
		.from(markets)
		.where(eq(markets.id, marketId))
		.for("no key update");

	const market = rows[0];
	if (market === undefined) {
		throw new Error(`runLifecycleTransaction: no market row for ${marketId}`);
	}
	return market;
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
