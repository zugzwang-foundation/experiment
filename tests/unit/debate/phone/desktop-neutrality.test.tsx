// @vitest-environment jsdom
/**
 * MOBILE-2b — THE NEUTRALITY TESTS FOR THE TWO LOGIC EDITS OUTSIDE `phone/`.
 *
 * ADR-0051 D-2 (amendment A1) permits a logic edit to a desktop-tree file only
 * when four things hold, and the third is that a test fails if the DESKTOP
 * path's behaviour changes. Both edits below stop something from running on a
 * phone, and the failure mode of "stop something from running" is stopping it
 * everywhere — silently, because a timer that does not fire and a poll that does
 * not poll both look exactly like a quiet page.
 *
 * ⚠ SO EVERY ROW HERE IS A PAIR. The phone assertion alone is satisfied by a
 * component that never starts its interval at all, which is a worse defect than
 * the one being fixed and would pass. The desktop assertion is the control, and
 * it is the half that actually protects `main`.
 */
import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setPhoneSheetOpen } from "@/components/debate/composer-open-store";
import { DebatePoll } from "@/components/debate/DebatePoll";
import { ScrollRail } from "@/components/debate/ScrollRail";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({
	useRouter: () => ({ refresh: (...a: unknown[]) => refresh(...a) }),
}));

/**
 * Every `change` listener `phone-tier`'s `subscribe` has registered and not yet
 * removed. ⚠ A no-op `addEventListener` — which is what this stub carried until
 * the mutation audit — makes a store that never subscribes INDISTINGUISHABLE
 * from one that does, because nothing in the file ever changes the viewport
 * after mount. Keeping the registry is what turns `subscribe` into something
 * with an observable consequence.
 */
let mqlListeners: Array<() => void> = [];
/** The live answer to the tier query, readable by every stubbed MQL. */
let phoneNow = false;

/**
 * Stub `matchMedia` so the tier is a thing this test DECIDES rather than a
 * thing jsdom happens to answer. jsdom implements no media queries at all, so
 * without this every `matches` is false and the phone arm is unreachable — the
 * test would pass while exercising one branch twice.
 *
 * ⚠ `matches` IS A GETTER, not a value captured when the MQL was made. The
 * store calls `matchMedia` twice — once in `subscribe`, once in `getSnapshot` —
 * and gets two different objects; a captured boolean would freeze each of them
 * at the width that happened to be current when it was constructed, so a
 * boundary crossing would be unobservable through exactly the object React
 * reads.
 */
function setViewport(isPhone: boolean) {
	phoneNow = isPhone;
	vi.stubGlobal("matchMedia", (query: string) => ({
		get matches() {
			// ⚠ MATCHES THE QUERY THE HOOK ACTUALLY ASKS, which is the one Tailwind
			// emits: `not all and (min-width: 640px)`. This stub read
			// `max-width: 639.98px` and went silently inert the moment the hook was
			// corrected — every phone row failed at once, which is the right
			// failure and is why the predicate names the boundary rather than a
			// spelling of it.
			return query.includes("min-width: 640px") ? phoneNow : false;
		},
		media: query,
		onchange: null,
		addEventListener: (_type: string, listener: () => void) => {
			mqlListeners.push(listener);
		},
		removeEventListener: (_type: string, listener: () => void) => {
			mqlListeners = mqlListeners.filter((l) => l !== listener);
		},
		addListener: () => {},
		removeListener: () => {},
		dispatchEvent: () => false,
	}));
}

/**
 * The reader rotates the phone, opens a desktop window on a narrow screen, or
 * drags the browser across 640px — the one event the tier is a SUBSCRIPTION in
 * order to survive. Call inside `act`.
 */
function crossTierBoundary(isPhone: boolean) {
	phoneNow = isPhone;
	for (const listener of [...mqlListeners]) {
		listener();
	}
}

const RAIL_PROPS = {
	index: 0,
	total: 3,
	noun: "post",
	onPrev: () => {},
	onNext: () => {},
	durationMs: 1000,
	// ⚠ A NUMBER, NOT `"k"`. `ScrollRail` declares `progressKey: number` and this
	// object carried a string, so `tsc --noEmit` was RED at `d36b7356` on these
	// two lines and no others in the project — the branch tip failed `just
	// verify`'s first step, inside the guard file itself, and CI failed on the
	// pushed commit (run 34659406640, `error TS2322`) with the Vercel preview
	// erroring alongside it. `vitest` type-checks nothing, so a green test file
	// hid it: "the test passed" and "the test type-checked" are two claims and
	// only one was being made.
	progressKey: 0,
};

beforeEach(() => {
	refresh.mockClear();
	mqlListeners = [];
	setPhoneSheetOpen(false);
	vi.useFakeTimers();
});

afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
	setPhoneSheetOpen(false);
});

describe("RI-3 · the hidden desktop tree's countdown", () => {
	const fillHeight = (c: HTMLElement) =>
		c.querySelector<HTMLElement>('[data-testid="scroll-rail-fill"]')?.style
			.height ?? null;

	it("DESKTOP CONTROL — still ticks at ≥640px, exactly as before", () => {
		setViewport(false);
		const { container } = render(<ScrollRail {...RAIL_PROPS} />);
		expect(fillHeight(container)).toBe("0%");
		act(() => {
			vi.advanceTimersByTime(1000);
		});
		// If this stops advancing, the fix has taken the desktop's auto-advance
		// progress bar with it — which is the regression the exception exists to
		// forbid, and the reason this row is first.
		expect(fillHeight(container)).not.toBe("0%");
	});

	it("does not tick below 640px, where the whole tree is display:none", () => {
		setViewport(true);
		const { container } = render(<ScrollRail {...RAIL_PROPS} />);
		act(() => {
			vi.advanceTimersByTime(5000);
		});
		expect(fillHeight(container)).toBe("0%");
	});

	// ⛔⛔ THE TWO ROWS ABOVE READ A PAINTED HEIGHT, AND RI-3 IS NOT ABOUT PAINT.
	// The defect is 252 timer callbacks a minute on the device class with the
	// least battery, for a tree that is `display: none`. A "fix" that leaves the
	// interval running at full rate and merely writes `0%` into the style when
	// `hiddenByTier` is true satisfies both of them exactly — measured, not
	// supposed: that mutation was applied to `CountdownFill` and all eleven rows
	// in these two files stayed green. It costs the phone every callback the
	// defect cost it and reports a clean bill of health.
	// ⇒ Count the TIMER. `vi.getTimerCount()` is the fake-timer registry itself,
	// so it answers "is an interval armed" with no reference to what anything
	// renders, which is the only question RI-3 ever asked.
	const armedTimers = () => vi.getTimerCount();

	it("DESKTOP CONTROL — an interval IS armed at ≥640px, which is what makes the zero below mean something", () => {
		setViewport(false);
		render(<ScrollRail {...RAIL_PROPS} />);
		// Without this row a broken instrument — a timer registry that reads 0 for
		// every viewport, a rail that stopped arming intervals everywhere — would
		// make the phone assertion pass while proving nothing at all.
		expect(armedTimers()).toBe(1);
	});

	it("arms NO interval below 640px — the cost RI-3 removes is a live timer, not a painted height", () => {
		setViewport(true);
		render(<ScrollRail {...RAIL_PROPS} />);
		expect(armedTimers()).toBe(0);
	});

	it("follows the reader across the tier boundary — the gate is a SUBSCRIPTION, not a mount-time reading", () => {
		// ⚠ `phone-tier` reads the query through `useSyncExternalStore` rather than
		// during render, and its docblock gives two reasons: SSR honesty, and
		// re-evaluation on change. Nothing asserted the second, so a `subscribe`
		// that registers no listener — or a bare `matchMedia(...).matches` in the
		// component body, which is the hydration mismatch the same docblock
		// forbids — passed every row in this file. Both mutations were applied and
		// both went green.
		// A reader who rotates a tablet, or drags a window across 640px, keeps the
		// interval they crossed the boundary to be rid of: the wrong answer is a
		// gate that is correct exactly once, at mount.
		setViewport(false);
		render(<ScrollRail {...RAIL_PROPS} />);
		expect(armedTimers()).toBe(1);

		act(() => {
			crossTierBoundary(true);
		});
		expect(armedTimers()).toBe(0);

		// ── and back: the DESKTOP half of the pair. A teardown that never re-arms
		//    would satisfy the line above and take the desktop's auto-advance with
		//    it the moment anyone resized a window.
		act(() => {
			crossTierBoundary(false);
		});
		expect(armedTimers()).toBe(1);
	});
});

describe("RI-4 · the poll and the phone sheet", () => {
	// The poll arms on a jittered offset and then an interval; advancing well
	// past both is what makes "did it refresh" a question with an answer.
	const RUN_MS = 400_000;

	it("DESKTOP CONTROL — still polls when nothing is open", () => {
		setViewport(false);
		render(<DebatePoll marketOpen={true} composerOpen={false} />);
		act(() => {
			vi.advanceTimersByTime(RUN_MS);
		});
		expect(refresh).toHaveBeenCalled();
	});

	it("DESKTOP CONTROL — still suspends for the desktop's own composer", () => {
		setViewport(false);
		render(<DebatePoll marketOpen={true} composerOpen={true} />);
		act(() => {
			vi.advanceTimersByTime(RUN_MS);
		});
		expect(refresh).not.toHaveBeenCalled();
	});

	it("suspends for a phone sheet the desktop tree cannot see", () => {
		setViewport(true);
		setPhoneSheetOpen(true);
		render(<DebatePoll marketOpen={true} composerOpen={false} />);
		act(() => {
			vi.advanceTimersByTime(RUN_MS);
		});
		expect(refresh).not.toHaveBeenCalled();
	});

	it("resumes once the phone sheet closes — the flag cannot stick on", () => {
		setViewport(true);
		setPhoneSheetOpen(true);
		render(<DebatePoll marketOpen={true} composerOpen={false} />);
		act(() => {
			vi.advanceTimersByTime(RUN_MS);
		});
		expect(refresh).not.toHaveBeenCalled();
		// POLL-IDLE — RUN_MS outlasts the idle timeout, so the poll is also idle
		// by now. Closing a sheet is a tap, so the reader's input is part of the
		// scenario; without it this row would test the idle rule instead of
		// whether the sheet flag can stick. Its own `act` so the resume commits
		// before the clock runs on (and the reader idles out again).
		act(() => {
			setPhoneSheetOpen(false);
			window.dispatchEvent(new Event("pointerdown"));
		});
		act(() => {
			vi.advanceTimersByTime(RUN_MS);
		});
		expect(refresh).toHaveBeenCalled();
	});
});
