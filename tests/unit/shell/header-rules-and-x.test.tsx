// @vitest-environment jsdom

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
	usePathname: () => "/",
	useRouter: () => ({ back: () => {}, push: () => {} }),
}));

import { GlobalHeader } from "@/components/shell/GlobalHeader";
import type { HeaderViewer } from "@/components/shell/IdentityCluster";

/**
 * MKT-ROSTER-1-P3 — RULES MOVES TO THE IDENTITY SIDE, AND `X` TAKES ITS OLD SLOT.
 *
 * Two founder rulings, both about WHERE a control is rather than what it does,
 * which is why this is a render test and not a source scan: the claim is DOM
 * ORDER in two viewer arms, and a source scan can only see the order of two JSX
 * tags in one file — it cannot see that `DharmaCluster` returns `null` signed
 * out, so it would report an order the signed-out reader never gets.
 *
 * ⛔⛔ AND POSITION IS THE ONE THING A MOUNT-SITE SCAN GETS WRONG WHILE PASSING.
 * A guard that checks `<RulesControl` appears before `<DharmaCluster` in
 * `GlobalHeader.tsx` is satisfied by a RulesControl mounted in a different zone
 * higher up the file. Both claims here are made against the rendered tree,
 * located by what each control IS.
 *
 * ⚠ WHAT THIS CANNOT CLAIM. jsdom performs no layout and resolves no media
 * query, so nothing here says the header FITS, that RULES reads as part of the
 * identity side to the eye, or that `max-mobile:hidden` actually hides X. Those
 * are browser measurements and live in the round's report (AGENTS.md §9). The
 * tier-gating of X's hide is asserted as a CLASS below, which is the most a
 * jsdom harness can honestly say about it.
 *
 * ⚠ NO `jest-dom`. Plain DOM assertions only (AGENTS.md §9).
 */

const VIEWER: HeaderViewer = {
	pseudonym: "ashen-parallax",
	pfpUrl: "/pfp/ashen.png",
};

/** The RULES trigger, located by its own text — it carries no testid. */
function rulesButton(root: ParentNode): Element {
	const found = [...root.querySelectorAll("button")].find(
		(b) => (b.textContent ?? "").trim().toLowerCase() === "rules",
	);
	if (!found) {
		throw new Error(
			"no RULES button in the header. SPEC.1 §21.9 makes it the onboarding " +
				"deck's only re-show entry point, present for every viewer.",
		);
	}
	return found;
}

/** `a` precedes `b` in document order. */
function precedes(a: Element, b: Element): boolean {
	return (
		(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
	);
}

afterEach(cleanup);

describe("MKT-ROSTER-1-P3 — RULES opens the identity side", () => {
	it("header-rules::signed-OUT-the-right-zone-reads-RULES-then-JOIN", () => {
		const { container } = render(<GlobalHeader viewer={null} />);

		const rules = rulesButton(container);
		const join = container.querySelector('a[href="/sign-in"]');
		expect(join, "the JOIN CTA does not render signed out").not.toBeNull();

		// ⛔ SAME PARENT, not merely earlier in the document. RULES is the identity
		// zone's FIRST CHILD; a RULES left in the left zone also "precedes" JOIN,
		// and that is exactly the state this ruling changed.
		expect(
			rules.parentElement,
			"RULES is not a sibling of the JOIN CTA — it is still in another zone.",
		).toBe(join?.parentElement);
		expect(precedes(rules, join as Element)).toBe(true);

		// The zone this test claims to be reading is the header's right zone, by
		// the same class `GlobalHeader` and two other guards locate it with.
		expect(rules.parentElement?.getAttribute("class")).toContain(
			"justify-self-end",
		);
	});

	it("header-rules::signed-IN-the-right-zone-reads-RULES-then-D-cluster-then-avatar", () => {
		const { container } = render(
			<GlobalHeader
				viewer={VIEWER}
				portfolio="2480.000000000000000000"
				spendable="610.000000000000000000"
			/>,
		);

		const rules = rulesButton(container);
		const cluster = container.querySelector('[data-testid="dharma-cluster"]');
		const chip = container.querySelector('[data-testid="identity-chip-link"]');
		expect(cluster).not.toBeNull();
		expect(chip).not.toBeNull();

		expect(rules.parentElement).toBe(cluster?.parentElement);
		expect(precedes(rules, cluster as Element)).toBe(true);
		expect(precedes(rules, chip as Element)).toBe(true);
		expect(precedes(cluster as Element, chip as Element)).toBe(true);
	});

	it("header-rules::it-is-mounted-exactly-ONCE-in-both-arms", () => {
		// SPEC.1 §21.9 wants the deck reachable, not reachable twice: a second
		// trigger is a second `useState`, so the two would disagree about whether
		// the deck is open. The move is a RELOCATION and this is what says so.
		for (const viewer of [VIEWER, null]) {
			const { container } = render(<GlobalHeader viewer={viewer} />);
			const triggers = [...container.querySelectorAll("button")].filter(
				(b) => (b.textContent ?? "").trim().toLowerCase() === "rules",
			);
			expect(triggers.length).toBe(1);
			cleanup();
		}
	});
});

describe("MKT-ROSTER-1-P3 — the X control takes the vacated left-zone slot", () => {
	it("header-x::it-follows-GitHub-and-carries-the-off-site-attribute-set", () => {
		const { container } = render(<GlobalHeader viewer={null} stars={12} />);

		const x = container.querySelector('[data-testid="x-link"]');
		const github = container.querySelector('[data-testid="github-stars"]');
		expect(x, "no X control in the header").not.toBeNull();
		expect(github, "the desktop GitHub control is gone").not.toBeNull();

		expect(precedes(github as Element, x as Element)).toBe(true);

		// ⛔ THE ATTRIBUTE SET IS THE POINT, NOT DECORATION. `target="_blank"`
		// without `rel="noopener"` hands the opened tab a `window.opener` handle
		// back into this origin; `rel` is asserted as a SET so a later edit cannot
		// drop one half of it while keeping the string non-empty.
		expect(x?.getAttribute("href")).toBe("https://x.com/zugzwangworld");
		expect(x?.getAttribute("target")).toBe("_blank");
		expect(new Set((x?.getAttribute("rel") ?? "").split(/\s+/))).toEqual(
			new Set(["noopener", "noreferrer"]),
		);

		// ⛔ AND THE ACCESSIBLE NAME IS NOT THE LABEL. A one-character link
		// announces as "X, link", which everywhere else in a UI means close. The
		// label says where it goes and that it leaves the tab.
		expect(x?.getAttribute("aria-label")).toBe(
			"Zugzwang on X (opens in a new tab)",
		);

		// ⛔ THE MARK IS AN `<svg>`, NOT THE LETTER X. A one-character text label
		// was the interim; MKT-ROSTER-1-P3 ships X's own logo from its brand
		// toolkit. Asserted as a SET of properties rather than a snapshot of the
		// path, because the path is 293 bytes of geometry whose correctness is a
		// provenance question (recorded in the component's docblock with the source
		// and its md5) and not something a diff can adjudicate.
		const svg = x?.querySelector("svg");
		expect(
			svg,
			"the X control renders no <svg> — it is text again",
		).not.toBeNull();
		expect(svg?.getAttribute("viewBox")).toBe("0 0 1200 1227");
		expect(svg?.getAttribute("fill")).toBe("currentColor");
		// ⛔ `aria-hidden` AND `focusable="false"` TOGETHER. The first keeps the
		// glyph out of the accessible name, which the link's `aria-label` already
		// carries; the second keeps it out of the TAB ORDER, which `aria-hidden`
		// alone does not guarantee — a decorative mark that takes a tab stop is a
		// stop that announces nothing.
		expect(svg?.getAttribute("aria-hidden")).toBe("true");
		expect(svg?.getAttribute("focusable")).toBe("false");
		expect(svg?.querySelectorAll("path").length).toBe(1);
		// ⛔ NO HARD-CODED COLOUR ANYWHERE INSIDE IT. The official file ships
		// `fill="white"` on its path; shipping that would put a raw colour in a tree
		// whose whole token layer names colours by role, and it would be invisible
		// on a light surface if one ever existed.
		expect(svg?.innerHTML).not.toContain("white");
		// ⛔ THE ONLY TEXT IS THE CLIPPED FALLBACK, AND IT IS NOT THE ANNOUNCED
		// NAME. `aria-label` wins the accessible-name computation, so a reader
		// hears the destination and the new-tab warning; this span exists because
		// an anchor whose every child is `aria-hidden` has a name and no CONTENT.
		// Asserted as `sr-only` rather than merely present — an unclipped "X" here
		// would paint a letter beside the mark.
		const srOnly = x?.querySelector(".sr-only");
		expect(srOnly?.textContent).toBe("X");
		expect((x?.textContent ?? "").trim()).toBe("X");
	});

	it("header-x::it-wears-the-SAME-pill-string-as-RULES", () => {
		// The founder's word is "exactly", and two literals that agree today are
		// not "exactly" — they are a coincidence somebody has to maintain. Both
		// read `HEADER_PILL_BUTTON`; this is what proves the import did not drift
		// into a hand-copied near-match.
		const { container } = render(<GlobalHeader viewer={null} />);
		const x = container.querySelector('[data-testid="x-link"]');
		const rules = rulesButton(container);

		const tokens = (el: Element | null) =>
			new Set((el?.getAttribute("class") ?? "").split(/\s+/).filter(Boolean));
		const xTokens = tokens(x);
		// ⚠ TWO TOKENS ARE PERMITTED TO DIFFER, AND BOTH ARE OVERRIDES RATHER THAN
		// OMISSIONS. `mr-3.5` is RULES' own right margin — the right zone declares
		// no `gap`, so every separation in it is a margin on the control that owns
		// it. `px-[13px]` is the register's text padding, which X zeroes to make a
		// 34×34 square around a 15px mark; `px-0` is asserted on X below rather
		// than merely excused here.
		const OVERRIDDEN = new Set(["mr-3.5", "px-[13px]"]);
		expect(xTokens.has("px-0")).toBe(true);
		expect(xTokens.has("w-[34px]")).toBe(true);
		for (const t of tokens(rules)) {
			if (OVERRIDDEN.has(t)) continue;
			expect(
				xTokens.has(t),
				`the X pill is missing \`${t}\`, which RULES carries. Both must read ` +
					`HEADER_PILL_BUTTON — "styled exactly like the RULES pill" is one ` +
					`string or it is a coincidence.`,
			).toBe(true);
		}
	});

	it("header-x::the-hide-is-GATED-on-mobileResponsive-and-mirrors-GitHub", () => {
		// ADR-0045 / AGENTS.md §8 — a mount that omits the prop inherits the
		// DESKTOP render. X is decorative and off-site, so it hides at the tier
		// exactly where the GitHub control does; what may not happen is the hide
		// reaching a third mount that never asked to reflow.
		const V = "max-mobile";
		const S = ":";
		const HIDE = `${V}${S}hidden`;

		const gated = render(
			<GlobalHeader viewer={null} mobileResponsive={true} />,
		);
		const on = gated.container.querySelector('[data-testid="x-link"]');
		expect((on?.getAttribute("class") ?? "").split(/\s+/)).toContain(HIDE);
		cleanup();

		const bare = render(<GlobalHeader viewer={null} />);
		const off = bare.container.querySelector('[data-testid="x-link"]');
		expect(
			(off?.getAttribute("class") ?? "").split(/\s+/).includes(HIDE),
			"a mount that omits `mobileResponsive` gets X's phone hide anyway. " +
				"The default is what keeps a third mount on the desktop render.",
		).toBe(false);
	});
});
