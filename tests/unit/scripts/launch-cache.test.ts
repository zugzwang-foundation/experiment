import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { productionConfig } from "../../../infra/config/production";

/**
 * LAUNCH-DB-COPY-1 (scope addition, 2026-10-05) —
 * `scripts/aws-migration/launch-cache.cjs`. Clears production's cached read
 * models after the data swap, while writes are still paused.
 *
 * ⛔ WRITTEN BEFORE THE TOOL EXISTS; the intended RED is `Cannot find module
 * …/launch-cache.cjs`.
 *
 * ⛔⛔ THE ONE FACT THAT SHAPES EVERY TEST HERE: STAGING AND PRODUCTION SHARE ONE
 * UPSTASH INSTANCE AND ONE TOKEN (PROD-LAUNCH-DB-COPY §A.3). The two
 * environments are separated by NOTHING but the leftmost segment of every key —
 * `prod:` / `staging:` / `preview:`, built by `src/server/upstash/keys.ts`. So
 * the connection cannot tell the tool which environment it is pointed at, and
 * `isClearableKey` is not a convenience filter: it is the ONLY boundary between
 * "clear production's caches" and "reach into staging", or into a rate-limit
 * family, or into every key in the database. That is why the table below is
 * mostly negative, and why three of its rows are keys that a `startsWith`
 * without the trailing colon, or an `includes`, or a case-insensitive compare
 * would each accept.
 *
 * WHY `prod:idem:*` IS CLEARED AND WHY THAT IS SAFE. Idempotency fails CLOSED,
 * so clearing it cannot admit a double charge on its own; and the durable
 * backstop is `bet_receipts` (UNIQUE on `idempotency_key`, ADR-0031,
 * I-IDEM-ONCE-001), which the restore replaces wholesale. LEAVING those keys is
 * the dangerous choice: a cached response would then describe a receipt that no
 * longer exists in the database it was written from.
 *
 * Resolutions this file makes where the brief is silent (the implementer
 * follows these):
 *   1. `assertProductionRedisConfig(secretJson)` returns `{ url, token }` and
 *      throws `/refusing/` when either key is absent or empty.
 *   2. It also refuses a non-`https:` URL. The token is a bearer credential on
 *      every request; there is no reason for this tool to be the one place that
 *      would send it in the clear, and one line stops it.
 *   3. The glob patterns and the key guard must AGREE: every pattern expands
 *      only to keys the guard clears, and no pattern reaches a family the guard
 *      refuses. A disagreement in either direction is silent — one way the tool
 *      does nothing, the other way the guard is load-bearing for keys that
 *      should never have been scanned.
 */

const REPO_ROOT = join(__dirname, "..", "..", "..");
const SCRIPT = join(REPO_ROOT, "scripts/aws-migration/launch-cache.cjs");
const require = createRequire(import.meta.url);
// biome-ignore lint/suspicious/noExplicitAny: a CommonJS script without types.
const tool: any = require(SCRIPT);

/** Comment-stripped before every negative scan; see launch-dump.test.ts. */
function code(src: string): string {
	return src
		.replace(/\/\*[\s\S]*?\*\//g, (m) =>
			"\n".repeat((m.match(/\n/g) ?? []).length),
		)
		.replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

const SOURCE = readFileSync(SCRIPT, "utf8");
const CODE = code(SOURCE);

describe("launch-cache::target", () => {
	it("reads the production secret the production task reads", () => {
		expect(tool.SECRET).toBe(productionConfig.secretName);
		expect(tool.SECRET).toBe("zugzwang/production");
	});

	it("needs two keys that the deployed production secret actually carries", () => {
		// If a later PR drops either key from the runtime secret, this tool stops
		// working at launch — and the only symptom would be stale cached pages
		// nobody could explain.
		expect(productionConfig.secretKeys).toContain("UPSTASH_REDIS_REST_URL");
		expect(productionConfig.secretKeys).toContain("UPSTASH_REDIS_REST_TOKEN");
	});

	it("accepts a production Redis config and hands back the two values", () => {
		const cfg = tool.assertProductionRedisConfig({
			UPSTASH_REDIS_REST_URL: "https://apn1-example-12345.upstash.io",
			UPSTASH_REDIS_REST_TOKEN: "AYAgASQg-token",
			DATABASE_URL: "postgresql://u:p@h/zugzwang",
		});
		expect(cfg.url).toBe("https://apn1-example-12345.upstash.io");
		expect(cfg.token).toBe("AYAgASQg-token");
	});

	it.each([
		["no URL", { UPSTASH_REDIS_REST_TOKEN: "t" }],
		["no token", { UPSTASH_REDIS_REST_URL: "https://x.upstash.io" }],
		[
			"an empty URL",
			{ UPSTASH_REDIS_REST_URL: "", UPSTASH_REDIS_REST_TOKEN: "t" },
		],
		[
			"an empty token",
			{
				UPSTASH_REDIS_REST_URL: "https://x.upstash.io",
				UPSTASH_REDIS_REST_TOKEN: "",
			},
		],
		[
			"a plaintext URL (the token is a bearer credential)",
			{
				UPSTASH_REDIS_REST_URL: "http://x.upstash.io",
				UPSTASH_REDIS_REST_TOKEN: "t",
			},
		],
		["an empty secret", {}],
		["nothing", undefined],
	])("refuses %s", (_label, secret) => {
		expect(() => tool.assertProductionRedisConfig(secret)).toThrow(/refusing/);
	});
});

describe("launch-cache::clear-patterns", () => {
	it("scans exactly the three cached families, production-prefixed", () => {
		expect(tool.CLEAR_PATTERNS).toEqual([
			"prod:cache:*",
			"prod:cache-metric:*",
			"prod:idem:*",
		]);
	});

	it("every pattern is production-prefixed and globs only its own tail", () => {
		for (const p of tool.CLEAR_PATTERNS as string[]) {
			expect(p.startsWith("prod:")).toBe(true);
			expect(p.endsWith("*")).toBe(true);
			expect(p.split("*")).toHaveLength(2);
			expect(p).not.toContain("staging");
			expect(p).not.toContain("preview");
		}
	});

	it("⛔ expands only to keys the guard will clear (resolution 3)", () => {
		for (const p of tool.CLEAR_PATTERNS as string[]) {
			expect(tool.isClearableKey(p.replace("*", "sample-key")), p).toBe(true);
			expect(tool.isClearableKey(p.replace("*", "")), p).toBe(true);
		}
	});

	it("⛔ reaches no family the guard refuses (resolution 3, other direction)", () => {
		const prefixes = (tool.CLEAR_PATTERNS as string[]).map((p) =>
			p.slice(0, -1),
		);
		for (const key of [
			"prod:ratelimit:otp-email",
			"prod:cron-lock:close-due-markets",
			"prod:seed:guard",
			"staging:cache:debate:1",
		]) {
			expect(
				prefixes.some((pre) => key.startsWith(pre)),
				key,
			).toBe(false);
		}
	});
});

describe("launch-cache::is-clearable-key", () => {
	it.each([
		["a cached debate view", "prod:cache:debate-view:0192700000007000"],
		["a cached discovery list", "prod:cache:discovery:list"],
		["a cache counter", "prod:cache-metric:shared-view:hit"],
		["an idempotency entry", "prod:idem:01927000-0000-7000-8000-00000000b001"],
	])("clears %s", (_label, key) => {
		expect(tool.isClearableKey(key)).toBe(true);
	});

	it.each([
		// ⛔ The shared instance. A staging key deleted here is somebody else's
		// environment, mid-rehearsal.
		["a staging cache key", "staging:cache:debate-view:1"],
		["a staging idempotency key", "staging:idem:abc"],
		["a staging counter", "staging:cache-metric:hit"],
		["a preview cache key", "preview:cache:debate-view:1"],
		// ⚠ `includes("prod:cache:")` accepts this one, and it is a STAGING key.
		[
			"a staging key that CONTAINS the production prefix",
			"staging:prod:cache:x",
		],
		["a key that merely ends with one", "x-prod:cache:y"],
		// ⚠ `startsWith("prod:cache")` — no trailing colon — accepts these two.
		["a family whose name starts with cache", "prod:cachex:y"],
		["a family whose name starts with cache-metric", "prod:cache-metricx:y"],
		["a family whose name starts with idem", "prod:idemx:y"],
		// Production families that must survive: a cleared rate-limit window
		// fails OPEN, and a cleared cron lock lets two sweeps run at once.
		["a rate-limit window", "prod:ratelimit:otp-email"],
		["a cron lock", "prod:cron-lock:close-due-markets"],
		["a seed guard", "prod:seed:markets"],
		[
			"a moderation reservation outside the three families",
			"prod:moderation:abc",
		],
		// Degenerate shapes.
		["the bare environment prefix", "prod:"],
		["the environment with no separator", "prod"],
		["nothing", ""],
		["null", null],
		["undefined", undefined],
		// ⚠ Keys are lowercase by construction (`getRedisKey`); a
		// case-insensitive compare only ever widens the blast radius.
		["an upper-case imitation", "PROD:CACHE:x"],
	])("refuses %s", (_label, key) => {
		expect(tool.isClearableKey(key)).toBe(false);
	});
});

describe("launch-cache::execution-safety", () => {
	it("the recognisers fire on the shapes they forbid", () => {
		// POSITIVE CONTROL for the three negative scans below.
		expect(/flushdb|flushall/i.test("await redis.flushdb()")).toBe(true);
		const synthetic = 'await redis.keys("prod:*")';
		expect(
			(synthetic.match(/\.keys\s*\(/g) ?? []).length >
				(synthetic.match(/Object\.keys\s*\(/g) ?? []).length,
		).toBe(true);
	});

	it("⛔ never empties the database", () => {
		expect(CODE).not.toMatch(/flushdb|flushall/i);
		expect(CODE).not.toMatch(/["']KEYS["']/);
	});

	it("⛔ enumerates with SCAN, never with KEYS", () => {
		// KEYS is O(n) over a SHARED instance and blocks it for staging too; and
		// its pattern is matched by the server, where this tool's guard cannot
		// see it. Every `.keys(` in the file must be an `Object.keys(`.
		const all = CODE.match(/\.keys\s*\(/g) ?? [];
		const objectKeys = CODE.match(/Object\.keys\s*\(/g) ?? [];
		expect(all.length).toBe(objectKeys.length);
		expect(CODE).toMatch(/\bscan\b/i);
	});

	it("deletes with DEL or UNLINK and nothing else", () => {
		expect(CODE).toMatch(/\b(del|unlink)\b/i);
	});

	it("⛔ passes every key through isClearableKey before deleting it", () => {
		const uses = CODE.match(/isClearableKey\s*\(/g) ?? [];
		// The definition, plus at least one call site.
		expect(uses.length).toBeGreaterThanOrEqual(2);
		expect(CODE).toMatch(
			/filter\(\s*(isClearableKey|\([^)]*\)\s*=>\s*isClearableKey)|if\s*\(\s*!\s*isClearableKey/,
		);
	});

	it("⛔ never names a staging key or the staging secret", () => {
		expect(CODE).not.toMatch(/staging:/);
		expect(CODE).not.toContain("zugzwang/staging");
	});

	it("checks the caller's AWS account before reading any secret", () => {
		const sts = CODE.indexOf("get-caller-identity");
		const secret = CODE.indexOf("get-secret-value");
		expect(sts).toBeGreaterThan(-1);
		expect(secret).toBeGreaterThan(sts);
	});

	it("never prints the token's value", () => {
		// The VALUE, not the word: a log line that says it is reading the token is
		// fine, one that interpolates it is a credential in a terminal scrollback.
		expect(CODE).not.toMatch(
			/console\.(log|error)\([^)]*(UPSTASH_REDIS_REST_TOKEN|\.token\b)/,
		);
	});

	it("is check-only until --execute is given", () => {
		expect(CODE).toContain("--execute");
		expect(CODE).toMatch(/if\s*\(\s*!\s*[\w.]*execute\b/i);
	});

	it("only reaches AWS or Redis when executed directly", () => {
		// This file requires the module; without the guard, collecting it would
		// connect to production's Redis.
		expect(SOURCE).toContain("if (require.main === module)");
	});
});

describe("launch-cache::launch-window", () => {
	it("deletes only inside the launch window, acknowledged (@security-auditor M-3)", () => {
		const src = readFileSync(
			join(
				__dirname,
				"..",
				"..",
				"..",
				"scripts/aws-migration/launch-cache.cjs",
			),
			"utf8",
		);
		expect(src).toMatch(/if \(execute\) assertLaunchWindow\(\)/);
		expect(src.indexOf("assertLaunchWindow()")).toBeLessThan(
			src.indexOf("get-secret-value"),
		);
	});
});
