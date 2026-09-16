// @vitest-environment jsdom

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { MarketHeader } from "@/components/debate/MarketHeader";
import { MARKET_TITLE_SIZE_OVERRIDES } from "@/components/debate/title-size-overrides";
import type { DebateMarketHeader } from "@/components/debate/types";

/**
 * The per-market title-size override reaches the heading, and reaches ONLY the
 * market it was ruled for.
 *
 * The override is founder-ruled per market and is deliberately not a length rule
 * (`title-size-overrides.ts` carries the ruling and the measurement that chose
 * 19px). What can go wrong in code is narrow and has two directions, so both are
 * asserted: the entry fails to reach the heading at all, or it reaches every
 * heading. **The control arm is not decoration** — "Mumbai renders `text-[19px]`"
 * is equally satisfied by a component that hard-codes 19px for everyone, so
 * without the second arm this file would certify the exact defect the ruling
 * forbids.
 *
 * ⚠ THE ASSERTION IS ON THE COMPOSED CLASS, WHICH IS THE ONE THING THAT COULD
 * SILENTLY NOT HAPPEN. The override is merged by `cn()` (twMerge), which resolves
 * the font-size and line-height groups and keeps the last of each. That
 * resolution is a library behaviour, not ours — if a future `tailwind-merge`
 * stopped classifying an arbitrary `text-[19px]` as a font-size, BOTH sizes would
 * land on the element, the larger would win by source order, and the heading
 * would clip again with nothing erroring. Asserting the ABSENCE of `text-[21px]`
 * on the Mumbai arm is what catches that; asserting its presence alone would not.
 *
 * ⚠ THE LEADING IS ASSERTED ALONGSIDE THE SIZE, AND NOT AS A SECOND NICETY. An
 * arbitrary `text-[Npx]` does not reset the line-height paired with the `text-*`
 * step in scope (AGENTS.md §8), so a size-only override is a real and quiet
 * failure mode — the type shrinks and the leading does not follow it.
 *
 * ⚠ jsdom performs no layout, so this file pins the CLASS and makes no claim
 * about the rendered width. The width measurement that chose 19px was taken in a
 * real browser against the live staging build and lives in the override file's
 * docblock; it is not reproducible here and is not attempted here.
 *
 * ⚠ BOTH slugs must be live markets — `ResolverCards` throws on an unknown one
 * (BLOCK-1 G1), so a made-up control slug would fail for the wrong reason.
 *
 * No jest-dom in this repo (AGENTS.md §9) — plain DOM assertions only.
 */

afterEach(cleanup);

/** The market this override was ruled for: a 65-char title that clipped at 21px. */
const OVERRIDDEN_SLUG = "mumbai-bmc-pink-october-disclosure";
/** A live market with no entry in the map — the arm that proves the scoping. */
const CONTROL_SLUG = "bitcoin-price-50k";

const market = (slug: string): DebateMarketHeader => ({
	id: "0190c0de-2222-7000-8000-000000000002",
	slug,
	title: "Mumbai · Will BMC report 10,000 Pink October breast cancer tests?",
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

const headingClasses = (slug: string): string => {
	const { container } = render(
		<MarketHeader market={market(slug)} priceChart={null} />,
	);
	const h1 = container.querySelector('[data-testid="headzone-stack"] h1');
	if (!h1) throw new Error(`no market-question <h1> rendered for ${slug}`);
	return h1.className;
};

describe("MarketHeader — per-market title size override", () => {
	it("market-header::override-applies-on-the-ruled-slug", () => {
		const cls = headingClasses(OVERRIDDEN_SLUG);

		expect(cls).toContain("text-[19px]");
		// The leading travels with the size, or the type shrinks and the line
		// box does not.
		expect(cls).toContain("leading-[1.24]");
		// The base must be RESOLVED AWAY, not merely out-ranked by source order.
		expect(cls).not.toContain("text-[21px]");
	});

	it("market-header::override-does-not-apply-on-a-control-slug", () => {
		expect(MARKET_TITLE_SIZE_OVERRIDES[CONTROL_SLUG]).toBeUndefined();

		const cls = headingClasses(CONTROL_SLUG);

		expect(cls).toContain("text-[21px]");
		expect(cls).toContain("leading-[1.24]");
		expect(cls).not.toContain("text-[19px]");
	});
});
