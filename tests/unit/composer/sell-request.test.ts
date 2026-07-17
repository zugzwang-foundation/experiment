import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildSellRequest } from "@/components/debate/composer/requests";
import { IDEMPOTENCY_HEADER_NAME } from "@/server/idempotency/types";

// UI.A3 §5.6 tests-first, slice 4 — the greenfield sell-wiring builder (plan
// §3.2 sell law + SPEC.1 F-BET-3 request shape + SG-2). PURE /
// DB-INDEPENDENT. VERIFIED RED: `buildSellRequest` DOES NOT EXIST yet on the
// EXISTING `@/components/debate/composer/requests` module. The RED shape
// differs from slice 2's (there the whole MODULE was missing → collection
// failure): here the module exists — `buildPlaceRequest` lives in it — so
// under vitest's ESM interop the missing NAMED export resolves to
// `undefined` and every builder-calling test FAILS NOW with
// `TypeError: buildSellRequest is not a function` (verified 7-of-8 red on
// first run; `tsc` REDs the import as TS2305). The one green test is the
// grep PIN below — a negative regression guard on the existing module
// source (the AGENTS.md §9 guard class, not a TDD driver): it exists to
// bind the IMPLEMENTER, who lands `buildSellRequest` in this exact module
// and must not bring cap code with it. The file GREENs fully when the
// export lands against the contract below.
//
// Plan-§1 rows asserted here:
//   - SG-2 (sell is NEVER clamped) — adjacency at the wire layer: the sell
//     body carries NO `stake` key EVER (the cap machinery is stake-keyed;
//     a sell request has nothing for it to bite), and the requests module
//     source carries no cap code at all (grep pin below).
//   - I-IDEM-ONCE / receipts (ADR-0031/0015) — the Idempotency-Key the
//     lifecycle reducer minted rides EVERY sell request under the REAL
//     server header name (IDEMPOTENCY_HEADER_NAME, the pure-data single
//     source of truth — a drifted literal would ship a permanent 400
//     `error_idempotency_key_required`).
//   - CLAUDE.md §2 money law — `shares` is a decimal STRING end-to-end;
//     18-fractional-digit values survive byte-identical (a float hop would
//     destroy them).
//
// PINNED PUBLIC-API CONTRACT (shared verbatim with
// tests/integration/composer-sell.integration.test.ts — the implementer
// matches exactly):
//   export function buildSellRequest(args: {
//     body: { marketId: string; shares: string }; // decimal string, never a number
//     idempotencyKey: string;
//   }): { url: string; init: RequestInit };
//
// Wire law (plan §3.2 / SPEC.1 F-BET-3): url "/api/bets/sell" · POST ·
// content-type "application/json" · Idempotency-Key header under
// IDEMPOTENCY_HEADER_NAME · init.body is a JSON string carrying EXACTLY
// {marketId, shares} — no stake key, no side key, no body key (the sell is
// comment-free; the side derives server-side from the held position) ·
// shares passes through verbatim as a QUOTED JSON string.

const MARKET_ID = "0190b3a0-9999-7000-8000-000000000009";
const IDEM_KEY = "ui-a3-sell-request-key-1";

function sellBody(): { marketId: string; shares: string } {
	return { marketId: MARKET_ID, shares: "5" };
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

describe("buildSellRequest — url · method · headers", () => {
	it("sell-request::url-post-json-and-idempotency-header", () => {
		const { url, init } = buildSellRequest({
			body: sellBody(),
			idempotencyKey: IDEM_KEY,
		});
		expect(url).toBe("/api/bets/sell");
		expect(init.method).toBe("POST");
		const headers = new Headers(init.headers);
		expect(headers.get("content-type")).toBe("application/json");
		// The header is looked up under the REAL server constant — the single
		// source of truth the route reads (`request.headers.get(
		// IDEMPOTENCY_HEADER_NAME)`); the given key value rides it verbatim.
		expect(headers.get(IDEMPOTENCY_HEADER_NAME)).toBe(IDEM_KEY);
	});
});

describe("buildSellRequest — body serialization", () => {
	it("sell-request::body-exactly-marketid-and-shares", () => {
		const { init } = buildSellRequest({
			body: sellBody(),
			idempotencyKey: IDEM_KEY,
		});
		const { parsed } = parseInit(init);
		// EXACTLY the two sell keys — nothing extra rides the wire (the route's
		// zod shape is { marketId, shares }).
		expect(Object.keys(parsed).sort()).toEqual(["marketId", "shares"]);
		// Verbatim pass-through of the wire fields.
		expect(parsed.marketId).toBe(MARKET_ID);
		expect(parsed.shares).toBe("5");
	});

	it("sell-request::no-stake-key-ever", () => {
		// SG-2 adjacency: the sell wire shape has NO `stake` key EVER — the
		// clamp machinery is stake-keyed, so a stake-free body is structurally
		// out of its reach. Also no `side` (derives server-side from the held
		// position) and no `body` (F-BET-3: the sell is comment-free).
		const { init } = buildSellRequest({
			body: sellBody(),
			idempotencyKey: IDEM_KEY,
		});
		const { parsed } = parseInit(init);
		expect("stake" in parsed).toBe(false);
		expect("side" in parsed).toBe(false);
		expect("body" in parsed).toBe(false);
	});

	it("sell-request::shares-decimal-string-survives-byte-identical", () => {
		// CLAUDE.md §2 money law at the wire: shares is a decimal STRING and
		// round-trips byte-identical — 12.500000000000000001 is not
		// representable in f64, so any float hop would silently corrupt it.
		const shares = "12.500000000000000001";
		const { init } = buildSellRequest({
			body: { marketId: MARKET_ID, shares },
			idempotencyKey: IDEM_KEY,
		});
		const { raw, parsed } = parseInit(init);
		expect(typeof parsed.shares).toBe("string");
		expect(parsed.shares).toBe(shares);
		// The serialized wire text carries the QUOTED string — never a bare
		// JSON number.
		expect(raw).toMatch(/"shares"\s*:\s*"12\.500000000000000001"/);
	});
});

describe("sell-request — SG-2: no clamp code exists in the requests module", () => {
	it("sell-request::module-source-carries-no-cap-code (grep pin)", () => {
		// W2.10 rulings 2+3 / SPEC.1 §16.1: sell is NEVER clamped. The requests
		// module is a PURE wire builder — it must not even MENTION the cap.
		// Pinning BET_MAX_STAKE absent cannot false-positive here: the buy cap
		// lives in the gating layer (the W2.10-D strip predicate), never in the
		// request layer — a limits import appearing in this module would itself
		// be the defect (§1 clamp row: "sell path has no cap code at all").
		const source = readFileSync(
			join(process.cwd(), "src/components/debate/composer/requests.ts"),
			"utf8",
		);
		expect(source).not.toContain("BET_MAX_STAKE");
		expect(source).not.toContain("clampStakeToMax");
	});
});
