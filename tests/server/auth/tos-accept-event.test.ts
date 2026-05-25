import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Per ENGINE.6 plan §F (migration-site test) + §D.2 (tos-accept emission
// inside existing SERIALIZABLE tx).
//
// The Server Action at `src/server/auth/tos-accept.ts` already opens a
// db.transaction at SERIALIZABLE isolation (per tos.test.ts and the
// implementation's `SELECT … FOR UPDATE` row lock). ENGINE.6 §D.2 adds:
//   - After ip + ua derivation, generate `eventId = uuidv7()` + build
//     7-field metadata with flow_id='F-AUTH-4'.
//   - Inside the existing tx, AFTER the UPDATE users SET tos_accepted_at...,
//     call insertEvent(tx, { eventType: 'user.tos_accepted', ... }).
//
// Atomicity: the events row commits in the same tx as the users UPDATE.
// Rollback → neither rows.
//
// This test uses a REAL Postgres + Drizzle (testDb) so the atomicity
// property is real. tos.test.ts mocks the DB; this complement file uses
// the real DB to verify the events row physically lands.

const { mockVerifyOnboardingRef } = vi.hoisted(() => ({
	mockVerifyOnboardingRef: vi.fn(),
}));

vi.mock("@/server/auth/onboarding-ref", () => ({
	signOnboardingRef: vi.fn(),
	verifyOnboardingRef: mockVerifyOnboardingRef,
}));

const { mockCookiesGet, mockHeadersGet, mockCookiesDelete } = vi.hoisted(
	() => ({
		mockCookiesGet: vi.fn(),
		mockHeadersGet: vi.fn(),
		mockCookiesDelete: vi.fn(),
	}),
);

vi.mock("next/headers", () => ({
	cookies: () => ({
		get: mockCookiesGet,
		set: vi.fn(),
		delete: mockCookiesDelete,
	}),
	headers: () => ({
		get: mockHeadersGet,
	}),
}));

// Route the production `@/db` import to the test client/fixture DB so the
// Server Action's tx writes to the real test Postgres. The Server Action
// imports `db` from "@/db" (not "@/db/index" — but path aliasing covers
// both). Map the alias here, then import `acceptTosAction` AFTER the mock.
vi.mock("@/db", async () => {
	const { testDb } = await import("../../db/_fixtures/db");
	return { db: testDb };
});

vi.mock("@/db/index", async () => {
	const { testDb } = await import("../../db/_fixtures/db");
	return { db: testDb };
});

import { eq } from "drizzle-orm";

import { users } from "@/db/schema";
import { acceptTosAction } from "@/server/auth/tos-accept";
import { testClient, testDb } from "../../db/_fixtures/db";

beforeEach(() => {
	mockVerifyOnboardingRef.mockReset();
	mockCookiesGet.mockReset();
	mockHeadersGet.mockReset();
	mockCookiesDelete.mockReset();
});

afterEach(async () => {
	await testClient.unsafe(`TRUNCATE events, users CASCADE`);
	vi.clearAllMocks();
});

function fd(accepted = true): FormData {
	const f = new FormData();
	f.append("accepted", accepted ? "true" : "false");
	return f;
}

async function seedUserNoTos(suffix: string): Promise<{ userId: string }> {
	const [user] = await testDb
		.insert(users)
		.values({
			name: "Pre-ToS",
			email: `tosevt-${suffix}@example.com`,
			pseudonym: `tosevt-${suffix}`,
			// tos_accepted_at NULL — eligible for acceptance.
		})
		.returning({ id: users.id });
	if (!user) throw new Error("user seed failed");
	return { userId: user.id };
}

describe("acceptTosAction emits user.tos_accepted (ENGINE.6 §D.2)", () => {
	// === Happy path: emission inside SERIALIZABLE tx, atomic with UPDATE ====

	it("user.tos_accepted::happy-path-emits-event-atomically-with-users-update", async () => {
		// Per plan §D.2: insertEvent runs inside the same SERIALIZABLE tx as
		// the UPDATE users SET tos_accepted_at. Both rows commit together.
		const { userId } = await seedUserNoTos("happy");
		mockCookiesGet.mockImplementation((name: string) =>
			name === "onboarding_ref"
				? { name: "onboarding_ref", value: "signed-ref-token" }
				: undefined,
		);
		mockVerifyOnboardingRef.mockReturnValueOnce({ userId });
		mockHeadersGet.mockImplementation((h: string) => {
			if (h === "x-forwarded-for") return "1.2.3.4";
			if (h === "user-agent") return "Mozilla/5.0 (test)";
			return null;
		});

		try {
			await acceptTosAction(fd(true));
		} catch {
			// Next.js redirect throws on success.
		}

		// users row has tos_accepted_at set.
		const uRows = await testDb
			.select({
				id: users.id,
				tosAcceptedAt: users.tosAcceptedAt,
				tosAcceptanceIp: users.tosAcceptanceIp,
				tosAcceptanceUserAgent: users.tosAcceptanceUserAgent,
			})
			.from(users)
			.where(eq(users.id, userId));
		expect(uRows[0]?.tosAcceptedAt).not.toBeNull();
		expect(uRows[0]?.tosAcceptanceIp).toBe("1.2.3.4");
		expect(uRows[0]?.tosAcceptanceUserAgent).toBe("Mozilla/5.0 (test)");

		// One events row with event_type='user.tos_accepted'.
		const evRows = await testClient<
			{
				event_type: string;
				aggregate_type: string;
				aggregate_id: string;
				payload: Record<string, unknown>;
				metadata: Record<string, unknown>;
			}[]
		>`SELECT event_type, aggregate_type, aggregate_id, payload, metadata
		    FROM events WHERE event_type = 'user.tos_accepted'`;
		expect(evRows.length).toBe(1);
		// biome-ignore lint/style/noNonNullAssertion: length pre-asserted by expect above
		const ev = evRows[0]!;
		expect(ev.aggregate_type).toBe("user");
		expect(ev.aggregate_id).toBe(userId);
		// Payload per plan §A: { userId, tosVersionHash, privacyVersionHash, ip, userAgent }.
		expect(ev.payload.userId).toBe(userId);
		expect(ev.payload.tosVersionHash).toBe("placeholder-tos-v0");
		expect(ev.payload.privacyVersionHash).toBe("placeholder-privacy-v0");
		expect(ev.payload.ip).toBe("1.2.3.4");
		expect(ev.payload.userAgent).toBe("Mozilla/5.0 (test)");
		// Metadata: flow_id='F-AUTH-4', user_id=userId, actor_id=userId
		// (self-actor per SPEC.2 §8.8). request_id='unknown' placeholder
		// per plan §D.2 S-C deferral.
		expect(ev.metadata.flow_id).toBe("F-AUTH-4");
		expect(ev.metadata.user_id).toBe(userId);
		expect(ev.metadata.actor_id).toBe(userId);
	});

	// === Tab-race idempotent: no event emitted on no-op branch =============

	it("user.tos_accepted::tab-race-no-op-emits-no-event", async () => {
		// Per plan §D.2 + the existing tos.test.ts tab-race semantics: when
		// the user has already accepted (tos_accepted_at IS NOT NULL), the
		// Server Action takes the no-op branch and returns without UPDATE.
		// Since emission is AFTER the UPDATE inside the same tx, no event
		// is emitted on this path.
		const { userId } = await seedUserNoTos("tab-race");
		// Pre-set tos_accepted_at to simulate tab #1 already won.
		await testClient.unsafe(
			`UPDATE users SET tos_accepted_at = now(), tos_version_hash = 'h', privacy_version_hash = 'p', tos_acceptance_ip = '1.2.3.4', tos_acceptance_user_agent = 'ua' WHERE id = $1`,
			[userId],
		);
		mockCookiesGet.mockImplementation((name: string) =>
			name === "onboarding_ref"
				? { name: "onboarding_ref", value: "ref" }
				: undefined,
		);
		mockVerifyOnboardingRef.mockReturnValueOnce({ userId });
		mockHeadersGet.mockImplementation(() => "1.2.3.4");

		try {
			await acceptTosAction(fd(true));
		} catch {
			// redirect on no-op + completion path.
		}

		const evRows = await testClient<
			{ count: string }[]
		>`SELECT COUNT(*)::text AS count FROM events WHERE event_type = 'user.tos_accepted'`;
		expect(evRows[0]?.count).toBe("0");
	});

	// === Checkbox-unchecked gate: no tx opened, no event emitted ===========

	it("user.tos_accepted::checkbox-unchecked-emits-no-event", async () => {
		// Per the existing tos.test.ts: checkbox check is BEFORE the tx
		// opens. No tx → no insertEvent call → no events row.
		const { userId } = await seedUserNoTos("unchecked");
		mockCookiesGet.mockImplementation((name: string) =>
			name === "onboarding_ref"
				? { name: "onboarding_ref", value: "ref" }
				: undefined,
		);
		mockVerifyOnboardingRef.mockReturnValueOnce({ userId });

		const result = await acceptTosAction(fd(false));
		expect(result).toEqual({ ok: false, code: "tos_acceptance_required" });

		const evRows = await testClient<
			{ count: string }[]
		>`SELECT COUNT(*)::text AS count FROM events WHERE event_type = 'user.tos_accepted'`;
		expect(evRows[0]?.count).toBe("0");
	});

	// === Onboarding-ref expired/missing: no tx opened, no event emitted =====

	it("user.tos_accepted::onboarding-ref-missing-emits-no-event", async () => {
		// Per plan §D.2 + existing tos.test.ts: missing cookie → redirect
		// to /sign-in BEFORE tx. No events row.
		mockCookiesGet.mockReturnValue(undefined);
		try {
			await acceptTosAction(fd(true));
		} catch {
			// redirect.
		}

		const evRows = await testClient<
			{ count: string }[]
		>`SELECT COUNT(*)::text AS count FROM events WHERE event_type = 'user.tos_accepted'`;
		expect(evRows[0]?.count).toBe("0");
	});

	// === Aggregate_id = the user being mutated ===============================

	it("user.tos_accepted::aggregate_id-equals-userId", async () => {
		// Per plan §A: aggregate_type='user', aggregate_id=userId. The
		// aggregate is the users row being mutated.
		const { userId } = await seedUserNoTos("agg");
		mockCookiesGet.mockImplementation((name: string) =>
			name === "onboarding_ref"
				? { name: "onboarding_ref", value: "ref" }
				: undefined,
		);
		mockVerifyOnboardingRef.mockReturnValueOnce({ userId });
		mockHeadersGet.mockImplementation(() => "1.2.3.4");

		try {
			await acceptTosAction(fd(true));
		} catch {}

		const evRows = await testClient<
			{ aggregate_type: string; aggregate_id: string }[]
		>`SELECT aggregate_type, aggregate_id FROM events WHERE event_type = 'user.tos_accepted'`;
		expect(evRows[0]?.aggregate_type).toBe("user");
		expect(evRows[0]?.aggregate_id).toBe(userId);
	});
});
