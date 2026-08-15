"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { formatDharma } from "@/components/debate/format";
import { REMOVED_STUB_TEXT } from "@/components/debate/placeholders";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyBlock } from "@/components/ui/empty-block";
import { ThumbGlyph } from "@/components/ui/thumb-glyph";
import type { BookmarkItem } from "@/server/bookmarks/list";

import type { BookmarkSelection } from "./selection";
import { UnbookmarkButton } from "./UnbookmarkButton";

/**
 * HTML-FINISH · BOOKMARKS round 3 · C3 — THE SAVED SET AS PROFILE'S TABLE.
 *
 * Founder-ruled: `/bookmarks` takes the Profile arrangement as it ships on
 * `main`. This replaces the stacked card list with Profile's five-column
 * arena table — `Position · Argument · Staked · ␣ · Current`, the arrow track
 * FOURTH of five, all four value headers centred over their cells, and each row
 * a bordered card.
 *
 * ⚠⚠ THE FIGURES ARE THE BOOKMARKED AUTHOR'S, NOT THE VIEWER'S, AND THAT IS THE
 * SHIPPED SEMANTIC — ⛔ do not "fix" it to a viewer-keyed one. `BookmarkItem`
 * is AUTHOR-KEYED by ADR-0032 D-5: `staked` is that author's Đa and `current`
 * their Đb on the card's frozen side, computed in `bookmarks/list.ts` Q7/Q8 from
 * the AUTHOR's positions. They are legitimately `Đ 0` whenever that author no
 * longer holds that side — which is data available, not data missing, and
 * renders as `Đ 0` for the same reason canon §10 gives the header's portfolio.
 *
 * ⛔ EVERY CLASS IS BYTE-CARRIED FROM PROFILE AT `main`'s HEAD — this component
 * invents no value. Per-node sources are named at each node below; the shell,
 * the table and the row treatment all come from
 * `src/components/profile/PositionsTable.tsx`.
 *
 * ⚠ TWO OF PROFILE'S POSITION-CELL PARTS CANNOT COME ACROSS, and both are DATA,
 * not layout:
 *   · the Open/Closed status Badge — `BookmarkItem` carries no `statusLabel`,
 *     no `marketStatus` and no `settled` (they exist only INSIDE `list.ts` as
 *     Q7/Q8 locals and never reach the DTO). Verified at `main`'s head, not
 *     assumed. ⇒ NOTHING renders in its place.
 *   · the Sell trigger — structurally impossible here, and not merely absent:
 *     every bookmark is someone ELSE's argument (ADR-0032 D-3), so there is no
 *     owner arm and no `sellEligible` field to gate on.
 * ⇒ THE SLOT IS NOT LEFT BLANK. `UnbookmarkButton` is this route's own row
 * action and takes the place Profile gives Sell — the affordance the card list
 * carried, kept rather than lost in the move to a table.
 */
export function BookmarksTable({
	items,
	onSelect,
}: {
	items: BookmarkItem[];
	/**
	 * C6 — report the picked row to the replica panel (`BookmarksArena` holds
	 * it). ⚠ OPTIONAL: omitting it drops NOTHING this component renders — the
	 * selection is still owned, still visible, still keyboard driven — so a
	 * required prop would buy no guarantee and would churn every render-test
	 * call site. There is one production call site and it always passes it.
	 * ⛔ PASS A STABLE FUNCTION. It is an effect dependency below, and the value
	 * it reports is a fresh object, so an inline arrow loops.
	 */
	onSelect?: (selection: BookmarkSelection | null) => void;
}): React.JSX.Element {
	// ⚠⚠ C4 — ONE FILTER, AND ONLY ONE. Profile's header bar carries TWO: a market
	// popover and an Open/Closed segmented pair. The pair CANNOT come across —
	// `BookmarkItem` carries no `statusLabel`, no `marketStatus` and no `settled`
	// (verified at `main`'s head: they are Q7/Q8 locals inside `list.ts` and never
	// reach the DTO), so there is nothing to partition on and a two-button control
	// would be a lie the DTO cannot answer. ⛔ It is not rendered disabled either:
	// a disabled control still asserts the axis exists.
	// ⇒ The market filter DOES carry — `marketSlug` keys it and `marketTitle`
	// labels it, both on every variant including the removed one.
	const [market, setMarket] = useState("all");
	const [filterOpen, setFilterOpen] = useState(false);
	const filterRef = useRef<HTMLDivElement | null>(null);
	// ⚠⚠ C5 — THE SELECTED ROW, keyed by the COMMENT id (`item.id`) rather than
	// by index. Profile keys by `marketId` for the same reason: the visible set is
	// re-filtered by a control, so an index would silently point at a different
	// row the moment the filter moved. Here the comment id is also the natural
	// key — a bookmark IS a pointer at one comment.
	// ⛔ IT STARTS AT NULL. Nothing is selected until the reader picks.
	const [selectedId, setSelectedId] = useState<string | null>(null);
	// One entry per rendered row, for `scrollIntoView` + focus on an arrow step.
	// A ref, not state: moving focus must not re-render.
	const rowRefs = useRef(new Map<string, HTMLTableRowElement>());

	// Canon §5 rules the dismissal grammar for a popover on this surface family:
	// "ESC / click-out closes". Byte-carried from `PositionsTable.tsx`, both
	// halves — a popover dismissible only by CHOOSING traps the reader in a
	// decision they may not want to make.
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

	// ⚠ KEYED BY `marketSlug`, NOT by a market id — `BookmarkItem` carries no
	// `marketId`. The slug is unique per market and is already the routing key on
	// this surface, so it is the natural handle rather than a substitute.
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
		(i) => market === "all" || i.marketSlug === market,
	);

	// ⚠ THE SELECTION IS DERIVED AGAINST THE VISIBLE SET, NOT STORED AS TRUTH —
	// Profile's rule. A pick the filter has hidden simply stops counting; it is
	// REMEMBERED rather than destroyed, so switching the filter back restores it.
	// Derivation, not an effect: an effect would render one frame with a
	// selection that is no longer on screen.
	const selectedRow = visible.find((i) => i.id === selectedId) ?? null;

	// C6 — REPORT THE DERIVED SELECTION UPWARD. The deps are PRIMITIVES, never
	// `selectedRow` itself: the row object is rebuilt on every render, so
	// depending on it would fire the effect every time and hand the panel a new
	// object it cannot compare.
	// ⚠ IT REPORTS THE DERIVED ROW, NOT THE STORED ID, which is what makes a
	// filtered-away pick stop counting on the OTHER side of the arena too — the
	// panel empties rather than showing an argument whose row is off screen.
	const pickedId = selectedRow?.id ?? null;
	const pickedMarketTitle = selectedRow?.marketTitle ?? null;
	useEffect(() => {
		if (pickedId === null || pickedMarketTitle === null) {
			onSelect?.(null);
			return;
		}
		onSelect?.({ commentId: pickedId, marketTitle: pickedMarketTitle });
	}, [pickedId, pickedMarketTitle, onSelect]);

	/** Click the selected row again to clear it — Profile's `pick()`. */
	const pick = (id: string) => {
		setSelectedId((current) => (current === id ? null : id));
	};

	/** Up/Down step through the CURRENTLY VISIBLE rows and WRAP,
	 * `(at + dir + len) % len`, entering at index 0 from no selection
	 * (`at < 0 ? 0`) — Profile's `stepRow()`, arithmetic and all.
	 * ⚠ `scrollIntoView` is GUARDED exactly as Profile guards it: jsdom
	 * implements no layout and defines no `scrollIntoView`, so the render suite
	 * would throw on an unguarded call. Focus moves with the selection so the
	 * next arrow keeps arriving at the table's handler; `preventScroll` because
	 * the line above has already scrolled, and more precisely. */
	const stepRow = (dir: 1 | -1) => {
		if (visible.length === 0) {
			return;
		}
		const at = visible.findIndex((i) => i.id === selectedId);
		const next = at < 0 ? 0 : (at + dir + visible.length) % visible.length;
		const target = visible[next];
		if (target === undefined) {
			return;
		}
		setSelectedId(target.id);
		const el = rowRefs.current.get(target.id);
		if (el?.scrollIntoView) {
			el.scrollIntoView({ block: "nearest" });
		}
		el?.focus({ preventScroll: true });
	};

	if (items.length === 0) {
		return (
			<BookmarksPanel>
				<EmptyBlock
					message={BOOKMARKS_EMPTY_COPY.msg}
					messageTestId="bookmarks-empty"
					sub={BOOKMARKS_EMPTY_COPY.sub}
				/>
			</BookmarksPanel>
		);
	}

	return (
		<BookmarksPanel
			controls={
				/* ⛔ THE LABEL AND ITS CARET ARE BYTE-CARRIED, NOT AUTHORED — canon §6
				   pins `Select market ▾` verbatim, and the caret is `e2 96 be`,
				   U+25BE BLACK DOWN-POINTING SMALL TRIANGLE, identical in canon, in
				   the mockup (`:458`/`:591`) and in Profile's shipped button.
				   ⛔ THIS WRAPPER IS DELIBERATELY NOT `relative` — Profile measured
				   that: `min-w-full` against a ~107px trigger produced a 107px column
				   in which every market question wrapped over ~6 lines. The
				   positioning context lives on the HEADER BAR, so the popover spans
				   the bar; this wrapper carries only the ref, whose `contains()` is a
				   DOM test unaffected by where the box is painted. */
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
						Select market ▾
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
								selected={market === "all"}
								onSelect={() => {
									setMarket("all");
									setFilterOpen(false);
								}}
							>
								All markets
							</PopoverOption>
							{marketOptions.map(([slug, title]) => (
								<PopoverOption
									key={slug}
									testid={`bookmarks-market-option-${slug}`}
									selected={market === slug}
									onSelect={() => {
										setMarket(slug);
										setFilterOpen(false);
									}}
								>
									{title}
								</PopoverOption>
							))}
						</div>
					)}
				</div>
			}
		>
			{/* ⛔ THE COLUMN COUNT IS FIVE AND THE ARROW TRACK IS FOURTH OF THEM —
			    `PositionsTable.tsx`'s row 14 order, byte-for-byte. The empty `<th>`
			    sits BETWEEN Staked and Current, never trailing: a trailing blank
			    column reads as an action column, and this surface's action lives in
			    the Position cell.
			    ⚠ `sticky top-0` on `<thead>` holds the column-header row OUT of the
			    body's scroll — Profile's row 3 mechanism, and the reason the table
			    is a real `<table>` rather than a div grid (two grids cannot share
			    column widths without an explicit px track template, and every such
			    template available is a light-prototype VALUE).
			    `bg-n0` is the panel's own background: a sticky header over scrolling
			    rows must be opaque or the rows read through it. */}
			{/* ⛔ THE KEY HANDLER IS SCOPED TO THE TABLE, NOT TO `document` —
			    Profile's ruling, and the reason is this surface's own: the page
			    GROWS AND SCROLLS below `lg`, so a document-level ArrowDown that
			    prevents default would kill keyboard scrolling of the whole route.
			    Bound here, the keys are live exactly while focus is inside the
			    table. */}
			<table
				data-testid="bookmarks-table"
				onKeyDown={(e) => {
					if (e.key !== "ArrowUp" && e.key !== "ArrowDown") {
						return;
					}
					e.preventDefault();
					stepRow(e.key === "ArrowUp" ? -1 : 1);
				}}
				className="w-full text-left text-sm"
			>
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
					{visible.map((item, index) => (
						<BookmarkRow
							key={item.id}
							item={item}
							isSelected={selectedRow?.id === item.id}
							isFirst={selectedRow === null && index === 0}
							onPick={pick}
							rowRefs={rowRefs}
						/>
					))}
				</tbody>
			</table>
		</BookmarksPanel>
	);
}

/**
 * One saved argument as a bordered row card.
 *
 * ⛔ THE BORDER IS THE SHIPPED EMPHASIS LADDER, NOT A MOCKUP VALUE.
 * `[border:var(--hairline)]` is rung 1 (`globals.css:166`), the same token
 * Profile gives an unselected row (`PositionsTable.tsx`'s row className) and the
 * same one both panel shells carry. `hover:bg-n1` is Profile's row hover.
 * ⚠ THE HEAVIER SELECTED EDGE IS NOT HERE YET — selection lands at C5, and its
 * `[border:var(--ring-active)]` replaces this class rather than joining it: two
 * arbitrary `[border:…]` utilities on one element resolve by stylesheet order,
 * not by the order they are written.
 * ⚠ Row borders paint at all only because Tailwind's preflight sets
 * `border-collapse: collapse` — measured in a browser against the compiled CSS
 * on Profile, and the same table model applies here.
 */
function BookmarkRow({
	item,
	isSelected,
	isFirst,
	onPick,
	rowRefs,
}: {
	item: BookmarkItem;
	isSelected: boolean;
	isFirst: boolean;
	onPick: (id: string) => void;
	rowRefs: React.RefObject<Map<string, HTMLTableRowElement>>;
}): React.JSX.Element {
	return (
		<tr
			data-testid={`bookmark-row-${item.id}`}
			ref={(el) => {
				if (el) {
					rowRefs.current.set(item.id, el);
				} else {
					rowRefs.current.delete(item.id);
				}
			}}
			// ⚠ `aria-current`, NOT `aria-selected` — Profile's blocked route, and
			// the block is the same here: `aria-selected` is only defined inside a
			// grid or a listbox, and Biome's a11y rule rejects `role="grid"` on a
			// `<table>` as redundant. `aria-current` is valid on ANY element and
			// says precisely this: the current item within a set.
			aria-current={isSelected ? "true" : undefined}
			// Roving tabindex: one tab stop for the whole table, on the selected row
			// — or on the first row when nothing is selected, so the keys are
			// reachable without a click.
			tabIndex={isSelected || isFirst ? 0 : -1}
			onClick={(e) => {
				// The row's own children stay clickable: the title and market links
				// navigate, the unbookmark button acts. One `closest` covers every
				// child without threading a handler through them.
				if ((e.target as HTMLElement).closest("a,button")) {
					return;
				}
				onPick(item.id);
			}}
			onKeyDown={(e) => {
				if (e.key === "Enter" || e.key === " ") {
					e.preventDefault();
					onPick(item.id);
				}
			}}
			className={`cursor-pointer outline-none focus-visible:shadow-(--state-focus-ring) ${
				isSelected
					? "bg-n1 [border:var(--ring-active)]"
					: "[border:var(--hairline)] hover:bg-n1"
			}`}
		>
			{/* THE POSITION CELL — `PositionsTable.tsx`'s `.poscell`: a centred
			    column of [side word + thumb] over the row's action slot.
			    `gap-[5px]` and `text-xs` are that cell's own tokens.
			    ⚠ THE SIDE IS `side_at_post_time` — the INV-3 frozen side the
			    argument was posted on, which is what a bookmark points at. It is not
			    a holding, and there is no viewer holding on this route at all. */}
			<td className="p-2 text-ink">
				<span className="flex flex-col items-center gap-[5px]">
					<span
						data-testid={`bookmark-side-${item.id}`}
						className="flex items-center gap-[5px] text-xs"
					>
						{item.side === "YES" ? "Yes" : "No"}
						<ThumbGlyph side={item.side} size={12} />
					</span>
					<UnbookmarkButton commentId={item.id} />
				</span>
			</td>
			<td className="p-2">
				<BookmarkArgumentCell item={item} />
			</td>
			{/* THE TWO VALUE CELLS — `PositionsTable.tsx`'s row 17 column, and its
			    row-D glyph. `Đ ` is byte-carried (U+0110, `c4 90`), same spacing.
			    ⚠ THE REMOVED VARIANT CARRIES NEITHER FIGURE — `staked`/`current`
			    exist only on the non-removed arm of `BookmarkItem`, so reaching for
			    them on a removed row is a COMPILE error, not a judgement call. The
			    cell renders nothing rather than a fabricated zero: the author's
			    stake on a removed argument is not zero, it is unknown here. */}
			<td className="p-2 text-center tabular-nums text-ink">
				<span className="flex flex-col items-center">
					{item.removed ? null : <>Đ {formatDharma(item.staked)}</>}
				</span>
			</td>
			{/* The arrow track. ⛔ BYTE-CARRIED, NOT TYPED: `e2 86 92`, U+2192
			    RIGHTWARDS ARROW, the same byte `PositionsTable.tsx` and
			    `HeroPanels.tsx:237` carry. `text-n4` is that shipped line's colour
			    for this same role. `aria-hidden` because the arrow states a relation
			    the two adjacent column headers already name. */}
			<td aria-hidden="true" className="p-2 text-center font-normal text-n4">
				→
			</td>
			<td className="p-2 text-center tabular-nums text-ink">
				<span className="flex flex-col items-center">
					{item.removed ? null : <>Đ {formatDharma(item.current)}</>}
				</span>
			</td>
		</tr>
	);
}

/**
 * The Argument cell — `PositionsTable.tsx`'s `ArgumentCell`: the title as the
 * click target with the MARKET QUESTION as its sub-line, and a reply's
 * "Replied to …" context beneath.
 *
 * ⚠ THE MARKET QUESTION RENDERS ON THE REMOVED VARIANT TOO, deliberately and
 * for Profile's recorded reason: `marketTitle` is `markets.title` — market
 * metadata, NOT user argument text — so no masking obligation attaches to it
 * (SC-1 governs `comments.body` and its derivations). Suppressing it on removed
 * rows would drop the market question from exactly the rows whose argument the
 * reader cannot see, i.e. where the context matters most.
 * ⛔ SC-1 HOLDS BY CONSTRUCTION: the removed variant of `BookmarkItem` carries
 * no `title`, no `teaser` and no `body`, so a leak here is a COMPILE error.
 */
function BookmarkArgumentCell({
	item,
}: {
	item: BookmarkItem;
}): React.JSX.Element {
	// Byte-matched to the "Replied to …" sub-line below — same file, same role.
	const marketLine = (
		<Link
			data-testid={`bookmark-market-${item.id}`}
			href={`/m/${item.marketSlug}`}
			className="block text-xs text-n5 hover:underline"
		>
			{item.marketTitle}
		</Link>
	);
	if (item.removed) {
		return (
			<span data-testid={`bookmark-arg-removed-${item.id}`}>
				<span className="text-xs text-n5 italic">{REMOVED_STUB_TEXT}</span>
				{marketLine}
			</span>
		);
	}
	return (
		<span data-testid={`bookmark-arg-${item.id}`} className="text-ink">
			<Link
				data-testid={`bookmark-title-${item.id}`}
				href={`/m/${item.marketSlug}?post=${item.ordinal}`}
				className="hover:underline"
			>
				{item.title}
			</Link>
			{marketLine}
			{item.kind === "reply" && item.repliedToTitle !== null && (
				<span className="block text-xs text-n5">
					Replied to {item.repliedToTitle}
				</span>
			)}
		</span>
	);
}

/**
 * The arena half as a bordered panel with a header bar — `PositionsTable.tsx`'s
 * `PositionsPanel`, byte-for-byte. Every token is traced there:
 *   `[border:var(--hairline)]` · `[border-bottom:var(--hairline)]` ·
 *   `rounded-[var(--r)]` · `bg-n0` · `p-3` · `gap-2` · `text-xs` ·
 *   `font-medium text-ink`.
 * `overflow-hidden` keeps the rounded corner from being squared off by the
 * header bar's own background; `min-h-0` lets the panel be SHORTER than its
 * content, which is what makes the body scroll instead of the panel growing.
 *
 * ⛔ THE TITLE IS BYTE-CARRIED, NOT AUTHORED — `Bookmarks`, the string this
 * route's own `<h1>` already ships and the one the mockup writes into the left
 * colhead in bookmark mode (`surface_profile_v1_0.html:767`,
 * `t.textContent='Bookmarks'`). Hexdumped: `42 6f 6f 6b 6d 61 72 6b 73`.
 *
 * ⚠ THE HEADER BAR CARRIES NO FILTERS YET — they land at C4, and only the ones
 * the DTO can support.
 */
function BookmarksPanel({
	controls,
	children,
}: {
	controls?: React.ReactNode;
	children: React.ReactNode;
}): React.JSX.Element {
	return (
		<section
			data-testid="bookmarks-panel"
			aria-label="Bookmarks"
			className="flex min-h-0 flex-col overflow-hidden rounded-[var(--r)] bg-n0 [border:var(--hairline)]"
		>
			<div
				data-testid="bookmarks-panel-head"
				className="relative flex flex-wrap items-center gap-2 p-3 [border-bottom:var(--hairline)]"
			>
				{/* ⚠⚠ GATE C F-1 — THE `<h1>` LIVES HERE, AND IT IS THE ONLY ONE.
				    Before this, `page.tsx` carried a pre-replication header row
				    (`<h1>Bookmarks</h1>` + the chip) ABOVE the panel while this bar
				    titled itself `Bookmarks` again — the word rendered TWICE. Round 2
				    caught it and guarded it; the guard went with round 2's code and
				    the defect came back with the replication.
				    ⇒ THE HEADING MOVED IN; the page-level row is REMOVED, not copied.
				    ⛔ IT STAYS AN `<h1>`, NOT A `<span>`, AND THAT IS THE RULING —
				    Profile's equivalent bar uses a `<span>` only because Profile's
				    heading role is filled by the identity card's pseudonym, and this
				    document has no other heading at all. Canon §10 `C-STATES-1`'s
				    DOC-1 rider is the governing line: a shared TREATMENT never
				    ratifies a shared FILE SHAPE, and a reader must not "fix" a
				    structural divergence to match a sibling surface.
				    ⚠ THE CLASSES ARE THE PANEL-TITLE CLASSES, byte-identical to the
				    `<span>` they replace and to Profile's — so the element changes and
				    not one pixel does. */}
				<h1 className="text-xs font-medium text-ink">Bookmarks</h1>
				{/* ⚠⚠ ROUND 5 — THE TWO-CHIP QUESTION IS RESOLVED, AND THIS IS THE
				    SURVIVING CHIP. It arrived here at F-1 because it shared the removed
				    page-level row with the `<h1>`; the founder has now ruled that it
				    STAYS and that `IdentityCard`'s "Viewing as owner" is REMOVED on
				    this surface — which is what the mockup's bookmark mode does
				    (`surface_profile_v1_0.html:768`, `vc.textContent='Your bookmarks'`,
				    ONE chip). The suppression rides a new optional prop whose default
				    is today's behaviour, so Profile is untouched; see
				    `IdentityCard.tsx`'s `showViewChip`.
				    ⛔ NO STRING WAS RETITLED — `profile/copy.ts` is untouched. */}
				<Badge data-testid="bookmarks-view-chip" variant="outline">
					Your bookmarks
				</Badge>
				{controls}
			</div>
			<div
				data-testid="bookmarks-panel-body"
				className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3"
			>
				{children}
			</div>
		</section>
	);
}

/**
 * W2.11 P1 copy — web-authored, carried VERBATIM from the state-kit mockup's
 * "Empty Bookmarks · id 18" block (`:198`, `:199`), ratified as OD-1.
 *
 * ⚠ RE-HOMED FROM `page.tsx`, NOT RE-TYPED. The empty arm moved inside the
 * panel with the list it replaces, so the const moves with it; `page.tsx`
 * re-exports it so every existing importer keeps its handle and the string
 * still exists in exactly one place.
 */
export const BOOKMARKS_EMPTY_COPY = {
	msg: "No bookmarks yet.",
	sub: "Saved arguments will appear here.",
} as const;

/** One option in C4's market popover — `PositionsTable.tsx`'s `PopoverOption`,
 * byte-for-byte. A `<button>` inside a `role="listbox"`, so it is
 * keyboard-reachable by default and needs no roving-tabindex machinery;
 * `aria-selected` carries the current choice, which a native `<option>` supplied
 * for free and a hand-rolled list must state. `font-medium` on the selected row
 * is the shipped weight scale, not the mockup's `font-weight:800`. */
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
