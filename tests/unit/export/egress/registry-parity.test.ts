import { describe, expect, it } from "vitest";

import { eventMetadataSchema } from "@/server/events/schemas";
import {
	HARVEST_COLUMN_BUCKETS,
	harvestSecrets,
} from "@/server/export/dataset/build";
import { COLUMN_TREATMENTS } from "@/server/export/dataset/treatments";
import {
	assertTableClean,
	assertTextArtifactClean,
	type EgressSecrets,
	EgressViolationError,
	emptySecrets,
	FORBIDDEN_VALUE_CLASSES,
	METADATA_SHIP_SPEC,
	SHIPPED_METADATA_KEYS,
	STRIPPED_COLUMNS,
	STRIPPED_METADATA_KEYS,
} from "@/server/export/egress";

import { DIRTY_TABLE_ROWS } from "../../../_fixtures/dataset/dirty-source";

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

// ── STRIPPED_COLUMNS is now DERIVED, and the harvest is bound to it ───────

describe("egress · every STRIP column is harvested (ruling I)", () => {
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

	/**
	 * ⚠ **This block's job CHANGED at DATASET.3, ruling I, and saying so is
	 * the point.** It used to compare two hand-written lists — the strip map
	 * the pipeline reads, and a `STRIPPED_COLUMNS` constant in
	 * `forbidden-keys.ts` with no consumer in `src/` at all. Its own positive
	 * control said *"the equality above is satisfied by both lists being
	 * derived from the same object, WHICH THEY ARE NOT"*, and that was true and
	 * was the problem: two statements of one policy, free to disagree, with a
	 * test as the only thing that would notice — and only when someone ran it.
	 *
	 * `STRIPPED_COLUMNS` is now derived FROM `COLUMN_TREATMENTS`, so the two
	 * cannot disagree and the old control cannot be written. What replaces it
	 * is stronger and lives in `tsc`: `HARVEST_COLUMN_BUCKETS` is declared
	 * `satisfies Record<StrippedColumnPath, …>`, so a `STRIP` column with no
	 * harvest bucket is a COMPILE error. That is what ruling I asked for —
	 * *"the proof is a compile error, not a test"* — and it has already fired
	 * once on this branch: ruling S2 made `bets.idempotency_key` a `STRIP`
	 * column and `tsc` refused it until the value class existed.
	 *
	 * What remains testable here is the RUNTIME half: that the derivation
	 * produces what the map says, and that every derived column really is
	 * reachable by the harvest.
	 */
	it("the derived list is exactly the STRIP set of the treatment map", () => {
		expect(fromRegistry).toEqual(fromTreatments);
		// ⚠ TEN, not nine, and not §19.4's ten either. `users.pfp_filename` is
		// NULL_IF_ERASED and ships (B.1); `mod_actions.blocked_text` and
		// `image_r2_key` are two §19.4's table omits (B.10); and
		// `bets.idempotency_key` is ruling S2's addition (DATASET.3).
		expect(fromTreatments).toHaveLength(10);
		expect(fromTreatments).toContain("bets.idempotency_key");
	});

	it("EVERY derived STRIP column has a harvest bucket", () => {
		// The runtime shadow of the compile-time `satisfies`. Kept because a
		// cast, an `as never`, or a `Partial<>` can silence a type error and
		// cannot silence this — the same belt-to-the-brace argument
		// `completeness.ts` makes about `PAYLOAD_SHIP_KEYS`.
		const unbucketed = fromTreatments.filter(
			(path) => !(path in HARVEST_COLUMN_BUCKETS),
		);
		expect(
			unbucketed,
			"a column Appendix B classifies STRIP is not harvested — it would " +
				"leave the value scan's reach silently, which is exactly the " +
				"decoupling ruling I closed",
		).toEqual([]);
	});

	it("THE WRONG ANSWER — a STRIP column with no bucket is detected", () => {
		// The control. The live pair agrees, so a test that could only compare
		// the real two would assert emptiness against data with no gap.
		const withNewColumn = [...fromTreatments, "markets.secret_note"];
		const unbucketed = withNewColumn.filter(
			(path) => !(path in HARVEST_COLUMN_BUCKETS),
		);
		expect(unbucketed).toEqual(["markets.secret_note"]);
	});

	it("no harvest bucket names a column that is not STRIP", () => {
		// The other direction: a phantom bucket reads as coverage of a column
		// the pipeline never drops.
		const phantom = Object.keys(HARVEST_COLUMN_BUCKETS).filter(
			(path) => !fromTreatments.includes(path),
		);
		expect(phantom).toEqual([]);
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

describe("§3.7 · the metadata allow-list is BOUND to the schema (L-1)", () => {
	// ⚠ **`@security-auditor` L-1 — ruling I's own lesson, inverted inside the
	// commit that applied it.** After the DATASET.3 inversion,
	// `METADATA_SHIP_SPEC` is what DRIVES the metadata strip, and it had no
	// test at all; `SHIPPED_METADATA_KEYS`, which now only feeds the published
	// `metadata_fields_included`, is the one the parity block pinned.
	//
	// The failure that leaves open: add a field to `eventMetadataSchema`, add
	// it to `SHIPPED_METADATA_KEYS` to satisfy the existing test, forget
	// `METADATA_SHIP_SPEC` — the field is dropped (safe) while the PUBLIC
	// manifest advertises it as included (a false claim about the artifact).

	const schemaKeys = Object.keys(eventMetadataSchema.shape).sort();
	const shipSpecKeys = Object.keys(METADATA_SHIP_SPEC).sort();

	it("POSITIVE CONTROL — §3.7 really declares seven fields", () => {
		// Without this, every assertion below passes against an empty schema.
		expect(schemaKeys).toHaveLength(7);
		expect(schemaKeys).toContain("request_id");
		expect(schemaKeys).toContain("ip");
	});

	it("the two metadata lists are the SAME list", () => {
		// The published `metadata_fields_included` must describe what the strip
		// keeps, or the manifest lies about the artifact beside it.
		expect(shipSpecKeys).toEqual([...SHIPPED_METADATA_KEYS].sort());
	});

	it("every §3.7 field is either shipped or stripped — no third state", () => {
		const classified = new Set([...shipSpecKeys, ...STRIPPED_METADATA_KEYS]);
		const unclassified = schemaKeys.filter((k) => !classified.has(k));
		expect(
			unclassified,
			"a §3.7 metadata field is in neither the SHIP spec nor the STRIP " +
				"list — it will silently not ship, which is safe and is still a " +
				"decision nobody made",
		).toEqual([]);
	});

	it("no field is in BOTH lists", () => {
		const both = shipSpecKeys.filter((k) =>
			(STRIPPED_METADATA_KEYS as readonly string[]).includes(k),
		);
		expect(both).toEqual([]);
	});

	it("FOUR ship since ruling S2, and the names are pinned", () => {
		// ⚠ Pinned by NAME, not by count. `idempotency_key` left this list at
		// DATASET.3 and five docblocks in `src/` still said "five ship" — a
		// count is what goes stale, a name is what a reader can check.
		expect(shipSpecKeys).toEqual([
			"actor_id",
			"flow_id",
			"request_id",
			"user_id",
		]);
		expect([...STRIPPED_METADATA_KEYS].sort()).toEqual([
			"idempotency_key",
			"ip",
			"user_agent",
		]);
	});

	it("THE WRONG ANSWER — a new §3.7 field with no decision is detected", () => {
		// The control. The live pair agrees, so a test that could only compare
		// the real two would assert emptiness against data with no gap.
		const withNewField = [...schemaKeys, "trace_id"];
		const classified = new Set([...shipSpecKeys, ...STRIPPED_METADATA_KEYS]);
		expect(withNewField.filter((k) => !classified.has(k))).toEqual([
			"trace_id",
		]);
	});
});

describe("ruling I · the harvest READS every bucket it declares (L-2)", () => {
	// ⚠ **`@security-auditor` L-2.** The `satisfies Record<StrippedColumnPath,
	// …>` clause forces a new STRIP column to acquire a bucket ENTRY. It does
	// not force `harvestSecrets` — which is hand-written `add(...)` calls — to
	// actually read that column, and `HARVEST_COLUMN_BUCKETS[...].bucket` is
	// never dereferenced at runtime. So the compile error proves a DECLARATION
	// and this proves the HARVEST, which are two different claims.

	it("every declared bucket actually receives its column's value", () => {
		const secrets = harvestSecrets(DIRTY_TABLE_ROWS as never);
		const wrong: string[] = [];
		for (const [path, decl] of Object.entries(HARVEST_COLUMN_BUCKETS)) {
			const [table, column] = path.split(".") as [string, string];
			const rows =
				(
					DIRTY_TABLE_ROWS as Record<string, readonly Record<string, unknown>[]>
				)[table] ?? [];
			for (const row of rows) {
				const v = row[column];
				if (typeof v !== "string" || v.trim() === "") continue;
				const bucket = (
					secrets as unknown as Record<string, ReadonlySet<string>>
				)[decl.bucket];
				if (!bucket?.has(v)) wrong.push(`${path} -> ${decl.bucket}`);
			}
		}
		expect(
			[...new Set(wrong)],
			"a STRIP column has a declared harvest bucket that never receives " +
				"its value — the compile error proved the declaration and not " +
				"the harvest",
		).toEqual([]);
	});

	it("POSITIVE CONTROL — the fixture populates every STRIP column", () => {
		// Without this, the loop above skips every column and passes over
		// nothing. A fixture that stopped populating a STRIP column would make
		// the check vacuous exactly where it matters.
		const populated = Object.keys(HARVEST_COLUMN_BUCKETS).filter((path) => {
			const [table, column] = path.split(".") as [string, string];
			const rows =
				(
					DIRTY_TABLE_ROWS as Record<string, readonly Record<string, unknown>[]>
				)[table] ?? [];
			return rows.some(
				(r) => typeof r[column] === "string" && r[column] !== "",
			);
		});
		expect(populated.length).toBe(Object.keys(HARVEST_COLUMN_BUCKETS).length);
	});
});
