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
 * POSREV-1 RF-5/6/7 — **THE INLINE TWO-STEP SELL.**
 *
 * ⚠⚠ THIS FILE REPLACES THE SLICE-7 SELL-MOUNT SUITE, AND THE SUBJECT CHANGED
 * RATHER THAN THE MECHANISM. It used to assert that a per-MARKET row slid the
 * shipped `SellModule` into a 50px host below itself. There is no market row
 * left to slide anything under: the table's unit is the ARGUMENT, so the control
 * lives in the tile's own last column and arms in place. `SellModule` is left on
 * disk, unmounted — RF-5 says "just remove this mount", and it is mounted
 * nowhere else in `src/`.
 *
 * **F-PROF-3 survives untouched and is still the load-bearing law:** a Sell
 * affordance exists ONLY on the owner arm's `sellEligible` rows. The visitor
 * payload carries no `sellEligible` field at all, so a trigger cannot render —
 * that is a DTO boundary, not a render condition, and the assertion for it is
 * kept exactly as it was.
 *
 * ⚠⚠ **THE SEED TEST IS THE ONE THAT MATTERS.** `sellSharesFor` returns the held
 * quantity byte-identically only when `dharmaIn` equals `currentValue` EXACTLY.
 * The field DISPLAYS a rounded figure; if an untouched field submitted what it
 * displayed, "sell everything" would become a division, floor, and strand dust
 * that can never be sold. So the wire body is intercepted and the SHARES it
 * carries are asserted to be the whole surviving quantity — which can only
 * happen if the exact seed went in.
 *
 * Fixtures are inline plain objects on the shipped DTOs — no server code runs,
 * no DB. Neutral market titles; no market content is invented (CLAUDE.md §3).
 */

afterEach(cleanup);

const M1 = "0190c0de-aaaa-7000-8000-000000000001"; // Open market — sellable
const M2 = "0190c0de-bbbb-7000-8000-000000000002"; // Resolved — settled
const L1 = "0190c0de-1010-7000-8000-000000000001";
const L2 = "0190c0de-1010-7000-8000-000000000002";
const C_OPENER = "0190c0de-ffff-7000-8000-000000000044";

const dp18 = (v: string): string => {
	const [int, frac = ""] = v.split(".");
	return `${int}.${frac.padEnd(18, "0")}`;
};

function lot(
	lotId: string,
	over: Partial<ProfilePositionLot> = {},
): ProfilePositionLot {
	return {
		lotId,
		betId: `bet-${lotId}`,
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
	lots: [lot(L1)],
	marketId: M1,
	marketSlug: "fixture-alpha",
	marketTitle: "Market fixture-alpha",
	marketStatus: "Open",
	statusLabel: "Open",
	settled: false,
	side: "YES",
	quantity: dp18("10"),
	staked: dp18("25"),
	// ⚠ NOT A ROUND NUMBER, deliberately. The displayed figure is `Đ 31`; the
	// exact one is 31.4, so "displayed" and "exact" are DISTINGUISHABLE and the
	// seed assertion below cannot pass by coincidence.
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

const ROW_SETTLED: ProfilePositionRow = {
	lots: [lot(L2, { lotId: L2, argument: { removed: true, marketSlug: "b" } })],
	marketId: M2,
	marketSlug: "fixture-beta",
	marketTitle: "Market fixture-beta",
	marketStatus: "Resolved",
	statusLabel: "Closed",
	settled: true,
	side: "NO",
	quantity: dp18("4"),
	staked: dp18("8"),
	current: dp18("12"),
	argument: { removed: true, marketSlug: "fixture-beta" },
};

const OWNER: ProfilePositionsPayload = {
	owner: true,
	rows: [
		{ ...ROW_OPEN, sellEligible: true },
		{ ...ROW_SETTLED, sellEligible: false },
	],
};
const VISITOR: ProfilePositionsPayload = {
	owner: false,
	rows: [ROW_OPEN, ROW_SETTLED],
};

/** The last body posted to `/api/bets/sell`, parsed. */
let lastBody: Record<string, unknown> | null = null;

beforeEach(() => {
	lastBody = null;
	refresh.mockClear();
	vi.stubGlobal(
		"fetch",
		vi.fn(async (_url: string, init: RequestInit) => {
			lastBody = JSON.parse(String(init.body));
			return new Response(JSON.stringify({ ok: true, data: { sold: true } }), {
				status: 200,
				headers: { "content-type": "application/json" },
			});
		}),
	);
});

describe("F-PROF-3 — the Sell affordance is OWNER-ONLY (unchanged law)", () => {
	it("sell::the-owner-arm-renders-a-trigger-on-a-sellable-tile", () => {
		render(<PositionsTable payload={OWNER} />);
		expect(screen.getByTestId(`tile-sell-${L1}`)).toBeTruthy();
	});

	it("sell::a-VISITOR-payload-renders-NO-trigger-anywhere", () => {
		// ⛔ THE DTO BOUNDARY, NOT A RENDER CONDITION. The visitor arm carries no
		// `sellEligible` field at all, so "Sell is never present in a visitor
		// payload" is enforced by the shape of the type.
		const { container } = render(<PositionsTable payload={VISITOR} />);
		expect(container.querySelector('[data-testid^="tile-sell-"]')).toBeNull();
	});

	it("sell::a-SETTLED-tile-carries-no-trigger-even-for-the-owner", () => {
		render(<PositionsTable payload={OWNER} />);
		// The settled row's argument is fully held but its market is Resolved, so
		// `isSellEligible` refuses it; the tile still renders, the control does not.
		fireEvent.click(screen.getByTestId("positions-status-open"));
		expect(screen.queryByTestId(`tile-sell-${L2}`)).toBeNull();
	});
});

describe("RF-5/6 — arming is a two-step with three ways out", () => {
	it("sell::pressing-SELL-turns-the-Current-cell-into-an-amount-field", () => {
		render(<PositionsTable payload={OWNER} />);
		expect(screen.queryByTestId(`tile-sell-amount-${L1}`)).toBeNull();
		fireEvent.click(screen.getByTestId(`tile-sell-${L1}`));
		expect(screen.getByTestId(`tile-sell-amount-${L1}`)).toBeTruthy();
		expect(screen.getByTestId(`tile-confirm-${L1}`)).toBeTruthy();
		expect(screen.getByTestId(`tile-cancel-${L1}`)).toBeTruthy();
	});

	it("sell::the-delta-and-the-from-line-HIDE-while-the-field-is-open", () => {
		// ⚠ RF-5. A delta and a "from" beside an editable number answer a question
		// the reader has stopped asking, and the cell is 124px wide.
		render(<PositionsTable payload={OWNER} />);
		expect(screen.getByTestId(`tile-from-${L1}`)).toBeTruthy();
		fireEvent.click(screen.getByTestId(`tile-sell-${L1}`));
		expect(screen.queryByTestId(`tile-from-${L1}`)).toBeNull();
		expect(screen.queryByTestId(`tile-pl-${L1}`)).toBeNull();
	});

	it("sell::the-✕-cancels-and-restores-the-figure", () => {
		render(<PositionsTable payload={OWNER} />);
		fireEvent.click(screen.getByTestId(`tile-sell-${L1}`));
		fireEvent.click(screen.getByTestId(`tile-cancel-${L1}`));
		expect(screen.queryByTestId(`tile-sell-amount-${L1}`)).toBeNull();
		expect(screen.getByTestId(`tile-from-${L1}`)).toBeTruthy();
	});

	it("sell::ESCAPE-cancels", () => {
		render(<PositionsTable payload={OWNER} />);
		fireEvent.click(screen.getByTestId(`tile-sell-${L1}`));
		fireEvent.keyDown(document, { key: "Escape" });
		expect(screen.queryByTestId(`tile-sell-amount-${L1}`)).toBeNull();
	});

	it("sell::a-click-OUTSIDE-the-tile-cancels", async () => {
		// ⚠⚠ THE YIELD IS REQUIRED AND ITS ABSENCE IS A FALSE GREEN. A listener
		// armed in an effect is not attached until React has committed, so a
		// pointer event dispatched synchronously after `render()` can reach NO
		// listener at all — and a "does not dismiss" assertion written without the
		// yield then passes against a listener that was never armed. Awaiting a
		// macrotask puts the arming ahead of the dispatch.
		render(<PositionsTable payload={OWNER} />);
		fireEvent.click(screen.getByTestId(`tile-sell-${L1}`));
		await new Promise((r) => setTimeout(r, 0));
		fireEvent.pointerDown(document.body);
		await waitFor(() =>
			expect(screen.queryByTestId(`tile-sell-amount-${L1}`)).toBeNull(),
		);
	});

	it("sell::a-click-INSIDE-the-tile-does-NOT-cancel (the control)", async () => {
		// ⛔ THE CONTROL FOR THE ROW ABOVE, and it is the reason that row can be
		// trusted: it exercises the SAME armed listener and requires it NOT to fire.
		// Without it, "outside dismisses" and "nothing is listening" are the same
		// observation.
		render(<PositionsTable payload={OWNER} />);
		fireEvent.click(screen.getByTestId(`tile-sell-${L1}`));
		await new Promise((r) => setTimeout(r, 0));
		fireEvent.pointerDown(screen.getByTestId(`tile-sell-amount-${L1}`));
		expect(screen.getByTestId(`tile-sell-amount-${L1}`)).toBeTruthy();
	});
});

describe("RF-7 — the seed, which is where money is lost", () => {
	it("sell::an-UNTOUCHED-field-submits-the-EXACT-value-not-the-displayed-one", async () => {
		// ⚠⚠ THE ASSERTION THIS WHOLE FEATURE TURNS ON. The holding is worth
		// `31.4`; the field DISPLAYS `31`. `sellSharesFor` returns the held quantity
		// byte-identically only when `dharmaIn` equals `currentValue` exactly — so
		// submitting the DISPLAYED `31` would divide (10 × 31 ÷ 31.4 = 9.872…) and
		// leave 0.127… shares behind that can never be sold, because they are
		// smaller than the argument they belong to.
		// ⇒ The wire body carries the full surviving quantity IFF the exact seed
		// went in. Asserting the SHARES rather than the amount is what makes this
		// test read the thing that reaches the engine.
		render(<PositionsTable payload={OWNER} />);
		// The displayed seed really is the rounded figure — stated, so the test
		// above is not silently asserting against an unrounded field.
		fireEvent.click(screen.getByTestId(`tile-sell-${L1}`));
		expect(
			(screen.getByTestId(`tile-sell-amount-${L1}`) as HTMLInputElement).value,
		).toBe("31");
		fireEvent.click(screen.getByTestId(`tile-confirm-${L1}`));
		await waitFor(() => expect(lastBody).not.toBeNull());
		expect(lastBody?.shares).toBe(dp18("10"));
		expect(lastBody?.lotId).toBe(L1);
	});

	it("sell::THE-CONTROL-submitting-the-DISPLAYED-figure-strands-dust", async () => {
		// ⛔⛔ WITHOUT THIS ROW THE TEST ABOVE PROVES NOTHING. It asserts the wire
		// carried the whole surviving quantity — but if the displayed figure and the
		// exact one happened to convert to the SAME shares, it would pass just as
		// happily on a build that submits the displayed one. So this submits the
		// displayed figure and requires the result to DIFFER.
		//
		// ⚠⚠ IT HAS TO EDIT TWICE, AND THE FIRST ATTEMPT AT THIS TEST DID NOT.
		// A single `change` to `"31"` is a NO-OP: the field ALREADY displays `31`,
		// and React does not dispatch a change event for a value that did not
		// change — so the draft stayed untouched, the exact seed went out, and the
		// control reddened against the very build it was written to clear. Going
		// via another value is what makes the second keystroke a real edit.
		//
		// 10 × 31 ÷ 31.4 = 9.872611464968152866, floored at 18 dp. The 0.127… shares
		// left behind are the dust: smaller than the argument they belong to, and
		// unsellable afterwards.
		//
		// ⚠ THIS IS THE RULED BEHAVIOUR, NOT A DEFECT — RF-7: "if the user never
		// edits the field, submit the exact value; if the user does edit it, submit
		// what they typed." Someone who types `31` has typed thirty-one and gets
		// thirty-one. The cost is named rather than smoothed over: re-typing the
		// figure already on screen is not the same as leaving it there.
		render(<PositionsTable payload={OWNER} />);
		fireEvent.click(screen.getByTestId(`tile-sell-${L1}`));
		const field = screen.getByTestId(`tile-sell-amount-${L1}`);
		fireEvent.change(field, { target: { value: "3" } });
		fireEvent.change(field, { target: { value: "31" } });
		fireEvent.click(screen.getByTestId(`tile-confirm-${L1}`));
		await waitFor(() => expect(lastBody).not.toBeNull());
		expect(lastBody?.shares).not.toBe(dp18("10"));
		expect(lastBody?.shares).toBe("9.872611464968152866");
	});

	it("sell::an-EDITED-field-submits-what-was-typed", async () => {
		render(<PositionsTable payload={OWNER} />);
		fireEvent.click(screen.getByTestId(`tile-sell-${L1}`));
		fireEvent.change(screen.getByTestId(`tile-sell-amount-${L1}`), {
			target: { value: "15.7" },
		});
		fireEvent.click(screen.getByTestId(`tile-confirm-${L1}`));
		await waitFor(() => expect(lastBody).not.toBeNull());
		// 10 × 15.7 ÷ 31.4 = exactly 5, and it is NOT the whole quantity — which is
		// what distinguishes a partial sale from the full-exit branch above.
		expect(lastBody?.shares).toBe(dp18("5"));
	});

	it("sell::typing-ABOVE-the-maximum-CLAMPS-SILENTLY-back-to-the-exact-seed", async () => {
		// ⚠ RF-6: no error state — the correct answer is available, so it is used.
		// ⛔ AND THE CLAMP RETURNS THE FIELD TO UNTOUCHED rather than writing the
		// rounded maximum into it. Writing `31` would make "type a big number"
		// submit the DISPLAYED figure, which is exactly the dust defect above.
		render(<PositionsTable payload={OWNER} />);
		fireEvent.click(screen.getByTestId(`tile-sell-${L1}`));
		fireEvent.change(screen.getByTestId(`tile-sell-amount-${L1}`), {
			target: { value: "9999" },
		});
		expect(
			(screen.getByTestId(`tile-sell-amount-${L1}`) as HTMLInputElement).value,
		).toBe("31");
		fireEvent.click(screen.getByTestId(`tile-confirm-${L1}`));
		await waitFor(() => expect(lastBody).not.toBeNull());
		expect(lastBody?.shares).toBe(dp18("10"));
	});

	it("sell::the-request-carries-an-idempotency-key", async () => {
		// The §3.2 key law — reused plumbing, so this asserts the reuse rather than
		// the law. A retry after a dropped socket must replay, not double-sell.
		render(<PositionsTable payload={OWNER} />);
		fireEvent.click(screen.getByTestId(`tile-sell-${L1}`));
		fireEvent.click(screen.getByTestId(`tile-confirm-${L1}`));
		await waitFor(() => expect(lastBody).not.toBeNull());
		const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
		const headers = (call?.[1] as RequestInit).headers as Record<
			string,
			string
		>;
		expect(Object.keys(headers).join(" ").toLowerCase()).toContain(
			"idempotency",
		);
	});
});

describe("RF-6 — only one tile arms at a time", () => {
	it("sell::arming-a-SECOND-tile-closes-the-first", () => {
		// ⛔ TWO LIVE MONEY INPUTS ON ONE SCREEN is how someone sells the argument
		// next to the one they meant. The armed id is a single value, so this is
		// structural — but it is asserted because "structural" is a claim about the
		// code and this is a claim about the screen.
		const twoLots: ProfilePositionsPayload = {
			owner: true,
			rows: [
				{
					...ROW_OPEN,
					lots: [lot(L1), lot(L2, { lotId: L2 })],
					quantity: dp18("20"),
					sellEligible: true,
				},
			],
		};
		render(<PositionsTable payload={twoLots} />);
		fireEvent.click(screen.getByTestId(`tile-sell-${L1}`));
		expect(screen.getByTestId(`tile-sell-amount-${L1}`)).toBeTruthy();
		fireEvent.click(screen.getByTestId(`tile-sell-${L2}`));
		expect(screen.queryByTestId(`tile-sell-amount-${L1}`)).toBeNull();
		expect(screen.getByTestId(`tile-sell-amount-${L2}`)).toBeTruthy();
	});
});

describe("RF-7 — a FULL exit dwells on `Sold` before it leaves", () => {
	it("sell::the-tile-says-Sold-in-place-rather-than-vanishing", async () => {
		// ⚠ NOT DECORATION. Without the beat, someone presses a money button and
		// the thing they were looking at silently disappears — which reads as a bug
		// even when it worked exactly as intended.
		render(<PositionsTable payload={OWNER} />);
		fireEvent.click(screen.getByTestId(`tile-sell-${L1}`));
		fireEvent.click(screen.getByTestId(`tile-confirm-${L1}`));
		await waitFor(() =>
			expect(screen.getByTestId(`tile-sold-${L1}`)).toBeTruthy(),
		);
		// ⛔ THE PREDICATE IS THE BYTE-IDENTICAL FULL-EXIT BRANCH, never a
		// comparison of printed figures: the whole surviving quantity went out.
		expect(lastBody?.shares).toBe(dp18("10"));
	});

	it("sell::a-PARTIAL-sale-shows-NO-tag-and-returns-to-Sell", async () => {
		// RF-7: "figures reduce" is the entire signal; a tag would say more than
		// happened.
		render(<PositionsTable payload={OWNER} />);
		fireEvent.click(screen.getByTestId(`tile-sell-${L1}`));
		fireEvent.change(screen.getByTestId(`tile-sell-amount-${L1}`), {
			target: { value: "15.7" },
		});
		fireEvent.click(screen.getByTestId(`tile-confirm-${L1}`));
		await waitFor(() => expect(refresh).toHaveBeenCalled());
		expect(screen.queryByTestId(`tile-sold-${L1}`)).toBeNull();
		expect(screen.getByTestId(`tile-sell-${L1}`)).toBeTruthy();
	});
});
