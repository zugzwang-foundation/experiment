"use client";

import { useSyncExternalStore } from "react";

/**
 * RI-3 / O-l — "is this reader below the tier boundary", for the tree that is
 * hidden when they are.
 *
 * ADR-0051's gate is CSS: below 640px the desktop tree is `display: none` and
 * the phone tree renders. `display: none` stops painting; it does not stop
 * JavaScript. So every interval the desktop tree arms keeps firing on a phone,
 * setting state and re-rendering a two-column arena nobody can see. Measured on
 * an iPhone-sized WebKit page before this landed: **252 callbacks a minute**,
 * every one of them for the invisible tree — the phone tier itself arms none.
 *
 * That is the cost the ADR's Consequences did not name (they costed HYDRATION,
 * which is a one-off, and this is a clock). It is paid on the device class with
 * the least CPU and the smallest battery, continuously, for as long as the page
 * is open.
 *
 * ⚠ WHY A MEDIA QUERY AND NOT A WIDTH READ. `window.innerWidth` would have to
 * be polled or listened for on `resize`, and would drift from the CSS gate the
 * moment either changed. This subscribes to the query Tailwind actually emits,
 * so the two cannot disagree about where the boundary is.
 *
 * ⛔ AND THAT QUERY IS NOT WHAT THIS PARAGRAPH FIRST CLAIMED. It said
 * `max-width: 639.98px` and called the `.98` "Tailwind's own exclusive-bound
 * spelling, copied not invented". Measured in this repo's own compiled
 * stylesheet (`.next/static/chunks/*.css`): `not all and (min-width:640px)`
 * appears once and the string `639.98` appears **zero** times, against a
 * positive control of three `min-width:640px` occurrences — so the pattern does
 * find media queries in that file and the `.98` was simply absent. Caught by
 * `@code-reviewer`. The 0.02px disagreement was harmless; what was not is that
 * a change to `--breakpoint-mobile` would have moved the CSS gate and left the
 * literal behind, silently, which is the whole failure this hook exists to
 * prevent.
 *
 * ⛔ READ THROUGH `useSyncExternalStore`, NEVER DURING RENDER. A bare
 * `matchMedia(...).matches` in a component body is a hydration mismatch waiting
 * for a phone: the server has no viewport and renders the desktop answer, the
 * client renders the phone one, and React reconciles the difference by
 * discarding markup. `getServerSnapshot` returns `false` — which is also the
 * only answer the server can give honestly — and React re-renders with the real
 * value after hydration, which is exactly the documented shape for this.
 *
 * ⚠ NEUTRAL AT AND ABOVE 640px BY CONSTRUCTION, which is what makes it legal
 * under ADR-0051 D-2's scoped exception rather than a desktop edit: the query is
 * false there, every caller takes the branch it took before, and the desktop
 * render is unchanged. The neutrality test asserts that directly rather than
 * trusting this paragraph.
 */
const QUERY = "not all and (min-width: 640px)";

function subscribe(listener: () => void): () => void {
	if (
		typeof window === "undefined" ||
		typeof window.matchMedia !== "function"
	) {
		return () => {};
	}
	const mql = window.matchMedia(QUERY);
	mql.addEventListener("change", listener);
	return () => mql.removeEventListener("change", listener);
}

function getSnapshot(): boolean {
	if (
		typeof window === "undefined" ||
		typeof window.matchMedia !== "function"
	) {
		return false;
	}
	return window.matchMedia(QUERY).matches;
}

const getServerSnapshot = (): boolean => false;

/** `true` only below the 640px tier boundary, where the desktop tree is hidden. */
export function useIsPhoneTier(): boolean {
	return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
