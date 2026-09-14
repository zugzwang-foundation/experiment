// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { act, cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PhoneTopPill } from "@/components/debate/phone/PhoneTopPill";
import { lockPageScroll } from "@/components/debate/scroll-lock";

/**
 * MOBILE-2k · F-1 — THE TAP: WHAT IT SCROLLS, WHAT IT REFETCHES, AND WHAT IT
 * REFUSES. Plan §3 rows G3 (exactly one `router.refresh()` per tap, on the
 * arrival path AND on the deadline path), G4 (no refresh while busy) and G5's
 * behavioural half (the scroll goes to the REGION, never to `window`).
 *
 * ⛔⛔ WHY "EXACTLY ONCE" IS THE PROPERTY AND NOT "AT LEAST ONCE". A
 * `router.refresh()` is an RSC payload fetch for the whole route. Two of them
 * for one intent is two round trips a phone reader pays for, and — on the
 * surface that takes money — a second re-render of the tree a composer is
 * mounted in. The component's own docblock is explicit that "should not remount
 * it" is the wrong strength of claim to put between a participant and a double
 * charge.
 *
 * ⚠ THE COUNTER CAN GO UP, AND ONE ROW EXISTS TO PROVE IT. Every "exactly once"
 * assertion below is satisfied by a build whose refetch is wired to nothing at
 * all if the count were only ever compared against 1 — so
 * `a-second-tap-after-the-refresh-lands-refetches-again` reaches 2 through the
 * same mock, in the same file.
 *
 * ⚠⚠ TWO THINGS THIS FILE CANNOT REACH, STATED SO ITS COVERAGE IS NOT READ AS
 * TOTAL:
 *
 *   · **The `refreshing` refusal.** `router.refresh()` is mocked, so the
 *     transition it drives settles inside the same `act()` and `isPending` is
 *     never observably true between two statements. A second tap "during the
 *     refresh" is therefore not constructible here, and asserting it would be
 *     asserting a window that does not exist in this harness.
 *   · **The `locked` prop at TAP time.** While `locked` is true the pill returns
 *     `null`, so there is no element to tap — which is what the component's own
 *     docblock means by "unreachable by pointer today". The render gate is
 *     covered by `phone-top-pill.test.tsx`; the `isPageScrollLocked()` clause
 *     beside it IS reachable and is covered below, because that is precisely the
 *     case where the render gate and the lock disagree.
 */
const ROOT = process.cwd();
const PILL = "src/components/debate/phone/PhoneTopPill.tsx";
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

/** A named `const <NAME> = <n>` read out of the file that declares it. */
function constantOf(name: string): number {
	const m = new RegExp(`const ${name} = (\\d+)`).exec(read(PILL));
	if (!m?.[1]) {
		throw new Error(
			`${PILL}: no \`const ${name} = <n>\` — this row's timings are derived ` +
				"from that constant and cannot be re-derived from what is left",
		);
	}
	return Number(m[1]);
}

/** One animation frame, as the fake clock delivers them. */
const FRAME_MS = 20;

const refresh = vi.fn();
vi.mock("next/navigation", () => ({
	useRouter: () => ({ push: vi.fn(), refresh }),
	useParams: () => ({ slug: "bitcoin-price-50k" }),
}));

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
	vi.clearAllMocks();
	vi.useRealTimers();
});

/**
 * ⚠ jsdom SHIPS NO `matchMedia` AT ALL (measured: `typeof window.matchMedia` is
 * `"undefined"` under jsdom 29.1.1), so the tap's reduced-motion read THROWS
 * unless it is stubbed. `matches` is a getter for the reason
 * `phone-sheet-motion.test.tsx` gives: the component calls `matchMedia` fresh on
 * every tap, so a captured boolean would freeze whichever object was built first.
 */
function stubReducedMotion(answer: boolean): void {
	vi.stubGlobal("matchMedia", (query: string) => ({
		media: query,
		get matches() {
			return query === "(prefers-reduced-motion: reduce)" ? answer : false;
		},
		addEventListener: () => undefined,
		removeEventListener: () => undefined,
		addListener: () => undefined,
		removeListener: () => undefined,
		onchange: null,
		dispatchEvent: () => false,
	}));
}

type Harness = {
	region: HTMLDivElement;
	regionScrollTo: ReturnType<typeof vi.fn>;
	windowScrollTo: ReturnType<typeof vi.fn>;
	unmount: () => void;
	rerender: (props: { locked: boolean; busy: boolean }) => void;
};

/**
 * The pill over a region whose scroll position, viewport height and `scrollTo`
 * are all ours — jsdom implements none of the three (no layout, and
 * `Element.prototype.scrollTo` does not exist).
 */
function mountPill(props: { locked: boolean; busy: boolean }): Harness {
	const region = document.createElement("div") as HTMLDivElement;
	let top = 0;
	Object.defineProperty(region, "scrollTop", {
		configurable: true,
		get: () => top,
		set: (value: number) => {
			top = value;
		},
	});
	Object.defineProperty(region, "clientHeight", {
		configurable: true,
		get: () => 800,
	});
	const regionScrollTo = vi.fn();
	region.scrollTo = regionScrollTo;
	document.body.appendChild(region);

	const windowScrollTo = vi.fn();
	vi.stubGlobal("scrollTo", windowScrollTo);

	const ref = { current: region };
	const rendered = render(
		<PhoneTopPill regionRef={ref} locked={props.locked} busy={props.busy} />,
	);
	return {
		region,
		regionScrollTo,
		windowScrollTo,
		unmount: rendered.unmount,
		rerender: (next) =>
			rendered.rerender(
				<PhoneTopPill regionRef={ref} locked={next.locked} busy={next.busy} />,
			),
	};
}

const pill = () =>
	document.querySelector<HTMLButtonElement>('[data-testid="phone-top-pill"]');

function scrollTo(region: HTMLElement, top: number): void {
	act(() => {
		region.scrollTop = top;
		region.dispatchEvent(new Event("scroll"));
	});
}

/** Deep in the feed, then rising — the one gesture that shows the pill. */
function driveShow(region: HTMLElement): void {
	scrollTo(region, 2000);
	scrollTo(region, 1500);
}

function tap(): void {
	const el = pill();
	if (el === null) {
		throw new Error(
			"no pill to tap — the show gesture did not produce one, so nothing " +
				"below this line is exercising the tap at all",
		);
	}
	act(() => {
		el.click();
	});
}

function advance(ms: number): void {
	act(() => {
		vi.advanceTimersByTime(ms);
	});
}

describe("MOBILE-2k · F-1 — one refetch per tap, on both paths (G3)", () => {
	/**
	 * Already at the top: there is no scroll to wait for, only the refresh. The
	 * pill is still on screen because the reader is deep in the feed by POSITION
	 * — this is the case where they have scrolled back to the top by hand and
	 * then asked for fresh prices.
	 */
	it("phone-top-pill-refetch::a-tap-at-the-top-refetches-and-scrolls-nothing", () => {
		stubReducedMotion(false);
		const h = mountPill({ locked: false, busy: false });
		driveShow(h.region);
		h.region.scrollTop = constantOf("AT_TOP_PX");
		tap();

		expect(refresh).toHaveBeenCalledTimes(1);
		expect(
			h.regionScrollTo,
			"there is nothing to scroll: a `scrollTo` here animates the region " +
				"from the top to the top, which is a frame of work and a poll waiting " +
				"for an arrival that already happened",
		).not.toHaveBeenCalled();
	});

	/**
	 * G5 — THE REGION, BY IDENTITY. The document does not scroll on this tier, so
	 * `window.scrollTo` is a no-op that reads as an action; the spy proves it is
	 * not merely absent from the source but never called.
	 */
	it("phone-top-pill-refetch::the-scroll-target-is-the-REGION-never-the-window", () => {
		stubReducedMotion(false);
		vi.useFakeTimers();
		const h = mountPill({ locked: false, busy: false });
		driveShow(h.region);
		tap();

		expect(
			h.regionScrollTo,
			"the pill must scroll the element the host handed it — that element is " +
				"the tier's only vertical scroller",
		).toHaveBeenCalledTimes(1);
		expect(h.regionScrollTo).toHaveBeenCalledWith({
			top: 0,
			behavior: "smooth",
		});
		expect(
			h.windowScrollTo,
			"`window.scrollTo` on a document that does not scroll is a silent " +
				"no-op: the reader taps, nothing moves, and the refetch waits for an " +
				"arrival that can never happen",
		).not.toHaveBeenCalled();
	});

	/**
	 * The ruled instant scroll under reduced motion — the same `matchMedia` read
	 * `ComposerSlot` and `PhoneSheet` already make, and the only query this tier
	 * is allowed. Paired with its own control, because a build that ignored the
	 * query entirely would satisfy either half alone.
	 */
	it("phone-top-pill-refetch::reduced-motion-scrolls-instantly", () => {
		vi.useFakeTimers();
		stubReducedMotion(true);
		const reduced = mountPill({ locked: false, busy: false });
		driveShow(reduced.region);
		tap();
		expect(reduced.regionScrollTo).toHaveBeenCalledWith({
			top: 0,
			behavior: "auto",
		});
		cleanup();

		// THE CONTROL — the same tap with the query answering false is SMOOTH.
		// Without it this row passes against a component that hard-codes "auto"
		// for everybody, which is the ruling deleted rather than honoured.
		stubReducedMotion(false);
		const normal = mountPill({ locked: false, busy: false });
		driveShow(normal.region);
		tap();
		expect(normal.regionScrollTo).toHaveBeenCalledWith({
			top: 0,
			behavior: "smooth",
		});
	});

	it("phone-top-pill-refetch::the-arrival-path-refetches-exactly-once", () => {
		stubReducedMotion(false);
		vi.useFakeTimers();
		const h = mountPill({ locked: false, busy: false });
		driveShow(h.region);
		tap();

		// The scroll is still travelling. Nothing has been refetched.
		advance(FRAME_MS * 3);
		expect(
			refresh,
			"the refetch fired before the region reached the top — the reader would " +
				"get new content and then be carried to the top of it, which is the " +
				"two halves of the gesture in the wrong order",
		).not.toHaveBeenCalled();

		// Arrival.
		h.region.scrollTop = 0;
		advance(FRAME_MS);
		expect(refresh).toHaveBeenCalledTimes(1);

		// ...and the deadline behind it does not fire a second one.
		advance(constantOf("ARRIVAL_DEADLINE_MS") * 3);
		expect(
			refresh,
			"the deadline fired on top of the arrival — two payload fetches for " +
				"one tap",
		).toHaveBeenCalledTimes(1);
	});

	/**
	 * ⛔ THE TIMEOUT REFETCHES; IT DOES NOT ABANDON. A finger that fought the
	 * animation, or an engine that parked it, must not cost the reader the second
	 * half of what they asked for — a scroll that did not finish AND stale
	 * content, with nothing to say the refresh never happened.
	 */
	it("phone-top-pill-refetch::the-deadline-refetches-rather-than-abandons-exactly-once", () => {
		stubReducedMotion(false);
		vi.useFakeTimers();
		const deadline = constantOf("ARRIVAL_DEADLINE_MS");
		const h = mountPill({ locked: false, busy: false });
		driveShow(h.region);
		tap();

		// The region never arrives. One millisecond short of the deadline, nothing
		// has fired — which is what makes the row below a measurement of the
		// deadline rather than of some other timer.
		advance(deadline - 1);
		expect(refresh).not.toHaveBeenCalled();

		advance(FRAME_MS * 2);
		expect(
			refresh,
			`the region never reached the top and the ${deadline}ms deadline did ` +
				"not fire — the reader asked for fresh content and silently did not " +
				"get any",
		).toHaveBeenCalledTimes(1);

		advance(deadline * 3);
		expect(
			refresh,
			"the poll kept firing past its own deadline",
		).toHaveBeenCalledTimes(1);
	});

	/**
	 * ⛔⛔ ARRIVAL AND THE DEADLINE TRUE IN THE SAME FRAME — the starved-frame
	 * case, reached by holding the frame callback and moving the clock under it.
	 * That is not artificial: a backgrounded tab stops delivering animation frames
	 * while `performance.now()` keeps running, so the first frame after the reader
	 * returns can be a second late with the region already at rest.
	 *
	 * ⚠ WHAT THIS ROW DOES AND DOES NOT CATCH, because the component's docblock
	 * overstates it. `tick` is one `if (arrived || expired) { refetchOnce();
	 * return; }`, so a frame in which both are true calls once by SHAPE — the
	 * `firedForThisTap` latch is not what makes this green, and removing the latch
	 * would not redden it. What this row does catch is the restructuring that
	 * makes the docblock's fear real: two consecutive `if`s, one per condition,
	 * which is the natural way to add a third arrival signal later.
	 */
	it("phone-top-pill-refetch::arrival-and-the-deadline-in-one-frame-refetch-once", () => {
		stubReducedMotion(false);
		vi.useFakeTimers();
		const frames: FrameRequestCallback[] = [];
		vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
			frames.push(cb);
			return frames.length;
		});
		vi.stubGlobal("cancelAnimationFrame", () => undefined);

		const h = mountPill({ locked: false, busy: false });
		driveShow(h.region);
		tap();
		expect(frames, "the tap scheduled an arrival poll").toHaveLength(1);

		// The tab was away: the region settled at the top AND the deadline passed
		// before the held frame runs.
		h.region.scrollTop = 0;
		advance(constantOf("ARRIVAL_DEADLINE_MS") + FRAME_MS);
		const frame = frames[0];
		if (frame === undefined) {
			throw new Error("no frame callback was captured");
		}
		act(() => {
			frame(performance.now());
		});

		expect(
			refresh,
			"both arrival and the deadline were true in one frame and the refetch " +
				"fired more than once — two payload fetches for a single tap",
		).toHaveBeenCalledTimes(1);
	});
});

describe("MOBILE-2k · F-1 — the tap's refusals (G4)", () => {
	/**
	 * ⛔ THE MONEY GUARD. A `router.refresh()` under an in-flight bet re-renders
	 * the tree the composer is mounted in. Its `key` carries `kind`,
	 * `parentCommentId` and `side`, so nothing about a refresh SHOULD remount it —
	 * and "should not" is the wrong strength of claim to put between a participant
	 * and a double charge, which is the whole argument for the check.
	 */
	it("phone-top-pill-refetch::no-refetch-while-the-composer-is-busy", () => {
		stubReducedMotion(false);
		const h = mountPill({ locked: false, busy: true });
		driveShow(h.region);
		h.region.scrollTop = 0;
		tap();
		expect(
			refresh,
			"a bet or sell is in flight and the pill refetched anyway",
		).not.toHaveBeenCalled();

		// THE CONTROL — the same tap on the same instance with the flight ended.
		// Without it this row is green against a pill whose click handler is not
		// wired at all.
		h.rerender({ locked: false, busy: false });
		tap();
		expect(refresh).toHaveBeenCalledTimes(1);
	});

	/**
	 * ⛔⛔ THE ONE REFUSAL NOTHING ELSE CAN REACH, AND THE ONLY ROW THAT COVERS A
	 * WHOLE CLAUSE OF `onTap`.
	 *
	 * The render gate is React state (`PhoneDebateView`'s `sheet !== null`) and
	 * `isPageScrollLocked()` is a module-level refcount. They agree today, which
	 * is exactly why the second one looks deletable: with the pill absent under
	 * `locked`, a reviewer sees a condition that can never be false and nothing
	 * in the suite goes red if it is removed. This row constructs the state where
	 * they disagree — a lock held by something the host's `sheet` state does not
	 * know about — and that is the day the clause is the only thing still correct.
	 */
	it("phone-top-pill-refetch::no-refetch-while-the-module-lock-is-held", () => {
		stubReducedMotion(false);
		const h = mountPill({ locked: false, busy: false });
		driveShow(h.region);
		h.region.scrollTop = 0;
		const release = lockPageScroll(null);
		try {
			expect(
				pill(),
				"precondition: the render gate says nothing is up",
			).not.toBeNull();
			tap();
			expect(
				refresh,
				"a scroll lock is held by a layer the host's `sheet` state does not " +
					"know about, and the pill refetched under it",
			).not.toHaveBeenCalled();
		} finally {
			release();
		}

		// THE CONTROL — the lock released, the same tap on the same instance.
		tap();
		expect(refresh).toHaveBeenCalledTimes(1);
	});

	/**
	 * THE COUNTER GOES UP. Every "exactly once" row above compares against 1, and
	 * a mock that can never be called twice satisfies all of them. Two taps with
	 * the refresh settling in between reach 2 through the same mock — so the 1s
	 * are measurements and not a ceiling.
	 */
	it("phone-top-pill-refetch::a-second-tap-after-the-refresh-lands-refetches-again", () => {
		stubReducedMotion(false);
		const h = mountPill({ locked: false, busy: false });
		driveShow(h.region);
		h.region.scrollTop = 0;
		tap();
		expect(refresh).toHaveBeenCalledTimes(1);

		// The reader is still deep in the feed by position, so the pill is still
		// on screen; they ask again.
		tap();
		expect(
			refresh,
			"a second, separate intent produced no second refetch — the latch " +
				"outlived the tap it was latching",
		).toHaveBeenCalledTimes(2);
	});
});

describe("MOBILE-2k · F-1 — beyond G1–G12: the poll outliving its own component", () => {
	/**
	 * ⛔⛔ THE ADVERSARIAL CASE. A refetch that fires for a component that no
	 * longer exists, on a screen the reader has already left.
	 *
	 * The sequence is one ordinary gesture pair: tap the pill, then — inside the
	 * 1000ms deadline — tap a post. The arm changes, `PhoneDebateView` stops
	 * rendering the pill, and the pill unmounts. **The region does not.** It is
	 * the tier's one scroller and it survives every arm change; that is the whole
	 * point of it. So `regionRef.current` is still a live element, the `tick`
	 * guard that returns on a null ref never fires, and the only thing standing
	 * between a parked frame callback and a `router.refresh()` on an unmounted
	 * component is the cleanup that cancels it.
	 *
	 * ⚠ NONE OF G1–G12 REACHES THIS. G3 counts calls for a pill that stays
	 * mounted; G12 asserts the pill is absent on the thread arm — which it is,
	 * and which says nothing about the frame the feed arm left behind. The harness
	 * mirrors production deliberately: the ref outlives the component, exactly as
	 * `scrollRegionRef` does.
	 */
	it("phone-top-pill-refetch::an-unmount-cancels-the-arrival-poll", () => {
		stubReducedMotion(false);
		vi.useFakeTimers();
		const h = mountPill({ locked: false, busy: false });
		driveShow(h.region);
		tap();
		expect(
			refresh,
			"precondition: the poll has not fired yet",
		).not.toHaveBeenCalled();

		// The reader taps a post. The arm changes; the pill goes; the region stays.
		act(() => {
			h.unmount();
		});
		advance(constantOf("ARRIVAL_DEADLINE_MS") * 3);
		expect(
			refresh,
			"a frame callback from a pill that no longer exists refetched the route " +
				"— the reader is reading a thread and the payload is fetched under " +
				"them, from a control they left behind on the previous screen",
		).not.toHaveBeenCalled();

		// THE CONTROL — the identical sequence WITHOUT the unmount. Without it
		// this row is green against a poll that was never scheduled at all.
		cleanup();
		vi.clearAllMocks();
		const kept = mountPill({ locked: false, busy: false });
		driveShow(kept.region);
		tap();
		advance(constantOf("ARRIVAL_DEADLINE_MS") + FRAME_MS * 2);
		expect(
			refresh,
			"the poll never fires even when the pill is left mounted, so the " +
				"absence above is a fact about the harness rather than the cleanup",
		).toHaveBeenCalledTimes(1);
	});
});

/**
 * ⛔⛔ MOBILE-2k · THE FIRE-TIME REFUSALS — THE DEFECT `@test-writer` FOUND AND
 * THIS ROUND FIXED, GUARDED SO THE FIX CANNOT BE UNDONE SILENTLY.
 *
 * A tap does not refetch. It starts a smooth scroll and an arrival poll that
 * fires **up to `ARRIVAL_DEADLINE_MS` later**, and the first cut of the component
 * checked `locked` and `busy` only at TAP time. Two things then combine:
 *
 *   · `locked` makes the component return `null`, and returning `null` from
 *     render **does not unmount it** — so the queued frame callback survives the
 *     sheet opening with its closure intact;
 *   · nothing at the other end re-read either flag.
 *
 * ⚠ IT IS ONE ORDINARY TAP AWAY. Tap the pill; while the feed is still gliding,
 * tap the market title or the bet bar — well inside a second, on a surface where
 * that is a completely normal thing to do — and `router.refresh()` lands beneath
 * an open sheet. Measured at `94fac4ba` before the fix: **1** refresh past the
 * deadline with `locked` true, and **1** with `busy` true. The second is the one
 * that matters, because `busy` is the flag the component's own docblock calls the
 * money guard, and a refresh under an in-flight bet is exactly what the seven
 * host transitions in `PhoneDebateView` exist to prevent.
 *
 * ⇒ The fix is two-part and BOTH rows below are needed, because each covers one
 * part: the poll is cancelled when either flag rises, and the refusals are
 * re-read through refs inside `refetchOnce` so a callback already queued for the
 * current frame still cannot fire. A build with only the cancellation passes
 * these; a build with only the re-read passes these; a build with neither fails
 * both. That is deliberate — the pair is belt and braces on the same money path,
 * and a guard that could be satisfied by either half alone would let the braces
 * be removed.
 */
describe("MOBILE-2k · the refusals are re-checked at FIRE time, not only at tap time", () => {
	/** Tap, then raise a flag mid-flight, then run the clock past the deadline. */
	function tapThenRaise(flag: "locked" | "busy"): void {
		stubReducedMotion(false);
		vi.useFakeTimers();
		const h = mountPill({ locked: false, busy: false });
		driveShow(h.region);
		tap();
		expect(
			refresh,
			"precondition: the poll has not fired yet, so what follows is about the " +
				"window and not about a refetch that had already happened",
		).not.toHaveBeenCalled();

		// The reader opens a sheet (or a bet goes in flight) mid-scroll. The region
		// never arrives, so only the DEADLINE can fire — which is the whole window.
		act(() => {
			h.rerender({ locked: flag === "locked", busy: flag === "busy" });
		});
		advance(constantOf("ARRIVAL_DEADLINE_MS") * 3);
	}

	it("phone-top-pill-refetch::a-sheet-opening-mid-scroll-abandons-the-refetch", () => {
		tapThenRaise("locked");
		expect(
			refresh,
			"a refresh landed underneath a sheet the reader opened after tapping — " +
				"the tap-time refusal was checked and the fire-time one was not",
		).not.toHaveBeenCalled();
	});

	it("phone-top-pill-refetch::a-bet-going-in-flight-mid-scroll-abandons-the-refetch", () => {
		tapThenRaise("busy");
		expect(
			refresh,
			"a refresh landed while the composer reported a request in flight — the " +
				"one path this control is never allowed to touch",
		).not.toHaveBeenCalled();
	});

	/**
	 * ⛔⛔ THE CONTROL, AND IT IS WHAT MAKES THE TWO ZEROES ABOVE MEAN ANYTHING.
	 * Both rows assert an ABSENCE across a window, and an absence is also what a
	 * poll that was never scheduled produces, and what a mock that was cleared
	 * produces, and what a `driveShow` that stopped showing the pill produces. The
	 * identical sequence with NEITHER flag raised must reach exactly one refresh
	 * through the same mock, in the same file, on the same clock.
	 */
	it("phone-top-pill-refetch::the-same-sequence-with-no-flag-raised-DOES-refetch", () => {
		stubReducedMotion(false);
		vi.useFakeTimers();
		const h = mountPill({ locked: false, busy: false });
		driveShow(h.region);
		tap();
		act(() => {
			h.rerender({ locked: false, busy: false });
		});
		advance(constantOf("ARRIVAL_DEADLINE_MS") * 3);
		expect(
			refresh,
			"the deadline path does not fire even when nothing refuses it, so the " +
				"two absences above are facts about this harness rather than about " +
				"the refusals",
		).toHaveBeenCalledTimes(1);
	});

	/**
	 * ⚠ AND AN ABANDONED TAP MUST NOT DISARM THE CONTROL. Refusing at fire time
	 * leaves `firedForThisTap` down on purpose: nothing fired, so the next tap is a
	 * new intent. A fix that latched on refusal would make the pill permanently
	 * inert after any sheet was opened mid-scroll — a worse bug than the one being
	 * fixed, and invisible until someone tried to refresh twice in one session.
	 */
	it("phone-top-pill-refetch::an-abandoned-tap-leaves-the-next-tap-working", () => {
		stubReducedMotion(false);
		vi.useFakeTimers();
		const h = mountPill({ locked: false, busy: false });
		driveShow(h.region);
		tap();
		act(() => {
			h.rerender({ locked: true, busy: false });
		});
		advance(constantOf("ARRIVAL_DEADLINE_MS") * 2);
		expect(refresh, "the abandoned tap fired nothing").not.toHaveBeenCalled();

		// The sheet closes; the reader is still deep in the feed and taps again.
		act(() => {
			h.rerender({ locked: false, busy: false });
		});
		driveShow(h.region);
		tap();
		advance(constantOf("ARRIVAL_DEADLINE_MS") + FRAME_MS * 2);
		expect(
			refresh,
			"the second tap did nothing — the abandonment latched the control off " +
				"instead of merely declining that one intent",
		).toHaveBeenCalledTimes(1);
	});
});
