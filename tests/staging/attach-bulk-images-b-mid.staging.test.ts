import { eq, like, sql } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// ═══════════════════════════════════════════════════════════════════════════
// BULK IMAGE-BEARING POSTS on ONE volume-fixture market — operator ask
// (2026-09-04): the single image post attached earlier
// (attach-image-post-b-mid, comment 01a06d64-a809-7c3f-8124-6506a9d04ddb) is
// real and does render (verified: /m/volume-fixture-b-mid?post=204 serves a
// real R2-hosted JPEG), but it never ranks into the default "top posts" view
// (ranked by stake/engagement, not recency), so it never became visible
// without a deep link. Fix: attach the SAME real photo to enough posts that
// several land in the visible top-ranked slots by ordinary odds, then load-test
// those pages for real.
//
// Scope: `volume-fixture-b-mid` ONLY — never the original 8 markets, never the
// other 3 volume-fixture markets. Resolved by exact slug match, not LIKE.
//
// ADD-ONLY, idempotent: counts existing image-bearing comments
// (comments.imageUploadsId IS NOT NULL) on this market and places only the
// shortfall up to TARGET_IMAGE_POST_COUNT. A second run against a market that
// already has the target count is a correct no-op.
//
// Real chain throughout — same as attach-image-post-b-mid and
// attach-volume-images: real signup (createOAuthUser + acceptTosAction), real
// R2 upload (signUploadAndInsert + presigned PUT + verifyUploadedObject), real
// W-1 bet+comment transaction (place). A FRESH participant pool, distinct
// email prefix from the shared volume-fixture pool, so this run can never
// collide with that pool's existing positions (OppositeSideHeldError) —
// each fresh participant only ever bets YES on this one market, repeatedly,
// which is same-side and never rejected (src/server/bets/place.ts:98-105).
// Participants are capped at POSTS_PER_PARTICIPANT stakes each (well under the
// INITIAL_USER_DHARMA=1000 grant at BET_MIN_STAKE_POST=10/post) so no
// participant runs out of Dharma mid-batch.
//
// Invocation:
//   VOLUME_IMAGE_PATH="/Users/ritambiswas/Downloads/WhatsApp Image 2026-09-03 at 3.18.33 PM.jpeg" \
//   doppler run --project zugzwang-experiment --config stg -- \
//     env ZUGZWANG_STAGING_TARGET=staging ZUGZWANG_STAGING_WRITE_ACK=generate-staging-fixtures \
//     ZUGZWANG_STAGING_VOLUME_WRITE_ACK=generate-staging-volume-fixture \
//     pnpm exec vitest run --config vitest.staging.config.ts \
//     tests/staging/attach-bulk-images-b-mid.staging.test.ts
// ═══════════════════════════════════════════════════════════════════════════

const VOLUME_INTENT_ENV = "ZUGZWANG_STAGING_VOLUME_WRITE_ACK";
const VOLUME_INTENT_VALUE = "generate-staging-volume-fixture";

const MARKET_SLUG = "volume-fixture-b-mid";
const TARGET_IMAGE_POST_COUNT = 200;
const STAKE = "10"; // BET_MIN_STAKE_POST floor
const POSTS_PER_PARTICIPANT = 40; // 40*10=400 well under the 1000 initial grant
const EMAIL_PREFIX = "volume-fixture-img-";
const EMAIL_DOMAIN = "example.com";

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

const { mockVerifyOnboardingRef, mockCookiesGet, mockHeadersGet } = vi.hoisted(
	() => ({
		mockVerifyOnboardingRef: vi.fn(),
		mockCookiesGet: vi.fn(),
		mockHeadersGet: vi.fn(),
	}),
);

vi.mock("@/server/auth/onboarding-ref", () => ({
	signOnboardingRef: vi.fn(),
	verifyOnboardingRef: mockVerifyOnboardingRef,
}));

vi.mock("next/headers", () => ({
	cookies: () => ({
		get: mockCookiesGet,
		set: vi.fn(),
		delete: vi.fn(),
	}),
	headers: () => ({ get: mockHeadersGet }),
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
import { auth } from "@/server/auth/index";
import { acceptTosAction } from "@/server/auth/tos-accept";
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
	request_id: "s5-bulk-image-b-mid",
	flow_id: flowId,
	user_id: userId,
	actor_id: userId,
	idempotency_key: null,
	ip: SYNTHETIC_TOS_IP,
	user_agent: SYNTHETIC_TOS_USER_AGENT,
});

/** Same real two-call entry point as generate-volume.staging.test.ts:
 * `createOAuthUser` (real `consumeIdentityPoolTuple`, real INSERT), then
 * `acceptTosAction` (real ToS evidence write + `grantInitialDharma`). Distinct
 * email prefix — never touches the shared volume-fixture participant pool. */
async function createImageParticipant(index: number): Promise<string> {
	const local = `${EMAIL_PREFIX}${String(index).padStart(4, "0")}`;
	const email = `${local}@${EMAIL_DOMAIN}`;
	const ctx = await auth.$context;
	const userPayload = {
		email,
		name: `Bulk Image Participant ${index}`,
		image: null,
		emailVerified: true,
		googleId: `s5-bulk-image-sub-${local}`,
	};
	const created = await ctx.internalAdapter.createOAuthUser(userPayload, {
		providerId: "google",
		accountId: `s5-bulk-image-sub-${local}`,
		accessToken: "s5-bulk-image-access-token",
		refreshToken: "s5-bulk-image-refresh-token",
		idToken: "s5-bulk-image-id-token",
		scope: "openid email profile",
		accessTokenExpiresAt: null,
		refreshTokenExpiresAt: null,
	});
	const userId = (created as { user?: { id?: string } } | null)?.user?.id;
	if (!userId) {
		throw new Error(`createOAuthUser returned no user for ${email}`);
	}

	mockCookiesGet.mockImplementation((name: string) =>
		name === "onboarding_ref"
			? { name: "onboarding_ref", value: "s5-bulk-image-onboarding-ref" }
			: undefined,
	);
	mockHeadersGet.mockImplementation((header: string) => {
		if (header === "x-forwarded-for") return SYNTHETIC_TOS_IP;
		if (header === "user-agent") return SYNTHETIC_TOS_USER_AGENT;
		return null;
	});
	mockVerifyOnboardingRef.mockReturnValue({ userId });

	const formData = new FormData();
	formData.set("accepted", "true");
	await acceptTosAction(formData);

	return userId;
}

/** The real participant image chain — signed insert, presigned PUT, verified
 * HeadObject — identical mechanism to a live user attaching a photo through
 * the browser. Same source file every call (the operator's real photo). */
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
		`[bulk-image-b-mid] target ${describeRunnerTarget()} · source image ${SOURCE_IMAGE_PATH} · market ${MARKET_SLUG}`,
	);
});

afterAll(async () => {
	await closeRunnerConnection();
});

describe(`bulk real image-bearing posts on ${MARKET_SLUG}`, () => {
	it(`tops ${MARKET_SLUG} up to ${TARGET_IMAGE_POST_COUNT} real image-bearing posts, all carrying the same photo`, async () => {
		const [market] = await readOnly
			.select({ id: markets.id })
			.from(markets)
			.where(eq(markets.slug, MARKET_SLUG));
		if (!market) throw new Error(`market ${MARKET_SLUG} not found`);

		const [{ n: existing }] = await readOnly
			.select({ n: sql<number>`count(*)::int` })
			.from(comments)
			.where(
				sql`${comments.marketId} = ${market.id} and ${comments.imageUploadsId} is not null`,
			);

		const shortfall = Math.max(0, TARGET_IMAGE_POST_COUNT - existing);
		console.log(
			`[bulk-image-b-mid] existing image posts: ${existing} · target: ${TARGET_IMAGE_POST_COUNT} · shortfall: ${shortfall}`,
		);
		if (shortfall === 0) {
			console.log("[bulk-image-b-mid] already at target — no-op");
			return;
		}

		// Continue the participant index from wherever a prior run left off, so a
		// re-run (idempotent, ADD-ONLY) never collides with an already-created
		// email local part.
		const [{ n: existingParticipants }] = await readOnly
			.select({ n: sql<number>`count(*)::int` })
			.from(users)
			.where(like(users.email, `${EMAIL_PREFIX}%@${EMAIL_DOMAIN}`));

		let remaining = shortfall;
		let participantIndex = existingParticipants;
		let postIndex = existing;
		let produced = 0;
		let failed = 0;

		while (remaining > 0) {
			participantIndex += 1;
			const participantId = await createImageParticipant(participantIndex);
			const postsForThisParticipant = Math.min(
				POSTS_PER_PARTICIPANT,
				remaining,
			);

			for (let p = 0; p < postsForThisParticipant; p++) {
				postIndex += 1;
				const image = await uploadRealImage(participantId);
				const stake = STAKE;
				assertStakeFloor({ parentCommentId: null, stake });
				try {
					const result = await runBetTransaction(
						{ marketId: market.id, flow: "F-BET-1" },
						(ctx) =>
							place(ctx, {
								userId: participantId,
								marketId: market.id,
								side: "YES",
								stake,
								body: `Volume fixture image post #${postIndex} on ${MARKET_SLUG} — bulk load-test batch, real photo attached via the participant upload chain.`,
								parentCommentId: null,
								idempotencyKey: uuidv7(),
								bodyFingerprint: uuidv7(),
								betEventId: uuidv7(),
								commentEventId: uuidv7(),
								creditEventId: uuidv7(),
								image,
								metadata: betMetadata(participantId, "F-BET-1"),
							}),
					);
					produced += 1;
					if (postIndex % 25 === 0) {
						console.log(
							`[bulk-image-b-mid] progress: ${produced}/${shortfall} placed (latest comment ${result.commentId})`,
						);
					}
				} catch (err) {
					failed += 1;
					console.log(
						`[bulk-image-b-mid] post #${postIndex} FAILED: ${err instanceof Error ? err.message : String(err)}`,
					);
				}
			}
			remaining -= postsForThisParticipant;
		}

		console.log(
			`[bulk-image-b-mid] done — produced ${produced}, failed ${failed}, participants used ${participantIndex}`,
		);
	}, 2_700_000); // 45 minutes — real uploads + real bet transactions, ~200 iterations

	it(`${MARKET_SLUG} now has at least ${TARGET_IMAGE_POST_COUNT} image-bearing posts`, async () => {
		const [market] = await readOnly
			.select({ id: markets.id })
			.from(markets)
			.where(eq(markets.slug, MARKET_SLUG));
		expect(market, `${MARKET_SLUG} should exist`).toBeTruthy();
		if (!market) return;
		const [{ n }] = await readOnly
			.select({ n: sql<number>`count(*)::int` })
			.from(comments)
			.where(
				sql`${comments.marketId} = ${market.id} and ${comments.imageUploadsId} is not null`,
			);
		expect(n, `${MARKET_SLUG} image-post count`).toBeGreaterThanOrEqual(
			TARGET_IMAGE_POST_COUNT,
		);
	});
});
