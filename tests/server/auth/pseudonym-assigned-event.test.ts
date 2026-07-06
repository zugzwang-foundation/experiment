import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// AUDIT-FIX-A22 Phase 2 (test-writer, RED-first) — `user.pseudonym_assigned`
// post-commit emit at the Better Auth `databaseHooks.user.create.after` seam
// (the only seam where the created users.id exists). Contract from plan §4
// (Part C) + kickoff:
//
//   emitPseudonymAssignedEvent(user) — user = { id }. VERIFY-THEN-EMIT guard:
//   SELECT the users row by id in the emitter's own db.transaction; ABSENT →
//   skip (the drain-on-rollback fabrication guard: the create.after hook drains
//   even when the wrapping tx that INSERTed the user rolled back). Present →
//   ONE user.pseudonym_assigned row, payload { userId, pseudonym, pfpFilename }
//   from the users row's pseudonym / pfp_filename columns. flow_id F-AUTH-3;
//   ip/user_agent/request_id "unknown" (no request scope — logout.ts
//   precedent); idempotency_key null; user_id = actor_id = userId.
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

import { emitPseudonymAssignedEvent } from "@/server/auth/post-commit-events";
import { testClient } from "../../db/_fixtures/db";
import { truncateTables } from "../../db/_fixtures/truncate";

const USER_ID = "01234567-89ab-7def-8123-456789abcdef";
const PSEUDONYM = "PseudoAssigned01";
const PFP_FILENAME = "blue-jay-002.webp";

async function seedUser(): Promise<void> {
	await testClient`
		INSERT INTO users (id, name, email, email_verified, pseudonym, google_id, pfp_filename)
		VALUES (${USER_ID}, ${"Assigned User"}, ${"pseudo-user@example.com"}, ${true}, ${PSEUDONYM}, ${null}, ${PFP_FILENAME})
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
	await truncateTables(testClient, ["events", "users"]);
	vi.clearAllMocks();
});

describe("emitPseudonymAssignedEvent → user.pseudonym_assigned (AUDIT-FIX-A22 F-AUTH-3)", () => {
	// === Happy path — plan §5 pseudonym bullet ===============================

	it("user.pseudonym_assigned::happy-path-emits-one-event", async () => {
		// Contract: users row present → EXACTLY ONE user.pseudonym_assigned row.
		// Payload object equality { userId, pseudonym, pfpFilename } (from the
		// users row). Metadata self-actor: flow_id F-AUTH-3, user_id=actor_id=
		// userId, request_id/ip/user_agent "unknown" placeholders (no request
		// scope), idempotency_key null.
		await seedUser();

		await emitPseudonymAssignedEvent({ id: USER_ID });

		const rows = await allEvents();
		// Exactly one events row total (exactly-once — no spurious rows).
		expect(rows.length).toBe(1);
		// biome-ignore lint/style/noNonNullAssertion: length pre-asserted above
		const ev = rows[0]!;
		expect(ev.event_type).toBe("user.pseudonym_assigned");
		expect(ev.aggregate_type).toBe("user");
		expect(ev.aggregate_id).toBe(USER_ID);
		// Payload object equality (schemas.ts user.pseudonym_assigned).
		expect(ev.payload).toEqual({
			userId: USER_ID,
			pseudonym: PSEUDONYM,
			pfpFilename: PFP_FILENAME,
		});
		// Metadata (eventMetadataSchema, 7-field snake_case).
		expect(ev.metadata.flow_id).toBe("F-AUTH-3");
		expect(ev.metadata.user_id).toBe(USER_ID);
		expect(ev.metadata.actor_id).toBe(USER_ID);
		expect(ev.metadata.request_id).toBe("unknown");
		expect(ev.metadata.idempotency_key).toBeNull();
		// No request scope at the user.create.after seam — placeholders.
		expect(ev.metadata.ip).toBe("unknown");
		expect(ev.metadata.user_agent).toBe("unknown");
	});

	// === Fabrication guard (LOAD-BEARING) — plan §5 pseudonym bullet =========

	it("user.pseudonym_assigned::fabrication-guard-absent-user-emits-nothing", async () => {
		// Drain-on-rollback: the wrapping tx that INSERTed the user rolled back,
		// so the users row is ABSENT, but Better Auth still drains the
		// create.after hook. The VERIFY-THEN-EMIT guard SELECTs the users row by
		// id, finds nothing, and skips — zero events rows, no throw.
		// (No seedUser — the originating users row never committed.)

		await expect(
			emitPseudonymAssignedEvent({ id: USER_ID }),
		).resolves.toBeUndefined();

		const rows = await allEvents();
		expect(rows.length).toBe(0);
	});
});
