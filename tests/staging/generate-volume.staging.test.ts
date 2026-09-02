import { eq, like, sql } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// ═══════════════════════════════════════════════════════════════════════════
// THE VOLUME-FIXTURE GENERATOR — Day-1 pack C1 STEP 2 / Load Programme §6
//
// ADR-0036 (Vitest-context operational runners) governs this file exactly as
// it governs `generate.staging.test.ts` — read that ADR, and read this file's
// sibling before changing anything here. THIS IS NOT A TEST; it borrows the
// Vitest harness for module resolution and writes to whichever database
// `ZUGZWANG_STAGING_TARGET` resolves.
//
// ── WHY THIS IS A SEPARATE FILE, NOT AN EXTENSION OF THE EXISTING GENERATOR ──
// `generate.staging.test.ts` builds the STAGING-PARITY fixed-role fixture set
// (10 named participants, 15 markets, captured-Google-identity requirement for
// 3 of those roles). That shape has nothing to do with C1's actual deliverable:
// a handful of markets whose COMMENT COUNT spans a range (so cost-vs-volume can
// be measured), with one designated write-heavy "hot" market. Conflating the
// two — which is what broke real staging on 2026-09-01 — means either
// generator inherits requirements that don't belong to it. This file has NO
// captured-identity requirement at all: every participant here is ordinary
// synthetic signups, same shape as the STAGING-PARITY generator's seven
// non-captured roles.
//
// ── ADD-ONLY, BY DESIGN AND BY CHECK, NOT BY PROMISE ─────────────────────────
// This generator NEVER resets, truncates, deletes, or updates a pre-existing
// row. It is also idempotent under re-run: before creating a volume market it
// checks (read-only) whether a market with that slug already exists and reuses
// it rather than erroring or duplicating; before placing comments on a market
// it counts what's already there and places only the shortfall; before
// creating volume participants it checks for existing ones by email prefix and
// reuses them. A second run against a stack that already has the full volume
// fixture is a correct no-op, not a duplicate.
//
// The three ADR-0036 primitive-4 enforcements are inherited unchanged from
// `_lib/client.ts`, imported below exactly as the sibling generator imports it:
// STRUCTURAL (`guardedDb`/`readOnly` have no raw write handle), BEHAVIOURAL
// (every write is attributed; a write whose immediate caller is `tests/`
// throws), SOURCE MATCH (the same tripwire test covers this file too, since it
// scans every file under `tests/staging/`).
//
// ── WHAT THIS FILE DOES NOT DO ────────────────────────────────────────────────
// No sells, no moderation, no resolution, no image uploads. Strictly additive:
// signups, market create + open, posts and replies through the real W-1 spine.
// Smaller blast radius than the sibling generator by construction.
//
// Invocation:  pnpm staging:generate-volume              (staging)
//              ZUGZWANG_STAGING_TARGET=local vitest run --config vitest.staging.config.ts \
//                tests/staging/generate-volume.staging.test.ts (local proving)
// ═══════════════════════════════════════════════════════════════════════════

// ── AN ADDITIONAL, DISTINCT AUTHORIZATION GATE ───────────────────────────────
// `_lib/client.ts` already refuses at module scope unless
// `ZUGZWANG_STAGING_WRITE_ACK=generate-staging-fixtures` (the shared generator
// intent token) — that check fires first, unconditionally, before any code in
// this file runs. This file adds a SECOND, script-specific token on top of it,
// because the operator asked for a fresh, deliberate confirmation for THIS
// operation specifically, distinct from whatever muscle memory
// `pnpm staging:generate` already carries. Both must be set; neither implies
// the other.
const VOLUME_INTENT_ENV = "ZUGZWANG_STAGING_VOLUME_WRITE_ACK";
const VOLUME_INTENT_VALUE = "generate-staging-volume-fixture";

// ── SHELL MOCKS ─────────────────────────────────────────────────────────────
// Identical boundary to the sibling generator (ADR-0036 primitive 3's
// MAY-be-mocked list) — see that file's docblock for the full reasoning. Not
// duplicated here beyond what's load-bearing.
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
	updateTag: vi.fn(),
}));

vi.mock("@/db", async () => {
	const { guardedDb } = await import("./_lib/client");
	return { db: guardedDb };
});
vi.mock("@/db/index", async () => {
	const { guardedDb } = await import("./_lib/client");
	return { db: guardedDb };
});

import { comments, identityPool, markets, users } from "@/db/schema";
import { canonicalizeAmount18 } from "@/server/admin/wire";
import { auth } from "@/server/auth/index";
import { acceptTosAction } from "@/server/auth/tos-accept";
import { assertStakeFloor } from "@/server/bets/floors";
import { place } from "@/server/bets/place";
import { runBetTransaction } from "@/server/bets/transaction";
import { createMarket } from "@/server/markets/create";
import { openMarket } from "@/server/markets/open";

import {
	assertRunnerLiveConnection,
	closeRunnerConnection,
	describeRunnerTarget,
	readOnly,
} from "./_lib/client";
import { resolveRunnerTarget } from "./_lib/target";
import { SYNTHETIC_TOS_IP, SYNTHETIC_TOS_USER_AGENT } from "./fixtures";

// ── THE TARGET GUARD, AT MODULE SCOPE, AHEAD OF EVERY it() ──────────────────
// Deliberately redundant with `_lib/client.ts`'s own check — see the sibling
// generator's identical block for why: the refusal belongs in the file an
// operator is looking at, and `runner-gating.test.ts` asserts this structurally
// for every runner, present and future.
const runnerTarget = resolveRunnerTarget(process.env, {
	requireWriteIntent: true,
});
if (!runnerTarget.ok) {
	throw new Error(
		`REFUSED — the volume-fixture generator's target guard did not pass.\n  ${runnerTarget.reason}\n\n` +
			"Run it as: pnpm staging:generate-volume",
	);
}

// ═══════════════════════════════════════════════════════════════════════════
// THE VOLUME FIXTURE TABLE — Load Programme Status doc §6, literal, no RNG.
//
// Unlike the sibling generator's PER-COMMENT literal table (tractable at ~50
// total comments across 15 markets), this generator needs up to ~1,600 new
// comments — hand-tabulating each one is not "determinism", it is unreadable.
// "NO RNG ANYWHERE" is preserved a different way here: every comment's body,
// side, stake and reply target are pure functions of its INDEX, computed by a
// loop with no `Math.random` and no clock read anywhere in the generation
// logic — the same run against the same starting DB state produces the exact
// same sequence of writes every time. This is a deliberate deviation from the
// sibling file's convention and is flagged as such rather than silently
// diverging from it.
// ═══════════════════════════════════════════════════════════════════════════

const LONG_DEADLINE_MS = 60 * 24 * 60 * 60 * 1000; // 60 days, matches the sibling fixture table

type VolumeMarket = {
	readonly key: "M-VOL-A" | "M-VOL-B" | "M-VOL-D" | "M-VOL-C-HOT";
	readonly slug: string;
	readonly title: string;
	readonly description: string;
	readonly seedAmount: string;
	/** The comment-count TARGET this market should reach. Idempotent: the
	 * generator places only the shortfall between the current count and this
	 * number, never more, never fewer on a rerun. */
	readonly targetComments: number;
	readonly hot: boolean;
};

/**
 * Four markets, spanning the range the Load Programme doc's §6 specifies.
 * M-D is 1,000 rather than the upper end of the pack's 1,000–3,000 range —
 * the pack's own §5 risk table explicitly sanctions this reduction under time
 * pressure ("reduce the range's top value — never its existence").
 *
 * ⚠ P-8 discipline, same as the sibling fixture table: every title and
 * description below announces itself as a fixture. Nothing here is real
 * market content.
 */
const VOLUME_MARKETS: readonly VolumeMarket[] = [
	{
		key: "M-VOL-A",
		slug: "volume-fixture-a-low",
		title: "Volume fixture A — placeholder low-comment-count question",
		description:
			"PLACEHOLDER resolution criterion for the S-5 volume-fixture generator's low end. Not real market content.",
		seedAmount: "100",
		targetComments: 10,
		hot: false,
	},
	{
		key: "M-VOL-B",
		slug: "volume-fixture-b-mid",
		title: "Volume fixture B — placeholder mid-comment-count question",
		description:
			"PLACEHOLDER resolution criterion for the S-5 volume-fixture generator's midpoint. Not real market content.",
		seedAmount: "500",
		targetComments: 300,
		hot: false,
	},
	{
		key: "M-VOL-D",
		slug: "volume-fixture-d-high",
		title: "Volume fixture D — placeholder high-comment-count question",
		description:
			"PLACEHOLDER resolution criterion for the S-5 volume-fixture generator's high end (reduced from the pack's 3,000 top value under time pressure — range preserved, not the top value). Not real market content.",
		seedAmount: "1000",
		targetComments: 1000,
		hot: false,
	},
	{
		key: "M-VOL-C-HOT",
		slug: "volume-fixture-c-hot",
		title: "Volume fixture C (HOT) — placeholder write-target question",
		description:
			"PLACEHOLDER resolution criterion. Same comment count as fixture B by design — this is the market the load run's writer arm targets, so B-vs-C is the cost-against-write-rate comparison at identical comment count. Not real market content.",
		seedAmount: "500",
		targetComments: 300,
		hot: true,
	},
];

/** How many distinct synthetic participants to provision. 1,610 target
 * comments across ~300 participants is ~5.4 comments/participant on average
 * — kept deliberately low so per-participant Dharma balance sufficiency does
 * not depend on precisely knowing the initial-grant amount (not traced in
 * this pass; flagged as a dry-run verification item, not asserted here). */
const VOLUME_PARTICIPANT_COUNT = 300;
const EMAIL_PREFIX = "volume-fixture-";
const EMAIL_DOMAIN = "example.com"; // RFC 2606, same convention as fixtures.ts

/** Literal, cycled — never random. Both comfortably above their floor
 * (BET_MIN_STAKE_POST="10", BET_MIN_STAKE_REPLY="50"). */
const POST_STAKES = ["12", "15", "20", "18", "25"] as const;
const REPLY_STAKES = ["55", "60", "75", "65", "80"] as const;

function bodyFor(marketKey: string, index: number, isReply: boolean): string {
	const kind = isReply ? "reply" : "post";
	return `Volume fixture ${kind} #${index} on ${marketKey} — placeholder argument generated by the S-5 volume-fixture generator, not real content (P-8).`;
}

const adminMetadata = (flowId: string) => ({
	request_id: "s5-volume-fixture-generate",
	flow_id: flowId,
	user_id: null,
	actor_id: "admin-singleton",
	idempotency_key: null,
	ip: SYNTHETIC_TOS_IP,
	user_agent: SYNTHETIC_TOS_USER_AGENT,
});

const betMetadata = (userId: string, flowId: string) => ({
	request_id: "s5-volume-fixture-generate",
	flow_id: flowId,
	user_id: userId,
	actor_id: userId,
	idempotency_key: null,
	ip: SYNTHETIC_TOS_IP,
	user_agent: SYNTHETIC_TOS_USER_AGENT,
});

/** Same real two-call entry point as the sibling generator: Better Auth's
 * `createOAuthUser` (real `consumeIdentityPoolTuple`, real INSERT), then the
 * real `acceptTosAction` (real ToS evidence write + `grantInitialDharma`). */
async function createVolumeParticipant(index: number): Promise<string> {
	const local = `${EMAIL_PREFIX}${String(index).padStart(4, "0")}`;
	const email = `${local}@${EMAIL_DOMAIN}`;
	const ctx = await auth.$context;
	// Bound through a named const, not an inline literal — `googleId` is a
	// `user.additionalFields` column, not part of Better Auth's 6-field core
	// user model, so an inline literal's excess-property check rejects it
	// (same shape as the sibling generator's `createParticipant`).
	const userPayload = {
		email,
		name: `Volume Fixture Participant ${index}`,
		image: null,
		emailVerified: true,
		googleId: `s5-volume-fixture-sub-${local}`,
	};
	const created = await ctx.internalAdapter.createOAuthUser(userPayload, {
		providerId: "google",
		accountId: `s5-volume-fixture-sub-${local}`,
		accessToken: "s5-volume-fixture-access-token",
		refreshToken: "s5-volume-fixture-refresh-token",
		idToken: "s5-volume-fixture-id-token",
		scope: "openid email profile",
		accessTokenExpiresAt: null,
		refreshTokenExpiresAt: null,
	});
	const userId = (created as { user?: { id?: string } } | null)?.user?.id;
	if (!userId) {
		throw new Error(`createOAuthUser returned no user for ${email}`);
	}

	mockCookiesGet.mockImplementation((name: string) =>
		name === "onboarding_ref"
			? { name: "onboarding_ref", value: "s5-volume-fixture-onboarding-ref" }
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

/** One comment-bearing bet through the real W-1 spine — posts and replies
 * both, identical mechanism to the sibling generator's `placeComment`. */
async function placeVolumeComment(args: {
	userId: string;
	marketId: string;
	side: "YES" | "NO";
	stake: string;
	body: string;
	parentCommentId: string | null;
}): Promise<string> {
	assertStakeFloor({
		parentCommentId: args.parentCommentId,
		stake: args.stake,
	});
	const flow = args.parentCommentId !== null ? "F-COMMENT-2" : "F-BET-1";
	const result = await runBetTransaction(
		{ marketId: args.marketId, flow },
		(ctx) =>
			place(ctx, {
				userId: args.userId,
				marketId: args.marketId,
				side: args.side,
				stake: args.stake,
				body: args.body,
				parentCommentId: args.parentCommentId,
				idempotencyKey: uuidv7(),
				bodyFingerprint: uuidv7(),
				betEventId: uuidv7(),
				commentEventId: uuidv7(),
				creditEventId: uuidv7(),
				image: null,
				metadata: betMetadata(args.userId, flow),
			}),
	);
	return result.commentId;
}

let generationError: unknown = null;

beforeAll(async () => {
	await assertRunnerLiveConnection();

	// The additional, script-specific authorization gate (see the top of this
	// file). Checked here rather than at module scope so the reason is the
	// LAST thing refused on, after the shared generator gate has already
	// passed — a reader sees the shared refusal first if both are unset.
	if (process.env[VOLUME_INTENT_ENV] !== VOLUME_INTENT_VALUE) {
		throw new Error(
			`REFUSED — ${VOLUME_INTENT_ENV} is not set to the acknowledgement value. ` +
				"This run WRITES volume-fixture data (markets, participants, comments, bets). " +
				`Set ${VOLUME_INTENT_ENV}=${VOLUME_INTENT_VALUE} to proceed.`,
		);
	}

	const [poolRow] = await readOnly
		.select({
			free: sql<number>`count(*) FILTER (WHERE ${identityPool.assignedAt} IS NULL)::int`,
		})
		.from(identityPool);
	const free = poolRow?.free ?? 0;
	if (free < VOLUME_PARTICIPANT_COUNT) {
		throw new Error(
			`REFUSED — identity_pool has ${free} unassigned tuples, need ${VOLUME_PARTICIPANT_COUNT}. ` +
				"Re-seed it: doppler run --project zugzwang-experiment --config stg -- pnpm db:seed:staging",
		);
	}

	console.log(
		`[staging:generate-volume] target ${describeRunnerTarget()} · identity_pool free=${free}`,
	);
});

afterAll(async () => {
	await closeRunnerConnection();
});

describe("staging volume-fixture generation (C1 STEP 2)", () => {
	it("is ADD-ONLY: reuses existing volume markets/participants, places only the comment shortfall", async () => {
		try {
			const now = new Date();

			// ── PARTICIPANTS — reuse existing volume-fixture users by email
			// prefix; create only what's missing. ──────────────────────────────
			const existingParticipants = await readOnly
				.select({ id: users.id, email: users.email })
				.from(users)
				.where(like(users.email, `${EMAIL_PREFIX}%@${EMAIL_DOMAIN}`));
			const participantIds: string[] = existingParticipants.map((p) => p.id);

			for (let i = participantIds.length; i < VOLUME_PARTICIPANT_COUNT; i++) {
				participantIds.push(await createVolumeParticipant(i));
			}

			// ── MARKETS — reuse by slug if already present; create + open
			// otherwise. NEVER re-opens or mutates an existing row. ─────────────
			const marketIds = new Map<string, string>();
			for (const m of VOLUME_MARKETS) {
				const [existing] = await readOnly
					.select({ id: markets.id, status: markets.status })
					.from(markets)
					.where(eq(markets.slug, m.slug));

				if (existing) {
					marketIds.set(m.key, existing.id);
					continue;
				}

				const marketId = uuidv7();
				const mediaId = uuidv7();
				await createMarket({
					marketId,
					slug: m.slug,
					title: m.title,
					description: m.description,
					resolutionDeadline: new Date(now.getTime() + LONG_DEADLINE_MS),
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
				await openMarket({
					marketId,
					seedAmount: canonicalizeAmount18(m.seedAmount),
					now,
					metadata: adminMetadata("F-ADMIN-2"),
				});
				marketIds.set(m.key, marketId);
			}

			// ── COMMENTS — idempotent shortfall per market. ─────────────────────
			const produced: Record<string, number> = {};
			for (const m of VOLUME_MARKETS) {
				const marketId = marketIds.get(m.key);
				if (!marketId) throw new Error(`market ${m.key} was not resolved`);

				const [{ n: currentCount }] = await readOnly
					.select({ n: sql<number>`count(*)::int` })
					.from(comments)
					.where(eq(comments.marketId, marketId));

				const shortfall = m.targetComments - currentCount;
				produced[m.key] = 0;
				if (shortfall <= 0) continue;

				// Track post ids placed THIS run so replies (REPLY_DEPTH_MAX=1) can
				// only ever target a post, never another reply.
				const postIds: string[] = [];

				for (let i = 0; i < shortfall; i++) {
					const globalIndex = currentCount + i;
					// Every 3rd comment is a reply to an earlier post on the SAME
					// market, when one exists yet; otherwise it's a post. Pure
					// function of the index — no RNG, no clock read.
					const isReply = globalIndex % 3 === 2 && postIds.length > 0;
					const participant =
						participantIds[globalIndex % participantIds.length];
					if (!participant) {
						throw new Error("participant pool exhausted unexpectedly");
					}
					const side: "YES" | "NO" = globalIndex % 2 === 0 ? "YES" : "NO";

					if (isReply) {
						const parentCommentId =
							postIds[globalIndex % postIds.length] ?? null;
						const stake =
							REPLY_STAKES[globalIndex % REPLY_STAKES.length] ?? "55";
						await placeVolumeComment({
							userId: participant,
							marketId,
							side,
							stake,
							body: bodyFor(m.key, globalIndex, true),
							parentCommentId,
						});
					} else {
						const stake = POST_STAKES[globalIndex % POST_STAKES.length] ?? "12";
						const commentId = await placeVolumeComment({
							userId: participant,
							marketId,
							side,
							stake,
							body: bodyFor(m.key, globalIndex, false),
							parentCommentId: null,
						});
						postIds.push(commentId);
					}
					produced[m.key] = (produced[m.key] ?? 0) + 1;
				}
			}

			console.log(
				"[staging:generate-volume] produced this run:",
				JSON.stringify(produced),
			);
			console.log(
				"[staging:generate-volume] hot market for the k6 writer arm:",
				VOLUME_MARKETS.find((m) => m.hot)?.slug,
			);
		} catch (err) {
			generationError = err;
			throw err;
		}

		expect(generationError).toBeNull();
	});

	it("final row counts land at or above target for every volume market", async () => {
		for (const m of VOLUME_MARKETS) {
			const [market] = await readOnly
				.select({ id: markets.id })
				.from(markets)
				.where(eq(markets.slug, m.slug));
			expect(market, `market ${m.slug} should exist`).toBeTruthy();
			if (!market) continue;

			const [{ n }] = await readOnly
				.select({ n: sql<number>`count(*)::int` })
				.from(comments)
				.where(eq(comments.marketId, market.id));
			expect(n, `${m.slug} comment count`).toBeGreaterThanOrEqual(
				m.targetComments,
			);
		}
	});
});
