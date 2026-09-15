import { Plus } from "lucide-react";
import Link from "next/link";

import { AdminShell } from "@/app/(admin)/admin/_components/AdminShell";
import {
	formatUtcMinute,
	relativeSpan,
} from "@/app/(admin)/admin/_components/format";
import { MarketStatusBadge } from "@/app/(admin)/admin/_components/MarketStatusBadge";
import { Notice } from "@/app/(admin)/admin/_components/Notice";
import { PageHeader } from "@/app/(admin)/admin/_components/PageHeader";
import { formatCountdown } from "@/app/(admin)/admin/markets/_components/countdown";
import { NeedsResolutionCount } from "@/app/(admin)/admin/markets/_components/NeedsResolutionCount";
import { buttonVariants } from "@/components/ui/button";
import { EmptyBlock } from "@/components/ui/empty-block";
import { cn } from "@/lib/utils";
import { loadAdminMarketsOverview } from "@/server/admin/markets/overview";
import { requireAdminPage } from "@/server/admin/page-guards";
import { FREEZE_INSTANT_UTC } from "@/server/markets/create";

// UI.6 S1 — the Markets tab (extends ENGINE.15 S3's thin list). Server
// Component, fresh-on-view (dynamic by default, no `'use cache'`), Layer-2
// admin auth re-validated at entry. Adds the two-tab nav, the live
// needs-resolution count (the §6.1 pre-freeze obligation surface), and the
// freeze countdown. The terminal actions (Close / Resolve / Void / Correct)
// live on `[marketId]/page.tsx` (S2) — this list links through to them.
//
// ADMIN-UI — presentation only. The read is the same single
// `loadAdminMarketsOverview()`; the optional `?status=` param filters the rows
// that read already returned, IN THE PAGE, and is ignored unless it names a
// status that read actually counted. The attention column is derived from each
// row's own status + deadline and the render clock — no new data.
//
// S-4 Phase B — `instant = false`: `requireAdminPage` reads `cookies()` and
// this page reads `searchParams`, both unwrapped; either errors the
// `cacheComponents` prerender build otherwise. Deferred, not restructured —
// admin is outside S-4's scope (CLAUDE.md §1).
export const instant = false;

/** Lifecycle order for the filter chips; unknown statuses follow, as read. */
const STATUS_ORDER = [
	"Draft",
	"Open",
	"Closed",
	"Resolving",
	"Resolved",
	"Voided",
	"Frozen",
];

function attentionFor(
	status: string,
	deadlineMs: number,
	nowMs: number,
): string | null {
	if (status === "Closed") return "Needs Resolve / Void";
	if (status === "Resolving") return "Settlement incomplete";
	if (status === "Open" && deadlineMs <= nowMs) return "Past deadline";
	if (status === "Draft") return "Not open — seed to open";
	return null;
}

const chip =
	"inline-flex h-7 items-center gap-1.5 rounded-(--r-chip) border px-2.5 text-xs outline-none focus-visible:shadow-(--state-focus-ring)";

export default async function AdminMarketsPage(props: {
	searchParams: Promise<{ ok?: string; error?: string; status?: string }>;
}): Promise<React.ReactElement> {
	await requireAdminPage();

	const { ok, error, status } = await props.searchParams;
	const { rows, statusCounts, needsResolutionCount } =
		await loadAdminMarketsOverview();

	const nowMs = Date.now();
	const freezeInstantMs = FREEZE_INSTANT_UTC.getTime();
	const initialCountdown = formatCountdown(freezeInstantMs - nowMs);

	const statuses = [
		...STATUS_ORDER.filter((s) => statusCounts[s] !== undefined),
		...Object.keys(statusCounts).filter((s) => !STATUS_ORDER.includes(s)),
	];
	const activeStatus =
		status !== undefined && statusCounts[status] !== undefined ? status : null;
	const visibleRows = activeStatus
		? rows.filter((row) => row.status === activeStatus)
		: rows;

	return (
		<AdminShell active="markets">
			<PageHeader
				title="Markets"
				description="Every market, newest first. Open a row to seed, close, resolve, void or correct it. All times are UTC."
				actions={
					<Link
						href="/admin/markets/new"
						className={cn(buttonVariants({ size: "lg" }), "px-3")}
					>
						<Plus aria-hidden />
						New market
					</Link>
				}
			/>

			{ok ? (
				<Notice tone="success" className="mb-4">
					{ok}
				</Notice>
			) : null}
			{error ? (
				<Notice tone="error" className="mb-4">
					{error}
				</Notice>
			) : null}

			<NeedsResolutionCount
				needsResolutionCount={needsResolutionCount}
				freezeInstantMs={freezeInstantMs}
				initialCountdown={initialCountdown}
			/>

			{rows.length === 0 ? (
				<EmptyBlock
					message="No markets yet."
					messageTestId="admin-markets-empty"
					sub="A new market starts as a Draft; seeding its pool opens it."
				/>
			) : (
				<>
					<nav
						aria-label="Filter markets by status"
						className="mb-3 flex flex-wrap items-center gap-2"
					>
						<Link
							href="/admin/markets"
							aria-current={activeStatus === null ? "true" : undefined}
							className={cn(
								chip,
								activeStatus === null
									? "border-n6 bg-n1 font-semibold text-ink"
									: "border-n2 text-n5 hover:border-n3 hover:text-ink",
							)}
						>
							All
							<span className="tabular-nums">{rows.length}</span>
						</Link>
						{statuses.map((s) => (
							<Link
								key={s}
								href={`/admin/markets?status=${encodeURIComponent(s)}`}
								aria-current={activeStatus === s ? "true" : undefined}
								className={cn(
									chip,
									activeStatus === s
										? "border-n6 bg-n1 font-semibold text-ink"
										: "border-n2 text-n5 hover:border-n3 hover:text-ink",
								)}
							>
								{s}
								<span className="tabular-nums">{statusCounts[s]}</span>
							</Link>
						))}
					</nav>

					<div className="overflow-x-auto rounded-(--r) border border-n2 bg-n0 shadow-(--elev-1)">
						<table className="w-full min-w-[720px] text-sm">
							<caption className="sr-only">
								{activeStatus ? `${activeStatus} markets` : "All markets"}
							</caption>
							<thead>
								<tr className="border-n2 border-b text-left text-n5 text-xs uppercase tracking-wide">
									<th scope="col" className="w-32 px-4 py-2.5 font-medium">
										Status
									</th>
									<th scope="col" className="px-4 py-2.5 font-medium">
										Market
									</th>
									<th scope="col" className="w-56 px-4 py-2.5 font-medium">
										Resolution deadline
									</th>
									<th scope="col" className="w-48 px-4 py-2.5 font-medium">
										Attention
									</th>
								</tr>
							</thead>
							<tbody>
								{visibleRows.map((row) => {
									const deadlineMs = row.resolutionDeadline.getTime();
									const attention = attentionFor(row.status, deadlineMs, nowMs);
									return (
										<tr
											key={row.id}
											className="border-n2 border-b align-top last:border-b-0 hover:bg-(--state-hover-fill)"
										>
											<td className="px-4 py-3">
												<MarketStatusBadge status={row.status} />
											</td>
											<td className="px-4 py-3">
												<Link
													href={`/admin/markets/${row.id}`}
													className="rounded-(--r-chip) font-medium text-ink underline-offset-2 outline-none hover:underline focus-visible:shadow-(--state-focus-ring)"
												>
													{row.title}
												</Link>
												<span className="mt-0.5 block font-mono text-n5 text-xs">
													{row.slug}
												</span>
											</td>
											<td className="px-4 py-3">
												<time
													dateTime={row.resolutionDeadline.toISOString()}
													className="block font-mono text-n6 text-xs"
												>
													{formatUtcMinute(row.resolutionDeadline)}
												</time>
												<span className="mt-0.5 block text-n5 text-xs">
													{relativeSpan(deadlineMs, nowMs)}
												</span>
											</td>
											<td className="px-4 py-3 text-xs">
												{attention ? (
													<span
														className={cn(
															row.status === "Draft"
																? "text-n5"
																: "font-semibold text-ink",
														)}
													>
														{attention}
													</span>
												) : (
													<span className="text-n4">—</span>
												)}
											</td>
										</tr>
									);
								})}
							</tbody>
						</table>
					</div>
				</>
			)}
		</AdminShell>
	);
}
