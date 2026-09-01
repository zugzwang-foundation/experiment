import { describe, expect, it } from "vitest";
import { type SourceRow, stripTable } from "@/server/export/dataset/strip";
import {
	assertTableClean,
	assertTextArtifactClean,
	EgressGuard,
	type EgressSecrets,
	emptySecrets,
} from "@/server/export/egress";
import { EgressViolationError } from "@/server/export/egress/errors";
import { UUID_RE } from "@/server/export/egress/scan";

import {
	DIRTY_EVENT_ROWS,
	FIXTURE_SECRET_VALUES,
	FIXTURE_USER_IDS,
	fixtureSecrets,
} from "../../../_fixtures/dataset/dirty-source";

/**
 * DATASET.1 Slice 1 — the shared egress guard layer.
 *
 * **Every assertion here is paired.** The negative case (the guard passes on
 * clean data) is worthless alone: it is equally consistent with "the guard
 * works" and "the guard is a no-op". So each block also runs the SAME guard
 * against a fixture row that provably carries the forbidden thing, and
 * asserts it FIRES — brief §4 Slice 1's *"every helper ships with its
 * positive control"*, and OVN-V1/V3.
 *
 * ⚠ The positive controls run against `dirty-source.ts`, whose rows are
 * constructed to carry every strip target and which throws at module load if
 * it stops covering all 24 `EVENT_TYPES`. The control cannot quietly stop
 * exercising the failing shape.
 */

const secrets: EgressSecrets = fixtureSecrets();

/** Rules that fired, deduped — the assertion surface every test reads. */
function guardOn(rows: unknown): EgressGuard {
	const g = new EgressGuard(secrets);
	g.assertNoRawUserIds("t", rows)
		.assertNoIps("t", rows)
		.assertNoUserAgents("t", rows)
		.assertNoGoogleIds("t", rows)
		.assertNoR2ObjectKeys("t", rows)
		.assertNoAdminSessionIds("t", rows)
		.assertNoEmails("t", rows)
		.assertNoStrippedMetadataKeys("t", rows)
		.assertNoForbiddenPayloadKeys("t", rows);
	return g;
}

/** Rules that fired FATALLY. */
function rulesFiredOn(rows: unknown): string[] {
	return [...new Set(guardOn(rows).findings.map((f) => f.rule))].sort();
}

/** Rules that fired as ADVISORIES — ruling S1's other tier. */
function advisoryRulesOn(rows: unknown): string[] {
	return [...new Set(guardOn(rows).advisories.map((f) => f.rule))].sort();
}

describe("egress · the six named value guards", () => {
	// ── no-raw-user-id ────────────────────────────────────────────────

	it("POSITIVE CONTROL — fires on a row that carries a raw users.id", () => {
		const row = { user_id: FIXTURE_USER_IDS.amber, side: "YES" };
		const g = new EgressGuard(secrets);
		g.assertNoRawUserIds("bets", [row]);

		expect(g.findings).toHaveLength(1);
		expect(g.findings[0]?.rule).toBe("no-raw-user-id");
		expect(g.findings[0]?.path).toBe("[0].user_id");
	});

	it("passes when the id has been rewritten to a pseudonym", () => {
		const row = { user_pseudonym: "AmberOtter042", side: "YES" };
		const g = new EgressGuard(secrets);
		g.assertNoRawUserIds("bets", [row]);
		expect(g.findings).toHaveLength(0);
	});

	it("fires on a raw users.id nested inside JSONB, at depth", () => {
		// The §19.5 path the brief names as most likely to be missed.
		const row = { metadata: { user_id: FIXTURE_USER_IDS.basalt } };
		const g = new EgressGuard(secrets);
		g.assertNoRawUserIds("events", [row]);

		expect(g.findings).toHaveLength(1);
		expect(g.findings[0]?.path).toBe("[0].metadata.user_id");
	});

	it("exempts the users table, and ONLY on the explicit flag", () => {
		const rows = [{ id: FIXTURE_USER_IDS.amber, pseudonym: "AmberOtter042" }];

		const exempt = new EgressGuard(secrets);
		exempt.assertNoRawUserIds("users", rows, { isUsersTable: true });
		expect(exempt.findings).toHaveLength(0);

		// POSITIVE CONTROL for the exemption itself: the same rows without
		// the flag must fire. Without this, `isUsersTable` could be ignored
		// entirely and the test above would still pass.
		const notExempt = new EgressGuard(secrets);
		notExempt.assertNoRawUserIds("users", rows);
		expect(notExempt.findings).toHaveLength(1);
	});

	// ── the other five ────────────────────────────────────────────────

	// ⚠ **The tier column is ruling S1 (DATASET.3), and it is the point of
	// this table now.** Every one of these rows carries a real secret under a
	// key name nobody would expect — `ua`, `g`, `k`, `s`, `e` — which is the
	// "found under ANY key" property the value scan exists for. What S1 adds is
	// that the CONSEQUENCE differs by where the needle came from:
	//
	//   · a SYSTEM-minted needle (google id, R2 key, admin session id) cannot
	//     be made to collide on purpose, so a hit is evidence of a transform
	//     failure and stays FATAL wherever it lands;
	//   · a PARTICIPANT-supplied needle (ip, user-agent, email) CAN be made to
	//     collide on purpose — that is `@security-auditor` C-1, one request
	//     poisoning a one-shot release — so a hit under a field it was never
	//     harvested from is ADVISORY;
	//   · …except under a field it WAS harvested from, where the transform
	//     demonstrably failed at its own job. `no-ip` sits under key `ip`, and
	//     that is why it alone among the three stays fatal.
	//
	// Pinning the tier rather than merely "it fired" is what makes this table
	// able to notice the partition being widened or narrowed by accident.
	it.each([
		["no-ip", { metadata: { ip: FIXTURE_SECRET_VALUES.ips[0] } }, "FATAL"],
		[
			"no-user-agent",
			{ metadata: { ua: FIXTURE_SECRET_VALUES.userAgents[0] } },
			"ADVISORY",
		],
		[
			"no-google-id",
			{ payload: { g: FIXTURE_SECRET_VALUES.googleIds[0] } },
			"FATAL",
		],
		[
			"no-r2-object-key",
			{ payload: { k: FIXTURE_SECRET_VALUES.r2ObjectKeys[0] } },
			"FATAL",
		],
		[
			"no-admin-session-id",
			{ payload: { s: FIXTURE_SECRET_VALUES.adminSessionIds[0] } },
			"FATAL",
		],
		[
			"no-email",
			{ payload: { e: FIXTURE_SECRET_VALUES.emails[0] } },
			"ADVISORY",
		],
	])("POSITIVE CONTROL — %s fires on a row carrying it, tier %s", (rule, row, tier) => {
		const fatal = rulesFiredOn([row]);
		const advisory = advisoryRulesOn([row]);
		// It fired SOMEWHERE — the original claim, unchanged.
		expect([...fatal, ...advisory]).toContain(rule);
		// …and in the tier S1 assigns it.
		if (tier === "FATAL") {
			expect(fatal).toContain(rule);
			expect(advisory).not.toContain(rule);
		} else {
			expect(advisory).toContain(rule);
			expect(fatal).not.toContain(rule);
		}
	});

	it("S1 · the SAME participant needle IS fatal under the field it came from", () => {
		// ⚠ The control that stops the two ADVISORY rows above from reading as
		// "participant classes are switched off". They are not: the identical
		// value, on the identical guard, is fatal when it survives in a field
		// the transform owns. Without this pair, a partition drawn far too wide
		// — every participant needle advisory everywhere — would pass the table.
		const ua = FIXTURE_SECRET_VALUES.userAgents[0];
		expect(
			rulesFiredOn([{ metadata: { user_agent: ua } }]),
			"a user-agent surviving under `user_agent` is the strip failing at " +
				"its own job and must halt",
		).toContain("no-user-agent");
		expect(
			rulesFiredOn([{ users_column: FIXTURE_SECRET_VALUES.emails[0] }]),
		).not.toContain("no-email");
		expect(
			rulesFiredOn([{ email: FIXTURE_SECRET_VALUES.emails[0] }]),
		).toContain("no-email");
	});

	it("S1 · a participant needle that is ALSO system-sourced stays fatal", () => {
		// The stricter-arm-wins rule, exercised. An attacker who sets their
		// `User-Agent` to their own `users.id` must not thereby downgrade the
		// raw-user-id guard — the one wall §19.5 exists to hold.
		const both = FIXTURE_USER_IDS.amber;
		const poisoned = {
			...secrets,
			userAgents: new Set([...secrets.userAgents, both]),
			// The harvest would have filtered it out; construct the state the
			// harvest produces, then assert the guard agrees.
			participantSourced: new Map(secrets.participantSourced),
		};
		const g = new EgressGuard(poisoned);
		g.assertNoRawUserIds("markets", [{ slug: both }]);
		expect(g.findings.map((f) => f.rule)).toContain("no-raw-user-id");
		expect(g.advisories).toHaveLength(0);
	});

	it("is silent on a row that carries none of them", () => {
		const clean = [
			{
				user_pseudonym: "AmberOtter042",
				side: "YES",
				stake: "25.000000000000000000",
				metadata: {
					request_id: "req_x",
					flow_id: "F-BET-1",
					actor_id: "admin-singleton",
				},
			},
		];
		expect(rulesFiredOn(clean)).toEqual([]);
	});

	it("scans a shared object reference on EVERY row that holds it", () => {
		// ⚠ Minted from `@test-writer` L-1, a real hole in the scanner. Cycle
		// detection was a single WeakSet of every object ever visited, which
		// also skips the SECOND reference to an object — not a cycle at all.
		// A source that hoists one `metadata` const across rows (a natural
		// thing to write) would have had every row after the first go
		// unscanned while the guard reported success.
		//
		// Rows parsed from `postgres` are always fresh objects, so this could
		// never have bitten in production — which is exactly what would have
		// let it survive indefinitely.
		const shared = { ip: FIXTURE_SECRET_VALUES.ips[0] };
		const rows = [
			{ id: "a", metadata: shared },
			{ id: "b", metadata: shared },
		];

		const g = new EgressGuard(secrets);
		g.assertNoIps("t", rows);

		expect(g.findings).toHaveLength(2);
		expect(g.findings.map((f) => f.path)).toEqual([
			"[0].metadata.ip",
			"[1].metadata.ip",
		]);
	});

	it("still terminates on a genuine cycle", () => {
		// The property the WeakSet was there for in the first place. A guard
		// that infinite-loops fails open in the worst way: the build hangs,
		// someone kills it, and the previous run's artifact ships.
		const cyclic: Record<string, unknown> = {
			ip: FIXTURE_SECRET_VALUES.ips[0],
		};
		cyclic.self = cyclic;

		const g = new EgressGuard(secrets);
		g.assertNoIps("t", [cyclic]);
		expect(g.findings.length).toBeGreaterThanOrEqual(1);
	});

	it("finds the value under ANY key name, not just the expected one", () => {
		// The reason the guards are value-based rather than key-based: a
		// strip that renamed rather than removed would defeat a key guard.
		//
		// ⚠ **The needle changed at DATASET.3 and the change is the ruling.**
		// This used an `ip`, which is participant-supplied — so under S1 a hit
		// on it in `harmless_looking_column` is now an ADVISORY, and the test
		// would have passed only by accident of `rulesFiredOn` being renamed
		// around it. An R2 object key is server-minted and unchoosable, so it
		// carries the property this test is actually about: a value the
		// transform owns, surviving under a name nobody would grep for, halts.
		const smuggled = [
			{ harmless_looking_column: FIXTURE_SECRET_VALUES.r2ObjectKeys[0] },
		];
		expect(rulesFiredOn(smuggled)).toContain("no-r2-object-key");

		// …and the participant-sourced twin, so the tier is visible here too
		// rather than only in the table above.
		const arrangeable = [
			{ harmless_looking_column: FIXTURE_SECRET_VALUES.ips[1] },
		];
		expect(rulesFiredOn(arrangeable)).not.toContain("no-ip");
		expect(advisoryRulesOn(arrangeable)).toContain("no-ip");
	});
});

describe("egress · key-shaped nets", () => {
	it("POSITIVE CONTROL — a surviving metadata.ip KEY fires even when null", () => {
		// §19.4 removes the key; it does not null it. A surviving `ip: null`
		// still announces the field existed, and Appendix B prescribes
		// `metadata - 'ip'`, not `jsonb_set(..., null)` alone.
		const g = new EgressGuard(emptySecrets());
		g.assertNoStrippedMetadataKeys("events", [{ metadata: { ip: null } }]);

		expect(g.findings).toHaveLength(1);
		expect(g.findings[0]?.rule).toBe("no-stripped-metadata-key");
	});

	it("fires on a forbidden payload key on an event type whose rule is []", () => {
		// The cross-cutting net's whole reason for existing: `market.closed`
		// has an empty strip rule, so a `key` arriving on it is covered by
		// nothing per-type. This is the net that catches it.
		//
		// ⚠ A `u/` key — the namespace that embeds a user id. This test used
		// an `m/` key and passed for the wrong reason until `@security-auditor`
		// H-1 forced the namespace distinction.
		const g = new EgressGuard(emptySecrets());
		g.assertNoForbiddenPayloadKeys("events", [
			{
				event_type: "market.closed",
				payload: { key: "u/0192f3a4-1111-7000-8000-00000000a001/x.webp" },
			},
		]);
		expect(g.findings.map((f) => f.rule)).toContain("no-forbidden-payload-key");
	});

	it("PERMITS an m/<marketId>/ media key — §19.4.1 SHIPs it", () => {
		// `market.created.payload.media[].key` is required on every market and
		// §19.4.1 rules it SHIPs. Rejecting it hard-failed the build on the
		// first real read, for a key the spec explicitly publishes.
		const g = new EgressGuard(emptySecrets());
		g.assertNoForbiddenPayloadKeys("events", [
			{
				event_type: "market.created",
				payload: {
					marketId: "0192f3a4-cccc-7000-8000-000000000001",
					media: [{ key: "m/0192f3a4-cccc-7000-8000-000000000001/hero.webp" }],
				},
			},
		]);
		expect(g.findings).toHaveLength(0);
	});

	it("the REAL market.created row survives the full guard set", () => {
		// The end-to-end version of the same claim, against the fixture's now
		// production-shaped payload rather than a hand-built one.
		const created = DIRTY_EVENT_ROWS.find(
			(r) => r.event_type === "market.created",
		);
		expect(created?.payload).toHaveProperty("media");

		// ⚠ Guarded on the STRIPPED row, which is what the pipeline actually
		// writes. The raw fixture row carries dirty metadata by construction,
		// so asserting cleanliness on it would be asserting that the fixture
		// is clean — the opposite of what it is for.
		expect(created).toBeDefined();
		const [stripped] = stripTable("events", [created as SourceRow], {
			removedCommentIds: new Set(),
		});
		const g = new EgressGuard(secrets);
		g.assertNoForbiddenPayloadKeys("events", [stripped]);
		expect(g.findings).toHaveLength(0);

		// …and `media[].key` genuinely SURVIVED the strip, per §19.4.1.
		expect(JSON.stringify(stripped)).toContain("hero.webp");
	});

	it("matches the key EXACTLY — `idempotency_key` is not `key`", () => {
		// A substring rule would report every shipped `idempotency_key` as a
		// violation, and the guard would be loosened to stop the noise.
		const g = new EgressGuard(emptySecrets());
		g.assertNoForbiddenPayloadKeys("events", [
			{ payload: { idempotency_key: "idem_amber_001" } },
		]);
		expect(g.findings).toHaveLength(0);
	});
});

describe("egress · rendered TEXT artifacts (the debate .md class)", () => {
	const md = [
		"# Will the Mumbai Metro Line 3 open by 5 Nov 2026?",
		"",
		"**AmberOtter042** · YES · Đ25.00",
		"",
		"The tunnelling is complete and trial runs began in August.",
	].join("\n");

	it("passes on rendered text carrying only pseudonyms", () => {
		expect(() =>
			assertTextArtifactClean("m/metro/debate.md", md, secrets),
		).not.toThrow();
	});

	it("POSITIVE CONTROL — fires on a users.id interpolated into prose", () => {
		// Markdown has no keys. A key-based guard is structurally blind to
		// this, which is why the text path is value-based.
		const leaked = md.replace("AmberOtter042", FIXTURE_USER_IDS.amber);

		expect(() =>
			assertTextArtifactClean("m/metro/debate.md", leaked, secrets),
		).toThrow(EgressViolationError);

		// ⚠ Asserting only that it THREW is not enough, and this test
		// originally did exactly that. `assertTextArtifactClean` runs two
		// independent nets, and a leaked users.id is BOTH a known secret and
		// a canonical UUID — so the bare-UUID net alone satisfies a
		// throws-assertion, and the test passed with the value scan mutated
		// to match nothing. Caught by OVN-V2 mutation, not by review.
		// Pin the rule, so this test fails when the guard it names fails.
		const g = new EgressGuard(secrets);
		g.assertTextClean("m/metro/debate.md", leaked);
		expect(g.findings.map((f) => f.rule)).toContain("no-raw-user-id");
	});

	it("POSITIVE CONTROL — the value scan catches a non-UUID secret in prose", () => {
		// The companion to the above, and the one the bare-UUID net CANNOT
		// rescue: this needle has no UUID shape, so only the value scan can
		// see it. Without this, breaking `scanText` would leave four of the
		// five text tests green.
		//
		// ⚠ **The needle was a `user_agent` until DATASET.3, and the reason it
		// changed IS ruling S1.** The old note said *"a user_agent is
		// MACHINE-GENERATED … a participant has no reason to type a UA string
		// into an argument, so one appearing is a serializer leak."* That is
		// false, and `@security-auditor` measured it: the participant SENDS
		// the User-Agent header, so they choose the string, and
		// `User-Agent: because` then failed every debate document containing
		// the word "because" — six characters, one request. A Google `sub` is
		// the honest choice here: opaque, non-UUID, and issued by Google
		// rather than chosen by the account holder.
		const leaked = `${md}\nsub: ${FIXTURE_SECRET_VALUES.googleIds[0]}`;
		const g = new EgressGuard(secrets);
		g.assertTextClean("m/metro/debate.md", leaked);
		expect(g.findings.map((f) => f.rule)).toContain("no-google-id");
		// CONTROL on the needle's shape, so this cannot quietly become a
		// UUID test: the bare-UUID net must be unable to account for it.
		expect(FIXTURE_SECRET_VALUES.googleIds[0]).not.toMatch(UUID_RE);
	});

	it("S1 · a PARTICIPANT-supplied needle in prose is advisory, however machine-shaped", () => {
		// ⚠ The measured C-1 attack, run as a test. `scanText` is a SUBSTRING
		// matcher over a document that is participant prose end to end, and
		// the attacker picks the substring. Halting here hands every
		// participant a deterministic abort of a one-shot release for content
		// somebody else was entitled to write.
		const leaked = `${md}\nUA: ${FIXTURE_SECRET_VALUES.userAgents[0]}`;
		const g = new EgressGuard(secrets);
		g.assertTextClean("m/metro/debate.md", leaked);
		expect(g.findings.map((f) => f.rule)).not.toContain("no-user-agent");
		expect(g.advisories.map((f) => f.rule)).toContain("no-user-agent");
		// …and it is REPORTED, not dropped. An advisory nobody can see is a
		// downgrade to nothing.
		expect(
			g.advisories.find((f) => f.rule === "no-user-agent")?.detail,
		).toContain("participant-writable");
	});

	it("S1 · the attack DATASET.2 measured now costs the build nothing", () => {
		// `@security-auditor` C-1, reproduced end to end: a participant sets
		// `User-Agent: because` and every debate document containing the
		// ordinary English word fails. Six characters, one request, no
		// privileged knowledge — and `events` is Bucket A, so post-freeze the
		// poisoning row can be neither edited nor deleted.
		const attacker = "because";
		const poisoned = {
			...secrets,
			userAgents: new Set([...secrets.userAgents, attacker]),
			participantSourced: new Map([
				...secrets.participantSourced,
				[attacker, new Set(["user_agent", "tos_acceptance_user_agent"])],
			]),
		};
		const debate = "# Debate\n\nYES, because the tunnelling is complete.\n";

		// CONTROL — the needle really is present in the document, so a clean
		// result below is a decision rather than a scan that found nothing.
		expect(debate).toContain(attacker);

		const g = new EgressGuard(poisoned);
		g.assertTextClean("m/metro/debate.md", debate);
		expect(g.findings, "the release build must not abort on this").toEqual([]);
		expect(g.advisories.map((f) => f.rule)).toContain("no-user-agent");

		// THE WRONG ANSWER, constructed: the same document under the old rule,
		// where every class was fatal by class alone.
		const oldRule = new EgressGuard({
			...poisoned,
			participantSourced: new Map(),
		});
		oldRule.assertTextClean("m/metro/debate.md", debate);
		expect(
			oldRule.findings.map((f) => f.rule),
			"the pre-S1 behaviour, kept as code so the improvement is measured",
		).toContain("no-user-agent");
	});

	it("a HUMAN-AUTHORABLE secret in prose is an advisory, not fatal", () => {
		// The other half of the tier. An email is something a participant can
		// and does write into an argument; halting there aborts a one-shot
		// release for content they were entitled to write
		// (`@security-auditor` F-11 H-B).
		const leaked = `${md}\nreach me at ${FIXTURE_SECRET_VALUES.emails[0]}`;
		const g = new EgressGuard(secrets);
		g.assertTextClean("m/metro/debate.md", leaked);

		expect(g.findings).toHaveLength(0);
		expect(g.advisories.map((f) => f.rule)).toContain("no-email");
	});

	it("a short display name cannot abort a debate export", () => {
		// F-11 H-B's measured attack: set your Google display name to "Li",
		// and every debate document containing the word "Line" dies. The text
		// arm had neither the needle floor nor the tier.
		const g = new EgressGuard({ ...secrets, displayNames: new Set(["Li"]) });
		g.assertTextClean("m/metro/debate.md", "Line 3 opens in November");

		expect(g.findings).toHaveLength(0);
		expect(g.skippedNeedles.map((n) => n.rule)).toContain("no-display-name");
	});

	it("reports the LINE, and never the leaked value itself", () => {
		// ⚠ Reads the ADVISORY channel: an email in prose is human-authorable
		// and no longer fatal. The redaction property is identical either way,
		// and it is the property under test.
		const leaked = `${md}\ncontact: ${FIXTURE_SECRET_VALUES.emails[0]}`;
		const g = new EgressGuard(secrets);
		g.assertTextClean("m/metro/debate.md", leaked);

		expect(g.advisories).toHaveLength(1);
		expect(g.advisories[0]?.path).toBe("line 6");
		// A violation report is itself an artifact. One that prints the
		// leaked email into a CI log has moved the leak, not reported it.
		expect(g.advisories[0]?.detail).not.toContain(
			FIXTURE_SECRET_VALUES.emails[0],
		);
		// ⚠ Pin the fingerprint FORM, not merely "not the whole value".
		// Widening the slice to 20 would leak 20 of this email's 21
		// characters into a CI log and still satisfy the assertion above.
		expect(g.advisories[0]?.detail).toContain(
			`${FIXTURE_SECRET_VALUES.emails[0].slice(0, 8)}…`,
		);
		expect(g.advisories[0]?.detail).not.toContain(
			FIXTURE_SECRET_VALUES.emails[0].slice(0, 12),
		);
	});

	it("POSITIVE CONTROL — the bare-UUID net fires on an id NOT in the secret set", () => {
		// The secondary net's reason to exist: an id the secret set never
		// collected, which the exact-value pass is structurally unable to see.
		const unknownId = "0192f3a4-7777-7000-8000-00000000zzzz".replace(
			"zzzz",
			"9999",
		);
		expect(secrets.userIds.has(unknownId)).toBe(false); // control's control

		const g = new EgressGuard(secrets);
		g.assertNoBareUuidsInText("x.md", `posted by ${unknownId}`);

		// ⚠ ADVISORY, not a finding. Downgraded after `@security-auditor` H-4:
		// a participant typing a UUID into an argument would otherwise abort
		// that market's export on a one-shot release job, for content they
		// were entitled to write. Every real `users.id` is still covered by
		// the exact-value scan, which DOES halt.
		expect(g.findings).toHaveLength(0);
		expect(g.advisories.map((f) => f.rule)).toContain("bare-uuid-in-text");
	});

	it("a short display name cannot fire — needles below the floor are skipped", () => {
		// `@security-auditor` H-4: one participant named "Li" made every
		// debate export containing "Line 3" fail, with no attacker involved.
		const shortName = { ...secrets, displayNames: new Set(["Li"]) };
		const g = new EgressGuard(shortName);
		g.assertNoDisplayNames("t", [{ body: "Line 3 opens in November" }]);

		expect(g.findings).toHaveLength(0);
		// …and the skip is REPORTED, never silent — a class that quietly
		// stops covering anything is the failure this layer exists to stop.
		expect(g.skippedNeedles.map((n) => n.rule)).toContain("no-display-name");
	});

	it("a secret inside participant-authored free text is REPORTED, not fatal", () => {
		// The blocked_text collision: post B with a bad image → blocked and
		// stored; re-post B without the image → passes → comments.body === B.
		// Halting there hands any participant a kill switch on the release.
		const g = new EgressGuard({
			...secrets,
			blockedTexts: new Set(["the rejected comment body, retained"]),
		});
		g.assertNoBlockedTexts("comments", [
			{ body: "the rejected comment body, retained" },
		]);

		expect(g.findings).toHaveLength(0);
		expect(g.advisories.map((f) => f.rule)).toContain("no-blocked-text");
	});

	it("the SAME value in a non-free-text column IS fatal", () => {
		// The control that keeps the tiering honest. Free-text leniency must
		// not become blanket leniency: a secret surfacing in a column the
		// transform was supposed to clean is still a transform failure.
		const g = new EgressGuard({
			...secrets,
			blockedTexts: new Set(["the rejected comment body, retained"]),
		});
		g.assertNoBlockedTexts("mod_actions", [
			{ some_operational_column: "the rejected comment body, retained" },
		]);
		expect(g.findings.map((f) => f.rule)).toContain("no-blocked-text");
	});
});

describe("egress · assertTableClean / the dirty fixture end to end", () => {
	it("POSITIVE CONTROL — the untransformed dirty fixture FAILS every class", () => {
		// This is the single most load-bearing assertion in the slice. It
		// proves the fixture genuinely carries the forbidden material, so
		// that the post-strip assertions later in the pipeline are claims
		// about the strip rather than claims about the input.
		let caught: EgressViolationError | undefined;
		try {
			assertTableClean("events", DIRTY_EVENT_ROWS, secrets);
		} catch (e) {
			caught = e as EgressViolationError;
		}

		expect(caught).toBeInstanceOf(EgressViolationError);
		const fired = new Set(caught?.violations.map((v) => v.rule));

		for (const rule of [
			"no-raw-user-id",
			"no-ip",
			"no-user-agent",
			"no-google-id",
			"no-r2-object-key",
			"no-admin-session-id",
			"no-email",
			"no-stripped-metadata-key",
			"no-forbidden-payload-key",
		]) {
			expect(fired, `${rule} must fire on the dirty fixture`).toContain(rule);
		}
	});

	it("accumulates every violation rather than stopping at the first", () => {
		// The export is a one-shot job on a conference morning. Fail-fast
		// would make the operator re-run it to find each next problem.
		let caught: EgressViolationError | undefined;
		try {
			assertTableClean("events", DIRTY_EVENT_ROWS, secrets);
		} catch (e) {
			caught = e as EgressViolationError;
		}
		// Anchored to the fixture's own size rather than a magic number: a
		// fixture edit that halves the violation count should not still pass.
		//
		// Every one of the 24 event rows carries `metadata.ip` +
		// `metadata.user_agent`, so that is 2 × 24 = 48. The remaining 4 are
		// PAYLOAD keys — `user.tos_accepted` carries both, `admin.signed_in`
		// carries `ip`, and (DATASET.2 C2) `image_upload.committed` carries a
		// NESTED `payload.context.ip` at depth 2 — because `findKeys` walks the
		// whole row rather than only the `metadata` object.
		//
		// ⚠ **That fourth hit was 3 until the C2 depth row landed, and the
		// increment is the measurement.** `findKeys` has always been recursive,
		// so it saw the nested key immediately; the strip and the harvest did
		// not. A number that moved by exactly one, in the arm that was already
		// deep, is what a fixture gaining one nested secret should do — and if
		// it had NOT moved, the fixture would not actually be nesting anything.
		//
		// ⚠ Worth stating rather than rounding away: the rule is NAMED
		// `no-stripped-metadata-key` and its net is wider than its name. That
		// is the safe direction (an `ip` under any key is still an `ip`), but
		// a future reader narrowing it to match its name would remove a real
		// catch. Asserting the composition is what makes that visible.
		const metadataHits =
			caught?.violations.filter((v) => v.rule === "no-stripped-metadata-key") ??
			[];
		const inMetadata = metadataHits.filter((v) =>
			v.path.includes(".metadata."),
		).length;
		expect(inMetadata).toBe(DIRTY_EVENT_ROWS.length * 2);
		expect(metadataHits.length - inMetadata).toBe(4);
		// Pin the nested one by PATH, not only by the count above. A count
		// alone cannot distinguish "the depth probe is being seen" from "some
		// other row gained an ip" — and this file's own history is that a
		// number agreeing with expectation is the failure mode.
		expect(
			metadataHits.some((v) => v.path.includes(".payload.context.ip")),
		).toBe(true);
	});
});
