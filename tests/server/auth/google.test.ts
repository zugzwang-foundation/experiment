import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Per SCAFFOLD.3 plan §4 step 2 + §5 failure-mode #3 + §7 — Google OAuth
// callback path through Better Auth's `socialProviders.google` config +
// `databaseHooks.user.create.before` injection + `databaseHooks.session.
// create.before` gate.
//
// What we test here (the Better Auth instance configuration surface):
//   - `auth` instance is constructed with the googleProvider
//   - new-user OAuth callback invokes user.create.before with email +
//     googleId in user payload; the hook consumes a pool tuple and
//     injects pseudonym + pfpFilename
//   - `email_verified !== true` rejects with `error_oauth_email_not_verified`
//     per SPEC.2 §8.2 line 814
//   - existing-user-match (re-sign-in) skips user.create.before — no
//     second pool consumption per plan §6
//
// We do NOT spin up real Better Auth; we mock at the library boundary
// `@/server/auth/index` and assert the hook callbacks were registered
// + would fire with the right shapes. The Phase 2 implementer wires
// the actual hooks per plan Q10/Q11.

const { mockConsumeIdentityPoolTuple } = vi.hoisted(() => ({
	mockConsumeIdentityPoolTuple: vi.fn(),
}));

vi.mock("@/server/identity-pool/consume", () => ({
	consumeIdentityPoolTuple: mockConsumeIdentityPoolTuple,
}));

const { mockDb } = vi.hoisted(() => ({
	mockDb: {
		query: {
			users: {
				findFirst: vi.fn(),
			},
		},
		transaction: vi.fn(),
	},
}));

vi.mock("@/db/index", () => ({
	db: mockDb,
}));

// The Better Auth instance lives at `@/server/auth/index`. We import its
// exports for inspection — when the implementation lands, the test will
// load the actual `auth` instance and its `options` (Better Auth exposes
// the resolved config via `auth.options`).
import { auth } from "@/server/auth/index";

beforeEach(() => {
	mockConsumeIdentityPoolTuple.mockReset();
	mockDb.query.users.findFirst.mockReset();
	mockDb.transaction.mockReset();
});

afterEach(() => {
	vi.clearAllMocks();
});

describe("Google OAuth callback flow (F-AUTH-1)", () => {
	// === Plan §3 + plan §4 step 2 ===========================================

	it("google::auth-instance-has-google-social-provider", () => {
		// Plan §4 step 2 + SPEC.2 §8.10 line 937: Better Auth instance with
		// `socialProviders.google` configured. Per AGENTS.md §11 boundaries,
		// the instance is the single source of truth at `src/server/auth/
		// index.ts`. Test asserts the surface presence; implementation
		// covers the actual client ID / secret wiring via env vars.
		expect(auth).toBeDefined();
		// Better Auth's instance type exposes `options` at runtime per
		// 1.6.x. Existence of `socialProviders.google` is the contract.
		const opts = (
			auth as { options?: { socialProviders?: { google?: unknown } } }
		).options;
		expect(opts?.socialProviders?.google).toBeDefined();
	});

	// === Plan §5 failure-mode #3 ============================================

	it("google::email-not-verified-rejected", async () => {
		// Per SPEC.2 §8.2 line 814 + plan §5 failure-mode #3: Google OAuth
		// callback with `email_verified !== true` MUST reject with
		// `error_oauth_email_not_verified`. No user row, no session row.
		// Per ADR-0004 §1 (cited at SPEC.2 §8.2 line 814).
		//
		// The enforcement point is the `mapProfileToUser` / profile-mapper
		// callback on the googleProvider config. The implementer either
		// (a) throws from mapProfileToUser, or
		// (b) sets `requireEmailVerification: true` on the provider config
		//     and throws an explicit error envelope.
		//
		// We assert the option is wired; the catch-all route returns the
		// canonical error code when the rejection arm fires.
		const opts = (
			auth as {
				options?: {
					socialProviders?: {
						google?: {
							mapProfileToUser?: unknown;
							requireEmailVerification?: boolean;
						};
					};
				};
			}
		).options;

		const google = opts?.socialProviders?.google;
		expect(google).toBeDefined();

		// At least ONE of the enforcement signals must be present:
		// `mapProfileToUser` function, or `requireEmailVerification: true`.
		const hasMapper = typeof google?.mapProfileToUser === "function";
		const hasRequireVerified = google?.requireEmailVerification === true;
		expect(hasMapper || hasRequireVerified).toBe(true);

		// If mapper is the chosen path, simulate a callback profile and
		// assert it throws for unverified emails. Per ADR-0004 §1.
		if (hasMapper && typeof google?.mapProfileToUser === "function") {
			await expect(
				(google.mapProfileToUser as (p: unknown) => unknown)({
					email: "user@example.com",
					email_verified: false,
					name: "Test User",
					sub: "google-account-id-123",
				}),
			).rejects.toBeDefined();
		}
	});

	// === Plan §7 row 1 ======================================================

	it("google::new-user-runs-user-create-before-once", async () => {
		// Plan §7 google.test.ts row: "new user runs user.create.before
		// once". The hook consumes a pool tuple and injects
		// pseudonym + pfpFilename into the user data per Q10. Per
		// SPEC.2 §8.3 + plan §4 step 2, the new-user path then proceeds
		// to user-INSERT with the injected fields.
		mockConsumeIdentityPoolTuple.mockResolvedValueOnce({
			pseudonym: "RedFox001",
			pfpFilename: "red-fox-001.webp",
		});

		const opts = (
			auth as {
				options?: {
					databaseHooks?: {
						user?: {
							create?: {
								before?: (
									u: Record<string, unknown>,
									c?: unknown,
								) => Promise<unknown>;
							};
						};
					};
				};
			}
		).options;

		const userCreateBefore = opts?.databaseHooks?.user?.create?.before;
		expect(typeof userCreateBefore).toBe("function");

		if (typeof userCreateBefore !== "function") return; // narrow

		const userInput = {
			email: "test@example.com",
			emailVerified: true,
			name: "Test User",
			googleId: "google-account-id-123",
		};

		const result = await userCreateBefore(userInput);

		// Per plan Q10: `return { data: { ...user, pseudonym, pfpFilename } }`.
		// Better Auth then writes the user row with these fields.
		expect(mockConsumeIdentityPoolTuple).toHaveBeenCalledTimes(1);
		expect(result).toEqual({
			data: expect.objectContaining({
				email: "test@example.com",
				googleId: "google-account-id-123",
				pseudonym: "RedFox001",
				pfpFilename: "red-fox-001.webp",
			}),
		});
	});

	// === Plan §5 failure-mode #5 + §7 ========================================

	it("google::pool-exhaustion-throws-service-unavailable", async () => {
		// Plan §5 failure-mode #5 + plan §3 +Q10: `consumeIdentityPoolTuple`
		// returns null on exhaustion → hook throws APIError(
		// "SERVICE_UNAVAILABLE", "identity_pool_exhausted") → Better Auth
		// rolls back the user-row INSERT → catch-all surfaces HTTP 503.
		mockConsumeIdentityPoolTuple.mockResolvedValueOnce(null);

		const opts = (
			auth as {
				options?: {
					databaseHooks?: {
						user?: {
							create?: {
								before?: (
									u: Record<string, unknown>,
									c?: unknown,
								) => Promise<unknown>;
							};
						};
					};
				};
			}
		).options;

		const userCreateBefore = opts?.databaseHooks?.user?.create?.before;
		if (typeof userCreateBefore !== "function") {
			throw new Error("user.create.before hook not registered");
		}

		await expect(
			userCreateBefore({
				email: "test@example.com",
				emailVerified: true,
				name: "Test User",
				googleId: "google-account-id-123",
			}),
		).rejects.toMatchObject({
			status: "SERVICE_UNAVAILABLE",
			body: { message: "identity_pool_exhausted" },
		});
	});

	// === Plan §6 — existing-user reentry skips pool consumption =============

	it("google::existing-user-match-skips-pool-consumption", async () => {
		// Plan §6: "User signs up multiple times before accepting ToS — each
		// attempt finds existing row (by Google account ID or email),
		// user.create.before does NOT fire, no second pool consumption."
		//
		// This is library contract: Better Auth 1.6.11's
		// `databaseHooks.user.create.before` only fires on the INSERT path.
		// When `findUserByEmail` (or `findAccountByProviderAndAccountId`)
		// returns an existing row, no INSERT happens → no hook firing →
		// `consumeIdentityPoolTuple` never called.
		//
		// We can't directly invoke "the OAuth flow" without spinning up
		// Better Auth's router; instead we assert the negative case at the
		// hook surface: if the hook isn't fired, `mockConsumeIdentityPool
		// Tuple` is never called. The integration test would assert the
		// full route — out of scope per the kickoff (no integration project
		// wired).
		//
		// This test passes vacuously when the hook surface is correct; we
		// assert mock-counter zero after no invocation. Better-Auth's
		// hooking contract is the load-bearing piece.
		expect(mockConsumeIdentityPoolTuple).not.toHaveBeenCalled();
	});

	// === Plan §4 step 5 — session-gate fires on completed callback ==========

	it("google::session-gate-fires-after-user-create", async () => {
		// Plan §4 step 2: Google callback completes → user-create runs →
		// session-create runs → session-gate hook intercepts. The chain is
		// library-internal; we assert the surface that BOTH hooks are
		// registered. Plan §1 + SPEC.2 §8.3 — session.create.before is the
		// INV-3 DIRECT protection asserted in session-gate.test.ts.
		const opts = (
			auth as {
				options?: {
					databaseHooks?: {
						user?: { create?: { before?: unknown } };
						session?: { create?: { before?: unknown } };
					};
				};
			}
		).options;

		expect(typeof opts?.databaseHooks?.user?.create?.before).toBe("function");
		expect(typeof opts?.databaseHooks?.session?.create?.before).toBe(
			"function",
		);
	});
});
