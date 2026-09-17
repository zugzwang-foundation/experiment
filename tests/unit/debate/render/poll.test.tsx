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
//   debate-view::price-chart-tail-pinned-to-live-price  (was
//     `debate-view::poll-refreshes-price-chart`, removed from §17 at CHART-1 /
//     SPEC.1 1.0.45 — see the rename note above that describe block)
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

// R2-CHEAP-POLL — a tick now ASKS `/m/<slug>/version` and refreshes only when
// the answer changed. Every test in this file is about WHEN a tab may refresh —
// cadence, suspension, idle, the stop rule — not about change detection, so this
// stub answers with a NEW version every time. The market is therefore always
// "changed" and each assertion below reads exactly as it did before the check
// existed. Change detection has its own describe block at the foot of the file,
// where an UNCHANGED answer must produce no refresh at all.
let versionTick = 0;
const fetchMock = vi.fn(async () => ({
	ok: true,
	json: async () => ({ v: `v${++versionTick}` }),
}));

vi.mock("next/navigation", () => ({
	// POST-IMAGE-EXPORT — `DownloadPostImage` reads the market slug from the
	// route; a mock without `useParams` throws at the first post card render.
	useParams: () => ({ slug: "bitcoin-price-50k" }),
	useRouter: () => routerMock,
	usePathname: () => "/m/bitcoin-price-50k",
	useSearchParams: () => new URLSearchParams(),
}));

// HO-FRONT v2.0 T2 — poll phase jitter (DebatePoll.tsx) desyncs concurrent
// tabs by delaying when the FIRST interval arms, per client mount. Forced to
// a constant 0 here so every timing assertion below collapses to exactly the
// pre-jitter boundaries it already pins — the mechanism is exercised for
// real by `tests/unit/debate/render/poll-phase.test.tsx`, not this file.
vi.mock("@/components/debate/poll-phase", () => ({
	getInitialPollPhaseOffsetMs: () => 0,
}));

import { DebatePoll } from "@/components/debate/DebatePoll";
import { DebateView } from "@/components/debate/DebateView";
import type { DebateViewModel } from "@/components/debate/types";
import {
	POLL_IDLE_TIMEOUT_MS_DEBATE_VIEW,
	POLL_INTERVAL_MS_DEBATE_VIEW,
} from "@/server/config/limits";

import { mumbaiMetroModel as mumbaiMetroModelRaw } from "../../debate-export/_fixtures/mumbai-metro.input";

/**
 * BLOCK-1 — `mumbaiMetroModelRaw.market.slug` isn't one of BLOCK-1's eight
 * known live markets, so `ResolverCards` (nested under `MarketHeader`, which
 * `DebateView` renders through) now throws on it — correctly; that's the new
 * guard this task shipped (G1, `resolution-block-data.ts`). This file tests
 * poll phase/timing, not ResolverCards' content, so it gets a
 * locally-corrected model with a real slug. The golden input fixture itself
 * (`mumbai-metro.input.ts`, "do not hand-edit") stays untouched.
 */
const mumbaiMetroModel: DebateViewModel = {
	...mumbaiMetroModelRaw,
	market: { ...mumbaiMetroModelRaw.market, slug: "bitcoin-price-50k" },
};

/** Stub `document.hidden` and fire the event the browser would fire. */
function setHidden(hidden: boolean): void {
	Object.defineProperty(document, "hidden", {
		configurable: true,
		get: () => hidden,
	});
	document.dispatchEvent(new Event("visibilitychange"));
}

/** A reader input the idle timer counts (POLL-IDLE). */
async function activity(type = "pointermove"): Promise<void> {
	await act(async () => {
		window.dispatchEvent(new Event(type));
	});
}

/**
 * Advance the fake clock by whole poll intervals, flushing React each time.
 *
 * ⚠ POLL-IDLE — the reader is PRESENT: one input is dispatched first, so the
 * cadence, suspension and stop rules below are tested apart from the idle rule.
 * Idle has its own describe block, which advances the clock without input.
 */
async function tick(intervals: number): Promise<void> {
	await activity();
	await act(async () => {
		vi.advanceTimersByTime(POLL_INTERVAL_MS_DEBATE_VIEW * intervals);
	});
}

const OPENING = { at: "2026-09-15T00:00:00.000Z", yes: "0.500000000000000000" };

/** The fixture model with a two-point price series ending at `currentYes`. */
function modelWithChart(currentYes: string, at: string): DebateViewModel {
	return {
		...mumbaiMetroModel,
		priceChart: { series: [OPENING, { at, yes: currentYes }] },
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

beforeEach(async () => {
	vi.useFakeTimers();
	refreshMock.mockReset();
	refreshMock.mockImplementation(() => undefined);
	versionTick = 0;
	fetchMock.mockClear();
	vi.stubGlobal("fetch", fetchMock);
	setHidden(false);
	applyNextPayload = null;
});

afterEach(async () => {
	cleanup();
	vi.useRealTimers();
	vi.unstubAllGlobals();
	Reflect.deleteProperty(document, "hidden");
});

describe("F-DEBATE-4 — the debate-view poll (cadence)", () => {
	it("debate-view::poll-interval", async () => {
		render(<DebatePoll slug="test-market" marketOpen composerOpen={false} />);

		// The initial-mount guard: the server render is already fresh.
		expect(refreshMock).toHaveBeenCalledTimes(0);

		await act(async () => {
			vi.advanceTimersByTime(POLL_INTERVAL_MS_DEBATE_VIEW - 1);
		});
		expect(refreshMock).toHaveBeenCalledTimes(0);

		await act(async () => {
			vi.advanceTimersByTime(1);
		});
		expect(refreshMock).toHaveBeenCalledTimes(1);

		await tick(3);
		expect(refreshMock).toHaveBeenCalledTimes(4);
	});

	it("clears its interval on unmount — no leaked timer", async () => {
		const { unmount } = render(
			<DebatePoll slug="test-market" marketOpen composerOpen={false} />,
		);
		await tick(1);
		expect(refreshMock).toHaveBeenCalledTimes(1);

		unmount();
		await tick(5);
		expect(refreshMock).toHaveBeenCalledTimes(1);
	});

	it("fires at the net production rate under a StrictMode double-mount", async () => {
		render(
			<StrictMode>
				<DebatePoll slug="test-market" marketOpen composerOpen={false} />
			</StrictMode>,
		);
		await tick(3);
		// Dev double-invokes the mount effect and runs the cleanup between the two
		// invocations, so the net live interval count is 1 (recon R3, measured).
		expect(refreshMock).toHaveBeenCalledTimes(3);
	});

	it("fires NO refresh on initial mount, nor on a re-render that never suspended", async () => {
		const { rerender } = render(
			<DebatePoll slug="test-market" marketOpen composerOpen={false} />,
		);
		expect(refreshMock).toHaveBeenCalledTimes(0);

		rerender(<DebatePoll slug="test-market" marketOpen composerOpen={false} />);
		// The resume asks the version route first, so let that settle.
		await act(async () => {
			await Promise.resolve();
			await Promise.resolve();
			await Promise.resolve();
		});
		expect(refreshMock).toHaveBeenCalledTimes(0);
	});
});

describe("F-DEBATE-4 — suspension (RULING C)", () => {
	it("debate-view::poll-suspends-while-hidden-or-composer-open", async () => {
		const { rerender } = render(
			<DebatePoll slug="test-market" marketOpen composerOpen={false} />,
		);

		// (a) document.hidden suspends; becoming visible resumes IMMEDIATELY.
		await act(async () => setHidden(true));
		await tick(4);
		expect(refreshMock).toHaveBeenCalledTimes(0);

		await act(async () => setHidden(false));
		expect(refreshMock).toHaveBeenCalledTimes(1);
		await tick(1);
		expect(refreshMock).toHaveBeenCalledTimes(2);

		// (b) an open composer suspends; the last composer closing resumes
		//     IMMEDIATELY. Composer-OPEN, not composer-dirty (ratified): a refresh
		//     whose render throws destroys the whole tree, and an open-but-empty
		//     composer sits in that blast radius identically to a dirty one.
		rerender(<DebatePoll slug="test-market" marketOpen composerOpen={true} />);
		await tick(4);
		expect(refreshMock).toHaveBeenCalledTimes(2);

		rerender(<DebatePoll slug="test-market" marketOpen composerOpen={false} />);
		// The resume asks the version route first, so let that settle.
		await act(async () => {
			await Promise.resolve();
			await Promise.resolve();
			await Promise.resolve();
		});
		expect(refreshMock).toHaveBeenCalledTimes(3);
		await tick(1);
		expect(refreshMock).toHaveBeenCalledTimes(4);
	});

	it("stays suspended while EITHER suspender holds — clearing one is not enough", async () => {
		const { rerender } = render(
			<DebatePoll slug="test-market" marketOpen composerOpen={true} />,
		);
		await act(async () => setHidden(true));
		await tick(4);
		expect(refreshMock).toHaveBeenCalledTimes(0);

		// Composer closes, tab still hidden → still suspended.
		rerender(<DebatePoll slug="test-market" marketOpen composerOpen={false} />);
		await tick(4);
		expect(refreshMock).toHaveBeenCalledTimes(0);

		// Tab becomes visible → the single resume refresh fires, once.
		await act(async () => setHidden(false));
		expect(refreshMock).toHaveBeenCalledTimes(1);
	});

	it("adopts an already-hidden document at mount and never polls until it is shown", async () => {
		setHidden(true);
		render(<DebatePoll slug="test-market" marketOpen composerOpen={false} />);
		await tick(4);
		expect(refreshMock).toHaveBeenCalledTimes(0);

		await act(async () => setHidden(false));
		expect(refreshMock).toHaveBeenCalledTimes(1);
	});

	it("suspends through DebateView's OWN openSide state — no BetComposer change", async () => {
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
		await tick(1);
		expect(refreshMock).toHaveBeenCalledTimes(1);

		// Open the market-view composer slot the way a participant does.
		const entry = screen.getByLabelText("Buy YES");
		fireEvent.click(entry);
		expect(entry.getAttribute("aria-expanded")).toBe("true");

		await tick(4);
		expect(refreshMock).toHaveBeenCalledTimes(1);

		// Toggle it closed → the immediate resume refresh.
		fireEvent.click(entry);
		expect(entry.getAttribute("aria-expanded")).toBe("false");
		// Closing the composer resumes the poll, which asks the version route
		// before it refreshes; let that answer land.
		await act(async () => {
			await Promise.resolve();
			await Promise.resolve();
			await Promise.resolve();
		});
		expect(refreshMock).toHaveBeenCalledTimes(2);
	});
});

describe("POLL-IDLE — an idle reader stops the poll", () => {
	/** Advance the clock with NO reader input. */
	async function idleFor(ms: number): Promise<void> {
		await act(async () => {
			vi.advanceTimersByTime(ms);
		});
	}

	it("the constants are what was asked for: 30 s cadence, 5 min idle", async () => {
		expect(POLL_INTERVAL_MS_DEBATE_VIEW).toBe(30_000);
		expect(POLL_IDLE_TIMEOUT_MS_DEBATE_VIEW).toBe(300_000);
		expect(POLL_IDLE_TIMEOUT_MS_DEBATE_VIEW).toBeGreaterThan(
			POLL_INTERVAL_MS_DEBATE_VIEW,
		);
	});

	it("keeps polling up to the idle timeout, then stops refreshing", async () => {
		render(<DebatePoll slug="test-market" marketOpen composerOpen={false} />);

		await idleFor(POLL_IDLE_TIMEOUT_MS_DEBATE_VIEW - 1);
		const beforeIdle = Math.floor(
			(POLL_IDLE_TIMEOUT_MS_DEBATE_VIEW - 1) / POLL_INTERVAL_MS_DEBATE_VIEW,
		);
		expect(refreshMock).toHaveBeenCalledTimes(beforeIdle);

		// Crossing the timeout suspends; a long quiet stretch refreshes nothing.
		await idleFor(1);
		const atIdle = refreshMock.mock.calls.length;
		await idleFor(POLL_INTERVAL_MS_DEBATE_VIEW * 20);
		expect(refreshMock).toHaveBeenCalledTimes(atIdle);
	});

	it("the first input after idling refreshes IMMEDIATELY, then resumes the cadence", async () => {
		render(<DebatePoll slug="test-market" marketOpen composerOpen={false} />);
		await idleFor(
			POLL_IDLE_TIMEOUT_MS_DEBATE_VIEW + POLL_INTERVAL_MS_DEBATE_VIEW * 5,
		);
		const idleCount = refreshMock.mock.calls.length;

		await activity();
		expect(refreshMock).toHaveBeenCalledTimes(idleCount + 1);

		await idleFor(POLL_INTERVAL_MS_DEBATE_VIEW - 1);
		expect(refreshMock).toHaveBeenCalledTimes(idleCount + 1);
		await idleFor(1);
		expect(refreshMock).toHaveBeenCalledTimes(idleCount + 2);
	});

	it.each([
		"pointerdown",
		"pointermove",
		"touchstart",
		"wheel",
		"scroll",
		"keydown",
	])("%s counts as activity — it wakes an idle poll", async (type) => {
		render(<DebatePoll slug="test-market" marketOpen composerOpen={false} />);
		await idleFor(
			POLL_IDLE_TIMEOUT_MS_DEBATE_VIEW + POLL_INTERVAL_MS_DEBATE_VIEW,
		);
		const idleCount = refreshMock.mock.calls.length;

		await activity(type);
		expect(refreshMock).toHaveBeenCalledTimes(idleCount + 1);
	});

	it("a scroll inside an inner scroller is seen (capture phase — scroll does not bubble)", async () => {
		render(<DebatePoll slug="test-market" marketOpen composerOpen={false} />);
		const scroller = document.createElement("div");
		document.body.appendChild(scroller);
		try {
			await idleFor(
				POLL_IDLE_TIMEOUT_MS_DEBATE_VIEW + POLL_INTERVAL_MS_DEBATE_VIEW,
			);
			const idleCount = refreshMock.mock.calls.length;

			await act(async () => {
				scroller.dispatchEvent(new Event("scroll", { bubbles: false }));
			});
			expect(refreshMock).toHaveBeenCalledTimes(idleCount + 1);
		} finally {
			scroller.remove();
		}
	});

	it("ongoing activity keeps it polling indefinitely — the timeout restarts on input", async () => {
		render(<DebatePoll slug="test-market" marketOpen composerOpen={false} />);
		// Ten minutes, with input every minute: never idle, every tick lands.
		for (let minute = 0; minute < 10; minute++) {
			await activity();
			await idleFor(60_000);
		}
		expect(refreshMock).toHaveBeenCalledTimes(
			Math.floor(600_000 / POLL_INTERVAL_MS_DEBATE_VIEW),
		);
	});

	it("an idle reader returning to a hidden tab counts as present — resumes on show", async () => {
		render(<DebatePoll slug="test-market" marketOpen composerOpen={false} />);
		await act(async () => setHidden(true));
		await idleFor(POLL_IDLE_TIMEOUT_MS_DEBATE_VIEW * 2);
		expect(refreshMock).toHaveBeenCalledTimes(0);

		await act(async () => setHidden(false));
		expect(refreshMock).toHaveBeenCalledTimes(1);
		await idleFor(POLL_INTERVAL_MS_DEBATE_VIEW);
		expect(refreshMock).toHaveBeenCalledTimes(2);
	});

	it("input does NOT override the other suspenders — an open composer still holds it", async () => {
		render(<DebatePoll slug="test-market" marketOpen composerOpen={true} />);
		await idleFor(
			POLL_IDLE_TIMEOUT_MS_DEBATE_VIEW + POLL_INTERVAL_MS_DEBATE_VIEW,
		);
		await activity("keydown");
		await idleFor(POLL_INTERVAL_MS_DEBATE_VIEW * 3);
		expect(refreshMock).toHaveBeenCalledTimes(0);
	});

	it("input cannot restart a poll the stop rule stopped", async () => {
		const { rerender } = render(
			<DebatePoll slug="test-market" marketOpen composerOpen={false} />,
		);
		rerender(
			<DebatePoll slug="test-market" marketOpen={false} composerOpen={false} />,
		);
		await idleFor(POLL_IDLE_TIMEOUT_MS_DEBATE_VIEW * 2);
		await activity();
		await idleFor(POLL_INTERVAL_MS_DEBATE_VIEW * 3);
		expect(refreshMock).toHaveBeenCalledTimes(0);
	});

	it("removes its listeners and idle timer on unmount", async () => {
		const { unmount } = render(
			<DebatePoll slug="test-market" marketOpen composerOpen={false} />,
		);
		unmount();
		expect(vi.getTimerCount()).toBe(0);
		await activity();
		await idleFor(POLL_INTERVAL_MS_DEBATE_VIEW * 3);
		expect(refreshMock).toHaveBeenCalledTimes(0);
	});
});

describe("F-DEBATE-4 — the stop rule (RULING D, client half)", () => {
	it("never starts on a market that is already non-Open at first paint", async () => {
		render(
			<DebatePoll slug="test-market" marketOpen={false} composerOpen={false} />,
		);
		await tick(5);
		expect(refreshMock).toHaveBeenCalledTimes(0);
	});

	it("stops PERMANENTLY when the market leaves Open — cleared, never restarted", async () => {
		const { rerender } = render(
			<DebatePoll slug="test-market" marketOpen composerOpen={false} />,
		);
		await tick(2);
		expect(refreshMock).toHaveBeenCalledTimes(2);

		rerender(
			<DebatePoll slug="test-market" marketOpen={false} composerOpen={false} />,
		);
		await tick(5);
		expect(refreshMock).toHaveBeenCalledTimes(2);

		// Stopped, not paused: even a later payload claiming Open cannot restart it.
		rerender(<DebatePoll slug="test-market" marketOpen composerOpen={false} />);
		await tick(5);
		expect(refreshMock).toHaveBeenCalledTimes(2);
	});
});

// ⚠ RENAMED AT CHART-1 (SPEC.1 1.0.45), IN THE COMMIT THAT REMOVED ITS OLD NAME.
// This case was `debate-view::poll-refreshes-price-chart`. §17 no longer carries
// that row — it asserted the behaviour the CHART-1 amendment reverses — and
// SPEC.2 §13.5 requires every case-id here to appear verbatim in §17, so leaving
// the name would have been a build error by the repo's own rule.
//
// ⛔ THE TEST ITSELF IS UNCHANGED, AND THAT IS THE POINT. What it actually
// proves is that a poll tick reaches the chart and moves its CURRENT reading —
// the terminal point — which is exactly the behaviour the amendment KEEPS and
// strengthens. What the amendment removes is re-derivation of the chart's
// HISTORY on every tick, which this test never exercised: it feeds two whole
// models in as props and never touches the server derivation. So the case is
// re-pointed at the row it was always evidence for, rather than deleted along
// with the row it was named after.
describe("F-DEBATE-4 — the price chart's terminal rides the poll (F-DEBATE-5)", () => {
	it("debate-view::price-chart-tail-pinned-to-live-price", async () => {
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

		await tick(1);

		expect(refreshMock).toHaveBeenCalledTimes(1);
		expect(chartSummary()).toContain("current 80%");
	});

	it("renders the chart from props alone — the tree issues no client-side fetch", async () => {
		// R2-CHEAP-POLL — this guard's subject is the CHART, which must render
		// from props and fetch nothing of its own. The poll's version check is a
		// legitimate request that did not exist when this was written, so the
		// assertion below pins WHICH requests the tree may make rather than that
		// it makes none. A chart that fetched its own series would still fail it.
		const fetchSpy = vi.fn(async (input: RequestInfo | URL) => {
			void input;
			return {
				ok: true,
				json: async () => ({ v: `v${++versionTick}` }),
			};
		});
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
			await tick(3);
			expect(refreshMock).toHaveBeenCalledTimes(3);
			for (const [url] of fetchSpy.mock.calls) {
				expect(String(url)).toMatch(/^\/m\/[^/]+\/version$/);
			}
		} finally {
			vi.unstubAllGlobals();
		}
	});
});
