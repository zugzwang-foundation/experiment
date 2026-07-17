import { describe, expect, it } from "vitest";
import {
	initialKeyState,
	type KeyEvent,
	type KeyState,
	reduceKey,
} from "@/components/debate/composer/idempotency";

// UI.A3 §5.6 tests-first — the client Idempotency-Key lifecycle reducer (plan
// §3.2 "Key lifecycle", the ADR-0031/ADR-0015 client-side reading as corrected
// by web fold-ins F-1 + F-2). PURE / DB-INDEPENDENT: REDs NOW on the
// unresolvable greenfield import and GREENs when the module lands.
//
// Plan-§1 invariant row asserted here:
//   - I-IDEM-ONCE / receipts (ADR-0031) — "the client mints the keys". All
//     three §1 corruption directions are pinned:
//       (1) poisoned key — a key is NEVER held past a CACHED answer: fresh key
//           after a 429 (cached 24h — F-1; held-key-after-429 asserted ABSENT
//           by exhaustive reachability) and on any edit after a terminal 4xx;
//       (2) double-execution — the key is HELD across UNCACHED transients so
//           a manual retry is the legitimate replay path (never a re-mint);
//       (3) the F-2 near-miss — the reused-409 holds the key through the
//           protective landing; fresh key only on the next edit AFTER refresh.
//     Plus the in-flight lock (no double-fire).
//
// PINNED PUBLIC-API CONTRACT (the implementer matches these names exactly):
//   type KeyOutcome =
//     "success" | "transient" | "rate_limited" | "terminal" | "key_reused"
//   type KeyEvent =
//     | { type: "SUBMIT" } | { type: "OUTCOME"; outcome: KeyOutcome }
//     | { type: "EDIT" } | { type: "COUNTDOWN_EXPIRED" } | { type: "REFRESHED" }
//   type KeyPending = "none" | "fresh_on_enable" | "fresh_on_edit"
//     | "refresh_then_edit" | "edit_after_refresh"
//   type KeyState = { key: string; inFlight: boolean; pending: KeyPending }
//   initialKeyState(mint?: () => string): KeyState
//     — default mint = crypto.randomUUID; pending "none", inFlight false
//   reduceKey(state: KeyState, event: KeyEvent, mint?: () => string): KeyState
//     — PURE: never mutates its input.
//
// Transition law (plan §3.2, F-1/F-2-corrected): SUBMIT locks in flight (key
// unchanged; a second SUBMIT is a no-op). OUTCOME (from in flight): success →
// pending "none" · transient → pending "none", key HELD · rate_limited →
// pending "fresh_on_enable" · terminal → pending "fresh_on_edit" · key_reused
// → pending "refresh_then_edit" — key held in all five (rotation happens at
// the NEXT enabling event, never at outcome time). EDIT: mints from
// "fresh_on_edit" / "fresh_on_enable" / "edit_after_refresh"; HOLDS from
// "none" (one key per intent) and from "refresh_then_edit" (F-2: fresh only
// on the edit AFTER refresh). COUNTDOWN_EXPIRED: mints ONLY from
// "fresh_on_enable" (F-1). REFRESHED: "refresh_then_edit" →
// "edit_after_refresh", key held; no-op otherwise.

/** Deterministic mint: k1, k2, k3, … */
function makeMint(): () => string {
	let n = 0;
	return () => {
		n += 1;
		return `k${n}`;
	};
}

const UUID_RE =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** initialKeyState → SUBMIT → OUTCOME(outcome), under a shared mint. */
function afterOutcome(
	mint: () => string,
	outcome: "success" | "transient" | "rate_limited" | "terminal" | "key_reused",
): KeyState {
	const s0 = initialKeyState(mint);
	const inFlight = reduceKey(s0, { type: "SUBMIT" }, mint);
	return reduceKey(inFlight, { type: "OUTCOME", outcome }, mint);
}

describe("initialKeyState", () => {
	it("key-lifecycle::initial-state-mints-once-idle-none", () => {
		const mint = makeMint();
		expect(initialKeyState(mint)).toEqual({
			key: "k1",
			inFlight: false,
			pending: "none",
		});
	});

	it("key-lifecycle::default-mint-is-crypto-randomUUID", () => {
		const a = initialKeyState();
		const b = initialKeyState();
		expect(a.key).toMatch(UUID_RE);
		expect(b.key).toMatch(UUID_RE);
		expect(a.key).not.toBe(b.key);
		expect(a.inFlight).toBe(false);
		expect(a.pending).toBe("none");
	});
});

describe("SUBMIT — the in-flight lock", () => {
	it("key-lifecycle::submit-locks-in-flight-key-unchanged", () => {
		const mint = makeMint();
		const s0 = initialKeyState(mint);
		const s1 = reduceKey(s0, { type: "SUBMIT" }, mint);
		expect(s1).toEqual({ key: "k1", inFlight: true, pending: "none" });
	});

	it("key-lifecycle::submit-while-in-flight-is-a-no-op (no double-fire)", () => {
		const mint = makeMint();
		const s1 = reduceKey(initialKeyState(mint), { type: "SUBMIT" }, mint);
		const s2 = reduceKey(s1, { type: "SUBMIT" }, mint);
		expect(s2).toEqual(s1);
		expect(s2.key).toBe(s1.key);
	});
});

describe("OUTCOME — the five cache-semantics classes", () => {
	it("key-lifecycle::success-clears-in-flight-pending-none", () => {
		const mint = makeMint();
		expect(afterOutcome(mint, "success")).toEqual({
			key: "k1",
			inFlight: false,
			pending: "none",
		});
	});

	it("key-lifecycle::transient-holds-the-key (uncached — legit replay)", () => {
		const mint = makeMint();
		const s = afterOutcome(mint, "transient");
		expect(s).toEqual({ key: "k1", inFlight: false, pending: "none" });
		// The HELD key is the same string — a manual retry replays under it.
		expect(s.key).toBe("k1");
	});

	it("key-lifecycle::rate-limited-arms-fresh-on-enable (F-1)", () => {
		const mint = makeMint();
		// Key still held FOR THE MOMENT — no request is possible during the P4
		// countdown; every exit path re-mints (asserted in the F-1 rows below).
		expect(afterOutcome(mint, "rate_limited")).toEqual({
			key: "k1",
			inFlight: false,
			pending: "fresh_on_enable",
		});
	});

	it("key-lifecycle::terminal-arms-fresh-on-edit", () => {
		const mint = makeMint();
		expect(afterOutcome(mint, "terminal")).toEqual({
			key: "k1",
			inFlight: false,
			pending: "fresh_on_edit",
		});
	});

	it("key-lifecycle::key-reused-arms-refresh-then-edit (F-2)", () => {
		const mint = makeMint();
		expect(afterOutcome(mint, "key_reused")).toEqual({
			key: "k1",
			inFlight: false,
			pending: "refresh_then_edit",
		});
	});

	it("key-lifecycle::outcome-while-not-in-flight-is-a-no-op", () => {
		const mint = makeMint();
		const idle = initialKeyState(mint);
		expect(
			reduceKey(idle, { type: "OUTCOME", outcome: "success" }, mint),
		).toEqual(idle);
		expect(
			reduceKey(idle, { type: "OUTCOME", outcome: "terminal" }, mint),
		).toEqual(idle);
	});
});

describe("EDIT — hold vs mint per pending", () => {
	it("key-lifecycle::edit-with-pending-none-holds-the-key (one key per intent)", () => {
		const mint = makeMint();
		const idle = initialKeyState(mint);
		expect(reduceKey(idle, { type: "EDIT" }, mint)).toEqual({
			key: "k1",
			inFlight: false,
			pending: "none",
		});
	});

	it("key-lifecycle::edit-after-terminal-mints-a-fresh-key", () => {
		const mint = makeMint();
		const s = afterOutcome(mint, "terminal");
		expect(reduceKey(s, { type: "EDIT" }, mint)).toEqual({
			key: "k2",
			inFlight: false,
			pending: "none",
		});
	});

	it("key-lifecycle::edit-during-the-429-countdown-mints (F-1)", () => {
		// Any path out of a cached 429 is fresh-keyed — including an edit
		// before the countdown expires.
		const mint = makeMint();
		const s = afterOutcome(mint, "rate_limited");
		expect(reduceKey(s, { type: "EDIT" }, mint)).toEqual({
			key: "k2",
			inFlight: false,
			pending: "none",
		});
	});

	it("key-lifecycle::edit-before-refresh-holds-key-and-pending (F-2)", () => {
		const mint = makeMint();
		const s = afterOutcome(mint, "key_reused");
		expect(reduceKey(s, { type: "EDIT" }, mint)).toEqual({
			key: "k1",
			inFlight: false,
			pending: "refresh_then_edit",
		});
	});

	it("key-lifecycle::edit-after-refresh-mints-a-fresh-key (F-2)", () => {
		const mint = makeMint();
		const s = afterOutcome(mint, "key_reused");
		const refreshed = reduceKey(s, { type: "REFRESHED" }, mint);
		expect(reduceKey(refreshed, { type: "EDIT" }, mint)).toEqual({
			key: "k2",
			inFlight: false,
			pending: "none",
		});
	});
});

describe("COUNTDOWN_EXPIRED / REFRESHED", () => {
	it("key-lifecycle::countdown-expiry-re-enables-under-a-FRESH-key (F-1)", () => {
		const mint = makeMint();
		const s429 = afterOutcome(mint, "rate_limited");
		const enabled = reduceKey(s429, { type: "COUNTDOWN_EXPIRED" }, mint);
		expect(enabled).toEqual({ key: "k2", inFlight: false, pending: "none" });
		expect(enabled.key).not.toBe(s429.key);
	});

	it("key-lifecycle::countdown-expired-is-a-no-op-outside-fresh-on-enable", () => {
		const mint = makeMint();
		const idle = initialKeyState(mint);
		expect(reduceKey(idle, { type: "COUNTDOWN_EXPIRED" }, mint)).toEqual(idle);
		const terminal = afterOutcome(makeMint(), "terminal");
		expect(
			reduceKey(terminal, { type: "COUNTDOWN_EXPIRED" }, makeMint()),
		).toEqual(terminal);
		const reused = afterOutcome(makeMint(), "key_reused");
		expect(
			reduceKey(reused, { type: "COUNTDOWN_EXPIRED" }, makeMint()),
		).toEqual(reused);
	});

	it("key-lifecycle::refreshed-advances-refresh-then-edit-key-held (F-2)", () => {
		const mint = makeMint();
		const s = afterOutcome(mint, "key_reused");
		expect(reduceKey(s, { type: "REFRESHED" }, mint)).toEqual({
			key: "k1",
			inFlight: false,
			pending: "edit_after_refresh",
		});
	});

	it("key-lifecycle::refreshed-is-a-no-op-outside-refresh-then-edit", () => {
		const idle = initialKeyState(makeMint());
		expect(reduceKey(idle, { type: "REFRESHED" }, makeMint())).toEqual(idle);
		const s429 = afterOutcome(makeMint(), "rate_limited");
		expect(reduceKey(s429, { type: "REFRESHED" }, makeMint())).toEqual(s429);
		const terminal = afterOutcome(makeMint(), "terminal");
		expect(reduceKey(terminal, { type: "REFRESHED" }, makeMint())).toEqual(
			terminal,
		);
	});
});

describe("the F-1 429 row — held-key-after-429 is ABSENT", () => {
	it("key-lifecycle::f1-both-exit-paths-rotate-off-the-429d-key", () => {
		const mint = makeMint();
		const s429 = afterOutcome(mint, "rate_limited"); // key k1
		// Path A: countdown expiry.
		const viaCountdown = reduceKey(s429, { type: "COUNTDOWN_EXPIRED" }, mint);
		expect(viaCountdown.pending).toBe("none");
		expect(viaCountdown.key).not.toBe(s429.key);
		// Path B: edit during the countdown.
		const viaEdit = reduceKey(s429, { type: "EDIT" }, mint);
		expect(viaEdit.pending).toBe("none");
		expect(viaEdit.key).not.toBe(s429.key);
	});

	it("key-lifecycle::f1-no-event-sequence-reaches-pending-none-under-the-429d-key", () => {
		// Exhaustive reachability over the reducer graph from the 429'd state:
		// there is NO event sequence that lands pending "none" while still
		// holding the ORIGINAL (429-cached) key — the poisoned-key corruption
		// (plan §1 I-IDEM narrative, direction one). SUBMIT is excluded while
		// pending === "fresh_on_enable" per §3.2's own law ("no request
		// possible during the P4 countdown" — the P4 banner disables submit).
		// A minted key can never become the original again, so the abstract
		// state space (orig? × inFlight × pending) is finite and closes.
		const mint = makeMint();
		const s429 = afterOutcome(mint, "rate_limited");
		const originalKey = s429.key;
		const EVENTS: KeyEvent[] = [
			{ type: "SUBMIT" },
			{ type: "OUTCOME", outcome: "success" },
			{ type: "OUTCOME", outcome: "transient" },
			{ type: "OUTCOME", outcome: "rate_limited" },
			{ type: "OUTCOME", outcome: "terminal" },
			{ type: "OUTCOME", outcome: "key_reused" },
			{ type: "EDIT" },
			{ type: "COUNTDOWN_EXPIRED" },
			{ type: "REFRESHED" },
		];
		const abstractOf = (s: KeyState): string =>
			`${s.key === originalKey ? "orig" : "fresh"}|${s.inFlight}|${s.pending}`;
		const seen = new Set<string>([abstractOf(s429)]);
		const frontier: KeyState[] = [s429];
		let steps = 0;
		while (frontier.length > 0) {
			steps += 1;
			if (steps > 1000) throw new Error("reducer state space failed to close");
			const cur = frontier.pop();
			if (cur === undefined) break;
			for (const event of EVENTS) {
				if (event.type === "SUBMIT" && cur.pending === "fresh_on_enable") {
					continue; // no request possible during the P4 countdown
				}
				const next = reduceKey(cur, event, mint);
				const abstract = abstractOf(next);
				if (!seen.has(abstract)) {
					seen.add(abstract);
					frontier.push(next);
				}
			}
		}
		// The violation shape — the original key back in a submittable state —
		// must be unreachable.
		for (const abstract of seen) {
			const heldOriginalSubmittable =
				abstract.startsWith("orig|") && abstract.endsWith("|none");
			expect(heldOriginalSubmittable).toBe(false);
		}
		// Sanity: the exploration left the seed (fresh-key states reached).
		expect(seen.size).toBeGreaterThan(1);
	});
});

describe("the F-2 reused-409 row — protective landing key law", () => {
	it("key-lifecycle::f2-full-sequence-carries-the-fresh-key-into-submit", () => {
		// OUTCOME key_reused → REFRESHED → EDIT → SUBMIT: the resubmit rides a
		// FRESH key (a NEW intent), never the reused one — while the edit
		// BEFORE refresh held it (asserted in the EDIT block above).
		const mint = makeMint();
		const reused = afterOutcome(mint, "key_reused"); // k1
		const beforeRefreshEdit = reduceKey(reused, { type: "EDIT" }, mint);
		expect(beforeRefreshEdit.key).toBe("k1"); // held, pending unchanged
		expect(beforeRefreshEdit.pending).toBe("refresh_then_edit");
		const refreshed = reduceKey(reused, { type: "REFRESHED" }, mint);
		const edited = reduceKey(refreshed, { type: "EDIT" }, mint);
		const submitted = reduceKey(edited, { type: "SUBMIT" }, mint);
		expect(submitted.inFlight).toBe(true);
		expect(submitted.key).toBe("k2");
		expect(submitted.key).not.toBe(reused.key);
	});
});

describe("the transient-retry row — held-key replay", () => {
	it("key-lifecycle::transient-then-submit-re-fires-under-the-IDENTICAL-key", () => {
		// 503 / network / 409-in-flight are never cached: the manual retry
		// under the held key is the legitimate replay path (a replayed
		// committed place returns its original 200 — ADR-0031).
		const mint = makeMint();
		const t = afterOutcome(mint, "transient");
		const resubmit = reduceKey(t, { type: "SUBMIT" }, mint);
		expect(resubmit.inFlight).toBe(true);
		expect(resubmit.key).toBe(t.key);
		expect(resubmit.key).toBe("k1");
	});
});

describe("purity — reduceKey never mutates its input", () => {
	it("key-lifecycle::reduce-on-a-frozen-state-does-not-throw-or-mutate", () => {
		const mint = makeMint();
		const idle = Object.freeze(initialKeyState(mint));
		const snapshot = { ...idle };
		expect(() => reduceKey(idle, { type: "SUBMIT" }, mint)).not.toThrow();
		expect(idle).toEqual(snapshot);
	});

	it("key-lifecycle::outcome-reduction-on-a-frozen-state-is-pure", () => {
		const mint = makeMint();
		const inFlight = Object.freeze(
			reduceKey(initialKeyState(mint), { type: "SUBMIT" }, mint),
		);
		const snapshot = { ...inFlight };
		expect(() =>
			reduceKey(inFlight, { type: "OUTCOME", outcome: "rate_limited" }, mint),
		).not.toThrow();
		expect(inFlight).toEqual(snapshot);
	});
});
