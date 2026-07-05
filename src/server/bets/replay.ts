import "server-only";

import { eq } from "drizzle-orm";

import type { DbClient } from "@/db";
import { betReceipts } from "@/db/schema";
import { safeCaptureException } from "@/server/observability/safe-capture";

// AUDIT-FIX-B3 A9 — the durable idempotency-replay layer (SPEC.2 §11 durable
// backstop; ADR-0031). Two call sites share this: (1) `runBetEndpoint`'s durable
// pre-check on the `miss` arm (before rate-limit + moderation), and (2) the two
// route handlers' post-tx catch on the SERIALIZABLE 23505 (the race backstop).
// Both build their OWN wire shapes; this module only reads the receipt + reports
// the conflict-constraint match.

/**
 * The two durable idempotency uniques whose 23505 the route catch resolves via a
 * receipt read: place's `bets_idempotency_key_idx` (fires first in the place
 * callback) and `bet_receipts_idempotency_key_uq` (the sell path's only durable
 * dedupe, and place's last write). Any OTHER 23505 (or unknown constraint) is a
 * real error → the caller rethrows (honest 500 + the B1 capture).
 */
const DURABLE_IDEMPOTENCY_CONSTRAINTS = new Set([
	"bets_idempotency_key_idx",
	"bet_receipts_idempotency_key_uq",
]);

/**
 * True iff `err` is a SERIALIZABLE 23505 on one of the durable idempotency
 * uniques. Drizzle 0.45 wraps query-builder driver errors in a `DrizzleQueryError`
 * leaving SQLSTATE + constraint on `.cause` (undefined at the top level), while a
 * raw error carries them top-level — so read `.cause` first, then the top level
 * (the `transaction.ts` / `positions/persist.ts` precedent). `as` at the trust
 * boundary (the driver error shape).
 */
export function isDurableIdempotencyConflict(err: unknown): boolean {
	const e = err as {
		code?: unknown;
		constraint_name?: unknown;
		cause?: { code?: unknown; constraint_name?: unknown };
	};
	const code = e.cause?.code ?? e.code;
	const constraint = e.cause?.constraint_name ?? e.constraint_name;
	return (
		code === "23505" &&
		typeof constraint === "string" &&
		DURABLE_IDEMPOTENCY_CONSTRAINTS.has(constraint)
	);
}

/**
 * Result of a durable receipt lookup:
 *   - `{ kind: "replay", result }` — receipt exists + fingerprint MATCHES → replay
 *     the original committed 200 body verbatim;
 *   - `{ kind: "mismatch" }` — receipt exists + fingerprint DIFFERS → the key was
 *     reused with a different body → 409 (NEVER cached — poison guard);
 *   - `null` — no receipt (proceed) OR a pre-check DB error (fail-OPEN, below).
 */
export type DurableReplay =
	| { kind: "replay"; result: unknown }
	| { kind: "mismatch" }
	| null;

/**
 * Read the durable receipt for `idempotencyKey`. A plain SELECT on the top-level
 * client (the pre-check runs before any tx; the route catch runs after the failed
 * tx rolled back). On a DB error it FAILS OPEN (returns `null` + a
 * `durable_replay_precheck_failed` capture): the pre-check is an optimization +
 * moderation shield; correctness is backstopped by the tx-level unique (the 23505
 * catch), so a pre-check outage must degrade to normal execution, not a 5xx.
 */
export async function loadDurableReplay(
	db: DbClient,
	args: { idempotencyKey: string; bodyFingerprint: string },
): Promise<DurableReplay> {
	try {
		const rows = await db
			.select({
				bodyFingerprint: betReceipts.bodyFingerprint,
				result: betReceipts.result,
			})
			.from(betReceipts)
			.where(eq(betReceipts.idempotencyKey, args.idempotencyKey))
			.limit(1);
		const row = rows[0];
		if (row === undefined) {
			return null;
		}
		if (row.bodyFingerprint === args.bodyFingerprint) {
			return { kind: "replay", result: row.result };
		}
		return { kind: "mismatch" };
	} catch (err) {
		safeCaptureException(err, {
			tags: { kind: "durable_replay_precheck_failed" },
		});
		return null;
	}
}
