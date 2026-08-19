// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
	usePathname: () => "/",
	// HeaderNav's Back control.
	useRouter: () => ({ back: () => {}, push: () => {} }),
}));

import { GitHubStarsView } from "@/components/shell/GitHubStars";
import { GlobalHeader } from "@/components/shell/GlobalHeader";

/**
 * GH-STAR — the header's GitHub control, and the one contract that carries the
 * whole task: **`0` and "unavailable" are different renders.**
 *
 * ⛔ TESTS 1 AND 3 ARE AN ACCEPTANCE PAIR AND MUST BE READ TOGETHER. `0` is
 * falsy, so a `!stars` branch renders the failure state on a genuine zero — and
 * this repo has zero stars today, which means the bug would ship looking
 * correct. Test 1 alone passes against a `stars === null` implementation AND
 * against nothing else; test 3 alone passes against `!stars` (a real zero and a
 * real failure both drop the node). Only together do they pin the branch:
 * test 1 demands the node EXISTS at `0`, test 3 demands it is ABSENT at `null`,
 * and no truthiness check can satisfy both.
 *
 * Plain-DOM assertions — there is no `jest-dom` in this repo (AGENTS.md §9), so
 * `toBeInTheDocument()` and that matcher family are unavailable.
 */

afterEach(cleanup);

const COUNT = '[data-testid="github-stars-count"]';

describe("GH-STAR GitHubStarsView — the 0-vs-null contract", () => {
	it("⭐ stars=0 renders a count node reading `0` (0 is a VALUE)", () => {
		render(<GitHubStarsView stars={0} />);
		const el = screen.getByTestId("github-stars");

		const count = el.querySelector(COUNT);
		expect(count, "the count node must exist at a genuine zero").not.toBeNull();
		expect(count?.textContent).toBe("0");
		expect(el.getAttribute("data-state")).toBe("value");
	});

	it("stars=1234 renders a GROUPED number, never a compact `1.2k`", () => {
		render(<GitHubStarsView stars={1234} />);
		const el = screen.getByTestId("github-stars");

		expect(el.querySelector(COUNT)?.textContent).toBe("1,234");
		expect(el.textContent).toContain("1,234");
		expect(el.textContent).not.toContain("1.2k");
		expect(el.getAttribute("data-state")).toBe("value");
	});

	it("⭐ stars=null renders NO count node, and the link + label survive", () => {
		render(<GitHubStarsView stars={null} />);
		const el = screen.getByTestId("github-stars");

		// The BODY's absence, not merely a different value: an empty span, a
		// placeholder dash or a rendered `0` would all fail here.
		expect(el.querySelectorAll(COUNT).length).toBe(0);
		expect(el.getAttribute("data-state")).toBe("unavailable");

		// The control itself is unaffected by a failed read.
		expect(el.tagName).toBe("A");
		expect(el.textContent).toContain("GitHub");
		expect(el.getAttribute("href")).toContain("github.com");
	});

	it("links off-site safely — target=_blank with BOTH rel tokens", () => {
		render(<GitHubStarsView stars={7} />);
		const el = screen.getByTestId("github-stars");

		expect(el.getAttribute("href")).toBe(
			"https://github.com/zugzwang-foundation/experiment",
		);
		expect(el.getAttribute("target")).toBe("_blank");
		const rel = el.getAttribute("rel") ?? "";
		expect(rel).toContain("noopener");
		expect(rel).toContain("noreferrer");
		// The new-tab behaviour is announced, not left to the visual affordance.
		expect(el.getAttribute("aria-label")).toContain("new tab");
	});

	it("the star glyph is decorative — rendered and aria-hidden", () => {
		render(<GitHubStarsView stars={0} />);
		const svg = screen.getByTestId("github-stars").querySelector("svg");

		expect(svg).not.toBeNull();
		expect(svg?.getAttribute("aria-hidden")).toBe("true");
	});
});

/**
 * ⛔ THE POSITIVE CONTROL FOR THE WIRING, AND IT EXISTS BECAUSE THE OBVIOUS
 * GREEN TICK IS A FALSE RECEIPT.
 *
 * `GlobalHeader` takes `stars` as a prop rather than mounting an async child,
 * because an async component anywhere in this tree makes the whole header
 * unrenderable in jsdom. The test that caught that — `dharma-cluster.test.tsx` —
 * now passes again. But it passes while rendering the header with NO `stars`
 * prop at all, so it exercises the default and proves only that the header
 * stopped crashing. Delete the prop from `GlobalHeader`'s JSX and that suite
 * stays green, the build stays green, and the control renders "no count" on
 * every route forever — which is indistinguishable from a failed GitHub read,
 * the one confusion this task exists to eliminate.
 *
 * So the wiring needs a test that can only pass if a REAL value survives the
 * whole path: layout → `GlobalHeader` → `GitHubStarsView` → the DOM. Nothing
 * above asserts that; `dharma-cluster.test.tsx` cannot, and the view tests above
 * bypass the header entirely by rendering the view directly.
 */
describe("GH-STAR wiring — the prop survives GlobalHeader", () => {
	beforeEach(() => {
		// VisitorCounter POSTs /api/visits on mount.
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => ({ json: async () => ({ total: 1 }) })),
		);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("⭐ stars=42 reaches the DOM, positioned between Radio and RULES", () => {
		render(<GlobalHeader viewer={null} stars={42} />);

		const count = document.querySelector(COUNT);
		expect(count, "the `stars` prop never reached the view").not.toBeNull();
		expect(count?.textContent).toBe("42");

		const control = screen.getByTestId("github-stars");
		const kids = Array.from(control.parentElement?.children ?? []);
		const radio = kids.findIndex(
			(el) => el.getAttribute("aria-label") === "Radio",
		);
		const rules = kids.findIndex(
			(el) => el.tagName === "BUTTON" && el.textContent === "Rules",
		);
		const github = kids.indexOf(control);

		// ⚠ EACH INDEX IS PROVEN FOUND BEFORE ANY OF THEM IS COMPARED. `findIndex`
		// returns -1 for a node that is not there, and `-1 < 0` is TRUE — so an
		// ordering assertion can be satisfied by a control that never rendered.
		// The header regression this file's sibling caught surfaced as exactly
		// that shape (`expected -1 to be less than -1`).
		expect(radio, "RadioSlot").toBeGreaterThanOrEqual(0);
		expect(github, "the GitHub control").toBeGreaterThanOrEqual(0);
		expect(rules, "RulesControl").toBeGreaterThanOrEqual(0);

		expect(radio).toBeLessThan(github);
		expect(github).toBeLessThan(rules);
	});
});
