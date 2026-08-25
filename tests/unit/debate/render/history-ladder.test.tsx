// @vitest-environment jsdom

import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
	useRouter: () => ({
		push: () => undefined,
		refresh: () => undefined,
		replace: () => undefined,
		back: () => undefined,
		forward: () => undefined,
		prefetch: () => undefined,
	}),
	usePathname: () => "/m/mumbai-metro-line-3-1m-riders",
	useSearchParams: () => new URLSearchParams(),
}));

import { DebateView } from "@/components/debate/DebateView";

import { VIEWER } from "../../composer/render/_harness";
import { baseModel } from "./_posted-fixtures";

/**
 * RPLY-1 · R2 · G3 + G4 — THE HISTORY LADDER, AND THE POPSTATE TARGET.
 *
 * ⚠⚠ WHAT WAS WRONG. `syncPostParam` used `history.replaceState` from all three
 * call sites (`enterPost`, `replyToPost`, `exitPost`), so `history.length` never
 * grew on entering post-focus — and `HeaderNav`'s `canGoBack` reads
 * `usePathname()`, which excludes the query string. Header Back and browser Back
 * therefore both left `/m/[slug]` ALTOGETHER, and `FocusMarketCard` was the only
 * in-app way out of post focus.
 *
 * ⛔⛔ AND THE FIX OPENS A SECURITY SEAM THAT DID NOT EXIST BEFORE, WHICH IS
 * WHAT MOST OF THIS FILE IS ABOUT. Once Back can land on `?post=7`, something
 * has to turn that 7 into a post CLIENT-SIDE — the server's `resolvePostParam`
 * is `server-only` and needs a database. The obvious implementation indexes the
 * comment list with the raw param, and that reaches a REMOVED post, which the
 * cold arrival path (`page.tsx`) explicitly refuses to focus. That is a masking
 * bypass through the back button.
 *
 * ⚠⚠ THE FIXTURE IS WHAT MAKES "RESOLVED, NOT INDEXED" FALSIFIABLE, and it is
 * load-bearing rather than incidental. In `mumbai-metro.input` the ordinals are
 * deliberately NOT in array order: `posts[0]` is `cmt-p1` at ordinal **2**,
 * while ordinal **1** is `cmt-p3`, third in the array. So `?post=1` distinguishes
 * the two implementations outright — a resolver focuses `cmt-p3`, an indexer
 * focuses `cmt-p1`. A fixture whose ordinals matched its indices would have made
 * both look identical and this whole file vacuous.
 *
 * ⚠ `cmt-p4` (ordinal 4) is the fixture's REMOVED post — the masked target.
 *
 * No jest-dom in this repo (AGENTS.md §9) — plain DOM assertions only.
 */

const ROUTE = "/m/mumbai-metro-line-3-1m-riders";

/** The market arm renders the two `slot-header-*` fieldsets; the post arm does not. */
function onMarketArm(): boolean {
	return document.querySelector('[data-testid="slot-header-YES"]') !== null;
}
/** The post arm renders the focused post's foot; the market arm does not. */
function onPostArm(): boolean {
	return document.querySelector('[data-testid="post-focus-foot"]') !== null;
}
/** The focused post's title, or null on the market arm. */
function focusedTitle(): string | null {
	if (!onPostArm()) {
		return null;
	}
	return document.body.textContent ?? null;
}

const P1_TITLE = "The corridor is built for this volume";
const P3_TITLE = "The monsoon case alone gets you most of the way";

function view(initialPostId: string | null = null) {
	return (
		<DebateView
			model={baseModel()}
			viewer={VIEWER}
			initialPostId={initialPostId}
			ownPseudonym={null}
		/>
	);
}

/**
 * Put the browser on a given URL and fire the pop, WITHOUT going through the
 * component's own writers.
 *
 * ⛔ THIS IS THE POINT: it models a genuinely externally-driven history entry —
 * the browser's back button landing on a URL the component did not choose — so
 * the listener is exercised against a param it has to distrust. Driving it
 * through `enterPost` instead would only ever feed it ordinals the component
 * had just written, which is the one case that cannot be wrong.
 */
function popTo(search: string) {
	act(() => {
		history.replaceState({ ...history.state }, "", `${ROUTE}${search}`);
		window.dispatchEvent(new PopStateEvent("popstate"));
	});
}

beforeEach(() => {
	vi.useFakeTimers();
	window.scrollTo = () => undefined;
	Object.defineProperty(document, "hidden", {
		configurable: true,
		get: () => false,
	});
	history.replaceState(null, "", ROUTE);
});

afterEach(() => {
	cleanup();
	vi.useRealTimers();
	vi.restoreAllMocks();
	Reflect.deleteProperty(document, "hidden");
	history.replaceState(null, "", "/");
});

describe("R2 · G3 — entering post-focus is a rung on the stack", () => {
	it("history-ladder::entering-a-post-GROWS-the-history-stack", () => {
		render(view());
		expect(onMarketArm()).toBe(true);

		const before = history.length;
		// The card title is the control that enters post-focus (row 23).
		const title = Array.from(document.querySelectorAll("h3")).find(
			(h) => h.textContent === P1_TITLE,
		);
		expect(title).toBeDefined();
		act(() => {
			fireEvent.click(title?.closest("button") as HTMLButtonElement);
		});

		// ⛔ THE ASSERTION THIS FILE EXISTS FOR. Under `replaceState` this is 0.
		expect(history.length).toBe(before + 1);
		expect(onPostArm()).toBe(true);
		// …and the rung carries the ordinal, so the URL is still user-mintable.
		expect(new URL(window.location.href).searchParams.get("post")).toBe("2");
	});

	it("history-ladder::the-pushed-rung-is-MARKED-so-exit-knows-it-is-ours", () => {
		render(view());
		const title = Array.from(document.querySelectorAll("h3")).find(
			(h) => h.textContent === P1_TITLE,
		);
		act(() => {
			fireEvent.click(title?.closest("button") as HTMLButtonElement);
		});
		// `zzPost` is what tells `exitPost` the top of the stack is poppable. A
		// deep-link arrival has no such marker — see the deep-link case below.
		expect(history.state?.zzPost).toBe(2);
	});

	it("history-ladder::Next-router-history-state-SURVIVES-the-push", () => {
		// ⛔⛔ NOT COSMETIC. Next's App Router keeps bookkeeping on `history.state`
		// and reads it back on `popstate`; a bare `pushState({zzPost})` would strip
		// it, and the router meeting an entry it does not recognise resolves that
		// with a HARD NAVIGATION — a full reload in the middle of a back button.
		// The spread is what prevents it, so it is asserted rather than trusted.
		history.replaceState({ __NA: "next-router-bookkeeping" }, "", ROUTE);
		render(view());
		const title = Array.from(document.querySelectorAll("h3")).find(
			(h) => h.textContent === P1_TITLE,
		);
		act(() => {
			fireEvent.click(title?.closest("button") as HTMLButtonElement);
		});
		expect(history.state?.__NA).toBe("next-router-bookkeeping");
		expect(history.state?.zzPost).toBe(2);
	});

	it("history-ladder::leaving-UNWINDS-the-rung-instead-of-pushing-a-third", () => {
		render(view());
		const title = Array.from(document.querySelectorAll("h3")).find(
			(h) => h.textContent === P1_TITLE,
		);
		act(() => {
			fireEvent.click(title?.closest("button") as HTMLButtonElement);
		});
		const afterEnter = history.length;

		const back = vi.spyOn(history, "back").mockImplementation(() => undefined);
		act(() => {
			fireEvent.click(
				document.querySelector(
					'[data-testid="focus-market-card"]',
				) as HTMLElement,
			);
		});

		// ⛔ `history.back()`, NOT a third `pushState` and NOT `replaceState(null)`.
		// This is what makes enter-then-leave depth-NEUTRAL: a reader who opens and
		// closes five posts ends where they started.
		expect(back).toHaveBeenCalledTimes(1);
		expect(history.length).toBe(afterEnter);
	});

	it("history-ladder::a-DEEP-LINK-arrival-exits-WITHOUT-calling-back", () => {
		// ⛔⛔ THE MIRROR-IMAGE BUG, AND THE REASON THE EXIT IS CONDITIONAL. A reader
		// who pasted `?post=2` has NO rung of ours beneath them — the entry below is
		// another site, or nothing. An unconditional `history.back()` would take
		// them OFF `/m/[slug]` entirely, which is precisely the defect R2 removes.
		history.replaceState(null, "", `${ROUTE}?post=2`);
		render(view("cmt-p1"));
		expect(onPostArm()).toBe(true);

		const back = vi.spyOn(history, "back").mockImplementation(() => undefined);
		act(() => {
			fireEvent.click(
				document.querySelector(
					'[data-testid="focus-market-card"]',
				) as HTMLElement,
			);
		});

		expect(back).not.toHaveBeenCalled();
		// It still leaves post-focus — by the old `replaceState` path — so the
		// reader lands on the market arm of the page they deep-linked into.
		expect(onMarketArm()).toBe(true);
		expect(new URL(window.location.href).searchParams.get("post")).toBeNull();
	});

	it("history-ladder::a-pop-back-to-the-market-URL-RE-RENDERS-the-market-arm", () => {
		render(view());
		const title = Array.from(document.querySelectorAll("h3")).find(
			(h) => h.textContent === P1_TITLE,
		);
		act(() => {
			fireEvent.click(title?.closest("button") as HTMLButtonElement);
		});
		expect(onPostArm()).toBe(true);

		// ⛔ Pushing a rung is only half a ladder: without the inbound listener the
		// URL would move and the surface would not.
		popTo("");
		expect(onMarketArm()).toBe(true);
		expect(onPostArm()).toBe(false);
	});
});

describe("R2 · G4 — the popstate target is RESOLVED, never indexed", () => {
	it("history-ladder::THE-FIXTURE-ITSELF-must-keep-ordinals-OUT-of-index-order", () => {
		// ⛔⛔ THE ASSERTION THIS WHOLE DESCRIBE BLOCK DEPENDS ON, AND IT WAS
		// MISSING. Every test below distinguishes "resolved by ordinal" from
		// "indexed by the raw param" ONLY because the fixture's ordinals do not
		// match its array positions. Renumber the fixture so they do — a
		// completely reasonable-looking tidy, which the fixture's own comment
		// even invites by explaining the ordinals as date-derived — and the
		// discrimination vanishes SILENTLY: measured by @test-writer, the
		// renumber reds four tests, all four have obvious one-line repairs, and
		// after those repairs a naive indexer passes all nineteen.
		// ⇒ So the property is pinned here, where the red says what it means.
		const offBy = baseModel().posts.filter(
			(p, i) => p.ordinal !== i + 1,
		).length;
		expect(
			offBy,
			"G4 is VACUOUS if every post's ordinal equals its array index + 1: a " +
				"resolver and an indexer then return the same row for every input. " +
				"Do not 'fix' this by renumbering the fixture — restore an ordinal " +
				"that differs from its position.",
		).toBeGreaterThan(0);
	});

	it("history-ladder::POSITIVE-CONTROL-a-valid-ordinal-focuses-THE-ORDINAL-not-the-index", () => {
		// ⛔⛔ THE CONTROL WITHOUT WHICH EVERY REFUSAL BELOW IS VACUOUS. A listener
		// that did nothing at all would pass all four refusal cases. This is the one
		// that proves the mechanism fires — and it discriminates at the same time:
		// ordinal 1 is `cmt-p3` (array index 2), while `posts[0]` is `cmt-p1`. An
		// indexer lands on the wrong post; a resolver lands on this one.
		render(view());
		popTo("?post=1");

		expect(onPostArm()).toBe(true);
		expect(focusedTitle()).toContain(P3_TITLE);
		expect(focusedTitle()).not.toContain(P1_TITLE);
	});

	it("history-ladder::a-REMOVED-target-falls-back-to-the-market-arm", () => {
		// ⛔⛔ THE MASKING REFUSAL. `cmt-p4` is ordinal 4 and removed; `page.tsx`
		// refuses to focus it on a cold arrival (`if (target && !target.removed)`),
		// so a back-navigation that focused it would reach a state the server
		// declines to serve.
		render(view());
		// Non-vacuity: prove the surface CAN be moved to the post arm first, so a
		// listener that simply never fires cannot pass this by standing still.
		popTo("?post=1");
		expect(onPostArm()).toBe(true);

		popTo("?post=4");
		expect(onMarketArm()).toBe(true);
		expect(onPostArm()).toBe(false);
	});

	it("history-ladder::an-OUT-OF-RANGE-ordinal-falls-back-to-the-market-arm", () => {
		render(view());
		popTo("?post=1");
		expect(onPostArm()).toBe(true);

		popTo("?post=99999");
		expect(onMarketArm()).toBe(true);
	});

	for (const bad of ["0", "01", "abc", "", "-1", "1.5", "999999", "1%20"]) {
		it(`history-ladder::a-MALFORMED-param-${JSON.stringify(bad)}-falls-back-to-the-market-arm`, () => {
			// The shape gate is `^[1-9][0-9]{0,4}$`, byte-identical to the server's:
			// 1-based, no leading zero, at most 5 digits.
			render(view());
			popTo("?post=1");
			expect(onPostArm()).toBe(true);

			popTo(`?post=${bad}`);
			expect(onMarketArm()).toBe(true);
		});
	}

	it("history-ladder::a-REPEATED-param-falls-back-exactly-as-the-server-does", () => {
		// ⛔ Next hands the page `string | string[]` and `page.tsx` refuses anything
		// that is not a `string`, so `?post=1&post=2` renders the market view on a
		// cold load. `URLSearchParams.get` would return "1" and focus it — the same
		// URL behaving differently on a back-navigation than on a fresh one.
		render(view());
		popTo("?post=1");
		expect(onPostArm()).toBe(true);

		popTo("?post=1&post=2");
		expect(onMarketArm()).toBe(true);
	});

	it("history-ladder::an-ABSENT-param-falls-back-to-the-market-arm", () => {
		render(view("cmt-p1"));
		expect(onPostArm()).toBe(true);
		popTo("");
		expect(onMarketArm()).toBe(true);
	});
});
