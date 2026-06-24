import { headers } from "next/headers";
import Link from "next/link";
import type { ReactNode } from "react";

import { auth } from "@/server/auth";

/**
 * Participant app shell (SHELL/UI.0) — the reusable server-component shell every
 * later `(public)/` surface renders inside. Public-read: this route group is NOT
 * middleware-gated (proxy.ts matches `/admin/*` only), so signed-out visitors
 * reach every surface here; reads are server-mediated (ADR-0019).
 *
 * THROWAWAY PLACEHOLDER HEADER. It carries a wordmark + a sign-in/pseudonym
 * affordance ONLY. The designed global header — market radio, conclusion timer,
 * visitor counter, back-nav, social dropdown — is DESIGN.W2.4/.5/.14, landing at
 * UI.13; it SUPERSEDES this. Do NOT grow header chrome here.
 */
export default async function PublicLayout({
	children,
}: {
	children: ReactNode;
}) {
	const session = await auth.api.getSession({ headers: await headers() });
	const pseudonym = session?.user?.pseudonym ?? null;

	return (
		<div className="flex min-h-full flex-col">
			{/* PLACEHOLDER — superseded by the designed global header at UI.13. */}
			<header className="flex items-center justify-between border-b px-6 py-3">
				<Link
					href="/"
					className="font-mono text-sm font-semibold tracking-tight"
				>
					ZUGZWANG
				</Link>
				{pseudonym ? (
					<span className="text-sm text-muted-foreground">{pseudonym}</span>
				) : (
					<Link
						href="/sign-in"
						className="text-sm underline underline-offset-4"
					>
						Sign in
					</Link>
				)}
			</header>
			<main className="flex-1">{children}</main>
		</div>
	);
}
