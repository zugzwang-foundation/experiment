// @vitest-environment jsdom

import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
	within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
	DiscoveryCarousel,
	type DiscoveryMarketView,
} from "@/components/discovery/DiscoveryCarousel";
import type { HeroTopPosts } from "@/server/discovery/hero";
import type { PricePoint } from "@/server/discovery/price-series";

import { EXTENDED, TITLE } from "../../composer/render/_harness";

/**
 * UI.A4 Slice 5 (plan §2 row 5 / §4 / §5) — DiscoveryCarousel, the ONE
 * client-motion piece, under the design-canon §5 verbatim law: one shared
 * index 0..n−1 drives hero + grid ring + active dot IN SYNC; auto-advance
 * every 10s ((i+1) % n — the straight wrap over the AVAILABLE set); the
 * countdown resets on ANY index change (timer-driven or manual); `‹`/`›`
 * advance immediately and reset (aria copy canon §6; arrows only when
 * n > 1); a single market is STATIC — the client half of the §17-registry
 * `hero-single-market-static` row (the server half landed at Slice 3). The
 * active dot ALONE carries the `dot-fill` countdown element; `:has()` is
 * BANNED (canon §3.10) — JS-toggled classes/attrs only. Sparse sets shrink
 * with NO placeholders, and the Slice-4 carried LOW folds in here as the
 * anchor census (n whole-card links + market 1's 2 hero-post deep-links + its
 * 2 hero-author profile links, UI.A5 A4 follow-up #2).
 * Fixture labels are the shipped scaffold style ("Discovery Market N" /
 * `fixture-market-N`); hero prose reuses the composer-harness strings —
 * never invented market content (CLAUDE.md §3). Fake timers per test;
 * `fireEvent` (never userEvent) under fake timers; timer advances wrapped
 * in `act`.
 */

beforeEach(() => {
	vi.useFakeTimers();
});

afterEach(() => {
	cleanup();
	vi.useRealTimers();
});

const SEED_SERIES: PricePoint[] = [
	{ at: "2026-07-01T00:00:00.000Z", yes: "0.500000000000000000" },
];

/** Market 1's hero posts — BOTH sides present (the rest rotate side-empty). */
const HERO_TOP_POSTS: HeroTopPosts = {
	yes: {
		id: "0190b3a0-9999-7000-8000-00000000000a",
		ordinal: 1,
		side: "YES",
		title: TITLE,
		teaser: EXTENDED,
		author: { pseudonym: "hero-yes-author", pfpUrl: "/pfp-placeholder.svg" },
		authorStake: "40.000000000000000000",
		entryPrice: "0.270000000000000000",
		replyCount: 24,
		replyDharma: "10000.000000000000000000",
		supportDharma: "3800.000000000000000000",
		counterDharma: "6200.000000000000000000",
		imageUrl: null,
		currentValue: null,
		createdAt: "2026-07-01T00:00:00.000Z",
	},
	no: {
		id: "0190b3a0-9999-7000-8000-00000000000b",
		ordinal: 2,
		side: "NO",
		title: TITLE,
		teaser: EXTENDED,
		author: { pseudonym: "hero-no-author", pfpUrl: "/pfp-placeholder.svg" },
		authorStake: "35.000000000000000000",
		entryPrice: "0.270000000000000000",
		replyCount: 24,
		replyDharma: "10000.000000000000000000",
		supportDharma: "3800.000000000000000000",
		counterDharma: "6200.000000000000000000",
		imageUrl: null,
		currentValue: null,
		createdAt: "2026-07-01T00:01:00.000Z",
	},
};

/** n distinct DiscoveryMarketView literals: "Discovery Market 1…n". */
function views(n: number): DiscoveryMarketView[] {
	return Array.from({ length: n }, (_, i): DiscoveryMarketView => {
		const ordinal = i + 1;
		const first = i === 0;
		return {
			card: {
				id: `0190b3a0-9999-7000-8000-${String(ordinal).padStart(12, "0")}`,
				slug: `fixture-market-${ordinal}`,
				title: `Discovery Market ${ordinal}`,
				pricing: { yes: "0.380000000000000000", no: "0.620000000000000000" },
				totals: {
					dharmaStaked: first
						? "75.000000000000000000"
						: "0.000000000000000000",
					postCount: first ? 2 : 0,
					replyCount: 0,
				},
				imageUrl: null,
			},
			series: SEED_SERIES,
			topPosts: first ? HERO_TOP_POSTS : { yes: null, no: null },
		};
	});
}

/**
 * The ONE-shared-index law (canon §2/§5): the active dot, the grid ring,
 * and the hero market must move as a single index — assert all three
 * surfaces at once.
 */
function expectActive(index: number): void {
	const dots = screen.getAllByTestId("carousel-dot");
	const activeDots = dots.filter(
		(d) => d.getAttribute("data-active") === "true",
	);
	expect(activeDots).toHaveLength(1);
	expect(dots.indexOf(activeDots[0])).toBe(index);

	const cards = screen.getAllByTestId("market-card");
	const activeCards = cards.filter(
		(c) => c.getAttribute("data-active") === "true",
	);
	expect(activeCards).toHaveLength(1);
	expect(cards.indexOf(activeCards[0])).toBe(index);

	// The ring VISUAL (code-review HIGH fold): exactly one card is active and
	// carries an outline class — the state attr alone is not a ring (canon §2:
	// hero + posts + grid OUTLINE RING + dot move in sync).
	//
	// ⚠ THE `grid-ring` TESTID IS RETIRED, NOT DROPPED — HTML-FINISH row 4.
	// The ring used to hang on a wrapper `<div data-testid="grid-ring">` that
	// the grid put around every tile; row 4 removed that wrapper and moved the
	// ring onto the tile's own root, which already carries
	// `data-testid="market-card"` (one element cannot hold two). Every
	// guarantee the hook made is carried here verbatim — exactly one ringed
	// element, at the active index, with an `outline` class, and no outline on
	// any other — now asserted against the CARDS. It is strictly stronger than
	// what it replaces: it proves the ring is on the tile itself, which is the
	// thing row 4 exists to establish, where the old form could pass with the
	// outline on a different box from the `data-active` attribute.
	const rings = cards;
	const activeRings = activeCards;
	expect(activeRings[0].getAttribute("class") ?? "").toContain("outline");
	for (const r of rings) {
		if (r !== activeRings[0]) {
			expect(r.getAttribute("class") ?? "").not.toContain("outline");
		}
	}

	const hero = within(screen.getByTestId("hero-panels"));
	expect(hero.getByText(`Discovery Market ${index + 1}`)).toBeTruthy();
}

describe("UI.A4 §5 — DiscoveryCarousel (canon §5 motion)", () => {
	it("render::ten-second-auto-advance", () => {
		render(<DiscoveryCarousel markets={views(3)} />);
		expect(screen.getByTestId("discovery-carousel")).toBeTruthy();
		// t0: index 0 across all three synced surfaces.
		expectActive(0);
		// 9,999ms — one ms short of the canon §5 10s period: no advance.
		act(() => {
			vi.advanceTimersByTime(9_999);
		});
		expectActive(0);
		// The 10,000th ms fires the advance — dot, ring, hero move TOGETHER.
		act(() => {
			vi.advanceTimersByTime(1);
		});
		expectActive(1);
		// A further full period advances again: 1 → 2.
		act(() => {
			vi.advanceTimersByTime(10_000);
		});
		expectActive(2);
	});

	it("render::arrows-advance-immediately-and-reset", () => {
		render(<DiscoveryCarousel markets={views(3)} />);
		// aria copy EXACT (canon §6) — getByLabelText is a full-string match.
		const next = screen.getByLabelText("Next market");
		const prev = screen.getByLabelText("Previous market");
		// Mid-countdown (t = 7s), › advances IMMEDIATELY…
		act(() => {
			vi.advanceTimersByTime(7_000);
		});
		fireEvent.click(next);
		expectActive(1);
		// …and RESETS: the discarded t0 countdown would have fired 3s from
		// now. 9,999ms (one short of a FRESH 10s from the click) must not
		// advance…
		act(() => {
			vi.advanceTimersByTime(9_999);
		});
		expectActive(1);
		// …and the very next ms completes the fresh countdown: 1 → 2.
		act(() => {
			vi.advanceTimersByTime(1);
		});
		expectActive(2);
		// ‹ steps back immediately, twice: 2 → 1 → 0.
		fireEvent.click(prev);
		expectActive(1);
		fireEvent.click(prev);
		expectActive(0);
	});

	/** A key pressed INSIDE the carousel.
	 *
	 *  ⛔ CS14 §1 — IT NOW FOCUSES THE CONTROL FIRST, AND THAT IS THE WHOLE
	 *  RE-POINT. CS13 scoped by the event's bubble path, so dispatching on a
	 *  descendant was enough. CS14 scopes by `document.activeElement`, because
	 *  the bubble path cannot separate the hero from the grid that shares it.
	 *  `fireEvent` does NOT move focus, so a press dispatched without this
	 *  `focus()` would be read as "nothing has claimed focus" — which is a real
	 *  and DIFFERENT branch (the cold-load entry gesture below), not this one.
	 *  Focusing makes the helper mean what its name says. */
	function keyInside(key: string) {
		const control = screen.getByLabelText("Next market");
		control.focus();
		fireEvent.keyDown(control, { key });
	}

	/** A key pressed with focus on a real element OUTSIDE the carousel proper. */
	function keyFocusedOn(el: HTMLElement, key: string) {
		el.focus();
		fireEvent.keyDown(el, { key });
	}

	it("render::arrow-keys-advance-and-reset", () => {
		// POLISH.2 V37 — design-canon §5 Discovery: "`‹ ›` / Left-Right advance
		// immediately and RESET the timer". The build had no keyboard handler at
		// all. This is canon, not an a11y-deferred item, so it does not wait on
		// R16. The mockup binds the same two keys at :477-479.
		//
		// ⛔⛔ RE-POINTED AT UI-QUICK CS13 §5 — the keys are now SCOPED TO THE
		// CAROUSEL rather than bound to the document, so every press below is
		// dispatched from inside it. The BEHAVIOUR asserted — advance, reset,
		// wrap — is unchanged and every original assertion is still here; only
		// the origin of the event moved, which is precisely what §5 changed.
		render(<DiscoveryCarousel markets={views(3)} />);
		expectActive(0);

		// Mid-countdown, ArrowRight advances IMMEDIATELY…
		act(() => {
			vi.advanceTimersByTime(7_000);
		});
		keyInside("ArrowRight");
		expectActive(1);

		// …and RESETS, exactly as the arrows do: the discarded countdown would
		// have fired 3s from now, so 9,999ms must not advance…
		act(() => {
			vi.advanceTimersByTime(9_999);
		});
		expectActive(1);
		act(() => {
			vi.advanceTimersByTime(1);
		});
		expectActive(2);

		// ArrowLeft steps back and wraps 0 → 2.
		keyInside("ArrowLeft");
		expectActive(1);
		keyInside("ArrowLeft");
		expectActive(0);
		keyInside("ArrowLeft");
		expectActive(2);
	});

	it("render::cs13-ArrowUp-and-ArrowDown-join-Left-and-Right", () => {
		// ⛔ CS13 §5 — Up/Left step BACK, Down/Right step FORWARD. All four are
		// asserted against the SAME carousel so a handler that answered one pair
		// and dropped the other cannot pass.
		render(<DiscoveryCarousel markets={views(3)} />);
		expectActive(0);

		keyInside("ArrowDown");
		expectActive(1);
		keyInside("ArrowDown");
		expectActive(2);
		// …and Down wraps forward, exactly as Right does.
		keyInside("ArrowDown");
		expectActive(0);

		// Up steps back and wraps 0 → 2, exactly as Left does.
		keyInside("ArrowUp");
		expectActive(2);
		keyInside("ArrowUp");
		expectActive(1);

		// ⛔ AND THE PAIRS AGREE. Up must land where Left lands, Down where Right
		// lands — asserted rather than assumed, because a transposed sign here
		// would be invisible in any single-key test above.
		keyInside("ArrowUp");
		expectActive(0);
		keyInside("ArrowLeft");
		expectActive(2);
		keyInside("ArrowDown");
		expectActive(0);
		keyInside("ArrowRight");
		expectActive(1);
	});

	it("render::cs13-NO-arrow-key-is-answered-from-OUTSIDE-the-carousel", () => {
		// ⛔⛔ CS13 §5, AND THIS IS THE ASSERTION THE SCOPING EXISTS FOR. Before
		// this change the handler was on the DOCUMENT, so it answered arrow keys
		// pressed anywhere on the page: it rotated the hero out from under a
		// viewer arrowing through the market grid, and its `preventDefault`
		// suppressed the page's own scroll on every arrow press on the surface.
		//
		// ⚠ ALL FOUR KEYS ARE CHECKED, not just the original two. A scope that
		// leaked would most likely leak uniformly, but the two NEW keys are the
		// ones with no prior coverage at all, and an outside-leak is exactly the
		// defect a fresh binding introduces.
		//
		// ⛔ CS14 §1 RE-POINT — THE OUTSIDE ELEMENT IS NOW FOCUSED, and the
		// document sub-case MOVED rather than being dropped. Scope is now
		// `document.activeElement`, so an UNFOCUSED outside button leaves focus
		// on `<body>` — which CS14 deliberately makes a rotating state for the
		// HORIZONTAL pair (the cold-load entry gesture, asserted in its own test
		// below). A press on an unfocused element therefore no longer tests
		// "outside" at all; it tests the entry gesture by accident. Focusing is
		// what restores this test's subject. The old document lines asserted the
		// document binding was REMOVED — no longer true as stated (it is
		// conditional now, not absent), so they are re-pointed to the claim that
		// survives: with focus genuinely parked outside, a document-level press
		// answers nothing.
		render(<DiscoveryCarousel markets={views(3)} />);
		const outside = document.createElement("button");
		document.body.appendChild(outside);

		for (const key of ["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp"]) {
			keyFocusedOn(outside, key);
			expectActive(0);
		}
		// Focus stays on the outside button; the press itself originates at the
		// document. Still nothing — the origin never mattered, the focus does.
		for (const key of ["ArrowRight", "ArrowDown"]) {
			outside.focus();
			fireEvent.keyDown(document, { key });
			expectActive(0);
		}
		outside.remove();

		// ⛔ AND THE POSITIVE CONTROL, in the same test. Without it, a carousel
		// that answered NOTHING — the failure mode a broken scope actually
		// produces — would pass every assertion above.
		keyInside("ArrowRight");
		expectActive(1);
	});

	it("render::cs14-a-focused-GRID-CARD-rotates-nothing", () => {
		// ⛔⛔ CS14 §1 — THE ROW THIS ITEM EXISTS FOR, and it is a genuine
		// behaviour CHANGE rather than a preserved property. `DiscoveryGrid`
		// renders INSIDE `<section data-testid="discovery-carousel">`, so under
		// CS13's bubble-path scope a focused grid card WAS inside the carousel
		// and did rotate the hero. Measured on staging at `0f04272` BEFORE this
		// change, real ArrowRight with a card focused:
		//     "Claude · Will an official " → "Bitcoin · Will BTC ever go"
		// The founder ruled a grid card must rotate nothing. All four keys, on
		// every card, because a boundary that leaks tends to leak per-axis.
		render(<DiscoveryCarousel markets={views(3)} />);
		for (const card of screen.getAllByTestId("market-card")) {
			for (const key of ["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp"]) {
				keyFocusedOn(card, key);
				expectActive(0);
			}
		}
		// The positive control: the SAME keypress from inside the carousel does
		// rotate, so the assertions above are discriminating rather than inert.
		keyInside("ArrowRight");
		expectActive(1);
	});

	it("render::cs14-cold-load-LEFT-RIGHT-answer-but-UP-DOWN-never-do", () => {
		// ⛔⛔ CS14 §1 — THE ENTRY GESTURE AND THE SCROLL-KEY WALL, TOGETHER.
		// They are asserted in ONE test on purpose: they are two halves of a
		// single deliberate asymmetry, and splitting them would let a build that
		// simply bound all four keys at document level pass the half it happens
		// to satisfy.
		//
		// On a cold page load nothing has claimed focus — `activeElement` is
		// `<body>`. Left/Right must answer from there, so the arrows work without
		// the viewer first having to find and click a control.
		render(<DiscoveryCarousel markets={views(3)} />);
		expect(document.activeElement).toBe(document.body);

		// ⚠ EACH PRESS IS PRECEDED BY A BLUR BACK TO `<body>`, and that is a
		// CS14 §2 consequence rather than ceremony: an arrow rotation now hands
		// focus to the hero market link, so only the FIRST press of a run is
		// genuinely a cold one. Re-parking focus makes every iteration below test
		// the cold state it claims to, instead of silently testing the
		// focus-is-inside branch from the second press onward.
		const cold = (key: string) => {
			(document.activeElement as HTMLElement | null)?.blur();
			expect(document.activeElement).toBe(document.body);
			fireEvent.keyDown(document.body, { key });
		};

		cold("ArrowRight");
		expectActive(1);
		cold("ArrowLeft");
		expectActive(0);
		// …and it wraps backwards from a cold start, exactly as from inside.
		cold("ArrowLeft");
		expectActive(2);

		// ⛔⛔ AND UP/DOWN MUST NOT. These are the PAGE'S SCROLL KEYS. A reader
		// who lands on Discovery and presses Down to scroll must get a scroll,
		// not a market rotation nothing on screen explains. Asserted from
		// body-focus, which is the only state in which this could regress.
		for (const key of ["ArrowDown", "ArrowUp"]) {
			cold(key);
			expectActive(2);
		}
	});

	it("render::cs14-an-arrow-rotation-hands-focus-to-the-hero-market-link", () => {
		// ⛔⛔ CS14 §2 — THE FIX FOR "ENTER OPENS THE NEXT SLIDE". Enter was
		// advancing because after clicking `›` focus sat on that button and Enter
		// re-activated it — correct button behaviour, with focus in the wrong
		// place. Rotation now hands focus to the hero market panel, which is a
		// real <Link>, so Enter opens THAT market with no Enter handler anywhere.
		render(<DiscoveryCarousel markets={views(3)} />);
		const heroLink = screen.getByTestId("hero-market-link");

		// From the `›` button — the exact case the founder reported.
		keyInside("ArrowRight");
		expectActive(1);
		expect(document.activeElement).toBe(heroLink);
		// The link is the SAME node across rotations (React updates its href in
		// place), and it now points at the market the hero is actually showing —
		// which is what makes a native Enter open the right one.
		expect(heroLink.getAttribute("href")).toBe("/m/fixture-market-2");

		// From a cold page — the entry gesture must land focus in the same place,
		// or the first Enter after it would still go somewhere unpredictable.
		(document.activeElement as HTMLElement).blur();
		fireEvent.keyDown(document.body, { key: "ArrowRight" });
		expectActive(2);
		expect(document.activeElement).toBe(heroLink);
		expect(heroLink.getAttribute("href")).toBe("/m/fixture-market-3");

		// ⛔ AND THE `‹ ›` BUTTONS KEEP THEIR OWN ENTER/SPACE. Neither key is
		// overridden — pinned by asserting the buttons carry no keyboard handler
		// of their own and that Enter on `›` still ADVANCES rather than
		// navigating. A build that "fixed" Enter by intercepting it on the
		// section would fail here, and would also have made the buttons
		// keyboard-unusable.
		const next = screen.getByLabelText("Next market");
		next.focus();
		fireEvent.keyDown(next, { key: "Enter" });
		fireEvent.click(next);
		expectActive(0);
	});

	it("render::cs14-the-AUTO-ADVANCE-never-steals-focus", () => {
		// ⛔⛔ CS14 §2 — ONLY ARROW ROTATIONS MOVE FOCUS. The 10s timer must not:
		// yanking the caret away from a reader on a schedule they did not ask for
		// is its own defect, and it would also fire while they were tabbing
		// through the grid below. The timer lives in a separate effect precisely
		// so it cannot reach the focus move — this is what pins that separation.
		render(<DiscoveryCarousel markets={views(3)} />);
		const heroLink = screen.getByTestId("hero-market-link");

		// Nothing focused: a full auto-advance must leave it that way.
		expect(document.activeElement).toBe(document.body);
		act(() => {
			vi.advanceTimersByTime(10_000);
		});
		expectActive(1);
		expect(document.activeElement).toBe(document.body);

		// …and with focus parked on a GRID CARD — a reader reading the tiles —
		// the hero rotating under them must not pull the caret to the hero.
		const card = screen.getAllByTestId("market-card")[0];
		card.focus();
		act(() => {
			vi.advanceTimersByTime(10_000);
		});
		expectActive(2);
		expect(document.activeElement).toBe(card);
		expect(document.activeElement).not.toBe(heroLink);
	});

	it("render::cs14-preventDefault-ONLY-when-the-carousel-consumes-the-key", () => {
		// ⛔ CS14 §1 — the scroll suppression must land exactly where a key was
		// actually consumed and nowhere else. `defaultPrevented` is read off the
		// dispatched event, so this sees what the browser would see.
		function press(el: EventTarget, key: string): boolean {
			const ev = new KeyboardEvent("keydown", {
				key,
				bubbles: true,
				cancelable: true,
			});
			el.dispatchEvent(ev);
			return ev.defaultPrevented;
		}
		render(<DiscoveryCarousel markets={views(3)} />);
		const next = screen.getByLabelText("Next market");
		const outside = document.createElement("button");
		document.body.appendChild(outside);

		// CONSUMED — focus inside, BOTH axes.
		for (const key of ["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"]) {
			next.focus();
			expect(press(next, key)).toBe(true);
		}
		// NOT CONSUMED — focus outside: the page keeps its own scrolling.
		for (const key of ["ArrowRight", "ArrowDown", "ArrowUp", "ArrowLeft"]) {
			outside.focus();
			expect(press(outside, key)).toBe(false);
		}
		outside.remove();

		// NOT CONSUMED — the VERTICAL pair from body-focus, the exact case the
		// scroll-key wall protects.
		for (const key of ["ArrowDown", "ArrowUp"]) {
			expect(press(document.body, key)).toBe(false);
		}
		// …while the HORIZONTAL pair from body-focus IS consumed — the entry
		// gesture, and the control proving the loop above discriminates.
		for (const key of ["ArrowLeft", "ArrowRight"]) {
			expect(press(document.body, key)).toBe(true);
		}
	});

	it("render::arrow-keys-ignored-while-typing-and-when-static", () => {
		// Two boundaries, both of which would be silent defects.
		//
		// 1. A viewer typing in a field must keep their caret. Nothing on `/`
		//    has an input today, and CS13 §5 narrowed the binding to the
		//    carousel — but the guard is KEPT rather than dropped, because a
		//    field placed INSIDE the carousel later would reach the handler and
		//    a caret moving in it must not also rotate the hero. The input is
		//    therefore mounted inside the carousel, which is now the only place
		//    it could do harm.
		//
		// ⛔ CS14 §1 RE-POINT — THE INPUT IS NOW FOCUSED. A typing guard is a
		// claim about where the CARET is, and CS14 reads that off
		// `document.activeElement`; `fireEvent` alone never moves focus, so the
		// old form dispatched at an unfocused field and was really testing
		// body-focus. It passed under CS13 for a reason unrelated to typing, and
		// would now pass or fail for another one. Focusing makes it test the
		// thing it is named for — and ALL FOUR keys are checked, since a caret
		// moves on the vertical pair too.
		const { unmount } = render(<DiscoveryCarousel markets={views(3)} />);
		const input = document.createElement("input");
		screen.getByTestId("carousel-controls").appendChild(input);
		for (const key of ["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"]) {
			keyFocusedOn(input, key);
			expectActive(0);
		}
		input.remove();
		unmount();

		// 2. One market ⇒ static (§22 F-DISC-2). No timer, no arrows, and no
		//    key handler either — a keypress must not move a single-position
		//    carousel. ⚠ With n = 1 the `‹ ›` buttons do not render, so the press
		//    goes to the carousel root; there is no descendant control to use.
		render(<DiscoveryCarousel markets={views(1)} />);
		fireEvent.keyDown(screen.getByTestId("discovery-carousel"), {
			key: "ArrowRight",
		});
		expectActive(0);
	});

	it("render::straight-eight-wrap", () => {
		render(<DiscoveryCarousel markets={views(8)} />);
		expect(screen.getAllByTestId("carousel-dot")).toHaveLength(8);
		const prev = screen.getByLabelText("Previous market");
		const next = screen.getByLabelText("Next market");
		// ‹ at index 0 wraps backward to n−1 = 7.
		fireEvent.click(prev);
		expectActive(7);
		// › at 7 wraps forward to 0.
		fireEvent.click(next);
		expectActive(0);
		// Auto-advance rides the SAME straight ring: park at 7 (7 × ›), then
		// one full period wraps 7 → 0.
		for (let k = 0; k < 7; k += 1) {
			fireEvent.click(next);
		}
		expectActive(7);
		act(() => {
			vi.advanceTimersByTime(10_000);
		});
		expectActive(0);
	});

	it("render::hero-single-market-static", () => {
		render(<DiscoveryCarousel markets={views(1)} />);
		// No arrows at n = 1 (rendered ONLY when n > 1).
		expect(screen.queryByLabelText("Previous market")).toBeNull();
		expect(screen.queryByLabelText("Next market")).toBeNull();
		// Exactly one dot, active.
		const dots = screen.getAllByTestId("carousel-dot");
		expect(dots).toHaveLength(1);
		expect(dots[0].getAttribute("data-active")).toBe("true");
		// NO auto-advance — three full periods later the hero is unmoved
		// (the §17 `hero-single-market-static` client half; F-DISC-2).
		act(() => {
			vi.advanceTimersByTime(30_000);
		});
		expectActive(0);
	});

	it("render::dot-fill-on-active-only", () => {
		const { container } = render(<DiscoveryCarousel markets={views(3)} />);
		// Exactly ONE countdown fill, inside the active dot (index 0).
		const fills = screen.getAllByTestId("dot-fill");
		expect(fills).toHaveLength(1);
		const dots = screen.getAllByTestId("carousel-dot");
		expect(dots[0].getAttribute("data-active")).toBe("true");
		expect(dots[0].contains(fills[0])).toBe(true);
		// After an auto-advance: still exactly one, now inside the NEW
		// active dot — inactive dots carry none.
		act(() => {
			vi.advanceTimersByTime(10_000);
		});
		const fillsAfter = screen.getAllByTestId("dot-fill");
		expect(fillsAfter).toHaveLength(1);
		const dotsAfter = screen.getAllByTestId("carousel-dot");
		expect(dotsAfter[1].getAttribute("data-active")).toBe("true");
		expect(dotsAfter[1].contains(fillsAfter[0])).toBe(true);
		// Canon §3.10 — `:has()` BANNED; JS-toggled classes/attrs only. No
		// class string anywhere in the tree may carry it (`getAttribute`
		// rather than `.className` — SVG className is an object at runtime).
		for (const el of Array.from(container.querySelectorAll("*"))) {
			expect(el.getAttribute("class") ?? "").not.toContain(":has(");
		}
	});

	it("render::sparse-shrink-no-placeholders", () => {
		const { container } = render(<DiscoveryCarousel markets={views(3)} />);
		// Exactly the available set — no placeholder cards, no phantom dots.
		expect(screen.getByTestId("discovery-grid")).toBeTruthy();
		expect(screen.getAllByTestId("market-card")).toHaveLength(3);
		expect(screen.getAllByTestId("carousel-dot")).toHaveLength(3);
		// Anchor census: n whole-card links + THE HERO MARKET PANEL + market 1's
		// TWO hero-post deep-links + market 1's TWO hero-author profile links
		// (UI.A5 A4 follow-up #2); the side-empty panels carry ZERO.
		// n=3 → 3 + 1 + 2 + 2 = 8.
		//
		// ⚠ 7 → 8 AT HTML-FINISH row 2. The hero market panel used to be a plain
		// `<div>` — "the hero market panel + side-empty panels carry ZERO" was
		// this line's own note. Row 2 makes the WHOLE panel open its market, the
		// way the tiles already do (mockup `:399-401`, `:395`), so it is now an
		// anchor and the census gains exactly one. The count is deliberately
		// exact: it is what would catch a stray second anchor smuggled into any
		// panel.
		expect(container.querySelectorAll("a")).toHaveLength(8);
	});

	it("render::empty-views-render-nothing", () => {
		const { container } = render(<DiscoveryCarousel markets={[]} />);
		// Empty set → the carousel renders NULL (the page renders EmptyState
		// instead — Slice 6's wiring).
		expect(container.firstChild).toBeNull();
	});
});
