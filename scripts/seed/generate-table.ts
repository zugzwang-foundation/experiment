/**
 * SEED-1-DUMMY — write a seed table (ADR-0053; SEED-1 §4).
 *
 * Pure and offline: no database, no network. The table is the single source of
 * truth for a seed run — the runner executes exactly what this writes, and the
 * same options always write the same table, so keys resume rather than duplicate.
 *
 *   pnpm exec tsx scripts/seed/generate-table.ts \
 *     --markets bitcoin-price-50k,claude-bundle-response,... \
 *     --users 1000 --posts 100 --coverage 0.5 --out ../seed-runs/<run>
 *
 * Optional: --yes-ratio 0.4 --image-ratio 0.5 --image-ext png --window 0|24h --seed 1
 */
import { randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";

import { generateTable } from "../../tests/prod-seed/_lib/generate";
import { AUTHOR_SPEND_CAP, authorsOf } from "../../tests/prod-seed/_lib/table";

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
	const m = raw.match(/^(\d+)(h|m)$/);
	if (!m) die(`--window must be 0, <n>h or <n>m (saw ${raw})`);
	return Number(m[1]) * (m[2] === "h" ? 3_600_000 : 60_000);
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
const table = generateTable({
	runId,
	markets,
	users: num(argv, "--users", 1000),
	postsPerMarket: num(argv, "--posts", 100),
	coverage: num(argv, "--coverage", 0.5),
	yesRatio: num(argv, "--yes-ratio", 0.4),
	imageRatio: num(argv, "--image-ratio", 0.5),
	imageExt: flag(argv, "--image-ext") ?? "png",
	windowMs: windowMs(flag(argv, "--window")),
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
for (const m of markets) {
	const rows = table.rows.filter((r) => r.market === m);
	const stake = (side: string) =>
		rows
			.filter((r) => r.side === side)
			.reduce((s, r) => s + Number(r.stake), 0);
	console.log(
		`  ${m.padEnd(40)} posts ${rows.filter((r) => r.kind === "post").length} · replies ${rows.filter((r) => r.kind !== "post").length} · images ${rows.filter((r) => r.image).length} · stake YES ${stake("YES")} / NO ${stake("NO")}`,
	);
}
console.log(
	`  spend per author: min ${spends[0]} · median ${spends[Math.floor(spends.length / 2)]} · max ${spends[spends.length - 1]} (cap ${AUTHOR_SPEND_CAP})`,
);
