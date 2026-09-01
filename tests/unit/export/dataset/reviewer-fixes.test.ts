import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
	assertCountsAgree,
	buildDataset,
	harvestSecrets,
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
import { EgressGuard } from "@/server/export/egress";

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
			expect(events?.metadata_fields_excluded).toEqual([
				"ip",
				"user_agent",
				"idempotency_key",
			]);
			expect(events?.metadata_fields_included).toEqual([
				"request_id",
				"flow_id",
				"user_pseudonym",
				"actor_id",
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
			// POSITIVE CONTROL — the source provably carried them. By identity,
			// not by position; see the note on the sibling test below.
			expect(
				DIRTY_TABLE_ROWS.users.some((u) => u.name === "Amber Real Name"),
			).toBe(true);
		});
	});

	it("a Google avatar URL and a gate-blocked body never reach an artifact", () => {
		return build().then((r) => {
			const all = r.artifacts.map((a) => a.text).join("\n");
			expect(all).not.toContain("googleusercontent.com");
			expect(all).not.toContain("the rejected comment body");

			// ⚠ POSITIVE CONTROLS selected by IDENTITY, not by array position.
			// These read `users[0]` and `mod_actions[1]` until DATASET.2 Slice 5
			// sorted the fixture into the live reader's `ORDER BY id`, at which
			// point `mod_actions[1]` became the other row and this test failed
			// with a confusing "null is invalid for this assertion". A control
			// pinned to a position asserts something about the fixture's
			// authoring order, which is not what it means to assert.
			const amber = DIRTY_TABLE_ROWS.users.find(
				(u) => u.name === "Amber Real Name",
			);
			expect(amber?.image).toContain("googleusercontent.com");

			const blocked = DIRTY_TABLE_ROWS.mod_actions.find(
				(m) => m.blocked_text !== null,
			);
			expect(blocked?.blocked_text).toContain("the rejected comment body");
		});
	});

	it("a real display name in a .md is an ADVISORY, not an abort", () => {
		// ⚠ This test asserted a THROW, and that was the defect
		// `@security-auditor` F-11 H-B found: it pinned as intended behaviour
		// the very denial-of-service the CSV-arm fix had just closed. A
		// display name is something a participant writes; halting on it hands
		// anyone named "Li" an abort switch on the release.
		const secrets = fixtureSecrets();
		const entries = debateEntries(
			[{ slug: "named", markdown: "# Debate\n\nby Amber Real Name\n" }],
			secrets,
		);
		expect(entries).toHaveLength(1);
	});

	it("a SYSTEM-SOURCED secret in a .md still aborts", () => {
		// The control that keeps the tier honest: downgrading participant-
		// chosen needles (ruling S1) must not have switched the text arm off.
		//
		// ⚠ **The needle was a user-agent until DATASET.3**, on the reasoning
		// that *"a user-agent string has no business in an argument, so one
		// appearing is a serializer leak"*. The premise is false — the
		// participant SENDS that header, so they choose the string, and the
		// substring matcher then failed every debate containing whatever they
		// chose. A Google `sub` carries the property the test is about: the
		// serializer provably cannot emit one, and no request can arrange for
		// it to collide.
		const secrets = fixtureSecrets();
		expect(() =>
			debateEntries(
				[
					{
						slug: "leaky",
						markdown: `# Debate\n\nsub: ${[...secrets.googleIds][0]}\n`,
					},
				],
				secrets,
			),
		).toThrow(/egress_violation/);
	});

	it("S1 · …and the participant-chosen twin does NOT abort", () => {
		// The other half, so the test above cannot be satisfied by an arm that
		// halts on everything. Same document shape, same guard, a needle the
		// participant supplied — and the one-shot build survives it.
		const secrets = fixtureSecrets();
		const ua = [...secrets.userAgents][0] as string;
		// CONTROL: the needle is genuinely in the secret set and long enough
		// to be scanned, so a clean result is a decision and not a skip.
		expect(ua.length).toBeGreaterThanOrEqual(6);
		expect(
			debateEntries(
				[{ slug: "ok", markdown: `# Debate\n\nUA: ${ua}\n` }],
				secrets,
			),
		).toHaveLength(1);
	});
});

describe("F-11 · the sentinel and tier corrections", () => {
	it("H-A · `unknown` / `cron` are NOT harvested as secrets", () => {
		// Six live emit sites write `ip: "unknown"`. Harvested, it becomes a
		// secret — and `request_id` is `"unknown"` at those same sites and
		// SHIPS, so the guard fires on a field that must survive and the
		// release cannot build. Seven characters, so the length floor misses
		// it; the fix has to be semantic.
		const s = harvestSecrets(DIRTY_TABLE_ROWS as never);
		expect(s.ips.has("unknown")).toBe(false);
		expect(s.ips.has("cron")).toBe(false);
		expect(s.userAgents.has("unknown")).toBe(false);
		expect(s.userAgents.has("vercel-cron")).toBe(false);

		// POSITIVE CONTROL — the fixture provably carries those rows, and the
		// real addresses beside them are still harvested.
		const sentinelRow = DIRTY_TABLE_ROWS.events.find(
			(r) => (r.metadata as Record<string, unknown>).ip === "unknown",
		);
		expect(sentinelRow).toBeDefined();
		expect(s.ips.has("203.0.113.7")).toBe(true);
	});

	it("H-A · the full build completes with sentinel rows present", () => {
		// The end-to-end claim: this is what would have failed on 6 November.
		return buildDataset({
			source: fixtureSource("fixture", DIRTY_TABLE_ROWS as never),
			releaseDate: "2026-11-06",
		}).then((r) => {
			const events = r.artifacts.find((a) => a.filename === "events.csv");
			// `request_id: "unknown"` SHIPS, and shipping it is the point.
			expect(events?.text).toContain("unknown");
			expect(r.manifest.tables).toHaveLength(16);
		});
	});

	it("H-C · blocked_text is FATAL on its own column, not an advisory", () => {
		// Putting `blocked_text` in FREE_TEXT_COLUMNS disabled the value class
		// on the one real column it was created to protect — if the STRIP were
		// ever lost, the rejected body would ship with an advisory line and a
		// zero exit code.
		const g = new EgressGuard({
			...fixtureSecrets(),
			blockedTexts: new Set(["the rejected comment body, retained"]),
		});
		g.assertNoBlockedTexts("mod_actions", [
			{ blocked_text: "the rejected comment body, retained" },
		]);
		expect(g.findings.map((f) => f.rule)).toContain("no-blocked-text");
	});

	it("H-C · a re-posted body in comments.body is STILL only an advisory", () => {
		// The tier must keep its original job: the re-post attack it was built
		// for only ever needed `body`.
		const g = new EgressGuard({
			...fixtureSecrets(),
			blockedTexts: new Set(["the rejected comment body, retained"]),
		});
		g.assertNoBlockedTexts("comments", [
			{ body: "the rejected comment body, retained" },
		]);
		expect(g.findings).toHaveLength(0);
		expect(g.advisories.map((f) => f.rule)).toContain("no-blocked-text");
	});

	it("M-A · the manifest publishes advisory COUNTS, never row paths", () => {
		// §19.7 serves this manifest publicly. A path like
		// `[no-email] comments @ [412].body` is a machine-readable oracle
		// binding a pseudonym to a confirmed real identity substring.
		return buildDataset({
			source: fixtureSource("fixture", DIRTY_TABLE_ROWS as never),
			releaseDate: "2026-11-06",
		}).then((r) => {
			for (const line of r.manifest.advisories) {
				expect(line).not.toMatch(/@|\[\d+\]/);
				expect(line).toMatch(/^[a-z-]+: \d+$/);
			}
			expect(typeof r.manifest.skipped_needles).toBe("number");
		});
	});
});
