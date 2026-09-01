import {
	assertTableClean,
	assertTextArtifactClean,
	type EgressSecrets,
} from "@/server/export/egress";
import { assertShipRulesComplete } from "@/server/export/egress/completeness";
import {
	EgressContractGapError,
	type EgressViolation,
} from "@/server/export/egress/errors";
import {
	SHIPPED_METADATA_KEYS,
	STRIPPED_METADATA_KEYS,
	shipsDespiteForbiddenKey,
} from "@/server/export/egress/forbidden-keys";
import { walk } from "@/server/export/egress/scan";

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
import {
	assertTreatmentsComplete,
	type StrippedColumnPath,
	treatmentsFor,
} from "./treatments";

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
	/**
	 * The advisory findings IN FULL, with their per-row paths — for the
	 * operator's console, never for the manifest.
	 *
	 * ⚠ **This exists because the manifest's own comment promised it and
	 * nothing delivered it** (`@security-auditor` L-1). The comment beside
	 * `advisories` reads *"the operator gets the paths on the build console,
	 * where they are useful and not published"* — and the array holding the
	 * paths was local to `buildDataset` and discarded when it returned. Only
	 * counts survived. An advisory that says `no-email: 3` and gives no way to
	 * look at the three is a number, not a finding: the operator cannot tell a
	 * participant who typed their own address into an argument from a strip
	 * that half-worked.
	 *
	 * That is the `O-13` shape — a stated mechanism that does not exist — and
	 * the fix is to return the thing rather than to soften the sentence.
	 *
	 * ⚠ It is deliberately NOT in `DatasetManifest`. A published advisory path
	 * reads `[no-email] comments @ [412].body`, and §19.7 serves the manifest
	 * publicly: take data row 413 of `comments.csv`, read the pseudonym beside
	 * it, and you have confirmation that a substring of that body is a real
	 * `users.email` from the source — a pseudonym↔identity oracle manufactured
	 * by the privacy layer itself (`@security-auditor` F-11 M-A).
	 */
	readonly advisoryDetail: readonly EgressViolation[];
	/**
	 * Skipped needles WITH the rule each belongs to.
	 *
	 * ⚠ `manifest.skipped_needles` is a bare count, and a bare count of a
	 * per-needle-per-rule-per-artifact product is close to unreadable: one
	 * participant named "Li" yields sixteen entries plus ten per debate
	 * document (`@security-auditor` L-2). The count still ships, because a
	 * non-zero one means a value class is not fully covered and the reader is
	 * entitled to know that. The BREAKDOWN — which rule, how many, how short —
	 * goes to the console, where the operator can act on it.
	 */
	readonly skippedDetail: readonly { rule: string; length: number }[];
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
 * JSONB sub-key name → the `EgressSecrets` bucket it feeds.
 *
 * ⚠ **Deliberately a superset of what any one payload shape carries today**,
 * and deliberately covering both the `snake_case` and `camelCase` spellings
 * of the same fact. Payload keys are `camelCase` (`googleId`, `userAgent`),
 * metadata keys are `snake_case` (`user_agent`) — and the harvest now walks
 * both containers with one table, so it has to know both. A key spelled a
 * third way is a value nobody harvests and therefore a value nobody scans
 * for, so breadth here is cheap and the failure it prevents is not.
 *
 * ⚠ **This used to name the §19.4.1 completeness guard as the backstop for
 * that, and it is not one** (`@test-writer` HIGH-1b). That guard asserts every
 * event **type** has a rule; it says nothing about whether every **key** in a
 * payload is covered. Adding a nested key to an existing type's payload
 * passes it untouched — which is exactly the shape §19.4.1's table invites,
 * since it asks an author *which keys are sensitive* and never *how deep*.
 * There is no backstop for an unlisted key name today; see `strip.ts`.
 *
 * ⚠ `userId` is NOT here. Raw `users.id` values are harvested exhaustively
 * from the `users` table itself, which is the authoritative and complete set;
 * collecting them again from payloads would add nothing and would risk
 * harvesting a *pseudonymized* value if this ever ran post-transform.
 */
const HARVEST_KEYS: Readonly<Record<string, SecretBucket>> = {
	ip: "ips",
	user_agent: "userAgents",
	userAgent: "userAgents",
	googleId: "googleIds",
	google_id: "googleIds",
	email: "emails",
	key: "r2ObjectKeys",
	sessionId: "adminSessionIds",
	session_id: "adminSessionIds",
};

/** The harvest buckets — every field of `EgressSecrets` except the tag set. */
export type SecretBucket = Exclude<keyof EgressSecrets, "participantSourced">;

/**
 * Every `STRIP` column → the `EgressSecrets` bucket its values are harvested
 * into, plus the provenance of the field it comes from.
 *
 * ⚠⚠ **Ruling I (DATASET.3), and the `satisfies` clause IS the ruling.**
 * `Record<StrippedColumnPath, …>` requires an entry for EVERY column Appendix
 * B classifies `STRIP` — so adding one to `COLUMN_TREATMENTS` without deciding
 * how its values are harvested **fails `tsc`**, months before anyone runs the
 * release.
 *
 * The gap this closes was measured by `@security-auditor` M-2: the harvest's
 * column list was hand-maintained and structurally decoupled from the strip
 * set. They agreed on the day it was measured (`STRIP-but-NOT-harvested = []`
 * for all three tables) and **nothing made them agree**. A new `STRIP` column
 * would have passed every guard while silently leaving the value scan's reach
 * — the strip would remove it, and if the strip ever stopped, no needle would
 * exist to notice.
 *
 * ⚠ A test could not have delivered this. The reviewer's named failure mode
 * for ruling I was *"a 'derivation' that is still two declarations wearing one
 * name, so the compile error never fires"* — which is precisely what the
 * previous `STRIPPED_COLUMNS` + `registry-parity` pairing was.
 *
 * `users.id` is deliberately NOT here: it is `SHIP` in `users` (the §19.5
 * join-key exemption), not `STRIP`, so it is harvested separately.
 */
export const HARVEST_COLUMN_BUCKETS = {
	"users.name": { bucket: "displayNames", provenance: "PARTICIPANT" },
	"users.email": { bucket: "emails", provenance: "PARTICIPANT" },
	"users.image": { bucket: "avatarUrls", provenance: "SYSTEM" },
	"users.google_id": { bucket: "googleIds", provenance: "SYSTEM" },
	"users.tos_acceptance_ip": { bucket: "ips", provenance: "PARTICIPANT" },
	"users.tos_acceptance_user_agent": {
		bucket: "userAgents",
		provenance: "PARTICIPANT",
	},
	"image_uploads.r2_object_key": {
		bucket: "r2ObjectKeys",
		provenance: "SYSTEM",
	},
	"mod_actions.blocked_text": {
		bucket: "blockedTexts",
		provenance: "PARTICIPANT",
	},
	"mod_actions.image_r2_key": { bucket: "r2ObjectKeys", provenance: "SYSTEM" },
	// ⚠ Ruling S2 (DATASET.3) — 255 bytes of participant-chosen header text
	// that moderation never sees. It is STRIPPED now, so it needs a bucket;
	// and because it is participant-chosen it needs the PARTICIPANT tag, or a
	// participant could mint a key equal to a market slug and poison the build
	// through the very column this ruling added. The two rulings meet here.
	"bets.idempotency_key": {
		bucket: "idempotencyKeys",
		provenance: "PARTICIPANT",
	},
} as const satisfies Record<
	StrippedColumnPath,
	{ bucket: SecretBucket; provenance: Provenance }
>;

/**
 * Where a harvested value ENTERED the system — ruling S1, DATASET.3.
 *
 * ⚠ **This is a property of the SOURCE, not of the field it later turns up
 * in, and not of the value class.** `ips` and `userAgents` are not
 * participant-writable because of what they are; they are participant-writable
 * because the participant sends them in a request header and the server writes
 * them down verbatim. A hypothetical `ip` the system derived itself would be
 * `SYSTEM`, and it would be right for it to be.
 */
export type Provenance =
	/**
	 * The value arrived in a request the participant controls. A collision
	 * with a shipped value is therefore something they can arrange, so it is
	 * not evidence that a transform failed.
	 */
	| "PARTICIPANT"
	/**
	 * The value was minted server-side and no request can choose it. A
	 * collision cannot be arranged, so a hit IS evidence of a transform
	 * failure and stays fatal.
	 */
	| "SYSTEM";

/**
 * The provenance of every harvest SITE, and the argument for each.
 *
 * ⚠ **Derived from where the value enters, and CHECKED against the merge.**
 * Brief §4 Slice 2 asks whether the property captures a field nobody thought
 * of. Measured on this branch: the 111 commits merged from `main` touched
 * exactly six files under `src/server/`, `src/app/api/` and `src/db/`
 * (`config/limits.ts`, `debate-view/{load-debate-view,price-chart}.ts`,
 * `discovery/{cached-series,list,price-series}.ts`), and **not one of them
 * writes `events` or touches a harvest bucket** — the composer's client-side
 * downscale and the resolution blocks landed entirely in `src/components/`.
 * `EVENT_TYPES` is still 24 at runtime, the migration head is still
 * `0026_lots_no_delete`, and the payload-parity test would red on a new
 * payload key. So the window added no participant-writable surface reaching
 * this harvest, and that is measured rather than assumed.
 */
const SITE_PROVENANCE = {
	// ── PARTICIPANT ─────────────────────────────────────────────────────
	// `x-forwarded-for`'s first entry is client-supplied — proxies APPEND,
	// so `[0]` is whatever the caller sent. (That the app trusts `[0]` at
	// eight sites is a separate, escalated finding; here it is simply why
	// the value cannot be treated as system-minted.)
	"users.tos_acceptance_ip": "PARTICIPANT",
	"metadata.ip": "PARTICIPANT",
	"payload.ip": "PARTICIPANT",
	// The `User-Agent` header, verbatim. This is the C-1 attack's channel.
	"users.tos_acceptance_user_agent": "PARTICIPANT",
	"metadata.user_agent": "PARTICIPANT",
	"payload.userAgent": "PARTICIPANT",
	// The participant types their email at OTP sign-in; the Google-supplied
	// one is still an address they chose and control.
	"users.email": "PARTICIPANT",
	"payload.email": "PARTICIPANT",
	// The participant's Google DISPLAY NAME — set by them, on their own
	// account, to any string. This is `@security-auditor` H-4's "a
	// participant named Li" and it is participant-writable by construction.
	"users.name": "PARTICIPANT",
	// The participant's own comment body, rejected by the pre-commit gate
	// and retained for ban review. They wrote every byte of it.
	"mod_actions.blocked_text": "PARTICIPANT",

	// ── SYSTEM ──────────────────────────────────────────────────────────
	// UUIDv7, minted by Postgres. Unchoosable.
	"users.id": "SYSTEM",
	// Google's `sub`. Issued by Google, opaque, not settable by the account
	// holder — which is exactly why it is a durable identity key.
	"users.google_id": "SYSTEM",
	"payload.googleId": "SYSTEM",
	// A Google-minted avatar URL. The participant chooses the IMAGE; the URL
	// is generated. Classified SYSTEM because the string is not choosable —
	// which is the property that matters, not who supplied the picture.
	"users.image": "SYSTEM",
	// R2 object keys are minted server-side (`sign-upload.ts` builds the
	// prefix; no client input reaches the key) and embed the userId.
	"image_uploads.r2_object_key": "SYSTEM",
	"mod_actions.image_r2_key": "SYSTEM",
	"payload.key": "SYSTEM",
	// The admin session cookie value — a UUIDv7 PK (`admin_sessions.session_id`).
	"payload.sessionId": "SYSTEM",
	"events.aggregate_id[admin_session]": "SYSTEM",
} as const satisfies Record<string, Provenance>;

/**
 * Sub-key spellings whose harvested value is participant-supplied.
 *
 * ⚠ **DERIVED from `SITE_PROVENANCE`, not written out again**
 * (`@security-auditor` L-3). This was a second literal listing four spellings,
 * while `SITE_PROVENANCE` declared the provenance of the same eight JSONB
 * sites — two statements of one policy, agreeing on the day they were written
 * and with nothing making them agree afterwards. That is the exact shape
 * ruling I closed for `STRIPPED_COLUMNS`, reproduced in the commit that
 * applied it.
 *
 * Derived, so the JSONB half of the provenance decision has ONE home. Every
 * `payload.<key>` / `metadata.<key>` entry in `SITE_PROVENANCE` contributes its
 * sub-key; a site declared `PARTICIPANT` puts that spelling here and a site
 * declared `SYSTEM` does not.
 */
const PARTICIPANT_JSONB_KEYS: ReadonlySet<string> = new Set(
	Object.entries(SITE_PROVENANCE)
		.filter(
			([site, prov]) =>
				prov === "PARTICIPANT" &&
				(site.startsWith("payload.") || site.startsWith("metadata.")),
		)
		.map(([site]) => site.slice(site.indexOf(".") + 1)),
);

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
		idempotencyKeys: new Set<string>(),
		removedBodies: new Set<string>(),
	};

	/**
	 * Participant-sourced values → the FIELD NAMES each was harvested under.
	 *
	 * ⚠ **Both halves of ruling S1 live here.** Membership says the value is
	 * arrangeable, so a collision elsewhere is not evidence of a transform
	 * failure. The field names say where a hit WOULD still be evidence: the
	 * transform owns the fields it harvested from, so a hit under one of those
	 * names means it failed at its own job and stays fatal. See
	 * `EgressSecrets.participantSourced` for why provenance alone was too wide.
	 */
	const participant = new Map<string, Set<string>>();
	const system = new Set<string>();

	const add = (
		set: Set<string>,
		v: unknown,
		provenance: Provenance,
		field: string,
	) => {
		if (typeof v !== "string" || v.trim() === "") return;
		if (NON_SECRET_SENTINELS.has(v)) return;
		set.add(v);
		if (provenance === "PARTICIPANT") {
			const fields = participant.get(v) ?? new Set<string>();
			fields.add(field);
			participant.set(v, fields);
		} else {
			system.add(v);
		}
	};

	for (const row of tables.users ?? []) {
		add(s.userIds, row.id, SITE_PROVENANCE["users.id"], "id");
		add(s.emails, row.email, SITE_PROVENANCE["users.email"], "email");
		add(
			s.googleIds,
			row.google_id,
			SITE_PROVENANCE["users.google_id"],
			"google_id",
		);
		add(
			s.ips,
			row.tos_acceptance_ip,
			SITE_PROVENANCE["users.tos_acceptance_ip"],
			"tos_acceptance_ip",
		);
		add(
			s.userAgents,
			row.tos_acceptance_user_agent,
			SITE_PROVENANCE["users.tos_acceptance_user_agent"],
			"tos_acceptance_user_agent",
		);
		// ⚠ `users.name` is the participant's real Google display name and
		// `users.image` their avatar URL — both STRIP per B.1, and until
		// `@code-reviewer` H-4 neither had a value class, so the strongest
		// assertion this layer can make had never been pointed at the most
		// identifying column in the dataset.
		add(s.displayNames, row.name, SITE_PROVENANCE["users.name"], "name");
		add(s.avatarUrls, row.image, SITE_PROVENANCE["users.image"], "image");
	}
	for (const row of tables.image_uploads ?? []) {
		add(
			s.r2ObjectKeys,
			row.r2_object_key,
			SITE_PROVENANCE["image_uploads.r2_object_key"],
			"r2_object_key",
		);
	}
	// Ruling S2 (DATASET.3) — 255 bytes of participant-chosen header text.
	for (const row of tables.bets ?? []) {
		add(
			s.idempotencyKeys,
			row.idempotency_key,
			HARVEST_COLUMN_BUCKETS["bets.idempotency_key"].provenance,
			"idempotency_key",
		);
	}

	// ⚠ **Ruling H (DATASET.3) — the removed bodies.** Derived from the SAME
	// `mod_actions` predicate `removedCommentIds` uses, never a second idea of
	// what removal means: `reason === 'content_removed'`. Harvested under the
	// field name `body`, so a hit in `comments.body` is the masking predicate
	// having failed at its own job and stays FATAL, while the identical string
	// colliding elsewhere is advisory (ruling S1).
	{
		// ⚠ **`removedCommentIds(...)`, the SHIPPED predicate — not a second
		// copy of it** (`@security-auditor` L-9). This block open-coded
		// `reason === "content_removed"` and `String(target_comment_id)` while
		// its own comment claimed to use *"the SAME predicate, never a second
		// idea of what removal means"*. It was literally a second one, and it
		// disagreed in a direction that matters: `removed.ts` requires the
		// target to be a non-empty STRING, so a null target became the string
		// `"null"` here and a member of the harvest set that the mask set does
		// not contain. Equal on today's data; free to diverge; and the
		// divergence that bites is the harvest set being SMALLER than the mask
		// set, which silently un-backs the value guard ruling H exists to add.
		const removed = removedCommentIds(tables.mod_actions ?? []);
		for (const row of tables.comments ?? []) {
			if (typeof row.id === "string" && removed.has(row.id)) {
				add(s.removedBodies, row.body, "PARTICIPANT", "body");
			}
		}
	}

	// ⚠ mod_actions.image_r2_key is a second R2 key on a shipped table.
	// §19.4's ten-column table does not name it; Appendix B.10 marks it STRIP.
	for (const row of tables.mod_actions ?? []) {
		add(
			s.r2ObjectKeys,
			row.image_r2_key,
			SITE_PROVENANCE["mod_actions.image_r2_key"],
			"image_r2_key",
		);
		add(
			s.blockedTexts,
			row.blocked_text,
			SITE_PROVENANCE["mod_actions.blocked_text"],
			"blocked_text",
		);
	}

	// Audit payloads carry ips, user agents, session ids and google ids that
	// may not appear on any `users` row — an admin has no users row at all,
	// so the admin's ip and session id are ONLY reachable here.
	//
	// ⚠ **DEPTH (DATASET.2 C2).** This read `p.ip`, `p.key`, `p.sessionId` …
	// at one level, and the strip walked one level too. The harvest now walks
	// to the same depth the strip does, via the same `walk` the guards use —
	// which is what closes `@security-auditor` H-3's harvest half.
	//
	// ⚠ **Corrected after measurement** (`@test-writer` HIGH-1): this comment
	// used to say the shallow pair "fell silent on the same input, and the
	// build reported success". For a nested key that is ON one of the nets,
	// that is false — `findKeys` rides the already-recursive `walk`, so the
	// KEY nets fired and the build ABORTED (8 violations, measured). The
	// value half of the claim was true and the conclusion was not.
	//
	// The harvest's depth still matters, for a reason worth stating exactly:
	// it is what lets the VALUE scan corroborate the key scan on nested data,
	// instead of leaving nested coverage resting on the key nets alone.
	for (const table of ["events", "admin_events", "user_events"]) {
		for (const row of tables[table] ?? []) {
			for (const container of [row.payload, row.metadata]) {
				for (const entry of walk(container)) {
					if (entry.key === null) continue;
					const bucket = HARVEST_KEYS[entry.key];
					if (bucket === undefined) continue;
					// ⚠ The SAME namespace predicate the strip and the assertion
					// use. Harvesting an `m/` market-media key as a secret would
					// make the value scan fire on `market_media.csv`, which SHIPs
					// that identical string as a column (Appendix B.16) — the
					// build would fail on a value it published itself, which is
					// `@security-auditor` H-1 reappearing one layer over. Going
					// recursive is what first brings `media[].key` within reach
					// of this loop at all.
					if (shipsDespiteForbiddenKey(entry.key, entry.value)) continue;
					// Ruling S1 — provenance by SUB-KEY SPELLING, because a
					// JSONB blob has no column to look the site up by. The four
					// participant-supplied spellings are the ones the request
					// carries verbatim; `key`, `sessionId` and `googleId` are
					// minted elsewhere and stay fatal.
					add(
						s[bucket],
						entry.value,
						PARTICIPANT_JSONB_KEYS.has(entry.key) ? "PARTICIPANT" : "SYSTEM",
						entry.key,
					);
				}
			}
			if (row.aggregate_type === "admin_session") {
				add(
					s.adminSessionIds,
					row.aggregate_id,
					SITE_PROVENANCE["events.aggregate_id[admin_session]"],
					"aggregate_id",
				);
			}
		}
	}

	// ⚠ **The stricter arm wins.** A value harvested from BOTH a
	// participant-writable field and a system-minted one stays fatal: an
	// attacker who sets their `User-Agent` to their own `users.id` must not
	// thereby downgrade the raw-user-id guard, which is the one wall §19.5
	// exists to hold.
	const participantOnly = new Map<string, ReadonlySet<string>>();
	for (const [v, fields] of participant) {
		if (!system.has(v)) participantOnly.set(v, fields);
	}

	return { ...s, participantSourced: participantOnly };
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
 * `compareTreatments`, `compareShipRules` — was already injectable for
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

/**
 * Guard the caller-supplied `source` label before it is PUBLISHED.
 *
 * ⚠ `manifest.source` is a free string the caller constructs, and the manifest
 * is served publicly per §19.7. The release task will build that string
 * standing next to a `DATABASE_URL` — the two live in the same function, one
 * describes the other, and nothing here rejected a connection string
 * (`@security-auditor` L-4). It is not that anyone intends to paste one; it is
 * that "the operator will not" is not a mechanism, and this is the one field
 * on the artifact whose contents no other guard looks at.
 *
 * The constraint is deliberately shape-based rather than a URL blocklist: a
 * label is a human description, so anything carrying a scheme, credentials, an
 * `@` host or a port is not one, whatever protocol it names.
 */
export function assertPublishableSourceLabel(label: string): string {
	const trimmed = label.trim();
	if (trimmed === "" || trimmed.length > 200) {
		throw new EgressContractGapError(
			"manifest.source",
			`is ${trimmed === "" ? "empty" : `${trimmed.length} characters`}. It ` +
				"is a short human description of where the rows came from, and it " +
				"is PUBLISHED.",
		);
	}
	// ⚠ **The two most likely non-URI forms were missing**
	// (`@security-auditor` M-1). This docblock claimed to reject *"anything
	// carrying a scheme, credentials, an `@` host or a port"* — and all three
	// original patterns required a `://` or an `@`, so a **libpq keyword
	// string** (`host=… port=5432 password=…`) and a **bare `host:5432`** both
	// passed. The keyword form is a first-class Postgres connection string and
	// is what a hand-assembled `DATABASE_URL`-adjacent paste usually looks
	// like. A guard whose stated coverage exceeds its actual coverage is worse
	// than none: it is what a reviewer reads instead of testing.
	const secretShaped = [
		// a scheme — `postgres://`, `postgresql://`, `http://`, …
		/[a-z][a-z0-9+.-]*:\/\//i,
		// userinfo — `user:pass@host`
		/\S+:\S+@\S+/,
		// a port after an `@` host
		/@[\w.-]+:\d{2,5}\b/,
		// ⚠ a BARE `host:5432` — no scheme, no `@`
		/\b[\w.-]+:\d{2,5}\b/,
		// ⚠ libpq keyword form — any one keyword is enough; a description does
		// not contain `password=`
		/\b(?:host|hostaddr|port|user|dbname|password|sslmode|options)\s*=/i,
		// a Supabase / bearer-shaped secret pasted whole
		/\b(?:sbp|sb|eyJ)[A-Za-z0-9_.-]{20,}/,
	];
	if (secretShaped.some((re) => re.test(trimmed))) {
		throw new EgressContractGapError(
			"manifest.source",
			"looks like a URL or a connection string rather than a description. " +
				"This field is published in the manifest — refusing to write it. " +
				"Use a phrase like 'production replica, 2026-11-06 freeze snapshot'.",
		);
	}
	return trimmed;
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

/**
 * The metadata fields that ship, for the manifest's per-table entry.
 *
 * ⚠ FOUR since ruling S2 (DATASET.3) — `idempotency_key` moved to
 * `STRIPPED_METADATA_KEYS`. Derived, never a literal, so the manifest cannot
 * advertise a field the strip removes.
 */
const METADATA_TABLES = new Set(["events", "admin_events", "user_events"]);

export async function buildDataset(opts: BuildOptions): Promise<BuildResult> {
	// ── 1 · contract checks, before a single row is read ────────────────
	assertShipRulesComplete();
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
		source: assertPublishableSourceLabel(opts.source.label),
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
		// useful and not published — via `BuildResult.advisoryDetail`, which
		// exists because this sentence was true of the intent and false of the
		// code until DATASET.3 (`@security-auditor` L-1).
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

	return {
		manifest,
		tarball,
		artifacts,
		results,
		advisoryDetail: advisories,
		skippedDetail: guardSkips,
	};
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
