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
		fetchFn(`/m/${req.slug}/quote?${params.toString()}`, {
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
