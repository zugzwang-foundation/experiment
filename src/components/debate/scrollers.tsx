"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";

import { PostCard } from "./PostCard";
import { EmptySideCTA } from "./placeholders";
import { ReplyCard } from "./ReplyCard";
import type { DebatePost, DebateReply, PresentPost, Side } from "./types";

/** Prev/next pager shared by the post- and reply-scrollers (§4 scroller buttons). */
function ScrollerNav({
	index,
	total,
	noun,
	onPrev,
	onNext,
}: {
	index: number;
	total: number;
	noun: string;
	onPrev: () => void;
	onNext: () => void;
}) {
	return (
		<div className="flex items-center justify-between gap-2">
			<Button
				variant="outline"
				size="icon-xs"
				onClick={onPrev}
				disabled={index === 0}
				aria-label={`Previous ${noun}`}
			>
				<ChevronLeft />
			</Button>
			<span
				className="font-mono text-xs text-muted-foreground"
				aria-live="polite"
			>
				{index + 1} / {total}
			</span>
			<Button
				variant="outline"
				size="icon-xs"
				onClick={onNext}
				disabled={index === total - 1}
				aria-label={`Next ${noun}`}
			>
				<ChevronRight />
			</Button>
		</div>
	);
}

/**
 * The market-view post-scroller (§4) — pages a single side's posts (Top order,
 * already filtered) one card at a time. Empty side → the empty-side CTA. D11:
 * all posts are loaded; this pages through them client-side.
 */
export function PostScroller({
	posts,
	side,
	onEnter,
	onOpenPopup,
	onOpenImage,
}: {
	posts: DebatePost[];
	side: Side;
	onEnter: (id: string) => void;
	onOpenPopup: (post: PresentPost) => void;
	onOpenImage: (url: string) => void;
}) {
	const [index, setIndex] = useState(0);
	if (posts.length === 0) {
		return <EmptySideCTA side={side} />;
	}
	const clamped = Math.min(index, posts.length - 1);
	const post = posts[clamped];
	return (
		<div className="flex flex-col gap-2">
			<PostCard
				post={post}
				onEnter={onEnter}
				onOpenPopup={onOpenPopup}
				onOpenImage={onOpenImage}
			/>
			{posts.length > 1 ? (
				<ScrollerNav
					index={clamped}
					total={posts.length}
					noun="post"
					onPrev={() => setIndex((i) => Math.max(0, i - 1))}
					onNext={() => setIndex((i) => Math.min(posts.length - 1, i + 1))}
				/>
			) : null}
		</div>
	);
}

/**
 * The post-view reply-scroller (§4) — pages the focused post's replies for one
 * side (placed by their own frozen side, D3) one card at a time. Empty side →
 * the empty-side CTA.
 */
export function ReplyScroller({
	replies,
	side,
}: {
	replies: DebateReply[];
	side: Side;
}) {
	const [index, setIndex] = useState(0);
	if (replies.length === 0) {
		return <EmptySideCTA side={side} />;
	}
	const clamped = Math.min(index, replies.length - 1);
	const reply = replies[clamped];
	return (
		<div className="flex flex-col gap-2">
			<ReplyCard reply={reply} />
			{replies.length > 1 ? (
				<ScrollerNav
					index={clamped}
					total={replies.length}
					noun="reply"
					onPrev={() => setIndex((i) => Math.max(0, i - 1))}
					onNext={() => setIndex((i) => Math.min(replies.length - 1, i + 1))}
				/>
			) : null}
		</div>
	);
}
