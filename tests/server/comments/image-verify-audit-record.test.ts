import { eq } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// AUDIT-FIX-A1 §7.F (#7) — the AUDIT RECORD. A passing image bet emits
// `image_upload.committed` carrying the forensic `etag` + the REAL `byteSizeActual`
// captured by verifyUploadedObject (plan §3.2/§3.4/§3.5/§3.6). ETag is a FORENSIC
// FINGERPRINT — never a security primitive; the physical write-once is the
// guarantee. This test proves the two fields reach the append-only event payload.
//
// RED: today (a) the route never calls verifyUploadedObject / never threads the
// two fields, (b) place() emits the committed payload as { uploadId, userId,
// commentId, key } only, and (c) the `image_upload.committed` Zod schema has no
// etag / byteSizeActual fields → the assertions on payload.etag +
// payload.byteSizeActual fail (undefined). (Collection may also RED first on the
// not-yet-existing `@/server/storage/verify-object` mock target — either way RED.)
//
// REAL place route + REAL runBetTransaction against test Postgres (mirrors
// media.test.ts::image-moderation-routes). Only externals mocked: precommit (pass)
// + verify-object (returns the fixed { etag, byteSize } so no real HeadObject).
// TRUNCATE in afterEach.

const { mockGetSession, mockPrecommit } = vi.hoisted(() => ({
	mockGetSession: vi.fn(),
	mockPrecommit: vi.fn(async () => ({
		outcome: "pass",
		categories: [],
		categoryScores: {},
	})),
}));

const VERIFIED_ETAG = '"deadbeefdeadbeefdeadbeefdeadbeef"';
const VERIFIED_BYTES = 1234;

vi.mock("@sentry/nextjs", () => ({
	captureMessage: vi.fn(),
	addBreadcrumb: vi.fn(),
	captureException: vi.fn(),
}));
vi.mock("@/server/auth", () => ({
	auth: { api: { getSession: mockGetSession } },
}));
vi.mock("@/server/middleware/origin-allowlist", () => ({
	checkOrigin: () => true,
}));
vi.mock("@/server/middleware/rate-limit", () => ({
	checkRateLimit: vi.fn(async () => ({
		allowed: true,
		remaining: 99,
		reset: 0,
	})),
	ipIdentifier: (ip: string) => ip,
}));
vi.mock("@/server/idempotency/cache", () => ({
	computeBodyFingerprint: vi.fn(async () => "fp"),
	idempotencyLookupOrReserve: vi.fn(async () => ({
		kind: "miss",
		release: vi.fn(async () => {}),
	})),
}));
vi.mock("@/server/moderation/precommit", () => ({
	precommitModerate: mockPrecommit,
}));
vi.mock("@/server/storage/verify-object", () => ({
	verifyUploadedObject: vi.fn(async () => ({
		etag: VERIFIED_ETAG,
		byteSize: VERIFIED_BYTES,
	})),
}));

import { POST as placePOST } from "@/app/api/bets/place/route";
import {
	comments,
	events,
	imageUploads,
	markets,
	pools,
	users,
} from "@/db/schema";

import { testClient, testDb } from "../../db/_fixtures/db";

const SEED_RESERVES = "100.000000000000000000";

function placeRequest(body: unknown, idempotencyKey: string): Request {
	return new Request("https://prd.example.com/api/bets/place", {
		method: "POST",
		headers: {
			"content-type": "application/json",
			origin: "https://prd.example.com",
			"Idempotency-Key": idempotencyKey,
			"x-forwarded-for": "203.0.113.61",
		},
		body: JSON.stringify(body),
	});
}

async function seedUser(tag: string): Promise<string> {
	const [user] = await testDb
		.insert(users)
		.values({
			name: "Verify Audit User",
			email: `${tag}@example.com`,
			pseudonym: tag,
			tosAcceptedAt: new Date("2026-01-01T00:00:00Z"),
		})
		.returning({ id: users.id });
	return user?.id ?? "";
}

async function seedOpenMarketWithPool(slug: string): Promise<string> {
	const [market] = await testDb
		.insert(markets)
		.values({
			slug,
			title: "Verify Audit Market",
			status: "Open",
			resolutionDeadline: new Date("2027-01-01T00:00:00Z"),
		})
		.returning({ id: markets.id });
	const marketId = market?.id ?? "";
	await testDb.insert(pools).values({
		marketId,
		yesReserves: SEED_RESERVES,
		noReserves: SEED_RESERVES,
	});
	return marketId;
}

async function seedDharmaGrant(userId: string): Promise<void> {
	const { appendLedgerRow } = await import("@/server/dharma/persist");
	await testDb.transaction((tx) =>
		appendLedgerRow(tx, {
			userId,
			amount: "1000",
			entryType: "initial_grant",
		}),
	);
}

async function seedImageUpload(userId: string): Promise<{ uploadId: string }> {
	const uploadId = uuidv7();
	const key = `u/${userId}/${uploadId}.png`;
	await testDb.insert(imageUploads).values({
		id: uploadId,
		userId,
		r2ObjectKey: key,
		contentType: "image/png",
		byteSize: 1024,
	});
	return { uploadId };
}

describe("image_upload.committed carries the verified etag + byteSizeActual (audit record)", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockPrecommit.mockImplementation(async () => ({
			outcome: "pass",
			categories: [],
			categoryScores: {},
		}));
	});

	afterEach(async () => {
		await testClient.unsafe(
			`TRUNCATE events, dharma_ledger, bets, comments, positions, image_uploads, pools, markets, users CASCADE`,
		);
	});

	it("image-verify-audit::committed-event-carries-etag-and-bytesize", async () => {
		const userId = await seedUser("verify-audit");
		const marketId = await seedOpenMarketWithPool("verify-audit-market");
		await seedDharmaGrant(userId);
		const { uploadId } = await seedImageUpload(userId);
		mockGetSession.mockResolvedValue({ user: { id: userId } });

		const res = await placePOST(
			placeRequest(
				{
					marketId,
					side: "YES",
					stake: "10",
					body: "argument with a verified image",
					imageUploadsId: uploadId,
				},
				"verify-audit-key",
			),
		);
		expect(res.status).toBe(200);

		// The append-only image_upload.committed payload carries the forensic ETag
		// AND the REAL byte size from the pre-moderation HeadObject.
		const [committed] = await testDb
			.select({ payload: events.payload })
			.from(events)
			.where(eq(events.eventType, "image_upload.committed"));
		expect(committed).toBeDefined();
		const payload = committed?.payload as Record<string, unknown>;
		expect(payload.etag).toBe(VERIFIED_ETAG);
		expect(payload.byteSizeActual).toBe(VERIFIED_BYTES);

		// Cross-check the comment still links the image (the pass branch is intact).
		const [commentRow] = await testDb
			.select({ imageUploadsId: comments.imageUploadsId })
			.from(comments)
			.where(eq(comments.marketId, marketId));
		expect(commentRow?.imageUploadsId).toBe(uploadId);
	});
});
