"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
	type ActionResult,
	adminSessionRequired,
	buildAdminMetadata,
	canonicalizeAmount18,
	requireAdminSession,
	toActionError,
	validationError,
} from "@/server/admin/wire";
import { openMarket } from "@/server/markets/open";

// ENGINE.15 S2 — F-ADMIN-2 `seedPoolAction` (D-15.a). Seed rides Draft → Open
// (R-14.1) via the `openMarket` service — there is no standalone seed service.
// The wire canonicalizes the amount to 18 dp (CR-3/SA-I-3) before the service;
// a malformed/over-precision amount throws `MarketSeedInvalidError` →
// `seed_invalid` (no rounding). Clock injected here (D-14.e).
const seedSchema = z.object({
	marketId: z.string().uuid(),
	seedAmount: z.string().min(1),
});

export async function seedPoolAction(
	formData: FormData,
): Promise<ActionResult<{ poolId: string; seedAmount: string }>> {
	if (!(await requireAdminSession())) return adminSessionRequired();

	const parsed = seedSchema.safeParse({
		marketId: String(formData.get("marketId") ?? ""),
		seedAmount: String(formData.get("seedAmount") ?? ""),
	});
	if (!parsed.success) return validationError(parsed.error);

	const metadata = await buildAdminMetadata({ flowId: "F-ADMIN-2" });
	try {
		const seedAmount = canonicalizeAmount18(parsed.data.seedAmount);
		const result = await openMarket({
			marketId: parsed.data.marketId,
			seedAmount,
			now: new Date(),
			metadata,
		});
		revalidatePath("/admin/markets");
		revalidatePath("/admin/markets/[marketId]", "page");
		return {
			ok: true,
			data: { poolId: result.poolId, seedAmount: result.seedAmount },
		};
	} catch (error) {
		return toActionError(error, "F-ADMIN-2");
	}
}
