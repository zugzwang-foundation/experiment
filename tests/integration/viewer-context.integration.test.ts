import { count, eq } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";
import { afterEach, describe, expect, it } from "vitest";
import {
	bookmarks,
	comments,
	dharmaLedger,
	events,
	markets,
	modActions,
	pools,
	users,
} from "@/db/schema";
import { DAILY_CREDIT_DHARMA } from "@/server/config/limits";
import { computeSell } from "@/server/cpmm/calculate";
import { CpmmDecimal } from "@/server/cpmm/decimal";
// GREENFIELD VALUE IMPORT (the RED driver): `@/server/debate-view/
// viewer-context` lands with UI.A2 §9 slice 3 — until then this suite fails
// to resolve (the dharma-ledger.integration precedent).
import { loadViewerMarketContext } from "@/server/debate-view/viewer-context";
import { accrueDailyCredit } from "@/server/dharma/accrual";
import { appendLedgerRow, readBalance } from "@/server/dharma/persist";
import { PositionSingleSideError } from "@/server/positions/errors";
import { testClient, testDb } from "../db/_fixtures/db";
import { truncateTables } from "../db/_fixtures/truncate";

// UI.A2 §9 slice 3 — `loadViewerMarketContext`, the composed viewer-session
// read (@docs/plans/UI-A2.md §3.3). DB-BACKED against local Postgres :54322.
//
// THE load-bearing scenario is the plan-§1 INV-2 "read-that-writes"
// narrative: a viewer context implemented by CALLING accrueDailyCredit (the
// tempting reuse) instead of previewing it would turn every page load by an
// unpaid-today user into a Daily-Credit mint WITHOUT a commented bet —
// attendance becoming issuance, the exact ADR-0018 rejected-Option-4 failure,
// a public read surface as a Dharma faucet. ::read-only-no-ledger-write pins
// row-count + cursor invariance across the read; the
// ::spendable-preview-parity pair pins the preview arithmetic to
// accrueDailyCredit's own paid/unpaid behavior (shared utcDayOf import) so
// the two can never drift apart silently (plan self-critique #4).
//
// Pinned DTO (plan §3.3, ratified OQ-3 — NO `staked` field):
//   { position: { side; quantity; currentValue } | null;
//     balance; spendableToday }
// `currentValue` basis is RULED (FI-2): computeSell(quantity).proceeds — the
// impact-inclusive sell-all EXECUTION value, NOT a mark-to-p1 spot mark.
// READ-ONLY BY LAW: no ledger append, no accrual write, no cursor write, no
// events row — ever.
//
// Money/share values are decimal STRINGS via CpmmDecimal — never JS floats
// (CLAUDE.md §2).

// The 7-field events metadata shape (schemas.ts eventMetadataSchema; the
// positions.integration META precedent) — consumed by the parity tests'
// REAL accrueDailyCredit call.
const META = {
	request_id: "test",
	flow_id: "test",
	user_id: null,
	actor_id: "test",
	idempotency_key: null,
	ip: "test",
	user_agent: "test",
};

const SEED_RESERVES = "100.000000000000000000";
const GRANT = "1000";
/** Held quantity in the exact 18-dp form NUMERIC(38,18) reads back. */
const HELD_QTY = "50.000000000000000000";

async function seedUser(emailTag: string, pseudonym: string): Promise<string> {
	const [user] = await testDb
		.insert(users)
		.values({
			name: "Viewer-Context User",
			email: `${emailTag}@example.com`,
			pseudonym,
		})
		.returning({ id: users.id });
	return user?.id ?? "";
}

async function seedOpenMarketWithPool(slug: string): Promise<string> {
	const [market] = await testDb
		.insert(markets)
		.values({
			slug,
			title: "Viewer-Context Market",
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

async function seedGrant(userId: string, amount: string): Promise<void> {
	await testDb.transaction((tx) =>
		appendLedgerRow(tx, { userId, amount, entryType: "initial_grant" }),
	);
}

// Raw position seed (fixture-bypass, the I-SINGLE-SIDE-001 pattern) — forces
// exact stored rows without the app layer.
async function seedPosition(args: {
	userId: string;
	marketId: string;
	side: "YES" | "NO";
	quantity: string;
}): Promise<void> {
	await testClient.unsafe(
		`INSERT INTO positions (user_id, market_id, side, quantity)
		 VALUES ($1, $2, $3, $4)`,
		[args.userId, args.marketId, args.side, args.quantity],
	);
}

// ── B1 (BOOKMARK-ADD-WIRE Slice 1) seeds ────────────────────────────────────
// Minimal, per the plan: a comment needs NO bet (`comments.bet_id` is
// deliberately nullable), and a bookmarked/own comment needs no position — the
// two new SELECTs read only `bookmarks` + `comments`. Shapes mirror
// tests/server/bookmarks/{list,masking}.test.ts.

async function seedComment(args: {
	userId: string;
	marketId: string;
	side: "YES" | "NO";
	body?: string;
}): Promise<string> {
	const [row] = await testDb
		.insert(comments)
		.values({
			userId: args.userId,
			marketId: args.marketId,
			parentCommentId: null,
			body: args.body ?? "seeded argument body",
			sideAtPostTime: args.side,
		})
		.returning({ id: comments.id });
	return row?.id ?? "";
}

async function seedBookmark(args: {
	userId: string;
	commentId: string;
}): Promise<void> {
	await testDb
		.insert(bookmarks)
		.values({ userId: args.userId, commentId: args.commentId });
}

// `content_removed` is a `mod_actions` row (Bucket A), NOT a column on comments
// — the masking.test.ts shape. Removal never deletes the comment or the bookmark.
async function seedRemoval(commentId: string): Promise<void> {
	await testDb.insert(modActions).values({
		targetCommentId: commentId,
		reason: "content_removed",
		categories: {},
		actorId: "admin-singleton",
	});
}

async function ledgerCount(userId: string): Promise<number> {
	const [row] = await testDb
		.select({ n: count() })
		.from(dharmaLedger)
		.where(eq(dharmaLedger.userId, userId));
	return row?.n ?? -1;
}

async function eventsCount(): Promise<number> {
	const [row] = await testDb.select({ n: count() }).from(events);
	return row?.n ?? -1;
}

async function readCursor(userId: string): Promise<Date | null> {
	const rows = await testDb
		.select({ lastAllowanceAccruedAt: users.lastAllowanceAccruedAt })
		.from(users)
		.where(eq(users.id, userId));
	return rows[0]?.lastAllowanceAccruedAt ?? null;
}

/**
 * The parity vehicle: ACTUALLY accrue (what the preview only previews) — a
 * real `accrueDailyCredit` inside a testDb.transaction, `previousBalance`
 * read via `readBalance` in the SAME tx (the accrual.ts caller contract),
 * `creditEventId` a freshly minted UUIDv7 (insertEvent hard-requires v7).
 */
async function runRealAccrual(userId: string) {
	return testDb.transaction(async (tx) => {
		const previousBalance = await readBalance(tx, userId);
		return accrueDailyCredit(tx, {
			userId,
			previousBalance,
			creditEventId: uuidv7(),
			metadata: META,
		});
	});
}

describe("UI.A2 viewer-session context — loadViewerMarketContext (read-only by law)", () => {
	afterEach(async () => {
		// B1 extends the list: the new cases write comments / bookmarks /
		// mod_actions. `truncateTables` disables the ENTIRE guard set and always
		// CASCADEs, so ordering is readability-only (mirrors the list.test.ts
		// order). `bookmarks` is Bucket C and is deliberately NOT in
		// TRUNCATE_GUARDS — the guard count stays unchanged.
		await truncateTables(testClient, [
			"bookmarks",
			"events",
			"mod_actions",
			"dharma_ledger",
			"comments",
			"positions",
			"pools",
			"markets",
			"users",
		]);
	});

	it("viewer-context::shape-no-position", async () => {
		// Seeded user (initial_grant ledger row), Open market + pool, NO
		// position → { position: null, balance: grant, spendableToday: grant +
		// credit } (a fresh user's cursor is NULL — unpaid).
		const userId = await seedUser("vc-shape-null", "vc-shape-null");
		const marketId = await seedOpenMarketWithPool("vc-shape-null-market");
		await seedGrant(userId, GRANT);

		const ctx = await loadViewerMarketContext(testDb, { userId, marketId });

		expect(ctx.position).toBeNull();
		// balance: readBalance — the latest ledger balance_after, 18-dp.
		expect(ctx.balance).toBe(new CpmmDecimal(GRANT).toFixed(18));
		// spendableToday: unpaid → grant + DAILY_CREDIT_DHARMA (live constant).
		expect(ctx.spendableToday).toBe(
			new CpmmDecimal(GRANT).plus(DAILY_CREDIT_DHARMA).toFixed(18),
		);
	});

	it("viewer-context::shape-held-position", async () => {
		// Held YES position + seeded pool → the FI-2 basis pin: currentValue ==
		// computeSell(reserves, "yes", quantity).proceeds EXACTLY — the
		// impact-inclusive sell-all execution value. cpmm Side is lowercase;
		// positions side is uppercase — the module owns the translation.
		const userId = await seedUser("vc-shape-held", "vc-shape-held");
		const marketId = await seedOpenMarketWithPool("vc-shape-held-market");
		await seedGrant(userId, GRANT);
		await seedPosition({ userId, marketId, side: "YES", quantity: HELD_QTY });

		const sell = computeSell({
			reserves: { yes: SEED_RESERVES, no: SEED_RESERVES },
			side: "yes",
			shares: HELD_QTY,
		});

		const ctx = await loadViewerMarketContext(testDb, { userId, marketId });

		expect(ctx.position).toEqual({
			side: "YES",
			quantity: HELD_QTY,
			currentValue: sell.proceeds,
		});

		// The rejected alternative (mark-to-p1 spot mark, FI-2) genuinely
		// DIVERGES at these values — the pin above is meaningful, not vacuous:
		// a mark-to-p1 implementation fails the toEqual.
		const markToP1 = new CpmmDecimal(HELD_QTY).times(sell.p1).toFixed(18);
		expect(sell.proceeds).not.toBe(markToP1);
		expect(ctx.position?.currentValue).not.toBe(markToP1);
	});

	it("viewer-context::read-only-no-ledger-write", async () => {
		// THE INV-2 narrative (plan §1): the UNPAID user is the tempting-accrual
		// case. The read must PREVIEW the credit while writing NOTHING — no
		// ledger append, no events row, no cursor write. A held position is
		// seeded so the FULLEST read path runs (position + pool + balance +
		// cursor) and none of it may write.
		const userId = await seedUser("vc-readonly", "vc-readonly");
		const marketId = await seedOpenMarketWithPool("vc-readonly-market");
		await seedGrant(userId, GRANT);
		await seedPosition({ userId, marketId, side: "YES", quantity: HELD_QTY });

		// Snapshot BEFORE: exactly the seed grant; cursor NULL (unpaid).
		const ledgerBefore = await ledgerCount(userId);
		const eventsBefore = await eventsCount();
		expect(ledgerBefore).toBe(1); // the initial_grant row only
		expect(await readCursor(userId)).toBeNull();

		const first = await loadViewerMarketContext(testDb, { userId, marketId });

		// The preview DID preview the credit …
		expect(first.balance).toBe(new CpmmDecimal(GRANT).toFixed(18));
		expect(first.spendableToday).toBe(
			new CpmmDecimal(first.balance).plus(DAILY_CREDIT_DHARMA).toFixed(18),
		);

		// … and NOTHING moved: ledger count, events count, cursor all unchanged.
		expect(await ledgerCount(userId)).toBe(ledgerBefore);
		expect(await eventsCount()).toBe(eventsBefore);
		expect(await readCursor(userId)).toBeNull();

		// A second consecutive call returns IDENTICAL figures (no state moved) —
		// and still writes nothing.
		const second = await loadViewerMarketContext(testDb, { userId, marketId });
		expect(second).toEqual(first);
		expect(await ledgerCount(userId)).toBe(ledgerBefore);
		expect(await eventsCount()).toBe(eventsBefore);
		expect(await readCursor(userId)).toBeNull();
	});

	it("viewer-context::spendable-preview-parity-unpaid", async () => {
		// The preview and the REAL accrual can't drift: both flow through the
		// SHARED utcDayOf (plan self-critique #4). Preview first, then actually
		// run accrueDailyCredit — its returned balanceAfter must equal the
		// earlier preview EXACTLY. (Day-flip-safe: a NULL cursor is unpaid on
		// ANY day, so the pair holds even across a midnight straddle.)
		const userId = await seedUser("vc-parity-unpaid", "vc-parity-unpaid");
		const marketId = await seedOpenMarketWithPool("vc-parity-unpaid-market");
		await seedGrant(userId, GRANT);

		const preview = (
			await loadViewerMarketContext(testDb, { userId, marketId })
		).spendableToday;

		const accrued = await runRealAccrual(userId);
		expect(accrued.credited).toBe(true);
		expect(accrued.balanceAfter).toBe(preview);
	});

	it("viewer-context::spendable-preview-parity-paid", async () => {
		// Immediately after a real accrual the user is PAID for the UTC day: a
		// fresh read reports balance == the accrued balanceAfter and
		// spendableToday == balance — the credit is never double-counted.
		const userId = await seedUser("vc-parity-paid", "vc-parity-paid");
		const marketId = await seedOpenMarketWithPool("vc-parity-paid-market");
		await seedGrant(userId, GRANT);

		const accrued = await runRealAccrual(userId);
		expect(accrued.credited).toBe(true);

		const ctx = await loadViewerMarketContext(testDb, { userId, marketId });
		expect(ctx.balance).toBe(accrued.balanceAfter);
		expect(ctx.spendableToday).toBe(ctx.balance);
	});

	it("viewer-context::single-side-assert-inherited", async () => {
		// getHeldPosition's ≤1-held assert must SURFACE through the composed
		// read. The partial unique index positions_one_held_side_idx normally
		// makes a second held row impossible (23505 — I-SINGLE-SIDE-001 pins
		// that), so to exercise the inherited throw we SIMULATE the index being
		// absent (a bad/mis-applied migration) — the positions.integration
		// drift-D3 pattern: drop, seed both sides raw, assert, then RESTORE the
		// index byte-faithful to the migration-defined shape.
		const userId = await seedUser("vc-dual-side", "vc-dual-side");
		const marketId = await seedOpenMarketWithPool("vc-dual-side-market");
		await seedGrant(userId, GRANT);

		await testClient.unsafe(`DROP INDEX positions_one_held_side_idx`);
		try {
			await seedPosition({ userId, marketId, side: "YES", quantity: "10" });
			await seedPosition({ userId, marketId, side: "NO", quantity: "10" });

			await expect(
				loadViewerMarketContext(testDb, { userId, marketId }),
			).rejects.toBeInstanceOf(PositionSingleSideError);
		} finally {
			// Clear the illegal rows BEFORE re-creating the unique index, then
			// restore the index to the migration-defined shape.
			await testClient.unsafe(`TRUNCATE positions CASCADE`);
			await testClient.unsafe(
				`CREATE UNIQUE INDEX positions_one_held_side_idx
				 ON positions (user_id, market_id) WHERE quantity > 0`,
			);
		}
	});

	// ── BOOKMARK-ADD-WIRE Slice 1 (B1) — the two additive, market-scoped,
	// ID-only arrays on ViewerMarketContext (plan §3 / §7). RED-FIRST: neither
	// `bookmarkedCommentIds` nor `ownCommentIds` exists on the DTO yet, so each
	// case FAILS at runtime on the missing query behaviour (and `tsc` errors on
	// the two new properties). No write rides these reads — SELECT-only inside
	// the existing read-only transaction; INV-3 preserved (no side/author column
	// is read; not a masking input). Arrays, never Sets (RSC→client, §3).
	describe("BOOKMARK-ADD-WIRE Slice 1 — bookmarked / own comment ids (B1)", () => {
		it("viewer-context::bookmarked-ids-scoped-to-market", async () => {
			// D1 — MARKET-scoped: a bookmark on a comment in M2 must NOT appear in
			// M1's array. A rendered-ID-scoped or market-agnostic query would leak it.
			const viewer = await seedUser("b1-bmkt-viewer", "b1-bmkt-viewer");
			const author = await seedUser("b1-bmkt-author", "b1-bmkt-author");
			const m1 = await seedOpenMarketWithPool("b1-bmkt-m1");
			const m2 = await seedOpenMarketWithPool("b1-bmkt-m2");
			await seedGrant(viewer, GRANT);

			const c1 = await seedComment({
				userId: author,
				marketId: m1,
				side: "YES",
			});
			const c2 = await seedComment({
				userId: author,
				marketId: m2,
				side: "YES",
			});
			await seedBookmark({ userId: viewer, commentId: c1 });
			await seedBookmark({ userId: viewer, commentId: c2 });

			const ctx = await loadViewerMarketContext(testDb, {
				userId: viewer,
				marketId: m1,
			});

			// Order-insensitive: the contract promises no ORDER BY.
			expect(new Set(ctx.bookmarkedCommentIds)).toEqual(new Set([c1]));
			expect(ctx.bookmarkedCommentIds).toHaveLength(1);
			expect(ctx.bookmarkedCommentIds).not.toContain(c2);
		});

		it("viewer-context::bookmarked-ids-scoped-to-viewer", async () => {
			// D1 — VIEWER-scoped: another user's bookmark of a comment in THIS
			// market must NOT appear. The viewer bookmarks a DIFFERENT comment in the
			// same market, so a missing `user_id` filter returns BOTH (caught by the
			// length + set equality), not merely [] → [x].
			const viewer = await seedUser("b1-bvwr-viewer", "b1-bvwr-viewer");
			const other = await seedUser("b1-bvwr-other", "b1-bvwr-other");
			const author = await seedUser("b1-bvwr-author", "b1-bvwr-author");
			const m1 = await seedOpenMarketWithPool("b1-bvwr-m1");
			await seedGrant(viewer, GRANT);

			const cOther = await seedComment({
				userId: author,
				marketId: m1,
				side: "YES",
			});
			const cViewer = await seedComment({
				userId: author,
				marketId: m1,
				side: "NO",
			});
			await seedBookmark({ userId: other, commentId: cOther }); // NOT the viewer
			await seedBookmark({ userId: viewer, commentId: cViewer });

			const ctx = await loadViewerMarketContext(testDb, {
				userId: viewer,
				marketId: m1,
			});

			expect(new Set(ctx.bookmarkedCommentIds)).toEqual(new Set([cViewer]));
			expect(ctx.bookmarkedCommentIds).toHaveLength(1);
			expect(ctx.bookmarkedCommentIds).not.toContain(cOther);
		});

		it("viewer-context::bookmarked-ids-includes-removed", async () => {
			// The array is ID-ONLY and never gates content, so a bookmarked comment
			// that was later `content_removed` STILL returns its id (masking is a
			// SEPARATE concern, keyed on loadRemovedSet inside loadDebateView — never
			// this array). AND the DTO leaks no content/author field: its key set is
			// EXACTLY the five contract keys (a byte-for-byte allowlist).
			const viewer = await seedUser("b1-brm-viewer", "b1-brm-viewer");
			const author = await seedUser("b1-brm-author", "b1-brm-author");
			const m1 = await seedOpenMarketWithPool("b1-brm-m1");
			await seedGrant(viewer, GRANT);

			const c = await seedComment({
				userId: author,
				marketId: m1,
				side: "YES",
				body: "this argument will be content_removed",
			});
			await seedRemoval(c);
			await seedBookmark({ userId: viewer, commentId: c });

			const ctx = await loadViewerMarketContext(testDb, {
				userId: viewer,
				marketId: m1,
			});

			// The removed comment's id is still present (ID-only, never masked here).
			expect(new Set(ctx.bookmarkedCommentIds)).toEqual(new Set([c]));
			expect(ctx.bookmarkedCommentIds).toHaveLength(1);

			// No content / author field on the DTO — assert the exact contract keys.
			expect(Object.keys(ctx).sort()).toEqual([
				"balance",
				"bookmarkedCommentIds",
				"ownCommentIds",
				"position",
				"spendableToday",
			]);
		});

		it("viewer-context::own-comment-ids-scoped-to-market", async () => {
			// D4 — ownCommentIds is MARKET-scoped: the viewer's own comment in M2 is
			// excluded from M1 (own-suppression must not bleed across markets).
			const viewer = await seedUser("b1-omkt-viewer", "b1-omkt-viewer");
			const m1 = await seedOpenMarketWithPool("b1-omkt-m1");
			const m2 = await seedOpenMarketWithPool("b1-omkt-m2");
			await seedGrant(viewer, GRANT);

			const own1 = await seedComment({
				userId: viewer,
				marketId: m1,
				side: "YES",
			});
			const own2 = await seedComment({
				userId: viewer,
				marketId: m2,
				side: "YES",
			});

			const ctx = await loadViewerMarketContext(testDb, {
				userId: viewer,
				marketId: m1,
			});

			expect(new Set(ctx.ownCommentIds)).toEqual(new Set([own1]));
			expect(ctx.ownCommentIds).toHaveLength(1);
			expect(ctx.ownCommentIds).not.toContain(own2);
		});

		it("viewer-context::own-comment-ids-excludes-others", async () => {
			// D4 — ownCommentIds is keyed on `comments.user_id = $viewer`: another
			// author's comment in the SAME market is excluded. This is the property
			// that keeps own-suppression id-based (H2-scrub-safe), not pseudonym-based.
			const viewer = await seedUser("b1-ooth-viewer", "b1-ooth-viewer");
			const author = await seedUser("b1-ooth-author", "b1-ooth-author");
			const m1 = await seedOpenMarketWithPool("b1-ooth-m1");
			await seedGrant(viewer, GRANT);

			const own1 = await seedComment({
				userId: viewer,
				marketId: m1,
				side: "YES",
			});
			const other1 = await seedComment({
				userId: author,
				marketId: m1,
				side: "YES",
			});

			const ctx = await loadViewerMarketContext(testDb, {
				userId: viewer,
				marketId: m1,
			});

			expect(new Set(ctx.ownCommentIds)).toEqual(new Set([own1]));
			expect(ctx.ownCommentIds).toHaveLength(1);
			expect(ctx.ownCommentIds).not.toContain(other1);
		});

		it("viewer-context::empty-arrays-when-none", async () => {
			// Both arrays are [] (never null / undefined) when the viewer has neither
			// bookmarked nor authored anything here — the arrays-not-Sets contract
			// (§3): the client can `new Set(x)` unconditionally after serialization.
			const viewer = await seedUser("b1-empty-viewer", "b1-empty-viewer");
			const m1 = await seedOpenMarketWithPool("b1-empty-m1");
			await seedGrant(viewer, GRANT);

			const ctx = await loadViewerMarketContext(testDb, {
				userId: viewer,
				marketId: m1,
			});

			expect(ctx.bookmarkedCommentIds).toEqual([]);
			expect(ctx.ownCommentIds).toEqual([]);
			expect(Array.isArray(ctx.bookmarkedCommentIds)).toBe(true);
			expect(Array.isArray(ctx.ownCommentIds)).toBe(true);
		});

		it("viewer-context::existing-fields-unchanged", async () => {
			// Regression belt on the SHARED transaction: adding the two SELECTs must
			// not perturb position / balance / spendableToday. In the fullest scenario
			// (held YES position + grant + an own comment + a bookmark of another's),
			// the three pre-B1 fields stay byte-identical to their oracle while the
			// two new arrays populate in the SAME read.
			const viewer = await seedUser("b1-belt-viewer", "b1-belt-viewer");
			const author = await seedUser("b1-belt-author", "b1-belt-author");
			const m1 = await seedOpenMarketWithPool("b1-belt-m1");
			await seedGrant(viewer, GRANT);
			await seedPosition({
				userId: viewer,
				marketId: m1,
				side: "YES",
				quantity: HELD_QTY,
			});

			const ownC = await seedComment({
				userId: viewer,
				marketId: m1,
				side: "YES",
			});
			const otherC = await seedComment({
				userId: author,
				marketId: m1,
				side: "YES",
			});
			await seedBookmark({ userId: viewer, commentId: otherC });

			const sell = computeSell({
				reserves: { yes: SEED_RESERVES, no: SEED_RESERVES },
				side: "yes",
				shares: HELD_QTY,
			});

			const ctx = await loadViewerMarketContext(testDb, {
				userId: viewer,
				marketId: m1,
			});

			// Pre-B1 fields — byte-identical to the shape-held-position / read-only
			// oracles (the belt: the two new SELECTs did not move them).
			expect(ctx.position).toEqual({
				side: "YES",
				quantity: HELD_QTY,
				currentValue: sell.proceeds,
			});
			expect(ctx.balance).toBe(new CpmmDecimal(GRANT).toFixed(18));
			expect(ctx.spendableToday).toBe(
				new CpmmDecimal(GRANT).plus(DAILY_CREDIT_DHARMA).toFixed(18),
			);

			// … and the two new arrays coexist in the same transaction.
			expect(new Set(ctx.bookmarkedCommentIds)).toEqual(new Set([otherC]));
			expect(ctx.bookmarkedCommentIds).toHaveLength(1);
			expect(new Set(ctx.ownCommentIds)).toEqual(new Set([ownC]));
			expect(ctx.ownCommentIds).toHaveLength(1);
		});
	});
});
