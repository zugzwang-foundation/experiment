import Link from "next/link";

import { AdminTabs } from "@/app/(admin)/admin/_components/AdminTabs";
import { formatCountdown } from "@/app/(admin)/admin/markets/_components/countdown";
import { NeedsResolutionCount } from "@/app/(admin)/admin/markets/_components/NeedsResolutionCount";
import { loadAdminMarketsOverview } from "@/server/admin/markets/overview";
import { requireAdminPage } from "@/server/admin/page-guards";
import { FREEZE_INSTANT_UTC } from "@/server/markets/create";

// UI.6 S1 — the Markets tab (extends ENGINE.15 S3's thin list). Server
// Component, `force-dynamic` (fresh-on-view), Layer-2 admin auth re-validated at
// entry. Adds the two-tab nav, the live needs-resolution count (the §6.1
// pre-freeze obligation surface), and the freeze countdown. The terminal
// actions (Close / Resolve / Void / Correct) live on `[marketId]/page.tsx`
// (S2) — this list links through to them.
export const dynamic = "force-dynamic";

export default async function AdminMarketsPage(props: {
	searchParams: Promise<{ ok?: string; error?: string }>;
}): Promise<React.ReactElement> {
	await requireAdminPage();

	const { ok, error } = await props.searchParams;
	const { rows, statusCounts, needsResolutionCount } =
		await loadAdminMarketsOverview();

	const freezeInstantMs = FREEZE_INSTANT_UTC.getTime();
	const initialCountdown = formatCountdown(freezeInstantMs - Date.now());

	return (
		<main className="min-h-dvh bg-background text-foreground">
			<div className="mx-auto max-w-5xl px-6 py-10">
				<AdminTabs active="markets" />

				<h1 className="mb-4 text-2xl font-semibold tracking-tight">Markets</h1>

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

				<NeedsResolutionCount
					needsResolutionCount={needsResolutionCount}
					freezeInstantMs={freezeInstantMs}
					initialCountdown={initialCountdown}
				/>

				<p className="mb-4 text-sm text-muted-foreground">
					{rows.length === 0
						? "no markets"
						: Object.entries(statusCounts)
								.map(([s, n]) => `${s}: ${n}`)
								.join(" · ")}
				</p>
				<p className="mb-4 text-sm">
					<Link
						href="/admin/markets/new"
						className="text-foreground underline underline-offset-2 hover:no-underline"
					>
						+ New market
					</Link>
				</p>

				<table className="w-full text-sm">
					<thead>
						<tr className="border-b border-border text-left text-muted-foreground">
							<th className="py-2 font-medium">slug</th>
							<th className="py-2 font-medium">title</th>
							<th className="py-2 font-medium">status</th>
							<th className="py-2 font-medium">deadline</th>
						</tr>
					</thead>
					<tbody>
						{rows.map((row) => (
							<tr key={row.id} className="border-b border-border">
								<td className="py-2">
									<Link
										href={`/admin/markets/${row.id}`}
										className="text-foreground underline underline-offset-2 hover:no-underline"
									>
										{row.slug}
									</Link>
								</td>
								<td className="py-2">{row.title}</td>
								<td className="py-2">{row.status}</td>
								<td className="py-2 font-mono text-xs text-muted-foreground">
									{row.resolutionDeadline.toISOString()}
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</main>
	);
}
