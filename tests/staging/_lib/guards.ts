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
 *
 * THIS IS THE SINGLE CODE CONSTANT for the production ref. The literal also
 * appears in ten committed documents (ADR-0024, the deploy runbook, two
 * handover decks, an incident log, three plans, the STAGING-PARITY plan), but
 * those are prose, not importable values — there is no other constant to point
 * at, and this one is not a duplicate of any of them. Anything in code needing
 * the production ref must import THIS, so the refusal has exactly one place to
 * be corrected. Ruling 3, 2026-08-06.
 *
 * LIVENESS: a Supabase project restore or migration mints a NEW ref, at which
 * point this literal silently stops protecting anything and the fragment check
 * becomes the only barrier. There is no way to verify the value from inside
 * this module — it never connects. What IS enforceable here is that the deny
 * list is not EMPTY, which is the failure mode a careless edit produces:
 * blanking the string turns `url.includes("")` into a vacuous true and would
 * make the guard refuse EVERY url, or — had the check been written the other
 * way — refuse none. `resolveStagingTarget` asserts it is non-empty, and
 * `reset-guard.test.ts` feeds a synthetic production URL and asserts refusal.
 * That test IS the liveness check: if the ref is ever rotated and this constant
 * is not updated with it, the test still passes against the synthetic value,
 * so the test's own fixture is the thing to re-check at rotation time. Recorded
 * plainly rather than implied.
 */
export const PRODUCTION_PROJECT_REF = "zbvprdcyxhlguxbostdj";

/**
 * G-5 — the intent token `pnpm staging:reset` sets and nothing else does.
 *
 * G-1..G-4 are all ENVIRONMENTAL — they prove WHERE you are, never that you
 * MEANT it. Through Slices B–D the operator lives in `doppler run --config
 * stg` shells, where a bare `vitest --config vitest.staging.config.ts` (watch
 * mode) would wipe staging once and then re-wipe on every file save, and — once
 * Slice B adds generator/gate runners under the same include glob — a
 * positional-less run would sweep the reset in with them. This token is the
 * one guard that asks "did you mean this run?". @security-auditor, Slice A.
 */
export const RESET_INTENT_ENV = "ZUGZWANG_STAGING_RESET_ACK";
export const RESET_INTENT_VALUE = "wipe-staging-i-mean-it";

/**
 * Minimum length for STAGING_PROJECT_REF_FRAGMENT.
 *
 * A free-substring match is only as strong as the substring. A fragment of
 * `postgres` makes BOTH the G-1 URL match and the G-3 connection match
 * vacuously true for every Postgres DSN in existence — the scheme itself
 * contains it — leaving the hard-coded production ref as the only
 * discriminator. That is a reachable mistake, not a hypothetical: an operator
 * whose fragment refuses will naturally shorten it until it passes. Supabase
 * project refs are 20 lowercase letters; requiring 16+ alphanumerics rejects
 * every generic host/scheme substring while accepting any real ref.
 */
export const MIN_FRAGMENT_LENGTH = 16;

/** Hosts a staging connection may legitimately dial. */
const ALLOWED_HOST_SUFFIXES = [".supabase.com", ".supabase.co"] as const;

/**
 * True when `host` is a Supabase host. G-3 asserts this so that a fragment
 * supplied against a NON-Supabase target — e.g. a localhost DSN carrying the
 * staging ref in its username — cannot satisfy the contract.
 */
export function isAllowedStagingHost(host: string): boolean {
	const bare = host.split(":")[0]?.toLowerCase() ?? "";
	return ALLOWED_HOST_SUFFIXES.some((suffix) => bare.endsWith(suffix));
}

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
 * Public tables that are in neither TRUNCATE_SET nor TRUNCATE_EXCLUSIONS.
 *
 * They survive a reset. STAGING-PARITY Q3's truncate set is reproduced
 * verbatim in TRUNCATE_SET and is silent on these three, so they are recorded
 * here rather than added — the set is a ratified decision, and widening it is
 * a ruling, not an implementation detail. Named so a reader can tell
 * "deliberate" from "forgotten" (@code-reviewer, Slice A).
 *
 * Verified: none carries an outbound FK, so `TRUNCATE … CASCADE` cannot reach
 * them either — they survive structurally, not by omission from a list.
 *
 * What survives, and why it is defensible: `admin_sessions` holds the admin's
 * live login (truncating it would log the operator out mid-run); `cron_alarms`
 * and `watermark_state` hold operational cron/drift state rather than fixture
 * data. The cost of leaving them is stale alarm rows keyed to market ids that
 * no longer exist, and a drift watermark for a deleted population — both
 * consumed by /api/cron/alarms-drain and the nightly drift job, neither of
 * which runs on staging today (STAGING-PARITY-ENV). Flagged for a ruling
 * before Slice B rather than decided here.
 */
export const NOT_TRUNCATED_UNRATIFIED: readonly string[] = [
	"admin_sessions",
	"cron_alarms",
	"watermark_state",
];

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

	// The deny list must not be empty. A blanked PRODUCTION_PROJECT_REF makes
	// `url.includes(ref)` vacuously TRUE for every URL, so the reset would
	// refuse everything and the operator's fix would be to delete the check —
	// removing the only hard target discriminator. Refuse loudly instead.
	// Ruling 3, 2026-08-06.
	if (!PRODUCTION_PROJECT_REF) {
		return {
			ok: false,
			reason:
				"PRODUCTION_PROJECT_REF is empty; the production deny list is not configured and the target guard cannot discriminate. Refusing.",
		};
	}

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
	if (fragment.length < MIN_FRAGMENT_LENGTH || !/^[a-z0-9]+$/.test(fragment)) {
		return {
			ok: false,
			reason: `STAGING_PROJECT_REF_FRAGMENT must be at least ${MIN_FRAGMENT_LENGTH} lowercase alphanumeric characters (a Supabase project ref). A short or generic fragment matches every Postgres DSN and makes the target guard a no-op; refusing.`,
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

	// G-5 · intent / watch-mode refusal. Every guard above proves WHERE the
	// connection goes; none proves the operator meant to run a destructive wipe
	// right now. Additive to ADR-0035 primitive 6's four guards, never a
	// relaxation of them — see the ADR-0035 Addendum, 2026-08-06.
	if (env[RESET_INTENT_ENV] !== RESET_INTENT_VALUE) {
		return {
			ok: false,
			reason: `${RESET_INTENT_ENV} is not set to the acknowledgement value. This run wipes the staging database. Invoke it as: pnpm staging:reset`,
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
