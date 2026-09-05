import "server-only";

import { and, asc, eq } from "drizzle-orm";

import type { DbClient, DbTransaction } from "@/db";
import { marketMedia } from "@/db/schema";
import { RENDER_IMAGE_CACHE_CONTROL } from "@/server/config/limits";
import { mintReadUrl } from "@/server/storage/r2";
import {
	DOWNSTREAM_CACHED_MINUTES,
	memoizedReadUrl,
} from "@/server/storage/read-url-memo";

/** A bound read client — top-level `db` OR a caller's transaction. */
type DiscoveryReader = DbClient | DbTransaction;

/** Discovery render-path presigned-GET TTL — mirrors the DEBATE.4 D9 seam
 * (`load-debate-view.ts` READ_URL_TTL_SECONDS). Gate C fix — 7200 s (2×
 * `cacheLife("minutes").expire`), not 3600: see that file's constant for why
 * equal-to-expire silently expires URLs still being served. */
const READ_URL_TTL_SECONDS = 7200;

/**
 * Sign a READ URL against the `market-media` bucket arm (ADR-0026 / SPEC.2
 * §12.1). A separate seam from `signRead` — that helper is hardcoded to the
 * participant `"uploads"` bucket and MUST NOT serve admin market media (plan
 * §1e); the arm exists in `r2.ts`, this wrapper only hides the bucket-id
 * literal at the call site. No validation, no DB hit — pure forward; R2
 * unavailability throws raw from `mintReadUrl`, caller decides posture.
 *
 * R2-MEMO — held for a fraction of its TTL (`read-url-memo.ts`), same rule as
 * `signRead`. The market image is the most re-served object on the site: it
 * renders on Discovery for every visitor AND on `/m/[slug]`, which re-renders
 * every 15 s. Re-minting per render meant a new URL, and so a full re-download
 * of an unchanged image, on every one of those.
 *
 * ⚠ THE BUCKET IS PART OF THE MEMO KEY, and the memo now builds that key from
 * the bucket it is HANDED rather than from a prefix written here. This arm and
 * `signRead`'s `"uploads"` arm are DIFFERENT buckets, and the §1e separation
 * above is a rule about which objects an admin path may serve — not a naming
 * convention. A memo keyed on the object alone would let one bucket's URL
 * answer for the other's identically-named key, quietly defeating it. Passing
 * the bucket instead of a hand-written prefix means the key and the mint can no
 * longer disagree about which arm this is.
 *
 * ⚠ CALLERS STATE THEIR DOWNSTREAM WINDOW. Both call sites below sit inside
 * `"use cache"` blocks; see `read-url-memo.ts` for why that has to be counted.
 */
// ⚠ `cacheControl` IS REQUIRED AND NULLABLE, exactly as on `signRead`, and it is
// stated by the caller rather than baked in here even though BOTH of today's
// callers want the same answer. Baking it in is the shape that already went
// wrong once: applying the directive inside `signRead` silently handed the admin
// moderation feed a year-long browser cache for a sixty-second URL. Market media
// has no admin-review surface today, so there is no second answer to get wrong —
// but "no second caller yet" is a fact about this week, and the parameter costs
// one argument to keep honest.
export async function signReadMarketMedia(
	key: string,
	ttlSeconds: number,
	downstreamMaxAgeSeconds: number,
	cacheControl: string | null,
): Promise<string> {
	return memoizedReadUrl(
		"market-media",
		key,
		ttlSeconds,
		downstreamMaxAgeSeconds,
		() =>
			mintReadUrl("market-media", key, ttlSeconds, cacheControl ?? undefined),
	);
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
		return await signReadMarketMedia(
			row.key,
			READ_URL_TTL_SECONDS,
			DOWNSTREAM_CACHED_MINUTES,
			RENDER_IMAGE_CACHE_CONTROL,
		);
	} catch {
		// R2 unavailable for this object → degrade to no image (resilient read
		// render). The market card itself still serves.
		return null;
	}
}

/**
 * UI-OVERNIGHT entry 4 — BOTH OF A MARKET'S RENDERED IMAGES, IN ONE STATEMENT.
 *
 * ⚠⚠ THIS SUPERSEDES `getSecondaryMarketMediaUrl`, WHICH IS DELETED IN THE SAME
 * COMMIT. That function resolved the header's image with the identical
 * `ORDER BY` and a `LIMIT 1`; keeping it beside this one would have put the same
 * ordering rule — including the `id ASC` tiebreak that stops the header
 * flickering between two rows across polls — in two places, free to drift. Its
 * integration coverage is re-pointed here rather than dropped, so the rule is
 * still measured against a real database and is now measured on both arms.
 *
 * Discovery's card and the Market-Detail header do not show the same picture,
 * and until now nothing said so out loud. Discovery signs the `is_default` row
 * (`getDefaultMarketMediaUrl`); the detail header signs the lowest-order
 * NON-default row (`getSecondaryMarketMediaUrl`), which MEDIA-SECOND-ROW
 * introduced deliberately so the header could carry a second, larger image.
 * That divergence is correct for the HEADER and wrong for the post arm's market
 * CARD, which is the same locked card composition Discovery renders — a reader
 * who left Discovery to enter a post found the market wearing a different face.
 *
 * ⛔ ONE QUERY, NOT TWO, AND THAT IS A BUDGET RATHER THAN AN OPTIMISATION.
 * `loadDebateView` spends exactly one statement on media, and `DebatePoll`
 * re-invokes the whole read every 15 s — 4 renders per minute per viewer,
 * against a `max: 10` pool behind a 15-slot session pooler. A second `SELECT`
 * for a second image is +4 statements/minute/viewer for a picture the first
 * statement's rows already contain. So the rows come back once and the two
 * choices are made in memory, exactly as ADR-0026 Driver 8 requires.
 *
 * ⚠ THE ORDER IS `getSecondaryMarketMediaUrl`'s, VERBATIM — `is_default ASC,
 * display_order ASC, id ASC`. SQL sorts `false` before `true`, so the first row
 * is the secondary when one exists and the sole default row otherwise; the
 * `id ASC` tiebreak is what stops two rows sharing a `display_order` from
 * flickering across polls. Nothing about which row the header picks changes.
 *
 * ⚠ NO `LIMIT`. A market carries a handful of media rows at most (one today),
 * and the limit is what forced two statements for two choices in the first
 * place.
 *
 * Both arms degrade to `null` independently — a presign failure on one image
 * must not blank the other, and neither may 500 a read render.
 */
export async function getMarketMediaUrls(
	client: DiscoveryReader,
	marketId: string,
): Promise<{ thumb: string | null; secondary: string | null }> {
	const rows = await client
		.select({
			key: marketMedia.r2ObjectKey,
			isDefault: marketMedia.isDefault,
		})
		.from(marketMedia)
		.where(eq(marketMedia.marketId, marketId))
		.orderBy(
			asc(marketMedia.isDefault),
			asc(marketMedia.displayOrder),
			asc(marketMedia.id),
		);

	// The DEFAULT row is Discovery's card image. `??` and not `[0]`: the first
	// row in this order is the secondary whenever one exists, and the two are
	// the same row only on a market that carries nothing else.
	const thumbKey = rows.find((r) => r.isDefault)?.key ?? null;
	const secondaryKey = rows[0]?.key ?? null;

	const sign = async (key: string | null): Promise<string | null> => {
		if (key === null) {
			return null;
		}
		try {
			return await signReadMarketMedia(
				key,
				READ_URL_TTL_SECONDS,
				DOWNSTREAM_CACHED_MINUTES,
				RENDER_IMAGE_CACHE_CONTROL,
			);
		} catch {
			// Same resilience posture as the two single-image readers above: one
			// unavailable object degrades to no image, never to a failed render.
			return null;
		}
	};

	// ⚠ Sequential, not `Promise.all`: the memo in `read-url-memo.ts` is what
	// makes the common case (both keys equal) a single presign, and racing the
	// two calls would defeat it for no gain — neither touches the database.
	const thumb = await sign(thumbKey);
	const secondary =
		thumbKey === secondaryKey ? thumb : await sign(secondaryKey);
	return { thumb, secondary };
}
