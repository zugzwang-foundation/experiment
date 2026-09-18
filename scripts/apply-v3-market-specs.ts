/**
 * MKT-V3-1 / D-50 — apply the five v3.0 market specs in place, on one named
 * environment, in one transaction.
 *
 * Operational, one-shot, and reachable at BOTH environments — which is the one
 * way it differs from its two predecessors, `scripts/rename-ycp01-artifact.ts`
 * and `scripts/repair-ycp01-description.ts`. Those refuse production by name;
 * D-50 rules that both databases carry identical v3.0 wording, so this one has
 * to be able to write to production, and `--env` is therefore REQUIRED with no
 * default: the target is named out loud or nothing runs
 * (`scripts/seed-content-markets.ts`'s convention).
 *
 * Inline `postgres()` client per the staging-seed/smoke pattern (AGENTS.md §7)
 * — never `@/db` from a `tsx` script.
 *
 * Usage:
 *   APPLY_V3_INTENT=<token> doppler run --project zugzwang-experiment --config stg \
 *     -- pnpm exec tsx scripts/apply-v3-market-specs.ts --env staging
 *   APPLY_V3_INTENT=<token> doppler run --project zugzwang-experiment --config prd \
 *     -- pnpm exec tsx scripts/apply-v3-market-specs.ts --env prod
 *   … --env staging --dry-run      reads and reports; opens no transaction
 *
 * ⛔⛔ THE TARGET VALUES ARE NOT IN THIS FILE, AND THAT IS THE POINT. They are
 * read from `docs/data/<env>-markets-snapshot.json`, which this PR amended from
 * the five spec files in `docs/markets/`. A third transcription of founder copy
 * is a third place for it to drift, and drift in market copy is a resolution
 * dispute. BLOCK-2 exists because BLOCK-1 ran a REGEX over this same column and
 * over-corrected it; there is no pattern matching anywhere below — every value is
 * a whole string, compared and written whole.
 *
 * ⛔⛔ THE PRECONDITION IS THE WHOLE SAFETY ARGUMENT, AND IT IS ASSERTED INSIDE
 * THE TRANSACTION. All five must exist by id, be `Open`, and hold ZERO bets,
 * comments and positions. D-50 ruling 2: "If any of the five holds a bet at the
 * moment of the edit, the edit stops." A question that changes under an argument
 * someone already staked on is the one outcome no amount of care afterwards can
 * undo — the argument's author staked on the old wording, and no event carries
 * the wording, so nothing would record what they actually bet on. ⚠ Checked
 * INSIDE the transaction rather than before it, for the reason the
 * `@security-auditor` gave MKT-ROSTER-1's wipe: a gate that runs minutes before
 * the destructive statement guards the minutes, not the statement.
 *
 * ⚠ THE SEARCH IS BY `id`, NEVER BY SLUG. Two of the five re-slug, so a
 * slug-keyed UPDATE would be looking for a row that does not exist yet and
 * would leave the market untouched while reporting five of five. The ids differ
 * between the two databases (production was built fresh, not restored from
 * staging), which is why each environment reads its OWN snapshot.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import postgres from "postgres";

const INTENT_TOKEN = "apply-v3-market-specs-d50";
const PRODUCTION_PROJECT_REF = "zbvprdcyxhlguxbostdj";
const STAGING_PROJECT_REF = "rwfdoqzsghqhhdapxafg";

/** `MKT-BTC-01` stays at v2.2 — D-50 ruling 4. Named so its absence is a
 * decision a reader can see, not a list that happens to be short. */
const NOT_TOUCHED = "bitcoin-price-50k";

/** The five, by the slug each one ENDS at. Two of them arrive under another. */
const TARGET_SLUGS = [
	"chess-fide-tiebreak-response",
	"claude-bundle-response",
	"github-zugzwang-repo-stars",
	"math-erdos-solved-on-zugzwang",
	"yc-w27-acceptance",
] as const;

/** Exported so every guard-4 refusal is reachable without a database.
 * `rename-ycp01-artifact.ts` exports its pure transform for the same reason;
 * this script is the one that can write to PRODUCTION, so the argument is
 * stronger here, not weaker. (`@code-reviewer` MEDIUM.) */
export interface Environment {
	readonly name: "staging" | "prod";
	readonly dsnVar: "DATABASE_URL_STAGING" | "DATABASE_URL_PROD";
	readonly dopplerConfig: "stg" | "prd";
	readonly requiredRef: string;
	readonly forbiddenRef: string;
	readonly snapshot: string;
}

export const ENVIRONMENTS: Record<string, Environment> = {
	staging: {
		name: "staging",
		dsnVar: "DATABASE_URL_STAGING",
		dopplerConfig: "stg",
		requiredRef: STAGING_PROJECT_REF,
		forbiddenRef: PRODUCTION_PROJECT_REF,
		snapshot: "staging-markets-snapshot.json",
	},
	prod: {
		name: "prod",
		dsnVar: "DATABASE_URL_PROD",
		dopplerConfig: "prd",
		requiredRef: PRODUCTION_PROJECT_REF,
		forbiddenRef: STAGING_PROJECT_REF,
		snapshot: "prod-markets-snapshot.json",
	},
};

export interface TargetRow {
	readonly id: string;
	readonly slug: string;
	readonly title: string;
	readonly description: string;
}

function fail(message: string): never {
	console.error(`\n⛔ REFUSED — ${message}\n`);
	process.exit(1);
}

function flag(argv: readonly string[], name: string): string | undefined {
	const at = argv.indexOf(name);
	return at === -1 ? undefined : argv[at + 1];
}

/**
 * The five target rows, read out of the committed snapshot.
 *
 * REFUSES rather than returns a short list: a snapshot that lost a market would
 * otherwise edit four and report success, and the fifth would only be noticed by
 * a reader on the live site.
 */
export function loadTargets(env: Environment): TargetRow[] {
	const path = fileURLToPath(
		new URL(`../docs/data/${env.snapshot}`, import.meta.url),
	);
	const raw = JSON.parse(readFileSync(path, "utf8")) as {
		source?: { user?: string };
		markets?: {
			id: string;
			slug: string;
			title: string;
			description: string | null;
		}[];
	};
	// ⛔ The snapshot must be the one for THIS environment. Editing production
	// from the staging capture would write staging's ids, match nothing, and —
	// worse on a re-run — could write staging's wording. Every other assertion
	// here would still pass, because both files now hold six markets.
	const user = raw.source?.user ?? "";
	if (!user.includes(env.requiredRef)) {
		fail(
			`${env.snapshot} does not record ${env.name} as its source (user=${JSON.stringify(user)}).`,
		);
	}
	if (user.includes(env.forbiddenRef)) {
		fail(`${env.snapshot} records the OTHER environment's project ref.`);
	}
	const markets = raw.markets;
	if (!Array.isArray(markets) || markets.length !== 6) {
		fail(`${env.snapshot} holds ${markets?.length ?? 0} markets, expected 6.`);
	}
	const rows: TargetRow[] = [];
	for (const slug of TARGET_SLUGS) {
		const m = markets.find((row) => row.slug === slug);
		if (!m) fail(`${env.snapshot} has no market with slug ${slug}.`);
		if (typeof m.description !== "string" || m.description.length === 0) {
			fail(`${env.snapshot}: ${slug} has no description.`);
		}
		rows.push({
			id: m.id,
			slug: m.slug,
			title: m.title,
			description: m.description,
		});
	}
	if (rows.length !== 5) fail(`built ${rows.length} targets, expected 5.`);
	if (new Set(rows.map((r) => r.id)).size !== 5) {
		fail("the five targets do not have five distinct ids.");
	}
	if (markets.some((m) => m.slug === NOT_TOUCHED) === false) {
		fail(`${env.snapshot} has lost ${NOT_TOUCHED}.`);
	}
	return rows;
}

async function main() {
	const argv = process.argv.slice(2);
	const dryRun = argv.includes("--dry-run");

	// ── GUARD 1 · the target is named out loud ──────────────────────────────
	const envArg = flag(argv, "--env");
	if (!envArg) {
		fail(
			"--env is required and has no default. This writes to a live database; the target is named or nothing runs.\n" +
				"  --env staging | --env prod   [--dry-run]",
		);
	}
	// ⚠ `Object.hasOwn`, not a truthiness check on the lookup: a plain object
	// literal reaches `Object.prototype`, so `--env constructor` (or `toString`,
	// `valueOf`) yields a truthy value and sails past `if (!env)`. It was traced
	// to a safe refusal three lines later — `env.dsnVar` is undefined, so guard 3
	// fails — but a refusal that happens at the wrong line tells the operator the
	// wrong thing about what is wrong (`@code-reviewer` LOW, O-3).
	if (!Object.hasOwn(ENVIRONMENTS, envArg)) {
		fail(`--env must be staging | prod (saw ${JSON.stringify(envArg)}).`);
	}
	const env = ENVIRONMENTS[envArg] as Environment;

	// ── GUARD 2 · intent ────────────────────────────────────────────────────
	if (process.env.APPLY_V3_INTENT !== INTENT_TOKEN) {
		fail(
			`intent token absent. Set APPLY_V3_INTENT=${INTENT_TOKEN} to proceed.`,
		);
	}

	// ── GUARD 3 · target proof, from the DSN's own bytes ────────────────────
	// "Reads a suffixed env var" is a convention, not a check: nothing stops
	// DATABASE_URL_PROD from being pointed at staging or the reverse.
	const dsn = process.env[env.dsnVar];
	if (!dsn) {
		fail(
			`${env.dsnVar} is not set (run under \`doppler run --config ${env.dopplerConfig}\`).`,
		);
	}
	if (dsn.includes(env.forbiddenRef)) {
		fail(
			`${env.dsnVar} contains the OTHER environment's project ref. Refusing to cross environments.`,
		);
	}
	if (!dsn.includes(env.requiredRef)) {
		fail(`${env.dsnVar} does not contain the ${env.name} project ref.`);
	}
	console.log(`✓ guard 1 — target named: ${env.name}`);
	console.log("✓ guard 2 — intent token present");
	console.log(
		`✓ guard 3 — DSN carries the ${env.name} ref and not the other one`,
	);

	const targets = loadTargets(env);
	console.log(`✓ guard 4 — ${env.snapshot} yields 5 targets, source verified`);

	// ⚠ `lock_timeout` is the one option this script adds over its two
	// predecessors, and it is here because of what it is about to lock. The
	// precondition takes `FOR UPDATE` on five market rows, and an FK child INSERT
	// from a live bet holds `FOR KEY SHARE` on the parent — so a concurrent W-1
	// transaction blocks us. Without a timeout that block is indefinite and is
	// INDISTINGUISHABLE FROM A HANG, which is the worst thing an operator can be
	// handed halfway through a production edit. 10 s is far above any healthy
	// W-1 (the bet path's own non-retryable `statement_timeout` is 1 s) and far
	// below anyone's patience. `@code-reviewer` LOW.
	const sql = postgres(dsn, {
		max: 1,
		connection: { lock_timeout: 10_000 },
	});
	try {
		// ── The read, reported in full before anything is written ────────────
		const before = await sql<
			{
				id: string;
				slug: string;
				title: string;
				description: string | null;
				status: string;
				bets: number;
				comments: number;
				positions: number;
			}[]
		>`
			SELECT m.id, m.slug, m.title, m.description, m.status::text AS status,
			       (SELECT count(*) FROM bets      b WHERE b.market_id = m.id)::int AS bets,
			       (SELECT count(*) FROM comments  c WHERE c.market_id = m.id)::int AS comments,
			       (SELECT count(*) FROM positions p WHERE p.market_id = m.id)::int AS positions
			  FROM markets m
			 WHERE m.id = ANY(${targets.map((t) => t.id)}::uuid[])
			 ORDER BY m.slug
		`;
		console.log(`\n── ${env.name}: the five, as they stand ──`);
		for (const r of before) {
			const t = targets.find((x) => x.id === r.id);
			console.log(
				`  ${r.id}  ${r.status.padEnd(6)} bets=${r.bets} comments=${r.comments} positions=${r.positions}`,
			);
			console.log(
				`    slug  ${r.slug}${t && t.slug !== r.slug ? ` -> ${t.slug}` : "  (unchanged)"}`,
			);
			console.log(`    title ${r.title}`);
			console.log(`       -> ${t?.title}`);
			console.log(
				`    desc  ${r.description?.length ?? 0} chars -> ${t?.description.length} chars`,
			);
		}

		// ⛔⛔ THE DRY RUN'S OWN LENGTH ASSERTION, AND IT IS NOT A DUPLICATE OF THE
		// PRECONDITION'S. The real run is safe without it — the in-transaction
		// precondition rolls back on a short read — but the dry run is the step
		// whose ENTIRE PURPOSE is pre-flight verification, and it was the one step
		// with no length check. Against a database whose markets were recreated
		// with fresh ids (which has happened twice: the 2026-09-07 reset and
		// MKT-ROSTER-1), `before` is `[]`, the report loop above prints nothing,
		// and the output is four green guard lines, an empty table and
		// "nothing written" at exit 0 — silence reading as corroboration, which is
		// exactly `O-13`. `@code-reviewer` MEDIUM.
		if (before.length !== 5) {
			fail(
				`read ${before.length} of 5 markets by id on ${env.name}. The ids in ` +
					`${env.snapshot} do not match this database — nothing was written, and a ` +
					"zero-row read must not look like a clean rehearsal.",
			);
		}

		if (dryRun) {
			console.log("\n--dry-run — no transaction opened, nothing written.\n");
			return;
		}

		await sql.begin(async (tx) => {
			// ── PRECONDITION, inside the transaction ──────────────────────────
			const pre = await tx<
				{
					id: string;
					slug: string;
					status: string;
					bets: number;
					comments: number;
					positions: number;
				}[]
			>`
				SELECT m.id, m.slug, m.status::text AS status,
				       (SELECT count(*) FROM bets      b WHERE b.market_id = m.id)::int AS bets,
				       (SELECT count(*) FROM comments  c WHERE c.market_id = m.id)::int AS comments,
				       (SELECT count(*) FROM positions p WHERE p.market_id = m.id)::int AS positions
				  FROM markets m
				 WHERE m.id = ANY(${targets.map((t) => t.id)}::uuid[])
				 FOR UPDATE
			`;
			if (pre.length !== 5) {
				throw new Error(
					`PRECONDITION: found ${pre.length} of 5 markets by id. Rolling back.`,
				);
			}
			const notOpen = pre.filter((r) => r.status !== "Open");
			if (notOpen.length > 0) {
				throw new Error(
					`PRECONDITION: not Open — ${notOpen
						.map((r) => `${r.slug}=${r.status}`)
						.join(", ")}. Rolling back.`,
				);
			}
			// ⛔ D-50 ruling 2. An edit must never change the question under an
			// existing argument, so ANY of the three being non-zero stops the run.
			const engaged = pre.filter(
				(r) => r.bets > 0 || r.comments > 0 || r.positions > 0,
			);
			if (engaged.length > 0) {
				throw new Error(
					`PRECONDITION: a market holds participant activity — ${engaged
						.map(
							(r) =>
								`${r.slug}(bets=${r.bets} comments=${r.comments} positions=${r.positions})`,
						)
						.join(", ")}. D-50 ruling 2: the edit stops. Rolling back.`,
				);
			}
			console.log(
				"\n✓ precondition (in-transaction) — 5 of 5 by id, all Open, 0 bets / 0 comments / 0 positions",
			);

			// ── THE FIVE UPDATES ──────────────────────────────────────────────
			for (const t of targets) {
				const row = before.find((r) => r.id === t.id);
				if (!row) throw new Error(`no pre-read row for ${t.id}. Rolling back.`);
				// ⚠ COMPARE-AND-SWAP. The WHERE re-asserts every value this update
				// was computed from, so a row that changed between the read and this
				// statement fails the count check rather than being clobbered from
				// stale data.
				const res = await tx`
					UPDATE markets
					   SET title = ${t.title}, description = ${t.description}, slug = ${t.slug}
					 WHERE id = ${t.id}::uuid
					   AND title = ${row.title}
					   AND description IS NOT DISTINCT FROM ${row.description}
					   AND slug = ${row.slug}
				`;
				if (res.count !== 1) {
					throw new Error(
						`UPDATE ${t.slug} affected ${res.count} rows (expected 1) — the row moved between read and write. Rolling back.`,
					);
				}
				console.log(`  ✓ UPDATE ${t.id}  ${row.slug} -> ${t.slug}`);
			}

			// ── POSTCONDITION: byte-equal to the snapshot, read back in-tx ─────
			const after = await tx<
				{
					id: string;
					slug: string;
					title: string;
					description: string | null;
				}[]
			>`
				SELECT id, slug, title, description FROM markets
				 WHERE id = ANY(${targets.map((t) => t.id)}::uuid[])
			`;
			if (after.length !== 5) {
				throw new Error(
					`POSTCONDITION: read back ${after.length} of 5. Rolling back.`,
				);
			}
			for (const t of targets) {
				const r = after.find((x) => x.id === t.id);
				if (
					!r ||
					r.slug !== t.slug ||
					r.title !== t.title ||
					r.description !== t.description
				) {
					throw new Error(
						`POSTCONDITION: ${t.slug} is not byte-equal to the snapshot. Rolling back.`,
					);
				}
			}
			// ⛔⛔ THE ACTIVITY COUNTS ARE RE-ASSERTED HERE, AND THIS CLOSES A WINDOW
			// `FOR UPDATE` DOES NOT. The lock is acquired BY the precondition
			// statement, so if that statement has to WAIT — a concurrent W-1 holding
			// `FOR KEY SHARE` on a market row while it inserts its own bet and
			// comment — the three count subqueries still evaluate against the READ
			// COMMITTED statement snapshot taken BEFORE the wait. A child INSERT does
			// not update the parent row, so there is no EvalPlanQual re-check to
			// refresh them: the bet commits, our lock is granted, and our counts
			// still read zero. We would then change the question under an argument
			// somebody had just staked on — the one outcome D-50 ruling 2 forbids.
			// ⚠ A FRESH STATEMENT under READ COMMITTED *does* see that committed
			// bet, which is why re-reading is the fix rather than a second lock.
			// The window is one W-1 long and the primary guard does hold; this is
			// the belt, and it costs one statement. `@code-reviewer` MEDIUM.
			const activity = await tx<
				{ slug: string; bets: number; comments: number; positions: number }[]
			>`
				SELECT m.slug,
				       (SELECT count(*) FROM bets      b WHERE b.market_id = m.id)::int AS bets,
				       (SELECT count(*) FROM comments  c WHERE c.market_id = m.id)::int AS comments,
				       (SELECT count(*) FROM positions p WHERE p.market_id = m.id)::int AS positions
				  FROM markets m
				 WHERE m.id = ANY(${targets.map((t) => t.id)}::uuid[])
			`;
			if (activity.length !== 5) {
				throw new Error(
					`POSTCONDITION: activity re-read returned ${activity.length} of 5. Rolling back.`,
				);
			}
			const arrived = activity.filter(
				(r) => r.bets > 0 || r.comments > 0 || r.positions > 0,
			);
			if (arrived.length > 0) {
				throw new Error(
					`POSTCONDITION: participant activity ARRIVED DURING this transaction — ${arrived
						.map(
							(r) =>
								`${r.slug}(bets=${r.bets} comments=${r.comments} positions=${r.positions})`,
						)
						.join(", ")}. D-50 ruling 2: the edit stops. Rolling back.`,
				);
			}

			// ⚠ And the market this ruling does NOT touch must still be there,
			// under its own slug — a slug UPDATE that collided would surface here.
			const untouched = await tx<{ slug: string }[]>`
				SELECT slug FROM markets WHERE slug = ${NOT_TOUCHED}
			`;
			if (untouched.length !== 1) {
				throw new Error(
					`POSTCONDITION: ${NOT_TOUCHED} is not present exactly once. Rolling back.`,
				);
			}
			console.log(
				"✓ postcondition (in-transaction) — all five byte-equal to the snapshot; " +
					`zero activity re-read; ${NOT_TOUCHED} present and untouched`,
			);
		});

		// ⚠ A SECOND RUN IS IDEMPOTENT AND MUST NOT REPORT LIKE A FIRST ONE. The
		// compare-and-swap predicate matches the already-written values, so
		// `count` is 1 and every assertion passes — the log would otherwise say
		// "5 rows updated" for a run that changed nothing. `alreadyApplied` is
		// computed from the PRE-READ, which is the only place the distinction
		// still exists. `@code-reviewer` LOW.
		const alreadyApplied = targets.every((t) => {
			const row = before.find((r) => r.id === t.id);
			return (
				row !== undefined &&
				row.slug === t.slug &&
				row.title === t.title &&
				row.description === t.description
			);
		});
		console.log(
			alreadyApplied
				? `\nOK — ${env.name}: already at v3.0 before this run; 5 rows re-asserted, nothing changed.\n`
				: `\nOK — ${env.name}: 5 rows updated, read-back matched, committed.\n`,
		);
	} finally {
		await sql.end();
	}
}

if (import.meta.url === `file://${process.argv[1]}`) {
	main().catch((err) => {
		console.error(err);
		process.exit(1);
	});
}
