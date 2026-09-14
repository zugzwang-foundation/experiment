// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BetComposer } from "@/components/debate/composer/BetComposer";

import { composerProps, stubWireFetch } from "./_harness";

/**
 * FLAGS-1 — the `image-attach-enabled` KILL SWITCH on the composer's attach
 * affordance (ADR-0052, consuming ADR-0007's `useFlag` runtime contract).
 *
 * ⛔ WHAT THE SWITCH IS FOR. Image attach is the highest-risk surface in the
 * launch window: it spends R2 storage, and it is the one path by which a
 * participant can put an image the operator did not choose in front of other
 * participants. The brake lets the operator take that path away in seconds from
 * the PostHog UI, leaving text-only posting — which is the product's core —
 * untouched. It is NOT a security control: a client flag hides an affordance, it
 * does not refuse a crafted request. `POST /api/uploads/sign` is unchanged.
 *
 * ⛔⛔ THE DEFECT THIS FILE EXISTS TO PREVENT, AND WHY IT IS NOT OBVIOUS.
 * `BetComposer`'s argument region is `grid-cols-[2fr_3fr]` with the attach
 * affordance as its FIRST track. Removing ONLY the child leaves the track — so
 * the composer would render ~40% of its width as blank space, and every
 * assertion about the fields column would still pass. This is the same shape as
 * `RESO-1 · R-4` / `CRIT-1`, where `MarketPriceChartHost` returned `null` inside
 * a 340px rail its caller had already decided to draw. The lesson those carry is
 * that the child and the track it sits in must come from ONE decision; here
 * `BetComposer` owns both, which is exactly why the gate lives there and not
 * inside `ImageAttach`.
 * ⇒ `render::grid-collapses-to-one-track-when-killed` is the assertion that
 * catches it. A test that only asserted the control's absence would pass against
 * the empty-column build.
 *
 * ⚠ POLARITY. The flag is named for the FEATURE, not for the brake
 * (`image-attach-enabled`, default `true`) — so an unreachable PostHog, a flag
 * that was never created, and a flag still loading all coerce to "feature on".
 * ADR-0007's "`defaultValue` MUST encode the safe behaviour — typically feature
 * disabled" is written for an OPT-IN new feature; for a brake on already-shipped
 * behaviour it inverts, because defaulting to off would let a vendor outage
 * silently strip working parts of the product. `_probe-useflag-no-provider`
 * pins the vendor half of that.
 *
 * `O-7` — assertions read the DOM tree and the `class` attribute, never
 * `textContent`: an arrangement lives in the markup.
 */

/**
 * The flag value the mocked vendor hook reports.
 *
 * `undefined` is the REAL default in every other suite in this directory (no
 * provider, no initialised singleton), so it is the value the control case uses
 * — asserting against the state the rest of the repo actually renders in,
 * rather than a `true` nobody ever produces.
 */
const flag = vi.hoisted(() => ({
	current: undefined as boolean | undefined,
}));

vi.mock("posthog-js/react", () => ({
	useFeatureFlagEnabled: () => flag.current,
}));

vi.mock("next/navigation", () => ({
	useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

beforeEach(() => {
	flag.current = undefined;
});

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
	vi.clearAllMocks();
});

/**
 * The grid's COLUMN children. The hidden `<input type="file">` is
 * `display:none` and generates no grid track, so it is not a column — the same
 * carve-out `composer-grid.test.tsx` makes, restated here rather than imported
 * so the two files can disagree loudly if the markup changes.
 */
function columnsOf(grid: Element): Element[] {
	return Array.from(grid.children).filter(
		(el) => !el.matches('input[type="file"]'),
	);
}

function renderComposer(): { section: Element } {
	stubWireFetch([]);
	const { container } = render(<BetComposer {...composerProps()} />);
	const section = container.querySelector("section");
	if (section === null) {
		throw new Error("BetComposer rendered no <section> root");
	}
	return { section };
}

/**
 * The argument-region grid, found WITHOUT going through the attach affordance.
 *
 * ⛔ `composer-grid.test.tsx` reaches it via `getByLabelText("Attach an image")
 * .parentElement`, which cannot work in the killed case — the element it
 * navigates from is the element under test for absence. Finding the grid by the
 * field it still contains is what lets the same structural question be asked on
 * both sides of the switch.
 */
function gridOf(section: Element): Element {
	const title = screen.getByLabelText("Argument title");
	let node: Element | null = title;
	while (node !== null && node !== section) {
		const cls = node.getAttribute("class") ?? "";
		if (/(?:^|\s)grid(?:\s|$)/.test(cls)) {
			return node;
		}
		node = node.parentElement;
	}
	throw new Error("no grid ancestor between the title field and the section");
}

describe("BetComposer — image-attach kill switch", () => {
	it("render::attach-present-when-the-flag-is-unset", () => {
		const { section } = renderComposer();
		// The control case: this is the state every other composer suite renders
		// in, and it must be byte-for-byte the shipped behaviour.
		const attach = screen.getByLabelText("Attach an image");
		expect(section.contains(attach)).toBe(true);
		expect(columnsOf(gridOf(section))).toHaveLength(2);
	});

	it("render::attach-present-when-the-flag-is-on", () => {
		flag.current = true;
		const { section } = renderComposer();
		expect(section.contains(screen.getByLabelText("Attach an image"))).toBe(
			true,
		);
		expect(columnsOf(gridOf(section))).toHaveLength(2);
	});

	it("render::attach-absent-when-killed", () => {
		flag.current = false;
		renderComposer();
		expect(screen.queryByLabelText("Attach an image")).toBeNull();
		// ⛔ AND THE FILE INPUT WITH IT. The affordance's label is what a user
		// reaches; the `<input type="file">` is what actually opens the picker.
		// Removing only the visible control would leave a programmatically
		// reachable upload path behind a switch the operator believes is off.
		expect(document.querySelector('input[type="file"]')).toBeNull();
	});

	it("render::grid-collapses-to-one-track-when-killed", () => {
		flag.current = false;
		const { section } = renderComposer();
		const grid = gridOf(section);
		// ONE column child — not two with an empty first track.
		expect(columnsOf(grid)).toHaveLength(1);
		// ⛔ AND THE TRACK TEMPLATE ITSELF. The child count above is satisfied by
		// a build that drops the child and keeps `grid-cols-[2fr_3fr]`, which is
		// precisely the empty-column defect: the fields would sit in the 3fr
		// track with 2fr of blank to their left. The class is the mechanism.
		const cls = grid.getAttribute("class") ?? "";
		expect(cls).not.toMatch(/grid-cols-\[2fr_3fr\]/);
	});

	it("render::fields-and-submit-survive-the-kill", () => {
		flag.current = false;
		const { section } = renderComposer();
		// The regression belt: killing the image path must cost nothing else.
		// Posting text-only is the product's core, not a degraded mode.
		for (const label of [
			"Argument title",
			"Argument body",
			"Stake amount",
			"PLACE Đ BET",
			"Close",
		]) {
			expect(section.contains(screen.getByLabelText(label))).toBe(true);
		}
	});
});
