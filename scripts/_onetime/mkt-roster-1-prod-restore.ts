/**
 * MKT-ROSTER-1 · ONE-TIME — the PRODUCTION restore's ENTRY POINT.
 *
 * ⛔⛔ NEVER MERGED. D-49 authorises one pre-launch production run; ADR-0036
 * carries the callout. This is the mirror of `scripts/seed-content-markets.ts`,
 * whose own `--env prod` arm refuses BY NAME and correctly stays refusing — that
 * tool routes at the staging guards and widening them is what this lane exists
 * not to do. This is a separate entry point that dies with the branch.
 *
 * It spawns the runner for the same measured reason the staging CLI does: a
 * plain `tsx` script cannot reach `@/server/**` (`server-only`'s exports map,
 * `canonicalize`'s missing `require` condition, and `openMarket`'s `next/cache`
 * call needing a module mock). The engine driving lives in the runner.
 *
 * Usage (the doppler wrapper is part of the command, never the operator's memory):
 *   pnpm exec tsx scripts/_onetime/mkt-roster-1-prod-restore.ts --create
 *   pnpm exec tsx scripts/_onetime/mkt-roster-1-prod-restore.ts --open --price 0.1 --tank 100000
 *   pnpm exec tsx scripts/_onetime/mkt-roster-1-prod-restore.ts --media
 */
import { spawnSync } from "node:child_process";

const RUNNER = "tests/prod-onetime/content-markets.prod-runner.ts";
const CONFIG = "vitest.prod-onetime.config.ts";
const PHASES = ["create", "open", "media"] as const;
type Phase = (typeof PHASES)[number];

const USAGE = `
mkt-roster-1-prod-restore — recreate the SIX production content markets through the shipped engine

  --create                  create all six into Draft (idempotent on slug)
  --open --price <p> --tank <T>
                            Draft -> Open at p_yes over reserve tank T
  --media                   verify every media object is present in R2

⛔ There is no --env flag and no default target. This tool has exactly one
   target, it is production, and it says so in its name.
`;

function die(message: string): never {
	console.error(`\n⛔ ${message}\n`);
	process.exit(1);
}

function flagValue(argv: readonly string[], flag: string): string | null {
	const at = argv.indexOf(flag);
	if (at === -1) return null;
	const value = argv[at + 1];
	if (value === undefined || value.startsWith("--"))
		die(`REFUSED — ${flag} needs a value.\n${USAGE}`);
	return value;
}

function main(): void {
	const argv = process.argv.slice(2);
	if (argv.length === 0 || argv.includes("--help") || argv.includes("-h")) {
		console.log(USAGE);
		process.exit(argv.length === 0 ? 1 : 0);
	}

	const requested = PHASES.filter((p) => argv.includes(`--${p}`));
	if (requested.length !== 1) {
		die(
			`REFUSED — pass exactly one phase (${PHASES.map((p) => `--${p}`).join(" | ")}).\n${USAGE}`,
		);
	}
	const phase = requested[0] as Phase;

	// Presence is checked here; VALIDITY is not. `canonicalizeAmount18` and
	// `openMarket`'s own regexes are the authority on what a legal price and tank
	// are, and restating either here would be a second implementation free to
	// disagree with the first.
	const price = flagValue(argv, "--price");
	const tank = flagValue(argv, "--tank");
	if (phase === "open" && (price === null || tank === null)) {
		die(
			`REFUSED — --open requires both --price and --tank (saw price=${price ?? "unset"}, tank=${tank ?? "unset"}).`,
		);
	}
	if (phase !== "open" && (price !== null || tank !== null)) {
		die("REFUSED — --price / --tank are only meaningful with --open.");
	}

	const runnerEnv: NodeJS.ProcessEnv = {
		...process.env,
		ZUGZWANG_PROD_RESTORE_PHASE: phase,
		ZUGZWANG_PROD_RESTORE_ACK: "restore-prod-six-markets",
	};
	if (price !== null) runnerEnv.ZUGZWANG_PROD_RESTORE_PRICE = price;
	if (tank !== null) runnerEnv.ZUGZWANG_PROD_RESTORE_TANK = tank;

	const args = [
		"run",
		"--project",
		"zugzwang-experiment",
		"--config",
		"prd",
		"--",
		"pnpm",
		"exec",
		"vitest",
		"run",
		"--config",
		CONFIG,
		RUNNER,
	];
	console.log(
		`[prod-restore] phase=${phase}${phase === "open" ? ` price=${price} tank=${tank}` : ""}\n` +
			`[prod-restore] doppler ${args.join(" ")}\n`,
	);
	const result = spawnSync("doppler", args, {
		stdio: "inherit",
		env: runnerEnv,
	});
	if (result.error)
		die(`REFUSED — could not launch doppler: ${result.error.message}`);
	process.exit(result.status ?? 1);
}

main();
