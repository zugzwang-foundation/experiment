import { eq, like, sql } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";
import { afterAll, beforeAll, describe, it, vi } from "vitest";

// ═══════════════════════════════════════════════════════════════════════════
// CONCURRENCY-TEST MARKET SETUP — operator ask (2026-09-08): a dedicated
// market page (never one of the original 8 real markets, never the sp-m*
// fixture set that appears to belong to a different lane's work) carrying
// real image-bearing posts, plus a pool of fresh real participants ready for
// a genuinely concurrent bet-placement burst (a separate script). This file
// ONLY sets up: market create+open, image posts, participant signups. It
// places NO bets itself.
//
// ADD-ONLY, idempotent: reuses the market by slug and the participants by
// email prefix if this has already run. Real chain throughout — real
// createMarket/openMarket, real signUploadAndInsert + presigned PUT +
// verifyUploadedObject for images, real createOAuthUser + acceptTosAction
// for participants. Nothing mocked (ADR-0036 primitive 3).
// ═══════════════════════════════════════════════════════════════════════════

const VOLUME_INTENT_ENV = "ZUGZWANG_STAGING_VOLUME_WRITE_ACK";
const VOLUME_INTENT_VALUE = "generate-staging-volume-fixture";

const MARKET_SLUG = "concurrency-test-market";
const MARKET_TITLE =
	"Concurrency test — will this page load fast under a crowd?";
const IMAGE_POST_COUNT = 30;
const CONCURRENCY_PARTICIPANT_COUNT = 500;
const EMAIL_PREFIX = "concurrency-test-";
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
	cookies: () => ({ get: mockCookiesGet, set: vi.fn(), delete: vi.fn() }),
	headers: () => ({ get: mockHeadersGet }),
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
import { canonicalizeAmount18 } from "@/server/admin/wire";
import { auth } from "@/server/auth/index";
import { acceptTosAction } from "@/server/auth/tos-accept";
import { assertStakeFloor } from "@/server/bets/floors";
import { place } from "@/server/bets/place";
import { runBetTransaction } from "@/server/bets/transaction";
import { PUT_URL_TTL_SECONDS } from "@/server/config/limits";
import { createMarket } from "@/server/markets/create";
import { openMarket } from "@/server/markets/open";
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

const adminMetadata = (flowId: string) => ({
	request_id: "concurrency-test-setup",
	flow_id: flowId,
	user_id: null,
	actor_id: "admin-singleton",
	idempotency_key: null,
	ip: SYNTHETIC_TOS_IP,
	user_agent: SYNTHETIC_TOS_USER_AGENT,
});
const betMetadata = (userId: string, flowId: string) => ({
	request_id: "concurrency-test-setup",
	flow_id: flowId,
	user_id: userId,
	actor_id: userId,
	idempotency_key: null,
	ip: SYNTHETIC_TOS_IP,
	user_agent: SYNTHETIC_TOS_USER_AGENT,
});

async function createParticipant(
	prefix: string,
	index: number,
): Promise<string> {
	const local = `${prefix}${String(index).padStart(4, "0")}`;
	const email = `${local}@${EMAIL_DOMAIN}`;
	const ctx = await auth.$context;
	const userPayload = {
		email,
		name: `Concurrency Test Participant ${index}`,
		image: null,
		emailVerified: true,
		googleId: `s5-concurrency-sub-${local}`,
	};
	const created = await ctx.internalAdapter.createOAuthUser(userPayload, {
		providerId: "google",
		accountId: `s5-concurrency-sub-${local}`,
		accessToken: "s5-concurrency-access-token",
		refreshToken: "s5-concurrency-refresh-token",
		idToken: "s5-concurrency-id-token",
		scope: "openid email profile",
		accessTokenExpiresAt: null,
		refreshTokenExpiresAt: null,
	});
	const userId = (created as { user?: { id?: string } } | null)?.user?.id;
	if (!userId) throw new Error(`createOAuthUser returned no user for ${email}`);

	mockCookiesGet.mockImplementation((name: string) =>
		name === "onboarding_ref"
			? { name: "onboarding_ref", value: "s5-concurrency-onboarding-ref" }
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
	console.log(`[concurrency-setup] target ${describeRunnerTarget()}`);
});
afterAll(async () => {
	await closeRunnerConnection();
});

describe("concurrency-test market + image posts + participant pool", () => {
	it("creates the dedicated test market, tops up its image posts, and tops up the participant pool", async () => {
		// ── MARKET ──────────────────────────────────────────────────────
		let marketId: string;
		const [existingMarket] = await readOnly
			.select({ id: markets.id, status: markets.status })
			.from(markets)
			.where(eq(markets.slug, MARKET_SLUG));
		if (existingMarket && existingMarket.status === "Open") {
			marketId = existingMarket.id;
			console.log(
				`[concurrency-setup] market ${MARKET_SLUG} already exists and is Open — reusing`,
			);
		} else if (existingMarket) {
			marketId = existingMarket.id;
			console.log(
				`[concurrency-setup] market ${MARKET_SLUG} exists but is ${existingMarket.status} — opening it now`,
			);
			await openMarket({
				marketId,
				openingPriceYes: canonicalizeAmount18("0.5"),
				tank: canonicalizeAmount18("1000"),
				now: new Date(),
				metadata: adminMetadata("F-ADMIN-2"),
			});
		} else {
			const now = new Date();
			const newMarketId = uuidv7();
			const mediaId = uuidv7();
			await createMarket({
				marketId: newMarketId,
				slug: MARKET_SLUG,
				title: MARKET_TITLE,
				description:
					"A dedicated, clearly-labelled test market for load and concurrency testing. Not a real question — synthetic fixture data only.",
				resolutionDeadline: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000),
				media: [
					{
						mediaId,
						key: `m/${newMarketId}/${mediaId}.png`,
						displayOrder: 0,
						isDefault: true,
					},
				],
				mediaVideoUrl: null,
				now,
				metadata: adminMetadata("F-ADMIN-1"),
			});
			await openMarket({
				marketId: newMarketId,
				openingPriceYes: canonicalizeAmount18("0.5"),
				tank: canonicalizeAmount18("1000"),
				now,
				metadata: adminMetadata("F-ADMIN-2"),
			});
			marketId = newMarketId;
			console.log(
				`[concurrency-setup] created market ${MARKET_SLUG} (${marketId})`,
			);
		}

		// ── IMAGE POSTS — top up to IMAGE_POST_COUNT ───────────────────
		const [{ n: existingImagePosts }] = await readOnly
			.select({ n: sql<number>`count(*)::int` })
			.from(comments)
			.where(
				sql`${comments.marketId} = ${marketId} and ${comments.imageUploadsId} is not null`,
			);
		const imageShortfall = Math.max(0, IMAGE_POST_COUNT - existingImagePosts);
		console.log(
			`[concurrency-setup] existing image posts: ${existingImagePosts} · target ${IMAGE_POST_COUNT} · shortfall ${imageShortfall}`,
		);
		if (imageShortfall > 0) {
			const [existingImgParticipant] = await readOnly
				.select({ id: users.id })
				.from(users)
				.where(eq(users.email, "concurrency-img-0001@example.com"));
			const imgParticipantId = existingImgParticipant
				? existingImgParticipant.id
				: await createParticipant("concurrency-img-", 1);
			for (let i = 0; i < imageShortfall; i++) {
				const image = await uploadRealImage(imgParticipantId);
				const stake = "10";
				assertStakeFloor({ parentCommentId: null, stake });
				await runBetTransaction({ marketId, flow: "F-BET-1" }, (ctx) =>
					place(ctx, {
						userId: imgParticipantId,
						marketId,
						side: "YES",
						stake,
						body: `Concurrency-test image post #${existingImagePosts + i + 1} — real photo attached via the participant upload chain.`,
						parentCommentId: null,
						idempotencyKey: uuidv7(),
						bodyFingerprint: uuidv7(),
						betEventId: uuidv7(),
						commentEventId: uuidv7(),
						creditEventId: uuidv7(),
						image,
						metadata: betMetadata(imgParticipantId, "F-BET-1"),
					}),
				);
			}
			console.log(`[concurrency-setup] placed ${imageShortfall} image posts`);
		}

		// ── PARTICIPANT POOL — top up to CONCURRENCY_PARTICIPANT_COUNT ─
		const existingParticipants = await readOnly
			.select({ id: users.id })
			.from(users)
			.where(like(users.email, `${EMAIL_PREFIX}%@${EMAIL_DOMAIN}`));
		let created = 0;
		for (
			let i = existingParticipants.length;
			i < CONCURRENCY_PARTICIPANT_COUNT;
			i++
		) {
			await createParticipant(EMAIL_PREFIX, i + 1);
			created++;
		}
		console.log(
			`[concurrency-setup] participant pool: ${existingParticipants.length} existing + ${created} created = ${existingParticipants.length + created} total`,
		);
		console.log(
			`[concurrency-setup] DONE — market slug: ${MARKET_SLUG} — market id: ${marketId}`,
		);
	}, 2_700_000);
});
