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

// AUTH-OTP-DELIVERY fix (a) — register()'s SECOND boot-time env gate, EXTENDED
// from the AUDIT-FIX-B7b A35 prod+unset gate to the ratified S2 rule (§0·R
// OQ-1 = S2): boot-throw when ZUGZWANG_ENV ∈ {prod, staging} AND
// RESEND_FROM_EMAIL is unset/empty OR the Resend SANDBOX sender
// (`onboarding@resend.dev` / a *.resend.dev subdomain, in bare or "Name <addr>"
// form). The sandbox sender delivers only to the operator inbox, so in
// prod/staging it silently breaks every participant OTP sign-in. `preview`
// stays EXEMPT (local builds + CI). Same posture as the A18-DSN gate above: the
// boot-throw 500s /api/health, so the deploy-pipeline health gates catch the
// misconfig at rehearsal (now including staging), never first at prod.
//
// CRITICAL setup: every prod/staging case MUST set NEXT_PUBLIC_SENTRY_DSN, else
// the EXISTING A18-DSN gate throws FIRST and a bare `rejects` would go green for
// the wrong reason — the throws are message-matched on /RESEND_FROM_EMAIL/ to
// isolate this gate. Local RESEND_FROM_EMAIL save/restore leaves the block above
// undisturbed.
//
// RED reasons (ASSERTION-RED): pre-impl register() only rejects prod+unset, so
//   · prod + SANDBOX (bare + angle) RESOLVE (from is set) → the `rejects` fail;
//   · staging + SANDBOX and staging + UNSET RESOLVE (staging not in scope) →
//     the staging `rejects` fail (staging-without-from FLIPPED to throw).
// GREEN control cases (green pre- and post-impl): prod + unset/empty throws;
// prod + REAL (bare + angle — the angle-form real address is the misfire canary)
// resolves; staging + REAL resolves; preview + unset resolves.
describe("AUTH-OTP-DELIVERY fix (a) — RESEND_FROM_EMAIL sandbox-rejection gate (S2)", () => {
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

	it("instrumentation-resend-from::prod-with-sandbox-from-boot-throws", async () => {
		// RED: prod + the bare sandbox sender. DSN set so A18-DSN doesn't throw
		// first; message-matched to isolate this gate.
		process.env.ZUGZWANG_ENV = "prod";
		process.env.NEXT_PUBLIC_SENTRY_DSN = DSN;
		process.env.RESEND_FROM_EMAIL = "onboarding@resend.dev";
		await expect(register()).rejects.toThrow(/RESEND_FROM_EMAIL/);
	});

	it("instrumentation-resend-from::prod-with-sandbox-angle-from-boot-throws", async () => {
		// RED: prod + the sandbox sender in "Name <addr>" form.
		process.env.ZUGZWANG_ENV = "prod";
		process.env.NEXT_PUBLIC_SENTRY_DSN = DSN;
		process.env.RESEND_FROM_EMAIL = "Zugzwang <onboarding@resend.dev>";
		await expect(register()).rejects.toThrow(/RESEND_FROM_EMAIL/);
	});

	it("instrumentation-resend-from::prod-with-real-bare-from-resolves", async () => {
		// GREEN control: prod + the real verified sender (bare).
		process.env.ZUGZWANG_ENV = "prod";
		process.env.NEXT_PUBLIC_SENTRY_DSN = DSN;
		process.env.RESEND_FROM_EMAIL = "no-reply@mail.zugzwangworld.com";
		await expect(register()).resolves.toBeUndefined();
	});

	it("instrumentation-resend-from::prod-with-real-angle-from-resolves", async () => {
		// GREEN control (angle-misfire canary): the real sender in "Name <addr>"
		// form must NOT be read as sandbox.
		process.env.ZUGZWANG_ENV = "prod";
		process.env.NEXT_PUBLIC_SENTRY_DSN = DSN;
		process.env.RESEND_FROM_EMAIL =
			"Zugzwang <no-reply@mail.zugzwangworld.com>";
		await expect(register()).resolves.toBeUndefined();
	});

	it("instrumentation-resend-from::prod-with-from-resolves", async () => {
		process.env.ZUGZWANG_ENV = "prod";
		process.env.NEXT_PUBLIC_SENTRY_DSN = DSN;
		process.env.RESEND_FROM_EMAIL = "no-reply@zugzwang.world";
		await expect(register()).resolves.toBeUndefined();
	});

	it("instrumentation-resend-from::staging-with-sandbox-from-boot-throws", async () => {
		// RED: under S2 staging is IN scope — the sandbox sender boot-throws.
		process.env.ZUGZWANG_ENV = "staging";
		process.env.NEXT_PUBLIC_SENTRY_DSN = DSN;
		process.env.RESEND_FROM_EMAIL = "onboarding@resend.dev";
		await expect(register()).rejects.toThrow(/RESEND_FROM_EMAIL/);
	});

	it("instrumentation-resend-from::staging-with-real-from-resolves", async () => {
		// GREEN control: staging + the real verified sender resolves.
		process.env.ZUGZWANG_ENV = "staging";
		process.env.NEXT_PUBLIC_SENTRY_DSN = DSN;
		process.env.RESEND_FROM_EMAIL = "no-reply@mail.zugzwangworld.com";
		await expect(register()).resolves.toBeUndefined();
	});

	it("instrumentation-resend-from::staging-without-from-throws", async () => {
		// FLIPPED (was staging-without-from-resolves): under S2 staging is IN scope,
		// so an unset sender now boot-throws (the acceptance-env fail-fast
		// rehearsal — the operator can trip the boot guard on staging, not prod).
		process.env.ZUGZWANG_ENV = "staging";
		process.env.NEXT_PUBLIC_SENTRY_DSN = DSN;
		delete process.env.RESEND_FROM_EMAIL;
		await expect(register()).rejects.toThrow(/RESEND_FROM_EMAIL/);
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
