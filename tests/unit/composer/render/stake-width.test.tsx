// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BetComposer } from "@/components/debate/composer/BetComposer";

import { composerProps, stubWireFetch } from "./_harness";

/**
 * POLISH.4 PR B · R2 — the Đ GLYPH TRAVELS WITH THE DIGITS.
 *
 * Tier-4 baseline: `docs/design/mockups/surface_d5_v1_0.html`
 * (md5 34619dacee472a245cb6e8678b509219) —
 *   `.amtval{display:flex;align-items:center;justify-content:flex-end}` (:721)
 *   `.amtval input{…width:3ch;min-width:2ch}`
 *      with the source comment *"width JS-managed: tracks content so Đ travels
 *      with the digits"*                                              (:723-726)
 *   `function sizeAmt(inp){inp.style.width=Math.max(2,(inp.value||'').length)
 *      +'ch';}`                                                       (:1449)
 *   called on init and on every `input` event                     (:1454, 1457)
 *
 * The built composer pins the stake input at a FIXED `w-28` with `text-right`
 * (`BetComposer.tsx`, the `aria-label="Stake amount"` Input), so the `Đ` span
 * sits at a constant distance from the field's left edge and NEVER moves. Red
 * at `8db535d`: `input.style.width` is the empty string on mount and after
 * every edit.
 *
 * ⛔ The `ch` UNIT and the `Math.max(2, …)` FLOOR are the mockup's mechanism,
 * not a design value — no px, colour, radius, type size, duration or easing is
 * asserted here.
 *
 * `O-7` — the class assertion reads the `class` attribute, never
 * `textContent`; a fixed-width class is invisible to `textContent`.
 */

vi.mock("next/navigation", () => ({
	useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
	vi.clearAllMocks();
});

/** 1 char — under the `Math.max(2, …)` floor. Below the post floor, which
 *  disables SUBMIT but never the field: the width must still track. */
const ONE_CHAR = "5";
/** 7 chars — inside `spendableToday` (100), so no clamp/over-cap noise. */
const SEVEN_CHARS = "99.9999";

function renderComposer(): HTMLInputElement {
	stubWireFetch([]);
	render(<BetComposer {...composerProps()} />);
	return screen.getByLabelText<HTMLInputElement>("Stake amount");
}

describe("BetComposer stake input — the Đ travels with the digits (R2)", () => {
	it("render::stake-width-tracks-the-typed-digits", () => {
		const stake = renderComposer();

		fireEvent.change(stake, { target: { value: ONE_CHAR } });
		expect(stake.value).toBe(ONE_CHAR);
		const short = stake.style.width;
		expect(short).toBe("2ch");

		fireEvent.change(stake, { target: { value: SEVEN_CHARS } });
		expect(stake.value).toBe(SEVEN_CHARS);
		const long = stake.style.width;
		expect(long).toBe("7ch");

		// The travel itself: a long value is not the same width as a short one.
		expect(long).not.toBe(short);
	});

	it("render::stake-width-floors-at-two-characters", () => {
		const stake = renderComposer();
		// `Math.max(2, (inp.value||'').length)` — an emptied field holds 2ch.
		fireEvent.change(stake, { target: { value: "" } });
		expect(stake.value).toBe("");
		expect(stake.style.width).toBe("2ch");
	});

	it("render::stake-input-drops-the-fixed-width-class", () => {
		const stake = renderComposer();
		const cls = stake.getAttribute("class") ?? "";
		// A fixed width pins the Đ in place — the two are mutually exclusive.
		expect(cls).not.toMatch(/(?:^|\s)w-28(?:\s|$)/);
	});
});
