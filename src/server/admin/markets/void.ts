"use server";

import type { ActionResult } from "@/server/admin/wire";

// ENGINE.15 S1 RED scaffold — F-RESOLVE-3 `voidMarketAction`. STUB returns a
// fixed non-success envelope so every wire-surface assertion (happy path from
// Open/Closed, illegal_edge from Resolving/Resolved/Voided, session gate) fails
// on ASSERTION. S2 wires per D-15.a (requireAdminSession → mint voidEventId →
// `voidMarket` → map). Service signature is
// `voidMarket({ marketId, reason, voidEventId, metadata })`; live gate is
// `expectedStatus ['Open','Closed']` (S0-confirmed).
export async function voidMarketAction(_formData: FormData): Promise<
	ActionResult<{
		voidResolutionEventId: string;
		betsRefunded: number;
		poolUnwindAmount: string;
	}>
> {
	return {
		ok: false,
		error: {
			code: "stub_not_implemented",
			message: "ENGINE.15 S2 implements voidMarketAction",
		},
	};
}
