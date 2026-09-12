// @vitest-environment jsdom
/**
 * MOBILE-2b D-1 — the tab was dead, and nothing in the suite could see it.
 *
 * `PhoneFeedTrack` writes the scroll position when a tab is tapped and reads it
 * back with an `IntersectionObserver`. A smooth scroll is progressive, so one
 * frame in, the pane the reader is LEAVING is still ~98% visible; the observer
 * reported it, the host set `active` back, and the write effect scrolled home
 * and cancelled its own animation. Tapping `NO` moved the feed six pixels and
 * put it back — on both engines, for every reader who has not switched Reduce
 * Motion on. Half the debate was unreachable.
 *
 * ⛔ WHY THIS IS A jsdom TEST AND NOT A BROWSER ONE. jsdom ships no
 * `IntersectionObserver` and no scrolling, which sounds like a reason to give
 * up and measure in a real browser — and a real-browser check exists in the QA
 * harness. But the defect is not a LAYOUT fact, it is an ORDERING fact: a
 * report arriving while a scroll is in flight. Supplying the observer myself is
 * what makes that ordering something I can state exactly rather than provoke
 * and hope for; the browser reproduces it at the mercy of frame timing, and a
 * timing-dependent guard that goes green on a fast machine is not a guard.
 *
 * ⚠ THE POSITIVE CONTROL IS THE WHOLE TEST (OVN-V1). "The observer's report was
 * ignored" is satisfied perfectly by a component that ignores the observer
 * entirely — which would be a worse defect than the one being fixed, and would
 * pass a naive assertion. So every mute assertion here is paired with a report
 * that MUST get through: the destination arriving, and a later swipe.
 */
import { fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PhoneFeedTrack } from "@/components/debate/phone/PhoneFeedTrack";

/** The observer callbacks armed by the component, newest last. */
let armed: Array<{
	cb: IntersectionObserverCallback;
	observed: Element[];
	disconnected: boolean;
}> = [];

class FakeIntersectionObserver {
	private readonly entry: (typeof armed)[number];
	constructor(cb: IntersectionObserverCallback) {
		this.entry = { cb, observed: [], disconnected: false };
		armed.push(this.entry);
	}
	observe(el: Element) {
		this.entry.observed.push(el);
	}
	unobserve() {}
	disconnect() {
		this.entry.disconnected = true;
	}
	takeRecords(): IntersectionObserverEntry[] {
		return [];
	}
	root = null;
	rootMargin = "";
	thresholds: readonly number[] = [];
}

/** Fire one batch at the live observer, as the browser would. */
function report(pane: string, ratio: number) {
	const live = armed.filter((a) => !a.disconnected).at(-1);
	if (live === undefined) throw new Error("no live observer — nothing armed");
	const target = live.observed.find(
		(el) => (el as HTMLElement).dataset.pane === pane,
	);
	if (target === undefined) {
		throw new Error(
			`observer is not watching pane ${pane} (watching: ${live.observed
				.map((el) => (el as HTMLElement).dataset.pane)
				.join(",")})`,
		);
	}
	live.cb(
		[
			{
				target,
				intersectionRatio: ratio,
			} as unknown as IntersectionObserverEntry,
		],
		{} as IntersectionObserver,
	);
}

/**
 * jsdom has no layout: every `offsetLeft` is 0, so the component's
 * already-there short-circuit would fire for both panes and no scroll would
 * ever be programmatic. Give the panes the geometry a 390px phone has.
 */
function giveTrackLayout(container: HTMLElement, scrollLeft = 0) {
	const track = container.querySelector<HTMLElement>(
		'[data-testid="phone-feed-track"]',
	);
	if (track === null) throw new Error("no track");
	Object.defineProperty(track, "offsetLeft", { value: 0, configurable: true });
	track.scrollLeft = scrollLeft;
	for (const [i, pane] of Array.from(
		track.querySelectorAll<HTMLElement>("[data-pane]"),
	).entries()) {
		Object.defineProperty(pane, "offsetLeft", {
			value: i * 390,
			configurable: true,
		});
	}
	return track;
}

const PANES = [
	{ key: "YES", content: <p>yes side</p> },
	{ key: "NO", content: <p>no side</p> },
];

let scrollCalls: Array<{ left: number }> = [];

beforeEach(() => {
	armed = [];
	scrollCalls = [];
	vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver);
	// jsdom's Element.prototype has no scrollTo at all.
	Object.defineProperty(Element.prototype, "scrollTo", {
		value: function scrollTo(opts: { left: number }) {
			scrollCalls.push({ left: opts.left });
			// A SMOOTH scroll does not land here — that is the whole defect. The
			// position is left exactly where it was, which is what the browser's
			// first animation frame looks like.
		},
		configurable: true,
		writable: true,
	});
});

afterEach(() => {
	vi.unstubAllGlobals();
	vi.useRealTimers();
});

describe("PhoneFeedTrack · D-1 · a programmatic scroll is not a reader changing their mind", () => {
	it("ignores the pane being LEFT while the slide to the new pane is in flight", () => {
		const onActiveChange = vi.fn();
		const { container, rerender } = render(
			<PhoneFeedTrack
				panes={PANES}
				active="YES"
				onActiveChange={onActiveChange}
			/>,
		);
		giveTrackLayout(container, 0);

		// The tab was tapped: the host has set `active` to NO.
		rerender(
			<PhoneFeedTrack
				panes={PANES}
				active="NO"
				onActiveChange={onActiveChange}
			/>,
		);
		expect(scrollCalls.at(-1)).toEqual({ left: 390 });

		// One frame in, the track has barely moved and YES is still nearly whole.
		// THIS is the report that used to send the reader straight back.
		report("YES", 0.98);
		expect(onActiveChange).not.toHaveBeenCalledWith("YES");

		// ── the positive control: the destination's own report is NOT muted, and
		//    the mute ends with it. Without this pair, a component that ignored
		//    the observer entirely would pass the assertion above.
		report("NO", 1);
		onActiveChange.mockClear();
		report("YES", 0.99);
		expect(onActiveChange).toHaveBeenCalledWith("YES");
	});

	it("never mutes the reader's own swipe — no destination was declared", () => {
		const onActiveChange = vi.fn();
		const { container } = render(
			<PhoneFeedTrack
				panes={PANES}
				active="YES"
				onActiveChange={onActiveChange}
			/>,
		);
		giveTrackLayout(container, 0);
		report("NO", 0.87);
		expect(onActiveChange).toHaveBeenCalledWith("NO");
	});

	it("releases the mute when the reader MOVES on the track mid-slide, and not merely on touch", () => {
		const onActiveChange = vi.fn();
		const { container, rerender } = render(
			<PhoneFeedTrack
				panes={PANES}
				active="YES"
				onActiveChange={onActiveChange}
			/>,
		);
		const track = giveTrackLayout(container, 0);
		rerender(
			<PhoneFeedTrack
				panes={PANES}
				active="NO"
				onActiveChange={onActiveChange}
			/>,
		);
		report("YES", 0.98);
		expect(onActiveChange).not.toHaveBeenCalledWith("YES");

		// ⛔ A TOUCH THAT HAS NOT MOVED HAS NOT OVERRULED ANYTHING, and releasing
		// on `pointerdown` put D-1's symptom straight back: tap NO, then touch the
		// feed inside the ~300ms slide — which is what a reader does next — and
		// the very next batch is the OLD pane crossing 0.6 downward while the new
		// one sits at 0.4 and is filtered out. The batch resolves to the pane
		// being left. Tap NO, land on YES. (`@code-reviewer`.)
		fireEvent.pointerDown(track);
		report("YES", 0.98);
		expect(onActiveChange).not.toHaveBeenCalledWith("YES");

		// MOVEMENT is the signal that the reader is driving.
		fireEvent.pointerMove(track);
		report("YES", 0.98);
		expect(onActiveChange).toHaveBeenCalledWith("YES");
	});

	it("holds the mute for longer than a slide takes — the backstop must not expire mid-animation", () => {
		// ⛔ THE `releases the mute on a timeout` ROW PINS ONLY THE CEILING. It
		// advances 1000ms and demands a release, so `SCROLL_SETTLE_MS` cannot grow
		// without bound — but nothing stopped it SHRINKING, and shrinking is the
		// direction that undoes D-1 completely. Measured, not supposed: set to `0`
		// the constant leaves every other row in this file green, because none of
		// them advances a clock while the mute is meant to be held. In a browser a
		// 0ms backstop fires on the next task, some four milliseconds in, and the
		// observer is listening again long before the slide's ~300ms has played —
		// which is the whole defect back, with a green suite over it.
		// ⇒ Advance a realistic slide's worth of time and demand the mute SURVIVE
		//   it. This row and that one together box the constant into
		//   (300ms, 1000ms] behaviourally, without either naming its value.
		vi.useFakeTimers();
		const onActiveChange = vi.fn();
		const { container, rerender } = render(
			<PhoneFeedTrack
				panes={PANES}
				active="YES"
				onActiveChange={onActiveChange}
			/>,
		);
		giveTrackLayout(container, 0);
		rerender(
			<PhoneFeedTrack
				panes={PANES}
				active="NO"
				onActiveChange={onActiveChange}
			/>,
		);

		vi.advanceTimersByTime(300);
		report("YES", 0.98);
		expect(onActiveChange).not.toHaveBeenCalledWith("YES");

		// ── the positive control, in the same shape the rest of this file uses: a
		//    component that ignored the observer outright would pass the line
		//    above. The destination's own arrival must still get through, and must
		//    still end the mute.
		report("NO", 1);
		onActiveChange.mockClear();
		report("YES", 0.99);
		expect(onActiveChange).toHaveBeenCalledWith("YES");
	});

	it("releases on `touchmove` as well as `pointermove` — both pointer families", () => {
		// ⚠ THE `releases the mute when the reader touches the track` ROW FIRES
		// ONLY `pointerdown`, AND THE SOURCE REGISTERS TWO LISTENERS. Deleting
		// the `touchstart` one left all five
		// original rows green — measured. That is not a claim about which event a
		// given engine sends first (modern iOS Safari does send `pointerdown`); it
		// is that a listener no test exercises is a listener the next edit can
		// remove for free, and this one is the only release path that survives a
		// tree where pointer events are swallowed before they reach the track.
		const onActiveChange = vi.fn();
		const { container, rerender } = render(
			<PhoneFeedTrack
				panes={PANES}
				active="YES"
				onActiveChange={onActiveChange}
			/>,
		);
		const track = giveTrackLayout(container, 0);
		rerender(
			<PhoneFeedTrack
				panes={PANES}
				active="NO"
				onActiveChange={onActiveChange}
			/>,
		);
		report("YES", 0.98);
		expect(onActiveChange).not.toHaveBeenCalledWith("YES");

		// Same contract on the touch pair: `touchstart` alone is not a release.
		fireEvent.touchStart(track);
		report("YES", 0.98);
		expect(onActiveChange).not.toHaveBeenCalledWith("YES");

		fireEvent.touchMove(track);
		report("YES", 0.98);
		expect(onActiveChange).toHaveBeenCalledWith("YES");
	});

	it("releases the mute on a timeout, so a slide that never lands cannot deafen the track", () => {
		vi.useFakeTimers();
		const onActiveChange = vi.fn();
		const { container, rerender } = render(
			<PhoneFeedTrack
				panes={PANES}
				active="YES"
				onActiveChange={onActiveChange}
			/>,
		);
		giveTrackLayout(container, 0);
		rerender(
			<PhoneFeedTrack
				panes={PANES}
				active="NO"
				onActiveChange={onActiveChange}
			/>,
		);
		report("YES", 0.98);
		expect(onActiveChange).not.toHaveBeenCalledWith("YES");

		vi.advanceTimersByTime(1000);
		report("YES", 0.98);
		expect(onActiveChange).toHaveBeenCalledWith("YES");
	});

	it("does not mute when the track is already where the host asked it to be", () => {
		const onActiveChange = vi.fn();
		const { container, rerender } = render(
			<PhoneFeedTrack
				panes={PANES}
				active="YES"
				onActiveChange={onActiveChange}
			/>,
		);
		// The observer has just confirmed NO and the host re-rendered; the track is
		// ALREADY at the destination, so this render must arm no mute at all.
		//
		// ⚠ 390.4, NOT 390, AND THE FRACTION IS THE POINT. `scrollLeft` is a
		// double, and a settled snap on a 3× screen lands a few tenths off the
		// pane's `offsetLeft`; that is why the source compares with a ±1 tolerance
		// rather than for equality. An exact 390 here made the tolerance
		// decorative — measured: tightening it to `<= 0` left all five original
		// rows green, while in a browser it would arm a pointless mute on every
		// at-rest re-render and swallow the reader's next swipe for the whole
		// backstop. That is D-1 wearing the other direction, which this file's
		// own docblock names as the thing the fix must not trade for.
		giveTrackLayout(container, 390.4);
		rerender(
			<PhoneFeedTrack
				panes={PANES}
				active="NO"
				onActiveChange={onActiveChange}
			/>,
		);
		report("YES", 0.91);
		expect(onActiveChange).toHaveBeenCalledWith("YES");
	});
});
