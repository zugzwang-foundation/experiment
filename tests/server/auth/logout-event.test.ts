import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Per ENGINE.6 plan §F (migration-site test) + §D.5 (V3 carve-out for
// participant logout — `user.signed_out`).
//
// V3 carve-out (named in plan §E.2 SPEC.2 §7 amendment): Better Auth's
// `signOut` owns the participant-session deletion in its own internal tx;
// emission necessarily lands in a SEPARATE post-commit tx because Better
// Auth exposes no after-hook for events emission. Audit-trail gap on
// process-crash between mutation and emission is accepted (session
// deletion is idempotent; missing log entry has no consequence beyond log
// gap).
//
// Sequence locked at plan §D.5:
//   1. const session = await auth.api.getSession({ headers });  // BEFORE signOut
//   2. const userId = session?.user?.id ?? null;
//   3. await auth.api.signOut({ headers });
//   4. if (userId) {
//        await db.transaction(tx => insertEvent(tx, { eventType: 'user.signed_out', ... }))
//      }
//   5. redirect('/');
//
// CRITICAL: `getSession` is called BEFORE `signOut` — after signOut the
// session row is deleted and userId is unrecoverable.
//
// CRITICAL: if `getSession` returns null (sign-out with no session — a
// double-click or already-signed-out call), NO event is emitted.

const { mockGetSession, mockSignOut } = vi.hoisted(() => ({
	mockGetSession: vi.fn(),
	mockSignOut: vi.fn(),
}));

vi.mock("@/server/auth/index", () => ({
	auth: {
		api: {
			getSession: mockGetSession,
			signOut: mockSignOut,
		},
	},
}));

const { mockHeadersGet } = vi.hoisted(() => ({
	mockHeadersGet: vi.fn(),
}));

vi.mock("next/headers", () => ({
	headers: () => ({
		get: mockHeadersGet,
	}),
}));

// Route production `@/db` to testDb so the post-commit micro-tx writes to
// the real test Postgres.
vi.mock("@/db", async () => {
	const { testDb } = await import("../../db/_fixtures/db");
	return { db: testDb };
});

vi.mock("@/db/index", async () => {
	const { testDb } = await import("../../db/_fixtures/db");
	return { db: testDb };
});

import { signOutAction } from "@/server/auth/logout";
import { testClient } from "../../db/_fixtures/db";

beforeEach(() => {
	mockGetSession.mockReset();
	mockSignOut.mockReset();
	mockHeadersGet.mockReset();
});

afterEach(async () => {
	await testClient.unsafe(`TRUNCATE events, users CASCADE`);
	vi.clearAllMocks();
});

describe("signOutAction emits user.signed_out (ENGINE.6 §D.5 V3 carve-out)", () => {
	// === Happy path: getSession returns userId, signOut, then post-commit emit ====

	it("user.signed_out::happy-path-emits-event-in-post-commit-tx", async () => {
		// Per plan §D.5: getSession returns userId BEFORE signOut; signOut
		// deletes the session; insertEvent runs in a separate micro-tx
		// after signOut completes.
		const userId = "01234567-89ab-7def-8123-456789abcdef";
		mockGetSession.mockResolvedValueOnce({ user: { id: userId } });
		mockSignOut.mockResolvedValueOnce({ success: true });

		try {
			await signOutAction();
		} catch {
			// redirect on success.
		}

		// One events row with event_type='user.signed_out'.
		const evRows = await testClient<
			{
				event_type: string;
				aggregate_type: string;
				aggregate_id: string;
				payload: Record<string, unknown>;
				metadata: Record<string, unknown>;
			}[]
		>`SELECT event_type, aggregate_type, aggregate_id, payload, metadata
		    FROM events WHERE event_type = 'user.signed_out'`;
		expect(evRows.length).toBe(1);
		const ev = evRows[0]!;
		expect(ev.aggregate_type).toBe("user");
		expect(ev.aggregate_id).toBe(userId);
		expect(ev.payload).toEqual({ userId });
		// Metadata per plan §D.5: flow_id='F-AUTH-5', user_id=userId,
		// actor_id=userId (self-actor). ip/user_agent/request_id are
		// 'unknown' placeholders per S-C deferral.
		expect(ev.metadata.flow_id).toBe("F-AUTH-5");
		expect(ev.metadata.user_id).toBe(userId);
		expect(ev.metadata.actor_id).toBe(userId);
	});

	// === No session → no event (idempotent no-op path) =======================

	it("user.signed_out::no-session-emits-nothing", async () => {
		// Per plan §D.5: `if (userId)` guard suppresses emission when
		// getSession returns null (double-click logout, already-signed-out
		// call). signOut still runs (idempotent); no events row.
		mockGetSession.mockResolvedValueOnce(null);
		mockSignOut.mockResolvedValueOnce({ success: true });

		try {
			await signOutAction();
		} catch {
			// redirect.
		}

		const evRows = await testClient<
			{ count: string }[]
		>`SELECT COUNT(*)::text AS count FROM events WHERE event_type = 'user.signed_out'`;
		expect(evRows[0]?.count).toBe("0");
	});

	// === getSession returning user without id → no event =====================

	it("user.signed_out::session-with-no-user-id-emits-nothing", async () => {
		// Edge case: getSession returns a session object but session.user.id
		// is missing. The `userId ?? null` coalesce → null → no emission.
		mockGetSession.mockResolvedValueOnce({ user: {} });
		mockSignOut.mockResolvedValueOnce({ success: true });

		try {
			await signOutAction();
		} catch {}

		const evRows = await testClient<
			{ count: string }[]
		>`SELECT COUNT(*)::text AS count FROM events WHERE event_type = 'user.signed_out'`;
		expect(evRows[0]?.count).toBe("0");
	});

	// === getSession is called BEFORE signOut (mock-call order) ===============

	it("user.signed_out::getSession-called-before-signOut", async () => {
		// Per plan §D.5: getSession MUST be called BEFORE signOut. After
		// signOut the session is deleted and userId is unrecoverable.
		// Verify via mock invocation-order tracking.
		const userId = "01234567-89ab-7def-8123-456789abcdef";
		const callOrder: string[] = [];
		mockGetSession.mockImplementation(async () => {
			callOrder.push("getSession");
			return { user: { id: userId } };
		});
		mockSignOut.mockImplementation(async () => {
			callOrder.push("signOut");
			return { success: true };
		});

		try {
			await signOutAction();
		} catch {}

		expect(callOrder).toEqual(["getSession", "signOut"]);
	});

	// === Emission lands in a separate tx AFTER signOut ======================

	it("user.signed_out::emission-tx-runs-after-signOut", async () => {
		// Per plan §D.5 V3 carve-out: emission tx is a SEPARATE post-commit
		// tx, opened AFTER signOut returns. We verify by making signOut
		// itself probe the events table — at signOut time, the events row
		// MUST NOT yet exist (the post-commit micro-tx hasn't opened yet).
		const userId = "01234567-89ab-7def-8123-456789abcdef";
		let observedEventsAtSignOutTime = -1;
		mockGetSession.mockResolvedValueOnce({ user: { id: userId } });
		mockSignOut.mockImplementation(async () => {
			const rows = await testClient<
				{ count: string }[]
			>`SELECT COUNT(*)::text AS count FROM events WHERE event_type = 'user.signed_out'`;
			observedEventsAtSignOutTime = Number.parseInt(rows[0]?.count ?? "0", 10);
			return { success: true };
		});

		try {
			await signOutAction();
		} catch {}

		// At signOut time the events row did not yet exist.
		expect(observedEventsAtSignOutTime).toBe(0);
		// After signOutAction completes, the events row IS present.
		const afterRows = await testClient<
			{ count: string }[]
		>`SELECT COUNT(*)::text AS count FROM events WHERE event_type = 'user.signed_out'`;
		expect(afterRows[0]?.count).toBe("1");
	});

	// === aggregate_type='user', aggregate_id=userId ==========================

	it("user.signed_out::aggregate_id-equals-userId", async () => {
		// Per plan §A: aggregate_type='user', aggregate_id=userId. The
		// aggregate is the participant (their session being terminated).
		const userId = "01234567-89ab-7def-8123-456789abcdef";
		mockGetSession.mockResolvedValueOnce({ user: { id: userId } });
		mockSignOut.mockResolvedValueOnce({ success: true });

		try {
			await signOutAction();
		} catch {}

		const evRows = await testClient<
			{ aggregate_type: string; aggregate_id: string }[]
		>`SELECT aggregate_type, aggregate_id FROM events WHERE event_type = 'user.signed_out'`;
		expect(evRows[0]?.aggregate_type).toBe("user");
		expect(evRows[0]?.aggregate_id).toBe(userId);
	});
});
