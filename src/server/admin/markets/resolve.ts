"use server";

import type { ActionResult } from "@/server/admin/wire";

// ENGINE.15 S1 RED scaffold — composed F-ADMIN-3 + F-RESOLVE-1
// `resolveMarketAction`. STUB returns a fixed non-success envelope so every
// wire-surface assertion (Closed→Resolved 2-tx, Resolving-resume, double-submit
// illegal_edge, session gate) fails on ASSERTION. S2 wires the composed path
// per D-15.c: `triggerResolution` → `settleMarket` back-to-back; a thrown
// `ResolutionStateError` with `observed === 'Resolving'` proceeds to settle (the
// stranded-Resolving resume), any other observed → illegal_edge. Mints
// triggerEventId + settleEventId at entry (closed over).
export async function resolveMarketAction(_formData: FormData): Promise<
	ActionResult<{
		resolutionEventId: string;
		winningSide: "YES" | "NO";
		totalPaidOut: string;
		poolUnwindAmount: string;
	}>
> {
	return {
		ok: false,
		error: {
			code: "stub_not_implemented",
			message: "ENGINE.15 S2 implements resolveMarketAction",
		},
	};
}
