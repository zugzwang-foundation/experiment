import { notFound } from "next/navigation";

import { getRequestSession } from "@/app/(public)/_lib/session";
import { DebateView } from "@/components/debate/DebateView";
import { PhoneDebateView } from "@/components/debate/phone/PhoneDebateView";
import { PhoneDetails } from "@/components/debate/phone/PhoneDetails";
import { db } from "@/db";
import { SHARED_VIEW_MIN_WINDOW_MS } from "@/server/config/limits";
import { getCachedDebateView } from "@/server/debate-view/cached-view";
import { loadDebateView } from "@/server/debate-view/load-debate-view";
import { getMarketPricingAndReserves } from "@/server/debate-view/market-pricing";
import { resolvePostParam } from "@/server/debate-view/resolve-post-param";
import { loadViewerMarketContext } from "@/server/debate-view/viewer-context";
import {
	loadViewerLatestCommentAt,
	postedWithinWindow,
} from "@/server/debate-view/viewer-freshness";
import { getCachedReserveWalk } from "@/server/discovery/cached-series";
import { withLiveTail } from "@/server/discovery/price-series";
import { pfpUrl } from "@/server/identity-pool/pfp-url";
import { getMarketBySlug } from "@/server/markets/get-by-slug";
import { recordCacheAttempt } from "@/server/observability/cache-metrics";

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
 * Phase D delivers viewer context OUTSIDE the cached block entirely (never
 * cached, read live) without STREAMING it separately.
 *
 * ⚠ Corrected post-Gate-C: price does NOT skip the cached block the way
 * viewer context does — `loadDebateView` still derives `pricing`/`unitToWin`
 * from its own pool read inside `getCachedDebateView`, because the price
 * chart's terminal stamp needs it and ADR-0025's export route depends on
 * `loadDebateView`'s signature staying untouched. What actually renders is an
 * explicit override below: `priced.pricing`/`priced.unitToWin` from the SAME
 * live read that keys the cache replace the cached model's own fields after
 * the call, so the page never depends on cache-key-equality reasoning to be
 * correct — the override is the guarantee, not an implication of it.
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
	// pool row, never cached in any form.
	//
	// ⚠ IT IS NO LONGER THE CACHE KEY, AND THAT IS CACHE-KEY-1's WHOLE SUBJECT
	// (ADR-0051). This comment used to argue that a cache HIT proved the live
	// reserves equalled a previously observed value, so the cached price could
	// not be stale. The argument was sound and the mechanism it defended was
	// not: keying on `reserves` meant every bet busted every reader's entry, so
	// the cache helped least exactly when the market was busiest. What this read
	// is FOR is unchanged and is stated where it is spent — the explicit
	// override below, which is what makes the rendered price independent of the
	// cache entirely, rather than dependent on a key nobody reading this file
	// can see.
	const priced = await getMarketPricingAndReserves(db, market.id);

	// S-4 Phase D — `getRequestSession()` replaces a direct `auth.api.getSession`:
	// the layout already read the session this request, and React's `cache()`
	// collapses the two into ONE database lookup. That matters most here, because
	// `DebatePoll` re-invokes BOTH the layout and this page every 30 s per open,
	// active tab.
	//
	// ⚠ HOISTED ABOVE THE CACHED CALL AT CACHE-KEY-1, and it costs nothing to do
	// so precisely BECAUSE of the `cache()` memo — this is the same lookup the
	// layout already paid for, read earlier in the same request. It has to be up
	// here now because the freshness question below needs a viewer id, and that
	// question decides which read produces the model.
	const session = await getRequestSession();

	// CACHE-KEY-1 — THE POSTER'S OWN ARGUMENT (ADR-0051, `viewer-freshness.ts`).
	//
	// ⛔ EVERY COMMENT RIDES A BET (**INV-1**), so while the block below was
	// keyed on `reserves`, an author's own post busted their own cache entry and
	// their `router.refresh()` carried the comment back. That was never a
	// designed behaviour — it was a side effect of the key, and it does not
	// survive the key becoming a clock. Worse, it fails SILENTLY: `DebateView`'s
	// `landed` still fires (a cache hit still deserializes a fresh payload
	// object), `findPostedNode` then searches a model without the comment and
	// returns `null`, and the author gets no card and no error.
	//
	// ⇒ One indexed read, signed-in viewers ONLY, and for a viewer who posted
	// inside the last window the page reads UNCACHED. Bounded by the clock, so
	// it stops on its own; a reader who is only reading never takes this branch
	// and never pays for it.
	const viewerPostedAt =
		session?.user?.id !== undefined
			? await loadViewerLatestCommentAt(db, {
					userId: session.user.id,
					marketId: market.id,
				})
			: null;
	const readsUncached = postedWithinWindow(
		viewerPostedAt,
		Date.now(),
		SHARED_VIEW_MIN_WINDOW_MS,
	);

	// S-4 Phase D — the SHARED block (comments, ranking, replies, totals, media,
	// chart geometry): one cached render per market, shared by every reader.
	// Keyed on `market` ALONE plus a `SHARED_VIEW_MIN_WINDOW_MS` window
	// (CACHE-KEY-1); `market.status` rides the key so a lifecycle change
	// auto-misses, and content removal busts the `market:<id>` tag from
	// `admin/moderation/act.ts`. ⛔ The `.md` export route still calls
	// `loadDebateView` DIRECTLY and uncached — ADR-0025 forbids caching it. See
	// `cached-view.ts` for why that boundary is a separate file.
	//
	// ⚠ THE BYPASS PASSES THE CACHED WALK THROUGH rather than omitting it. Omit
	// it and `deriveMarketPriceChart` replays the reserve series itself — three
	// statements, on the one path taken by the person who is already waiting.
	// `getCachedReserveWalk` is keyed on the market id alone, so it is unaffected
	// by this branch and hits either way; this is the same argument
	// `getCachedDebateView` makes for passing it.
	recordCacheAttempt("debate-view", market.id);
	const cachedModel = readsUncached
		? await loadDebateView(db, {
				market,
				walk: await getCachedReserveWalk(market.id),
			})
		: await getCachedDebateView(market);

	// Gate C fix — the price rendered on this page is `priced`'s, not the
	// cached model's own internal computation. `loadDebateView` still derives
	// `pricing`/`unitToWin` from a pool read of its own (nothing there is
	// removed — the price chart's terminal stamp reads it, ADR-0025's export
	// route depends on `loadDebateView`'s signature staying untouched), but
	// this page never renders that value: it overrides both fields with the
	// LIVE read above, the same one `reserves` was already keying the cache
	// with. On a cache hit the two are mathematically identical (same pure
	// function, same reserves, guaranteed by the key match); the override
	// exists so that identity is an explicit assignment at the call site, not
	// an implicit property of the cache key nobody reading this file can see.
	// CHART-1 — the price chart's live right edge, composed in the SAME override
	// block and from the SAME live read, for the same reason (SPEC.1 1.0.45 §9,
	// "X domain" and "Refresh"). `cachedModel.priceChart.series` is now floored
	// HISTORY: `getCachedReserveWalk` derives it at most once per
	// `MARKET_SERIES_MIN_WINDOW_MS` on a key no bet can move. **On an `Open`
	// market** `withLiveTail` puts the present instant and the live price back on
	// its right edge, so the chart cannot disagree with the `PriceBar` a few
	// pixels below it — the objection §9 raised against flooring this series at
	// all, answered here rather than waived, at zero additional queries.
	//
	// ⛔ ON EVERY OTHER STATE IT RETURNS THE SERIES UNTOUCHED, and this is THE
	// call site where that branch is reachable — Discovery lists only `Open`
	// markets. A frozen chart is its event history and nothing else: its terminal
	// keeps the price its own event produced, and if the pool ever moves after
	// close the chart and `PriceBar` WILL visibly disagree. That disagreement is
	// the intended outcome, not a bug to chase — it is true and discoverable,
	// where writing a live price onto a past event's timestamp is neither.
	// Changed at CHART-1.A; before it, this branch restamped (**INV-4**).
	//
	// ⚠ `isOpen` is READ FROM `market.status`, never assumed. A `Closed`,
	// `Resolved` or `Voided` market's domain must not advance past its last
	// event (**INV-4**), and this is the one call site where that branch is
	// reachable — Discovery only ever renders `Open` markets.
	//
	// ⚠ `new Date()` is called HERE, at render, and must never move inside
	// `getCachedReserveWalk`: a clock read behind a cached boundary freezes for
	// the whole window, which would silently put an `Open` market's "now" edge up
	// to a minute in the past.
	const nowIso = new Date().toISOString();
	const withPinnedChart = (m: typeof cachedModel): typeof cachedModel =>
		m.priceChart === null
			? m
			: {
					...m,
					priceChart: {
						...m.priceChart,
						series: withLiveTail(m.priceChart.series, {
							spotYes: priced?.pricing.yes ?? null,
							nowIso,
							isOpen: market.status === "Open",
						}),
					},
				};

	const model = withPinnedChart(
		priced === null
			? cachedModel
			: {
					...cachedModel,
					market: {
						...cachedModel.market,
						pricing: priced.pricing,
						unitToWin: priced.unitToWin,
					},
				},
	);

	// UI.A2 §3.3 — the viewer-session context, composed BESIDE the masked view
	// model (the masking gate stays viewer-independent — SG-3). Signed-out →
	// null. Banned users still receive it: ban removes voice, not reads
	// (ADR-0021 posture; the write path holds the 403).
	//
	// ⚠ `session` IS READ ONCE, ABOVE — hoisted at CACHE-KEY-1 so the freshness
	// question could reach it (see there). It is deliberately NOT re-read here:
	// `getRequestSession` is React-`cache()`d, so a second call would be free and
	// would still be a second place a reader has to check for the same value.
	// ⛔ Everything below this line is viewer-scoped and NEVER cached.
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

	// MOBILE-2 / ADR-0051 — TWO PRESENTATIONS, ONE SET OF PROPS, NO WRAPPER.
	// ⛔ THE FRAGMENT IS DELIBERATE AND IS NOT A STYLE CHOICE. `DebateView`'s
	// root is the first link of a height chain that four `*-height-chain` tests
	// read as source and that `page-container.test.ts` pins by class set; a
	// wrapping element between `<main>` and it would add a box with no height
	// declaration in the middle of that chain. A fragment emits no DOM node, so
	// `main.firstElementChild` is still the same element it was before — which is
	// also what makes the 1440px DOM-identity measurement checkable at all.
	// ⚠ The two roots hide together: `DebateView` carries one appended
	// `max-mobile:hidden`, this one is base-`hidden` with a `max-mobile:` display
	// token, and `phone-market-detail.test.ts` asserts BOTH halves — either edit
	// alone leaves the page with two trees or none, at a width the author is not
	// looking at.
	return (
		<>
			<DebateView
				model={model}
				viewer={viewer}
				initialPostId={initialPostId}
				ownPseudonym={session?.user?.pseudonym ?? null}
				// MIRROR-1 — the Mirror composer's author avatar (RF-3). The same
				// helper, over the same session field, that `(public)/layout.tsx`
				// already calls for the header's identity chip; no read is added.
				ownPfpUrl={
					session?.user ? pfpUrl(session.user.pfpFilename ?? null) : null
				}
			/>
			<PhoneDebateView
				model={model}
				viewer={viewer}
				initialPostId={initialPostId}
				ownPseudonym={session?.user?.pseudonym ?? null}
				// RF-7 — SERVER-RENDERED and handed to the client shell as a node.
				// The sheet's shell is the only client part of it; nothing inside
				// this tree crosses the boundary, so the phone pays for the details
				// screen only in payload, and only once.
				details={<PhoneDetails model={model} />}
			/>
		</>
	);
}
