// @vitest-environment jsdom

import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({
	useRouter: () => ({ refresh, push: vi.fn() }),
}));

import { PositionsTable } from "@/components/profile/PositionsTable";
import type { ProfilePositionsPayload } from "@/server/profile/owner-view";
import type {
	ProfilePositionLot,
	ProfilePositionRow,
} from "@/server/profile/positions";

/**
 * MOBILE-2e · R-P3 — **THE PHONE SELL, MOUNTED THROUGH ITS HOST.**
 *
 * ⛔⛔ THIS FILE EXISTS BECAUSE THE PREMISE THAT MADE IT IMPOSSIBLE WAS FALSE,
 * AND THE SAME PR DISPROVED IT.
 *
 * `phone-sell-sheet.test.tsx` mounts the leaf directly and says, in its own
 * docblock, that the host cannot be reached in jsdom because `useIsPhoneTier()`
 * is `false` here by construction — and that the containment argument is
 * therefore "a source fact". Both halves were wrong. `useIsPhoneTier` reads
 * `window.matchMedia`, and a PER-QUERY stub — the exact technique this PR adds
 * to `tests/unit/ui/info-tip.test.tsx` to separate the pointer question from the
 * viewport one — answers the tier question `true` and mounts the phone arm.
 * ⚠ Found by `@test-writer` running 50 source mutations against the guard set:
 * the two most consequential survivors were **a money mutation** and **the
 * containment guard itself**, and both survived *because* the only reader was
 * textual. A source scan is the right instrument for a declaration; it is the
 * wrong one for a fact about the DOM, and "the DOM is unreachable" is a claim
 * that has to be re-tested rather than inherited.
 *
 * What this file proves, and what nothing else in the suite did:
 *
 *   · the host mounts the SHEET and not the in-row arm, and exactly one set of
 *     controls exists at a time (both arms share `data-testid`s);
 *   · **the sheet is inside the armed `<tr>`** — `row.contains(sheet)`, read off
 *     the DOM rather than inferred from the position of a `</td>` in the source;
 *   · **a `pointerdown` inside the sheet does not cancel the arm**, which is the
 *     consequence that containment exists for and the thing a reader would feel;
 *   · **the wire carries the EXACT held quantity**, not the rounded figure the
 *     field displays — the money assertion the desktop has two rows for and the
 *     phone had none;
 *   · the body lock goes on and comes back off.
 *
 * ⛔ No jest-dom (AGENTS.md §9) — plain DOM assertions only.
 */

const M1 = "0190c0de-aaaa-7000-8000-000000000001";
const L1 = "0190c0de-1010-7000-8000-000000000001";
const C_OPENER = "0190c0de-ffff-7000-8000-000000000044";
const TIER_QUERY = "not all and (min-width: 640px)";

const dp18 = (v: string): string => {
	const [int, frac = ""] = v.split(".");
	return `${int}.${frac.padEnd(18, "0")}`;
};

/**
 * ⛔ THE TIER IS A MEDIA QUERY AND NOTHING ELSE, so a stub is the whole of what
 * separates the two presentations. `phone-tier.ts` memoises its `MediaQueryList`
 * on the IDENTITY of `window.matchMedia`, so replacing the function per test
 * re-keys the memo — which is exactly why it is keyed that way.
 */
function mockTier(phone: boolean): void {
	window.matchMedia = ((query: string) => ({
		matches: query === TIER_QUERY ? phone : false,
		media: query,
		onchange: null,
		addEventListener: () => {},
		removeEventListener: () => {},
		addListener: () => {},
		removeListener: () => {},
		dispatchEvent: () => false,
	})) as typeof window.matchMedia;
}

function lot(over: Partial<ProfilePositionLot> = {}): ProfilePositionLot {
	return {
		lotId: L1,
		betId: `bet-${L1}`,
		side: "YES",
		originalBasis: dp18("25"),
		survivingBasis: dp18("25"),
		survivingShares: dp18("10"),
		sold: false,
		placedAt: "2026-09-10T10:00:00.000Z",
		argument: {
			removed: false,
			commentId: C_OPENER,
			title: "Opener argument alpha",
			isReply: false,
			postOrdinal: 1,
			marketSlug: "fixture-alpha",
			repliedToTitle: null,
		},
		...over,
	};
}

const ROW_OPEN: ProfilePositionRow = {
	lots: [lot()],
	marketId: M1,
	marketSlug: "fixture-alpha",
	marketTitle: "Market fixture-alpha",
	marketStatus: "Open",
	statusLabel: "Open",
	settled: false,
	side: "YES",
	quantity: dp18("10"),
	staked: dp18("25"),
	// ⚠ NOT A ROUND NUMBER, for the same reason `sell.test.tsx` says: the field
	// DISPLAYS `Đ 31` and the exact figure is 31.4, so "displayed" and "exact"
	// are distinguishable and the money row below cannot pass by coincidence.
	current: "31.400000000000000000",
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

const OWNER: ProfilePositionsPayload = {
	owner: true,
	rows: [{ ...ROW_OPEN, sellEligible: true }],
};

/** The last body posted to `/api/bets/sell`, parsed. */
let lastBody: Record<string, unknown> | null = null;
let calls = 0;

beforeEach(() => {
	lastBody = null;
	calls = 0;
	refresh.mockClear();
	vi.stubGlobal(
		"fetch",
		vi.fn(async (_url: string, init: RequestInit) => {
			calls += 1;
			lastBody = JSON.parse(String(init.body));
			return new Response(JSON.stringify({ ok: true, data: { sold: true } }), {
				status: 200,
				headers: { "content-type": "application/json" },
			});
		}),
	);
});

afterEach(() => {
	cleanup();
	// ⛔ The stub is global state. Leaving a phone tier armed would hand every
	// later file in the same worker a presentation it never asked for.
	mockTier(false);
	document.body.style.overflow = "";
});

/** Arms the sell on the one eligible tile and returns the row and the sheet. */
function armOnPhone() {
	mockTier(true);
	render(<PositionsTable payload={OWNER} />);
	const trigger = screen.getByTestId(`tile-sell-${L1}`);
	const row = trigger.closest("tr");
	expect(row, "the trigger is not inside a row").not.toBeNull();
	fireEvent.click(trigger);
	return { row: row as HTMLTableRowElement };
}

describe("MOBILE-2e — the phone sell, through its host", () => {
	it("phone-host::the-tier-stub-MOUNTS-the-sheet-and-the-in-row-arm-stands-down", () => {
		const { row } = armOnPhone();
		expect(
			screen.queryByTestId("phone-sheet-body"),
			"the phone arm did not mount — the tier stub is not reaching useIsPhoneTier",
		).not.toBeNull();
		// ⛔ EXCLUSIVITY. Both arms render a `tile-sell-amount-<key>`; two of them
		// means every later query in every sell test is reading an arbitrary one.
		expect(
			document.querySelectorAll(`[data-testid="tile-sell-amount-${L1}"]`)
				.length,
			"two amount fields — the arms are not exclusive",
		).toBe(1);
		expect(
			screen.queryByTestId(`tile-confirm-${L1}`),
			"the DESKTOP in-row Confirm is mounted on the phone",
		).toBeNull();
		expect(screen.getByTestId(`phone-sell-confirm-${L1}`)).toBeTruthy();
		expect(row.isConnected).toBe(true);
	});

	it("phone-host::POSITIVE-CONTROL-at-the-desktop-tier-the-IN-ROW-arm-mounts-and-no-sheet-exists", () => {
		// ⛔ Without this the row above passes against a component that mounts the
		// sheet unconditionally, which is the one change that would break the wall.
		mockTier(false);
		render(<PositionsTable payload={OWNER} />);
		fireEvent.click(screen.getByTestId(`tile-sell-${L1}`));
		expect(screen.getByTestId(`tile-confirm-${L1}`)).toBeTruthy();
		expect(screen.queryByTestId("phone-sheet-body")).toBeNull();
		expect(screen.queryByTestId(`phone-sell-confirm-${L1}`)).toBeNull();
	});

	it("phone-host::⛔-THE-SHEET-IS-INSIDE-THE-ARMED-ROW-read-off-the-DOM", () => {
		// ⛔⛔ THIS REPLACES A SOURCE PROXY THAT DID NOT ESTABLISH WHAT IT CLAIMED.
		// The guard in `phone-round-five.test.ts` walked back to the nearest `<td`
		// and forward to the nearest `</td>` — two file-wide `indexOf`s, which hold
		// for a mount almost anywhere inside a table component. `@test-writer`
		// hoisted the sheet clean out of the `<tr>` into a fragment sibling, added
		// one unrelated `<td>` later in the file, and the guard stayed GREEN.
		// `contains` is not a proxy for containment; it IS containment.
		const { row } = armOnPhone();
		const sheet = screen.getByTestId("phone-sheet-body");
		expect(
			row.contains(sheet),
			"the sheet is not inside the armed row — outside it, `useInlineSell`'s " +
				"outside-click predicate cancels the arm on the FIRST tap inside the " +
				"sheet, Confirm included",
		).toBe(true);
	});

	it("phone-host::a-pointerdown-INSIDE-the-sheet-does-not-cancel-the-arm", () => {
		// The consequence containment exists for, and the one a reader would feel:
		// the sheet opens, they touch it, and it vanishes with the sale undone.
		const { row } = armOnPhone();
		const confirm = screen.getByTestId(`phone-sell-confirm-${L1}`);
		fireEvent.pointerDown(confirm, { bubbles: true });
		expect(
			screen.queryByTestId("phone-sheet-body"),
			"the first touch inside the sheet closed it",
		).not.toBeNull();
		// ⛔ POSITIVE CONTROL — the same listener, a tap OUTSIDE the row, which MUST
		// cancel. Without it the row above passes against a predicate that never
		// fires at all.
		fireEvent.pointerDown(document.body, { bubbles: true });
		expect(
			screen.queryByTestId("phone-sheet-body"),
			"a tap outside the row left the sell armed — the outside-click predicate " +
				"is not wired, so the row above proves nothing",
		).toBeNull();
		expect(row.isConnected).toBe(true);
	});

	it("phone-host::⛔-MONEY-the-wire-carries-the-EXACT-held-quantity-not-the-displayed-figure", async () => {
		// ⛔⛔ THE GAP THIS ROW CLOSES WAS A HOST WIRING GAP, NOT A LEAF GAP. The
		// leaf's own `seedExact={props.seedExact}` IS guarded; mutating the HOST's
		// `seedExact={tile.currentExact}` to `tile.valueDisplay` — the rounded
		// figure — passed all 3 643 unit tests. `sellSharesFor` returns the whole
		// surviving quantity byte-identically only when the submitted figure equals
		// the current value EXACTLY, so the rounded seed turns "sell everything"
		// into a division and a floor, and strands dust that can never be sold.
		// The desktop path has two rows for exactly this; the phone had none.
		armOnPhone();
		fireEvent.click(screen.getByTestId(`phone-sell-confirm-${L1}`));
		await waitFor(() => expect(calls).toBe(1));
		expect(
			lastBody?.shares,
			"the phone sell submitted something other than the whole holding — the " +
				"sheet was seeded with the DISPLAYED figure, and the remainder is dust",
		).toBe(dp18("10"));
		expect(lastBody?.lotId).toBe(L1);
	});

	it("phone-host::the-field-shows-the-ROUNDED-figure-while-submitting-the-exact-one", () => {
		// The other half of the same law: the reader sees `31`, the wire sees 31.4.
		armOnPhone();
		const input = screen.getByTestId(
			`tile-sell-amount-${L1}`,
		) as HTMLInputElement;
		expect(input.value).toBe("31");
	});

	it("phone-host::the-body-lock-goes-ON-with-the-sheet-and-comes-back-OFF", () => {
		expect(document.body.style.overflow).toBe("");
		armOnPhone();
		expect(
			document.body.style.overflow,
			"the sheet is up and the document behind it still scrolls",
		).toBe("hidden");
		fireEvent.keyDown(document, { key: "Escape" });
		expect(screen.queryByTestId("phone-sheet-body")).toBeNull();
		expect(
			document.body.style.overflow,
			"the lock outlived the sheet — the page is now unscrollable with nothing " +
				"on screen to explain it",
		).toBe("");
	});
});
