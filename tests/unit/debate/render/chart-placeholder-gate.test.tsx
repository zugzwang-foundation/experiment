// @vitest-environment jsdom

import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { MarketPriceChartHost } from "@/components/debate/chart/MarketPriceChartHost";
import { PriceSparkline } from "@/components/discovery/PriceSparkline";
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
	render(<MarketPriceChartHost series={series} nodes={[]} />);
const hero = (series: PricePoint[]) =>
	render(<PriceSparkline series={series} size="hero" />);

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

	it("gate::detail-NON-PROD-plus-empty-series-DOES-render-the-placeholder", () => {
		// The positive control. Without it the assertion above would pass on a
		// component that never renders a placeholder in any environment.
		process.env.ZUGZWANG_ENV = "staging";
		const { container } = detail(EMPTY);

		expect(
			container.querySelector('[data-testid="market-price-chart-placeholder"]'),
		).not.toBeNull();
		expect(container.querySelector("svg")).not.toBeNull();
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
	it("gate::hero-PROD-plus-empty-series-renders-NO-placeholder-and-no-svg", () => {
		// ⚠ A SEPARATE MOUNT WITH A SEPARATE GATE. The detail chart's gate lives in
		// a different component and does not reach this one, so this is not a
		// duplicate assertion — it is the only cover this mount has.
		process.env.ZUGZWANG_ENV = "prod";
		const { container } = hero(EMPTY);

		expect(
			container.querySelector('[data-testid="price-sparkline-placeholder"]'),
		).toBeNull();
		expect(container.querySelector("svg")).toBeNull();
		expect(container.innerHTML).toBe("");
	});

	it("gate::hero-NON-PROD-plus-empty-series-DOES-render-the-placeholder", () => {
		process.env.ZUGZWANG_ENV = "staging";
		const { container } = hero(EMPTY);

		expect(
			container.querySelector('[data-testid="price-sparkline-placeholder"]'),
		).not.toBeNull();
		expect(container.querySelector("svg")).not.toBeNull();
	});

	it("gate::hero-a-REAL-series-renders-the-REAL-sparkline-in-EVERY-env", () => {
		for (const env of ["prod", "staging", "preview", "unknown"]) {
			process.env.ZUGZWANG_ENV = env;
			const { container } = hero(REAL);
			expect(
				container.querySelector('[data-testid="price-sparkline"]'),
			).not.toBeNull();
			expect(
				container.querySelector('[data-testid="price-sparkline-placeholder"]'),
			).toBeNull();
			cleanup();
		}
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

		const c = hero(EMPTY).container.innerHTML;
		cleanup();
		const d = hero(EMPTY).container.innerHTML;
		expect(c).toBe(d);
	});

	it("gate::the-detail-replica-plots-TWO-side-keyed-lines", () => {
		// Founder ruling: mirror the real component, which draws NO then YES with
		// the GRAPH family. ⛔ `--color-yes` is the page ground, so a value-copy
		// would be invisible AND invert the poles — pinned so a later "simplify to
		// neutral ramp steps" is caught.
		process.env.ZUGZWANG_ENV = "staging";
		const { container } = detail(EMPTY);
		const html = container.innerHTML;

		expect(container.querySelectorAll("polyline")).toHaveLength(2);
		expect(html).toContain("var(--graph-yes)");
		expect(html).toContain("var(--graph-no)");
		expect(html).not.toContain("var(--color-yes)");
		expect(html).not.toContain("var(--color-no)");
	});
});
