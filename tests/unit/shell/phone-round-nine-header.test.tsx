// @vitest-environment jsdom

import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
	usePathname: () => "/m/bitcoin-price-50k",
	// HeaderNav's Back control.
	useRouter: () => ({ back: () => {}, push: () => {} }),
}));

import { GlobalHeader } from "@/components/shell/GlobalHeader";
import { HeaderNav } from "@/components/shell/HeaderNav";

/**
 * MOBILE-2m · ADR-0051 A9 D-3 — THE HEADER'S DOM HALF: Back is HIDDEN and not
 * unmounted, and the brand mark's cell is the SAME MARKUP signed in and signed
 * out.
 *
 * ⛔⛔ WHY A RENDER RATHER THAN A SCAN, TWICE OVER, AND NEITHER REASON IS
 * COSMETIC.
 *
 * (1) "Back does not render below 640" has two possible mechanisms and A9 D-3
 * rules ONE of them. A conditional render removes the button from the tree;
 * the phone-variant hide leaves it there and stops painting it. A scan can
 * see that the class is authored and cannot see whether a `{!mobileResponsive &&
 * …}` was wrapped around the node in the same edit — at which point the class is
 * dead, the desktop control's `history.length` probe stops running on the tier,
 * and a resize across 640 restores a button with no state. **The DOM node's
 * existence is the claim, and only a render can hold it.**
 *
 * (2) "the logo is positioned against the header's own centre in the signed-in
 * and signed-out states alike" is an equality between TWO RENDERS. `GlobalHeader`
 * branches on `viewer` five nodes away from the brand cell, and the cheapest way
 * to satisfy a per-state ruling wrongly is to make the cell's class depend on
 * the branch. A scan reads one `className` expression and cannot tell whether it
 * resolves the same way twice.
 *
 * ⚠ WHAT THIS CANNOT CLAIM. jsdom performs no layout and resolves no media
 * query, so nothing here proves the mark is centred at 360, or that Back is
 * invisible. Those are browser measurements — the round's own run records the
 * mark's centre at a CONSTANT 223.13px before this change, i.e. +43.13px off
 * centre at 360 and +8.13 at 430. This file proves the DECLARATIONS reach the
 * right nodes and are viewer-independent.
 *
 * ⛔ NO PHONE-VARIANT LITERAL APPEARS IN THIS FILE — Tailwind v4's source
 * detection scans `tests/`, and a class-shaped literal here becomes a real
 * emitted utility in the production stylesheet (AGENTS.md §8). The prefix is
 * ASSEMBLED AT RUNTIME.
 *
 * ⚠ THE SOURCE-SCAN HALF — that each token sits behind `mobileResponsive &&`, so
 * a THIRD mount inherits the desktop header by omission — is
 * `tests/unit/design/phone-round-nine.test.ts`'s. Nothing here duplicates it.
 *
 * No jest-dom in this repo (AGENTS.md §9) — plain DOM assertions only.
 */

afterEach(cleanup);

beforeEach(() => {
	// VisitorCounter POSTs /api/visits on mount.
	vi.stubGlobal(
		"fetch",
		vi.fn(async () => ({ json: async () => ({ total: 1 }) })),
	);
});

const V = "max-mobile";
const S = ":";
const phone = (utility: string) => V + S + utility;

const VIEWER = { pseudonym: "RedFox001", pfpUrl: "/pfp-placeholder.svg" };

function backControl(root: HTMLElement): HTMLButtonElement {
	const el = root.querySelector('[aria-label="Back"]');
	if (!(el instanceof HTMLButtonElement)) {
		throw new Error(
			"the Back control is not a <button> in the rendered header. A9 D-3 " +
				"hides it below 640; it does not remove it.",
		);
	}
	return el;
}

/**
 * The brand mark's GRID CELL — the element the centring tokens live on.
 *
 * ⛔ ANCHORED THROUGH `brand-cluster-text`, NOT THROUGH `a[href="/"]`. There are
 * TWO home links in this header: `BrandCluster`'s and `HeaderNav`'s Home icon,
 * and the icon comes first in DOM order — so `querySelector('a[href="/"]')`
 * returns the wrong one and every assertion below would silently be about the
 * left zone's flex row instead of the centre cell.
 */
function brandCell(root: HTMLElement): HTMLElement {
	const text = root.querySelector('[data-testid="brand-cluster-text"]');
	const link = text?.closest("a") ?? null;
	const cell = link?.parentElement ?? null;
	if (cell === null) {
		throw new Error(
			"the brand cluster's cell is unreachable. If the header was " +
				"restructured, RE-DERIVE this anchor rather than loosening it.",
		);
	}
	return cell;
}

function renderHeader(viewer: typeof VIEWER | null): HTMLElement {
	const { container } = render(
		<GlobalHeader
			viewer={viewer}
			portfolio={viewer === null ? null : "2480.000000000000000000"}
			spendable={viewer === null ? null : "610.000000000000000000"}
			mobileResponsive
		/>,
	);
	return container;
}

describe("MOBILE-2m · R-3 / A9 D-3 — Back is hidden below 640, never unmounted", () => {
	it("phone-r3::the-button-is-STILL-IN-THE-TREE-with-the-tier-prop-on", () => {
		// ⛔⛔ THE ROW A CONDITIONAL RENDER FAILS. A9 D-3 rules that no back button
		// is CARRIED below 640; the mechanism ruled is the class, because the
		// control's own machinery — the `history.length` probe, the root-route
		// gate, the disabled state — is untouched and must stay reachable at every
		// width. `header-nav-back.test.tsx`'s three rows all mount this component
		// and would become unreachable on the tier if the node went away.
		const back = backControl(render(<HeaderNav mobileResponsive />).container);
		expect(back.getAttribute("aria-label")).toBe("Back");
		// ⚠ AND IT IS HIDDEN BY THE BREAKPOINT ALONE. A `hidden` attribute or an
		// inline `display:none` would hide it at EVERY width — the same visible
		// outcome on a phone and a silent regression at 1440, which no phone
		// measurement in this round would catch.
		expect(back.hasAttribute("hidden")).toBe(false);
		expect(back.style.display).not.toBe("none");
	});

	it("phone-r3::it-carries-the-hide-ONLY-under-the-phone-variant", () => {
		// The whole mechanism, and the reason the desktop header is unchanged BY
		// CONSTRUCTION rather than by measurement: a variant-prefixed rule cannot
		// match at or above 640px.
		const tokens = (
			backControl(
				render(<HeaderNav mobileResponsive />).container,
			).getAttribute("class") ?? ""
		).split(/\s+/);
		expect(tokens, "the ruled hide").toContain(phone("hidden"));
		expect(
			tokens,
			"an UNPREFIXED `hidden` takes the control off the desktop header too.",
		).not.toContain("hidden");
	});

	it("phone-r3::a-mount-that-says-nothing-keeps-its-Back-button", () => {
		// The `= false` default, observed. AGENTS.md §8: a mount that forgets the
		// prop inherits the DESKTOP render rather than an accidental reflow, which
		// is what makes a future third mount safe by omission.
		const back = backControl(render(<HeaderNav />).container);
		expect((back.getAttribute("class") ?? "").split(/\s+/)).not.toContain(
			phone("hidden"),
		);
	});

	it("phone-r3::the-header-actually-THREADS-the-prop-to-it", () => {
		// ⚠ THE PAIR IS THE POINT, AND IT IS ASSERTED THROUGH THE RENDER HERE
		// rather than by reading the mount line: a gate nobody feeds is a control
		// that never hides, and the three rows above would all still pass.
		const on = backControl(renderHeader(VIEWER));
		expect((on.getAttribute("class") ?? "").split(/\s+/)).toContain(
			phone("hidden"),
		);
		cleanup();
		const { container } = render(<GlobalHeader viewer={VIEWER} />);
		expect(
			(backControl(container).getAttribute("class") ?? "").split(/\s+/),
			"the header hides Back even when the mount did not opt in, so the " +
				"`(auth)` group inherits a behaviour it never asked for.",
		).not.toContain(phone("hidden"));
	});
});

describe("MOBILE-2m · R-3 / A9 D-3 — the mark's cell is viewer-independent", () => {
	it("phone-r3::the-brand-cell-is-BYTE-IDENTICAL-signed-in-and-signed-out", () => {
		// ⛔⛔ A9 D-3 RULES BOTH STATES IN ONE SENTENCE — "the logo is positioned
		// against the header's own centre in the signed-in and signed-out states
		// alike" — and that is an EQUALITY, not two separate facts. The cheapest
		// way to satisfy a per-state ruling wrongly is to let the centring depend
		// on a branch five nodes away; string equality on the class attribute is
		// what forecloses it.
		// ⚠ The two renders ARE different elsewhere — the control below proves it,
		// so this equality is not two identical trees being compared.
		const signedIn = brandCell(renderHeader(VIEWER)).getAttribute("class");
		cleanup();
		const signedOut = brandCell(renderHeader(null)).getAttribute("class");
		expect(signedOut).toBe(signedIn);
	});

	it("phone-r3::and-it-carries-the-headers-own-axis-in-BOTH", () => {
		// ⛔ ALL THREE TOKENS OR NONE. `absolute` alone leaves the cell at its
		// static position; `left-1/2` alone does nothing to a grid item; and
		// without the translate the mark's LEFT EDGE sits on the midpoint rather
		// than its centre — half a mark off, which reads as a near miss rather
		// than as a missing rule. `justify-self-center` stays as the ≥640 default
		// (ADR-0045: override, never replace).
		for (const viewer of [VIEWER, null]) {
			const tokens = (
				brandCell(renderHeader(viewer)).getAttribute("class") ?? ""
			).split(/\s+/);
			const who = viewer === null ? "signed out" : "signed in";
			expect(tokens, `${who}: out of the grid`).toContain(phone("absolute"));
			expect(tokens, `${who}: onto the midpoint`).toContain(phone("left-1/2"));
			expect(tokens, `${who}: and back by its own half`).toContain(
				phone("-translate-x-1/2"),
			);
			expect(tokens, `${who}: the 1440 placement survives`).toContain(
				"justify-self-center",
			);
			cleanup();
		}
	});

	it("CONTROL — the two renders genuinely differ where the viewer decides", () => {
		// ⛔ WITHOUT THIS ROW THE EQUALITY ABOVE IS SATISFIED BY A HEADER THAT
		// IGNORES `viewer` ENTIRELY. It is the positive control: signed in there is
		// an identity chip and a Đ cluster, signed out there is a JOIN link and no
		// cluster (ADR-0048: a phone participant is allowed to join, so the CTA
		// renders at every width).
		const inRoot = renderHeader(VIEWER);
		expect(
			inRoot.querySelector('[data-testid="identity-chip-link"]'),
		).not.toBeNull();
		expect(
			inRoot.querySelector('[data-testid="dharma-cluster"]'),
		).not.toBeNull();
		cleanup();

		const outRoot = renderHeader(null);
		expect(outRoot.querySelector('a[href="/sign-in"]')).not.toBeNull();
		expect(outRoot.querySelector('[data-testid="dharma-cluster"]')).toBeNull();
	});
});

describe("MOBILE-2m — the signed-out header at the floor", () => {
	it("phone-r3::signed-out-and-signed-in-agree-on-BOTH-of-this-rounds-controls", () => {
		// ⛔⛔ THE ADVERSARIAL CASE, STATED AS ONE ASSERTION PER CONTROL. A9 D-3
		// changes two things in this row — Back goes, and the mark leaves the grid
		// — and `GlobalHeader` is mounted by BOTH route groups, one of which is
		// signed out by definition (`/sign-in`, `/sign-in/otp`, `/onboarding`).
		// ⚠ AND `/sign-in` CAN SERVE THE SIGNED-IN HEADER TOO: that route has no
		// session redirect, so a fully-onboarded viewer who navigates there gets
		// `viewer !== null` on an `(auth)` mount. Both states are live on both
		// route groups, which is exactly why "alike" has to be checked rather than
		// reasoned about.
		const signedIn = renderHeader(VIEWER);
		const inBack = backControl(signedIn).getAttribute("class");
		const inCell = brandCell(signedIn).getAttribute("class");
		cleanup();

		const signedOut = renderHeader(null);
		expect(
			backControl(signedOut).getAttribute("class"),
			"the Back control is styled differently for a signed-out reader.",
		).toBe(inBack);
		expect(
			brandCell(signedOut).getAttribute("class"),
			"the brand cell is placed differently for a signed-out reader.",
		).toBe(inCell);
	});
});

/**
 * ⛔⛔ THE GRID FIX HAD NO GUARD, AND THAT IS WORSE THAN IT SOUNDS.
 *
 * `3cb63b2d` fixed a defect in which making the brand cell `absolute` removed it
 * as a grid ITEM, so auto-placement slid the identity zone into the CENTRE track
 * and the avatar was painted on top of the logo. Measured at 390 before the fix:
 * `grid-template-columns: 131px 44px 131px`, chip at x 173, mark at x 171, both
 * centred on 195.
 *
 * ⚠⚠ EVERY NUMBER THIS ROUND MEASURES SAID THE HEADER WAS CORRECT. The mark's own
 * centre was 0.00px from the header's, the document did not overflow, nothing moved
 * at 640 or 1440, and both walls passed. A SCREENSHOT found it. So the fix is
 * precisely the kind that regresses silently — and until this block it was pinned
 * by nothing: deleting `col-start-3` would have restored the defect with all 54 of
 * this round's other guards green. Named by `@code-reviewer`.
 *
 * ⚠ A RENDER, NOT A SOURCE SCAN, and deliberately: jsdom performs no layout, so it
 * cannot see the collision — but it CAN see that the placement is declared on the
 * right element, gated on the prop, and absent when the prop is. That is the half a
 * static check can hold honestly, and the geometry is held by the screenshots and by
 * the live measurement recorded in the run report. Claiming more here would be a
 * guard asserting a spelling while naming a property.
 */
describe("MOBILE-2m — the identity zone names its column, so a sibling leaving the flow cannot move it", () => {
	function identityZone(root: HTMLElement): HTMLElement {
		const cell = brandCell(root);
		const row = cell.parentElement;
		if (row === null) {
			throw new Error("the brand cell has no grid row parent.");
		}
		// ⚠ THE LAST DIRECT CHILD OF THE ROW, located structurally rather than by a
		// testid — this zone deliberately carries none (it is `dharma-cluster`'s and
		// `IdentityCluster`'s host, and `dharma-cluster.test.tsx`'s T4 guard walks
		// its `.children` by index, so a testid here invites someone to wrap it).
		const zone = row.lastElementChild;
		if (!(zone instanceof HTMLElement)) {
			throw new Error("the header row has no final zone.");
		}
		return zone;
	}

	it("phone-r3::the-identity-zone-declares-col-start-3-below-640", () => {
		const zone = identityZone(renderHeader(VIEWER));
		const tokens = (zone.getAttribute("class") ?? "").split(/\s+/);
		expect(
			tokens,
			"the identity zone no longer names its grid column. With the brand cell " +
				"absolutely positioned below 640 there are only TWO in-flow items, so " +
				"auto-placement puts this one in track 2 — the centre — and the avatar " +
				"lands on top of the logo. Every geometric assertion in this round still " +
				"passes when that happens; it was found in a screenshot.",
		).toContain(phone("col-start-3"));
	});

	it("phone-r3::and-it-is-GATED-so-a-third-mount-inherits-the-desktop-row", () => {
		// The signed-out arm too: the zone holds JOIN rather than the chip there,
		// and it is placed by the same declaration.
		for (const viewer of [VIEWER, null]) {
			const zone = identityZone(renderHeader(viewer));
			expect(
				(zone.getAttribute("class") ?? "").split(/\s+/),
				`the identity zone lost its column in the ${viewer === null ? "signed-out" : "signed-in"} arm.`,
			).toContain(phone("col-start-3"));
			cleanup();
		}
	});

	it("phone-r3::a-mount-that-omits-the-prop-gets-NO-column-token", () => {
		// ⛔ THE POLARITY, WHICH IS THE WHOLE REASON THIS IS A PROP. A mount that
		// says nothing must inherit the desktop row untouched — including this
		// token, which would otherwise be the one breakpoint class in the file
		// reaching every mount at once. It shipped ungated for one review cycle.
		const root = render(
			<GlobalHeader viewer={VIEWER} portfolio="10" spendable="10" stars={1} />,
		).container;
		const zone = identityZone(root);
		expect(
			(zone.getAttribute("class") ?? "").split(/\s+/),
			"an ungated grid placement here reaches the (auth) mount and every " +
				"future mount at once — the failure AGENTS.md §8 records for " +
				"`OnboardingDeck`, one file up the same chain.",
		).not.toContain(phone("col-start-3"));
	});
});
