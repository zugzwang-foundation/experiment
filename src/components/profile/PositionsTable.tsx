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
import type { ProfileSelection } from "./selection";

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
	// ⚠ ROUND 4 item 5 — THE SELECTED ROW. The mockup keeps this in one module
	// variable (`var sel = -1`, `:536`) and every path goes through `pick()`
	// (`:679`); here it is one more piece of the state this component already
	// holds, keyed by `marketId` rather than by INDEX. The mockup can use an
	// index because its row array never changes; ours is re-filtered by two
	// controls, so an index would silently point at a different row the moment a
	// filter moved.
	// ⛔ IT STARTS AT NULL, NOT AT THE FIRST ROW. The mockup auto-selects
	// (`refresh()`, `:571` — "the replica always shows an argument"); the founder
	// ruled the opposite for this build — the full argument list IS the empty
	// state — so nothing is selected until the reader picks.
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
	const selectedRow =
		visible.find((r) => r.marketId === selectedMarketId) ?? null;

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
	useEffect(() => {
		const body = bodyRef.current;
		const table = tableRef.current;
		if (body === null || table === null) {
			return;
		}
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

	/** `pick(i)` (`:679`) — click the selected row again to clear it. The mockup
	 * has no deselect because it always holds one; here deselect is the way back
	 * to the full argument list, so the click TOGGLES. */
	const pick = (marketId: string) => {
		setSelectedMarketId((current) => (current === marketId ? null : marketId));
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
		const at = visible.findIndex((r) => r.marketId === selectedMarketId);
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

	// Item 8 (P5-D11) — the empty adopts W2.11 P1 at ONE message tier (D3(a)).
	// The testid moves onto the leaf's MESSAGE NODE, so a `textContent` read
	// still returns exactly this string; no `sub` is passed on this surface.
	if (rows.length === 0) {
		return (
			<PositionsPanel owner={owner}>
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
			owner={owner}
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
					onKeyDown={(e) => {
						if (e.key !== "ArrowUp" && e.key !== "ArrowDown") {
							return;
						}
						e.preventDefault();
						stepRow(e.key === "ArrowUp" ? -1 : 1);
					}}
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
					    read through it. */}
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
						{visible.map((row, index) => {
							const sellable = sellEligibleOf(row);
							const sellOpen = sellMarketId === row.marketId;
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
									    ⚠ A ROW OWNS NO SELL HOST BORDER. The reserved 50px sell box
									    below is deliberately unbordered — bordering an empty
									    reserved band would draw an empty card under every sellable
									    row. */}
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
										className={`cursor-pointer outline-none focus-visible:shadow-(--state-focus-ring) ${
											isSelected
												? "bg-n1 [border:var(--ring-active)]"
												: "[border:var(--hairline)] hover:bg-n1"
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
										<td className="p-2 text-center tabular-nums text-ink">
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
										<td className="p-2 text-center tabular-nums text-ink">
											<span className="flex flex-col items-center">
												Đ {formatDharma(row.current)}
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
									{/* ⚠⚠ R-1 — THE RESERVED BAND COSTS CANON'S 50px, NOT 67.
									    Founder-ruled after a PROFILE-DIMS R2 §2b measurement: the
									    positions table measured **242 signed-out against 500
									    signed-in** at a pinned 1440×777, because this reserved row
									    renders only on the owner arm and cost 67px × 3.
									    ⛔ THE HOST WAS NEVER WRONG — `h-[50px]` below is canon §5's
									    "fixed 50 px box" and measured exactly 50. The overshoot was
									    THIS CELL: `p-2` added 8px top + 8px bottom, and the row's
									    hairline 1px, so the `<tr>` came to 50 + 16 + 1 = **67**.
									    ⇒ `px-2 py-0`: the horizontal inset is KEPT (it is what the
									    open sell module sits inside), the vertical padding goes, and
									    the row becomes 50 + 1 = **51**.
									    ⛔ THE RESERVATION ITSELF IS UNTOUCHED, AND THAT IS THE WHOLE
									    FENCE. It is deliberate anti-reflow behaviour — the block
									    above records that the `<tr>` used to be conditional, so
									    opening Sell pushed every later row down. §1 fences behaviour
									    out; only the padding moved. The owner still sees a reserved
									    band under every sellable row, and it is still blank when
									    closed — that half stays raised for the founder, unchanged.
									    ⛔ NOTHING CLIPS: the host keeps its own 50px, so the cell
									    never becomes smaller than what it reserves. */}
									{sellable && (
										<tr data-testid={`sell-row-${row.marketId}`}>
											<td colSpan={5} className="px-2 py-0">
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
	owner,
	controls,
	bodyRef,
	children,
}: {
	/**
	 * ⚠⚠ PROFILE-FULL — THE VIEW CHIP IS A HEAD CONTROL, and it is rendered HERE
	 * rather than passed through `controls` so BOTH arms carry it: the empty-rows
	 * arm above mounts this panel with no controls at all, and a profile with zero
	 * positions must still say whose view this is.
	 */
	owner: boolean;
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
				<span className="text-xs font-medium text-ink">Positions</span>
				{/* ⚠⚠ PROFILE-FULL — THE VIEW CHIP MOVES HERE FROM THE IDENTITY BODY.
				    The mockup carries it as a head control — `.viewchip` in `.nav`
				    (`:425`), not a chip under the pseudonym — and as a body chip it was
				    costing the identity band 24px (20 chip + 4 gap) of the 188 the
				    band had to reach. It is the same chip, re-homed and re-typed.

				    ⚠ THE HEAD, NOT THE GLOBAL `<header>` — a DELIBERATE, REPORTED
				    DEVIATION from the mockup's literal placement, taken for two
				    reasons. (1) This build ALREADY puts this exact chip in a panel head
				    on `/bookmarks` (`bookmarks-view-chip`, `BookmarksTable.tsx`), so
				    the panel head is this surface's own established home for it and the
				    two modes stay symmetric — which is what §3 asks for. (2) The global
				    header is a SHARED server component mounted by `(public)/layout.tsx`
				    for every route, and a layout cannot receive a page's data: putting
				    a route-specific, ownership-dependent chip there needs a client
				    portal into a header slot, which would render nothing on the server
				    and pop in at hydration on the one page whose whole job is
				    accountability. The chip is in a head either way; this head is the
				    one that can be server-rendered.

				    ⚠ THE TYPE IS `.viewchip`'s OWN (`:183-184`): 9px/800/.12em
				    uppercase, a DASHED n4 hairline, n5 text, `--r` radius, 5/10
				    padding. The dashed border is the mockup's own distinction between
				    an annotation and a control — every real control on this surface
				    carries a solid one.
				    ⛔ NO STRING IS AUTHORED: `PROFILE_COPY.chip.owner` / `.visitor` are
				    unchanged, and the mockup's `· V toggles` suffix is NOT carried — it
				    names a prototype hotkey that toggles owner/visitor in the mockup
				    only. This build has no such hotkey, so shipping the words would
				    advertise a control that does not exist (the same class of
				    prototype-only affordance as the mockup's `html,body{overflow:hidden}`,
				    struck at recon A-5).

				    ⚠ A `<span>`, NOT THE SHARED `Badge`. `.viewchip` is a span in the
				    mockup, and `Badge`'s base variant hard-codes `h-5`, `rounded-4xl`,
				    `px-2 py-0.5` and `text-xs` — four of the five properties this chip
				    needs to set. Overriding them from a `className` puts the outcome at
				    the mercy of utility emission order for two same-property pairs
				    (`rounded-*`, and `h-5` against the padding), which is exactly the
				    kind of silent, order-dependent win this surface has been bitten by
				    before. A span states the whole box. */}
				<span
					data-testid="profile-chip"
					className="w-fit shrink-0 rounded-(--r) border border-dashed border-n4 px-[10px] py-[5px] text-[9px] leading-normal font-extrabold tracking-[0.12em] whitespace-nowrap text-n5 uppercase"
				>
					{owner ? PROFILE_COPY.chip.owner : PROFILE_COPY.chip.visitor}
				</span>
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
