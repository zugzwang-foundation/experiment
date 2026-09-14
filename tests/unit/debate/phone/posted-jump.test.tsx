// @vitest-environment jsdom
/**
 * MOBILE-2l · R-2 — THE PHONE MIRRORS THE DESKTOP'S POST-BET JUMP.
 *
 * ⛔⛔ WHAT THE DESKTOP ACTUALLY DOES, because the brief described something
 * else and the plan's §1 records the correction. There is NO pin, NO marker, NO
 * "just now" treatment and NO reorder (`DebateView.tsx:930-933` says so in
 * terms). What there is:
 *
 *   · `posted: {commentId, fromModel}`, set from the BET RESPONSE — `BetComposer`
 *     calls `props.onPosted({commentId})` with the receipt's id, never with
 *     "the newest thing in the model".
 *   · `landed = posted !== null && model !== posted.fromModel` — RSC payload
 *     object identity, the only signal that says "the new data is HERE".
 *   · `findPostedNode({posts, parent, commentId})` — FAIL-CLOSED: a removed
 *     comment yields `null` and nothing happens, silently.
 *   · the side is the COMMENT'S OWN (`sideAtPostTime`, or a reply's frozen
 *     `side`) — never the composer's column.
 *   · ONE-SHOT keyed on the commentId, NO timer, never cleared.
 *
 * The phone feed is a scrolling list rather than a paged column, so the faithful
 * analogue of the desktop's `index = the posted card` is **scroll the feed
 * region so that card's top meets the region's top**, and the analogue of
 * `pickSide(jumpSide)` is **`setActiveSide(jumpSide)`**.
 *
 * ⛔ RED BY CONSTRUCTION AT `b7114791`. `PhoneDebateView`'s `onPosted` is
 * `useCallback(() => { setSheet(null); router.refresh(); }, [router])` — it
 * takes no argument, so the receipt's `commentId` is DROPPED at the seam and
 * every assertion below fails. That is the point of the file.
 *
 * ⚠⚠ THE ACTIVE TAB IS THE INSTRUMENT, and it is chosen because it is the only
 * thing about this mechanism jsdom can actually see. `aria-selected` on
 * `phone-tab-YES|NO` is a real attribute on a real node; a jump that lands on
 * the wrong pole, or does not land, moves it or fails to. Every guard here
 * except the two scroll rows is expressed in that one observable, so the suite
 * does not depend on which DOM hook the implementation chooses for "the posted
 * card".
 *
 * ⛔ WHY THE READER TAPS THE OTHER TAB BEFORE THE PAYLOAD LANDS, in almost every
 * test. In the feed arm the bar composes on `activeSide` (`PhoneDebateView`'s
 * `barActions`), so a bet placed from the YES tab is a YES bet and "switch to
 * the bet's side" is a no-op that no assertion can distinguish from a build that
 * does nothing at all. Tapping the other tab in the window between submit and
 * refresh is an ORDINARY thing to do — the sheet is already closed — and it is
 * what makes the switch a CHANGE rather than a coincidence.
 *
 * ⛔ THE CEILING. jsdom performs no layout: every `getBoundingClientRect` is
 * zeros and `Element.prototype.scrollTo` / `scrollIntoView` do not exist at all
 * (measured at this file's writing, not assumed). The two scroll rows therefore
 * run against a SYNTHETIC geometry installed below — they prove the component
 * measures the right node and moves the right scroller, and they prove nothing
 * about pixels. A real "the card's top is at the region's top" is a browser
 * measurement and belongs to the plan's B-series.
 *
 * No jest-dom in this repo (AGENTS.md §9) — plain DOM assertions only.
 */
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { pushMock, refreshMock, replaceMock } = vi.hoisted(() => ({
	pushMock: vi.fn(),
	refreshMock: vi.fn(),
	replaceMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
	useRouter: () => ({
		push: pushMock,
		replace: replaceMock,
		refresh: refreshMock,
		back: () => undefined,
		forward: () => undefined,
		prefetch: () => undefined,
	}),
	// ⚠ NOT SPARE — a factory mock REPLACES the module, and the bar's tree reaches
	// `DownloadPostImage`, which reads the slug off the route. The fixture's own
	// slug, so the control renders live rather than in its no-slug branch.
	useParams: () => ({ slug: "bitcoin-price-50k" }),
	usePathname: () => "/m/bitcoin-price-50k",
	useSearchParams: () => new URLSearchParams(),
}));

import { COMPOSER_COPY } from "@/components/debate/composer/copy";
import { PhoneDebateView } from "@/components/debate/phone/PhoneDebateView";
import type { DebatePost, DebateViewModel } from "@/components/debate/types";

import { stubWireFetch } from "../../composer/render/_harness";
import {
	newRemovedPostCarryingBody,
	WITHHELD_SENTINEL,
} from "../render/_posted-fixtures";
import { modelWith, post, reply, VIEWER } from "./_fixtures";

/** The id the BET RESPONSE returns — the only id the jump may key on. */
const POSTED_ID = "cmt-just-posted";
/** A SECOND bet's id, so the one-shot can be shown to re-arm. */
const SECOND_ID = "cmt-second-bet";

const POSTED_AUTHOR = "SlateHeron707";
const RIVAL_AUTHOR = "UmberWren808";

const BASE_POSTS: DebatePost[] = [
	post({ id: "p1", ordinal: 1, side: "YES", pseudonym: "AmberFinch101" }),
	post({ id: "p2", ordinal: 2, side: "NO", pseudonym: "CobaltLark202" }),
];

/** The author's own argument, YES-sided, as the refreshed model carries it. */
const postedPost = (id = POSTED_ID) =>
	post({ id, ordinal: 7, side: "YES", pseudonym: POSTED_AUTHOR });

/**
 * ⚠⚠ A DIFFERENT AUTHOR'S NEWER POST, ON THE OTHER POLE. This is the specimen
 * that separates "the id the receipt returned" from "the newest thing in the
 * model": it is appended LAST and it is NO-sided, so a build that jumped to the
 * newest post would land the reader on NO instead of YES.
 */
const rivalPost = () =>
	post({
		id: "cmt-someone-else",
		ordinal: 8,
		side: "NO",
		pseudonym: RIVAL_AUTHOR,
	});

// ---------------------------------------------------------------------------
// The synthetic geometry, and the three scroll idioms it has to admit.
// ---------------------------------------------------------------------------

/**
 * ⚠ A CARD'S TOP IS A PURE FUNCTION OF ITS POSITION IN THE PANE, so the test
 * computes the expectation the same way the component would have to measure it,
 * and neither can guess the other's answer. Base and stride are arbitrary and
 * distinct so that "scrolled to zero" and "scrolled to the wrong card" are both
 * visibly different from "scrolled to the right card".
 */
const CARD_TOP_BASE = 400;
const CARD_STRIDE = 137;

/**
 * The synthetic viewport top of `el`: its CARD's, if it is inside one, else 0.
 *
 * The pane structure is `[data-testid="phone-pane-*"] > list > card`, so a node
 * whose grandparent is a pane IS a card. Everything above the cards — the pane,
 * the track, the region itself — measures 0, which is what makes
 * `cardTop - regionTop + region.scrollTop` come out as the card's own offset.
 */
function syntheticTop(el: Element): number {
	let node: Element | null = el;
	while (node !== null) {
		const list: HTMLElement | null = node.parentElement;
		const pane: HTMLElement | null = list?.parentElement ?? null;
		if (
			list !== null &&
			pane !== null &&
			(pane.getAttribute("data-testid") ?? "").startsWith("phone-pane-")
		) {
			const index = Array.prototype.indexOf.call(list.children, node);
			return CARD_TOP_BASE + index * CARD_STRIDE;
		}
		node = list;
	}
	return 0;
}

const realRect = Element.prototype.getBoundingClientRect;
const realWindowScrollTo = window.scrollTo;

function installSyntheticLayout() {
	Element.prototype.getBoundingClientRect = function rect(this: Element) {
		const top = syntheticTop(this);
		return {
			top,
			bottom: top + CARD_STRIDE,
			left: 0,
			right: 0,
			width: 0,
			height: CARD_STRIDE,
			x: 0,
			y: top,
			toJSON: () => ({}),
		} as DOMRect;
	};
	// The same answer through the second idiom a scroll can be written in.
	Object.defineProperty(HTMLElement.prototype, "offsetTop", {
		configurable: true,
		get(this: HTMLElement) {
			return syntheticTop(this);
		},
	});
	// ⛔ jsdom ships NEITHER of these on `Element.prototype` — measured, not
	// assumed. `_fixtures.ts`'s `stubElementScroll()` installs a no-op `scrollTo`
	// for the suites that only need the track's tab sync not to throw; this file
	// needs one that MOVES something, so it installs its own and never calls that
	// helper (whose `if` would skip anyway, the slot being taken).
	Element.prototype.scrollTo = function scrollTo(
		this: Element,
		a?: ScrollToOptions | number,
		b?: number,
	) {
		if (typeof a === "object" && a !== null) {
			if (a.top !== undefined) this.scrollTop = a.top;
			if (a.left !== undefined) this.scrollLeft = a.left;
			return;
		}
		if (typeof a === "number") this.scrollLeft = a;
		if (typeof b === "number") this.scrollTop = b;
	};
	Element.prototype.scrollIntoView = function scrollIntoView(this: Element) {
		const region = this.closest<HTMLElement>(
			'[data-testid="phone-scroll-region"]',
		);
		if (region === null) {
			return;
		}
		region.scrollTop =
			syntheticTop(this) - syntheticTop(region) + region.scrollTop;
	};
}

function restoreSyntheticLayout() {
	Element.prototype.getBoundingClientRect = realRect;
	Reflect.deleteProperty(Element.prototype, "scrollTo");
	Reflect.deleteProperty(Element.prototype, "scrollIntoView");
	Reflect.deleteProperty(HTMLElement.prototype, "offsetTop");
	window.scrollTo = realWindowScrollTo;
}

let windowScrollSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
	installSyntheticLayout();
	windowScrollSpy = vi.fn();
	window.scrollTo = windowScrollSpy as unknown as typeof window.scrollTo;
	pushMock.mockReset();
	replaceMock.mockReset();
	refreshMock.mockReset();
});

afterEach(() => {
	cleanup();
	restoreSyntheticLayout();
	vi.unstubAllGlobals();
	vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Driving the surface the way a reader does.
// ---------------------------------------------------------------------------

function view(model: DebateViewModel, initialPostId: string | null = null) {
	return (
		<PhoneDebateView
			model={model}
			viewer={VIEWER}
			initialPostId={initialPostId}
			ownPseudonym={null}
			details={null}
		/>
	);
}

const tab = (side: "YES" | "NO") =>
	document.querySelector<HTMLButtonElement>(
		`[data-testid="phone-tab-${side}"]`,
	);

/** Which pole the tabs report as selected — the suite's one instrument. */
function selectedSide(): "YES" | "NO" | null {
	if (tab("YES")?.getAttribute("aria-selected") === "true") return "YES";
	if (tab("NO")?.getAttribute("aria-selected") === "true") return "NO";
	return null;
}

function tapTab(side: "YES" | "NO") {
	const control = tab(side);
	if (control === null) throw new Error(`no ${side} tab`);
	fireEvent.click(control);
}

const region = () =>
	document.querySelector<HTMLElement>('[data-testid="phone-scroll-region"]');

/** The card carrying `pseudonym`, as a direct child of its pane's list. */
function cardOf(pseudonym: string): HTMLElement {
	const panes = document.querySelectorAll('[data-testid^="phone-pane-"]');
	for (const pane of panes) {
		const list = pane.firstElementChild;
		if (list === null) continue;
		for (const card of list.children) {
			if ((card.textContent ?? "").includes(pseudonym)) {
				return card as HTMLElement;
			}
		}
	}
	throw new Error(`no card for ${pseudonym}`);
}

/** Open the composer the way a reader does: the bottom bar's entry control. */
function openComposer() {
	const bar = document.querySelector('[data-testid="phone-bottom-bar"]');
	const button = bar?.querySelector("button");
	if (!button) throw new Error("no entry control on the bottom bar");
	fireEvent.click(button);
}

/**
 * Fill and submit, asserting the bet ACTUALLY went to the wire.
 * ⚠ Without that assertion a test whose expected post-state is "nothing moved"
 * passes identically whether or not a bet was ever placed.
 */
async function submitOpen(wire: ReturnType<typeof stubWireFetch>) {
	const sheet = document.querySelector('[data-testid="phone-sheet"]');
	if (!sheet) throw new Error("composer is not open");
	const field = (label: string) =>
		sheet.querySelector<HTMLInputElement | HTMLTextAreaElement>(
			`[aria-label="${label}"]`,
		);
	const title = field("Argument title");
	const body = field("Argument body");
	const amount = field("Stake amount");
	if (!title || !body || !amount) {
		throw new Error("composer is missing one of its three required fields");
	}
	fireEvent.change(title, { target: { value: "The base rate argument." } });
	fireEvent.change(body, {
		target: { value: "The extended argument, first paragraph." },
	});
	fireEvent.change(amount, { target: { value: "25" } });
	// ⚠ BY ACCESSIBLE NAME, NOT BY TEXT. The control's visible content is split
	// across two spans ("Place" / "Đ BET"), so its `textContent` is `PlaceĐ BET`
	// and an equality test on the copy constant finds nothing. `aria-label`
	// carries `COMPOSER_COPY.submit` verbatim and is what a reader is announced.
	const submit = sheet.querySelector<HTMLButtonElement>(
		`button[aria-label="${COMPOSER_COPY.submit}"]`,
	);
	if (!submit) throw new Error("no submit control in the open composer");
	await act(async () => {
		fireEvent.click(submit);
	});
	expect(
		wire.mock.calls.filter(([u]) => String(u).includes("/api/bets/place")),
		"the bet must actually have gone to the wire",
	).toHaveLength(1);
}

/** The §4.4 success envelope `place()` returns — a RECEIPT, not a post. */
function placeOk(commentId: string, side: "YES" | "NO" = "YES") {
	return {
		status: 200,
		body: {
			ok: true,
			data: {
				betId: "bet-0001",
				commentId,
				side,
				sharesBought: "20.000000000000000000",
				newPrice: "0.560000000000000000",
				parentCommentId: null,
			},
		},
	};
}

/** Place a bet from the currently active tab and read back its receipt id. */
async function placeBet(commentId: string) {
	const wire = stubWireFetch([placeOk(commentId)]);
	openComposer();
	await submitOpen(wire);
}

// ---------------------------------------------------------------------------

describe("MOBILE-2l · R-2 — the jump lands on the BET'S own side", () => {
	it("phone-posted::the-bet's-side-becomes-the-active-tab-when-the-payload-lands", async () => {
		// The reader is on YES, so the bar composes YES (`barActions`).
		const { rerender } = render(view(modelWith(BASE_POSTS)));
		expect(selectedSide(), "the feed opens on YES").toBe("YES");
		await placeBet(POSTED_ID);

		// The sheet is closed and the payload has not landed; browsing the other
		// pole while it flies is an ordinary thing to do.
		tapTab("NO");
		expect(selectedSide(), "CONTROL: the reader really did move").toBe("NO");

		// The refreshed payload arrives carrying the author's own YES argument.
		rerender(view(modelWith([...BASE_POSTS, postedPost()])));

		expect(
			selectedSide(),
			"the author's argument is YES-sided, so the feed shows YES",
		).toBe("YES");
	});

	it("phone-posted::the-id-is-the-RECEIPT'S-never-the-newest-post-in-the-model", async () => {
		// ⛔⛔ THE EXPLOITABLE ONE. "Show the newest post" is the cheap
		// implementation and it is wrong in the ordinary case, not an exotic one:
		// another participant bets in the gap between this submit and this
		// refresh. Here that rival post is NEWER and on the OTHER pole, so the two
		// builds disagree visibly.
		const { rerender } = render(view(modelWith(BASE_POSTS)));
		await placeBet(POSTED_ID);
		tapTab("NO");

		rerender(view(modelWith([...BASE_POSTS, postedPost(), rivalPost()])));

		expect(
			selectedSide(),
			"the receipt named a YES comment; the newest post is someone else's NO",
		).toBe("YES");
		// And the rival really is present and really is last — otherwise the row
		// above passes against a model that never contained the trap.
		const panes = document.querySelector('[data-testid="phone-pane-NO"]');
		expect(
			panes?.textContent ?? "",
			"CONTROL: the rival post is in the model being tested",
		).toContain(RIVAL_AUTHOR);
	});
});

describe("MOBILE-2l · R-2 — the scroller is the FEED REGION", () => {
	it("phone-posted::the-region-scrolls-so-the-posted-card's-top-meets-its-top", async () => {
		const { rerender } = render(view(modelWith(BASE_POSTS)));
		await placeBet(POSTED_ID);
		tapTab("NO");
		const scroller = region();
		expect(
			scroller,
			"the tier has exactly one vertical scroller",
		).not.toBeNull();
		if (scroller === null) return;
		scroller.scrollTop = 0;

		rerender(view(modelWith([...BASE_POSTS, postedPost()])));

		const expected = syntheticTop(cardOf(POSTED_AUTHOR));
		expect(
			expected,
			"the synthetic geometry gives the card a non-zero top",
		).toBeGreaterThan(0);
		expect(
			scroller.scrollTop,
			"the card's top is brought to the region's top",
		).toBe(expected);
		// ⛔ And it is a DIFFERENT number from every other card's, so "scrolled to
		// something" cannot pass for "scrolled to this".
		expect(syntheticTop(cardOf("AmberFinch101"))).not.toBe(expected);
	});

	it("phone-posted::the-window-is-never-scrolled-and-no-?post=-is-minted", async () => {
		// ⛔ THE NEGATIVE HALF IS VACUOUS ON ITS OWN — a build that does nothing at
		// all scrolls no window and mints no URL. It is paired here with the
		// positive so the row can only pass on a build that jumped, and jumped in
		// the right place. `?post=N` keeps meaning exactly what it means today.
		const { rerender } = render(view(modelWith(BASE_POSTS)));
		await placeBet(POSTED_ID);
		tapTab("NO");
		const scroller = region();
		if (scroller === null) throw new Error("no scroll region");
		scroller.scrollTop = 0;
		pushMock.mockClear();
		replaceMock.mockClear();

		rerender(view(modelWith([...BASE_POSTS, postedPost()])));

		expect(scroller.scrollTop, "the REGION moved").toBeGreaterThan(0);
		expect(
			windowScrollSpy,
			"the document does not scroll on this tier; window.scrollTo is a no-op that reads as an action",
		).not.toHaveBeenCalled();
		expect(
			pushMock,
			"the jump is client state, not a navigation",
		).not.toHaveBeenCalled();
		expect(replaceMock).not.toHaveBeenCalled();
		expect(window.location.search).toBe("");
	});

	it("CONTROL — a post title still navigates to ?post=<ordinal>", () => {
		// The positive control for the row above: `router.push` IS wired, so its
		// zero call count there is a refusal rather than a dead spy.
		render(view(modelWith(BASE_POSTS)));
		const title = cardOf("AmberFinch101").querySelector("h3");
		const enter = title?.closest("button");
		if (!enter) throw new Error("no title control on the card");
		fireEvent.click(enter);
		expect(pushMock).toHaveBeenCalledWith("/m/bitcoin-price-50k?post=1");
	});
});

describe("MOBILE-2l · R-2 — one shot per comment, and it re-arms", () => {
	it("phone-posted::a-poll-refresh-carrying-the-SAME-comment-does-not-re-fire", async () => {
		const { rerender } = render(view(modelWith(BASE_POSTS)));
		await placeBet(POSTED_ID);
		tapTab("NO");
		const landed = modelWith([...BASE_POSTS, postedPost()]);
		rerender(view(landed));
		expect(selectedSide(), "the jump landed").toBe("YES");

		// The reader moves away. Then `DebatePoll`'s ordinary refresh lands — a NEW
		// payload identity carrying the same comment.
		tapTab("NO");
		rerender(view(modelWith([...BASE_POSTS, postedPost()])));

		expect(
			selectedSide(),
			"one shot per comment id: a later payload must not re-take the pole the reader chose",
		).toBe("NO");
	});

	it("phone-posted::a-SECOND-bet-re-arms-the-jump", async () => {
		const { rerender } = render(view(modelWith(BASE_POSTS)));
		await placeBet(POSTED_ID);
		tapTab("NO");
		rerender(view(modelWith([...BASE_POSTS, postedPost()])));
		expect(selectedSide()).toBe("YES");

		// A second bet, on YES again — a different comment, a different receipt.
		await placeBet(SECOND_ID);
		tapTab("NO");
		rerender(
			view(modelWith([...BASE_POSTS, postedPost(), postedPost(SECOND_ID)])),
		);

		expect(
			selectedSide(),
			"a new comment id re-arms; the second bet wins and the first does not re-fire",
		).toBe("YES");
	});
});

describe("MOBILE-2l · R-2 — a payload that does not carry it yet", () => {
	it("phone-posted::a-refresh-WITHOUT-the-comment-waits-and-the-next-one-jumps", async () => {
		// ⛔⛔ THE ORDERING TRAP, and it is the one an implementation is most
		// likely to get wrong: `landed` goes true on the FIRST new payload, which
		// may well be `DebatePoll`'s own refresh racing this bet's. If the one-shot
		// ref is stamped before `findPostedNode` has actually found anything, the
		// real arrival is discarded and the author never sees their argument.
		const { rerender } = render(view(modelWith(BASE_POSTS)));
		await placeBet(POSTED_ID);
		tapTab("NO");

		// A new payload identity — but the projection has not caught up.
		rerender(view(modelWith([...BASE_POSTS])));
		expect(
			selectedSide(),
			"nothing to point at yet, so nothing moves and nothing is said",
		).toBe("NO");

		// The next one carries it.
		rerender(view(modelWith([...BASE_POSTS, postedPost()])));

		expect(
			selectedSide(),
			"the shot was not spent on a payload that did not carry the comment",
		).toBe("YES");
	});
});

describe("MOBILE-2l · R-2 — masking (SC-1)", () => {
	it("phone-posted::a-REMOVED-comment-produces-no-switch-no-scroll-and-no-body", async () => {
		// `findPostedNode` returns the PRESENT variant or nothing, so a comment
		// removed between submit and refresh yields `null`: no side, no scroll, no
		// "your post could not be found" — which would be a held state under
		// another name.
		// ⚠ SC-1's second obligation is the BODY's absence, not the row's.
		const { rerender } = render(view(modelWith(BASE_POSTS)));
		await placeBet(POSTED_ID);
		tapTab("NO");
		const scroller = region();
		if (scroller === null) throw new Error("no scroll region");
		scroller.scrollTop = 0;

		rerender(
			view(
				modelWith([
					...BASE_POSTS,
					newRemovedPostCarryingBody({
						id: POSTED_ID,
						ordinal: 7,
						sideAtPostTime: "YES",
					}),
				]),
			),
		);

		expect(selectedSide(), "no side switch on a masked comment").toBe("NO");
		expect(scroller.scrollTop, "and no scroll").toBe(0);
		expect(document.body.innerHTML).not.toContain(WITHHELD_SENTINEL);
		expect(document.body.textContent ?? "").not.toMatch(/could not|not found/i);

		// ⛔⛔ THE POSITIVE CONTROL, IN THE SAME TEST. Every assertion above is
		// satisfied perfectly by a build that never jumps at all — which is exactly
		// the build this file is written against. The shot must still be unspent,
		// so an unmasking (a moderator reversal, or simply the next payload
		// arriving with the row present) jumps.
		rerender(view(modelWith([...BASE_POSTS, postedPost()])));
		expect(
			selectedSide(),
			"the masked payload neither jumped nor consumed the shot",
		).toBe("YES");
	});
});

// ---------------------------------------------------------------------------

describe("MOBILE-2l · R-2 — the THREAD arm is not the feed", () => {
	it("phone-posted::a-payload-landing-on-the-thread-arm-does-NOT-spend-the-shot", async () => {
		// ⛔⛔ THE GUARD THIS ASSERTS HAD NO TEST AT ALL, and `@security-auditor`
		// measured exactly that: every other `view(...)` call in this suite passes
		// ONE argument, so `initialPostId` is null throughout and
		// `if (focused !== null) return;` is never evaluated true. Deleting those
		// three lines left all nine tests green — a guard the component calls
		// load-bearing and nothing could fail on.
		//
		// ⚠ THE OBSERVABLE IS THE SHOT, NOT THE POLE, and that took a second
		// attempt to get right. Asserting the active side does not separate the
		// two builds: with the guard the jump simply happens later, on the return
		// to the feed, and both end on the same pole. What the guard actually
		// protects is the ONE-SHOT — `jumpedFor` is stamped before the scroll, so
		// a payload absorbed on the thread arm (where no `data-phone-post-id`
		// exists, because the thread renders `ReplyCard`s) would consume the only
		// jump that comment is ever owed, and the reader would come back to a feed
		// that never moves.
		const { rerender } = render(view(modelWith(BASE_POSTS)));
		await placeBet(POSTED_ID);

		const scroller = region();
		expect(
			scroller,
			"the tier has exactly one vertical scroller",
		).not.toBeNull();
		if (scroller === null) return;
		scroller.scrollTop = 0;

		// The reader walks into a post while their own payload is still in flight —
		// an ordinary thing to do, and the window is a real one (~200-800ms).
		rerender(view(modelWith([...BASE_POSTS, postedPost()]), "p1"));
		expect(
			scroller.scrollTop,
			"CONTROL: nothing scrolls on the thread arm — there is no feed card " +
				"there to bring to the top",
		).toBe(0);

		// Back to the feed. The jump is owed and must still be available.
		rerender(view(modelWith([...BASE_POSTS, postedPost()])));

		const expected = syntheticTop(cardOf(POSTED_AUTHOR));
		expect(
			expected,
			"the synthetic geometry gives the card a non-zero top",
		).toBeGreaterThan(0);
		expect(
			scroller.scrollTop,
			"the shot was NOT spent on the thread arm, so returning to the feed " +
				"still brings the author to their own argument",
		).toBe(expected);
		expect(
			selectedSide(),
			"and the side it lands on is still the comment's own",
		).toBe("YES");
	});
});
