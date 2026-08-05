import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// STAGING-PARITY Slice A — the destructive step must be UNREACHABLE unless
// every guard has passed.
//
// Minted in response to a CRITICAL @code-reviewer finding: the guards were
// originally written as ordinary `it()` blocks. Vitest does not stop a file
// when a test fails and no `bail` is configured, so a G-3 failure — "the live
// connection does not carry the staging ref fragment; refusing" — was followed
// immediately by the `it()` that truncates. The runner would have REFUSED and
// THEN WIPED, in the same run, reporting only a red test. Against the real
// staging target that path was live, not theoretical: the session pooler's
// hostname carries no project ref, so the original host-only G-3 threw on
// every legitimate invocation.
//
// The reviewer's diagnosis of why it survived was that no test at any level
// asserted the gating property. This file is that assertion. It reads the
// runner's SOURCE, because the property is structural — which lexical
// construct each guard lives in — and no runtime probe of a file that wipes a
// database is available to a unit test.

const RUNNER = fileURLToPath(
	new URL("../../staging/reset.staging.test.ts", import.meta.url),
);
const raw = readFileSync(RUNNER, "utf8");

/**
 * Blank out comments, preserving every character offset so positions computed
 * here still index into the real file. The runner's header DISCUSSES `it()`
 * blocks at length, so a naive scan finds "it(" inside prose and reasons about
 * the wrong construct — which is how the original defect read as fine.
 */
function stripComments(text: string): string {
	let out = "";
	let i = 0;
	while (i < text.length) {
		if (text.startsWith("//", i)) {
			const end = text.indexOf("\n", i);
			const stop = end === -1 ? text.length : end;
			out += " ".repeat(stop - i);
			i = stop;
		} else if (text.startsWith("/*", i)) {
			const end = text.indexOf("*/", i + 2);
			const stop = end === -1 ? text.length : end + 2;
			out += text.slice(i, stop).replace(/[^\n]/g, " ");
			i = stop;
		} else {
			out += text[i];
			i += 1;
		}
	}
	return out;
}

const source = stripComments(raw);

/** Character offset of the first `it(` / `it.each` block in the file. */
function firstItOffset(text: string): number {
	const m = text.match(/\bit(?:\.\w+)*\s*\(/);
	return m?.index ?? -1;
}

function offsetOf(text: string, needle: string): number {
	return text.indexOf(needle);
}

describe("the runner file exists and is parseable", () => {
	it("is non-empty", () => {
		expect(raw.length).toBeGreaterThan(0);
	});

	it("strips comments without moving offsets", () => {
		// Load-bearing: every assertion below compares character offsets.
		expect(source).toHaveLength(raw.length);
		// The header genuinely does discuss it() blocks — proves the stripper
		// is doing work rather than matching nothing.
		expect(raw).toMatch(/^\s*\/\/.*\bit\(\)/m);
		expect(source).not.toMatch(/\bit\(\)/);
	});
});

describe("guards run before any test body", () => {
	const itAt = firstItOffset(source);

	it("has at least one it() block to reason about", () => {
		expect(itAt).toBeGreaterThan(-1);
	});

	it("evaluates G-1/G-2 at module scope, ahead of every it()", () => {
		const at = offsetOf(source, "resolveStagingTarget(process.env)");
		expect(at).toBeGreaterThan(-1);
		expect(at).toBeLessThan(itAt);
	});

	it("throws on a failed target guard before constructing a client", () => {
		const throwAt = offsetOf(source, "REFUSED — the staging reset guard");
		const clientAt = offsetOf(source, "postgres(target.url");
		expect(throwAt).toBeGreaterThan(-1);
		expect(clientAt).toBeGreaterThan(-1);
		expect(throwAt).toBeLessThan(clientAt);
	});

	it("runs G-3 in beforeAll, not in an it()", () => {
		// A throwing beforeAll fails every test in the suite WITHOUT executing
		// any of them. A throwing it() does not stop the file.
		const beforeAllAt = offsetOf(source, "beforeAll(");
		const g3At = offsetOf(source, "assertLiveConnection(");
		expect(beforeAllAt).toBeGreaterThan(-1);
		expect(g3At).toBeGreaterThan(beforeAllAt);
		expect(g3At).toBeLessThan(itAt);
	});

	it("runs the guard pre-flight in beforeAll, not in an it()", () => {
		const preflightAt = offsetOf(source, "readGuardCatalog(");
		expect(preflightAt).toBeGreaterThan(-1);
		expect(preflightAt).toBeLessThan(itAt);
	});

	it("captures the migration baseline before the batch", () => {
		const baselineAt = offsetOf(source, "countMigrations(");
		expect(baselineAt).toBeGreaterThan(-1);
		expect(baselineAt).toBeLessThan(itAt);
	});
});

describe("the destructive step is gated and self-verifying", () => {
	it("calls runGuardedReset exactly once", () => {
		const hits = source.match(/runGuardedReset\(/g) ?? [];
		expect(hits).toHaveLength(1);
	});

	it("calls runGuardedReset only after every guard construct", () => {
		const resetAt = offsetOf(source, "runGuardedReset(client");
		for (const guard of [
			"resolveStagingTarget(process.env)",
			"assertLiveConnection(",
			"readGuardCatalog(",
		]) {
			expect({ guard, before: offsetOf(source, guard) < resetAt }).toEqual({
				guard,
				before: true,
			});
		}
	});

	it("verifies G-4 in the SAME it() as the batch, after it", () => {
		// If G-4 lived in its own it(), a reordering — or a failure in the
		// truncate block — could separate the wipe from its verification.
		const resetAt = offsetOf(source, "runGuardedReset(client");
		const verifyAt = offsetOf(source, "verifyPostReset(client");
		expect(verifyAt).toBeGreaterThan(resetAt);

		const between = source.slice(resetAt, verifyAt);
		expect(between).not.toMatch(/\bit(?:\.\w+)*\s*\(/);
	});

	it("passes the migration baseline into G-4", () => {
		// ADR-0035 G-4 requires the ledger to RETAIN its row count; a bare
		// non-empty check passes a partial deletion.
		expect(source).toMatch(/verifyPostReset\(client,\s*migrationsBefore\)/);
	});

	it("keeps the belt re-enable in a finally around the batch", () => {
		expect(source).toMatch(/finally\s*\{[\s\S]{0,400}reEnableGuards\(/);
	});
});

describe("no guard is written as a failable it()", () => {
	it("contains no it() whose body refuses without stopping the run", () => {
		// The specific regression: a guard expressed as `it(... expect(...))`
		// reports red and lets the next it() proceed. Every refusal in this
		// file must be a `throw`, in module scope or beforeAll.
		const firstIt = firstItOffset(source);
		const preamble = source.slice(0, firstIt);
		expect(preamble).toMatch(/throw new Error/);

		// And the only it() in the file is the destructive one.
		const itBlocks = source.match(/\bit(?:\.\w+)*\s*\(/g) ?? [];
		expect(itBlocks).toHaveLength(1);
	});
});
