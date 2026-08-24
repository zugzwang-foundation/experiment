// @vitest-environment jsdom

import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
	ComposerSlot,
	type SlotState,
} from "@/components/debate/composer/ComposerSlot";

/**
 * UI-QUICK change set 4 — the two VERIFICATION DEBTS on `ComposerSlot`, plus the
 * R6 freeze tail. FEED-1 adds the third state.
 *
 * ⚠⚠ WHY THIS FILE EXISTS AT ALL, stated plainly: change set 3 reported the
 * in-flight short-circuit as "source-verified" — I read the branch and asserted
 * it was there. **Asserting a branch EXISTS is not asserting it FIRES** (V-3),
 * and this is the one safety-critical row in that section: it is what stops a
 * live money path being held mounted for a quarter-second so a panel can look
 * nice on its way out. A branch that exists but is unreachable — wrong guard
 * order, a stale dep, a `busy` that never arrives — reads identically in source
 * and behaves catastrophically differently. So it is exercised here.
 *
 * ⚠ `ComposerSlot` is testable in isolation precisely because it holds no
 * server import and no business logic: it takes three `ReactNode`s, a state
 * name and a boolean. That is the payoff for it being a wrapper rather than a
 * modification of `BetComposer` — the money path is NOT touched by any test in
 * this file, and none of it needs mocking.
 *
 * ⚠ Fake timers throughout, because the whole subject is a 260ms hold. Real
 * timers here would either make the suite slow or make it flaky, and both
 * failure modes look like a passing test on a fast machine.
 *
 * No jest-dom in this repo (AGENTS.md §9) — plain DOM assertions only.
 */

const EXIT_MS = 260;

const SCROLLER = <p data-testid="probe-scroller">scroller</p>;
const COMPOSER = (
	<form data-testid="probe-composer">
		<button type="button" data-testid="probe-composer-control">
			a control
		</button>
	</form>
);
const CONFIRMATION = (
	<section data-testid="probe-confirmation">
		<button type="button" data-testid="probe-confirmation-control">
			dismiss
		</button>
	</section>
);

beforeEach(() => {
	vi.useFakeTimers();
	// ⛔ `prefersReducedMotion()` short-circuits the exit exactly as `busy` does,
	// so a jsdom default of "reduce" would make every exit-timing assertion below
	// pass for the WRONG reason. Pinned to "no preference" so the animated path is
	// the one under test; the reduced-motion path gets its own case.
	vi.stubGlobal("matchMedia", (q: string) => ({
		matches: false,
		media: q,
		onchange: null,
		addListener: () => {},
		removeListener: () => {},
		addEventListener: () => {},
		removeEventListener: () => {},
		dispatchEvent: () => false,
	}));
});

afterEach(() => {
	cleanup();
	vi.useRealTimers();
	vi.unstubAllGlobals();
});

/** The occupant each slot value is given — mirrors what `DebateView` passes. */
function slotProps(slot: SlotState) {
	return {
		slot,
		composer: slot === "composer" ? COMPOSER : null,
		confirmation: slot === "confirmed" ? CONFIRMATION : null,
	};
}

function renderSlot(props: {
	slot: SlotState;
	busy?: boolean;
	onOccupiedChange?: (id: string, occupied: boolean) => void;
}) {
	return render(
		<ComposerSlot
			slotId="YES"
			busy={props.busy ?? false}
			scroller={SCROLLER}
			onOccupiedChange={props.onOccupiedChange}
			{...slotProps(props.slot)}
		/>,
	);
}

/** A rerender at a new slot value, with the occupants that value implies. */
function rerenderSlot(
	rerender: (ui: React.ReactElement) => void,
	props: {
		slot: SlotState;
		busy?: boolean;
		onOccupiedChange?: (id: string, occupied: boolean) => void;
	},
) {
	rerender(
		<ComposerSlot
			slotId="YES"
			busy={props.busy ?? false}
			scroller={SCROLLER}
			onOccupiedChange={props.onOccupiedChange}
			{...slotProps(props.slot)}
		/>,
	);
}

describe("f1 — the in-flight short-circuit FIRES, not merely exists", () => {
	it("composer-slot::a-normal-close-HOLDS-the-corpse-for-the-exit", () => {
		// The positive control. Without it, the `busy` assertion below could pass
		// on a component that never animates an exit at all — which would be the
		// same green for the opposite reason.
		const { container, rerender } = renderSlot({ slot: "composer" });
		expect(
			container.querySelector('[data-testid="probe-composer"]'),
		).not.toBeNull();

		rerenderSlot(rerender, { slot: "scroller" });

		// Still mounted mid-exit, and marked as leaving.
		const slot = container.querySelector('[data-testid="composer-slot"]');
		expect(slot).not.toBeNull();
		expect(slot?.getAttribute("data-state")).toBe("closed");
		expect(
			container.querySelector('[data-testid="probe-composer"]'),
		).not.toBeNull();

		act(() => {
			vi.advanceTimersByTime(EXIT_MS);
		});
		expect(container.querySelector('[data-testid="composer-slot"]')).toBeNull();
		expect(
			container.querySelector('[data-testid="probe-scroller"]'),
		).not.toBeNull();
	});

	it("composer-slot::a-close-WITH-A-SUBMIT-IN-FLIGHT-unmounts-IMMEDIATELY", () => {
		// ⛔⛔ THE SAFETY-CRITICAL ROW. A live money path must never be held mounted
		// for a transition. No timer is advanced anywhere in this test: if the
		// composer is gone, it went synchronously.
		const { container, rerender } = renderSlot({
			slot: "composer",
			busy: true,
		});
		expect(
			container.querySelector('[data-testid="probe-composer"]'),
		).not.toBeNull();

		rerenderSlot(rerender, { slot: "scroller", busy: true });

		expect(container.querySelector('[data-testid="composer-slot"]')).toBeNull();
		expect(
			container.querySelector('[data-testid="probe-composer"]'),
		).toBeNull();
		expect(
			container.querySelector('[data-testid="probe-scroller"]'),
		).not.toBeNull();
	});

	it("composer-slot::reduced-motion-also-unmounts-IMMEDIATELY", () => {
		vi.stubGlobal("matchMedia", (q: string) => ({
			matches: true,
			media: q,
			onchange: null,
			addListener: () => {},
			removeListener: () => {},
			addEventListener: () => {},
			removeEventListener: () => {},
			dispatchEvent: () => false,
		}));
		const { container, rerender } = renderSlot({ slot: "composer" });
		rerenderSlot(rerender, { slot: "scroller" });
		// ⚠ Not "no translate" — that is a CSS claim jsdom cannot evaluate. The
		// assertion is the one that MATTERS and that jsdom CAN see: reduced motion
		// gets an instant swap, not a motionless 260ms stall.
		expect(container.querySelector('[data-testid="composer-slot"]')).toBeNull();
	});
});

describe("R6 — the freeze tail cannot outlive the unmount", () => {
	it("composer-slot::occupancy-stays-true-through-the-exit-and-clears-WITH-it", () => {
		const reports: Array<[string, boolean]> = [];
		const onOccupiedChange = (id: string, occupied: boolean) => {
			reports.push([id, occupied]);
		};

		const { container, rerender } = renderSlot({
			slot: "composer",
			onOccupiedChange,
		});
		expect(reports.at(-1)).toEqual(["YES", true]);

		rerenderSlot(rerender, { slot: "scroller", onOccupiedChange });

		// ⚠ THE TAIL ITSELF: dismissed, but still occupying. This is the window in
		// which the carousel used to resume while the panel was still leaving.
		expect(reports.at(-1)).toEqual(["YES", true]);
		expect(
			container.querySelector('[data-testid="composer-slot"]'),
		).not.toBeNull();

		act(() => {
			vi.advanceTimersByTime(EXIT_MS);
		});

		// ⛔⛔ THE ASSERTION THIS SECTION EXISTS FOR — the release and the unmount
		// are the SAME event, not two that must be kept in step. Read together, in
		// one tick: if occupancy could outlive the corpse (a separate timer, a
		// second flag), exactly one of these two would fail.
		expect(reports.at(-1)).toEqual(["YES", false]);
		expect(container.querySelector('[data-testid="composer-slot"]')).toBeNull();
	});

	it("composer-slot::being-UNMOUNTED-while-occupied-still-releases-the-freeze", () => {
		// ⛔ THE FREEZE-FOREVER FAILURE MODE, exercised directly. An arm swap or a
		// post enter/exit tears this component down mid-life; no effect of its own
		// would ever run again to report `false`, so the predicate upstream would
		// stay true with NOTHING on screen to explain the stopped carousel. The
		// unmount cleanup is the only thing that closes this, and removing it turns
		// this red while every other test in the file stays green.
		const reports: Array<[string, boolean]> = [];
		const { unmount } = renderSlot({
			slot: "composer",
			onOccupiedChange: (id, occupied) => reports.push([id, occupied]),
		});
		expect(reports.at(-1)).toEqual(["YES", true]);

		unmount();

		expect(reports.at(-1)).toEqual(["YES", false]);
	});
});

describe("FEED-1 — the third state", () => {
	it("composer-slot::confirmed-swaps-the-occupant-and-names-itself", () => {
		const { container, rerender } = renderSlot({ slot: "composer" });
		expect(
			container
				.querySelector('[data-testid="composer-slot"]')
				?.getAttribute("data-state"),
		).toBe("open");

		rerenderSlot(rerender, { slot: "confirmed" });

		const slot = container.querySelector('[data-testid="composer-slot"]');
		// The state NAME is the contract the stylesheet keys on and the only thing
		// distinguishing this from an open composer in the DOM.
		expect(slot?.getAttribute("data-state")).toBe("confirmed");
		// ⛔ The composer is GONE, not merely covered. A live money form left
		// mounted underneath a confirmation is a second instance of the thing the
		// in-flight short-circuit above exists to prevent.
		expect(
			container.querySelector('[data-testid="probe-composer"]'),
		).toBeNull();
		expect(
			container.querySelector('[data-testid="probe-confirmation"]'),
		).not.toBeNull();
	});

	it("composer-slot::confirmed-renders-ONLY-the-confirmation-when-BOTH-are-passed", () => {
		// ⛔⛔ THE PROP SHAPE `DebateView` ACTUALLY PASSES, which is NOT the one
		// `slotProps` above models. In the host, `composer` is built from
		// `hosts && openSide !== null` and `openSide` is HELD across the confirmed
		// state — so while `slot="confirmed"` the host is still handing this
		// component a LIVE `<BetComposer>` element. `slotProps` passes `null`
		// there, which makes the sibling test's "the composer is GONE" assertion
		// true by construction: it is asserting the absence of something the test
		// never supplied.
		//
		// ⇒ Measured: with `live` changed to render `<>{composer}{confirmation}</>`
		// while confirmed, every one of the nine tests in this file stayed GREEN.
		// This is the one that goes red — and it is the row that matters, because
		// what is left mounted is a live money form with its own submit control.
		const { container, rerender } = render(
			<ComposerSlot
				slotId="YES"
				busy={false}
				scroller={SCROLLER}
				slot="composer"
				composer={COMPOSER}
				confirmation={null}
			/>,
		);
		rerender(
			<ComposerSlot
				slotId="YES"
				busy={false}
				scroller={SCROLLER}
				slot="confirmed"
				composer={COMPOSER}
				confirmation={CONFIRMATION}
			/>,
		);

		expect(
			container.querySelector('[data-testid="probe-confirmation"]'),
		).not.toBeNull();
		expect(
			container.querySelector('[data-testid="probe-composer"]'),
			"the composer is UNMOUNTED, not merely covered — it is still being passed",
		).toBeNull();
		// The submit-bearing control specifically: a form left mounted with a live
		// control is the second instance the in-flight short-circuit exists to stop.
		expect(
			container.querySelector('[data-testid="probe-composer-control"]'),
		).toBeNull();
	});

	it("composer-slot::the-exit-corpse-is-the-CONFIRMATION-not-the-composer", () => {
		// ⛔⛔ THE GUARD FOR THE ONE GENUINELY BINARY LINE IN THE HOLD. `held` used
		// to latch off `composer` alone. With a third occupant that reads as: the
		// author dismisses their own post and the FORM THEY ALREADY SUBMITTED
		// slides away in its place for 260ms. Nothing errors; it just shows the
		// wrong thing on the way out.
		const { container, rerender } = renderSlot({ slot: "composer" });
		rerenderSlot(rerender, { slot: "confirmed" });
		rerenderSlot(rerender, { slot: "scroller" });

		const slot = container.querySelector('[data-testid="composer-slot"]');
		expect(slot).not.toBeNull();
		expect(slot?.getAttribute("data-state")).toBe("closed");
		expect(
			container.querySelector('[data-testid="probe-confirmation"]'),
		).not.toBeNull();
		expect(
			container.querySelector('[data-testid="probe-composer"]'),
		).toBeNull();

		// …and it still takes the ratified 260ms to leave.
		act(() => {
			vi.advanceTimersByTime(EXIT_MS - 1);
		});
		expect(
			container.querySelector('[data-testid="composer-slot"]'),
		).not.toBeNull();
		act(() => {
			vi.advanceTimersByTime(1);
		});
		expect(container.querySelector('[data-testid="composer-slot"]')).toBeNull();
	});

	it("composer-slot::occupancy-NEVER-drops-across-the-composer-to-confirmed-swap", () => {
		// ⛔ The whole reason the confirmation is modelled as "still occupied": a
		// single `false` here would release `frozen` for one commit and let the
		// carousel step a card underneath the author mid-swap.
		const reports: Array<[string, boolean]> = [];
		const onOccupiedChange = (id: string, occupied: boolean) => {
			reports.push([id, occupied]);
		};
		const { rerender } = renderSlot({ slot: "composer", onOccupiedChange });
		const beforeSwap = reports.length;

		rerenderSlot(rerender, { slot: "confirmed", onOccupiedChange });

		expect(reports.slice(beforeSwap).some(([, held]) => held === false)).toBe(
			false,
		);
		expect(reports.at(-1)).toEqual(["YES", true]);
	});

	it("composer-slot::focus-MOVES-into-the-confirmation-and-restores-to-the-ORIGINAL-opener", () => {
		// The opener: a real, focused control outside the slot, so the restore has
		// somewhere true to go back to.
		const opener = document.createElement("button");
		opener.setAttribute("data-testid", "probe-opener");
		document.body.append(opener);
		opener.focus();
		expect(document.activeElement).toBe(opener);

		const { container, rerender } = renderSlot({ slot: "composer" });
		// The composer's own control takes focus (the change set 3 rule).
		expect(document.activeElement).toBe(
			container.querySelector('[data-testid="probe-composer-control"]'),
		);

		rerenderSlot(rerender, { slot: "confirmed" });
		// ⛔ WITHOUT the slot-keyed `moved` ref this lands on <body>: the swap is
		// not a new "open", so a boolean suppresses the move entirely and a
		// keyboard reader is left nowhere.
		//
		// ⚠⚠ THIS ASSERTION WAS WRITTEN WRONG FIRST, AND THE REVERT IS WHAT CAUGHT
		// IT. It read `expect(document.activeElement?.textContent).toBe("dismiss")`
		// — which PASSES on `<body>`, because body's flattened `textContent` at
		// this moment IS the string "dismiss". A guard for a focus bug that could
		// not see the focus bug. ⇒ Identity against a `data-testid` node, never
		// text (O-7), plus the explicit `<body>` rejection below.
		expect(document.activeElement).not.toBe(document.body);
		expect(document.activeElement).toBe(
			container.querySelector('[data-testid="probe-confirmation-control"]'),
		);

		rerenderSlot(rerender, { slot: "scroller" });
		act(() => {
			vi.advanceTimersByTime(EXIT_MS);
		});
		// ⛔ THE ORIGINAL opener, not the composer's submit control. `opener` is
		// captured only while null, so the confirmation swap cannot overwrite it.
		expect(document.activeElement).toBe(opener);
		opener.remove();
	});
});
