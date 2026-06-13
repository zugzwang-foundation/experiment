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
import { voidMarket } from "@/server/resolution/void";

// ENGINE.15 S2 — F-RESOLVE-3 `voidMarketAction` (D-15.a). The pre-resolution
// exit; live gate is `expectedStatus ['Open','Closed']` (S0-confirmed), so a
// Resolving/Resolved/Voided market → `ResolutionStateError` → `illegal_edge`
// (R-9.3 — no Resolving → Voided edge). Clockless service — no `now` injected.
const voidSchema = z.object({
	marketId: z.string().uuid(),
	reason: z.string().min(1).max(RESOLUTION_REASON_MAX_CHARS),
});

export async function voidMarketAction(formData: FormData): Promise<
	ActionResult<{
		voidResolutionEventId: string;
		betsRefunded: number;
		poolUnwindAmount: string;
	}>
> {
	if (!(await requireAdminSession())) return adminSessionRequired();

	const parsed = voidSchema.safeParse({
		marketId: String(formData.get("marketId") ?? ""),
		reason: String(formData.get("reason") ?? ""),
	});
	if (!parsed.success) return validationError(parsed.error);

	const metadata = await buildAdminMetadata({ flowId: "F-RESOLVE-3" });
	try {
		const result = await voidMarket({
			marketId: parsed.data.marketId,
			reason: parsed.data.reason,
			voidEventId: uuidv7(),
			metadata,
		});
		revalidatePath("/admin/markets");
		revalidatePath("/admin/markets/[marketId]", "page");
		return {
			ok: true,
			data: {
				voidResolutionEventId: result.voidResolutionEventId,
				betsRefunded: result.betsRefunded,
				poolUnwindAmount: result.poolUnwindAmount,
			},
		};
	} catch (error) {
		return toActionError(error, "F-RESOLVE-3");
	}
}
