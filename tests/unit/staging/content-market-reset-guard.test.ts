import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
	assessContentMarkets,
	CONTENT_MARKET_OVERRIDE_ENV,
	CONTENT_MARKET_OVERRIDE_VALUE,
	contentMarketSlugs,
	FIXTURE_SLUG_PREFIXES,
	isFixtureSlug,
} from "../../staging/_lib/content-guard";

// ═══════════════════════════════════════════════════════════════════════════
// LIQ-1-RESTORE C2 — the reset refuses to destroy a market it did not create.
//
// The predicate is pure and takes the slug list as an argument, so the whole
// decision is exercised here against a MOCKED `markets` table — a plain array
// of slugs — with no database and no global mutation. That is the same shape
// `reset-guard.test.ts` uses for `resolveStagingTarget`, and it is why the
// guard was written to take rows rather than to read them.
// ═══════════════════════════════════════════════════════════════════════════

/** The mocked `markets` table: exactly what `SELECT slug FROM markets` returns. */
const FIXTURE_MARKETS = [
	"sp-m1-draft",
	"sp-m2-active",
	"sp-m5-closed",
	"sp-m16-fill",
];

/** Two of the content markets the 2026-09-07 reset actually destroyed. */
const CONTENT_MARKETS = ["chess-fide-tiebreak-response", "bitcoin-price-50k"];

describe("the fixture-prefix predicate", () => {
	it("claims every fixture family and nothing else", () => {
		// POSITIVE AND NEGATIVE CONTROL for the matcher every case below rests
		// on. A predicate that silently stopped matching would make the whole
		// suite green while asserting nothing about the slugs that matter.
		for (const slug of FIXTURE_MARKETS) {
			expect({ slug, fixture: isFixtureSlug(slug) }).toEqual({
				slug,
				fixture: true,
			});
		}
		for (const slug of CONTENT_MARKETS) {
			expect({ slug, fixture: isFixtureSlug(slug) }).toEqual({
				slug,
				fixture: false,
			});
		}
	});

	it("names both prefixes the kickoff's predicate names", () => {
		expect([...FIXTURE_SLUG_PREFIXES]).toEqual(["sp-m", "volume-fixture-"]);
	});

	it("returns the unclaimed slugs in input order", () => {
		expect(
			contentMarketSlugs([
				"sp-m1-draft",
				"bitcoin-price-50k",
				"sp-m2-active",
				"chess-fide-tiebreak-response",
			]),
		).toEqual(["bitcoin-price-50k", "chess-fide-tiebreak-response"]);
	});
});

describe("the reset's verdict", () => {
	it("PROCEEDS when the table holds only fixtures", () => {
		const verdict = assessContentMarkets({
			slugs: FIXTURE_MARKETS,
			override: undefined,
		});
		expect(verdict).toEqual({ ok: true, overridden: false, found: [] });
	});

	it("PROCEEDS on an empty table", () => {
		// The state immediately after a previous reset. Nothing to protect.
		expect(assessContentMarkets({ slugs: [], override: undefined })).toEqual({
			ok: true,
			overridden: false,
			found: [],
		});
	});

	it("REFUSES on a single content market, and names it", () => {
		const verdict = assessContentMarkets({
			slugs: [...FIXTURE_MARKETS, "bitcoin-price-50k"],
			override: undefined,
		});
		expect(verdict.ok).toBe(false);
		expect(verdict.found).toEqual(["bitcoin-price-50k"]);
		if (verdict.ok) throw new Error("unreachable — narrowing");
		// The refusal must SAY WHICH. A reset that refuses without naming the
		// row leaves the operator guessing, and guessing ends in the override.
		expect(verdict.reason).toContain("bitcoin-price-50k");
		expect(verdict.reason).toContain(CONTENT_MARKET_OVERRIDE_ENV);
		expect(verdict.reason).toContain("scripts/seed-content-markets.ts");
	});

	it("REFUSES on the whole slate and lists every one", () => {
		// ⚠ D-50 re-slugged two of these. The predicate under test is
		// slug-AGNOSTIC — it claims a fixture PREFIX and calls everything else
		// content — so this list is a fixture rather than a dependency and the
		// test would have stayed green with the old names. Re-keyed anyway,
		// because the assertion below is that a refusal NAMES the whole slate,
		// and a slate naming two markets that no longer exist is not the slate.
		const slate = [
			"chess-fide-tiebreak-response",
			"bitcoin-price-50k",
			"math-erdos-solved-on-zugzwang",
			"claude-bundle-response",
			"yc-w27-acceptance",
			"github-zugzwang-repo-stars",
		];
		const verdict = assessContentMarkets({
			slugs: [...FIXTURE_MARKETS, ...slate],
			override: undefined,
		});
		expect(verdict.ok).toBe(false);
		expect(verdict.found).toEqual(slate);
		if (verdict.ok) throw new Error("unreachable — narrowing");
		for (const slug of slate) expect(verdict.reason).toContain(slug);
	});

	it("PROCEEDS with the acknowledgement token, and marks the run overridden", () => {
		const verdict = assessContentMarkets({
			slugs: [...FIXTURE_MARKETS, ...CONTENT_MARKETS],
			override: CONTENT_MARKET_OVERRIDE_VALUE,
		});
		expect(verdict).toEqual({
			ok: true,
			overridden: true,
			found: CONTENT_MARKETS,
		});
	});

	it("FAILS CLOSED on any value that is not the exact token", () => {
		// A typo'd acknowledgement is not an acknowledgement, and neither is a
		// boolean-shaped one — `=1` and `=true` are what arrives by accident
		// from a stale export or a copied CI line.
		for (const override of ["1", "true", "yes", "", "include-content-market"]) {
			const verdict = assessContentMarkets({
				slugs: [...FIXTURE_MARKETS, ...CONTENT_MARKETS],
				override,
			});
			expect({ override, ok: verdict.ok }).toEqual({ override, ok: false });
		}
	});

	it("does not let the override manufacture a refusal-free run on fixtures", () => {
		// The override is a permission, not a mode: with nothing to protect it
		// must report `overridden: false`, so the reset's warning line only ever
		// fires when something is genuinely being destroyed.
		expect(
			assessContentMarkets({
				slugs: FIXTURE_MARKETS,
				override: CONTENT_MARKET_OVERRIDE_VALUE,
			}),
		).toEqual({ ok: true, overridden: false, found: [] });
	});
});

describe("the reset runner actually consults it", () => {
	// A pure predicate nobody calls is a comment. This is the wiring assertion:
	// the same shape `runner-gating.test.ts` uses to prove a guard is reached
	// rather than merely present.
	const RESET = fileURLToPath(
		new URL("../../staging/reset.staging.test.ts", import.meta.url),
	);
	const body = readFileSync(RESET, "utf8");

	it("calls the predicate and throws on its refusal", () => {
		expect(body).toContain("assessContentMarkets(");
		expect(body).toContain("SELECT slug FROM markets");
		expect(body).toMatch(/if \(!verdict\.ok\)[\s\S]{0,80}throw new Error/);
	});

	it("consults it BEFORE the destructive batch", () => {
		// `runGuardedReset` is the wipe. The verdict must be read above it, in
		// the pre-flight, where a throw aborts the suite without executing it.
		const verdictAt = body.indexOf("assessContentMarkets(");
		const resetAt = body.indexOf("await runGuardedReset(");
		expect(verdictAt).toBeGreaterThan(-1);
		expect(resetAt).toBeGreaterThan(-1);
		expect(verdictAt).toBeLessThan(resetAt);
	});
});
