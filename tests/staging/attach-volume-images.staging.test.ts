import { eq, like, sql } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// ═══════════════════════════════════════════════════════════════════════════
// ATTACH REAL IMAGES TO VOLUME-FIXTURE POSTS — founder correction (Hrishikesh,
// 2026-09-03): "the image to be added as posts and not market media... it's
// like user is posting these images." Market-media (the admin-set card image)
// is the WRONG mechanism for simulating a participant attaching a photo to
// their argument — this file uses the REAL participant image-upload chain
// instead (`signUploadAndInsert` + presigned PUT to the "uploads" bucket +
// `verifyUploadedObject`), the same real path a live user's browser drives,
// exactly matching the sibling generator's `uploadFixtureImage` pattern —
// only the image SOURCE differs (a real photo file, not the tiny fixture
// placeholder).
//
// ADD-ONLY, idempotent: reuses an existing volume-fixture participant per
// market (no new signups), places exactly ONE new image-bearing post per
// volume-fixture market, skipping any market that already has one. Never
// touches the original 8 markets — every market this file reads or writes is
// resolved by `LIKE 'volume-fixture-%'`.
//
// Invocation: same guard contract as generate-volume.staging.test.ts —
//   doppler run --project zugzwang-experiment --config stg -- \
//     env ZUGZWANG_STAGING_TARGET=staging ZUGZWANG_STAGING_WRITE_ACK=generate-staging-fixtures \
//     ZUGZWANG_STAGING_VOLUME_WRITE_ACK=generate-staging-volume-fixture \
//     pnpm exec vitest run --config vitest.staging.config.ts \
//     tests/staging/attach-volume-images.staging.test.ts
// ═══════════════════════════════════════════════════════════════════════════

const VOLUME_INTENT_ENV = "ZUGZWANG_STAGING_VOLUME_WRITE_ACK";
const VOLUME_INTENT_VALUE = "generate-staging-volume-fixture";

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

vi.mock("next/navigation", () => ({
	redirect: vi.fn(),
	notFound: vi.fn(),
}));

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

const VOLUME_SLUGS = [
	"volume-fixture-a-low",
	"volume-fixture-b-mid",
	"volume-fixture-c-hot",
	"volume-fixture-d-high",
] as const;

const betMetadata = (userId: string, flowId: string) => ({
	request_id: "s5-volume-image-post",
	flow_id: flowId,
	user_id: userId,
	actor_id: userId,
	idempotency_key: null,
	ip: SYNTHETIC_TOS_IP,
	user_agent: SYNTHETIC_TOS_USER_AGENT,
});

/** The real participant image chain — signed insert, presigned PUT, verified
 * HeadObject — identical mechanism to a live user attaching a photo through
 * the browser. Source is a real image FILE, not a tiny fixture placeholder. */
async function uploadRealImage(userId: string): Promise<{
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
		{ ifNoneMatch: true },
	);
	const put = await fetch(putUrl, {
		method: "PUT",
		body: bytes,
		headers: { "Content-Type": "image/jpeg", "If-None-Match": "*" },
		signal: AbortSignal.timeout(PUT_URL_TTL_SECONDS * 1000),
	});
	if (!put.ok) {
		throw new Error(
			`image PUT failed: HTTP ${put.status} ${put.statusText} for ${key}`,
		);
	}

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
	console.log(
		`[attach-volume-images] target ${describeRunnerTarget()} · source image ${SOURCE_IMAGE_PATH}`,
	);
});

afterAll(async () => {
	await closeRunnerConnection();
});

describe("attach real image-bearing posts to the 4 volume-fixture markets", () => {
	it("places one image-bearing post per volume-fixture market — idempotent, skips markets that already have one", async () => {
		const produced: string[] = [];

		for (const slug of VOLUME_SLUGS) {
			const [market] = await readOnly
				.select({ id: markets.id })
				.from(markets)
				.where(eq(markets.slug, slug));
			if (!market) throw new Error(`market ${slug} not found`);

			// Idempotency: skip if this market already has an image-bearing
			// comment (comments.imageUploadsId not null) from a prior run.
			const [{ n: withImage }] = await readOnly
				.select({ n: sql<number>`count(*)::int` })
				.from(comments)
				.where(
					sql`${comments.marketId} = ${market.id} and ${comments.imageUploadsId} is not null`,
				);
			if (withImage > 0) {
				console.log(
					`[attach-volume-images] ${slug} already has an image post — skipping`,
				);
				continue;
			}

			const [participant] = await readOnly
				.select({ id: users.id })
				.from(users)
				.where(like(users.email, "volume-fixture-%@example.com"))
				.limit(1);
			if (!participant) throw new Error("no volume-fixture participant found");

			const image = await uploadRealImage(participant.id);

			const stake = "15";
			assertStakeFloor({ parentCommentId: null, stake });
			const result = await runBetTransaction(
				{ marketId: market.id, flow: "F-BET-1" },
				(ctx) =>
					place(ctx, {
						userId: participant.id,
						marketId: market.id,
						side: "YES",
						stake,
						body: `Volume fixture image post on ${slug} — real photo attached via the participant upload chain, simulating a live user's image-bearing argument.`,
						parentCommentId: null,
						idempotencyKey: uuidv7(),
						bodyFingerprint: uuidv7(),
						betEventId: uuidv7(),
						commentEventId: uuidv7(),
						creditEventId: uuidv7(),
						image,
						metadata: betMetadata(participant.id, "F-BET-1"),
					}),
			);
			produced.push(`${slug}: comment ${result.commentId}`);
		}

		console.log("[attach-volume-images] produced:", JSON.stringify(produced));
	}, 300_000);

	it("every volume-fixture market now has at least one image-bearing post", async () => {
		for (const slug of VOLUME_SLUGS) {
			const [market] = await readOnly
				.select({ id: markets.id })
				.from(markets)
				.where(eq(markets.slug, slug));
			expect(market, `${slug} should exist`).toBeTruthy();
			if (!market) continue;
			const [{ n }] = await readOnly
				.select({ n: sql<number>`count(*)::int` })
				.from(comments)
				.where(
					sql`${comments.marketId} = ${market.id} and ${comments.imageUploadsId} is not null`,
				);
			expect(n, `${slug} image-post count`).toBeGreaterThanOrEqual(1);
		}
	});
});
