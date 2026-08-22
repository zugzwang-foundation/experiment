// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
	useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

import { formatDharma } from "@/components/debate/format";
import { PositionsTable } from "@/components/profile/PositionsTable";
import { ProfileTiles } from "@/components/profile/ProfileTiles";
import type { ProfilePositionsPayload } from "@/server/profile/owner-view";
import type {
	ProfilePositionLot,
	ProfilePositionRow,
} from "@/server/profile/positions";
import type { ProfileTiles as ProfileTilesData } from "@/server/profile/tiles";

/**
 * POSREV-1 RF-15 + R1 — **THE PARTS SUM TO THE WHOLE, AND NOTHING IS CALLED A
 * "LOT" WHERE A PARTICIPANT CAN READ IT.**
 *
 * **RF-15.** The §23 Positions-value tile read `Đ 920` above rows summing to
 * `Đ 921`. Rounding a parent and its children independently loses the identity
 * between them, and one tile per ARGUMENT rather than per market multiplies the
 * children — so the drift gets worse under the very change that makes the
 * surface readable.
 *
 * ⚠⚠ **EVERY FIGURE BELOW IS CHOSEN TO FORCE A REMAINDER.** A fixture whose
 * values happen to be whole Đ passes on a build with no partition at all: the
 * naive `round0` of each part would sum to the naive `round0` of the whole, and
 * the test would certify arithmetic it never exercised. `.5` values are the
 * cheapest way to make independent rounding provably wrong, and each case below
 * states what the WRONG answer would have been.
 *
 * **R1 (ADR-0039).** "Lot" is the schema's word. On screen these are ARGUMENTS,
 * and that is pinned rather than left to review.
 */

afterEach(cleanup);

const M1 = "0190c0de-aaaa-7000-8000-000000000001";
const M2 = "0190c0de-aaaa-7000-8000-000000000002";
const L = (n: number) => `0190c0de-2222-7000-8000-00000000000${n}`;

const dp18 = (v: string): string => {
	const [int, frac = ""] = v.split(".");
	return `${int}.${frac.padEnd(18, "0")}`;
};

function lot(n: number, shares: string, basis: string): ProfilePositionLot {
	return {
		lotId: L(n),
		betId: `bet-${n}`,
		side: "YES",
		originalBasis: basis,
		survivingBasis: basis,
		survivingShares: shares,
		sold: false,
		placedAt: "2026-09-10T10:00:00.000Z",
		argument: {
			removed: false,
			commentId: `0190c0de-1111-7000-8000-00000000000${n}`,
			title: `Argument number ${n}`,
			isReply: false,
			postOrdinal: n,
			marketSlug: "fixture-alpha",
			repliedToTitle: null,
		},
	};
}

function row(
	marketId: string,
	current: string,
	quantity: string,
	lots: ProfilePositionLot[],
): ProfilePositionRow {
	return {
		marketId,
		marketSlug: `slug-${marketId.slice(-1)}`,
		marketTitle: `Market ${marketId.slice(-1)}`,
		marketStatus: "Open",
		statusLabel: "Open",
		settled: false,
		side: "YES",
		quantity,
		staked: dp18("40"),
		current,
		argument: lots[0]?.argument ?? { removed: true, marketSlug: "x" },
		lots,
	};
}

/** The integer inside a `Đ n` figure, ungrouped, as a number. */
function figure(text: string): number {
	const m = /Đ\s*([\d,]+)/.exec(text);
	return Number((m?.[1] ?? "").replace(/,/g, ""));
}

describe("RF-15 — Σ displayed tiles == the displayed group header", () => {
	it("rounds parts to sum to their header, not each to itself", () => {
		// TWO equal arguments in one market worth Đ 10.5 in total.
		// ⛔ THE WRONG ANSWER, stated: each argument is exactly 5.25, and rounding
		// each on its own gives 5 + 5 = 10 under a header that reads 11 — the
		// `Đ 920 over Đ 921` defect, one market wide. Largest remainder gives 6 + 5.
		const payload: ProfilePositionsPayload = {
			owner: false,
			rows: [
				row(M1, dp18("10.5"), dp18("20"), [
					lot(1, dp18("10"), dp18("20")),
					lot(2, dp18("10"), dp18("20")),
				]),
			],
		};
		render(<PositionsTable payload={payload} positionsValue={dp18("10.5")} />);
		const header = figure(
			screen.getByTestId(`positions-group-figures-${M1}`).textContent ?? "",
		);
		// The header is the SECOND Đ on that line (`Đa → Đb`), so read the tiles
		// and compare against the header's own current figure.
		const headerText =
			screen.getByTestId(`positions-group-figures-${M1}`).textContent ?? "";
		const headerCurrent = Number(
			(/→\s*Đ\s*([\d,]+)/.exec(headerText)?.[1] ?? "").replace(/,/g, ""),
		);
		expect(header).toBe(40); // Đa, the staked side of the arrow
		expect(headerCurrent).toBe(11); // round0(10.5) = 11, HALF_UP

		const tiles = [1, 2].map((n) =>
			figure(screen.getByTestId(`position-tile-${L(n)}`).textContent ?? ""),
		);
		expect(tiles.reduce((a, b) => a + b, 0)).toBe(headerCurrent);
		// ⚠ AND THE NAIVE ANSWER IS ASSERTED WRONG, so a build with no partition
		// cannot pass by accident: 5 + 5 is what independent rounding produces.
		expect(tiles).not.toEqual([5, 5]);
		expect(tiles.sort((a, b) => b - a)).toEqual([6, 5]);
	});
});

describe("RF-15 — Σ displayed group headers == the Positions-value tile", () => {
	it("rounds headers to sum to the tile, not each to itself", () => {
		// TWO markets at Đ 10.5 each. Exact total 21 ⇒ the tile reads Đ 21.
		// ⛔ THE WRONG ANSWER: rounding each header on its own gives 11 + 11 = 22,
		// one Đ more than the tile above them.
		const tiles: ProfileTilesData = {
			walletValue: dp18("500"),
			positionsValue: dp18("21"),
			netProfitLoss: dp18("0"),
			argumentsCount: { total: 2, posts: 2, replies: 0 },
			supportReceived: dp18("0"),
			counterReceived: dp18("0"),
		};
		const payload: ProfilePositionsPayload = {
			owner: false,
			rows: [
				row(M1, dp18("10.5"), dp18("10"), [lot(1, dp18("10"), dp18("20"))]),
				row(M2, dp18("10.5"), dp18("10"), [lot(2, dp18("10"), dp18("20"))]),
			],
		};
		render(
			<>
				<ProfileTiles tiles={tiles} />
				<PositionsTable
					payload={payload}
					positionsValue={tiles.positionsValue}
				/>
			</>,
		);
		const tileFigure = figure(
			screen.getByTestId("tile-positions").textContent ?? "",
		);
		expect(tileFigure).toBe(21);

		const headers = [M1, M2].map((m) => {
			const t = screen.getByTestId(`positions-group-figures-${m}`).textContent;
			return Number(
				(/→\s*Đ\s*([\d,]+)/.exec(t ?? "")?.[1] ?? "").replace(/,/g, ""),
			);
		});
		expect(headers.reduce((a, b) => a + b, 0)).toBe(tileFigure);
		// ⛔ The naive answer, asserted wrong.
		expect(headers).not.toEqual([11, 11]);
		expect(headers.sort((a, b) => b - a)).toEqual([11, 10]);
	});

	it("a header figure does NOT move when the market filter narrows", () => {
		// ⚠⚠ THE STABILITY HALF, AND IT IS WHY THE ALLOCATION IS TAKEN OVER EVERY
		// ROW THE TILE SUMS RATHER THAN OVER THE VISIBLE ONES. Allocating over the
		// filtered set would make the SAME holding read `Đ 11` under "All markets"
		// and `Đ 10` under its own name — a figure that changes because you looked
		// at it differently, which is worse than the rounding gap being closed.
		const payload: ProfilePositionsPayload = {
			owner: false,
			rows: [
				row(M1, dp18("10.5"), dp18("10"), [lot(1, dp18("10"), dp18("20"))]),
				row(M2, dp18("10.5"), dp18("10"), [lot(2, dp18("10"), dp18("20"))]),
			],
		};
		render(<PositionsTable payload={payload} positionsValue={dp18("21")} />);
		const read = () =>
			Number(
				(
					/→\s*Đ\s*([\d,]+)/.exec(
						screen.getByTestId(`positions-group-figures-${M2}`).textContent ??
							"",
					)?.[1] ?? ""
				).replace(/,/g, ""),
			);
		const unfiltered = read();
		fireEvent.click(screen.getByTestId("positions-market-filter"));
		fireEvent.click(screen.getByTestId(`positions-market-option-${M2}`));
		expect(read()).toBe(unfiltered);
	});
});

describe("ADR-0039 R1 — the word `lot` never reaches a participant", () => {
	const payload: ProfilePositionsPayload = {
		owner: true,
		rows: [
			{
				...row(M1, dp18("10.5"), dp18("20"), [
					lot(1, dp18("10"), dp18("20")),
					lot(2, dp18("0"), dp18("0")),
				]),
				sellEligible: true,
			},
		],
	};

	/** Every string a participant can READ: text, plus the accessible names. */
	function readableText(container: HTMLElement): string {
		const aria = [...container.querySelectorAll("[aria-label]")]
			.map((el) => el.getAttribute("aria-label") ?? "")
			.join(" ");
		const titles = [...container.querySelectorAll("[title]")]
			.map((el) => el.getAttribute("title") ?? "")
			.join(" ");
		return `${container.textContent ?? ""} ${aria} ${titles}`;
	}

	// ⚠ WORD-BOUNDED. A bare `/lot/i` matches `pilot`, `allotted` and `slot`, and
	// a guard that reddens on correct copy gets suppressed within a week.
	const LOT_WORD = /\blots?\b/i;

	it("vocab::the-OPEN-tab-says-argument-never-lot", () => {
		const { container } = render(<PositionsTable payload={payload} />);
		expect(readableText(container)).not.toMatch(LOT_WORD);
	});

	it("vocab::the-CLOSED-tab-says-argument-never-lot", () => {
		// The Closed tab has its own columns and its own empty copy, so it is a
		// second surface and needs its own read.
		const { container } = render(<PositionsTable payload={payload} />);
		fireEvent.click(screen.getByTestId("positions-status-closed"));
		expect(readableText(container)).not.toMatch(LOT_WORD);
	});

	it("vocab::the-ARMED-sell-state-says-argument-never-lot", () => {
		// The armed state swaps a cell and adds two controls — all copy a
		// participant reads, none of it covered by the resting read above.
		const { container } = render(<PositionsTable payload={payload} />);
		fireEvent.click(screen.getByTestId(`tile-sell-${L(1)}`));
		expect(readableText(container)).not.toMatch(LOT_WORD);
	});

	it("vocab::POSITIVE-CONTROL-the-matcher-DOES-fire-on-the-word", () => {
		// ⛔ WITHOUT THIS, A BROKEN REGEX AND A CLEAN SURFACE ARE THE SAME GREEN.
		// The control uses the exact strings the schema would leak if a DTO field
		// name reached a render — not a bare "lot" literal, which would not
		// exercise the word boundary the matcher relies on.
		expect("Sell this lot").toMatch(LOT_WORD);
		expect("2 lots remaining").toMatch(LOT_WORD);
		// …and does NOT fire on words that merely contain it, which is the reason
		// it is bounded at all.
		expect("allotted pilot slot").not.toMatch(LOT_WORD);
	});
});

describe("RF-15 — the displayed figures are what `formatDharma` prints", () => {
	it("an allocated integer round-trips through the shared formatter", () => {
		// ⚠ THE ALLOCATION EMITS UNGROUPED INTEGERS and the render groups them, so
		// `formatDharma` has to be IDEMPOTENT on an already-rounded value or the
		// two levels would disagree with every other Đ on the page.
		expect(formatDharma("11")).toBe("11");
		expect(formatDharma("14260")).toBe("14,260");
		expect(formatDharma("0")).toBe("0");
	});
});
