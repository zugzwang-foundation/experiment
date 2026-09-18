// @vitest-environment jsdom

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MarketHeader } from "@/components/debate/MarketHeader";
import { RESOLUTION_BLOCKS } from "@/components/debate/resolution-block-data";
import { MARKET_TITLE_SIZE_OVERRIDES } from "@/components/debate/title-size-overrides";
import type { DebateMarketHeader } from "@/components/debate/types";

/**
 * The per-market title-size override mechanism, and the one market that uses it.
 *
 * ⚠⚠ MKT-ROSTER-1 (D-49) EMPTIED THE MAP, AND THIS FILE WAS REWRITTEN RATHER
 * THAN DELETED. Its whole subject was the one market that carried an entry, and
 * that market was removed from the roster. Deleting the file was the other
 * option and is the wrong one: the thing worth guarding was never that market,
 * it was the MECHANISM — that an entry in the map actually reaches the heading,
 * and that `cn()` RESOLVES the base size away rather than merely out-ranking it.
 * Both are still live code with a scheduled consumer (the next ruling), and a
 * deleted file guards neither.
 *
 * ⛔⛔ THE SCHEDULED CONSUMER ARRIVED. D-50 gave `math-erdos-solved-on-zugzwang`
 * a v3.0 title of 67 characters, which measures 728.19px against a 667px column
 * and clips `mber?` — the question mark included, the same tail the removed
 * market lost. So the map has ONE entry again, and this file's framing is
 * corrected in place rather than left describing an empty map (§8 O-5).
 * ⚠⚠ THE PREDICTION IN THE PARAGRAPH ABOVE IS WHY THIS FILE EXISTED AT ALL, AND
 * IT PAID OFF EXACTLY AS WRITTEN: both scoping arms went RED the moment the
 * entry landed, before any browser was opened, and the file that explains the
 * rule was one import away. Rewriting rather than deleting was the right call
 * and this is the receipt.
 *
 * So the arms below are: the map holds exactly the one ruled entry · every
 * market WITHOUT an entry renders the base size (the scoping arm) · the one
 * WITH an entry renders it and resolves the base away (the real mechanism arm)
 * · and a SYNTHETIC entry does the same on a market that has none (the arm that
 * survives the map being emptied again).
 *
 * ⚠ THE ASSERTION IS ON THE COMPOSED CLASS, WHICH IS THE ONE THING THAT COULD
 * SILENTLY NOT HAPPEN. The override is merged by `cn()` (twMerge), which resolves
 * the font-size and line-height groups and keeps the last of each. That
 * resolution is a library behaviour, not ours — if a future `tailwind-merge`
 * stopped classifying an arbitrary `text-[Npx]` as a font-size, BOTH sizes would
 * land on the element, the larger would win by source order, and the heading
 * would clip again with nothing erroring. Asserting the ABSENCE of the base size
 * on the overridden arm is what catches that; asserting the override's presence
 * alone would not.
 *
 * ⚠ THE LEADING IS ASSERTED ALONGSIDE THE SIZE, AND NOT AS A SECOND NICETY. An
 * arbitrary `text-[Npx]` does not reset the line-height paired with the `text-*`
 * step in scope (AGENTS.md §8), so a size-only override is a real and quiet
 * failure mode — the type shrinks and the leading does not follow it.
 *
 * ⚠ jsdom performs no layout, so this file pins the CLASS and makes no claim
 * about the rendered width. The width measurements live in the override file's
 * docblock; they were taken in a real browser against the live staging build and
 * are not reproducible here and not attempted here.
 *
 * ⚠ Every slug used here must be a live market — `ResolverCards` throws on an
 * unknown one (BLOCK-1 G1), so a made-up slug would fail for the wrong reason.
 * The synthetic arm overrides the MAP, never the slug, for exactly that reason.
 *
 * No jest-dom in this repo (AGENTS.md §9) — plain DOM assertions only.
 */

afterEach(cleanup);

/** A live market, used as the arm that proves the base size renders. */
const CONTROL_SLUG = "bitcoin-price-50k";

/** The one market D-50 gave an entry. Named once so the arms below agree. */
const OVERRIDDEN_SLUG = "math-erdos-solved-on-zugzwang";

/** The heading's base size, as `MarketHeader` composes it. */
const BASE_SIZE = "text-[21px]";
/** The leading, which is on the base class and must survive an override. */
const LEADING = "leading-[1.24]";

const market = (slug: string): DebateMarketHeader => ({
	id: "0190c0de-2222-7000-8000-000000000002",
	slug,
	title: "Synthetic · A question long enough to be a market question?",
	description: "Resolution criterion text.",
	status: "Open",
	mediaVideoUrl: null,
	mediaImageUrl: null,
	thumbImageUrl: null,
	pricing: { yes: "0.500000000000000000", no: "0.500000000000000000" },
	unitToWin: { yes: "1.960000000000000000", no: "1.960000000000000000" },
	totals: {
		dharmaStaked: "150.000000000000000000",
		postCount: 3,
		replyCount: 5,
	},
});

const headingOf = (container: HTMLElement, slug: string): string => {
	const h1 = container.querySelector('[data-testid="headzone-stack"] h1');
	if (!h1) throw new Error(`no market-question <h1> rendered for ${slug}`);
	return h1.className;
};

const headingClasses = (slug: string): string => {
	const { container } = render(
		<MarketHeader market={market(slug)} priceChart={null} />,
	);
	return headingOf(container, slug);
};

describe("MarketHeader — per-market title size override", () => {
	it("market-header::the-override-map-holds-exactly-the-one-ruled-entry", () => {
		// ⚠ This arm read `toEqual([])` until D-50 and is INVERTED, not relaxed.
		// An exact inventory is what makes an unruled entry redden here first,
		// where the file explaining the rule is one import away; a `length <= 1`
		// or a `toContain` would let a second one in silently, and a second entry
		// is the signal that a title outgrew the column and wants measuring in a
		// real browser rather than a quiet step down.
		expect(Object.keys(MARKET_TITLE_SIZE_OVERRIDES)).toEqual([OVERRIDDEN_SLUG]);
	});

	it("market-header::every-market-WITHOUT-an-entry-renders-the-base-size", () => {
		// ⛔ THE SCOPING ARM, SWEPT RATHER THAN SPOT-CHECKED — the failure it
		// catches is a component that hard-codes a size for somebody, and one
		// market proves nothing about the others.
		// ⚠ It swept ALL SIX while the map was empty; with one entry live it
		// sweeps the OTHER FIVE and the entry's own market is asserted separately
		// below. Excluding it by name rather than by "skip anything in the map"
		// is deliberate: the latter would go vacuously green if the map ever grew
		// to all six.
		let checked = 0;
		for (const slug of Object.keys(RESOLUTION_BLOCKS)) {
			if (slug === OVERRIDDEN_SLUG) continue;
			const { container, unmount } = render(
				<MarketHeader market={market(slug)} priceChart={null} />,
			);
			const cls = headingOf(container, slug);
			expect(cls).toContain(BASE_SIZE);
			expect(cls).toContain(LEADING);
			checked += 1;
			unmount();
		}
		// ⛔ NON-VACUITY — an empty slug list would satisfy the loop above. Six
		// markets minus the one overridden.
		expect(checked).toBe(5);
	});

	it("market-header::the-OVERRIDDEN-market-steps-down-and-resolves-the-base-away", () => {
		// ⛔⛔ THE REAL MECHANISM ARM — the synthetic one below proves the branch
		// works, this proves the SHIPPED entry reaches the heading. Both are
		// wanted: this one goes green-by-accident if the map is emptied, and that
		// one cannot see a value that never made it into the map.
		// ⛔ ASSEMBLED AT RUNTIME, for the reason the synthetic arm's own comment
		// gives at length: Tailwind v4's scanner reads `tests/` as well as `src/`,
		// so a class-shaped literal here becomes a real emitted utility with no
		// component behind it. ⚠ BOTH of these classes DO have live `src/`
		// consumers today — the 19px size in `composer/PositionStrip.tsx` and
		// `composer/SlotHeader.tsx`, the 1.24 leading on `MarketHeader`'s own base
		// class — so writing them plainly would emit nothing new. The pattern is
		// kept anyway, because the cost of a literal is never in the file that
		// writes it; it is in the next file that copies the shape with a class
		// that has no consumer.
		const SZ = `text-[${19}px]`;
		const LD = `leading-[${1.24}]`;
		expect(MARKET_TITLE_SIZE_OVERRIDES[OVERRIDDEN_SLUG]).toBe(`${SZ} ${LD}`);
		const cls = headingClasses(OVERRIDDEN_SLUG);
		expect(cls).toContain(SZ);
		expect(cls).toContain(LD);
		// ⛔ The base size must be RESOLVED AWAY by twMerge, not out-ranked by
		// source order — two font sizes on one element render at the LARGER, which
		// is the 21px clip this entry exists to stop. ⚠ `LEADING` is NOT asserted
		// absent here the way the synthetic arm does it: this entry's leading is
		// the same 1.24 the base carries, so twMerge keeps one copy of an
		// identical value and `not.toContain(LEADING)` would be false for a
		// correct render. That is a property of THIS value, not of the mechanism.
		expect(cls).not.toContain(BASE_SIZE);
	});

	it("market-header::the-control-slug-has-no-entry-and-takes-the-base", () => {
		expect(MARKET_TITLE_SIZE_OVERRIDES[CONTROL_SLUG]).toBeUndefined();
		const cls = headingClasses(CONTROL_SLUG);
		expect(cls).toContain(BASE_SIZE);
		expect(cls).toContain(LEADING);
	});

	it("market-header::a-SYNTHETIC-entry-reaches-the-heading-and-resolves-the-base-away", async () => {
		// ⛔⛔ THE MECHANISM ARM. ⚠ It used to say it was "THE ONLY TEST LEFT THAT
		// REACHES THE OVERRIDE BRANCH AT ALL" and that "no shipped market can
		// reach it" — both false since D-50, and corrected rather than left
		// standing. `math-erdos-solved-on-zugzwang` reaches the branch with real
		// data, asserted above.
		// ⚠ THIS ARM IS STILL WANTED, AND FOR A SHARPER REASON THAN BEFORE. It is
		// the one that survives the map being emptied again by a future ruling —
		// at which point the real arm above goes green by having nothing to
		// assert, and this is all that stops the override path becoming untested
		// code that looks tested. It also asserts the LEADING is resolved away,
		// which the real entry cannot show: that entry's leading is identical to
		// the base's, so there is nothing to displace. A synthetic value that
		// differs in BOTH groups is what exercises both halves of twMerge.
		// ⚠ `doMock` + `resetModules` + a dynamic import, rather than a top-level
		// `vi.mock`: the latter is hoisted to the whole FILE and would replace the
		// real map for the three tests above, every one of which exists to assert
		// against the real one. Same pattern, same reason, as the synthetic entry
		// in `resolver-cards.test.tsx`.
		// ⚠ The size is deliberately NOT the value the removed ruling used. It is
		// an obviously-synthetic one, so that if it ever appears on staging the
		// mock has leaked into a real render path.
		// ⛔⛔ ASSEMBLED AT RUNTIME, NOT WRITTEN AS A LITERAL, AND THAT IS NOT
		// STYLE. Tailwind v4's scanner reads `tests/` as well as `src/`
		// (AGENTS.md §8), so a class-shaped literal in THIS FILE becomes a real
		// emitted utility in the built stylesheet with no component behind it —
		// at which point the built sheet stops being evidence of what components
		// use. Measured before choosing this shape: the 17px size happens to have
		// four live consumers in `src/` and would have emitted nothing new, but
		// the 1.31 leading has NONE and would have.
		// ⛔⛔ AND THIS COMMENT USED TO SPELL THE SIZE OUT, WHICH MADE THE COMMENT
		// ITSELF THE LEAK IT DESCRIBES. Measured with `@tailwindcss/oxide`'s
		// Scanner (AGENTS.md §8's own method): this file emitted the 17px size
		// utility from THE PROSE, not from the assembled constant below — so the
		// claim "split so neither is scannable" was false for one of the two.
		// ⚠ AND THE FIRST CORRECTION RE-INTRODUCED IT, by quoting the offending
		// class inside the sentence explaining that it must not be quoted. The
		// Scanner caught that too. There is no way to name one of these safely in
		// prose: describe it, or emit it.
		// Harmless here in itself, since that size has four live `src/` consumers;
		// the cost is the next reader copying the pattern with a class that has
		// none. Both halves are now described rather than written.
		const SZ = `text-[${17}px]`;
		const LD = `leading-[${1.31}]`;
		const SYNTHETIC = `${SZ} ${LD}`;
		vi.resetModules();
		vi.doMock("@/components/debate/title-size-overrides", () => ({
			MARKET_TITLE_SIZE_OVERRIDES: { [CONTROL_SLUG]: SYNTHETIC },
		}));
		try {
			const { MarketHeader: Isolated } = await import(
				"@/components/debate/MarketHeader"
			);
			const { container } = render(
				<Isolated market={market(CONTROL_SLUG)} priceChart={null} />,
			);
			const cls = headingOf(container, CONTROL_SLUG);

			expect(cls).toContain(SZ);
			// The leading travels with the size, or the type shrinks and the line
			// box does not.
			expect(cls).toContain(LD);
			// ⛔ THE HALF THAT MATTERS. The base must be RESOLVED AWAY by twMerge,
			// not merely out-ranked by source order — two font sizes on one element
			// render at the larger, which is the clip this mechanism exists to stop.
			expect(cls).not.toContain(BASE_SIZE);
			expect(cls).not.toContain(LEADING);
		} finally {
			vi.doUnmock("@/components/debate/title-size-overrides");
			vi.resetModules();
		}
	});
});
