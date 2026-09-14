// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PhoneDebateView } from "@/components/debate/phone/PhoneDebateView";
import { PhoneTopPill } from "@/components/debate/phone/PhoneTopPill";

import { modelWith, post, stubElementScroll, VIEWER } from "./_fixtures";

/**
 * MOBILE-2k · F-1 — WHEN THE TOP PILL IS ON SCREEN, AND HOW BIG IT IS.
 *
 * Plan §3 rows G1 (absent at load), G2 (absent while the lock is held), G12
 * (the feed arm and not the thread arm) and G10 (44px, derived from the pill's
 * own tokens rather than restated).
 *
 * ⚠ WHAT THIS FILE CANNOT SEE. jsdom performs no layout: no media query, no
 * `position: absolute`, no pseudo-element, no computed border. So "12px under
 * the tabs", "44px of hit area" and "above the feed, below the sheet" are
 * BROWSER measurements. What is testable here is (a) whether the control is in
 * the DOM at all, (b) which tokens reach it, and (c) which element it is a
 * child of — and (c) is the one that carries the z-order, because the pill
 * declares no `z-*` of its own and inherits its parent's stacking context.
 *
 * ⛔⛔ EVERY ABSENCE ROW CARRIES ITS OWN PRESENCE CONTROL, and that is the
 * load-bearing half. "No pill in the DOM" is satisfied perfectly by a build
 * where the scroll listener was never armed, by a fixture whose region has no
 * height, and by a component that returns `null` unconditionally — three ways
 * to be green against a pill that can never appear. So each row that asserts
 * the pill is ABSENT first drives the gesture that makes it APPEAR.
 */
const ROOT = process.cwd();
const CSS = "src/app/globals.css";

/**
 * The tap target is 36px painted plus 4px above and below, expressed in
 * Tailwind's spacing scale (`h-9`, `after:-top-1`, `after:-bottom-1`). ONE
 * `--spacing` step is 0.25rem = 4px — Tailwind v4's default, which holds only
 * while nothing redefines it, so the row below checks that first.
 */
const SPACING_PX = 4;
const MIN_TAP_PX = 44;

const refresh = vi.fn();
vi.mock("next/navigation", () => ({
	useRouter: () => ({ push: vi.fn(), refresh }),
	// ⚠ NOT SPARE — a factory mock REPLACES the module, and the phone bar's tree
	// reaches `DownloadPostImage`, which reads the slug off the route. Returning
	// the fixture's own slug keeps that control on its real branch rather than
	// its no-slug placeholder (`arm-reset-interlock.test.tsx`'s note).
	useParams: () => ({ slug: "bitcoin-price-50k" }),
}));

stubElementScroll();

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
	vi.clearAllMocks();
});

/**
 * A region whose scroll position and viewport height are ours to set.
 *
 * ⛔ jsdom HAS NO LAYOUT, so `clientHeight` is 0 and the `scrollTop` setter is a
 * no-op — which would make the visibility rule read `viewport = 0` and compare
 * every position against zero. Both are defined as own properties here so the
 * thresholds under test (`> 1 × viewport`, `< 0.5 × viewport`) are exercised
 * against a real viewport instead of collapsing.
 */
function controllable(node: HTMLElement, viewport = 800): HTMLElement {
	let top = 0;
	Object.defineProperty(node, "scrollTop", {
		configurable: true,
		get: () => top,
		set: (value: number) => {
			top = value;
		},
	});
	Object.defineProperty(node, "clientHeight", {
		configurable: true,
		get: () => viewport,
	});
	return node;
}

function detachedRegion(): HTMLDivElement {
	const node = document.createElement("div");
	controllable(node);
	document.body.appendChild(node);
	return node as HTMLDivElement;
}

const pill = () =>
	document.querySelector<HTMLButtonElement>('[data-testid="phone-top-pill"]');

const tokensOf = (el: Element | null) =>
	(el?.getAttribute("class") ?? "").split(/\s+/).filter(Boolean);

/**
 * The gesture that shows the pill: deep in the feed, then moving UP.
 *
 * ⚠ TWO EVENTS, NOT ONE, AND THE FIRST IS NOT DECORATION. The rule shows the
 * pill on upward movement, which is a comparison against the PREVIOUS position
 * — so a single event can never produce one. The first event establishes where
 * the reader was; the second is the one that moves.
 */
function scrollTo(region: HTMLElement, top: number): void {
	act(() => {
		region.scrollTop = top;
		region.dispatchEvent(new Event("scroll"));
	});
}

function driveShow(region: HTMLElement): void {
	scrollTo(region, 2000);
	scrollTo(region, 1500);
}

const POSTS = [
	post({ id: "p1", ordinal: 1, side: "YES" }),
	post({ id: "p2", ordinal: 2, side: "NO" }),
];

function view(initialPostId: string | null) {
	return (
		<PhoneDebateView
			model={modelWith(POSTS)}
			viewer={VIEWER}
			initialPostId={initialPostId}
			ownPseudonym={null}
			details={null}
		/>
	);
}

/** Mount the whole tier and hand back its one vertical scroller. */
function mountTier(initialPostId: string | null) {
	const rendered = render(view(initialPostId));
	const region = rendered.container.querySelector<HTMLElement>(
		'[data-testid="phone-scroll-region"]',
	);
	if (region === null) {
		throw new Error(
			"no `phone-scroll-region` in the phone tier — the pill's input is that " +
				"element's scroll, so this harness is measuring nothing",
		);
	}
	controllable(region);
	return { ...rendered, region };
}

describe("MOBILE-2k · F-1 — the pill is absent until the reader is deep and rising", () => {
	/**
	 * G1 — the pill is not part of the page's furniture. A reader who has just
	 * arrived is at the top: there is nothing to go back to and nothing stale to
	 * refresh, so the control has nothing to offer and must not be on screen.
	 */
	it("phone-top-pill::absent-at-load", () => {
		const { region } = mountTier(null);
		expect(
			pill(),
			"the pill is on screen at scroll 0 — the reader is already at the top, " +
				"so it is offering a journey of zero pixels and a refresh of a page " +
				"that has just been fetched",
		).toBeNull();

		// THE CONTROL, and without it this row is green against a pill that can
		// never appear at all.
		driveShow(region);
		expect(
			pill(),
			"the show gesture (deep in the feed, then moving up) produced no pill — " +
				"so the absence above is a fact about the harness, not the rule",
		).not.toBeNull();
	});

	/**
	 * G2 — a sheet is up, so the pill is GONE rather than merely invisible. A
	 * control that is only painted away is still a tab stop behind a modal,
	 * which is the half of a hidden control keyboard users actually hit.
	 */
	it("phone-top-pill::absent-while-a-sheet-holds-the-lock", () => {
		const { container, region } = mountTier(null);
		driveShow(region);
		expect(pill(), "precondition: the pill is on screen").not.toBeNull();

		const bar = container.querySelector('[data-testid="phone-bottom-bar"]');
		const entry = bar?.querySelector("button");
		if (!entry) {
			throw new Error("no entry control on the bottom bar");
		}
		fireEvent.click(entry);
		expect(
			document.querySelector('[data-testid="phone-sheet"]'),
			"precondition: the composer sheet opened",
		).not.toBeNull();
		expect(
			pill(),
			"a sheet is up and the pill is still in the DOM — behind a " +
				"full-viewport layer, where nobody can see it and a Tab can still " +
				"reach it",
		).toBeNull();
	});

	/**
	 * ⚠ THE SAME RULE AT THE PROP, which is a different claim from the row above.
	 * That one proves the HOST wires the lock; this one proves the pill obeys the
	 * prop and — the part a one-way test cannot see — that it comes BACK. A
	 * component that latched itself off on the first lock would satisfy the
	 * absence above forever.
	 */
	it("phone-top-pill::the-lock-hides-it-and-unlocking-brings-it-back", () => {
		const region = detachedRegion();
		const ref = { current: region };
		const { rerender } = render(
			<PhoneTopPill regionRef={ref} locked={false} busy={false} />,
		);
		driveShow(region);
		expect(pill()).not.toBeNull();

		rerender(<PhoneTopPill regionRef={ref} locked={true} busy={false} />);
		expect(pill(), "`locked` must remove the control outright").toBeNull();

		rerender(<PhoneTopPill regionRef={ref} locked={false} busy={false} />);
		expect(
			pill(),
			"the pill did not return when the sheet closed — the reader is still " +
				"deep in the feed, so the reason it was hidden is gone and the reason " +
				"it was shown is not",
		).not.toBeNull();
	});

	/**
	 * G12 — the gate is the MOUNT. A thread is short and was navigated INTO, so a
	 * refetch there would refresh a screen the reader chose; the feed is the one
	 * place the bounded shell took pull-to-refresh away from.
	 */
	it("phone-top-pill::mounts-on-the-feed-arm-and-not-on-the-thread-arm", () => {
		const thread = mountTier("p1");
		expect(
			thread.container
				.querySelector('[data-testid="phone-debate-view"]')
				?.getAttribute("data-arm"),
			"precondition: this is the thread arm",
		).toBe("thread");
		driveShow(thread.region);
		expect(
			pill(),
			"the thread arm produced a pill under the same gesture the feed shows " +
				"one for",
		).toBeNull();
		cleanup();

		// THE CONTROL — the identical gesture on the feed arm.
		const feed = mountTier(null);
		driveShow(feed.region);
		expect(
			pill(),
			"the feed arm produced no pill either, so the thread-arm absence above " +
				"is a fact about the gesture and not about the arm",
		).not.toBeNull();

		// ...and an arm change takes it away again, which is the browser Back and
		// the tap-into-a-post path both.
		feed.rerender(view("p1"));
		expect(pill()).toBeNull();
	});
});

describe("MOBILE-2k · F-1 — the box, its tap target and its stacking", () => {
	/**
	 * G10 — 44px, ARITHMETIC READ OFF THE CLASS STRING RATHER THAN TYPED HERE.
	 *
	 * ⛔ THE NUMBER 44 APPEARS IN THIS ROW EXACTLY ONCE, AS THE FLOOR. Everything
	 * else is derived: `h-9` is the painted height, `after:-top-1` and
	 * `after:-bottom-1` are the extension, and one spacing step is 4px. A guard
	 * that asserted `h-9` and `after:-top-1` by name would stay green if somebody
	 * changed `h-9` to `h-8` and left the extension alone — 32 + 8 = 40, a target
	 * under the floor with every token assertion intact.
	 *
	 * ⛔ AND THE `after:` SET IS CLOSED, for the defect the component's own
	 * docblock names: `after:pointer-events-none` paints the identical rectangle
	 * and takes no taps, collapsing the target back to 36px with every size
	 * assertion still passing. `after:content-['']` is in the set for the mirror
	 * reason — without it the pseudo-element does not generate a box at all, so
	 * the extension is 8px of nothing.
	 */
	it("phone-top-pill::the-44px-tap-target-is-DERIVED-from-its-own-tokens", () => {
		const region = detachedRegion();
		render(
			<PhoneTopPill
				regionRef={{ current: region }}
				locked={false}
				busy={false}
			/>,
		);
		driveShow(region);
		const el = pill();
		if (el === null) {
			throw new Error("no pill to measure");
		}
		const tokens = tokensOf(el);

		// (a) ONE SPACING STEP IS 4px. Tailwind v4's default, and the derivation
		// below is arithmetic on top of it — so a `--spacing` override anywhere in
		// the stylesheet would silently change every figure this row computes.
		const css = readFileSync(join(ROOT, CSS), "utf8");
		expect(
			/--spacing\s*:/.test(css),
			`${CSS} redefines \`--spacing\`, so one step is no longer 4px and this ` +
				"row's arithmetic is wrong rather than merely stale — re-derive it " +
				"from the declared value",
		).toBe(false);

		// (b) The painted height and the two extensions, read off the class.
		const step = (pattern: RegExp, what: string): number => {
			const hit = tokens.find((t) => pattern.test(t));
			const n = hit === undefined ? null : pattern.exec(hit)?.[1];
			if (n === undefined || n === null) {
				throw new Error(
					`the pill declares no ${what} — its height or its hit-area ` +
						`extension has been renamed, and the 44px arithmetic cannot be ` +
						"re-derived from what is left",
				);
			}
			return Number(n) * SPACING_PX;
		};
		const painted = step(/^h-(\d+)$/, "`h-<n>` painted height");
		const above = step(/^after:-top-(\d+)$/, "`after:-top-<n>` extension");
		const below = step(
			/^after:-bottom-(\d+)$/,
			"`after:-bottom-<n>` extension",
		);

		expect(painted, "the pill paints at 36px (`h-9`), by design").toBe(36);
		expect(
			painted + above + below,
			`${painted}px painted + ${above}px + ${below}px = ` +
				`${painted + above + below}px of hit area, under the ${MIN_TAP_PX}px ` +
				"floor. The pill is a floating control on a touch surface and B7 " +
				"measures it",
		).toBeGreaterThanOrEqual(MIN_TAP_PX);

		// (c) The pseudo-element generates a box, spans the pill, and TAKES TAPS.
		expect(
			tokens.filter((t) => t.startsWith("after:")).sort(),
			"the `after:` set is CLOSED. `after:pointer-events-none` would paint " +
				"the same rectangle and take no taps — 44px of visual target and " +
				"36px of real one, with every assertion above still green (measured " +
				"on the Support/Counter pill before its guard existed). Dropping " +
				"`after:content-['']` is the same defect from the other end: no " +
				"content, no generated box, no extension",
		).toEqual([
			"after:-bottom-1",
			"after:-top-1",
			"after:absolute",
			"after:content-['']",
			"after:inset-x-0",
		]);
	});

	/**
	 * The position and the z-order are ONE claim about the MOUNT SITE, which is
	 * why they are one row.
	 *
	 * `top-full` resolves against the nearest positioned ancestor. If that
	 * ancestor were `<body>`, the pill would land 12px below the bottom of the
	 * DOCUMENT — off screen, with no error anywhere. And the pill declares no
	 * `z-*` of its own on purpose: a `z-index` here would resolve INSIDE the
	 * header block's own stacking context and say nothing about the pill's
	 * relationship to the feed or to the sheet. Both facts live in the parent.
	 */
	it("phone-top-pill::positioned-against-the-header-block-and-declares-no-z-token", () => {
		const { region } = mountTier(null);
		driveShow(region);
		const el = pill();
		if (el === null) {
			throw new Error("no pill");
		}
		const tokens = tokensOf(el);

		expect(tokens).toContain("absolute");
		expect(
			tokens,
			"`top-full` is what makes 12px-under-the-tabs structural: the header " +
				"block's height is set by how many lines the question wraps to, so no " +
				"constant can name its bottom edge",
		).toContain("top-full");
		expect(tokens).toContain("mt-3");
		expect(tokens).toContain("left-1/2");
		expect(tokens).toContain("-translate-x-1/2");

		expect(
			tokens.filter((t) => /^z-/.test(t)),
			"a `z-*` on the pill resolves inside its parent's stacking context and " +
				"says nothing about either relationship it needs to hold (above the " +
				"feed, below the sheet). The mount site is the mechanism",
		).toEqual([]);

		const parent = tokensOf(el.parentElement);
		expect(
			parent,
			"the pill's containing block must be POSITIONED, or `top-full` " +
				"resolves against `<body>` and puts it below the document",
		).toContain("relative");
		expect(
			parent,
			"the header block's `z-30` is what paints the pill above the feed " +
				"region (a later sibling at `z-auto`) and below `PhoneSheet` " +
				"(`fixed z-50`)",
		).toContain("z-30");
	});

	/**
	 * G6, BEHAVIOURAL HALF. The source half — that no touch or pointer handler is
	 * authored at all — is `phone-top-pill-listeners.test.ts` and
	 * `phone-gesture-wall.test.ts`'s closed allowlist. This row asserts the
	 * consequence a scan cannot: a gesture that reaches the pill is NOT
	 * cancelled, so momentum, rubber-band and axis lock stay the browser's.
	 */
	it("phone-top-pill::takes-a-click-and-cancels-no-gesture", () => {
		const region = detachedRegion();
		render(
			<PhoneTopPill
				regionRef={{ current: region }}
				locked={false}
				busy={false}
			/>,
		);
		driveShow(region);
		const el = pill();
		if (el === null) {
			throw new Error("no pill");
		}

		const prevented: string[] = [];
		for (const type of [
			"touchstart",
			"touchmove",
			"touchend",
			"pointerdown",
			"pointermove",
			"wheel",
		]) {
			const event = new Event(type, { bubbles: true, cancelable: true });
			el.dispatchEvent(event);
			if (event.defaultPrevented) {
				prevented.push(type);
			}
		}
		expect(
			prevented,
			"a handler on this control cancelled a gesture — which is MOBILE-2c's " +
				"P0 arriving on the one element that floats over the scroller",
		).toEqual([]);
		expect(
			refresh,
			"a touch or pointer event refetched. The pill answers CLICK and " +
				"nothing else; a pointer path into the refetch is a refresh a reader " +
				"never asked for",
		).not.toHaveBeenCalled();

		// THE CONTROL — the one event it does answer. Without this the row above
		// is green against a pill wired to nothing at all.
		region.scrollTop = 0;
		act(() => {
			el.click();
		});
		expect(refresh).toHaveBeenCalledTimes(1);
	});
});
