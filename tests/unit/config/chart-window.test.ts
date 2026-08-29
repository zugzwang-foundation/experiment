import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
	MARKET_CHART_WINDOW_END,
	MARKET_CHART_WINDOW_START,
	resolveChartWindow,
} from "@/server/config/limits";

// CHART-3 — the constants layer for SPEC.1 1.0.42 §9's fixed experiment window.
//
// SPEC.1 §17 row proved here (in part):
//   debate-view::price-chart-axis-spans-fixed-window
//
// This file owns the NUMBERS and the ENV RESOLUTION. The render-side rule — that
// the axis is drawn from these and not from the series — is proved in
// `tests/unit/debate/render/price-chart.test.tsx`, which DERIVES its expectations
// from these constants rather than restating them. The split is deliberate: if
// both files derived, nothing would pin the values; if both restated, they would
// drift. One states, one derives.

const REPO_ROOT = join(__dirname, "..", "..", "..");

/** Source with comments removed, so a textual guard cannot be satisfied — or
 * defeated — by prose. ⚠ This repo has caught a negative source-scan matching
 * the COMMENT that explained the absence more than once; stripping first is the
 * cheap fix, and the positive control below proves the stripping did not simply
 * eat everything. */
function strippedSource(relPath: string): string {
	return readFileSync(join(REPO_ROOT, relPath), "utf8")
		.replace(/\/\*[\s\S]*?\*\//g, " ")
		.replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
}

describe("chart-window::the production window is pinned to the experiment", () => {
	it("resolves the production window for prod and for every unrecognised value", () => {
		const PROD_START = "2026-09-15T00:00:00.000Z";
		const PROD_END = "2026-11-05T23:45:00.000Z";

		for (const env of [
			"prod",
			undefined,
			"unknown",
			"",
			"production",
			"STAGING",
		]) {
			const w = resolveChartWindow(env);
			expect(w.start, `env=${String(env)} start`).toBe(PROD_START);
			expect(w.end, `env=${String(env)} end`).toBe(PROD_END);
		}
	});

	it("ends at 23:45, the ratified resolution deadline — not 23:59", () => {
		// ⛔ The same instant is trading close and settlement. A 23:59 axis would
		// run fifteen minutes past the last instant at which anything can happen,
		// and the difference is invisible at chart resolution — which is exactly
		// why it needs an assertion rather than an eyeball.
		const end = new Date(resolveChartWindow("prod").end);
		expect(end.getUTCHours()).toBe(23);
		expect(end.getUTCMinutes()).toBe(45);
		expect(end.getUTCFullYear()).toBe(2026);
		expect(end.getUTCMonth()).toBe(10); // November, 0-indexed
		expect(end.getUTCDate()).toBe(5);
	});
});

describe("chart-window::staging and preview share the fixture window", () => {
	it("resolves the staging window for staging AND for preview", () => {
		// ⚠ `preview` takes the STAGING window because preview deployments read
		// the staging database. Given production's window a preview chart would
		// render as a line crushed against the left edge — broken-looking in the
		// exact surface used to review a chart change.
		const STG_START = "2026-08-21T00:00:00.000Z";
		const STG_END = "2026-09-10T23:45:00.000Z";

		for (const env of ["staging", "preview"]) {
			const w = resolveChartWindow(env);
			expect(w.start, `env=${env} start`).toBe(STG_START);
			expect(w.end, `env=${env} end`).toBe(STG_END);
		}
	});

	it("starts no later than staging's earliest measured bet, so no real data is clipped", () => {
		// ⛔ MEASURED, NOT CHOSEN. The earliest `bet.placed` across staging's whole
		// slate at CHART-3 was 2026-08-21T05:29:29.430Z. A window that began after
		// it would push real bets off the left of the canvas and report nothing —
		// the failure is silent, which is why it is asserted here.
		const EARLIEST_MEASURED_BET = Date.parse("2026-08-21T05:29:29.430Z");
		const LATEST_MEASURED_BET = Date.parse("2026-08-29T16:26:57.144Z");
		const w = resolveChartWindow("staging");

		expect(Date.parse(w.start)).toBeLessThanOrEqual(EARLIEST_MEASURED_BET);
		expect(Date.parse(w.end)).toBeGreaterThanOrEqual(LATEST_MEASURED_BET);
	});
});

describe("chart-window::the exported constants are a usable, non-degenerate domain", () => {
	it("exports a strictly increasing pair of parseable instants", () => {
		// The component's degenerate branch keys on `startMs === endMs`. Under a
		// fixed window that must be unreachable, and this is what makes it so.
		const start = Date.parse(MARKET_CHART_WINDOW_START);
		const end = Date.parse(MARKET_CHART_WINDOW_END);
		expect(Number.isNaN(start)).toBe(false);
		expect(Number.isNaN(end)).toBe(false);
		expect(start).toBeLessThan(end);
	});
});

describe("chart-window::the environment branch never leaves the constants layer", () => {
	// ⭐ THE GUARD FOR THE FAILURE MODE THIS DESIGN EXISTS TO PREVENT. SPEC.1
	// §16.1: the window is "resolved from `ZUGZWANG_ENV` at the constants layer;
	// never branched on inside the derivation or the component." A conditional in
	// the read path survives review because each branch looks correct on its own,
	// and it fires only in the environment nobody is testing.
	const DERIVATION_AND_COMPONENTS = [
		"src/server/discovery/price-series.ts",
		"src/server/debate-view/price-chart.ts",
		"src/components/debate/chart/MarketPriceChart.tsx",
		"src/components/debate/chart/MarketPriceChartCard.tsx",
		"src/components/debate/chart/MarketPriceChartHost.tsx",
		"src/components/debate/chart/MarketPriceChartOverlay.tsx",
		"src/components/debate/chart/geometry.ts",
		"src/components/debate/chart/ChartSummary.tsx",
	];

	it("finds ZUGZWANG_ENV in the constants layer — the positive control", () => {
		// Without this, the negatives below are equally consistent with "absent"
		// and "my pattern is wrong", and stripping comments could have eaten the
		// whole file without anyone noticing.
		const limits = strippedSource("src/server/config/limits.ts");
		expect(limits).toContain("process.env.ZUGZWANG_ENV");
		expect(limits).toContain("resolveChartWindow");
	});

	it("finds it in NONE of the derivation or component files", () => {
		for (const rel of DERIVATION_AND_COMPONENTS) {
			const src = strippedSource(rel);
			// Non-vacuity per file: the strip left real code behind.
			expect(src.length, `${rel} stripped to nothing`).toBeGreaterThan(200);
			expect(src, `${rel} branches on the environment`).not.toContain(
				"ZUGZWANG_ENV",
			);
		}
	});

	it("keeps the window's env branch to exactly one site in src/", () => {
		// Belt to the above: `resolveChartWindow` is the only function permitted
		// to read the env for this purpose, and it is called exactly once.
		const limits = strippedSource("src/server/config/limits.ts");
		const calls = limits.match(/resolveChartWindow\(/g) ?? [];
		// One declaration + one invocation.
		expect(calls.length).toBe(2);
	});
});
