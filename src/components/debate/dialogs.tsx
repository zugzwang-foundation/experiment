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
import { LaneBadge } from "./badges";
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
}: {
	post: PresentPost | null;
	onClose: () => void;
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
				className="max-h-[90vh] max-w-[720px] overflow-y-auto"
			>
				{post ? (
					<>
						<DialogHeader>
							<DialogTitle>{post.title}</DialogTitle>
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
							<DialogDescription asChild>
								<div className="flex flex-wrap items-center gap-1.5">
									<ArgProfile
										author={post.author}
										side={post.sideAtPostTime}
										marker={post.marker}
										entryPrice={post.entryPrice}
										authorStake={post.authorStake}
									/>
									<LaneBadge badge={post.badge} />
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
								className="max-h-[60vh] w-full rounded-[var(--imgr)] object-contain [border:var(--hairline)]"
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
}: {
	reply: PresentReply | null;
	onClose: () => void;
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
				className="max-h-[90vh] max-w-[720px] overflow-y-auto"
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
									/>
								</div>
							</DialogDescription>
						</DialogHeader>
						{reply.imageUrl ? (
							// biome-ignore lint/performance/noImgElement: short-TTL presigned R2 URL (D9), not a static asset.
							<img
								src={reply.imageUrl}
								alt="Argument attachment"
								className="max-h-[60vh] w-full rounded-[var(--imgr)] object-contain [border:var(--hairline)]"
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
 * The image lightbox (DEBATE.4 §4) — a read-only enlarged view of a comment
 * image. Controlled by the open URL; focus-trap via shadcn Dialog; the title is
 * screen-reader-only (§8 a11y).
 */
export function ImageLightbox({
	url,
	onClose,
}: {
	url: string | null;
	onClose: () => void;
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
			<DialogContent className="max-w-3xl p-2">
				<DialogTitle className="sr-only">Argument attachment</DialogTitle>
				{url ? (
					// biome-ignore lint/performance/noImgElement: short-TTL presigned R2 URL (D9), not a static asset — plain <img> per plan §4.
					<img
						src={url}
						alt="Argument attachment"
						className="max-h-[80vh] w-full object-contain"
					/>
				) : null}
			</DialogContent>
		</Dialog>
	);
}
