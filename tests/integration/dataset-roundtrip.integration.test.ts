import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildDataset } from "@/server/export/dataset/build";
import {
	type DatasetDb,
	drizzleSource,
	withDatasetSnapshot,
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
		// ⚠ The M-8 regression, kept. It was the first read on which
		// `escapeField`'s `Date` branch executed at all, because drizzle handed
		// back a JS `Date` for every `timestamp({ withTimezone: true })`
		// column; without that branch the field shipped as
		// `"""2026-10-01T…"""` and parsed back with literal quotes inside.
		//
		// ⚠ Ruling S6 (DATASET.3) means the reader no longer produces a
		// `Date` for these columns at all — it reads them as text — so this
		// now guards the OUTCOME rather than that one branch. The branch stays
		// in `escapeField` and stays unit-tested: it is reachable by any other
		// `Date`-producing source, and deleting it would be a different change.
		const users = liveBuild.artifacts.find((a) => a.filename === "users.csv");
		expect(users).toBeDefined();
		expect(users?.text).not.toContain('"""');
		expect(users?.text).toContain("2026-10-01T12:00:00.123456Z");
	});

	it("S6 · timestamps emit FULL STORED PRECISION — six fractional digits", () => {
		// ⚠⚠ **This test was impossible to write until the fixture was
		// widened, and that is the whole story of ruling S6.** Every
		// `created_at` in the dirty fixture was `…T12:00:00.000Z` — three
		// digits — so a reader that floored microseconds at the driver
		// produced bytes IDENTICAL to one that did not, and the round-trip
		// comparison could not tell them apart. `@security-auditor` H-3
		// recorded that as *"blind by construction"* and could go no further.
		//
		// Widening the fixture to `.123456Z` FIRST, before touching the
		// reader, turned the existing byte comparison red on three tests and
		// named the cause. This is the direct assertion that replaces it.
		//
		// The mechanism, for a reader who wonders why it is not fixed in
		// `escapeField`: a JS `Date` holds milliseconds and Postgres holds
		// microseconds, so the precision was gone at the DRIVER, before any
		// formatting code saw the value. It has to be kept in the SQL.
		for (const name of ["users.csv", "events.csv", "bets.csv"]) {
			const a = liveBuild.artifacts.find((x) => x.filename === name);
			expect(a, `${name} is missing`).toBeDefined();
			expect(a?.text, `${name} lost sub-millisecond precision`).toContain(
				".123456Z",
			);
			// …and NOT the truncated form, so this cannot pass on a file that
			// happens to contain both.
			expect(a?.text).not.toContain("12:00:00.123Z");
		}
	});

	it("S6 · the DATABASE really holds microseconds — the seed is not the fiction", () => {
		// ⚠ The control without which the assertion above is a statement about
		// two pieces of JavaScript agreeing. A `timestamptz` passed as a BIND
		// PARAMETER goes through postgres-js's `Date`-based serializer and is
		// floored to milliseconds before Postgres ever sees it — so the fixture
		// could carry `.123456` and the database could hold `.123`, the reader
		// would faithfully return three digits, the round-trip would agree, and
		// nothing in the suite would ever have held a microsecond.
		//
		// The seeder therefore inlines the literal. This reads the stored value
		// back out of the catalogue, not out of the reader.
		return testClient<{ micros: string }[]>`
			SELECT to_char(created_at AT TIME ZONE 'UTC', 'US') AS micros
			FROM users LIMIT 1
		`.then((rows) => {
			expect(rows[0]?.micros).toBe("123456");
		});
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
	it("POSITIVE CONTROL — the DATABASE holds the body, and the READER returns it", async () => {
		// ⚠⚠ **The control this block was missing, and its absence is the exact
		// shape of `@test-writer` M-5 one arm over.** Every other assertion here
		// is an ABSENCE — "the canary is not in the emitted bytes" — and an
		// absence is only evidence if the thing was present upstream.
		//
		// The fixture arm has that control (`removed-masking.test.ts` asserts the
		// SOURCE row carries the body). The live arm did not, and the two arms
		// are not interchangeable here: the byte-comparison cannot supply it,
		// because a database that stored an EMPTY body would produce a
		// comments.csv byte-identical to one whose body was WITHHELD. Same row
		// count, same header, same empty cell. Every R1 assertion in this file
		// would pass against a seeder that silently failed to write the body.
		//
		// So this reads the database directly, and then reads it back through the
		// live reader — which places the withholding squarely in the TRANSFORM
		// rather than in the read.
		const [stored] = await testClient`
			SELECT body, image_uploads_id FROM comments WHERE id = ${REMOVED_COMMENT_ID}`;
		expect(stored?.body).toBe(REMOVED_COMMENT_BODY);
		expect(stored?.image_uploads_id).not.toBeNull();

		const rows = await drizzleSource(testDb, "probe").read("comments");
		const removed = rows.find((r) => r.id === REMOVED_COMMENT_ID);
		expect(removed?.body).toBe(REMOVED_COMMENT_BODY);
		expect(removed?.image_uploads_id).not.toBeNull();
	});

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

describe("B · the build reads ONE instant — the repeatable-read snapshot", () => {
	// ⚠ Ruling B, DATASET.3. Every read of the release build, and every
	// `count(*)` reconciliation, happens inside one `REPEATABLE READ`,
	// `READ ONLY` transaction — so a writer firing mid-build (today
	// `r2-orphan-sweep`, which is not freeze-gated and appends to `events`
	// every six hours) cannot make the sixteen files describe sixteen
	// different instants.
	//
	// The failure it closes is the quiet one, not the loud one:
	// `image_uploads.csv` shipping `terminal_state = NULL` for a row
	// `events.csv` reports as orphaned, with each file internally consistent
	// and no guard able to notice.

	it("the transaction really is REPEATABLE READ and READ ONLY", async () => {
		// ⚠ Asked of the SERVER, not asserted about the code. A
		// connection-level `default_transaction_read_only` is silently ignored
		// by the Supavisor pooler this project runs behind, so "we set an
		// option" is precisely the kind of claim that needs measuring.
		const seen = await withDatasetSnapshot(testDb, async (tx) => {
			const iso = await tx.execute(
				sql`SELECT current_setting('transaction_isolation') AS v`,
			);
			const ro = await tx.execute(
				sql`SELECT current_setting('transaction_read_only') AS v`,
			);
			return {
				isolation: (iso as unknown as { v: string }[])[0]?.v,
				readOnly: (ro as unknown as { v: string }[])[0]?.v,
			};
		});
		expect(seen.isolation).toBe("repeatable read");
		expect(seen.readOnly).toBe("on");
	});

	it("THE WRONG ANSWER — a write inside the snapshot is REFUSED by Postgres", async () => {
		// The control that makes `READ ONLY` a mechanism rather than a word.
		// Without it, the setting could be ignored — which is exactly what the
		// pooler does to its connection-level twin — and the test above would
		// still pass by reading back a setting nothing enforces.
		let caught: unknown;
		try {
			await withDatasetSnapshot(testDb, async (tx) => {
				await tx.execute(
					sql`INSERT INTO markets (id) VALUES (gen_random_uuid())`,
				);
				return null;
			});
		} catch (e) {
			caught = e;
		}
		expect(caught).toBeDefined();

		// ⚠ **Assert the REASON, not that it threw.** drizzle wraps the driver
		// error as `Failed query: …`, so a `toThrow(/read-only/)` on the outer
		// message fails even though the write was refused — and, worse, the
		// mirror of that mistake passes: a bare `rejects.toThrow()` would be
		// satisfied by a NOT NULL violation on `markets.slug`, which is a
		// different refusal entirely and would certify read-only enforcement
		// that does not exist. That is `@security-auditor` F-4's shape, and
		// this project has recorded it twice — DATASET.2's own refusal tests
		// were pinned to a REASON for exactly this reason.
		const chain: string[] = [];
		for (let e: unknown = caught; e; e = (e as { cause?: unknown }).cause) {
			chain.push(String((e as Error).message ?? e));
		}
		expect(
			chain.join(" | "),
			"the write must be refused BECAUSE the transaction is read-only",
		).toMatch(/read-only transaction/i);

		// POSITIVE CONTROL — the same statement outside the snapshot is
		// refused for a DIFFERENT reason (a not-null column), which proves the
		// match above is about the isolation level and not about the statement
		// being invalid on its own.
		let outside: unknown;
		try {
			await testDb.execute(
				sql`INSERT INTO markets (id) VALUES (gen_random_uuid())`,
			);
		} catch (e) {
			outside = e;
		}
		const outsideChain: string[] = [];
		for (let e: unknown = outside; e; e = (e as { cause?: unknown }).cause) {
			outsideChain.push(String((e as Error).message ?? e));
		}
		expect(outsideChain.join(" | ")).not.toMatch(/read-only transaction/i);
	});

	it("a whole build runs inside it, and matches the un-snapshotted build byte for byte", async () => {
		// The snapshot must not change WHAT is read, only WHEN. A build inside
		// it has to agree with `liveBuild` exactly — same rows, same bytes,
		// same checksum — or the isolation level has quietly changed the
		// answer rather than fixing its consistency.
		const snapshotBuild = await withDatasetSnapshot(testDb, (tx) =>
			buildDataset({
				source: drizzleSource(tx, "B · snapshot"),
				releaseDate: "2026-11-06",
			}),
		);
		expect(snapshotBuild.manifest.content_sha256).toBe(
			liveBuild.manifest.content_sha256,
		);
		// CONTROL — it read real rows, so the equality is not two empty builds
		// agreeing. (A build over sixteen empty tables still reports sixteen
		// tables; this session already made that mistake once.)
		expect(
			snapshotBuild.manifest.tables.find((t) => t.name === "events")?.row_count,
		).toBeGreaterThan(0);
	});
});
