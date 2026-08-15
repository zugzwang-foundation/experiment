// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { IdentityCard } from "@/components/profile/IdentityCard";
import { PositionsTable } from "@/components/profile/PositionsTable";
import { ProfileTiles } from "@/components/profile/ProfileTiles";
import type { ProfilePositionRow } from "@/server/profile/positions";
import type { ProfileUser } from "@/server/profile/resolve";
import type { ProfileTiles as ProfileTilesData } from "@/server/profile/tiles";

/**
 * HTML-FINISH · PROFILE — the arrangement guards, one per shipped row.
 *
 * ⚠ THESE ASSERT ON `innerHTML` / element ORDER, NEVER ON `textContent`
 * (CLAUDE.md §8 O-7). Every row here is a COMPOSITION delta — which element
 * wraps which, and in what order — and `textContent` flattens exactly the
 * markup that carries the meaning. A `textContent` assertion on row 15 or
 * row 19 passes on the pre-change build it was written to reject.
 *
 * ⚠ NO VALUE IS ASSERTED. These guards pin topology (`auto-rows-fr`, sibling
 * order, nesting) and never a colour, radius, px or type size — the mockups
 * are light-mode prototypes (DESIGN.B1) and the shipped system owns the
 * values, so a guard that pinned one would pin the wrong thing.
 *
 * Fixtures are INLINE plain objects on the shipped `src/server/profile/*` DTOs
 * (type-only imports — no server code executes; NO DB), matching the posture of
 * `surface.test.tsx`. No market content is invented (CLAUDE.md §3).
 */

afterEach(cleanup);

const TILES: ProfileTilesData = {
	walletValue: "500.000000000000000000",
	positionsValue: "120.000000000000000000",
	netProfitLoss: "-30.000000000000000000",
	argumentsCount: { total: 5, posts: 3, replies: 2 },
	supportReceived: "40.000000000000000000",
	counterReceived: "12.000000000000000000",
};

const USER: ProfileUser = {
	id: "0190c0de-1111-7000-8000-0000000000f1",
	pseudonym: "RedFox001",
	banned: false,
	pfpUrl: "/pfp-placeholder.svg",
};

const M1 = "0190c0de-aaaa-7000-8000-000000000001"; // Open market
const M2 = "0190c0de-bbbb-7000-8000-000000000002"; // settled market
const C_OPENER = "0190c0de-ffff-7000-8000-000000000044";

const ROW_OPEN: ProfilePositionRow = {
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

/** Settled row whose episode-opening argument is content_removed (N-1a). */
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

/** The index of `child` among its parent's element children. */
function indexOf(child: Element): number {
	const parent = child.parentElement;
	if (parent === null) {
		throw new Error("indexOf: element has no parent");
	}
	return [...parent.children].indexOf(child);
}

/** The `<td>` list of one rendered position row. */
function cellsOf(marketId: string): HTMLTableCellElement[] {
	const row = screen.getByTestId(`position-row-${marketId}`);
	return [...row.querySelectorAll("td")];
}

describe("HTML-FINISH profile row 15 — the tile value sits ABOVE its label", () => {
	it("row15::value-node-precedes-label-node-in-every-tile", () => {
		render(<ProfileTiles tiles={TILES} />);
		const grid = screen.getByTestId("profile-tiles");
		// Every tile, not just one: the swap lives in the shared `Tile` leaf, so a
		// guard over a single tile would pass on a per-tile regression.
		const tiles = [...grid.children];
		expect(tiles.length).toBe(6);
		for (const tile of tiles) {
			const [first, second] = [...tile.children];
			if (first === undefined || second === undefined) {
				throw new Error("row15: a tile has fewer than two element children");
			}
			// The LABEL is the muted `text-n5` span; the VALUE is the emphasised
			// `text-ink` one. Asserted by CLASS ROLE rather than by reading the
			// strings, so the guard cannot be greened by re-typing a label.
			expect(
				second.className,
				`row 15: the second child of a tile must be the LABEL span. Got ` +
					`"${second.className}" — the label/value order has flipped back.`,
			).toContain("text-n5");
			expect(first.className).toContain("text-ink");
		}
	});

	it("row15::POSITIVE-CONTROL-the-order-check-detects-the-pre-change-order", () => {
		// ⚠ PROOF BY REVERSAL. The assertion above is a claim about ORDER, and an
		// order claim that has never been run against the other order is
		// indistinguishable from one that cannot fail. This runs the same
		// predicate over a deliberately label-first fragment.
		const { container } = render(
			<div data-testid="control-tile">
				<span className="text-xs text-n5">Wallet value</span>
				<span className="font-medium text-ink tabular-nums">Đ 500</span>
			</div>,
		);
		const tile = container.querySelector('[data-testid="control-tile"]');
		if (tile === null) {
			throw new Error("row15 control: fixture did not render");
		}
		const [first, second] = [...tile.children];
		// The real guard demands `text-n5` SECOND; the pre-change order has it
		// first, so the same predicate is false here.
		expect(second?.className).not.toContain("text-n5");
		expect(first?.className).toContain("text-n5");
	});
});

describe("HTML-FINISH profile rows 6 · 14 · 17 — the positions grid", () => {
	const OWNER_PAYLOAD = {
		owner: true as const,
		rows: [
			{ ...ROW_OPEN, sellEligible: true },
			{ ...ROW_SETTLED, sellEligible: false },
		],
	};

	it("row6::status-and-sell-live-INSIDE-the-position-cell", () => {
		render(<PositionsTable payload={OWNER_PAYLOAD} />);
		const positionCell = cellsOf(M1)[0];
		if (positionCell === undefined) {
			throw new Error("row6: the row rendered no cells");
		}
		// Containment, not mere presence — the whole row moves both controls from
		// a trailing fifth column into the FIRST cell, so a `getByTestId` alone
		// would pass on the pre-change build.
		expect(
			positionCell.contains(screen.getByTestId(`position-side-${M1}`)),
		).toBe(true);
		expect(
			positionCell.contains(screen.getByTestId(`position-status-${M1}`)),
			`row 6: the status badge is not inside the Position cell. It is still ` +
				`in the deleted trailing action column.`,
		).toBe(true);
		expect(
			positionCell.contains(screen.getByTestId(`sell-trigger-${M1}`)),
		).toBe(true);
	});

	it("row6::the-status-badge-survives-on-EVERY-row-A-8", () => {
		// A-8 STRUCK "drop the per-row status token" on tier 1 (SPEC.1 §23:
		// "status Open / Closed by market state"). The mockup shows `Closed` only
		// on closed rows; both statuses must carry a badge here.
		//
		// ⚠ TWO RENDERS, NOT ONE, and the reason is the item-11 status filter:
		// `PositionsTable` derives its initial status from the rows and shows ONE
		// status at a time, so a single render of a mixed payload can never have
		// both rows on screen. The first draft of this guard asserted both from
		// one render and RED-ed — recorded because that red was the guard being
		// wrong about the surface, not the surface being wrong.
		render(<PositionsTable payload={OWNER_PAYLOAD} />);
		expect(screen.getByTestId(`position-status-${M1}`).textContent).toBe(
			"Open",
		);
		cleanup();
		render(
			<PositionsTable
				payload={{
					owner: true,
					rows: [{ ...ROW_SETTLED, sellEligible: false }],
				}}
			/>,
		);
		expect(screen.getByTestId(`position-status-${M2}`).textContent).toBe(
			"Closed",
		);
	});

	it("row6::there-is-no-trailing-action-column", () => {
		render(<PositionsTable payload={OWNER_PAYLOAD} />);
		const headers = [
			...screen.getByTestId("positions-table").querySelectorAll("th"),
		];
		expect(headers.length).toBe(5);
		// The LAST header is `Current`, not an empty action slot. This is the
		// assertion that catches a re-added action column.
		expect(headers[4]?.textContent).toBe("Current");
		const cells = cellsOf(M1);
		expect(cells.length).toBe(5);
		expect(cells[4]?.textContent).toContain("31");
	});

	it("row14::the-empty-arrow-track-is-FOURTH-of-five-not-fifth", () => {
		render(<PositionsTable payload={OWNER_PAYLOAD} />);
		const headers = [
			...screen.getByTestId("positions-table").querySelectorAll("th"),
		];
		expect(headers.map((h) => h.textContent)).toEqual([
			"Position",
			"Argument",
			"Staked",
			"",
			"Current",
		]);
		// And the ROW's arrow cell sits in the same slot, carrying the glyph.
		const arrow = cellsOf(M1)[3];
		expect(arrow?.textContent).toBe("→");
		expect(arrow?.getAttribute("aria-hidden")).toBe("true");
	});

	it("row14::POSITIVE-CONTROL-the-pre-change-header-order-fails", () => {
		// ⚠ PROOF BY REVERSAL over the REAL pre-change order. The build's empty
		// `<th>` was FIFTH; the same equality is false against it.
		const before = ["Position", "Argument", "Staked", "Current", ""];
		expect(before).not.toEqual([
			"Position",
			"Argument",
			"Staked",
			"",
			"Current",
		]);
	});

	it("row17::the-four-named-headers-centre-over-their-cells", () => {
		render(<PositionsTable payload={OWNER_PAYLOAD} />);
		const headers = [
			...screen.getByTestId("positions-table").querySelectorAll("th"),
		];
		for (const th of headers) {
			if ((th.textContent ?? "") === "") {
				continue; // the arrow track carries no label to centre
			}
			expect(
				th.className.split(/\s+/),
				`row 17: header "${th.textContent}" is not centred over its cell.`,
			).toContain("text-center");
		}
		// The TABLE keeps `text-left` — only headers and the two value cells
		// centre; the Argument cell's prose must stay left.
		expect(
			screen.getByTestId("positions-table").className.split(/\s+/),
		).toContain("text-left");
	});

	it("row17::the-two-value-cells-stack-and-centre-their-contents", () => {
		render(<PositionsTable payload={OWNER_PAYLOAD} />);
		const cells = cellsOf(M1);
		for (const index of [2, 4]) {
			const cell = cells[index];
			const inner = cell?.firstElementChild;
			if (inner == null) {
				throw new Error(`row17: value cell ${index} has no inner element`);
			}
			// The mockup's `.pnum` is a CENTRED COLUMN (`:296-297`) — the slot the
			// B-1 entry %/live % land in if the DTO ever carries them.
			const classes = inner.className.split(/\s+/);
			expect(classes).toContain("flex");
			expect(classes).toContain("flex-col");
			expect(classes).toContain("items-center");
		}
	});
});

describe("HTML-FINISH profile row 10 — the market question sits under the argument title", () => {
	const VISITOR_PAYLOAD = {
		owner: false as const,
		rows: [ROW_OPEN, ROW_SETTLED],
	};

	it("row10::market-question-is-in-the-ARGUMENT-cell-not-the-POSITION-cell", () => {
		render(<PositionsTable payload={VISITOR_PAYLOAD} />);
		const cells = cellsOf(M1);
		const positionCell = cells[0];
		const argumentCell = cells[1];
		const marketLine = screen.getByTestId(`position-market-${M1}`);
		expect(marketLine.textContent).toBe("Market fixture-alpha");
		expect(
			argumentCell?.contains(marketLine),
			`row 10: the market question is not in the Argument cell.`,
		).toBe(true);
		expect(
			positionCell?.contains(marketLine),
			`row 10: the market question is STILL in the Position cell — the move ` +
				`did not happen, or it was duplicated rather than moved.`,
		).toBe(false);
	});

	it("row10::it-sits-immediately-AFTER-the-title-link", () => {
		render(<PositionsTable payload={VISITOR_PAYLOAD} />);
		const marketLine = screen.getByTestId(`position-market-${M1}`);
		// The mockup's `.pcellt` is `[.ptitle][.pmkt]` — the question is the
		// title's sub-line, so index 1 among the cell's element children.
		expect(indexOf(marketLine)).toBe(1);
		expect(marketLine.previousElementSibling?.tagName).toBe("A");
	});

	it("row10::it-renders-on-the-REMOVED-row-too", () => {
		// `marketTitle` is `markets.title` — market metadata, not argument text —
		// so SC-1 attaches no masking obligation, and MOVING a per-row element
		// means it must still appear on every row. Suppressing it here would drop
		// the market question from exactly the rows whose argument is hidden.
		// A CLOSED-ONLY payload: the item-11 status filter derives its initial
		// value from the rows, so the settled row is only on screen when it is
		// the only class present.
		render(<PositionsTable payload={{ owner: false, rows: [ROW_SETTLED] }} />);
		const removedCell = screen.getByTestId(`position-arg-removed-${M2}`);
		const marketLine = screen.getByTestId(`position-market-${M2}`);
		expect(removedCell.contains(marketLine)).toBe(true);
		expect(marketLine.textContent).toBe("Market fixture-beta");
	});
});

describe("HTML-FINISH profile row 16 — the PFP fills the band as a square", () => {
	/**
	 * ⚠ A CLASS-PRESENCE GUARD, AND THE LIMIT IS STATED. jsdom performs NO
	 * layout — it resolves no percentage height, no `aspect-ratio` and no
	 * Tailwind utility — so this cannot prove the rendered box is square. It
	 * proves the DECLARATION is intact, which is the drift this file can see;
	 * the rendered geometry is proven in a browser against compiled CSS
	 * (`discovery-height-chain.test.ts:19-24` states the same limit).
	 */
	it("row16::pfp-is-height-driven-and-ratio-derived", () => {
		render(<IdentityCard user={USER} owner={false} />);
		const card = screen.getByTestId("identity-card");
		const pfp = card.querySelector("img");
		if (pfp === null) {
			throw new Error("row16: the identity card renders no <img>");
		}
		const classes = pfp.className.split(/\s+/);
		// The mockup's three declarations (`:191`), each ported as topology.
		expect(classes).toContain("h-full");
		expect(classes).toContain("aspect-square");
		expect(classes).toContain("shrink-0");
		// `w-auto` is what hands the width back to the ratio — without it the
		// `width={56}` presentational hint pins both axes and `aspect-ratio` is
		// ignored. Pinned by name because dropping it is a SILENT regression:
		// the element still renders, at the old fixed size.
		expect(
			classes,
			`row 16: \`w-auto\` is missing, so the width={56} attribute pins the ` +
				`box and aspect-square is inert. The PFP is back at a fixed size.`,
		).toContain("w-auto");
		// The fixed box must be GONE — its survival would win over the ratio.
		expect(classes).not.toContain("size-14");
		expect(classes).not.toContain("h-14");
	});

	it("row16::the-intrinsic-ratio-hint-attributes-survive", () => {
		// Deliberately asserted: `w-auto` only works BECAUSE the attributes are a
		// hint rather than an author rule, so a future reader must not "clean up"
		// the attributes on the theory that the CSS replaced them. They are the
		// pre-load ratio hint that keeps the identity band from shifting.
		render(<IdentityCard user={USER} owner={false} />);
		const pfp = screen.getByTestId("identity-card").querySelector("img");
		expect(pfp?.getAttribute("width")).toBe("56");
		expect(pfp?.getAttribute("height")).toBe("56");
	});

	it("row16::POSITIVE-CONTROL-the-pre-change-class-list-fails", () => {
		// ⚠ PROOF BY REVERSAL over the REAL class string this row replaced.
		const before = "size-14 rounded-[var(--imgr)] bg-n1".split(/\s+/);
		expect(before).not.toContain("h-full");
		expect(before).not.toContain("aspect-square");
		expect(before).not.toContain("w-auto");
		expect(before).toContain("size-14");
	});
});

describe("HTML-FINISH profile row 18 — the two tile rows share one height", () => {
	it("row18::grid-declares-equal-implicit-rows", () => {
		render(<ProfileTiles tiles={TILES} />);
		const grid = screen.getByTestId("profile-tiles");
		// The mockup's `grid-auto-rows:1fr` (`:204`). A RULE, not a number — the
		// class is pinned by name because that is the whole declaration.
		expect(
			grid.className.split(/\s+/),
			`row 18: the tile grid must declare \`auto-rows-fr\` so both rows share ` +
				`one height. Without it each row sizes to its own tallest tile.`,
		).toContain("auto-rows-fr");
	});
});

describe("HTML-FINISH profile row 19 — the Arguments breakdown is its own element", () => {
	it("row19::breakdown-is-a-nested-element-inside-the-value-node", () => {
		render(<ProfileTiles tiles={TILES} />);
		const value = screen.getByTestId("tile-arguments-value");
		const breakdown = screen.getByTestId("tile-arguments-breakdown");
		// O-7: the seam is only visible in the MARKUP. `textContent` on the value
		// node is byte-identical before and after this row, by design.
		expect(value.innerHTML).toContain("tile-arguments-breakdown");
		expect(breakdown.parentElement).toBe(value);
		expect(indexOf(breakdown)).toBeGreaterThanOrEqual(0);
	});

	it("row19::the-SPEC-pinned-string-is-unchanged-by-the-nesting", () => {
		// SPEC.1 §23 pins `N (P Posts | R Replies)`. The nesting must add markup
		// and NOTHING else — this is the clause that makes row 19 shippable
		// without a spec amendment.
		render(<ProfileTiles tiles={TILES} />);
		expect(screen.getByTestId("tile-arguments-value").textContent).toBe(
			"5 (3 Posts | 2 Replies)",
		);
	});

	it("row19::POSITIVE-CONTROL-a-flat-string-fails-the-nesting-check", () => {
		// The pre-change build rendered one flat string. Same predicate, and it
		// must be false — otherwise the guard above is asserting nothing.
		const { container } = render(
			<span data-testid="control-flat">5 (3 Posts | 2 Replies)</span>,
		);
		const flat = container.querySelector('[data-testid="control-flat"]');
		if (flat === null) {
			throw new Error("row19 control: fixture did not render");
		}
		expect(flat.innerHTML).not.toContain("tile-arguments-breakdown");
		// ⚠ AND the textContent read — the assertion a careless guard would have
		// used — passes on the flat form. That is the point of O-7, demonstrated.
		expect(flat.textContent).toBe("5 (3 Posts | 2 Replies)");
	});
});
