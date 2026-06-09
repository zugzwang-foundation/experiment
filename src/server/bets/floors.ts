import "server-only";

import {
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
