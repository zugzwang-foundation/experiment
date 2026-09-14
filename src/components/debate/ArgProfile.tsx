import Link from "next/link";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { FieldSeparator } from "@/components/ui/field-separator";
import { InfoTip } from "@/components/ui/info-tip";
import { RelativeTime } from "@/components/ui/relative-time";
import { GLOSSARY, SOLD_LABEL } from "@/lib/copy/glossary";
import type { Badge as BadgeKind } from "@/lib/ranking";

import { LaneBadge, PositionMarker, SideBadge } from "./badges";
import { CompactDharmaFigure } from "./DharmaFigure";
import { DownloadPostImage } from "./DownloadPostImage";
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
	download,
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
	 * ⚠ change set 6 §2 — render the download mark at the END of this row.
	 * OPT-IN: only the post card and the post pop-up pass it, so replies and the
	 * reply pop-up keep the row they have. Since POST-IMAGE-EXPORT it is a
	 * WORKING control (`DownloadPostImage`): the value is the post's deep-link
	 * ordinal, which the `/m/[slug]/export/image?post=N` route resolves exactly
	 * as the page's `?post=` does. An object rather than a boolean so a mount
	 * cannot ask for the mark without saying which post it downloads.
	 */
	download?: { ordinal: number };
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
		<div className="flex w-full items-start gap-2 max-mobile:relative">
			{/* ⛔⛔ MOBILE-2c R-2 — AT PHONE WIDTH THE AVATAR LEAVES THE FLOW, AND
			    THAT IS WHAT MAKES THE METADATA ROW FULL-WIDTH.

			    Founder ruling Q2-a: avatar 32px beside the pseudonym on line 1, and
			    the metadata row running the full card width beneath it on one line.
			    Measured at 360 before the change: the row's left edge sat at x=73
			    against a card whose content starts at x=25 — 48px of the width the
			    row needs, spent on an indent under a picture.

			    ⚠ THE INDENT IS NOT A PADDING ANYONE CAN REMOVE. It is the avatar's
			    own box, and the avatar is a SIBLING of the wrapping area (the
			    paragraph below says why, and that structure is deliberate). So the
			    only way to give line 2 the full width is to stop the avatar
			    occupying line 1's flow: `absolute` on the avatar, `relative` on the
			    row root, and `ps-10` on the pseudonym to reserve the 32 + 8 the
			    avatar no longer claims for itself.

			    ⚠ WHAT WAS REJECTED, because it reads like the obvious answer: lifting
			    the pseudonym out of the metadata container to be the avatar's
			    sibling. It is a one-node DOM move, and it is NOT desktop-neutral —
			    the pseudonym would then be separated from the first field by the row
			    root's `gap-2` instead of the wrapping area's `gap-x-1.5`, moving
			    every field on the desktop by 2px. B1 is a pixel wall, so the answer
			    had to be four tokens rather than a better tree.

			    ⚠ AND THE "ONE LINE" HALF WAS ALREADY TRUE. Measured before any
			    change, at 360/375/390/430, the metadata row was already 1 line at
			    13px including the sold/exited case — so the ruling's 12px fallback
			    is NOT applied: acting on it would have been a fix for a state that
			    does not exist (`OVN-O4`). It is reported as measured instead. */}
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
			<Avatar
				size="sm"
				className="max-mobile:absolute max-mobile:top-0 max-mobile:left-0 max-mobile:data-[size=sm]:size-8"
			>
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
			{/* ⛔⛔ 13px, AND 12px WHEN A SOLD POSITION IS ON THE ROW — the founder's
			    Q2-a fallback, and it IS needed. ADR-0051 A2: "13px; 12px only when
			    the sold-position labels overflow at 360".

			    ⚠ I FIRST RECORDED THIS AS NOT NEEDED, ON A MEASUREMENT THAT COULD NOT
			    SEE IT. The probe counted this element's ELEMENT CHILDREN — but Group A
			    below is `display: contents`, so its box is 0×0 and the metadata items
			    are its GRANDCHILDREN. The count saw `[GroupA(0×0), GroupB]`, reported
			    ONE line for every card at every width, and I logged the ruling's
			    fallback as a fix for a state that does not exist. Walking THROUGH the
			    zero-size boxes: **2 of 11 cards wrap to two lines at 360, 375, 390 and
			    430 — and the sold card is one of them.**

			    ⚠ `Exited` and `Sold` are two extra chips on a row that already carries
			    four fields and three separators, which is why this case and no other
			    needs the step. Keyed on the props rather than on a width, so it is one
			    token pair on the cards that have the labels instead of a size change
			    for every reader. */}
			{/* ⚠ MOBILE-2e · R-Q1 — `max-mobile:gap-x-1` (4px, from 6). MEASURED, and
			    the size of the problem is why it is here rather than a type-size
			    change: at 360px the widest row — a three-digit stake beside a
			    minutes-old timestamp — ended at x=298.4 in a 295px box. **3.4px**.
			    Six seams at 2px each buys 12, which clears it with room, and it
			    costs the row nothing a reader can name. Dropping the metadata from
			    13px to 12px was the alternative and was rejected: it would have
			    overridden a ruled type size to win a margin a gap already wins. */}
			<div
				className={`flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground max-mobile:flex-1 max-mobile:gap-x-1 max-mobile:gap-y-0.5 ${
					sold || marker === "Exited"
						? "max-mobile:text-[12px] max-mobile:leading-[16px]"
						: "max-mobile:text-[13px] max-mobile:leading-[17px]"
				}`}
			>
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
				    ⛔⛔ MOBILE-2 — BOTH TOKENS ARE NOW INERT ON GROUP A, and the
				    correction is written here rather than appended below because this is
				    the paragraph a reader reaches first (`O-5`). `max-mobile:contents`
				    removes the group's BOX at the same width, and `flex-shrink` /
				    `flex-wrap` are properties of a box — so neither applies. What
				    replaced the mechanism is the same outcome one level up: the fields
				    become items of the ROW and wrap against it, which is what puts the
				    author on a line of their own. The two tokens are kept rather than
				    deleted for the reason the ADR gives for Phase A's other redundant
				    tokens — their guard is live, and removing a token from a desktop
				    component is a desktop edit. `@code-reviewer` measured the inertness.
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
						// ⚠⚠ UI-OVERNIGHT entry 1b rule 8 — NEVER TRUNCATED, **AND THAT NOW
						// HOLDS ONLY AT AND ABOVE 640px.** The rule as written: "a pseudonym
						// is the one field on this row that IS a person, and half of one
						// identifies nobody. Group A may overflow a narrow card instead; that
						// is the trade, made deliberately." It still governs the desktop row,
						// where the width to honour it exists.
						// ⛔ BELOW 640px IT IS WITHDRAWN BY ADR-0051 A8 D-2, and the
						// correction is written HERE rather than only in the block below
						// because this is the paragraph a reader reaches first (`O-5`). The
						// trade rule 8 names — overflow rather than truncate — stopped being
						// available when round eight made two lines the ceiling: the only
						// remaining ways to fit are a third line (forbidden) or a shorter
						// name. See the block on the `className` below for the measurement
						// that chose between them.
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
						// ⛔ `min-h-8` — MOBILE-2c, found by `@code-reviewer`. The avatar is
						// `absolute` at phone width and is 32px tall from y=0; this line's
						// own box is 22px (`leading-[22px]`) and the wrapping area's
						// `gap-y-0.5` adds 2px, so metadata line 2 began at y=24 and the
						// avatar's lower 8px painted over the pipe and the side badge —
						// the avatar being the only positioned element in the row, it wins
						// the paint. Matching line 1's minimum to the avatar's own height
						// is the additive fix; jsdom cannot see it and B12 counts LINES,
						// not overlap, so the measurement is a browser one.
						// ⚠⚠ MOBILE-2e · R-Q1 — `max-mobile:basis-full` IS GONE FROM HERE AND
						// HAS MOVED TO AN EXPLICIT BREAK, because the two do different jobs
						// and only one of them is wanted now. `basis-full` on the pseudonym
						// says "this field owns line 1 alone"; the ruling is that the chips
						// join it there. A zero-height `basis-full` item ordered between the
						// two groups says "break HERE" without claiming the line.
						// ⛔⛔ MOBILE-2l · R-4 — THE PSEUDONYM IS NOW THE ELEMENT THAT
						// YIELDS, BELOW 640px ONLY, AND THAT REVERSES THE RULE DIRECTLY
						// ABOVE. UI-OVERNIGHT 1b rule 8 says NEVER TRUNCATED — "half of one
						// identifies nobody" — and ADR-0051 O-1(c) then allowed the block a
						// second line at 360 with two chips. Round eight withdraws that
						// allowance: two lines is the CEILING at every phone width
						// (ADR-0051 A8 D-2), and something has to give to hold it.
						// ⇒ MEASURED, which is what decides WHICH thing gives. At 360 the
						// wrapping area is 270.79px. A 20-character pseudonym is ~238px
						// with its `ps-10` reserve, and the two chips are 41.59 + 42.35
						// with 8px of seams — 329.94px against 270.79. Line 1 wraps, the
						// block becomes THREE lines, and rule 8's own purpose (the reader
						// can see who is speaking) is what the third line costs.
						// ⇒ The chips and the export mark are FIXED-WIDTH facts about the
						// position; the name is the only elastic field on the line. So the
						// name ellipsizes and everything else stays whole — the inverse of
						// the group-wrap remedy `MOBILE-1 Phase A` chose, because that one
						// bought its width with a line this ruling no longer has.
						// ⚠ `min-w-0` IS NOT OPTIONAL BESIDE `truncate`. A flex item's
						// automatic minimum is its content, so `overflow:hidden` alone would
						// never get the chance to clip — the item would simply refuse to
						// shrink and the row would overflow exactly as it does now.
						// ⛔⛔ AND `flex-1` IS THE ONE THAT ACTUALLY DECIDES IT — MEASURED,
						// after `min-w-0 truncate` ALONE SHIPPED THREE LINES. The container
						// is `flex-wrap`, and a wrapping flex container does not shrink an
						// item to avoid a break: it breaks. Line-breaking runs on each item's
						// HYPOTHETICAL size — its flex-basis — so with the name's basis at
						// `auto` the browser sized it to its full text (215.60px at 360),
						// found room for the name and `Exited` and pushed `Sold` onto a third
						// line. `flex-1` is `flex: 1 1 0%`: the name's hypothetical size
						// becomes its padding alone, so every chip is placed on line 1 FIRST
						// and the name then GROWS into whatever is left and truncates there.
						// ⚠ Measured at 360 with a 20-character pseudonym and both chips:
						// 3 lines and an unclipped 215.60px name before, 2 lines and a
						// clipped name after. `truncate` was live the whole time and had
						// nothing to cut — the same shape as `MOBILE-2h · R-1`'s `max-w-full`
						// finding one file over, and for the same reason: the constraint was
						// on the wrong box.
						// ⚠⚠ MOBILE-2m · R-4 / ADR-0051 A9 D-4 — 17px → 14px, AND THE
						// LEADING MOVES WITH IT. An arbitrary `text-[Npx]` does NOT reset
						// the paired line-height (AGENTS.md §8): it inherits whatever step
						// was in scope, so stating the size without the leading is how a
						// 14px name keeps a 22px line box. 18px holds the shipped 17/22
						// ratio (1.294) at the new size.
						// ⚠ THE BLOCK DOES NOT GET SHORTER, AND THAT IS THE POINT OF
						// `max-mobile:min-h-8` ABOVE. The name's row is floored at 32px to
						// match the avatar beside it, so the type steps down INSIDE a box
						// whose height is set by something else — which is what lets A9 D-4
						// say "nothing else in the block moves" and mean it. A8 D-2's
						// two-line rule is measured again rather than inferred from that.
						// ⚠ >=640px IS UNTOUCHED: both tokens are `max-mobile:`, so rule 8
						// still governs the desktop row it was written for, and the
						// accessible name is the full pseudonym at every width — this
						// clips in CSS and never slices the string.
						className="text-sm font-medium text-ink hover:underline max-mobile:-order-2 max-mobile:min-h-8 max-mobile:min-w-0 max-mobile:flex-1 max-mobile:ps-10 max-mobile:truncate max-mobile:text-[14px] max-mobile:leading-[18px] max-mobile:font-semibold"
					>
						{author.pseudonym}
					</Link>
					{/* ⛔ THE LINE BREAK, AS AN ELEMENT. Flexbox has no "break before this
					    item"; the only way to end a line in a wrapping row is an item that
					    fills it. This one is `display:none` at and above 640px — so it is
					    not merely inert on the desktop, it is not in the layout at all —
					    and below 640px it is a zero-height, zero-text box ordered between
					    the line-1 group and everything else.
					    ⚠ It lives INSIDE group A rather than beside it, because group A is
					    `display:contents` at phone width — so its children ARE the row's
					    flex items and this one lands where it needs to, while at 1440 it is
					    a hidden child of a group whose composition several guards read by
					    text content and by no-wrap class. It adds neither. */}
					<span
						aria-hidden="true"
						data-testid="argprofile-line-break"
						className="hidden max-mobile:-order-1 max-mobile:block max-mobile:h-0 max-mobile:basis-full"
					/>
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
					{/* ⚠ MOBILE-2e · R-Q1 — `max-mobile:contents` HERE IS WHAT LETS THE
					    CHIP LEAVE. `order` is a property of flex ITEMS, and until this box
					    dissolves the chip is not one — it is a child of a nested flex row,
					    where reordering moves it beside the side badge and nowhere else.
					    Dissolving costs the separator its guaranteed adjacency to the badge
					    (they become independent items that could wrap apart), which is the
					    trade group B measured and lost once — and it is acceptable here
					    only because the whole point of the move is that line 2 now FITS on
					    one line at every phone width, so nothing on it wraps at all. The
					    B12 measurement is the thing that keeps that true. */}
					<span className="flex shrink-0 items-center gap-1.5 max-mobile:contents">
						{/* ⚠⚠ MOBILE-2e · R-Q1 — THE LEADING PIPE IS DROPPED BELOW 640px,
						    and it is dropped because the ruled line 2 is
						    `SideBadge │ Đ n │ Replies · n │ age` — four fields and THREE
						    seams, not four. On the desktop this separator divides the
						    pseudonym from the side badge on one continuous line and it
						    stays exactly where it is. On a phone the pseudonym is on the
						    line above, so the same glyph opens a line it divides nothing
						    at — and it cost the 9px that made the widest row (a three-digit
						    stake beside a minutes-old timestamp) break at 360px.
						    ⚠ HIDDEN, NOT REMOVED. Every `|` on this row is asserted to be
						    the shared primitive carrying `aria-hidden`; a CSS-hidden node
						    is still that, and a conditional render would be a second
						    branch for a phone in a component the desktop shares. */}
						<FieldSeparator className="max-mobile:hidden" />
						<SideBadge side={side} price={entryPrice} size={chipSize} />
						{/* ⛔ MOBILE-2l · R-4 — ONE CHIP STYLE, AND THIS IS ITS HALF OF IT.
						    `Flipped`/`Exited` and `Sold` were two registers on one line:
						    this chip is 10px sentence-case normal-weight, and the `Sold`
						    chip below was 10px UPPERCASE bold with 0.08em tracking. Both
						    become 11px sentence case at phone width; the ground was already
						    shared and only looked different (`bg-secondary` resolves to
						    `var(--color-n1)`, `globals.css:61`, which is the literal the
						    other chip names — so nothing there had to move).
						    ⚠ `shrink-0` because R-4 makes the NAME the elastic field: a
						    chip allowed to shrink would take the ellipsis the pseudonym is
						    supposed to take, and the line would still wrap.
						    ⚠ The leading is stated with the size — an arbitrary
						    `text-[Npx]` inherits whatever line-height was in scope
						    (AGENTS.md §8), and this surface has a measured case of it. */}
						<PositionMarker
							marker={marker}
							className="max-mobile:-order-2 max-mobile:shrink-0 max-mobile:text-[11px] max-mobile:leading-[16px]"
						/>
					</span>
					{authorStake !== undefined ? (
						<span className="flex shrink-0 items-center gap-1.5 max-mobile:contents">
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
										/* ⛔ MOBILE-2l · R-4 — THE OTHER HALF OF THE ONE CHIP STYLE.
										   This chip is the one that moves, because it is the one
										   that diverged: 10px BOLD UPPERCASE with 0.08em tracking
										   beside a `Flipped` chip that was 10px sentence-case and
										   normal weight. Below 640px both read at 11px, sentence
										   case, normal weight, no tracking, `rounded-sm`.
										   ⚠ THE GROUND AND THE PADDING NEEDED NO EDIT AND THAT IS
										   MEASURED, not assumed: `bg-n1` here and `bg-secondary` on
										   the Badge are the same colour (`--secondary:
										   var(--color-n1)`, `globals.css:61`), and both chips
										   already carry `px-1.5 py-0.5`. Only case, weight,
										   tracking, size, radius and the text token differed.
										   ⚠ `SOLD_LABEL` is the string `"Sold"` — the UPPERCASE was
										   never in the copy, it was this class. Dropping
										   `uppercase` at phone width therefore changes no text and
										   no accessible name; `>=640px` still renders `SOLD`. */
										className="rounded-[var(--r-chip)] bg-n1 px-1.5 py-0.5 font-bold text-[10px] text-n5 uppercase tracking-[0.08em] max-mobile:-order-2 max-mobile:shrink-0 max-mobile:rounded-sm max-mobile:text-[11px] max-mobile:leading-[16px] max-mobile:font-normal max-mobile:tracking-normal max-mobile:text-muted-foreground max-mobile:normal-case"
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
				{/* ⚠⚠ MOBILE-2e · R-Q1 — GROUP B DISSOLVES AT PHONE WIDTH, AND THE
				    COMMENT BELOW RECORDS WHY THAT WAS ONCE A DEFECT. It was: with the
				    chips still on line 2 the row overflowed, the break landed between
				    this group's leading pipe and the age, and `3d ago` was stranded on a
				    third line. The condition that produced it is the one this refinement
				    removes — line 2 carries four fields and no chips now, and it fits on
				    one line at 360/375/390/430. So the dissolution is safe for the same
				    reason it was unsafe before, and B12 is what holds the premise.
				    ⚠ `max-mobile:shrink` and `max-mobile:flex-wrap` are now INERT here
				    for the same reason they are inert on group A — a `display:contents`
				    box has no flex behaviour of its own. They are kept rather than
				    stripped: removing a token from a shared component is a desktop edit,
				    and these two cost nothing. */}
				<span className="flex shrink-0 items-center gap-1.5 whitespace-nowrap max-mobile:contents max-mobile:shrink max-mobile:flex-wrap">
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
					<LaneBadge badge={badge ?? null} className="max-mobile:-order-2" />
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
			    build cannot perform.
			    ⚠ POST-IMAGE-EXPORT — THE PLACEHOLDER IS NOW A CONTROL. The mark
			    keeps its position (`ml-auto`, trailing edge), its size (`icon`,
			    32px / 20px) and its token (`text-ink`); what changed is that it
			    does something. `DownloadPostImage` owns the fetch, the busy state
			    and the failure line, and still renders DISABLED when it has no
			    route slug to build a URL from — so the "inert when it cannot
			    perform" property above survives, now as a condition rather than a
			    constant. */}
			{download ? (
				/* ⚠⚠ UI-OVERNIGHT entry 1b — `h-5` IS THE WHOLE ALIGNMENT MECHANISM.
				   Line 1 of the metadata area is 20px, set by the SIDE CHIP's `h-5`
				   (the tallest thing in Group A — the avatar is a sibling of the
				   wrapping area and contributes to no line inside it). This wrapper
				   — `DownloadPostImage`'s ROOT span, since POST-IMAGE-EXPORT — is that
				   same height and centres the mark inside it, so the mark
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
				<DownloadPostImage ordinal={download.ordinal} />
			) : null}
		</div>
	);
}
