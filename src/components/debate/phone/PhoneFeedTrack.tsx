"use client";

import { type ReactNode, useCallback, useEffect, useRef } from "react";

/**
 * RF-3 — the horizontal scroll-snap track the two side feeds live in.
 *
 * ⛔⛔ NO GESTURE JS. The swipe is `scroll-snap-type: x mandatory` plus
 * `overflow-x-auto`, i.e. the browser's own scrolling, and the only JavaScript
 * here READS it. A hand-written pointer/drag handler would have to reimplement
 * momentum, rubber-banding, cancellation, and the platform's own accessibility
 * behaviour, and would get all four subtly wrong on the one device class this
 * tier exists for.
 *
 * ⇒ The two directions are asymmetric on purpose: tapping a tab WRITES the
 * scroll position (`scrollTo`), and an `IntersectionObserver` READS it back to
 * set the active tab. Nothing else observes the track, so a swipe and a tap
 * converge on the same state by the same path.
 *
 * ⚠ `prefers-reduced-motion` SWITCHES `behavior`, AND IT IS READ THROUGH THE
 * SAME `matchMedia` PATTERN THE COMPOSER ALREADY USES (`ComposerSlot.tsx`).
 * `behavior: "smooth"` on a `scrollTo` is an animation like any other; a reader
 * who has asked the platform for no motion has asked for this one too. It is
 * read at CALL TIME rather than cached in state, so a reader who changes the OS
 * setting mid-session is honoured without a re-render, and there is no stored
 * copy of a value that can go stale.
 *
 * ⚠ `touch-action: pan-x pan-y` — both axes, deliberately. Restricting to
 * `pan-x` would hand horizontal panning to the browser and TAKE VERTICAL AWAY,
 * which on a feed of posts means the page cannot be read.
 *
 * ⚠ THE OBSERVER'S THRESHOLD IS 0.6 AND NOT 0.5. At exactly one half, a track
 * parked precisely between two panes has both crossing at once and the active
 * tab flickers between them; 0.6 admits one pane at a time by construction.
 */
export function PhoneFeedTrack({
	panes,
	active,
	onActiveChange,
}: {
	panes: { key: string; content: ReactNode }[];
	active: string;
	onActiveChange: (key: string) => void;
}) {
	const trackRef = useRef<HTMLDivElement>(null);
	// ⚠ ONE STABLE CALLBACK REF, not a value captured in the effect's closure:
	// the observer is armed once and must keep calling the CURRENT handler, not
	// the one that existed when it was armed.
	const onActiveChangeRef = useRef(onActiveChange);
	onActiveChangeRef.current = onActiveChange;

	// Tapping a tab scrolls its pane into view. ⚠ It does NOT also set the active
	// key: the observer does that when the pane arrives, so a tap and a swipe end
	// at the same state through the same path, and a scroll that is interrupted
	// never leaves the tab claiming a pane the reader is not looking at.
	const scrollToPane = useCallback((key: string) => {
		const track = trackRef.current;
		if (track === null) {
			return;
		}
		const pane = track.querySelector<HTMLElement>(`[data-pane="${key}"]`);
		if (pane === null) {
			return;
		}
		const reduced =
			typeof window !== "undefined" &&
			typeof window.matchMedia === "function" &&
			window.matchMedia("(prefers-reduced-motion: reduce)").matches;
		track.scrollTo({
			left: pane.offsetLeft - track.offsetLeft,
			behavior: reduced ? "auto" : "smooth",
		});
	}, []);

	useEffect(() => {
		scrollToPane(active);
	}, [active, scrollToPane]);

	useEffect(() => {
		const track = trackRef.current;
		// jsdom ships no IntersectionObserver; the guard keeps the render path
		// usable under the component harness, where the observer is not the thing
		// under test.
		if (track === null || typeof IntersectionObserver === "undefined") {
			return;
		}
		const observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (!entry.isIntersecting) {
						continue;
					}
					const key = (entry.target as HTMLElement).dataset.pane;
					if (key !== undefined) {
						onActiveChangeRef.current(key);
					}
				}
			},
			{ root: track, threshold: 0.6 },
		);
		for (const pane of track.querySelectorAll("[data-pane]")) {
			observer.observe(pane);
		}
		return () => observer.disconnect();
	}, []);

	return (
		<div
			ref={trackRef}
			data-testid="phone-feed-track"
			className="flex min-h-0 flex-1 snap-x snap-mandatory overflow-x-auto overflow-y-hidden [touch-action:pan-x_pan-y] [scrollbar-width:none]"
		>
			{panes.map((pane) => (
				<div
					key={pane.key}
					data-pane={pane.key}
					data-testid={`phone-pane-${pane.key}`}
					className="w-full shrink-0 snap-start snap-always overflow-y-auto overscroll-contain"
				>
					{pane.content}
				</div>
			))}
		</div>
	);
}
