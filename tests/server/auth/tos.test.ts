import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Per SCAFFOLD.3 plan §4 step 3 + §5 failure-modes #11–#13 + §6 + §7 — ToS
// gate page + acceptance evidence write + tab-race + reentry + onboarding-
// ref expiry / tampering.
//
// Five-column acceptance evidence in ONE SERIALIZABLE transaction per
// SPEC.2 §3.5 line 281:
//   UPDATE users SET tos_accepted_at = now(),
//                    tos_version_hash = $1,
//                    privacy_version_hash = $2,
//                    tos_acceptance_ip = $3,
//                    tos_acceptance_user_agent = $4
//   WHERE id = $userId
// `SELECT FOR UPDATE` on the users row makes the tab-race second submission
// idempotent (sees existing tos_accepted_at, no-op branch).

const { mockDb } = vi.hoisted(() => {
	const tx = {
		execute: vi.fn(),
		select: vi.fn(),
		update: vi.fn(),
		query: {
			users: {
				findFirst: vi.fn(),
			},
		},
	};
	return {
		mockDb: {
			transaction: vi.fn(),
			_tx: tx,
		},
	};
});

vi.mock("@/db/index", () => ({
	db: mockDb,
}));

const { mockVerifyOnboardingRef } = vi.hoisted(() => ({
	mockVerifyOnboardingRef: vi.fn(),
}));

vi.mock("@/server/auth/onboarding-ref", () => ({
	signOnboardingRef: vi.fn(),
	verifyOnboardingRef: mockVerifyOnboardingRef,
}));

// Server Action mocks `next/headers` for cookies()/headers() reads.
const { mockCookiesGet, mockHeadersGet } = vi.hoisted(() => ({
	mockCookiesGet: vi.fn(),
	mockHeadersGet: vi.fn(),
}));

vi.mock("next/headers", () => ({
	cookies: () => ({
		get: mockCookiesGet,
		set: vi.fn(),
		delete: vi.fn(),
	}),
	headers: () => ({
		get: mockHeadersGet,
	}),
}));

// ENGINE.13 (@docs/plans/ENGINE.13.md): the first-acceptance branch calls
// `grantInitialDharma` inside the same tx. This mocked-layer suite has no
// usable tx surface for the real producer (the mocked tx above has no
// `insert` and a bare `select` vi.fn) — the module mock is mandatory; the
// called / not-called assertions in the ENGINE.13 describe below are the
// additive budget. The DB-backed twin is tos-accept-grant.test.ts.
const { mockGrantInitialDharma } = vi.hoisted(() => ({
	mockGrantInitialDharma: vi.fn(async (..._args: unknown[]) => ({
		balanceAfter: "1000.000000000000000000",
	})),
}));

vi.mock("@/server/dharma/grant", () => ({
	validateGrantAmount: vi.fn(),
	grantInitialDharma: mockGrantInitialDharma,
}));

import { acceptTosAction } from "@/server/auth/tos-accept";
import {
	PRIVACY_VERSION_HASH,
	TOS_VERSION_HASH,
} from "@/server/auth/tos-versions";

beforeEach(() => {
	mockDb.transaction.mockReset();
	mockDb._tx.execute.mockReset();
	mockDb._tx.select.mockReset();
	mockDb._tx.update.mockReset();
	mockDb._tx.query.users.findFirst.mockReset();
	mockVerifyOnboardingRef.mockReset();
	mockCookiesGet.mockReset();
	mockHeadersGet.mockReset();
	mockDb.transaction.mockImplementation(
		(cb: (t: typeof mockDb._tx) => unknown) => cb(mockDb._tx),
	);
});

afterEach(() => {
	vi.clearAllMocks();
});

// Helper: form-data wrapper with `accepted=true`.
function fd(accepted = true): FormData {
	const f = new FormData();
	f.append("accepted", accepted ? "true" : "false");
	return f;
}

describe("ToS gate + acceptance Server Action (F-AUTH-4)", () => {
	// === Plan §7 + SPEC.1 line 684 — verbatim warning text ==================

	it("tos::warning-text-matches-spec-1-line-684-verbatim", async () => {
		// SPEC.1 line 684 verbatim text. The onboarding page renders this in
		// the re-id warning callout, separate from the ToS body. Constants
		// at `src/server/auth/tos-versions.ts` carry the hashes; the
		// warning text itself is a module export OR rendered inline in
		// `src/app/(auth)/onboarding/page.tsx`. We assert the export here so
		// a string-drift surfaces. Plan §7 row: "warning text matches SPEC.1
		// line 684 verbatim (string assertion)".
		const { REID_WARNING_TEXT } = await import("@/server/auth/tos-versions");
		expect(REID_WARNING_TEXT).toBe(
			"Your pseudonym is public and your activity is recorded as a permanent record. Distinctive patterns in your writing or betting may allow others to re-identify you across platforms. If anonymity from de-anonymisation analysis matters to you, do not use this product.",
		);
	});

	it("tos::version-hash-constants-shape", () => {
		// Plan §3 file map + Q4: `src/server/auth/tos-versions.ts` exports
		// `TOS_VERSION_HASH` + `PRIVACY_VERSION_HASH`. Per Q4: placeholder
		// values `'placeholder-tos-v0'` / `'placeholder-privacy-v0'`. The
		// constants flow into the acceptance-evidence INSERT and the
		// onboarding footer.
		expect(TOS_VERSION_HASH).toBe("placeholder-tos-v0");
		expect(PRIVACY_VERSION_HASH).toBe("placeholder-privacy-v0");
	});

	// === Plan §4 step 3 + plan §7 — five-column acceptance evidence =========

	it("tos::accept-writes-five-column-evidence-in-one-tx", async () => {
		// Per SPEC.2 §3.5 line 281 + plan §4 step 3: five-column UPDATE in
		// one SERIALIZABLE transaction:
		//   tos_accepted_at, tos_version_hash, privacy_version_hash,
		//   tos_acceptance_ip, tos_acceptance_user_agent
		const userId = "01234567-89ab-cdef-0123-456789abcdef";
		mockCookiesGet.mockImplementation((name: string) =>
			name === "onboarding_ref"
				? { name: "onboarding_ref", value: "signed-ref-token" }
				: undefined,
		);
		mockVerifyOnboardingRef.mockReturnValueOnce({ userId });
		mockHeadersGet.mockImplementation((h: string) => {
			if (h === "x-forwarded-for") return "1.2.3.4";
			if (h === "user-agent") return "Mozilla/5.0 (test browser)";
			return null;
		});
		// SELECT FOR UPDATE on users row returns user with tos NULL (first
		// acceptance).
		mockDb._tx.query.users.findFirst.mockResolvedValueOnce({
			id: userId,
			pseudonym: "RedFox001",
			tosAcceptedAt: null,
		});
		// UPDATE returns affected row.
		mockDb._tx.execute.mockResolvedValueOnce([{ id: userId }]);

		// Server Action throws a `redirect()` on success — Next.js throws
		// a NEXT_REDIRECT error. We catch and assert state was set.
		try {
			await acceptTosAction(fd());
		} catch (e: unknown) {
			// Expected: NEXT_REDIRECT or undefined return.
			const msg = (e as Error)?.message ?? "";
			// Next.js redirect throws an error with digest starting with
			// `NEXT_REDIRECT`. Accept both shapes.
			expect(msg + JSON.stringify(e)).toMatch(/(REDIRECT|redirect)/i);
		}

		// Transaction was opened.
		expect(mockDb.transaction).toHaveBeenCalled();
		// UPDATE SQL surface includes all five columns. Per plan §4 step 3
		// + SPEC.2 §3.5 line 281.
		const allSql = mockDb._tx.execute.mock.calls
			.map((c) => JSON.stringify(c[0]))
			.join(" ");
		expect(allSql).toMatch(/tos_accepted_at/i);
		expect(allSql).toMatch(/tos_version_hash/i);
		expect(allSql).toMatch(/privacy_version_hash/i);
		expect(allSql).toMatch(/tos_acceptance_ip/i);
		expect(allSql).toMatch(/tos_acceptance_user_agent/i);
	});

	// === Plan §5 failure-mode #11 + plan §6 — tab-race idempotency ==========

	it("tos::tab-race-idempotent-acceptance", async () => {
		// Plan §5 failure-mode #11 + plan §6 + SPEC.1 line 703: two tabs of
		// `/onboarding` for same user. Both click Continue. SERIALIZABLE +
		// `SELECT FOR UPDATE` on `users` row makes the second call see
		// `tos_accepted_at IS NOT NULL`, take no-op branch, proceed to
		// session-issue (no second UPDATE, no double-write).
		const userId = "01234567-89ab-cdef-0123-456789abcdef";
		mockCookiesGet.mockImplementation((name: string) =>
			name === "onboarding_ref"
				? { name: "onboarding_ref", value: "signed-ref-token" }
				: undefined,
		);
		mockVerifyOnboardingRef.mockReturnValue({ userId });
		mockHeadersGet.mockImplementation(() => "1.2.3.4");

		// SELECT FOR UPDATE returns user with tos already set (tab #1 won).
		const alreadyAccepted = new Date("2026-05-15T12:00:00Z");
		mockDb._tx.query.users.findFirst.mockResolvedValueOnce({
			id: userId,
			pseudonym: "RedFox001",
			tosAcceptedAt: alreadyAccepted,
		});

		try {
			await acceptTosAction(fd());
		} catch {
			// Server Action redirect throw — expected on success.
		}

		// No UPDATE-users-SET issued — the implementation saw
		// tos_accepted_at set and short-circuited. Plan §6: "second call
		// see tos_accepted_at IS NOT NULL, take no-op branch." Regex is
		// `/UPDATE\s+users\s+SET/i` (not just `/UPDATE/i`) so the
		// step-24-audit-added `SELECT … FOR UPDATE` row lock isn't counted
		// as an UPDATE — only the SET-five-columns statement is.
		const updateCalls = mockDb._tx.execute.mock.calls.filter((c) =>
			JSON.stringify(c[0]).match(/UPDATE\s+users\s+SET/i),
		);
		expect(updateCalls.length).toBe(0);
	});

	// === Plan §7 + plan §6 — checkbox required (server-side enforcement) ====

	it("tos::checkbox-unchecked-returns-tos-acceptance-required", async () => {
		// Plan §4 step 3 + §3 API surface: server-side check rejects
		// unchecked submit with `tos_acceptance_required`. Client-side
		// Continue-disabled-until-checked is UX; the server is the gate.
		const userId = "01234567-89ab-cdef-0123-456789abcdef";
		mockCookiesGet.mockImplementation((name: string) =>
			name === "onboarding_ref"
				? { name: "onboarding_ref", value: "signed-ref-token" }
				: undefined,
		);
		mockVerifyOnboardingRef.mockReturnValueOnce({ userId });

		const result = await acceptTosAction(fd(false));
		expect(result).toEqual({ ok: false, code: "tos_acceptance_required" });
		// Transaction was NEVER opened — checkbox check is before tx.
		expect(mockDb.transaction).not.toHaveBeenCalled();
	});

	// === Plan §5 failure-mode #12 ===========================================

	it("tos::onboarding-ref-expired-redirects-to-signin", async () => {
		// Plan §5 failure-mode #12: cookie expired (>10 min) →
		// verifyOnboardingRef returns null → redirect to `/sign-in`. No
		// transaction, no state change.
		mockCookiesGet.mockImplementation((name: string) =>
			name === "onboarding_ref"
				? { name: "onboarding_ref", value: "expired-token" }
				: undefined,
		);
		mockVerifyOnboardingRef.mockReturnValueOnce(null);

		try {
			await acceptTosAction(fd());
			throw new Error("expected redirect");
		} catch (e: unknown) {
			const errStr = String((e as Error)?.message ?? e);
			// NEXT_REDIRECT or a thrown redirect to /sign-in.
			expect(errStr).toMatch(/(sign-in|REDIRECT|redirect)/i);
		}

		expect(mockDb.transaction).not.toHaveBeenCalled();
	});

	// === Plan §5 failure-mode #13 ===========================================

	it("tos::onboarding-ref-tampered-redirected", async () => {
		// Plan §5 failure-mode #13: cookie signature invalid (tampering) →
		// HMAC verify fails → 401 + redirect to `/sign-in`. Equivalent
		// behavior to expired — the cookie is treated as "not a valid
		// pre-session bearer."
		mockCookiesGet.mockImplementation((name: string) =>
			name === "onboarding_ref"
				? { name: "onboarding_ref", value: "tampered-token" }
				: undefined,
		);
		mockVerifyOnboardingRef.mockReturnValueOnce(null);

		try {
			await acceptTosAction(fd());
			throw new Error("expected redirect");
		} catch (e: unknown) {
			const errStr = String((e as Error)?.message ?? e);
			expect(errStr).toMatch(/(sign-in|REDIRECT|redirect)/i);
		}

		expect(mockDb.transaction).not.toHaveBeenCalled();
	});

	// === Plan §5 failure-mode #12 — cookie missing entirely =================

	it("tos::onboarding-ref-missing-redirected", async () => {
		// No `onboarding_ref` cookie present at all → cookies().get returns
		// undefined → redirect to `/sign-in`.
		mockCookiesGet.mockReturnValue(undefined);

		try {
			await acceptTosAction(fd());
			throw new Error("expected redirect");
		} catch (e: unknown) {
			const errStr = String((e as Error)?.message ?? e);
			expect(errStr).toMatch(/(sign-in|REDIRECT|redirect)/i);
		}

		expect(mockDb.transaction).not.toHaveBeenCalled();
		expect(mockVerifyOnboardingRef).not.toHaveBeenCalled();
	});

	// === Plan §6 — reentry semantics (Cancel-from-onboarding) ==============

	it("tos::reentry-existing-user-tos-null-routes-back-without-pool-reconsumption", async () => {
		// Plan §6: "user clicks Cancel on /onboarding. The F-AUTH-3 user
		// row remains with tos_accepted_at IS NULL... on next sign-in,
		// hook routes back to onboarding with the same userId (no second
		// pool consumption)." The acceptTosAction itself doesn't trigger
		// pool consumption — that's user.create.before's job. This test
		// asserts that the action operates on the EXISTING user row in
		// the SELECT FOR UPDATE branch and does NOT call any pseudonym
		// consumer.
		const userId = "01234567-89ab-cdef-0123-456789abcdef";
		mockCookiesGet.mockImplementation((name: string) =>
			name === "onboarding_ref"
				? { name: "onboarding_ref", value: "signed-ref-token" }
				: undefined,
		);
		mockVerifyOnboardingRef.mockReturnValueOnce({ userId });
		mockHeadersGet.mockImplementation(() => "1.2.3.4");

		// Existing row, pseudonym set (from prior session), tos still NULL.
		mockDb._tx.query.users.findFirst.mockResolvedValueOnce({
			id: userId,
			pseudonym: "RedFox001",
			tosAcceptedAt: null,
		});
		mockDb._tx.execute.mockResolvedValueOnce([{ id: userId }]);

		try {
			await acceptTosAction(fd());
		} catch {
			// redirect on success
		}

		// UPDATE ran — first time the user accepts. Pseudonym lookup was
		// only the existing row read, no INSERT to identity_pool or users.
		const allSql = mockDb._tx.execute.mock.calls
			.map((c) => JSON.stringify(c[0]))
			.join(" ");
		expect(allSql).toMatch(/UPDATE/i);
		expect(allSql).not.toMatch(/INSERT.*identity_pool/i);
		expect(allSql).not.toMatch(/INSERT.*users/i);
	});

	// === Plan §8 + plan §7 — HARDEN-deferred stale-30d sweep ================

	it.todo("tos::stale-30d-sweep — HARDEN-era; SPEC.1 line 704 + plan §8");
});

// ENGINE.13 — grant-producer wiring at the mocked layer (@docs/plans/
// ENGINE.13.md §"Test plan", "Unit additions to tos.test.ts"): the
// first-acceptance branch calls `grantInitialDharma(tx, { userId,
// grantEventId, metadata })` EXACTLY ONCE — and never on the checkbox
// early-return, the missing/invalid/expired cookie redirects, the
// missing-row branch, or the tab-race branch. The grant module is mocked
// above; the DB-backed twin (real producer, real Postgres) is
// tests/server/auth/tos-accept-grant.test.ts.
describe("ToS acceptance — initial-grant producer wiring (ENGINE.13)", () => {
	const userId = "01234567-89ab-cdef-0123-456789abcdef";

	function armHappyPathContext(): void {
		mockCookiesGet.mockImplementation((name: string) =>
			name === "onboarding_ref"
				? { name: "onboarding_ref", value: "signed-ref-token" }
				: undefined,
		);
		mockHeadersGet.mockImplementation((h: string) => {
			if (h === "x-forwarded-for") return "1.2.3.4";
			if (h === "user-agent") return "Mozilla/5.0 (test browser)";
			return null;
		});
	}

	it("tos::grant-called-exactly-once-on-first-acceptance", async () => {
		armHappyPathContext();
		mockVerifyOnboardingRef.mockReturnValueOnce({ userId });
		mockDb._tx.query.users.findFirst.mockResolvedValueOnce({
			id: userId,
			pseudonym: "RedFox001",
			tosAcceptedAt: null,
		});

		try {
			await acceptTosAction(fd());
		} catch {
			// NEXT_REDIRECT throw on success.
		}

		expect(mockGrantInitialDharma).toHaveBeenCalledTimes(1);
		const call = mockGrantInitialDharma.mock.calls[0];
		// Signature per plan §"The grant unit": (tx, { userId, grantEventId,
		// metadata }) — on the SAME tx the acceptance UPDATE rode.
		expect(call?.[0]).toBe(mockDb._tx);
		const args = call?.[1] as
			| {
					userId: string;
					grantEventId: string;
					metadata: Record<string, unknown>;
			  }
			| undefined;
		expect(args?.userId).toBe(userId);
		// grantEventId minted at handler entry as a UUIDv7 (ADR-0016 D1 —
		// the ENGINE.12 creditEventId precedent), distinct id per event.
		expect(args?.grantEventId).toMatch(
			/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
		);
		// The SAME 7-field metadata object the events carry (plan seam #2).
		expect(args?.metadata).toEqual({
			request_id: "unknown",
			flow_id: "F-AUTH-4",
			user_id: userId,
			actor_id: userId,
			idempotency_key: null,
			ip: "1.2.3.4",
			user_agent: "Mozilla/5.0 (test browser)",
		});
	});

	it("tos::grant-not-called-on-checkbox-early-return", async () => {
		armHappyPathContext();
		mockVerifyOnboardingRef.mockReturnValueOnce({ userId });

		const result = await acceptTosAction(fd(false));
		expect(result).toEqual({ ok: false, code: "tos_acceptance_required" });
		expect(mockGrantInitialDharma).not.toHaveBeenCalled();
	});

	it("tos::grant-not-called-on-missing-cookie-redirect", async () => {
		mockCookiesGet.mockReturnValue(undefined);

		try {
			await acceptTosAction(fd());
		} catch {
			// redirect to /sign-in.
		}
		expect(mockGrantInitialDharma).not.toHaveBeenCalled();
	});

	it("tos::grant-not-called-on-expired-cookie-redirect", async () => {
		mockCookiesGet.mockImplementation((name: string) =>
			name === "onboarding_ref"
				? { name: "onboarding_ref", value: "expired-token" }
				: undefined,
		);
		mockVerifyOnboardingRef.mockReturnValueOnce(null);

		try {
			await acceptTosAction(fd());
		} catch {
			// redirect to /sign-in.
		}
		expect(mockGrantInitialDharma).not.toHaveBeenCalled();
	});

	it("tos::grant-not-called-on-tampered-cookie-redirect", async () => {
		mockCookiesGet.mockImplementation((name: string) =>
			name === "onboarding_ref"
				? { name: "onboarding_ref", value: "tampered-token" }
				: undefined,
		);
		mockVerifyOnboardingRef.mockReturnValueOnce(null);

		try {
			await acceptTosAction(fd());
		} catch {
			// redirect to /sign-in.
		}
		expect(mockGrantInitialDharma).not.toHaveBeenCalled();
	});

	it("tos::grant-not-called-on-missing-users-row", async () => {
		armHappyPathContext();
		mockVerifyOnboardingRef.mockReturnValueOnce({ userId });
		// The `:125` silent no-op branch — no users row.
		mockDb._tx.query.users.findFirst.mockResolvedValueOnce(undefined);

		try {
			await acceptTosAction(fd());
		} catch {
			// redirect after the no-op tx.
		}
		expect(mockDb.transaction).toHaveBeenCalled();
		expect(mockGrantInitialDharma).not.toHaveBeenCalled();
	});

	it("tos::grant-not-called-on-tab-race-no-op", async () => {
		armHappyPathContext();
		mockVerifyOnboardingRef.mockReturnValueOnce({ userId });
		// The `:126` tab-race branch — acceptance already recorded.
		mockDb._tx.query.users.findFirst.mockResolvedValueOnce({
			id: userId,
			pseudonym: "RedFox001",
			tosAcceptedAt: new Date("2026-05-15T12:00:00Z"),
		});

		try {
			await acceptTosAction(fd());
		} catch {
			// redirect after the no-op tx.
		}
		expect(mockDb.transaction).toHaveBeenCalled();
		expect(mockGrantInitialDharma).not.toHaveBeenCalled();
	});
});
