// @vitest-environment jsdom

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ResolverCards } from "@/components/debate/ResolverCards";
import type { DebateMarketHeader } from "@/components/debate/types";

/**
 * RESO-1 · R-7 / R-8 / R-12 — the resolution block row.
 *
 * ⚠⚠ THIS FILE'S SUBJECT HAS NOW BEEN REVERSED TWICE, AND BOTH SUPERSEDED
 * VERSIONS ARE RECORDED HERE RATHER THAN SWAPPED OUT (O-4).
 *   v1 asserted `expect(container.innerHTML).toBe("")` under "⛔ THIS IS A
 *      STRUCTURAL TEST AND CANNOT BE A VISUAL ONE … rendering the two card
 *      shells with empty fields would reproduce `PD-3-09` / `OD-6` exactly."
 *   v2 (founder ruling 2026-08-16) required VISIBLE PLACEHOLDER CHROME: two
 *      cards, EXACTLY two, carrying the byte-carried labels `LOGO`, `Resolver`,
 *      `X` and `X — official`, each with a 30px glyph box and two blank rows.
 *   v3 — RESO-1 — is FOUR blocks from one fixture. The count assertion
 *      (`toHaveLength(2)`) and the `X — official` byte-carry are what changed;
 *      everything below about EMPTY DATA is untouched.
 *
 * ⛔⛔ THE HALF THAT HAS NEVER REVERSED IS STILL THE LOAD-BEARING ONE: THE DATA
 * FIELDS STAY EMPTY. `markets` carries no resolver name, logo, source or X
 * handle, and RESO-1 ships no migration, so a future commit that "finishes"
 * these blocks by porting the mockup's demo copy would be inventing MARKET
 * CONTENT (CLAUDE.md §3). Those four strings are pinned as absent below.
 *
 * No jest-dom in this repo (AGENTS.md §9) — plain DOM assertions only.
 */

afterEach(cleanup);

const MARKET: DebateMarketHeader = {
	id: "0190c0de-5555-7000-8000-000000000005",
	slug: "resolver-cards-fixture-market",
	title: "Fixture market question.",
	description: "Fixture resolution criterion.",
	status: "Open",
	mediaVideoUrl: null,
	mediaImageUrl: null,
	pricing: { yes: "0.500000000000000000", no: "0.500000000000000000" },
	unitToWin: { yes: "1.960000000000000000", no: "1.960000000000000000" },
	totals: {
		dharmaStaked: "150.000000000000000000",
		postCount: 3,
		replyCount: 5,
	},
};

const KEYS = ["resolution", "resolver", "closes", "context"] as const;

describe("RESO-1 — R-7, four blocks from one fixture", () => {
	it("resolver-cards::G-3-renders-EXACTLY-four-blocks", () => {
		const { container } = render(<ResolverCards market={MARKET} />);

		expect(
			container.querySelector('[data-testid="resolver-cards"]'),
		).not.toBeNull();
		// ⚠ The superseded assertion was `toHaveLength(2)`. Four now, and EXACTLY
		// four — a fifth would be a different composition, and three would satisfy
		// any "renders some blocks" check.
		expect(
			container.querySelectorAll('[data-testid^="resolution-block-"]'),
		).toHaveLength(
			// four blocks + four glyphs + four labels + four value rows
			16,
		);
		for (const k of KEYS) {
			expect(
				container.querySelector(`[data-testid="resolution-block-${k}"]`),
			).not.toBeNull();
		}
	});

	it("resolver-cards::G-3-the-four-blocks-are-EQUAL-WIDTH-and-in-ONE-ROW", () => {
		const { container } = render(<ResolverCards market={MARKET} />);
		const row = container.querySelector('[data-testid="resolver-cards"]');
		const cls = row?.getAttribute("class") ?? "";

		// ⛔⛔ WHY THIS IS A CLASS ASSERTION AND NOT A MEASUREMENT. jsdom performs
		// NO LAYOUT — every `getBoundingClientRect()` here returns zeros, so four
		// blocks of genuinely unequal width would compare EQUAL and this guard
		// would pass on the defect it exists for. The declaration that makes them
		// equal-width and one-row is `grid-cols-4`: CSS grid divides the track
		// evenly, so equal width is a property of the container rather than of the
		// four children. That declaration is therefore the honest subject here, and
		// the RENDERED widths are measured in a real browser and reported in the
		// RESO-1 run log instead.
		expect(cls).toContain("grid");
		expect(cls).toContain("grid-cols-4");
		// ⛔ AND NO BREAKPOINT MAY FOLD THE ROW. A `sm:`/`md:`/`lg:` column override
		// would stack them into 2×2 at exactly the widths nobody checks, which
		// stops satisfying "one row" without stopping satisfying "four blocks".
		expect(cls).not.toMatch(/\b(sm|md|lg|xl|2xl):grid-cols-/);

		// R-8 — the row GROWS into what R-1/R-2 freed rather than carrying a tuned
		// literal height. `flex-1` is the mechanism; pinned by name.
		expect(cls).toContain("flex-1");
	});

	it("resolver-cards::each-block-has-a-1-to-1-placeholder-a-label-and-a-value-line", () => {
		const { container } = render(<ResolverCards market={MARKET} />);

		for (const k of KEYS) {
			const glyph = container.querySelector(
				`[data-testid="resolution-block-glyph-${k}"]`,
			);
			const label = container.querySelector(
				`[data-testid="resolution-block-label-${k}"]`,
			);
			const value = container.querySelector(
				`[data-testid="resolution-block-value-${k}"]`,
			);
			expect(glyph).not.toBeNull();
			expect(label).not.toBeNull();
			expect(value).not.toBeNull();

			// ⛔ 1:1 STATED AS A RATIO, not as two equal lengths a later edit could
			// desynchronise. `aspect-square` is the declaration; `shrink-0` is what
			// stops a compressed row from squashing it into a rectangle, which is
			// the one way a 1:1 placeholder silently stops being 1:1.
			const gc = glyph?.getAttribute("class") ?? "";
			expect(gc).toContain("aspect-square");
			expect(gc).toContain("shrink-0");
			// ⛔ AND NO COMPETING HEIGHT. `aspect-square` plus an explicit `h-*`
			// is over-determined, and whichever wins, the ratio is no longer the
			// thing that decides the shape.
			expect(gc).not.toMatch(/\bh-\[/);

			// The value row is EMPTY and unannounced — an empty announced row is
			// noise while the label beside it already names the slot.
			expect(value?.textContent).toBe("");
			expect(value?.getAttribute("aria-hidden")).toBe("true");
			expect(glyph?.getAttribute("aria-hidden")).toBe("true");
		}
	});

	it("resolver-cards::carries-the-four-PROVISIONAL-fixture-labels", () => {
		const { container } = render(<ResolverCards market={MARKET} />);
		// ⛔ Assert on `innerHTML`, never `textContent` (O-7).
		// ⚠ These four are PROVISIONAL and are NOT copy-register entries — the
		// RESO-1 brief rules them out of canon explicitly. They are pinned here so
		// the fixture cannot silently empty itself, not because the words are
		// ratified.
		for (const label of ["Resolution", "Resolver", "Closes", "Context"]) {
			expect(container.innerHTML).toContain(label);
		}
	});

	it("resolver-cards::ships-none-of-the-mockups-MARKET-CONTENT", () => {
		const { container } = render(<ResolverCards market={MARKET} />);

		// ⛔ THE SURVIVING HALF OF THE ORIGINAL RULING, THROUGH THREE REVERSALS.
		// These four name a market this build does not have; porting them would be
		// inventing market content (CLAUDE.md §3), not finishing a row.
		for (const demo of [
			"Brihanmumbai Municipal Corporation",
			"Monthly operational bulletins",
			"BMC",
			"@mybmc",
		]) {
			expect(container.innerHTML).not.toContain(demo);
		}

		// ⚠ AND NOTHING FROM THE MARKET ITSELF LEAKED IN EITHER, which is the
		// RESO-1-specific version of the same rule: the blocks take a `market` prop
		// and must not render any of it. A `Closes` block quietly filled from
		// `resolution_deadline` would be a settlement date on the page — market
		// content, and Hrishikesh's (CLAUDE.md §3).
		expect(container.innerHTML).not.toContain(MARKET.title);
		expect(container.innerHTML).not.toContain(MARKET.description);
		expect(container.innerHTML).not.toContain(MARKET.slug);
	});
});

/**
 * RESO-1 · G-4 / R-12 — the blocks are NON-INTERACTIVE.
 *
 * ⛔ THE REASON IS NOT STYLE. Hyperlinking these is deferred by founder ruling,
 * and the X posts a Resolution block would target do not exist — the Zugzwang X
 * account has not been created. So a block that LOOKS clickable promises a
 * destination that cannot be built, and one that IS clickable does nothing.
 *
 * ⚠ THE APPEARANCE HALF IS ASSERTED AS WELL AS THE BEHAVIOUR HALF, because they
 * fail independently: `cursor-pointer` with no handler is silent to a handler
 * check, and a handler with no cursor is silent to a style check.
 */
describe("RESO-1 — R-12, the blocks are non-interactive", () => {
	it("resolver-cards::G-4-no-block-exposes-an-href-or-a-click-handler", () => {
		const { container } = render(<ResolverCards market={MARKET} />);
		const row = container.querySelector('[data-testid="resolver-cards"]');
		expect(row).not.toBeNull();

		// No navigable or activatable element anywhere in the row.
		expect(row?.querySelectorAll("a")).toHaveLength(0);
		expect(row?.querySelectorAll("button")).toHaveLength(0);
		expect(row?.querySelectorAll("[href]")).toHaveLength(0);
		expect(row?.querySelectorAll("[onclick]")).toHaveLength(0);
		// React attaches `onClick` via its own delegation rather than an attribute,
		// so an attribute scan alone could miss it. An interactive ROLE or a
		// keyboard entry point is the observable trace a click target leaves.
		expect(row?.querySelectorAll("[role]")).toHaveLength(0);
		expect(row?.querySelectorAll("[tabindex]")).toHaveLength(0);

		for (const k of KEYS) {
			const block = container.querySelector(
				`[data-testid="resolution-block-${k}"]`,
			);
			expect(block?.tagName.toLowerCase()).toBe("div");
			expect(block?.getAttribute("href")).toBeNull();
			expect(block?.getAttribute("role")).toBeNull();
			expect(block?.getAttribute("tabindex")).toBeNull();
		}
	});

	it("resolver-cards::G-4-no-block-LOOKS-clickable-either", () => {
		const { container } = render(<ResolverCards market={MARKET} />);
		for (const k of KEYS) {
			const cls =
				container
					.querySelector(`[data-testid="resolution-block-${k}"]`)
					?.getAttribute("class") ?? "";
			// A pointer cursor, a hover state or a focus ring each invite a click
			// that does nothing.
			expect(cls).not.toContain("cursor-pointer");
			expect(cls).not.toContain("hover:");
			expect(cls).not.toContain("focus");
			expect(cls).not.toContain("group-hover");
		}
	});

	it("resolver-cards::G-4-the-scan-is-ALIVE", () => {
		// ⛔ NON-VACUITY FOR THE WHOLE DESCRIBE (OVN-V1). Every assertion above is a
		// `toHaveLength(0)` or a `not.toContain`, and all of them pass on a
		// component that renders NOTHING AT ALL — which is exactly what this file's
		// v1 asserted, so it is a real state this component has been in. This is the
		// positive control: the row exists and has four children to scan.
		const { container } = render(<ResolverCards market={MARKET} />);
		const row = container.querySelector('[data-testid="resolver-cards"]');
		expect(row).not.toBeNull();
		expect(row?.children.length).toBe(4);
		expect(container.innerHTML.length).toBeGreaterThan(200);
	});
});
