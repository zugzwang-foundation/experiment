// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BetComposer } from "@/components/debate/composer/BetComposer";

import { composerProps, stubWireFetch } from "./_harness";

/**
 * POLISH.4 PR B · R1 — the composer's ARGUMENT REGION is a TWO-COLUMN GRID.
 *
 * Tier-4 baseline: `docs/design/mockups/surface_d5_v1_0.html`
 * (md5 34619dacee472a245cb6e8678b509219, 1929 lines) —
 *   `.compgrid{display:grid;grid-template-columns:minmax(210px,40%) 1fr;
 *              align-items:stretch}`                                (:688-690)
 *   `.attach{…height:100%}` holding a 4:5 `.imgprev` + `.acap`      (:691-701)
 *   `.compright{…}` holding title → body → the money footblock      (:702)
 *   markup: `<div class="compgrid"><div class="attach">…<div class="compright">`
 *                                                                  (:1121-1123)
 *
 * The built composer STACKS these vertically — argumentLabel → title → body →
 * `<ImageAttach>` → amount, with the money block a separate sibling of the
 * fields column — so every assertion in this file is RED at `8db535d`.
 *
 * ⛔ ARRANGEMENT ONLY. Nothing here asserts a px, colour, radius, type size,
 * duration or easing (POLISH-4 §10 `H-VALUE` / `H-SYSTEM`): the grid's TRACK
 * SIZES are the shipped design system's, never this test's. What is pinned is
 * that a two-column grid exists, that the attach affordance is its FIRST
 * column and that the title + body + Amount row are its SECOND.
 *
 * `O-7` — every assertion reads the `class` attribute or `innerHTML`, never
 * `textContent`: an arrangement lives in the markup, and `textContent` cannot
 * see it.
 */

vi.mock("next/navigation", () => ({
	useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
	vi.clearAllMocks();
});

/**
 * The grid's COLUMN children. A `display:none` file input (the hidden
 * `<input type="file">` the attach affordance drives) generates no grid track,
 * so it is not a column — the one carve-out on "first child / second child".
 */
function columnsOf(grid: Element): Element[] {
	return Array.from(grid.children).filter(
		(el) => !el.matches('input[type="file"]'),
	);
}

function renderComposer(): {
	section: Element;
	attach: HTMLElement;
	grid: HTMLElement;
} {
	stubWireFetch([]);
	const { container } = render(<BetComposer {...composerProps()} />);
	const section = container.querySelector("section");
	if (section === null) {
		throw new Error("BetComposer rendered no <section> root");
	}
	const attach = screen.getByLabelText("Attach an image");
	const grid = attach.parentElement;
	if (grid === null) {
		throw new Error("the attach affordance has no parent element");
	}
	return { section, attach, grid };
}

describe("BetComposer argument region — two-column grid (R1)", () => {
	it("render::argument-region-is-a-two-column-grid", () => {
		const { section, grid } = renderComposer();
		// The grid is INSIDE the composer, not a wrapper around it.
		expect(section.contains(grid)).toBe(true);
		const cls = grid.getAttribute("class") ?? "";
		// It is a grid…
		expect(cls).toMatch(/(?:^|\s)grid(?:\s|$)|display:\s*grid/);
		// …with a declared column template (the TRACK VALUES are not asserted).
		expect(cls).toMatch(/grid-cols-|grid-template-columns/);
		// …of exactly two columns.
		expect(columnsOf(grid)).toHaveLength(2);
	});

	it("render::attach-is-the-left-column-and-the-fields-are-the-right", () => {
		const { section, attach, grid } = renderComposer();
		const title = screen.getByLabelText("Argument title");
		const body = screen.getByLabelText("Argument body");
		const stake = screen.getByLabelText("Stake amount");
		const close = screen.getByLabelText("Close");
		// Regression belt: every labelled control survives the re-arrangement.
		for (const control of [title, body, stake, close]) {
			expect(section.contains(control)).toBe(true);
		}

		const columns = columnsOf(grid);
		expect(columns).toHaveLength(2);
		// FIRST column — the image attach, a DIRECT child of the grid.
		expect(columns[0]).toBe(attach);
		// SECOND column — title input + body textarea + the Amount row.
		const right = columns[1];
		expect(right.contains(title)).toBe(true);
		expect(right.contains(body)).toBe(true);
		expect(right.contains(stake)).toBe(true);
		// The two are SIBLINGS, never nested: the attach is not in the right column.
		expect(right.contains(attach)).toBe(false);
	});

	it("render::attach-affordance-keeps-its-label-and-carries-the-4-5-preview", () => {
		const { attach } = renderComposer();
		expect(attach.getAttribute("aria-label")).toBe("Attach an image");
		// `.attach .imgprev{aspect-ratio:4/5}` (d5:695) — a PROPORTION, which is
		// arrangement; the box's colour/border/radius are the system's and are
		// deliberately not asserted.
		expect(attach.innerHTML).toMatch(/aspect-\[?4\/5\]?/);
	});
});
