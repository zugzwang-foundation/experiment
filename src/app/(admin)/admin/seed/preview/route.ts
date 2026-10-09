import { eq } from "drizzle-orm";

import { db } from "@/db";
import { markets } from "@/db/schema";
import {
	envelope,
	jsonResponse,
	resolveRequestId,
} from "@/server/middleware/envelope";
import { logRequest } from "@/server/middleware/logging";
import { parseSeedFile, SEED_FILE_MAX_BYTES } from "@/server/seed/parse";
import { computeBatchId, planSeedBatch } from "@/server/seed/plan";
import { guardSeedRequest } from "@/server/seed/route-guard";
import { validateSeedRows } from "@/server/seed/validate";

// POST /admin/seed/preview — SEED-STAGING-1; staging, and production since
// SEED-PROD-1, wherever the task carries ZUGZWANG_SEED_TOOLS=enabled.
//
// Takes the uploaded sheet (multipart field `file`), parses and validates it
// against the markets that are Open RIGHT NOW, and returns the rows plus a
// per-market summary. It writes nothing. The browser keeps the returned rows
// and sends them back to /admin/seed/run, which re-validates them — nothing
// returned here is trusted on the way back in.
//
// A Route Handler rather than a Server Action because a Server Action body is
// capped at 1 MB by default (next.config.ts sets no `bodySizeLimit`), and a
// sheet can legitimately be larger.

export async function POST(request: Request): Promise<Response> {
	const startedAt = Date.now();
	const requestId = resolveRequestId(request);
	const rejected = await guardSeedRequest(request, requestId);
	if (rejected) return rejected;
	// Handler-body outcomes only (the guard's rejections never log); userId is
	// null — the admin has no users row.
	const log = (status: number): void =>
		logRequest({ request, status, userId: null, startedAt });

	// Refuse an oversized upload from its declared length, BEFORE
	// `request.formData()` buffers the whole body. Multipart framing adds a
	// little, hence the allowance; `file.size` below is the exact check.
	const declared = Number(request.headers.get("content-length") ?? "0");
	if (declared > SEED_FILE_MAX_BYTES + 64 * 1024) {
		log(413);
		return jsonResponse(
			requestId,
			413,
			envelope(
				"error_file_too_large",
				`file exceeds ${SEED_FILE_MAX_BYTES} bytes`,
			),
		);
	}

	let file: File | null = null;
	try {
		const form = await request.formData();
		const value = form.get("file");
		file = value instanceof File ? value : null;
	} catch {
		file = null;
	}
	if (!file) {
		log(400);
		return jsonResponse(
			requestId,
			400,
			envelope("error_invalid_request_body", "attach the sheet as `file`"),
		);
	}
	if (file.size > SEED_FILE_MAX_BYTES) {
		log(413);
		return jsonResponse(
			requestId,
			413,
			envelope(
				"error_file_too_large",
				`file exceeds ${SEED_FILE_MAX_BYTES} bytes`,
			),
		);
	}

	const parsed = await parseSeedFile({
		fileName: file.name,
		bytes: new Uint8Array(await file.arrayBuffer()),
	});
	const open = await db
		.select({ slug: markets.slug })
		.from(markets)
		.where(eq(markets.status, "Open"));
	const openSlugs = new Set(open.map((m) => m.slug));

	const { rows: valid, errors } =
		parsed.errors.length > 0
			? { rows: [], errors: parsed.errors }
			: validateSeedRows(parsed.rows, { acceptedMarketSlugs: openSlugs });

	const labels = new Set<string>();
	let unlabelled = 0;
	for (const row of valid) {
		if (row.userLabel === null) unlabelled += 1;
		else labels.add(row.userLabel.toLowerCase());
	}
	const summary = planSeedBatch(valid).map((group) => ({
		marketSlug: group.marketSlug,
		rows: group.rows.length,
		yes: group.rows.filter((r) => r.side === "YES").length,
		no: group.rows.filter((r) => r.side === "NO").length,
		replies: group.rows.filter((r) => r.replyToRow !== null).length,
	}));

	log(200);
	return jsonResponse(requestId, 200, {
		ok: true,
		data: {
			fileName: file.name,
			batchId: computeBatchId(valid),
			rows: parsed.rows,
			validRows: valid.length,
			errors,
			summary,
			participantsNeeded: labels.size + unlabelled,
			openMarkets: [...openSlugs].sort(),
		},
	});
}
