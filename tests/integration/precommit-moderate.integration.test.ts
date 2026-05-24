import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Per SCAFFOLD.15 plan §5.2 — precommitModerate state-machine tests.
// Covers:
//   - Reservation lifecycle (`mod:reserve:${userId}:${marketId}:${idempotencyKey}`
//     via redis.set NX EX 10; del in finally; throw on collision)
//   - Verdict mapping table per §5.2 step 6 (pass / track_a / track_b)
//   - imageR2Key path mints a 60s signed READ URL and passes imageUrl into
//     openai.moderate
//   - Fail-CLOSED on OpenAI terminal failure (ModerationUnavailableError)
//
// Mocks (all three at module boundary):
//   - `@/server/upstash/redis` { redis: { set, get, del } } — reservation
//     SET-NX wins / loses scripts + DEL assertions.
//   - `@/server/moderation/openai` { moderate } — scripted verdict return
//     value or throw.
//   - `@/server/storage/sign-read` { signRead } — scripted URL on imageR2Key
//     path; assert called with 60s TTL.
//
// NOT mocked: DB (precommit doesn't write rows; mod_actions insertion is
// owned by the caller per §5.2 paragraph 6 — moderation client returns
// verdict + categories, caller persists). REFUSAL-2 indirect: track_a is
// the CSAM legal-floor verdict.

const { mockRedis, mockOpenAiModerate, mockSignRead } = vi.hoisted(() => ({
	mockRedis: {
		set: vi.fn(),
		get: vi.fn(),
		del: vi.fn(),
		eval: vi.fn(),
	},
	mockOpenAiModerate: vi.fn(),
	mockSignRead: vi.fn(),
}));

vi.mock("@/server/upstash/redis", () => ({
	redis: mockRedis,
}));

vi.mock("@/server/moderation/openai", () => ({
	moderate: mockOpenAiModerate,
}));

vi.mock("@/server/storage/sign-read", () => ({
	signRead: mockSignRead,
}));

import {
	ModerationInFlightError,
	ModerationUnavailableError,
} from "@/lib/errors";
import {
	READ_URL_TTL_SECONDS_MODERATION,
	RESERVATION_KEY_PREFIX,
	RESERVATION_TTL_SECONDS,
} from "@/server/config/limits";
import { precommitModerate } from "@/server/moderation/precommit";

beforeEach(() => {
	mockRedis.set.mockReset();
	mockRedis.get.mockReset();
	mockRedis.del.mockReset();
	mockRedis.eval.mockReset();
	mockOpenAiModerate.mockReset();
	mockSignRead.mockReset();
});

afterEach(() => {
	vi.clearAllMocks();
});

// Build the moderation result shape the impl maps verdict from. Categories
// is a Record<string, boolean>; the impl checks for 'sexual/minors' first
// (track_a CSAM legal floor), then any other flagged → track_b, else pass.
function modResult(categories: Record<string, boolean>) {
	const flagged = Object.values(categories).some((v) => v === true);
	const scores: Record<string, number> = {};
	for (const k of Object.keys(categories)) {
		scores[k] = categories[k] ? 0.9 : 0.01;
	}
	return { flagged, categories, scores };
}

// Build the standard input arg shape; reservationKey for assert convenience.
function args(over?: {
	text?: string;
	imageR2Key?: string | undefined;
	idempotencyKey?: string;
	userId?: string;
	marketId?: string;
}) {
	const userId = over?.userId ?? "user-1";
	const marketId = over?.marketId ?? "market-1";
	const idempotencyKey = over?.idempotencyKey ?? "idem-1";
	const a = {
		text: over?.text ?? "hello",
		imageR2Key: over?.imageR2Key,
		idempotencyKey,
		userId,
		marketId,
	};
	const reservationKey = `${RESERVATION_KEY_PREFIX}${userId}:${marketId}:${idempotencyKey}`;
	return { a, reservationKey };
}

describe("precommitModerate (SCAFFOLD.15 §5.2)", () => {
	// === Verdict-mapping matrix (plan §5.2 step 6 mandatory) ===================

	it("precommit-moderate::pass-text-only", async () => {
		// All categories false → outcome 'pass'. No image path, no signRead.
		const { a } = args({ text: "this is fine" });
		mockRedis.set.mockResolvedValueOnce("OK"); // reservation acquired
		mockRedis.del.mockResolvedValueOnce(1);
		mockOpenAiModerate.mockResolvedValueOnce(
			modResult({ harassment: false, sexual: false, violence: false }),
		);

		const result = await precommitModerate(a);

		expect(result.outcome).toBe("pass");
		expect(result.categories).toEqual([]);
		expect(mockSignRead).not.toHaveBeenCalled();
		expect(mockOpenAiModerate).toHaveBeenCalledTimes(1);
	});

	it("precommit-moderate::track-a-csam-mapping", async () => {
		// REFUSAL-2 (CSAM legal floor): 'sexual/minors' true → track_a,
		// REGARDLESS of other flagged categories also being true.
		// Verifies the 'sexual/minors' branch wins ordering even when
		// sexual is also true.
		const { a } = args({ text: "blocked content", idempotencyKey: "idem-a" });
		mockRedis.set.mockResolvedValueOnce("OK");
		mockRedis.del.mockResolvedValueOnce(1);
		mockOpenAiModerate.mockResolvedValueOnce(
			modResult({ "sexual/minors": true, sexual: true }),
		);

		const result = await precommitModerate(a);

		expect(result.outcome).toBe("track_a");
		expect(result.categories).toContain("sexual/minors");
	});

	it("precommit-moderate::track-b-sexual-not-minors", async () => {
		// 'sexual' true WITHOUT 'sexual/minors' → track_b (NOT track_a).
		// Discriminator boundary test.
		const { a } = args({ idempotencyKey: "idem-b1" });
		mockRedis.set.mockResolvedValueOnce("OK");
		mockRedis.del.mockResolvedValueOnce(1);
		mockOpenAiModerate.mockResolvedValueOnce(
			modResult({ sexual: true, "sexual/minors": false }),
		);

		const result = await precommitModerate(a);

		expect(result.outcome).toBe("track_b");
		expect(result.categories).toContain("sexual");
		expect(result.categories).not.toContain("sexual/minors");
	});

	it("precommit-moderate::track-b-hate-categories", async () => {
		// hate / hate-threatening flagged → track_b. Both included in
		// returned categories list (full provenance for mod_actions row).
		const { a } = args({ idempotencyKey: "idem-b2" });
		mockRedis.set.mockResolvedValueOnce("OK");
		mockRedis.del.mockResolvedValueOnce(1);
		mockOpenAiModerate.mockResolvedValueOnce(
			modResult({ hate: true, "hate/threatening": true }),
		);

		const result = await precommitModerate(a);

		expect(result.outcome).toBe("track_b");
		expect(result.categories).toContain("hate");
		expect(result.categories).toContain("hate/threatening");
	});

	it("precommit-moderate::track-b-violence-only", async () => {
		// Single 'violence' category flagged → track_b.
		const { a } = args({ idempotencyKey: "idem-b3" });
		mockRedis.set.mockResolvedValueOnce("OK");
		mockRedis.del.mockResolvedValueOnce(1);
		mockOpenAiModerate.mockResolvedValueOnce(modResult({ violence: true }));

		const result = await precommitModerate(a);

		expect(result.outcome).toBe("track_b");
		expect(result.categories).toEqual(["violence"]);
	});

	// === Reservation lifecycle =================================================

	it("precommit-moderate::reservation-collision-throws-ModerationInFlight", async () => {
		// SET NX returns null (key exists) → impl throws
		// ModerationInFlightError WITHOUT touching openai or signRead.
		const { a, reservationKey } = args({ idempotencyKey: "idem-coll" });
		mockRedis.set.mockResolvedValueOnce(null);

		await expect(precommitModerate(a)).rejects.toBeInstanceOf(
			ModerationInFlightError,
		);

		// SET NX was issued exactly once on the prefixed key with TTL 10s.
		expect(mockRedis.set).toHaveBeenCalledWith(
			reservationKey,
			"1",
			expect.objectContaining({ nx: true, ex: RESERVATION_TTL_SECONDS }),
		);
		// On collision, no DEL fires (we didn't own the reservation).
		expect(mockRedis.del).not.toHaveBeenCalled();
		expect(mockOpenAiModerate).not.toHaveBeenCalled();
		expect(mockSignRead).not.toHaveBeenCalled();
	});

	it("precommit-moderate::reservation-deleted-on-pass", async () => {
		// On the happy path, the impl DELs the reservation key in `finally`.
		const { a, reservationKey } = args({ idempotencyKey: "idem-pass-del" });
		mockRedis.set.mockResolvedValueOnce("OK");
		mockRedis.del.mockResolvedValueOnce(1);
		mockOpenAiModerate.mockResolvedValueOnce(modResult({}));

		await precommitModerate(a);

		expect(mockRedis.del).toHaveBeenCalledWith(reservationKey);
		expect(mockRedis.del).toHaveBeenCalledTimes(1);
	});

	it("precommit-moderate::reservation-deleted-on-throw", async () => {
		// `finally` semantics: even when openai throws, the reservation is
		// DELed so a retry from the same idempotency key can proceed.
		const { a, reservationKey } = args({ idempotencyKey: "idem-throw-del" });
		mockRedis.set.mockResolvedValueOnce("OK");
		mockRedis.del.mockResolvedValueOnce(1);
		const openaiErr = new Error("openai timeout");
		mockOpenAiModerate.mockRejectedValueOnce(openaiErr);

		// Throws ModerationUnavailableError (caller maps to 503).
		await expect(precommitModerate(a)).rejects.toBeInstanceOf(
			ModerationUnavailableError,
		);

		expect(mockRedis.del).toHaveBeenCalledWith(reservationKey);
	});

	it("precommit-moderate::reservation-key-shape-with-namespacing", async () => {
		// Key shape per §5.2 step 1: `mod:reserve:${userId}:${marketId}:${idempotencyKey}`.
		// Verifies the three identifiers are colon-joined in canonical order
		// after the prefix (collisions across users/markets/idems are
		// impossible by construction).
		const { a, reservationKey } = args({
			userId: "user-xyz",
			marketId: "market-abc",
			idempotencyKey: "idem-namespacing",
		});
		mockRedis.set.mockResolvedValueOnce("OK");
		mockRedis.del.mockResolvedValueOnce(1);
		mockOpenAiModerate.mockResolvedValueOnce(modResult({}));

		await precommitModerate(a);

		expect(mockRedis.set).toHaveBeenCalledWith(
			reservationKey,
			"1",
			expect.objectContaining({ nx: true, ex: RESERVATION_TTL_SECONDS }),
		);
		expect(reservationKey).toBe(
			"mod:reserve:user-xyz:market-abc:idem-namespacing",
		);
		// Sanity floors on the constants.
		expect(RESERVATION_KEY_PREFIX).toBe("mod:reserve:");
		expect(RESERVATION_TTL_SECONDS).toBe(10);
	});

	// === Image path: signed READ URL mint + handoff to openai ==================

	it("precommit-moderate::image-r2-key-mints-signed-read-url-60s", async () => {
		// imageR2Key provided → impl mints a 60s signed READ URL via signRead
		// AND passes the URL into openai.moderate as imageUrl. Verifies the
		// TTL is 60s (READ_URL_TTL_SECONDS_MODERATION) for the moderation
		// hop (vs. 3600s for render in DEBATE.4).
		const { a } = args({
			imageR2Key: "u/user-1/abc.jpg",
			idempotencyKey: "idem-img",
		});
		const scriptedUrl =
			"https://r2.example/u/user-1/abc.jpg?X-Amz-Signature=mod";
		mockRedis.set.mockResolvedValueOnce("OK");
		mockRedis.del.mockResolvedValueOnce(1);
		mockSignRead.mockResolvedValueOnce(scriptedUrl);
		mockOpenAiModerate.mockResolvedValueOnce(modResult({}));

		const result = await precommitModerate(a);

		expect(mockSignRead).toHaveBeenCalledTimes(1);
		expect(mockSignRead).toHaveBeenCalledWith(
			"u/user-1/abc.jpg",
			READ_URL_TTL_SECONDS_MODERATION,
		);
		// openai.moderate received both text + imageUrl args.
		expect(mockOpenAiModerate).toHaveBeenCalledWith(
			expect.objectContaining({
				text: "hello",
				imageUrl: scriptedUrl,
			}),
		);
		expect(result.outcome).toBe("pass");
	});

	it("precommit-moderate::text-only-skips-signRead", async () => {
		// No imageR2Key → signRead is NOT called (text-only path stays
		// substrate-cheap). openai.moderate receives no imageUrl.
		const { a } = args({ idempotencyKey: "idem-txt-only" });
		mockRedis.set.mockResolvedValueOnce("OK");
		mockRedis.del.mockResolvedValueOnce(1);
		mockOpenAiModerate.mockResolvedValueOnce(modResult({}));

		await precommitModerate(a);

		expect(mockSignRead).not.toHaveBeenCalled();
		// Inspect the args passed: imageUrl is either absent or undefined.
		const call = mockOpenAiModerate.mock.calls[0]?.[0] as {
			imageUrl?: string;
		};
		expect(call.imageUrl).toBeUndefined();
	});

	// === Fail-CLOSED on OpenAI terminal failure ===============================

	it("precommit-moderate::openai-unavailable-throws-ModerationUnavailable", async () => {
		// Per ADR-0006 + AGENTS.md §7 — moderation fails CLOSED on terminal
		// vendor failure. precommitModerate translates openai's throw into
		// ModerationUnavailableError; caller (route handler) maps to HTTP
		// 503. REFUSAL-2 indirect: we never accept content past a failed
		// moderation gate.
		const { a } = args({ idempotencyKey: "idem-503" });
		mockRedis.set.mockResolvedValueOnce("OK");
		mockRedis.del.mockResolvedValueOnce(1);
		const terminal = new Error("openai 5xx after retry");
		mockOpenAiModerate.mockRejectedValueOnce(terminal);

		await expect(precommitModerate(a)).rejects.toBeInstanceOf(
			ModerationUnavailableError,
		);
	});

	it("precommit-moderate::signRead-unavailable-throws-ModerationUnavailable", async () => {
		// R2 unreachable during the signed-READ mint also fails CLOSED.
		// signRead bubbles the raw throw; precommitModerate wraps it into
		// ModerationUnavailableError (same envelope as openai failure —
		// the caller doesn't need to discriminate).
		const { a } = args({
			imageR2Key: "u/user-1/x.jpg",
			idempotencyKey: "idem-r2",
		});
		mockRedis.set.mockResolvedValueOnce("OK");
		mockRedis.del.mockResolvedValueOnce(1);
		mockSignRead.mockRejectedValueOnce(new Error("ECONNREFUSED to R2"));

		await expect(precommitModerate(a)).rejects.toBeInstanceOf(
			ModerationUnavailableError,
		);
		// openai.moderate was NOT called (signRead failed first; impl
		// short-circuits before the openai hop).
		expect(mockOpenAiModerate).not.toHaveBeenCalled();
	});

	// === Constants exposure (live-import discipline per house style) ==========

	it("precommit-moderate::constants-have-spec-ratified-values", async () => {
		// Sanity floors on the SPEC.2 §10.10 ratified constants. If a future
		// PR moves any of these off-spec, this surfaces loud.
		expect(RESERVATION_TTL_SECONDS).toBe(10);
		expect(RESERVATION_KEY_PREFIX).toBe("mod:reserve:");
		expect(READ_URL_TTL_SECONDS_MODERATION).toBe(60);
	});
});
