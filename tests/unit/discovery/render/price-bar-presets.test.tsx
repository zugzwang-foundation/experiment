// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { PriceBar } from "@/components/debate/PriceBar";

/**
 * DISCOVERY-COMPLETE C1 — V29/V30 `PriceBar` size presets.
 *
 * The load-bearing test here is `detail`. `PriceBar` is a SHARED primitive with
 * three render sites — `MarketHeader.tsx` (`/m/[slug]`), `HeroPanels.tsx`
 * (Discovery hero, V29) and `MarketCard.tsx` (Discovery grid, V30). At
 * DISCOVERY-COMPLETE only the two Discovery ones were in scope, so `detail`
 * pinned the render that shipped BEFORE the preset existed, byte for byte,
 * giving `/m/[slug]` a zero pixel delta (founder ruling OD-2).
 *
 * ⚠ THAT PIN IS NOW BROKEN, DELIBERATELY. `detail` was a NAMED TRANSITIONAL
 * preset and POLISH.3 was its row: d5 specifies a 14px bar / 10px labels
 * (surface_d5_v1_0.html:507-508) and PD-3-01 / D5 applied them. The literal
 * below is the POST-change capture. The suite's job is unchanged — it is still
 * a byte pin, and any diff against it is still a regression on `/m/[slug]` —
 * but it now pins the reconciled render, not the pre-preset one.
 *
 * No jest-dom in this repo (AGENTS.md §9) — plain DOM assertions only.
 */

afterEach(cleanup);

const PRICING = { yes: "0.38", no: "0.62" };

/**
 * The `detail` render of `<PriceBar pricing={{yes:"0.38",no:"0.62"}} />`.
 * Any diff here is a REGRESSION on `/m/[slug]`.
 *
 * ⚠ HOW THIS LITERAL WAS PRODUCED, stated as what happened rather than as what
 * was prescribed. `PriceBar.tsx`'s two tokens were edited FIRST — the V-1
 * ordering obligation held — and `container.innerHTML` was then dumped from the
 * rendered component. But the literal below was **EDITED IN PLACE**, two tokens,
 * NOT pasted from that dump. An earlier version of this paragraph claimed the
 * opposite; it was wrong, and it is corrected here rather than quietly.
 *
 * ⚠ BYTE-IDENTITY IS PROVEN TWICE, so the mechanism above costs nothing:
 * (1) this file's own exact-equality assertion runs green, which is the whole
 * proof — a hand-edit that missed a byte fails it; and (2) the dump is
 * preserved at `~/Downloads/p3-pr1-c2-baseline.txt`, 388 bytes, verified
 * character-identical to the resolved literal.
 *
 * ⚠ V-1's ACTUAL HAZARD DID NOT OCCUR. The hazard is authoring an expected
 * string and then bending the component to match it, which yields a file
 * indistinguishable from a correct one. It cannot have happened here: the two
 * values are not this session's to choose. They are d5's, at
 * `surface_d5_v1_0.html:507-508` (14px bar / 10px labels), ratified at D5 and
 * confirmed against the mockup by `@code-reviewer` independently of the
 * literal. The component was matched to a ratified external source, and the
 * literal was then matched to the component.
 *
 * ⚠ PROVENANCE, because a stale one misdirects the exact audit V-1 exists to
 * enable. Captured at POLISH.3 PR 1, 388 bytes. The PREVIOUS literal was the
 * pre-preset render captured at origin/main `aff76b3` before `size` existed,
 * 385 bytes; the +3 is `h-1.5` → `h-[14px]`. A reviewer checking this against
 * `aff76b3` will find a mismatch, and that mismatch is D5, not tampering.
 */
const DETAIL_BASELINE =
	'<div class="flex flex-col gap-1">' +
	'<div class="flex h-[14px] w-full overflow-hidden rounded-full [border:var(--hairline)]" role="img" aria-label="YES 38%, NO 62%">' +
	'<div class="h-full bg-yes" style="width: 38%;"></div>' +
	'<div class="h-full flex-1 bg-no"></div>' +
	"</div>" +
	'<div class="flex justify-between font-mono text-[10px] text-muted-foreground">' +
	"<span>YES 38%</span><span>NO 62%</span>" +
	"</div>" +
	"</div>";

describe("PriceBar presets — `detail` is byte-pinned to its captured render", () => {
	it("detail-render-matches-the-captured-baseline", () => {
		const { container } = render(<PriceBar pricing={PRICING} size="detail" />);
		expect(container.innerHTML).toBe(DETAIL_BASELINE);
	});

	it("detail-carries-no-data-size-attribute", () => {
		// The preset is invisible at the DOM level on `/m/[slug]`. Adding
		// `data-size` there would be a real (if inert) delta on a surface this
		// task is not opening.
		const { container } = render(<PriceBar pricing={PRICING} size="detail" />);
		expect(container.querySelector("[data-size]")).toBeNull();
	});
});

describe("PriceBar presets — the Discovery geometry", () => {
	it("hero-is-22px-bar-with-12px-labels-outside", () => {
		const { container } = render(<PriceBar pricing={PRICING} size="hero" />);

		const row = container.querySelector('[data-size="hero"]');
		expect(row).not.toBeNull();
		// `.barrow` — one flex row, gap 9px (surface_discovery_v1_0.html:99).
		expect(row?.getAttribute("class")).toContain("flex items-center gap-[9px]");

		const bar = screen.getByRole("img");
		expect(bar.getAttribute("class")).toContain("h-[22px]");
		expect(bar.getAttribute("class")).toContain("rounded-[var(--r)]");

		// Labels are OUTSIDE the bar — the mockup puts no text inside it.
		expect(bar.textContent).toBe("");
		const labels = row?.querySelectorAll(":scope > span");
		expect(labels?.length).toBe(2);
		expect(labels?.[0]?.getAttribute("class")).toContain("text-[12px]");
		expect(labels?.[0]?.textContent).toBe("YES 38%");
		expect(labels?.[1]?.textContent).toBe("NO 62%");
	});

	it("card-is-16px-bar-with-10.5px-labels-outside", () => {
		const { container } = render(<PriceBar pricing={PRICING} size="card" />);

		const row = container.querySelector('[data-size="card"]');
		expect(row).not.toBeNull();

		const bar = screen.getByRole("img");
		expect(bar.getAttribute("class")).toContain("h-[16px]");
		expect(bar.textContent).toBe("");

		const labels = row?.querySelectorAll(":scope > span");
		expect(labels?.length).toBe(2);
		expect(labels?.[0]?.getAttribute("class")).toContain("text-[10.5px]");
	});
});

describe("PriceBar presets — the invariants that hold across all three", () => {
	const SIZES = ["hero", "card", "detail"] as const;

	it("paired-aria-label-sums-to-100-in-every-preset", () => {
		// PCT.ROUND: YES canonical, NO derived — the pair always sums to exactly
		// 100 (SPEC.1 §10.8). A preset must not fork the formatter.
		for (const size of SIZES) {
			const { container } = render(<PriceBar pricing={PRICING} size={size} />);
			const bar = container.querySelector('[role="img"]');
			expect(bar?.getAttribute("aria-label")).toBe("YES 38%, NO 62%");
			cleanup();
		}
	});

	it("yes-segment-width-is-the-rounded-percent-in-every-preset", () => {
		for (const size of SIZES) {
			const { container } = render(<PriceBar pricing={PRICING} size={size} />);
			const yesSegment = container.querySelector<HTMLElement>(".bg-yes");
			expect(yesSegment?.style.width).toBe("38%");
			cleanup();
		}
	});

	it("poles-are-never-ported-by-neutral-token-name-in-any-preset", () => {
		// The C0 defect class, asserted at the render. The mockup's
		// `.fill{background:var(--ink)}` / `.bar{background:var(--n0)}` would
		// invert the poles here — the fill IS the YES side and the track IS the
		// NO side, and this build's ramp is inverted vs the light mockup.
		for (const size of SIZES) {
			const { container } = render(<PriceBar pricing={PRICING} size={size} />);
			expect(container.querySelector(".bg-yes")).not.toBeNull();
			expect(container.querySelector(".bg-no")).not.toBeNull();
			expect(container.innerHTML).not.toContain("bg-ink");
			expect(container.innerHTML).not.toContain("bg-n0");
			cleanup();
		}
	});

	it("null-pricing-renders-the-quiet-stub-in-every-preset", () => {
		for (const size of SIZES) {
			const { container } = render(<PriceBar pricing={null} size={size} />);
			expect(container.textContent).toBe("Pricing unavailable");
			expect(container.querySelector('[role="img"]')).toBeNull();
			cleanup();
		}
	});
});
