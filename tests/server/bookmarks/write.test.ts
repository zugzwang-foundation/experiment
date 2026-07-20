import { and, eq } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// UI-A6 §5.6 tests-first, Slice 2 — the bookmark WRITE path (plan §3.2 / §7
// `write.test.ts`; ADR-0032 D-2 / D-3 / F-BM-1). THE point of this file: the
// two greenfield Server Actions drive the REAL `bookmarks` table on the local
// Postgres (:54322) through the established session-mocked-action harness
// (tests/server/auth/tos-accept-grant.test.ts vehicle: vi.mock @/db → testDb,
// mock next/headers, mock @/server/auth's getSession).
//
// RED-BY-CONSTRUCTION: `@/server/bookmarks/add` and `@/server/bookmarks/remove`
// DO NOT EXIST yet — this file fails to COLLECT on those two imports (the whole
// point of tests-first). It GREENs when the two action modules land against the
// contract below (DO NOT stub src/ to make it import — RED-on-missing-module is
// the correct starting state).
//
// PINNED PUBLIC-API CONTRACT (the implementer matches EXACTLY):
//   // src/server/bookmarks/add.ts   ("use server")
//   export type AddBookmarkResult =
//     | { ok: true }
//     | { ok: false; code:
//         "unauthenticated" | "comment_not_found" | "self_bookmark_forbidden" };
//   export async function addBookmarkAction(commentId: string):
//     Promise<AddBookmarkResult>;
//   // src/server/bookmarks/remove.ts  ("use server")
//   export type RemoveBookmarkResult =
//     | { ok: true } | { ok: false; code: "unauthenticated" };
//   export async function removeBookmarkAction(commentId: string):
//     Promise<RemoveBookmarkResult>;
//
// Both actions read the session via `auth.api.getSession({ headers: await
// headers() })` from `@/server/auth`; the mock returns `{ user: { id } }` (a
// signed-in viewer) or `null` (anonymous).
//
// Scenarios → plan §7 / ADR-0032 F-BM-1:
//   adds-once                  — a valid others-comment bookmark inserts ONE row.
//   add-idempotent-on-conflict — double-add nets ONE row (ON CONFLICT DO NOTHING
//                                over UNIQUE(user_id, comment_id) — the D-1
//                                storage backstop); both calls `{ ok: true }`.
//   rejects-self-bookmark      — viewer bookmarks their OWN comment → `{ ok:
//                                false, code:"self_bookmark_forbidden" }`, no row
//                                (D-3 others-only, defense-in-depth).
//   remove-idempotent          — remove on an ABSENT bookmark → `{ ok: true }`
//                                no-op (no throw); on a PRESENT one → row gone.
//   rejects-nonexistent-comment — signed-in viewer + a uuid with NO comment row
//                                → `{ ok:false, code:"comment_not_found" }` (the
//                                plan §3.2 not-found branch); no write.
//   rejects-anonymous          — getSession → null makes BOTH actions return
//                                `{ ok:false, code:"unauthenticated" }`, no write.

vi.mock("@sentry/nextjs", () => ({
	captureMessage: vi.fn(),
	addBreadcrumb: vi.fn(),
	captureException: vi.fn(),
}));

const { mockGetSession } = vi.hoisted(() => ({ mockGetSession: vi.fn() }));

vi.mock("@/server/auth", () => ({
	auth: { api: { getSession: mockGetSession } },
}));

// The actions call `await headers()` before `getSession` — provide a stable
// stub (getSession is mocked to ignore its arg; the tos-accept-grant vehicle).
vi.mock("next/headers", () => ({
	headers: () => ({ get: vi.fn() }),
	cookies: () => ({ get: vi.fn(), set: vi.fn(), delete: vi.fn() }),
}));

// Route the production `@/db` import to the fixture testDb so the Server
// Action's writes land on the real test Postgres and the assertions (which read
// through the SAME testDb) observe them.
vi.mock("@/db", async () => {
	const { testDb } = await import("../../db/_fixtures/db");
	return { db: testDb };
});
vi.mock("@/db/index", async () => {
	const { testDb } = await import("../../db/_fixtures/db");
	return { db: testDb };
});

import { bookmarks, comments, markets, users } from "@/db/schema";
// ── RED IMPORTS: these two modules do not exist until Slice 2 lands ──────────
import { addBookmarkAction } from "@/server/bookmarks/add";
import { removeBookmarkAction } from "@/server/bookmarks/remove";

import { testClient, testDb } from "../../db/_fixtures/db";
import { truncateTables } from "../../db/_fixtures/truncate";

async function seedUser(tag: string): Promise<string> {
	const id = uuidv7();
	await testDb.insert(users).values({
		id,
		name: `Fixture ${tag}`,
		email: `${tag}@example.com`,
		pseudonym: tag,
		emailVerified: false,
	});
	return id;
}

async function seedMarket(slug: string): Promise<string> {
	const id = uuidv7();
	await testDb.insert(markets).values({
		id,
		slug,
		title: `Market ${slug}`,
		status: "Open",
		resolutionDeadline: new Date("2026-11-01T00:00:00Z"),
	});
	return id;
}

/** A minimal comment (no bet needed — the add/remove path only reads user_id). */
async function seedComment(args: {
	userId: string;
	marketId: string;
	side?: "YES" | "NO";
}): Promise<string> {
	const id = uuidv7();
	await testDb.insert(comments).values({
		id,
		userId: args.userId,
		marketId: args.marketId,
		parentCommentId: null,
		body: "a bookmarkable argument",
		sideAtPostTime: args.side ?? "YES",
		createdAt: new Date("2026-09-01T10:00:00Z"),
	});
	return id;
}

async function bookmarkRowsFor(userId: string, commentId: string) {
	return testDb
		.select({ id: bookmarks.id })
		.from(bookmarks)
		.where(
			and(eq(bookmarks.userId, userId), eq(bookmarks.commentId, commentId)),
		);
}

async function bookmarkRowsForComment(commentId: string) {
	return testDb
		.select({ id: bookmarks.id })
		.from(bookmarks)
		.where(eq(bookmarks.commentId, commentId));
}

describe("UI-A6 Slice 2 — bookmark write actions (F-BM-1)", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(async () => {
		await truncateTables(testClient, [
			"bookmarks",
			"comments",
			"markets",
			"users",
		]);
	});

	it("bookmark-write::adds-once", async () => {
		const viewer = await seedUser("bm-adds-viewer");
		const author = await seedUser("bm-adds-author");
		const marketId = await seedMarket("bm-adds-market");
		const commentId = await seedComment({ userId: author, marketId });
		mockGetSession.mockResolvedValue({ user: { id: viewer } });

		const res = await addBookmarkAction(commentId);
		expect(res).toEqual({ ok: true });

		const rows = await bookmarkRowsFor(viewer, commentId);
		expect(rows.length).toBe(1);
	});

	it("bookmark-write::add-idempotent-on-conflict", async () => {
		const viewer = await seedUser("bm-idem-viewer");
		const author = await seedUser("bm-idem-author");
		const marketId = await seedMarket("bm-idem-market");
		const commentId = await seedComment({ userId: author, marketId });
		mockGetSession.mockResolvedValue({ user: { id: viewer } });

		// Two rapid taps → ON CONFLICT (user_id, comment_id) DO NOTHING.
		const first = await addBookmarkAction(commentId);
		const second = await addBookmarkAction(commentId);
		expect(first).toEqual({ ok: true });
		expect(second).toEqual({ ok: true });

		// Exactly ONE row — the UNIQUE(user_id, comment_id) storage backstop.
		const rows = await bookmarkRowsFor(viewer, commentId);
		expect(rows.length).toBe(1);
	});

	it("bookmark-write::rejects-self-bookmark", async () => {
		const viewer = await seedUser("bm-self-viewer");
		const marketId = await seedMarket("bm-self-market");
		// The comment is authored by the VIEWER — the D-3 others-only guard.
		const ownComment = await seedComment({ userId: viewer, marketId });
		mockGetSession.mockResolvedValue({ user: { id: viewer } });

		const res = await addBookmarkAction(ownComment);
		expect(res).toEqual({ ok: false, code: "self_bookmark_forbidden" });

		// No row written — the guard fires BEFORE the insert.
		const rows = await bookmarkRowsFor(viewer, ownComment);
		expect(rows.length).toBe(0);
	});

	it("bookmark-write::rejects-nonexistent-comment", async () => {
		const viewer = await seedUser("bm-nf-viewer");
		// A signed-in viewer (valid session) exercises the NOT-FOUND branch (plan
		// §3.2: "Load the target comment's user_id; not-found → not-found error"),
		// distinct from the anonymous branch.
		mockGetSession.mockResolvedValue({ user: { id: viewer } });
		// A well-formed uuid with NO backing comment row.
		const missingCommentId = uuidv7();

		const res = await addBookmarkAction(missingCommentId);
		expect(res).toEqual({ ok: false, code: "comment_not_found" });

		// No row written.
		expect((await bookmarkRowsForComment(missingCommentId)).length).toBe(0);
	});

	it("bookmark-write::remove-idempotent", async () => {
		const viewer = await seedUser("bm-rm-viewer");
		const author = await seedUser("bm-rm-author");
		const marketId = await seedMarket("bm-rm-market");
		const commentId = await seedComment({ userId: author, marketId });
		mockGetSession.mockResolvedValue({ user: { id: viewer } });

		// (a) ABSENT → a successful no-op, never a throw.
		const absent = await removeBookmarkAction(commentId);
		expect(absent).toEqual({ ok: true });
		expect((await bookmarkRowsFor(viewer, commentId)).length).toBe(0);

		// (b) PRESENT → deleted. Seed the row via the add action itself.
		await addBookmarkAction(commentId);
		expect((await bookmarkRowsFor(viewer, commentId)).length).toBe(1);

		const present = await removeBookmarkAction(commentId);
		expect(present).toEqual({ ok: true });
		expect((await bookmarkRowsFor(viewer, commentId)).length).toBe(0);
	});

	it("bookmark-write::rejects-anonymous", async () => {
		const author = await seedUser("bm-anon-author");
		const marketId = await seedMarket("bm-anon-market");
		const commentId = await seedComment({ userId: author, marketId });
		// No session — anonymous.
		mockGetSession.mockResolvedValue(null);

		const add = await addBookmarkAction(commentId);
		expect(add).toEqual({ ok: false, code: "unauthenticated" });

		const remove = await removeBookmarkAction(commentId);
		expect(remove).toEqual({ ok: false, code: "unauthenticated" });

		// The anonymous add wrote nothing (there is no anonymous bookmark set).
		expect((await bookmarkRowsForComment(commentId)).length).toBe(0);
	});
});
