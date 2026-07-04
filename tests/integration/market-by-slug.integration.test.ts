import { afterEach, describe, expect, it } from "vitest";

import { markets } from "@/db/schema";
import { getMarketBySlug } from "@/server/markets/get-by-slug";

import { testClient, testDb } from "../db/_fixtures/db";
import { truncateTables } from "../db/_fixtures/truncate";

// SHELL/UI.0 plan §10 — the slug resolver is the one logic piece warranting a
// test (shell UI/RSC scaffolding is TDD-exempt per CLAUDE.md §5.6). DB-BACKED:
// against the real test Postgres so the `status <> 'Draft'` filter runs in the
// query, not in JS. Cannot RED without a local Postgres (ECONNREFUSED is infra,
// not an assertion red) — green once the resolver lands + the DB is up.
//
// Fixtures bypass the application layer and seed `markets` directly (SPEC.2
// §6.6). resolution_deadline is NOT NULL → every seed carries a future date.

const DEADLINE = new Date("2027-01-01T00:00:00.000Z");

type SeedStatus =
	| "Draft"
	| "Open"
	| "Closed"
	| "Resolving"
	| "Resolved"
	| "Voided"
	| "Frozen";

async function seedMarket(args: {
	slug: string;
	status: SeedStatus;
	description?: string | null;
}): Promise<void> {
	await testDb.insert(markets).values({
		slug: args.slug,
		title: `Market ${args.slug}`,
		description: args.description ?? null,
		status: args.status,
		resolutionDeadline: DEADLINE,
	});
}

describe("getMarketBySlug — public slug resolver (SHELL/UI.0)", () => {
	afterEach(async () => {
		await truncateTables(testClient, ["markets"]);
	});

	it("resolves an Open market to its DTO", async () => {
		await seedMarket({
			slug: "will-it-rain",
			status: "Open",
			description: "Resolves YES if it rains in Mumbai on Devcon day.",
		});

		const dto = await getMarketBySlug(testDb, "will-it-rain");

		expect(dto).not.toBeNull();
		expect(dto).toMatchObject({
			slug: "will-it-rain",
			title: "Market will-it-rain",
			description: "Resolves YES if it rains in Mumbai on Devcon day.",
			status: "Open",
		});
		// DTO carries the id (UUIDv7 string) — not a drizzle row beyond the 5 cols.
		expect(typeof dto?.id).toBe("string");
		expect(Object.keys(dto ?? {}).sort()).toEqual([
			"description",
			"id",
			"slug",
			"status",
			"title",
		]);
	});

	it("returns null for an unknown slug", async () => {
		expect(await getMarketBySlug(testDb, "no-such-market")).toBeNull();
	});

	it("returns null for a Draft market — Drafts are admin-only (OQ-2)", async () => {
		await seedMarket({ slug: "secret-draft", status: "Draft" });
		expect(await getMarketBySlug(testDb, "secret-draft")).toBeNull();
	});

	it("resolves non-Draft terminal states (e.g. Resolved) and preserves null description", async () => {
		await seedMarket({
			slug: "settled",
			status: "Resolved",
			description: null,
		});

		const dto = await getMarketBySlug(testDb, "settled");

		expect(dto?.status).toBe("Resolved");
		expect(dto?.description).toBeNull();
	});
});
