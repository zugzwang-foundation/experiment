import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * MOBILE-1 · Phase B — THE SECOND SERVER-SIDE CALL SITE: `acceptTosAction`
 * REFUSES A PHONE OR TABLET AT FUNCTION ENTRY, BEFORE ANYTHING IS WRITTEN.
 *
 * WHAT THIS PROVES, AND WHY IT IS THE ROW THAT MATTERS MOST IN THIS TASK.
 * `docs/plans/MOBILE-1.md` §7 row 6 (M1-2) and Self-critique #6, both rated
 * HIGH: the route-wrapper gate alone does NOT cover first-time signup
 * completion. `acceptTosAction` issues its session through an in-process
 * `SERVER_ONLY` Better Auth endpoint that never routes through
 * `/api/auth/[...all]` at all — so a mobile device holding a valid
 * `onboarding_ref` cookie would have completed signup with zero server-side
 * gate.
 *
 * ⛔⛔ AND GATING "JUST BEFORE `issueOnboardingSession`" WOULD NOT HAVE FIXED
 * IT — THIS IS THE ORPHANED-GRANT PROOF. Read `src/server/auth/tos-accept.ts`:
 * its transaction grants the once-per-user initial Dharma and writes the
 * append-only `user.tos_accepted` event BEFORE session issuance is even
 * reached. A check placed there would let a blocked device grant real Dharma
 * and write a permanent audit event, then deny the session that would let
 * anyone ever use either — leaving a ToS-accepted, unsessionable user row
 * permanently holding a CONSUMED one-shot `initial_grant` slot
 * (`dharma_ledger_initial_grant_user_uq`, I-GRANT-ONCE-001-adjacent). That
 * slot never comes back: the ledger is Bucket A, append-only at the storage
 * layer, so there is no correction that frees it.
 *
 * ⇒ Assertions (b) and (c) below are therefore not "the action did nothing".
 * They are "the action did nothing IRREVERSIBLE" — the distinction the plan
 * ruled on and the reason the check goes at FUNCTION ENTRY, before the
 * `onboarding_ref` cookie is even read, rather than one line before issuance.
 * §1 of the plan is honest that no thesis invariant is touched; this is the
 * nearest thing this task has to one, and it is written down as such.
 *
 * WHAT IS ASSERTED (plan §7 row 6, verbatim):
 *   (a) `redirect("/sign-in")` fires at function entry, before the tx opens
 *   (b) ZERO `dharma_ledger` rows
 *   (c) ZERO `events` rows
 *   (d) no session / cookie issued
 *   + a DESKTOP positive control, without which (b)/(c)/(d) pass vacuously
 *     against any bug that makes the action write nothing at all.
 *
 * ⚠ VEHICLE: `tests/server/auth/tos-accept-grant.test.ts` — `vi.mock("@/db")`
 * → `testDb`, mocked `next/headers` + `onboarding-ref`, driving the REAL
 * `acceptTosAction` against test Postgres :54322. The session-issuance mock is
 * `tests/server/auth/tos.test.ts`'s (`auth.api.issueOnboardingSession` as a
 * `vi.fn`), which is what makes (d) directly assertable instead of inferred.
 *
 * ⚠ THE COOKIE IS VALID IN EVERY CASE HERE. That is the point: this is not the
 * missing/expired/tampered path (already covered by `tos.test.ts`). The device
 * class is the sole reason for refusal, and the sole independent variable
 * between the blocked case and the control.
 *
 * ⚠ TDD DRIVER, NOT A `_probe-*` REGRESSION GUARD (CLAUDE.md §5.6).
 */

const { mockVerifyOnboardingRef } = vi.hoisted(() => ({
	mockVerifyOnboardingRef: vi.fn(),
}));

vi.mock("@/server/auth/onboarding-ref", () => ({
	signOnboardingRef: vi.fn(),
	verifyOnboardingRef: mockVerifyOnboardingRef,
}));

const { mockIssueOnboardingSession } = vi.hoisted(() => ({
	mockIssueOnboardingSession: vi.fn(),
}));

vi.mock("@/server/auth", () => ({
	auth: { api: { issueOnboardingSession: mockIssueOnboardingSession } },
}));

const { mockCookiesGet, mockCookiesDelete, mockHeadersGet } = vi.hoisted(
	() => ({
		mockCookiesGet: vi.fn(),
		mockCookiesDelete: vi.fn(),
		mockHeadersGet: vi.fn(),
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

vi.mock("@/db", async () => {
	const { testDb } = await import("../db/_fixtures/db");
	return { db: testDb };
});

vi.mock("@/db/index", async () => {
	const { testDb } = await import("../db/_fixtures/db");
	return { db: testDb };
});

import { eq } from "drizzle-orm";

import { dharmaLedger, users } from "@/db/schema";
import { acceptTosAction } from "@/server/auth/tos-accept";
import { testClient, testDb } from "../db/_fixtures/db";
import { truncateTables } from "../db/_fixtures/truncate";

// --- User-Agent fixtures ---------------------------------------------------
// Real, mixed-case wire strings; the full table and its reasoning live in
// tests/unit/auth/device-class.test.ts.

const PHONE_UA =
	"Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const ANDROID_TABLET_UA =
	"Mozilla/5.0 (Linux; Android 13; SM-X700) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";
const DESKTOP_UA =
	"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

let logSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
	mockVerifyOnboardingRef.mockReset();
	mockCookiesGet.mockReset();
	mockCookiesDelete.mockReset();
	mockHeadersGet.mockReset();
	mockIssueOnboardingSession.mockReset();
	mockIssueOnboardingSession.mockResolvedValue({ ok: true });
	logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(async () => {
	logSpy.mockRestore();
	await truncateTables(testClient, ["events", "dharma_ledger", "users"]);
	vi.clearAllMocks();
});

function fd(): FormData {
	const f = new FormData();
	f.append("accepted", "true");
	return f;
}

async function seedUserNoTos(suffix: string): Promise<string> {
	const [user] = await testDb
		.insert(users)
		.values({
			name: "Pre-ToS Device Gate",
			email: `devicegate-${suffix}@example.com`,
			pseudonym: `devicegate-${suffix}`,
		})
		.returning({ id: users.id });
	if (!user) throw new Error("user seed failed");
	return user.id;
}

/**
 * Arm a VALID `onboarding_ref` cookie plus the request's IP/UA. `userId` is
 * what `verifyOnboardingRef` resolves the (real, signed-in-production) token
 * to — so every call below carries a genuinely valid bearer.
 */
function armValidContext(userId: string, ua: string): void {
	mockCookiesGet.mockImplementation((name: string) =>
		name === "onboarding_ref"
			? { name: "onboarding_ref", value: "signed-ref-token" }
			: undefined,
	);
	mockVerifyOnboardingRef.mockReturnValue({ userId });
	mockHeadersGet.mockImplementation((h: string) => {
		if (h === "x-forwarded-for") return "1.2.3.4";
		if (h === "user-agent") return ua;
		return null;
	});
}

/**
 * The destination of a Next.js `redirect()` throw, by the same algorithm
 * `next/dist/client/components/redirect.js`'s own `getURLFromRedirectError`
 * uses: digest is `NEXT_REDIRECT;<type>;<url>;<status>;`.
 *
 * ⛔ THROWS LOUDLY on anything that is not a redirect throw. A helper that
 * returned `null` for an unrecognised shape would turn "the action returned
 * normally" into a quiet mismatch instead of a legible failure.
 */
function redirectTargetOf(caught: unknown): string {
	const digest = (caught as { digest?: unknown } | null | undefined)?.digest;
	if (typeof digest !== "string" || !digest.startsWith("NEXT_REDIRECT;")) {
		throw new Error(
			`expected a Next.js redirect throw, got: ${String(
				(caught as Error | null | undefined)?.message ?? caught,
			)} (digest: ${String(digest)})`,
		);
	}
	return digest.split(";").slice(2, -2).join(";");
}

/** Run the real action and return whatever it threw (or `null`). */
async function runAction(): Promise<unknown> {
	try {
		await acceptTosAction(fd());
		return null;
	} catch (e) {
		return e;
	}
}

async function ledgerRowsFor(userId: string) {
	return testDb
		.select({
			entryType: dharmaLedger.entryType,
			amount: dharmaLedger.amount,
		})
		.from(dharmaLedger)
		.where(eq(dharmaLedger.userId, userId));
}

async function eventCountFor(userId: string): Promise<number> {
	const rows = await testClient<{ count: string }[]>`
		SELECT COUNT(*)::text AS count FROM events WHERE aggregate_id = ${userId}`;
	return Number(rows[0]?.count ?? "-1");
}

async function eventTypesFor(userId: string): Promise<string[]> {
	const rows = await testClient<{ event_type: string }[]>`
		SELECT event_type FROM events WHERE aggregate_id = ${userId}`;
	return rows.map((r) => r.event_type).sort();
}

async function tosAcceptedAtOf(userId: string): Promise<Date | null> {
	const rows = await testDb
		.select({ tosAcceptedAt: users.tosAcceptedAt })
		.from(users)
		.where(eq(users.id, userId));
	return rows[0]?.tosAcceptedAt ?? null;
}

describe("device-gate-tos-accept::a-blocked-device-completing-signup", () => {
	it("device-gate-tos-accept::phone-redirects-to-sign-in-at-function-entry", async () => {
		// (a) — and "at function entry" is asserted structurally, not by reading
		// the diff: plan §3 Call site 2 says "classify at FUNCTION ENTRY, before
		// the `onboarding_ref` cookie is even read", which is EARLIER than the
		// review's own wording ("before calling issueOnboardingSession") and is
		// the whole of the M1-2 fix. If the cookie was read, the check is in the
		// wrong place even when the redirect is right.
		const userId = await seedUserNoTos("entry");
		armValidContext(userId, PHONE_UA);

		const caught = await runAction();
		expect(redirectTargetOf(caught)).toBe("/sign-in");

		expect(
			mockCookiesGet,
			`the \`onboarding_ref\` cookie was read before the device check. Plan ` +
				`§3 places the classifier at FUNCTION ENTRY — earlier than the ` +
				`cookie read, earlier than the transaction, earlier than anything ` +
				`that can write.`,
		).not.toHaveBeenCalled();
		expect(mockVerifyOnboardingRef).not.toHaveBeenCalled();
	});

	it("device-gate-tos-accept::phone-writes-no-dharma-and-no-events", async () => {
		// (b) + (c) — the orphaned-grant proof. NOT "nothing happened": the point
		// is that the once-per-user `initial_grant` slot is not consumed for a
		// session that will never exist, and that no permanent append-only audit
		// event is written for a signup that is being refused.
		const userId = await seedUserNoTos("writes");
		armValidContext(userId, PHONE_UA);

		expect(redirectTargetOf(await runAction())).toBe("/sign-in");

		expect(
			await ledgerRowsFor(userId),
			`a \`dharma_ledger\` row was written for a device that is being refused ` +
				`a session. \`dharma_ledger\` is Bucket A — append-only at the storage ` +
				`layer — so this row is permanent and the user's one-shot ` +
				`\`initial_grant\` slot ` +
				`(\`dharma_ledger_initial_grant_user_uq\`) is consumed forever.`,
		).toEqual([]);

		expect(
			await eventTypesFor(userId),
			`an \`events\` row was written for a refused signup. Both the grant ` +
				`(\`dharma.granted\`) and the acceptance (\`user.tos_accepted\`) are ` +
				`append-only and permanent.`,
		).toEqual([]);

		// Global counts too: the aggregate_id filter above would miss a row
		// written under a different aggregate.
		const totals = await testClient<{ events: string; ledger: string }[]>`
			SELECT (SELECT COUNT(*) FROM events)::text AS events,
			       (SELECT COUNT(*) FROM dharma_ledger)::text AS ledger`;
		expect(totals[0]).toEqual({ events: "0", ledger: "0" });
	});

	it("device-gate-tos-accept::phone-leaves-tos_accepted_at-NULL-and-issues-no-session", async () => {
		// (d), plus the users-row half of (b)/(c). An accepted-but-unsessionable
		// user row is exactly the orphan state the function-entry placement
		// exists to prevent, so the column and the session are asserted together.
		const userId = await seedUserNoTos("session");
		armValidContext(userId, PHONE_UA);

		expect(redirectTargetOf(await runAction())).toBe("/sign-in");

		expect(
			await tosAcceptedAtOf(userId),
			`\`users.tos_accepted_at\` was set for a device that is being refused a ` +
				`session — a ToS-accepted user who can never sign in.`,
		).toBeNull();
		expect(mockIssueOnboardingSession).not.toHaveBeenCalled();
		expect(
			mockCookiesDelete,
			`the \`onboarding_ref\` cookie was cleared on a refused request. The ` +
				`bearer is untouched by a device refusal — the same person on a ` +
				`computer must be able to finish with it.`,
		).not.toHaveBeenCalled();
	});

	it("device-gate-tos-accept::an-android-tablet-is-refused-the-same-way", async () => {
		// Round 2 ruling (plan Decisions received #8): tablets are excluded from
		// Join/Login too. Same shape, different class — asserted rather than
		// assumed to follow, because the two classes travel through separate
		// branches of the classifier.
		const userId = await seedUserNoTos("tablet");
		armValidContext(userId, ANDROID_TABLET_UA);

		expect(redirectTargetOf(await runAction())).toBe("/sign-in");
		expect(await ledgerRowsFor(userId)).toEqual([]);
		expect(await eventCountFor(userId)).toBe(0);
		expect(await tosAcceptedAtOf(userId)).toBeNull();
		expect(mockIssueOnboardingSession).not.toHaveBeenCalled();
	});

	it("device-gate-tos-accept::the-refusal-emits-one-device_gate_reject-line", async () => {
		// M1-5 / plan §3 "Observability": one structured log line per reject, at
		// BOTH call sites — `call_site` is what tells them apart in one stream.
		// Not `logRequest`, whose doctrine excludes rejections and whose 7-field
		// shape is locked to the public-dataset extractor (SPEC.1 §16.3).
		const userId = await seedUserNoTos("log");
		armValidContext(userId, PHONE_UA);

		expect(redirectTargetOf(await runAction())).toBe("/sign-in");

		const rows = logSpy.mock.calls
			.map((call) => {
				try {
					return JSON.parse(String(call[0])) as Record<string, unknown>;
				} catch {
					return null;
				}
			})
			.filter(
				(row): row is Record<string, unknown> =>
					row !== null && row.event === "device_gate_reject",
			);

		expect(rows.length).toBe(1);
		expect(rows[0]?.call_site).toBe("tos-accept");
		expect(rows[0]?.device_class).toBe("phone");
		expect(String(rows[0]?.user_agent)).toContain("iPhone");
	});
});

describe("device-gate-tos-accept::the-positive-control", () => {
	it("device-gate-tos-accept::a-computer-completes-signup-and-a-phone-does-not", async () => {
		// ⛔⛔ WITHOUT THIS ROW EVERY ASSERTION ABOVE PASSES VACUOUSLY against any
		// bug that makes `acceptTosAction` write nothing at all — a broken
		// transaction, a mis-seeded fixture, a truncate that ran late. Two users,
		// one flow, ONE independent variable: the User-Agent.
		const desktopUser = await seedUserNoTos("control-desktop");
		armValidContext(desktopUser, DESKTOP_UA);
		await runAction(); // redirects to "/" on success

		expect(
			await tosAcceptedAtOf(desktopUser),
			`a DESKTOP User-Agent did not complete signup. Either the gate is ` +
				`over-blocking — the one failure plan §5 says must never happen — or ` +
				`this vehicle is broken, and every zero-write assertion in this file ` +
				`is meaningless until it is fixed.`,
		).not.toBeNull();

		const grants = await ledgerRowsFor(desktopUser);
		expect(grants.length).toBe(1);
		expect(grants[0]?.entryType).toBe("initial_grant");
		expect(await eventTypesFor(desktopUser)).toEqual([
			"dharma.granted",
			"user.tos_accepted",
		]);
		expect(mockIssueOnboardingSession).toHaveBeenCalledTimes(1);

		// …and the identical call, one User-Agent later, writes nothing.
		mockIssueOnboardingSession.mockClear();
		const phoneUser = await seedUserNoTos("control-phone");
		armValidContext(phoneUser, PHONE_UA);

		expect(redirectTargetOf(await runAction())).toBe("/sign-in");
		expect(await ledgerRowsFor(phoneUser)).toEqual([]);
		expect(await eventCountFor(phoneUser)).toBe(0);
		expect(await tosAcceptedAtOf(phoneUser)).toBeNull();
		expect(mockIssueOnboardingSession).not.toHaveBeenCalled();

		// The desktop user's rows are untouched by the phone attempt — the gate
		// refuses a request, it does not roll anything else back.
		expect((await ledgerRowsFor(desktopUser)).length).toBe(1);
	});
});
