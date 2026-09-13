import { eq, like, sql } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// ═══════════════════════════════════════════════════════════════════════════
// CONCURRENT IMAGE-UPLOAD BURST — operator ask (2026-09-08 #8): every image
// attachment done this whole session ran SEQUENTIALLY, one at a time. This
// fires many real participant image uploads GENUINELY CONCURRENTLY via
// Promise.all — real signed PUT to R2, real verifyUploadedObject HeadObject
// check, real place() with the image attached — for the first time.
//
// Reuses existing concurrency-test-* participants (500 already created this
// session) rather than consuming more identity_pool budget. Targets the same
// dedicated concurrency-test-market. Real chain throughout, nothing mocked.
// ═══════════════════════════════════════════════════════════════════════════

const VOLUME_INTENT_ENV = "ZUGZWANG_STAGING_VOLUME_WRITE_ACK";
const VOLUME_INTENT_VALUE = "generate-staging-volume-fixture";

const MARKET_SLUG = "concurrency-test-market";
const EMAIL_PREFIX = "concurrency-test-";
const EMAIL_DOMAIN = "example.com";
const BURST_SIZE = 50;
const STAKE = "10";

const SOURCE_IMAGE_PATH =
	process.env.VOLUME_IMAGE_PATH ??
	(() => {
		throw new Error("REFUSED — VOLUME_IMAGE_PATH is not set");
	})();

vi.mock("@sentry/nextjs", () => ({
	captureMessage: vi.fn(),
	captureException: vi.fn(),
	addBreadcrumb: vi.fn(),
}));
vi.mock("next/headers", () => ({
	cookies: () => ({ get: vi.fn(), set: vi.fn(), delete: vi.fn() }),
	headers: () => ({ get: vi.fn() }),
}));
vi.mock("next/navigation", () => ({ redirect: vi.fn(), notFound: vi.fn() }));
vi.mock("next/cache", () => ({
	revalidatePath: vi.fn(),
	revalidateTag: vi.fn(),
	updateTag: vi.fn(),
}));
vi.mock("@/db", async () => {
	const { guardedDb } = await import("./_lib/client");
	return { db: guardedDb };
});
vi.mock("@/db/index", async () => {
	const { guardedDb } = await import("./_lib/client");
	return { db: guardedDb };
});

import { readFileSync } from "node:fs";
import { comments, markets, users } from "@/db/schema";
import { assertStakeFloor } from "@/server/bets/floors";
import { place } from "@/server/bets/place";
import { runBetTransaction } from "@/server/bets/transaction";
import { PUT_URL_TTL_SECONDS } from "@/server/config/limits";
import { mintPutUrl } from "@/server/storage/r2";
import { signUploadAndInsert } from "@/server/storage/sign-upload";
import { verifyUploadedObject } from "@/server/storage/verify-object";

import {
	assertRunnerLiveConnection,
	closeRunnerConnection,
	describeRunnerTarget,
	guardedDb,
	readOnly,
} from "./_lib/client";
import { resolveRunnerTarget } from "./_lib/target";
import { SYNTHETIC_TOS_IP, SYNTHETIC_TOS_USER_AGENT } from "./fixtures";

const runnerTarget = resolveRunnerTarget(process.env, {
	requireWriteIntent: true,
});
if (!runnerTarget.ok) {
	throw new Error(
		`REFUSED — target guard did not pass.\n  ${runnerTarget.reason}`,
	);
}

const betMetadata = (userId: string, flowId: string) => ({
	request_id: "concurrent-image-upload-burst",
	flow_id: flowId,
	user_id: userId,
	actor_id: userId,
	idempotency_key: null,
	ip: SYNTHETIC_TOS_IP,
	user_agent: SYNTHETIC_TOS_USER_AGENT,
});

async function uploadRealImageConcurrent(userId: string): Promise<{
	uploadId: string;
	r2ObjectKey: string;
	committedEventId: string;
	etag: string | null;
	byteSizeActual: number;
}> {
	const bytes = readFileSync(SOURCE_IMAGE_PATH);
	const { uploadId, key } = await guardedDb.transaction((tx) =>
		signUploadAndInsert(tx, {
			userId,
			contentType: "image/jpeg",
			byteSize: bytes.byteLength,
			eventId: uuidv7(),
			metadata: betMetadata(userId, "F-COMMENT-3"),
		}),
	);
	const putUrl = await mintPutUrl(
		"uploads",
		key,
		"image/jpeg",
		PUT_URL_TTL_SECONDS,
		{
			ifNoneMatch: true,
		},
	);
	const put = await fetch(putUrl, {
		method: "PUT",
		body: bytes,
		headers: { "Content-Type": "image/jpeg", "If-None-Match": "*" },
		signal: AbortSignal.timeout(PUT_URL_TTL_SECONDS * 1000),
	});
	if (!put.ok)
		throw new Error(`image PUT failed: HTTP ${put.status} for ${key}`);
	const verified = await verifyUploadedObject(key);
	return {
		uploadId,
		r2ObjectKey: key,
		committedEventId: uuidv7(),
		etag: verified.etag ?? null,
		byteSizeActual: verified.byteSize,
	};
}

beforeAll(async () => {
	await assertRunnerLiveConnection();
	if (process.env[VOLUME_INTENT_ENV] !== VOLUME_INTENT_VALUE) {
		throw new Error(
			`REFUSED — ${VOLUME_INTENT_ENV} is not set to the acknowledgement value.`,
		);
	}
	console.log(`[image-upload-burst] target ${describeRunnerTarget()}`);
});
afterAll(async () => {
	await closeRunnerConnection();
});

describe("concurrent real image-upload burst", () => {
	it("fires many real image uploads + posts concurrently against one market, then verifies from the DB", async () => {
		const [market] = await readOnly
			.select({ id: markets.id })
			.from(markets)
			.where(eq(markets.slug, MARKET_SLUG));
		if (!market) throw new Error(`market ${MARKET_SLUG} not found`);

		const participants = await readOnly
			.select({ id: users.id, email: users.email })
			.from(users)
			.where(like(users.email, `${EMAIL_PREFIX}%@${EMAIL_DOMAIN}`))
			.limit(BURST_SIZE);
		if (participants.length < BURST_SIZE) {
			throw new Error(
				`only ${participants.length} participants available, need ${BURST_SIZE}`,
			);
		}

		const [{ n: beforeCount }] = await readOnly
			.select({ n: sql<number>`count(*)::int` })
			.from(comments)
			.where(
				sql`${comments.marketId} = ${market.id} and ${comments.imageUploadsId} is not null`,
			);

		const burstStart = Date.now();
		const results = await Promise.allSettled(
			participants.map(async (p) => {
				const t0 = Date.now();
				const image = await uploadRealImageConcurrent(p.id);
				assertStakeFloor({ parentCommentId: null, stake: STAKE });
				const result = await runBetTransaction(
					{ marketId: market.id, flow: "F-BET-1" },
					(ctx) =>
						place(ctx, {
							userId: p.id,
							marketId: market.id,
							side: "YES",
							stake: STAKE,
							body: `Concurrent image-upload burst — ${p.email}, real photo attached under genuine concurrency.`,
							parentCommentId: null,
							idempotencyKey: uuidv7(),
							bodyFingerprint: uuidv7(),
							betEventId: uuidv7(),
							commentEventId: uuidv7(),
							creditEventId: uuidv7(),
							image,
							metadata: betMetadata(p.id, "F-BET-1"),
						}),
				);
				return {
					userId: p.id,
					commentId: result.commentId,
					ms: Date.now() - t0,
				};
			}),
		);
		const burstDurationMs = Date.now() - burstStart;

		const succeeded = results.filter(
			(
				r,
			): r is PromiseFulfilledResult<{
				userId: string;
				commentId: string;
				ms: number;
			}> => r.status === "fulfilled",
		);
		const failed = results.filter(
			(r): r is PromiseRejectedResult => r.status === "rejected",
		);
		const failuresByType = new Map<string, number>();
		for (const f of failed) {
			const name =
				f.reason instanceof Error ? f.reason.constructor.name : "Unknown";
			failuresByType.set(name, (failuresByType.get(name) ?? 0) + 1);
		}
		const latencies = succeeded.map((r) => r.value.ms).sort((a, b) => a - b);
		const p50 = latencies[Math.floor(latencies.length * 0.5)] ?? 0;

		console.log(
			`[image-upload-burst] BURST DONE in ${burstDurationMs}ms · ${succeeded.length}/${BURST_SIZE} succeeded · ${failed.length} failed`,
		);
		console.log(
			`[image-upload-burst] latency: min=${latencies[0] ?? 0}ms p50=${p50}ms max=${latencies[latencies.length - 1] ?? 0}ms`,
		);
		console.log(
			`[image-upload-burst] failure types: ${JSON.stringify(Object.fromEntries(failuresByType))}`,
		);

		const [{ n: afterCount }] = await readOnly
			.select({ n: sql<number>`count(*)::int` })
			.from(comments)
			.where(
				sql`${comments.marketId} = ${market.id} and ${comments.imageUploadsId} is not null`,
			);
		const netNewImagePosts = afterCount - beforeCount;

		console.log(
			`[image-upload-burst] VERIFICATION — image posts before: ${beforeCount} · after: ${afterCount} · net new: ${netNewImagePosts} · matches succeeded count: ${netNewImagePosts === succeeded.length}`,
		);
		console.log(
			`[image-upload-burst] SUMMARY_JSON ${JSON.stringify({
				burstSize: BURST_SIZE,
				burstDurationMs,
				succeeded: succeeded.length,
				failed: failed.length,
				failuresByType: Object.fromEntries(failuresByType),
				latencyMs: {
					p50,
					min: latencies[0] ?? 0,
					max: latencies[latencies.length - 1] ?? 0,
				},
				beforeCount,
				afterCount,
				netNewImagePosts,
			})}`,
		);

		expect(
			netNewImagePosts,
			"the DB's new image-post count should exactly match the number of successes",
		).toBe(succeeded.length);
	}, 600_000);
});
