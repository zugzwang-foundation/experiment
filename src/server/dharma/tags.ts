import "server-only";

import type { dharmaEntryTypeEnum } from "@/db/schema/dharma";

/**
 * The Dharma ledger entry-type universe, DERIVED from the built
 * `dharma_entry_type` pgEnum (ENGINE.4 `.enumValues` precedent) so the type
 * set cannot drift from the DB. The 10-set after R-1 (`initial_grant`).
 */
export type DharmaEntryType = (typeof dharmaEntryTypeEnum.enumValues)[number];

/**
 * The 2 admin↔pool tags — present in the enum but DORMANT in v1 (R-2). The
 * ledger is user-only, so these are rejected on the write path AND in the
 * conservation checker; admin↔pool flows are `events` + `pools` reserve
 * deltas, never a `dharma_ledger` row.
 *
 * `as const satisfies` preserves the literal tuple (length/membership) while
 * compile-guarding every element against `DharmaEntryType`.
 */
export const POOL_DORMANT_TAGS = [
	"pool_seed",
	"pool_unwind",
] as const satisfies readonly DharmaEntryType[];

/**
 * The 8 user-side tags the ledger writes (R-2): the 10-set minus the 2 pool
 * tags. HAND-LISTED, compile-guarded by `satisfies` (the markets
 * `LEGAL_TRANSITIONS` precedent — a typed literal, not derived from the
 * runtime values).
 */
export const LEDGER_WRITABLE_TAGS = [
	"initial_grant",
	"daily_allowance",
	"bet_stake",
	"bet_payout",
	"void_refund",
	"correction_reverse",
	"correction_apply",
	"uncollectable",
] as const satisfies readonly DharmaEntryType[];

/**
 * The 5 bet-tied flow tags summed in the per-market conservation identity
 * (★). `uncollectable` is EXCLUDED (forgiveness/audit record); `initial_grant`
 * + `daily_allowance` are issuance rows (`bet_id` NULL) the gathering query
 * excludes — both outside the flow sum.
 */
export const FLOW_TAGS = [
	"bet_stake",
	"bet_payout",
	"void_refund",
	"correction_reverse",
	"correction_apply",
] as const satisfies readonly DharmaEntryType[];
