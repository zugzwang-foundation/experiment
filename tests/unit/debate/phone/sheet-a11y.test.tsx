// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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

// ⚠ `useParams` IS NOT SPARE — a factory mock REPLACES the module, so every
// export the tree reaches has to be listed here or the import throws. The phone
// bar's tree reaches `DownloadPostImage`, which reads the slug off the route,
// and this file mocked `useRouter` alone: the whole suite died on
// `No "useParams" export is defined on the "next/navigation" mock`.
// ⚠ IT RETURNS THE FIXTURE'S OWN SLUG rather than an empty object, because the
// control renders as an inert, disabled placeholder when there is no slug —
// which would quietly test the wrong branch of a component these guards mount
// but do not otherwise exercise.
vi.mock("next/navigation", () => ({
	useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
	useParams: () => ({ slug: "bitcoin-price-50k" }),
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
		mount();
		fireEvent.click(screen.getByTestId("phone-title-strip"));
		expect(
			screen.getByTestId("phone-sheet-close").getAttribute("aria-label"),
		).toBe("Close");
		fireEvent.keyDown(document, { key: "Escape" });
		expect(screen.queryByTestId("phone-sheet")).toBeNull();
		// POSITIVE CONTROL — the listener is document-scoped and live, so a key
		// that is NOT Escape leaves the sheet open rather than everything closing
		// it.
		fireEvent.click(screen.getByTestId("phone-title-strip"));
		fireEvent.keyDown(document, { key: "a" });
		expect(screen.queryByTestId("phone-sheet")).not.toBeNull();
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
			<PhoneSheet open title="Busy" busy fullHeight onClose={onClose}>
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
		const onClose = vi.fn();
		render(
			<PhoneSheet open title="Idle" busy={false} fullHeight onClose={onClose}>
				<p>IDLE-BODY</p>
			</PhoneSheet>,
		);
		fireEvent.keyDown(document, { key: "Escape" });
		expect(onClose).toHaveBeenCalledTimes(1);
		fireEvent.click(screen.getByTestId("phone-sheet-backdrop"));
		expect(onClose).toHaveBeenCalledTimes(2);
		fireEvent.click(screen.getByTestId("phone-sheet-close"));
		expect(onClose).toHaveBeenCalledTimes(3);
	});

	it("phone-sheet::body-scroll-is-locked-while-open-and-restored-on-close", () => {
		// The lock is what stops the page behind a full-height sheet scrolling
		// under the reader's thumb; restoring the PREVIOUS value (not "") is what
		// stops the first sheet a reader opens from silently resetting a page that
		// set its own overflow.
		document.body.style.overflow = "clip";
		mount();
		fireEvent.click(screen.getByTestId("phone-title-strip"));
		expect(document.body.style.overflow).toBe("hidden");
		fireEvent.keyDown(document, { key: "Escape" });
		expect(document.body.style.overflow).toBe("clip");
		document.body.style.overflow = "";
	});
});
