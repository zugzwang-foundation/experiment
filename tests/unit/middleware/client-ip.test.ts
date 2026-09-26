import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	CF_ORIGIN_AUTH_HEADER,
	getClientIp,
	getRequestClientIp,
	isCloudflareIp,
	normalizeIp,
	TRUSTED_CLIENT_IP_HEADER,
	withTrustedClientIp,
} from "@/server/middleware/client-ip";

/**
 * S-1 / ADR-0061 — the trusted client-IP derivation, Cloudflare → ALB → ECS
 * (and Vercel until the cutover).
 *
 * ⛔ The attacker controls every header except the one our own edge wrote. On
 * AWS that is the LAST X-Forwarded-For hop (the ALB's append); on Vercel it is
 * `x-real-ip`. Each "spoof" row below sends the forged value in exactly the
 * place the old code trusted (first XFF hop) or the place a naive fix would
 * trust (CF-Connecting-IP), and asserts the forged value never comes back.
 */

const CF_EDGE_V4 = "162.158.10.20"; // inside 162.158.0.0/15
const CF_EDGE_V6 = "2606:4700:10::6816:1"; // inside 2606:4700::/32
const CLIENT_V4 = "203.0.113.7";
const CLIENT_V6 = "2001:db8::42";
const ATTACKER = "198.51.100.66";
const FORGED = "1.2.3.4";

function h(headers: Record<string, string>) {
	const map = new Map(
		Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]),
	);
	return (name: string) => map.get(name.toLowerCase()) ?? null;
}

beforeEach(() => {
	vi.stubEnv("VERCEL", "");
	vi.stubEnv("ZZ_CF_ORIGIN_SECRET", "");
});
afterEach(() => {
	vi.unstubAllEnvs();
});

describe("normal Cloudflare-proxied requests (AWS: Cloudflare → ALB)", () => {
	it("IPv4 client via an IPv4 edge → CF-Connecting-IP", () => {
		expect(
			getClientIp(
				h({
					"x-forwarded-for": `${CLIENT_V4}, ${CF_EDGE_V4}`,
					"cf-connecting-ip": CLIENT_V4,
				}),
			),
		).toBe(CLIENT_V4);
	});

	it("IPv6 client via an IPv6 edge → CF-Connecting-IP", () => {
		expect(
			getClientIp(
				h({
					"x-forwarded-for": `${CLIENT_V6}, ${CF_EDGE_V6}`,
					"cf-connecting-ip": CLIENT_V6,
				}),
			),
		).toBe(CLIENT_V6);
	});

	it("IPv6 client via an IPv4 edge → CF-Connecting-IP", () => {
		expect(
			getClientIp(
				h({
					"x-forwarded-for": `${CLIENT_V6}, ${CF_EDGE_V4}`,
					"cf-connecting-ip": CLIENT_V6,
				}),
			),
		).toBe(CLIENT_V6);
	});

	it("covers the edges of the published ranges", () => {
		expect(isCloudflareIp("173.245.48.0")).toBe(true);
		expect(isCloudflareIp("173.245.63.255")).toBe(true);
		expect(isCloudflareIp("173.245.64.0")).toBe(false);
		expect(isCloudflareIp("104.23.255.255")).toBe(true); // 104.16.0.0/13
		expect(isCloudflareIp("104.27.255.255")).toBe(true); // 104.24.0.0/14
		expect(isCloudflareIp("104.28.0.1")).toBe(false);
		expect(isCloudflareIp("2a06:98c7:ffff::1")).toBe(true); // /29
		expect(isCloudflareIp("2a06:98c8::1")).toBe(false);
		expect(isCloudflareIp("10.0.0.1")).toBe(false);
		expect(isCloudflareIp("not-an-ip")).toBe(false);
	});
});

describe("spoofed X-Forwarded-For", () => {
	it("through Cloudflare: forged hops before the edge are ignored", () => {
		// Cloudflare appends the real client to the client's own XFF; the ALB
		// appends the edge. The forged first hop is what the old code returned.
		expect(
			getClientIp(
				h({
					"x-forwarded-for": `${FORGED}, ${CLIENT_V4}, ${CF_EDGE_V4}`,
					"cf-connecting-ip": CLIENT_V4,
				}),
			),
		).toBe(CLIENT_V4);
	});

	it("direct to the ALB: a forged chain resolves to the real peer", () => {
		expect(
			getClientIp(h({ "x-forwarded-for": `${FORGED}, 10.0.0.1, ${ATTACKER}` })),
		).toBe(ATTACKER);
	});

	it("duplicate XFF header LINES are read joined, last value last (ADR-0061 A6)", () => {
		// `@code-reviewer` HIGH-1. A real Headers joins repeated lines in arrival
		// order, so the helper sees the LAST value of the LAST line. That is only
		// the ALB's append if the ALB appends to (or after) the client's final
		// line — assumption A6, to be measured live before launch. This row pins
		// what the helper does with the joined value; it cannot prove A6.
		const headers = new Headers();
		headers.append("x-forwarded-for", FORGED);
		headers.append("x-forwarded-for", `${CLIENT_V4}, ${ATTACKER}`);
		expect(headers.get("x-forwarded-for")).toBe(
			`${FORGED}, ${CLIENT_V4}, ${ATTACKER}`,
		);
		expect(getRequestClientIp({ headers })).toBe(ATTACKER);
	});

	it("direct to the ALB: a forged Cloudflare address in the chain buys nothing", () => {
		expect(
			getClientIp(
				h({
					"x-forwarded-for": `${CF_EDGE_V4}, ${ATTACKER}`,
					"cf-connecting-ip": FORGED,
				}),
			),
		).toBe(ATTACKER);
	});

	it("rotating the forged value never rotates the answer (rate-limit key is stable)", () => {
		const keys = new Set(
			["1.1.1.1", "2.2.2.2", "3.3.3.3", "::1"].map((forged) =>
				getClientIp(
					h({
						"x-forwarded-for": `${forged}, ${ATTACKER}`,
						"cf-connecting-ip": forged,
					}),
				),
			),
		);
		expect([...keys]).toEqual([ATTACKER]);
	});
});

describe("missing / malformed Cloudflare client IP", () => {
	it("edge peer, no CF-Connecting-IP → the edge address, never a client hop", () => {
		expect(
			getClientIp(h({ "x-forwarded-for": `${FORGED}, ${CF_EDGE_V4}` })),
		).toBe(CF_EDGE_V4);
	});

	it.each([
		"",
		"garbage",
		"1.2.3.4:443",
		"[2001:db8::1]",
		"1.2.3.4, 5.6.7.8",
		"fe80::1%eth0",
		"999.1.1.1",
	])("edge peer, invalid CF-Connecting-IP %j → the edge address", (bad) => {
		expect(
			getClientIp(
				h({
					"x-forwarded-for": `${CLIENT_V4}, ${CF_EDGE_V4}`,
					"cf-connecting-ip": bad,
				}),
			),
		).toBe(CF_EDGE_V4);
	});
});

describe("direct / untrusted requests", () => {
	it("direct to the ALB with a forged CF-Connecting-IP → the peer", () => {
		expect(
			getClientIp(
				h({ "x-forwarded-for": ATTACKER, "cf-connecting-ip": FORGED }),
			),
		).toBe(ATTACKER);
	});

	it("direct IPv6 peer with a forged CF-Connecting-IP → the peer", () => {
		expect(
			getClientIp(
				h({ "x-forwarded-for": CLIENT_V6, "cf-connecting-ip": FORGED }),
			),
		).toBe(CLIENT_V6);
	});

	it("a client-sent x-real-ip is ignored off Vercel", () => {
		expect(getClientIp(h({ "x-real-ip": FORGED }))).toBeNull();
	});

	it("CF-Connecting-IP alone (no ALB hop) is not trusted", () => {
		expect(getClientIp(h({ "cf-connecting-ip": FORGED }))).toBeNull();
	});

	it("no headers → null, never a fabricated address", () => {
		expect(getClientIp(h({}))).toBeNull();
	});

	it("an unparsable last hop → null (not a fall-back to an earlier hop)", () => {
		expect(
			getClientIp(h({ "x-forwarded-for": `${CLIENT_V4}, not-an-ip` })),
		).toBeNull();
		expect(getClientIp(h({ "x-forwarded-for": `${CLIENT_V4}, ` }))).toBeNull();
	});
});

describe("Vercel (VERCEL=1): peer is Vercel's x-real-ip", () => {
	beforeEach(() => {
		vi.stubEnv("VERCEL", "1");
	});

	it("uses x-real-ip, ignoring a forged XFF last hop", () => {
		expect(
			getClientIp(h({ "x-real-ip": CLIENT_V4, "x-forwarded-for": FORGED })),
		).toBe(CLIENT_V4);
	});

	it("never reads CF-Connecting-IP, even from a Cloudflare-range peer (@security-auditor H-1)", () => {
		// *.vercel.app is public: a request from WARP / a Worker / another zone
		// has a Cloudflare source address and a header it chose. Today's
		// production keys on Vercel's x-real-ip; S-1 must not change that.
		expect(
			getClientIp(h({ "x-real-ip": CF_EDGE_V4, "cf-connecting-ip": FORGED })),
		).toBe(CF_EDGE_V4);
	});

	it("ignores the origin-auth header on Vercel too", () => {
		vi.stubEnv("ZZ_CF_ORIGIN_SECRET", "s3cret");
		expect(
			getClientIp(
				h({
					"x-real-ip": CF_EDGE_V4,
					"cf-connecting-ip": FORGED,
					[CF_ORIGIN_AUTH_HEADER]: "s3cret",
				}),
			),
		).toBe(CF_EDGE_V4);
	});

	it("direct to Vercel with a forged CF-Connecting-IP → x-real-ip", () => {
		expect(
			getClientIp(h({ "x-real-ip": ATTACKER, "cf-connecting-ip": FORGED })),
		).toBe(ATTACKER);
	});
});

describe("origin authentication — ZZ_CF_ORIGIN_SECRET set (ADR-0061 F1)", () => {
	const via = (extra: Record<string, string>) =>
		getClientIp(
			h({
				"x-forwarded-for": `${CLIENT_V4}, ${CF_EDGE_V4}`,
				"cf-connecting-ip": CLIENT_V4,
				...extra,
			}),
		);

	beforeEach(() => {
		vi.stubEnv("ZZ_CF_ORIGIN_SECRET", "our-zone-secret");
	});

	it("our zone (correct header) → CF-Connecting-IP", () => {
		expect(via({ [CF_ORIGIN_AUTH_HEADER]: "our-zone-secret" })).toBe(CLIENT_V4);
	});

	it("another Cloudflare tenant (no header) → the edge address, not its chosen IP", () => {
		expect(via({ "cf-connecting-ip": FORGED })).toBe(CF_EDGE_V4);
	});

	it.each([
		"wrong",
		"our-zone-secre",
		"our-zone-secretX",
		"",
	])("wrong header %j → the edge address", (value) => {
		expect(
			via({ "cf-connecting-ip": FORGED, [CF_ORIGIN_AUTH_HEADER]: value }),
		).toBe(CF_EDGE_V4);
	});

	it("the header does not rescue a non-Cloudflare peer", () => {
		expect(
			getClientIp(
				h({
					"x-forwarded-for": ATTACKER,
					"cf-connecting-ip": FORGED,
					[CF_ORIGIN_AUTH_HEADER]: "our-zone-secret",
				}),
			),
		).toBe(ATTACKER);
	});

	it("positive control: with the secret UNSET, a Cloudflare peer is trusted (the pre-F1 window)", () => {
		vi.stubEnv("ZZ_CF_ORIGIN_SECRET", "");
		expect(via({ "cf-connecting-ip": FORGED })).toBe(FORGED);
	});
});

describe("normalizeIp — IPv4/IPv6 forms", () => {
	it("unwraps IPv4-mapped IPv6 so one client has one key", () => {
		expect(normalizeIp("::ffff:203.0.113.7")).toBe("203.0.113.7");
		expect(
			getClientIp(
				h({
					"x-forwarded-for": `::ffff:${CF_EDGE_V4}`,
					"cf-connecting-ip": CLIENT_V4,
				}),
			),
		).toBe(CLIENT_V4);
	});

	it("lower-cases IPv6 and trims whitespace", () => {
		expect(normalizeIp("  2001:DB8::42 ")).toBe("2001:db8::42");
	});

	it.each([
		null,
		undefined,
		"",
		"  ",
		"a.b.c.d",
		"1.2.3",
		"1.2.3.4/32",
	])("rejects %j", (bad) => {
		expect(normalizeIp(bad)).toBeNull();
	});
});

describe("withTrustedClientIp — the Better Auth stamp", () => {
	it("overwrites a client-sent stamp with the trusted value", () => {
		const request = new Request("https://example.com/api/auth/x", {
			headers: {
				[TRUSTED_CLIENT_IP_HEADER]: FORGED,
				"x-forwarded-for": `${FORGED}, ${ATTACKER}`,
			},
		});
		expect(
			withTrustedClientIp(request).headers.get(TRUSTED_CLIENT_IP_HEADER),
		).toBe(ATTACKER);
	});

	it("deletes a client-sent stamp when there is no trusted value", () => {
		const request = new Request("https://example.com/api/auth/x", {
			headers: { [TRUSTED_CLIENT_IP_HEADER]: FORGED },
		});
		expect(
			withTrustedClientIp(request).headers.has(TRUSTED_CLIENT_IP_HEADER),
		).toBe(false);
	});

	it("preserves method and body", async () => {
		const request = new Request("https://example.com/api/auth/x", {
			method: "POST",
			body: '{"a":1}',
			headers: { "x-forwarded-for": CLIENT_V4 },
		});
		const wrapped = withTrustedClientIp(request);
		expect(wrapped.method).toBe("POST");
		expect(await wrapped.text()).toBe('{"a":1}');
		expect(getRequestClientIp(wrapped)).toBe(CLIENT_V4);
	});
});
