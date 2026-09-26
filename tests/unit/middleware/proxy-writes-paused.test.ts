import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * AWS-MIGRATION-3 item 5, tests-first (CLAUDE.md §5.6) — the write-pause matrix
 * in the edge proxy. Plan `docs/plans/AWS-MIGRATION-3.md` §"Test plan" row 4:
 * method × path matrix (bets/uploads/visits/auth/cron/admin POST → 503 with
 * headers; GET reads, `/api/health`, `/api/ready`, static → pass; `Next-Action`
 * header → 503; admin redirect still works when unpaused).
 *
 * ⛔ WHY THE PAUSE LIVES IN THE PROXY AND NOT IN EACH HANDLER. The window this
 * flag exists for is the final production data sync: the last backup is taken
 * from the source database and restored into RDS, and NOTHING may write in
 * between. A per-handler gate is a list somebody has to keep complete, and the
 * one handler nobody remembered would write a row that the restore then loses
 * silently — an append-only ledger with a hole in it, which no invariant test
 * can find after the fact. The proxy is the single place every request passes
 * before a Redis reservation, an idempotency sentinel or a transaction can
 * start.
 *
 * ⛔ CRON GETs ARE WRITES, AND THEY ARE THE ROW MOST LIKELY TO BE MISSED.
 * `/api/cron/close-due-markets` moves markets out of `Open` — it is the only
 * thing that does — and it arrives as a GET on a one-minute EventBridge
 * schedule. A method-only rule ("non-GET is a write") passes it straight
 * through, so the pause would hold for participants and leak for the scheduler,
 * which is the worst of both: quiet, unattended, and a state transition.
 *
 * ⛔ SERVER ACTIONS ARE POSTS TO PAGE URLs, so they carry no `/api/` prefix at
 * all. ToS accept, onboarding, the admin market actions and moderation all
 * travel that way, and the only reliable tell on the request is the
 * `Next-Action` header. A path-only rule misses every one of them.
 *
 * HARNESS. The proxy is a pure function of a `NextRequest`, so this file builds
 * real `NextRequest`s from `next/server` (no jsdom, no fetch, no DB) and calls
 * `proxy()` directly. `process.env.ZUGZWANG_WRITES_PAUSED` is set per arm and
 * restored in `afterEach`; the module is re-imported through `vi.resetModules()`
 * so a module-scope env read (if the implementation ever takes one) cannot leak
 * a stale verdict between arms.
 *
 * ⚠ ONE SURFACE FLAGGED TO THE INVOKING SESSION, deliberately NOT asserted
 * here: the `Next-Action` row below proves the proxy REFUSES a Server Action on
 * `/m/<slug>`, and `config.matcher` is asserted only to CONTAIN `/admin/:path*`
 * and `/api/:path*` (the two the caller pinned). Those two assertions together
 * do not prove the proxy is ever INVOKED for `/m/<slug>` in a deployment — that
 * needs the matcher to reach the page routes too. Whether the matcher is widened
 * is a plan/reviewer call, not this file's, so it is recorded rather than
 * silently pinned.
 */

const PAUSE_ENV = "ZUGZWANG_WRITES_PAUSED";
const RETRY_AFTER_ENV = "ZUGZWANG_WRITES_PAUSED_RETRY_AFTER";
const ORIGINAL_PAUSE = process.env[PAUSE_ENV];
const ORIGINAL_RETRY_AFTER = process.env[RETRY_AFTER_ENV];

const ORIGIN = "https://staging.zugzwangworld.com";

type ProxyModule = typeof import("@/proxy");

async function loadProxy(): Promise<ProxyModule> {
	return await import("@/proxy");
}

function request(
	method: string,
	path: string,
	init?: { headers?: Record<string, string>; cookie?: string },
): NextRequest {
	const headers = new Headers(init?.headers ?? {});
	if (init?.cookie !== undefined) {
		headers.set("cookie", init.cookie);
	}
	return new NextRequest(`${ORIGIN}${path}`, { method, headers });
}

/** The §4.4-shaped error envelope, read off a proxy response. */
async function body(response: Response): Promise<{
	ok?: unknown;
	error?: { code?: unknown; retry_after?: unknown };
}> {
	return (await response.json()) as {
		ok?: unknown;
		error?: { code?: unknown; retry_after?: unknown };
	};
}

const restore = (key: string, value: string | undefined): void => {
	if (value === undefined) {
		delete process.env[key];
	} else {
		process.env[key] = value;
	}
};

beforeEach(() => {
	vi.resetModules();
	delete process.env[PAUSE_ENV];
	delete process.env[RETRY_AFTER_ENV];
});

afterEach(() => {
	restore(PAUSE_ENV, ORIGINAL_PAUSE);
	restore(RETRY_AFTER_ENV, ORIGINAL_RETRY_AFTER);
});

/**
 * Every write surface the pause must cover, as `[label, method, path, headers]`.
 * A table rather than eight `it`s because the ROW SET is the contract: a reader
 * checking coverage reads one list, and adding a surface is one line.
 */
const PAUSED_WRITES: ReadonlyArray<
	readonly [string, string, string, Record<string, string>?]
> = [
	["bets place", "POST", "/api/bets/place", undefined],
	["bets sell", "POST", "/api/bets/sell", undefined],
	["upload sign", "POST", "/api/uploads/sign", undefined],
	["visits", "POST", "/api/visits", undefined],
	["auth social sign-in", "POST", "/api/auth/sign-in/social", undefined],
	// Better Auth's OAuth callback is a GET that WRITES (identity-pool
	// consumption, users/accounts/sessions inserts) — `@security-auditor` H-1.
	// Under /api/auth/ every method is a write except the named reads.
	[
		"auth oauth callback (GET that writes)",
		"GET",
		"/api/auth/callback/google",
		undefined,
	],
	// A Server Action fired at a page the first matcher never listed: /legal
	// owns a registered action worker (`@security-auditor` H-2, measured from
	// the build manifest). The catch-all matcher is what makes this reachable.
	[
		"server action on an unlisted page",
		"POST",
		"/legal",
		{ "next-action": "0077744461ed8a884c048b54098515086b86aea436" },
	],
	// The scheduler's GET — see the docblock. This row is why the rule cannot be
	// method-only.
	["cron close-due-markets", "GET", "/api/cron/close-due-markets", undefined],
	["admin market media sign", "POST", "/admin/markets/media/sign", undefined],
	// A Server Action: a POST to a PAGE url, identified only by its header.
	[
		"server action on a debate page",
		"POST",
		"/m/some-slug",
		{
			"Next-Action": "abc",
		},
	],
];

describe("proxy-writes-paused — paused: every write is refused", () => {
	for (const [label, method, path, headers] of PAUSED_WRITES) {
		it(`proxy-writes-paused::refuses-${label.replace(/\s+/g, "-")}`, async () => {
			// Arrange
			process.env[PAUSE_ENV] = "paused";
			const { proxy } = await loadProxy();

			// Act
			const response = proxy(request(method, path, { headers }));

			// Assert — status, both headers, and the envelope code. The header is
			// what a well-behaved client and the ALB actually obey; the body is what
			// the participant surface reads.
			expect(response.status).toBe(503);
			expect(response.headers.get("Retry-After")).toBe("300");
			expect(response.headers.get("Cache-Control")).toBe("no-store");

			const payload = await body(response);
			expect(payload.ok).toBe(false);
			expect(payload.error?.code).toBe("error_writes_paused");
		});
	}

	it("proxy-writes-paused::the-refusal-is-not-a-pass-through", async () => {
		// ⛔ THE CONTROL FOR THE WHOLE TABLE ABOVE. `NextResponse.next()` is ALSO
		// status 200 with a body-less response, and a mis-built refusal could look
		// plausible while still handing the request to the handler. The tell is the
		// `x-middleware-next` header: present on a pass-through, absent on a
		// terminal response. Without this row, a refusal that forgot to be terminal
		// could pass every assertion above except the status.
		process.env[PAUSE_ENV] = "paused";
		const { proxy } = await loadProxy();

		const refused = proxy(request("POST", "/api/bets/place"));
		expect(refused.headers.get("x-middleware-next")).toBeNull();
	});

	it("proxy-writes-paused::retry-after-follows-the-configured-value", async () => {
		// The header is not a literal — it reads the same env the pure predicate
		// does, so an operator can shorten the window without a code change.
		process.env[PAUSE_ENV] = "paused";
		process.env[RETRY_AFTER_ENV] = "45";
		const { proxy } = await loadProxy();

		const response = proxy(request("POST", "/api/bets/place"));
		expect(response.status).toBe(503);
		expect(response.headers.get("Retry-After")).toBe("45");
	});
});

/**
 * Reads during a pause. The invariant is "writes stop, the product stays
 * readable": a pause that also took the surface down would be an outage, and
 * `/api/ready` in particular MUST answer — it is the ALB target-group health
 * check, so refusing it would drain every target and stop serving reads too.
 */
const PASSING_READS: ReadonlyArray<readonly [string, string, string]> = [
	["discovery", "GET", "/"],
	["debate view", "GET", "/m/some-slug"],
	["profile", "GET", "/u/some-pseudonym"],
	["health", "GET", "/api/health"],
	["readiness", "GET", "/api/ready"],
	["session read", "GET", "/api/auth/get-session"],
];

describe("proxy-writes-paused — paused: reads pass through", () => {
	for (const [label, method, path] of PASSING_READS) {
		it(`proxy-writes-paused::passes-${label.replace(/\s+/g, "-")}`, async () => {
			process.env[PAUSE_ENV] = "paused";
			const { proxy } = await loadProxy();

			const response = proxy(request(method, path));

			expect(response.status).toBe(200);
			// The pass-through tell. Asserted alongside the 200 because a 200 alone
			// cannot distinguish `NextResponse.next()` from a terminal 200.
			expect(response.headers.get("x-middleware-next")).toBe("1");
		});
	}

	it("proxy-writes-paused::readiness-is-never-refused-even-though-admin-and-api-are", async () => {
		// Stated as its own row because the consequence is a total outage rather
		// than a degraded one: `/api/ready` is the target-group health path
		// (compute-stack.ts → `config.readinessPath`). A 503 here empties the
		// target group, so the pause would take the READS down as well.
		process.env[PAUSE_ENV] = "paused";
		const { proxy } = await loadProxy();

		expect(proxy(request("GET", "/api/ready")).status).toBe(200);
		expect(proxy(request("GET", "/api/health")).status).toBe(200);
	});
});

describe("proxy-writes-paused — unpaused: nothing changes", () => {
	it("proxy-writes-paused::writes-pass-when-the-flag-is-unset", async () => {
		// ⛔ THE INERTNESS CONTROL, and the reason the plan calls the proxy
		// widening "inert unless the exact value is set". If any row here refused,
		// the pause would be on in production today.
		//
		// ⚠ The `/admin/*` row is handed the admin cookie, and that is a fact about
		// THIS assertion rather than a convenience. Unpaused and cookieless, that
		// path takes the pre-existing Layer-1 redirect to `/admin/login` (307) —
		// correct behaviour, asserted on its own below, and nothing to do with the
		// pause. Supplying the cookie is what isolates "the pause is inert" from
		// "the admin gate still fires"; conflating the two is how a green inertness
		// row could be satisfied by a redirect instead of a pass-through. Caught by
		// this file's own first run.
		const { proxy } = await loadProxy();

		for (const [, method, path, headers] of PAUSED_WRITES) {
			const cookie = path.startsWith("/admin")
				? "zugzwang_admin_session=a-session-value"
				: undefined;
			const response = proxy(request(method, path, { headers, cookie }));
			expect(response.status).toBe(200);
			expect(response.headers.get("x-middleware-next")).toBe("1");
		}
	});

	it("proxy-writes-paused::an-unpaused-cookieless-admin-write-still-redirects", async () => {
		// The other half of the row above: the admin surface is NOT exempted from
		// its cookie gate just because the pause is off. Stated separately so
		// neither behaviour can hide inside the other.
		const { proxy } = await loadProxy();

		const response = proxy(request("POST", "/admin/markets/media/sign"));
		expect(response.status).toBe(307);
		expect(new URL(response.headers.get("location") as string).pathname).toBe(
			"/admin/login",
		);
	});

	it("proxy-writes-paused::reads-pass-when-the-flag-is-unset", async () => {
		const { proxy } = await loadProxy();

		for (const [, method, path] of PASSING_READS) {
			expect(proxy(request(method, path)).status).toBe(200);
		}
	});

	it("proxy-writes-paused::a-boolean-shaped-flag-does-not-pause", async () => {
		// The exact-value gate, observed through the proxy rather than the
		// predicate — so a proxy that read the env itself with `Boolean(...)`
		// instead of calling `isWritesPaused` is caught here.
		for (const value of ["true", "1", "yes", ""]) {
			vi.resetModules();
			process.env[PAUSE_ENV] = value;
			const { proxy } = await loadProxy();
			expect(proxy(request("POST", "/api/bets/place")).status).toBe(200);
		}
	});

	it("proxy-writes-paused::the-admin-redirect-still-works", async () => {
		// The pre-existing Layer-1 UX behaviour (SPEC.2 §8.4): `/admin/*` without
		// the admin cookie redirects to `/admin/login`. This is the regression this
		// item could most easily break — `/admin` is now also a WRITE prefix, so a
		// refusal placed before the cookie gate would 503 the admin login flow.
		const { proxy } = await loadProxy();

		const response = proxy(request("GET", "/admin/markets"));

		expect(response.status).toBe(307);
		const location = response.headers.get("location");
		expect(location).not.toBeNull();
		expect(new URL(location as string).pathname).toBe("/admin/login");
	});

	it("proxy-writes-paused::the-admin-login-page-itself-is-not-redirected", async () => {
		// The loop guard that already existed; kept so the row above cannot be
		// satisfied by a blanket redirect.
		const { proxy } = await loadProxy();

		const response = proxy(request("GET", "/admin/login"));
		expect(response.status).toBe(200);
		expect(response.headers.get("x-middleware-next")).toBe("1");
	});

	it("proxy-writes-paused::an-admin-with-the-cookie-passes-through", async () => {
		const { proxy } = await loadProxy();

		const response = proxy(
			request("GET", "/admin/markets", {
				cookie: "zugzwang_admin_session=a-session-value",
			}),
		);
		expect(response.status).toBe(200);
		expect(response.headers.get("x-middleware-next")).toBe("1");
	});
});

describe("proxy-writes-paused — the matcher reaches the paused surfaces", () => {
	it("proxy-writes-paused::matcher-covers-admin-and-api", async () => {
		// A refusal written into a proxy the request never reaches is a refusal
		// that never happens. The matcher is the only thing that decides whether
		// this function runs at all, so it is part of the contract rather than
		// configuration beside it.
		const { config } = await loadProxy();

		// One catch-all that fails CLOSED: every route except Next's static
		// output and files with an extension. An allowlist of prefixes is the
		// shape that silently misses the next page somebody adds (H-2).
		expect(config.matcher).toHaveLength(1);
		const pattern = config.matcher[0] as string;
		expect(pattern.startsWith("/((?!")).toBe(true);
		for (const excluded of ["_next/static", "_next/image", "favicon"]) {
			expect(pattern).toContain(excluded);
		}
		// The negative lookahead must not name any application route.
		for (const route of ["admin", "api", "legal", "m/", "u/"]) {
			expect(pattern).not.toContain(`|${route}`);
		}
	});
});
