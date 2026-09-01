import { constants } from "node:buffer";

import { describe, expect, it, vi } from "vitest";

import {
	assertPublishableSourceLabel,
	buildDataset,
} from "@/server/export/dataset/build";
import { MAX_CSV_TEXT_BYTES, toCsv } from "@/server/export/dataset/csv";
import { fixtureSource } from "@/server/export/dataset/source";
import { COLUMN_TREATMENTS } from "@/server/export/dataset/treatments";
import { FREE_TEXT_COLUMNS } from "@/server/export/egress/assertions";

import { DIRTY_TABLE_ROWS } from "../../../_fixtures/dataset/dirty-source";

/**
 * DATASET.3 Slice 5 · **the four LOW findings, each of which is the same
 * shape.**
 *
 * All four are `O-13`: *an endpoint that cannot answer has not answered*,
 * applied to prose rather than to an API. Each was a sentence describing a
 * mechanism, sitting beside code that did not implement it — and prose is the
 * thing a later reader checks against, so a false one is worse than a silent
 * gap.
 *
 *   · **L-1** — `build.ts` said *"the operator gets the paths on the build
 *     console"*. The array holding the paths was local and discarded; only
 *     counts survived.
 *   · **L-2** — `skipped_needles` publishes a per-needle-per-rule-per-artifact
 *     product as one integer, with no rule attached to any of it.
 *   · **L-4** — `manifest.source` is an unconstrained caller string, and the
 *     release task will construct it next to a `DATABASE_URL`.
 *   · **L-5** — `FREE_TEXT_COLUMNS` named `resolution_note`, which no shipped
 *     table has. A phantom entry READS as coverage.
 */

describe("L-1/L-2 · the operator-only detail actually leaves the build", () => {
	async function build() {
		return buildDataset({
			source: fixtureSource("DATASET.3 · operator surface", DIRTY_TABLE_ROWS),
			releaseDate: "2026-11-06",
		});
	}

	/**
	 * A build that genuinely produces advisories.
	 *
	 * Ruling S1 gives a reliable one: a participant-sourced needle colliding
	 * with a value the dataset ships. The dirty fixture's user-agents are
	 * participant-sourced, so planting one where a shipped column already
	 * carries it produces exactly that.
	 */
	async function poisonedBuild() {
		const slug = String(
			(DIRTY_TABLE_ROWS.markets[0] as Record<string, unknown>).slug,
		);
		return buildDataset({
			source: fixtureSource("DATASET.3 · poisoned", {
				...DIRTY_TABLE_ROWS,
				users: DIRTY_TABLE_ROWS.users.map((u, i) =>
					i === 0 ? { ...u, tos_acceptance_user_agent: slug } : u,
				),
			} as never),
			releaseDate: "2026-11-06",
		});
	}

	it("BuildResult carries the advisory findings in full, with paths", async () => {
		// ⚠ **These two assertions were `Array.isArray(...)` on a CLEAN build,
		// and the clean fixture produces ZERO advisories and ZERO skipped
		// needles** (measured: `manifest.advisories === []`,
		// `skipped_needles === 0`). `Array.isArray([])` is `true`, so both were
		// satisfied by the empty arrays that L-1 and L-2 were reported for —
		// the shape existed and carried nothing, which is exactly the state the
		// findings describe. Returning `advisoryDetail: []` and
		// `skippedDetail: []` from `build.ts` left this suite green (measured).
		//
		// So the shape is now asserted on a build that HAS both, and the
		// emptiness of the clean build is asserted separately, as its own claim.
		const clean = await build();
		expect(clean.advisoryDetail).toEqual([]);
		expect(clean.skippedDetail).toEqual([]);
		expect(clean.manifest.advisories).toEqual([]);
		expect(clean.manifest.skipped_needles).toBe(0);
	});

	it("L-2 · a short needle REACHES the operator with its rule attached", async () => {
		// ⚠ `MIN_NEEDLE_LENGTH`'s docblock promises skipped needles are
		// *"REPORTED rather than silently dropped, because a guard that quietly
		// stops covering a class is the failure this whole layer exists to
		// prevent"* — and `manifest.skipped_needles` is a bare COUNT of a
		// per-needle-per-rule-per-artifact product, which is why L-2 asked for
		// the breakdown on the console. **Nothing fired it.** The clean fixture
		// skips nothing, so both halves read zero and agreed with a `[]`.
		//
		// One participant named "Li" is the whole driver — no attacker, and
		// `@security-auditor` H-4's own measured case.
		const shortName = {
			...DIRTY_TABLE_ROWS,
			users: DIRTY_TABLE_ROWS.users.map((u, i) =>
				i === 0 ? { ...u, name: "Li" } : u,
			),
		};
		const r = await buildDataset({
			source: fixtureSource("DATASET.3 · short needle", shortName as never),
			releaseDate: "2026-11-06",
		});

		// The COUNT ships, because a non-zero one means a class is not fully
		// covered and the reader of a published manifest is entitled to know.
		expect(r.manifest.skipped_needles).toBeGreaterThan(0);
		// …and the BREAKDOWN reaches the operator, which is the half L-2 added.
		expect(r.skippedDetail.length).toBe(r.manifest.skipped_needles);
		expect(r.skippedDetail.map((s) => s.rule)).toContain("no-display-name");
		expect(r.skippedDetail.every((s) => s.length === 2)).toBe(true);

		// ⚠ The manifest carries the number and NOT the breakdown — the same
		// publication line the advisory tier draws. A published
		// `no-display-name: 2 chars` tells a reader which class is uncovered on
		// an artifact they can then go looking through.
		expect(JSON.stringify(r.manifest)).not.toContain("no-display-name");
	});

	it("the MANIFEST still publishes counts only — never a path", async () => {
		// ⚠ The other half, and the one that must not regress. A published
		// advisory path is a pseudonym↔identity oracle manufactured by the
		// privacy layer itself (`@security-auditor` F-11 M-A): read the row
		// number, read the pseudonym beside it, and the manifest has confirmed
		// that a substring of that body is a real value from the source.
		//
		// ⚠ **Driven on the POISONED build, because the clean one has no
		// advisories at all** — this loop's body never executed, so the
		// `rule: n` shape it exists to pin was asserted zero times.
		const r = await poisonedBuild();
		expect(
			r.manifest.advisories.length,
			"control: the loop below must have something to iterate",
		).toBeGreaterThan(0);
		for (const line of r.manifest.advisories) {
			expect(line, "an advisory line must be `rule: n`, never a path").toMatch(
				/^[a-z0-9-]+: \d+$/,
			);
		}
		expect(typeof r.manifest.skipped_needles).toBe("number");
	});

	it("THE WRONG ANSWER — advisory detail present, and it is NOT in the manifest", async () => {
		// ⚠ The control that stops the assertions above being satisfied by a
		// build with no advisories at all — which is the state the fixture is
		// normally in, and which would make this whole file vacuous.
		const r = await poisonedBuild();

		expect(r.advisoryDetail.length).toBeGreaterThan(0);
		// The detail carries a PATH…
		expect(r.advisoryDetail.some((a) => a.path.length > 0)).toBe(true);
		// …and the manifest carries none of them.
		expect(JSON.stringify(r.manifest)).not.toContain(
			r.advisoryDetail[0]?.path ?? " never",
		);
	});
});

describe("L-4 · manifest.source cannot be a connection string", () => {
	// ⚠⚠ **THE ACCEPT SIDE WAS ONE LABEL, AND IT WAS THE ONLY ONE WITH NO
	// CLOCK TIME IN IT.** That is precisely how `@code-reviewer` H-1 shipped:
	// the M-1 widening added a bare `host:port` net written
	// `/\b[\w.-]+:\d{2,5}\b/`, which matches `23:59` as readily as
	// `db.x.supabase.co:5432`, and the guard then REFUSED the three most
	// natural labels an operator would write — while telling them their label
	// *"looks like a URL or a connection string"*. The freeze is DEFINED as
	// `2026-11-05 23:59 UTC`, so naming the time is the obvious thing to do.
	//
	// The fix narrowed the host side to a dotted name ending in a
	// letters-only label. **It landed with no test**: reverting it to the broad
	// pattern left all 356 tests in this suite green (measured). A fix whose
	// test cannot fail is half a fix, and this one is on the path of a job that
	// gets one attempt at 06:00 on a conference morning.
	//
	// The three clock-bearing labels below are the ones the reviewer measured
	// as rejected. They are the guard's real accept case; the clock-free one is
	// kept beside them as the pre-existing control.
	it.each([
		["no clock at all", "production replica, 2026-11-06 freeze snapshot"],
		[
			"the freeze instant, named",
			"production replica, 2026-11-05 23:59 UTC freeze snapshot",
		],
		["a wall-clock time", "production replica, taken at 06:00 on 2026-11-06"],
		["a midnight boundary", "production rows as of 2026-11-06 00:00 UTC"],
	])("ACCEPTS an ordinary human label with %s", (_name, label) => {
		expect(assertPublishableSourceLabel(label)).toBe(label);
	});

	it.each([
		[
			"a postgres URL",
			"postgresql://zz:hunter2@db.example.supabase.co:5432/postgres",
		],
		["a bare scheme", "postgres://localhost/postgres"],
		["userinfo only", "zz:hunter2@somehost"],
		["a host:port after an @", "reading from @db-prod-1:5432 tonight"],
		// ⚠ The two forms `@security-auditor` M-1 found missing. The libpq
		// keyword string is a first-class Postgres connection string and is
		// what a hand-assembled one usually looks like — both original nets
		// required a `://` or an `@`, so both of these passed.
		["a BARE host:port", "db.abcdefghijkl.supabase.co:5432"],
		[
			"a pooler host:port",
			"aws-0-ap-south-1.pooler.supabase.com:5432 postgres.abcdefghijkl",
		],
		[
			"the libpq keyword form",
			"host=db.abc.supabase.co port=5432 user=postgres password=hunter2",
		],
		["a Supabase service key", "sbp_0123456789abcdef0123456789abcdef01234567"],
	])("REFUSES %s", (_name, label) => {
		expect(() => assertPublishableSourceLabel(label)).toThrow(
			/egress_contract_gap/,
		);
	});

	it("REFUSES an empty or absurdly long label", () => {
		expect(() => assertPublishableSourceLabel("   ")).toThrow();
		expect(() => assertPublishableSourceLabel("x".repeat(201))).toThrow();
	});

	it("the guard is WIRED — buildDataset refuses, not just the helper", () => {
		// ⚠ Without this, the helper could be perfect and unreferenced —
		// which is the exact condition L-1 and L-4 were both reported for. A
		// guard nothing calls is a guard that does not exist.
		return expect(
			buildDataset({
				source: fixtureSource(
					"postgresql://zz:hunter2@db.example.com:5432/postgres",
					DIRTY_TABLE_ROWS,
				),
				releaseDate: "2026-11-06",
			}),
		).rejects.toThrow(/manifest\.source/);
	});

	it("…and refuses BEFORE the first read — the test COUNTS reads", async () => {
		// ⚠ **A throw cannot tell step one from step six**, which is why this
		// counts rather than asserts. `@code-reviewer` H-1's second half was
		// that the label was validated inside the manifest construction — after
		// all sixteen reads, the strip, the pseudonymize, every guard, the CSV
		// writes, the tar and two sha256 passes — so a bad label threw away the
		// whole run and `buildDataset` returned nothing. That contradicted
		// `build.ts`'s own first stated principle: *"contract checks run BEFORE
		// the first read."*
		//
		// The fix moved the call to step zero and **landed with no test**:
		// moving it back to just before the harvest left this whole suite green
		// (measured). The `rejects.toThrow` above passes in both worlds, because
		// both worlds throw.
		//
		// Modelled on `contract-gap-strip-rules.test.ts`'s read-counting probe,
		// which pins the same claim for `assertShipRulesComplete`.
		let readAttempts = 0;
		const source = {
			label: "host=db.abc.supabase.co port=5432 password=hunter2",
			read: async () => {
				readAttempts++;
				return [];
			},
		};

		await expect(
			buildDataset({ source, releaseDate: "2026-11-06" }),
		).rejects.toThrow(/manifest\.source/);
		expect(
			readAttempts,
			"the label is caller-supplied and knowable at step zero; a run that " +
				"has already read a table has already spent the operator's one shot",
		).toBe(0);
	});
});

describe("L-5 · FREE_TEXT_COLUMNS names only REAL columns", () => {
	/** Every column name on every shipped table, from the treatment map. */
	const liveColumnNames = new Set(
		Object.values(COLUMN_TREATMENTS).flatMap((cols) => Object.keys(cols)),
	);

	it("POSITIVE CONTROL — the column inventory is not empty", () => {
		// Without this, "every entry is real" passes against an empty set.
		expect(liveColumnNames.size).toBeGreaterThan(50);
		expect(liveColumnNames.has("body")).toBe(true);
	});

	it("every free-text column exists on a shipped table", () => {
		const phantoms = [...FREE_TEXT_COLUMNS].filter(
			(c) => !liveColumnNames.has(c),
		);
		expect(
			phantoms,
			"a FREE_TEXT_COLUMNS entry names a column no shipped table has — it " +
				"reads as coverage and provides none",
		).toEqual([]);
	});

	it("THE WRONG ANSWER — the removed phantom is detected", () => {
		// The control. `resolution_note` was the real entry
		// (`@security-auditor` L-5); the real column is
		// `resolution_events.reason`, which is deliberately NOT downgraded
		// because it is ADMIN free text on a shipped column.
		expect(liveColumnNames.has("resolution_note")).toBe(false);
		expect(FREE_TEXT_COLUMNS.has("resolution_note")).toBe(false);
		const withPhantom = [...FREE_TEXT_COLUMNS, "resolution_note"];
		expect(withPhantom.filter((c) => !liveColumnNames.has(c))).toEqual([
			"resolution_note",
		]);
	});

	it("`reason` is NOT downgraded — that omission is a decision", () => {
		// It is a real column on `mod_actions` and `resolution_events`, and it
		// SHIPS. Listing it would silence a transform failure on two shipped
		// columns (`@security-auditor` F-11 H-C's argument, one column over).
		expect(liveColumnNames.has("reason")).toBe(true);
		expect(FREE_TEXT_COLUMNS.has("reason")).toBe(false);
	});
});

describe("C7 · the V8 string ceiling, measured rather than projected", () => {
	// ⚠ Brief §4 Slice 5 asks for **a number, not a plan**: how large is the
	// artifact at 100k users over 51 days, and does materialising every table
	// three times fit in the release box?
	//
	// The answer turned out to be sharper than a memory question, and it is a
	// finding for the release rehearsal:
	//
	//   · measured per-row emitted CSV cost, from a real build of the dirty
	//     fixture: `events` **342 bytes/row**, `bets` 222, `comments` 171,
	//     `dharma_ledger` 173, `users` 201;
	//   · a central model for 100k users over 51 days (10 active days each,
	//     3 bets per active day) puts `events` at ~7.3M rows ≈ **2.5 GB**, and
	//     the whole archive at **~5.7 GB uncompressed / ~0.8 GB gzipped**;
	//   · `toCsv` builds each file as ONE string, and V8 caps a string at
	//     `buffer.constants.MAX_STRING_LENGTH` — **536,870,888 bytes** on this
	//     runtime.
	//
	// ⇒ `events.csv` throws at **~1.57 million rows**, which the central model
	// exceeds by **4.7×**. The build does not run slowly or use too much
	// memory; it throws `RangeError: Invalid string length` and stops.
	//
	// Node's heap limit here is 4.50 GB, so the three-times materialisation
	// would not have fitted either — but the string ceiling is hit first, by a
	// wide margin, and it is the one that produces a message naming nothing.

	it("the ceiling is read from the RUNTIME, never hardcoded", () => {
		expect(MAX_CSV_TEXT_BYTES).toBe(constants.MAX_STRING_LENGTH);
		// A sanity floor: if this is ever tiny, the guard would fire on
		// ordinary builds and someone would delete it.
		expect(MAX_CSV_TEXT_BYTES).toBeGreaterThan(100_000_000);
	});

	it("the PROJECTION arithmetic — 342 B/row crosses the ceiling at ~1.57M rows", () => {
		// The C7 measurement itself, kept as arithmetic because that is what it
		// is: a number for the release rehearsal, not a guard.
		//
		// ⚠ **It is NOT a test of the guard, and it used to be named as
		// though it were.** This block was called *"THE WRONG ANSWER — an
		// oversized table throws a message that NAMES the cause"* and asserted
		// only the three lines below; its comment claimed it was *"driven with
		// an injected ceiling"*, and `toCsv` has no ceiling parameter. Deleting
		// the throw from `csv.ts` outright left every test in this suite green
		// (measured: 377/377). The drive is the next test; the arithmetic is
		// this one, and separating them is what stops one being read as the
		// other.
		const rows = Array.from({ length: 50 }, (_, i) => ({
			id: `row-${i}`,
			body: "x".repeat(200),
		}));
		expect(toCsv("probe.csv", rows).text.length).toBeGreaterThan(0);

		const eventsRowBytes = 342;
		const maxRows = Math.floor(MAX_CSV_TEXT_BYTES / eventsRowBytes);
		expect(maxRows).toBeLessThan(2_000_000);
		expect(maxRows).toBeGreaterThan(1_000_000);
		// …and the central projection is over it.
		expect(7_300_000).toBeGreaterThan(maxRows);
	});

	it("THE WRONG ANSWER — an oversized table throws a message that NAMES the cause", async () => {
		// ⚠ The point of the guard is not that it prevents anything: nothing
		// can be emitted either way. It is that `Array.prototype.join`'s
		// `RangeError` names neither the table, nor the limit, nor the remedy,
		// and an operator meeting it at 06:00 on 6 November has a stack trace
		// pointing into the standard library. So the message IS the artifact
		// under test, and it has to be read off the real throw.
		//
		// ⚠ **The ceiling is genuinely injected here, by stubbing the RUNTIME
		// constant the module reads at load.** `csv.ts` does
		// `export const MAX_CSV_TEXT_BYTES = constants.MAX_STRING_LENGTH`, so a
		// `vi.doMock` of `node:buffer` plus a fresh import gives a module whose
		// ceiling is 512 characters — the same code path, the same comparison,
		// the same throw, reachable in a millisecond. Building 537 MB of rows to
		// prove a sentence is a test nobody keeps, and a test nobody keeps is
		// how this guard came to have none.
		//
		// `vi.doMock` (not `vi.mock`) because it must NOT hoist: the statically
		// imported `MAX_CSV_TEXT_BYTES` above is pinned to the REAL runtime
		// constant by the test two blocks up, and that pin is what stops this
		// stub from becoming the only thing either test ever sees.
		vi.resetModules();
		vi.doMock("node:buffer", async (importOriginal) => {
			const actual = await importOriginal<typeof import("node:buffer")>();
			return {
				...actual,
				constants: { ...actual.constants, MAX_STRING_LENGTH: 512 },
			};
		});
		try {
			const csv = await import("@/server/export/dataset/csv");

			// CONTROL — the stub actually reached the module. Without this the
			// throw below could be absent and the test would pass on a
			// `not.toThrow` that nobody wrote, or the ceiling could still be
			// 536,870,888 and the "oversized" rows below would be tiny.
			expect(csv.MAX_CSV_TEXT_BYTES).toBe(512);

			// CONTROL — a file UNDER the ceiling still writes. A guard that
			// fires on everything is not a guard.
			expect(() =>
				csv.toCsv("small.csv", [{ id: "1", body: "x".repeat(100) }]),
			).not.toThrow();

			let caught: unknown;
			try {
				csv.toCsv(
					"events.csv",
					Array.from({ length: 20 }, (_, i) => ({
						id: `row-${i}`,
						body: "x".repeat(200),
					})),
				);
			} catch (e) {
				caught = e;
			}
			expect(caught, "the ceiling guard must fire").toBeDefined();

			// ⚠ Assert the CONTENT, not that it threw. `Array.prototype.join`
			// throws too — `RangeError: Invalid string length` — so a bare
			// `toThrow()` is satisfied by the exact failure this guard exists to
			// replace, and would certify a message that does not exist.
			const message = String((caught as Error).message);
			expect(message, "names the FILE").toContain("events.csv");
			expect(message, "names the LIMIT").toContain("512");
			expect(message, "names the ROW COUNT").toContain("20 rows");
			expect(message, "names the REMEDY").toContain("Streaming the export");
			expect(message, "names the carried item").toContain("C7");
			// …and it is NOT the bare standard-library error.
			expect(message).not.toBe("Invalid string length");
		} finally {
			vi.doUnmock("node:buffer");
			vi.resetModules();
		}
	});

	it("an ordinary build is nowhere near it — the guard cannot fire by accident", () => {
		// The control. A guard that fires on real data is a guard someone
		// removes, and this one sits on the path every build takes.
		const rows = Array.from({ length: 1000 }, (_, i) => ({ id: String(i) }));
		expect(() => toCsv("small.csv", rows)).not.toThrow();
	});
});
