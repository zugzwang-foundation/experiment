"use client";

import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";

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
							<DialogDescription>
								{post.sideAtPostTime} · {post.author.pseudonym}
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
							   Here `object-contain` IS load-bearing, because `w-full` pins
							   the width axis; that is the difference from T2's card image,
							   where nothing is pinned and object-fit does not arise.
							   ⚠ MUST FOLLOW C4/row 14: at 720px "whole" means something
							   different than it did at 512px. */
							<img
								src={post.imageUrl}
								alt="Argument attachment"
								className="max-h-[60vh] w-full rounded-[var(--imgr)] object-contain [border:var(--hairline)]"
							/>
						) : null}
						<p className="text-sm whitespace-pre-line">{post.body}</p>
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
