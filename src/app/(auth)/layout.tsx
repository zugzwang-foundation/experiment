import { headers } from "next/headers";
import type { ReactNode } from "react";

import { GlobalHeader } from "@/components/shell/GlobalHeader";
import { auth } from "@/server/auth";

/**
 * (auth) route-group shell — the ratified-additive OQ-1 mount (UI.A1;
 * ADR-0023 §Patch record 2026-07-17, same commit as this file per CLAUDE.md
 * §5.12). ADDS the branded header around the existing auth pages; edits
 * none of them (A7 law — zero edits to existing auth files). Satisfies the
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
			<main className="flex-1">{children}</main>
		</div>
	);
}
