"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { COMMENT_MAX_LENGTH } from "@/server/config/limits";

import { SideBadge } from "../badges";
import { formatDharma } from "../format";
import type { Side, ViewerMarketContext } from "../types";
import { AuthGateSlot } from "./AuthGateSlot";
import {
	COMPOSER_COPY,
	c2Sentence,
	overCapStrip,
	rateLimitedBanner,
	SUSPENDED_COPY,
} from "./copy";
import { type ComposerStatus, ErrorStrip } from "./ErrorStrip";
import { parseWireResponse } from "./envelope";
import {
	assessAmount,
	type ComposerKind,
	floorFor,
	isPositiveAmount,
} from "./gating";
import { ImageAttach, type ImageAttachState } from "./ImageAttach";
import { initialKeyState, type KeyState, reduceKey } from "./idempotency";
import { attachImage, IMAGE_OVERSIZE_MESSAGE } from "./image-attach";
import {
	composeWireBody,
	extendedMaxChars,
	isArgumentSubmittable,
	TITLE_MAX_CHARS,
} from "./payload";
import { createQuoteReader, type QuoteResult } from "./quote-reader";
import { buildPlaceRequest } from "./requests";
import { keyOutcomeFor, mapWireError } from "./state-map";

/**
 * Canon §6's counter format groups thousands (`158 / 2,200 · optional`), and
 * the mockup's own `fmt` uses this exact expression. `format.ts::groupInteger`
 * is the shipped sibling but is PRIVATE to a file outside this surface's
 * fence (`debate/format.ts` is `.3`'s, deny-list `D5`), so exporting it is
 * `H4`; the one-line regex is duplicated here rather than widening the fence.
 */
function groupCount(n: number): string {
	return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/**
 * The mockup's `sizeAmt()`: the stake field's width tracks its own content, in
 * `ch`, floored at 2 — which is what makes the glued `Đ` TRAVEL with the
 * digits instead of sitting at a fixed offset (d5's source comment: *"width
 * JS-managed: tracks content so Đ travels with the digits"*).
 *
 * ⚠ `field-sizing-content` (already shipped on `ui/textarea.tsx`) is the
 * CSS-native alternative and would be the `O-1` structural choice, but its
 * support is partial — where it is unsupported the field silently falls back
 * to its default size and the Đ stops travelling, with nothing to detect it.
 * The mockup's mechanism is deterministic and jsdom-observable; it is taken
 * deliberately, not by default.
 */
function stakeFieldWidth(value: string): string {
	return `${Math.max(2, value.length)}ch`;
}

/**
 * The `commentId` off the §4.4 success envelope's `data`, which
 * `parseWireResponse` deliberately leaves as `unknown`: the parser validates the
 * ENVELOPE, and the payload inside it is still the wire — a trust boundary.
 *
 * ⚠ Narrowed in `envelope.ts`'s own `Record<string, unknown>` idiom rather than
 * with a zod schema, because there is exactly ONE field to read and pulling a
 * validator onto the composer's success path for one string would cost more
 * than it guards. The `as` is a trust-boundary cast with this comment as its
 * pair (AGENTS.md §4).
 *
 * ⛔ EMPTY STRING IS NOT A COMMENT ID. `typeof id === "string"` alone would let
 * `""` through and send the host looking for a post that cannot exist, which
 * would land on the fallback anyway — but by accident rather than by rule.
 */
function readCommentId(data: unknown): string | null {
	if (typeof data !== "object" || data === null) {
		return null;
	}
	const id = (data as Record<string, unknown>).commentId;
	return typeof id === "string" && id.length > 0 ? id : null;
}

export function BetComposer(props: {
	marketId: string;
	slug: string;
	side: Side;
	kind: ComposerKind;
	viewer: ViewerMarketContext;
	parentCommentId?: string;
	/**
	 * Reply variant: the header verb `Support/Counter <author>'s argument`,
	 * rendered in the SAME span, at the same size and weight, as the fresh-post
	 * header (RPLY-1 · R4a). A REMOVED parent has no author at the type level
	 * (SG-3 masking) — pass `null` and the header falls back to the canon
	 * `Place your Đ BET` line (no copy invented, nothing leaked).
	 *
	 * ⚠ `postTitle` IS GONE, and it was removed rather than left unread. R4a
	 * dropped the subtitle that consumed it, so keeping the field would have
	 * meant a masked-or-not decision at the call site feeding a prop nothing
	 * renders — dead weight that still looks load-bearing. Less data crossing
	 * this boundary is also strictly safer: the parent's title no longer reaches
	 * the composer at all.
	 */
	replyContext?: {
		relation: "support" | "counter";
		authorPseudonym: string | null;
	};
	onClose: () => void;
	/**
	 * FEED-1 — THE BET COMMITTED. Fired instead of `onClose` on a 200, handing the
	 * host the one thing it needs to find the real post in the refreshed model.
	 *
	 * ⛔ REQUIRED, NOT OPTIONAL, DELIBERATELY. `onBusyChange` above is optional
	 * because a host that ignores it merely loses a guard; a host that ignored
	 * this one would swallow every successful bet's confirmation silently, on a
	 * path that only runs after a real submit and that no type would complain
	 * about. A missing required argument is a compile error (O-1: structural
	 * beats procedural).
	 *
	 * ⚠ IT CARRIES THE `commentId` AND NOTHING ELSE. `PlaceResult` is stored
	 * VERBATIM in `bet_receipts.result` for idempotent replay (ADR-0031), so its
	 * shape is load-bearing far beyond this call site — widening it to carry
	 * display fields is not a free edit, and is not needed: the host reads the
	 * post from the model, not from the receipt.
	 */
	onPosted: (result: { commentId: string }) => void;
	/** P2 terminal reached (Track A / banned): the view disables all entry controls. */
	onSuspended: () => void;
	/**
	 * In-flight mirror for the HOST's close/toggle paths (security-audit
	 * MEDIUM): every path that would unmount the composer mid-request —
	 * entry toggles, relation flips, post enter/exit — must no-op while a
	 * request is in flight, or a re-open mints a fresh key over a
	 * possibly-committing bet (the double-execution seam the receipts cannot
	 * cross). The composer's own ×/ESC are guarded internally.
	 */
	onBusyChange?: (busy: boolean) => void;
}) {
	const router = useRouter();
	const [title, setTitle] = useState("");
	const [extended, setExtended] = useState("");
	const [amount, setAmount] = useState(() => floorFor(props.kind));
	const [keyState, setKeyState] = useState<KeyState>(() => initialKeyState());
	const [status, setStatus] = useState<ComposerStatus>({ phase: "idle" });
	const [quote, setQuote] = useState<QuoteResult | null>(null);
	const [countdown, setCountdown] = useState<number | null>(null);
	const [retryLock, setRetryLock] = useState(0);
	const [suspendedKind, setSuspendedKind] = useState<
		"track_a" | "banned" | null
	>(null);
	const [authGate, setAuthGate] = useState(false);
	// Slice 5 — the optional image (sign → PUT → id in the payload).
	const [image, setImage] = useState<ImageAttachState>({ phase: "none" });

	const keyRef = useRef(keyState);
	keyRef.current = keyState;
	// Stable across renders (refs + setState only) — effect-safe to depend on.
	const dispatchKey = useCallback((event: Parameters<typeof reduceKey>[1]) => {
		const next = reduceKey(keyRef.current, event);
		keyRef.current = next;
		setKeyState(next);
		return next;
	}, []);

	const assess = assessAmount({
		kind: props.kind,
		amount,
		spendableToday: props.viewer.spendableToday,
	});
	const floorAbove = assess.composerDisabled;
	const argOk = isArgumentSubmittable(title);
	// The composed-length belt (cascade H-1): the extended budget SHRINKS when
	// the title grows after the textarea filled — maxLength never truncates an
	// existing controlled value, so the composed total can exceed the cap.
	// Gate here so composeWireBody can never throw past the in-flight lock.
	const composedOverflow =
		title.trim().length +
			(extended.trim().length === 0 ? 0 : extended.length + 2) >
		COMMENT_MAX_LENGTH;

	// Live To-win preview (§3.1): debounced buy quote on amount/side change;
	// over-cap input still previews — the route clamps and flags `clamped`.
	const reader = useMemo(() => createQuoteReader(), []);
	useEffect(() => () => reader.cancel(), [reader]);
	const quoteStake = isPositiveAmount(amount) ? assess.clampedAmount : null;
	useEffect(() => {
		if (quoteStake === null) {
			setQuote(null);
			reader.cancel();
			return;
		}
		reader.request(
			{ kind: "buy", slug: props.slug, side: props.side, stake: quoteStake },
			setQuote,
		);
	}, [reader, quoteStake, props.slug, props.side]);

	// P4 429 countdown: expiry re-enables submit under a FRESH key (F-1).
	useEffect(() => {
		if (countdown === null) {
			return;
		}
		if (countdown <= 0) {
			dispatchKey({ type: "COUNTDOWN_EXPIRED" });
			setCountdown(null);
			setStatus({ phase: "idle" });
			return;
		}
		const t = setTimeout(
			() => setCountdown((c) => (c === null ? null : c - 1)),
			1000,
		);
		return () => clearTimeout(t);
	}, [countdown, dispatchKey]);

	// Transient/gate-down lock: submit re-enables after retry_after (held key).
	useEffect(() => {
		if (retryLock <= 0) {
			return;
		}
		const t = setTimeout(() => setRetryLock((s) => s - 1), 1000);
		return () => clearTimeout(t);
	}, [retryLock]);

	// ESC closes (toggle-to-close family; the entry button + × are the others).
	// In-flight guarded (cascade L-6): closing mid-request would orphan a
	// possibly-committing bet behind a fresh-key re-open.
	const onCloseRef = useRef(props.onClose);
	onCloseRef.current = props.onClose;
	const inFlightNow = status.phase === "in_flight";
	const onBusyChangeRef = useRef(props.onBusyChange);
	onBusyChangeRef.current = props.onBusyChange;
	useEffect(() => {
		onBusyChangeRef.current?.(inFlightNow);
		return () => onBusyChangeRef.current?.(false);
	}, [inFlightNow]);
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape" && !inFlightNow) {
				onCloseRef.current();
			}
		};
		document.addEventListener("keydown", onKey);
		return () => document.removeEventListener("keydown", onKey);
	}, [inFlightNow]);

	const inFlight = status.phase === "in_flight";
	const errorState = status.phase === "error" ? status.state : null;
	const terminalLocked =
		errorState !== null &&
		(errorState.state === "p2_terminal_suspended" ||
			errorState.state === "p6_concluded" ||
			errorState.state === "p3_market_race" ||
			errorState.state === "p3_revise_blocked" ||
			errorState.state === "p3_protective_landing" ||
			// Cached-terminal belts lock until the next edit re-mints (mirrors
			// SellModule — audit informational reconciled).
			errorState.state === "p3_generic" ||
			errorState.state === "p3_image");
	const submitDisabled =
		inFlight ||
		floorAbove ||
		!argOk ||
		composedOverflow ||
		!assess.submitEnabled ||
		countdown !== null ||
		retryLock > 0 ||
		terminalLocked;

	/** Attach/remove changes the wire body (fingerprint!) — an EDIT by law. */
	const onPickImage = async (file: File) => {
		if (inFlight) {
			return;
		}
		onEdit();
		setImage({ phase: "attaching", name: file.name });
		const result = await attachImage({ file });
		if (result.kind === "attached") {
			setImage({
				phase: "attached",
				uploadId: result.uploadId,
				name: file.name,
			});
		} else if (result.kind === "rejected") {
			setImage({ phase: "error", message: result.message });
		} else {
			// No design-set heading exists for an attach failure — the affordance
			// renders the kit retry line alone (empty message skips the heading).
			setImage({ phase: "error", message: "" });
		}
	};
	const onRemoveImage = () => {
		if (inFlight) {
			return;
		}
		onEdit();
		setImage({ phase: "none" });
	};

	/** Every input change is an EDIT (key law) and clears a revise-class strip. */
	const onEdit = () => {
		if (inFlight) {
			return;
		}
		dispatchKey({ type: "EDIT" });
		if (
			errorState !== null &&
			(errorState.state === "p3_revise_blocked" ||
				errorState.state === "p3_protective_landing" ||
				errorState.state === "p3_generic" ||
				errorState.state === "p3_image")
		) {
			// Track B: submit re-enables once the text is edited (kit law);
			// the C1 landing's next edit is the NEW intent (F-2 — fresh key
			// already minted by the EDIT reducer arm after REFRESHED).
			setStatus({ phase: "idle" });
		}
	};

	async function submit() {
		if (submitDisabled) {
			return;
		}
		// Build the payload BEFORE taking the in-flight lock (cascade H-1): a
		// compose throw must land as a state, never a stuck lock.
		let wireBody: string;
		try {
			wireBody = composeWireBody({ title, extended });
		} catch {
			setStatus({
				phase: "error",
				state: { state: "p3_generic" },
				code: "compose_gate",
			});
			return;
		}
		const next = dispatchKey({ type: "SUBMIT" });
		setStatus({ phase: "in_flight" });
		const { url, init } = buildPlaceRequest({
			body: {
				marketId: props.marketId,
				side: props.side,
				stake: assess.clampedAmount,
				body: wireBody,
				...(props.parentCommentId !== undefined
					? { parentCommentId: props.parentCommentId }
					: {}),
				...(image.phase === "attached"
					? { imageUploadsId: image.uploadId }
					: {}),
			},
			idempotencyKey: next.key,
		});
		let outcome: Awaited<ReturnType<typeof parseWireResponse>>;
		try {
			const res = await fetch(url, init);
			outcome = await parseWireResponse(res);
		} catch {
			// Network failure: uncached — key HELD, manual retry legitimate.
			dispatchKey({ type: "OUTCOME", outcome: "transient" });
			setStatus({
				phase: "error",
				state: { state: "p3_transient_retry" },
				code: "network",
			});
			return;
		}
		if (outcome.kind === "success") {
			dispatchKey({ type: "OUTCOME", outcome: "success" });
			// ⛔ THE KEY LIFECYCLE IS SETTLED FIRST AND IS UNTOUCHED. Everything
			// below this line is presentation; everything above it is the money
			// path, and the order between them is not negotiable.
			//
			// ⚠⚠ FEED-1 — the host HOLDS the slot instead of closing it, so the
			// author sees the post they just made rather than watching it vanish
			// into a ranked column. The refresh moves to the host too: it is the
			// host that has to know when the new model landed, and firing one here
			// as well would be a second round trip for one bet.
			const commentId = readCommentId(outcome.data);
			if (commentId === null) {
				// ⚠ THE ENVELOPE WAS OK BUT ITS PAYLOAD WAS NOT READABLE. The bet is
				// COMMITTED — the 200 already said so — so this must never surface as
				// an error. It degrades to the exact pre-FEED-1 behaviour: refresh,
				// close, and the post lands in the column as it always did. SG-5
				// posture: unknown input renders a state, never a crash.
				router.refresh();
				props.onClose();
				return;
			}
			// ⚠⚠ FEED-2 — THE COMPOSER CLOSES NOW, exactly as it did before FEED-1.
			// The host is told which comment was made and closes the slot in the same
			// breath; when the refreshed payload lands it points the column on the
			// BET'S OWN SIDE at that card. Nothing is held open in between — FEED-1
			// held this composer mounted until the model arrived, and the panel that
			// replaced it was the shape the founder ruled wrong.
			props.onPosted({ commentId });
			props.onClose();
			return;
		}
		if (outcome.kind === "malformed") {
			const cls = outcome.status >= 500 ? "transient" : "terminal";
			dispatchKey({ type: "OUTCOME", outcome: cls });
			setStatus({
				phase: "error",
				state: { state: "p3_generic" },
				code: "malformed",
			});
			return;
		}
		dispatchKey({
			type: "OUTCOME",
			outcome: keyOutcomeFor({ kind: "error", code: outcome.code }),
		});
		const mapped = mapWireError({
			code: outcome.code,
			...(outcome.retryAfterSeconds !== undefined
				? { retryAfterSeconds: outcome.retryAfterSeconds }
				: {}),
		});
		setStatus({ phase: "error", state: mapped, code: outcome.code });
		switch (mapped.state) {
			case "p2_terminal_suspended":
				setSuspendedKind(outcome.code === "banned_user" ? "banned" : "track_a");
				break;
			case "p3_image":
				// §4: image codes land INLINE on the affordance; the attachment is
				// stale (orphan-swept object / real-byte oversize) — drop it so the
				// next attempt re-signs. FIXED client copy, never the bets-wire
				// message (it carries raw error-class diagnostics — audit LOW):
				// oversize → the sign route's own display string; object-missing →
				// the no-heading retry-line convention.
				setImage({
					phase: "error",
					message:
						outcome.code === "error_image_oversize"
							? IMAGE_OVERSIZE_MESSAGE
							: "",
				});
				break;
			case "p3_protective_landing":
				// C1 (F-2): refresh renders the committed bet; fresh key only on
				// the NEXT edit after refresh; NO auto-resubmit affordance.
				router.refresh();
				dispatchKey({ type: "REFRESHED" });
				break;
			case "p4_rate_limited":
				setCountdown(mapped.retryAfterSeconds ?? 30);
				break;
			case "p3_gate_down":
			case "p3_transient_retry":
			case "p3_wait_in_flight":
				// M-4: the in-flight 409s carry Retry-After (header) — honor it.
				setRetryLock(mapped.retryAfterSeconds ?? 0);
				break;
			case "auth_gate":
				setAuthGate(true);
				break;
			case "route_onboarding":
				router.push("/onboarding");
				break;
			default:
				break;
		}
	}

	if (authGate) {
		// Session evaporated at submit — swap to the d5 auth-gate slot variant.
		return <AuthGateSlot side={props.side} onClose={props.onClose} />;
	}

	const extendedMax = extendedMaxChars(title.trim().length);
	const dimmed = floorAbove ? "opacity-(--state-disabled-opacity)" : undefined;
	/**
	 * ⚠⚠ RPLY-1 · R3 — THE ONE NOTICE, and its precedence is a ruling rather
	 * than an accident of ordering.
	 *
	 * ⛔ C2 FIRST. It is the only one of the three that SPEC.1 §16.2 requires —
	 * the message must name both the current balance and the required stake, and
	 * `c2Sentence` is how that is satisfied — and it is the only one describing a
	 * TOTAL block: in this state every input is disabled and the whole argument
	 * form is dimmed. A transient banner must not displace a spec-mandated
	 * explanation of why the form is dead; the reader would be left with a
	 * countdown and no account of the greyed-out fields beneath it.
	 *
	 * ⚠ AND THE OTHER ORDER WAS CONSIDERED AND REJECTED ON A MEASUREMENT, not on
	 * taste: a 429 cannot originate from a composer in the C2 state, because
	 * `submitDisabled` carries `floorAbove` and no request can leave. The pair
	 * can only coexist if a refresh lowers `spendableToday` after a 429 has
	 * already landed — a window in which "you cannot afford the floor" is still
	 * the more useful sentence.
	 *
	 * ⛔ C2 AND OVER-CAP ARE PROVABLY EXCLUSIVE, so their relative order can
	 * never be observed: `assessAmount` clamps to `spendableToday` BEFORE reading
	 * the cap, so in the C2 state the clamped amount is ≤ spendable < floor
	 * (50) ≪ `BET_MAX_STAKE` (10,000) and `overCap` cannot be true. Stated
	 * because it is the reason this chain needs no tie-break between them.
	 *
	 * ⛔ THE C2 SENTENCE SHIPS VERBATIM from `c2Sentence` — not shortened, not
	 * reworded, not replaced by a shorter string that would have fitted one line.
	 * The slot was sized to the copy; the copy was not cut to the slot.
	 */
	const notice: string | null = floorAbove
		? c2Sentence({
				floor: floorFor(props.kind),
				spendable: props.viewer.spendableToday,
			})
		: countdown !== null
			? rateLimitedBanner(countdown)
			: assess.overCap
				? overCapStrip()
				: null;
	const toWin =
		quote !== null && quote.kind === "quote"
			? formatDharma(String(quote.data.shares ?? "—"))
			: null;

	return (
		<section
			aria-label={`${COMPOSER_COPY.header} — ${props.side}`}
			className="flex flex-col gap-3 rounded-(--r) p-3.5 shadow-(--elev-1) [border:var(--hairline)]"
		>
			{/* modhead — side chip (the TRUE bet side) · header · ×. Reply variant
			    (v0.10): verb line + the full post title; masked parent → canon
			    fallback header. */}
			{/* ⚠ change set 11 §4 — `items-center` so the × shares a centre line
			    with the header text. It was `items-start`, which top-aligned a 20px
			    label against a 44px control: measured centres 407.3 vs 419.3, i.e.
			    the × hanging 12px below the words it belongs to. */}
			<div className="flex items-center gap-2">
				<SideBadge side={props.side} />
				{/* ⚠⚠ RPLY-1 · R4a — ONE SPAN, ONE SIZE, ONE WEIGHT. The reply variant
				    used to be a two-child flex COLUMN at `text-[13.5px] font-bold`
				    carrying the parent's full title beneath the verb line, while the
				    fresh-post variant was a single leaf span at `text-sm
				    font-semibold`. Two headers, two type treatments and one extra line
				    of copy, on a panel whose height is the thing R3 just spent a whole
				    slice defending.
				    ⇒ THE SUBTITLE IS GONE and the two are now literally the SAME
				    ELEMENT with a different string in it — which is stronger than
				    giving them matching classes, because matching classes can drift
				    apart and one element cannot.
				    ⚠ THE WORDING IS UNTOUCHED. `Support|Counter <author>'s argument` is
				    ratified at design-canon §6 and it is the only place the relation is
				    named once the composer is open — the side chip beside it names the
				    SIDE, which is a different fact.
				    ⛔⛔ AND THE THIRD STATE SURVIVES, which is the part a subtitle
				    removal could easily have taken with it: a REMOVED parent has
				    `authorPseudonym === null` (masked server-side, SG-3), and that arm
				    still falls back to the canon `Place your Đ BET` header on a composer
				    that is still `kind="reply"`. No copy is invented and nothing is
				    leaked. Pinned by `composer-header.test.tsx`. */}
				<span className="text-sm font-semibold text-ink">
					{props.replyContext && props.replyContext.authorPseudonym !== null
						? `${props.replyContext.relation === "support" ? "Support" : "Counter"} ${props.replyContext.authorPseudonym}'s argument`
						: COMPOSER_COPY.header}
				</span>
				<button
					type="button"
					onClick={props.onClose}
					disabled={inFlight}
					aria-label="Close"
					// ⚠ change set 10 §5 — BIGGER GLYPH, AND A HIT TARGET THAT MEETS
					// THE 44px FLOOR. It was `text-base` (16px) in a shrink-to-fit box
					// roughly 24px across — under the minimum for a pointer target, and
					// the one control that dismisses a form someone may have typed into.
					// `size-11` is 44px square; `text-xl` is the glyph.
					// ⚠ `aria-label="Close"` is ALREADY on this button and is untouched —
					// the visible `×` is a glyph, so the label is the only accessible
					// name it has and WCAG 2.5.3 does not bind (no visible text to
					// contain).
					// ⚠⚠ `-my-3` — THE HIT TARGET NO LONGER DICTATES THE ROW HEIGHT.
					// The control stays a real 44 × 44 (CS10 §5, WCAG target size), but
					// −12px top and bottom means it contributes 44 − 24 = 20px to the
					// row — exactly the header text's height. The extra 24px of target
					// overhangs into the composer's own padding above and its `gap-3`
					// below, both of which are empty.
					// ⇒ The header block drops 44 → 20px and that 24px goes to the
					// title, per §1's spending order. The hit area is unchanged.
					className="-my-3 ml-auto flex size-11 items-center justify-center rounded-(--r-chip) text-xl text-n4 transition-all hover:text-ink focus-visible:shadow-(--state-focus-ring) disabled:pointer-events-none disabled:opacity-(--state-disabled-opacity)"
				>
					{COMPOSER_COPY.close}
				</button>
			</div>

			{/* ⚠⚠ RPLY-1 · R3 — THE THREE BLOCKED-STATE STRIPS USED TO LIVE HERE AND
			    IN THE FOOTBLOCK, AND THEY ARE NOW ONE SLOT INSIDE THE AMOUNT BLOCK.
			    See `noticeSlot` below for the whole argument. Two of them were
			    direct children of this `gap-3` column, so each cost its own box PLUS
			    a 12px gap; MEASURED at 1280×800 the section ran 428.81px clean,
			    472.81 with the 429 banner (+44.00) and 474.81 with the C2 strip
			    (+46.00), against a 416px column — 13px of overflow became 57 and 59.
			    ⛔ The submit was ALREADY disabled in every one of those states and
			    still is; not one gating predicate is touched. Only the HEIGHT was
			    ever the defect. */}

			<div className={dimmed}>
				<div className="mb-1 text-[9.5px] font-bold tracking-[0.12em] text-n5 uppercase">
					{COMPOSER_COPY.argumentLabel}
				</div>
				{/* `.compgrid` (d5) — TWO COLUMNS: the image attach panel at full
				    height on the left, title → body → the money footblock on the
				    right. The mockup's own CSS section header states it in terms:
				    "composer: PORTRAIT attach FULL MODULE HEIGHT · title/body/money
				    right". Fenced by SYMBOL (`O-8`).

				    ⛔ THE TRACK FLOOR IS REFUSED, NOT PORTED. d5 declares
				    `minmax(210px,40%) 1fr`; `210px` is a VALUE out of a light-mode
				    pre-BRIDGE prototype and `H-VALUE` forbids carrying it. What
				    ships is the PROPORTION alone — 2fr/3fr is d5's own 40/60 split
				    expressed without a pixel. `gap-3` is byte-carried from this
				    file's own shipped amount row, not from the mockup.

				    ⚠ RESOLVED GEOMETRY IS NOT PROVEN HERE. jsdom performs no
				    layout, so the render suites pin the ARRANGEMENT (two tracks,
				    which child is which) and say nothing about how the columns
				    actually resolve. That is a browser read against the compiled
				    CSS and it is the founder's staging pass. */}
				<div className="grid grid-cols-[2fr_3fr] items-stretch gap-3">
					<ImageAttach
						state={image}
						disabled={floorAbove || inFlight}
						onPick={onPickImage}
						onRemove={onRemoveImage}
					/>
					{/* `.compright` (d5) */}
					<div className="flex min-w-0 flex-col gap-2">
						<div>
							{/* ⚠⚠ change set 11 §3 — A TEXTAREA, SO ALL 125 CHARACTERS ARE
							    VISIBLE AT ONCE. As an `<input>` only the tail showed at
							    125/125.
							    ⚠ THREE LINES, MEASURED NOT ASSUMED: at the field's 352.4px
							    content width in 14px/20px Geist, **52 characters** fit per
							    line, so 125 characters render 60px tall = 3 lines.
							    `h-[72px]` is that plus the field's existing 12px of padding
							    and border.
							    ⛔ FIXED, exactly as CS7 §3 fixed the description:
							    `field-sizing-fixed` overrides the primitive's
							    `field-sizing-content`, and `resize-none` removes the drag
							    handle. Neither content nor a drag can change this box.
							    ⛔⛔ THE NEWLINE DEFENCE IS NOT WEAKENED — IT IS REBUILT. The
							    `<input>` was a STRUCTURAL layer (an input cannot hold a
							    newline); a textarea can, so that layer is gone. It is
							    replaced by `onKeyDown` blocking Enter at source, and the
							    existing onChange strip is KEPT for paste, drop and IME.
							    ⚠ THIS MATTERS BECAUSE OF WHAT THE SERVER DOES WITH IT.
							    There is no title column: `payload.ts` joins title + "\n\n" +
							    body into one `comments.body`, and `deriveTitleTeaser` splits
							    it back with `body.split("\n", 1)[0]` — the FIRST newline. A
							    newline in the title would truncate the derived title on the
							    debate card, the pop-up, the Discovery hero, both profile
							    surfaces and the ADR-0025 `.md` export.
							    ⚠ Blocking Enter costs nothing: there is no `<form>` and no
							    key handler, so Enter submits nothing today. */}
							<Textarea
								value={title}
								maxLength={TITLE_MAX_CHARS}
								disabled={floorAbove || inFlight}
								aria-label="Argument title"
								className="h-[72px] resize-none field-sizing-fixed"
								onKeyDown={(e) => {
									// Layer 1, replacing the `<input>`: a newline never gets
									// typed in the first place.
									if (e.key === "Enter") {
										e.preventDefault();
									}
								}}
								onChange={(e) => {
									// Layer 2, KEPT VERBATIM: the paste/drop/IME belt. F-5 —
									// the title is newline-free.
									setTitle(e.target.value.replace(/[\n\r]/g, " "));
									onEdit();
								}}
							/>
							<div className="mt-0.5 text-right text-[10px] text-n4">
								{groupCount(title.length)} / {groupCount(TITLE_MAX_CHARS)}
							</div>
						</div>
						<div>
							{/* ⚠⚠ change set 7 §3 — THE DESCRIPTION NO LONGER GROWS AND NO
							    LONGER DRAGS. `ui/textarea.tsx` ships `field-sizing-content`
							    (grows with typing) and the browser's default resize handle
							    (grows with dragging); either one pushes AMOUNT / TO WIN /
							    PLACE Đ BET below the fold and makes the column scroll.
							    ⛔ FIXED, NOT CAPPED: `h-24` replaces `min-h-24` and
							    `field-sizing-fixed` overrides the primitive's own
							    `field-sizing-content`, so neither content nor a drag can
							    change this box. `resize-none` removes the handle.
							    ⛔ THE PRIMITIVE IS NOT EDITED — every other textarea in the
							    app keeps its behaviour; this is an instance override.
							    ⚠ Nothing about the FIELD changes: `maxLength` is untouched,
							    the argument stays required, and the text scrolls INSIDE the
							    box rather than being truncated. */}
							<Textarea
								value={extended}
								maxLength={extendedMax}
								disabled={floorAbove || inFlight}
								aria-label="Argument body"
								// ⚠ change set 11 §1 — 96 → 128px. The last step of the
								// spending order: the title takes what it needs for 3 lines
								// (+40) and the header reclaim (+24), and what is left of the
								// restoration goes here. Still FIXED — a bigger box, not an
								// elastic one.
								className="h-32 resize-none field-sizing-fixed"
								onChange={(e) => {
									setExtended(e.target.value);
									onEdit();
								}}
							/>
							<div className="mt-0.5 text-right text-[10px] text-n4">
								{groupCount(extended.length)} / {groupCount(extendedMax)}
								{COMPOSER_COPY.optionalSuffix}
							</div>
						</div>

						{/* `.footblock` (d5) — the money row is the right column's
						    FOOTER, so it sits at the column's foot rather than
						    floating under the body. */}
						<div className="mt-auto">
							<div className="flex items-stretch gap-3">
								<div className="flex flex-1 flex-col rounded-(--r-chip) px-3 py-2 [border:var(--hairline)]">
									<div className="flex items-center justify-between">
										<span className="text-[9.5px] font-bold tracking-[0.12em] text-n5 uppercase">
											{COMPOSER_COPY.amountLabel}
										</span>
										{/* `.amtval` — flex-END, so the glued `Đ` sits against
										    the digits and MOVES with them as the field's width
										    tracks its content (`stakeFieldWidth`).
										    ⚠ `ch` TRACKS THE DIGITS EXACTLY ONLY BECAUSE THIS
										    FIELD IS `font-mono`. The `ch` unit is the width of
										    the `0` glyph, so a proportional face makes `Nch`
										    stop matching N digits and the `Đ` drifts off the
										    number — and nothing goes red, because jsdom performs
										    no layout and the width string is unchanged. Dropping
										    `font-mono` below is therefore a silent break of R2,
										    not a restyle. */}
										<span className="flex min-w-0 items-baseline justify-end gap-1">
											<span className="text-sm text-n5">Đ</span>
											<Input
												value={amount}
												inputMode="decimal"
												disabled={floorAbove || inFlight}
												aria-label="Stake amount"
												style={{ width: stakeFieldWidth(amount) }}
												onChange={(e) => {
													setAmount(e.target.value);
													onEdit();
												}}
												onBlur={() => {
													// T3: normalize the display to the clamped value.
													if (isPositiveAmount(amount)) {
														setAmount(assess.clampedAmount);
													}
												}}
												className={`h-auto border-none p-0 text-right font-mono text-[22px] font-extrabold tabular-nums shadow-none [border:none] ${
													assess.overCap ? "text-n4" : ""
												}`}
											/>
										</span>
									</div>
									<div className="my-1.5 border-t border-n2" />
									{/* ⚠⚠ RPLY-1 · R3 — THE NOTICE SLOT. TO WIN is meaningless in
									    all three blocked states — the bet cannot be submitted in
									    any of them — so the row is free, and a notice written into
									    it costs no box and no gap. That is the whole mechanism:
									    the composer's height stops depending on which blocked
									    state it is in.
									    ⛔⛔ `h-8` IS RESERVED, NOT FITTED, AND THE NUMBER IS
									    MEASURED. At this block's real 210px inner width (1280×800,
									    real compiled CSS) the C2 sentence wraps to TWO lines = 32px
									    while the 429 and over-cap strings are one = 16px, and the
									    TO WIN row is 20px. Reserving the tallest makes the height
									    identical in all four states, which is the actual goal — a
									    slot that merely collapsed would still JUMP by 12px on
									    entering C2, and a form moving under someone is the
									    complaint this row exists to answer.
									    ⚠ THE C2 FIGURE DOES NOT CHANGE THE WRAP: measured with
									    `Đ 9,999,999` as well as `Đ 0`, both 32px. The reservation
									    is stable against the balance, not tuned to one fixture.
									    ⛔⛔ `text-ink`, NOT `text-n5`, AND THE REASON IS CONTRAST —
									    MEASURED IN A BROWSER, NOT ESTIMATED. This slot sits INSIDE
									    the `dimmed` wrapper, and `--state-disabled-opacity` is 0.5.
									    Composited against the real backdrop (rgb(24,24,24)):
									    `--color-ink` #fafafa gives **5.08:1**, `--color-n5` #989898
									    gives **2.50:1** — the latter is under the 4.5:1 body floor,
									    on the one sentence that explains why the form is dead.
									    ⚠ The C2 strip used to ESCAPE the dimming by sitting outside
									    the wrapper, so it never needed this decision; moving it
									    inside is exactly what makes the token load-bearing. Reaching
									    for the muted default here would have quietly halved the
									    legibility of the only message on a disabled form.
									    ⚠ ONE `aria-live` REGION, ON THE SLOT. It was on the TO WIN
									    value and `role="status"` was on the 429 banner; with the two
									    sharing a box, one polite region announces whichever
									    currently occupies it. Two nested live regions would be a
									    second announcement of the same change. */}
									<div
										aria-live="polite"
										data-testid="composer-notice-slot"
										className="flex h-8 items-center"
									>
										{notice !== null ? (
											<p className="text-xs text-ink">{notice}</p>
										) : (
											<div className="flex w-full items-center justify-between">
												<span className="text-[9.5px] font-bold tracking-[0.12em] text-n5 uppercase">
													{COMPOSER_COPY.toWinLabel}
												</span>
												<span className="font-mono text-sm text-ink">
													{toWin !== null ? `Đ ${toWin}` : "—"}
												</span>
											</div>
										)}
									</div>
								</div>
								{/* ⚠⚠ change set 7 §4 — LARGER, AND THE LABEL STACKS.
								    `self-end` → `self-stretch` so it takes the empty height
								    beside the AMOUNT / TO WIN block instead of hugging the
								    bottom of it.
								    ⛔⛔ THE ACCESSIBLE NAME STAYS ONE PHRASE. Two stacked
								    spans would otherwise concatenate to `PlaceĐ BET` — two
								    fragments run together, which is what a screen reader
								    would announce. `aria-label` pins the single readable
								    phrase, and WCAG 2.5.3 holds because it CONTAINS the
								    visible words (case-insensitively): visible `Place` +
								    `Đ BET`, name `PLACE Đ BET`.
								    ⚠ It is also the SAME string every existing test queries
								    by role+name, so the label change moves no guard. */}
								<Button
									type="button"
									disabled={submitDisabled}
									aria-disabled={submitDisabled}
									aria-label={COMPOSER_COPY.submit}
									onClick={submit}
									className="h-auto min-h-[52px] flex-col gap-0 self-stretch px-4 py-2"
								>
									<span className="text-[11px] leading-tight font-medium">
										Place
									</span>
									<span className="text-[15px] leading-tight font-bold">
										Đ BET
									</span>
								</Button>
							</div>

							{/* ⚠ RPLY-1 · R3 — the over-cap strip moved into the notice slot
							    above. W2.10-D is UNCHANGED in substance: typing is still
							    allowed, submit is still disabled, and the strip still says
							    the same words — it simply no longer adds 22px here.
							    ⚠ THE BRIEF FOR THIS TASK CALLED IT A THIRD SIBLING OF THE
							    OTHER TWO AND IT WAS NOT: it lived inside this footblock, so
							    it cost `mt-1.5` (6px) rather than the column's 12px gap.
							    MEASURED: the section grew 428.81 → 450.81 (+22.00) in this
							    state while its direct flex-child count stayed at 2, which is
							    how the difference showed up at all. */}
						</div>
					</div>
				</div>
			</div>

			<ErrorStrip status={status} />

			{/* P2 terminal — the blocking modal, once; then controls disable. */}
			<Dialog
				open={suspendedKind !== null}
				onOpenChange={(open) => {
					if (!open && suspendedKind !== null) {
						setSuspendedKind(null);
						props.onSuspended();
						props.onClose();
					}
				}}
			>
				<DialogContent showCloseButton={false}>
					<DialogTitle>
						{suspendedKind === "banned"
							? SUSPENDED_COPY.banned.title
							: SUSPENDED_COPY.trackA.title}
					</DialogTitle>
					<DialogDescription>
						{suspendedKind === "banned"
							? SUSPENDED_COPY.banned.body
							: SUSPENDED_COPY.trackA.body}
					</DialogDescription>
					<div className="flex justify-end">
						<Button
							type="button"
							onClick={() => {
								setSuspendedKind(null);
								props.onSuspended();
								props.onClose();
							}}
						>
							{SUSPENDED_COPY.trackA.action}
						</Button>
					</div>
				</DialogContent>
			</Dialog>
		</section>
	);
}
