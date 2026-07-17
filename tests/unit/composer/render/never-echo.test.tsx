// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BetComposer } from "@/components/debate/composer/BetComposer";
import {
	C1_PROTECTIVE_LANDING,
	COMPOSER_COPY,
	STATE_COPY,
} from "@/components/debate/composer/copy";

import { composerProps, stubWireFetch, TITLE, wireError } from "./_harness";

/**
 * OQ-7c R-2 — NEVER-ECHO (SG-3): a sentinel argument driven through the
 * composer into the Track-B / generic / protective-landing states appears in
 * the DOM ONLY as the input/textarea value — never in any strip, modal, or
 * status text. The queued wire envelopes carry the sentinel INSIDE the
 * error `message` field (the hostile case: a server echo), so the assertion
 * proves the client renders copy.ts strings only.
 */

vi.mock("next/navigation", () => ({
	useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

const SENTINEL = `${TITLE} [never-echo-sentinel]`;
const SENTINEL_EXTENDED = `${SENTINEL} extended`;

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
	vi.clearAllMocks();
});

function typeAndSubmit() {
	fireEvent.change(screen.getByLabelText<HTMLInputElement>("Argument title"), {
		target: { value: SENTINEL },
	});
	fireEvent.change(
		screen.getByLabelText<HTMLTextAreaElement>("Argument body"),
		{ target: { value: SENTINEL_EXTENDED } },
	);
	fireEvent.click(screen.getByRole("button", { name: COMPOSER_COPY.submit }));
}

/** The rendered text with the two entry fields removed (React implements a
 * controlled textarea's value as its child text, so the fields must be cut
 * from the sweep — they are the ONLY place the sentinel may live). */
function textOutsideTheEntryFields(): string {
	const clone = document.body.cloneNode(true);
	if (!(clone instanceof HTMLElement)) {
		throw new Error("cloneNode returned a non-element body");
	}
	for (const field of clone.querySelectorAll("input, textarea")) {
		field.remove();
	}
	return clone.textContent ?? "";
}

function expectSentinelOnlyInInputs() {
	expect(textOutsideTheEntryFields()).not.toContain(SENTINEL);
	expect(screen.getByLabelText<HTMLInputElement>("Argument title").value).toBe(
		SENTINEL,
	);
	expect(
		screen.getByLabelText<HTMLTextAreaElement>("Argument body").value,
	).toBe(SENTINEL_EXTENDED);
}

describe("BetComposer never echoes the argument (R-2)", () => {
	it("render::track-b-state-never-echoes-the-sentinel", async () => {
		stubWireFetch([
			{
				status: 422,
				body: wireError("comment_track_b_blocked", {
					message: `moderation echo: ${SENTINEL}`,
				}),
			},
		]);
		render(<BetComposer {...composerProps()} />);
		typeAndSubmit();
		await screen.findByText(STATE_COPY.trackB.title);
		expectSentinelOnlyInInputs();
	});

	it("render::generic-state-never-echoes-the-sentinel", async () => {
		stubWireFetch([
			{
				status: 400,
				body: wireError("insufficient_dharma", {
					message: `wire echo: ${SENTINEL}`,
				}),
			},
		]);
		render(<BetComposer {...composerProps()} />);
		typeAndSubmit();
		await screen.findByText(STATE_COPY.generic.title);
		expectSentinelOnlyInInputs();
	});

	it("render::protective-landing-state-never-echoes-the-sentinel", async () => {
		stubWireFetch([
			{
				status: 409,
				body: wireError("error_idempotency_key_reused", {
					message: `wire echo: ${SENTINEL}`,
				}),
			},
		]);
		render(<BetComposer {...composerProps()} />);
		typeAndSubmit();
		await screen.findByText(C1_PROTECTIVE_LANDING.title);
		expectSentinelOnlyInInputs();
	});
});
