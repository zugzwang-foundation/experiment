// @vitest-environment jsdom

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ResolverCards } from "@/components/debate/ResolverCards";
import type { DebateMarketHeader } from "@/components/debate/types";

/**
 * HTML-FINISH · MARKET DETAIL row 3 — the resolver-card slot.
 *
 * ⚠⚠ ROUND 2 · R2 REVERSES THIS FILE'S SUBJECT, and the superseded version is
 * recorded rather than swapped out. It used to assert
 * `expect(container.innerHTML).toBe("")` under the heading "⛔ THIS IS A
 * STRUCTURAL TEST AND CANNOT BE A VISUAL ONE … rendering the two card shells
 * with empty fields would reproduce `PD-3-09` / `OD-6` exactly". The founder
 * ruling of 2026-08-16 requires VISIBLE PLACEHOLDER CHROME, so the two shells
 * now ship and this file guards their shape.
 *
 * ⛔⛔ THE HALF THAT DID **NOT** REVERSE IS THE HALF THAT MATTERS MOST, and it is
 * now the load-bearing guard here: the DATA FIELDS STAY EMPTY. `markets` carries
 * no resolver name, logo, source or X handle and this task ships no migration,
 * so a future commit that "finishes" these cards by porting the mockup's demo
 * copy — "Brihanmumbai Municipal Corporation", "Monthly operational bulletins",
 * "BMC", "@mybmc" — would be inventing MARKET CONTENT, which CLAUDE.md §3
 * refuses outright. Those four strings are pinned as absent below.
 *
 * ⚠ THE FOUR LABELS THAT DO SHIP ARE A DIFFERENT CATEGORY, and the split is the
 * point: `LOGO`, `Resolver`, `X` and `X — official` are CHROME — they name the
 * slot, not the market — and they are byte-carried from `d5:988`/`:990`/`:996`/
 * `:998` rather than authored. `Brihanmumbai Municipal Corporation` names a
 * market. One list is asserted present, the other absent, in the same file.
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

describe("ResolverCards — row 3, the placeholder chrome", () => {
	it("resolver-cards::renders-BOTH-cards", () => {
		const { container } = render(<ResolverCards market={MARKET} />);

		// ⚠ The superseded assertion was `toBe("")`. Two cards now, and EXACTLY
		// two — the mockup's `.rescards` is a two-column grid, and a third would be
		// a different composition.
		expect(
			container.querySelector('[data-testid="resolver-cards"]'),
		).not.toBeNull();
		expect(
			container.querySelector('[data-testid="resolver-card"]'),
		).not.toBeNull();
		expect(
			container.querySelector('[data-testid="x-official-card"]'),
		).not.toBeNull();
		expect(container.querySelectorAll('[data-testid$="-card"]')).toHaveLength(
			2,
		);
	});

	it("resolver-cards::carries-the-byte-carried-chrome-labels", () => {
		const { container } = render(<ResolverCards market={MARKET} />);

		// ⛔ Assert on `innerHTML`, never `textContent` (O-7).
		// ⚠ `X — official` uses the EM DASH U+2014, hexdumped from `d5:998`
		// (bytes e2 80 94). A hyphen here would be a paraphrase, not a carry, and
		// this literal is what catches it.
		for (const label of ["LOGO", "Resolver", "X — official"]) {
			expect(container.innerHTML).toContain(label);
		}
	});

	it("resolver-cards::ships-none-of-the-mockups-MARKET-CONTENT", () => {
		const { container } = render(<ResolverCards market={MARKET} />);

		// ⛔ THE SURVIVING HALF OF THE ORIGINAL RULING. These four name a market
		// this build does not have; porting them would be inventing market content
		// (CLAUDE.md §3), not finishing a row. R2 reversed the CHROME, not this.
		for (const demo of [
			"Brihanmumbai Municipal Corporation",
			"Monthly operational bulletins",
			"BMC",
			"@mybmc",
		]) {
			expect(container.innerHTML).not.toContain(demo);
		}
	});

	it("resolver-cards::the-value-rows-are-EMPTY-and-unannounced", () => {
		const { container } = render(<ResolverCards market={MARKET} />);

		// The two blank value rows are what make the shape read as a placeholder
		// rather than a label — but an empty announced row is noise, so they are
		// `aria-hidden`. Both cards, both rows.
		for (const testid of ["resolver-card", "x-official-card"]) {
			const card = container.querySelector(`[data-testid="${testid}"]`);
			const blanks = card?.querySelectorAll("span[aria-hidden='true']") ?? [];
			// The glyph box plus the two value rows.
			expect(blanks.length).toBe(3);
			for (const b of blanks) {
				// The glyph box has text; the two value rows must have NONE.
				if (b.getAttribute("class")?.includes("min-h-")) {
					expect(b.textContent).toBe("");
				}
			}
		}
	});
});
