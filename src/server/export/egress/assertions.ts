import { type EgressViolation, EgressViolationError } from "./errors";
import {
	GLOBALLY_FORBIDDEN_PAYLOAD_KEYS,
	STRIPPED_METADATA_KEYS,
} from "./forbidden-keys";
import { findKeys, findValues, scanText, UUID_RE_GLOBAL } from "./scan";

/**
 * DATASET.1 — the shared egress assertion helpers (brief §4 Slice 1).
 *
 * **This layer is built before either exporter, and that ordering is the
 * point.** A guard authored after the pipeline it guards is written by
 * someone who already knows what the pipeline emits, and it converges on
 * asserting exactly that — which is why the brief fixes the order rather
 * than the schedule.
 *
 * Both artifacts pass through here: the per-table CSVs and the per-market
 * debate `.md` files. One layer, so a rule fixed for one is fixed for both,
 * and neither can drift into having its own weaker notion of what is safe.
 *
 * ## The secret set
 *
 * Every helper that matters takes an `EgressSecrets` — the *actual values*
 * collected from the source database before the transform ran. This is what
 * makes the guards real rather than decorative. Asserting "no key named `ip`
 * survives" is weak: it cannot see an IP that arrives under a different key,
 * or one interpolated into prose. Asserting "the string `203.0.113.7` does
 * not appear anywhere in this artifact", when `203.0.113.7` is known to have
 * been in the source, is a claim that cannot be satisfied by accident.
 */

/**
 * The values that must not survive into any artifact, harvested from the
 * source rows *before* the strip and pseudonymize passes run.
 *
 * ⚠ Collected pre-transform, never post-. Harvesting after the transform
 * would collect the values that survived and assert those are absent — a
 * tautology that passes on every input, including a completely unstripped
 * one. If this set is ever built from transformed rows, every guard below
 * silently becomes a no-op while continuing to report success.
 */
export interface EgressSecrets {
	/** Every `users.id` in the source. Ships ONLY in the `users` table. */
	readonly userIds: ReadonlySet<string>;
	/** Every `tos_acceptance_ip`, `metadata.ip`, `payload.ip`. */
	readonly ips: ReadonlySet<string>;
	/** Every `tos_acceptance_user_agent`, `metadata.user_agent`. */
	readonly userAgents: ReadonlySet<string>;
	/** Every `users.google_id` / `payload.googleId`. */
	readonly googleIds: ReadonlySet<string>;
	/** Every `image_uploads.r2_object_key`, `mod_actions.image_r2_key`. */
	readonly r2ObjectKeys: ReadonlySet<string>;
	/** Every admin `sessionId` seen in an `admin.*` payload. */
	readonly adminSessionIds: ReadonlySet<string>;
	/** Every `users.email` / `payload.email`. */
	readonly emails: ReadonlySet<string>;
}

/** An empty secret set — for callers with genuinely nothing to protect. */
export function emptySecrets(): EgressSecrets {
	return {
		userIds: new Set(),
		ips: new Set(),
		userAgents: new Set(),
		googleIds: new Set(),
		r2ObjectKeys: new Set(),
		adminSessionIds: new Set(),
		emails: new Set(),
	};
}

/**
 * Accumulates violations across many assertions and throws once at the end.
 *
 * Deliberately not fail-fast. A pipeline that stops at the first violation
 * makes the operator re-run the whole export to discover the second one, and
 * the export is a one-shot job on the morning of a conference.
 */
export class EgressGuard {
	private readonly violations: EgressViolation[] = [];

	constructor(private readonly secrets: EgressSecrets) {}

	private add(v: EgressViolation): void {
		this.violations.push(v);
	}

	/** Everything found so far. Empty means every assertion passed. */
	get findings(): readonly EgressViolation[] {
		return this.violations;
	}

	/** Throws `EgressViolationError` if anything was found. */
	assertClean(): void {
		if (this.violations.length > 0) {
			throw new EgressViolationError(this.violations);
		}
	}

	// ── the six named helpers (brief §4 Slice 1) ────────────────────────

	/**
	 * **No raw `users.id` outside the `users` table.**
	 *
	 * The wall this project's whole strip-not-hash posture exists to hold
	 * (brief §5). Exact-value match against the known id set — exhaustive,
	 * and with no false positives, because it compares against the actual
	 * ids rather than guessing from shape.
	 *
	 * `isUsersTable` is the ONE exemption, and it is narrow: §19.5's last
	 * paragraph preserves `users.id` in `users` as a join key for
	 * cross-table integrity verification. It is not a general escape hatch,
	 * and any second caller passing `true` is a defect.
	 */
	assertNoRawUserIds(
		artifact: string,
		rows: unknown,
		{ isUsersTable = false }: { isUsersTable?: boolean } = {},
	): this {
		if (isUsersTable) return this;
		for (const hit of findValues(rows, this.secrets.userIds)) {
			this.add({
				rule: "no-raw-user-id",
				artifact,
				path: hit.path,
				detail: `a raw users.id survived (key: ${hit.key ?? "—"})`,
			});
		}
		return this;
	}

	/** **No `ip`** — by value, wherever it surfaces. */
	assertNoIps(artifact: string, rows: unknown): this {
		return this.byValue(artifact, rows, this.secrets.ips, "no-ip", "an ip");
	}

	/** **No `user_agent`.** */
	assertNoUserAgents(artifact: string, rows: unknown): this {
		return this.byValue(
			artifact,
			rows,
			this.secrets.userAgents,
			"no-user-agent",
			"a user_agent",
		);
	}

	/** **No `googleId`.** */
	assertNoGoogleIds(artifact: string, rows: unknown): this {
		return this.byValue(
			artifact,
			rows,
			this.secrets.googleIds,
			"no-google-id",
			"a google_id",
		);
	}

	/** **No R2 object `key`.** ⚠ R2 keys embed the userId (SCAFFOLD.15 §Q9). */
	assertNoR2ObjectKeys(artifact: string, rows: unknown): this {
		return this.byValue(
			artifact,
			rows,
			this.secrets.r2ObjectKeys,
			"no-r2-object-key",
			"an R2 object key",
		);
	}

	/** **No admin `sessionId`.** */
	assertNoAdminSessionIds(artifact: string, rows: unknown): this {
		return this.byValue(
			artifact,
			rows,
			this.secrets.adminSessionIds,
			"no-admin-session-id",
			"an admin sessionId",
		);
	}

	/** **No `email`.** Not in the brief's six; §19.4 row 1 requires it. */
	assertNoEmails(artifact: string, rows: unknown): this {
		return this.byValue(
			artifact,
			rows,
			this.secrets.emails,
			"no-email",
			"an email",
		);
	}

	// ── key-shaped nets ─────────────────────────────────────────────────

	/**
	 * No `metadata.ip` / `metadata.user_agent` KEY survives, even carrying a
	 * null. §19.4 says the key is *removed*, not nulled — a surviving
	 * `"ip": null` column announces that the field existed and was withheld,
	 * which is a weaker privacy posture than the column never appearing, and
	 * it is not what Appendix B.23's `metadata - 'ip'` prescribes.
	 */
	assertNoStrippedMetadataKeys(artifact: string, rows: unknown): this {
		for (const hit of findKeys(rows, STRIPPED_METADATA_KEYS)) {
			this.add({
				rule: "no-stripped-metadata-key",
				artifact,
				path: hit.path,
				detail: `metadata key '${hit.key}' survived the strip`,
			});
		}
		return this;
	}

	/**
	 * No globally-forbidden payload key survives on ANY event type.
	 *
	 * The cross-cutting net behind the per-event-type rules: `key` is
	 * stripped from `image_upload.*` by rule, and listed here so that a
	 * `key` appearing on some other event type — one whose rule reads `[]`
	 * because nobody expected it to carry one — still fails.
	 */
	assertNoForbiddenPayloadKeys(artifact: string, rows: unknown): this {
		for (const hit of findKeys(rows, GLOBALLY_FORBIDDEN_PAYLOAD_KEYS)) {
			this.add({
				rule: "no-forbidden-payload-key",
				artifact,
				path: hit.path,
				detail: `forbidden key '${hit.key}' survived the strip`,
			});
		}
		return this;
	}

	// ── rendered-text artifacts (the debate .md files) ──────────────────

	/**
	 * Run every value-class guard over a rendered TEXT artifact.
	 *
	 * Markdown has no keys, so the key-shaped assertions above cannot see
	 * anything here. This is the only guard the `.md` artifact class gets,
	 * and it is why the secret set is value-based rather than key-based.
	 */
	assertTextClean(artifact: string, text: string): this {
		const classes: readonly [string, ReadonlySet<string>, string][] = [
			["no-raw-user-id", this.secrets.userIds, "a raw users.id"],
			["no-ip", this.secrets.ips, "an ip"],
			["no-user-agent", this.secrets.userAgents, "a user_agent"],
			["no-google-id", this.secrets.googleIds, "a google_id"],
			["no-r2-object-key", this.secrets.r2ObjectKeys, "an R2 object key"],
			[
				"no-admin-session-id",
				this.secrets.adminSessionIds,
				"an admin sessionId",
			],
			["no-email", this.secrets.emails, "an email"],
		];

		for (const [rule, values, noun] of classes) {
			for (const hit of scanText(text, values)) {
				this.add({
					rule,
					artifact,
					path: `line ${hit.line}`,
					detail: `${noun} appears in rendered text (${hit.fingerprint})`,
				});
			}
		}
		return this;
	}

	/**
	 * Secondary net: ANY canonical-shaped UUID in a rendered text artifact.
	 *
	 * Distinct from `assertTextClean`'s exact-value pass, and deliberately
	 * broader. The exact pass can only reject ids present in the secret set;
	 * this rejects a UUID whose provenance the guard cannot account for at
	 * all. In a debate `.md` — prose plus pseudonyms plus market slugs —
	 * there is no legitimate reason for a bare UUID to appear, so its
	 * presence is a defect even when it is not a user id.
	 */
	assertNoBareUuidsInText(artifact: string, text: string): this {
		for (const [i, line] of text.split("\n").entries()) {
			for (const m of line.matchAll(UUID_RE_GLOBAL)) {
				this.add({
					rule: "no-bare-uuid-in-text",
					artifact,
					path: `line ${i + 1}`,
					detail: `a bare UUID appears in rendered text (${m[0].slice(0, 8)}…)`,
				});
			}
		}
		return this;
	}

	// ── internal ────────────────────────────────────────────────────────

	private byValue(
		artifact: string,
		rows: unknown,
		values: ReadonlySet<string>,
		rule: string,
		noun: string,
	): this {
		for (const hit of findValues(rows, values)) {
			this.add({
				rule,
				artifact,
				path: hit.path,
				detail: `${noun} survived (key: ${hit.key ?? "—"})`,
			});
		}
		return this;
	}
}

/**
 * Run every applicable guard over one exported TABLE and throw on any
 * violation. The single entry point a table writer calls — so that adding a
 * table cannot accidentally opt out of a guard by forgetting to call it.
 */
export function assertTableClean(
	table: string,
	rows: unknown,
	secrets: EgressSecrets,
	{ isUsersTable = false }: { isUsersTable?: boolean } = {},
): void {
	new EgressGuard(secrets)
		.assertNoRawUserIds(table, rows, { isUsersTable })
		.assertNoIps(table, rows)
		.assertNoUserAgents(table, rows)
		.assertNoGoogleIds(table, rows)
		.assertNoR2ObjectKeys(table, rows)
		.assertNoAdminSessionIds(table, rows)
		.assertNoEmails(table, rows)
		.assertNoStrippedMetadataKeys(table, rows)
		.assertNoForbiddenPayloadKeys(table, rows)
		.assertClean();
}

/**
 * Run every applicable guard over one rendered TEXT artifact and throw on any
 * violation. The `.md` counterpart to `assertTableClean`.
 */
export function assertTextArtifactClean(
	artifact: string,
	text: string,
	secrets: EgressSecrets,
): void {
	new EgressGuard(secrets)
		.assertTextClean(artifact, text)
		.assertNoBareUuidsInText(artifact, text)
		.assertClean();
}
