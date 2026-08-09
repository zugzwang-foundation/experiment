// @vitest-environment jsdom

// SPDX-License-Identifier: AGPL-3.0-or-later

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { StatLine } from "@/components/discovery/StatLine";

/**
 * POLISH.2 V48 + V28 — the stat line's two behavioural properties.
 *
 * V48 (pluralisation) is the one that needed a test: `1 posts` is a defect
 * already carried in the register (POLISH-register-ADDITIONS.md:61, routed
 * "POLISH.3 · POLISH.2"), and NO existing suite could catch it — every
 * discovery fixture on disk uses counts of 28/68/2/0, all of which take the
 * plural form. The bug was structurally invisible, exactly the shape of
 * POLISH-1a's Surprise 1: a green suite that cannot see the case.
 *
 * V28 (per-surface sizing) is asserted through `data-size` rather than the
 * class string, so the preset can be re-tuned at D2b without a test edit.
 *
 * The Đ value itself is NOT re-pinned here — `market-card.test.tsx:69` and
 * `hero-panels.test.tsx:109` already own that assertion against the shared
 * `formatDharma`, and a third copy would drift.
 */

afterEach(cleanup);

const totals = (postCount: number, replyCount: number) => ({
	dharmaStaked: "14260.000000000000000000",
	postCount,
	replyCount,
});

describe("POLISH.2 — StatLine", () => {
	it("statline::singular-count-takes-singular-noun", () => {
		render(<StatLine totals={totals(1, 1)} />);

		const text = screen.getByTestId("stat-line").textContent ?? "";
		expect(text).toContain("1 post");
		expect(text).toContain("1 reply");
		// The failure mode this exists for.
		expect(text).not.toContain("1 posts");
		expect(text).not.toContain("1 replies");
	});

	it("statline::plural-and-zero-counts-take-plural-noun", () => {
		render(<StatLine totals={totals(28, 0)} />);

		const text = screen.getByTestId("stat-line").textContent ?? "";
		expect(text).toContain("28 posts");
		// Zero is plural in English — `0 reply` would be the over-correction.
		expect(text).toContain("0 replies");
	});

	it("statline::size-preset-defaults-to-card-and-hero-is-opt-in", () => {
		const { rerender } = render(<StatLine totals={totals(2, 2)} />);
		expect(screen.getByTestId("stat-line").getAttribute("data-size")).toBe(
			"card",
		);

		rerender(<StatLine totals={totals(2, 2)} size="hero" />);
		expect(screen.getByTestId("stat-line").getAttribute("data-size")).toBe(
			"hero",
		);
	});
});
