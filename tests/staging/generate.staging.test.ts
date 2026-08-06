import { eq, sql } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// ═══════════════════════════════════════════════════════════════════════════
// THE ENGINE-DRIVEN FIXTURE GENERATOR — STAGING-PARITY Slice B
//
// ADR-0036 (Vitest-context operational runners) + ADR-0035 (the reset that
// precedes it) + docs/polish/POLISH-0_data-manifest.md §1–§2 + the plan's S6
// DAG. READ THOSE BEFORE CHANGING ANYTHING HERE.
//
// THIS IS NOT A TEST. It is an operational artifact that borrows the Vitest
// harness for module resolution (ADR-0036 primitive 1). It WRITES to whichever
// database `ZUGZWANG_STAGING_TARGET` resolves — local Postgres for proving,
// the live staging database for real.
//
// ── THE ONE RULE THIS FILE EXISTS TO HONOUR ─────────────────────────────────
// EVERY ROW IS PRODUCED BY DRIVING THE REAL ENGINE (manifest §1.1). Staging
// carried 37 of 39 `bets` rows with no corresponding event because fixture
// scripts bypassed the engine and wrote both halves themselves. A second
// event-writing implementation is a divergent source of truth, and it makes
// gate 1 vacuous: if the generator writes a `bets` row AND its `bet.placed`
// event, gate 1 passes BECAUSE the generator wrote both halves.
//
// So this file calls `createOAuthUser`, `acceptTosAction`, `createMarket`,
// `openMarket`, `place`, `closeMarket`, `triggerResolution`, `settleMarket`
// and `voidMarket` — unmodified — and writes NOTHING itself. That is enforced
// three ways, not promised:
//
//   STRUCTURAL   — `_lib/client.ts` hands out no write-capable handle. There is
//                  no raw `postgres` client here, so `INSERT INTO` has nothing
//                  to travel on, and `readOnly` exposes `select` alone.
//   BEHAVIOURAL  — every write the run issues is attributed to its immediate
//                  caller by `_lib/write-guard.ts`, and a write originating in
//                  `tests/` THROWS at the moment it is attempted. Asserted
//                  again at the end of the run over the actual write log.
//   SOURCE MATCH — tests/unit/staging/generator-no-direct-writes.test.ts, the
//                  cheap tripwire, with manifest §5's four controls.
//
// ── THE MOCKING BOUNDARY (ADR-0036 primitive 3) ─────────────────────────────
// MAY be mocked: next/headers · next/navigation · next/cache ·
//                verifyOnboardingRef · requireAdminSession · getSession.
// MUST NEVER be mocked: anything that writes a row or moves Dharma.
//
// Everything below the shell runs unmodified. In particular the identity-pool
// consume, the pseudonym assignment, the five-column ToS evidence write,
// `grantInitialDharma`, the daily-credit accrual, the CPMM math, every event
// insert and every `dharma_ledger` append are the shipped code.
//
// Invocation:  pnpm staging:generate                    (staging)
//              ZUGZWANG_STAGING_TARGET=local vitest run --config vitest.staging.config.ts \
//                tests/staging/generate.staging.test.ts (local proving)
// ═══════════════════════════════════════════════════════════════════════════

// ── SHELL MOCKS ─────────────────────────────────────────────────────────────
// `@sentry/nextjs` is stubbed for the same reason every other suite stubs it:
// it is telemetry, it is not a writer, and a real client would post fixture
// noise to the project's issue stream. It is not on ADR-0036 primitive 3's
// MAY-be-mocked list, but it does not write a row or move Dharma, so the
// MUST-NEVER rule is not touched.
//
// ⚠ THE STUB IS ASSERTED, NOT JUST INSTALLED (@code-reviewer, Slice B).
// Stubbing Sentry to bare `vi.fn()`s makes the engine's FAIL-OPEN channels dark
// for the whole run: `insertEvent` continues past an ON-CONFLICT payload
// divergence via `safeCaptureException("event_id_reuse_payload_mismatch")`, and
// `runBetTransaction` reports retry exhaustion through `captureMessage`. A
// generation that silently tripped either would look perfectly green. The
// post-run assertion below reads these back and fails if anything was captured,
// which turns the mock from silence into evidence.
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
	cookies: () => ({
		get: mockCookiesGet,
		set: vi.fn(),
		delete: vi.fn(),
	}),
	headers: () => ({ get: mockHeadersGet }),
}));

vi.mock("next/navigation", () => ({
	redirect: vi.fn(),
	notFound: vi.fn(),
}));

vi.mock("next/cache", () => ({
	revalidatePath: vi.fn(),
	revalidateTag: vi.fn(),
}));

// THE LOAD-BEARING MOCK. `@/db` is replaced by the WRITE-GUARDED client, so
// every engine write is attributed. It is not a bypass — it is the same drizzle
// client behind a proxy that refuses a write whose immediate caller is this
// file.
vi.mock("@/db", async () => {
	const { guardedDb } = await import("./_lib/client");
	return { db: guardedDb };
});
vi.mock("@/db/index", async () => {
	const { guardedDb } = await import("./_lib/client");
	return { db: guardedDb };
});

import {
	bets,
	comments,
	dharmaLedger,
	identityPool,
	markets,
	users,
} from "@/db/schema";
import { canonicalizeAmount18 } from "@/server/admin/wire";
import { auth } from "@/server/auth/index";
import { acceptTosAction } from "@/server/auth/tos-accept";
import { assertStakeFloor } from "@/server/bets/floors";
import { place } from "@/server/bets/place";
import { runBetTransaction } from "@/server/bets/transaction";
import { closeMarket } from "@/server/markets/close";
import { createMarket } from "@/server/markets/create";
import { openMarket } from "@/server/markets/open";
import { settleMarket } from "@/server/resolution/settle";
import { triggerResolution } from "@/server/resolution/trigger";
import { voidMarket } from "@/server/resolution/void";

import { loadCapturedIdentities } from "./_lib/captured-identities";
import {
	assertRunnerLiveConnection,
	closeRunnerConnection,
	describeRunnerTarget,
	forbiddenTableWrites,
	RUNNER_MODE,
	readOnly,
	writeLog,
} from "./_lib/client";
import { resolveRunnerTarget } from "./_lib/target";
import { DirectWriteForbiddenError } from "./_lib/write-guard";
import {
	MARKETS,
	type MarketKey,
	PARTICIPANTS,
	type ParticipantRole,
	POSTS,
	RESOLVE_REASON,
	SYNTHETIC_TOS_IP,
	SYNTHETIC_TOS_USER_AGENT,
	syntheticEmail,
	VOID_REASON,
} from "./fixtures";

// ── THE TARGET GUARD, AT MODULE SCOPE, AHEAD OF EVERY it() ──────────────────
//
// `_lib/client.ts` already resolves the same predicate at ITS module scope, and
// because ESM hoists imports that resolution is the one that actually runs
// first — it throws before a client exists, which is the fail-closed guarantee.
//
// This call is therefore deliberately redundant, and it is here for two
// reasons. The refusal belongs where an operator reads it: a runner that can
// write to a live database should say so in its own file, not delegate the
// decision to a helper. And Slice A's `runner-gating.test.ts` asserts the
// property structurally for EVERY present and future runner — it is the control
// that would notice if a later edit moved the guard behind an `it()`.
//
// The predicate is PURE and both call sites pass the same env and options, so
// two evaluations cannot disagree.
const runnerTarget = resolveRunnerTarget(process.env, {
	requireWriteIntent: true,
});
if (!runnerTarget.ok) {
	throw new Error(
		`REFUSED — the staging generator target guard did not pass.\n  ${runnerTarget.reason}\n\n` +
			"Run it as: pnpm staging:generate",
	);
}

/** Resolved participant ids, keyed by role. Populated by the generation step. */
const participantIds = new Map<ParticipantRole, string>();
/** Resolved market ids, keyed by fixture key. */
const marketIds = new Map<MarketKey, string>();

/** The §3.7 metadata block for an admin lifecycle / resolution flow. */
function adminMetadata(flowId: string) {
	return {
		request_id: "staging-parity-generate",
		flow_id: flowId,
		user_id: null,
		actor_id: "admin-singleton",
		idempotency_key: null,
		ip: SYNTHETIC_TOS_IP,
		user_agent: SYNTHETIC_TOS_USER_AGENT,
	};
}

/** The §3.7 metadata block for a participant bet. */
function betMetadata(userId: string) {
	return {
		request_id: "staging-parity-generate",
		flow_id: "F-BET-1",
		user_id: userId,
		actor_id: userId,
		idempotency_key: null,
		ip: SYNTHETIC_TOS_IP,
		user_agent: SYNTHETIC_TOS_USER_AGENT,
	};
}

function requireParticipant(role: ParticipantRole): string {
	const id = participantIds.get(role);
	if (!id) throw new Error(`participant ${role} was not created`);
	return id;
}

function requireMarket(key: MarketKey): string {
	const id = marketIds.get(key);
	if (!id) throw new Error(`market ${key} was not created`);
	return id;
}

/**
 * Create ONE participant, exactly as the plan's Q2 specifies: two engine calls,
 * both with committed precedent in-tree.
 *
 * Step 1 is Better Auth's real OAuth create-path — the same entry
 * `oauth2/link-account.mjs` uses. It runs `createWithHooks` →
 * `databaseHooks.user.create.before` → the REAL `consumeIdentityPoolTuple`
 * (ADR-0011) → the real INSERT. No pseudonym is hand-written.
 *
 * Step 2 is the real `acceptTosAction`, with only the signed-cookie shell
 * mocked. Its transaction body — the five-column ToS evidence UPDATE,
 * `grantInitialDharma`, and the `user.tos_accepted` event — runs untouched.
 */
async function createParticipant(args: {
	email: string;
	providerId: string;
	accountId: string;
	displayName: string;
}): Promise<string> {
	const ctx = await auth.$context;
	// The payload is the already-mapped Google profile exactly as
	// `mapProfileToUser` returns it. `googleId` is a `user.additionalFields`
	// column, not part of Better Auth's 6-field core user model, so it is bound
	// through a named const — the committed signup-create-path test's shape —
	// rather than an inline literal, whose excess-property check would reject it.
	const userPayload = {
		email: args.email,
		name: args.displayName,
		image: null,
		emailVerified: true,
		googleId: args.accountId,
	};
	const created = await ctx.internalAdapter.createOAuthUser(userPayload, {
		providerId: args.providerId,
		accountId: args.accountId,
		accessToken: "staging-fixture-access-token",
		refreshToken: "staging-fixture-refresh-token",
		idToken: "staging-fixture-id-token",
		scope: "openid email profile",
		accessTokenExpiresAt: null,
		refreshTokenExpiresAt: null,
	});
	const userId = (created as { user?: { id?: string } } | null)?.user?.id;
	if (!userId) {
		throw new Error(`createOAuthUser returned no user for ${args.displayName}`);
	}

	// ⚠ manifest §1.7 (B5) — fixed, obviously-synthetic literals. These land in
	// a database published on 2026-11-06; a plausible IP is indistinguishable
	// from a real one after the fact, so the value is not an address at all.
	mockCookiesGet.mockImplementation((name: string) =>
		name === "onboarding_ref"
			? { name: "onboarding_ref", value: "staging-fixture-onboarding-ref" }
			: undefined,
	);
	mockHeadersGet.mockImplementation((header: string) => {
		if (header === "x-forwarded-for") return SYNTHETIC_TOS_IP;
		if (header === "user-agent") return SYNTHETIC_TOS_USER_AGENT;
		return null;
	});
	mockVerifyOnboardingRef.mockReturnValue({ userId });

	const formData = new FormData();
	formData.set("accepted", "true");
	await acceptTosAction(formData);

	return userId;
}

/** One comment-bearing bet through the real W-1 spine. */
async function placePost(args: {
	userId: string;
	marketId: string;
	side: "YES" | "NO";
	stake: string;
	body: string;
}): Promise<void> {
	// The two-floor validator is a SHELL layer (it lives in the endpoint), so
	// the generator calls it explicitly rather than letting a fixture stake
	// drift below the shipped floor unnoticed. It writes nothing.
	assertStakeFloor({ parentCommentId: null, stake: args.stake });
	await runBetTransaction({ marketId: args.marketId, flow: "F-BET-1" }, (ctx) =>
		place(ctx, {
			userId: args.userId,
			marketId: args.marketId,
			side: args.side,
			stake: args.stake,
			body: args.body,
			parentCommentId: null,
			idempotencyKey: uuidv7(),
			bodyFingerprint: uuidv7(),
			betEventId: uuidv7(),
			commentEventId: uuidv7(),
			creditEventId: uuidv7(),
			metadata: betMetadata(args.userId),
		}),
	);
}

let generationError: unknown = null;

beforeAll(async () => {
	// G-3 — the LIVE SOCKET, before anything else. A config can say staging
	// while the connection says otherwise, and this runner writes ~440 rows.
	// Throwing here fails every test in the suite WITHOUT executing any of them.
	await assertRunnerLiveConnection();

	// Pre-flight. Surface a blocked run BEFORE writing half a fixture set.
	const [poolRow] = await readOnly
		.select({
			free: sql<number>`count(*) FILTER (WHERE ${identityPool.assignedAt} IS NULL)::int`,
		})
		.from(identityPool);
	const free = poolRow?.free ?? 0;
	if (free < PARTICIPANTS.length) {
		throw new Error(
			`REFUSED — identity_pool has ${free} unassigned tuples, need ${PARTICIPANTS.length}. ` +
				"Re-seed it: doppler run --project zugzwang-experiment --config stg -- pnpm db:seed:staging",
		);
	}

	// The captured identities are loaded here rather than mid-run: a missing
	// capture must refuse BEFORE any row is written, because generating with a
	// fabricated Google sub breaks the operator's next sign-in unrecoverably.
	const captured = loadCapturedIdentities();
	const needed = PARTICIPANTS.filter(
		(p) => p.capturedIdentityIndex !== null,
	).length;
	if (captured.length < needed) {
		throw new Error(
			`REFUSED — ${captured.length} captured Google identities available, ${needed} roles require one.`,
		);
	}

	console.log(
		`[staging:generate] target ${describeRunnerTarget()} · identity_pool free=${free} · captured identities=${captured.length}`,
	);
});

afterAll(async () => {
	await closeRunnerConnection();
});

describe("staging fixture generation", () => {
	it("drives the real engine through the S6 DAG", async () => {
		try {
			const captured = loadCapturedIdentities();
			const now = new Date();

			// ── 2 · PARTICIPANTS ×10 ────────────────────────────────────────
			// Creation order fixes pseudonym assignment (FIFO pool consume), so
			// /u/<pseudonym> is stable across rebuilds.
			for (const p of PARTICIPANTS) {
				const identity =
					p.capturedIdentityIndex === null
						? null
						: captured[p.capturedIdentityIndex];
				const userId = await createParticipant({
					email: identity?.email ?? syntheticEmail(p.syntheticEmailLocal),
					providerId: identity?.providerId ?? "google",
					// A synthetic participant still needs a stable, unique Google
					// `sub`. It is derived from the ROLE, not minted randomly, so a
					// rebuild produces the same accounts row shape.
					accountId:
						identity?.accountId ??
						`staging-fixture-sub-${p.syntheticEmailLocal}`,
					displayName: p.displayName,
				});
				participantIds.set(p.role, userId);
			}

			// ── 3 · MARKETS ×15 (Draft) ─────────────────────────────────────
			for (const m of MARKETS) {
				const marketId = uuidv7();
				const mediaId = uuidv7();
				await createMarket({
					marketId,
					slug: m.slug,
					title: m.title,
					description: m.description,
					resolutionDeadline: new Date(now.getTime() + m.deadlineOffsetMs),
					// MEDIA.1 §15: a market REQUIRES >= 1 image with exactly one
					// default, and the key must be the server-minted
					// `m/<marketId>/<mediaId>.<ext>` shape. `createMarket` validates
					// the SHAPE; it never HeadObjects R2. So this row is shape-valid
					// and points at an object that does not exist yet — recorded as a
					// Class-1 decision, and the R2 half is Slice C's (see STEP 8b).
					media: [
						{
							mediaId,
							key: `m/${marketId}/${mediaId}.png`,
							displayOrder: 0,
							isDefault: true,
						},
					],
					mediaVideoUrl: null,
					now,
					metadata: adminMetadata("F-ADMIN-1"),
				});
				marketIds.set(m.key, marketId);
			}

			// ── 4 · POOLS — openMarket ×14 (M1 stays Draft) ─────────────────
			// `canonicalizeAmount18` is the REAL wire helper. Q1: "the generator
			// must canonicalize seedAmount itself since that step lived in the
			// wire" — so it calls the shipped function rather than restating it.
			for (const m of MARKETS) {
				if (!m.open) continue;
				await openMarket({
					marketId: requireMarket(m.key),
					seedAmount: canonicalizeAmount18(m.seedAmount),
					now,
					metadata: adminMetadata("F-ADMIN-2"),
				});
			}

			// ── 5 · POSTS — one per open market except M4 ───────────────────
			// Order is the fixture table's order and it is load-bearing: see the
			// POSTS docblock (the daily-credit window, and Q4's YES-on-M2 rule).
			for (const post of POSTS) {
				await placePost({
					userId: requireParticipant(post.author),
					marketId: requireMarket(post.market),
					side: post.side,
					stake: post.stake,
					body: post.body,
				});
			}

			// ── 12 · LIFECYCLE TERMINALS ────────────────────────────────────
			// Folded into Slice B deliberately. Without them gate 1's G1.5 —
			// every Resolved or Voided market carries >= 1 resolution_events row
			// — passes VACUOUSLY, which is the exact failure shape this task
			// exists to remove. Each terminal market carries the one bet placed
			// above, so its settlement is non-vacuous.
			//
			// `closeMarket` refuses until the deadline is reached, and `now` is an
			// ARGUMENT to it by design (D-14.e). The terminal markets carry a
			// one-minute deadline, so the close instant below is past it. No
			// stored timestamp is affected: every `created_at` derives from a
			// freshly minted UUIDv7.
			// One millisecond past the latest deadline among the markets that
			// close, so every one of them is legally closable — derived from the
			// fixture table rather than hard-coded beside it.
			const latestClosingDeadline = Math.max(
				...MARKETS.filter(
					(m) => m.terminal !== "none" && m.terminal !== "void",
				).map((m) => m.deadlineOffsetMs),
			);
			const closeAt = new Date(now.getTime() + latestClosingDeadline + 1);

			for (const m of MARKETS) {
				if (m.terminal === "none" || m.terminal === "void") continue;
				await closeMarket({
					marketId: requireMarket(m.key),
					now: closeAt,
					metadata: adminMetadata("W-4-CLOSE"),
				});
			}

			for (const m of MARKETS) {
				if (m.terminal !== "resolving" && m.terminal !== "resolve-yes") {
					continue;
				}
				await triggerResolution({
					marketId: requireMarket(m.key),
					triggerEventId: uuidv7(),
					metadata: adminMetadata("F-ADMIN-3"),
				});
			}

			for (const m of MARKETS) {
				if (m.terminal !== "resolve-yes") continue;
				await settleMarket({
					marketId: requireMarket(m.key),
					winningSide: "YES",
					reason: RESOLVE_REASON,
					settleEventId: uuidv7(),
					metadata: adminMetadata("F-RESOLVE-1"),
				});
			}

			for (const m of MARKETS) {
				if (m.terminal !== "void") continue;
				await voidMarket({
					marketId: requireMarket(m.key),
					reason: VOID_REASON,
					voidEventId: uuidv7(),
					metadata: adminMetadata("F-RESOLVE-3"),
				});
			}
		} catch (err) {
			generationError = err;
			throw err;
		}
	}, 600_000);

	// ── STEP 4 · THE NO-DIRECT-WRITES ASSERTION, over the ACTUAL run ─────────
	it("wrote every row through the engine — no write originated in tests/", () => {
		expect(generationError).toBeNull();
		const log = writeLog();
		// A non-empty log assertion, for the same reason the source tripwire has
		// one: a loop over an empty array asserts nothing, and a generator that
		// silently wrote no rows would satisfy "no forbidden writes" perfectly.
		expect(log.length).toBeGreaterThan(0);
		const offenders = log.filter((w) =>
			w.caller.replace(/\\/g, "/").includes("/tests/"),
		);
		expect(offenders).toEqual([]);
		// The primitive-4 tables specifically: every one of these was written,
		// and every one by the engine.
		const forbidden = forbiddenTableWrites();
		expect(forbidden.length).toBeGreaterThan(0);
		expect(
			forbidden.filter((w) => w.caller.replace(/\\/g, "/").includes("/tests/")),
		).toEqual([]);
	});

	it("tripped no Sentry fail-open during generation", async () => {
		// The engine's fail-open paths report through Sentry and then CONTINUE, so
		// a stubbed client that nobody reads back is a blind spot for the entire
		// run rather than mere noise suppression.
		const Sentry = await import("@sentry/nextjs");
		const captured = [
			...vi.mocked(Sentry.captureException).mock.calls.map((c) => String(c[0])),
			...vi.mocked(Sentry.captureMessage).mock.calls.map((c) => String(c[0])),
		];
		expect(captured).toEqual([]);
	});

	// THE POSITIVE CONTROL FOR THE ASSERTION ABOVE lives in
	// tests/unit/staging/write-guard.test.ts, not here. It was here first, and
	// the source tripwire flagged it on the very first run — correctly. The
	// control has to attempt a real direct write to prove the guard fires, and
	// an attempted direct write is textually indistinguishable from the defect.
	// That collision is manifest §5's "a source match false-alarms on correct
	// code", encountered live. Moving the control to a unit test resolves it
	// without an exemption, which would have blunted the tripwire for every
	// future file. The unit test needs no database and covers more.

	// ── STEP 2c · PARTICIPANT VERIFICATION ──────────────────────────────────
	it("created 10 participants, each pool-named, ToS-accepted, granted, unbanned", async () => {
		const rows = await readOnly
			.select({
				id: users.id,
				pseudonym: users.pseudonym,
				pfpFilename: users.pfpFilename,
				tosAcceptedAt: users.tosAcceptedAt,
				bannedAt: users.bannedAt,
				tosIp: users.tosAcceptanceIp,
				tosUa: users.tosAcceptanceUserAgent,
			})
			.from(users);

		expect(rows.length).toBe(PARTICIPANTS.length);
		for (const row of rows) {
			expect({
				id: row.id,
				pseudonym: (row.pseudonym ?? "").length > 0,
				pfp: (row.pfpFilename ?? "").length > 0,
				tos: row.tosAcceptedAt !== null,
				banned: row.bannedAt,
				ip: row.tosIp,
				ua: row.tosUa,
			}).toEqual({
				id: row.id,
				pseudonym: true,
				pfp: true,
				tos: true,
				banned: null,
				// manifest §1.7 (B5) — asserted, not merely intended.
				ip: SYNTHETIC_TOS_IP,
				ua: SYNTHETIC_TOS_USER_AGENT,
			});
		}

		// Pseudonyms are pool-allocated and therefore unique.
		expect(new Set(rows.map((r) => r.pseudonym)).size).toBe(rows.length);

		// Exactly one initial_grant per participant.
		const grants = await readOnly
			.select({ userId: dharmaLedger.userId })
			.from(dharmaLedger)
			.where(eq(dharmaLedger.entryType, "initial_grant"));
		expect(grants.length).toBe(PARTICIPANTS.length);
		expect(new Set(grants.map((g) => g.userId)).size).toBe(PARTICIPANTS.length);

		// The pool actually gave up exactly that many tuples.
		const [assigned] = await readOnly
			.select({ n: sql<number>`count(*)::int` })
			.from(identityPool)
			.where(sql`${identityPool.assignedAt} IS NOT NULL`);
		expect(assigned?.n).toBe(PARTICIPANTS.length);
	});

	it("leaves P-empty at exactly 1000 — it never bets, so it never accrues", async () => {
		const emptyId = requireParticipant("P-empty");
		const rows = await readOnly
			.select({
				amount: dharmaLedger.amount,
				entryType: dharmaLedger.entryType,
			})
			.from(dharmaLedger)
			.where(eq(dharmaLedger.userId, emptyId));
		// Manifest §0 B7: `accrueDailyCredit` fires INSIDE `place()`, so a role
		// defined by never betting never accrues. One grant row, nothing else.
		expect(rows.map((r) => r.entryType)).toEqual(["initial_grant"]);
		expect(rows[0]?.amount).toBe("1000.000000000000000000");
	});

	// ── STEP 3 · MARKET + LIFECYCLE VERIFICATION ────────────────────────────
	it("created 15 markets and drove each to its fixture-table state", async () => {
		const rows = await readOnly
			.select({ slug: markets.slug, status: markets.status })
			.from(markets);
		expect(rows.length).toBe(MARKETS.length);

		const bySlug = new Map(rows.map((r) => [r.slug, r.status]));
		const expectedStatus: Record<string, string> = {
			none: "Open",
			close: "Closed",
			resolving: "Resolving",
			"resolve-yes": "Resolved",
			void: "Voided",
		};
		for (const m of MARKETS) {
			const want = m.open ? expectedStatus[m.terminal] : "Draft";
			expect({ slug: m.slug, status: bySlug.get(m.slug) }).toEqual({
				slug: m.slug,
				status: want,
			});
		}
		// Discovery needs DISCOVERY_GRID_SIZE + 1 = 9 Open markets.
		expect(
			rows.filter((r) => r.status === "Open").length,
		).toBeGreaterThanOrEqual(9);
	});

	it("placed one post per open market except M4, each riding a real bet", async () => {
		const betRows = await readOnly
			.select({ id: bets.id, commentId: bets.commentId })
			.from(bets);
		expect(betRows.length).toBe(POSTS.length);
		// INV-1's built half: no bet without its comment.
		expect(betRows.filter((b) => b.commentId === null)).toEqual([]);

		const commentRows = await readOnly
			.select({ id: comments.id })
			.from(comments);
		expect(commentRows.length).toBe(POSTS.length);

		// M4 carries no post, by manifest design — assert the exception rather
		// than leaving it implicit.
		const m4 = requireMarket("M4");
		const m4Bets = await readOnly
			.select({ id: bets.id })
			.from(bets)
			.where(eq(bets.marketId, m4));
		expect(m4Bets).toEqual([]);
	});

	it("reports what it produced", async () => {
		const [counts] = await readOnly
			.select({
				users: sql<number>`(SELECT count(*) FROM users)::int`,
				markets: sql<number>`(SELECT count(*) FROM markets)::int`,
				pools: sql<number>`(SELECT count(*) FROM pools)::int`,
				bets: sql<number>`(SELECT count(*) FROM bets)::int`,
				comments: sql<number>`(SELECT count(*) FROM comments)::int`,
				positions: sql<number>`(SELECT count(*) FROM positions)::int`,
				events: sql<number>`(SELECT count(*) FROM events)::int`,
				ledger: sql<number>`(SELECT count(*) FROM dharma_ledger)::int`,
				resolution_events: sql<number>`(SELECT count(*) FROM resolution_events)::int`,
				payout_events: sql<number>`(SELECT count(*) FROM payout_events)::int`,
				bet_receipts: sql<number>`(SELECT count(*) FROM bet_receipts)::int`,
			})
			.from(sql`(SELECT 1) AS one`);
		console.log(
			`[staging:generate] ${RUNNER_MODE} · ${JSON.stringify(counts)} · engine writes=${writeLog().length}`,
		);
		expect(counts?.events).toBeGreaterThan(0);
	});
});
