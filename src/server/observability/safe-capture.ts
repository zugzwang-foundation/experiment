import "server-only";

import { captureException, captureMessage, flush } from "@sentry/nextjs";

// AUDIT-FIX-B1 §0 (ruling #8) — the fail-open Sentry wrappers (SPEC.2 §17.5:
// a capture failure must never take down the request it observes). Two thin
// try/catch mirrors of the two canonical capture containers:
//
//   - tag-matched:   `captureException(err, { tags: { kind: NAME } })`
//     (the rate-limit.ts:166 shape) — used wherever an err object exists.
//   - title-matched: `captureMessage(NAME, { level: "error", … })`
//     (the bets/transaction.ts:142 shape) — used only where there is none
//     (the drain's per-row emits + `events_default_nonempty`).
//
// Both return `boolean` — true iff the SDK call did NOT throw. The boolean
// exists for the drain's emit-then-stamp loop (per-row success gates the
// `processed_at` stamp); fire-and-forget call sites ignore it. `ctx` passes
// through to the SDK verbatim. Existing bare capture sites stay untouched
// (ruling #8) — new B1 sites route through here.
//
// `safeFlush` (added at the B1 close-out) is the third wrapper: it awaits the
// SDK transport within a budget and returns `true` only on CONFIRMED delivery,
// letting the drain gate its stamp on delivery rather than enqueue. Same
// fail-open posture — a flush timeout (non-`true` resolve) or reject returns
// `false` and never propagates.

export function safeCaptureException(
	err: unknown,
	ctx: { tags: { kind: string } & Record<string, string> },
): boolean {
	try {
		captureException(err, ctx);
		return true;
	} catch {
		return false;
	}
}

export function safeCaptureMessage(
	name: string,
	ctx?: {
		level?: "error" | "warning" | "info";
		tags?: Record<string, string>;
		extra?: Record<string, unknown>;
	},
): boolean {
	try {
		captureMessage(name, ctx);
		return true;
	} catch {
		return false;
	}
}

export async function safeFlush(timeoutMs: number): Promise<boolean> {
	try {
		// `=== true` collapses a transport TIMEOUT (Sentry.flush resolves `false`)
		// and any non-boolean resolve into "not delivered"; the catch collapses a
		// reject/throw the same way. Delivery is confirmed only on a strict `true`.
		return (await flush(timeoutMs)) === true;
	} catch {
		return false;
	}
}
