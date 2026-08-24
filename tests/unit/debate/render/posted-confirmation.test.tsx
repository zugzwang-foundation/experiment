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
 * FEED-1 — THE AUTHOR SEES THE POST THEY JUST MADE.
 *
 * Asserted through the REAL `DebateView`, driven by a REAL submit against the
 * stubbed wire, because every claim here is about how four things relate: the
 * composer's success, the host's refresh, the arriving model, and the slot. A
 * component rendered alone exhibits none of them.
 *
 * ⚠⚠ A REFRESH IS MODELLED AS A NEW `model` PROP, which is exactly what it is:
 * `router.refresh()` re-runs `/m/[slug]` server-side and the payload arrives as
 * new props. `poll.test.tsx` established that harness; this reuses it rather
 * than re-deriving it, so the two files cannot disagree about what a landed
 * refresh is.
 *
 * ⛔ THE CEILING: jsdom performs no layout and `router.refresh` is a spy. These
 * prove the WIRING — right node, right card, right exits — never that a real
 * server produced a correct post or that it was drawn correctly. That is the
 * morning browser pass (docs/plans/FEED-1.md §7).
 *
 * No jest-dom in this repo (AGENTS.md §9) — plain DOM assertions only.
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

import { COMPOSER_COPY, POSTED_COPY } from "@/components/debate/composer/copy";
import { DebateView } from "@/components/debate/DebateView";
import type { DebateViewModel } from "@/components/debate/types";
import { POLL_INTERVAL_MS_DEBATE_VIEW } from "@/server/config/limits";

import { stubWireFetch, TITLE, VIEWER } from "../../composer/render/_harness";
import {
	baseModel,
	modelUnchanged,
	modelWithPost,
	modelWithReply,
	newPost,
	newRemovedPost,
	newReply,
	placeOk,
} from "./_posted-fixtures";

const POSTED_ID = "cmt-just-posted";
const REPLY_ID = "cmt-just-replied";
/** The parent for the reply arm — a YES post in the shipped fixture. */
const PARENT_ID = "cmt-p1";
/** The first post in the model's own order — what a naive "take posts[0]" shows. */
const FIRST_POST_TITLE = "The corridor is built for this volume";

const ADVANCE_MS = POLL_INTERVAL_MS_DEBATE_VIEW;
/**
 * ⛔ SMALL STEPS, EACH IN ITS OWN `act()`. A single big jump SILENTLY
 * UNDER-COUNTS: the advance timer re-arms through React, and `act()` flushes
 * effects only at its end, so three cadences of jump produce one advance. The
 * reason is recorded at length in `auto-advance.test.tsx`; it cost two false
 * REDs there and would read as a product defect here too.
 */
const STEP_MS = ADVANCE_MS / 60;
function advance(ms: number) {
	const steps = Math.round(ms / STEP_MS);
	for (let i = 0; i < steps; i++) {
		act(() => {
			vi.advanceTimersByTime(STEP_MS);
		});
	}
}

beforeEach(() => {
	vi.useFakeTimers();
	refreshMock.mockReset();
	refreshMock.mockImplementation(() => undefined);
	window.scrollTo = () => undefined;
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

function view(model: DebateViewModel, initialPostId: string | null = null) {
	return (
		<DebateView
			model={model}
			viewer={VIEWER}
			initialPostId={initialPostId}
			ownPseudonym={null}
		/>
	);
}

/** Type a submittable argument into the open composer and submit it. */
async function submitOpenComposer() {
	fireEvent.change(screen.getByLabelText<HTMLInputElement>("Argument title"), {
		target: { value: TITLE },
	});
	await act(async () => {
		fireEvent.click(screen.getByRole("button", { name: COMPOSER_COPY.submit }));
	});
}

/** Open the MARKET-arm composer on YES and submit. */
async function placeMarketBet() {
	fireEvent.click(screen.getByLabelText("Buy YES"));
	await submitOpenComposer();
}

/** Open the REPLY-arm composer (Support on a YES parent ⇒ a YES bet) and submit. */
async function placeReplyBet() {
	fireEvent.click(screen.getByLabelText("Support — bet YES"));
	await submitOpenComposer();
}

const confirmation = () => screen.queryByTestId("posted-confirmation");
const slot = () => document.querySelector('[data-testid="composer-slot"]');

/**
 * ⚠⚠ A DISMISSAL IS NOT AN UNMOUNT, AND THE FIRST DRAFT OF THREE TESTS BELOW GOT
 * THIS WRONG. `ComposerSlot` HOLDS the outgoing node for the ratified 260ms so
 * it can animate out, so `queryByTestId("posted-confirmation")` still finds the
 * confirmation immediately after a dismissal — as the corpse, which is exactly
 * what `composer-slot.test.tsx` pins as correct.
 *
 * ⇒ The dismissal is read where it actually registers — `data-state="closed"`,
 * on the same tick — and the disappearance is read after the exit. Asserting
 * only the second would have been a slower way to test the same thing; asserting
 * only the first would not prove the slot ever leaves.
 */
const EXIT_MS = 260;
function settleExit() {
	act(() => {
		vi.advanceTimersByTime(EXIT_MS);
	});
}

describe("FEED-1 — the confirmed state renders the REAL post", () => {
	it("posted::confirmed-renders-the-node-matching-the-receipt-commentId", async () => {
		stubWireFetch([placeOk(POSTED_ID)]);
		const { rerender } = render(view(baseModel()));
		await placeMarketBet();

		rerender(
			view(
				modelWithPost(
					newPost({
						id: POSTED_ID,
						ordinal: 7,
						sideAtPostTime: "YES",
						badge: "Contested",
					}),
				),
			),
		);

		const card = confirmation();
		expect(card).not.toBeNull();

		// The slot names the state the stylesheet keys on.
		expect(slot()?.getAttribute("data-state")).toBe("confirmed");
		// The header and the dismiss control, by their accessible names — the two
		// strings the register allows and no third.
		expect(card?.getAttribute("aria-label")).toBe(POSTED_COPY.header);
		expect(
			card
				?.querySelector('[data-testid="posted-dismiss"]')
				?.getAttribute("aria-label"),
		).toBe("Close");
		expect(
			card?.querySelector('[data-testid="posted-dismiss"]')?.textContent,
		).toBe(COMPOSER_COPY.close);

		// ⛔⛔ THE POST IS THE RECEIPT'S POST. Its title is the one that was typed…
		const html = card?.innerHTML ?? "";
		expect(card?.querySelector("h3")?.textContent).toBe(TITLE);
		// …and its BADGE is present. `badge` is ranking-computed over the whole
		// debate, so a client reconstruction could not produce it at all — this is
		// the single strongest evidence that the card came from the MODEL.
		expect(html).toContain("Contested");
		// ⛔ …and it is NOT simply the first post in the list, which is what a
		// build that forgot to match on `commentId` would show. Every other post
		// in the fixture carries `badge: null`, so the assertion above alone could
		// not tell them apart.
		expect(html).not.toContain(FIRST_POST_TITLE);

		// ⛔⛔ THE `ordinal` IS THE MODEL'S, AND THIS IS WHERE IT BECOMES VISIBLE.
		// It appears on no pixel of the card — it is the deep-link rank — so the
		// only way to read it is to enter the post and look at the URL the view
		// writes. A reconstruction guessing "one more than I have rendered" would
		// write a different number here, and nothing else in the DOM would differ.
		fireEvent.click(card?.querySelector("h3")?.parentElement as HTMLElement);
		expect(new URL(window.location.href).searchParams.get("post")).toBe("7");
	});

	it("posted::the-slot-is-HELD-until-the-refresh-lands", async () => {
		stubWireFetch([placeOk(POSTED_ID)]);
		render(view(baseModel()));
		await placeMarketBet();

		// No new model yet. ⛔ The slot must NOT have closed (that is the old
		// behaviour) and must NOT be showing a confirmation it cannot have data
		// for. It shows the composer's own in-flight state, which is the truth.
		expect(confirmation()).toBeNull();
		expect(slot()).not.toBeNull();
		expect(slot()?.getAttribute("data-state")).toBe("open");
		expect(
			screen.queryByRole("button", { name: COMPOSER_COPY.submit }),
			"the composer is still mounted — it IS the wait state",
		).not.toBeNull();
	});

	it("posted::the-post-ABSENT-from-the-refreshed-model-closes-the-slot", async () => {
		// ⛔ THE FALLBACK. A refresh landed and the comment is not in it — moderation
		// between post and refresh, a projection lag, any reason. There is nothing
		// TRUE to show, so the slot closes exactly as it did before FEED-1.
		// The wrong answer this rejects is HANGING: a slot held open forever
		// waiting for a post that is never coming.
		stubWireFetch([placeOk(POSTED_ID)]);
		const { rerender } = render(view(baseModel()));
		await placeMarketBet();
		expect(slot()).not.toBeNull();

		// A NEW model object that simply does not carry the comment.
		rerender(view(modelUnchanged()));
		act(() => {
			vi.advanceTimersByTime(400);
		});

		expect(confirmation()).toBeNull();
		expect(slot(), "the slot is gone — closed, not hung").toBeNull();
		expect(
			screen.queryByRole("button", { name: COMPOSER_COPY.submit }),
			"and the composer went with it",
		).toBeNull();
	});

	it("posted::a-REMOVED-match-never-renders-and-takes-the-fallback", async () => {
		// ⛔⛔ SC-1. The comment IS in the refreshed model — as the REMOVED variant,
		// which carries no body, no author and no title at the type level. The
		// confirmed path admits only the PRESENT variant, so this is not a policy
		// decision made at render time: there is no field for withheld content to
		// travel in. It falls through to the same close as an absent post.
		stubWireFetch([placeOk(POSTED_ID)]);
		const { rerender } = render(view(baseModel()));
		await placeMarketBet();

		rerender(
			view(
				modelWithPost(
					newRemovedPost({ id: POSTED_ID, ordinal: 7, sideAtPostTime: "YES" }),
				),
			),
		);
		act(() => {
			vi.advanceTimersByTime(400);
		});

		expect(confirmation()).toBeNull();
		expect(slot()).toBeNull();
		// ⚠ SC-1's second obligation: assert the BODY's absence, not the row's. A
		// row-level assertion would not catch a second read path that rendered the
		// text somewhere else on the surface.
		expect(document.body.innerHTML).not.toContain(TITLE);
	});
});

describe("FEED-1 — every path out terminates", () => {
	it("posted::the-dismiss-control-closes-the-slot-and-releases-the-surface", async () => {
		stubWireFetch([placeOk(POSTED_ID)]);
		const { rerender } = render(view(baseModel()));
		await placeMarketBet();
		rerender(
			view(
				modelWithPost(
					newPost({ id: POSTED_ID, ordinal: 7, sideAtPostTime: "YES" }),
				),
			),
		);
		expect(confirmation()).not.toBeNull();
		const refreshesBefore = refreshMock.mock.calls.length;

		fireEvent.click(screen.getByTestId("posted-dismiss"));

		// The dismissal registers on this tick — the slot is leaving.
		expect(slot()?.getAttribute("data-state")).toBe("closed");
		// The poll's resume refresh — the surface is live again, which is the
		// observable proof that the arm released rather than merely hiding.
		expect(refreshMock).toHaveBeenCalledTimes(refreshesBefore + 1);

		settleExit();
		expect(confirmation()).toBeNull();
		expect(slot()).toBeNull();
	});

	it("posted::an-interaction-OUTSIDE-the-slot-dismisses-and-one-INSIDE-does-NOT", async () => {
		// ⚠⚠ THE TWO HALVES ARE IN ONE TEST ON PURPOSE. A "does not dismiss"
		// assertion written alone passes just as happily against a listener that
		// was never armed at all. The outside half is the positive control that
		// proves the mechanism exists; only then does the inside half mean
		// anything.
		stubWireFetch([placeOk(POSTED_ID)]);
		const { rerender } = render(view(baseModel()));
		await placeMarketBet();
		rerender(
			view(
				modelWithPost(
					newPost({ id: POSTED_ID, ordinal: 7, sideAtPostTime: "YES" }),
				),
			),
		);
		const card = confirmation();
		expect(card).not.toBeNull();

		// INSIDE the slot — the card's own header. This click belongs to the slot.
		fireEvent.pointerDown(card as HTMLElement);
		expect(
			confirmation(),
			"a touch on the confirmation itself must not dismiss it",
		).not.toBeNull();

		// A scroll INSIDE the slot is the slot's too.
		fireEvent.wheel(card as HTMLElement);
		expect(confirmation()).not.toBeNull();

		// OUTSIDE — anywhere else on the surface. THE POSITIVE CONTROL.
		fireEvent.pointerDown(document.body);
		expect(
			slot()?.getAttribute("data-state"),
			"and a touch elsewhere DOES — without this the assertions above are vacuous",
		).toBe("closed");
		settleExit();
		expect(confirmation()).toBeNull();
	});

	it("posted::an-outside-touch-releases-the-author-even-BEFORE-the-post-arrives", async () => {
		// ⛔⛔ THE WALL: never leave the author stuck. Between the 200 and the model
		// landing, `BetComposer` is still mounted with its × disabled by its own
		// in-flight guard — the one window with no control of the author's own. The
		// dismisser is armed from the moment of SUCCESS, not from the moment of
		// confirmation, precisely to close it.
		stubWireFetch([placeOk(POSTED_ID)]);
		render(view(baseModel()));
		await placeMarketBet();
		expect(slot()).not.toBeNull();
		expect(confirmation()).toBeNull();

		fireEvent.pointerDown(document.body);
		act(() => {
			vi.advanceTimersByTime(400);
		});

		expect(slot(), "the author is out — no post needed to leave").toBeNull();
	});
});

describe("FEED-1 — the surface holds still while the author reads", () => {
	it("posted::the-column-does-NOT-advance-while-the-confirmation-is-up", async () => {
		stubWireFetch([placeOk(POSTED_ID)]);
		const { container, rerender } = render(view(baseModel()));
		await placeMarketBet();
		rerender(
			view(
				modelWithPost(
					newPost({ id: POSTED_ID, ordinal: 7, sideAtPostTime: "YES" }),
				),
			),
		);
		expect(confirmation()).not.toBeNull();

		/** The surviving column's `n / total` — the only node reporting a position. */
		const readout = () =>
			container
				.querySelector('[data-testid="scroll-rail"] [aria-live="polite"]')
				?.textContent?.replace(/\s+/g, " ") ?? "";

		const before = readout();
		expect(
			before,
			"the opposite column must be paging for this to mean anything",
		).toMatch(/^1 \/ \d+$/);

		advance(ADVANCE_MS * 2);

		// ⛔ Two full cadences with nothing moving. The wrong answer this rejects is
		// the carousel stepping cards behind a card the author is reading.
		expect(readout()).toBe(before);
		expect(confirmation()).not.toBeNull();
	});
});

describe("FEED-1 — both arms, one implementation", () => {
	it("posted::a-reply-confirms-in-its-own-arm-with-the-REPLY-card", async () => {
		// ⛔ The wrong answer this rejects is a market-only build: `ComposerSlot` is
		// shared, so a third state added there covers both arms for free — but the
		// LOOKUP and the CARD are per-arm, and only driving the reply arm proves
		// they were wired.
		stubWireFetch([placeOk(REPLY_ID)]);
		const { rerender } = render(view(baseModel(), PARENT_ID));
		await placeReplyBet();

		expect(
			confirmation(),
			"held until the reply arrives, same as a post",
		).toBeNull();

		const reply = newReply({ id: REPLY_ID, side: "YES" });
		rerender(view(modelWithReply(PARENT_ID, reply), PARENT_ID));

		const card = confirmation();
		expect(card).not.toBeNull();
		expect(slot()?.getAttribute("data-state")).toBe("confirmed");
		// ⛔ THE REPLY'S OWN CARD, not a post card. `ReplyCard` renders no `<h3>`
		// title — a post card in this slot would.
		expect(card?.querySelector("h3")).toBeNull();
		// The reply that was just made, identified by the one field only it has.
		expect(card?.innerHTML ?? "").toContain("CobaltLark733");

		// …and it dismisses the same way, releasing the reply arm.
		fireEvent.click(screen.getByTestId("posted-dismiss"));
		expect(slot()?.getAttribute("data-state")).toBe("closed");
		settleExit();
		expect(confirmation()).toBeNull();
		expect(slot()).toBeNull();
	});
});
