import { sql } from "drizzle-orm";
import {
	boolean,
	check,
	index,
	integer,
	numeric,
	pgTable,
	timestamp,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

// ADR-0047 §G — the signup-pegged injector's parameters.
//
// A FILE of its own rather than a row in `markets.ts`, for two reasons. The
// table is not market-scoped: ONE row governs every `Open` market at once, and
// filing it under markets would suggest a per-market policy that does not
// exist. And a new schema unit is allocated in this repo by creating a FILE —
// `O-15`: two lanes adding `liquidity.ts` produce an add/add conflict a merge
// cannot silently resolve, where two lanes adding a table to `markets.ts`
// produce a clean union that loses nothing visibly and everything in fact.
//
// BUCKET A — fully append-only. Three `0027` triggers reusing the shared
// `enforce_bucket_a_no_update` / `_no_delete` / `_no_truncate` functions that
// `0003` and `0021` already ship. Tuning is an INSERT of a NEW version, never
// an UPDATE of this one (ADR §G, and the §Runbook says it twice) — which is
// the whole reason the history is worth shipping in the dataset: a reader who
// cannot see the parameters in force at an injection cannot reproduce it, and
// the target rule is not derivable from the events alone.
//
// ⚠ IT IS ALSO A TRUNCATE **EXCLUSION** in `tests/staging/_lib/guards.ts`, and
// its guard stays ENABLED there — the `system_state` argument verbatim in
// shape. The seed row is written by migration `0027`, which drizzle believes
// applied and will never re-run, and `db:seed:staging` seeds only
// `identity_pool`. So a reset that truncated this table would delete the policy
// PERMANENTLY, and the injector's "exit if not enabled" would then read no row
// at all — failing silently closed forever, with nothing reporting it. Leaving
// the guard armed turns that omission into an active defence: a future edit
// that adds the table to the truncate set aborts the whole batch instead of
// quietly wiping it.
//
// INV surface: INV-1/3/4 untouched — no path here reads or writes a bet, a
// comment's side, or a resolution row. INV-2 untouched in the strict sense and
// worth stating: an injection mints pool BACKING, never a `dharma_ledger` row
// (R-2; `pool_seed`/`pool_unwind` stay dormant), so there is no balance to
// overdraw and no transfer to forbid. The backing it mints is accounted for by
// ADR §E's per-side identity, summed from events.
export const liquidityPolicy = pgTable(
	"liquidity_policy",
	{
		id: uuid("id").primaryKey().default(sql`uuidv7()`),
		// Monotone, UNIQUE, and the tiebreak in the newest-wins read below. It is
		// also what a `pool.liquidity_added` payload's `policyVersion` joins back
		// to, which is why it is an explicit integer rather than an ordering over
		// `created_at`: a reader of the public dataset gets a key, not a guess.
		version: integer("version").notNull(),
		// Đ of depth per signup. The target is `max(floor, coefficient × users)`,
		// so this is the slope and `floor` is the intercept.
		coefficient: numeric("coefficient", {
			precision: 38,
			scale: 18,
		}).notNull(),
		// ⚠ `floor` is not a reserved word as a Postgres column identifier, but it
		// IS a function name. Every reference in `0027`'s function bodies must be
		// qualified (`p.floor`), or the parser resolves the function and the
		// error arrives at runtime rather than at CREATE.
		floor: numeric("floor", { precision: 38, scale: 18 }).notNull(),
		// Inject only while `tank < trigger_ratio × target`. Bounded (0,1) —
		// STRICTLY below 1 as of 0029 (@security-auditor M-4).
		//
		// ⚠ THIS COMMENT USED TO BLESS 1 AS "legal and deliberate". It is not.
		// `floor18` truncation leaves the tank a hair short of target after every
		// injection, so at exactly 1 the trigger is true again immediately and the
		// injector emits one row per market PER MINUTE, forever — ~14,400/day at
		// ten markets, ~750,000 over the window. Three consumers pay: the chart
		// walks every one on EVERY Discovery card and debate page load,
		// `sumInjectionDiscards` scans them inside the W-3 settlement transaction
		// under the pool lock against a non-retryable 5,000 ms budget, and the
		// dataset ships all of them. Nothing needs the boundary.
		triggerRatio: numeric("trigger_ratio", {
			precision: 38,
			scale: 18,
		}).notNull(),
		// Skip a market whose `p_yes` has left this band. A market at an extreme
		// price is one where the injector's price-preserving placement would add
		// depth almost entirely to one side; the ADR's judgement is that such a
		// market is information, not a thing to correct.
		guardLow: numeric("guard_low", { precision: 38, scale: 18 }).notNull(),
		guardHigh: numeric("guard_high", { precision: 38, scale: 18 }).notNull(),
		// Leave the closing window alone: no injection within this many hours of
		// the market's resolution deadline.
		endgameHours: integer("endgame_hours").notNull(),
		// `SET LOCAL lock_timeout` for the sweep. A bet holding the pool row is
		// the normal case, so the injector waits this long and then yields for the
		// tick; the next tick is 60 s away and the trigger is still true.
		lockTimeoutMs: integer("lock_timeout_ms").notNull(),
		// ⚠ The seeded row is `false`, and that is the single most consequential
		// deviation from ADR §G's text (OD-4, ruled at R4). ADR-0024 applies the
		// migration to production BEFORE the new code is promoted, so a row seeded
		// `true` would let the injector write `pool.liquidity_added` rows into a
		// database whose running code cannot read them — under-reporting
		// `settleMarket`'s residual by the injected discard, on a terminal
		// append-only row. Arming is one operator INSERT after the promote, which
		// is the mechanism §G already prescribes rather than a workaround for it.
		enabled: boolean("enabled").notNull(),
		// Newest `effective_from <= now()` wins. Separate from `created_at` so a
		// policy can be staged ahead of the moment it takes force.
		effectiveFrom: timestamp("effective_from", { withTimezone: true })
			.notNull()
			.defaultNow(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		uniqueIndex("liquidity_policy_version_unique").on(table.version),
		// The ONLY query this table serves, in both routines: newest effective
		// policy, one row. Ordered exactly as the index is.
		index("liquidity_policy_effective_idx").on(
			sql`${table.effectiveFrom} DESC`,
			sql`${table.version} DESC`,
		),
		// ⛔ THIS CHECK IS THE ONLY REVIEW THAT EXISTS, AND THAT IS DELIBERATE.
		// Tuning is an operator INSERT by design (ADR §G: "Never a deploy"), so
		// there is no PR, no CI run and no reviewer between a typo and every
		// market. One malformed row — a zero coefficient, a `guard_low` above
		// `guard_high` — either stops every injection or lets one run unbounded,
		// silently. The constraint IS the review (plan §9 R-3).
		check(
			"liquidity_policy_bounds",
			sql`${table.coefficient} > 0 AND ${table.floor} > 0
				AND ${table.triggerRatio} > 0 AND ${table.triggerRatio} < 1
				AND ${table.guardLow} > 0 AND ${table.guardHigh} < 1
				AND ${table.guardLow} < ${table.guardHigh}
				AND ${table.endgameHours} >= 0 AND ${table.lockTimeoutMs} > 0`,
		),
		// ⛔ THE CEILING, ADDED AT MIGRATION 0028 (@db-migration-reviewer HIGH-1).
		//
		// The bounds CHECK above bounds every parameter from BELOW and only one
		// from above. `lock_timeout_ms` is the one that needed both, because it is
		// the single number the whole one-transaction sweep's safety argument
		// rests on: the sweep holds a pool row from the moment it locks it until
		// the sweep ENDS, and the bet path waiting on that row has a 1,000 ms
		// `statement_timeout` whose `57014` is NOT retryable. A bet that loses
		// that race does not retry — it 500s.
		//
		// The real invariant is `(open_markets − 1) × lock_timeout_ms < 1000`, and
		// a CHECK cannot express it because it cannot see the market count. So
		// this is a TYPO CEILING rather than a proof: it catches the extra zero
		// and the ms/s unit slip, which are the realistic ways an operator typing
		// a bare INSERT — no PR, no CI, no reviewer — breaks the money path.
		// ⚠ Measured 2026-09-07: `lock_timeout_ms = 2147483647` was ACCEPTED.
		//
		// ⚠ AND THE ARITHMETIC BOUND HAS ALREADY DRIFTED ONCE. The plan reasons
		// from "eight markets"; staging carries **ten** `Open` markets today, so
		// the safe ceiling there is 111 ms and the shipped 100 ms holds with
		// almost no room. The exact invariant belongs in the ADR §Runbook, where
		// the operator reads it before typing — this constraint is the backstop,
		// not the argument.
		// ⚠ 250 → 100 at migration 0029 (@security-auditor H-1). 250 was the
		// migration reviewer's suggestion and I took it without doing the
		// arithmetic against the MEASURED market count. The auditor did:
		//
		//   8 Open markets, 7 pool rows held by a concurrent session
		//     lock_timeout_ms = 100  → sweep 735 ms
		//     lock_timeout_ms = 250  → sweep 1,776.8 ms
		//   ...and a bet-shaped statement against the FIRST market's pool row
		//   died at 1,004.8 ms with `canceling statement due to statement timeout`.
		//
		// So the ceiling BLESSED a value that deterministically breaks the money
		// path. `57014` is not in RETRYABLE_SQLSTATES — the bet does not retry, it
		// fails. A guard that permits the failure it was added to prevent is worse
		// than no guard, because it reads as one.
		check(
			"liquidity_policy_lock_timeout_ceiling",
			sql`${table.lockTimeoutMs} <= 100`,
		),
		// ⛔ H-2 — THE PARAMETERS WHOSE FAILURE IS IRREVERSIBLE HAD NO CEILING AT
		// ALL, and `0028` ceilinged the two whose failure is RECOVERABLE while
		// leaving these open.
		//
		// Measured: `floor = 99999999999999999999` is accepted by every CHECK,
		// and one tick turns a 100,000 tank into 1e20 on EVERY Open market at
		// once, silently, price-preserving as designed. **There is no drain
		// path** — `pools` has no reduce-liquidity writer, `events` is Bucket A,
		// and `k` only grows. The markets become permanently price-inelastic and
		// the experiment's instrument is destroyed with no way back. Realistically
		// it is the three-extra-zeros typo, which the same mechanism delivers.
		//
		// The opposite direction already fails SAFE and is worth stating so
		// nobody "fixes" it: an over-large `coefficient × users` overflows the
		// numeric(38,18) cast inside the subtransaction, is caught by
		// `WHEN OTHERS`, writes a `liquidity_injection_error` alarm and leaves the
		// pool untouched. The dangerous band is precisely "large enough to matter,
		// small enough not to overflow".
		//
		// Sized from the values ADR-0047 actually pins: 100× the D-14 opening tank
		// (100,000) and 100× the initial grant (1,000). Room for any plausible
		// tuning; no room for a typo.
		check("liquidity_policy_floor_ceiling", sql`${table.floor} <= 10000000`),
		check(
			"liquidity_policy_coefficient_ceiling",
			sql`${table.coefficient} <= 100000`,
		),
		// `endgame_hours` had no ceiling either. Measured: 2147483647 is accepted
		// and `now() + make_interval(hours => 2147483647)` evaluates cleanly to
		// the year 247010 — every market skipped forever, silently, with the
		// undershoot alarm as the only signal that anything is wrong. One year is
		// far past any plausible tuning and far short of that.
		// ⚠ 8760 → 168 at 0029 (@security-auditor M-5). One year did not bound the
		// failure mode the constraint's own comment names: the experiment window
		// is ~1,250 hours, so ANY value at or above that skips every market for
		// the whole experiment — silently — and 8,760 permitted it seven times
		// over. One week is far past any plausible endgame and far short of the
		// window.
		check(
			"liquidity_policy_endgame_ceiling",
			sql`${table.endgameHours} <= 168`,
		),
	],
);

export const insertLiquidityPolicySchema = createInsertSchema(liquidityPolicy);
export const selectLiquidityPolicySchema = createSelectSchema(liquidityPolicy);
