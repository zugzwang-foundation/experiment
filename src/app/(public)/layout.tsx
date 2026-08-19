import { cookies, headers } from "next/headers";
import type { ReactNode } from "react";

import { OnboardingDeck } from "@/components/onboarding/OnboardingDeck";
import { GlobalHeader } from "@/components/shell/GlobalHeader";
import { db } from "@/db";
import { auth } from "@/server/auth";
import { getHeaderBalance } from "@/server/dharma/header-balance";
import { getHeaderPortfolio } from "@/server/dharma/header-portfolio";
import { readStarCount } from "@/server/github/star-count";
import { completeOnboardingDeckAction } from "@/server/onboarding/complete";
import {
	INTRO_SEEN_COOKIE,
	shouldShowOnboardingDeck,
} from "@/server/onboarding/gate";

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

	// GH-STAR — the header's GitHub star count. Awaited HERE rather than inside
	// the control, and that is structural: `GlobalHeader` renders in jsdom in
	// `tests/unit/shell/dharma-cluster.test.tsx`, React's client renderer refuses
	// an async component, and an async child would take the ENTIRE header down in
	// that test rather than just itself. The layout is already async, so the await
	// costs nothing here and the control stays a pure sync view.
	//
	// UNCONDITIONAL, unlike the Đ pair above — the count is not viewer-scoped, so
	// a signed-out visitor sees the same header a signed-in one does. It is also
	// not a per-request read: the fetch carries `next: { revalidate: 900 }`, so
	// this resolves from the Data Cache and reaches GitHub four times an hour
	// across the whole deployment. That matters on `/m/[slug]`, where
	// `DebatePoll`'s 15-second `router.refresh()` re-executes this layout (see
	// the note above) — those ticks are cache hits, not API calls.
	//
	// Fail-safe like the two reads above: it resolves to `null` on any failure and
	// never throws, and the control renders label-only rather than a wrong number.
	const stars = await readStarCount();

	// O1-DECK — the first-login gate (SPEC.1 §21.9, ADR-0037). Decided HERE,
	// beside the `getSession` read that is already happening, because that is
	// the one place both terms are already in hand. The marker is `HttpOnly`,
	// so the client CANNOT read it — moving this decision after hydration is
	// not a style choice that was rejected, it is a thing the cookie's own
	// attributes forbid, and it is why ADR-0037 chose a cookie over
	// `localStorage`.
	const cookieStore = await cookies();
	const showOnboardingDeck = shouldShowOnboardingDeck({
		viewer,
		marker: cookieStore.get(INTRO_SEEN_COOKIE)?.value,
	});

	return (
		<div className="flex min-h-full flex-col">
			<GlobalHeader
				viewer={viewer}
				portfolio={portfolio}
				spendable={spendable}
				stars={stars}
			/>
			{/* HTML-FINISH row 8 — the surface column fills the viewport BELOW the
			    header, so a surface can hand its leftover vertical space to a
			    child that wants to grow. MEASURED, not reasoned: `flex-1` alone
			    delivered nothing here, because the wrapper above carries
			    `min-h-full` and `min-height:100%` against a parent whose own
			    height is min-height-driven resolves to `auto` — in a 777px
			    viewport that column measured 510px, so `<main>` had no slack to
			    divide and the hero absorbed none of it.
			    `100vh` is the window, which is literally what the row asks for.
			    The subtrahend is the header's BORDER-BOX, written as its two
			    shipped contributors rather than as a single opaque number:
			    `60px` is `GlobalHeader.tsx`'s `h-[60px]` inner row, and `2px` is
			    its `border-y` (1px top + 1px bottom, Tailwind's default width).
			    Neither is read off the mockup and nothing new is invented.
			    ⚠ MEASURED, AND THE FIRST ATTEMPT WAS WRONG. Subtracting only the
			    60px left the column 2px taller than the viewport, i.e. a permanent
			    scrollbar on a page that fits — caught by measuring the real
			    compiled CSS in a browser, not by reading the class strings.
			    ⛔ `min-h-*`, never `h-*`, and NO `min-h-0` anywhere in the chain:
			    the floor lets the page GROW and SCROLL when content exceeds the
			    viewport (RULED A1) instead of clipping it. The mockup's
			    `overflow:hidden` on html/body is a fixed-viewport prototype
			    affordance and is deliberately NOT adopted.

			    ⚠⚠ A1 IS REVERSED FOR `/m/[slug]` ONLY, founder-ruled 2026-08-17:
			    "It's a one page view — there should be no scroll down. The
			    dimensions of the whole market detail page are not matching — it
			    should be exact." That route's container now declares
			    `h-[calc(100dvh-60px-2px)]` with `overflow-hidden` and hides its
			    own overflow inside `DebateColumn`'s `.colwrap` scroller, so
			    nothing is clipped — see `debate-height-chain.test.ts`, which now
			    REQUIRES the band it used to forbid.
			    ⛔ THIS ELEMENT IS UNCHANGED AND THE RULE ABOVE STILL STANDS FOR
			    EVERY OTHER `(public)` SURFACE. The ruling names one route; a
			    surface that has not been ruled one-screen must keep the floor,
			    because a fixed height without an internal scroller CLIPS. Do not
			    generalise this exemption without a ruling that names the route. */}
			<main className="flex min-h-[calc(100vh-60px-2px)] flex-1 flex-col">
				{children}
			</main>
			{/* O1-DECK — the first-login deck, a SIBLING of `<main>` and never a
			    wrapper of it. Radix renders `DialogPortal` to `document.body`, so
			    this node is outside the flex column entirely and cannot
			    participate in the height chain above — which is what lets the
			    deck be added to this layout's RENDER OUTPUT without being added
			    to its LAYOUT CHAIN. `<main>` and its class string are untouched
			    (four `*-height-chain` tests read this file as their source, and
			    two live rulings sit on that element).

			    MOUNTED UNCONDITIONALLY, OPENED BY PROP. `initialOpen` seeds the
			    deck's own `useState` ONCE; the client owns `open` from then on.
			    That is load-bearing rather than tidy: `DebatePoll` calls
			    `router.refresh()` every 15 s on `/m/[slug]`, and a refresh
			    re-executes this LAYOUT as well as the page. Were `open` derived
			    from this prop on every render, a tick landing in the window
			    between the optimistic close and the cookie being written would
			    RE-OPEN a deck the participant had just completed — a 15-second
			    haunting that reproduces on exactly one route. A closed Radix
			    dialog portals nothing, so mounting it for a signed-out visitor
			    costs one unmounted client component and no DOM.

			    The completion action is passed as a PROP, not imported by the
			    deck. This is the only site in the tree that references it, so
			    the re-show — mounted from `RulesControl`, which reaches
			    `/sign-in` — has no path to the marker at all. D-4 is therefore a
			    compile-time fact rather than a runtime branch someone can flip:
			    a signed-out visitor reading the rules on `/sign-in` cannot mint
			    a marker that would suppress their own first-login gate later. */}
			<OnboardingDeck
				context="first-login"
				initialOpen={showOnboardingDeck}
				pseudonym={viewer?.pseudonym ?? null}
				onComplete={completeOnboardingDeckAction}
			/>
		</div>
	);
}
