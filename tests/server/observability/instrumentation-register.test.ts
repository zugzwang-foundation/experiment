import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// AUDIT-FIX-B1 A18-DSN (ruling #9 — PRIMARY variant per execute-gate F2) tests-
// first — instrumentation.register() boot-throws when ZUGZWANG_ENV is `prod` OR
// `staging` AND NEXT_PUBLIC_SENTRY_DSN is unset/empty (a missing DSN silently
// no-ops all three Sentry.init sites, so catch it at deploy boot). `preview` + no
// DSN resolves (local `ZUGZWANG_ENV=preview just verify` unaffected); prod/staging
// + DSN set resolves.
//
// RED reason (extension of the EXISTING root instrumentation.ts): ASSERTION-RED —
// pre-impl register() only validates ZUGZWANG_ENV, so prod/staging + no-DSN
// RESOLVE (no throw) and the two `rejects` assertions fail. `preview`+no-DSN and
// *+DSN-set are GREEN control cases (green pre- and post-impl).
//
// NEXT_RUNTIME is left UNSET so the dynamic sentry-config imports never fire.
// `delete process.env.X` (never `= undefined`, which coerces to the string
// "undefined") per the close-due-markets S3 correction. `register` is imported by
// RELATIVE path (root file, not under @/).

vi.mock("@sentry/nextjs", () => ({
	captureRequestError: vi.fn(),
	captureException: vi.fn(),
	captureMessage: vi.fn(),
}));

import { register } from "../../../instrumentation";

const SAVED = {
	env: process.env.ZUGZWANG_ENV,
	dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
	runtime: process.env.NEXT_RUNTIME,
};
const DSN = "https://examplePublicKey@o0.ingest.sentry.io/0";

function restore(key: keyof typeof SAVED, envName: string): void {
	const saved = SAVED[key];
	if (saved === undefined) delete process.env[envName];
	else process.env[envName] = saved;
}

describe("AUDIT-FIX-B1 A18-DSN — instrumentation.register DSN presence gate", () => {
	beforeEach(() => {
		// Never let the runtime-specific sentry-config dynamic imports fire.
		delete process.env.NEXT_RUNTIME;
	});
	afterEach(() => {
		restore("env", "ZUGZWANG_ENV");
		restore("dsn", "NEXT_PUBLIC_SENTRY_DSN");
		restore("runtime", "NEXT_RUNTIME");
		vi.clearAllMocks();
	});

	it("instrumentation-dsn::prod-without-dsn-boot-throws", async () => {
		process.env.ZUGZWANG_ENV = "prod";
		delete process.env.NEXT_PUBLIC_SENTRY_DSN;
		await expect(register()).rejects.toThrow();
	});

	it("instrumentation-dsn::staging-without-dsn-boot-throws", async () => {
		process.env.ZUGZWANG_ENV = "staging";
		delete process.env.NEXT_PUBLIC_SENTRY_DSN;
		await expect(register()).rejects.toThrow();
	});

	it("instrumentation-dsn::preview-without-dsn-resolves", async () => {
		process.env.ZUGZWANG_ENV = "preview";
		delete process.env.NEXT_PUBLIC_SENTRY_DSN;
		await expect(register()).resolves.toBeUndefined();
	});

	it("instrumentation-dsn::prod-with-dsn-resolves", async () => {
		process.env.ZUGZWANG_ENV = "prod";
		process.env.NEXT_PUBLIC_SENTRY_DSN = DSN;
		await expect(register()).resolves.toBeUndefined();
	});

	it("instrumentation-dsn::staging-with-dsn-resolves", async () => {
		process.env.ZUGZWANG_ENV = "staging";
		process.env.NEXT_PUBLIC_SENTRY_DSN = DSN;
		await expect(register()).resolves.toBeUndefined();
	});

	// Adversarial-verify fold-in (B1 workflow, a18Boot LOW): the header claims
	// "unset/empty" — pin the empty-string arm too (falsy check catches it).
	it("instrumentation-dsn::prod-with-empty-string-dsn-boot-throws", async () => {
		process.env.ZUGZWANG_ENV = "prod";
		process.env.NEXT_PUBLIC_SENTRY_DSN = "";
		await expect(register()).rejects.toThrow();
	});
});

// AUDIT-FIX-B7b A35 (RED-first) — register() gains a SECOND boot-time env gate:
// throw when ZUGZWANG_ENV === "prod" AND RESEND_FROM_EMAIL is unset/empty (the
// sandbox `onboarding@resend.dev` fallback only delivers to the operator inbox,
// so every real participant OTP sign-in would silently fail in prod). Scope is
// prod-ONLY — staging's sandbox sender is the documented deliberate state until
// the parked SCAFFOLD.12 §10.b sender flip; preview/local/CI carry no delivery
// expectations. Mirrors the existing A18-DSN gate's posture (boot-throw → the
// pre-promote /api/health gate catches absence before any traffic).
//
// CRITICAL setup: the prod cases MUST set NEXT_PUBLIC_SENTRY_DSN, else the
// EXISTING DSN gate throws FIRST and a bare `rejects` would go green for the
// wrong reason — the throws are message-matched on /RESEND_FROM_EMAIL/ to isolate
// this gate. Local RESEND_FROM_EMAIL save/restore (env.ts defaults it to the
// sandbox literal) so the existing block above is undisturbed.
//
// RED reason (ASSERTION-RED): pre-impl register() does not check
// RESEND_FROM_EMAIL, so prod + unset/empty RESOLVE (no throw) → the two `rejects`
// assertions fail. prod+set, staging+unset, preview+unset are GREEN control cases
// (green pre- and post-impl).
describe("AUDIT-FIX-B7b A35 — RESEND_FROM_EMAIL prod presence gate", () => {
	const SAVED_FROM = process.env.RESEND_FROM_EMAIL;

	function restoreFrom(): void {
		if (SAVED_FROM === undefined) delete process.env.RESEND_FROM_EMAIL;
		else process.env.RESEND_FROM_EMAIL = SAVED_FROM;
	}

	beforeEach(() => {
		delete process.env.NEXT_RUNTIME;
	});
	afterEach(() => {
		restore("env", "ZUGZWANG_ENV");
		restore("dsn", "NEXT_PUBLIC_SENTRY_DSN");
		restore("runtime", "NEXT_RUNTIME");
		restoreFrom();
		vi.clearAllMocks();
	});

	it("instrumentation-resend-from::prod-without-from-boot-throws", async () => {
		process.env.ZUGZWANG_ENV = "prod";
		// DSN set so the A18-DSN gate does not throw first.
		process.env.NEXT_PUBLIC_SENTRY_DSN = DSN;
		delete process.env.RESEND_FROM_EMAIL;
		await expect(register()).rejects.toThrow(/RESEND_FROM_EMAIL/);
	});

	it("instrumentation-resend-from::prod-with-from-resolves", async () => {
		process.env.ZUGZWANG_ENV = "prod";
		process.env.NEXT_PUBLIC_SENTRY_DSN = DSN;
		process.env.RESEND_FROM_EMAIL = "no-reply@zugzwang.world";
		await expect(register()).resolves.toBeUndefined();
	});

	it("instrumentation-resend-from::staging-without-from-resolves", async () => {
		// Staging is deliberately EXEMPT (parked SCAFFOLD.12 §10.b). DSN set so the
		// A18-DSN gate (prod+staging scope) does not throw.
		process.env.ZUGZWANG_ENV = "staging";
		process.env.NEXT_PUBLIC_SENTRY_DSN = DSN;
		delete process.env.RESEND_FROM_EMAIL;
		await expect(register()).resolves.toBeUndefined();
	});

	it("instrumentation-resend-from::preview-without-from-resolves", async () => {
		process.env.ZUGZWANG_ENV = "preview";
		delete process.env.NEXT_PUBLIC_SENTRY_DSN;
		delete process.env.RESEND_FROM_EMAIL;
		await expect(register()).resolves.toBeUndefined();
	});

	it("instrumentation-resend-from::prod-with-empty-string-from-boot-throws", async () => {
		process.env.ZUGZWANG_ENV = "prod";
		process.env.NEXT_PUBLIC_SENTRY_DSN = DSN;
		process.env.RESEND_FROM_EMAIL = "";
		await expect(register()).rejects.toThrow(/RESEND_FROM_EMAIL/);
	});
});
