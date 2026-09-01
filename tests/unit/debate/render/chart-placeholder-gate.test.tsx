// @vitest-environment jsdom

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { MarketPriceChart } from "@/components/debate/chart/MarketPriceChart";
import { MarketPriceChartHost } from "@/components/debate/chart/MarketPriceChartHost";
import type { PricePoint } from "@/server/discovery/price-series";

/**
 * UI-QUICK change set 6 §5 — THE ENV GATE, EXERCISED AND PINNED. HARD BLOCKER.
 *
 * ⚠⚠ WHY THIS FILE EXISTS. CS5 shipped the gate READ BUT NEVER EXECUTED, and
 * unpinned — my own recon called that out as 6c/6d. It is the same shape as the
 * CS3 focus defect: a branch that was written, typed, reachable and plausible,
 * and never once ran. With the founder's ruling removing the "Sample" label,
 * there is now NOTHING on screen telling a viewer the chart is fabricated, so
 * this gate is the only thing standing between invented price data and
 * production. A gate nobody has watched fire is not a gate.
 *
 * ⛔⛔ HOW THE PROD BRANCH IS ACTUALLY EXERCISED, because "I read the line" is
 * not a proof. `tests/_setup/env.ts:32` sets `process.env.ZUGZWANG_ENV ??=
 * "prod"`, so the suite's DEFAULT env is already `prod` — and both components
 * read `process.env.ZUGZWANG_ENV` inside the render body, not at module scope,
 * so it is evaluated per render and can be varied per test.
 * ⚠ WHAT THIS PROVES AND WHAT IT DOES NOT, stated rather than glossed: in a
 * real production BUILD the value is inlined by `next.config.ts:29`, so the
 * shipped code reads `if ("prod" === "prod")`. Here it is read at runtime
 * instead. The COMPARISON and the branch taken are identical either way; what
 * is not covered is the inlining step itself, which is Next's, not ours.
 *
 * ⚠ Env is restored in `afterEach` — a leaked `ZUGZWANG_ENV` would silently
 * change unrelated suites (the `getRedisKey` build-env gate reads it too).
 *
 * No jest-dom in this repo (AGENTS.md §9) — plain DOM assertions only.
 */

const EMPTY: PricePoint[] = [];
const REAL: PricePoint[] = [
	{ at: "2026-08-01T00:00:00.000Z", yes: "0.500000000000000000" },
	{ at: "2026-08-02T00:00:00.000Z", yes: "0.560000000000000000" },
];

let saved: string | undefined;

beforeEach(() => {
	saved = process.env.ZUGZWANG_ENV;
});

afterEach(() => {
	cleanup();
	if (saved === undefined) {
		process.env.ZUGZWANG_ENV = undefined;
	} else {
		process.env.ZUGZWANG_ENV = saved;
	}
});

const detail = (series: PricePoint[]) =>
	render(<MarketPriceChartHost series={series} isOpen={true} />);

/**
 * ⚠⚠ RETARGETED AT RECONCILE-1, AND THE RETARGET IS THE POINT.
 *
 * This helper rendered `PriceSparkline`, and after the main→staging merge that
 * was a component **the product no longer mounts anywhere**. `main` deleted it
 * at CHART-1 (#425) when the hero moved onto `MarketPriceChart`; the merge kept
 * `main`'s `HeroPanels` — which renders `<MarketPriceChart mode="hero">` — while
 * also restoring the deleted file, whose only importer in the whole tree was
 * this test. The three `gate::hero-*` cases therefore went on passing against a
 * component that ships to nobody, under a comment asserting they were "the only
 * cover this mount has".
 *
 * ⛔ THAT IS THE FAILURE THIS FILE'S DETAIL ARM WAS ALREADY FIXED FOR. The same
 * merge reworked the detail cases carefully — reversing one, retargeting
 * another, writing down why each moved. The hero arm beside them was not
 * touched, so the file ended up half-adapted: green on both halves, truthful on
 * one. A guard pointed at a retired component is worse than no guard, because
 * the absence of one is at least visible.
 *
 * ⚠ WHAT THE MERGED HERO ACTUALLY DOES, measured rather than assumed:
 * `MarketPriceChart` has **no placeholder branch and no `ZUGZWANG_ENV` read** —
 * `main` retired the whole fabricated-replica mechanism rather than gating it,
 * so there is no invented data left to keep out of production. The obligation
 * the staging lane wrote ("nothing fabricated reaches the hero in prod") is
 * therefore preserved here as an assertion about the SHIPPED component, in every
 * environment, which is strictly stronger than the env-conditional form it
 * replaces.
 *
 * `isOpen` is the licensed `true` literal: Discovery lists only `Open` markets,
 * which is exactly the call-site asymmetry `HeroPanels` itself relies on.
 */
const hero = (series: PricePoint[]) =>
	render(<MarketPriceChart series={series} mode="hero" isOpen={true} />);

describe("§5 the env gate — MARKET DETAIL mount", () => {
	it("gate::detail-PROD-plus-empty-series-renders-NO-placeholder-and-no-svg", () => {
		// ⛔ THE ASSERTION THE WHOLE SECTION EXISTS FOR.
		process.env.ZUGZWANG_ENV = "prod";
		const { container } = detail(EMPTY);

		expect(
			container.querySelector('[data-testid="market-price-chart-placeholder"]'),
		).toBeNull();
		// Not just "no placeholder" — NO SVG AT ALL. A future refactor that kept
		// the gate but drew something else would pass the narrower assertion.
		expect(container.querySelector("svg")).toBeNull();
		expect(container.innerHTML).toBe("");
	});

	it("gate::detail-EMPTY-series-renders-NOTHING-in-EVERY-env", () => {
		// ⚠⚠ THIS TEST REVERSED AT THE main→staging MERGE, AND THE REVERSAL IS THE
		// POINT. It used to assert the opposite — that a NON-prod empty series DOES
		// render a placeholder — and it was written as the positive control for the
		// prod assertion above, on the reasoning that "without it the assertion
		// above would pass on a component that never renders a placeholder in any
		// environment". CHART-1 on `main` made the component exactly that: the host
		// now gates on `hasRenderableSeries()` and returns `null` for an empty
		// series in EVERY environment, and the `market-price-chart-placeholder`
		// testid exists nowhere in `src/` on `main` (measured). The old control
		// therefore fired correctly — the behaviour moved out from under it.
		//
		// ⛔ THE CONTROL OBLIGATION DOES NOT DISAPPEAR, IT MOVES. What stops the
		// prod assertion passing vacuously is now
		// `gate::detail-a-REAL-series-renders-the-REAL-chart-in-EVERY-env` below:
		// it proves this component renders SOMETHING when there is data, so "renders
		// nothing" here is a statement about the empty series and not about a
		// component that never renders at all. Deleting that test re-opens this hole.
		for (const env of ["prod", "staging", "preview", "unknown"]) {
			process.env.ZUGZWANG_ENV = env;
			const { container } = detail(EMPTY);
			expect(
				container.querySelector(
					'[data-testid="market-price-chart-placeholder"]',
				),
			).toBeNull();
			expect(container.querySelector("svg")).toBeNull();
			expect(container.innerHTML).toBe("");
			cleanup();
		}
	});

	it("gate::detail-a-REAL-series-renders-the-REAL-chart-in-EVERY-env", () => {
		// ⛔ The placeholder must never override real data — in prod OR out of it.
		for (const env of ["prod", "staging", "preview", "unknown"]) {
			process.env.ZUGZWANG_ENV = env;
			const { container } = detail(REAL);
			expect(
				container.querySelector('[data-testid="market-price-chart"]'),
			).not.toBeNull();
			expect(
				container.querySelector(
					'[data-testid="market-price-chart-placeholder"]',
				),
			).toBeNull();
			cleanup();
		}
	});
});

describe("§5 the env gate — DISCOVERY HERO mount", () => {
	it("gate::hero-EMPTY-series-renders-NO-fabricated-replica-in-EVERY-env", () => {
		// ⛔ THE ASSERTION THE SECTION EXISTS FOR, carried over from the staging
		// lane and strengthened. It used to hold only in `prod`, because the
		// component it guarded drew an invented two-line replica everywhere else.
		// The shipped hero has no such branch, so the claim now holds in EVERY
		// environment — and BOTH replica testids are named, not just the sparkline's,
		// so a future component reintroducing either one is caught here regardless
		// of which family it borrows from.
		for (const env of ["prod", "staging", "preview", "unknown"]) {
			process.env.ZUGZWANG_ENV = env;
			const { container } = hero(EMPTY);
			expect(
				container.querySelector('[data-testid="price-sparkline-placeholder"]'),
			).toBeNull();
			expect(
				container.querySelector(
					'[data-testid="market-price-chart-placeholder"]',
				),
			).toBeNull();
			cleanup();
		}
	});

	it("gate::hero-a-REAL-series-renders-the-REAL-chart-in-EVERY-env", () => {
		// ⛔ THE NON-VACUITY CONTROL, and it is load-bearing exactly as its detail
		// twin is: without it "renders no replica" above would pass against a hero
		// that renders nothing at all in any environment, which is the shape the
		// merge defect actually had. This proves the mount draws the REAL chart
		// when there is data, so the assertion above is about fabrication and not
		// about a dead component.
		for (const env of ["prod", "staging", "preview", "unknown"]) {
			process.env.ZUGZWANG_ENV = env;
			const { container } = hero(REAL);
			expect(
				container.querySelector('[data-testid="market-price-chart"]'),
			).not.toBeNull();
			expect(
				container.querySelector('[data-testid="market-price-chart-frame"]'),
			).not.toBeNull();
			expect(
				container.querySelector('[data-testid="price-sparkline-placeholder"]'),
			).toBeNull();
			cleanup();
		}
	});

	it("gate::hero-mounts-the-SHIPPED-chart-and-the-retired-sparkline-is-GONE", () => {
		// ⛔⛔ THE WALL THAT WOULD HAVE CAUGHT THE MERGE DEFECT, and the reason it
		// is a source scan rather than a render: the defect was not that the hero
		// rendered the wrong thing — it rendered the right thing — but that a
		// SECOND, retired component survived beside it with a test still aimed at
		// it. No amount of rendering the correct hero can see that.
		//
		// ⚠ FILE EXISTENCE, NOT A WORD MATCH. `PriceSparkline` appears in six
		// comments across `src/` (`MarketPriceChart`, `geometry.ts`, `HeroPanels`,
		// `MarketCard`) as deliberate history — one of them literally reads "that
		// component was DELETED at CHART-1 … read the name as history, not as a
		// live reference". A `grep` for the bare name would match every one of
		// them and fail on prose that is doing its job.
		expect(
			existsSync(
				join(process.cwd(), "src/components/discovery/PriceSparkline.tsx"),
			),
		).toBe(false);

		// Positive control for the scan itself: a component that IS there.
		expect(
			existsSync(
				join(process.cwd(), "src/components/debate/chart/MarketPriceChart.tsx"),
			),
		).toBe(true);

		// And the hero's own import, matched as import SYNTAX so the comments
		// above cannot satisfy it.
		const heroSrc = readFileSync(
			join(process.cwd(), "src/components/discovery/HeroPanels.tsx"),
			"utf8",
		);
		expect(heroSrc).toMatch(
			/import\s*\{[^}]*\bMarketPriceChart\b[^}]*\}\s*from\s*["'][^"']*chart\/MarketPriceChart["']/,
		);
		expect(heroSrc).not.toMatch(
			/import\s*\{[^}]*\bPriceSparkline\b[^}]*\}\s*from/,
		);
	});
});

describe("§5 the replicas are deterministic", () => {
	it("gate::both-replicas-render-byte-identically-across-repeated-mounts", () => {
		// ⛔ No RNG, no clock, no client-only value — so two mounts must produce the
		// same bytes. This is what makes "cannot hydration-mismatch" a measurement
		// rather than a claim about the source.
		process.env.ZUGZWANG_ENV = "staging";
		const a = detail(EMPTY).container.innerHTML;
		cleanup();
		const b = detail(EMPTY).container.innerHTML;
		expect(a).toBe(b);
		cleanup();

		// ⚠ THE HERO HALF READS `REAL`, FOR THE SAME REASON THE TOKEN PIN BELOW
		// DOES. On an empty series the shipped hero draws a frame with empty
		// lines, and two identical near-empty strings would satisfy this
		// assertion without ever exercising the arithmetic that could differ
		// between mounts. `REAL` makes the comparison bind on the coordinates.
		const c = hero(REAL).container.innerHTML;
		cleanup();
		const d = hero(REAL).container.innerHTML;
		expect(c).toBe(d);
	});

	it("gate::the-detail-replica-plots-TWO-side-keyed-lines", () => {
		// Founder ruling: mirror the real component, which draws NO then YES with
		// the GRAPH family. ⛔ `--color-yes` is the page ground, so a value-copy
		// would be invisible AND invert the poles — pinned so a later "simplify to
		// neutral ramp steps" is caught.
		// ⚠ RETARGETED FROM `EMPTY` TO `REAL` AT THE main→staging MERGE. This drew
		// the PLACEHOLDER replica, which `main` retired (see the env-gate test
		// above) — on an empty series there is now nothing to inspect. The token
		// pin is the half worth keeping and it binds harder on the real chart, so
		// it moves there rather than being deleted with the placeholder.
		process.env.ZUGZWANG_ENV = "staging";
		const { container } = detail(REAL);
		const html = container.innerHTML;

		expect(
			container.querySelectorAll("polyline").length,
		).toBeGreaterThanOrEqual(2);
		expect(html).toContain("var(--graph-yes)");
		expect(html).toContain("var(--graph-no)");
		expect(html).not.toContain("var(--color-yes)");
		expect(html).not.toContain("var(--color-no)");
	});
});
