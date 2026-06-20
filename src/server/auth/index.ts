import { type BetterAuthPlugin, betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
import { emailOTP } from "better-auth/plugins/email-otp";
import { v7 as uuidv7 } from "uuid";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { sendVerificationOTP } from "@/server/auth/email-otp";
import { createSessionGate } from "@/server/auth/session-gate";
import { consumeIdentityPoolTuple } from "@/server/identity-pool/consume";
import {
	checkRateLimit,
	ipIdentifier,
	otpEmailIdentifier,
} from "@/server/middleware/rate-limit";

// Better Auth instance + plugins + databaseHooks + cookie config + UUIDv7
// generateId override per SPEC.2 §8.10 single source of truth. Wires:
//
//   - drizzleAdapter with usePlural:true (Q11) + transaction:true (Q6)
//   - socialProviders.google with email_verified enforcement (SPEC.2 §8.2)
//   - emailOTP plugin with Resend-backed sendVerificationOTP
//   - zugzwang-otp-gate plugin: Turnstile siteverify + rate-limit MATCHED
//     ONLY to /email-otp/send-verification-otp (plan §5 failure-mode #2)
//   - databaseHooks.user.create.before: atomic identity_pool consumption +
//     pseudonym/pfpFilename injection (Q10)
//   - databaseHooks.session.create.before: INV-3 construction-layer
//     protection via createSessionGate(db) (SPEC.2 §8.3 + plan §1)
//   - advanced.database.generateId: () => uuidv7() across all 4 Better Auth
//     tables (SPEC.2 §8.2)

if (!process.env.BETTER_AUTH_SECRET) {
	throw new Error("BETTER_AUTH_SECRET not set");
}
if (!process.env.BETTER_AUTH_URL) {
	throw new Error("BETTER_AUTH_URL not set");
}
if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
	throw new Error("GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET not set");
}

// Indefinite-session sentinel per SPEC.2 §8.2 line 818 ("Indefinite cookie
// lifetime"). Large `expiresIn` (100y) makes Better Auth's
// internalAdapter.createSession write a far-future Date for `expires_at`;
// `disableSessionRefresh: true` is the canonical Better Auth 1.6.11 option
// (verified at init-options.d.mts, surfaced during step-10 check-in) that
// overrides any updateAge sliding-window refresh.
const ONE_HUNDRED_YEARS_SEC = 60 * 60 * 24 * 365 * 100;

// === Custom plugin: Turnstile + rate-limit on email-OTP send ================
//
// Plugin form because: (a) Better Auth's top-level `hooks.before` is a single
// AuthMiddleware (no built-in path matching), and (b) the runtime
// aggregator (`to-auth-endpoints.mjs`) merges plugin hooks (array form
// `{matcher, handler}[]`) into the before-chain. Plain async handler — when
// Better Auth runs the hook, it calls `await handler(ctx)`; createAuth
// Middleware wrapping is not required for our use case.

type HookCtx = {
	path?: string;
	body?: { email?: string } | unknown;
	request?: { headers?: Headers };
	headers?: Headers;
};

const TURNSTILE_SITEVERIFY_URL =
	"https://challenges.cloudflare.com/turnstile/v0/siteverify";

async function verifyTurnstile(token: string, ip: string): Promise<boolean> {
	const secret = process.env.TURNSTILE_SECRET_KEY;
	if (!secret) {
		// Fail-CLOSED: missing secret is a configuration error, refuse send.
		console.error("turnstile_unavailable", "TURNSTILE_SECRET_KEY not set");
		return false;
	}
	try {
		const resp = await fetch(TURNSTILE_SITEVERIFY_URL, {
			method: "POST",
			body: new URLSearchParams({
				secret,
				response: token,
				remoteip: ip,
			}),
		});
		if (!resp.ok) {
			console.error("turnstile_unavailable", `HTTP ${resp.status}`);
			return false;
		}
		const data = (await resp.json()) as { success?: boolean };
		return data.success === true;
	} catch (err) {
		console.error("turnstile_unavailable", err);
		return false;
	}
}

function ipFromCtx(ctx: HookCtx): string {
	const headers = ctx.request?.headers ?? ctx.headers;
	if (!headers) return "unknown";
	const fwd = headers.get("x-forwarded-for");
	if (fwd) return fwd.split(",")[0]?.trim() ?? "unknown";
	return "unknown";
}

const otpGateBeforeHooks = [
	{
		matcher: (ctx: HookCtx) => ctx.path === "/email-otp/send-verification-otp",
		handler: async (ctx: HookCtx): Promise<Record<string, unknown>> => {
			const body = (ctx.body ?? {}) as { email?: string };
			const ip = ipFromCtx(ctx);
			// Q6 (per §15 Amendment 1.3): read Turnstile token from the
			// `x-turnstile-token` header instead of the body. The Better Auth
			// email-OTP send-verification-otp Zod schema is default-`.strip()`
			// (verified at execute-time pre-check §14.5.1) — passing the token
			// in the body would have it silently dropped before the hook
			// observes it. Header transport sidesteps the schema strip.
			const headers = ctx.request?.headers ?? ctx.headers;
			const turnstileToken = headers?.get("x-turnstile-token") ?? "";

			// Turnstile siteverify (fail-CLOSED per SPEC.2 §18.2 + plan §5
			// failure-mode #2). Matched to this path only — Google callback
			// path explicitly excluded so a Cloudflare outage doesn't take
			// both auth paths down.
			if (!turnstileToken) {
				throw new APIError("BAD_REQUEST", { message: "turnstile_required" });
			}
			const ok = await verifyTurnstile(turnstileToken, ip);
			if (!ok) {
				throw new APIError("BAD_REQUEST", { message: "turnstile_failed" });
			}

			// Rate-limit gates (fail-OPEN within checkRateLimit itself per
			// SCAFFOLD.4). Per-email check fires before per-IP burst per
			// SPEC.2 §11 ordering. Either denial blocks the send.
			if (body.email) {
				const r = await checkRateLimit(
					"otpRequestPerEmail",
					otpEmailIdentifier(body.email),
				);
				if (!r.allowed) {
					throw new APIError("TOO_MANY_REQUESTS", {
						message: "otp_rate_limited",
					});
				}
			}
			const ipRate = await checkRateLimit(
				"otpRequestPerIpBurst",
				ipIdentifier(ip),
			);
			if (!ipRate.allowed) {
				throw new APIError("TOO_MANY_REQUESTS", {
					message: "otp_rate_limited",
				});
			}

			// Continue to the real send endpoint. Better Auth 1.6.11's hook
			// aggregator (to-auth-endpoints.mjs: runBeforeHooks L222-236 + main
			// flow L79/L90) treats a before-hook that returns an object WITHOUT
			// a truthy `context` key as a deliberate SHORT-CIRCUIT response — it
			// returns that object as the HTTP body and NEVER invokes the
			// endpoint. A bare `{}` therefore silently 200-empties
			// /email-otp/send-verification-otp: no OTP is generated, stored, or
			// sent (AUTH-OTP-GATE). Returning `{ context: {} }` is the "proceed,
			// merge no context changes" signal — the aggregator merges the empty
			// context and falls through to the real endpoint that
			// generates/stores/dispatches the OTP.
			return { context: {} };
		},
	},
];

// BetterAuthPlugin's hooks.before handler type is the opaque AuthMiddleware
// (return type of createAuthMiddleware). Our plain async handlers satisfy
// the runtime contract (Better Auth calls `await handler(ctx)` per
// to-auth-endpoints.mjs aggregation) but not the structural type. The
// double cast through `unknown` at the plugin boundary preserves the
// runtime wiring; tests invoke handlers with synthetic ctx and would fail
// if we used createAuthMiddleware which inserts optionsMiddleware that
// requires the full request context.
const zugzwangOtpGate = {
	id: "zugzwang-otp-gate",
	hooks: { before: otpGateBeforeHooks },
} as unknown as BetterAuthPlugin;

// SCAFFOLD.8 LD-11(c) — per-environment trustedOrigins, comma-separated
// in BETTER_AUTH_TRUSTED_ORIGINS. prod: `https://zugzwangworld.com`;
// staging: `https://staging.zugzwangworld.com`; preview: unset (falls
// back to baseURL-only matching — preview auth is known-broken per
// docs/parked.md M1/M2 and out of SCAFFOLD.8 scope). Wildcard
// `*.vercel.app` rejected at plan review on attack-surface + Better
// Auth #3154 protocol-wildcard reliability grounds.
const trustedOrigins =
	process.env.BETTER_AUTH_TRUSTED_ORIGINS?.split(",")
		.map((s) => s.trim())
		.filter((s) => s.length > 0) ?? [];

export const auth = betterAuth({
	database: drizzleAdapter(db, {
		provider: "pg",
		schema,
		usePlural: true,
		transaction: true,
	}),
	secret: process.env.BETTER_AUTH_SECRET,
	baseURL: process.env.BETTER_AUTH_URL,
	trustedOrigins,
	session: {
		expiresIn: ONE_HUNDRED_YEARS_SEC,
		disableSessionRefresh: true,
	},
	advanced: {
		database: {
			generateId: () => uuidv7(),
		},
		// SPEC.2 §8.5 cookie table mandates participant cookie name
		// `zugzwang_session` (no dot/_token suffix). Better Auth defaults to
		// `${cookiePrefix}.${cookieName}` = `zugzwang.session_token`; the
		// `advanced.cookies.session_token.name` override at cookies/index.mjs:27
		// replaces that with our SPEC-mandated name verbatim. The
		// `cookiePrefix` is preserved for Better Auth's internal cookies
		// (session_data, dont_remember, account_data) — not in SPEC, so
		// `zugzwang.session_data` etc. are fine.
		cookies: {
			session_token: {
				name: "zugzwang_session",
				attributes: {
					httpOnly: true,
					secure: true,
					sameSite: "lax",
				},
			},
		},
		cookiePrefix: "zugzwang",
	},
	socialProviders: {
		google: {
			clientId: process.env.GOOGLE_CLIENT_ID,
			clientSecret: process.env.GOOGLE_CLIENT_SECRET,
			scope: ["openid", "email", "profile"],
			// SPEC.2 §8.2 line 814 + plan §5 failure-mode #3: enforce
			// email_verified === true at the profile-mapper boundary. Throwing
			// here rejects the OAuth callback with `oauth_email_not_verified`;
			// no user row is written.
			mapProfileToUser: async (profile: {
				email: string;
				email_verified: boolean;
				name?: string;
				picture?: string;
				sub: string;
			}) => {
				if (!profile.email_verified) {
					throw new APIError("BAD_REQUEST", {
						message: "oauth_email_not_verified",
					});
				}
				return {
					email: profile.email,
					name: profile.name ?? profile.email,
					image: profile.picture,
					emailVerified: true,
					googleId: profile.sub,
				};
			},
		},
	},
	plugins: [emailOTP({ sendVerificationOTP }), zugzwangOtpGate],
	databaseHooks: {
		user: {
			create: {
				// Q10 verified: returning `{ data }` lets us inject pseudonym +
				// pfpFilename. Use camelCase TS-identifier keys (not SQL
				// aliases) — Drizzle adapter resolves by table-key.
				// Q6 verified: pool consumption commits in its own
				// db.transaction; stranded-tuple recovery via stale-30d sweep.
				before: async (user: Record<string, unknown>) => {
					const tuple = await consumeIdentityPoolTuple(db);
					if (!tuple) {
						throw new APIError("SERVICE_UNAVAILABLE", {
							message: "identity_pool_exhausted",
						});
					}
					return {
						data: {
							...user,
							pseudonym: tuple.pseudonym,
							pfpFilename: tuple.pfpFilename,
						},
					};
				},
			},
		},
		session: {
			create: {
				// SPEC.2 §8.3 + plan §1 — DIRECT INV-3 construction-layer
				// protection. The hook's APIError("FORBIDDEN",
				// "ONBOARDING_REQUIRED") shape is the byte-exact contract the
				// catch-all route at src/app/api/auth/[...all]/route.ts matches
				// on to emit the signed onboarding_ref cookie + redirect.
				before: createSessionGate(db),
			},
		},
	},
});
