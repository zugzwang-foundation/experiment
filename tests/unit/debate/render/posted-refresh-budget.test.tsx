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
 * ⛔ IT IS NOT A CALL-SITE COUNT. A grep for `router.refresh()` in `src/` finds
 * 17 call sites, 7 of them on this surface, and tells you nothing — most are on
 * paths this scenario never takes, and the one that fires a SECOND time (the
 * poll's resume) is not even in the composer's file. This renders the whole
 * surface, drives a real success through `BetComposer`, and counts what
 * actually fires.
 *
 * ⇒ THE CONVERSION IS FIXED AND STATED ONCE: `/m/[slug]/page.tsx` calls
 * `loadDebateView` exactly once per render, so ONE refresh is ONE
 * `loadDebateView`, plus the layout re-execution that rides every refresh
 * (12–14 round trips per tick, measured at F-DEBATE-4). The refresh count is
 * therefore the multiplicand, and holding it constant is the whole budget.
 *
 * ⚠⚠ THE NUMBER HAS NEVER MOVED, THROUGH TWO DIFFERENT DESIGNS: **2**.
 *   · pre-FEED-1 — the composer's refresh, then the poll's resume on close.
 *   · FEED-1     — the host's refresh, then the poll's resume on DISMISSAL,
 *                  because the arm was held open until the author dismissed.
 *   · FEED-2     — the host's refresh, and the poll's resume on close again,
 *                  both at the success, because nothing is held any more.
 * ⇒ FEED-2 moves the second one BACK to where it was. What this file pins is
 * that neither redesign changed HOW MANY.
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

// R2-CHEAP-POLL — a poll tick asks `/m/<slug>/version` and refreshes only on a
// change. These tests count refreshes, so the stub reports a change every time
// and the counts read as they did before the check existed.
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

import { COMPOSER_COPY } from "@/components/debate/composer/copy";
import { DebateView } from "@/components/debate/DebateView";
import type { DebateViewModel } from "@/components/debate/types";
import { POLL_INTERVAL_MS_DEBATE_VIEW } from "@/server/config/limits";

import { stubWireFetch, TITLE, VIEWER } from "../../composer/render/_harness";
import { baseModel, modelWithPost, newPost, placeOk } from "./_posted-fixtures";

const POSTED_ID = "cmt-just-posted";

beforeEach(async () => {
	versionTick = 0;
	fetchMock.mockClear();
	vi.stubGlobal("fetch", fetchMock);
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
async function placeOneBet(wire: ReturnType<typeof stubWireFetch>) {
	fireEvent.click(screen.getByLabelText("Buy YES"));
	fireEvent.change(screen.getByLabelText<HTMLInputElement>("Argument title"), {
		target: { value: TITLE },
	});
	await act(async () => {
		fireEvent.click(screen.getByRole("button", { name: COMPOSER_COPY.submit }));
	});
	// ⚠ A refresh COUNT is exactly the shape that passes when nothing happened —
	// zero bets and zero refreshes agree. The receipt is what makes the number
	// mean something.
	expect(
		wire.mock.calls.filter(([u]) => String(u).includes("/api/bets/place")),
		"the bet must actually have gone to the wire",
	).toHaveLength(1);
}

describe("FEED-2 — server reads per successful bet", () => {
	it("posted::one-successful-bet-STILL-costs-exactly-two-refreshes", async () => {
		const wire = stubWireFetch([placeOk(POSTED_ID)]);
		const { rerender } = render(view(baseModel()));

		// The surface is fresh at first paint — the poll's initial-mount guard.
		expect(refreshMock).toHaveBeenCalledTimes(0);

		await placeOneBet(wire);
		// The poll\'s resume now asks the version route before refreshing.
		await act(async () => {
			await Promise.resolve();
			await Promise.resolve();
			await Promise.resolve();
		});

		// ⚠⚠ BOTH, AT THE SUCCESS, and the fact that they are both here is itself
		// the guard. FEED-1 read **1** at this point, because the arm was held and
		// the poll stayed suspended until the author dismissed a panel. With
		// nothing held, the composer closes, the poll un-suspends, and its resume
		// refresh fires immediately — exactly as it did before FEED-1 existed.
		//   1. the host's refresh, from `onPosted` — how the new post is fetched;
		//   2. the poll's resume, fired the instant `openSide` clears.
		expect(refreshMock).toHaveBeenCalledTimes(2);

		// ⛔ ARRIVING AT THE CARD COSTS NOTHING. The payload the first refresh
		// already asked for carries the post; the jump is a cursor move, not a
		// read. A third call here would mean a round trip was added.
		rerender(
			view(
				modelWithPost(
					newPost({ id: POSTED_ID, ordinal: 7, sideAtPostTime: "YES" }),
				),
			),
		);
		expect(refreshMock).toHaveBeenCalledTimes(2);
	});

	it("posted::the-poll-resumes-its-ORDINARY-cadence-after-the-bet", async () => {
		// ⛔ The counterpart to FEED-1's "the poll does NOT tick while the
		// confirmation is up". That property is gone because the state it
		// described is gone — and its absence is the thing now worth pinning:
		// after a bet the surface is live again, on its ordinary clock.
		const wire = stubWireFetch([placeOk(POSTED_ID)]);
		const { rerender } = render(view(baseModel()));
		await placeOneBet(wire);
		// The poll\'s resume now asks the version route before refreshing.
		await act(async () => {
			await Promise.resolve();
			await Promise.resolve();
			await Promise.resolve();
		});
		rerender(
			view(
				modelWithPost(
					newPost({ id: POSTED_ID, ordinal: 7, sideAtPostTime: "YES" }),
				),
			),
		);
		expect(refreshMock).toHaveBeenCalledTimes(2);

		await act(async () => {
			vi.advanceTimersByTime(POLL_INTERVAL_MS_DEBATE_VIEW);
		});

		// ⚠ The third is NOT charged to the bet — it is the 30 s poll doing its
		// ordinary job on a surface with nothing held.
		expect(refreshMock).toHaveBeenCalledTimes(3);
	});
});
