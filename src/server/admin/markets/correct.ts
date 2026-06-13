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
import { correctResolution } from "@/server/resolution/correct";

// ENGINE.15 S2 — F-RESOLVE-2 `correctResolutionAction` (D-15.a). Appends a
// `corrects_event_id` correction row (INV-4: corrections are new rows). A
// same-as-tip outcome is the OQ-3 no-op → `CorrectionOutcomeError` →
// `correction_same_outcome`; a non-Resolved market → `ResolutionStateError` →
// `illegal_edge`. The correction services are clockless (pre-date D-14.e) — no
// `now` injected.
const correctSchema = z.object({
	marketId: z.string().uuid(),
	correctedSide: z.enum(["YES", "NO"]),
	reason: z.string().min(1).max(RESOLUTION_REASON_MAX_CHARS),
});

export async function correctResolutionAction(formData: FormData): Promise<
	ActionResult<{
		correctionEventId: string;
		betsAffected: number;
		uncollectableTotal: string;
	}>
> {
	if (!(await requireAdminSession())) return adminSessionRequired();

	const parsed = correctSchema.safeParse({
		marketId: String(formData.get("marketId") ?? ""),
		correctedSide: String(formData.get("correctedSide") ?? ""),
		reason: String(formData.get("reason") ?? ""),
	});
	if (!parsed.success) return validationError(parsed.error);

	const metadata = await buildAdminMetadata({ flowId: "F-RESOLVE-2" });
	try {
		const result = await correctResolution({
			marketId: parsed.data.marketId,
			correctedSide: parsed.data.correctedSide,
			reason: parsed.data.reason,
			correctEventId: uuidv7(),
			metadata,
		});
		revalidatePath("/admin/markets");
		revalidatePath("/admin/markets/[marketId]", "page");
		return {
			ok: true,
			data: {
				correctionEventId: result.correctionEventId,
				betsAffected: result.betsAffected,
				uncollectableTotal: result.uncollectableTotal,
			},
		};
	} catch (error) {
		return toActionError(error, "F-RESOLVE-2");
	}
}
