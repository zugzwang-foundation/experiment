import { describe, expect, it } from "vitest";
import {
	buildPlaceRequest,
	type PlaceBody,
} from "@/components/debate/composer/requests";
import { IDEMPOTENCY_HEADER_NAME } from "@/server/idempotency/types";

// UI.A3 §5.6 tests-first, slice 2 — the greenfield place-wiring builder (plan
// §3.2 "Writes (the wiring deliverable)" + SPEC.1 F-BET-1/2 request shape).
// PURE / DB-INDEPENDENT: the module under test DOES NOT EXIST yet — this file
// collection-FAILS NOW on the unresolvable
// `@/components/debate/composer/requests` import (the verified RED) and
// GREENs when the implementer lands the module against the contract below.
//
// Plan-§1 rows asserted here:
//   - I-IDEM-ONCE / receipts (ADR-0031/0015) — the Idempotency-Key the
//     lifecycle reducer minted rides EVERY place request under the REAL
//     server header name (IDEMPOTENCY_HEADER_NAME, the pure-data single
//     source of truth — a drifted literal would ship a permanent 400
//     `error_idempotency_key_required`).
//   - INV-1 adjacency — the builder is the ONE wire shape the composer
//     submits: bet fields + `body` travel together in a single payload;
//     there is no comment-free / bet-free variant to build.
//   - CLAUDE.md §2 money law — `stake` is a decimal STRING end-to-end;
//     18-fractional-digit values survive byte-identical (a float hop would
//     destroy them).
//
// PINNED PUBLIC-API CONTRACT (the implementer matches these names exactly):
//   export type PlaceBody = {
//     marketId: string;
//     side: "YES" | "NO";
//     stake: string; // decimal string — never a number
//     body: string;
//     parentCommentId?: string; // reply-bet only — key ABSENT on a post bet
//     imageUploadsId?: string; // slice 5 — key ABSENT when no image
//   };
//   export function buildPlaceRequest(args: {
//     body: PlaceBody;
//     idempotencyKey: string;
//   }): { url: string; init: RequestInit };
//
// Wire law (plan §3.2): url "/api/bets/place" · POST · content-type
// "application/json" · Idempotency-Key header under IDEMPOTENCY_HEADER_NAME ·
// init.body is a JSON string carrying EXACTLY the present PlaceBody fields —
// absent optionals are ABSENT keys (not null, not undefined-serialized;
// asserted via the `in` operator) · every field passes through verbatim.
//
// Fixture prose reuses the existing corpus (plan §8: never invent market or
// argument content): "durable replay argument".

const MARKET_ID = "0190b3a0-9999-7000-8000-000000000009";
const PARENT_COMMENT_ID = "0190b3a0-7777-7000-8000-000000000007";
const IMAGE_UPLOADS_ID = "0190b3a0-1111-7000-8000-000000000001";
const IDEM_KEY = "ui-a3-requests-key-1";

function postBody(): PlaceBody {
	return {
		marketId: MARKET_ID,
		side: "YES",
		stake: "10",
		body: "durable replay argument",
	};
}

/** Narrow init.body to the JSON string the contract mandates, then parse. */
function parseInit(init: RequestInit): {
	raw: string;
	parsed: Record<string, unknown>;
} {
	const raw = init.body;
	if (typeof raw !== "string") {
		throw new Error("contract violation: init.body must be a JSON string");
	}
	const parsed: unknown = JSON.parse(raw);
	if (typeof parsed !== "object" || parsed === null) {
		throw new Error("contract violation: init.body must encode a JSON object");
	}
	return { raw, parsed: parsed as Record<string, unknown> };
}

describe("buildPlaceRequest — url · method · headers", () => {
	it("place-request::url-post-json-and-idempotency-header", () => {
		const { url, init } = buildPlaceRequest({
			body: postBody(),
			idempotencyKey: IDEM_KEY,
		});
		expect(url).toBe("/api/bets/place");
		expect(init.method).toBe("POST");
		const headers = new Headers(init.headers);
		expect(headers.get("content-type")).toBe("application/json");
		// The header is looked up under the REAL server constant — the single
		// source of truth the route reads (`request.headers.get(
		// IDEMPOTENCY_HEADER_NAME)`); the given key value rides it verbatim.
		expect(headers.get(IDEMPOTENCY_HEADER_NAME)).toBe(IDEM_KEY);
	});
});

describe("buildPlaceRequest — body serialization", () => {
	it("place-request::post-body-exact-keys-optionals-absent", () => {
		const { init } = buildPlaceRequest({
			body: postBody(),
			idempotencyKey: IDEM_KEY,
		});
		const { parsed } = parseInit(init);
		// EXACTLY the four post-bet keys — nothing extra rides the wire.
		expect(Object.keys(parsed).sort()).toEqual([
			"body",
			"marketId",
			"side",
			"stake",
		]);
		// ABSENT means absent: not null, not undefined-serialized.
		expect("parentCommentId" in parsed).toBe(false);
		expect("imageUploadsId" in parsed).toBe(false);
		// Verbatim pass-through of the wire fields.
		expect(parsed.marketId).toBe(MARKET_ID);
		expect(parsed.side).toBe("YES");
		expect(parsed.body).toBe("durable replay argument");
	});

	it("place-request::reply-carries-parent-comment-id", () => {
		const { init } = buildPlaceRequest({
			body: { ...postBody(), parentCommentId: PARENT_COMMENT_ID },
			idempotencyKey: IDEM_KEY,
		});
		const { parsed } = parseInit(init);
		// A reply bet carries its parent (ADR-0017 reply-as-bet).
		expect("parentCommentId" in parsed).toBe(true);
		expect(parsed.parentCommentId).toBe(PARENT_COMMENT_ID);
		// Presence is per-field — the image key stays absent.
		expect("imageUploadsId" in parsed).toBe(false);
	});

	it("place-request::image-carries-image-uploads-id", () => {
		const { init } = buildPlaceRequest({
			body: { ...postBody(), imageUploadsId: IMAGE_UPLOADS_ID },
			idempotencyKey: IDEM_KEY,
		});
		const { parsed } = parseInit(init);
		expect("imageUploadsId" in parsed).toBe(true);
		expect(parsed.imageUploadsId).toBe(IMAGE_UPLOADS_ID);
		expect("parentCommentId" in parsed).toBe(false);
	});

	it("place-request::stake-decimal-string-survives-byte-identical", () => {
		// CLAUDE.md §2 money law at the wire: the stake is a decimal STRING and
		// round-trips byte-identical — 25.500000000000000001 is not
		// representable in f64, so any float hop would silently corrupt it.
		const stake = "25.500000000000000001";
		const { init } = buildPlaceRequest({
			body: { ...postBody(), stake },
			idempotencyKey: IDEM_KEY,
		});
		const { raw, parsed } = parseInit(init);
		expect(typeof parsed.stake).toBe("string");
		expect(parsed.stake).toBe(stake);
		// The serialized wire text carries the QUOTED string — never a bare
		// JSON number.
		expect(raw).toMatch(/"stake"\s*:\s*"25\.500000000000000001"/);
	});
});
