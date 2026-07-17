/**
 * UI.A3 slice 1 — the client-side §4.4 envelope parser (plan §3.2/§3.3).
 * Mirrors the server shapes exactly: `envelope()` in
 * src/server/bets/endpoint.ts (success `{ok:true, data}`; error `{ok:false,
 * error:{code, message, retry_after?}}` — the body `retry_after` is
 * 429/503-only) and `WireError` in src/server/bets/errors.ts (the 409
 * in-flight arms carry a `retry-after` HTTP HEADER only). The envelope
 * outranks the HTTP status in both directions; anything off-shape is
 * `malformed`, never a throw (SG-5 posture: unknown input renders a state,
 * not a crash).
 */

export type WireOutcome =
	| { kind: "success"; data: unknown }
	| {
			kind: "error";
			status: number;
			code: string;
			message: string;
			retryAfterSeconds?: number;
	  }
	| { kind: "malformed"; status: number };

export async function parseWireResponse(res: Response): Promise<WireOutcome> {
	let body: unknown;
	try {
		body = await res.json();
	} catch {
		return { kind: "malformed", status: res.status };
	}
	if (typeof body !== "object" || body === null) {
		return { kind: "malformed", status: res.status };
	}
	const envelope = body as Record<string, unknown>;
	if (envelope.ok === true) {
		if (!("data" in envelope)) {
			// Never success-with-undefined — an ok:true without data is off-shape.
			return { kind: "malformed", status: res.status };
		}
		return { kind: "success", data: envelope.data };
	}
	if (envelope.ok === false) {
		const error =
			typeof envelope.error === "object" && envelope.error !== null
				? (envelope.error as Record<string, unknown>)
				: null;
		if (error === null || typeof error.code !== "string") {
			return { kind: "malformed", status: res.status };
		}
		const outcome: WireOutcome = {
			kind: "error",
			status: res.status,
			code: error.code,
			message: typeof error.message === "string" ? error.message : "",
		};
		const retryAfter = readRetryAfter(error, res);
		if (retryAfter !== undefined) {
			outcome.retryAfterSeconds = retryAfter;
		}
		return outcome;
	}
	return { kind: "malformed", status: res.status };
}

/** Body `retry_after` first (§4.4); the HTTP header only as the fallback. */
function readRetryAfter(
	error: Record<string, unknown>,
	res: Response,
): number | undefined {
	if (typeof error.retry_after === "number") {
		return error.retry_after;
	}
	const header = res.headers.get("retry-after");
	if (header !== null) {
		const parsed = Number(header);
		if (Number.isFinite(parsed)) {
			return parsed;
		}
	}
	return undefined;
}
