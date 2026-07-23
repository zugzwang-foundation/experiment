"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { SideBadge } from "../badges";
import { formatDharmaExact } from "../format";
import type { ViewerMarketContext } from "../types";
import { COMPOSER_COPY, formatDharmaGrouped, rateLimitedBanner } from "./copy";
import { type ComposerStatus, ErrorStrip } from "./ErrorStrip";
import { parseWireResponse } from "./envelope";
import { isPositiveAmount } from "./gating";
import { initialKeyState, reduceKey } from "./idempotency";
import { createQuoteReader, type QuoteResult } from "./quote-reader";
import { buildSellRequest } from "./requests";
import { sellSharesFor } from "./sell-convert";
import { keyOutcomeFor, mapWireError } from "./state-map";

/** Canon §6 (Profile register) — the sell hint, verbatim. */
const SELL_HINT =
	"No argument needed — selling is the only comment-free action. Default = full position; edit for a partial sell.";

/**
 * UI.A3 slice 4 — the W2.10-A sell module: Đ-denominated input (default =
 * FULL position — the FI-2 `currentValue` basis), live `You receive` via the
 * sell quote, comment-free, and NEVER clamped (SG-2 — the only bound is the
 * held quantity; sellSharesFor caps the conversion at it). You-receive-ONLY:
 * the P/L secondary readout REQUIRES the staked basis and is a DEFECT until
 * the OQ-1 founder ruling lands as its SPEC.1 line. Sold-to-zero renders the
 * `Sold · Exited` terminal tag.
 *
 * BUILT + WIRED + INTEGRATION-TESTED here; **MOUNTS AT A5** (ratified OQ-2a
 * — the A2 quote-route precedent: tests are the consumer; the anatomy is
 * design-pinned so A5 cannot bend it). No A3 surface renders it.
 */
export function SellModule(props: {
	marketId: string;
	slug: string;
	position: NonNullable<ViewerMarketContext["position"]>;
	onClose: () => void;
	/** P2 terminal reached (banned): the host disables entry controls. */
	onSuspended: () => void;
}) {
	const router = useRouter();
	// dround-allow: input seed, not a rendered figure. Read back by the
	// full-exit byte-identity check in sell-convert.ts; a rounded seed would
	// make "sell all" under-sell and strand dust. SPEC.1 §10.8 named exception.
	const [dharmaIn, setDharmaIn] = useState(() =>
		formatDharmaExact(props.position.currentValue),
	);
	const [keyState, setKeyState] = useState(() => initialKeyState());
	const [status, setStatus] = useState<ComposerStatus>({ phase: "idle" });
	const [quote, setQuote] = useState<QuoteResult | null>(null);
	const [countdown, setCountdown] = useState<number | null>(null);
	const [retryLock, setRetryLock] = useState(0);
	const [sold, setSold] = useState<null | { toZero: boolean }>(null);

	const keyRef = useRef(keyState);
	keyRef.current = keyState;
	const dispatchKey = useCallback((event: Parameters<typeof reduceKey>[1]) => {
		const next = reduceKey(keyRef.current, event);
		keyRef.current = next;
		setKeyState(next);
		return next;
	}, []);

	// The Đ→shares conversion (exact decimal, capped ≤ quantity — never a
	// stake clamp; SG-2).
	const shares = isPositiveAmount(dharmaIn)
		? sellSharesFor({
				quantity: props.position.quantity,
				currentValue: props.position.currentValue,
				dharmaIn,
			})
		: null;

	// Live `You receive` — the sell quote over the conversion output.
	const reader = useMemo(() => createQuoteReader(), []);
	useEffect(() => () => reader.cancel(), [reader]);
	useEffect(() => {
		if (shares === null) {
			setQuote(null);
			reader.cancel();
			return;
		}
		reader.request(
			{ kind: "sell", slug: props.slug, side: props.position.side, shares },
			setQuote,
		);
	}, [reader, shares, props.slug, props.position.side]);

	// P4 429 countdown (F-1: expiry re-enables under a FRESH key).
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

	// Transient lock: submit re-enables after retry_after (held key) — the
	// 503 family + the in-flight 409s' Retry-After (cascade M-4).
	useEffect(() => {
		if (retryLock <= 0) {
			return;
		}
		const t = setTimeout(() => setRetryLock((s) => s - 1), 1000);
		return () => clearTimeout(t);
	}, [retryLock]);

	const inFlight = status.phase === "in_flight";
	const errorState = status.phase === "error" ? status.state : null;
	// Cascade H-3: a cached-terminal answer locks submit until the next EDIT
	// re-mints (mirrors BetComposer; the F-2 landing included).
	const terminalLocked =
		errorState !== null &&
		(errorState.state === "p2_terminal_suspended" ||
			errorState.state === "p6_concluded" ||
			errorState.state === "p3_market_race" ||
			errorState.state === "p3_protective_landing" ||
			errorState.state === "p3_generic");
	const submitDisabled =
		inFlight ||
		shares === null ||
		countdown !== null ||
		retryLock > 0 ||
		terminalLocked ||
		sold !== null;

	/** Every amount change is an EDIT (the §3.2 key law — cascade H-3): after
	 * a terminal 4xx / the F-2 refresh, the edit re-mints; the strip clears. */
	const onEditAmount = (value: string) => {
		if (inFlight) {
			return;
		}
		setDharmaIn(value);
		dispatchKey({ type: "EDIT" });
		if (terminalLocked && errorState?.state !== "p2_terminal_suspended") {
			setStatus({ phase: "idle" });
		}
	};

	async function submitSell() {
		if (submitDisabled || shares === null) {
			return;
		}
		const next = dispatchKey({ type: "SUBMIT" });
		setStatus({ phase: "in_flight" });
		const { url, init } = buildSellRequest({
			body: { marketId: props.marketId, shares },
			idempotencyKey: next.key,
		});
		let outcome: Awaited<ReturnType<typeof parseWireResponse>>;
		try {
			const res = await fetch(url, init);
			outcome = await parseWireResponse(res);
		} catch {
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
			const soldAll =
				typeof outcome.data === "object" &&
				outcome.data !== null &&
				shares === props.position.quantity;
			setSold({ toZero: soldAll });
			setStatus({ phase: "idle" });
			router.refresh();
			return;
		}
		if (outcome.kind === "malformed") {
			dispatchKey({
				type: "OUTCOME",
				outcome: outcome.status >= 500 ? "transient" : "terminal",
			});
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
		if (mapped.state === "p2_terminal_suspended") {
			props.onSuspended();
		} else if (mapped.state === "p3_protective_landing") {
			// F-2 for sell: the earlier sell may have completed — refresh, no
			// auto-resubmit.
			router.refresh();
			dispatchKey({ type: "REFRESHED" });
		} else if (mapped.state === "p4_rate_limited") {
			setCountdown(mapped.retryAfterSeconds ?? 30);
		} else if (
			mapped.state === "p3_transient_retry" ||
			mapped.state === "p3_wait_in_flight"
		) {
			setRetryLock(mapped.retryAfterSeconds ?? 0);
		}
	}

	const receive =
		quote !== null && quote.kind === "quote" && quote.data.kind === "sell"
			? formatDharmaGrouped(String(quote.data.proceeds ?? "—"))
			: null;

	if (sold !== null) {
		// A3 terminal (W2.10): Exited = you left (light outlined tag).
		return (
			<div className="flex items-center gap-2 text-xs">
				{sold.toZero ? (
					<span className="rounded-(--r-chip) px-2 py-0.5 font-bold text-n5 [border:var(--hairline)]">
						Sold · Exited
					</span>
				) : (
					<span className="text-n5">{COMPOSER_COPY.sell} ✓</span>
				)}
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-2">
			{countdown !== null && (
				<div
					role="status"
					aria-live="polite"
					className="rounded-(--r-chip) bg-n1 px-3 py-2 text-xs text-ink"
				>
					<b>{rateLimitedBanner(countdown)}</b>
				</div>
			)}
			<div className="flex items-center gap-3 text-xs" title={SELL_HINT}>
				<span className="flex items-center gap-1.5">
					<SideBadge side={props.position.side} />
					<span className="text-[10px] font-bold tracking-[0.1em] text-n5 uppercase">
						Position
					</span>
				</span>
				<span className="flex items-baseline gap-1">
					<span className="text-sm text-n5">Đ</span>
					<Input
						value={dharmaIn}
						inputMode="decimal"
						disabled={inFlight}
						aria-label="Amount to sell"
						onChange={(e) => onEditAmount(e.target.value)}
						className="h-auto w-24 border-none p-0 text-right font-mono text-base font-extrabold tabular-nums shadow-none [border:none]"
					/>
				</span>
				<span className="flex items-center gap-1 text-[10px] font-bold tracking-[0.1em] text-n5 uppercase">
					<span>You receive</span>
					<span
						aria-live="polite"
						className="font-mono text-xs tracking-normal text-ink normal-case"
					>
						{receive !== null ? `Đ ${receive}` : "—"}
					</span>
				</span>
				<span className="ml-auto flex items-center gap-1.5">
					<Button
						type="button"
						variant="ghost"
						size="sm"
						disabled={inFlight}
						onClick={props.onClose}
					>
						Cancel
					</Button>
					<Button
						type="button"
						size="sm"
						disabled={submitDisabled}
						aria-disabled={submitDisabled}
						onClick={submitSell}
					>
						{COMPOSER_COPY.sell}
					</Button>
				</span>
			</div>
			<ErrorStrip status={status} />
		</div>
	);
}
