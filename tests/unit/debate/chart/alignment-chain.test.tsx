// @vitest-environment jsdom

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SVG_W, VIEWBOX_W, xPx } from "@/components/debate/chart/geometry";
import { MarketPriceChart } from "@/components/debate/chart/MarketPriceChart";
import {
	MARKET_CHART_WINDOW_END,
	MARKET_CHART_WINDOW_START,
} from "@/server/config/limits";
import type { PricePoint } from "@/server/discovery/price-series";

// CHART-2 AUDIT — the alignment chain, link by link (`C-CHART-2` clause 2, and
// the *label legibility* / *hero width sweep* guards of the CHART-2 brief §6).
//
// ⛔ WHAT THIS FILE EXISTS FOR, STATED BEFORE ANY ASSERTION. `terminal-markers
// .test.tsx` proves the two NUMBERS agree: the label's `top` percentage is the
// same fraction of `VIEWBOX_H` that the dot's `cy` is. That is the arithmetic
// half of the contract and it is genuinely proven there. It is not the whole
// contract. "The label's centre sits within 1px of its dot's rendered `cy`"
// is a claim about RENDERED PIXELS, and a percentage only becomes a pixel
// through four layout facts, none of which was asserted anywhere before this
// file:
//
//   1. the frame is a flex ROW whose items STRETCH — so the marks column, which
//      also positions by percentage, is exactly as tall as the plot;
//   2. the `<svg>` FILLS that plot box (`h-full w-full`) and does not
//      letterbox (`preserveAspectRatio="none"`) — so the viewBox maps linearly
//      onto the box the labels resolve against;
//   3. neither the plot nor the layer adds vertical padding, border or margin
//      — so "100 %" spans the same distance on both sides;
//   4. the PLOT is the labels' containing block (`relative`), and the layer
//      fills it (`absolute inset-0`) — so both percentages resolve against the
//      one box the viewBox is stretched onto.
//
// ⚠ LINK 4 CHANGED AT CHART-6 AND IS CORRECTED HERE RATHER THAN ANNOTATED. It
// used to read "the GUTTER is the labels' containing block", which was true and
// sufficient while only `top` was a percentage: a flex sibling under
// `items-stretch` shares the plot's HEIGHT, and height was all the contract
// needed. `C-CHART-2` clause 2 as amended gives the label a `left` as well, and
// a box that shares only the plot's height cannot carry an x — an x measured
// from a right-hand gutter is an x measured from the plot's right EDGE, which is
// where the terminal dot sits on exactly one market shape. So the labels moved
// into the plot box, which shares both dimensions with the viewBox by
// construction, and the gutter was retired (RF-2).
//
// ⛔ MEASURED, NOT ARGUED: each of the first two was reverted against the tree
// at `e152dec` and the whole of `tests/unit/debate`, `tests/unit/discovery` and
// `tests/unit/design` stayed GREEN at 555/555 — `items-stretch` → `items-start`,
// and `preserveAspectRatio="none"` deleted, and `h-full w-full` deleted from the
// `<svg>`. Three edits, each of which breaks the alignment contract on all three
// surfaces, none of which any guard in the repository could see.
//
// ⚠ WHY THESE ARE CLASS-STRING ASSERTIONS AND WHY THAT IS HONEST HERE. jsdom
// performs no layout: `getBoundingClientRect` is all zeros, so the rendered
// consequence cannot be measured in this runner and is measured in the CHART-2
// contact sheet instead. What this file does is pin the four STRUCTURAL FACTS
// the rendered claim is built from, each stated with the consequence it buys —
// so a change that breaks one is rejected here, at write time, rather than
// discovered in a browser. Where a Tailwind DEFAULT already gives the right
// answer (flex `align-items` is `stretch` unless overridden) the assertion is
// written as a ban on the wrong answers rather than as a byte pin on the right
// one, so a tidy-up that merely deletes a redundant class stays green while one
// that changes the behaviour reds.

const SERIES: PricePoint[] = [
	{ at: "2026-09-15T00:00:00.000Z", yes: "0.500000000000000000" },
	{ at: "2026-09-20T00:00:00.000Z", yes: "0.650000000000000000" },
];

const MODES = ["collapsed", "expanded", "hero"] as const;

/**
 * The three modes' markup, parsed ONCE for the whole file.
 *
 * ⛔ THIS FILE USED TO MOUNT, AND THE MOUNTS BOUGHT NOTHING. Nothing here
 * interacts — every assertion reads an attribute, a class or a child order — and
 * the near-even sweep alone renders 401 charts in a single case, each of them a
 * flex frame plus an `<svg>` plus a gutter of three spans since CHART-2. The
 * server render is also the more honest source: it is the markup that actually
 * ships, and it is what the `top`-expression case has to read regardless,
 * because jsdom's CSSOM silently drops nested CSS math.
 *
 * ⚠ WHAT WAS MEASURED, AND WHAT IS **NOT** ESTABLISHED (O-13). With the mounts,
 * the FULL suite intermittently failed 28–161 DB-backed tests in files this task
 * never touches, with foreign-key violations (23503), deadlocks (40P01) and
 * statement timeouts (57014), a different set each pass; removing this file, or
 * replacing it with a trivial file at the same path, was green. After
 * de-mounting, two passes gave 0 and 4. **But the base commit, re-measured under
 * the same machine conditions, also failed 1** — so the suite has a
 * load-sensitive fragility of its own and this change reduced a contribution to
 * it rather than curing it.
 * ⛔ THE MECHANISM IS A HYPOTHESIS, NOT A FINDING, and it is written down as one
 * because the obvious objection is good: `vitest.config.ts` sets
 * `fileParallelism: false`, so a unit file completes before any DB file starts,
 * and a simple "this file slowed that file down" story does not survive that.
 * What is solid is the bisect; the causal chain is not, and nobody should cite
 * it later as though it were.
 */
const PARSED = new Map<(typeof MODES)[number], HTMLElement>();

function renderMode(mode: (typeof MODES)[number]): { container: HTMLElement } {
	const cached = PARSED.get(mode);
	if (cached !== undefined) {
		return { container: cached };
	}
	const html = renderToStaticMarkup(
		<MarketPriceChart series={SERIES} mode={mode} isOpen={true} />,
	);
	const body = new DOMParser().parseFromString(html, "text/html").body;
	PARSED.set(mode, body);
	return { container: body };
}

/** A no-op kept so the cases below read unchanged: nothing is mounted any more,
 * so there is nothing to unmount. */
function cleanup(): void {}

function cls(container: HTMLElement, testid: string): string {
	const el = container.querySelector(`[data-testid="${testid}"]`);
	if (el === null) {
		throw new Error(
			`[data-testid="${testid}"] is absent — this guard is stale`,
		);
	}
	return el.getAttribute("class") ?? "";
}

/** A Tailwind class TOKEN, not a substring — `-` is a word boundary, so a bare
 * `\bw-\b` would match `min-w-0` and `max-w-full` too. Every ban below goes
 * through this so it cannot fire on a class that merely CONTAINS the name.
 * (The repo has been bitten by the substring form before: a source scan for
 * document-level `fixed` matched `table-fixed`.) */
function hasToken(classes: string, token: RegExp): boolean {
	return classes.split(/\s+/).some((c) => token.test(c));
}

/** The cross-axis overrides that would stop the gutter being as tall as the
 * plot. `items-stretch` is the flex DEFAULT, so the guard is the absence of
 * these rather than the presence of that. */
const CROSS_AXIS_OVERRIDE = /^items-(start|center|end|baseline)$/;
const SELF_OVERRIDE = /^self-(start|center|end|baseline|auto)$/;
/** Vertical box-model on either side of the row would make "100 %" of the
 * gutter a different distance from 100 % of the plot. */
const VERTICAL_BOX_MODEL = /^-?(p|m)[ytb]-|^border-[ytb]?(-|$)|^\[border/;
/** A pinned width on the gutter would restore, in CSS, the hand-measured
 * 26-unit label advance CHART-2 deleted. */
const PINNED_WIDTH = /^(min-|max-)?w-/;
/** A type-size override on a label span would beat the gutter's `text-[10px]`,
 * which is where the legibility guarantee is declared. Written to skip the
 * arbitrary COLOUR form `text-[color:var(--graph-yes)]`, which the labels carry
 * legitimately. */
const TYPE_SIZE_RE = /^text-\[[\d.]|^text-(xs|sm|base|lg|[2-9]?xl)$/;

describe("C-CHART-2 clause 2 — link 1: the row's cells are exactly as tall as the plot", () => {
	for (const mode of MODES) {
		it(`${mode}: the frame is a flex row and nothing overrides the cross-axis stretch`, () => {
			// ⛔ THE LINK THE MARKS' PERCENTAGE STANDS ON. `markTop`'s `top: 34.7%`
			// resolves against the marks COLUMN's height, and without stretch that
			// column is as tall as its own content — one 10px sizer — so all eleven
			// numbers would land within 10px of the top of the chart while every
			// existing guard stayed green, because every existing guard reads the
			// percentage rather than what it resolves against.
			//
			// ⚠ THE LABELS NO LONGER DEPEND ON THIS, and saying so is the point of
			// the amendment rather than a reason to delete the case. Since CHART-6
			// they resolve against the PLOT (link 4), which is stretched by the same
			// rule but would still be the full height as the row's only growing
			// child. The marks column is what genuinely needs the stretch now — and
			// it exists on one mode of three, which is exactly the kind of narrowing
			// that turns a guard into decoration if nobody writes it down.
			const { container } = renderMode(mode);
			const frame = cls(container, "market-price-chart-frame");

			expect(hasToken(frame, /^flex$/)).toBe(true);
			expect(hasToken(frame, CROSS_AXIS_OVERRIDE)).toBe(false);
			// …and no in-flow cell opts itself out of the row's alignment.
			for (const id of ["market-price-chart-plot", "chart-y-marks"]) {
				const el = container.querySelector(`[data-testid="${id}"]`);
				if (el === null) continue; // `chart-y-marks` is expanded-only
				expect(hasToken(el.getAttribute("class") ?? "", SELF_OVERRIDE)).toBe(
					false,
				);
			}

			// POSITIVE CONTROL — the two bans can fire, on the same matcher, against
			// the same-shaped string. Without this, a `hasToken` that never matched
			// anything would certify both absences.
			expect(hasToken("flex w-full items-center", CROSS_AXIS_OVERRIDE)).toBe(
				true,
			);
			expect(hasToken("shrink-0 self-center", SELF_OVERRIDE)).toBe(true);
			// …and it does NOT fire on the shipped strings for the wrong reason:
			// `items-stretch` must not read as an override.
			expect(hasToken("flex items-stretch", CROSS_AXIS_OVERRIDE)).toBe(false);
		});
	}
});

describe("C-CHART-2 clause 2 — link 2: the svg fills the plot box and never letterboxes", () => {
	for (const mode of MODES) {
		it(`${mode}: preserveAspectRatio is "none" and the svg is h-full w-full`, () => {
			// ⛔ `preserveAspectRatio="none"` IS THE WHOLE OF THE MAPPING ARGUMENT,
			// on both sides of the contract. It is why `VIEWBOX_H` maps onto the
			// plot box's FULL height — which is what makes a fraction of the viewBox
			// the same fraction of the rendered box — and it is why the
			// container/viewBox lock means anything at all. At the SVG default
			// (`xMidYMid meet`) the drawing is letterboxed inside its box, the dot's
			// rendered `cy` is no longer `(cy / VIEWBOX_H) · boxHeight`, and the lock
			// in `container-viewbox-lock.test.tsx` becomes a comparison between two
			// numbers that no longer govern anything. Deleting the attribute was
			// measured green across 555 tests.
			const { container } = renderMode(mode);
			const svg = container.querySelector('[data-testid="market-price-chart"]');
			expect(svg).not.toBeNull();
			expect(svg?.getAttribute("preserveAspectRatio")).toBe("none");

			const svgCls = svg?.getAttribute("class") ?? "";
			expect(hasToken(svgCls, /^h-full$/)).toBe(true);
			expect(hasToken(svgCls, /^w-full$/)).toBe(true);

			// POSITIVE CONTROL — the size matchers fire on a string that lacks them,
			// so "true" above is a reading and not a tautology.
			expect(hasToken("h-24 w-auto", /^h-full$/)).toBe(false);
			expect(hasToken("h-full w-full", /^h-full$/)).toBe(true);
		});
	}
});

describe("C-CHART-2 clause 2 — link 3: 100 % is the same distance on both sides", () => {
	for (const mode of MODES) {
		it(`${mode}: neither the plot nor the label layer adds vertical padding, border or margin`, () => {
			// A `py-1` on the layer, or a `border-y` on the plot, silently makes the
			// two boxes different heights — and since CHART-6 the layer is INSIDE the
			// plot, so padding there inset it from the very box it is meant to BE.
			// Either way the percentage resolves against a box the dot does not live
			// in, and the drift is a couple of pixels: exactly inside the range a
			// reviewer's eye forgives and the 1px contract does not.
			// ⚠ This applies to both axes now. `inset-0` gives the layer the plot's
			// rectangle; any vertical box model takes it away again, and `left` would
			// drift with `top`.
			const { container } = renderMode(mode);
			for (const id of ["market-price-chart-plot", "terminal-label-layer"]) {
				expect(hasToken(cls(container, id), VERTICAL_BOX_MODEL)).toBe(false);
			}

			// POSITIVE CONTROL — every form the ban is written against actually
			// matches, and the shipped `pl-[5px]` / `min-w-0` do not.
			for (const offender of [
				"py-1",
				"pt-2",
				"mb-[3px]",
				"border-y",
				"border-t-2",
				"[border:var(--hairline)]",
			]) {
				expect(hasToken(offender, VERTICAL_BOX_MODEL)).toBe(true);
			}
			for (const innocent of ["pl-[5px]", "min-w-0", "px-2", "mx-auto"]) {
				expect(hasToken(innocent, VERTICAL_BOX_MODEL)).toBe(false);
			}
		});
	}
});

describe("C-CHART-2 clause 2 — link 4: the PLOT is the labels' containing block", () => {
	// ⚠ THE CONTAINING BLOCK MOVED AT CHART-6, and that is the whole of this
	// task's structural change. It used to be the gutter — a flex cell beside the
	// plot, which `items-stretch` made the same HEIGHT. That was enough while only
	// `top` was a percentage. Now `left` is one too, and a box that merely shares
	// the plot's height cannot carry an x: an x measured from the gutter is an x
	// measured from the plot's right EDGE, which is where the dot sits only on a
	// market that traded to the window end. So the labels moved INTO the plot box,
	// which shares both dimensions with the viewBox by construction.
	for (const mode of MODES) {
		it(`${mode}: the plot is positioned, the layer fills it, and both labels are absolute inside`, () => {
			// Without `relative` on the plot the percentages resolve against the
			// nearest POSITIONED ancestor — on `/m/[slug]` that is somewhere up in
			// the page shell, so `top: 34.7%` becomes a third of the way down the
			// viewport. The failure is spectacular in a browser and completely
			// invisible to a guard that only reads the percentage.
			const { container } = renderMode(mode);
			expect(
				hasToken(cls(container, "market-price-chart-plot"), /^relative$/),
			).toBe(true);

			// ⛔ `inset-0` IS WHAT MAKES THE LAYER THE PLOT BOX RATHER THAN A BOX
			// INSIDE IT. An absolutely-positioned child with no insets sizes to its
			// content and sits at the plot's origin, so `100%` would be the width of
			// two words — and every label would land in the leftmost 30px of the
			// chart while every percentage in the markup still read correctly.
			const layerCls = cls(container, "terminal-label-layer");
			expect(hasToken(layerCls, /^absolute$/)).toBe(true);
			expect(hasToken(layerCls, /^inset-0$/)).toBe(true);

			for (const id of ["terminal-label-yes", "terminal-label-no"]) {
				expect(hasToken(cls(container, id), /^absolute$/)).toBe(true);
			}

			// ⛔ AND THE LAYER MUST NOT EAT THE CLICK. It covers the whole plot, and
			// the plot sits inside the collapsed card's `<button>` and the hero's
			// `<Link>` — so without this the graph stops being the affordance on the
			// two surfaces where the graph IS the affordance.
			expect(hasToken(layerCls, /^pointer-events-none$/)).toBe(true);

			// POSITIVE CONTROL — the matchers discriminate on the same-shaped
			// strings, so the four `true`s above are readings and not tautologies.
			expect(hasToken("relative min-w-0 flex-1", /^relative$/)).toBe(true);
			expect(hasToken("min-w-0 flex-1", /^relative$/)).toBe(false);
			expect(hasToken("absolute inset-x-0", /^inset-0$/)).toBe(false);
		});
	}
});

describe("C-CHART-2 clause 3 — no width is ever pinned, and the plot keeps all of it", () => {
	// ⚠ CLAUSE 3'S SUBJECT WENT AWAY AT CHART-6 AND THE RULE UNDERNEATH IT DID NOT.
	// The clause used to be about a GUTTER whose width had to be MEASURED rather
	// than pinned — CHART-1 reserved it by hand-measuring `YES` at 23.41 user units
	// against `ui-sans-serif`, Geist being unfetchable offline, and pinning 26 with
	// 11 % headroom; CHART-2 replaced that guess with an in-flow invisible copy the
	// browser lays out in the real face. RF-2 retires the gutter altogether, so the
	// sizer goes with it — there is no box left to size.
	//
	// ⛔ THE BAN STAYS, BECAUSE THE BAN WAS NEVER ABOUT THE GUTTER. "No number in
	// this component encodes a string's width" is the durable half, and a
	// `w-[26px]` on the new label layer would be exactly the CHART-1 defect in a
	// newer unit. What replaces the sizer is not a measurement but the REMOVAL of
	// the constraint: the labels are `whitespace-nowrap` and absolutely positioned,
	// so each takes its own width and there is nothing for a wrong number to clip.
	for (const mode of MODES) {
		it(`${mode}: neither the layer nor either label pins a width`, () => {
			const { container } = renderMode(mode);
			for (const id of [
				"terminal-label-layer",
				"terminal-label-yes",
				"terminal-label-no",
			]) {
				const el = container.querySelector(
					`[data-testid="${id}"]`,
				) as HTMLElement | null;
				expect(el, `${id} is absent — this guard is stale`).not.toBeNull();
				expect(hasToken(el?.getAttribute("class") ?? "", PINNED_WIDTH)).toBe(
					false,
				);
				// …nor an inline one, which no class-token matcher would ever see.
				expect(el?.style.width ?? "").toBe("");
				expect(el?.style.maxWidth ?? "").toBe("");
			}

			// The labels size to their own content instead — the property that makes
			// the absent width safe rather than merely absent.
			for (const id of ["terminal-label-yes", "terminal-label-no"]) {
				expect(hasToken(cls(container, id), /^whitespace-nowrap$/)).toBe(true);
			}

			// POSITIVE CONTROL — the width ban fires on every form it is written
			// against and on none of the shipped classes.
			for (const offender of ["w-[26px]", "w-8", "min-w-[26px]", "max-w-10"]) {
				expect(hasToken(offender, PINNED_WIDTH)).toBe(true);
			}
			for (const innocent of [
				"absolute",
				"inset-0",
				"whitespace-nowrap",
				"pointer-events-none",
			]) {
				expect(hasToken(innocent, PINNED_WIDTH)).toBe(false);
			}
		});
	}

	it("the plot is the only flex child that grows, so the labels cost it no width", () => {
		// ⛔ THE MEASURED PAYOFF OF RETIRING THE GUTTER, ASSERTED STRUCTURALLY. The
		// gutter was a `shrink-0` cell taking 27.15 px from the plot on the collapsed
		// card and the hero, and 48.73 px on the expanded overlay — measured in the
		// shipped face, 2026-09-01. An overlay takes none, because it is out of flow.
		// If a future change puts the labels back in the row, the plot silently
		// narrows again and every rendered coordinate in the product moves.
		const { container } = renderMode("collapsed");
		const frame = container.querySelector(
			'[data-testid="market-price-chart-frame"]',
		);
		const inFlow = [...(frame?.children ?? [])].map(
			(c) => c.getAttribute("data-testid") ?? "",
		);
		// The collapsed frame carries the plot and nothing else in flow.
		expect(inFlow).toEqual(["market-price-chart-plot"]);

		// …and on the overlay, the plot plus the marks column — never the labels.
		const { container: ex } = renderMode("expanded");
		const exFrame = ex.querySelector(
			'[data-testid="market-price-chart-frame"]',
		);
		const exInFlow = [...(exFrame?.children ?? [])].map(
			(c) => c.getAttribute("data-testid") ?? "",
		);
		expect(exInFlow).toEqual(["market-price-chart-plot", "chart-y-marks"]);
		expect(exInFlow).not.toContain("terminal-label-layer");
	});
});

describe("C-CHART-2 clause 2 — label legibility: 10px is declared ONCE, for every mode", () => {
	it("the gutter carries the same type declaration on all three modes", () => {
		// ⚠ THE BRIEF'S LEGIBILITY GUARD SAYS "ON ANY MODE", AND THE HONEST FORM OF
		// THAT HERE IS AN IDENTITY, NOT A LOOP. `TerminalLabels` takes no `mode`,
		// so three renders exercise one code path; looping over modes and asserting
		// `text-[10px]` three times would be theatre. What is NOT theatre is
		// pinning that the declaration cannot BECOME mode-dependent — a
		// `mode === "collapsed" ? "text-[8px]" : "text-[10px]"` is exactly the
		// "correction applied per surface" that `C-CHART-2` clause 2 rules out,
		// and it would pass a per-mode loop that asserted only the mode it was
		// written for.
		const seen = MODES.map((mode) => {
			const { container } = renderMode(mode);
			const c = cls(container, "terminal-label-layer");
			cleanup();
			return c;
		});
		expect(new Set(seen).size).toBe(1);
		expect(seen[0]).toContain("text-[10px]");
		expect(seen[0]).toContain("leading-none");
	});

	// ⚠ SCOPE NARROWED BY CHART-5, AND SAID SO RATHER THAN LEFT IMPLIED. This
	// case matches a CLASS TOKEN on the two label spans under `collapsed`.
	// CHART-5 added the overlay's stacked VALUE line, which overrides the type
	// via an INLINE `style` on a CHILD span in `expanded` — three reasons this
	// matcher cannot see it. That override is founder-ruled and intended, so
	// the product is right; what would be wrong is leaving a guard asserting
	// "no label span overrides the gutter's type size" as though it still held
	// everywhere. It holds for the NAME, on every mode, which is what the
	// legibility ruling was about. The value line's own size is pinned by
	// `y-scale.test.tsx`. Raised by `@code-reviewer` at the CHART-5 cascade.
	it("no label span overrides the gutter's type size", () => {
		// The size is inherited, so a child override wins silently. The labels
		// legitimately carry an arbitrary COLOUR class in the `text-[color:var(--x)]`
		// shape, which shares the `text-[` prefix, so the ban is written against a
		// digit or a named step and the control below proves it tells them apart.
		const { container } = renderMode("collapsed");
		for (const id of ["terminal-label-yes", "terminal-label-no"]) {
			expect(hasToken(cls(container, id), TYPE_SIZE_RE)).toBe(false);
		}

		// POSITIVE CONTROL — fires on every override form, on neither shipped one.
		for (const offender of [
			"text-[8px]",
			"text-[0.5rem]",
			"text-xs",
			"text-2xl",
		]) {
			expect(hasToken(offender, TYPE_SIZE_RE)).toBe(true);
		}
		for (const innocent of [
			"text-[color:var(--graph-yes)]",
			"text-[color:var(--graph-no)]",
		]) {
			expect(hasToken(innocent, TYPE_SIZE_RE)).toBe(false);
		}
	});
});

describe("C-CHART-2 clause 2 — the label sits beside its own DOT", () => {
	// ⛔⛔ THIS BLOCK ASSERTED THE DEFECT, AND THAT IS WORTH STATING PLAINLY. It
	// read "the gutter sits to the RIGHT of the plot", and pinned DOM order to
	// prove it — a faithful reading of clause 2's original wording ("immediately
	// right of each terminal dot") under the assumption that the plot's right edge
	// IS where the dots end. CHART-3 fixed the axis to the experiment window and
	// broke that assumption without touching a line of this file, so the guard went
	// on passing while the labels drifted up to 691 px from the marks they name.
	// **A guard written against a coincidence certifies the coincidence, not the
	// rule** — which is why the assertion is now against the DOT's own coordinate.
	for (const mode of MODES) {
		it(`${mode}: the label's left is derived from the terminal dot's cx, not from the plot's edge`, () => {
			const { container } = renderMode(mode);

			// ⛔⛔ DERIVED FROM THE SERIES, NOT READ BACK OUT OF THE RENDER — and this
			// block said "the two independent quantities" while comparing ONE.
			// `cx`, `data-plot-x` and the `left` percentage all descend from a single
			// `terminalX`, so checking the label against the dot proves only that the
			// component agrees with itself. Filed by `@test-writer` as H-3, with the
			// mutation that walked straight through it: `terminalX = xPx(series[0].at,
			// …)` — the FIRST point instead of the last. This file's fixture starts
			// exactly at the window start, so under that mutation all three quantities
			// become `0`, `expect(0).toBeCloseTo(0)` holds, `0 < 99` holds, and all 22
			// tests stayed green. It is the very shape this describe block's own
			// header calls out one screen above.
			const expectedX = xPx(
				SERIES[SERIES.length - 1].at,
				Date.parse(MARKET_CHART_WINDOW_START),
				Date.parse(MARKET_CHART_WINDOW_END),
			);
			// Non-vacuity: the fixture ends INSIDE the plot and at neither edge, so
			// zero and full-width are both distinguishable from the right answer.
			expect(expectedX).toBeGreaterThan(0);
			expect(expectedX).toBeLessThan(VIEWBOX_W);

			const dot = container.querySelector('[data-testid="terminal-dot-yes"]');
			const label = container.querySelector(
				'[data-testid="terminal-label-yes"]',
			) as HTMLElement | null;
			expect(dot).not.toBeNull();
			expect(label).not.toBeNull();

			// Each of the three is checked against that one independent truth.
			expect(Number(dot?.getAttribute("cx"))).toBeCloseTo(expectedX, 6);
			expect(Number(label?.getAttribute("data-plot-x"))).toBeCloseTo(
				expectedX,
				6,
			);
			const left =
				label?.getAttribute("style")?.match(/left:([^;]*)/)?.[1] ?? "";
			expect(left, `${mode} label has no left`).not.toBe("");
			const anchorPct = Number.parseFloat(left.match(/([\d.]+)%/)?.[1] ?? "");
			expect(anchorPct).toBeCloseTo((expectedX / SVG_W) * 100, 3);

			// ⛔ MUST REJECT THE OLD BEHAVIOUR: an anchor at the plot's right edge.
			// This fixture's series ends well inside the window, so a label pinned to
			// the gutter would read as ~100 %. The guard therefore fails against
			// exactly the build it was written to replace.
			expect(anchorPct).toBeLessThan(99);
		});
	}

	it("the labels are the LAST thing in the plot box, so they paint over the series", () => {
		// O-7: `innerHTML`, never `textContent`. A label emitted before the `<svg>`
		// is painted under the lines it names — same z-order problem the gridlines
		// solve by being drawn first, in the opposite direction.
		const { container } = renderMode("collapsed");
		const plot = container.querySelector(
			'[data-testid="market-price-chart-plot"]',
		);
		const html = plot?.innerHTML ?? "";
		const svg = html.indexOf('data-testid="market-price-chart"');
		const layer = html.indexOf('data-testid="terminal-label-layer"');
		expect(svg).toBeGreaterThan(-1);
		expect(layer).toBeGreaterThan(-1);
		expect(svg).toBeLessThan(layer);
	});
});
