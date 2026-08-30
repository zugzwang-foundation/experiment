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
	stripDeep,
	stripMetadata,
	stripPayload,
	stripRow,
	stripTable,
} from "@/server/export/dataset/strip";
import { assertTableClean } from "@/server/export/egress";
import { EgressViolationError } from "@/server/export/egress/errors";
import {
	GLOBALLY_FORBIDDEN_PAYLOAD_KEYS,
	PAYLOAD_STRIP_KEYS,
	STRIPPED_METADATA_KEYS,
} from "@/server/export/egress/forbidden-keys";
import { findKeys, findValues, walk } from "@/server/export/egress/scan";

/**
 * DATASET.2 C2 + C3 — the depth guards.
 *
 * ## What these exist to reject
 *
 * `stripPayload` / `stripMetadata` walked ONE level until DATASET.2, and the
 * harvest that feeds the value scan walked one level with them.
 *
 * ⚠ **CORRECTED (`@test-writer` HIGH-1), because this docblock previously
 * claimed something measurably false.** It said *"both layers fell silent on
 * the same input and the build reported success"*. They did not. `walk()` has
 * been recursive since DATASET.1 and **both KEY nets ride on it**, so
 * `findKeys` reached nested keys regardless of what the strip did — and every
 * nested key this fixture carries (`userId`, `ip`, `key`) is on
 * `GLOBALLY_FORBIDDEN_PAYLOAD_KEYS` or `STRIPPED_METADATA_KEYS`.
 *
 * Measured, by reproducing the one-level strip and running the guard over it:
 * **8 fatal violations, not silence** — `no-stripped-metadata-key` and
 * `no-forbidden-payload-key` on `payload.context.{ip,userId}`, plus
 * `no-forbidden-payload-key` on `payload.variants[0].key`.
 *
 * ⇒ The shallow strip was a **guaranteed build ABORT on a one-shot job**, not
 * a silent leak. That is still worth fixing — an abort at 06:00 on release
 * morning costs what a leak costs, in a different currency — but it is a
 * different claim, and the suite should certify the one that is true.
 *
 * **The genuinely silent class is narrower, and it is STILL OPEN**: a nested
 * secret under a key name on NO list (`payload.client.remoteAddr`) is
 * unstripped, unharvested, unmatched by value (because it was never
 * harvested) and unmatched by key. Recursion does not touch it. Pinned as
 * `⛔ KNOWN OPEN` below.
 *
 * Every test below is written so that reverting the fix it guards turns it
 * RED. The mutation table is in the run report; the point of writing them this
 * way is that "it passes" is only evidence if "it can fail" was demonstrated.
 *
 * ## The fixture rows these lean on
 *
 * `image_upload.committed.payload` carries the deliberate nested dirt —
 * `context.{userId,ip}` (depth 2, object), `variants[0].key` (depth 2, through
 * an ARRAY, `u/`-namespaced so it must be stripped) and `commentId` (C3).
 * `market.created.payload.media[0].key` is its opposite number: also depth 2
 * through an array, but `m/`-namespaced, so it must SURVIVE.
 *
 * Both directions are pinned deliberately. A rule that strips everything it
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

describe("C2 · GUARD 1 — a nested STRIP key at depth 2 is removed", () => {
	it("strips payload.context.userId and payload.context.ip", () => {
		const out = stripPayload(
			"image_upload.committed",
			COMMITTED.payload,
		) as Record<string, unknown>;

		// The container survives — depth is about keys, not about deleting
		// whole subtrees. A strip that removed `context` wholesale would pass
		// a naive "is the secret gone" check while destroying shipped data.
		expect(out.context).toBeTypeOf("object");
		const ctx = out.context as Record<string, unknown>;
		expect("userId" in ctx).toBe(false);
		expect("ip" in ctx).toBe(false);
	});

	it("REJECTS the wrong answer: a one-level walk leaves both in place", () => {
		// The pre-DATASET.2 implementation, reproduced exactly. This is the
		// mutation the guard above exists to catch, run as code so the claim
		// is measured rather than asserted in a comment.
		const oneLevel = (payload: Record<string, unknown>) => {
			const forbidden = new Set<string>(
				PAYLOAD_STRIP_KEYS["image_upload.committed"],
			);
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
	// file docblock names `stripPayload` / `stripMetadata` together, and
	// `stripMetadata` genuinely changed — it delegates to `stripDeep` now. But
	// every metadata fixture in the suite is the flat §3.7 seven-field object,
	// so reverting `stripMetadata` alone to a one-level walk left the entire
	// suite green: `transform.test.ts:175` passes a flat object and this file's
	// three `stripMetadata` cases are all HIGH-2 fail-closed checks on scalars.
	//
	// Metadata nests in practice more readily than payloads do — a `context`,
	// a `headers`, a `trace` block is the ordinary shape of request metadata —
	// and §19.4/Appendix B.23 say `ip` and `user_agent` never ship from any
	// audit table, not that they never ship from the top level of one.

	it("removes a nested ip / user_agent from metadata at depth 2", () => {
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

		const ctx = out.context as Record<string, unknown>;
		expect("ip" in ctx).toBe(false);
		expect("user_agent" in ctx).toBe(false);
		// Targeted: the container and its innocent sibling survive.
		expect(ctx.region).toBe("bom1");
		expect(out.request_id).toBe("req_1");
	});

	it("removes them through an ARRAY inside metadata", () => {
		const out = stripMetadata(
			{ request_id: "req_1", hops: [{ ip: IP_NESTED, seq: 1 }] },
			"events",
		) as Record<string, unknown>;
		const hops = out.hops as Record<string, unknown>[];
		expect(Array.isArray(hops)).toBe(true);
		expect("ip" in (hops[0] ?? {})).toBe(false);
		expect(hops[0]?.seq).toBe(1);
	});

	it("REJECTS the wrong answer: a one-level metadata walk leaves both in place", () => {
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

describe("C2 · GUARD 3 — depth works THROUGH arrays", () => {
	it("strips variants[].key, which is u/-namespaced", () => {
		const out = stripPayload(
			"image_upload.committed",
			COMMITTED.payload,
		) as Record<string, unknown>;
		const variants = out.variants as Record<string, unknown>[];
		expect(Array.isArray(variants)).toBe(true);
		// The element and its non-forbidden siblings survive; only the key goes.
		expect(variants[0]?.width).toBe(800);
		expect("key" in (variants[0] ?? {})).toBe(false);
	});

	it("REJECTS the wrong answer: object-depth only, arrays not descended", () => {
		// A recursion that handles objects but returns arrays untouched. It
		// passes GUARD 1 completely and fails only here.
		const objectsOnly = (
			v: unknown,
			forbidden: ReadonlySet<string>,
		): unknown => {
			if (v === null || typeof v !== "object") return v;
			if (Array.isArray(v)) return v; // ← the defect
			const out: Record<string, unknown> = {};
			for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
				if (forbidden.has(k)) continue;
				out[k] = objectsOnly(val, forbidden);
			}
			return out;
		};
		const broken = objectsOnly(
			COMMITTED.payload,
			new Set<string>(PAYLOAD_STRIP_KEYS["image_upload.committed"]),
		) as Record<string, unknown>;
		expect((broken.variants as Record<string, unknown>[])[0]?.key).toBe(
			R2_NESTED,
		);
	});
});

describe("C2 · GUARD 4 — the m/ namespace SURVIVES the recursive strip", () => {
	it("market.created.payload.media[].key still ships", () => {
		// ⚠ `@security-auditor` H-1 was a GUARANTEED TOTAL BUILD FAILURE:
		// `key` is `.min(1)` in schemas.ts, so every real market carries one,
		// and §19.4.1 SHIPs it. Recursion is what puts it in the strip's reach
		// for the first time, so this is the test most likely to be the one
		// that fails if the namespace predicate is dropped.
		const out = stripPayload(
			"market.created",
			MARKET_CREATED.payload,
		) as Record<string, unknown>;
		const media = out.media as Record<string, unknown>[];
		expect(media[0]?.key).toBe(M_KEY);
		expect(media[0]?.displayOrder).toBe(0);
	});

	it("but a u/ key under the SAME key name, same depth, is stripped", () => {
		// The pair is the point: same key name, same nesting shape, opposite
		// outcomes decided by the value's namespace and nothing else. A test
		// that only asserted survival would pass against a strip that had been
		// disabled entirely.
		const out = stripDeep(
			{ media: [{ key: `u/${FIXTURE_USER_IDS.amber}/x.webp` }] },
			new Set(["key"]),
		) as Record<string, unknown>;
		expect("key" in ((out.media as Record<string, unknown>[])[0] ?? {})).toBe(
			false,
		);
	});
});

describe("C3 · image_upload.committed.payload.commentId is stripped", () => {
	it("removes commentId unconditionally", () => {
		const out = stripPayload(
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

	it("⛔ KNOWN OPEN — comment.placed still rebuilds the association", () => {
		// ⚠⚠ **THIS TEST PINS A LEAK THAT IS STILL OPEN. It is not a passing
		// guard; it is a tripwire.** When the ruling lands and the route is
		// closed, this goes RED and must be inverted — which is the point of
		// asserting it rather than only writing it in a report.
		//
		// C3 as ratified strips `commentId` from `image_upload.committed`,
		// reasoning that "leaving a recovery path that rebuilds exactly the
		// link R1 withholds is incoherent." Measured: **the ruling does not
		// achieve that.** `comment.placed`'s payload declares BOTH `commentId`
		// and `uploadId`; §19.4.1 strips only `userId` from it and explicitly
		// names `uploadId` a shipped research key. Every comment emits one, so
		// for a removed comment with an image the pair reconstructs the
		// association in ONE row, with no join at all — a shorter path than the
		// one C3 closed.
		//
		// Not fixed here, deliberately. Stripping `uploadId` from
		// `comment.placed` deletes a key §19.4.1 says ships, which is a spec
		// edit outside this task's E1–E7 fence; and stripping it only for
		// removed comments is the conditional-strip-leaks-the-condition
		// failure C3's own reasoning rejects. It needs the same kind of ruling
		// R1 and C3 got.
		const removed = DIRTY_TABLE_ROWS.mod_actions.find(
			(r) => (r as Record<string, unknown>).reason === "content_removed",
		) as Record<string, unknown>;
		const removedCommentId = removed.target_comment_id as string;

		const strippedEvents = stripTable("events", DIRTY_TABLE_ROWS.events, {
			removedCommentIds: new Set([removedCommentId]),
		});

		const leaking = strippedEvents.filter(
			(r) =>
				r.event_type === "comment.placed" &&
				(r.payload as Record<string, unknown>)?.commentId ===
					removedCommentId &&
				(r.payload as Record<string, unknown>)?.uploadId != null,
		);
		expect(leaking.length).toBe(1);

		// And the value it exposes is exactly the FK the comments arm withheld.
		const withheldFk = (
			DIRTY_TABLE_ROWS.comments.find(
				(c) => (c as Record<string, unknown>).id === removedCommentId,
			) as Record<string, unknown>
		).image_uploads_id;
		expect((leaking[0]?.payload as Record<string, unknown>).uploadId).toBe(
			withheldFk,
		);
	});

	it("⛔ KNOWN OPEN — the CLASS, not the instance: any shipped pair rebuilds it", () => {
		// ⚠ Companion to the pin above, and the reason it needs one: that test
		// filters on `event_type === "comment.placed"` and asserts the count is
		// exactly 1, so it watches ONE ROUTE and one fixture row. A second event
		// type shipping the same `commentId` + `uploadId` pair — or a second
		// recovery row — leaves it green at 1 while the association becomes
		// recoverable by a route nobody is looking at.
		//
		// This asserts over EVERY stripped event of every type, so a new route
		// arrives as a failure here rather than as silence. It is written to go
		// RED in both directions: RED when the known route is closed (good news,
		// invert it), and RED when a new one opens (bad news, close it).
		const removed = DIRTY_TABLE_ROWS.mod_actions.find(
			(r) => (r as Record<string, unknown>).reason === "content_removed",
		) as Record<string, unknown>;
		const removedCommentId = removed.target_comment_id as string;

		const strippedEvents = stripTable("events", DIRTY_TABLE_ROWS.events, {
			removedCommentIds: new Set([removedCommentId]),
		});

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
			"a route that rebuilds a removed comment's image association changed — " +
				"if a route was CLOSED this is good news and the pin should be " +
				"inverted; if a route was ADDED, close it",
		).toEqual(["comment.placed"]);
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

	it("stripPayload THROWS on a stringified payload", () => {
		expect(() =>
			stripPayload(
				"image_upload.committed",
				JSON.stringify({ userId: "x", ip: "203.0.113.7" }),
			),
		).toThrow(/not a\s+JSON object/);
	});

	it("stripPayload THROWS on an array payload", () => {
		expect(() =>
			stripPayload("market.created", [{ key: "u/x/y.webp" }]),
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
		const out = stripPayload("image_upload.committed", {
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
	/** The pre-DATASET.2 one-level strip, applied to a whole payload. */
	const oneLevel = (eventType: string, payload: Record<string, unknown>) => {
		const forbidden = new Set<string>([
			...((PAYLOAD_STRIP_KEYS as Record<string, readonly string[]>)[
				eventType
			] ?? []),
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

	it("⛔ KNOWN OPEN — a nested secret under an UNLISTED key IS silent, and depth does not close it", () => {
		// ⚠⚠ **THIS PINS AN OPEN LEAK. It is a tripwire, not a passing guard.**
		//
		// The genuinely silent case, which the fixture does not model and which
		// recursion cannot reach: depth made the strip walk to any level, but the
		// strip still only removes keys it was NAMED. A payload nesting a secret
		// under a key nobody listed is:
		//
		//   · not STRIPPED    — the key is on no §19.4.1 rule and on no global net
		//   · not HARVESTED   — `HARVEST_KEYS` has no entry for that spelling
		//   · not VALUE-matched — because the harvest never collected it
		//   · not KEY-matched — the key is on neither net
		//
		// Four layers, four different reasons to stay quiet, and the build
		// reports success. That is the shape the file docblock attributes to the
		// pre-DATASET.2 shallow strip; it is in fact the shape of what remains
		// AFTER the depth fix.
		//
		// `HARVEST_KEYS`'s own docblock reaches for the completeness guard as the
		// backstop — *"the completeness guard over §19.4.1 is what keeps that from
		// being silent"* — but that guard asserts every event TYPE has a rule, not
		// that every KEY in a payload is covered by one. Adding a nested key to an
		// existing type's payload passes it untouched.
		//
		// Not closable in the test layer. Closing it means either a value-shaped
		// net (an IP/UA/email regex over payload leaves) or a positive allow-list
		// of shipped payload keys per event type, and both are spec decisions.
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
		expect(secrets.ips.has(UNSEEN_IP)).toBe(false); // never harvested

		const stripped = stripRow("events", probeRow as never, {
			removedCommentIds: new Set<string>(),
		});
		const out = pseudonymizeTable(
			"events",
			[stripped],
			buildPseudonymMap(DIRTY_TABLE_ROWS.users),
		);

		// The guard passes…
		expect(() => assertTableClean("events", out, secrets)).not.toThrow();
		// …and the ip is in the bytes that would be written.
		expect(JSON.stringify(out)).toContain(UNSEEN_IP);
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
