"use client";

import Link from "next/link";
import { Fragment, useMemo, useState } from "react";

import { SellModule } from "@/components/debate/composer/SellModule";
import { formatDharma } from "@/components/debate/format";
import { REMOVED_STUB_TEXT } from "@/components/debate/placeholders";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type {
	ProfilePositionsPayload,
	SellablePositionRow,
} from "@/server/profile/owner-view";
import type {
	ProfileArgumentCell,
	ProfilePositionRow,
} from "@/server/profile/positions";

import { PROFILE_COPY } from "./copy";

/**
 * The cross-market positions arena (canon §2 / SPEC.1 §23) — columns
 * `Position · Argument · Staked · Current`, with a market filter and an
 * Open/Closed filter (client state over the server DTO). The Argument cell is
 * the episode-opening argument (N-1a); a `content_removed` opener renders the
 * stub with no title (compile-level no-leak — the removed cell variant carries
 * no title field). The status cell shows `statusLabel` (Open/Closed by market
 * state).
 *
 * The owner-only Sell mount (F-PROF-3): a `sellEligible` row (owner arm, market
 * Open ∧ held) carries a Sell trigger that slides the shipped `SellModule` into
 * a row expansion (canon §5 — JS-toggled, `:has()` banned; sell is never
 * clamped, SG-2). The VISITOR payload arm carries no `sellEligible` field, so no
 * trigger can render. Empty → the OQ-7 copy (owner/visitor). Đ values are
 * `formatDharma`-trimmed, never float math.
 */
export function PositionsTable({
	payload,
	initialMarketSlug,
}: {
	payload: ProfilePositionsPayload;
	/** OQ-5 B — the W2.10-C `?market=<slug>` preselect; matched against the
	 * rows' `marketSlug` (unknown → "all"; the raw param is never rendered). */
	initialMarketSlug?: string;
}): React.JSX.Element {
	const owner = payload.owner;
	const rows = payload.rows;
	const [market, setMarket] = useState(
		() =>
			rows.find((r) => r.marketSlug === initialMarketSlug)?.marketId ?? "all",
	);
	const [status, setStatus] = useState("all");
	// The single open Sell expansion (one at a time — canon §5 slide).
	const [sellMarketId, setSellMarketId] = useState<string | null>(null);

	// `sellEligible` exists only on the owner arm's `SellablePositionRow`.
	const sellEligibleOf = (row: ProfilePositionRow): boolean =>
		owner && "sellEligible" in row
			? (row as SellablePositionRow).sellEligible
			: false;

	const marketOptions = useMemo(() => {
		const seen = new Map<string, string>();
		for (const r of rows) {
			if (!seen.has(r.marketId)) {
				seen.set(r.marketId, r.marketTitle);
			}
		}
		return [...seen.entries()];
	}, [rows]);

	const visible = rows.filter(
		(r) =>
			(market === "all" || r.marketId === market) &&
			(status === "all" || r.statusLabel === status),
	);

	if (rows.length === 0) {
		return (
			<p
				data-testid="positions-empty"
				className="py-8 text-center text-sm text-n5"
			>
				{owner
					? PROFILE_COPY.empty.positionsOwner
					: PROFILE_COPY.empty.positionsVisitor}
			</p>
		);
	}

	return (
		<div className="flex flex-col gap-3">
			<div className="flex flex-wrap gap-2">
				<select
					data-testid="positions-market-filter"
					value={market}
					onChange={(e) => setMarket(e.target.value)}
					className="rounded-[var(--r-chip)] bg-n1 px-2 py-1 text-sm text-ink"
				>
					<option value="all">All markets</option>
					{marketOptions.map(([id, title]) => (
						<option key={id} value={id}>
							{title}
						</option>
					))}
				</select>
				<select
					data-testid="positions-status-filter"
					value={status}
					onChange={(e) => setStatus(e.target.value)}
					className="rounded-[var(--r-chip)] bg-n1 px-2 py-1 text-sm text-ink"
				>
					<option value="all">All</option>
					<option value="Open">Open</option>
					<option value="Closed">Closed</option>
				</select>
			</div>

			<table data-testid="positions-table" className="w-full text-left text-sm">
				<thead className="text-xs text-n5">
					<tr>
						<th className="p-2">Position</th>
						<th className="p-2">Argument</th>
						<th className="p-2">Staked</th>
						<th className="p-2">Current</th>
						<th className="p-2" />
					</tr>
				</thead>
				<tbody>
					{visible.map((row) => {
						const sellable = sellEligibleOf(row);
						const sellOpen = sellMarketId === row.marketId;
						return (
							<Fragment key={row.marketId}>
								<tr data-testid={`position-row-${row.marketId}`}>
									<td className="p-2 text-ink">{row.marketTitle}</td>
									<td className="p-2">
										<ArgumentCell cell={row.argument} marketId={row.marketId} />
									</td>
									<td className="p-2 tabular-nums text-ink">
										{formatDharma(row.staked)}
									</td>
									<td className="p-2 tabular-nums text-ink">
										{formatDharma(row.current)}
									</td>
									<td className="flex items-center gap-2 p-2">
										<Badge
											data-testid={`position-status-${row.marketId}`}
											variant={
												row.statusLabel === "Open" ? "secondary" : "outline"
											}
										>
											{row.statusLabel}
										</Badge>
										{sellable && (
											<Button
												type="button"
												size="xs"
												variant="outline"
												data-testid={`sell-trigger-${row.marketId}`}
												aria-expanded={sellOpen}
												onClick={() =>
													setSellMarketId(sellOpen ? null : row.marketId)
												}
											>
												Sell
											</Button>
										)}
									</td>
								</tr>
								{sellable && sellOpen && (
									<tr data-testid={`sell-row-${row.marketId}`}>
										<td colSpan={5} className="p-2">
											{/* Canon §5 slide — the module replaces the fixed-height
											    footer (JS-toggled; never reflows the table above). */}
											<div className="origin-top animate-in fade-in slide-in-from-top-2 duration-[.26s]">
												<SellModule
													marketId={row.marketId}
													slug={row.marketSlug}
													position={{
														side: row.side,
														quantity: row.quantity,
														currentValue: row.current,
													}}
													onClose={() => setSellMarketId(null)}
													onSuspended={() => setSellMarketId(null)}
												/>
											</div>
										</td>
									</tr>
								)}
							</Fragment>
						);
					})}
				</tbody>
			</table>
		</div>
	);
}

/** The episode-opener argument cell (N-1a) — present title (post → own ordinal;
 * reply → the parent's, with the "Replied to …" context) or the removed stub. */
function ArgumentCell({
	cell,
	marketId,
}: {
	cell: ProfileArgumentCell;
	marketId: string;
}): React.JSX.Element {
	if (cell.removed) {
		return (
			<span
				data-testid={`position-arg-removed-${marketId}`}
				className="text-xs text-n5 italic"
			>
				{REMOVED_STUB_TEXT}
			</span>
		);
	}
	// The title is the click target (canon §1d) — the §9 deep-link to the post's
	// ordinal (a reply opener carries its PARENT's ordinal, server-resolved).
	return (
		<span data-testid={`position-arg-${marketId}`} className="text-ink">
			<Link
				href={`/m/${cell.marketSlug}?post=${cell.postOrdinal}`}
				className="hover:underline"
			>
				{cell.title}
			</Link>
			{cell.isReply && cell.repliedToTitle !== null && (
				<span className="block text-xs text-n5">
					Replied to {cell.repliedToTitle}
				</span>
			)}
		</span>
	);
}
