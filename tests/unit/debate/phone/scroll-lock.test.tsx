// @vitest-environment jsdom
/**
 * MOBILE-2d · D-5 — `lockPageScroll()` AS A BEHAVIOUR, NOT AS A STRING.
 *
 * ⛔⛔ WHY THIS FILE EXISTS AT ALL. The only thing holding this module today is
 * `phone-scroll-model.test.ts`'s textual row, which asserts three substrings:
 * that the source contains `scrollTop`, that it matches `/\.scrollTop = c\.top/`,
 * and that it contains `body.style.overflow = "hidden"`. Measured by mutation:
 * deleting the CONTAINER overflow restore, deleting the BODY overflow restore,
 * and capturing the scroll position AFTER hiding the overflow instead of before
 * are all three GREEN under the whole of `tests/unit/design/` (26 files, 203
 * tests). A module whose restore half is unguarded is a lock with no key.
 *
 * ⚠ jsdom PERFORMS NO LAYOUT, SO THE OVERFLOW IS SUPPLIED RATHER THAN PROVOKED.
 * `liveScrollContainers()` selects on `scrollHeight > clientHeight + 1`, and
 * jsdom answers `0 > 1` for every element on the page — so a naive test here
 * captures an EMPTY container list and every assertion about restoring one
 * passes vacuously. Each container below therefore declares its own
 * `scrollHeight`/`clientHeight`, and the lock assertion is made BEFORE the
 * restore assertion in every case, so "the module did nothing" can never read as
 * "the module restored correctly". `leaves-a-box-that-does-not-overflow-alone`
 * is the control on the other side: the selector is a filter, not a catch-all.
 */
import { cleanup, render } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { lockPageScroll } from "@/components/debate/scroll-lock";

/**
 * ⛔ THE CLASS-DRIVEN CASE IS THE ONE THAT MATTERS AND IT NEEDS A REAL CASCADE.
 * The phone scroll region's `overflow-y: auto` comes from a CLASS, so its inline
 * `overflowY` is `""` and a correct restore has to put an empty string back —
 * an inline `hidden` left behind outranks the class forever and the feed never
 * scrolls again. Modelling that by leaving the inline empty is not enough:
 * `liveScrollContainers()` reads `getComputedStyle`, which would answer
 * `visible` and skip the element, and the test would pass against a container
 * the module never saw. jsdom does cascade a `<style>` rule into
 * `getComputedStyle().overflowY` (measured), so the stylesheet is the honest way
 * to get a box that computes `auto` with nothing inline.
 */
const SHEET_CLASS = "probe-live-scroller";

function styleSheet() {
	const s = document.createElement("style");
	s.textContent = `.${SHEET_CLASS} { overflow-y: auto; }`;
	document.head.appendChild(s);
}

/**
 * A box the module will recognise as a live scroll container.
 *
 * ⚠ `clampOnHide` MODELS THE ENGINE BEHAVIOUR THE CAPTURE ORDER EXISTS TO
 * SURVIVE, and it is the only way that ordering is observable here. Setting
 * `overflow: hidden` on a scrolled box clamps its `scrollTop` in a real engine;
 * jsdom keeps the number, so a module that captured the position AFTER hiding
 * would read the right answer by accident and the guard would certify an order
 * it never exercised.
 */
function scroller({
	top = 0,
	inlineOverflow = "",
	fromClass = false,
	overflows = true,
	clampOnHide = false,
}: {
	top?: number;
	inlineOverflow?: string;
	fromClass?: boolean;
	overflows?: boolean;
	clampOnHide?: boolean;
} = {}): HTMLElement {
	const el = document.createElement("div");
	if (fromClass) {
		el.className = SHEET_CLASS;
	}
	if (inlineOverflow !== "") {
		el.style.overflowY = inlineOverflow;
	}
	// ⛔ MOUNTED INSIDE THE TIER ROOT, because the module scopes its walk there.
	// A scroller appended to `document.body` is invisible to it — and a fixture
	// the module never sees passes every restore assertion, which is the vacuous
	// pass this whole file is written against. `tierRoot()` is asserted present.
	tierRoot().appendChild(el);
	Object.defineProperty(el, "scrollHeight", {
		value: overflows ? 2000 : 700,
		configurable: true,
	});
	Object.defineProperty(el, "clientHeight", { value: 700, configurable: true });
	let stored = top;
	Object.defineProperty(el, "scrollTop", {
		configurable: true,
		get() {
			return clampOnHide && el.style.overflowY === "hidden" ? 0 : stored;
		},
		set(v: number) {
			stored = v;
		},
	});
	return el;
}

/**
 * ⛔ THE TIER ROOT, BECAUSE THE MODULE IS SCOPED TO IT. `lockPageScroll` walks
 * `[data-testid="phone-debate-view"]` and nothing else — that scoping is what
 * keeps the desktop path reduced to the body lock it always was (the phone tier
 * is `display: none` above 640px, so it contributes no containers there).
 * A fixture outside it is not a fixture.
 */
function tierRoot(): HTMLElement {
	const found = document.querySelector<HTMLElement>(
		'[data-testid="phone-debate-view"]',
	);
	if (found === null) {
		throw new Error(
			"no tier root — the scroller would be invisible to the lock",
		);
	}
	return found;
}

beforeEach(() => {
	document.head.innerHTML = "";
	document.body.innerHTML = "";
	document.body.style.overflow = "";
	const tier = document.createElement("div");
	tier.setAttribute("data-testid", "phone-debate-view");
	document.body.appendChild(tier);
	styleSheet();
});
afterEach(() => {
	cleanup();
	/**
	 * ⛔ THE REFCOUNT IS MODULE STATE AND SURVIVES A TEST — SO THE LEAK IS
	 * DETECTED RATHER THAN DRAINED. A test that throws mid-lock would leave
	 * `depth > 0`, and every later test's lock would be a silent no-op that
	 * passes every restore assertion on a module that did nothing. There is no
	 * way to drain it from outside (a lock/release pair is net zero), and adding
	 * a reset export would be production API written for a test. So the leak is
	 * asserted instead: after `cleanup()` nothing is holding a lock, so a lock
	 * taken here must be the FIRST one and must therefore apply.
	 */
	const probe = lockPageScroll();
	const applied = document.body.style.overflow;
	probe();
	document.body.style.overflow = "";
	if (applied !== "hidden") {
		throw new Error(
			"a lock leaked out of the previous test — the refcount is still held, " +
				"and every later assertion in this file would be measuring nothing",
		);
	}
});

describe("phone scroll lock — the restore is the whole contract", () => {
	/**
	 * ⛔ THE BODY'S PREVIOUS VALUE, NOT THE EMPTY STRING. This module is called
	 * from `MarketPriceChartOverlay`, which is NOT phone-only — at ≥640px
	 * `document.body` IS the scroller. A restore that hard-codes `""` discards
	 * whatever the page had set; a restore that never runs leaves the whole
	 * document unscrollable for the rest of the session, with no error anywhere.
	 */
	it("scroll-lock::restores-the-bodys-previous-overflow", () => {
		document.body.style.overflow = "scroll";
		const unlock = lockPageScroll();
		expect(
			document.body.style.overflow,
			"the lock must actually take — a no-op passes every restore assertion",
		).toBe("hidden");
		unlock();
		expect(
			document.body.style.overflow,
			"the body is restored to what it had, not to the empty string",
		).toBe("scroll");
	});

	it("scroll-lock::restores-an-untouched-body-to-no-inline-overflow", () => {
		const unlock = lockPageScroll();
		expect(document.body.style.overflow).toBe("hidden");
		unlock();
		expect(document.body.style.overflow).toBe("");
	});

	/**
	 * ⛔ THE CONTAINER'S OVERFLOW, WHICH NOTHING GUARDS TODAY. Deleting that one
	 * line is GREEN under the whole design suite, and what it leaves behind is an
	 * inline `overflow-y: hidden` on the phone scroll region — which outranks the
	 * class that made the box a scroller, permanently, after the first sheet the
	 * reader opens.
	 */
	it("scroll-lock::restores-each-containers-previous-overflow", () => {
		const byClass = scroller({ fromClass: true });
		const byInline = scroller({ inlineOverflow: "auto" });
		const unlock = lockPageScroll();
		expect(
			[byClass.style.overflowY, byInline.style.overflowY],
			"both containers must actually be locked, or the restore proves nothing",
		).toEqual(["hidden", "hidden"]);
		unlock();
		expect(
			[byClass.style.overflowY, byInline.style.overflowY],
			"each container returns to what it had — the class-driven one to NO " +
				"inline value at all, because an inline `hidden` beats the class",
		).toEqual(["", "auto"]);
	});

	/**
	 * ⚠ THIS ROW'S PREMISE CHANGED, AND THE CHANGE IS A RULING RATHER THAN A
	 * WEAKENING. It was written as *"the engine, or anything else, moves it while
	 * locked — the restore must win"*. `@security-auditor` then found that
	 * `PhoneDebateView`'s arm-change effect is one of those "anything else"s, and
	 * that an unconditional restore silently undoes it: the reader opens a post,
	 * opens a reply sheet, uses the back gesture, and lands at the top of the
	 * feed with their place lost.
	 * ⇒ The rule is now: restore what this lock is still holding, and leave what
	 * another owner has deliberately re-set. The two cases are separated —
	 * the ENGINE clamping on hide is covered by the `clampOnHide` row below, and
	 * a deliberate re-set by the row in the next describe.
	 */
	it("scroll-lock::restores-the-scroll-position", () => {
		const el = scroller({ fromClass: true, top: 412 });
		const unlock = lockPageScroll();
		expect(
			el.style.overflowY,
			"the lock must have taken, or the restore proves nothing",
		).toBe("hidden");
		unlock();
		expect(
			el.scrollTop,
			"a reader who loses their place in a long feed because they opened the " +
				"market details would never report it as a bug",
		).toBe(412);
	});

	/**
	 * ⛔ CAPTURED BEFORE THE HIDE. Reordering those two statements is a
	 * one-keystroke edit that reads as tidying, silently returns every reader to
	 * the top of the feed, and is GREEN under the whole design suite today.
	 */
	it("scroll-lock::captures-the-position-before-it-hides-the-overflow", () => {
		const el = scroller({ fromClass: true, top: 412, clampOnHide: true });
		const unlock = lockPageScroll();
		expect(
			el.scrollTop,
			"the clamp must be armed, or this test cannot tell the two orders apart",
		).toBe(0);
		unlock();
		expect(
			el.scrollTop,
			"the position must be read before the overflow is hidden — an engine " +
				"that clamps scrollTop on hide hands back 0 to a late reader",
		).toBe(412);
	});

	/** POSITIVE CONTROL — the selector is a filter, not a catch-all. */
	it("scroll-lock::leaves-a-box-that-does-not-overflow-alone", () => {
		const still = scroller({ overflows: false, inlineOverflow: "auto" });
		const unlock = lockPageScroll();
		expect(
			still.style.overflowY,
			"a box whose content fits is not a scroll container and must not be " +
				"touched — if this is `hidden`, the module is locking the whole page",
		).toBe("auto");
		unlock();
		expect(still.style.overflowY).toBe("auto");
	});
});

describe("phone scroll lock — it does not overrule the other owner of a position", () => {
	/**
	 * ⛔⛔ TWO WRITERS OWN `phone-scroll-region.scrollTop`, AND THIS MODULE USED
	 * TO ALWAYS WIN. `PhoneDebateView` moves it on an arm change — saving the
	 * feed's place, putting a post at its top, restoring the feed on the way
	 * back — from a LAYOUT effect. This module restores from a PASSIVE destroy,
	 * which always runs second, so an unconditional write silently undid the
	 * whole feature. One gesture reaches it: read a post, open a reply sheet, use
	 * the back gesture, land at the top of the feed. `@security-auditor` found
	 * it.
	 * ⇒ The restore is conditional on the value still being the one this lock
	 * left. These two rows are the condition, in both polarities.
	 */
	it("scroll-lock::restores-a-position-nobody-else-touched", () => {
		const el = scroller({ top: 300, fromClass: true });
		const unlock = lockPageScroll();
		expect(el.style.overflowY).toBe("hidden");
		unlock();
		expect(
			el.scrollTop,
			"nothing else moved it, so the captured position is the right answer",
		).toBe(300);
	});

	it("scroll-lock::leaves-a-position-another-owner-re-set-while-locked", () => {
		const el = scroller({ top: 300, fromClass: true });
		const unlock = lockPageScroll();
		// the arm-change layout effect, running while the lock is held
		el.scrollTop = 1200;
		unlock();
		expect(
			el.scrollTop,
			"someone else meant this value; the lock has no business overruling it",
		).toBe(1200);
	});

	it("scroll-lock::restores-across-an-engine-that-clamps-on-hide", () => {
		// POSITIVE CONTROL for the condition's own arithmetic: where hiding the
		// overflow clamps the position to 0, "what the lock left" is 0, not the
		// captured value — so the comparison must be against the read-back and not
		// against the capture, or this restore would be skipped every time.
		const el = scroller({ top: 300, fromClass: true, clampOnHide: true });
		const unlock = lockPageScroll();
		expect(el.scrollTop, "the clamp must be armed").toBe(0);
		unlock();
		expect(el.scrollTop).toBe(300);
	});
});

describe("phone scroll lock — the caller's own layer is never locked", () => {
	/**
	 * ⛔⛔ THE DEFECT THIS REJECTS SHIPPED, AND IT IS ON THE MONEY PATH.
	 * `PhoneSheet` calls the lock from its own effect, after the sheet has
	 * painted. Unscoped, the walk reaches the sheet's OWN body — which is
	 * `overflow-y-auto` and which overflows exactly when the reader needs it to
	 * scroll — and hides it. On the details sheet that puts the price chart and
	 * the export link below an unreachable fold; on the composer it puts
	 * `PLACE Đ BET` below the keyboard with no way down. Found by
	 * `@code-reviewer`.
	 *
	 * ⚠ AND THE BROWSER MEASUREMENT THAT SHOULD HAVE CAUGHT IT COULD NOT: a
	 * reachability probe that does `body.scrollTop = body.scrollHeight` succeeds
	 * on an `overflow: hidden` box, because programmatic scrolling is not what
	 * `hidden` forbids — only a finger is. So this is a unit-level rule on
	 * purpose: it is the layer where the question is answerable at all.
	 */
	it("scroll-lock::leaves-the-excepted-subtree-scrollable", () => {
		const outside = scroller({ top: 100, fromClass: true });
		const layer = document.createElement("div");
		tierRoot().appendChild(layer);
		const own = scroller({ top: 40, fromClass: true });
		layer.appendChild(own);

		const unlock = lockPageScroll(layer);
		expect(
			[outside.style.overflowY, own.style.overflowY],
			"everything outside the caller's layer is locked; nothing inside it is",
		).toEqual(["hidden", ""]);
		unlock();
		expect([outside.style.overflowY, own.style.overflowY]).toEqual(["", ""]);
	});

	it("scroll-lock::with-no-exception-it-locks-everything-in-the-tier", () => {
		// POSITIVE CONTROL for the row above — without the argument the same
		// element IS locked, so the exclusion is doing the work rather than the
		// element being unreachable for some other reason.
		const layer = document.createElement("div");
		tierRoot().appendChild(layer);
		const own = scroller({ top: 40, fromClass: true });
		layer.appendChild(own);
		const unlock = lockPageScroll();
		expect(own.style.overflowY).toBe("hidden");
		unlock();
	});

	it("scroll-lock::ignores-containers-outside-the-phone-tier", () => {
		/**
		 * ⛔ THE DESKTOP WALL, AS A UNIT RULE. `MarketPriceChartOverlay` uses this
		 * module at 1440 as well, where `DebateColumn`, `headzone-stack` and the
		 * composer's own scroller are all live containers. Locking them — and
		 * writing their `scrollTop` back on close, against the browser's scroll
		 * anchoring after a poll tick — is a desktop behaviour change. Scoping the
		 * walk to the phone tier, which is `display: none` above 640px, makes the
		 * desktop path reduce to exactly the body lock it replaced.
		 */
		const desktop = document.createElement("div");
		document.body.appendChild(desktop);
		const col = scroller({ top: 800, fromClass: true });
		desktop.appendChild(col);
		const unlock = lockPageScroll();
		expect(
			[document.body.style.overflow, col.style.overflowY, col.scrollTop],
			"the body is locked; a container outside the tier is untouched",
		).toEqual(["hidden", "", 800]);
		col.scrollTop = 900;
		unlock();
		expect(
			col.scrollTop,
			"and its position is not written back — scroll anchoring owns it",
		).toBe(900);
	});
});

describe("phone scroll lock — nesting, which is not a hypothetical", () => {
	/**
	 * ⚠ THE SHEET AND THE OVERLAY GENUINELY STACK. `MarketPriceChartOverlay`
	 * opens from inside the phone details sheet — `PhoneDetails.tsx:110` mounts
	 * `MarketPriceChartHost`, which mounts the overlay — so two locks are live at
	 * once whenever a reader expands the price chart. `scroll-lock.ts` claims to
	 * be "nest-safe by construction"; these two cases are what that claim means,
	 * and they differ only in the order the restores run.
	 */
	it("scroll-lock::nests-when-the-inner-lock-is-released-first", () => {
		document.body.style.overflow = "scroll";
		const el = scroller({ fromClass: true, top: 300 });
		const outer = lockPageScroll();
		const inner = lockPageScroll();
		inner();
		expect(
			[document.body.style.overflow, el.style.overflowY],
			"an inner release must NOT unlock the page the outer sheet is still over",
		).toEqual(["hidden", "hidden"]);
		outer();
		expect([
			document.body.style.overflow,
			el.style.overflowY,
			el.scrollTop,
		]).toEqual(["scroll", "", 300]);
	});

	/**
	 * ⛔⛔ AND WHEN THE OUTER LOCK IS RELEASED FIRST — WHICH IS WHAT REACT DOES
	 * TO A DELETED SUBTREE.
	 *
	 * Measured against this repository's React 19 (2026-09-13): for a subtree
	 * that is DELETED, the passive-effect destroy runs PARENT FIRST
	 * (`outer:unlock | inner:unlock`); for a parent that merely returns `null`
	 * and stays mounted, it is child-first and the case above is the one that
	 * applies. So the release order is not something a caller chooses — it is a
	 * property of HOW the sheet goes away, and both shapes are reachable.
	 *
	 * ⇒ A restore that puts back "whatever I found" is order-DEPENDENT: the
	 * outer puts back the original, and the inner then re-applies the `hidden`
	 * it captured from the outer. Every container is left locked, and the body
	 * with them — and the body is the one that OUTLIVES the deletion, so a reader
	 * who navigates away from a market page with the price chart open lands on a
	 * Discovery surface that will not scroll, for the rest of the session, with
	 * nothing logged.
	 */
	it("scroll-lock::nests-when-the-outer-lock-is-released-first", () => {
		document.body.style.overflow = "scroll";
		const el = scroller({ fromClass: true, top: 300 });
		const outer = lockPageScroll();
		const inner = lockPageScroll();
		outer();
		inner();
		expect(
			[document.body.style.overflow, el.style.overflowY],
			"the unwind must not depend on the order the restores happen to run in " +
				"— React destroys a DELETED subtree parent-first, so the sheet's " +
				"restore lands before the overlay's and the overlay then re-applies " +
				"the `hidden` it captured",
		).toEqual(["scroll", ""]);
	});
});

describe("phone scroll lock — the two ways a locked sheet goes away", () => {
	function Overlay() {
		useEffect(() => lockPageScroll(), []);
		return <div data-testid="overlay" />;
	}
	/**
	 * ⚠ THE OVERLAY OPENS **AFTER** THE SHEET, WHICH IS WHY `chart` IS A SECOND
	 * PROP RATHER THAN A CHILD MOUNTED WITH IT. React runs passive effects
	 * child-first, so mounting both in one commit would take the OVERLAY's lock
	 * first and the sheet's second — the reverse of the product, where the reader
	 * opens the details sheet and only then taps the price chart. A model with
	 * the lock order inverted passes the deletion case and fails the close case,
	 * i.e. exactly backwards, and looks like a finding either way.
	 */
	function Sheet({ open, chart }: { open: boolean; chart: boolean }) {
		useEffect(() => {
			if (!open) {
				return;
			}
			return lockPageScroll();
		}, [open]);
		if (!open) {
			return null;
		}
		return <div data-testid="sheet">{chart ? <Overlay /> : null}</div>;
	}

	/**
	 * POSITIVE CONTROL, AND IT IS LOAD-BEARING. This is `PhoneSheet`'s own
	 * `open -> false` path: the component stays mounted and returns `null`, React
	 * runs the deleted children's cleanups BEFORE the parent's dep-changed one,
	 * and the unwind is LIFO. If this case ever reds, the failure below is about
	 * the harness rather than about the order.
	 */
	it("scroll-lock::a-sheet-that-closes-in-place-unlocks", () => {
		const view = render(<Sheet open chart={false} />);
		view.rerender(<Sheet open chart />);
		expect(document.body.style.overflow).toBe("hidden");
		view.rerender(<Sheet open={false} chart />);
		expect(document.body.style.overflow).toBe("");
	});

	/**
	 * ⛔⛔ AND THE ONE THE PRODUCT ACTUALLY REACHES. `PhoneDebateView` renders
	 * the details sheet as `{detailsMounted ? <PhoneSheet …> : null}` and
	 * `detailsMounted` never goes back to false — so that sheet is deleted only
	 * when the whole tier unmounts, i.e. when the reader navigates away. That is
	 * a browser Back or an iOS left-edge swipe with the price chart open, on a
	 * surface whose entire idiom is swiping, and `document.body` survives the
	 * navigation onto whatever they land on.
	 */
	it("scroll-lock::a-sheet-deleted-with-its-overlay-still-open-unlocks", () => {
		const view = render(
			<div>
				<Sheet open chart={false} />
			</div>,
		);
		view.rerender(
			<div>
				<Sheet open chart />
			</div>,
		);
		expect(document.body.style.overflow).toBe("hidden");
		view.rerender(<div />);
		expect(
			document.body.style.overflow,
			"the tier was deleted with two locks live; the body must not be left " +
				"`hidden` on the surface the reader navigated TO",
		).toBe("");
	});
});
