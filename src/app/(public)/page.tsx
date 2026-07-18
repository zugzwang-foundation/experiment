import { Suspense } from "react";
import type { DiscoveryMarketView } from "@/components/discovery/DiscoveryCarousel";
import { DiscoveryCarousel } from "@/components/discovery/DiscoveryCarousel";
import { EmptyState } from "@/components/discovery/EmptyState";
import { ErrorState } from "@/components/discovery/ErrorState";
import { LoadingSkeleton } from "@/components/discovery/LoadingSkeleton";
import { db } from "@/db";
import { selectHeroTopPosts } from "@/server/discovery/hero";
import { listOpenMarkets } from "@/server/discovery/list";
import { loadPriceSeries } from "@/server/discovery/price-series";

/**
 * OQ-1 A (ratified §16): Discovery ships UNCACHED/dynamic v1 — no
 * `'use cache'`, no `cacheComponents` flip (the named foundational follow-up
 * owns the R-2 cache retrofit). The page reads no dynamic API, so without
 * this it would static-prerender at build — the opposite of the ruling.
 */
export const dynamic = "force-dynamic";

/**
 * Discovery — the public front page at `/` (SPEC.1 §22; UI.A4 Slice 6).
 * Displaces the pre-launch coming-soon placeholder (`src/app/page.tsx`,
 * deleted this slice — a route group adds no path segment) and renders
 * inside the ADR-0023 `(public)/` shell: the layout owns the header and the
 * single `<main>`; anonymous and authenticated viewers get the SAME body
 * (header identity is the layout's concern — plan §5 row 1).
 *
 * The sync shell mounts the streaming boundary: `LoadingSkeleton` is the
 * §4.10 load state (Suspense fallback — no route-group `loading.tsx`, which
 * would blanket `/m/[slug]` too; the boundary is scoped HERE).
 */
export default function DiscoveryPage() {
	return (
		<Suspense fallback={<LoadingSkeleton />}>
			<DiscoveryContent />
		</Suspense>
	);
}

/**
 * The async read-model composition (exported for the page-states/wiring
 * suites): all ≤ `DISCOVERY_GRID_SIZE` markets' card + series + hero data
 * up-front — the carousel is client-side motion over already-loaded props
 * and re-fetches NOTHING (§22). Sequential per-market reads (the bounded
 * ≤8 × ~5-read cost the plan accepts uncached — §3; batching is the OQ-1 C
 * follow-up's optimization).
 *
 * ONE whole-surface try/catch: ANY read-model throw — including the masking
 * read inside `selectHeroTopPosts` — renders `ErrorState` for the WHOLE
 * surface. Never a partial render, never a per-market/per-call catch: a
 * narrower catch that defaulted the removed-set would flip Track-B masking
 * fail-open (the Slice-3 @security-auditor catch-granularity law). Zero
 * markets → the §22 empty state (no hero, no grid). Viewer-independent —
 * no session read anywhere in the body.
 */
export async function DiscoveryContent() {
	let views: DiscoveryMarketView[];
	try {
		const cards = await listOpenMarkets(db);
		views = [];
		for (const card of cards) {
			const series = await loadPriceSeries(db, card.id);
			const topPosts = await selectHeroTopPosts(db, card.id);
			views.push({ card, series, topPosts });
		}
	} catch {
		// Whole-surface fail-closed. The OQ-6 reload button is LIVE —
		// ErrorState is a "use client" leaf calling window.location.reload()
		// (R4 ruling, 2026-07-18), so the handler-less RSC render is complete.
		return <ErrorState />;
	}

	if (views.length === 0) {
		return <EmptyState />;
	}
	return <DiscoveryCarousel markets={views} />;
}
