// @vitest-environment jsdom

import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { HeroPanels } from "@/components/discovery/HeroPanels";
import { MarketCard } from "@/components/discovery/MarketCard";
import type { HeroPost, HeroTopPosts } from "@/server/discovery/hero";
import type { DiscoveryCard } from "@/server/discovery/list";
import type { PricePoint } from "@/server/discovery/price-series";

import {
	EXTENDED,
	MARKET_ID,
	SLUG,
	TITLE,
} from "../../composer/render/_harness";

/**
 * PRIMITIVES-2 PR-A, commit 1 — **RED BY CONSTRUCTION**.
 *
 * The defect: a presigned R2 GET URL that 404s at the browser has **no
 * degradation path at any of the three Discovery image sites**. Every site
 * branches on `imageUrl === null` and renders a design-ratified `IMG`
 * placeholder, but a non-null URL whose object is missing renders a plain
 * `<img>` with no `onError` — so the browser paints its own broken-image glyph
 * and, on the two market thumbs, overflows the `alt` text into the metadata
 * row. `getDefaultMarketMediaUrl` cannot see this: presigning is a local HMAC
 * over a key, so it returns a perfectly well-formed URL for an object that is
 * not there (plan §2, recon R10).
 *
 * Sites, re-counted at `f51a9dd`, not inherited from the plan's §2:
 *   1. `MarketCard.tsx:51-55`      — 52×52, `items-center` (HTML-FINISH row 5)
 *   2. `HeroPanels.tsx:62-66`      — 54×54, `items-center`
 *   3. `HeroPanels.tsx:184-191`    — `flex-1 min-h-[40px]`, both `data-testid` arms
 * Zero `onError` handlers exist anywhere under `src/` at this commit.
 *
 * **The assertion shape is D3 stated as a property.** The error state must
 * render *the site's own null placeholder* — not an invented visual — so the
 * post-error DOM must be **byte-identical to the null-image DOM**. That is one
 * full-string `toBe` per site (§8.1: never `.toContain`; class order is caught),
 * and it simultaneously discharges D3 and the "error renders the same node as
 * null" half of the exit criteria.
 *
 * **N3 — every absence assertion carries a positive control.** A DOM-equality
 * assertion is vacuous if the two fixtures it compares cannot differ, so
 * `control::` proves, per site, that (a) the loaded and null renders genuinely
 * differ and (b) the images this test fires `error` at exist first, at the
 * exact expected count. Without those, all three site assertions could pass
 * against a component that never renders an image at all. The count is what
 * makes site 3 a BOTH-POLES assertion rather than a YES-only one — see `SITES`.
 *
 * Fixture labels reuse the shipped server-suite scaffold ("Discovery Market",
 * `signed.test`) and the composer harness strings — never invented market
 * content (CLAUDE.md §3). No jest-dom in this repo (AGENTS.md §9) — plain DOM
 * assertions only.
 */

afterEach(cleanup);

const MARKET_TITLE = "Discovery Market";

/** A well-formed presigned URL whose object is gone — the exact failure mode. */
const CARD_IMAGE_URL = "https://signed.test/market-media/m/x/card.webp";
const POST_IMAGE_URL = "https://signed.test/uploads/u/x/arg.webp";

const SERIES: PricePoint[] = [
	{ at: "2026-07-01T00:00:00.000Z", yes: "0.500000000000000000" },
	{ at: "2026-07-01T00:01:00.000Z", yes: "0.700000000000000000" },
	{ at: "2026-07-01T00:02:00.000Z", yes: "0.400000000000000000" },
];

function cardFixture(imageUrl: string | null): DiscoveryCard {
	return {
		id: MARKET_ID,
		slug: SLUG,
		title: MARKET_TITLE,
		pricing: { yes: "0.380000000000000000", no: "0.620000000000000000" },
		totals: {
			dharmaStaked: "14260.000000000000000000",
			postCount: 28,
			replyCount: 68,
		},
		imageUrl,
	};
}

function heroPost(side: HeroPost["side"], imageUrl: string | null): HeroPost {
	return {
		id:
			side === "YES"
				? "0190b3a0-9999-7000-8000-00000000000a"
				: "0190b3a0-9999-7000-8000-00000000000b",
		ordinal: side === "YES" ? 3 : 1,
		side,
		title: TITLE,
		teaser: EXTENDED,
		author: {
			pseudonym: side === "YES" ? "hero-yes-author" : "hero-no-author",
			pfpUrl: "/pfp-placeholder.svg",
		},
		authorStake: "40.000000000000000000",
		// DISTINCT per side — `price_at_bet` is already the bought side's price,
		// so a shared value lets a complement bug hide (the hero-panels precedent).
		entryPrice:
			side === "YES" ? "0.270000000000000000" : "0.550000000000000000",
		replyCount: 24,
		replyDharma: "10000.000000000000000000",
		supportDharma: "3800.000000000000000000",
		counterDharma: "6200.000000000000000000",
		imageUrl,
		currentValue: null,
		createdAt: "2026-07-01T00:00:00.000Z",
	};
}

function topPosts(postImageUrl: string | null): HeroTopPosts {
	return {
		yes: heroPost("YES", postImageUrl),
		no: heroPost("NO", postImageUrl),
	};
}

/**
 * The three sites, each expressed as a null render, a loaded render, and every
 * `<img>` the browser would fail to load. Driving all three through one table
 * keeps the site count honest: a fourth `<img>` appearing under `discovery/`
 * without a row here is visible as an omission, not as a silent pass.
 *
 * ⚠ `imgCount` is not decoration. The hero POST image renders **twice** — once
 * per panel — so a `querySelector`-shaped test fires `error` at the YES panel
 * only and then asserts a whole-container equality that NO correct
 * implementation can satisfy, because the NO panel's image never failed. The
 * count is asserted and the error is fired at every match, which makes this
 * site's assertion a **both-poles** one by construction instead of a YES-only
 * assertion that stays green while the NO panel is broken.
 */
const SITES = [
	{
		name: "card-thumb · MarketCard.tsx:51-55 @ f51a9dd (52×52, items-center @ HTML-FINISH row 5)",
		imgCount: 1,
		renderNull: () => render(<MarketCard card={cardFixture(null)} />),
		renderLoaded: () =>
			render(<MarketCard card={cardFixture(CARD_IMAGE_URL)} />),
		selector: `img[src="${CARD_IMAGE_URL}"]`,
	},
	{
		name: "hero-thumb · HeroPanels.tsx:62-66 @ f51a9dd (54×54, items-center)",
		imgCount: 1,
		renderNull: () =>
			render(
				<HeroPanels
					card={cardFixture(null)}
					series={SERIES}
					topPosts={topPosts(null)}
				/>,
			),
		renderLoaded: () =>
			render(
				<HeroPanels
					card={cardFixture(CARD_IMAGE_URL)}
					series={SERIES}
					topPosts={topPosts(null)}
				/>,
			),
		selector: `img[src="${CARD_IMAGE_URL}"]`,
	},
	{
		// TWO images — the YES panel's and the NO panel's. See `imgCount` above.
		name: "hero-post-image · HeroPanels.tsx:184-191 @ f51a9dd (flex-1 min-h-[40px], both poles)",
		imgCount: 2,
		renderNull: () =>
			render(
				<HeroPanels
					card={cardFixture(null)}
					series={SERIES}
					topPosts={topPosts(null)}
				/>,
			),
		renderLoaded: () =>
			render(
				<HeroPanels
					card={cardFixture(null)}
					series={SERIES}
					topPosts={topPosts(POST_IMAGE_URL)}
				/>,
			),
		selector: `img[src="${POST_IMAGE_URL}"]`,
	},
] as const;

/** EVERY `<img>` at a site — never just the first (see `imgCount` above). */
function findImgs(
	container: HTMLElement,
	selector: string,
): HTMLImageElement[] {
	return Array.from(container.querySelectorAll<HTMLImageElement>(selector));
}

describe("PRIMITIVES-2 D2/D3 — the three Discovery image sites degrade a 404", () => {
	for (const site of SITES) {
		// N3 POSITIVE CONTROL. Proves the site assertion below is discriminating:
		// the two fixtures really do produce different DOM, and the images the
		// assertion fires `error` at are really there to be found, at the exact
		// expected count. A green site assertion means nothing without these.
		it(`control::${site.name} — loaded and null renders differ, and every img exists`, () => {
			const nullRender = site.renderNull();
			const nullHtml = nullRender.container.innerHTML;
			expect(findImgs(nullRender.container, site.selector)).toHaveLength(0);
			nullRender.unmount();

			const loaded = site.renderLoaded();
			expect(findImgs(loaded.container, site.selector)).toHaveLength(
				site.imgCount,
			);
			expect(loaded.container.innerHTML).not.toBe(nullHtml);
		});

		it(`${site.name} — a 404ing image degrades to the site's own placeholder`, () => {
			const nullRender = site.renderNull();
			const nullHtml = nullRender.container.innerHTML;
			nullRender.unmount();

			const loaded = site.renderLoaded();
			const imgs = findImgs(loaded.container, site.selector);
			// N1 alive check — a selector that silently matched nothing would make
			// the loop below a no-op and the equality vacuous.
			expect(imgs).toHaveLength(site.imgCount);

			// The browser's load failure, delivered exactly as the browser delivers
			// it, at EVERY image the site renders — both poles for the hero post
			// image. Before `MarketThumb` was adopted nothing listened, the DOM did
			// not move, and this assertion was RED at all three sites; the captured
			// output is in commit 1's body.
			for (const img of imgs) {
				fireEvent.error(img);
			}

			// D3 — the error state IS the null state. Full-string equality, never
			// `.toContain`: a placeholder emitting the right classes in the wrong
			// order is a real delta and must fail here.
			expect(loaded.container.innerHTML).toBe(nullHtml);
		});
	}
});

/**
 * §8.1 — THE PER-CONSUMER ZERO-DELTA PROOF.
 *
 * Every literal below was **captured from the pre-change component at
 * `origin/main` `f51a9dd`**, by rendering it and dumping `outerHTML`. None is
 * hand-written. Any diff here is a real pixel regression on a live surface.
 *
 * **The assertion is `toBe` — full-string equality, never `.toContain`.** Class
 * ORDER is caught: a first draft of the `PriceBar` proof once emitted identical
 * classes in a different order and passed by eye. `PriceBar`'s own suite is the
 * precedent, and §8.1 forces the shape rather than leaving it to taste —
 * `MarketThumb` gets full equality (it emits its own node), never `SideBadge`'s
 * `OWNED_TAIL` suffix pin.
 *
 * **The scope is the THUMB NODE, not the whole card, and that is deliberate.**
 * `MarketThumb` owns exactly this one node; the surrounding card also carries
 * `SideBadge`, whose shadcn `badgeVariants` base sits outside this component's
 * control. Pinning the whole subtree would redden this suite on an unrelated
 * shadcn bump — the precise failure §8.1 warns about — while proving nothing
 * extra about the primitive.
 *
 * Three arms are asserted per consumer: the **null** path, the **loaded** path,
 * and the **error** path, which must render the null baseline exactly. The
 * error arm is the one that did not exist before this PR; the other two are the
 * regression proof that adopting the primitive moved nothing.
 *
 * ⚠ The two market-thumb LOADED baselines carry `alt=""`. That is D4's ratified
 * delta (PD-2-33) and is the ONE intended change in PR-A — these literals were
 * captured with `alt="Discovery Market"` and the attribute was edited to `""`
 * by hand, the only hand-edit anywhere in this block. Every other byte is as
 * captured. The hero POST image's `alt=""` is unchanged and was captured as-is.
 */

/** `MarketCard`'s 52×52 thumb — first child of the `items-center` row. */
const CARD_THUMB_LOADED =
	'<img alt="" class="h-[52px] w-[52px] shrink-0 rounded-[var(--imgr)] object-cover" src="https://signed.test/market-media/m/x/card.webp">';
/** 178 bytes as captured. */
const CARD_THUMB_NULL =
	'<div aria-hidden="true" class="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-[var(--imgr)] bg-n1 font-mono text-[8.5px] tracking-[0.16em] text-n4">IMG</div>';

/** `HeroPanels`' 54×54 thumb — first child of the `items-center` row. */
const HERO_THUMB_LOADED =
	'<img alt="" class="h-[54px] w-[54px] shrink-0 rounded-[var(--imgr)] object-cover" src="https://signed.test/market-media/m/x/card.webp">';
/** 178 bytes as captured. */
const HERO_THUMB_NULL =
	'<div aria-hidden="true" class="flex h-[54px] w-[54px] shrink-0 items-center justify-center rounded-[var(--imgr)] bg-n1 font-mono text-[8.5px] tracking-[0.16em] text-n4">IMG</div>';

/**
 * The hero POST image, per pole. 192/191 bytes loaded, 239/238 null — the
 * one-byte spread is `YES` vs `NO` in the `data-testid`. Both poles are pinned
 * because a YES-only proof passes against an inverted NO panel, which is how
 * the last inversion survived a full PR with tests (plan §3 D14 Q2).
 */
const POST_IMAGE_LOADED = (side: "YES" | "NO") =>
	`<img data-testid="hero-post-image-${side}" alt="" class="mt-2 min-h-[40px] flex-1 rounded-[var(--imgr)] bg-n1 object-cover [border:var(--hairline)]" src="https://signed.test/uploads/u/x/arg.webp">`;
const POST_IMAGE_NULL = (side: "YES" | "NO") =>
	`<div data-testid="hero-post-image-empty-${side}" aria-hidden="true" class="mt-2 flex min-h-[40px] flex-1 items-center justify-center rounded-[var(--imgr)] bg-n1 font-mono text-[9px] tracking-[0.18em] text-n4 [border:var(--hairline)]">IMG</div>`;

/** The thumb slot of a card/hero market panel — the row's first child. */
function thumbSlot(container: HTMLElement, row: string): string {
	const node = container.querySelector(row)?.firstElementChild;
	if (!(node instanceof HTMLElement)) {
		throw new Error(`no thumb node under "${row}" — the fixture moved`);
	}
	return node.outerHTML;
}

/** The hero post image slot for one pole, in whichever arm is rendered. */
function postSlot(container: HTMLElement, side: "YES" | "NO"): string {
	const node =
		container.querySelector(`[data-testid="hero-post-image-${side}"]`) ??
		container.querySelector(`[data-testid="hero-post-image-empty-${side}"]`);
	if (!(node instanceof HTMLElement)) {
		throw new Error(`no post image node for ${side} — the fixture moved`);
	}
	return node.outerHTML;
}

describe("§8.1 zero-delta — MarketCard's 52×52 thumb", () => {
	const ROW = ".items-center.gap-3";

	it("null-path-is-byte-identical-to-the-f51a9dd-render", () => {
		const { container } = render(<MarketCard card={cardFixture(null)} />);
		expect(thumbSlot(container, ROW)).toBe(CARD_THUMB_NULL);
	});

	it("loaded-path-is-byte-identical-to-the-f51a9dd-render-but-for-D4s-alt", () => {
		const { container } = render(
			<MarketCard card={cardFixture(CARD_IMAGE_URL)} />,
		);
		expect(thumbSlot(container, ROW)).toBe(CARD_THUMB_LOADED);
	});

	it("error-path-renders-the-null-baseline-node", () => {
		const { container } = render(
			<MarketCard card={cardFixture(CARD_IMAGE_URL)} />,
		);
		const imgs = findImgs(container, `img[src="${CARD_IMAGE_URL}"]`);
		expect(imgs).toHaveLength(1);
		for (const img of imgs) {
			fireEvent.error(img);
		}
		expect(thumbSlot(container, ROW)).toBe(CARD_THUMB_NULL);
	});
});

describe("§8.1 zero-delta — HeroPanels' 54×54 thumb", () => {
	const ROW = ".items-center.gap-3";
	const renderHero = (imageUrl: string | null) =>
		render(
			<HeroPanels
				card={cardFixture(imageUrl)}
				series={SERIES}
				topPosts={topPosts(null)}
			/>,
		);

	it("null-path-is-byte-identical-to-the-f51a9dd-render", () => {
		expect(thumbSlot(renderHero(null).container, ROW)).toBe(HERO_THUMB_NULL);
	});

	it("loaded-path-is-byte-identical-to-the-f51a9dd-render-but-for-D4s-alt", () => {
		expect(thumbSlot(renderHero(CARD_IMAGE_URL).container, ROW)).toBe(
			HERO_THUMB_LOADED,
		);
	});

	it("error-path-renders-the-null-baseline-node", () => {
		const { container } = renderHero(CARD_IMAGE_URL);
		const imgs = findImgs(container, `img[src="${CARD_IMAGE_URL}"]`);
		expect(imgs).toHaveLength(1);
		for (const img of imgs) {
			fireEvent.error(img);
		}
		expect(thumbSlot(container, ROW)).toBe(HERO_THUMB_NULL);
	});
});

describe("§8.1 zero-delta — the hero POST image, at BOTH poles", () => {
	const renderPosts = (imageUrl: string | null) =>
		render(
			<HeroPanels
				card={cardFixture(null)}
				series={SERIES}
				topPosts={topPosts(imageUrl)}
			/>,
		);

	for (const side of ["YES", "NO"] as const) {
		it(`${side}::null-path-is-byte-identical-to-the-f51a9dd-render`, () => {
			expect(postSlot(renderPosts(null).container, side)).toBe(
				POST_IMAGE_NULL(side),
			);
		});

		it(`${side}::loaded-path-is-byte-identical-to-the-f51a9dd-render`, () => {
			// No `alt` delta here — this site already shipped `alt=""`, and its
			// two `data-testid`s survive unchanged through the primitive's
			// passthrough, including their attribute position.
			expect(postSlot(renderPosts(POST_IMAGE_URL).container, side)).toBe(
				POST_IMAGE_LOADED(side),
			);
		});

		it(`${side}::error-path-renders-the-null-baseline-node`, () => {
			const { container } = renderPosts(POST_IMAGE_URL);
			const imgs = findImgs(container, `img[src="${POST_IMAGE_URL}"]`);
			// Both poles render an image; firing at only the first would leave
			// this pole's assertion passing for the wrong reason on one side.
			expect(imgs).toHaveLength(2);
			for (const img of imgs) {
				fireEvent.error(img);
			}
			expect(postSlot(container, side)).toBe(POST_IMAGE_NULL(side));
		});
	}

	it("one-pole-failing-does-not-blank-the-other", () => {
		// The panels hold INDEPENDENT MarketThumb instances. A shared or hoisted
		// error flag would degrade both, which would read as a pass on the
		// assertions above while silently blanking a perfectly good image.
		const { container } = renderPosts(POST_IMAGE_URL);
		const imgs = findImgs(container, `img[src="${POST_IMAGE_URL}"]`);
		expect(imgs).toHaveLength(2);
		const first = imgs[0];
		if (first === undefined) {
			throw new Error("fixture broken: no post image to fail");
		}
		fireEvent.error(first);
		expect(postSlot(container, "YES")).toBe(POST_IMAGE_NULL("YES"));
		expect(postSlot(container, "NO")).toBe(POST_IMAGE_LOADED("NO"));
	});
});

/**
 * D2-P1 — THE PRE-HYDRATION 404, at all three sites. **RED BY CONSTRUCTION.**
 *
 * PR-A reviewer finding M1. `onError` is a React *synthetic* handler, and for
 * `<img>` React binds `error` as a **non-delegated** listener at hydrate time
 * (`react-dom-client.development.js:5274-5278`). `(public)/page.tsx:18` is
 * `force-dynamic` with the `<img>` server-rendered, so the browser starts the
 * R2 GET at HTML-parse time. The DOM `error` event fires exactly ONCE — if it
 * lands before hydration attaches the listener it is lost permanently, the
 * broken glyph persists, and the fallback never renders.
 *
 * The state to model is therefore: the element mounts with a `src` that has
 * **already completed and already failed**, so no `error` event will ever fire
 * at it. `complete === true` distinguishes finished from in-flight, and
 * `naturalWidth === 0` distinguishes a failed decode from a succeeded one —
 * `complete` alone is also true for a CACHED SUCCESS.
 *
 * ⚠ **THE VACUITY HAZARD, measured in this environment rather than assumed.**
 * jsdom never decodes, so `naturalWidth` is `0` for EVERY image here, and
 * `complete` is `false` for every image here. Both defaults are wrong for this
 * test in opposite directions: the always-0 `naturalWidth` would make a
 * fallback assertion pass for the wrong reason, and the always-false
 * `complete` makes the production check *inert* so an unstubbed test measures
 * nothing at all. Both properties are stubbed explicitly, and N3 positive
 * controls pin both discriminating axes:
 *   · `complete: true,  naturalWidth: 200` → must NOT fall back (decoded fine)
 *   · `complete: false, naturalWidth: 0`   → must NOT fall back (still loading)
 * Without those two, every assertion below would pass against a component that
 * falls back on *every* image unconditionally.
 *
 * ⚠ **Why the mount path stubs the PROTOTYPE and not the element.** React runs
 * the mount effect inside `render()`, so an `Object.defineProperty` applied to
 * the returned element is already too late — it cannot be in place when the
 * effect reads it, which is exactly the ordering the real browser guarantees
 * and the test must reproduce. The prototype is the only seam that is live at
 * mount. The `src`-change path below *does* stub the rendered element directly,
 * because there the effect re-runs after the element already exists.
 */

/**
 * Install a decode state on every `<img>` for the duration of `fn`.
 *
 * ⚠ **The seam is PROCESS-WIDE, not `MarketThumb`-scoped.** It patches
 * `HTMLImageElement.prototype`, so it reaches every image in the environment —
 * including the detached `new window.Image()` radix builds inside
 * `useImageLoadingStatus` for the hero author avatars, whose predicate is
 * `complete && naturalWidth > 0 ? "loaded" : "loading"`. Two consequences a
 * future editor of this block must know:
 *   1. **Never compare a render made inside a window against one made outside
 *      it.** Both sides of every equality below are captured inside a window
 *      for exactly this reason — a radix bump that simplified its predicate to
 *      `complete` alone would otherwise materialise avatar `<img>`s on one side
 *      only and redden these assertions for a reason unrelated to `MarketThumb`.
 *   2. **Never widen `findImgs` to a bare `img` selector.** It is `src`-scoped
 *      on purpose; the DECODED windows really do materialise radix avatars, and
 *      a bare selector would count them.
 */
function withImageState<T>(
	state: { complete: boolean; naturalWidth: number },
	fn: () => T,
): T {
	const proto = HTMLImageElement.prototype;
	const priorComplete = Object.getOwnPropertyDescriptor(proto, "complete");
	const priorNatural = Object.getOwnPropertyDescriptor(proto, "naturalWidth");
	Object.defineProperty(proto, "complete", {
		configurable: true,
		get: () => state.complete,
	});
	Object.defineProperty(proto, "naturalWidth", {
		configurable: true,
		get: () => state.naturalWidth,
	});
	try {
		return fn();
	} finally {
		// Restored in `finally` so a failing assertion cannot leak a fake decode
		// state into every later test in this file. The `else` branches matter:
		// jsdom defines both as own accessors on the prototype today, but if a
		// jsdom major ever moved either off it, a conditional-only restore would
		// leave the stub PERMANENTLY installed and still report green — the
		// in-flight control would become inexpressible without failing.
		// `Reflect.deleteProperty` rather than `delete`: both are readonly on the
		// DOM lib type, which makes `delete` a TS2704 compile error.
		if (priorComplete !== undefined) {
			Object.defineProperty(proto, "complete", priorComplete);
		} else {
			Reflect.deleteProperty(proto, "complete");
		}
		if (priorNatural !== undefined) {
			Object.defineProperty(proto, "naturalWidth", priorNatural);
		} else {
			Reflect.deleteProperty(proto, "naturalWidth");
		}
	}
}

describe("D2-P1 — a 404 that resolved BEFORE hydration still degrades", () => {
	for (const site of SITES) {
		it(`${site.name} — already-failed-at-mount degrades to the placeholder`, () => {
			// Captured INSIDE a window even though the null arm renders no <img>
			// of its own — see `withImageState`'s note 1. The state chosen is the
			// same one the comparison render uses, so both sides see an identical
			// environment and any future avatar-rendering difference cancels.
			const nullHtml = withImageState(
				{ complete: true, naturalWidth: 0 },
				() => {
					const nullRender = site.renderNull();
					const html = nullRender.container.innerHTML;
					nullRender.unmount();
					return html;
				},
			);

			// N1 alive check, and it CANNOT be made after the failed-decode render:
			// a correct component has already swapped the images out by the time
			// `render()` returns, so counting them there measures the fix, not the
			// fixture. Counting under a DECODED stub proves the fixture really does
			// mount `imgCount` images, so the equality below is not two empty
			// renders agreeing with each other.
			withImageState({ complete: true, naturalWidth: 200 }, () => {
				const probe = site.renderLoaded();
				expect(findImgs(probe.container, site.selector)).toHaveLength(
					site.imgCount,
				);
				probe.unmount();
			});

			withImageState({ complete: true, naturalWidth: 0 }, () => {
				const loaded = site.renderLoaded();
				// NO `fireEvent.error` anywhere in this block. That is the whole
				// point: the event already fired, before anything was listening.
				expect(findImgs(loaded.container, site.selector)).toHaveLength(0);
				expect(loaded.container.innerHTML).toBe(nullHtml);
			});
		});

		it(`control::${site.name} — a DECODED image does not fall back`, () => {
			// N3, axis 1. `naturalWidth` is 0 for every image in jsdom, so without
			// this control a component that falls back unconditionally would pass
			// the assertion above.
			withImageState({ complete: true, naturalWidth: 200 }, () => {
				const loaded = site.renderLoaded();
				expect(findImgs(loaded.container, site.selector)).toHaveLength(
					site.imgCount,
				);
			});
		});

		it(`control::${site.name} — a load still IN FLIGHT does not fall back`, () => {
			// N3, axis 2. `complete === false` means the browser has not finished;
			// falling back here would blank a good image mid-load.
			withImageState({ complete: false, naturalWidth: 0 }, () => {
				const loaded = site.renderLoaded();
				expect(findImgs(loaded.container, site.selector)).toHaveLength(
					site.imgCount,
				);
			});
		});
	}

	/**
	 * The `src`-change path, stubbed on the ELEMENT rather than the prototype —
	 * legal here, and the more surgical choice, because the effect re-runs after
	 * the element already exists. `decode` is what the swapped-in image reports.
	 * Selector is slot-scoped, matching the L5 fix in `market-card.test.tsx`: an
	 * unscoped `querySelector("img")` would stub the wrong element if a second
	 * image were ever added ahead of the thumb, and the fixture guard below would
	 * not fire.
	 */
	function renderThenSwap(decode: { complete: boolean; naturalWidth: number }) {
		const good = "https://signed.test/market-media/m/x/good.webp";
		const view = render(<MarketCard card={cardFixture(good)} />);
		const img = view.container.querySelector(".items-center.gap-3 > img");
		if (!(img instanceof HTMLImageElement)) {
			throw new Error("fixture broken: the loaded arm rendered no thumb <img>");
		}
		Object.defineProperty(img, "complete", {
			configurable: true,
			get: () => decode.complete,
		});
		Object.defineProperty(img, "naturalWidth", {
			configurable: true,
			get: () => decode.naturalWidth,
		});
		// The carousel advancing to the next market.
		view.rerender(<MarketCard card={cardFixture(CARD_IMAGE_URL)} />);
		return view;
	}

	it("re-checks on a src CHANGE, not only on first mount", () => {
		// `DiscoveryCarousel.tsx:102` swaps `card` on the SAME mounted node every
		// 10s, so a mount-only check would miss every market after the first.
		const nullRender = render(<MarketCard card={cardFixture(null)} />);
		const nullHtml = nullRender.container.innerHTML;
		nullRender.unmount();

		const view = renderThenSwap({ complete: true, naturalWidth: 0 });
		expect(view.container.innerHTML).toBe(nullHtml);
	});

	it("control::a src CHANGE to a GOOD image does not blank it", () => {
		// N3 for the swap path, and the one place the new effect could destroy a
		// healthy image: if the predicate were ever loosened to `complete` alone,
		// every carousel advance would blank a perfectly good thumb. Without this
		// control the assertion above passes against exactly that mutation.
		const view = renderThenSwap({ complete: true, naturalWidth: 200 });
		const imgs = findImgs(view.container, `img[src="${CARD_IMAGE_URL}"]`);
		expect(imgs).toHaveLength(1);
		expect(view.container.querySelector(".items-center.gap-3 > img")).toBe(
			imgs[0],
		);
	});
});
