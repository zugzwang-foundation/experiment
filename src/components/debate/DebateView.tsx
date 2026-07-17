"use client";

import { type ReactNode, useState } from "react";

import { AuthGateSlot } from "./composer/AuthGateSlot";
import { BetComposer } from "./composer/BetComposer";
import { PositionStrip } from "./composer/PositionStrip";
import { SlotHeader } from "./composer/SlotHeader";
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

const opposite = (side: Side): Side => (side === "YES" ? "NO" : "YES");

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
 * replies (post-scrollers swapped for reply-scrollers). UI.A3: the write
 * triggers are LIVE — the Đ BET entry (market view) and the focused post's
 * Support/Counter split-bar triggers (post view) open the composer in the
 * opposite slot (auth-gate variant when signed out); at most one composer is
 * open per view.
 */
export function DebateView({
	model,
	viewer,
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
	// UI.A3 — the market-view Đ BET composer: at most ONE open (side-slot rule:
	// betting side S renders the composer in the OPPOSITE slot; opening the
	// other side closes the first — the d5 slot model, toggle-to-close).
	const [openSide, setOpenSide] = useState<Side | null>(null);
	// UI.A3 slice 3 — the post-view reply composer (v0.10: Support OR Counter
	// opens in the slot OPPOSITE THE POST; toggle-to-close).
	const [openReply, setOpenReply] = useState<"support" | "counter" | null>(
		null,
	);
	// P2 terminal (Track A / banned) reached this session: entry controls off.
	const [suspended, setSuspended] = useState(false);

	const { market, posts } = model;
	const marketOpen = market.status === "Open";
	const heldSide = viewer?.position?.side ?? null;

	const toggleEntry = (side: Side) => {
		setOpenSide((cur) => (cur === side ? null : side));
	};

	/** The body of one market-view pole column: composer/auth-gate when this
	 * column is the OPPOSITE slot of the open bet side; the post scroller
	 * otherwise. */
	const marketColumnBody = (side: Side, scroller: ReactNode) => {
		if (openSide !== null && side === opposite(openSide)) {
			return viewer === null ? (
				<AuthGateSlot side={openSide} onClose={() => setOpenSide(null)} />
			) : (
				<BetComposer
					marketId={market.id}
					slug={market.slug}
					side={openSide}
					kind="post"
					viewer={viewer}
					onClose={() => setOpenSide(null)}
					onSuspended={() => setSuspended(true)}
				/>
			);
		}
		return scroller;
	};

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
		setOpenReply(null);
		const target = posts.find((p) => p.id === id);
		syncPostParam(target ? target.ordinal : null);
	};
	const exitPost = () => {
		setSelectedPostId(null);
		setOpenReply(null);
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
						heldSide={heldSide}
						marketOpen={marketOpen}
						suspended={suspended}
						activeRelation={openReply}
						onToggleRelation={(relation) =>
							setOpenReply((cur) => (cur === relation ? null : relation))
						}
						onExit={exitPost}
						onOpenImage={setLightboxUrl}
					/>
					<div className="flex gap-4">
						{(["YES", "NO"] as const).map((side) => {
							// v0.10: the reply composer — Support OR Counter — opens in
							// the slot OPPOSITE THE POST; the chip carries the TRUE bet
							// side (slot ≠ side, permanently — INV-3 narrative).
							const composerColumn = opposite(selectedPost.sideAtPostTime);
							const resultingSide =
								openReply !== null
									? openReply === "support"
										? selectedPost.sideAtPostTime
										: opposite(selectedPost.sideAtPostTime)
									: null;
							const hostsComposer =
								openReply !== null && side === composerColumn;
							return (
								<DebateColumn
									key={side}
									side={side}
									pricing={market.pricing}
									engaged={resultingSide === side && side !== composerColumn}
									header={
										<PositionStrip
											side={side}
											pricing={market.pricing}
											unitToWin={market.unitToWin}
											viewer={viewer}
										/>
									}
								>
									{hostsComposer && resultingSide !== null ? (
										viewer === null ? (
											<AuthGateSlot
												side={resultingSide}
												onClose={() => setOpenReply(null)}
											/>
										) : (
											<BetComposer
												marketId={market.id}
												slug={market.slug}
												side={resultingSide}
												kind="reply"
												viewer={viewer}
												parentCommentId={selectedPost.id}
												replyContext={{
													relation: openReply,
													authorPseudonym: selectedPost.removed
														? null
														: selectedPost.author.pseudonym,
													postTitle: selectedPost.removed
														? null
														: selectedPost.title,
												}}
												onClose={() => setOpenReply(null)}
												onSuspended={() => setSuspended(true)}
											/>
										)
									) : (
										<ReplyScroller
											side={side}
											replies={repliesForSide(selectedPost, side)}
										/>
									)}
								</DebateColumn>
							);
						})}
					</div>
				</div>
			) : (
				<div className="flex gap-4">
					{(["YES", "NO"] as const).map((side) => (
						<DebateColumn
							key={side}
							side={side}
							pricing={market.pricing}
							engaged={openSide === side}
							header={
								<SlotHeader
									side={side}
									pricing={market.pricing}
									unitToWin={market.unitToWin}
									viewer={viewer}
									marketOpen={marketOpen}
									suspended={suspended}
									composerOpen={openSide === side}
									onToggleEntry={() => toggleEntry(side)}
								/>
							}
						>
							{marketColumnBody(
								side,
								<PostScroller
									side={side}
									posts={side === "YES" ? yesPosts : noPosts}
									onEnter={enterPost}
									onOpenPopup={setPopupPost}
									onOpenImage={setLightboxUrl}
								/>,
							)}
						</DebateColumn>
					))}
				</div>
			)}

			<PostPopup post={popupPost} onClose={() => setPopupPost(null)} />
			<ImageLightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />
		</div>
	);
}
