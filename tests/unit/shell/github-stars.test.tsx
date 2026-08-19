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

	it("stars=1234 renders a COMPACT `1.2k`, never a grouped `1,234`", () => {
		render(<GitHubStarsView stars={1234} />);
		const el = screen.getByTestId("github-stars");

		expect(el.querySelector(COUNT)?.textContent).toBe("1.2k");
		expect(el.textContent).toContain("1.2k");
		// ⚠ The negative assertion is the one that INVERTED at GH-STAR-COMPACT;
		// it survives pointed the other way rather than being dropped, because it
		// is what fails if the formatter is reverted to the grouped one. The
		// aria-label still carries `1,234` — as an attribute, which `textContent`
		// does not read, so this stays a real assertion and not a false green.
		expect(el.textContent).not.toContain("1,234");
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
 * GH-STAR-COMPACT — the count is compact at or above 1,000 and exact below it,
 * founder-ruled 2026-08-19 against GitHub's own threshold, so a reader who
 * clicks through finds the number in the same shape on the far side of the link.
 *
 * ⛔ 999 AND 1000 ARE AN ACCEPTANCE PAIR AND MUST BE READ TOGETHER, for the same
 * reason tests 1 and 3 above are. Either alone is satisfied by a formatter that
 * is compact EVERYWHERE or exact EVERYWHERE — `999` passes against a formatter
 * that never abbreviates, `1000` passes against one that always does. Only the
 * pair pins the turn to 1,000 itself.
 *
 * The screen and the label deliberately disagree, and the last test here is what
 * keeps them disagreeing: the width pressure that buys compact notation applies
 * to the control, never to an announced string, so a screen-reader user is not
 * made to trade precision for a constraint they are not under.
 */
describe("GH-STAR-COMPACT — the count's notation", () => {
	const countText = () =>
		screen.getByTestId("github-stars").querySelector(COUNT)?.textContent;

	it("⭐ stars=54321 renders `54.3k` (the ruled example)", () => {
		render(<GitHubStarsView stars={54321} />);

		expect(countText()).toBe("54.3k");
		expect(screen.getByTestId("github-stars").textContent).not.toContain(
			"54,321",
		);
	});

	it("stars=999 renders `999` — exact, one below the threshold", () => {
		render(<GitHubStarsView stars={999} />);

		expect(countText()).toBe("999");
	});

	it("stars=1000 renders `1k` — compact, AT the threshold", () => {
		render(<GitHubStarsView stars={1000} />);

		expect(countText()).toBe("1k");
	});

	it("⭐ the aria-label keeps the EXACT figure — `54,321`, never `54.3k`", () => {
		render(<GitHubStarsView stars={54321} />);
		const label =
			screen.getByTestId("github-stars").getAttribute("aria-label") ?? "";

		expect(label).toContain("54,321");
		expect(label).not.toContain("54.3k");
		// The plural handling predates this change and is unaffected by notation.
		expect(label).toContain("54,321 stars");
	});

	/**
	 * ⚠ ADDITION BEYOND THE RULED TEST LIST — AND THE EVIDENCE FOR A CORRECTION.
	 * The GH-STAR-COMPACT kickoff stated that `Intl` compact TRUNCATES, that
	 * `1999` therefore renders `1.9k`, and asked for that to be written into the
	 * code as deliberate. It ROUNDS: half-expand at one fraction digit, so the
	 * turn sits at `.5` of the leading unit. This pair is the measurement.
	 *
	 * The claim is self-refuting against the ruling's own examples on ANY
	 * runtime, not merely wrong on this one: the single config that truncates is
	 * `roundingMode: "trunc"`, and it renders `999999` as `999.9k` — contradicting
	 * the ruled `1m`, which the last assertion here pins. Every ruled OUTPUT
	 * ships unchanged; only the mechanism's description was corrected.
	 */
	it("ROUNDS half-expand — 1949 → `1.9k`, 1950 → `2k`, 999999 → `1m`", () => {
		render(<GitHubStarsView stars={1949} />);
		expect(countText()).toBe("1.9k");
		cleanup();

		render(<GitHubStarsView stars={1950} />);
		expect(countText(), "a truncating formatter renders 1950 as `1.9k`").toBe(
			"2k",
		);
		cleanup();

		// The magnitude-boundary crossing, and the arithmetic that rules out
		// truncation: `trunc` would render this `999.9k`.
		render(<GitHubStarsView stars={999999} />);
		expect(countText()).toBe("1m");
	});

	/**
	 * ⚠ ADDITION BEYOND THE RULED TEST LIST — THE ONLY GUARD THE LOWERCASE SUFFIX
	 * CAN HAVE. The ruling says the suffix renders lowercase; the tab's own type
	 * register is `uppercase`, and the count escapes it via `normal-case`.
	 *
	 * ⛔ NO `textContent` ASSERTION IN THIS FILE CAN CATCH THAT CLASS GOING AWAY.
	 * `text-transform` paints; it never rewrites `textContent`. So every
	 * assertion above would keep reading `1.2k` and stay green while the header
	 * shipped `1.2K`. Asserted as a class TOKEN, not a substring — the repo has
	 * already been bitten once by a substring class match (`table-fixed` matching
	 * a scan for `fixed`).
	 */
	it("the count opts out of the tab's `uppercase` via `normal-case`", () => {
		render(<GitHubStarsView stars={1234} />);
		const count = screen.getByTestId("github-stars").querySelector(COUNT);

		expect(count?.textContent).toBe("1.2k");
		expect(
			(count?.getAttribute("class") ?? "").split(/\s+/),
			"without `normal-case` the tab repaints the suffix as `1.2K`",
		).toContain("normal-case");
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
