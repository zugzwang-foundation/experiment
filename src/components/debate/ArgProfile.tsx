import { Download } from "lucide-react";
import Link from "next/link";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { FieldSeparator } from "@/components/ui/field-separator";
import { InfoTip } from "@/components/ui/info-tip";
import { RelativeTime } from "@/components/ui/relative-time";
import { GLOSSARY, SOLD_LABEL } from "@/lib/copy/glossary";
import type { Badge as BadgeKind } from "@/lib/ranking";

import { LaneBadge, PositionMarker, SideBadge } from "./badges";
import { CompactDharmaFigure } from "./DharmaFigure";
import { formatDharmaCompact } from "./format";
import type { AuthorIdentity, Marker, Side } from "./types";

/**
 * A post/reply author header (design-language §3.1 "argprofile"): avatar (PFP
 * placeholder, D8) · pseudonym · frozen SideBadge · live PositionMarker · the
 * author's own stake `a` · reply count.
 * The marker chip sits after the side badge, before the stake (D5).
 *
 * UNWIRE-1 — the `CardActions` cluster (the bookmark trigger + `showActions`,
 * its caller-side gate) is removed: the bookmark module is unwired
 * product-wide. This header no longer renders any action cluster at all.
 * The `@entry%`/`→now` enrichments are deferred (D7) — just the side and `Đ a`,
 * never `YES @ 27%` or `Đ a → Đ now`.
 *
 * TIME-1 — the row now ENDS with how long ago the argument was written. One
 * edit here reaches the post card, the focused post, the reply card and both
 * pop-ups, which is the dividend of rows 12/26/33 having collapsed four author
 * rows into this one: none of the five can drift away from the others.
 */
export function ArgProfile({
	author,
	side,
	marker,
	entryPrice,
	authorStake,
	originalStake,
	sold = false,
	replyCount,
	createdAt,
	chipSize,
	badge = null,
	download = false,
}: {
	author: AuthorIdentity;
	side: Side;
	marker: Marker;
	/**
	 * HTML-FINISH · MARKET DETAIL row 13 — the author's ENTRY PRICE, rendered ON
	 * the side chip as `YES @ 27%` (d5's `.sidechip`). ⛔ RAW, never `100 − x`:
	 * `bets.price_at_bet` is already the price of THE SIDE THE AUTHOR BOUGHT, so
	 * deriving the complement would print `NO @ 45%` for an author who entered NO
	 * at 55% — and would disagree with the shipped `.md` export, which renders the
	 * same field unmodified. `SideBadge` states this at length; it is repeated
	 * here because this is the site that supplies the value.
	 */
	entryPrice?: string;
	/**
	 * The stake **still held** behind this argument — the surviving lot basis,
	 * and the SAME value its lane is ranked on (ADR-0039 R4 as amended at
	 * RANK-1; RANKING.md §7.3). One field feeds the ruler and this figure, so
	 * the ordering and the number beside it cannot disagree.
	 */
	authorStake?: string;
	/**
	 * The frozen `bets.stake` — what was committed when the argument was made.
	 * Rendered STRUCK THROUGH beside the current figure, and only when the two
	 * differ, so an untouched argument shows one number rather than the same
	 * number twice (the `LotBreakdown` rule, applied here).
	 */
	originalStake?: string;
	/** R6/R10 `Sold` — exactly zero surviving. Renders the tag; never on a partial. */
	sold?: boolean;
	replyCount?: number;
	/**
	 * TIME-1 — the ISO instant this argument was written (`comments.created_at`,
	 * already on `DebatePost`/`DebateReply` at every variant since DEBATE.4).
	 *
	 * ⛔ REQUIRED, NOT OPTIONAL, AND THAT IS O-1. Every one of this component's
	 * five mounts holds the whole union member and can supply it, so a mount
	 * that forgets is a COMPILE error rather than a card that silently shows no
	 * age while its four siblings do. An optional prop here would make
	 * "timestamp on some cards and not others" — the exact inconsistency this
	 * task exists to remove — expressible by omission.
	 */
	createdAt: string;
	/**
	 * UI-OVERNIGHT entry 1b — the LANE-DOMINANCE BADGE, now part of this row.
	 *
	 * It used to be a SIBLING of this component, pinned to the card's top-right
	 * corner by every one of its three mounts. That placement is what made the
	 * row unreadable: the badge took width off line 1, the age wrapped under it,
	 * and the download mark — centred on the resulting two-line block — sat on
	 * neither line. Bringing it inside makes it one of the row's tags, wrapping
	 * with the age as a unit rather than competing with it for the same corner.
	 *
	 * ⚠ OPTIONAL AND DEFAULTED, unlike `createdAt`. A reply has no lane badge in
	 * existence (dominance is a post-ranking artifact, `REPLY_DEPTH_MAX = 1`), so
	 * a required prop would force the two reply mounts to pass `null` to say
	 * "this concept does not apply here" — which is what a default already says.
	 */
	badge?: BadgeKind | null;
	/**
	 * ⚠ change set 6 §2 — render the (non-functional) download placeholder at the
	 * END of this row. OPT-IN: only the post card and the post pop-up pass it, so
	 * replies and the reply pop-up keep the row they have.
	 */
	download?: boolean;
	/**
	 * HTML-FINISH · MARKET DETAIL row 13 — the chip's geometry preset, and it is
	 * wired at EXACTLY ONE site: the post-focus author row (`d5:964`, the only
	 * `.sidechip.md` in scope). ⛔ Card and reply chips stay on `base`, because
	 * d5's card (`:1071`) and reply (`:1547`) chips are `.sm`, and `.sm` carries
	 * CONTEXTUAL radius overrides (`:882`, `:911`) that a flattened preset has no
	 * cascade to express — `badges.tsx` records this in terms. Reusing `profile`
	 * there would silently render `var(--r)` where the mockup ratified 4px, and
	 * minting a d5-`.sm` preset would be TAKING A VALUE from the mockup.
	 * ⚠ Row 13's SUBSTANCE — `YES @ 27%` — lands at all three sites regardless,
	 * via `entryPrice`. Only the geometry is site-scoped.
	 *
	 * ⚠ THE TYPE IS `"detail"` OR NOTHING, deliberately (O-1: structural beats
	 * procedural). `base` is `SideBadge`'s `?? "base"` DEFAULT rather than a
	 * member, so omitting the prop IS the card/reply geometry — and "wire some
	 * other preset at this seam" is not expressible rather than merely
	 * discouraged.
	 */
	chipSize?: "detail";
}) {
	// UI-OVERNIGHT entry 1a — the header stake renders ABBREVIATED (`Đ 12.5k`)
	// with the exact figure on its tooltip (`CompactDharmaFigure`). The
	// strike-through below compares the two stakes AS RENDERED, so it compares
	// the ABBREVIATED spelling.
	const compactStake =
		authorStake === undefined ? "" : formatDharmaCompact(authorStake);
	return (
		// ⚠ `w-full` — change set 7 §1. `ml-auto` on the download mark only reaches
		// the TRAILING EDGE if this row actually spans its container; as a
		// shrink-to-fit box it had no slack, so the mark sat immediately beside
		// `Replies · n` instead of at the edge. The row is a flex ITEM of the card's
		// header (`PostCard`'s `justify-between` row), so without this it measured
		// exactly its content.
		// ⚠⚠ UI-OVERNIGHT entry 1b — `items-start`, NOT `items-center`, and that
		// one word is the defect this entry exists to fix. With a badge present
		// the metadata area wraps to two lines, and a CENTRED download mark then
		// sits half a line below the row it belongs to — three baselines on a row
		// that has one thing to say. Starting the row instead pins the mark to
		// line 1 and leaves it there whether the age wraps or not.
		<div className="flex w-full items-start gap-2">
			{/* ⚠ THE AVATAR IS A SIBLING OF THE WRAPPING AREA, NOT A MEMBER OF IT,
			    and that is the whole reason the mark's wrapper below is `h-5` rather
			    than `h-6`. This comment said the opposite — that the avatar's 24px
			    box set line 1's height — which was a plausible mechanism and the
			    wrong one: the avatar sits OUTSIDE the flex-wrap container, so it
			    cannot contribute to any line inside it.
			    ⚠ MEASURED at 1440×777 against the compiled CSS: line 1 is 20px, set
			    by the SIDE CHIP (`badgeVariants` ships `h-5`), which is the tallest
			    thing in Group A. At `h-6` the mark's centre sat 2px below the line
			    it belongs to. `O-3` — a right call with a wrong stated cause is
			    still a defect, and here the wrong cause produced a wrong number. */}
			{/* ⚠⚠ MOBILE-2 / RF-4 — THE PHONE AVATAR STEP, AND THE SELECTOR IS THE
			    WHOLE OF WHY IT IS SPELLED LIKE THIS. `ui/avatar.tsx:8-16` records the
			    trap in terms: the size rules are DATA-VARIANTS, so
			    `data-[size=sm]:size-6` compiles to `&[data-size=sm]` at specificity
			    (0,2,0) and beats a bare `size-*` arriving through `className` at
			    (0,1,0) — REGARDLESS of twMerge ordering. A plain `max-mobile:size-10`
			    here would therefore be silently inert, which is the worst kind of
			    wrong: it looks applied in the source and does nothing in the browser.
			    Matching the data attribute as well brings this rule to the same
			    specificity and lets the media query decide.
			    ⚠ MEASURED IN A REAL BROWSER, not reasoned — see the run report's
			    measured-delta section. The 36px the stills use is not a live step
			    (`avatar.tsx` ships 16 / 24 / 32 / 40); `lg` = 40 is the nearest that
			    fills a two-line identity block. */}
			<Avatar size="sm" className="max-mobile:data-[size=sm]:size-10">
				<AvatarImage src={author.pfpUrl} alt="" />
				<AvatarFallback>
					{author.pseudonym.slice(0, 2).toUpperCase()}
				</AvatarFallback>
			</Avatar>
			{/* HTML-FINISH · MARKET DETAIL row 12 — ONE LINE, pipe-separated:
			    avatar · pseudonym | chip | staked | Replies · N (d5 `:960-968`).
			    ⛔ NO VARIANT PROP, and that is a decision rather than an omission:
			    d5 renders the IDENTICAL row at the post-focus author row (`:960-968`)
			    and on the card (`:1067-1074`). The mockup does not ask for two
			    shapes, so a variant prop would be an abstraction over a difference
			    that does not exist (CLAUDE.md §5.2). The chip's GEOMETRY is the one
			    thing that varies, and it varies through `chipSize`. */}
			{/* ⚠⚠ UI-OVERNIGHT entry 1b — THE WRAPPING AREA, AND IT WRAPS IN TWO
			    UNITS RATHER THAN IN FIELDS. Group A (identity · side · stake ·
			    replies) and Group B (age · lane badge) are each `whitespace-nowrap`
			    flex runs, so the row has exactly two shapes: one line, or A above B.
			    ⛔ WHAT THIS REPLACES IS THE REASON FOR IT. Every field was its own
			    flex item, so a narrow card broke the row wherever it ran out of
			    width — the age alone under the stake, the badge alone under the age
			    — and the download mark, centred on the resulting block, floated
			    between the two lines. Grouping is what makes the wrap predictable.
			    ⛔ NO `flex-1` HERE, and that is a MEASURED constraint rather than a
			    style choice. `reply-card-absorber.test.tsx` reads the FIRST `flex-1`
			    descendant of a reply card and requires it to be the image cell — the
			    absorber that stops the card leaving dead space under its text. A
			    `flex-1` on this row would take that slot, and the guard would be
			    describing a header while claiming to describe an image cell. The
			    download mark keeps its own `ml-auto` instead, which reaches the
			    trailing edge for exactly the same reason it always did: the row is
			    `w-full`. */}
			{/* ⚠⚠ MOBILE-2 / RF-4 — THE TWO-LINE IDENTITY BLOCK, and every token here
			    is additive and inert above 640px.
			    The phone card wants the author on line 1 and the metadata beneath,
			    with the avatar spanning both — which is this row's EXISTING shape
			    (`items-start`, the avatar a sibling of this wrapping area) taken one
			    step further rather than a new composition. The size step is the
			    stills' 13px, stated WITH its leading because an arbitrary
			    `text-[Npx]` inherits whatever line-height was in scope and this
			    surface has a measured case of exactly that (AGENTS.md §8). */}
			<div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground max-mobile:gap-y-0.5 max-mobile:text-[13px] max-mobile:leading-[17px]">
				{/* GROUP A — never wraps internally (rule 2). A pseudonym long enough
				    to overflow it is preferred to a pseudonym that is cut in half:
				    identity is not a field this product truncates.
				    ⚠⚠ MOBILE-1 Phase A SCOPES RULE 2 TO >=640px, AND DOES IT TO SERVE
				    THE RULE RATHER THAN TO OVERRIDE IT. Rule 2 exists to prevent
				    TRUNCATION — that is the whole of its stated reason. Below 640px it
				    was PRODUCING truncation: measured at 375px on real staging data,
				    this group renders 362px inside a 203px parent and the card's own
				    `overflow-hidden` cuts the last 106px, so `Đ 10` and `Replies · 0`
				    are not shortened, they are GONE. The rule's purpose and the rule's
				    effect had come apart, and only at phone width.
				    ⇒ `max-mobile:shrink max-mobile:flex-wrap` lets the group take a
				    second LINE instead of taking more WIDTH. Nothing is shortened and
				    nothing is cut: every field stays whole, `whitespace-nowrap` still
				    forbids breaking INSIDE a field, and the pseudonym in particular is
				    as intact as rule 2 requires.
				    ⚠ THAT CLAIM IS ABOUT FIELDS AND DOES NOT REACH THE SEAMS BETWEEN
				    THEM — it was written as though it did. Every field does stay
				    whole; what wrapping also does is let the break land between a
				    separator and the field it divides, which shortens and cuts
				    nothing and still renders wrongly. That is a real consequence of
				    this token pair and it was measured, not predicted: two dangling
				    separators per author row at 375px. It is handled where the
				    separators live — see the span below — rather than by widening
				    this sentence to cover it.
				    The two tokens are one mechanism —
				    `flex-wrap` alone cannot help while `shrink-0` pins the group at its
				    362px content width, so releasing the shrink is what lets the wrap
				    ever engage.
				    ⛔ >=640px IS BYTE-IDENTICAL: both tokens are inert there, so the
				    desktop row is still one line of two locked groups exactly as
				    UI-OVERNIGHT 1b designed it, and `arg-profile-row.test.tsx` — which
				    finds these groups BY the `whitespace-nowrap` token, kept — still
				    sees the same two.
				    ⚠ This was covered before the rebase onto `main` and silently lost:
				    `PostCard` used to wrap the badge onto its own line, which freed
				    enough width that this group fit. Upstream deleted that wrapper
				    (the better fix for the crowding it addressed) and the coverage went
				    with it, one level shallower than the real constraint. */}
				<span className="flex shrink-0 items-center gap-1.5 whitespace-nowrap max-mobile:contents max-mobile:shrink max-mobile:flex-wrap">
					{/* HTML-FINISH · MARKET DETAIL row 42 — the pseudonym navigates to that
				    author's Profile. SPEC.1 `:1628` already rules exactly this for the
				    Discovery hero ("an author pseudonym click navigates to that
				    author's **Profile (§23)**"), so this extends a ruled behaviour to
				    the surface that shows the most pseudonyms rather than inventing
				    one. d5 navigates from its author name too (`:1909-1911` →
				    `nav('profile')`).
				    ⚠ ONE CHANGE REACHES EVERY SITE, which is the dividend of rows 12,
				    26 and 33 collapsing four author rows into this one: the post card,
				    the focused post, the reply card and both pop-ups all get it, and
				    none of them can drift away from it.
				    ⚠ `encodeURIComponent` — a pseudonym is user-facing identity, not a
				    slug, and the route takes it as a path segment.
				    ⚠ The accessible name is the pseudonym itself, so no `aria-label`
				    is added: an override would have to CONTAIN the visible text to
				    satisfy WCAG 2.5.3, and the visible text already says it. */}
					<Link
						href={`/u/${encodeURIComponent(author.pseudonym)}`}
						// ⚠ UI-OVERNIGHT entry 1b rule 8 — NEVER TRUNCATED. `truncate` stood
						// here since row 42; a pseudonym is the one field on this row that
						// IS a person, and half of one identifies nobody. Group A may
						// overflow a narrow card instead; that is the trade, made
						// deliberately.
						// ⚠⚠ MOBILE-2 / RF-4 — `basis-full` IS WHAT PUTS THE AUTHOR ON A
						// LINE OF THEIR OWN below 640px: the wrapping area is `flex-wrap`,
						// so a 100% basis pushes every field after it onto line 2. It works
						// ONLY because both groups dissolve to `display:contents` at the same
						// width — inside its own group box this element would take a full line
						// OF THE GROUP and change nothing about the row. The tokens are one
						// mechanism and none of them does anything alone.
						// ⚠ `display:contents` KEEPS `whitespace-nowrap` WORKING, which is
						// why dissolving the groups does not reintroduce the dangling
						// separator the block above records: `white-space` is INHERITED, so
						// it still reaches every field even with the box gone, and each
						// separator still travels inside the span of the field it leads.
						// ⚠ The size and weight are the stills' (17px / 600); the leading is
						// stated because the size is arbitrary.
						className="text-sm font-medium text-ink hover:underline max-mobile:basis-full max-mobile:text-[17px] max-mobile:leading-[22px] max-mobile:font-semibold"
					>
						{author.pseudonym}
					</Link>
					{/* ⛔⛔ EACH SEPARATOR TRAVELS WITH THE FIELD IT LEADS, IN A SPAN
					    THAT CANNOT WRAP INTERNALLY — and that span is the whole of this
					    change. `max-mobile:flex-wrap` above makes every child of group A
					    an independently wrappable flex item, so the break could land
					    BETWEEN a separator and the field it divides, stranding the pipe
					    at the end of a line where it divides nothing. MEASURED at 375px
					    on staging data: group A wrapped to three lines at 181px and
					    `GoldRhino000 |` / `YES @ 53% | Đ 25 |` BOTH ended in a dangling
					    separator — two per author row, on every card.
					    ⇒ That is UI-OVERNIGHT 1b rule 7's dangle, one level in. Rule 7
					    exists to stop exactly this, and SEP-1 already ruled the remedy:
					    a separator is placed as the FIRST CHILD of what it divides, so
					    it moves with it and line 2 reads `| YES @ 53%`. A LEADING
					    separator on a wrapped line is accepted and known
					    (`arg-profile-row.test.tsx:123-127`); a TRAILING one is the
					    defect. This applies that same ruling to group A's interior.
					    ⛔ NOT `after:`/`before:` pseudo-elements: `FieldSeparator` exists
					    because three private copies of this glyph had drifted apart
					    (SEP-1), and a `content-['|']` utility here would re-fork the
					    seam that component was lifted to unify.
					    ⚠ >=640px IS UNCHANGED: `flex-wrap` is inert there, so these
					    spans are transparent — one line, same gaps, same order. Group B
					    is untouched; its separator was already its first child and it
					    measured no dangle. */}
					<span className="flex shrink-0 items-center gap-1.5">
						<FieldSeparator />
						<SideBadge side={side} price={entryPrice} size={chipSize} />
						<PositionMarker marker={marker} />
					</span>
					{authorStake !== undefined ? (
						<span className="flex shrink-0 items-center gap-1.5">
							<FieldSeparator />
							{/* RANK-1 / ADR-0039 R6 — the figure FOLLOWS THE RULER. This is
						    the stake still held, which is exactly what the lane sorted
						    on; a fully-exited argument reads `Đ 0` here rather than
						    keeping the number that bought its slot. The original is
						    shown struck through when the figure has moved, so nothing
						    is erased — only re-labelled as history.
						    ⛔ "Lot" appears nowhere here (R1): on screen these are
						    ARGUMENTS. `tests/unit/debate/render/arg-stake.test.tsx`
						    pins that with a textContent assertion. */}
							{/* ⚠⚠ change set 8 §1 — THE WHOLE UNIT GOES `text-ink`, GLYPH AND
						    NUMBER TOGETHER, AND IT STAYS ONE TEXT NODE.
						    ⛔ THE NUMBER IS NOT PROMOTED SEPARATELY, and that is a founder
						    ruling rather than a shortcut. `dharma-spacing.test.tsx` asserts
						    this element's `innerHTML` CONTAINS the contiguous string
						    `Đ 1,500` (site 3, PD-3-07). Styling the glyph and the figure
						    differently requires wrapping one of them, which breaks that
						    contiguity — there is no arrangement that does both. That guard is
						    what §18's closure of PD-3-07 rests on, so the size asymmetry is
						    routed to a task that can amend it properly.
						    ⇒ Colour only here: `text-ink` lifts the figure out of the row's
						    inherited `text-muted-foreground` to the same weight as
						    `Replies · n`, with the node shape untouched. */}
							{/* UI-OVERNIGHT entry 1a — ABBREVIATED past Đ10,000, exact figure on
						    the tooltip. `CompactDharmaFigure` owns both halves of that rule
						    so this row and the profile's head cluster cannot drift apart on
						    it; the class string and the contiguous `Đ 1,500` text node the
						    guard below reads are unchanged. */}
							<CompactDharmaFigure
								value={authorStake}
								className="font-mono text-ink"
							/>
							{/* ⚠ COMPARED AS RENDERED, not as stored. `formatDharmaCompact`
						    rounds to whole Đ and abbreviates past Đ10,000, so comparing the
						    raw 18-dp strings would strike through on any movement at all —
						    including one too small to change what is printed, giving
						    `Đ 1,500  ~~Đ 1,500~~`. The RULER keeps the full precision; only
						    this affordance keys off what is on screen, which since
						    UI-OVERNIGHT entry 1a means the ABBREVIATED spelling: two stakes
						    that both print `Đ 12.5k` are the same figure to the reader, and
						    striking one through beside the other would say otherwise. */}
							{!sold &&
							originalStake !== undefined &&
							formatDharmaCompact(originalStake) !== compactStake ? (
								<CompactDharmaFigure
									value={originalStake}
									testId="argstake-original"
									className="font-mono text-n4 line-through"
								/>
							) : null}
							{sold ? (
								<InfoTip content={GLOSSARY.sold} asChild>
									<span
										data-testid="argstake-sold"
										className="rounded-[var(--r-chip)] bg-n1 px-1.5 py-0.5 font-bold text-[10px] text-n5 uppercase tracking-[0.08em]"
									>
										{SOLD_LABEL}
									</span>
								</InfoTip>
							) : null}
						</span>
					) : null}
					{replyCount !== undefined ? (
						<span className="flex shrink-0 items-center gap-1.5">
							<FieldSeparator />
							{/* `.repmeta` (`d5:580`) — `font-weight:700;letter-spacing:.12em;
						    text-transform:uppercase;color:var(--ink)`, with `.repn`
						    (`:579`) setting the COUNT back to 13px / no tracking. The row
						    read `Replies · 0` in sentence case at the muted weight, which
						    is the one field in this line the mockup deliberately promotes
						    to ink. */}
							<span className="text-[9.5px] font-bold tracking-[0.12em] text-ink uppercase">
								Replies ·{" "}
								<span className="text-[13px] tracking-normal">
									{replyCount}
								</span>
							</span>
						</span>
					) : null}
				</span>
				{/* GROUP B — the age and the lane badge, one unbreakable unit. When
				    the row runs out of width this MOVES WHOLE to a second line; it is
				    never split, so the badge cannot end up orphaned under its own
				    timestamp.
				    ⚠⚠ THE BADGE MOVED HERE FROM THE CARD'S TOP-RIGHT CORNER
				    (UI-OVERNIGHT entry 1b, founder ruling). It used to be a sibling of
				    this whole component, pinned to the corner — which is what pushed
				    the age onto a second line in the first place, and what left the
				    download mark centred against a two-line block. It is a TAG about
				    the argument, so it now travels with the argument's other tags.
				    ⚠⚠ AND IT LEADS WITH THE SEPARATOR — SEP-1, founder ruling, and
				    this block argued the OPPOSITE until this commit. It read "⛔ AND IT
				    NO LONGER TAKES A `Sep` … a pipe before the age would DANGLE at the
				    end of line 1 the moment Group B wraps", which removed the divider
				    from this row and left canon §3 item 11 owed an amendment. The
				    founder ruled the other way: the divider stays, and it moves INSIDE
				    Group B as its LEADING element.
				    ⛔ THAT PLACEMENT IS THE WHOLE ANSWER TO THE DANGLE, and it is why
				    the position is not interchangeable with "before the group". A
				    separator that is a sibling of Group B is the last thing on line 1
				    when the group wraps away from it — the dangle the removal was
				    reaching for. Inside it, it is the first thing on line 2 and travels
				    with the timestamp it divides: `| 14d ago  [badge]`. That second
				    line is ACCEPTED AND KNOWN (founder ruling), and it is deliberately
				    not measured around — no ResizeObserver, no badge-conditional
				    render, nothing that would make this row's composition depend on
				    layout the server cannot see.
				    ⇒ Canon §3 item 11 is no longer owed an amendment for this row: it
				    already records the field AND its divider, which is what the three
				    sibling author rows ship. This row now agrees with them.
				    ⛔⛔ MOBILE-2 — GROUP B DOES **NOT** TAKE GROUP A'S `contents`, AND THE
			    REASON IS A DEFECT I SHIPPED AND THEN MEASURED. Dissolving A is what
			    lets the pseudonym take a line of its own on a phone. Dissolving B
			    as well made its leading `│` an independent flex item, so the break
			    landed BETWEEN the separator and the age it divides — measured at
			    375px on the preview: `│ YES @ 10% │ Đ 10 │ REPLIES · 0 │` ending in
			    a pipe that divides nothing, with `3d ago` alone on line 3. That is
			    precisely the dangle the block above records as fixed, reintroduced
			    one width down. B keeps its box: it either fits after A's last field
			    or wraps WHOLE, and its separator cannot be stranded either way.
			    ⚠ GROUP B TAKES THE SAME `max-mobile:` PAIR AS GROUP A, and for the
				    same reason — see that group's block above for the full argument.
				    It is applied here even though group B is the narrower of the two
				    and does not overflow on today's data: the pair is a property of the
				    ROW's behaviour at phone width, not of one group's current contents,
				    and a longer badge string is exactly the kind of change that would
				    otherwise reintroduce the clip in the half nobody thought to cover. */}
				<span className="flex shrink-0 items-center gap-1.5 whitespace-nowrap max-mobile:shrink max-mobile:flex-wrap">
					{/* TIME-1 · Form B — HOW LONG AGO, AND IT IS THE LAST THING GROUP A
				    SAYS. The lane badge follows it (entry 1b, rule 5); nothing else
				    does.
				    ⛔ INSIDE THIS DIV, NOT THE ROW ABOVE IT. The outer row's last
				    child is the `ml-auto` download mark, which sits at the trailing
				    EDGE; appending there would put the age past a control rather than
				    after the tags. Canon §3 item 11 now rules exactly that — "the age
				    precedes that cluster" — so the position is ratified rather than
				    merely reasoned from d5.
				    ⚠⚠ THE SEPARATOR IS BACK, AND IT IS THE FIRST THING IN THIS GROUP.
				    It was removed at UI-OVERNIGHT entry 1b to stop it dangling at the
				    end of line 1, which left this row the ONLY author row in the
				    product with no divider before its age — Discovery's hero and the
				    profile's argument list both keep theirs, so the same row read
				    `… REPLIES · 2  14d ago` here and `… Đ 18 | 1d ago` there. The
				    founder ruled the divider back in with its placement stated: inside
				    Group B, ahead of the age, so a wrap carries it to line 2 instead of
				    stranding it on line 1.
				    ⛔ THIS ROW STILL HAS NO GUARD COUNTING ITS OWN PIPES, and that is
				    a recorded gap rather than a licence: a composition change here is
				    invisible to CI, while both sibling rows redden. Adding one would
				    pin a third composition against canon and is a deliberate decision,
				    not a side effect of this pass. What IS guarded, since this commit,
				    is that the pipe sits inside Group B rather than beside it —
				    `arg-profile-row` asserts the group's own children, which is the
				    only part of the wrap jsdom can see.
				    ⛔ NO SIZE IS PASSED TO EITHER LEAF, and for two different reasons.
				    `RelativeTime` inherits this row's `text-xs` because stating a size
				    here would state it without its leading (the trap that put every
				    tile 10px tall at PROFILE-FULL); `FieldSeparator` states its OWN
				    size and leading and inherits nothing, because a seam that changes
				    size per surface is the drift it was lifted to end. */}
					<FieldSeparator />
					<RelativeTime createdAt={createdAt} />
					{/* ⚠ AT MOST ONE BADGE EXISTS TO RENDER. `LaneBadge` takes a single
					    `Badge | null` (a post dominates a lane or it does not), so the
					    brief's "at most 2" is satisfied by the data shape rather than by
					    a slice here — writing a cap over a scalar would be code that
					    cannot run. If the lane model ever returns a list, the cap
					    belongs at that seam, not at this one.
					    ⚠ A REPLY PASSES NOTHING: lane dominance is a post-ranking
					    artifact, and `LaneBadge` renders `null` for `null`. */}
					<LaneBadge badge={badge ?? null} />
				</span>
			</div>
			{/* ⚠⚠ UI-QUICK change set 6 §2 — THE DOWNLOAD PLACEHOLDER MOVED HERE FROM
			    THE TITLE ROW, founder ruling. On the title row it shared an absolutely
			    positioned cluster with `Know more`, and that cluster's reserved gutter
			    cost every post title 92px of width — enough to push long titles past
			    the pre-existing two-line clamp into an ellipsis. On this row it costs
			    the title nothing.
			    ⛔ OPT-IN, NOT UNCONDITIONAL. `ArgProfile` is shared by the post card,
			    the focused post, the reply card and both pop-ups; rendering it for all
			    of them would put a download affordance on replies, which the ruling
			    does not ask for. Only the two mounts named pass it.
			    ⚠ ONE SIZE STEP LARGER than it was — `icon-sm` (28px box, 16px glyph)
			    where the title cluster used `icon-xs` (24px box, 14px glyph).
			    ⛔ STILL A NON-FUNCTIONAL PLACEHOLDER: no handler, no href, `disabled`
			    AND `aria-disabled`, so it is unreachable by pointer and keyboard and
			    announces itself as unavailable rather than promising a download this
			    build cannot perform. */}
			{download ? (
				/* ⚠⚠ UI-OVERNIGHT entry 1b — `h-5` IS THE WHOLE ALIGNMENT MECHANISM.
				   Line 1 of the metadata area is 20px, set by the SIDE CHIP's `h-5`
				   (the tallest thing in Group A — the avatar is a sibling of the
				   wrapping area and contributes to no line inside it). This wrapper
				   is that same height and centres the mark inside it, so the mark
				   sits on line 1's centre line whether the row is one line or two.
				   The 32px button overhangs the band by 6px top and bottom, which is
				   invisible on a ghost control and keeps its box — and therefore the
				   ruled glyph size — untouched.
				   ⛔ NOT AN OFFSET. A negative margin would have produced the same
				   pixels today and drifted the moment either box changed size; two
				   boxes that agree by name cannot.
				   ⚠ MEASURED, not reasoned: at 1440×777 against the compiled CSS the
				   line is 20.00px and the mark's centre now coincides with it. It was
				   `h-6` on the reasoning that the avatar set the line, and that put
				   the mark 2px low — jsdom performs no layout, so only the browser
				   could see it. */
				<span className="ml-auto flex h-5 shrink-0 items-center">
					<Button
						variant="ghost"
						size="icon"
						disabled
						aria-disabled="true"
						aria-label="Download post image"
						// ⚠ change set 7 §1 — `text-ink`, the SAME token `Replies · n` uses
						// two elements to the left, not the muted ramp. The mark and the one
						// promoted field on this row now sit at the same emphasis.
						// ⚠ One step larger again: `icon-sm` (28px box / 16px glyph) →
						// `icon` (32px / 20px). ⛔ `disabled` keeps it inert at every size;
						// a bigger placeholder reads MORE like a working control, so the
						// disabled state matters more here than it did at 24px.
						className="shrink-0 text-ink [&_svg]:size-5"
					>
						<Download />
					</Button>
				</span>
			) : null}
		</div>
	);
}
