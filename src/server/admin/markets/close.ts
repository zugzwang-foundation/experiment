"use server";

import type { ActionResult } from "@/server/admin/wire";

// ENGINE.15 S1 RED scaffold — W-4-CLOSE (manual) `closeMarketAction`. STUB
// returns a fixed non-success envelope so every wire-surface assertion fails on
// ASSERTION. S2 wires per D-15.a (requireAdminSession → inject now →
// `closeMarket` → map; the service already rejects pre-deadline closes via
// `MarketDeadlineNotReachedError`, R-15.4). Service signature is
// `closeMarket({ marketId, now, metadata })`.
export async function closeMarketAction(
	_formData: FormData,
): Promise<ActionResult<{ status: "Closed" }>> {
	return {
		ok: false,
		error: {
			code: "stub_not_implemented",
			message: "ENGINE.15 S2 implements closeMarketAction",
		},
	};
}
