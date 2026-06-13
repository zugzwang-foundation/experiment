"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
	type ActionResult,
	adminSessionRequired,
	buildAdminMetadata,
	requireAdminSession,
	toActionError,
	validationError,
} from "@/server/admin/wire";
import { closeMarket } from "@/server/markets/close";

// ENGINE.15 S2 — W-4-CLOSE (manual) `closeMarketAction` (D-15.a; R-15.4 — the
// recovery lever if the cron sweep lags). The service already rejects
// pre-deadline closes (`MarketDeadlineNotReachedError` → `deadline_not_reached`)
// and non-Open markets (`MarketLifecycleStateError` → `market_not_open`), so
// there is no early-close risk. Clock injected here (D-14.e).
const closeSchema = z.object({ marketId: z.string().uuid() });

export async function closeMarketAction(
	formData: FormData,
): Promise<ActionResult<{ status: "Closed" }>> {
	if (!(await requireAdminSession())) return adminSessionRequired();

	const parsed = closeSchema.safeParse({
		marketId: String(formData.get("marketId") ?? ""),
	});
	if (!parsed.success) return validationError(parsed.error);

	const metadata = await buildAdminMetadata({ flowId: "W-4-CLOSE" });
	try {
		const result = await closeMarket({
			marketId: parsed.data.marketId,
			now: new Date(),
			metadata,
		});
		revalidatePath("/admin/markets");
		revalidatePath("/admin/markets/[marketId]", "page");
		return { ok: true, data: { status: result.status } };
	} catch (error) {
		return toActionError(error, "W-4-CLOSE");
	}
}
