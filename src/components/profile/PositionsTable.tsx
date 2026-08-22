"use client";

import Link from "next/link";
import {
	Fragment,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";

import { fmtUtcDay } from "@/components/debate/chart/geometry";
import {
	allocateDisplayed,
	displayPositionProfitLossSigned,
	formatDharma,
} from "@/components/debate/format";
import { REMOVED_STUB_TEXT } from "@/components/debate/placeholders";
import { Button } from "@/components/ui/button";
import { EmptyBlock } from "@/components/ui/empty-block";
import { ThumbGlyph } from "@/components/ui/thumb-glyph";
import type {
	ProfilePositionsPayload,
	SellablePositionRow,
} from "@/server/profile/owner-view";
import type {
	ProfileArgumentCell,
	ProfilePositionLot,
	ProfilePositionRow,
} from "@/server/profile/positions";
import { PROFILE_COPY } from "./copy";
import { InlineSellAmount, useInlineSell } from "./InlineSell";
import { argumentCurrentExact, sumExact } from "./partition";
import { useDocumentRowStepper } from "./row-stepper";
import { useEqualRowThirds } from "./row-thirds";
import {
	initialMarketIdOf,
	initialStatusFilter,
	isOpenLot,
	type ProfileSelection,
	usesWholeHoldingFallback,
} from "./selection";

/**
 * ROUND 4 item 8 — how many tiles fill the panel before the rest scroll.
 * FOUNDER-SUPPLIED ("three rows fill the panel"), reaffirmed at POSREV-1 RF-10
 * with the unit changed: three ARGUMENT TILES, and the market group headers do
 * not consume a slot.
 */
const ROW_WINDOW = 3;

/** The CSS custom property the sticky group headers hang their `top` on. */
const THEAD_H_VAR = "--zz-thead-h";

/** The group-header rows, for the window's chrome subtraction and the stepper. */
const GROUP_ROW_SELECTOR = 'tr[data-testid^="positions-group-"]';

/**
 * ⚠⚠ POSREV-1 — **THE UNIT OF THIS TABLE IS THE ARGUMENT, NOT THE MARKET.**
 *
 * It used to render one row per MARKET, titled with one of the arguments in it,
 * and hang the rest underneath in a `LotBreakdown` list that sat outside the
 * row's own border. A participant holding three arguments in one market
 * therefore saw one tile naming one of them, a total belonging to all three, and
 * two more dangling below — the market question repeated on every row, and the
 * one question a holder actually has ("which of my claims is worth keeping?")
 * unanswerable.
 *
 * Now: each market gets a sticky GROUP HEADER carrying that market's `Đa → Đb`,
 * and beneath it one TILE per argument, each exitable on its own.
 *
 * ⛔ **"Lot" appears nowhere a participant can read it (ADR-0039 R1).** The word
 * is the schema's. On screen these are ARGUMENTS.
 *
 * **WHY THE HEADER FIGURES NEED NO PER-TAB ARITHMETIC.** `Đa` is Σ SURVIVING lot
 * bases (`lots/basis.ts`), so a sold argument contributes zero to it; invariant
 * `I-LOT-SUM-001` guarantees Σ surviving lot shares == `positions.quantity`, so
 * `Đb` is the mark on exactly the shares the Open tab's tiles represent. The
 * header's `Đa → Đb` therefore ALREADY describes the tiles visible beneath it.
 * Recomputing per tab would be a second answer to a question the position row
 * already answers.
 *
 * **WHY THERE IS NO PER-ARGUMENT `computeSell`.** See `partition.ts`: the curve
 * is concave, so per-argument engine calls would sum to MORE than the holding.
 * Each tile's Current is a PARTITION of the single mark.
 *
 * **The Open/Closed toggle is HOLDING status, not market status (RF-13).** An
 * argument with surviving shares is Open; one with none is Closed. A market with
 * some of each appears in BOTH tabs, its header in each, showing only that tab's
 * tiles — which is correct and intended.
 *
 * Đ values are `formatDharma`-rounded and grouped, never float math; the
 * displayed figures are partitioned so the parts sum to the whole (RF-15).
 */
export function PositionsTable({
	payload,
	positionsValue,
	initialMarketSlug,
	onSelect,
}: {
	payload: ProfilePositionsPayload;
	/**
	 * ⚠⚠ RF-15 LEVEL 1 — the §23 Positions-value tile's EXACT figure, threaded
	 * down so the group headers can be allocated from the very string the tile
	 * renders. The alternative was re-deriving the sum here from `payload.rows`,
	 * which is byte-identical arithmetic over the same rows — and therefore two
	 * implementations that agree right up until one of them is edited. The tile
	 * and the headers now cannot disagree, because there is one number.
	 * ⚠ OPTIONAL, so every render-test call site that does not exercise the
	 * identity keeps working; absent, each header simply rounds independently.
	 */
	positionsValue?: string;
	/** OQ-5 B — the W2.10-C `?market=<slug>` preselect; matched against the
	 * rows' `marketSlug` (unknown → "all"; the raw param is never rendered). */
	initialMarketSlug?: string;
	/**
	 * ROUND 4 item 7 — report the picked TILE to the argument panel.
	 * ⛔ PASS A STABLE FUNCTION. It is an effect dependency below, and the value
	 * it reports is a fresh object, so an inline arrow loops.
	 */
	onSelect?: (selection: ProfileSelection | null) => void;
}): React.JSX.Element {
	const owner = payload.owner;
	const rows = payload.rows;
	const initialMarketId = initialMarketIdOf(rows, initialMarketSlug);
	const [market, setMarket] = useState(initialMarketId);
	// ⚠ POLISH.5 Gate C S-1 — the default is DERIVED, not fixed, and RF-13's
	// redefinition makes that MORE necessary rather than less: exiting is now a
	// per-argument action, so a participant accumulates closed arguments from
	// their first sell onward and a fixed `Open` would strand anyone who has
	// trimmed everything.
	const [status, setStatus] = useState<"Open" | "Closed">(() =>
		initialStatusFilter(rows, initialMarketId),
	);
	// ⚠ THE SELECTION IS KEYED BY LOT ID — the tile, not the market. Keyed by
	// market it could not distinguish three arguments in one market, which is the
	// case this whole revamp exists for.
	const [selectedLotId, setSelectedLotId] = useState<string | null>(null);
	const tileRefs = useRef(new Map<string, HTMLTableRowElement>());
	const bodyRef = useRef<HTMLDivElement | null>(null);
	const tableRef = useRef<HTMLTableElement | null>(null);
	const [filterOpen, setFilterOpen] = useState(false);
	const filterRef = useRef<HTMLDivElement | null>(null);
	const sell = useInlineSell();

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
	// ⚠ `useCallback`, so the group memo below can DEPEND on it rather than on
	// `owner` — a plain arrow is a new function every render, and listing `owner`
	// instead would be listing a proxy for the thing actually used. Biome's
	// exhaustive-deps rule is right about that and is followed rather than
	// silenced (AGENTS.md §11: disabling a Biome rule is an ask-first decision).
	const sellEligibleOf = useCallback(
		(row: ProfilePositionRow): boolean =>
			owner && "sellEligible" in row
				? (row as SellablePositionRow).sellEligible
				: false,
		[owner],
	);

	const marketOptions = useMemo(() => {
		const seen = new Map<string, string>();
		for (const r of rows) {
			if (!seen.has(r.marketId)) {
				seen.set(r.marketId, r.marketTitle);
			}
		}
		return [...seen.entries()];
	}, [rows]);

	// ── The tab counts, over the MARKET-SCOPED rows ──────────────────────────
	// RF-13's count badge sits on the Closed label; the Open count is derived
	// alongside it because the RF-14 empty states need to know whether the OTHER
	// tab holds anything ("your closed arguments are in the Closed tab" is a lie
	// if there are none).
	const scoped = useMemo(
		() => rows.filter((r) => market === "all" || r.marketId === market),
		[rows, market],
	);
	// ⚠ COUNTED IN TILES, NOT IN LOTS. A holding rendered by the whole-holding
	// fallback has ZERO surviving lots and ONE Open tile; counting lots would put
	// both tabs at 0 and hand RF-14's "both empty" branch to someone whose
	// position is sitting one tab away — the lying empty state `copy.ts` warns
	// about, reached by arithmetic instead of by copy.
	const openCount = useMemo(
		() =>
			scoped.reduce(
				(n, r) =>
					n +
					(usesWholeHoldingFallback(r) ? 1 : r.lots.filter(isOpenLot).length),
				0,
			),
		[scoped],
	);
	const closedCount = useMemo(
		() =>
			scoped.reduce(
				(n, r) => n + r.lots.filter((l) => !isOpenLot(l)).length,
				0,
			),
		[scoped],
	);

	// ── RF-15 LEVEL 1 — the group headers' displayed Đb ───────────────────────
	// ⚠⚠ ALLOCATED OVER EVERY ROW THE TILE SUMS, NOT OVER THE VISIBLE ONES, AND
	// THAT IS DELIBERATE. `loadProfileTiles` sums `current` over the rows where
	// `settled === false`; allocating over that same set makes the identity
	// "Σ displayed headers == the Positions-value tile" hold exactly. Allocating
	// over the FILTERED set instead would make a market's header figure CHANGE
	// when the reader moved the market dropdown — the same holding reading Đ 151
	// under "All markets" and Đ 152 under its own name, which is worse than a
	// rounding gap.
	// ⚠ A SETTLED holding is not one of the tile's summands and is rounded on its
	// own — a one-element allocation, which by construction is exactly
	// `round0(current)`, so there is one code path rather than two.
	const headerCurrent = useMemo(() => {
		const byMarket = new Map<string, string>();
		const valued = rows.filter((r) => !r.settled);
		const alloc = allocateDisplayed(
			positionsValue ?? sumExact(valued.map((r) => r.current)),
			valued.map((r) => r.current),
		);
		valued.forEach((r, i) => {
			byMarket.set(r.marketId, alloc[i] as string);
		});
		for (const r of rows) {
			if (!byMarket.has(r.marketId)) {
				byMarket.set(
					r.marketId,
					allocateDisplayed(r.current, [r.current])[0] as string,
				);
			}
		}
		return byMarket;
	}, [rows, positionsValue]);

	// ── The groups and their tiles ───────────────────────────────────────────
	const groups = useMemo(() => {
		const built: MarketGroup[] = [];
		for (const row of scoped) {
			const lots = row.lots.filter((l) =>
				status === "Open" ? isOpenLot(l) : !isOpenLot(l),
			);
			const sellable = sellEligibleOf(row);
			if (lots.length === 0) {
				// ⛔⛔ A HELD HOLDING WITH NO ATTRIBUTION STILL RENDERS, AS ONE TILE.
				//
				// One tile per ARGUMENT means a holding with no `lots` rows has nothing
				// to render — and dropping it would be the profile committing exactly
				// the error `planLotSale` refuses to commit. Its own note (`lots/
				// persist.ts:204-218`): "an attribution layer must never be able to veto
				// the authority it describes … any drift between `lots` and `positions`
				// would LOCK A PARTICIPANT OUT OF EXITING A POSITION THEY HOLD, trapping
				// their Dharma behind a bookkeeping disagreement." A position that
				// vanishes from the owner's own table is the same veto, wearing a
				// rendering bug's clothes: they can neither see it nor reach its Sell.
				//
				// ⇒ SO THE FALLBACK IS THE PRE-LOTS-1 ROW: one tile carrying the
				// holding's episode-opening argument (N-1a) and the whole holding's
				// figures. It is the exact shape this table had before arguments became
				// its unit, applied to precisely the rows that unit cannot describe.
				// ⚠ IT CARRIES NO LOT ID, and that is what makes it correct rather than
				// approximate: its Sell posts a POSITION-level sell — `lotId` omitted,
				// which is what every pre-LOTS-1 client meant and what the route still
				// accepts — instead of naming an argument that does not exist.
				// ⚠ OPEN TAB ONLY. A Closed tile means "you exited this argument", and
				// there is no argument here to have exited; the Closed tab's domain is
				// sold lots, and a holding with no lots has none.
				if (status === "Open" && usesWholeHoldingFallback(row)) {
					built.push({
						marketId: row.marketId,
						marketTitle: row.marketTitle,
						marketSlug: row.marketSlug,
						headerStaked: row.staked,
						headerValue: headerCurrent.get(row.marketId) ?? "0",
						tiles: [
							{
								key: row.marketId,
								row,
								lot: null,
								side: row.side,
								argument: row.argument,
								basis: row.staked,
								shares: row.quantity,
								placedAt: null,
								currentExact: row.current,
								valueDisplay: headerCurrent.get(row.marketId) ?? "0",
								sellable,
							},
						],
					});
				}
				continue;
			}
			// RF-4's partition — this argument's share of the holding's one mark.
			const exact = lots.map((lot) =>
				argumentCurrentExact({
					positionCurrent: row.current,
					survivingShares: lot.survivingShares,
					quantity: row.quantity,
				}),
			);
			// ── RF-15 LEVEL 2 — the tiles sum to their own header ──────────────
			// Open: the header's displayed Đb across the tiles' exact partitions.
			// Closed: the header's STAKED total across the tiles' original bases —
			// same identity, different quantity, because a closed tile shows what
			// was put in and a closed header shows the sum of exactly those.
			const closedStakedExact = sumExact(lots.map((l) => l.originalBasis));
			const headerValue =
				status === "Open"
					? (headerCurrent.get(row.marketId) ?? "0")
					: (allocateDisplayed(closedStakedExact, [closedStakedExact])[0] ??
						"0");
			const allocated =
				status === "Open"
					? allocateDisplayed(headerValue, exact)
					: allocateDisplayed(
							headerValue,
							lots.map((l) => l.originalBasis),
						);
			built.push({
				marketId: row.marketId,
				marketTitle: row.marketTitle,
				marketSlug: row.marketSlug,
				headerStaked: row.staked,
				headerValue,
				tiles: lots.map((lot, i) => ({
					key: lot.lotId,
					row,
					lot,
					side: lot.side,
					argument: lot.argument,
					basis: lot.survivingBasis,
					shares: lot.survivingShares,
					placedAt: lot.placedAt,
					currentExact: exact[i] as string,
					valueDisplay: allocated[i] as string,
					// A sold argument has nothing to sell; the row-level predicate is
					// the market/ownership half and this is the per-argument half.
					sellable: sellable && isOpenLot(lot),
				})),
			});
		}
		return built;
	}, [scoped, status, headerCurrent, sellEligibleOf]);

	const visibleTiles = useMemo(() => groups.flatMap((g) => g.tiles), [groups]);

	// ⚠⚠ THE SELECTION IS DERIVED AGAINST THE VISIBLE SET, NOT STORED AS TRUTH.
	// PROFILE REFINEMENT · R3: the FIRST VISIBLE TILE is the fallback, so mount,
	// a filter change and a tab change are all one question with one answer.
	// ⛔ A DERIVATION, NOT AN EFFECT. An effect that watched the visible set and
	// wrote state would render one frame with the OLD selection — the empty rail
	// R3 exists to remove, one frame long — and would need its own loop guard.
	// ⚠ THE EMPTY LIST FALLS OUT FOR FREE: `visibleTiles[0]` is `undefined`, so
	// this is `null` and the empty state renders.
	const selectedTile =
		visibleTiles.find((t) => t.key === selectedLotId) ??
		visibleTiles[0] ??
		null;

	// ROUND 4 item 7 — REPORT THE DERIVED SELECTION UPWARD. The deps are all
	// PRIMITIVES, never the tile itself: it is rebuilt on every render, so
	// depending on it would fire the effect every time.
	const pickedMarketId = selectedTile?.row.marketId ?? null;
	const pickedMarketTitle = selectedTile?.row.marketTitle ?? null;
	const pickedCommentId =
		selectedTile && !selectedTile.argument.removed
			? selectedTile.argument.commentId
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

	// ⚠⚠ RF-10 — THREE TILES FILL THE PANEL; THE REST SCROLL INSIDE IT.
	// Two mechanisms, and they cover different pages. `useEqualRowThirds` divides
	// a DEFINITE region into equal thirds (the one-screen layout at `lg`+); the
	// `max-height` cap below bounds a GROWABLE page at the third tile's bottom.
	// Each stands down when the other's condition holds.
	// ⛔ BOTH MEASURE THE RENDERED TILE. RF-4's stacked Current cell and RF-3's
	// removed market sub-line both change tile height, so any constant written
	// here would have been wrong on the day it was typed.
	// ⚠ GROUP HEADERS ARE CHROME IN BOTH: excluded from the row selector, and
	// subtracted from the region via `extraHeadSelector`. Sticky takes no layout
	// space only while STUCK; in flow each header occupies its own band.
	useEqualRowThirds({
		bodyRef,
		tableRef,
		testidPrefix: "position-tile-",
		extraHeadSelector: GROUP_ROW_SELECTOR,
		rowWindow: ROW_WINDOW,
		rowCount: visibleTiles.length,
	});
	useEffect(() => {
		const body = bodyRef.current;
		const table = tableRef.current;
		if (body === null || table === null) {
			return;
		}
		const measure = () => {
			// ⚠⚠ THE STICKY OFFSET IS MEASURED, NEVER TYPED. The group headers stick
			// BELOW the column-header row, so their `top` is that row's height — a
			// figure that moves with the overline's type size and padding. Writing
			// `top-[19px]` would go stale from the very edit that changed it (O-8's
			// fence-by-symbol, applied to a number instead of a line).
			// ⚠ jsdom performs no layout and returns zero rects, so the property is
			// simply left at its `0px` fallback there — the render suite sees
			// unstuck headers rather than headers pinned to a wrong offset.
			const head = table.querySelector("thead");
			const headH = head ? head.getBoundingClientRect().height : 0;
			if (headH > 0) {
				table.style.setProperty(THEAD_H_VAR, `${Math.ceil(headH)}px`);
			}

			if (visibleTiles.length < ROW_WINDOW) {
				// Fewer tiles than the window — nothing to window, and the panel goes
				// back to its natural height rather than keeping a stale cap.
				body.style.maxHeight = "";
				return;
			}
			// ⚠⚠ ROUND 5 item A — the cap narrows to the case that still needs it.
			// At `lg`+ the panel's height comes from the VIEWPORT, and a 3-tile cap
			// on top of that is dead space rather than a window. So: clear the cap,
			// ask whether the DOCUMENT can still scroll, and only window when it can.
			body.style.maxHeight = "";
			const doc = document.documentElement;
			if (doc.scrollHeight <= doc.clientHeight + 1) {
				return;
			}
			const tiles = table.querySelectorAll<HTMLTableRowElement>(
				'tbody > tr[data-testid^="position-tile-"]',
			);
			const last = tiles[ROW_WINDOW - 1];
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
	}, [visibleTiles.length]);

	/** `pick(i)` (`:679`) — select a tile. No deselect: the panel always holds a
	 * selection, so clearing would immediately re-derive to the first visible
	 * tile — a silent no-op on tile one and a jump-to-tile-one everywhere else. */
	const pick = (lotId: string) => {
		setSelectedLotId(lotId);
	};

	/** `stepRow(dir)` — Up/Down through the CURRENTLY VISIBLE tiles, wrapping.
	 * ⚠⚠ PROFILE OVERLAP · R4 — THE ANCHOR IS THE *DERIVED* TILE, NOT THE STORED
	 * PICK. The stored id means "the reader has chosen"; it is `null` at mount, so
	 * reading it fell to `at < 0` and entered at index 0 — the tile already
	 * selected — and the first arrow moved nothing. Stepping has to start from
	 * what is on screen, and only the derivation knows that. */
	const stepRow = (dir: 1 | -1) => {
		if (visibleTiles.length === 0) {
			return;
		}
		const at = selectedTile === null ? -1 : visibleTiles.indexOf(selectedTile);
		const next =
			at < 0 ? 0 : (at + dir + visibleTiles.length) % visibleTiles.length;
		const target = visibleTiles[next];
		if (target === undefined) {
			return;
		}
		setSelectedLotId(target.key);
		const el = tileRefs.current.get(target.key);
		if (el?.scrollIntoView) {
			el.scrollIntoView({ block: "nearest" });
		}
		el?.focus({ preventScroll: true });
	};
	// ⛔ The stepper yields while the market popover is open (its options are a
	// list of their own) AND while a sell field is armed — arrow keys inside a
	// money input belong to the input.
	useDocumentRowStepper({
		tableRef,
		step: stepRow,
		enabled: !filterOpen && sell.armedLotId === null,
	});

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

	const isOpenTab = status === "Open";

	return (
		<PositionsPanel
			bodyRef={bodyRef}
			controls={
				<>
					{/* ⚠⚠ POSREV-1 RF-1 — THE LABEL IS STATE, NOT A PROMPT. It read
					    `Select market ▾` permanently, so after choosing a market the
					    control still asked the reader to choose one and the only way to
					    find out which was selected was to open it. It now reads the
					    SELECTED market's name, or `All markets` when none is chosen —
					    which is also the exact string of the option that produces it, so
					    the label and the list agree by construction.
					    ⛔ THE CARET IS BYTE-CARRIED — `e2 96 be`, U+25BE BLACK DOWN-
					    POINTING SMALL TRIANGLE, unchanged from canon §6.
					    ⚠ THE TESTID IS UNCHANGED so every existing consumer keeps its
					    handle; only the label text moves.
					    ⛔ THIS WRAPPER IS DELIBERATELY NOT `relative`, AND THAT IS A
					    MEASURED CORRECTION. It was, and the popover then sized to the
					    TRIGGER: measured at 1440, `min-w-full` against a 107px button
					    produced a 107 × 590 column in which every market question wrapped
					    over ~6 lines. The positioning context lives on the header bar. */}
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
							{marketOptions.find(([id]) => id === market)?.[1] ??
								"All markets"}{" "}
							▾
						</Button>
						{filterOpen && (
							<div
								data-testid="positions-market-popover"
								role="listbox"
								aria-label="Select market"
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
					{/* ⚠⚠ POSREV-1 RF-9 — THE SELECTED OPTION FILLS THE BLOCK.
					    ⛔ AND IT IS A PLAIN `<button>`, NOT THE `Button` PRIMITIVE, WHICH
					    IS THE WHOLE POINT OF THIS BLOCK. `buttonVariants` puts
					    `bg-(--btn-fill)` on the element for EVERY variant — the one-button
					    system — so a `bg-n7` in `className` would be a SECOND background
					    utility on one element, resolved by STYLESHEET EMISSION ORDER
					    rather than by the order written here. That is the trap this file
					    has already recorded three times (an inert `line-clamp` under a
					    stray `block`, `size="xs"` fighting explicit padding, two
					    `[outline:…]` utilities). The previous build reached for
					    `variant={selected ? "default" : "outline"}` and got ZERO pixels of
					    difference, because `ui/button.tsx:16-19` renders those two
					    identically; its own note concluded "a variant swap can never
					    express selection in this system". Fighting the primitive's
					    background would be the fourth instance of the same lesson.
					    ⇒ So the element carries exactly ONE background declaration, and
					    the focus affordance is the shipped token applied by name.
					    ⛔ THE FILL IS `n7` (#e4e4e4), NOT `#fafafa`. `--color-no` IS
					    #fafafa: it encodes the NO SIDE under INV-3, and this toggle sits
					    inches from tiles reading `Yes`. `n7` is the brightest NEUTRAL rung
					    — visibly filled, and carrying no side meaning at all.
					    ⚠ THE COUNT RIDES THE CLOSED LABEL (RF-7) in its own node, so the
					    word stays readable as a word and the number is separable. */}
					<span
						data-testid="positions-status-filter"
						className="ml-auto flex items-center gap-1"
					>
						{(["Open", "Closed"] as const).map((s) => (
							<button
								key={s}
								type="button"
								data-testid={`positions-status-${s.toLowerCase()}`}
								aria-pressed={status === s}
								onClick={() => setStatus(s)}
								className={`inline-flex h-6 shrink-0 items-center gap-1 rounded-(--r) px-2 text-xs font-medium transition-all outline-none select-none focus-visible:shadow-(--state-focus-ring) ${
									status === s
										? "bg-n7 text-ground"
										: "text-n5 [border:var(--hairline)] hover:bg-(--state-hover-fill)"
								}`}
							>
								{s}
								{s === "Closed" && (
									<span
										data-testid="positions-closed-count"
										className="tabular-nums"
									>
										{closedCount}
									</span>
								)}
							</button>
						))}
					</span>
				</>
			}
		>
			{visibleTiles.length === 0 ? (
				// ⚠⚠ POSREV-1 RF-14 — THE EMPTY STATES ARE PER-TAB AND AWARE OF EACH
				// OTHER. One message for two tabs told someone who had traded and fully
				// exited that they had never traded. The three cases are evaluated over
				// the MARKET-SCOPED rows, so a dropdown selection narrows them the same
				// way it narrows everything else on this panel.
				<EmptyBlock
					message={
						isOpenTab
							? closedCount > 0
								? PROFILE_COPY.empty.openEmpty
								: owner
									? PROFILE_COPY.empty.positionsOwner
									: PROFILE_COPY.empty.positionsVisitor
							: openCount > 0
								? PROFILE_COPY.empty.closedEmpty
								: owner
									? PROFILE_COPY.empty.positionsOwner
									: PROFILE_COPY.empty.positionsVisitor
					}
					messageTestId="positions-empty-tab"
				/>
			) : (
				<table
					data-testid="positions-table"
					ref={tableRef}
					// ⛔ THE KEY HANDLER IS SCOPED TO THE TABLE, NOT TO `document`. The
					// page GROWS AND SCROLLS below `lg`, so a document-level ArrowDown
					// that prevents default would kill keyboard scrolling of the whole
					// route. `useDocumentRowStepper` above adds the document arm and
					// stands down whenever the page can scroll.
					onKeyDown={(e) => {
						if (e.key !== "ArrowUp" && e.key !== "ArrowDown") {
							return;
						}
						// ⛔ STAND DOWN INSIDE THE MONEY FIELD. `useDocumentRowStepper`
						// already refuses editable targets and explicitly defers
						// inside-table presses to THIS handler — which did not check, so
						// an arrow pressed inside an armed `tile-sell-amount-*` would
						// `preventDefault()`, step the selection and pull focus OUT of a
						// live money input while the row stayed armed. Harmless before
						// POSREV-1, because no row contained an input; now every sellable
						// tile can. Same `closest` idiom the click handler uses.
						if ((e.target as HTMLElement).closest("input")) {
							return;
						}
						e.preventDefault();
						stepRow(e.key === "ArrowUp" ? -1 : 1);
					}}
					className="w-full table-fixed text-left text-sm"
				>
					{/* ⚠⚠ POSREV-1 RF-4 — FOUR COLUMNS, AND THE OLD `STAKED` IS GONE.
					    Open reads `Position · Argument · Current · Sell`; Closed reads
					    `Position · Argument · Staked · Opened`.
					    ⛔ THE ARROW TRACK GOES WITH `STAKED`. It was a 16px spacer whose
					    only job was to carry the `→` between the two value columns; with
					    one value column there is no relation left for it to state.
					    ⛔ `table-fixed` IS WHAT MAKES THE WIDTHS BIND — without it a `<th>`
					    width is a HINT the auto layout may overrule from cell content,
					    which is how the Current column once rendered at 86px against a
					    118px request and broke a Đ figure mid-value (AGENTS.md §8).
					    ⚠ CURRENT IS WIDER THAN THE OLD 118: it now stacks three lines and
					    the widest is `from Đ 14,260`.
					    ⚠ `uppercase` IS A CSS TRANSFORM, so each `<th>`'s DOM
					    `textContent` is still `Position` / `Argument` / `Current` — the
					    column-ORDER guards read those and a retyped literal would have
					    moved the assertion where a transform cannot. */}
					<thead className="sticky top-0 z-10 bg-n0 shadow-[0_calc(var(--spacing)*-3)_0_0_var(--color-n0)] text-[8.5px] leading-[1.2] font-extrabold tracking-[0.12em] text-n4 uppercase">
						<tr>
							<th className="w-[96px] px-2 pt-0 pb-2 text-center">Position</th>
							<th className="px-2 pt-0 pb-2 text-center">Argument</th>
							{isOpenTab ? (
								<>
									<th className="w-[124px] px-2 pt-0 pb-2 text-center">
										Current
									</th>
									<th className="w-[104px] px-2 pt-0 pb-2 text-center">Sell</th>
								</>
							) : (
								<>
									<th className="w-[92px] px-2 pt-0 pb-2 text-center">
										Staked
									</th>
									<th className="w-[92px] px-2 pt-0 pb-2 text-center">
										Opened
									</th>
								</>
							)}
						</tr>
					</thead>
					{groups.map((group) => (
						<tbody key={group.marketId}>
							{/* ⚠⚠ RF-3 — THE MARKET GROUP HEADER. Always expanded, never a
							    dropdown, never collapsible: it is the thing that tells you
							    which market you are inside, and a header you can hide is a
							    header you will have hidden when you need it.
							    ⛔ STICKY ON THE `<tr>`, NOT ON THE CELL. Tailwind's preflight
							    sets `border-collapse: collapse`, under which sticky TABLE
							    CELLS do not stick in Chrome — but a sticky row group does,
							    which is what the column-header row above already relies on.
							    ⚠ ITS `top` IS THE MEASURED COLUMN-HEADER HEIGHT (see the
							    effect), never a literal.
							    ⛔ `Đa → Đb` ON THE OPEN TAB ONLY. On Closed both would read
							    `Đ 0` — a sold argument contributes zero to Đa by
							    `lots_sold_zeroes_basis` and holds nothing to mark — so the
							    Closed header states the one figure that is not zero: what
							    was staked behind the arguments listed under it. */}
							<tr
								data-testid={`positions-group-${group.marketId}`}
								className="sticky z-[5] bg-n0"
								style={{ top: `var(${THEAD_H_VAR}, 0px)` }}
							>
								<th
									colSpan={4}
									scope="colgroup"
									className="px-2 pt-2 pb-1 text-left font-normal"
								>
									<span className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
										<Link
											href={`/m/${group.marketSlug}`}
											data-testid={`positions-group-title-${group.marketId}`}
											className="text-[11px] leading-[1.35] font-extrabold tracking-[0.06em] text-ink uppercase hover:underline"
										>
											{group.marketTitle}
										</Link>
										<span
											data-testid={`positions-group-figures-${group.marketId}`}
											className="shrink-0 text-[11px] leading-[1.35] font-bold whitespace-nowrap tabular-nums text-n5"
										>
											{isOpenTab ? (
												<>
													Đ {formatDharma(group.headerStaked)}{" "}
													<span aria-hidden="true" className="text-n4">
														→
													</span>{" "}
													<span className="text-ink">
														Đ {formatDharma(group.headerValue)}
													</span>
												</>
											) : (
												<>
													<span className="tracking-[0.12em] text-n4">
														STAKED
													</span>{" "}
													<span className="text-ink">
														Đ {formatDharma(group.headerValue)}
													</span>
												</>
											)}
										</span>
									</span>
								</th>
							</tr>
							{group.tiles.map((tile) => (
								<Fragment key={tile.key}>
									<TileRow
										tile={tile}
										isOpenTab={isOpenTab}
										selected={selectedTile?.key === tile.key}
										sell={sell}
										onPick={pick}
										registerRef={(el) => {
											if (el) {
												tileRefs.current.set(tile.key, el);
											} else {
												tileRefs.current.delete(tile.key);
											}
										}}
									/>
								</Fragment>
							))}
						</tbody>
					))}
				</table>
			)}
		</PositionsPanel>
	);
}

// ── Types ────────────────────────────────────────────────────────────────────

type ArgTile = {
	/** The tile's identity: a real `lots.id`, or the market id for the fallback. */
	key: string;
	row: ProfilePositionRow;
	/**
	 * ⚠ NULL for the whole-holding fallback — a held position with no attribution
	 * (see the group builder). Everything the tile RENDERS is lifted onto the tile
	 * itself precisely so the render never has to ask whether a lot exists; the
	 * only place the distinction survives is the sell, which omits `lotId` and
	 * therefore sells the POSITION, which is the honest thing to do when there is
	 * no argument to name.
	 */
	lot: ProfilePositionLot | null;
	/** The ARGUMENT's own side (`lots.side`); the row's for the fallback. */
	side: "YES" | "NO";
	argument: ProfileArgumentCell;
	/** Đ still staked behind this argument — the delta's base (RF-4). */
	basis: string;
	/** Shares still held — the sell's ceiling. */
	shares: string;
	/** `null` on the fallback, which is Open-tab-only and never shows a date. */
	placedAt: string | null;
	/** RF-4's exact partition — the sell seed AND `sellSharesFor`'s basis. */
	currentExact: string;
	/** RF-15's allocated whole-Đ figure: Current on Open, Staked on Closed. */
	valueDisplay: string;
	sellable: boolean;
};

type MarketGroup = {
	marketId: string;
	marketTitle: string;
	marketSlug: string;
	/** Đa — Σ surviving lot basis, the position's own figure (Open tab). */
	headerStaked: string;
	/** Đb on Open; Σ original basis on Closed. Displayed (allocated) figure. */
	headerValue: string;
	tiles: ArgTile[];
};

// ── One argument ─────────────────────────────────────────────────────────────

/**
 * ONE ARGUMENT'S TILE. It is a `<tr>` rather than a card because the four
 * columns have to line up across every group, and two grids cannot share column
 * widths without an explicit track template — whose only available source is the
 * mockup's five light-prototype literals, which the VALUE RULE forbids.
 */
function TileRow({
	tile,
	isOpenTab,
	selected,
	sell,
	onPick,
	registerRef,
}: {
	tile: ArgTile;
	isOpenTab: boolean;
	selected: boolean;
	sell: ReturnType<typeof useInlineSell>;
	onPick: (lotId: string) => void;
	registerRef: (el: HTMLTableRowElement | null) => void;
}): React.JSX.Element {
	const armed = sell.armedLotId === tile.key;
	const sold = sell.soldLotId === tile.key;
	const pl = displayPositionProfitLossSigned(tile.basis, tile.currentExact);
	const sellArgs = {
		marketId: tile.row.marketId,
		// ⚠ `undefined` ON THE FALLBACK TILE — `buildSellRequest` DROPS the key
		// entirely, so the request is the position-level sell every pre-LOTS-1
		// client meant. A `null` would be a different body, a different canonical
		// fingerprint and a 409 on retry (see the route's own note).
		...(tile.lot === null ? {} : { lotId: tile.lot.lotId }),
		seedExact: tile.currentExact,
		maxShares: tile.shares,
	};
	return (
		<tr
			data-testid={`position-tile-${tile.key}`}
			ref={(el) => {
				registerRef(el);
				// ⚠ RELEASED, NOT ONLY SET. Without the else-arm a tile that stops
				// being armed (or unmounts on a tab switch) leaves a detached node in
				// the ref, and the click-outside test would then run `contains` against
				// something no longer in the document.
				if (armed) {
					sell.armedRowRef.current = el;
				} else if (sell.armedRowRef.current === el) {
					sell.armedRowRef.current = null;
				}
			}}
			// ⚠ `aria-current`, NOT `aria-selected`, AND THAT IS A BLOCKED ROUTE
			// RATHER THAN A PREFERENCE. `aria-selected` is only defined inside a grid
			// or a listbox, and Biome's a11y rule rejects `role="grid"` on a `<table>`
			// as redundant — disabling a Biome rule is an ask-first decision
			// (AGENTS.md §11). `aria-current` is valid on any element and says
			// precisely this: the current item within a set.
			aria-current={selected ? "true" : undefined}
			tabIndex={selected ? 0 : -1}
			onClick={(e) => {
				// The tile's own children stay clickable: the title navigates, Sell
				// arms, the amount field takes focus. One `closest` covers every child
				// without threading a handler through them.
				if ((e.target as HTMLElement).closest("a,button,input")) {
					return;
				}
				onPick(tile.key);
			}}
			onKeyDown={(e) => {
				if (e.key === "Enter" || e.key === " ") {
					if ((e.target as HTMLElement).closest("input")) {
						return;
					}
					e.preventDefault();
					onPick(tile.key);
				}
			}}
			className={`cursor-pointer rounded-(--r) focus-visible:shadow-(--state-focus-ring) ${
				selected
					? "bg-n1 [outline-offset:-2px] [outline:var(--ring-active)]"
					: "[outline-offset:-1px] [outline:var(--hairline)] hover:bg-n1"
			}`}
		>
			{/* ⚠⚠ RF-12 — THE POSITION CELL SHOWS THE SIDE AND NOTHING ELSE.
			    ⛔ THE `Open` BADGE IS DELETED. Market status renders NOWHERE on this
			    surface: every market carries the same deadline and none resolves
			    early, so the chip repeated one constant word on every tile. And under
			    RF-13 the word `Open` now means something DIFFERENT on this surface —
			    it is the holding tab — so a chip reading `Open` beside a tab reading
			    `Open` would name two unrelated facts with one word.
			    ⛔ NO Exited / Flipped / Voided / Sold marker either. RF-13 replaces
			    the Sold tag with the Closed tab: a tag says "this happened" where a
			    tab says "these are the ones", and the tab is the cheaper read.
			    ⚠⚠ THE SIDE IS THE ARGUMENT'S OWN (`lots.side`), NOT the position row's.
			    `positions.side` is Bucket C and MUTABLE — a participant who exits YES
			    and re-enters NO has a row reading NO while every argument they made on
			    the way in is still a YES argument. They agree on every surviving lot
			    by construction and part company only on fully-sold ones, which is
			    exactly the Closed tab.
			    ⚠ `align-baseline` ON BOTH THIS CELL AND THE ARGUMENT CELL is what
			    "top-aligned to the argument title's first baseline" MEANS in a table:
			    the CSS default centres the cell, which floats the side away from the
			    title the moment the title wraps. Baseline alignment ties the two first
			    lines together regardless of how many lines follow. */}
			<td className="p-2 align-baseline">
				<span
					data-testid={`tile-side-${tile.key}`}
					className="flex items-center justify-center gap-[5px] text-[13px] leading-[1.35] font-extrabold text-ink"
				>
					{tile.side === "YES" ? "Yes" : "No"}
					<ThumbGlyph side={tile.side} size={14} />
				</span>
			</td>
			<td className="p-2 align-baseline">
				<TileArgumentCell cell={tile.argument} tileKey={tile.key} />
			</td>
			{isOpenTab ? (
				<>
					{/* ⚠⚠ RF-4 — THE CURRENT CELL STACKS THREE LINES, and RF-5 hides two
					    of them while the amount field is open: a delta and a "from"
					    beside an editable number are answering a question the reader has
					    stopped asking.
					    ⚠ THE DELTA'S BASE IS `survivingBasis`, NOT `originalBasis`, and
					    the two are byte-identical until an argument is PARTIALLY sold.
					    There, `current` is the value of what SURVIVES — so subtracting
					    what was originally committed would print a large loss for someone
					    who has actually taken money out. RF-7 also rules that a partial
					    sale carries no tag and that "figures reduce" is the whole signal;
					    an immutable base cannot reduce, and the reduction would leave no
					    trace on the surface at all. */}
					<td className="p-2 text-center align-baseline whitespace-nowrap tabular-nums text-ink">
						{sold ? (
							<span
								data-testid={`tile-sold-${tile.key}`}
								className="text-[11px] leading-[1.2] font-extrabold tracking-[0.1em] text-n5 uppercase"
							>
								Sold
							</span>
						) : armed ? (
							<InlineSellAmount
								tileKey={tile.key}
								seedDisplay={tile.valueDisplay}
								seedExact={tile.currentExact}
								draft={sell.draft}
								disabled={sell.busy}
								onEdit={sell.edit}
								onSubmit={() => sell.confirm(tile.key, sellArgs)}
							/>
						) : (
							<span className="flex flex-col items-center leading-[1.35]">
								<span>Đ {formatDharma(tile.valueDisplay)}</span>
								{pl.magnitude !== "" && (
									<span
										data-testid={`tile-pl-${tile.key}`}
										className="text-[10.5px] leading-[1.2] font-bold text-n5"
									>
										({pl.sign}Đ {pl.magnitude})
									</span>
								)}
								<span
									data-testid={`tile-from-${tile.key}`}
									className="text-[9.5px] leading-[1.2] font-semibold text-n4"
								>
									from Đ {formatDharma(tile.basis)}
								</span>
							</span>
						)}
					</td>
					{/* ⚠⚠ RF-5/6/7 — THE SELL COLUMN. Resting: `Sell`. Armed: `Confirm`
					    beside a `✕`. ⛔ THE ✕ IS NOT OPTIONAL — a two-step cushion with
					    no exit is a trap, not a cushion. Escape and a click outside
					    cancel too (wired in `useInlineSell`). */}
					<td className="p-2 text-center align-baseline">
						{tile.sellable && !sold && (
							<span className="inline-flex items-center gap-1">
								{armed ? (
									<>
										<Button
											type="button"
											size="xs"
											variant="outline"
											disabled={
												sell.busy ||
												!sell.canSubmit(tile.currentExact, tile.shares)
											}
											data-testid={`tile-confirm-${tile.key}`}
											className="font-extrabold tracking-[0.08em] uppercase [border:var(--ring-active)]"
											onClick={() => sell.confirm(tile.key, sellArgs)}
										>
											{sell.busy ? "…" : sell.failed ? "Retry" : "Confirm"}
										</Button>
										<Button
											type="button"
											size="icon-xs"
											variant="ghost"
											aria-label="Cancel sell"
											// ⛔ DISABLED IN FLIGHT, like Confirm and the field. Cancelling
											// mid-request lets another tile arm, which replaces the key state
											// with a fresh one whose `inFlight` is false — so the live
											// request's OUTCOME is silently dropped and the NEXT tile shows
											// this one's failure.
											disabled={sell.busy}
											data-testid={`tile-cancel-${tile.key}`}
											onClick={sell.cancel}
										>
											✕
										</Button>
									</>
								) : (
									<Button
										type="button"
										size="xs"
										variant="outline"
										data-testid={`tile-sell-${tile.key}`}
										className="font-extrabold tracking-[0.08em] uppercase [border:var(--ring-active)]"
										onClick={() => sell.arm(tile.key)}
									>
										Sell
									</Button>
								)}
							</span>
						)}
					</td>
				</>
			) : (
				<>
					{/* RF-13's Closed columns. ⛔ NO `Current` — it would read `Đ 0` on
					    every single row. ⛔ NO `Sell` — there is nothing to sell.
					    `Staked` is `originalBasis`: what they put in, which is the only
					    figure on a closed argument that is not zero. */}
					<td
						data-testid={`tile-staked-${tile.key}`}
						className="p-2 text-center align-baseline whitespace-nowrap tabular-nums text-ink"
					>
						Đ {formatDharma(tile.valueDisplay)}
					</td>
					{/* ⚠ `OPENED`, NOT `EXITED`, AND THE DTO IS WHY. `ProfilePositionLot`
					    carries `placedAt` and no exit timestamp; `lots.updated_at` exists
					    in the schema but is LAST-TOUCHED, so on an argument sold twice it
					    is the second sell and on an untouched one it equals `createdAt`.
					    Labelling that `Exited` would print a partial sale's date as an
					    exit date. RF-13 forbids adding a query to get a real one.
					    ⚠ `fmtUtcDay` is the SHIPPED formatter — UTC and locale-free, so
					    the server and client renders cannot disagree. `toLocaleDateString`
					    resolves per-runtime and would be a hydration mismatch. */}
					<td
						data-testid={`tile-opened-${tile.key}`}
						className="p-2 text-center align-baseline whitespace-nowrap text-n5"
					>
						{tile.placedAt === null ? "—" : fmtUtcDay(tile.placedAt)}
					</td>
				</>
			)}
		</tr>
	);
}

/**
 * The tile's argument cell — the ARGUMENT'S OWN title (the §9 deep link) and its
 * reply context, or the removed stub.
 *
 * ⛔ **THE MARKET SUB-LINE IS GONE, AND ITS REMOVAL IS THE POINT OF RF-3.** Every
 * tile used to repeat `Will the Zugzwang repo reach 100,000 stars?` under its
 * own title, so a participant holding three arguments in one market read that
 * question three times. The group header above names the market once.
 *
 * ⚠ SC-1 — the removed variant carries NO title field, so a leak here is a
 * compile error rather than a review item.
 */
function TileArgumentCell({
	cell,
	tileKey,
}: {
	cell: ProfileArgumentCell;
	tileKey: string;
}): React.JSX.Element {
	if (cell.removed) {
		return (
			<span
				data-testid={`tile-arg-removed-${tileKey}`}
				className="text-[11px] leading-[1.35] font-semibold text-n5 italic"
			>
				{REMOVED_STUB_TEXT}
			</span>
		);
	}
	return (
		<span data-testid={`tile-arg-${tileKey}`} className="text-ink">
			{/* `line-clamp-4` is the other half of RF-10's equal-height rule: a `<tr>`
			    height is a FLOOR and cannot cap content, so this is what stops one long
			    argument outgrowing its third. ⛔ `line-clamp-*` already makes the
			    element a `-webkit-box`; adding `block` beside it is two utilities for
			    one property and the clamp goes INERT — measured once already. */}
			<Link
				href={`/m/${cell.marketSlug}?post=${cell.postOrdinal}`}
				className="line-clamp-4 text-[14px] leading-[1.35] font-bold hover:underline"
			>
				{cell.title}
			</Link>
			{cell.isReply && cell.repliedToTitle !== null && (
				<span className="line-clamp-2 text-[11px] leading-[1.35] font-semibold text-n5">
					Replied to {cell.repliedToTitle}
				</span>
			)}
		</span>
	);
}

/**
 * HTML-FINISH row 2 — THE ARENA HALF IS A BORDERED PANEL WITH A HEADER BAR.
 * Canon §2 rules the arena as two panels; canon §6 (Profile) names the left one:
 * "list `Positions`".
 *
 * ⚠ EVERY VALUE IS TRACED, none read off the mockup, whose 1px-solid-ink border,
 * 52px min-height and 10/14px paddings are light-prototype numbers:
 *   `[border:var(--hairline)]`        ← HeroPanels.tsx:138, DebateColumn.tsx:48
 *   `[border-bottom:var(--hairline)]` ← the same token at HeroPanels.tsx:296
 *   `rounded-[var(--r)]` · `bg-n0`    ← HeroPanels.tsx:101
 *   `p-3` (bar and body)              ← this surface's own Card padding
 *   `gap-2` (the bar cluster)         ← the filter row this bar replaces
 *   `font-medium text-ink`            ← IdentityCard.tsx's pseudonym
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
	controls?: React.ReactNode;
	/**
	 * The scroll container the three-tile window caps. It lives here and is
	 * measured there, so the ref is handed down rather than the measurement moved
	 * up: the panel owns the box, the table owns the tiles, and the effect needs
	 * both.
	 */
	bodyRef?: React.Ref<HTMLDivElement>;
	children: React.ReactNode;
}): React.JSX.Element {
	return (
		<section
			data-testid="positions-panel"
			aria-label="Positions"
			// `min-h-0` so the panel can be SHORTER than its content, which is what
			// makes the body below scroll instead of the panel growing.
			className="flex min-h-0 flex-col overflow-hidden rounded-[var(--r)] bg-n0 [border:var(--hairline)]"
		>
			{/* `relative` is the market popover's POSITIONING CONTEXT, and it lives
			    here rather than on the trigger — see the ⛔ at the trigger for the
			    measurement that moved it. `min-h-[52px]` is the mockup's
			    `.colhead{min-height:52px}`, landed on all panel heads in one commit so
			    the two side-by-side bodies start level. */}
			<div
				data-testid="positions-panel-head"
				className="relative flex min-h-[52px] flex-wrap items-center gap-2 p-3 [border-bottom:var(--hairline)]"
			>
				{/* ⛔ `uppercase` IS A TRANSFORM: `textContent` is still `Positions`, so
				    every consumer that reads this head by text keeps its handle. */}
				<span className="text-[11px] leading-[1.2] font-extrabold tracking-[0.12em] text-ink uppercase">
					Positions
				</span>
				{controls}
			</div>
			{/* THE PANEL-SCOPED SCROLL — the mockup's `.colwrap{flex:1 1 auto;
			    min-height:0; overflow-y:auto}`, topology throughout.
			    ⛔ NO `scroll-snap` (RF-10): snap fights trackpads, and it fights the
			    arrow keys about what "next" means — the stepper moves the SELECTION
			    and scrolls it into view at `block:"nearest"`, which snap would then
			    override with its own idea of a resting position. */}
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

/** One option in the market popover (mockup `.fopt`). A `<button>` inside a
 * `role="listbox"`, so it is keyboard-reachable by default and needs no
 * roving-tabindex machinery. `aria-selected` carries the current choice — the
 * state a native `<option>` supplied for free and a hand-rolled list must
 * state. */
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
