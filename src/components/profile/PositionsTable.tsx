"use client";

import Link from "next/link";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";

import { SellModule } from "@/components/debate/composer/SellModule";
import {
	displayPositionProfitLossSigned,
	formatDharma,
} from "@/components/debate/format";
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
import { LotBreakdown } from "./LotBreakdown";
import { useDocumentRowStepper } from "./row-stepper";
import { useEqualRowThirds } from "./row-thirds";
import {
	initialMarketIdOf,
	initialStatusFilter,
	type ProfileSelection,
} from "./selection";

/**
 * ROUND 4 item 8 — how many position rows fill the panel before the rest
 * scroll. FOUNDER-SUPPLIED ("three rows fill the panel"), and the same three the
 * mockup's `.rows .prow{flex:0 0 calc(100% / 3)}` (`:273`) divides its own panel
 * into. Named rather than inlined so the window is one thing with one source.
 */
const ROW_WINDOW = 3;

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
 *
 * ROUND 4 item 5 — THE ROWS ARE SELECTABLE, by pointer and by Up/Down. The
 * mockup's `pick()` / `stepRow()` / `onKey()` (`:679`, `:741-756`) are
 * reimplemented as behaviour: click toggles, arrows wrap through the CURRENTLY
 * VISIBLE (filtered) rows, and the stepped-to row is scrolled into view at
 * `block:"nearest"`. Selection is keyed by `marketId`, starts EMPTY (the founder
 * ruled the full argument list the empty state, so no auto-select), and is
 * derived against the visible set so a filter that hides it simply clears it.
 */
export function PositionsTable({
	payload,
	initialMarketSlug,
	onSelect,
}: {
	payload: ProfilePositionsPayload;
	/** OQ-5 B — the W2.10-C `?market=<slug>` preselect; matched against the
	 * rows' `marketSlug` (unknown → "all"; the raw param is never rendered). */
	initialMarketSlug?: string;
	/**
	 * ROUND 4 item 7 — report the picked row to the argument panel (`ProfileArena`
	 * holds it). ⚠ OPTIONAL, and that is a departure from O-1's "structural beats
	 * procedural" taken on purpose: omitting it drops NOTHING this component
	 * renders — the selection is still owned, still visible, still keyboard
	 * driven — so a required prop would buy no guarantee and would churn every
	 * render-test call site for it. There is exactly one production call site and
	 * it always passes it.
	 * ⛔ PASS A STABLE FUNCTION. It is an effect dependency below, and the value
	 * it reports is a fresh object, so an inline arrow loops.
	 */
	onSelect?: (selection: ProfileSelection | null) => void;
}): React.JSX.Element {
	const owner = payload.owner;
	const rows = payload.rows;
	// ⚠ PROFILE REFINEMENT · R3 (SSR half) — these two derivations moved into
	// `selection.ts` so the ARENA can seed its initial selection from the same
	// definitions. Two copies of "which rows are visible at mount" would drift, and
	// the drift would be invisible: the table would highlight one row while the
	// panel showed another. See that module for why the flash made this necessary.
	const initialMarketId = initialMarketIdOf(rows, initialMarketSlug);
	const [market, setMarket] = useState(initialMarketId);
	// ⚠ POLISH.5 Gate C S-1 — the default is DERIVED, not fixed. A fixed `Open`
	// is permanently empty for anyone whose held markets are all non-Open, and
	// after the 2026-11-05 freeze that is EVERY participant — so an owner would
	// open their own profile to four column headers and nothing else, forever.
	// ⛔ SCOPED TO THE INITIAL MARKET, not to all rows: a `?market=<slug>` deep
	// link to a market whose only position is Closed would otherwise still land
	// on a blank table. ⚠ The canon inventory is UNCHANGED — two options, `All`
	// still gone. Only which one is selected at mount moves.
	const [status, setStatus] = useState<"Open" | "Closed">(() =>
		initialStatusFilter(rows, initialMarketId),
	);
	// The single open Sell expansion (one at a time — canon §5 slide).
	const [sellMarketId, setSellMarketId] = useState<string | null>(null);
	// ⚠ ROUND 4 item 5 — THE SELECTED ROW. The mockup keeps this in one module
	// variable (`var sel = -1`, `:536`) and every path goes through `pick()`
	// (`:679`); here it is one more piece of the state this component already
	// holds, keyed by `marketId` rather than by INDEX. The mockup can use an
	// index because its row array never changes; ours is re-filtered by two
	// controls, so an index would silently point at a different row the moment a
	// filter moved.
	// ⛔⛔ IT STILL STARTS AT NULL, BUT NULL NO LONGER MEANS "NOTHING SELECTED" —
	// PROFILE REFINEMENT · R3 REVERSED THE RULING THIS COMMENT RECORDED. It used to
	// read: "the founder ruled the opposite for this build — the full argument list
	// IS the empty state — so nothing is selected until the reader picks." The
	// founder has now ruled the mockup's way: the panel loads with the FIRST row
	// selected and the rail shows that argument in full, because a rail of stubs on
	// load was the defect. The mockup's own note is the one that governs again —
	// `refresh()` (`:571`): "the list auto-selects the first visible row … the
	// replica always shows an argument".
	// ⚠ THE STATE STILL STARTS AT NULL DELIBERATELY, and that is not a leftover: it
	// means "the reader has not chosen", which is a different fact from "row one is
	// chosen" and is what lets the FALLBACK below re-aim at the first VISIBLE row
	// every time a filter moves. Seeding the state with row one's id instead would
	// pin a stale id the moment the filter changed.
	const [selectedMarketId, setSelectedMarketId] = useState<string | null>(null);
	// One entry per rendered position row, for `scrollIntoView` + focus on an
	// arrow step. A ref, not state: moving focus must not re-render.
	const rowRefs = useRef(new Map<string, HTMLTableRowElement>());
	// ROUND 4 item 8 — the two nodes the three-row window measures between.
	const bodyRef = useRef<HTMLDivElement | null>(null);
	const tableRef = useRef<HTMLTableElement | null>(null);
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

	// ⚠ THE SELECTION IS DERIVED AGAINST THE VISIBLE SET, NOT STORED AS TRUTH.
	// The mockup handles a selection that a filter has hidden by re-picking the
	// first remaining row (`refresh()`, `:571`); with no auto-select that answer
	// is unavailable, so a hidden selection simply stops counting and the panel
	// returns to the list. Derivation, not an effect: an effect would render one
	// frame with a selection that is no longer on screen.
	// ⚠⚠ PROFILE REFINEMENT · R3 — THE FIRST VISIBLE ROW IS THE FALLBACK, and this
	// ONE expression is the whole of R3. It covers every case the row names —
	// mount, filter change, and (once bookmarks mode exists) mode switch — because
	// all three are the same question: the stored pick is not in `visible`, so what
	// is selected? The answer is now "the first row that is" instead of "nothing".
	// ⛔ A DERIVATION, NOT AN EFFECT. An effect that watched `visible` and wrote
	// state would render one frame with the OLD selection — the empty rail this row
	// exists to remove, just one frame long — and would need its own guard against
	// looping. Falling back at read time cannot be out of date.
	// ⚠ THE EMPTY LIST FALLS OUT FOR FREE: `visible[0]` is `undefined`, so this is
	// `null` and the existing empty state renders. No phantom row, no crash — the
	// case R3 warns about is handled by the shape of the expression rather than by
	// a branch.
	const selectedRow =
		visible.find((r) => r.marketId === selectedMarketId) ?? visible[0] ?? null;

	// ROUND 4 item 7 — REPORT THE DERIVED SELECTION UPWARD. The deps are all
	// PRIMITIVES, never `selectedRow` itself: the row object is rebuilt on every
	// render, so depending on it would fire the effect every time and hand the
	// panel a new object it cannot compare.
	// ⚠ IT REPORTS THE DERIVED ROW, NOT THE STORED ID, which is what makes a
	// filtered-away pick stop counting on the OTHER side of the arena too — the
	// panel returns to the full list rather than showing an argument whose row is
	// no longer on screen.
	const pickedMarketId = selectedRow?.marketId ?? null;
	const pickedMarketTitle = selectedRow?.marketTitle ?? null;
	const pickedCommentId =
		selectedRow && !selectedRow.argument.removed
			? selectedRow.argument.commentId
			: null;
	useEffect(() => {
		if (pickedMarketId === null || pickedMarketTitle === null) {
			onSelect?.(null);
			return;
		}
		onSelect?.({
			marketId: pickedMarketId,
			marketTitle: pickedMarketTitle,
			commentId: pickedCommentId,
		});
	}, [pickedMarketId, pickedMarketTitle, pickedCommentId, onSelect]);

	// ⚠⚠ ROUND 4 item 8 — THE THREE-ROW WINDOW. Three rows fill the panel; the
	// rest scroll INSIDE it; the column-header row stays out of that scroll
	// (`<thead>` is `sticky top-0`, shipped at row 3).
	//
	// ⛔ THE MOCKUP'S CSS RULE CANNOT BE PORTED, AND THAT IS MEASURED. Its
	// `.rows .prow{flex:0 0 calc(100% / 3)}` (`:273`) works because `.colwrap`
	// has a DEFINITE height — the mockup's page is a fixed 100vh with
	// `overflow:hidden` on html/body. On this build `<main>` is
	// `max(floor, content)` by RULED A1, so the panel is CONTENT-sized: measured
	// at 1440, the arena is 1187 tall and the panel body 1135, so a one-third
	// flex-basis would render three rows at ~378px each. That is not the mockup's
	// look; it is a different defect.
	// ⇒ THE MECHANISM IS THE MOCKUP'S OWN EARLIER ONE, from its changelog rather
	// than its stylesheet: v0.11 — "the rows container is height-capped to
	// exactly the first three rows (JS measures the 3rd row's bottom) so the 4th
	// sits below the fold and the list scrolls. No row content is clipped."
	// v0.12 replaced it with the CSS thirds only because its panel was definite.
	// Ours is not, so v0.11's measurement is the faithful port.
	//
	// ⛔ THIS IS A BOUND, NOT A CLIP. `max-height` + the panel body's existing
	// `overflow-y-auto` means row four is REACHED BY SCROLLING, never lost — the
	// distinction RULED A1 draws and `profile-height-chain.test.ts` records: A1
	// governs the PAGE-level column so the page can grow and scroll; a
	// panel-scoped bound with a scroll container is the other scope.
	// ⛔ NO PIXEL IS INVENTED. The cap is read off the rendered third row and the
	// body's own computed padding; `ROW_WINDOW` is the founder's "three rows",
	// and the mockup's `calc(100%/3)` is the same three.
	// ⚠ IT GATES ON THE NODES HAVING A BOX. jsdom performs no layout and returns
	// zero rects, so the cap is simply not applied there — the render suite sees
	// the uncapped panel rather than a `max-height:0px` that would hide every row.
	// ⚠⚠ AND SINCE ROUND 5 IT GATES ON THE PAGE BEING FREE TO GROW — see the
	// second guard inside `measure()`. At `lg`+ the profile is a one-screen
	// layout (item A) and the panel's height comes from the viewport, so the
	// window would subtract from the list rather than bound it.
	useEqualRowThirds({
		bodyRef,
		tableRef,
		testidPrefix: "position-row-",
		rowWindow: ROW_WINDOW,
		rowCount: visible.length,
	});
	useEffect(() => {
		const body = bodyRef.current;
		const table = tableRef.current;
		if (body === null || table === null) {
			return;
		}
		/**
		 * ⚠⚠ PROFILE REFINEMENT · R1 — EVERY ROW IS ONE THIRD OF THE ROWS REGION.
		 *
		 * ⛔ THE RULE MOVED TO `row-thirds.ts` AND IS NOT RESTATED HERE. R1 names the
		 * POSITION rows, but the bookmark rows are their twin — same shell, and the
		 * mockup's bookmark mode reuses the very same `.prow`. MEASURED before it was
		 * shared: positions `[128, 128, 128]` against bookmarks `[136, 92]`. Two copies
		 * of the arithmetic would drift, so there is one. That module carries the
		 * measurement, why the mockup has no clamp, why the CSS form fails, and why it
		 * gates on the PAGE rather than on a breakpoint literal.
		 * ⚠ THE CAP HALF IS STILL LOCAL: a `<tr>` height is a FLOOR, so the clamp on the
		 * argument title in `ArgumentCell` is what stops a long argument outgrowing the
		 * third. Both halves are needed; only the equalising half is shared.
		 */
		const measure = () => {
			if (visible.length < ROW_WINDOW) {
				// Fewer rows than the window — nothing to window, and the panel goes
				// back to its natural height rather than keeping a stale cap.
				body.style.maxHeight = "";
				return;
			}
			// ⚠⚠ ROUND 5 item A — THE WINDOW NARROWS TO THE CASE THAT STILL NEEDS
			// IT. Round 4 built this cap because the page was free to grow, so the
			// panel had no definite height and would have run to N rows. Item A
			// bounds the page at `lg`+, which gives the panel a definite height
			// from the VIEWPORT — and a 3-row cap on top of that is no longer a
			// window, it is dead space: at 1440 × 1080 the arena gives the panel
			// 638px and the cap would slice it to 276, re-creating the very gap
			// item A was ruled in to close, against a founder instruction that
			// says "the list bigger".
			// ⇒ THE TEST IS THE PAGE, NOT A BREAKPOINT. Clear the cap, ask whether
			// the DOCUMENT can still scroll, and only window when it can. That is
			// exactly the condition the cap was built for, it needs no `1024`
			// literal, and it keeps round 4's mechanism alive below `lg` where the
			// page does still grow.
			body.style.maxHeight = "";
			const doc = document.documentElement;
			if (doc.scrollHeight <= doc.clientHeight + 1) {
				return;
			}
			const positionRows = table.querySelectorAll<HTMLTableRowElement>(
				'tbody > tr[data-testid^="position-row-"]',
			);
			const last = positionRows[ROW_WINDOW - 1];
			if (!last) {
				return;
			}
			const bodyBox = body.getBoundingClientRect();
			const lastBox = last.getBoundingClientRect();
			if (bodyBox.height === 0 || lastBox.height === 0) {
				return;
			}
			const padBottom =
				Number.parseFloat(getComputedStyle(body).paddingBottom) || 0;
			const next = `${Math.ceil(
				lastBox.bottom - bodyBox.top + body.scrollTop + padBottom,
			)}px`;
			// Write only on a real change: the observer below watches the table, and
			// capping the body can itself resize the table (a scrollbar re-wraps the
			// rows). Comparing first is what makes that converge instead of loop.
			if (body.style.maxHeight !== next) {
				body.style.maxHeight = next;
			}
		};
		measure();
		if (typeof ResizeObserver === "undefined") {
			return;
		}
		const observer = new ResizeObserver(measure);
		observer.observe(table);
		return () => observer.disconnect();
	}, [visible.length]);

	/** `pick(i)` (`:679`) — select a row.
	 *
	 * ⚠⚠ PROFILE REFINEMENT · R3 — THE TOGGLE IS RETIRED. It used to clear the
	 * selection on a second click, and the reason given was that "deselect is the
	 * way back to the full argument list". R3 removes that destination: the panel
	 * now always holds a selection, so clearing it would immediately re-derive to
	 * the first visible row — which makes a second click a silent no-op on row one
	 * and a jump-to-row-one everywhere else. That is worse than not offering it.
	 * ⛔ THE MOCKUP HAS NO DESELECT EITHER, for exactly this reason: it always holds
	 * one (`:679` sets `sel = i` unconditionally).
	 * ⚠ THE COST, NAMED: the UNFILTERED full argument list is no longer reachable
	 * from this panel, because it is no longer a state the panel can be in. That is
	 * an information change and it is the founder's call — R3 rules the rail must
	 * show a full post on load. The list is still what renders when a filter yields
	 * zero rows, and every argument remains reachable one row-click at a time. */
	const pick = (marketId: string) => {
		setSelectedMarketId(marketId);
	};

	/** `stepRow(dir)` (`:741-749`) — Up/Down step through the CURRENTLY VISIBLE
	 * (filtered) rows and WRAP, `(at + dir + len) % len`, entering at index 0
	 * from no selection (`at < 0 ? 0`). Both halves are the mockup's arithmetic.
	 * ⚠ `scrollIntoView({block:"nearest"})` is the mockup's, guarded exactly as
	 * the mockup guards it (`if (el && el.scrollIntoView)`) — jsdom implements no
	 * layout and defines no `scrollIntoView`, so the render suite would throw on
	 * an unguarded call. Focus moves with the selection so the next arrow keeps
	 * arriving at this handler; `preventScroll` because the line above has
	 * already done the scrolling, and more precisely. */
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
		setSelectedMarketId(target.marketId);
		const el = rowRefs.current.get(target.marketId);
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
			bodyRef={bodyRef}
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
						{/* ⚠⚠ FOUNDER EYE PASS item 2 — THE SELECTED HALF WAS INVISIBLE,
						    and the cause is worth stating because it looks like working
						    code. This pair was `variant={status === s ? "default" :
						    "outline"}`, and `ui/button.tsx:16-19` renders those TWO
						    VARIANTS IDENTICALLY — same `--btn-fill`, same hairline, same
						    ink text — under its own docblock: "One-button system
						    (values-log §3 item 3 / R-6): primary and outline render
						    identically". So the toggle carried a real `aria-pressed` and
						    a real state change with ZERO pixels of difference. A variant
						    swap can never express selection in this system.
						    ⇒ THE SELECTED STATE COMES FROM THE EMPHASIS LADDER INSTEAD.
						    `--ring-active` is rung 3 and is literally the token for this
						    (`globals.css:178`, `1.5px solid var(--color-n4)`); the shipped
						    consumption form is `[outline:var(--ring-active)]` at
						    `discovery/MarketCard.tsx:74`, reused verbatim here. Against
						    the unselected half's 1px `--hairline` (`globals.css:166`) that
						    is a thicker, brighter edge — unmistakable, and derived
						    entirely from shipped tokens.
						    ⛔ NOT THE MOCKUP'S BLACK-ON-WHITE (`.seg.on{background:
						    var(--ink); color:var(--n0)}`, `:257`). That is a VALUE from a
						    light-mode prototype, and porting it by name would render the
						    selected half near-WHITE in the shipped dark system — the exact
						    inversion `side-pole-binding` exists to prevent.
						    `text-ink` vs `text-n5` is the shipped emphasis pair already
						    used across this surface (`<thead>` is `text-n5`, values are
						    `text-ink`), so the label brightens with the edge. */}
						{(["Open", "Closed"] as const).map((s) => (
							<Button
								key={s}
								type="button"
								size="xs"
								variant="outline"
								data-testid={`positions-status-${s.toLowerCase()}`}
								aria-pressed={status === s}
								className={
									status === s
										? "[outline:var(--ring-active)] text-ink"
										: "text-n5"
								}
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
					ref={tableRef}
					// ⛔ THE KEY HANDLER IS SCOPED TO THE TABLE, NOT TO `document`.
					// The mockup binds `document.addEventListener('keydown', …)` with
					// `e.preventDefault()` (`:751-756`) — safe there because its
					// html/body are `overflow:hidden`, a fixed-viewport prototype
					// affordance recon A-5 STRUCK. On this build the page GROWS AND
					// SCROLLS (RULED A1), so a document-level ArrowDown that prevents
					// default would kill keyboard scrolling of the whole profile
					// route. Bound here, the keys are live exactly while focus is
					// inside the table — the BEHAVIOUR the mockup describes, without
					// the side effect its own page could not have.
					// ⚠⚠ AND SINCE PROFILE OVERLAP R4 IT IS NOT THE ONLY BINDING.
					// Scoping to the table is the reason ↑/↓ did nothing from a fresh
					// load: focus starts on `<body>`, so this handler never fired and
					// the stepper was unreachable without a click.
					// `useDocumentRowStepper` above adds the document arm — and the
					// objection this block raises is ANSWERED rather than overruled:
					// that arm stands down whenever `scrollHeight > clientHeight`, so
					// the keyboard scrolling of a growable route is never taken. ⛔ It
					// also stands down when the target is inside this table, which is
					// what keeps one press from stepping twice. This handler still owns
					// every press that arrives with focus already in here.
					onKeyDown={(e) => {
						if (e.key !== "ArrowUp" && e.key !== "ArrowDown") {
							return;
						}
						e.preventDefault();
						stepRow(e.key === "ArrowUp" ? -1 : 1);
					}}
					className="w-full table-fixed text-left text-sm"
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
					{/* HTML-FINISH row 3 — THE COLUMN-HEADER ROW STAYS OUT OF THE
					    SCROLL. The mockup puts `.thead` in `.colwrap` above the
					    scrolling `.rows` (`:466-470`); here the scroll container is
					    the panel body and the header is `sticky top-0`, so it never
					    scrolls away — the same observable, reached without splitting
					    the `<table>`.
					    ⛔ SPLITTING IT WOULD COST MORE THAN IT BUYS. Lifting `<thead>`
					    into a sibling of the scroll box means two tables, and two
					    tables do not share column widths — the header would drift off
					    its own cells at every viewport. The alternative, a div grid,
					    needs an explicit track template, and the only one available is
					    the mockup's `96px 1fr 78px 16px 118px` (`:262`) — five
					    light-prototype VALUES the VALUE RULE forbids. Sticky keeps the
					    real `<table>`, its column algorithm, and its semantics.
					    `bg-n0` is the panel's own background, already on the section —
					    a sticky header over scrolling rows must be opaque or the rows
					    read through it.
					    ⚠⚠ AND OPAQUE IS NOT ENOUGH — PROFILE OVERLAP R1. Chrome resolves a
					    sticky `top:0` against the scroll container's CONTENT box, so the
					    container's own `p-3` leaves 12px of SCROLLABLE space above the
					    header that the header does not cover. Rows scroll into that strip
					    and appear ABOVE the column titles, inside the panel frame — measured
					    on staging (body top 331, header top 343) and confirmed by paint, not
					    by reasoning about paint: a zoom of the strip showed the selected
					    row's rounded top edge sitting over it.
					    ⇒ The shadow is the header claiming that strip. Zero blur, zero
					    spread, offset up by exactly the padding — a copy of its own opaque
					    box, and because the header is `sticky z-10` it paints above the
					    plain rows. ⛔ THE OFFSET IS BOUND TO THE PADDING BY TOKEN, never
					    typed as 12px: both are `var(--spacing) * 3`, so `p-3` and this move
					    together or a guard fails.
					    ⛔ NOT FIXED BY SHRINKING THE PADDING or by `overflow:hidden` — the
					    first changes the region's arithmetic, the second clips a row out of
					    a participant's own portfolio. */}
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
						{visible.map((row, index) => {
							const sellable = sellEligibleOf(row);
							const sellOpen = sellMarketId === row.marketId;
							// PROFILE-FULL — the row's own P/L, in DISPLAYED space so it
							// agrees with the two figures printed beside it.
							const pl = displayPositionProfitLossSigned(
								row.staked,
								row.current,
							);
							const isSelected = selectedRow?.marketId === row.marketId;
							return (
								<Fragment key={row.marketId}>
									{/* ⚠⚠ ROUND 4 items 5 + 6 — THE ROW IS A BORDERED, SELECTABLE
									    CARD. The mockup's `.rows` is a bordered rounded box whose
									    `.prow`s are separated by hairlines (`:270-275`), and the
									    selected one is picked out by `.prow.sel` (`:277`:
									    `outline:2px solid var(--ink); outline-offset:-2px;
									    border-radius:var(--r); background:var(--n1)`).
									    ⛔ NOT ONE VALUE OF THAT IS PORTED. `--ink` is #fafafa in
									    the shipped dark system — a near-WHITE 2px outline, the
									    exact inversion `side-pole-binding` exists to prevent — and
									    `--n1` is the light prototype's SECOND-BRIGHTEST step while
									    the shipped `n1` is the second-DARKEST. What is ported is
									    the COMPOSITION: a heavier, brighter edge plus a distinct
									    fill.
									      unselected  `[border:var(--hairline)]`  1px n2 — the
									                  shipped rung 1, this file's own panel edge
									      selected    `[border:var(--ring-active)]` 1.5px n4 — the
									                  shipped rung 3, `globals.css:178`, the SAME
									                  token item 2 used for the selected filter half
									                  and `discovery/MarketCard.tsx:74` for a picked
									                  card
									      fill        `bg-n1` — the shipped raised surface already on
									                  this file's `PopoverOption` hover
									    ⚠ THE HEAVIER BORDER WINS BY THE COLLAPSING MODEL, and that
									    is measured, not assumed: Tailwind's preflight sets
									    `border-collapse:collapse` (verified in a browser against
									    the compiled CSS), under which adjacent row borders merge
									    into one and conflict resolution picks the WIDER — so the
									    selected row's 1.5px edge reads unbroken against its
									    neighbours' 1px. It is also why the two border classes are
									    written as one conditional and never both: two arbitrary
									    `[border:…]` utilities on one element resolve by stylesheet
									    order, not by the order they are written here.
									    ⛔ THE ROWS BOX TAKES NO `rounded-[var(--r)]`: the collapsing
									    model ignores `border-radius`, so declaring it would be a
									    class that does nothing. Square corners on the rows run are
									    the cost of keeping a real `<table>` — and row 3 already
									    recorded why the table stays (two grids cannot share column
									    widths without the mockup's five px tracks).

									    ⚠⚠ PROFILE REFINEMENT · R6 — BUT THE SELECTED ROW IS NOT SQUARE ANY
									    MORE, AND THE PARAGRAPH ABOVE IS WHY IT WAS. That reasoning is sound
									    about `border-radius` under `border-collapse:collapse` and it still
									    stands — what it missed is that the MOCKUP never used a border here.
									    `.prow.sel` is `outline:2px solid var(--ink); outline-offset:-2px;
									    border-radius:var(--r)` (`:277`) — an OUTLINE, and an outline is painted
									    by the element itself rather than by the collapsing border model, so it
									    honours `border-radius` on a `<tr>`.
									    ⇒ MEASURED, NOT REASONED: with the outline applied the row reports
									    `borderRadius: 8px` — the `--r` token's own value — and the rounded edge
									    was confirmed in PIXELS at a pinned 1440×777, not merely in a computed
									    style.
									    ⇒ SO THE COMPOSITION SPLITS THE WAY THE MOCKUP SPLITS IT: every row keeps
									    `[border:var(--hairline)]` (the mockup's `.prow` hairline, always there),
									    and the SELECTED row ADDS outline + `-2px` offset + radius on top (the
									    mockup's `.prow.sel` ADDS, never swaps). The previous build SWAPPED the
									    border for a heavier one, which is exactly why the radius had nowhere to
									    land — the collapsing model owned the only edge it could have rounded.
									    ⛔ STILL NOT ONE MOCKUP VALUE. The outline takes the shipped
									    `--ring-active` rung (1.5px n4) exactly as the swapped border did, and
									    the radius takes `--r` — the token every other rectangle on this surface
									    already uses, which is what R6 asked for. The mockup's 2px `--ink`
									    outline is NOT ported: `--ink` is #fafafa here, a near-white edge, the
									    inversion `side-pole-binding` exists to prevent.
									    ⚠ `outline-none` MOVED INTO THE UNSELECTED ARM rather than staying on the
									    base. It suppresses the UA focus ring so
									    `focus-visible:shadow-(--state-focus-ring)` is the only focus affordance —
									    but on the base it is a second `outline` declaration competing with the
									    selected arm's, and two arbitrary utilities for one property resolve by
									    stylesheet order, not by the order they are written here.
									    ⚠ A ROW OWNS NO SELL HOST BORDER. The 50px sell box below is
									    deliberately unbordered. ⚠ Its ORIGINAL reason is now void — it
									    read "bordering an empty reserved band would draw an empty card
									    under every sellable row", and there is no empty band left to
									    border: the host mounts only with its module. The rule SURVIVES on
									    a different one: a bordered host would read as a row of its own,
									    and the module inside it already carries its own edges.
									    ⚠⚠ PROFILE OVERLAP · R1 — THE ROW'S OWN EDGE IS NOW AN OUTLINE,
									    AND THE BORDER IS GONE. A sweep of both surfaces for closed boxes
									    found exactly THREE sharp ones and they were all this element:
									    every unselected row measured `border-radius 0/0/0/0` with a full
									    `1/1/1/1` hairline, inside a panel at 8, beside tiles at 8, next to
									    a SELECTED row at 8 — a square block containing a rounded SELL
									    button and a rounded status tag. That is the "reads wrong against
									    its own contents" the founder measured.
									    ⛔ AND A RADIUS ALONE COULD NOT FIX IT, which was measured before
									    anything was written. `border-radius: 8px` was injected on a live
									    unselected row and the corners stayed SQUARE: the collapsing model
									    ignores `border-radius`, so the computed style reads `8px` while the
									    paint is a rectangle. That is the trap this branch has now hit four
									    times — a computed style confirms a declaration EXISTS; only
									    geometry confirms it WON.
									    ⇒ THE MOCKUP'S OWN IDIOM IS THE FIX, and R1 authorises it in as
									    many words ("if it outlines rather than borders, port that"):
									    `.prow.sel` picks its row out with an OUTLINE, which the element
									    paints itself and which therefore honours the radius. So the
									    unselected arm takes the hairline as an outline at `-1px` offset,
									    the selected arm keeps `--ring-active` at `-2px`, and the base
									    carries the radius for both. Injected on all three live rows and
									    zoomed: rounded, and heights unchanged at `[128, 128, 128]` with the
									    region still at 0 overflow — an outline takes no layout space.
									    ⛔ ONE OUTLINE PER ARM, NEVER TWO ON THE ELEMENT. `[outline:…]`
									    twice would be two arbitrary utilities for one property resolving by
									    STYLESHEET EMISSION ORDER rather than by the order written here —
									    the failure that shipped an inert `line-clamp` one pass ago. Both
									    live inside the ternary, so exactly one is ever present.
									    ⚠ `outline-none` IS RETIRED WITH THE BORDER and its job is done by
									    what replaced it: it existed only to suppress the UA `:focus-visible`
									    ring, and any AUTHOR outline declaration beats a UA-origin one by
									    cascade origin. The focus affordance is unchanged — it was never the
									    outline, it is `focus-visible:shadow-(--state-focus-ring)`.
									    ⚠ WHAT IS GIVEN UP: under the collapsing model adjacent rows shared
									    one merged hairline; each row now draws its own. The mockup frames
									    the REGION and divides the rows, where this build frames each row —
									    a divergence that predates R1 and that R1 does not name. */}
									<tr
										data-testid={`position-row-${row.marketId}`}
										ref={(el) => {
											if (el) {
												rowRefs.current.set(row.marketId, el);
											} else {
												rowRefs.current.delete(row.marketId);
											}
										}}
										// ⚠ `aria-current`, NOT `aria-selected`, AND THAT IS A BLOCKED
										// ROUTE RATHER THAN A PREFERENCE. `aria-selected` is only
										// defined inside a grid or a listbox — this file's own
										// `PopoverOption` uses it exactly that way — but Biome's
										// a11y rule rejects `role="grid"` on a `<table>` as
										// redundant, and disabling a Biome rule is an ask-first
										// decision (AGENTS.md §11), not something to take in
										// passing. `aria-current` is valid on ANY element and says
										// precisely this: the current item within a set. The
										// selection is announced either way.
										aria-current={isSelected ? "true" : undefined}
										// Roving tabindex: one tab stop for the whole table, on the
										// selected row — or on the first row when nothing is
										// selected, so the keys are reachable without a click.
										tabIndex={
											isSelected || (selectedRow === null && index === 0)
												? 0
												: -1
										}
										onClick={(e) => {
											// The row's own children stay clickable: the title and
											// market links navigate, Sell opens its module. The
											// mockup reaches this with `event.stopPropagation()` on
											// each child (`:548`); one `closest` here covers every
											// child without threading a handler through them.
											if ((e.target as HTMLElement).closest("a,button")) {
												return;
											}
											pick(row.marketId);
										}}
										onKeyDown={(e) => {
											if (e.key === "Enter" || e.key === " ") {
												e.preventDefault();
												pick(row.marketId);
											}
										}}
										className={`cursor-pointer rounded-(--r) focus-visible:shadow-(--state-focus-ring) ${
											isSelected
												? "bg-n1 [outline-offset:-2px] [outline:var(--ring-active)]"
												: "[outline-offset:-1px] [outline:var(--hairline)] hover:bg-n1"
										}`}
									>
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
													// ⚠ PROFILE-FULL — `.pside` is 11px/800 (`:283`); this was
													// `text-xs` at weight 400, so the SIDE — the one word that
													// says which pole this holding is on — was the lightest
													// thing in its own cell.
													className="flex items-center gap-[5px] text-[11px] leading-[1.2] font-extrabold"
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
												{/* ⚠⚠ PROFILE-FULL — SELL TAKES BUTTON SHAPE. The mockup's
												    `.sellbtn` is the most prominent control on the surface:
												    `font-size:11.5px; font-weight:800; letter-spacing:.1em;
												    text-transform:uppercase; padding:9px 22px; border:1.5px
												    solid var(--ink)`, and it INVERTS on hover
												    (`:301-304`) — measured 80×34. This shipped as
												    `size="xs" variant="outline"`, measured 39×24 at
												    12px/500: a third of the area, in the same register as
												    the `Open` badge above it, so the one destructive-ish
												    action in the row was the quietest thing in it.
												    ⛔ `size="xs"` IS DROPPED, NOT OVERRIDDEN. That size sets
												    `h-6`, `px-2`, `text-xs` and its own radius — four
												    properties this needs to restate, and `h-6` against
												    explicit padding is a same-property fight whose winner is
												    emission order. Passing NO size uses the default and
												    overrides its box outright.
												    ⚠ THE BORDER IS THE EMPHASIS LADDER'S, NOT A LITERAL. The
												    mockup's `1.5px solid var(--ink)` maps to the shipped
												    `--ring-active` rung (1.5px solid n4, PRIMITIVES-2 D9) —
												    a ratified composite over a ramp token, so no new width
												    and no new colour is introduced. `--btn-fill` and
												    `--state-hover-fill` keep the one-button system's own
												    interior and hover, which is what the dark ramp inverts
												    to instead of the prototype's ink-on-white flip.
												    ⚠ `uppercase` is a transform, so the accessible name and
												    every `textContent` read of this trigger are still
												    `Sell`. */}
												{sellable && (
													<Button
														type="button"
														variant="outline"
														className="h-auto rounded-(--r) px-[22px] py-[9px] text-[11.5px] leading-[1.2] font-extrabold tracking-[0.1em] uppercase [border:var(--ring-active)]"
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
										    alignment survives if the inner span is ever unwrapped.
										    ⚠⚠ ROUND 5 item D — THE GLYPH. These two cells printed bare
										    digits (`25 → 25`, `280 → 267`) beside five tiles and four
										    argument-head figures that all carried Đ, so the one place
										    on the surface where two Đ quantities sit side by side was
										    the one place that did not say so. The mockup reads
										    `Đ 240 → Đ 310` (`:556`, `:558`).
										    ⛔ BYTE-CARRIED, NOT TYPED — `c4 90`, U+0110, hexdumped from
										    `ProfileTiles.tsx`'s shipped `Đ {formatDharma(…)}`, and the
										    SAME spacing (glyph, space, formatted number).
										    ⛔ `formatDharma` IS UNTOUCHED — the glyph is a sibling text
										    node, exactly as at every other site, so
										    `no-raw-dharma-render` sees the same wrapped call it saw
										    before.
										    ⚠ THE SWEEP WAS WHOLE, and it found exactly these two: every
										    other `formatDharma` render on this surface
										    (`ProfileTiles` ×4 + the signed Net P/L, `ArgumentList`'s
										    author stake and the split bar's three) already carried the
										    glyph. `SellModule` carries its own at `:268`/`:284` and is
										    read-only this round. Two sites, both changed here — a
										    half-applied glyph is the round-3 defect. */}
										<td className="p-2 text-center whitespace-nowrap tabular-nums text-ink">
											<span className="flex flex-col items-center">
												Đ {formatDharma(row.staked)}
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
										{/* ⚠⚠ PROFILE-FULL — THE CURRENT CELL CARRIES ITS P/L DELTA. The
										    mockup's Current cell is `Đ 310 (+Đ70)` — a `.val` row holding
										    the figure and a smaller `.pl` span (`:299-300`, emitted at
										    `:558`), and its own changelog says why: v0.18, "current value
										    shows profit". Without it the row states two numbers and leaves
										    the only question a holder actually has — am I up or down —
										    to be done in the reader's head, on every row.
										    ⛔ DERIVED IN DISPLAYED SPACE BY A FORMATTER, not subtracted
										    here. `displayPositionProfitLossSigned` rounds both operands to
										    what this row PRINTS before subtracting, so the three figures
										    on screen stay self-consistent — an exact-space delta would
										    render `Đ 499 → Đ 448 (−Đ50)` where the eye can only compute
										    51. See that function for the §10.8 reasoning.
										    ⛔ NO NEW SERVER FIELD: `staked` and `current` are both already
										    on `ProfilePositionRow`, so this is a render of data the DTO
										    carries — unlike the entry/live percentages recorded below,
										    which it does not.
										    ⚠⚠ THE SPACING IS NOW UNIFORM, AND THIS CLAUSE ARGUED THE
										    OPPOSITE. It read: "`plShort` emits `+Đ70` with no space
										    (`:677`) while the Net P/L tile reads `+Đ 238` with one
										    (`:672`) … the difference is deliberate density on a smaller
										    figure." Both halves were byte-carried faithfully and the
										    conclusion was still wrong here, which is the interesting part:
										    two densities are defensible when the two figures sit in
										    different REGIONS, and this one sits inside the very cell whose
										    own figure carries the space — `Đ 151 (+Đ1)` puts the same
										    glyph on two densities two characters apart. Founder-ruled at
										    POSREV-1 RF-4: always a space after Đ, this surface over.
										    ⛔ THE SIGN LOGIC IS UNTOUCHED, AND THAT IS DELIBERATE. RF-4's
										    targets are `+Đ 1` / `−Đ 1` / `Đ 0`, and
										    `displayPositionProfitLossSigned` already emits exactly those —
										    zero carries no sign, decided by `isZero()` on the numeric value
										    rather than by inspecting a printed string (§10.8). Only the
										    space was ever missing; the formatter needed nothing.
										    ⚠ AN EMPTY MAGNITUDE RENDERS NOTHING — the formatter's degrade
										    for a malformed operand. A parenthesis pair with nothing in it
										    is worse than silence. */}
										<td className="p-2 text-center whitespace-nowrap tabular-nums text-ink">
											<span className="flex flex-col items-center">
												<span className="inline-flex items-baseline gap-1.5">
													Đ {formatDharma(row.current)}
													{pl.magnitude !== "" && (
														<span
															data-testid={`position-pl-${row.marketId}`}
															className="text-[10.5px] leading-[1.2] font-bold text-n5"
														>
															({pl.sign}Đ {pl.magnitude})
														</span>
													)}
												</span>
											</span>
										</td>
									</tr>
									{/* THE SELL HOST — canon §5's fixed 50 px box, PRESENT ONLY WHILE THE
									    MODULE IS IN IT. Its `.26s` fade and its JS toggle are unchanged.
									    ⛔⛔ THE RESERVATION IS REVERSED, AND THE CANON ENTRY MOVES WITH IT
									    (`design-canon.md` §5 Profile, this commit — O-5: the correction is
									    written INTO the operative sentence, never appended under it).
									    Canon read "a fixed 50 px host is RESERVED under each sellable positions
									    row … fixed height ⇒ never reflows", and the block that stood here
									    defended the reservation as "deliberate anti-reflow behaviour". Both also
									    RECORDED its cost — "the reserved box is BLANK when closed, so an owner
									    sees an empty band under every sellable row" — raised for the founder and
									    carried unabsorbed across two passes. The founder has now measured that
									    band and ruled it out.
									    ⚠ AND THE ARITHMETIC MADE IT UNSURVIVABLE, which is the half no review
									    caught. The three-row window divides the region by the DATA rows only, so a
									    reserved band is invisible to the divisor while spending 51px of what it
									    divides. MEASURED on staging, owner arm, pinned 1440×777: region 429 − 24
									    padding − 19 thead = **386** available against a table of 3 × (128 + 51) =
									    **537** ⇒ **150px of overflow**, and the surplus scrolls a row up behind
									    the sticky header. The mockup at the same pinned size: `.rows` 385, three
									    rows 128, **gap 0**, sum 384 — it fits because it has no such band. Three
									    rows and a per-row reservation cannot both fit; the founder ruled which goes.
									    ⚠ WHAT IS GIVEN UP, stated rather than glossed: opening Sell now inserts
									    51px and the rows below it move down. ⛔ NOTHING IS LOST — the panel body is
									    the scroll container, so that is a BOUND, NOT A CLIP, the same distinction
									    the window's own docblock draws two hundred lines up.
									    ⇒ AND THE MOCKUP HAS NO HOST AT ALL: `.rows{gap:0}` with `.prow` adjacent
									    hairlines and the SELL button inside the row's own `.poscell` (`:305-308`).
									    Present-only-while-open is the closest reachable port of that.
									    ⛔ `:has()` is still banned (canon §3 item 10) — the toggle stays JS state.
									    ⛔ Still no host on a non-sellable row. */}
									{/* LOTS-1 / ADR-0039 — the per-argument decomposition of THIS
									    holding, under the row it decomposes.
									    ⚠ SELECTED ROW ONLY. Every row carries its lots in the
									    payload, but rendering all of them at once would bury the
									    table under its own detail; the selected row is already the
									    one whose argument the panel beside it is showing, so this
									    keeps the reader's attention in one place.
									    ⛔ The gate is `isSelected`, NOT `sellable` — a VISITOR sees
									    the decomposition too. §23's owner-vs-visitor payload law
									    makes the record public; only the affordance is owner-only,
									    which is why `sellable` is passed down rather than tested
									    here. */}
									{isSelected && row.lots.length > 0 && (
										<tr data-testid={`lots-row-${row.marketId}`}>
											<td colSpan={5} className="px-2 py-0">
												<LotBreakdown
													marketId={row.marketId}
													lots={row.lots}
													sellable={sellable}
												/>
											</td>
										</tr>
									)}
									{sellable && sellOpen && (
										<tr data-testid={`sell-row-${row.marketId}`}>
											<td colSpan={5} className="px-2 py-0">
												<div
													data-testid={`sell-host-${row.marketId}`}
													className="h-[50px]"
												>
													{/* The `.26s` fade now plays on MOUNT rather than on an inner reveal: the
													    host arrives with the module, so the enclosing `sellOpen` test that used
													    to sit here is provably true and goes with the reservation. */}
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
	bodyRef,
	children,
}: {
	/**
	 * ⚠ PROFILE REFINEMENT · R5 — THE `owner` PROP IS GONE WITH THE CHIP. It
	 * existed for exactly one reason: the chip had to render on BOTH arms,
	 * including the empty-rows arm that mounts this panel with no `controls` at
	 * all. With the chip deleted this panel makes no owner/visitor distinction of
	 * its own, so carrying the flag would be a prop nothing reads — and a prop
	 * nothing reads is the next reader's false lead.
	 * ⛔ `payload.owner` IS UNTOUCHED in the component above: it still gates
	 * `sellEligibleOf` and still picks the empty-state copy. The viewer context is
	 * not what was removed; one render of it was.
	 */
	controls?: React.ReactNode;
	/**
	 * ROUND 4 item 8 — the scroll container the three-row window caps. It lives
	 * here and is measured there, so the ref is handed down rather than the
	 * measurement moved up: the panel owns the box, the table owns the rows, and
	 * the effect needs both.
	 */
	bodyRef?: React.Ref<HTMLDivElement>;
	children: React.ReactNode;
}): React.JSX.Element {
	return (
		<section
			data-testid="positions-panel"
			aria-label="Positions"
			// HTML-FINISH row 3 / §4 — `min-h-0` so the panel can be SHORTER than
			// its content, which is what makes the body below scroll instead of
			// the panel growing. As a grid item it already stretches to the arena
			// row's height; `min-h-0` is what lets that height actually bind.
			className="flex min-h-0 flex-col overflow-hidden rounded-[var(--r)] bg-n0 [border:var(--hairline)]"
		>
			{/* `relative` is the row-7a popover's POSITIONING CONTEXT, and it lives
			    here rather than on the trigger — see the ⛔ at the trigger for the
			    measurement that moved it. The mockup's `.colhead` is
			    `position:relative` for exactly this reason (`:227`). */}
			{/* ⚠ `min-h-[52px]` — the mockup's `.colhead{min-height:52px}` (`:228`),
			    landed on all four panel heads in one commit so the two side-by-side
			    bodies start level. Measured 51 here against the arguments head's 41
			    at a pinned 1440×777, in BOTH auth states. It can only GROW a head,
			    never clip one. Full measurement on `ArgumentList.tsx`'s copy. */}
			<div
				data-testid="positions-panel-head"
				className="relative flex min-h-[52px] flex-wrap items-center gap-2 p-3 [border-bottom:var(--hairline)]"
			>
				{/* ⚠⚠ PROFILE-FULL — THE PANEL TITLE IS `.chttl`'s OVERLINE. The mockup's
				    left colhead title is `font-size:11px; font-weight:800;
				    letter-spacing:.12em; text-transform:uppercase` (`:235`); this shipped
				    at `text-xs font-medium` in sentence case, which made the panel's NAME
				    look like the first line of its content.
				    ⛔ NOT THE SAME REGISTER AS THE RIGHT HEAD, deliberately. The mockup
				    gives the right colhead `.chttl.mkt` — 13px/700, `text-transform:none`
				    (`:229-231`) — because that slot holds a market QUESTION, a sentence,
				    not a label. Two heads, two registers, and flattening them into one
				    would lose the distinction the mockup is drawing.
				    ⛔ `uppercase` IS A TRANSFORM: `textContent` is still `Positions`, so
				    every consumer that reads this head by text keeps its handle. */}
				<span className="text-[11px] leading-[1.2] font-extrabold tracking-[0.12em] text-ink uppercase">
					Positions
				</span>
				{/* ⚠⚠ PROFILE REFINEMENT · R5 — THE `VIEWING AS OWNER` CHIP IS DELETED,
				    NOT HIDDEN. Founder-ruled out. It shipped in the round immediately
				    before this one, moved here out of the identity body because it was
				    costing that band 24px — and the founder has now ruled the chip itself
				    out, which supersedes the placement argument entirely rather than
				    relocating it again. The whole `<span>`, its testid and its copy
				    reference are gone from the tree; `display:none` would leave a node for
				    a scan to find and a reader to wonder about.
				    ⛔ NOTHING ELSE KEYED OFF IT, and that was checked rather than assumed:
				    the only reader was `surface.test.tsx`, which asserted the chip TEXT as
				    the proxy for "the owner arm rendered". That assertion is re-pointed at
				    the viewer context itself — `payload.owner`, through the empty-state
				    copy which is the other thing that branch decides — so the owner/visitor
				    distinction is still guarded, by the value rather than by a chip.
				    ⚠ `PROFILE_COPY.chip` is left in `copy.ts` UNTOUCHED: it is web-authored
				    string data, this row removes a render and not a ratified string, and
				    the copy is not what was removed. ⇒ Deleting it would be a second,
				    unasked decision.
				    ⚠ THE OTHER HALF OF THAT SENTENCE IS NOW STALE AND IS CORRECTED HERE: it
				    read "`/bookmarks` still renders its own `bookmarks-view-chip` (which R5
				    does not name)". PROFILE OVERLAP R3 names it and deletes it, so neither
				    surface carries a view chip. The reasoning for leaving `PROFILE_COPY.chip`
				    in place is untouched — it never depended on the twin existing. */}
				{controls}
			</div>
			{/* HTML-FINISH row 3 — THE PANEL-SCOPED SCROLL. `flex-1 min-h-0
			    overflow-y-auto` is the mockup's `.colwrap{flex:1 1 auto;
			    min-height:0; overflow-y:auto}` (`:258-259`), topology throughout.
			    ⚠ PANEL-SCOPED, NEVER VIEWPORT-SCOPED (recon A-5): the rows scroll
			    inside this box; the page itself still grows and scrolls when
			    content that CANNOT scroll exceeds the viewport. The mockup's
			    `overflow:hidden` on html/body was struck as a fixed-viewport
			    prototype affordance and is not adopted anywhere. */}
			<div
				data-testid="positions-panel-body"
				className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3"
				ref={bodyRef}
			>
				{children}
			</div>
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
	// ⚠⚠ PROFILE-FULL — THE SUB-LINE TAKES `.pmkt .mq`'s TYPE. The block above says
	// "Nothing is read off the mockup's `.pmkt .mq`, whose 11px / `--n5` are
	// light-prototype VALUES" — that was true under the geometry fence, which
	// excluded type size. §1 now puts TYPE SIZE explicitly in scope, so the 11px and
	// the 600 weight are taken: `font-size:11px; font-weight:600; line-height:1.35`
	// (`:291-292`).
	// ⛔ THE COLOUR IS NOT TAKEN AND THE OLD CAUTION STILL STANDS FOR IT. The
	// mockup's `--n5` is a mid-grey in an INVERTED light ramp; this build's `text-n5`
	// is the dark system's own muted rung and was already correct. Size and weight
	// are geometry; colour binds to the ramp, never to a prototype hex (§1).
	// ⚠ STILL BYTE-MATCHED to the "Replied to …" sub-line and the removed stub below
	// — same file, same role, one register for all three muted sub-lines.
	const marketLine = (
		<Link
			data-testid={`position-market-${marketId}`}
			href={`/m/${cell.marketSlug}`}
			className="block text-[11px] leading-[1.35] font-semibold text-n5 hover:underline"
		>
			{marketTitle}
		</Link>
	);
	if (cell.removed) {
		return (
			<span data-testid={`position-arg-removed-${marketId}`}>
				<span className="text-[11px] leading-[1.35] font-semibold text-n5 italic">
					{REMOVED_STUB_TEXT}
				</span>
				{marketLine}
			</span>
		);
	}
	// The title is the click target (canon §1d) — the §9 deep-link to the post's
	// ordinal (a reply opener carries its PARENT's ordinal, server-resolved).
	return (
		<span data-testid={`position-arg-${marketId}`} className="text-ink">
			{/* ⚠⚠ PROFILE-FULL — `.ptitle` IS 14px/700/1.35 (`:288`), and the mockup's
			    own changelog calls it "the D4/D5 card-title rule exactly" (v0.7). It
			    inherited the table's `text-sm` at weight 400, so the argument — the
			    thing the row is ABOUT — was set lighter than the Đ figures beside it.
			    ⚠ 14px is what it already resolved to; the WEIGHT is the change. */}
			{/* ⚠⚠ PROFILE REFINEMENT · R1 — `line-clamp-4` IS THE OTHER HALF OF THE
			    EQUAL-HEIGHT RULE, and it is DERIVED rather than chosen. A `<tr>`'s
			    `height` is a FLOOR — it cannot cap content — so the third computed in
			    `PositionsTable`'s effect equalises rows only while no argument outgrows
			    it. This is what stops one from doing so.
			    ⇒ THE BUDGET COMES OUT OF THE THIRD, NOT OFF THE MOCKUP. Measured on
			    staging: a row with a 3-line title is 95px, so the cell's non-title
			    content (padding + the market sub-line) is 95 − 58 = 37px. Against the
			    128px third that leaves 91px of title, and at this element's own
			    computed 18.9px line box that is 4.8 lines ⇒ **4**.
			    ⚠ AND THE MOCKUP AGREES, WHICH IS WHY THIS IS A PORT AND NOT A GUESS:
			    its own longest `.ptitle` renders at exactly **4 lines** inside its
			    128px row (measured — 3, 2 and 4 lines across its three rows, all
			    unclamped). The mockup declares no clamp because its dummy copy never
			    needs one; real data does, and 4 is the line count its own geometry
			    accommodates.
			    ⛔ NOT 2, WHICH IS THE OTHER NUMBER IN THE FILE. The mockup declares
			    `-webkit-line-clamp:2` on three OTHER nodes (`.rtitle .tx` `:345`,
			    `.chttl.mkt` `:231`, `.parline` `:376`) and reaching for it here because
			    it is the value that happens to be written down would DROP two lines the
			    mockup visibly shows — smaller than the thing being copied, which is the
			    opposite of a faithful port.
			    ⚠ NOTHING IS LOST THAT WAS NOT ALREADY BOUNDED: the full argument stays
			    one click away — the title is a link to its thread — and the row was
			    never the place a whole argument was read. */}
			<Link
				href={`/m/${cell.marketSlug}?post=${cell.postOrdinal}`}
				className="line-clamp-4 text-[14px] leading-[1.35] font-bold hover:underline"
			>
				{cell.title}
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
			{cell.isReply && cell.repliedToTitle !== null && (
				<span className="line-clamp-2 text-[11px] leading-[1.35] font-semibold text-n5">
					Replied to {cell.repliedToTitle}
				</span>
			)}
		</span>
	);
}
