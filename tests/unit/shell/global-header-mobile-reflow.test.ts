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
 * BOTH mounts. So every reflow class in this file, `BrandCluster.tsx` and
 * `VisitorCounter.tsx` is wrapped in
 * `cn(base, mobileResponsive && "max-mobile:hidden")`, the prop defaults
 * `false`, and only `(public)/layout.tsx` passes it. This describe block's
 * first test is the one that makes that call-site asymmetry itself a
 * guarded fact rather than a claim in a comment.
 *
 * ⛔⛔ AND `GlobalHeader.tsx` IS NOT THE ONLY SEAM — THIS GUARD ONCE SAID IT
 * WAS. The claim above used to end "there is no other seam between them," and
 * that was false in the same commit that wrote it. `RulesControl` is a static
 * child of both mounts and `OnboardingDeck` is a static child of IT, with no
 * conditional on any hop, so a breakpoint class two files down reaches
 * `/sign-in`, `/sign-in/otp` and `/onboarding` exactly as surely as one written
 * here — and three such classes did. ⚠ `context` cannot separate the two:
 * `context="reshow"` is what BOTH route groups pass. Nor can the deck itself,
 * which knows nothing about who mounted it. So the prop is threaded the whole
 * way down and the seam is CHECKED, in the last describe block of this file —
 * a completeness claim nobody verifies is the exact failure this file exists
 * to prevent elsewhere.
 *
 * ⚠ THE SEAM IS THE PROP CHAIN, NOT THE FILE BOUNDARY. Anything added under
 * `GlobalHeader` that carries a breakpoint class inherits the same obligation,
 * whichever file it lives in.
 *
 * ⛔⛔ THE NEGATIVE HALF IS THE LOAD-BEARING HALF OF THIS FILE. Five elements
 * must stay visible at EVERY width and each is pinned by an explicit negative:
 * `HeaderNav` (the only navigation), `RulesControl` (SPEC.1 §21.9 — the
 * onboarding deck's only re-show entry point, "present for every viewer,
 * authenticated or not" — unconditional in the SPEC, so it cannot be hidden
 * at any width, not even conditionally), `BrandCluster` (the home link),
 * and `DharmaCluster` + `IdentityCluster` (balance and identity).
 *
 * ⚠⚠ `IdentityCluster` IS THE ONE ROW THAT MOVED, AND IT WAS INVERTED RATHER
 * THAN DELETED (MOBILE-1 · Phase B). It used to assert that
 * `IdentityCluster.tsx` carried NO responsive token at all — correct while
 * Phase A was the only thing on this branch, and its own failure message said
 * why: the JOIN CTA it hosts is governed by TWO independent conditions ruled in
 * Phase B (a width rule AND a touch-primary rule — MOBILE-1 §4), and landing
 * either one under Phase A's review would have put half a critical-path
 * mechanism through a review not cleared for it.
 *
 * Phase B is what lands both. The question this row asks — "what responsive
 * behaviour does the file carrying the JOIN CTA have" — does not stop mattering
 * the moment the answer changes from none to two; it gets sharper, because the
 * gate is now a thing that can be over- or under-applied. So the row asserts the
 * NEW exact truth: the file's responsive vocabulary is EXACTLY
 * `{max-mobile:hidden, touch-primary:hidden}`, those tokens sit ONLY inside the
 * `if (!viewer)` JOIN branch, and a stray third variant of any spelling still
 * reddens.
 *
 * ⛔ AND THE JOIN HIDE IS DELIBERATELY **UNGATED** BY `mobileResponsive` —
 * WHICH IS THE OPPOSITE OF EVERY OTHER RULE IN THIS FILE, ON PURPOSE. The prop
 * chain exists because a REFLOW class must not reach `(auth)`: ADR-0045 leaves
 * auth/join surfaces "gated, not made responsive." This hide is not a reflow —
 * it IS that gate, and ADR-0045 wants it on every route ("global JOIN, mounted
 * via `GlobalHeader` on every route"). Gating it on `mobileResponsive` would
 * leave the JOIN button visible at phone width on `/sign-in` and
 * `/sign-in/otp` — precisely where a device-blocked visitor is redirected, and
 * precisely the surface the plan swaps for "Sign-up only works on a computer
 * right now." So the row below asserts the file contains NO `mobileResponsive`
 * at all: here the prop's absence is the correct state, not the bug the rest of
 * this guard hunts for.
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
/** The seam: the two files between `GlobalHeader` and the `(auth)` reach. */
const RULES = "src/components/shell/RulesControl.tsx";
const DECK = "src/components/onboarding/OnboardingDeck.tsx";

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

/**
 * Source with `/* *\/` and `//` comments removed.
 *
 * ⛔ LOAD-BEARING FOR EVERY SCAN BELOW, NOT TIDINESS. This tree documents its
 * breakpoint decisions in prose beside the class that implements them, so
 * `max-mobile:p-4` appears in `OnboardingDeck.tsx` twice as a class and twice
 * more as a comment explaining it. A scan that cannot tell the two apart reads
 * a rationale as an unconditional utility and reddens on the documentation
 * rather than on the code — which is how a guard gets deleted instead of fixed.
 *
 * ⚠ Its one assumption: no `//` inside a string literal in the scanned files.
 * True today (no URLs, no protocol-relative paths in any of the five), and the
 * failure mode is loud rather than silent — a truncated line makes a scan throw
 * on a tag it cannot close, never pass on one it should have caught.
 */
function stripComments(source: string): string {
	return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

/**
 * The source range each element carrying `max-mobile:hidden` WRAPS — the
 * regions of this header that vanish below 640px.
 *
 * ⛔⛔ THIS EXISTS BECAUSE A LINE-BASED CHECK CANNOT SEE THE REAL HIDE
 * MECHANISM. `mountLines()` asks whether a hide token sits on a component's own
 * mount line, and the way this header actually hides things is the wrapper
 * `<div>` introduced at `GlobalHeader.tsx`'s left zone — so a SECOND such
 * wrapper placed around `<IdentityCluster>` or `<DharmaCluster>` would hide the
 * JOIN CTA at phone width while passing every line-based assertion in this
 * file. That is not hypothetical: one wrapper of exactly that shape is already
 * here and is correct, which is precisely what makes a second one plausible.
 *
 * Depth-counted by tag name, and it THROWS rather than guesses on anything it
 * cannot bound — an unparseable region silently returning `[]` would report a
 * clean sweep of nothing.
 */
function hiddenRegions(rawSource: string, file: string): string[] {
	const source = stripComments(rawSource);
	const regions: string[] = [];
	let at = source.indexOf(HIDE_BELOW_640);
	while (at !== -1) {
		const open = source.lastIndexOf("<", at);
		if (open === -1 || !/[A-Za-z]/.test(source[open + 1] ?? "")) {
			throw new Error(
				`${file}: found "${HIDE_BELOW_640}" outside any element's attributes ` +
					`(offset ${at}). Re-derive this scan rather than skipping it — an ` +
					`occurrence it cannot bound is an occurrence it is not checking.`,
			);
		}
		const tag = /^<([A-Za-z][\w.]*)/.exec(source.slice(open))?.[1];
		if (!tag) {
			throw new Error(`${file}: unreadable tag name at offset ${open}.`);
		}
		const tagEnd = source.indexOf(">", at);
		if (tagEnd === -1) {
			throw new Error(`${file}: <${tag} at ${open} never closes its tag.`);
		}
		// Self-closing: no children, so it wraps nothing and hides only itself.
		if (source[tagEnd - 1] !== "/") {
			let depth = 1;
			let cursor = tagEnd + 1;
			const start = cursor;
			while (depth > 0) {
				const nextOpen = source.indexOf(`<${tag}`, cursor);
				const nextClose = source.indexOf(`</${tag}`, cursor);
				if (nextClose === -1) {
					throw new Error(
						`${file}: <${tag}> opened at ${open} is never closed.`,
					);
				}
				if (nextOpen !== -1 && nextOpen < nextClose) {
					depth += 1;
					cursor = nextOpen + tag.length + 1;
				} else {
					depth -= 1;
					cursor = nextClose + tag.length + 2;
					if (depth === 0) regions.push(source.slice(start, nextClose));
				}
			}
		}
		at = source.indexOf(HIDE_BELOW_640, at + HIDE_BELOW_640.length);
	}
	return regions;
}

/**
 * Every `max-mobile:` utility in `source` that is NOT the second operand of a
 * `mobileResponsive &&` — i.e. every breakpoint class that reaches BOTH route
 * groups.
 *
 * This is the seam check A-1 was missing. It is deliberately a scan for the
 * ABSENCE of a gate rather than a check that the right classes are present:
 * the property ADR-0045 needs is "nothing responsive reaches `(auth)`", and a
 * list of expected classes would go stale the moment a fourth one is added
 * while this one stays true forever.
 */
/**
 * How many elements are still OPEN at `index`, counting from the element whose
 * opening tag contains `anchor` — i.e. the JSX nesting depth of `index`
 * relative to that container. `0` means "direct child".
 *
 * ⚠ ADJACENCY IS NOT DEPTH, AND THE FIRST ATTEMPT AT THIS GUARD CONFUSED THE
 * TWO. Checking that nothing sits between the previous `>` and a mount looks
 * like a containment check and is not one: a wrapper opened immediately before
 * the mount leaves exactly zero characters between them, and its `</div>` is
 * indistinguishable from the zone's own. That mutation passed. Depth is the
 * property the T4 guard actually depends on, so depth is what is counted.
 *
 * ⚠ Assumes no `>` inside an attribute value between the two points — the same
 * assumption `tagWindowFrom` states, true across this header — and throws if
 * the count ever goes negative rather than reporting a depth it cannot justify.
 */
function depthWithin(
	rawSource: string,
	file: string,
	anchor: string,
	needle: string,
): number {
	const source = stripComments(rawSource);
	const anchorAt = source.indexOf(anchor);
	const needleAt = source.indexOf(needle);
	if (anchorAt === -1 || needleAt === -1) {
		throw new Error(`${file}: could not locate "${anchor}" or "${needle}".`);
	}
	const from = source.indexOf(">", anchorAt) + 1;
	let depth = 0;
	const tags = /<(\/?)([A-Za-z][\w.]*)[^>]*?(\/?)>/g;
	tags.lastIndex = from;
	let m = tags.exec(source);
	while (m !== null && m.index < needleAt) {
		if (m[1] === "/") depth -= 1;
		else if (m[3] !== "/") depth += 1;
		if (depth < 0) {
			throw new Error(
				`${file}: the container holding "${anchor}" closed before "${needle}" ` +
					`— this scan's bounds are wrong, re-derive them.`,
			);
		}
		m = tags.exec(source);
	}
	return depth;
}

function ungatedBreakpointClasses(rawSource: string): string[] {
	const source = stripComments(rawSource);
	const found: string[] = [];
	const re = /max-mobile:[^\s"']+/g;
	let m = re.exec(source);
	while (m !== null) {
		const quote = source.lastIndexOf('"', m.index);
		const prefix =
			quote === -1 ? "" : source.slice(Math.max(0, quote - 60), quote);
		if (!/mobileResponsive\s*&&\s*$/.test(prefix)) found.push(m[0]);
		m = re.exec(source);
	}
	return found;
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
		// SG6, verbatim from docs/plans/HEADER-PORTFOLIO.md: "The divider is a
		// named untouchable. It carries no `data-testid` and must not gain one."
		//
		// ⚠ THIS ASSERTED ONE HYPOTHETICAL STRING UNTIL THE REMEDIATION PASS.
		// It matched the literal `data-testid="header-register-divider"` and
		// nothing else — so `data-testid="register-divider"`, or any other name,
		// passed a test whose own failure message said "(or similar)". SG6 does
		// not forbid A name; it forbids a testid. Read the divider's actual tag
		// and assert the attribute is absent from it, which is the rule as
		// written and is indifferent to what anyone would have called it.
		const source = stripComments(read(HEADER));
		const anchor = "mx-3 h-[30px] w-px bg-n2";
		const at = source.indexOf(anchor);
		if (at === -1) {
			throw new Error(
				`${HEADER}: the §21.1 divider's \`${anchor}\` class is gone. It is a ` +
					`named untouchable and is located by that class here and in ` +
					`dharma-cluster.test.tsx's T4 guard — re-derive both, do not delete.`,
			);
		}
		const open = source.lastIndexOf("<", at);
		const close = source.indexOf(">", at);
		if (open === -1 || close === -1) {
			throw new Error(`${HEADER}: could not bound the divider's own tag.`);
		}
		expect(
			source.slice(open, close + 1),
			`${HEADER}: the §21.1 divider gained a \`data-testid\`. SG6 forbids one ` +
				`on this element under ANY name — locate it by its \`w-px\` class, ` +
				`exactly as dharma-cluster.test.tsx's T4 guard already does.`,
		).not.toMatch(/data-testid/);
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
		//
		// ⚠ THE WRAPPER HALF OF THIS TEST WAS ONE HYPOTHETICAL STRING UNTIL THE
		// REMEDIATION PASS: `not.toContain("header-visitor-counter-slot")`, a
		// name nobody would independently pick, so any OTHER wrapper name passed
		// a test called `with-NO-wrapper`. What T4 actually depends on is
		// structural — that this mount is a DIRECT child of the right zone — so
		// that is what is read now: the mount's JSX nesting DEPTH inside the
		// right zone must be zero. No wrapper, under any name, survives that.
		const source = stripComments(read(HEADER));
		expect(
			depthWithin(source, HEADER, "justify-self-end", "<VisitorCounter"),
			`${HEADER}: <VisitorCounter> is no longer a DIRECT child of the right ` +
				`zone — something wraps it. dharma-cluster.test.tsx's T4 guard (SG5) ` +
				`walks \`dharma-cluster\`'s parent's direct \`.children\` and requires ` +
				`the \`visitor-counter\` node among them; a wrapper pushes the real ` +
				`node down one level, which is invisible to a className check and is ` +
				`exactly what broke T4 the first time this task landed.`,
		).toBe(0);

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

		// ⛔⛔ TWO MECHANISMS, AND THE SECOND IS THE REAL ONE. Until the
		// remediation pass this loop checked only the first: that no hide token
		// sits on the component's own mount line. But nothing in this header
		// hides anything that way — the way it hides things is the wrapper
		// `<div>` this task itself introduced around Radio and GitHub, and a
		// second wrapper of that exact shape around `<IdentityCluster>` would
		// have hidden the JOIN CTA at phone width while passing every assertion
		// in this file. `hiddenRegions()` reads what each hide-bearing element
		// WRAPS, so the two mechanisms are now both covered and the test's name
		// is true of what it does.
		const regions = hiddenRegions(source, HEADER);

		for (const [component, why] of cases) {
			const lines = mountLines(source, component);
			expect(
				lines.length,
				`${HEADER}: no \`<${component}\` mount found. If it moved, re-derive ` +
					`this guard rather than deleting it.`,
			).toBeGreaterThan(0);
			for (const line of lines) {
				expect(
					line.includes(HIDE_BELOW_640),
					`${HEADER}: \`<${component}\` carries a hide token directly on its ` +
						`mount line. It must render at every width — ${why}`,
				).toBe(false);
			}
			for (const region of regions) {
				expect(
					region.includes(`<${component}`),
					`${HEADER}: \`<${component}\` is now INSIDE an element that ` +
						`carries \`${HIDE_BELOW_640}\`, so it disappears below 640px ` +
						`without any hide token of its own. It must render at every ` +
						`width — ${why}`,
				).toBe(false);
			}
		}

		// ⚠ RECEIVING `mobileResponsive` IS NOT A HIDE AND IS NO LONGER TREATED
		// AS ONE. This loop used to also fail a mount line carrying
		// `mobileResponsive={mobileResponsive}`, exempting `BrandCluster` — a
		// disjunct that was dead when written (`mountLines` returns the bare
		// `<BrandCluster` line, its props being on the lines below, so the
		// exemption could never fire) and that became actively WRONG once
		// `RulesControl` began taking the prop to thread it down to
		// `OnboardingDeck`. Two components legitimately receive it for two
		// different reasons — one to decide its own render, one to pass it on —
		// and neither is hiding itself. The region scan above is what actually
		// proves that, and it does so without caring how the prop travels.
	});

	it("header-mobile::IdentityCluster-carries-EXACTLY-the-Phase-B-gate-tokens", () => {
		// ⚠ INVERTED, NOT DELETED — MOBILE-1 · Phase B. See this file's docblock
		// for why the row survives its own answer changing. The property is
		// unchanged in kind: "no responsive behaviour" and "exactly this
		// responsive behaviour" are both statements about the WHOLE variant
		// vocabulary of the file carrying the JOIN CTA, which is why the scan
		// still reads every variant spelling rather than the two it expects.
		// `max-sm:hidden`, `mobile:flex`, `max-[640px]:hidden` and
		// `max-mobile:opacity-0` each still redden.
		const source = stripComments(read(IDENTITY));

		// Phase B's second, width-INDEPENDENT condition (MOBILE-1 §4 condition 2:
		// `@custom-variant touch-primary (@media (hover: none) and (pointer:
		// coarse))`). Local to this row on purpose — no Phase A reflow class uses
		// it, so it does not belong beside `HIDE_BELOW_640` in the shared header.
		const TOUCH_PRIMARY_HIDE = "touch-primary:hidden";

		// Whole utility tokens, not just their prefixes — the set below is
		// compared by value, so a prefix-only match could not tell
		// `max-mobile:hidden` from `max-mobile:opacity-0`.
		const RESPONSIVE_TOKEN =
			/(?:\b(?:max-)?(?:mobile|sm|md|lg|xl|2xl):|\btouch-primary:|\b(?:max|min)-\[[^\]]+\]:)[^\s"'`]*/g;
		const tokens = [...source.matchAll(RESPONSIVE_TOKEN)].map((m) => m[0]);

		// ⛔ THE EXACT SET. MOBILE-1 §4 rules TWO independent hide conditions on
		// this CTA — the 640px phone-width rule and the width-independent
		// touch-primary rule — and the second is not a redundant backup: for a
		// default-mode iPad the server-side gate provides NO enforcement at all
		// (plan §3 "Consequence", Self-critique #1, rated high), so the client
		// rule is the only layer that device class ever meets.
		expect(
			new Set(tokens),
			`${IDENTITY}: its responsive vocabulary is {${[...new Set(tokens)].join(
				", ",
			)}}, expected exactly {${HIDE_BELOW_640}, ${TOUCH_PRIMARY_HIDE}}. ` +
				`MOBILE-1 §4 rules two independent hide conditions on the JOIN CTA ` +
				`and nothing else in this file — a third token, or a different ` +
				`spelling of either, is a mechanism nobody ruled.`,
		).toEqual(new Set([HIDE_BELOW_640, TOUCH_PRIMARY_HIDE]));

		// ⛔ AND THEY SIT ONLY IN THE `if (!viewer)` JOIN BRANCH. A signed-in
		// mobile participant keeps their identity affordance — plan §3/§6:
		// existing mobile sessions are "completely unaffected", the gate blocks
		// only NEW sign-in attempts. Bounded by two symbols rather than by line
		// numbers (O-8): the branch opener, and the first statement after it.
		const branchOpen = source.indexOf("if (!viewer)");
		const branchEnd = source.indexOf("const chipClass");
		if (branchOpen === -1 || branchEnd === -1 || branchEnd < branchOpen) {
			throw new Error(
				`${IDENTITY}: could not bound the signed-out JOIN branch between ` +
					`\`if (!viewer)\` and \`const chipClass\`. If the component was ` +
					`restructured, re-derive these anchors rather than deleting the ` +
					`guard — the containment claim is the load-bearing half.`,
			);
		}
		const joinBranch = source.slice(branchOpen, branchEnd);
		const afterBranch = source.slice(branchEnd);
		for (const token of [HIDE_BELOW_640, TOUCH_PRIMARY_HIDE]) {
			expect(
				joinBranch.includes(token),
				`${IDENTITY}: \`${token}\` is not inside the \`if (!viewer)\` JOIN ` +
					`branch. That anchor IS the CTA ADR-0045 gates.`,
			).toBe(true);
			expect(
				afterBranch.includes(token),
				`${IDENTITY}: \`${token}\` appears on an identity-chip branch. Only ` +
					`the signed-out JOIN CTA is gated — a participant who signed in on ` +
					`a computer and opens the site on their phone must keep their own ` +
					`identity link (MOBILE-1 §3 "Scope", §6).`,
			).toBe(false);
		}

		// ⛔ AND NO `mobileResponsive` — THE ABSENCE IS THE CORRECT STATE HERE.
		// Everywhere else in this file the prop is what keeps a reflow class off
		// `(auth)`. This hide is the GATE, not a reflow, and ADR-0045 puts it on
		// every route; gating it would leave JOIN visible at phone width on
		// `/sign-in`, the page a blocked device is sent to.
		expect(
			source.includes("mobileResponsive"),
			`${IDENTITY}: now carries \`mobileResponsive\`. The JOIN hide is ` +
				`ADR-0045's gate ("global JOIN, mounted via GlobalHeader on every ` +
				`route"), not a Phase A reflow — gating it would leave the CTA ` +
				`visible at phone width on /sign-in and /sign-in/otp, which is ` +
				`exactly where a device-blocked visitor is redirected.`,
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

/**
 * THE SEAM. `GlobalHeader.tsx` is not the only file whose breakpoint classes
 * reach the `(auth)` route group, and this file claimed it was.
 *
 * The chain is three static hops with no conditional on any of them:
 *
 *   (auth)/layout.tsx  →  <GlobalHeader viewer stars />     ← no prop
 *   GlobalHeader.tsx   →  <RulesControl />                  ← outside the
 *                                                             gated wrapper,
 *                                                             deliberately,
 *                                                             per SPEC.1 §21.9
 *   RulesControl.tsx   →  <OnboardingDeck context="reshow" …/>
 *
 * So an unconditional `max-mobile:` class in `OnboardingDeck.tsx` renders a
 * responsive deck to anyone who opens RULES on `/sign-in`, `/sign-in/otp` or
 * `/onboarding` — which ADR-0045 rules out in as many words: auth/join
 * surfaces "remain governed by the original constraint… gated, not made
 * responsive." Three such classes shipped that way.
 *
 * ⚠ `context` CANNOT GATE IT, and this is the part worth reading twice. The
 * obvious fix is to key off `context === "reshow"`, and it is wrong: the
 * `(public)` header opens the very same re-show, and `(public)`'s own
 * first-login mount legitimately wants those classes. `context` describes WHICH
 * DECK, never WHICH SURFACE. Only the layout knows the surface, so only a
 * threaded prop can carry the distinction — no `usePathname`, no route
 * special-case, and nothing the deck can work out for itself.
 *
 * ⚠ WHY AN ABSENCE SCAN RATHER THAN A LIST OF EXPECTED CLASSES. The property
 * ADR-0045 needs is "nothing responsive reaches `(auth)`". An enumeration of
 * today's three classes would go stale the first time a fourth is added — and
 * would go stale SILENTLY, in the passing direction. `ungatedBreakpointClasses`
 * stays true however many there are.
 */
describe("global header mobile reflow — the RulesControl → OnboardingDeck seam", () => {
	it("header-mobile::RulesControl-receives-the-prop-and-passes-it-to-OnboardingDeck", () => {
		const header = read(HEADER);
		const rulesTag = /<RulesControl\b[\s\S]*?\/>/.exec(header);
		if (!rulesTag) {
			throw new Error(`${HEADER}: no <RulesControl ... /> mount found.`);
		}
		expect(
			rulesTag[0],
			`${HEADER}: <RulesControl> is not passed \`mobileResponsive\`. It is ` +
				`the only seam between this header's two mounts and the onboarding ` +
				`deck; without the prop the deck cannot tell an (auth) render from a ` +
				`(public) one, because both pass \`context="reshow"\`.`,
		).toMatch(/mobileResponsive=\{mobileResponsive\}/);

		const rules = read(RULES);
		expect(
			rules,
			`${RULES}: no \`mobileResponsive = false\` default. The (auth) mount ` +
				`relies on the default rather than passing \`false\`, so the polarity ` +
				`is what keeps a forgotten prop inheriting the pre-MOBILE-1 deck.`,
		).toMatch(/mobileResponsive\s*=\s*false/);

		const deckTag = /<OnboardingDeck\b[\s\S]*?\/>/.exec(rules);
		if (!deckTag) {
			throw new Error(`${RULES}: no <OnboardingDeck ... /> mount found.`);
		}
		expect(
			deckTag[0],
			`${RULES}: its <OnboardingDeck> mount does not forward ` +
				`\`mobileResponsive\`. The chain breaks here and every breakpoint ` +
				`class in the deck reaches /sign-in again.`,
		).toMatch(/mobileResponsive=\{mobileResponsive\}/);
	});

	it("header-mobile::OnboardingDeck-carries-NO-ungated-breakpoint-class", () => {
		expect(
			read(DECK),
			`${DECK}: no \`mobileResponsive = false\` default.`,
		).toMatch(/mobileResponsive\s*=\s*false/);

		const ungated = ungatedBreakpointClasses(read(DECK));
		expect(
			ungated,
			`${DECK}: ${ungated.length} breakpoint class(es) are not wrapped in ` +
				`\`mobileResponsive && "…"\` — ${ungated.join(", ")}. This deck is ` +
				`reachable from the (auth) header through RulesControl, so an ` +
				`unconditional class here reflows /sign-in, /sign-in/otp and ` +
				`/onboarding. ⚠ Do NOT gate on \`context\` instead: the (public) ` +
				`header opens the same re-show and (public)'s first-login mount ` +
				`legitimately wants these classes.`,
		).toEqual([]);
	});

	it("header-mobile::ONLY-the-public-layout-first-login-mount-opts-the-deck-in", () => {
		const publicTag = /<OnboardingDeck\b[\s\S]*?\/>/.exec(read(PUBLIC_LAYOUT));
		if (!publicTag) {
			throw new Error(`${PUBLIC_LAYOUT}: no <OnboardingDeck ... /> mount.`);
		}
		expect(
			publicTag[0],
			`${PUBLIC_LAYOUT}: its first-login <OnboardingDeck> mount does not pass ` +
				`\`mobileResponsive\`. This is the (public) route group and the deck ` +
				`clipped its own content at 375px before this task — 33px of every ` +
				`body line, and the wordmark row — so the fix must reach it.`,
		).toMatch(/\bmobileResponsive\b/);

		// ⛔ AND THE (auth) LAYOUT IMPORTS NO DECK AT ALL. Its only path to one
		// is through `GlobalHeader` → `RulesControl`, which is exactly why the
		// prop chain above is the whole of the gate: there is no second mount
		// here that could be given the prop by mistake.
		expect(
			read(AUTH_LAYOUT).includes("OnboardingDeck"),
			`${AUTH_LAYOUT}: now references OnboardingDeck directly. The (auth) ` +
				`group reaches the deck only through RulesControl's re-show, and D-4 ` +
				`depends on that: a mount here could be passed \`onComplete\`, and a ` +
				`signed-out visitor writing the completion marker would suppress ` +
				`their own first-login deck later.`,
		).toBe(false);
	});
});
