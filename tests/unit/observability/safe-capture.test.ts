import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// AUDIT-FIX-B1 §0 (ruling #8) tests-first — the `safeCapture` fail-open wrappers
// (greenfield `src/server/observability/safe-capture.ts`). Two thin try/catch
// wrappers around `@sentry/nextjs` `captureException` / `captureMessage`, each
// returning `boolean` (true iff the SDK call did NOT throw) and NEVER propagating
// an SDK throw (§17.5 capture fail-open).
//
// RED reason: GREENFIELD module — this file is COLLECTION-RED ("Cannot find
// module '@/server/observability/safe-capture'") until the implementer lands the
// module. The vendor boundary (`@sentry/nextjs`) is mocked — NOT the wrapper — so
// the try/catch + exact passthrough are exercised directly post-impl.

const { mockCaptureException, mockCaptureMessage, mockFlush } = vi.hoisted(
	() => ({
		mockCaptureException: vi.fn(),
		mockCaptureMessage: vi.fn(),
		mockFlush: vi.fn(),
	}),
);
vi.mock("@sentry/nextjs", () => ({
	captureException: mockCaptureException,
	captureMessage: mockCaptureMessage,
	flush: mockFlush,
}));

import {
	safeCaptureException,
	safeCaptureMessage,
	safeFlush,
} from "@/server/observability/safe-capture";

describe("safeCapture — fail-open Sentry wrappers (§17.5)", () => {
	beforeEach(() => {
		mockCaptureException.mockReset();
		mockCaptureMessage.mockReset();
		mockFlush.mockReset();
	});
	afterEach(() => {
		vi.clearAllMocks();
	});

	it("safe-capture::exception-success-returns-true-and-passes-through", () => {
		const err = new Error("boom");
		const ctx = { tags: { kind: "bet_handler_internal_error" } };
		const result = safeCaptureException(err, ctx);
		expect(result).toBe(true);
		expect(mockCaptureException).toHaveBeenCalledTimes(1);
		// Exact (err, ctx) passthrough to the SDK.
		expect(mockCaptureException).toHaveBeenCalledWith(err, ctx);
	});

	it("safe-capture::exception-sdk-throw-returns-false-never-propagates", () => {
		mockCaptureException.mockImplementation(() => {
			throw new Error("sentry down");
		});
		const err = new Error("boom");
		const ctx = { tags: { kind: "r2_unavailable" } };
		let result: boolean | undefined;
		// The SDK throw must be swallowed — capture fail-open.
		expect(() => {
			result = safeCaptureException(err, ctx);
		}).not.toThrow();
		expect(result).toBe(false);
	});

	it("safe-capture::message-success-returns-true-and-passes-through", () => {
		const ctx = {
			level: "error" as const,
			tags: { alarm_id: "dharma_chain_drift" },
			extra: { count: 1 },
		};
		const result = safeCaptureMessage("dharma_chain_drift", ctx);
		expect(result).toBe(true);
		expect(mockCaptureMessage).toHaveBeenCalledTimes(1);
		// Exact (name, ctx) passthrough to the SDK.
		expect(mockCaptureMessage).toHaveBeenCalledWith("dharma_chain_drift", ctx);
	});

	it("safe-capture::message-sdk-throw-returns-false-never-propagates", () => {
		mockCaptureMessage.mockImplementation(() => {
			throw new Error("sentry down");
		});
		let result: boolean | undefined;
		expect(() => {
			result = safeCaptureMessage("events_default_nonempty", {
				level: "error",
				extra: { count: 5 },
			});
		}).not.toThrow();
		expect(result).toBe(false);
	});

	it("safe-capture::flush-confirmed-returns-true-and-passes-timeout", async () => {
		mockFlush.mockResolvedValue(true);
		const result = await safeFlush(2000);
		expect(result).toBe(true);
		expect(mockFlush).toHaveBeenCalledWith(2000);
	});

	it("safe-capture::flush-timeout-resolves-false-returns-false", async () => {
		// Sentry.flush resolves `false` when the transport did not drain within
		// the budget — the drain must treat that as not-flushed (stamp nothing).
		mockFlush.mockResolvedValue(false);
		await expect(safeFlush(2000)).resolves.toBe(false);
	});

	it("safe-capture::flush-reject-returns-false-never-propagates", async () => {
		// A flush REJECT must be swallowed — treated as not-flushed (fail-open
		// §17.5), so the drain stamps nothing and the cron route never breaks.
		mockFlush.mockRejectedValue(new Error("sentry transport exploded"));
		await expect(safeFlush(2000)).resolves.toBe(false);
	});
});
