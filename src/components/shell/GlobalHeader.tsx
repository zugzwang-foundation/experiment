import { cn } from "@/lib/utils";
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
import { XLink } from "./XLink";

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
 * tier 1), 3-zone `1fr auto 1fr` grid, fixed desktop max-width 1440 / 24px side
 * padding.
 *
 * ⛔ THE SIDE TRACKS ARE NOT EQUAL AT EVERY WIDTH, AND THIS SENTENCE USED TO SAY
 * THEY WERE. It read "equal side tracks keep the brand cluster absolutely
 * centred". `1fr` is `minmax(auto, 1fr)`, so a side track never shrinks below its
 * own min-content: once the LEFT zone freezes at its 157.13px min-content, all
 * remaining free space lands on the right and the cluster is pushed off centre.
 * Measured on the live build, signed out: **11.63px right of true centre at
 * 375px**. The claim holds at 1440 and fails below roughly 364px, which is
 * exactly the band this component now renders in.
 *
 * ⚠⚠ AND BELOW 640 NEITHER HALF OF THAT PARAGRAPH IS LIVE ANY MORE — the row is
 * not a grid there (A13 D-1), so it has no `1fr` tracks to be unequal. The
 * arithmetic above governs 640 and up, where the grid is untouched; the phone
 * tier's own arithmetic is the A13 D-4 fit ladder, recorded in this round's
 * report. Both paragraphs are kept because the desktop one is still true of the
 * desktop.
 *
 * ⛔⛔ AND THE CONSEQUENCE IS WORSE THAN A DISPLACEMENT — THE MARK IS THIS
 * HEADER'S SHOCK ABSORBER. The brand mark is the one control in either side zone
 * with NO `shrink-0`; it computes `flex-shrink: 1`, `min-width: auto`. So when
 * the row runs out of room the layout buys the absence of a scrollbar by
 * spending the logo, silently and continuously, with `document.scrollWidth ==
 * clientWidth` throughout. Measured signed out on staging: at 375px the mark is
 * 48.00px; at 320px it is **3.75px, with ZERO reported document overflow**. There
 * is no error, no scrollbar, and the `<a>` and its `aria-label` are still present
 * and still measurable — the only evidence is that the logo is gone.
 * ⇒ Any change that grows a side zone must re-measure the MARK's own computed
 * width. Nothing else will report it (ADR-0049 OI-A, deliberately left open: the
 * founder chose the shrunken logo over a scrollbar).
 *
 * MOBILE-1 Phase A amends design-language §1.7 for THIS component when
 * `mobileResponsive` is true (see the prop below) — the same narrowing ADR-0045
 * makes for Discovery and `/m/[slug]`. ⚠ THIS PARAGRAPH USED TO END "never for
 * the `(auth)` mount, which stays governed by §1.7 as originally written",
 * quoting ADR-0045's "gated, not made responsive" carve-out as live doctrine.
 * **ADR-0048 supersedes exactly that carve-out** — a phone participant is allowed
 * to join — so `(auth)/layout.tsx` opts in too and all three auth routes reflow
 * at the 640px tier. Both mounts opt in today. No breakpoint-scoped class in this
 * file is unconditional; every one is gated by that prop, and the gate is what
 * keeps "which surfaces reflow" a decision a layout makes.
 *
 * ⚠ AND THAT OBLIGATION DOES NOT STOP AT THIS FILE. `RulesControl` is a static
 * child of both mounts and `OnboardingDeck` is a static child of it, so a
 * breakpoint class left unconditional two hops down reaches `(auth)` exactly as
 * surely as one written here. Both take the prop for that reason; `RulesControl`
 * consumes it for nothing else. Anything added to this subtree inherits the same
 * rule — the gate is the prop chain, not the file boundary.
 *
 * Left zone order Back · Home · Radio · GitHub · X (mockup v0_2 for the first
 * three; GitHub and X are named deviations — see below).
 * ⚠ IT READ `… · GitHub · RULES` UNTIL MKT-ROSTER-1-P3, which moves RULES to the
 * right zone on a founder ruling and gives its slot to `XLink`. The count is
 * unchanged at five, so a reader checking the zone's width budget against the
 * measurements below is still reading about five controls — but they are not the
 * same five, and X is 34.14px where RULES was 73.13px.
 *
 * ⛔ BELOW 640 THE WHOLE ROW READS `home · logo · countdown · RULES · identity`
 * AND THE ZONES ARE GONE. Back and the secondary controls are `display:none`,
 * the two remaining zone wrappers are `display:contents`, and the brand cell
 * rejoins the flow — so the five survivors are direct flex items of one row with
 * one gap. `ms-auto` on the identity zone is what decides where spare width
 * goes: all of it, always, between the countdown and the identity zone, and none
 * of it between the logo and the countdown.
 * ⚠⚠ ADR-0051 A13 D-1 RULES THIS ROW `home · RULES · logo · countdown ·
 * identity`, AND MKT-ROSTER-1-P3 SUPERSEDES IT ON EXACTLY THAT POINT. RULES is
 * now inside the identity zone, which does NOT flatten to `contents`, so it
 * travels with the identity cluster instead of staying beside Home. The
 * SURVIVOR SET is unchanged and so is every A13 D-4 fit-ladder rung; what moved
 * is one control's position in the line. ⛔ The spare width now opens between the
 * countdown and RULES rather than between the countdown and the avatar — the
 * `ms-auto` node is the same node, and RULES is simply its first child.
 *
 * ⛔ THERE IS ONE GITHUB CONTROL AGAIN, AND THIS PARAGRAPH USED TO DESCRIBE TWO.
 * It read: *"AND THERE IS A SECOND GITHUB CONTROL, IN THE RIGHT ZONE, BELOW
 * 640px ONLY"* — `GitHubIconControl`, the icon-only form, mounted first in the
 * right zone by ADR-0051 A10 D-5 so that a phone reader could still reach the
 * repository once `header-secondary-controls` hid. **ADR-0051 A13 D-1 withdraws
 * it**, along with A12 D-1's "one off-site control" — a 360px row cannot carry
 * home, rules, the logo, a countdown, an identity cluster AND a repository link,
 * and of those the repository link is the one a phone reader can do without.
 * The component file is deleted rather than left unmounted: an unmounted control
 * with a green guard is a control nobody can tell is gone.
 * ⇒ The surviving GitHub control is the left zone's `GitHubStarsView`, inside
 * `header-secondary-controls`, which hides below 640 — so the repository is
 * reachable at and above 640 and from nowhere in the phone header. That is the
 * ruling, not an oversight.
 * Social/Research/Đ-info are ratified omissions (OQ-3/OQ-4 zero-supplied), each
 * a named deviation in the plan. Right zone = RULES, then the Đ cluster, then
 * JOIN or the identity chip, then a hairline divider + the visitor counter at
 * the far right (UI.13; SPEC.1 §21.1) — **at and above 640px.** Below
 * `--breakpoint-mobile` three of the five are hidden, so the zone reads `RULES ·
 * avatar-or-JOIN` and is pushed to the row's right edge by `ms-auto` (A13 D-1).
 * ⚠ RULES JOINED THIS ZONE AT MKT-ROSTER-1-P3 and this sentence opened with the
 * Đ cluster until then. ⛔ THE §21.1 REGISTER BOUNDARY IS UNTOUCHED IN BOTH
 * DIRECTIONS, and that is the claim to check rather than the order: nothing
 * engine-derived moved, and nothing crossed the divider. RULES lands on the
 * cluster's side of it, which is correct — it is a control, not a figure, and
 * §21.1 partitions FIGURES. The visitor counter is still the sole element to the
 * divider's right.
 *
 * ⇒ TIER-4 DEVIATION — **RULES placement** (O1-DECK, founder-ruled 2026-08-18,
 * D-2; RE-RULED at MKT-ROSTER-1-P3). The locked W2.4/.5/.14 mockup places the
 * tab in the CENTRE zone as a sibling of the wordmark (`mockup-v0_2:208`,
 * close-out `:31`). ⚠ IT SHIPS FIRST IN THE **RIGHT** ZONE; this sentence read
 * "the LEFT zone, after Radio" until the founder moved it to the identity side.
 * The deviation from the mockup is unchanged in kind — still not the centre zone
 * — and the measurement below is what ruled the centre zone OUT, so it still
 * governs. What it does not decide, and never did, is which SIDE zone hosts the
 * control: both cost 0.00px of brand displacement while their track has
 * headroom, so that choice was always free and is now the founder's. Measured at
 * 1440 against the real compiled CSS: the
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
 * It ships in the LEFT zone, between Radio and X, because it is a utility
 * control pointing off-site and the left zone is where this header keeps those.
 * ⚠ "between Radio and RULES" until MKT-ROSTER-1-P3 — RULES left the zone and
 * `XLink` took its slot, so this control's own neighbours changed without it
 * moving. The measurements below were taken with RULES still present and are
 * therefore a LOWER BOUND on today's headroom, X being 39.13px narrower.
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
 *   · this control at a six-digit count took the left zone to **427.20px**,
 *     leaving **140.80px** of slack inside its track. ⚠ That was measured while
 *     the count rendered GROUPED, where `999,999` was seven glyphs and so
 *     genuinely the worst case. GH-STAR-COMPACT (founder-ruled 2026-08-19) made
 *     that count render `1m`, and the widest render available to the formatter
 *     is now `999.9k` — strictly narrower. The figure is therefore an UPPER
 *     bound rather than the worst case, and is deliberately NOT re-measured: it
 *     can only overstate the zone, and the conclusion it supports is slack.
 *   · brand-cluster displacement: **0.00px**. The centre track is `auto` and the
 *     two side tracks are `1fr`, so they stay equal and the cluster stays at
 *     true centre for as long as neither side zone overflows its own track.
 *
 * The tolerance, stated so the claim survives the arm that was not measured —
 * ⚠ AND IT IS A 1440px TOLERANCE, WHICH IS THE CAVEAT THIS PASSAGE SHIPPED
 * WITHOUT AND NOW NEEDS: the side tracks share 1136px only at the 1440 cap, so
 * the left track is `1136 − right` only there. This content becomes binding once
 * the RIGHT zone passes **708.80px**; it measures 176.03px signed-out, and the
 * signed-in arm adds only the Đ cluster. At phone width the arithmetic is a
 * different one entirely — see the shock-absorber paragraph at the head of this
 * docblock.
 *
 * ⛔ TWO CORRECTIONS TO WHAT THIS PARAGRAPH USED TO ASSERT, BOTH MEASURED. It
 * said *"every control carries `shrink-0`, so that is a hard-overflow budget,
 * not a compression budget — nothing here degrades gracefully."* **The brand mark
 * does not carry `shrink-0`**, and the consequence is the opposite of the one
 * stated: the row does not hard-overflow, it silently compresses the mark to
 * nothing while reporting zero overflow. The rest of the sentence is true of
 * every OTHER control, and the exception is the whole story.
 *
 * ⇒ TIER-4 DEVIATION — **the X control** (MKT-ROSTER-1-P3, founder-ruled
 * 2026-09-19). Like the GitHub control it does not appear in the locked
 * W2.4/.5/.14 mockup at all, and the mockup is NOT being amended — so this
 * register is again the record. It takes the left-zone slot RULES vacated, for
 * the reason the GitHub entry gives: it is a utility control pointing off-site,
 * and the left zone is where this header keeps those. It wears
 * `HEADER_PILL_BUTTON`, the same string RULES wears, so the two are the same box
 * by construction rather than by inspection.
 * ⚠ NET EFFECT ON THE LEFT ZONE'S BUDGET: RULES (73.13px) out, X (a 34x34
 * square — the pill register with its padding zeroed around a 15px mark) in
 * — strictly narrower by 39.13px, so the
 * headroom figures above can only improve. The RIGHT zone gains RULES plus its
 * 14px margin and must be RE-MEASURED, which is what the brand mark's
 * shock-absorber paragraph at the head of this docblock demands of any change
 * that grows a side zone. ⛔ The mark is the only control in either zone without
 * `shrink-0`, and it reports no overflow while it disappears.
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
	mobileResponsive = false,
}: {
	viewer: HeaderViewer | null;
	portfolio?: string | null;
	spendable?: string | null;
	stars?: number | null;
	/**
	 * MOBILE-1 — the read-surface amendment, threaded down rather than assumed.
	 * **BOTH mounts opt in.** `(public)/layout.tsx` passes it (its mount backs
	 * Discovery and `/m/[slug]`), and `(auth)/layout.tsx` passes it too, so
	 * `/sign-in`, `/sign-in/otp` and `/onboarding` reflow at the 640px tier as
	 * well.
	 *
	 * ⚠ THIS DOCBLOCK SAID THE OPPOSITE UNTIL ADR-0049 AND WAS FLATLY FALSE FOR
	 * THE WHOLE OF THAT TIME. It read *"`(auth)/layout.tsx` passes nothing, so
	 * those three routes render this component BYTE-IDENTICAL to before this
	 * task"*, citing ADR-0045's auth/join carve-out. **ADR-0048 superseded that
	 * carve-out and `(auth)` has opted in since MOBILE-1 · Job A** — a phone
	 * participant is allowed to join, and a join surface rendering 379px wider
	 * than the phone reading it is the defect, not the fix.
	 *
	 * ⛔ THE PROP AND ITS `= false` DEFAULT SURVIVE, AND "both callers pass it,
	 * so delete it" IS THE WRONG INFERENCE. The polarity is a property of the
	 * DEFAULT, not of who currently passes it: it is what makes a future THIRD
	 * mount safe by omission, inheriting the desktop render rather than an
	 * accidental reflow (AGENTS.md §8). ADR-0048 `:84` weighs deleting the prop
	 * (path (ii)) and rejects it.
	 *
	 * ⚠ THE GATE IS THE PROP CHAIN, NOT THE FILE BOUNDARY, and this prop now
	 * threads SIX hides across FIVE files. `BrandCluster`, `VisitorCounter` and
	 * `RulesControl` take it from Phase A; `DharmaCluster` and `IdentityCluster`
	 * take it from ADR-0049. A breakpoint class left unconditional anywhere in
	 * that subtree reaches every mount at once — which is how three ungated
	 * classes once shipped onto `/sign-in` through `RulesControl` →
	 * `OnboardingDeck`. Nothing here infers "which route" from anything but this
	 * flag, and nothing downstream may either.
	 */
	mobileResponsive?: boolean;
}) {
	const targetMs = FREEZE_INSTANT_UTC.getTime();
	const initialDisplay = formatCountdown(Date.now(), targetMs);

	return (
		<header className="sticky top-0 z-40 border-y bg-n0 shadow-(--elev-1)">
			{/* ⛔⛔ ADR-0051 A13 D-1/D-3 — BELOW 640 THIS ROW IS A FLAT FLEX LINE AND
			    THE THREE ZONES STOP BEING ZONES. A9 D-3 took the brand cell OUT of
			    the grid and pinned it to the header's midpoint; A13 D-3 withdraws
			    that below 640, because a countdown has to sit BESIDE the logo and a
			    centred logo has no beside. The grid cannot express `home · rules ·
			    logo · countdown · identity` with one gap: `1fr auto 1fr` decides the
			    spare width for you, and the founder's instruction is that the spare
			    width lands in exactly one place — between the countdown and identity.
			    ⇒ `flex` + `ms-auto` on the last zone says that in two tokens.
			    ⛔ AND THE TWO ZONE WRAPPERS BECOME `contents`, WHICH IS WHAT MAKES
			    "ALL GAPS EQUAL" STRUCTURAL RATHER THAN MAINTAINED. Leave them as flex
			    boxes and the row has THREE gap declarations — this one, the left
			    zone's `gap-2`, and the brand cell's — that happen to agree today and
			    must be edited together forever; the A13 D-4 ladder moves the gap
			    twice, so "forever" starts immediately. With `contents` the wrappers
			    contribute no box, every control is a direct flex item of THIS row,
			    and there is one number. A wrapper's own `gap-2` and `items-center`
			    go inert below 640; `items-center` is on this row too, so nothing is
			    lost. A hidden child (`max-mobile:hidden`) is `display:none` and so
			    not a flex item at all — it takes no gap, which is why removing
			    Back and the secondary controls leaves no hole.
			    ⚠ ABOVE 640 NOTHING HERE APPLIES: the grid, its three tracks and its
			    18px gap are the unprefixed default (AGENTS.md §8, override never
			    replace), and every token below is gated on the prop as well. */}
			<div
				className={cn(
					"mx-auto grid h-[60px] w-full max-w-[1440px] grid-cols-[1fr_auto_1fr] items-center gap-[18px] px-6",
					mobileResponsive && "max-mobile:flex max-mobile:gap-[5px]",
				)}
			>
				<div
					className={cn(
						"flex items-center gap-2 justify-self-start",
						mobileResponsive && "max-mobile:contents",
					)}
				>
					{/* MOBILE-2m · R-3 / ADR-0051 A9 D-3 — Back does not render below
					    640px, and the hide is threaded rather than written into
					    `HeaderNav` unconditionally: that component is a static child of
					    BOTH mounts, so an ungated class there reaches `(auth)` too. Home
					    and RULES shift left by the 42px Back and its gap give up;
					    nothing is repositioned to make that happen. */}
					<HeaderNav mobileResponsive={mobileResponsive} />
					{/* MOBILE-1 Phase A — the off-site/decorative utility controls, and
					    the ONLY things in this zone that hide below 640px.
					    ⚠ RULES USED TO BE THE SIBLING BELOW THIS WRAPPER, and the note
					    that stood here explained why it was outside rather than in:
					    SPEC.1 §21.9 makes it the onboarding deck's only re-show entry
					    point, "present for every viewer, authenticated or not". That
					    reasoning is unchanged and has simply moved with the control —
					    MKT-ROSTER-1-P3 puts RULES first in the RIGHT zone, which is
					    likewise never hidden. `XLink` takes the vacated slot. */}
					<div
						data-testid="header-secondary-controls"
						className={cn(
							"flex shrink-0 items-center gap-2",
							mobileResponsive && "max-mobile:hidden",
						)}
					>
						<RadioSlot />
						<GitHubStarsView stars={stars} />
					</div>
					{/* ⛔ X IS A SIBLING OF THE WRAPPER, NOT A CHILD OF IT, AND CARRIES
					    ITS OWN GATED HIDE. Two reasons, and neither is tidiness: that
					    wrapper is guarded as holding Radio and GitHub ONLY, and the
					    ADR-0049 convention for "hides at the tier" is a token on the
					    component's own root behind `mobileResponsive` — the shape
					    `VisitorCounter`, `DharmaCluster` and `IdentityCluster` all
					    already ship. The rendered outcome is GitHub's exactly: visible
					    at ≥640, `display:none` below it. */}
					<XLink mobileResponsive={mobileResponsive} />
				</div>
				{/* ⛔⛔ ADR-0051 A13 D-3 WITHDRAWS A9 D-3 BELOW 640: THE MARK IS A FLOW
				    ITEM AGAIN, AND THE THREE TOKENS THAT PINNED IT TO THE HEADER'S
				    MIDPOINT ARE GONE.
				    What follows is the argument A9 made for pinning it, kept because it
				    is still exactly right ABOVE 640 and because its numbers are the
				    reason the pin existed at all. What changed is not the arithmetic but
				    the requirement: A13 D-2 puts a countdown beside the logo, and a logo
				    pinned to the centre has no beside — whichever side the digits took,
				    they would straddle the midpoint and the "centred" mark would read as
				    off-centre by half a countdown.
				    ⇒ Below 640 the cell is `display:contents` and the mark flows after
				    RULES. Above 640 it is still `justify-self-center` in the `auto`
				    track, exactly as before.
				    ⚠ AND THE MARK IS THIS ROW'S SHOCK ABSORBER AGAIN BELOW 640, which A9
				    had removed by taking it out of the flow. It is still the one control
				    here without `shrink-0`, so if the phone row ever runs out of room it
				    spends the logo silently rather than overflowing — the ADR-0049 OI-A
				    behaviour, back on this tier. The A13 D-4 ladder is sized so it never
				    has to: the fit is measured at 360 signed out with the mark at its
				    full 48px, and that measurement is the guard.

				    ── A9 D-3's argument: superseded below 640, live above it ──
				    THE MARK IS POSITIONED
				    AGAINST THE HEADER, NOT AGAINST THE SPACE THE BUTTONS LEAVE, AND THAT
				    DISTINCTION IS THE WHOLE ITEM.
				    This docblock's third paragraph already states the mechanism: `1fr` is
				    `minmax(auto, 1fr)`, so once the LEFT zone freezes at its own
				    min-content every remaining pixel lands on the right and the `auto`
				    centre track is pushed off true centre. MEASURED at the floor, signed
				    in: the mark's centre sits at a CONSTANT 223.13px at every phone width,
				    so the error is simply whatever the viewport's half is — **+43.13px at
				    360, +35.63 at 375, +28.13 at 390, +8.13 at 430.** Taking Back away
				    does NOT fix that: it moves the constant, leaving the mark off centre
				    by a different number at every width.
				    ⇒ Below 640 the cell leaves the grid entirely and is placed on the
				    header's own axis. `<header>` is `sticky`, which IS a positioned
				    element and therefore the containing block — and the grid row inside it
				    is `mx-auto w-full max-w-[1440px]`, i.e. exactly the header's width at
				    any phone viewport, so header centre and row centre are the same point
				    and the choice between them cannot matter. The measurement asserts the
				    delta against the HEADER's own box rather than trusting that sentence.
				    ⚠ IT COSTS THE CENTRE TRACK, DELIBERATELY. With the cell absolute the
				    `auto` track collapses to zero and the two `1fr` tracks split the row —
				    which is what SHOULD happen: the side zones no longer have to leave a
				    hole for something that is not in the flow.
				    ⚠ AND THE MARK STOPS BEING THIS ROW'S SHOCK ABSORBER BELOW 640. Out of
				    the flex row it can no longer be the item that shrinks when the row runs
				    out of room, so the 3.75px mark this docblock records at 320px cannot
				    recur on this tier. That is a consequence worth naming, not a claim that
				    ADR-0049 OI-A is closed: at and above 640 the mark is still in the grid
				    and still the absorber. */}
				<div
					className={cn(
						"justify-self-center",
						mobileResponsive && "max-mobile:contents",
					)}
				>
					<BrandCluster
						targetMs={targetMs}
						initialDisplay={initialDisplay}
						mobileResponsive={mobileResponsive}
					/>
				</div>
				{/* ⛔⛔ `max-mobile:ms-auto` REPLACES `max-mobile:col-start-3` AT A13, AND
				    THE SWAP IS NOT COSMETIC — THE DEFECT THE OLD TOKEN EXISTED TO STOP
				    CANNOT OCCUR ANY MORE.
				    `col-start-3` was a GRID placement, needed only because A9 took the
				    brand cell out of flow: with two in-flow items left, auto-placement
				    gave this zone track 2 and the avatar painted over the logo. Below 640
				    there is no grid now (A13 D-1) and the brand cell is back in flow, so
				    there is no track to be auto-placed into and nothing for the token to
				    prevent. Leaving it would be a class whose whole justification had
				    been withdrawn — inert, and inert for a reason the next reader would
				    have to reconstruct.
				    ⇒ What this zone needs instead is a rule for the SPARE WIDTH, which
				    the grid used to decide by itself. `ms-auto` sends all of it here and
				    none of it between the logo and the digits, which is the founder's
				    instruction stated in one token.
				    ⚠ `justify-self-end` STAYS and is the ≥640 default, untouched;
				    `dharma-cluster.test.tsx`'s T4 guard locates this zone by it.

				    ── the A9 argument this replaces, kept because its failure mode is
				       the kind that passes every number ──
				    `col-start-3` IS THE OTHER HALF OF THE CENTRING,
				    AND WITHOUT IT THIS ZONE LANDS ON TOP OF THE MARK. Taking the brand
				    cell out of flow (above) does not merely collapse the `auto` track — it
				    removes that cell as a grid ITEM, so auto-placement re-flows what is
				    left: the left zone takes track 1 and THIS zone takes track **2**, the
				    centre, with track 3 empty. MEASURED at 390 before this token:
				    `grid-template-columns: 131px 44px 131px`, the identity chip at x 173
				    w 44 and the mark at x 171 w 48 — both centred on 195, the avatar
				    painted over the logo. `justify-self-end` was doing its job perfectly;
				    it was ending this zone at the right edge of the wrong track.
				    ⚠ AND IT IS INVISIBLE TO EVERY NUMBER THIS ROUND MEASURES. The brand
				    mark's own centre was 0.00px off the header's, the document did not
				    overflow, nothing changed at 640 or 1440, and both walls passed. A
				    screenshot is what found it, which is the argument for taking one.
				    ⇒ Naming the column explicitly makes the placement independent of how
				    many siblings are in flow.
				    ⛔ AND IT IS THREADED ON THE PROP LIKE EVERY OTHER TOKEN IN THIS FILE. It
				    shipped `max-mobile:`-prefixed but UNGATED for one review cycle, which
				    made it the only breakpoint class here outside the prop chain — and this
				    paragraph argued its inertness above 640 INSTEAD of taking the gate. Both
				    halves were wrong the same way: AGENTS.md §8 states the rule with no
				    exception, and inertness is a property of today's sibling COUNT, which is
				    precisely what this fix exists to stop depending on. The divider four
				    nodes below had the identical "it would be inert" argument available and
				    takes the gate anyway. `@code-reviewer`, MEDIUM.
				    ⚠ THE LEFT ZONE IS SAFE BY SPEC, NOT BY LUCK, and is deliberately left
				    auto-placed: CSS Grid §8.5 step 4 starts the cursor at row 1 column 1 and
				    walks in order-modified document order, so with two in-flow items the left
				    zone takes column 1 and this zone's explicit 3 is honoured without
				    incrementing the row. Naming it too would make the row self-describing and
				    is docketed as a decision rather than taken as an edit. */}
				<div
					className={cn(
						"flex items-center justify-self-end",
						mobileResponsive && "max-mobile:ms-auto",
					)}
				>
					{/* ⛔⛔ MKT-ROSTER-1-P3 — RULES OPENS THE IDENTITY SIDE, FOUNDER-RULED.
					    Signed out the zone reads `RULES · JOIN · | · visitors`; signed
					    in, `RULES · Đ cluster · avatar · | · visitors`. It is FIRST so
					    that the two arms differ only by what follows it.
					    ⛔ NO WRAPPER, EVER. `dharma-cluster.test.tsx`'s T4 guard walks
					    THIS div's direct `.children` to prove the §21.1 divider has the
					    engine-derived figures on one side and the visitor count on the
					    other; a wrapper around any of these makes the real node a
					    grandchild and every index in that guard resolves to `-1`.
					    ⚠ Its separation from what follows is a `mr-3.5` on the control
					    itself — this zone declares no `gap`, and adding one would move
					    Đ, the chip and the counter at 1440. */}
					<RulesControl mobileResponsive={mobileResponsive} />
					{/* ADR-0049 — the two hides below 640px live in the COMPONENTS, not
					    here, and the asymmetry with the divider two nodes down is
					    deliberate rather than untidy. `dharma-cluster.test.tsx`'s T4
					    guard walks THIS div's direct `.children`, so a wrapper around
					    either mount makes the real node a grandchild and every index in
					    that guard resolves to `-1`. The divider has no component of its
					    own to carry a token, so it takes one here; these two do, and
					    `VisitorCounter` below already ships that shape for this reason.
					    ⇒ Do not "tidy" either token up into this file. */}
					<DharmaCluster
						portfolio={portfolio}
						spendable={spendable}
						mobileResponsive={mobileResponsive}
					/>
					<IdentityCluster
						viewer={viewer}
						mobileResponsive={mobileResponsive}
					/>
					{/* §21.1 register divider — a NAMED UNTOUCHABLE (SG6): no
					    data-testid, ever. Located by its `w-px` class, exactly as
					    `tests/unit/shell/dharma-cluster.test.tsx`'s T4 guard already
					    does. */}
					<span
						aria-hidden="true"
						className={cn(
							"mx-3 h-[30px] w-px bg-n2",
							mobileResponsive && "max-mobile:hidden",
						)}
					/>
					<VisitorCounter mobileResponsive={mobileResponsive} />
				</div>
			</div>
		</header>
	);
}
