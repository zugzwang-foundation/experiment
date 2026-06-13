"use server";

import type { ActionResult } from "@/server/admin/wire";

// ENGINE.15 S1 RED scaffold — F-RESOLVE-2 `correctResolutionAction`. STUB
// returns a fixed non-success envelope so every wire-surface assertion (happy
// path, `correction_same_outcome`, illegal_edge, session gate) fails on
// ASSERTION. S2 wires per D-15.a (requireAdminSession → mint correctEventId →
// `correctResolution` → map; `CorrectionOutcomeError` → `correction_same_outcome`).
// Service signature is
// `correctResolution({ marketId, correctedSide, reason, correctEventId, metadata })`.
export async function correctResolutionAction(_formData: FormData): Promise<
	ActionResult<{
		correctionEventId: string;
		betsAffected: number;
		uncollectableTotal: string;
	}>
> {
	return {
		ok: false,
		error: {
			code: "stub_not_implemented",
			message: "ENGINE.15 S2 implements correctResolutionAction",
		},
	};
}
