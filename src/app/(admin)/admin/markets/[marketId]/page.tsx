import { eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";

import { AdminTabs } from "@/app/(admin)/admin/_components/AdminTabs";
import { TerminalActions } from "@/app/(admin)/admin/markets/_components/TerminalActions";
import { db } from "@/db";
import { markets, pools } from "@/db/schema";
import { seedPoolAction } from "@/server/admin/markets/seed";
import { requireAdminPage, requireUuidParam } from "@/server/admin/page-guards";

// UI.6 S2 — market admin detail. The Close / Resolve / Void / Correct terminal
// actions are now surfaced through the <TerminalActions> client island: each
// gated action arms only on a typed market-question confirm (D-2), and every
// ActionResult error renders as human copy client-side — the plain-HTML forms
// and their raw `?error=<code>` redirect surface are REPLACED, with no ungated
// parallel path left (R-5). The Draft "Seed" affordance (F-ADMIN-2) is OUT OF
// SCOPE and untouched — it keeps its inline server-action + `?ok=`/`?error=`
// redirect surface (the only remaining producer of those params here).
export const dynamic = "force-dynamic";

export default async function MarketDetailPage(props: {
	params: Promise<{ marketId: string }>;
	searchParams: Promise<{ ok?: string; error?: string }>;
}): Promise<React.ReactElement> {
	await requireAdminPage();
	const marketId = requireUuidParam((await props.params).marketId);
	const { ok, error } = await props.searchParams;

	const [market] = await db
		.select()
		.from(markets)
		.where(eq(markets.id, marketId));
	if (!market) notFound();
	const [pool] = await db
		.select({ yesReserves: pools.yesReserves, noReserves: pools.noReserves })
		.from(pools)
		.where(eq(pools.marketId, marketId));

	// Seed (Draft → Open, F-ADMIN-2) is out of scope — its inline wrapper +
	// redirect surface are left exactly as ENGINE.15 S3 shipped them.
	async function runSeed(formData: FormData): Promise<void> {
		"use server";
		const r = await seedPoolAction(formData);
		redirect(
			`/admin/markets/${marketId}?${r.ok ? "ok=seeded" : `error=${r.error.code}`}`,
		);
	}

	return (
		<main className="min-h-dvh bg-background text-foreground">
			<div className="mx-auto max-w-3xl px-6 py-10">
				<AdminTabs active="markets" />

				<h1 className="mb-4 text-2xl font-semibold tracking-tight">
					{market.slug}
				</h1>

				{/* Seed-only result surface (F-ADMIN-2, out of scope). */}
				{ok ? (
					<p className="mb-4 rounded-md border border-border bg-muted px-3 py-2 text-sm">
						{ok}
					</p>
				) : null}
				{error ? (
					<p className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
						{error}
					</p>
				) : null}

				<dl className="mb-6 grid grid-cols-[8rem_1fr] gap-y-1 text-sm">
					<dt className="text-muted-foreground">status</dt>
					<dd>{market.status}</dd>
					<dt className="text-muted-foreground">title</dt>
					<dd>{market.title}</dd>
					<dt className="text-muted-foreground">description</dt>
					<dd>{market.description ?? "—"}</dd>
					<dt className="text-muted-foreground">resolution deadline</dt>
					<dd className="font-mono text-xs">
						{market.resolutionDeadline.toISOString()}
					</dd>
					<dt className="text-muted-foreground">outcome</dt>
					<dd>{market.resolutionOutcome ?? "—"}</dd>
					{pool ? (
						<>
							<dt className="text-muted-foreground">reserves</dt>
							<dd className="font-mono text-xs">
								YES {pool.yesReserves} / NO {pool.noReserves}
							</dd>
						</>
					) : null}
				</dl>

				{market.status === "Draft" ? (
					<form action={runSeed}>
						<h2>Seed pool (open market)</h2>
						<input type="hidden" name="marketId" value={marketId} />
						<label>
							Seed amount <input name="seedAmount" required />
						</label>
						<button type="submit">Seed &amp; open</button>
					</form>
				) : (
					<TerminalActions
						marketId={marketId}
						title={market.title}
						status={market.status}
					/>
				)}
			</div>
		</main>
	);
}
