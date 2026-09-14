// @vitest-environment jsdom

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
	usePathname: () => "/m/bitcoin-price-50k",
	useRouter: () => ({ back: () => {}, push: () => {} }),
}));

import { GlobalHeader } from "@/components/shell/GlobalHeader";
import { GITHUB_REPO_URL } from "@/server/github/star-count";

/**
 * MOBILE-2n · R-5 / ADR-0051 A10 D-5 — THE PHONE'S GITHUB CONTROL.
 *
 * ⛔⛔ WHY A RENDER AND NOT A SCAN, AND THE REASON IS A DEFECT THIS ROUND
 * SHIPPED AND THEN MEASURED. The control wears the shared 34px icon register,
 * whose string OPENS with its own `inline-flex`. Written as a template literal
 * the element carried BOTH `inline-flex` and `hidden` unprefixed — two
 * single-class selectors at equal specificity — so the cascade decided on
 * stylesheet emission order and Tailwind emits `inline-flex` last. The control
 * PAINTED at 1440 and at 640 and widened the header's right zone by 34px,
 * moving JOIN and everything beside it on the DESKTOP. Every source scan was
 * green throughout: the class was authored, compiled and present on the node.
 * ⇒ `cn()` is what resolves it, and `cn()` is `twMerge` — a function whose
 * entire job is to DELETE classes it judges redundant. A scan reads the
 * arguments; only a render reads what survived. That is the property below.
 *
 * ⚠ WHAT THIS CANNOT CLAIM. jsdom performs no layout and resolves no media
 * query, so nothing here proves the control is 44px to a finger, that its
 * centre lands on the logo's and the avatar's, or that the gap to the avatar
 * equals the gap from Home to RULES. Those are browser measurements and belong
 * to the round's own run (AGENTS.md §9). This file proves the right tokens
 * reach the right node after composition, and that the href is the desktop
 * control's rather than a second spelling of it.
 *
 * ⛔ NO PHONE-VARIANT LITERAL APPEARS IN THIS FILE. Tailwind v4's source
 * detection scans `tests/`, so a class-shaped literal here becomes a real
 * emitted utility in the production stylesheet (AGENTS.md §8) — and a guard
 * asserting a component's new utility could then emit that utility itself. The
 * prefix is ASSEMBLED AT RUNTIME.
 *
 * No jest-dom in this repo (AGENTS.md §9) — plain DOM assertions only.
 */

afterEach(cleanup);

const V = "max-mobile";
const S = ":";
const phone = (utility: string) => V + S + utility;
/**
 * ⛔ THE SUFFIX IS ASSEMBLED TOO. `phone()` keeps the `max-mobile:` prefix out of
 * the file, but Tailwind's scanner reads `tests/` for ordinary candidates as
 * well — so `phone(GAP)` still leaves a bare `me-2` here, and `me-2` is
 * authored nowhere in `src/`. Measured and found by `@code-reviewer`: it was
 * being emitted into the production stylesheet with no origin.
 */
const GAP = "me-" + "2";

const VIEWER = { pseudonym: "RedFox001", pfpUrl: "/pfp-placeholder.svg" };

function header(opts?: {
	viewer?: typeof VIEWER | null;
	responsive?: boolean;
}) {
	const { container } = render(
		<GlobalHeader
			viewer={opts?.viewer === undefined ? VIEWER : opts.viewer}
			mobileResponsive={opts?.responsive ?? true}
		/>,
	);
	return container;
}

const control = (root: HTMLElement) =>
	root.querySelector<HTMLAnchorElement>('[data-testid="github-icon"]');

const tokens = (el: Element | null) =>
	(el?.getAttribute("class") ?? "").split(/\s+/).filter(Boolean);

describe("MOBILE-2n · R-5 / A10 D-5 — the control reaches the DOM, hidden by default", () => {
	it("phone-r5::the-control-is-mounted-when-the-surface-opts-in", () => {
		const gh = control(header());
		expect(gh, "no GitHub control in the header's right zone").not.toBeNull();
		expect(gh?.tagName.toLowerCase(), "it is a link, not a button").toBe("a");
	});

	it("phone-r5::a-mount-that-says-nothing-gets-NO-control-at-all", () => {
		// ⛔ THE POLARITY, AND IT IS THE PROP'S RATHER THAN THE CALLERS'. Both
		// layouts pass `mobileResponsive` today, so the rendered outcome is the
		// same either way; what the default buys is that a THIRD mount inherits
		// the header it has now instead of silently gaining a control.
		expect(control(header({ responsive: false }))).toBeNull();
	});

	it("phone-r5::the-BASE-display-is-none-after-twMerge-and-the-phone-arm-restores-it", () => {
		// ⛔⛔ THE ROW THE DEFECT WOULD HAVE FAILED. The register's own
		// `inline-flex` must NOT survive beside `hidden`; if it does, the control
		// paints at 1440 and the desktop right zone grows by its width plus its
		// gap. Both halves are asserted, because either alone passes on the bug:
		// the phone arm was present the whole time it was broken.
		const t = tokens(control(header()));
		expect(t, "the control is not hidden at the desktop tier").toContain(
			"hidden",
		);
		expect(
			t,
			"the register's own `inline-flex` survived beside `hidden`, so the " +
				"cascade decides the display by emission order and the control paints " +
				"at 1440.",
		).not.toContain("inline-flex");
		expect(
			t,
			"nothing restores a display below 640, so the control never appears — " +
				"there is no `un-hide`, only another `display`.",
		).toContain(phone("inline-flex"));
	});
});

describe("MOBILE-2n · R-5 / A10 D-5 — one destination, one register, one gap", () => {
	it("phone-r5::the-href-IS-the-desktop-controls-and-not-a-second-spelling", () => {
		// R-5: reuse the desktop control's href, do not mint a constant. Asserted
		// against the exported constant BOTH controls import, so the two cannot
		// drift — and against the ruled literal, so the constant itself moving is
		// a decision rather than a silent redirect.
		const gh = control(header());
		expect(gh?.getAttribute("href")).toBe(GITHUB_REPO_URL);
		expect(GITHUB_REPO_URL).toBe(
			"https://github.com/zugzwang-foundation/experiment",
		);
	});

	it("phone-r5::it-opens-in-a-new-tab-safely-and-names-itself", () => {
		const gh = control(header());
		expect(gh?.getAttribute("target")).toBe("_blank");
		// `noopener` is the security half and `noreferrer` the privacy half; a
		// new-tab link that carries neither hands the opened page a live
		// `window.opener` back into this one.
		expect(gh?.getAttribute("rel")).toBe("noopener noreferrer");
		expect(gh?.getAttribute("aria-label")).toBe("GitHub");
		// The mark is decorative — the anchor's label is the accessible name, and
		// a titled mark would give the control two.
		const svg = gh?.querySelector("svg");
		expect(svg, "the GitHub mark did not render").not.toBeNull();
		expect(svg?.getAttribute("aria-hidden")).toBe("true");
	});

	it("phone-r5::it-wears-the-HOME-controls-box-by-sharing-the-string", () => {
		// ⛔ "The same box as the home control" is either enforced by one string
		// or re-checked by hand forever. Home's own tokens are read off the
		// rendered Home control rather than restated here, so a change to the
		// register moves both or reddens this.
		const root = header();
		const home = tokens(root.querySelector('[aria-label="Home"]'));
		const gh = tokens(control(root));
		expect(home.length, "the Home control did not render").toBeGreaterThan(0);
		// ⛔ THE DISPLAY IS THE ONE TOKEN THAT MUST **NOT** MATCH, and excluding it
		// is the point rather than an exemption. Home is `inline-flex` at every
		// width; this control is `hidden` until 640 and takes the register's
		// display back only under the phone variant. A loop that demanded parity
		// here would be demanding the defect.
		for (const token of home) {
			// ⚠ Home carries a bare `className={ICON_BUTTON}` with no `cn()` and no
			// hide — only BACK takes the phone hide — so this branch is dead today
			// and is kept as a guard against Home ever gaining one. Named as dead
			// rather than left implying a token Home has. `@code-reviewer`, LOW.
			if (token === phone("hidden")) continue;
			if (token === "inline-flex") continue; // see above
			expect(
				gh,
				`the GitHub control does not share the Home control's \`${token}\`, ` +
					`so "the same box" is now two literals that agree by hand.`,
			).toContain(token);
		}
	});

	it("phone-r5::the-gap-to-the-avatar-is-the-LEFT-clusters-own-gap-token", () => {
		// R-5: "the same gap token the left cluster uses between home and rules".
		// The left zone carries `gap-2`; the right zone declares no gap at all
		// (its spacing is the divider's `mx-3`), so adding one there would move
		// `DharmaCluster`, `IdentityCluster` and `VisitorCounter` apart at 1440.
		// A margin on this control alone is the additive form.
		expect(tokens(control(header()))).toContain(phone(GAP));
	});

	it("phone-r5::the-44px-target-is-bought-by-a-pseudo-element-not-by-the-box", () => {
		// ⛔ R-5 rules BOTH "the same box as the home control" (34px) and a ≥44px
		// target, which one element cannot be. `TriggerPill` already answered this
		// pair on this tier: a transparent `::after` extends the hit region at the
		// hit-testing layer, so the painted box stays 34px and the three centres
		// stay collinear.
		// ⚠ THE SIZE IS NOT ASSERTED HERE AND CANNOT BE. `inset` positions against
		// the PADDING box, so the region is 34 − 2×border + 2×inset — a number
		// jsdom cannot produce. What is asserted is that the mechanism is present
		// and that it needs a positioned parent; the 44.74px is the run's
		// `elementFromPoint` measurement.
		const t = tokens(control(header()));
		expect(t, "the extension has nothing to position against").toContain(
			"relative",
		);
		expect(t).toContain("after:absolute");
		expect(t).toContain("after:-inset-1.5");
		expect(
			t.some((x) => x.startsWith("after:content-")),
			"a pseudo-element with no `content` is never generated, so the region " +
				"is silently the element's own box.",
		).toBe(true);
	});
});

describe("MOBILE-2n · R-5 / A10 D-5 — the control does not disturb the zone it joins", () => {
	it("phone-r5::it-is-the-FIRST-child-of-the-right-zone-and-a-SIBLING-not-a-wrapper", () => {
		// ⛔ T4 (`dharma-cluster.test.tsx`) walks this zone's direct `.children`
		// and compares indices RELATIVELY, so a new leaf ahead of all four shifts
		// every index and changes no ordering. It would NOT survive a WRAPPER,
		// which is the substitution that guard exists to catch — and that guard's
		// own docblock records a wrapper hiding the entire right zone while every
		// index still resolved. This row pins the shape T4 depends on.
		const root = header();
		const gh = control(root);
		const zone = gh?.parentElement;
		expect(
			zone?.getAttribute("class") ?? "",
			"the control's parent is not the header's right zone, so something " +
				"now wraps it — which is the one arrangement T4 cannot see.",
		).toContain("justify-self-end");
		expect(zone?.children[0]).toBe(gh);
		// ⛔ AND THE NEIGHBOURS ARE STILL DIRECT CHILDREN. T4's indices resolve
		// only while every right-zone member is one; the identity cluster is the
		// one that renders in every auth state, so it is the one read here.
		// ⛔⛔ AND ALL THREE NEIGHBOURS ARE STILL DIRECT CHILDREN — WHICH IS A
		// COVERAGE HOLE THIS ROUND OPENED AND CLOSES HERE. `dharma-cluster.test.tsx`'s
		// T4 renders the header with NO `mobileResponsive`, so the mount gate makes
		// this control absent and T4's relative indices are untouched — sound, but it
		// now certifies §21.1's anti-conflation order only for a configuration
		// NEITHER LAYOUT SHIPS. Both real mounts pass the prop. So the direct-child
		// property T4 depends on is asserted here, under the prop, for every member
		// of the zone it can see — a wrapper around any of them is the substitution
		// that makes every index resolve while the whole zone disappears.
		// ⚠ Read by class rather than by testid for the divider, which is a NAMED
		// UNTOUCHABLE (SG6) and must never gain one. `@code-reviewer`, MEDIUM.
		const identity = zone?.querySelector('[data-testid="identity-chip-link"]');
		const visitor = zone?.querySelector('[data-testid="visitor-counter"]');
		const divider = [...(zone?.children ?? [])].find((el) =>
			(el.getAttribute("class") ?? "").includes("w-px"),
		);
		expect(identity, "the identity cluster did not render").toBeTruthy();
		expect(visitor, "the visitor counter did not render").toBeTruthy();
		expect(
			divider,
			"the §21.1 register divider is gone from the zone",
		).toBeTruthy();
		for (const [what, el] of [
			["the identity cluster", identity],
			["the visitor counter", visitor],
		] as [string, Element | null | undefined][]) {
			expect(
				el?.parentElement,
				`${what} became a grandchild of the zone, which is how a wrapper hides ` +
					`an entire zone while every ordering assertion still passes.`,
			).toBe(zone);
		}
		// The §21.1 boundary itself, under the prop: the counter is the SOLE element
		// right of the divider, and the new control is left of everything.
		const kids = [...(zone?.children ?? [])];
		expect(kids.slice(kids.indexOf(divider as Element) + 1)).toEqual([visitor]);
		expect(kids.indexOf(gh as Element)).toBeLessThan(
			kids.indexOf(divider as Element),
		);
	});

	it("phone-r5::the-brand-cell-is-STILL-byte-identical-in-both-auth-states", () => {
		// ⛔⛔ A9 D-3 STANDS, AND THIS ROUND IS EXACTLY THE KIND OF CHANGE THAT
		// BREAKS IT. The mark is centred against the HEADER rather than against
		// the space the buttons leave, and the only way a right-zone control can
		// move it is by changing that cell — so the cell is compared across the
		// two renders the ruling names, with the new control present in both.
		// ⚠ jsdom performs no layout: this is markup equality, not a centre. The
		// 0.00px offset at 360/390/430 is the run's browser measurement.
		const cell = (root: HTMLElement) =>
			root.querySelector('[data-testid="brand-cluster-text"]')?.closest("div")
				?.outerHTML ?? "";
		const signedIn = header();
		expect(control(signedIn), "the control is absent signed in").not.toBeNull();
		const a = cell(signedIn);
		cleanup();
		const signedOut = header({ viewer: null });
		expect(
			control(signedOut),
			"the control is absent signed out — it is viewer-independent",
		).not.toBeNull();
		const b = cell(signedOut);
		expect(a.length, "the brand cell did not render").toBeGreaterThan(0);
		expect(a).toBe(b);
	});
});
