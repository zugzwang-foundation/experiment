import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Per ENGINE.6 plan §F (migration-site test) + §D.3 (admin.signed_in
// emission inside SERIALIZABLE retry tx) + S-F (LOAD-BEARING:
// aggregate_type='admin_session', aggregate_id=admin_sessions.session_id
// captured via RETURNING, metadata.user_id=NULL,
// metadata.actor_id='admin-singleton').
//
// SERIALIZABLE retry-safety per plan §D.3: eventId is generated at handler
// entry, reused across both attempts. Second attempt's events INSERT hits
// ON CONFLICT (same eventId) and dedupes. The `aggregate_id` may differ
// across retry attempts because DELETE-old+INSERT-new resets the
// admin_sessions.session_id — that's fine; ON CONFLICT on event_id
// suppresses the second insert regardless of payload differences.

const { mockCheckRateLimit, mockIpIdentifier } = vi.hoisted(() => ({
	mockCheckRateLimit: vi.fn(),
	mockIpIdentifier: vi.fn((ip: string) => ip),
}));

vi.mock("@/server/middleware/rate-limit", () => ({
	checkRateLimit: mockCheckRateLimit,
	ipIdentifier: mockIpIdentifier,
}));

const { mockCookiesSet, mockHeadersGet } = vi.hoisted(() => ({
	mockCookiesSet: vi.fn(),
	mockHeadersGet: vi.fn(),
}));

vi.mock("next/headers", () => ({
	cookies: () => ({
		get: vi.fn(),
		set: mockCookiesSet,
		delete: vi.fn(),
	}),
	headers: () => ({
		get: mockHeadersGet,
	}),
}));

// Route production `@/db` to testDb so the SERIALIZABLE tx writes to real
// test Postgres + the events row physically lands.
vi.mock("@/db", async () => {
	const { testDb } = await import("../../db/_fixtures/db");
	return { db: testDb };
});

vi.mock("@/db/index", async () => {
	const { testDb } = await import("../../db/_fixtures/db");
	return { db: testDb };
});

import { adminLoginAction } from "@/server/auth/admin/login";
import { testClient } from "../../db/_fixtures/db";
import { truncateTables } from "../../db/_fixtures/truncate";

beforeEach(() => {
	mockCheckRateLimit.mockReset();
	mockIpIdentifier.mockClear();
	mockCookiesSet.mockReset();
	mockHeadersGet.mockReset();
	process.env.ADMIN_PASSWORD = "correct-admin-password-32-bytes-min";
	process.env.BETTER_AUTH_SECRET = "test-better-auth-secret-32-bytes-min";
	mockHeadersGet.mockImplementation((h: string) => {
		if (h === "x-forwarded-for") return "1.2.3.4";
		return null;
	});
});

afterEach(async () => {
	await truncateTables(testClient, ["events", "admin_sessions"]);
	vi.clearAllMocks();
});

function fd(password: string): FormData {
	const f = new FormData();
	f.append("password", password);
	return f;
}

describe("adminLoginAction emits admin.signed_in (ENGINE.6 §D.3 S-F)", () => {
	// === Happy path: emission with aggregate_id=admin_sessions.session_id ===

	it("admin.signed_in::happy-path-aggregate_id-equals-admin_sessions-session_id", async () => {
		// Per plan §D.3 + S-F: aggregate_type='admin_session',
		// aggregate_id=the newly-inserted admin_sessions.session_id (UUIDv7
		// PK; captured via RETURNING in the SERIALIZABLE tx).
		// metadata.user_id=NULL (admin has no users row),
		// metadata.actor_id='admin-singleton'.
		mockCheckRateLimit.mockResolvedValueOnce({
			allowed: true,
			remaining: 9,
			reset: 0,
		});

		try {
			await adminLoginAction(fd(process.env.ADMIN_PASSWORD as string));
		} catch {
			// redirect on success.
		}

		// One admin_sessions row inserted.
		const sessionRows = await testClient<
			{ session_id: string }[]
		>`SELECT session_id FROM admin_sessions`;
		expect(sessionRows.length).toBe(1);
		// biome-ignore lint/style/noNonNullAssertion: length pre-asserted by expect above
		const sessionId = sessionRows[0]!.session_id;

		// One events row.
		const evRows = await testClient<
			{
				event_type: string;
				aggregate_type: string;
				aggregate_id: string;
				payload: Record<string, unknown>;
				metadata: Record<string, unknown>;
			}[]
		>`SELECT event_type, aggregate_type, aggregate_id, payload, metadata
		    FROM events WHERE event_type = 'admin.signed_in'`;
		expect(evRows.length).toBe(1);
		// biome-ignore lint/style/noNonNullAssertion: length pre-asserted by expect above
		const ev = evRows[0]!;
		expect(ev.aggregate_type).toBe("admin_session");
		expect(ev.aggregate_id).toBe(sessionId);
		// Payload per plan §A: { sessionId, ip }.
		expect(ev.payload).toEqual({ sessionId, ip: "1.2.3.4" });
		// Metadata per S-F: user_id=NULL, actor_id='admin-singleton',
		// flow_id='F-AUTH-ADMIN'.
		expect(ev.metadata.user_id).toBeNull();
		expect(ev.metadata.actor_id).toBe("admin-singleton");
		expect(ev.metadata.flow_id).toBe("F-AUTH-ADMIN");
	});

	// === Atomicity: events row commits with the SERIALIZABLE tx =============

	it("admin.signed_in::events-row-is-in-same-tx-as-admin_sessions-insert", async () => {
		// Per plan §D.3: insertEvent is inside the same SERIALIZABLE tx as
		// the DELETE+INSERT on admin_sessions. Both commit together. We
		// assert by checking that after the action completes, exactly one
		// admin_sessions row + exactly one matching events row exist.
		mockCheckRateLimit.mockResolvedValueOnce({
			allowed: true,
			remaining: 9,
			reset: 0,
		});
		try {
			await adminLoginAction(fd(process.env.ADMIN_PASSWORD as string));
		} catch {}

		const sRows = await testClient<
			{ count: string }[]
		>`SELECT COUNT(*)::text AS count FROM admin_sessions`;
		const eRows = await testClient<
			{ count: string }[]
		>`SELECT COUNT(*)::text AS count FROM events WHERE event_type = 'admin.signed_in'`;
		expect(sRows[0]?.count).toBe("1");
		expect(eRows[0]?.count).toBe("1");
	});

	// === Wrong-password path: no event emitted ==============================

	it("admin.signed_in::wrong-password-emits-no-event", async () => {
		// Per existing admin-login.test.ts + plan §D.3: wrong-password path
		// runs a dummy SELECT + constant-time delay BEFORE the SERIALIZABLE
		// tx opens. No insertEvent call → no events row.
		mockCheckRateLimit.mockResolvedValueOnce({
			allowed: true,
			remaining: 9,
			reset: 0,
		});
		const result = await adminLoginAction(fd("wrong-password"));
		expect(result).toEqual({ ok: false, code: "admin_login_invalid" });

		const eRows = await testClient<
			{ count: string }[]
		>`SELECT COUNT(*)::text AS count FROM events WHERE event_type = 'admin.signed_in'`;
		expect(eRows[0]?.count).toBe("0");
	});

	// === Rate-limit deny: no event emitted ==================================

	it("admin.signed_in::rate-limit-deny-emits-no-event", async () => {
		// Per existing admin-login.test.ts: rate-limit denial returns
		// identical-401 with no DB I/O at all. No events row.
		mockCheckRateLimit.mockResolvedValueOnce({
			allowed: false,
			retryAfter: 3600,
		});
		const result = await adminLoginAction(fd("anything"));
		expect(result).toEqual({ ok: false, code: "admin_login_invalid" });

		const eRows = await testClient<
			{ count: string }[]
		>`SELECT COUNT(*)::text AS count FROM events WHERE event_type = 'admin.signed_in'`;
		expect(eRows[0]?.count).toBe("0");
	});

	// === Concurrent admin login: prior session deleted, new session emits ===

	it("admin.signed_in::concurrent-login-revokes-prior-and-emits-one-event-for-new", async () => {
		// SPEC.1 line 736: admin signs in on tab B while tab A has a session.
		// The SERIALIZABLE DELETE+INSERT replaces the row atomically. The
		// new login emits its own `admin.signed_in` event with the new
		// session_id as aggregate_id. (The prior session has no
		// corresponding `admin.signed_out` — that's a separate path.)
		// Seed a prior admin_sessions row.
		await testClient.unsafe(
			`INSERT INTO admin_sessions (session_id, issued_at, last_seen_at)
			 VALUES (uuidv7(), now(), now())`,
		);
		const priorRows = await testClient<
			{ session_id: string }[]
		>`SELECT session_id FROM admin_sessions`;
		expect(priorRows.length).toBe(1);
		// biome-ignore lint/style/noNonNullAssertion: length pre-asserted by expect above
		const priorSessionId = priorRows[0]!.session_id;

		mockCheckRateLimit.mockResolvedValueOnce({
			allowed: true,
			remaining: 9,
			reset: 0,
		});
		try {
			await adminLoginAction(fd(process.env.ADMIN_PASSWORD as string));
		} catch {}

		// One admin_sessions row (the new one, prior was DELETEd).
		const newRows = await testClient<
			{ session_id: string }[]
		>`SELECT session_id FROM admin_sessions`;
		expect(newRows.length).toBe(1);
		// biome-ignore lint/style/noNonNullAssertion: length pre-asserted by expect above
		const newSessionId = newRows[0]!.session_id;
		expect(newSessionId).not.toBe(priorSessionId);

		// Exactly one `admin.signed_in` event (the new login). aggregate_id
		// is the NEW session_id (the row that was created in this tx).
		const evRows = await testClient<
			{ aggregate_id: string }[]
		>`SELECT aggregate_id FROM events WHERE event_type = 'admin.signed_in'`;
		expect(evRows.length).toBe(1);
		expect(evRows[0]?.aggregate_id).toBe(newSessionId);
	});

	// === Payload sessionId matches RETURNING ================================

	it("admin.signed_in::payload-sessionId-equals-RETURNING-session_id", async () => {
		// Per plan §D.3: payload={ sessionId, ip } where sessionId is the
		// RETURNING admin_sessions.session_id from the INSERT. Cross-check
		// that the payload sessionId == aggregate_id == admin_sessions PK.
		mockCheckRateLimit.mockResolvedValueOnce({
			allowed: true,
			remaining: 9,
			reset: 0,
		});
		try {
			await adminLoginAction(fd(process.env.ADMIN_PASSWORD as string));
		} catch {}

		const evRows = await testClient<
			{ aggregate_id: string; payload: Record<string, unknown> }[]
		>`SELECT aggregate_id, payload FROM events WHERE event_type = 'admin.signed_in'`;
		const sRows = await testClient<
			{ session_id: string }[]
		>`SELECT session_id FROM admin_sessions`;
		expect(evRows[0]?.payload.sessionId).toBe(sRows[0]?.session_id);
		expect(evRows[0]?.aggregate_id).toBe(sRows[0]?.session_id);
	});

	// === metadata.user_id is JSONB NULL, NOT 'admin-singleton' ===============

	it("admin.signed_in::metadata-user_id-is-jsonb-null-not-string", async () => {
		// Per plan S-F + SPEC.2 §3.6 + §8.8: metadata.user_id MUST be JSONB
		// null (not the string 'admin-singleton'; not the UUID of an
		// admin-actor row). The admin-actor identity carries in
		// metadata.actor_id='admin-singleton' only.
		mockCheckRateLimit.mockResolvedValueOnce({
			allowed: true,
			remaining: 9,
			reset: 0,
		});
		try {
			await adminLoginAction(fd(process.env.ADMIN_PASSWORD as string));
		} catch {}

		const evRows = await testClient<
			{ metadata: Record<string, unknown> }[]
		>`SELECT metadata FROM events WHERE event_type = 'admin.signed_in'`;
		// JSONB null surfaces as JavaScript null via postgres-js JSON parsing.
		expect(evRows[0]?.metadata.user_id).toBeNull();
		expect(evRows[0]?.metadata.actor_id).toBe("admin-singleton");
		// The actor encoding MUST NOT leak the actor_id into user_id.
		expect(evRows[0]?.metadata.user_id).not.toBe("admin-singleton");
	});
});
