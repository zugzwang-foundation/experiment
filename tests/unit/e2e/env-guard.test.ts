import { describe, expect, it } from "vitest";
import { assertIsolatedEnvironment } from "../../e2e/_fixtures/env-guard";

// A guard that has never been proven to refuse anything is not known to
// work (V-2 — a negative assertion needs a positive control, and its
// mirror: a refusal predicate needs a case that actually fires it). Every
// case below pairs a bad env that must throw with the same env minus the
// one bad field, which must not.

const GOOD_ENV = {
	DATABASE_URL: "postgresql://postgres:postgres@localhost:54322/postgres",
	UPSTASH_REDIS_REST_URL: "http://127.0.0.1:1",
	UPSTASH_REDIS_REST_TOKEN: "e2e-unreachable",
	BETTER_AUTH_URL: "http://localhost:3000",
} as const;

describe("assertIsolatedEnvironment — accepts a genuinely isolated env", () => {
	it("does not throw on the good env", () => {
		expect(() => assertIsolatedEnvironment(GOOD_ENV)).not.toThrow();
	});
});

describe("assertIsolatedEnvironment — refuses a shared Postgres", () => {
	it("throws when DATABASE_URL is unset", () => {
		const { DATABASE_URL: _drop, ...rest } = GOOD_ENV;
		expect(() => assertIsolatedEnvironment(rest)).toThrow(/DATABASE_URL/);
	});

	it("throws when DATABASE_URL points at the staging/prod Supabase pooler", () => {
		expect(() =>
			assertIsolatedEnvironment({
				...GOOD_ENV,
				DATABASE_URL:
					"postgresql://postgres.abc123:pw@aws-1-ap-south-1.pooler.supabase.com:5432/postgres",
			}),
		).toThrow(/localhost/);
	});
});

describe("assertIsolatedEnvironment — refuses the shared Redis instance", () => {
	it("throws when UPSTASH_REDIS_REST_URL is the real shared instance", () => {
		expect(() =>
			assertIsolatedEnvironment({
				...GOOD_ENV,
				UPSTASH_REDIS_REST_URL: "https://equal-lemming-124923.upstash.io",
			}),
		).toThrow(/SHARED instance/);
	});

	it("throws when UPSTASH_REDIS_REST_URL is any supabase.co host", () => {
		expect(() =>
			assertIsolatedEnvironment({
				...GOOD_ENV,
				UPSTASH_REDIS_REST_URL: "https://something.supabase.co",
			}),
		).toThrow(/SHARED instance/);
	});
});

describe("assertIsolatedEnvironment — refuses any R2 credential", () => {
	// One case per var — this is exactly the check that was wrong in the
	// v1.0 package (9 of 12 real vars listed, all three *_MARKET_MEDIA
	// vars missing). Every one of the 12 gets its own case so a future
	// drop can't silently narrow the list again.
	const r2Vars = [
		"R2_BUCKET_UPLOADS",
		"R2_ACCESS_KEY_ID_UPLOADS",
		"R2_SECRET_ACCESS_KEY_UPLOADS",
		"R2_ENDPOINT_UPLOADS",
		"R2_BUCKET_PFP",
		"R2_ACCESS_KEY_ID_PFP",
		"R2_SECRET_ACCESS_KEY_PFP",
		"R2_ENDPOINT_PFP",
		"R2_BUCKET_MARKET_MEDIA",
		"R2_ACCESS_KEY_ID_MARKET_MEDIA",
		"R2_SECRET_ACCESS_KEY_MARKET_MEDIA",
		"R2_ENDPOINT_MARKET_MEDIA",
	] as const;

	for (const key of r2Vars) {
		it(`throws when ${key} is present`, () => {
			expect(() =>
				assertIsolatedEnvironment({ ...GOOD_ENV, [key]: "some-value" }),
			).toThrow(/R2 credentials present/);
		});
	}
});

describe("assertIsolatedEnvironment — refuses a deployed BETTER_AUTH_URL", () => {
	it("throws when BETTER_AUTH_URL is not localhost", () => {
		expect(() =>
			assertIsolatedEnvironment({
				...GOOD_ENV,
				BETTER_AUTH_URL: "https://staging.zugzwangworld.com",
			}),
		).toThrow(/localhost/);
	});
});
