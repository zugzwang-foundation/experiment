import { describe, expect, it } from "vitest";

// AUTH-OTP-DELIVERY fix (a) — the shared `isSandboxFrom` sandbox-domain
// predicate (plan §3.1, ratified §0·R OQ-4). One source of truth for the
// "is this the Resend sandbox sender?" rule, imported by BOTH lines of
// defense (the instrumentation.ts boot gate + the email-otp.ts send backstop).
// Pure string parsing — no side-effect imports, no `server-only`, no `resend` —
// so the boot path (node + edge runtimes) can import it safely.
//
// RATIFIED RULE (§0·R OQ-4): sandbox iff the from-address domain, LOWERCASED,
// === "resend.dev" OR endsWith(".resend.dev"). Parses a bare `a@b.com` AND a
// `"Name <a@b.com>"` form; case-insensitive; malformed / no-`@` → FALSE (never
// throws — it fails at send, not boot); no misfire on lookalikes.
//
// RED reason (MODULE-MISSING): `@/server/auth/resend-from` does NOT exist
// pre-impl. The import fails to resolve → the whole file fails collection →
// every case below is RED until the implementer lands the helper. This is the
// intended tests-first target — the implementer must NOT create the module
// here; @test-writer only writes the target.

import { isSandboxFrom } from "@/server/auth/resend-from";

describe("AUTH-OTP-DELIVERY fix (a) — isSandboxFrom truth table (OQ-4)", () => {
	it.each([
		["onboarding@resend.dev"], // bare, exact sandbox domain
		["Zugzwang <onboarding@resend.dev>"], // angle form
		["ONBOARDING@Resend.DEV"], // mixed case → lowercased match
		["noreply@mail.resend.dev"], // *.resend.dev subdomain
		["Zugzwang <noreply@mail.resend.dev>"], // subdomain, angle form
	])("isSandboxFrom(%j) === true (sandbox)", (value) => {
		expect(isSandboxFrom(value)).toBe(true);
	});

	it.each([
		["no-reply@zugzwang.world"], // real bare sender
		["Zugzwang <no-reply@mail.zugzwangworld.com>"], // real, angle — must NOT misfire
		["a@notresend.dev"], // lookalike prefix — NOT a match
		["a@resend.dev.evil.com"], // lookalike suffix — resend.dev is not the domain
		[""], // empty → false
		["just-a-name-no-at"], // no `@` → false (not a throw)
		["Name <no-at-here>"], // angle content lacks `@` → false
	])("isSandboxFrom(%j) === false (non-sandbox / malformed)", (value) => {
		expect(isSandboxFrom(value)).toBe(false);
	});
});
