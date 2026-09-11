// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PhoneSheet } from "@/components/debate/phone/PhoneSheet";

import { stubElementScroll } from "./_fixtures";

stubElementScroll();

afterEach(() => {
	cleanup();
	vi.clearAllMocks();
});

/**
 * MOBILE-2 — the busy interlock, which is a MONEY RULE wearing a UI costume.
 *
 * ⛔⛔ WHAT IT PREVENTS, because "the sheet does not close" understates it by a
 * lot. `BetComposer`'s `key` in the phone tree carries `kind`, `parentCommentId`
 * and `side`, so any host transition that changes one REMOUNTS it. A fresh
 * instance mints a fresh idempotency key at mount; the in-flight `fetch` carries
 * no `AbortController`; and the unmount fires `onBusyChange(false)`, so the host
 * stops believing anything is in flight. The first request still commits
 * server-side, and the resubmit carries a key `bet_receipts`' UNIQUE cannot
 * dedupe (ADR-0031). One intent, two bets, two charges.
 *
 * `DebateView.tsx:155-159` states the same rule for the desktop, which guards
 * SIX host paths. The phone's first cut guarded one, and both reviewers found
 * it independently. The host's own guard is asserted in
 * `entry-bar.test.tsx`; this file asserts the three doors the SHEET owns.
 *
 * ⚠ THE CONTROL IS THE LOAD-BEARING HALF. A listener that was never armed
 * satisfies every "did not close" assertion below without exercising anything —
 * which is exactly how a guard about a refusal passes against a broken build. So
 * every refusal is paired with the same door proving it OPENS when not busy.
 */
function mount(busy: boolean, onClose = vi.fn()) {
	render(
		<PhoneSheet
			open
			title="Fixture sheet"
			busy={busy}
			fullHeight={false}
			onClose={onClose}
		>
			<button type="button">inside</button>
		</PhoneSheet>,
	);
	return onClose;
}

describe("phone sheet — busy shuts every door the sheet owns", () => {
	it("phone-sheet::busy-refuses-Escape-the-backdrop-and-disables-the-close", () => {
		const onClose = mount(true);
		fireEvent.keyDown(document, { key: "Escape" });
		expect(onClose).not.toHaveBeenCalled();
		fireEvent.click(screen.getByTestId("phone-sheet-backdrop"));
		expect(onClose).not.toHaveBeenCalled();
		// ⚠ ASSERTED BY THE ATTRIBUTE, NOT BY CLICKING. Clicking a disabled control
		// proves nothing — jsdom dispatches the event either way and the handler
		// simply is not wired. The attribute is the refusal.
		expect(
			screen.getByTestId("phone-sheet-close").hasAttribute("disabled"),
		).toBe(true);
	});

	it("phone-sheet::NOT-busy-every-one-of-those-doors-opens", () => {
		// THE CONTROL. Without it the row above passes against a sheet whose
		// listeners were never armed at all.
		const onClose = mount(false);
		fireEvent.keyDown(document, { key: "Escape" });
		expect(onClose).toHaveBeenCalledTimes(1);
		fireEvent.click(screen.getByTestId("phone-sheet-backdrop"));
		expect(onClose).toHaveBeenCalledTimes(2);
		expect(
			screen.getByTestId("phone-sheet-close").hasAttribute("disabled"),
		).toBe(false);
		fireEvent.click(screen.getByTestId("phone-sheet-close"));
		expect(onClose).toHaveBeenCalledTimes(3);
	});
});

describe("phone sheet — aria-modal is backed by containment, not asserted", () => {
	/**
	 * ⛔ `aria-modal` CONSTRAINS A SCREEN READER'S VIRTUAL CURSOR AND NOTHING
	 * ELSE. It has no effect on Tab. A dialog that declares it without containing
	 * focus tells an AT user the background is inert and then lets them walk
	 * straight into it — and on this surface the background's controls are the
	 * ones that remount the composer, which is how the a11y defect and the money
	 * defect turned out to be the same defect.
	 */
	it("phone-sheet::focus-moves-INTO-the-panel-on-open", () => {
		mount(false);
		// ⚠ THE FIRST FOCUSABLE IN THE PANEL, which is the `×` — it precedes the
		// body in DOM order. This row asserted `inside` at first and was wrong
		// about the component rather than the other way round; recorded because
		// "focus moved somewhere inside" is the weaker claim and this is the
		// stronger one.
		expect(document.activeElement).toBe(
			screen.getByTestId("phone-sheet-close"),
		);
		expect(
			screen
				.getByTestId("phone-sheet")
				.contains(document.activeElement as Node),
		).toBe(true);
	});

	it("phone-sheet::Tab-off-the-last-control-wraps-to-the-first", () => {
		mount(false);
		const inside = screen.getByText("inside");
		const close = screen.getByTestId("phone-sheet-close");
		// The `×` precedes the body in DOM order, so `inside` is the LAST
		// focusable and Tab off it must wrap back to the `×`.
		inside.focus();
		fireEvent.keyDown(document, { key: "Tab" });
		expect(document.activeElement).toBe(close);
	});

	it("phone-sheet::the-backdrop-is-not-a-second-tab-stop-named-Close", () => {
		mount(false);
		const backdrop = screen.getByTestId("phone-sheet-backdrop");
		expect(backdrop.getAttribute("tabindex")).toBe("-1");
		expect(backdrop.getAttribute("aria-hidden")).toBe("true");
		// POSITIVE CONTROL — the × IS a named, reachable control, so "unnamed and
		// unreachable" above is a fact about the backdrop and not about the query.
		const close = screen.getByTestId("phone-sheet-close");
		expect(close.getAttribute("aria-label")).toBe("Close");
		expect(close.getAttribute("tabindex")).toBeNull();
	});

	it("phone-sheet::focus-returns-to-the-opener-on-close", () => {
		render(
			<div>
				<button type="button" data-testid="opener">
					open
				</button>
			</div>,
		);
		const opener = screen.getByTestId("opener");
		opener.focus();
		expect(document.activeElement).toBe(opener);
		const { unmount } = render(
			<PhoneSheet
				open
				title="Fixture sheet"
				busy={false}
				fullHeight={false}
				onClose={vi.fn()}
			>
				<button type="button">inside</button>
			</PhoneSheet>,
		);
		expect(document.activeElement).toBe(
			screen.getByTestId("phone-sheet-close"),
		);
		unmount();
		expect(document.activeElement).toBe(opener);
	});
});
