import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { FORBIDDEN_DIRECT_WRITE_TABLES } from "../../staging/_lib/write-guard";

// SEED-1-DUMMY — ADR-0053. The SOURCE TRIPWIRE for tests/prod-seed/, the cheap
// CI-side twin of the behavioural write guard the runner is wrapped in (see
// tests/unit/staging/generator-no-direct-writes.test.ts for why both exist).
// Every pattern has a positive control, and the file set must be non-empty.

const DIR = fileURLToPath(new URL("../../prod-seed/", import.meta.url));

function collect(dir: string, acc: string[] = []): string[] {
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const full = `${dir}${entry.name}`;
		if (entry.isDirectory()) collect(`${full}/`, acc);
		else if (entry.name.endsWith(".ts")) acc.push(full);
	}
	return acc;
}

/** Blank comments, so the header prose about `.insert(` cannot trip the scan. */
function stripComments(text: string): string {
	return text
		.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
		.replace(/\/\/[^\n]*/g, "");
}

const FILES = collect(DIR).sort();

/** The engine entrypoints the runner may import — adding one is a decision. */
const ALLOWED_SERVER_IMPORTS = new Set([
	"@/server/auth/index",
	"@/server/auth/tos-accept",
	"@/server/bets/place",
	"@/server/bets/transaction",
	"@/server/comments/reply-validate",
	"@/server/config/limits",
	"@/server/cpmm/decimal",
	"@/server/storage/r2",
	"@/server/storage/sign-upload",
	"@/server/storage/verify-object",
	"../../../src/server/config/limits",
]);

const IMPORT_RE =
	/from\s+["']((?:@\/server|(?:\.\.\/)+src\/server)\/[^"']+)["']/g;

function writePatterns(table: string): RegExp[] {
	const binding = table.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
	return [
		new RegExp(`insert\\s+into\\s+"?${table}"?\\b`, "i"),
		new RegExp(`\\.(?:insert|update|delete)\\(\\s*${binding}\\s*,?\\s*\\)`),
	];
}

describe("tests/prod-seed/ writes nothing directly", () => {
	it("scans a non-empty file set that includes the runner", () => {
		expect(FILES.length).toBeGreaterThan(0);
		expect(FILES.some((f) => f.endsWith("seed.prod-seed.test.ts"))).toBe(true);
	});

	it("patterns match what they hunt (positive controls)", () => {
		expect(
			writePatterns("bets").some((re) => re.test("tx.insert(\n\t\tbets,\n\t)")),
		).toBe(true);
		expect(
			writePatterns("dharma_ledger").some((re) =>
				re.test('INSERT INTO "dharma_ledger"'),
			),
		).toBe(true);
		expect(
			[...'import { place } from "@/server/bets/place";'.matchAll(IMPORT_RE)]
				.length,
		).toBe(1);
	});

	it("does not ratify the engine's own writers (the allowlist's negative control)", () => {
		// A runner importing these could write events or ledger rows itself.
		expect(ALLOWED_SERVER_IMPORTS.has("@/server/events/insert")).toBe(false);
		expect(ALLOWED_SERVER_IMPORTS.has("@/server/dharma/persist")).toBe(false);
	});

	it("contains no direct write to any protected table", () => {
		const hits: string[] = [];
		for (const file of FILES) {
			const text = stripComments(readFileSync(file, "utf8"));
			for (const table of FORBIDDEN_DIRECT_WRITE_TABLES) {
				for (const re of writePatterns(table))
					if (re.test(text)) hits.push(`${file}: ${re}`);
			}
		}
		expect(hits).toEqual([]);
	});

	it("imports only allowlisted engine entrypoints", () => {
		const unexpected: string[] = [];
		for (const file of FILES) {
			const text = stripComments(readFileSync(file, "utf8"));
			for (const m of text.matchAll(IMPORT_RE)) {
				if (!ALLOWED_SERVER_IMPORTS.has(m[1] as string))
					unexpected.push(`${file}: ${m[1]}`);
			}
		}
		expect(unexpected).toEqual([]);
	});
});
