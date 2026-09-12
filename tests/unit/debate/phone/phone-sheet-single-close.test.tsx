// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PhoneDebateView } from "@/components/debate/phone/PhoneDebateView";
import { PhoneSheet } from "@/components/debate/phone/PhoneSheet";

import { modelWith, post, stubElementScroll, VIEWER } from "./_fixtures";

vi.mock("next/navigation", () => ({
	// ⚠ MERGE (MOBILE-2c ← main) — POST-IMAGE-EXPORT. #518 replaced
	// `ArgProfile`'s disabled download placeholder with the real
	// `DownloadPostImage`, which reads the market slug off the route, so a
	// `next/navigation` mock without `useParams` now THROWS at the first post
	// card render. Same idiom and same fixture slug as main's own render tests.
	useParams: () => ({ slug: "bitcoin-price-50k" }),
	useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

stubElementScroll();

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
	vi.clearAllMocks();
});

/**
 * MOBILE-2c G6 — R-8: one close control per sheet.
 *
 * ⛔⛔ THERE WERE TWO, 51px APART, WITH THE IDENTICAL ACCESSIBLE NAME. Measured
 * on a Pixel-class Chromium with the composer open: `close controls TWO, both
 * aria-label "Close", both "×", 51px apart`. The frame drew one in its header
 * row and `BetComposer` drew its own immediately below, because both the
 * composer and the auth gate open with their own heading AND their own close.
 * Two adjacent controls called "Close" is worse than one: a screen-reader user
 * traverses two identical names and cannot tell which dismisses what, and a
 * sighted reader sees a duplicated glyph where the sheet's chrome meets its
 * content.
 *
 * ⇒ `titleHidden` now decides BOTH — it hides the duplicate heading and removes
 * the frame's `×`, because they are the same question asked once: content that
 * brings its own heading brings its own close with it. The read-only sheets
 * (`details`, `parent`) carry no header of their own, so for them the frame IS
 * the header and keeps the one `×`.
 *
 * ⚠ THE COUNT IS `1`, NEVER `>= 1`, AND THAT IS THE ENTIRE POINT. Before R-8
 * there were two and every "the sheet has a labelled close" assertion in this
 * directory was green. An at-least assertion cannot see this defect.
 */

/**
 * The element's resolved ACCESSIBLE NAME, in the order a browser resolves it.
 *
 * ⚠ NOT `aria-label` DIRECTLY. `_fixtures.ts`'s `dialogName` records why the
 * guards here stopped reading one attribute: an assertion about WHICH attribute
 * names a control is an assertion about a mechanism, and the sheet moved from
 * `aria-label` to `aria-labelledby` without anything about the name changing.
 * What a reader with a screen reader receives is the resolved name.
 */
function accessibleName(el: Element): string {
	const label = el.getAttribute("aria-label");
	if (label !== null && label.trim() !== "") {
		return label.trim();
	}
	const by = el.getAttribute("aria-labelledby");
	if (by !== null) {
		const joined = by
			.split(/\s+/)
			.map((id) => document.getElementById(id)?.textContent ?? "")
			.join(" ")
			.trim();
		if (joined !== "") {
			return joined;
		}
	}
	const title = el.getAttribute("title");
	if (title !== null && title.trim() !== "") {
		return title.trim();
	}
	return (el.textContent ?? "").trim();
}

/**
 * Every INTERACTIVE descendant of `root` whose accessible name says "close".
 *
 * ⚠ SCOPED TO CONTROLS, because the `textContent` fallback above is inherited:
 * without the interactive filter every ancestor of a `Close` button counts as
 * one too, and the count becomes a depth measurement. `[aria-hidden="true"]`
 * elements are NOT excluded on purpose — the backdrop was itself one of the two
 * historical `Close` controls before it was unnamed and hidden, so re-labelling
 * it must redden this rather than slip past a filter.
 */
function closeControls(root: Element): Element[] {
	return [
		...root.querySelectorAll(
			'button,a[href],input,[role="button"],[role="link"]',
		),
	].filter((el) => /close/i.test(accessibleName(el)));
}

const POSTS = [
	post({ id: "p1", ordinal: 1, side: "YES" }),
	post({ id: "p2", ordinal: 2, side: "NO" }),
];

function mountView(viewer: Parameters<typeof PhoneDebateView>[0]["viewer"]) {
	return render(
		<PhoneDebateView
			model={modelWith(POSTS)}
			viewer={viewer}
			initialPostId={null}
			ownPseudonym={null}
			details={<p>DETAILS-SENTINEL</p>}
		/>,
	);
}

describe("phone sheet — exactly one close control per sheet (G6)", () => {
	it("phone-sheet-single-close::the-composer-sheet-carries-the-composers-own-close-and-no-second", () => {
		mountView(VIEWER);
		fireEvent.click(screen.getByTestId("phone-bar-entry"));
		const sheet = screen.getByTestId("phone-sheet");
		const controls = closeControls(sheet);
		expect(
			controls.map((el) => accessibleName(el)),
			"two adjacent controls named Close is the defect R-8 removed — the " +
				"count is 1, never at-least-1",
		).toEqual(["Close"]);
		// ...and it is the CONTENT's close, not the frame's: `titleHidden` removes
		// the frame's `×` for exactly the sheets whose content brings one.
		expect(
			screen.queryByTestId("phone-sheet-close"),
			"the frame must draw no × over content that has its own",
		).toBeNull();
		expect(sheet.contains(controls[0] ?? null)).toBe(true);
		// POSITIVE CONTROL — the composer really did mount inside this sheet, so
		// "one close" is a reading of a populated sheet rather than of an empty one.
		expect(
			screen.getByTestId("phone-sheet-body").textContent?.length ?? 0,
		).toBeGreaterThan(10);
	});

	it("phone-sheet-single-close::the-details-sheet-carries-the-frames-close-and-no-second", () => {
		mountView(VIEWER);
		fireEvent.click(screen.getByTestId("phone-title-strip"));
		const sheet = screen.getByTestId("phone-sheet");
		expect(closeControls(sheet).map((el) => accessibleName(el))).toEqual([
			"Close",
		]);
		// ⚠ THE OPPOSITE BRANCH OF THE SAME RULE. Details brings no header of its
		// own, so here the frame IS the header and its `×` is the one control.
		expect(
			screen.getByTestId("phone-sheet-close").getAttribute("aria-label"),
		).toBe("Close");
		expect(closeControls(sheet)[0]).toBe(
			screen.getByTestId("phone-sheet-close"),
		);
	});

	it("phone-sheet-single-close::the-signed-out-gate-sheet-also-carries-exactly-one", () => {
		// The auth gate is the other `titleHidden` branch and it too opens with its
		// own heading and its own close (`AuthGateSlot`). A reader who cannot bet
		// must not be the one who gets two ways out.
		mountView(null);
		fireEvent.click(screen.getByTestId("phone-bar-entry"));
		const sheet = screen.getByTestId("phone-sheet");
		expect(closeControls(sheet).map((el) => accessibleName(el))).toEqual([
			"Close",
		]);
		expect(screen.queryByTestId("phone-sheet-close")).toBeNull();
	});

	/**
	 * ⛔⛔ THE CONTROL THAT MAKES THE COUNT MEAN SOMETHING. Everything above is an
	 * `toEqual(["Close"])`, and a counter that can only ever return zero or one
	 * satisfies all of it. This row constructs the pre-R-8 state by hand — a frame
	 * that draws its own `×` over content that brings one — and requires the
	 * counter to report TWO. Without it, a broken `closeControls` certifies R-8
	 * against a build that never applied it.
	 */
	it("phone-sheet-single-close::the-counter-reports-TWO-when-there-are-two", () => {
		render(
			<PhoneSheet open title="Fixture sheet" busy={false} onClose={vi.fn()}>
				{/* The content's own close, exactly as BetComposer and AuthGateSlot
				    each carry one. With `titleHidden` omitted the frame draws its `×`
				    as well, which is the two-control state that shipped. */}
				<button type="button" aria-label="Close" data-testid="content-close">
					×
				</button>
			</PhoneSheet>,
		);
		const found = closeControls(screen.getByTestId("phone-sheet"));
		expect(
			found.length,
			"the counter must be able to see a second Close — otherwise every row " +
				"above passes against a counter that cannot count",
		).toBe(2);
		expect(found).toContain(screen.getByTestId("phone-sheet-close"));
		expect(found).toContain(screen.getByTestId("content-close"));
		// ...and the name resolver is not merely matching the `×` glyph: a control
		// with the same glyph and a DIFFERENT name is not a close control.
		cleanup();
		render(
			<PhoneSheet open title="Fixture sheet" busy={false} onClose={vi.fn()}>
				<button type="button" aria-label="Dismiss the image">
					×
				</button>
			</PhoneSheet>,
		);
		expect(closeControls(screen.getByTestId("phone-sheet")).length).toBe(1);
	});
});
