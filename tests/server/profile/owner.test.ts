import { describe, expect, it } from "vitest";

import {
	buildPositionsPayload,
	isSellEligible,
} from "@/server/profile/owner-view";
import type { ProfilePositionRow } from "@/server/profile/positions";

/**
 * UI.A5 Slice 7 (plan §2 row 7 / §3 "Owner detection" / §13 item 2) — the
 * owner-view payload law, RED-FIRST: `src/server/profile/owner-view.ts` does
 * NOT exist, so the runtime import above MUST fail to resolve until Slice 7
 * lands (CLAUDE.md §5.6).
 *
 * Laws under test (SPEC.1 §23, 1.0.18):
 * - F-PROF-3 at the DTO boundary ("Owner vs visitor" payload law): "Sell is
 *   never present in a visitor payload" — the `owner: false` arm of
 *   `ProfilePositionsPayload` carries NO `sellEligible` field at all
 *   (structural no-leak, plan §13 item 2).
 * - "Sell on profile": a holding is sellable IFF its market is `Open` AND
 *   `quantity > 0` — Closed/Resolving/Resolved/Voided/Frozen holdings
 *   (statusLabel `Closed`) and settled rows never carry Sell.
 *
 * PURE — no DB, no render; fixtures are inline plain `ProfilePositionRow`
 * objects (type-only import — no server code executes) on the 18-dp
 * money-as-string DTO convention. Neutral `Market <slug>` titles — no
 * invented market content (CLAUDE.md §3).
 */

const M1 = "0190c0de-aaaa-7000-8000-000000000001"; // Open market, held
const M2 = "0190c0de-bbbb-7000-8000-000000000002"; // Resolved market, settled
const M3 = "0190c0de-cccc-7000-8000-000000000003"; // Closed market, unsettled
const M4 = "0190c0de-dddd-7000-8000-000000000004"; // Open market, zero qty
const C_OPENER = "0190c0de-ffff-7000-8000-000000000044";

/** Open ∧ held ∧ unsettled — the ONLY sellable class. */
const ROW_OPEN_HELD: ProfilePositionRow = {
	marketId: M1,
	marketSlug: "fixture-alpha",
	marketTitle: "Market fixture-alpha",
	marketStatus: "Open",
	statusLabel: "Open",
	settled: false,
	side: "YES",
	quantity: "10.000000000000000000",
	staked: "25.000000000000000000",
	current: "31.000000000000000000",
	argument: {
		removed: false,
		commentId: C_OPENER,
		title: "Opener argument alpha",
		isReply: false,
		postOrdinal: 1,
		marketSlug: "fixture-alpha",
		repliedToTitle: null,
	},
};

/** Resolved + settled (OQ-9 A) — never sellable. */
const ROW_SETTLED: ProfilePositionRow = {
	marketId: M2,
	marketSlug: "fixture-beta",
	marketTitle: "Market fixture-beta",
	marketStatus: "Resolved",
	statusLabel: "Closed",
	settled: true,
	side: "NO",
	quantity: "4.000000000000000000",
	staked: "8.000000000000000000",
	current: "12.000000000000000000",
	argument: { removed: true, marketSlug: "fixture-beta" },
};

/** Market left Open (statusLabel Closed) but not yet settled — unsellable
 * (buys and sells require `Open`, §7). */
const ROW_CLOSED_UNSETTLED: ProfilePositionRow = {
	...ROW_SETTLED,
	marketId: M3,
	marketSlug: "fixture-gamma",
	marketTitle: "Market fixture-gamma",
	marketStatus: "Closed",
	settled: false,
	argument: { removed: true, marketSlug: "fixture-gamma" },
};

/** Zero quantity on an Open market — structurally excluded by the read model
 * (`quantity > 0` row domain), pinned defensively at the pure predicate. */
const ROW_ZERO_QTY: ProfilePositionRow = {
	...ROW_OPEN_HELD,
	marketId: M4,
	marketSlug: "fixture-delta",
	marketTitle: "Market fixture-delta",
	quantity: "0.000000000000000000",
	argument: { removed: true, marketSlug: "fixture-delta" },
};

describe("UI.A5 Slice 7 — owner-view payload law (SPEC.1 §23 F-PROF-3)", () => {
	it("visitor-payload-excludes-sell", () => {
		const payload = buildPositionsPayload([ROW_OPEN_HELD, ROW_SETTLED], false);

		expect(payload.owner).toBe(false);
		// Non-vacuity: the rows pass through, order preserved.
		expect(payload.rows.map((r) => r.marketId)).toEqual([M1, M2]);
		// F-PROF-3 at the DTO boundary: NO row carries a `sellEligible`
		// own-property — the visitor payload has no sell affordance AT ALL.
		for (const r of payload.rows) {
			expect("sellEligible" in r).toBe(false);
		}
	});

	it("sell-only-open-and-held", () => {
		const payload = buildPositionsPayload(
			[ROW_OPEN_HELD, ROW_SETTLED, ROW_ZERO_QTY],
			true,
		);

		expect(payload.owner).toBe(true);
		if (!payload.owner) {
			throw new Error("expected the owner payload arm");
		}
		const sellByMarket = new Map(
			payload.rows.map((r) => [r.marketId, r.sellEligible]),
		);
		// Open ∧ quantity > 0 ∧ unsettled → sellable.
		expect(sellByMarket.get(M1)).toBe(true);
		// Resolved/settled (statusLabel Closed) → never sellable.
		expect(sellByMarket.get(M2)).toBe(false);
		// Zero quantity → never sellable, even on an Open market.
		expect(sellByMarket.get(M4)).toBe(false);
	});

	it("is-sell-eligible-open-and-held-only", () => {
		expect(isSellEligible(ROW_OPEN_HELD)).toBe(true);
		expect(isSellEligible(ROW_CLOSED_UNSETTLED)).toBe(false);
		expect(isSellEligible(ROW_SETTLED)).toBe(false);
		expect(isSellEligible(ROW_ZERO_QTY)).toBe(false);
	});
});
