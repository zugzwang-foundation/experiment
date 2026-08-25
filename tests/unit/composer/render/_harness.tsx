import { vi } from "vitest";

import type { ViewerMarketContext } from "@/components/debate/types";

/**
 * OQ-7c (UI-A3 Ratification, lane follow-up) — shared fixtures for the
 * composer RENDER suites (R-1..R-5). Underscore-prefixed: never collected by
 * the vitest include glob. Fixture prose reuses the shipped composer-suite
 * strings (payload.test.ts / requests.test.ts / quote-reader.test.ts) — no
 * invented market content (CLAUDE.md §3).
 */

export const MARKET_ID = "0190b3a0-9999-7000-8000-000000000009";
export const SLUG = "fixture-market";

/** Reused fixture prose (payload.test.ts). */
export const TITLE = "The base rate argument.";
export const EXTENDED = "The extended argument, first paragraph.";

/** No held position; spendable comfortably above the post floor (10). */
export const VIEWER: ViewerMarketContext = {
	position: null,
	balance: "100",
	spendableToday: "100",
};

/** The minimal BetComposer prop set (post variant, YES slot). */
export function composerProps(handlers?: {
	onClose?: () => void;
	onSuspended?: () => void;
}) {
	return {
		marketId: MARKET_ID,
		slug: SLUG,
		side: "YES" as const,
		kind: "post" as const,
		viewer: VIEWER,
		onClose: handlers?.onClose ?? vi.fn(),
		onSuspended: handlers?.onSuspended ?? vi.fn(),
	};
}

/** The §4.4 error envelope, exactly as `envelope()` serializes it. */
export function wireError(
	code: string,
	opts?: { message?: string; retryAfter?: number },
) {
	return {
		ok: false,
		error: {
			code,
			message: opts?.message ?? "",
			...(opts?.retryAfter !== undefined
				? { retry_after: opts.retryAfter }
				: {}),
		},
	};
}

/**
 * Stub the global fetch: `/api/bets/*` consumes the queued envelopes in
 * order (a drained queue throws — any auto-resubmit fails loudly); the
 * debounced quote GET answers off-shape, degrading the To-win preview to
 * "—" (quote-reader law: degraded, never a state escalation).
 */
export function stubWireFetch(
	betResponses: Array<{ status: number; body: unknown }>,
) {
	const queue = [...betResponses];
	const fetchStub = vi.fn(async (input: RequestInfo | URL) => {
		const url = String(input);
		if (url.includes("/api/bets/")) {
			const next = queue.shift();
			if (next === undefined) {
				throw new Error("stubWireFetch: no queued bet-endpoint response");
			}
			return new Response(JSON.stringify(next.body), {
				status: next.status,
				headers: { "content-type": "application/json" },
			});
		}
		return new Response(JSON.stringify({}), { status: 200 });
	});
	vi.stubGlobal("fetch", fetchStub);
	return fetchStub;
}
