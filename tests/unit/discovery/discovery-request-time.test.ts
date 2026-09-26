import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * STAGING-DISCOVERY-DB (ADR-0055 P1) — Discovery renders at REQUEST time.
 *
 * `next build` reads the build environment's database (Doppler → Supabase)
 * while the running task serves RDS, so a prerendered Discovery baked the
 * build's market ids into the page and every price and image then missed. The
 * gate is `await connection()` at the top of `DiscoveryContent`, and it must
 * come BEFORE the first cached read (or that read is prerendered at build) and
 * BEFORE the `new Date()` clock read (or every runtime re-prerender of `/`
 * fails with "unstable value Date.now()"). A source scan, comments stripped,
 * with a positive control on each anchor.
 */

const REPO_ROOT = join(__dirname, "..", "..", "..");

function body(): string {
	const source = readFileSync(
		join(REPO_ROOT, "src/app/(public)/page.tsx"),
		"utf8",
	)
		.replace(/\/\*[\s\S]*?\*\//g, " ")
		.replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
	const start = source.indexOf("export async function DiscoveryContent()");
	expect(start).toBeGreaterThan(-1);
	return source.slice(start);
}

describe("Discovery renders at request time, never at build", () => {
	const fn = body();
	const gate = fn.indexOf("await connection();");
	const firstRead = fn.indexOf("getCachedDiscoveryMarketIds(");
	const clock = fn.indexOf("new Date()");

	it("positive controls: the anchors exist in DiscoveryContent", () => {
		expect(firstRead).toBeGreaterThan(-1);
		expect(clock).toBeGreaterThan(-1);
	});

	it("awaits connection() before the first cached read", () => {
		expect(gate).toBeGreaterThan(-1);
		expect(gate).toBeLessThan(firstRead);
	});

	it("awaits connection() before the render-time clock read", () => {
		expect(gate).toBeLessThan(clock);
	});

	it("keeps the gate outside the try, so a missing request scope fails loudly", () => {
		expect(gate).toBeLessThan(fn.indexOf("try {"));
	});

	it("imports connection from next/server", () => {
		const page = readFileSync(
			join(REPO_ROOT, "src/app/(public)/page.tsx"),
			"utf8",
		);
		expect(page).toMatch(/^import \{ connection \} from "next\/server";$/m);
	});
});
