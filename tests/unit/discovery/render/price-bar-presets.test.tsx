// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { PriceBar } from "@/components/debate/PriceBar";

/**
 * DISCOVERY-COMPLETE C1 — V29/V30 `PriceBar` size presets.
 *
 * The load-bearing test here is `detail`. `PriceBar` is a SHARED primitive with
 * three render sites — `MarketHeader.tsx:96` (`/m/[slug]`), `HeroPanels.tsx:78`
 * (Discovery hero, V29) and `MarketCard.tsx:68` (Discovery grid, V30) — and only
 * the two Discovery ones are in this task's scope. `detail` therefore pins the
 * render that shipped BEFORE the preset existed, byte for byte, so `/m/[slug]`
 * has a zero pixel delta (founder ruling OD-2). The literal below was captured
 * from the pre-change component, not hand-written.
 *
 * ⚠ `detail` is a NAMED TRANSITIONAL preset. d5 specifies a 14px bar / 10px
 * labels (surface_d5_v1_0.html:507-508); reconciling it is POLISH.3's row. When
 * POLISH.3 runs, this literal is what it is deliberately changing.
 *
 * No jest-dom in this repo (AGENTS.md §9) — plain DOM assertions only.
 */

afterEach(cleanup);

const PRICING = { yes: "0.38", no: "0.62" };

/**
 * The pre-preset render of `<PriceBar pricing={{yes:"0.38",no:"0.62"}} />`,
 * captured from the component as it stood at origin/main aff76b3 — before
 * `size` existed. 385 bytes. Any diff here is a REGRESSION on `/m/[slug]`.
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

describe("PriceBar presets — `detail` is byte-identical to the pre-change render", () => {
	it("detail-render-is-unchanged", () => {
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
