// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PhoneDebateView } from "@/components/debate/phone/PhoneDebateView";

import { modelWith, post, stubElementScroll, VIEWER } from "./_fixtures";

vi.mock("next/navigation", () => ({
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
		expect(sheet.getAttribute("aria-label")).toBe("Market");
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
