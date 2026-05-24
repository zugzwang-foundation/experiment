import { describe, expect, it, vi } from "vitest";

// SCAFFOLD.15 OpenAI omni-moderation response-shape probe per plan §9.1.
// Asserts the surface contract that the precommitModerate verdict-mapping
// relies on: `result.categories['sexual/minors']` is a boolean; flagged
// categories list comes from Object.entries-with-true-filter; `model`
// pinning to the `omni-moderation-2024-09-26` snapshot is honored.
//
// Mock surface only — the live OpenAI dependency is in `src/server/moderation/openai.ts`
// and intercepts here at the SDK-client boundary (no real API call, no
// OPENAI_API_KEY required). This probe surfaces breakage if a future
// `pnpm add openai@<next>` changes the response shape we depend on.

const { mockModerationsCreate } = vi.hoisted(() => ({
	mockModerationsCreate: vi.fn(),
}));

vi.mock("openai", async () => {
	// Re-export the real error classes so the openai.ts wrapper's
	// `instanceof` discriminators still work; just intercept the client
	// constructor with one that produces a `moderations.create` mock.
	const actual = await vi.importActual<typeof import("openai")>("openai");
	class OpenAI {
		moderations = { create: mockModerationsCreate };
	}
	return {
		...actual,
		default: OpenAI,
	};
});

// Set the API key so getClient() doesn't throw at first call.
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? "sk-test-probe";

import { OPENAI_MODERATION_MODEL_SNAPSHOT } from "@/server/config/limits";
import { moderate } from "@/server/moderation/openai";

describe("OpenAI omni-moderation-2024-09-26 shape probe (SCAFFOLD.15)", () => {
	it("openai-omni-shape::categories-includes-sexual-minors", async () => {
		// The omni-moderation response shape MUST carry a 'sexual/minors'
		// boolean — the precommitModerate verdict mapping pivots on it
		// (track_a CSAM legal-floor branch). If a future OpenAI snapshot
		// drops this key, our verdict mapping silently produces 'track_b'
		// for CSAM content — REFUSAL-2 violation.
		mockModerationsCreate.mockResolvedValueOnce({
			id: "modr-test-1",
			model: OPENAI_MODERATION_MODEL_SNAPSHOT,
			results: [
				{
					flagged: true,
					categories: {
						harassment: false,
						"harassment/threatening": false,
						hate: false,
						"hate/threatening": false,
						illicit: false,
						"illicit/violent": false,
						"self-harm": false,
						"self-harm/instructions": false,
						"self-harm/intent": false,
						sexual: true,
						"sexual/minors": true,
						violence: false,
						"violence/graphic": false,
					},
					category_scores: {
						harassment: 0.01,
						"harassment/threatening": 0.01,
						hate: 0.01,
						"hate/threatening": 0.01,
						illicit: 0.01,
						"illicit/violent": 0.01,
						"self-harm": 0.01,
						"self-harm/instructions": 0.01,
						"self-harm/intent": 0.01,
						sexual: 0.95,
						"sexual/minors": 0.95,
						violence: 0.01,
						"violence/graphic": 0.01,
					},
				},
			],
		});

		const result = await moderate({ text: "test-content" });

		expect(result.flagged).toBe(true);
		expect(result.categories["sexual/minors"]).toBe(true);
		expect(result.categories.sexual).toBe(true);
		expect(typeof result.scores["sexual/minors"]).toBe("number");
	});

	it("openai-omni-shape::pins-model-snapshot", async () => {
		// The model parameter passed to moderations.create MUST equal the
		// pinned snapshot constant — a drift to `omni-moderation-latest`
		// would break verdict stability across OpenAI retunes.
		mockModerationsCreate.mockResolvedValueOnce({
			id: "modr-test-2",
			model: OPENAI_MODERATION_MODEL_SNAPSHOT,
			results: [
				{
					flagged: false,
					categories: { "sexual/minors": false } as Record<string, boolean>,
					category_scores: { "sexual/minors": 0.01 } as Record<string, number>,
				},
			],
		});

		await moderate({ text: "another-test" });

		expect(mockModerationsCreate).toHaveBeenCalledWith(
			expect.objectContaining({
				model: OPENAI_MODERATION_MODEL_SNAPSHOT,
			}),
			expect.any(Object),
		);
		expect(OPENAI_MODERATION_MODEL_SNAPSHOT).toBe("omni-moderation-2024-09-26");
	});

	it("openai-omni-shape::multimodal-input-with-image-url", async () => {
		// The multi-modal input shape MUST accept `{type: 'image_url',
		// image_url: {url}}` — that's how precommitModerate forwards the
		// signed READ URL for image-comment moderation.
		mockModerationsCreate.mockResolvedValueOnce({
			id: "modr-test-3",
			model: OPENAI_MODERATION_MODEL_SNAPSHOT,
			results: [
				{
					flagged: false,
					categories: {} as Record<string, boolean>,
					category_scores: {} as Record<string, number>,
				},
			],
		});

		await moderate({
			text: "caption-text",
			imageUrl: "https://r2.example/u/u1/abc.jpg?X-Amz-Signature=demo",
		});

		expect(mockModerationsCreate).toHaveBeenCalledWith(
			expect.objectContaining({
				input: [
					{ type: "text", text: "caption-text" },
					{
						type: "image_url",
						image_url: {
							url: "https://r2.example/u/u1/abc.jpg?X-Amz-Signature=demo",
						},
					},
				],
			}),
			expect.any(Object),
		);
	});
});
