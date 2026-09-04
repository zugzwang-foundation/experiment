import Link from "next/link";
import type { RefObject } from "react";

import { SideBadge } from "@/components/debate/badges";
import { computeSplitBar } from "@/components/debate/composer/split-bar";
import { formatDharma, formatDharmaCompact } from "@/components/debate/format";
import { PriceBar } from "@/components/debate/PriceBar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { FieldSeparator } from "@/components/ui/field-separator";
import { InfoTip } from "@/components/ui/info-tip";
import { RelativeTime } from "@/components/ui/relative-time";
import type { HeroPost, HeroTopPosts } from "@/server/discovery/hero";
import type { DiscoveryCard } from "@/server/discovery/list";
import type { PricePoint } from "@/server/discovery/price-series";
import { ChartSummary } from "../debate/chart/ChartSummary";
import { MarketPriceChart } from "../debate/chart/MarketPriceChart";
import { MarketThumb } from "./MarketThumb";
import { StatLine } from "./StatLine";

/**
 * The OQ-6 per-side empty copy (web-authored, VERBATIM — never re-typed in
 * tests). Rendered whenever a side has no eligible hero post, for ANY reason
 * — the copy is identical whether the side has zero posts or masked ones, so
 * it can never hint hidden content exists (F-DISC-2 safety posture).
 */
export const HERO_SIDE_EMPTY = {
	YES: "No YES posts yet",
	NO: "No NO posts yet",
} as const;

/**
 * The hero replyhead's TEXT TIER — `.replyhead`, surface_discovery_v1_0.html
 * :97-98. Extracted so a ruling on it costs ONE LINE here (PRIMITIVES-2 D8);
 * OQ-2 — whether this tier is `text-n4` or `text-n6` — is the open question it
 * exists for. Typography only: the replyhead's LAYOUT (`mt`/`flex`/`pt`/the
 * top hairline) stays at the call site, because none of it is what OQ-2 rules
 * on. The composed class attribute is byte-identical to the inline string this
 * replaced — same tokens, same order, same position.
 *
 * ⚠ NAMED FOR THE REPLYHEAD, AND DELIBERATELY NOT FOR THE CONCEPT. It is not
 * `MICRO_LABEL` or `SECONDARY_TEXT_TIER`: there are 12 other uppercase
 * micro-labels in the participant tree across `shell/` and `debate/composer/`,
 * with 4 sizes, 5 trackings, 2 weights and 4 colour tiers between them, and
 * this constant governs NONE of them. A concept name would assert ownership it
 * does not have, and the assertion would be found false by the first person to
 * grep it.
 *
 * ⚠ SPECIFICALLY: `debate/composer/AuthGateSlot.tsx:49` is ALSO a `text-n4`
 * uppercase micro-label (`text-xs font-medium tracking-wide`) — a DIFFERENT
 * size, weight and tracking from this one, and it is POLISH.4's uninspected
 * surface. It is not governed here and must not be pointed at this constant
 * without that inspection. Normalising the set is the MICRO-LABEL-TIER docket
 * row, routed to POLISH.4 — not a rider on a primitive pass.
 */
const REPLYHEAD_TIER =
	"text-[9.5px] font-bold tracking-[0.12em] text-n4 uppercase";

/**
 * The design-language §3.2 hero: three panels — **top-YES post · market
 * (image + question · two-line graph · price bar · stat line) · top-NO
 * post** — consuming the Slice-3 lean `HeroTopPosts` DTO. A hero-post click
 * deep-links `/m/[slug]?post=N` (the built A2 ordinal link, OQ-4 A); the
 * author pseudonym links to their profile (`/u/[pseudonym]`, activated at
 * UI.A5 — the A4 follow-up #2). A null side renders the OQ-6 empty copy, never
 * a placeholder post.
 */
export function HeroPanels({
	card,
	series,
	topPosts,
	linkRef,
	isOpen,
}: {
	card: DiscoveryCard;
	series: PricePoint[];
	topPosts: HeroTopPosts;
	/**
	 * CS14 §2 — the carousel's handle on the market panel's own `<Link>`, so an
	 * arrow rotation can hand focus to the market it just revealed and Enter
	 * opens THAT market. Optional: the panel is complete without it, and every
	 * render test mounts this component directly with no carousel above it.
	 */
	linkRef?: RefObject<HTMLAnchorElement | null>;
	/** `C-CHART-2` clause 1 — whether the hero chart's terminal dots pulse.
	 * Threaded from `page.tsx`, where the `status = 'Open'` licence is written
	 * and guarded; deliberately NOT a literal here, which would put a second
	 * copy of that licence somewhere nothing pins it. */
	isOpen: boolean;
}) {
	return (
		<div
			data-testid="hero-panels"
			// HTML-FINISH row 8 — THE HERO ABSORBS THE LEFTOVER VERTICAL SPACE.
			// The mockup's `.hero` is `flex:1 1 auto` (`:71-72`) and it is the one
			// element in the column that grows; the rail is fixed and the grid is
			// content-height, so everything left over lands here. The three panels
			// are grid items and stretch to the row height, so each fills the
			// hero's height without needing its own growth rule.
			// ⛔ The mockup's `min-height:0` is NOT ported — see `page.tsx`.
			className="grid flex-1 gap-[14px] md:grid-cols-[1fr_1.9fr_1fr]"
		>
			<HeroPostPanel side="YES" post={topPosts.yes} slug={card.slug} />

			{/* HTML-FINISH row 2 — THE WHOLE PANEL OPENS ITS MARKET. The mockup
			    binds its handler to `.mktpanel` itself (`:399-401`) and marks the
			    whole panel `cursor:pointer` (`:395`) — not the title. Built as a
			    real `<Link>` wrapping the panel, matching `MarketCard`'s
			    whole-card-is-the-link pattern (§22 F-DISC-1) rather than the side
			    panels' stretched-link workaround: that workaround exists ONLY
			    because those panels contain a second, independent author anchor
			    and anchors cannot nest. This panel contains none — thumb, `<h2>`,
			    `StatLine`, the price chart and `PriceBar` are all anchor-free —
			    so the simple form is available and is used.
			    ⚠ Canon §3 item 6 ("Pick / carousel-select is view-only — never
			    mutates a position") governs POSITION MUTATION. Navigating to
			    `/m/[slug]` mutates nothing; ruled as not barring this. */}
			{/* ⛔ CS13 §4 — THE KEYBOARD PATH WAS ALREADY WHOLE; WHAT WAS MISSING
			    WAS THE EVIDENCE OF IT. This panel is a real `<Link>`, so it has
			    always been Tab-reachable and Enter has always opened the market —
			    no handler is added here and none is needed. The defect was that a
			    keyboard viewer could not SEE where they were: the panel had no
			    focus treatment at all, so Tab moved an invisible cursor and Enter
			    navigated somewhere the viewer had no way to predict.
			    ⚠ NO NEW COLOUR AND NO NEW TOKEN. `focus-visible:shadow-(--state-focus-ring)`
			    with `outline-none` is the idiom already shipped on every focusable
			    in the participant tree — the header controls, both route-boundary
			    links, the composer's controls and `discovery/ErrorState.tsx` all
			    carry this exact pair. Matching it is what keeps focus looking the
			    same everywhere rather than inventing a second appearance. */}
			{/* ⛔ CS14 §2 — AND STILL NO ENTER HANDLER, WHICH IS THE POINT. This is
			    a real `<Link>`, so Enter has always opened the market natively.
			    What was missing was somewhere sensible for focus to BE: after an
			    arrow rotation focus sat on the `‹ ›` button that caused it, so
			    Enter re-activated that button and advanced again. The carousel now
			    hands focus HERE on every arrow rotation (`linkRef`), which fixes
			    Enter by moving the cursor rather than by intercepting the key —
			    and leaves the buttons' own Enter/Space behaviour untouched, as it
			    must be, or they stop being usable from the keyboard at all. */}
			{/* min-w-0 on all three grid children below — grid items default to
			    min-width:auto and won't shrink past their content's min-content
			    width, which pushed this row past the viewport below ~1280px. */}
			<Link
				ref={linkRef}
				data-testid="hero-market-link"
				href={`/m/${card.slug}`}
				className="flex min-w-0 flex-col rounded-[var(--r)] bg-n0 px-4 pt-[14px] pb-3 outline-none [border:var(--border-hero)] focus-visible:shadow-(--state-focus-ring)"
			>
				<div className="flex items-center gap-3">
					{/* The shared `MarketThumb` (PRIMITIVES-2 D2) — one owner of null ·
					    error · loaded across all three Discovery image sites. `alt=""`
					    because the same title renders in the adjacent `<h2>` two lines
					    below, so the thumb is decorative and a duplicated announcement
					    is also what overflowed the metadata row on a broken load (D4 /
					    PD-2-33; the WCAG 1.1.1 half remains A11Y.0's row). */}
					<MarketThumb
						src={card.imageUrl}
						alt=""
						className="h-[54px] w-[54px] shrink-0 rounded-[var(--imgr)] object-cover"
						fallback={
							<div
								aria-hidden="true"
								className="flex h-[54px] w-[54px] shrink-0 items-center justify-center rounded-[var(--imgr)] bg-n1 font-mono text-[8.5px] tracking-[0.16em] text-n4"
							>
								IMG
							</div>
						}
					/>
					<div className="flex min-w-0 flex-col gap-1">
						<h2 className="truncate text-[16.5px] leading-[1.3] font-bold">
							{card.title}
						</h2>
						<StatLine totals={card.totals} size="hero" />
					</div>
				</div>
				{/* HTML-FINISH row 9 — the hero price graph GROWS WITH ITS PANEL
				    instead of sitting at a fixed height. The mockup's `.graph` is
				    `flex:1 1 auto` (`:130`), so it takes whatever the panel has
				    spare once the question row and the price bar are placed.
				    ⚠ NO NEW VALUE. `h-24` becomes `min-h-24` — the SAME 6rem, as a
				    FLOOR rather than a fixed height — and `flex-1` lets it grow
				    above that. A growing box with the shipped number as its
				    minimum invents nothing. */}
				{/* CHART-1 — THE SAME COMPONENT `/m/[slug]` RENDERS, in `hero` mode
				    (SPEC.1 1.0.45 §22 + §9). This slot held `PriceSparkline`, a
				    second, index-spaced two-line graph that drew twenty bets in an
				    hour identically to twenty bets across three weeks.
				    ⚠ THAT WAS DEFENSIBLE AND STOPPED BEING SO. §9 called the hero
				    sparkline "decorative" while the CARD carried one too; HTML-FINISH ·
				    DISCOVERY deleted the card's, leaving this the only price graph on
				    the surface a reader uses to pick a market. A decorative rendering
				    is the wrong thing to be the only one.
				    ⚠ NO GEOMETRY CHANGED HERE. Both components fill this box the same
				    way — `preserveAspectRatio="none"` on `h-full w-full` — so the box,
				    its border, its `min-h-24` floor and its `flex-1` growth are
				    untouched. What changed is what the X axis MEANS. */}
				<div className="mt-[11px] min-h-24 flex-1 rounded-[var(--r)] [border:var(--hairline)]">
					<MarketPriceChart series={series} mode="hero" isOpen={isOpen} />
				</div>
				{/* SPEC.1 1.0.45 §9 · Accessibility — the hero's readout, the third and
				    last mode to get one, discharging `PD-3-04`.
				    ⛔ THIS SLOT WAS LEGITIMATELY EMPTY UNTIL NOW AND IS NOT ANY MORE.
				    The §22 hero graph was specified DECORATIVE — `aria-hidden`, no
				    axis, index-spaced — and a decorative graphic correctly announces
				    nothing. It stopped being decorative when HTML-FINISH · DISCOVERY
				    deleted the card sparkline and left this the surface's only price
				    graph, and CHART-1 made it time-scaled. A graphic carrying real
				    chronology that a screen reader cannot reach is a conformance gap,
				    not a design choice.
				    ⚠ It lands INSIDE the panel `<Link>`, so it lengthens that link's
				    accessible name rather than announcing separately. That is the
				    shipped pattern on the other two modes and the honest trade here:
				    the alternative is a graphic with no accessible content at all.
				    Whether this link's whole name is too long is a cross-surface
				    question and A11Y.0's, not this task's. */}
				<ChartSummary series={series} testId="hero-price-chart-summary" />
				<div className="mt-[9px]">
					<PriceBar pricing={card.pricing} size="hero" />
				</div>
			</Link>

			<HeroPostPanel side="NO" post={topPosts.no} slug={card.slug} />
		</div>
	);
}

/** One side's hero post panel — or the OQ-6 empty copy when none eligible. */
function HeroPostPanel({
	side,
	post,
	slug,
}: {
	side: "YES" | "NO";
	post: HeroPost | null;
	slug: string;
}) {
	if (post === null) {
		return (
			// min-w-0 — same grid-item min-content trap as hero-market-link
			// above; this is the alternate root HeroPostPanel can render into
			// the same grid slot.
			<div
				data-testid="hero-side-empty"
				data-side={side}
				className="flex min-w-0 items-center justify-center rounded-[var(--r)] bg-n0 p-4 text-xs text-muted-foreground [border:var(--border-hero)]"
			>
				{HERO_SIDE_EMPTY[side]}
			</div>
		);
	}

	// UI-OVERNIGHT entry 1a — the head stake's two spellings. The exact one is
	// the WHOLE unit (both figures and the arrow) so the tooltip answers for
	// what the row actually shows.
	const exactStake =
		post.currentValue === null
			? `Đ ${formatDharma(post.authorStake)}`
			: `Đ ${formatDharma(post.authorStake)} → Đ ${formatDharma(post.currentValue)}`;
	const compactStake =
		post.currentValue === null
			? `Đ ${formatDharmaCompact(post.authorStake)}`
			: `Đ ${formatDharmaCompact(post.authorStake)} → Đ ${formatDharmaCompact(post.currentValue)}`;

	return (
		// `relative` is load-bearing for V18's stretched link below.
		<div
			data-testid="hero-post"
			data-side={side}
			className="relative flex min-w-0 flex-col rounded-[var(--r)] bg-n0 px-3 pt-3 pb-[11px] [border:var(--border-hero)]"
		>
			<div className="flex flex-nowrap items-center gap-1.5 overflow-hidden text-[9.5px] whitespace-nowrap">
				<Avatar size="xs">
					<AvatarImage src={post.author.pfpUrl} alt="" />
					<AvatarFallback>
						{post.author.pseudonym.slice(0, 2).toUpperCase()}
					</AvatarFallback>
				</Avatar>
				{/* A4 follow-up #2 (UI.A5) — the author pseudonym links to their
				    profile. A SIBLING of the card-body deep-link below, NEVER nested
				    (nested <a> is invalid HTML). `relative z-10` lifts it above the
				    sibling's stretched ::after so it stays independently clickable —
				    the mockup's harness excludes `.pseud` from the body click the
				    same way (surface_discovery_v1_0.html:404). */}
				<Link
					data-testid={`hero-author-link-${side}`}
					href={`/u/${encodeURIComponent(post.author.pseudonym)}`}
					className="relative z-10 font-[650] hover:underline"
				>
					{post.author.pseudonym}
				</Link>
				<FieldSeparator />
				<SideBadge side={post.side} size="hero" price={post.entryPrice} />
				<FieldSeparator />
				{/* V13 — `.argstake` (mockup :86-88, markup :190). The progression is
				    POST-ANCHORED (founder ruling OD-1 = Option B): the left figure is
				    THIS post's own entry bet, the right the author's current value on
				    the side they argued. `null` — no pool, no holding, exited, or
				    flipped — renders the single figure with NO arrow. */}
				{/* ⚠ UI-OVERNIGHT entry 1a — ABBREVIATED past Đ10,000, the same rule
				    the debate and profile head clusters carry, because this is the same
				    element: a post card's header stake. It matters MORE here than
				    anywhere else — PD-2-36 records this row as Discovery's binding
				    horizontal-overflow constraint, and it is `flex-nowrap
				    overflow-hidden`, so an exact six-figure pair does not wrap, it
				    DISAPPEARS off the clip edge.
				    ⛔ BOTH FIGURES OR NEITHER. The progression is read as a comparison;
				    spelling one side exactly and the other abbreviated would invite the
				    reader to compare two different units.
				    ⚠ The tooltip carries the exact pair — one attribute on the unit
				    rather than two, because the arrow makes it one figure to a reader
				    and `title` on a nested span would only answer for half of it. */}
				<HeroStakeTip exact={exactStake} compact={compactStake}>
					Đ {formatDharmaCompact(post.authorStake)}
					{post.currentValue !== null && (
						<>
							<span className="mx-[2px] font-normal text-n4">→</span>Đ{" "}
							{formatDharmaCompact(post.currentValue)}
						</>
					)}
				</HeroStakeTip>
				{/* TIME-1 · Form B — HOW LONG AGO, LAST ON THE ROW.
				    `HeroPost.createdAt` has been on the read model since the hero
				    shipped (`server/discovery/hero.ts:117`); nothing new is queried,
				    presigned or serialized for it.
				    ⚠ `Replies · N` IS NOT ON THIS ROW — it lives in the panel's own
				    reply head below (`hero-reply-head-${side}`), so this row ends at
				    the Đ figure and the age follows the figure. That is the same
				    RULE as the debate card ("after every existing tag on the identity
				    row"), applied to the tags this row actually has, rather than the
				    same POSITION copied across from a row with different contents.
				    ⚠⚠ THE `FieldSeparator` IS RULED IN, AND THIS BLOCK ARGUED THE
				    OPPOSITE UNTIL TIME-1 · Form B. It read "⛔ NO
				    `HeadSeparator` BEFORE IT", because the hero guard pins this row's
				    separator count against the MOCKUP's own markup and a third pipe
				    would have reddened it.
				    ⛔ THAT GUARD'S TWO SOURCES ARE NOW DIFFERENT DOCUMENTS, and the
				    guard says so. Separators one and two remain governed by
				    `surface_discovery_v1_0.html`; the third is governed by the canon
				    §3 item 11 amendment, which supersedes the mockup ON THIS ELEMENT
				    AND ONLY ON THIS ELEMENT. TIME-1 had already put this row ahead of
				    the mockup — the mockup's head has no age field at all — so the
				    pipe does not open a new divergence, it makes the existing one
				    visible. ⛔ The mockup is NOT edited: a locked mockup is amended
				    deliberately, never as a side effect of a UI pass.
				    ⛔ NO SIZE AND NO `shrink-0` ON THE AGE. The row is `text-[9.5px]
				    flex-nowrap overflow-hidden whitespace-nowrap` and the leaf
				    inherits all of it; every other element here is governed by that
				    same clip, and exempting this one would make the newest field the
				    only one that survives a narrow panel.
				    ⚠ THE SEPARATOR IS THE ONE EXEMPTION, AND IT IS DELIBERATE (SEP-1).
				    `FieldSeparator` states its own `text-xs`, so all three pipes on this
				    row render at 12px rather than at the row's 9.5px — one computed size
				    for the seam on every author row in the product, which is what the
				    shared element was lifted to guarantee. It costs this row width, and
				    PD-2-36 records this row as Discovery's binding horizontal-overflow
				    constraint, so the cost is MEASURED rather than reasoned: the figure is
				    in the SEP-1 report and the row's overflow is still 0.
				    ⚠ PD-2-36 — this row is the binding constraint on Discovery's
				    horizontal overflow, and each pipe costs it. Measured at 1440 on
				    staging before this landed: pipe min-content 2.52px + one 6px gap,
				    against 33.87px of slack on the wider (NO) panel. Overflow was 0
				    before and is 0 after; the after-figure is in the run report. */}
				<FieldSeparator />
				<RelativeTime createdAt={post.createdAt} />
			</div>
			{/* V18 — the WHOLE panel is the post's click target, matching the
			    mockup's `.argbody[data-post]` handler. Implemented as a stretched
			    link (`after:inset-0` against the panel's `relative`) rather than by
			    wrapping the panel, because the author link above must remain a
			    separate target and anchors cannot nest. */}
			<Link
				href={`/m/${slug}?post=${post.ordinal}`}
				className="mt-2 flex flex-col gap-1 after:absolute after:inset-0"
			>
				<h3 className="line-clamp-2 text-sm leading-snug font-medium">
					{post.title}
				</h3>
				{/* UI-QUICK CS13 §2 — THE HERO POST IS TITLE-ONLY. The quoted
				    `.argtext` teaser that stood here is removed; the panel now
				    carries the argument's headline and its picture, and the
				    argument itself is read one click away on the debate surface.
				    The space it freed is NOT left as a gap — the image box below
				    absorbs it (§3 lands with this for that reason).
				    ⚠ THIS DIVERGES FROM THE RATIFIED MOCKUP, DELIBERATELY AND ON
				    A FOUNDER RULING. `surface_discovery_v1_0.html:192` renders
				    `.argtext`, and HTML-FINISH row 7 ruled on the QUOTE GLYPHS it
				    carried (byte-carried `0x22`, straight not curly) — a finding
				    that is now moot here because there is no quoted text left on
				    this surface to carry them. Reported to the founder rather than
				    amended: design-canon and the mockup are read-only to this lane.
				    ⛔ `post.teaser` IS STILL COMPUTED AND STILL ON THE WIRE.
				    `deriveTitleTeaser` still splits it in `hero.ts` and the DTO
				    still carries the field — this change is PRESENTATION ONLY, and
				    the read model was deliberately not touched. Anything that
				    wants the teaser back needs only to render it. */}
			</Link>
			{/* V15 — `.argimg` (mockup :91-93, markup :193). `flex-1` so it absorbs
			    the panel's spare height and pushes the reply head + bar to the
			    bottom, exactly as the mockup's `flex:1 1 auto` does — and, since
			    CS13 §2, the teaser's freed space along with it.

			    ⛔⛔ CS13 §3 — THE PANEL'S HEIGHT IS A PROPERTY OF THE LAYOUT, NEVER
			    OF THE PICTURE. The picture is taken OUT OF FLOW to achieve that:
			    the wrapper below is the box, and the image is absolutely
			    positioned to fill it. An out-of-flow child contributes nothing to
			    its parent's content height — no intrinsic size, no aspect ratio,
			    nothing — so the wrapper's height is decided by the panel and the
			    image simply occupies whatever it is given.

			    ⚠⚠ AND THE OBVIOUS SIMPLER VERSION DOES NOT WORK — MEASURED, NOT
			    ASSUMED. Leaving the `<img>` in flow as `flex-1 min-h-[40px]` LOOKS
			    sufficient: `flex-1` is `flex: 1 1 0%`, so the basis reads as zero,
			    and the explicit `min-height` appears to close the flex
			    AUTOMATIC-MINIMUM-SIZE path that would otherwise resolve to a
			    replaced element's intrinsic height. Both halves of that reasoning
			    are wrong here, for one reason: a PERCENTAGE flex-basis resolved
			    against an INDEFINITE container height falls back to `auto`, and
			    `auto` on an `<img>` is its intrinsic height. This panel's height
			    comes from the grid row, so the height IS indefinite and the
			    fallback fires.

			    The measurement that caught it, on staging at 1440, same panel,
			    same market, same viewport — only the picture swapped:
			      portrait  482x638  → hero row 574.6px
			      landscape 1200x400 → hero row 375.8px
			    198.8px of panel height carried by nothing but the attachment's
			    aspect ratio. 375.8 is the row's true height; the portrait was
			    inflating it. Out of flow, both cases sit at 375.8.

			    ⛔ NO NEW NUMBER IS INTRODUCED. `mt-2`, `min-h-[40px]` and `flex-1`
			    are the shipped values, moved from the image to the wrapper that
			    now owns the box; `inset-0` is not a size.

			    ⛔ `object-contain`, NEVER `object-cover` (founder wall: no crop).
			    `cover` filled the box by cropping — on a portrait attachment most
			    of the picture was simply not shown. `contain` fits the whole
			    picture inside the box and letterboxes the remainder.

			    ⛔⛔ CS14 §4 — AND THE LETTERBOX IS NOW INVISIBLE, BECAUSE THE
			    LOADED IMAGE CARRIES NO FILL. `object-contain` leaves bars
			    wherever the picture's aspect ratio differs from the box's, and
			    the `<img>` used to paint `bg-n1` behind them — so a portrait
			    attachment read as a small picture mounted on a grey card rather
			    than as the picture itself. Measured on staging at `0f04272`, the
			    482×638 portrait in the NO panel at a 1440×900 frame: image box
			    321.7 wide, picture 205.7 wide, i.e. 58.0px of `#2a2a2a` — 29.0px
			    down each side. Dropping the fill lets the panel's own `bg-n0`
			    show through and the bars stop reading as an object.

			    ⛔ THE PLACEHOLDER KEEPS ITS WELL, and the two arms are separate
			    class strings, so this is a one-word difference rather than a
			    conditional: with NO image there must still be a visible box, or
			    the empty state becomes nothing at all. `bg-n1` stays on the
			    fallback below and is gone from the image above — that IS the
			    distinction, and a test asserts both halves so neither can drift
			    into the other.

			    ⚠ THE HAIRLINE IS DELIBERATELY LEFT ON BOTH. It outlines the box,
			    not the picture, and removing it is a second visual change nobody
			    ruled on. Reported rather than taken.

			    ⚠ The FALLBACK takes the same `absolute inset-0`, so the no-image
			    case and the image case are the SAME box by construction rather
			    than by two class strings that could drift apart. */}
			<div className="relative mt-2 min-h-[40px] flex-1">
				<MarketThumb
					data-testid={`hero-post-image-${side}`}
					src={post.imageUrl}
					// The argument text carries the meaning and the post title is
					// adjacent, so the attachment is decorative here (WCAG 1.1.1).
					alt=""
					className="absolute inset-0 h-full w-full rounded-[var(--imgr)] object-contain [border:var(--hairline)]"
					fallback={
						<div
							data-testid={`hero-post-image-empty-${side}`}
							aria-hidden="true"
							className="absolute inset-0 flex items-center justify-center rounded-[var(--imgr)] bg-n1 font-mono text-[9px] tracking-[0.18em] text-n4 [border:var(--hairline)]"
						>
							IMG
						</div>
					}
				/>
			</div>
			{/* V16 — `.replyhead` (mockup :97-98, markup :194). Display-only, and a
			    SIBLING of the stretched link above, so a click anywhere on it still
			    opens the post (the mockup's whole-`.argbody` handler). */}
			<div
				data-testid={`hero-reply-head-${side}`}
				className={`mt-[9px] flex justify-between pt-[8px] ${REPLYHEAD_TIER} [border-top:var(--hairline)]`}
			>
				{/* V48 — the count and its noun agree: `Reply · 1`, never `Replies · 1`. */}
				<span>
					{post.replyCount === 1 ? "Reply" : "Replies"} · {post.replyCount}
				</span>
				<span>Đ {formatDharma(post.replyDharma)} staked</span>
			</div>
			<SupportCounterBar
				side={side}
				supportDharma={post.supportDharma}
				counterDharma={post.counterDharma}
			/>
		</div>
	);
}

/**
 * V17 — the `.barrow.r` Support/Counter split bar (mockup :99-113, markup
 * :195-199): stacked LABEL — BAR — stacked LABEL, no text inside the bar.
 *
 * ⚠ DISPLAY-ONLY, and that is an INVARIANT, not a style choice. Support and
 * Counter are read-time AGGREGATES over reply-bets (ADR-0017/0018); there is no
 * standalone friendly-fire vote and `friendly_fire_events` was dropped at
 * DEBATE.9. The mockup contains no `<button>`, no `<a>`, no handler and no
 * `cursor:pointer` here, and neither does this. It renders a `<div
 * role="img">` whose `aria-label` carries BOTH figures — the `PriceBar`
 * precedent. A test asserts the absence of any interactive element.
 *
 * ⚠ THE SEGMENTS ARE SIDE-KEYED, and the first build of this component got that
 * wrong. Canon (values-log v0_3 §3): *"stake-bar segments — left = Support share
 * in the SUPPORT SIDE'S POLE COLOUR, right = Counter's"*, and *"Support inherits
 * the post's side, Counter the opposite."* So:
 *
 *   YES post → Support = YES = `bg-yes` (black) · Counter = NO = `bg-no`
 *   NO  post → Support = NO  = `bg-no` (white) · Counter = YES = `bg-yes`
 *
 * The original copied the shipped `composer/ReplySplitBar.tsx:64,67` idiom — a
 * FIXED `bg-yes` fill over a FIXED `bg-no` track — and asserted immunity on the
 * grounds that "no SIDE VALUE selects either, so this cannot invert a pole."
 * That reasoning was exactly backwards: the pole was fixed while the QUANTITY it
 * measures flips meaning with the post's side, so the NO panel painted the
 * NO-side share in the YES pole. Absence of a side value was the mechanism, not
 * the defence.
 *
 * The ratified mockup is CORRECT and was misread, not wrong: its `.bar`
 * background is `--n0` (WHITE in light theme) and `.fill` is `--ink` (BLACK),
 * and the NO panel's fill carries `.fill.right{inset:0 0 0 auto}` at width
 * `100−sup` (`:250`, `:459`). That paints white-left/black-right on a NO post —
 * i.e. Support in the NO pole — which is canon. Tokens are still not ported by
 * NAME (the ramps are inverted, plan pushback §3); only the binding is.
 */
function SupportCounterBar({
	side,
	supportDharma,
	counterDharma,
}: {
	side: "YES" | "NO";
	supportDharma: string;
	counterDharma: string;
}) {
	// Reuses the SHIPPED split-bar primitive — exact decimals via
	// `ComposerDecimal`, integer-TRUNCATED so a full bar means literally zero
	// counter Dharma. No new formatter (SPEC.1 §10.8 mandates one).
	const { totalDharma, supportPct } = computeSplitBar({
		supportDharma,
		counterDharma,
	});
	// Both zero → an even bar, per the mockup's `tot ? … : 50` (:458).
	// `computeSplitBar` returns "0%" for an empty total, which is the right
	// answer inside a composer and the wrong one on a resting hero panel.
	const fillPct = totalDharma === "0" ? "50%" : supportPct;
	// The pole binding. Support inherits the POST's side; Counter takes the
	// opposite. Written as one side-keyed expression per segment so C0's guard
	// SEES it — `HeroPanels.tsx` is the seventh entry in that guard's pinned
	// inventory, added deliberately when this fix landed.
	const supportPole = side === "YES" ? "bg-yes" : "bg-no";
	const counterPole = side === "YES" ? "bg-no" : "bg-yes";
	return (
		<div
			data-testid={`hero-split-bar-${side}`}
			className="mt-[9px] flex items-center gap-[9px]"
			role="img"
			aria-label={`Support Đ ${formatDharma(supportDharma)}, Counter Đ ${formatDharma(counterDharma)}`}
		>
			<span className="flex shrink-0 flex-col gap-[1px]">
				<span className="text-[8.5px] font-extrabold tracking-[0.12em] text-ink">
					SUPPORT
				</span>
				<span className="text-[9.5px] font-bold tracking-[0.02em] text-n6">
					Đ {formatDharma(supportDharma)}
				</span>
			</span>
			{/* The track carries the COUNTER share (the remainder); the fill is the
			    SUPPORT share, left-anchored, in the post's own pole. */}
			<span
				className={`h-[16px] flex-1 overflow-hidden rounded-[var(--r)] ${counterPole} [border:var(--hairline)]`}
			>
				<span
					className={`block h-full ${supportPole}`}
					style={{ width: fillPct }}
				/>
			</span>
			<span className="flex shrink-0 flex-col items-end gap-[1px]">
				<span className="text-[8.5px] font-extrabold tracking-[0.12em] text-ink">
					COUNTER
				</span>
				<span className="text-[9.5px] font-bold tracking-[0.02em] text-n6">
					Đ {formatDharma(counterDharma)}
				</span>
			</span>
		</div>
	);
}

/**
 * UI-OVERNIGHT entry 1a — the hero head stake's tooltip, attached only when the
 * abbreviated spelling actually hides something.
 *
 * ⛔ NOT `CompactDharmaFigure`, and the difference is the ARROW. That component
 * renders ONE figure; this row renders a PROGRESSION — entry stake → current
 * value — which a reader takes as a single comparison. One tip over the pair
 * answers the question the pair asks ("what are these two numbers?"); two tips,
 * one per figure, would answer half of it twice.
 *
 * ⚠ It wraps rather than replaces: the span, its class string and its children
 * are exactly what shipped, so `hero-panels.test.tsx`'s reads of this row are
 * untouched when the figures are small enough to render exactly — which is
 * every fixture it carries.
 */
function HeroStakeTip({
	exact,
	compact,
	children,
}: {
	exact: string;
	compact: string;
	children: React.ReactNode;
}) {
	const figure = (
		<span className="font-mono font-bold text-n6">{children}</span>
	);
	if (exact === compact) {
		return figure;
	}
	return (
		<InfoTip content={exact} asChild>
			{figure}
		</InfoTip>
	);
}
