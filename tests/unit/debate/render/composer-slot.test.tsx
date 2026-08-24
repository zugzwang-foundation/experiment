// @vitest-environment jsdom

import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ComposerSlot } from "@/components/debate/composer/ComposerSlot";

/**
 * UI-QUICK change set 4 — the two VERIFICATION DEBTS on `ComposerSlot`, plus the
 * R6 freeze tail.
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
 * server import and no business logic: it takes two `ReactNode`s and a pair of
 * booleans. That is the payoff for it being a wrapper rather than a
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
		<button type="button">a control</button>
	</form>
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

function renderSlot(props: {
	open: boolean;
	busy?: boolean;
	onOccupiedChange?: (id: string, occupied: boolean) => void;
}) {
	return render(
		<ComposerSlot
			slotId="YES"
			open={props.open}
			busy={props.busy ?? false}
			composer={props.open ? COMPOSER : null}
			scroller={SCROLLER}
			onOccupiedChange={props.onOccupiedChange}
		/>,
	);
}

describe("f1 — the in-flight short-circuit FIRES, not merely exists", () => {
	it("composer-slot::a-normal-close-HOLDS-the-corpse-for-the-exit", () => {
		// The positive control. Without it, the `busy` assertion below could pass
		// on a component that never animates an exit at all — which would be the
		// same green for the opposite reason.
		const { container, rerender } = renderSlot({ open: true });
		expect(
			container.querySelector('[data-testid="probe-composer"]'),
		).not.toBeNull();

		rerender(
			<ComposerSlot
				slotId="YES"
				open={false}
				busy={false}
				composer={null}
				scroller={SCROLLER}
			/>,
		);

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
		const { container, rerender } = renderSlot({ open: true, busy: true });
		expect(
			container.querySelector('[data-testid="probe-composer"]'),
		).not.toBeNull();

		rerender(
			<ComposerSlot
				slotId="YES"
				open={false}
				busy={true}
				composer={null}
				scroller={SCROLLER}
			/>,
		);

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
		const { container, rerender } = renderSlot({ open: true });
		rerender(
			<ComposerSlot
				slotId="YES"
				open={false}
				busy={false}
				composer={null}
				scroller={SCROLLER}
			/>,
		);
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
			open: true,
			onOccupiedChange,
		});
		expect(reports.at(-1)).toEqual(["YES", true]);

		rerender(
			<ComposerSlot
				slotId="YES"
				open={false}
				busy={false}
				composer={null}
				scroller={SCROLLER}
				onOccupiedChange={onOccupiedChange}
			/>,
		);

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
			open: true,
			onOccupiedChange: (id, occupied) => reports.push([id, occupied]),
		});
		expect(reports.at(-1)).toEqual(["YES", true]);

		unmount();

		expect(reports.at(-1)).toEqual(["YES", false]);
	});
});
