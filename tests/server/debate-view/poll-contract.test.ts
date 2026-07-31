import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

// F-DEBATE-4 (B3) tests-first — the READ-PATH / STRUCTURAL half of the
// polled-on-view refresh (SPEC.1 1.0.25 §9 F-DEBATE-4; plan §7). SOURCE-GREP
// guard in the `tests/server/system/is-frozen-surface.test.ts` convention: it
// reads files as TEXT via `node:fs` and never imports the modules, so it makes
// no IO and needs no DB.
//
// SPEC.1 §17 rows proved here:
//   debate-view::poll-preserves-removal-masking
//   debate-view::poll-stops-when-market-leaves-open
//
// ── WHAT THE MASKING ROW DOES AND DOES NOT PROVE ────────────────────────────
// Stated plainly, because the honest answer matters more than a green tick.
//
// It does NOT re-prove removal masking. The poll re-invokes the SAME server read
// as the first paint, so this build adds no masking code, and there is nothing
// new whose masking behaviour could be asserted. Masking behaviour is owned by
// `tests/server/debate-view/load-debate-view.integration.test.ts` (the DEBATE.4
// §6 gate), which this task EXTENDS with one repeated-invocation case rather
// than duplicating.
//
// What it DOES prove is the STRUCTURAL premise the whole mechanism rests on:
// that exactly one debate read path exists, that the poll rides it rather than
// forking it, and that masking stays single-sourced on `loadRemovedSet` inside
// `loadDebateView` (ADR-0021; ADR-0034 D-4). A second read path is a second
// place for masking to diverge, and that divergence is the failure this row
// exists to prevent.
//
// Its reach, stated honestly rather than claimed broadly. It DOES catch: a new
// Route Handler anywhere under `src/app` (the pinned inventory); a client
// transport — fetch / SWR / react-query / EventSource / WebSocket / XHR / axios
// / sendBeacon — appearing anywhere in the debate READ tree; a third
// `loadDebateView(` call site; a session parameter threaded into the loader; a
// second `loadRemovedSet` definition. It does NOT catch: an aliased import
// (`import { loadDebateView as load }`), a masking reimplementation that never
// names `loadRemovedSet`, or a transport reached through an indirection this
// regex cannot see. It is a tripwire on the cheap paths, not a proof.
//
// RED target: `src/components/debate/DebatePoll.tsx` does not exist yet, so the
// positive assertions fail against `origin/main`. The negative assertions pass
// today by design — they pin a contract rather than drive a build (the same
// split the is-frozen-surface guard documents).

const ROOT = process.cwd();

/** Read a repo-relative source file as text; `null` when absent (clean RED). */
function src(relative: string): string | null {
	const path = join(ROOT, relative);
	return existsSync(path) ? readFileSync(path, "utf8") : null;
}

/**
 * Strip comments before asserting — the `no-raw-hex-view-layer.test.ts` /
 * `no-raw-dharma-render.test.ts` convention. Load-bearing here: the negative
 * assertions below forbid the poll from *reading* certain signals, and the
 * module's docblock necessarily NAMES those signals to explain why it does not
 * read them. Matching prose would punish the documentation this guard wants.
 */
function stripComments(source: string): string {
	return source
		.replace(/\/\*[\s\S]*?\*\//g, "")
		.replace(/^\s*\/\/.*$/gm, "")
		.replace(/\/\/[^"'`\n]*$/gm, "");
}

/** A repo-relative file's CODE — comments removed. `""` when absent. */
function code(relative: string): string {
	return stripComments(src(relative) ?? "");
}

/** Repo-relative `.ts`/`.tsx` files under a repo-relative directory. */
function sourcesUnder(relativeDir: string): string[] {
	return readdirSync(join(ROOT, relativeDir), {
		recursive: true,
		withFileTypes: true,
	})
		.filter(
			(entry) =>
				entry.isFile() &&
				(entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")),
		)
		.map((entry) => join(entry.parentPath, entry.name).replace(`${ROOT}/`, ""))
		.sort();
}

const POLL = "src/components/debate/DebatePoll.tsx";
const HOST = "src/components/debate/DebateView.tsx";
const LOADER = "src/server/debate-view/load-debate-view.ts";
const PAGE = "src/app/(public)/m/[slug]/page.tsx";
const EXPORT_ROUTE = "src/app/(public)/m/[slug]/export/route.ts";

/**
 * Any client-side transport a forked poll could reach for. SSE and WebSocket are
 * named because SPEC.2 §4.3 forbids them by name; the rest cover the ordinary
 * ways a "lighter" poll gets written.
 */
const CLIENT_FETCH =
	/\bfetch\s*\(|\buseSWR\b|\buseQuery\b|\buseInfiniteQuery\b|\bEventSource\b|\bWebSocket\b|\bXMLHttpRequest\b|\baxios\b|sendBeacon/;

/**
 * The debate READ tree — every client module that renders the polled payload.
 * `composer/` is excluded on purpose: the write path legitimately fetches
 * (`/api/bets/place`, `/api/bets/sell`, the quote read), and this guard is about
 * the READ never forking, not about the composer.
 */
const READ_TREE_EXCLUDES = /\/composer\//;

describe("debate-view::poll-preserves-removal-masking", () => {
	it("the poll module exists and refreshes by re-invoking the server read", () => {
		expect(src(POLL)).not.toBeNull();
		expect(code(POLL)).toMatch(/useRouter/);
		expect(code(POLL)).toMatch(/router\.refresh\(\)/);
	});

	it("the poll issues no client-side data fetch of its own", () => {
		expect(src(POLL)).not.toBeNull();
		expect(CLIENT_FETCH.test(code(POLL))).toBe(false);
	});

	it("no module in the debate READ tree issues a client-side data fetch", () => {
		const offenders = sourcesUnder("src/components/debate")
			.filter((file) => !READ_TREE_EXCLUDES.test(file))
			.filter((file) => CLIENT_FETCH.test(code(file)));
		expect(offenders).toEqual([]);
	});

	it("adds no read endpoint under /m/[slug] — exactly quote/ and export/", () => {
		const routes = sourcesUnder("src/app/(public)/m/[slug]").filter((file) =>
			file.endsWith("/route.ts"),
		);
		expect(routes).toEqual([
			EXPORT_ROUTE,
			"src/app/(public)/m/[slug]/quote/route.ts",
		]);
	});

	it("adds no Route Handler ANYWHERE — the repo-wide route.ts inventory is pinned", () => {
		// The tightest available encoding of "SPEC.2 §4.3's catalogue is closed at
		// eleven and F-DEBATE-4 adds no twelfth". A poll endpoint parked outside
		// `m/[slug]` — say `src/app/api/debate/[id]/route.ts` — is invisible to the
		// subtree check above but cannot hide from this one. A future handler is
		// not forbidden; it must be a conscious edit here.
		// (On-disk 13 vs the §4.3 table's eleven rows is PRE-EXISTING drift, not
		// this task's: `api/visits`, `api/cron/alarms-drain` and `m/[slug]/quote`
		// are built but uncatalogued, and `api/dataset/manifest` is catalogued but
		// pending-build. Surfaced, deliberately not corrected here.)
		const routes = sourcesUnder("src/app").filter((file) =>
			file.endsWith("/route.ts"),
		);
		expect(routes).toEqual([
			"src/app/(admin)/admin/markets/media/sign/route.ts",
			EXPORT_ROUTE,
			"src/app/(public)/m/[slug]/quote/route.ts",
			"src/app/api/_smoke-error/route.ts",
			"src/app/api/auth/[...all]/route.ts",
			"src/app/api/bets/place/route.ts",
			"src/app/api/bets/sell/route.ts",
			"src/app/api/cron/alarms-drain/route.ts",
			"src/app/api/cron/close-due-markets/route.ts",
			"src/app/api/cron/r2-orphan-sweep/route.ts",
			"src/app/api/health/route.ts",
			"src/app/api/uploads/sign/route.ts",
			"src/app/api/visits/route.ts",
		]);
	});

	it("produces the debate view model at exactly two call sites — no third reader", () => {
		// SPEC.2 §4.3's catalogue is closed at eleven and F-DEBATE-4 adds no
		// twelfth. A dedicated poll endpoint would necessarily surface here as a
		// third `loadDebateView(` call site.
		const callers = sourcesUnder("src")
			// The loader's own `export async function loadDebateView(` is the
			// definition, not a call site.
			.filter((file) => file !== LOADER)
			.filter((file) => /loadDebateView\s*\(/.test(code(file)));
		expect(callers).toEqual([EXPORT_ROUTE, PAGE]);
	});

	it("keeps loadDebateView's viewer-independent signature (ADR-0034 D-1)", () => {
		const source = code(LOADER);
		expect(source).toMatch(
			/export async function loadDebateView\(\s*client: DebateViewReader,\s*args: \{ market: MarketSummary \},\s*\): Promise<DebateViewModel>/,
		);
		// No session / viewer / userId parameter may be threaded into the masking
		// loader — the property that makes masking structurally viewer-independent
		// rather than merely tested to be.
		const signature =
			source.match(
				/export async function loadDebateView\([\s\S]*?\): Promise<DebateViewModel>/,
			)?.[0] ?? "";
		expect(signature).not.toMatch(/session|viewer|userId|user_id/i);
	});

	it("keeps masking single-sourced on loadRemovedSet (ADR-0034 D-4)", () => {
		// Exactly one definition repo-wide; every other masking consumer imports it.
		const definitions = sourcesUnder("src").filter((file) =>
			/export async function loadRemovedSet\b/.test(code(file)),
		);
		expect(definitions).toEqual([LOADER]);

		// The poll is never consulted as a masking input.
		expect(src(POLL)).not.toBeNull();
		expect(code(POLL)).not.toMatch(/loadRemovedSet|content_removed/);
	});
});

describe("debate-view::poll-stops-when-market-leaves-open", () => {
	it("takes its stop signal from market.status, threaded through the host", () => {
		const host = code(HOST);
		expect(host).toMatch(/const marketOpen = market\.status === "Open";/);
		expect(host).toMatch(/<DebatePoll[\s\S]*?marketOpen=\{marketOpen\}/);

		expect(src(POLL)).not.toBeNull();
		expect(code(POLL)).toMatch(/marketOpen/);
	});

	it("market.status reaches the client on the unchanged read model", () => {
		expect(code("src/server/markets/get-by-slug.ts")).toMatch(
			/status: MarketStatus;/,
		);
		expect(code(LOADER)).toMatch(
			/export type DebateMarketHeader = MarketSummary & \{/,
		);
	});

	it("carries NO notion of the global conclusion freeze (RULING D)", () => {
		// `system_state.frozen_at` reaches no client component, and
		// `FREEZE_INSTANT_UTC` compared against a client clock is a guess about a
		// database state flip, not a signal. The stop rule is scoped to
		// `market.status` alone — deliberately.
		expect(src(POLL)).not.toBeNull();
		expect(code(POLL)).not.toMatch(
			/FREEZE_INSTANT_UTC|isFrozen|frozenAt|frozen_at|systemState|system_state/,
		);
	});

	it("the polled route is explicitly dynamic, not dynamic by accident (RULING F)", () => {
		// The route was previously dynamic only as a side effect of calling
		// `headers()` for the session; a poll against an accidentally-static route
		// would serve a frozen payload indefinitely.
		expect(code(PAGE)).toMatch(/export const dynamic = "force-dynamic";/);
	});
});
