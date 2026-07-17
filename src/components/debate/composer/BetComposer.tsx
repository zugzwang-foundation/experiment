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
import type { Side, ViewerMarketContext } from "../types";
import { AuthGateSlot } from "./AuthGateSlot";
import {
	COMPOSER_COPY,
	c2Sentence,
	formatDharmaGrouped as formatGrouped,
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

export function BetComposer(props: {
	marketId: string;
	slug: string;
	side: Side;
	kind: ComposerKind;
	viewer: ViewerMarketContext;
	parentCommentId?: string;
	/**
	 * Reply variant (v0.10): header verb `Support/Counter <author>'s argument`
	 * + the FULL post title beneath (wraps, no ellipsis). A REMOVED parent has
	 * no author/title at the type level (SG-3 masking) — pass nulls and the
	 * header falls back to the canon `Place your Đ BET` line (no copy invented,
	 * nothing leaked).
	 */
	replyContext?: {
		relation: "support" | "counter";
		authorPseudonym: string | null;
		postTitle: string | null;
	};
	onClose: () => void;
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
			// Success: close + refresh — the new post renders from the RSC model.
			router.refresh();
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
	const toWin =
		quote !== null && quote.kind === "quote"
			? formatGrouped(String(quote.data.shares ?? "—"))
			: null;

	return (
		<section
			aria-label={`${COMPOSER_COPY.header} — ${props.side}`}
			className="flex flex-col gap-3 rounded-(--r) p-3.5 shadow-(--elev-1) [border:var(--hairline)]"
		>
			{/* modhead — side chip (the TRUE bet side) · header · ×. Reply variant
			    (v0.10): verb line + the full post title; masked parent → canon
			    fallback header. */}
			<div className="flex items-start gap-2">
				<SideBadge side={props.side} />
				{props.replyContext && props.replyContext.authorPseudonym !== null ? (
					<span className="flex min-w-0 flex-col">
						<span className="text-[13.5px] leading-snug font-bold text-ink">
							{props.replyContext.relation === "support"
								? "Support"
								: "Counter"}{" "}
							{props.replyContext.authorPseudonym}'s argument
						</span>
						{props.replyContext.postTitle !== null && (
							<span className="text-xs text-n5">
								{props.replyContext.postTitle}
							</span>
						)}
					</span>
				) : (
					<span className="text-sm font-semibold text-ink">
						{COMPOSER_COPY.header}
					</span>
				)}
				<button
					type="button"
					onClick={props.onClose}
					disabled={inFlight}
					aria-label="Close"
					className="ml-auto rounded-(--r-chip) px-1.5 text-base text-n4 transition-all hover:text-ink focus-visible:shadow-(--state-focus-ring) disabled:pointer-events-none disabled:opacity-(--state-disabled-opacity)"
				>
					{COMPOSER_COPY.close}
				</button>
			</div>

			{/* P4 429 banner — countdown auto-clears; expiry re-keys (F-1). */}
			{countdown !== null && (
				<div
					role="status"
					aria-live="polite"
					className="rounded-(--r-chip) bg-n1 px-3 py-2 text-xs text-ink"
				>
					<b>{rateLimitedBanner(countdown)}</b>
				</div>
			)}

			{/* Floor-above-balance (C2, verbatim): disabled composer, label-only dim. */}
			{floorAbove && (
				<div className="rounded-(--r-chip) px-3 py-2 text-xs text-n5 [border:var(--hairline)]">
					{c2Sentence({
						floor: floorFor(props.kind),
						spendable: props.viewer.spendableToday,
					})}
				</div>
			)}

			<div className={dimmed}>
				<div className="mb-1 text-[9.5px] font-bold tracking-[0.12em] text-n5 uppercase">
					{COMPOSER_COPY.argumentLabel}
				</div>
				<div className="flex flex-col gap-2">
					<div>
						<Input
							value={title}
							maxLength={TITLE_MAX_CHARS}
							disabled={floorAbove || inFlight}
							aria-label="Argument title"
							onChange={(e) => {
								// F-5: the title is newline-free (paste belt; the input
								// itself cannot hold newlines).
								setTitle(e.target.value.replace(/[\n\r]/g, " "));
								onEdit();
							}}
						/>
						<div className="mt-0.5 text-right text-[10px] text-n4">
							{title.length} / {TITLE_MAX_CHARS}
						</div>
					</div>
					<div>
						<Textarea
							value={extended}
							maxLength={extendedMax}
							disabled={floorAbove || inFlight}
							aria-label="Argument body"
							className="min-h-24"
							onChange={(e) => {
								setExtended(e.target.value);
								onEdit();
							}}
						/>
						<div className="mt-0.5 text-right text-[10px] text-n4">
							{extended.length} / {formatGrouped(String(extendedMax))}
							{COMPOSER_COPY.optionalSuffix}
						</div>
					</div>
					<ImageAttach
						state={image}
						disabled={floorAbove || inFlight}
						onPick={onPickImage}
						onRemove={onRemoveImage}
					/>
				</div>
			</div>

			{/* Amount + To-win (the pm block) + submit */}
			<div className={dimmed}>
				<div className="flex items-stretch gap-3">
					<div className="flex flex-1 flex-col rounded-(--r-chip) px-3 py-2 [border:var(--hairline)]">
						<div className="flex items-center justify-between">
							<span className="text-[9.5px] font-bold tracking-[0.12em] text-n5 uppercase">
								{COMPOSER_COPY.amountLabel}
							</span>
							<span className="flex items-baseline gap-1">
								<span className="text-sm text-n5">Đ</span>
								<Input
									value={amount}
									inputMode="decimal"
									disabled={floorAbove || inFlight}
									aria-label="Stake amount"
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
									className={`h-auto w-28 border-none p-0 text-right font-mono text-[22px] font-extrabold tabular-nums shadow-none [border:none] ${
										assess.overCap ? "text-n4" : ""
									}`}
								/>
							</span>
						</div>
						<div className="my-1.5 border-t border-n2" />
						<div className="flex items-center justify-between">
							<span className="text-[9.5px] font-bold tracking-[0.12em] text-n5 uppercase">
								{COMPOSER_COPY.toWinLabel}
							</span>
							<span aria-live="polite" className="font-mono text-sm text-ink">
								{toWin !== null ? `Đ ${toWin}` : "—"}
							</span>
						</div>
					</div>
					<Button
						type="button"
						disabled={submitDisabled}
						aria-disabled={submitDisabled}
						onClick={submit}
						className="h-auto min-h-[34px] self-end px-4 py-[7px] text-[13px]"
					>
						{COMPOSER_COPY.submit}
					</Button>
				</div>

				{/* W2.10-D: over-cap = typing allowed, submit disabled, strip shown. */}
				{assess.overCap && (
					<div className="mt-1.5 text-xs text-n5">{overCapStrip()}</div>
				)}
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
