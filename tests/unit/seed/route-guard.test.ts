import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// SEED-STAGING-1 §3 G1 / G3 / G5 + §9 (`route-guard.ts`, the two Route
// Handlers' shared front door).
//
// THE POINT OF THIS FILE: G2 — the gate `runSeedChunk` itself calls — already
// has a test. G1 and G3 did not, and they are the two guards that stand
// between the open internet and a tool that mints accounts and places bets.
// Three properties, and the ORDER of them is itself one of the three:
//
//   1. On anything but staging the answer is 404, and NOTHING ELSE RUNS.
//      Not a 403, not a 401, and in particular not an origin check or a
//      session lookup — because a 401 tells an unauthenticated caller that
//      the endpoint exists and is worth attacking, while a 404 tells them
//      nothing. "The env check is first" is therefore a security property,
//      not a performance one, and the only way to assert it is to prove the
//      later checks were NOT CALLED.
//   2. The 404 body must be indistinguishable from a route that is absent.
//      A helpful `seed tools are disabled on production` message would undo
//      the whole of (1) while every status code still looked right.
//   3. The page and both handlers must run the env check BEFORE their admin
//      gate / before any other `await`. A guard that runs second is a guard
//      an attacker reaches second, and on this surface the first thing
//      reached must reveal nothing.
//
// (3) is a TEXT SCAN, because ordering inside a Route Handler is not
// observable from outside: a handler that checked the session first and the
// environment second returns the same 404 on production for a signed-out
// caller, and a DIFFERENT answer for a signed-in one. The bug only appears
// for the one caller nobody tests with.
//
// ⚠ COMMENTS ARE STRIPPED BEFORE SCANNING, for the reason this repository
// has already paid for six times (AGENTS.md §9): all three files document
// their ordering in prose, so a scan that matched the explanation would pass
// on a file that had stopped doing it. The same strip is proven load-bearing
// in tests/unit/auth/tos-accept-exports.test.ts.

const { mockRequireAdminSession, mockCheckOrigin } = vi.hoisted(() => ({
	mockRequireAdminSession: vi.fn(),
	mockCheckOrigin: vi.fn(),
}));

// A WHOLE-module factory, deliberately, and it is safe here for a reason the
// staging generator's partial mock does not share: `route-guard.ts` reaches
// `@/server/admin/wire` for `requireAdminSession` and nothing else, so no real
// sibling export is in this graph to be replaced by `undefined`. It also keeps
// `next/headers` out of the module graph entirely — the real
// `requireAdminSession` reads `cookies()`, which does not exist in Vitest.
vi.mock("@/server/admin/wire", () => ({
	requireAdminSession: mockRequireAdminSession,
}));
vi.mock("@/server/middleware/origin-allowlist", () => ({
	checkOrigin: mockCheckOrigin,
}));

// ⛔ `@/server/middleware/envelope` is NOT mocked. The status code and the body
// ARE the contract here, so they are produced by the shipped helper rather than
// by a stub that would agree with whatever the test expected.
import { guardSeedRequest } from "@/server/seed/route-guard";

const REQUEST_ID = "seed-guard-request-id";

function seedRequest(): Request {
	return new Request("https://prd.example.com/admin/seed/run", {
		method: "POST",
		headers: { origin: "https://prd.example.com" },
	});
}

let savedEnv: string | undefined;
let savedSeedFlag: string | undefined;

/**
 * "staging" means the staging DEPLOYMENT: ZUGZWANG_ENV=staging AND the
 * ZUGZWANG_SEED_TOOLS flag its task definition carries (ADR-0064, C-1). Any
 * other value sets the environment and clears the flag, as on production.
 */
function setEnv(value: string | undefined): void {
	if (value === undefined) delete process.env.ZUGZWANG_ENV;
	else process.env.ZUGZWANG_ENV = value;
	if (value === "staging") process.env.ZUGZWANG_SEED_TOOLS = "enabled";
	else delete process.env.ZUGZWANG_SEED_TOOLS;
}

function restoreEnv(): void {
	setEnv(savedEnv);
	if (savedSeedFlag === undefined) delete process.env.ZUGZWANG_SEED_TOOLS;
	else process.env.ZUGZWANG_SEED_TOOLS = savedSeedFlag;
}

beforeEach(() => {
	savedEnv = process.env.ZUGZWANG_ENV;
	savedSeedFlag = process.env.ZUGZWANG_SEED_TOOLS;
	vi.clearAllMocks();
	// The permissive defaults, so every refusal below is caused by the ONE thing
	// its test changes. A test that passed because two guards refused at once
	// would not be telling us which.
	mockCheckOrigin.mockReturnValue(true);
	mockRequireAdminSession.mockResolvedValue({ sessionId: "admin-session-1" });
});

afterEach(() => {
	restoreEnv();
});

describe("seed-route-guard — the environment answers first (G1)", () => {
	it("seed-route-guard::non-staging-404s-without-consulting-origin-or-session", async () => {
		// `tests/_setup/env.ts` defaults the suite to `prod`; `preview` is a REAL
		// deployment value in `VALID_ENVS`, which is why it is named explicitly —
		// a membership test against the valid set would admit it.
		for (const env of ["prod", "preview"]) {
			vi.clearAllMocks();
			mockCheckOrigin.mockReturnValue(true);
			mockRequireAdminSession.mockResolvedValue({ sessionId: "admin-1" });
			setEnv(env);

			const response = await guardSeedRequest(seedRequest(), REQUEST_ID);

			expect(response).not.toBeNull();
			expect(response?.status).toBe(404);
			// THE LOAD-BEARING HALF. Both later checks are permissive in this
			// arm, so the 404 cannot have come from either of them — it came
			// from the environment, and nothing downstream was reached.
			expect(mockCheckOrigin).not.toHaveBeenCalled();
			expect(mockRequireAdminSession).not.toHaveBeenCalled();
		}
	});

	it("seed-route-guard::the-404-body-reveals-nothing-about-the-tool", async () => {
		// (2) above. A 404 whose body names the feature is a 404 that works like
		// a 200 for anyone probing: the status hides the endpoint and the body
		// hands it back. Asserted as the ABSENCE of the giveaway rather than the
		// presence of a known string, so a future message cannot reintroduce it
		// in wording nobody predicted (the SC-1 shape: assert what must not be
		// there).
		setEnv("prod");

		const response = await guardSeedRequest(seedRequest(), REQUEST_ID);
		const body = await response?.text();

		expect(response?.status).toBe(404);
		expect(body).not.toMatch(/seed/i);
		expect(body).not.toMatch(/staging/i);
		expect(body).not.toMatch(/disabled/i);
		expect(body).not.toMatch(/ZUGZWANG_ENV/i);
		// Revised after the security audit: the first version answered with a
		// §4.4 JSON envelope and an X-Request-Id header. Neither names the tool,
		// but their SHAPE does — an absent route returns neither — so "behaves
		// like a URL that does not exist" was false. The env arm is now a bare
		// 404: empty body, no request-id, no JSON content type.
		expect(body).toBe("");
		expect(response?.headers.get("X-Request-Id")).toBeNull();
		expect(response?.headers.get("content-type") ?? "").not.toMatch(/json/);
	});
});

describe("seed-route-guard — origin, then session (G3)", () => {
	it("seed-route-guard::staging-rejects-a-bad-origin-without-consulting-the-session", async () => {
		// SPEC.2 §4.1 CSRF allowlist. The session is NOT consulted, which is what
		// makes the ordering observable: a cross-origin POST is refused on the
		// request's own evidence, before anything touches a cookie.
		setEnv("staging");
		mockCheckOrigin.mockReturnValue(false);

		const response = await guardSeedRequest(seedRequest(), REQUEST_ID);

		expect(response?.status).toBe(403);
		expect(await response?.json()).toEqual({
			ok: false,
			error: { code: "error_origin_rejected", message: "origin not allowed" },
		});
		expect(mockCheckOrigin).toHaveBeenCalledTimes(1);
		expect(mockRequireAdminSession).not.toHaveBeenCalled();
	});

	it("seed-route-guard::staging-with-a-good-origin-and-no-session-401s", async () => {
		// The Layer-2 admin boundary. `requireAdminSession` resolves `null` for a
		// missing, malformed or expired cookie alike, and all three are one
		// answer here: 401, and the handler never runs.
		setEnv("staging");
		mockRequireAdminSession.mockResolvedValue(null);

		const response = await guardSeedRequest(seedRequest(), REQUEST_ID);

		expect(response?.status).toBe(401);
		expect(await response?.json()).toEqual({
			ok: false,
			error: {
				code: "admin_session_required",
				message: "admin session required",
			},
		});
	});

	it("seed-route-guard::staging-with-a-good-origin-and-a-session-passes", async () => {
		// `null` means "no rejection" — the handler proceeds. THE POSITIVE
		// CONTROL for all four refusals above: without it, a guard that returned
		// a Response unconditionally would satisfy every one of them.
		setEnv("staging");

		const response = await guardSeedRequest(seedRequest(), REQUEST_ID);

		expect(response).toBeNull();
	});

	it("seed-route-guard::the-spies-observe-the-real-calls", async () => {
		// THE CONTROL THAT MAKES `not.toHaveBeenCalled()` MEAN ANYTHING. A spy
		// that was never wired to the module under test records zero calls in
		// every arm, including the ones that should record one — so the
		// not-called assertions above would pass against a guard that had no
		// origin or session check at all.
		setEnv("staging");
		const request = seedRequest();

		await guardSeedRequest(request, REQUEST_ID);

		expect(mockCheckOrigin).toHaveBeenCalledTimes(1);
		// The REAL request object, by identity — not a clone and not a URL
		// string. `checkOrigin` reads the `origin` header off it, so a guard
		// that reconstructed the request would be checking something the caller
		// never sent.
		expect(mockCheckOrigin.mock.calls[0]?.[0]).toBe(request);
		expect(mockRequireAdminSession).toHaveBeenCalledTimes(1);
		// It takes no argument: the cookie comes from `next/headers`, not from
		// this request, which is exactly why these handlers must live under
		// `/admin` (the cookie is scoped `Path=/admin`).
		expect(mockRequireAdminSession.mock.calls[0]).toEqual([]);
	});
});

// ── (3) The ordering, read off the source ───────────────────────────────────

const APP_SEED = "../../../src/app/(admin)/admin/seed";

function sourceOf(relative: string): string {
	return readFileSync(
		fileURLToPath(new URL(`${APP_SEED}/${relative}`, import.meta.url)),
		"utf-8",
	);
}

/** Block comments, then line comments. A `//` inside a string is preceded by a
 * non-space character (`https://`, a route path) so the second pattern cannot
 * reach it. */
function stripComments(source: string): string {
	return source
		.replace(/\/\*[\s\S]*?\*\//g, "")
		.replace(/(^|[\s;{}()[\],])\/\/[^\n]*/g, "$1");
}

/** The identifier the module's FIRST `await` applies to. */
function firstAwaitTarget(source: string): string {
	const match = /\bawait\s+([A-Za-z_$][\w$.]*)/.exec(stripComments(source));
	return match?.[1] ?? "<no await found>";
}

/** Everything between the first `await` and the second — where a guard's
 * rejection has to be returned, or it is not a guard. */
function betweenFirstAndSecondAwait(source: string): string {
	const stripped = stripComments(source);
	const awaits = [...stripped.matchAll(/\bawait\b/g)].map((m) => m.index ?? -1);
	if (awaits.length < 2) return stripped.slice(awaits[0] ?? 0);
	return stripped.slice(awaits[0] ?? 0, awaits[1]);
}

/**
 * Every `route.ts` under the seed directory, DISCOVERED rather than listed
 * (`@code-reviewer` M-3, O-1): a third seeding handler is covered by existing,
 * not by someone remembering to add it to an array. The guard polarity fails
 * open (ADR-0064), so this scan is what stands behind a forgotten call.
 */
function discoverHandlers(): string[] {
	const root = fileURLToPath(new URL(APP_SEED, import.meta.url));
	return (readdirSync(root, { recursive: true }) as string[])
		.map((p) => p.replaceAll("\\", "/"))
		.filter((p) => p.endsWith("route.ts"))
		.sort();
}

describe("seed-route-guard — the handlers and the page call it first", () => {
	it("seed-route-guard::discovers-the-handlers (positive control)", () => {
		// Fewer than the two that exist means the walk is broken, and a broken
		// walk would scan nothing and pass.
		// A superset, not equality: a new handler joins the scan below on its own.
		const found = discoverHandlers();
		expect(found.length).toBeGreaterThanOrEqual(2);
		expect(found).toEqual(
			expect.arrayContaining(["preview/route.ts", "run/route.ts"]),
		);
	});

	for (const handler of discoverHandlers()) {
		it(`seed-route-guard::${handler.replace("/", "-")}-guards-before-any-other-await`, () => {
			const source = sourceOf(handler);

			// `resolveRequestId` is synchronous, so the guard is genuinely the
			// first thing awaited. Anything else here — reading the body,
			// querying markets, parsing the sheet — would mean work is done for
			// a caller the guard was about to refuse, on a surface whose first
			// answer is supposed to reveal nothing.
			expect(firstAwaitTarget(source)).toBe("guardSeedRequest");

			// And its answer SHORT-CIRCUITS. Asserted as "a `return` appears
			// between the guard's await and the next one" rather than by pinning
			// a variable name, so the property survives a rename: a handler that
			// awaited the guard and then ignored the Response would satisfy the
			// assertion above and still serve every caller.
			expect(betweenFirstAndSecondAwait(source)).toMatch(/\breturn\b/);
		});
	}

	it("seed-route-guard::the-page-checks-the-environment-before-the-admin-gate (G1)", () => {
		const stripped = stripComments(sourceOf("page.tsx"));

		// Matched WITH the opening paren, which is what distinguishes the call
		// sites from the import list — `requireAdminPage` is imported ABOVE
		// `isSeedToolsEnabled` (alphabetical by module path), so a bare
		// `indexOf` on the names would read the import order and report the
		// opposite of the truth.
		const envAt = stripped.indexOf("isSeedToolsEnabled(");
		const gateAt = stripped.indexOf("requireAdminPage(");
		expect(envAt).toBeGreaterThan(-1);
		expect(gateAt).toBeGreaterThan(-1);
		expect(envAt).toBeLessThan(gateAt);

		// G1 says `notFound()`, and the distinction matters: a REDIRECT to the
		// admin login would confirm the page exists, which is the one thing
		// production must not do. It has to sit between the two call sites, so
		// the environment's refusal lands before the admin gate is reached.
		expect(stripped.slice(envAt, gateAt)).toMatch(/\bnotFound\(/);

		// The page's first `await` is `connection()`, and it MUST be: it keeps
		// the page out of the build-time prerender (measured: without it the route
		// listed as `○ Static`, its answer fixed when the image was built). The
		// runtime READ itself is gate.ts's computed-key access, pinned in
		// gate.test.ts. `connection()` loads and renders nothing, so "nothing
		// reaches a production visitor before the 404" still holds — and the next
		// await is the admin gate.
		const page = stripComments(sourceOf("page.tsx"));
		expect(firstAwaitTarget(sourceOf("page.tsx"))).toBe("connection");
		const connectionAt = page.indexOf("await connection(");
		expect(connectionAt).toBeGreaterThan(-1);
		expect(connectionAt).toBeLessThan(envAt);
		const awaits = [...page.matchAll(/\bawait\s+([A-Za-z_$][\w$]*)\s*\(/g)].map(
			(m) => m[1],
		);
		expect(awaits.slice(0, 2)).toEqual(["connection", "requireAdminPage"]);
	});
});
