import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ADR-0061 F3 — the ALB settings the client-IP derivation depends on are
 * PINNED in compute-stack.ts, not inherited from AWS defaults. The helper
 * (`src/server/middleware/client-ip.ts`) reads the LAST X-Forwarded-For entry
 * as the ALB's own statement of who connected; that is true only in APPEND
 * mode. A source scan (the convention of environment-config.test.ts — this
 * root suite has no CDK app), comments stripped so a docblock naming the
 * property cannot satisfy it.
 */

const REPO_ROOT = join(__dirname, "..", "..", "..");

function stripped(relPath: string): string {
	return readFileSync(join(REPO_ROOT, relPath), "utf8")
		.replace(/\/\*[\s\S]*?\*\//g, " ")
		.replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
}

/** The props object passed to `new elbv2.ApplicationLoadBalancer(...)`. */
function albProps(source: string): string {
	const start = source.indexOf("new elbv2.ApplicationLoadBalancer(");
	expect(start).toBeGreaterThan(-1);
	const end = source.indexOf("});", start);
	return source.slice(start, end);
}

describe("ADR-0061 F3 — the ALB's X-Forwarded-For contract is pinned", () => {
	const props = albProps(stripped("infra/lib/compute-stack.ts"));

	it("positive control: the props block is the load balancer's", () => {
		expect(props).toContain("internetFacing: true");
	});

	it("appends to X-Forwarded-For (the peer the helper trusts is LAST)", () => {
		expect(props).toMatch(
			/xffHeaderProcessingMode:\s*elbv2\.XffHeaderProcessingMode\.APPEND\b/,
		);
	});

	it("drops invalid header fields", () => {
		expect(props).toMatch(/dropInvalidHeaderFields:\s*true\b/);
	});
});
