/**
 * SEED-1-DUMMY — write a seed table (ADR-0053; SEED-1 §4).
 *
 * Pure and offline: no database, no network. The table is the single source of
 * truth for a seed run — the runner executes exactly what this writes, and the
 * same options always write the same table, so keys resume rather than duplicate.
 *
 *   pnpm exec tsx scripts/seed/generate-table.ts \
 *     --markets bitcoin-price-50k,claude-bundle-response,... \
 *     --users 100 --posts 8 --replies 10 --depth2 7 --window 14m --out ../seed-runs/<run>
 *
 * Optional: --yes-ratio 0.4 --image-ratio 0 --image-ext png --spacing even|random
 * --window 0|<n>h|<n>m|<n>s --seed 1 --run-id <id>
 *
 * SEED-DEPTH2 (test branch, not for merge): per market, --posts depth-0 rows,
 * --replies depth-1 rows (on posts) and --depth2 depth-2 rows (on depth-1
 * replies). Defaults are the 2026-09-15 load-run spec: 100 users, 8/10/7 per
 * market (25 rows; 200 over 8 markets), no images, even spacing. `--coverage`
 * is gone — it described one support + one counter per covered post.
 */
import { randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";

import { generateTable } from "../../tests/prod-seed/_lib/generate";
import {
	AUTHOR_SPEND_CAP,
	authorsOf,
	rowDepths,
} from "../../tests/prod-seed/_lib/table";

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

function num(argv: readonly string[], name: string, fallback: number): number {
	const raw = flag(argv, name);
	if (raw === undefined) return fallback;
	const n = Number(raw);
	if (!Number.isFinite(n)) die(`${name} must be a number (saw ${raw})`);
	return n;
}

function windowMs(raw: string | undefined): number {
	if (raw === undefined || raw === "0") return 0;
	const m = raw.match(/^(\d+)(h|m|s)$/);
	if (!m) die(`--window must be 0, <n>h, <n>m or <n>s (saw ${raw})`);
	return (
		Number(m[1]) * (m[2] === "h" ? 3_600_000 : m[2] === "m" ? 60_000 : 1000)
	);
}

const argv = process.argv.slice(2);
// Minted from a CSPRNG unless given, so the run id is never a guessable literal.
const runId = flag(argv, "--run-id") ?? `seed${randomBytes(8).toString("hex")}`;
const marketsRaw =
	flag(argv, "--markets") ??
	die("--markets is required (comma-separated slugs)");
const out =
	flag(argv, "--out") ??
	die("--out is required (a folder OUTSIDE the repository)");

const markets = marketsRaw
	.split(",")
	.map((s) => s.trim())
	.filter(Boolean);
if (argv.includes("--coverage"))
	die("--coverage was replaced by --replies / --depth2 (SEED-DEPTH2)");
const spacing = flag(argv, "--spacing") ?? "even";
if (spacing !== "even" && spacing !== "random")
	die(`--spacing must be even | random (saw ${spacing})`);
const table = generateTable({
	runId,
	markets,
	users: num(argv, "--users", 100),
	postsPerMarket: num(argv, "--posts", 8),
	repliesPerMarket: num(argv, "--replies", 10),
	depth2PerMarket: num(argv, "--depth2", 7),
	yesRatio: num(argv, "--yes-ratio", 0.4),
	imageRatio: num(argv, "--image-ratio", 0),
	imageExt: flag(argv, "--image-ext") ?? "png",
	windowMs: windowMs(flag(argv, "--window")),
	spacing,
	seed: num(argv, "--seed", 1),
});

const dir = resolve(out);
const inRepo = relative(process.cwd(), dir);
if (!inRepo.startsWith("..") && !isAbsolute(inRepo)) {
	die(`--out ${dir} is inside the repository; seed runs write manifests there`);
}
mkdirSync(dir, { recursive: true });
const path = join(dir, "table.json");
writeFileSync(path, `${JSON.stringify(table, null, "\t")}\n`);

// ── What was written ─────────────────────────────────────────────────────
const spend = new Map<string, number>();
for (const r of table.rows)
	spend.set(r.author, (spend.get(r.author) ?? 0) + Number(r.stake));
const spends = [...spend.values()].sort((a, b) => a - b);
console.log(`table written: ${path}`);
console.log(
	`  run ${runId} · ${markets.length} markets · ${table.rows.length} rows · ${authorsOf(table).length} authors`,
);
const depths = rowDepths(table.rows);
const last = table.rows[table.rows.length - 1];
console.log(
	`  timing: last row due +${Math.round((last?.dueOffsetMs ?? 0) / 1000)}s · ${spacing} spacing${table.rows.length > 1 && last && last.dueOffsetMs > 0 ? ` · gap ~${Math.round(last.dueOffsetMs / (table.rows.length - 1))}ms` : ""}`,
);
for (const m of markets) {
	const rows = table.rows.filter((r) => r.market === m);
	const atDepth = (d: number) =>
		rows.filter((r) => depths.get(r.key) === d).length;
	const stake = (side: string) =>
		rows
			.filter((r) => r.side === side)
			.reduce((s, r) => s + Number(r.stake), 0);
	console.log(
		`  ${m.padEnd(40)} posts ${atDepth(0)} · depth-1 ${atDepth(1)} · depth-2 ${atDepth(2)} · images ${rows.filter((r) => r.image).length} · stake YES ${stake("YES")} / NO ${stake("NO")}`,
	);
}
console.log(
	`  spend per author: min ${spends[0]} · median ${spends[Math.floor(spends.length / 2)]} · max ${spends[spends.length - 1]} (cap ${AUTHOR_SPEND_CAP})`,
);
