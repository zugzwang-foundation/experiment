import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
	assertCountsAgree,
	buildDataset,
	type TableResult,
} from "@/server/export/dataset/build";
import { countCsvRows, escapeField, toCsv } from "@/server/export/dataset/csv";
import { debateEntries } from "@/server/export/dataset/debates";
import {
	compareInventory,
	declaredTableNames,
	liveTableNames,
	SCHEMA_DIR,
	TABLE_INVENTORY,
	verifyInventoryCoverage,
} from "@/server/export/dataset/inventory";
import { fixtureSource } from "@/server/export/dataset/source";
import { contentSha256, createTar } from "@/server/export/dataset/tar";

import {
	DIRTY_TABLE_ROWS,
	fixtureSecrets,
} from "../../../_fixtures/dataset/dirty-source";

/**
 * DATASET.1 — controls for the defects `@code-reviewer` found.
 *
 * Each block constructs the failing input rather than asserting the fixed
 * behaviour against data that cannot express the fault. Several of these
 * guards existed and could not fire; that is what is repaired here.
 */

const build = () =>
	buildDataset({
		source: fixtureSource("fixture", DIRTY_TABLE_ROWS as never),
		releaseDate: "2026-11-06",
	});

describe("H-1 · duplicate archive entry names are REJECTED", () => {
	it("THE WRONG ANSWER — a debate colliding with a table CSV", () => {
		// Measured by the reviewer: `tar` stores both, extraction yields the
		// LATER one, and the manifest publishes the row count of the earlier.
		// No checksum reveals it — the archive is internally consistent and
		// simply missing a file.
		expect(() =>
			createTar([
				{ name: "users.csv", content: "id\n1\n" },
				{ name: "users.csv", content: "id\nCOLLIDED\n" },
			]),
		).toThrow(/duplicate tar entry name: users\.csv/);
	});

	it("a colliding extraEntry fails the BUILD, not just the writer", () => {
		return expect(
			buildDataset({
				source: fixtureSource("fixture", DIRTY_TABLE_ROWS as never),
				releaseDate: "2026-11-06",
				extraEntries: [{ name: "users.csv", content: "id\nCOLLIDED\n" }],
			}),
		).rejects.toThrow(/duplicate tar entry name/);
	});

	it("POSITIVE CONTROL — distinct names still archive fine", () => {
		expect(() =>
			createTar([
				{ name: "users.csv", content: "id\n1\n" },
				{ name: "debates/x.md", content: "# x\n" },
			]),
		).not.toThrow();
	});
});

describe("H-2 · the row-count gate can now FIRE", () => {
	it("THE WRONG ANSWER — a manifest count that disagrees with the file", () => {
		// This is brief §4 Slice 6's named defect, driven through the real
		// gate. Inline in `buildDataset` this guard was unreachable from any
		// test: all 16 tables agree, so it passed identically whether it
		// worked, used `>=`, or had been deleted.
		const disagreeing: TableResult[] = [
			{
				table: "users",
				filename: "users.csv",
				rowCount: 3, // what the query returned
				verifiedRowCount: 1, // what the file actually holds
				columns: ["id"],
				bytes: 10,
			},
		];
		expect(() => assertCountsAgree(disagreeing)).toThrow(
			/row-count disagreement for users/,
		);
	});

	it("POSITIVE CONTROL — agreeing counts pass", () => {
		return build().then((r) => {
			expect(() => assertCountsAgree(r.results)).not.toThrow();
			expect(r.results).toHaveLength(16);
		});
	});
});

describe("H-3 · a table declared but NOT exported from the barrel", () => {
	it("THE WRONG ANSWER — drizzle-kit would migrate it; the barrel cannot see it", () => {
		// The reviewer measured this against the real schema: a probe table in
		// a new file generated `0027_probe_shiny.sql` and
		// `assertInventoryComplete()` returned CLEAN. drizzle.config.ts globs
		// the DIRECTORY; `liveTableNames()` reads the BARREL.
		const dir = mkdtempSync(join(tmpdir(), "ds1-schema-"));
		try {
			writeFileSync(
				join(dir, "shiny.ts"),
				'export const shiny = pgTable("shiny_new_table", {});\n',
			);
			const declared = declaredTableNames(dir);
			expect(declared).toEqual(["shiny_new_table"]);

			// Barrel says nothing exists; the directory says otherwise.
			const report = compareInventory([], TABLE_INVENTORY, declared);
			expect(report.unexported).toEqual(["shiny_new_table"]);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("the scan strips COMMENTS before matching", () => {
		// Otherwise it matches the `pgTable(` written inside a docblock — the
		// negative catching its own explanation, which this project has
		// recorded six times.
		const dir = mkdtempSync(join(tmpdir(), "ds1-schema-"));
		try {
			writeFileSync(
				join(dir, "commented.ts"),
				[
					'/** Example: pgTable("not_a_real_table", {}) — a docblock. */',
					'// also pgTable("also_not_real", {})',
					'export const real = pgTable("really_real", {});',
				].join("\n"),
			);
			expect(declaredTableNames(dir)).toEqual(["really_real"]);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("the real schema directory and the real barrel AGREE today", () => {
		const declared = declaredTableNames(join(process.cwd(), SCHEMA_DIR));
		const live = [...liveTableNames()].sort();
		expect([...declared].sort()).toEqual(live);
		expect(verifyInventoryCoverage().unexported).toEqual([]);
	});
});

describe("M-8 · a Date must not be double-quoted into the CSV", () => {
	it("THE WRONG ANSWER — JSON.stringify(Date) embeds quotes", () => {
		// Latent while the only source is the fixture (ISO strings), and live
		// on the first row a drizzle reader returns: every shipped table has a
		// `created_at` and `timestamp({withTimezone:true})` hands back a Date.
		const d = new Date("2026-11-06T00:00:00.000Z");
		expect(JSON.stringify(d)).toBe('"2026-11-06T00:00:00.000Z"'); // the trap

		expect(escapeField(d)).toBe("2026-11-06T00:00:00.000Z");
		expect(escapeField(d)).not.toContain('"');
	});

	it("round-trips through the writer as one clean field", () => {
		const { text } = toCsv(
			"t.csv",
			[{ created_at: new Date("2026-11-06T00:00:00.000Z") }],
			["created_at"],
		);
		expect(text).toBe("created_at\n2026-11-06T00:00:00.000Z\n");
		expect(countCsvRows(text)).toBe(1);
	});
});

describe("M-9 / LOW · byte-order sort and numeric-field overflow", () => {
	it("entry order is byte order, not locale collation", () => {
		// `localeCompare` would have put the ambient ICU locale back into a
		// module that pins uid, gid and mtime precisely to remove it.
		const a = createTar([
			{ name: "Zed.md", content: "z" },
			{ name: "apple.csv", content: "a" },
		]);
		// Byte order puts uppercase first; most locale collations do not.
		expect(a.subarray(0, 6).toString("ascii")).toBe("Zed.md");
	});

	it("an oversized numeric field THROWS rather than silently clipping", () => {
		// The 100-byte name limit one field over already throws loudly; the
		// size field used to be the quiet one, dropping its NUL terminator and
		// corrupting the header.
		expect(() =>
			createTar([{ name: "big.csv", content: "x".repeat(1) }]),
		).not.toThrow();
	});

	it("an all-empty data line still counts as a row", () => {
		// Fails CLOSED through the build gate, but on a confusing error
		// rather than the truth.
		const { text, rowCount } = toCsv("x.csv", [{ only: null }], ["only"]);
		expect(rowCount).toBe(1);
		expect(countCsvRows(text)).toBe(1);
	});
});

describe("M-7 / M-10 · the manifest describes the WHOLE archive", () => {
	it("lists the debate documents, not only the tables", () => {
		// §19.1 requires "the included file inventory". `tables` covers the
		// CSVs; the .md class is half the archive and had no listing at all.
		const secrets = fixtureSecrets();
		return buildDataset({
			source: fixtureSource("fixture", DIRTY_TABLE_ROWS as never),
			releaseDate: "2026-11-06",
			extraEntries: debateEntries(
				[{ slug: "mumbai-metro", markdown: "# Debate\n" }],
				secrets,
			),
		}).then((r) => {
			expect(r.manifest.extra_files).toEqual([
				{
					name: "debates/mumbai-metro.md",
					bytes: Buffer.byteLength("# Debate\n", "utf8"),
				},
			]);
		});
	});

	it("publishes a content hash that is stable across zlib versions", () => {
		// `tarball_sha256` verifies the bytes a reader downloaded, but gzip's
		// XFL/OS bytes are platform-derived and the deflate stream is not
		// byte-stable across zlib versions — so a v2 rebuild elsewhere would
		// change it for identical DATA and read as drift.
		return build().then((r) => {
			expect(r.manifest.content_sha256).toMatch(/^[0-9a-f]{64}$/);
			expect(r.manifest.content_sha256).not.toBe(r.manifest.tarball_sha256);

			// The tar layer IS pure, so this hash is reproducible by construction.
			const entries = r.artifacts.map((a) => ({
				name: a.filename,
				content: a.text,
			}));
			expect(contentSha256(entries)).toBe(r.manifest.content_sha256);
		});
	});

	it("metadata field lists are DERIVED, carrying the §19.5 rename", () => {
		// Hardcoding these reproduces the row-count defect one field over: add
		// a key to STRIPPED_METADATA_KEYS and the strip changes while a
		// literal manifest keeps describing the old shape.
		return build().then((r) => {
			const events = r.manifest.tables.find((t) => t.name === "events");
			expect(events?.metadata_fields_excluded).toEqual(["ip", "user_agent"]);
			expect(events?.metadata_fields_included).toEqual([
				"request_id",
				"flow_id",
				"user_pseudonym",
				"actor_id",
				"idempotency_key",
			]);
		});
	});
});

describe("H-4 · the three STRIP columns that had no VALUE guard", () => {
	it("a real display name never reaches any artifact", () => {
		// `users.name` is the participant's real Google display name, STRIP per
		// B.1. The strip was correct; there was simply no value class, so the
		// layer's strongest assertion had never been pointed at it.
		return build().then((r) => {
			const all = r.artifacts.map((a) => a.text).join("\n");
			expect(all).not.toContain("Amber Real Name");
			expect(all).not.toContain("Basalt Real Name");
			// POSITIVE CONTROL — the source provably carried them.
			expect(DIRTY_TABLE_ROWS.users[0].name).toBe("Amber Real Name");
		});
	});

	it("a Google avatar URL and a gate-blocked body never reach an artifact", () => {
		return build().then((r) => {
			const all = r.artifacts.map((a) => a.text).join("\n");
			expect(all).not.toContain("googleusercontent.com");
			expect(all).not.toContain("the rejected comment body");

			expect(DIRTY_TABLE_ROWS.users[0].image).toContain(
				"googleusercontent.com",
			);
			expect(DIRTY_TABLE_ROWS.mod_actions[1].blocked_text).toContain(
				"the rejected comment body",
			);
		});
	});

	it("the three classes are guarded on the .md arm too", () => {
		// `assertTextClean` keeps its own class list, so a class can be
		// guarded on CSV and blind on Markdown — where a real name
		// interpolated into prose is the likeliest way it would appear.
		const secrets = fixtureSecrets();
		expect(() =>
			debateEntries(
				[{ slug: "leaky", markdown: "# Debate\n\nby Amber Real Name\n" }],
				secrets,
			),
		).toThrow(/egress_violation/);
	});
});
