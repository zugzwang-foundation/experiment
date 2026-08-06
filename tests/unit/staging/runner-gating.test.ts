import { readdirSync, readFileSync } from "node:fs";
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

const STAGING_DIR = fileURLToPath(new URL("../../staging/", import.meta.url));

/**
 * EVERY operational runner, not just the reset by name. Slices B–D add
 * generator and gate runners under the same config, reading the same env, and
 * would otherwise inherit no gating assertion at all (@security-auditor).
 */
const RUNNERS = readdirSync(STAGING_DIR)
	.filter((f) => f.endsWith(".staging.test.ts"))
	.sort();

const RUNNER = `${STAGING_DIR}reset.staging.test.ts`;
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

/**
 * Offsets of every `verifyPostReset(<ws> client` call, whitespace-tolerant.
 *
 * A literal `indexOf("verifyPostReset(client")` silently missed the call once
 * a formatter wrapped its arguments across lines — and "missed" meant the
 * search skipped forward to the NEXT call site and reasoned about the wrong
 * one. Match on a regex so formatting cannot move what this file concludes.
 */
const verifyOffsets = [...source.matchAll(/verifyPostReset\(\s*client/g)].map(
	(m) => m.index,
);

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

		// MUTATION-DERIVED (M-f2, 2026-08-06). The three assertions above ALL
		// hold when the module-scope refusal is downgraded from `throw` to
		// `console.error`: the message stays where it was, only the construct
		// that stops the run changes. The file-wide `/throw new Error/` checks
		// below are satisfied by the beforeAll throws, so nothing noticed —
		// while the runner would go on to build a client from an undefined URL
		// and let postgres-js pick a target out of ambient environment.
		//
		// `tsc` DOES catch it (StagingTarget is discriminated, so `target.url`
		// stops narrowing) — but the typecheck is a different gate, and this
		// file is the one whose entire job is the gating property. Bind the
		// message to the construct.
		const window = source.slice(Math.max(0, throwAt - 60), throwAt);
		expect(window).toMatch(/throw new Error\(/);
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
		expect(resetAt).toBeGreaterThan(-1);
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
		// Guard the needle itself. With resetAt === -1, `find(o => o > -1)`
		// returns the FIRST call site and `source.slice(-1, x)` is near-empty,
		// so the not.toMatch below would pass having examined nothing (Q-I).
		expect(resetAt).toBeGreaterThan(-1);
		const verifyAfterReset = verifyOffsets.find((o) => o > resetAt) ?? -1;
		expect(verifyAfterReset).toBeGreaterThan(resetAt);

		const between = source.slice(resetAt, verifyAfterReset);
		expect(between).not.toMatch(/\bit(?:\.\w+)*\s*\(/);
	});

	it("ALSO verifies G-4 in afterAll, which runs on the failure path", () => {
		// The in-it call is skipped in exactly the case it exists for: if
		// runGuardedReset throws, the belt's finally runs and the exception
		// re-throws, so nothing below the batch executes. A split-batch
		// regression only strands a guard off when it fails mid-way.
		// @security-auditor, Slice A.
		const afterAllAt = offsetOf(source, "afterAll(");
		expect(afterAllAt).toBeGreaterThan(-1);
		const verifyInAfterAll = verifyOffsets.find((o) => o > afterAllAt) ?? -1;
		expect(verifyInAfterAll).toBeGreaterThan(afterAllAt);
		// ...and before the destructive it(), i.e. it really is in the hook.
		expect(verifyInAfterAll).toBeLessThan(firstItOffset(source));

		// Two call sites, not one.
		expect(verifyOffsets).toHaveLength(2);
	});

	it("tells a pre-batch refusal apart from a post-wipe G-4 failure (F2)", () => {
		// afterAll runs even when beforeAll throws. Reporting "G-4 FAILED after
		// the run" on that path reads, on a DESTRUCTIVE artifact, as "staging was
		// wiped, then verification failed" — when in fact nothing ran. The flag
		// is set only where the batch is known to have committed, and the catch
		// must branch on it.
		const resetAt = offsetOf(source, "runGuardedReset(client");
		const flagAt = offsetOf(source, "batchCommitted = true");
		expect(resetAt).toBeGreaterThan(-1);
		expect(flagAt).toBeGreaterThan(resetAt);

		const afterAllAt = offsetOf(source, "afterAll(");
		const hook = source.slice(afterAllAt, firstItOffset(source));
		expect(hook).toMatch(/batchCommitted/);
		// Both arms must exist, and the non-destructive one must SAY so.
		expect(hook).toMatch(/NEVER RAN/);
		expect(hook).toMatch(/did NOT wipe/);
		expect(hook).toMatch(/COMMITTED/);
	});

	it("closes the client even when G-4 throws in afterAll", () => {
		const afterAllAt = offsetOf(source, "afterAll(");
		const tail = source.slice(afterAllAt, firstItOffset(source));
		expect(tail).toMatch(/finally\s*\{[\s\S]{0,200}client\.end\(/);
	});

	it("passes the migration baseline into G-4", () => {
		// ADR-0035 G-4 requires the ledger to RETAIN its row count; a bare
		// non-empty check passes a partial deletion.
		expect(source).toMatch(/verifyPostReset\(\s*client,\s*migrationsBefore/);
	});

	it("keeps the belt re-enable in a finally around the batch", () => {
		expect(source).toMatch(/finally\s*\{[\s\S]{0,400}reEnableGuards\(/);
	});
});

describe("every operational runner, present and future", () => {
	it("finds at least the reset runner", () => {
		expect(RUNNERS).toContain("reset.staging.test.ts");
	});

	for (const file of RUNNERS) {
		const body = stripComments(readFileSync(`${STAGING_DIR}${file}`, "utf8"));

		it(`${file} · evaluates the target guard at module scope`, () => {
			const at = body.indexOf("resolveStagingTarget(process.env)");
			expect(at).toBeGreaterThan(-1);
			const itAt = firstItOffset(body);
			if (itAt > -1) expect(at).toBeLessThan(itAt);
		});

		it(`${file} · refuses by throwing, not by a failing assertion`, () => {
			const itAt = firstItOffset(body);
			const preamble = itAt === -1 ? body : body.slice(0, itAt);
			expect(preamble).toMatch(/throw new Error/);

			// MUTATION-DERIVED (M-f2): a preamble-wide `/throw new Error/` is
			// satisfied by ANY throw in the preamble — including one belonging to
			// a different guard entirely. Tie the throw to the TARGET GUARD's own
			// result, which is the refusal that must stop the run before a client
			// exists. Generic across the generator/gate runners Slices B–D add,
			// since they read the same predicate.
			const guardAt = body.indexOf("resolveStagingTarget(process.env)");
			expect(guardAt).toBeGreaterThan(-1);
			expect(preamble.slice(guardAt)).toMatch(
				/\.ok\)[\s\S]{0,120}throw new Error/,
			);
		});

		it(`${file} · does not import the test-only truncate fixture`, () => {
			// POSITIVE CONTROL FIRST. Both patterns below are negative
			// assertions, and a negative assertion passes when its pattern
			// matches nothing — which is exactly what a path-alias change or a
			// fixture rename produces. Prove the matchers fire before trusting
			// that they did not (Q-I).
			const KNOWN_BAD =
				'import { truncateTables } from "../db/_fixtures/truncate";';
			expect(KNOWN_BAD).toMatch(/_fixtures\/truncate/);
			expect(KNOWN_BAD).toMatch(/\btruncateTables\b/);

			// ADR-0035 primitive 7 keeps the reset and
			// tests/db/_fixtures/truncate.ts as two separate artifacts — and that
			// fixture's TRUNCATE_GUARDS INCLUDES system_state's truncate guard.
			// A staging runner reaching for truncateTables() for teardown would
			// disable the freeze sentinel's guard ON STAGING, destroying the
			// "active defense" the exclusion design depends on. The ADR states
			// this; a comment is not a control. @security-auditor, Slice A.
			expect(body).not.toMatch(/_fixtures\/truncate/);
			expect(body).not.toMatch(/\btruncateTables\b/);
		});
	}

	it("_lib modules do not import the test-only truncate fixture either", () => {
		const FORBIDDEN = /import[\s\S]*?_fixtures\/truncate/;
		// Positive control — see the note above (Q-I).
		expect(
			'import { truncateTables } from "../../db/_fixtures/truncate";',
		).toMatch(FORBIDDEN);

		const files = readdirSync(`${STAGING_DIR}_lib`);
		expect(files.length).toBeGreaterThan(0);
		for (const file of files) {
			const body = readFileSync(`${STAGING_DIR}_lib/${file}`, "utf8");
			expect({
				file,
				imports: /import[\s\S]*?_fixtures\/truncate/.test(body),
			}).toEqual({
				file,
				imports: false,
			});
		}
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

describe("the batch bounds lock wait (ruling 2)", () => {
	// Comments stripped: reset.ts DISCUSSES statement_timeout at length to
	// explain why it is deliberately absent, so a raw scan finds the prose and
	// asserts against the wrong thing — the same trap the runner's own header
	// set for the it()-block scan above.
	const mechanism = stripComments(
		readFileSync(`${STAGING_DIR}_lib/reset.ts`, "utf8"),
	);

	it("issues SET LOCAL lock_timeout, not a session-scoped SET", () => {
		// Session-scoped would leak into the pooled connection and silently
		// apply to every later query on it.
		expect(mechanism).toMatch(/SET LOCAL lock_timeout = '\$\{LOCK_TIMEOUT\}'/);
		// Positive control for the negative below (Q-I).
		expect("SET lock_timeout = '15s';").toMatch(/SET lock_timeout/);
		expect(mechanism).not.toMatch(/SET lock_timeout/);
	});

	it("places the timeout INSIDE the batch, before the disable", () => {
		// Outside the batch it would be its own transaction and revert
		// immediately, bounding nothing. F1 measured that it DOES bind inside a
		// multi-statement simple-query batch; this pins that it stays there.
		expect(mechanism).toMatch(
			/return\s*`\$\{LOCK_TIMEOUT_STATEMENT\}\\n\$\{disable\}/,
		);
	});

	it("sends the whole batch as exactly ONE client.unsafe round-trip", () => {
		// ADR-0035 primitive 2's PRIMARY mechanism. Split into separate
		// round-trips, each statement commits on its own and a crash between them
		// strands the guards disabled. The integration suite proves the rollback
		// behaviourally; this pins the shape, so a split is caught at the unit
		// layer too rather than only by a database that happens to be reachable.
		const sends = mechanism.match(/client\.unsafe\(/g) ?? [];
		// Two, and only two: the batch, and the belt's re-enable.
		expect(sends).toHaveLength(2);
		expect(mechanism).toMatch(/client\.unsafe\(buildResetBatch\(tables\)\)/);
	});

	it("sets no statement_timeout — execution is deliberately unbounded", () => {
		// Positive control for the negative (Q-I): prove the matcher fires, and
		// prove `mechanism` is the real file rather than an empty read.
		expect("SET LOCAL statement_timeout = '60s';").toMatch(/statement_timeout/);
		expect(mechanism).toMatch(/runGuardedReset/);
		expect(mechanism).not.toMatch(/statement_timeout/);
	});
});
