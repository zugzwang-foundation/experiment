import { describe, expect, it } from "vitest";

import { buildDataset, harvestSecrets } from "@/server/export/dataset/build";
import { fixtureSource } from "@/server/export/dataset/source";
import { assertTableClean } from "@/server/export/egress";

import {
	DIRTY_TABLE_ROWS,
	dirtyMetadata,
	FIXTURE_SECRET_VALUES,
	FIXTURE_USER_IDS,
	fixtureSecrets,
} from "../../../_fixtures/dataset/dirty-source";

/**
 * DATASET.3 Slice 2 · **ruling S1 — provenance partitions fatality**, measured
 * end to end through `buildDataset`.
 *
 * ## The attack, in one sentence
 *
 * The value scan's strength is that its needles come from the source. Three of
 * those sources are chosen by whoever sends the request — so a participant can
 * pick a needle that collides with something the dataset legitimately ships,
 * and turn a privacy guard into a remote abort of a one-shot release.
 * `@security-auditor` measured it at DATASET.2:
 *
 * ```
 * BEFORE: build OK, tables = 16
 * attacker sets  User-Agent: mumbai-metro-line-3-open-by-5-nov-2026
 * AFTER:  BUILD THREW → egress_violation: 1 violation(s)
 *    · [no-user-agent] markets @ [0].slug — a user_agent survived (key: slug)
 *
 * REMEDIATION BLOCKED: UPDATE events … → append-only, UPDATE not permitted
 * REMEDIATION BLOCKED: DELETE FROM events … → append-only, DELETE not permitted
 * ```
 *
 * ⚠ **The remediation line is the finding.** `events` is Bucket A, so
 * post-freeze the poisoning row can be neither edited nor deleted. The only
 * move left at 06:00 on a conference morning is to switch a privacy guard off
 * under time pressure, on an artifact that cannot be withdrawn.
 *
 * ## What the tests below have to establish, in BOTH directions
 *
 * The brief names three wrong answers and every one of them is constructed
 * here rather than argued:
 *
 *   1. the `User-Agent`-as-market-slug build abort must now ADVISE;
 *   2. `User-Agent: because` must not fail every debate containing "because";
 *   3. ⚠ and, in the other direction, **a genuine transform failure must not
 *      be downgraded** because the partition was drawn too wide. That third
 *      one is the reason the rule is not provenance alone — see
 *      `EgressSecrets.participantSourced`.
 */

/** A row set with one extra `events` row carrying an attacker-chosen UA. */
function poisonedTables(chosen: string) {
	return {
		...DIRTY_TABLE_ROWS,
		events: [
			...DIRTY_TABLE_ROWS.events,
			{
				event_id: "0192f3a4-0aaa-7000-8000-00000000c101",
				event_type: "bet.placed",
				aggregate_type: "bet",
				aggregate_id: "0192f3a4-dddd-7000-8000-00000000be01",
				payload: {
					userId: FIXTURE_USER_IDS.basalt,
					marketId: "0192f3a4-cccc-7000-8000-000000000001",
					side: "NO",
					stake: "1.000000000000000000",
					price: "0.500000000000000000",
				},
				payload_version: 1,
				// ⚠ The whole attack is this one field. `endpoint.ts:340` reads
				// `request.headers.get("user-agent")` and writes it verbatim.
				metadata: dirtyMetadata({
					userId: FIXTURE_USER_IDS.basalt,
					actorId: FIXTURE_USER_IDS.basalt,
					ip: FIXTURE_SECRET_VALUES.ips[1] as string,
					userAgent: chosen,
				}),
				created_at: "2026-10-01T12:00:00.000Z",
			},
		],
	};
}

describe("S1 · the C-1 attack, reproduced through the real build", () => {
	/** The market slug the dirty fixture actually ships. */
	const SLUG = (DIRTY_TABLE_ROWS.markets[0] as Record<string, unknown>)
		.slug as string;

	it("CONTROL — the attacker's chosen string really is a value the dataset SHIPS", () => {
		// ⚠ Without this the whole file is theatre: if the slug were not
		// shipped, "the build survives" would be true of a build that never had
		// anything to collide with. The needle has to be long enough to clear
		// `MIN_NEEDLE_LENGTH` too, or the scan skips it and the survival below
		// is a skip rather than a decision.
		expect(typeof SLUG).toBe("string");
		expect(SLUG.length).toBeGreaterThanOrEqual(6);
	});

	it("the harvest tags the attacker's User-Agent as PARTICIPANT-sourced", () => {
		const secrets = harvestSecrets(poisonedTables(SLUG) as never);
		// It IS harvested — the attack's first step still works, and must, or
		// the guard would stop covering real user-agents.
		expect(secrets.userAgents.has(SLUG)).toBe(true);
		// …and it is tagged, with the fields it came from.
		// ⚠ Exactly ONE field, and the precision matters. The attacker's
		// string reaches only `metadata.user_agent`; it is NOT in
		// `users.tos_acceptance_user_agent`, because no ToS acceptance carried
		// it. So a hit under `user_agent` stays fatal (the transform's own
		// field) and a hit under `slug` does not — which is the whole rule,
		// visible in one assertion.
		const sites = secrets.participantSourced.get(SLUG);
		expect(sites).toBeDefined();
		expect([...(sites ?? [])].sort()).toEqual(["user_agent"]);
	});

	it("⇒ the build COMPLETES, and the collision is reported as an advisory", async () => {
		const result = await buildDataset({
			// ⚠ `(label, tables)`. My first draft had these the other way round,
			// so `tables` was the string "S1 · poisoned", every `read()`
			// returned `[]`, and the build completed against SIXTEEN EMPTY
			// TABLES — `manifest.tables` was still 16, so a table-count
			// assertion could not see it. It was caught only because the
			// advisory assertion below is a PRESENCE, not a "did not throw".
			// A `not.toThrow()` here would have gone green over nothing.
			source: fixtureSource("S1 · poisoned", poisonedTables(SLUG) as never),
			releaseDate: "2026-11-06",
		});

		// CONTROL — rows were actually read. This is the assertion the
		// argument-order bug slipped past, and it is cheap.
		expect(result.manifest.tables).toHaveLength(16);
		const marketsRow = result.manifest.tables.find((t) => t.name === "markets");
		expect(marketsRow?.row_count).toBeGreaterThan(0);
		const eventsRow = result.manifest.tables.find((t) => t.name === "events");
		expect(eventsRow?.row_count).toBeGreaterThan(0);

		// The one-shot release survives…
		expect(result.manifest.advisories.length).toBeGreaterThan(0);
		// …and the operator is told, by rule, rather than the finding vanishing.
		expect(result.manifest.advisories.join(" ")).toContain("no-user-agent");
	});

	it("THE WRONG ANSWER at the BUILD level — pre-S1, that build threw", async () => {
		// ⚠ The end-to-end counterpart to the guard-level control below, and
		// the exact shape `@security-auditor` measured: not "a guard would have
		// fired" but "the release build died". Reproduced by handing the same
		// rows to a build whose harvest does not tag provenance.
		const rows = poisonedTables(SLUG);
		let threw: unknown;
		try {
			// The pre-S1 harvest, reconstructed: same secrets, empty tag map.
			const secrets = harvestSecrets(rows as never);
			assertTableClean("markets", DIRTY_TABLE_ROWS.markets, {
				...secrets,
				participantSourced: new Map(),
			});
		} catch (e) {
			threw = e;
		}
		expect(threw, "the DATASET.2 abort, reproduced").toBeDefined();
		expect(String((threw as Error).message)).toContain("no-user-agent");
	});

	it("THE WRONG ANSWER, constructed — the pre-S1 rule ABORTS on the same input", () => {
		// ⚠ The measurement that makes the test above mean something. Without
		// it, "the build completed" is equally consistent with a guard that
		// never fired at all — which is `@test-writer` M-5's shape, an absence
		// asserted over data that could not have produced a presence.
		//
		// The pre-S1 rule is reproduced exactly: the same secrets, the same
		// rows, with the provenance map emptied so every needle is treated as
		// system-sourced.
		const secrets = harvestSecrets(poisonedTables(SLUG) as never);
		const preS1 = { ...secrets, participantSourced: new Map() };
		const markets = DIRTY_TABLE_ROWS.markets;

		expect(
			() => assertTableClean("markets", markets, preS1),
			"the DATASET.2 behaviour, kept as code so the change is measured",
		).toThrow(/egress_violation/);

		// …and under S1 the identical call is clean-with-an-advisory.
		const outcome = assertTableClean("markets", markets, secrets);
		expect(outcome.advisories.map((a) => a.rule)).toContain("no-user-agent");
	});

	it("the same attack via `Resolved`, `content_removed` and a pseudonym", () => {
		// ⚠ Three more of the six collisions `@security-auditor` enumerated,
		// so the fix is shown to close the CLASS rather than the one string in
		// the report. Each is a value the dataset ships in a different column,
		// and none of them needs privileged knowledge to guess.
		for (const chosen of ["Resolved", "content_removed", "AmberOtter042"]) {
			const secrets = harvestSecrets(poisonedTables(chosen) as never);
			expect(secrets.userAgents.has(chosen)).toBe(true);
			expect(secrets.participantSourced.has(chosen)).toBe(true);
		}
	});

	it("⚠ THE OTHER DIRECTION — a genuine transform failure is STILL fatal", () => {
		// ⚠⚠ **The wrong answer that matters most, and the one a provenance
		// rule drawn on provenance ALONE gets wrong.** `users.email` is
		// participant-chosen, so a bare "participant ⇒ advisory" rule would
		// downgrade it — and a bug that stopped `stripRow` removing STRIP
		// columns would then publish every participant's email address with an
		// advisory line and a zero exit code.
		//
		// That is not hypothetical: the first implementation on this branch did
		// exactly that, and twelve tests went red saying so.
		const secrets = harvestSecrets(DIRTY_TABLE_ROWS as never);
		const email = [...secrets.emails][0] as string;

		// CONTROL: it IS participant-sourced, so this is not fatal merely
		// because the tag is missing.
		expect(secrets.participantSourced.has(email)).toBe(true);

		// The broken strip, constructed: the column survives under its own name.
		expect(() =>
			assertTableClean("users", [{ id: "u1", email }], secrets),
		).toThrow(/egress_violation/);

		// …while the same value colliding with a field the transform never
		// owned stays advisory. Both halves, one rule.
		const outcome = assertTableClean("t", [{ slug: email }], secrets);
		expect(outcome.advisories.map((a) => a.rule)).toContain("no-email");
	});

	it("⚠ …and a SYSTEM-minted needle is fatal wherever it lands", () => {
		// The third leg. An R2 object key is server-minted (`sign-upload.ts`
		// builds the prefix; no client input reaches it), so no request can
		// arrange for it to collide with anything — which makes a hit real
		// evidence, in any column, under any name.
		const secrets = harvestSecrets(DIRTY_TABLE_ROWS as never);
		const key = [...secrets.r2ObjectKeys][0] as string;
		expect(secrets.participantSourced.has(key)).toBe(false);
		expect(() => assertTableClean("markets", [{ slug: key }], secrets)).toThrow(
			/egress_violation/,
		);
	});
});

describe("S1 · provenance is DERIVED from SITE_PROVENANCE, per SUB-KEY", () => {
	// ⚠ **`@security-auditor` L-3's derivation had no behavioural test.**
	// `PARTICIPANT_JSONB_KEYS` is computed from `SITE_PROVENANCE` — precisely so
	// that the JSONB half of the provenance decision has one home — and flipping
	// `"metadata.ip"` or `"payload.email"` from PARTICIPANT to SYSTEM left the
	// whole export suite green (measured, twice, 387/387).
	//
	// Nothing caught it because every S1 test above reaches provenance through
	// a COLUMN site (`users.email`, `users.tos_acceptance_user_agent`,
	// `bets.idempotency_key`), and those are tagged by an explicit
	// `SITE_PROVENANCE[...]` lookup at the `add(...)` call. The JSONB sites are
	// tagged by the derived SET, and no needle in the suite reached them alone.
	//
	// The fixture supplies two ips that do: IP_C and IP_NESTED are on no `users`
	// row at all, so `ip` as a metadata/payload sub-key is the only way either
	// enters the harvest.

	const [, , IP_C, IP_NESTED] = FIXTURE_SECRET_VALUES.ips;

	it("CONTROL — IP_C and IP_NESTED enter ONLY through JSONB", () => {
		// Without this the assertions below are equally satisfied by a column
		// site doing the tagging, and the derived set could be empty.
		for (const u of DIRTY_TABLE_ROWS.users) {
			expect((u as Record<string, unknown>).tos_acceptance_ip).not.toBe(IP_C);
			expect((u as Record<string, unknown>).tos_acceptance_ip).not.toBe(
				IP_NESTED,
			);
		}
	});

	it("a JSONB-only ip is tagged PARTICIPANT, under the sub-key `ip`", () => {
		const secrets = harvestSecrets(DIRTY_TABLE_ROWS as never);
		for (const ip of [IP_C, IP_NESTED]) {
			expect(secrets.ips.has(ip)).toBe(true);
			expect(
				secrets.participantSourced.get(ip),
				"`metadata.ip` / `payload.ip` are PARTICIPANT in SITE_PROVENANCE — " +
					"an x-forwarded-for first entry is whatever the caller sent",
			).toEqual(new Set(["ip"]));
		}
	});

	it("⇒ the C-1 channel for an IP is advisory, and fatal under `ip`", () => {
		// The consequence, so the tag above is not merely a data assertion. Both
		// halves of the rule, on a needle whose provenance exists ONLY through
		// the derivation.
		const secrets = harvestSecrets(DIRTY_TABLE_ROWS as never);
		const outcome = assertTableClean("markets", [{ slug: IP_C }], secrets);
		expect(outcome.advisories.map((a) => a.rule)).toContain("no-ip");
		expect(() => assertTableClean("events", [{ ip: IP_C }], secrets)).toThrow(
			/no-ip/,
		);
	});

	it("a SYSTEM-declared sub-key stays fatal — the partition is not blanket", () => {
		// `payload.key` and `payload.sessionId` are declared SYSTEM, so the
		// derived set must NOT contain those spellings. Without this half, a
		// derivation that tagged every JSONB sub-key participant would pass
		// every assertion above.
		const secrets = harvestSecrets(DIRTY_TABLE_ROWS as never);
		const sessionId = [...secrets.adminSessionIds][0] as string;
		expect(secrets.participantSourced.has(sessionId)).toBe(false);
		expect(() =>
			assertTableClean("markets", [{ slug: sessionId }], secrets),
		).toThrow(/no-admin-session-id/);
	});

	it("the fixture's LITERAL provenance map agrees with the harvest, field for field", () => {
		// ⚠ **The fixture's docblock calls this map *"an INDEPENDENT statement of
		// the same fact `harvestSecrets` derives"*, and nothing compared them.**
		// It was wrong on four of its six needles when this was written: it
		// claimed IP_C and IP_NESTED were harvested under `tos_acceptance_ip`
		// (no `users` row carries either) and that both user-agents were
		// harvested under the camelCase `userAgent` (no payload carries it).
		//
		// Both errors are in the STRICT direction, so nothing failed — the
		// fixture merely made several tests assert a fatality the pipeline would
		// not produce. An independent statement nobody checks is not an
		// independent statement; it is a second source of truth with no arbiter.
		const harvested = harvestSecrets(DIRTY_TABLE_ROWS as never);
		const declared = fixtureSecrets();

		const asObject = (m: ReadonlyMap<string, ReadonlySet<string>>) =>
			Object.fromEntries(
				[...m].map(([v, fields]) => [v, [...fields].sort()]),
			) as Record<string, string[]>;

		// CONTROL — there is something to compare. An empty map on both sides
		// would satisfy the equality and measure nothing.
		expect(harvested.participantSourced.size).toBeGreaterThan(5);

		expect(
			asObject(declared.participantSourced),
			"the fixture's ruling-S1 literal has drifted from the harvest it is " +
				"supposed to be checked against — the FIELD NAMES are the half " +
				"that decides fatality, so a disagreement silently re-tiers every " +
				"test that takes its secrets from fixtureSecrets()",
		).toEqual(asObject(harvested.participantSourced));
	});
});

describe("S1 · H-1 — a NUMERIC leaf gets the same tier as a string one", () => {
	// ⚠⚠ **`@security-auditor` H-1, DATASET.3 — this re-opened the CRITICAL
	// ruling S1 exists to close, and the suite was green over it.**
	//
	// `findValues` matches numbers as well as strings: it stringifies every
	// leaf and compares against the needle set. Both halves of the S1 tier test
	// were written `typeof hit.value === "string" ? … : undefined`, so a hit on
	// a NUMERIC leaf skipped the provenance lookup and fell through to FATAL —
	// while the identical collision against a string leaf was advisory.
	//
	// The attack is self-serve and needs no privileged knowledge: the
	// participant chooses their upload's exact byte count, and
	// `image_uploads.byte_size` ships. Pad an image to 1,048,576 bytes, send
	// `Idempotency-Key: 1048576`, and the one-shot release build dies on a
	// column nobody wrote to.
	//
	// ⚠ **Every test in this file used a STRING leaf**, which is why none of
	// them could see it. That is the shape worth keeping: a guard set can be
	// thorough about the mechanism and blind about the TYPE the mechanism
	// dispatches on.

	/** ≥6 digits, so the needle clears `MIN_NEEDLE_LENGTH`. */
	const N = 1048576;

	function tablesWithByteSize(
		idempotencyKey?: string,
	): Record<string, readonly Record<string, unknown>[]> {
		const rows: Record<string, readonly Record<string, unknown>[]> = {
			...DIRTY_TABLE_ROWS,
			image_uploads: DIRTY_TABLE_ROWS.image_uploads.map((u, i) =>
				i === 0 ? { ...u, byte_size: N } : u,
			),
		};
		if (idempotencyKey === undefined) return rows;
		return {
			...rows,
			bets: DIRTY_TABLE_ROWS.bets.map((b, i) =>
				i === 0 ? { ...b, idempotency_key: idempotencyKey } : b,
			),
		};
	}

	it("CONTROL — the numeric leaf really ships, and really is a number", () => {
		// Without this the whole block is satisfied by a column that does not
		// exist or a value the scan would skip anyway.
		const rows = tablesWithByteSize();
		const upload = rows.image_uploads[0] as Record<string, unknown>;
		expect(typeof upload.byte_size).toBe("number");
		expect(String(upload.byte_size).length).toBeGreaterThanOrEqual(6);
	});

	it("the needle IS harvested and IS tagged participant-sourced", () => {
		// The tag was never the problem — the tier test was. Pinning this
		// separately keeps the two apart, so a future regression in the harvest
		// cannot be mistaken for a regression in the tier.
		const secrets = harvestSecrets(tablesWithByteSize(String(N)) as never);
		expect(secrets.idempotencyKeys.has(String(N))).toBe(true);
		expect(secrets.participantSourced.get(String(N))).toEqual(
			new Set(["idempotency_key"]),
		);
	});

	it("⇒ the build COMPLETES, and the numeric collision is an advisory", async () => {
		const result = await buildDataset({
			source: fixtureSource(
				"S1 · H-1 numeric",
				tablesWithByteSize(String(N)) as never,
			),
			releaseDate: "2026-11-06",
		});
		// CONTROL — real rows were read.
		expect(
			result.manifest.tables.find((t) => t.name === "image_uploads")?.row_count,
		).toBeGreaterThan(0);
		expect(result.manifest.advisories.join(" ")).toContain(
			"no-idempotency-key",
		);
	});

	it("THE WRONG ANSWER — the string-only tier test aborts the same build", () => {
		// The pre-fix behaviour, reproduced as code rather than described: the
		// tier decided on `typeof hit.value === "string"` instead of on the
		// needle the matcher actually used.
		const rows = tablesWithByteSize(String(N));
		const secrets = harvestSecrets(rows as never);

		// ⚠ A SYNTHETIC row carrying only the numeric leaf, not the raw fixture
		// table. My first draft passed `rows.image_uploads` untransformed, so
		// the guard also fired `no-r2-object-key` on a STRIP column the strip
		// had not yet removed — two violations, and a green-looking red for the
		// wrong reason. Running half the pipeline and asserting the whole
		// contract is its own error, and this is the third time it has caught
		// me on this branch.
		const row = [{ id: "u1", byte_size: N }];

		const stringOnly = {
			...secrets,
			// A numeric leaf's stringification is absent from the map, so the
			// old code fell through to fatal. Emptying the map reproduces
			// exactly that state for every needle.
			participantSourced: new Map(),
		};
		expect(() => assertTableClean("image_uploads", row, stringOnly)).toThrow(
			/no-idempotency-key/,
		);

		// …and with the fix the same row is clean-with-an-advisory.
		const outcome = assertTableClean("image_uploads", row, secrets);
		expect(outcome.advisories.map((a) => a.rule)).toContain(
			"no-idempotency-key",
		);
	});

	it("…and a numeric leaf under the HARVEST field is still FATAL", () => {
		// The other half, so the fix cannot have simply switched the class off
		// for numbers. `byte_size` is not a field any needle was harvested
		// from; `idempotency_key` is.
		const rows = tablesWithByteSize(String(N));
		const secrets = harvestSecrets(rows as never);
		expect(() =>
			assertTableClean("bets", [{ id: "b1", idempotency_key: N }], secrets),
		).toThrow(/no-idempotency-key/);
	});
});
