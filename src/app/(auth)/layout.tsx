import { headers } from "next/headers";
import type { ReactNode } from "react";

import { GlobalHeader } from "@/components/shell/GlobalHeader";
import { auth } from "@/server/auth";

/**
 * (auth) route-group shell — the ratified-additive OQ-1 mount (UI.A1;
 * ADR-0023 §Patch record 2026-07-17, same commit as this file per CLAUDE.md
 * §5.12). ADDS the branded header around the existing auth pages. A7 (this
 * slot) skins those pages (presentation-only) and adds the horizontal-center
 * + max-width + vertical-padding seam on `<main>` below; auth logic / flows /
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
			    onboarding card is never pushed above the fold (plan §2 V0). */}
			<main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 py-8">
				{children}
			</main>
		</div>
	);
}
