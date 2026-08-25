import { Download } from "lucide-react";
import Link from "next/link";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { RelativeTime } from "@/components/ui/relative-time";

import { PositionMarker, SideBadge } from "./badges";
import { formatDharma } from "./format";
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
	return (
		// ⚠ `w-full` — change set 7 §1. `ml-auto` on the download mark only reaches
		// the TRAILING EDGE if this row actually spans its container; as a
		// shrink-to-fit box it had no slack, so the mark sat immediately beside
		// `Replies · n` instead of at the edge. The row is a flex ITEM of the card's
		// header (`PostCard`'s `justify-between` row), so without this it measured
		// exactly its content.
		<div className="flex w-full items-center gap-2">
			<Avatar size="sm">
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
			<div className="flex min-w-0 flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
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
					className="truncate text-sm font-medium text-ink hover:underline"
				>
					{author.pseudonym}
				</Link>
				<Sep />
				<SideBadge side={side} price={entryPrice} size={chipSize} />
				<PositionMarker marker={marker} />
				{authorStake !== undefined ? (
					<>
						<Sep />
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
						<span className="font-mono text-ink">
							Đ {formatDharma(authorStake)}
						</span>
						{/* ⚠ COMPARED AS RENDERED, not as stored. `formatDharma` rounds to
						    whole Đ, so comparing the raw 18-dp strings would strike through on
						    any movement at all — including one too small to change what is
						    printed, giving `Đ 1,500  ~~Đ 1,500~~`. The RULER keeps the full
						    precision; only this affordance keys off what is on screen. */}
						{!sold &&
						originalStake !== undefined &&
						formatDharma(originalStake) !== formatDharma(authorStake) ? (
							<span
								data-testid="argstake-original"
								className="font-mono text-n4 line-through"
							>
								Đ {formatDharma(originalStake)}
							</span>
						) : null}
						{sold ? (
							<span
								data-testid="argstake-sold"
								className="rounded-[var(--r-chip)] bg-n1 px-1.5 py-0.5 font-bold text-[10px] text-n5 uppercase tracking-[0.08em]"
							>
								Sold
							</span>
						) : null}
					</>
				) : null}
				{replyCount !== undefined ? (
					<>
						<Sep />
						{/* `.repmeta` (`d5:580`) — `font-weight:700;letter-spacing:.12em;
						    text-transform:uppercase;color:var(--ink)`, with `.repn`
						    (`:579`) setting the COUNT back to 13px / no tracking. The row
						    read `Replies · 0` in sentence case at the muted weight, which
						    is the one field in this line the mockup deliberately promotes
						    to ink. */}
						<span className="text-[9.5px] font-bold tracking-[0.12em] text-ink uppercase">
							Replies ·{" "}
							<span className="text-[13px] tracking-normal">{replyCount}</span>
						</span>
					</>
				) : null}
				{/* TIME-1 · Form B — HOW LONG AGO, AND IT IS THE LAST THING ON THE ROW.
				    ⛔ INSIDE THIS DIV, NOT THE ROW ABOVE IT. The outer row's last
				    child is the `ml-auto` download mark, which sits at the trailing
				    EDGE; appending there would put the age past a control rather than
				    after the tags. Canon §3 item 11 now rules exactly that — "the age
				    precedes that cluster" — so the position is ratified rather than
				    merely reasoned from d5.
				    ⚠⚠ THE `Sep` IS RULED IN, AND THIS BLOCK ARGUED THE OPPOSITE UNTIL
				    THE COMMIT BEFORE THIS ONE. It read "⛔⛔ NO `Sep` BEFORE IT, AND
				    THAT IS A MEASURED DECISION RATHER THAN AN OMISSION", on the
				    reasoning that two shipped guards count the pipes on the SIBLING
				    rows against a governing source and would redden on a fourth. That
				    was right about the guards and wrong about the remedy. The founder
				    ruled Form B; canon §3 item 11 gained the field AND its divider
				    first; the counts move because the ruling moved. The ordering is
				    the whole point — a guard edited ahead of the ruling it cites is a
				    guard edited to match the code.
				    ⛔ THIS ROW STILL HAS NO GUARD COUNTING ITS OWN PIPES, and that is
				    a recorded gap rather than a licence: a composition change here is
				    invisible to CI, while both sibling rows redden. Adding one would
				    pin a third composition against canon and is a deliberate decision,
				    not a side effect of this pass.
				    ⛔ NO SIZE IS PASSED. This row is `text-xs` and the leaf inherits
				    it — stating a size here would state it without its leading, which
				    is the trap that put every tile 10px tall at PROFILE-FULL.
				    ⚠ MEASURED at 1440 on staging before the pipe landed: this row's
				    three existing pipes and the stake all sit at baseline 439.50, and
				    so does the age. The new pipe is the same `Sep` at the same size,
				    so it joins that line rather than introducing a second one. */}
				<Sep />
				<RelativeTime createdAt={createdAt} />
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
					className="ml-auto shrink-0 text-ink [&_svg]:size-5"
				>
					<Download />
				</Button>
			) : null}
		</div>
	);
}

/**
 * d5's `.vsep` — the pipe between the author row's fields. Byte-carried from the
 * shipped separator at `discovery/HeroPanels.tsx` and `profile/ArgumentList.tsx`
 * so the three surfaces render one separator, not three.
 * `aria-hidden`: it is punctuation, and announcing "vertical line" between every
 * field would make the row unlistenable.
 */
function Sep() {
	return (
		<span aria-hidden="true" className="shrink-0 text-n3">
			|
		</span>
	);
}
