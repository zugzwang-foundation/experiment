import { eq } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// MEDIA.1 §7 tests-first — the media-specific create scenarios (DB-backed,
// :54322). RED at COLLECTION until the new error classes land in
// `@/server/markets/errors` (the four VALUE imports below resolve against
// nothing today); thereafter RED on assertions until `createMarket` /
// `createMarketAction` / migration 0019 (`market_media` + `markets.media_video_url`
// + the one-default-per-market partial unique index) are implemented.
//
// Asserts (plan §1): the §15 media service invariant (≥1 image, exactly-one-
// default), create atomicity (market + media + market.created in one tx),
// strict insert-only on the client-supplied PK (no upsert), the OD-2 event
// contract (no new EVENT_TYPE — stays 23), and the Bucket-C / partial-unique
// storage backstops. Persisted-state is asserted on EVERY reject (half-tests
// discipline): no markets row AND no market_media rows, or the existing market
// left untouched.

// === admin-session mock recipe (ENGINE.15 §SESSION-MOCK) ===================
vi.mock("@sentry/nextjs", () => ({
	captureMessage: vi.fn(),
	addBreadcrumb: vi.fn(),
	captureException: vi.fn(),
}));

const { mockCookiesGet, mockHeadersGet } = vi.hoisted(() => ({
	mockCookiesGet: vi.fn(),
	mockHeadersGet: vi.fn(),
}));

vi.mock("next/headers", () => ({
	cookies: () => ({
		get: mockCookiesGet,
		set: vi.fn(),
		delete: vi.fn(),
	}),
	headers: () => ({
		get: mockHeadersGet,
	}),
}));

vi.mock("next/cache", () => ({
	revalidatePath: vi.fn(),
}));

import { events, markets } from "@/db/schema";
import { createMarketAction } from "@/server/admin/markets/create";
import { EVENT_TYPES } from "@/server/events/schemas";
import { createMarket } from "@/server/markets/create";
import {
	DefaultMediaRequiredError,
	MarketIdConflictError,
	MarketVideoUrlInvalidError,
	MediaRequiredError,
} from "@/server/markets/errors";

import { testClient, testDb } from "../../db/_fixtures/db";
import { truncateTables } from "../../db/_fixtures/truncate";

const ADMIN_COOKIE_NAME = "zugzwang_admin_session";
const NOW = new Date("2026-09-15T00:00:00.000Z");
const DEADLINE = new Date("2026-10-01T00:00:00.000Z");
const TITLE = "PLACEHOLDER — not a real market";
const DESCRIPTION = "PLACEHOLDER criterion — not a real criterion";

type MediaItem = {
	mediaId: string;
	key: string;
	displayOrder: number;
	isDefault: boolean;
};

function adminMetadata() {
	return {
		request_id: "test-media1",
		flow_id: "F-ADMIN-1",
		user_id: null,
		actor_id: "admin-singleton",
		idempotency_key: null,
		ip: "test",
		user_agent: "vitest",
	};
}

/** A single default image for `marketId`. */
function oneDefault(marketId: string): MediaItem[] {
	const mediaId = uuidv7();
	return [
		{
			mediaId,
			key: `m/${marketId}/${mediaId}.jpg`,
			displayOrder: 0,
			isDefault: true,
		},
	];
}

/** The createMarket service arg object (media-aware). */
function serviceArgs(opts: {
	marketId: string;
	slug: string;
	media: MediaItem[];
	mediaVideoUrl?: string | null;
	resolutionDeadline?: Date;
}) {
	return {
		marketId: opts.marketId,
		slug: opts.slug,
		title: TITLE,
		description: DESCRIPTION,
		resolutionDeadline: opts.resolutionDeadline ?? DEADLINE,
		now: NOW,
		media: opts.media,
		mediaVideoUrl: opts.mediaVideoUrl,
		metadata: adminMetadata(),
	};
}

/** Seed an admin_sessions row + point the cookie mock at it (valid session). */
async function withAdminSession(): Promise<string> {
	const sessionId = uuidv7();
	await testClient.unsafe(
		`INSERT INTO admin_sessions (session_id, issued_at, last_seen_at) VALUES ($1, now(), now())`,
		[sessionId],
	);
	mockCookiesGet.mockReturnValue({ name: ADMIN_COOKIE_NAME, value: sessionId });
	return sessionId;
}

function datetimeLocal(d: Date): string {
	return d.toISOString().slice(0, 16);
}

function createFormData(fields: {
	slug: string;
	marketId: string;
	media: MediaItem[];
	mediaVideoUrl?: string;
}): FormData {
	const fd = new FormData();
	fd.append("slug", fields.slug);
	fd.append("title", TITLE);
	fd.append("description", DESCRIPTION);
	fd.append("resolutionDeadline", datetimeLocal(DEADLINE));
	fd.append("marketId", fields.marketId);
	fd.append("media", JSON.stringify(fields.media));
	if (fields.mediaVideoUrl !== undefined) {
		fd.append("mediaVideoUrl", fields.mediaVideoUrl);
	}
	return fd;
}

async function marketRowsBySlug(slug: string) {
	return testDb
		.select({ id: markets.id })
		.from(markets)
		.where(eq(markets.slug, slug));
}

async function allEventRows() {
	return testDb.select({ eventId: events.eventId }).from(events);
}

async function createdEventRows() {
	return testDb
		.select({ payload: events.payload, eventType: events.eventType })
		.from(events)
		.where(eq(events.eventType, "market.created"));
}

type MediaRow = {
	id: string;
	market_id: string;
	r2_object_key: string;
	display_order: number;
	is_default: boolean;
	created_by: string;
};

async function marketMediaRows(marketId: string): Promise<MediaRow[]> {
	return (await testClient.unsafe(
		`SELECT id, market_id, r2_object_key, display_order, is_default, created_by
		   FROM market_media WHERE market_id = $1 ORDER BY display_order`,
		[marketId],
	)) as unknown as MediaRow[];
}

async function marketMediaCount(marketId: string): Promise<number> {
	const rows = (await testClient.unsafe(
		`SELECT count(*)::int AS n FROM market_media WHERE market_id = $1`,
		[marketId],
	)) as unknown as Array<{ n: number }>;
	return rows[0]?.n ?? 0;
}

beforeEach(() => {
	mockCookiesGet.mockReset();
	mockHeadersGet.mockReset();
});

afterEach(async () => {
	// `market_media` is NOT named explicitly: `TRUNCATE markets CASCADE`
	// cascades to it post-0019 (FK market_media.market_id → markets.id), while
	// the un-named form still succeeds PRE-impl when the table does not yet
	// exist — so cleanup never throws and RED stays the intended assertion (not
	// a leaked-slug `MarketSlugTakenError`).
	await truncateTables(testClient, [
		"events",
		"pools",
		"markets",
		"admin_sessions",
	]);
	vi.clearAllMocks();
});

// === createMarket (service) — media create =================================

describe("createMarket — admin market-media create (service)", () => {
	it("admin-media::create-is-atomic", async () => {
		const marketId = uuidv7();
		const m0: MediaItem = {
			mediaId: uuidv7(),
			key: `m/${marketId}/${uuidv7()}.jpg`,
			displayOrder: 0,
			isDefault: true,
		};
		const m1: MediaItem = {
			mediaId: uuidv7(),
			key: `m/${marketId}/${uuidv7()}.png`,
			displayOrder: 1,
			isDefault: false,
		};

		const result = await createMarket(
			serviceArgs({ marketId, slug: "media-atomic", media: [m0, m1] }),
		);

		// Exactly ONE markets row, Draft, at the SUPPLIED id (insert-only).
		expect(result.marketId).toBe(marketId);
		const marketRows = await testDb
			.select({ id: markets.id, status: markets.status })
			.from(markets)
			.where(eq(markets.id, marketId));
		expect(marketRows.length).toBe(1);
		expect(marketRows[0]?.status).toBe("Draft");

		// N market_media rows, correct columns, created_by admin-singleton.
		const mediaRows = await marketMediaRows(marketId);
		expect(mediaRows.length).toBe(2);
		expect(mediaRows[0]).toMatchObject({
			market_id: marketId,
			r2_object_key: m0.key,
			display_order: 0,
			is_default: true,
			created_by: "admin-singleton",
		});
		expect(mediaRows[1]).toMatchObject({
			market_id: marketId,
			r2_object_key: m1.key,
			display_order: 1,
			is_default: false,
			created_by: "admin-singleton",
		});

		// Exactly ONE market.created event carrying the manifest in its payload.
		const eventRows = await createdEventRows();
		expect(eventRows.length).toBe(1);
		expect(eventRows[0]?.payload).toEqual({
			marketId,
			resolutionDeadline: DEADLINE.toISOString(),
			media: [
				{ key: m0.key, displayOrder: 0, isDefault: true },
				{ key: m1.key, displayOrder: 1, isDefault: false },
			],
			mediaVideoUrl: null,
		});
	});

	it("admin-media::media-key-outside-namespace-rejects", async () => {
		// Q3 R2 facet (defense-in-depth): a media key NOT in this market's
		// `m/<marketId>/` namespace (e.g. aimed at another market's object) is
		// rejected; NO markets row, NO market_media rows persist. Makes the §5
		// "row-driven display cannot surface foreign media" guarantee hold by
		// construction, not by trusting the client-submitted key.
		const marketId = uuidv7();
		const foreignId = uuidv7();
		const caught = await createMarket(
			serviceArgs({
				marketId,
				slug: "media-foreign-key",
				media: [
					{
						mediaId: uuidv7(),
						key: `m/${foreignId}/${uuidv7()}.jpg`,
						displayOrder: 0,
						isDefault: true,
					},
				],
			}),
		).catch((e: unknown) => e);
		expect(caught).toBeInstanceOf(Error);

		expect((await marketRowsBySlug("media-foreign-key")).length).toBe(0);
		expect(await marketMediaCount(marketId)).toBe(0);
		expect((await allEventRows()).length).toBe(0);
	});

	it("admin-media::event-stays-market-created-no-new-type", async () => {
		const marketId = uuidv7();
		await createMarket(
			serviceArgs({
				marketId,
				slug: "media-event-type",
				media: oneDefault(marketId),
			}),
		);

		// OD-2: MEDIA.1 adds NO new EVENT_TYPE / aggregate_type. The absolute count
		// is 24 post-AUDIT-FIX-B5 (which added `moderation.blocked`, A13).
		expect(EVENT_TYPES.length).toBe(24);

		const all = await testDb
			.select({
				eventType: events.eventType,
				aggregateType: events.aggregateType,
				payload: events.payload,
			})
			.from(events);
		expect(all.length).toBe(1);
		expect(all[0]?.eventType).toBe("market.created");
		expect(all[0]?.aggregateType).toBe("market");
		// The manifest rides the EXISTING event's payload (the OD-2 RED driver).
		expect(all[0]?.payload).toMatchObject({ media: expect.any(Array) });
	});

	it("admin-media::media-required-empty-rejects", async () => {
		const marketId = uuidv7();
		const caught = await createMarket(
			serviceArgs({ marketId, slug: "media-required-svc", media: [] }),
		).catch((e: unknown) => e);
		expect(caught).toBeInstanceOf(MediaRequiredError);

		// Persisted-state: NO markets row AND no market_media rows AND no event.
		expect((await marketRowsBySlug("media-required-svc")).length).toBe(0);
		expect(await marketMediaCount(marketId)).toBe(0);
		expect((await allEventRows()).length).toBe(0);
	});

	it("admin-media::default-media-required-zero-and-two-defaults-reject", async () => {
		// Zero defaults.
		const zeroId = uuidv7();
		const zero: MediaItem[] = [
			{
				mediaId: uuidv7(),
				key: `m/${zeroId}/${uuidv7()}.jpg`,
				displayOrder: 0,
				isDefault: false,
			},
			{
				mediaId: uuidv7(),
				key: `m/${zeroId}/${uuidv7()}.jpg`,
				displayOrder: 1,
				isDefault: false,
			},
		];
		const caughtZero = await createMarket(
			serviceArgs({ marketId: zeroId, slug: "default-zero-svc", media: zero }),
		).catch((e: unknown) => e);
		expect(caughtZero).toBeInstanceOf(DefaultMediaRequiredError);
		expect((await marketRowsBySlug("default-zero-svc")).length).toBe(0);
		expect(await marketMediaCount(zeroId)).toBe(0);

		// Two defaults.
		const twoId = uuidv7();
		const two: MediaItem[] = [
			{
				mediaId: uuidv7(),
				key: `m/${twoId}/${uuidv7()}.jpg`,
				displayOrder: 0,
				isDefault: true,
			},
			{
				mediaId: uuidv7(),
				key: `m/${twoId}/${uuidv7()}.jpg`,
				displayOrder: 1,
				isDefault: true,
			},
		];
		const caughtTwo = await createMarket(
			serviceArgs({ marketId: twoId, slug: "default-two-svc", media: two }),
		).catch((e: unknown) => e);
		expect(caughtTwo).toBeInstanceOf(DefaultMediaRequiredError);
		expect((await marketRowsBySlug("default-two-svc")).length).toBe(0);
		expect(await marketMediaCount(twoId)).toBe(0);

		expect((await allEventRows()).length).toBe(0);
	});

	it("admin-media::video-url-invalid-rejects", async () => {
		const marketId = uuidv7();
		const caught = await createMarket(
			serviceArgs({
				marketId,
				slug: "video-invalid-svc",
				media: oneDefault(marketId),
				mediaVideoUrl: "https://vimeo.com/76979871",
			}),
		).catch((e: unknown) => e);
		expect(caught).toBeInstanceOf(MarketVideoUrlInvalidError);

		expect((await marketRowsBySlug("video-invalid-svc")).length).toBe(0);
		expect(await marketMediaCount(marketId)).toBe(0);
		expect((await allEventRows()).length).toBe(0);
	});

	it("admin-media::valid-youtube-url-round-trips-into-column-and-event", async () => {
		const marketId = uuidv7();
		const url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
		await createMarket(
			serviceArgs({
				marketId,
				slug: "video-valid-svc",
				media: oneDefault(marketId),
				mediaVideoUrl: url,
			}),
		);

		// Stored on markets.media_video_url (read raw — column is new in 0019).
		const rows = (await testClient.unsafe(
			`SELECT media_video_url FROM markets WHERE id = $1`,
			[marketId],
		)) as unknown as Array<{ media_video_url: string | null }>;
		expect(rows[0]?.media_video_url).toBe(url);

		// And on the event payload.
		const eventRows = await createdEventRows();
		expect(eventRows[0]?.payload).toMatchObject({ mediaVideoUrl: url });
	});

	it("admin-media::supplied-existing-marketId-rejects-and-leaves-existing-untouched", async () => {
		const marketId = uuidv7();
		// First create — committed under id X.
		await createMarket(
			serviceArgs({
				marketId,
				slug: "conflict-first",
				media: oneDefault(marketId),
			}),
		);
		const before = (
			await testDb
				.select({
					id: markets.id,
					slug: markets.slug,
					title: markets.title,
					status: markets.status,
					createdBy: markets.createdBy,
				})
				.from(markets)
				.where(eq(markets.id, marketId))
		)[0];
		const beforeMediaCount = await marketMediaCount(marketId);

		// Second create — SAME marketId X, DIFFERENT slug, valid media.
		const caught = await createMarket(
			serviceArgs({
				marketId,
				slug: "conflict-second",
				media: oneDefault(marketId),
			}),
		).catch((e: unknown) => e);
		// Strict insert-only: a PK collision is a TYPED error, NEVER a raw 500.
		expect(caught).toBeInstanceOf(MarketIdConflictError);

		// The existing market's row is byte-for-byte unchanged.
		const after = (
			await testDb
				.select({
					id: markets.id,
					slug: markets.slug,
					title: markets.title,
					status: markets.status,
					createdBy: markets.createdBy,
				})
				.from(markets)
				.where(eq(markets.id, marketId))
		)[0];
		expect(after).toEqual(before);

		// The conflicting create wrote nothing: no second-slug market, no new
		// media attached to X, exactly one market.created event (the first).
		expect((await marketRowsBySlug("conflict-second")).length).toBe(0);
		expect(await marketMediaCount(marketId)).toBe(beforeMediaCount);
		expect((await createdEventRows()).length).toBe(1);
	});
});

// === createMarketAction (wire) — media error mapping =======================

describe("createMarketAction — admin market-media create (wire mapping)", () => {
	it("admin-media-wire::media-required-empty", async () => {
		await withAdminSession();
		const marketId = uuidv7();
		const result = await createMarketAction(
			createFormData({ slug: "media-required-wire", marketId, media: [] }),
		);
		expect(result.ok).toBe(false);
		if (result.ok) throw new Error("unreachable — asserted not-ok above");
		expect(result.error.code).toBe("media_required");

		expect((await marketRowsBySlug("media-required-wire")).length).toBe(0);
		expect(await marketMediaCount(marketId)).toBe(0);
	});

	it("admin-media-wire::default-media-required", async () => {
		await withAdminSession();
		const marketId = uuidv7();
		const media: MediaItem[] = [
			{
				mediaId: uuidv7(),
				key: `m/${marketId}/${uuidv7()}.jpg`,
				displayOrder: 0,
				isDefault: false,
			},
		];
		const result = await createMarketAction(
			createFormData({ slug: "default-req-wire", marketId, media }),
		);
		expect(result.ok).toBe(false);
		if (result.ok) throw new Error("unreachable — asserted not-ok above");
		expect(result.error.code).toBe("default_media_required");

		expect((await marketRowsBySlug("default-req-wire")).length).toBe(0);
		expect(await marketMediaCount(marketId)).toBe(0);
	});

	it("admin-media-wire::video-url-invalid", async () => {
		await withAdminSession();
		const marketId = uuidv7();
		const result = await createMarketAction(
			createFormData({
				slug: "video-invalid-wire",
				marketId,
				media: oneDefault(marketId),
				mediaVideoUrl: "https://vimeo.com/76979871",
			}),
		);
		expect(result.ok).toBe(false);
		if (result.ok) throw new Error("unreachable — asserted not-ok above");
		expect(result.error.code).toBe("video_url_invalid");

		expect((await marketRowsBySlug("video-invalid-wire")).length).toBe(0);
		expect(await marketMediaCount(marketId)).toBe(0);
	});

	it("admin-media-wire::market-id-conflict-leaves-existing-untouched", async () => {
		await withAdminSession();
		const marketId = uuidv7();

		const first = await createMarketAction(
			createFormData({
				slug: "conflict-wire-first",
				marketId,
				media: oneDefault(marketId),
			}),
		);
		expect(first.ok).toBe(true);

		// SAME marketId, different slug → strict insert-only rejects (mapped).
		const second = await createMarketAction(
			createFormData({
				slug: "conflict-wire-second",
				marketId,
				media: oneDefault(marketId),
			}),
		);
		expect(second.ok).toBe(false);
		if (second.ok) throw new Error("unreachable — asserted not-ok above");
		expect(second.error.code).toBe("market_id_conflict");

		// First market intact; the conflicting create wrote nothing.
		expect((await marketRowsBySlug("conflict-wire-first")).length).toBe(1);
		expect((await marketRowsBySlug("conflict-wire-second")).length).toBe(0);
	});
});

// === market_media storage backstops ========================================

describe("market_media — storage backstops", () => {
	async function seedMarket(slug: string): Promise<string> {
		const [m] = await testDb
			.insert(markets)
			.values({
				slug,
				title: TITLE,
				description: DESCRIPTION,
				resolutionDeadline: DEADLINE,
			})
			.returning({ id: markets.id });
		return m?.id ?? "";
	}

	async function insertMedia(
		marketId: string,
		displayOrder: number,
		isDefault: boolean,
	) {
		return testClient.unsafe(
			`INSERT INTO market_media (market_id, r2_object_key, display_order, is_default)
			   VALUES ($1, $2, $3, $4)`,
			[marketId, `m/${marketId}/${uuidv7()}.jpg`, displayOrder, isDefault],
		);
	}

	it("admin-media::partial-unique-one-default-per-market-23505", async () => {
		const marketId = await seedMarket("mm-uq-a");

		// First default row — OK.
		await insertMedia(marketId, 0, true);

		// Second default row, SAME market → the partial unique index → 23505.
		const caught = await insertMedia(marketId, 1, true).catch(
			(e: unknown) => e,
		);
		expect((caught as { code?: string })?.code).toBe("23505");

		// Control: a NON-default row for the same market is allowed.
		await expect(insertMedia(marketId, 2, false)).resolves.toBeDefined();

		// Control: a default row for a DIFFERENT market is allowed.
		const otherId = await seedMarket("mm-uq-b");
		await expect(insertMedia(otherId, 0, true)).resolves.toBeDefined();
	});

	it("admin-media::market_media-is-bucket-C-mutable", async () => {
		const marketId = await seedMarket("mm-mutable");
		const inserted = (await testClient.unsafe(
			`INSERT INTO market_media (market_id, r2_object_key, display_order, is_default)
			   VALUES ($1, $2, 0, true) RETURNING id`,
			[marketId, `m/${marketId}/${uuidv7()}.jpg`],
		)) as unknown as Array<{ id: string }>;
		const id = inserted[0]?.id ?? "";

		// Bucket C: UPDATE is allowed (no append-only trigger, unlike Bucket A).
		await testClient.unsafe(
			`UPDATE market_media SET display_order = 5 WHERE id = $1`,
			[id],
		);
		const updated = (await testClient.unsafe(
			`SELECT display_order FROM market_media WHERE id = $1`,
			[id],
		)) as unknown as Array<{ display_order: number }>;
		expect(updated[0]?.display_order).toBe(5);

		// Bucket C: DELETE is allowed.
		await testClient.unsafe(`DELETE FROM market_media WHERE id = $1`, [id]);
		const remaining = (await testClient.unsafe(
			`SELECT count(*)::int AS n FROM market_media WHERE id = $1`,
			[id],
		)) as unknown as Array<{ n: number }>;
		expect(remaining[0]?.n).toBe(0);
	});
});
