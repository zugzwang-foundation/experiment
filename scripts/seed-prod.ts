/**
 * SEED-1-DUMMY — the seed runner's ENTRY POINT (ADR-0053).
 *
 * Drives `tests/prod-seed/seed.prod-seed.test.ts` under the right Doppler config.
 * A plain tsx script cannot reach the engine (`server-only`, `canonicalize`,
 * `next/cache` — see scripts/seed-content-markets.ts), so the engine driving
 * lives in the runner and this file is what the operator types. Run it from the
 * repository root.
 *
 *   pnpm exec tsx scripts/seed-prod.ts --env staging --table ../seed-runs/x/table.json --images ../seed-runs/x/images --limit 30
 *   pnpm exec tsx scripts/seed-prod.ts --env prod --table … --images … --preflight-only
 *   pnpm exec tsx scripts/seed-prod.ts --env prod --table … --images … --i-understand-this-writes-production
 *
 * Flags: --env local|staging|prod (REQUIRED, no default) · --table (REQUIRED,
 * outside the repository) · --images · --window-live (honour each row's due
 * offset) · --preflight-only · --limit N (the FIRST N table rows; re-running is
 * a no-op) · --until-done [max attempts, default 5] (re-run after a transient
 * failure; stops on a recorded refusal; resume is by the table's keys) ·
 * --ack-injector-target N (required when the liquidity injector is enabled:
 * N is the target the pre-flight projects) · --ack-unscreened-images (prod
 * only: the images are operator-curated and are published unscreened).
 */
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import {
	closeSync,
	existsSync,
	openSync,
	readFileSync,
	rmSync,
	writeSync,
} from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { createInterface } from "node:readline/promises";

const RUNNER = "tests/prod-seed/seed.prod-seed.test.ts";
const CONFIG = "vitest.prod-seed.config.ts";
const ENVIRONMENTS = ["local", "staging", "prod"] as const;
type Environment = (typeof ENVIRONMENTS)[number];
const PROD_PHRASE = "seed production";

function die(message: string): never {
	console.error(`\nREFUSED — ${message}\n`);
	process.exit(1);
}

function flag(argv: readonly string[], name: string): string | undefined {
	const at = argv.indexOf(name);
	if (at === -1) return undefined;
	const value = argv[at + 1];
	if (value === undefined || value.startsWith("--"))
		die(`${name} needs a value`);
	return value;
}

/** Seed runs write manifests and state beside the table; keep them out of git. */
function outsideRepo(path: string, what: string): string {
	const abs = resolve(path);
	const rel = relative(process.cwd(), abs);
	// On Windows a path on another drive has no relative form: `relative`
	// returns it absolute, which is outside by definition.
	if (!rel.startsWith("..") && !isAbsolute(rel)) {
		die(`${what} ${abs} is inside the repository; use a folder outside it`);
	}
	return abs;
}

async function main(): Promise<void> {
	const argv = process.argv.slice(2);

	if (!existsSync(CONFIG) || !existsSync(RUNNER)) {
		die(
			`run this from the repository root (${CONFIG} not found in ${process.cwd()})`,
		);
	}

	const envArg =
		flag(argv, "--env") ??
		die("--env is required and has no default (local | staging | prod)");
	if (!ENVIRONMENTS.includes(envArg as Environment))
		die(`--env must be local | staging | prod (saw ${envArg})`);
	const environment = envArg as Environment;

	const table = outsideRepo(
		flag(argv, "--table") ?? die("--table is required"),
		"--table",
	);
	if (!existsSync(table)) die(`table ${table} does not exist`);
	const imagesArg = flag(argv, "--images");
	const images = imagesArg ? outsideRepo(imagesArg, "--images") : undefined;
	const limit = flag(argv, "--limit");
	const preflightOnly = argv.includes("--preflight-only");
	const windowLive = argv.includes("--window-live");
	const untilDoneAt = argv.indexOf("--until-done");
	const next = argv[untilDoneAt + 1];
	const maxAttempts =
		untilDoneAt === -1 ? 1 : next && !next.startsWith("--") ? Number(next) : 5;
	if (!Number.isInteger(maxAttempts) || maxAttempts < 1)
		die("--until-done takes a positive integer");

	// Scrub every seed setting inherited from the shell FIRST, so a flag left
	// out means "off" — never whatever an earlier session exported.
	const env: NodeJS.ProcessEnv = { ...process.env };
	for (const name of Object.keys(env)) {
		// Upper-cased: Windows env names are case-insensitive, so an inherited
		// `zugzwang_seed_images` is the same variable (security-auditor L-2).
		const upper = name.toUpperCase();
		if (
			upper.startsWith("ZUGZWANG_SEED_") ||
			upper === "ZUGZWANG_PROD_SEED_ACK"
		)
			delete env[name];
	}
	env.ZUGZWANG_SEED_TARGET = environment;
	env.ZUGZWANG_SEED_TABLE = table;
	if (images) env.ZUGZWANG_SEED_IMAGES = images;
	if (limit) env.ZUGZWANG_SEED_LIMIT = limit;
	if (preflightOnly) env.ZUGZWANG_SEED_PREFLIGHT_ONLY = "1";
	if (windowLive) env.ZUGZWANG_SEED_WINDOW_LIVE = "1";
	const injectorAck = flag(argv, "--ack-injector-target");
	if (injectorAck) env.ZUGZWANG_SEED_INJECTOR_ACK = injectorAck;
	if (argv.includes("--ack-unscreened-images"))
		env.ZUGZWANG_SEED_UNSCREENED_IMAGES_ACK = "operator-curated";

	if (environment === "staging" || environment === "local") {
		// The staging resolver's own write-intent token, for the same class of act.
		env.ZUGZWANG_STAGING_WRITE_ACK = "generate-staging-fixtures";
	}

	if (environment === "prod") {
		if (!preflightOnly) {
			if (!argv.includes("--i-understand-this-writes-production")) {
				die(
					"a production write needs --i-understand-this-writes-production (or run --preflight-only first)",
				);
			}
			const rl = createInterface({
				input: process.stdin,
				output: process.stdout,
			});
			const typed = await rl.question(
				`\nThis writes seed accounts, bets and images to PRODUCTION from ${table}.\nType "${PROD_PHRASE}" to continue: `,
			);
			rl.close();
			if (typed.trim() !== PROD_PHRASE)
				die("confirmation phrase did not match; nothing was run");
		}
		env.ZUGZWANG_PROD_SEED_ACK = "seed-dummy-content-on-production";
	}

	// One run per table per mode. A second invocation would collide on keys and
	// account emails, and window mode sleeps for hours, so this is not unlikely.
	const runDir = dirname(table);
	const lockPath = join(runDir, `run-${environment}.lock`);
	let lock: number;
	try {
		lock = openSync(lockPath, "wx");
	} catch {
		die(
			`${lockPath} exists — another run on this table is active. If none is, delete the lock and retry.\n${existsSync(lockPath) ? readFileSync(lockPath, "utf8") : ""}`,
		);
	}
	// The runner refuses a prod run without this nonce in the lock (L-1), so the
	// lock and the typed confirmation cannot be skipped by calling vitest directly.
	const nonce = randomBytes(16).toString("hex");
	writeSync(
		lock,
		`pid ${process.pid} · ${new Date().toISOString()} · nonce ${nonce}\n`,
	);
	env.ZUGZWANG_SEED_LOCK = lockPath;
	env.ZUGZWANG_SEED_RUN_NONCE = nonce;
	closeSync(lock);
	const release = () => rmSync(lockPath, { force: true });
	process.on("exit", release);
	process.on("SIGINT", () => process.exit(130));

	const refusalPath = join(runDir, `REFUSED-${environment}.txt`);
	rmSync(refusalPath, { force: true });

	const vitest = ["exec", "vitest", "run", "--config", CONFIG, RUNNER];
	const doppler =
		environment === "local" ? null : environment === "staging" ? "stg" : "prd";
	const [command, args] = doppler
		? ([
				"doppler",
				[
					"run",
					"--project",
					"zugzwang-experiment",
					"--config",
					doppler,
					"--",
					"pnpm",
					...vitest,
				],
			] as const)
		: (["pnpm", vitest] as const);

	console.log(
		`[seed-prod] env=${environment} table=${table}${images ? ` images=${images}` : ""}${limit ? ` limit=${limit}` : ""}${preflightOnly ? " preflight-only" : ""}${windowLive ? " window-live" : ""}`,
	);
	console.log(`[seed-prod] ${command} ${args.join(" ")}\n`);

	for (let attempt = 1; attempt <= maxAttempts; attempt++) {
		const result = spawnSync(command, [...args], {
			stdio: "inherit",
			env,
			cwd: process.cwd(),
			// pnpm is a .cmd shim on Windows, which spawn cannot launch without a
			// shell. The arguments are fixed literals; paths travel in env vars.
			shell: process.platform === "win32",
		});
		if (result.error)
			die(`could not launch ${command}: ${result.error.message}`);
		if (result.status === 0) process.exit(0);
		if (existsSync(refusalPath)) {
			console.error(
				`\n[seed-prod] the runner recorded a refusal — not retrying:\n${readFileSync(refusalPath, "utf8")}`,
			);
			process.exit(result.status ?? 1);
		}
		if (attempt === maxAttempts) process.exit(result.status ?? 1);
		const backoff = Math.min(30_000 * attempt, 600_000);
		console.error(
			`\n[seed-prod] attempt ${attempt} exited ${result.status}; resuming in ${backoff / 1000}s (${maxAttempts - attempt} left)\n`,
		);
		await new Promise((r) => setTimeout(r, backoff));
	}
}

void main();
