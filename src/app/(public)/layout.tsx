import { headers } from "next/headers";
import type { ReactNode } from "react";

import { GlobalHeader } from "@/components/shell/GlobalHeader";
import { auth } from "@/server/auth";

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

	return (
		<div className="flex min-h-full flex-col">
			<GlobalHeader viewer={viewer} />
			<main className="flex-1">{children}</main>
		</div>
	);
}
