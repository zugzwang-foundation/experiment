import { v7 as uuidv7 } from "uuid";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@sentry/nextjs", () => ({
	captureMessage: vi.fn(),
	addBreadcrumb: vi.fn(),
	captureException: vi.fn(),
}));

import { bets, comments, markets, pools, positions, users } from "@/db/schema";
import { loadProfileArguments } from "@/server/profile/arguments";

import { testClient, testDb } from "../../db/_fixtures/db";
import { truncateTables } from "../../db/_fixtures/truncate";

// UI.A5 Slice 3 §5.6 tests-first (plan §2 row 3 + §11 → §17 row
// `profile::marker-uses-profile-users-held-side`). SPEC.1 1.0.18 §23
// "The argument list" (L1517) + F-PROF-2/F-DEBATE-2/3. The VALUE import from
// `@/server/profile/arguments` FAILS at collection until Slice 3 lands —
// red-for-the-right-reason. DB-BACKED (local Postgres :54322).
//
// The marker on each of the profile user's arguments is computed with
// `computeMarker(side_at_post_time, <the PROFILE USER's held side in that
// market>)` — NOT the reader's, NOT any other participant's. The profile user
// authored every item, so the input is their own held side per market
// (quantity > 0 → that side; no held row → null → "Exited"). All three posts
// are frozen at side YES (INV-3); the marker varies only with the held side.

const POOL = "100.000000000000000000";

function dp18(intStr: string): string {
	return `${intStr}.000000000000000000`;
}

async function seedUser(pseudonym: string, emailTag: string): Promise<string> {
	const id = uuidv7();
	await testDb.insert(users).values({
		id,
		name: `Fixture ${emailTag}`,
		email: `${emailTag}@example.com`,
		pseudonym,
		emailVerified: false,
	});
	return id;
}

async function seedMarket(
	slug: string,
	status: "Open" | "Closed" | "Resolving" | "Resolved" | "Voided" | "Frozen",
	resolved?: { outcome: "YES" | "NO" },
): Promise<string> {
	const id = uuidv7();
	await testDb.insert(markets).values({
		id,
		slug,
		title: `Market ${slug}`,
		status,
		resolutionDeadline: new Date("2026-11-01T00:00:00Z"),
		resolvedAt: resolved ? new Date("2026-10-15T00:00:00Z") : null,
		resolutionOutcome: resolved?.outcome ?? null,
	});
	return id;
}

async function seedPool(
	marketId: string,
	yes = POOL,
	no = POOL,
): Promise<void> {
	await testDb
		.insert(pools)
		.values({ marketId, yesReserves: yes, noReserves: no });
}

async function seedComment(args: {
	userId: string;
	marketId: string;
	body: string;
	side: "YES" | "NO";
	parentCommentId?: string;
	createdAt: Date;
}): Promise<string> {
	const id = uuidv7();
	await testDb.insert(comments).values({
		id,
		userId: args.userId,
		marketId: args.marketId,
		parentCommentId: args.parentCommentId ?? null,
		body: args.body,
		sideAtPostTime: args.side,
		createdAt: args.createdAt,
	});
	return id;
}

async function seedBet(args: {
	userId: string;
	marketId: string;
	side: "YES" | "NO";
	stake: string;
	shares: string;
	commentId: string;
	createdAt: Date;
}): Promise<string> {
	const id = uuidv7();
	await testDb.insert(bets).values({
		id,
		userId: args.userId,
		marketId: args.marketId,
		side: args.side,
		stake: args.stake,
		shareQuantity: args.shares,
		priceAtBet: "0.500000000000000000",
		commentId: args.commentId,
		createdAt: args.createdAt,
	});
	return id;
}

async function seedPosition(args: {
	userId: string;
	marketId: string;
	side: "YES" | "NO";
	quantity: string;
}): Promise<void> {
	await testDb.insert(positions).values({
		userId: args.userId,
		marketId: args.marketId,
		side: args.side,
		quantity: args.quantity,
	});
}

const TRUNCATE_LIST = [
	"events",
	"payout_events",
	"resolution_events",
	"mod_actions",
	"dharma_ledger",
	"bets",
	"comments",
	"positions",
	"pools",
	"markets",
	"users",
];

describe("UI.A5 Slice 3 — loadProfileArguments markers (F-PROF-2 held-side)", () => {
	afterEach(async () => {
		await truncateTables(testClient, TRUNCATE_LIST);
		vi.clearAllMocks();
	});

	it("profile-users-held-side", async () => {
		// The profile user (userA) posts YES in three markets (side_at_post_time
		// YES, frozen). The marker on each post is driven by userA's OWN held side:
		//   (a) m-marker-none    — still holds YES  → "none"
		//   (b) m-marker-flipped — now holds NO     → "Flipped"
		//   (c) m-marker-exited  — no held position → "Exited"
		// GUARD: a DIFFERENT user holding the OPPOSITE side in market (a) must NOT
		// move userA's marker — the held side is per-user.
		const userA = await seedUser("marker-author", "marker-author");
		const userX = await seedUser("marker-other", "marker-other");

		// (a) still-holds-YES → "none".
		const mNone = await seedMarket("m-marker-none", "Open");
		await seedPool(mNone);
		const postNone = await seedComment({
			userId: userA,
			marketId: mNone,
			body: "Post held on its own YES side",
			side: "YES",
			createdAt: new Date("2026-09-10T10:00:00Z"),
		});
		await seedBet({
			userId: userA,
			marketId: mNone,
			side: "YES",
			stake: dp18("50"),
			shares: dp18("50"),
			commentId: postNone,
			createdAt: new Date("2026-09-10T10:00:00Z"),
		});
		await seedPosition({
			userId: userA,
			marketId: mNone,
			side: "YES",
			quantity: dp18("50"),
		});
		// GUARD: userX holds the OPPOSITE (NO) side in the SAME market. A bare
		// position row is enough to prove per-user held-side resolution.
		await seedPosition({
			userId: userX,
			marketId: mNone,
			side: "NO",
			quantity: dp18("40"),
		});

		// (b) flipped-to-NO → "Flipped". Post frozen YES; userA now holds NO.
		const mFlipped = await seedMarket("m-marker-flipped", "Open");
		await seedPool(mFlipped);
		const postFlipped = await seedComment({
			userId: userA,
			marketId: mFlipped,
			body: "Post later flipped to the opposite side",
			side: "YES",
			createdAt: new Date("2026-09-11T10:00:00Z"),
		});
		await seedBet({
			userId: userA,
			marketId: mFlipped,
			side: "YES",
			stake: dp18("50"),
			shares: dp18("50"),
			commentId: postFlipped,
			createdAt: new Date("2026-09-11T10:00:00Z"),
		});
		await seedPosition({
			userId: userA,
			marketId: mFlipped,
			side: "NO",
			quantity: dp18("20"),
		});

		// (c) exited → "Exited". Post frozen YES; userA holds nothing (no row).
		const mExited = await seedMarket("m-marker-exited", "Open");
		await seedPool(mExited);
		const postExited = await seedComment({
			userId: userA,
			marketId: mExited,
			body: "Post whose position was fully exited",
			side: "YES",
			createdAt: new Date("2026-09-12T10:00:00Z"),
		});
		await seedBet({
			userId: userA,
			marketId: mExited,
			side: "YES",
			stake: dp18("50"),
			shares: dp18("50"),
			commentId: postExited,
			createdAt: new Date("2026-09-12T10:00:00Z"),
		});
		// No position row for userA in mExited → held side null → "Exited".

		const rows = await loadProfileArguments(testDb, { userId: userA });
		expect(rows.length).toBe(3);

		const itemNone = rows.find((r) => r.marketSlug === "m-marker-none");
		const itemFlipped = rows.find((r) => r.marketSlug === "m-marker-flipped");
		const itemExited = rows.find((r) => r.marketSlug === "m-marker-exited");

		expect(itemNone?.id).toBe(postNone);
		expect(itemNone?.removed).toBe(false);
		if (itemNone && itemNone.removed === false) {
			// GUARD assertion: userX's opposing NO position does NOT flip this.
			expect(itemNone.marker).toBe("none");
			expect(itemNone.side).toBe("YES");
		}

		expect(itemFlipped?.id).toBe(postFlipped);
		expect(itemFlipped?.removed).toBe(false);
		if (itemFlipped && itemFlipped.removed === false) {
			expect(itemFlipped.marker).toBe("Flipped");
			expect(itemFlipped.side).toBe("YES");
		}

		expect(itemExited?.id).toBe(postExited);
		expect(itemExited?.removed).toBe(false);
		if (itemExited && itemExited.removed === false) {
			expect(itemExited.marker).toBe("Exited");
			expect(itemExited.side).toBe("YES");
		}
	});
});
