"use client";

import { useEffect, useRef } from "react";

import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";

import { AggregateFooter } from "./AggregateFooter";
import { ArgProfile } from "./ArgProfile";
import type { PresentPost, PresentReply } from "./types";

/**
 * HTML-FINISH · MARKET DETAIL row 35 — a pop-up opens SCROLLED TO THE TOP.
 * d5 does it in `fillPop` (`:1641`): `var sc = document.querySelector('.pmscroll');
 * if(sc){ sc.scrollTop = 0; }`.
 *
 * ⚠ WHY IT IS NEEDED AT ALL: `DialogContent` is `overflow-y-auto` and the SAME
 * node is reused for every post, so the scroll position of the LAST long
 * argument survives into the next one — a reader opens a short reply and lands
 * halfway down it, or below its text entirely. The defect only appears on the
 * second open, which is why no one meets it while building the first.
 *
 * ⚠ Keyed on the OPEN transition, not on mount: shadcn's `Dialog` keeps the
 * content mounted between opens, so a mount-only reset would fire once and never
 * again — the exact shape of the bug.
 */
function useScrollTopOnOpen(open: boolean) {
	const ref = useRef<HTMLDivElement>(null);
	useEffect(() => {
		if (open && ref.current) {
			ref.current.scrollTop = 0;
		}
	}, [open]);
	return ref;
}

/**
 * The post pop-up (DEBATE.4 §4) — a read-only dialog showing a post's FULL body
 * (the "+" affordance on a card; D6 "pop-up = full body") + its image. Only a
 * PRESENT post reaches here — a removed post has no body/author to show, and its
 * card renders no "+" trigger. Focus-trap + Esc via shadcn Dialog (§8 a11y).
 */
export function PostPopup({
	post,
	onClose,
	/**
	 * ⛔ RI-5 / O-m — THE TIER GATE IS A PROPERTY OF DOM POSITION, AND A PORTAL
	 * LEAVES THE DOM POSITION. Everything under `debate/phone/` is hidden above
	 * 640px by one `max-mobile:` token on the subtree's root. Radix renders this
	 * dialog into `document.body`, which is outside that subtree — so a popup
	 * opened from the phone tree is, structurally, no longer in the phone tree,
	 * and nothing about where it was opened from survives into the markup.
	 *
	 * It is inert today only because the openers all sit inside the hidden
	 * subtree, which is an argument about who can reach it rather than about what
	 * it is. `data-tier="phone"` makes the provenance readable in the DOM, which
	 * is what lets a guard assert that every opener under `phone/` passes it —
	 * and what lets anyone debugging a stray dialog know which tree put it there.
	 * Absent on the desktop openers, so the desktop markup is byte-identical.
	 */
	tier,
	marketQuestion,
}: {
	post: PresentPost | null;
	onClose: () => void;
	tier?: "phone" | undefined;
	/**
	 * MOBILE-2l · R-6 — the market's question, for the PHONE header line only.
	 *
	 * ⛔ OPTIONAL AND TIER-GATED, so the desktop pop-up is byte-identical: the
	 * desktop passes nothing and takes the `post.title` branch it has always
	 * taken. `markets.title` is market metadata with no masking obligation — SC-1
	 * governs `comments.body` and its derivations, and this is neither.
	 */
	marketQuestion?: string;
}) {
	const scrollRef = useScrollTopOnOpen(post !== null);
	return (
		<Dialog
			open={post !== null}
			onOpenChange={(open) => {
				if (!open) {
					onClose();
				}
			}}
		>
			{/* Row 14 (PD-0-03, R5's geometry half) — CD-A ratified 720px / 90vh.
			    The width override lands on the INSTANCE: `ui/dialog.tsx
			    (DialogContent)` ships `max-w-lg` (~512px) in its base string and
			    merges via `cn`, so `max-w-[720px]` here wins by tailwind-merge.
			    ⛔ `ui/dialog.tsx` is NOT on §8's allow-list and is NOT edited — the
			    primitive keeps its default for every other dialog in the app. */}
			<DialogContent
				ref={scrollRef}
				data-tier={tier}
				className="max-h-[90vh] max-w-[720px] overflow-y-auto max-mobile:max-h-[88dvh] max-mobile:w-[calc(100vw-24px)] max-mobile:max-w-[calc(100vw-24px)] max-mobile:p-4"
			>
				{post ? (
					<>
						<DialogHeader
							/* ⛔⛔ MOBILE-2l · R-6 — THE CONSTRAINT BELONGS ON THIS BOX, AND
							   MEASURING THE CHAIN IS WHAT FOUND IT. `DialogContent` is a GRID
							   (336px wide, a 304px content box) and this header is a grid ITEM,
							   so its automatic minimum is `min-content` — which, once the title
							   below carries `white-space: nowrap`, is the WHOLE question. The
							   header therefore grew to 367px, overflowed the dialog, and took
							   the title with it under the `×`.
							   ⚠ Putting `min-w-0` on the TITLE alone did nothing and adding its
							   end padding made it 28px WIDER, because the title was never the
							   box that refused to shrink. Measured up the chain: title 367.16,
							   header 367.16, content 336 — the first ancestor whose width was
							   its own content is the one to fix.
							   ⚠ PHONE-ONLY, so the desktop header — whose title WRAPS and so
							   never needs a width it does not have — is untouched. */
							className="max-mobile:min-w-0"
						>
							{/* ⛔⛔ MOBILE-2l · R-6 — ON A PHONE THIS LINE IS THE MARKET
							    QUESTION, NOT THE POST'S TITLE, AND THE REASON IS THAT THE
							    TITLE WAS ALREADY THERE TWICE. The sheet opened by a phone
							    card's `Know more` printed the post's title beside its `×` and
							    then printed the same title again in the card beneath it — one
							    line of the small screen's height spent restating the line
							    below it. The market question is the one piece of context the
							    sheet does NOT otherwise carry: the reader arrived from a feed
							    that is already scoped to a market, and inside a full-screen
							    sheet there is nothing left on screen that names it.
							    ⚠ THE REGISTER IS BORROWED, NOT INVENTED — `PhoneTitleStrip`
							    (`:110`) already renders `market.title` as
							    `text-[13px] leading-[17px] font-normal text-n5` in exactly
							    this relationship (a market question beneath a post title), so
							    the sheet header now matches the strip the reader tapped from.
							    `truncate` holds it to one line.
							    ⚠ IT IS STILL THE DIALOG'S ACCESSIBLE NAME. That is a real
							    change on the phone branch and is deliberate: the name goes
							    from "this argument's headline" to "the market being argued",
							    and the headline is still announced immediately below by the
							    card. Recorded so it is a decision rather than a side effect.
							    ⛔ The desktop branch is untouched, and `marketQuestion` is
							    optional precisely so it cannot reach one by omission. */}
							{tier === "phone" && marketQuestion !== undefined ? (
								<DialogTitle
									data-testid="post-popup-market-question"
									/* ⛔⛔ `min-w-0` AND THE END PADDING ARE BOTH LOAD-BEARING, AND
									   THE PAINT IS WHAT CAUGHT IT. `truncate` brings
									   `white-space: nowrap`, which makes this element's INTRINSIC
									   width its whole text; `DialogHeader` is a flex container and
									   a flex item's automatic minimum is that intrinsic width, so
									   the title did not truncate at all — it overflowed the
									   dialog's content box and ran UNDER the `×`.
									   ⚠ MEASURED, and the numbers alone said it was fine: the
									   element reported `scrollWidth === clientWidth` (339 === 339),
									   i.e. "nothing is clipped", which is exactly what an element
									   that grew to fit its text reports. It was the SCREENSHOT
									   that showed the question colliding with the close control.
									   The paint is the arbiter (AGENTS.md §9).
									   ⇒ `min-w-0` lets it shrink so `truncate` can bite, and
									   `pe-7` (28px) keeps the ellipsis clear of the 16px `×` that
									   sits 16px from the dialog's right edge.
									   ⚠ The ground render did not have this problem and could not:
									   its title WRAPPED, so it never needed a width it did not
									   have. One line is what introduces the constraint. */
									className="min-w-0 truncate pe-7 text-[13px] leading-[17px] font-normal text-n5"
								>
									{marketQuestion}
								</DialogTitle>
							) : (
								<DialogTitle>{post.title}</DialogTitle>
							)}
							{/* HTML-FINISH · MARKET DETAIL row 33 — the pop-up head takes the
							    mockup's CLUSTER. d5's `fillPop` (`:1628-1637`) writes
							    `pm-author` · `pm-chip` (SIDE @ entry%) · `pm-stake` ·
							    `pm-reps` — the same author row the card and the focused post
							    render, so it is `ArgProfile` here too rather than a fourth
							    hand-rolled copy.
							    ⚠ SUPERSEDES the PD-3-14 / PD-3-13 / PD-3-12 rows' hand-built
							    strip (bare side badge · marker · pseudonym · `·` · stake ·
							    lane badge). Every element they added survives — they arrive
							    through the shared row now, plus the avatar and the entry price
							    the strip never had. The lane badge is NOT part of that row, so
							    it stays beside it.
							    UNWIRE-1 — `bookmarks`/`showActions` dropped: `ArgProfile` no
							    longer renders any action cluster (SUB-3), so this call site's
							    own former no-cluster instruction has nothing left to say. */}
							{/* ⚠ UI-OVERNIGHT entry 1b — the lane badge is inside the author
							    row now, beside the age, so it is passed rather than placed.
							    ⛔ THE WRAPPING `div` STAYS, unlike at the two card mounts.
							    `DialogDescription asChild` merges its `id` onto its child,
							    and the dialog's `aria-describedby` points at that id — merged
							    onto a COMPONENT instead of a DOM node it would be dropped,
							    and the description would describe nothing. */}
							<DialogDescription asChild>
								<div className="flex flex-wrap items-center gap-1.5">
									<ArgProfile
										author={post.author}
										side={post.sideAtPostTime}
										marker={post.marker}
										entryPrice={post.entryPrice}
										authorStake={post.authorStake}
										originalStake={post.authorStakeOriginal}
										sold={post.authorSold}
										createdAt={post.createdAt}
										badge={post.badge}
										download={{ ordinal: post.ordinal }}
									/>
								</div>
							</DialogDescription>
						</DialogHeader>
						{post.imageUrl ? (
							// biome-ignore lint/performance/noImgElement: short-TTL presigned R2 URL (D9), not a static asset — plain <img> per plan §4.
							/* Row 9 (PD-3-06) — R14 check 2's OPEN half. CD-A's phrase
							   "renders whole in the pop-up" NAMES NO AXIS, so a two-axis
							   obligation was recorded as one claim and the height half was
							   never checkable: `w-full` discharges WIDTH and is silent on
							   HEIGHT, so a tall image scrolled inside the dialog instead of
							   rendering whole.
							   The remedy mirrors the SHIPPED SIBLING IN THIS FILE — the
							   register names `ImageLightbox` (`:88`, `max-h-[80vh] w-full
							   object-contain`) as the contrast that "does constrain it".
							   ⚠ `object-contain` here is DEFENSIVE, not load-bearing — and the
							   first version of this comment claimed otherwise. `w-full` plus a
							   binding `max-height` does NOT squash a replaced element: CSS 2.1
							   §10.4 recomputes the used width from the intrinsic ratio. It is
							   kept because it mirrors `ImageLightbox` exactly and costs nothing.
							   (Corrected post-review — `O-3`: a right call with a wrong stated
							   cause is still a defect.)
							   ⚠ MUST FOLLOW C4/row 14: at 720px "whole" means something
							   different than it did at 512px. */
							<img
								src={post.imageUrl}
								alt="Argument attachment"
								className="max-h-[60vh] w-full rounded-[var(--imgr)] object-contain [border:var(--hairline)] max-mobile:max-h-[52dvh]"
							/>
						) : null}
						<p className="text-sm whitespace-pre-line">{post.body}</p>
						{/* Row 10's third omission — the aggregate footer, below the body
							    exactly where the card puts it. Takes the post's frozen side so
							    the split bar is poled correctly here too. */}
						<AggregateFooter
							aggregate={post.aggregate}
							postSide={post.sideAtPostTime}
						/>
					</>
				) : null}
			</DialogContent>
		</Dialog>
	);
}

/**
 * HTML-FINISH · MARKET DETAIL row 27 — the REPLY pop-up: a read-only dialog
 * showing a reply's full argument, opened by the `+` on a reply card.
 *
 * ⛔⛔ A SEPARATE COMPONENT, NOT A WIDENED `PostPopup` UNION — and that is what
 * makes plan **H3-e** not fire. H3-e halts row 27 if the reply pop-up "requires
 * widening `PostPopup`'s union in a way that would let a REMOVED reply reach
 * it." Widening `PresentPost | null` to accept replies would have meant either a
 * union that admits `DebateReply` (removed variant included) or a structural
 * type loose enough to accept one. Taking `PresentReply | null` instead makes a
 * removed reply UNPASSABLE at the type level — the leak is a compile error, and
 * `PresentReply` is `Extract<DebateReply, { removed: false }>`, so it tracks the
 * masking union automatically rather than restating it.
 * ⚠ SC-1: the `+` trigger lives on `ReplyCard`'s non-removed branch ONLY, which
 * `ReplyCard` records is a deliberate branch placement.
 *
 * ⚠ IT IS NOT A COPY OF `PostPopup`. A reply has no title, no lane badge and no
 * reply aggregate of its own (`REPLY_DEPTH_MAX = 1`), so those are absent
 * because they do not exist — not because they were forgotten.
 */
export function ReplyPopup({
	reply,
	onClose,
	/**
	 * ⛔ RI-5 / O-m — THE TIER GATE IS A PROPERTY OF DOM POSITION, AND A PORTAL
	 * LEAVES THE DOM POSITION. Everything under `debate/phone/` is hidden above
	 * 640px by one `max-mobile:` token on the subtree's root. Radix renders this
	 * dialog into `document.body`, which is outside that subtree — so a popup
	 * opened from the phone tree is, structurally, no longer in the phone tree,
	 * and nothing about where it was opened from survives into the markup.
	 *
	 * It is inert today only because the openers all sit inside the hidden
	 * subtree, which is an argument about who can reach it rather than about what
	 * it is. `data-tier="phone"` makes the provenance readable in the DOM, which
	 * is what lets a guard assert that every opener under `phone/` passes it —
	 * and what lets anyone debugging a stray dialog know which tree put it there.
	 * Absent on the desktop openers, so the desktop markup is byte-identical.
	 */
	tier,
}: {
	reply: PresentReply | null;
	onClose: () => void;
	tier?: "phone" | undefined;
}) {
	const scrollRef = useScrollTopOnOpen(reply !== null);
	return (
		<Dialog
			open={reply !== null}
			onOpenChange={(open) => {
				if (!open) {
					onClose();
				}
			}}
		>
			<DialogContent
				ref={scrollRef}
				data-tier={tier}
				className="max-h-[90vh] max-w-[720px] overflow-y-auto max-mobile:max-h-[88dvh] max-mobile:w-[calc(100vw-24px)] max-mobile:max-w-[calc(100vw-24px)] max-mobile:p-4"
			>
				{reply ? (
					<>
						<DialogHeader>
							{/* A reply has no title column, so its ACCESSIBLE name is the
							    author + side rather than an invented heading. ⛔ No copy is
							    authored for it. */}
							<DialogTitle className="sr-only">
								{reply.author.pseudonym} — {reply.side}
							</DialogTitle>
							{/* Row 33 — the same cluster as the post pop-up, for the same
							    reason. A reply has no lane badge (that is a post-ranking
							    artifact), so it renders the row alone. */}
							<DialogDescription asChild>
								<div>
									<ArgProfile
										author={reply.author}
										side={reply.side}
										marker={reply.marker}
										entryPrice={reply.entryPrice}
										authorStake={reply.stake}
										originalStake={reply.stakeOriginal}
										sold={reply.sold}
										createdAt={reply.createdAt}
									/>
								</div>
							</DialogDescription>
						</DialogHeader>
						{reply.imageUrl ? (
							// biome-ignore lint/performance/noImgElement: short-TTL presigned R2 URL (D9), not a static asset.
							<img
								src={reply.imageUrl}
								alt="Argument attachment"
								className="max-h-[60vh] w-full rounded-[var(--imgr)] object-contain [border:var(--hairline)] max-mobile:max-h-[52dvh]"
							/>
						) : null}
						<p className="text-sm whitespace-pre-line">{reply.body}</p>
					</>
				) : null}
			</DialogContent>
		</Dialog>
	);
}

/**
 * ⛔⛔ DORMANT BY FOUNDER RULING (change set 4 §B) — NOTHING OPENS THIS TODAY,
 * AND IT IS DELIBERATELY KEPT. The `Know more` trigger was removed from the
 * resolution zone because that treatment is being redesigned; this component,
 * the lifted `criterionOpen` state in `DebateView` and its term in the `frozen`
 * predicate are held intact for that redesign.
 *
 * ⚠⚠ TWO LINKS OF THAT CHAIN WERE SEVERED AT THE main→staging MERGE, and this
 * sentence used to claim all five were "ALL held intact". They are not, and a
 * chain list that overstates itself is worse than none — it is the one thing
 * standing between this component and a correct-looking deletion, so it has to
 * be true. **The `criterion` prop on `MarketHeader` no longer exists** (the
 * merge took RESO-1/RESO-3's header, which has none), and **the call site in
 * `ResolutionCriterion` is unreachable** — that component now has zero
 * importers anywhere in `src/` or `tests/`.
 * ⇒ **Whether the criterion should have an on-page presence at all is an open
 * product question, not a settled one** (RECONCILE-1 OWED-3): on `26dc484` the
 * body rendered in the DOM behind a one-line clamp and staging's own guard
 * asserted it; `main`'s replacement asserts the opposite. Re-attaching a trigger
 * is no longer one line, and the honest estimate is a prop plus a mount.
 *
 * ⚠ It still has no reachable caller, so every signal a reader has — no trigger,
 * a permanently-`null` `description`, coverage that never enters — says "dead
 * code, delete it". Deleting it re-opens the §D freeze defect, where the dialog
 * opened while the carousel kept advancing behind it.
 *
 * UI-QUICK change set 2 item 1 (ruling R3 = c) — the RESOLUTION CRITERION
 * pop-up, opened by `Know more` under the one-line clamp.
 *
 * ⛔⛔ A THIRD SIBLING, NOT A REUSED `PostPopup` — and the file already ruled
 * this shape. `PostPopup` takes `PresentPost | null` and renders a title, an
 * `ArgProfile` author row, a lane badge, an attachment and an `AggregateFooter`.
 * A market's resolution criterion has NONE of those: no author, no side, no
 * stake, no aggregate. Reusing it would mean either widening its union to admit
 * a non-post — the exact move `ReplyPopup`'s docblock above rejects for replies
 * (plan H3-e) — or synthesising a fake `PresentPost`, which would render an
 * author row for a market and put invented attribution on the terms of a bet.
 * ⇒ The PRIMITIVE is shared (`@/components/ui/dialog`), the geometry is shared
 * (`max-h-[90vh] max-w-[720px]`, CD-A row 14), and `useScrollTopOnOpen` is
 * shared because this component lives in the same file rather than exporting it.
 * Nothing is duplicated but the four lines every `Dialog` call site has.
 *
 * ⚠ FOCUS TRAP AND SCROLL LOCK ARE THE PRIMITIVE'S. Radix `Dialog` traps focus,
 * restores it to the trigger on close, marks the rest of the page inert and locks
 * body scroll. None of that is hand-rolled here, which is the whole reason the
 * expander became a dialog rather than staying in place.
 *
 * ⚠ `whitespace-pre-wrap`, WHERE THE TWO SIBLINGS ABOVE USE `pre-line`. The
 * difference is leading whitespace: `pre-line` collapses runs of spaces and
 * `pre-wrap` keeps them. A resolution criterion is where an operator writes
 * indented conditions and sub-clauses, so the indentation is part of the terms.
 *
 * ⛔ NO COPY IS AUTHORED. The dialog's heading is `Resolution` — the overline
 * string already rendered under the clamp on this very surface (`d5:975`), not a
 * new label invented for the pop-up.
 */
export function ResolutionPopup({
	description,
	onClose,
}: {
	/** `null` ⇔ closed. Mirrors the two siblings' controlled-by-content shape. */
	description: string | null;
	onClose: () => void;
}) {
	const scrollRef = useScrollTopOnOpen(description !== null);
	return (
		<Dialog
			open={description !== null}
			onOpenChange={(open) => {
				if (!open) {
					onClose();
				}
			}}
		>
			{/* ⚠ NO `data-tier` HERE, and that is the point of the attribute. The
			    resolution popup has no opener under `phone/` — the phone tier never
			    renders it — so stamping a provenance it does not have would make the
			    marker mean "a dialog" rather than "a dialog the phone tree opened",
			    which is the one thing it is for. The phone-width tokens above stay:
			    they cost nothing, are inert ≥640, and are right if it ever does. */}
			<DialogContent
				ref={scrollRef}
				className="max-h-[90vh] max-w-[720px] overflow-y-auto max-mobile:max-h-[88dvh] max-mobile:w-[calc(100vw-24px)] max-mobile:max-w-[calc(100vw-24px)] max-mobile:p-4"
			>
				{description ? (
					<>
						<DialogHeader>
							<DialogTitle>Resolution</DialogTitle>
							{/* ⚠ The criterion is the dialog's BODY, not its description, so
							    the slot that would normally hold a summary is closed out
							    rather than filled with a duplicate of the text below it. */}
							<DialogDescription className="sr-only">
								The full resolution criterion for this market.
							</DialogDescription>
						</DialogHeader>
						<p className="text-sm whitespace-pre-wrap">{description}</p>
					</>
				) : null}
			</DialogContent>
		</Dialog>
	);
}

/**
 * The image lightbox (DEBATE.4 §4) — a read-only enlarged view of a comment
 * image. Controlled by the open URL; focus-trap via shadcn Dialog; the title is
 * screen-reader-only (§8 a11y).
 */
export function ImageLightbox({
	url,
	onClose,
	/**
	 * ⛔ RI-5 / O-m — THE TIER GATE IS A PROPERTY OF DOM POSITION, AND A PORTAL
	 * LEAVES THE DOM POSITION. Everything under `debate/phone/` is hidden above
	 * 640px by one `max-mobile:` token on the subtree's root. Radix renders this
	 * dialog into `document.body`, which is outside that subtree — so a popup
	 * opened from the phone tree is, structurally, no longer in the phone tree,
	 * and nothing about where it was opened from survives into the markup.
	 *
	 * It is inert today only because the openers all sit inside the hidden
	 * subtree, which is an argument about who can reach it rather than about what
	 * it is. `data-tier="phone"` makes the provenance readable in the DOM, which
	 * is what lets a guard assert that every opener under `phone/` passes it —
	 * and what lets anyone debugging a stray dialog know which tree put it there.
	 * Absent on the desktop openers, so the desktop markup is byte-identical.
	 */
	tier,
}: {
	url: string | null;
	onClose: () => void;
	tier?: "phone" | undefined;
}) {
	return (
		<Dialog
			open={url !== null}
			onOpenChange={(open) => {
				if (!open) {
					onClose();
				}
			}}
		>
			<DialogContent
				data-tier={tier}
				className="max-w-3xl p-2 max-mobile:w-[calc(100vw-16px)] max-mobile:max-w-[calc(100vw-16px)] max-mobile:p-1.5"
			>
				<DialogTitle className="sr-only">Argument attachment</DialogTitle>
				{url ? (
					// biome-ignore lint/performance/noImgElement: short-TTL presigned R2 URL (D9), not a static asset — plain <img> per plan §4.
					<img
						src={url}
						alt="Argument attachment"
						className="max-h-[80vh] w-full object-contain max-mobile:max-h-[78dvh]"
					/>
				) : null}
			</DialogContent>
		</Dialog>
	);
}
