// @vitest-environment jsdom

import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// HO-FRONT v2.0 T2 — proves the phase-jitter mechanism `poll.test.tsx`
// deliberately mocks away. Two things only that file can't cover once
// `getInitialPollPhaseOffsetMs` is forced to 0 there: that the offset is
// genuinely bounded, and that a REAL non-zero offset shifts the first refresh
// without touching the un-jittered resume-refresh or the steady-state period.

const { refreshMock, routerMock } = vi.hoisted(() => {
	const refresh = vi.fn();
	return {
		refreshMock: refresh,
		routerMock: {
			refresh,
			push: () => undefined,
			replace: () => undefined,
			back: () => undefined,
			forward: () => undefined,
			prefetch: () => undefined,
		},
	};
});

vi.mock("next/navigation", () => ({
	useRouter: () => routerMock,
	usePathname: () => "/m/mumbai-metro-line-3-1m-riders",
	useSearchParams: () => new URLSearchParams(),
}));

import { DebatePoll } from "@/components/debate/DebatePoll";
import { getInitialPollPhaseOffsetMs } from "@/components/debate/poll-phase";
import { POLL_INTERVAL_MS_DEBATE_VIEW } from "@/server/config/limits";

beforeEach(() => {
	vi.useFakeTimers();
	refreshMock.mockReset();
});

afterEach(() => {
	cleanup();
	vi.useRealTimers();
	vi.restoreAllMocks();
});

describe("getInitialPollPhaseOffsetMs", () => {
	it("is bounded to [0, intervalMs)", () => {
		vi.spyOn(Math, "random").mockReturnValue(0);
		expect(getInitialPollPhaseOffsetMs(POLL_INTERVAL_MS_DEBATE_VIEW)).toBe(0);

		vi.spyOn(Math, "random").mockReturnValue(0.999999);
		expect(
			getInitialPollPhaseOffsetMs(POLL_INTERVAL_MS_DEBATE_VIEW),
		).toBeLessThan(POLL_INTERVAL_MS_DEBATE_VIEW);
	});
});

describe("DebatePoll — a real, non-zero phase offset", () => {
	it("shifts the FIRST refresh by offset + interval, never fires AT the offset itself", () => {
		const offset = 4000;
		vi.spyOn(Math, "random").mockReturnValue(
			offset / POLL_INTERVAL_MS_DEBATE_VIEW,
		);

		render(<DebatePoll marketOpen composerOpen={false} />);

		act(() => {
			vi.advanceTimersByTime(offset);
		});
		// Past the offset alone, nothing has fired — the offset only delays when
		// the interval ARMS, it is not itself a refresh trigger.
		expect(refreshMock).toHaveBeenCalledTimes(0);

		act(() => {
			vi.advanceTimersByTime(POLL_INTERVAL_MS_DEBATE_VIEW - 1);
		});
		expect(refreshMock).toHaveBeenCalledTimes(0);

		act(() => {
			vi.advanceTimersByTime(1);
		});
		expect(refreshMock).toHaveBeenCalledTimes(1);
	});

	it("keeps steady-state cadence at exactly the interval once armed", () => {
		vi.spyOn(Math, "random").mockReturnValue(
			2000 / POLL_INTERVAL_MS_DEBATE_VIEW,
		);
		render(<DebatePoll marketOpen composerOpen={false} />);

		act(() => {
			vi.advanceTimersByTime(2000 + POLL_INTERVAL_MS_DEBATE_VIEW);
		});
		expect(refreshMock).toHaveBeenCalledTimes(1);

		act(() => {
			vi.advanceTimersByTime(POLL_INTERVAL_MS_DEBATE_VIEW);
		});
		expect(refreshMock).toHaveBeenCalledTimes(2);

		act(() => {
			vi.advanceTimersByTime(POLL_INTERVAL_MS_DEBATE_VIEW);
		});
		expect(refreshMock).toHaveBeenCalledTimes(3);
	});

	it("a resume-from-suspension is never jittered, even with a large first-arm offset still pending", () => {
		vi.spyOn(Math, "random").mockReturnValue(0.9);
		const { rerender } = render(<DebatePoll marketOpen composerOpen={false} />);

		// The jittered first arm is scheduled (hasStartedOnce is now true) but its
		// ~13.5s offset hasn't elapsed yet — suspend before it ever fires.
		rerender(<DebatePoll marketOpen composerOpen={true} />);
		act(() => {
			vi.advanceTimersByTime(POLL_INTERVAL_MS_DEBATE_VIEW * 2);
		});
		expect(refreshMock).toHaveBeenCalledTimes(0);

		// Closing the composer resumes with an IMMEDIATE refresh — unjittered,
		// per the ratified suspension rule this task must not touch, and
		// regardless of the first-arm offset this instance already consumed.
		rerender(<DebatePoll marketOpen composerOpen={false} />);
		expect(refreshMock).toHaveBeenCalledTimes(1);
	});
});
