import { createHash } from "node:crypto";
import {
	appendFileSync,
	existsSync,
	readFileSync,
	writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { and, count, desc, eq, inArray, sql } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// ═══════════════════════════════════════════════════════════════════════════
// SEED-1-DUMMY — THE SEED RUNNER. ADR-0053. READ IT BEFORE CHANGING ANYTHING.
//
// THIS IS NOT A TEST. It is an operational artifact under the Vitest harness
// (ADR-0036 primitive 1) that WRITES to the database `ZUGZWANG_SEED_TARGET`
// resolves — local, staging, or PRODUCTION. Invoke it only through
// `scripts/seed-prod.ts`, which sets the parameters and the acknowledgements.
//
// It drives the SHIPPED engine and writes nothing itself — the same three
// controls as the staging generator: no raw handle (`_lib/client.ts`), a
// behavioural write guard that throws on a write issued from `tests/`, and a
// source tripwire (tests/unit/prod-seed/no-direct-writes.test.ts).
//
//   accounts  Better Auth `createOAuthUser` (the real identity-pool consume) →
//             the real `acceptTosAction` (ToS evidence, initial grant).
//   rows      the participant image chain → `runBetTransaction` → `place()`.
//
// RESUMABLE, AND RESUME IS VERIFIED RATHER THAN TRUSTED. Every row's bet key is
// derived from the table and every receipt carries the row's content
// fingerprint. A receipt under a seed key is skipped only when its fingerprint,
// market and user all match the table; anything else refuses the whole run.
//
// ⚠ `place()` IS DRIVEN BELOW THE ROUTE, so the route's checks are re-done here
// explicitly: the conclusion freeze and the author's ban before EVERY row, and
// `validateReplyParent` before every reply. Stake floors, the ceiling and body
// length are the table validator's. Text moderation is not run: SEED-1 D11, the
// content is the operator's own (ADR-0053).
// ═══════════════════════════════════════════════════════════════════════════

// ── SHELL MOCKS (ADR-0036 primitive 3 — nothing that writes or moves Dharma) ─
vi.mock("@sentry/nextjs", () => ({
	captureMessage: vi.fn(),
	captureException: vi.fn(),
	addBreadcrumb: vi.fn(),
}));

const { mockVerifyOnboardingRef, mockCookiesGet, mockHeadersGet } = vi.hoisted(
	() => ({
		mockVerifyOnboardingRef: vi.fn(),
		mockCookiesGet: vi.fn(),
		mockHeadersGet: vi.fn(),
	}),
);

vi.mock("@/server/auth/onboarding-ref", () => ({
	signOnboardingRef: vi.fn(),
	verifyOnboardingRef: mockVerifyOnboardingRef,
}));

vi.mock("next/headers", () => ({
	cookies: () => ({ get: mockCookiesGet, set: vi.fn(), delete: vi.fn() }),
	headers: () => ({ get: mockHeadersGet }),
}));

vi.mock("next/navigation", () => ({ redirect: vi.fn(), notFound: vi.fn() }));

vi.mock("next/cache", () => ({
	revalidatePath: vi.fn(),
	revalidateTag: vi.fn(),
	updateTag: vi.fn(),
}));

// THE LOAD-BEARING MOCK: the engine writes through the write-guarded client.
vi.mock("@/db", async () => {
	const { guardedDb } = await import("./_lib/client");
	return { db: guardedDb };
});
vi.mock("@/db/index", async () => {
	const { guardedDb } = await import("./_lib/client");
	return { db: guardedDb };
});

import {
	accounts,
	betReceipts,
	bets,
	comments,
	identityPool,
	imageUploads,
	liquidityPolicy,
	markets,
	pools,
	systemState,
	users,
} from "@/db/schema";
import { auth } from "@/server/auth/index";
import { acceptTosAction } from "@/server/auth/tos-accept";
import { place } from "@/server/bets/place";
import { runBetTransaction } from "@/server/bets/transaction";
import { validateReplyParent } from "@/server/comments/reply-validate";
import { PUT_URL_TTL_SECONDS } from "@/server/config/limits";
import { CpmmDecimal } from "@/server/cpmm/decimal";
import { mintPutUrl } from "@/server/storage/r2";
import { signUploadAndInsert } from "@/server/storage/sign-upload";
import { verifyUploadedObject } from "@/server/storage/verify-object";

import {
	assertSeedLiveConnection,
	closeSeedConnection,
	describeSeedTarget,
	forbiddenTableWrites,
	guardedDb,
	readOnly,
	SEED_MODE,
	writeLog,
} from "./_lib/client";
import { preflightImages } from "./_lib/images";
import {
	IMAGE_MIME_BY_EXT,
	imageExt,
	parseTable,
	rowFingerprint,
	type SeedRow,
	validateTable,
} from "./_lib/table";
import { resolveSeedTarget } from "./_lib/target";

// ── THE TARGET GUARD, AT MODULE SCOPE, IN THE FILE AN OPERATOR READS ─────────
const seedTarget = resolveSeedTarget(process.env);
if (!seedTarget.ok) {
	throw new Error(
		`REFUSED — the seed target guard did not pass.\n  ${seedTarget.reason}\n\nRun it through scripts/seed-prod.ts.`,
	);
}

// ── PARAMETERS (set by scripts/seed-prod.ts; never defaulted) ────────────────
const TABLE_PATH = process.env.ZUGZWANG_SEED_TABLE;
if (!TABLE_PATH || !existsSync(TABLE_PATH)) {
	throw new Error(
		`REFUSED — ZUGZWANG_SEED_TABLE must name an existing table.json (saw ${JSON.stringify(TABLE_PATH)}).`,
	);
}
const IMAGES_DIR = process.env.ZUGZWANG_SEED_IMAGES || undefined;
const WINDOW_LIVE = process.env.ZUGZWANG_SEED_WINDOW_LIVE === "1";
const PREFLIGHT_ONLY = process.env.ZUGZWANG_SEED_PREFLIGHT_ONLY === "1";
const LIMIT = process.env.ZUGZWANG_SEED_LIMIT
	? Number(process.env.ZUGZWANG_SEED_LIMIT)
	: null;
if (LIMIT !== null && (!Number.isInteger(LIMIT) || LIMIT < 1)) {
	throw new Error(
		`REFUSED — ZUGZWANG_SEED_LIMIT must be a positive integer (saw ${process.env.ZUGZWANG_SEED_LIMIT}).`,
	);
}

const TABLE_TEXT = readFileSync(TABLE_PATH, "utf8");
const TABLE_HASH = createHash("sha256").update(TABLE_TEXT).digest("hex");
const TABLE = parseTable(JSON.parse(TABLE_TEXT));
const RUN_DIR = dirname(TABLE_PATH);
const PROGRESS_PATH = join(RUN_DIR, `progress-${SEED_MODE}.jsonl`);
const MANIFEST_PATH = join(RUN_DIR, `manifest-${SEED_MODE}.json`);
const STATE_PATH = join(RUN_DIR, `state-${SEED_MODE}.json`);
/** Written on a deterministic refusal, so `--until-done` stops retrying. */
const REFUSAL_PATH = join(RUN_DIR, `REFUSED-${SEED_MODE}.txt`);
const KEY_PREFIX = `seed-${TABLE.runId}-`;
const ACCOUNT_PREFIX = `dummy-seed-sub-${TABLE.runId}-`;

/**
 * `--limit N` means THE FIRST N ROWS OF THE TABLE — not the next N pending. So
 * the same command run twice places nothing the second time, and only the
 * authors of those N rows get accounts.
 */
const SELECTED = LIMIT === null ? TABLE.rows : TABLE.rows.slice(0, LIMIT);
const ROW_BY_KEY = new Map(TABLE.rows.map((r) => [r.key, r]));

const MAX_DUE_MS = SELECTED.reduce((m, r) => Math.max(m, r.dueOffsetMs), 0);
const RUN_TIMEOUT_MS = (WINDOW_LIVE ? MAX_DUE_MS : 0) + 12 * 60 * 60 * 1000;

/** Obviously-synthetic literals: these rows must never read as a real person. */
const SEED_IP = "SYNTHETIC-SEED-NO-IP-WAS-RECORDED";
const SEED_UA = `SYNTHETIC-SEED-NO-USER-AGENT-WAS-RECORDED (ZugzwangSeedRunner run=${TABLE.runId})`;

function emailFor(author: string): string {
	return `dummy-seed-${TABLE.runId}-${author}@seed.example.com`.toLowerCase();
}

function betMetadata(userId: string, flowId: string, key: string | null) {
	return {
		request_id: `seed-${TABLE.runId}`,
		flow_id: flowId,
		user_id: userId,
		actor_id: userId,
		idempotency_key: key,
		ip: SEED_IP,
		user_agent: SEED_UA,
	};
}

function log(message: string): void {
	console.log(`[seed:${SEED_MODE}] ${message}`);
}

/** A refusal that a retry cannot fix: record it for the CLI, then throw. */
function refuse(message: string): never {
	const text = `REFUSED — ${message}`;
	writeFileSync(REFUSAL_PATH, `${new Date().toISOString()}\n${text}\n`);
	throw new Error(text);
}

// ── ROUTE CHECKS, RE-DONE ───────────────────────────────────────────────────

/**
 * The conclusion freeze (CLAUDE.md §3). The route checks it; `place()` does
 * not. Refuses when the flag is set AND when the singleton row is missing —
 * `isFrozen()` treats a missing row as "not frozen", which is the wrong
 * direction for a tool that writes production. `WHERE id = 'system'` for the
 * reason `src/server/markets/open.ts` records.
 */
async function assertNotFrozen(): Promise<void> {
	const [row] = await readOnly
		.select({ frozenAt: systemState.frozenAt })
		.from(systemState)
		.where(eq(systemState.id, "system"))
		.limit(1);
	if (row === undefined) {
		refuse(
			"system_state has no 'system' row; the freeze cannot be read, so nothing is written.",
		);
	}
	if (row.frozenAt !== null) {
		refuse(
			`the conclusion freeze is set (frozen_at ${row.frozenAt.toISOString()}). Recovery is BREAK_GLASS.md only.`,
		);
	}
}

/** The route refuses a banned author; `place()` does not. */
async function assertNotBanned(userId: string, author: string): Promise<void> {
	const [row] = await readOnly
		.select({ bannedAt: users.bannedAt })
		.from(users)
		.where(eq(users.id, userId));
	if (row?.bannedAt != null) {
		refuse(
			`seed account ${author} (${userId}) is banned; its remaining rows will not be placed.`,
		);
	}
}

// ── ENGINE CALLS ────────────────────────────────────────────────────────────

/** Better Auth's real OAuth create path — the pool consume and the INSERT are shipped code. */
async function createAccount(author: string): Promise<string> {
	const ctx = await auth.$context;
	const userPayload = {
		email: emailFor(author),
		name: `Dummy seed ${author}`,
		image: null,
		emailVerified: true,
		googleId: `${ACCOUNT_PREFIX}${author}`,
	};
	const created = await ctx.internalAdapter.createOAuthUser(userPayload, {
		providerId: "google",
		accountId: `${ACCOUNT_PREFIX}${author}`,
		accessToken: "seed-runner-access-token",
		refreshToken: "seed-runner-refresh-token",
		idToken: "seed-runner-id-token",
		scope: "openid email profile",
		accessTokenExpiresAt: null,
		refreshTokenExpiresAt: null,
	});
	const userId = (created as { user?: { id?: string } } | null)?.user?.id;
	if (!userId)
		throw new Error(`createOAuthUser returned no user for ${author}`);
	return userId;
}

/** The real `acceptTosAction`: ToS evidence, `grantInitialDharma`, the event. */
async function acceptTos(userId: string): Promise<void> {
	mockCookiesGet.mockImplementation((name: string) =>
		name === "onboarding_ref"
			? { name: "onboarding_ref", value: "seed-runner-onboarding-ref" }
			: undefined,
	);
	mockHeadersGet.mockImplementation((header: string) => {
		if (header === "x-forwarded-for") return SEED_IP;
		if (header === "user-agent") return SEED_UA;
		return null;
	});
	mockVerifyOnboardingRef.mockReturnValue({ userId });
	const formData = new FormData();
	formData.set("accepted", "true");
	await acceptTosAction(formData);
}

/** The participant image chain, in ADR-0014 order: DB tx commits, THEN HTTP. */
async function uploadImage(userId: string, filename: string) {
	if (!IMAGES_DIR) throw new Error("no images folder");
	const bytes = readFileSync(join(IMAGES_DIR, filename));
	const contentType = IMAGE_MIME_BY_EXT[imageExt(filename)] as string;
	const { uploadId, key } = await guardedDb.transaction((tx) =>
		signUploadAndInsert(tx, {
			userId,
			contentType,
			byteSize: bytes.byteLength,
			eventId: uuidv7(),
			metadata: betMetadata(userId, "F-COMMENT-3", null),
		}),
	);
	const putUrl = await mintPutUrl(
		"uploads",
		key,
		contentType,
		PUT_URL_TTL_SECONDS,
		{ ifNoneMatch: true },
	);
	const put = await fetch(putUrl, {
		method: "PUT",
		body: bytes,
		headers: { "Content-Type": contentType, "If-None-Match": "*" },
		signal: AbortSignal.timeout(PUT_URL_TTL_SECONDS * 1000),
	});
	if (!put.ok)
		throw new Error(
			`image PUT failed: HTTP ${put.status} ${put.statusText} for ${filename}`,
		);
	const verified = await verifyUploadedObject(key);
	return {
		uploadId,
		r2ObjectKey: key,
		committedEventId: uuidv7(),
		etag: verified.etag ?? null,
		byteSizeActual: verified.byteSize,
	};
}

async function placeRow(
	row: SeedRow,
	userId: string,
	marketId: string,
	parentCommentId: string | null,
) {
	const image = row.image ? await uploadImage(userId, row.image) : null;
	const flow = parentCommentId !== null ? "F-COMMENT-2" : "F-BET-1";
	// Event ids are minted ONCE per row, outside the retried callback (retry purity).
	const ids = {
		betEventId: uuidv7(),
		commentEventId: uuidv7(),
		creditEventId: uuidv7(),
	};
	return runBetTransaction({ marketId, flow }, (ctx) =>
		place(ctx, {
			userId,
			marketId,
			side: row.side,
			stake: row.stake,
			body: row.body,
			parentCommentId,
			idempotencyKey: row.key,
			bodyFingerprint: rowFingerprint(row),
			...ids,
			image,
			metadata: betMetadata(userId, flow, row.key),
		}),
	);
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── PRE-FLIGHT STATE (read-only) ────────────────────────────────────────────
const marketIdBySlug = new Map<string, string>();
const userIdByAuthor = new Map<string, string>();
const tosPending = new Set<string>();
/** Keys whose receipt was VERIFIED against the table. */
const doneKeys = new Set<string>();
let neededAuthors: string[] = [];
let preflightDone = false;
let placedThisRun = 0;
let generationError: unknown = null;

beforeAll(async () => {
	await assertSeedLiveConnection();
	log(
		`target ${describeSeedTarget()} · table ${TABLE_PATH} · run ${TABLE.runId}`,
	);

	const tableErrors = validateTable(TABLE);
	if (tableErrors.length > 0) {
		refuse(
			`table invalid (${tableErrors.length}):\n  ${tableErrors.slice(0, 30).join("\n  ")}`,
		);
	}
	const selectedImages = { ...TABLE, rows: SELECTED };
	const imageErrors = preflightImages(
		LIMIT === null ? TABLE : selectedImages,
		IMAGES_DIR,
	).filter((e) => LIMIT === null || !e.includes("maps to no row"));
	if (imageErrors.length > 0) {
		refuse(
			`images folder (${imageErrors.length}):\n  ${imageErrors.slice(0, 30).join("\n  ")}`,
		);
	}

	await assertNotFrozen();

	// ── Markets ─────────────────────────────────────────────────────────────
	const marketRows = await readOnly
		.select({ id: markets.id, slug: markets.slug, status: markets.status })
		.from(markets)
		.where(inArray(markets.slug, [...TABLE.markets]));
	for (const m of marketRows) marketIdBySlug.set(m.slug, m.id);
	const notOpen = TABLE.markets.filter(
		(s) => marketRows.find((m) => m.slug === s)?.status !== "Open",
	);
	if (notOpen.length > 0) {
		refuse(`markets missing or not Open: ${notOpen.join(", ")}`);
	}

	// ── Accounts: by derived Google sub, AND by derived email ───────────────
	neededAuthors = [...new Set(SELECTED.map((r) => r.author))];
	const existing = await readOnly
		.select({
			accountId: accounts.accountId,
			userId: accounts.userId,
			tos: users.tosAcceptedAt,
			bannedAt: users.bannedAt,
		})
		.from(accounts)
		.innerJoin(users, eq(users.id, accounts.userId))
		.where(
			and(
				eq(accounts.providerId, "google"),
				sql`starts_with(${accounts.accountId}, ${ACCOUNT_PREFIX})`,
			),
		);
	const banned: string[] = [];
	for (const e of existing) {
		const author = e.accountId.slice(ACCOUNT_PREFIX.length);
		userIdByAuthor.set(author, e.userId);
		if (e.tos === null) tosPending.add(author);
		if (e.bannedAt !== null) banned.push(author);
	}
	// A user row without its account is what a crash between Better Auth's two
	// INSERTs leaves. Re-creating it would take a fresh identity tuple and then
	// fail on the unique email — every retry, forever. Refuse and name it.
	const byEmail = await readOnly
		.select({ id: users.id, email: users.email })
		.from(users)
		.where(inArray(users.email, neededAuthors.map(emailFor)));
	const orphans = neededAuthors.filter(
		(a) =>
			!userIdByAuthor.has(a) && byEmail.some((u) => u.email === emailFor(a)),
	);
	if (orphans.length > 0) {
		refuse(
			`seed user row(s) exist without their Google account (an interrupted create): ${orphans.join(", ")}. Resolve by hand before re-running.`,
		);
	}
	const bannedNeeded = banned.filter((a) => neededAuthors.includes(a));
	if (bannedNeeded.length > 0) {
		refuse(`seed account(s) banned: ${bannedNeeded.join(", ")}`);
	}
	const toCreate = neededAuthors.filter((a) => !userIdByAuthor.has(a)).length;

	// ── Receipts: verified, not trusted ─────────────────────────────────────
	const receipts = await readOnly
		.select({
			key: betReceipts.idempotencyKey,
			userId: betReceipts.userId,
			marketId: betReceipts.marketId,
			fingerprint: betReceipts.bodyFingerprint,
		})
		.from(betReceipts)
		.where(sql`starts_with(${betReceipts.idempotencyKey}, ${KEY_PREFIX})`);
	const mismatched: string[] = [];
	for (const r of receipts) {
		const row = ROW_BY_KEY.get(r.key);
		const why =
			row === undefined
				? "key is not in this table"
				: r.fingerprint !== rowFingerprint(row)
					? "content fingerprint differs (table regenerated or edited?)"
					: r.marketId !== marketIdBySlug.get(row.market)
						? "placed on a different market"
						: userIdByAuthor.get(row.author) !== r.userId
							? "placed by a different user"
							: null;
		if (why === null) doneKeys.add(r.key);
		else mismatched.push(`${r.key}: ${why}`);
	}
	if (mismatched.length > 0) {
		refuse(
			`${mismatched.length} existing receipt(s) under this run's keys do not match the table:\n  ${mismatched.slice(0, 20).join("\n  ")}`,
		);
	}

	// ── Window state is bound to this exact table ───────────────────────────
	if (WINDOW_LIVE && existsSync(STATE_PATH)) {
		const state = JSON.parse(readFileSync(STATE_PATH, "utf8")) as {
			tableHash?: string;
		};
		if (state.tableHash !== TABLE_HASH) {
			refuse(
				`${STATE_PATH} belongs to a different table; delete it to start a new window.`,
			);
		}
	}

	const [pool] = await readOnly
		.select({
			free: sql<number>`count(*) FILTER (WHERE ${identityPool.assignedAt} IS NULL)::int`,
		})
		.from(identityPool);
	const free = pool?.free ?? 0;
	const [userCount] = await readOnly.select({ n: count() }).from(users);
	const [policy] = await readOnly
		.select({
			version: liquidityPolicy.version,
			enabled: liquidityPolicy.enabled,
			floor: liquidityPolicy.floor,
			coefficient: liquidityPolicy.coefficient,
		})
		.from(liquidityPolicy)
		.orderBy(desc(liquidityPolicy.version))
		.limit(1);

	const pending = SELECTED.filter((r) => !doneKeys.has(r.key));
	log(
		[
			"PRE-FLIGHT",
			"  freeze         not set",
			...TABLE.markets.map(
				(s) => `  market         ${s.padEnd(40)} ${marketIdBySlug.get(s)} Open`,
			),
			`  rows           table ${TABLE.rows.length} · selected ${SELECTED.length}${LIMIT ? ` (--limit ${LIMIT})` : ""} · placed ${doneKeys.size} (verified) · pending ${pending.length}`,
			`  images         ${SELECTED.filter((r) => r.image).length} selected rows · folder ${IMAGES_DIR ?? "(none)"}`,
			`  accounts       ${neededAuthors.length} needed · ${neededAuthors.length - toCreate} exist · ${toCreate} to create · ${tosPending.size} awaiting ToS`,
			`  identity pool  ${free} free`,
			`  users in DB    ${userCount?.n ?? "?"}`,
			`  liquidity      ${policy ? `v${policy.version} enabled=${policy.enabled} floor=${policy.floor} coefficient=${policy.coefficient}` : "(no policy row)"}`,
			`  timing         ${WINDOW_LIVE ? `live window, last selected row due +${Math.round(MAX_DUE_MS / 60000)} min` : "immediate"}`,
		].join("\n"),
	);

	if (free < toCreate) {
		refuse(
			`identity_pool has ${free} free tuples, ${toCreate} accounts still to create.`,
		);
	}
	preflightDone = true;
	if (PREFLIGHT_ONLY) log("PREFLIGHT ONLY — nothing will be written.");
});

afterAll(async () => {
	await closeSeedConnection();
});

describe("seed run", () => {
	// NEVER skipped. A suite whose every test is skipped is itself skipped, and a
	// skipped suite never runs `beforeAll` — so without this, `--preflight-only`
	// would read nothing and exit green.
	it("passed pre-flight", () => {
		expect(preflightDone).toBe(true);
	});

	it.skipIf(PREFLIGHT_ONLY)(
		"creates the needed accounts and places every pending selected row through the engine",
		async () => {
			try {
				// ── ACCOUNTS (only the authors of the selected rows) ─────────
				let created = 0;
				for (const author of neededAuthors) {
					let userId = userIdByAuthor.get(author);
					if (!userId) {
						userId = await createAccount(author);
						userIdByAuthor.set(author, userId);
						tosPending.add(author);
						created += 1;
					}
					if (tosPending.has(author)) {
						await acceptTos(userId);
						tosPending.delete(author);
					}
					if (created > 0 && created % 100 === 0)
						log(`accounts created ${created}`);
				}
				log(
					`accounts ready · ${neededAuthors.length} (${created} created this run)`,
				);

				// ── ROWS ─────────────────────────────────────────────────────
				const commentByKey = new Map<string, string>();
				if (doneKeys.size > 0) {
					const placed = await readOnly
						.select({ key: bets.idempotencyKey, commentId: bets.commentId })
						.from(bets)
						.where(inArray(bets.idempotencyKey, [...doneKeys]));
					for (const b of placed)
						if (b.key) commentByKey.set(b.key, b.commentId);
				}

				const pending = SELECTED.filter((r) => !doneKeys.has(r.key));

				let startedAt = Date.now();
				if (WINDOW_LIVE) {
					if (existsSync(STATE_PATH)) {
						startedAt = (
							JSON.parse(readFileSync(STATE_PATH, "utf8")) as {
								startedAt: number;
							}
						).startedAt;
					} else {
						writeFileSync(
							STATE_PATH,
							JSON.stringify({
								runId: TABLE.runId,
								tableHash: TABLE_HASH,
								startedAt,
							}),
						);
					}
					log(`window started ${new Date(startedAt).toISOString()}`);
				}

				for (const row of pending) {
					if (WINDOW_LIVE) {
						const wait = startedAt + row.dueOffsetMs - Date.now();
						if (wait > 0) {
							if (wait > 60_000)
								log(
									`next row ${row.key} due in ${Math.round(wait / 60000)} min`,
								);
							await sleep(wait);
						}
					}
					const userId = userIdByAuthor.get(row.author) as string;
					const marketId = marketIdBySlug.get(row.market) as string;

					await assertNotFrozen();
					await assertNotBanned(userId, row.author);

					let parentCommentId: string | null = null;
					if (row.parentKey !== null) {
						const candidate = commentByKey.get(row.parentKey);
						if (!candidate) {
							refuse(
								`row ${row.key}: parent ${row.parentKey} has not been placed`,
							);
						}
						// The route's parent check — same market, depth 1 — plus the
						// side the table expects the parent to hold.
						const parent = await validateReplyParent(guardedDb, {
							parentCommentId: candidate,
							marketId,
						});
						const want =
							row.kind === "support"
								? row.side
								: row.side === "YES"
									? "NO"
									: "YES";
						if (parent.sideAtPostTime !== want) {
							refuse(
								`row ${row.key}: parent is ${parent.sideAtPostTime}, the table expects ${want}`,
							);
						}
						parentCommentId = parent.parentCommentId;
					}

					const result = await placeRow(row, userId, marketId, parentCommentId);
					commentByKey.set(row.key, result.commentId);
					doneKeys.add(row.key);
					placedThisRun += 1;
					appendFileSync(
						PROGRESS_PATH,
						`${JSON.stringify({
							key: row.key,
							market: row.market,
							kind: row.kind,
							side: row.side,
							stake: row.stake,
							author: row.author,
							userId,
							betId: result.betId,
							commentId: result.commentId,
							priceAfter: result.newPrice,
							at: new Date().toISOString(),
						})}\n`,
					);
					if (placedThisRun % 25 === 0) {
						log(
							`placed ${placedThisRun}/${pending.length} · ${row.market} YES=${result.newPrice}`,
						);
					}
				}
				log(`rows placed this run: ${placedThisRun}`);
			} catch (err) {
				generationError = err;
				throw err;
			}
		},
		RUN_TIMEOUT_MS,
	);

	it.skipIf(PREFLIGHT_ONLY)(
		"wrote every row through the engine — no write originated in tests/",
		() => {
			expect(generationError).toBeNull();
			const log = writeLog();
			const fromTests = (w: { caller: string }) =>
				w.caller.replace(/\\/g, "/").includes("/tests/");
			expect(log.filter(fromTests)).toEqual([]);
			if (placedThisRun > 0) {
				// Non-vacuous: rows were placed, so the guard must have SEEN the
				// engine write them. An empty log here means the guard was bypassed.
				const tables = new Set(
					forbiddenTableWrites()
						.filter((w) => w.caller.replace(/\\/g, "/").includes("/src/"))
						.map((w) => w.table),
				);
				expect(tables.has("bets")).toBe(true);
				expect(tables.has("comments")).toBe(true);
			}
		},
	);

	it.skipIf(PREFLIGHT_ONLY)(
		"tripped no Sentry fail-open during the run",
		async () => {
			const Sentry = await import("@sentry/nextjs");
			const captured = [
				...vi
					.mocked(Sentry.captureException)
					.mock.calls.map((c) => String(c[0])),
				...vi.mocked(Sentry.captureMessage).mock.calls.map((c) => String(c[0])),
			];
			expect(captured).toEqual([]);
		},
	);

	it.skipIf(PREFLIGHT_ONLY)(
		"rebuilds the manifest from the database and reports per market",
		async () => {
			// The manifest is REBUILT from the database, not accumulated in memory:
			// a commit whose acknowledgement was lost, or a crash before the
			// progress line, is still recorded here.
			const accountRows = await readOnly
				.select({
					accountId: accounts.accountId,
					userId: users.id,
					pseudonym: users.pseudonym,
					email: users.email,
				})
				.from(accounts)
				.innerJoin(users, eq(users.id, accounts.userId))
				.where(
					and(
						eq(accounts.providerId, "google"),
						sql`starts_with(${accounts.accountId}, ${ACCOUNT_PREFIX})`,
					),
				);
			const betRows = await readOnly
				.select({
					key: bets.idempotencyKey,
					betId: bets.id,
					commentId: bets.commentId,
					userId: bets.userId,
					marketId: bets.marketId,
					uploadId: comments.imageUploadsId,
					r2ObjectKey: imageUploads.r2ObjectKey,
				})
				.from(bets)
				.innerJoin(comments, eq(comments.id, bets.commentId))
				.leftJoin(imageUploads, eq(imageUploads.id, comments.imageUploadsId))
				.where(sql`starts_with(${bets.idempotencyKey}, ${KEY_PREFIX})`);
			writeFileSync(
				MANIFEST_PATH,
				`${JSON.stringify(
					{
						runId: TABLE.runId,
						mode: SEED_MODE,
						tableHash: TABLE_HASH,
						rebuiltAt: new Date().toISOString(),
						accounts: accountRows.map((a) => ({
							author: a.accountId.slice(ACCOUNT_PREFIX.length),
							userId: a.userId,
							pseudonym: a.pseudonym,
							email: a.email,
						})),
						bets: betRows,
					},
					null,
					"\t",
				)}\n`,
			);
			log(
				`manifest ${MANIFEST_PATH} · ${accountRows.length} accounts · ${betRows.length} bets`,
			);

			const placedKeys = new Set(betRows.map((b) => b.key));
			const poolRows = await readOnly
				.select({
					marketId: pools.marketId,
					yes: pools.yesReserves,
					no: pools.noReserves,
				})
				.from(pools)
				.where(inArray(pools.marketId, [...marketIdBySlug.values()]));
			for (const slug of TABLE.markets) {
				const rows = TABLE.rows.filter((r) => r.market === slug);
				const done = rows.filter((r) => placedKeys.has(r.key));
				const p = poolRows.find((x) => x.marketId === marketIdBySlug.get(slug));
				// Display only; p_yes = NO reserve over the tank (ADR-0047 §B).
				const price = p
					? new CpmmDecimal(p.no)
							.div(new CpmmDecimal(p.yes).plus(new CpmmDecimal(p.no)))
							.toFixed(4)
					: "—";
				log(
					`${slug.padEnd(40)} posts ${done.filter((r) => r.kind === "post").length}/${rows.filter((r) => r.kind === "post").length} · replies ${done.filter((r) => r.kind !== "post").length}/${rows.filter((r) => r.kind !== "post").length} · YES ${price}`,
				);
			}
			expect(betRows.length).toBe(doneKeys.size);
			if (LIMIT === null) expect(betRows.length).toBe(TABLE.rows.length);
		},
	);
});
