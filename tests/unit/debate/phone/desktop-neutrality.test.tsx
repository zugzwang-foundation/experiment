// @vitest-environment jsdom
/**
 * MOBILE-2b — THE NEUTRALITY TESTS FOR THE TWO LOGIC EDITS OUTSIDE `phone/`.
 *
 * ADR-0050 D-2 (amendment A1) permits a logic edit to a desktop-tree file only
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
 * Stub `matchMedia` so the tier is a thing this test DECIDES rather than a
 * thing jsdom happens to answer. jsdom implements no media queries at all, so
 * without this every `matches` is false and the phone arm is unreachable — the
 * test would pass while exercising one branch twice.
 */
function setViewport(isPhone: boolean) {
	vi.stubGlobal("matchMedia", (query: string) => ({
		matches: query.includes("max-width: 639.98px") ? isPhone : false,
		media: query,
		onchange: null,
		addEventListener: () => {},
		removeEventListener: () => {},
		addListener: () => {},
		removeListener: () => {},
		dispatchEvent: () => false,
	}));
}

const RAIL_PROPS = {
	index: 0,
	total: 3,
	noun: "post",
	onPrev: () => {},
	onNext: () => {},
	durationMs: 1000,
	// progressKey REMOUNTS CountdownFill at the call site, and its type is a
	// NUMBER. vitest ran this file green with a string in it until `next build`
	// type-checked the test directory — recorded rather than quietly corrected,
	// because "the test passed" and "the test type-checked" turn out to be two
	// different claims and only one of them was being made.
	progressKey: 0,
};

beforeEach(() => {
	refresh.mockClear();
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
		act(() => {
			setPhoneSheetOpen(false);
			vi.advanceTimersByTime(RUN_MS);
		});
		expect(refresh).toHaveBeenCalled();
	});
});
