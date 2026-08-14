"use client";

import Link from "next/link";
import { Fragment, useMemo, useState } from "react";

import { SellModule } from "@/components/debate/composer/SellModule";
import { formatDharma } from "@/components/debate/format";
import { REMOVED_STUB_TEXT } from "@/components/debate/placeholders";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyBlock } from "@/components/ui/empty-block";
import { ThumbGlyph } from "@/components/ui/thumb-glyph";
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
	// Item 11 (P5-D17a) — the canon inventory is Open/Closed, so the initial
	// state is `Open`. ⛔ THIS MOVES WITH THE `All` OPTION BELOW OR THE FILTER
	// SHIPS A LIE: dropping the option alone would leave a `<select>` whose
	// `value` matches no option, and a `<select>` with no matching value paints
	// its FIRST option — so the control would read "Open" while the predicate
	// still returned every row.
	const [status, setStatus] = useState("Open");
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
			// ⛔ The MARKET filter keeps its `all` sentinel. The STATUS filter's
			// was orphaned by item 11 — with `All` removed and the initial state
			// `Open`, no code path can set `status` to `"all"` — so the dead
			// disjunct goes with it and the predicate matches the ratified
			// inventory the docblock above already describes.
			(market === "all" || r.marketId === market) && r.statusLabel === status,
	);

	// Item 8 (P5-D11) — the empty adopts W2.11 P1 at ONE message tier (D3(a)).
	// The testid moves onto the leaf's MESSAGE NODE, so a `textContent` read
	// still returns exactly this string; no `sub` is passed on this surface.
	if (rows.length === 0) {
		return (
			<EmptyBlock
				message={
					owner
						? PROFILE_COPY.empty.positionsOwner
						: PROFILE_COPY.empty.positionsVisitor
				}
				messageTestId="positions-empty"
			/>
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
					{/* Item 11 (P5-D17a) — `All` is GONE, and the initial state moves
					    with it. ⚠ A CAPABILITY REMOVAL, recorded as one rather than
					    filed as polish: after this there is no route — no component,
					    no URL param, no server read — by which open and closed
					    positions appear together. ⛔ The MARKET filter's `all`
					    sentinel above is UNTOUCHED; it is a different control. */}
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
									<td className="p-2 text-ink">
										{/* Item 1 (P5-D02), the mockup's `.pside`: the side WORD
										    beside the thumb glyph at 12px. ⛔ NOT a chip (R12).
										    Before this item `row.side` reached NO rendered node
										    on this surface — it went only to `SellModule`'s
										    prop, so nothing on screen showed which side is
										    held. The word is the side VALUE (data, not copy),
										    cased as the shipped `SlotHeader` word+thumb cluster
										    cases it; `gap-[5px]` is that cluster's gap.
										    ⚠ THIS IS THE HELD SIDE, NOT THE INV-3 FROZEN ONE,
										    and the distinction is worth the line. `row.side`
										    comes from `positions.side` — Bucket C, MUTABLE: a
										    sell-out and re-entry on the other pole changes what
										    renders here. The side that is frozen at post time is
										    `comments.side_at_post_time`, which is what
										    `ArgumentList` renders through `SideBadge`. Item 1's
										    plan text calls this "the frozen side"; the FIELD is
										    not, and labelling a Bucket-C value frozen inside the
										    component that renders it is the conflation INV-3
										    exists to prevent. */}
										<span
											data-testid={`position-side-${row.marketId}`}
											className="flex items-center gap-[5px] text-xs"
										>
											{row.side === "YES" ? "Yes" : "No"}
											<ThumbGlyph side={row.side} size={12} />
										</span>
										{row.marketTitle}
									</td>
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
								{/* Item 10 (P5-D13) — THE FIXED-HEIGHT SELL HOST. Canon §5's Profile
								    row, quoted WHOLE because the omitted half is the half not built:
								    "the replica footer is a fixed 50 px box; on Sell the footer
								    slides down (translateY 110% + fade) and the sell module replaces
								    it over .26 s — fixed height ⇒ never reflows."
								    ⇒ BUILT HERE: the fixed 50px box, the .26s fade, the JS toggle.
								    ⇒ NOT BUILT: the footer's translateY-110% exit. That clause
								    governs a FOOTER ELEMENT the replica card has and this table does
								    not, so there is nothing to slide away; inventing footer content
								    to animate would be authoring design. ⚠ The consequence is
								    user-visible and is raised for the founder rather than absorbed:
								    the reserved box is BLANK when closed, so an owner sees an empty
								    band under every sellable row.
								    ⚠ THE HOST RENDERS FOR EVERY SELLABLE ROW, OPEN OR CLOSED, and
								    reserving the box IS the mechanism: opening Sell now inserts
								    nothing, so no row moves. The whole `<tr>` used to be conditional,
								    so opening it pushed every following row down — which is why the
								    comment that sat here, claiming the module "replaces the
								    fixed-height footer" and "never reflows the table above", was FALSE
								    the day it was written. It is true now, and it has moved here.
								    ⛔ No host on a non-sellable row: reserving 50px under a row that
								    can never sell would be dead space, not a fixed footer.
								    ⛔ `:has()` is banned (canon §3 item 10) — the toggle stays JS
								    state, exactly as before. */}
								{sellable && (
									<tr data-testid={`sell-row-${row.marketId}`}>
										<td colSpan={5} className="p-2">
											<div
												data-testid={`sell-host-${row.marketId}`}
												className="h-[50px]"
											>
												{sellOpen && (
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
												)}
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
