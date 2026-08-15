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
