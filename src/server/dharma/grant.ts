import "server-only";

import type { z } from "zod";

import type { DbTransaction } from "@/db";
import { INITIAL_USER_DHARMA } from "@/server/config/limits";
import { CpmmDecimal } from "@/server/cpmm/decimal";
import { insertEvent } from "@/server/events/insert";
import {
	type eventMetadataSchema,
	numericString,
} from "@/server/events/schemas";

import { DharmaInputError } from "./errors";
import { appendLedgerRow } from "./persist";

/**
 * ENGINE.13 — the equal initial-grant producer (ADR-0018 + SPEC.1 §10.1).
 * Paid EXACTLY ONCE per user, inside the F-AUTH-4 ToS-acceptance
 * transaction's FIRST-ACCEPTANCE branch (`tos-accept.ts` — R1a). The
 * complete write set is exactly two: `dharma_ledger(initial_grant)` +
 * `events(dharma.granted)`. The grant row is the user's FIRST ledger row
 * (ENGINE.5 R-1 shape): `bet_id` NULL, `amount` = +grant, `balance_after`
 * = amount.
 *
 * **Serialization (discharges `persist.ts` D-2 for the auth/onboarding
 * lane).** The caller holds the `users`-row `FOR UPDATE` lock
 * (`tos-accept.ts`); concurrent acceptances serialize through it and the
 * loser takes the tab-race no-op branch — the grant is unreachable twice.
 * Works at READ COMMITTED (lock-then-recheck); SSI is not load-bearing
 * here (R4a). The 0013 UNIQUE partial index
 * (`dharma_ledger_initial_grant_user_uq`) is the storage backstop — it
 * can fire only on a future logic bug, loudly (23505, surfaces as a 500 +
 * Sentry), never caught to "recover" (the ENGINE.12 R3 mirror).
 *
 * **Sign discipline.** Per-tag sign is producer-owned (`ledger.ts` — the
 * core's only numeric floor is the overdraft check); `validateGrantAmount`
 * is the `initial_grant` discharge of that assignment.
 *
 * **Conservation.** `initial_grant` is an issuance row (`bet_id` NULL,
 * non-FLOW tag — `tags.ts`) outside the per-market flow sum; system-total
 * conservation counts it per SPEC.1 §10.2 ("sum of equal initial grants").
 *
 * **No retry loop here.** Driver errors bubble raw to the Server Action
 * (the `insertEvent` posture — caller's wrapper owns retry policy).
 */

/**
 * The producer guard (`validateCreditAmount` mirror): the grant amount must
 * be a strictly positive `numericString`. The ledger core enforces only the
 * overdraft floor (`ledger.ts` — per-tag sign is producer-owned); this is
 * the producer's side. `"-0"` is not strictly positive (the
 * `_probe-decimal-negzero` landmine — `numericString` admits it; the sign
 * guard must not).
 */
export function validateGrantAmount(amount: string): void {
	if (!numericString.safeParse(amount).success) {
		throw new DharmaInputError(
			`initial grant amount is not a numericString: ${amount}`,
		);
	}
	if (!new CpmmDecimal(amount).greaterThan(0)) {
		throw new DharmaInputError(
			`initial grant amount must be strictly positive: ${amount}`,
		);
	}
}

export interface GrantInitialDharmaArgs {
	userId: string;
	/** Minted ONCE at handler entry beside the tos `eventId`, closed over (ADR-0016 D1 retry purity) — NEVER regenerated per attempt. */
	grantEventId: string;
	/** The SAME 7-field metadata object the `user.tos_accepted` emit carries (`schemas.ts`) — same flow F-AUTH-4, same self-actor. */
	metadata: z.infer<typeof eventMetadataSchema>;
}

/**
 * Writes the equal initial grant inside the caller's F-AUTH-4 transaction.
 * No `previousBalance` (P3): the grant is the only same-user ledger row in
 * this tx, so `appendLedgerRow`'s auto-read returns the canonical zero for
 * a first row ⇒ `balance_after = amount` — the ENGINE.5 R-1 shape. (If a
 * logic bug ever lets a second grant reach the INSERT, the 0013 index
 * rejects it with 23505 — loud, never a double grant.)
 */
export async function grantInitialDharma(
	tx: DbTransaction,
	args: GrantInitialDharmaArgs,
): Promise<{ balanceAfter: string }> {
	validateGrantAmount(INITIAL_USER_DHARMA);

	const { balanceAfter } = await appendLedgerRow(tx, {
		userId: args.userId,
		amount: INITIAL_USER_DHARMA,
		entryType: "initial_grant",
		betId: null,
	});

	await insertEvent(tx, {
		eventId: args.grantEventId,
		eventType: "dharma.granted",
		aggregateType: "dharma_account",
		aggregateId: args.userId,
		payload: {
			userId: args.userId,
			amount: INITIAL_USER_DHARMA,
		},
		metadata: args.metadata,
	});

	return { balanceAfter };
}
