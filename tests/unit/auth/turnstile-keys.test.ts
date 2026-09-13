import { afterEach, describe, expect, it } from "vitest";
import {
	isTurnstileTestKey,
	turnstileProdKeyProblem,
} from "@/server/auth/turnstile-keys";
import { register } from "../../../instrumentation";

// AUTH-TURNSTILE-WIRE — production must not boot on Cloudflare's always-pass
// Turnstile TEST keys (siteverify would accept a made-up token) or with a key
// missing (every email sign-in would fail closed). Staging keeps its test keys.

const REAL_SITE = "0x4AAAAAAAexampleSiteKeyValue";
const REAL_SECRET = "0x4AAAAAAAexampleSecretKeyValueForTests";

const SAVED = {
	ZUGZWANG_ENV: process.env.ZUGZWANG_ENV,
	NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
	RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL,
	NEXT_PUBLIC_TURNSTILE_SITE_KEY: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
	TURNSTILE_SECRET_KEY: process.env.TURNSTILE_SECRET_KEY,
	NEXT_RUNTIME: process.env.NEXT_RUNTIME,
};

afterEach(() => {
	for (const [key, value] of Object.entries(SAVED)) {
		if (value === undefined) delete process.env[key];
		else process.env[key] = value;
	}
});

function bootAs(
	env: string,
	site: string | undefined,
	secret: string | undefined,
) {
	process.env.ZUGZWANG_ENV = env;
	process.env.NEXT_PUBLIC_SENTRY_DSN =
		"https://public@example.ingest.sentry.io/1";
	process.env.RESEND_FROM_EMAIL = "no-reply@zugzwang.world";
	// No runtime: register() then skips the Sentry config imports.
	delete process.env.NEXT_RUNTIME;
	if (site === undefined) delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
	else process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = site;
	if (secret === undefined) delete process.env.TURNSTILE_SECRET_KEY;
	else process.env.TURNSTILE_SECRET_KEY = secret;
	return register();
}

describe("isTurnstileTestKey", () => {
	it("turnstile-keys::recognises-every-published-cloudflare-test-key", () => {
		for (const key of [
			"1x00000000000000000000AA",
			"2x00000000000000000000AB",
			"1x00000000000000000000BB",
			"2x00000000000000000000BB",
			"3x00000000000000000000FF",
			"1x0000000000000000000000000000000AA",
			"2x0000000000000000000000000000000AA",
			"3x0000000000000000000000000000000AA",
		]) {
			expect(isTurnstileTestKey(key)).toBe(true);
		}
	});

	it("turnstile-keys::does-not-flag-real-shaped-keys", () => {
		expect(isTurnstileTestKey(REAL_SITE)).toBe(false);
		expect(isTurnstileTestKey(REAL_SECRET)).toBe(false);
		expect(turnstileProdKeyProblem(REAL_SITE, REAL_SECRET)).toBeNull();
	});
});

describe("instrumentation.register — Turnstile keys", () => {
	it("turnstile-keys::prod-refuses-a-test-secret", async () => {
		await expect(
			bootAs("prod", REAL_SITE, "1x0000000000000000000000000000000AA"),
		).rejects.toThrow(/TEST key/);
	});

	it("turnstile-keys::prod-refuses-a-test-site-key", async () => {
		await expect(
			bootAs("prod", "1x00000000000000000000AA", REAL_SECRET),
		).rejects.toThrow(/TEST key/);
	});

	it("turnstile-keys::prod-refuses-a-missing-key", async () => {
		await expect(bootAs("prod", REAL_SITE, undefined)).rejects.toThrow(
			/must both be set/,
		);
		await expect(bootAs("prod", undefined, REAL_SECRET)).rejects.toThrow(
			/must both be set/,
		);
	});

	it("turnstile-keys::prod-boots-with-real-keys", async () => {
		await expect(
			bootAs("prod", REAL_SITE, REAL_SECRET),
		).resolves.toBeUndefined();
	});

	it("turnstile-keys::staging-keeps-its-test-keys", async () => {
		await expect(
			bootAs(
				"staging",
				"1x00000000000000000000AA",
				"1x0000000000000000000000000000000AA",
			),
		).resolves.toBeUndefined();
	});
});
