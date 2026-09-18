// @vitest-environment jsdom

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MarketHeader } from "@/components/debate/MarketHeader";
import { RESOLUTION_BLOCKS } from "@/components/debate/resolution-block-data";
import { MARKET_TITLE_SIZE_OVERRIDES } from "@/components/debate/title-size-overrides";
import type { DebateMarketHeader } from "@/components/debate/types";

/**
 * The per-market title-size override mechanism, and the fact that no market
 * currently uses it.
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
 * So the three arms below are: the map is empty (the shipped state), every live
 * market therefore renders the base size (the scoping arm), and a SYNTHETIC
 * entry still reaches the heading and still resolves the base away (the
 * mechanism arm). The third is the one that would otherwise rot.
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
	it("market-header::the-override-map-is-empty", () => {
		// The shipped state after D-49. Stated as its own assertion so that
		// adding an entry without a ruling reddens here first, where the file
		// that explains the rule is one import away.
		expect(Object.keys(MARKET_TITLE_SIZE_OVERRIDES)).toEqual([]);
	});

	it("market-header::every-live-market-renders-the-base-size", () => {
		// ⛔ THE SCOPING ARM, SWEPT RATHER THAN SPOT-CHECKED. With the map empty
		// the interesting failure is no longer "the entry leaked to a second
		// market" — it is a component that hard-codes a size for somebody. One
		// market proves nothing about the others, so this walks all of them.
		let checked = 0;
		for (const slug of Object.keys(RESOLUTION_BLOCKS)) {
			const { container, unmount } = render(
				<MarketHeader market={market(slug)} priceChart={null} />,
			);
			const cls = headingOf(container, slug);
			expect(cls).toContain(BASE_SIZE);
			expect(cls).toContain(LEADING);
			checked += 1;
			unmount();
		}
		// ⛔ NON-VACUITY — an empty slug list would satisfy the loop above.
		expect(checked).toBe(6);
	});

	it("market-header::the-control-slug-has-no-entry-and-takes-the-base", () => {
		expect(MARKET_TITLE_SIZE_OVERRIDES[CONTROL_SLUG]).toBeUndefined();
		const cls = headingClasses(CONTROL_SLUG);
		expect(cls).toContain(BASE_SIZE);
		expect(cls).toContain(LEADING);
	});

	it("market-header::a-SYNTHETIC-entry-reaches-the-heading-and-resolves-the-base-away", async () => {
		// ⛔⛔ THE MECHANISM ARM, AND THE ONLY TEST LEFT THAT REACHES THE OVERRIDE
		// BRANCH AT ALL. No shipped market can reach it, so this mocks the map.
		// Without this arm the whole override path is untested code that looks
		// tested, and the twMerge behaviour the docblock above warns about would
		// regress silently — the heading would clip again and every other
		// assertion in this file would stay green.
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
