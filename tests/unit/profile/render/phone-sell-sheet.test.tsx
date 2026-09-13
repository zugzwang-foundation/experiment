// @vitest-environment jsdom
import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PhoneSellSheet } from "@/components/profile/phone/PhoneSellSheet";

/**
 * MOBILE-2e · R-P3 — the phone's sell sheet, mounted DIRECTLY.
 *
 * ⚠⚠ **DIRECTLY IS A CHOICE, AND THIS DOCBLOCK USED TO CALL IT A NECESSITY.**
 *
 * ⛔ It said the sheet "cannot be reached that way at all", because the host
 * gates it on `useIsPhoneTier()`, which reads a media-query API jsdom does not
 * have. **That is false, and the same branch disproves it.** `useIsPhoneTier`
 * reads `window.matchMedia`; a PER-QUERY stub — the exact technique this branch
 * adds to `tests/unit/ui/info-tip.test.tsx` — answers the tier question `true`
 * and mounts the phone arm through its real host.
 * `tests/unit/profile/render/phone-sell-host.test.tsx` does precisely that.
 *
 * ⛔⛔ The cost of the false premise was not stylistic. It is what let the
 * containment argument be filed as "a source fact", and the source guard that
 * inherited the job did not establish containment at all — a reviewer lifted
 * the sheet clean out of its row and the guard stayed green. **A claim that
 * something is unprovable is a claim with a shelf life, and this one was
 * inherited for two rounds without being retested.**
 *
 * ⇒ What this file is FOR, now that the host file exists: the leaf's own
 * contract, in isolation, where a failure names the leaf rather than the table.
 * Which doors `busy` shuts, what `canSubmit` gates, what the title block bounds,
 * and that every dismissal route lands on the one callback that cancels the arm.
 * The containment argument, the exclusivity of the two arms and the figure that
 * reaches the wire are the HOST file's, and they are runtime assertions there —
 * not source scans anywhere.
 *
 * ⛔ No jest-dom (AGENTS.md §9) — plain DOM assertions only.
 */

const KEY = "01a0-fixture-lot";
/** `PhoneSheet`'s own deferral window — the sheet animates out, then closes. */
const CLOSE_MS = 200;

function mount(overrides: Partial<Parameters<typeof PhoneSellSheet>[0]> = {}) {
	const onClose = vi.fn();
	const onSubmit = vi.fn();
	const onEdit = vi.fn();
	render(
		<PhoneSellSheet
			tileKey={KEY}
			seedDisplay="31"
			seedExact="31.000000000000000000"
			argumentTitle="The resolver's own published series settles this"
			marketTitle="Does the criterion read the revision?"
			draft={null}
			busy={false}
			failed={false}
			canSubmit={true}
			onEdit={onEdit}
			onSubmit={onSubmit}
			onClose={onClose}
			{...overrides}
		/>,
	);
	return { onClose, onSubmit, onEdit };
}

afterEach(cleanup);

describe("MOBILE-2e — the phone sell sheet", () => {
	it("phone-sell::it-says-WHAT-is-being-sold-before-it-asks-for-a-figure", () => {
		mount();
		const body = screen.getByTestId("phone-sheet-body");
		// ⛔ The desktop never needs this: its field opens inside the row, so the
		// row IS the context. A sheet covers the row it came from.
		expect(body.textContent).toContain("The resolver's own published series");
		expect(body.textContent).toContain("Does the criterion read the revision?");
	});

	it("phone-sell::there-is-exactly-ONE-close-control-and-it-is-the-frame-s", () => {
		mount();
		expect(screen.getByTestId(`phone-sell-confirm-${KEY}`).tagName).toBe(
			"BUTTON",
		);
		// ⛔⛔ THE SHEET MUST NOT DRAW ITS OWN CANCEL. `PhoneSheet`'s frame already
		// draws a `×` whenever a title is passed, and a second control beside it is
		// the exact defect `phone-sheet-single-close.test.tsx` was written for —
		// two buttons, 51px apart, both named Close. A draft of this file shipped
		// one, and it also invented a visible `Cancel` string the product does not
		// have (the desktop's own cancel is an icon labelled `Cancel sell`).
		const named = [...document.querySelectorAll("button")].filter(
			(b) =>
				(b.getAttribute("aria-label") ?? b.textContent ?? "")
					.trim()
					.toLowerCase()
					.includes("close") ||
				(b.textContent ?? "").trim().toLowerCase() === "cancel",
		);
		expect(
			named.map((b) => b.getAttribute("data-testid") ?? b.textContent),
			"more than one way out, or none",
		).toEqual(["phone-sheet-close"]);
	});

	it("phone-sell::NEITHER-title-block-is-unbounded", () => {
		// ⛔ The class `@security-auditor` named at MOBILE-2d and left live: an
		// unbounded participant-or-operator string in a title block on a BOUNDED
		// shell is a denial of view. The debate side is safe by a server-side cap
		// on its teaser; the profile's market question has none, so both blocks
		// clamp here. ⚠ jsdom performs no layout, so what this can check is the
		// DECLARATION, which is what a later edit would drop.
		mount({
			argumentTitle: "x".repeat(4000),
			marketTitle: "y".repeat(4000),
		});
		const body = screen.getByTestId("phone-sheet-body");
		// ⛔ LOCATED, not counted. Two `line-clamp-*` classes on ONE span reads as
		// two clamped elements and leaves the other block unbounded.
		const clampedText = [...body.querySelectorAll("span")]
			.filter((el) =>
				el.className.split(/\s+/).some((c) => c.startsWith("line-clamp-")),
			)
			.map((el) => (el.textContent ?? "")[0]);
		expect(
			clampedText.sort(),
			"the argument title and the market question must BOTH clamp, and be two " +
				"DIFFERENT elements — the fixtures are all-x and all-y so this says " +
				"which block each clamp landed on",
		).toEqual(["x", "y"]);
	});

	it("phone-sell::it-says-CURRENT-and-not-a-phrase-invented-for-this-sheet", () => {
		mount();
		// `Current` is the Open tab's own `<th>`, byte-for-byte — the column head
		// the phone LOSES when `<thead>` goes hidden. No new string crosses into
		// the product to give the figure its name back.
		const body = screen.getByTestId("phone-sheet-body");
		expect(body.textContent).toContain("Current");
		expect(body.textContent).not.toContain("Current value");
	});

	/**
	 * ⛔⛔ THE SHEET'S OWN CLOSE IS DEFERRED AND THIS TEST WOULD PASS VACUOUSLY
	 * WITHOUT SAYING SO. `PhoneSheet.beginClose` sets a `leaving` phase and arms a
	 * `setTimeout(…, CLOSE_MS)`; `onClose` fires when that lands, not on the tap.
	 * An assertion written synchronously reads zero calls and is indistinguishable
	 * from "the backdrop is not wired" — so the clock is faked and advanced, and
	 * the Cancel BUTTON (which calls `onClose` directly) is kept in the same row
	 * as the control that proves the difference is the deferral and not the wiring.
	 */
	it("phone-sell::every-dismissal-route-lands-on-the-one-callback-that-cancels", () => {
		vi.useFakeTimers();
		try {
			{
				const { onClose } = mount();
				fireEvent.click(screen.getByTestId("phone-sheet-close"));
				expect(
					onClose,
					"the frame's × fired before its own animation",
				).not.toHaveBeenCalled();
				act(() => {
					vi.advanceTimersByTime(CLOSE_MS);
				});
				expect(onClose, "the frame's ×").toHaveBeenCalledTimes(1);
				cleanup();
			}
			{
				const { onClose } = mount();
				fireEvent.click(screen.getByTestId("phone-sheet-backdrop"));
				expect(
					onClose,
					"the backdrop fired before its own animation",
				).not.toHaveBeenCalled();
				act(() => {
					vi.advanceTimersByTime(CLOSE_MS);
				});
				expect(onClose, "the backdrop").toHaveBeenCalledTimes(1);
				cleanup();
			}
			{
				const { onClose } = mount();
				fireEvent.keyDown(document, { key: "Escape" });
				act(() => {
					vi.advanceTimersByTime(CLOSE_MS);
				});
				expect(onClose, "Escape").toHaveBeenCalledTimes(1);
			}
		} finally {
			vi.useRealTimers();
		}
	});

	it("phone-sell::BUSY-shuts-every-door-in-the-sheet", () => {
		// ⛔ `try/finally`, like the two rows either side of it. Without it a
		// failure HERE leaks fake timers into every later row in the file, so the
		// first real failure arrives wearing a train of false ones and the
		// diagnosis names the wrong row (O-3).
		vi.useFakeTimers();
		try {
			const { onClose, onSubmit } = mount({ busy: true });
			// ⛔ Not a new mechanism: `PhoneSheet` already re-checks `busy` at each of
			// its doors, and the two buttons here are disabled by the same flag. What
			// this row proves is that the flag was WIRED, which is the part that can be
			// forgotten in a way nothing else observes.
			const confirm = screen.getByTestId(
				`phone-sell-confirm-${KEY}`,
			) as HTMLButtonElement;
			const close = screen.getByTestId(
				"phone-sheet-close",
			) as HTMLButtonElement;
			expect(confirm.disabled, "Confirm stays live during a sell").toBe(true);
			expect(close.disabled, "the frame's × stays live during a sell").toBe(
				true,
			);
			fireEvent.click(screen.getByTestId("phone-sheet-backdrop"));
			fireEvent.keyDown(document, { key: "Escape" });
			expect(
				onClose,
				"a sell in flight can still be dismissed out from under itself",
			).not.toHaveBeenCalled();
			fireEvent.click(confirm);
			act(() => {
				vi.advanceTimersByTime(CLOSE_MS * 4);
			});
			expect(onSubmit, "a disabled Confirm still fired").not.toHaveBeenCalled();
			expect(
				onClose,
				"the deferred close committed anyway once the timer landed",
			).not.toHaveBeenCalled();
			// ⛔ AND THE FIELD ITSELF. `disabled={props.busy}` on the shared amount
			// input can be set `false` with every other assertion in this row still
			// passing — the figure stays editable while the request that quotes it is
			// in flight, so the reader edits a number that has already been sent.
			expect(
				(screen.getByTestId(`tile-sell-amount-${KEY}`) as HTMLInputElement)
					.disabled,
				"the amount is still editable mid-request",
			).toBe(true);
		} finally {
			vi.useRealTimers();
		}
	});

	it("phone-sell::POSITIVE-CONTROL-the-same-doors-are-OPEN-when-it-is-not-busy", () => {
		// ⛔ Without this the row above passes just as well against a sheet whose
		// doors are nailed shut in every state.
		vi.useFakeTimers();
		try {
			const { onClose, onSubmit } = mount({ busy: false });
			const confirm = screen.getByTestId(
				`phone-sell-confirm-${KEY}`,
			) as HTMLButtonElement;
			expect(confirm.disabled).toBe(false);
			fireEvent.click(confirm);
			expect(onSubmit).toHaveBeenCalledTimes(1);
			fireEvent.keyDown(document, { key: "Escape" });
			act(() => {
				vi.advanceTimersByTime(CLOSE_MS);
			});
			expect(onClose).toHaveBeenCalledTimes(1);
		} finally {
			vi.useRealTimers();
		}
	});

	it("phone-sell::CONFIRM-is-gated-on-canSubmit-and-says-Retry-after-a-refusal", () => {
		// A lot whose share of the mark falls below one 1e-18 quantum seeds
		// canonical zero and `sellSharesFor` throws — the catch is the belt, the
		// disable is the affordance.
		mount({ canSubmit: false });
		expect(
			(screen.getByTestId(`phone-sell-confirm-${KEY}`) as HTMLButtonElement)
				.disabled,
		).toBe(true);
		cleanup();
		mount({ failed: true });
		expect(screen.getByTestId(`phone-sell-confirm-${KEY}`).textContent).toBe(
			"Retry",
		);
		cleanup();
		mount({ busy: true });
		expect(screen.getByTestId(`phone-sell-confirm-${KEY}`).textContent).toBe(
			"…",
		);
	});

	it("phone-sell::the-field-is-the-SHARED-one-and-it-submits-the-EXACT-seed", () => {
		const { onEdit } = mount();
		// ⚠ The testid is ON the input, not on a wrapper — `InlineSell.tsx:564`.
		// The `Đ` is a SIBLING span, so the field's value is the bare figure.
		const input = screen.getByTestId(
			`tile-sell-amount-${KEY}`,
		) as HTMLInputElement;
		expect(input.tagName, "the shared amount field did not mount").toBe(
			"INPUT",
		);
		// ⛔ The field SHOWS the rounded figure and SUBMITS the exact one. Editing
		// hands the exact seed back so the controller can tell an untouched field
		// from a typed one — submitting the displayed figure strands dust, which is
		// what `sell.test.tsx`'s own control test exists to prove.
		expect(input.value).toBe("31");
		fireEvent.change(input, { target: { value: "12" } });
		expect(onEdit).toHaveBeenCalled();
		expect(onEdit.mock.calls[0]?.[1]).toBe("31.000000000000000000");
	});
});
