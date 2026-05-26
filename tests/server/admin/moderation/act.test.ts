import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// SPEC.1 §17 row `f-admin-4::pass-verdict-removal` per SCAFFOLD.16 plan §F
// sub-edit 15e (F-γ-thin extension to SPEC.1 §15 F-ADMIN-4 contract).
//
// F-γ-thin (per plan §3.7 SURPRISE 7c + §F sub-edits 15a–15e) extends
// F-ADMIN-4 with one narrow capability: inline admin removal of pass-verdict
// comments. Mitigates the v1 image-input gap (image-borne harm content
// `omni-moderation-2024-09-26` cannot classify: 6 non-CSAM text-only
// categories on image inputs, weapons-imagery).
//
// Contract per plan §F sub-edit 15a "System" bullet "Remove pass-verdict
// comment" + sub-edit 15d "Pre (Remove pass-verdict path)":
//   - Pre: any comment with `outcome === 'pass'` exists on a market the admin
//     is viewing.
//   - Effect: comment hidden from public view.
//   - Effect: an append-only audit row is written recording the removal
//     (exact `mod_actions` row shape — verdict-enum value, action column, or
//     metadata field — determined by caller-side stratum per LD-5; DEBATE.2
//     owns INSERT semantics). Encoding-agnostic per H-γ phrasing.
//   - Non-effect: `users.banned_at` NOT set (admin escalates via separate
//     Block user action if user-level enforcement needed).
//
// SCAFFOLD.16 boundaries (per LD-5 + LD-6 + plan §B B12): SCAFFOLD.16 does
// NOT ship the F-ADMIN-4 admin Server Action implementation. The Server
// Action target `moderateComment(input)` at `src/server/admin/moderation/
// act.ts` (SPEC.2 §4 line 371 per plan §F Edit 17) is DEBATE.2-owned. This
// test is therefore WRITTEN-FAILING per CLAUDE.md §5.6 tests-first rule;
// the expected red state is a module-resolution error on the dynamic import
// below — DEBATE.2 stratum lands the implementation and turns this green.
//
// Mock pattern follows the `vi.hoisted` + `vi.mock` discipline used by
// the rest of the suite (e.g., `tests/integration/precommit-moderate.
// integration.test.ts`, `tests/server/auth/admin-login.test.ts`).

const { mockDb } = vi.hoisted(() => {
	const tx = {
		execute: vi.fn(),
		select: vi.fn(),
		insert: vi.fn(),
		update: vi.fn(),
		delete: vi.fn(),
	};
	return {
		mockDb: {
			transaction: vi.fn(),
			execute: vi.fn(),
			select: vi.fn(),
			insert: vi.fn(),
			update: vi.fn(),
			_tx: tx,
		},
	};
});

vi.mock("@/db/index", () => ({
	db: mockDb,
}));

const { mockValidateAdminSession } = vi.hoisted(() => ({
	mockValidateAdminSession: vi.fn(),
}));

vi.mock("@/server/auth/admin/validate", () => ({
	validateAdminSession: mockValidateAdminSession,
}));

const { mockCookiesGet } = vi.hoisted(() => ({
	mockCookiesGet: vi.fn(),
}));

vi.mock("next/headers", () => ({
	cookies: () => ({
		get: mockCookiesGet,
		set: vi.fn(),
		delete: vi.fn(),
	}),
}));

beforeEach(() => {
	mockDb.transaction.mockReset();
	mockDb.execute.mockReset();
	mockDb._tx.execute.mockReset();
	mockDb._tx.select.mockReset();
	mockDb._tx.insert.mockReset();
	mockDb._tx.update.mockReset();
	mockDb._tx.delete.mockReset();
	mockValidateAdminSession.mockReset();
	mockCookiesGet.mockReset();
	mockDb.transaction.mockImplementation(
		(cb: (t: typeof mockDb._tx) => unknown) => cb(mockDb._tx),
	);
	// Default admin session: validator returns an admin-bearing session row.
	mockValidateAdminSession.mockResolvedValue({
		session_id: "00000000-0000-0000-0000-0000000000ad",
	});
});

afterEach(() => {
	vi.clearAllMocks();
});

describe("admin moderateComment Server Action (F-ADMIN-4 per SCAFFOLD.16 F-γ-thin)", () => {
	// `.skip` until DEBATE.2 lands `src/server/admin/moderation/act.ts` per plan
	// §B B12 + LD-5 (caller-side discipline; SCAFFOLD.16 ships the §15 F-ADMIN-4
	// contract amendment + §17 row mint; DEBATE.2 ships the implementation).
	// DEBATE.2 handoff: remove `.skip` to enable the test; the `@ts-expect-error`
	// directive below will then become an unused-directive error if act.ts ships
	// with the expected signature, signalling the test has moved past the
	// "blocked on DEBATE.2 implementation" state.
	it.skip("f-admin-4::pass-verdict-removal", async () => {
		// Plan §F sub-edit 15e SPEC.1 §17 row mint: `f-admin-4::pass-verdict-
		// removal`. Plan §F sub-edit 15a contract:
		//
		//   - Admin invokes inline Remove on a pass-verdict comment.
		//   - Append-only audit row is written (encoding-agnostic).
		//   - `users.banned_at` NOT set.
		//   - Comment hidden from public view.
		//
		// Caller-side `mod_actions` INSERT semantics are DEBATE.2-owned per
		// LD-5 (verdict-enum value vs action column vs metadata field —
		// encoding deferred). This test asserts the encoding-agnostic
		// observable effects only: at least one INSERT against `mod_actions`
		// occurred, NO UPDATE against `users.banned_at` occurred, and the
		// comment row was flipped to a hidden state. The shape of the
		// `mod_actions` INSERT (column values) is intentionally NOT asserted
		// here — that's DEBATE.2's resolution surface per plan §3.7 H-γ
		// citation chain.
		//
		// Note: this Server Action does NOT exist yet (`src/server/admin/
		// moderation/act.ts` is DEBATE.2-owned per plan §B B12 + SPEC.2 §4
		// line 371). The dynamic import below will throw a module-resolution
		// error until DEBATE.2 lands the implementation. That's the expected
		// red state per CLAUDE.md §5.6 tests-first rule.

		// Stub the dependent reads:
		//   - Pre-check: comment exists with `outcome === 'pass'`.
		//   - Inside the transaction: comment update + mod_actions insert.
		mockDb._tx.execute
			// 1. SELECT pass-verdict comment (Pre per sub-edit 15d).
			.mockResolvedValueOnce([
				{
					comment_id: "comment-pass-1",
					market_id: "market-1",
					user_id: "user-author-1",
					outcome: "pass",
					hidden_at: null,
				},
			])
			// 2. UPDATE comments SET hidden_at = now() WHERE comment_id = ?
			.mockResolvedValueOnce([{ comment_id: "comment-pass-1" }])
			// 3. INSERT INTO mod_actions (...) RETURNING audit_id
			.mockResolvedValueOnce([
				{ audit_id: "00000000-0000-0000-0000-0000000000a1" },
			]);

		// Dynamic import: blows up with module-resolution error until DEBATE.2
		// lands `src/server/admin/moderation/act.ts`. This is the documented
		// pre-implementation red state per CLAUDE.md §5.6. The
		// `@ts-expect-error` directive declares the missing-module type
		// error explicitly — once DEBATE.2 lands the implementation, this
		// directive itself becomes a TS error, signalling that the test has
		// moved past the "blocked on DEBATE.2 implementation" state and the
		// assertion-level failures (if any) are now the legitimate red
		// surface. Directive must sit immediately above the offending line
		// per TS contract (no separating comments).
		const { moderateComment } = (await import(
			// @ts-expect-error — `src/server/admin/moderation/act.ts` is DEBATE.2-owned per plan §B B12 + SPEC.2 §4 line 371; missing module is the expected pre-implementation state.
			"@/server/admin/moderation/act"
		)) as {
			moderateComment: (input: {
				commentId: string;
				action: "approve" | "block" | "remove_pass_verdict";
			}) => Promise<{ ok: true } | { ok: false; code: string }>;
		};

		const result = await moderateComment({
			commentId: "comment-pass-1",
			action: "remove_pass_verdict",
		});

		// Observable effect 1: action succeeded.
		expect(result).toEqual({ ok: true });

		// Observable effect 2: a transaction was opened (per F-ADMIN-4
		// audit-discipline requirement — moderation actions are atomic
		// {audit row write + comment state flip}).
		expect(mockDb.transaction).toHaveBeenCalledTimes(1);

		// Observable effect 3: at least one INSERT against `mod_actions`
		// occurred. The exact column shape (verdict-enum vs action column vs
		// metadata field) is DEBATE.2-owned per LD-5 — assert presence of
		// `mod_actions` in the issued SQL, not the column layout.
		const allTxSql = mockDb._tx.execute.mock.calls
			.map((c) => JSON.stringify(c[0]))
			.join(" ");
		expect(allTxSql).toMatch(/INSERT.*mod_actions/i);

		// Observable effect 4: comment was hidden (UPDATE on comments table
		// flipping it out of the public surface; exact column name —
		// `hidden_at`, `removed_at`, etc. — is also DEBATE.2-owned, but the
		// table touch IS contract per sub-edit 15a "comment hidden from
		// public view").
		expect(allTxSql).toMatch(/UPDATE.*comments/i);

		// Observable effect 5 (CRITICAL — sub-edit 15a explicit non-effect):
		// `users.banned_at` was NOT updated. Remove pass-verdict does NOT ban
		// the user; admin escalates via separate Block user action if
		// user-level enforcement needed.
		expect(allTxSql).not.toMatch(/UPDATE.*users.*banned_at/i);
		expect(allTxSql).not.toMatch(/banned_at\s*=/i);
	});
});
