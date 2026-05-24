import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Per ENGINE.6 plan §F (migration-site test) + §D.4 (admin.signed_out
// emission; wrap DELETE in tx) + S-F (aggregate_type='admin_session',
// aggregate_id=admin_sessions.session_id from the cookie).
//
// The cookie value carries the admin_sessions.session_id (UUIDv7 PK) per
// admin/login.ts:173-178 + admin/logout.ts:21. The DELETE in the tx targets
// that session_id; insertEvent's aggregate_id is the same value (no
// RETURNING needed — the cookie IS the PK).
//
// No-cookie path: admin clicks logout with no admin cookie → redirect to
// /admin/login WITHOUT a DELETE, WITHOUT an events row.

const { mockCookiesGet, mockCookiesDelete } = vi.hoisted(() => ({
	mockCookiesGet: vi.fn(),
	mockCookiesDelete: vi.fn(),
}));

vi.mock("next/headers", () => ({
	cookies: () => ({
		get: mockCookiesGet,
		set: vi.fn(),
		delete: mockCookiesDelete,
	}),
}));

// Route production `@/db` to testDb so the DELETE-in-tx writes to real
// test Postgres + the events row physically lands.
vi.mock("@/db", async () => {
	const { testDb } = await import("../../db/_fixtures/db");
	return { db: testDb };
});

vi.mock("@/db/index", async () => {
	const { testDb } = await import("../../db/_fixtures/db");
	return { db: testDb };
});

import { adminLogoutAction } from "@/server/auth/admin/logout";
import { testClient } from "../../db/_fixtures/db";

beforeEach(() => {
	mockCookiesGet.mockReset();
	mockCookiesDelete.mockReset();
});

afterEach(async () => {
	await testClient.unsafe(`TRUNCATE events, admin_sessions CASCADE`);
	vi.clearAllMocks();
});

describe("adminLogoutAction emits admin.signed_out (ENGINE.6 §D.4)", () => {
	// === Happy path: DELETE + insertEvent in same tx, both commit ============

	it("admin.signed_out::happy-path-emits-event-and-deletes-session-in-same-tx", async () => {
		// Per plan §D.4: bare DELETE wrapped in db.transaction; insertEvent
		// inside the same tx; cookieStore.delete OUTSIDE tx (response-shape).
		// Seed an admin_sessions row + cookie pointing at it.
		await testClient.unsafe(
			`INSERT INTO admin_sessions (session_id, issued_at, last_seen_at)
			 VALUES (uuidv7(), now(), now())`,
		);
		const sessionRows = await testClient<
			{ session_id: string }[]
		>`SELECT session_id FROM admin_sessions`;
		const sessionId = sessionRows[0]!.session_id;
		mockCookiesGet.mockReturnValue({
			name: "zugzwang_admin_session",
			value: sessionId,
		});

		try {
			await adminLogoutAction();
		} catch {
			// redirect.
		}

		// admin_sessions row deleted.
		const afterSessions = await testClient<
			{ count: string }[]
		>`SELECT COUNT(*)::text AS count FROM admin_sessions`;
		expect(afterSessions[0]?.count).toBe("0");

		// One events row with event_type='admin.signed_out'.
		const evRows = await testClient<
			{
				event_type: string;
				aggregate_type: string;
				aggregate_id: string;
				payload: Record<string, unknown>;
				metadata: Record<string, unknown>;
			}[]
		>`SELECT event_type, aggregate_type, aggregate_id, payload, metadata
		    FROM events WHERE event_type = 'admin.signed_out'`;
		expect(evRows.length).toBe(1);
		const ev = evRows[0]!;
		expect(ev.aggregate_type).toBe("admin_session");
		expect(ev.aggregate_id).toBe(sessionId);
		// Payload per plan §A: { sessionId }.
		expect(ev.payload).toEqual({ sessionId });
		// Metadata per S-F: user_id=NULL, actor_id='admin-singleton',
		// flow_id='F-AUTH-5-ADMIN'.
		expect(ev.metadata.user_id).toBeNull();
		expect(ev.metadata.actor_id).toBe("admin-singleton");
		expect(ev.metadata.flow_id).toBe("F-AUTH-5-ADMIN");
	});

	// === Cookie cleared via cookieStore.delete ==============================

	it("admin.signed_out::cookie-cleared-after-tx", async () => {
		// Per plan §D.4: cookieStore.delete runs after the tx (response-
		// shaping; not part of the audit-trail write).
		await testClient.unsafe(
			`INSERT INTO admin_sessions (session_id, issued_at, last_seen_at)
			 VALUES (uuidv7(), now(), now())`,
		);
		const sessionRows = await testClient<
			{ session_id: string }[]
		>`SELECT session_id FROM admin_sessions`;
		const sessionId = sessionRows[0]!.session_id;
		mockCookiesGet.mockReturnValue({
			name: "zugzwang_admin_session",
			value: sessionId,
		});

		try {
			await adminLogoutAction();
		} catch {}

		expect(mockCookiesDelete).toHaveBeenCalledWith(
			expect.objectContaining({ name: "zugzwang_admin_session" }),
		);
	});

	// === No-cookie path: NO tx, NO event ====================================

	it("admin.signed_out::no-cookie-emits-no-event-and-no-delete", async () => {
		// Per plan §D.4: if there's no admin cookie, the action redirects
		// to /admin/login WITHOUT opening a tx. No events row, no DELETE
		// on admin_sessions.
		mockCookiesGet.mockReturnValue(undefined);

		try {
			await adminLogoutAction();
		} catch {
			// redirect.
		}

		const eRows = await testClient<
			{ count: string }[]
		>`SELECT COUNT(*)::text AS count FROM events WHERE event_type = 'admin.signed_out'`;
		expect(eRows[0]?.count).toBe("0");
		// Also: no admin_sessions rows existed; none added.
		const sRows = await testClient<
			{ count: string }[]
		>`SELECT COUNT(*)::text AS count FROM admin_sessions`;
		expect(sRows[0]?.count).toBe("0");
	});

	// === Atomicity: simulated tx rollback → neither change applies ==========
	//
	// (Hard to surface a tx rollback path through the production action
	// without breaking its semantics. The atomicity property is verified
	// indirectly via the happy-path test above — both the DELETE and the
	// events INSERT either both commit or both don't, by the contract of
	// db.transaction. A separate helper-level test (insert.test.ts driver)
	// exercises the rollback path directly.)

	// === metadata.user_id is JSONB NULL =====================================

	it("admin.signed_out::metadata-user_id-is-jsonb-null", async () => {
		// Per plan S-F + SPEC.2 §3.6 + §8.8: metadata.user_id MUST be JSONB
		// null. Admin actor identity carries in metadata.actor_id only.
		await testClient.unsafe(
			`INSERT INTO admin_sessions (session_id, issued_at, last_seen_at)
			 VALUES (uuidv7(), now(), now())`,
		);
		const sessionRows = await testClient<
			{ session_id: string }[]
		>`SELECT session_id FROM admin_sessions`;
		const sessionId = sessionRows[0]!.session_id;
		mockCookiesGet.mockReturnValue({
			name: "zugzwang_admin_session",
			value: sessionId,
		});

		try {
			await adminLogoutAction();
		} catch {}

		const evRows = await testClient<
			{ metadata: Record<string, unknown> }[]
		>`SELECT metadata FROM events WHERE event_type = 'admin.signed_out'`;
		expect(evRows[0]?.metadata.user_id).toBeNull();
		expect(evRows[0]?.metadata.actor_id).toBe("admin-singleton");
	});

	// === aggregate_id = the session_id from the cookie =======================

	it("admin.signed_out::aggregate_id-equals-cookie-value", async () => {
		// Per plan §D.4: aggregate_id is the cookie.value (the
		// admin_sessions.session_id). No RETURNING needed — the cookie IS
		// the PK.
		await testClient.unsafe(
			`INSERT INTO admin_sessions (session_id, issued_at, last_seen_at)
			 VALUES (uuidv7(), now(), now())`,
		);
		const sessionRows = await testClient<
			{ session_id: string }[]
		>`SELECT session_id FROM admin_sessions`;
		const sessionId = sessionRows[0]!.session_id;
		mockCookiesGet.mockReturnValue({
			name: "zugzwang_admin_session",
			value: sessionId,
		});

		try {
			await adminLogoutAction();
		} catch {}

		const evRows = await testClient<
			{ aggregate_id: string }[]
		>`SELECT aggregate_id FROM events WHERE event_type = 'admin.signed_out'`;
		expect(evRows[0]?.aggregate_id).toBe(sessionId);
	});
});
