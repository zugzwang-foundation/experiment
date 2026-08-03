import { headers } from "next/headers";
import type { ReactNode } from "react";

import { GlobalHeader } from "@/components/shell/GlobalHeader";
import { db } from "@/db";
import { auth } from "@/server/auth";
import { getHeaderBalance } from "@/server/dharma/header-balance";
import { getHeaderPortfolio } from "@/server/dharma/header-portfolio";

/**
 * Participant app shell (SHELL/UI.0) — the reusable server-component shell every
 * later `(public)/` surface renders inside. Public-read: this route group is NOT
 * middleware-gated (proxy.ts matches `/admin/*` only), so signed-out visitors
 * reach every surface here; reads are server-mediated (ADR-0019).
 *
 * Header: the branded `GlobalHeader` (UI.A1) — the designed header ADR-0023
 * deferred as "UI.13", re-sequenced into A1 by UI-LANE §2 (ADR-0023 §Patch
 * record). Viewer selection stays server-side in this layout (no client auth
 * state): the existing `getSession` read, passed down as a plain prop.
 *
 * BOTH Đ figures are fetched HERE and ONLY for a signed-in viewer — skipped
 * entirely for signed-out visitors. They are SEPARATE props from `viewer`, not a
 * widening of `HeaderViewer` (the Đ cluster is a sibling of the identity chip,
 * not a child). The `(auth)` layout deliberately fetches neither: those routes
 * are signed-out by definition and a mid-signup `/onboarding` user may have no
 * `dharma_ledger` row.
 *
 * TWO READS, CONCURRENT, AND DELIBERATELY NOT FUSED. `getHeaderBalance` and
 * `getHeaderPortfolio` are separate modules awaited in ONE `Promise.all`, so
 * they cost one round-trip of wall-clock rather than two. The `Promise.all`
 * lives HERE, in the route layer, on purpose (HEADER-PORTFOLIO R6): there is no
 * server-side orchestrating module and no widened entry point. They are not
 * merged into a single read because `header-balance.ts` pins a BALANCE-FIRST /
 * CURSOR-SECOND statement order as a correctness constraint (MEDIUM-1,
 * `3b7db8d`) — reversing it flips a one-credit understatement into a
 * `DAILY_CREDIT_DHARMA` overstatement, a header promising capacity the composer
 * will reject. An interleaved read would put that ordering at the mercy of the
 * next tidy-up, and the breakage would be silent (R7).
 *
 * ACCEPTED COST (R12): +3 statements on this layout, uncached, every render of
 * the four participant routes plus the branded 404. That is an order of
 * magnitude below the N+1 premise the SHELL-COMPLETE fork assumed, which
 * measurement falsified — `loadProfilePositions` is 8 batched statements with
 * zero loop-issued queries. Both reads are fail-safe: either returning `null`
 * degrades the cluster, neither can fail a page.
 *
 * ACCEPTED, NOT DISCOVERED: on `/m/[slug]` the balance is read TWICE per
 * request — once here, once inside `loadViewerMarketContext` in the page.
 * `m/[slug]/page.tsx:53` already documents the cause (layouts cannot pass data
 * to pages). Both are single-row indexed lookups; not optimised here.
 *
 * "PER REQUEST" IS NOT "PER NAVIGATION" ON `/m/[slug]`. `DebatePoll` calls
 * `router.refresh()` every `POLL_INTERVAL_MS_DEBATE_VIEW` (15 s), and a refresh
 * re-executes the LAYOUT as well as the page — `docs/logs/F-DEBATE-4.md:213`
 * measured the tick at 12–14 round-trips "because the refresh re-executes the
 * layout as well as the page". So for a signed-in viewer holding that tab open
 * this pair costs 2 reads / 15 s / tab, not 2 per navigation. Still two
 * single-row indexed lookups and still not optimised here, but HARDEN.6 sizes
 * against ticks × tabs × round-trips and must count these two
 * (@code-reviewer, SHELL-COMPLETE).
 */
export default async function PublicLayout({
	children,
}: {
	children: ReactNode;
}) {
	const session = await auth.api.getSession({ headers: await headers() });
	const viewer = session
		? { pseudonym: session.user?.pseudonym ?? null }
		: null;
	const [spendable, portfolio] = session?.user?.id
		? await Promise.all([
				getHeaderBalance(db, session.user.id),
				getHeaderPortfolio(db, session.user.id),
			])
		: [null, null];

	return (
		<div className="flex min-h-full flex-col">
			<GlobalHeader
				viewer={viewer}
				portfolio={portfolio}
				spendable={spendable}
			/>
			<main className="flex-1">{children}</main>
		</div>
	);
}
