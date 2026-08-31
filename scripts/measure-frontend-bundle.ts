/**
 * MEASURE FRONTEND BUNDLE — HO-T4. What the toolchain refuses to tell you for free.
 *
 * Next 16.3.2 + Turbopack emits no "First Load JS" column, no
 * `.next/app-build-manifest.json`, and no chunk sourcemaps (all three confirmed
 * absent — do not re-check). So this reads the two artifacts that DO survive a
 * production build and reconstructs the number by hand:
 *
 *   - `.next/build-manifest.json` → `rootMainFiles` + `polyfillFiles` is the
 *     SHARED baseline every route pays regardless of what it renders.
 *   - `.next/server/app/**\/*_client-reference-manifest.js` → per-ROUTE, the set
 *     of chunk files its own client tree actually references. Each file embeds
 *     its own route key (`globalThis.__RSC_MANIFEST["/(public)/m/[slug]/page"]`),
 *     which is what this script keys off — never the file's own path on disk,
 *     because deriving a route from a Windows filesystem path is exactly the
 *     backslash-vs-forward-slash bug class T1's evidence found three separate
 *     instances of elsewhere in this repo. The route key is a JSON STRING VALUE
 *     Next.js already wrote correctly; reading it costs nothing and sidesteps the
 *     whole bug class rather than re-deriving it.
 *
 * ⚠ WITHOUT SOURCEMAPS, PER-MODULE BYTE ATTRIBUTION INSIDE A CHUNK IS NOT
 * AVAILABLE ON THIS TOOLCHAIN. This script reports chunk-level and route-level
 * totals only. Anything claiming to name what's inside one specific chunk (the
 * composition report) is doing it by a DIFFERENT method — a differential build,
 * never a guess — and says so plainly, in the report that consumes this script's
 * output, not here.
 *
 * "Route-own" below means: bytes in this route's chunk set that are NOT in the
 * shared baseline. It does NOT mean "exclusive to this route and no other" — two
 * non-home routes can each have the same chunk counted as their own if neither is
 * the shared baseline and both reference it. Whether a specific chunk is
 * EXCLUSIVE to one route (the property T5 cares about) is a further check, not
 * this script's default output — see `--exclusive-to <route>` below.
 *
 * ── HOW TO RUN ────────────────────────────────────────────────────────────────
 *
 *   pnpm exec next build && just bundle-report
 *
 *   … tsx scripts/measure-frontend-bundle.ts --exclusive-to=/m/[slug]
 *       lists chunks referenced by that route and by NO other route's manifest —
 *       the check T5's kickoff needs before it can claim a chunk pair is
 *       exclusive to `DebateView.tsx`.
 *
 * Writes `scripts/bundle-baseline.json` (committed, read back by
 * `tests/unit/scripts/bundle-baseline.test.ts` to pin a ceiling) and prints a
 * human-readable table to stdout. Never runs the build itself — a script that
 * silently rebuilds on every invocation is a script whose run time nobody can
 * predict, and the pinned-baseline TEST must not pay a multi-minute build cost
 * per `vitest run` (§4 of the brief, restated here because it is the reason this
 * file has no `execSync("next build")` anywhere in it).
 */

import {
	existsSync,
	readdirSync,
	readFileSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { join, relative, sep } from "node:path";
import { gzipSync } from "node:zlib";

const ROOT = process.cwd();
const NEXT_DIR = join(ROOT, ".next");
export const OUTPUT_PATH = join(ROOT, "scripts", "bundle-baseline.json");

export interface RouteBundle {
	route: string;
	chunkCount: number;
	totalRawBytes: number;
	totalGzipBytes: number;
	ownRawBytes: number;
	ownGzipBytes: number;
}

export interface BundleReport {
	measuredAt: string;
	sharedChunkCount: number;
	sharedRawBytes: number;
	sharedGzipBytes: number;
	largestSharedChunkRawBytes: number;
	nextStaticTotalRawBytes: number;
	routes: RouteBundle[];
}

function readBuildManifest(): { shared: Set<string> } {
	const path = join(NEXT_DIR, "build-manifest.json");
	if (!existsSync(path)) {
		throw new Error(
			`${path} not found. Run "pnpm exec next build" before this script — ` +
				"it reads the build's own output and never builds itself.",
		);
	}
	const manifest = JSON.parse(readFileSync(path, "utf8")) as {
		rootMainFiles?: string[];
		polyfillFiles?: string[];
	};
	return {
		shared: new Set([
			...(manifest.rootMainFiles ?? []),
			...(manifest.polyfillFiles ?? []),
		]),
	};
}

/** Every `*_client-reference-manifest.js` under `.next/server/app`, recursively. */
function findClientReferenceManifests(dir: string): string[] {
	if (!existsSync(dir)) return [];
	const out: string[] = [];
	const entries = readdirSync(dir, { recursive: true, withFileTypes: true });
	for (const entry of entries) {
		if (
			entry.isFile() &&
			entry.name.endsWith("_client-reference-manifest.js")
		) {
			// `entry.parentPath` is what recursive readdirSync gives per-entry (Node
			// 20.12+/21.4+); joining with `entry.name` — never string-concatenating
			// against ROOT — is what keeps this correct on Windows.
			out.push(join(entry.parentPath, entry.name));
		}
	}
	return out;
}

/**
 * One `..._client-reference-manifest.js` file assigns
 * `globalThis.__RSC_MANIFEST["<route key>"] = {clientModules: {...}}`. The route
 * key is read verbatim from that assignment — never derived from the file's own
 * path — because Next already wrote it correctly and a path-based re-derivation
 * would just be a second, redundant place for the Windows separator bug to hide.
 */
function parseClientReferenceManifest(path: string): {
	routeKey: string;
	chunks: Set<string>;
} {
	const src = readFileSync(path, "utf8");
	const match = src.match(
		/globalThis\.__RSC_MANIFEST\["([^"]+)"\]\s*=\s*(\{[\s\S]*\});?\s*$/,
	);
	if (!match?.[1] || !match[2]) {
		throw new Error(`could not parse RSC manifest assignment in ${path}`);
	}
	const routeKey = match[1];
	const manifest = JSON.parse(match[2]) as {
		clientModules?: Record<string, { chunks?: string[] }>;
	};
	const chunks = new Set<string>();
	for (const mod of Object.values(manifest.clientModules ?? {})) {
		for (const raw of mod.chunks ?? []) {
			// Manifest chunk paths are "/_next/static/chunks/x.js"; build-manifest's
			// shared-file paths are "static/chunks/x.js" — same file, different
			// prefix. Normalizing here is what lets the two sets be compared by
			// simple `Set` membership below.
			chunks.add(raw.replace(/^\/?_next\//, ""));
		}
	}
	return { routeKey, chunks };
}

/** `"/(public)/m/[slug]/page"` → `"/m/[slug]"`. `"/(public)/page"` → `"/"`. */
export function routeKeyToPath(routeKey: string): string {
	const withoutGroup = routeKey.replace(/\/\([^/)]+\)/g, "");
	const withoutSuffix = withoutGroup.replace(/\/(page|route)$/, "");
	return withoutSuffix === "" ? "/" : withoutSuffix;
}

function fileSizeBytes(staticRelativePath: string): number {
	return statSync(join(NEXT_DIR, staticRelativePath)).size;
}

function gzipSizeBytes(staticRelativePath: string): number {
	return gzipSync(readFileSync(join(NEXT_DIR, staticRelativePath)), {
		level: 9,
	}).length;
}

function dirSizeBytes(dir: string): number {
	if (!existsSync(dir)) return 0;
	let total = 0;
	const entries = readdirSync(dir, { recursive: true, withFileTypes: true });
	for (const entry of entries) {
		if (entry.isFile()) {
			total += statSync(join(entry.parentPath, entry.name)).size;
		}
	}
	return total;
}

export function measure(): {
	report: BundleReport;
	manifests: Map<string, Set<string>>;
} {
	const { shared } = readBuildManifest();

	let sharedRawBytes = 0;
	let sharedGzipBytes = 0;
	let largestSharedChunkRawBytes = 0;
	for (const f of shared) {
		const raw = fileSizeBytes(f);
		sharedRawBytes += raw;
		sharedGzipBytes += gzipSizeBytes(f);
		if (raw > largestSharedChunkRawBytes) largestSharedChunkRawBytes = raw;
	}

	const manifestFiles = findClientReferenceManifests(
		join(NEXT_DIR, "server", "app"),
	);
	const manifests = new Map<string, Set<string>>(); // route -> chunk set (for --exclusive-to)
	const routes: RouteBundle[] = [];

	for (const mf of manifestFiles) {
		const { routeKey, chunks } = parseClientReferenceManifest(mf);
		const route = routeKeyToPath(routeKey);
		manifests.set(route, chunks);

		let totalRawBytes = 0;
		let totalGzipBytes = 0;
		let ownRawBytes = 0;
		let ownGzipBytes = 0;
		for (const c of chunks) {
			const raw = fileSizeBytes(c);
			const gz = gzipSizeBytes(c);
			totalRawBytes += raw;
			totalGzipBytes += gz;
			if (!shared.has(c)) {
				ownRawBytes += raw;
				ownGzipBytes += gz;
			}
		}
		routes.push({
			route,
			chunkCount: chunks.size,
			totalRawBytes,
			totalGzipBytes,
			ownRawBytes,
			ownGzipBytes,
		});
	}
	routes.sort((a, b) => a.route.localeCompare(b.route));

	const report: BundleReport = {
		measuredAt: new Date().toISOString(),
		sharedChunkCount: shared.size,
		sharedRawBytes,
		sharedGzipBytes,
		largestSharedChunkRawBytes,
		nextStaticTotalRawBytes: dirSizeBytes(join(NEXT_DIR, "static")),
		routes,
	};
	return { report, manifests };
}

function kib(bytes: number): string {
	return `${(bytes / 1024).toFixed(1)} KiB`;
}

function printHuman(report: BundleReport): void {
	console.log("Frontend bundle report —", report.measuredAt);
	console.log("");
	console.log(
		`Shared chunks, loaded by every route: ${kib(report.sharedRawBytes)} raw / ${kib(
			report.sharedGzipBytes,
		)} gzip (${report.sharedChunkCount} files)`,
	);
	console.log(
		`Largest single shared chunk: ${kib(report.largestSharedChunkRawBytes)} raw`,
	);
	console.log(`.next/static on disk: ${kib(report.nextStaticTotalRawBytes)}`);
	console.log("");
	console.log(
		"Route".padEnd(28),
		"own raw".padStart(12),
		"own gzip".padStart(12),
		"total raw".padStart(12),
	);
	for (const r of report.routes) {
		console.log(
			r.route.padEnd(28),
			kib(r.ownRawBytes).padStart(12),
			kib(r.ownGzipBytes).padStart(12),
			kib(r.totalRawBytes).padStart(12),
		);
	}
}

/** `--exclusive-to=/m/[slug]` — chunks that route references and no other route does. */
function printExclusiveTo(
	route: string,
	manifests: Map<string, Set<string>>,
): void {
	const mine = manifests.get(route);
	if (!mine) {
		console.error(`No manifest found for route "${route}". Known routes:`, [
			...manifests.keys(),
		]);
		process.exitCode = 1;
		return;
	}
	const others = new Set<string>();
	for (const [r, chunks] of manifests) {
		if (r === route) continue;
		for (const c of chunks) others.add(c);
	}
	const exclusive = [...mine].filter((c) => !others.has(c));
	let rawBytes = 0;
	let gzipBytes = 0;
	for (const c of exclusive) {
		rawBytes += fileSizeBytes(c);
		gzipBytes += gzipSizeBytes(c);
	}
	console.log(
		`Chunks exclusive to ${route} (referenced by no other route's manifest):`,
	);
	for (const c of exclusive) console.log(" ", c);
	console.log(`Exclusive total: ${kib(rawBytes)} raw / ${kib(gzipBytes)} gzip`);
}

function main(): void {
	const { report, manifests } = measure();
	printHuman(report);
	writeFileSync(OUTPUT_PATH, `${JSON.stringify(report, null, "\t")}\n`);
	console.log("");
	console.log(`Written: ${relative(ROOT, OUTPUT_PATH).split(sep).join("/")}`);

	const exclusiveArg = process.argv.find((a) =>
		a.startsWith("--exclusive-to="),
	);
	if (exclusiveArg) {
		console.log("");
		printExclusiveTo(exclusiveArg.slice("--exclusive-to=".length), manifests);
	}
}

main();
