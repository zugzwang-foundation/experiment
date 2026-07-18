import "server-only";

import { and, eq } from "drizzle-orm";

import type { DbClient, DbTransaction } from "@/db";
import { marketMedia } from "@/db/schema";
import { mintReadUrl } from "@/server/storage/r2";

/** A bound read client — top-level `db` OR a caller's transaction. */
type DiscoveryReader = DbClient | DbTransaction;

/** Discovery render-path presigned-GET TTL — mirrors the DEBATE.4 D9 seam
 * (`load-debate-view.ts` READ_URL_TTL_SECONDS). */
const READ_URL_TTL_SECONDS = 3600;

/**
 * Sign a READ URL against the `market-media` bucket arm (ADR-0026 / SPEC.2
 * §12.1). A separate seam from `signRead` — that helper is hardcoded to the
 * participant `"uploads"` bucket and MUST NOT serve admin market media (plan
 * §1e); the arm exists in `r2.ts`, this wrapper only hides the bucket-id
 * literal at the call site. No validation, no DB hit — pure forward; R2
 * unavailability throws raw from `mintReadUrl`, caller decides posture.
 */
export async function signReadMarketMedia(
	key: string,
	ttlSeconds: number,
): Promise<string> {
	return mintReadUrl("market-media", key, ttlSeconds);
}

/**
 * The Discovery card image (SPEC.1 §22 SCL-2 reconciliation): the market's
 * `is_default` `market_media` row's object key, signed for read. Markets
 * always carry media (§15 F-ADMIN-1 service invariant + the
 * `market_media_one_default_per_market_uq` backstop), so `null` is the
 * defensive arm only — a missing row, or a presign failure degrading to no
 * image (a single unavailable object must not 500 the whole Discovery render;
 * the `mintImageUrls` resilience posture).
 */
export async function getDefaultMarketMediaUrl(
	client: DiscoveryReader,
	marketId: string,
): Promise<string | null> {
	const rows = await client
		.select({ key: marketMedia.r2ObjectKey })
		.from(marketMedia)
		.where(
			and(eq(marketMedia.marketId, marketId), eq(marketMedia.isDefault, true)),
		)
		.limit(1);

	const row = rows[0];
	if (!row) {
		return null;
	}
	try {
		return await signReadMarketMedia(row.key, READ_URL_TTL_SECONDS);
	} catch {
		// R2 unavailable for this object → degrade to no image (resilient read
		// render). The market card itself still serves.
		return null;
	}
}
