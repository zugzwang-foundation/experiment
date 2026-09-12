// @vitest-environment jsdom

import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PhoneDebateView } from "@/components/debate/phone/PhoneDebateView";
import { PhoneSheet } from "@/components/debate/phone/PhoneSheet";

import {
	dialogName,
	modelWith,
	post,
	stubElementScroll,
	VIEWER,
} from "./_fixtures";

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

const POSTS = [post({ id: "p1", ordinal: 1, side: "YES" })];

function mount(details: React.ReactNode = <p>DETAILS-SENTINEL</p>) {
	return render(
		<PhoneDebateView
			model={modelWith(POSTS)}
			viewer={VIEWER}
			initialPostId={null}
			ownPseudonym={null}
			details={details}
		/>,
	);
}

/**
 * MOBILE-2 guard 15 — the strip announces that it opens something, and the sheet
 * announces that it is a dialog and can be left by keyboard.
 *
 * ⛔ THE WRONG ANSWER IS A SHEET NOBODY CAN LEAVE WITHOUT A POINTER. A
 * full-height overlay with no Escape and an unlabelled close is a trap on the
 * one device class where "click outside" is the least discoverable gesture
 * there is.
 */
describe("phone sheet — the strip and the dialog announce themselves (guard 15)", () => {
	it("phone-sheet::the-strip-is-a-button-whose-aria-expanded-tracks-the-sheet", () => {
		mount();
		const strip = screen.getByTestId("phone-title-strip");
		// A native <button> — so it is focusable, fires on Enter AND Space, and is
		// announced as a button, none of which a `div role="button"` gets free.
		expect(strip.tagName).toBe("BUTTON");
		expect(strip.getAttribute("aria-expanded")).toBe("false");
		fireEvent.click(strip);
		expect(
			screen.getByTestId("phone-title-strip").getAttribute("aria-expanded"),
		).toBe("true");
	});

	it("phone-sheet::the-details-sheet-is-a-modal-dialog-carrying-the-server-children", () => {
		mount();
		fireEvent.click(screen.getByTestId("phone-title-strip"));
		const sheet = screen.getByTestId("phone-sheet");
		expect(sheet.getAttribute("role")).toBe("dialog");
		expect(sheet.getAttribute("aria-modal")).toBe("true");
		expect(dialogName(sheet)).toBe("Market");
		// The RSC children reach the sheet body unchanged.
		expect(screen.getByTestId("phone-sheet-body").textContent).toContain(
			"DETAILS-SENTINEL",
		);
	});

	it("phone-sheet::the-details-body-is-NOT-mounted-until-the-sheet-is-first-opened", () => {
		// RF-7 — a reader who never opens the sheet never pays for what is inside
		// it, the price chart included.
		mount();
		expect(screen.queryByText("DETAILS-SENTINEL")).toBeNull();
		fireEvent.click(screen.getByTestId("phone-title-strip"));
		expect(screen.queryByText("DETAILS-SENTINEL")).not.toBeNull();
	});

	it("phone-sheet::Escape-closes-it-and-the-close-control-is-labelled", () => {
		// ⚠ THE CLOSE IS ANIMATED SINCE MOBILE-2c R-4, so it takes the 200ms slide
		// to reach the host. The sheet under test here is the DETAILS sheet, which
		// keeps the frame's `×` because it brings no header of its own (R-8).
		vi.useFakeTimers();
		try {
			mount();
			fireEvent.click(screen.getByTestId("phone-title-strip"));
			expect(
				screen.getByTestId("phone-sheet-close").getAttribute("aria-label"),
			).toBe("Close");
			fireEvent.keyDown(document, { key: "Escape" });
			act(() => {
				vi.advanceTimersByTime(200);
			});
			expect(screen.queryByTestId("phone-sheet")).toBeNull();
			// POSITIVE CONTROL — the listener is document-scoped and live, so a key
			// that is NOT Escape leaves the sheet open rather than everything closing
			// it. ⚠ It advances the SAME 200ms, so it cannot pass merely by being
			// read too early.
			fireEvent.click(screen.getByTestId("phone-title-strip"));
			fireEvent.keyDown(document, { key: "a" });
			act(() => {
				vi.advanceTimersByTime(200);
			});
			expect(screen.queryByTestId("phone-sheet")).not.toBeNull();
		} finally {
			vi.useRealTimers();
		}
	});

	/**
	 * ⛔⛔ THE BUSY REFUSAL IS A MONEY RULE AND NOTHING WAS ASSERTING IT.
	 * `PhoneSheet.tsx`'s own docblock states why: a mid-request unmount followed
	 * by a re-open mints a FRESH idempotency key over a bet that may already be
	 * committing, i.e. it converts a retry into a SECOND CHARGE. The sheet has
	 * three doors the desktop slot does not (`×`, Escape, the backdrop) and all
	 * three are shut by one flag — so all three are exercised here, plus the
	 * owner's own `closeSheet`. Measured: stripping `!busyRef.current` from the
	 * Escape handler, and stripping `!composerBusy` from `closeSheet`, each left
	 * all twenty-four MOBILE-2 rows green.
	 */
	it("phone-sheet::busy-shuts-every-door", () => {
		const onClose = vi.fn();
		render(
			<PhoneSheet open title="Busy" busy onClose={onClose}>
				<p>BUSY-BODY</p>
			</PhoneSheet>,
		);
		fireEvent.keyDown(document, { key: "Escape" });
		fireEvent.click(screen.getByTestId("phone-sheet-backdrop"));
		expect(onClose).not.toHaveBeenCalled();
		// The × is shut by `disabled` rather than by a handler branch, so it is
		// asserted as an attribute — a click on a disabled control proves nothing.
		expect(
			screen.getByTestId("phone-sheet-close").hasAttribute("disabled"),
		).toBe(true);
	});

	it("phone-sheet::not-busy-every-door-opens", () => {
		// POSITIVE CONTROL for the row above — without it, a sheet whose backdrop
		// and Escape listener were never wired at all would satisfy every
		// assertion in it.
		// ⚠ ONE DOOR PER SHEET, AND ONE CALL PER DOOR. R-4's animated close makes
		// the close idempotent within its own 200ms window, so three pushes at one
		// sheet is now one call rather than three. `busy-interlock.test.tsx`
		// asserts that directly.
		vi.useFakeTimers();
		try {
			for (const push of [
				() => fireEvent.keyDown(document, { key: "Escape" }),
				() => fireEvent.click(screen.getByTestId("phone-sheet-backdrop")),
				() => fireEvent.click(screen.getByTestId("phone-sheet-close")),
			]) {
				const onClose = vi.fn();
				render(
					<PhoneSheet open title="Idle" busy={false} onClose={onClose}>
						<p>IDLE-BODY</p>
					</PhoneSheet>,
				);
				push();
				act(() => {
					vi.advanceTimersByTime(200);
				});
				expect(onClose).toHaveBeenCalledTimes(1);
				cleanup();
			}
		} finally {
			vi.useRealTimers();
		}
	});

	it("phone-sheet::body-scroll-is-locked-while-open-and-restored-on-close", () => {
		// The lock is what stops the page behind the sheet scrolling under the
		// reader's thumb; restoring the PREVIOUS value (not "") is what stops the
		// first sheet a reader opens from silently resetting a page that set its
		// own overflow.
		//
		// ⛔⛔ AND A LOCK THAT IS NOT RESTORED IS MOBILE-2c's P0. A `fixed inset-0`
		// sheet over a locked page takes away vertical scrolling AND the tabs at
		// once, and the reader has no way to see that a modal is why. Measured on
		// a Pixel-class Chromium: `bodyOverflow: hidden` with `sheetOpen: 1` at
		// every dead cell. The lock is correct; what was broken was the sheet not
		// closing — but the restore is what makes the correct close correct, so it
		// is asserted ACROSS the animation window rather than before it.
		vi.useFakeTimers();
		try {
			document.body.style.overflow = "clip";
			mount();
			fireEvent.click(screen.getByTestId("phone-title-strip"));
			expect(document.body.style.overflow).toBe("hidden");
			fireEvent.keyDown(document, { key: "Escape" });
			// ⚠ STILL LOCKED MID-SLIDE, deliberately: the sheet is on screen for
			// another 200ms and the page behind it must not start moving under it.
			expect(document.body.style.overflow).toBe("hidden");
			act(() => {
				vi.advanceTimersByTime(200);
			});
			expect(document.body.style.overflow).toBe("clip");
		} finally {
			document.body.style.overflow = "";
			vi.useRealTimers();
		}
	});
});
