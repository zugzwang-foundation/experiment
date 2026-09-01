import { describe, expect, it } from "vitest";

import { eventMetadataSchema } from "@/server/events/schemas";
import { COLUMN_TREATMENTS } from "@/server/export/dataset/treatments";
import {
	assertTableClean,
	assertTextArtifactClean,
	type EgressSecrets,
	EgressViolationError,
	emptySecrets,
	FORBIDDEN_VALUE_CLASSES,
	SHIPPED_METADATA_KEYS,
	STRIPPED_COLUMNS,
	STRIPPED_METADATA_KEYS,
} from "@/server/export/egress";

/**
 * DATASET.1 Slice 1 — parity between the DECLARED registries and the ones the
 * pipeline actually consumes.
 *
 * ⚠ Three of `forbidden-keys.ts`'s exported constants have **zero consumers**
 * anywhere in `src/`, and each of their docblocks describes a control that
 * therefore does not exist:
 *
 *   · `STRIPPED_COLUMNS` — the strip pipeline reads `COLUMN_TREATMENTS`, never
 *     this. Two independent statements of the same policy, free to disagree,
 *     with nothing that notices. An editor who "fixes" a column here changes
 *     no behaviour and gets no signal.
 *   · `SHIPPED_METADATA_KEYS` — its docblock says it is *"kept as an explicit
 *     positive list … so that a new metadata field added to §3.7's set fails
 *     the completeness guard rather than silently shipping on the strength of
 *     not being named a secret."* There is no such completeness guard. This
 *     file is it.
 *   · `FORBIDDEN_VALUE_CLASSES` — *"the named value-classes brief §4 Slice 1
 *     requires an assertion helper for"*, with nothing binding the list to the
 *     helpers. A seventh class would acquire no helper and nothing would fail.
 *
 * A constant nobody reads is not merely dead; it is a second source of truth
 * that looks authoritative in review. These tests make the parity load-bearing
 * without changing the constants' status.
 */

// ── metadata: §3.7's seven fields, partitioned ────────────────────────────

describe("egress · metadata keys partition §3.7's seven-field set", () => {
	// The live set, read from the runtime Zod schema rather than a literal —
	// so adding a field to `eventMetadataSchema` is what makes this fail, which
	// is the change that would otherwise ship the field unreviewed.
	const live = Object.keys(eventMetadataSchema.shape).sort();

	it("SHIPPED ∪ STRIPPED covers every live metadata field, exactly", () => {
		const declared = [
			...SHIPPED_METADATA_KEYS,
			...STRIPPED_METADATA_KEYS,
		].sort();

		expect(declared).toEqual(live);
	});

	it("SHIPPED and STRIPPED are disjoint", () => {
		// A field in both lists is a field whose treatment nobody settled; the
		// strip would win silently and the manifest would claim it ships.
		const stripped = new Set<string>(STRIPPED_METADATA_KEYS);
		for (const k of SHIPPED_METADATA_KEYS) {
			expect(
				stripped.has(k),
				`${k} is declared both shipped and stripped`,
			).toBe(false);
		}
	});

	it("POSITIVE CONTROL — an eighth field with no declared treatment fails", () => {
		// The guard's own failing shape, constructed. Without this, the two
		// assertions above pass identically against a comparison that always
		// agrees.
		const withNewField = [...live, "device_fingerprint"].sort();
		const declared = [
			...SHIPPED_METADATA_KEYS,
			...STRIPPED_METADATA_KEYS,
		].sort();

		expect(declared).not.toEqual(withNewField);
	});
});

// ── STRIPPED_COLUMNS vs the map the pipeline actually reads ───────────────

describe("egress · STRIPPED_COLUMNS agrees with COLUMN_TREATMENTS", () => {
	/** `table.column` for every column the pipeline actually drops. */
	const fromTreatments = Object.entries(COLUMN_TREATMENTS)
		.flatMap(([table, cols]) =>
			Object.entries(cols)
				.filter(([, t]) => t === "STRIP")
				.map(([col]) => `${table}.${col}`),
		)
		.sort();

	const fromRegistry = Object.entries(STRIPPED_COLUMNS)
		.flatMap(([table, cols]) => cols.map((c) => `${table}.${c}`))
		.sort();

	it("the two lists name the same nine columns", () => {
		// Nine, not §19.4's ten: `users.pfp_filename` is NULL_IF_ERASED and
		// ships (B.1), and `mod_actions.blocked_text` / `image_r2_key` are two
		// §19.4's table omits (B.10).
		expect(fromRegistry).toEqual(fromTreatments);
		expect(fromTreatments).toHaveLength(9);
	});

	it("POSITIVE CONTROL — a divergence between them is detectable", () => {
		// Without this, the equality above is satisfied by both lists being
		// derived from the same object, which they are not — but a reader
		// cannot tell that from an equality alone.
		const drifted = fromRegistry.filter((c) => c !== "users.email");
		expect(drifted).not.toEqual(fromTreatments);
	});
});

// ── every secret class is actually asserted on, in BOTH artifact shapes ───

/**
 * A canary per `EgressSecrets` field. Deliberately not UUID-shaped and not
 * email-shaped, so the ONLY thing that can find it is the exact-value scan for
 * that field — `assertNoBareUuidsInText` cannot rescue a missing class.
 */
function canaryFor(field: string): string {
	return `ZZ-CANARY-${field}-203.0.113.251`;
}

function secretsWithOnly(field: string): EgressSecrets {
	return {
		...emptySecrets(),
		[field]: new Set([canaryFor(field)]),
	} as EgressSecrets;
}

/**
 * The one `EgressSecrets` field that is NOT a secret class.
 *
 * ⚠ **Named as an explicit exclusion rather than filtered by shape**, because
 * the whole value of the block below is that it is derived from the live
 * shape — a `typeof v === "object"` filter would silently swallow the next
 * genuine class somebody adds as a Map. `participantSourced` is a TAG over the
 * other classes (ruling S1, DATASET.3): it holds no secret of its own, it
 * carries the provenance that decides a hit's tier, and there is nothing for
 * `assertTableClean` to fire on. Its own consumption is proven by the two
 * tests immediately after, which is what keeps this exclusion from being a way
 * to stop covering a field.
 */
const NOT_A_SECRET_CLASS = new Set(["participantSourced"]);

describe("egress · every EgressSecrets field is consumed by the guards", () => {
	// Derived at runtime from the shipped shape, so a field ADDED to
	// `EgressSecrets` without a matching assertion in the chain fails here
	// rather than passing vacuously forever.
	const fields = Object.keys(emptySecrets()).filter(
		(f) => !NOT_A_SECRET_CLASS.has(f),
	);

	it("the class list is read from the SHAPE, and every class is consumed", () => {
		// ⚠ Was `toHaveLength(7)`, a literal that went stale the moment
		// `@code-reviewer` H-4 added `displayNames` / `avatarUrls` /
		// `blockedTexts`. Pinning a count is not what makes this guard work —
		// what makes it work is that every field in the shape is proven to be
		// CONSUMED. The count is now derived, so adding a class extends the
		// coverage instead of breaking the test.
		expect(fields.length).toBeGreaterThanOrEqual(10);
		expect(fields).toContain("displayNames");
		expect(fields).toContain("avatarUrls");
		expect(fields).toContain("blockedTexts");
		// The exclusion is real and is exactly one field — so it cannot grow
		// into a way of quietly dropping coverage.
		expect(Object.keys(emptySecrets())).toContain("participantSourced");
		expect(NOT_A_SECRET_CLASS.size).toBe(1);
	});

	it("S1 · participantSourced IS consumed — it decides the tier", () => {
		// ⚠ The consumption proof the exclusion above owes. `participantSourced`
		// cannot be driven by `canaryFor`/`secretsWithOnly` (it holds no
		// secrets), so it is driven directly: the SAME needle, the SAME guard,
		// the SAME row, tagged and untagged.
		const canary = canaryFor("ips");
		const row = [{ some_column: canary }];
		const base = { ...emptySecrets(), ips: new Set([canary]) };

		// Untagged ⇒ system-sourced ⇒ FATAL.
		expect(() => assertTableClean("t", row, base)).toThrow(
			EgressViolationError,
		);

		// Tagged participant-sourced, harvested under a DIFFERENT field ⇒
		// advisory, and the build survives.
		const tagged = {
			...base,
			participantSourced: new Map([[canary, new Set(["ip"])]]),
		};
		const outcome = assertTableClean("t", row, tagged);
		expect(outcome.advisories.map((a) => a.rule)).toContain("no-ip");

		// …and under the field it WAS harvested from, fatal again — so the tag
		// is not a switch that turns a class off.
		expect(() => assertTableClean("t", [{ ip: canary }], tagged)).toThrow(
			EgressViolationError,
		);
	});

	it.each(
		fields,
	)("assertTableClean fires on a row carrying a %s value", (field) => {
		const rows = [{ id: "1", some_innocuous_column: canaryFor(field) }];

		expect(
			() => assertTableClean("t", rows, secretsWithOnly(field)),
			`${field} is collected into EgressSecrets but no table guard reads it`,
		).toThrow(EgressViolationError);
	});

	it.each(
		fields,
	)("assertTextArtifactClean fires on a %s value in rendered prose", (field) => {
		// The `.md` artifact class. `assertTextClean` keeps its own hardcoded
		// list of classes, separate from the table chain — so a class can be
		// covered on one artifact shape and blind on the other, and that
		// asymmetry is exactly what this half catches.
		const md = `# Debate\n\nsomething something ${canaryFor(field)} etc.\n`;

		// ⚠ Asserts the class is CONSUMED on this arm, fatally or as an
		// advisory — not that it throws.
		//
		// The text arm is tiered by machine-generated vs human-authorable
		// (`assertions.ts`): a UUID / IP / user-agent / Google id / R2 key /
		// session token in a debate document is a serializer leak and halts;
		// an email, display name, avatar URL or previously-blocked body is
		// something a participant wrote, and halting on it hands anyone named
		// "Li" an abort switch on a one-shot release (`@security-auditor`
		// F-11 H-B).
		//
		// Demanding a throw for every class would pin that denial-of-service
		// as intended behaviour — which is exactly what the version of this
		// assertion it replaces did. What must not regress is a class going
		// UNSEEN, and that is what is asserted.
		let threw = false;
		let advisories: readonly { rule: string }[] = [];
		try {
			advisories = assertTextArtifactClean(
				"d.md",
				md,
				secretsWithOnly(field),
			).advisories;
		} catch (e) {
			threw = e instanceof EgressViolationError;
		}

		expect(
			threw || advisories.length > 0,
			`${field} is guarded on CSV rows but is INVISIBLE on rendered text`,
		).toBe(true);
	});

	it("POSITIVE CONTROL — the same rows pass when the class is empty", () => {
		// Proves the throws above come from the secret set and not from some
		// other net firing on the canary's shape.
		for (const field of fields) {
			const rows = [{ id: "1", some_innocuous_column: canaryFor(field) }];
			expect(() => assertTableClean("t", rows, emptySecrets())).not.toThrow();
			const out = assertTextArtifactClean(
				"d.md",
				`# Debate\n\n${canaryFor(field)}\n`,
				emptySecrets(),
			);
			// Neither fatal NOR advisory — proves the signal above came from
			// the secret set rather than from the canary's shape.
			expect(out.advisories, `${field} advisory on an empty set`).toEqual([]);
		}
	});
});

describe("egress · FORBIDDEN_VALUE_CLASSES names rules that actually fire", () => {
	it("each declared class has a rule of the same name in the output", () => {
		// The binding is `no-<class>` — the rule strings the guards emit are
		// exactly the class names prefixed. That makes the declared list
		// checkable against the real vocabulary with no hand-written mapping to
		// go stale.
		// ⚠ Built by LOOPING the shape rather than listing the fields, so a
		// new class added to `EgressSecrets` is picked up automatically. The
		// hand-written literal this replaces went stale the moment three
		// classes were added for `@code-reviewer` H-4 — which is the same
		// drift this whole file exists to catch, reproduced inside it.
		const canary = (field: string) => `ZZ-CANARY-${field}`;
		// ⚠ `participantSourced` is excluded: it is a Map of provenance tags,
		// not a class of secrets, and filling it with a Set here silently
		// broke the guard's `.get()` — which the bare catch below then read as
		// "no rules fired". Left empty, so every canary is system-sourced and
		// therefore fatal, which is what this test is about.
		const fields = (
			Object.keys(emptySecrets()) as (keyof EgressSecrets)[]
		).filter((f) => !NOT_A_SECRET_CLASS.has(f));
		const secrets = {
			...Object.fromEntries(fields.map((f) => [f, new Set([canary(f)])])),
			participantSourced: new Map<string, ReadonlySet<string>>(),
		} as unknown as EgressSecrets;
		const rows = [
			Object.fromEntries(fields.map((f, i) => [`col${i}`, canary(f)])),
		];

		let fired: string[] = [];
		try {
			assertTableClean("t", rows, secrets);
		} catch (e) {
			// ⚠ Assert the CLASS before reading `.violations`. This was a bare
			// cast, so a `TypeError` thrown anywhere inside the guard produced
			// `undefined.map` — or, had the shape been friendlier, an empty
			// `fired` that read as "the guards are silent". A catch that
			// assumes its error class cannot tell a broken guard from a clean
			// one, which is the exact failure this file exists to name.
			expect(e).toBeInstanceOf(EgressViolationError);
			fired = (e as EgressViolationError).violations.map((v) => v.rule);
		}
		// …and it must have thrown at all. Without this, a guard chain that
		// stopped firing entirely would leave `fired` empty and the loop below
		// would report every class as missing — a red for the right reason, but
		// only by luck of the message.
		expect(fired.length).toBeGreaterThan(0);

		for (const cls of FORBIDDEN_VALUE_CLASSES) {
			expect(fired, `FORBIDDEN_VALUE_CLASSES names '${cls}'`).toContain(
				`no-${cls}`,
			);
		}
	});
});
