"use client";

import { useState } from "react";

import { DebateColumn } from "./DebateColumn";
import { ImageLightbox, PostPopup } from "./dialogs";
import { MarketHeader } from "./MarketHeader";
import { PostFocusHeader } from "./PostFocusHeader";
import { PostScroller, ReplyScroller } from "./scrollers";
import type {
	DebatePost,
	DebateReply,
	DebateViewModel,
	PresentPost,
	Side,
	ViewerMarketContext,
} from "./types";

/** A focused post's replies for one pole column — placed by their OWN side (D3). */
function repliesForSide(post: DebatePost, side: Side): DebateReply[] {
	return [...post.replies.support, ...post.replies.counter].filter(
		(reply) => reply.side === side,
	);
}

/**
 * The single client boundary for the participant debate view (DEBATE.4 §4). It
 * owns the market↔post toggle (`enterPost`/`exitPost`), the post pop-up, and the
 * image lightbox; everything below renders from the already-masked, serializable
 * view-model passed by the RSC route — there is NO `src/server/**` import here,
 * and a removed entry has no body/author field at the type level, so the client
 * cannot leak withheld content.
 *
 * Market-view: two pole columns (YES/NO), each a post-scroller over that side's
 * posts (Top order). Post-view: the focused post in full + two columns of its
 * replies (post-scrollers swapped for reply-scrollers). C1: read-only — write
 * triggers render disabled, no composer/auth-gate is rendered.
 */
export function DebateView({
	model,
	initialPostId,
}: {
	model: DebateViewModel;
	/**
	 * UI.A2 §3.3 — the viewer-session context (position + balance +
	 * spendableToday), serialized through the RSC boundary. Typed + landed but
	 * RENDER-UNCONSUMED at A2 (deliberate lane verticality — the A3 position
	 * strip is its consumer), hence accepted in the props type without being
	 * destructured.
	 */
	viewer: ViewerMarketContext | null;
	/**
	 * UI.A2 §3.4 — the server-resolved `?post=` deep-link target (already
	 * validated + removed-gated by the page). Seeds the initial focus state —
	 * prop-derived initial render, hydration-safe (server and client agree).
	 */
	initialPostId: string | null;
}) {
	const [selectedPostId, setSelectedPostId] = useState<string | null>(
		initialPostId,
	);
	const [popupPost, setPopupPost] = useState<PresentPost | null>(null);
	const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

	const { market, posts } = model;

	// UI.A2 §3.4 (ratified OQ-5c) — outbound URL sync: mirror focus into
	// `?post=<ordinal>` via history.replaceState on post enter/exit, making
	// deep links user-MINTABLE (copy the address bar in post view).
	// replaceState, never pushState — focus toggling must not pollute history.
	const syncPostParam = (ordinal: number | null) => {
		const url = new URL(window.location.href);
		if (ordinal === null) {
			url.searchParams.delete("post");
		} else {
			url.searchParams.set("post", String(ordinal));
		}
		history.replaceState(null, "", url);
	};
	const enterPost = (id: string) => {
		setSelectedPostId(id);
		const target = posts.find((p) => p.id === id);
		syncPostParam(target ? target.ordinal : null);
	};
	const exitPost = () => {
		setSelectedPostId(null);
		syncPostParam(null);
	};
	const selectedPost = selectedPostId
		? (posts.find((p) => p.id === selectedPostId) ?? null)
		: null;

	const yesPosts = posts.filter((p) => p.sideAtPostTime === "YES");
	const noPosts = posts.filter((p) => p.sideAtPostTime === "NO");

	return (
		<div className="mx-auto flex max-w-5xl flex-col gap-5 px-6 py-8">
			<MarketHeader market={market} />

			{selectedPost ? (
				<div className="flex flex-col gap-4">
					<PostFocusHeader
						post={selectedPost}
						onExit={exitPost}
						onOpenImage={setLightboxUrl}
					/>
					<div className="flex gap-4">
						<DebateColumn side="YES" pricing={market.pricing}>
							<ReplyScroller
								side="YES"
								replies={repliesForSide(selectedPost, "YES")}
							/>
						</DebateColumn>
						<DebateColumn side="NO" pricing={market.pricing}>
							<ReplyScroller
								side="NO"
								replies={repliesForSide(selectedPost, "NO")}
							/>
						</DebateColumn>
					</div>
				</div>
			) : (
				<div className="flex gap-4">
					<DebateColumn side="YES" pricing={market.pricing}>
						<PostScroller
							side="YES"
							posts={yesPosts}
							onEnter={enterPost}
							onOpenPopup={setPopupPost}
							onOpenImage={setLightboxUrl}
						/>
					</DebateColumn>
					<DebateColumn side="NO" pricing={market.pricing}>
						<PostScroller
							side="NO"
							posts={noPosts}
							onEnter={enterPost}
							onOpenPopup={setPopupPost}
							onOpenImage={setLightboxUrl}
						/>
					</DebateColumn>
				</div>
			)}

			<PostPopup post={popupPost} onClose={() => setPopupPost(null)} />
			<ImageLightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />
		</div>
	);
}
