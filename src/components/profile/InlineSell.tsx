"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { parseWireResponse } from "@/components/debate/composer/envelope";
import {
	initialKeyState,
	reduceKey,
} from "@/components/debate/composer/idempotency";
import { buildSellRequest } from "@/components/debate/composer/requests";
import {
	ComposerDecimal,
	sellSharesFor,
} from "@/components/debate/composer/sell-convert";
import { keyOutcomeFor } from "@/components/debate/composer/state-map";
import { Input } from "@/components/ui/input";

/**
 * POSREV-1 RF-5/6/7 — **EXITING ONE ARGUMENT, INLINE, IN TWO STEPS.**
 *
 * The Sell control lives in the tile's own last column and arms in place: the
 * Current cell becomes an amount field seeded with that argument's full value,
 * Sell becomes Confirm, and a ✕ appears beside it. Pressing a money button is
 * the one action on this surface that cannot be undone, so it takes two
 * deliberate presses — and the second press is only ever a cushion if there is a
 * way out of it, which is why Escape, a click outside and the ✕ all cancel. A
 * two-step with no exit is a trap wearing a cushion's clothes.
 *
 * ⛔ **NO NEW REQUEST PATH IS INVENTED.** Every piece of wire machinery here is
 * the shipped one: `sellSharesFor` for the Đ→shares conversion, `buildSellRequest`
 * for the body (including the optional `lotId` that names the argument),
 * `initialKeyState`/`reduceKey` for the §3.2 idempotency key law, and
 * `parseWireResponse` for the envelope. What is new is the ANATOMY — a cell, not
 * a strip — and nothing below reaches past the same endpoint the composer uses.
 *
 * ⚠⚠ **THE SEED IS THE ONE THING HERE THAT CAN LOSE SOMEONE MONEY.**
 * `sellSharesFor` returns the held quantity BYTE-IDENTICALLY when `dharmaIn`
 * equals `currentValue` (`sell-convert.ts:54`) — zero arithmetic, so a full exit
 * lands on exactly zero surviving shares. Round the seed and that branch misses:
 * the conversion divides instead, the result floors, and "sell everything"
 * strands dust that can never be sold afterwards because it is smaller than the
 * argument it belongs to. So the EXACT value is held in state, a ROUNDED figure
 * is displayed, and an UNTOUCHED field submits the exact one. `seedExact` is the
 * same string handed to `sellSharesFor` as `currentValue`, so the equality is
 * structural rather than a coincidence of formatting.
 * (SPEC.1 §10.8's sanctioned exception — a seed is an input, not a rendered
 * figure.)
 *
 * ⚠ **ONE ROW ARMS AT A TIME**, and that is why the armed id lives in the TABLE
 * rather than here: two live money inputs on one screen is how someone sells the
 * argument next to the one they meant.
 */

/** How long the tile holds its `Sold` state before the data refreshes under it. */
const SOLD_DWELL_MS = 900;

export type InlineSellController = ReturnType<typeof useInlineSell>;

export function useInlineSell() {
	const router = useRouter();
	const [armedLotId, setArmedLotId] = useState<string | null>(null);
	/** `null` ⇒ the seed is UNTOUCHED, which is what makes the exact submit safe. */
	const [draft, setDraft] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);
	const [failed, setFailed] = useState(false);
	/** The tile holding its brief in-place `Sold` state. */
	const [soldLotId, setSoldLotId] = useState<string | null>(null);
	const [keyState, setKeyState] = useState(() => initialKeyState());
	const armedRowRef = useRef<HTMLTableRowElement | null>(null);
	const dwellRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const cancel = useCallback(() => {
		setArmedLotId(null);
		setDraft(null);
		setFailed(false);
	}, []);

	const arm = useCallback((lotId: string) => {
		// Opening a second closes the first: the state is a single id, so this is
		// structural rather than a rule someone has to remember to apply.
		setArmedLotId(lotId);
		setDraft(null);
		setFailed(false);
	}, []);

	/**
	 * Every keystroke. ⚠ A value ABOVE the argument's own current value CLAMPS
	 * SILENTLY, and the clamp returns the field to its UNTOUCHED state rather than
	 * writing the rounded maximum into it. That is not tidiness: writing the
	 * displayed maximum would make "type a big number" submit a ROUNDED figure,
	 * which is precisely the seed defect this component exists to avoid. Returning
	 * to untouched means the correct answer — the exact value — is what goes out.
	 * ⛔ NO ERROR STATE. The correct answer is available, so it is used; an error
	 * here would ask the reader to solve a problem the field already solved.
	 */
	const edit = useCallback((value: string, seedExact: string) => {
		if (value === "") {
			setDraft("");
			return;
		}
		let typed: InstanceType<typeof ComposerDecimal>;
		try {
			typed = new ComposerDecimal(value);
		} catch {
			// Not a number yet — a lone "." mid-typing. Keep it; the submit gate
			// below refuses anything `sellSharesFor` would reject.
			setDraft(value);
			return;
		}
		if (!typed.isFinite()) {
			setDraft(value);
			return;
		}
		if (typed.greaterThan(seedExact)) {
			setDraft(null);
			return;
		}
		setDraft(value);
	}, []);

	useEffect(() => {
		return () => {
			if (dwellRef.current !== null) {
				clearTimeout(dwellRef.current);
			}
		};
	}, []);

	/**
	 * Escape and click-outside, wired only while a row is armed.
	 *
	 * ⚠ BOUND TO `document`, and the objection the market popover's own listener
	 * raises does not apply: this handles Escape and pointerdown, neither of which
	 * the page uses for scrolling, and it calls no `preventDefault`.
	 */
	useEffect(() => {
		if (armedLotId === null || busy) {
			return;
		}
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				cancel();
			}
		};
		const onPointer = (e: PointerEvent) => {
			if (!armedRowRef.current?.contains(e.target as Node)) {
				cancel();
			}
		};
		document.addEventListener("keydown", onKey);
		document.addEventListener("pointerdown", onPointer);
		return () => {
			document.removeEventListener("keydown", onKey);
			document.removeEventListener("pointerdown", onPointer);
		};
	}, [armedLotId, busy, cancel]);

	const confirm = useCallback(
		/**
		 * @param tileKey the ARMED tile's identity — a lot id, or a market id for
		 *   the whole-holding fallback. It is what the `Sold` dwell keys on, and it
		 *   is deliberately SEPARATE from `args.lotId`, which may be absent.
		 */
		async (
			tileKey: string,
			args: {
				marketId: string;
				/**
				 * ⚠ OPTIONAL. Absent ⇒ a POSITION-level sell — which is exactly what a
				 * holding with no attribution can honestly ask for, and what every
				 * pre-LOTS-1 client meant. `buildSellRequest` drops the key rather than
				 * sending `null`, because the two spellings canonicalize to different
				 * idempotency fingerprints and a retry under the fuller form would come
				 * back 409 `error_idempotency_key_reused`.
				 */
				lotId?: string;
				/** The EXACT partition — the seed AND `sellSharesFor`'s `currentValue`. */
				seedExact: string;
				/** This argument's surviving shares — the conversion's ceiling. */
				maxShares: string;
			},
		) => {
			if (busy) {
				return;
			}
			// ⛔ UNTOUCHED ⇒ THE EXACT VALUE. See the seed block above.
			const amount = draft ?? args.seedExact;
			let shares: string;
			try {
				shares = sellSharesFor({
					quantity: args.maxShares,
					currentValue: args.seedExact,
					dharmaIn: amount,
				});
			} catch {
				// A non-positive or malformed amount — the field is mid-edit. Refuse
				// quietly; the participant has not asked for anything yet.
				setFailed(true);
				return;
			}
			setBusy(true);
			setFailed(false);
			const next = reduceKey(keyState, { type: "SUBMIT" });
			setKeyState(next);
			const { url, init } = buildSellRequest({
				body: {
					marketId: args.marketId,
					shares,
					...(args.lotId === undefined ? {} : { lotId: args.lotId }),
				},
				idempotencyKey: next.key,
			});
			try {
				const res = await fetch(url, init);
				const outcome = await parseWireResponse(res);
				if (outcome.kind === "success") {
					setKeyState(reduceKey(next, { type: "OUTCOME", outcome: "success" }));
					setBusy(false);
					setArmedLotId(null);
					setDraft(null);
					// ⚠⚠ THE BRIEF `Sold` STATE IS NOT DECORATION. On a full exit the tile
					// is about to leave the Open tab entirely — without a beat in place
					// first, someone presses a money button and the thing they were
					// looking at silently vanishes, which reads as a bug even when it
					// worked exactly as intended.
					// ⛔ THE PREDICATE IS `shares === maxShares`, i.e. the conversion took
					// the byte-identical full-exit branch. Never a comparison of PRINTED
					// figures (§10.8) and never "close to zero".
					if (shares === args.maxShares) {
						setSoldLotId(tileKey);
						dwellRef.current = setTimeout(() => {
							setSoldLotId(null);
							router.refresh();
						}, SOLD_DWELL_MS);
					} else {
						// Partial: the figures reduce and the control returns to Sell. No
						// tag — a reduced number is the signal, and a tag would say more
						// than happened.
						router.refresh();
					}
					return;
				}
				setKeyState(
					reduceKey(next, {
						type: "OUTCOME",
						outcome:
							outcome.kind === "malformed"
								? outcome.status >= 500
									? "transient"
									: "terminal"
								: keyOutcomeFor({ kind: "error", code: outcome.code }),
					}),
				);
				setBusy(false);
				setFailed(true);
			} catch {
				setKeyState(reduceKey(next, { type: "OUTCOME", outcome: "transient" }));
				setBusy(false);
				setFailed(true);
			}
		},
		[busy, draft, keyState, router],
	);

	return {
		armedLotId,
		draft,
		busy,
		failed,
		soldLotId,
		armedRowRef,
		arm,
		cancel,
		edit,
		confirm,
	};
}

/**
 * The amount field that replaces the Current figure while a tile is armed.
 * ⚠ `value` is `draft ?? seedDisplay` — the DISPLAYED figure when untouched, so
 * the number in the field is the number the reader was already looking at.
 */
export function InlineSellAmount({
	tileKey,
	seedDisplay,
	seedExact,
	disabled,
	onEdit,
	onSubmit,
	draft,
}: {
	tileKey: string;
	seedDisplay: string;
	seedExact: string;
	disabled: boolean;
	draft: string | null;
	onEdit: (value: string, seedExact: string) => void;
	onSubmit: () => void;
}): React.JSX.Element {
	return (
		<span className="inline-flex items-baseline gap-1">
			<span className="text-n5">Đ</span>
			<Input
				value={draft ?? seedDisplay}
				inputMode="decimal"
				disabled={disabled}
				aria-label="Amount to sell"
				data-testid={`tile-sell-amount-${tileKey}`}
				onChange={(e) => onEdit(e.target.value, seedExact)}
				onKeyDown={(e) => {
					if (e.key === "Enter") {
						e.preventDefault();
						onSubmit();
					}
				}}
				className="h-auto w-[74px] border-none p-0 text-right font-mono text-sm font-extrabold tabular-nums shadow-none [border:none]"
			/>
		</span>
	);
}
