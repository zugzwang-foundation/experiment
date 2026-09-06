import { afterEach, describe, expect, it, vi } from "vitest";

// MEDIA-SECOND-ROW Slice 1 (docs/plans/MEDIA-SECOND-ROW.md, "Test plan") — the
// DB-backed selection cases for the two sibling read helpers that live side by
// side in `src/server/discovery/media.ts`:
//
//   getDefaultMarketMediaUrl   → the market's `is_default` row. Called from
//                                `listOpenMarkets` (`discovery/list.ts`), the
//                                Discovery tile's read. UNCHANGED by this
//                                slice (zero-line diff) — case 1 is the guard
//                                on that.
//   getMarketMediaUrls         → `ORDER BY is_default ASC, display_order ASC,
//                                id ASC`, both images from ONE result set.
//                                Called from `loadDebateView`. Its `.secondary`
//                                arm is the Market-Detail header's image: the
//                                lowest-`display_order` NON-default row,
//                                falling back to the sole `is_default` row when
//                                no sibling exists — the fallback is the ORDER
//                                BY's natural result, not a branch, so case 3
//                                is what pins it.
//
// ⚠⚠ THE SECOND NAME CHANGED AT UI-OVERNIGHT entry 4, AND SO DID WHAT THE TWO
// READERS FEED. This block read `getSecondaryMarketMediaUrl … feeding BOTH
// `MarketMediaPanel` and `FocusMarketCard``. They are no longer the same image:
// `FocusMarketCard` is the LOCKED market-card composition, the same one
// Discovery renders, and it was showing a different picture of the same market
// than the card a reader had just clicked. It takes the DEFAULT row now — the
// `.thumb` arm — while the header's panel keeps the secondary.
// ⛔ THE SELECTION RULE ITSELF IS UNTOUCHED, which is why these cases are
// re-pointed rather than rewritten: one function now makes both choices from
// one `SELECT`, so the ordering has exactly one implementation instead of two
// that could drift.
//
// Plan item 5 — the exactly-one-`is_default`-per-market storage backstop
// (`market_media_one_default_per_market_uq`) — is "re-run not re-written". It
// is ALREADY covered, and covered well, by
// `admin-media::partial-unique-one-default-per-market-23505` in
// `tests/server/admin/markets-media.test.ts`: a raw INSERT
// bypassing the service asserts the 23505, with both controls (a NON-default
// row on the same market is allowed; a default row on a DIFFERENT market is
// allowed). It is deliberately NOT duplicated here. It matters to this file
// because `ORDER BY is_default ASC … LIMIT 1` is only deterministic in the
// fallback case while at most one default row can exist.
//
// DB-BACKED (local Postgres :54322). Fixtures bypass the application layer and
// seed `markets` + `market_media` directly (SPEC.2 §6.6). That is also how the
// zero-row case (4) reaches a state the service forbids — SPEC.1 §15 F-ADMIN-1
// requires ≥1 image at create, but NO storage constraint requires a
// `market_media` row, so the read's defensive `null` arm is reachable only from
// a direct seed. Both helpers document that arm; nothing exercised it.
//
// R2 is mocked at the module boundary (the `tests/server/discovery/list.test.ts`
// precedent) — the mock exposes ONLY `mintReadUrl`, which pins the
// `market-media` bucket arm (never the participant-hardcoded `signRead`
// "uploads" seam, ADR-0026 / SPEC.2 §12.1) and keeps every assertion below
// meaningful. ⚠ WITHOUT the mock this file would be worse than useless:
// `resolveBucketEnv("market-media")` throws for want of R2_*_MARKET_MEDIA in
// the test env, BOTH helpers swallow that into `null` in their catch, so cases
// 1–3 would fail on the real defect's opposite and case 4 would pass VACUOUSLY.
//
// The `it()` names are new `market-media::*` tokens; there is no SPEC.1 §17
// registry row for this surface (the sibling `admin-media::*` names in
// markets-media.test.ts are likewise file-local).

vi.mock("@/server/storage/r2", () => ({
	mintReadUrl: vi.fn(
		async (bucket: string, key: string, ttlSeconds: number) =>
			`https://signed.test/${bucket}/${key}?ttl=${ttlSeconds}`,
	),
}));

import { marketMedia, markets } from "@/db/schema";
// The mocked module — imported ONLY to assert the sign calls (bucket + key).
import { RENDER_IMAGE_CACHE_CONTROL } from "@/server/config/limits";
import {
	getDefaultMarketMediaUrl,
	getMarketMediaUrls,
} from "@/server/discovery/media";
import { mintReadUrl } from "@/server/storage/r2";

import { testClient, testDb } from "../db/_fixtures/db";
import { truncateTables } from "../db/_fixtures/truncate";

const DEADLINE = new Date("2027-01-01T00:00:00.000Z");

/**
 * The presign TTL both helpers pass (the module-level `READ_URL_TTL_SECONDS`
 * constant in `discovery/media.ts`) —
 * pinned, not incidental: the two siblings must ride the SAME
 * `signReadMarketMedia` seam at the SAME TTL, so a helper that drifted onto its
 * own TTL fails here rather than silently serving a shorter-lived URL to one of
 * the two render sites.
 */
const READ_URL_TTL_SECONDS = 7200;

/** Mirrors the mock above — the exact URL a correctly-signed key produces. */
function signed(key: string): string {
	return `https://signed.test/market-media/${key}?ttl=${READ_URL_TTL_SECONDS}`;
}

async function seedMarket(slug: string): Promise<string> {
	const [m] = await testDb
		.insert(markets)
		.values({
			slug,
			title: `Market ${slug}`,
			description: "Resolves YES if the header reads a row the tile does not.",
			status: "Open",
			resolutionDeadline: DEADLINE,
		})
		.returning({ id: markets.id });
	return m?.id ?? "";
}

async function seedMedia(
	rows: ReadonlyArray<{
		marketId: string;
		key: string;
		displayOrder: number;
		isDefault: boolean;
	}>,
): Promise<void> {
	await testDb.insert(marketMedia).values(
		rows.map((r) => ({
			marketId: r.marketId,
			r2ObjectKey: r.key,
			displayOrder: r.displayOrder,
			isDefault: r.isDefault,
		})),
	);
}

afterEach(async () => {
	await truncateTables(testClient, ["market_media", "markets"]);
	vi.clearAllMocks();
});

describe("market media selection — the tile row vs the header row", () => {
	// ── 1. The Discovery tile's read is untouched by the second row ───────────
	it("market-media::tile-still-resolves-the-default-row-when-a-second-row-exists", async () => {
		const marketId = await seedMarket("mms-tile-unchanged");
		const defaultKey = `m/${marketId}/tile-default.png`;
		const secondKey = `m/${marketId}/panel-second.png`;

		// Row A is the default; row B is the non-default sibling this slice adds
		// to production data. Inserted B-first so "whichever row was written
		// first" and "whichever UUIDv7 sorts lowest" both point at the WRONG row.
		await seedMedia([
			{
				marketId,
				key: secondKey,
				displayOrder: 1,
				isDefault: false,
			},
			{
				marketId,
				key: defaultKey,
				displayOrder: 0,
				isDefault: true,
			},
		]);

		const url = await getDefaultMarketMediaUrl(testDb, marketId);

		// The whole point of the zero-line diff: the tile keeps resolving row A.
		expect(url).toBe(signed(defaultKey));
		// …and never the sibling — the discriminator. A read that dropped the
		// `is_default` predicate (or was "helpfully" pointed at the new ORDER BY)
		// resolves `panel-second.png` and fails here.
		expect(url).not.toContain("panel-second");
		expect(vi.mocked(mintReadUrl)).toHaveBeenCalledWith(
			"market-media",
			defaultKey,
			READ_URL_TTL_SECONDS,
			RENDER_IMAGE_CACHE_CONTROL,
			expect.any(Date),
		);
	});

	// ── 2. The header's read picks the lowest-display_order NON-default row ───
	it("market-media::panel-picks-the-lowest-display_order-non-default-row", async () => {
		const marketId = await seedMarket("mms-panel-lowest-order");
		const defaultKey = `m/${marketId}/tile-default.png`;
		const secondKey = `m/${marketId}/panel-second.png`;
		const thirdKey = `m/${marketId}/panel-third.png`;

		// Insertion order is deliberately NOT display order: order 2 lands before
		// order 1, and the default row lands last. A `LIMIT 1` that forgot its
		// ORDER BY, or ordered on the PK, resolves `panel-third` and fails.
		await seedMedia([
			{ marketId, key: thirdKey, displayOrder: 2, isDefault: false },
			{ marketId, key: secondKey, displayOrder: 1, isDefault: false },
			{ marketId, key: defaultKey, displayOrder: 0, isDefault: true },
		]);

		const url = (await getMarketMediaUrls(testDb, marketId)).secondary;

		expect(url).toBe(signed(secondKey));
		// Not the later non-default sibling (display_order ordering)…
		expect(url).not.toContain("panel-third");
		// …and NOT the default row, which carries the LOWEST display_order of the
		// three (0). `is_default ASC` has to outrank `display_order ASC` for this
		// to hold — a query that ordered on display_order alone fails right here.
		expect(url).not.toContain("tile-default");
		expect(vi.mocked(mintReadUrl)).toHaveBeenCalledWith(
			"market-media",
			secondKey,
			READ_URL_TTL_SECONDS,
			RENDER_IMAGE_CACHE_CONTROL,
			expect.any(Date),
		);

		// Control — on the SAME seed, the tile's read still resolves the default
		// row. This is the divergence the slice exists to create: two helpers,
		// one market, two different rows.
		expect(await getDefaultMarketMediaUrl(testDb, marketId)).toBe(
			signed(defaultKey),
		);
	});

	// ── 2b. Both arms, one statement — the UI-OVERNIGHT entry 4 case ─────────
	it("market-media::one-read-returns-the-tile-row-AND-the-panel-row", async () => {
		// ⛔ THE ASSERTION ENTRY 4 EXISTS FOR. The post arm's market card renders
		// the LOCKED card composition — the same one Discovery renders — and it
		// was showing the HEADER's image, so the market changed its face when a
		// reader entered a post from the card they had just clicked. Both rows now
		// come back from one call, and the card takes `.thumb`.
		const marketId = await seedMarket("mms-both-arms");
		const defaultKey = `m/${marketId}/tile-default.png`;
		const secondKey = `m/${marketId}/panel-second.png`;

		await seedMedia([
			{ marketId, key: secondKey, displayOrder: 1, isDefault: false },
			{ marketId, key: defaultKey, displayOrder: 0, isDefault: true },
		]);

		const { thumb, secondary } = await getMarketMediaUrls(testDb, marketId);

		expect(thumb).toBe(signed(defaultKey));
		expect(secondary).toBe(signed(secondKey));
		// ⚠ THEY MUST DIFFER HERE. Equal URLs would mean the two arms had
		// collapsed onto one row again — which is either the defect this case
		// closes or the one-row fallback (case 3) firing on a two-row market.
		expect(thumb).not.toBe(secondary);
		// …and the tile arm agrees with the reader Discovery's own card calls, so
		// "the same picture" is a fact about the two READS and not only about two
		// strings that happen to match today.
		expect(thumb).toBe(await getDefaultMarketMediaUrl(testDb, marketId));
	});

	// ── 3. One row (every market in production today) → the fallback ──────────
	it("market-media::panel-falls-back-to-the-default-row-when-it-is-the-only-row", async () => {
		const marketId = await seedMarket("mms-panel-fallback");
		const defaultKey = `m/${marketId}/tile-default.png`;

		// The shape of EVERY market in production before the Slice-1 data step:
		// exactly one row, and it is the `is_default` one.
		await seedMedia([
			{ marketId, key: defaultKey, displayOrder: 0, isDefault: true },
		]);

		const panelUrl = (await getMarketMediaUrls(testDb, marketId)).secondary;
		const tileUrl = await getDefaultMarketMediaUrl(testDb, marketId);

		// The sole candidate is returned — no branch, no null, no throw.
		expect(panelUrl).toBe(signed(defaultKey));
		// …and it is the SAME row the tile resolves: on a one-row market the two
		// helpers agree, which is what makes the slice a no-op until the data
		// step lands the second rows.
		expect(panelUrl).toBe(tileUrl);
		expect(vi.mocked(mintReadUrl)).toHaveBeenCalledWith(
			"market-media",
			defaultKey,
			READ_URL_TTL_SECONDS,
			RENDER_IMAGE_CACHE_CONTROL,
			expect.any(Date),
		);
	});

	// ── 4. Zero rows → null from BOTH, never a throw ──────────────────────────
	it("market-media::neither-helper-throws-on-a-market-with-no-media-rows", async () => {
		// Deliberately bypassing SPEC.1 §15 F-ADMIN-1 (createMarket requires ≥1
		// image + exactly one default): the fixture writes `markets` directly, and
		// no storage constraint requires a `market_media` row. This is the only
		// way to reach the defensive arm both helpers document.
		const marketId = await seedMarket("mms-no-media-rows");

		// `.resolves` rather than a bare await: a throw is the failure mode under
		// test (a 500 on the Discovery grid / the debate view), and `.resolves`
		// distinguishes "returned null" from "rejected" in the failure message.
		await expect(
			getDefaultMarketMediaUrl(testDb, marketId),
		).resolves.toBeNull();
		await expect(
			getMarketMediaUrls(testDb, marketId).then((m) => m.secondary),
		).resolves.toBeNull();

		// The `null` came from the no-row branch, NOT from a presign that threw
		// and got swallowed by the catch — the two are indistinguishable at the
		// return value and only one of them is the behaviour being asserted.
		// (Cases 1–3 are the positive control that this mock fires at all.)
		expect(vi.mocked(mintReadUrl)).not.toHaveBeenCalled();
	});
});
