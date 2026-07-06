import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// AUDIT-FIX-A22 Phase 2 (test-writer, RED-first) — `user.oauth_signed_in`
// post-commit emit at the Better Auth `databaseHooks.session.create.after`
// seam. Contract from plan §4 (Part C) + kickoff:
//
//   emitSignedInEvent(session, ctx) — session = { id, userId }; ctx =
//   { path?: string } | null. Flow discriminator on ctx.path:
//     - "/callback/:id" OR startsWith("/callback/") → user.oauth_signed_in
//       (flow F-AUTH-1)
//   VERIFY-THEN-EMIT fabrication guard (plan §4, drain-on-rollback caveat):
//   the emitter opens its OWN db.transaction, SELECTs the sessions row by
//   session.id; ABSENT → skip (no events row, no throw). Present → read the
//   users row (by the session row's user_id) → insertEvent in the same
//   micro-tx. oauth payload { userId, provider:"google", googleId } with
//   googleId = users.google_id; users.google_id NULL → skip (schema requires
//   a string; no fabricated value). ip/user_agent metadata come from the
//   VERIFIED sessions row's ip_address / user_agent columns.
//
// Real test Postgres via testDb (logout-event.test.ts pattern) so the
// micro-tx physically lands (or does not land) an events row.
//
// RED EXPECTATION: `@/server/auth/post-commit-events` does not exist yet →
// this file fails at import resolution (missing module). That is the intended
// RED; the fixtures/SQL were validated independently against the live schema.

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
const GOOGLE_ID = "google-sub-abc-123";
const SESSION_IP = "203.0.113.7";
const SESSION_UA = "Mozilla/5.0 (oauth-test)";

async function seedUser(googleId: string | null = GOOGLE_ID): Promise<void> {
	await testClient`
		INSERT INTO users (id, name, email, email_verified, pseudonym, google_id, pfp_filename)
		VALUES (${USER_ID}, ${"OAuth User"}, ${"oauth-user@example.com"}, ${true}, ${"OAuthPseudo01"}, ${googleId}, ${"red-fox-001.webp"})
	`;
}

async function seedSession(
	ip: string | null = SESSION_IP,
	ua: string | null = SESSION_UA,
): Promise<void> {
	await testClient`
		INSERT INTO sessions (id, user_id, token, expires_at, ip_address, user_agent)
		VALUES (${SESSION_ID}, ${USER_ID}, ${"tok-oauth-signin"}, now() + interval '400 days', ${ip}, ${ua})
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
	// truncateTables(["events","users"]) clears sessions via CASCADE (validated
	// against the live schema — sessions is Bucket C, FK to users onDelete
	// cascade; no explicit sessions teardown needed).
	await truncateTables(testClient, ["events", "users"]);
	vi.clearAllMocks();
});

describe("emitSignedInEvent → user.oauth_signed_in (AUDIT-FIX-A22 F-AUTH-1)", () => {
	// === Happy path (callback template path) — plan §5 oauth bullet ==========

	it("user.oauth_signed_in::happy-path-callback-template-emits-one-event", async () => {
		// Contract: ctx.path="/callback/:id" + verified sessions row + user with
		// google_id → EXACTLY ONE user.oauth_signed_in row. Payload object
		// equality { userId, provider:"google", googleId }. aggregate_type
		// "user"/aggregate_id=userId. Metadata self-actor: flow_id F-AUTH-1,
		// user_id=actor_id=userId, request_id "unknown", idempotency_key null,
		// ip/user_agent lifted from the sessions row.
		await seedUser();
		await seedSession();

		await emitSignedInEvent(
			{ id: SESSION_ID, userId: USER_ID },
			{ path: "/callback/:id" },
		);

		const rows = await allEvents();
		// Exactly one events row total (exactly-once — no spurious rows).
		expect(rows.length).toBe(1);
		// biome-ignore lint/style/noNonNullAssertion: length pre-asserted above
		const ev = rows[0]!;
		expect(ev.event_type).toBe("user.oauth_signed_in");
		expect(ev.aggregate_type).toBe("user");
		expect(ev.aggregate_id).toBe(USER_ID);
		// Payload object equality (schemas.ts user.oauth_signed_in).
		expect(ev.payload).toEqual({
			userId: USER_ID,
			provider: "google",
			googleId: GOOGLE_ID,
		});
		// Metadata (eventMetadataSchema, 7-field snake_case).
		expect(ev.metadata.flow_id).toBe("F-AUTH-1");
		expect(ev.metadata.user_id).toBe(USER_ID);
		expect(ev.metadata.actor_id).toBe(USER_ID);
		expect(ev.metadata.request_id).toBe("unknown");
		expect(ev.metadata.idempotency_key).toBeNull();
		// ip/user_agent from the VERIFIED sessions row's columns.
		expect(ev.metadata.ip).toBe(SESSION_IP);
		expect(ev.metadata.user_agent).toBe(SESSION_UA);
	});

	// === Prefix belt: concrete /callback/<provider> path also emits oauth =====

	it("user.oauth_signed_in::concrete-callback-path-emits-oauth-prefix-belt", async () => {
		// Contract: the discriminator's startsWith("/callback/") belt means a
		// concrete callback path ("/callback/google") also maps to oauth — not
		// just the literal "/callback/:id" template.
		await seedUser();
		await seedSession();

		await emitSignedInEvent(
			{ id: SESSION_ID, userId: USER_ID },
			{ path: "/callback/google" },
		);

		const rows = await allEvents();
		expect(rows.length).toBe(1);
		expect(rows[0]?.event_type).toBe("user.oauth_signed_in");
	});

	// === Fabrication guard (LOAD-BEARING) — plan §5 oauth bullet =============

	it("user.oauth_signed_in::fabrication-guard-absent-session-emits-nothing", async () => {
		// Drain-on-rollback caveat: the wrapping tx (which INSERTed the session)
		// rolled back, so the sessions row is ABSENT, but Better Auth still
		// drains the create.after hook. A returning-user's users row may remain
		// committed — seed it to prove it is the MISSING SESSION row (not a
		// missing user) that suppresses the emit. Zero events rows, no throw.
		await seedUser();
		// NO seedSession — the originating sessions row never committed.

		await expect(
			emitSignedInEvent(
				{ id: SESSION_ID, userId: USER_ID },
				{ path: "/callback/:id" },
			),
		).resolves.toBeUndefined();

		const rows = await allEvents();
		expect(rows.length).toBe(0);
	});

	// === oauth edge: users.google_id NULL → skip (no fabricated value) =======

	it("user.oauth_signed_in::null-google-id-emits-nothing", async () => {
		// OTP-created user later account-linked to Google but google_id still
		// NULL. schemas.ts requires googleId:string — the emitter skips rather
		// than fabricate. Session row present + oauth path → still zero events.
		await seedUser(null);
		await seedSession();

		await expect(
			emitSignedInEvent(
				{ id: SESSION_ID, userId: USER_ID },
				{ path: "/callback/:id" },
			),
		).resolves.toBeUndefined();

		const rows = await allEvents();
		expect(rows.length).toBe(0);
	});
});
