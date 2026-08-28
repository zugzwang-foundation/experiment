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
	/**
	 * Every `users.name` — the participant's REAL Google display name.
	 *
	 * ⚠ Added after `@code-reviewer` H-4. It is `STRIP` per Appendix B.1 and
	 * the strip was correct, but no VALUE class covered it — so the layer's
	 * whole strength (*"the string X does not appear anywhere, and X was
	 * known to be in the source"*) had never been applied to the single most
	 * identifying column in the dataset. A key-level `not.toHaveProperty`
	 * cannot see a real name that reaches an artifact under another key, or
	 * interpolated into a debate document.
	 */
	readonly displayNames: ReadonlySet<string>;
	/** Every `users.image` — the Google avatar URL. STRIP per B.1. */
	readonly avatarUrls: ReadonlySet<string>;
	/**
	 * Every `mod_actions.blocked_text` — the rejected comment body of a
	 * gate-block. STRIP per B.10, and absent from §19.4's ten-column table.
	 */
	readonly blockedTexts: ReadonlySet<string>;
}

/**
 * Minimum length for a value-scan needle.
 *
 * ⚠ **A short needle is a denial-of-service on the release build, not extra
 * safety.** `users.name` is a participant's real Google display name and is a
 * value class — so a participant named "Li", "Bo", "An" or "Max" makes their
 * name a substring of ordinary English, and every debate export containing
 * "Line 3" or "Maximum" fails. No attacker required; one such participant is
 * enough, and the only fix reachable at 06:00 on release morning is to switch
 * the class off entirely.
 *
 * Six characters is chosen because nothing shorter is a usable
 * re-identification vector on its own, and everything the dataset genuinely
 * must not leak — UUIDs, IPs, emails, user agents, R2 keys, session ids — is
 * comfortably longer. Skipped needles are REPORTED (`skippedNeedles`) rather
 * than silently dropped, because a guard that quietly stops covering a class
 * is the failure this whole layer exists to prevent.
 *
 * (`@security-auditor` H-4.)
 */
export const MIN_NEEDLE_LENGTH = 6;

/**
 * Columns whose contents are PARTICIPANT-AUTHORED FREE TEXT.
 *
 * ⚠ A secret found here is **reported, never fatal**, and the distinction is
 * the difference between a guard and a kill switch.
 *
 * The dataset's guarantee is about COLUMNS: §19.4 says the stripped column
 * does not appear in the release. It does not, and cannot, promise that a
 * given string appears nowhere in the corpus — because a participant can type
 * anything into an argument, including a UUID, an email address, or their own
 * real name.
 *
 * So a secret value surfacing in `comments.body` is self-disclosure or
 * coincidence, not a transform failure; halting on it hands every participant
 * a deterministic abort of a one-shot release. The same value surfacing in a
 * column the transform was supposed to have cleaned IS a transform failure,
 * and still halts.
 *
 * Measured attack this closes (`@security-auditor` H-4): post body *B* with a
 * disallowed image → blocked, `mod_actions.blocked_text = B`; re-post *B*
 * without the image → passes moderation → `comments.body === B` → the
 * `blocked_text` value class fires on a legitimately published argument and
 * the build dies.
 */
export const FREE_TEXT_COLUMNS = new Set([
	"body",
	"title",
	"description",
	"resolution_note",
]);

/**
 * ⚠ **`blocked_text` and `reason` are deliberately NOT in that set**, and
 * removing them is the correction to a fix that cut its own belt.
 *
 * `mod_actions.blocked_text` is a REAL COLUMN and is `STRIP` (B.10). Listing
 * it as free text meant `assertNoBlockedTexts` could never fire fatally on
 * the one column it exists to protect: if the treatments map ever lost that
 * `STRIP`, the rejected body would ship in `mod_actions.csv` with an advisory
 * line and a zero exit code (`@security-auditor` F-11 H-C).
 *
 * `reason` is likewise a real column on `mod_actions` and `resolution_events`
 * — admin free text, not participant free text, and it ships by design.
 * Downgrading hits under that key name would silence a transform failure on
 * two shipped columns.
 *
 * The re-post attack the tier was built for only ever needed `body`, which is
 * the column that actually holds a participant's argument.
 */

/**
 * Is this R2 object key operator-curated market media (`m/<marketId>/…`)?
 *
 * The `m/` namespace ships (Appendix B.16, §19.4.1's `market.created` row);
 * the `u/` namespace never does, because SCAFFOLD.15 §Q9 embeds the user id in
 * the path. Matching on the prefix rather than on the column name is what lets
 * the same key NAME be safe in one place and a leak in another.
 */
export function isMarketMediaKey(value: unknown): boolean {
	return typeof value === "string" && value.startsWith("m/");
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
		displayNames: new Set(),
		avatarUrls: new Set(),
		blockedTexts: new Set(),
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
	private readonly warnings: EgressViolation[] = [];
	private readonly skipped: { rule: string; length: number }[] = [];

	constructor(private readonly secrets: EgressSecrets) {}

	private add(v: EgressViolation): void {
		this.violations.push(v);
	}

	/** Everything found so far. Empty means every assertion passed. */
	get findings(): readonly EgressViolation[] {
		return this.violations;
	}

	/**
	 * Non-fatal findings: a secret value inside participant-authored free
	 * text, or a heuristic net that fired. Surfaced in the manifest so the
	 * operator sees them without the build dying on content a participant
	 * chose to write.
	 */
	get advisories(): readonly EgressViolation[] {
		return this.warnings;
	}

	/** Needles too short to scan safely — reported, never silently dropped. */
	get skippedNeedles(): readonly { rule: string; length: number }[] {
		return this.skipped;
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

	/** **No real display name.** `users.name`, STRIP per B.1. */
	assertNoDisplayNames(artifact: string, rows: unknown): this {
		return this.byValue(
			artifact,
			rows,
			this.secrets.displayNames,
			"no-display-name",
			"a real display name",
		);
	}

	/** **No Google avatar URL.** `users.image`, STRIP per B.1. */
	assertNoAvatarUrls(artifact: string, rows: unknown): this {
		return this.byValue(
			artifact,
			rows,
			this.secrets.avatarUrls,
			"no-avatar-url",
			"a Google avatar URL",
		);
	}

	/** **No gate-blocked body.** `mod_actions.blocked_text`, STRIP per B.10. */
	assertNoBlockedTexts(artifact: string, rows: unknown): this {
		return this.byValue(
			artifact,
			rows,
			this.secrets.blockedTexts,
			"no-blocked-text",
			"a gate-blocked comment body",
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
			// ⚠ `key` is NAMESPACE-DEPENDENT and a blanket rule is wrong.
			//
			// `market.created.payload.media[].key` is a required field
			// (`schemas.ts` — `.min(1)`), so EVERY market carries one, and
			// §19.4.1 rules that `media[]` SHIPs. Those keys live in
			// `m/<marketId>/`: operator-curated public context with no user id
			// embedded (Appendix B.16 ships the same value as a column).
			//
			// An `u/<userId>/<uploadId>.<ext>` key is the opposite — SCAFFOLD.15
			// §Q9 puts the user id inside the string, so it is a raw `users.id`
			// carrier wearing a different name.
			//
			// This rejected BOTH until `@security-auditor` H-1 measured it: the
			// build hard-failed on the first real `market.created` row, on a
			// one-shot job, for a key the spec explicitly ships. The fixture
			// modelled that payload as `{ marketId }` alone, so nothing on the
			// branch could see it.
			if (hit.key === "key" && isMarketMediaKey(hit.value)) continue;

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
		// ⚠ The text arm is TIERED, and the line is not "participant-authored
		// vs not" — the whole document is participant-authored. The line is
		// **machine-generated identifier vs human-authorable string.**
		//
		// A UUID, an IP, a user-agent string, a Google id, an R2 object key or
		// a session token has no reason to appear in an argument. The
		// serializer provably cannot emit one — it consumes only the masked
		// variants, whose removed forms carry no body or author field at all
		// (debate-export.md §10.1) — so one appearing is a SERIALIZER LEAK and
		// must halt.
		//
		// An email, a display name, an avatar URL or a previously-blocked body
		// is something a participant can and does write into an argument.
		// Halting there is the denial-of-service `@security-auditor` H-4 and
		// F-11 H-B measured: one participant named "Li" failing every debate
		// containing "Line".
		//
		// A first pass at this downgraded the ENTIRE arm, which went too far —
		// it would have let a genuine serializer leak of a raw `users.id`
		// through as an advisory. The tier is the point, not the downgrade.
		const classes: readonly [string, ReadonlySet<string>, string, boolean][] = [
			// ── machine-generated: a hit here is a SERIALIZER LEAK. FATAL. ──
			["no-raw-user-id", this.secrets.userIds, "a raw users.id", true],
			["no-ip", this.secrets.ips, "an ip", true],
			["no-user-agent", this.secrets.userAgents, "a user_agent", true],
			["no-google-id", this.secrets.googleIds, "a google_id", true],
			["no-r2-object-key", this.secrets.r2ObjectKeys, "an R2 object key", true],
			[
				"no-admin-session-id",
				this.secrets.adminSessionIds,
				"an admin sessionId",
				true,
			],
			// ── human-authorable: self-disclosure, not a defect. ADVISORY. ──
			["no-email", this.secrets.emails, "an email", false],
			["no-avatar-url", this.secrets.avatarUrls, "a Google avatar URL", false],
			[
				"no-display-name",
				this.secrets.displayNames,
				"a real display name",
				false,
			],
			[
				"no-blocked-text",
				this.secrets.blockedTexts,
				"a gate-blocked comment body",
				false,
			],
		];

		for (const [rule, values, noun, fatal] of classes) {
			// ⚠ The SAME needle floor the CSV arm uses. This arm had neither
			// the floor nor the free-text tier — and it is a substring
			// matcher over a document that is participant prose end to end,
			// which made it the ONLY arm the H-4 attacks still worked on
			// (`@security-auditor` F-11 H-B). A display name of "Li" failed
			// every debate containing the word "Line".
			const usable = new Set<string>();
			for (const v of values) {
				if (v.length >= MIN_NEEDLE_LENGTH) usable.add(v);
				else this.skipped.push({ rule, length: v.length });
			}

			for (const hit of scanText(text, usable)) {
				const entry = {
					rule,
					artifact,
					path: `line ${hit.line}`,
					detail: `${noun} appears in rendered text (${hit.fingerprint})`,
				};
				if (fatal) this.add(entry);
				else
					this.warnings.push({
						...entry,
						detail: `${entry.detail} — advisory (participant-authorable)`,
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
				// ⚠ ADVISORY, not fatal — and the downgrade is deliberate.
				//
				// This net only adds anything for a UUID the secret set did NOT
				// collect; every real `users.id` is already covered by the exact
				// scan above, which DOES halt. What remains in its blast radius
				// is a participant typing a UUID into an argument — which aborts
				// that market's export, on a one-shot job, for content the
				// participant was entitled to write (`@security-auditor` H-4).
				//
				// So it keeps its job (surfacing an id whose provenance the
				// guard cannot account for) without handing anyone a kill
				// switch. The hard guarantee is the exact-value scan.
				this.warnings.push({
					rule: "bare-uuid-in-text",
					artifact,
					path: `line ${i + 1}`,
					detail: `a bare UUID appears in rendered text (${m[0].slice(0, 8)}…) — advisory`,
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
		const usable = new Set<string>();
		for (const v of values) {
			if (v.length >= MIN_NEEDLE_LENGTH) usable.add(v);
			else this.skipped.push({ rule, length: v.length });
		}

		for (const hit of findValues(rows, usable)) {
			const entry = {
				rule,
				artifact,
				path: hit.path,
				detail: `${noun} survived (key: ${hit.key ?? "—"})`,
			};
			// A hit inside participant-authored free text is self-disclosure,
			// not a transform failure — reported, never fatal. See
			// FREE_TEXT_COLUMNS for why halting there is a kill switch.
			if (hit.key !== null && FREE_TEXT_COLUMNS.has(hit.key)) {
				this.warnings.push({
					...entry,
					detail:
						`${noun} appears in participant-authored free text ` +
						`(${hit.key}) — reported, not fatal`,
				});
				continue;
			}
			this.add(entry);
		}
		return this;
	}
}

/**
 * What a guard run produced besides throwing.
 *
 * ⚠ `skipped` is carried out to the caller because the docblock on
 * `MIN_NEEDLE_LENGTH` promises skipped needles are *"REPORTED rather than
 * silently dropped, because a guard that quietly stops covering a class is
 * the failure this whole layer exists to prevent"* — and until
 * `@security-auditor` F-11 M-B, nothing outside a test ever read it. A
 * guarantee with no reader is a sentence, not a mechanism.
 */
export interface GuardOutcome {
	readonly advisories: readonly EgressViolation[];
	readonly skipped: readonly { rule: string; length: number }[];
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
): GuardOutcome {
	const guard = new EgressGuard(secrets);
	guard
		.assertNoRawUserIds(table, rows, { isUsersTable })
		.assertNoIps(table, rows)
		.assertNoUserAgents(table, rows)
		.assertNoGoogleIds(table, rows)
		.assertNoR2ObjectKeys(table, rows)
		.assertNoAdminSessionIds(table, rows)
		.assertNoEmails(table, rows)
		.assertNoDisplayNames(table, rows)
		.assertNoAvatarUrls(table, rows)
		.assertNoBlockedTexts(table, rows)
		.assertNoStrippedMetadataKeys(table, rows)
		.assertNoForbiddenPayloadKeys(table, rows)
		.assertClean();
	// Advisories are RETURNED, not thrown — a secret inside participant
	// free text is reported so the operator sees it, without handing any
	// participant an abort switch on a one-shot release.
	return { advisories: guard.advisories, skipped: guard.skippedNeedles };
}

/**
 * Run every applicable guard over one rendered TEXT artifact and throw on any
 * violation. The `.md` counterpart to `assertTableClean`.
 */
export function assertTextArtifactClean(
	artifact: string,
	text: string,
	secrets: EgressSecrets,
): GuardOutcome {
	const guard = new EgressGuard(secrets);
	guard
		.assertTextClean(artifact, text)
		.assertNoBareUuidsInText(artifact, text)
		.assertClean();
	return { advisories: guard.advisories, skipped: guard.skippedNeedles };
}
