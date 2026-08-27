// @vitest-environment jsdom

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MarketPriceChart } from "@/components/debate/chart/MarketPriceChart";
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
//   1. the frame is a flex ROW whose items STRETCH — so the gutter, which the
//      percentage resolves against, is exactly as tall as the plot;
//   2. the `<svg>` FILLS that plot box (`h-full w-full`) and does not
//      letterbox (`preserveAspectRatio="none"`) — so viewBox y maps linearly
//      onto the same height the gutter has;
//   3. neither the plot nor the gutter adds vertical padding, border or margin
//      — so "100 %" spans the same distance on both sides;
//   4. the gutter is the labels' containing block (`relative`) — so the
//      percentage resolves against IT and not against some ancestor.
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
 * ⛔ NO REACT MOUNTING, AND THE REASON IS MEASURED RATHER THAN STYLISTIC. This
 * file's sixteen cases originally called `render()` about forty times between
 * them. Every assertion below reads a class, an attribute or a child order —
 * nothing interacts, nothing re-renders, nothing needs a live React tree — so
 * the mounts bought nothing, and they cost enough to destabilise the run they
 * were part of.
 *
 * ⚠ WHAT THAT COST LOOKED LIKE, because it was not obvious and cost a long
 * detour to find. With this file mounting, the FULL suite failed 34, then 63,
 * then 161 DB-backed tests across three passes — foreign-key violations
 * (`23503`), deadlocks (`40P01`) and statement timeouts (`57014`) in files this
 * task never touched, and a different set each run. The same suite was green at
 * the base commit, green with this task's `src/` changes and the base tests,
 * green with this file removed, and green with a trivial file at this exact
 * path — which is what proved it was this file's CONTENT and not its presence
 * or the sequencer's ordering. `vitest.config.ts` sets `fileParallelism: false`
 * precisely because DB files racing each other produce those three error codes;
 * the mounts pushed the run slow enough for a `TRUNCATE … CASCADE` to hit the
 * 10s `hookTimeout`, and a half-truncated fixture set is what the next file's
 * foreign keys then failed against.
 *
 * ⚠ SO THE HARNESS CHANGED AND NOT ONE ASSERTION DID. Reading the SERVER render
 * is also the more honest source: it is the markup that actually ships, and it
 * is what `terminal-markers.test.tsx` had to fall back to anyway for the `top`
 * expression, because jsdom's CSSOM silently drops nested CSS math.
 *
 * ⚠ AND IT REMAINS A jsdom FILE (`@vitest-environment jsdom`, line 1) — not for
 * React, but because `DOMParser` is a browser API this parse needs.
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

describe("C-CHART-2 clause 2 — link 1: the gutter is exactly as tall as the plot", () => {
	for (const mode of MODES) {
		it(`${mode}: the frame is a flex row and nothing overrides the cross-axis stretch`, () => {
			// ⛔ THE LINK THE PERCENTAGE STANDS ON. `top: 34.7 %` resolves against
			// the GUTTER's height. The gutter's own content is one 10px sizer, so
			// without stretch it is 10px tall and every label lands within 10px of
			// the top of the chart — on all three surfaces, at every width, with
			// every existing guard still green because every existing guard reads
			// the percentage rather than what it resolves against.
			const { container } = renderMode(mode);
			const frame = cls(container, "market-price-chart-frame");

			expect(hasToken(frame, /^flex$/)).toBe(true);
			expect(hasToken(frame, CROSS_AXIS_OVERRIDE)).toBe(false);
			// …and the gutter does not opt itself out of the row's alignment.
			expect(
				hasToken(cls(container, "terminal-label-gutter"), SELF_OVERRIDE),
			).toBe(false);

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
		it(`${mode}: neither the plot nor the gutter adds vertical padding, border or margin`, () => {
			// A `py-1` on the gutter, or a `border-y` on the plot, silently makes the
			// two boxes different heights while both still stretch to the same row —
			// the percentage then resolves against a box the dot does not live in,
			// and the drift is a couple of pixels, i.e. exactly inside the range a
			// reviewer's eye forgives and the 1px contract does not.
			const { container } = renderMode(mode);
			for (const id of ["market-price-chart-plot", "terminal-label-gutter"]) {
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

describe("C-CHART-2 clause 2 — link 4: the gutter is the labels' containing block", () => {
	it("the gutter is positioned and both labels are absolute inside it", () => {
		// Without `relative` on the gutter the percentage resolves against the
		// nearest POSITIONED ancestor — on `/m/[slug]` that is somewhere up in the
		// page shell, so `top: 34.7 %` becomes a third of the way down the
		// viewport. The failure is spectacular in a browser and completely
		// invisible to a guard that only reads the percentage.
		const { container } = renderMode("collapsed");
		expect(
			hasToken(cls(container, "terminal-label-gutter"), /^relative$/),
		).toBe(true);
		for (const id of ["terminal-label-yes", "terminal-label-no"]) {
			expect(hasToken(cls(container, id), /^absolute$/)).toBe(true);
		}

		// POSITIVE CONTROL, AND IT IS ALSO A REAL PROPERTY. The sizer must be IN
		// FLOW — that is the only reason the gutter has a width at all — so it is
		// a node in the same tree that the `absolute` matcher correctly does NOT
		// match. A matcher that returned `true` for everything would fail here.
		const sizer = container.querySelector(
			'[data-testid="terminal-label-gutter"] > span[aria-hidden="true"]',
		);
		expect(sizer).not.toBeNull();
		expect(hasToken(sizer?.getAttribute("class") ?? "", /^absolute$/)).toBe(
			false,
		);
	});
});

describe("C-CHART-2 clause 3 — the gutter's width is measured, never pinned", () => {
	it("an in-flow invisible copy of the widest label sizes it, and no class does", () => {
		// ⛔ THIS IS THE DELETED CONSTANT, ASSERTED AS DELETED. CHART-1 reserved
		// the gutter by hand-measuring `YES` at 23.41 user units against
		// `ui-sans-serif` — Geist could not be fetched offline — and pinning 26
		// with 11 % headroom. CHART-2 replaced that guess with a copy of the string
		// the browser lays out in the real face. A `w-[26px]` added here would
		// reintroduce the same class of defect in a new unit, and nothing else in
		// the repository would notice.
		const { container } = renderMode("collapsed");
		const gutter = container.querySelector(
			'[data-testid="terminal-label-gutter"]',
		) as HTMLElement | null;
		expect(gutter).not.toBeNull();
		expect(hasToken(gutter?.getAttribute("class") ?? "", PINNED_WIDTH)).toBe(
			false,
		);
		// …nor an inline one.
		expect(gutter?.style.width ?? "").toBe("");

		// The sizer: present, hidden from the accessibility tree, and INVISIBLE
		// rather than DISPLAY:NONE — `hidden` would take its box away and collapse
		// the gutter to its 5px of padding, which is the one failure that looks
		// like a styling nit and is actually the whole mechanism.
		const sizer = container.querySelector(
			'[data-testid="terminal-label-gutter"] > span[aria-hidden="true"]',
		);
		const sizerCls = sizer?.getAttribute("class") ?? "";
		expect(hasToken(sizerCls, /^invisible$/)).toBe(true);
		expect(hasToken(sizerCls, /^hidden$/)).toBe(false);

		// …and it is a copy of the WIDEST label, read off the rendered labels
		// rather than asserted as the literal "YES", so the relationship survives
		// a copy change.
		const labelTexts = ["terminal-label-yes", "terminal-label-no"].map(
			(id) =>
				container.querySelector(`[data-testid="${id}"]`)?.textContent ?? "",
		);
		expect(labelTexts.every((t) => t.length > 0)).toBe(true);
		expect((sizer?.textContent ?? "").trim().length).toBeGreaterThanOrEqual(
			Math.max(...labelTexts.map((t) => t.trim().length)),
		);

		// POSITIVE CONTROL — the width ban fires on every form it is written
		// against and on none of the gutter's shipped classes.
		for (const offender of ["w-[26px]", "w-8", "min-w-[26px]", "max-w-10"]) {
			expect(hasToken(offender, PINNED_WIDTH)).toBe(true);
		}
		for (const innocent of ["shrink-0", "relative", "pl-[5px]"]) {
			expect(hasToken(innocent, PINNED_WIDTH)).toBe(false);
		}
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
			const c = cls(container, "terminal-label-gutter");
			cleanup();
			return c;
		});
		expect(new Set(seen).size).toBe(1);
		expect(seen[0]).toContain("text-[10px]");
		expect(seen[0]).toContain("leading-none");
	});

	it("no label span overrides the gutter's type size", () => {
		// The size is inherited, so a child override wins silently. The labels
		// legitimately carry an arbitrary COLOUR class — `text-[color:var(...)]` —
		// which shares the `text-[` prefix, so the ban is written against a digit
		// or a named step and the control below proves it tells them apart.
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

describe("C-CHART-2 clause 2 — the gutter sits to the RIGHT of the plot", () => {
	for (const mode of MODES) {
		it(`${mode}: the plot precedes the gutter in the frame's markup`, () => {
			// "Immediately right of each terminal dot" is the clause's own wording,
			// and in a flex ROW that is DOM order. A gutter emitted before the plot
			// puts both names on the left of the chart, away from the dots they
			// name — the legend problem clause 2 retired, reintroduced by an
			// argument reorder that changes nothing else. O-7: `innerHTML`, never
			// `textContent`.
			const { container } = renderMode(mode);
			const frame = container.querySelector(
				'[data-testid="market-price-chart-frame"]',
			);
			const html = frame?.innerHTML ?? "";
			const plot = html.indexOf('data-testid="market-price-chart-plot"');
			const gutter = html.indexOf('data-testid="terminal-label-gutter"');

			// Both present — an absent marker indexes to -1 and would satisfy the
			// ordering below by accident.
			expect(plot).toBeGreaterThan(-1);
			expect(gutter).toBeGreaterThan(-1);
			expect(plot).toBeLessThan(gutter);
		});
	}
});
