// @vitest-environment jsdom

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ResolverCards } from "@/components/debate/ResolverCards";
import type { DebateMarketHeader } from "@/components/debate/types";

/**
 * HTML-FINISH · MARKET DETAIL row 3 — the resolver-card slot.
 *
 * ⛔ THIS IS A STRUCTURAL TEST AND CANNOT BE A VISUAL ONE. The row is ruled to
 * draw nothing (OD-2, plan F-6): `markets` carries no resolver name, logo,
 * source or X handle, there is no migration in this task, and rendering the two
 * card shells with empty fields would reproduce `PD-3-09` / `OD-6` exactly — the
 * ruling that deleted the deferred-work placeholder box from `MarketHeader` for
 * putting a build-time note in front of every participant.
 *
 * ⚠ WHAT IT IS ACTUALLY GUARDING: that the slot stays EMPTY. A future commit
 * that "finishes" it by porting the mockup's `.rescard` demo copy — "LOGO",
 * "Brihanmumbai Municipal Corporation", "@mybmc" — would be inventing market
 * content, which CLAUDE.md §3 refuses outright. This is the assertion that
 * fails if anyone does.
 *
 * No jest-dom in this repo (AGENTS.md §9) — plain DOM assertions only.
 */

afterEach(cleanup);

const MARKET: DebateMarketHeader = {
	id: "0190c0de-5555-7000-8000-000000000005",
	slug: "resolver-cards-fixture-market",
	title: "Fixture market question.",
	description: "Fixture resolution criterion.",
	status: "Open",
	mediaVideoUrl: null,
	mediaImageUrl: null,
	pricing: { yes: "0.500000000000000000", no: "0.500000000000000000" },
	unitToWin: { yes: "1.960000000000000000", no: "1.960000000000000000" },
	totals: {
		dharmaStaked: "150.000000000000000000",
		postCount: 3,
		replyCount: 5,
	},
};

describe("ResolverCards — row 3, the structural slot", () => {
	it("resolver-cards::renders-nothing-at-all", () => {
		const { container } = render(<ResolverCards market={MARKET} />);

		// ⛔ Not "renders an empty card". NOTHING — no wrapper, no chrome, no
		// reserved box. PD-3-09 / OD-6.
		expect(container.innerHTML).toBe("");
	});

	it("resolver-cards::ships-none-of-the-mockups-demo-copy", () => {
		const { container } = render(<ResolverCards market={MARKET} />);

		// The mockup's `.rescard` strings, pinned as absent. Porting them would be
		// inventing market content (CLAUDE.md §3), not finishing a row.
		for (const demo of ["LOGO", "Resolver", "X — official", "@mybmc"]) {
			expect(container.innerHTML).not.toContain(demo);
		}
	});
});
