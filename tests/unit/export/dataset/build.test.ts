import { describe, expect, it } from "vitest";

import {
	buildDataset,
	expectedColumns,
	harvestSecrets,
} from "@/server/export/dataset/build";
import { countCsvRows, escapeField, toCsv } from "@/server/export/dataset/csv";
import {
	buildPseudonymMap,
	pseudonymizeTable,
} from "@/server/export/dataset/pseudonymize";
import { removedCommentIds } from "@/server/export/dataset/removed";
import { fixtureSource } from "@/server/export/dataset/source";
import { stripTable } from "@/server/export/dataset/strip";
import {
	createTarGz,
	GZIP_MTIME_OFFSET,
	sha256,
} from "@/server/export/dataset/tar";

import {
	DIRTY_TABLE_ROWS,
	FIXTURE_SECRET_VALUES,
	FIXTURE_USER_IDS,
} from "../../../_fixtures/dataset/dirty-source";

/**
 * DATASET.1 Slice 6 — CSV writer, tarball, manifest.
 *
 * **The wrong answer this must reject** (brief §4 Slice 6): *"manifest row
 * counts computed from a different read than the one that wrote the files.
 * Count what was written, not what was queried."*
 */

const source = fixtureSource(
	"DATASET-1 local dirty fixture",
	DIRTY_TABLE_ROWS as never,
);

const build = () => buildDataset({ source, releaseDate: "2026-11-06" });

describe("csv · the two ways to corrupt a number without erroring", () => {
	it("writes NUMERIC(38,18) through as a STRING, never a float", () => {
		// CLAUDE.md §2: never JS floats for balances. `Number()` on this value
		// yields 25.000000000000002 and the CSV looks entirely normal.
		const exact = "25.000000000000000001";
		const { text } = toCsv("t.csv", [{ stake: exact }], ["stake"]);

		expect(text).toContain(exact);
		expect(text).not.toContain("25.000000000000002");
		expect(escapeField(exact)).toBe(exact);
	});

	it("writes null as an EMPTY field, not the string 'null'", () => {
		// A literal "null" loads into pandas as the four-character string and
		// silently corrupts every aggregate over the column.
		const { text } = toCsv("t.csv", [{ a: null, b: 1 }], ["a", "b"]);
		expect(text).toBe("a,b\n,1\n");
		expect(text).not.toContain("null");
	});
});

describe("csv · RFC 4180 escaping", () => {
	it.each([
		["plain", "plain"],
		["has,comma", '"has,comma"'],
		['has"quote', '"has""quote"'],
		["has\nnewline", '"has\nnewline"'],
		["has\rcarriage", '"has\rcarriage"'],
	])("escapes %s", (input, expected) => {
		expect(escapeField(input)).toBe(expected);
	});

	it("serializes JSONB columns as JSON", () => {
		expect(escapeField({ a: 1 })).toBe('"{""a"":1}"');
	});

	it("round-trips a comment body containing a newline", () => {
		// Not hypothetical — `comments.body` is the dataset's thesis-core
		// column and multi-line bodies are the normal case. A naive row count
		// would report two rows for one comment.
		const body = "First line.\n\nSecond paragraph, with a comma.";
		const { text, rowCount } = toCsv(
			"c.csv",
			[{ id: "1", body }],
			["id", "body"],
		);

		expect(rowCount).toBe(1);
		expect(countCsvRows(text)).toBe(1);
	});

	it("counts rows quote-aware across many embedded newlines", () => {
		const rows = [
			{ id: "1", body: "a\nb\nc" },
			{ id: "2", body: "plain" },
			{ id: "3", body: 'quoted "inner" and\nnewline' },
		];
		const { text, rowCount } = toCsv("c.csv", rows, ["id", "body"]);

		expect(rowCount).toBe(3);
		expect(countCsvRows(text)).toBe(3);
	});
});

describe("manifest · row counts describe the FILE, not the query", () => {
	it("the writer's count and an independent re-parse agree, per table", () => {
		// The two numbers are produced by different code reading different
		// things: one counts emitted lines as it writes, the other parses the
		// finished bytes. Equality across all 16 tables is the claim.
		return build().then((r) => {
			for (const t of r.results) {
				expect(t.verifiedRowCount, `${t.table}`).toBe(t.rowCount);
			}
		});
	});

	it("the manifest number equals the re-parsed file for every table", () => {
		return build().then((r) => {
			const byName = new Map(r.artifacts.map((a) => [a.filename, a.text]));
			for (const entry of r.manifest.tables) {
				const text = byName.get(entry.file);
				expect(text, `${entry.file} must exist`).toBeDefined();
				expect(countCsvRows(text as string), entry.name).toBe(entry.row_count);
			}
		});
	});

	it("THE WRONG ANSWER — a count from a different read is detectable", () => {
		// Brief §4 Slice 6's defect, constructed: a manifest number taken
		// from the source query rather than from the written file. Here the
		// query "returned" 3 rows and the file holds 1 — exactly what a
		// downstream filter would cause.
		const queried = DIRTY_TABLE_ROWS.users; // 3 rows
		const written = toCsv("users.csv", [queried[0]], ["id", "pseudonym"]);

		expect(queried).toHaveLength(3);
		expect(written.rowCount).toBe(1);
		expect(countCsvRows(written.text)).toBe(1);
		// The recount disagrees with the query count, which is the signal.
		expect(countCsvRows(written.text)).not.toBe(queried.length);
	});
});

describe("tarball · deterministic, because the manifest publishes its hash", () => {
	it("identical input produces a byte-identical archive", () => {
		// System `tar` fails this: it stamps mtime and uid/gid per entry, so
		// the same data archived twice yields two checksums. A checksum that
		// changes without the data changing teaches everyone to ignore it.
		const entries = [
			{ name: "a.csv", content: "id\n1\n" },
			{ name: "b.csv", content: "id\n2\n" },
		];
		expect(sha256(createTarGz(entries))).toBe(sha256(createTarGz(entries)));
	});

	it("entry ORDER does not change the archive", () => {
		const a = [
			{ name: "a.csv", content: "x" },
			{ name: "b.csv", content: "y" },
		];
		const b = [
			{ name: "b.csv", content: "y" },
			{ name: "a.csv", content: "x" },
		];
		expect(sha256(createTarGz(a))).toBe(sha256(createTarGz(b)));
	});

	it("the gzip header carries NO timestamp — asserted on the BYTES", () => {
		// ⚠ The determinism tests above are satisfied by two builds in the
		// same second even if a timestamp IS written, so they cannot prove
		// this on their own. Measured directly instead: RFC 1952 puts MTIME
		// at byte offset 4. Node happens to write 0 there today; this is what
		// notices if that ever stops being true.
		const gz = createTarGz([{ name: "a.csv", content: "x" }]);
		expect(gz.readUInt32LE(GZIP_MTIME_OFFSET)).toBe(0);
	});

	it("POSITIVE CONTROL — different CONTENT does change the hash", () => {
		// Without this, the two tests above are satisfied by a hash function
		// that returns a constant.
		const a = [{ name: "a.csv", content: "x" }];
		const b = [{ name: "a.csv", content: "y" }];
		expect(sha256(createTarGz(a))).not.toBe(sha256(createTarGz(b)));
	});

	it("two full builds of the same source produce the same tarball hash", () => {
		return Promise.all([build(), build()]).then(([one, two]) => {
			expect(one.manifest.tarball_sha256).toBe(two.manifest.tarball_sha256);
			expect(one.manifest.tarball_size_bytes).toBe(
				two.manifest.tarball_size_bytes,
			);
		});
	});
});

describe("build · the manifest describes what §19.3 actually did", () => {
	it("ships exactly the 16 SHIPPED tables", () => {
		return build().then((r) => {
			expect(r.manifest.tables).toHaveLength(16);
			expect(r.manifest.tables.map((t) => t.name)).not.toContain("lots");
			expect(r.manifest.tables.map((t) => t.name)).not.toContain("sessions");
		});
	});

	it("records every withheld table WITH its status, including lots", () => {
		// A reader must be able to tell "decided against" from "still open"
		// from "never in the inventory" — three different answers.
		return build().then((r) => {
			const withheld = new Map(
				r.manifest.withheld.map((w) => [w.name, w.reason]),
			);
			expect(withheld.get("lots")).toContain("UNDECIDED");
			expect(withheld.get("sessions")).toContain("NOT_SHIPPED");
			expect(withheld.get("bookmarks")).toContain("EXCLUDED");
		});
	});

	it("names the metadata fields included and excluded, per §19.7", () => {
		return build().then((r) => {
			const events = r.manifest.tables.find((t) => t.name === "events");
			expect(events?.metadata_fields_excluded).toEqual([
				"ip",
				"user_agent",
				"idempotency_key",
			]);
			// ⚠ `user_pseudonym`, not `user_id` — the manifest must describe the
			// post-pseudonymization shape, which is what the file holds.
			expect(events?.metadata_fields_included).toContain("user_pseudonym");
			expect(events?.metadata_fields_included).not.toContain("user_id");
		});
	});

	it("an EMPTY shipped table still emits a header row", () => {
		// admin_events and user_events ship empty today (zero writers). A
		// zero-byte CSV would be indistinguishable from a failed export.
		return buildDataset({
			source: fixtureSource("empty", {}),
			releaseDate: "2026-11-06",
		}).then((r) => {
			const ae = r.artifacts.find((a) => a.filename === "admin_events.csv");
			expect(ae?.rowCount).toBe(0);
			expect(ae?.text).toBe("id,event_type,payload,metadata,created_at\n");
		});
	});

	it("column headers come from Appendix B, carrying the §19.5 renames", () => {
		expect(expectedColumns("bets")).toContain("user_pseudonym");
		expect(expectedColumns("bets")).not.toContain("user_id");
		expect(expectedColumns("mod_actions")).toContain("target_user_pseudonym");
		// STRIP columns never reach the header.
		expect(expectedColumns("users")).not.toContain("email");
		expect(expectedColumns("mod_actions")).not.toContain("image_r2_key");
		// users keeps its raw id — the one exemption (§19.5 last paragraph).
		expect(expectedColumns("users")).toContain("id");
	});
});

describe("build · the whole archive is egress-clean", () => {
	it("no secret of any class appears anywhere in the emitted CSVs", () => {
		// The end-to-end claim, asserted over the concatenated bytes of every
		// file rather than table by table — so a value that migrated between
		// tables during the transform still fails.
		return build().then((r) => {
			const all = r.artifacts
				.filter((a) => a.filename !== "users.csv")
				.map((a) => a.text)
				.join("\n");

			for (const id of Object.values(FIXTURE_USER_IDS)) {
				expect(all, `raw users.id ${id}`).not.toContain(id);
			}
			for (const v of [
				...FIXTURE_SECRET_VALUES.ips,
				...FIXTURE_SECRET_VALUES.userAgents,
				...FIXTURE_SECRET_VALUES.googleIds,
				...FIXTURE_SECRET_VALUES.emails,
				...FIXTURE_SECRET_VALUES.adminSessionIds,
				// the two `u/<userId>/…` keys; market_media's `m/…` key ships
				...FIXTURE_SECRET_VALUES.r2ObjectKeys.slice(0, 2),
			]) {
				expect(all, `secret ${v.slice(0, 12)}…`).not.toContain(v);
			}
		});
	});

	it("users.csv DOES carry the raw ids — the one deliberate exemption", () => {
		// The positive control for the exclusion above: if users.csv were
		// also clean, the previous test would pass against a pipeline that
		// dropped every id everywhere, which is a different bug.
		return build().then((r) => {
			const users = r.artifacts.find((a) => a.filename === "users.csv");
			expect(users?.text).toContain(FIXTURE_USER_IDS.amber);
			// …and none of the PII that rides alongside it.
			expect(users?.text).not.toContain(FIXTURE_SECRET_VALUES.emails[0]);
			expect(users?.text).not.toContain(FIXTURE_SECRET_VALUES.googleIds[0]);
		});
	});
});

describe("build · secrets are harvested from SOURCE rows", () => {
	it("collects every class from the untransformed fixture", () => {
		const s = harvestSecrets(DIRTY_TABLE_ROWS as never);

		expect(s.userIds.size).toBe(3);
		expect(s.emails).toContain(FIXTURE_SECRET_VALUES.emails[0]);
		expect(s.googleIds).toContain(FIXTURE_SECRET_VALUES.googleIds[1]);
		expect(s.adminSessionIds).toContain(
			FIXTURE_SECRET_VALUES.adminSessionIds[0],
		);
		// ⚠ mod_actions.image_r2_key — a second R2 key §19.4's table omits.
		expect(s.r2ObjectKeys).toContain(FIXTURE_SECRET_VALUES.r2ObjectKeys[1]);
	});

	it("reaches the admin's ip and session id, which no users row carries", () => {
		// The admin has no `users` row at all, so these values are reachable
		// ONLY through the audit payloads. A harvest that only walked `users`
		// would build a secret set with no admin secrets in it, and every
		// admin-side guard would then pass vacuously.
		const s = harvestSecrets(DIRTY_TABLE_ROWS as never);
		expect(s.ips).toContain(FIXTURE_SECRET_VALUES.ips[2]); // admin-only ip
		expect(s.adminSessionIds.size).toBeGreaterThanOrEqual(2);
	});

	it("POSITIVE CONTROL — harvesting POST-transform yields an EMPTY set", () => {
		// ⚠ This test's first version was not a control at all, and the fault
		// is worth keeping. It built its "post-transform" input as a record of
		// EMPTY ARRAYS and then asserted the harvest was empty — which is true
		// of every implementation, correct or broken, because there was
		// nothing to harvest from. It proved `harvestSecrets({}) === {}`.
		//
		// The real control harvests from the ACTUAL transformed rows. Those
		// rows are non-empty and structurally complete; they simply no longer
		// carry secrets, because the transform removed them. That is what
		// makes the emptiness meaningful — and it is exactly the tautology
		// the pipeline would become if `harvestSecrets` ran after the strip.
		const map = buildPseudonymMap(DIRTY_TABLE_ROWS.users);
		const transformed: Record<string, unknown[]> = {};
		for (const table of Object.keys(DIRTY_TABLE_ROWS)) {
			transformed[table] = pseudonymizeTable(
				table,
				stripTable(
					table,
					DIRTY_TABLE_ROWS[table as keyof typeof DIRTY_TABLE_ROWS] as never,
					{
						removedCommentIds: removedCommentIds(DIRTY_TABLE_ROWS.mod_actions),
					},
				),
				map,
			);
		}

		// The rows really are there — without this, the assertions below are
		// the same vacuous claim in a new costume.
		expect((transformed.users as unknown[]).length).toBe(3);
		// 24 event types + the 2 SENTINEL rows (`ip: "unknown"` / `"cron"`),
		// which the fixture carries so the harvest's sentinel exclusion has a
		// control (`@security-auditor` F-11 H-A) + the 1 RECOVERY-PATH row
		// (DATASET.2 C3): a second `comment.placed`, for the REMOVED comment,
		// carrying the `uploadId` that rebuilds the association B.6 withholds.
		// It is in the fixture because without it the C3 guard passed over a
		// route the data could not travel.
		expect((transformed.events as unknown[]).length).toBe(27);

		const post = harvestSecrets(transformed as never);

		// Three classes go to zero — nothing survived the strip to harvest.
		expect(post.emails.size).toBe(0);
		expect(post.ips.size).toBe(0);
		expect(post.googleIds.size).toBe(0);
		expect(post.userAgents.size).toBe(0);

		// ⚠ Two classes are NON-empty, and writing this control is how that
		// was discovered. Both are correct, and both sharpen the point:
		//
		//  · `userIds` still holds all three — because `users.id` is
		//    preserved in the `users` table by design (§19.5's one
		//    exemption). A post-transform harvest would therefore build a
		//    secret set containing ids that legitimately ship, and then flag
		//    `users.csv` as a violation of itself.
		//  · `adminSessionIds` holds exactly one value: the REDACTION
		//    SENTINEL. A post-transform harvest would treat the placeholder
		//    as a secret and flag every row carrying it — a false positive
		//    manufactured by the pipeline's own output.
		//
		// So harvesting late does not merely weaken the guards; it poisons
		// them in both directions at once.
		expect(post.userIds.size).toBe(3);
		expect([...post.adminSessionIds]).toEqual(["[redacted-admin-session]"]);
		for (const real of FIXTURE_SECRET_VALUES.adminSessionIds) {
			expect(post.adminSessionIds.has(real)).toBe(false);
		}

		// …whereas the SOURCE harvest is populated. That difference is the
		// whole reason `harvestSecrets` is called before the transform: run it
		// after, and every guard downstream asserts the absence of a set that
		// is empty by construction, passing on every input forever.
		const pre = harvestSecrets(DIRTY_TABLE_ROWS as never);
		expect(pre.emails.size).toBe(2);
		// ⚠ **4, not 3, and the fourth is the DATASET.2 C2 depth probe.** The
		// shallow harvest found three ips; the recursive one additionally finds
		// `image_upload.committed.payload.context.ip`, which is reachable
		// nowhere else in the fixture. **This count moving is the measurement
		// that the harvest actually got deeper** — a recursive strip paired
		// with a shallow harvest would leave this at 3 while looking fixed.
		expect(pre.ips.size).toBe(4);
		expect(pre.adminSessionIds.size).toBeGreaterThanOrEqual(2);
	});
});
