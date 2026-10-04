/**
 * STAGING-RESET-AWS-1 — ONE-OFF. Resets the live staging database (RDS, inside
 * the VPC) exactly once, then this file is deleted (docs/plans/STAGING-RESET-AWS-1.md T5).
 *
 * Runs inside the `zugzwang-staging-migrate` ECS task (command override), which
 * carries only DATABASE_URL_STAGING + STAGING_PROJECT_REF_FRAGMENT. Every step
 * below is the SHIPPED tool for its job — this file only orders them:
 *
 *   0. capture  — READ-ONLY: the six live markets + their market_media rows,
 *                 written over docs/data/staging-markets-snapshot.json INSIDE the
 *                 container (never committed) and printed to the log. Founder
 *                 ruling (d): the markets come back with the copy live staging
 *                 holds today. Refuses unless exactly six, one default image each.
 *   1. reset    — tests/staging/reset.staging.test.ts (ADR-0035), with the
 *                 content-market acknowledgement.
 *   2. pool     — scripts/seed-staging.ts (identity pool).
 *   3. create   — tests/staging/content-markets.staging.test.ts --create
 *   4. open     — the same runner, --open at p_yes 0.1, tank 100000 (ruling c).
 *
 * Usage (inside the task):
 *   pnpm exec tsx scripts/staging-reset-once.ts --dry-run   # guard verdict + capture, writes nothing
 *   pnpm exec tsx scripts/staging-reset-once.ts --run       # all five steps, fail-fast
 */
import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import postgres from "postgres";

import {
	isAllowedStagingHost,
	isValidRefFragment,
	PRODUCTION_PROJECT_REF,
	RESET_INTENT_ENV,
	RESET_INTENT_VALUE,
} from "../tests/staging/_lib/guards";

const SNAPSHOT_PATH = "docs/data/staging-markets-snapshot.json";
const EXPECTED_MARKETS = 6;
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
	if (url.includes(PRODUCTION_PROJECT_REF)) {
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
			reason: `STAGING_PROJECT_REF_FRAGMENT (length ${fragment?.length ?? 0}) is not a valid fragment of this URL`,
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
	description: string;
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

/** Step 0 — READ-ONLY capture of the live markets, in the snapshot's shape. */
export function snapshotFrom(
	markets: readonly MarketRow[],
	media: readonly MediaRow[],
	capturedAt: string,
	host: string,
): { json: string; problems: string[] } {
	const problems: string[] = [];
	if (markets.length !== EXPECTED_MARKETS) {
		problems.push(
			`expected ${EXPECTED_MARKETS} markets, found ${markets.length}: ${markets.map((m) => m.slug).join(", ")}`,
		);
	}
	for (const m of markets) {
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

async function capture(url: string, host: string): Promise<string> {
	const sql = postgres(url, { max: 1 });
	try {
		const [db] = await sql<
			{ database: string }[]
		>`SELECT current_database() AS database`;
		console.log(
			`[reset-once] step 0 · connected to ${host} / ${db?.database ?? "?"}`,
		);
		const markets = await sql<MarketRow[]>`
			SELECT id, slug, title, description, status, resolution_deadline, media_video_url
			FROM markets ORDER BY created_at, id`;
		const media = await sql<MediaRow[]>`
			SELECT market_id, r2_object_key, display_order, is_default
			FROM market_media ORDER BY market_id, display_order`;
		const { json, problems } = snapshotFrom(
			markets,
			media,
			new Date().toISOString(),
			host,
		);
		for (const m of markets) {
			console.log(
				`[reset-once] step 0 · ${m.status.padEnd(8)} ${m.slug} — ${m.title}`,
			);
		}
		if (problems.length > 0) die(`capture: ${problems.join("; ")}`);
		console.log("[reset-once] step 0 · CAPTURED SNAPSHOT (the recovery copy):");
		console.log(json);
		return json;
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
	if (r.status !== 0)
		die(`${label} exited ${r.status ?? r.signal}; nothing after it ran`);
	console.log(`[reset-once] ${label} ✓`);
}

const VITEST = [
	"exec",
	"vitest",
	"run",
	"--config",
	"vitest.staging.config.ts",
];
const SEEDER_ENV = {
	ZUGZWANG_STAGING_TARGET: "staging",
	ZUGZWANG_STAGING_WRITE_ACK: "generate-staging-fixtures",
};

async function main(): Promise<void> {
	const mode = process.argv.includes("--run")
		? "run"
		: process.argv.includes("--dry-run")
			? "dry-run"
			: null;
	if (mode === null) die("pass --dry-run or --run");

	const v = verdict(process.env);
	if (!v.ok) die(`target: ${v.reason}`);
	console.log(`[reset-once] target ok · ${v.host} · mode ${mode}`);

	const json = await capture(
		process.env.DATABASE_URL_STAGING as string,
		v.host,
	);
	if (mode === "dry-run") {
		console.log("[reset-once] dry run — nothing written. Re-run with --run.");
		return;
	}

	writeFileSync(SNAPSHOT_PATH, `${json}\n`);
	step("step 1 · reset", [...VITEST, "tests/staging/reset.staging.test.ts"], {
		[RESET_INTENT_ENV]: RESET_INTENT_VALUE,
		ZUGZWANG_STAGING_INCLUDE_CONTENT_MARKETS: "include-content-markets",
	});
	step(
		"step 2 · identity pool",
		["exec", "tsx", "scripts/seed-staging.ts"],
		{},
	);
	step(
		"step 3 · create markets",
		[...VITEST, "tests/staging/content-markets.staging.test.ts"],
		{
			...SEEDER_ENV,
			ZUGZWANG_CONTENT_MARKETS_PHASE: "create",
		},
	);
	step(
		"step 4 · open at 10/90",
		[...VITEST, "tests/staging/content-markets.staging.test.ts"],
		{
			...SEEDER_ENV,
			ZUGZWANG_CONTENT_MARKETS_PHASE: "open",
			ZUGZWANG_CONTENT_MARKETS_PRICE: OPEN_PRICE,
			ZUGZWANG_CONTENT_MARKETS_TANK: OPEN_TANK,
		},
	);
	console.log("[reset-once] DONE — six markets recreated and opened at 10/90.");
}

if (process.argv[1]?.endsWith("staging-reset-once.ts")) {
	main().catch((err: unknown) => {
		console.error("[reset-once] FAILED:", err);
		process.exit(1);
	});
}
