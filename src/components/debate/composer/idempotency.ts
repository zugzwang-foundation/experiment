/**
 * UI.A3 slice 1 — the client Idempotency-Key lifecycle reducer (plan §3.2
 * "Key lifecycle" — the ADR-0031/ADR-0015 client-side reading as corrected by
 * web fold-ins F-1 + F-2). PURE state machine; the wiring layer owns timers,
 * fetches, and `router.refresh()` and feeds events in.
 *
 * The three §1 I-IDEM corruption directions this law forecloses:
 *  (1) poisoned key — a key is never held past a CACHED answer: fresh key
 *      after a 429 (cached per key at 24h TTL — F-1) and on any edit after a
 *      terminal 4xx;
 *  (2) double-execution — the key is HELD across UNCACHED transients (503s /
 *      network / in-flight 409s) so a manual retry replays the ORIGINAL
 *      committed 200 from the durable receipt, never executing twice;
 *  (3) the F-2 near-miss — the reused-409 (edit-after-invisible-commit) holds
 *      the key through the protective landing; fresh key only on the next
 *      edit AFTER refresh; no auto-resubmit.
 */

/** The five cache-semantics outcome classes (classified by state-map.ts). */
export type KeyOutcome =
	| "success"
	| "transient"
	| "rate_limited"
	| "terminal"
	| "key_reused";

export type KeyEvent =
	| { type: "SUBMIT" }
	| { type: "OUTCOME"; outcome: KeyOutcome }
	| { type: "EDIT" }
	| { type: "COUNTDOWN_EXPIRED" }
	| { type: "REFRESHED" };

/**
 * What the key still owes before the next submit:
 * - "none" — submittable under the current key.
 * - "fresh_on_enable" — a 429 landed (cached 24h, F-1): EVERY exit path
 *   (countdown expiry, edit) re-mints; submit is impossible during the P4
 *   countdown (the reducer no-ops a SUBMIT here as a belt).
 * - "fresh_on_edit" — a terminal 4xx landed (cached): the next input edit is
 *   a NEW intent and mints.
 * - "refresh_then_edit" — the F-2 reused-409 landed: the key is held through
 *   the protective landing; a refresh must happen first.
 * - "edit_after_refresh" — refreshed after the reused-409: the next edit is
 *   the new intent and mints.
 */
export type KeyPending =
	| "none"
	| "fresh_on_enable"
	| "fresh_on_edit"
	| "refresh_then_edit"
	| "edit_after_refresh";

export type KeyState = {
	key: string;
	inFlight: boolean;
	pending: KeyPending;
};

function defaultMint(): string {
	return crypto.randomUUID();
}

/** One key per intent, minted at composer open. */
export function initialKeyState(mint: () => string = defaultMint): KeyState {
	return { key: mint(), inFlight: false, pending: "none" };
}

/** PURE reducer — never mutates its input; unknown situations are no-ops. */
export function reduceKey(
	state: KeyState,
	event: KeyEvent,
	mint: () => string = defaultMint,
): KeyState {
	switch (event.type) {
		case "SUBMIT": {
			// In-flight lock (no double-fire); the P4 countdown also blocks
			// submit (fresh_on_enable exits only via COUNTDOWN_EXPIRED / EDIT).
			if (state.inFlight || state.pending === "fresh_on_enable") {
				return state;
			}
			return { ...state, inFlight: true };
		}
		case "OUTCOME": {
			if (!state.inFlight) {
				return state;
			}
			switch (event.outcome) {
				case "success":
				case "transient":
					// Transient (uncached): key HELD — a manual retry under it is
					// the legitimate replay path.
					return { ...state, inFlight: false, pending: "none" };
				case "rate_limited":
					return { ...state, inFlight: false, pending: "fresh_on_enable" };
				case "terminal":
					return { ...state, inFlight: false, pending: "fresh_on_edit" };
				case "key_reused":
					return { ...state, inFlight: false, pending: "refresh_then_edit" };
			}
			// Unreachable (exhaustive) — keep the reducer total.
			return state;
		}
		case "EDIT": {
			if (state.inFlight) {
				// Fields are locked while a request is in flight — never rotate a
				// key mid-request.
				return state;
			}
			switch (state.pending) {
				case "fresh_on_edit":
				case "fresh_on_enable":
				case "edit_after_refresh":
					return { key: mint(), inFlight: false, pending: "none" };
				case "refresh_then_edit":
					// F-2: fresh key only on the edit AFTER refresh — held here.
					return state;
				case "none":
					// One key per intent — pre-submit edits never rotate.
					return state;
			}
			return state;
		}
		case "COUNTDOWN_EXPIRED": {
			// F-1: countdown expiry re-enables submit under a FRESH key.
			if (!state.inFlight && state.pending === "fresh_on_enable") {
				return { key: mint(), inFlight: false, pending: "none" };
			}
			return state;
		}
		case "REFRESHED": {
			if (!state.inFlight && state.pending === "refresh_then_edit") {
				return { ...state, pending: "edit_after_refresh" };
			}
			return state;
		}
	}
}
