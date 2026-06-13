"use server";

import type { ActionResult } from "@/server/admin/wire";

// ENGINE.15 S1 RED scaffold — F-ADMIN-1 `createMarketAction`. STUB returns a
// fixed non-success envelope so every wire-surface assertion (happy path,
// session gate, validation rejection) fails on ASSERTION, not on module
// resolution. S2 wires the real action per D-15.a (requireAdminSession →
// zod-validate FormData → mint nothing/createMarket mints → inject now →
// `createMarket` → map result/error → revalidatePath). Service signature is
// `createMarket({ slug, title, description, resolutionDeadline, now, metadata })`
// (no `eventId` supplied — the service mints).
export async function createMarketAction(
	_formData: FormData,
): Promise<ActionResult<{ marketId: string; slug: string }>> {
	return {
		ok: false,
		error: {
			code: "stub_not_implemented",
			message: "ENGINE.15 S2 implements createMarketAction",
		},
	};
}
