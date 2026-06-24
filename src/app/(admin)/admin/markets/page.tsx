import { desc } from "drizzle-orm";
import Link from "next/link";
import { Banner, buttonClass, Shell } from "@/components/internal-ui";
import { db } from "@/db";
import { markets } from "@/db/schema";
import { requireAdminPage } from "@/server/admin/page-guards";

// ENGINE.15 S3 — R-15.1 admin markets list. Server Component, ZERO client JS
// (D-15.e), direct read-only Drizzle read. UI.6 admin-fixes: legibility pass
// (STYLE-ONLY — the read + counts are unchanged).
export const dynamic = "force-dynamic";

export default async function AdminMarketsPage(props: {
	searchParams: Promise<{ ok?: string; error?: string }>;
}): Promise<React.ReactElement> {
	await requireAdminPage();

	const { ok, error } = await props.searchParams;

	const rows = await db
		.select({
			id: markets.id,
			slug: markets.slug,
			title: markets.title,
			status: markets.status,
			resolutionDeadline: markets.resolutionDeadline,
		})
		.from(markets)
		.orderBy(desc(markets.createdAt));

	const counts = new Map<string, number>();
	for (const row of rows) {
		counts.set(row.status, (counts.get(row.status) ?? 0) + 1);
	}

	return (
		<Shell title="Markets" maxWidth="max-w-5xl">
			{ok ? <Banner tone="ok">OK: {ok}</Banner> : null}
			{error ? <Banner tone="error">Error: {error}</Banner> : null}

			<div className="mb-5 flex items-center justify-between gap-4">
				<p className="text-sm text-muted-foreground">
					{rows.length === 0
						? "No markets yet."
						: [...counts.entries()].map(([s, n]) => `${s}: ${n}`).join(" · ")}
				</p>
				<Link href="/admin/markets/new" className={buttonClass}>
					+ New market
				</Link>
			</div>

			{rows.length === 0 ? (
				<div className="rounded-lg border border-dashed border-border bg-card px-6 py-16 text-center text-sm text-muted-foreground">
					No markets yet. Create the first one.
				</div>
			) : (
				<div className="overflow-hidden rounded-lg border border-border">
					<table className="w-full border-collapse text-sm">
						<thead>
							<tr className="border-b border-border bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
								<th className="px-4 py-2.5 font-medium">Slug</th>
								<th className="px-4 py-2.5 font-medium">Title</th>
								<th className="px-4 py-2.5 font-medium">Status</th>
								<th className="px-4 py-2.5 font-medium">Deadline</th>
							</tr>
						</thead>
						<tbody>
							{rows.map((row) => (
								<tr
									key={row.id}
									className="border-b border-border last:border-0 hover:bg-muted/30"
								>
									<td className="px-4 py-2.5">
										<Link
											href={`/admin/markets/${row.id}`}
											className="font-medium text-foreground underline underline-offset-2 hover:no-underline"
										>
											{row.slug}
										</Link>
									</td>
									<td className="px-4 py-2.5 text-muted-foreground">
										{row.title}
									</td>
									<td className="px-4 py-2.5">
										<span className="inline-flex items-center rounded-full border border-border bg-muted px-2 py-0.5 text-xs font-medium">
											{row.status}
										</span>
									</td>
									<td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
										{row.resolutionDeadline.toISOString()}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}
		</Shell>
	);
}
