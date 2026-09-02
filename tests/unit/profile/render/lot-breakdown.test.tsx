// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LotBreakdown } from "@/components/profile/LotBreakdown";
import type { ProfilePositionLot } from "@/server/profile/positions";

/**
 * LOTS-1 Slice 8 — the per-argument decomposition, rendered (ADR-0039 R1/R6/R10).
 *
 * ⚠ NO `jest-dom` in this repo (AGENTS.md §9) — assertions are plain DOM
 * (`querySelector`, `textContent`, `getAttribute`), never `toBeInTheDocument`.
 *
 * `useRouter` is stubbed because the exit control calls `router.refresh()` on
 * success; nothing here submits, so the stub only has to exist.
 */

vi.mock("next/navigation", () => ({
	useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

const dp18 = (v: string): string => {
	const [int, frac = ""] = v.split(".");
	return `${int}.${frac.padEnd(18, "0")}`;
};

function lot(over: Partial<ProfilePositionLot> = {}): ProfilePositionLot {
	return {
		lotId: "lot-1",
		betId: "bet-1",
		// POSREV-1 S1 — the ARGUMENT's own side (`lots.side`), not the position's.
		side: "YES",
		originalBasis: dp18("100"),
		survivingBasis: dp18("100"),
		survivingShares: dp18("40"),
		sold: false,
		placedAt: "2026-09-10T10:00:00.000Z",
		argument: {
			removed: false,
			commentId: "c-1",
			title: "An argument about the thing",
			isReply: false,
			postOrdinal: 1,
			marketSlug: "market-a",
			repliedToTitle: null,
		},
		...over,
	};
}

afterEach(cleanup);

describe("LOTS-1 Slice 8 — LotBreakdown (ADR-0039)", () => {
	it("renders one entry per argument, each carrying its surviving basis", () => {
		render(
			<LotBreakdown
				marketId="m-1"
				sellable={false}
				lots={[
					lot({ lotId: "l-a", survivingBasis: dp18("40") }),
					lot({ lotId: "l-b", survivingBasis: dp18("500") }),
				]}
			/>,
		);
		expect(screen.getByTestId("lot-breakdown-m-1")).toBeTruthy();
		expect(screen.getByTestId("lot-basis-l-a").textContent).toContain("40");
		expect(screen.getByTestId("lot-basis-l-b").textContent).toContain("500");
	});

	it("renders NOTHING for an empty decomposition rather than an empty shell", () => {
		const { container } = render(
			<LotBreakdown marketId="m-1" sellable lots={[]} />,
		);
		expect(container.querySelector("[data-testid^='lot-breakdown']")).toBe(
			null,
		);
	});

	it("tags an exited argument Sold, and a TRIMMED one not at all (R6)", () => {
		// R6 is exact: the tag renders only at zero. A trimmed argument shows a
		// reduced figure with the original struck beside it — the number is the
		// signal, and a tag there would overstate what happened.
		render(
			<LotBreakdown
				marketId="m-1"
				sellable={false}
				lots={[
					lot({
						lotId: "l-sold",
						sold: true,
						survivingBasis: dp18("0"),
						survivingShares: dp18("0"),
					}),
					lot({
						lotId: "l-trimmed",
						sold: false,
						survivingBasis: dp18("50"),
						originalBasis: dp18("100"),
					}),
					lot({ lotId: "l-intact" }),
				]}
			/>,
		);
		expect(screen.getByTestId("lot-sold-l-sold")).toBeTruthy();
		expect(screen.queryByTestId("lot-sold-l-trimmed")).toBe(null);
		expect(screen.queryByTestId("lot-sold-l-intact")).toBe(null);

		// The struck original appears only where the figure actually moved, so an
		// untouched argument never shows the same number twice.
		expect(screen.getByTestId("lot-original-l-trimmed").textContent).toContain(
			"100",
		);
		expect(screen.queryByTestId("lot-original-l-intact")).toBe(null);
		expect(screen.queryByTestId("lot-original-l-sold")).toBe(null);
	});

	it("MASKS a removed argument — the stub renders and no body can (SC-1)", () => {
		const { container } = render(
			<LotBreakdown
				marketId="m-1"
				sellable={false}
				lots={[
					lot({
						lotId: "l-removed",
						argument: { removed: true, marketSlug: "market-a" },
					}),
				]}
			/>,
		);
		// The removed union variant carries NO title field at all, so there is
		// nothing here that COULD leak. Asserted on the rendered markup rather
		// than on a row's presence — the SC-1 form.
		expect(container.innerHTML).not.toContain("An argument about the thing");
		expect(screen.getByTestId("lot-l-removed").textContent).toContain(
			"[removed]",
		);
		// …and the entry SURVIVES: the stake was real, so the record keeps it.
		expect(screen.getByTestId("lot-basis-l-removed")).toBeTruthy();
	});

	it("offers the exit control to an owner, on arguments that still hold", () => {
		render(
			<LotBreakdown
				marketId="m-1"
				sellable
				lots={[
					lot({ lotId: "l-live" }),
					lot({
						lotId: "l-sold",
						sold: true,
						survivingBasis: dp18("0"),
						survivingShares: dp18("0"),
					}),
				]}
			/>,
		);
		const exit = screen.getByTestId("lot-exit-l-live");
		expect(exit.getAttribute("aria-label")).toBe("Exit this argument");
		// R9 — Sold is permanent; there is nothing left to exit.
		expect(screen.queryByTestId("lot-exit-l-sold")).toBe(null);
	});

	it("shows a VISITOR the decomposition and none of the controls", () => {
		// §23's owner-vs-visitor payload law: the record is public, the affordance
		// is not. The figures must be identical for both.
		render(
			<LotBreakdown
				marketId="m-1"
				sellable={false}
				lots={[lot({ lotId: "l-live" })]}
			/>,
		);
		expect(screen.getByTestId("lot-basis-l-live").textContent).toContain("100");
		expect(screen.queryByTestId("lot-exit-l-live")).toBe(null);
	});

	it('NEVER says "lot" where a participant can read it (R1)', () => {
		// R1: "Lot" is the schema's word, not the product's. Test ids are markup,
		// not copy — this reads the rendered TEXT only.
		const { container } = render(
			<LotBreakdown
				marketId="m-1"
				sellable
				lots={[
					lot({ lotId: "l-a" }),
					lot({
						lotId: "l-b",
						sold: true,
						survivingBasis: dp18("0"),
						survivingShares: dp18("0"),
					}),
				]}
			/>,
		);
		expect(container.textContent?.toLowerCase()).not.toContain("lot");
	});
});
