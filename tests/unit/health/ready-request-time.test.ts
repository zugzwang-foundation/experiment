import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * READY-REQUEST-TIME (readiness item 18) — `/api/ready`, the ALB target-group
 * health check, runs at request time and never at build. `next build` calls a
 * route's GET once to decide whether it can be static; the handler must opt
 * out BEFORE it starts the warm-up, or the build queries its database and
 * could freeze the health check as a static answer. Source scan, comments
 * stripped, with a positive control.
 */

const REPO_ROOT = join(__dirname, "..", "..", "..");
const source = readFileSync(
	join(REPO_ROOT, "src/app/api/ready/route.ts"),
	"utf8",
);
const code = source
	.replace(/\/\*[\s\S]*?\*\//g, " ")
	.replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");

describe("/api/ready renders at request time, never at build", () => {
	const handler = code.slice(code.indexOf("export async function GET("));

	it("positive control: the handler and its warm-up call exist", () => {
		expect(handler.length).toBeGreaterThan(0);
		expect(handler).toContain("readiness()");
	});

	it("awaits connection() before starting the warm-up", () => {
		const gate = handler.indexOf("await connection();");
		expect(gate).toBeGreaterThan(-1);
		expect(gate).toBeLessThan(handler.indexOf("readiness()"));
	});

	it("imports connection from next/server", () => {
		expect(source).toMatch(/^import \{ connection \} from "next\/server";$/m);
	});
});
