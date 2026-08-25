// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { join } from "node:path";
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

	it("history-ladder::the-push-passes-a-NULL-state-and-writes-NO-custom-field", () => {
		// ⚠⚠ THIS ASSERTION IS INVERTED FROM WHAT IT WAS, AND THE OLD ONE CODIFIED
		// A REGRESSION. It read:
		//
		//   history.replaceState({ __NA: "next-router-bookkeeping" }, "", ROUTE);
		//   … expect(history.state?.__NA).toBe("next-router-bookkeeping");
		//   … expect(history.state?.zzPost).toBe(2);
		//
		// under the heading "Next router history state SURVIVES the push",
		// defending a `{...history.state, zzPost}` spread. Measured in the shipped
		// `next@16.2.4` (`client/components/app-router.js:252-263`), Next patches
		// `pushState` and SKIPS its own work when `data?.__NA` is truthy — and
		// `HistoryUpdater` stamps `__NA: true` on first paint. So the spread
		// guaranteed the skip, `applyUrlFromHistoryPushReplace` never ran, and the
		// router's `canonicalUrl` never learned about `?post=N`. The next
		// `router.refresh()` (every 15s, from `DebatePoll`) then `replaceState`d
		// the STALE url and the address bar silently dropped the param.
		// ⛔ The old assertion asserted precisely the condition that triggers the
		// skip. It was green, and it was pinning the bug.
		//
		// ⇒ Next copies its OWN bookkeeping for us
		// (`copyNextJsInternalHistoryState`, `:84-96`); the correct state argument
		// is `null`, which is what `origin/staging` always passed.
		// ⚠ `next/navigation` is mocked here, so Next's patch is NOT installed and
		// the raw state is observable — which is exactly what makes this
		// assertable at this layer.
		history.replaceState({ __NA: true }, "", ROUTE);
		render(view());
		const title = Array.from(document.querySelectorAll("h3")).find(
			(h) => h.textContent === P1_TITLE,
		);
		act(() => {
			fireEvent.click(title?.closest("button") as HTMLButtonElement);
		});
		// No spread: the previous entry's `__NA` must NOT have been carried over.
		expect(history.state).toBeNull();
	});

	it("history-ladder::the-rung-counter-is-NOT-kept-on-history-state", () => {
		// ⛔⛔ THE SECOND HALF OF THE SAME LESSON. A `zzPost` marker on the entry
		// cannot survive: `HistoryUpdater` rebuilds the state as
		// `{...(preserveCustomHistoryState ? history.state : {}), __NA, TREE}` and
		// every soft navigation sets that flag false
		// (`segment-cache/navigation.js:271,382`), so `router.refresh()` deletes
		// it ~15s after it is written. `exitPost` would then take the fallback
		// branch and ORPHAN the rung it pushed — `history.length` growing by one
		// per enter/exit cycle, and a dead Back step left behind.
		// ⇒ The counter lives in a component ref, which a refresh cannot touch.
		// This asserts the source does not reach for `history.state` again.
		const view = readFileSync(
			join(process.cwd(), "src/components/debate/DebateView.tsx"),
			"utf8",
		);
		// ⚠ ASSERTED AS THE POSITIVE CODE FORMS, NOT AS
		// `not.toContain("history.state")`. That bare negative went red against
		// this file's own comments, which necessarily QUOTE `history.state` to
		// explain why it is not used — the fourth time in this task that a
		// textual negative caught its own explanation. The forms below say the
		// same thing and cannot be tripped by prose.
		expect(view).toContain("history.pushState(null,");
		expect(view).toContain("pushedRungsRef.current > 0");
		expect(view).toContain("pushedRungsRef.current += 1");
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

	it("history-ladder::enter-exit-cycles-are-DEPTH-NEUTRAL-over-repetition", () => {
		// ⛔⛔ THE PROPERTY THE ORPHANED-RUNG DEFECT BROKE, asserted over MORE THAN
		// ONE CYCLE because one cycle cannot see it. When the rung marker lived on
		// `history.state`, a `router.refresh()` deleted it and the exit silently
		// took the fallback branch — leaving the pushed rung on the stack. Each
		// subsequent enter/exit then added one more, and browser Back from the
		// market arm landed on a dead duplicate that appeared to do nothing.
		// The plan's S2 contract is the sentence this pins: "a reader who enters
		// and leaves five posts ends with a stack the same depth they started
		// with."
		render(view());
		const back = vi.spyOn(history, "back").mockImplementation(() => undefined);
		const enter = () => {
			const t = Array.from(document.querySelectorAll("h3")).find(
				(h) => h.textContent === P1_TITLE,
			);
			act(() => {
				fireEvent.click(t?.closest("button") as HTMLButtonElement);
			});
		};
		const leave = () => {
			act(() => {
				fireEvent.click(
					document.querySelector(
						'[data-testid="focus-market-card"]',
					) as HTMLElement,
				);
			});
		};

		for (let i = 0; i < 3; i++) {
			enter();
			expect(onPostArm()).toBe(true);

			// ⛔⛔ THE SIMULATED POLL TICK, AND IT IS THE WHOLE POINT OF THIS TEST.
			// This is byte-for-byte what Next's `HistoryUpdater` writes on a soft
			// navigation — `{...(preserveCustomHistoryState ? state : {}), __NA,
			// TREE}` with the flag FALSE — i.e. exactly what `router.refresh()`
			// does to the current entry every 15s. Any rung marker kept on
			// `history.state` is DELETED right here. Without this line the test
			// passes against the defect, which is why the defect survived the
			// first version of this file.
			history.replaceState(
				{ __NA: true, __PRIVATE_NEXTJS_INTERNALS_TREE: {} },
				"",
				window.location.href,
			);

			// jsdom's `history.back()` is asynchronous, so the DECISION is what is
			// asserted (was `back()` chosen over the fallback?) rather than a raw
			// `history.length`, which would be measuring jsdom's task queue.
			leave();
			// ⛔ Every cycle must still choose to UNWIND. Under the superseded
			// `history.state.zzPost` marker this was true on cycle 1 and false
			// from cycle 2 on, orphaning a rung each time.
			expect(back).toHaveBeenCalledTimes(i + 1);

			popTo("");
			expect(onMarketArm()).toBe(true);
		}
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
