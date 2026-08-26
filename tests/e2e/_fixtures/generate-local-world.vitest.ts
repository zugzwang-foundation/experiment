// Seeds a small local E2E world by driving the REAL engine — never by
// hand-writing rows or events (the standing project rule; a hand-written
// bet produces a CPMM state the engine would never produce).
//
// This is deliberately much smaller than tests/staging/generate.staging.test.ts:
// one market, one YES post, two participants, no images. The staging
// generator's comment-placement path always uploads a real image through R2
// (uploadFixtureImage), which directly conflicts with this project's own
// rule that R2 must stay entirely absent from local E2E runs. This file
// reuses the same engine functions and the same drive-the-engine discipline,
// but skips the image-upload path entirely since none of the nine E2E-1
// tests need it (image comments are explicitly out of scope).
//
// Runs under Vitest (not plain tsx) because `acceptTosAction` reads
// next/headers' cookies()/headers() and a signed onboarding-ref — those only
// resolve inside a real Next.js request or a mocked module, per ADR-0036's
// "Vitest-context operational runners" rationale. The mock shape below is
// copied verbatim from tests/staging/generate.staging.test.ts, the working
// precedent for this exact problem.

import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { v7 as uuidv7 } from "uuid";
import { describe, expect, it, vi } from "vitest";

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

vi.mock("next/navigation", () => ({
	redirect: vi.fn(),
	notFound: vi.fn(),
}));

vi.mock("next/cache", () => ({
	revalidatePath: vi.fn(),
	revalidateTag: vi.fn(),
}));

import { auth } from "@/server/auth";
import { acceptTosAction } from "@/server/auth/tos-accept";
import { place } from "@/server/bets/place";
import { runBetTransaction } from "@/server/bets/transaction";
import { createMarket } from "@/server/markets/create";
import { openMarket } from "@/server/markets/open";
import { forgeSession, storageStateFor } from "./session";

const SYNTHETIC_IP = "127.0.0.1";
const SYNTHETIC_UA = "playwright-e2e-local-seed";

function adminMetadata(flowId: string) {
	return {
		request_id: "e2e-local-generate",
		flow_id: flowId,
		user_id: null,
		actor_id: "admin-singleton",
		idempotency_key: null,
		ip: SYNTHETIC_IP,
		user_agent: SYNTHETIC_UA,
	};
}

function betMetadata(userId: string, flowId: string) {
	return {
		request_id: "e2e-local-generate",
		flow_id: flowId,
		user_id: userId,
		actor_id: userId,
		idempotency_key: null,
		ip: SYNTHETIC_IP,
		user_agent: SYNTHETIC_UA,
	};
}

async function createParticipant(args: {
	email: string;
	displayName: string;
	providerId: string;
	accountId: string;
}): Promise<{ userId: string; pseudonym: string }> {
	const ctx = await auth.$context;
	const created = await ctx.internalAdapter.createOAuthUser(
		{
			email: args.email,
			name: args.displayName,
			image: null,
			emailVerified: true,
		},
		{
			providerId: args.providerId,
			accountId: args.accountId,
			accessToken: "e2e-local-access-token",
			refreshToken: "e2e-local-refresh-token",
			idToken: "e2e-local-id-token",
			scope: "openid email profile",
			accessTokenExpiresAt: null,
			refreshTokenExpiresAt: null,
		},
	);
	const user = (
		created as { user?: { id?: string; pseudonym?: string } } | null
	)?.user;
	const userId = user?.id;
	const pseudonym = user?.pseudonym;
	if (!userId || !pseudonym) {
		throw new Error(
			`createParticipant: no user/pseudonym returned for ${args.email}`,
		);
	}

	mockCookiesGet.mockImplementation((name: string) =>
		name === "onboarding_ref"
			? { name: "onboarding_ref", value: "e2e-local-onboarding-ref" }
			: undefined,
	);
	mockHeadersGet.mockImplementation((header: string) => {
		if (header === "x-forwarded-for") return SYNTHETIC_IP;
		if (header === "user-agent") return SYNTHETIC_UA;
		return null;
	});
	mockVerifyOnboardingRef.mockReturnValue({ userId });

	const formData = new FormData();
	formData.set("accepted", "true");
	await acceptTosAction(formData);

	return { userId, pseudonym };
}

async function createAndOpenMarket(args: {
	slug: string;
	title: string;
	now: Date;
	flowSuffix: string;
}): Promise<string> {
	const marketId = uuidv7();
	const mediaId = uuidv7();
	await createMarket({
		marketId,
		slug: args.slug,
		title: args.title,
		description:
			"Resolution criterion: this market exists only for local Playwright fixtures and is never resolved.",
		resolutionDeadline: new Date(args.now.getTime() + 30 * 24 * 60 * 60 * 1000),
		media: [
			{
				mediaId,
				key: `m/${marketId}/${mediaId}.png`,
				displayOrder: 0,
				isDefault: true,
			},
		],
		mediaVideoUrl: null,
		now: args.now,
		metadata: adminMetadata(`e2e-local-market-create-${args.flowSuffix}`),
	});
	await openMarket({
		marketId,
		seedAmount: "1000",
		now: args.now,
		metadata: adminMetadata(`e2e-local-market-open-${args.flowSuffix}`),
	});
	return marketId;
}

describe("e2e local world generation", () => {
	it("seeds one open market with one YES post, and two onboarded participants", async () => {
		const now = new Date();

		const participant = await createParticipant({
			email: "e2e-local-participant@example.com",
			displayName: "E2E Local Participant",
			providerId: "google",
			accountId: "e2e-local-participant-000",
		});
		const participantId = participant.userId;

		const rival = await createParticipant({
			email: "e2e-local-rival@example.com",
			displayName: "E2E Local Rival",
			providerId: "google",
			accountId: "e2e-local-rival-001",
		});
		const rivalId = rival.userId;

		// A separate fresh participant for the capital-neutrality heavy stake
		// (amendment A1) — INITIAL_USER_DHARMA is only 1000 (src/server/config/
		// limits.ts:139), and `rival` already spends 100 of theirs on the main
		// seed post below, so a dedicated "whale" avoids any balance-tracking
		// risk between the two.
		const whale = await createParticipant({
			email: "e2e-local-whale@example.com",
			displayName: "E2E Local Whale",
			providerId: "google",
			accountId: "e2e-local-whale-002",
		});
		const whaleId = whale.userId;

		const marketId = uuidv7();
		const mediaId = uuidv7();
		const slug = "e2e-local-seed-market";

		await createMarket({
			marketId,
			slug,
			title: "E2E local seed market — will this test suite work?",
			description:
				"Resolution criterion: this market exists only for local Playwright fixtures and is never resolved.",
			resolutionDeadline: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
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
			metadata: adminMetadata("e2e-local-market-create"),
		});

		await openMarket({
			marketId,
			seedAmount: "1000",
			now,
			metadata: adminMetadata("e2e-local-market-open"),
		});

		const seedPostId = await runBetTransaction(
			{ marketId, flow: "F-BET-1" },
			(ctx) =>
				place(ctx, {
					userId: rivalId,
					marketId,
					side: "YES",
					stake: "100",
					body: "E2E local seed: a YES argument for the participant to reply to.",
					parentCommentId: null,
					idempotencyKey: uuidv7(),
					bodyFingerprint: uuidv7(),
					betEventId: uuidv7(),
					commentEventId: uuidv7(),
					creditEventId: uuidv7(),
					metadata: betMetadata(rivalId, "F-BET-1"),
				}).then((result) => result.commentId),
		);

		// ── Close-out C2.3 · a real depth-1 reply, for the reply-depth test ──
		// REPLY_DEPTH_MAX = 1 (src/server/comments/reply-validate.ts) — a reply
		// onto THIS reply must be refused. Needs a real depth-1 comment to
		// attempt replying to. Uses `rival`, NOT `participant` — giving
		// `participant` a YES position here would trip I-SINGLE-SIDE-001 (at
		// most one held side per user/market) the moment the interactive
		// reply-floor tests (04-reply-floor.spec.ts) try betting NO as
		// `participant` in the browser, correctly disabling their Counter
		// trigger. Keeping `participant` clean of any pre-existing position in
		// this market is what those tests assume. Same direct place() pattern,
		// no moderation touched.
		const seedReplyId = await runBetTransaction(
			{ marketId, flow: "F-COMMENT-2" },
			(ctx) =>
				place(ctx, {
					userId: rivalId,
					marketId,
					side: "YES",
					stake: "60",
					body: "E2E local seed: a depth-1 reply, for testing that depth-2 is refused.",
					parentCommentId: seedPostId,
					idempotencyKey: uuidv7(),
					bodyFingerprint: uuidv7(),
					betEventId: uuidv7(),
					commentEventId: uuidv7(),
					creditEventId: uuidv7(),
					metadata: betMetadata(rivalId, "F-COMMENT-2"),
				}).then((result) => result.commentId),
		);

		// ── Amendment A1 · Discovery is capital-neutral ──
		// Three more markets, created strictly in sequence (created_at comes
		// from the DB's real insertion time, not the `now` clock arg — each
		// createMarket call is awaited fully before the next starts, so
		// Postgres's own now() gives them a real, strictly increasing order).
		// A large stake lands on A AFTER all three exist, via the same direct
		// place() engine call as the main seed above — never the HTTP endpoint,
		// so this never touches moderation (same reasoning as the main seed's
		// rival post).
		const marketASlug = "e2e-cn-market-a";
		const marketBSlug = "e2e-cn-market-b";
		const marketCSlug = "e2e-cn-market-c";

		const marketAId = await createAndOpenMarket({
			slug: marketASlug,
			title: "E2E capital-neutral A — created first, will be heavily staked",
			now: new Date(),
			flowSuffix: "cn-a",
		});
		await createAndOpenMarket({
			slug: marketBSlug,
			title: "E2E capital-neutral B — created second, never staked",
			now: new Date(),
			flowSuffix: "cn-b",
		});
		await createAndOpenMarket({
			slug: marketCSlug,
			title: "E2E capital-neutral C — created last, never staked",
			now: new Date(),
			flowSuffix: "cn-c",
		});

		// The heavy stake — 800 against a pool seeded with 1000 liquidity is a
		// dominant bet (most of the user's entire 1000 initial balance), large
		// enough to move the pool substantially. Lands after B and C exist, so
		// if Discovery ordered by stake instead of recency, A would jump to
		// the front; it must not.
		await runBetTransaction({ marketId: marketAId, flow: "F-BET-1" }, (ctx) =>
			place(ctx, {
				userId: whaleId,
				marketId: marketAId,
				side: "YES",
				stake: "800",
				body: "E2E capital-neutral: a heavy stake that must not buy front-page visibility.",
				parentCommentId: null,
				idempotencyKey: uuidv7(),
				bodyFingerprint: uuidv7(),
				betEventId: uuidv7(),
				commentEventId: uuidv7(),
				creditEventId: uuidv7(),
				metadata: betMetadata(whaleId, "F-BET-1"),
			}),
		);

		const world = {
			marketId,
			marketSlug: slug,
			participantId,
			participantPseudonym: participant.pseudonym,
			rivalId,
			rivalPseudonym: rival.pseudonym,
			seedPostId,
			seedReplyId,
			capitalNeutralMarketASlug: marketASlug,
			capitalNeutralMarketBSlug: marketBSlug,
			capitalNeutralMarketCSlug: marketCSlug,
		};

		writeFileSync(
			join(__dirname, "..", ".auth", "world.json"),
			JSON.stringify(world, null, 2),
		);

		// ── Slice 3 · session forging + THE ROUND-TRIP PROOF ──
		// The exit criterion is not "a cookie was set" — it's that the forged
		// cookie actually authenticates through the real verification path.
		const forged = await forgeSession(participantId);
		const headers = new Headers({
			cookie: `${forged.cookieName}=${forged.cookieValue}`,
		});
		const session = await auth.api.getSession({ headers });
		expect(session?.user?.id).toBe(participantId);

		writeFileSync(
			join(__dirname, "..", ".auth", "participant.json"),
			JSON.stringify(storageStateFor(forged), null, 2),
		);
	});
});
