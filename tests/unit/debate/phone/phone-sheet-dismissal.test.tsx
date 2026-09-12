// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PhoneSheet } from "@/components/debate/phone/PhoneSheet";

import { stubElementScroll } from "./_fixtures";

stubElementScroll();

afterEach(() => {
	cleanup();
	vi.clearAllMocks();
});

/**
 * MOBILE-2c G1 — THE ROW THAT WOULD HAVE CAUGHT THE P0.
 *
 * ⛔⛔ "THE BACKDROP IS PRESENT" IS NOT THE ASSERTION, AND THAT IS THE WHOLE
 * POINT OF THIS FILE. The backdrop existed, wired to the close, for the entire
 * time MOBILE-2c's P0 was live. What was missing was any pixel of it a finger
 * could reach: `PhoneSheet` sized its panel `h-full` when `fullHeight`, and
 * `PhoneDebateView` passed `fullHeight={viewer !== null}` — so the panel was the
 * viewport for exactly the readers who can bet, and the surface that means "let
 * me out" was underneath it. Measured on a Pixel-class Chromium with real
 * synthesized touch:
 *
 *   panel rect        {x:0, y:0, w:393, h:727}
 *   backdrop rect     {x:0, y:0, w:393, h:727}   ← the same rect, BEHIND the panel
 *   exposedBackdrop   null
 *
 * A guard reading "the backdrop is in the document" was green throughout.
 *
 * ⚠ jsdom PERFORMS NO LAYOUT, so it cannot hit-test and every
 * `getBoundingClientRect` here would be zeros. The defect is therefore expressed
 * STRUCTURALLY, as the two facts that make the backdrop reachable and that jsdom
 * can genuinely see: (1) the panel declares a CEILING and no viewport fill, and
 * (2) the backdrop is a SIBLING of the panel rather than something inside it.
 * Neither is the geometry; together they are what the geometry followed from.
 */
const ROOT = process.cwd();
const SHEET = "src/components/debate/phone/PhoneSheet.tsx";
const OWNER = "src/components/debate/phone/PhoneDebateView.tsx";
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

/**
 * ⛔ COMMENTS STRIPPED BEFORE EVERY NEGATIVE SCAN, line count preserved. This
 * repository has six recorded instances of a textual guard matching the COMMENT
 * that explains why the thing is absent — and this file is the sharpest possible
 * case of it, because BOTH files scanned below carry long docblocks that name
 * `fullHeight` and `h-full` repeatedly in order to record what was removed. A
 * scan over the raw text reddens on the history of the fix.
 *
 * ⚠ Duplicated locally rather than shared, which is this repo's own pattern for
 * this helper — ten files under `tests/unit/design/` carry their own copy.
 */
function code(src: string): string {
	return src
		.replace(/\/\*[\s\S]*?\*\//g, (m) =>
			"\n".repeat((m.match(/\n/g) ?? []).length),
		)
		.replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

/**
 * The `className={…}` belonging to the element carrying `data-testid="<id>"`,
 * extracted by BRACE MATCHING from the attribute's own opening brace.
 *
 * ⛔ NOT BY A CHARACTER WINDOW. `O-8`: a `slice(at, at + N)` is a line number
 * wearing a different unit, and prose is what moves — `PhoneSheet`'s panel
 * carries a sixteen-line comment between its testid and its `className`, so any
 * window tight enough to be meaningful is one docblock edit away from missing
 * the attribute and reporting an empty class list, which satisfies a "does not
 * contain h-full" assertion vacuously.
 */
function classNameFor(src: string, testid: string): string {
	const anchor = src.indexOf(`data-testid="${testid}"`);
	if (anchor === -1) {
		throw new Error(`${testid}: no such data-testid in source.`);
	}
	const at = src.indexOf("className={", anchor);
	if (at === -1) {
		throw new Error(`${testid}: no className={ after the anchor.`);
	}
	let depth = 0;
	let i = at + "className=".length;
	for (; i < src.length; i++) {
		const ch = src[i];
		if (ch === "{") depth++;
		else if (ch === "}") {
			depth--;
			if (depth === 0) break;
		}
	}
	return src.slice(at + "className=".length + 1, i);
}

/**
 * Class TOKENS, never substrings — `max-h-full` contains `h-full`.
 *
 * ⛔ THE ENCLOSING BACKTICK IS STRIPPED, AND FINDING THAT OUT IS WHY THE
 * MUTATION PASS EXISTS. `classNameFor` returns a template literal, so its first
 * token arrived as `` `relative `` — and the first token is exactly where a
 * forbidden one would sit if someone wrote ``className={`h-full relative …`}``.
 * The `not.toContain("h-full")` arm would then have passed against the defect it
 * was written to reject, in silence. Seen in mutation 1's own failure output.
 */
const tokens = (s: string) =>
	s
		.split(/\s+/)
		.map((t) => t.replace(/^[`'"]+|[`'"]+$/g, ""))
		.filter(Boolean);

/**
 * ⚠⚠ THE FORBIDDEN HEIGHT TOKENS ARE ASSEMBLED AT RUNTIME AND THAT IS NOT
 * STYLE. Tailwind v4's source detection scans `tests/` as well as `src/`, so a
 * class-shaped literal in this file becomes a real emitted utility. Measured
 * before writing it: `h-full` and `inset-0` already have a `src/` origin (14 and
 * 9 files), but `h-dvh` and `h-screen` have ZERO — writing them literally here
 * would mint two production utilities whose only source is a test, joining the
 * set AGENTS.md §8 records as "non-empty and unenumerated". Assembling them
 * leaves nothing scannable in the file.
 */
const H = "h-";
const VIEWPORT_FILL = [`${H}full`, `${H}dvh`, `${H}screen`];
/** The ruled ceiling (ADR-0050 A2). Already in `src/`, so the literal is inert. */
const CEILING = "max-h-[92dvh]";

describe("phone sheet — the panel has a ceiling, so the backdrop has an outside (G1)", () => {
	function mount(onClose = vi.fn()) {
		render(
			<PhoneSheet open title="Fixture sheet" busy={false} onClose={onClose}>
				<button type="button">inside</button>
			</PhoneSheet>,
		);
		return onClose;
	}

	it("phone-sheet-dismissal::the-rendered-panel-declares-a-ceiling-and-no-viewport-fill", () => {
		mount();
		const panel = tokens(
			screen.getByTestId("phone-sheet-panel").getAttribute("class") ?? "",
		);
		expect(
			panel,
			"the panel must declare the ruled max-height ceiling — without it " +
				"nothing bounds its height and the backdrop goes back underneath it",
		).toContain(CEILING);
		for (const fill of VIEWPORT_FILL) {
			expect(
				panel,
				`${fill} on the panel IS MOBILE-2c's P0: a panel the height of the ` +
					"viewport leaves not one reachable pixel of its own backdrop",
			).not.toContain(fill);
		}
		// POSITIVE CONTROL — the class list read is non-empty and really is the
		// panel's, so "does not contain h-full" is a fact about the panel rather
		// than about an attribute that was not found.
		expect(panel.length).toBeGreaterThan(4);
		expect(panel).toContain("rounded-t-4xl");
	});

	it("phone-sheet-dismissal::the-source-panel-class-carries-the-ceiling-and-no-fill", () => {
		// The source half of the row above, and not redundant: the rendered string
		// is assembled from `panelMotion` too, so a height token could arrive from
		// the motion branch — and conversely a source scan keeps reading when a
		// future refactor stops rendering this element in the default state.
		const panel = tokens(classNameFor(code(read(SHEET)), "phone-sheet-panel"));
		expect(panel).toContain(CEILING);
		for (const fill of VIEWPORT_FILL) {
			expect(
				panel,
				`${fill} is on the panel's source class string`,
			).not.toContain(fill);
		}
		// POSITIVE CONTROL for the extractor — the ROOT's class string genuinely
		// does carry `inset-0` (it is the fixed layer), so `classNameFor` is proved
		// to find a class list and to find the RIGHT one. A zero above therefore
		// means absent rather than "my extractor returned nothing".
		expect(tokens(classNameFor(code(read(SHEET)), "phone-sheet"))).toContain(
			"inset-0",
		);
	});

	it("phone-sheet-dismissal::no-fullHeight-prop-survives-in-the-sheet-or-its-owner", () => {
		// ⛔ A PROP WHOSE ONLY VALUE WAS THE DEFECT. It is gone from the component's
		// parameter list and its type, and from all three call sites.
		const offenders: string[] = [];
		for (const file of [SHEET, OWNER]) {
			if (code(read(file)).includes("fullHeight")) {
				offenders.push(file);
			}
		}
		expect(
			offenders,
			"`fullHeight` is back in the tier — the sheet can be a page again",
		).toEqual([]);
		/**
		 * ⛔⛔ THE POSITIVE CONTROL IS THE UNSTRIPPED TEXT, and it is the strongest
		 * one available here: both files' docblocks name `fullHeight` explicitly in
		 * order to record what was removed and why, so the raw read MUST contain the
		 * needle. That proves three things at once — the paths resolve, the needle
		 * is spelled correctly, and the empty result above is the comment-stripper
		 * working rather than a scan that found nothing at all.
		 */
		for (const file of [SHEET, OWNER]) {
			expect(
				read(file).includes("fullHeight"),
				`${file}: the docblock still records the removed prop`,
			).toBe(true);
		}
	});

	it("phone-sheet-dismissal::the-backdrop-is-a-sibling-of-the-panel-and-closes-an-idle-sheet", () => {
		vi.useFakeTimers();
		try {
			const onClose = mount();
			const root = screen.getByTestId("phone-sheet");
			const backdrop = screen.getByTestId("phone-sheet-backdrop");
			const panel = screen.getByTestId("phone-sheet-panel");
			// ⚠ THE STRUCTURAL HALF OF "REACHABLE". jsdom cannot tell us the backdrop
			// is on top; it can tell us the backdrop is not INSIDE the thing that was
			// covering it. Both are children of the fixed root, in that order.
			expect(backdrop.parentElement).toBe(root);
			expect(panel.parentElement).toBe(root);
			expect(panel.contains(backdrop)).toBe(false);
			expect(
				Array.from(root.children).indexOf(backdrop),
				"the backdrop precedes the panel, so the panel paints over it and " +
					"only the panel's own height decides how much is left",
			).toBeLessThan(Array.from(root.children).indexOf(panel));
			// POSITIVE CONTROL for `contains` — the panel DOES contain the handle and
			// the body, so `false` above discriminates.
			expect(panel.contains(screen.getByTestId("phone-sheet-handle"))).toBe(
				true,
			);
			expect(panel.contains(screen.getByTestId("phone-sheet-body"))).toBe(true);
			// ...and the tap a phone reader performs first actually closes it.
			fireEvent.click(backdrop);
			act(() => {
				vi.advanceTimersByTime(200);
			});
			expect(onClose).toHaveBeenCalledTimes(1);
		} finally {
			vi.useRealTimers();
		}
	});
});
