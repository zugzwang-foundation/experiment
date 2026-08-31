// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

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

// ⚠ BLOCK-1 — `slug` must be one of the eight known live markets or
// `ResolverCards` throws (G1). This file doesn't test ResolverCards'
// content, so the specific slug doesn't matter beyond being valid.
const market = (postCount: number, replyCount: number): DebateMarketHeader => ({
	id: "0190c0de-2222-7000-8000-000000000002",
	slug: "bitcoin-price-50k",
	title: "Attrs Strip Market Question",
	description: "Resolution criterion text.",
	status: "Open",
	mediaVideoUrl: null,
	mediaImageUrl: null,
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
 * RESO-1 · G-1 — THE CRITERION EXCERPT IS ABSENT FROM THE RENDERED DOM.
 *
 * ⚠⚠ THIS BLOCK REPLACES FOUR ASSERTIONS THAT PINNED THE OPPOSITE, and they are
 * recorded here rather than deleted (O-4). It was `POLISH.3 PR 2 · C3 — T1, the
 * RESOLUTION overline`, and it required: the overline to render
 * (`getByText("Resolution")`), to carry d5's `9.5px / 800 / .14em / uppercase /
 * n4` recipe, to sit in a `pt-2.5 [border-top:var(--hairline)]` container rather
 * than a boxed card, and — reversing its OWN earlier ruling — to carry
 * `line-clamp-2` while still exposing no expander button. That whole row is what
 * RESO-1 · R-1 and R-2 remove, so every one of those four is now a pin on a row
 * that does not exist.
 *
 * ⛔⛔ WHY THIS GUARD MUST NOT QUERY THE WORD `Resolution`, WHICH IS THE TRAP THE
 * OBVIOUS VERSION OF IT FALLS INTO. R-7 ships a block LABELLED `Resolution` in
 * the four-block row a few lines further down the same stack. So
 * `queryByText("Resolution")` is NON-NULL on the correct build — a guard written
 * that way would fail on the very change it is meant to certify, and, worse, the
 * inverse spelling (`expect(...).toBeNull()`) would go GREEN the day someone
 * restored the excerpt *without* its overline. The subject here is the
 * criterion's BODY TEXT, which is the thing that actually left.
 *
 * ⛔ AND IT CARRIES A POSITIVE CONTROL (OVN-V1). A `not.toContain` that returns
 * nothing is equally consistent with "the text is gone" and "my query never
 * looked at the right subtree". The control asserts the SAME query shape, over
 * the SAME container, against a string this fixture is known to render — so a
 * green here means the query works AND the excerpt is absent, rather than only
 * the second.
 */
describe("RESO-1 — R-2, the criterion excerpt is gone", () => {
	it("market-header::G-1-the-criterion-BODY-is-absent-from-the-DOM", () => {
		const { container } = render(
			<MarketHeader market={market(3, 5)} priceChart={null} />,
		);
		const left = container.querySelector('[data-testid="headzone-left"]');
		const html = left?.innerHTML ?? "";

		// ── POSITIVE CONTROL, FIRST. Same container, same `toContain` shape, on a
		// string the fixture DOES render. If this fails, the negative below proves
		// nothing and the failure says so at the right place.
		expect(html).toContain("Attrs Strip Market Question");
		expect(html).toContain("Đ 150 staked");

		// ── THE SUBJECT. `description` on this fixture is "Resolution criterion
		// text." — asserted by BODY, never by the `Resolution` label, for the
		// reason the docblock gives.
		expect(html).not.toContain("Resolution criterion text.");
		// The clamp was a class on that element, so it leaves with it. A surviving
		// `line-clamp-2` here would mean the row was hidden rather than removed.
		expect(html).not.toContain("line-clamp-2");
	});

	it("market-header::G-1-the-excerpt-is-gone-for-ANY-description-not-just-the-fixture-string", () => {
		// ⛔ NON-VACUITY, and it is not decoration: the assertion above names one
		// literal, so it would also pass on a component that rendered a DIFFERENT
		// description. This renders a description that shares NO substring with the
		// default fixture and asserts it too is absent — which distinguishes "the
		// excerpt is gone" from "that one string is gone".
		const distinctive = "ZZQQXX-criterion-marker-9471";
		const { container } = render(
			<MarketHeader
				market={{ ...market(3, 5), description: distinctive }}
				priceChart={null}
			/>,
		);
		expect(container.innerHTML).toContain("Attrs Strip Market Question"); // control
		expect(container.innerHTML).not.toContain(distinctive);
	});

	it("market-header::G-1-every-Resolution-label-belongs-to-a-BLOCK-not-a-section", () => {
		// R-1 — the SECTION label is gone, asserted structurally rather than by a
		// class spelling.
		// ⚠ THIS WAS `not.toContain("[border-top:var(--hairline)]")`, on the stated
		// premise that "the removed container was the ONLY hairline node in this
		// header". @test-writer flagged that the premise is unasserted and the
		// subtree is no longer solely this row's — `ResolverCards` lives there now
		// and a hairline is exactly what a four-block row acquires next. It was also
		// a SPELLING pin: `border-t border-n2` or an inline style evade it. Green
		// today, false-RED on the next styling pass, false-green the day the
		// spelling changes.
		// ⇒ THE REAL PROPERTY: the word `Resolution` still appears on this surface
		// (R-7 ships a block labelled it), and EVERY occurrence must belong to a
		// block. A surviving section label is an occurrence that does not.
		const { container } = render(
			<MarketHeader market={market(3, 5)} priceChart={null} />,
		);
		const left = container.querySelector('[data-testid="headzone-left"]');
		expect(left).not.toBeNull();
		const leaves = Array.from(left?.querySelectorAll("*") ?? []).filter(
			(e) => e.children.length === 0 && e.textContent?.trim() === "Resolution",
		);
		// CONTROL — the word IS rendered, so the loop below is not vacuous.
		expect(leaves.length).toBeGreaterThan(0);
		for (const el of leaves) {
			expect(el.closest('[data-testid^="resolution-block-"]')).not.toBeNull();
		}
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
/**
 * RESO-1 · R-3 — the meta line and the actions share ONE row, actions right.
 *
 * ⚠ THE FAILURE THIS EXISTS FOR IS "both still render", which is the assertion a
 * lazy version of this guard would make and which was ALREADY TRUE before R-3.
 * The subject is that they are SIBLINGS IN ONE CONTAINER, so the guard walks up
 * from each element to a common parent and asserts the relationship — never that
 * the two strings both appear somewhere.
 *
 * ⚠ O-7 — structure, never `textContent`. A row and a column flatten to the same
 * text, so a text assertion structurally cannot see this change.
 */
describe("RESO-1 — R-3, the meta line and the actions are one row", () => {
	/** The nearest ancestor of `el` that is a flex ROW container. */
	const rowOf = (el: Element | null | undefined): Element | null => {
		let n = el?.parentElement ?? null;
		while (n) {
			// ⛔ TOKEN MATCH, NOT SUBSTRING. This read
			// `c.includes("flex") && !c.includes("flex-col")`, and `flex-1` CONTAINS
			// `flex` — so any `flex-1` ancestor with `display:block` was returned as
			// "the row" (@test-writer). `ResolverCards`' own row carries `flex-1`.
			const t = (n.getAttribute("class") ?? "").split(/\s+/);
			if (t.includes("flex") && !t.includes("flex-col")) return n;
			n = n.parentElement;
		}
		return null;
	};

	it("market-header::G-R3-meta-and-actions-share-one-row-container", () => {
		const { container } = render(
			<MarketHeader market={market(3, 5)} priceChart={null} />,
		);

		const meta = screen.getByText("Đ 150 staked");
		const exportLink = container.querySelector(
			'a[aria-label="Download this debate as Markdown"]',
		);
		const badge = screen.getByText("Open");
		expect(exportLink).not.toBeNull();

		// Walk up from each to its enclosing row, then to the row that holds BOTH.
		const metaRow = rowOf(meta);
		expect(metaRow).not.toBeNull();
		const shared = metaRow?.parentElement ?? null;
		expect(shared).not.toBeNull();
		// ⛔ THE LOAD-BEARING PAIR: one container contains both, and it is a ROW.
		expect(shared?.contains(meta)).toBe(true);
		expect(shared?.contains(exportLink as Node)).toBe(true);
		expect(shared?.contains(badge)).toBe(true);
		const sharedTokens = (shared?.getAttribute("class") ?? "").split(/\s+/);
		expect(sharedTokens).toContain("flex");
		expect(sharedTokens).not.toContain("flex-col");
		// ⛔ AND IT MAY NOT WRAP OR REVERSE. `flex-wrap` puts the actions on a
		// SECOND LINE while every source-order and container assertion above stays
		// green — one row in the markup, two on screen. `flex-col-reverse` and
		// `flex-row-reverse` invert it without touching source order either.
		expect(sharedTokens).not.toContain("flex-wrap");
		expect(sharedTokens).not.toContain("flex-col-reverse");
		expect(sharedTokens).not.toContain("flex-row-reverse");
		// R-3 says vertically centred against the meta line. The two children are
		// different heights (16px strip vs 20px badge row), so this is the
		// declaration that does the centring, and it is pinned by name.
		expect(sharedTokens).toContain("items-center");
	});

	it("market-header::G-R3-the-actions-are-pushed-RIGHT-and-the-meta-stays-left", () => {
		const { container } = render(
			<MarketHeader market={market(3, 5)} priceChart={null} />,
		);
		const exportLink = container.querySelector(
			'a[aria-label="Download this debate as Markdown"]',
		);
		const actions = rowOf(exportLink);
		expect(actions).not.toBeNull();
		// ⛔ `ml-auto`, not `justify-between` — the two are identical while both
		// children exist and diverge when one does not (see the component's own
		// note). Pinning the mechanism, not the appearance.
		expect(actions?.getAttribute("class") ?? "").toContain("ml-auto");

		// …and the meta line does NOT carry it, which is what keeps it left. This
		// is the half that fails if someone "centres the row" instead.
		const metaRow = rowOf(screen.getByText("Đ 150 staked"));
		expect(metaRow?.getAttribute("class") ?? "").not.toContain("ml-auto");
	});

	it("market-header::G-R3-they-are-NOT-two-stacked-rows-any-more", () => {
		// ⛔ THE REGRESSION SHAPE, stated positively. Before R-3 the actions sat in
		// their own sibling `<div>` under the attrs strip, so the two had NO shared
		// row — only the stack. If a later change splits them again, the actions'
		// row and the meta's row become siblings of the STACK rather than of each
		// other, and this reddens.
		const { container } = render(
			<MarketHeader market={market(3, 5)} priceChart={null} />,
		);
		const stack = container.querySelector('[data-testid="headzone-stack"]');
		expect(stack).not.toBeNull();
		const exportLink = container.querySelector(
			'a[aria-label="Download this debate as Markdown"]',
		);
		const metaRow = rowOf(screen.getByText("Đ 150 staked"));
		const actionsRow = rowOf(exportLink);
		// Neither is a DIRECT child of the stack — they are both nested one level
		// deeper, inside the shared row R-3 introduced.
		expect(metaRow?.parentElement).not.toBe(stack);
		expect(actionsRow?.parentElement).not.toBe(stack);
		expect(metaRow?.parentElement).toBe(actionsRow?.parentElement);
	});
});

describe("HTML-FINISH · MARKET DETAIL — row 6, the left column's order", () => {
	it("market-header::question-then-attrs-then-blocks", () => {
		// ⚠ THE THIRD MARKER CHANGED AND THE ROW DID NOT. This read
		// `question-then-attrs-then-criterion` and indexed
		// `"Resolution criterion text."` as its last marker; RESO-1 · R-2 removes
		// that element, so the marker would index to -1 and — this is the point —
		// `-1 < anything` would have satisfied the ordering VACUOUSLY rather than
		// failing. The `toBeGreaterThan(-1)` floors below are what caught it, and
		// they are why every marker still gets one.
		// ⇒ The subject is unchanged: READING ORDER down the left column. The
		// column now ends with the price bar (R-4) and the block row (R-7), so
		// those are the markers.
		const { container } = render(
			<MarketHeader market={market(3, 5)} priceChart={null} />,
		);

		const left = container.querySelector('[data-testid="headzone-left"]');
		const html = left?.innerHTML ?? "";
		expect(html).not.toBe("");

		const question = html.indexOf("Attrs Strip Market Question");
		const attrs = html.indexOf("Đ 150 staked");
		const blocks = html.indexOf('data-testid="resolver-cards"');

		// All three present — an absent marker indexes to -1 and would otherwise
		// satisfy the ordering below by accident.
		expect(question).toBeGreaterThan(-1);
		expect(attrs).toBeGreaterThan(-1);
		expect(blocks).toBeGreaterThan(-1);

		expect(question).toBeLessThan(attrs);
		expect(attrs).toBeLessThan(blocks);
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

	it("market-header::a-null-series-drops-the-RAIL-not-just-the-chart", () => {
		const { container } = render(
			<MarketHeader market={market(3, 5)} priceChart={null} />,
		);

		// ⚠⚠ THIS ASSERTION IS INVERTED FROM WHAT IT SAID, AND THE HISTORY IS THE
		// POINT. It was `a-null-series-drops-the-CHART-not-the-rail`, and read:
		// "C6 moved the price bar in beside it, and `PriceBar` renders its
		// 'Pricing unavailable' stub rather than null — so on the market arm the
		// rail is now ALWAYS occupied and a null series means 'no CHART', never
		// 'no rail'."
		// ⇒ RESO-1 · R-4 takes the bar OUT of the rail, which removes the only
		// reason the rail was always occupied. The invariant underneath never
		// changed — PD-3-09 / OD-6: NEVER AN EMPTY RAIL — and satisfying it now
		// requires the opposite assertion, because the only thing that could
		// occupy the rail is the chart. This is the same property, re-derived
		// against a moved neighbour, not a relaxation.
		// ⛔ IT IS NOT COSMETIC. Measured at RESO-1 recon on the base build:
		// `market-price-chart-card` renders on ZERO of the eight staging markets,
		// so without this the empty rail would be the state on EVERY market.
		const right = container.querySelector('[data-testid="headzone-right"]');
		expect(right).toBeNull();

		// …and the left column still stands, the pre-existing non-fatal contract.
		expect(
			container.querySelector('[data-testid="headzone-left"]')?.innerHTML,
		).toContain("Attrs Strip Market Question");
	});

	it("market-header::an-EMPTY-series-drops-the-rail-too", () => {
		// ⛔⛔ THE SHAPE PRODUCTION ACTUALLY PRODUCES, AND THE ONE THE FIRST VERSION
		// OF THIS GUARD MISSED. `priceChart` is NOT null on a market with no price
		// history — the read model returns `{ series: [], nodes: [] }`, which is
		// TRUTHY — and `MarketPriceChartHost` returns null for an empty series one
		// level down. So a rail gated on `priceChart != null` renders an EMPTY
		// 340×188 column, which is `PD-3-09` verbatim.
		// ⇒ THIS IS NOT HYPOTHETICAL AND IT IS NOT A NEAR MISS. It SHIPPED to the
		// RESO-1 preview and was caught by measuring the deployed build:
		// `headzone-right` present, `innerHTML === ""`, 340×188. The null-shaped
		// test above was green the whole time. A control that does not exercise the
		// failing condition IN ITS FAILING SHAPE is not a control (OVN-V3).
		const { container } = render(
			<MarketHeader
				market={market(3, 5)}
				priceChart={{ series: [], nodes: [] }}
			/>,
		);
		expect(
			container.querySelector('[data-testid="headzone-right"]'),
		).toBeNull();
		// Control: the header still rendered, so the null above is a real absence
		// rather than a failed render.
		expect(
			container.querySelector('[data-testid="headzone-left"]')?.innerHTML,
		).toContain("Attrs Strip Market Question");
	});

	it("market-header::G-2-the-rail-renders-IF-AND-ONLY-IF-the-chart-does", () => {
		// ⛔⛔ THE PROPERTY ITSELF, RATHER THAN A LIST OF SHAPES THAT SATISFY IT.
		// The three tests around this one pin the gate against three ENUMERATED
		// inputs (`null`, empty, present), which proves two predicates agree
		// POINTWISE — `MarketHeader`'s rail gate and `MarketPriceChartHost`'s own
		// null return — never that they agree. @test-writer's point: a fourth input
		// shape reopens the defect and no enumeration can be finished.
		// ⇒ `PD-3-09` / `OD-6` is an EQUIVALENCE — a rail exists exactly when there
		// is something in it — so state it as one and it holds for any input.
		// ⚠ The one-point series is in the list deliberately: it is truthy AND
		// non-empty, so it passes a `length > 0` gate, and it is not exotic (a
		// market on its first day). Measured: it DOES render the card today, so the
		// arms agree — but the assertion no longer depends on my having checked.
		const shapes: Array<{
			series: PricePointFixture[];
			nodes: never[];
		} | null> = [
			null,
			{ series: [], nodes: [] },
			{ series: [CHART_SERIES[0]], nodes: [] },
			{ series: CHART_SERIES, nodes: [] },
		];
		for (const priceChart of shapes) {
			cleanup();
			const { container } = render(
				<MarketHeader market={market(3, 5)} priceChart={priceChart} />,
			);
			const right = container.querySelector('[data-testid="headzone-right"]');
			const card = container.querySelector(
				'[data-testid="market-price-chart-card"]',
			);
			// THE EQUIVALENCE: rail ⟺ chart.
			expect(right === null).toBe(card === null);
			// …and PD-3-09 stated verbatim — a rendered rail is never empty.
			if (right !== null) {
				expect(right.innerHTML).not.toBe("");
			}
			// CONTROL — the header rendered at all, so the nulls above are real
			// absences rather than a failed render.
			expect(
				container.querySelector('[data-testid="headzone-left"]')?.innerHTML,
			).toContain("Attrs Strip Market Question");
		}
	});

	it("market-header::a-PRESENT-series-still-renders-the-rail", () => {
		// ⛔ THE POSITIVE CONTROL FOR THE ASSERTION ABOVE (OVN-V1). `toBeNull()`
		// passes just as happily on a component that renders no rail EVER — including
		// one that dropped `HeadZone`'s `right` prop altogether. This is the arm
		// that proves the rail still exists when it has something to hold, so the
		// pair together say "conditional", which is the actual ruling.
		const { container } = render(
			<MarketHeader
				market={market(3, 5)}
				priceChart={{ series: CHART_SERIES, nodes: [] }}
			/>,
		);
		const right = container.querySelector('[data-testid="headzone-right"]');
		expect(right).not.toBeNull();
		expect(right?.innerHTML).toContain('data-testid="market-price-chart-card"');
	});
});

/**
 * RESO-1 · G-2 — THE PRICE BAR RENDERS ABOVE THE BLOCK ROW, AND EXACTLY ONCE.
 *
 * ⚠⚠ THIS DESCRIBE REPLACES `the price bar sits in the rail`, which asserted the
 * exact opposite and is recorded rather than deleted (O-4). It required the bar
 * in `headzone-right`, absent from `headzone-left`, and BELOW the chart in
 * source order — d5's `.hright` holding `.graph` then `.barrow f`
 * (`d5:1007`, `:1037`), on the argument that "the bar and the chart read the
 * SAME price, so standing them in one column is what lets a reader check one
 * against the other."
 * ⇒ R-4 moves it into the reading column, directly above the block row.
 *
 * ⛔ THE "EXACTLY ONE INSTANCE" HALF IS THE ONE THAT EARNS ITS KEEP. A relocation
 * done by COPY rather than MOVE renders two bars that show the same number, look
 * plausible in a screenshot, and disagree the moment either is gated
 * differently. Asserting only "the bar is in the left column" passes on that
 * build. Both halves are here so neither can be satisfied by breaking the other.
 *
 * ⚠ SCOPED TO THE MARKET ARM, DELIBERATELY. `FocusMarketCard` renders a SECOND
 * `PriceBar` (`size="card"`) on this same route — but on the POST arm, the other
 * side of `DebateView`'s market↔post ternary, which never renders at the same
 * time as this one. "One instance" is therefore a per-arm claim, and this file
 * renders the market arm only.
 */
describe("RESO-1 — R-4, the price bar sits above the block row", () => {
	it("market-header::G-2-the-bar-is-in-the-reading-column-and-NOT-in-the-rail", () => {
		const { container } = render(
			<MarketHeader
				market={market(3, 5)}
				priceChart={{ series: CHART_SERIES, nodes: [] }}
			/>,
		);

		const left = container.querySelector('[data-testid="headzone-left"]');
		const right = container.querySelector('[data-testid="headzone-right"]');

		expect(left?.innerHTML).toContain("YES 50%");
		expect(left?.innerHTML).toContain("NO 50%");
		// ⛔ And it is not ALSO left behind in the rail. The rail is rendered here
		// (the series is non-null), so this is a real subtree, not a vacuous null.
		expect(right).not.toBeNull();
		expect(right?.innerHTML).not.toContain("YES 50%");
	});

	it("market-header::G-2-there-is-EXACTLY-ONE-price-bar-on-the-market-arm", () => {
		const { container } = render(
			<MarketHeader
				market={market(3, 5)}
				priceChart={{ series: CHART_SERIES, nodes: [] }}
			/>,
		);
		// `PriceBar`'s root carries `data-size`; `detail` is its market-detail
		// preset and has exactly one call site in the repo.
		expect(container.querySelectorAll('[data-size="detail"]')).toHaveLength(1);
		// And no OTHER preset leaked onto this arm — a copy that reached for a
		// different `size` would slip past a `detail`-only count.
		expect(container.querySelectorAll('[data-size="card"]')).toHaveLength(0);
		expect(container.querySelectorAll('[data-size="hero"]')).toHaveLength(0);
	});

	it("market-header::G-2-the-bar-is-ABOVE-the-block-row", () => {
		const { container } = render(
			<MarketHeader
				market={market(3, 5)}
				priceChart={{ series: CHART_SERIES, nodes: [] }}
			/>,
		);
		const left = container.querySelector('[data-testid="headzone-left"]');
		const html = left?.innerHTML ?? "";

		const bar = html.indexOf('data-size="detail"');
		const blocks = html.indexOf('data-testid="resolver-cards"');
		// Both present — an absent marker indexes to -1 and would satisfy the
		// ordering below by accident.
		expect(bar).toBeGreaterThan(-1);
		expect(blocks).toBeGreaterThan(-1);
		expect(bar).toBeLessThan(blocks);

		// ⛔ ADJACENCY, not merely order. R-4 says "DIRECTLY above the block row";
		// a bar three rows up also satisfies `bar < blocks`.
		// ⚠ THIS WAS `barEl.nextElementSibling`, WHICH IS WRONG IN BOTH DIRECTIONS
		// (@test-writer). Too tight: wrapping the bar in a `<div className="px-4">`
		// makes it `null` and reds a correct change. Too loose: it proves DOM
		// adjacency and calls it VISUAL order — `flex-col-reverse` on the stack, or
		// `order-*` on either child, renders the bar BELOW the row with source
		// order untouched, which is exactly the defect this guard names.
		// ⇒ Walk each to its child-of-the-common-ancestor, compare INDICES, and ban
		// the two CSS inversions explicitly.
		const barEl = left?.querySelector('[data-size="detail"]');
		const blockEl = left?.querySelector('[data-testid="resolver-cards"]');
		expect(barEl).not.toBeNull();
		expect(blockEl).not.toBeNull();
		let anc: Element | null = barEl?.parentElement ?? null;
		while (anc && !anc.contains(blockEl as Node)) anc = anc.parentElement;
		expect(anc).not.toBeNull();
		const childOf = (parent: Element, el: Element): Element => {
			let n: Element = el;
			while (n.parentElement && n.parentElement !== parent) n = n.parentElement;
			return n;
		};
		const kids = Array.from((anc as Element).children);
		const iBar = kids.indexOf(childOf(anc as Element, barEl as Element));
		const iBlk = kids.indexOf(childOf(anc as Element, blockEl as Element));
		expect(iBar).toBeGreaterThan(-1);
		expect(iBlk).toBe(iBar + 1);
		// ⛔ THE CSS INVERSIONS, which source order cannot see.
		const ancTokens = ((anc as Element).getAttribute("class") ?? "").split(
			/\s+/,
		);
		expect(ancTokens).not.toContain("flex-col-reverse");
		for (const el of [kids[iBar], kids[iBlk]]) {
			for (const t of (el?.getAttribute("class") ?? "").split(/\s+/)) {
				expect(t).not.toMatch(/^order-/);
			}
		}
	});
});

/**
 * HTML-FINISH · MARKET DETAIL round 2 · R7 (rows 7 + 8) — the ONE-ROW bar and
 * its LIVE percent labels.
 *
 * Round 1 built both, measured them green, and backed them out: `detail`'s
 * markup is byte-pinned by `tests/unit/discovery/render/price-bar-presets.test.tsx`
 * and that file sat outside the task's allow-list. The founder extended the
 * allow-list by that one file on 2026-08-16.
 *
 * ⛔ THE GATE IS THE SUBJECT HERE, not the arrangement. The arrangement is pinned
 * byte-for-byte by the Discovery-side baseline; what THAT file cannot see is the
 * F-3 gating, because it renders `PriceBar` with no `pick` at all. A label that
 * opened the composer on a Closed market, for a suspended session, or on the
 * pole opposite the viewer's holding would be a BYPASS around `SlotHeader`'s
 * gate — `DebateView`'s composer host opens off `openSide` alone and checks none
 * of the three itself.
 */
describe("HTML-FINISH · MARKET DETAIL — row 8, the clickable percent labels", () => {
	const OPEN = { heldSide: null, marketOpen: true, suspended: false };

	function renderWithPick(
		state: {
			heldSide: "YES" | "NO" | null;
			marketOpen: boolean;
			suspended: boolean;
		},
		onPick: (side: "YES" | "NO") => void,
	) {
		return render(
			<MarketHeader
				market={market(3, 5)}
				priceChart={{ series: CHART_SERIES, nodes: [] }}
				pick={{ ...state, onPick }}
			/>,
		);
	}

	it("market-header::row-8-each-label-picks-its-OWN-side", () => {
		// ⛔ BOTH SIDES, and not because two assertions look thorough: a handler
		// wired `onPick("YES")` at both ends renders identically and passes any
		// single-sided test, while silently making the NO label buy YES.
		const onPick = vi.fn();
		const { container } = renderWithPick(OPEN, onPick);

		const yes = container.querySelector<HTMLButtonElement>(
			'[data-testid="price-label-YES"]',
		);
		const no = container.querySelector<HTMLButtonElement>(
			'[data-testid="price-label-NO"]',
		);
		expect(yes).not.toBeNull();
		expect(no).not.toBeNull();

		fireEvent.click(yes as HTMLButtonElement);
		expect(onPick).toHaveBeenLastCalledWith("YES");
		fireEvent.click(no as HTMLButtonElement);
		expect(onPick).toHaveBeenLastCalledWith("NO");
		expect(onPick).toHaveBeenCalledTimes(2);
	});

	it("market-header::row-8-the-label-text-is-unchanged-by-becoming-a-control", () => {
		// The bar must READ the same whether or not the viewer can act on it —
		// the percent is the information, the affordance is an extra.
		const { container } = renderWithPick(OPEN, () => {});
		expect(
			container.querySelector('[data-testid="price-label-YES"]')?.textContent,
		).toBe("YES 50%");
		expect(
			container.querySelector('[data-testid="price-label-NO"]')?.textContent,
		).toBe("NO 50%");
	});

	it("market-header::row-8-WCAG-2.5.3-the-accessible-name-is-the-visible-text", () => {
		// ⛔ NO `aria-label` OVERRIDE. The visible run is `YES 50%`, so any
		// accessible name would have to CONTAIN it — "Buy YES" does not, and
		// "Buy YES — 50%" does not either. The affordance rides `title`, which does
		// not displace the accessible name on an element that has text content.
		const { container } = renderWithPick(OPEN, () => {});
		const yes = container.querySelector('[data-testid="price-label-YES"]');
		expect(yes?.getAttribute("aria-label")).toBeNull();
		expect(yes?.getAttribute("title")).toBe("Buy YES");
	});

	it("market-header::row-8-a-closed-market-disables-BOTH-labels", () => {
		// INV-4 read-only. `SlotHeader` already refuses here; this control opens the
		// same composer and must refuse identically.
		const onPick = vi.fn();
		const { container } = renderWithPick(
			{ ...OPEN, marketOpen: false },
			onPick,
		);

		for (const side of ["YES", "NO"]) {
			const el = container.querySelector<HTMLButtonElement>(
				`[data-testid="price-label-${side}"]`,
			);
			expect(el?.disabled).toBe(true);
			expect(el?.getAttribute("aria-disabled")).toBe("true");
		}
	});

	it("market-header::row-8-a-suspended-session-disables-BOTH-labels", () => {
		const { container } = renderWithPick(
			{ ...OPEN, suspended: true },
			() => {},
		);
		expect(
			container.querySelector<HTMLButtonElement>(
				'[data-testid="price-label-YES"]',
			)?.disabled,
		).toBe(true);
		expect(
			container.querySelector<HTMLButtonElement>(
				'[data-testid="price-label-NO"]',
			)?.disabled,
		).toBe(true);
	});

	it("market-header::row-8-a-holder-may-only-pick-their-OWN-pole", () => {
		// ⛔ THE ASYMMETRIC CASE — the one a blanket `disabled={!marketOpen}` passes
		// and gets wrong. F-3: holding YES, the NO label must refuse and the YES
		// label must stay live, carrying the SAME C3 batch string the colhead entry
		// and the card pills carry, so one refusal reads one way everywhere.
		const { container } = renderWithPick(
			{ ...OPEN, heldSide: "YES" },
			() => {},
		);

		const yes = container.querySelector<HTMLButtonElement>(
			'[data-testid="price-label-YES"]',
		);
		const no = container.querySelector<HTMLButtonElement>(
			'[data-testid="price-label-NO"]',
		);
		expect(yes?.disabled).toBe(false);
		expect(no?.disabled).toBe(true);
		expect(no?.getAttribute("title")).toBe(
			"You hold YES. Exit your position to bet NO.",
		);
	});

	it("market-header::row-8-WITHOUT-pick-the-labels-are-inert-text", () => {
		// Non-vacuity for every row above, and the Discovery contract in one line:
		// both Discovery sites render `PriceBar` with no `pick`, so their labels
		// must stay plain `<span>`s and gain no interactive affordance at all.
		const { container } = render(
			<MarketHeader
				market={market(3, 5)}
				priceChart={{ series: CHART_SERIES, nodes: [] }}
			/>,
		);
		expect(
			container.querySelector('[data-testid="price-label-YES"]'),
		).toBeNull();
		// ⚠ RE-POINTED AT RESO-1 · R-4, NOT RELAXED. This read the RAIL
		// (`headzone-right`), because that is where the bar was. The bar moved to
		// the reading column; the assertion's subject — "the bar still RENDERS,
		// it has only lost its affordance" — is unchanged, and it is what makes
		// every `pick` case above non-vacuous.
		const left = container.querySelector('[data-testid="headzone-left"]');
		expect(left?.innerHTML).toContain("YES 50%");
	});
});

/**
 * CHART-2 · `C-CHART-2` clause 1 — THE PULSE IS GATED ON THIS MARKET'S OWN
 * STATUS, and this is the file where that can be proven.
 *
 * ⛔ WHAT `terminal-pulse.test.tsx` CANNOT SEE, AND WHY THAT GAP HAS A NAME
 * HERE ALREADY. That file renders `MarketPriceChart` with `isOpen` held still
 * by the test, which proves the COMPONENT honours the flag. It cannot prove
 * that this page HANDS IT THE RIGHT ONE — the identical distinction
 * `tests/server/discovery/live-tail-wiring.test.ts` was written to close for
 * `withLiveTail`'s own `isOpen`, whose docblock says it plainly: `/m/[slug]` is
 * "the ONLY call site where that branch is reachable, so nothing else in the
 * repository would notice." CHART-2 adds a SECOND `isOpen`, at a DIFFERENT call
 * site, with the same reachability and — until this block — no equivalent pin.
 *
 * ⛔ MEASURED, NOT ASSUMED: replacing `isOpen={market.status === "Open"}` with
 * `isOpen={true}` in `MarketHeader.tsx` left the whole of `tests/unit` GREEN at
 * 2296/2296 against the tree at `e152dec`. That build pulses the terminal dots
 * of every `Closed`, `Resolving`, `Resolved` and `Voided` market — a rendered
 * claim that a terminated market is live, on the surface where stake is
 * committed (**INV-4**).
 *
 * ⚠ BEHAVIOURAL, NOT A SOURCE SCAN, because it can be: the fixture already
 * carries a `status` and the chart already renders under it, so the wrong
 * wiring is reachable by rendering rather than by reading. A source scan would
 * pin the expression; this pins the CONSEQUENCE, and survives a refactor that
 * keeps the behaviour.
 *
 * ⚠ Queries are targeted, per this file's own standing note — no
 * `container.innerHTML` pin, so the block cannot become a tripwire for an
 * unrelated change to the rail.
 */
describe("CHART-2 — the terminal pulse is gated on market.status (INV-4)", () => {
	const FROZEN = ["Closed", "Resolving", "Resolved", "Voided"] as const;

	function renderWithStatus(status: DebateMarketHeader["status"]) {
		return render(
			<MarketHeader
				market={{ ...market(3, 5), status }}
				priceChart={{ series: CHART_SERIES, nodes: [] }}
			/>,
		);
	}

	it("market-header::an-Open-market-pulses", () => {
		// The positive control for every absence below, and a real requirement:
		// without it, a header that rendered no chart at all would satisfy the
		// whole of the rest of this block.
		const { container } = renderWithStatus("Open");
		expect(
			container.querySelector('[data-testid="terminal-pulse-yes"]'),
		).not.toBeNull();
		expect(
			container.querySelector('[data-testid="terminal-pulse-no"]'),
		).not.toBeNull();
	});

	for (const status of FROZEN) {
		it(`market-header::a-${status}-market-does-NOT-pulse`, () => {
			const { container } = renderWithStatus(status);

			// GUARD IS ALIVE — the chart is present and drawing, so the two nulls
			// below read as "no pulse" and not as "no chart".
			expect(
				container.querySelector('[data-testid="market-price-chart"]'),
			).not.toBeNull();
			expect(
				container.querySelector('[data-testid="line-yes"]'),
			).not.toBeNull();

			expect(
				container.querySelector('[data-testid="terminal-pulse-yes"]'),
			).toBeNull();
			expect(
				container.querySelector('[data-testid="terminal-pulse-no"]'),
			).toBeNull();

			// …and the DOT survives the freeze — clause 1's second half. Gating the
			// whole marker subtree on `isOpen` would satisfy every assertion above
			// and delete the line's terminal mark, taking the HTML label's anchor
			// with it.
			expect(
				container.querySelector('[data-testid="terminal-dot-yes"]'),
			).not.toBeNull();
			expect(
				container.querySelector('[data-testid="terminal-dot-no"]'),
			).not.toBeNull();
			expect(
				container.querySelector('[data-testid="terminal-label-yes"]'),
			).not.toBeNull();
		});
	}
});
