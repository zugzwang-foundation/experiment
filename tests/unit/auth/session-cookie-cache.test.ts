import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// ADR-0057 — the session cookie cache, and the property that makes it safe.
//
// ⛔ WHY THIS IS A SOURCE SCAN. What has to stay true is a RELATIONSHIP between
// two files that no single behavioural test observes: sessions may be served
// from a cookie for a bounded window ONLY because every write re-reads the user
// row from Postgres inside the request. Enabling the cache is one line; removing
// the ban re-read is one line somewhere else, and either alone is fine while the
// PAIR is what would let a banned participant keep betting. Nothing else in the
// repo records that those two lines are load-bearing for each other.
//
// The exposure the cache accepts is CHROME — a revoked session still rendering
// as signed-in until the cached copy expires. The exposure it must never accept
// is ACTION. These tests pin the second.

const read = (rel: string) => readFileSync(join(process.cwd(), rel), "utf8");

const AUTH = "src/server/auth/index.ts";
const BET_ENDPOINT = "src/server/bets/endpoint.ts";

describe("ADR-0057 — session cookie cache", () => {
	it("is enabled, and bounded by a named constant rather than a literal", () => {
		const src = read(AUTH);
		expect(src).toMatch(/cookieCache:\s*\{/);
		expect(src).toMatch(/enabled:\s*true/);
		// Bound to the constant so the window is tunable in one place and the
		// docblock explaining the trade sits next to it.
		expect(src).toMatch(/maxAge:\s*SESSION_COOKIE_CACHE_MAX_AGE_SEC/);
		expect(src).toMatch(/const SESSION_COOKIE_CACHE_MAX_AGE_SEC = \d+;/);
	});

	it("the cached window is minutes, not hours", () => {
		// ⚠ AN UPPER BOUND, NOT A PIN. The value is a judgement call and may move;
		// what may NOT happen quietly is it growing into the hours, because the
		// window is exactly how long a revoked session keeps rendering as
		// signed-in. An hour of stale chrome is a different decision from five
		// minutes and should require editing this line to say so.
		const m = /const SESSION_COOKIE_CACHE_MAX_AGE_SEC = (\d+);/.exec(
			read(AUTH),
		);
		expect(m).not.toBeNull();
		const seconds = Number(m?.[1] ?? 0);
		expect(seconds).toBeGreaterThan(0);
		expect(seconds).toBeLessThanOrEqual(15 * 60);
	});

	it("⛔ the bet path still re-reads the user row — a ban is NOT cacheable", () => {
		// THE LOAD-BEARING ONE. `runBetEndpoint` must read `bannedAt` from the
		// database within the request, never from the session payload. With the
		// cookie cache on, a session says whatever it said up to
		// SESSION_COOKIE_CACHE_MAX_AGE_SEC ago — so if this read were ever sourced
		// from the session instead, a banned participant would keep betting for the
		// length of the window. Every write path shares this prefix, so pinning it
		// here covers bet, sell, post and reply at once.
		const src = read(BET_ENDPOINT);
		expect(src).toMatch(/db\.query\.users\.findFirst/);
		expect(src).toMatch(/bannedAt:\s*true/);
		expect(src).toMatch(/user\?\.bannedAt\s*!=\s*null/);

		// …and it is read from the DB row, never from the session object.
		expect(src).not.toMatch(/session[^\n]*\.bannedAt/);
	});

	it("session CREATION is unaffected — the onboarding gate still reads Postgres", () => {
		// `session.create.before` runs when a session is minted, which the cookie
		// cache never touches (it caches READS). Pinned so a future reader does not
		// conclude that "sessions are cached now" licenses trusting a cached
		// pseudonym/tos state at creation time.
		const gate = read("src/server/auth/session-gate.ts");
		expect(gate).toMatch(/users\.id/);
		expect(gate).toMatch(/pseudonym:\s*true/);
		expect(gate).toMatch(/tosAcceptedAt:\s*true/);
	});
});
