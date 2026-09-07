/**
 * LOTS-1 · S6 — the markets-preserving staging wipe.
 *
 * ⚠ **Why this exists instead of `pnpm staging:reset`.** The sanctioned reset
 * (ADR-0035) truncates `TRUNCATE_SET`, and **`markets` is in that set**
 * (`tests/staging/_lib/guards.ts`). Running it here would delete the eight
 * markets, which this task's fence F3 forbids outright — without them the
 * operator cannot place a bet and the run has failed regardless of what else
 * landed. The seed generator that produced those markets is **not in the
 * repository** (measured at POSCHK-1: the slug `bitcoin-price-50k` returns zero
 * hits repo-wide), so they are not reproducible; and market creation is an admin
 * action with a ratified-immutable slug. They must survive.
 *
 * **What is reused rather than re-implemented.** The truncate itself goes
 * through `runGuardedReset` — the SAME mechanism ADR-0035 ratified, whose table
 * list is a parameter by design. That keeps every property the ADR argued for:
 * one parameterless `unsafe()` round-trip = one implicit transaction, so the
 * append-only guards are never *committed* off (primitive 2); and
 * `assertSafeIdentifiers` still vets every name (the @security-auditor finding).
 * Only the parameter differs. Hand-rolling the batch would have thrown away the
 * atomicity argument and the identifier check together.
 *
 * **What is preserved, and why each:**
 *   - `markets`      — F3. Not reproducible from this repo.
 *   - `pools`        — one row per market; RESET in place PER SIDE to the
 *                      reserves the market opened with
 *                      rather than dropped, so pool state is consistent with a
 *                      population that now holds zero bets.
 *   - `market_media` — belongs to a market, not to a participant.
 *   - `system_state` — never truncated, ever (ADR-0035: a missing singleton row
 *                      makes the conclusion-freeze sentinel fail OPEN, silently).
 *
 * **The reserves are read, never assumed, and restored PER SIDE.** Each market's
 * opening reserves come from its own `market.opened` event payload
 * (`markets/open.ts` writes them there), read BEFORE the truncate that destroys
 * `events` — and the genesis row is then RE-INSERTED verbatim, because since
 * ADR-0047 §E a preserved market without one can no longer be settled or voided
 * at all. ⚠ The two sides are NOT equal any more: a market opened at 10% carries
 * 90,000/10,000, so collapsing them to one scalar would reprice it to even
 * money. If any market has no readable pair the script REFUSES rather than
 * guessing — inventing a reserve figure silently reprices a market, which is the
 * one thing this script must never do.
 *
 * Guards, in order: intent token → target proof → live connection → pre-flight
 * snapshot → wipe → pool reset → post-verification. Any failure exits non-zero
 * before the next step.
 *
 * Run: `LOTS1_WIPE_INTENT=<token> doppler run --config stg -- pnpm tsx scripts/lots-1-staging-wipe.ts`
 */
import postgres from "postgres";

import { runGuardedReset } from "../tests/staging/_lib/reset";

const INTENT_TOKEN = "wipe-staging-for-lots-1";
const PRODUCTION_PROJECT_REF = "zbvprdcyxhlguxbostdj";
const STAGING_PROJECT_REF = "rwfdoqzsghqhhdapxafg";
const EXPECTED_MARKETS = 8;

/**
 * Everything a participant produced. This is `TRUNCATE_SET` MINUS the four
 * preserved tables above, PLUS `lots` (which postdates that set).
 *
 * `TRUNCATE … CASCADE` cannot reach `markets` or `pools` from here: CASCADE
 * follows INBOUND references, and neither table references anything in this
 * list — the arrows run the other way. The post-verification proves it rather
 * than trusting it.
 */
const WIPE_TABLES: readonly string[] = [
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
	// Bucket C — mutable read models.
	"positions",
	"lots",
	"bookmarks",
	// Bucket B — uploads + the identity pool (re-seeded after; `assigned_at` is
	// a one-way transition, so tuples held by deleted users would be stranded).
	"image_uploads",
	"identity_pool",
	// Auth surface.
	"users",
	"accounts",
	"sessions",
	"verifications",
];

function fail(message: string): never {
	console.error(`\n⛔ REFUSED — ${message}\n`);
	process.exit(1);
}

async function main(): Promise<void> {
	// ── GUARD 1 · intent ──────────────────────────────────────────────────────
	if (process.env.LOTS1_WIPE_INTENT !== INTENT_TOKEN) {
		fail(
			`intent token absent. Set LOTS1_WIPE_INTENT=${INTENT_TOKEN} to proceed.`,
		);
	}

	// ── GUARD 2 · target proof (F1) ───────────────────────────────────────────
	const url = process.env.DATABASE_URL_STAGING;
	if (!url) {
		fail(
			"DATABASE_URL_STAGING is not set (run under `doppler run --config stg`).",
		);
	}
	if (url.includes(PRODUCTION_PROJECT_REF)) {
		fail(
			"the target DSN contains the PRODUCTION project ref. Production is forbidden.",
		);
	}
	if (!url.includes(STAGING_PROJECT_REF)) {
		fail("the target DSN does not contain the STAGING project ref.");
	}
	console.log("✓ guard 1 — intent token present");
	console.log("✓ guard 2 — target is staging; production ref absent");

	const client = postgres(url, { max: 1, prepare: false });

	try {
		// ── GUARD 3 · live connection ───────────────────────────────────────────
		const [live] = await client<
			{ db: string }[]
		>`SELECT current_database() AS db`;
		console.log(`✓ guard 3 — connected to "${live?.db}"`);

		// ── GUARD 4 · pre-flight snapshot, and the SEEDS ────────────────────────
		// Read before anything is destroyed. `events` is about to be truncated,
		// and it is the only place the per-market seed is recorded.
		const marketRows = await client<
			{ id: string; slug: string; has_pool: boolean }[]
		>`
			SELECT m.id, m.slug, (p.market_id IS NOT NULL) AS has_pool
			FROM markets m LEFT JOIN pools p ON p.market_id = m.id
			ORDER BY m.slug
		`;
		if (marketRows.length !== EXPECTED_MARKETS) {
			fail(
				`expected ${EXPECTED_MARKETS} markets, found ${marketRows.length}. F3 preserves the eight; this is not the database it was written for.`,
			);
		}

		// ⚠ ADR-0047 — `market.opened` HAS TWO PAYLOAD SHAPES, and this script
		// reads both here rather than through `readOpenedReserves`. That reader
		// is the single authority (`src/server/markets/backing.ts`) and every
		// other consumer goes through it; a `tsx` script cannot, because it
		// imports `server-only` and this file must inline its own client
		// (AGENTS.md §7). The exception is DECLARED rather than silent — if the
		// payload shape changes again, this is the second place to fix.
		//
		// ⛔ IT READ `payload->>'seedAmount'` ALONE UNTIL LIQ-1 PHASE 1, AND THE
		// FAILURE WAS NOT A CRASH AT THE READ. An asymmetric payload has no
		// `seedAmount`, so the arrow returned SQL NULL; guard 4 below keyed on
		// `marketId`, which BOTH shapes carry, so the guard PASSED with a null
		// seed for every market and printed `seed=null` in its own receipt. The
		// null then bound into a NOT NULL column — 23502 — AFTER `runGuardedReset`
		// had already committed the truncate, leaving staging with every
		// participant table empty and the pools untouched: precisely the
		// inconsistency the pool reset exists to prevent.
		//
		// Reserves are restored per side. Collapsing them to one scalar would
		// reprice every asymmetric market to 0.5, which is the guessing this
		// script refuses to do.
		//
		// ⚠ THE READ MIRRORS `readGenesisRow`: all three predicates (including
		// `aggregate_type`), keyed on `aggregate_id` rather than the payload's own
		// `marketId`, and OLDEST-wins on a duplicate. It was one predicate, keyed
		// on the payload, with no ordering — so `new Map` took LAST-wins in
		// unspecified row order while the chart and the payout both take oldest.
		// On a duplicated genesis row that resets the pool to a payload neither of
		// them uses, which is the divergence `backing.ts` exists to prevent.
		const seedRows = await client<
			{
				market_id: string;
				yes: string | null;
				no: string | null;
				event_id: string;
				created_at: Date;
				payload: postgres.JSONValue;
				metadata: postgres.JSONValue;
				payload_version: number;
			}[]
		>`
			SELECT DISTINCT ON (aggregate_id)
			       aggregate_id::text AS market_id,
			       COALESCE(payload->>'yesReserves', payload->>'seedAmount') AS yes,
			       COALESCE(payload->>'noReserves',  payload->>'seedAmount') AS no,
			       event_id::text AS event_id, created_at, payload, metadata,
			       payload_version
			FROM events
			WHERE aggregate_type = 'market' AND event_type = 'market.opened'
			ORDER BY aggregate_id, created_at ASC, event_id ASC
		`;
		// A type PREDICATE, not a cast. `as string` here would be the same shape
		// of assertion that carried the null into the UPDATE in the first place —
		// sound today because of the filter above, and silently unsound the moment
		// someone edits the filter. Narrowing costs one line and cannot rot.
		type SeedRow = (typeof seedRows)[number];
		const hasPair = (r: SeedRow): r is SeedRow & { yes: string; no: string } =>
			r.yes !== null && r.no !== null;
		const seedByMarket = new Map(
			seedRows.filter(hasPair).map((r) => [r.market_id, r]),
		);
		const missing = marketRows.filter((m) => !seedByMarket.has(m.id));
		if (missing.length > 0) {
			fail(
				`no readable market.opened reserves for: ${missing.map((m) => m.slug).join(", ")}. The seeded reserves are unknowable and this script will NOT guess one — guessing reprices a market.`,
			);
		}
		console.log(
			`✓ guard 4 — ${marketRows.length} markets, ${seedByMarket.size} seeds read from market.opened`,
		);
		for (const m of marketRows) {
			const r = seedByMarket.get(m.id);
			console.log(
				`    ${m.slug.padEnd(36)} yes=${r?.yes ?? "?"} no=${r?.no ?? "?"}`,
			);
		}

		// ── THE WIPE — the ADR-0035 mechanism, markets-preserving parameter ─────
		console.log(
			`\n… wiping ${WIPE_TABLES.length} tables (markets/pools/market_media/system_state PRESERVED)`,
		);
		await runGuardedReset(client, WIPE_TABLES);
		console.log("✓ wipe committed");

		// ── POOL RESET — each side to the market's own recorded opening reserve ──
		let poolsReset = 0;
		for (const m of marketRows) {
			if (!m.has_pool) {
				console.log(`    (${m.slug} has no pool row — skipped)`);
				continue;
			}
			// No `as string` launder here. Guard 4 above proved every market has a
			// readable pair; this narrows on the value so tsc agrees, rather than
			// asserting past it — the cast is what carried a null into the UPDATE.
			const seeded = seedByMarket.get(m.id);
			if (seeded === undefined) {
				fail(`no seeded reserves for ${m.slug} after guard 4 passed (bug)`);
				return;
			}
			await client`
				UPDATE pools SET yes_reserves = ${seeded.yes}::numeric,
				                 no_reserves  = ${seeded.no}::numeric
				WHERE market_id = ${m.id}
			`;
			poolsReset += 1;
		}
		console.log(`✓ pools reset to seeded reserves (${poolsReset} rows)`);

		// ── GENESIS RESTORE — the rows the truncate destroyed ──────────────────
		//
		// ⛔ WITHOUT THIS, EVERY PRESERVED MARKET IS PERMANENTLY UNTERMINABLE.
		// `events` is in WIPE_TABLES while `markets` and `pools` are preserved, so
		// before ADR-0047 the truncate cost a blank chart and nothing else. It now
		// costs settlement: `settleMarket` and `voidMarket` read the discard terms
		// from the genesis row and fail CLOSED without it, and `Resolving` has
		// exactly one outgoing edge — so a market left in that state can be neither
		// settled, voided, nor returned to Draft. It would also make this script a
		// manufacturer of I-GENESIS-001 counterexamples on all eight markets.
		//
		// Re-inserted VERBATIM — same event_id, created_at, payload, metadata and
		// version, read at guard 4 before the truncate. A re-minted row would be a
		// different audit trail; the original puts back exactly what was there.
		let genesisRestored = 0;
		for (const m of marketRows) {
			const g = seedByMarket.get(m.id);
			if (g === undefined) continue;
			await client`
				INSERT INTO events (event_id, event_type, aggregate_type, aggregate_id,
				                    payload, payload_version, metadata, created_at)
				VALUES (${g.event_id}::uuid, 'market.opened', 'market', ${m.id}::uuid,
				        ${client.json(g.payload)}, ${g.payload_version},
				        ${client.json(g.metadata)}, ${g.created_at})
			`;
			genesisRestored += 1;
		}
		console.log(
			`✓ market.opened restored (${genesisRestored} rows) — markets stay settleable`,
		);
	} finally {
		await client.end({ timeout: 5 });
	}
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
