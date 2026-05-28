import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { getRedisKey } from "@/server/upstash/keys";

// Per SCAFFOLD.8 plan §4.5 Test 1 — pure-function tests for the
// environment-prefixing helper that gates Redis key construction across
// rate-limit, idempotency, moderation, and cron-lock surfaces.
//
// `getRedisKey()` reads only `process.env.ZUGZWANG_ENV`; no transitive
// IO, no Redis client touched. We manipulate the env directly in
// beforeEach/afterEach to restore the surrounding test process state
// (other test files rely on the default from `tests/_setup/env.ts`).
//
// LD-10 contract verified here:
//   - leftmost segment of every key is the environment name (covers
//     prod, staging, preview)
//   - missing or unknown env throws synchronously, by name, with the
//     valid-set in the message (the second line of defense behind the
//     instrumentation.ts boot-time check)

describe("getRedisKey", () => {
	let originalEnv: string | undefined;

	beforeEach(() => {
		originalEnv = process.env.ZUGZWANG_ENV;
	});

	afterEach(() => {
		if (originalEnv === undefined) {
			delete process.env.ZUGZWANG_ENV;
		} else {
			process.env.ZUGZWANG_ENV = originalEnv;
		}
	});

	it("prefixes with prod", () => {
		process.env.ZUGZWANG_ENV = "prod";
		expect(getRedisKey("ratelimit", "otp-email")).toBe(
			"prod:ratelimit:otp-email",
		);
	});

	it("prefixes with staging", () => {
		process.env.ZUGZWANG_ENV = "staging";
		expect(getRedisKey("ratelimit", "otp-email")).toBe(
			"staging:ratelimit:otp-email",
		);
	});

	it("prefixes with preview", () => {
		process.env.ZUGZWANG_ENV = "preview";
		expect(getRedisKey("ratelimit", "otp-email")).toBe(
			"preview:ratelimit:otp-email",
		);
	});

	it("throws on missing env", () => {
		delete process.env.ZUGZWANG_ENV;
		expect(() => getRedisKey("foo")).toThrow(/invalid ZUGZWANG_ENV/);
	});

	it("throws on invalid env", () => {
		process.env.ZUGZWANG_ENV = "dev";
		expect(() => getRedisKey("foo")).toThrow(/invalid ZUGZWANG_ENV/);
	});
});
