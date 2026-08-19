import { FREEZE_INSTANT_UTC } from "@/server/markets/create";

import { BrandCluster } from "./BrandCluster";
import { formatCountdown } from "./countdown-format";
import { DharmaCluster } from "./DharmaCluster";
import { GitHubStarsView } from "./GitHubStars";
import { HeaderNav } from "./HeaderNav";
import { type HeaderViewer, IdentityCluster } from "./IdentityCluster";
import { RadioSlot } from "./RadioSlot";
import { RulesControl } from "./RulesControl";
import { VisitorCounter } from "./VisitorCounter";

/**
 * The branded global header (UI.A1 — W2.4/.5/.14 mockup v0_2 structure on
 * the BRIDGE token layer; values-log v0_3 supersessions applied: brand
 * chessboard cluster, digits-only countdown, 34px control register). Server
 * component; mounted by the shell layouts (the `(public)` swap + the
 * ratified-additive `(auth)` layout land at §9 slice 5), which pass the
 * server-decided viewer — no client auth state.
 *
 * 60px band on the values-log `--bar-block` register (a design register,
 * not a repo token — component-local literal by design; zero globals.css
 * edits): bg-n0, top+bottom hairline, tier-1 elevation ("the top bar" is
 * tier 1), 3-zone `1fr auto 1fr` grid — equal side tracks keep the brand
 * cluster absolutely centred — fixed desktop max-width 1440 / 24px side
 * padding, no responsive breakpoints (design-language §1.7).
 *
 * Left zone order Back · Home · Radio · GitHub · RULES (mockup v0_2 for the
 * first three; GitHub and RULES are named deviations — see below).
 * Social/Research/Đ-info are ratified omissions (OQ-3/OQ-4 zero-supplied), each
 * a named deviation in the plan. Right zone = the Đ cluster, then JOIN or the identity chip, then a
 * hairline divider + the visitor counter at the far right (UI.13;
 * SPEC.1 §21.1).
 *
 * ⇒ TIER-4 DEVIATION — **RULES placement** (O1-DECK, founder-ruled 2026-08-18,
 * D-2). The locked W2.4/.5/.14 mockup places the tab in the CENTRE zone as a
 * sibling of the wordmark (`mockup-v0_2:208`, close-out `:31`). It ships in the
 * LEFT zone, after Radio. Measured at 1440 against the real compiled CSS: the
 * mockup's placement moves the brand cluster **41.57px** left of true centre
 * (a 73.13px control plus a 10px gap, halved — `justify-self:center` centres
 * the TRACK, never the brand inside it), which is 19% of the cluster's own
 * 220px width. The left zone measures **0.00px** shift with 387.77px of
 * headroom, and it is the utility-control family this control belongs to. ⚠ The
 * mockup did not weigh that cost and decide differently — it uses the identical
 * `1fr auto 1fr` grid (`:37`) and carries the same displacement; it simply
 * never measured it. A hidden equal-width counterweight in the centre zone was
 * the other 0.00px option and was rejected: an invisible node whose purpose is
 * also invisible.
 *
 * ⇒ TIER-4 DEVIATION — **the GitHub control** (GH-STAR, founder-ruled
 * 2026-08-19). It does not appear in the locked W2.4/.5/.14 mockup at all:
 * `docs/design/mockups/DESIGN_W2_4-5-14_global-header_mockup-v0_2.html` has no
 * repo link, no star count and no fifth left-zone control. The mockup is NOT
 * being amended — founder ruling — so THIS REGISTER IS THE RECORD, and a reader
 * comparing the two will find the header carrying one control the mockup does
 * not. That divergence is deliberate and is here.
 *
 * It ships in the LEFT zone, between Radio and RULES, because it is a utility
 * control pointing off-site and the left zone is where this header keeps those.
 * Measured at 1440 against the real compiled CSS, in a pinned same-origin frame,
 * against a staging build whose `/api/health` canary was asserted equal to the
 * measured commit in the same call as the geometry:
 *
 *   · left zone before this control — **261.37px** used of a **568.00px** track,
 *     so **306.63px** of headroom. ⚠ NOT the 387.77px quoted in the RULES entry
 *     above: that figure is the PRE-RULES reading, correct when it was taken and
 *     never re-measured after RULES landed. The difference is 81.14px, and RULES
 *     plus its gap is 81.13px — which is how the two are known to be the same
 *     measurement taken on either side of one control.
 *   · this control at a six-digit count — the worst case — takes the left zone
 *     to **427.20px**, leaving **140.80px** of slack inside its track.
 *   · brand-cluster displacement: **0.00px**. The centre track is `auto` and the
 *     two side tracks are `1fr`, so they stay equal and the cluster stays at
 *     true centre for as long as neither side zone overflows its own track.
 *
 * The tolerance, stated so the claim survives the arm that was not measured: the
 * side tracks share 1136px, so the left track is `1136 − right`. This content
 * only becomes binding once the RIGHT zone passes **708.80px**; it measures
 * 176.03px signed-out, and the signed-in arm adds only the Đ cluster. Every
 * control carries `shrink-0`, so that is a hard-overflow budget, not a
 * compression budget — nothing here degrades gracefully, which is exactly why
 * the number was re-measured rather than inherited.
 *
 * §21.1 ANTI-CONFLATION — the divider below is the register boundary, not
 * decoration. `VisitorCounter` "reads nothing from the ledger / engine" and its
 * muted register is called out in that file as "load-bearing anti-conflation,
 * not styling". BOTH Đ figures are engine-derived, so both stay LEFT of the
 * divider — they live inside the single `DharmaCluster` node, so neither can
 * drift right of the boundary without leaving the cluster entirely. Putting a
 * real Đ figure and a vanity page-hit count in the same visual bucket is exactly
 * what §21.1 forbids, and the failure would be silent. `DharmaCluster` sits
 * BEFORE the identity chip per the locked W2.4/.5/.14 mockup, whose own
 * annotation states the mechanism: "visitor count held off the Đ cluster by the
 * identity chip + divider". T4 pins the whole order. SPEC.1 §21.8 codifies it.
 *
 * `spendable` and `portfolio` are SEPARATE props, not a widening of
 * `HeaderViewer`: the Đ cluster is a SIBLING of `IdentityCluster`, not a child,
 * and `HeaderViewer` is `IdentityCluster`'s own exported type — it should not
 * carry data that component never renders. Both are optional because the
 * `(auth)` layout mounts this header WITHOUT either fetch (signed-out by
 * definition; a mid-signup `/onboarding` user may have no `dharma_ledger` row,
 * and it avoids two reads on every OTP page load).
 *
 * ⛔ `stars` IS A PROP FOR A HARD STRUCTURAL REASON, NOT FOR SYMMETRY. THIS
 * COMPONENT MUST STAY SYNC, AND NOTHING IN ITS SUBTREE MAY BE AN ASYNC
 * COMPONENT. React's client renderer refuses an async function component
 * outright, and `tests/unit/shell/dharma-cluster.test.tsx` renders this header
 * directly in jsdom — so an async child does not degrade that test, it ANNIHILATES
 * it: the whole header returns `<body><div /></body>` and assertions about
 * `DharmaCluster`, the §21.1 divider and `VisitorCounter` all fail, none of
 * which is anywhere near the child that caused it. Measured, not predicted: the
 * GitHub control shipped as an async wrapper first and cost exactly that.
 * ⇒ Any future header control needing server data takes it as a prop and the
 * LAYOUT does the await. Both layouts are already async and already do this
 * three times over. Unlike the Đ pair, `stars` is NOT viewer-scoped — both
 * layouts fetch it unconditionally, so the control never silently loses its
 * number on the `(auth)` routes, which would reproduce the very
 * value-vs-unavailable ambiguity the control is built to keep apart.
 *
 * STICKY, NOT FIXED (POLISH-1b B3; ADR-0023 §Patch 2026-08-03, D3 ruled). The
 * header was static and in normal flow, so it scrolled away on every route —
 * taking the freeze countdown and Back with it. `sticky top-0` keeps it in
 * FLOW, so nothing below needs offset compensation and the `min-h` chain is
 * undisturbed; `fixed` would have required both. Mounted here rather than in
 * each layout because this component owns the `<header>` element and its only
 * two consumers ARE the two group layouts. `(admin)` has no header by design.
 *
 * `z-40` IS THE HEADER'S RESERVED TIER. Every overlay in the app sits at
 * `z-50` — `MarketPriceChartOverlay`, `ProfileGraphOverlay`, and the shadcn
 * `Dialog` overlay/content — so all of them stack ABOVE the header, which is
 * the ADR's stated consequence. Tiers 20 and 30 are deliberately left FREE.
 * Do not raise this to 50: it would tie the header with the overlays and let
 * DOM order decide, which is exactly the silent failure this pins.
 * `tests/unit/shell/sticky-header.test.ts` enforces the ordering.
 *
 * The `bg-n0` fill is now load-bearing, not decoration: it is fully opaque
 * (#212121 over the #181818 ground), so content scrolling beneath cannot show
 * through, and `--elev-1` separates the bar from that content.
 *
 * Countdown (F2): the target is the BUILT `FREEZE_INSTANT_UTC` pin —
 * imported read-only from the markets service (never a duplicate constant)
 * — with the initial display computed here at request time so the client
 * leaf hydrates onto identical markup.
 */
export function GlobalHeader({
	viewer,
	portfolio = null,
	spendable = null,
	stars = null,
}: {
	viewer: HeaderViewer | null;
	portfolio?: string | null;
	spendable?: string | null;
	stars?: number | null;
}) {
	const targetMs = FREEZE_INSTANT_UTC.getTime();
	const initialDisplay = formatCountdown(Date.now(), targetMs);

	return (
		<header className="sticky top-0 z-40 border-y bg-n0 shadow-(--elev-1)">
			<div className="mx-auto grid h-[60px] w-full max-w-[1440px] grid-cols-[1fr_auto_1fr] items-center gap-[18px] px-6">
				<div className="flex items-center gap-2 justify-self-start">
					<HeaderNav />
					<RadioSlot />
					<GitHubStarsView stars={stars} />
					<RulesControl />
				</div>
				<div className="justify-self-center">
					<BrandCluster targetMs={targetMs} initialDisplay={initialDisplay} />
				</div>
				<div className="flex items-center justify-self-end">
					<DharmaCluster portfolio={portfolio} spendable={spendable} />
					<IdentityCluster viewer={viewer} />
					<span aria-hidden="true" className="mx-3 h-[30px] w-px bg-n2" />
					<VisitorCounter />
				</div>
			</div>
		</header>
	);
}
