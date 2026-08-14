// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { MarketCard } from "@/components/discovery/MarketCard";
import type { DiscoveryCard } from "@/server/discovery/list";

import { MARKET_ID, SLUG } from "../../composer/render/_harness";

/**
 * UI.A4 Slice 4 (plan §2 row 4 / §4) — the design-language §3.2 LOCKED card
 * composition: image thumb (alt `""` since PRIMITIVES-2 D4, which supersedes
 * the OQ-6 dynamic-alt rule at this site; null image → the canon §6 `IMG`
 * placeholder, no img element) ·
 * question · StatLine (the canon attrs grammar over the REUSED formatDharma)
 * · the REUSED debate PriceBar (F-6 — no fresh
 * bar; null pricing → its "Pricing unavailable" stub). One next/link anchor
 * wraps the whole card → `/m/[slug]`; `active` marks the carousel-ring hook
 * via `data-active="true"` AND carries the ring itself. Fixture labels are
 * the shipped server-suite scaffold ("Discovery Market" / `signed.test`,
 * tests/server/discovery/list.test.ts) — never invented market content.
 *
 * ⚠ HTML-FINISH rows 1/4/5 EDITED THIS SUITE. The card no longer renders a
 * `PriceSparkline` (row 1 — the mockup's tile is title-block + price bar with
 * nothing between), so the `series` prop and its fixture are gone; the thumb
 * row is `items-center` rather than `items-start` (row 5), which moves every
 * selector addressed to it; and the ring the grid used to wrap around the
 * card is now on the card's own root (row 4).
 */

afterEach(cleanup);

const MARKET_TITLE = "Discovery Market";
const IMAGE_URL = "https://signed.test/market-media/m/x/card.webp";

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
	it("render::locked-composition-image-title-bar-statline", () => {
		const { container } = render(<MarketCard card={cardFixture()} />);
		// Image thumb. ⚠ `alt` is `""` as of PRIMITIVES-2 D4 (PD-2-33) — the same
		// title renders in the adjacent <h3> below, so the thumb is decorative and
		// the duplicated announcement was also what overflowed the metadata row on
		// a broken load. This line previously read `screen.getByAltText(
		// MARKET_TITLE)`, pinning the superseded OQ-6 dynamic-alt rule; it is the
		// only assertion in the suite that D4 invalidates.
		//
		// Addressed to the thumb SLOT by POSITION (`firstElementChild`), not by
		// "the first <img> in the card": an image added anywhere else in this
		// composition later — an author avatar, a media badge — must not silently
		// retarget the two assertions below. Matches `thumbSlot()` in
		// market-thumb.test.tsx. ⚠ The row is `items-center` since HTML-FINISH
		// row 5 — the picture is centred against the title block, matching the
		// hero, which had shipped `items-center` all along.
		const img = container.querySelector(
			".items-center.gap-3",
		)?.firstElementChild;
		expect(img?.getAttribute("alt")).toBe("");
		expect(img?.getAttribute("src")).toBe(IMAGE_URL);
		// The question.
		expect(screen.getByText(MARKET_TITLE).textContent).toBe(MARKET_TITLE);
		// Stat line — formatDharma REUSED, and it GROUPS: every Đ value rendered
		// to a user groups its integer part in threes with a literal ASCII comma
		// (SPEC.1 §10.8, 1.0.29 — the same-commit rider). The pre-ruling `Đ 14260`
		// this line used to pin was a docket, not a baseline: discovery staked
		// totals rendered ungrouped beside composers that grouped.
		const statLine = screen.getByTestId("stat-line");
		const statText = statLine.textContent ?? "";
		expect(statText).toContain("Đ 14,260 staked");
		expect(statText).toContain("28 posts");
		expect(statText).toContain("68 replies");
		// HTML-FINISH row 1 — NO price chart on the tile. Asserted as an absence
		// here rather than only in the structure test below, because this is the
		// composition case: the locked composition is what changed.
		expect(screen.queryByTestId("price-sparkline")).toBeNull();
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
		expect(link.contains(bar)).toBe(true);
		expect(screen.getByTestId("market-card")).toBeTruthy();
	});

	it("render::null-image-renders-placeholder-no-img", () => {
		const { container } = render(
			<MarketCard card={cardFixture({ imageUrl: null })} />,
		);
		// No <img> element at all — the placeholder box replaces it, carrying
		// the canon §6 literal.
		expect(container.querySelector("img")).toBeNull();
		expect(screen.getByText("IMG").textContent).toBe("IMG");
	});

	it("render::null-pricing-renders-bar-stub", () => {
		render(<MarketCard card={cardFixture({ pricing: null })} />);
		// The PriceBar null-pricing stub — proves REUSE (F-6), not a fresh bar.
		expect(screen.getByText("Pricing unavailable").textContent).toBe(
			"Pricing unavailable",
		);
	});

	it("render::active-flag-marks-card", () => {
		const inactive = render(<MarketCard card={cardFixture()} />);
		// Default: nothing marked active, and NO ring.
		expect(inactive.container.querySelector('[data-active="true"]')).toBeNull();
		expect(
			screen.getByTestId("market-card").getAttribute("class") ?? "",
		).not.toContain("outline");
		inactive.unmount();

		const active = render(<MarketCard card={cardFixture()} active />);
		// HTML-FINISH row 4 — the state hook AND the ring are the SAME element
		// now: the card's own root. Previously the attribute was here and the
		// outline was on a wrapper `<div>` the grid supplied, so this assertion
		// could pass while the ring rendered on a different box.
		const marked = active.container.querySelector('[data-active="true"]');
		expect(marked).not.toBeNull();
		expect(marked).toBe(screen.getByTestId("market-card"));
		expect(marked?.getAttribute("class") ?? "").toContain(
			"[outline:var(--ring-active)]",
		);
	});

	// ── HTML-FINISH §4 · the ONE added structure test ────────────────────────
	// Precedent for this shape is this very file plus the nine other
	// `tests/unit/discovery/render/*.test.tsx` suites — jsdom via the per-file
	// docblock, plain-DOM assertions (no jest-dom in this repo). It pins
	// STRUCTURE ONLY for rows 1, 4 and 5: element presence, absence, nesting
	// and sibling order. It deliberately asserts NOTHING about class values,
	// text or numbers — those belong to the composition test above, and a
	// structure test that also pinned them would redden on any restyle.
	it("structure::html-finish-tile-is-title-block-then-price-bar", () => {
		const { container } = render(<MarketCard card={cardFixture()} active />);

		const card = screen.getByTestId("market-card");

		// Row 4 — the tile IS the outermost element the component renders; no
		// wrapper box stands between it and its parent grid cell.
		expect(container.firstElementChild).toBe(card);
		// …and it is the anchor itself, not a div containing one.
		expect(card.tagName).toBe("A");

		// The mockup's `.mcard` is exactly TWO children: `.qrow`, then
		// `.barrow m` (:269-282). Row 1 removed the chart that sat between them.
		const children = Array.from(card.children);
		expect(children).toHaveLength(2);

		// Sibling order: title block first, price bar last.
		const [titleBlock, barSlot] = children;
		expect(titleBlock.contains(screen.getByTestId("stat-line"))).toBe(true);
		expect(titleBlock.querySelector("h3")).not.toBeNull();
		expect(barSlot.contains(screen.getByRole("img"))).toBe(true);

		// Row 1 — no chart anywhere in the tile, by testid AND by element, so a
		// re-added sparkline that lost its testid still fails.
		expect(screen.queryByTestId("price-sparkline")).toBeNull();
		expect(card.querySelector("svg")).toBeNull();

		// Row 5 — the thumb and the title block are siblings inside the title
		// row, thumb first. Nesting + order only; the alignment VALUE is the
		// composition test's.
		const thumbRow = titleBlock;
		expect(thumbRow.children.length).toBe(2);
		expect(thumbRow.children[1].contains(screen.getByTestId("stat-line"))).toBe(
			true,
		);
	});
});
