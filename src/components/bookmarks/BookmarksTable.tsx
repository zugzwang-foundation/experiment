"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import {
	displayPositionProfitLossSigned,
	formatDharma,
} from "@/components/debate/format";
import { REMOVED_STUB_TEXT } from "@/components/debate/placeholders";
import { useDocumentRowStepper } from "@/components/profile/row-stepper";
import { useEqualRowThirds } from "@/components/profile/row-thirds";
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
/**
 * PROFILE REFINEMENT · R1 — how many rows fill the panel before the rest scroll. The
 * founder's three, and the same three the mockup's
 * `.rows .prow{flex:0 0 calc(100% / 3)}` (`:273`) divides its own panel into.
 * ⚠ NAMED HERE because this file had no such constant; `PositionsTable` names its own
 * identically, and both hand it to the shared `useEqualRowThirds`.
 */
const ROW_WINDOW = 3;

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
	/**
	 * ⚠⚠ PROFILE REFINEMENT · R1 — THE ROW THIRD REACHES THIS TABLE TOO. R1 names the
	 * POSITION rows; these are their twin, and the mockup's bookmark mode reuses the
	 * very same `.prow` with the very same `flex: 0 0 33.3333%`. MEASURED on staging
	 * before it was shared: positions `[128, 128, 128]` against bookmarks `[136, 92]`
	 * — equalising one surface and leaving the other ragged is the drift the pair is
	 * supposed to be immune to.
	 * ⛔ THE ARITHMETIC IS NOT RESTATED HERE — `row-thirds.ts` owns it, and carries the
	 * measurement, why the mockup has no clamp, and why the CSS form fails.
	 */
	const bodyRef = useRef<HTMLDivElement | null>(null);
	const tableRef = useRef<HTMLTableElement | null>(null);

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

	useEqualRowThirds({
		bodyRef,
		tableRef,
		testidPrefix: "bookmark-row-",
		rowWindow: ROW_WINDOW,
		rowCount: visible.length,
	});

	// ⚠ THE SELECTION IS DERIVED AGAINST THE VISIBLE SET, NOT STORED AS TRUTH —
	// Profile's rule. A pick the filter has hidden simply stops counting; it is
	// REMEMBERED rather than destroyed, so switching the filter back restores it.
	// Derivation, not an effect: an effect would render one frame with a
	// selection that is no longer on screen.
	// ⚠⚠ PROFILE REFINEMENT · R3 — THE FIRST VISIBLE ROW IS THE FALLBACK, byte-carried
	// from `PositionsTable`'s derivation in the same round. R3 asks for default-select
	// in BOTH modes, and since R2 makes bookmarks mode a ROUTE rather than client
	// state, "the other mode" IS this component — so it takes the identical rule.
	// ⛔ ONE EXPRESSION, SAME THREE CASES: mount, a filter that hides the pick, and an
	// empty list (`visible[0]` is `undefined` ⇒ `null` ⇒ the existing empty state, no
	// phantom row). A derivation rather than an effect, so it can never render one
	// frame with a selection that is no longer on screen.
	const selectedRow =
		visible.find((i) => i.id === selectedId) ?? visible[0] ?? null;

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
	// ⚠ PROFILE REFINEMENT · R3 — THE TOGGLE IS RETIRED HERE TOO, for the reason
	// `PositionsTable` records: with a first-row fallback, clearing re-derives to row
	// one, which makes a second click a no-op on row one and a jump elsewhere.
	const pick = (id: string) => {
		setSelectedId(id);
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
		// ⚠⚠ PROFILE OVERLAP · R4 — THE ANCHOR IS THE *DERIVED* ROW, NOT THE STORED
		// PICK, and that one word was half the row. The stored id means "the reader
		// has chosen"; it is `null` at mount, so this read fell to `at < 0` and
		// entered at index 0 — which is the row R3 already has selected. The first
		// arrow therefore re-selected where it stood and NOTHING MOVED; the second
		// finally stepped. MEASURED on staging from a fresh load, with focus placed
		// inside the table so the keys were arriving: two ArrowDowns, no movement.
		// ⇒ Stepping has to start from what is on screen, and the only thing that
		// knows that is `selectedRow` — the same derivation the panel is handed and
		// the highlight is drawn from. Reading it here is what makes the keyboard's
		// notion of "current" and the selection ONE fact instead of two.
		// ⚠ `at < 0` survives and is still reachable: an empty visible set returns
		// above, but a derived `null` on a non-empty set does not, so entering at
		// index 0 stays the answer for it.
		const at = selectedRow === null ? -1 : visible.indexOf(selectedRow);
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
	// ⚠⚠ PROFILE OVERLAP · R4 — AND THE KEYS HAVE TO ARRIVE. The handler on the
	// `<table>` below only fires while focus is already inside it, and at load
	// focus is on `<body>`, so the stepper above was unreachable from a fresh page
	// however correct its arithmetic. This is the arm that reaches it; every
	// condition it stands down on — a caret, page scrolling, focus taken
	// elsewhere, focus already in the table — is written out in that module,
	// including why the old "never bind to `document`" ruling is answered rather
	// than overruled.
	// ⛔ `enabled` yields the keys while the market popover is open: canon §5 says
	// Up/Down yield there, and its options are a list of their own.
	useDocumentRowStepper({ tableRef, step: stepRow, enabled: !filterOpen });

	if (items.length === 0) {
		return (
			<BookmarksPanel bodyRef={bodyRef}>
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
			bodyRef={bodyRef}
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
			    rows must be opaque or the rows read through it.
			    ⚠⚠ AND OPAQUE IS NOT ENOUGH — PROFILE OVERLAP R1, ported from the
			    positions table, where the mechanism is written out in full. A sticky
			    `top:0` resolves against the scroll container's CONTENT box, so this
			    body's `p-3` leaves 12px of scrollable space above the header that the
			    header does not cover, and rows appear in it. The shadow is the header
			    claiming that strip; its offset is bound to the padding by token
			    (`var(--spacing) * 3`), never typed as 12px.
			    ⛔ IT IS FIXED HERE AND NOT ONLY THERE for the reason the row-third is
			    shared: this panel is the same shell with the same padding and the same
			    sticky header, so a fix on one surface only is drift waiting to be
			    reported as a second bug. */}
			{/* ⛔ THE KEY HANDLER IS SCOPED TO THE TABLE, NOT TO `document` —
			    Profile's ruling, and the reason is this surface's own: the page
			    GROWS AND SCROLLS below `lg`, so a document-level ArrowDown that
			    prevents default would kill keyboard scrolling of the whole route.
			    Bound here, the keys are live exactly while focus is inside the
			    table. 			    ⚠⚠ AND SINCE PROFILE OVERLAP R4 IT IS NOT THE ONLY BINDING, on this
			    surface for the same reason as on Profile: focus starts on `<body>`, so
			    this handler never fired from a fresh load and ↑/↓ did nothing until
			    something was clicked. `useDocumentRowStepper` above adds the document
			    arm, and it stands down whenever the page has scrolling to lose — the
			    objection above is answered, not overruled — and whenever the target is
			    already inside this table, which is what stops one press stepping twice.
			    */}
			<table
				ref={tableRef}
				data-testid="bookmarks-table"
				onKeyDown={(e) => {
					if (e.key !== "ArrowUp" && e.key !== "ArrowDown") {
						return;
					}
					e.preventDefault();
					stepRow(e.key === "ArrowUp" ? -1 : 1);
				}}
				className="w-full table-fixed text-left text-sm"
			>
				{/* ⚠⚠ PROFILE-FULL — THE COLUMN HEADERS ARE OVERLINES. The mockup's
				    `.thead` is `font-size:8.5px; font-weight:800; letter-spacing:.12em;
				    text-transform:uppercase; color:var(--n4)` with `padding:0 12px 8px`
				    (`:267-268`) — a micro overline register, not body text. This shipped at
				    `text-xs text-n5` in sentence case, so it read as a fifth row of CONTENT
				    rather than as a label for the four below it.
				    ⛔ `uppercase` IS A CSS TRANSFORM, SO NO STRING IS RETYPED — each `<th>`'s
				    DOM `textContent` is still `Position` / `Argument` / `Staked` / `Current`,
				    which is what the row-14 column-ORDER guards read. A retyped literal would
				    have moved the assertion; a transform cannot.
				    ⚠ `text-[8.5px]` is the mockup's own figure HERE (its tile labels are 8px —
				    that split is the mockup's and is kept), and it is the shipped micro-label
				    idiom in this repo: `DharmaCluster.tsx`, `MarketCard.tsx`, `HeroPanels.tsx`.
				    `leading-normal` because an arbitrary `text-[…]` inherits the previous
				    step's paired line-height — the miss that cost the tile grid 16px.
				    ⚠ THE PADDING FOLLOWS: `px-2 pt-0 pb-2` is the mockup's `0 12px 8px`, which
				    is what makes the header row 19px instead of 33 and puts the overline right
				    above the rule it labels. */}
				{/* ⚠⚠ PROFILE-FULL — THE COLUMN TRACK IS THE MOCKUP'S, AND IT IS LOAD-BEARING
				    NOW RATHER THAN COSMETIC. The mockup's row grid is
				    `grid-template-columns:96px 1fr 78px 16px 118px` (`:262`) — four FIXED tracks
				    with the argument taking the slack. This was an auto-laid `<table>`, and
				    MEASURED ON STAGING it gave Position 97 · Argument 389 · Staked 55 · arrow 31
				    · Current 86: the Argument column had taken 91px the two value columns
				    needed, and once the Current cell gained its P/L delta the figure BROKE
				    MID-VALUE — `Đ` on one line and `448` on the next, with the row at 102px.
				    That is a defect the delta surfaced rather than caused: the column was
				    always too narrow, and nothing had been wide enough to prove it.
				    ⛔ `table-fixed` IS WHAT MAKES THE WIDTHS BIND. Without it a `<th>` width is
				    a HINT the auto layout may overrule from cell content — which is exactly how
				    Current ended up at 86 against a 118px request. With it the four literals
				    hold and Argument becomes the `1fr`, which is the mockup's own topology.
				    ⚠ AND THE VALUE CELLS TAKE `whitespace-nowrap` — belt to the braces. A Đ
				    figure and its delta are ONE quantity; breaking them across lines is never
				    the right degrade, so the cell is told not to, and the 118px track is what
				    means it never has to. */}
				<thead className="sticky top-0 z-10 bg-n0 shadow-[0_calc(var(--spacing)*-3)_0_0_var(--color-n0)] text-[8.5px] leading-[1.2] font-extrabold tracking-[0.12em] text-n4 uppercase">
					<tr>
						<th className="w-[96px] px-2 pt-0 pb-2 text-center">Position</th>
						<th className="px-2 pt-0 pb-2 text-center">Argument</th>
						<th className="w-[78px] px-2 pt-0 pb-2 text-center">Staked</th>
						<th className="w-[16px] px-2 pt-0 pb-2" />
						<th className="w-[118px] px-2 pt-0 pb-2 text-center">Current</th>
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
			// ⚠⚠ PROFILE REFINEMENT · R6 — THE SELECTED ROW TAKES THE RADIUS TOKEN,
			// byte-carried from `PositionsTable`. R6 names the POSITION row, and this is
			// its twin: the two surfaces are one shell with the left panel swapped, and
			// rounding one highlighted row while leaving the other square would be the
			// exact drift §3 forbids. The mockup rounds `.prow.sel` in BOTH modes,
			// because bookmark mode reuses the same row element.
			// ⛔ AN OUTLINE, NOT A HEAVIER BORDER — `border-collapse:collapse` ignores
			// `border-radius`, so the swap this replaces had nowhere for a radius to
			// land. Full reasoning at `PositionsTable`'s row.
			className={`cursor-pointer [border:var(--hairline)] focus-visible:shadow-(--state-focus-ring) ${
				isSelected
					? "rounded-(--r) bg-n1 [outline-offset:-2px] [outline:var(--ring-active)]"
					: "outline-none hover:bg-n1"
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
						// ⚠ PROFILE-FULL — `.pside` is 11px/800 (`:283`), moved in lockstep
						// with Profile's side word (§3: the two surfaces are never sized one
						// after the other). This was `text-xs` at weight 400.
						className="flex items-center gap-[5px] text-[11px] leading-[1.2] font-extrabold"
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
			<td className="p-2 text-center whitespace-nowrap tabular-nums text-ink">
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
			{/* ⚠⚠ PROFILE-FULL — THE CURRENT CELL CARRIES ITS P/L DELTA, byte-carried
			    from `PositionsTable.tsx`'s Current cell in lockstep (§3). The mockup's
			    bookmark mode reuses the SAME `.pnum` cell as its profile mode
			    (`:558`), so this is the same box by construction.
			    ⛔ SPEC.1 §10.8 (1.0.33) admits this as its THIRD displayed-space
			    identity; `displayPositionProfitLossSigned` rounds both operands to what
			    this row prints before subtracting, so the visible arithmetic is true.
			    ⚠ THE FIGURES ARE THE BOOKMARKED AUTHOR'S, not the viewer's — the
			    author-keyed semantic this file's header records. So the delta is that
			    AUTHOR's P/L on the side their argument is frozen to, which is what the
			    two figures it reconciles already were.
			    ⚠ THE REMOVED VARIANT CARRIES NEITHER FIGURE, so it carries no delta:
			    `staked`/`current` exist only on the non-removed arm, and a delta
			    between two unknowns is not zero. */}
			<td className="p-2 text-center whitespace-nowrap tabular-nums text-ink">
				<span className="flex flex-col items-center">
					{item.removed ? null : (
						<span className="inline-flex items-baseline gap-1.5">
							Đ {formatDharma(item.current)}
							{(() => {
								const pl = displayPositionProfitLossSigned(
									item.staked,
									item.current,
								);
								return pl.magnitude === "" ? null : (
									<span
										data-testid={`bookmark-pl-${item.id}`}
										className="text-[10.5px] leading-[1.2] font-bold text-n5"
									>
										({pl.sign}Đ{pl.magnitude})
									</span>
								);
							})()}
						</span>
					)}
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
			// ⚠ PROFILE-FULL — `.pmkt .mq`'s 11px/600 (`:291-292`), in lockstep with
			// Profile's sub-lines. The COLOUR is untouched: the mockup's ramp is
			// inverted against this build's, so `text-n5` stays the dark system's own.
			className="block text-[11px] leading-[1.35] font-semibold text-n5 hover:underline"
		>
			{item.marketTitle}
		</Link>
	);
	if (item.removed) {
		return (
			<span data-testid={`bookmark-arg-removed-${item.id}`}>
				<span className="text-[11px] leading-[1.35] font-semibold text-n5 italic">
					{REMOVED_STUB_TEXT}
				</span>
				{marketLine}
			</span>
		);
	}
	return (
		<span data-testid={`bookmark-arg-${item.id}`} className="text-ink">
			{/* ⚠⚠ PROFILE REFINEMENT · R1 — `line-clamp-3` HERE, NOT PROFILE'S 4, AND
			    THE DIFFERENCE IS ARITHMETIC RATHER THAN TASTE. Both clamps are derived
			    the same way — the 128px third minus whatever else the cell carries,
			    divided by this element's own 18.9px line box — but this cell carries
			    ONE MORE BLOCK than Profile's: the parent reference (`Replied to …`),
			    which SPEC.1 §23 requires for a reply-bet and recon A-7 struck the
			    removal of. Two blocks leave room for four title lines; three leave room
			    for three.
			    ⇒ MEASURED, AND THIS IS WHY IT MOVED: at `line-clamp-4` the rows came out
			    `[136, 128]` on staging — both DECLARED 128, but a `<tr>` height is a
			    FLOOR, so the row carrying a 4-line title AND a 2-line parent reference
			    outgrew it by 8px. At 3 the content fits under the floor and the rows are
			    equal, which is the whole point of the third.
			    ⛔ NOT A DIFFERENT RULE, AND NOT AN INVENTED NUMBER: same budget, same
			    line box, one more subtrahend. A shared clamp CONSTANT would have been
			    the wrong kind of sharing — it would make the two surfaces agree on a
			    figure while disagreeing on the thing the figure is for. */}
			<Link
				data-testid={`bookmark-title-${item.id}`}
				href={`/m/${item.marketSlug}?post=${item.ordinal}`}
				// ⚠ PROFILE-FULL — `.ptitle` is 14px/700/1.35 (`:288`), in lockstep
				// with Profile's argument title.
				className="line-clamp-3 text-[14px] leading-[1.35] font-bold hover:underline"
			>
				{item.title}
			</Link>
			{marketLine}
			{/* ⚠⚠ PROFILE REFINEMENT · R1 — `line-clamp-2`, AND IT IS THE MOCKUP'S OWN
			    VALUE FOR THIS EXACT ELEMENT. The mockup's parent reference is `.parline`
			    and it declares `-webkit-line-clamp: 2` (`:376`) with the comment "fit the
			    fixed 50px footer". This line shipped UNCLAMPED, and MEASURED on staging
			    it was the actual reason a row outgrew its third: 3 unclamped lines (45px)
			    where the budget allows 2 (30px).
			    ⇒ THE ARITHMETIC, so the next reader can check it: the 128px third minus
			    16 of cell padding, minus a 3-line title (57) and the market line (15),
			    leaves 40px for the reference — two lines at this element's 15px line box.
			    ⛔ SO THE TITLE CLAMP AND THIS ONE ARE ONE FIX, NOT TWO. Clamping the
			    title alone moved the row 136 → 133 and left it unequal, because the title
			    was never what overflowed. Both are needed and neither is sufficient.
			    ⚠ NOT AN INVENTED NUMBER, and worth saying because §23 REQUIRES this
			    reference for a reply-bet (recon A-7 struck its removal): the value is the
			    mockup's declared clamp for the same element, and a clamp is a display
			    treatment, not a removal — the whole parent title stays one click away on
			    the thread it links to.
			    ⛔⛔ AND `block` IS REMOVED, WHICH IS WHY THIS NEEDED A SECOND PASS.
			    `line-clamp-2` works by setting `display:-webkit-box`, and the class list
			    also carried `block` — two utilities for ONE property, resolved by
			    stylesheet emission order rather than by the order written here. `block`
			    won, `-webkit-box` never applied, and the clamp was INERT: MEASURED with
			    `line-clamp-2` present and the line still 45px / 3 lines.
			    ⇒ `line-clamp-*` ALREADY makes the element a block-level box, so `block`
			    was redundant before it was harmful. Same emission-order trap `AGENTS.md`
			    §8 records for `table-fixed`, and the same one the Sell button hit with
			    `size="xs"` — third instance this round. The tell never changes: two
			    utilities, one property, and a computed style that reads correct while the
			    layout disagrees. */}
			{item.kind === "reply" && item.repliedToTitle !== null && (
				<span className="line-clamp-2 text-[11px] leading-[1.35] font-semibold text-n5">
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
	bodyRef,
	children,
}: {
	controls?: React.ReactNode;
	/**
	 * ⚠ PROFILE REFINEMENT · R1 — the scroll container the row-third is measured
	 * against, handed down exactly as `PositionsPanel` hands its own down: the panel
	 * owns the box, the table owns the rows, and the measurement needs both.
	 */
	bodyRef?: React.Ref<HTMLDivElement>;
	children: React.ReactNode;
}): React.JSX.Element {
	return (
		<section
			data-testid="bookmarks-panel"
			aria-label="Bookmarks"
			className="flex min-h-0 flex-col overflow-hidden rounded-[var(--r)] bg-n0 [border:var(--hairline)]"
		>
			{/* ⚠ `min-h-[52px]` — the mockup's `.colhead{min-height:52px}` (`:228`).
			    ⚠ MEASURED ON THIS SURFACE, NOT INFERRED FROM PROFILE. A session was
			    available this round, so `/bookmarks` was loaded signed-in at a pinned
			    1440×777 and its own split measured: list head **51**, replica head
			    **41**, bodies at y418 vs y408 — the same 10px offset Profile shows.
			    (Round 1 could only infer this surface; this round measured it.)
			    ⚠ SIZED ONCE AGAINST BOTH SURFACES (§3): all four heads take the floor
			    in ONE commit, because the four carry one class string and the mockup
			    applies `.colhead` to both slots of both modes.
			    ⛔ A floor can only grow a head, never clip one. */}
			<div
				data-testid="bookmarks-panel-head"
				className="relative flex min-h-[52px] flex-wrap items-center gap-2 p-3 [border-bottom:var(--hairline)]"
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
				    not one pixel does.

				    ⚠⚠ PROFILE-FULL — THOSE PANEL-TITLE CLASSES ARE NOW `.chttl`'s OVERLINE
				    (11px/800/.12em uppercase, `:235`), moved in lockstep with Profile's so
				    the two stay byte-identical. The mockup's bookmark mode retitles this
				    exact element — `.chttl` → `Bookmarks` (`:767`) — so it is the same box
				    by construction rather than by resemblance.
				    ⛔ STILL AN `<h1>`: the register is a TREATMENT, and DOC-1 says a
				    shared treatment never ratifies a shared file shape. `uppercase` is a
				    transform, so this heading's accessible name is still `Bookmarks`. */}
				<h1 className="text-[11px] leading-[1.2] font-extrabold tracking-[0.12em] text-ink uppercase">
					Bookmarks
				</h1>
				{/* ⛔⛔ THE `Your bookmarks` CHIP IS DELETED — founder-ruled at PROFILE
				    OVERLAP R3, the same ruling that removed `Viewing as owner` from the
				    identity block one pass earlier. Not hidden, not suppressed by a prop:
				    the element and its testid are gone.
				    ⚠ WHAT THAT ENDS, recorded because two rounds of work lived in it. The
				    chip arrived here at F-1 from a removed page-level row; round 5 then
				    ruled it the surface's SURVIVING chip and retired Profile's in its
				    favour; PROFILE-FULL gave it the mockup's `.viewchip` register
				    (dashed n4, 9px/800/.12em). The mockup does render it in bookmark mode
				    (`surface_profile_v1_0.html:768`) — so this is a deliberate divergence
				    from the mockup, not a missed port, and it is the founder's to make.
				    ⚠ THE PANEL SAYS IT ALREADY. The head is titled `BOOKMARKS`, the route
				    is `/bookmarks`, and the bookmark control in the identity band is
				    FILLED — three statements of the same fact, of which the chip was the
				    fourth. ⛔ `showViewChip` was already retired before this and stays
				    retired; there is no prop left whose only job was this element. */}
				{controls}
			</div>
			<div
				data-testid="bookmarks-panel-body"
				className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3"
				ref={bodyRef}
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
