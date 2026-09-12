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
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PhoneSheet } from "@/components/debate/phone/PhoneSheet";

import { stubElementScroll } from "./_fixtures";

stubElementScroll();

afterEach(() => {
	cleanup();
	vi.clearAllMocks();
	// ⛔ AND UNSTUB GLOBALS. The reduced-motion row below stubs `matchMedia`, and
	// without this the stub LEAKS into every later row in the file: the next
	// sheet takes the synchronous reduced-motion path, never enters the leaving
	// phase, and a row asserting `data-phase === "leaving"` fails with
	// `expected 'open' to be 'leaving'` — a message about the component, produced
	// by residue from a different test. Measured, on the first run of the
	// busy-window row.
	vi.unstubAllGlobals();
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
/** The ruled ceiling (ADR-0051 A2). Already in `src/`, so the literal is inert. */
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

/**
 * ⛔⛔ THE SECOND OPEN — the row this suite did not have, and the reason it did
 * not catch a HIGH that reintroduced MOBILE-2c's own P0.
 *
 * `@security-auditor` found it: the close was made idempotent by a `closedRef`
 * that nothing ever reset, and two of the three `PhoneSheet` mount sites OUTLIVE
 * an open/close cycle (`detailsMounted` only ever becomes `true`; `focused !==
 * null` is stable for the whole thread arm). `if (!open) return null` hides
 * those instances without unmounting them, so React keeps the state — and the
 * second open rendered already in the leaving phase, with the root
 * `pointer-events-none`, the body locked and every door dead.
 *
 * ⚠ EVERY ROW IN THIS FILE PASSED THROUGH THAT. The reason is precise and worth
 * keeping: they all hard-code `open`, so not one of them ever toggled it. And
 * `sheet-a11y`'s own re-open row asserted `queryByTestId("phone-sheet")` is
 * `not.toBeNull()` — which is TRUE of a bricked sheet, because a sheet that
 * will not close is very much in the document. That is `SC-1`'s shape one
 * surface over: the assertion was about the row's PRESENCE and the claim is
 * about a PROPERTY.
 *
 * ⇒ These rows push a door AFTER the second open and assert the sheet LEAVES.
 */
describe("phone sheet — a second open is a new sheet (the re-open brick)", () => {
	const mountToggle = (busy = false) => {
		const onClose = vi.fn();
		function Host() {
			const [open, setOpen] = useState(true);
			return (
				<div>
					<button
						type="button"
						data-testid="reopen"
						onClick={() => setOpen(true)}
					>
						open
					</button>
					<PhoneSheet
						open={open}
						title="Toggling"
						busy={busy}
						onClose={() => {
							onClose();
							setOpen(false);
						}}
					>
						<p>BODY</p>
					</PhoneSheet>
				</div>
			);
		}
		render(<Host />);
		return onClose;
	};

	it("phone-sheet::a-sheet-re-opened-on-the-SAME-instance-is-dismissable-again", () => {
		vi.useFakeTimers();
		try {
			const onClose = mountToggle();
			// close once, the animated way
			fireEvent.click(screen.getByTestId("phone-sheet-backdrop"));
			act(() => {
				vi.advanceTimersByTime(200);
			});
			expect(onClose).toHaveBeenCalledTimes(1);
			expect(screen.queryByTestId("phone-sheet")).toBeNull();

			// re-open the SAME instance — React keeps its state
			fireEvent.click(screen.getByTestId("reopen"));
			const sheet = screen.getByTestId("phone-sheet");
			// ⛔ THE THREE FACTS THAT MADE IT A BRICK, each asserted directly rather
			// than inferred from "the sheet is present".
			expect(sheet.getAttribute("data-phase")).toBe("open");
			expect(sheet.getAttribute("class")).not.toMatch(
				/(?:^|\s)pointer-events-none(?:\s|$)/,
			);
			expect(
				screen.getByTestId("phone-sheet-panel").getAttribute("class"),
			).not.toMatch(/animate-out/);

			// ...and the door works a second time, which is the whole claim.
			fireEvent.click(screen.getByTestId("phone-sheet-backdrop"));
			act(() => {
				vi.advanceTimersByTime(200);
			});
			expect(onClose).toHaveBeenCalledTimes(2);
			expect(screen.queryByTestId("phone-sheet")).toBeNull();
		} finally {
			vi.useRealTimers();
		}
	});

	it("phone-sheet::Escape-also-survives-a-re-open-under-reduced-motion", () => {
		// ⚠ THE WORSE ARM. Under reduced motion the old latch was set with NO
		// leaving phase, so the second open looked completely normal — no
		// animation, full pointer events — and no door worked. Nothing on screen
		// would have told the reader why, and on a touch phone there is no Escape
		// key to fall back on. The control is the row above: same sequence, the
		// animated path.
		const mm = vi.fn().mockReturnValue({
			matches: true,
			media: "(prefers-reduced-motion: reduce)",
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
			addListener: vi.fn(),
			removeListener: vi.fn(),
			onchange: null,
			dispatchEvent: vi.fn(),
		});
		vi.stubGlobal("matchMedia", mm);
		const onClose = mountToggle();
		// reduced motion closes with no timer at all
		fireEvent.keyDown(document, { key: "Escape" });
		expect(onClose).toHaveBeenCalledTimes(1);
		expect(screen.queryByTestId("phone-sheet")).toBeNull();

		fireEvent.click(screen.getByTestId("reopen"));
		expect(screen.getByTestId("phone-sheet")).not.toBeNull();
		fireEvent.keyDown(document, { key: "Escape" });
		expect(onClose).toHaveBeenCalledTimes(2);
		expect(screen.queryByTestId("phone-sheet")).toBeNull();
		// POSITIVE CONTROL — the stub was actually consulted, so "reduced motion"
		// is a fact about this run rather than about jsdom having no matchMedia.
		expect(mm).toHaveBeenCalled();
		// ⚠ UNSTUBBED HERE TOO, not only in `afterEach`. A row that depends on a
		// hook for its own isolation is a row that breaks when somebody reorders
		// the file.
		vi.unstubAllGlobals();
	});

	it("phone-sheet::a-close-abandoned-by-the-host-does-not-fire-later", () => {
		// ⛔ THE ORPHANED TIMER — `@security-auditor` (MEDIUM). `open → false` by a
		// path that is not this component's own door used to clear nothing, so the
		// armed timer survived and fired against whatever sheet had been opened in
		// the meantime: tap the details backdrop, tap through the now
		// `pointer-events-none` layer onto the bottom bar within 200ms, and the
		// details sheet's timer closes the composer the reader just opened.
		vi.useFakeTimers();
		try {
			const onClose = vi.fn();
			function Host() {
				const [open, setOpen] = useState(true);
				return (
					<div>
						<button
							type="button"
							data-testid="hostclose"
							onClick={() => setOpen(false)}
						>
							host closes it
						</button>
						<PhoneSheet
							open={open}
							title="Abandoned"
							busy={false}
							onClose={onClose}
						>
							<p>BODY</p>
						</PhoneSheet>
					</div>
				);
			}
			render(<Host />);
			// a door is pushed — the timer is armed
			fireEvent.click(screen.getByTestId("phone-sheet-backdrop"));
			// ...and the HOST closes the sheet by another path before it fires
			fireEvent.click(screen.getByTestId("hostclose"));
			act(() => {
				vi.advanceTimersByTime(400);
			});
			// the abandoned close must not arrive late and close something else
			expect(onClose).not.toHaveBeenCalled();
		} finally {
			vi.useRealTimers();
		}
	});

	it("phone-sheet::a-busy-sheet-that-goes-busy-INSIDE-the-window-stays-dismissable", () => {
		// ⛔ THE OTHER HALF OF THE SAME DEFECT. `beginClose` read `busy` at call
		// time and handed off to a timer that re-checked nothing, so a request
		// going in flight inside the 200ms answered a close the reader asked for
		// before it existed — and the sheet was left `leaving`, locked and
		// un-tappable when the submit ERRORED. The timer now aborts AND releases.
		vi.useFakeTimers();
		try {
			const onClose = vi.fn();
			function Host() {
				const [busy, setBusy] = useState(false);
				return (
					<div>
						<button
							type="button"
							data-testid="gobusy"
							onClick={() => setBusy(true)}
						>
							busy
						</button>
						<button
							type="button"
							data-testid="idle"
							onClick={() => setBusy(false)}
						>
							idle
						</button>
						<PhoneSheet open title="Busy window" busy={busy} onClose={onClose}>
							<p>BODY</p>
						</PhoneSheet>
					</div>
				);
			}
			render(<Host />);
			fireEvent.click(screen.getByTestId("phone-sheet-backdrop"));
			expect(screen.getByTestId("phone-sheet").getAttribute("data-phase")).toBe(
				"leaving",
			);
			// the flight starts INSIDE the window
			fireEvent.click(screen.getByTestId("gobusy"));
			act(() => {
				vi.advanceTimersByTime(200);
			});
			// the close was refused, not deferred-and-committed
			expect(onClose).not.toHaveBeenCalled();
			// ...and the sheet is RELEASED rather than left leaving forever
			expect(screen.getByTestId("phone-sheet").getAttribute("data-phase")).toBe(
				"open",
			);
			// when the flight lands, the door works again
			fireEvent.click(screen.getByTestId("idle"));
			fireEvent.click(screen.getByTestId("phone-sheet-backdrop"));
			act(() => {
				vi.advanceTimersByTime(200);
			});
			expect(onClose).toHaveBeenCalledTimes(1);
		} finally {
			vi.useRealTimers();
		}
	});
});
