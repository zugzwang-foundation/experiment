"use client";

import Link from "next/link";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";

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
	const initialMarketId =
		rows.find((r) => r.marketSlug === initialMarketSlug)?.marketId ?? "all";
	const [market, setMarket] = useState(initialMarketId);
	// ⚠ POLISH.5 Gate C S-1 — the default is DERIVED, not fixed. A fixed `Open`
	// is permanently empty for anyone whose held markets are all non-Open, and
	// after the 2026-11-05 freeze that is EVERY participant — so an owner would
	// open their own profile to four column headers and nothing else, forever.
	// ⛔ SCOPED TO THE INITIAL MARKET, not to all rows: a `?market=<slug>` deep
	// link to a market whose only position is Closed would otherwise still land
	// on a blank table. ⚠ The canon inventory is UNCHANGED — two options, `All`
	// still gone. Only which one is selected at mount moves.
	const [status, setStatus] = useState(() => {
		const scoped =
			initialMarketId === "all"
				? rows
				: rows.filter((r) => r.marketId === initialMarketId);
		return scoped.some((r) => r.statusLabel === "Open") ? "Open" : "Closed";
	});
	// The single open Sell expansion (one at a time — canon §5 slide).
	const [sellMarketId, setSellMarketId] = useState<string | null>(null);
	// HTML-FINISH row 7 — the market popover's open state (mockup `.fpop.open`,
	// `:245`, toggled at `:586-587`).
	const [filterOpen, setFilterOpen] = useState(false);
	const filterRef = useRef<HTMLDivElement | null>(null);

	// Canon §5 (Profile) rules the dismissal grammar for a popover on this
	// surface: "ESC / click-out closes". Both are wired here rather than left to
	// the option click, because a popover that can only be dismissed by CHOOSING
	// traps the reader in a decision they may not want to make.
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
			<PositionsPanel>
				<EmptyBlock
					message={
						owner
							? PROFILE_COPY.empty.positionsOwner
							: PROFILE_COPY.empty.positionsVisitor
					}
					messageTestId="positions-empty"
				/>
			</PositionsPanel>
		);
	}

	return (
		<PositionsPanel
			controls={
				<>
					{/* HTML-FINISH row 7a — THE MARKET FILTER IS A LABELLED BUTTON THAT
					    OPENS A POPOVER LIST, not a native `<select>`. Mockup `:458-459`
					    (`.mfilter` + `.fpop`), built at `:580-595`.
					    ⛔ THE LABEL AND ITS CARET ARE FOUNDER-SUPPLIED, NOT AUTHORED —
					    canon §6 (Profile) pins `Select market ▾` verbatim. The caret is
					    BYTE-CARRIED: hexdump of canon §6 and of mockup `:458`/`:591`
					    all give `e2 96 be`, U+25BE BLACK DOWN-POINTING SMALL TRIANGLE,
					    identical in all three.
					    ⚠ THE TESTID IS UNCHANGED so every existing consumer keeps its
					    handle, but the ELEMENT is now a `<button>` — a `fireEvent.change`
					    against it is meaningless and its call sites move with this row.
					    ⛔ THIS WRAPPER IS DELIBERATELY NOT `relative`, AND THAT IS A
					    MEASURED CORRECTION. It was, and the popover then sized to the
					    TRIGGER: measured in a browser at 1440, `min-w-full` against a
					    107px button produced a 107 × 590 column in which every market
					    question wrapped over ~6 lines. The mockup's `.fpop` is positioned
					    against `.colhead`, not against the button (`:242-244` — `top:46px;
					    left:14px; max-width:calc(100% - 28px)`), so spanning the BAR is
					    both the faithful port and the readable one. The positioning
					    context therefore lives on the header bar and this wrapper carries
					    only the ref, whose `contains()` check is a DOM test and is
					    unaffected by where the box is painted. */}
					<div ref={filterRef}>
						<Button
							type="button"
							size="xs"
							variant="outline"
							data-testid="positions-market-filter"
							aria-haspopup="listbox"
							aria-expanded={filterOpen}
							onClick={() => setFilterOpen((o) => !o)}
						>
							Select market ▾
						</Button>
						{filterOpen && (
							<div
								data-testid="positions-market-popover"
								role="listbox"
								aria-label="Select market"
								// `left-0 right-0` spans the header bar (the mockup's
								// `.fpop` behaviour) — TOPOLOGY, no width value. `top-full`
								// sits it flush under the bar; no margin is invented.
								className="absolute top-full right-0 left-0 z-20 flex flex-col rounded-[var(--r)] bg-n0 p-1 [border:var(--hairline)]"
							>
								<PopoverOption
									testid="positions-market-option-all"
									selected={market === "all"}
									onSelect={() => {
										setMarket("all");
										setFilterOpen(false);
									}}
								>
									All markets
								</PopoverOption>
								{marketOptions.map(([id, title]) => (
									<PopoverOption
										key={id}
										testid={`positions-market-option-${id}`}
										selected={market === id}
										onSelect={() => {
											setMarket(id);
											setFilterOpen(false);
										}}
									>
										{title}
									</PopoverOption>
								))}
							</div>
						)}
					</div>
					{/* HTML-FINISH row 7b — THE STATUS FILTER IS A TWO-BUTTON SEGMENTED
					    PAIR (mockup `:460-463` `.segwrap` + two `.seg`, driven by
					    `setStatus` at `:597-602`).
					    ⚠ THE INVENTORY IS UNCHANGED — two options, `All` still gone
					    (item 11 / P5-D17a). Only the CONTROL SHAPE moves; the values,
					    the derived initial state and the filter predicate are untouched.
					    `ml-auto` is the mockup's `.segwrap{margin-left:auto}` — topology.
					    `aria-pressed` carries the selection, which a pair of buttons must
					    state and a `<select>` got for free. */}
					<span
						data-testid="positions-status-filter"
						className="ml-auto flex items-center gap-1"
					>
						{(["Open", "Closed"] as const).map((s) => (
							<Button
								key={s}
								type="button"
								size="xs"
								variant={status === s ? "default" : "outline"}
								data-testid={`positions-status-${s.toLowerCase()}`}
								aria-pressed={status === s}
								onClick={() => setStatus(s)}
							>
								{s}
							</Button>
						))}
					</span>
				</>
			}
		>
			{/* ⚠ POLISH.5 Gate C S-1 — THE STRANDED STATE. `rows > 0 ∧ visible === 0`
			    used to render four column headers over an empty `<tbody>` and no
			    message at all. ⛔ THE FILTER CONTROLS STAY RENDERED ABOVE: returning
			    early here would trap the user in the state with no way out, which is
			    worse than the bug. Only the TABLE is replaced.
			    ⚠ A DISTINCT testid — this is not `positions-empty`. That state means
			    "you hold nothing"; this one means "the filter is hiding what you
			    hold", and they carry different copy. */}
			{visible.length === 0 ? (
				<EmptyBlock
					message={PROFILE_COPY.empty.positionsFiltered}
					messageTestId="positions-empty-filtered"
				/>
			) : (
				<table
					data-testid="positions-table"
					className="w-full text-left text-sm"
				>
					{/* HTML-FINISH row 14 — THE ARROW TRACK MOVES BETWEEN THE TWO VALUE
					    COLUMNS. The mockup's grid is `Position | Argument | Staked | ␣ |
					    Current` (`:262`, header markup `:466-469`), with the empty track
					    FOURTH of five; the build's empty `<th>` was FIFTH, i.e. a
					    trailing action column, and Staked sat directly against Current.
					    ⛔ THE COLUMN COUNT IS UNCHANGED AT FIVE, which is why the sell
					    host's `colSpan={5}` below is untouched: row 6 deletes the
					    trailing action column in the same commit as row 14 adds the
					    arrow track, so the two edits net to zero. Splitting them across
					    commits would have left a mid-state with a wrong colSpan.
					    HTML-FINISH row 17 — ALL FOUR HEADERS CENTRE OVER THEIR CELLS.
					    The mockup centres `Position` (`:264`), `Argument` (`:265`) and
					    both `.num` headers (`:269`). The table keeps `text-left`: only
					    the HEADERS and the two value CELLS centre — the Argument cell's
					    prose stays left, which is what `text-left` on the table is for. */}
					<thead className="text-xs text-n5">
						<tr>
							<th className="p-2 text-center">Position</th>
							<th className="p-2 text-center">Argument</th>
							<th className="p-2 text-center">Staked</th>
							<th className="p-2" />
							<th className="p-2 text-center">Current</th>
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
											{/* HTML-FINISH row 6 — THE STATUS TOKEN AND SELL MOVE INTO
											    THE POSITION CELL, UNDER THE SIDE WORD, and the trailing
											    fifth column is deleted. The mockup's `.poscell` is a
											    centred column of [side word + thumb] over the slot
											    (`:282`, emitted at `:546-551`), and canon §2 names FOUR
											    columns — `Position · Argument · Staked · Current` — with
											    no action column at all.
											    ⚠ THE STATUS BADGE SURVIVES, and that is a RULING, not an
											    oversight. The mockup shows `Closed` only on closed rows
											    (an open row carries Sell in the same slot), but recon
											    table A-8 STRUCK that reading on tier 1: SPEC.1 §23 —
											    "Per holding the page renders: … status Open / Closed by
											    market state". So the badge renders on EVERY row and Sell
											    joins it in the slot rather than replacing it. The
											    counter-reading (the segmented filter makes every visible
											    row share one status, so the panel could state it once)
											    is recorded at A-8 and is the founder's call, not mine.
											    `gap-[5px]` is the mockup's `.poscell{gap:5px}` — and it
											    is not read off the mockup for its NUMBER: the identical
											    token is already on the side span one line below, shipped
											    at POLISH.5 item 1, so this is a same-file match. */}
											<span className="flex flex-col items-center gap-[5px]">
												<span
													data-testid={`position-side-${row.marketId}`}
													className="flex items-center gap-[5px] text-xs"
												>
													{row.side === "YES" ? "Yes" : "No"}
													<ThumbGlyph side={row.side} size={12} />
												</span>
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
											</span>
										</td>
										<td className="p-2">
											<ArgumentCell
												cell={row.argument}
												marketId={row.marketId}
												marketTitle={row.marketTitle}
											/>
										</td>
										{/* HTML-FINISH row 17 — STACK AND CENTRE THE TWO VALUE CELLS.
										    The mockup's `.pnum` is `display:flex; flex-direction:column;
										    align-items:center` (`:296-297`) — a COLUMN, because the
										    entry % and live % sit under the Đ figure there. Both of
										    those are recon table B-1: `ProfilePositionRow` carries
										    neither an entry price nor a live price, so they are
										    DATA-BLOCKED and no arrangement can render them. The column
										    ships with one child each, which is the arrangement the row
										    names and the slot those two figures land in if the DTO ever
										    carries them. `text-center` stays on the `<td>` so the
										    alignment survives if the inner span is ever unwrapped. */}
										<td className="p-2 text-center tabular-nums text-ink">
											<span className="flex flex-col items-center">
												{formatDharma(row.staked)}
											</span>
										</td>
										{/* Row 14's arrow track. ⛔ THE GLYPH IS BYTE-CARRIED, NOT
										    TYPED: hexdump of mockup `:557` and `:626` and of the
										    shipped `HeroPanels.tsx:237` all give `e2 86 92` — U+2192
										    RIGHTWARDS ARROW, identical in all three. `text-n4` is that
										    same shipped line's colour for this same arrow role; the
										    mockup's `.parrow{color:var(--n4)}` is NOT the source (the
										    ramps are inverted between the light prototype and the
										    shipped dark system). `aria-hidden` because the arrow states
										    a relation the two adjacent column headers already name. */}
										<td
											aria-hidden="true"
											className="p-2 text-center font-normal text-n4"
										>
											→
										</td>
										<td className="p-2 text-center tabular-nums text-ink">
											<span className="flex flex-col items-center">
												{formatDharma(row.current)}
											</span>
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
			)}
		</PositionsPanel>
	);
}

/**
 * HTML-FINISH row 2 — THE ARENA HALF IS A BORDERED PANEL WITH A HEADER BAR.
 * Canon §2 rules the arena as two panels; canon §6 (Profile) names the left
 * one: "list `Positions` (→ `Bookmarks`)". The mockup's `.deb` is a bordered,
 * rounded, overflow-hidden flex column whose `.colhead` carries the title and
 * the controls and whose `.colwrap` holds the body (`:224-228`, `:258-259`,
 * markup `:455-464`). Before this, the filters and the table floated bare in
 * the page column with no panel, no bar and no title on either half.
 *
 * ⛔ THE TITLE IS RATIFIED COPY, NOT AUTHORED — canon §6's `Positions`,
 * verbatim, the same string the recon quotes as row 2's baseline.
 *
 * ⚠ EVERY VALUE IS TRACED, none read off the mockup, whose 1px-solid-ink
 * border, 52px min-height and 10/14px paddings are light-prototype numbers:
 *   `[border:var(--hairline)]`        ← HeroPanels.tsx:138, DebateColumn.tsx:48
 *   `[border-bottom:var(--hairline)]` ← the same token in the `[border-top:…]`
 *                                       form at HeroPanels.tsx:296
 *   `rounded-[var(--r)]` · `bg-n0`    ← HeroPanels.tsx:101
 *   `p-3` (bar and body)              ← this surface's own Card padding
 *                                       (ProfileTiles Tile, ArgumentList Card)
 *   `gap-2` (the bar cluster)         ← the filter row this bar replaces
 *   `text-xs`                         ← this file's own `<thead>` tier
 *   `font-medium text-ink`            ← IdentityCard.tsx's pseudonym
 * ⛔ NO uppercase micro-label tier is reached for: `HeroPanels`'s
 * `REPLYHEAD_TIER` is explicitly named for the replyhead and its docblock
 * forbids pointing other labels at it before the MICRO-LABEL-TIER docket row
 * (routed to POLISH.4). Inventing one here would be a value.
 *
 * `overflow-hidden` is the mockup's `.deb{overflow:hidden}` — topology, and it
 * is what keeps the rounded corner from being squared off by the header bar's
 * own background.
 */
function PositionsPanel({
	controls,
	children,
}: {
	controls?: React.ReactNode;
	children: React.ReactNode;
}): React.JSX.Element {
	return (
		<section
			data-testid="positions-panel"
			aria-label="Positions"
			className="flex flex-col overflow-hidden rounded-[var(--r)] bg-n0 [border:var(--hairline)]"
		>
			{/* `relative` is the row-7a popover's POSITIONING CONTEXT, and it lives
			    here rather than on the trigger — see the ⛔ at the trigger for the
			    measurement that moved it. The mockup's `.colhead` is
			    `position:relative` for exactly this reason (`:227`). */}
			<div
				data-testid="positions-panel-head"
				className="relative flex flex-wrap items-center gap-2 p-3 [border-bottom:var(--hairline)]"
			>
				<span className="text-xs font-medium text-ink">Positions</span>
				{controls}
			</div>
			<div className="flex flex-col gap-3 p-3">{children}</div>
		</section>
	);
}

/** One option in the row-7a market popover (mockup `.fopt`, `:246-251`). A
 * `<button>` inside a `role="listbox"`, so it is keyboard-reachable by default
 * and needs no roving-tabindex machinery. `aria-selected` carries the current
 * choice — the state a native `<option>` supplied for free and a hand-rolled
 * list must state. `font-medium` on the selected row is the mockup's
 * `.fopt.sel{font-weight:800}` expressed in the shipped weight scale this
 * surface already uses (IdentityCard's pseudonym), not at the mockup's number. */
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

/** The episode-opener argument cell (N-1a) — present title (post → own ordinal;
 * reply → the parent's, with the "Replied to …" context) or the removed stub.
 *
 * HTML-FINISH row 10 — THE MARKET QUESTION LIVES HERE, not in the Position
 * cell. The mockup's `.pcellt` is `[.ptitle][.pmkt > .mq]` (`:287-292`, emitted
 * at `:554-555`): the market question is a sub-line under the argument title,
 * and the Position cell carries only the side and its slot. Canon §2's column
 * names `Position · Argument` are adjacent evidence, not a ruling on which cell
 * holds the question (recon row 10, tier 4).
 *
 * ⚠ IT RENDERS ON THE REMOVED VARIANT TOO, deliberately. `marketTitle` is
 * `markets.title` — market metadata, NOT user argument text — so no masking
 * obligation attaches to it (SC-1 governs `comments.body` and its derivations),
 * and MOVING a per-row element means it must still appear on every row. Suppressing
 * it on removed rows would silently drop the market question from exactly the rows
 * whose argument the reader cannot see, i.e. where the market context matters most.
 *
 * ⚠ `marketTitle` is passed as a PROP rather than read off `cell`: the removed
 * variant of `ProfileArgumentCell` carries `{ removed: true, marketSlug }` and
 * nothing else, so reading it from the cell would be a compile error on exactly
 * the branch that needs it — which is the union doing its job, not a nuisance. */
function ArgumentCell({
	cell,
	marketId,
	marketTitle,
}: {
	cell: ProfileArgumentCell;
	marketId: string;
	marketTitle: string;
}): React.JSX.Element {
	// The market line's own class string is BYTE-MATCHED to the "Replied to …"
	// sub-line 20 lines below — same file, same role (a muted sub-line under the
	// cell's title). Nothing is read off the mockup's `.pmkt .mq`, whose 11px /
	// `--n5` are light-prototype VALUES.
	//
	// HTML-FINISH row 13 — THE MARKET QUESTION IS THE LINK TO ITS MARKET. Canon
	// §7 item 6: "Cross-surface navigation — nav identity → Profile; market title
	// → overview; argument titles → that post's thread". Before this, NOTHING on
	// the profile navigated to a market: both of this surface's links (the
	// positions title and the argument-list title) go to `?post=`, i.e. to a
	// thread. The mockup binds the same target — `nav('market','market')` on the
	// market title at `:711-713`.
	// ⛔ A SIBLING OF THE TITLE LINK, NEVER NESTED INSIDE IT: anchors cannot nest,
	// and the title's `?post=` target must stay independently clickable. This is
	// the same constraint `HeroPanels.tsx:212-217` records for the author link.
	// `hover:underline` is the title link's own class in this file, 20 lines
	// below — a same-file match, not a mockup value.
	// ⚠ IT WRAPS ON THE REMOVED VARIANT TOO. `marketSlug` is present on BOTH
	// arms of `ProfileArgumentCell` (`{removed: true, marketSlug}`), so the
	// navigation survives a removed opener — the market is still reachable when
	// its argument is not, which is the point of masking content rather than
	// rows.
	const marketLine = (
		<Link
			data-testid={`position-market-${marketId}`}
			href={`/m/${cell.marketSlug}`}
			className="block text-xs text-n5 hover:underline"
		>
			{marketTitle}
		</Link>
	);
	if (cell.removed) {
		return (
			<span data-testid={`position-arg-removed-${marketId}`}>
				<span className="text-xs text-n5 italic">{REMOVED_STUB_TEXT}</span>
				{marketLine}
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
			{marketLine}
			{cell.isReply && cell.repliedToTitle !== null && (
				<span className="block text-xs text-n5">
					Replied to {cell.repliedToTitle}
				</span>
			)}
		</span>
	);
}
