import { notFound } from "next/navigation";

import { DebateView } from "@/components/debate/DebateView";
import { db } from "@/db";
import { loadDebateView } from "@/server/debate-view/load-debate-view";
import { getMarketBySlug } from "@/server/markets/get-by-slug";

/**
 * The participant debate view (DEBATE.4) — the single-market read surface,
 * composed into the SHELL `(public)/layout.tsx` shell. RSC: resolve the market
 * by its public slug (ADR-0016 — slug, never a raw UUID), `notFound()` on an
 * unknown OR `Draft` slug (OQ-2; Drafts stay admin-only), then assemble the
 * MASKED, serializable view-model via `loadDebateView` (the §6 removal-masking
 * gate — `content_removed` content/author is withheld server-side here, before
 * any DTO crosses to the client) and hand it to the `<DebateView>` boundary.
 *
 * Public-read: this route group is NOT middleware-gated (`proxy.ts` matches
 * `/admin/*` only), so signed-out visitors render fully; reads are
 * server-mediated (ADR-0019). C1: a read-only render — no write path is wired.
 */
export default async function MarketPage({
	params,
}: {
	params: Promise<{ slug: string }>;
}) {
	const { slug } = await params;
	const market = await getMarketBySlug(db, slug);
	if (market === null) {
		notFound();
	}

	const model = await loadDebateView(db, { market });
	return <DebateView model={model} />;
}
