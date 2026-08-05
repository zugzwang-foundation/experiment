// STAGING-PARITY Slice A — the reset's constants and its pure target guard.
// Ratified by ADR-0035 (guarded staging reset) and ADR-0036 (Vitest-context
// operational runners). Read those before changing anything here.
//
// WHY THIS IS NOT tests/db/_fixtures/truncate.ts (ADR-0035 primitive 7):
// that fixture is a local-test teardown and says so in its own header. Its
// requirements differ from an operational staging reset — it has no notion of
// the system_state or __drizzle_migrations exclusions, and a change made for
// local-test reasons would silently change staging behaviour. Two artifacts,
// two requirement sets. The drift risk is closed NOT by sharing code but by
// naming the real authority: the MIGRATIONS. tests/unit/staging/
// guard-list-parity.test.ts parses 0003 + 0021 + 0022 and asserts the lists
// below match. Neither this file nor the fixture is the source of truth.
//
// NEVER import this from src/**. It is an operational artifact under tests/,
// and production must not gain an escape hatch.

/**
 * The production Supabase project ref. Present only so the target guard can
 * refuse it by name — this file never connects anywhere.
 */
export const PRODUCTION_PROJECT_REF = "zbvprdcyxhlguxbostdj";

/**
 * The `_no_truncate` guards the reset disables, for exactly one transaction.
 *
 * ADR-0035 primitive 3: `bucket_a_no_update`, `bucket_a_no_delete`,
 * `bucket_b_no_delete` and `bucket_b_update_check` are NEVER disabled, under
 * any circumstance, for any duration. The reset removes rows wholesale; it
 * never acquires the ability to edit one.
 *
 * The FULL truncate-guard set is disabled rather than just the listed tables,
 * because `TRUNCATE … CASCADE` fires ON TRUNCATE triggers on cascaded tables
 * too — a short list reaches guarded tables outside itself, and per-call-site
 * FK-closure analysis would silently rot as FKs drift.
 *
 * `system_state` is the one deliberate omission — see TRUNCATE_EXCLUSIONS.
 */
export const DISABLED_TRUNCATE_GUARDS: ReadonlyArray<
	readonly [table: string, trigger: string]
> = [
	// Bucket A — 9 non-partitioned tables (0021 ships 8; 0022 adds bet_receipts).
	["dharma_ledger", "bucket_a_no_truncate"],
	["bets", "bucket_a_no_truncate"],
	["comments", "bucket_a_no_truncate"],
	["resolution_events", "bucket_a_no_truncate"],
	["payout_events", "bucket_a_no_truncate"],
	["mod_actions", "bucket_a_no_truncate"],
	["admin_events", "bucket_a_no_truncate"],
	["user_events", "bucket_a_no_truncate"],
	["bet_receipts", "bucket_a_no_truncate"],
	// events family — parent + all 13 partitions. Statement-level triggers do
	// NOT clone to partitions (ADR-0030, verified via tgparentid), so each
	// partition carries its own and each must be disabled by name.
	["events", "bucket_a_no_truncate"],
	["events_2026_05", "bucket_a_no_truncate"],
	["events_2026_06", "bucket_a_no_truncate"],
	["events_2026_07", "bucket_a_no_truncate"],
	["events_2026_08", "bucket_a_no_truncate"],
	["events_2026_09", "bucket_a_no_truncate"],
	["events_2026_10", "bucket_a_no_truncate"],
	["events_2026_11", "bucket_a_no_truncate"],
	["events_2026_12", "bucket_a_no_truncate"],
	["events_2027_01", "bucket_a_no_truncate"],
	["events_2027_02", "bucket_a_no_truncate"],
	["events_2027_03", "bucket_a_no_truncate"],
	["events_2027_04", "bucket_a_no_truncate"],
	["events_default", "bucket_a_no_truncate"],
	// Bucket B — 2 of 3. system_state is excluded; see below.
	["identity_pool", "bucket_b_no_truncate"],
	["image_uploads", "bucket_b_no_truncate"],
];

/**
 * Guard families the reset must never disable (ADR-0035 primitive 3).
 * Asserted against the migrations by the parity test.
 */
export const NEVER_DISABLED_GUARD_NAMES: readonly string[] = [
	"bucket_a_no_update",
	"bucket_a_no_delete",
	"bucket_b_no_delete",
	"bucket_b_update_check",
];

/**
 * Tables that are NEVER truncated, and whose guards are never disabled.
 *
 * `system_state` — THE COUNTER-INTUITIVE ONE, stated here rather than only in
 * the ADR because the obvious source of truth actively invites the mistake:
 * system_state DOES carry a `bucket_b_no_truncate` guard in migration 0021, so
 * reading the guard list alone makes it look truncatable. It must not be.
 * Its singleton row is seeded by migration 0004, which drizzle believes is
 * applied and will never re-run; `db:seed:staging` seeds only identity_pool.
 * And `isFrozen()` reads `row?.frozenAt != null`, so a MISSING ROW FAILS OPEN
 * SILENTLY — the conclusion-freeze sentinel would simply cease to exist with
 * nothing reporting it. Leaving its guard enabled turns the omission into an
 * active defense: if a future edit ever adds system_state to the truncate set,
 * the still-live trigger aborts the whole batch instead of quietly wiping it.
 * That refusal is proven by the atomicity test.
 *
 * `drizzle.__drizzle_migrations` is excluded structurally rather than by name:
 * it lives in the `drizzle` schema, appears in no guard list, and is not
 * FK-reachable from `public`, so CASCADE cannot reach it and an unqualified
 * TRUNCATE cannot name it. Truncating it would make `drizzle-kit migrate`
 * believe zero migrations are applied and re-run 0000 onward against a
 * populated schema; /api/health would report drift. verifyPostReset checks its
 * row count for exactly that reason.
 */
export const TRUNCATE_EXCLUSIONS: readonly string[] = ["system_state"];

/**
 * The tables the reset empties — the ratified set from STAGING-PARITY Q3.
 *
 * `events` covers its 13 partitions (TRUNCATE on the partitioned parent
 * truncates every partition). `identity_pool` is truncated AND immediately
 * re-seeded by the `staging:reset` script (ADR-0035 primitive 5): `assigned_at`
 * is a one-way Bucket-B transition, so tuples consumed by the users this
 * removes would otherwise be stranded ~10-12 per run, walking toward
 * identity_pool_exhausted and drifting pseudonyms upward every rebuild.
 */
export const TRUNCATE_SET: readonly string[] = [
	// Bucket A — the event-sourced spine.
	"events",
	"dharma_ledger",
	"bets",
	"comments",
	"resolution_events",
	"payout_events",
	"mod_actions",
	"admin_events",
	"user_events",
	"bet_receipts",
	// Bucket C — mutable read models and market state.
	"positions",
	"markets",
	"pools",
	"market_media",
	"bookmarks",
	// Bucket B — image uploads and the identity pool.
	"image_uploads",
	"identity_pool",
	// Auth surface.
	"users",
	"accounts",
	"sessions",
	"verifications",
];

/**
 * Rows the `bucket_%` catalog query returns when every guard is present:
 * 23 relations × 3 Bucket-A families + 3 relations × 3 Bucket-B families.
 *
 * FORWARD OBLIGATION (ADR-0030): any migration that adds an `events` partition
 * or a new protected table must add the matching triggers — and this number
 * moves with it. It is pinned so that drift fails loudly here rather than
 * silently narrowing what the reset verifies.
 */
export const EXPECTED_GUARD_CATALOG_ROWS = 78;

export type StagingTarget =
	| { readonly ok: true; readonly url: string; readonly fragment: string }
	| { readonly ok: false; readonly reason: string };

/**
 * G-1 (target) + G-2 (environment) of the ADR-0035 primitive 6 guard contract,
 * hardened per STAGING-PARITY Ratification Record §5 W-B.
 *
 * Pure: takes an env record rather than reading `process.env`, so it is
 * exhaustively unit-testable with no global mutation.
 *
 * FAILS CLOSED on absence, and NEVER falls back to `DATABASE_URL` — the reset
 * must not be able to inherit a connection string from ambient environment,
 * and `DATABASE_URL` is the variable every other tool in the repo reads.
 */
export function resolveStagingTarget(
	env: Readonly<Record<string, string | undefined>>,
): StagingTarget {
	const url = env.DATABASE_URL_STAGING;
	const fragment = env.STAGING_PROJECT_REF_FRAGMENT;
	const zugzwangEnv = env.ZUGZWANG_ENV;

	// G-1 · target.
	if (!url) {
		return {
			ok: false,
			reason:
				"DATABASE_URL_STAGING is not set. Run under: doppler run --project zugzwang-experiment --config stg -- …",
		};
	}
	// The production refusal is checked FIRST and unconditionally, ahead of
	// every lesser check. A URL naming prod fails the fragment test too, so a
	// later position would have this case reported as "wrong fragment" — a true
	// refusal with a misleading reason, on the single input that matters most.
	// ADR-0035 driver 4: a failed staging run costs an afternoon; a wrong-target
	// run costs the experiment. The operator must be told WHICH it was.
	if (url.includes(PRODUCTION_PROJECT_REF)) {
		return {
			ok: false,
			reason:
				"DATABASE_URL_STAGING contains the PRODUCTION project ref; refusing. This is the wrong-target case — check the Doppler config (stg, never prd).",
		};
	}
	if (!fragment) {
		return {
			ok: false,
			reason:
				"STAGING_PROJECT_REF_FRAGMENT is not set; cannot verify the URL is staging",
		};
	}
	if (!url.includes(fragment)) {
		return {
			ok: false,
			reason: `DATABASE_URL_STAGING does not contain STAGING_PROJECT_REF_FRAGMENT ("${fragment}"); refusing`,
		};
	}

	// G-2 · environment. A positive match, not a negation: unset or unknown
	// refuses.
	if (zugzwangEnv !== "staging") {
		return {
			ok: false,
			reason: `ZUGZWANG_ENV must equal "staging" (saw ${zugzwangEnv === undefined ? "unset" : `"${zugzwangEnv}"`}); refusing`,
		};
	}

	return { ok: true, url, fragment };
}

/** Host of a connection string, for logging. Never logs credentials. */
export function safeHost(url: string): string {
	try {
		return new URL(url).host;
	} catch {
		return "(unparseable)";
	}
}
