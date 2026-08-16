// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { STATE_COPY } from "@/components/debate/composer/copy";
import {
	ImageAttach,
	type ImageAttachState,
} from "@/components/debate/composer/ImageAttach";

/**
 * POLISH.4 PR B · the ATTACH AFFORDANCE'S FOUR PHASES.
 *
 * Minted from `@code-reviewer`'s HIGH + MEDIUM on the first draft of the
 * two-column grid (R1): the panel changed shape in every phase and only
 * `phase: "none"` was rendered by any suite, so the three that changed most
 * were unpinned.
 *
 * ⛔ THE HIGH THIS FILE EXISTS FOR. The first draft made the whole panel one
 * `<button>` with the image-error strip nested inside it. ARIA's
 * presentational-children rule strips the roles of a button's descendants, so
 * `role="status"` in that position is NOT a live region — and the button's
 * `aria-label` excludes the message from its accessible name too. That
 * silences every attach failure for a screen-reader user, which is the only
 * channel `error_image_oversize` / gate-down / sign-reject have. The fix makes
 * the column a `<fieldset>` and the status region the pick control's SIBLING;
 * `statusOutsideAnyButton` is the assertion that keeps it there.
 *
 * `O-7` — assertions read the DOM tree and the `class` attribute. Where text
 * is read it is a message the user must receive, never a proxy for markup.
 *
 * No jest-dom in this repo (AGENTS.md §9) — plain DOM only.
 */

afterEach(cleanup);

const ATTACH_LABEL = "Attach an image";
const noop = () => {};

function renderPhase(state: ImageAttachState, disabled = false) {
	const { container } = render(
		<ImageAttach
			state={state}
			disabled={disabled}
			onPick={noop}
			onRemove={noop}
		/>,
	);
	return container;
}

/** The labelled column — a `<fieldset>` in every phase. */
function column(): HTMLElement {
	return screen.getByLabelText(ATTACH_LABEL);
}

describe("ImageAttach — the column is one labelled group in every phase", () => {
	const phases: Array<[string, ImageAttachState]> = [
		["none", { phase: "none" }],
		["attaching", { phase: "attaching", name: "chart.png" }],
		["attached", { phase: "attached", uploadId: "u1", name: "chart.png" }],
		["error", { phase: "error", message: "Too large." }],
	];

	for (const [name, state] of phases) {
		it(`attach::${name}-phase-keeps-one-labelled-fieldset-column`, () => {
			renderPhase(state);
			const col = column();
			// ONE accessible name, and the same element carries it every time —
			// the grid's first track (`composer-grid.test.tsx`) depends on this.
			expect(col.tagName).toBe("FIELDSET");
			expect(col.getAttribute("aria-label")).toBe(ATTACH_LABEL);
			// The 4:5 preview box survives every phase.
			expect(col.innerHTML).toMatch(/aspect-\[?4\/5\]?/);
		});
	}

	it("attach::the-hidden-file-input-is-display-none-and-not-a-grid-track", () => {
		// `composer-grid.test.tsx::columnsOf` filters this input out of the column
		// count on the premise that it generates NO grid track. That premise is
		// `className="hidden"` and nothing else asserted it — so the "exactly two
		// columns" guard could not fail if the class were ever dropped.
		const container = renderPhase({ phase: "none" });
		const file = container.querySelector('input[type="file"]');
		expect(file).not.toBeNull();
		expect(file?.getAttribute("class") ?? "").toMatch(/(?:^|\s)hidden(?:\s|$)/);
	});
});

describe("ImageAttach — the error is announced, not swallowed by a button", () => {
	/** No ancestor of the live region may be a <button>. */
	function statusOutsideAnyButton(): HTMLElement {
		const status = screen.getByRole("status");
		for (let el = status.parentElement; el !== null; el = el.parentElement) {
			expect(el.tagName).not.toBe("BUTTON");
		}
		return status;
	}

	it("attach::error-renders-a-live-region-outside-every-button", () => {
		renderPhase({ phase: "error", message: "Too large." });
		const status = statusOutsideAnyButton();
		expect(status.getAttribute("aria-live")).toBe("polite");
		// Both halves reach the user: the wire's display string AND the kit line.
		expect(status.textContent).toContain("Too large.");
		expect(status.textContent).toContain(STATE_COPY.gateDown.body);
	});

	it("attach::error-with-no-heading-still-announces-the-retry-line", () => {
		// The no-heading convention (an empty message skips the heading span).
		renderPhase({ phase: "error", message: "" });
		const status = statusOutsideAnyButton();
		expect(status.textContent?.trim()).toBe(STATE_COPY.gateDown.body);
	});

	it("attach::the-live-region-survives-a-disabled-panel", () => {
		// floorAbove / in-flight disable the affordance; the message must still
		// be reachable rather than sitting inside a disabled control.
		renderPhase({ phase: "error", message: "Too large." }, true);
		expect(statusOutsideAnyButton().textContent).toContain("Too large.");
	});
});

describe("ImageAttach — the phase controls", () => {
	it("attach::attached-phase-exposes-remove-and-no-pick-control", () => {
		renderPhase({ phase: "attached", uploadId: "u1", name: "chart.png" });
		expect(screen.getByLabelText("Remove image").tagName).toBe("BUTTON");
		// The pick control is absent once a file is attached — same as `8db535d`;
		// re-picking runs through Remove first.
		expect(screen.queryByText("Image")).toBeNull();
	});

	it("attach::attaching-phase-disables-the-pick-control", () => {
		renderPhase({ phase: "attaching", name: "chart.png" });
		const pick = column().querySelector("button");
		expect(pick).not.toBeNull();
		expect(pick?.hasAttribute("disabled")).toBe(true);
	});

	it("attach::disabled-prop-disables-both-the-pick-and-the-remove-control", () => {
		renderPhase({ phase: "none" }, true);
		expect(column().querySelector("button")?.hasAttribute("disabled")).toBe(
			true,
		);
		cleanup();
		renderPhase({ phase: "attached", uploadId: "u1", name: "c.png" }, true);
		expect(screen.getByLabelText("Remove image").hasAttribute("disabled")).toBe(
			true,
		);
	});
});
