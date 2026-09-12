import { notFound } from "next/navigation";

import { db } from "@/db";
import {
	composePostExport,
	exportFilename,
} from "@/server/debate-export/image/compose";
import {
	renderPostExportJpeg,
	resolveExportImages,
} from "@/server/debate-export/image/render";
import { getCachedDebateView } from "@/server/debate-view/cached-view";
import { getMarketPricingAndReserves } from "@/server/debate-view/market-pricing";
import { resolvePostParam } from "@/server/debate-view/resolve-post-param";
import { getDefaultMarketMediaUrl } from "@/server/discovery/media";
import { withLiveTail } from "@/server/discovery/price-series";
import { getMarketBySlug } from "@/server/markets/get-by-slug";

/**
 * `GET /m/[slug]/export/image?post=<ordinal>` — the post + market JPEG.
 *
 * Reads exactly what the page reads: the same cached debate view, the same
 * live pricing overlay and the same live-tail chart pinning `page.tsx`
 * applies, then maps ONE post through `composePostExport`. The `post` query
 * parameter is the page's own `?post=` ordinal and resolves through the same
 * `resolvePostParam`, so the deep link and the download name the same
 * argument. A missing, malformed or REMOVED post is a 404 — a removed post's
 * body never reaches the renderer because the mapper returns `null` before
 * anything is drawn (SC-1).
 *
 * Read-only. Writes nothing, caches nothing beyond the view cache the page
 * already keeps, and never runs external HTTP inside a transaction — the
 * image fetches happen after every read has returned.
 */
export async function GET(
	req: Request,
	ctx: { params: Promise<{ slug: string }> },
): Promise<Response> {
	const { slug } = await ctx.params;
	const market = await getMarketBySlug(db, slug);
	if (market === null) {
		notFound();
	}

	const post = new URL(req.url).searchParams.get("post");
	if (post === null) {
		notFound();
	}
	const postId = await resolvePostParam(db, { marketId: market.id, post });
	if (postId === null) {
		notFound();
	}

	const priced = await getMarketPricingAndReserves(db, market.id);
	const [cached, thumbUrl] = await Promise.all([
		getCachedDebateView(market, priced?.reserves ?? null),
		// The Discovery card's thumbnail — the `is_default` media row — not the
		// debate page's secondary media panel image the view model carries.
		getDefaultMarketMediaUrl(db, market.id),
	]);
	const nowIso = new Date().toISOString();
	const model = {
		...cached,
		market:
			priced === null
				? cached.market
				: {
						...cached.market,
						pricing: priced.pricing,
						unitToWin: priced.unitToWin,
					},
		priceChart:
			cached.priceChart === null
				? null
				: {
						...cached.priceChart,
						series: withLiveTail(cached.priceChart.series, {
							spotYes: priced?.pricing.yes ?? null,
							nowIso,
							isOpen: market.status === "Open",
						}),
					},
	};

	const props = composePostExport(model, postId, Date.parse(nowIso), thumbUrl);
	if (props === null) {
		notFound();
	}

	const resolved = await resolveExportImages(props);
	return renderPostExportJpeg(
		resolved,
		exportFilename(market.slug, props.post.ordinal),
	);
}
