import { v7 as uuidv7 } from "uuid";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@sentry/nextjs", () => ({
	captureMessage: vi.fn(),
	addBreadcrumb: vi.fn(),
	captureException: vi.fn(),
}));

import { users } from "@/db/schema";
import { resolveProfileUser } from "@/server/profile/resolve";

import { testClient, testDb } from "../../db/_fixtures/db";
import { truncateTables } from "../../db/_fixtures/truncate";

// UI.A5 Slice 2 §5.6 tests-first (plan §2 row 2 + §11) — F-PROF-1 pseudonym
// resolve (SPEC.1 1.0.18 §23 "Route"). The VALUE import from
// `@/server/profile/resolve` FAILS at collection until Slice 2 lands —
// red-for-the-right-reason. DB-BACKED (local Postgres :54322).
//
// §17 rows minted here: profile::route-pseudonym-resolves ·
// profile::unknown-pseudonym-404 ·
// profile::scrubbed-pseudonym-resolves-placeholder (+ the N-9
// `pre-scrub-pseudonym-404` named fixture).
//
// Scrub is DATA, not behavior, to this surface (plan §1a): a scrubbed row
// already carries the placeholder pseudonym/PFP; the pre-scrub name no
// longer exists in users.pseudonym, so 404 falls out naturally.

const PLACEHOLDER_PFP = "/pfp-placeholder.svg";

async function seedUser(args: {
	pseudonym: string;
	emailTag: string;
	bannedAt?: Date;
}): Promise<string> {
	const id = uuidv7();
	await testDb.insert(users).values({
		id,
		name: `Profile Fixture ${args.emailTag}`,
		email: `${args.emailTag}@example.com`,
		pseudonym: args.pseudonym,
		emailVerified: false,
		bannedAt: args.bannedAt ?? null,
	});
	return id;
}

describe("UI.A5 Slice 2 — resolveProfileUser (F-PROF-1 route resolve)", () => {
	afterEach(async () => {
		await truncateTables(testClient, ["users"]);
		vi.clearAllMocks();
	});

	it("pseudonym-resolves", async () => {
		const id = await seedUser({
			pseudonym: "resolute-otter",
			emailTag: "route-resolves",
		});

		const result = await resolveProfileUser(testDb, "resolute-otter");

		// The full DTO — current pseudonym verbatim, banned=false, the
		// resolve-authors placeholder PFP (no real PFP surface yet). toEqual
		// pins the exact shape: no extra defined keys can ride along.
		expect(result).toEqual({
			id,
			pseudonym: "resolute-otter",
			banned: false,
			pfpUrl: PLACEHOLDER_PFP,
		});
	});

	it("unknown-404", async () => {
		// A different user exists, so an unknown pseudonym is a true MISS,
		// not an empty-table artifact. Null → the route 404s at Slice 6.
		await seedUser({ pseudonym: "someone-else", emailTag: "route-unknown" });

		const result = await resolveProfileUser(testDb, "never-existed");

		expect(result).toBeNull();
	});

	it("scrubbed-placeholder-resolves", async () => {
		// H2 scrub simulated as data: placeholder pseudonym, pfp_filename
		// NULL (⇒ the silhouette render path), PII-ish fields left null.
		const id = await seedUser({
			pseudonym: "[scrubbed_user_4729]",
			emailTag: "scrubbed-4729",
		});

		const result = await resolveProfileUser(testDb, "[scrubbed_user_4729]");

		expect(result).toEqual({
			id,
			pseudonym: "[scrubbed_user_4729]",
			banned: false,
			pfpUrl: PLACEHOLDER_PFP,
		});
		// Zero-PII pin (SPEC.1 §23): the EXACT key set — no email/name/
		// googleId/tos*/ip key can ever appear on the DTO.
		expect(Object.keys(result ?? {}).sort()).toEqual([
			"banned",
			"id",
			"pfpUrl",
			"pseudonym",
		]);
	});

	it("pre-scrub-pseudonym-404", async () => {
		// N-9: the identity is permanently retired (ADR-0011). Only the
		// post-scrub row is seeded; the retired pre-scrub name resolves to
		// nothing.
		await seedUser({
			pseudonym: "[scrubbed_user_4729]",
			emailTag: "prescrub-4729",
		});

		const result = await resolveProfileUser(testDb, "original-handle-4729");

		expect(result).toBeNull();
	});

	it("banned-user-resolves-with-banned-true", async () => {
		// D8: the Banned label is visible to all; the profile still resolves
		// (history intact — ban ≠ removal, ADR-0021).
		const id = await seedUser({
			pseudonym: "banned-badger",
			emailTag: "route-banned",
			bannedAt: new Date("2026-10-01T00:00:00Z"),
		});

		const result = await resolveProfileUser(testDb, "banned-badger");

		expect(result).toEqual({
			id,
			pseudonym: "banned-badger",
			banned: true,
			pfpUrl: PLACEHOLDER_PFP,
		});
	});
});
