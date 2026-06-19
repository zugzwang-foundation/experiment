import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// DEBATE.7 §10 — A2 mapping (gate unit). The fixed App.A image→Track A mapping
// (§3). `precommitModerate` currently routes only `sexual/minors`+image →
// track_a and everything else flagged → track_b. A2 adds the image adult
// `sexual` → track_a rule (the CSAM-image backstop while PhotoDNA is parked).
// The full target ordering (precommit.ts §3):
//   sexual/minors true:           imageR2Key ? track_a : track_b   (unchanged)
//   sexual true && imageR2Key:    track_a                          (A2 — NEW)
//   sexual true && !imageR2Key:   track_b                          (text stays B)
//   any other flagged:            track_b
//   none:                         pass
//
// ALL FOUR cells (§10), the OpenAI verdict MOCKED (asserts the MAPPING, not the
// classifier):
//   1. image adult `sexual` (no minors)        → track_a   (A2)
//   2. adult `sexual` TEXT (no image)           → track_b
//   3. `sexual/minors` image                    → track_a
//   4. `sexual/minors` text                     → track_b  (carve-out)
//
// FAILING-FIRST (DEBATE.7 — A2 lands at implement): cell 1 (image adult
// `sexual` → track_a) is RED — the CURRENT precommit.ts maps adult `sexual`
// with an image to `track_b` (only `sexual/minors`+image is track_a today;
// precommit.ts:128-129). A2 has not been written. The enriched `categoryScores`
// return does NOT exist yet either, so the `result.categoryScores` assertions
// fail. Cells 2-4 already pass on the current mapping (they are the regression
// floor A2 must preserve), but the suite as a whole is RED on cell 1 + scores.
//
// Mocks: `@/server/upstash/redis`, `@/server/moderation/openai`,
// `@/server/storage/sign-read` (the precommit-moderate.integration pattern).

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

// The omni response shape: a Record<string,boolean> categories map + a parallel
// scores map. The A2 mapping pivots on the boolean map; the enriched return must
// surface the scores (§6 — `categoryScores`).
function modResult(categories: Record<string, boolean>) {
	const flagged = Object.values(categories).some((v) => v === true);
	const scores: Record<string, number> = {};
	for (const k of Object.keys(categories)) {
		scores[k] = categories[k] ? 0.92 : 0.01;
	}
	return { flagged, categories, scores };
}

function args(over?: {
	text?: string;
	imageR2Key?: string | undefined;
	idempotencyKey?: string;
	userId?: string;
	marketId?: string;
}) {
	const userId = over?.userId ?? "a2-user";
	return {
		text: over?.text ?? "argument",
		imageR2Key: over?.imageR2Key,
		idempotencyKey: over?.idempotencyKey ?? "a2-idem",
		userId,
		marketId: over?.marketId ?? "a2-market",
	};
}

describe("DEBATE.7 A2 — fixed App.A image→Track A mapping (4 cells)", () => {
	it("a2-mapping::image-adult-sexual-routes-track-a", async () => {
		// CELL 1 (A2 — NEW): adult `sexual` true (NOT minors) on an IMAGE → track_a.
		// CURRENT precommit.ts routes this to track_b (only sexual/minors+image is
		// track_a today) → this assertion is the RED that A2 turns green.
		const a = args({
			imageR2Key: "u/a2-user/img-adult.jpg",
			idempotencyKey: "a2-cell1",
		});
		mockRedis.set.mockResolvedValueOnce("OK");
		mockRedis.del.mockResolvedValueOnce(1);
		mockSignRead.mockResolvedValueOnce(
			"https://r2.example/u/a2-user/img-adult.jpg?X-Amz-Signature=mod",
		);
		mockOpenAiModerate.mockResolvedValueOnce(
			modResult({ sexual: true, "sexual/minors": false }),
		);

		const result = await precommitModerate(a);

		expect(result.outcome).toBe("track_a");
		expect(result.categories).toContain("sexual");
		expect(result.categories).not.toContain("sexual/minors");
		// §6 enrichment — the scores object flows through for the audit row.
		expect(result.categoryScores).toBeDefined();
		expect(result.categoryScores?.sexual).toBeGreaterThan(0.5);
	});

	it("a2-mapping::text-adult-sexual-routes-track-b", async () => {
		// CELL 2: adult `sexual` true (NOT minors) as TEXT (no image) → track_b.
		// A2 does NOT auto-ban on text (text-first platform; auto-ban-on-text is
		// HARDEN.5). A2 must PRESERVE this — it is the regression floor.
		const a = args({ idempotencyKey: "a2-cell2" });
		mockRedis.set.mockResolvedValueOnce("OK");
		mockRedis.del.mockResolvedValueOnce(1);
		mockOpenAiModerate.mockResolvedValueOnce(
			modResult({ sexual: true, "sexual/minors": false }),
		);

		const result = await precommitModerate(a);

		expect(result.outcome).toBe("track_b");
		expect(result.categories).toContain("sexual");
		expect(mockSignRead).not.toHaveBeenCalled();
		expect(result.categoryScores).toBeDefined();
	});

	it("a2-mapping::image-sexual-minors-routes-track-a", async () => {
		// CELL 3: `sexual/minors` true on an IMAGE → track_a (CSAM legal floor;
		// unchanged from SCAFFOLD.16). The minors branch wins ordering.
		const a = args({
			imageR2Key: "u/a2-user/img-csam.jpg",
			idempotencyKey: "a2-cell3",
		});
		mockRedis.set.mockResolvedValueOnce("OK");
		mockRedis.del.mockResolvedValueOnce(1);
		mockSignRead.mockResolvedValueOnce(
			"https://r2.example/u/a2-user/img-csam.jpg?X-Amz-Signature=mod",
		);
		mockOpenAiModerate.mockResolvedValueOnce(
			modResult({ "sexual/minors": true, sexual: true }),
		);

		const result = await precommitModerate(a);

		expect(result.outcome).toBe("track_a");
		expect(result.categories).toContain("sexual/minors");
		expect(result.categoryScores).toBeDefined();
	});

	it("a2-mapping::text-sexual-minors-routes-track-b-carve-out", async () => {
		// CELL 4: `sexual/minors` true as TEXT (no image) → track_b (the carve-out;
		// the consequence writer's discriminant turns this into reason
		// `sexual_minors_text_blocked`). Unchanged from SCAFFOLD.16; A2 preserves it.
		const a = args({ idempotencyKey: "a2-cell4" });
		mockRedis.set.mockResolvedValueOnce("OK");
		mockRedis.del.mockResolvedValueOnce(1);
		mockOpenAiModerate.mockResolvedValueOnce(
			modResult({ "sexual/minors": true, sexual: true }),
		);

		const result = await precommitModerate(a);

		expect(result.outcome).toBe("track_b");
		expect(result.categories).toContain("sexual/minors");
		expect(mockSignRead).not.toHaveBeenCalled();
		expect(result.categoryScores).toBeDefined();
	});
});
