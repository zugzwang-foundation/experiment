// @vitest-environment jsdom

import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
} from "@testing-library/react";
import { StrictMode, useEffect, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// F-DEBATE-4 (B3) tests-first — the CLIENT-RENDER half of the polled-on-view
// refresh (SPEC.1 1.0.25 §9 F-DEBATE-4; plan §7). File placement follows the
// behaviour under test: the interval, suspension and chart-refresh rules are
// client-render behaviours and live here; the masking and stop-signal rules are
// read-path/structural and live in `tests/server/debate-view/poll-contract.test.ts`.
//
// RED target: NEITHER `@/components/debate/DebatePoll` NOR the
// `POLL_INTERVAL_MS_DEBATE_VIEW` export on `@/server/config/limits` exists yet,
// so this file fails at COLLECTION until the implement phase lands both.
//
// SPEC.1 §17 rows proved here:
//   debate-view::poll-interval
//   debate-view::poll-suspends-while-hidden-or-composer-open
//   debate-view::poll-refreshes-price-chart
//
// Harness constraints (recon F13/F14): jsdom + @testing-library/react behind the
// per-file docblock above. There is NO jest-dom — `toBeInTheDocument()` and
// friends are UNAVAILABLE; every assertion below is a plain DOM assertion.
// Visibility is proven by STUBBING `document.hidden` and dispatching
// `visibilitychange`, never in a browser: recon could not observe true hidden
// state in headless Chromium (the CDP visibility override is absent from that
// build), so a browser measurement here would be worthless.
//
// `useRouter()` is mocked to a STABLE object, faithfully to the App Router (recon
// R3: the real router object is referentially stable, which is why the poll
// effect mounts once and never re-runs). An unstable mock would recreate the
// interval on every render and silently prove nothing.

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
import { DebateView } from "@/components/debate/DebateView";
import type { DebateViewModel } from "@/components/debate/types";
import { POLL_INTERVAL_MS_DEBATE_VIEW } from "@/server/config/limits";

import { mumbaiMetroModel } from "../../debate-export/_fixtures/mumbai-metro.input";

/** Stub `document.hidden` and fire the event the browser would fire. */
function setHidden(hidden: boolean): void {
	Object.defineProperty(document, "hidden", {
		configurable: true,
		get: () => hidden,
	});
	document.dispatchEvent(new Event("visibilitychange"));
}

/** Advance the fake clock by whole poll intervals, flushing React each time. */
function tick(intervals: number): void {
	act(() => {
		vi.advanceTimersByTime(POLL_INTERVAL_MS_DEBATE_VIEW * intervals);
	});
}

const OPENING = { at: "2026-09-15T00:00:00.000Z", yes: "0.500000000000000000" };

/** The fixture model with a two-point price series ending at `currentYes`. */
function modelWithChart(currentYes: string, at: string): DebateViewModel {
	return {
		...mumbaiMetroModel,
		priceChart: { series: [OPENING, { at, yes: currentYes }], nodes: [] },
	};
}

function chartSummary(): string {
	return screen.getByTestId("market-price-chart-summary").textContent ?? "";
}

/**
 * The polled host: `router.refresh()` re-renders `/m/[slug]` server-side and the
 * new payload arrives as new props. This harness models exactly that — the
 * mocked refresh swaps the model — so the assertion runs through the REAL
 * `DebateView`, not a re-implementation of its composition.
 */
let applyNextPayload: (() => void) | null = null;

function PolledHost({
	first,
	second,
}: {
	first: DebateViewModel;
	second: DebateViewModel;
}) {
	const [model, setModel] = useState(first);
	// In an effect, never during render: a render-phase module-scope assignment
	// is a side effect that misbehaves the moment the host renders concurrently.
	useEffect(() => {
		applyNextPayload = () => setModel(second);
	}, [second]);
	return (
		<DebateView
			model={model}
			viewer={null}
			initialPostId={null}
			ownPseudonym={null}
		/>
	);
}

beforeEach(() => {
	vi.useFakeTimers();
	refreshMock.mockReset();
	refreshMock.mockImplementation(() => undefined);
	setHidden(false);
	applyNextPayload = null;
});

afterEach(() => {
	cleanup();
	vi.useRealTimers();
	Reflect.deleteProperty(document, "hidden");
});

describe("F-DEBATE-4 — the debate-view poll (cadence)", () => {
	it("debate-view::poll-interval", () => {
		render(<DebatePoll marketOpen composerOpen={false} />);

		// The initial-mount guard: the server render is already fresh.
		expect(refreshMock).toHaveBeenCalledTimes(0);

		act(() => {
			vi.advanceTimersByTime(POLL_INTERVAL_MS_DEBATE_VIEW - 1);
		});
		expect(refreshMock).toHaveBeenCalledTimes(0);

		act(() => {
			vi.advanceTimersByTime(1);
		});
		expect(refreshMock).toHaveBeenCalledTimes(1);

		tick(3);
		expect(refreshMock).toHaveBeenCalledTimes(4);
	});

	it("clears its interval on unmount — no leaked timer", () => {
		const { unmount } = render(<DebatePoll marketOpen composerOpen={false} />);
		tick(1);
		expect(refreshMock).toHaveBeenCalledTimes(1);

		unmount();
		tick(5);
		expect(refreshMock).toHaveBeenCalledTimes(1);
	});

	it("fires at the net production rate under a StrictMode double-mount", () => {
		render(
			<StrictMode>
				<DebatePoll marketOpen composerOpen={false} />
			</StrictMode>,
		);
		tick(3);
		// Dev double-invokes the mount effect and runs the cleanup between the two
		// invocations, so the net live interval count is 1 (recon R3, measured).
		expect(refreshMock).toHaveBeenCalledTimes(3);
	});

	it("fires NO refresh on initial mount, nor on a re-render that never suspended", () => {
		const { rerender } = render(<DebatePoll marketOpen composerOpen={false} />);
		expect(refreshMock).toHaveBeenCalledTimes(0);

		rerender(<DebatePoll marketOpen composerOpen={false} />);
		expect(refreshMock).toHaveBeenCalledTimes(0);
	});
});

describe("F-DEBATE-4 — suspension (RULING C)", () => {
	it("debate-view::poll-suspends-while-hidden-or-composer-open", () => {
		const { rerender } = render(<DebatePoll marketOpen composerOpen={false} />);

		// (a) document.hidden suspends; becoming visible resumes IMMEDIATELY.
		act(() => setHidden(true));
		tick(4);
		expect(refreshMock).toHaveBeenCalledTimes(0);

		act(() => setHidden(false));
		expect(refreshMock).toHaveBeenCalledTimes(1);
		tick(1);
		expect(refreshMock).toHaveBeenCalledTimes(2);

		// (b) an open composer suspends; the last composer closing resumes
		//     IMMEDIATELY. Composer-OPEN, not composer-dirty (ratified): a refresh
		//     whose render throws destroys the whole tree, and an open-but-empty
		//     composer sits in that blast radius identically to a dirty one.
		rerender(<DebatePoll marketOpen composerOpen={true} />);
		tick(4);
		expect(refreshMock).toHaveBeenCalledTimes(2);

		rerender(<DebatePoll marketOpen composerOpen={false} />);
		expect(refreshMock).toHaveBeenCalledTimes(3);
		tick(1);
		expect(refreshMock).toHaveBeenCalledTimes(4);
	});

	it("stays suspended while EITHER suspender holds — clearing one is not enough", () => {
		const { rerender } = render(<DebatePoll marketOpen composerOpen={true} />);
		act(() => setHidden(true));
		tick(4);
		expect(refreshMock).toHaveBeenCalledTimes(0);

		// Composer closes, tab still hidden → still suspended.
		rerender(<DebatePoll marketOpen composerOpen={false} />);
		tick(4);
		expect(refreshMock).toHaveBeenCalledTimes(0);

		// Tab becomes visible → the single resume refresh fires, once.
		act(() => setHidden(false));
		expect(refreshMock).toHaveBeenCalledTimes(1);
	});

	it("adopts an already-hidden document at mount and never polls until it is shown", () => {
		setHidden(true);
		render(<DebatePoll marketOpen composerOpen={false} />);
		tick(4);
		expect(refreshMock).toHaveBeenCalledTimes(0);

		act(() => setHidden(false));
		expect(refreshMock).toHaveBeenCalledTimes(1);
	});

	it("suspends through DebateView's OWN openSide state — no BetComposer change", () => {
		render(
			<DebateView
				model={modelWithChart(
					"0.640000000000000000",
					"2026-09-17T00:00:00.000Z",
				)}
				viewer={null}
				initialPostId={null}
				ownPseudonym={null}
			/>,
		);
		tick(1);
		expect(refreshMock).toHaveBeenCalledTimes(1);

		// Open the market-view composer slot the way a participant does.
		const entry = screen.getByLabelText("Buy YES");
		fireEvent.click(entry);
		expect(entry.getAttribute("aria-expanded")).toBe("true");

		tick(4);
		expect(refreshMock).toHaveBeenCalledTimes(1);

		// Toggle it closed → the immediate resume refresh.
		fireEvent.click(entry);
		expect(entry.getAttribute("aria-expanded")).toBe("false");
		expect(refreshMock).toHaveBeenCalledTimes(2);
	});
});

describe("F-DEBATE-4 — the stop rule (RULING D, client half)", () => {
	it("never starts on a market that is already non-Open at first paint", () => {
		render(<DebatePoll marketOpen={false} composerOpen={false} />);
		tick(5);
		expect(refreshMock).toHaveBeenCalledTimes(0);
	});

	it("stops PERMANENTLY when the market leaves Open — cleared, never restarted", () => {
		const { rerender } = render(<DebatePoll marketOpen composerOpen={false} />);
		tick(2);
		expect(refreshMock).toHaveBeenCalledTimes(2);

		rerender(<DebatePoll marketOpen={false} composerOpen={false} />);
		tick(5);
		expect(refreshMock).toHaveBeenCalledTimes(2);

		// Stopped, not paused: even a later payload claiming Open cannot restart it.
		rerender(<DebatePoll marketOpen composerOpen={false} />);
		tick(5);
		expect(refreshMock).toHaveBeenCalledTimes(2);
	});
});

describe("F-DEBATE-4 — the price chart rides the poll (F-DEBATE-5)", () => {
	it("debate-view::poll-refreshes-price-chart", () => {
		const first = modelWithChart(
			"0.500000000000000000",
			"2026-09-15T00:00:00.000Z",
		);
		const second = modelWithChart(
			"0.800000000000000000",
			"2026-09-20T00:00:00.000Z",
		);

		refreshMock.mockImplementation(() => {
			applyNextPayload?.();
		});

		render(<PolledHost first={first} second={second} />);
		expect(chartSummary()).toContain("current 50%");

		tick(1);

		expect(refreshMock).toHaveBeenCalledTimes(1);
		expect(chartSummary()).toContain("current 80%");
	});

	it("renders the chart from props alone — the tree issues no client-side fetch", () => {
		const fetchSpy = vi.fn();
		vi.stubGlobal("fetch", fetchSpy);
		try {
			render(
				<DebateView
					model={modelWithChart(
						"0.640000000000000000",
						"2026-09-17T00:00:00.000Z",
					)}
					viewer={null}
					initialPostId={null}
					ownPseudonym={null}
				/>,
			);
			tick(3);
			expect(refreshMock).toHaveBeenCalledTimes(3);
			expect(fetchSpy).not.toHaveBeenCalled();
		} finally {
			vi.unstubAllGlobals();
		}
	});
});
