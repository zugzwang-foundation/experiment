// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BetComposer } from "@/components/debate/composer/BetComposer";
import { COMPOSER_COPY, STATE_COPY } from "@/components/debate/composer/copy";

import {
	composerProps,
	EXTENDED,
	stubWireFetch,
	TITLE,
	wireError,
} from "./_harness";

/**
 * OQ-7c R-3 — PRESERVED: after every revise/retry-class error (Track-B
 * revise · gate-down retry · transient retry), the title + extended inputs
 * still hold the typed sentinel and re-enable for the revision — the
 * argument is never destroyed by an error render.
 */

vi.mock("next/navigation", () => ({
	useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

const SENTINEL_TITLE = `${TITLE} [preserved-sentinel]`;
const SENTINEL_EXTENDED = `${EXTENDED} [preserved-sentinel]`;

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
	vi.clearAllMocks();
});

function typeAndSubmit() {
	fireEvent.change(screen.getByLabelText<HTMLInputElement>("Argument title"), {
		target: { value: SENTINEL_TITLE },
	});
	fireEvent.change(
		screen.getByLabelText<HTMLTextAreaElement>("Argument body"),
		{ target: { value: SENTINEL_EXTENDED } },
	);
	fireEvent.click(screen.getByRole("button", { name: COMPOSER_COPY.submit }));
}

function expectInputsPreservedAndEditable() {
	const title = screen.getByLabelText<HTMLInputElement>("Argument title");
	const extended = screen.getByLabelText<HTMLTextAreaElement>("Argument body");
	expect(title.value).toBe(SENTINEL_TITLE);
	expect(extended.value).toBe(SENTINEL_EXTENDED);
	// The revise/retry classes leave the fields live for the next attempt.
	expect(title.disabled).toBe(false);
	expect(extended.disabled).toBe(false);
}

describe("BetComposer preserves typed inputs across errors (R-3)", () => {
	it("render::track-b-revise-preserves-the-typed-argument", async () => {
		stubWireFetch([
			{ status: 422, body: wireError("comment_track_b_blocked") },
		]);
		render(<BetComposer {...composerProps()} />);
		typeAndSubmit();
		await screen.findByText(STATE_COPY.trackB.title);
		expectInputsPreservedAndEditable();
	});

	it("render::gate-down-retry-preserves-the-typed-argument", async () => {
		stubWireFetch([
			{ status: 503, body: wireError("error_moderation_unavailable") },
		]);
		render(<BetComposer {...composerProps()} />);
		typeAndSubmit();
		await screen.findByText(STATE_COPY.gateDown.title);
		expectInputsPreservedAndEditable();
	});

	it("render::transient-retry-preserves-the-typed-argument", async () => {
		stubWireFetch([
			{ status: 503, body: wireError("error_bet_serialization_exhausted") },
		]);
		render(<BetComposer {...composerProps()} />);
		typeAndSubmit();
		await screen.findByText(STATE_COPY.transient.title);
		expectInputsPreservedAndEditable();
	});
});
