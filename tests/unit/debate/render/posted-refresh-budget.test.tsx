// @vitest-environment jsdom

import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * FEED-1 · A1 — THE ROUND-TRIP BUDGET FOR ONE SUCCESSFUL BET.
 *
 * ⚠⚠ WHAT LAYER THIS MEASURES, AND WHY IT IS NOT THE ONE THE KICKOFF ASKED FOR.
 * The kickoff asks for `loadDebateView` invocations counted SERVER-SIDE. That
 * needs a running server and a real session, and this run has neither (no
 * browser, no sign-in — both walled). The layer reachable here is one step up:
 * the number of times `router.refresh()` is INVOKED AT RUNTIME by the real
 * `DebateView` tree, driven through a real submit.
 *
 * ⛔ IT IS NOT A CALL-SITE COUNT. A grep for `router.refresh` in the source
 * finds several sites and tells you nothing — most are on paths this scenario
 * never takes, and the one that fires a SECOND time (the poll's resume) is not
 * even in the composer's file. This renders the whole surface, drives a real
 * success through `BetComposer`, and counts what actually fires.
 *
 * ⇒ THE CONVERSION IS FIXED AND STATED ONCE: `/m/[slug]/page.tsx` calls
 * `loadDebateView` exactly once per render, so ONE refresh is ONE
 * `loadDebateView`, plus the layout re-execution that rides every refresh
 * (12–14 round trips per tick, measured at F-DEBATE-4). The refresh count is
 * therefore the multiplicand, and holding it constant is the whole budget.
 *
 * ⚠⚠ MEASURED BEFORE THE BUILD, AGAINST THE UNCHANGED TREE: **2**. The composer's
 * own refresh, plus the poll's resume the instant `openSide` cleared. FEED-1
 * moves WHEN the second one fires — dismissal instead of success — and the whole
 * claim of this file is that it does not change HOW MANY.
 *
 * ⛔ THE CEILING, STATED: this proves the COUNT, never the CONTENT. jsdom runs
 * no server, so a refresh here returns whatever the harness hands back. That
 * `loadDebateView` produces a correct post is a browser claim and is listed for
 * the morning pass.
 */

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

import { COMPOSER_COPY } from "@/components/debate/composer/copy";
import { DebateView } from "@/components/debate/DebateView";
import type { DebateViewModel } from "@/components/debate/types";

import { stubWireFetch, TITLE, VIEWER } from "../../composer/render/_harness";
import { baseModel, modelWithPost, newPost, placeOk } from "./_posted-fixtures";

const POSTED_ID = "cmt-just-posted";

beforeEach(() => {
	vi.useFakeTimers();
	refreshMock.mockReset();
	refreshMock.mockImplementation(() => undefined);
	Object.defineProperty(document, "hidden", {
		configurable: true,
		get: () => false,
	});
});

afterEach(() => {
	cleanup();
	vi.useRealTimers();
	vi.unstubAllGlobals();
	Reflect.deleteProperty(document, "hidden");
});

function view(model: DebateViewModel) {
	return (
		<DebateView
			model={model}
			viewer={VIEWER}
			initialPostId={null}
			ownPseudonym={null}
		/>
	);
}

/** Open the market composer, type a submittable argument, and submit it. */
async function placeOneBet() {
	fireEvent.click(screen.getByLabelText("Buy YES"));
	fireEvent.change(screen.getByLabelText<HTMLInputElement>("Argument title"), {
		target: { value: TITLE },
	});
	await act(async () => {
		fireEvent.click(screen.getByRole("button", { name: COMPOSER_COPY.submit }));
	});
}

describe("FEED-1 A1 — server reads per successful bet", () => {
	it("posted::one-successful-bet-STILL-costs-exactly-two-refreshes", async () => {
		stubWireFetch([placeOk(POSTED_ID)]);
		const first = baseModel();
		const { rerender } = render(view(first));

		// The surface is fresh at first paint — the poll's initial-mount guard.
		expect(refreshMock).toHaveBeenCalledTimes(0);

		await placeOneBet();

		// ⚠⚠ REFRESH ONE, AND THE FACT THAT THERE IS ONLY ONE IS ITSELF A GUARD.
		// Before FEED-1 the count here was 2: the composer refreshed AND the poll
		// resumed, because success cleared `openSide`. It is 1 now precisely
		// because the arm is HELD — so a build that closed the arm on success
		// would read 2 here and 3 by the end.
		expect(refreshMock).toHaveBeenCalledTimes(1);

		// The refresh lands, carrying the new post — a NEW model object, which is
		// exactly what a fresh RSC payload is.
		rerender(
			view(
				modelWithPost(
					newPost({ id: POSTED_ID, ordinal: 7, sideAtPostTime: "YES" }),
				),
			),
		);
		expect(
			screen.getByTestId("posted-confirmation"),
			"the confirmation must be up — otherwise the dismissal below proves nothing",
		).not.toBeNull();

		// ⛔ ARRIVING AT THE CONFIRMATION COSTS NOTHING. No second fetch, no second
		// refresh: the post came in on the payload the first refresh already asked
		// for.
		expect(refreshMock).toHaveBeenCalledTimes(1);

		fireEvent.click(screen.getByTestId("posted-dismiss"));

		// ⚠⚠ REFRESH TWO — the poll's resume, fired the instant the arm releases.
		// Same refresh that used to fire at success; it now fires when the author
		// says they are done looking.
		expect(refreshMock).toHaveBeenCalledTimes(2);
	});

	it("posted::the-poll-does-NOT-tick-while-the-confirmation-is-up", async () => {
		// The budget above counts the two deliberate refreshes. This one closes the
		// other way a round trip could be added: the 15s poll waking up underneath
		// a confirmation the author is still reading.
		stubWireFetch([placeOk(POSTED_ID)]);
		const { rerender } = render(view(baseModel()));
		await placeOneBet();
		rerender(
			view(
				modelWithPost(
					newPost({ id: POSTED_ID, ordinal: 7, sideAtPostTime: "YES" }),
				),
			),
		);
		expect(screen.queryByTestId("posted-confirmation")).not.toBeNull();
		expect(refreshMock).toHaveBeenCalledTimes(1);

		// Four full poll intervals with the confirmation on screen.
		act(() => {
			vi.advanceTimersByTime(15_000 * 4);
		});

		expect(refreshMock).toHaveBeenCalledTimes(1);
		expect(
			screen.queryByTestId("posted-confirmation"),
			"and it is still up — a poll that fired would have re-rendered under it",
		).not.toBeNull();

		// ⛔⛔ THE POSITIVE CONTROL, AND WITHOUT IT THIS TEST IS A COUNT THAT NEVER
		// MOVES FOR REASONS UNKNOWN. "The poll did not tick" reads identically
		// against a suspended poll and against a poll that cannot tick in this
		// harness at all — an unstubbed `document.hidden`, a `marketOpen` that
		// came through false, a fake-timer wiring that never reaches the interval.
		// Releasing the arm and advancing the SAME clock is what separates them.
		fireEvent.click(screen.getByTestId("posted-dismiss"));
		// The resume refresh, fired the instant the arm clears.
		expect(refreshMock).toHaveBeenCalledTimes(2);

		act(() => {
			vi.advanceTimersByTime(15_000 * 4);
		});
		expect(
			refreshMock.mock.calls.length,
			"the poll DOES tick once released — so its silence above was the suspension",
		).toBeGreaterThan(2);
	});
});
