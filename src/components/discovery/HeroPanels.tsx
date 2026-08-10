import Link from "next/link";

import { SideBadge } from "@/components/debate/badges";
import { computeSplitBar } from "@/components/debate/composer/split-bar";
import { formatDharma } from "@/components/debate/format";
import { PriceBar } from "@/components/debate/PriceBar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { HeroPost, HeroTopPosts } from "@/server/discovery/hero";
import type { DiscoveryCard } from "@/server/discovery/list";
import type { PricePoint } from "@/server/discovery/price-series";

import { MarketThumb } from "./MarketThumb";
import { PriceSparkline } from "./PriceSparkline";
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
}: {
	card: DiscoveryCard;
	series: PricePoint[];
	topPosts: HeroTopPosts;
}) {
	return (
		<div
			data-testid="hero-panels"
			className="grid gap-[14px] md:grid-cols-[1fr_1.9fr_1fr]"
		>
			<HeroPostPanel side="YES" post={topPosts.yes} slug={card.slug} />

			<div className="flex flex-col rounded-[var(--r)] bg-n0 px-4 pt-[14px] pb-3 [border:1px_solid_var(--color-n3)]">
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
				<div className="mt-[11px] h-24 rounded-[var(--r)] [border:var(--hairline)]">
					<PriceSparkline series={series} size="hero" />
				</div>
				<div className="mt-[9px]">
					<PriceBar pricing={card.pricing} size="hero" />
				</div>
			</div>

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
			<div
				data-testid="hero-side-empty"
				data-side={side}
				className="flex items-center justify-center rounded-[var(--r)] bg-n0 p-4 text-xs text-muted-foreground [border:1px_solid_var(--color-n3)]"
			>
				{HERO_SIDE_EMPTY[side]}
			</div>
		);
	}

	return (
		// `relative` is load-bearing for V18's stretched link below.
		<div
			data-testid="hero-post"
			data-side={side}
			className="relative flex flex-col rounded-[var(--r)] bg-n0 px-3 pt-3 pb-[11px] [border:1px_solid_var(--color-n3)]"
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
				<SideBadge side={post.side} size="hero" price={post.entryPrice} />
				{/* V13 — `.argstake` (mockup :86-88, markup :190). The progression is
				    POST-ANCHORED (founder ruling OD-1 = Option B): the left figure is
				    THIS post's own entry bet, the right the author's current value on
				    the side they argued. `null` — no pool, no holding, exited, or
				    flipped — renders the single figure with NO arrow. */}
				<span className="font-mono font-bold text-n6">
					Đ {formatDharma(post.authorStake)}
					{post.currentValue !== null && (
						<>
							<span className="mx-[2px] font-normal text-n4">→</span>Đ{" "}
							{formatDharma(post.currentValue)}
						</>
					)}
				</span>
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
				{post.teaser !== "" && (
					<p className="line-clamp-3 text-xs leading-snug text-muted-foreground">
						{post.teaser}
					</p>
				)}
			</Link>
			{/* V15 — `.argimg` (mockup :91-93, markup :193). `flex-1` so it absorbs
			    the panel's spare height and pushes the reply head + bar to the
			    bottom, exactly as the mockup's `flex:1 1 auto` does. */}
			<MarketThumb
				data-testid={`hero-post-image-${side}`}
				src={post.imageUrl}
				// The argument text carries the meaning and the post title is
				// adjacent, so the attachment is decorative here (WCAG 1.1.1).
				alt=""
				className="mt-2 min-h-[40px] flex-1 rounded-[var(--imgr)] bg-n1 object-cover [border:var(--hairline)]"
				fallback={
					<div
						data-testid={`hero-post-image-empty-${side}`}
						aria-hidden="true"
						className="mt-2 flex min-h-[40px] flex-1 items-center justify-center rounded-[var(--imgr)] bg-n1 font-mono text-[9px] tracking-[0.18em] text-n4 [border:var(--hairline)]"
					>
						IMG
					</div>
				}
			/>
			{/* V16 — `.replyhead` (mockup :97-98, markup :194). Display-only, and a
			    SIBLING of the stretched link above, so a click anywhere on it still
			    opens the post (the mockup's whole-`.argbody` handler). */}
			<div
				data-testid={`hero-reply-head-${side}`}
				className="mt-[9px] flex justify-between pt-[8px] text-[9.5px] font-bold tracking-[0.12em] text-n4 uppercase [border-top:var(--hairline)]"
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
