import { eq } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";
import { afterAll, beforeAll, describe, it, vi } from "vitest";

// ═══════════════════════════════════════════════════════════════════════════
// SECOND CONCURRENCY-TEST MARKET — P4.3: confirm the shared write-limit
// observed against `concurrency-test-market` is scoped PER-MARKET, not
// global, via a side-by-side burst against two different markets at once.
// This script's only job is a second market to burst against — reuses the
// existing `concurrency-test-*` participant pool (500 already seeded by
// concurrency-setup.staging.test.ts), no new participants, no image posts:
// this measurement doesn't need market content, just an Open market with a
// real pool. ADD-ONLY, idempotent — same market-status-aware reuse pattern
// as the sibling setup script.
// ═══════════════════════════════════════════════════════════════════════════

const VOLUME_INTENT_ENV = "ZUGZWANG_STAGING_VOLUME_WRITE_ACK";
const VOLUME_INTENT_VALUE = "generate-staging-volume-fixture";

const MARKET_SLUG = "concurrency-test-market-b";
const MARKET_TITLE =
	"Concurrency test B — is the write-limit per-market or global?";

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

import { markets } from "@/db/schema";
import { canonicalizeAmount18 } from "@/server/admin/wire";
import { createMarket } from "@/server/markets/create";
import { openMarket } from "@/server/markets/open";

import {
	assertRunnerLiveConnection,
	closeRunnerConnection,
	describeRunnerTarget,
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
	request_id: "concurrency-test-setup-b",
	flow_id: flowId,
	user_id: null,
	actor_id: "admin-singleton",
	idempotency_key: null,
	ip: SYNTHETIC_TOS_IP,
	user_agent: SYNTHETIC_TOS_USER_AGENT,
});

beforeAll(async () => {
	await assertRunnerLiveConnection();
	if (process.env[VOLUME_INTENT_ENV] !== VOLUME_INTENT_VALUE) {
		throw new Error(
			`REFUSED — ${VOLUME_INTENT_ENV} is not set to the acknowledgement value.`,
		);
	}
	console.log(`[concurrency-setup-b] target ${describeRunnerTarget()}`);
});
afterAll(async () => {
	await closeRunnerConnection();
});

describe("second concurrency-test market — for the P4.3 per-market-scoping check", () => {
	it("creates the dedicated second test market (or opens it if left in Draft)", async () => {
		let marketId: string;
		const [existingMarket] = await readOnly
			.select({ id: markets.id, status: markets.status })
			.from(markets)
			.where(eq(markets.slug, MARKET_SLUG));
		if (existingMarket && existingMarket.status === "Open") {
			marketId = existingMarket.id;
			console.log(
				`[concurrency-setup-b] market ${MARKET_SLUG} already exists and is Open — reusing`,
			);
		} else if (existingMarket) {
			marketId = existingMarket.id;
			console.log(
				`[concurrency-setup-b] market ${MARKET_SLUG} exists but is ${existingMarket.status} — opening it now`,
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
					"A second dedicated test market, used only to check whether the write-limit protecting concurrency-test-market is scoped per-market or shared globally. Not a real question — synthetic fixture data only.",
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
				`[concurrency-setup-b] created market ${MARKET_SLUG} (${marketId})`,
			);
		}
		console.log(
			`[concurrency-setup-b] DONE — market slug: ${MARKET_SLUG} — market id: ${marketId}`,
		);
	}, 120_000);
});
