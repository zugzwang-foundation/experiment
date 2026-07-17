import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	type Mock,
	vi,
} from "vitest";
import {
	createQuoteReader,
	QUOTE_DEBOUNCE_MS,
	type QuoteRequest,
	type QuoteResult,
} from "@/components/debate/composer/quote-reader";
import { BET_MAX_STAKE } from "@/server/config/limits";

// UI.A3 §5.6 tests-first — the debounced quote reader (plan §3.1 read cadence
// + §7 "Unit — quote reader" row). PURE / NETWORK-FREE: fake timers + an
// injected fetchFn spy; REDs NOW on the unresolvable greenfield import and
// GREENs when the module lands.
//
// Plan rows asserted here:
//   - SG-2 adjacency — the SELL preview never sends a `stake` param (and the
//     buy preview never sends `shares`): the URL contract is spied byte-level.
//   - Clamp surfacing (W2.10-D / SPEC.1 §16.1) — the buy bundle's `clamped`
//     field passes through UNTOUCHED to the caller (the over-cap preview
//     shows the at-cap figures).
//   - Plan §5 "Quote route errors mid-typing" — non-200 / malformed / network
//     failure degrade to {kind:"degraded"} (preview → "—"), NO state
//     escalation; an ABORTED fetch is silent (superseded), never degraded.
//   - Debounce ~300ms + in-flight AbortController cancellation is the
//     client's good citizenship on the deliberately un-rate-limited quote
//     route (A2 OQ-5b).
//
// PINNED PUBLIC-API CONTRACT (the implementer matches these names exactly):
//   QUOTE_DEBOUNCE_MS: 300   // DELIBERATELY LITERAL — a client-owned cadence
//                            // constant (plan §3.1 "~300ms"), not a
//                            // limits.ts import
//   type QuoteRequest = { slug: string; side: "YES" | "NO" }
//     & ({ kind: "buy"; stake: string } | { kind: "sell"; shares: string })
//   type QuoteResult =
//     | { kind: "quote"; data: Record<string, unknown> }
//     | { kind: "degraded" }
//   createQuoteReader(deps?: { fetchFn?: typeof fetch; debounceMs?: number }):
//     { request(req: QuoteRequest, onResult: (r: QuoteResult) => void): void;
//       cancel(): void }
//     — trailing debounce (one fetch per window, LAST request wins); a newer
//       request aborts an in-flight fetch; cancel() clears the pending timer
//       AND aborts in-flight; no callback ever fires after cancel/abort.

const SLUG = "fixture-market";

const BUY_QUOTE: Record<string, unknown> = {
	stake: "25",
	clamped: false,
	shares: "48.5",
	p0: "0.5",
	pEff: "0.51",
	p1: "0.52",
	impact: "0.02",
};

const CLAMPED_QUOTE: Record<string, unknown> = {
	stake: BET_MAX_STAKE,
	clamped: true,
	shares: "9000",
	p0: "0.5",
	pEff: "0.55",
	p1: "0.6",
	impact: "0.1",
};

function okQuote(data: Record<string, unknown>): Response {
	return new Response(JSON.stringify({ ok: true, data }), {
		status: 200,
		headers: { "content-type": "application/json" },
	});
}

function buyReq(stake: string): QuoteRequest {
	return { kind: "buy", slug: SLUG, side: "YES", stake };
}

function sellReq(shares: string): QuoteRequest {
	return { kind: "sell", slug: SLUG, side: "NO", shares };
}

/** Collector-style onResult — array contents ARE the assertion surface. */
function collector(): { results: QuoteResult[]; on: (r: QuoteResult) => void } {
	const results: QuoteResult[] = [];
	return { results, on: (r) => results.push(r) };
}

/** Drain the microtask queue (fetch → json → onResult chains). */
async function flushMicrotasks(): Promise<void> {
	for (let i = 0; i < 20; i += 1) {
		await Promise.resolve();
	}
}

/**
 * A fetch double whose FIRST call hangs on an abortable promise (rejecting
 * with a real AbortError when its signal aborts — the fetch contract) and
 * whose later calls resolve a 200 quote. Exposes the first call's signal.
 */
function hangingFirstFetch(data: Record<string, unknown>): {
	fetchFn: Mock<typeof globalThis.fetch>;
	firstSignal: () => AbortSignal | undefined;
} {
	let call = 0;
	let captured: AbortSignal | undefined;
	const fetchFn = vi.fn<typeof globalThis.fetch>(
		(_input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
			call += 1;
			if (call === 1) {
				const signal = init?.signal ?? undefined;
				captured = signal;
				return new Promise<Response>((_resolve, reject) => {
					const fail = () =>
						reject(
							new DOMException("The operation was aborted.", "AbortError"),
						);
					if (signal?.aborted) {
						fail();
						return;
					}
					signal?.addEventListener("abort", fail);
				});
			}
			return Promise.resolve(okQuote(data));
		},
	);
	return { fetchFn, firstSignal: () => captured };
}

function urlOfCall(fetchFn: Mock<typeof globalThis.fetch>, index = 0): URL {
	const raw = fetchFn.mock.calls[index]?.[0];
	return new URL(String(raw), "http://localhost");
}

beforeEach(() => {
	vi.useFakeTimers();
});

afterEach(() => {
	vi.useRealTimers();
});

describe("quote-reader — constants", () => {
	it("quote-reader::debounce-constant-pinned-300", () => {
		// Deliberately literal (plan §3.1 "~300ms" — client-owned, not a
		// limits.ts constant).
		expect(QUOTE_DEBOUNCE_MS).toBe(300);
	});
});

describe("quote-reader — trailing debounce", () => {
	it("quote-reader::three-rapid-requests-collapse-to-one-fetch-for-the-last", async () => {
		const fetchFn = vi.fn<typeof globalThis.fetch>(async () =>
			okQuote(BUY_QUOTE),
		);
		const reader = createQuoteReader({ fetchFn });
		const { on } = collector();
		reader.request(buyReq("10"), on);
		reader.request(buyReq("20"), on);
		reader.request(buyReq("25"), on);
		// Trailing: nothing fires inside the window.
		expect(fetchFn).not.toHaveBeenCalled();
		await vi.advanceTimersByTimeAsync(QUOTE_DEBOUNCE_MS - 1);
		expect(fetchFn).not.toHaveBeenCalled();
		await vi.advanceTimersByTimeAsync(1);
		expect(fetchFn).toHaveBeenCalledTimes(1);
		// The ONE fetch carries the LAST request's params.
		expect(urlOfCall(fetchFn).searchParams.get("stake")).toBe("25");
	});

	it("quote-reader::custom-debounce-ms-is-honored", async () => {
		const fetchFn = vi.fn<typeof globalThis.fetch>(async () =>
			okQuote(BUY_QUOTE),
		);
		const reader = createQuoteReader({ fetchFn, debounceMs: 50 });
		const { on } = collector();
		reader.request(buyReq("10"), on);
		await vi.advanceTimersByTimeAsync(49);
		expect(fetchFn).not.toHaveBeenCalled();
		await vi.advanceTimersByTimeAsync(1);
		expect(fetchFn).toHaveBeenCalledTimes(1);
	});
});

describe("quote-reader — URL contract", () => {
	it("quote-reader::buy-sends-side-and-stake-never-shares", async () => {
		const fetchFn = vi.fn<typeof globalThis.fetch>(async () =>
			okQuote(BUY_QUOTE),
		);
		const reader = createQuoteReader({ fetchFn });
		const { on } = collector();
		reader.request(buyReq("25"), on);
		await vi.advanceTimersByTimeAsync(QUOTE_DEBOUNCE_MS);
		const url = urlOfCall(fetchFn);
		expect(url.pathname).toBe(`/m/${SLUG}/quote`);
		expect(url.searchParams.get("side")).toBe("YES");
		expect(url.searchParams.get("stake")).toBe("25");
		expect(url.searchParams.has("shares")).toBe(false);
	});

	it("quote-reader::sell-sends-side-and-shares-never-stake (SG-2)", async () => {
		// The sell preview NEVER sends stake — the clamp's input never even
		// exists on the sell wire (SG-2 adjacency).
		const fetchFn = vi.fn<typeof globalThis.fetch>(async () =>
			okQuote({ shares: "12.5", proceeds: "9.9" }),
		);
		const reader = createQuoteReader({ fetchFn });
		const { on } = collector();
		reader.request(sellReq("12.5"), on);
		await vi.advanceTimersByTimeAsync(QUOTE_DEBOUNCE_MS);
		const url = urlOfCall(fetchFn);
		expect(url.pathname).toBe(`/m/${SLUG}/quote`);
		expect(url.searchParams.get("side")).toBe("NO");
		expect(url.searchParams.get("shares")).toBe("12.5");
		expect(url.searchParams.has("stake")).toBe(false);
	});
});

describe("quote-reader — success delivery", () => {
	it("quote-reader::success-delivers-the-bundle-clamped-passes-through", async () => {
		const fetchFn = vi.fn<typeof globalThis.fetch>(async () =>
			okQuote(CLAMPED_QUOTE),
		);
		const reader = createQuoteReader({ fetchFn });
		const { results, on } = collector();
		reader.request(buyReq("20000"), on);
		await vi.advanceTimersByTimeAsync(QUOTE_DEBOUNCE_MS);
		await flushMicrotasks();
		expect(results).toEqual([{ kind: "quote", data: CLAMPED_QUOTE }]);
		const first = results[0];
		if (first?.kind !== "quote") throw new Error("expected a quote result");
		// `clamped` reaches the callback untouched (W2.10-D preview law).
		expect(first.data.clamped).toBe(true);
	});
});

describe("quote-reader — in-flight cancellation", () => {
	it("quote-reader::a-newer-request-aborts-the-in-flight-fetch", async () => {
		const { fetchFn, firstSignal } = hangingFirstFetch(BUY_QUOTE);
		const reader = createQuoteReader({ fetchFn });
		const a = collector();
		const b = collector();
		reader.request(buyReq("10"), a.on);
		await vi.advanceTimersByTimeAsync(QUOTE_DEBOUNCE_MS);
		expect(fetchFn).toHaveBeenCalledTimes(1);
		// The reader passed an AbortSignal to the fetch it dispatched.
		expect(firstSignal()).toBeDefined();
		// A newer request supersedes the pending one…
		reader.request(buyReq("25"), b.on);
		await vi.advanceTimersByTimeAsync(QUOTE_DEBOUNCE_MS);
		await flushMicrotasks();
		expect(fetchFn).toHaveBeenCalledTimes(2);
		// …its signal is aborted, its callback NEVER fires (not even
		// degraded — aborted = superseded, silent)…
		expect(firstSignal()?.aborted).toBe(true);
		expect(a.results).toEqual([]);
		// …and the newer request completes normally.
		expect(b.results).toEqual([{ kind: "quote", data: BUY_QUOTE }]);
	});
});

describe("quote-reader — degraded preview (plan §5)", () => {
	it("quote-reader::non-200-degrades", async () => {
		const fetchFn = vi.fn<typeof globalThis.fetch>(
			async () =>
				new Response(
					JSON.stringify({
						ok: false,
						error: { code: "error_session_required", message: "session" },
					}),
					{ status: 401, headers: { "content-type": "application/json" } },
				),
		);
		const reader = createQuoteReader({ fetchFn });
		const { results, on } = collector();
		reader.request(buyReq("25"), on);
		await vi.advanceTimersByTimeAsync(QUOTE_DEBOUNCE_MS);
		await flushMicrotasks();
		expect(results).toEqual([{ kind: "degraded" }]);
	});

	it("quote-reader::malformed-json-degrades", async () => {
		const fetchFn = vi.fn<typeof globalThis.fetch>(
			async () =>
				new Response("<!doctype html>", {
					status: 200,
					headers: { "content-type": "text/html" },
				}),
		);
		const reader = createQuoteReader({ fetchFn });
		const { results, on } = collector();
		reader.request(buyReq("25"), on);
		await vi.advanceTimersByTimeAsync(QUOTE_DEBOUNCE_MS);
		await flushMicrotasks();
		expect(results).toEqual([{ kind: "degraded" }]);
	});

	it("quote-reader::non-abort-fetch-rejection-degrades", async () => {
		const fetchFn = vi.fn<typeof globalThis.fetch>(async () => {
			throw new Error("network down");
		});
		const reader = createQuoteReader({ fetchFn });
		const { results, on } = collector();
		reader.request(buyReq("25"), on);
		await vi.advanceTimersByTimeAsync(QUOTE_DEBOUNCE_MS);
		await flushMicrotasks();
		expect(results).toEqual([{ kind: "degraded" }]);
	});
});

describe("quote-reader — cancel()", () => {
	it("quote-reader::cancel-clears-a-pending-debounce-timer", async () => {
		const fetchFn = vi.fn<typeof globalThis.fetch>(async () =>
			okQuote(BUY_QUOTE),
		);
		const reader = createQuoteReader({ fetchFn });
		const { results, on } = collector();
		reader.request(buyReq("25"), on);
		reader.cancel();
		await vi.advanceTimersByTimeAsync(QUOTE_DEBOUNCE_MS * 2);
		await flushMicrotasks();
		expect(fetchFn).not.toHaveBeenCalled();
		expect(results).toEqual([]);
	});

	it("quote-reader::cancel-aborts-in-flight-and-suppresses-all-callbacks", async () => {
		const { fetchFn, firstSignal } = hangingFirstFetch(BUY_QUOTE);
		const reader = createQuoteReader({ fetchFn });
		const { results, on } = collector();
		reader.request(buyReq("25"), on);
		await vi.advanceTimersByTimeAsync(QUOTE_DEBOUNCE_MS);
		expect(fetchFn).toHaveBeenCalledTimes(1);
		reader.cancel();
		await flushMicrotasks();
		expect(firstSignal()?.aborted).toBe(true);
		// The AbortError rejection is swallowed — NOT surfaced as degraded.
		expect(results).toEqual([]);
		await vi.advanceTimersByTimeAsync(1000);
		await flushMicrotasks();
		expect(results).toEqual([]);
	});
});
