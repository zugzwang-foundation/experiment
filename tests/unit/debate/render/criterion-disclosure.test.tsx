// @vitest-environment jsdom

import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CriterionDisclosure } from "@/components/debate/CriterionDisclosure";
import { DebateView } from "@/components/debate/DebateView";

import { mumbaiMetroModel } from "../../debate-export/_fixtures/mumbai-metro.input";

/**
 * CRIT-1 · G-1…G-4 — the resolution criterion is on the page it binds, whole,
 * and closed.
 *
 * ⚠ WHAT THIS FILE IS GUARDING AGAINST IS A REGRESSION THAT ALREADY HAPPENED
 * ONCE, IN BOTH DIRECTIONS. The criterion shipped clamped to two lines
 * (`line-clamp-2`), which made the binding terms unreadable while looking
 * present; RESO-1 removed the clamp by removing the whole render, which made
 * them absent. The shape that is neither is: complete text, collapsed. Both
 * failure modes are asserted below — truncated, and missing.
 *
 * ⛔⛔ THE `hidden="until-found"` NEGATIVE AT G-3 IS THE LOAD-BEARING ONE AND IT
 * IS COUNTER-INTUITIVE, so it is stated here rather than only in the component.
 * CRIT-1's brief RULES that attribute onto the body. Measured in Chrome 151, it
 * stops the disclosure from ever opening — the attribute is not cleared when a
 * `<details>` opens, so the body stays `content-visibility: hidden` and the
 * element's own box goes 24px → 24px instead of 24px → 312px. A reviewer who
 * "restores" it to match the brief reintroduces a disclosure that cannot be
 * opened, and every screenshot will still look right because every screenshot
 * shows the closed state. That is why its ABSENCE is pinned.
 *
 * No jest-dom in this repo (AGENTS.md §9) — plain DOM assertions only.
 */

afterEach(cleanup);

/**
 * ⚠ A REAL SEEDED DESCRIPTION, NOT A LOREM STRING — shape matters here. This is
 * the structure all eight carry (measured at CRIT-1 recon: 6–8 newlines, 3–4
 * blank-line paragraph breaks): question, YES condition, NO condition, deadline.
 * A single-line fixture could not distinguish `whitespace-pre-wrap` working from
 * it being absent, which is half of what this file checks.
 */
const CRITERION = [
	"Will FIDE respond publicly on X by 5 November 2026 to Zugzwang's published proposal?",
	"Resolves YES if @FIDE_chess publishes a direct reply naming the proposal.",
	"Resolves NO in every other case — silence, a private reply, or a post that does not name it.",
	"Deadline 5 November 2026, 23:45 UTC.",
].join("\n\n");

describe("CRIT-1 — G-1, the complete criterion is in the DOM while closed", () => {
	it("criterion::G-1-the-WHOLE-text-renders-while-the-disclosure-is-closed", () => {
		const { container } = render(
			<CriterionDisclosure description={CRITERION} />,
		);

		const details = container.querySelector<HTMLDetailsElement>(
			'[data-testid="criterion-disclosure"]',
		);
		const text = container.querySelector('[data-testid="criterion-text"]');

		// ── POSITIVE CONTROL FIRST (OVN-V1). Every assertion that matters below is
		// about CONTENT being present; a query pointed at the wrong subtree would
		// make them all fail for the wrong reason, and this says so at the right
		// place. `criterion-summary` is a sibling the fixture is known to render.
		expect(
			container.querySelector('[data-testid="criterion-summary"]')?.textContent,
		).toBe("Resolution criteria");

		// ⛔ CLOSED, and the text is nonetheless in the DOM — which is the whole
		// point: `content-visibility: hidden` keeps it findable by find-in-page,
		// where `display: none` would not.
		expect(details?.open).toBe(false);

		// ⛔ THE **COMPLETE** TEXT, byte-for-byte. `toContain` on the first sentence
		// would pass on a truncated body, which is the exact defect RESO-1 removed.
		expect(text?.textContent).toBe(CRITERION);

		// …and every paragraph individually, so a failure names WHICH part was lost
		// rather than only that the whole differed.
		for (const para of CRITERION.split("\n\n")) {
			expect(text?.textContent).toContain(para);
		}
	});

	it("criterion::G-1-a-null-description-renders-NOTHING", () => {
		// The honest empty case — the same `{market.description ? … : null}`
		// conditional the removed header block carried. An empty bordered box with a
		// summary and no terms would be placeholder chrome, which is `PD-3-09`.
		const { container } = render(<CriterionDisclosure description={null} />);
		expect(container.innerHTML).toBe("");
	});

	it("criterion::G-1-the-text-is-NOT-truncated-for-a-long-description", () => {
		// ⛔ NON-VACUITY FOR THE ASSERTION ABOVE. `toBe(CRITERION)` passes on a
		// component that happens not to truncate an 800-character fixture while
		// still truncating a longer one. The brief cites ~7,481 characters as the
		// amended length; this is that order of magnitude.
		const long = `${CRITERION}\n\n${"Additional binding clause. ".repeat(280)}`;
		expect(long.length).toBeGreaterThan(7000);
		const { container } = render(<CriterionDisclosure description={long} />);
		const text = container.querySelector('[data-testid="criterion-text"]');
		expect(text?.textContent).toBe(long);
		expect(text?.textContent?.length).toBe(long.length);
	});
});

describe("CRIT-1 — G-2, closed by default", () => {
	it("criterion::G-2-the-open-attribute-is-ABSENT-on-first-render", () => {
		const { container } = render(
			<CriterionDisclosure description={CRITERION} />,
		);
		const details = container.querySelector<HTMLDetailsElement>(
			'[data-testid="criterion-disclosure"]',
		);
		expect(details).not.toBeNull(); // control
		// ⛔ BOTH SPELLINGS. `open` is a boolean attribute, so `open={false}` emits
		// no attribute and `open` as a property is false — but `open=""` in the
		// markup would make `hasAttribute` true while a lazy property check still
		// read false in some paths. Assert the attribute AND the property.
		expect(details?.hasAttribute("open")).toBe(false);
		expect(details?.open).toBe(false);
	});
});

describe("CRIT-1 — G-3, it is a NATIVE disclosure and carries no hidden attribute", () => {
	it("criterion::G-3-details-and-summary-not-a-button-accordion", () => {
		const { container } = render(
			<CriterionDisclosure description={CRITERION} />,
		);
		const details = container.querySelector(
			'[data-testid="criterion-disclosure"]',
		);
		const summary = container.querySelector(
			'[data-testid="criterion-summary"]',
		);

		expect(details?.tagName.toLowerCase()).toBe("details");
		expect(summary?.tagName.toLowerCase()).toBe("summary");
		// ⛔ The summary is the FIRST child — a `<summary>` that is not the first
		// child is not the disclosure's control, it is ordinary content, and the
		// element renders a UA-generated control instead.
		expect(details?.firstElementChild).toBe(summary);

		// ⛔ NO ROLE OVERRIDE. The register forbids it: `<summary>` is natively
		// focusable and announced as a disclosure with its expanded state, none of
		// which survives an `aria-expanded` a human has to keep in sync.
		expect(summary?.getAttribute("role")).toBeNull();
		expect(summary?.getAttribute("aria-expanded")).toBeNull();
		expect(details?.querySelectorAll("button")).toHaveLength(0);
	});

	it("criterion::G-3-NO-hidden-attribute-anywhere-in-the-disclosure", () => {
		// ⛔⛔ THE COUNTER-INTUITIVE ONE. CRIT-1's brief RULES `hidden="until-found"`
		// onto the body. Measured in Chrome 151: it is not cleared when the
		// `<details>` opens, so the body stays `content-visibility: hidden` and the
		// element's own box goes 24px → 24px rather than 24px → 312px. The
		// disclosure can never be opened. See the component's docblock for the
		// measurement and for why the attribute is also unnecessary — a closed
		// `<details>`'s `::details-content` already computes to the identical
		// `content-visibility: hidden; display: block`.
		const { container } = render(
			<CriterionDisclosure description={CRITERION} />,
		);
		const details = container.querySelector(
			'[data-testid="criterion-disclosure"]',
		);
		expect(details).not.toBeNull(); // control — the scan has a subtree

		const scope = [
			details as Element,
			...Array.from(details?.querySelectorAll("*") ?? []),
		];
		expect(scope.length).toBeGreaterThan(2); // control
		for (const el of scope) {
			expect(el.hasAttribute("hidden")).toBe(false);
		}
	});
});

describe("CRIT-1 — G-4, no clamp or truncation on the criterion body", () => {
	it("criterion::G-4-no-clamp-or-truncate-CLASS-TOKEN-on-the-body", () => {
		// ⛔⛔ CLASS **TOKENS**, NOT A SUBSTRING OF THE FILE OR OF THE CLASS STRING.
		// A bare `not.toContain("truncate")` over source or markup matches the
		// DOCBLOCK PROSE explaining the absence — a shape that has now failed SIX
		// times in this repo. This extracts the class attribute and splits it, so
		// only a real class token can trip it.
		const { container } = render(
			<CriterionDisclosure description={CRITERION} />,
		);
		const details = container.querySelector(
			'[data-testid="criterion-disclosure"]',
		);
		const scope = [
			details as Element,
			...Array.from(details?.querySelectorAll("*") ?? []),
		];
		expect(scope.length).toBeGreaterThan(2); // control

		const banned = /^(truncate|line-clamp-|text-ellipsis|overflow-ellipsis)/;
		for (const el of scope) {
			for (const token of (el.getAttribute("class") ?? "").split(/\s+/)) {
				expect(token).not.toMatch(banned);
			}
		}
	});

	it("criterion::G-4-the-body-preserves-the-descriptions-own-paragraph-breaks", () => {
		// C-6, and it is applied on a MEASUREMENT: all eight seeded descriptions
		// carry structural newlines, so without this the four paragraphs collapse
		// into one block. The class is the mechanism; jsdom renders no layout, so
		// the class is the checkable thing and the rendered result is measured in a
		// browser and reported in the run log.
		const { container } = render(
			<CriterionDisclosure description={CRITERION} />,
		);
		const text = container.querySelector('[data-testid="criterion-text"]');
		expect((text?.getAttribute("class") ?? "").split(/\s+/)).toContain(
			"whitespace-pre-wrap",
		);
		// …and the newlines actually survive into the DOM text, which is the
		// property the class exists to make visible.
		expect(text?.textContent).toContain("\n\n");
	});
});

/**
 * CRIT-1 · G-5 (element-bound) + THE BOTH-ARMS PROPERTY, asserted through the
 * REAL `DebateView` rather than through a proxy.
 *
 * ⚠⚠ THIS BLOCK EXISTS BECAUSE THE SOURCE-SCAN VERSION WAS A FALSE RECEIPT.
 * `debate-height-chain.test.ts` checked the mount's position with a window that
 * turned out to contain the WHOLE market↔post ternary, so moving the mount
 * inside the market arm — which drops the criterion from post focus, the one
 * failure the placement decision exists to prevent — kept it green
 * (@code-reviewer). A source scan can pin where a string sits; only a render can
 * pin what BOTH ARMS actually show. The window is tightened over there too, but
 * this is the assertion that proves the property.
 *
 * The `next/navigation` mock and the `mumbaiMetroModel` fixture are the harness
 * `poll.test.tsx` / `auto-advance.test.tsx` already established for mounting
 * `DebateView` — reused rather than re-derived, so the files cannot disagree
 * about what a mounted debate view is.
 */
vi.mock("next/navigation", () => ({
	useRouter: () => ({
		refresh: () => undefined,
		push: () => undefined,
		replace: () => undefined,
		back: () => undefined,
		forward: () => undefined,
		prefetch: () => undefined,
	}),
	usePathname: () => "/m/mumbai-metro-line-3-1m-riders",
	useSearchParams: () => new URLSearchParams(),
}));

describe("CRIT-1 — the disclosure renders on BOTH arms, and is crush-proof", () => {
	// ⛔⛔ FAKE TIMERS, AND NOT AS A STYLE CHOICE. Mounting the real `DebateView`
	// starts its polled-refresh interval and the arena's auto-advance timers; with
	// REAL timers those keep firing for the remainder of the worker's life, long
	// after this file's assertions are done. `auto-advance.test.tsx` and
	// `poll.test.tsx` both take fake timers for exactly this reason, and the first
	// version of this block did not — it passed in 72ms while leaving live
	// intervals behind it. Borrowing a harness means borrowing its clock.
	beforeEach(() => {
		vi.useFakeTimers();
		// The post-param sync calls `history.replaceState`; jsdom has it, but the
		// scroll reset needs a stub.
		window.scrollTo = () => undefined;
	});
	afterEach(() => {
		vi.useRealTimers();
	});

	const renderArm = (initialPostId: string | null) =>
		render(
			<DebateView
				model={mumbaiMetroModel}
				viewer={null}
				initialPostId={initialPostId}
				ownPseudonym={null}
			/>,
		);

	it("criterion::both-arms-MARKET-arm-shows-the-full-criterion", () => {
		const { container } = renderArm(null);
		// Control: we really are on the market arm (its header block is present).
		expect(
			container.querySelector('[data-testid="resolver-cards"]'),
		).not.toBeNull();
		expect(
			container.querySelector('[data-testid="criterion-text"]')?.textContent,
		).toBe(mumbaiMetroModel.market.description);
	});

	it("criterion::both-arms-POST-FOCUS-arm-shows-the-full-criterion-too", () => {
		// ⛔ THE ARM THE SOURCE SCAN COULD NOT SEE. `cmt-p1` is a real post in the
		// fixture, so this is the post-focus arm, not a variant of the market one.
		const { container } = renderArm("cmt-p1");
		// Control: the arm really did swap — the market header's block row is gone.
		expect(
			container.querySelector('[data-testid="resolver-cards"]'),
		).toBeNull();
		// …and the criterion is STILL there, complete.
		expect(
			container.querySelector('[data-testid="criterion-text"]')?.textContent,
		).toBe(mumbaiMetroModel.market.description);
	});

	it("criterion::G-5-shrink-0-is-on-the-DETAILS-element-itself", () => {
		// ⚠ ELEMENT-BOUND, not file-bound. The source-scan version took the first
		// `className` in the file containing `shrink-0`; if it migrated off the
		// `<details>` onto the summary the scan stayed green while the crushable
		// element lost its protection — the `<h1>` 698×0 precedent exactly
		// (@code-reviewer). Asserting it on the rendered node cannot drift.
		const { container } = renderArm(null);
		const details = container.querySelector(
			'[data-testid="criterion-disclosure"]',
		);
		expect(details).not.toBeNull(); // control
		const tokens = (details?.getAttribute("class") ?? "").split(/\s+/);
		expect(tokens).toContain("shrink-0");
		expect(tokens).not.toContain("flex-1");
	});
});
