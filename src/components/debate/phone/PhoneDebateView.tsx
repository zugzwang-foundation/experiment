"use client";

import { useRouter } from "next/navigation";
import { type ReactNode, useCallback, useState } from "react";

import { AuthGateSlot } from "../composer/AuthGateSlot";
import { BetComposer } from "../composer/BetComposer";
import { AUTH_GATE_COPY, COMPOSER_COPY } from "../composer/copy";
import { deriveReplySide } from "../composer/gating";
import { ImageLightbox, PostPopup, ReplyPopup } from "../dialogs";
import { formatPricePercent } from "../format";
import { PostCard } from "../PostCard";
import { EmptySideCTA } from "../placeholders";
import { ReplyCard } from "../ReplyCard";
import type {
	DebatePost,
	DebateViewModel,
	PresentPost,
	PresentReply,
	Side,
	ViewerMarketContext,
} from "../types";
import { type PhoneBarAction, PhoneBottomBar } from "./PhoneBottomBar";
import { PhoneFeedTrack } from "./PhoneFeedTrack";
import { PhoneSheet } from "./PhoneSheet";
import { PhoneSideTabs } from "./PhoneSideTabs";
import { PhoneTitleStrip } from "./PhoneTitleStrip";

/**
 * ⛔⛔ THE PHONE PRESENTATION OF `/m/[slug]` — A SECOND TREE OVER THE SAME DATA,
 * NOT A REFLOW OF THE FIRST (ADR-0050 D-1).
 *
 * Every phone change in this repository before this one followed ADR-0045:
 * desktop stays the unprefixed default and a phone rule is an additive
 * `max-mobile:` token appended to it. That convention is untouched and still
 * governs every existing component — but it has a floor, and the market page is
 * where the floor was hit. A two-column arena whose composer opens in the
 * OPPOSITE column has no phone shape to reflow INTO: there is no second column
 * to be opposite of. So below 640px the desktop tree hides and this one renders.
 *
 * ⛔ IT OWNS NO DATA AND NO WRITES. It takes exactly the four props
 * `DebateView` takes — plus `details`, which is SERVER-RENDERED content handed
 * down as a `ReactNode` (the RSC pattern: this shell is the only client part of
 * the details sheet). Every bet and every reply goes through the SAME
 * `BetComposer` the desktop mounts, and every signed-out prompt through the same
 * `AuthGateSlot`; the sheet replaces the opposite slot and replaces nothing
 * else. `tests/unit/design/phone-market-detail.test.ts` pins that as a source
 * fact — no `fetch(`, no `/api/bets/`, no `requests.ts` import anywhere under
 * `phone/` — because "reuse the composer" is a promise a later edit can break
 * silently, and the guard is what makes it structural (O-1).
 *
 * ⚠ THE TWO ROOTS HIDE TOGETHER, NEVER ONE ALONE. `DebateView`'s root carries
 * one appended `max-mobile:hidden`; this root is base-`hidden` with a
 * `max-mobile:` display token. Either edit alone produces a broken page — two
 * trees stacked, or none at all — and neither is visible at the width the author
 * is looking at, which is exactly why guard 1 asserts BOTH sides of the pair.
 *
 * ⚠ CLASSES INSIDE THIS SUBTREE ARE UNPREFIXED, DELIBERATELY. The `max-mobile:`
 * convention exists to keep a phone rule from reaching the desktop render; here
 * the whole subtree is `display:none` above 640px, so the tier gate is declared
 * ONCE on this root and nothing below it can leak upward. What guard 2 forbids
 * under `phone/` is the opposite direction — a `sm:`/`md:`/`lg:`/`xl:` rule,
 * i.e. a SECOND breakpoint system inside a tier that already has one.
 */
export function PhoneDebateView({
	model,
	viewer,
	initialPostId,
	ownPseudonym,
	details,
}: {
	model: DebateViewModel;
	viewer: ViewerMarketContext | null;
	/**
	 * The server-resolved `?post=` target. ⛔ THE ARM IS A FUNCTION OF THIS PROP
	 * AND NOT OF LOCAL STATE, which is the one structural difference from
	 * `DebateView` worth stating. The desktop seeds `useState(initialPostId)` and
	 * then owns the market↔post toggle itself, because entering a post there is a
	 * re-layout of a surface that stays on screen. Here it is a different screen,
	 * reached by a real navigation — so the server is the single source of which
	 * arm renders, and there is no client copy of that answer to fall out of sync
	 * with the address bar.
	 */
	initialPostId: string | null;
	ownPseudonym: string | null;
	/**
	 * RF-7 — the details sheet's body, rendered on the SERVER and passed down. It
	 * is not rendered until the sheet has been opened once, so a reader who never
	 * opens it never mounts the price chart inside it.
	 */
	details: ReactNode;
}) {
	const router = useRouter();
	const { market, posts } = model;
	const marketOpen = market.status === "Open";
	const heldSide = viewer?.position?.side ?? null;

	/**
	 * ⚠ THE FOCUSED POST IS RESOLVED AGAINST THE MODEL, NOT TRUSTED FROM THE
	 * PROP. `page.tsx` already checked that the target exists and is not removed,
	 * but a lookup that returns `undefined` must fall back to the feed rather
	 * than render a thread with no subject — the zero-branch law the `?post=`
	 * contract holds everywhere else.
	 */
	const focused = posts.find((post) => post.id === initialPostId) ?? null;

	const [activeKey, setActiveKey] = useState<string>("YES");
	const [threadKey, setThreadKey] = useState<string>("support");
	const [sheet, setSheet] = useState<PhoneSheetState>(null);
	/** P2 terminal reached this session — mirrors `DebateView.tsx:155`. */
	const [suspended, setSuspended] = useState(false);
	/** Mirrors `DebateView.tsx:160`; see `PhoneSheet` for what it shuts. */
	const [composerBusy, setComposerBusy] = useState(false);
	const [popupPost, setPopupPost] = useState<PresentPost | null>(null);
	const [popupReply, setPopupReply] = useState<PresentReply | null>(null);
	const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
	const [detailsMounted, setDetailsMounted] = useState(false);

	/**
	 * ⛔ MIRRORS `DebateView`'s `onPosted` (`:251-258`) IN THE HALF THAT IS
	 * OBSERVABLE, and deliberately not in the half that is not. The desktop also
	 * stores `{commentId, fromModel}` so its scrollers can jump to the new card
	 * once the refreshed payload lands; this tree registers no scroller, so
	 * carrying that state would be a note-to-self nothing ever reads. The refresh
	 * IS mirrored, and it REPLACES the desktop's rather than adding to it — at
	 * any one width exactly one of the two trees is interactive, so the
	 * two-refresh budget `posted-refresh-budget.test.tsx` pins is unchanged.
	 */
	const onPosted = useCallback(() => {
		setSheet(null);
		router.refresh();
	}, [router]);

	const closeSheet = useCallback(() => {
		if (!composerBusy) {
			setSheet(null);
		}
	}, [composerBusy]);

	const openReply = useCallback(
		(parent: DebatePost, relation: "support" | "counter") => {
			setSheet({
				kind: "reply",
				side: deriveReplySide({
					parentSide: parent.sideAtPostTime,
					relation,
				}),
				relation,
				parentCommentId: parent.id,
				authorPseudonym: parent.removed ? null : parent.author.pseudonym,
			});
		},
		[],
	);

	/**
	 * ⚠ A REAL NAVIGATION, NOT A STATE TOGGLE. `?post=<ordinal>` is the URL
	 * contract the desktop already mints and the server already resolves, so
	 * pushing it hands the arm decision back to `page.tsx` — the only place that
	 * can also re-apply the removed gate. `ordinal` and never `id`: the address
	 * bar carries no raw UUID (ADR-0016).
	 */
	const enterPost = useCallback(
		(postId: string) => {
			const target = posts.find((post) => post.id === postId);
			if (target === undefined) {
				return;
			}
			router.push(`/m/${market.slug}?post=${target.ordinal}`);
		},
		[posts, router, market.slug],
	);

	const openDetails = useCallback(() => {
		setDetailsMounted(true);
		setSheet({ kind: "details" });
	}, []);

	const pricing = market.pricing;
	const feedTabs = (["YES", "NO"] as const).map((side) => ({
		key: side,
		label: side,
		trailing: pricing === null ? "—" : formatPricePercent(pricing, side),
		// The pole is resolved HERE, where the side is known — see PhoneSideTabs.
		activeClass: side === "YES" ? "bg-yes text-no" : "bg-no text-yes",
	}));

	/**
	 * ⚠ THE EMPTY ARM IS A LIVE COMPONENT, NOT AN INVENTED ONE. `EmptySideCTA`
	 * is design-language §3.1's `Be the first to argue YES/NO`, and its own
	 * docblock names both of the cases used here: "a side with no posts
	 * (market-view) or no replies (post-view)". Measured on the preview first —
	 * a thread whose two relations are both empty rendered a whole screen of
	 * nothing, which says less than the desktop's own answer to the same state.
	 */
	const feedPane = (side: Side): ReactNode => {
		const sidePosts = posts.filter((post) => post.sideAtPostTime === side);
		return (
			<div className="flex flex-col gap-2.5 px-3 pt-2.5 pb-[140px]">
				{sidePosts.length === 0 ? <EmptySideCTA side={side} /> : null}
				{sidePosts.map((post) => (
					<PostCard
						key={post.id}
						post={post}
						onEnter={enterPost}
						onOpenPopup={setPopupPost}
						onOpenImage={setLightboxUrl}
						onReplyToPost={(id, relation) => {
							const parent = posts.find((p) => p.id === id);
							if (parent !== undefined) {
								openReply(parent, relation);
							}
						}}
						heldSide={heldSide}
						marketOpen={marketOpen}
						suspended={suspended}
					/>
				))}
			</div>
		);
	};

	/**
	 * ⛔⛔ THE THREAD'S PARTITION IS THE MODEL'S OWN, READ OFF
	 * `post.replies.{support,counter}` — there is no side arithmetic here and
	 * there must not be. `load-debate-view.ts` already groups a post's replies by
	 * relation, which is the same fact the `.md` export states independently
	 * (`**Relation:** Support (same side as the post)`). Re-deriving it from
	 * `reply.side === post.sideAtPostTime` would be a second implementation of a
	 * rule the server already applied, free to disagree with it on a removed
	 * parent — whose union variant carries no side to compare against.
	 */
	const threadTabs =
		focused === null
			? []
			: [
					{
						key: "support",
						label: "Support",
						trailing: String(focused.replies.support.length),
						// A RELATION HAS NO POLE (design-canon §3.2) — the neutral
						// emphasis step, never a side colour.
						activeClass: "bg-ink text-ground",
					},
					{
						key: "counter",
						label: "Counter",
						trailing: String(focused.replies.counter.length),
						activeClass: "bg-ink text-ground",
					},
				];

	const threadPane = (relation: "support" | "counter"): ReactNode => {
		const replies = focused === null ? [] : focused.replies[relation];
		return (
			<div className="flex flex-col gap-2.5 px-3 pt-2.5 pb-[140px]">
				{replies.length === 0 && focused !== null ? (
					// ⚠ THE SIDE, DERIVED — never the relation. `EmptySideCTA` names a
					// POLE, and a Support reply's pole is the parent's while a Counter
					// reply's is the opposite. `deriveReplySide` is the one place that
					// rule lives; asking it here is what keeps `Be the first to argue
					// NO` from appearing under a tab labelled Support on a YES post.
					<EmptySideCTA
						side={deriveReplySide({
							parentSide: focused.sideAtPostTime,
							relation,
						})}
					/>
				) : null}
				{replies.map((reply) => (
					<ReplyCard
						key={reply.id}
						reply={reply}
						onOpenImage={setLightboxUrl}
						onOpenPopup={setPopupReply}
					/>
				))}
			</div>
		);
	};

	const barActions: PhoneBarAction[] =
		focused === null
			? [
					{
						key: "entry",
						label: `Bet ${activeKey}`,
						side: activeKey as Side,
						filled: true,
						glyph: true,
					},
				]
			: [
					{
						key: "support",
						label: "Support",
						side: deriveReplySide({
							parentSide: focused.sideAtPostTime,
							relation: "support",
						}),
						filled: false,
						glyph: false,
					},
					{
						key: "counter",
						label: "Counter",
						side: deriveReplySide({
							parentSide: focused.sideAtPostTime,
							relation: "counter",
						}),
						filled: true,
						glyph: false,
					},
				];

	const onBarEntry = (key: string) => {
		if (focused === null) {
			setSheet({ kind: "post", side: activeKey as Side });
			return;
		}
		openReply(focused, key === "counter" ? "counter" : "support");
	};

	return (
		<div
			data-testid="phone-debate-view"
			data-arm={focused === null ? "feed" : "thread"}
			className="hidden w-full min-w-0 max-mobile:flex max-mobile:min-h-0 max-mobile:flex-1 max-mobile:flex-col"
		>
			{/* ⚠ THE STRIP AND THE TABS STICK AS ONE BLOCK, not as two elements with
			    two offsets. A second `sticky top-[N]` under the first would have to
			    name the first's HEIGHT — which is set by how many lines the market
			    question wraps to, i.e. by the content, i.e. by a number no class can
			    know. One sticky wrapper is what makes a three-line question correct
			    for free. `top-[62px]` is the header's border-box written as its two
			    shipped contributors: `60px` is `GlobalHeader`'s `h-[60px]` inner row,
			    `2px` its `border-y`. `z-30` sits BELOW the header's reserved `z-40`
			    (`sticky-header.test.ts`) — this strip must never cover the header. */}
			<div className="sticky top-[62px] z-30 bg-ground [border-bottom:var(--hairline)]">
				{focused === null ? (
					<PhoneTitleStrip
						title={market.title}
						thumbUrl={market.thumbImageUrl}
						expanded={sheet?.kind === "details"}
						onOpen={openDetails}
					/>
				) : (
					<PhoneTitleStrip
						title={focused.removed ? "Removed by moderator" : focused.title}
						subtitle={market.title}
						backHref={`/m/${market.slug}`}
						expanded={sheet?.kind === "parent"}
						onOpen={() => setSheet({ kind: "parent" })}
					/>
				)}
				<PhoneSideTabs
					options={focused === null ? feedTabs : threadTabs}
					active={focused === null ? activeKey : threadKey}
					onSelect={focused === null ? setActiveKey : setThreadKey}
				/>
			</div>

			<PhoneFeedTrack
				panes={
					focused === null
						? [
								{ key: "YES", content: feedPane("YES") },
								{ key: "NO", content: feedPane("NO") },
							]
						: [
								{ key: "support", content: threadPane("support") },
								{ key: "counter", content: threadPane("counter") },
							]
				}
				active={focused === null ? activeKey : threadKey}
				onActiveChange={focused === null ? setActiveKey : setThreadKey}
			/>

			<PhoneBottomBar
				market={market}
				actions={barActions}
				viewer={viewer}
				ownPseudonym={ownPseudonym}
				suspended={suspended}
				onEntry={onBarEntry}
			/>

			{/* ⛔ THE DETAILS HOST IS NOT UNMOUNTED ON CLOSE. Re-mounting the price
			    chart inside it on every open would re-run its geometry for a reader
			    who is toggling; the FIRST open is the only one that costs anything,
			    which is the whole of what "lazily on first open" buys. */}
			{detailsMounted ? (
				<PhoneSheet
					open={sheet?.kind === "details"}
					title="Market"
					busy={false}
					fullHeight={false}
					onClose={closeSheet}
				>
					{details}
				</PhoneSheet>
			) : null}

			{/* RF-9 founder amendment — the parent post left the thread SCREEN, so
			    the strip's tap is where it is read instead. Without it a reader on
			    the reply surface has no way to see what they are replying to, which
			    is the one thing a reply surface must not take away. */}
			{focused !== null ? (
				<PhoneSheet
					open={sheet?.kind === "parent"}
					title="Argument"
					busy={false}
					fullHeight={false}
					onClose={closeSheet}
				>
					<div className="pb-3">
						<PostCard
							post={focused}
							onEnter={() => setSheet(null)}
							onOpenPopup={setPopupPost}
							onOpenImage={setLightboxUrl}
							onReplyToPost={(_id, relation) => {
								openReply(focused, relation);
							}}
							heldSide={heldSide}
							marketOpen={marketOpen}
							suspended={suspended}
						/>
					</div>
				</PhoneSheet>
			) : null}

			{sheet !== null && sheet.kind !== "details" && sheet.kind !== "parent" ? (
				<PhoneSheet
					open
					// ⚠ THE SHEET IS NAMED BY WHAT IS INSIDE IT. Signed out it holds the
					// auth gate, and titling that `Place your Đ BET` announces an action
					// the reader cannot take and then shows them why not — two headings
					// disagreeing about what the screen is for. Both strings are live and
					// each is the heading its own component was written with.
					title={
						viewer === null
							? AUTH_GATE_COPY.heading(sheet.side)
							: COMPOSER_COPY.header
					}
					busy={composerBusy}
					fullHeight={viewer !== null}
					// Both branches below open with their own heading — see PhoneSheet.
					titleHidden
					onClose={closeSheet}
				>
					{/* ⛔⛔ THE SHEET'S ENTIRE CONTENT SET IS THESE TWO COMPONENTS, and
					    guard 4 pins it. A third branch here is how a surface acquires a
					    second way to stake — the one thing the phone tier must not do
					    (`CLAUDE.md` §2: no bet without a comment, and no comment without
					    a bet). */}
					{viewer === null ? (
						<AuthGateSlot side={sheet.side} onClose={closeSheet} />
					) : (
						<BetComposer
							// A relation flip must REMOUNT the composer: side is immutable
							// per instance (INV-3), so a live instance can never flip.
							key={`${sheet.kind}:${sheet.kind === "reply" ? sheet.parentCommentId : ""}:${sheet.side}`}
							marketId={market.id}
							slug={market.slug}
							side={sheet.side}
							kind={sheet.kind}
							viewer={viewer}
							{...(sheet.kind === "reply"
								? {
										parentCommentId: sheet.parentCommentId,
										replyContext: {
											relation: sheet.relation,
											authorPseudonym: sheet.authorPseudonym,
										},
									}
								: {})}
							onClose={closeSheet}
							onPosted={onPosted}
							onSuspended={() => setSuspended(true)}
							onBusyChange={setComposerBusy}
						/>
					)}
				</PhoneSheet>
			) : null}

			<PostPopup post={popupPost} onClose={() => setPopupPost(null)} />
			<ReplyPopup reply={popupReply} onClose={() => setPopupReply(null)} />
			<ImageLightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />
		</div>
	);
}

/**
 * ⚠ ONE SLOT, FOUR SHAPES, discriminated — not four booleans. Two sheets open at
 * once is not a state this surface has, and a union is what makes that
 * unrepresentable rather than merely unlikely.
 */
type PhoneSheetState =
	| null
	| { kind: "details" }
	| { kind: "parent" }
	| { kind: "post"; side: Side }
	| {
			kind: "reply";
			side: Side;
			relation: "support" | "counter";
			parentCommentId: string;
			authorPseudonym: string | null;
	  };
