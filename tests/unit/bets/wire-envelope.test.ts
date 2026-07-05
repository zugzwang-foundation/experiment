import { describe, expect, it } from "vitest";

import {
	BannedUserError,
	BelowPostFloorError,
	BelowReplyFloorError,
	BetSerializationExhaustedError,
	CommentTooLongError,
	InsufficientDharmaError,
	InsufficientSharesError,
	MarketNotOpenError,
	OppositeSideHeldError,
	PositionNotHeldError,
	toWireError,
} from "@/server/bets/errors";
// AUDIT-FIX-B3 A3 — the two positions sentinels the sell path can surface to the
// user (`extends Error`, NOT `BetProductError`). `toWireError` gains explicit maps
// for both (import from `@/server/positions/errors`; no runtime cycle — positions
// never imports bets). These classes ALREADY exist; the MAPS are greenfield.
import {
	PositionOversellError,
	PositionSingleSideError,
} from "@/server/positions/errors";

// ENGINE.8 §5.6 tests-first — the §4.4 wire envelope formatter + the bet product
// error classes (plan §"§4.4 wire envelope + bet product codes (Q4)" + §"File
// plan" → `src/server/bets/errors.ts` EDIT additive).
//
// PURE / DB-INDEPENDENT (locally-RED → the real RED→GREEN receipt). Touches no
// Postgres; it REDs NOW purely on the greenfield value imports — the 7 product
// error classes + `toWireError` formatter don't exist on disk until execute —
// and GREENs the moment they land. The two ENGINE.7 classes
// (`BetSerializationExhaustedError`, `MarketNotOpenError`) already exist; this
// file pins how the formatter maps ALL of them onto the §4.4 wire shape.
//
// PINNED PUBLIC-API CONTRACT (the implementer mints these names exactly):
//
//   §4.4 wire shape (the binding Route-Handler contract; plan §"§4.4 wire shape
//   (verbatim)"):  Error → { ok:false, error:{ code, message, retry_after? } }
//   `retry_after` present IFF HTTP status ∈ {429, 503}.
//
//   toWireError(err: unknown): {
//     status: number;
//     body: { ok: false; error: { code: string; message: string; retry_after?: number } };
//   }
//
//   product classes (mirror the ENGINE.7 static-fields pattern — `extends Error`
//   + static `httpStatus`/`code`/`retryAfter` + an explicit `this.name`):
//     InsufficientDharmaError  → 400 insufficient_dharma     (payload: balance, required)
//     BelowPostFloorError      → 400 below_post_floor
//     BelowReplyFloorError     → 400 below_reply_floor
//     OppositeSideHeldError    → 400 opposite_side_held      (payload: current side, shares)
//     PositionNotHeldError     → 400 position_not_held
//     BannedUserError          → 403 banned_user
//     CommentTooLongError      → 400 comment_too_long
//   + the two ENGINE.7 classes the formatter must also map:
//     MarketNotOpenError("Closed")    → 400 error_market_closed_at
//     MarketNotOpenError("Resolving") → 409 market_resolving           [Q3]
//     BetSerializationExhaustedError  → 503 error_bet_serialization_exhausted, retry_after 1
//
// Constructor arg SHAPES below are the @test-writer's best inference of the
// payload-carrying classes' inputs; the EXACT arg names are the executor's call
// — the load-bearing assertions are the (status, code) wire mapping + the
// retry_after-iff-{429,503} rule, NOT the constructor signature. Money/share
// values cross as DECIMAL STRINGS (CLAUDE.md §2 — never floats).

describe("toWireError — §4.4 envelope shape", () => {
	it("wire-envelope::shape-is-ok-false-error-code-message", () => {
		// Every mapped error produces { ok:false, error:{ code, message } }; the
		// top-level carries the HTTP status alongside the body.
		const { status, body } = toWireError(new BannedUserError());

		expect(typeof status).toBe("number");
		expect(body.ok).toBe(false);
		expect(typeof body.error.code).toBe("string");
		expect(typeof body.error.message).toBe("string");
		expect(body.error.message.length).toBeGreaterThan(0);
	});
});

describe("toWireError — 400 product codes (no retry_after)", () => {
	it("wire-envelope::insufficient-dharma-400 (INV-2 friendly seam)", () => {
		// F-BET-4: the in-snapshot readBalance pre-check throws this; the
		// authoritative backstop is DharmaOverdraftError + CHECK(balance_after>=0).
		// Carries balance + required for the client payload (asserted only that it
		// constructs; the payload-surfacing is the executor's envelope detail).
		const err = new InsufficientDharmaError({
			balance: "5.000000000000000000",
			required: "10.000000000000000000",
		});
		const { status, body } = toWireError(err);

		expect(InsufficientDharmaError.httpStatus).toBe(400);
		expect(InsufficientDharmaError.code).toBe("insufficient_dharma");
		expect(status).toBe(400);
		expect(body.error.code).toBe("insufficient_dharma");
		// 400 product errors carry NO retry_after (only 429/503 do).
		expect(body.error.retry_after).toBeUndefined();
	});

	it("wire-envelope::below-post-floor-400", () => {
		const { status, body } = toWireError(new BelowPostFloorError());

		expect(BelowPostFloorError.httpStatus).toBe(400);
		expect(BelowPostFloorError.code).toBe("below_post_floor");
		expect(status).toBe(400);
		expect(body.error.code).toBe("below_post_floor");
		expect(body.error.retry_after).toBeUndefined();
	});

	it("wire-envelope::below-reply-floor-400", () => {
		// ADR-0018 reply floor — exercised by DEBATE.2, but the wire mapping is
		// minted + pinned in ENGINE.8 (the validator + classes ship here).
		const { status, body } = toWireError(new BelowReplyFloorError());

		expect(BelowReplyFloorError.httpStatus).toBe(400);
		expect(BelowReplyFloorError.code).toBe("below_reply_floor");
		expect(status).toBe(400);
		expect(body.error.code).toBe("below_reply_floor");
		expect(body.error.retry_after).toBeUndefined();
	});

	it("wire-envelope::opposite-side-held-400 (F-BET-10)", () => {
		// F-BET-10: the held-side read predicate rejects an opposite-side entry.
		// Carries current side + shares for the payload.
		const err = new OppositeSideHeldError({
			currentSide: "YES",
			shares: "3.000000000000000000",
		});
		const { status, body } = toWireError(err);

		expect(OppositeSideHeldError.httpStatus).toBe(400);
		expect(OppositeSideHeldError.code).toBe("opposite_side_held");
		expect(status).toBe(400);
		expect(body.error.code).toBe("opposite_side_held");
		expect(body.error.retry_after).toBeUndefined();
	});

	it("wire-envelope::position-not-held-400 (F-BET-3 sell)", () => {
		// F-BET-3: a sell against a market the user holds no position in.
		const { status, body } = toWireError(new PositionNotHeldError());

		expect(PositionNotHeldError.httpStatus).toBe(400);
		expect(PositionNotHeldError.code).toBe("position_not_held");
		expect(status).toBe(400);
		expect(body.error.code).toBe("position_not_held");
		expect(body.error.retry_after).toBeUndefined();
	});

	it("wire-envelope::comment-too-long-400", () => {
		// Body length > COMMENT_MAX_LENGTH at step-5 validation.
		const { status, body } = toWireError(new CommentTooLongError());

		expect(CommentTooLongError.httpStatus).toBe(400);
		expect(CommentTooLongError.code).toBe("comment_too_long");
		expect(status).toBe(400);
		expect(body.error.code).toBe("comment_too_long");
		expect(body.error.retry_after).toBeUndefined();
	});
});

describe("toWireError — 403 banned_user (F-BET-7)", () => {
	it("wire-envelope::banned-user-403", () => {
		// F-BET-7: users.banned_at IS NOT NULL → 403 banned_user (auth+ban gate).
		const { status, body } = toWireError(new BannedUserError());

		expect(BannedUserError.httpStatus).toBe(403);
		expect(BannedUserError.code).toBe("banned_user");
		expect(status).toBe(403);
		expect(body.error.code).toBe("banned_user");
		expect(body.error.retry_after).toBeUndefined();
	});
});

describe("toWireError — MarketNotOpenError status → §15 code map (ENGINE.7 class)", () => {
	it("wire-envelope::market-closed-maps-400-error_market_closed_at", () => {
		// MarketNotOpenError carries the EXACT observed status; the formatter picks
		// the code. Closed → 400 error_market_closed_at (plan Q3).
		const { status, body } = toWireError(new MarketNotOpenError("Closed"));

		expect(status).toBe(400);
		expect(body.error.code).toBe("error_market_closed_at");
		expect(body.error.retry_after).toBeUndefined();
	});

	it("wire-envelope::market-resolving-maps-409-market_resolving [Q3]", () => {
		// Resolving → 409 market_resolving — the 400/409 asymmetry is spec-locked
		// (SPEC.1 F-BET-1:281). NOT normalized to 400. The fine in-flight window
		// (error_in_flight_timeout, 400) is the deferred carry-forward-1 code.
		const { status, body } = toWireError(new MarketNotOpenError("Resolving"));

		expect(status).toBe(409);
		expect(body.error.code).toBe("market_resolving");
		// 409 is NOT in {429,503} → no retry_after.
		expect(body.error.retry_after).toBeUndefined();
	});
});

describe("toWireError — retry_after present IFF status ∈ {429,503}", () => {
	it("wire-envelope::serialization-exhausted-503-carries-retry_after-1", () => {
		// The wrapper's BetSerializationExhaustedError → 503 with retry_after: 1
		// (the static retryAfterSeconds). retry_after is PRESENT because 503 ∈
		// {429,503}.
		const err = new BetSerializationExhaustedError({
			sqlstate: "40001",
			flow: "F-BET-1",
		});
		const { status, body } = toWireError(err);

		expect(status).toBe(503);
		expect(body.error.code).toBe("error_bet_serialization_exhausted");
		expect(body.error.retry_after).toBe(1);
	});

	it("wire-envelope::retry_after-omitted-for-non-429-503-statuses", () => {
		// Cross-check the IFF rule on a representative 400 + a 403 + a 409: none
		// carry retry_after (only 429/503 do, per §4.4).
		for (const err of [
			new BelowPostFloorError(),
			new BannedUserError(),
			new MarketNotOpenError("Resolving"),
		]) {
			const { status, body } = toWireError(err);
			expect([400, 403, 409]).toContain(status);
			expect(body.error.retry_after).toBeUndefined();
		}
	});
});

// AUDIT-FIX-B3 A3 — the oversell + unmapped-error sweep (plan §3.4 + §3.6 rows
// 7/8/9). Three NEW terminal cases the current `toWireError` fall-through maps to
// an UNCACHED 500 `error_internal` (the finding); the fix routes each to a stable
// user-facing code:
//   - InsufficientSharesError  → 400 insufficient_shares   (the sell pre-check, #7)
//   - PositionOversellError    → 400 insufficient_shares   (the storage backstop, #8)
//   - PositionSingleSideError  → 503 error_position_conflict + retry_after 1 (#9)
//
// RED NOW: `InsufficientSharesError` is greenfield (undefined value import →
// `new` throws), and the two `PositionError` maps do not exist yet (both currently
// hit the fall-through → 500). Money/share values cross as decimal STRINGS.
describe("toWireError — A3 oversell + positions sentinels (plan §3.6 rows 7/8/9)", () => {
	it("wire-envelope::insufficient-shares-400 (A3 sell pre-check, #7)", () => {
		// The NEW product pre-check in sell(): shares > held.quantity. Mirrors
		// F-BET-4's InsufficientDharmaError shape — 400, carries {held, requested}.
		const err = new InsufficientSharesError({
			held: "5.000000000000000000",
			requested: "10.000000000000000000",
		});
		const { status, body } = toWireError(err);

		expect(InsufficientSharesError.httpStatus).toBe(400);
		expect(InsufficientSharesError.code).toBe("insufficient_shares");
		expect(status).toBe(400);
		expect(body.error.code).toBe("insufficient_shares");
		// 400 → cached (deterministic, retry-safe); no retry_after (only 429/503).
		expect(body.error.retry_after).toBeUndefined();
	});

	it("wire-envelope::position-oversell-backstop-maps-400-insufficient-shares (A3 storage backstop, #8)", () => {
		// The module-local `PositionOversellError extends Error` (unreachable-
		// except-bug post-pre-check) maps to the SAME 400 `insufficient_shares` —
		// today it falls through to 500 `error_internal`. Same wire code as #7 so a
		// backstop trip is user-legible, not an opaque 500.
		const err = new PositionOversellError(
			"position oversell: 5 + -10 = -5 < 0",
		);
		const { status, body } = toWireError(err);

		expect(status).toBe(400);
		expect(body.error.code).toBe("insufficient_shares");
		expect(body.error.retry_after).toBeUndefined();
	});

	it("wire-envelope::position-single-side-maps-503-error_position_conflict-retry-after-1 (A3 race-loser, #9)", () => {
		// The read-side single-side race-loser (`PositionSingleSideError extends
		// Error`) maps to 503 `error_position_conflict` + Retry-After 1 — NOT a
		// cached 409 (503 is uncached by the `<500` rule, so the retry re-resolves
		// deterministically to the 400 `opposite_side_held` case). Both the body
		// field and the HTTP header carry 1.
		const err = new PositionSingleSideError(
			"single-side violation: a held opposite side already exists",
		);
		const { status, body, retryAfterHeader } = toWireError(err);

		expect(status).toBe(503);
		expect(body.error.code).toBe("error_position_conflict");
		// 503 ∈ {429,503} → the body carries retry_after (§4.4); header mirrors it.
		expect(body.error.retry_after).toBe(1);
		expect(retryAfterHeader).toBe(1);
	});

	it("wire-envelope::unknown-error-still-falls-through-to-500 (fall-through unchanged)", () => {
		// The A3 sweep adds maps for the USER-REACHABLE terminal cases only; a
		// genuinely unrecognized error (bug class — driver/RETURNING-empty/CAS/
		// 57014, plan §3.6 row 13) still falls through to 500 `error_internal`.
		const { status, body } = toWireError(new Error("some unexpected boom"));

		expect(status).toBe(500);
		expect(body.error.code).toBe("error_internal");
	});
});
