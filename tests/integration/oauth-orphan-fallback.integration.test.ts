import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

// S-3 test 2 — the OAuth orphan fallback (plan §"Test 2", A-5 rescoped).
//
// ⛔ THIS IS A CHARACTERISATION TEST. IT IS EXPECTED **GREEN PRE-FIX.**
//
// Read that first, because the alternative reading is expensive. This file
// sits beside `oauth-signup-pool-deadlock.integration.test.ts`, which is a
// RED-first control and is expected RED until S-3's one-line fix lands. If a
// later reader sees this file green on unfixed code and assumes both files
// share a phase, the natural conclusion is that the deadlock test was miswired
// — it was not. The self-heal asserted here is VENDOR behaviour in
// better-auth 1.6.11; the S-3 fix neither introduces it nor changes it. This
// file is green before the fix and green after it, and that is correct.
//
// ⚠ DO NOT CALL THIS "Q-P1's PROOF." It exercises the FALLBACK and the single
// disjunct that depends on code we write. It does NOT exercise the linking
// step. Reaching `linkAccount()` needs OAuth state, cookies and a token
// exchange (`oauth2/link-account.mjs:91`), all of which this entry point
// deliberately bypasses — and `createOAuthUser` is invoked *at* that call
// site, downstream of the `findOAuthUser` branch, so entering there IS the
// "no existing user" arm and can never reach the email fallback. v2's version
// of this test was not implementable for exactly that reason.
//
// WHAT IT DOES COVER, and why that is the part worth covering:
//
// `internal-adapter.mjs:440-460` falls back to an email lookup when no
// `(providerId, accountId)` row matches, with NO gate of any kind — not on
// `accountLinking`, not on a flag. The caller then decides whether to link at
// `link-account.mjs:17-30`, behind four disjuncts. Three of them reduce to
// vendor constants read against an absent config (`accountLinking` is
// unconfigured repo-wide) and CANNOT drift from our side; those are recorded
// in ADR-0042 rather than tested, because building scaffolding to observe a
// constant buys nothing.
//
// The fourth — `requireLocalEmailVerified && !dbUser.user.emailVerified`,
// which resolves to `true && !stored` — turns entirely on the STORED value of
// `users.email_verified`. That is ours. `src/db/schema/auth.ts:37` declares it
// `.notNull().default(false)`, so **the column default is the lockout value**:
// a row that lands `false` fails that disjunct forever and does not error
// while doing it. Today `mapProfileToUser` (`auth/index.ts:420`) forces
// `emailVerified: true`, and because `emailVerified` is one of Better Auth's
// six CORE user-model fields, the `transformInput` field-stripping that caused
// FIX-AUTH-SIGNUP never reaches it. Every hop holds — but they are three hops,
// and inferring across hops is what put this defect on the wrong door for five
// days.
//
// So the value of this file is forward-looking, and is precisely this:
// a future change to `mapProfileToUser` that stopped forcing
// `emailVerified: true` would silently reopen the lockout — and this test goes
// red instead of the lockout arriving in production.
//
// ⚠ THE ORPHAN IS BUILT, NOT HAND-WRITTEN. Inserting a row with
// `emailVerified: true` and then asserting it is `true` is circular and worth
// nothing. Instead the REAL create-path runs once and the `accounts` row it
// produced is deleted, leaving a genuine orphan whose `email_verified` is
// whatever our code actually produces — which is the entire question.
// (`accounts` carries no append-only trigger — verified live against
// `pg_trigger`: zero non-internal triggers — so a plain DELETE is the honest
// mechanism here and no guard-disable dance is needed.)

import { accounts, identityPool, users } from "@/db/schema";
import { auth } from "@/server/auth/index";
import { testClient, testDb } from "../db/_fixtures/db";
import { truncateTables } from "../db/_fixtures/truncate";

// One seeded identity_pool tuple. The hook composes
// pseudonym = `${colour}${animal}${number padded to 3}` (consume.ts:53).
const SEED_COLOUR = "Amber";
const SEED_ANIMAL = "Heron";
const SEED_NUMBER = 7;
const SEED_PSEUDONYM = "AmberHeron007";
const SEED_PFP = "amberheron007.png";

const GOOGLE_SUB = "google-sub-orphan-fallback-0001";
const EMAIL = "orphan-fallback@example.com";

// An accountId that matches NOTHING. This is what forces `findOAuthUser` down
// the `else` arm at internal-adapter.mjs:440 — the email fallback under test.
// Using the real sub would find the account row and prove nothing.
const UNMATCHED_ACCOUNT_ID = "google-sub-that-was-never-stored-9999";

// Explicit and deliberate, per the plan's standing requirement that these
// files state their own timeout rather than inherit one. The 10s default
// (vitest.config.ts:31) is ample for this path — it opens no concurrent work
// and cannot wedge — but the first test in a file also pays `auth.$context`
// construction plus module-load, and a timeout tuned to the steady state is
// how a cold run becomes a flake.
const ORPHAN_TEST_TIMEOUT_MS = 20_000;

const userPayload = {
	email: EMAIL,
	name: "Amber Heron",
	image: "https://example.com/avatar.png",
	emailVerified: true,
	googleId: GOOGLE_SUB,
};

const accountData = {
	providerId: "google",
	accountId: GOOGLE_SUB,
	accessToken: "test-access-token",
	refreshToken: "test-refresh-token",
	idToken: "test-id-token",
	scope: "openid email profile",
	accessTokenExpiresAt: null,
	refreshTokenExpiresAt: null,
};

async function truncateAll(): Promise<void> {
	await truncateTables(testClient, [
		"users",
		"accounts",
		"sessions",
		"identity_pool",
		"verifications",
		"events",
	]);
}

async function seedOneTuple(): Promise<void> {
	await testDb.insert(identityPool).values({
		colour: SEED_COLOUR,
		animal: SEED_ANIMAL,
		number: SEED_NUMBER,
		pseudonym: SEED_PSEUDONYM,
		pfpFilename: SEED_PFP,
		assignedAt: null,
	});
}

beforeEach(async () => {
	await truncateAll();
	await seedOneTuple();
});

afterEach(async () => {
	await truncateAll();
});

describe("OAuth orphan fallback (S-3 test 2 — characterisation, green pre-fix)", () => {
	it(
		"oauth-orphan-fallback::finds-orphan-by-email-with-verified-flag",
		async () => {
			const ctx = await auth.$context;

			// ── ARRANGE: build a GENUINE orphan via the real create-path ──
			const created = await ctx.internalAdapter.createOAuthUser(
				userPayload,
				accountData,
			);
			expect(created).toBeTruthy();
			// Trust boundary: better-auth types this loosely; the model file
			// (signup-create-path.integration.test.ts:139) reads it the same way.
			const newUserId = (created as { user: { id: string } }).user.id;
			expect(newUserId).toBeTruthy();

			// Sanity — the account row the orphaning step will remove exists now.
			// Without this, a create-path that silently wrote no account would make
			// the delete below a no-op and the test would still pass, certifying an
			// orphan it never actually created.
			const before = await testDb
				.select()
				.from(accounts)
				.where(eq(accounts.userId, newUserId));
			expect(before.length).toBe(1);

			// Orphan it. Plain DELETE — `accounts` carries no append-only trigger.
			await testDb.delete(accounts).where(eq(accounts.userId, newUserId));
			const after = await testDb
				.select()
				.from(accounts)
				.where(eq(accounts.userId, newUserId));
			expect(after.length).toBe(0);

			// ── ACT: the account lookup misses, so the email arm must run ──
			const found = await ctx.internalAdapter.findOAuthUser(
				EMAIL,
				UNMATCHED_ACCOUNT_ID,
				"google",
			);

			// ── ASSERT 1 (Q-P1 Part 1): the fallback finds the orphan ──
			// internal-adapter.mjs:440-460's `else` arm is ungated; this observes
			// that directly rather than inferring it from the source.
			expect(found).not.toBeNull();
			const orphan = (found as { user: { id: string; emailVerified: boolean } })
				.user;
			expect(orphan.id).toBe(newUserId);

			// ── ASSERT 2 — THE WHOLE OF THIS TEST'S VALUE ──
			// link-account.mjs:22 disjunct 2 is `requireLocalEmailVerified &&
			// !dbUser.user.emailVerified`, i.e. `true && !stored`. The schema
			// default for this column is `false`, which is the LOCKOUT value. If a
			// future change to mapProfileToUser stopped forcing `emailVerified:
			// true`, the orphan would land `false`, the disjunct would short-circuit
			// linking forever, and nothing would error while it happened. This
			// assertion is what turns that silent lockout into a red test.
			expect(orphan.emailVerified).toBe(true);

			// Corroboration from storage, not just the vendor's returned object —
			// the DTO could in principle be assembled rather than read.
			const stored = await testDb
				.select()
				.from(users)
				.where(eq(users.id, newUserId));
			expect(stored.length).toBe(1);
			expect(stored[0]?.emailVerified).toBe(true);
		},
		ORPHAN_TEST_TIMEOUT_MS,
	);
});
