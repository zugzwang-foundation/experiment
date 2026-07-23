import { describe, expect, it } from "vitest";

// UI.19 Slice 1 tests-first (plan §Slice 1 / geometry.ts, web Gate-C ruling #2 —
// DUPLICATE profile geometry into a debate-local module, never a shared one) —
// the RED driver for `src/components/debate/chart/geometry.ts`, the d3-free pure
// scale layer for the market-detail price chart (SPEC.1 1.0.22 §9).
//
// RED target: `@/components/debate/chart/geometry` does NOT exist yet, so every
// import below fails to resolve and this file fails at COLLECTION until Slice 1's
// implement phase lands the module (CLAUDE.md §5.6 tests-first).
//
// Contract this file PINS (the impl must match these signatures):
//   VIEWBOX_W, VIEWBOX_H : number  — full-bleed viewBox dims (NO margins — the
//     market chart's X spans the whole width; deliberate divergence from the
//     profile module, which insets by a Đ-axis margin).
//   xPx(iso, startMs, endMs): number — TIME-SCALED: domain start → 0, end →
//     VIEWBOX_W, midpoint proportional; a degenerate domain (startMs === endMs)
//     maps to a FINITE value (0), never NaN (the single-point flat-line guard).
//   yYesPx(yes): number — probability→pixel for the YES line: (1 − p)·H.
//   yNoPx(yes): number  — probability→pixel for the NO line:  p·H  (p = the YES
//     probability). The two lines MIRROR about 50 % (design-language §3.2); the
//     fixed 0–100 % Y is deliberately NOT the profile module's Đ 0–10000 scale.
//
// PURE — no IO, no DB, no jsdom. Prices cross as decimal STRINGS ("0.5", never a
// JS float — CLAUDE.md §2); the only number math here is display geometry (a
// canonical string read as a number SOLELY to place an SVG point, the profile-
// geometry doctrine).

import {
	VIEWBOX_H,
	VIEWBOX_W,
	xPx,
	yNoPx,
	yYesPx,
} from "@/components/debate/chart/geometry";

// A 10-day market lifetime. The midpoint and quarter instants fall on exact
// fractions of the domain so the proportional pins are rounding-clean.
const START_ISO = "2026-09-15T00:00:00.000Z";
const QUARTER_ISO = "2026-09-17T12:00:00.000Z"; // +2.5 days → frac 0.25
const MID_ISO = "2026-09-20T00:00:00.000Z"; // +5 days   → frac 0.5
const END_ISO = "2026-09-25T00:00:00.000Z"; // +10 days  → frac 1
const START_MS = Date.parse(START_ISO);
const END_MS = Date.parse(END_ISO);

describe("UI.19 §9 — debate price-chart geometry (pure scales, no d3)", () => {
	// ── 1. xPx: time-scaled, full-bleed [0, VIEWBOX_W] ─────────────────────────
	it("xpx-maps-domain-to-full-width", () => {
		// Domain start → x = 0 (no left margin, unlike the profile module).
		expect(xPx(START_ISO, START_MS, END_MS)).toBe(0);
		// Domain end → x = VIEWBOX_W (no right margin — full bleed).
		expect(xPx(END_ISO, START_MS, END_MS)).toBe(VIEWBOX_W);
		// Midpoint proportional → half width; quarter → a quarter width.
		expect(xPx(MID_ISO, START_MS, END_MS)).toBeCloseTo(VIEWBOX_W / 2, 1);
		expect(xPx(QUARTER_ISO, START_MS, END_MS)).toBeCloseTo(VIEWBOX_W * 0.25, 1);
		// Strictly increasing in time across the domain.
		expect(xPx(QUARTER_ISO, START_MS, END_MS)).toBeGreaterThan(
			xPx(START_ISO, START_MS, END_MS),
		);
		expect(xPx(END_ISO, START_MS, END_MS)).toBeGreaterThan(
			xPx(MID_ISO, START_MS, END_MS),
		);
	});

	// ── 2. Y is a probability mirror about 50 % (design-language §3.2, INV-3
	//       side binding is thesis-bearing — YES/NO never collapse) ─────────────
	it("y-is-probability-mirror-about-fifty-percent", () => {
		// The formulas verbatim: y_yes = (1 − p)·H, y_no = p·H (p = YES prob).
		// p = 0.5 → both lines at H/2 (they cross at the midline).
		expect(yYesPx("0.5")).toBeCloseTo(VIEWBOX_H / 2, 1);
		expect(yNoPx("0.5")).toBeCloseTo(VIEWBOX_H / 2, 1);
		expect(yYesPx("0.5")).toBe(yNoPx("0.5"));

		// Poles. p = 0 → YES at the bottom (H), NO at the top (0).
		expect(yYesPx("0")).toBeCloseTo(VIEWBOX_H, 1);
		expect(yNoPx("0")).toBeCloseTo(0, 1);
		// p = 1 → YES at the top (0), NO at the bottom (H).
		expect(yYesPx("1")).toBeCloseTo(0, 1);
		expect(yNoPx("1")).toBeCloseTo(VIEWBOX_H, 1);

		// Off-centre probabilities keep the exact (1 − p)·H / p·H split …
		expect(yYesPx("0.25")).toBeCloseTo(VIEWBOX_H * 0.75, 1);
		expect(yNoPx("0.25")).toBeCloseTo(VIEWBOX_H * 0.25, 1);
		expect(yYesPx("0.8")).toBeCloseTo(VIEWBOX_H * 0.2, 1);
		expect(yNoPx("0.8")).toBeCloseTo(VIEWBOX_H * 0.8, 1);

		// … and are ALWAYS mirrored: the two y-values sum to H (symmetry about
		// the 50 % midline), for every probability.
		for (const p of ["0", "0.25", "0.5", "0.8", "1"]) {
			expect(yYesPx(p) + yNoPx(p)).toBeCloseTo(VIEWBOX_H, 1);
		}
	});

	// ── 3. Single-point / degenerate domain (unbet market) → no divide-by-zero.
	//       The flat line's endpoints are placed at x = 0 and x = VIEWBOX_W by the
	//       component; here we pin that the scale itself is finite (never NaN) when
	//       openedMs === lastMs (SPEC.1 §9 "fewer than two points → flat line"). ──
	it("single-point-degenerate-domain-does-not-nan", () => {
		const T = Date.parse(MID_ISO);
		const x = xPx(MID_ISO, T, T); // startMs === endMs — the degenerate case
		expect(Number.isNaN(x)).toBe(false);
		expect(Number.isFinite(x)).toBe(true);
		// Degenerate domain collapses to the start edge (0); the component spans
		// the flat line to VIEWBOX_W for the second endpoint.
		expect(x).toBe(0);
		// The full-width span the component draws to is itself finite.
		expect(Number.isFinite(VIEWBOX_W)).toBe(true);
		expect(VIEWBOX_W).toBeGreaterThan(0);
	});
});
