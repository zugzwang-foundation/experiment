/**
 * LIQ-1-RESTORE — the content-market seeder's ENTRY POINT.
 *
 * The 2026-09-07 staging reset truncated `markets`, taking the eight
 * founder-authored content markets with it. Their copy is not reproducible from
 * this repository by any means but one: `docs/data/staging-markets-snapshot.json`,
 * a read-only capture somebody committed for exactly this event. This tool
 * replays that content through the SHIPPED admin engine — `createMarket` and
 * `openMarket`, the same functions `/admin/markets/new` and
 * `/admin/markets/[marketId]` call — so the rows arrive with their
 * `market.created` and `market.opened` events and their W-4 transaction intact.
 *
 * ⛔ NOTHING HERE WRITES A ROW, AND THAT IS THE POINT. A restore that INSERTed
 * snapshot rows would rebuild the state and skip the events, and since
 * ADR-0047 §E a market without its genesis row can no longer be settled or
 * voided at all. The state is a consequence of the engine having run; it is not
 * the thing to restore.
 *
 * ── WHY THIS FILE SPAWNS A RUNNER INSTEAD OF CALLING THE ENGINE ────────────
 * A `tsx` script cannot reach `@/server/**`. Measured at HEAD `67ceb6b5` on
 * 2026-09-07, both ways:
 *
 *   tsx scripts/…                      → "This module cannot be imported from a
 *                                         Client Component module" — `server-only`
 *   tsx --conditions=react-server …    → "No 'exports' main defined in
 *                                         node_modules/canonicalize/package.json"
 *
 * — the first two of the three blockers `vitest.staging.config.ts`'s header
 * names, and `next/cache`'s `revalidateTag` (which `openMarket` calls) is a
 * third that needs a module mock `tsx` has no way to install. ADR-0036 exists
 * because of exactly this, and its answer is an operational runner under the
 * Vitest harness. So the engine driving lives in
 * `tests/staging/content-markets.staging.test.ts`, and this file is the CLI the
 * operator actually types: it parses the flags, refuses the ones that must be
 * refused, and hands the rest to that runner under the right Doppler config.
 *
 * Usage:
 *   pnpm exec tsx scripts/seed-content-markets.ts --env staging --create
 *   pnpm exec tsx scripts/seed-content-markets.ts --env staging --open --price 0.1 --tank 100000
 *   pnpm exec tsx scripts/seed-content-markets.ts --env staging --media
 *   pnpm exec tsx scripts/seed-content-markets.ts --env local   --create   (proving run)
 */
import { spawnSync } from "node:child_process";

const RUNNER = "tests/staging/content-markets.staging.test.ts";

/** `--env` is REQUIRED and has no default: the target must be named out loud. */
const ENVIRONMENTS = ["staging", "local", "prod"] as const;
type Environment = (typeof ENVIRONMENTS)[number];

const PHASES = ["create", "open", "media"] as const;
type Phase = (typeof PHASES)[number];

const USAGE = `
seed-content-markets — recreate the eight content markets through the shipped engine

  --env <staging|local>     REQUIRED. No default; the target is always named.
  --create                  create all eight into Draft (idempotent on slug)
  --open --price <p> --tank <T>
                            Draft -> Open at p_yes over reserve tank T
                            (idempotent: a market already Open is skipped)
  --media                   verify every media object is present in R2

Exactly one phase per invocation.

  pnpm exec tsx scripts/seed-content-markets.ts --env staging --create
  pnpm exec tsx scripts/seed-content-markets.ts --env staging --open --price 0.1 --tank 100000
`;

function die(message: string): never {
	console.error(`\n${message}\n`);
	process.exit(1);
}

/** Read `--flag value`, or null when the flag is absent. Errors on a bare flag. */
function flagValue(argv: readonly string[], flag: string): string | null {
	const at = argv.indexOf(flag);
	if (at === -1) return null;
	const value = argv[at + 1];
	if (value === undefined || value.startsWith("--")) {
		die(`REFUSED — ${flag} needs a value.\n${USAGE}`);
	}
	return value;
}

function main(): void {
	const argv = process.argv.slice(2);
	if (argv.length === 0 || argv.includes("--help") || argv.includes("-h")) {
		console.log(USAGE);
		process.exit(argv.length === 0 ? 1 : 0);
	}

	// ── THE TARGET, NAMED ───────────────────────────────────────────────────
	const envArg = flagValue(argv, "--env");
	if (envArg === null) {
		die(
			`REFUSED — --env is required and has no default. This tool writes to a live database; the target is named or nothing runs.\n${USAGE}`,
		);
	}
	if (!ENVIRONMENTS.includes(envArg as Environment)) {
		die(
			`REFUSED — --env must be one of ${ENVIRONMENTS.join(" | ")} (saw ${JSON.stringify(envArg)}).`,
		);
	}
	const environment = envArg as Environment;

	// ⛔ PROD IS ACCEPTED AT THE FLAG AND REFUSED AT THE MECHANISM, DELIBERATELY.
	//
	// The kickoff spells the flag `--env staging|prod`, so `prod` is a word this
	// tool must recognise rather than reject as a typo. But there is no prod
	// path to route it to and there must not be: `resolveRunnerTarget` and
	// `resolveStagingTarget` BOTH refuse a URL containing the production project
	// ref first and unconditionally (ADR-0035, `tests/staging/_lib/guards.ts`),
	// and `vitest.staging.config.ts` carries no connection string of its own.
	// Adding a prod mode here would mean widening that refusal — a superseding
	// ADR, not a flag.
	//
	// Refusing HERE, by name, is the useful half: the operator learns why rather
	// than reading "DATABASE_URL_STAGING contains the PRODUCTION project ref"
	// three layers down and wondering whether they mis-set an env var.
	if (environment === "prod") {
		die(
			"REFUSED — there is no production path, by design.\n\n" +
				"Production market creation is an admin action performed through the admin\n" +
				"surface, under a real admin session. This tool drives the engine from an\n" +
				"operational runner whose target guard refuses the production project ref\n" +
				"first and unconditionally (ADR-0035; tests/staging/_lib/guards.ts). Routing\n" +
				"it at production would mean widening that refusal, which is a superseding\n" +
				"ADR and not a flag.",
		);
	}

	// ── THE PHASE, EXACTLY ONE ──────────────────────────────────────────────
	const requested = PHASES.filter((p) => argv.includes(`--${p}`));
	if (requested.length !== 1) {
		die(
			`REFUSED — pass exactly one phase (${PHASES.map((p) => `--${p}`).join(" | ")}); saw ${
				requested.length === 0
					? "none"
					: requested.map((p) => `--${p}`).join(" ")
			}.\n${USAGE}`,
		);
	}
	const phase = requested[0] as Phase;

	// ── THE OPEN'S TWO AMOUNTS ──────────────────────────────────────────────
	// Presence is checked here; VALIDITY is not. `canonicalizeAmount18` and
	// `openMarket`'s own SEED_RE / PRICE_RE are the authority on what a legal
	// price and tank are, and re-stating either here would be a second
	// implementation free to disagree with the first. This layer only refuses
	// the case the engine cannot diagnose: the flag simply not being there.
	const price = flagValue(argv, "--price");
	const tank = flagValue(argv, "--tank");
	if (phase === "open" && (price === null || tank === null)) {
		die(
			`REFUSED — --open requires both --price and --tank (saw price=${price ?? "unset"}, tank=${tank ?? "unset"}).\n${USAGE}`,
		);
	}
	if (phase !== "open" && (price !== null || tank !== null)) {
		die(
			`REFUSED — --price / --tank are only meaningful with --open.\n${USAGE}`,
		);
	}

	// ── HAND OFF TO THE RUNNER ──────────────────────────────────────────────
	const runnerEnv: NodeJS.ProcessEnv = {
		...process.env,
		ZUGZWANG_STAGING_TARGET: environment,
		// The G-5 analogue. This run writes, so it carries the write-intent
		// token the generator uses — the same token for the same class of act,
		// rather than a second one nobody would recognise.
		ZUGZWANG_STAGING_WRITE_ACK: "generate-staging-fixtures",
		ZUGZWANG_CONTENT_MARKETS_PHASE: phase,
	};
	if (price !== null) runnerEnv.ZUGZWANG_CONTENT_MARKETS_PRICE = price;
	if (tank !== null) runnerEnv.ZUGZWANG_CONTENT_MARKETS_TANK = tank;

	const vitest = [
		"exec",
		"vitest",
		"run",
		"--config",
		"vitest.staging.config.ts",
		RUNNER,
	];
	// `local` reads DATABASE_URL from the ambient shell (the loopback Postgres);
	// `staging` needs the stg secrets, so the doppler wrapper is part of the
	// command rather than something the operator must remember to prefix.
	const [command, args] =
		environment === "staging"
			? ([
					"doppler",
					[
						"run",
						"--project",
						"zugzwang-experiment",
						"--config",
						"stg",
						"--",
						"pnpm",
						...vitest,
					],
				] as const)
			: (["pnpm", vitest] as const);

	console.log(
		`[seed-content-markets] env=${environment} phase=${phase}${
			phase === "open" ? ` price=${price} tank=${tank}` : ""
		}\n[seed-content-markets] ${command} ${args.join(" ")}\n`,
	);

	const result = spawnSync(command, [...args], {
		stdio: "inherit",
		env: runnerEnv,
	});
	if (result.error) {
		die(`REFUSED — could not launch ${command}: ${result.error.message}`);
	}
	process.exit(result.status ?? 1);
}

main();
