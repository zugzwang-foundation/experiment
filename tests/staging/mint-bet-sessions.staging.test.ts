import { createHmac } from "node:crypto";
import { writeFileSync } from "node:fs";
import { like } from "drizzle-orm";
import { afterAll, beforeAll, describe, it, vi } from "vitest";

/**
 * Replicates `better-call`'s `signCookieValue` exactly (dist/crypto.mjs):
 * HMAC-SHA256 over the raw value with the app secret, standard base64
 * (padded) of the raw signature bytes, `${value}.${signature}`,
 * `encodeURIComponent`'d. `better-call` is a transitive dependency (via
 * better-auth), not a direct one, so it isn't cleanly importable here for a
 * single operational script — this reproduces its output byte-for-byte
 * using Node's built-in crypto instead of reaching into a pinned pnpm path.
 */
function signCookieValue(value: string, secret: string): string {
	const signature = createHmac("sha256", secret)
		.update(value, "utf8")
		.digest("base64");
	return encodeURIComponent(`${value}.${signature}`);
}

// ═══════════════════════════════════════════════════════════════════════════
// SESSION MINTING for the concurrency-test-* participants — operator ask
// (2026-09-08 #3): load-test the REAL HTTP /api/bets/place endpoint, with
// real auth cookies, not the in-process function call used earlier. That
// needs real, valid session cookies for real users.
//
// Mechanism: `ctx.internalAdapter.createSession(userId, false)` — Better
// Auth's own internal adapter, the SAME class of call `createParticipant`
// already uses for `createOAuthUser` (session half instead of user half) —
// issues a REAL `sessions` row. The raw token is then signed into a cookie
// value the same way `better-call` (the library Better Auth's own
// `setSessionCookie` calls internally) signs it — `signCookieValue` below
// reproduces that exact algorithm with Node's built-in crypto, since
// `better-call` is a transitive dependency not cleanly importable here — so
// the cookie is byte-for-byte what the app itself would emit, not a
// hand-approximated value. No OTP, no email round-trip — an earlier version
// of this script drove the real email-OTP sign-in instead, which works but
// sends a real email per participant via Resend; this is the same real
// session-issuance without that cost.
//
// Writes nothing business-relevant — only the real `sessions` row. Output:
// a JSON file of {userId, email, cookie} for the k6 script to read.
// ═══════════════════════════════════════════════════════════════════════════

const VOLUME_INTENT_ENV = "ZUGZWANG_STAGING_VOLUME_WRITE_ACK";
const VOLUME_INTENT_VALUE = "generate-staging-volume-fixture";

const EMAIL_PREFIX = "concurrency-test-";
const EMAIL_DOMAIN = "example.com";
const SESSION_POOL_SIZE = 100;
const OUT_PATH = process.env.SESSION_POOL_OUT ?? "/tmp/bet-session-pool.json";

vi.hoisted(() => {
	process.env.BETTER_AUTH_URL = "https://staging.zugzwangworld.com";
});

vi.mock("@sentry/nextjs", () => ({
	captureMessage: vi.fn(),
	captureException: vi.fn(),
	addBreadcrumb: vi.fn(),
}));
vi.mock("next/headers", () => ({
	cookies: () => ({ get: vi.fn(), set: vi.fn(), delete: vi.fn() }),
	headers: () => ({ get: vi.fn() }),
}));
vi.mock("next/navigation", () => ({ redirect: vi.fn(), notFound: vi.fn() }));
vi.mock("next/cache", () => ({
	revalidatePath: vi.fn(),
	revalidateTag: vi.fn(),
	updateTag: vi.fn(),
}));
vi.mock("@/db", async () => {
	const { guardedDb } = await import("./_lib/client");
	return { db: guardedDb };
});
vi.mock("@/db/index", async () => {
	const { guardedDb } = await import("./_lib/client");
	return { db: guardedDb };
});

import { users } from "@/db/schema";
import { auth } from "@/server/auth/index";

import {
	assertRunnerLiveConnection,
	closeRunnerConnection,
	describeRunnerTarget,
	readOnly,
} from "./_lib/client";
import { resolveRunnerTarget } from "./_lib/target";

const runnerTarget = resolveRunnerTarget(process.env, {
	requireWriteIntent: true,
});
if (!runnerTarget.ok) {
	throw new Error(
		`REFUSED — target guard did not pass.\n  ${runnerTarget.reason}`,
	);
}

const SESSION_COOKIE_NAME = "__Secure-zugzwang_session";

beforeAll(async () => {
	await assertRunnerLiveConnection();
	if (process.env[VOLUME_INTENT_ENV] !== VOLUME_INTENT_VALUE) {
		throw new Error(
			`REFUSED — ${VOLUME_INTENT_ENV} is not set to the acknowledgement value.`,
		);
	}
	console.log(`[mint-bet-sessions] target ${describeRunnerTarget()}`);
});
afterAll(async () => {
	await closeRunnerConnection();
});

describe("mint real session cookies for the concurrency-test-* participants", () => {
	it("mints a real session per participant and writes out the resulting cookies", async () => {
		const participants = await readOnly
			.select({ id: users.id, email: users.email })
			.from(users)
			.where(like(users.email, `${EMAIL_PREFIX}%@${EMAIL_DOMAIN}`))
			.limit(SESSION_POOL_SIZE);
		if (participants.length === 0) {
			throw new Error(
				"no concurrency-test-* participants found — run concurrency-setup.staging.test.ts first",
			);
		}
		console.log(
			`[mint-bet-sessions] minting sessions for ${participants.length} participants`,
		);

		const ctx = (await auth.$context) as unknown as {
			secret: string;
			internalAdapter: {
				createSession: (
					userId: string,
					dontRememberMe?: boolean,
				) => Promise<{ token: string }>;
			};
		};
		if (typeof ctx.secret !== "string" || ctx.secret.length === 0) {
			throw new Error(
				"auth.$context did not expose a usable .secret \u2014 cannot sign session cookies",
			);
		}

		const pool: Array<{ userId: string; email: string; cookie: string }> = [];
		for (const p of participants) {
			const created = await ctx.internalAdapter.createSession(p.id, false);
			const signedValue = signCookieValue(created.token, ctx.secret);
			const cookieValue = `${SESSION_COOKIE_NAME}=${signedValue}`;
			pool.push({ userId: p.id, email: p.email, cookie: cookieValue });
		}

		console.log(
			`[mint-bet-sessions] minted ${pool.length}/${participants.length} real sessions`,
		);
		writeFileSync(OUT_PATH, JSON.stringify(pool, null, 2));
		console.log(`[mint-bet-sessions] wrote ${OUT_PATH}`);
	}, 600_000);
});
