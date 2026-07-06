import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// AUDIT-FIX-A22 Phase 2 (test-writer, RED-first) — `user.otp_signed_in`
// post-commit emit at the Better Auth `databaseHooks.session.create.after`
// seam. Contract from plan §4 (Part C) + kickoff:
//
//   emitSignedInEvent(session, ctx) — flow discriminator on ctx.path:
//     - "/sign-in/email-otp" → user.otp_signed_in (flow F-AUTH-2)
//     - any OTHER path OR null ctx → NO event, NO throw (never a mislabeled
//       event type; benign-missing-entry class)
//   VERIFY-THEN-EMIT fabrication guard: SELECT the sessions row by session.id
//   in the emitter's own db.transaction; ABSENT → skip. Present → read the
//   users row (by the session row's user_id) → insertEvent. otp payload
//   { userId, email } with email = users.email. ip/user_agent metadata come
//   from the VERIFIED sessions row's ip_address / user_agent columns.
//
// Real test Postgres via testDb (logout-event.test.ts pattern).
//
// RED EXPECTATION: `@/server/auth/post-commit-events` does not exist yet →
// this file fails at import resolution (missing module). Intended RED.

vi.mock("@/db", async () => {
	const { testDb } = await import("../../db/_fixtures/db");
	return { db: testDb };
});

vi.mock("@/db/index", async () => {
	const { testDb } = await import("../../db/_fixtures/db");
	return { db: testDb };
});

import { emitSignedInEvent } from "@/server/auth/post-commit-events";
import { testClient } from "../../db/_fixtures/db";
import { truncateTables } from "../../db/_fixtures/truncate";

const USER_ID = "01234567-89ab-7def-8123-456789abcdef";
const SESSION_ID = "01234567-89ab-7def-8123-456789abcde1";
const USER_EMAIL = "otp-user@example.com";
const SESSION_IP = "198.51.100.22";
const SESSION_UA = "Mozilla/5.0 (otp-test)";

async function seedUser(): Promise<void> {
	await testClient`
		INSERT INTO users (id, name, email, email_verified, pseudonym, google_id, pfp_filename)
		VALUES (${USER_ID}, ${"OTP User"}, ${USER_EMAIL}, ${true}, ${"OtpPseudo01"}, ${null}, ${"blue-jay-002.webp"})
	`;
}

async function seedSession(
	ip: string | null = SESSION_IP,
	ua: string | null = SESSION_UA,
): Promise<void> {
	await testClient`
		INSERT INTO sessions (id, user_id, token, expires_at, ip_address, user_agent)
		VALUES (${SESSION_ID}, ${USER_ID}, ${"tok-otp-signin"}, now() + interval '400 days', ${ip}, ${ua})
	`;
}

type EventRow = {
	event_type: string;
	aggregate_type: string;
	aggregate_id: string;
	payload: Record<string, unknown>;
	metadata: Record<string, unknown>;
};

// Scoped to the three A22 event types: suite files run sequentially
// (fileParallelism: false) but earlier suites can leave non-A22 events
// rows behind, so an unfiltered SELECT breaks the exactly-once counts in
// the full-suite run. The IN-list keeps them deterministic while still
// catching a mislabeled emit (e.g. the OTP path writing oauth's type).
async function allEvents(): Promise<EventRow[]> {
	return await testClient<EventRow[]>`
		SELECT event_type, aggregate_type, aggregate_id, payload, metadata FROM events
		WHERE event_type IN ('user.oauth_signed_in', 'user.otp_signed_in', 'user.pseudonym_assigned')
	`;
}

beforeEach(() => {
	vi.clearAllMocks();
});

afterEach(async () => {
	// truncateTables(["events","users"]) clears sessions via CASCADE.
	await truncateTables(testClient, ["events", "users"]);
	vi.clearAllMocks();
});

describe("emitSignedInEvent → user.otp_signed_in (AUDIT-FIX-A22 F-AUTH-2)", () => {
	// === Happy path — plan §5 otp bullet =====================================

	it("user.otp_signed_in::happy-path-emits-one-event", async () => {
		// Contract: ctx.path="/sign-in/email-otp" + verified sessions row + user
		// → EXACTLY ONE user.otp_signed_in row. Payload object equality
		// { userId, email } (email from users.email). Metadata self-actor:
		// flow_id F-AUTH-2, user_id=actor_id=userId, request_id "unknown",
		// idempotency_key null, ip/user_agent lifted from the sessions row.
		await seedUser();
		await seedSession();

		await emitSignedInEvent(
			{ id: SESSION_ID, userId: USER_ID },
			{ path: "/sign-in/email-otp" },
		);

		const rows = await allEvents();
		// Exactly one events row total (exactly-once — no spurious rows).
		expect(rows.length).toBe(1);
		// biome-ignore lint/style/noNonNullAssertion: length pre-asserted above
		const ev = rows[0]!;
		expect(ev.event_type).toBe("user.otp_signed_in");
		expect(ev.aggregate_type).toBe("user");
		expect(ev.aggregate_id).toBe(USER_ID);
		// Payload object equality (schemas.ts user.otp_signed_in).
		expect(ev.payload).toEqual({ userId: USER_ID, email: USER_EMAIL });
		// Metadata (eventMetadataSchema, 7-field snake_case).
		expect(ev.metadata.flow_id).toBe("F-AUTH-2");
		expect(ev.metadata.user_id).toBe(USER_ID);
		expect(ev.metadata.actor_id).toBe(USER_ID);
		expect(ev.metadata.request_id).toBe("unknown");
		expect(ev.metadata.idempotency_key).toBeNull();
		// ip/user_agent from the VERIFIED sessions row's columns.
		expect(ev.metadata.ip).toBe(SESSION_IP);
		expect(ev.metadata.user_agent).toBe(SESSION_UA);
	});

	// === Fabrication guard (LOAD-BEARING) — plan §5 otp bullet ===============

	it("user.otp_signed_in::fabrication-guard-absent-session-emits-nothing", async () => {
		// Drain-on-rollback: session INSERT rolled back → sessions row ABSENT.
		// User row committed (returning-user re-sign-in). The MISSING SESSION
		// row suppresses the emit — zero events rows, no throw.
		await seedUser();
		// NO seedSession.

		await expect(
			emitSignedInEvent(
				{ id: SESSION_ID, userId: USER_ID },
				{ path: "/sign-in/email-otp" },
			),
		).resolves.toBeUndefined();

		const rows = await allEvents();
		expect(rows.length).toBe(0);
	});

	// === Discriminator: unknown path → no event, no mislabeled type ==========

	it("user.otp_signed_in::unknown-path-emits-nothing", async () => {
		// A valid sessions row + user are present (fabrication guard would PASS),
		// so a zero-row outcome here isolates the DISCRIMINATOR: an unrecognised
		// path ("/get-session") maps to no event type → skip, never a mislabeled
		// user.otp_signed_in / user.oauth_signed_in row. Zero events, no throw.
		await seedUser();
		await seedSession();

		await expect(
			emitSignedInEvent(
				{ id: SESSION_ID, userId: USER_ID },
				{ path: "/get-session" },
			),
		).resolves.toBeUndefined();

		const rows = await allEvents();
		expect(rows.length).toBe(0);
	});

	// === Discriminator: null ctx → no event, no throw ========================

	it("user.otp_signed_in::null-ctx-emits-nothing", async () => {
		// Better Auth may pass a null endpoint context. Valid session + user are
		// present; null ctx has no path → skip. Zero events, no throw.
		await seedUser();
		await seedSession();

		await expect(
			emitSignedInEvent({ id: SESSION_ID, userId: USER_ID }, null),
		).resolves.toBeUndefined();

		const rows = await allEvents();
		expect(rows.length).toBe(0);
	});
});
