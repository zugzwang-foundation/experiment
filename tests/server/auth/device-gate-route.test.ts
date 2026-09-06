import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * MOBILE-1 · Phase B — THE ROUTE-WRAPPER GATE: `/api/auth/[...all]` REFUSES A
 * PHONE OR TABLET BEFORE BETTER AUTH RUNS AT ALL.
 *
 * WHAT THIS PROVES, AND WHERE IT COMES FROM. `docs/plans/MOBILE-1.md` §3 "Call
 * site 1 — the route wrapper": at the top of `handleAuth`, BEFORE the existing
 * `const response = await auth.handler(request);` line, read the incoming
 * `user-agent` and classify it. "On a positive match, short-circuit and return
 * the reject response below WITHOUT CALLING `auth.handler` AT ALL — none of the
 * existing 403/ONBOARDING_REQUIRED/OAuth-callback logic in this file runs for a
 * blocked request." §7 row 2 is the integration row this file mints; §7 row 7
 * (M1-6) is the OAuth-callback shape row.
 *
 * ⛔ TWO RESPONSE SHAPES, ONE PER CONSUMER TYPE (plan §3 "Response on block,
 * revised (M1-6)"). A POST from the Better Auth SDK is a `fetch` and gets JSON
 * `403 {"code":"mobile_auth_unavailable"}` — matching this file's own existing
 * short-code convention. A blocked GET on the OAuth-callback path is a BROWSER
 * NAVIGATION (Google redirects the user-agent there post-consent) and gets a
 * `302` to `/sign-in`, where the "computer only" message renders. This is not a
 * third shape invented for the gate: `route.ts` already draws exactly this
 * distinction for ONBOARDING_REQUIRED via `isOAuthCallback`, and the gate reuses
 * that discriminator.
 *
 * ⛔ NO `Set-Cookie` ON EITHER REJECT. The block happens before any session,
 * onboarding-ref or auth state exists, so there is nothing to set — and a
 * `Set-Cookie` on a rejected request is how a half-issued session gets born.
 *
 * ⚠ VEHICLE: `tests/server/auth/_probe-route-wrapper.test.ts`'s `vi.mock(
 * "@/server/auth")`, with one change that is the point of the file —
 * `auth.handler` is a `vi.fn()` whose CALL COUNT is asserted. "The gate returns
 * 403" and "the gate returns 403 after letting Better Auth do the work" look
 * identical from the outside and are not the same guarantee.
 *
 * ⚠ EVERY PASS-THROUGH ROW IS PAIRED, IN THE SAME TEST, WITH ITS BLOCKED TWIN.
 * A pass-through assertion on its own is vacuously true of a tree with no gate
 * in it — which is precisely today's tree. The differential (same handler, same
 * path, two User-Agents, two outcomes) is the property worth asserting and is
 * the only form of it that can be RED before the implementation lands.
 *
 * ⚠ TDD DRIVER, NOT A `_probe-*` REGRESSION GUARD (CLAUDE.md §5.6).
 */

/** The sentinel body the mocked Better Auth handler returns on pass-through. */
const PASSED_THROUGH = "passed-through-to-better-auth";

const { mockHandler } = vi.hoisted(() => ({
	mockHandler: vi.fn(),
}));

vi.mock("@/server/auth", () => ({
	auth: { handler: mockHandler },
}));

import { GET, POST } from "@/app/api/auth/[...all]/route";

// --- User-Agent fixtures ---------------------------------------------------
// Real, mixed-case wire strings. See tests/unit/auth/device-class.test.ts for
// the full table and the reasoning behind each class.

const PHONE_UA =
	"Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const ANDROID_TABLET_UA =
	"Mozilla/5.0 (Linux; Android 13; SM-X700) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";
const DESKTOP_UA =
	"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
/**
 * ⛔ THE STRING AN iPad SHARES WITH EVERY REAL MAC. Byte-identical to macOS
 * Safari since iPadOS 13 — plan §3, Self-critique #1. It MUST pass through.
 */
const MAC_SAFARI_UA =
	"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15";
/** The opt-in "Request Mobile Website" iPad string — the reachable half. */
const IPAD_MOBILE_UA =
	"Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

const REJECT_CODE = "mobile_auth_unavailable";

let logSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
	mockHandler.mockReset();
	mockHandler.mockImplementation(
		async (): Promise<Response> =>
			new Response(JSON.stringify({ ok: PASSED_THROUGH }), {
				status: 200,
				headers: { "content-type": "application/json" },
			}),
	);
	logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
	logSpy.mockRestore();
	vi.clearAllMocks();
});

/** A request at `path`, optionally carrying a `user-agent`. */
function req(
	path: string,
	init: { method: "GET" | "POST"; ua?: string | undefined },
): Request {
	const headers = new Headers({ "content-type": "application/json" });
	if (init.ua !== undefined) headers.set("user-agent", init.ua);
	return new Request(`http://localhost:3000${path}`, {
		method: init.method,
		headers,
		...(init.method === "POST" ? { body: JSON.stringify({}) } : {}),
	});
}

/** Assert the SDK-consumer reject shape, in full. */
async function expectSdkReject(
	response: Response,
	where: string,
): Promise<void> {
	expect(response.status, `${where}: expected a 403 SDK reject.`).toBe(403);
	expect(response.headers.get("content-type")).toContain("application/json");
	expect(
		response.headers.get("set-cookie"),
		`${where}: the reject carries a Set-Cookie. The block runs before any ` +
			`session or onboarding-ref exists — there is nothing to set, and setting ` +
			`something is how a half-issued session is born.`,
	).toBeNull();
	const body = (await response.json()) as { code?: unknown };
	expect(body).toEqual({ code: REJECT_CODE });
	expect(
		mockHandler,
		`${where}: \`auth.handler\` WAS called on a blocked request. Plan §3 ` +
			`requires the short-circuit to happen before it — "none of the existing ` +
			`403/ONBOARDING_REQUIRED/OAuth-callback logic in this file runs for a ` +
			`blocked request."`,
	).not.toHaveBeenCalled();
}

/** Assert full pass-through into the (mocked) Better Auth handler. */
async function expectPassThrough(
	response: Response,
	where: string,
): Promise<void> {
	expect(response.status, `${where}: expected pass-through (200).`).toBe(200);
	expect(await response.text()).toContain(PASSED_THROUGH);
	expect(
		mockHandler,
		`${where}: \`auth.handler\` was NOT called. The gate must fail open here ` +
			`— plan §5: "the failure that matters is never wrongly blocking a real ` +
			`desktop signup."`,
	).toHaveBeenCalledTimes(1);
}

/** Every `device_gate_reject` row emitted through `console.log` so far. */
function rejectLogRows(): Record<string, unknown>[] {
	return logSpy.mock.calls
		.map((call) => {
			try {
				return JSON.parse(String(call[0])) as Record<string, unknown>;
			} catch {
				return null;
			}
		})
		.filter(
			(row): row is Record<string, unknown> =>
				row !== null && row.event === "device_gate_reject",
		);
}

describe("device-gate-route::the-SDK-driven-auth-endpoints-are-blocked", () => {
	// Plan §7 row 2: "Hit `/api/auth/[...all]`'s real `handleAuth` with each UA
	// class against `sign-in/social`, `sign-in/email-otp`,
	// `email-otp/send-verification-otp`". These three are the whole of the
	// participant auth-initiating surface (plan §3 "Scope" — the Better Auth
	// React client is the route's only HTTP consumer in the tree).

	it("device-gate-route::phone-blocked-on-sign-in-social", async () => {
		const response = await POST(
			req("/api/auth/sign-in/social", { method: "POST", ua: PHONE_UA }),
		);
		await expectSdkReject(response, "POST /api/auth/sign-in/social");
	});

	it("device-gate-route::phone-blocked-on-sign-in-email-otp", async () => {
		const response = await POST(
			req("/api/auth/sign-in/email-otp", { method: "POST", ua: PHONE_UA }),
		);
		await expectSdkReject(response, "POST /api/auth/sign-in/email-otp");
	});

	it("device-gate-route::phone-blocked-on-send-verification-otp", async () => {
		const response = await POST(
			req("/api/auth/email-otp/send-verification-otp", {
				method: "POST",
				ua: PHONE_UA,
			}),
		);
		await expectSdkReject(
			response,
			"POST /api/auth/email-otp/send-verification-otp",
		);
	});

	it("device-gate-route::android-tablet-blocked-on-sign-in-social", async () => {
		// Round 2 ruling (plan Decisions received #8): tablets are excluded from
		// Join/Login too, not just phones.
		const response = await POST(
			req("/api/auth/sign-in/social", {
				method: "POST",
				ua: ANDROID_TABLET_UA,
			}),
		);
		await expectSdkReject(response, "POST /api/auth/sign-in/social (tablet)");
	});
});

describe("device-gate-route::a-browser-navigation-never-gets-a-JSON-blob", () => {
	it("device-gate-route::blocked-oauth-callback-GET-is-a-302-to-sign-in", async () => {
		// M1-6, plan §3 "Exception, reusing the file's own existing
		// discriminator": for a blocked GET on `/api/auth/callback/*`, 302 to
		// `/sign-in` — where the "computer only" message already renders below the
		// breakpoint — rather than answering a browser navigation with a raw JSON
		// body the user would be stranded staring at.
		const response = await GET(
			req("/api/auth/callback/google?code=fake", {
				method: "GET",
				ua: PHONE_UA,
			}),
		);

		expect(response.status).toBe(302);
		expect(response.headers.get("location")).toBe("/sign-in");
		expect(
			await response.text(),
			`the blocked OAuth-callback 302 has a non-empty body. The existing ` +
				`ONBOARDING_REQUIRED 302 in this file ships a null body deliberately ` +
				`(screenshot-leak surface); the gate's 302 follows it.`,
		).toBe("");
		expect(response.headers.get("set-cookie")).toBeNull();
		expect(
			mockHandler,
			`\`auth.handler\` was called on a blocked OAuth callback. The gate is ` +
				`the FIRST thing in handleAuth, above the existing isOAuthCallback ` +
				`branch — it must not consume the upstream response to decide.`,
		).not.toHaveBeenCalled();
	});

	it("device-gate-route::the-callback-path-discriminator-is-the-only-difference", async () => {
		// ⛔ THE DIFFERENTIAL. The two shapes must be selected by PATH and by
		// nothing else — same method-agnostic gate, same UA, two paths, two
		// shapes. Asserting each shape alone cannot see a gate that returns 302
		// for everything (which would strand the SDK) or 403 for everything (which
		// is what M1-6 corrected).
		const callback = await GET(
			req("/api/auth/callback/google?code=fake", {
				method: "GET",
				ua: PHONE_UA,
			}),
		);
		expect(callback.status).toBe(302);

		mockHandler.mockClear();

		const sdk = await POST(
			req("/api/auth/sign-in/social", { method: "POST", ua: PHONE_UA }),
		);
		expect(sdk.status).toBe(403);
		expect(await sdk.json()).toEqual({ code: REJECT_CODE });
	});
});

describe("device-gate-route::computers-still-sign-in", () => {
	it("device-gate-route::desktop-passes-through-while-a-phone-does-not", async () => {
		// ⛔ THE PAIRED CONTROL. "Desktop passes through" is trivially true of a
		// tree with no gate; only the differential says anything. Both halves run
		// against the same export, the same path and the same mock — the User-Agent
		// is the sole independent variable.
		const allowed = await POST(
			req("/api/auth/sign-in/social", { method: "POST", ua: DESKTOP_UA }),
		);
		await expectPassThrough(allowed, "desktop POST /api/auth/sign-in/social");

		mockHandler.mockClear();

		const blocked = await POST(
			req("/api/auth/sign-in/social", { method: "POST", ua: PHONE_UA }),
		);
		await expectSdkReject(blocked, "phone POST /api/auth/sign-in/social");
	});

	it("device-gate-route::the-macOS-Safari-string-an-iPad-shares-passes-through", async () => {
		// ⛔⛔ THE ROW THAT PROTECTS EVERY MAC USER'S SIGN-UP. iPadOS Safari's
		// default UA is byte-identical to real macOS Safari (plan §3,
		// Self-critique #1, rated HIGH) — so a gate tuned to catch iPads catches
		// every Mac laptop and desktop instead. This asserts it does not, and
		// pairs it with the ONE iPad string that IS self-identifying (the opt-in
		// "Request Mobile Website" form, off by default) so the pass-through half
		// cannot be bought by a gate that blocks nothing.
		const mac = await POST(
			req("/api/auth/sign-in/social", { method: "POST", ua: MAC_SAFARI_UA }),
		);
		await expectPassThrough(mac, "macOS-Safari POST /api/auth/sign-in/social");

		mockHandler.mockClear();

		const ipad = await POST(
			req("/api/auth/sign-in/social", { method: "POST", ua: IPAD_MOBILE_UA }),
		);
		await expectSdkReject(
			ipad,
			"opt-in-mobile iPad POST /api/auth/sign-in/social",
		);
	});

	it("device-gate-route::a-request-with-no-user-agent-header-fails-open", async () => {
		// Plan §5, first bullet: missing/empty UA → classify desktop, let it
		// through. Paired with the phone half for the same reason as above.
		const headerless = await POST(
			req("/api/auth/sign-in/email-otp", { method: "POST", ua: undefined }),
		);
		expect(
			headerless.headers.get("user-agent"),
			"fixture check: this request must genuinely carry no user-agent header.",
		).toBeNull();
		await expectPassThrough(
			headerless,
			"headerless POST /api/auth/sign-in/email-otp",
		);

		mockHandler.mockClear();

		const blocked = await POST(
			req("/api/auth/sign-in/email-otp", { method: "POST", ua: PHONE_UA }),
		);
		await expectSdkReject(blocked, "phone POST /api/auth/sign-in/email-otp");
	});
});

describe("device-gate-route::every-reject-is-observable", () => {
	it("device-gate-route::a-reject-emits-exactly-one-device_gate_reject-line", async () => {
		// M1-5, plan §3 "Observability" + Self-critique #4 (reversed from the
		// original out-of-scope call): one structured log line per reject, at both
		// call sites. Without it there is no way to know the false-positive rate or
		// whether the gate is still working post-launch until the Nov freeze, at
		// which point it is too late to act on.
		//
		// ⛔ NOT `logRequest`. That helper's own doctrine excludes rejections
		// ("Rejected requests — origin-blocked, rate-limited, auth-failed — DO NOT
		// call this helper") and its SEVEN-FIELD shape is locked to the
		// public-dataset extractor (SPEC.1 §16.3; widening it needs a SPEC.1
		// amendment). The discriminator field is what makes the two rows
		// distinguishable in one log stream, so it is asserted first.
		await POST(
			req("/api/auth/sign-in/social", { method: "POST", ua: PHONE_UA }),
		);

		const rows = rejectLogRows();
		expect(
			rows.length,
			`expected exactly one \`device_gate_reject\` log row for one blocked ` +
				`request, saw ${rows.length}.`,
		).toBe(1);

		const row = rows[0] ?? {};
		expect(row.event).toBe("device_gate_reject");
		expect(row.call_site).toBe("auth-route");
		expect(row.device_class).toBe("phone");
		expect(row.route).toBe("/api/auth/sign-in/social");
		expect(typeof row.timestamp).toBe("string");
		expect(String(row.user_agent)).toContain("iPhone");

		// ⛔ AND IT MUST NOT BE `logRequest`'s ROW. The locked seven-field shape is
		// `timestamp, user_id, route, status_code, ip, user_agent, latency_ms`;
		// a gate row carrying those keys means the helper was reused or widened.
		expect(
			Object.keys(row),
			`the reject row carries \`logRequest\`'s locked fields. SPEC.1 §16.3 ` +
				`pins that shape byte-stable for the public-dataset extractor — the ` +
				`gate needs its own separate export (plan §3, M1-5), not a widened one.`,
		).not.toContain("latency_ms");
		expect(Object.keys(row)).not.toContain("status_code");
	});

	it("device-gate-route::a-pass-through-emits-no-reject-line", async () => {
		// The paired negative: the log is evidence of a reject, so it must not
		// appear on the path that was allowed. Runs the blocked half too, so
		// "emits nothing ever" cannot pass as "emits nothing here".
		await POST(
			req("/api/auth/sign-in/social", { method: "POST", ua: DESKTOP_UA }),
		);
		expect(rejectLogRows()).toEqual([]);

		await POST(
			req("/api/auth/sign-in/social", { method: "POST", ua: PHONE_UA }),
		);
		expect(
			rejectLogRows().length,
			`no \`device_gate_reject\` row was emitted for a blocked request, so ` +
				`the assertion above proved nothing.`,
		).toBe(1);
	});
});
