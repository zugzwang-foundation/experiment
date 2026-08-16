"use client";

import { useState } from "react";

import type { BookmarkAffordance } from "@/components/bookmarks/BookmarkToggle";

import { PostCard } from "./PostCard";
import { EmptySideCTA } from "./placeholders";
import { ReplyCard } from "./ReplyCard";
import { ScrollRail } from "./ScrollRail";
import type { DebatePost, DebateReply, PresentPost, Side } from "./types";

/**
 * The market-view post-scroller (§4) — pages a single side's posts (Top order,
 * already filtered) one card at a time. Empty side → the empty-side CTA. D11:
 * all posts are loaded; this pages through them client-side.
 */
export function PostScroller({
	posts,
	side,
	bookmarks,
	onEnter,
	onOpenPopup,
	onOpenImage,
	onReplyToPost,
	heldSide,
	marketOpen,
	suspended,
}: {
	posts: DebatePost[];
	side: Side;
	/** BOOKMARK-ADD-WIRE — pass-through to the paged `PostCard`. */
	bookmarks: BookmarkAffordance;
	onEnter: (id: string) => void;
	onOpenPopup: (post: PresentPost) => void;
	onOpenImage: (url: string) => void;
	/** HTML-FINISH · MARKET DETAIL row 22 — pass-through to the card's pills. */
	onReplyToPost: (id: string, relation: "support" | "counter") => void;
	heldSide: Side | null;
	marketOpen: boolean;
	suspended: boolean;
}) {
	const [index, setIndex] = useState(0);
	if (posts.length === 0) {
		return <EmptySideCTA side={side} />;
	}
	const clamped = Math.min(index, posts.length - 1);
	const post = posts[clamped];
	return (
		// HTML-FINISH · MARKET DETAIL row 18 — d5's `.pscroll` is a VERTICAL rail
		// BESIDE the card (`:887`), replacing the horizontal prev/next strip that
		// sat under it. `items-stretch` is what lets the rail's track fill the
		// card's height rather than needing d5's fixed `92px`.
		<div className="flex items-stretch gap-2">
			<div className="flex min-w-0 flex-1 flex-col gap-2">
				<PostCard
					post={post}
					bookmarks={bookmarks}
					onEnter={onEnter}
					onOpenPopup={onOpenPopup}
					onOpenImage={onOpenImage}
					onReplyToPost={onReplyToPost}
					heldSide={heldSide}
					marketOpen={marketOpen}
					suspended={suspended}
				/>
			</div>
			{posts.length > 1 ? (
				<ScrollRail
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
	bookmarks,
	onOpenImage,
}: {
	replies: DebateReply[];
	side: Side;
	/** BOOKMARK-ADD-WIRE — pass-through to the paged `ReplyCard`. */
	bookmarks: BookmarkAffordance;
	/** HTML-FINISH · MARKET DETAIL row 26 — pass-through to the reply's image. */
	onOpenImage: (url: string) => void;
}) {
	const [index, setIndex] = useState(0);
	if (replies.length === 0) {
		return <EmptySideCTA side={side} />;
	}
	const clamped = Math.min(index, replies.length - 1);
	const reply = replies[clamped];
	return (
		// Row 19 — `.rps` (`:917`) is the same rail at the reply mount point.
		<div className="flex items-stretch gap-2">
			<div className="flex min-w-0 flex-1 flex-col gap-2">
				<ReplyCard
					reply={reply}
					bookmarks={bookmarks}
					onOpenImage={onOpenImage}
				/>
			</div>
			{replies.length > 1 ? (
				<ScrollRail
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
