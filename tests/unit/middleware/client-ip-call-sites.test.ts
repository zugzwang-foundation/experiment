import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * S-1 / ADR-0061 — structural guard (O-1): the shared helper is the ONLY
 * module in `src/` that reads a client-IP header. Before S-1 there were nine
 * private copies of the same first-hop parse; a tenth, added by the next route,
 * would silently reopen the spoof. Comments are stripped before scanning so a
 * docblock that NAMES the header is not a false hit.
 */

const ROOT = join(__dirname, "..", "..", "..");
const SRC = join(ROOT, "src");
const HELPER = "src/server/middleware/client-ip.ts";
const IP_HEADER =
	/["'`](x-forwarded-for|cf-connecting-ip|x-real-ip|true-client-ip)["'`]/i;

function walk(dir: string): string[] {
	return readdirSync(dir).flatMap((name) => {
		const path = join(dir, name);
		if (statSync(path).isDirectory()) return walk(path);
		return /\.(ts|tsx)$/.test(name) ? [path] : [];
	});
}

function stripComments(source: string): string {
	return source
		.replace(/\/\*[\s\S]*?\*\//g, "")
		.replace(/(^|[^:])\/\/.*$/gm, "$1");
}

describe("client-IP headers are read in exactly one module", () => {
	const files = walk(SRC).map((p) => relative(ROOT, p).replaceAll("\\", "/"));

	it("positive control: the helper itself matches", () => {
		expect(files).toContain(HELPER);
		expect(
			IP_HEADER.test(stripComments(readFileSync(join(ROOT, HELPER), "utf8"))),
		).toBe(true);
	});

	it("no other file under src/ names a client-IP header", () => {
		const offenders = files.filter(
			(f) =>
				f !== HELPER &&
				IP_HEADER.test(stripComments(readFileSync(join(ROOT, f), "utf8"))),
		);
		expect(offenders).toEqual([]);
	});

	// `@code-reviewer` MEDIUM-2: the stamp Better Auth trusts, the platform
	// helper this change removed, and RFC 7239 `Forwarded` are readers too.
	const OTHER_READERS =
		/["'`](x-zz-client-ip|forwarded)["'`]|@vercel\/functions/i;

	it("no file but the helper names the stamp, Forwarded, or @vercel/functions", () => {
		const offenders = files.filter(
			(f) =>
				f !== HELPER &&
				OTHER_READERS.test(stripComments(readFileSync(join(ROOT, f), "utf8"))),
		);
		expect(offenders).toEqual([]);
	});
});

/**
 * `@code-reviewer` HIGH-3 — the two lines that make Better Auth's IP safe.
 * `ipAddressHeaders` points Better Auth at a header NO platform overwrites;
 * only the auth route's `withTrustedClientIp` sanitises it. Drop the wrapper
 * and Better Auth trusts a client-sent value; drop the config and it falls
 * back to the raw first XFF hop. Both fail open, silently — so both are pinned.
 */
describe("Better Auth sees only the stamped trusted IP", () => {
	const read = (p: string) =>
		stripComments(readFileSync(join(ROOT, p), "utf8"));

	it("every auth.handler call in src/ receives withTrustedClientIp(...)", () => {
		const files = walk(SRC).map((p) => relative(ROOT, p).replaceAll("\\", "/"));
		const calls = files.flatMap((f) =>
			[...read(f).matchAll(/auth\.handler\(([^)]*)/g)].map((m) => ({
				f,
				arg: m[1]?.trim() ?? "",
			})),
		);
		// Positive control: the one known mount is found.
		expect(calls.map((c) => c.f)).toContain(
			"src/app/api/auth/[...all]/route.ts",
		);
		expect(
			calls.filter((c) => !c.arg.startsWith("withTrustedClientIp(")),
		).toEqual([]);
	});

	it("advanced.ipAddress.ipAddressHeaders is exactly [TRUSTED_CLIENT_IP_HEADER]", () => {
		const source = read("src/server/auth/index.ts").replace(/\s+/g, "");
		expect(source).toContain(
			"ipAddress:{ipAddressHeaders:[TRUSTED_CLIENT_IP_HEADER],}",
		);
	});
});
