// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PhoneDebateView } from "@/components/debate/phone/PhoneDebateView";
import { PANE_ID } from "@/components/debate/phone/PhoneFeedTrack";
import { PhoneSideTabs } from "@/components/debate/phone/PhoneSideTabs";

import { modelWith, post, stubElementScroll, VIEWER } from "./_fixtures";

vi.mock("next/navigation", () => ({
	useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

stubElementScroll();

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
	vi.clearAllMocks();
});

/**
 * MOBILE-2c G5 — R-1: the active tab is a neutral fill on BOTH sides.
 *
 * ⛔⛔ THE RING EXISTED ONLY TO RESCUE A CONTRAST OF ONE TO ONE. `--color-yes` is
 * `#181818` and so is the page ground, so an active YES tab painted in its own
 * pole was invisible and read as "no tab is selected". A ring was added to give
 * it an edge, then thickened to 2px when MOBILE-2b measured 1.5px as too light
 * at arm's length — an affordance getting heavier to rescue a colour that could
 * not be seen. A white fill has nothing left to rescue, so founder ruling Q1-a
 * of 2026-09-12 (ADR-0050 A2 D-4(v)) makes the active tab `bg-ink` / `text-ground`
 * on both sides, and both the ring and the per-side colour are gone.
 *
 * ⚠ THIS IS A TAB-CONTROL EXCEPTION TO THE POLE BINDING, NOT A REPEAL OF IT.
 * black = YES / white = NO remains in force on side badges, split bars and the
 * bottom bar, which is where it carries meaning. `side-pole-binding.test.ts`
 * holds that rule and its inventory NARROWED in the same commit — the phone
 * owner's entry was deleted because there is no side-keyed colour expression
 * left in it. That file proves the absence; this one proves what is there
 * instead, and the two claims are different.
 *
 * ⛔ THE STYLE LIVES IN THE COMPONENT AND THE PROP IS GONE. The fill used to be
 * resolved at the call site and passed in as `activeClass` — `AggregateFooter`'s
 * ratified anti-inversion shape (`RR-3`), on the reasoning that a component
 * mapping a side string to a pole token internally is one edit from painting a
 * NO tab in the YES pole. That reasoning was sound and is now moot: there is no
 * pole in the answer, so there is nothing to derive and nothing to get
 * backwards. A prop that must forever carry one value is itself a way for a
 * later edit to make it carry two.
 */
const ROOT = process.cwd();
const TABS = "src/components/debate/phone/PhoneSideTabs.tsx";
const OWNER = "src/components/debate/phone/PhoneDebateView.tsx";
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

/** Comments stripped, line count preserved — see G1/G4 for the six instances. */
function code(src: string): string {
	return src
		.replace(/\/\*[\s\S]*?\*\//g, (m) =>
			"\n".repeat((m.match(/\n/g) ?? []).length),
		)
		.replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

/**
 * A class-TOKEN matcher, never a substring one.
 *
 * ⛔ `text-nowrap` CONTAINS `text-no`. AGENTS.md §8 records the same trap one
 * class over (`table-fixed` matching a scan for `fixed`), and this is the
 * sharper case because the false positive would land on the very token this file
 * forbids — a guard that reddens on `whitespace-nowrap` gets deleted rather than
 * obeyed. The lookarounds reject a following `-` or word character.
 */
const tokenRe = (token: string) =>
	new RegExp(
		`(?<![\\w-])${token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\w-])`,
	);

/**
 * The four pole tokens. Every one already has a `src/` origin (side badges,
 * split bars, the bottom bar), so the literals here emit nothing new into the
 * built stylesheet — measured: 6, 6, 4 and 4 source files respectively.
 */
const POLES = ["bg-yes", "bg-no", "text-yes", "text-no"];

const OPTIONS = [
	{ key: "YES", label: "YES", trailing: "10%" },
	{ key: "NO", label: "NO", trailing: "90%" },
];

function mount(active: string, onSelect = vi.fn()) {
	render(
		<PhoneSideTabs
			options={OPTIONS}
			active={active}
			onSelect={onSelect}
			panelIdFor={PANE_ID}
		/>,
	);
	return onSelect;
}

const classOf = (key: string) =>
	screen.getByTestId(`phone-tab-${key}`).getAttribute("class") ?? "";
const tokens = (key: string) => classOf(key).split(/\s+/).filter(Boolean);

describe("phone side tabs — the active fill is neutral (G5)", () => {
	it("phone-side-tabs::the-active-tab-is-bg-ink-on-ground-and-carries-no-pole", () => {
		mount("YES");
		const active = tokens("YES");
		expect(
			active,
			"the active tab must be the neutral fill the founder ruled",
		).toContain("bg-ink");
		expect(active).toContain("text-ground");
		for (const pole of POLES) {
			expect(
				active.includes(pole),
				`${pole} is on the active tab: a YES tab in its own pole is #181818 ` +
					"on a #181818 ground and reads as no tab being selected",
			).toBe(false);
		}
		// ...and the border is the fill's own colour, which is what removes the
		// visible seam while holding the box geometry the ring established.
		expect(active).toContain("[border:2px_solid_var(--color-ink)]");

		/**
		 * ⛔ POSITIVE CONTROL: THE TWO STATES ARE DISTINGUISHABLE AT ALL. Without
		 * it, every assertion above is satisfied by a component that applies NO
		 * active styling — `bg-ink` would be missing, so strictly that half would
		 * fail, but the four pole assertions would pass vacuously and would keep
		 * passing after any future restyle that simply stopped marking a
		 * selection. The inactive tab must differ, and must carry the hairline.
		 */
		const inactive = tokens("NO");
		expect(classOf("YES")).not.toBe(classOf("NO"));
		expect(inactive).toContain("text-n5");
		expect(inactive).not.toContain("bg-ink");
	});

	/**
	 * ⛔⛔ THE CLAIM IS AN EQUALITY, NOT A PAIR OF SPOT CHECKS. "The active fill
	 * does not depend on the side" is exactly the statement that the two strings
	 * are the same string — and a pair of `toContain("bg-ink")` assertions is
	 * satisfied by `bg-ink bg-yes` on one side and `bg-ink bg-no` on the other.
	 * Byte equality is the only form of this that cannot be half-true.
	 */
	it("phone-side-tabs::the-active-class-string-is-byte-identical-across-the-two-sides", () => {
		mount("YES");
		const yesActive = classOf("YES");
		const yesInactive = classOf("NO");
		cleanup();
		mount("NO");
		const noActive = classOf("NO");
		const noInactive = classOf("YES");
		expect(
			noActive,
			"the active tab's class string differs by side — the fill is keyed on " +
				"the pole again",
		).toBe(yesActive);
		// POSITIVE CONTROLS. (1) The strings are non-trivial, so equality is not
		// two empty reads agreeing. (2) ACTIVE and INACTIVE genuinely differ, so
		// the equality above is not "all four tabs look the same".
		expect(yesActive.length).toBeGreaterThan(40);
		expect(noInactive).toBe(yesInactive);
		expect(yesActive).not.toBe(yesInactive);
	});

	/**
	 * ⛔⛔ THE SAME EQUALITY, BUT AGAINST THE SHIPPED OPTION OBJECTS — and this row
	 * exists because the mutation pass proved the one above cannot see the defect
	 * it was written for. The restore that shipped before R-1 puts the per-side
	 * value in the OWNER (`feedTabs` resolving `bg-yes text-no` / `bg-no
	 * text-yes`) and has the component consume it. A unit render supplies its own
	 * options, so it takes the fallback and both sides stay identical: measured,
	 * `byte-identical-across-the-two-sides` stayed GREEN under the full restore
	 * while only the source scan reddened.
	 *
	 * ⇒ The claim "the active fill does not depend on the side" is a claim about
	 * the tabs a reader sees, and only the owner knows which side it is holding.
	 * So it is asserted where the side lives.
	 */
	it("phone-side-tabs::the-owners-own-tabs-are-byte-identical-across-a-side-flip", () => {
		render(
			<PhoneDebateView
				model={modelWith([
					post({ id: "p1", ordinal: 1, side: "YES" }),
					post({ id: "p2", ordinal: 2, side: "NO" }),
				])}
				viewer={VIEWER}
				initialPostId={null}
				ownPseudonym={null}
				details={null}
			/>,
		);
		const yesActive = classOf("YES");
		fireEvent.click(screen.getByTestId("phone-tab-NO"));
		// POSITIVE CONTROL — the flip actually happened. Without it the two reads
		// are the same tab twice and the equality is trivially true.
		expect(
			screen.getByTestId("phone-tab-NO").getAttribute("aria-selected"),
		).toBe("true");
		expect(
			screen.getByTestId("phone-tab-YES").getAttribute("aria-selected"),
		).toBe("false");
		expect(
			classOf("NO"),
			"the shipped active tab's class differs by side — the owner is " +
				"resolving a per-side fill again",
		).toBe(yesActive);
		for (const pole of POLES) {
			expect(classOf("NO").split(/\s+/).includes(pole)).toBe(false);
			expect(yesActive.split(/\s+/).includes(pole)).toBe(false);
		}
	});

	it("phone-side-tabs::no-pole-token-and-no-activeClass-prop-in-source", () => {
		const tabs = code(read(TABS));
		const owner = code(read(OWNER));
		const offenders: string[] = [];
		for (const pole of POLES) {
			if (tokenRe(pole).test(tabs)) offenders.push(`${TABS}: ${pole}`);
			if (tokenRe(pole).test(owner)) offenders.push(`${OWNER}: ${pole}`);
		}
		for (const [file, src] of [
			[TABS, tabs],
			[OWNER, owner],
		] as const) {
			if (src.includes("activeClass")) {
				offenders.push(`${file}: activeClass`);
			}
		}
		expect(
			offenders,
			"a per-side fill is back: either as a pole token in the component or " +
				"as a prop the call site resolves",
		).toEqual([]);

		// POSITIVE CONTROL 1 — `bg-ink` IS found by the same token matcher in the
		// same file, so an empty offender list is a fact about the pole tokens
		// rather than a scan that read nothing.
		expect(tokenRe("bg-ink").test(tabs)).toBe(true);
		expect(tokenRe("text-ground").test(tabs)).toBe(true);

		/**
		 * POSITIVE CONTROL 2 — THE UNSTRIPPED TEXT. Both files record the removal
		 * in prose: `PhoneSideTabs`' docblock names `activeClass` and the owner's
		 * quotes `bg-yes text-no` verbatim. So the RAW reads must contain both
		 * needles, which proves the paths resolve, the spellings are right, and the
		 * zero above is the comment-stripper working.
		 */
		expect(read(TABS).includes("activeClass")).toBe(true);
		expect(tokenRe("bg-yes").test(read(OWNER))).toBe(true);

		// POSITIVE CONTROL 3 — the matcher discriminates. `text-nowrap` must NOT
		// register as `text-no`, and a real pole class must.
		expect(tokenRe("text-no").test("text-nowrap whitespace-nowrap")).toBe(
			false,
		);
		expect(tokenRe("text-no").test("flex bg-no text-no items-center")).toBe(
			true,
		);
	});
});

/**
 * ⚠ THE TABLIST CONTRACT IS RE-ASSERTED HERE ON PURPOSE. R-1 is a RESTYLE, and
 * the shape of a restyle is a rewritten `className` ternary — which is two lines
 * above the roving `tabIndex` and one below `aria-selected`. The first cut of
 * this component declared `role="tablist"` / `role="tab"` / `aria-selected` with
 * no `aria-controls`, no roving tabindex and no arrow keys, and `@code-reviewer`
 * caught it: a half-kept ARIA role tells an assistive technology how to drive a
 * control and then does not answer. Nothing about the ruling touches this, which
 * is exactly why a restyle must not be allowed to take it.
 */
describe("phone side tabs — the restyle does not drop the tab contract (G5)", () => {
	it("phone-side-tabs::exactly-one-tab-is-in-the-tab-order-and-it-is-the-selected-one", () => {
		mount("YES");
		expect(
			screen.getByTestId("phone-tab-YES").getAttribute("tabindex"),
			"the selected tab is the widget's single tab stop",
		).toBe("0");
		expect(screen.getByTestId("phone-tab-NO").getAttribute("tabindex")).toBe(
			"-1",
		);
		expect(
			screen.getByTestId("phone-tab-YES").getAttribute("aria-selected"),
		).toBe("true");
		expect(
			screen.getByTestId("phone-tab-NO").getAttribute("aria-selected"),
		).toBe("false");
		// POSITIVE CONTROL — the roving stop MOVES, so "exactly one" is a property
		// of the widget and not of which key happens to be hardcoded.
		cleanup();
		mount("NO");
		expect(screen.getByTestId("phone-tab-NO").getAttribute("tabindex")).toBe(
			"0",
		);
		expect(screen.getByTestId("phone-tab-YES").getAttribute("tabindex")).toBe(
			"-1",
		);
	});

	it("phone-side-tabs::each-tab-points-at-the-pane-it-controls", () => {
		mount("YES");
		// ⚠ AGAINST THE SHIPPED `PANE_ID`, not a literal. `PhoneFeedTrack` gives
		// each pane the matching `id` and `role="tabpanel"`; these two files hold
		// one contract between them, and a test that spelled the id itself would
		// keep passing after the contract moved.
		expect(
			screen.getByTestId("phone-tab-YES").getAttribute("aria-controls"),
		).toBe(PANE_ID("YES"));
		expect(
			screen.getByTestId("phone-tab-NO").getAttribute("aria-controls"),
		).toBe(PANE_ID("NO"));
		expect(screen.getByTestId("phone-side-tabs").getAttribute("role")).toBe(
			"tablist",
		);
		expect(screen.getByTestId("phone-tab-YES").getAttribute("role")).toBe(
			"tab",
		);
	});

	it("phone-side-tabs::the-arrow-keys-move-between-the-tabs-and-wrap", () => {
		const onSelect = mount("YES");
		fireEvent.keyDown(screen.getByTestId("phone-tab-YES"), {
			key: "ArrowRight",
		});
		expect(onSelect).toHaveBeenCalledWith("NO");
		onSelect.mockClear();
		// ...and wraps, which is what makes a two-tab widget usable from either
		// end without the reader having to know which one they are on.
		fireEvent.keyDown(screen.getByTestId("phone-tab-YES"), {
			key: "ArrowLeft",
		});
		expect(onSelect).toHaveBeenCalledWith("NO");
		onSelect.mockClear();
		// POSITIVE CONTROL — a key the widget does not own is NOT consumed, so the
		// two rows above are about ArrowLeft/ArrowRight rather than about any
		// keydown firing the callback.
		fireEvent.keyDown(screen.getByTestId("phone-tab-YES"), { key: "a" });
		expect(onSelect).not.toHaveBeenCalled();
	});
});
