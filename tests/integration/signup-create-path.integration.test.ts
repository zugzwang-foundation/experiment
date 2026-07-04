import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

// FIX-AUTH-SIGNUP §"End-to-end test" — RED-first end-to-end integration guard
// for the Google OAuth (and shared email-OTP) signup `unable_to_create_user`
// bug. Every existing auth test mocks at the library boundary
// (google.test.ts / otp.test.ts / session-gate.test.ts assert the hook
// RETURNS `{ data: { pseudonym } }`, never that Better Auth PERSISTS it). No
// test drives the real create-path against a real DB. That gap let the bug
// ship; this closes it.
//
// THE BUG (root-caused in the plan's Evidence chain, verified against
// node_modules/better-auth@1.6.11): Better Auth's drizzle adapter
// `transformInput` (factory.mjs:108-109) copies ONLY fields present in its
// user MODEL. The model = 6 core fields + `user.additionalFields`
// (get-tables.mjs:130-172). `src/server/auth/index.ts` declares NO
// `additionalFields`, so the `pseudonym` / `pfpFilename` injected by the
// `user.create.before` hook and the `googleId` from `mapProfileToUser` are
// silently STRIPPED before the INSERT. `users.pseudonym` is NOT NULL with no
// default (auth.ts:39) → the INSERT throws Postgres `23502`, and
// `createOAuthUser`'s `runWithTransaction` (internal-adapter.mjs:56-73)
// rolls back BOTH the user and the account inserts.
//
// We drive the REAL create-path via `auth.$context` →
// `internalAdapter.createOAuthUser(userPayload, accountData)` — the exact
// entry `oauth2/link-account.mjs:91-94` uses. NO mocking of the adapter, the
// databaseHooks, or `consumeIdentityPoolTuple`: the bug lives in the real
// drizzle adapter's field-stripping, so any mock there would mask it.
//
// RED on the current (unfixed) code: assertion #1 throws the verbatim
// `null value in column "pseudonym" of relation "users" violates not-null
// constraint` (PG `23502`). GREEN after the `additionalFields` fix lands.

import { accounts, identityPool, users } from "@/db/schema";
import { auth } from "@/server/auth/index";
import { testClient, testDb } from "../db/_fixtures/db";
import { truncateTables } from "../db/_fixtures/truncate";

// Deterministic Google profile `sub`. Drives both the account.accountId and
// (post-fix) users.google_id.
const GOOGLE_SUB = "google-sub-signup-create-path-red-0001";
const EMAIL = "signup-create-path-red@example.com";

// The single seeded identity_pool tuple. The hook composes pseudonym =
// `${colour}${animal}${number padded to 3}` (consume.ts:51) = "RedFox000".
const SEED_COLOUR = "Red";
const SEED_ANIMAL = "Fox";
const SEED_NUMBER = 0;
const SEED_PSEUDONYM = "RedFox000";
const SEED_PFP = "redfox000.png";

// userPayload is the already-mapped Google profile exactly as
// `mapProfileToUser` (auth/index.ts:256-262) returns it — camelCase keys,
// `googleId` matching the Drizzle table property the fix declares in
// additionalFields. (createOAuthUser injects createdAt/updatedAt and
// lower-cases email itself; internal-adapter.mjs:59-62.)
const userPayload = {
	email: EMAIL,
	name: "Red Fox",
	image: "https://example.com/avatar.png",
	emailVerified: true,
	googleId: GOOGLE_SUB,
};

// accountData mirrors the minimal valid shape link-account.mjs:81-90 passes:
// providerId + accountId are the load-bearing pair (createOAuthUser injects
// userId/createdAt/updatedAt). The token/expiry fields are optional-nullable
// columns on `accounts`.
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

// truncateTables (not DELETE): identity_pool carries a Bucket-B BEFORE DELETE
// no-delete trigger (0003_append_only_triggers.sql:194) — DELETE is forbidden
// at the storage layer — and, since 0021, a no-truncate guard; the fixture
// disables the guards for exactly one teardown transaction. CASCADE clears the
// FK-dependent auth tables; identity_pool is NOT FK-referenced by users
// (pseudonym is copied, not referenced) so it is listed explicitly.
async function truncateAll(): Promise<void> {
	await truncateTables(testClient, [
		"users",
		"accounts",
		"sessions",
		"identity_pool",
		"verifications",
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

describe("Google OAuth signup create-path through Better Auth (FIX-AUTH-SIGNUP)", () => {
	it("signup-create-path::persists-hook-injected-identity", async () => {
		// ACT — drive the REAL create-path: createWithHooks → user.create.before
		// (consumes a real tuple, injects pseudonym/pfpFilename) → adapter.create
		// → transformInput → real INSERT, wrapped in createOAuthUser's
		// runWithTransaction.
		const ctx = await auth.$context;

		// ASSERT #1 (plan assertion 1, the RED assertion) — createOAuthUser
		// resolves without throwing. On unfixed code this throws Postgres `23502`
		// (`null value in column "pseudonym" ... violates not-null constraint`)
		// because transformInput strips the hook-injected pseudonym before the
		// INSERT. We capture the resolved value to read back the user id.
		const created = await ctx.internalAdapter.createOAuthUser(
			userPayload,
			accountData,
		);
		expect(created).toBeTruthy();
		const newUserId = (created as { user: { id: string } }).user.id;
		expect(newUserId).toBeTruthy();

		// ASSERT #2 (plan assertion 2) — the users row exists and the three
		// custom columns round-trip: pseudonym is NON-NULL and equals the seeded
		// tuple's composed pseudonym; pfp_filename equals the tuple's slug;
		// google_id equals the Google `sub`. Locks the silent-drop for all three
		// (pfp_filename / google_id are nullable so they would not BLOCK the
		// INSERT today — they would just be NULL).
		const userRows = await testDb
			.select()
			.from(users)
			.where(eq(users.id, newUserId));
		expect(userRows.length).toBe(1);
		const user = userRows[0];
		expect(user?.pseudonym).toBe(SEED_PSEUDONYM);
		expect(user?.pfpFilename).toBe(SEED_PFP);
		expect(user?.googleId).toBe(GOOGLE_SUB);

		// ASSERT #3 (plan assertion 3) — the accounts row exists and links to the
		// new user with the google provider + the Google sub as account_id.
		const accountRows = await testDb
			.select()
			.from(accounts)
			.where(eq(accounts.userId, newUserId));
		expect(accountRows.length).toBe(1);
		const account = accountRows[0];
		expect(account?.providerId).toBe("google");
		expect(account?.accountId).toBe(GOOGLE_SUB);

		// ASSERT #4 (plan assertion 4) — the seeded identity_pool tuple was
		// consumed: assigned_at is now NON-NULL (consume.ts committed the
		// allocation in its own transaction).
		const poolRows = await testDb
			.select()
			.from(identityPool)
			.where(eq(identityPool.pseudonym, SEED_PSEUDONYM));
		expect(poolRows.length).toBe(1);
		expect(poolRows[0]?.assignedAt).not.toBeNull();
	});

	it("signup-create-path::rejects-client-supplied-pseudonym (anti-spoofing)", () => {
		// ASSERT #5 (plan assertion 5, security — supplementary, non-blocking).
		//
		// The authoritative anti-spoofing mechanism is Better Auth's
		// parseInputData (db/schema.mjs:40-50): for any user field declared
		// `input: false`, a client-supplied value throws
		// `"<key> is not allowed to be set"`. That rejection path only EXISTS
		// once `pseudonym` is a declared additionalField with `input:false` — on
		// the unfixed code `pseudonym` is not in the user model at all, so there
		// is no clean client-input endpoint to exercise it (this is an
		// OAuth + email-OTP-only setup; neither path takes a client `pseudonym`
		// in its body). We therefore assert the CONFIG-LEVEL guard that backs
		// that rejection: `input: false` is declared on all three custom fields.
		//
		// RED on unfixed code: `additionalFields` is undefined → these read
		// `undefined`, not `false`. GREEN after the fix.
		//
		// NOTE: source-level confirmation that NO client can supply
		// pseudonym/pfpFilename/googleId through any live endpoint is the
		// @security-auditor's job (plan §"Execution sequence" step 5); this
		// config assertion is the test-layer proxy, intentionally not a block.
		expect(auth.options.user?.additionalFields?.pseudonym?.input).toBe(false);
		expect(auth.options.user?.additionalFields?.pfpFilename?.input).toBe(false);
		expect(auth.options.user?.additionalFields?.googleId?.input).toBe(false);
	});
});
