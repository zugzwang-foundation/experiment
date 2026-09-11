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

	it("releases the mute when the reader touches the track mid-slide", () => {
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

		fireEvent.pointerDown(track);
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
		// ALREADY at 390, so this render must arm no mute at all.
		giveTrackLayout(container, 390);
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
