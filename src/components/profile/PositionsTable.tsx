"use client";

import { TrendingDown, TrendingUp } from "lucide-react";
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
import { ComposerDecimal } from "@/components/debate/composer/sell-convert";
import { allocateDisplayed, formatDharma } from "@/components/debate/format";
import { useIsPhoneTier } from "@/components/debate/phone-tier";
import { REMOVED_STUB_TEXT } from "@/components/debate/placeholders";
import { Button } from "@/components/ui/button";
import { EmptyBlock } from "@/components/ui/empty-block";
import { InfoTip } from "@/components/ui/info-tip";
import { ThumbGlyph } from "@/components/ui/thumb-glyph";
import { GLOSSARY, SOLD_LABEL } from "@/lib/copy/glossary";
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
import { PhoneSellSheet } from "./phone/PhoneSellSheet";
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
 * with the unit changed: three ARGUMENT TILES.
 *
 * ⚠ POSREV-POLISH P-1/P-3 — the arithmetic got SIMPLER, which is the point.
 * RF-10 had to subtract the market group headers from the region because sticky
 * rows take no layout space only while stuck, so in flow each one ate part of a
 * tile's share. With the headers gone there is no chrome inside the tbody at
 * all: the region minus `<thead>` divides by three, and the window cap and the
 * equal-thirds hook can no longer disagree about what counts as a row.
 * ⛔ `--zz-thead-h` and the group-row selector went with it. They existed ONLY to
 * position and to discount those headers; keeping either would be machinery
 * aimed at an element that no longer renders.
 */
const ROW_WINDOW = 3;

/**
 * ⚠⚠ **`signGlyphFor` LIVED HERE AND IS GONE AT POSREV-POLISH-2 R-2.** It made
 * every absolute delta carry a sign, spelling zero `±` — introduced one ruling
 * ago and superseded by the next: the absolute delta itself is replaced by a
 * directional percentage below, so there is no `(±Đ 0)` left for it to sign.
 * ⛔ **`displayPositionProfitLossSigned` IS NO LONGER CALLED FROM THIS FILE**,
 * and its contract is untouched for the callers that remain. Its docblock still
 * states that the CALLER supplies the glyph, which is why signing zero could be
 * done here without editing it — and why removing that choice costs nothing.
 */

/**
 * POSREV-POLISH-2 R-2 — **HOW FAR THIS ARGUMENT HAS MOVED, AS A DIRECTION AND A
 * PERCENT.** It replaces the absolute `(±Đ 0)` delta under Current.
 *
 * ⛔ **IT LIVES HERE RATHER THAN IN `format.ts`.** `displayPositionProfitLossSigned`
 * and `formatDharma` are shared with the debate surfaces and the export; a
 * percentage is a different question with different degenerate cases, and
 * widening either contract to answer it would change what every other caller
 * gets. One call site, one helper.
 *
 * ⚠ **EXACT SPACE, NOT DISPLAYED SPACE**, which is the one way this differs from
 * the delta it replaces. That delta rounded both operands FIRST so that
 * `current − staked` was checkable against the two figures printed beside it
 * (§10.8's displayed-space identity). A percent has no such pair on screen to
 * agree with — R-3 prints the denominator, not the difference — so rounding the
 * operands first would only throw away precision before dividing.
 *
 * The four cases, and why the two boring-looking ones are not the same:
 *   · **no denominator** — `survivingBasis` is zero while shares survive. Real,
 *     not defensive: `lots_sold_zeroes_basis` is ONE-DIRECTIONAL, so an 18-dp
 *     quantization can zero a basis while dust shares remain, and `isOpenLot`
 *     keeps that lot on the Open tab. There is nothing to divide by, so the tile
 *     shows its value and says nothing else. ⛔ Never a `0%`, never a dash —
 *     both would be claims about a movement that cannot be computed.
 *   · **flat** — the delta is exactly zero. An em dash, no glyph.
 *   · **below one percent** — nonzero, rounds to 0. Renders `<1%` WITH its
 *     glyph. ⛔ `0%` beside an arrow reads as a bug; "moved a little" and "did
 *     not move" are different facts and get different marks.
 *   · **moved** — the ordinary case.
 *
 * ⛔ ROUNDED WITH THE DECIMAL, never by casting to a float and rounding — the
 * `Math.round`-over-a-`Number`-cast idiom is exactly what
 * `pct-round-render.test.ts` forbids across this tree.
 * ⚠ AND THAT GUARD IS A TEXT SCAN, SO IT CANNOT TELL A MENTION FROM A USE.
 * This comment originally spelled the banned pattern out literally and reddened
 * the guard from a docblock. Naming it in prose is the fix; widening the
 * predicate to exempt comments is not — the guard's own note is explicit that
 * the census may widen and the predicate may not.
 */
type TileMove =
	| { kind: "none" }
	| { kind: "flat" }
	| { kind: "moved"; up: boolean; label: string; words: string };

function tileMove(basis: string, current: string): TileMove {
	let base: InstanceType<typeof ComposerDecimal>;
	let now: InstanceType<typeof ComposerDecimal>;
	try {
		base = new ComposerDecimal(basis);
		now = new ComposerDecimal(current);
	} catch {
		return { kind: "none" };
	}
	if (!base.isFinite() || !now.isFinite() || !base.greaterThan(0)) {
		return { kind: "none" };
	}
	const delta = now.minus(base);
	if (delta.isZero()) {
		return { kind: "flat" };
	}
	const rounded = delta
		.abs()
		.dividedBy(base)
		.times(100)
		.toFixed(0, ComposerDecimal.ROUND_HALF_UP);
	const belowOne = rounded === "0";
	const up = delta.greaterThan(0);
	return {
		kind: "moved",
		up,
		label: belowOne ? "<1%" : `${rounded}%`,
		// ⛔ THE ARIA TEXT SPELLS THE DIRECTION IN WORDS, and it is not decoration:
		// the surface is monochrome by ruling, so the GLYPH is the only signal that
		// a value went up rather than down — and a screen reader cannot see it.
		words: `${up ? "up" : "down"} ${belowOne ? "less than 1" : rounded} percent`,
	};
}

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
 * Now: one TILE per argument, each exitable on its own, grouped by market in
 * market order.
 *
 * ⚠⚠ **POSREV-POLISH P-1 SUPERSEDES RF-3's GROUP HEADER, AND THIS PARAGRAPH USED
 * TO DESCRIBE IT.** It read: "each market gets a sticky GROUP HEADER carrying
 * that market's `Đa → Đb`, and beneath it one TILE per argument", followed by an
 * argument for why those header figures needed no per-tab arithmetic. Founder
 * ruling: the header ate the vertical rhythm and broke the three-tile window, so
 * it is gone and the market question returns to the tile, under the argument
 * title, where it sat before RF-3.
 * ⛔ **THE CONSEQUENCE, STATED RATHER THAN LOST: `Đa → Đb` renders NOWHERE now.**
 * The tiles still sum to Đb by construction — Đa is Σ surviving lot bases — but
 * the market's own total is off the surface. That is the price of the ruling and
 * it is recorded here so nobody later reads its absence as a bug.
 *
 * ⛔ **"Lot" appears nowhere a participant can read it (ADR-0039 R1).** The word
 * is the schema's. On screen these are ARGUMENTS.
 *
 * **WHY THERE IS NO PER-ARGUMENT `computeSell`.** See `partition.ts`: the curve
 * is concave, so per-argument engine calls would sum to MORE than the holding.
 * Each tile's Current is a PARTITION of the single mark.
 *
 * **The Open/Closed toggle is HOLDING status, not market status (RF-13).** An
 * argument with surviving shares is Open; one with none is Closed. A market with
 * some of each appears in BOTH tabs, showing only that tab's tiles — which is
 * correct and intended. Both tabs carry a bracketed count of the tiles they
 * hold (P-4), from the same two derivations the empty states already read.
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
	 * down so the per-market allocation runs from the very string the tile
	 * renders. The alternative was re-deriving the sum here from `payload.rows`,
	 * which is byte-identical arithmetic over the same rows — and therefore two
	 * implementations that agree right up until one of them is edited. The tile
	 * and the tiles beneath it now cannot disagree, because there is one number.
	 * ⚠ P-1 REMOVED THE GROUP HEADER THAT USED TO RENDER THIS, and the thread is
	 * still load-bearing: the per-market figure is now the invisible PARENT of the
	 * level-2 allocation that apportions the tiles, so the chain "tile → market →
	 * §23 tile" is intact even though its middle term is no longer on screen.
	 * ⚠ OPTIONAL, so every render-test call site that does not exercise the
	 * identity keeps working; absent, each market simply rounds independently.
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
	/**
	 * The tier, read once at the table. `TileRow` reads it too — the hook is a
	 * shared external store, so two readers are one subscription's worth of work
	 * and never two answers.
	 */
	const isPhoneTable = useIsPhoneTier();

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
	// ⛔ BOTH MEASURE THE RENDERED TILE, and POSREV-POLISH moved it three ways at
	// once — P-1 restored the market sub-line, P-2 deleted the `from Đ …` line,
	// P-3 raised the type scale. Any constant written here would have been wrong
	// on the day it was typed; it still is.
	// ⚠ NO `extraHeadSelector` ANY MORE. It existed to discount the sticky market
	// group headers, which P-1 removed — so the only chrome left inside the
	// scroll region is `<thead>`, which the hook already subtracts on its own.
	// Passing a selector that matches nothing would be the same arithmetic wearing
	// a dead argument.
	// ⚠⚠ MOBILE-2e · R-P3 — THE EQUALISER STANDS DOWN ON A PHONE, EXPLICITLY.
	// Its own gate is "can the document still scroll", which was an exact proxy
	// for "below `lg`" until R-P2 hid the arguments panel: with that block gone
	// the phone page fits its viewport, the gate reads "definite region", and the
	// rows were equalised to a THIRD of the screen — 76px at 360 against 133 /
	// 144 / 178 at 375 / 390 / 430, a row growing taller as the phone gets bigger.
	// The proxy was not wrong when it was written; what it stood for moved.
	useEqualRowThirds({
		bodyRef,
		tableRef,
		testidPrefix: "position-tile-",
		rowWindow: ROW_WINDOW,
		rowCount: visibleTiles.length,
		enabled: !isPhoneTable,
	});
	// ⛔⛔ MOBILE-2h · R-2 — THE THREE-TILE WINDOW STANDS DOWN ON A PHONE, AND
	// THIS GATE IS THE SECOND HALF OF THE EQUALISER'S. `useEqualRowThirds` was
	// given `enabled: !isPhoneTable` at round five; this effect — the OTHER
	// mechanism in RF-10's pair — never was, because its own gate ("can the
	// DOCUMENT scroll") happened to read false on a phone page that fitted its
	// viewport. A viewport-tall tile makes the page scroll at every width, so the
	// gate flips true, the cap fires, and the panel resolves to exactly three
	// tiles — MEASURED before this gate existed: `positions-panel-body` at 2370px
	// against 3140px of content at 390x844, i.e. one tile hanging outside the
	// panel's own border, and a `max-height` on the very box the tiles have to
	// escape for the DOCUMENT to be their scroller.
	// ⚠ IT CLEARS ON THE WAY OUT rather than merely returning. An `overflow:
	// visible` box with a stale inline `max-height` still clips nothing and still
	// ends early — the height outlives the stand-down exactly as the equaliser's
	// inline row heights would, which is the lesson `row-thirds.ts`'s own
	// `!enabled` branch already records.
	useEffect(() => {
		const body = bodyRef.current;
		const table = tableRef.current;
		if (body === null || table === null) {
			return;
		}
		if (isPhoneTable) {
			if (body.style.maxHeight !== "") {
				body.style.maxHeight = "";
			}
			return;
		}
		const measure = () => {
			// ⚠ THE STICKY-OFFSET MEASUREMENT WENT WITH THE HEADERS (P-1). It existed
			// to publish the column-header height as `--zz-thead-h` so each market
			// group header could stick just below it. Nothing consumes that property
			// now, and a measurement written to an element no reader reads is worse
			// than absent — it looks load-bearing to the next person editing this.
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
	}, [visibleTiles.length, isPhoneTable]);

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
					{/* ⚠ MOBILE-2e · R-P1 — `min-w-0` ON THE WRAPPER AND THE TRIGGER BOTH,
					    and neither alone is enough. A flex item's default
					    `min-width: auto` refuses to shrink below its content, and
					    `buttonVariants` adds `whitespace-nowrap shrink-0` on top — so
					    without all three the button keeps its full intrinsic width, pushes
					    the pills out of the row, and the head's `flex-nowrap` turns a wrap
					    into an overflow instead of fixing it.
					    ⛔ THE CLIP IS CSS AND NEVER A JS SLICE. `arrangement.test.tsx`
					    asserts this button's whole `textContent` equals
					    `<market title> ▾`, and it is right to: truncating in JavaScript
					    would make the accessible name lie about which market is
					    selected. */}
					<div ref={filterRef} className="max-mobile:min-w-0">
						<Button
							type="button"
							size="xs"
							variant="outline"
							data-testid="positions-market-filter"
							aria-haspopup="listbox"
							aria-expanded={filterOpen}
							/* ⛔⛔ MOBILE-2h · R-1 — `max-w-full` IS WHAT MAKES THE SHIPPED
							   TRUNCATE BITE, AND ITS ABSENCE WAS A MEASURED LEAK. Round five
							   put `min-w-0` and `shrink` here and `min-w-0` on the wrapper,
							   reasoning about a flex item's automatic minimum — and the
							   reasoning was about the wrong box. THE WRAPPER IS A PLAIN
							   `<div>`, so it is `display: block`, so this button is an
							   INLINE-LEVEL box inside it and not a flex item of it at all:
							   `flex-shrink` here names nothing, and the button keeps its
							   `whitespace-nowrap` intrinsic width. MEASURED at 360px with a
							   market selected: the wrapper shrank correctly to 45px and the
							   button inside it rendered 301px, overflowing the panel by 91px
							   and painting under the Open/Closed pills — which is why the
							   founder sees `Closed (n)` with its count unreadable. The inner
							   span's `truncate` was live the whole time and measuring against
							   the button's own 301px, so it had nothing to cut.
							   ⇒ `max-w-full` caps the button at its wrapper's resolved width,
							   which is what the shrink was always meant to produce. The other
							   three tokens stay: they are what shrinks the WRAPPER. */
							className="max-mobile:max-w-full max-mobile:min-w-0 max-mobile:shrink max-mobile:overflow-hidden"
							onClick={() => setFilterOpen((o) => !o)}
						>
							{/* ⛔ THE LABEL IS WRAPPED SO IT CAN ELLIPSIZE, and the wrapper
							    is what makes the clip READ as a clip. `text-overflow` applies
							    to a BLOCK container of inline text; on the button itself it
							    reaches nothing, because contiguous text inside a flex
							    container becomes an ANONYMOUS flex item and the declaration
							    never gets to it. MEASURED before this wrapper existed: at
							    375px the label ended mid-word — `All market` — with the
							    caret gone and no ellipsis, 8px short of the Open pill. There
							    was no overlap and no missing gap; there was simply nothing
							    saying the text continued.
							    ⚠ ONE span around BOTH the label and the caret, so the
							    button still has exactly one flex item and the desktop's
							    intrinsic width is unchanged — and so `textContent` is still
							    `<market title> ▾`, which `arrangement.test.tsx` asserts by
							    equality and which a JS slice would have made a lie. */}
							<span className="min-w-0 max-mobile:truncate">
								{marketOptions.find(([id]) => id === market)?.[1] ??
									"All markets"}{" "}
								▾
							</span>
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
					    ⚠⚠ P-4 — **BOTH LABELS CARRY A BRACKETED COUNT NOW.** RF-7 put one
					    on `Closed` alone, which made the two tabs look like different
					    kinds of thing: one a place, the other a place with a quantity. It
					    reads `Open (4)` · `Closed (3)`.
					    ⛔ BOTH COUNT **TILES**, and both come from the derivations that were
					    already here rather than from a second one written for the label.
					    `openCount` and `closedCount` are what the RF-14 empty states read
					    to decide whether the OTHER tab holds anything — so a label that
					    disagreed with them would be a surface contradicting its own empty
					    state. One derivation, two readers.
					    ⚠ `openCount` COUNTS THE WHOLE-HOLDING FALLBACK AS ONE. A drifted
					    holding has zero surviving lots and renders exactly one Open tile;
					    counting lots would print `Open (0)` above a visible tile. That is
					    handled where the count is derived, not here.
					    ⚠ The number stays in its own node so the word remains readable as a
					    word and the count is separable; the brackets are text in that node
					    rather than a wrapper, so a reader copying the label gets `(4)`. */}
					<span
						data-testid="positions-status-filter"
						className="ml-auto flex items-center gap-1"
					>
						{(["Open", "Closed"] as const).map((s) => (
							<InfoTip
								key={s}
								content={s === "Open" ? GLOSSARY.tabOpen : GLOSSARY.tabClosed}
								asChild
							>
								<button
									type="button"
									data-testid={`positions-status-${s.toLowerCase()}`}
									aria-pressed={status === s}
									onClick={() => setStatus(s)}
									/* ⚠ MOBILE-2h · R-1 — 11px and tighter padding on the phone, so
									   `Open (4)` and `Closed (2)` keep their COUNTS at 360px instead
									   of being overprinted by the market filter beside them. The
									   pills stay `shrink-0`: the count is the thing this row exists
									   to show, and a shrinking pill would drop it first. */
									className={`inline-flex h-6 shrink-0 items-center gap-1 rounded-(--r) px-2 text-xs font-medium transition-all outline-none select-none focus-visible:shadow-(--state-focus-ring) max-mobile:px-1.5 max-mobile:text-[11px] ${
										status === s
											? "bg-n7 text-ground"
											: "text-n5 [border:var(--hairline)] hover:bg-(--state-hover-fill)"
									}`}
								>
									{s}
									<span
										data-testid={
											s === "Closed"
												? "positions-closed-count"
												: "positions-open-count"
										}
										className="tabular-nums"
									>
										({s === "Closed" ? closedCount : openCount})
									</span>
								</button>
							</InfoTip>
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
					/* ⚠⚠ MOBILE-1 · JOB B — BELOW 640px THIS STOPS BEING A TABLE BOX.
					   ADR-0048 item 2. ⛔ THE TWO TABS BREAK DIFFERENTLY AND THE DIFFERENCE
					   IS STATED RATHER THAN AVERAGED — measured at 375px on staging and on
					   a local rig against the staging DB, both tabs separately:
					     · OPEN — `96 · 0 · 124 · 104` = 324px of fixed columns inside a
					       293px content box. `Argument` computes to ZERO, the argument
					       renders at width 0, `ARGUMENT` and `CURRENT` overprint at l=137,
					       and the panel becomes a nested horizontal scroller (348 vs 317)
					       with 12 descendants escaping its right edge by 19px.
					     · CLOSED — `96 · 13 · 92 · 92` = 293px, which FITS. There is no
					       overflow, no nested scroller and nothing escapes; the failure is
					       an `Argument` column 13px wide, which cannot render a word.
					   ⚠ ADR-0048 `:62` measured the OPEN tab only and RECON's "same shape"
					   was carried into a ratified document as though it had been measured —
					   the defect this job's correction 1 exists for. Repeating it here would
					   be worse than in the ADR, because nothing regenerates a docblock: a
					   later reader debugging Closed would hunt a 31px overflow that has
					   never existed on that tab. ⛔ ADR-0048's owed patch record (OI-1)
					   takes the CLOSED figures above — 13px inside 293 — and not the
					   `≈37px inside 317` arithmetic, which subtracted from the panel's
					   `clientWidth` and missed this body's own `p-3`.
					   ⛔ THE THREE TOKENS ARE APPENDED, NEVER SUBSTITUTED (ADR-0045's
					   override-never-replace). `w-full`, `table-fixed` and the four `<th>`
					   widths all stay exactly where they are and simply STOP BEING
					   CONSULTED below 640px, because `table-layout` applies only to table
					   boxes. That is what makes zero desktop regression structural rather
					   than a thing to re-measure — a `max-mobile:` token cannot match at
					   ≥640px — and it is measured anyway by stripping these tokens off the
					   live nodes at 1440 and 641 and asserting byte-identical boxes.
					   ⚠ `gap-3` HERE IS THE INTER-GROUP GAP — the space between two
					   MARKETS. Its sibling on the `<tbody>` below is a DIFFERENT
					   declaration covering two arguments in ONE market, and either can
					   fail alone. Both byte-carry `ArgumentList.tsx`'s `flex flex-col
					   gap-3` so a card here and a card there sit at the same rhythm. */
					/* ⚠ MOBILE-2e · R-P3 — THE TWO PHONE GAPS ARE GONE, BOTH OF THEM, and
					   that is the separator changing MECHANISM rather than a tidy-up.
					   Job B's `gap-3` — here between MARKETS, and on each `<tbody>`
					   between ARGUMENTS — was the space that made a stack of outlined
					   cards read as separate cards. The ruled phone row is a
					   hairline-divided list, so the space closes and the hairline on each
					   row's top edge does the dividing instead. Leaving the gaps would put
					   12px of ground between every pair of hairlines, which reads as
					   neither one thing nor the other. */
					className="w-full table-fixed text-left text-sm max-mobile:flex max-mobile:flex-col"
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
					{/* ⚠ MOBILE-1 · JOB B — THE HEADER ROW DROPS OUT BELOW 640px. Once
					    the table is a flex column the header is just another stacked
					    child, and a row of four column names above a stack of cards names
					    nothing. ⛔ THIS IS WHAT COSTS THE TWO Closed-tab LABELS: with the
					    `<th>`s gone, `Staked` and `Opened` are bare figures, so each cell
					    below re-states its own header at phone width — byte-carried from
					    these exact strings, never authored. The Open tab needs no such
					    thing: `Đ 227 ↑12%` beside a Sell button is self-describing where
					    `Đ 100` above a bare date is not.
					    ⚠ AND IT IS WHAT LOSES THE `Current` InfoTip (GLOSSARY.currentValue)
					    at phone width — ruled an accepted cost, not repaired, because the
					    repair is an Open-tab label and that is copy authoring. The sting is
					    real and stated rather than buried: INFO-1 built `InfoTip`
					    specifically to open on touch as well as hover, so this drops a
					    touch affordance on the touch surface. The `Staked` tip survives by
					    riding its new label below. */}
					<thead className="sticky top-0 z-10 bg-n0 shadow-[0_calc(var(--spacing)*-3)_0_0_var(--color-n0)] text-[8.5px] leading-[1.2] font-extrabold tracking-[0.12em] text-n4 uppercase max-mobile:hidden">
						<tr>
							<th className="w-[96px] px-2 pt-0 pb-2 text-center">Position</th>
							<th className="px-2 pt-0 pb-2 text-center">Argument</th>
							{isOpenTab ? (
								<>
									<InfoTip content={GLOSSARY.currentValue} asChild>
										<th className="w-[124px] px-2 pt-0 pb-2 text-center">
											Current
										</th>
									</InfoTip>
									<th className="w-[104px] px-2 pt-0 pb-2 text-center">Sell</th>
								</>
							) : (
								<>
									<InfoTip content={GLOSSARY.stakedOwn} asChild>
										<th className="w-[92px] px-2 pt-0 pb-2 text-center">
											Staked
										</th>
									</InfoTip>
									<th className="w-[92px] px-2 pt-0 pb-2 text-center">
										Opened
									</th>
								</>
							)}
						</tr>
					</thead>
					{groups.map((group) => (
						<tbody
							key={group.marketId}
							/* ⚠ MOBILE-1 · JOB B — THE ONLY ONE OF THE FOUR EDIT SITES THAT
							   ADDS A `className` RATHER THAN APPENDING TO ONE, which is why
							   it can fail differently from the other three: there is no
							   existing declaration here to override, so nothing about the
							   desktop render depends on this attribute existing.
							   ⚠ THIS `gap-3` IS THE INTRA-GROUP GAP — two ARGUMENTS in ONE
							   market — and is a DIFFERENT declaration from the identical
							   token on the `<table>` above, which spaces one market from the
							   next. Two markets can be correctly spaced while two arguments
							   inside one market are not; that is why both are written and
							   both are measured. */
							className="max-mobile:flex max-mobile:flex-col"
						>
							{/* ⛔⛔ POSREV-POLISH P-1 — THE MARKET GROUP HEADER IS GONE, AND THIS
							    `<tbody>` IS WHAT SURVIVES IT. RF-3 gave each market a sticky header
							    carrying `Đa → Đb`; the founder has ruled it out because it ate the
							    vertical rhythm and broke the three-tile window. The market question
							    moves back INSIDE each tile, under its argument title, exactly where
							    it sat before RF-3.
							    ⛔ THE GROUPING ITSELF STAYS. One `<tbody>` per market, in market
							    order — the header was the only thing removed, not the structure. A
							    flat list would let two tiles from one market be separated by a third
							    from another, which is a different surface, not a tidier one.
							    ⚠ WHAT THIS COSTS, RECORDED RATHER THAN DROPPED: the market's own
							    `Đa → Đb` now renders NOWHERE. The tiles still sum to it by
							    construction — Đa is Σ surviving lot bases — but the total itself is
							    off the surface. That is a consequence of the ruling, not a defect.
							    ⛔ `group.headerValue` IS STILL COMPUTED AND STILL LOAD-BEARING. It is
							    the PARENT of RF-15's level-2 allocation, which is what makes the
							    tiles sum to the §23 Positions-value tile through level 1. Nothing
							    renders it now, and it must not be "simplified" to a round0 per tile:
							    that is the P-6 defect (Đ 920 above rows adding to Đ 921) returning. */}
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
	/**
	 * Đb on Open; Σ original basis on Closed — the DISPLAYED (allocated) figure.
	 * ⛔ NOT RENDERED since P-1 removed the group header. It is kept because it
	 * has a SECOND job: it is the PARENT of RF-15's level-2 allocation, so the
	 * tiles are apportioned from it and therefore sum to the §23 Positions-value
	 * tile. Its sibling `headerStaked` (Đa) had no such second job and went with
	 * the header — which is the same fact as "the market's Đa → Đb no longer
	 * renders anywhere", stated where a reader of this type will meet it.
	 */
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
	/**
	 * MOBILE-2e · R-P3 — WHERE THE ARMED STATE LIVES, AND WHY IT IS A JS BRANCH
	 * RATHER THAN A CLASS.
	 *
	 * On the desktop the armed state replaces two cells IN the row. On a phone
	 * those cells are 64px and ~52px, which is not room for an editable figure
	 * beside `Confirm` and a cancel — so the phone arms a SHEET instead. Both
	 * sets of controls cannot exist at once: they share `data-testid`s, and a
	 * duplicated testid is a guard reading the wrong node rather than a cosmetic
	 * problem.
	 *
	 * The tier hook is `false` at and above 640px BY CONSTRUCTION — its query is
	 * the negation of a 640px min-width and its server snapshot is `false` — and
	 * `false` in jsdom, which does not implement the media-query API at all. So
	 * the desktop render is untouched and every one of the forty-three shipped
	 * sell tests keeps observing the in-row arm it was written against; none of
	 * them ever reaches the sheet.
	 */
	const isPhone = useIsPhoneTier();
	const armedInRow = armed && !isPhone;
	const armedInSheet = armed && isPhone;
	const move = tileMove(tile.basis, tile.currentExact);
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
					// ⛔⛔ THE SAME `closest` AS THE CLICK GUARD THREE LINES ABOVE, and it
					// used to be narrower — `input` alone. That gap was survivable while
					// the only buttons inside this row were the row's own; MOBILE-2e
					// mounts the phone's SELL SHEET inside this `<tr>` (the containment
					// the outside-click predicate needs), so `Confirm` and the sheet's
					// `×` are now descendants too. `preventDefault()` on keydown
					// suppresses the browser's activation behaviour, so Enter or Space on
					// either produced NO click and the money control was unreachable by
					// keyboard — on a modal that spends twenty lines on focus containment
					// precisely so it would be.
					// ⚠ Found by `@code-reviewer`. jsdom synthesises no click from key
					// activation, and the leaf's own render test mounts it OUTSIDE any
					// `<tr>` — the one context in which this fires is the one that test
					// cannot reproduce.
					if (
						(e.target as HTMLElement).closest(
							"a,button,input,textarea,select,[contenteditable]",
						)
					) {
						return;
					}
					e.preventDefault();
					onPick(tile.key);
				}
			}}
			/* ⚠⚠ MOBILE-1 · JOB B — THE TILE BECOMES A COLUMN, AND THIS IS THE TOKEN
			   THAT ACTUALLY REACHES THE CELLS. A flex container BLOCKIFIES its
			   children — `display: table-cell` on a flex item computes to `block` —
			   so making this `<tr>` a flex column stacks all six `<td>` variants
			   (Position · Argument · Current · Sell on Open; Position · Argument ·
			   Staked · Opened on Closed) WITHOUT OPENING A SINGLE `<td>`. The same
			   rule cascades from the `<table>` down through each `<tbody>`.
			   ⛔ THE TOKENS SIT IN THE STATIC HEAD, NOT INSIDE THE `selected ? … : …`
			   INTERPOLATION. Authored in either branch they would apply only while a
			   tile is selected — a card that stacks when you click it and is a broken
			   row otherwise — and the source-scan guard reads only the static parts
			   of this template precisely so that placement reddens rather than passes.
			   ⚠ WHAT IS TRADED, RECORDED AS A COST RATHER THAN DISCOVERED: `display:
			   flex` on table-internal boxes strips the implicit ARIA `table`/`row`/
			   `cell` roles, so below 640px a screen reader stops announcing "row 2 of
			   7, Current". The obvious repair is blocked — explicit `role="table"` is
			   redundant-role, which Biome rejects, and disabling a Biome rule is
			   ask-first (AGENTS.md §11) — the same wall `aria-current` above already
			   hit over `role="grid"`. It is a cost and not a regression because the
			   CURRENT state is worse: the argument column measures 0px today, so no
			   phone reader can reach the content those roles describe at all.
			   ⚠⚠ MOBILE-2e · R-P3 — THE PHONE READS THE DESKTOP ROW NOW, NOT A CARD.
			   Job B's `max-mobile:flex-col` stacked the four cells and let each keep
			   its inherited `text-center`, which is what produced a centred tile — and
			   centred tiles are what this refinement replaces. The direction flips to
			   a row and each cell takes a phone width below; the cells' own `p-2` goes
			   with it, because four cells' worth of horizontal padding is 64 of the
			   278px a 360px phone has for the whole row, and the argument is what
			   would have paid for it.
			   ⛔ THE SEPARATOR CHANGES MECHANISM AND THE OUTLINE COUNT DOES NOT. Every
			   tile is an individually outlined, radiused card today, separated by
			   `gap-3`. A hairline BETWEEN rows is a different construction, and
			   `selection.test.tsx` counts `[outline:` utilities and requires EXACTLY
			   ONE in either state — so the outline is not joined by a border, it is
			   SUPPRESSED at phone width and a top border takes over. The selected arm
			   keeps its `bg-n1`, which is what still says "this one" once the outline
			   is gone. */
			/* ⚠⚠ MOBILE-2h · R-2 — THE PHONE ROW BECOMES A TILE: ONE POSITION, ONE
			   SCREEN. Round five made this `<tr>` a flex ROW of four cells, which was
			   right for a list and is wrong for a tile — a tile has a top cluster, a
			   gap, and a line anchored to its bottom, and those are three bands rather
			   than one line.
			   ⛔ GRID RATHER THAN FLEX, AND THE REASON IS THE DOM ORDER. The cells are
			   fixed at side · argument · value · Sell, and the tile wants side and
			   value and Sell on ONE line with the argument BELOW them. A flex row
			   cannot do that without `flex-wrap`, and a wrapped flex line's height is
			   governed by `align-content`, which stretches EVERY line equally — so the
			   top cluster would take half the screen. `order` does not help: it moves
			   items within lines, not lines. Grid places all four by coordinate
			   without opening a single `<td>`, and `grid-rows-[auto_1fr]` gives the
			   leftover height to row 2 alone, which is exactly the ruling.
			   ⛔ `min-h`, NEVER `h`. A market question longer than a screen must GROW
			   the tile; a definite height would clamp it or scroll it inside itself,
			   both of which the ruling forbids.
			   ⚠ THE HEIGHT IS `<main>`'s OWN EXPRESSION, NOT A NUMBER CHOSEN HERE.
			   `(public)/layout.tsx` sizes `<main>` at `calc(100dvh-60px-2px)` below
			   640px: `60px` is `GlobalHeader`'s inner row and `2px` its `border-y`.
			   That header is `sticky top-0`, so it is the only fixed chrome above this
			   list, and the viewport minus it is the visible area a tile has to fill.
			   MEASURED at three widths: 782 at 390x844, 738 at 360x800, 870 at
			   430x932 — the viewport height minus 62 exactly, every time.
			   ⚠ `scroll-mt-[62px]` IS THE SAME 62px SAID TO THE SNAP ENGINE. Without
			   it `snap-start` rests the tile's top at the SCROLLPORT's top, which the
			   sticky header covers; with it the tile lands immediately below the
			   header and fills the screen exactly. Measured: tile top = 62 at every
			   width, against 107 without it.
			   ⚠ `snap-always` is what makes it "one at a time" — a proximity snap
			   alone lets a fast flick pass several tiles.
			   ⛔⛔ MOBILE-2h · R-3 — NO SELECTED VISUAL BELOW 640, AND THE STATE IS
			   KEPT. `bg-transparent` overrides the selected arm's `bg-n1` and the
			   resting arm's `hover:bg-n1` — the same mechanism the shipped
			   `[outline:none]` beside it already uses, and the same one MOBILE-2e
			   measured for `bg-(--btn-fill)` against `max-mobile:bg-ink`. ⚠ THE
			   SELECTION ITSELF IS UNTOUCHED: `aria-current`, `tabIndex` and the sell
			   sheet's `armedLotId` all still read it. Only the paint goes, and only
			   here — scrolling past a tile must leave nothing behind. */
			className={`cursor-pointer rounded-(--r) focus-visible:shadow-(--state-focus-ring) max-mobile:grid max-mobile:min-h-[calc(100dvh-60px-2px)] max-mobile:snap-start max-mobile:snap-always max-mobile:scroll-mt-[62px] max-mobile:grid-cols-[auto_1fr_auto] max-mobile:grid-rows-[auto_1fr] max-mobile:items-center max-mobile:gap-x-2 max-mobile:gap-y-2 max-mobile:rounded-none max-mobile:bg-transparent max-mobile:px-0 max-mobile:py-2.5 max-mobile:[border-top:var(--hairline)] max-mobile:[outline:none] max-mobile:hover:bg-transparent ${
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
			    ⚠⚠ `align-middle`, AND IT USED TO BE `align-baseline` FOR A STATED
			    REASON. That note read: baseline alignment "ties the two first lines
			    together regardless of how many lines follow", which is true and was
			    right while a tile stood at its content height. It stopped being right
			    when `useEqualRowThirds` began forcing every tile to a third of the
			    region: the row is then MUCH taller than its content, and top-aligning
			    inside it leaves the founder's "large void below" with the side marker
			    pinned to the ceiling. P-3 rules the content centred in the tile.
			    ⚠ THE SIDE AND THE TITLE NO LONGER SHARE A BASELINE, which is what was
			    traded away. With both cells centred they share a CENTRE instead, and
			    that reads as deliberate at every title length rather than only at one. */}
			{/* ⚠ 48px — the natural width of `Yes` plus its glyph at 15px, not a
			    number chosen against the column. `shrink-0` is what stops the flexible
			    argument beside it borrowing from the side. */}
			{/* ⚠ MOBILE-2h · R-2 — COLUMN 1, ROW 1, AND NO WIDTH. Round five gave this
			    cell `w-12` because it was a flex item competing with three others for
			    278px; in a grid it is an `auto` track that takes exactly what it
			    renders, so a declared width would only be a floor the 24px type could
			    overrun. `shrink-0` goes with it — there is nothing to shrink against. */}
			<td className="p-2 align-middle max-mobile:col-start-1 max-mobile:row-start-1 max-mobile:p-0">
				{/* ⚠ 24px ON THE PHONE, AND THE GLYPH GOES UP WITH IT VIA CSS RATHER
				    THAN VIA THE PROP. `ThumbGlyph` takes a `size` NUMBER, so re-pointing
				    it per tier would need a `useIsPhoneTier()` branch in the render —
				    and the hook's server snapshot is `false`, so the phone would paint a
				    15px glyph and then pop to 24 on hydration. A class on the parent
				    reaches the `<svg>`'s width/height ATTRIBUTES (CSS wins over
				    presentational attributes) and is correct in the very first frame. */}
				<span
					data-testid={`tile-side-${tile.key}`}
					className="flex items-center justify-center gap-[5px] text-[15px] leading-[1.35] font-extrabold text-ink max-mobile:gap-2 max-mobile:text-[24px] max-mobile:leading-[1.2] max-mobile:[&>svg]:size-6"
				>
					{tile.side === "YES" ? "Yes" : "No"}
					{/* ⚠ 15, AND DELIBERATELY NOT 16. P-3 raises the side marker with the
					    rest of the tile's type (13px → 15px), so the glyph goes up with it.
					    ⛔ 16 IS `ThumbGlyph`'s OWN DEFAULT, so `size={16}` would be
					    byte-identical to omitting the prop — a later reader could not tell
					    a deliberate re-point from a default leaking through. That is
					    `surface.test.tsx`'s own argument for the previous 14 and it
					    survives the size change; only the number it protects has moved. */}
					<ThumbGlyph side={tile.side} size={15} />
				</span>
			</td>
			{/* ⚠ `min-w-0` IS THE ONE THAT MATTERS. A flex item will not shrink below
			    its content without it, and the argument is the only cell here whose
			    content is unbounded — without it the row overflows instead of the
			    title clamping. */}
			{/* ⚠⚠ MOBILE-2h · R-2 — ROW 2, SPANNING THE WHOLE TILE, AND THE ONLY
			    STRETCHING CELL. `grid-rows-[auto_1fr]` hands every leftover pixel to
			    row 2; `self-stretch` is what lets this cell take it, because the grid
			    is `items-center` for the three cells on row 1. `min-w-0` survives
			    round five unchanged and for the same reason: a grid item's automatic
			    minimum is its content, and the argument is the only unbounded text
			    here, so without it the TILE widens instead of the text wrapping.
			    ⛔ `flex-1` IS GONE, not forgotten — it was a flex declaration and this
			    is no longer a flex container, so it named nothing. */}
			<td className="p-2 align-middle max-mobile:col-span-3 max-mobile:col-start-1 max-mobile:row-start-2 max-mobile:min-w-0 max-mobile:self-stretch max-mobile:p-0">
				<TileArgumentCell
					cell={tile.argument}
					tileKey={tile.key}
					marketTitle={tile.row.marketTitle}
				/>
			</td>
			{isOpenTab ? (
				<>
					{/* ⚠⚠ P-2 — THE CURRENT CELL STACKS **TWO** LINES NOW, and RF-4's third
					    is gone. It read `Đ 10 / (Đ 0) / from Đ 10`; the `from` line is
					    removed by founder ruling.
					    ⛔ WHAT THAT COSTS, RECORDED RATHER THAN DROPPED: `from Đ …` was the
					    on-screen REFERENCE that made `current − from = delta` checkable by
					    eye, which is the whole reason §10.8 admits this delta as a
					    displayed-space identity in the first place. The delta is still
					    computed in displayed space and is still true — it simply no longer
					    has its second operand visible beside it. A reader can no longer
					    verify it without leaving the row.
					    ⚠ THE DELTA'S BASE IS `survivingBasis`, NOT `originalBasis`, and
					    the two are byte-identical until an argument is PARTIALLY sold.
					    There, `current` is the value of what SURVIVES — so subtracting
					    what was originally committed would print a large loss for someone
					    who has actually taken money out. RF-7 also rules that a partial
					    sale carries no tag and that "figures reduce" is the whole signal;
					    an immutable base cannot reduce, and the reduction would leave no
					    trace on the surface at all. */}
					{/* ⚠ 64px and RIGHT-aligned at phone width. The desktop centres this
					    cell over a 124px column; in 64px beside a flexible argument,
					    centring reads as drift and the figures stop forming a column an
					    eye can run down. */}
					{/* ⚠ MOBILE-2h · R-2 — COLUMN 2, ROW 1, HUGGING THE SELL BUTTON.
					    Round five's `w-16` was 64px for a 17px figure; the tile prints it
					    at 24px, where 64px would clip a five-figure Đ value. The column
					    is `1fr` and this cell is `justify-self-end`, so the figure sits
					    against Sell and the side marker keeps the left edge — the width
					    is whatever the number needs and never a cap. */}
					<td className="p-2 text-center align-middle whitespace-nowrap tabular-nums text-ink max-mobile:col-start-2 max-mobile:row-start-1 max-mobile:justify-self-end max-mobile:p-0 max-mobile:text-right">
						{sold ? (
							<InfoTip content={GLOSSARY.sold} asChild>
								<span
									data-testid={`tile-sold-${tile.key}`}
									className="text-[11px] leading-[1.2] font-extrabold tracking-[0.1em] text-n5 uppercase"
								>
									{SOLD_LABEL}
								</span>
							</InfoTip>
						) : armedInRow ? (
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
							/* ⚠ MOBILE-2h · R-2 — THE VALUE AND ITS MOVEMENT SHARE A LINE ON
							   THE PHONE. Stacked, they would be two of the tile's three bands
							   and the top cluster would read as four lines rather than two.
							   `items-baseline` rather than `items-center`: a 13px percentage
							   beside a 24px figure looks dropped when it is centred. */
							<span className="flex flex-col items-center leading-[1.35] max-mobile:flex-row max-mobile:items-baseline max-mobile:justify-end max-mobile:gap-1.5">
								{/* ⚠ P-3 — 17px. It was inheriting the table's `text-sm`, so the
								    figure the column is named after was set at the same size as
								    the argument title beside it and smaller than nothing on the
								    row. Leading restated with the size, per AGENTS.md §8. */}
								{/* ⚠ MOBILE-2h · R-2 — 24px, the largest thing on the tile. The
								    leading is restated with the size because an arbitrary
								    `text-[Npx]` inherits whatever leading was in scope
								    (AGENTS.md §8) — here `leading-[1.35]`, which at 24px is a
								    32px line and pushes the whole cluster down. */}
								<span className="text-[17px] leading-[1.35] font-bold max-mobile:text-[24px] max-mobile:leading-[1.2]">
									Đ {formatDharma(tile.valueDisplay)}
								</span>
								{/* ⚠⚠ R-2 — THE MOVEMENT LINE. Three renderable outcomes and one
								    silence, and the silence is the interesting one: a lot whose
								    basis has been quantized to zero while shares survive has no
								    denominator, so it says nothing rather than inventing a `0%`.
								    ⛔ THE GLYPH CARRIES THE DIRECTION ALONE. This surface is
								    monochrome by ruling — green and red were proposed and refused
								    — so there is no colour behind the arrow and none is coming.
								    `TrendingUp`/`TrendingDown` rather than `ArrowUp`/`ArrowDown`:
								    a plain arrow on a table reads as a sort control.
								    ⚠ `aria-label` ON THE LINE, because a reader who cannot see the
								    glyph would otherwise get a bare percentage with no sign. */}
								{move.kind === "flat" && (
									<span
										data-testid={`tile-pl-${tile.key}`}
										role="img"
										aria-label="unchanged"
										className="text-[10.5px] leading-[1.2] font-bold text-n5 max-mobile:text-[13px]"
									>
										—
									</span>
								)}
								{move.kind === "moved" && (
									<span
										data-testid={`tile-pl-${tile.key}`}
										role="img"
										aria-label={move.words}
										className="flex items-center gap-0.5 text-[10.5px] leading-[1.2] font-bold text-n5 max-mobile:text-[13px]"
									>
										{move.up ? (
											<TrendingUp
												aria-hidden="true"
												className="size-3 shrink-0"
											/>
										) : (
											<TrendingDown
												aria-hidden="true"
												className="size-3 shrink-0"
											/>
										)}
										{move.label}
									</span>
								)}
							</span>
						)}
					</td>
					{/* ⚠⚠ RF-5/6/7 — THE SELL COLUMN. Resting: `Sell`. Armed: `Confirm`
					    beside a `✕`. ⛔ THE ✕ IS NOT OPTIONAL — a two-step cushion with
					    no exit is a trap, not a cushion. Escape and a click outside
					    cancel too (wired in `useInlineSell`). */}
					{/* ⚠ MOBILE-2h · R-2 — COLUMN 3, ROW 1. The trailing `auto` track, so
					    SELL is exactly its own width and the value column takes the rest. */}
					<td className="p-2 text-center align-middle max-mobile:col-start-3 max-mobile:row-start-1 max-mobile:p-0">
						{tile.sellable && !sold && (
							<>
								<span className="inline-flex items-center gap-1">
									{armedInRow ? (
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
												// ⚠⚠ R-1 — SIZED DOWN SO THE ✕ FITS. The Sell column is
												// `w-[104px]` and the cell's own `p-2` leaves 88px of
												// content; `CONFIRM` at `text-xs` with `px-2` and
												// `tracking-[0.08em]` measured ~75px, plus a 4px gap and
												// the 24px `icon-xs` ✕ — 103px into 88, so the ✕ was
												// clipped at the tile's right edge. At `text-[10px]` /
												// `px-1.5` / `tracking-[0.04em]` the word is ~58px and the
												// cluster clears the column with room to spare.
												// ⛔ THE HEIGHT IS UNCHANGED (`size="xs"` is `h-6`), so the
												// tap target does not shrink with the label.
												className="px-1.5 text-[10px] font-extrabold tracking-[0.04em] uppercase [border:var(--ring-active)]"
												onClick={() => sell.confirm(tile.key, sellArgs)}
											>
												{sell.busy ? "…" : sell.failed ? "Retry" : "Confirm"}
											</Button>
											<Button
												type="button"
												size="icon-xs"
												variant="ghost"
												aria-label="Cancel sell"
												// ⛔ DISABLED IN FLIGHT, like Confirm and the field.
												// ⚠⚠ THE REASON WRITTEN HERE WAS TRUE ONCE AND IS NOT NOW, and a
												// stated cause that does not exist is a defect in its own right
												// (O-3): the next reader deciding whether the phone's SHEET needs an
												// equivalent guard would reason from a mechanism that has since been
												// closed. It said — cancelling mid-request lets another tile arm,
												// which replaces the key state with a fresh one whose `inFlight` is
												// false, so the live request's outcome is silently dropped.
												// `arm()` now short-circuits while `unsettledKeyRef` matches the live
												// key, which it does by construction during a flight, so the key
												// state is NOT replaced.
												// ⇒ The disable stays, on the plainer ground: a control that can be
												// pressed while its own request is in the air invites a second intent
												// over the first, and nothing downstream should have to be clever
												// about that. `@security-auditor`, LOW.
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
											/* ⚠ MOBILE-2h · R-2 — 16px on the phone, up from `size="xs"`'s
											   `text-xs`. `min-h-11` (44px) is round five's floor and is
											   unchanged; the label grows inside it rather than the target
											   growing with the label. `px-3` because a 16px word inside
											   `size="xs"`'s `px-2` reads as a label with a box drawn round
											   it rather than as a button. */
											className="font-extrabold tracking-[0.08em] uppercase [border:var(--ring-active)] max-mobile:min-h-11 max-mobile:w-full max-mobile:px-3 max-mobile:text-[16px] max-mobile:leading-[1.2] max-mobile:[touch-action:manipulation]"
											onClick={() => sell.arm(tile.key)}
										>
											Sell
										</Button>
									)}
								</span>
								{/* ⛔⛔ MOUNTED INSIDE THIS CELL, AND THE POSITION IS THE POINT.
							    `useInlineSell` arms a document-level `pointerdown` whose
							    predicate is `armedRowRef.current?.contains(target)`, and
							    `armedRowRef` is this `<tr>`. A sheet rendered anywhere else
							    in the tree is not contained by the row, so the FIRST tap
							    inside it — the tap on `Confirm` included — cancels the arm
							    and closes the sheet. A `<div>` inside a `<td>` is valid HTML
							    and `position: fixed` lifts the sheet out of the cell
							    visually, so the DOM position costs nothing and buys the
							    containment without widening `InlineSell`'s ref type.
							    ⚠ `onClose` CANCELS. Every route the sheet can close by — the
							    backdrop, the handle, Escape and the frame's own `×` — lands
							    there, and leaving the arm set behind a closed sheet would
							    strand a controller nothing on screen could reach. (The sheet
							    draws no Cancel of its own; it did in a draft, and that put a
							    SECOND close control beside the frame's.) */}
								{armedInSheet ? (
									<PhoneSellSheet
										tileKey={tile.key}
										seedDisplay={tile.valueDisplay}
										seedExact={tile.currentExact}
										// ⚠ SG-3 MASKING IS A TYPE FACT HERE, not a check: the
										// removed variant carries NO `title` field at all, so the
										// stub is the only thing this branch CAN pass and a leak
										// would be a compile error rather than a review catch.
										argumentTitle={
											tile.argument.removed
												? REMOVED_STUB_TEXT
												: tile.argument.title
										}
										marketTitle={tile.row.marketTitle}
										draft={sell.draft}
										busy={sell.busy}
										failed={sell.failed}
										canSubmit={sell.canSubmit(tile.currentExact, tile.shares)}
										onEdit={sell.edit}
										onSubmit={() => sell.confirm(tile.key, sellArgs)}
										onClose={sell.cancel}
									/>
								) : null}
							</>
						)}
					</td>
				</>
			) : (
				<>
					{/* RF-13's Closed columns. ⛔ NO `Current` — it would read `Đ 0` on
					    every single row. ⛔ NO `Sell` — there is nothing to sell.
					    `Staked` is `originalBasis`: what they put in, which is the only
					    figure on a closed argument that is not zero. */}
					{/* ⛔⛔ MOBILE-2e · R-P3 — THE CLOSED TAB'S TWO CELLS TAKE PHONE
					    WIDTHS TOO, and this was MISSED in the first pass in a way that
					    reproduced the exact defect the refinement exists to remove.
					    The `<tr>` is a flex ROW below 640px now. The Open tab's four cells
					    each declare a share; these two did not — so they kept
					    `min-width: auto`, which for `whitespace-nowrap` content is the
					    full unbreakable string. The Argument cell beside them is
					    `flex-1`, i.e. `flex: 1 1 0%`, so its shrink CONTRIBUTION is
					    `1 × 0 = 0`: it absorbs none of the negative free space, resolves
					    to **0px**, and the row overflows. That is verbatim the condition
					    this refinement was ruled to fix, moved one tab across.
					    ⚠ Nothing measured it: B13 reads the OPEN tab, the new guard
					    asserted on the side cell only, and the shipped reflow guard NAMES
					    all six cell variants in prose while asserting none of them. Found
					    by `@code-reviewer`. */}
					{/* ⚠⚠ MOBILE-2h · R-2 — THE CLOSED TAB RENDERS THE SAME TILE, and its
					    two cells take the same two slots the Open tab's do: the big figure
					    in column 2 and the small qualifier in column 3, where `Đ 227 ↗12%`
					    and `SELL` sit. So a reader who has learned one tab has learned the
					    other, and the grid needs no empty track.
					    ⛔ ROUND FIVE'S `w-16` / `w-20` / `shrink-0` ARE DELETED FROM BOTH
					    CELLS AND THEIR GUARD ROW IS DELETED WITH THEM. They existed because
					    the `<tr>` was a flex ROW and a cell without a declared share left
					    the `flex-1` argument beside it resolving to 0px. There is no such
					    row any more: these are grid items in `auto` tracks, where a width
					    is a floor rather than a share and 64px would clip a 24px figure. */}
					<td
						data-testid={`tile-staked-${tile.key}`}
						className="p-2 text-center align-middle whitespace-nowrap tabular-nums text-ink max-mobile:col-start-2 max-mobile:row-start-1 max-mobile:justify-self-end max-mobile:p-0 max-mobile:text-right max-mobile:text-[24px] max-mobile:leading-[1.2]"
					>
						{/* ⚠⚠ MOBILE-1 · JOB B — THE PHONE'S COLUMN LABEL, AND THE STRING IS
						    CARRIED, NEVER AUTHORED. Below 640px the `<thead>` is hidden, so this
						    cell would render `Đ 100` with nothing naming it. The word is the SAME
						    word the `<th>` uses, and that is what makes "no copy was authored for
						    the phone" checkable rather than claimed: the guard reads the `<th>`
						    text out of this file and asserts byte-identity against this span, so a
						    paraphrase reddens.
						    ⛔ `hidden` IS LOAD-BEARING, NOT DECORATION. A `<span>` is inline
						    ALREADY, so the phone variant alone would be a no-op and this label
						    would print beside the `<th>` that already says it at 1440px — the
						    desktop regression this convention exists to prevent, shipped by the
						    mechanism meant to prevent it. The base `hidden` is what gives the
						    variant something to override.
						    ⚠ THE `Staked` TIP RIDES THE LABEL. `GLOSSARY.stakedOwn` hangs off the
						    `<th>`, which the phone no longer renders, so it is re-attached here.
						    That is the only reason this cell's label carries an `InfoTip` and
						    `Opened`'s does not — that column never had one. ⛔ The Open tab's
						    `Current` tip is NOT rescued this way: that needs an Open-tab label,
						    which is copy authoring, and it is ruled LOST instead. */}
						{/* ⚠ MOBILE-2h — THE LABEL IS AN EYEBROW, NOT PART OF THE FIGURE. The
						    cell now prints at 24px, and the carried `<th>` word would print at
						    24px with it — a column name as loud as the number it names. It
						    takes the same 13px muted step the Open tab's movement line takes,
						    so the two tabs' right-hand clusters read at the same two weights.
						    ⛔ THE STRING IS STILL BYTE-CARRIED FROM THE `<th>`; only its size
						    moved, which is what keeps "no copy was authored for the phone"
						    checkable. */}
						<InfoTip content={GLOSSARY.stakedOwn} asChild>
							<span className="hidden max-mobile:inline max-mobile:text-[13px] max-mobile:leading-[1.2] max-mobile:font-bold max-mobile:text-n5">
								Staked
							</span>
						</InfoTip>{" "}
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
					{/* ⚠ 80px rather than the Staked cell's 64: this one carries a date
					    (`15 Sep 2026`), which is wider than a Đ figure and is the reason
					    the two shares differ. See the Staked cell above for why they need
					    one at all. */}
					{/* ⚠ MOBILE-2h · R-2 — COLUMN 3, where the Open tab puts SELL. A closed
					    argument has nothing to sell, so the slot carries the one fact that
					    is only true of a closed tile: when it was opened. */}
					<td
						data-testid={`tile-opened-${tile.key}`}
						className="p-2 text-center align-middle whitespace-nowrap text-n5 max-mobile:col-start-3 max-mobile:row-start-1 max-mobile:p-0 max-mobile:text-right max-mobile:text-[13px] max-mobile:leading-[1.2]"
					>
						{/* ⚠ THE PHONE'S COLUMN LABEL (MOBILE-1 · JOB B), same mechanism and same
						    rule as `Staked` above: the word is byte-carried from this column's own
						    `<th>`, and the base `hidden` is what stops a span that is already
						    inline from printing at desktop beside the header it duplicates.
						    ⚠ NO `InfoTip` HERE, AND THE ABSENCE IS DELIBERATE. `Opened`'s `<th>`
						    carries no tip to re-attach — adding one would be authoring a glossary
						    entry the desktop surface never had, on the narrower surface. */}
						<span className="hidden max-mobile:inline">Opened</span>{" "}
						{tile.placedAt === null ? "—" : fmtUtcDay(tile.placedAt)}
					</td>
				</>
			)}
		</tr>
	);
}

/**
 * The tile's argument cell — the ARGUMENT'S OWN title (the §9 deep link), the
 * MARKET QUESTION beneath it, and its reply context; or the removed stub.
 *
 * ⚠⚠ **THE MARKET SUB-LINE IS BACK, AND THIS DOCBLOCK ARGUED THE OTHER WAY.** It
 * read: "THE MARKET SUB-LINE IS GONE, AND ITS REMOVAL IS THE POINT OF RF-3 …
 * the group header above names the market once." That reasoning was sound and
 * the founder has overruled its conclusion at POSREV-POLISH P-1: naming the
 * market once cost a sticky header, and the header cost more vertical rhythm
 * than the repetition it saved. So the question returns to each tile, grey and
 * smaller than the argument, exactly as it rendered before RF-3.
 * ⚠ The cost RF-3 named is real and is now paid again: a participant holding
 * three arguments in one market reads the question three times. That is the
 * trade, made knowingly, not an oversight.
 *
 * ⛔ IT RENDERS ON BOTH VARIANTS, including the removed stub — a removed argument
 * still belongs to a market, and the stub without it would be the one tile on the
 * surface that could not say where it came from. `marketSlug` is carried by both
 * variants of `ProfileArgumentCell` precisely so this is possible.
 *
 * ⚠ SC-1 — the removed variant carries NO title field, so a leak here is a
 * compile error rather than a review item. The market TITLE is not participant
 * content and is safe on both arms.
 */
function TileArgumentCell({
	cell,
	tileKey,
	marketTitle,
}: {
	cell: ProfileArgumentCell;
	tileKey: string;
	/** The market question, rendered under the argument title (P-1). */
	marketTitle: string;
}): React.JSX.Element {
	/* ⚠ THE PRE-RF-3 SPELLING, CARRIED RATHER THAN REDESIGNED: 11px / 1.35 /
	   semibold / `text-n5`, `block`, linking to the market. P-1 says "exactly as
	   it rendered before RF-3", so this is that element, not a new one that
	   happens to look similar. Its testid is keyed by TILE rather than by market,
	   because the unit of this table is now the argument and two tiles in one
	   market would otherwise collide on one id. */
	/* ⚠⚠ UI-OVERNIGHT entry 2 — **THE SUB-LINE IS THE MARKET QUESTION AND
	   NOTHING ELSE**, and two things left it in one commit.
	   · `· staked Đ n` — POSREV-POLISH-2 R-3 put it here as the DENOMINATOR for
	     the percentage in the `CURRENT` cell, on the sound reasoning that "a
	     percentage whose denominator appears nowhere is a figure nobody can
	     check". That reasoning still holds and the founder has overruled its
	     conclusion: the row already prints the staked figure in its own column,
	     and a second copy inside a grey sub-line read as part of the market's
	     name rather than as an operand. ⚠ THE PERCENTAGE NOW HAS NO INLINE
	     DENOMINATOR — that is the known cost, reported rather than absorbed.
	   · `Replied to …` — see the reply-context block below.
	   ⚠ THE LINK STILL WRAPS THE QUESTION ONLY. It was the only child of this
	   block before the staked figure joined it, and it is again — a link reading
	   "…5 Nov 2026? · staked Đ 100" would name a destination it does not go to,
	   which is why the two were siblings rather than nested. */
	const marketLine = (
		// ⚠⚠ MOBILE-2h · R-2 — THE CLAMP IS GONE AND THE QUESTION IS THE TILE'S
		// BOTTOM BAND. Round five clamped it to ONE line, and the reason it gave was
		// sound for what it was describing: the question was unbounded text in an
		// ~90px column of a 44px-tall list row, and unclamped it made the row twice
		// as tall as the title above it. A tile is a screen, not a row — there is no
		// height left to protect, and a market question a reader cannot finish is
		// the one thing a full-screen view has no excuse for.
		// ⛔ `mt-auto` IS THE TILE'S ONLY GAP, AND THAT IS THE RULING. The cell above
		// is `grid-rows-[auto_1fr]`'s stretching row, this element is the last child
		// of a flex column inside it, so every leftover pixel in the tile collects
		// HERE — between the title and the question — and nowhere else. Distribute
		// it any other way (`justify-between`, a spacer per band) and a short tile
		// and a tall one stop looking like the same object.
		// ⚠ `pt-3` IS A FLOOR, NOT THE GAP. When the question is long enough to grow
		// the tile past a screen the auto margin resolves to zero, and without a
		// floor the question would touch the title it is meant to sit apart from.
		<span className="block text-[11px] leading-[1.35] font-semibold text-n5 max-mobile:mt-auto max-mobile:line-clamp-none max-mobile:pt-3">
			<Link
				data-testid={`tile-market-${tileKey}`}
				href={`/m/${cell.marketSlug}`}
				className="hover:underline"
			>
				{marketTitle}
			</Link>
		</span>
	);
	if (cell.removed) {
		return (
			// ⚠ MOBILE-2h · R-2 — THE REMOVED STUB IS A TILE TOO, and it takes the
			// same column treatment as the live variant below. A removed argument
			// still belongs to a market, and the question is still the band anchored
			// to the tile's bottom; leaving this arm a plain inline span would give
			// the one tile on the surface that cannot say what it was a different
			// shape from every other.
			<span
				data-testid={`tile-arg-removed-${tileKey}`}
				className="max-mobile:flex max-mobile:h-full max-mobile:flex-col"
			>
				<span className="text-[11px] leading-[1.35] font-semibold text-n5 italic max-mobile:text-[18px] max-mobile:leading-[1.35]">
					{REMOVED_STUB_TEXT}
				</span>
				{marketLine}
			</span>
		);
	}
	return (
		// ⚠ MOBILE-2h · R-2 — THE CELL'S OWN COLUMN. The `<td>` above stretches to
		// the grid's `1fr` row; `h-full` is what passes that height down to this
		// span, and without it `mt-auto` on the market line has no slack to take and
		// the question sits under the title instead of at the tile's foot.
		<span
			data-testid={`tile-arg-${tileKey}`}
			className="text-ink max-mobile:flex max-mobile:h-full max-mobile:flex-col"
		>
			{/* `line-clamp-4` is the other half of RF-10's equal-height rule: a `<tr>`
			    height is a FLOOR and cannot cap content, so this is what stops one long
			    argument outgrowing its third. ⛔ `line-clamp-*` already makes the
			    element a `-webkit-box`; adding `block` beside it is two utilities for
			    one property and the clamp goes INERT — measured once already.
			    ⚠ P-3 RAISED THIS FROM 14px TO 15px. It is the thing the tile is ABOUT
			    and it was set at the same size as the reply context two lines down;
			    the leading is restated with it because an arbitrary `text-[Npx]` keeps
			    whatever leading was in scope (AGENTS.md §8). */}
			<Link
				href={`/m/${cell.marketSlug}?post=${cell.postOrdinal}`}
				// MOBILE-2e · R-P3 — TWO LINES ON A PHONE, four on the desktop. The
				// desktop's four is the other half of RF-10's equal-height rule; at phone
				// width the thirds hook stands down (the page grows, so there is no
				// definite region to divide) and the clamp is free to be what the row
				// needs. In ~90px of flexible column, four lines of a 15px title is most
				// of a screen for one row.
				// NEVER ADD `block` BESIDE A `line-clamp-*`: the clamp already implies
				// `-webkit-box`, and a `display:block` alongside makes it INERT, silently
				// — measured once already on this very cell.
				// ⚠⚠ MOBILE-2h · R-2 — UNCLAMPED AND 18px/medium ON THE PHONE. Round
				// five's two-line clamp was bounding a 44px list row; the tile has a
				// screen, and a truncated argument title on the surface whose whole
				// job is to show one argument would be the defect rather than the
				// protection. `line-clamp-none` is what undoes `-webkit-box` — a bare
				// override of the line count would leave the box intact and the clamp
				// live. ⚠ `font-medium` steps DOWN from the desktop's `font-bold`: at
				// 18px, bold competes with the 24px value beside it, and the ruling
				// puts the value first.
				className="line-clamp-4 text-[15px] leading-[1.35] font-bold hover:underline max-mobile:line-clamp-none max-mobile:text-[18px] max-mobile:leading-[1.35] max-mobile:font-medium"
			>
				{cell.title}
			</Link>
			{marketLine}
			{/* ⚠⚠ UI-OVERNIGHT entry 2 — **THE `Replied to …` LINE IS GONE FROM THIS
			    CELL**, and it is the one removal in this entry that crosses a spec
			    sentence. SPEC.1 §23 lists, for a positions row, "for reply-bets —
			    the parent post reference"; `struck-and-held.test.tsx` row A-7 guards
			    that as a PRESENCE precisely so nobody deletes it on the grounds that
			    the mockup does not show it.
			    ⇒ The founder ruled it out of this cell. The parent reference is NOT
			    lost from the surface: the argument panel to the right renders
			    `Replied to …` under the argument it is showing, which is the place a
			    reader is actually reading the reply. A7's guard is re-pointed there
			    rather than deleted, so the reference is still required to exist —
			    only its location moved.
			    ⛔ SPEC.1 §23 IS OWED AN AMENDMENT and this task does not write it.
			    The divergence is recorded here and in the run report; a comment that
			    contradicts a spec section it names is exactly what O-9 exists to
			    catch, so it says so in terms rather than falling silent. */}
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
 *
 * ⚠⚠ MOBILE-2e · R-P1 — THE HEAD IS ONE ROW BELOW 640px (`max-mobile:flex-nowrap`).
 * MEASURED before changing it: at 360px this head is 82px tall — `Positions` and
 * the market filter share the first line and the `Open (5) / Closed (1)` pair
 * drops to a second — and it does that with the SHORT `All markets` label, i.e.
 * in the best case rather than the worst. `flex-wrap` is what allows it, and
 * `ml-auto` on the pill cluster stops meaning "right" the moment the container
 * is no longer one line.
 * ⇒ The market filter is the child that gives, because it is the only one whose
 * label is variable-length — it becomes a whole market question once a market is
 * picked — so it is the only honest place to take the width from. Its own
 * `min-w-0` tokens are at its call site.
 * ⚠ The `min-h-[52px]` FLOOR is untouched: it is shared with the arguments
 * panel's head and `profile-height-chain.test.ts` pins the two as ONE value.
 * ⚠ The note is here rather than beside the class because that guard reads the
 * className out of a 400-CHARACTER WINDOW after the `data-testid` — a fence by
 * DISTANCE (O-8 in a different unit), which a comment in the gap defeats.
 *
 * ⛔⛔ MOBILE-2h · R-2 — BOTH BOXES RELEASE `overflow` BELOW 640px, AND BOTH NEED
 * `min-w-0` BESIDE IT. This is the note the paragraph above is about, and it is
 * here because putting it beside either class string is what reddened
 * `profile-height-chain` on the first attempt: the fence fired on the very
 * change whose explanation overran it.
 *
 * **Why release at all.** A snap alignment resolves against the nearest
 * SCROLL-CONTAINER ancestor, and both of these boxes are scroll containers — the
 * body by `overflow-y-auto`, the section by `overflow-hidden`, which per CSS
 * Overflow is a scroll container that simply cannot be scrolled by hand. So with
 * either one live, the phone's viewport-tall tiles snap against a panel instead
 * of against the page. MEASURED at 360/390/430: releasing the body alone moves a
 * tile's nearest scroller from `positions-panel-body` to `positions-panel` and
 * the landing still misses by 45px; releasing both moves it to the VIEWPORT and
 * the tile lands exactly, its top edge at 62px. Neither release is sufficient
 * alone.
 *
 * **Why `min-w-0` is not tidying.** `overflow: hidden` does TWO jobs and only one
 * of them is clipping: per CSS Sizing, an `overflow` other than `visible` also
 * zeroes a box's AUTOMATIC MINIMUM SIZE. Releasing it therefore restored
 * `min-width: auto` — min-content — on a box whose widest unbreakable content is
 * the market filter's `whitespace-nowrap` label. MEASURED after shipping the
 * release without it: at 360px with a market selected the panel went 324px →
 * **533px**, carrying the head, the body and the empty state off the right of
 * the screen. `min-w-0` restores the constraint the clip was silently providing,
 * without restoring the scroll container the tiles have to escape.
 *
 * ⚠⚠ AND THE OVERFLOW INSTRUMENT READ ZERO THROUGHOUT THAT. Under mobile
 * emulation the LAYOUT VIEWPORT widens to fit overflowing content, so the usual
 * "scroll width minus window width" stayed 0 while the window itself had grown
 * to 561 on a 360px device. A B2 that trusts that difference reports a clean page
 * on a blown-out one; it now asserts the window against the width it asked for,
 * first, and treats a mismatch as the finding rather than a footnote.
 *
 * ⚠ What `overflow-hidden` was FOR is unaffected below 640px: it kept the header
 * bar's background from squaring off the rounded corner, and that bar declares no
 * background — only a bottom hairline. The `<thead>` that does carry one is
 * `max-mobile:hidden`, so there is nothing painting into the corner to clip.
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
			// `min-h-0`: the panel can be SHORTER than its content. MOBILE-2h's phone
			// pair — `min-w-0` + `overflow-visible` — is explained in this component's
			// docblock and deliberately NOT here; see its last two paragraphs.
			className="flex min-h-0 flex-col overflow-hidden rounded-[var(--r)] bg-n0 [border:var(--hairline)] max-mobile:min-w-0 max-mobile:overflow-visible"
		>
			{/* `relative` is the market popover's POSITIONING CONTEXT, and it lives
			    here rather than on the trigger — see the ⛔ at the trigger for the
			    measurement that moved it. `min-h-[52px]` is the mockup's
			    `.colhead{min-height:52px}`, landed on all panel heads in one commit so
			    the two side-by-side bodies start level. */}
			<div
				data-testid="positions-panel-head"
				// ⚠ MOBILE-2h · R-1 — `gap-1.5` buys back 4px of the 360px line. The
				// note on this element's `flex-nowrap` (above the component) still
				// holds; this is the same decision one width further down.
				className="relative flex min-h-[52px] flex-wrap items-center gap-2 p-3 [border-bottom:var(--hairline)] max-mobile:flex-nowrap max-mobile:gap-1.5"
			>
				{/* ⛔ `uppercase` IS A TRANSFORM: `textContent` is still `Positions`, so
				    every consumer that reads this head by text keeps its handle. */}
				{/* ⚠ MOBILE-2h · R-1 — 10px on the phone. The four things on this line
				    have to clear each other at 360px and the widest of them is a market
				    question; the overline is the one that can give a pixel without
				    losing information, because it names a panel the reader is already
				    looking at. `tracking` and weight are unchanged, so it is the same
				    overline one step down rather than a different element. */}
				<span className="text-[11px] leading-[1.2] font-extrabold tracking-[0.12em] text-ink uppercase max-mobile:text-[10px]">
					Positions
				</span>
				{controls}
			</div>
			{/* THE PANEL-SCOPED SCROLL — the mockup's `.colwrap{flex:1 1 auto;
			    min-height:0; overflow-y:auto}`, topology throughout.
			    ⛔ NO `scroll-snap` HERE (RF-10): snap fights trackpads, and it fights
			    the arrow keys about what "next" means — the stepper moves the
			    SELECTION and scrolls it into view at `block:"nearest"`, which snap
			    would then override with its own idea of a resting position.
			    ⚠⚠ MOBILE-2h · R-2 — THAT RULING IS UNCHANGED AND THE PHONE DOES SNAP,
			    which is not a contradiction because it is a different scroller. RF-10
			    is about THIS box, the panel-scoped scroller, which exists only at
			    `lg`+ and is released below 640px (`max-mobile:overflow-visible`). The
			    phone's snap lives on the DOCUMENT, where there is no trackpad and no
			    arrow-key stepper to fight — `useDocumentRowStepper` is a keyboard
			    mechanism and a phone has no keys. Nothing on this element snaps at any
			    width. */}
			<div
				data-testid="positions-panel-body"
				// MOBILE-2h · R-2 — the same phone pair as the `<section>`; docblock.
				className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3 max-mobile:min-w-0 max-mobile:overflow-visible"
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
