/**
 * STAGING-RESET-AWS-1 — ONE-OFF. Resets the live staging database (RDS, inside
 * the VPC) exactly once, then this file is deleted (docs/plans/STAGING-RESET-AWS-1.md T5).
 *
 * Runs inside the `zugzwang-staging-migrate` ECS task (command override), which
 * carries only DATABASE_URL_STAGING + STAGING_PROJECT_REF_FRAGMENT. Every step
 * below is the SHIPPED tool for its job — this file only orders them:
 *
 *   0. capture  — READ-ONLY: the six live CONTENT markets (fixture slugs
 *                 excluded) + their market_media rows, written over
 *                 docs/data/staging-markets-snapshot.json INSIDE the container
 *                 (never committed), printed to the log, and parsed with the
 *                 seeder's own loader before anything is written. Founder
 *                 ruling (d): the markets come back with the copy live staging
 *                 holds today.
 *   1. reset    — tests/staging/reset.staging.test.ts (ADR-0035).
 *   2. pool     — scripts/seed-staging.ts (identity pool).
 *   3. create   — tests/staging/content-markets.staging.test.ts, create phase.
 *   4. open     — the same runner, open phase at p_yes 0.1, tank 100000 (ruling c).
 *
 * Modes (inside the task):
 *   --dry-run   verdict + capture + parse + the seeder booting on its READ-ONLY
 *               media phase. Writes nothing to the database.
 *   --run       steps 0–4, fail-fast.
 *   --resume    RECOVERY after a run that wiped staging but failed later:
 *               steps 2–4 only, from the image's committed snapshot (the live
 *               capture died with the failed task; its copy is in that task's
 *               CloudWatch log). Every step is idempotent.
 *
 * ⛔ The destructive acknowledgements are NOT set here — `--run` and `--resume`
 * refuse unless the CALLER passed them (the workflow, via the task's environment
 * override). A bare RunTask with this command cannot wipe staging.
 */
import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import postgres from "postgres";

import {
	CONTENT_MARKET_OVERRIDE_ENV,
	CONTENT_MARKET_OVERRIDE_VALUE,
	isFixtureSlug,
} from "../tests/staging/_lib/content-guard";
import {
	isAllowedStagingHost,
	isValidRefFragment,
	PRODUCTION_PROJECT_REF,
	PRODUCTION_RDS_MARKER,
	RESET_INTENT_ENV,
	RESET_INTENT_VALUE,
} from "../tests/staging/_lib/guards";
import {
	GENERATE_INTENT_ENV,
	GENERATE_INTENT_VALUE,
	TARGET_MODE_ENV,
} from "../tests/staging/_lib/target";
import {
	CONTENT_MARKET_COUNT,
	loadContentMarkets,
} from "../tests/staging/content-markets";

const MEDIA_SKIP_ENV = "ZUGZWANG_CONTENT_MARKETS_MEDIA_CHECK";
const MEDIA_SKIP_VALUE = "skip-for-staging-reset-once";
/** `createMarket` refuses a deadline past this (src/server/markets/create.ts). */
const FREEZE_INSTANT_UTC = new Date("2026-11-05T23:59:00.000Z");

const SNAPSHOT_PATH = "docs/data/staging-markets-snapshot.json";
const OPEN_PRICE = "0.1";
const OPEN_TANK = "100000";

function die(message: string): never {
	console.error(`[reset-once] REFUSED — ${message}`);
	process.exit(1);
}

/** The target check this file can make on its own, before any child runs. */
export function verdict(
	env: Readonly<Record<string, string | undefined>>,
): { ok: true; host: string } | { ok: false; reason: string } {
	const url = env.DATABASE_URL_STAGING;
	const fragment = env.STAGING_PROJECT_REF_FRAGMENT;
	if (!url) return { ok: false, reason: "DATABASE_URL_STAGING is not set" };
	if (
		url.includes(PRODUCTION_PROJECT_REF) ||
		url.toLowerCase().includes(PRODUCTION_RDS_MARKER)
	) {
		return { ok: false, reason: "DATABASE_URL_STAGING names production" };
	}
	let host: string;
	try {
		host = new URL(url).hostname.toLowerCase();
	} catch {
		return { ok: false, reason: "DATABASE_URL_STAGING is not a URL" };
	}
	if (!isAllowedStagingHost(host)) {
		return { ok: false, reason: `host ${host} is not a staging host` };
	}
	if (
		!fragment ||
		!isValidRefFragment(fragment, url) ||
		!url.includes(fragment)
	) {
		return {
			ok: false,
			reason: `STAGING_PROJECT_REF_FRAGMENT (length ${fragment?.length ?? 0}) is not a valid fragment of this URL — on RDS it must be 16+ chars of the INSTANCE identifier (the host's first label)`,
		};
	}
	if (env.ZUGZWANG_ENV !== "staging") {
		return {
			ok: false,
			reason: `ZUGZWANG_ENV is ${env.ZUGZWANG_ENV ?? "unset"}`,
		};
	}
	return { ok: true, host };
}

type MarketRow = {
	id: string;
	slug: string;
	title: string;
	description: string | null;
	status: string;
	resolution_deadline: Date;
	media_video_url: string | null;
};
type MediaRow = {
	market_id: string;
	r2_object_key: string;
	display_order: number;
	is_default: boolean;
};

/** Step 0 — the live markets in the snapshot's shape, plus what would fail. */
export function snapshotFrom(
	markets: readonly MarketRow[],
	media: readonly MediaRow[],
	capturedAt: string,
	host: string,
): { json: string; problems: string[] } {
	const problems: string[] = [];
	if (markets.length !== CONTENT_MARKET_COUNT) {
		problems.push(
			`expected ${CONTENT_MARKET_COUNT} content markets, found ${markets.length}: ${markets.map((m) => m.slug).join(", ")}`,
		);
	}
	const now = Date.now();
	for (const m of markets) {
		const deadline = new Date(m.resolution_deadline).getTime();
		if (!(deadline > now) || deadline > FREEZE_INSTANT_UTC.getTime()) {
			problems.push(
				`${m.slug}'s deadline ${new Date(m.resolution_deadline).toISOString()} would be refused by createMarket`,
			);
		}
		const own = media.filter((r) => r.market_id === m.id);
		if (own.filter((r) => r.is_default).length !== 1) {
			problems.push(
				`${m.slug} must have exactly one default image (has ${own.length} images)`,
			);
		}
	}
	const json = JSON.stringify(
		{
			capturedAt,
			source: `${host} (STAGING-RESET-AWS-1 step 0, live capture, never committed)`,
			markets: markets.map((m) => ({
				id: m.id,
				slug: m.slug,
				title: m.title,
				description: m.description,
				status: m.status,
				resolution_deadline: new Date(m.resolution_deadline).toISOString(),
				media_video_url: m.media_video_url,
			})),
			market_media: media.map((r) => ({
				market_id: r.market_id,
				r2_object_key: r.r2_object_key,
				display_order: r.display_order,
				is_default: r.is_default,
			})),
		},
		null,
		"\t",
	);
	return { json, problems };
}

async function capture(url: string, host: string): Promise<void> {
	const sql = postgres(url, { max: 1 });
	try {
		const [db] = await sql<
			{ database: string }[]
		>`SELECT current_database() AS database`;
		console.log(
			`[reset-once] step 0 · connected to ${host} / ${db?.database ?? "?"}`,
		);
		const all = await sql<MarketRow[]>`
			SELECT id, slug, title, description, status, resolution_deadline, media_video_url
			FROM markets ORDER BY created_at, id`;
		// CONTENT markets only — fixture rows belong to the reset (the predicate
		// its sixth gate uses) and must neither block nor pad the six.
		const markets = all.filter((m) => !isFixtureSlug(m.slug));
		for (const m of all) {
			const tag = isFixtureSlug(m.slug) ? "fixture " : m.status.padEnd(8);
			console.log(`[reset-once] step 0 · ${tag} ${m.slug} — ${m.title}`);
		}
		const ids = new Set(markets.map((m) => m.id));
		const media = (
			await sql<MediaRow[]>`
				SELECT market_id, r2_object_key, display_order, is_default
				FROM market_media ORDER BY market_id, display_order`
		).filter((r) => ids.has(r.market_id));
		const { json, problems } = snapshotFrom(
			markets,
			media,
			new Date().toISOString(),
			host,
		);
		if (problems.length > 0) die(`capture: ${problems.join("; ")}`);
		console.log("[reset-once] step 0 · CAPTURED SNAPSHOT (the recovery copy):");
		console.log(json);
		// Where the seeder reads it, then through the SEEDER'S OWN loader: every
		// rule it applies after the wipe is applied now, before anything is written.
		writeFileSync(SNAPSHOT_PATH, `${json}\n`);
		try {
			const specs = loadContentMarkets();
			console.log(
				`[reset-once] step 0 · the seeder parses the capture: ${specs.length} markets ✓`,
			);
		} catch (err) {
			die(`the capture does not parse as the seeder reads it: ${String(err)}`);
		}
	} finally {
		await sql.end({ timeout: 5 });
	}
}

function step(
	label: string,
	args: string[],
	extraEnv: Record<string, string>,
): void {
	console.log(`[reset-once] ${label} …`);
	const r = spawnSync("pnpm", args, {
		stdio: "inherit",
		env: { ...process.env, ...extraEnv },
		shell: process.platform === "win32",
	});
	if (r.error) die(`${label} could not start: ${r.error.message}`);
	if (r.status !== 0) {
		die(`${label} exited ${r.status ?? r.signal}; nothing after it ran`);
	}
	console.log(`[reset-once] ${label} ✓`);
}

const VITEST = [
	"exec",
	"vitest",
	"run",
	"--config",
	"vitest.staging.config.ts",
];
const SEEDER = "tests/staging/content-markets.staging.test.ts";
const SEEDER_ENV = {
	[TARGET_MODE_ENV]: "staging",
	[GENERATE_INTENT_ENV]: GENERATE_INTENT_VALUE,
	[MEDIA_SKIP_ENV]: MEDIA_SKIP_VALUE,
};

async function main(): Promise<void> {
	const mode = process.argv.includes("--run")
		? "run"
		: process.argv.includes("--resume")
			? "resume"
			: process.argv.includes("--dry-run")
				? "dry-run"
				: null;
	if (mode === null) die("pass --dry-run, --run or --resume");

	const v = verdict(process.env);
	if (!v.ok) die(`target: ${v.reason}`);
	console.log(`[reset-once] target ok · ${v.host} · mode ${mode}`);

	if (mode !== "dry-run") {
		if (process.env[RESET_INTENT_ENV] !== RESET_INTENT_VALUE) {
			die(
				`${RESET_INTENT_ENV} was not passed by the caller — this mode writes`,
			);
		}
		if (
			process.env[CONTENT_MARKET_OVERRIDE_ENV] !== CONTENT_MARKET_OVERRIDE_VALUE
		) {
			die(`${CONTENT_MARKET_OVERRIDE_ENV} was not passed by the caller`);
		}
	}

	if (mode === "resume") {
		console.log(
			"[reset-once] RESUME — no capture, no reset; markets come from the image's committed snapshot",
		);
	} else {
		await capture(process.env.DATABASE_URL_STAGING as string, v.host);
		if (mode === "dry-run") {
			// The half the guard check cannot prove: Vitest boots in this image,
			// the staging config + global setup load, the engine graph fits in
			// memory, and the seeder reads the capture — via its READ-ONLY media
			// phase (R2 skipped, as the run will skip it).
			step(
				"dry run · the seeder boots (media phase, read-only)",
				[...VITEST, SEEDER],
				{
					...SEEDER_ENV,
					ZUGZWANG_CONTENT_MARKETS_PHASE: "media",
				},
			);
			console.log("[reset-once] dry run — nothing written to the database.");
			return;
		}
		step(
			"step 1 · reset",
			[...VITEST, "tests/staging/reset.staging.test.ts"],
			{},
		);
	}
	step(
		"step 2 · identity pool",
		["exec", "tsx", "scripts/seed-staging.ts"],
		{},
	);
	step("step 3 · create markets", [...VITEST, SEEDER], {
		...SEEDER_ENV,
		ZUGZWANG_CONTENT_MARKETS_PHASE: "create",
	});
	step("step 4 · open at 10/90", [...VITEST, SEEDER], {
		...SEEDER_ENV,
		ZUGZWANG_CONTENT_MARKETS_PHASE: "open",
		ZUGZWANG_CONTENT_MARKETS_PRICE: OPEN_PRICE,
		ZUGZWANG_CONTENT_MARKETS_TANK: OPEN_TANK,
	});
	console.log("[reset-once] DONE — six markets recreated and opened at 10/90.");
}

if (process.argv[1]?.endsWith("staging-reset-once.ts")) {
	main().catch((err: unknown) => {
		console.error("[reset-once] FAILED:", err);
		process.exit(1);
	});
}
