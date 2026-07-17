// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BetComposer } from "@/components/debate/composer/BetComposer";
import {
	C1_PROTECTIVE_LANDING,
	COMPOSER_COPY,
} from "@/components/debate/composer/copy";

import { composerProps, stubWireFetch, TITLE, wireError } from "./_harness";

/**
 * OQ-7c R-5 — C1 LANDING: the F-2 protective landing
 * (`error_idempotency_key_reused`) renders the C1 title + body verbatim
 * (copy.ts import); submit renders disabled in that state; the view
 * refreshes to show the committed bet; and NO auto-resubmit affordance
 * exists — exactly one bet-endpoint call ever leaves the composer.
 */

const routerSpies = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({
	useRouter: () => routerSpies,
}));

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
	vi.clearAllMocks();
});

describe("BetComposer C1 protective landing (R-5)", () => {
	it("render::c1-copy-verbatim-submit-disabled-no-auto-resubmit", async () => {
		const fetchStub = stubWireFetch([
			{ status: 409, body: wireError("error_idempotency_key_reused") },
		]);
		render(<BetComposer {...composerProps()} />);
		fireEvent.change(
			screen.getByLabelText<HTMLInputElement>("Argument title"),
			{ target: { value: TITLE } },
		);
		fireEvent.click(screen.getByRole("button", { name: COMPOSER_COPY.submit }));
		await screen.findByText(C1_PROTECTIVE_LANDING.title);
		expect(screen.getByText(C1_PROTECTIVE_LANDING.title).textContent).toBe(
			C1_PROTECTIVE_LANDING.title,
		);
		expect(screen.getByText(C1_PROTECTIVE_LANDING.body).textContent).toBe(
			C1_PROTECTIVE_LANDING.body,
		);
		// Submit renders disabled under the landing (terminal-locked until the
		// next edit mints the NEW intent — F-2).
		expect(
			screen
				.getByRole("button", { name: COMPOSER_COPY.submit })
				.hasAttribute("disabled"),
		).toBe(true);
		// The landing REFRESHES to show the committed state…
		expect(routerSpies.refresh).toHaveBeenCalledTimes(1);
		// …but never resubmits: exactly ONE bet-endpoint call, and no
		// retry/resubmit affordance anywhere in the tree.
		const betCalls = fetchStub.mock.calls.filter((call) =>
			String(call[0]).includes("/api/bets/"),
		);
		expect(betCalls).toHaveLength(1);
		expect(
			screen.queryByRole("button", { name: /retry|try again|resubmit/i }),
		).toBeNull();
	});
});
