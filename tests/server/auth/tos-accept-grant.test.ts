import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ENGINE.13 T1/T2/T3/T5/T7 — the initial Dharma grant inside the F-AUTH-4
// first-acceptance transaction (@docs/plans/ENGINE.13.md §"Test plan").
// DB-backed vehicle: the tos-accept-event.test.ts pattern — vi.mock("@/db")
// → testDb, mock next/headers + onboarding-ref, drive the REAL
// `acceptTosAction` against test Postgres :54322.
//
// Contracts under test (binding, R1a/R2a/R3a/P3):
//   T1  first acceptance grants: ONE `dharma_ledger` row — entry_type
//       'initial_grant', bet_id NULL, amount = the canonical 18-dp form of
//       INITIAL_USER_DHARMA ("1000.000000000000000000" today),
//       balance_after = amount (the auto-read first-row path, P3), and it
//       is the user's ONLY ledger row; ONE `dharma.granted` events row
//       (aggregate dharma_account/userId, payload { userId, amount } with
//       the RAW constant — raw in payload, canonical in ledger, the
//       accrual precedent); the `user.tos_accepted` event + the 5 tos
//       columns land as before.
//   T2  double-invoke idempotency (MANDATORY): the REAL action called twice
//       sequentially — the second call takes the tab-race no-op branch;
//       exactly ONE grant row + ONE dharma.granted event TOTAL; tos
//       columns unchanged from call #1.
//   T3  concurrent-acceptance race (ENGINE.12 T3 mirror): two simultaneous
//       real-action calls via Promise.all — both resolve without a
//       non-redirect error; exactly ONE grant row + ONE event TOTAL.
//   T5  rollback purity: a TERMINAL fault at the tx's FINAL write (the
//       `user.tos_accepted` insertEvent) — the real UPDATE + grant ledger
//       row + dharma.granted event execute first, then ALL roll back: zero
//       dharma_ledger rows, zero events rows of EITHER type,
//       tos_accepted_at still NULL.
//   T7  no-op paths write nothing: (a) pre-accepted user → no grant row,
//       no dharma.granted event; (b) missing users row → silent return,
//       zero writes of any kind.
//
// Invariants exercised: I-GRANT-ONCE-001 (PRIMARY mechanism — users-row
// FOR UPDATE + the tab-race no-op branch; the storage-backstop twin is
// tests/invariants/I-GRANT-ONCE-001.*.spec.ts), INV-2 (balance_after =
// amount > 0; issuance is a system→user faucet — no counterparty debit, no
// transfer surface).
//
// RED drivers (plan §"Test plan" RED-first discipline): the greenfield
// imports — `@/server/dharma/grant` (module absent until ENGINE.13
// implementation) + `INITIAL_USER_DHARMA` (limits.ts does not export it
// yet) — keep this suite from resolving until implementation lands. The
// collection-level RED is load-bearing for T5/T7, which would otherwise be
// vacuously green today (no grant call exists to roll back / skip).
//
// T5 fault vehicle (the daily-credit T5 / events-idempotency idiom): a
// partial passthrough mock of `@/server/events/insert` — importActual
// delegation, throwing a TERMINAL error when eventType ===
// "user.tos_accepted" (the tx's final write). No `src/` hooks.

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
// Server Action's tx writes to the real test Postgres (the
// tos-accept-event.test.ts vehicle).
vi.mock("@/db", async () => {
	const { testDb } = await import("../../db/_fixtures/db");
	return { db: testDb };
});

vi.mock("@/db/index", async () => {
	const { testDb } = await import("../../db/_fixtures/db");
	return { db: testDb };
});

// The T5 injected-fault vehicle: wrap insertEvent so the tx's FINAL write
// (`user.tos_accepted` — emitted AFTER the grant per the R1a in-tx order)
// can throw a TERMINAL error (no SQLSTATE → never retried). Disarmed by
// default; armed only in T5.
const { eventFault } = vi.hoisted(() => ({
	eventFault: { armed: false },
}));

vi.mock("@/server/events/insert", async (importOriginal) => {
	const actual =
		await importOriginal<typeof import("@/server/events/insert")>();
	return {
		...actual,
		insertEvent: vi.fn(
			async (...args: Parameters<typeof actual.insertEvent>) => {
				if (eventFault.armed && args[1].eventType === "user.tos_accepted") {
					throw new Error(
						"injected terminal fault at the tx's final write (T5)",
					);
				}
				return actual.insertEvent(...args);
			},
		),
	};
});

import { eq } from "drizzle-orm";

import { dharmaLedger, users } from "@/db/schema";
import { acceptTosAction } from "@/server/auth/tos-accept";
import {
	PRIVACY_VERSION_HASH,
	TOS_VERSION_HASH,
} from "@/server/auth/tos-versions";
// GREENFIELD IMPORT (a RED driver): INITIAL_USER_DHARMA lands with ENGINE.13
// (R3a). Imported — never a literal "1000" — so these tests track the
// HARDEN.5 number-tuning pass.
import { INITIAL_USER_DHARMA } from "@/server/config/limits";
import { CpmmDecimal } from "@/server/cpmm/decimal";
// GREENFIELD IMPORT (the RED driver): the producer the first-acceptance
// branch calls (plan R1a). The module is absent until implementation lands,
// so the whole suite REDs at collection — T5/T7 included.
import { grantInitialDharma } from "@/server/dharma/grant";
import { testClient, testDb } from "../../db/_fixtures/db";

beforeEach(() => {
	mockVerifyOnboardingRef.mockReset();
	mockCookiesGet.mockReset();
	mockHeadersGet.mockReset();
	mockCookiesDelete.mockReset();
	eventFault.armed = false;
});

afterEach(async () => {
	await testClient.unsafe(`TRUNCATE events, dharma_ledger, users CASCADE`);
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
			name: "Pre-ToS Grant",
			email: `tosgrant-${suffix}@example.com`,
			pseudonym: `tosgrant-${suffix}`,
			// tos_accepted_at NULL — eligible for first acceptance.
		})
		.returning({ id: users.id });
	if (!user) throw new Error("user seed failed");
	return { userId: user.id };
}

/** Arm cookie + header mocks for a request carrying the given evidence. */
function armRequestContext(ip = "1.2.3.4", ua = "Mozilla/5.0 (test)"): void {
	mockCookiesGet.mockImplementation((name: string) =>
		name === "onboarding_ref"
			? { name: "onboarding_ref", value: "signed-ref-token" }
			: undefined,
	);
	mockHeadersGet.mockImplementation((h: string) => {
		if (h === "x-forwarded-for") return ip;
		if (h === "user-agent") return ua;
		return null;
	});
}

/** Run the real action; return the caught throw (null when none). */
async function runAction(): Promise<unknown> {
	try {
		await acceptTosAction(fd(true));
		return null;
	} catch (e) {
		return e;
	}
}

/** "Resolved without error" = no throw, or the Next.js redirect throw. */
function expectRedirectish(e: unknown): void {
	if (e === null) return;
	const msg = (e as Error)?.message ?? "";
	expect(msg + JSON.stringify(e)).toMatch(/(REDIRECT|redirect)/i);
}

async function readLedger(userId: string) {
	return testDb
		.select({
			entryType: dharmaLedger.entryType,
			amount: dharmaLedger.amount,
			balanceAfter: dharmaLedger.balanceAfter,
			betId: dharmaLedger.betId,
		})
		.from(dharmaLedger)
		.where(eq(dharmaLedger.userId, userId));
}

async function readTosColumns(userId: string) {
	const rows = await testDb
		.select({
			tosAcceptedAt: users.tosAcceptedAt,
			tosVersionHash: users.tosVersionHash,
			privacyVersionHash: users.privacyVersionHash,
			tosAcceptanceIp: users.tosAcceptanceIp,
			tosAcceptanceUserAgent: users.tosAcceptanceUserAgent,
		})
		.from(users)
		.where(eq(users.id, userId));
	return rows[0];
}

async function countEvents(eventType: string): Promise<number> {
	const rows = await testClient<
		{ count: string }[]
	>`SELECT COUNT(*)::text AS count FROM events WHERE event_type = ${eventType}`;
	return Number(rows[0]?.count ?? "-1");
}

async function readGrantedEvents() {
	return testClient<
		{
			aggregate_type: string;
			aggregate_id: string;
			payload: Record<string, unknown>;
			metadata: Record<string, unknown>;
		}[]
	>`SELECT aggregate_type, aggregate_id, payload, metadata
	    FROM events WHERE event_type = 'dharma.granted'`;
}

describe("acceptTosAction grants the initial Dharma (ENGINE.13)", () => {
	// === T1 — first acceptance grants ======================================

	it("tos-accept::first-acceptance-grants-initial-dharma [T1]", async () => {
		const { userId } = await seedUserNoTos("t1");
		armRequestContext();
		mockVerifyOnboardingRef.mockReturnValueOnce({ userId });

		// The RED-driver import is load-bearing: the seam under test calls
		// this producer once the implementation lands (plan R1a).
		expect(typeof grantInitialDharma).toBe("function");

		await runAction();

		// ONE ledger row — the grant, and it is the user's ONLY row.
		const ledgerRows = await readLedger(userId);
		expect(ledgerRows.length).toBe(1);
		const grant = ledgerRows[0];
		expect(grant?.entryType).toBe("initial_grant");
		expect(grant?.betId).toBeNull();
		// Canonical 18-dp in the ledger ("1000.000000000000000000" today);
		// balance_after = amount — the ENGINE.5 R-1 first-row shape (P3).
		const canonicalGrant = new CpmmDecimal(INITIAL_USER_DHARMA).toFixed(18);
		expect(grant?.amount).toBe(canonicalGrant);
		expect(grant?.balanceAfter).toBe(canonicalGrant);

		// Exactly ONE dharma.granted events row (R2a): aggregate
		// dharma_account/userId; payload carries the RAW constant.
		const granted = await readGrantedEvents();
		expect(granted.length).toBe(1);
		expect(granted[0]?.aggregate_type).toBe("dharma_account");
		expect(granted[0]?.aggregate_id).toBe(userId);
		expect(granted[0]?.payload.userId).toBe(userId);
		expect(granted[0]?.payload.amount).toBe(INITIAL_USER_DHARMA);
		// The SAME 7-field metadata object as the tos event (plan seam #2).
		expect(granted[0]?.metadata.flow_id).toBe("F-AUTH-4");
		expect(granted[0]?.metadata.user_id).toBe(userId);
		expect(granted[0]?.metadata.actor_id).toBe(userId);

		// The user.tos_accepted event + the 5 tos columns land as before.
		expect(await countEvents("user.tos_accepted")).toBe(1);
		const cols = await readTosColumns(userId);
		expect(cols?.tosAcceptedAt).not.toBeNull();
		expect(cols?.tosVersionHash).toBe(TOS_VERSION_HASH);
		expect(cols?.privacyVersionHash).toBe(PRIVACY_VERSION_HASH);
		expect(cols?.tosAcceptanceIp).toBe("1.2.3.4");
		expect(cols?.tosAcceptanceUserAgent).toBe("Mozilla/5.0 (test)");
	});

	// === T2 — double-invoke idempotency (MANDATORY) ========================

	it("tos-accept::second-invoke-takes-no-op-branch-no-second-grant [T2]", async () => {
		const { userId } = await seedUserNoTos("t2");
		mockVerifyOnboardingRef.mockReturnValue({ userId });

		// Call #1 — the first acceptance.
		armRequestContext("1.2.3.4", "tab-one-ua");
		expectRedirectish(await runAction());
		const snap = await readTosColumns(userId);
		expect(snap?.tosAcceptedAt).not.toBeNull();

		// Call #2 — DIFFERENT evidence, so an overwrite would be visible.
		// The `:126` tab-race no-op branch returns before any write.
		armRequestContext("5.6.7.8", "tab-two-ua");
		expectRedirectish(await runAction());

		// Exactly ONE grant row + ONE dharma.granted event TOTAL.
		const ledgerRows = await readLedger(userId);
		expect(ledgerRows.length).toBe(1);
		expect(ledgerRows[0]?.entryType).toBe("initial_grant");
		expect(await countEvents("dharma.granted")).toBe(1);
		expect(await countEvents("user.tos_accepted")).toBe(1);

		// tos columns unchanged from call #1.
		const after = await readTosColumns(userId);
		expect(after?.tosAcceptedAt?.getTime()).toBe(
			snap?.tosAcceptedAt?.getTime(),
		);
		expect(after?.tosAcceptanceIp).toBe("1.2.3.4");
		expect(after?.tosAcceptanceUserAgent).toBe("tab-one-ua");
	});

	// === T3 — concurrent-acceptance race (ENGINE.12 T3 mirror) =============

	it("tos-accept::concurrent-acceptances-grant-exactly-once [T3]", async () => {
		const { userId } = await seedUserNoTos("t3");
		armRequestContext();
		mockVerifyOnboardingRef.mockReturnValue({ userId });

		// Two simultaneous real-action calls. In production the users-row
		// FOR UPDATE serializes them (the loser unblocks into the no-op
		// branch); on the testDb fixture (max: 1 per client) the two txs
		// additionally queue on the single connection — either way the
		// load-bearing invariant is the TOTAL count below.
		const [errA, errB] = await Promise.all([runAction(), runAction()]);

		// Both resolve without a non-redirect error.
		expectRedirectish(errA);
		expectRedirectish(errB);

		// Exactly ONE grant row + ONE event TOTAL.
		const ledgerRows = await readLedger(userId);
		expect(ledgerRows.length).toBe(1);
		expect(ledgerRows[0]?.entryType).toBe("initial_grant");
		expect(await countEvents("dharma.granted")).toBe(1);
		expect(await countEvents("user.tos_accepted")).toBe(1);
	});

	// === T5 — rollback purity ==============================================

	it("tos-accept::terminal-fault-at-final-write-rolls-back-grant [T5]", async () => {
		const { userId } = await seedUserNoTos("t5");
		armRequestContext();
		mockVerifyOnboardingRef.mockReturnValueOnce({ userId });

		// Arm the fault: insertEvent throws TERMINAL on the tx's FINAL write
		// (user.tos_accepted) — the UPDATE + grant ledger row +
		// dharma.granted event execute first, then ALL roll back.
		eventFault.armed = true;

		await expect(acceptTosAction(fd(true))).rejects.toThrow(
			/injected terminal fault/,
		);

		// The fault actually fired (guards a silently no-op'd vehicle).
		const { insertEvent } = await import("@/server/events/insert");
		expect(vi.mocked(insertEvent).mock.calls.length).toBeGreaterThan(0);

		// Zero dharma_ledger rows.
		const ledgerCount = await testClient<
			{ count: string }[]
		>`SELECT COUNT(*)::text AS count FROM dharma_ledger`;
		expect(ledgerCount[0]?.count).toBe("0");

		// Zero events rows of EITHER type.
		expect(await countEvents("dharma.granted")).toBe(0);
		expect(await countEvents("user.tos_accepted")).toBe(0);

		// tos_accepted_at still NULL — the acceptance UPDATE rolled back too.
		const cols = await readTosColumns(userId);
		expect(cols?.tosAcceptedAt).toBeNull();
	});

	// === T7 — no-op paths write nothing ====================================

	it("tos-accept::pre-accepted-user-writes-no-grant [T7a]", async () => {
		const { userId } = await seedUserNoTos("t7a");
		// Pre-set acceptance — the tab-race no-op branch returns before the
		// grant call (T2's second half, asserted independently).
		await testClient.unsafe(
			`UPDATE users SET tos_accepted_at = now(), tos_version_hash = 'h', privacy_version_hash = 'p', tos_acceptance_ip = '9.9.9.9', tos_acceptance_user_agent = 'prior-ua' WHERE id = $1`,
			[userId],
		);
		armRequestContext();
		mockVerifyOnboardingRef.mockReturnValueOnce({ userId });

		expectRedirectish(await runAction());

		// No grant row, no dharma.granted event.
		expect((await readLedger(userId)).length).toBe(0);
		expect(await countEvents("dharma.granted")).toBe(0);
	});

	it("tos-accept::missing-users-row-writes-nothing [T7b]", async () => {
		// Valid-uuid bearer for a users row that does not exist — the `:125`
		// missing-row branch returns silently inside the tx.
		const ghostUserId = "01970000-0000-7000-8000-00000000dead";
		armRequestContext();
		mockVerifyOnboardingRef.mockReturnValueOnce({ userId: ghostUserId });

		expectRedirectish(await runAction());

		// Zero writes of any kind.
		const totals = await testClient<
			{ events: string; ledger: string; users: string }[]
		>`SELECT
				(SELECT COUNT(*) FROM events)::text AS events,
				(SELECT COUNT(*) FROM dharma_ledger)::text AS ledger,
				(SELECT COUNT(*) FROM users)::text AS users`;
		expect(totals[0]).toEqual({ events: "0", ledger: "0", users: "0" });
	});
});
