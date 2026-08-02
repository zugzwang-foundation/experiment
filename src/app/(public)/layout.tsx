import { headers } from "next/headers";
import type { ReactNode } from "react";

import { GlobalHeader } from "@/components/shell/GlobalHeader";
import { SiteFooter } from "@/components/shell/SiteFooter";
import { db } from "@/db";
import { auth } from "@/server/auth";
import { getHeaderBalance } from "@/server/dharma/header-balance";

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
 * The Đ balance is fetched HERE and ONLY for a signed-in viewer — one indexed
 * read, skipped entirely for signed-out visitors. It is a SEPARATE prop from
 * `viewer`, not a widening of `HeaderViewer` (the Đ cluster is a sibling of the
 * identity chip, not a child). The `(auth)` layout deliberately does NOT fetch
 * it: those routes are signed-out by definition and a mid-signup `/onboarding`
 * user may have no `dharma_ledger` row.
 *
 * ACCEPTED, NOT DISCOVERED: on `/m/[slug]` the balance is read TWICE per
 * request — once here, once inside `loadViewerMarketContext` in the page.
 * `m/[slug]/page.tsx:53` already documents the cause (layouts cannot pass data
 * to pages). Both are single-row indexed lookups; not optimised here.
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
	const spendable = session?.user?.id
		? await getHeaderBalance(db, session.user.id)
		: null;

	return (
		<div className="flex min-h-full flex-1 flex-col">
			<GlobalHeader viewer={viewer} spendable={spendable} />
			<main className="flex-1">{children}</main>
			<SiteFooter />
		</div>
	);
}
