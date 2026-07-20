// @vitest-environment jsdom

import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
	within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
	DiscoveryCarousel,
	type DiscoveryMarketView,
} from "@/components/discovery/DiscoveryCarousel";
import type { HeroTopPosts } from "@/server/discovery/hero";
import type { PricePoint } from "@/server/discovery/price-series";

import { EXTENDED, TITLE } from "../../composer/render/_harness";

/**
 * UI.A4 Slice 5 (plan §2 row 5 / §4 / §5) — DiscoveryCarousel, the ONE
 * client-motion piece, under the design-canon §5 verbatim law: one shared
 * index 0..n−1 drives hero + grid ring + active dot IN SYNC; auto-advance
 * every 10s ((i+1) % n — the straight wrap over the AVAILABLE set); the
 * countdown resets on ANY index change (timer-driven or manual); `‹`/`›`
 * advance immediately and reset (aria copy canon §6; arrows only when
 * n > 1); a single market is STATIC — the client half of the §17-registry
 * `hero-single-market-static` row (the server half landed at Slice 3). The
 * active dot ALONE carries the `dot-fill` countdown element; `:has()` is
 * BANNED (canon §3.10) — JS-toggled classes/attrs only. Sparse sets shrink
 * with NO placeholders, and the Slice-4 carried LOW folds in here as the
 * anchor census (n whole-card links + market 1's 2 hero-post deep-links + its
 * 2 hero-author profile links, UI.A5 A4 follow-up #2).
 * Fixture labels are the shipped scaffold style ("Discovery Market N" /
 * `fixture-market-N`); hero prose reuses the composer-harness strings —
 * never invented market content (CLAUDE.md §3). Fake timers per test;
 * `fireEvent` (never userEvent) under fake timers; timer advances wrapped
 * in `act`.
 */

beforeEach(() => {
	vi.useFakeTimers();
});

afterEach(() => {
	cleanup();
	vi.useRealTimers();
});

const SEED_SERIES: PricePoint[] = [
	{ at: "2026-07-01T00:00:00.000Z", yes: "0.500000000000000000" },
];

/** Market 1's hero posts — BOTH sides present (the rest rotate side-empty). */
const HERO_TOP_POSTS: HeroTopPosts = {
	yes: {
		id: "0190b3a0-9999-7000-8000-00000000000a",
		ordinal: 1,
		side: "YES",
		title: TITLE,
		teaser: EXTENDED,
		author: { pseudonym: "hero-yes-author", pfpUrl: "/pfp-placeholder.svg" },
		authorStake: "40.000000000000000000",
		createdAt: "2026-07-01T00:00:00.000Z",
	},
	no: {
		id: "0190b3a0-9999-7000-8000-00000000000b",
		ordinal: 2,
		side: "NO",
		title: TITLE,
		teaser: EXTENDED,
		author: { pseudonym: "hero-no-author", pfpUrl: "/pfp-placeholder.svg" },
		authorStake: "35.000000000000000000",
		createdAt: "2026-07-01T00:01:00.000Z",
	},
};

/** n distinct DiscoveryMarketView literals: "Discovery Market 1…n". */
function views(n: number): DiscoveryMarketView[] {
	return Array.from({ length: n }, (_, i): DiscoveryMarketView => {
		const ordinal = i + 1;
		const first = i === 0;
		return {
			card: {
				id: `0190b3a0-9999-7000-8000-${String(ordinal).padStart(12, "0")}`,
				slug: `fixture-market-${ordinal}`,
				title: `Discovery Market ${ordinal}`,
				pricing: { yes: "0.380000000000000000", no: "0.620000000000000000" },
				totals: {
					dharmaStaked: first
						? "75.000000000000000000"
						: "0.000000000000000000",
					postCount: first ? 2 : 0,
					replyCount: 0,
				},
				imageUrl: null,
			},
			series: SEED_SERIES,
			topPosts: first ? HERO_TOP_POSTS : { yes: null, no: null },
		};
	});
}

/**
 * The ONE-shared-index law (canon §2/§5): the active dot, the grid ring,
 * and the hero market must move as a single index — assert all three
 * surfaces at once.
 */
function expectActive(index: number): void {
	const dots = screen.getAllByTestId("carousel-dot");
	const activeDots = dots.filter(
		(d) => d.getAttribute("data-active") === "true",
	);
	expect(activeDots).toHaveLength(1);
	expect(dots.indexOf(activeDots[0])).toBe(index);

	const cards = screen.getAllByTestId("market-card");
	const activeCards = cards.filter(
		(c) => c.getAttribute("data-active") === "true",
	);
	expect(activeCards).toHaveLength(1);
	expect(cards.indexOf(activeCards[0])).toBe(index);

	// The ring VISUAL (code-review HIGH fold): exactly one grid-ring wrapper
	// is active and carries an outline class — the state attr alone is not a
	// ring (canon §2: hero + posts + grid OUTLINE RING + dot move in sync).
	const rings = screen.getAllByTestId("grid-ring");
	const activeRings = rings.filter(
		(r) => r.getAttribute("data-active") === "true",
	);
	expect(activeRings).toHaveLength(1);
	expect(rings.indexOf(activeRings[0])).toBe(index);
	expect(activeRings[0].getAttribute("class") ?? "").toContain("outline");
	for (const r of rings) {
		if (r !== activeRings[0]) {
			expect(r.getAttribute("class") ?? "").not.toContain("outline");
		}
	}

	const hero = within(screen.getByTestId("hero-panels"));
	expect(hero.getByText(`Discovery Market ${index + 1}`)).toBeTruthy();
}

describe("UI.A4 §5 — DiscoveryCarousel (canon §5 motion)", () => {
	it("render::ten-second-auto-advance", () => {
		render(<DiscoveryCarousel markets={views(3)} />);
		expect(screen.getByTestId("discovery-carousel")).toBeTruthy();
		// t0: index 0 across all three synced surfaces.
		expectActive(0);
		// 9,999ms — one ms short of the canon §5 10s period: no advance.
		act(() => {
			vi.advanceTimersByTime(9_999);
		});
		expectActive(0);
		// The 10,000th ms fires the advance — dot, ring, hero move TOGETHER.
		act(() => {
			vi.advanceTimersByTime(1);
		});
		expectActive(1);
		// A further full period advances again: 1 → 2.
		act(() => {
			vi.advanceTimersByTime(10_000);
		});
		expectActive(2);
	});

	it("render::arrows-advance-immediately-and-reset", () => {
		render(<DiscoveryCarousel markets={views(3)} />);
		// aria copy EXACT (canon §6) — getByLabelText is a full-string match.
		const next = screen.getByLabelText("Next market");
		const prev = screen.getByLabelText("Previous market");
		// Mid-countdown (t = 7s), › advances IMMEDIATELY…
		act(() => {
			vi.advanceTimersByTime(7_000);
		});
		fireEvent.click(next);
		expectActive(1);
		// …and RESETS: the discarded t0 countdown would have fired 3s from
		// now. 9,999ms (one short of a FRESH 10s from the click) must not
		// advance…
		act(() => {
			vi.advanceTimersByTime(9_999);
		});
		expectActive(1);
		// …and the very next ms completes the fresh countdown: 1 → 2.
		act(() => {
			vi.advanceTimersByTime(1);
		});
		expectActive(2);
		// ‹ steps back immediately, twice: 2 → 1 → 0.
		fireEvent.click(prev);
		expectActive(1);
		fireEvent.click(prev);
		expectActive(0);
	});

	it("render::straight-eight-wrap", () => {
		render(<DiscoveryCarousel markets={views(8)} />);
		expect(screen.getAllByTestId("carousel-dot")).toHaveLength(8);
		const prev = screen.getByLabelText("Previous market");
		const next = screen.getByLabelText("Next market");
		// ‹ at index 0 wraps backward to n−1 = 7.
		fireEvent.click(prev);
		expectActive(7);
		// › at 7 wraps forward to 0.
		fireEvent.click(next);
		expectActive(0);
		// Auto-advance rides the SAME straight ring: park at 7 (7 × ›), then
		// one full period wraps 7 → 0.
		for (let k = 0; k < 7; k += 1) {
			fireEvent.click(next);
		}
		expectActive(7);
		act(() => {
			vi.advanceTimersByTime(10_000);
		});
		expectActive(0);
	});

	it("render::hero-single-market-static", () => {
		render(<DiscoveryCarousel markets={views(1)} />);
		// No arrows at n = 1 (rendered ONLY when n > 1).
		expect(screen.queryByLabelText("Previous market")).toBeNull();
		expect(screen.queryByLabelText("Next market")).toBeNull();
		// Exactly one dot, active.
		const dots = screen.getAllByTestId("carousel-dot");
		expect(dots).toHaveLength(1);
		expect(dots[0].getAttribute("data-active")).toBe("true");
		// NO auto-advance — three full periods later the hero is unmoved
		// (the §17 `hero-single-market-static` client half; F-DISC-2).
		act(() => {
			vi.advanceTimersByTime(30_000);
		});
		expectActive(0);
	});

	it("render::dot-fill-on-active-only", () => {
		const { container } = render(<DiscoveryCarousel markets={views(3)} />);
		// Exactly ONE countdown fill, inside the active dot (index 0).
		const fills = screen.getAllByTestId("dot-fill");
		expect(fills).toHaveLength(1);
		const dots = screen.getAllByTestId("carousel-dot");
		expect(dots[0].getAttribute("data-active")).toBe("true");
		expect(dots[0].contains(fills[0])).toBe(true);
		// After an auto-advance: still exactly one, now inside the NEW
		// active dot — inactive dots carry none.
		act(() => {
			vi.advanceTimersByTime(10_000);
		});
		const fillsAfter = screen.getAllByTestId("dot-fill");
		expect(fillsAfter).toHaveLength(1);
		const dotsAfter = screen.getAllByTestId("carousel-dot");
		expect(dotsAfter[1].getAttribute("data-active")).toBe("true");
		expect(dotsAfter[1].contains(fillsAfter[0])).toBe(true);
		// Canon §3.10 — `:has()` BANNED; JS-toggled classes/attrs only. No
		// class string anywhere in the tree may carry it (`getAttribute`
		// rather than `.className` — SVG className is an object at runtime).
		for (const el of Array.from(container.querySelectorAll("*"))) {
			expect(el.getAttribute("class") ?? "").not.toContain(":has(");
		}
	});

	it("render::sparse-shrink-no-placeholders", () => {
		const { container } = render(<DiscoveryCarousel markets={views(3)} />);
		// Exactly the available set — no placeholder cards, no phantom dots.
		expect(screen.getByTestId("discovery-grid")).toBeTruthy();
		expect(screen.getAllByTestId("market-card")).toHaveLength(3);
		expect(screen.getAllByTestId("carousel-dot")).toHaveLength(3);
		// Anchor census: n whole-card links + market 1's TWO hero-post
		// deep-links + market 1's TWO hero-author profile links (UI.A5 A4
		// follow-up #2); the hero market panel + side-empty panels carry ZERO.
		// n=3 → 3 + 2 + 2 = 7.
		expect(container.querySelectorAll("a")).toHaveLength(7);
	});

	it("render::empty-views-render-nothing", () => {
		const { container } = render(<DiscoveryCarousel markets={[]} />);
		// Empty set → the carousel renders NULL (the page renders EmptyState
		// instead — Slice 6's wiring).
		expect(container.firstChild).toBeNull();
	});
});
