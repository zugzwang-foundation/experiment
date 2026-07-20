import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { DebateView } from "@/components/debate/DebateView";
import { db } from "@/db";
import { auth } from "@/server/auth";
import { loadDebateView } from "@/server/debate-view/load-debate-view";
import { resolvePostParam } from "@/server/debate-view/resolve-post-param";
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
	searchParams,
}: {
	params: Promise<{ slug: string }>;
	searchParams: Promise<{ post?: string | string[] }>;
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

	// UI.A2 §3.4 (ratified OQ-4) — the deep-link `?post=<N>` param: resolved
	// server-side to a comment id (D6 ordinal — no raw UUID in the URL), seeded
	// as DebateView's initial focus ONLY when the resolved post exists in the
	// model AND is not removed. Zero-branch law: absent, malformed (incl. a
	// repeated param arriving as an array), out-of-range, reply-targeting, or
	// removed-targeting values ALL render the plain market view — the param can
	// never 404 or throw.
	const { post } = await searchParams;
	let initialPostId: string | null = null;
	if (typeof post === "string") {
		const resolved = await resolvePostParam(db, {
			marketId: market.id,
			post,
		});
		if (resolved !== null) {
			const target = model.posts.find((p) => p.id === resolved);
			if (target && !target.removed) {
				initialPostId = resolved;
			}
		}
	}

	return (
		<DebateView
			model={model}
			viewer={viewer}
			initialPostId={initialPostId}
			ownPseudonym={session?.user?.pseudonym ?? null}
		/>
	);
}
