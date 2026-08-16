"use client";

import { type ReactNode, useState } from "react";

import type { BookmarkAffordance } from "@/components/bookmarks/BookmarkToggle";
import { PageContainer } from "@/components/shell/PageContainer";

import { AuthGateSlot } from "./composer/AuthGateSlot";
import { BetComposer } from "./composer/BetComposer";
import { deriveReplySide } from "./composer/gating";
import { PositionStrip } from "./composer/PositionStrip";
import { SlotHeader } from "./composer/SlotHeader";
import { DebateColumn } from "./DebateColumn";
import { DebatePoll } from "./DebatePoll";
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
	ownPseudonym,
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
	/**
	 * UI.A5 W2.10-C — the viewer's own pseudonym (from the session), threaded to
	 * the position-strip / slot-header click-throughs so their `Sell ↗` /
	 * `Your position` readout links to `/u/<own>?market=<slug>` (OQ-5 B). Null
	 * when signed out → the affordance stays non-interactive.
	 */
	ownPseudonym: string | null;
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
	// Security-audit MEDIUM: while a composer request is in flight, every
	// host path that would unmount it (entry toggles, relation flips, post
	// enter/exit) no-ops — a mid-request unmount + re-open would mint a
	// fresh key over a possibly-committing bet.
	const [composerBusy, setComposerBusy] = useState(false);

	const { market, posts, priceChart } = model;
	const marketOpen = market.status === "Open";
	const heldSide = viewer?.position?.side ?? null;
	// BOOKMARK-ADD-WIRE — the two ID-only arrays converted to Sets ONCE here (they
	// cross the RSC boundary as arrays; a Set does not serialize) and prop-drilled
	// to the card renders. `null` ⇔ signed out ⇔ the disabled "sign in to use"
	// icon. These sets gate ICON STATE ONLY — never content visibility: masking is
	// decided server-side in `loadDebateView` and arrives already applied on the
	// removed union variants (ADR-0034).
	const bookmarks: BookmarkAffordance =
		viewer === null
			? null
			: {
					saved: new Set(viewer.bookmarkedCommentIds),
					own: new Set(viewer.ownCommentIds),
				};

	const toggleEntry = (side: Side) => {
		if (composerBusy) {
			return;
		}
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
					onBusyChange={setComposerBusy}
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
		if (composerBusy) {
			return;
		}
		setSelectedPostId(id);
		setOpenReply(null);
		setOpenSide(null);
		const target = posts.find((p) => p.id === id);
		syncPostParam(target ? target.ordinal : null);
	};
	/**
	 * HTML-FINISH · MARKET DETAIL row 22 — a market-view card's Support/Counter
	 * pill ENTERS that post and opens the relation there.
	 *
	 * ⛔ IT DOES NOT OPEN A COMPOSER ON THE CARD, and that is what honours `R1`'s
	 * thesis ground while restoring the mockup's affordance. R1 removed these
	 * controls because "entering post-focus to argue means reading the post
	 * first, and mandatory commentary is meant to make argument deliberate, not
	 * reflexive." Landing the reader ON the argument with the composer open keeps
	 * that true — what R1 forbade was arguing WITHOUT reading.
	 *
	 * ⚠ It sets both pieces of state in one go rather than calling `enterPost`
	 * and then opening: `enterPost` CLEARS `openReply` by design, so composing
	 * the two would race and the composer would never appear.
	 */
	const replyToPost = (id: string, relation: "support" | "counter") => {
		if (composerBusy) {
			return;
		}
		setSelectedPostId(id);
		setOpenSide(null);
		setOpenReply(relation);
		const target = posts.find((p) => p.id === id);
		syncPostParam(target ? target.ordinal : null);
	};
	const exitPost = () => {
		if (composerBusy) {
			return;
		}
		setSelectedPostId(null);
		setOpenReply(null);
		setOpenSide(null);
		syncPostParam(null);
	};
	const selectedPost = selectedPostId
		? (posts.find((p) => p.id === selectedPostId) ?? null)
		: null;

	const yesPosts = posts.filter((p) => p.sideAtPostTime === "YES");
	const noPosts = posts.filter((p) => p.sideAtPostTime === "NO");

	return (
		<PageContainer preset="debate" className="flex flex-col gap-5">
			{/* F-DEBATE-4 — the polled-on-view refresh. Renders nothing; re-invokes
			    this page's own server read on an interval, suspended while the
			    document is hidden or a composer is open, stopped once the market
			    leaves `Open`. Composer-open is derived from the state this host
			    ALREADY holds — `BetComposer` is untouched.
			    Mount site is LOAD-BEARING: it sits OUTSIDE the market↔post
			    ternary below, so entering or leaving post view does not remount
			    the poll. Inside the ternary, that toggle would reset its
			    `stopped` and `wasSuspended` refs — and "stopped permanently"
			    would last only until the reader opened a post. */}
			<DebatePoll
				marketOpen={marketOpen}
				composerOpen={openSide !== null || openReply !== null}
			/>

			{/* HTML-FINISH · MARKET DETAIL row 1 — THE HEADZONE IS INSIDE THE
			    TERNARY. `MarketHeader` used to render ABOVE this switch and
			    `PostFocusHeader` stacked underneath it, which made the header
			    arm-BLIND; the mockup's headzone swaps its whole CONTENTS between
			    arms (`vm` ⇄ `vp`) and only the two-column frame persists, so no
			    `vp` element could ever land in a header column. Each arm now owns
			    its own `HeadZone`.
			    ⛔ `DebatePoll` STAYS ABOVE IT — see its own comment: inside the
			    ternary the post toggle would remount it and reset `stopped` /
			    `wasSuspended`.
			    ⚠ EACH ARM IS A FRAGMENT, NOT A WRAPPER DIV. The headzone band and
			    the arena band must be SIBLING children of the container or the
			    arena's `flex-1 min-h-0` resolves against a wrapper instead of the
			    container and the height chain is broken at that link — invisibly,
			    since a broken chain merely reverts to content height. The post
			    arm's former `flex flex-col gap-4` wrapper is therefore gone and
			    its band gap is the container's `gap-5`. Pinned node by node in
			    `tests/unit/design/debate-height-chain.test.ts`. */}
			{selectedPost ? (
				<>
					{/* HTML-FINISH · MARKET DETAIL row 17 — `market` is threaded so the
					    post arm's rail can render the market card. Row 1 stopped
					    `MarketHeader` rendering in this arm, so without this the post
					    arm carries no market context at all. */}
					<PostFocusHeader
						post={selectedPost}
						market={market}
						bookmarks={bookmarks}
						heldSide={heldSide}
						marketOpen={marketOpen}
						suspended={suspended}
						activeRelation={openReply}
						onToggleRelation={(relation) => {
							if (composerBusy) {
								return;
							}
							setOpenReply((cur) => (cur === relation ? null : relation));
						}}
						onExit={exitPost}
						onOpenImage={setLightboxUrl}
						onOpenPopup={setPopupPost}
					/>
					<div data-testid="arena" className="flex min-h-0 flex-1 gap-4">
						{(["YES", "NO"] as const).map((side) => {
							// v0.10: the reply composer — Support OR Counter — opens in
							// the slot OPPOSITE THE POST; the chip carries the TRUE bet
							// side (slot ≠ side, permanently — INV-3 narrative; the
							// side derives via the unit-pinned deriveReplySide, never
							// from the hosting column).
							const composerColumn = opposite(selectedPost.sideAtPostTime);
							const resultingSide =
								openReply !== null
									? deriveReplySide({
											parentSide: selectedPost.sideAtPostTime,
											relation: openReply,
										})
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
											ownPseudonym={ownPseudonym}
											slug={market.slug}
										/>
									}
								>
									{hostsComposer && resultingSide !== null && openReply ? (
										viewer === null ? (
											<AuthGateSlot
												key={openReply}
												side={resultingSide}
												onClose={() => setOpenReply(null)}
											/>
										) : (
											// key={openReply} (cascade H-2): a relation flip
											// REMOUNTS the composer — side is immutable per
											// instance (INV-3); a live instance can never flip.
											<BetComposer
												key={openReply}
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
												onBusyChange={setComposerBusy}
											/>
										)
									) : (
										<ReplyScroller
											side={side}
											replies={repliesForSide(selectedPost, side)}
											bookmarks={bookmarks}
											onOpenImage={setLightboxUrl}
										/>
									)}
								</DebateColumn>
							);
						})}
					</div>
				</>
			) : (
				<>
					<MarketHeader market={market} priceChart={priceChart} />
					<div data-testid="arena" className="flex min-h-0 flex-1 gap-4">
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
										ownPseudonym={ownPseudonym}
										slug={market.slug}
									/>
								}
							>
								{marketColumnBody(
									side,
									<PostScroller
										side={side}
										posts={side === "YES" ? yesPosts : noPosts}
										bookmarks={bookmarks}
										onEnter={enterPost}
										onOpenPopup={setPopupPost}
										onOpenImage={setLightboxUrl}
										onReplyToPost={replyToPost}
										heldSide={heldSide}
										marketOpen={marketOpen}
										suspended={suspended}
									/>,
								)}
							</DebateColumn>
						))}
					</div>
				</>
			)}

			<PostPopup post={popupPost} onClose={() => setPopupPost(null)} />
			<ImageLightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />
		</PageContainer>
	);
}
