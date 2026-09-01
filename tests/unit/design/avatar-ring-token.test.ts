// SPDX-License-Identifier: AGPL-3.0-or-later

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * PRIMITIVES-1 C1 (rulings D5 / D6) — the avatar ring is bound to its ratified
 * token IN THE PRIMITIVE, and no consumer re-binds it locally.
 *
 * Two defects are pinned shut here. (1) `after:mix-blend-darken` took the
 * DARKER of ring and backdrop, so against `AvatarFallback`'s `bg-muted` (n1,
 * darker than the n2 ring) the ring blended away and the avatar lost its edge —
 * the path taken whenever the placeholder image fails. Its `dark:` sibling was
 * dead outright: `.dark` is never applied anywhere in `src/**`. (2) The ring
 * arrived via `after:border-border` → `--border`, leaving the ratified
 * `--avatar-ring` (`globals.css`, 1px solid n2 — `design-token-contract.md:209`,
 * values-log `:178`) with ZERO consumers; an orphaned token gets deleted or
 * drifts at the next branding pass, and a `--border` re-point would silently
 * split the two paths apart. Binding the token explicitly is what makes the
 * pixels correct today AND survivable tomorrow.
 *
 * Source-text assertions, deliberately: jsdom cannot compute `::after`, so the
 * class binding IS the observable (AGENTS.md §9 — no jest-dom). The render-side
 * companion is `tests/unit/shell/identity-cluster-link.test.tsx`.
 */

/**
 * PFP-UI-1 (2026-08-26) — ONE RING RULE, ONE SHAPE, ACROSS ALL EIGHT MOUNTS.
 *
 * Everything below this line is the second half of the same rule the block
 * above states. That block pinned the ring to its token IN THE PRIMITIVE; this
 * one asserts the rule reaches the two mounts the primitive cannot serve, and
 * that it reaches them by the same MECHANISM.
 *
 * ⚠ THE MECHANISM HALF IS NOT PEDANTRY — IT WAS A REAL INCONSISTENCY. One
 * token, `--avatar-ring`, shipped with two implementations: a zero-cost
 * `::after` overlay on the six primitive mounts, and a real layout border on
 * the onboarding page. Under Tailwind preflight's `box-sizing: border-box` a
 * real border eats 1px per side, so a 128px box rendered a 126px picture. A
 * parity test that only asked "is the ring present?" would have called that
 * mount compliant.
 *
 * ⛔ AND IT DELIBERATELY DEPARTS FROM `identity-cluster-carries-no-local-ring-override`
 * ABOVE, so read this before "fixing" either wrapper. That test says no
 * consumer re-binds the ring locally, and it is right about the case it
 * guards: `IdentityCluster` had a workaround for a primitive that was broken,
 * and once the primitive was fixed the workaround was redundant. The two
 * wrappers here are the opposite case — the primitive cannot reach them at
 * all. Mount 7 cannot adopt it without deleting the only coverage in the repo
 * that proves the profile hero renders the right image (the radix Avatar
 * defers its `<img>` under jsdom; `grep AvatarImage tests/` returns zero hits
 * suite-wide). Mount 8 structurally cannot: `AvatarImage` renders its own
 * `<img>` and cannot wrap a `next/image`. So the rule is unchanged — re-bind
 * ONLY where the primitive cannot reach — and the declaration is copied rather
 * than extracted, because extracting it would mean editing a file serving six
 * mounts across five surfaces to dedupe a class string.
 *
 * ⚠ WHAT THESE ASSERTIONS CANNOT DO, STATED SO THE GREEN IS NOT OVERREAD.
 * They are source-text assertions and jsdom performs no layout. They prove the
 * utilities sit on the right elements. They CANNOT prove the box resolves to
 * 188×188, cannot see the 256×256 blow-out a naive wrapper produces, and
 * cannot tell a circle from an ellipse. A class that does not compile at all
 * reads as present here, because this asserts the source string and not the
 * resolved rule. The visual proof is the founder pass on staging.
 */

const ROOT = process.cwd();
const AVATAR = "src/components/ui/avatar.tsx";
const CLUSTER = "src/components/shell/IdentityCluster.tsx";
const TOKENS = "src/app/globals.css";

/** Mount 6 — the onboarding deck's `.idhero`. */
const DECK = "src/components/onboarding/figures.tsx";
/** Mount 7 — the profile hero. Wrapper-ringed. */
const HERO = "src/components/profile/IdentityCard.tsx";
/** Mount 8 — the onboarding page's identity hero. Wrapper-ringed. */
const ONBOARD = "src/app/(auth)/onboarding/page.tsx";

/**
 * The five files holding the SIX mounts that take their ring from the
 * primitive (`IdentityCluster` holds two). These inherit the ring by importing
 * `Avatar`; what they must not do is suppress it.
 */
const PRIMITIVE_MOUNT_FILES = [
	CLUSTER,
	"src/components/discovery/HeroPanels.tsx",
	"src/components/debate/ArgProfile.tsx",
	"src/components/profile/ArgumentList.tsx",
	DECK,
];

const RING = "after:[border:var(--avatar-ring)]";

function read(file: string): string {
	return readFileSync(join(ROOT, file), "utf8");
}

/** Comments are prose ABOUT the binding, never the binding itself. */
function stripComments(source: string): string {
	return source
		.replace(/\/\*[\s\S]*?\*\//g, "")
		.replace(/^\s*\/\/.*$/gm, "")
		.replace(/\/\/[^"'`\n]*$/gm, "");
}

/** The `Avatar` ROOT's base class string — the ring lives on its `::after`. */
function avatarRootClasses(): string {
	const match = stripComments(read(AVATAR)).match(
		/data-slot="avatar"[\s\S]*?className=\{cn\(\s*"([^"]*)"/,
	);
	if (match?.[1] === undefined) {
		throw new Error(
			`${AVATAR}: could not read the Avatar root's cn() class string — the ` +
				"guard is reading the wrong shape, not the component being clean.",
		);
	}
	return match[1];
}

describe("avatar ring — bound to --avatar-ring in the primitive", () => {
	it("primitive-binds-the-ratified-token", () => {
		expect(avatarRootClasses()).toContain(RING);
	});

	it("primitive-drops-the-blend-and-the-border-alias", () => {
		const cls = avatarRootClasses();
		// `mix-blend` in ANY spelling: the `darken` that ate the ring on the
		// fallback path, and the dead `dark:` sibling. (`bg-blend-color` on
		// AvatarBadge is a different property and out of scope — matching
		// `mix-blend` rather than `blend` keeps it that way.)
		expect(cls).not.toContain("mix-blend");
		// The ring must not ALSO arrive through `--border`; a re-point of
		// `--border` would then split one ring into two values.
		expect(cls).not.toContain("border-border");
	});

	it("identity-cluster-carries-no-local-ring-override", () => {
		// The primitive is now correct, so the consumer-side workaround is gone:
		// no local binding, no blend reset, no `avatarRing` local at all.
		const source = stripComments(read(CLUSTER));
		expect(source).not.toContain(RING);
		expect(source).not.toContain("mix-blend");
		expect(source).not.toContain("avatarRing");
	});

	it("token-is-defined-so-the-binding-resolves", () => {
		// D6's point: a bound token that no longer exists draws NO ring at all.
		expect(read(TOKENS)).toMatch(/^\s*--avatar-ring:\s*\S/m);
	});
});

/**
 * Pull one `className="…"` string out of a source file by the element that
 * carries it. Throws rather than returning `undefined`, so a guard that has
 * drifted off its target fails LOUDLY instead of vacuously asserting against
 * nothing — the failure mode that makes a source scan worse than no test.
 */
function classesOf(file: string, pattern: RegExp, what: string): string {
	const match = stripComments(read(file)).match(pattern);
	if (match?.[1] === undefined) {
		throw new Error(
			`${file}: could not read ${what}'s class string — the guard is reading ` +
				"the wrong shape, not the mount being clean.",
		);
	}
	return match[1];
}

/** Mount 7's wrapper — identified by the ring it carries, not by position. */
const heroWrapper = () =>
	classesOf(
		HERO,
		/<span className="([^"]*after:\[border:var\(--avatar-ring\)\][^"]*)"/,
		"the profile hero's ring wrapper",
	);

/** Mount 7's `<img>`. */
const heroImg = () =>
	classesOf(HERO, /<img[\s\S]*?className="([^"]*)"/, "the profile hero <img>");

/** Mount 8's `<Image>`. */
const onboardImage = () =>
	classesOf(
		ONBOARD,
		/<Image[\s\S]*?className="([^"]*)"/,
		"the onboarding hero <Image>",
	);

/** Mount 6's `IdentityHero` body — figures.tsx holds other figures too. */
const identityHeroBody = () =>
	classesOf(
		DECK,
		/(function IdentityHero\([\s\S]*?\n})/,
		"the IdentityHero function body",
	);

describe("PFP-UI-1 · ring parity — all eight mounts carry --avatar-ring", () => {
	it("ring-parity::the-six-primitive-mounts-do-not-suppress-the-overlay", () => {
		// The ring reaches 1–6 by import, so the only way to lose it is to null
		// it at the mount. `after:hidden` did exactly that on the deck hero for
		// as long as that mount was a rounded square: the overlay is round, so
		// it had to be suppressed to keep the corners square. It is gone now,
		// and this asserts nobody re-adds it anywhere.
		for (const file of PRIMITIVE_MOUNT_FILES) {
			const source = stripComments(read(file));
			expect(source, `${file} suppresses the ring overlay`).not.toContain(
				"after:hidden",
			);
			// Nulling the primitive's radius squares off a mount whose ring is
			// round — the same divergence one layer down.
			expect(source, `${file} nulls the primitive radius`).not.toContain(
				"rounded-none",
			);
		}
	});

	it("ring-parity::mount-7-the-profile-hero-carries-the-ring", () => {
		// This mount had NO ring at all before PFP-UI-1 — the one gap in eight.
		expect(heroWrapper()).toContain(RING);
	});

	it("ring-parity::mount-8-the-onboarding-hero-carries-the-ring", () => {
		expect(stripComments(read(ONBOARD))).toContain(RING);
	});
});

describe("PFP-UI-1 · ring MECHANISM — an inset overlay, never a layout border", () => {
	it("ring-mechanism::mounts-7-and-8-bind-the-token-only-through-after", () => {
		// The defect this pins shut: `[border:var(--avatar-ring)]` sitting
		// directly on an image element. Same token, same colour, same apparent
		// result — and 2px of the box eaten, because a real border participates
		// in layout and an `::after` overlay does not. Matching the token
		// WITHOUT an `after:` prefix is what separates the two mechanisms; a
		// presence check alone cannot.
		for (const file of [HERO, ONBOARD]) {
			expect(
				stripComments(read(file)),
				`${file} binds --avatar-ring as a real border, which eats 1px per side`,
			).not.toMatch(/(?<!after:)\[border:var\(--avatar-ring\)\]/);
		}
	});

	it("ring-mechanism::neither-image-element-carries-a-border-utility", () => {
		// The overlay lives on the wrapper; the image itself stays borderless,
		// so its rendered box equals its declared box (128px, not 126px).
		expect(heroImg()).not.toMatch(/\bborder\b|\[border:/);
		expect(onboardImage()).not.toMatch(/\bborder\b|\[border:/);
	});
});

describe("PFP-UI-1 · shape — the three converted mounts are circles", () => {
	it("shape::mount-6-lets-the-primitive-be-round", () => {
		// The frame owned an `--imgr` radius and clipped the round primitive
		// square with `overflow-hidden`; three `rounded-none` overrides squared
		// the parts off inside it. All four existed only to defeat a circle.
		const body = identityHeroBody();
		expect(body).not.toContain("rounded-none");
		expect(body).not.toContain("overflow-hidden");
		expect(body).not.toContain("after:hidden");
		expect(body).not.toContain("rounded-(--imgr)");
	});

	it("shape::mount-7-crops-the-hero-round", () => {
		const cls = heroImg();
		expect(cls).toContain("rounded-full");
		expect(cls).not.toContain("rounded-[var(--imgr)]");
	});

	it("shape::mount-8-crops-the-onboarding-hero-round-and-keeps-unoptimized", () => {
		expect(onboardImage()).toContain("rounded-full");
		expect(onboardImage()).not.toContain("rounded-(--imgr)");
		// `unoptimized` is load-bearing, not incidental: `next.config.ts`
		// declares no `images.remotePatterns`, so an optimized `next/image` on
		// an R2 host throws at render — on the mandatory first screen after
		// signup. Dropping it while changing the class string beside it is the
		// plausible accident this pins shut.
		expect(stripComments(read(ONBOARD))).toContain("unoptimized");
	});
});

describe("PFP-UI-1 · A-5 — the wrapper must not swallow the sizing chain", () => {
	/**
	 * ⛔ BOTH HALVES ARE ASSERTED, AND THAT IS THE WHOLE POINT OF THIS BLOCK.
	 * The 188px box exists because the card root is a grid item stretched to a
	 * declared 188px row, which gives `xl:h-full` a definite percentage base.
	 * A wrapper between them makes that base `auto`; `w-auto` + `aspect-ratio`
	 * then fall back to the intrinsic asset size and the image renders 256×256,
	 * overflowing the band by 68px in both axes. Measured, not reasoned.
	 *
	 * A one-sided check — "the wrapper has the utilities" — passes while the
	 * `<img>` ALSO still has them, which is precisely the broken state.
	 */
	const SIZING = ["xl:aspect-square", "xl:h-full", "xl:w-auto"];

	it("sizing-chain::the-wrapper-owns-the-box", () => {
		const cls = heroWrapper();
		for (const utility of SIZING) {
			expect(cls, `the wrapper is missing ${utility}`).toContain(utility);
		}
		// The below-xl box, which must survive unchanged at 56×56.
		expect(cls).toContain("h-14");
		expect(cls).toContain("w-14");
	});

	it("sizing-chain::the-img-fills-the-wrapper-and-owns-none-of-it", () => {
		const cls = heroImg();
		expect(cls).toContain("size-full");
		for (const utility of SIZING) {
			expect(cls, `the <img> still carries ${utility}`).not.toContain(utility);
		}
		expect(cls).not.toContain("h-14");
		expect(cls).not.toContain("w-14");
	});
});
