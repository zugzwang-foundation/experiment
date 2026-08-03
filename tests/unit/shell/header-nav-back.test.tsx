// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const nav = vi.hoisted(() => ({ pathname: "/" }));

vi.mock("next/navigation", () => ({
	usePathname: () => nav.pathname,
	useRouter: () => ({ back: () => {}, push: () => {} }),
}));

import { HeaderNav } from "@/components/shell/HeaderNav";

/**
 * POLISH-1a V5 — Back is DISABLED at the root route.
 *
 * The shipped A1 predicate is history-depth ONLY (`window.history.length > 1`),
 * and `HeaderNav.tsx` already names the hole in its own doc comment: "the
 * heuristic counts cross-origin entries too, so an enabled Back can exit the
 * app: accepted-known at A1". At `/` that is not a corner case — `/` is where
 * the app STARTS, so every entry below it in the stack is cross-origin by
 * definition. A viewer who lands on `/`, opens a market, and comes home finds
 * an enabled Back whose only destination is off-site.
 *
 * The fix is a pathname term, not a replacement: the history probe stays
 * mount-only and unchanged, and `/` is gated at render. Cell 1 is the RED —
 * it is the ONLY cell today's predicate fails, and cells 2 and 3 exist so the
 * fix cannot pass by simply disabling Back everywhere.
 *
 * NO `jest-dom` IN THIS REPO — `toBeDisabled()` is unavailable; the assertions
 * below are the plain `HTMLButtonElement.disabled` property and the DOM
 * attribute (AGENTS.md §9).
 */

afterEach(cleanup);

/** `history.length` is a prototype accessor in jsdom — redefine, don't assign. */
function setHistoryLength(length: number): void {
	Object.defineProperty(window.history, "length", {
		configurable: true,
		get: () => length,
	});
}

function backButton(container: HTMLElement): HTMLButtonElement {
	const el = container.querySelector('[aria-label="Back"]');
	if (!(el instanceof HTMLButtonElement)) {
		throw new Error("Back control is not a <button>");
	}
	return el;
}

describe("POLISH-1a V5 — Back disabled at the root route", () => {
	it("disables-back-at-root-even-with-in-app-history", () => {
		// THE RED CELL. Today's predicate sees `history.length > 1` and renders
		// Back ENABLED at `/`, where its only destination is off-site.
		nav.pathname = "/";
		setHistoryLength(5);

		const back = backButton(render(<HeaderNav />).container);
		expect(back.disabled).toBe(true);
		expect(back.getAttribute("aria-disabled")).toBe("true");
	});

	it("keeps-back-enabled-off-root-with-history", () => {
		// The half that stops the fix from being "disable Back everywhere".
		//
		// SCOPE — history is stubbed BEFORE mount, so this is the deep-link /
		// reload case only. Soft navigation from `/` to here is a DIFFERENT path
		// with its own cell below (`re-probes-history-on-soft-navigation-…`); the
		// two together are what make V5's stated behaviour true everywhere rather
		// than only on a fresh load.
		nav.pathname = "/m/some-market";
		setHistoryLength(5);

		const back = backButton(render(<HeaderNav />).container);
		expect(back.disabled).toBe(false);
		expect(back.getAttribute("aria-disabled")).toBe("false");
	});

	it("keeps-back-disabled-off-root-without-history", () => {
		// The shipped A1 behaviour is PRESERVED, not replaced: a deep-linked
		// fresh tab still has nowhere to go back to.
		nav.pathname = "/m/some-market";
		setHistoryLength(1);

		expect(backButton(render(<HeaderNav />).container).disabled).toBe(true);
	});

	it("re-probes-history-on-soft-navigation-away-from-root", () => {
		// GATE C — the cell that fails against a mount-only probe.
		//
		// `HeaderNav` lives in `(public)/layout.tsx`, which SURVIVES soft
		// navigation, so a `[]`-dep probe freezes `hasHistory` for the whole
		// session. A viewer who arrives DIRECTLY at `/` — typed URL or bookmark,
		// which is the operator's staging-test path and the Devcon demo path —
		// starts at `history.length === 1`, and Back then stays dead on every
		// subsequent route however deep the stack gets. That makes V5's stated
		// behaviour ("Back is disabled at `/`, enabled elsewhere with history")
		// false in a common case.
		//
		// `rerender` is load-bearing: it re-renders the SAME mounted instance,
		// which is precisely what soft nav does. A second `render(...)` would
		// remount, re-run the effect, and hide the bug entirely.
		nav.pathname = "/";
		setHistoryLength(1);
		const view = render(<HeaderNav />);
		expect(backButton(view.container).disabled).toBe(true);

		// Soft-navigate: same instance, new pathname, one entry deeper.
		nav.pathname = "/m/some-market";
		setHistoryLength(2);
		view.rerender(<HeaderNav />);

		const back = backButton(view.container);
		expect(back.disabled).toBe(false);
		expect(back.getAttribute("aria-disabled")).toBe("false");
	});
});
