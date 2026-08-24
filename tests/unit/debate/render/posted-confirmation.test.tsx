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
	newRemovedPostCarryingBody,
	newReply,
	placeOk,
	WITHHELD_SENTINEL,
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
		// ⚠⚠ AND `aria-busy` IS THE ONLY THING SAYING SO. The comment here used to
		// read "it shows the composer's own in-flight state, which is the truth" —
		// asserting a rendering that does not exist: `ErrorStrip` returns null for
		// `phase: "in_flight"`, so the form is greyed and motionless and nothing on
		// screen distinguishes waiting from broken. The aria state is what makes
		// the window detectable at all; the visible affordance is OWED.
		expect(
			document
				.querySelector('[data-testid="composer-slot"] section')
				?.getAttribute("aria-busy"),
		).toBe("true");

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

it("posted::a-removed-row-that-STILL-CARRIES-a-body-never-puts-it-on-screen", async () => {
	// ⛔⛔ SC-1's SECOND OBLIGATION, AT THE RENDER LAYER. The sibling case above
	// uses a removed row with no body, so it can only assert the ROW's absence
	// — and a row-level assertion does not catch a second read path that draws
	// the text somewhere else. This one hands the view a row that is removed
	// AND carries withheld text, and asserts the TEXT never reaches the
	// document. `find-posted.test.ts` pins the same specimen one layer down at
	// the return value; both layers now hold.
	const fetchStub = stubWireFetch([placeOk(POSTED_ID)]);
	const { rerender } = render(view(baseModel()));
	await placeMarketBet(fetchStub);

	rerender(
		view(
			modelWithPost(
				newRemovedPostCarryingBody({
					id: POSTED_ID,
					ordinal: 7,
					sideAtPostTime: "YES",
				}),
			),
		),
	);
	act(() => {
		vi.advanceTimersByTime(400);
	});

	expect(
		document.body.innerHTML,
		"a withheld body must not reach the document by ANY path",
	).not.toContain(WITHHELD_SENTINEL);
	expect(confirmation()).toBeNull();
	expect(slot()).toBeNull();
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

	it("posted::ESCAPE-releases-the-author-in-the-WAIT-window-with-no-pointer-event", async () => {
		// ⛔⛔ THE CRITICAL ONE, AND THE FIRST BUILD OF THIS FEATURE FAILED IT.
		// The dismisser listened to pointerdown/wheel/touchmove only. Activating a
		// button from a keyboard dispatches `click` and NO `pointerdown`; keyboard
		// scrolling fires `scroll`, not `wheel`. So a keyboard-only reader had no
		// exit at all in the wait window — where the composer's own × is disabled
		// by its in-flight guard, its ESC handler is guarded on the same flag,
		// every host navigation no-ops on `composerBusy`, and the fallback is
		// waiting on a payload that by hypothesis never arrives.
		// ⇒ Placing a bet and then losing the connection trapped the reader.
		const fetchStub = stubWireFetch([placeOk(POSTED_ID)]);
		render(view(baseModel()));
		await placeMarketBet(fetchStub);
		expect(
			slot(),
			"the wait window — nothing has come back yet",
		).not.toBeNull();
		expect(confirmation()).toBeNull();

		// ⚠ NO pointer event anywhere in this test. That is the whole point: if the
		// only exit were a pointer listener, this could not pass.
		fireEvent.keyDown(document, { key: "Escape" });
		act(() => {
			vi.advanceTimersByTime(400);
		});

		expect(slot(), "Escape is the modality-independent exit").toBeNull();
	});

	it("posted::ESCAPE-dismisses-the-CONFIRMED-state-too", async () => {
		// Parity: Escape closes the composer and every dialog on this surface. A
		// confirmation that ignored it would be the one dismissible thing here that
		// does not answer the key a reader has already learned.
		const fetchStub = stubWireFetch([placeOk(POSTED_ID)]);
		const { rerender } = render(view(baseModel()));
		await placeMarketBet(fetchStub);
		rerender(
			view(
				modelWithPost(
					newPost({ id: POSTED_ID, ordinal: 7, sideAtPostTime: "YES" }),
				),
			),
		);
		expect(confirmation()).not.toBeNull();

		fireEvent.keyDown(document, { key: "Escape" });
		expect(slot()?.getAttribute("data-state")).toBe("closed");
		settleExit();
		expect(confirmation()).toBeNull();

		// THE POSITIVE CONTROL for the key itself: an unrelated key must NOT
		// dismiss, or the assertion above would hold for any keystroke at all.
	});

	it("posted::a-key-that-is-NOT-Escape-leaves-the-confirmation-alone", async () => {
		const fetchStub = stubWireFetch([placeOk(POSTED_ID)]);
		const { rerender } = render(view(baseModel()));
		await placeMarketBet(fetchStub);
		rerender(
			view(
				modelWithPost(
					newPost({ id: POSTED_ID, ordinal: 7, sideAtPostTime: "YES" }),
				),
			),
		);
		fireEvent.keyDown(document, { key: "a" });
		fireEvent.keyDown(document, { key: "Enter" });
		expect(slot()?.getAttribute("data-state")).toBe("confirmed");
		// …and Escape still works from the same state, which is what proves the two
		// assertions above are about the KEY and not about a dead listener.
		fireEvent.keyDown(document, { key: "Escape" });
		expect(slot()?.getAttribute("data-state")).toBe("closed");
	});

	it("posted::opening-the-lightbox-FROM-the-confirmation-does-not-destroy-it", async () => {
		// ⛔⛔ THE FEATURE'S OWN AFFORDANCE WAS DESTROYING THE FEATURE. The card in
		// the confirmation opens the image lightbox, which renders through a PORTAL
		// onto document.body — outside the slot. So closing the lightbox fired a
		// pointerdown the dismisser read as "the author touched something else",
		// and the post they had opened the image of was gone underneath it.
		const fetchStub = stubWireFetch([placeOk(POSTED_ID)]);
		const { rerender } = render(view(baseModel()));
		await placeMarketBet(fetchStub);
		rerender(
			view(
				modelWithPost(
					newPost({ id: POSTED_ID, ordinal: 7, sideAtPostTime: "YES" }),
				),
			),
		);
		expect(confirmation()).not.toBeNull();

		// Open a pop-up from the card the confirmation is holding.
		const knowMore = confirmation()?.querySelector<HTMLElement>(
			'[aria-label="Know more about this argument"]',
		);
		expect(
			knowMore,
			"the card must actually offer the affordance",
		).not.toBeNull();
		fireEvent.click(knowMore as HTMLElement);
		expect(
			document.querySelector('[data-slot="dialog-content"]'),
			"the pop-up opened — otherwise the assertion below proves nothing",
		).not.toBeNull();

		// A pointerdown on the portalled overlay: outside the slot, but it is the
		// author still looking at their own post.
		fireEvent.pointerDown(
			document.querySelector('[data-slot="dialog-content"]') as HTMLElement,
		);
		expect(
			slot()?.getAttribute("data-state"),
			"the confirmation survives its own pop-up",
		).toBe("confirmed");
	});

	it("posted::a-press-on-a-CONTROL-does-not-spend-a-refresh-dismissing-first", async () => {
		// ⚠ d5's own rule, and the same exclusion list `onDocClick` already uses: a
		// press on a control belongs to the control. Without it, pressing `Buy`
		// while confirmed dismissed on the pointerdown — releasing the arm, so the
		// poll spent a refresh — and then re-opened a composer on the click. One
		// press, one round trip burned, for a state change the control was going to
		// make anyway through the identity retirement.
		const fetchStub = stubWireFetch([placeOk(POSTED_ID)]);
		const { rerender } = render(view(baseModel()));
		await placeMarketBet(fetchStub);
		rerender(
			view(
				modelWithPost(
					newPost({ id: POSTED_ID, ordinal: 7, sideAtPostTime: "YES" }),
				),
			),
		);
		const before = refreshMock.mock.calls.length;

		// ⚠ getAll, not get: while the arm is held BOTH column headers mirror the
		// composing side (the §5 header-mirror rule keyed on `openSide`), so two
		// controls read `Buy YES` for as long as the confirmation is up. That is
		// pre-existing mirror behaviour reaching a state it predates — recorded
		// here because the selector is the only place it is visible.
		fireEvent.pointerDown(
			screen.getAllByLabelText("Buy YES")[0] as HTMLElement,
		);
		expect(refreshMock).toHaveBeenCalledTimes(before);
		expect(slot()?.getAttribute("data-state")).toBe("confirmed");

		// ⚠ AND THE FOLLOW-UP CLICK IS WHAT COMPLETES THE CLAIM. The exemption is
		// only defensible because the control retires the confirmation ITSELF — so
		// the press must end with the slot released anyway, by the control's own
		// state change rather than by the dismisser. Firing only `pointerDown`
		// asserted the exclusion and left that half in prose.
		fireEvent.click(screen.getAllByLabelText("Buy YES")[0] as HTMLElement);
		expect(
			slot()?.getAttribute("data-state"),
			"the control released it — through the identity retirement, not the dismisser",
		).not.toBe("confirmed");
		// ⚠⚠ ONE refresh for the whole press, not two — and this is the number the
		// exemption exists for. The `click` legitimately costs the poll's resume
		// (the arm released, so the surface is live again: that IS the bet's second
		// and last round trip). Without the exemption the `pointerDown` spent one
		// too, and the author paid twice for a single gesture.
		expect(refreshMock).toHaveBeenCalledTimes(before + 1);
	});

	it("posted::in-the-WAIT-window-a-press-on-a-control-DOES-release-the-author", async () => {
		// ⛔⛔ THE EXEMPTION IS GATED ON THE CONFIRMED STATE, AND THIS IS WHY. In the
		// wait window `composerBusy` is still true, so every host navigation no-ops
		// and no identity moves — the control cannot retire anything. Applying the
		// exemption there made a pointer press FULLY INERT: a mouse-only author in
		// a stalled wait pressed `Buy`, or a post title, and got nothing at all
		// from a surface already showing them a greyed motionless form.
		const fetchStub = stubWireFetch([placeOk(POSTED_ID)]);
		render(view(baseModel()));
		await placeMarketBet(fetchStub);
		expect(slot()?.getAttribute("data-state")).toBe("open");

		// ⚠ The MIRRORED header, not "Buy NO" — while the arm is held BOTH columns
		// advertise the composing side, so there is no `Buy NO` on the surface at
		// all (the §5 header-mirror rule reaching a state it predates; flagged in
		// the plan, not changed here). Index 1 is the other column's copy.
		fireEvent.pointerDown(
			screen.getAllByLabelText("Buy YES")[1] as HTMLElement,
		);
		act(() => {
			vi.advanceTimersByTime(400);
		});
		expect(
			slot(),
			"a control is an exit while there is nothing to read",
		).toBeNull();
	});

	it("posted::the-resolution-dialog-counts-as-an-overlay-too", async () => {
		// ⚠⚠ `criterionOpen` IS DORMANT — its trigger was detached by founder ruling
		// — so this cannot be driven through the UI, and it is asserted at the
		// predicate instead. Omitting it would have been this file's own documented
		// defect committed a second time: `frozen`'s docblock records that
		// `ResolutionPopup` held its own `open` state and was invisible to that
		// predicate, and the carousel advanced behind the modal. On the day the
		// redesign re-attaches the trigger, Escape pressed to close that dialog
		// would fire Radix's dismissal AND this one in a single keystroke.
		const src = await import("node:fs").then((fs) =>
			fs.readFileSync("src/components/debate/DebateView.tsx", "utf8"),
		);
		const block = src.slice(
			src.indexOf("const overlayOpen ="),
			src.indexOf("const onOutside ="),
		);
		for (const flag of [
			"popupPost",
			"popupReply",
			"lightboxUrl",
			"criterionOpen",
		]) {
			expect(block, `overlayOpen must read ${flag}`).toContain(flag);
		}
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

it("posted::a-receipt-naming-the-WRONG-KIND-closes-the-slot-instead-of-hanging", async () => {
	// ⛔⛔ THE ARM-BLIND HANG. The reply arm can only render a REPLY. A receipt
	// whose `commentId` named a top-level post produced a found node this arm
	// could not show — so the slot stayed on the composer, and a fallback that
	// asked "was a node found?" rather than "does THIS ARM have something to
	// show?" early-returned and never closed it. The author sat in the wait
	// state permanently.
	// ⚠ It takes a wrong server receipt to reach, which is why it is not a
	// scenario so much as a promise: no receipt, however wrong, may strand
	// someone on this surface.
	const fetchStub = stubWireFetch([placeOk(PARENT_ID)]);
	const { rerender } = render(view(baseModel(), PARENT_ID));
	await placeReplyBet(fetchStub);

	// A payload lands. `cmt-p1` IS in it — as a top-level post, which the reply
	// arm has no way to render.
	rerender(view(modelUnchanged(), PARENT_ID));
	act(() => {
		vi.advanceTimersByTime(400);
	});

	expect(confirmation()).toBeNull();
	expect(slot(), "closed, not hung").toBeNull();
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
