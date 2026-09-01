import { describe, expect, it } from "vitest";
import { z } from "zod";

import { EVENT_TYPES } from "@/server/events/event-types";
import { eventPayloadSchemas } from "@/server/events/schemas";
import {
	PAYLOAD_SHIP_KEYS,
	type ShipNode,
	type ShipSpec,
} from "@/server/export/egress/forbidden-keys";

/**
 * DATASET.3 Slice 1 · **the assertion the byte comparison cannot make.**
 *
 * ## Why this file exists
 *
 * The inversion's headline proof is a byte comparison of the emitted archive
 * before and after — build with the deny-list, build with the allow-list,
 * compare `content_sha256`. That comparison is real and it did fire (three
 * attributable deltas, recorded in the run report). But it is **blind to every
 * payload key the fixture does not carry**, and the fixture carries a minority
 * of them: `etag`, `byteSizeActual`, `seedAmount`, `winningSide`,
 * `poolUnwindAmount`, `correctsEventId`, `voidReason`, `resolutionNote`,
 * `creditedForDate`, `provider`, `pfpFilename`, `contentType`, `byteSize`,
 * `modVerdict`, `reasonCategory`, `shares`, `parentCommentId` and more are
 * declared by `schemas.ts` and appear on no fixture row. A build comparison
 * says nothing whatever about any of them.
 *
 * DATASET.2 learned this shape the expensive way one layer over: canonical JSON
 * made both sides of the round-trip sort their keys, so the byte comparison was
 * **structurally unable to see a jsonb shape change** and stayed green with the
 * defect restored. *"A fix whose test cannot fail is half a fix."* The same
 * trap is open here, wearing different clothes: not "both sides normalise" but
 * "neither side contains the thing under test."
 *
 * ⇒ This file compares the SHIP declaration against `eventPayloadSchemas` — the
 * Zod payload shapes every emit site validates against, which is the only
 * exhaustive statement of what a payload can hold. It can fail on a key no
 * fixture row has ever carried, which is precisely what the byte comparison
 * cannot do.
 *
 * ## Why it is a test and not a compile check
 *
 * `PAYLOAD_SHIP_KEYS` is `satisfies Record<EventType, ShipSpec>`, so a missing
 * event TYPE is a compile error. There is no equivalent for a missing KEY,
 * because `schemas.ts` imports `server-only` and `src/server/export/**` must
 * stay loadable by `tsx` — `scripts/build-dataset.ts` is the only thing that
 * ever runs the release pipeline, and AGENTS.md §7 makes that import fatal
 * there. A test runs under Vitest's `server-only` shim and has no such
 * constraint. Stated so the missing `satisfies` reads as a decision rather
 * than as an oversight.
 *
 * ## The partition, and why DROPPED is written down
 *
 * Every schema key must be either SHIPPED (named in `PAYLOAD_SHIP_KEYS`) or
 * DROPPED (named below, with its reason). A key in neither is the defect —
 * and it is the defect whether or not any fixture carries it, whether or not
 * it nests, and whatever it is called.
 *
 * ⚠ Writing DROPPED down is deliberate and is the opposite of a second
 * declaration of the strip. It is a **review artifact**: nothing reads it at
 * runtime, and its only job is that adding a key to a Zod schema without
 * deciding what happens to it produces a RED test naming that key. Under the
 * old deny-list the same act produced a silent publication; the whole change
 * is that the default moved from "ships" to "somebody has to say".
 */

/** Every key path a Zod payload schema can produce, as dotted paths. */
function schemaKeyPaths(schema: z.ZodTypeAny, prefix = ""): string[] {
	// Unwrap the modifiers `schemas.ts` actually uses. Deliberately explicit
	// rather than a catch-all `_def.innerType` probe: an unrecognised wrapper
	// should surface as a missing key (a RED test) rather than be silently
	// walked through by a heuristic that happens to fit.
	if (schema instanceof z.ZodNullable || schema instanceof z.ZodOptional) {
		return schemaKeyPaths(schema.unwrap() as z.ZodTypeAny, prefix);
	}
	if (schema instanceof z.ZodArray) {
		return schemaKeyPaths(schema.element as z.ZodTypeAny, prefix);
	}
	if (schema instanceof z.ZodObject) {
		const shape = schema.shape as Record<string, z.ZodTypeAny>;
		return Object.entries(shape).flatMap(([k, v]) =>
			schemaKeyPaths(v, prefix ? `${prefix}.${k}` : k),
		);
	}
	// A leaf.
	return prefix ? [prefix] : [];
}

/** Every key path a SHIP declaration names, as dotted paths. */
function shipKeyPaths(node: ShipNode, prefix = ""): string[] {
	if (node === true) return prefix ? [prefix] : [];
	return Object.entries(node).flatMap(([k, v]) =>
		shipKeyPaths(v, prefix ? `${prefix}.${k}` : k),
	);
}

/**
 * Keys `schemas.ts` declares that the dataset deliberately does NOT ship, with
 * the reason. **Nothing reads this at runtime.** Its whole purpose is that a
 * new schema key has to arrive here or in `PAYLOAD_SHIP_KEYS`, and cannot
 * arrive in neither.
 */
const DELIBERATELY_DROPPED: Readonly<Record<string, string>> = {
	// — the actor's identity, on every type that carries it —
	"user.tos_accepted.userId": "raw users.id; §19.5 pseudonymizes aggregate_id",
	"user.oauth_signed_in.userId": "raw users.id",
	"user.otp_signed_in.userId": "raw users.id",
	"user.pseudonym_assigned.userId": "raw users.id",
	"user.signed_out.userId": "raw users.id",
	"image_upload.sign_requested.userId": "raw users.id",
	"image_upload.committed.userId": "raw users.id",
	"image_upload.blocked.userId": "raw users.id",
	"moderation.blocked.userId": "raw users.id",
	"dharma.credited.userId": "raw users.id",
	"dharma.granted.userId": "raw users.id",
	"bet.placed.userId": "raw users.id",
	"bet.sold.userId": "raw users.id",
	"comment.placed.userId": "raw users.id",

	// — PII per §19.4 —
	"user.tos_accepted.ip": "PII, §19.4 rows 5–6; the users column is STRIP too",
	"user.tos_accepted.userAgent": "PII, §19.4 rows 5–6",
	"user.oauth_signed_in.googleId": "mirrors the users.google_id STRIP (B.1)",
	"user.otp_signed_in.email": "mirrors the users.email STRIP (B.1)",
	"admin.signed_in.ip": "the admin's IP",

	// — credentials and object keys —
	"admin.signed_in.sessionId":
		"the admin session cookie value; B.13 redacts the same value one field over",
	"admin.signed_out.sessionId": "the admin session cookie value",
	"image_upload.sign_requested.key":
		"an R2 object key in the u/ namespace, which embeds the userId (SCAFFOLD.15 §Q9)",
	"image_upload.committed.key": "an R2 object key in the u/ namespace",
	"image_upload.orphaned.key": "an R2 object key in the u/ namespace",

	// — the association Appendix B.6 withholds —
	"image_upload.committed.commentId":
		"rebuilds the comment↔upload link B.6 withholds on removal (DATASET.2 C3)",
	"comment.placed.uploadId":
		"the other half of that pair — ruling S5, DATASET.3. This payload carries commentId too, so shipping uploadId rebuilds the withheld association in ONE row with no join. comments.image_uploads_id already carries it for every comment that is not withheld",

	// — no research value —
	"user.oauth_signed_in.provider":
		"the literal 'google' on every row; carries no signal and was never ratified as shipped — it shipped under the deny-list only because nobody had named it",
};

describe("§19.4.1 · every declared payload key is CLASSIFIED", () => {
	it("the schema registry and the SHIP registry cover the same event types", () => {
		// Control on the pairing itself. Everything below iterates one against
		// the other, so a type present in one and absent from the other would
		// make the whole file quietly cover less than it claims.
		expect(Object.keys(eventPayloadSchemas).sort()).toEqual(
			[...EVENT_TYPES].sort(),
		);
		expect(Object.keys(PAYLOAD_SHIP_KEYS).sort()).toEqual(
			[...EVENT_TYPES].sort(),
		);
	});

	it("POSITIVE CONTROL — the extractor finds real nested and array keys", () => {
		// ⚠ Without this the partition assertions below are satisfied by an
		// extractor that returns nothing: every schema key would be trivially
		// "covered", the DROPPED map would be entirely phantom, and the file
		// would pass while measuring an empty set. That is `@test-writer` M-5's
		// shape — a positive control harvesting from empty arrays — and it is
		// the failure mode this whole file exists to avoid one layer up.
		const created = schemaKeyPaths(eventPayloadSchemas["market.created"]);
		// A scalar, a nullable scalar, and three keys reached THROUGH an array.
		expect(created).toContain("marketId");
		expect(created).toContain("mediaVideoUrl");
		expect(created).toContain("media.key");
		expect(created).toContain("media.displayOrder");
		expect(created).toContain("media.isDefault");
		// And a plain type still yields its keys.
		expect(schemaKeyPaths(eventPayloadSchemas["bet.sold"]).sort()).toEqual([
			"betId",
			"marketId",
			"price",
			"proceeds",
			"sharesSold",
			"side",
			"userId",
		]);
	});

	it("EVERY schema key is either SHIPPED or DELIBERATELY DROPPED", () => {
		// ⚠ **This is the assertion the byte comparison cannot make.** It fires
		// on a key no fixture row carries, which is most of them.
		const unclassified: string[] = [];
		for (const t of EVENT_TYPES) {
			const schemaKeys = schemaKeyPaths(eventPayloadSchemas[t]);
			const shipped = new Set(shipKeyPaths(PAYLOAD_SHIP_KEYS[t] as ShipSpec));
			for (const k of schemaKeys) {
				if (shipped.has(k)) continue;
				if (`${t}.${k}` in DELIBERATELY_DROPPED) continue;
				unclassified.push(`${t}.${k}`);
			}
		}
		expect(
			unclassified,
			"a payload key exists in schemas.ts that is neither declared shipped " +
				"in PAYLOAD_SHIP_KEYS nor recorded as deliberately dropped. Under " +
				"the allow-list it will silently NOT ship, which is the safe " +
				"direction and still a decision nobody made — decide it, and amend " +
				"SPEC.2 §19.4.1 in the same commit",
		).toEqual([]);
	});

	it("EVERY shipped key exists in the schema — no phantom declarations", () => {
		// The other direction. A declaration naming a key no payload can hold is
		// not dangerous, but it means the table has drifted from the emit sites,
		// and a table that is wrong somewhere is a table nobody can rely on
		// anywhere — the same argument `assertTreatmentsComplete` makes about
		// phantom columns.
		const phantoms: string[] = [];
		for (const t of EVENT_TYPES) {
			const schemaKeys = new Set(schemaKeyPaths(eventPayloadSchemas[t]));
			for (const k of shipKeyPaths(PAYLOAD_SHIP_KEYS[t] as ShipSpec)) {
				if (!schemaKeys.has(k)) phantoms.push(`${t}.${k}`);
			}
		}
		expect(phantoms).toEqual([]);
	});

	it("EVERY dropped entry names a key that exists — no phantom drops either", () => {
		// ⚠ A phantom DROPPED entry is the quiet failure of this whole file: it
		// reads as coverage and provides none, and it is exactly how the
		// unclassified check above would be silenced by someone pasting a name
		// rather than fixing a schema. `FREE_TEXT_COLUMNS` already carried one
		// of these — `resolution_note`, a column no shipped table has
		// (`@security-auditor` L-5) — so the shape has a precedent in this
		// codebase.
		const phantomDrops: string[] = [];
		for (const path of Object.keys(DELIBERATELY_DROPPED)) {
			const found = EVENT_TYPES.some((t) => {
				if (!path.startsWith(`${t}.`)) return false;
				const key = path.slice(t.length + 1);
				return schemaKeyPaths(eventPayloadSchemas[t]).includes(key);
			});
			if (!found) phantomDrops.push(path);
		}
		expect(phantomDrops).toEqual([]);
	});

	it("THE WRONG ANSWER — a new schema key with no decision is detected", () => {
		// The control that proves the partition check can fail. The live
		// registries agree today, so a test that could only compare the real
		// pair would assert emptiness against data with no gap, passing
		// identically whether the comparison works or always returns empty
		// (OVN-V3). This constructs the gap.
		const withNewKey = eventPayloadSchemas["bet.placed"].extend({
			clientContext: z.object({ remoteAddr: z.string() }),
		});
		const schemaKeys = schemaKeyPaths(withNewKey);
		const shipped = new Set(
			shipKeyPaths(PAYLOAD_SHIP_KEYS["bet.placed"] as ShipSpec),
		);
		const unclassified = schemaKeys.filter(
			(k) => !shipped.has(k) && !(`bet.placed.${k}` in DELIBERATELY_DROPPED),
		);
		expect(unclassified).toEqual(["clientContext.remoteAddr"]);
	});

	it("no event type ships a key whose NAME is on the output forbidden net", () => {
		// ⚠ Cross-check between the two registries that are now independent.
		// The strip no longer consults `GLOBALLY_FORBIDDEN_PAYLOAD_KEYS`, so
		// nothing stops someone declaring `userId: true` on a type — except
		// that `assertNoForbiddenPayloadKeys` would then abort the build on
		// every row of it, on a one-shot job. Better to red here, months
		// earlier, than to discover the disagreement on 6 November.
		//
		// `key` is the one name that is legitimately shipped, and only inside
		// `market.created.media[]` where Appendix B.16 ships the identical
		// string as a column and `shipsDespiteForbiddenKey` exempts it.
		const conflicts: string[] = [];
		for (const t of EVENT_TYPES) {
			for (const path of shipKeyPaths(PAYLOAD_SHIP_KEYS[t] as ShipSpec)) {
				const leaf = path.split(".").pop() as string;
				if (leaf === "key" && t === "market.created") continue;
				if (FORBIDDEN_LEAF_NAMES.has(leaf)) conflicts.push(`${t}.${path}`);
			}
		}
		expect(conflicts).toEqual([]);
	});
});

/**
 * A local copy of the output net's leaf names, deliberately NOT imported.
 *
 * ⚠ Importing `GLOBALLY_FORBIDDEN_PAYLOAD_KEYS` would make this test compare
 * the registry against itself through a shared constant — the two would agree
 * by construction and the check would be a tautology. Written out so the
 * comparison is between two independently-authored statements, which is the
 * only version of it that can disagree.
 */
const FORBIDDEN_LEAF_NAMES = new Set([
	"ip",
	"user_agent",
	"userAgent",
	"email",
	"googleId",
	"google_id",
	"sessionId",
	"session_id",
	"key",
	"userId",
]);
