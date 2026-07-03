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
