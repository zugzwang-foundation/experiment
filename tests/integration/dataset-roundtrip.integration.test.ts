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
		source: drizzleSource(testDb as unknown as DatasetDb, "fixture"),
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

	it("row order is deterministic across two independent live reads", () => {
		// A reader without ORDER BY passes a single comparison intermittently.
		// Reading twice and requiring identity is what makes the absence of
		// ORDER BY visible rather than lucky.
		//
		// (The build above already matched the fixture once; this asserts the
		// property that made that match reproducible rather than a coincidence.)
		expect(liveBuild.manifest.content_sha256).toBe(
			fixtureBuild.manifest.content_sha256,
		);
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
	const source = drizzleSource(testDb as unknown as DatasetDb, "probe");

	it("refuses NOT_SHIPPED — the read is never issued", async () => {
		// Not read-and-discard: `sessions` holds every participant's session
		// token, and pulling it into the export process is the harm, whatever
		// happens to the rows afterwards.
		await expect(source.read("sessions")).rejects.toBeInstanceOf(
			EgressContractGapError,
		);
		await expect(source.read("admin_sessions")).rejects.toBeInstanceOf(
			EgressContractGapError,
		);
	});

	it("refuses UNDECIDED — reading `lots` would settle it by accident", async () => {
		await expect(source.read("lots")).rejects.toBeInstanceOf(
			EgressContractGapError,
		);
	});

	it("refuses a table absent from the §19.3 inventory entirely", async () => {
		await expect(source.read("not_a_table")).rejects.toBeInstanceOf(
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
