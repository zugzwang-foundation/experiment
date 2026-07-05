import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// AUDIT-FIX-A21 — failing-first belt test. The OpenAI verdict mapper fails OPEN
// on a `flagged: true` response that carries NO category the code maps
// (snapshot/label drift): every escalation branch in `precommitModerate` reads a
// specific category boolean or `flaggedCategories.length`, never the top-level
// `result.flagged`, so a flagged-with-zero-categories verdict falls through every
// branch to `outcome: 'pass'` — a fail-open on a legal-floor gate (SPEC.1 §16.5).
//
// The fix (Option A — web ruling) is a vendor-boundary well-formedness guard in
// `moderate()` (openai.ts) — the twin of the `openai_moderation_empty_results`
// anomaly — that fails CLOSED (ModerationUnavailableError → HTTP 503
// `moderation_unavailable`) and emits the DISTINCT tag
// `openai_moderation_malformed_flagged` (NOT the generic upstream_failure the
// empty-results sibling classifies into), so a category rename under the pinned
// snapshot reads as drift, not an outage. The capture stays at THIS vendor
// boundary per AUDIT-FIX-B1 A6 ruling #4; precommit.ts mints nothing new.
//
// This test drives the REAL precommitModerate seam (real moderate() + real
// mapper) with a MOCKED OpenAI HTTP response of the malformed shape — NOT a mock
// of the guard. RED on current main: moderate() returns the malformed verdict
// verbatim, the mapper maps it to `pass`, and precommitModerate RESOLVES instead
// of throwing → the three fail-closed assertions fail. That red run is the proof
// the fail-open exists today. GREEN after the belt lands. The two scoping guards
// (flagged:false still passes; flagged:true + any category true still fails
// closed to track_b) are green both sides — they pin the belt's scope.
//
// Mocks: `openai` SDK (`...actual` so the SUT's `instanceof` discriminators run
// against the REAL error classes; `moderations.create` is a controllable spy —
// the openai-capture.test pattern), `@sentry/nextjs` (assert the distinct tag),
// `@/server/upstash/redis` (reservation SETNX/DEL — the a2-mapping pattern). No
// image path (no imageR2Key) → sign-read is never reached.

const { mockCreate } = vi.hoisted(() => ({ mockCreate: vi.fn() }));
vi.mock("openai", async () => {
	const actual = await vi.importActual<typeof import("openai")>("openai");
	class OpenAI {
		moderations = { create: mockCreate };
	}
	return { ...actual, default: OpenAI };
});

const { mockCaptureException, mockCaptureMessage } = vi.hoisted(() => ({
	mockCaptureException: vi.fn(),
	mockCaptureMessage: vi.fn(),
}));
vi.mock("@sentry/nextjs", () => ({
	captureException: mockCaptureException,
	captureMessage: mockCaptureMessage,
	addBreadcrumb: vi.fn(),
}));

const { mockRedis } = vi.hoisted(() => ({
	mockRedis: { set: vi.fn(), get: vi.fn(), del: vi.fn(), eval: vi.fn() },
}));
vi.mock("@/server/upstash/redis", () => ({ redis: mockRedis }));

// getClient() validates OPENAI_API_KEY at first call (not module load).
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? "sk-test-a21";

import { ModerationUnavailableError } from "@/lib/errors";
import { precommitModerate } from "@/server/moderation/precommit";

// A fully-false omni category map (a realistic subset of the
// omni-moderation-2024-09-26 category set), paired with a parallel scores map.
const ALL_FALSE_CATEGORIES: Record<string, boolean> = {
	"sexual/minors": false,
	sexual: false,
	harassment: false,
	"harassment/threatening": false,
	hate: false,
	"hate/threatening": false,
	illicit: false,
	"illicit/violent": false,
	"self-harm": false,
	"self-harm/intent": false,
	"self-harm/instructions": false,
	violence: false,
	"violence/graphic": false,
};

function scoresFor(cats: Record<string, boolean>): Record<string, number> {
	const s: Record<string, number> = {};
	for (const k of Object.keys(cats)) {
		s[k] = cats[k] ? 0.9 : 0.01;
	}
	return s;
}

// The raw OpenAI SDK response shape (`response.results[0]` = { flagged,
// categories, category_scores }) that moderate() reads and returns.
function sdkResponse(flagged: boolean, categories: Record<string, boolean>) {
	return {
		results: [{ flagged, categories, category_scores: scoresFor(categories) }],
	};
}

function args() {
	return {
		text: "an argued comment",
		idempotencyKey: "a21-idem",
		userId: "a21-user",
		marketId: "a21-market",
	};
}

describe("AUDIT-FIX-A21 — flagged-with-no-mapped-category fails CLOSED", () => {
	beforeEach(() => {
		mockCreate.mockReset();
		mockCaptureException.mockReset();
		mockCaptureMessage.mockReset();
		mockRedis.set.mockReset();
		mockRedis.del.mockReset();
		mockRedis.set.mockResolvedValue("OK");
		mockRedis.del.mockResolvedValue(1);
	});
	afterEach(() => {
		vi.clearAllMocks();
	});

	it("a21::flagged-true-no-category-fails-closed-503", async () => {
		// The malformed shape: `flagged` asserted true, ZERO categories true.
		mockCreate.mockResolvedValue(sdkResponse(true, ALL_FALSE_CATEGORIES));

		// RED on main: precommitModerate RESOLVES to { outcome: 'pass' } (the
		// fail-open). GREEN after the belt: it fails closed as
		// ModerationUnavailableError → HTTP 503 moderation_unavailable.
		await expect(precommitModerate(args())).rejects.toBeInstanceOf(
			ModerationUnavailableError,
		);
	});

	it("a21::malformed-emits-distinct-tag-not-upstream-failure", async () => {
		mockCreate.mockResolvedValue(sdkResponse(true, ALL_FALSE_CATEGORIES));

		await expect(precommitModerate(args())).rejects.toBeInstanceOf(
			ModerationUnavailableError,
		);

		// Exactly one capture, carrying the DISTINCT drift tag — NOT the generic
		// `openai_moderation_upstream_failure` the empty-results sibling emits.
		expect(mockCaptureException).toHaveBeenCalledTimes(1);
		expect(mockCaptureException).toHaveBeenCalledWith(expect.any(Error), {
			tags: { kind: "openai_moderation_malformed_flagged" },
		});
	});

	it("a21::malformed-releases-redis-reservation", async () => {
		mockCreate.mockResolvedValue(sdkResponse(true, ALL_FALSE_CATEGORIES));

		await expect(precommitModerate(args())).rejects.toBeInstanceOf(
			ModerationUnavailableError,
		);

		// The precommit finally-block release fires even on the fail-closed path.
		expect(mockRedis.del).toHaveBeenCalledTimes(1);
	});

	// SCOPING GUARD (green both sides): a legitimate all-clear (flagged:false, no
	// category true) must still PASS — the belt fires only on flagged:true.
	it("a21::flagged-false-no-category-still-passes", async () => {
		mockCreate.mockResolvedValue(sdkResponse(false, ALL_FALSE_CATEGORIES));

		const result = await precommitModerate(args());

		expect(result.outcome).toBe("pass");
		expect(mockCaptureException).not.toHaveBeenCalled();
	});

	// EXHAUSTIVENESS GUARD (green both sides): a flagged verdict with ANY category
	// true (incl. an unknown/renamed one) is NOT malformed — the mapper's
	// `flaggedCategories.length > 0` catch-all routes it to track_b (fail closed),
	// never belted-as-malformed and never `pass`.
	it("a21::flagged-true-unknown-category-routes-track-b-not-belted", async () => {
		mockCreate.mockResolvedValue(
			sdkResponse(true, {
				...ALL_FALSE_CATEGORIES,
				some_future_category: true,
			}),
		);

		const result = await precommitModerate(args());

		expect(result.outcome).toBe("track_b");
		expect(mockCaptureException).not.toHaveBeenCalled();
	});
});
