import { headers } from "next/headers";
import { type ReactNode, Suspense } from "react";

import { WarliHero } from "@/components/art/warli";
import { GlobalHeader } from "@/components/shell/GlobalHeader";
import { PageContainer } from "@/components/shell/PageContainer";
import { auth } from "@/server/auth";
import { readStarCount } from "@/server/github/star-count";
import { pfpUrl } from "@/server/identity-pool/pfp-url";

/**
 * (auth) route-group shell — the ratified-additive OQ-1 mount (UI.A1;
 * ADR-0023 §Patch record 2026-07-17, same commit as this file per CLAUDE.md
 * §5.12). ADDS the branded header around the existing auth pages. A7 (this
 * slot) skins those pages (presentation-only) and added the horizontal-center
 * + max-width + vertical-padding seam below — which POLISH-1b B2 moved off
 * `<main>` and onto `PageContainer`, so `<main>` is now landmark + flex child
 * only (see the node comment); auth logic / flows /
 * the onboarding gate stay untouched — the TRUE A7 invariant is ZERO
 * AUTH-LOGIC EDITS, not zero file edits (supersedes the UI.A1 "zero edits to
 * existing auth files" phrasing per UI-A7 plan ruling 3). Satisfies the
 * fork gate's "branded header live on the auth routes" (UI-LANE §3). Same
 * `auth.api.getSession({ headers })` read the `(public)` shell performs —
 * an import + call, not an auth-code change. `/onboarding` renders
 * signed-out (the session-create gate defers pre-onboarding sessions) —
 * accepted, plan §4.1/§6.
 *
 * AUTH-PRERENDER (ADR-0052) — S-4 PHASE D, DISCHARGED FOR THIS ROUTE GROUP.
 * This paragraph used to read "S-4 Phase B — `instant = false`: … Deferred,
 * not restructured", and `export const instant = false` sat directly beneath
 * it. Both are gone, and what replaced them is the whole point of this file's
 * present shape.
 *
 * ⚠ THE DEFERRAL WAS NOT FREE, AND ITS COST LANDED SOMEWHERE NOBODY WAS
 * LOOKING. `instant = false` opted this segment out of the framework's
 * prerender validation, which kept the build green while leaving the segment
 * with an EMPTY SHELL — every byte of it re-rendered per request. That
 * included the WARLI underlay mounted below, which is 15,956 markup tags and
 * ~791 KB of markup: measured at ~30 ms of SYNCHRONOUS serialization per
 * request, 72% of it the static field layer alone. Every other page in this
 * product pays an AWAITED database cost, which yields Node's event loop. This
 * one paid CPU, which does not — so `/sign-in` was the first surface to fall
 * over under concurrent load while every other route held.
 *
 * ⛔ TWO EARLIER FIXES AIMED AT THE WRONG HALF and are worth naming so they
 * are not tried a third time. Hoisting the scene arithmetic to module scope
 * saved 1.367 ms; hoisting the entire element TREE to module scope took the
 * hero from 31.19 ms to 30.09 ms. Both are real and both are ~3%, because
 * element CONSTRUCTION was never the cost — markup SERIALIZATION is, and no
 * amount of caching upstream of the renderer touches it. The server writes
 * every tag on every request for as long as the request is what triggers the
 * render. The only fix is to stop rendering per request.
 *
 * ⇒ THE TWO AWAITS MOVED, THE TREE DID NOT. `AuthHeader` below holds the
 * session read and the star read; this component is now SYNC, so everything
 * outside that one Suspense boundary is prerenderable and the artwork is
 * serialized ONCE at build. `/sign-in` and `/sign-in/otp` are `"use client"`
 * pages with no server reads at all, so they prerender whole.
 * `/onboarding` reads `cookies()` in its own page body and redirects four
 * times, so `instant = false` moved DOWN to that page — the opt-out now
 * scopes to the one route that still needs it instead of all three.
 */

export default function AuthLayout({ children }: { children: ReactNode }) {
	return (
		/* POLISH.7a D19 — `min-h-full` → `min-h-dvh`. ONE token, ONE node, and the
		   only line this surface changes outside its three page files.

		   THE DEFECT. `min-height:100%` resolves against the containing block's
		   SPECIFIED height, and `<body>`'s is `auto` (it sets `min-height`, not
		   `height`). So this percentage resolved to nothing, the wrapper collapsed
		   to content height, `<main flex-1>` had no free space to claim, and
		   `my-auto` on the sign-in and otp Cards computed to ZERO — measured at
		   1440×900: this wrapper 314.43px inside a 900px viewport, Card top 93.24px
		   instead of centred. `docs/logs/POLISH-1b.md:92` measured the same collapse
		   independently and assigned the row here.

		   WHY A VIEWPORT UNIT AND NOT A DEFINITE PARENT HEIGHT. The first attempt
		   gave `<body>` a definite height instead (`min-h-full` → `h-full` in
		   `src/app/layout.tsx`, shipped at `5a11b38`, REVERTED at `1a41b0f`). That
		   works below the fold and is a REGRESSION above it: a definite parent makes
		   this wrapper a flex item whose explicit `min-height:100%` suppresses the
		   flex automatic minimum size, so flex-shrink CLAMPS it to one viewport while
		   its content overflows — and `position:sticky` is bounded by its containing
		   block, so `GlobalHeader` scrolls away. Measured on a 2000px page: header top
		   0 / 0 / −62 / −562 / −578 at scrollY 0 / 400 / 900 / 1400 / 2000.
		   `100dvh` never depended on the percentage chain, so nothing can clamp it,
		   and `<body>` is left exactly as `origin/main` has it.

		   ⚠ `flex flex-col` IS UNTOUCHED and no `flex-1` anywhere is removed.
		   Flatten either node to a block context and `margin-block:auto` computes to
		   zero forever (POLISH-1b.md:94), and the repair needs two fixes instead of
		   one. `tests/unit/shell/page-container.test.ts` pins the chain by name.

		   ⚠ `dvh` tracks mobile browser chrome. POLISH is desktop-1440-only by G1,
		   so that is recorded in the log and is not a finding on this surface. */
		<div className="flex min-h-dvh flex-col">
			{/* WARLI-MOUNT — the art layer's first and only mount, recipe #433.
			    Two counter-rotating rings around a still centre that the auth card
			    sits in; `R_INNER = 330` is derived from this container's own
			    `max-w-md` card half-diagonal, which is why the artwork belongs
			    HERE and reads as a frame rather than as a backdrop.

			    ⚠ `fixed`, NOT `absolute`, and the difference is load-bearing.
			    Recipe #438 offered `absolute inset-0`; there is no positioned
			    ancestor anywhere above this node — the wrapper below is
			    `flex min-h-dvh flex-col` and `<body>` is `min-h-full flex
			    flex-col` — so `absolute` would resolve against the initial
			    containing block by accident rather than by intent, and would
			    scroll away on the tall onboarding page. `fixed` says the thing
			    that is meant: the artwork is the window, not the document.

			    ⚠ `-z-10` IS VISIBLE HERE, and it is worth saying why, because a
			    negative z-index behind a painted background is a classic way to
			    ship an invisible layer. `globals.css`'s `body` selector applies
			    `bg-background`, and its `html` selector sets only `font-sans`;
			    CSS propagates a body background to the CANVAS when the root has
			    none, and leaves body's own used background transparent — so the
			    canvas is painted before this node rather than over it.

			    ⛔ THREE EDITS MAKE THIS LAYER SILENTLY VANISH, AND THE ONE THIS
			    COMMENT USED TO NAME IS THE LEAST LIKELY OF THEM. No test in this
			    repo can see any of them: jsdom performs no layout.
			      1. A background on `<html>` — propagation stops, body paints its
			         own in step 3, over this node in step 2. (The original note.)
			      2. A background on `<body>` OR on the `flex min-h-dvh flex-col`
			         wrapper below. Far likelier than (1) — a wrapper picking up
			         `bg-ground` looks entirely reasonable — and it kills the layer
			         the same way.
			      3. A `transform`, `filter`, `backdrop-filter`, `perspective`,
			         `contain` or `will-change` on `<body>` or that wrapper. Any of
			         those re-anchors `position: fixed` to that element, so the
			         layer would size to the wrapper and SCROLL AWAY on the tall
			         onboarding page — destroying the exact property `fixed` was
			         chosen for two paragraphs up.

			    ⚠ `pointer-events-none` COSTS THE POINTER INTERACTION, deliberately.
			    `hero.tsx` carries a pointerenter/move/leave gesture that aligns the
			    rings toward the cursor; behind a full-viewport layer it cannot fire,
			    and the alternative — letting it fire — is a full-bleed overlay that
			    swallows every click landing outside the auth card. The gesture is
			    ruled out of scope at this mount (WARLI-MOUNT ruling S(a)); it is
			    kept as built rather than deleted, because the decision is about
			    where the artwork is mounted and not about what it does.

			    ⚠ `aria-hidden` IS THE ONE ADDITION TO RECIPE #433, and it is a
			    deviation stated rather than absorbed (surfaced in the PR body).
			    `hero.tsx` renders `role="img"` with a 90-character `aria-label`
			    and a `<title>` — correct for a component with no context, and
			    wrong the moment it becomes a decorative backdrop mounted as the
			    FIRST child of the layout root. Without this attribute a screen
			    reader meeting `/sign-in` announces "Two rings of figures turning
			    in opposite directions…" before it reaches anything actionable, on
			    the first screen of the product. Hiding the wrapper is the smallest
			    fix that stays inside the node this task owns: it touches neither
			    `hero.tsx` nor the `<WarliHero>` call, and the art layer's own
			    tests mount `<WarliHero />` bare, so none of them observes it. */}
			<div
				aria-hidden="true"
				className="pointer-events-none fixed inset-0 -z-10 grid place-items-center"
			>
				<WarliHero className="h-full w-full" />
			</div>
			{/* MOBILE-1 · Job A item 1 — ADR-0048. This one prop is the whole of the
			    fix for all three auth routes: it threads `GlobalHeader` →
			    `BrandCluster` / `VisitorCounter`, and `GlobalHeader` →
			    `RulesControl` → the onboarding deck. Every class it switches on is
			    `max-mobile:`-prefixed, so ≥640px is untouched.

			    ⚠ THAT DECK IS NAMED IN PROSE HERE, NOT BY ITS IDENTIFIER, AND THAT
			    IS DELIBERATE. `global-header-mobile-reflow.test.ts`'s D-4 guard
			    asserts this file contains no such string ANYWHERE — a plain
			    substring scan, comments included — because a direct mount here
			    could be passed `onComplete` and let a signed-out visitor write the
			    completion marker, suppressing their own first-login deck later.
			    Writing the identifier in a comment reddens it. The guard is right
			    and it is left exactly as it is.

			    ⚠ IT REVERSES A RULING RATHER THAN FILLING A GAP. ADR-0045 held
			    auth/join surfaces "gated, not made responsive", and Phase A's
			    `mobileResponsive = false` default exists precisely so this mount
			    could not reflow by accident. ADR-0048 supersedes that carve-out —
			    a phone participant is allowed to join — so the omission here
			    became the defect. The prop and its default SURVIVE: `(auth)`
			    opts in, it is not that the gate was deleted (ADR-0048 `:84`
			    rejects deleting the prop for now). */}
			{/* AUTH-PRERENDER (ADR-0052) — THE BOUNDARY, AND WHY ITS FALLBACK IS A
			    BARE BAND RATHER THAN A RENDERED HEADER.

			    This is the one dynamic hole in an otherwise static shell. Everything
			    outside it — the artwork above, `<main>` and its container below —
			    prerenders at build; only `AuthHeader` waits on a request.

			    ⛔ THE FIRST VERSION OF THIS FALLBACK WAS `<GlobalHeader viewer={null}
			    stars={null} mobileResponsive />`, AND THE BUILD REJECTED IT — CORRECTLY.
			    The reasoning was that all three routes here render signed out anyway
			    (`/sign-in` and `/sign-in/otp` by definition, `/onboarding` by the
			    ruling at the head of this file), so a null-viewer header IS the common
			    case and the streamed swap would be invisible. That much was true. What
			    it missed is that `GlobalHeader` seeds the freeze countdown from
			    `Date.now()` (`GlobalHeader.tsx:245`), and a clock read cannot be
			    prerendered: the value would be frozen at BUILD time and served to
			    every visitor until the dynamic header replaced it. A shell built in
			    September would open November by announcing the wrong number of days
			    left in the experiment — briefly, on the surface whose entire job is to
			    say how long is left. Next's `unstable value Date.now()` error is that
			    defect caught at the only place it is cheap to catch.

			    ⇒ SO THE CLOCK STAYS ON THE DYNAMIC SIDE, and the fallback reserves
			    the header's BOX without claiming to be the header. It carries the
			    same chrome — opaque `bg-n0` fill, the two hairlines, tier-1
			    elevation, the 60px band — so what streams in is the CONTROLS
			    appearing inside a bar that was already drawn correctly, not a bar
			    appearing. Nothing reflows: the box is identical, so there is no
			    layout shift, only a fill.

			    ⚠ `aria-hidden` AND A `<div>`, NOT A `<header>`. Two `<header>`
			    landmarks would exist simultaneously during the swap, and a screen
			    reader meeting an empty one first would announce a banner with nothing
			    in it. The placeholder is decoration; the landmark arrives with the
			    content that justifies it.

			    ⚠ `sticky`, NEVER `fixed`. `stacking-contract.test.ts` asserts this
			    file holds EXACTLY ONE `fixed` class string — the artwork underlay
			    above — and a second would redden it. Sticky is also what the real
			    header uses, so the placeholder occupies flow exactly as its
			    replacement does. */}
			<Suspense
				fallback={
					<div
						aria-hidden="true"
						className="sticky top-0 z-40 border-y bg-n0 shadow-(--elev-1)"
					>
						<div className="h-[60px]" />
					</div>
				}
			>
				<AuthHeader />
			</Suspense>
			{/* A7 seam — horizontal-center + max-width + vertical padding on the
			    branded ground. Vertical placement is per-surface: short surfaces
			    (sign-in, otp) add `my-auto` to center; onboarding omits it and
			    top-aligns + scrolls. No `justify-center` here, so the tall
			    onboarding card is never pushed above the fold (plan §2 V0).

			    POLISH-1b B2 — the LANDMARK and the BOX are now separate nodes:
			    `<main>` keeps the landmark and its place in the min-h chain,
			    `PageContainer` owns the three container axes. This is the only
			    site permitted a wrapper, and it matches the shape `(public)`
			    already has (layout owns `<main>`, the box is a child).

			    `flex flex-col` and `flex-1` appear on BOTH nodes deliberately —
			    do not "simplify" either away. The Cards on sign-in and otp use
			    `my-auto` to centre, which only resolves inside a flex parent
			    that has free vertical space: `<main>` claims the height from the
			    outer column, and the container claims it from `<main>` and makes
			    the Card a flex item. Drop either and both Cards silently
			    top-align. */}
			<main className="flex flex-1 flex-col">
				<PageContainer preset="auth" className="flex flex-1 flex-col">
					{children}
				</PageContainer>
			</main>
		</div>
	);
}

/**
 * The layout's entire dynamic surface — both request reads, and the header
 * they feed.
 *
 * ⚠ THIS LIVES IN THE LAYOUT FILE DELIBERATELY, NOT UNDER `_components/`, AND
 * THE REASON IS A SECURITY GUARD RATHER THAN TASTE. Eight guards pin this
 * surface by LITERAL FILE PATH, several by set equality; the one that matters
 * is `global-header-mobile-reflow.test.ts`'s D-4, which scans THIS FILE ALONE
 * for a direct mount of the onboarding deck — a mount here could be handed an
 * `onComplete` and let a signed-out visitor write their own completion marker,
 * suppressing their real first-login deck later. Lifting the header mount into
 * a new component file would move it OUTSIDE that guard's reach: the check
 * would still pass, on a file that no longer contains the thing it is looking
 * for. Coverage narrowing with nothing red is the failure this arrangement
 * refuses. Keeping the mount here costs one indirection and keeps all eight
 * guards exercising real code.
 *
 * ⚠ AND IT IS A SEPARATE COMPONENT RATHER THAN AN INLINE ASYNC IIFE because
 * `<Suspense>` suspends on a CHILD, not on an expression. The boundary needs
 * something to render.
 */
async function AuthHeader() {
	const session = await auth.api.getSession({ headers: await headers() });
	const viewer = session
		? {
				pseudonym: session.user?.pseudonym ?? null,
				pfpUrl: pfpUrl(session.user?.pfpFilename ?? null),
			}
		: null;

	// GH-STAR — read here even though this layout deliberately skips the two Đ
	// reads, and the asymmetry is the point rather than an oversight. Those two
	// are viewer-scoped and these routes are signed-out by definition; the star
	// count is not scoped to anyone. Omitting it would leave the control rendering
	// its no-count arm on `/sign-in`, `/sign-in/otp` and `/onboarding` — which
	// reads, to anyone looking at the header, exactly like a failed GitHub read.
	// That is the one confusion this whole control is built to prevent, so it
	// would be a strange thing to reintroduce for the sake of one saved call that
	// the Data Cache is serving anyway (`next: { revalidate: 900 }` — four
	// upstream requests an hour for the entire deployment).
	//
	// Awaited HERE, not in the control, for the same structural reason
	// `(public)` does it: `GlobalHeader` must stay sync all the way down or it
	// stops rendering in jsdom entirely. See that file, and `GlobalHeader`'s own
	// `stars` note. ⚠ AUTH-PRERENDER moved the await one component down rather
	// than one component up — the header is still sync, and that is not an
	// accident of this refactor but a constraint on it.
	//
	// ⚠ IT ALSO CANNOT REJECT, which is what lets this boundary carry no error
	// handling: `readStarCount` resolves `null` on non-2xx, timeout, network and
	// malformed body by design, precisely so a failed GitHub read can never take
	// the header down (see its docblock). A throw here would blank the header on
	// a surface whose whole job is to be reassuring.
	const stars = await readStarCount();

	// MOBILE-1 · Job A — ADR-0048. The prop is the whole of the phone reflow for
	// all three auth routes; see the note on the Suspense boundary above. This is
	// the ONLY `<GlobalHeader>` mount in this file — the fallback is a bare band.
	return <GlobalHeader viewer={viewer} stars={stars} mobileResponsive />;
}
