import { eq } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// UI.A3 §5.6, slice 5 — the image-attach id in the place payload + the
// storage belt (plan §3.2 "place body imageUploadsId" · §4 image-codes row
// "P3 inline on the affordance" · §9 slice 5 "attach id in payload → image
// error states"). The composer's OWN client modules (`composeWireBody`,
// `buildPlaceRequest`'s imageUploadsId arm — already unit-pinned,
// `parseWireResponse`, `mapWireError`, `keyOutcomeFor`) drive the REAL
// /api/bets/place route against the REAL local Postgres. This file imports
// EXISTING modules only — the greenfield attach orchestrator has its own
// unit RED (tests/unit/composer/image-attach.test.ts); here the uploadId is
// the seeded row's id, exactly what a completed attach hands the composer.
//
// Scenarios → plan-§1/§4 rows:
//   1. attach-id-lands → INV-1 (one bet + one comment, atomically paired —
//      now image-bearing) + F-COMMENT-3 (the comments row carries
//      image_uploads_id = the attached upload; the W-1 tx's CAS claims the
//      upload `committed` so the orphan sweep can never delete a rendered
//      image's bytes).
//   2. storage-object-missing belt → the §4 image-codes row (400
//      `error_storage_object_missing` → `p3_image`, inline on the
//      affordance) + the §5 fail-closed posture (AUDIT-FIX-A1: verify runs
//      PRE-MODERATION, pre-tx — the vendor is never called, the W-1 tx never
//      opens, zero rows land) + the key law (`keyOutcomeFor` → "terminal":
//      the 4xx is cached per key; a revise mints a fresh key).
//
// Harness (mirrors tests/integration/composer-place.integration.test.ts):
// always-miss idempotency mock (every request walks the durable pre-check);
// REAL `precommitModerate` over the vendor `moderate` mock + permissive
// reservation Redis; REAL `resolveImageAttachment` reading the SEEDED
// image_uploads row (ownership + `terminal_state IS NULL` exercised live).
// The ONLY storage-boundary mock is `verifyUploadedObject` — the R2
// HeadObject HTTP hop (the place-image-verify-fail-closed.test.ts pattern);
// scenario 1 resolves the {etag, byteSize} pass shape, scenario 2 throws the
// REAL `StorageObjectMissingError`. `signRead` is mocked and — unlike the
// text-only sibling — IS called on the image path (the moderation read-URL
// mint); the seeded r2 key satisfies precommit's `u/<userId>/<id>.<ext>`
// namespace gate.

const {
	mockGetSession,
	mockRelease,
	mockRedis,
	mockOpenAiModerate,
	mockSignRead,
	mockVerifyUploadedObject,
} = vi.hoisted(() => ({
	mockGetSession: vi.fn(),
	mockRelease: vi.fn(async (_response: unknown) => {}),
	// The REAL precommitModerate's reservation lifecycle: SET NX → "OK"
	// (always acquired), DEL in its finally. Permissive by design — the
	// reservation machine has its own suite (precommit-moderate).
	mockRedis: {
		set: vi.fn(async () => "OK"),
		get: vi.fn(async () => null),
		del: vi.fn(async () => 1),
		eval: vi.fn(async () => null),
	},
	mockOpenAiModerate: vi.fn(),
	// CALLED on the image path (scenario 1): precommitModerate mints the 60s
	// moderation read URL for the attached object before the vendor hop.
	mockSignRead: vi.fn(async () => "https://signed.example/moderation-read"),
	// The R2 HeadObject boundary (AUDIT-FIX-A1 verify) — the one storage mock.
	mockVerifyUploadedObject: vi.fn(),
}));

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
// Body-sensitive fingerprint + always-miss lookup — every request walks the
// DURABLE bet_receipts pre-check (the Redis-lost simulation, ADR-0031).
vi.mock("@/server/idempotency/cache", () => ({
	computeBodyFingerprint: vi.fn(async (body: unknown) => JSON.stringify(body)),
	idempotencyLookupOrReserve: vi.fn(async () => ({
		kind: "miss",
		release: mockRelease,
	})),
}));
vi.mock("@/server/upstash/redis", () => ({ redis: mockRedis }));
vi.mock("@/server/moderation/openai", () => ({
	moderate: mockOpenAiModerate,
}));
vi.mock("@/server/storage/sign-read", () => ({ signRead: mockSignRead }));
vi.mock("@/server/storage/verify-object", () => ({
	verifyUploadedObject: mockVerifyUploadedObject,
}));

import { POST as placePOST } from "@/app/api/bets/place/route";
import {
	parseWireResponse,
	type WireOutcome,
} from "@/components/debate/composer/envelope";
import { composeWireBody } from "@/components/debate/composer/payload";
import {
	buildPlaceRequest,
	type PlaceBody,
} from "@/components/debate/composer/requests";
import {
	keyOutcomeFor,
	mapWireError,
} from "@/components/debate/composer/state-map";
import {
	bets,
	comments,
	imageUploads,
	markets,
	pools,
	users,
} from "@/db/schema";
import { StorageObjectMissingError } from "@/lib/errors";
import { BET_MIN_STAKE_POST } from "@/server/config/limits";

import { testClient, testDb } from "../db/_fixtures/db";
import { truncateTables } from "../db/_fixtures/truncate";

const SEED_RESERVES = "100.000000000000000000";
const HARNESS_ORIGIN = "https://prd.example.com";
const SEEDED_BYTE_SIZE = 4096;

async function seedUser(emailTag: string, pseudonym: string): Promise<string> {
	const [user] = await testDb
		.insert(users)
		.values({
			name: "Durable Replay User",
			email: `${emailTag}@example.com`,
			pseudonym,
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
			title: "Durable Replay Market",
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

// A signed-and-PUT upload as the sign route leaves it: terminal_state NULL
// (un-attached — the resolveImageAttachment predicate), r2_object_key in the
// `u/{userId}/{uploadId}.{ext}` shape (SCAFFOLD.15 Q9 — REQUIRED by
// precommit's namespace gate). The id is supplied up-front because the key
// embeds it and Bucket B forbids a later back-fill.
async function seedImageUpload(
	userId: string,
): Promise<{ uploadId: string; r2ObjectKey: string }> {
	const uploadId = uuidv7();
	const r2ObjectKey = `u/${userId}/${uploadId}.png`;
	await testDb.insert(imageUploads).values({
		id: uploadId,
		userId,
		r2ObjectKey,
		contentType: "image/png",
		byteSize: SEEDED_BYTE_SIZE,
	});
	return { uploadId, r2ObjectKey };
}

// Scripted vendor verdict (the precommit-moderate `modResult` shape) —
// non-flagged pass; the moderation-block image path is the server suites'
// subject, not this slice's.
function passVerdict() {
	return {
		flagged: false,
		categories: { harassment: false },
		scores: { harassment: 0.01 },
	};
}

// EVERY request is built by the composer's OWN wiring builder — never a
// hand-rolled fetch init. Harness-only headers merged AFTER the builder so
// they can never mask a builder omission.
function composerRequest(body: PlaceBody, idempotencyKey: string): Request {
	const { url, init } = buildPlaceRequest({ body, idempotencyKey });
	expect(url).toBe("/api/bets/place");
	const headers = new Headers(init.headers);
	headers.set("origin", HARNESS_ORIGIN);
	headers.set("x-forwarded-for", "203.0.113.77");
	return new Request(`http://localhost${url}`, { ...init, headers });
}

function successData(outcome: WireOutcome): Record<string, unknown> {
	if (outcome.kind !== "success") {
		throw new Error(`expected success envelope, got ${outcome.kind}`);
	}
	if (typeof outcome.data !== "object" || outcome.data === null) {
		throw new Error("success data must be an object");
	}
	return outcome.data as Record<string, unknown>;
}

function errorOutcome(outcome: WireOutcome) {
	if (outcome.kind !== "error") {
		throw new Error(`expected error envelope, got ${outcome.kind}`);
	}
	return outcome;
}

async function betAndCommentRows(marketId: string) {
	const betRows = await testDb
		.select({ id: bets.id, commentId: bets.commentId })
		.from(bets)
		.where(eq(bets.marketId, marketId));
	const commentRows = await testDb
		.select({
			id: comments.id,
			body: comments.body,
			imageUploadsId: comments.imageUploadsId,
		})
		.from(comments)
		.where(eq(comments.marketId, marketId));
	return { betRows, commentRows };
}

async function uploadRow(uploadId: string) {
	const [row] = await testDb
		.select({
			terminalState: imageUploads.terminalState,
			terminalAt: imageUploads.terminalAt,
		})
		.from(imageUploads)
		.where(eq(imageUploads.id, uploadId));
	return row;
}

describe("UI.A3 slice 5 — imageUploadsId in the composer place payload", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockOpenAiModerate.mockResolvedValue(passVerdict());
	});

	afterEach(async () => {
		await truncateTables(testClient, [
			"events",
			"dharma_ledger",
			"bets",
			"comments",
			"positions",
			"pools",
			"markets",
			"image_uploads",
			"users",
			"bet_receipts",
			"mod_actions",
		]);
	});

	it("composer-image::attach-id-lands-on-the-comment [INV-1 · F-COMMENT-3]", async () => {
		const userId = await seedUser("ui-a3-image", "ui-a3-image");
		const marketId = await seedOpenMarketWithPool("ui-a3-image-market");
		await seedDharmaGrant(userId);
		const { uploadId, r2ObjectKey } = await seedImageUpload(userId);
		mockGetSession.mockResolvedValue({ user: { id: userId } });
		// The verify pass shape (VerifiedUpload): ETag + REAL landed size for
		// the append-only image_upload.committed audit record.
		mockVerifyUploadedObject.mockResolvedValue({
			etag: '"itest-etag-1"',
			byteSize: SEEDED_BYTE_SIZE,
		});

		const wireBody = composeWireBody({
			title: "durable replay argument",
			extended: "this is fine",
		});
		const placeBody: PlaceBody = {
			marketId,
			side: "YES",
			stake: BET_MIN_STAKE_POST,
			body: wireBody,
			// The §3.2 arm under test: a completed attach hands the composer
			// this uploadId and it rides the place payload.
			imageUploadsId: uploadId,
		};

		const res = await placePOST(
			composerRequest(placeBody, "ui-a3-image-attach-key-1"),
		);
		expect(res.status).toBe(200);
		const data = successData(await parseWireResponse(res));

		// The storage boundary was consulted for the SEEDED object key — the
		// resolve → verify chain ran against the real image_uploads row.
		expect(mockVerifyUploadedObject).toHaveBeenCalledWith(r2ObjectKey);

		// INV-1: exactly ONE bets row + ONE comments row, atomically paired —
		// and the comment CARRIES the attached upload (F-COMMENT-3).
		const { betRows, commentRows } = await betAndCommentRows(marketId);
		expect(betRows.length).toBe(1);
		expect(commentRows.length).toBe(1);
		expect(betRows[0]?.commentId).toBe(commentRows[0]?.id);
		expect(commentRows[0]?.id).toBe(data.commentId);
		expect(commentRows[0]?.imageUploadsId).toBe(uploadId);
		expect(commentRows[0]?.body).toBe(wireBody);

		// The W-1 tx's CAS claimed the upload in the SAME commit (place.ts):
		// terminal_state NULL → 'committed' + terminal_at set — the orphan
		// sweep can never delete a rendered image's object.
		const upload = await uploadRow(uploadId);
		expect(upload?.terminalState).toBe("committed");
		expect(upload?.terminalAt).not.toBeNull();
	});

	it("composer-image::storage-object-missing-belt-p3-image-terminal-no-rows [§4 image row · fail-closed]", async () => {
		const userId = await seedUser("ui-a3-image-miss", "ui-a3-image-miss");
		const marketId = await seedOpenMarketWithPool("ui-a3-image-miss-market");
		await seedDharmaGrant(userId);
		// The row resolves (owned, un-attached) — but the R2 OBJECT is gone
		// (swept / never landed): HeadObject 404 → the REAL error class.
		const { uploadId, r2ObjectKey } = await seedImageUpload(userId);
		mockGetSession.mockResolvedValue({ user: { id: userId } });
		mockVerifyUploadedObject.mockRejectedValue(
			new StorageObjectMissingError(r2ObjectKey),
		);

		const placeBody: PlaceBody = {
			marketId,
			side: "YES",
			stake: BET_MIN_STAKE_POST,
			body: composeWireBody({
				title: "durable replay argument",
				extended: "",
			}),
			imageUploadsId: uploadId,
		};

		const res = await placePOST(
			composerRequest(placeBody, "ui-a3-image-missing-key-1"),
		);
		expect(res.status).toBe(400);
		const err = errorOutcome(await parseWireResponse(res));
		expect(err.code).toBe("error_storage_object_missing");

		// The §4 row: image codes render P3 INLINE ON THE AFFORDANCE — the
		// composer (and the typed argument) survive; only the attach errors.
		expect(mapWireError({ code: err.code })).toEqual({ state: "p3_image" });
		// Key law: a terminal 4xx is CACHED per key (ADR-0031/0015) — the
		// lifecycle rotates on the next edit, never retries the held key.
		expect(keyOutcomeFor({ kind: "error", code: err.code })).toBe("terminal");

		// Fail-closed PRE-MODERATION (AUDIT-FIX-A1): the vendor hop never
		// fired — the verify throw blocked the request before step 6.
		expect(mockOpenAiModerate).not.toHaveBeenCalled();

		// ...and pre-tx: ZERO bet/comment rows landed, and the upload row is
		// untouched (terminal_state still NULL — no partial state leaked).
		const { betRows, commentRows } = await betAndCommentRows(marketId);
		expect(betRows.length).toBe(0);
		expect(commentRows.length).toBe(0);
		const upload = await uploadRow(uploadId);
		expect(upload?.terminalState).toBeNull();
	});
});
