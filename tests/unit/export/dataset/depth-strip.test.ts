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
	stripPayload,
	stripTable,
} from "@/server/export/dataset/strip";
import { assertTableClean } from "@/server/export/egress";
import { PAYLOAD_STRIP_KEYS } from "@/server/export/egress/forbidden-keys";
import { findKeys, findValues } from "@/server/export/egress/scan";

/**
 * DATASET.2 C2 + C3 — the depth guards.
 *
 * ## What these exist to reject
 *
 * `stripPayload` / `stripMetadata` walked ONE level until DATASET.2, and the
 * harvest that feeds the value scan walked one level with them. That pairing
 * is the reason the gap was invisible rather than merely open: a nested secret
 * was neither stripped NOR harvested, so the scan was never told to look for
 * the value the strip had just failed to remove. **Both layers fell silent on
 * the same input and the build reported success.**
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
