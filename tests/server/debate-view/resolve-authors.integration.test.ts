import { afterEach, describe, expect, it, vi } from "vitest";

// DEBATE.4 §8 tests-first (plan §5 / D8) — the RED driver for `resolveAuthors`,
// the NEW batch identity read-model: `userIds → Map<userId, { pseudonym, pfpUrl
// }>`. It batch-resolves `users.pseudonym`; `pfpUrl` is the static
// `/pfp-placeholder.svg` for EVERY author (D8: the pfpFilename→URL pipeline is
// unbuilt; the placeholder is used and pfp_filename is ignored).
//
// RED target: `@/server/debate-view/resolve-authors` does NOT yet exist, so this
// file fails at COLLECTION until the implement phase lands the loader.
//
// DB-backed (local Postgres :54322). TRUNCATE in afterEach.

vi.mock("@sentry/nextjs", () => ({
	captureMessage: vi.fn(),
	addBreadcrumb: vi.fn(),
	captureException: vi.fn(),
}));

import { users } from "@/db/schema";
// The RED import: greenfield loader under test.
import { resolveAuthors } from "@/server/debate-view/resolve-authors";

import { testClient, testDb } from "../../db/_fixtures/db";
import { truncateTables } from "../../db/_fixtures/truncate";

const PFP_PLACEHOLDER = "/pfp-placeholder.svg";

async function seedUser(args: {
	tag: string;
	pfpFilename: string | null;
}): Promise<string> {
	const [user] = await testDb
		.insert(users)
		.values({
			name: "Author User",
			email: `${args.tag}@example.com`,
			pseudonym: args.tag,
			pfpFilename: args.pfpFilename,
		})
		.returning({ id: users.id });
	return user?.id ?? "";
}

describe("DEBATE.4 §5 — resolveAuthors (batch pseudonym + placeholder PFP)", () => {
	afterEach(async () => {
		await truncateTables(testClient, [
			"events",
			"payout_events",
			"resolution_events",
			"dharma_ledger",
			"bets",
			"comments",
			"positions",
			"pools",
			"markets",
			"mod_actions",
			"users",
		]);
		vi.clearAllMocks();
	});

	it("batch-resolves pseudonyms; pfpUrl is the placeholder for every author (D8)", async () => {
		// One author HAS a pfp_filename, one does NOT — both resolve to the same
		// placeholder URL (the filename is ignored until the pipeline is built).
		const a = await seedUser({
			tag: "author-alpha",
			pfpFilename: "alpha.webp",
		});
		const b = await seedUser({ tag: "author-beta", pfpFilename: null });

		const map = await resolveAuthors(testDb, [a, b]);

		expect(map.get(a)?.pseudonym).toBe("author-alpha");
		expect(map.get(b)?.pseudonym).toBe("author-beta");
		// D8: placeholder for everyone, pfp_filename ignored.
		expect(map.get(a)?.pfpUrl).toBe(PFP_PLACEHOLDER);
		expect(map.get(b)?.pfpUrl).toBe(PFP_PLACEHOLDER);
	});

	it("empty input → empty Map (no error, no query degeneracy)", async () => {
		const map = await resolveAuthors(testDb, []);
		expect(map.size).toBe(0);
	});

	it("deduplicates repeated ids and resolves each once", async () => {
		const a = await seedUser({ tag: "author-dup", pfpFilename: null });

		// Same id twice — the Map collapses to one entry.
		const map = await resolveAuthors(testDb, [a, a]);
		expect(map.size).toBe(1);
		expect(map.get(a)?.pseudonym).toBe("author-dup");
	});
});
