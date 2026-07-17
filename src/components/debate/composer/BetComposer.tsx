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
	C1_PROTECTIVE_LANDING,
	COMPOSER_COPY,
	c2Sentence,
	formatDharmaGrouped as formatGrouped,
	overCapStrip,
	rateLimitedBanner,
	STATE_COPY,
	SUSPENDED_COPY,
} from "./copy";
import { parseWireResponse } from "./envelope";
import {
	assessAmount,
	type ComposerKind,
	floorFor,
	isPositiveAmount,
} from "./gating";
import { initialKeyState, type KeyState, reduceKey } from "./idempotency";
import {
	composeWireBody,
	isArgumentSubmittable,
	TITLE_MAX_CHARS,
} from "./payload";
import { createQuoteReader, type QuoteResult } from "./quote-reader";
import { buildPlaceRequest } from "./requests";
import {
	type ComposerErrorState,
	keyOutcomeFor,
	mapWireError,
} from "./state-map";

/** The composer's submit status (the §4 render contract's local half). */
type ComposerStatus =
	| { phase: "idle" }
	| { phase: "in_flight" }
	| { phase: "error"; state: ComposerErrorState; code: string };

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
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				props.onClose();
			}
		};
		document.addEventListener("keydown", onKey);
		return () => document.removeEventListener("keydown", onKey);
	});

	const inFlight = status.phase === "in_flight";
	const errorState = status.phase === "error" ? status.state : null;
	const terminalLocked =
		errorState !== null &&
		(errorState.state === "p2_terminal_suspended" ||
			errorState.state === "p6_concluded" ||
			errorState.state === "p3_market_race" ||
			errorState.state === "p3_revise_blocked" ||
			errorState.state === "p3_protective_landing");
	const submitDisabled =
		inFlight ||
		floorAbove ||
		!argOk ||
		!assess.submitEnabled ||
		countdown !== null ||
		retryLock > 0 ||
		terminalLocked;

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
		const next = dispatchKey({ type: "SUBMIT" });
		setStatus({ phase: "in_flight" });
		const wireBody = composeWireBody({ title, extended });
		const { url, init } = buildPlaceRequest({
			body: {
				marketId: props.marketId,
				side: props.side,
				stake: assess.clampedAmount,
				body: wireBody,
				...(props.parentCommentId !== undefined
					? { parentCommentId: props.parentCommentId }
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

	const extendedMax = COMMENT_MAX_LENGTH - title.trim().length - 2;
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
					aria-label="Close"
					className="ml-auto rounded-(--r-chip) px-1.5 text-base text-n4 transition-all hover:text-ink focus-visible:shadow-(--state-focus-ring)"
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
				<DialogContent>
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

/** The §4 inline state strips (kit-verbatim copy; SG-3: never echoes content). */
function ErrorStrip({ status }: { status: ComposerStatus }) {
	if (status.phase !== "error") {
		return null;
	}
	const { state } = status.state;
	if (
		state === "p2_terminal_suspended" ||
		state === "p4_rate_limited" ||
		state === "auth_gate" ||
		state === "route_onboarding"
	) {
		return null; // rendered elsewhere (modal / banner / swap / route)
	}
	let title: string;
	let body: string;
	switch (state) {
		case "p3_revise_blocked":
			title = STATE_COPY.trackB.title;
			body = STATE_COPY.trackB.body;
			break;
		case "p3_gate_down":
			title = STATE_COPY.gateDown.title;
			body = STATE_COPY.gateDown.body;
			break;
		case "p3_wait_in_flight":
			title = STATE_COPY.waitInFlight;
			body = "";
			break;
		case "p3_transient_retry":
			title = STATE_COPY.transient.title;
			body = STATE_COPY.transient.body;
			break;
		case "p3_protective_landing":
			title = C1_PROTECTIVE_LANDING.title;
			body = C1_PROTECTIVE_LANDING.body;
			break;
		case "p3_market_race":
			if (status.code === "market_resolving") {
				title = STATE_COPY.resolving.title;
				body = STATE_COPY.resolving.body;
			} else {
				title = STATE_COPY.marketClosed.title;
				body = STATE_COPY.marketClosed.body;
			}
			break;
		case "p6_concluded":
			title = STATE_COPY.frozen.lead;
			body = STATE_COPY.frozen.body;
			break;
		default:
			title = STATE_COPY.generic.title;
			body = STATE_COPY.generic.body;
			break;
	}
	return (
		<div
			role="status"
			aria-live="polite"
			className="rounded-(--r-chip) bg-n1 px-3 py-2 text-xs"
		>
			<span className="block font-semibold text-ink">{title}</span>
			{body !== "" && <span className="text-n5">{body}</span>}
		</div>
	);
}
