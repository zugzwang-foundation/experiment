import { describe, expect, it } from "vitest";
import { parseWireResponse } from "@/components/debate/composer/envelope";

// UI.A3 §5.6 tests-first — the client-side §4.4 envelope parser (plan §3.2 /
// §3.3). PURE / DB-INDEPENDENT (real `Response` objects, no network): REDs NOW
// on the unresolvable greenfield import and GREENs when the module lands.
//
// Plan-§1 rows supported here: the parser is the wire substrate under the §4
// state map and the I-IDEM lifecycle (it surfaces `retry_after` for the P4
// countdown and the wait-state `Retry-After` header). It mirrors the SERVER
// shapes exactly: `envelope()` in src/server/bets/endpoint.ts (success
// `{ok:true, data}`; error `{ok:false, error:{code, message, retry_after?}}`
// — body `retry_after` present only for 429/503) and `WireError` in
// src/server/bets/errors.ts (the 409 in-flight arms carry a `retry-after`
// HTTP HEADER only, no body field — errors.ts:348-351 / endpoint.ts).
//
// PINNED PUBLIC-API CONTRACT (the implementer matches these names exactly):
//   type WireOutcome =
//     | { kind: "success"; data: unknown }
//     | { kind: "error"; status: number; code: string; message: string;
//         retryAfterSeconds?: number }
//     | { kind: "malformed"; status: number }
//   parseWireResponse(res: Response): Promise<WireOutcome>
//     — 2xx + {ok:true, data} → success. ANY status + {ok:false,
//       error:{code, message}} → error; retryAfterSeconds = body
//       `error.retry_after` when present, ELSE the HTTP `retry-after` header
//       parsed as a number when present + finite, else absent. Non-JSON →
//       malformed (status carried). JSON but neither envelope shape →
//       malformed: {ok:true} WITHOUT a `data` key is malformed (never
//       success-with-undefined); {ok:false} without a string `error.code` is
//       malformed.

function jsonResponse(
	status: number,
	body: unknown,
	headers?: Record<string, string>,
): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "content-type": "application/json", ...headers },
	});
}

describe("parseWireResponse — success arm", () => {
	it("envelope::200-place-success-carries-data-through", async () => {
		// The F-BET-1/2 response shape (SPEC.1 §7).
		const data = {
			betId: "b",
			commentId: "c",
			side: "YES",
			sharesBought: "1",
			newPrice: "0.5",
		};
		const out = await parseWireResponse(jsonResponse(200, { ok: true, data }));
		expect(out).toEqual({ kind: "success", data });
	});
});

describe("parseWireResponse — error arm + retry_after law", () => {
	it("envelope::429-reads-retry-after-from-the-body", async () => {
		const out = await parseWireResponse(
			jsonResponse(
				429,
				{
					ok: false,
					error: {
						code: "error_rate_limit_exceeded",
						message: "rate limit exceeded",
						retry_after: 30,
					},
				},
				{ "retry-after": "30" },
			),
		);
		expect(out).toEqual({
			kind: "error",
			status: 429,
			code: "error_rate_limit_exceeded",
			message: "rate limit exceeded",
			retryAfterSeconds: 30,
		});
	});

	it("envelope::409-in-flight-reads-the-header-when-the-body-has-none", async () => {
		// The in-flight arms are HEADER-only (`Retry-After: 2`) — no body
		// `retry_after` (the §4.4 body field is 429/503-only).
		const out = await parseWireResponse(
			jsonResponse(
				409,
				{
					ok: false,
					error: {
						code: "error_moderation_in_flight",
						message: "moderation_in_flight",
					},
				},
				{ "retry-after": "2" },
			),
		);
		expect(out).toEqual({
			kind: "error",
			status: 409,
			code: "error_moderation_in_flight",
			message: "moderation_in_flight",
			retryAfterSeconds: 2,
		});
	});

	it("envelope::503-reads-retry-after-from-the-body", async () => {
		const out = await parseWireResponse(
			jsonResponse(
				503,
				{
					ok: false,
					error: {
						code: "error_moderation_unavailable",
						message: "moderation_unavailable",
						retry_after: 5,
					},
				},
				{ "retry-after": "5" },
			),
		);
		expect(out).toEqual({
			kind: "error",
			status: 503,
			code: "error_moderation_unavailable",
			message: "moderation_unavailable",
			retryAfterSeconds: 5,
		});
	});

	it("envelope::body-retry-after-wins-over-the-header", async () => {
		// The law is ordered: body `error.retry_after` first, header only as
		// the fallback.
		const out = await parseWireResponse(
			jsonResponse(
				503,
				{
					ok: false,
					error: {
						code: "error_storage_unavailable",
						message: "storage_unavailable",
						retry_after: 30,
					},
				},
				{ "retry-after": "60" },
			),
		);
		expect(out).toEqual({
			kind: "error",
			status: 503,
			code: "error_storage_unavailable",
			message: "storage_unavailable",
			retryAfterSeconds: 30,
		});
	});

	it("envelope::500-internal-has-no-retry-after", async () => {
		const out = await parseWireResponse(
			jsonResponse(500, {
				ok: false,
				error: { code: "error_internal", message: "internal error" },
			}),
		);
		expect(out).toEqual({
			kind: "error",
			status: 500,
			code: "error_internal",
			message: "internal error",
		});
	});

	it("envelope::non-finite-header-yields-no-retry-after", async () => {
		// Header present but not a finite number → absent (never NaN).
		const out = await parseWireResponse(
			jsonResponse(
				409,
				{
					ok: false,
					error: {
						code: "error_idempotency_in_flight",
						message: "in flight",
					},
				},
				{ "retry-after": "soon" },
			),
		);
		expect(out).toEqual({
			kind: "error",
			status: 409,
			code: "error_idempotency_in_flight",
			message: "in flight",
		});
	});

	it("envelope::ok-false-is-an-error-at-ANY-status", async () => {
		// The envelope outranks the HTTP status ("Any status + {ok:false,…}").
		const out = await parseWireResponse(
			jsonResponse(200, {
				ok: false,
				error: { code: "error_internal", message: "internal error" },
			}),
		);
		expect(out).toEqual({
			kind: "error",
			status: 200,
			code: "error_internal",
			message: "internal error",
		});
	});
});

describe("parseWireResponse — malformed arm", () => {
	it("envelope::non-json-body-is-malformed-status-carried", async () => {
		const out = await parseWireResponse(
			new Response("<html>", {
				status: 200,
				headers: { "content-type": "text/html" },
			}),
		);
		expect(out).toEqual({ kind: "malformed", status: 200 });
	});

	it("envelope::empty-object-is-malformed", async () => {
		const out = await parseWireResponse(jsonResponse(400, {}));
		expect(out).toEqual({ kind: "malformed", status: 400 });
	});

	it("envelope::ok-true-without-a-data-key-is-malformed", async () => {
		// PINNED: never success-with-undefined.
		const out = await parseWireResponse(jsonResponse(200, { ok: true }));
		expect(out).toEqual({ kind: "malformed", status: 200 });
	});

	it("envelope::ok-false-without-a-string-error-code-is-malformed", async () => {
		const missingError = await parseWireResponse(
			jsonResponse(400, { ok: false }),
		);
		expect(missingError).toEqual({ kind: "malformed", status: 400 });
		const missingCode = await parseWireResponse(
			jsonResponse(400, { ok: false, error: { message: "x" } }),
		);
		expect(missingCode).toEqual({ kind: "malformed", status: 400 });
	});
});
