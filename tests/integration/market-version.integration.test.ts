import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";

// CACHE-COALESCE-3 (Gate C H-2): the route now reads a fleet-wide store before
// the database. This file is the REAL-DATABASE guard, so it pins the store
// unreachable and exercises the fail-open path — the token derived from the
// database on every call — instead of depending on whether the runner happens
// to have Upstash credentials. With a live store, the cases below that mutate
// the database and re-read inside `VERSION_MIN_WINDOW_MS` would read the entry
// and fail by design, and the run would write into the shared instance. The
// store's own behaviour is pinned in tests/server/markets/version-token.test.ts.
vi.mock("@/server/upstash/redis", () => {
	const down = () => Promise.reject(new Error("store pinned unreachable"));
	return {
		redis: { get: down, mget: down, set: down, del: down, eval: down },
	};
});

// GET /m/[slug]/version against a REAL Postgres. The route shipped in #551 with
// an embedded subquery Drizzle rendered as `on "id" = "target_comment_id"`,
// which Postgres rejects as ambiguous — every production call returned 500 and
// the poll stopped refreshing, including after a moderation removal. The unit
// tests mock the database and could not see it; this file cannot miss it.

import { GET } from "@/app/(public)/m/[slug]/version/route";
import { comments, markets, modActions, pools, users } from "@/db/schema";

import { testClient, testDb } from "../db/_fixtures/db";
import { truncateTables } from "../db/_fixtures/truncate";

const SEED = "100.000000000000000000";

async function seed(
	slug: string,
): Promise<{ marketId: string; commentId: string }> {
	const [u] = await testDb
		.insert(users)
		.values({
			name: "Version Viewer",
			email: `version-${slug}@example.com`,
			pseudonym: `VersionViewer-${slug}`,
			tosAcceptedAt: new Date("2026-01-01T00:00:00.000Z"),
		})
		.returning({ id: users.id });
	const [m] = await testDb
		.insert(markets)
		.values({
			slug,
			title: "Does the version route answer against a real database?",
			description: "Resolves YES if it returns a token.",
			status: "Open",
			resolutionDeadline: new Date("2027-01-01T00:00:00.000Z"),
		})
		.returning({ id: markets.id });
	const marketId = m?.id ?? "";
	await testDb
		.insert(pools)
		.values({ marketId, yesReserves: SEED, noReserves: SEED });
	const [c] = await testDb
		.insert(comments)
		.values({
			userId: u?.id ?? "",
			marketId,
			body: "an argument",
			sideAtPostTime: "YES",
			parentCommentId: null,
			betId: null,
		})
		.returning({ id: comments.id });
	return { marketId, commentId: c?.id ?? "" };
}

async function token(slug: string): Promise<string> {
	const res = await GET(new Request(`http://localhost/m/${slug}/version`), {
		params: Promise.resolve({ slug }),
	});
	expect(res.status).toBe(200);
	expect(res.headers.get("cache-control")).toContain("s-maxage=5");
	const body = (await res.json()) as { v?: unknown };
	expect(typeof body.v).toBe("string");
	return body.v as string;
}

afterEach(async () => {
	await truncateTables(testClient, [
		"mod_actions",
		"comments",
		"pools",
		"markets",
		"users",
	]);
});

describe("GET /m/[slug]/version", () => {
	it("answers 200 with a token for an Open market", async () => {
		await seed("version-ok");
		expect((await token("version-ok")).length).toBeGreaterThan(0);
	});

	it("is stable while nothing changes", async () => {
		await seed("version-stable");
		expect(await token("version-stable")).toBe(await token("version-stable"));
	});

	it("changes when a comment on the market is removed", async () => {
		const { commentId } = await seed("version-mod");
		const before = await token("version-mod");
		await testDb.insert(modActions).values({
			targetCommentId: commentId,
			reason: "content_removed",
			verdict: null,
			categories: {},
			actorId: "admin-singleton",
		});
		expect(await token("version-mod")).not.toBe(before);
	});

	it("changes when the reserves move", async () => {
		const { marketId } = await seed("version-reserves");
		const before = await token("version-reserves");
		await testDb
			.update(pools)
			.set({ yesReserves: "90.000000000000000000" })
			.where(eq(pools.marketId, marketId));
		expect(await token("version-reserves")).not.toBe(before);
	});
});
