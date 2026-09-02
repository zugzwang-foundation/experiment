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

/** The top-level parameter NAMES of a matched function signature, in order —
 * `["client", "args"]`. Splits only at depth 0, so an object type's own fields
 * never leak in as parameters. */
function paramNames(signature: string): string[] {
	const inner = signature.slice(
		signature.indexOf("(") + 1,
		signature.lastIndexOf(")"),
	);
	const out: string[] = [];
	let depth = 0;
	let current = "";
	for (const ch of inner) {
		if ("{[(<".includes(ch)) depth++;
		else if ("}])>".includes(ch)) depth--;
		if (ch === "," && depth === 0) {
			out.push(current);
			current = "";
			continue;
		}
		current += ch;
	}
	out.push(current);
	return out
		.map((p) => p.trim().split(":")[0]?.trim() ?? "")
		.filter((p) => p.length > 0);
}

/** The field names declared on the `args: { … }` object of a matched signature,
 * in order — `["market", "walk"]`. Depth-aware for the same reason as above, so
 * a nested type's fields are not mistaken for `args`' own. */
function argsFields(signature: string): string[] {
	const start = signature.indexOf("args: {");
	if (start === -1) return [];
	const body = signature.slice(start + "args: {".length);
	const out: string[] = [];
	let depth = 0;
	let current = "";
	for (const ch of body) {
		if ("{[(<".includes(ch)) depth++;
		else if ("}])>".includes(ch)) {
			if (depth === 0) break;
			depth--;
		}
		if (ch === ";" && depth === 0) {
			out.push(current);
			current = "";
			continue;
		}
		current += ch;
	}
	out.push(current);
	return out
		.map((f) => f.trim().split(/[?:]/)[0]?.trim() ?? "")
		.filter((f) => f.length > 0 && /^[A-Za-z_$][\w$]*$/.test(f));
}

const POLL = "src/components/debate/DebatePoll.tsx";
const HOST = "src/components/debate/DebateView.tsx";
const LOADER = "src/server/debate-view/load-debate-view.ts";
const PAGE = "src/app/(public)/m/[slug]/page.tsx";
const EXPORT_ROUTE = "src/app/(public)/m/[slug]/export/route.ts";
/** S-4 Phase D — the page's `'use cache'` wrapper around the loader. */
const CACHED_VIEW = "src/server/debate-view/cached-view.ts";

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
		//
		// ⚠ THE SECOND ENTRY MOVED AT S-4 PHASE D, and the count did not. The
		// page no longer calls `loadDebateView` itself: it calls
		// `getCachedDebateView` (`debate-view/cached-view.ts`), which is the one
		// carrying `'use cache'`. So the two callers are now the export route
		// (DIRECT and uncached — ADR-0025 forbids caching the `.md` export) and
		// the cached wrapper (the page's path).
		//
		// ⛔ WHAT THIS GUARD PROTECTS IS UNCHANGED: still exactly two readers,
		// still ONE masking implementation, still no third path that could fork
		// `loadRemovedSet`. The entry is edited here, in the same commit as the
		// change, rather than the assertion being loosened — a `toEqual` on an
		// explicit list is what makes a genuine third reader impossible to add
		// silently, and relaxing it to a length check would give that up.
		const callers = sourcesUnder("src")
			// The loader's own `export async function loadDebateView(` is the
			// definition, not a call site.
			.filter((file) => file !== LOADER)
			.filter((file) => /loadDebateView\s*\(/.test(code(file)));
		expect(callers).toEqual([EXPORT_ROUTE, CACHED_VIEW]);
	});

	it("the cached wrapper is the page's ONLY route to the debate model", () => {
		// The other half of the move above: the page must reach the model through
		// the cached wrapper and never around it. A page that called both would
		// issue the shared reads twice — once cached, once not — and the uncached
		// copy would quietly become the one rendered.
		const page = code(PAGE);
		expect(page).toContain("getCachedDebateView(");
		expect(page).not.toMatch(/loadDebateView\s*\(/);
	});

	it("keeps loadDebateView's viewer-independent signature (ADR-0034 D-1)", () => {
		const source = code(LOADER);
		const signature =
			source.match(
				/export async function loadDebateView\([\s\S]*?\): Promise<DebateViewModel>/,
			)?.[0] ?? "";
		expect(signature).not.toBe("");

		// ⚠ THE SIGNATURE GAINED ONE PARAMETER AT CHART-1, and this assertion is
		// edited here in the same commit rather than deleted — the same posture
		// the two-callers guard above records for its own edit. `args` now carries
		// an OPTIONAL `walk`: an already-derived CPMM reserve walk for the price
		// chart, so the market-detail read can skip a three-statement replay it
		// has already paid for behind `getCachedReserveWalk`.
		//
		// ⛔ IT IS NOT VIEWER STATE, AND THE ASSERTION BELOW IS WHAT PROVES THAT
		// RATHER THAN THIS COMMENT. A walk is pool reserves and event timestamps
		// for one market — public, market-scoped, identical for every reader. What
		// ADR-0034 D-1 forbids is threading a session/user identity into the
		// masking loader, and that remains forbidden and mechanically checked.
		const params = paramNames(signature);
		expect(params).toEqual(["client", "args"]);
		expect(argsFields(signature)).toEqual(["market", "walk"]);

		// No session / viewer / userId parameter may be threaded into the masking
		// loader — the property that makes masking structurally viewer-independent
		// rather than merely tested to be.
		//
		// ⚠ THE SCAN IS ALREADY COMMENT-FREE, and that is load-bearing rather than
		// incidental: `code()` strips comments before this file sees a byte, for
		// exactly the reason its own helper docblock gives — the prose explaining
		// why a parameter is NOT viewer-scoped necessarily contains the word
		// "viewer", and a guard that reddens on its own explanation is a guard
		// that gets suppressed. So the ban below applies to declarations, and the
		// new `walk` parameter can be documented at length without touching it.
		expect(signature).not.toMatch(/session|viewer|userId|user_id/i);

		// POSITIVE CONTROL — the ban above must be able to FIRE. A negative
		// assertion over a stripped string proves nothing unless the stripping
		// left something a violation could still be found in. Inject the exact
		// shape of the violation into the same text and require a match; if the
		// comment-stripping upstream ever over-reached and left the signature
		// empty, this line reddens instead of the guard passing vacuously.
		expect(signature.replace("args: {", "args: { userId: string;")).toMatch(
			/session|viewer|userId|user_id/i,
		);
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

// ── What the poll makes LOAD-BEARING (@security-auditor L-5, L-2) ───────────
// Neither property is new, and neither is this task's to own. Both are pinned
// here because the poll multiplies the cost of breaking them: a read path that
// is re-invoked four times a minute per open tab turns "one spurious write per
// navigation" into "four per minute", and turns a sliding session re-issue into
// an indefinitely self-renewing cookie for as long as a tab stays open.
describe("F-DEBATE-4 — properties the poll now depends on", () => {
	it("the polled read path performs NO write (INV-2-adjacent)", () => {
		// `viewer-context.ts:22-30` already documents the specific hazard: the
		// tempting reuse would turn every page load by an unpaid-today user into a
		// Daily-Credit mint without a commented bet — attendance becoming issuance,
		// ADR-0018's rejected Option 4. At 4x/min that is not a slow leak.
		const readPath = [
			LOADER,
			"src/server/debate-view/viewer-context.ts",
			"src/server/debate-view/price-chart.ts",
			"src/server/debate-view/resolve-authors.ts",
			"src/server/debate-view/resolve-post-param.ts",
			"src/server/markets/get-by-slug.ts",
		];
		const writers = readPath.filter((file) =>
			/\.(insert|update|delete)\s*\(/.test(code(file)),
		);
		expect(writers).toEqual([]);
	});

	it("session reads stay pure — `disableSessionRefresh` is on", () => {
		// Two `auth.api.getSession()` calls fire per tick (the refresh re-executes
		// the LAYOUT as well as the page), so 8/min per open tab. With this flag
		// true and no cookie cache, each is a pure read: no `sessions` UPDATE and
		// no `Set-Cookie`. Flip it to false and every open tab becomes a session
		// that never expires while the tab lives.
		expect(code("src/server/auth/index.ts")).toMatch(
			/disableSessionRefresh:\s*true/,
		);
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

	it("the polled route is not cached, not dynamic by accident (RULING F)", () => {
		// Originally pinned via `export const dynamic = "force-dynamic";`. S-4
		// Phase B enabled `cacheComponents`, under which that export is
		// redundant and build-breaking — every route is dynamic by default
		// unless it opts INTO caching with `'use cache'`. RULING F's guarantee
		// now inverts to the same effect: this file must carry no `'use cache'`
		// directive, so nothing can make the poll start serving a frozen
		// payload. (The S-4 Phase C/D retrofit caches an EXTRACTED child
		// component, never this page file itself — see the cache-boundary note
		// in `docs/scale/S4-WORK-PACK.md` §2.4 / the Phase A audit's T5.)
		expect(code(PAGE)).not.toMatch(/["']use cache["']/);
	});
});
