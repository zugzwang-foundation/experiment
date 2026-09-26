import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * AUTH-TRUSTED-IP-REQUEST — regression for the AWS staging auth outage
 * (2026-09-26): every `/api/auth/*` request returned 500 with
 * "Cannot read private member #state from an object whose class did not
 * declare it".
 *
 * An App Router route handler does NOT receive a `NextRequest`. For a route
 * with `dynamic` unset, Next 16.3.2 hands it `proxyNextRequest(req)` — a
 * `Proxy` around the `NextRequest` whose `get` trap forwards with the TARGET as
 * receiver (`next/dist/server/route-modules/app-route/module.js`). Reading
 * fields through it works; `new Request(proxy, init)` does not under Node 24's
 * undici 7, whose `Request` keeps its state in a true `#state` private field
 * that no Proxy passes through. Node 22 (undici 6) used symbol-keyed internals,
 * which is why the defect never reproduced locally — so the "old form throws"
 * control below only runs where undici is >= 7 (CI and the container, Node 24).
 */

vi.mock("@/server/auth", () => ({
	auth: {
		handler: vi.fn(async () => new Response("ok", { status: 200 })),
	},
}));

import { GET, POST } from "@/app/api/auth/[...all]/route";
import { auth } from "@/server/auth";
import {
	TRUSTED_CLIENT_IP_HEADER,
	withTrustedClientIp,
} from "@/server/middleware/client-ip";

const BASE = "https://staging.zugzwangworld.com";
const CLIENT = "203.0.113.7";

/** The exact handler shape of Next 16.3.2's `proxyNextRequest`. */
function asRouteHandlerSees(request: NextRequest): Request {
	return new Proxy(request, {
		get: (target, prop) => Reflect.get(target, prop, target),
	});
}

function getRequest(): Request {
	return asRouteHandlerSees(
		new NextRequest(`${BASE}/api/auth/ok`, {
			headers: {
				// ALB-appended last hop is the peer (ADR-0061); the client-sent
				// stamp must be discarded.
				"x-forwarded-for": `198.51.100.1, ${CLIENT}`,
				[TRUSTED_CLIENT_IP_HEADER]: "6.6.6.6",
			},
		}),
	);
}

function postRequest(): Request {
	return asRouteHandlerSees(
		new NextRequest(`${BASE}/api/auth/email-otp/send-verification-otp`, {
			method: "POST",
			body: JSON.stringify({ email: "a@example.invalid", type: "sign-in" }),
			headers: {
				"content-type": "application/json",
				"x-forwarded-for": CLIENT,
			},
		}),
	);
}

const undiciMajor = Number(
	(process.versions as Record<string, string | undefined>).undici?.split(
		".",
	)[0] ?? 0,
);

beforeEach(() => {
	vi.stubEnv("VERCEL", "");
	vi.stubEnv("ZZ_CF_ORIGIN_SECRET", "");
});
afterEach(() => {
	vi.unstubAllEnvs();
	vi.mocked(auth.handler).mockClear();
});

describe("the route-handler request is a Proxy around NextRequest", () => {
	it("Next 16.3.2 still wraps route requests in proxyNextRequest (target as receiver)", () => {
		// If Next changes this shape, the harness above stops being faithful —
		// fail loudly rather than keep certifying the old shape.
		const nextDir = dirname(require.resolve("next/package.json"));
		const module = readFileSync(
			join(nextDir, "dist/server/route-modules/app-route/module.js"),
			"utf8",
		);
		expect(module).toContain("request = proxyNextRequest(req, workStore);");
		expect(module).toContain("return new Proxy(request, nextRequestHandlers);");
		expect(module).toContain(
			"return _reflect.ReflectAdapter.get(target, prop, target);",
		);
	});

	it.runIf(undiciMajor >= 7)(
		"control: the OLD construction, new Request(proxy, init), throws the production error",
		() => {
			const request = getRequest();
			expect(
				() => new Request(request, { headers: new Headers(request.headers) }),
			).toThrow(/private member #state/);
		},
	);
});

describe("withTrustedClientIp accepts the route-handler request", () => {
	it("GET: does not throw, keeps method and URL, stamps the trusted IP", () => {
		const out = withTrustedClientIp(getRequest());
		expect(out.method).toBe("GET");
		expect(out.url).toBe(`${BASE}/api/auth/ok`);
		// Client-sent stamp discarded; the ALB's last hop stamped.
		expect(out.headers.get(TRUSTED_CLIENT_IP_HEADER)).toBe(CLIENT);
	});

	it("POST: does not throw and carries the body through unchanged", async () => {
		const out = withTrustedClientIp(postRequest());
		expect(out.method).toBe("POST");
		expect(out.headers.get("content-type")).toBe("application/json");
		expect(out.headers.get(TRUSTED_CLIENT_IP_HEADER)).toBe(CLIENT);
		expect(JSON.parse(await out.text())).toEqual({
			email: "a@example.invalid",
			type: "sign-in",
		});
	});
});

describe("the auth route handler itself (app/api/auth/[...all]/route.ts)", () => {
	it("GET /api/auth/ok reaches Better Auth instead of throwing", async () => {
		const response = await GET(getRequest());
		expect(response.status).toBe(200);
		const handed = vi.mocked(auth.handler).mock.calls[0]?.[0] as Request;
		expect(handed.headers.get(TRUSTED_CLIENT_IP_HEADER)).toBe(CLIENT);
	});

	it("POST send-verification-otp reaches Better Auth with its body", async () => {
		const response = await POST(postRequest());
		expect(response.status).toBe(200);
		const handed = vi.mocked(auth.handler).mock.calls[0]?.[0] as Request;
		expect(handed.method).toBe("POST");
		expect(JSON.parse(await handed.text())).toEqual({
			email: "a@example.invalid",
			type: "sign-in",
		});
	});
});
