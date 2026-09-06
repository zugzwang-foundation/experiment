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

// ENGINE.15 S2 — F-ADMIN-2 `seedPoolAction` (D-15.a). The open rides Draft →
// Open (R-14.1) via the `openMarket` service — there is no standalone seed
// service. Two values since ADR-0047: an opening price and a tank, in place of
// the single symmetric seed. BOTH go through `canonicalizeAmount18` before the
// service (CR-3/SA-I-3), so an over-precision value in EITHER field throws
// `MarketSeedInvalidError` → `seed_invalid` at the wire with no silent
// rounding — a price is money-shaped here even though it is not money, because
// an 0.1000000000000000004 that rounds silently opens the market somewhere the
// admin did not ask for. Clock injected here (D-14.e).
const seedSchema = z.object({
	marketId: z.string().uuid(),
	openingPriceYes: z.string().min(1),
	tank: z.string().min(1),
});

export async function seedPoolAction(
	formData: FormData,
): Promise<
	ActionResult<{ poolId: string; yesReserves: string; noReserves: string }>
> {
	if (!(await requireAdminSession())) return adminSessionRequired();

	const parsed = seedSchema.safeParse({
		marketId: String(formData.get("marketId") ?? ""),
		openingPriceYes: String(formData.get("openingPriceYes") ?? ""),
		tank: String(formData.get("tank") ?? ""),
	});
	if (!parsed.success) return validationError(parsed.error);

	const metadata = await buildAdminMetadata({ flowId: "F-ADMIN-2" });
	try {
		const openingPriceYes = canonicalizeAmount18(parsed.data.openingPriceYes);
		const tank = canonicalizeAmount18(parsed.data.tank);
		const result = await openMarket({
			marketId: parsed.data.marketId,
			openingPriceYes,
			tank,
			now: new Date(),
			metadata,
		});
		revalidatePath("/admin/markets");
		revalidatePath("/admin/markets/[marketId]", "page");
		// The reserves that LANDED, not the price and tank that were typed —
		// the admin should see what the pool actually holds.
		return {
			ok: true,
			data: {
				poolId: result.poolId,
				yesReserves: result.yesReserves,
				noReserves: result.noReserves,
			},
		};
	} catch (error) {
		return toActionError(error, "F-ADMIN-2");
	}
}
