"use client";

import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";

import { AggregateFooter } from "./AggregateFooter";
import { LaneBadge, PositionMarker, SideBadge } from "./badges";
import { formatDharma } from "./format";
import type { PresentPost } from "./types";

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
			<DialogContent className="max-h-[90vh] max-w-[720px] overflow-y-auto">
				{post ? (
					<>
						<DialogHeader>
							<DialogTitle>{post.title}</DialogTitle>
							{/* Rows 12 · 11 · 10 (PD-3-14 · PD-3-13 · PD-3-12). The pop-up was
							    built as a BODY READER rather than as the card's expanded form, so
							    every non-body element the card carries was simply not ported. All
							    of them are ALREADY on `PresentPost` and the card reads each one
							    unconditionally on the present branch — nothing is fetched here and
							    ⚠ ADR-0034 D-1 DOES NOT FIRE: no field is added.

							    Row 12 · TIER 1 — the frozen `SideBadge` replaces the bare
							    interpolated `{post.sideAtPostTime}` text node. INV-3 is expressed
							    in the UI THROUGH this primitive, so the remedy is to render it,
							    not to restyle a string.
							    ⛔ UNSIZED, deliberately: `side-badge.test.tsx`'s
							    `detail-stays-unwired…` assertion pins `detail` at ZERO for
							    POLISH.3, and a `size="detail"` would redden a second, unplanned
							    assertion in a file this same commit already edits.

							    Row 11 · TIER 1 — the author's stake `a`, SPEC.1 §9 F-DEBATE-1:
							    "each post renders the author's stake at its header". Class F, not
							    V — "no stake, no voice" is the thesis the stake display carries.
							    Written in canon §107's SPACED grammar: this is NEW copy, so it is
							    written in the ruled form rather than adding a fifth unspaced site.

							    Row 10 — the position marker and the lane badge. `marker` is
							    REQUIRED on this variant and `"none"` is a SENTINEL, never a
							    missing field, so `PositionMarker` renders nothing rather than
							    breaking. The footer, its third member, sits below the body where
							    the card also puts it. */}
							<DialogDescription className="flex flex-wrap items-center gap-1.5">
								<SideBadge side={post.sideAtPostTime} />
								<PositionMarker marker={post.marker} />
								<span>{post.author.pseudonym}</span>
								<span aria-hidden="true">·</span>
								<span className="font-mono">
									Đ {formatDharma(post.authorStake)}
								</span>
								<LaneBadge badge={post.badge} />
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
