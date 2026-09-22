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
const SHARED_STORE = "src/server/debate-view/shared-view-store.ts";
const BLOCK_STORE = "src/server/cache/shared-block-store.ts";
const LOADER = "src/server/debate-view/load-debate-view.ts";
const PAGE = "src/app/(public)/m/[slug]/page.tsx";
const EXPORT_ROUTE = "src/app/(public)/m/[slug]/export/route.ts";
const IMAGE_ROUTE = "src/app/(public)/m/[slug]/export/image/route.ts";
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

	it("carries the directive and an EXPLICIT, CONSTANT-BOUND cacheLife", () => {
		const src = read(CACHED);
		expect(src).toContain('"use cache"');
		// Explicit at the call site — never left to inherit the default profile.
		// ⚠ THE NAMED `"minutes"` PROFILE IS GONE AS OF CACHE-KEY-1 (ADR-0051).
		// It was adequate while the KEY did the invalidating; now the clock is the
		// only thing bounding staleness, so the window is stated explicitly and
		// bound to `SHARED_VIEW_MIN_WINDOW_MS` rather than to a vendor profile
		// whose value could move under us.
		expect(src).toMatch(/cacheLife\(\s*\{/);
		expect(src).toContain("SHARED_VIEW_MIN_WINDOW_MS / 1000");
		expect(src).toContain("SHARED_VIEW_EXPIRE_SEC");
		// No naked seconds: the tune stays a one-line change at `limits.ts`.
		expect(src).not.toMatch(/cacheLife\(\s*\{[^}]*:\s*\d/);
		// Tagged per market, so `admin/moderation/act.ts`'s
		// `revalidateTag(`market:${id}`)` reaches it on content removal.
		expect(src).toMatch(/cacheTag\(\s*`market:\$\{market\.id\}`\s*\)/);
	});

	it("takes NO reserves, and still never fetches them itself", () => {
		// ⛔⛔ THE POLARITY OF THIS TEST IS REVERSED AT CACHE-KEY-1, AND THE OLD
		// VERSION IS WHY. It asserted `reserves: Reserves | null` in the signature
		// and explained that "the whole reserves-keying mechanism depends on
		// `reserves` being a value the CALLER observed live". The mechanism was
		// real and the guarantee it bought was real — and its price was that a
		// `'use cache'` key IS its argument list, so every bet moved the pool,
		// changed the key, and forced a full miss for every reader of that market.
		// A test enforcing that shape was holding the defect in place.
		//
		// Both halves are pinned now: the parameter is gone, and no pool read may
		// appear inside the body — which matters MORE than it did, because a read
		// inside the window would now be cached rather than merely mis-keyed.
		const src = read(CACHED);
		expect(src).not.toMatch(/reserves:\s*Reserves/);
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
		// CACHE-COALESCE-1 — the render now passes through the shared store on
		// its way to Upstash, so the store is part of the cached segment and is
		// scanned with it: an entry there is served to every reader of the market.
		const src = read(CACHED) + read(SHARED_STORE) + read(BLOCK_STORE);
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

	it("its only argument surface is the market", () => {
		// Belt to the scan above, from the other direction: the signature itself
		// admits exactly ONE input, and it is viewer-independent.
		//
		// ⚠ THIS IS A STRONGER GUARANTEE THAN IT WAS, not a weaker one. Two
		// arguments meant two things to argue about; one market id is the same
		// shape `getCachedReserveWalk` has, whose own contract test calls that
		// "the property holds by construction and not by review".
		const src = read(CACHED);
		const sig = src.slice(
			src.indexOf("export async function getCachedDebateView("),
			src.indexOf("): Promise<DebateViewModel>"),
		);
		expect(sig).toContain("market: MarketSummary");
		expect(sig.split(",").filter((p) => p.includes(":"))).toHaveLength(1);
	});
});

/**
 * CACHE-KEY-1 (ADR-0051) — THE POSTER'S OWN ARGUMENT.
 *
 * Removing `reserves` from the key removed something nobody had written down:
 * because every comment rides a bet (**INV-1**), posting moved the pool, busted
 * the author's own entry, and their `router.refresh()` came back carrying their
 * comment. Under a window it does not — and it fails SILENTLY, because
 * `DebateView`'s `landed` still fires on the freshly deserialized payload while
 * `findPostedNode` searches a model that lacks the comment and returns `null`.
 *
 * These pin the replacement: a bounded, signed-in-only, page-level bypass.
 */
describe("CACHE-KEY-1 — the poster bypass", () => {
	const FRESHNESS = "src/server/debate-view/viewer-freshness.ts";

	it("guard-is-alive", () => {
		expect(read(FRESHNESS)).toContain(
			"export async function loadViewerLatestCommentAt(",
		);
		expect(read(FRESHNESS)).toContain("export function postedWithinWindow(");
	});

	it("reads a timestamp and NEVER a body — SC-1 has nothing to mask here", () => {
		// CLAUDE.md §5.14 SC-1 fires on any PR that adds a read over `comments`.
		// This one selects `created_at` alone, so there is no body to withhold —
		// which is a stronger position than masking correctly, and is pinned so a
		// later "while we're here, return the comment too" is a red test rather
		// than a masking bypass on a brand-new read path.
		const src = read(FRESHNESS);
		expect(src).toContain("comments.createdAt");
		expect(src).not.toContain("comments.body");
		expect(src).not.toContain("deriveTitleTeaser");
	});

	it("the page bypasses the CACHE, never smuggles a viewer INTO it", () => {
		const src = read(PAGE);
		// The viewer-scoped read is on the page…
		expect(src).toContain("loadViewerLatestCommentAt(db, {");
		expect(src).toContain("postedWithinWindow(");
		// …and the branch picks between two functions rather than parameterising
		// one. ⛔ This is the whole reason the ⛔ block in `cached-view.ts` still
		// holds: the choice is made OUTSIDE the cached boundary.
		expect(src).toContain("? await loadDebateView(db, {");
		expect(src).toContain(": await getCachedDebateView(market)");
		// The cached call takes the market and nothing else.
		expect(src).not.toMatch(/getCachedDebateView\([^)]*reserves/);
	});

	it("the bypass passes the CACHED walk through, so history is not re-derived", () => {
		// Omitting `walk` makes `deriveMarketPriceChart` replay the reserve series
		// itself — three statements, on the one path taken by the person who is
		// already waiting. `getCachedReserveWalk` is keyed on the market id alone,
		// so it is unaffected by this branch and hits either way.
		expect(read(PAGE)).toMatch(
			/loadDebateView\(db,\s*\{\s*market,\s*walk:\s*await getCachedReserveWalk\(market\.id\),\s*\}\)/,
		);
	});

	it("the image-export route takes the SAME bypass", () => {
		// Otherwise an author who has just posted, and can SEE their card because
		// the page bypassed, gets a 404 downloading it: `resolvePostParam` resolves
		// the ordinal from the database, then `composePostExport` fails to find the
		// id in a cached model minted before the post existed.
		const src = read(IMAGE_ROUTE);
		expect(src).toContain("postedWithinWindow(");
		expect(src).toContain(": getCachedDebateView(market)");
	});

	it("the window is the shared constant, never a literal", () => {
		for (const rel of [PAGE, IMAGE_ROUTE]) {
			expect(read(rel)).toContain("SHARED_VIEW_MIN_WINDOW_MS");
		}
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
		// call.
		//
		// ⛔ IT IS NO LONGER THE CACHE KEY, AND THAT MAKES THE OVERRIDE BELOW
		// LOAD-BEARING RATHER THAN BELT-AND-BRACES. This assertion used to also
		// pin `getCachedDebateView(market, priced?.reserves ?? null)` and this
		// comment used to end "its `reserves` are what key the cache". At
		// CACHE-KEY-1 the key became the market plus a window, so cache-key
		// equality proves nothing about price any more — and the ONLY thing
		// keeping the rendered price fresh is the explicit assignment two
		// assertions down. ADR-0041 D-2 added that override so the guarantee would
		// not rest on reasoning nobody reading the file can see; this is the day
		// that foresight paid.
		expect(src).toContain("getMarketPricingAndReserves(db, market.id)");
		expect(src).toContain("getCachedDebateView(market)");
		// Gate C fix — the cached call's OWN internal pricing/unitToWin no
		// longer reach the render unexamined: the page explicitly overrides
		// them with the SAME live read that keyed the cache, so the guarantee
		// is an assignment at this call site, not an implication of the cache
		// key nobody reading this file can see (ADR-0041 D-2/D-6).
		expect(src).toContain("pricing: priced.pricing");
		expect(src).toContain("unitToWin: priced.unitToWin");
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
		// now, which on /m/[slug] also divides the 30s poll's cost.
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
		// Firer: the moderation action busts that exact namespace on removal —
		// via `updateTag`, not `revalidateTag` (Gate C fix, see the test below).
		expect(read(ACT)).toMatch(
			/updateTag\(\s*`market:\$\{comment\.marketId\}`\s*\)/,
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

	it("invalidation is immediate-expiration, never the non-evicting 'max' profile", () => {
		// Gate C CRITICAL fix. `revalidateTag(tag, "max")` does NOT evict — it
		// marks the tag stale with a 365-day expiry, and Next's shipped default
		// cache handler keeps serving the pre-invalidation entry (verified
		// directly against the installed next@16.3.2 handler: a "max"-profiled
		// call returns the stale entry on the next read; only `updateTag` or an
		// explicit `{ expire: 0 }` evicts). The prior version of this test
		// REQUIRED the literal "max" on a false premise — that omitting the
		// profile is a runtime error under Cache Components. It is not: Next
		// emits a deprecation warning and proceeds with the CORRECT immediate
		// expiration. That wrong premise is how the CRITICAL shipped: a test
		// enforcing the vulnerable form is worse than no test.
		//
		// `act.ts` is a Server Action ("use server", and `moderateComment` IS
		// the action), so `updateTag` — immediate expiration, no profile
		// argument, throws outside a Server Action — is legal and used there.
		// `open.ts`/`close.ts` are `server-only` engine functions, not
		// themselves Server Actions, shared with a Route Handler caller
		// (`api/cron/close-due-markets` calls `closeDueMarkets` directly) where
		// `updateTag` would throw — they use `revalidateTag(tag, { expire: 0 })`
		// instead, which hard-expires immediately from any calling context.
		const actSrc = read(ACT);
		expect(actSrc).toMatch(
			/updateTag\(\s*`market:\$\{comment\.marketId\}`\s*\)/,
		);
		expect(actSrc).not.toMatch(/revalidateTag\(/);

		for (const rel of [
			"src/server/markets/open.ts",
			"src/server/markets/close.ts",
		]) {
			const calls = read(rel).match(/revalidateTag\([^)]*\)/g) ?? [];
			expect(calls.length).toBeGreaterThan(0);
			for (const call of calls) {
				expect(call).not.toMatch(/["']max["']/);
				expect(call).toMatch(/\{\s*expire:\s*0\s*\}/);
			}
		}
	});
});
