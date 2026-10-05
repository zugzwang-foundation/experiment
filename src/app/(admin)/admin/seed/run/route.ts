import { z } from "zod";

import { SEED_CHUNK_MAX } from "@/lib/seed";
import { COMMENT_MAX_LENGTH } from "@/server/config/limits";
import {
	envelope,
	jsonResponse,
	resolveRequestId,
} from "@/server/middleware/envelope";
import { logRequest } from "@/server/middleware/logging";
import { safeCaptureException } from "@/server/observability/safe-capture";
import { SEED_FILE_MAX_ROWS } from "@/server/seed/parse";
import { guardSeedRequest } from "@/server/seed/route-guard";
import { runSeedChunk } from "@/server/seed/run";

// POST /admin/seed/run — SEED-STAGING-1, staging only.
//
// Executes one chunk of a previewed sheet. The browser sends the whole batch
// each time; `runSeedChunk` re-validates it against live market state and
// places each row through the shipped bet engine. Chunks are capped so every
// request finishes well inside the load balancer's 60 s idle timeout.

const field = (max: number) => z.string().max(max);

const runSchema = z.object({
	rows: z
		.array(
			z.object({
				rowNumber: z.number().int().positive(),
				market: field(80),
				user: field(40),
				side: field(8),
				stake: field(40),
				// Over-length bodies are a VALIDATION error with a row number,
				// not a schema rejection — allow some headroom to reach it.
				argument: field(COMMENT_MAX_LENGTH * 2),
				replyTo: field(10),
			}),
		)
		.min(1)
		.max(SEED_FILE_MAX_ROWS),
	fromIndex: z.number().int().min(0),
	count: z.number().int().min(1).max(SEED_CHUNK_MAX),
	haltedMarkets: z.array(field(80)).max(100),
});

export async function POST(request: Request): Promise<Response> {
	const startedAt = Date.now();
	const requestId = resolveRequestId(request);
	const rejected = await guardSeedRequest(request, requestId);
	if (rejected) return rejected;
	// Handler-body outcomes only, as at /admin/markets/media/sign: the guard's
	// rejections above never log. userId is null — the admin has no users row.
	const log = (status: number): void =>
		logRequest({ request, status, userId: null, startedAt });

	let raw: unknown;
	try {
		raw = await request.json();
	} catch {
		log(400);
		return jsonResponse(
			requestId,
			400,
			envelope("error_invalid_json", "invalid JSON body"),
		);
	}
	const parsed = runSchema.safeParse(raw);
	if (!parsed.success) {
		log(400);
		return jsonResponse(
			requestId,
			400,
			envelope("error_invalid_request_body", "invalid request body"),
		);
	}

	// A throw here (the database unreachable, say) answers in the §4.4
	// envelope like every other rejection, rather than Next's default HTML 500,
	// which the browser half cannot parse into a message.
	try {
		const result = await runSeedChunk(parsed.data);
		log(200);
		return jsonResponse(requestId, 200, { ok: true, data: result });
	} catch (err) {
		safeCaptureException(err, { tags: { kind: "seed_run_chunk_failed" } });
		log(500);
		return jsonResponse(
			requestId,
			500,
			envelope(
				"error_internal",
				"the seeding chunk failed; nothing after the last reported row ran",
			),
		);
	}
}
