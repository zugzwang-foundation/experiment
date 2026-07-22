import "server-only";

import { desc } from "drizzle-orm";

import { db } from "@/db";
import { markets } from "@/db/schema";

// UI.6 S1 — the Markets-tab overview read (§2.S1). A read-only Drizzle read of
// every market (newest-first) plus the derived status tallies. The
// needs-resolution count is the §6.1 pre-freeze obligation surface: the number
// of `Closed` markets still awaiting a terminal Resolve/Void (a Closed market
// is settled-eligible but not yet settled). ZERO writes.

export interface AdminMarketRow {
	id: string;
	slug: string;
	title: string;
	status: string;
	resolutionDeadline: Date;
}

export interface AdminMarketsOverview {
	rows: AdminMarketRow[];
	statusCounts: Record<string, number>;
	/** Count of `Closed` markets — the pre-freeze settlement obligation (§6.1). */
	needsResolutionCount: number;
}

export async function loadAdminMarketsOverview(): Promise<AdminMarketsOverview> {
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

	const statusCounts: Record<string, number> = {};
	for (const row of rows) {
		statusCounts[row.status] = (statusCounts[row.status] ?? 0) + 1;
	}

	return {
		rows,
		statusCounts,
		needsResolutionCount: statusCounts.Closed ?? 0,
	};
}
