import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// AUDIT-FIX-B1 A6 (ruling #4) tests-first — OpenAI vendor-boundary captures in
// `src/server/moderation/openai.ts`. Three edits, all at the vendor boundary:
//   1. auth arm  → capture kind `openai_moderation_auth_failure` + REMOVE the
//      TODO `console.error` (byte-identical tag per §17.2 row 4).
//   2. non-transient arm → capture kind `openai_moderation_upstream_failure`.
//   3. retries-exhausted arm → same tag with the LAST error.
// Fail-closed `ModerationUnavailableError` flow is byte-identical; a transient-
// then-success retry captures NOTHING.
//
// RED reason (extension of an EXISTING module): `moderate` imports fine →
// ASSERTION-RED. Pre-impl the auth arm calls `console.error("openai_moderation_
// auth_failure", err)` and NO captureException fires anywhere, so the capture
// assertions fail (0 calls) and the "no console.error" assertion fails. The
// transient-then-success case is a GREEN regression guard (zero captures, verdict
// unchanged).
//
// The `openai` module is mocked with `...actual` (the _probe-openai-omni-shape
// pattern) so the SUT's `instanceof` discriminators run against the REAL error
// classes; `moderations.create` is a controllable spy. `@sentry/nextjs` is the
// mocked vendor boundary (post-impl safeCaptureException routes here).

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

// getClient() validates OPENAI_API_KEY at first call (not module load).
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? "sk-test-capture";

import {
	APIConnectionError,
	AuthenticationError,
	InternalServerError,
} from "openai";
import { ModerationUnavailableError } from "@/lib/errors";
import { moderate } from "@/server/moderation/openai";

// Construct a REAL-classed error instance without coupling to the vendor's
// constructor signature: Object.create sets the prototype chain so the SUT's
// `instanceof` discriminators match, and we assert the SAME object is captured.
function openAiError<T>(Ctor: new (...args: never[]) => T, message: string): T {
	const e = Object.create((Ctor as { prototype: object }).prototype) as T & {
		message: string;
		name: string;
	};
	e.message = message;
	e.name = (Ctor as unknown as { name: string }).name;
	return e as T;
}

let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

describe("AUDIT-FIX-B1 A6 — OpenAI moderation vendor-boundary captures", () => {
	beforeEach(() => {
		mockCreate.mockReset();
		mockCaptureException.mockReset();
		mockCaptureMessage.mockReset();
		consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
	});
	afterEach(() => {
		consoleErrorSpy.mockRestore();
		vi.clearAllMocks();
	});

	it("openai-capture::auth-failure-captures-auth-tag-no-console-error", async () => {
		const err = openAiError(AuthenticationError, "401 invalid api key");
		mockCreate.mockRejectedValue(err);

		await expect(moderate({ text: "hi" })).rejects.toBeInstanceOf(
			ModerationUnavailableError,
		);

		expect(mockCaptureException).toHaveBeenCalledTimes(1);
		expect(mockCaptureException).toHaveBeenCalledWith(err, {
			tags: { kind: "openai_moderation_auth_failure" },
		});
		// The TODO console.error is REPLACED by the capture — it must not fire.
		expect(consoleErrorSpy).not.toHaveBeenCalled();
		// Auth failures never retry.
		expect(mockCreate).toHaveBeenCalledTimes(1);
	});

	it("openai-capture::non-transient-captures-upstream-tag", async () => {
		const err = new Error("weird non-transient failure");
		mockCreate.mockRejectedValue(err);

		await expect(moderate({ text: "hi" })).rejects.toBeInstanceOf(
			ModerationUnavailableError,
		);

		expect(mockCaptureException).toHaveBeenCalledTimes(1);
		expect(mockCaptureException).toHaveBeenCalledWith(err, {
			tags: { kind: "openai_moderation_upstream_failure" },
		});
		// Non-transient → thrown immediately, no retry.
		expect(mockCreate).toHaveBeenCalledTimes(1);
	});

	it("openai-capture::retries-exhausted-captures-upstream-tag-with-last-error", async () => {
		const first = openAiError(InternalServerError, "500 #1");
		const last = openAiError(InternalServerError, "500 #2");
		mockCreate.mockRejectedValueOnce(first).mockRejectedValueOnce(last);

		await expect(moderate({ text: "hi" })).rejects.toBeInstanceOf(
			ModerationUnavailableError,
		);

		// OPENAI_MAX_RETRIES = 1 → 2 attempts, then the terminal capture with lastErr.
		expect(mockCreate).toHaveBeenCalledTimes(2);
		expect(mockCaptureException).toHaveBeenCalledTimes(1);
		expect(mockCaptureException).toHaveBeenCalledWith(last, {
			tags: { kind: "openai_moderation_upstream_failure" },
		});
	});

	// GREEN regression guard: a transient that later succeeds captures NOTHING and
	// returns the verdict unchanged (byte-identical behaviour on the success path).
	it("openai-capture::transient-then-success-captures-nothing", async () => {
		const transient = openAiError(APIConnectionError, "connection reset");
		mockCreate.mockRejectedValueOnce(transient).mockResolvedValueOnce({
			results: [
				{
					flagged: false,
					categories: { "sexual/minors": false, sexual: false },
					category_scores: { "sexual/minors": 0.01, sexual: 0.02 },
				},
			],
		});

		const result = await moderate({ text: "hi" });

		expect(result).toEqual({
			flagged: false,
			categories: { "sexual/minors": false, sexual: false },
			scores: { "sexual/minors": 0.01, sexual: 0.02 },
		});
		expect(mockCaptureException).not.toHaveBeenCalled();
		expect(consoleErrorSpy).not.toHaveBeenCalled();
		expect(mockCreate).toHaveBeenCalledTimes(2);
	});
});
