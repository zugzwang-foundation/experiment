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
	 * (50) ≪ `BET_MAX_STAKE` (250 since ADR-0047; 10,000 before it — the
	 * ARGUMENT is unchanged, the figure was not) and `overCap` cannot be true. Stated
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
			// ⚠⚠ RPLY-2 · R1 — `min-h-0`, so THIS section can shrink below its own
			// content height.
			className="flex min-h-0 shrink-0 flex-col gap-2 rounded-(--r) p-2.5 shadow-(--elev-1) [border:var(--hairline)]"
		>
			{/* modhead — side chip (the TRUE bet side) · header · ×. Reply variant
			    (v0.10): verb line + the full post title; masked parent → canon
			    fallback header. */}
			{/* ⚠ change set 11 §4 — `items-center` so the × shares a centre line
			    with the header text. It was `items-start`, which top-aligned a 20px
			    label against a 44px control: measured centres 407.3 vs 419.3, i.e.
			    the × hanging 12px below the words it belongs to. */}
			{/* RPLY-2 · R1 — `shrink-0`. This header row and the argument region
			    are the TWO permanent direct children of this section
			    (`<ErrorStrip>` and the suspended `<Dialog>` are two more, present
			    only while their own state is active — neither carries a box when
			    idle, so neither competes for the shrink); only the argument region
			    ever gives way when the column is short.
			    ⚠ RPLY-3 · R1 — THREE became TWO. The money footblock was briefly a
			    third direct child here and is now back inside the right column, so
			    a reader counting flex items for the `shrink-0` reasoning above
			    counts two. Corrected in place rather than left as a number that
			    happens to be wrong (`O-5`); `notice-slot.test.tsx` carries the same
			    count and the same history. */}
			<div className="flex shrink-0 items-center gap-2">
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

			{/* THE ARGUMENT REGION, AND THE ONLY THING IN THIS SECTION THAT GIVES
			    WAY. `min-h-0` is what lets it shrink below its own content height
			    when the column is short — the header is `shrink-0`, so this is the
			    only sibling flex-shrink can act on, and it absorbs the whole deficit
			    by default (flex-shrink:1 needs no class of its own).
			    ⛔ DELIBERATELY NOT `flex-1`. A `flex-1` (flex-grow) here computes
			    this region's OWN intrinsic contribution to the section's auto
			    height differently from "sum of my children's natural sizes" —
			    measured at RPLY-2: it inflated the tall-viewport height by ~28px for
			    no functional gain, since nothing above ever has spare room to hand
			    down. Shrinking needs no grow.

			    ⚠⚠ RPLY-3 · R1 — `overflow-y-auto` IS GONE FROM HERE, MOVED ONE
			    LEVEL DOWN ONTO THE FIELDS (see `.fieldscroll` below), AND THAT MOVE
			    IS THE WHOLE POINT OF THIS TASK. RPLY-2 made this region the
			    scroller and hoisted the money footblock OUT of the grid so a scroll
			    could never hide the submit. R1 rules the footblock back INTO the
			    right column — which puts it back inside this region, where a scroll
			    WOULD hide it again. So the scroll no longer lives here: it lives on
			    the title/body pair alone, which is the only content that may give.
			    The footblock is that pair's `shrink-0` sibling, outside the scroll
			    box, and is therefore un-scrollable-away by construction rather than
			    by budget. MEASURED, both arms, 900/800/750/700/650 — see the run
			    report's V1 table.
			    ⚠ The `p-0.5 -m-0.5` ring-room pair moved WITH the overflow, because
			    it was never about this element: it exists wherever the scroll clip
			    rect is, and a focus ring is a 2px outset that clips against it. */}
			<div className={`flex min-h-0 flex-col${dimmed ? ` ${dimmed}` : ""}`}>
				<div className="mb-1 shrink-0 text-[9.5px] font-bold tracking-[0.12em] text-n5 uppercase">
					{COMPOSER_COPY.argumentLabel}
				</div>
				{/* `.compgrid` (d5) — TWO COLUMNS: the image attach panel at full
				    height on the left, title → body → the money footblock on the
				    right. The mockup's own CSS section header states it in terms:
				    "composer: PORTRAIT attach FULL MODULE HEIGHT · title/body/money
				    right" — quoted verbatim, and RPLY-3 · R1 restores the last
				    clause the build had diverged from. RPLY-2 · R1 had hoisted the
				    money footblock OUT of this grid to a section-level sibling; that
				    was a SPECIFICATION error in RPLY-2's own brief, not a build
				    error, and the founder ruled it back. It is `.compright`'s third
				    child again, per d5's own `:1132`. Fenced by SYMBOL (`O-8`).

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
				    CSS and it is the founder's staging pass.

				    RPLY-2 · R1 — `min-h-0` ADDED, not `flex-1` (see the argument
				    region's own comment above for why grow is refused here too).
				    `min-h-0` is what lets this grid's row shrink below its content
				    when the region above it shrinks, and `items-stretch` carries
				    that same shrunken height to `ImageAttach` via its `h-full`.
				    ⚠⚠ RPLY-3 · R1 — AND THAT WAS HALF A MECHANISM UNTIL NOW. The
				    row shrank; the `<fieldset>` inside the LEFT track did not,
				    because it declared no minimum of its own and a grid item's
				    automatic minimum size is its content. MEASURED at 650px, post
				    arm, real compiled CSS: the grid box was 117.41px while the panel
				    inside it still measured its full 266.45px and simply overflowed —
				    which is where the founder's clipped `beats capital.` and missing
				    `Add Image` came from. `ImageAttach` now declares an explicit
				    floor, which is what releases that automatic minimum; see its own
				    `panel` comment for the number and for why the floor sits on the
				    fieldset rather than on the artwork. */}
				{/* ⚠ MOBILE-2 / ADR-0051 — `max-mobile:grid-cols-1`, ADDITIVE AND INERT
				    ABOVE 640px. At 375px inside the phone sheet the `2fr_3fr` split
				    gives the image slot ~138px and the argument fields ~207px, so the
				    title input and the body textarea — the two things a participant is
				    here to fill in — get less than half the sheet. Stacking gives both
				    the full width and costs the desktop nothing. */}
				<div className="grid min-h-0 grid-cols-[2fr_3fr] items-stretch gap-2.5 max-mobile:grid-cols-1">
					<ImageAttach
						state={image}
						disabled={floorAbove || inFlight}
						onPick={onPickImage}
						onRemove={onRemoveImage}
					/>
					{/* `.compright` (d5) — title → body → the money footblock.
					    RPLY-2 · R1 — `min-h-0`, so its children can shrink below their
					    own content height instead of forcing this whole column — and
					    the grid row it sits in — to stay at full size regardless of the
					    space actually available. */}
					{/* ⛔⛔ MOBILE-2c R-6 — `max-mobile:contents`, AND IT IS THE ANSWER TO
					    THE PARAGRAPH THAT USED TO STAND HERE.
					    That paragraph was right about everything except the conclusion. It
					    recorded that `order-first` on this column had been tried and
					    reverted because it moves the WHOLE column — fields, money row and
					    `PLACE Đ BET` together — so the attachment landed after the submit,
					    which is worse than landing before the fields. It concluded that the
					    ruled composition "would need the footblock to leave this column,
					    which is RPLY-3 · R1 in reverse and is not a token."
					    ⇒ `display: contents` is the token. Below 640px it dissolves this
					    wrapper's BOX without moving a single node, so the grid's children
					    become [image, fields, balance, footblock] and `order-*` sequences
					    those four independently. The desktop keeps the box and the column
					    byte-for-byte — but ⛔ **NOT for the reason this paragraph used to
					    give.** It said `order` is "inert on a child whose parent is not a flex
					    or grid container at that width — which it is not, because this div IS
					    the container above 640px", and that is backwards: above 640px this div
					    IS `flex flex-col`, so its children ARE flex items and an unprefixed
					    `order-*` on them WOULD reorder the desktop column. What protects the
					    desktop is only that all four tokens carry `max-mobile:`, so the
					    declarations do not exist at ≥640px at all. Corrected by
					    `@code-reviewer` — this is the sentence a later editor would have
					    relied on while dropping a prefix.
					    ⚠ `gap-2` goes with the box at phone width, and the grid's own
					    `gap-2.5` (10px) takes over — inside the 8-12px the ruling asks for,
					    so nothing is restated.
					    ⚠ `mt-auto` on the footblock is neutralised at phone width. In this
					    column it pushes the money row to the bottom of a flex column; as a
					    grid item in an auto-sized row there is no free space for it to
					    consume, and leaving it would be a declaration that reads as load
					    bearing while doing nothing.
					    ⚠ AND `min-w-0` GOES WITH THE BOX, which is the one release this
					    mechanism gives up. It is here because this div was the grid item;
					    below 640px it has none, and no new grid item declares one. Nothing
					    overflows today — both textareas carry `field-sizing-fixed`, so their
					    min-content contribution is the cols-based intrinsic width rather than
					    the longest word — but if that ever changes the `1fr` track widens and
					    the symptom is a HORIZONTAL SCROLLBAR INSIDE THE SHEET (its body's
					    `overflow-y-auto` computes `overflow-x: auto`), which is not something
					    B2's document-overflow check can see. (`@code-reviewer`, LOW.) */}
					<div className="flex min-h-0 min-w-0 flex-col gap-2 max-mobile:contents">
						{/* `.fieldscroll` — RPLY-3 · R1. THE SCROLLER, AND THE REASON THE
						    FOOTBLOCK CAN COME BACK INTO THIS COLUMN AT ALL.
						    ⛔⛔ THE RULING IS "never pushed off-screen", AND A BUDGET
						    CANNOT DELIVER THAT — ONLY A STRUCTURE CAN. RPLY-2 kept the
						    submit reachable by moving it out of the scrolling region;
						    R1 rules it back in, so the scrolling region is moved off it
						    instead. Everything that MAY give — the two textareas and
						    their counters — is inside this box; the footblock is its
						    `shrink-0` sibling, outside it. THIS box's scroll can never
						    hide `Đ BET`, because it does not contain it.
						    ⚠ MEASURED, not reasoned: at 650px on the post arm this box
						    takes ~125px against ~242px of content and scrolls the
						    difference, while the footblock renders whole. The V1 table in
						    the run report carries every cell.

						    ⛔⛔ AND THE GUARANTEE IS THIS BOX'S, NOT THE COMPOSER'S — a
						    distinction this comment stated too broadly on its first draft
						    ("no viewport height at which a scroll can hide `Đ BET`") and
						    `@code-reviewer` caught. Below the height at which
						    `ImageAttach`'s own 192px floor binds, nothing inside the
						    section can give any further, and the surplus becomes visible
						    overflow that `column-scroll` — the surface's own scroller —
						    takes. `Đ BET` stays REACHABLE there; it stops being reachable
						    WITHOUT SCROLLING. Measured rather than reasoned, at 1280 wide:
						    the floor first binds at 600px on the post arm and 580 on the
						    market arm, and the last fully-clean viewport is 600 / 580
						    respectively — 50 and 70px below the lowest height the founder's
						    matrix tests. It is a floor with a stated band, not a promise
						    with a hole in it.
						    ⚠ `p-0.5 -m-0.5` MOVED HERE FROM THE REGION ABOVE, unchanged
						    in purpose: setting ONE overflow axis makes BOTH compute to
						    `auto` (CSS Overflow 3), and the title textarea sits flush
						    against this box's edge, so its 2px outset
						    `focus-visible:shadow-(--state-focus-ring)` would clip against
						    the scroll clip rect. The padding gives the ring room; the
						    equal negative margin cancels it back out.
						    ⛔ NOT `flex-1` — same refusal as every other node in this
						    chain (see the argument region). Shrinking needs no grow. */}
						<div className="flex min-h-0 -m-0.5 flex-col gap-1.5 overflow-y-auto p-0.5 max-mobile:order-1">
							<div className="flex shrink-0 flex-col">
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
									enterKeyHint="next"
									// ⛔ MOBILE-2b D-2 — iOS Safari ZOOMS THE VIEWPORT when a focused
									// field is under 16px, and does not zoom back out on blur. The
									// reader taps the title and spends the rest of the session on a
									// page wider than their screen, with the fixed bar off the edge.
									// `Textarea`'s base is `text-sm` (14px), measured. The leading is
									// stated with the size because an arbitrary `text-[Npx]` inherits
									// whatever step was in scope and would otherwise keep `text-sm`'s
									// 20px — the box is a fixed height either way, so this changes the
									// text inside it and nothing around it. Additive: inert ≥640.
									className="h-[72px] min-h-8 resize-none field-sizing-fixed max-mobile:text-[16px] max-mobile:leading-[22px]"
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
								<div className="mt-0.5 shrink-0 text-right text-[10.5px] leading-tight text-n4 pr-2">
									{groupCount(title.length)} / {groupCount(TITLE_MAX_CHARS)}
								</div>
							</div>
							<div className="flex min-h-0 flex-col">
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
									// D-2, the other half — same 14px, same zoom, same fix.
									className="h-[80px] min-h-14 resize-none field-sizing-fixed max-mobile:text-[16px] max-mobile:leading-[22px]"
									onChange={(e) => {
										setExtended(e.target.value);
										onEdit();
									}}
								/>
								<div className="mt-0.5 shrink-0 text-right text-[10.5px] leading-tight text-n4 pr-2">
									{groupCount(extended.length)} / {groupCount(extendedMax)}
									{COMPOSER_COPY.optionalSuffix}
								</div>
							</div>
						</div>

						{/* ⛔⛔ MOBILE-2 — THE CAP AND THE BALANCE, PHONE ONLY, AND IT IS
						    RESTORING AN INVARIANT RATHER THAN DECORATING A SHEET.
						    design-language §1.8 / ADR-0051 D-5: "the balance visible where a
						    stake is committed". On the desktop that is held by the GLOBAL
						    HEADER — `DharmaCluster` renders `Balance` beside `Portfolio`, and
						    the composer therefore never had to. ⚠ ADR-0049 (#511) hides that
						    cluster below 640px (`DharmaCluster.tsx:111`,
						    `mobileResponsive && "max-mobile:hidden"`), which is right for a
						    354px header and leaves the invariant with nowhere to live on a
						    phone: MEASURED on `origin/main`, a phone participant composing a
						    bet can see no balance anywhere on the page. So this line is the
						    one place it can go, and it appears at exactly the width where the
						    header stopped carrying it.
						    ⚠ BOTH HALVES ARE LIVE. `overCapStrip()` is the shipped
						    `Max Đ 250 per bet` string; the figure is `viewer.spendableToday`
						    through `formatDharma`, which is the same value `Balance` names in
						    the header (its ratified gloss is *spendable* —
						    `DharmaCluster.tsx:26-29`). Nothing is invented and nothing is
						    recomputed here.
						    ⚠ `hidden` + `max-mobile:flex` — it is `display:none` at every
						    desktop width, so the ≥640px render is unchanged to the pixel. */}
						<p
							data-testid="composer-phone-balance"
							className="mt-1 hidden shrink-0 items-baseline justify-between gap-2 text-[10px] leading-tight text-n5 max-mobile:order-3 max-mobile:flex"
						>
							{/* ⚠ HIDDEN WHILE THE NOTICE SLOT IS ALREADY SAYING IT. In the
							    over-cap state `notice` renders `overCapStrip()` a few lines
							    below, so a phone printed `Max Đ 250 per bet` twice on one
							    screen (`@code-reviewer`). The BALANCE half is what this line
							    exists for and it stays in both states — it is the invariant
							    ADR-0049 left the phone without. */}
							<span>{assess.overCap ? "" : overCapStrip()}</span>
							<span>
								Balance{" "}
								<span className="font-mono text-ink">
									Đ {formatDharma(props.viewer.spendableToday)}
								</span>
							</span>
						</p>
						{/* `.footblock` (d5) — the money row, and RPLY-3 · R1's whole subject. */}
						{/* ⚠ MOBILE-2 — the money row stacks below 640px: the Amount / To win card
						    takes the full width and `PLACE Đ BET` sits under it at full
						    width. Side by side at 375 the submit is a ~120px target beside a
						    number a participant is reading while they decide. Additive; the
						    desktop row is unchanged. */}
						<div className="mt-auto flex shrink-0 items-stretch gap-2.5 max-mobile:order-4 max-mobile:mt-0 max-mobile:flex-col">
							<div className="flex flex-1 flex-col rounded-(--r-chip) px-2.5 py-1.5 [border:var(--hairline)]">
								<div className="flex items-center justify-between">
									<span className="text-[9.5px] font-bold tracking-[0.12em] text-n5 uppercase">
										{COMPOSER_COPY.amountLabel}
									</span>
									{/* `.amtval` — flex-END, so the glued `Đ` sits against
									    the digits and MOVES with them as the field's width
									    tracks its content (`stakeFieldWidth`). */}
									<span className="flex min-w-0 items-baseline justify-end gap-1">
										<span className="text-sm text-n5">Đ</span>
										<Input
											value={amount}
											inputMode="decimal"
											// D-2 — the amount is already 20px so it does not zoom;
											// what it lacked was the key that ends entry. `done`
											// rather than `go`: there is no form to submit and the
											// reader still has to reach PLACE Đ BET.
											enterKeyHint="done"
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
											className={`h-auto border-none p-0 text-right font-mono text-[20px] font-extrabold tabular-nums shadow-none [border:none] ${
												assess.overCap ? "text-n4" : ""
											}`}
										/>
									</span>
								</div>
								<div className="border-t border-n2 my-1" />
								{/* ⚠⚠ RPLY-1 · R3 — THE NOTICE SLOT. TO WIN is meaningless in
								    all three blocked states — the bet cannot be submitted in
								    any of them — so the row is free, and a notice written into
								    it costs no box and no gap. */}
								<div
									data-testid="composer-notice-slot"
									className="flex items-center h-8"
								>
									{notice !== null ? (
										<p role="status" className="text-xs text-ink">
											{notice}
										</p>
									) : (
										<div className="flex w-full items-center justify-between">
											<span className="text-[9.5px] font-bold tracking-[0.12em] text-n5 uppercase">
												{COMPOSER_COPY.toWinLabel}
											</span>
											<span
												aria-live="polite"
												className="font-mono text-sm text-ink"
											>
												{toWin !== null ? `Đ ${toWin}` : "—"}
											</span>
										</div>
									)}
								</div>
							</div>
							{/* ⚠ ONE LINE ON THE PHONE, TWO ON THE DESKTOP (R-9, founder
							    ruling Q9-a) — and it is the same two spans either way. The
							    desktop stacks them because the button is a narrow column
							    beside the amount card and `PLACE Đ BET` does not fit across
							    it; on the phone `max-mobile:flex-col` has already turned the
							    footblock into a column, so the button is full width and has
							    room for the whole label. `max-mobile:flex-row` puts the two
							    spans side by side and the size/weight tokens make them read
							    as the single string `COMPOSER_COPY.submit` already supplies
							    as the accessible name. No new string: `Place` is
							    uppercased by the variant token, not rewritten.
							    ⛔ ON THE DESKTOP the disabled treatment is `ui/button.tsx:8`'s
							    `disabled:pointer-events-none
							    disabled:opacity-(--state-disabled-opacity)` and is NOT
							    restated — `--state-disabled-opacity: 0.5` is the canon's
							    only disabled treatment (design-language §3 item 9) and every
							    control in the tree uses exactly it. There is no ghost
							    outline box to remove there; there never was one.
							    ⚠⚠ MOBILE-2e · R-M1 — AND BELOW 640px IT IS RESTATED, ON
							    PURPOSE, BECAUSE THE CANON TREATMENT PRODUCES THE WRONG
							    READING HERE. The `default` cva variant fills with
							    `bg-(--btn-fill)`, which resolves to `--color-ground`
							    `#181818` — the same value as the sheet this button sits in.
							    So the ENABLED button was a dark box on an identically dark
							    ground, separated from it by one `#404040` hairline, and it
							    read as an outline rather than as the primary action. The
							    phone's primary is `PhoneBottomBar`'s `BET YES`
							    (`bg-ink text-ground`, `text-sm font-extrabold
							    tracking-[0.06em] uppercase`), and this is the same action
							    one layer in, so it takes the same treatment.
							    ⛔ WHICH MEANS THE 0.5 OPACITY HAD TO GO WITH IT. Dimming a
							    WHITE fill to 50% over a near-black ground lands on mid-grey
							    with mid-grey text — the hollow reading again, arriving from
							    the other end. Below 640px disabled is therefore a SOLID
							    `n2` fill with `n6` text: recessed by ~3.3 stops of contrast
							    against the enabled state (18:1 → 5.5:1) while staying a
							    filled box, which is what says "this control exists and is
							    not ready" rather than "this control is a border".
							    ⚠ The height is the RULED 52px, not the bar's 46: the base
							    keeps `h-auto min-h-[44px]`, so `composer-fit.test.ts`'s
							    floor still reads what it expects, and the phone token sits
							    beside it rather than replacing it.
							    ⚠ `bg-(--btn-fill)` is UNPREFIXED on the primitive and
							    `max-mobile:bg-ink` is a different twMerge group, so BOTH
							    survive the merge and Tailwind's emitted variant order is
							    what decides — measured in a real browser at 375, not
							    assumed from the class string. */}
							<Button
								type="button"
								disabled={submitDisabled}
								aria-disabled={submitDisabled}
								aria-label={COMPOSER_COPY.submit}
								onClick={submit}
								className="h-auto min-h-[44px] flex-col gap-0 self-stretch px-3 py-1 max-mobile:h-[52px] max-mobile:w-full max-mobile:flex-row max-mobile:items-center max-mobile:justify-center max-mobile:gap-1.5 max-mobile:[border:none] max-mobile:bg-ink max-mobile:text-ground max-mobile:tracking-[0.06em] max-mobile:uppercase max-mobile:disabled:bg-n2 max-mobile:disabled:text-n6 max-mobile:disabled:opacity-100"
							>
								<span className="text-[10px] leading-tight font-medium max-mobile:text-[14px] max-mobile:font-extrabold max-mobile:uppercase">
									Place
								</span>
								<span className="text-[14px] leading-tight font-bold max-mobile:font-extrabold">
									Đ BET
								</span>
							</Button>
						</div>
					</div>
				</div>
			</div>

			{/* ⚠ RPLY-1 · R3 — the over-cap strip moved into the notice slot
			    above. W2.10-D is UNCHANGED in substance: typing is still
			    allowed, submit is still disabled, and the strip still says
			    the same words — it simply no longer adds 22px here.
			    ⚠ THE BRIEF FOR THIS TASK CALLED IT A THIRD SIBLING OF THE
			    OTHER TWO AND IT WAS NOT: it lived inside this footblock, so
			    it cost `mt-1.5` (6px) rather than the column's 12px gap.
			    MEASURED: the section grew 428.81 → 450.81 (+22.00) in this
			    state while its direct flex-child count stayed at 2 (RPLY-1's
			    OWN count, at RPLY-1's OWN structure — RPLY-2 · R1 took it to 3
			    and RPLY-3 · R1 returned it to 2, see the header-row comment
			    above; this record is left as the measurement it was), which is
			    how the difference showed up at all. */}

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
