import { parseWireResponse } from "./envelope";

/**
 * UI.A3 slice 1 — the debounced quote reader (plan §3.1). Consumes
 * `GET /m/[slug]/quote` (the cpmm.md §6.4 bundle; advisory per §6.3 — the
 * authoritative figures are recomputed inside the W-1 tx). Trailing debounce
 * + in-flight AbortController cancellation is the client's good citizenship
 * on the deliberately un-rate-limited route (A2 OQ-5b; HARDEN.2 pointer
 * recorded). Errors degrade to `{kind:"degraded"}` (the preview renders "—")
 * — never a state escalation (plan §5); an aborted fetch is superseded,
 * silent.
 *
 * ⛔⛔ THE FIRST REQUEST OF A READER'S LIFE IS NOT DEBOUNCED, AND THE REASON IS A
 * DEFECT THE FOUNDER REPORTED FROM A PHONE (MOBILE-2c R-10).
 *
 * He opened the composer on the NO side at the Đ10 floor and `TO WIN` read a
 * bare em-dash. It was not a failure: measured locally on all four arms — post
 * and reply, from the bar and from a card — the row reads `—` at 2ms and becomes
 * numeric at **325-354ms**, every quote a 200 carrying real `shares`, and NO at
 * stake 10 is `Đ 12`, which is the number he had seen locally.
 *
 * The em-dash WAS the debounce. A trailing debounce exists so that typing a
 * four-digit stake sends one request instead of four — and a MOUNT is not a
 * keystroke. `BetComposer` seeds `amount` from the floor, so the very first
 * request is fully determined before the reader touches anything, and delaying
 * it buys nothing and costs the only `TO WIN` a phone participant can see
 * (`SlotHeader` and `PositionStrip`, the desktop's two prop-fed ones, are not
 * mounted on the phone tree). Add mobile RTT to 300ms and the dead dash is on
 * screen long enough to photograph.
 *
 * ⚠ WHY NOT A PENDING INDICATOR INSTEAD. Because it needs a new string, and new
 * strings are not this task's to invent. Firing immediately makes the window
 * ~RTT rather than ~RTT+300ms, which is the part that was actually ours.
 *
 * ⚠ IT IS ONE DISPATCH PER READER, NOT A LEADING-EDGE DEBOUNCE. A reader is
 * created per composer mount (`BetComposer`'s `useMemo(…, [])`), so this fires
 * once when the composer appears and every subsequent request — every keystroke
 * — is debounced exactly as before. `cancel()` deliberately does NOT rearm it:
 * clearing the stake field and typing a new one is editing, not opening.
 */

/** Client-owned cadence constant (plan §3.1 "~300ms") — not a limits.ts value. */
export const QUOTE_DEBOUNCE_MS = 300;

export type QuoteRequest = { slug: string; side: "YES" | "NO" } & (
	| { kind: "buy"; stake: string }
	| { kind: "sell"; shares: string }
);

export type QuoteResult =
	| { kind: "quote"; data: Record<string, unknown> }
	| { kind: "degraded" };

export function createQuoteReader(deps?: {
	fetchFn?: typeof fetch;
	debounceMs?: number;
}): {
	request(req: QuoteRequest, onResult: (r: QuoteResult) => void): void;
	cancel(): void;
} {
	const fetchFn = deps?.fetchFn ?? fetch;
	const debounceMs = deps?.debounceMs ?? QUOTE_DEBOUNCE_MS;

	let timer: ReturnType<typeof setTimeout> | null = null;
	let controller: AbortController | null = null;
	/** Has this reader ever dispatched? See the docblock's R-10 paragraph. */
	let dispatched = false;
	// Generation token: only the newest dispatch may deliver its result —
	// belt over the abort (a raced already-resolved response stays silent).
	let generation = 0;

	function dispatch(
		req: QuoteRequest,
		onResult: (r: QuoteResult) => void,
	): void {
		controller?.abort();
		const own = new AbortController();
		controller = own;
		generation += 1;
		const ownGeneration = generation;
		const deliver = (result: QuoteResult): void => {
			if (generation === ownGeneration && !own.signal.aborted) {
				onResult(result);
			}
		};
		const params = new URLSearchParams({ side: req.side });
		if (req.kind === "buy") {
			params.set("stake", req.stake);
		} else {
			// SG-2 adjacency: the sell preview never sends `stake`.
			params.set("shares", req.shares);
		}
		fetchFn(`/m/${encodeURIComponent(req.slug)}/quote?${params.toString()}`, {
			signal: own.signal,
		})
			.then(async (res) => {
				const outcome = await parseWireResponse(res);
				if (
					outcome.kind === "success" &&
					typeof outcome.data === "object" &&
					outcome.data !== null
				) {
					deliver({
						kind: "quote",
						data: outcome.data as Record<string, unknown>,
					});
				} else {
					deliver({ kind: "degraded" });
				}
			})
			.catch((err: unknown) => {
				// Aborted = superseded/cancelled — silent, never degraded.
				if (err instanceof Error && err.name === "AbortError") {
					return;
				}
				deliver({ kind: "degraded" });
			});
	}

	return {
		request(req, onResult): void {
			if (timer !== null) {
				clearTimeout(timer);
				timer = null;
			}
			if (!dispatched) {
				dispatched = true;
				dispatch(req, onResult);
				return;
			}
			timer = setTimeout(() => {
				timer = null;
				dispatch(req, onResult);
			}, debounceMs);
		},
		cancel(): void {
			if (timer !== null) {
				clearTimeout(timer);
				timer = null;
			}
			generation += 1;
			controller?.abort();
			controller = null;
		},
	};
}
