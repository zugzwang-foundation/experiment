import { like, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// ═══════════════════════════════════════════════════════════════════════════
// CONCURRENT SIGNUP-COMPLETION BURST — operator ask (2026-09-08 #5): not just
// loading the sign-in page (already tested), but actually FINISHING account
// creation — real OAuth-shaped signup + real ToS acceptance (which grants the
// initial Dharma) — for many people at the exact same instant. Fires all
// signups genuinely concurrently via Promise.all through the same real
// entry points every other participant in this session was created through
// (createOAuthUser, acceptTosAction), then independently re-verifies from the
// database that every successful signup carries exactly one initial_grant
// ledger entry for the correct amount.
//
// A fresh, distinct email prefix so this can never collide with any other
// participant pool built this session. Bounded well under the identity_pool
// budget (353 unassigned as of this run) — uses 150, leaving headroom.
// ═══════════════════════════════════════════════════════════════════════════

const VOLUME_INTENT_ENV = "ZUGZWANG_STAGING_VOLUME_WRITE_ACK";
const VOLUME_INTENT_VALUE = "generate-staging-volume-fixture";

const EMAIL_PREFIX = "signup-burst-";
const EMAIL_DOMAIN = "example.com";
const BURST_SIZE = 150;
const INITIAL_GRANT = "1000";

vi.mock("@sentry/nextjs", () => ({
	captureMessage: vi.fn(),
	captureException: vi.fn(),
	addBreadcrumb: vi.fn(),
}));

const { mockVerifyOnboardingRef, mockCookiesGet, mockHeadersGet } = vi.hoisted(
	() => ({
		mockVerifyOnboardingRef: vi.fn(),
		mockCookiesGet: vi.fn(),
		mockHeadersGet: vi.fn(),
	}),
);

vi.mock("@/server/auth/onboarding-ref", () => ({
	signOnboardingRef: vi.fn(),
	verifyOnboardingRef: mockVerifyOnboardingRef,
}));
vi.mock("next/headers", () => ({
	cookies: () => ({ get: mockCookiesGet, set: vi.fn(), delete: vi.fn() }),
	headers: () => ({ get: mockHeadersGet }),
}));
vi.mock("next/navigation", () => ({ redirect: vi.fn(), notFound: vi.fn() }));
vi.mock("next/cache", () => ({
	revalidatePath: vi.fn(),
	revalidateTag: vi.fn(),
	updateTag: vi.fn(),
}));
vi.mock("@/db", async () => {
	const { guardedDb } = await import("./_lib/client");
	return { db: guardedDb };
});
vi.mock("@/db/index", async () => {
	const { guardedDb } = await import("./_lib/client");
	return { db: guardedDb };
});

import { dharmaLedger, identityPool, users } from "@/db/schema";
import { auth } from "@/server/auth/index";
import { acceptTosAction } from "@/server/auth/tos-accept";

import {
	assertRunnerLiveConnection,
	closeRunnerConnection,
	describeRunnerTarget,
	readOnly,
} from "./_lib/client";
import { resolveRunnerTarget } from "./_lib/target";
import { SYNTHETIC_TOS_IP, SYNTHETIC_TOS_USER_AGENT } from "./fixtures";

const runnerTarget = resolveRunnerTarget(process.env, {
	requireWriteIntent: true,
});
if (!runnerTarget.ok) {
	throw new Error(
		`REFUSED — target guard did not pass.\n  ${runnerTarget.reason}`,
	);
}

beforeAll(async () => {
	await assertRunnerLiveConnection();
	if (process.env[VOLUME_INTENT_ENV] !== VOLUME_INTENT_VALUE) {
		throw new Error(
			`REFUSED — ${VOLUME_INTENT_ENV} is not set to the acknowledgement value.`,
		);
	}
	const [poolRow] = await readOnly
		.select({
			free: sql<number>`count(*) FILTER (WHERE ${identityPool.assignedAt} IS NULL)::int`,
		})
		.from(identityPool);
	const free = poolRow?.free ?? 0;
	if (free < BURST_SIZE) {
		throw new Error(
			`REFUSED — identity_pool has ${free} unassigned, need ${BURST_SIZE}.`,
		);
	}
	console.log(
		`[signup-burst] target ${describeRunnerTarget()} · identity_pool free=${free}`,
	);
});
afterAll(async () => {
	await closeRunnerConnection();
});

/** One real signup, exactly ADR-0036-shaped — createOAuthUser then
 * acceptTosAction, the same two-call chain every other participant in this
 * session was created through. Each call gets its OWN mock implementation
 * closure via a fresh onboarding_ref, so genuinely concurrent calls do not
 * clobber each other's mocked request context. */
async function oneSignup(
	index: number,
): Promise<{ userId: string; ms: number }> {
	const t0 = Date.now();
	const local = `${EMAIL_PREFIX}${String(index).padStart(4, "0")}`;
	const email = `${local}@${EMAIL_DOMAIN}`;
	const ctx = await auth.$context;
	const userPayload = {
		email,
		name: `Signup Burst Participant ${index}`,
		image: null,
		emailVerified: true,
		googleId: `s5-signup-burst-sub-${local}`,
	};
	const created = await ctx.internalAdapter.createOAuthUser(userPayload, {
		providerId: "google",
		accountId: `s5-signup-burst-sub-${local}`,
		accessToken: "s5-signup-burst-access-token",
		refreshToken: "s5-signup-burst-refresh-token",
		idToken: "s5-signup-burst-id-token",
		scope: "openid email profile",
		accessTokenExpiresAt: null,
		refreshTokenExpiresAt: null,
	});
	const userId = (created as { user?: { id?: string } } | null)?.user?.id;
	if (!userId) throw new Error(`createOAuthUser returned no user for ${email}`);

	// Per-call mock state — safe under concurrency because each call reads
	// its own closed-over `userId` synchronously within acceptTosAction's own
	// execution, not a shared module-level flag toggled between calls.
	mockCookiesGet.mockImplementation((name: string) =>
		name === "onboarding_ref"
			? { name: "onboarding_ref", value: `s5-signup-burst-ref-${index}` }
			: undefined,
	);
	mockHeadersGet.mockImplementation((header: string) => {
		if (header === "x-forwarded-for") return SYNTHETIC_TOS_IP;
		if (header === "user-agent") return SYNTHETIC_TOS_USER_AGENT;
		return null;
	});
	mockVerifyOnboardingRef.mockReturnValue({ userId });

	const formData = new FormData();
	formData.set("accepted", "true");
	await acceptTosAction(formData);

	return { userId, ms: Date.now() - t0 };
}

describe("concurrent signup-completion burst + initial-grant verification", () => {
	it("fires all signups concurrently, then verifies every initial Dharma grant from the DB", async () => {
		const burstStart = Date.now();
		const results = await Promise.allSettled(
			Array.from({ length: BURST_SIZE }, (_, i) => oneSignup(i + 1)),
		);
		const burstDurationMs = Date.now() - burstStart;

		const succeeded = results.filter(
			(r): r is PromiseFulfilledResult<{ userId: string; ms: number }> =>
				r.status === "fulfilled",
		);
		const failed = results.filter(
			(r): r is PromiseRejectedResult => r.status === "rejected",
		);
		const failuresByType = new Map<string, number>();
		for (const f of failed) {
			const name =
				f.reason instanceof Error ? f.reason.constructor.name : "Unknown";
			failuresByType.set(name, (failuresByType.get(name) ?? 0) + 1);
		}
		const latencies = succeeded.map((r) => r.value.ms).sort((a, b) => a - b);
		const p50 = latencies[Math.floor(latencies.length * 0.5)] ?? 0;
		const p90 = latencies[Math.floor(latencies.length * 0.9)] ?? 0;

		console.log(
			`[signup-burst] BURST DONE in ${burstDurationMs}ms · ${succeeded.length}/${BURST_SIZE} succeeded · ${failed.length} failed`,
		);
		console.log(
			`[signup-burst] latency: min=${latencies[0] ?? 0}ms p50=${p50}ms p90=${p90}ms max=${latencies[latencies.length - 1] ?? 0}ms`,
		);
		console.log(
			`[signup-burst] failure types: ${JSON.stringify(Object.fromEntries(failuresByType))}`,
		);

		// ── VERIFICATION — independently re-derived from the DB. ──────────
		const succeededUserIds = succeeded.map((r) => r.value.userId);
		const grantRows =
			succeededUserIds.length === 0
				? []
				: await readOnly
						.select({
							userId: dharmaLedger.userId,
							amount: dharmaLedger.amount,
							balanceAfter: dharmaLedger.balanceAfter,
						})
						.from(dharmaLedger)
						.where(
							sql`${dharmaLedger.userId} IN ${succeededUserIds} AND ${dharmaLedger.entryType} = 'initial_grant'`,
						);
		const grantByUser = new Map(grantRows.map((r) => [r.userId, r]));

		let exactlyOneGrant = 0;
		let correctAmount = 0;
		let correctBalance = 0;
		const mismatches: string[] = [];
		for (const userId of succeededUserIds) {
			const row = grantByUser.get(userId);
			if (!row) {
				mismatches.push(`${userId}: no initial_grant row found`);
				continue;
			}
			exactlyOneGrant++;
			if (Number(row.amount) === Number(INITIAL_GRANT)) correctAmount++;
			else
				mismatches.push(
					`${userId}: grant amount ${row.amount}, expected ${INITIAL_GRANT}`,
				);
			if (Number(row.balanceAfter) === Number(INITIAL_GRANT)) correctBalance++;
			else
				mismatches.push(
					`${userId}: balanceAfter ${row.balanceAfter}, expected ${INITIAL_GRANT}`,
				);
		}

		// Also confirm no duplicate users were created for the same index
		// under concurrency (a real hazard this test is specifically
		// positioned to catch).
		const distinctEmails = await readOnly
			.select({ email: users.email })
			.from(users)
			.where(like(users.email, `${EMAIL_PREFIX}%@${EMAIL_DOMAIN}`));
		const emailCounts = new Map<string, number>();
		for (const row of distinctEmails) {
			emailCounts.set(row.email, (emailCounts.get(row.email) ?? 0) + 1);
		}
		const duplicateEmails = [...emailCounts.entries()].filter(([, n]) => n > 1);

		console.log(
			`[signup-burst] VERIFICATION — exactly-one-grant: ${exactlyOneGrant}/${succeeded.length} · correct amount: ${correctAmount}/${succeeded.length} · correct balance: ${correctBalance}/${succeeded.length} · duplicate emails: ${duplicateEmails.length}`,
		);
		if (mismatches.length > 0) {
			console.log(
				`[signup-burst] MISMATCHES (${mismatches.length}): ${JSON.stringify(mismatches.slice(0, 20))}`,
			);
		}
		console.log(
			`[signup-burst] SUMMARY_JSON ${JSON.stringify({
				burstSize: BURST_SIZE,
				burstDurationMs,
				succeeded: succeeded.length,
				failed: failed.length,
				failuresByType: Object.fromEntries(failuresByType),
				latencyMs: {
					p50,
					p90,
					min: latencies[0] ?? 0,
					max: latencies[latencies.length - 1] ?? 0,
				},
				exactlyOneGrant,
				correctAmount,
				correctBalance,
				duplicateEmails: duplicateEmails.length,
			})}`,
		);

		expect(
			exactlyOneGrant,
			"every successful signup should have exactly one initial_grant row",
		).toBe(succeeded.length);
		expect(
			correctAmount,
			"every initial grant should be the correct amount",
		).toBe(succeeded.length);
		expect(
			correctBalance,
			"every post-grant balance should be exactly the grant amount",
		).toBe(succeeded.length);
		expect(
			duplicateEmails.length,
			"no two concurrent signups should collide on the same email",
		).toBe(0);
	}, 600_000);
});
