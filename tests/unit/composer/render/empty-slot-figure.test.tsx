// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { EMPTY_SLOT_COPY } from "@/components/debate/composer/copy";
import {
	ImageAttach,
	type ImageAttachState,
} from "@/components/debate/composer/ImageAttach";

/**
 * POLISH-4-EMPTYSLOT · THE EMPTY SLOT CARRIES THE THESIS, AND THE CAPTION IS
 * GONE.
 *
 * Two changes, one commit, and each needs a different kind of guard. The figure
 * is a PRESENCE that must appear only in the empty arm — a preview must never
 * find itself competing with a drawing. The caption is an ABSENCE, and an
 * absence is the easier of the two to lose: nothing reddens when a deleted
 * string quietly returns, so it is asserted explicitly rather than assumed from
 * the fact that we deleted it once.
 *
 * ⚠ `add image` GETS ITS OWN ASSERTIONS BECAUSE IT IS AN AFFORDANCE, NOT COPY.
 * With canon §6's caption deleted, it is the only text telling a participant the
 * box can be clicked — so its presence, and its separation from the headline,
 * are behaviour rather than decoration. A future edit that folds it into the
 * headline block would not look like a bug in a diff; it would look like tidying.
 *
 * `O-7` — assertions read the DOM tree and attributes, never `textContent` as a
 * proxy for markup. No jest-dom (AGENTS.md §9), so plain DOM only.
 */

afterEach(cleanup);

const noop = () => {};

function renderPhase(state: ImageAttachState) {
	const { container } = render(
		<ImageAttach
			state={state}
			disabled={false}
			onPick={noop}
			onRemove={noop}
		/>,
	);
	return container;
}

/** The figure, or null when the slot is showing something else. */
function figure(): SVGSVGElement | null {
	return document.querySelector("fieldset svg[viewBox='0 0 200 250']");
}

/** Every `<text>` string in the figure, in document order. */
function figureText(): string[] {
	const svg = figure();
	if (svg === null) return [];
	return [...svg.querySelectorAll("text")].map((t) => t.textContent ?? "");
}

describe("the empty slot renders the thesis figure", () => {
	it("empty-slot::the-idle-box-carries-the-figure", () => {
		renderPhase({ phase: "none" });
		expect(figure()).not.toBeNull();
	});

	it("empty-slot::the-figure-keeps-the-4-5-slot-box-and-adds-no-new-box", () => {
		// The figure lives INSIDE the shipped slot — it does not bring its own.
		// `attach-phases.test.tsx:77` pins `aspect-[4/5]` in all four phases; this
		// pins that the element carrying it is the figure itself, so the two
		// cannot drift into a box-inside-a-box.
		renderPhase({ phase: "none" });
		const cls = figure()?.getAttribute("class") ?? "";
		expect(cls).toMatch(/aspect-\[4\/5\]/);
		// 4:5 in the viewBox too — 200 × 250. A mismatch here would letterbox the
		// drawing inside its own box, which is the defect this shape exists to avoid.
		expect(figure()?.getAttribute("viewBox")).toBe("0 0 200 250");
	});

	it("empty-slot::the-figure-is-decorative-so-the-control-keeps-its-own-name", () => {
		// The text inside the figure must not leak into the pick control's
		// accessible name — the derived-name defect `attach-phases.test.tsx`
		// exists for. `aria-hidden` on the <svg> is what prevents it.
		renderPhase({ phase: "none" });
		expect(figure()?.getAttribute("aria-hidden")).toBe("true");
		expect(
			screen.getByLabelText("Choose an image file").getAttribute("aria-label"),
		).toBe("Choose an image file");
	});

	it("empty-slot::the-scale-is-drawn--seven-dots-and-a-hollow-capital", () => {
		// The thesis, drawn: knowledge has mass (seven filled dots), capital is a
		// single hollow circle. Carried from the O1 deck's `GoalFigure`. Asserting
		// the count keeps a re-composition from quietly becoming a different claim.
		renderPhase({ phase: "none" });
		const svg = figure();
		const filled = [...(svg?.querySelectorAll("g circle") ?? [])];
		expect(filled).toHaveLength(7);
		const hollow = [...(svg?.querySelectorAll("circle[fill='none']") ?? [])];
		expect(hollow).toHaveLength(1);
		// And the beam tilts with the LEFT (knowledge) end lower — y1 > y2, since
		// SVG y grows downward. This is the whole argument of the picture.
		const beam = svg?.querySelector("line");
		expect(Number(beam?.getAttribute("y1"))).toBeGreaterThan(
			Number(beam?.getAttribute("y2")),
		);
	});

	it("empty-slot::the-words-are-the-copy-surface-strings-not-literals", () => {
		// Sourced from `copy.ts`, never retyped at the render site.
		renderPhase({ phase: "none" });
		const texts = figureText();
		expect(texts).toContain(EMPTY_SLOT_COPY.eyebrow);
		expect(texts).toContain(EMPTY_SLOT_COPY.action);
		for (const line of EMPTY_SLOT_COPY.headlineLines) {
			expect(texts).toContain(line);
		}
	});

	it("empty-slot::the-headline-break-is-layout-and-never-changes-the-sentence", () => {
		// SVG cannot wrap, so the break is authored — which is exactly how a canon
		// sentence turns into two non-canon fragments without anyone deciding to
		// change it. `headline` stays the source of truth; the halves must rejoin
		// to it exactly.
		expect(EMPTY_SLOT_COPY.headlineLines.join(" ")).toBe(
			EMPTY_SLOT_COPY.headline,
		);
	});

	it("empty-slot::add-image-is-last-and-separated-from-the-headline", () => {
		// It is an INSTRUCTION, not a fourth line of the sentence. Two things make
		// that true and both are asserted: it comes last, and it sits materially
		// further from the headline than the headline's own lines sit from each
		// other. Collapse the gap and it reads as copy — which, with the caption
		// gone, would leave the box with nothing announcing it is clickable.
		renderPhase({ phase: "none" });
		const svg = figure();
		const texts = [...(svg?.querySelectorAll("text") ?? [])];
		const last = texts.at(-1);
		expect(last?.textContent).toBe(EMPTY_SLOT_COPY.action);

		const yOf = (s: string): number => {
			const el = texts.find((t) => t.textContent === s);
			return Number(el?.getAttribute("y"));
		};
		const [lineOne, lineTwo] = EMPTY_SLOT_COPY.headlineLines;
		const headlineGap = yOf(lineTwo as string) - yOf(lineOne as string);
		const actionGap = yOf(EMPTY_SLOT_COPY.action) - yOf(lineTwo as string);
		expect(actionGap).toBeGreaterThan(headlineGap * 2);
	});

	it("empty-slot::the-figure-uses-design-tokens-and-no-hex-literal", () => {
		// Monochrome by construction. `tokens-monochrome.test.ts` guards
		// globals.css and would never see a hex painted inline here.
		renderPhase({ phase: "none" });
		const markup = figure()?.outerHTML ?? "";
		expect(markup).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
		expect(markup).toMatch(/var\(--color-/);
	});
});

describe("a populated preview replaces the figure entirely", () => {
	it("empty-slot::the-attached-phase-shows-no-figure", () => {
		// The figure is the EMPTY state's content. Once a file is attached the
		// preview owns the box; a drawing behind or beside it would misrepresent
		// what is about to be written.
		renderPhase({ phase: "attached", uploadId: "u1", name: "chart.png" });
		expect(figure()).toBeNull();
	});

	it("empty-slot::the-figure-is-present-in-the-non-populated-phases", () => {
		// `attaching` and `error` have no preview URL either, so the box is still
		// the empty box and still says what it is for.
		for (const state of [
			{ phase: "attaching", name: "chart.png" },
			{ phase: "error", message: "Too large." },
		] as ImageAttachState[]) {
			renderPhase(state);
			expect(figure()).not.toBeNull();
			cleanup();
		}
	});
});

describe("the canon §6 caption is gone and must stay gone", () => {
	// ⚠ AN ABSENCE NEEDS AN ASSERTION. Deleting a string is a one-time act;
	// keeping it deleted is not. Nothing else in the suite reddens if
	// `Shown whole · any orientation` reappears under the box — a well-meaning
	// "restore the canon copy" edit would look like a fix and silently put a
	// caption back under a box that now explains itself. The canon amendment is
	// owed and is web-authored; until it lands, canon and code disagree here BY
	// DECISION, and this test is what records which side the code is on.
	const CAPTION = "Shown whole · any orientation";

	for (const [name, state] of [
		["none", { phase: "none" }],
		["attaching", { phase: "attaching", name: "chart.png" }],
		["attached", { phase: "attached", uploadId: "u1", name: "chart.png" }],
		["error", { phase: "error", message: "Too large." }],
	] as Array<[string, ImageAttachState]>) {
		it(`empty-slot::${name}-phase-does-not-render-the-removed-caption`, () => {
			const container = renderPhase(state);
			// Assert on the MARKUP, not on a queried node: a row-level "no element
			// with this text" check passes if the string moves into an attribute.
			expect(container.innerHTML).not.toContain(CAPTION);
		});
	}

	it("empty-slot::the-label-Image-outside-the-box-is-untouched", () => {
		// The caption went; the field label did not. Scope guard — a deletion that
		// took the label with it would leave the column unnamed on screen.
		renderPhase({ phase: "none" });
		expect(screen.getByText("Image").tagName).toBe("SPAN");
	});
});
