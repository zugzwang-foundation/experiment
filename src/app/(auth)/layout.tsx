import { headers } from "next/headers";
import type { ReactNode } from "react";

import { FIELD_ASSET_HREF, WarliHero } from "@/components/art/warli";
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
 * S-4 Phase B — `instant = false`: this layout's `cookies()`/`headers()`
 * session read is unwrapped, same shape as `(public)/layout.tsx`. Under
 * `cacheComponents` (S-4 Phase B, `next.config.ts`) that errors the
 * prerender build for all three routes this layout wraps (`/sign-in`,
 * `/sign-in/otp`, `/onboarding`). Deferred, not restructured — these routes
 * are outside S-4's scope (CLAUDE.md §1); this is the minimum change that
 * keeps the build green.
 */
export const instant = false;

export default async function AuthLayout({
	children,
}: {
	children: ReactNode;
}) {
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
	// Awaited in the layout, not in the control, for the same structural reason
	// `(public)` does it: `GlobalHeader` must stay sync all the way down or it
	// stops rendering in jsdom entirely. See that file, and `GlobalHeader`'s own
	// `stars` note.
	const stars = await readStarCount();

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
			{/* WARLI-FIELD-ASSET — the artwork's static field is a CSS background
			    on the hero, and a CSS background is discovered only once the
			    stylesheet and the hero have been parsed. React 19 hoists this
			    `<link>` into `<head>`, so the file starts downloading beside the
			    document and the field paints with the rings rather than a beat
			    behind them; on a repeat visit it is served from the immutable
			    cache and the hint costs nothing.

			    ⚠ A `<link>` ELEMENT, NOT `preload()` FROM `react-dom`. The
			    function form was tried first, called from this server layout, and
			    emitted NOTHING — no `<link>` in the HTML, no `HL` hint in the
			    flight data (measured on a local `next start`). It could not move
			    into `hero.tsx` either: the art layer is sealed to `react` alone. */}
			<link
				rel="preload"
				as="image"
				href={FIELD_ASSET_HREF}
				fetchPriority="high"
			/>
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
			<GlobalHeader viewer={viewer} stars={stars} mobileResponsive />
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
