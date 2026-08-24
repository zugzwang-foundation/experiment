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
	MODEL_TITLE,
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
	// ⚠ `syncPostParam` writes `?post=<ordinal>` through `history.replaceState`,
	// and jsdom carries one URL across the whole file. Today the ordinal
	// assertion runs first and reads a clean URL; a SECOND one added later would
	// read the previous test's value and pass without the view writing anything.
	// Reset so that test does not exist waiting to be written.
	history.replaceState(null, "", "/");
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

/**
 * Type a submittable argument into the open composer and submit it.
 *
 * ⛔⛔ AND ASSERT THAT THE BET ACTUALLY WENT, which is not decoration. Every
 * OTHER test in this file reads a state only a committed bet can produce — a
 * confirmation, a fallback close, a dismisser — so a submit that silently did
 * nothing (a disabled control, a floor gate, a confirm step nobody clicked)
 * reds them on its own. `posted::the-slot-is-HELD` is the exception: an open
 * composer with no confirmation IS its expected post-state, so it passed
 * identically whether or not a bet was ever placed. Measured — deleting the
 * click from this helper reds ELEVEN of the twelve tests in this file and
 * leaves that one GREEN.
 *
 * ⇒ The receipt is read here, once, where every caller inherits it. One POST to
 * `/api/bets/place` and exactly one `router.refresh()` — the host's, fired from
 * `onPosted`. The composer no longer refreshes and the poll is suspended, so
 * that count has one source and reading it is reading "the success path ran".
 */
async function submitOpenComposer(fetchStub: ReturnType<typeof stubWireFetch>) {
	const refreshesBefore = refreshMock.mock.calls.length;
	fireEvent.change(screen.getByLabelText<HTMLInputElement>("Argument title"), {
		target: { value: TITLE },
	});
	await act(async () => {
		fireEvent.click(screen.getByRole("button", { name: COMPOSER_COPY.submit }));
	});
	expect(
		fetchStub.mock.calls.filter(([url]) =>
			String(url).includes("/api/bets/place"),
		),
		"the bet must actually have gone to the wire",
	).toHaveLength(1);
	expect(
		refreshMock.mock.calls.length,
		"…and the host must have asked for the new model — that IS `onPosted` firing",
	).toBe(refreshesBefore + 1);
}

/** Open the MARKET-arm composer on YES and submit. */
async function placeMarketBet(fetchStub: ReturnType<typeof stubWireFetch>) {
	fireEvent.click(screen.getByLabelText("Buy YES"));
	await submitOpenComposer(fetchStub);
}

/** Open the REPLY-arm composer (Support on a YES parent ⇒ a YES bet) and submit. */
async function placeReplyBet(fetchStub: ReturnType<typeof stubWireFetch>) {
	fireEvent.click(screen.getByLabelText("Support — bet YES"));
	await submitOpenComposer(fetchStub);
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
		const wire = stubWireFetch([placeOk(POSTED_ID)]);
		const { rerender } = render(view(baseModel()));
		await placeMarketBet(wire);

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
		expect(card?.querySelector("h3")?.textContent).toBe(MODEL_TITLE);
		// ⛔ …which is NOT the string the composer typed. Those are the same value
		// in life; they are split here precisely so this line can tell "rendered
		// from the model" apart from "rendered from the draft I still have in
		// hand" — the reconstruction this feature exists to refuse.
		expect(html).not.toContain(TITLE);
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

	it("posted::the-live-composer-is-UNMOUNTED-under-the-confirmation", async () => {
		// ⛔⛔ THE LIVE MONEY FORM IS GONE, ASSERTED DIRECTLY. Nothing above says
		// this: the confirmed test reads only inside the confirmation card, and
		// `composer-slot.test.tsx` "proves" it by passing `composer: null`, which
		// is not the shape `DebateView` passes — `openSide` is HELD, so the host
		// hands `ComposerSlot` a live `<BetComposer>` element throughout.
		//
		// ⚠ MEASURED: with `ComposerSlot` rendering `<>{composer}{confirmation}</>`
		// while confirmed, four tests in this file DO go red — but every one of
		// them fails on `expected undefined to be 'closed'` or `expected null to
		// be '7'`, which are downstream artefacts of `composerBusy` staying true.
		// None of them names the defect. A true refusal reported with a misleading
		// cause is itself a defect (O-3), and a guard that only fires by accident
		// stops firing the day the accident is refactored away.
		const wire = stubWireFetch([placeOk(POSTED_ID)]);
		const { rerender } = render(view(baseModel()));
		await placeMarketBet(wire);
		// The positive control: it IS mounted during the wait, so its absence
		// below is a swap rather than a form that was never there.
		expect(
			screen.queryByRole("button", { name: COMPOSER_COPY.submit }),
		).not.toBeNull();

		rerender(
			view(
				modelWithPost(
					newPost({ id: POSTED_ID, ordinal: 7, sideAtPostTime: "YES" }),
				),
			),
		);

		expect(confirmation()).not.toBeNull();
		expect(
			screen.queryByRole("button", { name: COMPOSER_COPY.submit }),
			"a submittable bet form must not survive underneath the confirmation",
		).toBeNull();
		expect(screen.queryByLabelText("Argument title")).toBeNull();
		// One occupant in the slot, not two.
		expect(slot()?.children.length).toBe(1);
	});

	it("posted::the-slot-is-HELD-until-the-refresh-lands", async () => {
		const wire = stubWireFetch([placeOk(POSTED_ID)]);
		render(view(baseModel()));
		await placeMarketBet(wire);

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

		// ⛔ AND THE HOLD IS NOT A TIMER, which is the design decision this half
		// pins. The plan rejected a `setTimeout` bound on the wait outright ("a
		// second source of truth about whether the refresh landed"). Without the
		// clock being moved, a build that closed the slot after N ms would pass
		// every assertion above. Four full poll intervals with no model.
		const refreshesDuringTheWait = refreshMock.mock.calls.length;
		act(() => {
			vi.advanceTimersByTime(POLL_INTERVAL_MS_DEBATE_VIEW * 4);
		});
		expect(
			slot(),
			"the wait is unbounded by design — no timer closes it",
		).not.toBeNull();
		expect(slot()?.getAttribute("data-state")).toBe("open");
		expect(confirmation()).toBeNull();
		// …and nothing polled underneath it either.
		expect(refreshMock).toHaveBeenCalledTimes(refreshesDuringTheWait);
	});

	it("posted::the-post-ABSENT-from-the-refreshed-model-closes-the-slot", async () => {
		// ⛔ THE FALLBACK. A refresh landed and the comment is not in it — moderation
		// between post and refresh, a projection lag, any reason. There is nothing
		// TRUE to show, so the slot closes exactly as it did before FEED-1.
		// The wrong answer this rejects is HANGING: a slot held open forever
		// waiting for a post that is never coming.
		const wire = stubWireFetch([placeOk(POSTED_ID)]);
		const { rerender } = render(view(baseModel()));
		await placeMarketBet(wire);
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
		const wire = stubWireFetch([placeOk(POSTED_ID)]);
		const { rerender } = render(view(baseModel()));
		await placeMarketBet(wire);

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
		const wire = stubWireFetch([placeOk(POSTED_ID)]);
		const { rerender } = render(view(baseModel()));
		await placeMarketBet(wire);
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
		const wire = stubWireFetch([placeOk(POSTED_ID)]);
		const { rerender } = render(view(baseModel()));
		await placeMarketBet(wire);
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

	it("posted::entering-the-post-from-the-confirmation-releases-the-slot", async () => {
		// RF-5's fourth exit. ⚠ WHAT THIS DOES AND DOES NOT PROVE, stated because
		// the first draft of it claimed the second: it proves `enterPost` clears
		// `openSide`, so the slot leaves. It does NOT prove `posted` was retired —
		// measured, with `setPosted(null)` deleted from the identity adjustment
		// this test stays GREEN. The retirement is pinned by the test below it,
		// which is the only one that can see it.
		const wire = stubWireFetch([placeOk(POSTED_ID)]);
		const { rerender } = render(view(baseModel()));
		await placeMarketBet(wire);
		rerender(
			view(
				modelWithPost(
					newPost({ id: POSTED_ID, ordinal: 7, sideAtPostTime: "YES" }),
				),
			),
		);
		const card = confirmation();
		expect(card).not.toBeNull();

		fireEvent.click(card?.querySelector("h3")?.parentElement as HTMLElement);

		// It leaves as a corpse first — the same 260ms every occupant gets.
		expect(slot()?.getAttribute("data-state")).toBe("closed");
		settleExit();
		expect(
			confirmation(),
			"the confirmation does not travel into the post view",
		).toBeNull();
		expect(slot()).toBeNull();
	});

	it("posted::a-STALE-posted-never-re-shows-when-the-same-arm-re-opens", async () => {
		// ⛔⛔ AMBIGUITY #5, AND IT HAD NO GUARD OF ANY KIND. The plan's own reason
		// for adjusting state rather than deriving: "Merely IGNORING a `posted`
		// whose identity no longer matches leaves it in state — so closing the YES
		// composer and re-opening YES would produce a MATCHING identity again and
		// re-show a confirmation the author already dismissed."
		//
		// ⚠⚠ MEASURED: deleting `setPosted(null)` from the render-time identity
		// adjustment leaves every other test in this file, in
		// `posted-refresh-budget.test.tsx` and in `composer-slot.test.tsx` GREEN —
		// 24 of 24 — while this path re-opens BUY YES onto a confirmation of a bet
		// the author already left, with no composer and therefore no way to bet
		// from that arm at all.
		//
		// ⚠ THE ROUTE MATTERS AND IT IS NOT CONTRIVED. Leaving via the card title
		// is an INSIDE-the-slot interaction, so the outside-dismisser deliberately
		// does not fire and `posted` survives on the retirement alone. From there,
		// `click` without a preceding `pointerdown` is exactly what a keyboard
		// reader generates (Enter on a button fires `click` and nothing else), so
		// the dismisser is not a second line of defence on this path.
		const wire = stubWireFetch([placeOk(POSTED_ID)]);
		const { rerender } = render(view(baseModel()));
		await placeMarketBet(wire);
		rerender(
			view(
				modelWithPost(
					newPost({ id: POSTED_ID, ordinal: 7, sideAtPostTime: "YES" }),
				),
			),
		);
		const card = confirmation();
		expect(card).not.toBeNull();

		// …enter the post from the confirmation's own title (inside the slot)…
		fireEvent.click(card?.querySelector("h3")?.parentElement as HTMLElement);
		settleExit();
		// …return to the market arm…
		fireEvent.click(screen.getByLabelText("Back to the market"));
		settleExit();
		// …and re-open the SAME arm the bet was placed from.
		fireEvent.click(screen.getByLabelText("Buy YES"));

		expect(
			confirmation(),
			"the retired confirmation must not come back on a matching identity",
		).toBeNull();
		expect(slot()?.getAttribute("data-state")).toBe("open");
		expect(
			screen.queryByRole("button", { name: COMPOSER_COPY.submit }),
			"BUY YES opens a COMPOSER — the author can bet again",
		).not.toBeNull();
	});

	it("posted::an-outside-touch-releases-the-author-even-BEFORE-the-post-arrives", async () => {
		// ⛔⛔ THE WALL: never leave the author stuck. Between the 200 and the model
		// landing, `BetComposer` is still mounted with its × disabled by its own
		// in-flight guard — the one window with no control of the author's own. The
		// dismisser is armed from the moment of SUCCESS, not from the moment of
		// confirmation, precisely to close it.
		const wire = stubWireFetch([placeOk(POSTED_ID)]);
		render(view(baseModel()));
		await placeMarketBet(wire);
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
		const wire = stubWireFetch([placeOk(POSTED_ID)]);
		const { container, rerender } = render(view(baseModel()));
		await placeMarketBet(wire);
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
		// ⚠ AND IT MUST HAVE SOMEWHERE TO GO. `/^1 \/ \d+$/` matches "1 / 1", a
		// single-card column that cannot advance whatever the freeze does — the
		// regex admits the one shape that would make everything below vacuous.
		expect(Number(before.split(" / ")[1])).toBeGreaterThan(1);

		advance(ADVANCE_MS * 2);

		// ⛔ Two full cadences with nothing moving. The wrong answer this rejects is
		// the carousel stepping cards behind a card the author is reading.
		expect(readout()).toBe(before);
		expect(confirmation()).not.toBeNull();

		// ⛔⛔ THE POSITIVE CONTROL, AND WITHOUT IT THE ASSERTION ABOVE PROVES
		// NOTHING. "It did not move" is the same green whether the freeze held or
		// the carousel was never running in this harness at all — a fake-timer
		// wiring change, a hidden-document default, a cadence that is not the one
		// the helper steps at. Releasing the slot and advancing the SAME clock by
		// the SAME amount is the only thing that separates the two readings.
		fireEvent.click(screen.getByTestId("posted-dismiss"));
		settleExit();
		const released = readout();
		advance(ADVANCE_MS * 2);
		expect(
			readout(),
			"the column advances once released — so its stillness above was the freeze",
		).not.toBe(released);
	});
});

describe("FEED-1 — both arms, one implementation", () => {
	it("posted::a-reply-confirms-in-its-own-arm-with-the-REPLY-card", async () => {
		// ⛔ The wrong answer this rejects is a market-only build: `ComposerSlot` is
		// shared, so a third state added there covers both arms for free — but the
		// LOOKUP and the CARD are per-arm, and only driving the reply arm proves
		// they were wired.
		const wire = stubWireFetch([placeOk(REPLY_ID)]);
		const { rerender } = render(view(baseModel(), PARENT_ID));
		await placeReplyBet(wire);

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
		// ⛔ …and NOT one of the two support replies the parent already carried.
		// The market arm has `not.toContain(FIRST_POST_TITLE)` for exactly this
		// wrong answer — "shows the first one in the list" — and the reply arm had
		// no equivalent, even though `modelWithReply` appends to a support list
		// that is already two deep (`cmt-r1-1`, `cmt-r1-2`).
		expect(
			card?.innerHTML ?? "",
			"the confirmation shows THIS reply, not support[0]",
		).not.toContain("TealOwl118");

		// …and it dismisses the same way, releasing the reply arm.
		fireEvent.click(screen.getByTestId("posted-dismiss"));
		expect(slot()?.getAttribute("data-state")).toBe("closed");
		settleExit();
		expect(confirmation()).toBeNull();
		expect(slot()).toBeNull();
	});
});
