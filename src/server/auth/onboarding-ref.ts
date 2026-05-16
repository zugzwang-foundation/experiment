import { createHmac, timingSafeEqual } from "node:crypto";

// Signed pre-session cookie for the F-AUTH-4 onboarding gate per SCAFFOLD.3
// plan §3 + §4 step 2. When `databaseHooks.session.create.before` throws
// ONBOARDING_REQUIRED, the catch-all route emits this cookie carrying
// `{ userId, exp }` so `/onboarding` (page.tsx) + `acceptTosAction` can
// identify the pre-session user without a participant session.
//
// HMAC-SHA256 over the base64url-encoded JSON payload, signed with
// `BETTER_AUTH_SECRET`. JWT-style `<payload>.<signature>` shape; both halves
// are base64url so the entire token sits inside the cookie value alphabet
// without escaping. Reads `process.env.BETTER_AUTH_SECRET` at call time so
// secret rotation invalidates outstanding tokens.

const SEPARATOR = ".";
const TTL_SECONDS = 600; // 10 min — see plan §3 Q3, cookie Max-Age aligns

export type OnboardingRefPayload = {
	userId: string;
	exp: number; // seconds since epoch
};

export const ONBOARDING_REF_TTL_SECONDS = TTL_SECONDS;

export function signOnboardingRef(payload: OnboardingRefPayload): string {
	const secret = process.env.BETTER_AUTH_SECRET;
	if (!secret) {
		throw new Error("BETTER_AUTH_SECRET not set; cannot sign onboarding ref");
	}
	const payloadJson = JSON.stringify(payload);
	const payloadEncoded = Buffer.from(payloadJson, "utf-8").toString(
		"base64url",
	);
	const signature = createHmac("sha256", secret)
		.update(payloadEncoded)
		.digest("base64url");
	return `${payloadEncoded}${SEPARATOR}${signature}`;
}

export function verifyOnboardingRef(token: string): { userId: string } | null {
	try {
		if (!token || typeof token !== "string") return null;
		const parts = token.split(SEPARATOR);
		if (parts.length !== 2) return null;
		const [payloadEncoded, signature] = parts;
		if (!payloadEncoded || !signature) return null;

		const secret = process.env.BETTER_AUTH_SECRET;
		if (!secret) return null;

		const expected = createHmac("sha256", secret)
			.update(payloadEncoded)
			.digest();
		const provided = Buffer.from(signature, "base64url");
		if (provided.length !== expected.length) return null;
		if (!timingSafeEqual(provided, expected)) return null;

		const payloadJson = Buffer.from(payloadEncoded, "base64url").toString(
			"utf-8",
		);
		const parsed: unknown = JSON.parse(payloadJson);
		if (!parsed || typeof parsed !== "object") return null;
		const payload = parsed as Partial<OnboardingRefPayload>;
		if (typeof payload.userId !== "string" || !payload.userId) return null;
		if (typeof payload.exp !== "number") return null;
		if (payload.exp < Math.floor(Date.now() / 1000)) return null;

		return { userId: payload.userId };
	} catch {
		return null;
	}
}
