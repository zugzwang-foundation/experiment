import { desc } from "drizzle-orm";
import Link from "next/link";

import { db } from "@/db";
import { markets } from "@/db/schema";

// ENGINE.15 S3 — R-15.1 admin markets list. Server Component, ZERO client JS
// (D-15.e), direct read-only Drizzle read. Unstyled — DESIGN/UI lanes own
// visuals; the SPEC.1 §15.2 hub dashboard is out of scope.
export const dynamic = "force-dynamic";

export default async function AdminMarketsPage(props: {
	searchParams: Promise<{ ok?: string; error?: string }>;
}): Promise<React.ReactElement> {
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
		<main>
			<h1>Markets</h1>
			{ok ? <p>OK: {ok}</p> : null}
			{error ? <p>Error: {error}</p> : null}
			<p>
				{rows.length === 0
					? "no markets"
					: [...counts.entries()].map(([s, n]) => `${s}: ${n}`).join(" · ")}
			</p>
			<p>
				<Link href="/admin/markets/new">+ New market</Link>
			</p>
			<table>
				<thead>
					<tr>
						<th>slug</th>
						<th>title</th>
						<th>status</th>
						<th>deadline</th>
					</tr>
				</thead>
				<tbody>
					{rows.map((row) => (
						<tr key={row.id}>
							<td>
								<Link href={`/admin/markets/${row.id}`}>{row.slug}</Link>
							</td>
							<td>{row.title}</td>
							<td>{row.status}</td>
							<td>{row.resolutionDeadline.toISOString()}</td>
						</tr>
					))}
				</tbody>
			</table>
		</main>
	);
}
