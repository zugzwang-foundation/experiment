import "server-only";

import { and, asc, eq } from "drizzle-orm";

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

/**
 * The Market-Detail header's own image (MEDIA-SECOND-ROW, SPEC.1 §9 "Market
 * media" narrowed same-commit): the market's lowest-`display_order`
 * NON-default `market_media` row, signed for read. A single sibling to
 * `getDefaultMarketMediaUrl` above — not a parameter on it — so Discovery's
 * card (`list.ts:82`) keeps calling the unmodified original and never has to
 * reason about a second argument's default.
 *
 * One query does both jobs `ORDER BY is_default ASC, display_order ASC, id
 * ASC LIMIT 1`: SQL boolean ordering sorts `false` before `true`, so a
 * non-default row (any `display_order`) always outranks the default row when
 * one exists. When a market carries only its single `is_default` row (every
 * market today), that row is the only candidate and is returned — the
 * fallback in item 3 of the plan, expressed as the natural result of the
 * `ORDER BY`, not a branch. This is the zero-extra-round-trip shape ADR-0026
 * Driver 8 requires: one `SELECT`, same as `getDefaultMarketMediaUrl` issues
 * today, never two.
 *
 * ⚠ `id ASC` is a deterministic tiebreaker, not decoration: `display_order`
 * carries no DB-level uniqueness constraint (`market_media_market_id_idx`
 * only, no `(market_id, display_order)` unique index — the admin-form write
 * path assigns it sequentially but nothing enforces that at the row level,
 * and the plan's raw-insert data step bypasses the service entirely). Two
 * non-default rows sharing a `display_order` would otherwise leave Postgres
 * free to return either on any given call — with `DebatePoll` re-invoking
 * this read every 15s, an unstable tiebreak would surface as the header
 * image flickering between two rows across polls, silently. UUIDv7 `id` is
 * insertion-ordered, so this also picks the earliest-created row among ties.
 * Unreachable today (every market has ≤1 non-default row); cheap now,
 * expensive to diagnose later once the deferred multi-image pool lands.
 */
export async function getSecondaryMarketMediaUrl(
	client: DiscoveryReader,
	marketId: string,
): Promise<string | null> {
	const rows = await client
		.select({ key: marketMedia.r2ObjectKey })
		.from(marketMedia)
		.where(eq(marketMedia.marketId, marketId))
		.orderBy(
			asc(marketMedia.isDefault),
			asc(marketMedia.displayOrder),
			asc(marketMedia.id),
		)
		.limit(1);

	const row = rows[0];
	if (!row) {
		return null;
	}
	try {
		return await signReadMarketMedia(row.key, READ_URL_TTL_SECONDS);
	} catch {
		// R2 unavailable for this object → degrade to no image (same resilience
		// posture as getDefaultMarketMediaUrl — a single unavailable object must
		// not 500 the debate view).
		return null;
	}
}
