import { notFound } from "next/navigation";

import { getRequestSession } from "@/app/(public)/_lib/session";
import { DebateView } from "@/components/debate/DebateView";
import { db } from "@/db";
import { getCachedDebateView } from "@/server/debate-view/cached-view";
import { getMarketPricingAndReserves } from "@/server/debate-view/market-pricing";
import { resolvePostParam } from "@/server/debate-view/resolve-post-param";
import { loadViewerMarketContext } from "@/server/debate-view/viewer-context";
import { getMarketBySlug } from "@/server/markets/get-by-slug";

/**
 * F-DEBATE-4 — the route's dynamism, stated explicitly. Originally
 * `force-dynamic`, so a poll against an accidentally-static route couldn't
 * serve a frozen payload indefinitely (SPEC.2 1.0.22 §4.3). S-4 Phase B
 * enabled `cacheComponents`, under which `force-dynamic` errors the build
 * (redundant by the framework's own default). `instant = false` is the
 * equivalent opt-out.
 *
 * ⚠ IT STAYS ON AFTER S-4 PHASE D, and the reason is a reported constraint
 * rather than an oversight. Lifting it requires this route's runtime reads
 * (session, `?post=`) to sit inside `<Suspense>`-wrapped children, which the
 * pack's §2.4 diagram assumes is possible. It is not, here: `model` and
 * `viewer` are both props of `DebateView`, a single 744-line `"use client"`
 * component that owns composer state, focus, popups and poll suspension, and
 * which four `*-height-chain` tests read as source. Splitting it into
 * streaming siblings is a large UI refactor past this task's budget, so
 * Phase D delivers price and viewer context OUTSIDE the cached block (never
 * cached, read live) without STREAMING them separately.
 *
 * The poll's own guarantee is unchanged either way: this PAGE file carries no
 * `'use cache'`, so `router.refresh()` still re-executes it. What changed is
 * that the shared block underneath now resolves from cache when nothing has
 * moved — see `getCachedDebateView`.
 */
export const instant = false;

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

	// S-4 Phase D — THE LIVE READ, and it is deliberately first. One indexed
	// pool row, never cached in any form. Its `reserves` become the cache key
	// below, which is what makes the cached block impossible to serve stale: any
	// bet moves the pool, changes the key, and forces a recompute.
	const priced = await getMarketPricingAndReserves(db, market.id);

	// S-4 Phase D — the SHARED block (comments, ranking, replies, totals, media,
	// chart geometry): one cached render per market, shared by every reader.
	// Keyed on `(market, reserves)`; `market.status` rides the key so a lifecycle
	// change auto-misses, and content removal busts the `market:<id>` tag from
	// `admin/moderation/act.ts`. ⛔ The `.md` export route still calls
	// `loadDebateView` DIRECTLY and uncached — ADR-0025 forbids caching it. See
	// `cached-view.ts` for why that boundary is a separate file.
	const model = await getCachedDebateView(market, priced?.reserves ?? null);

	// UI.A2 §3.3 — the viewer-session context, composed BESIDE the masked view
	// model (the masking gate stays viewer-independent — SG-3). Signed-out →
	// null. Banned users still receive it: ban removes voice, not reads
	// (ADR-0021 posture; the write path holds the 403).
	//
	// S-4 Phase D — `getRequestSession()` replaces a direct
	// `auth.api.getSession`: the layout already read the session this request,
	// and React's `cache()` collapses the two into ONE database lookup. That
	// matters most here, because `DebatePoll` re-invokes BOTH the layout and
	// this page every 15 s per open tab. ⛔ Everything below this line is
	// viewer-scoped and NEVER cached.
	const session = await getRequestSession();
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
