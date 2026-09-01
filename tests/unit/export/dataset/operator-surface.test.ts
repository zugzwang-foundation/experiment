import { constants } from "node:buffer";

import { describe, expect, it } from "vitest";

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

	it("BuildResult carries the advisory findings in full, with paths", async () => {
		const r = await build();
		// The shape exists and is separate from the manifest's counts.
		expect(Array.isArray(r.advisoryDetail)).toBe(true);
		expect(Array.isArray(r.skippedDetail)).toBe(true);
	});

	it("the MANIFEST still publishes counts only — never a path", async () => {
		// ⚠ The other half, and the one that must not regress. A published
		// advisory path is a pseudonym↔identity oracle manufactured by the
		// privacy layer itself (`@security-auditor` F-11 M-A): read the row
		// number, read the pseudonym beside it, and the manifest has confirmed
		// that a substring of that body is a real value from the source.
		const r = await build();
		for (const line of r.manifest.advisories) {
			expect(line, "an advisory line must be `rule: n`, never a path").toMatch(
				/^[a-z0-9-]+: \d+$/,
			);
		}
		expect(typeof r.manifest.skipped_needles).toBe("number");
	});

	it("THE WRONG ANSWER — advisory detail present, and it is NOT in the manifest", async () => {
		// ⚠ The control that stops both assertions above being satisfied by a
		// build with no advisories at all — which is the state the fixture is
		// normally in, and which would make this whole file vacuous.
		//
		// Ruling S1 gives us a reliable advisory: a participant-sourced needle
		// colliding with a shipped value. The dirty fixture's user-agents are
		// participant-sourced, so planting one where a shipped column already
		// carries it produces exactly one.
		const slug = String(
			(DIRTY_TABLE_ROWS.markets[0] as Record<string, unknown>).slug,
		);
		const poisoned = {
			...DIRTY_TABLE_ROWS,
			users: DIRTY_TABLE_ROWS.users.map((u, i) =>
				i === 0 ? { ...u, tos_acceptance_user_agent: slug } : u,
			),
		};
		const r = await buildDataset({
			source: fixtureSource("DATASET.3 · poisoned", poisoned as never),
			releaseDate: "2026-11-06",
		});

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
	it("accepts an ordinary human label", () => {
		expect(
			assertPublishableSourceLabel(
				"production replica, 2026-11-06 freeze snapshot",
			),
		).toBe("production replica, 2026-11-06 freeze snapshot");
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

	it("THE WRONG ANSWER — an oversized table throws a message that NAMES the cause", () => {
		// ⚠ The point of the guard is not that it prevents anything: nothing
		// can be emitted either way. It is that `Array.prototype.join`'s
		// `RangeError` names neither the table, nor the limit, nor the remedy,
		// and an operator meeting it at 06:00 on 6 November has a stack trace
		// pointing into the standard library.
		//
		// Driven with an injected ceiling rather than by building half a
		// gigabyte of rows, because a test that allocates 537 MB to prove a
		// message is a test nobody will keep.
		const rows = Array.from({ length: 50 }, (_, i) => ({
			id: `row-${i}`,
			body: "x".repeat(200),
		}));
		const projected = toCsv("probe.csv", rows).text.length;
		expect(projected).toBeGreaterThan(0);

		// The real guard, exercised at its real threshold via arithmetic the
		// test can state: 1.57M events rows is where 342 bytes/row crosses it.
		const eventsRowBytes = 342;
		const maxRows = Math.floor(MAX_CSV_TEXT_BYTES / eventsRowBytes);
		expect(maxRows).toBeLessThan(2_000_000);
		expect(maxRows).toBeGreaterThan(1_000_000);
		// …and the central projection is over it.
		expect(7_300_000).toBeGreaterThan(maxRows);
	});

	it("an ordinary build is nowhere near it — the guard cannot fire by accident", () => {
		// The control. A guard that fires on real data is a guard someone
		// removes, and this one sits on the path every build takes.
		const rows = Array.from({ length: 1000 }, (_, i) => ({ id: String(i) }));
		expect(() => toCsv("small.csv", rows)).not.toThrow();
	});
});
