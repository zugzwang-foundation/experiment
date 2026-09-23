"use client";

import { useRouter } from "next/navigation";
import {
	type ReactNode,
	useCallback,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from "react";

import { AuthGateSlot } from "../composer/AuthGateSlot";
import { BetComposer } from "../composer/BetComposer";
import { AUTH_GATE_COPY, COMPOSER_COPY } from "../composer/copy";
import { deriveReplySide } from "../composer/gating";
import { setPhoneSheetOpen } from "../composer-open-store";
import { ImageLightbox, PostPopup, ReplyPopup } from "../dialogs";
import { findPostedNode } from "../find-posted";
import { formatPricePercent } from "../format";
import { PostCard } from "../PostCard";
// ⚠ THE CONSTANT, NOT A FOURTH COPY OF THE STRING. `REMOVED_STUB_TEXT` is
// "the ONE masking-variant string, reused across every removal surface"
// (`placeholders.tsx:3-7`); a private literal here is the SEP-1 drift story this
// task argues against two files over. Caught by `@code-reviewer`.
import { EmptySideCTA, REMOVED_STUB_TEXT } from "../placeholders";
import { ReplyCard } from "../ReplyCard";
import { parentOfReply, replyDownloadOrdinal } from "../reply-download";
import type {
	DebatePost,
	DebateViewModel,
	PresentPost,
	PresentReply,
	Side,
	ViewerMarketContext,
} from "../types";
import { type PhoneBarAction, PhoneBottomBar } from "./PhoneBottomBar";
import { PANE_ID, PhoneFeedTrack } from "./PhoneFeedTrack";
import { PhoneSheet } from "./PhoneSheet";
import { PhoneSideTabs } from "./PhoneSideTabs";
import { PhoneTitleStrip } from "./PhoneTitleStrip";
import { PhoneTopPill } from "./PhoneTopPill";

/**
 * ⛔⛔ THE PHONE PRESENTATION OF `/m/[slug]` — A SECOND TREE OVER THE SAME DATA,
 * NOT A REFLOW OF THE FIRST (ADR-0051 D-1).
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
/** D-52 — a stable "no own posts" for the signed-out viewer (see `openReply`'s deps). */
const NO_OWN_POSTS: readonly string[] = [];

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
	 * RF-7 — the details sheet's body, rendered on the SERVER and passed down.
	 *
	 * ⚠ IT IS NOT **MOUNTED** UNTIL THE SHEET IS FIRST OPENED — and this line
	 * used to say "not RENDERED", which is a different and false claim. As an
	 * element prop of a client component it is rendered SERVER-SIDE on every
	 * request at every width, and its Flight payload ships either way; what
	 * `detailsMounted` defers is the client mount, so a reader who never opens
	 * the sheet never runs the price chart's geometry. Corrected after
	 * `@security-auditor` and `@code-reviewer` both measured it — the false half
	 * was also the premise under which `PhoneResolverRows`' server-side throw
	 * looked unreachable.
	 */
	details: ReactNode;
}) {
	const router = useRouter();
	const { market, posts } = model;
	const marketOpen = market.status === "Open";
	const heldSide = viewer?.position?.side ?? null;
	// D-52 R1 — the viewer's own posts, from the viewer-scoped read (post ids
	// only). On one of them the card pills and the bar's Support/Counter render
	// disabled, and `openReply` — the one door every reply sheet opens through —
	// refuses it: nobody replies to their own post.
	const ownPostIds = viewer?.ownPostIds ?? NO_OWN_POSTS;

	/**
	 * ⚠ THE FOCUSED POST IS RESOLVED AGAINST THE MODEL, NOT TRUSTED FROM THE
	 * PROP. `page.tsx` already checked that the target exists and is not removed,
	 * but a lookup that returns `undefined` must fall back to the feed rather
	 * than render a thread with no subject — the zero-branch law the `?post=`
	 * contract holds everywhere else.
	 */
	const focused = posts.find((post) => post.id === initialPostId) ?? null;

	/**
	 * ⛔ TYPED TO THEIR LITERAL UNIONS, and the cast that used to bridge them is
	 * gone. These were `useState<string>` with an `as Side` at the two sites that
	 * hand a side to `BetComposer` — correct only by the coincidence of two files
	 * agreeing on a pane key, with `tsc` green if either drifted. AGENTS.md §4
	 * admits an `as` cast at a trust boundary; this IS the boundary where a
	 * string becomes a POLE, which is the one place it must not be used. The
	 * narrowing happens once, at the seam where the DOM value arrives.
	 */
	const [activeSide, setActiveSide] = useState<Side>("YES");
	const [threadRelation, setThreadRelation] = useState<"support" | "counter">(
		"support",
	);
	const onSideKey = useCallback((key: string) => {
		if (key === "YES" || key === "NO") {
			setActiveSide(key);
		}
	}, []);
	const onRelationKey = useCallback((key: string) => {
		if (key === "support" || key === "counter") {
			setThreadRelation(key);
		}
	}, []);
	// The reset lives at the TAP callsite, never in onSideKey. onSideKey is
	// also the snap track's onActiveChange, and setActiveSide has a third
	// writer at the posted-card jump, which does its own region.scrollTo.
	// Keying a reset on activeSide fires on a swipe and destroys that jump.
	const resetRegionToTop = useCallback(() => {
		scrollRegionRef.current?.scrollTo({ top: 0, behavior: "auto" });
	}, []);
	const onSideTap = useCallback(
		(key: string) => {
			onSideKey(key);
			resetRegionToTop();
		},
		[onSideKey, resetRegionToTop],
	);
	const onRelationTap = useCallback(
		(key: string) => {
			onRelationKey(key);
			resetRegionToTop();
		},
		[onRelationKey, resetRegionToTop],
	);
	// ⛔ A SLIDE IS A TAP THE READER MADE WITH A FINGER, and it lands in the same
	// place. The reset cannot move INTO `onSideKey`: that callback is also how the
	// track CONFIRMS a slide the host asked for, and the posted-card jump sets the
	// side first, then scrolls to its own card. So the rule is a comparison, not a
	// flag — reset only when the ARRIVING pane is one the state had not reached.
	const activeKeyRef = useRef<string>(activeSide);
	activeKeyRef.current = focused === null ? activeSide : threadRelation;
	const onSideSlide = useCallback(
		(key: string) => {
			const reached = activeKeyRef.current === key;
			onSideKey(key);
			if (!reached) {
				resetRegionToTop();
			}
		},
		[onSideKey, resetRegionToTop],
	);
	const onRelationSlide = useCallback(
		(key: string) => {
			const reached = activeKeyRef.current === key;
			onRelationKey(key);
			if (!reached) {
				resetRegionToTop();
			}
		},
		[onRelationKey, resetRegionToTop],
	);
	const [sheet, setSheet] = useState<PhoneSheetState>(null);

	/**
	 * RI-4 / O-n — tell the poll a sheet is open. `DebatePoll` lives in the
	 * DESKTOP tree, which is this tree's sibling rather than its parent, so there
	 * is no prop path between them; the store is the seam. See
	 * `composer-open-store.ts` for why it is a store and not a context.
	 *
	 * ⛔ THE CLEANUP IS THE WHOLE SAFETY ARGUMENT. Publishing `true` from a
	 * handler and `false` from another handler would leave the flag stuck on any
	 * path that closes a sheet by unmounting rather than by calling the handler —
	 * a navigation, an error boundary, React discarding the tree — and a stuck
	 * `true` silently stops the surface refreshing for the rest of the session,
	 * with no symptom but stale prices. Published from an effect, the release is
	 * React's job rather than mine.
	 */
	useEffect(() => {
		// ⚠ A COMPOSER, NOT ANY SHEET. SPEC.1 §9 suspends the poll "while any bet
		// composer is open on the surface", and the acceptance case is named
		// `debate-view::poll-suspends-while-hidden-or-composer-open`. Two of this
		// tier's four sheet shapes — `details` and `parent` — are read-only
		// screens with nothing to lose, and the details sheet is the one carrying
		// the PRICE CHART. Publishing `sheet !== null` froze the chart for as long
		// as somebody read it, which is both a worse product and a divergence from
		// a ratified sentence. Caught by `@security-auditor`.
		// ⚠ AN EXCLUSION, NOT AN ALLOWLIST. Naming the two composer kinds makes a
		// future composer-bearing shape fail OPEN — the poll would refresh under
		// a draft, which is the exact harm this suspend exists to prevent. Naming
		// the two READ-ONLY kinds fails closed instead: an unrecognised shape
		// suspends, and the worst case is a refresh that does not happen.
		// (`@code-reviewer`.)
		const composerOpen =
			sheet !== null && sheet.kind !== "details" && sheet.kind !== "parent";
		setPhoneSheetOpen(composerOpen);
		return () => setPhoneSheetOpen(false);
	}, [sheet]);

	/** P2 terminal reached this session — mirrors `DebateView.tsx:155`. */
	const [suspended, setSuspended] = useState(false);
	/** Mirrors `DebateView.tsx:160`; see `PhoneSheet` for what it shuts. */
	const [composerBusy, setComposerBusy] = useState(false);

	/**
	 * D-8 — THE BACK GESTURE IS THE PRIMARY NAVIGATION ON A PHONE, and it used to
	 * leave a sheet floating over the wrong screen. The arm is derived from a
	 * server prop, so a browser Back out of `?post=` re-renders the feed — but
	 * `sheet` is client state and survived, leaving a reply composer open and
	 * still addressed to a post the reader had just left. Keying on the arm's
	 * own identity covers Back, Forward and a deep link equally, and needs no
	 * `popstate` listener to do it: if the page the sheet was opened over is
	 * gone, so is the sheet.
	 */
	const armWhenSheetLastReset = useRef(initialPostId);
	useEffect(() => {
		// ⚠ COMPARED, NOT MERELY DEPENDED ON. An effect keyed on the arm alone also
		// fires on mount, which would close a sheet nobody has opened — harmless
		// today and exactly the kind of thing that stops being harmless when a
		// future arm seeds one. The ref makes "the arm CHANGED" the condition.
		if (armWhenSheetLastReset.current === initialPostId) {
			return;
		}
		// ⛔⛔ THE SEVENTH HOST TRANSITION, AND IT OBEYS THE SAME INTERLOCK AS THE
		// SIX ABOVE. `@security-auditor` found this as a HIGH and the path is a
		// DOUBLE CHARGE, not a cosmetic one: the reader taps PLACE Đ BET, the
		// request is in flight, and they then perform the iOS left-edge back
		// swipe — on a surface whose entire idiom is horizontal swiping. Without
		// this check the arm changes, the sheet unmounts, `BetComposer` goes with
		// it, and its cleanup reports `busy: false`. There is no AbortController,
		// so the request lands and COMMITS; `onPosted` never runs, so the reader
		// sees no trace of the bet they just paid for. They open a new composer —
		// which mints a FRESH idempotency key, one per intent — and submit again.
		// `bet_receipts`' UNIQUE is on the key, so the durable backstop cannot see
		// that these are the same intent. Two bets, two comments, two charges.
		//
		// ⚠ AND THE BOOKKEEPING MUST NOT ADVANCE EITHER. Returning early while
		// leaving `armWhenSheetLastReset` updated would record the arm as handled
		// and never close the stale sheet once the request lands. `composerBusy`
		// is a dependency so this re-runs the moment it clears — deferred, not
		// dropped.
		if (composerBusy) {
			return;
		}
		armWhenSheetLastReset.current = initialPostId;
		setSheet(null);
	}, [initialPostId, composerBusy]);
	/**
	 * ⛔⛔ THE FEED'S PLACE, ACROSS AN ARM CHANGE — BOTH HALVES, AND THEY PULL IN
	 * OPPOSITE DIRECTIONS.
	 *
	 * The bounded shell has ONE vertical scroller and it does not remount when
	 * the arm changes, which is what makes the reader's position survive at all —
	 * the pane-per-side model rebuilt its scroller on every arm change and lost
	 * it. But the same persistence is wrong in the other direction: a reader
	 * scrolled 1 200px down the feed who taps a post must land at the TOP of that
	 * post, not 1 200px into a thread they have never seen. Under the
	 * document-scroll model the browser did this; `DebateView`'s `resetPageScroll`
	 * is the desktop half and is unreachable here (its tree is
	 * `max-mobile:hidden`), and `window.scrollTo` is a no-op on a page that does
	 * not scroll. Found by `@code-reviewer`; the round-trip half was measured
	 * (feed 400 → back 400) and the entry half was not.
	 *
	 * ⇒ On an arm change: remember where the FEED was, put the region at the top,
	 * and on the way back put the feed where it was. Keyed on the arm's own
	 * identity, exactly as the sheet reset above is, so Back, Forward and a deep
	 * link are all covered without a `popstate` listener.
	 * ⚠ A LAYOUT EFFECT, so the write lands before the browser paints — in a
	 * passive effect the reader sees one frame of the old position in the new arm.
	 */
	const scrollRegionRef = useRef<HTMLDivElement>(null);
	const feedScrollTopRef = useRef(0);
	const armWhenScrollLastMoved = useRef(initialPostId);
	useLayoutEffect(() => {
		if (armWhenScrollLastMoved.current === initialPostId) {
			return;
		}
		const leavingFeed = armWhenScrollLastMoved.current === null;
		const region = scrollRegionRef.current;
		armWhenScrollLastMoved.current = initialPostId;
		if (region === null) {
			return;
		}
		if (leavingFeed) {
			// ⛔ DO NOT SAVE A POSITION READ THROUGH A LOCK. While a sheet is open
			// `scroll-lock.ts` holds this element at `overflow: hidden`, and an
			// engine that clamps `scrollTop` on that transition answers 0 — so a
			// save taken here would record the feed as being at the top and the
			// reader's place would be gone for the session. The lock's own capture
			// is the authority in that window; the previous saved value is left
			// alone. `@security-auditor` found it.
			if (region.style.overflowY !== "hidden") {
				feedScrollTopRef.current = region.scrollTop;
			}
			region.scrollTop = 0;
			return;
		}
		// Returning to the feed — or moving between two posts, where the top is
		// still the right answer and the remembered feed position is not consumed.
		/**
		 * ⚠ RETURNING TO THE FEED RESTORES ONLY PARTIALLY, AND THE MECHANISM THAT
		 * WOULD FIX IT WAS BUILT, MEASURED, AND REMOVED.
		 *
		 * Entering a post works: the feed's position is saved and the region goes
		 * to the top, which is where a post must open. Coming back does not fully
		 * work — measured, a feed parked at 400 returns at **171**, and 171 is not
		 * a coincidence: it is the THREAD's maximum scroll. A back gesture is a
		 * soft navigation, so the arm prop flips before the feed's payload
		 * replaces the thread's children, and this write lands against the old,
		 * shorter content and is clamped.
		 *
		 * ⛔ TWO FIXES WERE TRIED AND BOTH MEASURED IDENTICAL (400 → 171): a
		 * single next-frame retry, and a twelve-frame bounded poll that stopped on
		 * success, on a finger, or on running out. The payload simply arrives
		 * later than 200ms here. ⇒ They are REMOVED rather than kept, because a
		 * mechanism that does not achieve what its docblock says it achieves is
		 * worse than an acknowledged gap — and thirty lines of frame-polling on
		 * the one tier that forbids scroll handlers is not a thing to carry on
		 * faith. `docs/parked.md` 2d-10 carries what would actually close it
		 * (keying the restore on the payload's arrival rather than on the arm).
		 *
		 * ⚠ FOR SCALE: the document-scroll model this replaces restored a feed
		 * parked at 400 to **128**, via the browser's own scroll restoration. So
		 * this is not a regression against what ships today; it is an
		 * imperfection that was already there, now visible because it is ours.
		 */
		region.scrollTop = initialPostId === null ? feedScrollTopRef.current : 0;
	}, [initialPostId]);

	const [popupPost, setPopupPost] = useState<PresentPost | null>(null);
	const [popupReply, setPopupReply] = useState<PresentReply | null>(null);
	const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
	const [detailsMounted, setDetailsMounted] = useState(false);

	/**
	 * ⛔⛔ MIRRORS `DebateView`'s `onPosted` (`:291`) IN FULL — AND THIS LINE
	 * PREVIOUSLY ARGUED THAT IT COULD NOT, WHICH WAS TRUE UNTIL THIS ROUND.
	 *
	 * It read: "the desktop also stores `{commentId, fromModel}` so its scrollers
	 * can jump to the new card once the refreshed payload lands; this tree
	 * registers no scroller, so carrying that state would be a note-to-self
	 * nothing ever reads." The premise was right and the conclusion has expired:
	 * the receipt was dropped because nothing consumed it, and MOBILE-2l gives it
	 * a consumer — the jump below. What made the desktop's state useless here was
	 * never the state, it was the absence of anything to point at.
	 *
	 * ⚠ THE REFRESH STILL **REPLACES** THE DESKTOP'S RATHER THAN ADDING TO IT —
	 * at any one width exactly one of the two trees is interactive, so the
	 * two-refresh budget `posted-refresh-budget.test.tsx` pins is unchanged.
	 *
	 * ⛔ THE ID COMES FROM THE BET RESPONSE AND FROM NOWHERE ELSE.
	 * `BetComposer.tsx:413` calls this with the receipt's `commentId`. "The newest
	 * post in the market" would be a race: another author's post landing in the
	 * gap between this submit and this refresh would be pinned as the viewer's
	 * own. The id is the only thing that makes the card THEIRS.
	 */
	const [posted, setPosted] = useState<{
		commentId: string;
		fromModel: DebateViewModel;
	} | null>(null);

	const onPosted = useCallback(
		({ commentId }: { commentId: string }) => {
			setPosted({ commentId, fromModel: model });
			setSheet(null);
			router.refresh();
		},
		[model, router],
	);

	/**
	 * ⛔⛔ MOBILE-2l · R-2 — THE JUMP, AND IT IS THE DESKTOP'S, NOT A SECOND ONE.
	 *
	 * These three expressions are `DebateView.tsx:940-956` transcribed: the same
	 * `landed` test, the same `findPostedNode`, the same side derivation. They
	 * are not "like" the desktop's — they call the same function, so masking,
	 * fail-closed narrowing and the reply/post split cannot drift between the two
	 * trees.
	 *
	 * ⛔⛔ AND THE BRIEF'S DESCRIPTION OF WHAT THE DESKTOP DOES IS NOT WHAT THE
	 * DESKTOP DOES — this is the correction the whole item turns on. Round eight
	 * asked for "the viewer's fresh post at the top of the feed with a just-now
	 * treatment, pinned, later taking its ranked place". Measured, the desktop
	 * holds NO pin, NO marker and NO treatment, and its own docblock says so
	 * (`DebateView.tsx:930`: "NOTHING IS HELD BY ANY OF THIS … the card that
	 * appears is the column's ordinary card in its true ranked position"). The
	 * feed is never reordered: `buildTopList` is the ranked spine plus the latest
	 * interleave, so a fresh post lands where its score puts it.
	 *
	 * ⇒ WHY THE FOUNDER NONETHELESS SEES IT AT THE TOP, AND WHY THAT READING IS
	 * RIGHT. The desktop column is PAGED — `usePagedColumn` renders exactly one
	 * post (`scrollers.tsx:326`, `posts[index]`) — and the jump sets `index` to
	 * the posted card. So after a bet the author's own argument IS the card the
	 * column shows. "At the top of the feed" describes a paged column exactly;
	 * there is simply no pin underneath it to copy.
	 *
	 * ⇒ THE PHONE'S FAITHFUL ANALOGUE OF "index = the posted card" IS "scroll the
	 * feed region until that card's top is the region's top". A blind
	 * `scrollTo({top: 0})` was the brief's literal instruction and is REJECTED on
	 * this measurement: the card is not first in a ranked list, so scrolling to
	 * zero would show the author somebody else's post and call it their own.
	 * The instruction's INTENT — the author sees their argument when the sheet
	 * closes — is what is built.
	 *
	 * ⚠ THE SIDE IS THE COMMENT'S OWN, never the composer's column: a composer
	 * opens on the pane opposite the side being bet, so using it would switch the
	 * reader to the wrong pole and hide the very card this exists to show.
	 *
	 * ⚠ ONE-SHOT, KEYED ON THE COMMENT ID — the desktop's `pickedFor` guard
	 * (`:983`) and the scroller's `jumped.current` (`scrollers.tsx:139`) are the
	 * same mechanism. Without it every subsequent payload — DebatePoll's 30s
	 * refresh, a `PhoneTopPill` refresh — would re-take the pane and re-scroll a
	 * reader who had moved on. A SECOND bet carries a different id and re-arms it,
	 * which is why the ref holds the id rather than a boolean.
	 *
	 * ⚠ `posted` IS NEVER CLEARED, exactly as on the desktop: clearing it would
	 * make the jump depend on effect ORDERING between this component and the
	 * track, which is a property neither can keep.
	 *
	 * ⛔⛔ A REPLY PLACED FROM THE **FEED** ARM GETS NO JUMP, DELIBERATELY, AND
	 * THIS IS AN OPEN RULING RATHER THAN AN OVERSIGHT. Found by `@test-writer`.
	 * A `PostCard`'s Support/Counter triggers open a reply composer WITHOUT
	 * entering the post, so `focused` is `null` and `findPostedNode` — which
	 * searches `parent.replies` and returns `null` for a null parent — cannot
	 * resolve it. The desktop never meets this case: there the same trigger
	 * ENTERS the post first, so its `selectedPost` is always the reply's parent.
	 *
	 * ⇒ SILENCE IS CHOSEN OVER AN INVENTED SEMANTICS, for two reasons and not
	 * because it is easier. First, the feed pane renders only TOP-LEVEL posts, so
	 * a reply has no card there to scroll to — "show the author their argument"
	 * has no referent on this arm. Second, the reply's own side is frequently the
	 * OPPOSITE pole from its parent's (that is what a Counter reply is), so
	 * switching to it would carry the reader away from the post they were reading
	 * to a pane that does not contain their reply either. Both available
	 * behaviours are worse than none.
	 * ⚠ It is also not a regression: nothing jumped here before this round. R-2
	 * asks for "your own POST at the top after you bet", and that is what is
	 * built; the reply case is unspecified and is flagged for a ruling rather
	 * than settled here.
	 *
	 * ⛔⛔ `setActiveSide` HERE IS AN EIGHTH HOST MUTATION AND IT DELIBERATELY DOES
	 * NOT CONSULT `composerBusy` — and that is an exception to this file's own
	 * stated rule, so the property that makes it safe is written down rather than
	 * left to be rediscovered. `@security-auditor` (L-1). It IS reachable: bet 1
	 * submits, the sheet closes, the reader opens a SECOND composer, and bet 1's
	 * payload lands underneath it.
	 * ⇒ WHAT KEEPS IT SAFE IS THAT `sheet.side` IS INDEPENDENT OF `activeSide`.
	 * `BetComposer`'s `key` and its `side` prop both read `sheet.side`, which is
	 * frozen at `setSheet` time — so moving `activeSide` cannot remount the
	 * composer, cannot mint a fresh idempotency key, and cannot fire
	 * `onBusyChange(false)` under an in-flight request. ⚠ THE DAY ANYONE MAKES
	 * `sheet.side` DERIVE FROM `activeSide`, THIS BECOMES A DOUBLE-CHARGE DOOR and
	 * must move behind `guard()`.
	 * ⚠ It is not routed through `guard()` today because `guard` DROPS an action
	 * rather than deferring it, which would lose the side switch entirely and
	 * leave the reader looking at the wrong pole with no card. The residue is
	 * cosmetic and bounded: the bottom bar can read `Bet NO` where the reader left
	 * `Bet YES`.
	 *
	 * ⚠ A JUMP CAN ARRIVE ONE NAVIGATION LATE, AND IT THEN OVERWRITES THE FEED'S
	 * RESTORED POSITION. `@security-auditor` (L-3). If the reader enters a post
	 * before the payload lands, the guard above defers the jump WITHOUT spending
	 * it; on the way back the arm-change layout effect restores
	 * `feedScrollTopRef` and this effect then scrolls to the posted card instead.
	 * `feedScrollTopRef` is not corrupted — it is discarded. Deterministic, once
	 * per bet, and the outcome (landing on your own argument) is the one this
	 * whole item exists to produce; recorded because the timing claim below
	 * ("only fires on a payload landing after a bet") does not otherwise cover it.
	 *
	 * ⚠ `PhoneTopPill` IS A SECOND WRITER OF THIS SAME SCROLLER (MOBILE-2k · F-1)
	 * — it takes `regionRef` and calls `scrollTo({top: 0, behavior: "smooth"})`.
	 * The two cannot both be in flight from one gesture: the pill only fires on a
	 * tap, and this only fires on a payload landing after a bet, which closes the
	 * sheet the pill is hidden behind. If they ever do race, the LAST write wins
	 * and the reader is at the top rather than at their card — a degraded
	 * outcome, not a broken one. Noted because it is the kind of coupling that
	 * stops being harmless the moment either side grows a timer.
	 */
	const landed = posted !== null && model !== posted.fromModel ? posted : null;
	const postedNode =
		landed !== null
			? findPostedNode({
					posts,
					parent: focused,
					commentId: landed.commentId,
				})
			: null;
	const jumpSide: Side | null =
		postedNode === null
			? null
			: postedNode.kind === "post"
				? postedNode.post.sideAtPostTime
				: postedNode.reply.side;

	const jumpedFor = useRef<string | null>(null);
	useEffect(() => {
		if (landed === null || jumpSide === null) {
			return;
		}
		// ⛔⛔ THE FEED ARM ONLY, AND THIS GUARD IS NOT BELT-AND-BRACES — WITHOUT IT
		// A THREAD-ARM REPLY SILENTLY FLIPS THE FEED'S POLE. Found by
		// `@code-reviewer`. On the thread arm `focused` is set, so
		// `findPostedNode` DOES resolve a reply and `jumpSide` is that reply's own
		// side — which for a Counter reply is the OPPOSITE pole from the post being
		// read. The effect would then set `activeSide`, a value this arm never
		// displays (the tabs here are Support/Counter), find no card to scroll to
		// because the thread panes render `ReplyCard`s and carry no
		// `data-phone-post-id`, and return. Nothing visible happens — until the
		// reader taps Back and lands on a side they did not choose.
		// ⚠ AND IT WOULD HAVE SPENT THE SHOT DOING IT. `jumpedFor` is stamped
		// before the scroll, so the same comment could never jump again; a reader
		// who replied from the thread and then returned to the feed had already
		// used up the one jump that comment was owed. Returning BEFORE the stamp is
		// what keeps the shot unspent.
		// ⚠ The arm is the right axis rather than the card's presence: this is the
		// only arm that HAS a feed to bring a card to the top of.
		if (focused !== null) {
			return;
		}
		if (jumpedFor.current === landed.commentId) {
			return;
		}
		jumpedFor.current = landed.commentId;
		setActiveSide(jumpSide);
		const region = scrollRegionRef.current;
		if (region === null) {
			return;
		}
		// ⚠ BOTH PANES ARE ALWAYS MOUNTED (`PhoneFeedTrack` maps every pane), and
		// the vertical scroller sits ABOVE the horizontal track — so the card's
		// vertical offset does not depend on which side is showing, and this read
		// is correct in the same tick as the side switch rather than a frame later.
		// ⚠ COMPARED AS AN ATTRIBUTE, NOT INTERPOLATED INTO A SELECTOR. The obvious
		// spelling is `querySelector('[data-phone-post-id="' + id + '"]')`, which
		// needs `CSS.escape` to be safe — and `CSS` is UNDEFINED in this repo's
		// jsdom, so the first cut threw `Cannot read properties of undefined
		// (reading 'escape')` inside an effect and took every R-2 guard down with
		// it. Found by `@test-writer`'s suite on its first run. Reading the
		// attribute back needs no escaping and no global, so it is correct in both
		// environments rather than correct in one and fatal in the other.
		const card =
			[...region.querySelectorAll("[data-phone-post-id]")].find(
				(el) => el.getAttribute("data-phone-post-id") === landed.commentId,
			) ?? null;
		if (card === null) {
			return;
		}
		// ⛔ THE REGION, NEVER `window`. The shell is bounded; the document does
		// not scroll, so `window.scrollTo` is a no-op here — the same reason
		// `DebateView`'s `resetPageScroll` is unreachable in this tree.
		const top =
			region.scrollTop +
			(card.getBoundingClientRect().top - region.getBoundingClientRect().top);
		region.scrollTo({ top });
	}, [landed, jumpSide, focused]);

	/**
	 * ⛔⛔ EVERY HOST TRANSITION CONSULTS `composerBusy`, NOT JUST THE CLOSE —
	 * and shipping only the close was a real double-charge door, found by
	 * `@code-reviewer` and `@security-auditor` independently.
	 *
	 * `PhoneSheet` shuts the three doors IT owns (`×`, Escape, backdrop) and the
	 * first cut of this file left the six the HOST owns wide open. The desktop
	 * guards exactly these — `toggleEntry` (`DebateView.tsx:270`),
	 * `toggleFocusMode` (`:277`), `enterPost` (`:634`), `replyToPost` (`:673`),
	 * `exitPost` (`:696`) and the `popstate` listener (`:858`) — each with
	 * `if (composerBusy) return`, under the rule at `:155-159`.
	 *
	 * ⚠ THE MECHANISM, because "it unmounts the composer" understates it.
	 * `BetComposer`'s `key` here carries `kind`, `parentCommentId` and `side`, so
	 * a `setSheet` that changes any of them REMOUNTS it. A fresh instance mints a
	 * fresh idempotency key at mount, the in-flight `fetch` has no
	 * `AbortController`, and the unmount fires `onBusyChange(false)` — so the
	 * first request still commits server-side while the host has stopped
	 * believing anything is in flight, and the resubmit carries a key
	 * `bet_receipts`' UNIQUE cannot dedupe. One intent, two bets, two charges.
	 *
	 * ⚠ IT WAS REACHABLE BY KEYBOARD ALONE. The backdrop blocks the pointer, but
	 * the background controls stayed in the tab order — on the thread arm the
	 * other relation button is one Tab from the submit. The focus containment in
	 * `PhoneSheet` closes that half; this closes the half that does not depend on
	 * focus behaviour at all.
	 */
	const guard = useCallback(
		(fn: () => void) => {
			if (composerBusy) {
				return;
			}
			fn();
		},
		[composerBusy],
	);

	const closeSheet = useCallback(() => {
		guard(() => setSheet(null));
	}, [guard]);

	const openReply = useCallback(
		(parent: DebatePost, relation: "support" | "counter") => {
			if (ownPostIds.includes(parent.id)) {
				return;
			}
			guard(() => {
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
			});
		},
		[guard, ownPostIds],
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
			guard(() => {
				const target = posts.find((post) => post.id === postId);
				if (target === undefined) {
					return;
				}
				router.push(
					`/m/${encodeURIComponent(market.slug)}?post=${target.ordinal}`,
				);
			});
		},
		[posts, router, market.slug, guard],
	);

	const openDetails = useCallback(() => {
		guard(() => {
			setDetailsMounted(true);
			setSheet({ kind: "details" });
		});
	}, [guard]);

	const pricing = market.pricing;
	/**
	 * ⛔⛔ THE TABS NO LONGER CARRY A POLE, BY FOUNDER RULING (Q1-a, ADR-0051 A2
	 * D-4(v)). They used to resolve one here — `bg-yes text-no` for YES and
	 * `bg-no text-yes` for NO — and the YES arm was the problem: `--color-yes` is
	 * `#181818` and so is the page ground, so an active YES tab painted in its
	 * own pole was invisible and read as "no tab is selected". A 2px ring was
	 * added to rescue it, which made the selected state a fill on one side and a
	 * ring on the other.
	 * ⇒ The active tab is now a white fill with black text on BOTH sides, so the
	 * selected state is one shape. The pole binding is untouched everywhere it
	 * carries meaning — side badges, split bars, the bottom bar — and
	 * `PhoneSideTabs` owns the single style, so there is no per-side value left
	 * for an edit to get backwards.
	 */
	const feedTabs = (["YES", "NO"] as const).map((side) => ({
		key: side,
		label: side,
		trailing: pricing === null ? "—" : formatPricePercent(pricing, side),
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
			/* ⛔⛔ MOBILE-2m · R-1 / ADR-0051 A9 D-1 — THE COLUMN GIVES UP ITS OWN
			   HORIZONTAL PADDING AND ITS GAP, AND BOTH ARE THE SAME DECISION.
			   The card kept `p-3` and this column dropped `px-3`, so the 24px of
			   DOUBLED inset becomes 12px carried once: the content box widens by
			   exactly 24px and the card's edges land on the screen's. That is what
			   makes the separator below full width without a negative margin — the
			   thing it separates already reaches the edge.
			   ⚠ THE GAP GOES BECAUSE A HAIRLINE IN THE MIDDLE OF ONE IS NOT A SEAM.
			   With `gap-2.5` the rule would float 10px away from the card above it
			   and 0px from the one below, reading as a rule belonging to the lower
			   post. At gap 0 the card's own `p-3` supplies 12px on each side of it
			   and the seam is symmetric. Vertical padding on the column is kept: it
			   is the distance from the tabs and from the bottom bar, not between
			   posts.
			   ⚠ THE EMPTY CTA TAKES THE PADDING BACK EXPLICITLY. It is the one child
			   here that is not a full-bleed card, and a centred call to action
			   running into both screen edges is not what A9 D-1 rules. */
			<div className="flex flex-col pt-2.5 pb-[140px]">
				{sidePosts.length === 0 ? (
					<div className="px-3">
						<EmptySideCTA side={side} />
					</div>
				) : null}
				{sidePosts.map((post) => (
					/* ⛔ MOBILE-2l · R-2 — THE ANCHOR THE JUMP RESOLVES AGAINST, and it
					   is a WRAPPER rather than an attribute on `PostCard` because
					   `PostCard` is shared with the desktop tree and this round's wall is
					   a desktop diff of exactly nothing. The wrapper is a phone-tree leaf,
					   so it cannot reach 1440 at all.
					   ⚠⚠ IT IS LAYOUT-INERT, AND THE FIRST VERSION OF THIS SENTENCE GAVE
					   THE WRONG REASON FOR IT. It read "`PostCard`'s root declares no
					   `flex-1` and no `self-*`" — `PostCard.tsx:122` is
					   `<Card className="min-h-0 flex-1 …">`, so the card DOES carry
					   `flex: 1 1 0%` and the re-parenting does change its status: it stops
					   being a flex item of the feed column and becomes a block child of
					   this div, where `flex-1` names nothing at all. Found by
					   `@code-reviewer`.
					   ⇒ THE CONCLUSION SURVIVES ON A PROPERTY OF THE CONTAINER, not of the
					   card. The feed column is a block-level child of the pane with
					   `height: auto`, so its main size is indefinite: `flex-basis: 0%`
					   resolves as `content` and `flex-grow` has no free space to
					   distribute. `flex-1` was ALREADY inert in that container — which is
					   why nothing moves — and it would stop being inert the moment anyone
					   gave the feed column a definite height.
					   ⚠ AND THE CITED MEASUREMENT DID NOT COVER IT EITHER. This said
					   "measured either way in this round's B1/B2 pass", whose fingerprints
					   are at 1440 and 640 — widths at which this whole subtree is
					   `display:none`. Re-measured at **360**, ground against tip: both
					   cards at `(11.99, 187.86, 336.02, 308.29)` and
					   `(11.99, 506.15, …)`, column height `776.582px` on both, identical to
					   the hundredth of a pixel.
					   ⚠ AND IT CARRIES THE ID, NOT THE INDEX. An index would couple the
					   scroll to `sidePosts`' ordering and break the first time the empty
					   CTA or a ranked re-order moved a row; the comment id is the same key
					   the receipt carries. */
					/* ⛔ MOBILE-2m · R-1 — AND THE SEAM LIVES ON THE WRAPPER, NOT ON
					   THE CARD. A9 D-1 says the card carries no border of its own; a
					   `border-b` written onto the card would be exactly that, and the
					   next reader would have to hold two contradictory sentences at
					   once. This element is a phone-tree leaf that already exists for
					   the R-2 jump anchor, it spans the full column width, and a rule
					   on it is unambiguously a SEPARATOR between two posts rather than
					   an edge belonging to either.
					   ⚠ `last:` DROPS THE TRAILING ONE. "Separated by" is a relation
					   between two posts; a rule under the final card separates it from
					   nothing and would read as the feed having a floor it does not
					   have — the column continues into 140px of scroll runway. */
					<div
						key={post.id}
						data-phone-post-id={post.id}
						className="[border-bottom:var(--hairline)] last:[border-bottom:none]"
					>
						<PostCard
							post={post}
							unboxed
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
							isOwnPost={ownPostIds.includes(post.id)}
						/>
					</div>
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
					// ⚠ THESE TWO WERE ALREADY RIGHT, AND THAT IS THE ARGUMENT FOR
					// R-1 rather than a coincidence: a RELATION HAS NO POLE
					// (design-canon §3.2), so the thread tabs have always used the
					// neutral emphasis step. The founder's Q1-a ruling makes the feed
					// tabs match them, which is why the style moved INTO
					// `PhoneSideTabs` and neither call site names one now.
					{
						key: "support",
						label: "Support",
						trailing: String(focused.replies.support.length),
					},
					{
						key: "counter",
						label: "Counter",
						trailing: String(focused.replies.counter.length),
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
						postOrdinal={replyDownloadOrdinal(focused)}
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
						label: `Bet ${activeSide}`,
						side: activeSide,
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
		guard(() => {
			if (focused === null) {
				setSheet({ kind: "post", side: activeSide });
				return;
			}
			openReply(focused, key === "counter" ? "counter" : "support");
		});
	};

	return (
		/**
		 * ⛔⛔ MOBILE-2d — THE TIER IS A BOUNDED APP SHELL BELOW 640px, AND THE
		 * THREE TOKENS BELOW ARE THE WHOLE OF IT.
		 *
		 * `h-[calc(100dvh-60px-2px)]` + `flex-none` + `overflow-hidden` replace
		 * `flex-1`. Everything under this element already declared a bounded
		 * shell — the track is `min-h-0 flex-1`, the panes are `overflow-y-auto`
		 * — and none of it did anything, because nothing above gave the chain a
		 * top. `<main>`'s `min-h-[calc(100dvh-60px-2px)]` is a MINIMUM: every box
		 * grew to its content, `scrollHeight === clientHeight` on the pane
		 * forever, `overflow-y: auto` never engaged, and the DOCUMENT was the
		 * only scroller on the phone tier (measured, both engines, every market:
		 * pane `client 2587 / scroll 2587` against a document of 2 766).
		 *
		 * ⛔ `flex-none` IS NOT TIDINESS AND THIS ELEMENT'S NEIGHBOUR HAS ALREADY
		 * PAID FOR IT. `flex: 1 1 0%` sets `flex-basis: 0%`, and in a COLUMN flex
		 * container the basis IS the main size — it beats `height`, and a
		 * percentage basis against an indefinite parent resolves to `auto`, i.e.
		 * content. `(public)/layout.tsx` records the same change being tried on
		 * `<main>` at MOBILE-2b and measured: Chromium kept growing to content
		 * (the token was simply inert) and **WebKit resolved `<main>` to ZERO
		 * HEIGHT and painted a blank market page**. The difference here is that
		 * the height sits on the PHONE ROOT rather than on the shared `<main>`,
		 * and that `flex-none` stops the basis from winning.
		 *
		 * ⛔ `dvh`, NEVER `vh`. `vh` is the LARGE viewport: with a browser toolbar
		 * showing, `100vh` exceeds the window by the toolbar's height — and with
		 * `overflow: hidden` here and no document scroll, a bet bar pushed past
		 * the bottom is not merely off-screen, it is UNREACHABLE. The subtrahend
		 * is unchanged and is still the header's border-box written as its two
		 * shipped contributors: `60px` is `GlobalHeader`'s `h-[60px]` inner row,
		 * `2px` its `border-y`.
		 *
		 * ⛔ EVERY TOKEN IS `max-mobile:`-SCOPED. An unprefixed height here would
		 * be a desktop change on an element the desktop shares the page with, and
		 * `phone-scroll-model.test.ts` rejects one.
		 *
		 * ⛔⛔ AND THE STRIP'S `sticky top-[62px]` HAD TO GO WITH IT — IT IS NOT
		 * INERT UNDER THIS MODEL, IT IS ACTIVELY WRONG. This docblock said "inert,
		 * kept on purpose" until the 1440/639/360/375/430 box census measured it:
		 * `overflow: hidden` makes THIS element a scrollport, a `position: sticky`
		 * child resolves its offset against the nearest scrollport, and `top: 62px`
		 * then pushes the whole title-strip-and-tabs block **62px down inside the
		 * shell** — measured on every phone profile: strip `y 72 → 134`, tabs
		 * `y 126 → 188`, against a track still starting at `y 179`. Sixty-one
		 * pixels of the feed end up behind the tabs.
		 * ⇒ The offset existed to clear the page header while the DOCUMENT
		 * scrolled. The document does not scroll here any more and the block is
		 * simply the first row of this column, so `sticky top-[62px]` is deleted
		 * and `shrink-0` put in its place: in a bounded column a `flex 0 1 auto`
		 * row is shrinkable, and the one row that must never give up height to the
		 * feed is the one carrying the market question and the side tabs.
		 */
		<div
			data-testid="phone-debate-view"
			data-arm={focused === null ? "feed" : "thread"}
			className="hidden w-full min-w-0 max-mobile:flex max-mobile:h-[calc(100dvh-60px-2px)] max-mobile:min-h-0 max-mobile:flex-none max-mobile:flex-col max-mobile:overflow-hidden max-mobile:[touch-action:manipulation]"
		>
			{/* ⚠ THE STRIP AND THE TABS ARE ONE BLOCK, not two elements with two
			    offsets — and that was true when they were sticky and is still true
			    now that they are the shell's first row. A second positioned element
			    under the first would have to name the first's HEIGHT, which is set
			    by how many lines the market question wraps to, i.e. by the content,
			    i.e. by a number no class can know. One wrapper is what makes a
			    three-line question correct for free.
			    ⛔ MOBILE-2d DELETED `sticky top-[62px]` FROM THIS ELEMENT. See the
			    tier root's docblock for the measurement: with the root bounded and
			    `overflow: hidden`, the root IS the scrollport a sticky child
			    resolves against, and the 62px offset moved this block 62px down
			    over the feed instead of clearing a header it no longer sits under.
			    `z-30` stays — it is a flex item, so `z-index` applies — and it
			    still sits BELOW the header's reserved `z-40`
			    (`sticky-header.test.ts`). */}
			{/* ⛔⛔ MOBILE-2k — `relative` IS LOAD-BEARING AND IT IS THE ONLY CLASS
			    THIS ROUND ADDS TO AN EXISTING ELEMENT. `PhoneTopPill` sits `top-full
			    mt-3` below this block, which is how "12px under the YES/NO tabs"
			    becomes a structural distance rather than a guessed number: this
			    block's height is set by how many lines the market question wraps to,
			    so nothing else in the tree can name its bottom edge. `top-full`
			    resolves against the nearest POSITIONED ancestor, and there is NONE above
			    this element — `<body>` is `min-h-full flex flex-col` and static
			    (`src/app/layout.tsx`), so without this token the containing block is
			    the INITIAL one, i.e. the viewport. The pill would land 12px below the
			    bottom of the viewport, off screen, with no error anywhere. ⚠ This
			    comment said the ancestor "would be `<body>`"; `@code-reviewer` walked
			    the chain and found it static. Same conclusion, wrong mechanism named —
			    and a wrong mechanism is what a later reader reasons from.
			    ⚠ It does not change the stacking: `z-30` already made this element a
			    stacking context as a flex item, and `position: relative` is not a
			    containing block for `fixed` descendants (only a transform is), so
			    `PhoneSheet`'s full-viewport layer is untouched. */}
			<div className="relative z-30 shrink-0 bg-ground [border-bottom:var(--hairline)]">
				{focused === null ? (
					<PhoneTitleStrip
						title={market.title}
						thumbUrl={market.thumbImageUrl}
						expanded={sheet?.kind === "details"}
						onOpen={openDetails}
					/>
				) : (
					<PhoneTitleStrip
						title={focused.removed ? REMOVED_STUB_TEXT : focused.title}
						subtitle={market.title}
						backHref={`/m/${encodeURIComponent(market.slug)}`}
						expanded={sheet?.kind === "parent"}
						onOpen={() => guard(() => setSheet({ kind: "parent" }))}
					/>
				)}
				<PhoneSideTabs
					options={focused === null ? feedTabs : threadTabs}
					active={focused === null ? activeSide : threadRelation}
					onSelect={focused === null ? onSideTap : onRelationTap}
					panelIdFor={PANE_ID}
				/>
				{/* ⛔ MOBILE-2k · F-1 — THE FEED ARM ONLY, GATED AT THE MOUNT. The
				    bounded shell took pull-to-refresh away (the document no longer
				    scrolls below 640, so the browser's overscroll gesture has nothing
				    to fire from); this is its replacement. A thread is short and was
				    navigated INTO, so it gets none — and the gate being the MOUNT
				    rather than a test inside the component is what stops a future edit
				    from getting the arm backwards.
				    ⚠ `sheet !== null` IS THE LOCK, NOT AN APPROXIMATION OF IT. The
				    tier's only two lock holders are `PhoneSheet` and
				    `MarketPriceChartOverlay`, and the overlay is reachable only INSIDE
				    the details sheet — so every held lock on this tier is a sheet.
				    `PhoneTopPill` consults `isPageScrollLocked()` as well, at tap
				    time, for the day that stops being true. */}
				{focused === null ? (
					<PhoneTopPill
						regionRef={scrollRegionRef}
						locked={sheet !== null}
						busy={composerBusy}
					/>
				) : null}
			</div>

			{/* ⛔⛔ THE SCROLL REGION — ONE ELEMENT, AND IT IS THE WHOLE REASON THE
			    SIDEWAYS SWIPE STAYS RELIABLE IN A BOUNDED SHELL.
			    The vertical scroller sits ABOVE the horizontal snap track, never
			    inside it. Nested the other way — a scroller per pane, inside the
			    track — a swipe that follows a vertical scroll moved NOTHING in 15
			    of 40 trials on Chromium, across four different input paths; with
			    the scroller here it is 40 of 40, same machine, same session, with a
			    no-prior-scroll control at 10/10 in both. `PhoneFeedTrack`'s own
			    docblock carries the numbers.
			    ⚠ `min-h-0` because this is the `1fr` row of a bounded column and a
			    flex child's automatic minimum size is its content — without it the
			    shell does not bound anything and the document scrolls again.
			    ⚠ `overscroll-y-contain` is correct HERE and only here: this box
			    really scrolls, so a pan that reaches the end of the feed has
			    somewhere it would otherwise chain to. On a pane that could not
			    scroll the same token was the defect MOBILE-2d opened with.
			    ⚠ THE PRICE: one vertical position for both sides, and the shorter
			    side padded to the taller one's height. That is what the document
			    did before this change, so it is the status quo rather than a
			    regression — but it is the thing to revisit if per-side scrolling is
			    ever wanted, and it cannot be got by nesting. */}
			<div
				ref={scrollRegionRef}
				data-testid="phone-scroll-region"
				className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain"
			>
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
					active={focused === null ? activeSide : threadRelation}
					onActiveChange={focused === null ? onSideSlide : onRelationSlide}
				/>
			</div>

			<PhoneBottomBar
				market={market}
				actions={barActions}
				viewer={viewer}
				ownPseudonym={ownPseudonym}
				suspended={suspended}
				onEntry={onBarEntry}
				ownPost={focused !== null && ownPostIds.includes(focused.id)}
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
					onClose={closeSheet}
				>
					<div className="pb-3">
						<PostCard
							post={focused}
							// ⚠ `guard`-WRAPPED LIKE EVERY OTHER HOST TRANSITION. This was
							// the one `setSheet` in the file that was not, and it is
							// unreachable while busy today — `sheet` is a single
							// discriminated union, so a `parent` sheet and a live composer
							// are mutually exclusive states. But the rule this file states
							// at :255 is "EVERY host transition consults `composerBusy`",
							// and an exception that happens to be unreachable is the door a
							// future change opens without noticing. `@security-auditor`
							// (LOW).
							onEnter={() => guard(() => setSheet(null))}
							onOpenPopup={setPopupPost}
							onOpenImage={setLightboxUrl}
							onReplyToPost={(_id, relation) => {
								openReply(focused, relation);
							}}
							heldSide={heldSide}
							marketOpen={marketOpen}
							suspended={suspended}
							isOwnPost={ownPostIds.includes(focused.id)}
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
					// ⛔ NO HEIGHT PROP ANY MORE, AND ITS REMOVAL IS THE P0 FIX. This
					// site used to pass `fullHeight={viewer !== null}`, which made the
					// sheet the height of the viewport for exactly the readers who can
					// bet — so the backdrop they tap to dismiss it was behind the panel
					// and unreachable, and a sheet that would not close reads as a page
					// whose scrolling and tabs have died. `PhoneSheet` says what was
					// measured.
					// ⚠ `titleHidden` now also removes the frame's `×` (R-8): both
					// branches below open with their own heading AND their own close
					// control (`BetComposer.tsx:589`, `AuthGateSlot.tsx:28`), and the
					// frame was drawing a second one 51px above it with the identical
					// accessible name.
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

			{/* RI-5 / O-m — these three portal to `document.body`, i.e. OUT of the
			    subtree the 640px gate hides, so the tier they belong to has to travel
			    as data rather than as position. `dialogs.tsx` says why. */}
			<PostPopup
				post={popupPost}
				onClose={() => setPopupPost(null)}
				tier="phone"
				marketQuestion={market.title}
			/>
			<ReplyPopup
				reply={popupReply}
				onClose={() => setPopupReply(null)}
				tier="phone"
				postOrdinal={
					popupReply === null
						? null
						: replyDownloadOrdinal(parentOfReply(posts, popupReply.id))
				}
			/>
			<ImageLightbox
				url={lightboxUrl}
				onClose={() => setLightboxUrl(null)}
				tier="phone"
			/>
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
