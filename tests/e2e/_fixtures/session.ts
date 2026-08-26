// Forges a valid Better Auth session without Google, OTP, or Turnstile —
// zero lines of src/server/auth/ change. Reads an existing secret, inserts a
// row, computes a cookie value the real verification path accepts.
//
// The corrected construction (VERIFY-3 was the load-bearing unknown in the
// original v1.0 package, and its draft was wrong — base64url instead of
// base64, and no outer encodeURIComponent). Verified against the actual
// installed better-call@1.3.5:
//   - node_modules/.../better-call/dist/crypto.mjs — signing side
//   - node_modules/.../better-call/dist/context.mjs:39-49 — verify side
//
// Algorithm: HMAC-SHA256, secret used RAW (no derivation/hashing).
// Encoding: standard base64 (btoa), NOT base64url — the verify side
// hard-rejects any signature that isn't exactly 44 chars ending in "=".
// Format: `${token}.${signature}`, then the WHOLE value run through
// encodeURIComponent() once before being placed in Set-Cookie. Verification
// splits at the LAST "." (context.mjs:44), not the first.
//
// This file forges credentials — it must never be reachable from src/. The
// import-guard test (tests/unit/e2e/no-src-imports-session-fixture.test.ts)
// enforces that mechanically; do not rely on convention alone.

import { createHmac, randomBytes } from "node:crypto";
import { db } from "@/db";
import { sessions } from "@/db/schema";

const SESSION_COOKIE_NAME = "zugzwang_session";

async function makeSignature(value: string, secret: string): Promise<string> {
	const sig = createHmac("sha256", secret).update(value).digest();
	return sig.toString("base64");
}

async function signCookieValue(
	tokenValue: string,
	secret: string,
): Promise<string> {
	const signature = await makeSignature(tokenValue, secret);
	const combined = `${tokenValue}.${signature}`;
	return encodeURIComponent(combined);
}

/**
 * The real cookie name depends on BETTER_AUTH_URL's scheme — better-auth
 * prefixes "__Secure-" when the base URL is https:// (cookie-utils.mjs).
 * Local E2E runs use http://localhost:3000, so this resolves to the plain
 * name, but it's derived rather than hardcoded so a future https local
 * setup doesn't silently forge a cookie the browser never sends.
 */
export function sessionCookieName(
	betterAuthUrl: string = process.env.BETTER_AUTH_URL ?? "",
): string {
	return betterAuthUrl.startsWith("https://")
		? `__Secure-${SESSION_COOKIE_NAME}`
		: SESSION_COOKIE_NAME;
}

export interface ForgedSession {
	readonly cookieName: string;
	readonly cookieValue: string;
	readonly rawToken: string;
}

export async function forgeSession(userId: string): Promise<ForgedSession> {
	const secret = process.env.BETTER_AUTH_SECRET;
	if (!secret) {
		throw new Error("BETTER_AUTH_SECRET unset — cannot forge a session.");
	}

	// sessions.token stores the raw token unchanged (src/db/schema/auth.ts) —
	// nothing transforms it before storage or after read.
	const rawToken = randomBytes(24).toString("base64url");
	const now = new Date();

	await db.insert(sessions).values({
		token: rawToken,
		userId,
		expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
		createdAt: now,
		updatedAt: now,
		ipAddress: "127.0.0.1",
		userAgent: "playwright-e2e",
	});

	const cookieValue = await signCookieValue(rawToken, secret);
	return { cookieName: sessionCookieName(), cookieValue, rawToken };
}

export function storageStateFor(forged: ForgedSession) {
	return {
		cookies: [
			{
				name: forged.cookieName,
				value: forged.cookieValue,
				domain: "localhost",
				path: "/",
				expires: Math.floor(Date.now() / 1000) + 86_400,
				httpOnly: true,
				secure: false, // localhost E2E runs are http
				sameSite: "Lax" as const,
			},
			// ADR-0037 — the onboarding deck shows once, non-dismissibly, to every
			// authenticated participant, gated by this cookie (not a user column).
			// A forged session belongs to a fixture user who has never seen it, so
			// without this every test would hit a blocking modal on first load. A
			// real returning participant has already seen it — this fixture just
			// represents that same state, not bypassing anything a real user
			// wouldn't also have.
			{
				name: "zugzwang_intro_seen",
				value: "v1",
				domain: "localhost",
				path: "/",
				expires: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 400,
				httpOnly: false,
				secure: false,
				sameSite: "Lax" as const,
			},
		],
		origins: [],
	};
}
