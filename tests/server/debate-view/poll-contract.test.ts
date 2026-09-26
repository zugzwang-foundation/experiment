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
/**
 * POST-IMAGE-EXPORT / ADR-0050 — a new read endpoint under `/m/[slug]`, which
 * is precisely the shape the two censuses below exist to stop. Admitted here by
 * the conscious edit those censuses demand, not by widening them quietly.
 *
 * ⚠ THE QUESTION THIS GUARD ASKS IS ANSWERED, NOT SILENCED. Its subject is
 * whether a second endpoint forks the debate read and gives masking a second
 * place to diverge. This one does not: it reads through `getCachedDebateView`
 * — `cached-view.ts` wrapping the one loader — so the `loadDebateView` call-site
 * pin below is UNMOVED at two, and `loadRemovedSet` stays single-sourced. Those
 * two rows are the load-bearing half of this file and a route that needed them
 * relaxed would be a different decision entirely.
 */
const IMAGE_ROUTE = "src/app/(public)/m/[slug]/export/image/route.ts";
/**
 * F-DEBATE-4b / ADR-0053 — the poll's "has anything changed?" probe, and the
 * second endpoint admitted under `/m/[slug]` by the conscious edit these
 * censuses demand rather than by widening them quietly (the IMAGE_ROUTE
 * precedent, one row up).
 *
 * ⚠ THE QUESTION THESE GUARDS ASK IS ANSWERED, NOT SILENCED, and the answer is
 * shorter than ADR-0050's. Their subject is whether a second endpoint FORKS the
 * debate read and gives removal-masking a second place to diverge. This one
 * cannot, because **it carries no content at all**: it returns
 * `{"v": "<hash>"}` — a token over the market's status, its two pool reserves
 * and a moderation-action count. No body, no teaser, no author, no post id.
 * There is nothing in the response for masking to be wrong ABOUT (SC-1), and no
 * second copy of the view model reaches the client.
 *
 * ⛔ AND THE REFRESH PATH IS UNCHANGED, which is the half that actually matters.
 * A changed token still causes `router.refresh()` — the SAME re-invocation of
 * the SAME composed server read, with masking applied where it always was. The
 * probe decides only WHETHER to refresh, never WHAT the refresh returns. That is
 * why SPEC.2 §4.3's closed catalogue is narrowed to CONTENT-BEARING endpoints
 * rather than abandoned: an endpoint that cannot carry a body cannot fork a
 * masking decision.
 */
const VERSION_ROUTE = "src/app/(public)/m/[slug]/version/route.ts";
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

/**
 * POST-IMAGE-EXPORT / ADR-0050 — the one client transport in the READ tree that
 * is not a read of the polled payload.
 *
 * ⚠ NAMED AS ONE FILE, NOT FOLDED INTO THE REGEX ABOVE. A directory pattern
 * would quietly admit whatever lands beside it next; this admits exactly this
 * module, so a second transport in `src/components/debate` still reddens.
 *
 * Why it is not the fork this row exists to catch, in the terms the row cares
 * about — masking. It fetches a FINISHED JPEG from `/m/[slug]/export/image` and
 * hands the bytes to a download anchor: nothing from the response is parsed,
 * stored, or rendered, so there is no second copy of the view model on the
 * client and no second place for a removed body to surface. The masking
 * decision stays on the server, where the route performs its own
 * `getCachedDebateView` read and 404s a removed post BEFORE anything is
 * composed (SC-1; `tests/server/debate-export/image-route.test.ts`).
 *
 * And it is user-initiated — one click, disabled while in flight — which puts
 * it in the same category as `composer/` above: the poll never reaches it, so
 * it cannot make the 30s refresh diverge from the first paint.
 */
const EXPORT_DOWNLOAD = "src/components/debate/DownloadPostImage.tsx";

describe("debate-view::poll-preserves-removal-masking", () => {
	it("the poll module exists and refreshes by re-invoking the server read", () => {
		expect(src(POLL)).not.toBeNull();
		expect(code(POLL)).toMatch(/useRouter/);
		expect(code(POLL)).toMatch(/router\.refresh\(\)/);
	});

	it("the poll fetches the version probe and nothing else", () => {
		// ⛔ INVERTED BY ADR-0053, NOT RETIRED. This asserted the poll issued NO
		// client fetch at all, which was the cheapest encoding of "the read never
		// forks" while the poll's only move was `router.refresh()`. The poll now
		// asks a question first — but the protection is unchanged and is pinned
		// below: what it may fetch is the VERSION probe, which carries no content,
		// and never a payload it could render.
		expect(src(POLL)).not.toBeNull();
		const poll = code(POLL);

		// It does fetch, and the fetch is the version probe.
		expect(CLIENT_FETCH.test(poll)).toBe(true);
		expect(poll).toMatch(/\/version\b/);

		// ⛔ THE LOAD-BEARING HALF: the refresh path is untouched. A changed token
		// re-invokes the composed server read, where masking lives. Losing this
		// would mean the poll had started rendering its own payload — the fork
		// this file exists to prevent.
		expect(poll).toMatch(/router\.refresh\(\)/);

		// And it reaches NO other endpoint. Naming each one is deliberate: a
		// blanket "only one fetch(" count would pass a poll that swapped the probe
		// for a content read.
		for (const forbidden of [
			"/export",
			"/quote",
			"/api/bets",
			"/api/uploads",
		]) {
			expect(poll).not.toContain(forbidden);
		}
		// POSITIVE CONTROL — the scan must be able to see a path at all, or every
		// negative above passes against a file that fetches nothing.
		expect(poll).toContain("/version");
	});

	it("no module in the debate READ tree issues a client-side data fetch", () => {
		const offenders = sourcesUnder("src/components/debate")
			.filter((file) => !READ_TREE_EXCLUDES.test(file))
			.filter((file) => file !== EXPORT_DOWNLOAD)
			// ADR-0053 — the poll's version probe. NAMED AS ONE FILE for the same
			// reason `EXPORT_DOWNLOAD` is: a directory pattern would quietly admit
			// whatever lands beside it next. What the probe may fetch is pinned by
			// "the poll fetches the version probe and nothing else" above; this
			// line only keeps the census from double-reporting it.
			.filter((file) => file !== POLL)
			.filter((file) => CLIENT_FETCH.test(code(file)));
		expect(offenders).toEqual([]);
	});

	it("adds no read endpoint under /m/[slug] — exactly quote/, export/ and export/image/", () => {
		const routes = sourcesUnder("src/app/(public)/m/[slug]").filter((file) =>
			file.endsWith("/route.ts"),
		);
		expect(routes).toEqual([
			IMAGE_ROUTE,
			EXPORT_ROUTE,
			"src/app/(public)/m/[slug]/quote/route.ts",
			VERSION_ROUTE,
		]);
	});

	it("adds no Route Handler ANYWHERE — the repo-wide route.ts inventory is pinned", () => {
		// The tightest available encoding of "SPEC.2 §4.3's catalogue is closed at
		// eleven and F-DEBATE-4 adds no twelfth". A poll endpoint parked outside
		// `m/[slug]` — say `src/app/api/debate/[id]/route.ts` — is invisible to the
		// subtree check above but cannot hide from this one. A future handler is
		// not forbidden; it must be a conscious edit here.
		// (On-disk 14 vs the §4.3 table's eleven rows is mostly PRE-EXISTING drift,
		// not this task's: `api/visits`, `api/cron/alarms-drain` and
		// `m/[slug]/quote` are built but uncatalogued, and `api/dataset/manifest`
		// is catalogued but pending-build. Surfaced, deliberately not corrected
		// here. The fourteenth — `m/[slug]/export/image` — is NOT drift: it is
		// ADR-0050's route, added to this list on purpose; see IMAGE_ROUTE above
		// for why it does not disturb the call-site pin below.)
		const routes = sourcesUnder("src/app").filter((file) =>
			file.endsWith("/route.ts"),
		);
		expect(routes).toEqual([
			"src/app/(admin)/admin/markets/media/sign/route.ts",
			IMAGE_ROUTE,
			EXPORT_ROUTE,
			"src/app/(public)/m/[slug]/quote/route.ts",
			VERSION_ROUTE,
			"src/app/api/_smoke-error/route.ts",
			"src/app/api/auth/[...all]/route.ts",
			"src/app/api/bets/place/route.ts",
			"src/app/api/bets/sell/route.ts",
			"src/app/api/cron/alarms-drain/route.ts",
			"src/app/api/cron/close-due-markets/route.ts",
			"src/app/api/cron/r2-orphan-sweep/route.ts",
			"src/app/api/health/route.ts",
			// AWS-MIGRATION-3 / ADR-0060 — the target-group readiness gate. Returns
			// warm-up counts only; reads no argument text (SC-1 not engaged).
			"src/app/api/ready/route.ts",
			"src/app/api/uploads/sign/route.ts",
			"src/app/api/visits/route.ts",
		]);
	});

	it("produces the debate view model at exactly four call sites — no fifth reader", () => {
		// SPEC.2 §4.3's catalogue is closed at eleven and F-DEBATE-4 adds no
		// twelfth. A dedicated poll endpoint would necessarily surface here as an
		// extra `loadDebateView(` call site.
		//
		// ⚠ THE SECOND ENTRY MOVED AT S-4 PHASE D, and the count did not. The
		// page stopped calling `loadDebateView` itself and called
		// `getCachedDebateView` (`debate-view/cached-view.ts`) instead, which is
		// the one carrying `'use cache'`.
		//
		// ⚠⚠ THE COUNT MOVED AT CACHE-KEY-1 (ADR-0051), 2 → 4, AND THE PROPERTY
		// THIS GUARD PROTECTS DID NOT. Removing `reserves` from the cache key took
		// with it something nobody had written down: because every comment rides a
		// bet (**INV-1**), a poster's own post used to bust their own entry, so
		// their refresh carried it back. A clock has no such side effect, so both
		// participant surfaces now read UNCACHED for a viewer who posted inside
		// the last window (`viewer-freshness.ts`). That is two more callers —
		// `page.tsx` and the image route — and they are the SAME
		// `loadDebateView`, with `loadRemovedSet` applied inside it.
		//
		// ⛔ SO: FOUR READERS, STILL ONE MASKING IMPLEMENTATION, STILL NO PATH
		// THAT COULD FORK `loadRemovedSet`. That last clause is what this test is
		// actually for, and it is why a fourth CALLER is not a fourth READER in
		// the sense that matters. The entry is edited here, in the same commit as
		// the change, rather than the assertion being loosened — a `toEqual` on an
		// explicit list is what makes a genuine new path impossible to add
		// silently, and relaxing it to a length check would give that up.
		const callers = sourcesUnder("src")
			// The loader's own `export async function loadDebateView(` is the
			// definition, not a call site.
			.filter((file) => file !== LOADER)
			.filter((file) => /loadDebateView\s*\(/.test(code(file)));
		// Directory order, not importance order — `sourcesUnder` sorts, and
		// `export/image/route.ts` sorts before `export/route.ts`.
		expect(callers).toEqual([IMAGE_ROUTE, EXPORT_ROUTE, PAGE, CACHED_VIEW]);
	});

	it("the page reaches the model by exactly ONE of its two routes per render", () => {
		// The other half of the move above. Before CACHE-KEY-1 this asserted the
		// page never mentioned `loadDebateView` at all, because calling both would
		// issue the shared reads TWICE — once cached, once not — and the uncached
		// copy would quietly become the one rendered. That risk is unchanged; what
		// changed is that the page now legitimately names both.
		//
		// ⛔ MUTUAL EXCLUSION IS WHAT REPLACES ABSENCE, and a source scan can
		// assert it only by pinning the SHAPE: the two calls must be the two arms
		// of one conditional expression, not two statements. Two independent
		// `await`s would satisfy any weaker check while doubling every read on the
		// surface this task exists to make cheaper.
		for (const rel of [PAGE, IMAGE_ROUTE]) {
			const src = code(rel);
			expect(src).toContain("getCachedDebateView(");
			// Exactly one mention of each, so neither can appear a second time
			// outside the ternary.
			expect(src.match(/loadDebateView\s*\(/g)).toHaveLength(1);
			expect(src.match(/getCachedDebateView\s*\(/g)).toHaveLength(1);
			// …and they really are the two arms of one conditional.
			expect(src.replace(/\s+/g, " ")).toMatch(
				/readsUncached \?[^:]*loadDebateView\(db, \{ market, walk: await getCachedReserveWalk\(market\.id\), \}\) : (await )?getCachedDebateView\(market\)/,
			);
		}
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
// is re-invoked twice a minute per open, active tab turns "one spurious write
// per navigation" into "two per minute", and turns a sliding session re-issue into
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
