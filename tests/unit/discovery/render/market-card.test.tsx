// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { MarketCard } from "@/components/discovery/MarketCard";
import type { DiscoveryCard } from "@/server/discovery/list";
import type { PricePoint } from "@/server/discovery/price-series";

import { MARKET_ID, SLUG } from "../../composer/render/_harness";

/**
 * UI.A4 Slice 4 (plan §2 row 4 / §4) — the design-language §3.2 LOCKED card
 * composition: image thumb (alt = the market question, the OQ-6 dynamic-alt
 * rule; null image → the canon §6 `IMG` placeholder, no img element) ·
 * question · StatLine (the canon attrs grammar over the REUSED formatDharma)
 * · PriceSparkline (card size) · the REUSED debate PriceBar (F-6 — no fresh
 * bar; null pricing → its "Pricing unavailable" stub). One next/link anchor
 * wraps the whole card → `/m/[slug]`; `active` marks the carousel-ring hook
 * via `data-active="true"` (styling is Slice 5's concern). Fixture labels are
 * the shipped server-suite scaffold ("Discovery Market" / `signed.test`,
 * tests/server/discovery/list.test.ts) — never invented market content.
 */

afterEach(cleanup);

const MARKET_TITLE = "Discovery Market";
const IMAGE_URL = "https://signed.test/market-media/m/x/card.webp";

const SERIES: PricePoint[] = [
	{ at: "2026-07-01T00:00:00.000Z", yes: "0.500000000000000000" },
	{ at: "2026-07-01T00:01:00.000Z", yes: "0.700000000000000000" },
	{ at: "2026-07-01T00:02:00.000Z", yes: "0.400000000000000000" },
];

function cardFixture(overrides?: Partial<DiscoveryCard>): DiscoveryCard {
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
		imageUrl: IMAGE_URL,
		...overrides,
	};
}

describe("UI.A4 §4 — MarketCard (the §3.2 locked composition)", () => {
	it("render::locked-composition-image-title-sparkline-bar-statline", () => {
		const { container } = render(
			<MarketCard card={cardFixture()} series={SERIES} />,
		);
		// Image thumb — alt is the market QUESTION (OQ-6 dynamic-alt rule).
		const img = screen.getByAltText(MARKET_TITLE);
		expect(img.getAttribute("src")).toBe(IMAGE_URL);
		// The question.
		expect(screen.getByText(MARKET_TITLE).textContent).toBe(MARKET_TITLE);
		// Stat line — formatDharma REUSED (no thousands separators in v1).
		const statLine = screen.getByTestId("stat-line");
		const statText = statLine.textContent ?? "";
		expect(statText).toContain("Đ 14260 staked");
		expect(statText).toContain("28 posts");
		expect(statText).toContain("68 replies");
		// Sparkline in card size.
		const sparkline = screen.getByTestId("price-sparkline");
		expect(sparkline.getAttribute("data-size")).toBe("card");
		// The REUSED debate PriceBar (F-6): the role="img" bar named by both
		// percents, its literal-text pairing…
		const bar = screen.getByRole("img", { name: "YES 38%, NO 62%" });
		expect(screen.getByText("YES 38%").textContent).toBe("YES 38%");
		expect(screen.getByText("NO 62%").textContent).toBe("NO 62%");
		// …and the YES fill at the price-proportion width (bar-fill mapping).
		const fill = bar.firstElementChild;
		if (!(fill instanceof HTMLElement)) {
			throw new Error("expected the YES fill div inside the price bar");
		}
		expect(fill.style.width).toBe("38%");
		// ONE link wraps the whole card → /m/[slug].
		expect(container.querySelectorAll("a")).toHaveLength(1);
		const link = screen.getByRole("link");
		expect(link.getAttribute("href")).toBe(`/m/${SLUG}`);
		expect(link.contains(statLine)).toBe(true);
		expect(link.contains(sparkline)).toBe(true);
		expect(screen.getByTestId("market-card")).toBeTruthy();
	});

	it("render::null-image-renders-placeholder-no-img", () => {
		const { container } = render(
			<MarketCard card={cardFixture({ imageUrl: null })} series={SERIES} />,
		);
		// No <img> element at all — the placeholder box replaces it, carrying
		// the canon §6 literal.
		expect(container.querySelector("img")).toBeNull();
		expect(screen.getByText("IMG").textContent).toBe("IMG");
	});

	it("render::null-pricing-renders-bar-stub", () => {
		render(
			<MarketCard card={cardFixture({ pricing: null })} series={SERIES} />,
		);
		// The PriceBar null-pricing stub — proves REUSE (F-6), not a fresh bar.
		expect(screen.getByText("Pricing unavailable").textContent).toBe(
			"Pricing unavailable",
		);
	});

	it("render::active-flag-marks-card", () => {
		const inactive = render(
			<MarketCard card={cardFixture()} series={SERIES} />,
		);
		// Default: nothing marked active.
		expect(inactive.container.querySelector('[data-active="true"]')).toBeNull();
		inactive.unmount();
		const active = render(
			<MarketCard card={cardFixture()} series={SERIES} active />,
		);
		// The carousel ring hook (styling is Slice 5's concern).
		expect(
			active.container.querySelector('[data-active="true"]'),
		).not.toBeNull();
	});
});
