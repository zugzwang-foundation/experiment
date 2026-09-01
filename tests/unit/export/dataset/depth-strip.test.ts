import { describe, expect, it } from "vitest";

import {
	DIRTY_TABLE_ROWS,
	FIXTURE_SECRET_VALUES,
	FIXTURE_USER_IDS,
	fixtureSecrets,
} from "@/../tests/_fixtures/dataset/dirty-source";
import { harvestSecrets } from "@/server/export/dataset/build";
import {
	buildPseudonymMap,
	pseudonymizeTable,
} from "@/server/export/dataset/pseudonymize";
import {
	shipDeep,
	shipPayload,
	stripMetadata,
	stripRow,
	stripTable,
} from "@/server/export/dataset/strip";
import { assertTableClean } from "@/server/export/egress";
import {
	EgressContractGapError,
	EgressViolationError,
} from "@/server/export/egress/errors";
import {
	GLOBALLY_FORBIDDEN_PAYLOAD_KEYS,
	PAYLOAD_SHIP_KEYS,
	STRIPPED_METADATA_KEYS,
} from "@/server/export/egress/forbidden-keys";
import { findKeys, findValues, walk } from "@/server/export/egress/scan";

/**
 * DATASET.2 C2 + C3 — the depth guards. **Rewritten at DATASET.3.**
 *
 * ## What these exist to reject
 *
 * The payload and metadata strips walked ONE level until DATASET.2, and the
 * harvest that feeds the value scan walked one level with them.
 *
 * ⚠ **CORRECTED (`@test-writer` HIGH-1), because this docblock once claimed
 * something measurably false.** It said *"both layers fell silent on the same
 * input and the build reported success"*. They did not. `walk()` has been
 * recursive since DATASET.1 and **both KEY nets ride on it**, so `findKeys`
 * reached nested keys regardless of what the strip did — and every nested key
 * this fixture carries (`userId`, `ip`, `key`) is on
 * `GLOBALLY_FORBIDDEN_PAYLOAD_KEYS` or `STRIPPED_METADATA_KEYS`.
 *
 * Measured, by reproducing the one-level strip and running the guard over it:
 * **8 fatal violations, not silence.** ⇒ The shallow strip was a guaranteed
 * build ABORT on a one-shot job, not a silent leak — worth fixing for that
 * alone, but a different claim than the one first written here.
 *
 * ## ⚠ WHAT CHANGED AT DATASET.3, AND WHY THIS FILE READS DIFFERENTLY
 *
 * The depth work was correct and it was not enough. Depth made the strip walk
 * to any level; it still only removed keys it was NAMED. So the genuinely
 * silent class survived it: a nested secret under a key on NO list
 * (`payload.client.remoteAddr`) was unstripped, unharvested, unmatched by
 * value and unmatched by key — four layers quiet on one input — and this file
 * pinned that as `⛔ KNOWN OPEN`, twice, because closing it was a spec
 * decision nobody had made.
 *
 * **Ruling E made it, and the strip inverted to a positive allow-list.** Both
 * pins have therefore FIRED and are inverted below; so has the `⛔ KNOWN OPEN`
 * on `comment.placed`'s recovery path (ruling S5). That is the point of
 * writing a tripwire as a test rather than as a paragraph in a report: it
 * cannot be quietly lost, and when the ruling lands the suite says so.
 *
 * The consequence for reading this file: several assertions here now check
 * that an UNDECLARED container is dropped **whole**, where their DATASET.2
 * forms checked that a named key was removed from a container that survived.
 * Each carries its own note. Nothing about the depth claim was withdrawn —
 * the allow-list walks to the same depth, through the same arrays.
 *
 * Every test is written so that reverting the fix it guards turns it RED. The
 * mutation table is in the run report; the point of writing them this way is
 * that "it passes" is only evidence if "it can fail" was demonstrated.
 *
 * ## The fixture rows these lean on
 *
 * `image_upload.committed.payload` carries the deliberate nested dirt —
 * `context.{userId,ip}` (depth 2, object), `variants[0].key` (depth 2, through
 * an ARRAY, `u/`-namespaced) and `commentId` (C3). `schemas.ts` declares none
 * of `context`/`variants`, which is what makes them the right probe for an
 * allow-list too: they are exactly the shape of a key nobody reviewed.
 * `market.created.payload.media[0].key` is the opposite number — also depth 2
 * through an array, and DECLARED, so it must SURVIVE.
 *
 * Both directions are pinned deliberately. A rule that drops everything it
 * reaches inside an array passes the first and fails the second, and a rule
 * that skips arrays entirely does the reverse — so neither test alone
 * distinguishes a correct implementation from a broken one.
 */

const COMMITTED = DIRTY_TABLE_ROWS.events.find(
	(r) => (r as Record<string, unknown>).event_type === "image_upload.committed",
) as Record<string, unknown>;

const MARKET_CREATED = DIRTY_TABLE_ROWS.events.find(
	(r) => (r as Record<string, unknown>).event_type === "market.created",
) as Record<string, unknown>;

const [, , M_KEY, R2_NESTED] = FIXTURE_SECRET_VALUES.r2ObjectKeys;
const [, , , IP_NESTED] = FIXTURE_SECRET_VALUES.ips;

/**
 * The fixture must actually carry the depth these tests claim to exercise.
 *
 * ⚠ This is not ceremony. A test asserting "the nested secret is stripped"
 * passes trivially against a payload with nothing nested in it — which is
 * `@test-writer` M-5 exactly, a POSITIVE CONTROL harvesting from empty
 * arrays. If someone flattens the fixture, these fail here with a message
 * about the fixture rather than five files away with a message about the
 * strip.
 */
describe("C2 · the fixture carries real depth (guard on the guards)", () => {
	it("image_upload.committed nests an object AND an array under payload", () => {
		const p = COMMITTED.payload as Record<string, unknown>;
		expect(p.context).toBeTypeOf("object");
		expect((p.context as Record<string, unknown>).ip).toBe(IP_NESTED);
		expect(Array.isArray(p.variants)).toBe(true);
		expect((p.variants as Record<string, unknown>[])[0]?.key).toBe(R2_NESTED);
		expect(p.commentId).toBeTypeOf("string");
	});

	it("the two array-nested keys sit in OPPOSITE namespaces", () => {
		// This is what makes the pair able to distinguish a correct depth rule
		// from "strip everything in arrays" and from "skip arrays".
		expect(R2_NESTED.startsWith("u/")).toBe(true);
		expect(M_KEY.startsWith("m/")).toBe(true);
		const media = (MARKET_CREATED.payload as Record<string, unknown>)
			.media as Record<string, unknown>[];
		expect(media[0]?.key).toBe(M_KEY);
	});

	it("the nested ip is reachable NOWHERE else in the fixture", () => {
		// The harvest probe is only a probe if a shallow harvest misses it.
		// Count every occurrence across every table; it must be exactly one,
		// and it must be the nested one.
		const hits = findValues(DIRTY_TABLE_ROWS, new Set([IP_NESTED]));
		expect(hits.length).toBe(1);
		expect(hits[0]?.path).toContain(".context.ip");
	});

	it("the ARRAY-depth r2 probe is likewise reachable nowhere else", () => {
		// ⚠ The same uniqueness guarantee the nested ip gets, and it was missing
		// for its array-nested twin. GUARD 2's `r2ObjectKeys.has(R2_NESTED)`
		// assertion is only a DEPTH probe while this holds: `harvestSecrets`
		// also collects `image_uploads.r2_object_key` and
		// `mod_actions.image_r2_key` from the top level, so the same string
		// appearing on either column would make that guard pass against a
		// completely shallow harvest.
		const hits = findValues(DIRTY_TABLE_ROWS, new Set([R2_NESTED]));
		expect(hits.length).toBe(1);
		expect(hits[0]?.path).toContain(".variants[0].key");
	});

	it("the m/ key IS reachable by the walk — so skipping it is a DECISION", () => {
		// ⚠ Control on GUARD 2's third assertion. *"The harvest does NOT collect
		// the m/ key"* passes identically when the harvest CHOSE not to and when
		// the walk never got there — and only the first is the property being
		// claimed. This pins reachability, so the exemption is what does the
		// work.
		const reachable = [...walk(MARKET_CREATED.payload)].filter(
			(e) => e.key === "key" && e.value === M_KEY,
		);
		expect(reachable.length).toBe(1);
		expect(reachable[0]?.path).toContain("media[0].key");
	});
});

describe("C2 · GUARD 1 — an UNDECLARED container at depth 2 is dropped whole", () => {
	it("drops payload.context entirely, secrets and innocent siblings alike", () => {
		const out = shipPayload(
			"image_upload.committed",
			COMMITTED.payload,
		) as Record<string, unknown>;

		// ⚠ **This assertion INVERTED at DATASET.3, and the inversion is the
		// slice.** Under the deny-list it read *"the container survives — depth
		// is about keys, not about deleting whole subtrees"*, and that was the
		// right thing to say about a mechanism that removed named keys and kept
		// everything else. Under an allow-list `context` is simply not declared
		// on `image_upload.committed` (`schemas.ts` does not declare it either —
		// it is deliberate fixture dirt), so it is dropped without being read.
		//
		// The old worry — "a strip that removed `context` wholesale would
		// destroy shipped data" — does not survive the change of mechanism:
		// nothing inside an undeclared container is shipped data, because
		// shipped data is exactly what somebody wrote down.
		expect("context" in out).toBe(false);
		// And the targeted-ness that mattered is still measured, one level up:
		// `uploadId` is declared and survives, so this is not a payload that was
		// emptied wholesale.
		expect(out.uploadId).toBeTypeOf("string");
	});

	it("REJECTS the wrong answer: the pre-DATASET.2 one-level DENY walk keeps both", () => {
		// The pre-DATASET.2 implementation, reproduced as code so the claim is
		// measured rather than asserted in a comment.
		//
		// ⚠ The forbidden set is a LITERAL of the historical rule, not a read of
		// today's registry. It used to be `new Set(PAYLOAD_STRIP_KEYS[…])`, and
		// after the inversion that expression names an OBJECT of shipped keys —
		// so the reproduction would have silently become "remove the keys that
		// ship", which passes for a reason unrelated to depth. A historical
		// reproduction has to be pinned to history.
		const HISTORICAL_STRIP_KEYS = ["userId", "key", "commentId"];
		const oneLevel = (payload: Record<string, unknown>) => {
			const forbidden = new Set<string>(HISTORICAL_STRIP_KEYS);
			const out: Record<string, unknown> = {};
			for (const [k, v] of Object.entries(payload)) {
				if (forbidden.has(k)) continue;
				out[k] = v;
			}
			return out;
		};
		const shallow = oneLevel(COMMITTED.payload as Record<string, unknown>);
		const ctx = shallow.context as Record<string, unknown>;
		expect(ctx.ip).toBe(IP_NESTED);
		expect(ctx.userId).toBe(FIXTURE_USER_IDS.amber);
	});
});

describe("C2 · GUARD 1b — stripMetadata is recursive TOO, and nothing tested it", () => {
	// ⚠ **The other half of the C2 fix, and it had no coverage at all.** The
	// file docblock names `shipPayload` / `stripMetadata` together, and
	// `stripMetadata` genuinely changed — it delegates to `shipDeep` now. But
	// every metadata fixture in the suite is the flat §3.7 seven-field object,
	// so reverting `stripMetadata` alone to a one-level walk left the entire
	// suite green: `transform.test.ts:175` passes a flat object and this file's
	// three `stripMetadata` cases are all HIGH-2 fail-closed checks on scalars.
	//
	// Metadata nests in practice more readily than payloads do — a `context`,
	// a `headers`, a `trace` block is the ordinary shape of request metadata —
	// and §19.4/Appendix B.23 say `ip` and `user_agent` never ship from any
	// audit table, not that they never ship from the top level of one.

	it("drops an undeclared metadata container whole, at depth 2", () => {
		// ⚠ INVERTED at DATASET.3 with its payload twin. `context` is not one of
		// §3.7's seven fields, so it never reaches the question "which of its
		// keys are secret" — it is dropped for not being declared, which is a
		// stronger property than dropping the two keys somebody remembered.
		const out = stripMetadata(
			{
				request_id: "req_1",
				flow_id: "F-BET-1",
				context: {
					ip: IP_NESTED,
					user_agent: "Mozilla/5.0 (X)",
					region: "bom1",
				},
			},
			"events",
		) as Record<string, unknown>;

		expect("context" in out).toBe(false);
		// The declared siblings survive — not an emptied object.
		expect(out.request_id).toBe("req_1");
		expect(out.flow_id).toBe("F-BET-1");
	});

	it("drops an undeclared ARRAY inside metadata too", () => {
		const out = stripMetadata(
			{ request_id: "req_1", hops: [{ ip: IP_NESTED, seq: 1 }] },
			"events",
		) as Record<string, unknown>;
		expect("hops" in out).toBe(false);
		expect(out.request_id).toBe("req_1");
	});

	it("REJECTS the wrong answer: a one-level DENY walk leaves the nested ip in place", () => {
		const oneLevel = (m: Record<string, unknown>) => {
			const out: Record<string, unknown> = {};
			for (const [k, v] of Object.entries(m)) {
				if (STRIPPED_METADATA_KEYS.includes(k as never)) continue;
				out[k] = v;
			}
			return out;
		};
		const shallow = oneLevel({
			request_id: "req_1",
			context: { ip: IP_NESTED },
		});
		expect((shallow.context as Record<string, unknown>).ip).toBe(IP_NESTED);
	});

	it("REJECTS the wrong answer: a RECURSIVE deny walk still ships an unlisted nested key", () => {
		// ⚠ The mutation that matters after DATASET.3, and it is a different one.
		// A recursive deny-list — the DATASET.2 fix, correct as far as it went —
		// removes `ip` at any depth and leaves `region` beside it. That is fine
		// for `region` and fatal for the next key somebody adds, because the
		// rule is "remove what I named" and the new key is never named.
		//
		// Written as code rather than argued, so "the allow-list is stronger" is
		// a measurement and not a preference.
		const recursiveDeny = (v: unknown): unknown => {
			if (v === null || typeof v !== "object") return v;
			if (Array.isArray(v)) return v.map(recursiveDeny);
			const out: Record<string, unknown> = {};
			for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
				if (STRIPPED_METADATA_KEYS.includes(k as never)) continue;
				out[k] = recursiveDeny(val);
			}
			return out;
		};
		const denied = recursiveDeny({
			request_id: "req_1",
			context: { ip: IP_NESTED, remoteAddr: IP_NESTED },
		}) as Record<string, unknown>;
		// The named key goes…
		expect("ip" in (denied.context as Record<string, unknown>)).toBe(false);
		// …and its unnamed synonym ships, carrying the identical value.
		expect((denied.context as Record<string, unknown>).remoteAddr).toBe(
			IP_NESTED,
		);

		// The allow-list, on the same input, drops the container outright.
		const allowed = stripMetadata(
			{
				request_id: "req_1",
				context: { ip: IP_NESTED, remoteAddr: IP_NESTED },
			},
			"events",
		) as Record<string, unknown>;
		expect("context" in allowed).toBe(false);
		expect(JSON.stringify(allowed)).not.toContain(IP_NESTED);
	});
});

describe("C2 · GUARD 2 — the nested secret is HARVESTED", () => {
	it("harvestSecrets finds the depth-2 ip", () => {
		const secrets = harvestSecrets(DIRTY_TABLE_ROWS as never);
		expect(secrets.ips.has(IP_NESTED)).toBe(true);
	});

	it("harvestSecrets finds the array-nested u/ R2 key", () => {
		const secrets = harvestSecrets(DIRTY_TABLE_ROWS as never);
		expect(secrets.r2ObjectKeys.has(R2_NESTED)).toBe(true);
	});

	it("and does NOT harvest the m/ market-media key as a secret", () => {
		// ⚠ The failure this rejects is subtle and is `@security-auditor` H-1
		// one layer over. Harvesting the `m/` key would make the value scan
		// fire on `market_media.csv`, which SHIPs that identical string as a
		// column (Appendix B.16) — the build would abort on a value it
		// published itself. Going recursive is what first brings this key
		// within the harvest's reach at all, so the exemption only becomes
		// load-bearing here at the same moment the depth does.
		const secrets = harvestSecrets(DIRTY_TABLE_ROWS as never);
		expect(secrets.r2ObjectKeys.has(M_KEY)).toBe(false);
	});

	it("the harvest and the fixture's declared secret set AGREE on all four", () => {
		// Cross-check against the independently-written literal. They are two
		// derivations of one fact; if they disagree, one of them is wrong and
		// the tests leaning on `fixtureSecrets()` are testing the wrong set.
		const harvested = harvestSecrets(DIRTY_TABLE_ROWS as never);
		const declared = fixtureSecrets();
		for (const k of declared.r2ObjectKeys) {
			expect(harvested.r2ObjectKeys.has(k)).toBe(true);
		}
		expect(harvested.r2ObjectKeys.has(M_KEY)).toBe(false);
		expect(declared.r2ObjectKeys.has(M_KEY)).toBe(false);
	});
});

describe("C2 · GUARD 3 — the allow-list reaches THROUGH arrays", () => {
	it("drops the undeclared variants[] array whole", () => {
		const out = shipPayload(
			"image_upload.committed",
			COMMITTED.payload,
		) as Record<string, unknown>;
		expect("variants" in out).toBe(false);
	});

	it("and inside a DECLARED array, an undeclared element key is dropped", () => {
		// ⚠ This is the array claim that still needs its own test, and it is
		// genuinely distinct from the object claim. `market.created.media` IS
		// declared, so the array survives; the question is whether the child
		// spec is applied to every ELEMENT or only to the array itself. An
		// implementation that declared the array and shipped its elements
		// verbatim would pass every object-depth test in this file.
		const out = shipPayload("market.created", {
			marketId: "0192f3a4-cccc-7000-8000-000000000001",
			resolutionDeadline: "2026-10-01T12:00:00.000Z",
			media: [
				{
					key: M_KEY,
					displayOrder: 0,
					isDefault: true,
					// The undeclared element key. A future author adding an
					// upload attribution field writes exactly this.
					uploadedBy: FIXTURE_USER_IDS.amber,
				},
			],
			mediaVideoUrl: null,
		}) as Record<string, unknown>;

		const media = out.media as Record<string, unknown>[];
		expect(Array.isArray(media)).toBe(true);
		// Declared children survive…
		expect(media[0]?.key).toBe(M_KEY);
		expect(media[0]?.displayOrder).toBe(0);
		// …and the undeclared one does not, along with the raw users.id it held.
		expect("uploadedBy" in (media[0] ?? {})).toBe(false);
		expect(JSON.stringify(out)).not.toContain(FIXTURE_USER_IDS.amber);
	});

	it("REJECTS the wrong answer: element specs not applied inside the array", () => {
		// A walk that descends objects and passes arrays through untouched. It
		// passes GUARD 1 completely and fails only here — which is what makes
		// "depth through objects" and "depth through arrays" two claims.
		const objectsOnly = (v: unknown, node: unknown): unknown => {
			if (node === true) return v;
			if (v === null || typeof v !== "object") return v;
			if (Array.isArray(v)) return v; // ← the defect
			const out: Record<string, unknown> = {};
			for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
				const child = (node as Record<string, unknown>)[k];
				if (child === undefined) continue;
				out[k] = objectsOnly(val, child);
			}
			return out;
		};
		const broken = objectsOnly(
			{
				marketId: "m1",
				media: [{ key: M_KEY, uploadedBy: FIXTURE_USER_IDS.amber }],
			},
			PAYLOAD_SHIP_KEYS["market.created"],
		) as Record<string, unknown>;
		expect((broken.media as Record<string, unknown>[])[0]?.uploadedBy).toBe(
			FIXTURE_USER_IDS.amber,
		);
	});

	it("REJECTS the wrong answer: `true` used to ship a whole subtree", () => {
		// ⚠ The escape hatch that would undo the inversion from inside. If
		// `true` meant "ship whatever is here", an author could declare a
		// container `true` and every key inside it would ship unreviewed — a
		// deny-list's failure mode wearing an allow-list's clothes. It throws.
		expect(() =>
			shipPayload("market.created", {
				marketId: "m1",
				// `resolutionDeadline` is declared `true`, i.e. a scalar.
				resolutionDeadline: { nested: FIXTURE_USER_IDS.amber },
				media: [{ key: M_KEY, displayOrder: 0, isDefault: true }],
				mediaVideoUrl: null,
			}),
		).toThrow(/declared as a shipped SCALAR but holds an object/);
	});
});

describe("C2 · GUARD 4 — the m/ namespace SURVIVES the recursive strip", () => {
	it("market.created.payload.media[].key still ships", () => {
		// ⚠ `@security-auditor` H-1 was a GUARANTEED TOTAL BUILD FAILURE:
		// `key` is `.min(1)` in schemas.ts, so every real market carries one,
		// and §19.4.1 SHIPs it. Recursion is what puts it in the strip's reach
		// for the first time, so this is the test most likely to be the one
		// that fails if the namespace predicate is dropped.
		const out = shipPayload("market.created", MARKET_CREATED.payload) as Record<
			string,
			unknown
		>;
		const media = out.media as Record<string, unknown>[];
		expect(media[0]?.key).toBe(M_KEY);
		expect(media[0]?.displayOrder).toBe(0);
	});

	it("and a `key` on an event type that does not declare one never ships", () => {
		// ⚠ **The pair, and its meaning changed with the mechanism.** Under the
		// deny-list this asserted that a `u/`-namespaced key was stripped while
		// its `m/` twin survived — the same key NAME, opposite outcomes decided
		// by the value's NAMESPACE. That rule had to live in three places at
		// once (strip, harvest, assertion) and disagreeing in any one of them
		// was a guaranteed total build failure (`@security-auditor` H-1).
		//
		// Under the allow-list the namespace never enters the strip's reasoning.
		// `market.created` declares `media[].key` so it ships; `image_upload.*`
		// declares no `key` at all so it does not — decided by the DECLARATION,
		// not by inspecting the value. The predicate survives in the harvest and
		// the assertion, which still reason about key names; the strip no longer
		// needs to know.
		const out = shipPayload("image_upload.sign_requested", {
			uploadId: "u1",
			contentType: "image/webp",
			byteSize: 1024,
			key: `u/${FIXTURE_USER_IDS.amber}/x.webp`,
		}) as Record<string, unknown>;
		expect("key" in out).toBe(false);
		expect(out.uploadId).toBe("u1");

		// …and the same NAME under an m/ value is equally absent here, because
		// nothing about the value is consulted. That is the simplification:
		// one fewer rule three layers have to agree about.
		const out2 = shipPayload("image_upload.sign_requested", {
			uploadId: "u1",
			key: M_KEY,
		}) as Record<string, unknown>;
		expect("key" in out2).toBe(false);
	});

	it("shipDeep drops an undeclared key at any depth, through arrays", () => {
		// The primitive, exercised directly rather than only through
		// `shipPayload`, so a change to the declaration table cannot make this
		// pass or fail for a reason unrelated to the walk.
		const out = shipDeep(
			{ media: [{ key: "keep", secret: FIXTURE_USER_IDS.amber }] },
			{ media: { key: true } },
			"probe",
		) as Record<string, unknown>;
		const media = out.media as Record<string, unknown>[];
		expect(media[0]?.key).toBe("keep");
		expect("secret" in (media[0] ?? {})).toBe(false);
	});
});

describe("C3 · image_upload.committed.payload.commentId is stripped", () => {
	it("removes commentId unconditionally", () => {
		const out = shipPayload(
			"image_upload.committed",
			COMMITTED.payload,
		) as Record<string, unknown>;
		expect("commentId" in out).toBe(false);
		// `uploadId` is the row id and SHIPs — proving the strip is targeted
		// and did not simply empty the payload.
		expect(out.uploadId).toBeTypeOf("string");
	});

	it("closes the image_upload.committed route specifically", () => {
		// ⚠ Scoped to `image_upload.*`, and the scoping is the correction to my
		// own first version of this test, which asserted NO `commentId` key
		// survived anywhere in `events` and failed — correctly. `bet.placed`
		// and `comment.placed` both carry a `commentId` that §19.4.1 SHIPs as
		// a research key. A guard that demanded zero would have been demanding
		// the pipeline delete the comment↔bet join graph.
		const removed = DIRTY_TABLE_ROWS.mod_actions.find(
			(r) => (r as Record<string, unknown>).reason === "content_removed",
		) as Record<string, unknown>;
		const removedCommentId = removed.target_comment_id as string;

		const strippedEvents = stripTable("events", DIRTY_TABLE_ROWS.events, {
			removedCommentIds: new Set([removedCommentId]),
		});
		const strippedComments = stripTable("comments", DIRTY_TABLE_ROWS.comments, {
			removedCommentIds: new Set([removedCommentId]),
		});

		// (a) The comments-table arm withholds the FK.
		const removedRow = strippedComments.find((r) => r.id === removedCommentId);
		expect(removedRow).toBeDefined();
		expect("image_uploads_id" in (removedRow ?? {})).toBe(false);

		// (b) No `image_upload.*` event carries a commentId any more.
		const uploadEvents = strippedEvents.filter((r) =>
			String(r.event_type).startsWith("image_upload."),
		);
		expect(uploadEvents.length).toBeGreaterThan(0); // control: there ARE such rows
		expect(findKeys(uploadEvents, ["commentId"]).length).toBe(0);
	});

	it("S5 · comment.placed no longer rebuilds the association — the pin, INVERTED", () => {
		// ⚠⚠ **This test was a tripwire and it fired.** Its DATASET.2 form
		// asserted `leaking.length === 1` and was labelled `⛔ KNOWN OPEN`,
		// written *"to go RED when the ruling lands and the route is closed —
		// which is the point of asserting it rather than only writing it in a
		// report."* Ruling S5 landed, the route is closed, and this is the
		// inversion it was written to demand.
		//
		// What closed it is worth being precise about, because it was not a new
		// rule. `comment.placed`'s SHIP declaration simply does not name
		// `uploadId`. Under the deny-list, closing this needed an added STRIP
		// entry and a spec edit; under the allow-list it needed a line NOT to be
		// written. That asymmetry is the whole argument for the inversion:
		// the safe outcome became the cheap one.
		const removed = DIRTY_TABLE_ROWS.mod_actions.find(
			(r) => (r as Record<string, unknown>).reason === "content_removed",
		) as Record<string, unknown>;
		const removedCommentId = removed.target_comment_id as string;

		const strippedEvents = stripTable("events", DIRTY_TABLE_ROWS.events, {
			removedCommentIds: new Set([removedCommentId]),
		});

		// CONTROL, and it is load-bearing: the recovery row IS present and IS
		// still a `comment.placed` naming the removed comment. Without this the
		// absence below is equally consistent with "the fixture stopped carrying
		// the row", which is `@test-writer` M-5's shape — an absence asserted
		// over data that could not have produced a presence.
		const recoveryRows = strippedEvents.filter(
			(r) =>
				r.event_type === "comment.placed" &&
				(r.payload as Record<string, unknown>)?.commentId === removedCommentId,
		);
		expect(recoveryRows.length).toBe(1);

		// …and the half that rebuilt the withheld association is gone.
		expect("uploadId" in (recoveryRows[0]?.payload as object)).toBe(false);

		// ⚠ **MY OWN ERROR, corrected in place.** The first version of this
		// assertion scanned the whole stripped `events` table for the withheld
		// FK's VALUE and demanded zero. It found **ten**, and it was the
		// assertion that was wrong, not the pipeline: that FK is an
		// `image_uploads.id`, and §19.4.1 SHIPs it as `uploadId` on every
		// `image_upload.*` event and as their `aggregate_id`. Demanding zero
		// demands the pipeline delete the upload lifecycle.
		//
		// It is the mirror of a mistake DATASET.2 already recorded one field
		// over — a first draft asserting no `commentId` survived anywhere, which
		// would have demanded the comment↔bet join graph be deleted. **What
		// B.6 withholds is the ASSOCIATION, not either id.** So the right
		// assertion is about co-occurrence in one row, and that is the CLASS
		// test below; here the narrow claim is the one that belongs: the
		// recovery row's own payload no longer carries the pair.
		const withheldFk = (
			DIRTY_TABLE_ROWS.comments.find(
				(c) => (c as Record<string, unknown>).id === removedCommentId,
			) as Record<string, unknown>
		).image_uploads_id as string;
		// CONTROL on the needle: it really is a value that exists in the source,
		// so a zero-hit scan is an absence rather than an unread input.
		expect(
			findValues(DIRTY_TABLE_ROWS.comments, new Set([withheldFk])).length,
		).toBeGreaterThan(0);
		// The pair is broken: this row names the removed comment and no upload.
		expect(
			findValues(recoveryRows[0]?.payload, new Set([withheldFk])).length,
		).toBe(0);
		// …while the SOURCE row did carry it, which is what makes the absence a
		// consequence of the transform rather than of the fixture.
		const sourceRecovery = DIRTY_TABLE_ROWS.events.find(
			(r) =>
				(r as Record<string, unknown>).event_type === "comment.placed" &&
				((r as Record<string, unknown>).payload as Record<string, unknown>)
					?.commentId === removedCommentId,
		) as Record<string, unknown>;
		expect(
			findValues(sourceRecovery.payload, new Set([withheldFk])).length,
		).toBe(1);
	});

	it("S5 · the CLASS, not the instance: NO shipped pair rebuilds it", () => {
		// ⚠ Companion to the pin above, and the reason it needs one: that test
		// filters on `event_type === "comment.placed"`, so it watches ONE ROUTE.
		// A second event type shipping the same `commentId` + `uploadId` pair
		// would leave it green while the association became recoverable by a
		// route nobody is looking at.
		//
		// This asserts over EVERY stripped event of every type, so a new route
		// arrives as a failure here rather than as silence. It stays written in
		// both directions: RED if a route is added, and its message says so.
		const removed = DIRTY_TABLE_ROWS.mod_actions.find(
			(r) => (r as Record<string, unknown>).reason === "content_removed",
		) as Record<string, unknown>;
		const removedCommentId = removed.target_comment_id as string;

		const strippedEvents = stripTable("events", DIRTY_TABLE_ROWS.events, {
			removedCommentIds: new Set([removedCommentId]),
		});

		// CONTROL: the scan can find things. Without it, "no routes" is equally
		// consistent with a filter that matches nothing at all.
		expect(
			strippedEvents.filter(
				(r) => findValues(r.payload, new Set([removedCommentId])).length > 0,
			).length,
		).toBeGreaterThan(0);

		// Every surviving payload that names the removed comment AND an upload,
		// whatever key names or nesting it uses.
		const routes = strippedEvents
			.filter((r) => {
				const namesComment = findValues(
					r.payload,
					new Set([removedCommentId]),
				).length;
				const namesUpload = findKeys(r.payload, ["uploadId"]).some(
					(h) => h.value != null,
				);
				return namesComment > 0 && namesUpload;
			})
			.map((r) => String(r.event_type));

		expect(
			routes,
			"a route that rebuilds a removed comment's image association was ADDED — " +
				"ruling S5 closed this class at DATASET.3 and it must stay closed",
		).toEqual([]);
	});

	it("POSITIVE CONTROL — a NON-removed comment still carries its image FK", () => {
		// ⚠ Without this, the test above passes against a pipeline that drops
		// `image_uploads_id` from every comment, or against a fixture where no
		// comment has an image at all — i.e. it could not tell "withheld" from
		// "there was never anything there". This is the control that makes the
		// absence above mean something.
		const removed = DIRTY_TABLE_ROWS.mod_actions.find(
			(r) => (r as Record<string, unknown>).reason === "content_removed",
		) as Record<string, unknown>;
		const removedCommentId = removed.target_comment_id as string;

		const kept = DIRTY_TABLE_ROWS.comments.find(
			(r) =>
				(r as Record<string, unknown>).id !== removedCommentId &&
				(r as Record<string, unknown>).image_uploads_id != null,
		) as Record<string, unknown> | undefined;
		expect(kept).toBeDefined();

		const out = stripTable("comments", DIRTY_TABLE_ROWS.comments, {
			removedCommentIds: new Set([removedCommentId]),
		});
		const keptOut = out.find((r) => r.id === kept?.id);
		expect(keptOut?.image_uploads_id).toBe(kept?.image_uploads_id);
	});
});

describe("L-4 · the PROTOTYPE CHAIN is not a declaration", () => {
	// ⚠ **`@security-auditor` L-4, DATASET.3 — and it shipped with no test.**
	// Both lookups in `strip.ts` were a bare index into an object literal, so
	// every name on `Object.prototype` resolved to something non-`undefined`
	// and was treated as a DECLARATION. Reverting either `Object.hasOwn` guard
	// left this whole export suite green (measured: 387/387, twice).
	//
	// It is unreachable through `events` today — its `event_type` is the closed
	// `EVENT_TYPES` enum and `insertEvent` validates against it — but
	// `PAYLOAD_BEARING_TABLES` deliberately includes `admin_events` and
	// `user_events`, whose `event_type` is open `text` (§7.1), and `strip.ts`'s
	// own docblock anticipates a projection landing there. A guard whose
	// failing shape is one migration away is not hypothetical; it is early.

	it("an event type named `toString` THROWS rather than shipping `{}`", () => {
		// The exact defect: `PAYLOAD_SHIP_KEYS["toString"]` is the inherited
		// function, so `spec !== undefined` held, the throw was skipped, and the
		// whole type exported BLANK payloads — silently, permanently, into an
		// append-only corpus. Blank is the safe direction and still the wrong
		// artifact; that is `completeness.ts`'s entire argument.
		for (const name of ["toString", "valueOf", "constructor", "__proto__"]) {
			expect(
				() => shipPayload(name, { marketId: "m1" }),
				`event_type '${name}' must reach the unknown-type throw`,
			).toThrow(EgressContractGapError);
		}
	});

	it("…and the message names the missing DECLARATION, not the prototype", () => {
		// The operator-facing half: at 06:00 the message has to send them to
		// §19.4.1, not into a lecture on JavaScript.
		let message = "";
		try {
			shipPayload("valueOf", { marketId: "m1" });
		} catch (e) {
			message = (e as Error).message;
		}
		expect(message).toContain("§19.4.1");
		expect(message).toContain("valueOf");
	});

	it("POSITIVE CONTROL — a REAL event type still resolves and ships", () => {
		// Without this, the four throws above are satisfied by a lookup that
		// throws on everything, which would be a total build failure wearing a
		// privacy fix's clothes.
		const out = shipPayload("market.closed", { marketId: "m1" }) as Record<
			string,
			unknown
		>;
		expect(out.marketId).toBe("m1");
	});

	it("a payload KEY named `toString` is dropped, not shipped", () => {
		// The `shipDeep` half. With the bare index, `node["toString"]` resolved
		// to the inherited function and the key survived the filter — shipping a
		// key nobody declared, which is the one outcome the allow-list exists to
		// prevent.
		const out = shipDeep(
			{
				marketId: "m1",
				// A container, so the buggy version emits `toString: {}` rather
				// than throwing on a scalar — i.e. the key SHIPS.
				toString: { leaked: FIXTURE_USER_IDS.amber },
				valueOf: { leaked: FIXTURE_USER_IDS.basalt },
			},
			{ marketId: true },
			"probe",
		) as Record<string, unknown>;

		// ⚠ `Object.hasOwn`, NOT `"toString" in out` — and my first draft of
		// this assertion used `in` and went red, which is the same mistake the
		// production code made one file over. `in` walks the prototype chain, so
		// on any plain object it is TRUE for every inherited method whether or
		// not the strip shipped one. An assertion written that way can only
		// fail, never pass, and would have been "fixed" by deleting it.
		expect(Object.hasOwn(out, "toString")).toBe(false);
		expect(Object.hasOwn(out, "valueOf")).toBe(false);
		// The declared sibling survives, so this is not an emptied object.
		expect(out.marketId).toBe("m1");
		// The whole own-key set, so a third inherited name cannot slip through.
		expect(Object.keys(out).sort()).toEqual(["marketId"]);
	});

	it("…and a SCALAR under such a key does not abort the build either", () => {
		// The other arm, and a different failure. With the bare index, a scalar
		// `toString` reached `shipDeep(value, <function>, …)`, fell past the
		// `true` and array branches, hit `typeof value !== "object"` and THREW —
		// so the same defect that ships a container silently kills the run on a
		// string. One bug, two opposite outcomes, neither of them correct.
		expect(() =>
			shipDeep(
				{ marketId: "m1", toString: "an ordinary string" },
				{ marketId: true },
				"probe",
			),
		).not.toThrow();
	});
});

describe("HIGH-2 · a non-object payload/metadata FAILS CLOSED", () => {
	// ⚠ `@code-reviewer` HIGH-2 measured a genuine fail-OPEN: both strips
	// returned the value unchanged when it was not an object, so a stringified
	// JSONB column walked through **all four guard layers at once** — the
	// strip returned early, the harvest walked a string and collected nothing,
	// `findValues` compared whole leaves against a needle set that no longer
	// contained the secrets, and `findKeys` saw no keys. The reviewer drove a
	// full build in that state: zero violations, zero advisories, and a raw
	// ip, user-agent, `users.id` and admin session id in `events.csv`.
	//
	// These are the direct controls, because the round-trip's byte comparison
	// cannot see it — measured: restoring the passthrough leaves all 21
	// round-trip tests green.

	it("shipPayload THROWS on a stringified payload", () => {
		expect(() =>
			shipPayload(
				"image_upload.committed",
				JSON.stringify({ userId: "x", ip: "203.0.113.7" }),
			),
		).toThrow(/not a\s+JSON object/);
	});

	it("shipPayload THROWS on an array payload", () => {
		expect(() =>
			shipPayload("market.created", [{ key: "u/x/y.webp" }]),
		).toThrow(/not a\s+JSON object/);
	});

	it("stripMetadata THROWS on a stringified metadata", () => {
		expect(() =>
			stripMetadata(JSON.stringify({ ip: "203.0.113.7" }), "events"),
		).toThrow(/not a\s+JSON object/);
	});

	it("POSITIVE CONTROL — a real object still passes, and is stripped", () => {
		// Without this, the three throws above are satisfied by a function that
		// throws on everything.
		const out = shipPayload("image_upload.committed", {
			userId: "x",
			uploadId: "u1",
		}) as Record<string, unknown>;
		expect("userId" in out).toBe(false);
		expect(out.uploadId).toBe("u1");
	});

	it("null and undefined metadata still pass through (not an error)", () => {
		// A genuinely absent JSONB column is not the defect — the defect is a
		// SCALAR standing in for an object. Distinguishing them is the point.
		expect(stripMetadata(null, "events")).toBeNull();
		expect(stripMetadata(undefined, "events")).toBeUndefined();
	});
});

describe("C2 · what the depth work actually bought — measured, not assumed", () => {
	/**
	 * The pre-DATASET.2 one-level strip, applied to a whole payload.
	 *
	 * ⚠ The per-type half is a LITERAL of the historical rule for
	 * `image_upload.committed`, not a read of the live registry. Reading the
	 * registry was correct while it held STRIP keys and became silently wrong
	 * when DATASET.3 inverted it to SHIP keys — the reproduction would have
	 * gone on "working" while removing the keys that ship. A historical
	 * reproduction has to be pinned to history, or it stops reproducing
	 * anything the moment the thing it reproduces is replaced.
	 */
	const HISTORICAL_COMMITTED_STRIP_KEYS = ["userId", "key", "commentId"];
	const oneLevel = (_eventType: string, payload: Record<string, unknown>) => {
		const forbidden = new Set<string>([
			...HISTORICAL_COMMITTED_STRIP_KEYS,
			...GLOBALLY_FORBIDDEN_PAYLOAD_KEYS,
		]);
		const out: Record<string, unknown> = {};
		for (const [k, v] of Object.entries(payload)) {
			if (forbidden.has(k)) continue;
			out[k] = v;
		}
		return out;
	};

	it("the fixture's nested dirt IS key-matched — the shallow build ABORTS, it does not ship", () => {
		// ⚠⚠ **This corrects the claim at the top of this file.** The docblock
		// says of the pre-DATASET.2 state: *"Both layers fell silent on the same
		// input and the build reported success."* Measured against the fixture's
		// own nested dirt, that is FALSE — and the reason is `walk`, which has
		// been recursive since DATASET.1 and which BOTH key nets ride on.
		//
		// Every nested key this fixture carries (`userId`, `ip`, `key`) is on
		// `GLOBALLY_FORBIDDEN_PAYLOAD_KEYS` or `STRIPPED_METADATA_KEYS`, so
		// `findKeys` reaches all three at depth regardless of what the strip did.
		// The pre-fix outcome is therefore a **fatal egress violation** — a
		// one-shot release build that dies — not a silent publication.
		//
		// That does not make the depth work unnecessary; it makes it a different
		// fix than the one the docblock claims. It converts a guaranteed build
		// ABORT into a clean build, which on the morning of 6 November is worth
		// at least as much. But a test suite that certifies "the leak was
		// silent" over data that would have screamed is certifying the wrong
		// property, and the genuinely silent case is pinned in the next test.
		const shallowRow = {
			...COMMITTED,
			payload: oneLevel("image_upload.committed", COMMITTED.payload as never),
			metadata: stripMetadata(COMMITTED.metadata, "events"),
		};

		const hits = findKeys(
			[shallowRow],
			[...GLOBALLY_FORBIDDEN_PAYLOAD_KEYS, ...STRIPPED_METADATA_KEYS],
		);
		expect(hits.map((h) => h.path)).toEqual([
			"[0].payload.context.userId",
			"[0].payload.context.ip",
			"[0].payload.variants[0].key",
		]);

		// …and the full guard turns each one into a FATAL violation, even when
		// handed a secret set harvested as shallowly as the strip walked (so the
		// value classes are blind to all three, exactly as the docblock says).
		const shallowSecrets = {
			...harvestSecrets(DIRTY_TABLE_ROWS as never),
			ips: new Set<string>(),
			r2ObjectKeys: new Set<string>(),
			userIds: new Set<string>(),
		};
		let caught: unknown;
		try {
			assertTableClean("events", [shallowRow], shallowSecrets);
		} catch (e) {
			caught = e;
		}
		expect(caught).toBeInstanceOf(EgressViolationError);
		expect(
			(caught as EgressViolationError).violations.map(
				(v) => `${v.rule} @ ${v.path}`,
			),
		).toEqual([
			// `ip` is on BOTH key nets, so the nested one trips each of them —
			// which is a second, independent reason the shallow state could never
			// have been quiet.
			"no-stripped-metadata-key @ [0].payload.context.ip",
			"no-forbidden-payload-key @ [0].payload.context.userId",
			"no-forbidden-payload-key @ [0].payload.context.ip",
			"no-forbidden-payload-key @ [0].payload.variants[0].key",
		]);
	});

	it("DATASET.2 owed E, CLOSED — a nested secret under an UNLISTED key is now dropped", () => {
		// ⚠⚠ **This test was the run's loudest tripwire and it has fired.** Its
		// DATASET.2 form ended `expect(JSON.stringify(out)).toContain(UNSEEN_IP)`
		// — asserting that an IP under a key nobody listed reached the emitted
		// bytes with all four guard layers reporting clean:
		//
		//   · not STRIPPED    — the key was on no §19.4.1 rule and on no global net
		//   · not HARVESTED   — `HARVEST_KEYS` has no entry for that spelling
		//   · not VALUE-matched — because the harvest never collected it
		//   · not KEY-matched — the key was on neither net
		//
		// Its own note said closing it *"means either a value-shaped net over
		// payload leaves or a positive allow-list of shipped payload keys per
		// event type, and both are spec decisions."* The second one was ruled
		// (E) and built at DATASET.3, so the assertion inverts to `not.toContain`.
		//
		// ⚠ **Nothing here names `client` or `remoteAddr`, and that is the
		// point.** The three previous fixes for this class each added a name to
		// a list, which closed one member and left the class open. This closes
		// it by never consulting a list of forbidden names at all: `client` is
		// dropped for not being declared, exactly as `wibble` or `trace` or
		// whatever the next author writes would be.
		const UNSEEN_IP = "198.51.100.77"; // RFC 5737 TEST-NET-2 — nowhere else
		const probeRow = {
			event_id: "0192f3a4-0fff-7000-8000-00000000ee01",
			event_type: "bet.placed",
			aggregate_type: "bet",
			aggregate_id: "0192f3a4-dddd-7000-8000-00000000be01",
			payload: {
				userId: FIXTURE_USER_IDS.amber,
				marketId: "0192f3a4-cccc-7000-8000-000000000001",
				side: "YES",
				stake: "25.000000000000000000",
				price: "0.500000000000000000",
				// The unlisted nested key. `client` is on no list; neither is
				// `remoteAddr`. A future event-type author adding request context
				// writes exactly this and violates nothing they were told about.
				client: { remoteAddr: UNSEEN_IP },
			},
			payload_version: 1,
			metadata: (DIRTY_TABLE_ROWS.events[0] as Record<string, unknown>)
				.metadata,
			created_at: "2026-10-01T12:00:00.000Z",
		};

		// Control: the probe value really is absent from the rest of the fixture,
		// so nothing else can put it into the secret set.
		expect(findValues(DIRTY_TABLE_ROWS, new Set([UNSEEN_IP])).length).toBe(0);

		const secrets = harvestSecrets({
			...DIRTY_TABLE_ROWS,
			events: [...DIRTY_TABLE_ROWS.events, probeRow],
		} as never);
		// ⚠ STILL not harvested, and that is deliberately left alone. The
		// harvest reads key NAMES and `remoteAddr` is not one it knows — so the
		// value scan is still blind here and always will be for a novel
		// spelling. What changed is that the value never survives the transform
		// to be scanned for. Recording it keeps the two claims apart: the leak
		// is closed by the STRIP, not by the guard.
		expect(secrets.ips.has(UNSEEN_IP)).toBe(false);

		const stripped = stripRow("events", probeRow as never, {
			removedCommentIds: new Set<string>(),
		});
		const out = pseudonymizeTable(
			"events",
			[stripped],
			buildPseudonymMap(DIRTY_TABLE_ROWS.users),
		);

		// The guard still passes — it was never the thing that could see this.
		expect(() => assertTableClean("events", out, secrets)).not.toThrow();
		// …and the ip is NOT in the bytes that would be written. This is the
		// line that inverted.
		expect(JSON.stringify(out)).not.toContain(UNSEEN_IP);
		expect(
			"client" in ((out[0] as Record<string, unknown>).payload as object),
		).toBe(false);

		// POSITIVE CONTROL — the row is not simply empty. A declared research
		// key on the same payload survives, so "the ip is absent" is a statement
		// about the ip and not about a payload the transform deleted.
		expect(
			((out[0] as Record<string, unknown>).payload as Record<string, unknown>)
				.stake,
		).toBe("25.000000000000000000");
	});
});

describe("C2/C3 · the whole dirty fixture still passes the egress guard", () => {
	it("events survive assertTableClean after strip + pseudonymize", () => {
		// ⚠ BOTH passes, and my first version of this ran only the strip —
		// which failed with two `no-admin-session-id` violations and looked
		// like a C2 defect. It was not: `admin_session` aggregate_ids are
		// redacted by the PSEUDONYMIZE pass (R2), not the strip. Running half
		// the pipeline and asserting the whole contract is its own error, and
		// the honest end-to-end is the one that runs what the build runs.
		const secrets = harvestSecrets(DIRTY_TABLE_ROWS as never);
		const map = buildPseudonymMap(DIRTY_TABLE_ROWS.users);
		const stripped = stripTable("events", DIRTY_TABLE_ROWS.events, {
			removedCommentIds: new Set<string>(),
		});
		const out = pseudonymizeTable("events", stripped, map);

		// The m/ key is still there to be judged…
		expect(findValues(out, new Set([M_KEY])).length).toBeGreaterThan(0);
		// …and the guard permits it, while the u/ keys and the nested ip are
		// gone. If `shipsDespiteForbiddenKey` were dropped from the strip, the
		// first assertion fails; if the strip stopped being recursive, this
		// one does.
		expect(() => assertTableClean("events", out, secrets)).not.toThrow();
	});
});
