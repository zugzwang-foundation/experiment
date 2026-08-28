import {
	assertTableClean,
	type EgressSecrets,
	emptySecrets,
} from "@/server/export/egress";
import { assertStripRulesComplete } from "@/server/export/egress/completeness";

import { type CsvArtifact, countCsvRows, toCsv } from "./csv";
import {
	assertInventoryComplete,
	shippedTables,
	TABLE_INVENTORY,
} from "./inventory";
import {
	buildPseudonymMap,
	type PseudonymMap,
	pseudonymizeTable,
} from "./pseudonymize";
import { removedCommentIds } from "./removed";
import type { DatasetSource } from "./source";
import { type SourceRow, stripTable } from "./strip";
import { createTarGz, sha256, type TarEntry } from "./tar";
import { assertTreatmentsComplete, COLUMN_TREATMENTS } from "./treatments";

/**
 * DATASET.1 Slice 6 — the build orchestrator.
 *
 * Reads → strips → pseudonymizes → guards → writes → manifests, in that
 * order, once. The ordering carries three decisions worth stating:
 *
 *   1. **Contract checks run BEFORE the first read.** A pipeline that
 *      discovers a missing strip rule after writing nine tables has already
 *      spent the operator's single shot on the morning of 6 November.
 *   2. **Secrets are harvested from the SOURCE rows, before the transform.**
 *      Harvesting after would collect what survived and assert its absence —
 *      a tautology that passes on every input, including an unstripped one.
 *   3. **The guards run on the FINAL rows**, immediately before they are
 *      serialized — not on an intermediate the writer might diverge from.
 */

export interface TableResult {
	readonly table: string;
	readonly filename: string;
	/** Counted by the writer, from the lines it emitted. */
	readonly rowCount: number;
	/** Recounted independently by parsing the emitted CSV text. */
	readonly verifiedRowCount: number;
	readonly columns: readonly string[];
	readonly bytes: number;
}

export interface DatasetManifest {
	readonly schema_version: string;
	readonly release_date: string;
	readonly source: string;
	readonly license: "CC-BY-4.0";
	readonly tarball_name: string;
	readonly tarball_sha256: string;
	readonly tarball_size_bytes: number;
	readonly pseudonymization: string;
	readonly tables: readonly {
		readonly name: string;
		readonly file: string;
		readonly row_count: number;
		readonly column_set: readonly string[];
		readonly metadata_fields_included?: readonly string[];
		readonly metadata_fields_excluded?: readonly string[];
	}[];
	/** §19.3 rows that are NOT in the archive, and why. */
	readonly withheld: readonly {
		readonly name: string;
		readonly reason: string;
	}[];
	readonly notes: readonly string[];
}

export interface BuildResult {
	readonly manifest: DatasetManifest;
	readonly tarball: Buffer;
	readonly artifacts: readonly CsvArtifact[];
	readonly results: readonly TableResult[];
}

export interface BuildOptions {
	readonly source: DatasetSource;
	readonly releaseDate: string;
	readonly tarballName?: string;
	/** Extra artifacts (the Slice 7 debate `.md` files) to include. */
	readonly extraEntries?: readonly TarEntry[];
	readonly notes?: readonly string[];
}

/**
 * Harvest every secret value from the SOURCE rows.
 *
 * ⚠ Called on source rows only. See decision 2 above — this is the single
 * place where getting the ordering wrong turns every downstream guard into a
 * no-op that still reports success.
 */
export function harvestSecrets(
	tables: Readonly<Record<string, readonly SourceRow[]>>,
): EgressSecrets {
	const s = {
		userIds: new Set<string>(),
		ips: new Set<string>(),
		userAgents: new Set<string>(),
		googleIds: new Set<string>(),
		r2ObjectKeys: new Set<string>(),
		adminSessionIds: new Set<string>(),
		emails: new Set<string>(),
	};

	const add = (set: Set<string>, v: unknown) => {
		if (typeof v === "string" && v.trim() !== "") set.add(v);
	};

	for (const row of tables.users ?? []) {
		add(s.userIds, row.id);
		add(s.emails, row.email);
		add(s.googleIds, row.google_id);
		add(s.ips, row.tos_acceptance_ip);
		add(s.userAgents, row.tos_acceptance_user_agent);
	}
	for (const row of tables.image_uploads ?? []) {
		add(s.r2ObjectKeys, row.r2_object_key);
	}
	// ⚠ mod_actions.image_r2_key is a second R2 key on a shipped table.
	// §19.4's ten-column table does not name it; Appendix B.10 marks it STRIP.
	for (const row of tables.mod_actions ?? []) {
		add(s.r2ObjectKeys, row.image_r2_key);
	}

	// Audit payloads carry ips, user agents, session ids and google ids that
	// may not appear on any `users` row — an admin has no users row at all,
	// so the admin's ip and session id are ONLY reachable here.
	for (const table of ["events", "admin_events", "user_events"]) {
		for (const row of tables[table] ?? []) {
			const p = (row.payload ?? {}) as Record<string, unknown>;
			const m = (row.metadata ?? {}) as Record<string, unknown>;
			add(s.ips, p.ip);
			add(s.ips, m.ip);
			add(s.userAgents, p.user_agent);
			add(s.userAgents, m.user_agent);
			add(s.googleIds, p.googleId);
			add(s.emails, p.email);
			add(s.r2ObjectKeys, p.key);
			add(s.adminSessionIds, p.sessionId);
			if (row.aggregate_type === "admin_session") {
				add(s.adminSessionIds, row.aggregate_id);
			}
		}
	}

	return s;
}

/** The five metadata fields that ship, for the manifest's per-table entry. */
const METADATA_TABLES = new Set(["events", "admin_events", "user_events"]);

export async function buildDataset(opts: BuildOptions): Promise<BuildResult> {
	// ── 1 · contract checks, before a single row is read ────────────────
	assertStripRulesComplete();
	assertInventoryComplete();
	assertTreatmentsComplete();

	const tables = shippedTables();

	// ── 2 · read every shipped table ────────────────────────────────────
	const sourceRows: Record<string, readonly SourceRow[]> = {};
	for (const table of tables) {
		sourceRows[table] = await opts.source.read(table);
	}

	// ── 3 · harvest secrets from the SOURCE, before transforming ────────
	const secrets = harvestSecrets(sourceRows);
	const map: PseudonymMap = buildPseudonymMap(sourceRows.users ?? []);

	// Derived from `mod_actions` rows already in hand — the same predicate
	// `loadRemovedSet` uses, never a second idea of what removal means.
	const removed = removedCommentIds(sourceRows.mod_actions ?? []);

	// ── 4 · transform, guard, serialize ─────────────────────────────────
	const artifacts: CsvArtifact[] = [];
	const results: TableResult[] = [];

	for (const table of tables) {
		const transformed = pseudonymizeTable(
			table,
			stripTable(table, sourceRows[table] ?? [], {
				removedCommentIds: removed,
			}),
			map,
		);

		// The guards run on exactly the rows about to be written.
		assertTableClean(table, transformed, secrets, {
			isUsersTable: table === "users",
		});

		// Column order from the treatment map, not from row 0 — so an empty
		// table still emits a correct header, and a table whose first row
		// happens to omit a nullable key does not lose the column.
		const columns = expectedColumns(table);
		const artifact = toCsv(`${table}.csv`, transformed, columns);
		artifacts.push(artifact);

		results.push({
			table,
			filename: artifact.filename,
			rowCount: artifact.rowCount,
			// ⚠ The independent recount. Brief §4 Slice 6's wrong answer is a
			// manifest counting a DIFFERENT read from the one that wrote the
			// file; this parses the emitted bytes, so the two can be compared
			// rather than assumed equal.
			verifiedRowCount: countCsvRows(artifact.text),
			columns: artifact.columns,
			bytes: Buffer.byteLength(artifact.text, "utf8"),
		});
	}

	// ── 5 · the counts must agree, or the build fails ───────────────────
	for (const r of results) {
		if (r.rowCount !== r.verifiedRowCount) {
			throw new Error(
				`row-count disagreement for ${r.table}: the writer counted ` +
					`${r.rowCount}, re-parsing the emitted CSV found ` +
					`${r.verifiedRowCount}. The manifest must describe the FILE, so ` +
					"the build stops rather than publish a number that describes " +
					"something else.",
			);
		}
	}

	// ── 6 · archive + manifest ──────────────────────────────────────────
	const entries: TarEntry[] = [
		...artifacts.map((a) => ({ name: a.filename, content: a.text })),
		...(opts.extraEntries ?? []),
	];
	const tarball = createTarGz(entries);
	const tarballName =
		opts.tarballName ?? `zugzwang-experiment-${opts.releaseDate}.tar.gz`;

	const manifest: DatasetManifest = {
		schema_version: "1.0",
		release_date: opts.releaseDate,
		source: opts.source.label,
		license: "CC-BY-4.0",
		tarball_name: tarballName,
		tarball_sha256: sha256(tarball),
		tarball_size_bytes: tarball.length,
		pseudonymization:
			"export-time JOIN; users.id → users.pseudonym for downstream FKs",
		tables: results.map((r) => ({
			name: r.table,
			file: r.filename,
			// From the WRITER's count, which step 5 has just proven equal to
			// the file's own.
			row_count: r.rowCount,
			column_set: r.columns,
			...(METADATA_TABLES.has(r.table)
				? {
						metadata_fields_included: [
							"request_id",
							"flow_id",
							"user_pseudonym",
							"actor_id",
							"idempotency_key",
						],
						metadata_fields_excluded: ["ip", "user_agent"],
					}
				: {}),
		})),
		withheld: Object.entries(TABLE_INVENTORY)
			.filter(([, e]) => e.status !== "SHIPPED")
			.map(([name, e]) => ({ name, reason: `${e.status} — ${e.source}` })),
		notes: [
			...(opts.notes ?? []),
			...(removed.size > 0
				? [
						`${removed.size} comment(s) were reactively removed by ` +
							"moderation; their rows ship with the body and image FK " +
							"withheld. mod_actions records that the removal happened.",
					]
				: []),
		],
	};

	return { manifest, tarball, artifacts, results };
}

/**
 * The column set a table emits, derived from Appendix B and the §19.5
 * renames — not from the first row.
 *
 * Drives the CSV header so an EMPTY shipped table still produces a correct,
 * self-describing file. That case is not hypothetical: `admin_events` and
 * `user_events` both ship empty today, and a header-less zero-byte CSV would
 * be indistinguishable from a failed export.
 */
export function expectedColumns(table: string): readonly string[] {
	const treatments = (
		COLUMN_TREATMENTS as Record<string, Record<string, string>>
	)[table];
	if (!treatments) return [];

	const out: string[] = [];
	for (const [col, treatment] of Object.entries(treatments)) {
		if (treatment === "STRIP") continue;
		if (treatment === "PSEUDO" && table !== "users") {
			out.push(
				col.endsWith("user_id")
					? `${col.slice(0, -"user_id".length)}user_pseudonym`
					: `${col}_pseudonym`,
			);
			continue;
		}
		out.push(col);
	}
	return out;
}

/** An empty secret set — for a caller with genuinely nothing to protect. */
export { emptySecrets };
