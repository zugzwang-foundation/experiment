import { headers } from "next/headers";
import type { ReactNode } from "react";

import { GlobalHeader } from "@/components/shell/GlobalHeader";
import { PageContainer } from "@/components/shell/PageContainer";
import { auth } from "@/server/auth";
import { readStarCount } from "@/server/github/star-count";

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
 */
export default async function AuthLayout({
	children,
}: {
	children: ReactNode;
}) {
	const session = await auth.api.getSession({ headers: await headers() });
	const viewer = session
		? { pseudonym: session.user?.pseudonym ?? null }
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
			<GlobalHeader viewer={viewer} stars={stars} />
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
