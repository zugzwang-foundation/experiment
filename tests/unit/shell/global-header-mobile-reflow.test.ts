import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * MOBILE-1 · Phase A — THE HEADER'S 60px ROW AT PHONE WIDTH: what drops, what
 * survives, and what this task is FORBIDDEN to touch.
 *
 * WHAT THIS GUARD IS FOR. `GlobalHeader` is a `1fr auto 1fr` grid with a
 * 1440px cap and — by design-language §1.7 — no responsive breakpoints at all.
 * Its two side zones carry seven controls between them. At 1440 the left zone
 * uses 427.20px of a 568.00px track; every control carries `shrink-0`, so that
 * is a HARD-OVERFLOW budget rather than a compression budget (the component's
 * own docblock measures it). At 375px the same row is asked to hold the same
 * seven controls in ~327px of content box, and nothing degrades gracefully:
 * they overflow, and the page gains a horizontal scrollbar on every route.
 *
 * ⇒ So four things are hidden below 640px: the two off-site/decorative
 * left-zone controls (Radio · GitHub stars) behind one wrapper, the §21.1
 * register divider, the visitor counter, and the brand cluster's
 * wordmark+countdown text block.
 *
 * ⛔⛔ EVERY ONE OF THOSE FOUR HIDES IS GATED ON A `mobileResponsive` PROP,
 * NOT UNCONDITIONAL. `GlobalHeader` is mounted by BOTH `(public)/layout.tsx`
 * (Discovery, `/m/[slug]`) and `(auth)/layout.tsx` (`/sign-in`,
 * `/sign-in/otp`, `/onboarding`) — and ADR-0045 is explicit that auth/join
 * surfaces "remain governed by the original constraint... gated, not made
 * responsive." A class applied unconditionally in `GlobalHeader.tsx` reaches
 * BOTH mounts; there is no other seam between them. So every reflow class in
 * this file, `BrandCluster.tsx` and `VisitorCounter.tsx` is wrapped in
 * `cn(base, mobileResponsive && "max-mobile:hidden")`, the prop defaults
 * `false`, and only `(public)/layout.tsx` passes it. This describe block's
 * first test is the one that makes that call-site asymmetry itself a
 * guarded fact rather than a claim in a comment.
 *
 * ⛔⛔ THE NEGATIVE HALF IS THE LOAD-BEARING HALF OF THIS FILE. Five elements
 * must stay visible at EVERY width and each is pinned by an explicit negative:
 * `HeaderNav` (the only navigation), `RulesControl` (SPEC.1 §21.9 — the
 * onboarding deck's only re-show entry point, "present for every viewer,
 * authenticated or not" — unconditional in the SPEC, so it cannot be hidden
 * at any width, not even conditionally), `BrandCluster` (the home link),
 * and `DharmaCluster` + `IdentityCluster` (balance and identity).
 * ⚠ `IdentityCluster` especially: it hosts the JOIN CTA, which is PHASE B's
 * subject and is governed by two independent conditions ruled there (a width
 * rule AND a touch-primary rule — MOBILE-1 §4). Phase A adding a width-only
 * hide to it would land half of Phase B's mechanism under Phase A's review,
 * on a critical-path surface Phase A is explicitly not cleared for. This
 * guard reddens if it does.
 *
 * ⛔⛔ THE §21.1 REGISTER DIVIDER CARRIES NO `data-testid`, EVER (SG6). It is
 * a named untouchable — `docs/plans/HEADER-PORTFOLIO.md`'s SG6: "The divider
 * is a named untouchable. It carries no `data-testid` and must not gain
 * one." `tests/unit/shell/dharma-cluster.test.tsx`'s T4 guard locates it by
 * its `w-px` class among the right zone's direct children, and this file
 * does the same rather than adding a hook that guard already forbids.
 *
 * ⚠ THE `<header>` TAG AND ITS `h-[60px]` ROW ARE READ, NEVER WRITTEN.
 * `tests/unit/design/discovery-height-chain.test.ts` derives `(public)/layout.tsx`'s
 * `min-h-[calc(100vh-60px-2px)]` from exactly those two declarations, so a class
 * added to either would silently move every `(public)` surface's viewport floor.
 * Asserted here as well, from inside the task that could break it — a same-file
 * second guard against this diff specifically, not a duplicate of that suite.
 *
 * ⚠ WHY A SOURCE SCAN AND NOT A RENDER TEST. jsdom performs no layout and
 * resolves no media query or Tailwind utility, so "hidden below 640px" is
 * invisible to a render test. `discovery-height-chain.test.ts:19-24` states the
 * same limit for the same reason. Whether the shortened row actually fits 375px
 * without horizontal overflow is measurable in a real browser and only there —
 * measured this session: 394px of overflow before this diff, 0px after.
 *
 * ⚠ V-REGISTER DISCIPLINE. This reads the SHIPPED FILES.
 */

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

const HEADER = "src/components/shell/GlobalHeader.tsx";
const BRAND = "src/components/shell/BrandCluster.tsx";
const VISITOR = "src/components/shell/VisitorCounter.tsx";
const IDENTITY = "src/components/shell/IdentityCluster.tsx";
const PUBLIC_LAYOUT = "src/app/(public)/layout.tsx";
const AUTH_LAYOUT = "src/app/(auth)/layout.tsx";

/** The variant MOBILE-1 §4 mints — phone and below, everything under 640px. */
const HIDE_BELOW_640 = "max-mobile:hidden";
/** The exact conditional every reflow class in this diff is wrapped in. */
const GATED_HIDE = `mobileResponsive && "${HIDE_BELOW_640}"`;

/**
 * Every literal className carried by a node bearing `data-testid="<testid>"`, in
 * source order — one entry per occurrence.
 *
 * ⚠ TOLERANT OF ATTRIBUTE COMMENTS. Several nodes in this tree carry a
 * multi-line `//` rationale between their attributes, and this header is
 * heavily commented — a guard that throws the first time somebody documents
 * an attribute is a guard that gets deleted.
 *
 * ⛔ THE WINDOW IS BOUNDED BY THE NEXT `<`, which is this tag's first child or
 * its own close. That bound is what stops a node whose className was DELETED
 * from silently borrowing a DESCENDANT's and reporting green.
 */
function nodeClasses(source: string, file: string, testid: string): string[][] {
	const marker = `data-testid="${testid}"`;
	const found: string[][] = [];
	let at = source.indexOf(marker);
	while (at !== -1) {
		const bound = source.indexOf("<", at);
		const window = source.slice(at, bound === -1 ? source.length : bound);
		const m = /className=\{?cn\(|className="([^"]*)"/.exec(window);
		if (!m) {
			throw new Error(
				`${file}: the node carrying ${marker} has no className before its ` +
					`tag closes.`,
			);
		}
		found.push(
			m[1] !== undefined
				? (m[1] ?? "").split(/\s+/).filter(Boolean)
				: literalArgOf(window, m.index),
		);
		at = source.indexOf(marker, at + marker.length);
	}
	if (found.length === 0) {
		throw new Error(
			`${file}: no node with ${marker}. MOBILE-1 Phase A keys its phone-width ` +
				`hides off this testid; if the header was restructured, re-derive this ` +
				`guard rather than deleting it.`,
		);
	}
	return found;
}

/** The first string-literal argument to a `cn(` call starting at `fromIndex`
 * within `window` — i.e. the base (desktop-unconditional) class list. */
function literalArgOf(window: string, fromIndex: number): string[] {
	const rest = window.slice(fromIndex);
	const m = /cn\(\s*"([^"]*)"/.exec(rest);
	if (!m) {
		throw new Error(`no string-literal first argument found in: ${rest}`);
	}
	return (m[1] ?? "").split(/\s+/).filter(Boolean);
}

/**
 * The source text BETWEEN a testid-bearing node's attributes and its closing
 * tag — i.e. what that node WRAPS. This is the structural half of the header
 * change: which controls landed inside the hidden wrapper, and which stayed
 * outside it, is the whole point and is invisible to a className assertion.
 *
 * ⛔ THE "FIRST `</tag>` IS THIS NODE'S OWN" ASSUMPTION IS MADE FALSIFIABLE
 * RATHER THAN ASSUMED. It holds only while the node has no same-tag descendant,
 * so the window is scanned for a nested opener and the helper throws if it finds
 * one. Without that check a later nested `<div>` would silently shrink the
 * window to the CHILD's bounds and every containment assertion below would be
 * measuring a different element while still reporting green.
 */
function innerWindow(
	source: string,
	file: string,
	testid: string,
	closing: string,
): string {
	const marker = `data-testid="${testid}"`;
	const at = source.indexOf(marker);
	if (at === -1) {
		throw new Error(`${file}: no node with ${marker}.`);
	}
	const end = source.indexOf(closing, at);
	if (end === -1) {
		throw new Error(`${file}: node ${marker} has no ${closing}.`);
	}
	const window = source.slice(at, end);
	const opener = `<${closing.slice(2, -1)}`;
	if (window.includes(opener)) {
		throw new Error(
			`${file}: node ${marker} now contains a nested ${opener}, so the first ` +
				`${closing} is no longer its own and this window is unsound. ` +
				`Re-derive the bounds rather than loosening the assertions.`,
		);
	}
	return window;
}

/**
 * The window from a literal substring anchor to the next tag-closing `>` —
 * for elements with no `data-testid` (the SG6 divider). Good enough here
 * because no className value in this file contains a literal `>`.
 */
function tagWindowFrom(source: string, file: string, anchor: string): string {
	const at = source.indexOf(anchor);
	if (at === -1) {
		throw new Error(`${file}: anchor not found: "${anchor}".`);
	}
	const end = source.indexOf(">", at);
	if (end === -1) {
		throw new Error(`${file}: no closing ">" found after anchor "${anchor}".`);
	}
	return source.slice(at, end);
}

/** Every source line carrying a JSX mount of `<Component`. */
function mountLines(source: string, component: string): string[] {
	return source
		.split("\n")
		.filter((line) => new RegExp(`<${component}\\b`).test(line));
}

describe("global header mobile reflow — the mobileResponsive prop, not an unconditional class", () => {
	it("header-mobile::GlobalHeader-declares-the-prop-defaulting-false", () => {
		expect(
			read(HEADER),
			`${HEADER}: no \`mobileResponsive = false\` default found. Every ` +
				`reflow class in this file must be OFF unless a caller opts in — ` +
				`the (auth) mount relies on the default rather than passing \`false\`.`,
		).toMatch(/mobileResponsive\s*=\s*false/);
	});

	it("header-mobile::ONLY-the-public-layout-mount-passes-mobileResponsive", () => {
		const publicSrc = read(PUBLIC_LAYOUT);
		const authSrc = read(AUTH_LAYOUT);

		const publicMount = mountLines(publicSrc, "GlobalHeader").join("\n");
		expect(
			publicMount.length > 0 ||
				/<GlobalHeader[\s\S]*?\/>/.test(
					publicSrc.slice(publicSrc.indexOf("<GlobalHeader")),
				),
			`${PUBLIC_LAYOUT}: no <GlobalHeader mount found.`,
		).toBe(true);
		const publicTag = /<GlobalHeader\b[\s\S]*?\/>/.exec(publicSrc);
		if (!publicTag) {
			throw new Error(`${PUBLIC_LAYOUT}: no <GlobalHeader ... /> tag found.`);
		}
		expect(
			publicTag[0],
			`${PUBLIC_LAYOUT}: its <GlobalHeader> mount does not pass ` +
				`\`mobileResponsive\`. This is the (public) route group — Discovery ` +
				`and /m/[slug] — so it must opt in.`,
		).toMatch(/\bmobileResponsive\b/);

		const authTag = /<GlobalHeader\b[\s\S]*?\/>/.exec(authSrc);
		if (!authTag) {
			throw new Error(`${AUTH_LAYOUT}: no <GlobalHeader ... /> tag found.`);
		}
		expect(
			authTag[0],
			`${AUTH_LAYOUT}: its <GlobalHeader> mount now passes ` +
				`\`mobileResponsive\`. ADR-0045 leaves auth/join surfaces gated, not ` +
				`made responsive — /sign-in, /sign-in/otp and /onboarding must ` +
				`render this header exactly as before MOBILE-1.`,
		).not.toMatch(/\bmobileResponsive\b/);
	});
});

describe("global header mobile reflow — the secondary controls drop out below 640px", () => {
	it("header-mobile::the-secondary-controls-wrapper-holds-Radio-and-GitHub-ONLY-and-gates-its-hide", () => {
		const [classes, ...extra] = nodeClasses(
			read(HEADER),
			HEADER,
			"header-secondary-controls",
		);

		// ONE wrapper. Two would mean two class strings that can drift apart.
		expect(extra).toEqual([]);

		// The wrapper reproduces the left zone's own row shape, so at ≥640px the
		// row it replaces is byte-identical: same flex, same alignment, same
		// gap. `shrink-0` is new and load-bearing — GitHubStars.tsx documents
		// every left-zone control as `shrink-0` (a hard-overflow budget, never
		// a compression one); without it this wrapper is the zone's only
		// compressible node.
		expect(classes).toContain("flex");
		expect(classes).toContain("shrink-0");
		expect(classes).toContain("items-center");
		expect(classes).toContain("gap-2");

		const window = innerWindow(
			read(HEADER),
			HEADER,
			"header-secondary-controls",
			"</div>",
		);
		expect(
			window,
			`${HEADER}: the secondary-control wrapper's cn() call carries no ` +
				`\`${GATED_HIDE}\` — an unconditional hide here would also apply to ` +
				`the (auth) mount.`,
		).toContain(GATED_HIDE);

		expect(window).toContain("<RadioSlot");
		expect(window).toContain("<GitHubStarsView");

		// ⛔⛔ AND `RulesControl` IS OUTSIDE IT NOW. SPEC.1 §21.9: it is the
		// onboarding deck's only re-show entry point and is "present for every
		// viewer, authenticated or not" — unconditionally, in the spec text
		// itself. It cannot be hidden at any width, not even conditionally.
		expect(
			window.includes("<RulesControl"),
			`${HEADER}: \`RulesControl\` is INSIDE the hidden wrapper. SPEC.1 ` +
				`§21.9 requires it present for every viewer at every width — it is ` +
				`the onboarding deck's ONLY re-show entry point. It must be a ` +
				`sibling of the wrapper, not a child.`,
		).toBe(false);

		// ⛔⛔ AND `HeaderNav` IS OUTSIDE IT. It is the header's only navigation —
		// Back and Home — so hiding it at phone width leaves a mobile reader with
		// no in-app way out of a route except the browser's own chrome.
		expect(
			window.includes("<HeaderNav"),
			`${HEADER}: \`HeaderNav\` is INSIDE the \`${HIDE_BELOW_640}\` wrapper, ` +
				`so the header's only navigation disappears at phone width. It must ` +
				`stay a sibling of the wrapper, not a child of it.`,
		).toBe(false);
	});

	it("header-mobile::RulesControl-is-mounted-exactly-once-outside-any-hidden-wrapper", () => {
		const source = read(HEADER);
		const lines = mountLines(source, "RulesControl");
		expect(
			lines.length,
			`${HEADER}: no \`<RulesControl\` mount found. If it moved, re-derive ` +
				`this guard rather than deleting it.`,
		).toBe(1);
		expect(lines[0]?.includes(HIDE_BELOW_640)).toBe(false);
	});
});

describe("global header mobile reflow — the right zone sheds its anti-conflation tail", () => {
	it("header-mobile::the-register-divider-carries-NO-testid-ever-SG6", () => {
		const source = read(HEADER);
		// SG6, verbatim from docs/plans/HEADER-PORTFOLIO.md: "The divider is a
		// named untouchable. It carries no `data-testid` and must not gain one."
		expect(
			source,
			`${HEADER}: found "header-register-divider" (or similar). SG6 forbids ` +
				`a testid on the §21.1 divider — locate it by its \`w-px\` class, ` +
				`exactly as dharma-cluster.test.tsx's T4 guard already does.`,
		).not.toMatch(/data-testid="header-register-divider"/);
	});

	it("header-mobile::the-register-divider-keeps-its-hairline-and-gates-its-hide", () => {
		const window = tagWindowFrom(
			read(HEADER),
			HEADER,
			"mx-3 h-[30px] w-px bg-n2",
		);

		// ⛔ THE DESKTOP HALF. This is the SPEC.1 §21.1 anti-conflation boundary —
		// engine-derived Đ figures left of it, the vanity visitor count right of
		// it — not decoration. Geometry unchanged: a 30px hairline, 12px either
		// side. (The literal string IS the anchor above, so its presence is
		// tautological; asserted anyway so a future refactor that keeps the
		// anchor string but reorders tokens still reads as intended here.)
		expect(window).toContain("mx-3 h-[30px] w-px bg-n2");

		// ⚠ THE MOBILE HALF, PAIRED WITH THE COUNTER BELOW BY NECESSITY. The
		// divider's whole job is to hold the visitor count off the Đ cluster;
		// with the count hidden it separates the identity chip from nothing, so
		// it hides WITH the thing it exists to fence off.
		expect(
			window,
			`${HEADER}: the §21.1 register divider's cn() call carries no ` +
				`\`${GATED_HIDE}\`.`,
		).toContain(GATED_HIDE);
	});

	it("header-mobile::VisitorCounter-is-mounted-directly-with-NO-wrapper-and-receives-the-prop", () => {
		// ⛔⛔ NO WRAPPER, ON PURPOSE. `tests/unit/shell/dharma-cluster.test.tsx`'s
		// T4 guard (SG5) walks `dharma-cluster`'s parent's direct `.children` and
		// requires `screen.getByTestId("visitor-counter")` to be found among
		// them, immediately right of the register divider. A `<div
		// data-testid="...">` wrapper around `<VisitorCounter />` pushes the real
		// `visitor-counter` node down one level — invisible to a className check,
		// and it is exactly what broke T4 the first time this task landed. The
		// hide lives on VisitorCounter's own root node instead (its only call
		// site is this file), which keeps the DOM shape T4 depends on
		// byte-identical.
		const source = read(HEADER);
		expect(source).not.toContain("header-visitor-counter-slot");
		const tag = /<VisitorCounter\b[^/]*\/>/.exec(source);
		if (!tag) {
			throw new Error(`${HEADER}: no <VisitorCounter ... /> mount found.`);
		}
		expect(
			tag[0],
			`${HEADER}: <VisitorCounter> is not passed \`mobileResponsive\`.`,
		).toMatch(/mobileResponsive=\{mobileResponsive\}/);
	});
});

describe("global header mobile reflow — BrandCluster and VisitorCounter gate their own hide", () => {
	it("header-mobile::GlobalHeader-passes-mobileResponsive-to-BrandCluster", () => {
		const source = read(HEADER);
		const tag = /<BrandCluster\b[\s\S]*?\/>/.exec(source);
		if (!tag) {
			throw new Error(`${HEADER}: no <BrandCluster ... /> mount found.`);
		}
		expect(tag[0]).toMatch(/mobileResponsive=\{mobileResponsive\}/);
	});

	it("header-mobile::brand-cluster-text-gates-its-hide-and-keeps-its-stack", () => {
		const [classes, ...extra] = nodeClasses(
			read(BRAND),
			BRAND,
			"brand-cluster-text",
		);
		expect(extra).toEqual([]);

		// The desktop stack is untouched: the wordmark row above the countdown
		// row, centred (the ratified OQ-8 lockup).
		expect(classes).toContain("flex");
		expect(classes).toContain("flex-col");
		expect(classes).toContain("items-center");

		const window = innerWindow(
			read(BRAND),
			BRAND,
			"brand-cluster-text",
			"</span>",
		);
		expect(
			window,
			`${BRAND}: the wordmark + countdown block's cn() call carries no ` +
				`\`${GATED_HIDE}\` — an unconditional hide here would also apply to ` +
				`BrandCluster's (auth)-page renders.`,
		).toContain(GATED_HIDE);
	});

	it("header-mobile::BrandCluster-declares-the-prop-defaulting-false", () => {
		expect(read(BRAND)).toMatch(/mobileResponsive\s*=\s*false/);
	});

	it("header-mobile::the-brand-Link-itself-takes-ZERO-diff", () => {
		const source = read(BRAND);
		const tag = /<Link\b[^>]*>/.exec(source);
		if (!tag) {
			throw new Error(`${BRAND}: no <Link> tag found.`);
		}
		const extras = /className="([^"]*)"/.exec(tag[0])?.[1] ?? "";

		// ⛔ THE LINK IS THE TARGET AND MUST NOT INHERIT THE HIDE. Putting
		// `max-mobile:hidden` here rather than on the inner span would remove the
		// home link — and the mark — from every phone, which is the one-character
		// version of this change that looks identical in a diff.
		expect(
			extras,
			`${BRAND}: the brand <Link>'s className changed. The hide belongs on ` +
				`the inner wordmark/countdown span; on the Link it takes the 48px ` +
				`mark and the home link with it.`,
		).toContain(
			"flex items-center gap-2.5 outline-none focus-visible:shadow-(--state-focus-ring)",
		);
		expect(
			extras.includes("max-mobile:") || extras.includes("mobileResponsive"),
			`${BRAND}: the brand <Link> carries a responsive token. The mark and ` +
				`its link render at every width, on every route.`,
		).toBe(false);
	});

	it("header-mobile::the-countdowns-accessible-name-survives-the-hide", () => {
		// ⚠ NOT NEW BEHAVIOUR — a confirmation that the mechanism the hide relies
		// on is still there. The visible digits are `aria-hidden` already, so the
		// link's label is the ONLY route by which the remaining time reaches a
		// screen reader; hiding the digits is information-preserving exactly
		// while this line exists.
		expect(
			read(BRAND),
			`${BRAND}: the brand link no longer carries ` +
				`\`aria-label={freezeLabel(display)}\`. With the countdown block ` +
				`conditionally hidden and the digits already aria-hidden, this ` +
				`label is the only remaining carrier of the freeze countdown.`,
		).toContain("aria-label={freezeLabel(display)}");
	});

	it("header-mobile::visitor-counter-gates-its-own-hide-with-NO-wrapper", () => {
		const [classes, ...extra] = nodeClasses(
			read(VISITOR),
			VISITOR,
			"visitor-counter",
		);
		expect(extra).toEqual([]);

		expect(classes).toContain("flex");
		expect(classes).toContain("items-center");
		expect(classes).toContain("gap-1.5");
		expect(classes).toContain("text-xs");
		expect(classes).toContain("text-muted-foreground");
		expect(classes).toContain("select-none");

		// NOT innerWindow(): this <span> legitimately nests a child <span> (the
		// "N views" text), so there is no sound "first </span> is my own"
		// bound to find. Bounded by the next "<" instead — the same technique
		// nodeClasses() already uses, sufficient because the cn() call and the
		// opening tag's ">" both close before any child element starts.
		const source = read(VISITOR);
		const at = source.indexOf('data-testid="visitor-counter"');
		const openTagEnd = source.indexOf("<", at);
		const window = source.slice(at, openTagEnd);
		expect(
			window,
			`${VISITOR}: the visitor-counter's own root cn() call carries no ` +
				`\`${GATED_HIDE}\`.`,
		).toContain(GATED_HIDE);
	});

	it("header-mobile::VisitorCounter-declares-the-prop-defaulting-false", () => {
		expect(read(VISITOR)).toMatch(/mobileResponsive\s*=\s*false/);
	});
});

describe("global header mobile reflow — what this task may NOT touch", () => {
	it("header-mobile::HeaderNav-RulesControl-BrandCluster-DharmaCluster-IdentityCluster-are-never-hidden", () => {
		const source = read(HEADER);

		// Five separate assertions, five separate messages: each of these is
		// essential for a different reason, and a single loop with one message
		// would tell the reader which line failed but not why it matters.
		const cases: ReadonlyArray<readonly [string, string]> = [
			[
				"HeaderNav",
				"the header's only navigation — Back and Home. Hidden, a mobile " +
					"reader has no in-app way out of a route.",
			],
			[
				"RulesControl",
				"the onboarding deck's only re-show entry point (SPEC.1 §21.9), " +
					"unconditionally present for every viewer at every width per the " +
					"spec text itself.",
			],
			[
				"BrandCluster",
				"the home link and the freeze countdown's accessible name. The 48px " +
					"mark stays visible and linked at every width; only its text block " +
					"conditionally hides, and that override lives in BrandCluster.tsx.",
			],
			[
				"DharmaCluster",
				"the viewer's own Đ balance and portfolio — engine-derived figures, " +
					"not chrome.",
			],
			[
				"IdentityCluster",
				"identity, and the JOIN CTA inside it. ⛔ PHASE B TERRITORY: the CTA " +
					"is governed by TWO independent conditions ruled there (a width " +
					"rule AND a touch-primary rule). Phase A must add no responsive " +
					"behaviour to it at all.",
			],
		];

		for (const [component, why] of cases) {
			const lines = mountLines(source, component);
			expect(
				lines.length,
				`${HEADER}: no \`<${component}\` mount found. If it moved, re-derive ` +
					`this guard rather than deleting it.`,
			).toBeGreaterThan(0);
			for (const line of lines) {
				expect(
					line.includes(HIDE_BELOW_640) ||
						(line.includes("mobileResponsive={mobileResponsive}") &&
							component !== "BrandCluster"),
					`${HEADER}: \`<${component}\` carries a hide token directly on its ` +
						`mount line. It must render at every width — ${why}`,
				).toBe(false);
			}
		}

		// BrandCluster legitimately RECEIVES the prop (it decides internally,
		// per its own gated test above) — the forbidden case is a hide token
		// applied to BrandCluster's OWN mount line, which the loop already checks.
	});

	it("header-mobile::IdentityCluster.tsx-carries-no-responsive-token-at-all", () => {
		const source = read(IDENTITY);
		expect(
			source.includes(HIDE_BELOW_640) || source.includes("mobileResponsive"),
			`${IDENTITY}: carries a responsive token. This file is Phase B's ` +
				`subject and Phase A must not add any hide/responsive behaviour to ` +
				`it, conditional or not.`,
		).toBe(false);
	});

	it("header-mobile::the-header-tag-and-its-60px-row-take-ZERO-diff", () => {
		const source = read(HEADER);

		// ⛔ READ THE TAG THE WAY `discovery-height-chain.test.ts` READS IT
		// (`:90`), so the two files cannot disagree about what is on disk.
		const tag = /<header className="([^"]*)"/.exec(source);
		if (!tag) {
			throw new Error(`${HEADER}: <header> carries no literal className.`);
		}
		expect(
			tag[1],
			`${HEADER}: the <header> tag's className changed. MOBILE-1 Phase A ` +
				`takes ZERO diff on this element — \`border-y\` feeds ` +
				`\`(public)/layout.tsx\`'s min-h calc and \`z-40\` is the header's ` +
				`reserved stacking tier.`,
		).toContain("sticky top-0 z-40 border-y bg-n0 shadow-(--elev-1)");

		// …and the 60px row survives. `discovery-height-chain.test.ts` derives
		// `min-h-[calc(100vh-60px-2px)]` from this number; a phone-width row
		// height would silently move every `(public)` surface's viewport floor.
		const afterTag = source.slice(source.indexOf("<header"));
		const row = /\bh-\[(\d+)px\]/.exec(afterTag);
		if (!row) {
			throw new Error(`${HEADER}: no h-[<n>px] row height inside <header>.`);
		}
		expect(
			row[1],
			`${HEADER}: the header row is now h-[${row[1]}px]. ` +
				`\`(public)/layout.tsx\` subtracts 60px; the two must move together ` +
				`or every surface gains a scrollbar or a dead gap.`,
		).toBe("60");
	});
});
