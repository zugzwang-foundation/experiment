import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildDataset } from "@/server/export/dataset/build";
import {
	type DatasetDb,
	drizzleSource,
} from "@/server/export/dataset/drizzle-source";
import { shippedTables } from "@/server/export/dataset/inventory";
import { fixtureSource } from "@/server/export/dataset/source";
import { EgressContractGapError } from "@/server/export/egress/errors";
import {
	DIRTY_TABLE_ROWS,
	REMOVED_COMMENT_BODY,
	REMOVED_COMMENT_ID,
} from "../_fixtures/dataset/dirty-source";
import {
	DATASET_FIXTURE_TABLES,
	SEEDED_DIVERGENCES,
	seedDatasetFixture,
} from "../_fixtures/dataset/seed-live";
import { testClient, testDb } from "../db/_fixtures/db";
import { truncateTables } from "../db/_fixtures/truncate";

/**
 * DATASET.2 Slice 5 — **the round-trip equivalence test. The exit criterion.**
 *
 * Seed the dirty fixture into real Postgres → read it back through the LIVE
 * `drizzleSource` → build → assert the output is byte-identical to the
 * in-memory fixture build.
 *
 * ## Why this is the test that matters
 *
 * The in-memory fixture proved the **transform**: twelve mutation-verified
 * guards, an egress layer that catches a raw `users.id` under any key at any
 * depth. Every one of those proofs is about rows that a JS literal handed to
 * the pipeline.
 *
 * This proves the **reader hands the transform the same thing the fixture
 * did** — which is the single claim that carries all of those proofs across
 * onto real data. Without it, DATASET.1's guarantees are guarantees about a
 * pipeline whose input arrives from a source nobody ships.
 *
 * ## The wrong answers it must reject, and how
 *
 * Each of these passes every existing test and changes the published bytes:
 *
 *   · **a dropped column** — caught by comparing the CSV header and the full
 *     text, per table, not just row counts;
 *   · **non-deterministic row order** — caught because the comparison is
 *     byte-exact and the fixture's order is fixed. A reader without
 *     `ORDER BY` passes intermittently, which is worse than failing;
 *   · **`Date` where the fixture returned a string** — the reason
 *     `escapeField` has a `Date` branch at all. `@code-reviewer` M-8 found it
 *     triple-quoting `created_at` (`"""2026-…"""`) because
 *     `JSON.stringify(new Date())` returns a string that already contains
 *     quotes. It was latent while the only source was the fixture, and every
 *     shipped table has a `created_at`. **This test is the first thing that
 *     makes it fire**, so there is an explicit assertion for it below rather
 *     than only the aggregate byte comparison.
 *
 * ⚠ **Local ephemeral Postgres only** (`DATABASE_URL` → `:54322`). Never
 * staging, never production — brief §5 wall 1.
 */

const RELEASE_DATE = "2026-11-06";

let fixtureBuild: Awaited<ReturnType<typeof buildDataset>>;
let liveBuild: Awaited<ReturnType<typeof buildDataset>>;

beforeAll(async () => {
	await truncateTables(testClient, DATASET_FIXTURE_TABLES);
	await seedDatasetFixture(testClient);

	fixtureBuild = await buildDataset({
		source: fixtureSource("fixture", DIRTY_TABLE_ROWS as never),
		releaseDate: RELEASE_DATE,
	});

	liveBuild = await buildDataset({
		source: drizzleSource(testDb, "fixture"),
		releaseDate: RELEASE_DATE,
	});
}, 60_000);

afterAll(async () => {
	await truncateTables(testClient, DATASET_FIXTURE_TABLES);
});

describe("round-trip · the live reader reproduces the fixture build", () => {
	it("emits the same table set, in the same order", () => {
		expect(liveBuild.artifacts.map((a) => a.filename)).toEqual(
			fixtureBuild.artifacts.map((a) => a.filename),
		);
		// Control: there ARE tables. A pipeline that emitted nothing would
		// satisfy the equality above without reading anything at all.
		expect(liveBuild.artifacts.length).toBe(shippedTables().length);
	});

	it("emits an IDENTICAL column set for every table", () => {
		// Split out from the byte comparison deliberately. A dropped column
		// fails the byte comparison too, but with a diff of the entire file —
		// this names the column, which is the difference between a two-minute
		// fix and an hour on a conference morning.
		for (const fixtureArtifact of fixtureBuild.artifacts) {
			const live = liveBuild.artifacts.find(
				(a) => a.filename === fixtureArtifact.filename,
			);
			expect(
				live,
				`missing artifact ${fixtureArtifact.filename}`,
			).toBeDefined();
			expect(
				live?.columns,
				`column set drift in ${fixtureArtifact.filename}`,
			).toEqual(fixtureArtifact.columns);
		}
	});

	it("emits BYTE-IDENTICAL CSV text for every table", () => {
		for (const fixtureArtifact of fixtureBuild.artifacts) {
			const live = liveBuild.artifacts.find(
				(a) => a.filename === fixtureArtifact.filename,
			);
			expect(live?.text, `byte drift in ${fixtureArtifact.filename}`).toBe(
				fixtureArtifact.text,
			);
		}
	});

	it("produces the same content_sha256 — the whole-archive claim", () => {
		// `content_sha256` is the hash of the UNCOMPRESSED tar, which is the
		// one that does not move across zlib versions. If this matches, the
		// live reader and the fixture produced the same archive.
		expect(liveBuild.manifest.content_sha256).toBe(
			fixtureBuild.manifest.content_sha256,
		);
	});

	it("reports the same per-table row counts", () => {
		const counts = (b: typeof fixtureBuild) =>
			Object.fromEntries(b.manifest.tables.map((t) => [t.name, t.row_count]));
		expect(counts(liveBuild)).toEqual(counts(fixtureBuild));
	});

	it("reaches the same GUARD OUTCOME, not just the same bytes", () => {
		// ⚠ `@code-reviewer` MEDIUM-8. The comparison above covers the
		// artifacts and says nothing about what the egress layer DID while
		// producing them — so a reader change that produced a new advisory, or
		// newly skipped a needle as too short, would pass every other
		// assertion in this file.
		//
		// It is not hypothetical here: the two builds genuinely run with
		// DIFFERENT secret sets. `seed-live.ts` substitutes `[erased]` and
		// `erased-<id>@erased.invalid` for the H2-erased row's NOT NULL
		// `name`/`email`, so `harvestSecrets` puts those two strings into the
		// LIVE build's needle sets and not the fixture's. That changes no byte
		// today — both columns are STRIP and `findValues` is exact-match — and
		// this is what would notice if it ever stopped being true.
		expect(liveBuild.manifest.advisories).toEqual(
			fixtureBuild.manifest.advisories,
		);
		expect(liveBuild.manifest.skipped_needles).toBe(
			fixtureBuild.manifest.skipped_needles,
		);
		expect(liveBuild.manifest.withheld).toEqual(fixtureBuild.manifest.withheld);
	});
});

describe("round-trip · the named wrong answers, each pinned on its own", () => {
	it("created_at is an ISO string, NOT a triple-quoted JSON Date", () => {
		// ⚠ The M-8 regression, made to fire. drizzle hands back a JS `Date`
		// for every `timestamp({ withTimezone: true })` column, so this is the
		// first read on which `escapeField`'s Date branch executes at all.
		// Without it the field ships as `"""2026-10-01T12:00:00.000Z"""` and
		// parses back with literal quotes inside the value.
		const users = liveBuild.artifacts.find((a) => a.filename === "users.csv");
		expect(users).toBeDefined();
		expect(users?.text).not.toContain('"""');
		expect(users?.text).toContain("2026-10-01T12:00:00.000Z");
	});

	it("NUMERIC(38,18) survives as an exact string, never a float", () => {
		// A `Number()` anywhere on this path truncates an 18-decimal balance
		// and the CSV still looks completely normal. Pinned by value.
		const bets = liveBuild.artifacts.find((a) => a.filename === "bets.csv");
		expect(bets?.text).toContain("25.000000000000000000");
		expect(bets?.text).toContain("0.500000000000000000");
		const ledger = liveBuild.artifacts.find(
			(a) => a.filename === "dharma_ledger.csv",
		);
		expect(ledger?.text).toContain("-25.000000000000000000");
	});

	it("the reader returns rows in ASCENDING order-column order", async () => {
		// ⚠ A DIRECT assertion on the ordering property, added after measuring
		// that the byte comparison alone did not have it. Removing the reader's
		// `ORDER BY` left all 18 tests green, because the fixture was seeded in
		// id order and a sequential scan therefore returned the right answer by
		// accident. The seeder now inserts in REVERSE order so physical and id
		// order disagree — and this test states the property directly rather
		// than relying on the byte comparison to imply it.
		const src = drizzleSource(testDb, "probe");
		for (const [table, key] of [
			["events", "event_id"],
			["comments", "id"],
			["mod_actions", "id"],
			["users", "id"],
		] as const) {
			const rows = await src.read(table);
			// Control: a single-row table cannot demonstrate ordering at all.
			expect(
				rows.length,
				`${table} needs >1 row to prove ordering`,
			).toBeGreaterThan(1);
			const keys = rows.map((r) => String(r[key]));
			expect(keys, `${table} not in ascending ${key} order`).toEqual(
				[...keys].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)),
			);
		}
	});

	it("physical insert order DIFFERS from id order — so the test above can fail", async () => {
		// The guard on the guard, and ⚠ my first version of it did not observe
		// the thing it guarded (`@code-reviewer` MEDIUM-9). It asserted only
		// that the FIXTURE is ascending — which stays true if the seeder stops
		// reversing, so the ordering assertion above would go vacuous and this
		// test, written precisely to detect that, would stay green.
		//
		// Reading PHYSICAL order back is what closes it. `ctid` is the
		// on-disk tuple position, so a freshly-seeded table's `ORDER BY ctid`
		// IS its insert order.
		const physical = await testClient`SELECT id FROM comments ORDER BY ctid`;
		const physicalIds = physical.map((r) => String(r.id));
		expect(physicalIds.length).toBeGreaterThan(1);

		const ascending = [...physicalIds].sort((a, b) =>
			a < b ? -1 : a > b ? 1 : 0,
		);
		// Physical order must NOT already be id order — otherwise a reader
		// with no ORDER BY would return the right answer by accident.
		expect(physicalIds).not.toEqual(ascending);
		expect(physicalIds).toEqual([...ascending].reverse());
	});
});

describe("round-trip · R1 is real only if the reader finds the removed set", () => {
	it("the removed body is absent from the LIVE build's bytes", () => {
		// ⚠ The brief's exact warning: *"a reader that returns an empty set
		// silently un-withholds every removed body"*. The transform takes
		// `removedCommentIds` as a required argument, so it cannot be
		// forgotten — but it CAN be handed an empty set by a reader that fails
		// to return `mod_actions.reason`, and nothing would say so.
		const all = liveBuild.artifacts.map((a) => a.text).join("\n");
		expect(all).not.toContain(REMOVED_COMMENT_BODY);
	});

	it("POSITIVE CONTROL — a NON-removed body IS present", () => {
		// Without this, the assertion above passes against a build that
		// published no bodies at all, or no comments at all. This is what makes
		// the absence above mean "withheld" rather than "empty".
		const comments = liveBuild.artifacts.find(
			(a) => a.filename === "comments.csv",
		);
		expect(comments?.text).toContain("The tunnelling is complete");
	});

	it("POSITIVE CONTROL — the removed comment's ROW still ships", () => {
		// §19.4's H2-erasure precedent applied by analogy: the row is
		// preserved so the join graph and the audit trail survive; only the
		// body is withheld. A build that dropped the row would pass the
		// body-absence assertion and silently change every participant and
		// stake total a researcher computes.
		const comments = liveBuild.artifacts.find(
			(a) => a.filename === "comments.csv",
		);
		expect(comments?.text).toContain(REMOVED_COMMENT_ID);
	});

	it("POSITIVE CONTROL — mod_actions still records THAT it was removed", () => {
		const mod = liveBuild.artifacts.find(
			(a) => a.filename === "mod_actions.csv",
		);
		expect(mod?.text).toContain("content_removed");
		expect(mod?.text).toContain(REMOVED_COMMENT_ID);
	});
});

describe("round-trip · the reader never QUERIES an unshipped table", () => {
	const source = drizzleSource(testDb, "probe");

	// ⚠ Each of these asserts the REASON, not merely that something threw —
	// and that is a correction to my own first version, which asserted only
	// `rejects.toBeInstanceOf(EgressContractGapError)`.
	//
	// Measured: mutating the status check to `if (false)` left all three
	// GREEN. With the classification guard disabled, `read("sessions")` fell
	// through to the `ORDER_COLUMN` lookup, found nothing there either, and
	// threw the SAME error class from a completely different guard. The tests
	// passed while the thing they were written to protect was switched off —
	// `@security-auditor` F-4's shape exactly: *a guard passing with the defect
	// restored, because something unrelated made the wrong code right.*
	//
	// Pinning the message is what distinguishes "refused because it is
	// NOT_SHIPPED" from "refused for some other reason on the way past".
	it("refuses NOT_SHIPPED — the read is never issued", async () => {
		// Not read-and-discard: `sessions` holds every participant's session
		// token, and pulling it into the export process is the harm, whatever
		// happens to the rows afterwards.
		await expect(source.read("sessions")).rejects.toThrow(/NOT_SHIPPED/);
		await expect(source.read("admin_sessions")).rejects.toThrow(/NOT_SHIPPED/);
	});

	it("refuses UNDECIDED — reading `lots` would settle it by accident", async () => {
		await expect(source.read("lots")).rejects.toThrow(/UNDECIDED/);
	});

	it("refuses a table absent from the §19.3 inventory entirely", async () => {
		await expect(source.read("not_a_table")).rejects.toThrow(
			/not in the §19\.3 inventory/,
		);
	});

	it("every refusal is an EgressContractGapError", async () => {
		// The class assertion still matters — it is what makes the failures
		// catchable as one kind by the build orchestrator — it just cannot be
		// the ONLY assertion.
		await expect(source.read("sessions")).rejects.toBeInstanceOf(
			EgressContractGapError,
		);
	});

	it("POSITIVE CONTROL — a SHIPPED table reads fine", async () => {
		// The three refusals above are only meaningful if this method can
		// succeed. A `read` that threw unconditionally would pass all of them.
		const rows = await source.read("users");
		expect(rows.length).toBe(DIRTY_TABLE_ROWS.users.length);
	});
});

describe("round-trip · the seeded rows are PRODUCTION-shaped", () => {
	it("every jsonb column stores an OBJECT, never a string scalar", async () => {
		// ⚠⚠ **The `@code-reviewer` CRITICAL, pinned directly — and it has to
		// be pinned directly, because the byte comparison cannot see it.**
		//
		// `bind()` used to `JSON.stringify` objects; combined with the
		// `$N::jsonb` cast, postgres-js applied its own jsonb serializer on
		// top, so values landed as jsonb STRING SCALARS. Two errors then
		// cancelled on the way back out — postgres-js parses the wire text to a
		// JS string, drizzle's `PgJsonb.mapFromDriverValue` sees a string and
		// parses AGAIN — recovering an object, so every byte assertion passed
		// on a shape production never writes.
		//
		// ⚠ **Measured: restoring the double-encode leaves all 21 other tests
		// GREEN.** Canonical JSON makes both sides sort their keys, so the
		// recovered object serialises identically either way. The byte
		// comparison is therefore structurally blind here, and only an
		// assertion about what is IN THE DATABASE can fail.
		//
		// Production writes `${JSON.stringify(data)}::jsonb`
		// (`src/server/events/insert.ts:164`), which yields `'object'`.
		const rows = await testClient`
			SELECT jsonb_typeof(payload) AS p, jsonb_typeof(metadata) AS m
			FROM events`;
		expect(rows.length).toBeGreaterThan(0); // control: there ARE rows
		for (const r of rows) {
			expect(r.p).toBe("object");
			expect(r.m).toBe("object");
		}

		const cats = await testClient`
			SELECT jsonb_typeof(categories) AS t FROM mod_actions`;
		expect(cats.length).toBeGreaterThan(0);
		for (const c of cats) expect(c.t).toBe("object");
	});

	it("POSITIVE CONTROL — jsonb_typeof can return 'string'", async () => {
		// Without this the assertion above could be passing because
		// `jsonb_typeof` never returns 'string' at all.
		const [row] = await testClient`SELECT jsonb_typeof('"x"'::jsonb) AS t`;
		expect(row?.t).toBe("string");
	});
});

describe("round-trip · what the live schema could not hold", () => {
	it("documents every seeded divergence, and there is exactly one", () => {
		// ⚠ This assertion exists so that a SECOND divergence cannot be added
		// silently. Each one is a place where the fixture and the database
		// disagree about what a row can be, and that is a finding every time.
		expect(SEEDED_DIVERGENCES.length).toBe(1);
		expect(SEEDED_DIVERGENCES[0]?.table).toBe("users");
	});

	it("comments.bet_id is NULL in the database — it cannot be otherwise", async () => {
		// The circular `comments` ↔ `bets` pair, with neither FK DEFERRABLE.
		// CLAUDE.md §2 and AGENTS.md both state this is the permanent live
		// state; this measures it against the actual schema rather than
		// citing them.
		const rows = await testClient`SELECT bet_id FROM comments`;
		expect(rows.length).toBeGreaterThan(0);
		for (const r of rows) expect(r.bet_id).toBeNull();
	});
});
