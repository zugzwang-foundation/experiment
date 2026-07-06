import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// AUDIT-FIX-A22 Phase 2 (test-writer, RED-first) — Better Auth `databaseHooks`
// wiring/seam introspection (the google.test.ts pattern: mock the library IO
// boundary, import the resolved `auth` instance, assert on `auth.options`).
//
// The three post-commit emits ride the *after* seams (plan §4): every Better
// Auth `create.after` is drained post-commit by construction (the seam
// position IS the ordering guarantee). This file asserts the seams are wired:
//   - databaseHooks.session.create.after  → the sign-in emitter (F-AUTH-1/2)
//   - databaseHooks.user.create.after     → the pseudonym emitter (F-AUTH-3)
// and that the pre-existing *before* hooks stay wired (regression guard: the
// INV-3 onboarding/session gate + the identity-pool consumption are UNCHANGED
// per plan §4 "ADD emits only").
//
// RED EXPECTATION: the two `after` hooks are NOT wired yet → the two
// after-is-a-function assertions FAIL (typeof undefined). The two before-hook
// assertions PASS (they are already wired) — those are the regression guards
// that must survive the implementation. This file does NOT import the
// not-yet-existent post-commit-events module (it introspects auth.options
// only), so it fails on the assertions, not on import resolution.

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

import { auth } from "@/server/auth/index";

type CreateHooks = {
	create?: { before?: unknown; after?: unknown };
};
type AuthOpts = {
	options?: {
		databaseHooks?: {
			user?: CreateHooks;
			session?: CreateHooks;
		};
	};
};

function databaseHooks() {
	return (auth as AuthOpts).options?.databaseHooks;
}

beforeEach(() => {
	mockConsumeIdentityPoolTuple.mockReset();
	mockDb.query.users.findFirst.mockReset();
	mockDb.transaction.mockReset();
});

afterEach(() => {
	vi.clearAllMocks();
});

describe("post-commit-events wiring (AUDIT-FIX-A22 databaseHooks seams)", () => {
	// === RED: session.create.after wired (sign-in emitter) — plan §5 wiring ==

	it("wiring::session-create-after-is-a-function", () => {
		// Per plan §4: emitSignedInEvent wired at databaseHooks.session.create
		// .after (post-commit seam). NOT wired yet → RED (typeof undefined).
		expect(typeof databaseHooks()?.session?.create?.after).toBe("function");
	});

	// === RED: user.create.after wired (pseudonym emitter) — plan §5 wiring ===

	it("wiring::user-create-after-is-a-function", () => {
		// Per plan §4: emitPseudonymAssignedEvent wired at databaseHooks.user
		// .create.after (the only seam where the created users.id exists). NOT
		// wired yet → RED (typeof undefined).
		expect(typeof databaseHooks()?.user?.create?.after).toBe("function");
	});

	// === Regression guard: session.create.before (INV-3 gate) stays wired ====

	it("wiring::session-create-before-still-wired", () => {
		// Plan §4 — the deferral/onboarding gate (createSessionGate) is
		// UNCHANGED; adding the after emit must not disturb the before gate.
		expect(typeof databaseHooks()?.session?.create?.before).toBe("function");
	});

	// === Regression guard: user.create.before (pool consumption) stays wired ==

	it("wiring::user-create-before-still-wired", () => {
		// Plan §4 — identity-pool consumption + pseudonym/pfp injection is
		// UNCHANGED; adding the after emit must not disturb the before hook.
		expect(typeof databaseHooks()?.user?.create?.before).toBe("function");
	});
});
