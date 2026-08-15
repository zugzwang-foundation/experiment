// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ArgumentList } from "@/components/profile/ArgumentList";
import { IdentityCard } from "@/components/profile/IdentityCard";
import { PositionsTable } from "@/components/profile/PositionsTable";
import { ProfileTiles } from "@/components/profile/ProfileTiles";
import type { ProfileArgumentItem } from "@/server/profile/arguments";
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

describe("HTML-FINISH profile rows 4 · 5 · 12 — the argument card", () => {
	const AGGREGATE = {
		supportCount: 3,
		counterCount: 1,
		supportDharma: "300.000000000000000000",
		counterDharma: "100.000000000000000000",
	};

	const POST: ProfileArgumentItem = {
		removed: false,
		kind: "post",
		id: "0190b3a0-9999-7000-8000-00000000000c",
		side: "YES",
		marketSlug: "fixture-alpha",
		marketTitle: "Market fixture-alpha",
		ordinal: 4,
		title: "A profile argument",
		teaser: "Neutral fixture teaser.",
		body: "A profile argument\n\nNeutral fixture body.",
		marker: "none",
		authorStake: "50.000000000000000000",
		priceAtBet: "0.270000000000000000",
		createdAt: "2026-07-01T00:00:00.000Z",
		aggregate: AGGREGATE,
	};

	/**
	 * The card's head row — the first element child of the first card.
	 *
	 * ⚠ NOT `querySelector('[data-testid^="argument-"]')`. That prefix ALSO
	 * matches the LIST wrapper (`data-testid="argument-list"`), so it returned
	 * the list, and `firstElementChild` returned the CARD rather than the head
	 * row. The order guard below still passed on that — `head.querySelector` is
	 * a descendant search and `indexOf` compares against the real parent — while
	 * the separator guard, which reads the head's OWN children, correctly went
	 * RED. Recorded because a prefix selector silently widening its match is
	 * exactly the class of defect these guards exist to catch, and this one was
	 * in the guard.
	 */
	function headOf(container: HTMLElement): Element {
		const card = container.querySelector(
			'[data-testid="argument-list"]',
		)?.firstElementChild;
		const head = card?.firstElementChild;
		if (head == null) {
			throw new Error("the argument card rendered no head row");
		}
		return head;
	}

	it("row4::the-head-carries-avatar-pseudonym-chip-marker-and-stake-IN-ORDER", () => {
		const { container } = render(
			<ArgumentList items={[POST]} owner={false} author={USER} />,
		);
		const head = headOf(container);
		// Canon §3 item 11: "head = avatar · name | SIDE @ entry% | stake …".
		// ORDER, not mere presence — the pre-change head already contained the
		// chip and the stake, so a presence-only guard passes on it.
		const avatar = head.querySelector('[data-slot="avatar"]');
		const pseudonym = head.querySelector('[data-testid="argument-author"]');
		const chip = head.querySelector('[data-slot="badge"]');
		const stake = head.querySelector('[data-testid^="argument-stake-"]');
		if (avatar === null || pseudonym === null || chip === null) {
			throw new Error("row4: the head cluster is missing a part");
		}
		expect(pseudonym.textContent).toBe(USER.pseudonym);
		expect(indexOf(avatar)).toBeLessThan(indexOf(pseudonym));
		expect(indexOf(pseudonym)).toBeLessThan(indexOf(chip));
		expect(stake).not.toBeNull();
		if (stake !== null) {
			expect(indexOf(chip)).toBeLessThan(indexOf(stake));
		}
	});

	it("row4::the-vsep-separators-are-present-and-byte-exact", () => {
		const { container } = render(
			<ArgumentList items={[POST]} owner={false} author={USER} />,
		);
		const head = headOf(container);
		const seps = [...head.children].filter((c) => c.textContent === "|");
		// Canon §3 item 11 writes THREE seam points on a post head:
		// `avatar · name | SIDE @ entry% | stake | Replies · N`.
		expect(seps.length).toBe(3);
		// ⛔ The glyph is U+007C, plain ASCII — not U+2502 or any box-drawing
		// lookalike. Asserted by CODE POINT so a visually identical substitute
		// reddens.
		for (const sep of seps) {
			expect(sep.textContent?.codePointAt(0)).toBe(0x7c);
		}
	});

	it("row4::the-removed-variant-carries-the-permitted-SUBSET-and-no-body", () => {
		const removed: ProfileArgumentItem = {
			removed: true,
			kind: "post",
			id: "0190b3a0-9999-7000-8000-00000000000d",
			side: "NO",
			marketSlug: "fixture-alpha",
			marketTitle: "Market fixture-alpha",
			ordinal: 5,
			createdAt: "2026-07-01T00:00:00.000Z",
			aggregate: AGGREGATE,
		};
		const { container } = render(
			<ArgumentList items={[removed]} owner={false} author={USER} />,
		);
		const head = headOf(container);
		expect(head.querySelector('[data-slot="avatar"]')).not.toBeNull();
		expect(head.querySelector('[data-slot="badge"]')).not.toBeNull();
		// SC-1 — assert the BODY's absence, not the row's. The removed union
		// variant carries no body/teaser/title field at all, so this is the
		// compile-level guarantee restated at the render.
		expect(container.innerHTML).not.toContain("Neutral fixture body");
		expect(container.innerHTML).not.toContain("A profile argument");
	});

	it("row12::Replies-N-is-in-the-HEAD-not-in-a-footer", () => {
		const { container } = render(
			<ArgumentList items={[POST]} owner={false} author={USER} />,
		);
		const head = headOf(container);
		const replies = container.querySelector(
			'[data-testid^="argument-replies-"]',
		);
		if (replies === null) {
			throw new Error("row12: no reply count rendered");
		}
		expect(
			head.contains(replies),
			`row 12: \`Replies · N\` is not inside the head cluster — it is still ` +
				`in the footer text line.`,
		).toBe(true);
		// The count is still the sum of both poles (every reply IS a Support or
		// Counter bet — ADR-0017), so the MOVE changed no number.
		expect(replies.textContent).toBe("4");
	});

	it("row5::the-footer-running-text-is-GONE-and-a-split-bar-replaces-it", () => {
		const { container } = render(
			<ArgumentList items={[POST]} owner={false} author={USER} />,
		);
		expect(
			container.querySelector('[data-testid^="argument-split-bar-"]'),
		).not.toBeNull();
		// The pre-change footer read `· Support 3 : Đ … · Counter 1 : Đ …`. Its
		// distinctive `N : Đ` grammar must be gone, or the bar was ADDED beside
		// the text rather than replacing it.
		expect(container.textContent ?? "").not.toMatch(/Support \d+ : Đ/);
		expect(container.textContent ?? "").not.toMatch(/Counter \d+ : Đ/);
	});

	it("row5::text-is-never-inside-the-bar-and-the-bar-is-display-only", () => {
		const { container } = render(
			<ArgumentList items={[POST]} owner={false} author={USER} />,
		);
		const bar = container.querySelector('[data-testid^="argument-split-bar-"]');
		if (bar === null) {
			throw new Error("row5: no split bar rendered");
		}
		// design-language §3.2: "label — bar — label, text never inside the bar."
		const track = bar.querySelector('[aria-hidden="true"]');
		expect(track?.textContent).toBe("");
		// ⚠ DISPLAY-ONLY IS AN INVARIANT, not a style choice: Support and Counter
		// are read-time AGGREGATES over reply-bets (ADR-0017/0018); there is no
		// standalone friendly-fire vote and `friendly_fire_events` was dropped at
		// DEBATE.9. A control here would imply one exists.
		expect(bar.querySelectorAll("button").length).toBe(0);
		expect(bar.querySelectorAll("a").length).toBe(0);
		expect(bar.querySelectorAll("input").length).toBe(0);
	});

	it("row5::the-staked-total-is-the-DISPLAYED-sum-of-the-DISPLAYED-parts", () => {
		// SPEC.1 §10.8 names "the reply split bar's staked total" as one of the
		// TWO displayed-space aggregate identities: displayed total = displayed
		// Support + displayed Counter, so the visible arithmetic is always true.
		const { container } = render(
			<ArgumentList items={[POST]} owner={false} author={USER} />,
		);
		const bar = container.querySelector('[data-testid^="argument-split-bar-"]');
		const total = bar?.querySelector("b");
		expect(total?.textContent).toBe("Đ 400");
		// And `.stkn` — canon §3 item 11's "enlarged + ink".
		const classes = (total?.className ?? "").split(/\s+/);
		expect(classes).toContain("text-ink");
	});

	it("row5::the-reply-variant-gets-NO-split-bar", () => {
		// A reply has no Support/Counter aggregate of its own — the union carries
		// none, so this is structural. Asserted because a bar rendered on a reply
		// would be inventing an aggregate.
		const reply: ProfileArgumentItem = {
			removed: false,
			kind: "reply",
			id: "0190b3a0-9999-7000-8000-00000000000e",
			side: "NO",
			marketSlug: "fixture-alpha",
			marketTitle: "Market fixture-alpha",
			ordinal: 4,
			title: "A profile reply",
			teaser: "Neutral fixture teaser.",
			body: "A profile reply\n\nNeutral fixture body.",
			marker: "none",
			stake: "6.000000000000000000",
			priceAtBet: "0.270000000000000000",
			repliedToTitle: "A parent argument",
			createdAt: "2026-07-01T00:00:00.000Z",
		};
		const { container } = render(
			<ArgumentList items={[reply]} owner={false} author={USER} />,
		);
		expect(
			container.querySelector('[data-testid^="argument-split-bar-"]'),
		).toBeNull();
	});
});

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

describe("HTML-FINISH profile rows 2 · 7 — the arena panels and their bars", () => {
	const PAYLOAD = { owner: false as const, rows: [ROW_OPEN, ROW_SETTLED] };

	const ARG_POST: ProfileArgumentItem = {
		removed: false,
		kind: "post",
		id: "0190b3a0-9999-7000-8000-00000000000c",
		side: "YES",
		marketSlug: "fixture-alpha",
		marketTitle: "Market fixture-alpha",
		ordinal: 4,
		title: "A profile argument",
		teaser: "Neutral fixture teaser.",
		body: "A profile argument\n\nNeutral fixture body.",
		marker: "none",
		authorStake: "50.000000000000000000",
		priceAtBet: "0.270000000000000000",
		createdAt: "2026-07-01T00:00:00.000Z",
		aggregate: {
			supportCount: 3,
			counterCount: 1,
			supportDharma: "300.000000000000000000",
			counterDharma: "100.000000000000000000",
		},
	};

	it("row2::both-arena-halves-are-bordered-panels-with-a-header-bar", () => {
		render(<PositionsTable payload={PAYLOAD} />);
		cleanup();
		// Rendered separately because each half is its own component; the BAND
		// that puts them side by side is row 1's, guarded above.
		const left = render(<PositionsTable payload={PAYLOAD} />);
		const leftPanel = screen.getByTestId("positions-panel");
		const leftHead = screen.getByTestId("positions-panel-head");
		expect(leftPanel.contains(leftHead)).toBe(true);
		// The bar is the panel's FIRST child — a header bar below the body is not
		// a header bar.
		expect(indexOf(leftHead)).toBe(0);
		// Canon §6 (Profile): "list `Positions`". Ratified copy, not authored.
		expect(leftHead.textContent).toContain("Positions");
		// The border and the bar's rule both ride the shipped hairline token, so
		// the panel reads as a panel rather than as a bare column.
		expect(leftPanel.className).toContain("[border:var(--hairline)]");
		expect(leftHead.className).toContain("[border-bottom:var(--hairline)]");
		left.unmount();

		render(<ArgumentList items={[ARG_POST]} owner={false} author={USER} />);
		const rightPanel = screen.getByTestId("arguments-panel");
		const rightHead = screen.getByTestId("arguments-panel-head");
		expect(rightPanel.contains(rightHead)).toBe(true);
		expect(indexOf(rightHead)).toBe(0);
		// Byte-carried from the shipped tile label (canon §6 verbatim). ⛔ NOT the
		// mockup's right colhead, which carries the selected market's title and a
		// live price — that header exists only inside the REPLICA reading, which
		// recon A-1 STRUCK on tier 1.
		expect(rightHead.textContent).toContain("Arguments");
		expect(rightPanel.className).toContain("[border:var(--hairline)]");
	});

	it("row2::the-panel-survives-the-EMPTY-state-on-both-halves", () => {
		// A panel that vanishes when its list is empty is not a panel — and the
		// empty state is exactly when a reader most needs the frame to say WHAT
		// is empty.
		const a = render(<PositionsTable payload={{ owner: false, rows: [] }} />);
		expect(screen.getByTestId("positions-panel")).toBeTruthy();
		expect(screen.getByTestId("positions-empty")).toBeTruthy();
		a.unmount();

		render(<ArgumentList items={[]} owner={false} author={USER} />);
		expect(screen.getByTestId("arguments-panel")).toBeTruthy();
		expect(screen.getByTestId("arguments-empty")).toBeTruthy();
	});

	it("row7::both-filters-live-ON-the-header-bar", () => {
		render(<PositionsTable payload={PAYLOAD} />);
		const head = screen.getByTestId("positions-panel-head");
		expect(
			head.contains(screen.getByTestId("positions-market-filter")),
			`row 7: the market filter is not on the panel header bar.`,
		).toBe(true);
		expect(head.contains(screen.getByTestId("positions-status-filter"))).toBe(
			true,
		);
	});

	it("row7a::the-market-filter-is-a-BUTTON-that-opens-a-popover-list", () => {
		render(<PositionsTable payload={PAYLOAD} />);
		const trigger = screen.getByTestId("positions-market-filter");
		// Not a <select>. The element TYPE is the row.
		expect(trigger.tagName).toBe("BUTTON");
		expect(trigger.getAttribute("aria-haspopup")).toBe("listbox");
		expect(trigger.getAttribute("aria-expanded")).toBe("false");
		// ⛔ The label is canon §6's `Select market ▾`, and the caret is
		// BYTE-CARRIED — U+25BE, asserted by CODE POINT so a lookalike reddens.
		const label = trigger.textContent ?? "";
		expect(label).toBe("Select market ▾");
		expect(label.codePointAt(label.length - 1)).toBe(0x25be);

		expect(screen.queryByTestId("positions-market-popover")).toBeNull();
		fireEvent.click(trigger);
		const popover = screen.getByTestId("positions-market-popover");
		expect(trigger.getAttribute("aria-expanded")).toBe("true");
		// `All markets` + one per distinct market. The inventory is UNCHANGED
		// from the `<select>` this replaced — only the control shape moved.
		expect(popover.querySelectorAll('[role="option"]').length).toBe(3);
		expect(
			popover
				.querySelector('[data-testid="positions-market-option-all"]')
				?.getAttribute("aria-selected"),
		).toBe("true");
	});

	it("row7a::ESC-closes-the-popover-canon-§5", () => {
		// Canon §5 (Profile) rules the dismissal grammar: "ESC / click-out
		// closes". A popover dismissible only by CHOOSING traps the reader.
		render(<PositionsTable payload={PAYLOAD} />);
		fireEvent.click(screen.getByTestId("positions-market-filter"));
		expect(screen.getByTestId("positions-market-popover")).toBeTruthy();
		fireEvent.keyDown(document, { key: "Escape" });
		expect(screen.queryByTestId("positions-market-popover")).toBeNull();
	});

	it("row7a::click-OUT-closes-the-popover-canon-§5", () => {
		render(<PositionsTable payload={PAYLOAD} />);
		fireEvent.click(screen.getByTestId("positions-market-filter"));
		expect(screen.getByTestId("positions-market-popover")).toBeTruthy();
		fireEvent.pointerDown(document.body);
		expect(screen.queryByTestId("positions-market-popover")).toBeNull();
	});

	it("row7b::the-status-filter-is-a-two-button-SEGMENTED-PAIR", () => {
		render(<PositionsTable payload={PAYLOAD} />);
		const seg = screen.getByTestId("positions-status-filter");
		const buttons = [...seg.querySelectorAll("button")];
		// Two, and only two — item 11 (P5-D17a) removed `All` and this row must
		// not reintroduce it by widening the control.
		expect(buttons.length).toBe(2);
		expect(buttons.map((b) => b.textContent)).toEqual(["Open", "Closed"]);
		// `aria-pressed` carries the selection — the state a `<select>` supplied
		// in `.value` and a hand-rolled pair must declare.
		expect(buttons[0]?.getAttribute("aria-pressed")).toBe("true");
		expect(buttons[1]?.getAttribute("aria-pressed")).toBe("false");
	});

	it("row7b::the-segments-still-DRIVE-the-filter-not-just-paint-it", () => {
		// ⚠ NON-VACUITY. Every assertion above is about SHAPE; this one is about
		// behaviour, because a control that looks right and filters nothing is
		// precisely the defect a shape-only guard ships.
		render(<PositionsTable payload={PAYLOAD} />);
		expect(screen.getByTestId(`position-row-${M1}`)).toBeTruthy();
		expect(screen.queryByTestId(`position-row-${M2}`)).toBeNull();
		fireEvent.click(screen.getByTestId("positions-status-closed"));
		expect(screen.getByTestId(`position-row-${M2}`)).toBeTruthy();
		expect(screen.queryByTestId(`position-row-${M1}`)).toBeNull();
	});

	it("row7a::the-popover-still-DRIVES-the-market-filter", () => {
		render(<PositionsTable payload={PAYLOAD} />);
		fireEvent.click(screen.getByTestId("positions-market-filter"));
		fireEvent.click(screen.getByTestId(`positions-market-option-${M2}`));
		// M2 is Closed and the status filter is Open, so choosing it empties the
		// table — the filter-scoped empty, not the "you hold nothing" one.
		expect(screen.getByTestId("positions-empty-filtered")).toBeTruthy();
		// …and choosing closes the popover.
		expect(screen.queryByTestId("positions-market-popover")).toBeNull();
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

	it("row13::the-market-question-links-to-its-MARKET-not-to-a-thread", () => {
		render(<PositionsTable payload={VISITOR_PAYLOAD} />);
		const marketLink = screen.getByTestId(`position-market-${M1}`);
		expect(marketLink.tagName).toBe("A");
		// Canon §7 item 6: "market title → overview". The market OVERVIEW, with
		// no `?post=` — that query is the ARGUMENT title's target, and before
		// this row every link on the surface carried it.
		expect(marketLink.getAttribute("href")).toBe("/m/fixture-alpha");
		expect(marketLink.getAttribute("href")).not.toContain("?post=");
	});

	it("row13::it-is-a-SIBLING-of-the-title-link-never-nested", () => {
		render(<PositionsTable payload={VISITOR_PAYLOAD} />);
		const marketLink = screen.getByTestId(`position-market-${M1}`);
		const titleLink = screen
			.getByTestId(`position-arg-${M1}`)
			.querySelector("a[href*='?post=']");
		if (titleLink === null) {
			throw new Error("row13: the argument title link is missing");
		}
		// Anchors cannot nest — a nested one is invalid HTML and the inner target
		// becomes unreachable. Asserted in BOTH directions.
		expect(titleLink.contains(marketLink)).toBe(false);
		expect(marketLink.contains(titleLink)).toBe(false);
	});

	it("row13::the-market-stays-reachable-on-a-REMOVED-opener", () => {
		// `marketSlug` is present on BOTH arms of `ProfileArgumentCell`, so the
		// navigation survives masking: the market is reachable when its argument
		// is not. That is the point of masking CONTENT rather than rows.
		render(<PositionsTable payload={{ owner: false, rows: [ROW_SETTLED] }} />);
		const marketLink = screen.getByTestId(`position-market-${M2}`);
		expect(marketLink.tagName).toBe("A");
		expect(marketLink.getAttribute("href")).toBe("/m/fixture-beta");
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

describe("HTML-FINISH profile row 16 — REFUSED ON MEASUREMENT; the box stays fixed", () => {
	/**
	 * ⛔ THIS GUARD ASSERTS THE REFUSAL, NOT THE ROW.
	 *
	 * Row 16 ("the PFP fills the identity band's height as a square") was BUILT
	 * — `h-full aspect-square w-auto shrink-0 min-h-14`, all topology, all
	 * traced — and then measured in a browser against real compiled CSS at a
	 * viewport PINNED to 390px by a fixed-width same-origin iframe:
	 *
	 *   WITH row 16     PFP 324 × 578 · idcol width 0 · tiles width 0 (content
	 *                   clipped, scrollWidth 89 vs clientWidth 0) · identity
	 *                   card scrollWidth 445 > clientWidth 356
	 *   WITHOUT row 16  PFP  56 ×  56 · idcol 252 · tiles 252 · nothing clipped
	 *
	 * The row's PREMISE is absent from this build. The mockup's PFP fills a band
	 * that is `flex:0 0 188px` (`.headzone`, `:189`) — BOUNDED. Here the height
	 * chain is halted (see `tests/unit/design/profile-height-chain.test.ts`), so
	 * `height:100%` resolves against a card sized by the tile column row 8 put
	 * beside it: taller tiles → taller card → wider square → narrower column →
	 * taller tiles, settling with the tiles at zero width.
	 *
	 * ⚠ THE ASSERTIONS BELOW ARE DELIBERATELY THE INVERSE OF WHAT THIS FILE
	 * ASSERTED BEFORE MEASUREMENT. They exist so the row is not re-applied from
	 * the mockup by the next reader, who will see `.pfp{height:100%}` and no
	 * reason it was declined. When the height chain lands, DELETE this block and
	 * build the row — that is the intended end state, not this one.
	 */
	it("row16::the-pfp-keeps-its-fixed-box-while-the-band-is-unbounded", () => {
		render(<IdentityCard user={USER} owner={false} tiles={TILES} />);
		const pfp = screen.getByTestId("identity-card").querySelector("img");
		if (pfp === null) {
			throw new Error("row16: the identity card renders no <img>");
		}
		const classes = pfp.className.split(/\s+/);
		expect(classes).toContain("size-14");
		// ⛔ The unbounded trio. Any ONE of these re-introduces the measured
		// defect, because none of them is bounded by anything in this build.
		for (const c of ["h-full", "aspect-square", "w-auto", "min-h-14"]) {
			expect(
				classes,
				`row 16 was REFUSED ON MEASUREMENT and \`${c}\` has come back. At ` +
					`390px this renders the PFP at 324×578 and crushes the tile ` +
					`column to zero width. It is only correct once the headzone has ` +
					`a bounded height — see profile-height-chain.test.ts.`,
			).not.toContain(c);
		}
	});

	it("row16::the-intrinsic-ratio-hint-attributes-survive", () => {
		// The pre-load ratio hint that keeps the identity band from shifting.
		render(<IdentityCard user={USER} owner={false} tiles={TILES} />);
		const pfp = screen.getByTestId("identity-card").querySelector("img");
		expect(pfp?.getAttribute("width")).toBe("56");
		expect(pfp?.getAttribute("height")).toBe("56");
	});

	it("row16::POSITIVE-CONTROL-the-refusal-check-detects-the-measured-defect", () => {
		// ⚠ PROOF BY REVERSAL over the REAL class string that was measured at
		// 324×578. The guard above must be false against it, or it asserts
		// nothing.
		const measuredDefect =
			"aspect-square h-full min-h-14 w-auto shrink-0 rounded-[var(--imgr)] bg-n1 object-cover".split(
				/\s+/,
			);
		const trio = ["h-full", "aspect-square", "w-auto", "min-h-14"];
		expect(trio.every((c) => measuredDefect.includes(c))).toBe(true);
		expect(measuredDefect).not.toContain("size-14");
		// …and the shipped list does NOT trip it, so the check discriminates.
		const shipped =
			"size-14 shrink-0 rounded-[var(--imgr)] bg-n1 object-cover".split(/\s+/);
		expect(trio.some((c) => shipped.includes(c))).toBe(false);
	});
});

describe("HTML-FINISH profile rows 1 · 8 — the two-band frame", () => {
	const ROOT = process.cwd();
	const PAGE = "src/app/(public)/u/[pseudonym]/page.tsx";
	const page = () => readFileSync(join(ROOT, PAGE), "utf8");

	/**
	 * ⚠ A SOURCE SCAN, AND THE LIMIT IS STATED. The page is an ASYNC RSC that
	 * awaits `resolveProfileUser`, `auth.api.getSession` and four read models,
	 * so it cannot be rendered under jsdom without mocking the whole server
	 * layer — and a render whose every input is mocked proves the mock's shape,
	 * not the page's. `discovery-height-chain.test.ts` reads its two shipped
	 * files the same way for the same reason. What the scan CANNOT see is
	 * resolved geometry; that is measured in a browser (§7).
	 */
	it("row1::the-page-composes-TWO-BANDS-not-five-stacked-siblings", () => {
		const src = page();
		expect(src).toContain('data-testid="profile-headzone"');
		expect(src).toContain('data-testid="profile-arena"');
		// Each band is a two-column grid above the `md` breakpoint. Canon §2:
		// "Two bands. Top: identity card … + the graph slot. Bottom 'arena':
		// Positions table … + the argument [list]".
		const headzone = /profile-headzone"\s+className="([^"]*)"/.exec(src)?.[1];
		const arena = /profile-arena"\s+className="([^"]*)"/.exec(src)?.[1];
		for (const [name, cls] of [
			["headzone", headzone],
			["arena", arena],
		] as const) {
			if (cls === undefined) {
				throw new Error(`row1: the ${name} band has no literal className`);
			}
			expect(cls.split(/\s+/), `row 1: ${name} is not a grid`).toContain(
				"grid",
			);
			expect(
				cls.split(/\s+/),
				`row 1: ${name} is not two columns above md`,
			).toContain("md:grid-cols-2");
		}
	});

	it("row1::the-five-siblings-are-GONE-from-the-container", () => {
		// The pre-change page mounted IdentityCard · ProfileTiles · ProfileGraph ·
		// PositionsTable · ArgumentList as five direct children of one container.
		// Two of those mounts must no longer exist at all: `ProfileTiles` moved
		// INSIDE IdentityCard (row 8), so the page must not import or mount it.
		const src = page();
		expect(
			src,
			`row 8: the page still mounts <ProfileTiles> directly — the tiles were ` +
				`COPIED into the identity card rather than MOVED.`,
		).not.toContain("<ProfileTiles");
		expect(src).not.toContain('from "@/components/profile/ProfileTiles"');
	});

	it("row8::the-tile-band-renders-INSIDE-the-identity-card", () => {
		render(<IdentityCard user={USER} owner={false} tiles={TILES} />);
		const card = screen.getByTestId("identity-card");
		const tiles = screen.getByTestId("profile-tiles");
		expect(
			card.contains(tiles),
			`row 8: the tiles are not inside the identity card.`,
		).toBe(true);
		// …and specifically UNDER the pseudonym row, in the identity COLUMN — the
		// mockup's `.idcol` is `[.unamerow][.tiles]` (`:437`), so the tiles are a
		// SIBLING of the name block, not a child of it and not a sibling of the
		// PFP.
		const pseudonym = screen.getByTestId("identity-pseudonym");
		const nameBlock = tiles.previousElementSibling;
		expect(nameBlock).not.toBeNull();
		expect(nameBlock?.contains(pseudonym)).toBe(true);
	});

	it("row8::the-PFP-is-not-a-sibling-of-the-tiles", () => {
		// The PFP stays the identity BAND's first child; the column beside it
		// holds the name block and the tiles. If the tiles landed beside the PFP
		// the band would be three columns, not two.
		render(<IdentityCard user={USER} owner={false} tiles={TILES} />);
		const card = screen.getByTestId("identity-card");
		const img = card.querySelector("img");
		const tiles = screen.getByTestId("profile-tiles");
		expect(img?.parentElement).toBe(card);
		expect(tiles.parentElement).not.toBe(card);
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
