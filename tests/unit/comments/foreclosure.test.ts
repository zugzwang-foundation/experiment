import { afterEach, describe, expect, it } from "vitest";

import { markets, positions, users } from "@/db/schema";
import {
	computeReplyAffordance,
	readReplyAffordance,
} from "@/server/comments/foreclosure";

import { testClient, testDb } from "../../db/_fixtures/db";

// DEBATE.2 §5.6 tests-first — the single-side × Counter FORECLOSURE read surface
// (plan §3 "foreclosure read surface"; Open Item 1 / ruling 1a). PURE FUNCTION,
// NO render (the UI is DESIGN.5 / DEBATE.4). This is the data contract that
// feeds the disable-and-explain affordance.
//
// PURE / DB-INDEPENDENT (locally-RED → the real RED→GREEN receipt). Touches no
// Postgres; it REDs NOW purely on the greenfield value import — `foreclosure.ts`
// (and `src/server/comments/` as a whole) does not exist on disk until execute
// — and GREENs the moment it lands.
//
// PINNED PUBLIC-API CONTRACT (the implementer matches these names exactly):
//   type Affordance = "allowed" | "foreclosed";
//   interface ReplyAffordance {
//     support: Affordance;   // a reply on the parent's frozen side P
//     counter: Affordance;   // a reply on ¬P
//     reason: string | null; // why-foreclosed (disable-and-explain); null when both allowed
//   }
//   computeReplyAffordance(
//     P: "YES" | "NO",        // parent.side_at_post_time (the parent's frozen side)
//     H: "YES" | "NO" | null, // viewer's held side ("YES"|"NO"|null)
//   ): ReplyAffordance
//
// Truth table (Support targets P; Counter targets ¬P — the opposite of P). The
// write-path enforcement is the existing F-BET-10 `opposite_side_held` check in
// place(): a reply is a bet on the targeted side, so a viewer who already holds
// the OTHER side is foreclosed from that target.
//   H == P    → support allowed,    counter FORECLOSED (Counter = bet ¬P ≠ H)
//   H == ¬P   → support FORECLOSED,  counter allowed    (Support = bet P  ≠ H)
//   H == null → BOTH allowed (each is an entry bet on its own side)
//   reason text present IFF a side is foreclosed; null when both allowed.

const NOT_P = (p: "YES" | "NO"): "YES" | "NO" => (p === "YES" ? "NO" : "YES");

describe("computeReplyAffordance — viewer holds the parent's side (H == P)", () => {
	for (const P of ["YES", "NO"] as const) {
		it(`reply-foreclosure::held-equals-parent-side-counter-foreclosed-${P}`, () => {
			// H == P: Support targets P (= H) → an add on the held side, allowed.
			// Counter targets ¬P (≠ H) → opposite-side held → FORECLOSED (F-BET-10).
			const aff = computeReplyAffordance(P, P);
			expect(aff.support).toBe("allowed");
			expect(aff.counter).toBe("foreclosed");
		});

		it(`reply-foreclosure::reason-present-when-counter-foreclosed-${P}`, () => {
			// reason text present IFF a side is foreclosed (it is — counter).
			const aff = computeReplyAffordance(P, P);
			expect(aff.reason).not.toBeNull();
			expect(typeof aff.reason).toBe("string");
			expect((aff.reason ?? "").length).toBeGreaterThan(0);
		});
	}
});

describe("computeReplyAffordance — viewer holds the opposite side (H == ¬P)", () => {
	for (const P of ["YES", "NO"] as const) {
		it(`reply-foreclosure::held-opposite-parent-side-support-foreclosed-${P}`, () => {
			// H == ¬P: Support targets P (≠ H) → opposite-side held → FORECLOSED.
			// Counter targets ¬P (= H) → an add on the held side, allowed.
			const aff = computeReplyAffordance(P, NOT_P(P));
			expect(aff.support).toBe("foreclosed");
			expect(aff.counter).toBe("allowed");
		});

		it(`reply-foreclosure::reason-present-when-support-foreclosed-${P}`, () => {
			const aff = computeReplyAffordance(P, NOT_P(P));
			expect(aff.reason).not.toBeNull();
			expect((aff.reason ?? "").length).toBeGreaterThan(0);
		});
	}
});

describe("computeReplyAffordance — viewer holds nothing (H == null)", () => {
	for (const P of ["YES", "NO"] as const) {
		it(`reply-foreclosure::no-position-both-allowed-${P}`, () => {
			// H == null: each side is an ENTRY bet on its own side — both allowed.
			const aff = computeReplyAffordance(P, null);
			expect(aff.support).toBe("allowed");
			expect(aff.counter).toBe("allowed");
		});

		it(`reply-foreclosure::reason-null-when-both-allowed-${P}`, () => {
			// reason is null IFF NEITHER side is foreclosed (both allowed here).
			const aff = computeReplyAffordance(P, null);
			expect(aff.reason).toBeNull();
		});
	}
});

// The thin DB-backed reader: reads H via `heldSideOrNull` (positions/read.ts,
// ENGINE.11) for the viewer in the parent's market, P from the parent comment's
// frozen side, and delegates to the pure `computeReplyAffordance`.
//
// PINNED PUBLIC-API CONTRACT:
//   readReplyAffordance(
//     client: DbClient | DbTransaction,
//     args: { viewerId: string; parentComment: { marketId: string; sideAtPostTime: "YES" | "NO" } },
//   ): Promise<ReplyAffordance>
//
// DB-backed: seeds a position so `heldSideOrNull` resolves a real held side.
// REDs on the greenfield `@/server/comments/foreclosure` import.
describe("readReplyAffordance — reads viewer's held side via heldSideOrNull", () => {
	afterEach(async () => {
		await testClient.unsafe(`TRUNCATE positions, markets, users CASCADE`);
	});

	async function seedUser(tag: string): Promise<string> {
		const [user] = await testDb
			.insert(users)
			.values({
				name: "Foreclosure Reader User",
				email: `${tag}@example.com`,
				pseudonym: tag,
				tosAcceptedAt: new Date("2026-01-01T00:00:00Z"),
			})
			.returning({ id: users.id });
		return user?.id ?? "";
	}

	async function seedMarket(slug: string): Promise<string> {
		const [market] = await testDb
			.insert(markets)
			.values({
				slug,
				title: "Foreclosure Reader Market",
				status: "Open",
				resolutionDeadline: new Date("2027-01-01T00:00:00Z"),
			})
			.returning({ id: markets.id });
		return market?.id ?? "";
	}

	it("reply-foreclosure::reader-held-equals-parent-counter-foreclosed", async () => {
		const viewerId = await seedUser("fc-reader-eq");
		const marketId = await seedMarket("fc-reader-eq-market");
		// Viewer HOLDS YES; the parent's frozen side is also YES → H == P.
		await testDb.insert(positions).values({
			userId: viewerId,
			marketId,
			side: "YES",
			quantity: "5.000000000000000000",
		});

		const aff = await readReplyAffordance(testDb, {
			viewerId,
			parentComment: { marketId, sideAtPostTime: "YES" },
		});
		expect(aff.support).toBe("allowed");
		expect(aff.counter).toBe("foreclosed");
		expect(aff.reason).not.toBeNull();
	});

	it("reply-foreclosure::reader-no-position-both-allowed", async () => {
		const viewerId = await seedUser("fc-reader-none");
		const marketId = await seedMarket("fc-reader-none-market");
		// No position seeded → heldSideOrNull returns null → H == null.
		const aff = await readReplyAffordance(testDb, {
			viewerId,
			parentComment: { marketId, sideAtPostTime: "YES" },
		});
		expect(aff.support).toBe("allowed");
		expect(aff.counter).toBe("allowed");
		expect(aff.reason).toBeNull();
	});
});
