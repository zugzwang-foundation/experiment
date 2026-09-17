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

// R2-CHEAP-POLL — a poll tick now ASKS `/m/<slug>/version` and refreshes only
// when the answer changed. These tests are about WHEN a tab may refresh, so the
// stub reports a change every time: each assertion reads as it did before the
// check existed.
let versionTick = 0;
const fetchMock = vi.fn(async () => ({
	ok: true,
	json: async () => ({ v: `v${++versionTick}` }),
}));

vi.mock("next/navigation", () => ({
	useRouter: () => routerMock,
	usePathname: () => "/m/mumbai-metro-line-3-1m-riders",
	useSearchParams: () => new URLSearchParams(),
}));

import { DebatePoll } from "@/components/debate/DebatePoll";
import { getInitialPollPhaseOffsetMs } from "@/components/debate/poll-phase";
import { POLL_INTERVAL_MS_DEBATE_VIEW } from "@/server/config/limits";

beforeEach(async () => {
	versionTick = 0;
	fetchMock.mockClear();
	vi.stubGlobal("fetch", fetchMock);
	vi.useFakeTimers();
	refreshMock.mockReset();
});

afterEach(() => {
	vi.unstubAllGlobals();
	cleanup();
	vi.useRealTimers();
	vi.restoreAllMocks();
});

describe("getInitialPollPhaseOffsetMs", () => {
	it("is bounded to [0, intervalMs)", async () => {
		vi.spyOn(Math, "random").mockReturnValue(0);
		expect(getInitialPollPhaseOffsetMs(POLL_INTERVAL_MS_DEBATE_VIEW)).toBe(0);

		vi.spyOn(Math, "random").mockReturnValue(0.999999);
		expect(
			getInitialPollPhaseOffsetMs(POLL_INTERVAL_MS_DEBATE_VIEW),
		).toBeLessThan(POLL_INTERVAL_MS_DEBATE_VIEW);
	});
});

describe("DebatePoll — a real, non-zero phase offset", () => {
	it("shifts the FIRST refresh by offset + interval, never fires AT the offset itself", async () => {
		const offset = 4000;
		vi.spyOn(Math, "random").mockReturnValue(
			offset / POLL_INTERVAL_MS_DEBATE_VIEW,
		);

		render(<DebatePoll slug="test-market" marketOpen composerOpen={false} />);

		await act(async () => {
			vi.advanceTimersByTime(offset);
		});
		// Past the offset alone, nothing has fired — the offset only delays when
		// the interval ARMS, it is not itself a refresh trigger.
		expect(refreshMock).toHaveBeenCalledTimes(0);

		await act(async () => {
			vi.advanceTimersByTime(POLL_INTERVAL_MS_DEBATE_VIEW - 1);
		});
		expect(refreshMock).toHaveBeenCalledTimes(0);

		await act(async () => {
			vi.advanceTimersByTime(1);
		});
		expect(refreshMock).toHaveBeenCalledTimes(1);
	});

	it("keeps steady-state cadence at exactly the interval once armed", async () => {
		vi.spyOn(Math, "random").mockReturnValue(
			2000 / POLL_INTERVAL_MS_DEBATE_VIEW,
		);
		render(<DebatePoll slug="test-market" marketOpen composerOpen={false} />);

		await act(async () => {
			vi.advanceTimersByTime(2000 + POLL_INTERVAL_MS_DEBATE_VIEW);
		});
		expect(refreshMock).toHaveBeenCalledTimes(1);

		await act(async () => {
			vi.advanceTimersByTime(POLL_INTERVAL_MS_DEBATE_VIEW);
		});
		expect(refreshMock).toHaveBeenCalledTimes(2);

		await act(async () => {
			vi.advanceTimersByTime(POLL_INTERVAL_MS_DEBATE_VIEW);
		});
		expect(refreshMock).toHaveBeenCalledTimes(3);
	});

	it("holds BOTH boundaries to the millisecond — the phase moved, the period did not", async () => {
		// The one assertion that separates the ratified design (phase shifted,
		// period intact) from the period jitter that was rejected.
		//
		// ⚠ THE TWO TESTS ABOVE PIN THE COUNT, NOT THE BOUNDARY, and that gap is
		// what this test exists to close. They advance by WHOLE intervals and
		// assert 1, 2, 3 — so a steady-state period of `interval - 1` reproduces
		// every one of those sample points exactly while drifting a millisecond
		// per tick, and a period jitter of a few ms would land the same counts
		// most runs and redden at random on the rest. A guard that fails
		// intermittently is worse than one that fails: it gets retried.
		//
		// Checking `- 1` and then `1` on EVERY window is what makes "exactly the
		// interval" mean exactly. `0.5` is used rather than a derived fraction
		// because it round-trips through the float multiply exactly at any even
		// interval, so the assertion never turns on a rounding accident.
		const offset = POLL_INTERVAL_MS_DEBATE_VIEW / 2;
		vi.spyOn(Math, "random").mockReturnValue(0.5);

		render(<DebatePoll slug="test-market" marketOpen composerOpen={false} />);

		// FIRST refresh: `offset + interval`, and not one millisecond sooner.
		await act(async () => {
			vi.advanceTimersByTime(offset + POLL_INTERVAL_MS_DEBATE_VIEW - 1);
		});
		expect(refreshMock).toHaveBeenCalledTimes(0);
		await act(async () => {
			vi.advanceTimersByTime(1);
		});
		expect(refreshMock).toHaveBeenCalledTimes(1);

		// EVERY refresh thereafter: exactly one interval apart, both edges.
		for (const n of [2, 3, 4]) {
			await act(async () => {
				vi.advanceTimersByTime(POLL_INTERVAL_MS_DEBATE_VIEW - 1);
			});
			expect(refreshMock).toHaveBeenCalledTimes(n - 1);
			await act(async () => {
				vi.advanceTimersByTime(1);
			});
			expect(refreshMock).toHaveBeenCalledTimes(n);
		}
	});

	it("a resume-from-suspension is never jittered, even with a large first-arm offset still pending", async () => {
		vi.spyOn(Math, "random").mockReturnValue(0.9);
		const { rerender } = render(
			<DebatePoll slug="test-market" marketOpen composerOpen={false} />,
		);

		// The jittered first arm is scheduled (hasStartedOnce is now true) but its
		// ~13.5s offset hasn't elapsed yet — suspend before it ever fires.
		rerender(<DebatePoll slug="test-market" marketOpen composerOpen={true} />);
		await act(async () => {
			vi.advanceTimersByTime(POLL_INTERVAL_MS_DEBATE_VIEW * 2);
		});
		expect(refreshMock).toHaveBeenCalledTimes(0);

		// Closing the composer resumes with an IMMEDIATE refresh — unjittered,
		// per the ratified suspension rule this task must not touch, and
		// regardless of the first-arm offset this instance already consumed.
		rerender(<DebatePoll slug="test-market" marketOpen composerOpen={false} />);
		// The resume asks the version route before refreshing.
		await act(async () => {
			await Promise.resolve();
			await Promise.resolve();
			await Promise.resolve();
		});
		expect(refreshMock).toHaveBeenCalledTimes(1);
	});
});
