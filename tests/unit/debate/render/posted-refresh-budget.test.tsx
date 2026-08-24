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
 * finds three sites and tells you nothing — two of them are on paths this
 * scenario never takes, and the one that fires twice (the poll's resume) is not
 * even in the composer's file. This renders the whole surface, drives a real
 * success through `BetComposer`, and counts what actually fires.
 *
 * ⇒ THE CONVERSION IS FIXED AND STATED ONCE: `/m/[slug]/page.tsx` calls
 * `loadDebateView` exactly once per render, so ONE refresh is ONE
 * `loadDebateView`, plus the layout re-execution that rides every refresh
 * (12–14 round trips per tick, measured at F-DEBATE-4). The refresh count is
 * therefore the multiplicand, and holding it constant is the whole budget.
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

import { stubWireFetch, TITLE, VIEWER } from "../../composer/render/_harness";
import { mumbaiMetroModel } from "../../debate-export/_fixtures/mumbai-metro.input";

/** The §4.4 success envelope `place()` actually returns (`PlaceResult`). */
function placeOk(commentId: string) {
	return {
		status: 200,
		body: {
			ok: true,
			data: {
				betId: "bet-0001",
				commentId,
				side: "YES",
				sharesBought: "20.000000000000000000",
				newPrice: "0.560000000000000000",
				parentCommentId: null,
			},
		},
	};
}

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
	it("posted::one-successful-bet-costs-exactly-two-refreshes", async () => {
		stubWireFetch([placeOk("cmt-new")]);
		render(
			<DebateView
				model={mumbaiMetroModel}
				viewer={VIEWER}
				initialPostId={null}
				ownPseudonym={null}
			/>,
		);

		// The surface is fresh at first paint — the poll's initial-mount guard.
		expect(refreshMock).toHaveBeenCalledTimes(0);

		await placeOneBet();

		// ⚠⚠ THE BUDGET. TWO, and both are load-bearing:
		//   1. the success path's own refresh — how the new post reaches the model;
		//   2. the poll's RESUME refresh, fired the instant the last composer stops
		//      suspending it (`DebatePoll`, wasSuspended → immediate refresh).
		// FEED-1 moves WHEN the second one fires (dismissal, not success) and must
		// not change HOW MANY there are. A third would mean a round trip was added.
		expect(refreshMock).toHaveBeenCalledTimes(2);
	});
});
