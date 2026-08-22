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

describe("§3.2 — ONE IDEMPOTENCY KEY PER SELL INTENT", () => {
	const key = (call: unknown[]): string => {
		const headers = (call[1] as RequestInit).headers as Record<string, string>;
		const k = Object.keys(headers).find((h) =>
			h.toLowerCase().includes("idempotency"),
		);
		return k === undefined ? "" : (headers[k] ?? "");
	};

	it("sell::a-SECOND-sell-uses-a-DIFFERENT-key", async () => {
		// ⛔⛔ WITHOUT THIS, THE SECOND SELL ON A PAGE CAN NEVER SUCCEED, and the
		// failure is invisible in every other test here because they all sell once.
		//
		// `reduceKey` mints a new key ONLY on `EDIT` out of a `fresh_*` pending
		// state, or on `COUNTDOWN_EXPIRED`. A SUCCESSFUL outcome lands on
		// `pending: "none"`, where `EDIT` deliberately does NOT rotate — "one key
		// per intent — pre-submit edits never rotate". So a hook that outlives its
		// controls carries ONE key across every tile: sell A under K, then sell B
		// under the same K with a DIFFERENT body, and the canonical-JSON
		// fingerprint mismatch returns 409 `error_idempotency_key_reused` — which
		// lands `pending: "refresh_then_edit"`, a state this component never
		// leaves. The button would read `Retry` forever for a request that cannot
		// succeed.
		//
		// ⚠ THE SHIPPED `SellModule` NEVER HIT THIS: it is mounted per expansion
		// and remounts with a fresh key each time it opens. Its rotation was
		// component identity, not reducer behaviour — so the precedent looked safe
		// and did not transfer.
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
		fireEvent.click(screen.getByTestId(`tile-confirm-${L1}`));
		await waitFor(() => expect(lastBody).not.toBeNull());

		fireEvent.click(screen.getByTestId(`tile-sell-${L2}`));
		fireEvent.click(screen.getByTestId(`tile-confirm-${L2}`));
		await waitFor(() =>
			expect(
				(globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.length,
			).toBe(2),
		);

		const calls = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls;
		const k1 = key(calls[0] as unknown[]);
		const k2 = key(calls[1] as unknown[]);
		expect(k1).not.toBe("");
		expect(k2).not.toBe("");
		// ⛔ THE ASSERTION. Two intents, two keys.
		expect(k2).not.toBe(k1);
		// …and the second request really did name the second argument, so this is
		// two distinct sells rather than one sent twice.
		expect(lastBody?.lotId).toBe(L2);
	});

	it("sell::re-arming-the-SAME-tile-also-re-keys", async () => {
		// Arming is the intent boundary, not the tile. Someone who sells part of an
		// argument and immediately sells more of it is making a second request with
		// a different body, and it needs its own key for exactly the same reason.
		render(<PositionsTable payload={OWNER} />);
		fireEvent.click(screen.getByTestId(`tile-sell-${L1}`));
		fireEvent.change(screen.getByTestId(`tile-sell-amount-${L1}`), {
			target: { value: "5" },
		});
		fireEvent.click(screen.getByTestId(`tile-confirm-${L1}`));
		await waitFor(() => expect(lastBody).not.toBeNull());

		fireEvent.click(screen.getByTestId(`tile-sell-${L1}`));
		fireEvent.click(screen.getByTestId(`tile-confirm-${L1}`));
		await waitFor(() =>
			expect(
				(globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.length,
			).toBe(2),
		);
		const calls = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls;
		expect(key(calls[1] as unknown[])).not.toBe(key(calls[0] as unknown[]));
	});
});

describe("§3.2 — a FAILED sell must not invite a second one", () => {
	const key = (call: unknown[]): string => {
		const headers = (call[1] as RequestInit).headers as Record<string, string>;
		const k = Object.keys(headers).find((h) =>
			h.toLowerCase().includes("idempotency"),
		);
		return k === undefined ? "" : (headers[k] ?? "");
	};

	/** Make the next wire call return a terminal 4xx envelope. */
	function failWith(code: string, status = 400) {
		vi.stubGlobal(
			"fetch",
			vi.fn(async (_u: string, init: RequestInit) => {
				lastBody = JSON.parse(String(init.body));
				return new Response(JSON.stringify({ ok: false, error: { code } }), {
					status,
					headers: { "content-type": "application/json" },
				});
			}),
		);
	}

	it("sell::a-FAILURE-refreshes-so-Retry-is-never-offered-over-stale-figures", async () => {
		// ⛔⛔ THIS IS THE SECOND-EXECUTION GUARD, and it is the whole reason the
		// failure arms refresh at all.
		//
		// A request whose response is LOST may still have COMMITTED — the sale is
		// written, the 200 never arrives. Without a refresh the tile keeps its
		// pre-sale figures, so the participant reads `Retry` above numbers saying
		// nothing happened, and the honest interpretation of that screen is "sell it
		// again". Because arming mints a fresh key, that second attempt has nothing
		// for the idempotency layer to match and EXECUTES. They sell twice intending
		// once.
		// ⚠ Refreshing is harmless when the request genuinely did not land: the
		// figures come back unchanged.
		render(<PositionsTable payload={OWNER} />);
		failWith("error_market_not_open");
		fireEvent.click(screen.getByTestId(`tile-sell-${L1}`));
		fireEvent.click(screen.getByTestId(`tile-confirm-${L1}`));
		await waitFor(() => expect(refresh).toHaveBeenCalled());
	});

	it("sell::a-NETWORK-drop-refreshes-too (the lost-response case itself)", async () => {
		render(<PositionsTable payload={OWNER} />);
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => {
				throw new TypeError("network");
			}),
		);
		fireEvent.click(screen.getByTestId(`tile-sell-${L1}`));
		fireEvent.click(screen.getByTestId(`tile-confirm-${L1}`));
		await waitFor(() => expect(refresh).toHaveBeenCalled());
	});

	it("sell::a-key-reused-409-is-NOT-laundered-by-re-arming", async () => {
		// ⛔⛔ THE HAZARD THE PER-ARM KEY CREATES, CLOSED. A `key_reused` 409 lands
		// the F-2 protective landing — the state that exists precisely because the
		// earlier request MAY HAVE COMMITTED. Minting a fresh key on the next arm
		// would be the client answering "key reused" with "pick a new key", which
		// the sell route's own docblock names as the one instruction that turns a
		// completed sell into a second EXECUTED one.
		// ⇒ Re-arming from that state must REFRESH and advance, not mint.
		render(<PositionsTable payload={OWNER} />);
		failWith("error_idempotency_key_reused", 409);
		fireEvent.click(screen.getByTestId(`tile-sell-${L1}`));
		fireEvent.click(screen.getByTestId(`tile-confirm-${L1}`));
		await waitFor(() => expect(lastBody).not.toBeNull());
		refresh.mockClear();

		// ⚠ THE REALISTIC PATH, and it is the auditor's own: the tile stays ARMED
		// after a failure (showing `Retry`), so re-arming means cancelling first and
		// pressing Sell again — which is exactly what someone who believes nothing
		// happened would do.
		fireEvent.click(screen.getByTestId(`tile-cancel-${L1}`));
		fireEvent.click(screen.getByTestId(`tile-sell-${L1}`));
		// It refreshes rather than silently re-keying.
		await waitFor(() => expect(refresh).toHaveBeenCalled());

		// ⛔⛔ AND THE KEY IS THE ASSERTION, NOT THE REFRESH. A build that laundered
		// the landing would ALSO have refreshed somewhere and passed on the line
		// above; what distinguishes the two is whether arming MINTED. Submitting
		// again without editing must go out under the SAME key — so the idempotency
		// layer can still recognise the request that may already have committed.
		// A fresh key here is precisely "pick a new key", the answer that turns a
		// completed sell into a second executed one.
		const before = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls
			.length;
		fireEvent.click(screen.getByTestId(`tile-confirm-${L1}`));
		await waitFor(() =>
			expect(
				(globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.length,
			).toBe(before + 1),
		);
		const calls = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls;
		expect(key(calls[before] as unknown[])).toBe(key(calls[0] as unknown[]));
	});

	it("sell::a-protective-landing-is-ESCAPABLE-the-next-keystroke-mints", async () => {
		// ⛔⛔ THIS PINS AN ORDERING, AND NOTHING ELSE IN THE FILE DOES.
		//
		// After a `key_reused` 409 BOTH of `arm()`'s guards match at once: `pending`
		// is `refresh_then_edit` AND the held key is the one that went out unsettled.
		// Whichever guard is written first wins, and ONLY the first one dispatches
		// `REFRESHED`. So the order of those two `if`s is load-bearing, and it was
		// held in place by a comment alone — `@security-auditor` measured the swap and
		// found `pending` stuck at `refresh_then_edit` forever, where `EDIT` no-ops by
		// law (`idempotency.ts`). The key can then NEVER rotate: every Confirm 409s,
		// with no escape short of a page reload. That is the C-2 lockout again, worse,
		// because C-2 at least let a reload out of it.
		//
		// ⚠ THE TEST ABOVE DOES NOT CATCH IT. It asserts a refresh happened and that
		// the next submit rides the SAME key — both true of the swapped build too. The
		// distinguishing fact is what happens AFTER the refresh: `REFRESHED` must have
		// advanced the state to `edit_after_refresh`, so a keystroke mints. That is the
		// F-2 law's second half — fresh key only on the edit AFTER refresh — and it is
		// what makes the landing protective rather than terminal.
		render(<PositionsTable payload={OWNER} />);
		failWith("error_idempotency_key_reused", 409);
		fireEvent.click(screen.getByTestId(`tile-sell-${L1}`));
		fireEvent.click(screen.getByTestId(`tile-confirm-${L1}`));
		await waitFor(() =>
			expect(
				(globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.length,
			).toBe(1),
		);

		fireEvent.click(screen.getByTestId(`tile-cancel-${L1}`));
		fireEvent.click(screen.getByTestId(`tile-sell-${L1}`));
		// The keystroke that is only allowed to mint because `REFRESHED` landed.
		fireEvent.change(screen.getByTestId(`tile-sell-amount-${L1}`), {
			target: { value: "5" },
		});
		fireEvent.click(screen.getByTestId(`tile-confirm-${L1}`));
		await waitFor(() =>
			expect(
				(globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.length,
			).toBe(2),
		);
		const calls = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls;
		// ⛔ THE ASSERTION. There IS a way out of the landing.
		expect(key(calls[1] as unknown[])).not.toBe(key(calls[0] as unknown[]));
	});
});

/**
 * ⛔⛔ **A KEY THAT WENT OUT AND NEVER SETTLED IS HELD, NOT RE-MINTED.**
 *
 * The describe above closes the landing the SERVER names — a `key_reused` 409,
 * where `pending` becomes `refresh_then_edit` and the component can see it. These
 * three close the landings the server names NOTHING for.
 *
 * `reduceKey` lands `pending: "none"` on a SUCCESS and on a TRANSIENT alike, and
 * the two states are byte-identical. They mean opposite things: after a success
 * the key is spent and the next intent needs its own (that is C-2, and G3 below
 * is what keeps it closed); after a transient the key is held ON PURPOSE, because
 * the request may have COMMITTED and a retry under the same key replays the
 * original 200 out of the durable receipt instead of selling twice. `arm()` could
 * not tell them apart, so it minted over both.
 *
 * ⚠ **AND THE GUARD IS DELIBERATELY NOT KEYED ON `failed`.** That was the first
 * shape considered and it does not survive G1: `cancel()` clears `failed`, and
 * cancelling is exactly what someone does before pressing Sell again. `edit()`
 * clears it too, while a transient's key is still held. The marker has to be the
 * KEY THAT WENT ON THE WIRE, compared against the key currently held — see
 * `unsettledKeyRef` in `InlineSell.tsx`. Identity survives the UI flag being
 * reset, and it stops matching by itself the moment the reducer's own law rotates
 * the key.
 */
describe("§3.2 — an unsettled key survives cancel and re-arm", () => {
	const key = (call: unknown[]): string => {
		const headers = (call[1] as RequestInit).headers as Record<string, string>;
		const k = Object.keys(headers).find((h) =>
			h.toLowerCase().includes("idempotency"),
		);
		return k === undefined ? "" : (headers[k] ?? "");
	};

	/** Make every wire call return the given error envelope. */
	function failWithCode(code: string, status: number) {
		vi.stubGlobal(
			"fetch",
			vi.fn(async (_u: string, init: RequestInit) => {
				lastBody = JSON.parse(String(init.body));
				return new Response(JSON.stringify({ ok: false, error: { code } }), {
					status,
					headers: { "content-type": "application/json" },
				});
			}),
		);
	}

	it("sell::G1-a-NETWORK-drop-then-cancel-then-re-arm-retries-under-the-SAME-key", async () => {
		// ⛔⛔ THE LOST-RESPONSE CASE, WHICH IS THE ONE THAT COSTS MONEY. The sale
		// may be written and the 200 simply never arrived. The held key is the only
		// thing that makes the retry a REPLAY — the durable receipt matches it and
		// returns the original outcome. Mint a new one and the same sale executes a
		// second time, which is the corruption direction `idempotency.ts` names.
		// ⚠ THE PATH IS THE REALISTIC ONE, and it is the path a `failed`-keyed guard
		// fails: the tile stays armed showing `Retry`, so someone who believes
		// nothing happened CANCELS and presses Sell again. `cancel()` clears
		// `failed`; it does not clear the fact that a request is outstanding.
		render(<PositionsTable payload={OWNER} />);
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => {
				throw new TypeError("network");
			}),
		);
		fireEvent.click(screen.getByTestId(`tile-sell-${L1}`));
		fireEvent.click(screen.getByTestId(`tile-confirm-${L1}`));
		await waitFor(() =>
			expect(
				(globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.length,
			).toBe(1),
		);

		fireEvent.click(screen.getByTestId(`tile-cancel-${L1}`));
		fireEvent.click(screen.getByTestId(`tile-sell-${L1}`));
		fireEvent.click(screen.getByTestId(`tile-confirm-${L1}`));
		await waitFor(() =>
			expect(
				(globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.length,
			).toBe(2),
		);

		const calls = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls;
		expect(key(calls[0] as unknown[])).not.toBe("");
		// ⛔ THE ASSERTION. One outstanding request, one key.
		expect(key(calls[1] as unknown[])).toBe(key(calls[0] as unknown[]));
	});

	it("sell::G2-a-429-is-not-walked-past-by-re-arming-and-the-next-keystroke-re-keys", async () => {
		// ⛔⛔ THE SHARPER MOUTH OF THE SAME GAP. `fresh_on_enable` exists to BLOCK
		// submit until a countdown expires — and this component mounts no countdown,
		// so `COUNTDOWN_EXPIRED` never arrives. Arming was the one path that left
		// that state at all, and it left it under a brand-new key: press Sell again
		// and the rate limit is simply gone.
		render(<PositionsTable payload={OWNER} />);
		failWithCode("error_rate_limit_exceeded", 429);
		fireEvent.click(screen.getByTestId(`tile-sell-${L1}`));
		fireEvent.click(screen.getByTestId(`tile-confirm-${L1}`));
		await waitFor(() =>
			expect(
				(globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.length,
			).toBe(1),
		);

		fireEvent.click(screen.getByTestId(`tile-cancel-${L1}`));
		fireEvent.click(screen.getByTestId(`tile-sell-${L1}`));
		fireEvent.click(screen.getByTestId(`tile-confirm-${L1}`));
		// ⛔⛔ THE ASSERTION, AND IT IS AN ABSENCE WITH A REASON. The submit is
		// REFUSED by the reducer because `pending` is still `fresh_on_enable` — which
		// it can only be if arming left the key state alone. Had arming minted, the
		// fresh state's `pending: "none"` would have accepted the submit and this
		// count would be 2. So "no second request" is precisely "no mint".
		await waitFor(() =>
			expect(screen.getByTestId(`tile-confirm-${L1}`).textContent).toBe(
				"Retry",
			),
		);
		expect(
			(globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.length,
		).toBe(1);

		// …and the reducer's own exit still works: an EDIT out of `fresh_on_enable`
		// mints, which is the law this guard must not have broken while closing the
		// bypass. Without this half, "the 429 holds" would be indistinguishable from
		// "the control is bricked after a 429".
		fireEvent.change(screen.getByTestId(`tile-sell-amount-${L1}`), {
			target: { value: "5" },
		});
		fireEvent.click(screen.getByTestId(`tile-confirm-${L1}`));
		await waitFor(() =>
			expect(
				(globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.length,
			).toBe(2),
		);
		const calls = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls;
		expect(key(calls[1] as unknown[])).not.toBe(key(calls[0] as unknown[]));
	});

	it("sell::G3-POSITIVE-CONTROL-a-SUCCESSFUL-sell-still-re-keys-the-next-tile", async () => {
		// ⛔⛔ THE CONTROL THAT MAKES THE OTHER TWO MEAN ANYTHING. G1 and G2 both
		// assert that arming does NOT mint — and DELETING the mint outright would
		// pass both of them. That is not a hypothetical regression: it is C-2, the
		// original finding, where one key spans every tile on the page and the
		// SECOND sell can never succeed, because the same key with a different body
		// fingerprints differently and comes back 409 forever.
		// ⇒ So a success must still re-key. `unsettledKeyRef` is released on exactly
		// one path — the success arm — and this is the assertion that the release is
		// real rather than a comment.
		// ⚠ Overlaps `sell::two-tiles-two-keys` above by design. That one guards the
		// C-2 fix; this one guards the C-2 fix AGAINST ITS OWN GUARD.
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
		fireEvent.click(screen.getByTestId(`tile-confirm-${L1}`));
		await waitFor(() =>
			expect(
				(globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.length,
			).toBe(1),
		);

		fireEvent.click(screen.getByTestId(`tile-sell-${L2}`));
		fireEvent.click(screen.getByTestId(`tile-confirm-${L2}`));
		await waitFor(() =>
			expect(
				(globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.length,
			).toBe(2),
		);

		const calls = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls;
		expect(key(calls[0] as unknown[])).not.toBe("");
		expect(key(calls[1] as unknown[])).not.toBe("");
		expect(key(calls[1] as unknown[])).not.toBe(key(calls[0] as unknown[]));
	});
});

describe("the control must not look pressable when it is not", () => {
	it("sell::CONFIRM-is-disabled-when-the-share-falls-below-one-quantum", () => {
		// ⛔ REACHABLE, not theoretical. CPMM prices live in (0,1), so a
		// one-quantum lot's share of the mark can round below 1e-18 and seed
		// canonical zero. `sellSharesFor` then refuses the non-positive amount, and
		// an ENABLED Confirm would do nothing at all, with no feedback — a money
		// button that lies. The shipped `SellModule` handled the same state by
		// disabling; this is that, per tile.
		const dust: ProfilePositionsPayload = {
			owner: true,
			rows: [
				{
					...ROW_OPEN,
					// One quantum of shares against a large holding ⇒ the partition
					// floors to zero.
					lots: [lot(L1, { survivingShares: "0.000000000000000001" })],
					quantity: dp18("1000000"),
					current: dp18("1"),
					sellEligible: true,
				},
			],
		};
		render(<PositionsTable payload={dust} />);
		fireEvent.click(screen.getByTestId(`tile-sell-${L1}`));
		expect(
			(screen.getByTestId(`tile-confirm-${L1}`) as HTMLButtonElement).disabled,
		).toBe(true);
	});

	it("sell::CONFIRM-is-ENABLED-on-an-ordinary-tile (the control)", () => {
		// Without this, "disabled" would pass on a build where Confirm is never
		// enabled at all.
		render(<PositionsTable payload={OWNER} />);
		fireEvent.click(screen.getByTestId(`tile-sell-${L1}`));
		expect(
			(screen.getByTestId(`tile-confirm-${L1}`) as HTMLButtonElement).disabled,
		).toBe(false);
	});
});

describe("the whole-holding fallback — a held position is never unreachable", () => {
	/** A holding whose lots are ALL SOLD while the position is still held. */
	const DRIFTED: ProfilePositionsPayload = {
		owner: true,
		rows: [
			{
				...ROW_OPEN,
				// ⚠ NOT an empty array — `loadLotDecomposition` returns SOLD lots too,
				// so the drift shape has lots and no SURVIVING one.
				lots: [
					lot(L1, {
						survivingShares: dp18("0"),
						survivingBasis: dp18("0"),
						sold: true,
					}),
				],
				quantity: dp18("10"),
				sellEligible: true,
			},
		],
	};

	it("fallback::all-lots-sold-but-still-held-renders-an-OPEN-tile-with-SELL", () => {
		// ⛔⛔ THE SECOND SHAPE OF THE SAME VETO, and the narrow predicate
		// (`lots.length === 0`) missed it. `planLotSale`'s own lot query filters
		// `surviving_shares > 0`, so "lots exist, all zeroed, position still held"
		// IS its `rows.length === 0` arm — the one whose comment reads "an
		// attribution layer must never be able to veto the authority it describes."
		// Under the narrow predicate this row produced no Open tile and no
		// fallback, the tab derivation sent the reader to Closed, and the only
		// tiles there carry no Sell column. The holding was reachable nowhere that
		// could exit it.
		render(<PositionsTable payload={DRIFTED} />);
		// The tab derivation must land on Open, not Closed.
		expect(
			screen.getByTestId("positions-status-open").getAttribute("aria-pressed"),
		).toBe("true");
		// One fallback tile, keyed by MARKET (it names no argument), with a Sell.
		expect(screen.getByTestId(`position-tile-${M1}`)).toBeTruthy();
		expect(screen.getByTestId(`tile-sell-${M1}`)).toBeTruthy();
	});

	it("fallback::its-sell-OMITS-lotId-so-it-sells-the-POSITION", async () => {
		// ⛔ `undefined`, never `null`. `buildSellRequest` drops the key entirely;
		// `{marketId,shares}` and `{marketId,shares,lotId:null}` canonicalize to
		// DIFFERENT fingerprints, and a retry reaching for the fuller form would
		// come back 409 `error_idempotency_key_reused` — the one answer that turns
		// a completed sell into a second executed one.
		render(<PositionsTable payload={DRIFTED} />);
		fireEvent.click(screen.getByTestId(`tile-sell-${M1}`));
		fireEvent.click(screen.getByTestId(`tile-confirm-${M1}`));
		await waitFor(() => expect(lastBody).not.toBeNull());
		expect("lotId" in (lastBody ?? {})).toBe(false);
		expect(lastBody?.shares).toBe(dp18("10"));
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
