// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { MarketHeader } from "@/components/debate/MarketHeader";
import type { DebateMarketHeader } from "@/components/debate/types";

/**
 * POLISH.3 PR 1 items 2 + 3 — the market header's attrs strip.
 *
 * RED-FIRST driver (CLAUDE.md §5.6) for two defects that ship together on one
 * line of `MarketHeader.tsx`:
 *   - PD-3-07 / D2 — the Đ glyph renders UNSPACED here (`Đ150`) where Discovery
 *     (`StatLine.tsx`) and the composer (`ReplySplitBar.tsx`) render `Đ 150`.
 *     ⚠ SITE 1 OF 5 ONLY. `ReplyCard` · `ArgProfile` · `AggregateFooter` ×2 are
 *     PR 2's and are NOT guarded here — PD-3-07 stays OPEN for exactly that.
 *   - PD-3-08 — the counts are bare interpolations with no plural rule, so a
 *     market with one post reads `1 posts`. The shipped reference
 *     implementation is `StatLine.tsx`, pinned at
 *     `tests/unit/discovery/render/stat-line.test.tsx`, where zero is PLURAL.
 *
 * ⚠ WHY EVERY QUERY HERE IS TARGETED, and why that is a decision rather than a
 * style. C5 removes the dev placeholder box from this same component one commit
 * later. A `container.innerHTML` pin, a snapshot, or a container-wide
 * `textContent` assertion would sweep that box in and go RED on C5 — turning a
 * two-line copy guard into a tripwire for an unrelated deletion. Asserting on
 * the three spans by their own text keeps this file green across C5 BY
 * CONSTRUCTION. Do not "strengthen" these into a whole-container assertion.
 *
 * ⚠ THE STAKED VALUE IS DERIVED, NOT CARRIED IN. `150` is what
 * `formatDharma` returns for this fixture's `dharmaStaked`, read off the
 * `MarketHeader` fixture in `price-chart.test.tsx` — the only other file that
 * renders this component. A literal borrowed from Discovery's hero fixture
 * would name a value this surface never renders and so could not discriminate.
 * The assertion that matters is THE SPACE, not the number.
 *
 * No jest-dom in this repo (AGENTS.md §9) — plain DOM assertions only.
 */

afterEach(cleanup);

const market = (postCount: number, replyCount: number): DebateMarketHeader => ({
	id: "0190c0de-2222-7000-8000-000000000002",
	slug: "attrs-strip-market",
	title: "Attrs Strip Market Question",
	description: "Resolution criterion text.",
	status: "Open",
	pricing: { yes: "0.500000000000000000", no: "0.500000000000000000" },
	unitToWin: { yes: "1.960000000000000000", no: "1.960000000000000000" },
	totals: {
		dharmaStaked: "150.000000000000000000",
		postCount,
		replyCount,
	},
});

describe("POLISH.3 — MarketHeader attrs strip", () => {
	it("market-header::staked-renders-the-SPACED-Đ-form", () => {
		render(<MarketHeader market={market(3, 5)} priceChart={null} />);

		// The space is the whole assertion (§18 C-1).
		expect(screen.getByText("Đ 150 staked")).toBeTruthy();
		// The failure mode this exists for — the unspaced form must be gone.
		expect(screen.queryByText("Đ150 staked")).toBeNull();
	});

	it("market-header::singular-count-takes-singular-noun", () => {
		render(<MarketHeader market={market(1, 1)} priceChart={null} />);

		expect(screen.getByText("1 post")).toBeTruthy();
		expect(screen.getByText("1 reply")).toBeTruthy();
		// The failure mode this exists for.
		expect(screen.queryByText("1 posts")).toBeNull();
		expect(screen.queryByText("1 replies")).toBeNull();
	});

	it("market-header::zero-and-plural-counts-take-plural-noun", () => {
		render(<MarketHeader market={market(0, 0)} priceChart={null} />);

		// Zero is PLURAL — `0 replies`, never `0 reply`. StatLine does the same.
		expect(screen.getByText("0 posts")).toBeTruthy();
		expect(screen.getByText("0 replies")).toBeTruthy();
		expect(screen.queryByText("0 post")).toBeNull();
		expect(screen.queryByText("0 reply")).toBeNull();

		cleanup();
		render(<MarketHeader market={market(3, 5)} priceChart={null} />);
		expect(screen.getByText("3 posts")).toBeTruthy();
		expect(screen.getByText("5 replies")).toBeTruthy();
	});
});

/**
 * POLISH.3 PR 2 · C3 — row T1, Tier B-1: the RESOLUTION overline + its hairline
 * container (`d5:467-471`, `.criterion` / `.overline` / `.crittext`).
 *
 * ⚠ THE PLAN NAMES C3's RISK AS **FABRICATION** (§9), because this commit writes
 * the artifact and then its proof. The mitigation is that every value asserted
 * below is READ OFF THE MOCKUP — `d5:468-469`'s `.overline` rule — and not off
 * the component. A test that mirrored whatever the component happened to emit
 * would pass on the earlier, WRONG `8px / .12em` recipe, which came from reading
 * `.poslab` (`d5:556`) and `.colstk .lab` (`d5:614`) and generalising across
 * ROLES. The family shares weight (800), transform (uppercase) and colour (n4)
 * and NOTHING else — `.reslabel` (`d5:483`) is a third pair again, 8px/.14em.
 *
 * ⚠ EVERY QUERY IS TARGETED (PF-3), for the reason this file's header already
 * gives: a `container.innerHTML` pin or a snapshot here would sweep in unrelated
 * neighbours and turn a copy guard into a tripwire.
 *
 * ⛔ THE NEGATIVE ASSERTION IS A RULING, NOT A MIRROR. `.crittext` carries
 * `-webkit-line-clamp:2` in the mockup and it is filed BUCKET D (§17 H-T1(c)):
 * `market.description` is the resolution criterion — the terms of the bet — and
 * clamping it with no affordance is the exact defect class PD-0-01/R4 is
 * removing from post cards in this same PR. Pinned so a later reader cannot
 * "restore fidelity" by adopting it.
 */
describe("POLISH.3 PR 2 — T1, the RESOLUTION overline", () => {
	it("market-header::overline-labels-the-criterion", () => {
		render(<MarketHeader market={market(3, 5)} priceChart={null} />);

		// The mockup's own source text is "Resolution"; `uppercase` does the
		// rendering, so the DOM text is title case BY DESIGN (`d5:975`).
		expect(screen.getByText("Resolution")).toBeTruthy();
	});

	it("market-header::overline-carries-the-ruled-d5-recipe", () => {
		render(<MarketHeader market={market(3, 5)} priceChart={null} />);

		const className =
			screen.getByText("Resolution").getAttribute("class") ?? "";

		// `.overline{font-size:9.5px;font-weight:800;letter-spacing:.14em;
		//            text-transform:uppercase;color:var(--n4);}`  — d5:468-469
		expect(className).toContain("text-[9.5px]");
		expect(className).toContain("font-extrabold");
		expect(className).toContain("tracking-[.14em]");
		expect(className).toContain("uppercase");
		// Ported BY TOKEN — a raw hex here also reddens no-raw-hex-view-layer.
		expect(className).toContain("text-n4");

		// The superseded recipe, pinned as gone. It was WRONG, and it was wrong
		// by generalising across roles rather than by a typo.
		expect(className).not.toContain("text-[8px]");
		expect(className).not.toContain("tracking-[.12em]");
	});

	it("market-header::criterion-container-is-a-hairline-rule-not-a-card", () => {
		render(<MarketHeader market={market(3, 5)} priceChart={null} />);

		const container = screen.getByText("Resolution").parentElement;
		const className = container?.getAttribute("class") ?? "";

		// `.criterion{margin-top:12px;border-top:var(--hairline);padding-top:10px}`
		// — a TOP RULE, never a boxed card. The 12px margin is carried by the
		// section's own `gap-3`.
		expect(className).toContain("[border-top:var(--hairline)]");
		expect(className).toContain("pt-2.5");
	});

	it("market-header::criterion-is-NOT-clamped-and-carries-no-affordance", () => {
		render(<MarketHeader market={market(3, 5)} priceChart={null} />);

		const container = screen.getByText("Resolution").parentElement;

		// H-T1(c) — bucket D. Unclamped IS the status quo; the mockup would be
		// INTRODUCING a truncation of the bet terms.
		expect(container?.innerHTML).not.toContain("line-clamp");
		expect(container?.innerHTML).not.toContain("truncate");
		// And no "more"/expand control — "criterion length treatment" is
		// docketed to HEADER-3ZONE, not decided here.
		expect(container?.querySelector("button")).toBeNull();
		// The criterion text itself still renders, in full.
		expect(container?.innerHTML).toContain("Resolution criterion text.");
	});
});

/**
 * HTML-FINISH · MARKET DETAIL row 6 — the left column's READING ORDER.
 *
 * The mockup's `.hstack` orders its `vm` children `.question` → `.attrs` →
 * `.criterion` → `.rescards` (`d5:958-985`). The build rendered the attrs strip
 * LAST, below the chart and the price bar. The row is about order and nothing
 * else, so this asserts order and nothing else.
 *
 * ⚠ WHY THIS IS NOT THE WHOLE-CONTAINER ASSERTION THIS FILE'S HEADER FORBIDS.
 * The caution above is against snapshots and `container.innerHTML` EQUALITY —
 * shapes that go red when an unrelated neighbour moves. This compares the
 * INDEX of three markers that are each this component's own subject, so C4's
 * chart move and C6's price-bar move pass straight through it. A pin that
 * cannot survive its own plan's next two commits is a tripwire, not a guard.
 *
 * ⚠ O-7 — `innerHTML`, never `textContent`. Order is a property of the markup.
 */
describe("HTML-FINISH · MARKET DETAIL — row 6, the left column's order", () => {
	it("market-header::question-then-attrs-then-criterion", () => {
		const { container } = render(
			<MarketHeader market={market(3, 5)} priceChart={null} />,
		);

		const left = container.querySelector('[data-testid="headzone-left"]');
		const html = left?.innerHTML ?? "";
		expect(html).not.toBe("");

		const question = html.indexOf("Attrs Strip Market Question");
		const attrs = html.indexOf("Đ 150 staked");
		const criterion = html.indexOf("Resolution criterion text.");

		// All three present — an absent marker indexes to -1 and would otherwise
		// satisfy the ordering below by accident.
		expect(question).toBeGreaterThan(-1);
		expect(attrs).toBeGreaterThan(-1);
		expect(criterion).toBeGreaterThan(-1);

		expect(question).toBeLessThan(attrs);
		expect(attrs).toBeLessThan(criterion);
	});
});

/**
 * HTML-FINISH · MARKET DETAIL row 4 — the price chart occupies the RAIL.
 *
 * The mockup's `.hright` holds exactly `.graph` + `.barrow f` in the market arm
 * (`d5:1007`, `:1037`). The chart used to render in the LEFT column, between
 * the criterion and the price bar, which put the market's shape inside the
 * reading column instead of beside it.
 *
 * ⚠ THE NULL PATH IS PART OF THE ROW, not a separate concern. A null
 * `priceChart` was already non-fatal — the rest of the header stands
 * (`price-chart.test.tsx` pins that). Now it also means NO RAIL NODE, because
 * an empty 25% column is visible empty chrome (PD-3-09). Both halves are
 * asserted so a later commit cannot satisfy one by breaking the other.
 *
 * ⚠ Declared locally rather than imported, following `price-chart.test.tsx`:
 * the shape is two fields and a local literal keeps this file free of a server
 * module path it does not otherwise need.
 */
type PricePointFixture = { at: string; yes: string };

const CHART_SERIES: PricePointFixture[] = [
	{ at: "2026-07-01T00:00:00.000Z", yes: "0.500000000000000000" },
	{ at: "2026-07-02T00:00:00.000Z", yes: "0.600000000000000000" },
];

describe("HTML-FINISH · MARKET DETAIL — row 4, the chart moves to the rail", () => {
	it("market-header::the-chart-renders-in-the-rail-not-the-left-column", () => {
		const { container } = render(
			<MarketHeader
				market={market(3, 5)}
				priceChart={{ series: CHART_SERIES, nodes: [] }}
			/>,
		);

		const left = container.querySelector('[data-testid="headzone-left"]');
		const right = container.querySelector('[data-testid="headzone-right"]');

		expect(right).not.toBeNull();
		// The collapsed card is IN the rail …
		expect(right?.innerHTML).toContain('data-testid="market-price-chart-card"');
		// … and is NOT still in the reading column. Asserting only the first half
		// would pass on a header that rendered the chart TWICE.
		expect(left?.innerHTML).not.toContain(
			'data-testid="market-price-chart-card"',
		);
	});

	it("market-header::a-null-series-drops-the-CHART-not-the-rail", () => {
		const { container } = render(
			<MarketHeader market={market(3, 5)} priceChart={null} />,
		);

		// ⚠ RE-DERIVED AT C6, NOT RELAXED. At C4 the chart was the rail's only
		// occupant, so a null series meant no rail node at all. C6 moved the
		// price bar in beside it, and `PriceBar` renders its "Pricing
		// unavailable" stub rather than null — so on the market arm the rail is
		// now ALWAYS occupied and a null series means "no CHART", never "no
		// rail". The PD-3-09 property that mattered (never an EMPTY rail) is
		// unchanged and is still pinned, one assertion down.
		const right = container.querySelector('[data-testid="headzone-right"]');
		expect(right).not.toBeNull();
		expect(right?.innerHTML).not.toContain(
			'data-testid="market-price-chart-card"',
		);
		// The rail is occupied, not empty — the price bar is in it.
		expect(right?.innerHTML).toContain("YES 50%");
		// …and the left column still stands, the pre-existing non-fatal contract.
		expect(
			container.querySelector('[data-testid="headzone-left"]')?.innerHTML,
		).toContain("Attrs Strip Market Question");
	});
});

/**
 * HTML-FINISH · MARKET DETAIL — the price bar occupies the RAIL, under the
 * chart.
 *
 * `.hright` holds `.graph` then `.barrow f` (`d5:1007`, `:1037`). The bar and
 * the chart read the SAME price, so standing them in one column is what lets a
 * reader check one against the other.
 *
 * ⚠ THIS IS THE PLACEMENT HALF ONLY. Row 7 — collapsing `detail` to d5's
 * one-row `.barrow` — was BACKED OUT: `PriceBar`'s detail render is byte-pinned
 * by `tests/unit/discovery/render/price-bar-presets.test.tsx`, which is outside
 * this task's ratified allow-list. Placement is `MarketHeader`'s and is in
 * scope; the bar's internal shape is not. See `PriceBar.tsx`'s docblock.
 */
describe("HTML-FINISH · MARKET DETAIL — the price bar sits in the rail", () => {
	it("market-header::the-price-bar-renders-in-the-rail", () => {
		const { container } = render(
			<MarketHeader
				market={market(3, 5)}
				priceChart={{ series: CHART_SERIES, nodes: [] }}
			/>,
		);

		const left = container.querySelector('[data-testid="headzone-left"]');
		const right = container.querySelector('[data-testid="headzone-right"]');

		expect(right?.innerHTML).toContain("YES 50%");
		expect(right?.innerHTML).toContain("NO 50%");
		// And it is not ALSO left behind in the reading column.
		expect(left?.innerHTML).not.toContain("YES 50%");

		// Order within the rail: chart above bar.
		const chart = right?.innerHTML.indexOf("market-price-chart-card") ?? -1;
		const bar = right?.innerHTML.indexOf("YES 50%") ?? -1;
		expect(chart).toBeGreaterThan(-1);
		expect(bar).toBeGreaterThan(chart);
	});
});
