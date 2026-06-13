"use server";

import type { ActionResult } from "@/server/admin/wire";

// ENGINE.15 S1 RED scaffold — F-ADMIN-2 `seedPoolAction` (seed rides
// `Draft → Open`, R-14.1; calls the `openMarket` service, there is no
// standalone seed service). STUB returns a fixed non-success envelope so every
// wire-surface assertion fails on ASSERTION. S2 wires per D-15.a/D-15.a-naming
// (requireAdminSession → canonicalizeAmount18(seedAmount) → inject now →
// `openMarket` → map). Service signature is
// `openMarket({ marketId, seedAmount, now, metadata })`.
export async function seedPoolAction(
	_formData: FormData,
): Promise<ActionResult<{ poolId: string; seedAmount: string }>> {
	return {
		ok: false,
		error: {
			code: "stub_not_implemented",
			message: "ENGINE.15 S2 implements seedPoolAction",
		},
	};
}
