import "server-only";

import {
	BET_MAX_STAKE,
	BET_MIN_STAKE_POST,
	BET_MIN_STAKE_REPLY,
} from "@/server/config/limits";
import { CpmmDecimal } from "@/server/cpmm/decimal";

import { BelowPostFloorError, BelowReplyFloorError } from "./errors";

/**
 * The two-floor stake validator (Q1 / ADR-0018). The floor is selected by
 * whether the comment-bearing bet is a top-level POST (`parentCommentId ===
 * null` → `BET_MIN_STAKE_POST`) or a REPLY (`parentCommentId` set →
 * `BET_MIN_STAKE_REPLY`). Built ONCE here and reused by DEBATE.2's reply route;
 * ENGINE.8's place route only ever calls it with `parentCommentId: null` (the
 * post branch), but both branches are unit-tested so DEBATE.2 inherits a tested
 * selector.
 *
 * `>=` semantics: a stake EXACTLY at the floor passes (the boundary is
 * inclusive). The comparison is exact decimal arithmetic via `CpmmDecimal`
 * (precision 50) — never a JS float (CLAUDE.md §2). `stake` is a validated
 * `numericString` (the caller runs the zod body schema first).
 *
 * @throws {BelowPostFloorError}  post branch, `stake < BET_MIN_STAKE_POST`
 * @throws {BelowReplyFloorError} reply branch, `stake < BET_MIN_STAKE_REPLY`
 */
export function assertStakeFloor(args: {
	parentCommentId: string | null;
	stake: string;
}): void {
	const stake = new CpmmDecimal(args.stake);
	if (args.parentCommentId === null) {
		if (stake.lessThan(BET_MIN_STAKE_POST)) {
			throw new BelowPostFloorError();
		}
		return;
	}
	if (stake.lessThan(BET_MIN_STAKE_REPLY)) {
		throw new BelowReplyFloorError();
	}
}

/**
 * The per-bet stake cap (SPEC.1 §16.1 / F-BET-9 clamp rider — UI.A2). Buy/add
 * ONLY — the sell path never calls this (SG-2). A stake STRICTLY above
 * `BET_MAX_STAKE` returns the constant; a stake at or below (boundary
 * inclusive) returns the ORIGINAL input string BYTE-IDENTICAL — no
 * re-quantization, so conforming clients see zero behavior change. Clamp ≠
 * reject: no error is thrown here, ever. Exact decimal compare via
 * `CpmmDecimal` (precision 50) — never a JS float (CLAUDE.md §2).
 *
 * Single call site: the place route's step 5d, clamp-then-floor — the floor
 * asserts on the CLAMPED value, so a misconfigured max < floor rejects loudly
 * (`below_*_floor`) instead of executing below floor.
 */
export function clampStakeToMax(stake: string): string {
	return new CpmmDecimal(stake).greaterThan(BET_MAX_STAKE)
		? BET_MAX_STAKE
		: stake;
}
