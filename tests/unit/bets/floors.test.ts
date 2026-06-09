import { describe, expect, it } from "vitest";
import {
	BelowPostFloorError,
	BelowReplyFloorError,
} from "@/server/bets/errors";
import { assertStakeFloor } from "@/server/bets/floors";
import {
	BET_MIN_STAKE_POST,
	BET_MIN_STAKE_REPLY,
} from "@/server/config/limits";

// ENGINE.8 §5.6 tests-first — the two-floor validator (plan §"The two-floor
// validator (Q1)" + §"File plan" → `src/server/bets/floors.ts`). The INV-1
// atomic comment+bet write is parameterized (`parentCommentId: string | null`)
// and ENGINE.8 ships the validator so DEBATE.2 inherits a TESTED selector;
// ENGINE.8's place route exercises ONLY the post branch, but BOTH branches are
// pinned here.
//
// PURE / DB-INDEPENDENT (locally-RED → the real RED→GREEN receipt). Touches no
// Postgres; it REDs NOW purely on the greenfield value imports — `floors.ts`
// and the `BelowPostFloorError` / `BelowReplyFloorError` product classes don't
// exist on disk until execute — and GREENs the moment they land. This is the
// local executable receipt the parent runs to capture RED.
//
// PINNED PUBLIC-API CONTRACT (the implementer matches these names exactly):
//   assertStakeFloor({ parentCommentId, stake }: {
//     parentCommentId: string | null;
//     stake: string;             // a NUMERIC(38,18) DECIMAL STRING, never a float
//   }): void                     // returns void on pass; THROWS on violation
//
//   selection rule: parentCommentId === null ? POST floor : REPLY floor
//   below the selected floor → throws BelowPostFloorError | BelowReplyFloorError
//   at/above (>= semantics) → no throw
//
// All stake comparisons cross the boundary as DECIMAL STRINGS (CLAUDE.md §2 —
// never JS floats for stakes). `BET_MIN_STAKE_REPLY` is pinned at 50 (ADR-0018);
// `BET_MIN_STAKE_POST` is a HARDEN.6 placeholder — the tests read it live rather
// than hard-coding it so a future tuning pass doesn't make them stale.

// String forms of "floor − 1", "floor", "floor + 1" derived from the live
// constants. The constants are decimal STRINGS; the +/- helpers stay integer-
// string only (the placeholder/pinned values are whole numbers), never floats.
// BigInt(1) — NOT the `1n` literal: tsconfig targets ES2017, where bigint
// literals are a TS2737 error (project memory: es2017-bigint-literals). The
// `BigInt` value + global are available; only the LITERAL syntax is barred.
const ONE = BigInt(1);
function below(floor: string): string {
	return String(BigInt(floor.split(".")[0] ?? floor) - ONE);
}
function above(floor: string): string {
	return String(BigInt(floor.split(".")[0] ?? floor) + ONE);
}

describe("assertStakeFloor — post branch (parentCommentId === null)", () => {
	it("bet-floor::post-below-floor-throws-BelowPostFloorError", () => {
		// parentCommentId null selects the POST floor; a stake strictly below it
		// is rejected with BelowPostFloorError (the place route's branch).
		expect(() =>
			assertStakeFloor({
				parentCommentId: null,
				stake: below(BET_MIN_STAKE_POST),
			}),
		).toThrow(BelowPostFloorError);
	});

	it("bet-floor::post-at-floor-no-throw", () => {
		// EXACTLY at the floor → no throw (`>=` semantics — the boundary is
		// inclusive). Reads the live constant so the boundary tracks HARDEN.6.
		expect(() =>
			assertStakeFloor({
				parentCommentId: null,
				stake: BET_MIN_STAKE_POST,
			}),
		).not.toThrow();
	});

	it("bet-floor::post-above-floor-no-throw", () => {
		// Strictly above the floor → no throw.
		expect(() =>
			assertStakeFloor({
				parentCommentId: null,
				stake: above(BET_MIN_STAKE_POST),
			}),
		).not.toThrow();
	});
});

describe("assertStakeFloor — reply branch (parentCommentId !== null)", () => {
	const PARENT = "0190b3a0-1111-7000-8000-000000000001";

	it("bet-floor::reply-below-floor-throws-BelowReplyFloorError", () => {
		// A non-null parentCommentId selects the REPLY floor (= 50, ADR-0018); a
		// stake below it throws BelowReplyFloorError. DEBATE.2 exercises this in
		// the reply route; ENGINE.8 pins it so the validator ships tested.
		expect(() =>
			assertStakeFloor({
				parentCommentId: PARENT,
				stake: below(BET_MIN_STAKE_REPLY),
			}),
		).toThrow(BelowReplyFloorError);
	});

	it("bet-floor::reply-at-floor-no-throw", () => {
		// EXACTLY at the reply floor (50) → no throw (`>=` semantics).
		expect(() =>
			assertStakeFloor({
				parentCommentId: PARENT,
				stake: BET_MIN_STAKE_REPLY,
			}),
		).not.toThrow();
	});

	it("bet-floor::reply-above-floor-no-throw", () => {
		// Strictly above the reply floor → no throw.
		expect(() =>
			assertStakeFloor({
				parentCommentId: PARENT,
				stake: above(BET_MIN_STAKE_REPLY),
			}),
		).not.toThrow();
	});

	it("bet-floor::reply-floor-is-pinned-50", () => {
		// ADR-0018: BET_MIN_STAKE_REPLY is the PINNED reply floor, not a HARDEN.6
		// placeholder. If a future PR moves it off 50, this surfaces loud.
		expect(BET_MIN_STAKE_REPLY).toBe("50");
	});

	it("bet-floor::reply-branch-uses-reply-floor-not-post-floor", () => {
		// Boundary proof the SELECTION rule is honored: with a parentCommentId set,
		// a stake at the (lower) POST placeholder but below the (higher) REPLY floor
		// is REJECTED — i.e. the reply branch did NOT fall through to the post floor.
		// Only meaningful while POST < REPLY (the placeholder ~10 < pinned 50);
		// skips defensively if a future HARDEN.6 raises POST to/above REPLY.
		const post = BigInt(BET_MIN_STAKE_POST.split(".")[0] ?? BET_MIN_STAKE_POST);
		const reply = BigInt(
			BET_MIN_STAKE_REPLY.split(".")[0] ?? BET_MIN_STAKE_REPLY,
		);
		if (post >= reply) return;
		expect(() =>
			assertStakeFloor({
				parentCommentId: PARENT,
				stake: BET_MIN_STAKE_POST,
			}),
		).toThrow(BelowReplyFloorError);
	});
});
