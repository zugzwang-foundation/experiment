import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";
import { BlockList, isIP } from "node:net";

/**
 * S-1 / ADR-0061 — the ONE place the client's IP address is derived.
 *
 * Topology as designed: browser → Cloudflare → ALB → ECS task (and, until the
 * cutover, → Vercel). ⚠ Measured 2026-09-26: the zone is DNS-only (grey
 * cloud), so today browsers reach the ALB (and Vercel) DIRECTLY and the
 * Cloudflare branch below is closed (see `fromOurCloudflareZone`). Every per-IP control in the
 * app (admin-login brute-force limit, OTP-send limit, bet/upload/visit limits)
 * and every `ip` written into an append-only event row reads THIS function.
 *
 * ⛔ THE CLIENT CONTROLS EVERY HEADER EXCEPT THE ONE OUR OWN EDGE WROTE. So the
 * derivation starts from the address that actually opened the connection to
 * our infrastructure — the PEER — which only our own edge can state:
 *
 *   - AWS: the ALB (xff_header_processing.mode = append, the default) appends
 *     the address it accepted the connection from to `X-Forwarded-For`. The
 *     service security group admits only the ALB, so the LAST entry is the
 *     ALB's own statement; every entry before it is whatever the client sent.
 *   - Vercel (`VERCEL=1`): Vercel overwrites `x-real-ip` with the connecting
 *     address, whatever the client sent. ⛔ On Vercel that is the WHOLE answer
 *     — exactly today's production behaviour. `CF-Connecting-IP` is NEVER
 *     read there: the `*.vercel.app` hostname is publicly reachable, and a
 *     request sourced from ANY Cloudflare address (WARP, a Worker, someone
 *     else's zone) could otherwise choose it (`@security-auditor` H-1).
 *
 * AWS only: `CF-Connecting-IP` is believed ONLY when the peer is inside
 * Cloudflare's published ranges AND `ZZ_CF_ORIGIN_SECRET` is configured AND
 * the request carries our zone's origin-auth header (ADR-0061 F1). Unset, the
 * branch is closed. A Cloudflare
 * ADDRESS is not OUR Cloudflare ZONE: millions of unrelated parties can source
 * traffic from those ranges. A request sent straight to the ALB can carry any
 * `CF-Connecting-IP` and any `X-Forwarded-For` chain it likes; it is
 * attributed to its peer, which it cannot forge.
 *
 * Returns `null` when no trustworthy address exists; each call site keeps its
 * own fallback (`"unknown"` or `null`), unchanged from before S-1.
 *
 * ⚠ Do NOT move this into `proxy.ts` and pass it down in a header: the proxy
 * went unbuilt for the project's whole life (AWS-MIGRATION-3), and a header
 * the proxy is supposed to overwrite is a header the client sets whenever the
 * proxy is not running.
 */

/**
 * Cloudflare's published edge ranges — https://www.cloudflare.com/ips-v4 and
 * https://www.cloudflare.com/ips-v6, fetched 2026-09-26. The list changes
 * rarely; ADR-0061 records the refresh obligation. A range missing here fails
 * SAFE: requests via that edge are attributed to the Cloudflare edge address
 * (per-IP limits become coarser), never to a client-chosen value.
 */
export const CLOUDFLARE_IPV4_RANGES: readonly string[] = [
	"173.245.48.0/20",
	"103.21.244.0/22",
	"103.22.200.0/22",
	"103.31.4.0/22",
	"141.101.64.0/18",
	"108.162.192.0/18",
	"190.93.240.0/20",
	"188.114.96.0/20",
	"197.234.240.0/22",
	"198.41.128.0/17",
	"162.158.0.0/15",
	"104.16.0.0/13",
	"104.24.0.0/14",
	"172.64.0.0/13",
	"131.0.72.0/22",
];

export const CLOUDFLARE_IPV6_RANGES: readonly string[] = [
	"2400:cb00::/32",
	"2606:4700::/32",
	"2803:f800::/32",
	"2405:b500::/32",
	"2405:8100::/32",
	"2a06:98c0::/29",
	"2c0f:f248::/32",
];

const cloudflare = new BlockList();
for (const cidr of CLOUDFLARE_IPV4_RANGES) {
	const [net, prefix] = cidr.split("/");
	cloudflare.addSubnet(net, Number(prefix), "ipv4");
}
for (const cidr of CLOUDFLARE_IPV6_RANGES) {
	const [net, prefix] = cidr.split("/");
	cloudflare.addSubnet(net, Number(prefix), "ipv6");
}

/**
 * ADR-0061 F1 — the header a Cloudflare Transform Rule on OUR zone adds, whose
 * value is the runtime secret `ZZ_CF_ORIGIN_SECRET`. Only our zone can add it,
 * so it distinguishes our Cloudflare from anyone else's.
 */
export const CF_ORIGIN_AUTH_HEADER = "x-zz-cf-origin-auth";

/**
 * Whether this request came through OUR Cloudflare zone. ⛔ FAILS CLOSED: with
 * `ZZ_CF_ORIGIN_SECRET` unset this returns false, so `CF-Connecting-IP` is
 * never believed and a Cloudflare-range peer is keyed on its own address. That
 * is the right answer for a DNS-only (grey-cloud) zone — measured 2026-09-26:
 * neither hostname is proxied, so the only Cloudflare-range peers reaching the
 * ALB are WARP users and Workers choosing their own header. It flipped from
 * "trust when unset" at the production-readiness pass (ADR-0061 R1). With the
 * secret set, the header must match (constant-time over SHA-256 digests, so
 * length leaks nothing).
 */
function fromOurCloudflareZone(get: HeaderGetter): boolean {
	const secret = process.env.ZZ_CF_ORIGIN_SECRET;
	if (!secret) return false;
	const presented = get(CF_ORIGIN_AUTH_HEADER);
	if (typeof presented !== "string" || presented.length === 0) return false;
	const digest = (v: string) => createHash("sha256").update(v).digest();
	return timingSafeEqual(digest(presented), digest(secret));
}

/** The header the auth route stamps for Better Auth (`advanced.ipAddress`). */
export const TRUSTED_CLIENT_IP_HEADER = "x-zz-client-ip";

export type HeaderGetter = (name: string) => string | null | undefined;

/**
 * A bare IPv4/IPv6 literal, or null. Rejects ports, brackets, zone ids and
 * anything else `net.isIP` does not accept; unwraps IPv4-mapped IPv6
 * (`::ffff:203.0.113.7` → `203.0.113.7`) so one client has one key.
 */
export function normalizeIp(raw: string | null | undefined): string | null {
	if (typeof raw !== "string") return null;
	const value = raw.trim();
	if (value.length === 0 || value.includes("%")) return null;
	const version = isIP(value);
	if (version === 0) return null;
	if (version === 6) {
		const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(value);
		const v4 = mapped?.[1];
		if (v4 && isIP(v4) === 4) return v4;
		return value.toLowerCase();
	}
	return value;
}

export function isCloudflareIp(ip: string): boolean {
	const version = isIP(ip);
	if (version === 4) return cloudflare.check(ip, "ipv4");
	if (version === 6) return cloudflare.check(ip, "ipv6");
	return false;
}

/**
 * AWS: the address that opened the connection to the ALB — the LAST
 * `X-Forwarded-For` entry (the ALB's append; ADR-0061 A2/A6).
 */
function albPeerAddress(get: HeaderGetter): string | null {
	const forwarded = get("x-forwarded-for");
	if (typeof forwarded !== "string") return null;
	const hops = forwarded.split(",");
	return normalizeIp(hops[hops.length - 1]);
}

/** S-1 / ADR-0061 — the trusted client IP, or null. See the module docblock. */
export function getClientIp(get: HeaderGetter): string | null {
	if (process.env.VERCEL === "1") {
		// Vercel's own statement, and nothing else (H-1). Unchanged from today.
		return normalizeIp(get("x-real-ip"));
	}
	const peer = albPeerAddress(get);
	if (peer === null) return null;
	if (isCloudflareIp(peer) && fromOurCloudflareZone(get)) {
		// Our Cloudflare zone delivered this request, so it wrote this header.
		// If it is missing or malformed, the edge address is the most we know.
		return normalizeIp(get("cf-connecting-ip")) ?? peer;
	}
	return peer;
}

/** Convenience for a Fetch `Request` / `Headers`. */
export function getRequestClientIp(request: {
	headers: { get(name: string): string | null };
}): string | null {
	return getClientIp((name) => request.headers.get(name));
}

/**
 * S-1 / ADR-0061 — Better Auth reads the client IP (its built-in rate limiter,
 * `sessions.ip_address`) ONLY from `TRUSTED_CLIENT_IP_HEADER`
 * (`advanced.ipAddress` in auth/index.ts). `app/api/auth/[...all]/route.ts`
 * calls this for every HTTP request; it is the one place that header
 * is written for HTTP traffic: any client-sent value is DELETED, then the
 * trusted value from the shared helper is set when there is one. With no
 * trusted value the header is absent: Better Auth then records an empty
 * `ip_address` AND SKIPS ITS OWN RATE LIMIT for that request (ADR-0061 M-1;
 * unreachable while A1/A2/A5 hold). ⚠ Not idempotent — `new Request(request)`
 * consumes the input body, so call it exactly once per request.
 */
export function withTrustedClientIp(request: Request): Request {
	const headers = new Headers(request.headers);
	headers.delete(TRUSTED_CLIENT_IP_HEADER);
	const ip = getRequestClientIp(request);
	if (ip !== null) headers.set(TRUSTED_CLIENT_IP_HEADER, ip);
	return new Request(request, { headers });
}
