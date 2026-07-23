import { Ratelimit } from "@upstash/ratelimit";
import { isbot } from "isbot";

import { ipIdentifier } from "@/server/middleware/rate-limit";
import { getRedisKey } from "@/server/upstash/keys";
import { redis } from "@/server/upstash/redis";
import { incrementAndRead, read } from "@/server/visitors/counter";

// POST /api/visits — the visitor counter's increment endpoint (SPEC.1 §21.1).
// Public + unauthenticated; a vanity number, NOT a thesis signal. Order per the
// §21.1 abuse-guard: isbot(user-agent)? → per-IP cap? → INCR. A bot OR a capped
// caller gets the CURRENT total back (no increment), HTTP 200 — never a 429,
// never an error body: a vanity counter must not render an error because a
// crawler or a fast clicker hit it. A Redis outage returns { total: null } and
// the UI shows the P5 silent fallback. The IP and user-agent are read for the
// bot filter / rate-limit bucket and persisted NOWHERE, and never logged
// (ADR-0007 redaction discipline).

export const dynamic = "force-dynamic";

// Module-LOCAL per-IP sliding-window cap (SPEC.1 §21.1 scoped carve-out): this
// constant is deliberately NOT a §16.1 constant and NOT a SPEC.2 §11 row — §11
// governs thesis-bearing flows and this surface touches none. Its own Ratelimit
// instance with a distinct prefix keeps the §11 keyspace disjointness invariant
// (env-first per the getRedisKey convention).
const VISITS_PER_IP_PER_MIN = 60;

const visitsPerIp = new Ratelimit({
	redis,
	limiter: Ratelimit.slidingWindow(VISITS_PER_IP_PER_MIN, "1 m"),
	prefix: getRedisKey("ratelimit", "visits-ip"),
	analytics: false,
});

function extractIp(request: Request): string {
	const fwd = request.headers.get("x-forwarded-for");
	if (fwd) {
		const first = fwd.split(",")[0]?.trim();
		if (first) return first;
	}
	return "unknown";
}

export async function POST(request: Request): Promise<Response> {
	try {
		// 1. Bot filter — crawlers must not inflate the number.
		if (isbot(request.headers.get("user-agent") ?? "")) {
			return Response.json({ total: await read() });
		}

		// 2. Per-IP anti-abuse cap — over the cap, return the current total.
		const decision = await visitsPerIp.limit(ipIdentifier(extractIp(request)));
		if (!decision.success) {
			return Response.json({ total: await read() });
		}

		// 3. Count the visit.
		return Response.json({ total: await incrementAndRead() });
	} catch {
		// Redis unreachable (or any counter error) → the P5 silent-fallback
		// signal. Never a 5xx, never an error body.
		return Response.json({ total: null });
	}
}
