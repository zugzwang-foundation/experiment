import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * S-4 PHASE D — the cache-boundary contract for `/m/[slug]`.
 *
 * STATIC BY NECESSITY, not by preference. `'use cache'` only caches inside the
 * Next.js server runtime: under a bare `vitest run` the directive is inert, so
 * no Vitest test can observe a real hit or miss. This repo has no Playwright
 * (AGENTS.md §9), so a runtime cold/warm test is not reachable at all. What IS
 * reachable — and what actually protects the invariants — is proving the
 * boundary is DRAWN in the right place: which module carries the directive,
 * what may cross into it, and what must never. That is this file.
 *
 * Reads source as TEXT via `node:fs` and never imports the modules — the
 * `poll-contract.test.ts` pattern, so it touches no database and no runtime.
 */

const ROOT = process.cwd();
const readRaw = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

/**
 * Source with COMMENTS REMOVED — and this is load-bearing, not tidiness.
 *
 * Every negative assertion in this file ("the cached module must not mention
 * `loadViewerMarketContext`") is a claim about CODE. Scanning raw source
 * conflates code with prose, and the modules under test are heavily commented
 * precisely BECAUSE these boundaries matter — `cached-view.ts`'s docblock
 * spells out every viewer route it must never touch, and `page.tsx`'s explains
 * that it carries no `'use cache'`. Against raw text those explanations read as
 * violations: the first run of this file went red on all four negative
 * assertions, every one of them a false positive on a comment.
 *
 * ⚠ The failure mode this prevents is the WORSE direction too. Had the fix been
 * "delete the sentences that trip the scan," the guards would have gone green
 * by deleting the documentation that explains why they exist — a test shaping
 * the code around its own defect.
 *
 * Approximate by design: whole-line `//`, trailing `//` not preceded by `:`
 * (so `https://` survives), and `/* … *\/` blocks. Good enough for these files;
 * the `strips-comments-but-keeps-code` control below is what keeps it honest.
 */
function codeOnly(source: string): string {
	return source
		.replace(/\/\*[\s\S]*?\*\//g, "")
		.replace(/^\s*\/\/.*$/gm, "")
		.replace(/([^:])\/\/.*$/gm, "$1");
}

const read = (rel: string) => codeOnly(readRaw(rel));

const CACHED = "src/server/debate-view/cached-view.ts";
const LOADER = "src/server/debate-view/load-debate-view.ts";
const PAGE = "src/app/(public)/m/[slug]/page.tsx";
const EXPORT_ROUTE = "src/app/(public)/m/[slug]/export/route.ts";
const SESSION = "src/app/(public)/_lib/session.ts";

describe("Phase D — the comment stripper itself", () => {
	/**
	 * V-2: a negative assertion needs a positive control. Every "must not
	 * contain" below runs against `codeOnly()` output — so a stripper that
	 * returned "" would make all of them pass while proving nothing. These two
	 * pin both directions: comments really are removed, code really survives.
	 */
	it("strips-comments-but-keeps-code", () => {
		const sample = [
			"// loadViewerMarketContext in a line comment",
			"/** loadViewerMarketContext in a block comment */",
			"const url = 'https://example.com/x'; // trailing loadViewerMarketContext",
			"const real = loadViewerMarketContext(db, args);",
		].join("\n");

		const stripped = codeOnly(sample);
		// All three commented mentions are gone…
		expect(stripped.match(/loadViewerMarketContext/g)).toHaveLength(1);
		// …the real call survives, and a URL's `//` was not mistaken for one.
		expect(stripped).toContain(
			"const real = loadViewerMarketContext(db, args);",
		);
		expect(stripped).toContain("https://example.com/x");
	});

	it("does not silently return empty for a real source file", () => {
		// The specific way a broken stripper would fake a green suite.
		expect(read(CACHED).trim().length).toBeGreaterThan(100);
		expect(read(PAGE).trim().length).toBeGreaterThan(100);
	});
});

describe("Phase D — the cached debate block", () => {
	it("guard-is-alive", () => {
		// Every negative assertion below would pass vacuously against a missing
		// or renamed file. Prove the subjects exist and are the right shape first.
		expect(read(CACHED)).toContain(
			"export async function getCachedDebateView(",
		);
		expect(read(PAGE)).toContain("getCachedDebateView(");
		expect(read(SESSION)).toContain("export const getRequestSession");
	});

	it("carries the directive and an EXPLICIT cacheLife", () => {
		const src = read(CACHED);
		expect(src).toContain('"use cache"');
		// Explicit at the call site — never left to inherit the default profile.
		expect(src).toMatch(/cacheLife\(\s*["']minutes["']\s*\)/);
		// Tagged per market, so `admin/moderation/act.ts`'s
		// `revalidateTag(`market:${id}`)` reaches it on content removal.
		expect(src).toMatch(/cacheTag\(\s*`market:\$\{market\.id\}`\s*\)/);
	});

	it("takes reserves as a PARAMETER and never fetches them itself", () => {
		// The whole reserves-keying mechanism depends on `reserves` being a value
		// the CALLER observed live this request. A function that re-read reserves
		// internally would let a stale value hide behind a cache key the caller
		// never actually saw — the key would look fresh while the data was not.
		const src = read(CACHED);
		expect(src).toMatch(/reserves:\s*Reserves\s*\|\s*null/);
		expect(src).not.toContain("getMarketPricingAndReserves");
		expect(src).not.toContain("getMarketPricingAndUnitToWin");
	});

	/**
	 * THE SELF-CHECK'S "positive finding, not a bare assertion" ITEM.
	 *
	 * A cached segment's output is handed verbatim to every reader of that
	 * market. If any viewer-scoped input could reach it, one participant's
	 * balance, position or bookmark set would serialize into the next
	 * participant's page. This scans the cached module's ENTIRE source for every
	 * route by which viewer state enters this codebase and reports their absence
	 * as a measured result.
	 */
	it("no viewer-scoped input can reach the cached segment", () => {
		const src = read(CACHED);
		const viewerRoutes = [
			"loadViewerMarketContext", // the viewer context read itself
			"getRequestSession", // the deduped session helper
			"auth.api.getSession", // a direct session read
			"@/server/auth", // any import of the auth surface
			"next/headers", // headers() / cookies()
			"cookies(",
			"headers(",
			"userId", // a viewer id threaded in by any other name
			"viewerId",
			"session",
		];
		const found = viewerRoutes.filter((needle) => src.includes(needle));
		// Reported as a set, not a bare boolean: a failure names exactly which
		// viewer route appeared, rather than just going red.
		expect(found).toEqual([]);
	});

	it("its only argument surface is the market and its reserves", () => {
		// Belt to the scan above, from the other direction: the signature itself
		// admits exactly two inputs, both viewer-independent.
		const src = read(CACHED);
		const sig = src.slice(
			src.indexOf("export async function getCachedDebateView("),
			src.indexOf("): Promise<DebateViewModel>"),
		);
		expect(sig).toContain("market: MarketSummary");
		expect(sig).toContain("reserves: Reserves | null");
	});
});

describe("Phase D — ADR-0025: the .md export must stay uncached", () => {
	it("load-debate-view.ts carries NO cache directive", () => {
		// The export route calls `loadDebateView` DIRECTLY. ADR-0025: "a cache is
		// a window in which just-removed content could keep serving." A
		// `'use cache'` on the loader would hand the export a cache it is
		// contractually forbidden from having — with no build error and no type
		// error to catch it. This assertion is the only thing standing between
		// that mistake and a masking leak, which is why the caching lives in a
		// separate wrapper file at all.
		expect(read(LOADER)).not.toMatch(/["']use cache["']/);
	});

	it("the export route reaches the loader directly, never the cached wrapper", () => {
		const src = read(EXPORT_ROUTE);
		expect(src).toContain("loadDebateView(db, { market })");
		expect(src).not.toContain("getCachedDebateView");
	});
});

describe("Phase D — the page keeps price live", () => {
	it("pricing comes from the live read, and the page itself is uncached", () => {
		const src = read(PAGE);
		// The live pool read happens on the page, per request, before the cached
		// call — its `reserves` are what key the cache.
		expect(src).toContain("getMarketPricingAndReserves(db, market.id)");
		expect(src).toContain(
			"getCachedDebateView(market, priced?.reserves ?? null)",
		);
		// The page file itself must never be cached: `DebatePoll` re-invokes it
		// every 15s and a cached page would serve a frozen payload forever
		// (F-DEBATE-4 RULING F).
		expect(src).not.toMatch(/["']use cache["']/);
	});

	it("viewer context is composed on the page, outside the cached block", () => {
		const src = read(PAGE);
		expect(src).toContain("loadViewerMarketContext(db, {");
		// And it is gated on a real session rather than computed unconditionally.
		expect(src).toContain("session?.user?.id");
	});
});

describe("Phase D — session dedupe", () => {
	it("the helper memoizes per request and lives OUTSIDE src/server/auth", () => {
		const src = read(SESSION);
		// React's cache() — request-scoped memoization, not a cross-request cache.
		expect(src).toContain('from "react"');
		expect(src).toContain("cache(");
		expect(src).toContain("auth.api.getSession");
		// Server-only: this must never be pulled into a client bundle.
		expect(src).toContain('import "server-only"');
	});

	it("all three (public) RSC call sites go through the helper", () => {
		// The layout plus the two surfaces that previously read the session a
		// SECOND time (layouts cannot pass data to pages). One read per render
		// now, which on /m/[slug] also divides the 15s poll's cost.
		for (const rel of [
			"src/app/(public)/layout.tsx",
			"src/app/(public)/m/[slug]/page.tsx",
			"src/app/(public)/u/[pseudonym]/page.tsx",
		]) {
			const src = read(rel);
			expect(src).toContain("getRequestSession");
			// The direct read is gone from every one of them.
			expect(src).not.toContain("auth.api.getSession");
		}
	});

	it("route handlers and server actions are deliberately NOT rewired", () => {
		// Each is one-shot per request, so there is no second read to dedupe, and
		// several sit outside this task's fence. Pinned so a later "consistency"
		// sweep is a deliberate decision rather than an accident.
		for (const rel of [
			"src/app/(public)/m/[slug]/quote/route.ts",
			"src/server/bets/endpoint.ts",
		]) {
			expect(read(rel)).toContain("auth.api.getSession");
		}
	});
});

/**
 * THE TAG HANDSHAKE.
 *
 * Cache invalidation is the one part of this design that fails SILENTLY. If the
 * string `cacheTag()` writes and the string `revalidateTag()` fires ever drift
 * apart — a rename, a prefix change, a stray space — nothing errors, no test
 * that mocks either side notices, and a removed comment simply keeps serving
 * from cache until the `cacheLife` window expires. On a moderation path that is
 * a content-safety failure, not a staleness annoyance.
 *
 * These assertions read BOTH files and pin the shared shape, so the two ends
 * cannot drift independently.
 *
 * ⚠ WHAT THIS DOES NOT DO, stated plainly: it does not prove `revalidateTag`
 * FIRES. Doing that end-to-end needs either an authenticated admin session or a
 * fabricated `content_removed` row in `mod_actions` — a Bucket-A APPEND-ONLY
 * table on shared staging, where a test row could never be cleaned up. Neither
 * was done. The Phase D self-check item "revalidateTag demonstrably fires on
 * removal" is therefore reported UNPROVEN, not ticked.
 */
describe("Phase D — the cacheTag / revalidateTag handshake", () => {
	const ACT = "src/server/admin/moderation/act.ts";

	it("removal fires the same `market:<id>` tag the cached view writes", () => {
		// Writer: the cached debate view tags itself per market.
		expect(read(CACHED)).toMatch(/cacheTag\(\s*`market:\$\{market\.id\}`\s*\)/);
		// Firer: the moderation action busts that exact namespace on removal.
		expect(read(ACT)).toMatch(
			/revalidateTag\(\s*`market:\$\{comment\.marketId\}`/,
		);
	});

	it("removal invalidates, but a BAN deliberately does not", () => {
		// ADR-0021: a ban removes voice, not content — a banned author's prior
		// posts stay visible, so nothing Discovery or the debate view renders
		// changes and there is nothing to invalidate. Pinned because "invalidate
		// on any moderation action" is the tempting, wrong generalisation.
		const src = read(ACT);
		expect(src).toMatch(/if\s*\(\s*action === "remove"\s*\)/);
	});

	it("revalidateTag passes a cache profile (required since Next 16.3)", () => {
		// Without the second argument the call is a runtime error under Cache
		// Components — and it is the kind that only surfaces on the moderation
		// path, i.e. rarely, and in the worst place.
		for (const rel of [
			ACT,
			"src/server/markets/open.ts",
			"src/server/markets/close.ts",
		]) {
			const calls = read(rel).match(/revalidateTag\([^)]*\)/g) ?? [];
			expect(calls.length).toBeGreaterThan(0);
			for (const call of calls) {
				expect(call).toMatch(/,\s*["']max["']\s*\)$/);
			}
		}
	});
});
