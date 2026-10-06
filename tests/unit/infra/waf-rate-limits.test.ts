import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { productionConfig } from "../../../infra/config/production";
import { stagingConfig } from "../../../infra/config/staging";
import {
	DEFAULT_WAF_RATE_LIMITS,
	RATE_LIMITED_BODY_KEY,
	RATE_LIMITED_RESPONSE_BODIES,
	WAF_RATE_WINDOW_SECONDS,
	wafRateLimitRules,
} from "../../../infra/lib/waf-rate-limits";

// WAF-RATE-1 — the per-IP abuse limits.
//
// ⚠ WHAT THIS FILE CAN AND CANNOT PROVE. It asserts the rules we hand to AWS
// (values, window, per-IP key, 429 response) and, through a small evaluator of
// the only statement types those rules use, WHICH ROUTES each rule counts. The
// over/under-the-limit cases run that evaluator through a model of AWS WAF's
// documented rate-based behaviour (per-IP request count over a trailing
// 5-minute window; requests beyond the limit are blocked). It is a model, not
// AWS: the live proof is the staging rehearsal in the PR description, which
// sends real requests to a WAF and reads the status codes.

// Local structural views of the rule data, so this root-level test does not
// need `aws-cdk-lib` (a dependency of `infra/` only).
type Statement = {
	byteMatchStatement?: { positionalConstraint: string; searchString: string };
	regexMatchStatement?: { regexString: string };
	notStatement?: { statement: Statement };
	orStatement?: { statements: Statement[] };
};
type RateBased = {
	limit: number;
	evaluationWindowSec: number;
	aggregateKeyType: string;
	scopeDownStatement: Statement;
};
type Rule = {
	name: string;
	priority: number;
	statement: { rateBasedStatement: RateBased };
	action: {
		count?: Record<string, never>;
		block?: {
			customResponse: {
				responseCode: number;
				customResponseBodyKey: string;
				responseHeaders: { name: string; value: string }[];
			};
		};
	};
};

const RULES = wafRateLimitRules(DEFAULT_WAF_RATE_LIMITS) as unknown as Rule[];

/** Evaluates the four statement shapes the rate rules are built from. */
function matches(statement: Statement, path: string): boolean {
	if (statement.byteMatchStatement) {
		expect(statement.byteMatchStatement.positionalConstraint).toBe(
			"STARTS_WITH",
		);
		return path.startsWith(statement.byteMatchStatement.searchString);
	}
	if (statement.regexMatchStatement) {
		return new RegExp(statement.regexMatchStatement.regexString).test(path);
	}
	if (statement.notStatement) {
		return !matches(statement.notStatement.statement, path);
	}
	if (statement.orStatement) {
		return statement.orStatement.statements.some((x) => matches(x, path));
	}
	throw new Error(`unsupported statement: ${JSON.stringify(statement)}`);
}

const rateOf = (rule: Rule): RateBased => rule.statement.rateBasedStatement;

/** The rules that COUNT a request for this path (the URI path, no query). */
function countingRules(path: string): string[] {
	return RULES.filter((r) => matches(rateOf(r).scopeDownStatement, path)).map(
		(r) => r.name,
	);
}

/**
 * A model of AWS WAF rate-based rules over a trailing window, per IP: every
 * request is counted by each rule whose scope matches; a request is blocked
 * (429) when, counting it, any matching rule's count for that IP over the
 * last `WAF_RATE_WINDOW_SECONDS` exceeds its limit.
 */
function simulate() {
	const seen = new Map<string, number[]>(); // `${rule}|${ip}` → timestamps
	return (ip: string, path: string, atSec: number): 200 | 429 => {
		let blocked = false;
		for (const rule of RULES) {
			const rb = rateOf(rule);
			if (!matches(rb.scopeDownStatement, path)) continue;
			const key = `${rule.name}|${ip}`;
			const window = (seen.get(key) ?? []).filter(
				(t) => t > atSec - WAF_RATE_WINDOW_SECONDS,
			);
			window.push(atSec);
			seen.set(key, window);
			if (window.length > Number(rb.limit)) blocked = true;
		}
		return blocked ? 429 : 200;
	};
}

describe("waf-rate-limits — what we hand to AWS", () => {
	it("uses the verified values, a 5-minute window and a per-IP key", () => {
		expect(DEFAULT_WAF_RATE_LIMITS).toEqual({
			dynamicPerIp: 1_000,
			staticPerIp: 5_000,
			authPerIp: 100,
			exportPerIp: 30,
			action: "block",
		});
		const byName = Object.fromEntries(RULES.map((r) => [r.name, r]));
		expect(Object.keys(byName)).toEqual([
			"rate-limit-auth",
			"rate-limit-export",
			"rate-limit-dynamic",
			"rate-limit-static",
		]);
		const limits = RULES.map((r) => rateOf(r).limit);
		expect(limits).toEqual([100, 30, 1_000, 5_000]);
		for (const rule of RULES) {
			expect(rateOf(rule).evaluationWindowSec).toBe(300);
			expect(rateOf(rule).aggregateKeyType).toBe("IP");
		}
	});

	it("blocks with 429, a Retry-After header and a plain-text body", () => {
		for (const rule of RULES) {
			const response = rule.action.block?.customResponse;
			expect(response?.responseCode).toBe(429);
			expect(response?.customResponseBodyKey).toBe(RATE_LIMITED_BODY_KEY);
			expect(response?.responseHeaders).toEqual([
				{ name: "Retry-After", value: "300" },
			]);
		}
		expect(RATE_LIMITED_RESPONSE_BODIES[RATE_LIMITED_BODY_KEY]).toMatchObject({
			contentType: "TEXT_PLAIN",
		});
	});

	it("count mode never blocks (for a rehearsal)", () => {
		const counted = wafRateLimitRules({
			...DEFAULT_WAF_RATE_LIMITS,
			action: "count",
		});
		for (const rule of counted) {
			expect(rule.action).toEqual({ count: {} });
		}
	});

	it("production and staging carry the same values; staging stays unattached by default", () => {
		expect(productionConfig.wafRateLimits).toEqual(DEFAULT_WAF_RATE_LIMITS);
		expect(productionConfig.wafLogging).toBe(true);
		expect(stagingConfig.wafRateLimits).toEqual(DEFAULT_WAF_RATE_LIMITS);
		// Unchanged: staging attaches a WAF only when a rehearsal asks for one.
		const src = readFileSync(
			join(__dirname, "..", "..", "..", "infra", "config", "staging.ts"),
			"utf8",
		);
		expect(src).toMatch(/wafEnabled: process\.env\.ZZ_STAGING_WAF === "count"/);
	});

	it("the rate rules run before the managed rule set", () => {
		const src = readFileSync(
			join(__dirname, "..", "..", "..", "infra", "lib", "compute-stack.ts"),
			"utf8",
		);
		expect(src).toMatch(
			/name: "AWSManagedRulesCommonRuleSet",\s*priority: 10,/,
		);
		expect(Math.max(...RULES.map((r) => Number(r.priority)))).toBeLessThan(10);
	});
});

describe("waf-rate-limits — which routes each limit applies to", () => {
	const cases: [string, string[]][] = [
		// sign-in and admin login: their own limit, and the general one
		["/api/auth/sign-in/social", ["rate-limit-auth", "rate-limit-dynamic"]],
		[
			"/api/auth/email-otp/send-verification-otp",
			["rate-limit-auth", "rate-limit-dynamic"],
		],
		["/api/auth/callback/google", ["rate-limit-auth", "rate-limit-dynamic"]],
		["/admin/login", ["rate-limit-auth", "rate-limit-dynamic"]],
		// downloads: their own limit, and the general one
		[
			"/m/bitcoin-price-50k/export",
			["rate-limit-export", "rate-limit-dynamic"],
		],
		[
			"/m/bitcoin-price-50k/export/image",
			["rate-limit-export", "rate-limit-dynamic"],
		],
		// everything else dynamic: the general limit only
		["/", ["rate-limit-dynamic"]],
		["/m/bitcoin-price-50k", ["rate-limit-dynamic"]],
		["/m/bitcoin-price-50k/version", ["rate-limit-dynamic"]],
		["/m/bitcoin-price-50k/quote", ["rate-limit-dynamic"]],
		["/u/GoldBadger328", ["rate-limit-dynamic"]],
		["/api/bets/place", ["rate-limit-dynamic"]],
		["/api/visits", ["rate-limit-dynamic"]],
		["/admin/markets", ["rate-limit-dynamic"]],
		["/admin/seed/run", ["rate-limit-dynamic"]],
		["/sign-in", ["rate-limit-dynamic"]],
		["/legal/privacy", ["rate-limit-dynamic"]],
		["/_next/image", ["rate-limit-dynamic"]],
		// static files: the static limit only
		["/_next/static/chunks/app-abc123.js", ["rate-limit-static"]],
		["/_next/static/media/geist.woff2", ["rate-limit-static"]],
		["/brand/blocks/1.png", ["rate-limit-static"]],
		["/art/warli-field.svg", ["rate-limit-static"]],
		["/tutorial/profile-reference.png", ["rate-limit-static"]],
	];

	it.each(cases)("%s → %j", (path, expected) => {
		expect(countingRules(path)).toEqual(expected);
	});

	it("does not mistake look-alike paths for downloads or sign-in", () => {
		expect(countingRules("/m/exporter")).toEqual(["rate-limit-dynamic"]);
		expect(countingRules("/m/x/export/other")).toEqual(["rate-limit-dynamic"]);
		expect(countingRules("/u/export")).toEqual(["rate-limit-dynamic"]);
		expect(countingRules("/api/authx")).toEqual(["rate-limit-dynamic"]);
		expect(countingRules("/api/bets/place")).not.toContain("rate-limit-auth");
	});
});

describe("waf-rate-limits — below the limit passes, above it is blocked (model)", () => {
	const cases: [string, string, number][] = [
		["general", "/m/bitcoin-price-50k", 1_000],
		["static", "/_next/static/chunks/a.js", 5_000],
		["sign-in", "/api/auth/sign-in/social", 100],
		["download", "/m/bitcoin-price-50k/export", 30],
	];

	it.each(
		cases,
	)("%s: the first %s… requests pass and the next is blocked with 429", (_label, path, limit) => {
		const request = simulate();
		const step = WAF_RATE_WINDOW_SECONDS / (limit + 2);
		for (let i = 0; i < limit; i++) {
			expect(request("203.0.113.7", path, i * step)).toBe(200);
		}
		expect(request("203.0.113.7", path, limit * step)).toBe(429);
	});

	it("is per IP: one address over its limit does not affect another", () => {
		const request = simulate();
		for (let i = 0; i <= 30; i++) request("203.0.113.7", "/m/x/export", i);
		expect(request("203.0.113.7", "/m/x/export", 31)).toBe(429);
		expect(request("198.51.100.9", "/m/x/export", 31)).toBe(200);
	});

	it("is a 5-minute window: the same address is allowed again once its count falls", () => {
		const request = simulate();
		for (let i = 0; i < 30; i++) request("203.0.113.7", "/m/x/export", i);
		expect(request("203.0.113.7", "/m/x/export", 40)).toBe(429);
		expect(request("203.0.113.7", "/m/x/export", 40 + 301)).toBe(200);
	});
});

describe("waf-rate-limits — real users are not blocked (model, measured page shape)", () => {
	/** One cold page load as measured on production: 36 same-origin requests. */
	function coldLoad(
		ip: string,
		page: string,
		at: number,
		request: ReturnType<typeof simulate>,
	) {
		const results = [request(ip, page, at)];
		for (let i = 0; i < 24; i++)
			results.push(request(ip, `/_next/static/chunks/c${i}.js`, at));
		for (let i = 0; i < 2; i++)
			results.push(request(ip, `/_next/static/media/f${i}.woff2`, at));
		for (let i = 0; i < 9; i++)
			results.push(request(ip, `/brand/blocks/${i}.png`, at));
		return results;
	}

	it("a heavy single user for 5 minutes: 3 tabs, 6 markets, sign-in, bets, 3 downloads", () => {
		const request = simulate();
		const ip = "203.0.113.7";
		const out: number[] = [];
		out.push(...coldLoad(ip, "/", 0, request));
		for (let i = 0; i < 5; i++) out.push(request(ip, `/api/auth/x${i}`, 5 + i));
		for (let m = 0; m < 6; m++)
			out.push(request(ip, `/m/market-${m}`, 10 + m * 20));
		for (let t = 0; t < 3; t++) {
			for (let s = 0; s < 300; s += 30)
				out.push(request(ip, `/m/market-${t}/version`, s));
		}
		for (let b = 0; b < 10; b++)
			out.push(request(ip, "/api/bets/place", 100 + b));
		for (let d = 0; d < 3; d++)
			out.push(request(ip, "/m/market-0/export/image", 200 + d));
		expect(out.every((s) => s === 200)).toBe(true);
	});

	it("100 people behind ONE shared address (campus / office / carrier NAT) each open the site and a market", () => {
		const request = simulate();
		const ip = "203.0.113.7";
		const out: number[] = [];
		for (let p = 0; p < 100; p++) {
			out.push(...coldLoad(ip, "/", p * 2, request));
			out.push(request(ip, "/m/bitcoin-price-50k", p * 2 + 1));
			out.push(request(ip, "/m/bitcoin-price-50k/version", p * 2 + 1));
		}
		expect(out.filter((s) => s === 429)).toHaveLength(0);
	});

	it("20 people behind one address all sign in within 5 minutes", () => {
		const request = simulate();
		const out: number[] = [];
		for (let p = 0; p < 20; p++) {
			for (let i = 0; i < 5; i++)
				out.push(request("203.0.113.7", "/api/auth/x", p * 10 + i));
		}
		expect(out.filter((s) => s === 429)).toHaveLength(0);
	});

	it("a script hammering one market page is blocked", () => {
		const request = simulate();
		const out: number[] = [];
		for (let i = 0; i < 1_200; i++)
			out.push(request("203.0.113.7", "/m/x", i * 0.2));
		expect(out.filter((s) => s === 429).length).toBeGreaterThanOrEqual(200);
	});
});
