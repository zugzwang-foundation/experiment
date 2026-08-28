import {
	assertTableClean,
	assertTextArtifactClean,
	type EgressSecrets,
} from "@/server/export/egress";
import { assertStripRulesComplete } from "@/server/export/egress/completeness";
import type { EgressViolation } from "@/server/export/egress/errors";
import {
	SHIPPED_METADATA_KEYS,
	STRIPPED_METADATA_KEYS,
} from "@/server/export/egress/forbidden-keys";

import { type CsvArtifact, countCsvRows, toCsv } from "./csv";
import {
	assertInventoryComplete,
	shippedTables,
	TABLE_INVENTORY,
} from "./inventory";
import {
	buildPseudonymMap,
	type PseudonymMap,
	pseudonymColumnName,
	pseudonymizeTable,
} from "./pseudonymize";
import { removedCommentIds } from "./removed";
import type { DatasetSource } from "./source";
import { type SourceRow, stripTable } from "./strip";
import { contentSha256, createTarGz, sha256, type TarEntry } from "./tar";
import { assertTreatmentsComplete, treatmentsFor } from "./treatments";

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
	/**
	 * Non-table artifacts in the archive — today the `debates/*.md` class.
	 * §19.1's "included file inventory" is the whole archive, not just the
	 * tables.
	 */
	readonly extra_files: readonly {
		readonly name: string;
		readonly bytes: number;
	}[];
	/** sha256 of the UNCOMPRESSED tar — stable across zlib versions. */
	readonly content_sha256: string;
	readonly tables: readonly {
		readonly name: string;
		readonly file: string;
		readonly row_count: number;
		readonly column_set: readonly string[];
		readonly metadata_fields_included?: readonly string[];
		readonly metadata_fields_excluded?: readonly string[];
	}[];
	/** §19.3 rows that are NOT in the archive, and why. */
	/**
	 * Non-fatal egress findings, as per-rule COUNTS. Never per-row paths —
	 * this manifest is published, and a path is a re-identification aid.
	 */
	readonly advisories: readonly string[];
	/**
	 * Needles too short to scan safely (`MIN_NEEDLE_LENGTH`). Non-zero means
	 * a value class is not fully covered — reported so the gap is visible
	 * rather than silent.
	 */
	readonly skipped_needles: number;
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
 * Literal placeholders this codebase writes into `metadata.ip` and
 * `metadata.user_agent` where the real value is not available.
 *
 * ⚠ **Excluding these is not tidiness; without it the release build cannot
 * complete.** Six live emit sites write `ip: "unknown"` / `user_agent:
 * "unknown"` (`auth/logout.ts`, `auth/admin/logout.ts`,
 * `auth/post-commit-events.ts` ×2, `auth/tos-accept.ts`,
 * `moderation/consequences.ts`) and the orphan sweep writes `ip: "cron"` /
 * `user_agent: "vercel-cron"`. Harvested, `"unknown"` becomes a secret — and
 * `request_id` is ALSO `"unknown"` at those sites and SHIPS per §19.4, so the
 * value guard fires on a field that is supposed to survive. Every sign-out,
 * ToS accept, moderation consequence and sweep row fails, and every debate
 * document containing the ordinary English word "unknown" fails with them.
 *
 * Measured by `@security-auditor` at the F-11 re-audit — and it is the SAME
 * class as the `market.created` defect one commit earlier: the fixture models
 * `metadata.ip` as an RFC-5737 address and never as the sentinel the
 * application actually writes, so nothing on the branch could see it. A
 * fixture simpler than production cannot fail the way production fails, and
 * that lesson had to be learned twice.
 *
 * `MIN_NEEDLE_LENGTH` does not cover this: `"unknown"` is seven characters.
 * The fix has to be semantic, not dimensional.
 */
export const NON_SECRET_SENTINELS = new Set([
	"unknown",
	"cron",
	"vercel-cron",
	"system",
	"admin-singleton",
]);

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
		displayNames: new Set<string>(),
		avatarUrls: new Set<string>(),
		blockedTexts: new Set<string>(),
	};

	const add = (set: Set<string>, v: unknown) => {
		if (typeof v !== "string" || v.trim() === "") return;
		if (NON_SECRET_SENTINELS.has(v)) return;
		set.add(v);
	};

	for (const row of tables.users ?? []) {
		add(s.userIds, row.id);
		add(s.emails, row.email);
		add(s.googleIds, row.google_id);
		add(s.ips, row.tos_acceptance_ip);
		add(s.userAgents, row.tos_acceptance_user_agent);
		// ⚠ `users.name` is the participant's real Google display name and
		// `users.image` their avatar URL — both STRIP per B.1, and until
		// `@code-reviewer` H-4 neither had a value class, so the strongest
		// assertion this layer can make had never been pointed at the most
		// identifying column in the dataset.
		add(s.displayNames, row.name);
		add(s.avatarUrls, row.image);
	}
	for (const row of tables.image_uploads ?? []) {
		add(s.r2ObjectKeys, row.r2_object_key);
	}
	// ⚠ mod_actions.image_r2_key is a second R2 key on a shipped table.
	// §19.4's ten-column table does not name it; Appendix B.10 marks it STRIP.
	for (const row of tables.mod_actions ?? []) {
		add(s.r2ObjectKeys, row.image_r2_key);
		add(s.blockedTexts, row.blocked_text);
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

/**
 * The gate between the writer's count and an independent re-parse of the
 * bytes it produced.
 *
 * ⚠ **Extracted so a control can DRIVE it.** Inline in `buildDataset` it was
 * the one guard in this task that could not be made to fire: all 16 tables
 * agree, so the test asserting `verifiedRowCount === rowCount` passed
 * identically whether the gate worked, used `>=`, or had been deleted
 * (`@code-reviewer` H-2). Every other contract check here — `compareInventory`,
 * `compareTreatments`, `compareStripRules` — was already injectable for
 * exactly this reason, and this one had been missed.
 *
 * That matters more than the average un-fired guard, because this IS the
 * answer to brief §4 Slice 6's named wrong answer: *"manifest row counts
 * computed from a different read than the one that wrote the files"*.
 */
export function assertCountsAgree(results: readonly TableResult[]): void {
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
}

/** Per-rule counts — the publishable shape of the advisory tier. */
function summarizeAdvisories(
	advisories: readonly EgressViolation[],
): readonly string[] {
	const byRule = new Map<string, number>();
	for (const a of advisories) {
		byRule.set(a.rule, (byRule.get(a.rule) ?? 0) + 1);
	}
	return [...byRule.entries()]
		.sort(([a], [b]) => (a < b ? -1 : 1))
		.map(([rule, n]) => `${rule}: ${n}`);
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
	// Non-fatal findings — a secret value inside participant-authored free
	// text, or a heuristic net firing. Surfaced in the manifest so the
	// operator sees them, rather than dying on content a participant wrote.
	const advisories: EgressViolation[] = [];
	const guardSkips: { rule: string; length: number }[] = [];

	for (const table of tables) {
		const transformed = pseudonymizeTable(
			table,
			stripTable(table, sourceRows[table] ?? [], {
				removedCommentIds: removed,
			}),
			map,
		);

		// The guards run on exactly the rows about to be written.
		const outcome = assertTableClean(table, transformed, secrets, {
			isUsersTable: table === "users",
		});
		advisories.push(...outcome.advisories);
		guardSkips.push(...outcome.skipped);

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
	assertCountsAgree(results);

	// ── 6 · archive + manifest ──────────────────────────────────────────
	// ⚠ Every extra entry is guarded HERE, with the secrets THIS build
	// harvested — not with a set the caller assembled separately.
	//
	// `extraEntries` previously reached the tarball with no guard at all
	// (`@security-auditor` M-7). The `.md` arm's only protection was
	// `debateEntries`, an OPTIONAL constructor the caller had to remember,
	// taking an `EgressSecrets` the caller had to derive independently — so
	// the archive's guarantee rested on a convention at a seam rather than on
	// anything structural, and the two secret sets were never compared.
	//
	// Running it here makes the guarantee a property of the build: an entry
	// cannot enter the archive without passing the same scan the tables did.
	// `debateEntries` stays, because failing early with a per-slug message is
	// friendlier — but it is no longer what makes the archive safe.
	for (const entry of opts.extraEntries ?? []) {
		const outcome = assertTextArtifactClean(entry.name, entry.content, secrets);
		advisories.push(...outcome.advisories);
		guardSkips.push(...outcome.skipped);
	}

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
		// ⚠ The hash that does not move. `tarball_sha256` verifies the bytes a
		// reader downloaded; it is NOT a stable identifier for the DATA,
		// because gzip's XFL/OS bytes are platform-derived and the deflate
		// stream is not byte-stable across zlib versions. §19.1 contemplates a
		// v2 rebuild against the same source state — rebuilt elsewhere that
		// would change `tarball_sha256` for identical content, and someone
		// would reasonably read the difference as data drift.
		content_sha256: contentSha256(entries),
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
						// ⚠ DERIVED from the registries that actually drive the
						// strip and the rename — never hand-copied literals.
						// `@code-reviewer` H-5: hardcoding these reproduces the
						// row-count defect one field over. Add a third key to
						// STRIPPED_METADATA_KEYS and the strip changes while a
						// literal manifest keeps describing the old shape, and a
						// test asserting the same literal back still passes.
						metadata_fields_included: SHIPPED_METADATA_KEYS.map((k) =>
							k === "user_id" ? pseudonymColumnName(k) : k,
						),
						metadata_fields_excluded: [...STRIPPED_METADATA_KEYS],
					}
				: {}),
		})),
		// §19.1 requires the manifest name "the included file inventory", and
		// `manifest.tables` covers only the CSVs. The debate documents are half
		// the archive; without this a reader has no listing for them at all.
		extra_files: (opts.extraEntries ?? []).map((e) => ({
			name: e.name,
			bytes: Buffer.byteLength(e.content, "utf8"),
		})),
		withheld: Object.entries(TABLE_INVENTORY)
			.filter(([, e]) => e.status !== "SHIPPED")
			.map(([name, e]) => ({ name, reason: `${e.status} — ${e.source}` })),
		// ⚠ COUNTS, never paths. An advisory path reads
		// `[no-email] comments @ [412].body` — and §19.7 serves this manifest
		// publicly. Published, that is a machine-readable oracle: take data
		// row 413 of comments.csv, read the pseudonym beside it, and you have
		// CONFIRMATION that a substring of that body is a real `users.name`
		// or `users.email` from the source. That is a pseudonym↔identity
		// binding aid the corpus otherwise withholds by design, manufactured
		// by the privacy layer itself (`@security-auditor` F-11 M-A).
		//
		// The operator gets the paths on the build console, where they are
		// useful and not published.
		advisories: summarizeAdvisories(advisories),
		skipped_needles: guardSkips.length,
		notes: [
			...(opts.notes ?? []),
			// ⚠ DECLINED, and recorded rather than silently accepted
			// (`@security-auditor` M-6). `comments.body` is unconstrained
			// participant text and SHIPs per Appendix B.6, so a body beginning
			// `=`, `+`, `-` or `@` is a spreadsheet formula when this file is
			// opened in Excel or Sheets. The standard mitigation is to prefix
			// such fields with an apostrophe — which ALTERS the argument text,
			// and this is a research corpus whose whole value is that the
			// arguments are verbatim. A dash-led bullet is ordinary prose.
			// Documented for the reader instead of corrupting the data.
			"⚠ comments.body is verbatim participant text and is NOT neutralised " +
				"against spreadsheet formula injection. Do not open the CSVs " +
				"directly in Excel / LibreOffice / Sheets; load them with a CSV " +
				"parser (pandas, R, csv module), which is unaffected.",
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
	const treatments = treatmentsFor(table);
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
