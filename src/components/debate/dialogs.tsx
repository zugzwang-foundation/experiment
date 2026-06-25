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
			<DialogContent className="max-h-[80vh] overflow-y-auto">
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
							<img
								src={post.imageUrl}
								alt="Argument attachment"
								className="w-full rounded-[var(--imgr)] [border:var(--hairline)]"
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
