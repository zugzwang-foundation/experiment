"use client";

import { useRouter } from "next/navigation";
import {
	type ReactNode,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";

import { PageContainer } from "@/components/shell/PageContainer";
import { AuthGateSlot } from "./composer/AuthGateSlot";
import { BetComposer } from "./composer/BetComposer";
import { ComposerSlot } from "./composer/ComposerSlot";
import { deriveReplySide, replyComposerColumn } from "./composer/gating";
import { PositionStrip } from "./composer/PositionStrip";
import { SlotHeader } from "./composer/SlotHeader";
import { DebateColumn } from "./DebateColumn";
import { DebatePoll } from "./DebatePoll";
import { ImageLightbox, PostPopup, ReplyPopup } from "./dialogs";
import { findPostedNode } from "./find-posted";
import { MarketHeader } from "./MarketHeader";
import { PostFocusHeader } from "./PostFocusHeader";
import { readPostParam, resolvePostParamClient } from "./post-param";
import { PostScroller, ReplyScroller } from "./scrollers";
import type {
	DebatePost,
	DebateReply,
	DebateViewModel,
	PresentPost,
	PresentReply,
	Side,
	ViewerMarketContext,
} from "./types";

const opposite = (side: Side): Side => (side === "YES" ? "NO" : "YES");

/**
 * RPLY-1 · R2 — how long the exit waits for its own `popstate` before deciding
 * the traversal never happened. Comfortably longer than a same-document
 * traversal (a queued task) and far shorter than a reader's second deliberate
 * click. See `exitPost` for why a dead-man's release is needed at all.
 */
const TRAVERSAL_RELEASE_MS = 400;

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
	// HTML-FINISH · MARKET DETAIL row 27 — the reply pop-up, a SEPARATE state
	// slot from the post pop-up. ⛔ Not one widened slot: `PresentReply` is what
	// makes a removed reply unpassable at the type level (H3-e / SC-1), and a
	// shared slot would have had to be a union that admits both.
	const [popupReply, setPopupReply] = useState<PresentReply | null>(null);
	const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
	// UI-QUICK change set 3 §D — the resolution-criterion dialog. It lives HERE,
	// not in `ResolutionCriterion`, for one reason: `frozen` below is the list of
	// every sub-view that stops the carousel, and a sub-view whose state the
	// predicate cannot see is a sub-view that does not freeze anything.
	// biome-ignore lint/correctness/noUnusedVariables: `setCriterionOpen` has no
	// caller since the main→staging merge took RESO-1/RESO-3's `MarketHeader`,
	// which has no `criterion` prop. The PAIR is kept deliberately: the freeze
	// predicate still reads `criterionOpen` (dormant, constant false — see the
	// change-set-4 §B block below), `debate-view-freeze.test.ts` pins this exact
	// declaration as the ownership guard, and re-attaching a criterion trigger is
	// then one prop rather than a re-lift of the state. Deleting the setter is how
	// the §D defect comes back.
	const [criterionOpen, setCriterionOpen] = useState(false);
	/**
	 * R6 — which composer slots are OCCUPYING their column, exit included. Keyed
	 * because BOTH columns render a `ComposerSlot` on every render and only one
	 * hosts: a single boolean would be written by the hosting slot and immediately
	 * clobbered by its idle neighbour, and which won would depend on effect order.
	 */
	const [occupiedSlots, setOccupiedSlots] = useState<Record<string, boolean>>(
		{},
	);
	// ⚠ STABLE IDENTITY — this is in the slots' effect deps. A fresh function per
	// render would make them report on every render, which with a `setState` in
	// the effect is a render loop. The functional update also makes it a no-op
	// when the value is unchanged, so an idle slot never re-renders the view.
	const reportSlotOccupied = useCallback(
		(slotId: string, occupied: boolean) => {
			setOccupiedSlots((prev) =>
				prev[slotId] === occupied ? prev : { ...prev, [slotId]: occupied },
			);
		},
		[],
	);
	const slotOccupied = Object.values(occupiedSlots).some(Boolean);
	// UI.A3 — the market-view Đ BET composer: at most ONE open (side-slot rule:
	// betting side S renders the composer in the OPPOSITE slot; opening the
	// other side closes the first — the d5 slot model, toggle-to-close).
	const [openSide, setOpenSide] = useState<Side | null>(null);
	const [focusMode, setFocusMode] = useState(false);
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
	/**
	 * HTML-FINISH · MARKET DETAIL round 2 · R3 — THE PICKED COLUMN (d5's `picked`,
	 * `:1683`). The reader's chosen side stops auto-advancing; the OTHER side
	 * keeps running (`:1744` — "picked side is manual (loader off); the OTHER side
	 * keeps auto-scrolling").
	 *
	 * ⛔⛔ IT LIVES HERE AND NOT IN THE SCROLLERS, AND IT HAS TO. Picking is
	 * MUTUALLY EXCLUSIVE across the two columns — choosing YES releases NO — and
	 * the two scrollers are siblings that cannot see each other. Owning it in
	 * either one would mean a column reaching across to its peer. This is the
	 * smallest node that contains both, and it is already the arena's owner.
	 *
	 * ⚠ ONE SLOT SERVES BOTH ARMS, deliberately. The market arm picks a POST
	 * column and the post arm picks a REPLY column, and the two never coexist —
	 * the ternary below renders exactly one arena. d5 runs two separate scripts
	 * for the two arms and duplicates the whole state machine; one slot plus the
	 * arm-swap reset below is the same behaviour without the second copy.
	 */
	const [pickedSide, setPickedSide] = useState<Side | null>(null);

	const isFocused = focusMode || openSide !== null;

	/**
	 * ⚠⚠ THE COLUMNS' `step` FUNCTIONS, REGISTERED UP. d5's `onKey` calls
	 * `step(side, ±1)` (`d5:1792-1793`, `:1891`) — the keyboard STEPS CARDS, and
	 * that is the half this build never had. Paging state lives in each scroller's
	 * `usePagedColumn`, and the two scrollers are siblings that cannot see each
	 * other or the key handler, so each publishes its stepper here on mount.
	 *
	 * ⛔ A REF, NOT STATE. Registering must not re-render — a render would rebuild
	 * the callback, which would re-register, which would render again.
	 * ⚠ Cleared on unregister so a column that unmounts (composer opens over it,
	 * arm swaps) cannot be stepped through a stale closure.
	 */
	const stepRefs = useRef<Record<Side, ((delta: number) => void) | null>>({
		YES: null,
		NO: null,
	});
	/**
	 * d5's `lastSide` (`:1683`) — the most recently chosen column. With nothing
	 * picked, ↑/↓ resume THAT column rather than doing nothing (`d5:1801`).
	 */
	const lastSideRef = useRef<Side | null>(null);

	// ⚠ ONE STABLE CALLBACK PER SIDE, not one closure built inside the `.map`.
	// The scroller's register effect lists this in its deps, so a fresh function
	// per render would unregister and re-register on every render — including the
	// ones the countdown bar causes.
	const registerYes = useCallback((step: ((delta: number) => void) | null) => {
		stepRefs.current.YES = step;
	}, []);
	const registerNo = useCallback((step: ((delta: number) => void) | null) => {
		stepRefs.current.NO = step;
	}, []);

	const router = useRouter();
	/**
	 * ⚠⚠ FEED-2 — THE BET THE AUTHOR JUST PLACED, and the model it was placed
	 * against. Set on a 200; the composer closes immediately, exactly as it did
	 * before FEED-1. Nothing is held anywhere — this is a note-to-self about a
	 * payload that has not arrived yet, not a state the surface is in.
	 *
	 * ⛔ `fromModel` IS THE REFRESH-LANDED SIGNAL. `model` is deserialized from
	 * the RSC payload, so it takes a new object identity exactly when a new
	 * payload is applied and at no other time. `model !== posted.fromModel` asks
	 * "is the new data HERE", which is the only question that decides whether
	 * there is a card to point at. ⛔ `useTransition().isPending` was rejected on
	 * evidence at FEED-1 and the evidence has not changed: `router.refresh()`
	 * opens its OWN `React.startTransition` internally, so an outer pending flag
	 * tracks a different transition object than the one carrying the fetch.
	 *
	 * ⚠ IT IS NEVER CLEARED, and that is deliberate rather than sloppy. Both
	 * consumers — the pick below and the scroller's jump — are ONE-SHOT, keyed on
	 * the comment id. Clearing it would instead make the jump depend on effect
	 * ORDERING between this component and its scroller children, which is a
	 * property no comment can keep true. A stale `posted` costs one object
	 * reference and does nothing.
	 */
	const [posted, setPosted] = useState<{
		commentId: string;
		fromModel: DebateViewModel;
	} | null>(null);

	/**
	 * FEED-2 — the bet committed. The refresh lives HERE, not in `BetComposer`,
	 * because this is the component that has to recognise the new model; a second
	 * refresh fired from the composer would be a second server read for one bet.
	 * The budget is pinned at TWO (`posted-refresh-budget.test.tsx`): this one,
	 * and the poll's resume when the composer closes.
	 */
	const onPosted = useCallback(
		({ commentId }: { commentId: string }) => {
			setPosted({ commentId, fromModel: model });
			router.refresh();
		},
		[model, router],
	);

	/** d5's `pickSide` (`:1746`) — choosing a column also makes it the `lastSide`. */
	const pickSide = useCallback((side: Side) => {
		setPickedSide(side);
		lastSideRef.current = side;
	}, []);

	const { market, posts, priceChart } = model;
	const marketOpen = market.status === "Open";
	const heldSide = viewer?.position?.side ?? null;

	const toggleEntry = (side: Side) => {
		if (composerBusy) {
			return;
		}
		setOpenSide((cur) => (cur === side ? null : side));
	};

	const toggleFocusMode = useCallback(() => {
		if (composerBusy) {
			return;
		}
		if (isFocused) {
			setFocusMode(false);
			setOpenSide(null);
		} else {
			setFocusMode(true);
			const sideToOpen = heldSide ?? pickedSide ?? "YES";
			setOpenSide(sideToOpen);
		}
	}, [composerBusy, isFocused, heldSide, pickedSide]);

	/**
	 * HTML-FINISH · MARKET DETAIL round 2 · R3 — THE SURFACE IS FROZEN while a
	 * composer or a pop-up is open. d5's `locked` / `inDefault()` (`:1756-1771`):
	 * "any sub-view hides controls + freezes both sides until back to plain market
	 * view".
	 *
	 * ⛔ IT FREEZES **BOTH** COLUMNS, not just the one hosting the composer. The
	 * composer already replaces its own column's scroller, so freezing only that
	 * one would be a no-op; the point is that a reader typing an argument must not
	 * have the OTHER column shuffling beside them. The lightbox counts for the
	 * same reason — it covers the surface, and a card that moves underneath it has
	 * moved somewhere the reader cannot see.
	 */
	const frozen =
		openSide !== null ||
		openReply !== null ||
		popupPost !== null ||
		popupReply !== null ||
		lightboxUrl !== null ||
		// ⚠⚠ UI-QUICK change set 3 §D — THE SIXTH SUB-VIEW, AND ITS ABSENCE WAS A
		// DEFECT I SHIPPED. `ResolutionPopup` arrived in change set 2 holding its
		// own `open` state inside `ResolutionCriterion`, so it was invisible to
		// this predicate and the carousel kept advancing behind the modal. Radix
		// locks scroll and marks the page inert, so nothing was CLICKABLE behind
		// it — but cards still moved, which is precisely the case the block above
		// admits the lightbox for: "it covers the surface, and a card that moves
		// underneath it has moved somewhere the reader cannot see."
		// ⇒ The state is lifted here rather than the predicate reaching down,
		// because this is the node that already owns every other sub-view flag.
		//
		// ⛔⛔ DORMANT BY FOUNDER RULING (change set 4 §B) — THIS TERM CAN NO LONGER
		// GO TRUE, AND IT STAYS ANYWAY. The `Know more` trigger was removed from the
		// resolution zone pending its redesign, so nothing sets `criterionOpen`; the
		// term is a constant `false` until a trigger is re-attached. ⚠ It reads as
		// dead and it is not — dropping it is how the §D defect comes back, because
		// the redesign will re-open this dialog and the predicate would once again be
		// unable to see it. `debate-view-freeze.test.ts` fails if it is removed.
		criterionOpen ||
		// ⚠⚠ R6 — THE FREEZE TAIL, founder-ruled. Every term above reads a state
		// that clears the INSTANT the reader dismisses the sub-view, so the
		// carousel resumed ~260ms early — cards moved behind a composer that was
		// still visibly sliding out. This term stays true until the slot has
		// actually released the column.
		// ⛔ IT IS NOT A SECOND TIMER. `ComposerSlot` reports its own `mounted`
		// flag, which is the same state that decides whether the corpse renders at
		// all — so a stuck freeze would require a stuck composer, visible on
		// screen rather than silent. See `ComposerSlot.tsx` for why it cannot
		// persist, and `composer-slot.test.tsx` for the guard that fails if it can.
		slotOccupied;

	/**
	 * ⚠⚠ THE FOUNDER'S TWO KEYBOARD REPORTS, AND WHAT THEY ACTUALLY WERE.
	 * Measured on live staging at `5349ae9`, both columns, real key events:
	 * pressing → paused the RIGHT column's countdown and started the LEFT one
	 * moving; pressing ↑ or ↓ did nothing at all. That is the whole of both
	 * complaints, and neither was a mis-mapping:
	 *
	 *   · "cards do not step" — LITERALLY TRUE. The old handler called
	 *     `setPickedSide` and NOTHING ELSE. No arrow key stepped a card, because
	 *     ↑/↓ were deliberately not ported and ←/→ only ever picked.
	 *   · "←/→ are REVERSED" — the KEYS were mapped correctly (← → left/YES,
	 *     exactly `d5:1794`), but picking a column STOPS it while the other keeps
	 *     auto-advancing. With no visible pick state, the only thing a reader
	 *     could see was the OTHER column starting to move. Correct code, and it
	 *     read backwards, which is O-3: a true refusal reported with a misleading
	 *     cause is a defect.
	 *
	 * ⇒ BOTH ARE FIXED BY PORTING `onKey` AS WRITTEN (`d5:1789-1803`, mirrored at
	 * `:1889-1895`) rather than a description of it, plus making the pick VISIBLE
	 * (see `DebateColumn`'s `picked`). ↑/↓ step the chosen column; ←/→ choose one;
	 * with nothing chosen yet, ↑/↓ resume `lastSide`.
	 *
	 * ⛔ THE SUPERSEDED RULING, RECORDED RATHER THAN DELETED (O-4). This block
	 * used to read: "⛔ ONLY ←/→, AND d5's ↑/↓ STEPPING IS DELIBERATELY NOT
	 * PORTED … this page scrolls, and swallowing ↑/↓ would take the page's own
	 * scrolling away from every keyboard user to add a shortcut nobody asked for."
	 * The founder DID ask for it, and the concern is answered rather than
	 * dismissed: ↑/↓ are swallowed ONLY when a column is actually chosen — either
	 * picked now, or picked earlier this session. Until the reader has touched a
	 * column, ↑/↓ scroll the page exactly as they always did, and clicking off the
	 * arena releases the pick and hands scrolling straight back.
	 *
	 * ⛔ NEVER WHILE TYPING (d5's own guard, `:1461`): a composer is a `<textarea>`
	 * and stealing ← mid-argument would move the surface under an author trying to
	 * move the caret. `frozen` already covers composer-open; the target check is
	 * the belt for any future input.
	 *
	 * ⚠ `preventDefault` ONLY on a key this handler actually consumes.
	 */
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (
				e.key !== "ArrowLeft" &&
				e.key !== "ArrowRight" &&
				e.key !== "ArrowUp" &&
				e.key !== "ArrowDown"
			) {
				return;
			}
			if (frozen) {
				return;
			}
			const target = e.target as HTMLElement | null;
			if (
				target !== null &&
				(target.tagName === "TEXTAREA" ||
					target.tagName === "INPUT" ||
					target.isContentEditable)
			) {
				return;
			}
			if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
				e.preventDefault();
				pickSide(e.key === "ArrowLeft" ? "YES" : "NO");
				return;
			}
			// ↑/↓ — step the chosen column. `pickedSide` if one is chosen, else the
			// last one the reader touched (d5 `:1801`). With neither, this key is
			// NOT consumed and the page scrolls, which is the whole answer to the
			// superseded objection above.
			const target_side = pickedSide ?? lastSideRef.current;
			if (target_side === null) {
				return;
			}
			const step = stepRefs.current[target_side];
			if (step === undefined || step === null) {
				return;
			}
			e.preventDefault();
			// Touching a column takes it off the timer, exactly as the rail arrows
			// do (`d5:1780-1781` — `pickSide(side); step(side, ±1)`).
			pickSide(target_side);
			step(e.key === "ArrowUp" ? -1 : 1);
		};
		document.addEventListener("keydown", onKey);
		return () => document.removeEventListener("keydown", onKey);
	}, [frozen, pickedSide, pickSide]);

	/**
	 * ⚠⚠ d5's TWO CLICK BEHAVIOURS, IN ONE DELEGATED LISTENER — which is how d5
	 * itself does it (`:1782-1788`, mirrored at `:1886-1888`):
	 *
	 *   · a click INSIDE a column PICKS it — `slots[side].addEventListener(
	 *     'click', …)` — except when it lands on a control, because that click
	 *     belongs to the control (d5's own exclusion list is
	 *     `.rtt,.argimg,button,a,.pscroll`).
	 *   · a click OUTSIDE both columns RELEASES the pick — `if(ev.target.closest(
	 *     '.slot')) return; unpick();`. Without the release a pick, once made, is
	 *     permanent and the surface the reader froze never thaws.
	 *
	 * ⛔ DELEGATED RATHER THAN AN `onClick` PROP, and that is not merely
	 * convenient. A column CONTAINS buttons and links, so it can be neither a
	 * `<button>` (invalid nesting) nor a static element carrying a click handler
	 * (`noStaticElementInteractions` / `useKeyWithClickEvents` reject it, and they
	 * are right to — a click-only affordance on a `<div>` is invisible to the
	 * keyboard). Here the keyboard path is ←/→, which reaches both columns from
	 * anywhere on the page, so nothing about the pick is mouse-only.
	 */
	useEffect(() => {
		const onDocClick = (e: MouseEvent) => {
			if (frozen) {
				return;
			}
			const target = e.target as HTMLElement | null;
			if (target === null) {
				return;
			}
			const column = target.closest("[data-debate-column]");
			if (column === null) {
				setPickedSide(null);
				return;
			}
			// d5's exclusion list — a click on a control is that control's.
			if (target.closest("button,a,input,textarea,label") !== null) {
				return;
			}
			const side = column.getAttribute("data-debate-column");
			if (side === "YES" || side === "NO") {
				pickSide(side);
			}
		};
		document.addEventListener("click", onDocClick);
		return () => document.removeEventListener("click", onDocClick);
	}, [frozen, pickSide]);

	/** The body of one market-view pole column: composer/auth-gate when this
	 * column is the OPPOSITE slot of the open bet side; the post scroller
	 * otherwise. */
	const marketColumnBody = (side: Side, scroller: ReactNode) => {
		const hosts = openSide !== null && side === opposite(openSide);
		return (
			// UI-QUICK change set 3 §C — the slot slides in and out at canon §5's
			// 260ms and moves focus on both edges. ⚠ IT WRAPS THE SLOT, NOT THE
			// OCCUPANT: signed-out this animates `AuthGateSlot` and signed-in
			// `BetComposer`, identically, because the motion belongs to the swap
			// rather than to whichever component the viewer state selects.
			<ComposerSlot
				slotId={side}
				onOccupiedChange={reportSlotOccupied}
				open={hosts}
				busy={composerBusy}
				scroller={scroller}
				composer={
					hosts && openSide !== null ? (
						viewer === null ? (
							<AuthGateSlot side={openSide} onClose={() => setOpenSide(null)} />
						) : (
							<BetComposer
								marketId={market.id}
								slug={market.slug}
								side={openSide}
								kind="post"
								viewer={viewer}
								onClose={() => setOpenSide(null)}
								onPosted={onPosted}
								onSuspended={() => setSuspended(true)}
								onBusyChange={setComposerBusy}
							/>
						)
					) : null
				}
			/>
		);
	};

	// UI.A2 §3.4 (ratified OQ-5c) — outbound URL sync: mirror focus into
	// `?post=<ordinal>`, making deep links user-MINTABLE (copy the address bar
	// in post view).
	//
	// ⚠⚠ RPLY-1 · R2 — ENTERING A POST NOW PUSHES, AND THE SUPERSEDED RULE IS
	// RECORDED RATHER THAN DELETED (O-4). This read: "replaceState, never
	// pushState — focus toggling must not pollute history." The intent was right
	// and the mechanism produced the opposite of it: with nothing ever pushed,
	// `history.length` did not grow on entering post-focus, and `HeaderNav`'s
	// `canGoBack` reads `usePathname()`, which excludes the query string. So
	// Back — the header's and the browser's — left `/m/[slug]` ALTOGETHER, and
	// `FocusMarketCard` was left as the only in-app way out of post focus.
	//
	// ⛔ THE ANSWER TO "DO NOT POLLUTE HISTORY" IS THE EXIT, NOT THE ENTRY.
	// Entering pushes ONE rung; leaving calls `history.back()` and UNWINDS it
	// rather than pushing a third. A reader who enters and leaves five posts
	// ends with a stack the same depth they started with, which is what that
	// sentence was actually asking for.
	//
	// ⚠ EXACTLY TWO RUNGS — post-focus, then the route. Opening the composer
	// gets NO entry of its own: it already has an × and an ESC path, and a
	// third rung would make Back mean two different things one after the other.
	//
	// ⛔⛔ THE STATE ARGUMENT IS `null`, AND AN EARLIER DRAFT OF THIS CODE SPREAD
	// `history.state` INTO IT ON A REASON THAT IS THE EXACT OPPOSITE OF THE
	// TRUTH. That draft's comment read: "Next's App Router keeps its own
	// bookkeeping on `history.state` … pushing a bare object would strip it and
	// leave the router meeting an entry it does not recognise." Measured in the
	// shipped `next@16.2.4` (`client/components/app-router.js:252-263`), Next
	// PATCHES `history.pushState` and the patch opens with:
	//
	//     if (data?.__NA || data?._N) { return originalPushState(...); }   ← SKIP
	//     data = copyNextJsInternalHistoryState(data);   ← copies __NA + TREE
	//     if (url) { applyUrlFromHistoryPushReplace(url); }  ← updates canonicalUrl
	//
	// `HistoryUpdater` stamps `__NA: true` onto `history.state` on first paint,
	// so spreading it GUARANTEES the short-circuit — and the router's
	// `canonicalUrl` never learns about `?post=N`. Next copies its own
	// bookkeeping for us (`copyNextJsInternalHistoryState`, `:84-96`); the
	// spread was not merely unnecessary, it was the thing that broke the sync.
	//
	// ⚠ AND IT WAS A REGRESSION, NOT A MISSING FEATURE. The superseded code
	// passed `null`, which is falsy, so the patch ran. What the spread cost:
	// `DebatePoll` calls `router.refresh()` every 15s while the market is Open,
	// and each refresh has `HistoryUpdater` `replaceState` the STALE
	// `canonicalUrl` — so the address bar silently dropped `?post=N` a few
	// seconds after entering a post, killing the UI.A2 §3.4 mintable-deep-link
	// property that works on `staging` today.
	//
	// ⛔ NO CUSTOM FIELD IS WRITTEN HERE EITHER, and that is the second half of
	// the same lesson. A `zzPost` marker was tried and cannot survive: the same
	// `HistoryUpdater` builds its state as
	// `{...(preserveCustomHistoryState ? history.state : {}), __NA, TREE}` and
	// every soft navigation — `router.refresh()` included — sets that flag
	// FALSE (`segment-cache/navigation.js:271,382`). So a custom field is
	// deleted on the first poll tick, ~15s after it is written. Whatever
	// remembers our rungs has to live somewhere Next does not own; see
	// `pushedRungsRef`.
	const syncPostParam = (
		ordinal: number | null,
		mode: "push" | "replace" = "replace",
	) => {
		const url = new URL(window.location.href);
		if (ordinal === null) {
			url.searchParams.delete("post");
		} else {
			url.searchParams.set("post", String(ordinal));
		}
		if (mode === "push") {
			history.pushState(null, "", url);
			// One more rung of ours is on the stack. See `exitPost`.
			pushedRungsRef.current += 1;
		} else {
			history.replaceState(null, "", url);
		}
	};
	/**
	 * HTML-FINISH · MARKET DETAIL row 36 — ENTERING A POST RESETS THE PAGE
	 * SCROLL. d5 does the same on its scroll container (`:1605`:
	 * `var c = document.querySelector('.content'); if(c){ c.scrollTop = 0; }`).
	 *
	 * ⚠ WHY IT IS NEEDED: the market↔post switch is a STATE toggle, not a
	 * navigation, so the browser has no reason to move the viewport. A reader
	 * scrolled down a long market view clicks a post title and the arm swaps
	 * BENEATH them — they land mid-page in a post they have not seen the top of,
	 * with the argument they just chose above the fold.
	 *
	 * ⚠ `behavior: "instant"`, not smooth: the content under the viewport has
	 * ALREADY been replaced, so animating the scroll animates past content that
	 * no longer relates to where it is going.
	 */
	const resetPageScroll = () => {
		window.scrollTo({ top: 0, behavior: "instant" });
	};
	/**
	 * RPLY-1 · R2 — HOW MANY HISTORY RUNGS THIS COMPONENT HAS PUSHED AND NOT YET
	 * SEEN POPPED. `exitPost` reads it to decide whether it has something of its
	 * own to unwind; the `popstate` listener decrements it.
	 *
	 * ⛔ A REF, NOT STATE: it must not re-render, and it must survive a
	 * `router.refresh()`. ⛔ NOT `history.state`, which is where this started —
	 * Next's `HistoryUpdater` drops custom fields on every soft navigation, so a
	 * marker written there is gone by the first poll tick. See `exitPost`.
	 */
	const pushedRungsRef = useRef(0);
	/**
	 * RPLY-1 · R2 — a `history.back()` has been REQUESTED and its `popstate` has
	 * not arrived yet. `history.back()` is asynchronous and `exitPost` sets no
	 * React state on that branch, so without this the exit control stays live and
	 * a second activation traverses a second entry. See `exitPost`.
	 */
	const traversalPendingRef = useRef(false);
	const enterPost = (id: string) => {
		if (composerBusy) {
			return;
		}
		setSelectedPostId(id);
		setOpenReply(null);
		setOpenSide(null);
		// R3 — the arm swap releases the picked column. d5 does the same on entering
		// and on leaving a post (`:1869-1870`): the pick names a COLUMN, and the
		// post arm's columns are different columns holding different content, so
		// carrying the pick across would silently freeze a column the reader never
		// chose.
		setPickedSide(null);
		const target = posts.find((p) => p.id === id);
		// R2 — a rung, so Back returns to the market view instead of leaving it.
		// ⚠ `> 0`, NOT MERELY "a target exists". `load-debate-view` falls back to
		// `ordinal: 0` on a defensive branch, and 0 is REFUSED by both shape gates
		// (`^[1-9]…`) — so writing `?post=0` mints a URL that silently lands on
		// the market arm on reload and on Back. Harmless while the param was only
		// ever replaced; R2 makes it a durable history entry, so it is filtered
		// here rather than left to be discovered as a dead deep link.
		syncPostParam(target && target.ordinal > 0 ? target.ordinal : null, "push");
		resetPageScroll();
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
		// R3 — same arm swap, same release.
		setPickedSide(null);
		const target = posts.find((p) => p.id === id);
		// R2 — the same rung: a card pill ENTERS the post, so it is the same arm
		// swap and gets the same history entry.
		// ⚠ `> 0`, NOT MERELY "a target exists". `load-debate-view` falls back to
		// `ordinal: 0` on a defensive branch, and 0 is REFUSED by both shape gates
		// (`^[1-9]…`) — so writing `?post=0` mints a URL that silently lands on
		// the market arm on reload and on Back. Harmless while the param was only
		// ever replaced; R2 makes it a durable history entry, so it is filtered
		// here rather than left to be discovered as a dead deep link.
		syncPostParam(target && target.ordinal > 0 ? target.ordinal : null, "push");
		// Row 36 applies here too: a card pill ENTERS the post, so it is the same
		// arm swap and the same reason.
		resetPageScroll();
	};
	const exitPost = () => {
		if (composerBusy) {
			return;
		}
		/**
		 * ⚠⚠ RPLY-1 · R2 — LEAVING UNWINDS THE STACK, IT DOES NOT GROW IT. Calling
		 * `history.back()` pops the rung `enterPost` pushed, so entering and
		 * leaving is depth-neutral and the browser's own Back keeps agreeing with
		 * the surface's. The `popstate` listener below then clears the focus state
		 * off the URL, which is why nothing is set here on that branch — one
		 * mechanism owns the transition, in both directions.
		 *
		 * ⛔⛔ AND IT IS CONDITIONAL, BECAUSE THE UNCONDITIONAL VERSION REINTRODUCES
		 * THE BUG IN MIRROR IMAGE. A reader arriving on a DEEP LINK (`?post=3`
		 * pasted, or opened from elsewhere) has no rung of ours beneath them —
		 * their previous entry is another site, or nothing. A bare `history.back()`
		 * would take them OFF `/m/[slug]` entirely, which is precisely the defect
		 * R2 exists to remove.
		 *
		 * ⚠⚠ THE COUNTER LIVES IN A REF BECAUSE `history.state` CANNOT HOLD IT.
		 * A `zzPost` marker on the history entry was the obvious mechanism and it
		 * is measurably wrong: `HistoryUpdater` rebuilds the entry's state as
		 * `{...(preserveCustomHistoryState ? history.state : {}), __NA, TREE}`,
		 * and every soft navigation sets that flag FALSE — so `router.refresh()`,
		 * which `DebatePoll` fires every 15s, DELETES the marker. The exit would
		 * then take the fallback branch and ORPHAN the rung it pushed, growing
		 * `history.length` by one per enter/exit cycle and leaving a dead Back
		 * step behind — the exact history pollution the superseded comment above
		 * was written to prevent, arriving on a timer. A ref survives a refresh
		 * because a refresh re-renders this component rather than remounting it.
		 *
		 * ⛔ IT DECREMENTS ON `popstate`, NEVER HERE, so one rung is not counted
		 * twice: our own `history.back()` raises a `popstate` like any other.
		 * ⇒ AND IT FAILS SAFE BY CONSTRUCTION. A `popstate` cannot tell us whether
		 * the reader went back or forward, so the listener always decrements. The
		 * worst that costs is a conservative `false` here — the fallback runs, the
		 * surface still returns to the market arm, and one spare entry stays on the
		 * stack. The opposite error would walk the reader off the page, so the
		 * asymmetry is deliberate.
		 *
		 * ⛔⛔ AND THE TRAVERSAL IS LATCHED, BECAUSE `history.back()` IS
		 * ASYNCHRONOUS AND THIS BRANCH SETS NO REACT STATE. The traversal is a
		 * queued task and `popstate` — where the counter is decremented — fires in
		 * a LATER one. In between, nothing about the surface changes: the exit
		 * control stays mounted and enabled, so a second activation inside that
		 * window re-reads the counter as still positive and calls `back()` AGAIN.
		 * The browser then traverses −2 and the reader lands off `/m/[slug]`
		 * entirely, losing any argument they had typed — which is precisely the
		 * defect R2 exists to remove, arriving through R2's own fix.
		 * ⚠ NOT HYPOTHETICAL AT HUMAN SPEED: a held Enter on a focused `<button>`
		 * auto-repeats a click roughly every 30ms, and the poll's 15s
		 * `router.refresh()` is exactly the kind of main-thread work that widens
		 * the gap. A double-click does it too.
		 * ⇒ "Pop requested, not yet observed" is a THIRD state the counter cannot
		 * express, so it gets its own flag rather than being folded into the
		 * count. The same `popstate` handler clears it and decrements — one
		 * observation, one place. ⛔ The counter is NOT decremented here as well:
		 * that would double-count the single rung this pop consumes.
		 */
		if (pushedRungsRef.current > 0) {
			if (traversalPendingRef.current) {
				return;
			}
			traversalPendingRef.current = true;
			history.back();
			// ⛔⛔ A TIMED RELEASE, BECAUSE THE LATCH HAS EXACTLY ONE OTHER WAY OUT
			// AND IT DEPENDS ON AN INVARIANT NOTHING HERE ASSERTS. `onPop` clears
			// it — which is only guaranteed to run if there IS an entry below to
			// traverse to. That holds today because `enterPost`/`replyToPost` are
			// reachable only from the MARKET arm, capping the counter at 1; it is
			// not true by construction. A `history.go(-n)` (the back button's
			// long-press menu) fires ONE `popstate` while moving n entries, so the
			// counter can outlive the entries it counts — and then `history.back()`
			// is an out-of-range no-op that dispatches NOTHING, leaving this latch
			// set and the exit control dead for the rest of the page instance, with
			// no in-app recovery.
			// ⇒ If the pop has not arrived, the traversal did not happen. Releasing
			// early risks at worst the double-traverse this latch prevents, in a
			// race measured in milliseconds; never releasing risks a permanently
			// wedged button. The asymmetry decides it.
			// ⚠ NOT A DEBOUNCE and not tuned to a repeat rate: it is a dead-man's
			// release for a traversal that produced no event at all.
			window.setTimeout(() => {
				traversalPendingRef.current = false;
			}, TRAVERSAL_RELEASE_MS);
			return;
		}
		setSelectedPostId(null);
		setOpenReply(null);
		setOpenSide(null);
		// R3 — leaving post-focus releases the picked column too (d5 `:1870`).
		setPickedSide(null);
		syncPostParam(null);
	};
	const selectedPost = selectedPostId
		? (posts.find((p) => p.id === selectedPostId) ?? null)
		: null;

	/**
	 * ⚠⚠ RPLY-1 · R2 — THE INBOUND HALF. Pushing a rung is only half a history
	 * ladder: a popped entry changes the URL and nothing else, so without this
	 * the address bar would say `?post=3` while the surface sat on the market
	 * arm. This is what makes Back actually re-render.
	 *
	 * ⛔⛔ THE PARAM IS RESOLVED, NEVER INDEXED, AND THAT IS THE SECURITY
	 * PROPERTY. `resolvePostParamClient` applies the same three refusals the
	 * cold server arrival applies — shape gate, no-such-ordinal, REMOVED target
	 * — and falls back silently to the market arm on each. A listener that did
	 * the obvious thing and used the param to index a comment list would reach a
	 * removed post that `page.tsx` correctly declines to focus: a masking bypass
	 * through the back button. See `post-param.ts` for why resolving against the
	 * already-masked model is exact rather than an approximation of the server's
	 * answer — same ranking domain, same order, removed rows included in both.
	 *
	 * ⛔ THE COMPOSER IS CLOSED ON EVERY POP, in both directions. Composer-open
	 * has no history entry of its own (two rungs only), so a popped entry can
	 * carry no opinion about it; leaving one open across a pop would strand a
	 * composer belonging to a post the reader has just navigated away from.
	 *
	 * ⛔⛔ IT NO-OPS WHILE A SUBMIT IS IN FLIGHT, exactly as `enterPost`,
	 * `replyToPost` and `exitPost` already do, and for the same reason those
	 * three do: unmounting a composer mid-request lets a re-open mint a FRESH
	 * idempotency key over a possibly-committing bet, which is a second bet
	 * rather than a replay — the one seam `bet_receipts` cannot close, because a
	 * new key collides with nothing. ⚠ The cost is a transient disagreement
	 * between the URL and the surface for the length of one request, and that is
	 * the right trade: a stale query string is cosmetic and a double bet is not.
	 */
	/**
	 * ⚠⚠ `posts` AND `composerBusy` ARE READ FROM THE CLOSURE, NOT FROM REFS, AND
	 * THE REF VERSION IS RECORDED AS THE MISTAKE IT WAS. This effect used
	 * `postsRef.current = posts` written DURING RENDER. `router.refresh()` renders
	 * inside a React transition, and a transition render that is DISCARDED still
	 * runs those assignments — so the listener could read a `composerBusy` from a
	 * render that never committed.
	 * ⇒ Real deps instead. The listener re-registers when `posts` identity changes
	 * (once per poll payload) or when `composerBusy` flips — a
	 * `removeEventListener`/`addEventListener` pair on the order of once per 15s.
	 *
	 * ⚠⚠ AND AN EARLIER VERSION OF THIS BLOCK CLAIMED MORE THAN THE CODE
	 * DELIVERS, WHICH IS ITS OWN DEFECT (O-3). It said the change made "the
	 * money-path read exact rather than probably-fine." IT DOES NOT. `composerBusy`
	 * is reported up from `BetComposer`'s own PASSIVE EFFECT, so the true order is:
	 * child sets in-flight → child commits → child effect calls `onBusyChange` →
	 * parent state → parent commits → parent effect re-registers. The listener
	 * holds `false` for that whole window either way, and the deps form re-arms one
	 * commit LATER than a render-phase ref write did. ⇒ The guard is LATE BY
	 * CONSTRUCTION, and neither refs nor deps change that. What the deps form
	 * actually buys is the removal of a render-phase write that a discarded
	 * transition could leave inconsistent — real, and smaller than the sentence it
	 * replaced. The genuine backstop on that seam is the durable
	 * `bet_receipts` UNIQUE (ADR-0031), not this listener.
	 */
	useEffect(() => {
		const onPop = () => {
			// ⚠ THE LATCH AND THE COUNTER ARE BOTH SETTLED HERE, BEFORE THE BUSY
			// GUARD, and deliberately so: the browser has ALREADY moved the stack
			// whether or not this handler updates the surface. Skipping either would
			// leave `exitPost` believing a rung is still there — and the next exit
			// would `back()` off the page — or leave the traversal latched forever,
			// which would wedge the exit control shut.
			traversalPendingRef.current = false;
			pushedRungsRef.current = Math.max(0, pushedRungsRef.current - 1);
			if (composerBusy) {
				return;
			}
			const resolved = resolvePostParamClient(
				posts,
				readPostParam(window.location.search),
			);
			setSelectedPostId(resolved);
			setOpenReply(null);
			setOpenSide(null);
			// The arm may have swapped, and a pick names a COLUMN — the same reason
			// `enterPost` and `exitPost` release it.
			setPickedSide(null);
		};
		window.addEventListener("popstate", onPop);
		return () => window.removeEventListener("popstate", onPop);
	}, [posts, composerBusy]);

	/**
	 * ⚠⚠ FEED-2 — THE JUMP. When the refreshed payload arrives carrying the
	 * author's new comment, the column ON THAT COMMENT'S OWN SIDE shows it.
	 *
	 * ⛔⛔ THE SIDE IS THE BET'S SIDE, NOT THE COMPOSER'S COLUMN, and that is the
	 * defect this whole task exists to fix. A composer opens in the column
	 * OPPOSITE the side being bet (the d5 slot rule, so the side stays visible),
	 * so pointing the composer's own column at the post put it on the wrong pole
	 * — a YES bet's argument appearing on the NO side. The side is read off the
	 * comment itself: `sideAtPostTime` for a post, and for a reply its own frozen
	 * `side`, which is `deriveReplySide(parentSide, relation)` and is likewise NOT
	 * the column its composer sat in.
	 *
	 * ⛔ NOTHING IS HELD BY ANY OF THIS. There is no panel, no marker and no
	 * state to dismiss: `findPostedNode` yields a side, the scroller resolves the
	 * position, and the card that appears is the column's ordinary card in its
	 * true ranked position.
	 *
	 * ⛔ AND MASKING MATTERS MORE HERE THAN IT DID, NOT LESS. `findPostedNode`
	 * returns the PRESENT variant or nothing (fail-closed on `removed === false`),
	 * so a comment removed between submit and refresh yields `null` — no side, no
	 * id, no jump, silently. A "your post could not be found" state would be a
	 * held state under another name.
	 */
	const landed = posted !== null && model !== posted.fromModel ? posted : null;
	const postedNode =
		landed !== null
			? findPostedNode({
					posts,
					parent: selectedPost,
					commentId: landed.commentId,
				})
			: null;
	const jumpSide: Side | null =
		postedNode === null
			? null
			: postedNode.kind === "post"
				? postedNode.post.sideAtPostTime
				: postedNode.reply.side;
	/** The id handed to the scrollers; each resolves it against its OWN array. */
	const focusId =
		postedNode !== null && landed !== null ? landed.commentId : null;

	/**
	 * ⚠⚠ THE HOLD, AND IT INTRODUCES NO STATE AND NO TIMER. The posted card must
	 * survive until the READER moves, not until a clock expires — so this reuses
	 * the pick the surface already has. Picking a side stops THAT column's
	 * auto-advance (`usePagedColumn`'s `paused`) and leaves the other running,
	 * which is exactly the asymmetry wanted: the other column returns to its
	 * ordinary feed immediately.
	 *
	 * ⛔ WHY THIS IS NOT A TIMER, AND NOT SOMETHING TO DISMISS. A pick is released
	 * by the reader's own ordinary actions and by nothing else — a click outside
	 * the columns clears it, ←/→ move it, ↑/↓ re-pick and step, and choosing the
	 * other column takes it (one slot, so one release). There is no exit state,
	 * because a pick is not a state you are IN; it is which column is manual. If
	 * the reader never acts, they are looking at a real card in a real column.
	 *
	 * ⚠ ONE-SHOT, KEYED ON THE COMMENT ID — the same guard the scroller uses.
	 * Without it this would re-pick on every subsequent payload, silently
	 * re-taking a column the reader had already released.
	 */
	const pickedFor = useRef<string | null>(null);
	useEffect(() => {
		if (landed === null || jumpSide === null) {
			return;
		}
		if (pickedFor.current === landed.commentId) {
			return;
		}
		pickedFor.current = landed.commentId;
		pickSide(jumpSide);
	}, [landed, jumpSide, pickSide]);

	const yesPosts = posts.filter((p) => p.sideAtPostTime === "YES");
	const noPosts = posts.filter((p) => p.sideAtPostTime === "NO");

	return (
		/* ⚠⚠ THE ONE-SCREEN BAND — HTML-FINISH · MARKET DETAIL · DIMENSIONAL
		   PARITY, founder-ruled 2026-08-17: "It's a one page view — there should
		   be no scroll down. The dimensions of the whole market detail page are
		   not matching — it should be exact."

		   ⛔ THIS REVERSES `A1` FOR THIS ROUTE, and the superseded ruling is
		   recorded rather than deleted (O-4). `(public)/layout.tsx` ruled "⛔
		   `min-h-*`, never `h-*`, and NO `min-h-0` anywhere in the chain: the
		   floor lets the page GROW and SCROLL when content exceeds the viewport
		   (RULED A1) instead of clipping it. The mockup's `overflow:hidden` on
		   html/body is a fixed-viewport prototype affordance and is deliberately
		   NOT adopted." The founder has overruled that FOR `/m/[slug]`. That
		   comment is corrected in this same commit; ⛔ the layout's own `min-h-*`
		   floor is UNTOUCHED, because it still governs every other `(public)`
		   surface and this ruling names one route.

		   ⛔ A FIXED HEIGHT CLIPS — IT DOES NOT MAKE CONTENT FIT. What makes this
		   correct rather than broken is that the overflow lives INSIDE, exactly as
		   it does in d5: `.colwrap{overflow-y:auto}` (`d5:568`) is the one
		   scrolling region, and it is ported at `DebateColumn`. A long argument, a
		   removed-by-moderator placeholder (ADR-0020/0021) and a tall card all
		   stay reachable by scrolling THE COLUMN. Nothing is clipped out of
		   existence.

		   ⚠ `100dvh`, NOT `100vh` — the DYNAMIC viewport unit, so a mobile URL bar
		   collapsing does not leave the band taller than the window it is meant to
		   equal. ⚠ The subtrahend is unchanged and still the header's border-box
		   written as its two shipped contributors: `60px` is `GlobalHeader`'s
		   `h-[60px]` inner row, `2px` its `border-y`.

		   ⚠ `gap-3` = 12px is d5's `.arena{margin-top:12px}` (`:523`), replacing
		   the 20px `gap-5`. With the headzone band at its measured fraction this
		   is what reproduces d5's arena height exactly.

		   ⚠ `min-h-0` ON THE CONTAINER ITSELF is the first link: without it this
		   flex item's automatic minimum size is its CONTENT, and a tall arena
		   would push the band past the height it just declared. */
		<PageContainer
			preset="screen"
			// MOBILE-1 Phase A — the one-screen, no-page-scroll band is a
			// desktop composition over a fixed two-column arena (founder ruling
			// 2026-08-17, see the block above). Below 640px the arena stacks
			// instead (see both `arena` divs below), so the fixed viewport-height
			// band and its clipped overflow no longer have a two-column layout to
			// protect — released to ordinary page flow/scroll rather than forcing
			// a stacked arena through a one-screen box it was never sized for.
			className="flex h-[calc(100dvh-60px-2px)] min-h-0 flex-col gap-3 overflow-hidden max-mobile:h-auto max-mobile:overflow-visible"
		>
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
					{/* MOBILE-1 Phase A — the fixed two-column YES/NO arena stacks
					    below 640px (plan §4: "not preserved at phone width"); the
					    PageContainer above releases its one-screen band to match. */}
					<div
						data-testid="arena"
						className="flex min-h-0 flex-1 gap-4 max-mobile:flex-col"
					>
						{(["YES", "NO"] as const).map((side) => {
							// ⚠⚠ RPLY-1 · R1 — THE COLUMN IS OPPOSITE THE **BET**, NEVER
							// OPPOSITE THE PARENT. This read "opens in the slot OPPOSITE THE
							// POST" and the code did exactly that, which is the defect: the
							// RELATION was not an input to the expression at all, so Support
							// and Counter could not produce different columns. Support
							// coincided with the right answer by arithmetic accident (a
							// Support bet inherits the parent's side, so opposite-the-parent
							// IS opposite-the-bet); Counter did not — a Counter on a YES
							// parent bets NO and opened inside the NO column.
							//
							// ⛔ THE RULE FAILED ITS OWN STATED PURPOSE. design-canon §3.3
							// gives the reason as "the bet's side stays visible", and the
							// composer was covering precisely the side being bet. So this is
							// the post arm catching up to the market arm, which has always
							// keyed its slot off the side being bet rather than off a parent.
							//
							// ⚠⚠ THE COLUMN IS A CALL, NOT AN EXPRESSION, AND THAT DESIGNED
							// OUT A HAZARD RATHER THAN ACCEPTING ONE. The obvious fix inlines
							// the local flip of the RESULTING side — but `composerColumn` was
							// declared ABOVE `resultingSide`, so that form only works if the
							// two are also reordered, and getting that wrong is a TDZ
							// ReferenceError at runtime that a source-scanning test would
							// never reach. `replyComposerColumn` takes the same two inputs
							// the derivation does, so neither declaration depends on the
							// other and the ordering stops being load-bearing at all.
							// ⇒ It also makes the relation a REQUIRED ARGUMENT, so a revert
							// to keying off the parent alone is a compile error here rather
							// than a silent re-inversion (O-1).
							//
							// ⚠ The chip still carries the TRUE bet side (slot ≠ side,
							// permanently — INV-3 narrative), and the side still derives via
							// the unit-pinned `deriveReplySide`, never from the hosting column.
							const resultingSide =
								openReply !== null
									? deriveReplySide({
											parentSide: selectedPost.sideAtPostTime,
											relation: openReply,
										})
									: null;
							const composerColumn =
								openReply !== null
									? replyComposerColumn({
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
									// ⚠ RPLY-1 · R1 — UNCHANGED EXPRESSION, AND IT ONLY NOW
									// FIRES ON THE COUNTER PATH. Measured against the shipped
									// `deriveReplySide`: with the column keyed off the PARENT,
									// a Counter put `resultingSide` and `composerColumn` on the
									// same pole, so `side !== composerColumn` was false wherever
									// `resultingSide === side` was true and the engaged-slot
									// backlight (values-log §1 item 4) was dead on that path.
									// Keying the column off the BET repairs it as a consequence
									// rather than as a second edit — the backlight belongs on
									// the bet's own column, which is exactly the column the
									// composer no longer covers.
									engaged={resultingSide === side && side !== composerColumn}
									picked={pickedSide === side}
									header={
										<PositionStrip
											side={side}
											// RPLY-2 · R2 — mirrors the label/percent/TO-WIN to the
											// BET's side on the column hosting its composer; `null`
											// (every other render) leaves this identical to before.
											composingSide={hostsComposer ? resultingSide : null}
											pricing={market.pricing}
											unitToWin={market.unitToWin}
											viewer={viewer}
											ownPseudonym={ownPseudonym}
											slug={market.slug}
											// ⚠ RPLY-1 · R4b — NO `showControls` HERE ANY MORE. The
											// post arm's header carries no Buy and no Sell, so the
											// market arm's suppression had nothing of its kind to
											// suppress and was only removing the position readout's
											// click-through. Founder: "when composer opens, both
											// headers should be same … there are no buy/sell buttons
											// anyway." The prop is gone from `PositionStrip`
											// entirely — see its own block for the measurement.
										/>
									}
								>
									{/* §C — the reply arm takes the SAME slot wrapper as the market
									    arm. ⛔ `key={openReply}` IS UNTOUCHED on both branches: a
									    relation flip must still remount, because side is immutable
									    per instance (INV-3) and a live instance can never flip. The
									    wrapper animates the slot; the key still governs identity
									    inside it. */}
									<ComposerSlot
										slotId={side}
										onOccupiedChange={reportSlotOccupied}
										open={
											hostsComposer &&
											resultingSide !== null &&
											openReply !== null
										}
										busy={composerBusy}
										composer={
											hostsComposer && resultingSide !== null && openReply ? (
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
															// ⚠ The masked arm is the composer's THIRD header
															// state, not an omission: a removed parent has no
															// author at the type level, and `null` is what makes
															// the header fall back to the canon line.
															authorPseudonym: selectedPost.removed
																? null
																: selectedPost.author.pseudonym,
														}}
														onClose={() => setOpenReply(null)}
														onPosted={onPosted}
														onSuspended={() => setSuspended(true)}
														onBusyChange={setComposerBusy}
													/>
												)
											) : null
										}
										scroller={
											<ReplyScroller
												side={side}
												replies={repliesForSide(selectedPost, side)}
												focusId={jumpSide === side ? focusId : null}
												onOpenImage={setLightboxUrl}
												onOpenPopup={setPopupReply}
												// R3 — the post arm's own auto-advance. d5 runs a
												// SECOND, structurally identical timer over the reply
												// columns (`:1816-1901`); one hook serves both here.
												// `stagger` on NO only, so the two columns advance
												// one-after-another rather than flipping together.
												auto={{
													picked: pickedSide === side,
													frozen,
													onPick: () => pickSide(side),
													stagger: side === "NO",
													registerStep:
														side === "YES" ? registerYes : registerNo,
												}}
											/>
										}
									/>
								</DebateColumn>
							);
						})}
					</div>
				</>
			) : (
				<>
					{/* HTML-FINISH · MARKET DETAIL round 2 · R7 (row 8) — the rail bar's
					    percent labels open the composer for that side, exactly as the
					    colhead `Buy` does (`d5:1038`/`:1040` → `pick('yes')`/`pick('no')`
					    → `openMod`). ⛔ `toggleEntry` IS THE SAME HANDLER `SlotHeader`
					    gets, deliberately: two controls for one action must produce one
					    behaviour, including toggle-to-close and the `composerBusy`
					    no-op. ⛔ The F-3 viewer state travels WITH it — the composer host
					    below opens off `openSide` alone and checks none of these three
					    conditions itself, so a label that skipped them would be a bypass
					    around the gate rather than a second door to it. */}
					<MarketHeader
						market={market}
						priceChart={priceChart}
						pick={{ heldSide, marketOpen, suspended, onPick: toggleEntry }}
						compact={isFocused}
						onToggleCompact={toggleFocusMode}
					/>
					{/* MOBILE-1 Phase A — the fixed two-column YES/NO arena stacks
					    below 640px (plan §4: "not preserved at phone width"); the
					    PageContainer above releases its one-screen band to match. */}
					<div
						data-testid="arena"
						className="flex min-h-0 flex-1 gap-4 max-mobile:flex-col"
					>
						{(["YES", "NO"] as const).map((side) => {
							// §5 — the pole this column's HEADER speaks for. Normally its own;
							// while a composer is open it is the composing side, for BOTH
							// columns (the host mirrors, the opener already matches).
							const headerSide = openSide ?? side;
							// §1 — this column is HOSTING the composer, so its header is the
							// mirrored one and drops its Buy and Sell. ⛔ The column whose OWN
							// side is the composing side is not hosting and keeps both — its
							// Buy is the toggle-closed affordance.
							const hostingComposer =
								openSide !== null && side === opposite(openSide);
							return (
								<DebateColumn
									key={side}
									side={side}
									pricing={market.pricing}
									engaged={openSide === side}
									picked={pickedSide === side}
									header={
										/* ⚠⚠ §5 — BOTH HEADERS READ THE COMPOSING SIDE. Founder
									   ruling: while a composer is open, the column HOSTING it
									   stops advertising its own pole and mirrors the side being
									   bet — label, %, odds, position, and the BUY / SELL
									   controls.
									   ⛔⛔ THE BINDING RULE, AND IT IS THE WHOLE RISK: every
									   value below is keyed off `headerSide`, NEVER off `side`.
									   `SlotHeader` derives its percent, its to-win, its position
									   readout, its Buy handler and its Sell gate from the ONE
									   `side` prop it is given, so passing the composing side
									   binds all six together by construction. A control labelled
									   one pole that acts on the other is exactly the defect §0c
									   traced for, reintroduced in the view layer — and with both
									   headers reading the same pole there is no longer an
									   on-screen contradiction to expose it. Pinned by
									   `header-mirror.test.tsx`.
									   ⚠ 3a — THE MIRRORED BUY IS NOT A FRESH CALL-TO-ACTION.
									   `composerOpen` drives `aria-expanded`, and the button
									   variant renders `aria-expanded:bg-(--state-hover-fill)`, so
									   the real Buy sits in its open fill while its composer is
									   up. `openSide === headerSide` is true for BOTH headers
									   while open, so the mirror carries the identical state.
									   ⚠ 3b — CLICKING IT TOGGLES CLOSED, which is what the real
									   one does: `toggleEntry` is `cur === side ? null : side`.
									   Binding the mirror to `headerSide` makes the two controls
									   the same action rather than two behaviours to keep in step.
									   ⚠ 3c — SELL stays the same anchor with the same href, and
									   its gate travels with the side: `viewer.position.side ===
									   side` now asks whether the viewer holds the COMPOSING side.
									   ⚠ 3d — TWO CONTROLS NOW SHARE AN ACCESSIBLE NAME. Neither
									   visible label changes and neither `aria-label` is altered:
									   each header is wrapped in a labelled GROUP, so a screen
									   reader announces "YES column, Buy NO, button" and the
									   context disambiguates them. Renaming one control would have
									   made the two disagree about an action that is identical. */
										// ⚠ A `<fieldset>`, NOT a `div role="group"` — biome's
										// `useSemanticElements` correctly rejects the ARIA role when a native
										// element already carries it, and this genuinely groups form controls
										// (the Buy button and the Sell link). ⛔ Not suppressed; the element
										// changed. `min-w-0` is the standard fieldset fix — its default
										// `min-width: min-content` would refuse to shrink in the flex chain.
										<fieldset
											className="min-w-0"
											aria-label={`${side} column`}
											data-testid={`slot-header-${side}`}
											data-header-side={headerSide}
										>
											<SlotHeader
												side={headerSide}
												pricing={market.pricing}
												unitToWin={market.unitToWin}
												viewer={viewer}
												marketOpen={marketOpen}
												suspended={suspended}
												composerOpen={openSide === headerSide}
												showControls={!hostingComposer}
												onToggleEntry={() => toggleEntry(headerSide)}
												ownPseudonym={ownPseudonym}
												slug={market.slug}
											/>
										</fieldset>
									}
								>
									{marketColumnBody(
										side,
										<PostScroller
											side={side}
											posts={side === "YES" ? yesPosts : noPosts}
											focusId={jumpSide === side ? focusId : null}
											onEnter={enterPost}
											onOpenPopup={setPopupPost}
											onOpenImage={setLightboxUrl}
											onReplyToPost={replyToPost}
											heldSide={heldSide}
											marketOpen={marketOpen}
											suspended={suspended}
											// R3 — auto-advance. `stagger` on NO only: d5 offsets
											// the second side by half a cadence so the two columns
											// advance one-after-another (`:1742` — "NO leads by
											// 10s"). ⚠ The pick is MUTUALLY EXCLUSIVE by
											// construction — `pickedSide` is one slot, so choosing
											// one column releases the other with no cross-talk.
											auto={{
												picked: pickedSide === side,
												frozen,
												onPick: () => pickSide(side),
												stagger: side === "NO",
												registerStep: side === "YES" ? registerYes : registerNo,
											}}
										/>,
									)}
								</DebateColumn>
							);
						})}
					</div>
				</>
			)}

			{/* ⛔⛔ RESO-3 · CHANGE 6 — THE CRITERION DISCLOSURE IS NOT RENDERED, AND ITS
			    COMPONENT IS DELIBERATELY STILL IN THE REPO. `CriterionDisclosure.tsx`
			    is unrendered, not deleted, because restoring it is one line here and
			    the founder ruling that removed it is a placement decision rather than a
			    verdict on the component. Deleting the file would turn a one-line restore
			    into a rebuild, and would throw away the measurement its docblock carries
			    — that `hidden="until-found"` on a `<details>` body stops it ever opening.
			    ⚠ The criterion therefore has NO on-page presence on `/m/[slug]` again.
			    It reaches a participant only through the ADR-0025 `.md` export, exactly
			    as it did between RESO-1 and CRIT-1. That is the founder's call and it is
			    recorded here so the next reader does not "fix" it. */}

			<PostPopup post={popupPost} onClose={() => setPopupPost(null)} />
			<ReplyPopup reply={popupReply} onClose={() => setPopupReply(null)} />
			<ImageLightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />
		</PageContainer>
	);
}
