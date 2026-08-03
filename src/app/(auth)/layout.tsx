import { headers } from "next/headers";
import type { ReactNode } from "react";

import { GlobalHeader } from "@/components/shell/GlobalHeader";
import { PageContainer } from "@/components/shell/PageContainer";
import { auth } from "@/server/auth";

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

	return (
		<div className="flex min-h-full flex-col">
			<GlobalHeader viewer={viewer} />
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
