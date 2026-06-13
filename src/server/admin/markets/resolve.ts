"use server";

import { revalidatePath } from "next/cache";
import { v7 as uuidv7 } from "uuid";
import { z } from "zod";

import {
	type ActionResult,
	adminSessionRequired,
	buildAdminMetadata,
	requireAdminSession,
	toActionError,
	validationError,
} from "@/server/admin/wire";
import { RESOLUTION_REASON_MAX_CHARS } from "@/server/config/limits";
import { ResolutionStateError } from "@/server/resolution/errors";
import { settleMarket } from "@/server/resolution/settle";
import { triggerResolution } from "@/server/resolution/trigger";

// ENGINE.15 S2 — composed F-ADMIN-3 + F-RESOLVE-1 `resolveMarketAction`
// (D-15.c). ONE admin gesture: trigger (Closed → Resolving) then settle
// (Resolving → Resolved), back-to-back. The trigger tx is the atomic gate (no
// TOCTOU pre-read); a thrown `ResolutionStateError` with `observed ===
// 'Resolving'` is the stranded-Resolving RESUME — skip the trigger, settle
// directly (NOT an error). Any other observed → `illegal_edge`. On a settle-
// side failure after a committed/resumed trigger (the R-15.3 partial failure)
// the mapped error message gains the resume clause; the market remains
// Resolving and resubmission re-enters the resume branch.
const resolveSchema = z.object({
	marketId: z.string().uuid(),
	winningSide: z.enum(["YES", "NO"]),
	reason: z.string().min(1).max(RESOLUTION_REASON_MAX_CHARS),
});

const RESUME_CLAUSE =
	" Market is now Resolving — resubmit to complete settlement.";

export async function resolveMarketAction(formData: FormData): Promise<
	ActionResult<{
		resolutionEventId: string;
		winningSide: "YES" | "NO";
		totalPaidOut: string;
		poolUnwindAmount: string;
	}>
> {
	if (!(await requireAdminSession())) return adminSessionRequired();

	const parsed = resolveSchema.safeParse({
		marketId: String(formData.get("marketId") ?? ""),
		winningSide: String(formData.get("winningSide") ?? ""),
		reason: String(formData.get("reason") ?? ""),
	});
	if (!parsed.success) return validationError(parsed.error);

	// B-8/ADR-0016 D1: both ids minted ONCE at entry, closed over (retry-pure).
	// On the resume branch the triggerEventId goes unused — ids are cheap and
	// never wire-exposed (SA-M-1).
	const triggerEventId = uuidv7();
	const settleEventId = uuidv7();
	const base = await buildAdminMetadata({ flowId: "F-RESOLVE-1" });

	try {
		await triggerResolution({
			marketId: parsed.data.marketId,
			triggerEventId,
			metadata: { ...base, flow_id: "F-ADMIN-3" },
		});
	} catch (error) {
		if (
			!(error instanceof ResolutionStateError) ||
			error.observed !== "Resolving"
		) {
			return toActionError(error, "F-ADMIN-3");
		}
		// observed === 'Resolving' → resume: fall through to settle.
	}

	try {
		const result = await settleMarket({
			marketId: parsed.data.marketId,
			winningSide: parsed.data.winningSide,
			reason: parsed.data.reason,
			settleEventId,
			metadata: base,
		});
		revalidatePath("/admin/markets");
		revalidatePath("/admin/markets/[marketId]", "page");
		return {
			ok: true,
			data: {
				resolutionEventId: result.resolutionEventId,
				winningSide: result.winningSide,
				totalPaidOut: result.totalPaidOut,
				poolUnwindAmount: result.poolUnwindAmount,
			},
		};
	} catch (error) {
		const mapped = toActionError(error, "F-RESOLVE-1");
		return {
			ok: false,
			error: { ...mapped.error, message: mapped.error.message + RESUME_CLAUSE },
		};
	}
}
