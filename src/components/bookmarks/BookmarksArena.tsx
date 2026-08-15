"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";

import { PositionMarker } from "@/components/debate/badges";
import { formatDharma } from "@/components/debate/format";
import { REMOVED_STUB_TEXT } from "@/components/debate/placeholders";
import { Button } from "@/components/ui/button";
import { EmptyBlock } from "@/components/ui/empty-block";
import { ThumbGlyph } from "@/components/ui/thumb-glyph";
import type { BookmarkItem } from "@/server/bookmarks/list";
import { BookmarkReplica } from "./BookmarkReplica";
import { BookmarksPanel } from "./BookmarksPanel";
import { BOOKMARKS_COPY } from "./copy";

/**
 * HTML-FINISH · BOOKMARKS R2 — THE ARENA: the saved-items TABLE on the left and
 * the selection-bound REPLICA on the right.
 *
 * ⚠⚠ WHY THIS IS A TABLE AND A REPLICA, and not R1's card list. R1 copied the
 * SHIPPED PROFILE, which renders a list because recon A-1 struck the replica
 * there — a strike taken on SPEC.1 §23's enumeration of the **profile** page.
 * Measured this round: SPEC.1 mentions this route exactly once, at `:1665`,
 * *"This surface hosts a bookmark mode at A6 — specified by A6's own ADR, not
 * here"*. The strike is therefore surface-bound and does NOT travel; the
 * delegated spec **ADR-0032 D-5** rules the page *"reuses the Profile surface
 * in forced-visitor mode"*, with *"the list retitled 'Bookmarks'"* and *"never
 * a Sell mount"*.
 *
 * ⚠ ORDER IS RECENCY, NOT §3.6. `loadBookmarks` returns
 * `bookmarks.created_at DESC` (ADR-0032 D-8). The profile's positions table has
 * no ordering opinion of its own, so nothing is contradicted — but the rows are
 * deliberately NOT re-sorted here, because the recency order is the ratified
 * one for this surface.
 *
 * ⚠ SELECTION STATE IS NOT A NEW PRECEDENT. `PositionsTable.tsx` is already a
 * client component holding filter state and a single open-Sell row
 * (`:53-73`); one selected row is the same shape. There is no shipped
 * row-selection or replica component anywhere in `src/` to import — recon
 * confirmed — so this is new build, composed from shipped primitives only.
 */
export function BookmarksArena({
	items,
}: {
	items: BookmarkItem[];
}): React.JSX.Element {
	// The selected row drives the right panel. Default: the first item, so the
	// replica is never empty when there is something to show — the mockup's
	// bookmark mode enters with a row already selected.
	const [selectedId, setSelectedId] = useState<string | null>(
		items[0]?.id ?? null,
	);
	// HTML-FINISH row 7 — the market popover's open state (mockup `.fpop.open`).
	const [filterOpen, setFilterOpen] = useState(false);
	const filterRef = useRef<HTMLDivElement | null>(null);
	// ⛔ THE KEY IS `marketSlug`, NOT `marketId`. `BookmarkItem` carries
	// `marketSlug` + `marketTitle` and NO `marketId` — measured. The slug is
	// UNIQUE per market (`markets.slug`), so it is a sound key; the profile's
	// `marketId` key is simply not available on this DTO.
	const [marketSlug, setMarketSlug] = useState<string>("all");

	// Canon §5 (Profile) rules the dismissal grammar for a popover on this
	// surface: "ESC / click-out closes" — byte-carried from
	// `PositionsTable.tsx:80-100`, including the reason both are wired rather
	// than left to the option click.
	useEffect(() => {
		if (!filterOpen) {
			return;
		}
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				setFilterOpen(false);
			}
		};
		const onPointer = (e: PointerEvent) => {
			if (!filterRef.current?.contains(e.target as Node)) {
				setFilterOpen(false);
			}
		};
		document.addEventListener("keydown", onKey);
		document.addEventListener("pointerdown", onPointer);
		return () => {
			document.removeEventListener("keydown", onKey);
			document.removeEventListener("pointerdown", onPointer);
		};
	}, [filterOpen]);

	const marketOptions = useMemo(() => {
		const seen = new Map<string, string>();
		for (const i of items) {
			if (!seen.has(i.marketSlug)) {
				seen.set(i.marketSlug, i.marketTitle);
			}
		}
		return [...seen.entries()];
	}, [items]);

	const visible = items.filter(
		(i) => marketSlug === "all" || i.marketSlug === marketSlug,
	);
	const selected = visible.find((i) => i.id === selectedId) ?? visible[0];

	return (
		<>
			<BookmarksPanel
				testid="bookmarks"
				title={BOOKMARKS_COPY.listTitle}
				titleAs="h1"
				controls={
					items.length === 0 ? undefined : (
						/* HTML-FINISH row 7a — the market filter is a LABELLED BUTTON that
						   opens a popover list, not a native `<select>`. Byte-carried whole
						   from `PositionsTable.tsx:150-219`, including the ⛔ that keeps
						   this wrapper un-`relative` (the popover spans the BAR).
						   ⛔ THE Open/Closed SEGMENTED PAIR IS NOT BUILT: it needs
						   `statusLabel`, which `BookmarkItem` does not carry — DATA-BLOCKED,
						   recorded, and rendering nothing rather than approximated. */
						<div ref={filterRef}>
							<Button
								type="button"
								size="xs"
								variant="outline"
								data-testid="bookmarks-market-filter"
								aria-haspopup="listbox"
								aria-expanded={filterOpen}
								onClick={() => setFilterOpen((o) => !o)}
							>
								{BOOKMARKS_COPY.marketFilter}
							</Button>
							{filterOpen && (
								<div
									data-testid="bookmarks-market-popover"
									role="listbox"
									aria-label="Select market"
									className="absolute top-full right-0 left-0 z-20 flex flex-col rounded-[var(--r)] bg-n0 p-1 [border:var(--hairline)]"
								>
									<PopoverOption
										testid="bookmarks-market-option-all"
										selected={marketSlug === "all"}
										onSelect={() => {
											setMarketSlug("all");
											setFilterOpen(false);
										}}
									>
										{BOOKMARKS_COPY.allMarkets}
									</PopoverOption>
									{marketOptions.map(([slug, title]) => (
										<PopoverOption
											key={slug}
											testid={`bookmarks-market-option-${slug}`}
											selected={marketSlug === slug}
											onSelect={() => {
												setMarketSlug(slug);
												setFilterOpen(false);
											}}
										>
											{title}
										</PopoverOption>
									))}
								</div>
							)}
						</div>
					)
				}
			>
				{/* ⚠ NO STRANDED-FILTER STATE, and that is a measurement rather than an
				    omission. Profile needs one because its status filter can hide every
				    row (POLISH.5 Gate C S-1). Here the market options are DERIVED from
				    the items, so choosing any of them always leaves at least the row it
				    came from, and `all` shows everything — `visible.length === 0` is
				    unreachable while `items.length > 0`. Authoring copy for a state that
				    cannot occur would be inventing a string with no source (§2). */}
				{items.length === 0 ? (
					<EmptyBlock
						message={BOOKMARKS_COPY.empty.msg}
						messageTestId="bookmarks-empty"
						sub={BOOKMARKS_COPY.empty.sub}
					/>
				) : (
					<table
						data-testid="bookmarks-table"
						className="w-full text-left text-sm"
					>
						{/* HTML-FINISH row 14 — the ARROW TRACK is FOURTH OF FIVE, between
						    the two value columns, and row 17 centres all four labels.
						    Byte-carried from `PositionsTable.tsx:300-308`.
						    Row 3 — the column-header row stays OUT of the scroll via
						    `sticky top-0`; `bg-n0` is the panel's own background, which a
						    sticky header over scrolling rows must have or the rows read
						    through it. */}
						<thead className="sticky top-0 z-10 bg-n0 text-xs text-n5">
							<tr>
								<th className="p-2 text-center">Position</th>
								<th className="p-2 text-center">Argument</th>
								<th className="p-2 text-center">Staked</th>
								<th className="p-2" />
								<th className="p-2 text-center">Current</th>
							</tr>
						</thead>
						<tbody>
							{visible.map((item) => (
								<Fragment key={item.id}>
									<tr
										data-testid={`bookmark-row-${item.id}`}
										data-selected={
											selected?.id === item.id ? "true" : undefined
										}
										onClick={() => setSelectedId(item.id)}
										className={
											selected?.id === item.id ? "bg-n1" : "hover:bg-n1"
										}
									>
										{/* THE POSITION CELL. ⛔ NO Open BUTTON and NO Sell — ADR-0032
										    D-5 rules "there is never a Sell mount" on this route, and
										    A-2 struck Open on SPEC.1's payload law. ⛔ NO STATUS
										    BADGE: the profile's renders `row.statusLabel`, which
										    `BookmarkItem` does not carry (DATA-BLOCKED, named).
										    ⚠ WHAT DOES RENDER is the ARGUMENT's frozen side —
										    `side_at_post_time`, INV-3 — through the shipped
										    `SideBadge`, NOT `positions.side`. The two are different
										    fields and `PositionsTable.tsx:325-335` records why
										    conflating them is the error INV-3 exists to prevent. */}
										<td className="p-2 text-ink">
											{/* ⛔ NOT A CHIP — R12, and byte-carried from
											    `PositionsTable.tsx:357-364`: the profile's Position cell
											    is the side WORD beside a 12px `ThumbGlyph`, and its own
											    comment says "⛔ NOT a chip (R12)". R2's first draft put a
											    `SideBadge` here; that was wrong on the design AND would
											    have moved a census. `gap-[5px]` is that same cluster's
											    token.
											    ⚠ THE SIDE HERE IS `side_at_post_time` — INV-3 FROZEN, the
											    ARGUMENT's side — where profile's cell renders
											    `positions.side`, which is Bucket C and MUTABLE. Different
											    fields; `PositionsTable.tsx:325-335` records why conflating
											    them is the error INV-3 exists to prevent. This surface has
											    no viewer position to show at all.
											    ⛔ NO STATUS BADGE (needs `statusLabel`, DATA-BLOCKED) and
											    ⛔ NO SELL (ADR-0032 D-5: "never a Sell mount"). */}
											<span className="flex flex-col items-center gap-[5px]">
												<span
													data-testid={`bookmark-side-${item.id}`}
													className="flex items-center gap-[5px] text-xs"
												>
													{item.side === "YES" ? "Yes" : "No"}
													<ThumbGlyph side={item.side} size={12} />
												</span>
												{!item.removed && (
													<PositionMarker marker={item.marker} />
												)}
											</span>
										</td>
										<td className="p-2">
											{item.removed ? (
												<span data-testid={`bookmark-arg-removed-${item.id}`}>
													<span className="text-xs text-n5 italic">
														{REMOVED_STUB_TEXT}
													</span>
													<span className="block text-xs text-n5">
														{item.marketTitle}
													</span>
												</span>
											) : (
												<span
													data-testid={`bookmark-arg-${item.id}`}
													className="text-ink"
												>
													{item.title}
													{/* The market question as a sub-line under the argument
													    title — the mockup's `.pcellt` is `[.ptitle][.pmkt]`,
													    and `PositionsTable.tsx:605-624` records the same
													    move. The class string is byte-matched to that
													    file's `marketLine`. */}
													<span className="block text-xs text-n5">
														{item.marketTitle}
													</span>
												</span>
											)}
										</td>
										{/* Row 17 — the two value cells stack and centre.
										    `PositionsTable.tsx:396-411`. A removed item carries no
										    figures (compile-enforced by the union), so it prints the
										    em-dash placeholder rather than a fabricated zero. */}
										<td className="p-2 text-center tabular-nums text-ink">
											<span className="flex flex-col items-center">
												{item.removed ? "—" : formatDharma(item.staked)}
											</span>
										</td>
										{/* Row 14's arrow track. ⛔ THE GLYPH IS BYTE-CARRIED, NOT
										    TYPED — U+2192, `e2 86 92`, the same bytes
										    `PositionsTable.tsx:425` and `HeroPanels.tsx:237` carry.
										    `text-n4` is that same shipped line's colour for this
										    role; `aria-hidden` because the two adjacent column
										    headers already name the relation. */}
										<td
											aria-hidden="true"
											className="p-2 text-center font-normal text-n4"
										>
											→
										</td>
										<td className="p-2 text-center tabular-nums text-ink">
											<span className="flex flex-col items-center">
												{item.removed ? "—" : formatDharma(item.current)}
											</span>
										</td>
									</tr>
								</Fragment>
							))}
						</tbody>
					</table>
				)}
			</BookmarksPanel>

			{/* ⛔ THE RIGHT PANEL RENDERS ONLY WHEN THERE IS A SELECTION, and the
			    reason is a copy block, not a layout preference. Its header title is
			    the selected item's `marketTitle` — real data, and present even on a
			    removed item, because `markets.title` is market metadata and masking
			    governs `comments.body` and its derivations (SC-1; the same reading
			    `PositionsTable.tsx:616-620` records). With NO selection there is no
			    market title, and the mockup's placeholder for that state is the dummy
			    string `Market title` (`:477`) — unshippable. Since a selection exists
			    whenever an item does, the honest resolution is to render nothing
			    rather than invent a title for an unreachable state.
			    ⛔ NO LIVE PRICE beside the title. The mockup's right colhead carries
			    one (`.chprice`); `BookmarkItem` carries only `priceAtBet`, the FROZEN
			    entry price, which is a different quantity — see `BookmarkReplica.tsx`
			    for why substituting it would be a silent lie. DATA-BLOCKED, renders
			    nothing. */}
			{selected !== undefined && (
				<BookmarksPanel testid="replica" title={selected.marketTitle}>
					<BookmarkReplica item={selected} />
				</BookmarksPanel>
			)}
		</>
	);
}

/** One option in the market popover — byte-carried from
 * `PositionsTable.tsx:578-603`, including the `font-medium` selected weight
 * (the mockup's `.fopt.sel{font-weight:800}` expressed in the shipped scale). */
function PopoverOption({
	testid,
	selected,
	onSelect,
	children,
}: {
	testid?: string;
	selected: boolean;
	onSelect: () => void;
	children: React.ReactNode;
}): React.JSX.Element {
	return (
		<button
			type="button"
			role="option"
			aria-selected={selected}
			data-testid={testid}
			onClick={onSelect}
			className={`rounded-[var(--r-chip)] px-2 py-1 text-left text-sm text-ink hover:bg-n1 ${
				selected ? "font-medium" : ""
			}`}
		>
			{children}
		</button>
	);
}
