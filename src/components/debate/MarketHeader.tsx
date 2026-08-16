import { Badge } from "@/components/ui/badge";
import type { ChartNode } from "@/server/debate-view/price-chart";
import type { PricePoint } from "@/server/discovery/price-series";

import { MarketPriceChartHost } from "./chart/MarketPriceChartHost";
import { formatDharma } from "./format";
import { HeadZone } from "./HeadZone";
import { MarketMediaPanel } from "./MarketMediaPanel";
import { PriceBar } from "./PriceBar";
import { ResolverCards } from "./ResolverCards";
import type { DebateMarketHeader, Side } from "./types";

const TERMINAL: ReadonlySet<string> = new Set([
	"Closed",
	"Resolving",
	"Resolved",
	"Voided",
	"Frozen",
]);

/**
 * PD-3-08 — the count and its noun agree: `1 post`, never `1 posts`. Zero is
 * PLURAL (`0 replies`). Mirrors the shipped reference implementation in
 * `src/components/discovery/StatLine.tsx`, which is file-private there and so
 * cannot be imported without widening that module's surface.
 */
const noun = (n: number, one: string, many: string) => (n === 1 ? one : many);

/**
 * `.attrs .sep` (`d5:502`) — the middle dot between the three stat fields:
 * `color:var(--n3)`, normal weight against the bold figures, `margin:0 6px`.
 * `aria-hidden` for the same reason `ArgProfile`'s `Sep` carries it.
 */
function AttrSep() {
	return (
		<span aria-hidden="true" className="mx-1.5 font-normal text-n3">
			·
		</span>
	);
}

/**
 * The market lifecycle / resolution marker (INV-4 / design-language §3.1). A
 * terminal market (Closed/Resolving/Resolved/Voided/Frozen) reads as locked —
 * "read-only" — paired with the literal status (never colour alone, §8).
 */
function LifecycleBadge({ status }: { status: DebateMarketHeader["status"] }) {
	const terminal = TERMINAL.has(status);
	return (
		<Badge
			variant={terminal ? "secondary" : "outline"}
			aria-label={`Market ${status}${terminal ? ", read-only" : ""}`}
		>
			{status}
			{terminal ? " · read-only" : ""}
		</Badge>
	);
}

/**
 * The market-view header (DEBATE.4 §4): question = `markets.title`, resolution
 * criterion = `markets.description` (R-14.4) · lifecycle marker · the price bar
 * (`getPrices`) · the attrs (Đ staked · posts · replies). Composes into the
 * SHELL `(public)/layout.tsx` shell; the placeholder global header is left
 * untouched (superseded at UI.13). ⚠ The deferred D1 placeholder box was
 * REMOVED at POLISH.3 (PD-3-09 / OD-6) — it rendered a build-time note about
 * unbuilt work to every participant. The record that market media and resolver
 * cards are still unbuilt survives at `docs/polish/POLISH-0.md` §3 and
 * `docs/parked.md`'s `MEDIA.2-GOLIVE`; the carousel itself is MEDIA.2's.
 *
 * HTML-FINISH · MARKET DETAIL row 1 — THIS IS THE HEADZONE'S MARKET ARM, and it
 * is now rendered INSIDE the market↔post ternary rather than above it. Every
 * element below is a `vm` element in the mockup (`.question` · `.attrs` ·
 * `.criterion` · `.graph` · `.barrow f`); the post arm's `vp` set is
 * `PostFocusHeader`'s. The two are disjoint and they SWAP — see `HeadZone.tsx`.
 *
 * ⇒ CONSEQUENCE, DECLARED: the lifecycle marker and `Download .md` become
 * MARKET-ARM ONLY, exactly like every other `vm` element beside them. ⛔ Neither
 * is DELETED — row 9 is a reverse delta the founder has not ruled, and OD-3
 * keeps all five. The ADR-0025 export stays reachable and the INV-4 read-only
 * marker stays rendered wherever the market itself is the subject; in post-focus
 * the reader's market context is the row-17 market card, one click from exit.
 */
export function MarketHeader({
	market,
	priceChart,
	pick,
}: {
	market: DebateMarketHeader;
	priceChart: { series: PricePoint[]; nodes: ChartNode[] } | null;
	/**
	 * HTML-FINISH · MARKET DETAIL round 2 · R7 (row 8) — the rail bar's clickable
	 * percent labels. Threaded straight through to `PriceBar`; this component
	 * neither derives nor gates it, because the viewer state it carries is
	 * `DebateView`'s and duplicating the F-3 gate here would be a second place for
	 * it to drift. See `PriceBar` for why the handler and the gate travel as one
	 * object.
	 */
	pick?: {
		heldSide: Side | null;
		marketOpen: boolean;
		suspended: boolean;
		onPick: (side: Side) => void;
	};
}) {
	return (
		<HeadZone
			// HTML-FINISH · MARKET DETAIL row 4 — THE PRICE CHART IS THE RAIL'S
			// content. The mockup's `.hright` holds exactly `.graph` + `.barrow f`
			// in the market arm (`d5:1007`, `:1037`); the chart used to render in
			// the left column between the criterion and the price bar, which put
			// the market's shape INSIDE the reading column instead of beside it.
			// ⚠ `null` WHEN THE SERIES READ FAILED, and that is the pre-existing
			// contract, not a new one: a null `priceChart` is non-fatal and the
			// rest of the header stands. It now also means NO RAIL — one column,
			// never an empty 25% box (PD-3-09). `MarketPriceChartHost` itself
			// still returns null for an empty series, so both null paths agree.
			right={
				<>
					{priceChart ? (
						<MarketPriceChartHost
							series={priceChart.series}
							nodes={priceChart.nodes}
						/>
					) : null}
					{/* HTML-FINISH · MARKET DETAIL row 7 — the price bar is the rail's
					    second occupant, directly under the chart, exactly as `.hright`
					    holds `.graph` then `.barrow f` (`d5:1007`, `:1037`). The bar and
					    the chart above it read the SAME price, so standing them in one
					    column is what lets a reader check one against the other.
					    ⚠ THE RAIL IS NOW ALWAYS RENDERED on the market arm: `PriceBar`
					    returns its "Pricing unavailable" stub rather than null, so there
					    is no market-arm state with an empty rail. A null `priceChart`
					    now means "no CHART in the rail", not "no rail".
					    ✅ ROUND 2 · R7 — the bar is now the ONE-ROW `.barrow` d5 draws
					    (`d5:1037-1041`) and its percent labels are LIVE (`.blab.click`,
					    `pick('yes')` / `pick('no')`). `pick` is `undefined` on any
					    consumer that has no viewer state, and the labels fall back to
					    plain text. */}
					<PriceBar pricing={market.pricing} size="detail" pick={pick} />
				</>
			}
			left={
				/* HTML-FINISH · MARKET DETAIL row 2 — `.hleft` IS A ROW (`d5:448`),
				   holding `.mmedia` then `.hstack`. The market arm's media panel takes
				   the same slot the post arm gives the focused post's image, so the two
				   arms swap contents inside one identical frame. */
				<div className="flex min-h-0 flex-1 gap-4">
					<MarketMediaPanel
						imageUrl={market.mediaImageUrl}
						videoUrl={market.mediaVideoUrl}
						title={market.title}
					/>
					{/* `.hstack` (`d5:462`) — everything that is not the media.
					    ⚠ `min-h-0` is this node's link in the one-screen chain: without
					    it the stack refuses to shrink below its content and pushes the
					    declared band taller. */}
					<div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
						<div className="flex items-start justify-between gap-3">
							{/* `.question` (`d5:463`) — `font-size:21px;font-weight:700;
							    line-height:1.24`, and SINGLE LINE with an ellipsis
							    (`white-space:nowrap;overflow:hidden;text-overflow:ellipsis`,
							    ruled at D5-02 / v0.9: "Market title → single line (no wrap;
							    ellipsis if it ever overflows)"). The shipped heading was
							    20px / 600 with `tracking-tight`, i.e. lighter, smaller and
							    NEGATIVELY tracked where the mockup is heavier and neutral.
							    ⚠⚠ THE TRUNCATION IS A REAL COST AND IT IS REPORTED, NOT
							    SMOOTHED OVER: at a narrow viewport a long question is cut
							    with no in-place way to read the rest. `title` carries the
							    full string for pointer users and the accessible name is
							    unaffected (the text node is whole in the DOM); the ADR-0025
							    `.md` export carries it in full. This follows the founder's
							    own adoption of `.crittext`'s 2-line clamp one block down —
							    the two rulings would otherwise contradict each other. */}
							{/* ⚠ `min-w-0 flex-1` — `.question` (`d5:463`) is a BLOCK filling
							    `.hstack`, and `truncate` only ellipsises what it is given. As a
							    shrink-to-fit flex item beside the badge cluster the heading
							    measured 501px against d5's 674px at the pinned 1440×777
							    (−12.0pp), so it truncated far earlier than the mockup does and
							    left the row's spare width unused. */}
							<h1
								title={market.title}
								className="min-w-0 flex-1 truncate text-[21px] leading-[1.24] font-bold tracking-normal"
							>
								{market.title}
							</h1>
							<div className="flex shrink-0 items-center gap-2">
								<LifecycleBadge status={market.status} />
								{/* EXPORT.1 — native download of the debate `.md` (server-mediated GET);
					    plain anchor, no client boundary, works signed-out. */}
								<a
									download
									href={`/m/${market.slug}/export`}
									aria-label="Download this debate as Markdown"
									className="text-muted-foreground text-xs underline-offset-2 hover:underline"
								>
									Download .md
								</a>
							</div>
						</div>
						{/* HTML-FINISH · MARKET DETAIL row 6 — THE ATTRS STRIP SITS BETWEEN
					    THE QUESTION AND THE CRITERION. The mockup's `.hstack` orders its
					    `vm` children `.question` → `.attrs` → `.criterion` → `.rescards`
					    (`d5:958-985`); this strip used to render LAST, below the chart and
					    the price bar. Reading order is the whole substance of the row: the
					    market's size is context for the question, and the criterion — the
					    terms of the bet — is the thing you read last and most carefully.
					    ⛔ ORDER ONLY. The strip's own composition is untouched: the same
					    three spans, the same `flex flex-wrap` container, the same spaced
					    `Đ ` grammar and the same PD-3-08 plural rule, all still pinned by
					    `market-header.test.tsx`. `.attrs`'s bold numerals and `·`
					    separators are a different row's subject and are not taken here. */}
						{/* ⚠ `.attrs` (`d5:500-502`) — `font-size:12px;font-weight:700;
						    color:var(--ink)`, its three fields joined by a `.sep` middle dot
						    (`color:var(--n3);font-weight:400;margin:0 6px`). The shipped
						    strip was `text-muted-foreground` at normal weight with the
						    fields merely SPACED, so `Đ 1,681 staked 4 posts 1 reply` ran
						    together as one grey sentence.
						    ⛔ THE `·` IS THE MOCKUP'S OWN GLYPH (U+00B7), and it is
						    `aria-hidden` for the reason `ArgProfile`'s `Sep` already
						    states: it is punctuation, and announcing it between every
						    field makes the row unlistenable.
						    ⚠ THE PD-3-08 PLURAL RULE IS UNTOUCHED — same `noun()`, same
						    three fields, same order. Only weight, colour and the
						    separators change. */}
						<div className="flex flex-wrap items-center gap-y-1 text-xs font-bold text-ink">
							<span>Đ {formatDharma(market.totals.dharmaStaked)} staked</span>
							<AttrSep />
							<span>
								{market.totals.postCount}{" "}
								{noun(market.totals.postCount, "post", "posts")}
							</span>
							<AttrSep />
							<span>
								{market.totals.replyCount}{" "}
								{noun(market.totals.replyCount, "reply", "replies")}
							</span>
						</div>
						{/* T1 — the RESOLUTION criterion block (`d5:974-977`, `.criterion` +
					    `.overline`). The container is a TOP HAIRLINE RULE + padding
					    (`d5:467`), NOT a boxed card; the 12px margin is carried by this
					    stack's `gap-3`.

					    ✅ HTML-FINISH · MARKET DETAIL row 10 — THE CLAMP IS ADOPTED, and
					    the previous ruling is SUPERSEDED IN PLACE rather than deleted
					    (O-4). This block used to read "⛔ NO CLAMP, AND THAT IS A RULING,
					    NOT AN OMISSION (§17 H-T1(c))", on three grounds: (i) a bare clamp
					    with no affordance is the defect class `PD-0-01`/`R4` was removing
					    from post cards in that same PR; (ii) `U3` makes criteria long BY
					    DESIGN; (iii) unclamped WAS the status quo, so adopting `d5:470-471`
					    would be INTRODUCING a truncation of the bet terms.
					    ⇒ The founder ruling of 2026-08-16 reverses it, and ground (i) is
					    reversed with it — `R4` itself was overturned in the same ruling
					    (row 24 returns the `+` glyph), so the coherence argument that
					    grounded the no-clamp no longer holds.

					    ⚠ O-9 CHECKED, NOT ASSUMED. The superseded ruling cited `§17
					    H-T1(c)`, and that section lives in `docs/plans/POLISH-3-PR-2.md`
					    — a PLANNING document, not a spec. SPEC.1, design-language and
					    design-canon were each read at HEAD and none of them says anything
					    about clamping or truncating the resolution criterion. So this
					    reverses a plan-doc ruling by founder ruling and contradicts NO
					    live §-text — which is why it ships with no spec rider.

					    ⚠ THE COST, RECORDED RATHER THAN SMOOTHED OVER: past two lines the
					    terms of the bet are now unreadable ON THIS SURFACE, and this row
					    adds no expander. "Criterion length treatment" remains docketed to
					    `HEADER-3ZONE`, so the affordance is a decision that has been
					    deferred, not one this row made. The full text still ships in the
					    ADR-0025 `.md` export.

					    ⚠ `line-clamp-2` is a COUNT — a composition declaration, not one of
					    the four value classes this task may not take from the mockup.

					    ⚠ LOCAL STYLES, NOT A PRESET (§17 H-T1(b)); the recipe is
					    `.overline`'s (`d5:468-469`) and ONLY `.overline`'s. Ported BY TOKEN
					    (`text-n4`), never the hex — Ruling A / H-HEX. */}
						{market.description ? (
							<div className="pt-2.5 [border-top:var(--hairline)]">
								<div className="text-[9.5px] font-extrabold tracking-[.14em] text-n4 uppercase">
									Resolution
								</div>
								{/* `.crittext` (`d5:470`) — `font-size:11px;line-height:1.5;
								    color:var(--n6)`. It shipped at `text-sm` (14px), which is
								    the same size as the body copy it is meant to sit under. */}
								<p className="mt-[5px] line-clamp-2 text-[11px] leading-[1.5] text-muted-foreground">
									{market.description}
								</p>
							</div>
						) : null}
						{/* HTML-FINISH · MARKET DETAIL row 3 — `.rescards` (`d5:986`), the
						    last `vm` child of `.hstack`, after the criterion. It renders
						    NOTHING today and that is the ruling (OD-2), not an omission:
						    `markets` carries no resolver name, logo, source or handle, and
						    empty card chrome would reproduce PD-3-09 / OD-6 verbatim. The
						    slot is real in the composition; see `ResolverCards.tsx`. */}
						<ResolverCards market={market} />
					</div>
				</div>
			}
		/>
	);
}
