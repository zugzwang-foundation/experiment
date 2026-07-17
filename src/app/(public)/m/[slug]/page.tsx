import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { DebateView } from "@/components/debate/DebateView";
import { db } from "@/db";
import { auth } from "@/server/auth";
import { loadDebateView } from "@/server/debate-view/load-debate-view";
import { loadViewerMarketContext } from "@/server/debate-view/viewer-context";
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

	// UI.A2 §3.3 — the viewer-session context, composed BESIDE the masked view
	// model (the masking gate stays viewer-independent — SG-3). The established
	// layout `getSession` pattern; pages re-read (layouts cannot pass data to
	// pages — accepted, plan self-critique #10). Signed-out → null. Banned users
	// still receive it: ban removes voice, not reads (ADR-0021 posture; the
	// write path holds the 403). Render-unconsumed at A2 — A3's strip consumes.
	const session = await auth.api.getSession({ headers: await headers() });
	const viewer = session?.user?.id
		? await loadViewerMarketContext(db, {
				userId: session.user.id,
				marketId: market.id,
			})
		: null;

	return <DebateView model={model} viewer={viewer} />;
}
