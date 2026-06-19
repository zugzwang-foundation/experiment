import { v7 as uuidv7 } from "uuid";

import { imageUploads, markets, pools, users } from "@/db/schema";

import { testDb } from "../../../db/_fixtures/db";

// DEBATE.7 §10 — thin local seed/request helpers for the route-driven
// reactive-moderation consequence tests (track-a / track-b-blocked / carve-out
// / image-block). Mirrors the EXISTING boilerplate in
// `tests/server/bets/atomicity.test.ts` verbatim (no new fixture machinery) so
// the four consequence files share one shape. The REAL DB tx hits test
// Postgres; the moderation verdict is mocked per-test.

const SEED_RESERVES = "100.000000000000000000";

export function placeRequest(body: unknown, idempotencyKey: string): Request {
	return new Request("https://prd.example.com/api/bets/place", {
		method: "POST",
		headers: {
			"content-type": "application/json",
			origin: "https://prd.example.com",
			"Idempotency-Key": idempotencyKey,
			"x-forwarded-for": "203.0.113.21",
		},
		body: JSON.stringify(body),
	});
}

export async function seedUser(
	emailTag: string,
	pseudonym: string,
): Promise<string> {
	const [user] = await testDb
		.insert(users)
		.values({
			name: "DEBATE.7 Moderation User",
			email: `${emailTag}@example.com`,
			pseudonym,
			tosAcceptedAt: new Date("2026-01-01T00:00:00Z"),
		})
		.returning({ id: users.id });
	return user?.id ?? "";
}

export async function seedOpenMarketWithPool(slug: string): Promise<string> {
	const [market] = await testDb
		.insert(markets)
		.values({
			slug,
			title: "DEBATE.7 Moderation Market",
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

export async function seedDharmaGrant(userId: string): Promise<void> {
	const { appendLedgerRow } = await import("@/server/dharma/persist");
	await testDb.transaction((tx) =>
		appendLedgerRow(tx, {
			userId,
			amount: "1000",
			entryType: "initial_grant",
		}),
	);
}

// An un-attached (terminal_state IS NULL) image_uploads row owned by `userId`,
// with the `u/<userId>/<uploadId>.<ext>` r2 key shape the precommit boundary +
// place() CAS expect. The route resolves it pre-tx; the image-block flow flips
// it to 'blocked'.
export async function seedImageUpload(userId: string): Promise<{
	uploadId: string;
	r2ObjectKey: string;
}> {
	// Mint the uploadId client-side so the final r2_object_key is written at
	// INSERT time. r2_object_key is immutable post-INSERT (the Bucket-B
	// enforce_image_uploads_terminal_atomic trigger rejects any change other than
	// the terminal_state+terminal_at transition), so it must NOT be UPDATEd
	// afterward — mirrors tests/server/comments/media.test.ts::seedImageUpload.
	const uploadId = uuidv7();
	const r2ObjectKey = `u/${userId}/${uploadId}.jpg`;
	await testDb.insert(imageUploads).values({
		id: uploadId,
		userId,
		r2ObjectKey,
		contentType: "image/jpeg",
		byteSize: 4096,
	});
	return { uploadId, r2ObjectKey };
}
