import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * MOBILE-1 — THE HEADER'S 60px ROW AT PHONE WIDTH: what drops, what survives,
 * and what this task is FORBIDDEN to touch.
 *
 * ⚠⚠ REWRITTEN AT MOBILE-1 · JOB A, UNDER ADR-0048. Three passages in this
 * file quoted ADR-0045's auth/join carve-out — auth surfaces "remain governed
 * by the original constraint… gated, not made responsive" — as LIVE DOCTRINE.
 * ADR-0048 (§Supersession scope) supersedes exactly that clause. So those
 * passages were not merely stale, they were a FALSE RECORD: they described a
 * property the tree below no longer asserts, in a file whose whole job is to
 * make that property checkable. O-5 — a durable amendment is applied at every
 * site that states the superseded position, in the same commit as the code —
 * so all three are rewritten here, at `:5-89`, at the `(auth)` assertion's
 * failure message, and at the seam docblock near the foot of the file.
 *
 * ⛔ WHAT DID **NOT** CHANGE, because the obvious reading of the above is
 * wrong: the `mobileResponsive` prop and its `= false` default SURVIVE.
 * ADR-0048 (§Phase A architecture — the unwind) considers deleting the prop
 * ("path (ii)") and REJECTS it for now — five files, ~8 assertions, three of
 * them `= false` default pins. The gate is still the mechanism. What changed
 * is which mounts opt in: `(auth)` now does. A reader who takes this docblock
 * to mean "the gate is gone" will delete a default that is still load-bearing.
 *
 * WHAT THIS GUARD IS FOR. `GlobalHeader` is a `1fr auto 1fr` grid with a
 * 1440px cap, authored with no responsive breakpoints at all. Its two side
 * zones carry seven controls between them. At 1440 the left zone uses
 * 427.20px of a 568.00px track; every control carries `shrink-0`, so that is a
 * HARD-OVERFLOW budget rather than a compression budget (the component's own
 * docblock measures it). At 375px the same row is asked to hold the same seven
 * controls in ~327px of content box, and nothing degrades gracefully: they
 * overflow, and the page gains a horizontal scrollbar on every route.
 *
 * ⚠ NO `design-language.md` §1.7 CITATION HERE, DELIBERATELY — this paragraph
 * used to derive that no-breakpoints property from it. §1.7 still reads
 * "Desktop-only… no responsive variants this phase", and ADR-0048 (§Spec
 * impact) rules it must be REDRAFTED against ADR-0048's scope rather than
 * ratified as written. That redraft is a founder-ruling surface and this job
 * does not perform it (plan OI-3). Citing a document known to disagree with
 * the tree, in either direction, is the O-9 defect this rewrite exists to
 * clear — so the property is stated as what the component IS, and pinned by
 * this file's own assertions rather than by a reference.
 *
 * ⇒ So SIX things are hidden below 640px. Four from Phase A: the two
 * off-site/decorative left-zone controls (Radio · GitHub stars) behind one
 * wrapper, the register divider, the visitor counter, and the brand cluster's
 * wordmark+countdown text block. Two from ADR-0049, and only these two are
 * viewer-dependent: the whole Đ cluster, and the identity chip's pseudonym text.
 *
 * ⚠ THE PHASE A FOUR ARE GATED IN THIS FILE, `BrandCluster.tsx` AND
 * `VisitorCounter.tsx`; THE ADR-0049 TWO ARE GATED IN `DharmaCluster.tsx` AND
 * `IdentityCluster.tsx`. Six hides, five files, one prop chain. That spread is
 * not sprawl — it is the T4 DOM-order guard's requirement (no wrappers in the
 * right zone) meeting AGENTS.md §8's (gate on the prop, thread it the whole way
 * down). Where a component exists to carry its own token, it carries it.
 *
 * ⛔⛔ EVERY ONE OF THOSE FOUR HIDES IS GATED ON A `mobileResponsive` PROP,
 * NOT UNCONDITIONAL — AND THAT IS STILL TRUE AFTER ADR-0048. `GlobalHeader`
 * is mounted by BOTH `(public)/layout.tsx` (Discovery, `/m/[slug]`) and
 * `(auth)/layout.tsx` (`/sign-in`, `/sign-in/otp`, `/onboarding`), and a class
 * applied unconditionally in `GlobalHeader.tsx` reaches BOTH mounts. So every
 * reflow class in this file, `BrandCluster.tsx` and `VisitorCounter.tsx` stays
 * wrapped in `cn(base, mobileResponsive && "max-mobile:hidden")` and the prop
 * still defaults `false`. What ADR-0048 changes is the CALL SITES: both
 * layouts pass it now, where Phase A had only `(public)` passing it. This
 * describe block's first test is the one that makes those call sites a guarded
 * fact rather than a claim in a comment — and under ADR-0048 it has TWO halves
 * on the `(auth)` mount, because a bare presence check on the prop name also
 * passes on `mobileResponsive={false}`, i.e. on a tree where the opt-in has
 * been reverted (plan F-4).
 *
 * ⚠ WHY THE GATE IS KEPT AT ALL NOW THAT BOTH MOUNTS OPT IN. AGENTS.md §8's
 * second rule: gate it on a prop and thread the prop the whole way down, so
 * that a mount which forgets it inherits the DESKTOP render rather than an
 * accidental reflow. That polarity is a property of the default, not of who
 * currently passes it, and it is what makes a future third mount safe by
 * omission. Deleting the prop because two of two callers now pass it removes
 * the safe default for the third.
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
 * to prevent elsewhere. ⚠ Under ADR-0048 the deck reflowing on the three auth
 * routes is FOUNDER-RATIFIED and intended (plan §4, Founder ruling 1); the
 * seam check survives because the obligation it enforces is the threading
 * discipline, not the exclusion it was originally written to police.
 *
 * ⚠ THE SEAM IS THE PROP CHAIN, NOT THE FILE BOUNDARY. Anything added under
 * `GlobalHeader` that carries a breakpoint class inherits the same obligation,
 * whichever file it lives in.
 *
 * ⛔⛔ THE NEGATIVE HALF IS THE LOAD-BEARING HALF OF THIS FILE. THREE elements
 * must stay visible at EVERY width and each is pinned by an explicit negative:
 * `HeaderNav` (the only navigation), `RulesControl` (the onboarding deck's
 * only re-show entry point — present for every viewer, authenticated or not,
 * so it cannot be hidden at any width, not even conditionally), and
 * `BrandCluster` (the home link).
 *
 * ⚠⚠ IT WAS FIVE UNTIL ADR-0049, AND THE TWO THAT LEFT DID NOT LEAVE QUIETLY.
 * `DharmaCluster` and `IdentityCluster` were in this list — "balance and
 * identity" — and ADR-0049 reverses exactly that: below 640px the Đ cluster is
 * not rendered and the identity chip reduces to its avatar alone. The founder
 * ruled it on an informed basis, and the argument is RELOCATION rather than
 * removal — the avatar still links to the profile, where balance, portfolio and
 * pseudonym all render. Their guards were MOVED to the ADR-0049 describe block,
 * not deleted, because the hides live on those components' own roots in their own
 * files and this file's assertions read only `GlobalHeader.tsx`. ⛔ Measured, not
 * argued: with both behaviours reversed, the never-hidden test was still GREEN
 * under its old five-row form. The relocation is what makes its name true.
 *
 * ⚠ THE `RulesControl` DOCTRINE IS RE-ATTRIBUTED, NOT DROPPED. It used to
 * cite `SPEC.1 §21.9`. SPEC.1 was rebaselined to 2.0.0 (D-29) and §17–§19 and
 * §21–§23 are INTENTIONALLY ABSENT — the ruling was REMOVED, not relocated, so
 * there is no live section to repoint at. Its surviving homes are ADR-0037
 * (the deck's seen-marker decision, which exists only because the deck must be
 * shown once and stay re-reachable afterwards) and this file's own assertions:
 * `header-mobile::RulesControl-is-mounted-exactly-once-outside-any-hidden-wrapper`
 * and the `RulesControl` row of
 * `header-mobile::HeaderNav-RulesControl-BrandCluster-are-never-hidden`
 * (renamed from the five-component form at ADR-0049 — see the note on that test).
 * ⚠ SCOPE: only this docblock's citations are re-anchored. Everything else is
 * a separate job (plan OI-5) and is deliberately untouched. ⛔ AND OI-5 IS
 * BIGGER THAN THE PLAN'S FIGURE, WHICH MATTERS TO WHOEVER PICKS IT UP —
 * measured across `src/` and `tests/`, excluding this file:
 *
 *   §21.9 citations   26   ← the plan's "the other 25" counts FILES, not sites
 *   §21.x citations   53   ← the whole of §21 is absent, so ALL of these are dead
 *
 * The plan scoped OI-5 to `§21.9`; the true surface is twice that, because
 * D-29 removed §17–§19 and §21–§23 wholesale rather than removing one ruling.
 * ⚠ Seven of the `§21.x` sites are further down THIS file, inside tests Job A
 * must leave byte-identical — so they are named here rather than fixed, and
 * their survival is a scope decision, not an oversight.
 *
 * ⚠ `IdentityCluster` IS THE ONE THAT CHANGED SHAPE RATHER THAN MERELY LEAVING
 * THE LIST, AND ITS RULE NOW HAS TWO HALVES THAT PULL IN OPPOSITE DIRECTIONS.
 * The signed-in chip REDUCES below 640px — pseudonym text gone, avatar kept
 * (ADR-0049). The signed-out JOIN CTA does NOT: ADR-0048's whole point is that a
 * phone participant may join, so it renders at every width on every route. One
 * file, one branch hiding and one branch pinned, which is why
 * `header-mobile::IdentityCluster-reduces-to-the-avatar-below-640-and-the-JOIN-CTA-never-hides`
 * asserts BOTH and why its vocabulary check is a closed allowlist of exactly one
 * token rather than the blanket ban it replaces.
 *
 * ⚠⚠ THIS PARAGRAPH PREVIOUSLY CARRIED PHASE B's MOTIVE AND A NOTE EXPLAINING
 * WHY IT WAS LEFT STALE. That note said rewriting it would put the docblock out
 * of step with the failure message inside the blanket-ban guard, which Job A was
 * scoped not to touch. ADR-0049 touches that guard — it inverts it — so the
 * reason for the divergence is spent and both sites are corrected in the same
 * commit (O-5). Recorded because the shape is worth keeping: a deliberate,
 * documented staleness is only defensible while the thing it was keeping step
 * with still exists.
 *
 * ⛔⛔ THE REGISTER DIVIDER CARRIES NO `data-testid`, EVER (SG6). It is
 * a named untouchable — `docs/plans/HEADER-PORTFOLIO.md`'s SG6: "The divider
 * is a named untouchable. It carries no `data-testid` and must not gain
 * one." `tests/unit/shell/dharma-cluster.test.tsx`'s T4 guard locates it by
 * its `w-px` class among the right zone's direct children, and this file
 * does the same rather than adding a hook that guard already forbids.
 * ⚠ The `SPEC.1 §21.1` label this paragraph used to carry is dropped for the
 * same reason as §21.9 above — §21 is absent from SPEC.1 2.0.0 in its
 * entirety, so §21.1 is as dead as §21.9. The anti-conflation rule it named
 * (engine-derived Đ figures left of the divider, the vanity visitor count
 * right of it) survives in HEADER-PORTFOLIO's SG6 and in that T4 guard.
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
 * without horizontal overflow is measurable in a real browser and only there.
 *
 * ⛔ AND THE TWO ROUTE GROUPS HAVE TWO SEPARATE MEASUREMENTS — DO NOT READ
 * EITHER ONTO THE OTHER. `(public)`: 394px of overflow before Phase A's diff,
 * 0px after, measured at Phase A.
 *
 * `(auth)`, measured at Job A on a production build after `just clean`, served
 * against the staging database, in a 375px in-page frame — BEFORE and AFTER on
 * the SAME rig, because a pair drawn from two rigs is not a comparison:
 *
 *   /sign-in · /sign-in/otp · /onboarding   379px document overflow → 0px
 *   this header's scrollWidth               754px min-content       → 375px
 *   elements escaping the 375px viewport    8                       → 0
 *
 * ⚠ ALL THREE ROUTES WERE REACHED DIRECTLY — plan F-9 did NOT fire, and
 * `/onboarding` is not an inference from the other two. It renders signed-out
 * (this layout's own docblock records why) and served a full header.
 *
 * ⛔⛔ AND THE "WHAT THAT DOES NOT COVER" NOTE THAT USED TO SIT HERE NAMED THE
 * WRONG ROUTE — CORRECTED AT ADR-0049 BY GREP RATHER THAN BY REASONING. It said
 * the uncovered case was a SIGNED-IN `/onboarding` render. There is no such
 * render: `onboarding/page.tsx` redirects to `/sign-in` without a valid
 * `onboarding_ref`, redirects to `/` once `tosAcceptedAt` is set, and
 * `session-gate.ts` throws `ONBOARDING_REQUIRED` before any `sessions` row is
 * written while either field is NULL. Both arms are closed.
 *
 * ⇒ **The uncovered case is `/sign-in` and `/sign-in/otp`, which have NO session
 * redirect at all** — this layout reads `auth.api.getSession` and builds a
 * non-null viewer from it, so a fully-onboarded viewer who navigates there gets
 * the SIGNED-IN header. Below 640px they now lose their pseudonym text
 * (ADR-0049, inherited by ruling: the prop must not mean different things by
 * caller). They do NOT lose a Đ cluster — this layout deliberately passes neither
 * `portfolio` nor `spendable`, so `DharmaCluster` returns `null` on all three
 * auth routes at every width and its new token is inert there. ⚠ The
 * geometry of that render is still unmeasured; what changed is that the route it
 * lives on is now known.
 *
 * ⚠ The BEFORE figures reproduced ADR-0048's exactly (379 / 754), which is
 * worth one line because it was not guaranteed: they came from a different rig
 * and the plan required re-taking rather than adopting them.
 *
 * ⛔ NONE OF THAT IS OBSERVABLE FROM THIS FILE. jsdom performs no layout, so a
 * source scan can neither supply those numbers nor imply them; they are
 * recorded here so the assertions below have a stated purpose, not so this
 * suite can be read as having checked them.
 *
 * ⚠ V-REGISTER DISCIPLINE. This reads the SHIPPED FILES.
 */

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

const HEADER = "src/components/shell/GlobalHeader.tsx";
const BRAND = "src/components/shell/BrandCluster.tsx";
const VISITOR = "src/components/shell/VisitorCounter.tsx";
const IDENTITY = "src/components/shell/IdentityCluster.tsx";
const DHARMA = "src/components/shell/DharmaCluster.tsx";
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
 * ⛔⛔ THE CLOSED ALLOWLIST — WIDENED BY A RULING, NOT BY A BUILD.
 *
 * It was EXACTLY `[max-mobile:hidden]` from ADR-0049 until MOBILE-2l, and the
 * one-token form is what this file's assertion 3 was written around: a closed
 * allowlist reddens on spellings nobody has thought of, where a denylist goes
 * stale silently in the PASSING direction. That property is kept — the list is
 * still closed and still exact; it simply now names two ruled behaviours.
 *
 * ⚠ IT WIDENED BECAUSE ADR-0051 A8 D-5 RULED A SECOND ONE: "The header avatar
 * below 640 is a circle; the desktop header is unchanged." ADR-0049 reduced the
 * chip to its avatar and left a 42×34 rounded RECTANGLE holding a 24px image,
 * under the 44px target. A8 makes that box square, sheds its ground and border,
 * and fills it. Every token below is that decision and nothing else.
 *
 * ⚠ `data-[size=sm]:size-11` REPEATS THE PRIMITIVE'S OWN DATA-VARIANT ON
 * PURPOSE. `ui/avatar.tsx` ships `data-[size=sm]:size-6` at specificity (0,2,0);
 * a bare `size-11` is (0,1,0) and loses silently. Both spellings are in the list
 * because both are on the element — the bare one sizes the chip, the
 * data-variant one sizes the avatar inside it.
 */
const RULED_PHONE_VOCABULARY = [
	// ADR-0049 D-1 — the pseudonym text goes, the avatar stays.
	HIDE_BELOW_640,
	// ADR-0051 A8 D-5 — and what stays becomes a circle.
	"max-mobile:size-11",
	"max-mobile:justify-center",
	"max-mobile:gap-0",
	"max-mobile:p-0",
	"max-mobile:[border:none]",
	"max-mobile:bg-transparent",
	"max-mobile:hover:bg-transparent",
	"max-mobile:data-[size=sm]:size-11",
	"max-mobile:[&_img]:size-full",
];

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

	/**
	 * ⚠⚠ INVERTED AT JOB A, NEVER DELETED — the WARLI-MOUNT precedent, which
	 * ADR-0048 (§Phase A architecture — the unwind) names explicitly. Phase A
	 * shipped this test asserting that `(auth)/layout.tsx` does NOT pass
	 * `mobileResponsive`, with a failure message quoting ADR-0045. ADR-0048
	 * reverses the ruling, so the assertion is turned round rather than removed:
	 * a deleted guard proves nothing in either direction, while an inverted one
	 * reddens the moment somebody reverts the opt-in.
	 *
	 * ⛔⛔ THREE HALVES ON THE `(auth)` TAG, AND ONLY THE FIRST IS THE OBVIOUS
	 * ONE. The naive inversion is `.toMatch(/\bmobileResponsive\b/)` — and it
	 * passes on `<GlobalHeader … mobileResponsive={false} />`, i.e. on a tree
	 * where item 1 has been reverted with the prop name left behind. That is not
	 * a hypothetical spelling: it is precisely how a reverting edit reads when
	 * someone wants to keep the call site documented, and it renders the
	 * pre-ADR-0048 header on all three auth routes. So the name must be PRESENT
	 * (half one), must carry no value other than `{true}` (half two), and must
	 * be a real JSX ATTRIBUTE rather than a name occurring inside a spread
	 * (half three). Three messages, because they catch three different mistakes
	 * and a reader who hits one should not have to guess which.
	 *
	 * ⚠⚠ HALF TWO WAS A DENYLIST FOR ONE REVIEW CYCLE AND IS NOW AN ALLOWLIST —
	 * the correction is worth more than the rule. It enumerated `{false}` and
	 * `{undefined}`, which is a guess at how somebody will spell "off", and the
	 * ways to spell it are unbounded: mutation testing walked five TS-legal
	 * reverts straight through it, `={SOME_FLAG}` among them. An enumeration
	 * over a VALUE position goes stale silently, in the passing direction —
	 * which is the same argument this file already makes for
	 * `ungatedBreakpointClasses` being an absence scan rather than a list of
	 * expected classes, one register over. So the accepted set is closed and
	 * everything else reddens, INCLUDING spellings nobody has thought of.
	 *
	 * ⚠ HONEST NOTE ON WHAT EACH HALF CAN CATCH TODAY. Half one is the RED that
	 * drives item 1: on the pre-implementation tree the `(auth)` mount carries
	 * no such prop and it fails. Halves two and three CANNOT be red on that
	 * tree — the strings they forbid do not exist there — so they are regression
	 * guards in the `_probe-*` posture (AGENTS.md §9), not TDD drivers.
	 *
	 * ⚠ THE `(public)` HALF IS UNCHANGED, INCLUDING ITS SINGLE-HALF SHAPE.
	 * `{false}` on that mount would be the same defect one route group over and
	 * is not asserted against here, because Job A's scope is the `(auth)` mount
	 * (plan §7). Recorded, not fixed.
	 */
	it("header-mobile::BOTH-layout-mounts-pass-mobileResponsive-and-neither-passes-false", () => {
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

		// HALF ONE — the prop is PRESENT on the (auth) mount.
		expect(
			authTag[0],
			`${AUTH_LAYOUT}: its <GlobalHeader> mount does not pass ` +
				`\`mobileResponsive\`. ADR-0048 supersedes ADR-0045's auth/join ` +
				`carve-out: /sign-in, /sign-in/otp and /onboarding are phone- ` +
				`responsive at the existing 640px tier, and this one prop is the ` +
				`whole of the fix for all three routes — ADR-0048 measured +379px of ` +
				`document overflow at 375x812 on those routes, 100% of it this ` +
				`header (min-content 754px). Without it a phone visitor cannot read ` +
				`the join surface they are being asked to join from, which is the ` +
				`ADR-0038 signup target ADR-0045 knowingly traded against and ` +
				`ADR-0048 stops trading against.`,
		).toMatch(/\bmobileResponsive\b/);

		// HALF TWO — and it is not switched OFF by any spelling. Without this,
		// half one passes on a REVERTED tree that kept the prop name.
		//
		// ⛔⛔ THE ENUMERATION OF BAD VALUES WAS THE WRONG SHAPE, AND IT SHIPPED
		// THAT WAY FOR ONE REVIEW CYCLE. This read `.not.toMatch(/…=\{(false|
		// undefined)\}/)`, which is a DENYLIST — and a denylist over a value
		// position is exactly the thing that goes stale silently, in the passing
		// direction, because the ways to spell "off" are unbounded. Mutation-tested
		// against the real file, FIVE TS-legal reverts sailed through it:
		// `={!true}`, `={PHONE_OK}` where the const is false, `={false as
		// boolean}`, `={ /* on */ false}`, and `{...{ mobileResponsive: false }}` —
		// which defeats half ONE as well, since the name is present in an object
		// literal rather than as an attribute. ⚠ The flag-shaped one is not exotic:
		// `={SOME_FLAG}` is precisely how "turn mobile auth back off" gets written.
		//
		// ⇒ SO IT IS AN ALLOWLIST NOW. Exactly two spellings are accepted — the
		// bare shorthand `mobileResponsive` and the explicit `mobileResponsive=
		// {true}` — and every other value form reddens, INCLUDING ones nobody has
		// thought of. That is the direction a polarity guard has to fail in: a
		// spelling it does not recognise must be a failure rather than a pass.
		expect(
			authTag[0],
			`${AUTH_LAYOUT}: its <GlobalHeader> mount spells \`mobileResponsive\` ` +
				`with a value that is not literally \`{true}\`. Only the bare ` +
				`shorthand or \`={true}\` is accepted here, and the restriction is ` +
				`the point: \`={false}\`, \`={undefined}\`, \`={!true}\` and — the ` +
				`realistic one — \`={SOME_FLAG}\` all render the pre-ADR-0048 header ` +
				`on all three auth routes while leaving a call site that reads like ` +
				`an opt-in. A value this guard cannot evaluate is treated as a ` +
				`revert. If the opt-in is genuinely being reverted, revert this ` +
				`assertion with it and name the ADR that supersedes ADR-0048.`,
		).not.toMatch(/\bmobileResponsive\s*=(?!\s*\{\s*true\s*\})/);

		// HALF THREE — the prop is a real JSX ATTRIBUTE, not a name that merely
		// occurs in the tag. `{...{ mobileResponsive: false }}` puts the string
		// inside the tag while switching the feature off, and half one is a
		// substring check, so it passes. The object-literal form is what
		// distinguishes them.
		expect(
			authTag[0],
			`${AUTH_LAYOUT}: \`mobileResponsive\` appears in the <GlobalHeader> ` +
				`tag as an object property (\`mobileResponsive:\`) rather than as a ` +
				`JSX attribute — a spread like \`{...{ mobileResponsive: false }}\` ` +
				`satisfies a bare name check while rendering the header exactly as ` +
				`it did before ADR-0048. Pass the prop directly.`,
		).not.toMatch(/\bmobileResponsive\s*:/);
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

/**
 * ADR-0049 — WHAT A SIGNED-IN PHONE USER STOPS SEEING, AND WHERE THE HIDE LIVES.
 *
 * Phase A ruled that five header components stay visible at EVERY width and
 * pinned it in the negative half of this file. ADR-0049 REVERSES that for two of
 * them: below 640px the Đ cluster is not rendered at all, and the identity chip
 * reduces to the avatar alone. The information is RELOCATED, not removed — the
 * avatar still links to the viewer's own profile, where balance, portfolio and
 * pseudonym all render. The founder ratified the cost on an informed basis: a
 * signed-in phone user browsing markets does not see their stakeable balance
 * without navigating away.
 *
 * ⛔⛔ THESE TWO TESTS ARE A RELOCATION, NOT AN ADDITION, AND THAT IS THE WHOLE
 * REASON THEY EXIST. The hide lands on each component's OWN ROOT —
 * `DharmaCluster.tsx`'s root span and `IdentityCluster.tsx`'s pseudonym span —
 * never on a wrapper. A wrapper `<div className="max-mobile:hidden">` would push
 * the real node down one level and break `dharma-cluster.test.tsx`'s T4 DOM-order
 * guard, which is exactly what happened the first time this header was reflowed;
 * the `VisitorCounter` row above ships this same own-root shape for this same
 * reason and says so. This is not a third pattern, it is the shipped one.
 *
 * ⚠⚠ AND BECAUSE THE HIDE LIVES OUTSIDE `GlobalHeader.tsx`, G1 CANNOT SEE IT.
 * The never-hidden guard below reads ONLY `GlobalHeader.tsx`; both new tokens
 * live in other files. Its `DharmaCluster` and `IdentityCluster` rows would have
 * stayed GREEN while both behaviours reversed — a guard whose name promises
 * *never hidden* passing over two components that are now hidden. That is a
 * certainty by construction, not a risk to manage, which is why those two rows
 * are MOVED HERE rather than left to redden, and why that guard is renamed to the
 * three components it still asserts.
 *
 * ⛔ THE RESIDUAL, STATED BECAUSE IT IS NOT CLOSED. G1's file scope is still a
 * hole: a hide placed on `HeaderNav.tsx`'s or `RulesControl.tsx`'s own root — or
 * on `BrandCluster.tsx`'s root rather than its inner span — still passes G1
 * silently, exactly as `DharmaCluster`'s would have. Closing that generally was
 * ruled OUT of this task (plan Q4) as a new absence check over files the task
 * does not touch. What changed is that G1's promise is now TRUE of the three
 * components it names, where before it was false about two it also named.
 *
 * ⚠ THE SECOND TEST IS AN INVERSION, NOT A NEW GUARD. It carries what
 * `header-mobile::IdentityCluster.tsx-carries-no-responsive-token-at-all` used to
 * assert, turned round — the WARLI-MOUNT precedent ADR-0048 `:82` names: a
 * deleted guard proves nothing in either direction, an inverted one reddens the
 * moment somebody reverts. Its old form banned the whole responsive vocabulary
 * from this file on a Phase B motive that ADR-0048 already superseded; its new
 * form is a CLOSED ALLOWLIST — exactly one token, exactly `max-mobile:hidden` —
 * so every other spelling still reddens, including ones nobody has thought of.
 * The JOIN CTA's never-hides rule survives ADR-0048 and becomes an EXPLICIT
 * assertion here, because it was previously held only as a side effect of the
 * blanket ban that is being inverted away.
 */
describe("global header mobile reflow — ADR-0049: the signed-in right zone reduces to the avatar below 640px", () => {
	it("header-mobile::DharmaCluster-hides-below-640-on-its-own-root-with-NO-wrapper", () => {
		const source = read(DHARMA);

		// 1 — POLARITY. The default is what makes a future third mount safe by
		// omission (AGENTS.md §8); it is not dead just because both of today's
		// callers pass the prop.
		expect(
			source,
			`${DHARMA}: no \`mobileResponsive = false\` default. The hide must be OFF ` +
				`unless a caller opts in — a mount that forgets the prop has to inherit ` +
				`the DESKTOP render, never an accidental reflow.`,
		).toMatch(/mobileResponsive\s*=\s*false/);

		// 2 — THE DESKTOP RENDER IS UNCHANGED, ASSERTED RATHER THAN ASSUMED.
		// ADR-0049 changes nothing at or above 640px, and "override, never
		// replace" (AGENTS.md §8) is only structural if the base survives.
		const [classes, ...extra] = nodeClasses(source, DHARMA, "dharma-cluster");
		expect(extra).toEqual([]);
		for (const token of ["mr-3.5", "flex", "h-11", "shrink-0"]) {
			expect(
				classes,
				`${DHARMA}: the cluster's base class list lost \`${token}\`. The hide is ` +
					`an ADDITIVE max-mobile: override; the ≥640px render takes zero diff.`,
			).toContain(token);
		}

		// 3 — THE HIDE IS PRESENT AND GATED. Same window idiom the visitor-counter
		// row uses: bounded by the next `<`, which is this node's first child.
		const at = source.indexOf('data-testid="dharma-cluster"');
		const window = source.slice(at, source.indexOf("<", at));
		expect(
			window,
			`${DHARMA}: the cluster's own root cn() call carries no \`${GATED_HIDE}\`. ` +
				`ADR-0049 drops this cluster below 640px; an ungated hide would also ` +
				`reach the (auth) mount, and no hide at all leaves the signed-in header ` +
				`overflowing on every phone.`,
		).toContain(GATED_HIDE);

		// 4 — NO WRAPPER, UNDER ANY NAME. This is the assertion that protects T4's
		// real dependency, and it is the VisitorCounter row's idiom verbatim.
		expect(
			depthWithin(read(HEADER), HEADER, "justify-self-end", "<DharmaCluster"),
			`${HEADER}: <DharmaCluster> is no longer a DIRECT child of the right ` +
				`zone — something wraps it. dharma-cluster.test.tsx's T4 guard walks ` +
				`this node's parent's direct \`.children\`; a wrapper makes the cluster ` +
				`a grandchild and every index in that guard resolves to -1.`,
		).toBe(0);

		// 5 — THE MOUNT PASSES THE PROP, AS THE EXACT LITERAL. An allowlist over
		// the value position, for the reason the (auth) mount's half two records:
		// `={false}`, `={SOME_FLAG}` and `={!true}` are all TS-legal reverts that
		// leave a call site reading like an opt-in.
		const tag = /<DharmaCluster\b[\s\S]*?\/>/.exec(read(HEADER));
		if (!tag) {
			throw new Error(`${HEADER}: no <DharmaCluster ... /> mount found.`);
		}
		expect(
			tag[0],
			`${HEADER}: <DharmaCluster> is not passed ` +
				`\`mobileResponsive={mobileResponsive}\` as that exact literal. Any ` +
				`other spelling either switches the hide off or hard-codes it on for ` +
				`both mounts.`,
		).toMatch(/mobileResponsive=\{mobileResponsive\}/);

		// 6 — AND THE HIDE IS DELIBERATELY *NOT* IN THIS FILE. Recorded as an
		// assertion so a later reader does not "helpfully" move it back up to the
		// header, where it would need a wrapper and would break T4.
		expect(
			tag[0].includes("max-mobile:"),
			`${HEADER}: the <DharmaCluster> mount carries a \`max-mobile:\` token. ` +
				`The hide belongs on the cluster's OWN ROOT in ${DHARMA} — putting it ` +
				`here needs a wrapper element, and a wrapper breaks T4.`,
		).toBe(false);
	});

	it("header-mobile::IdentityCluster-reduces-to-the-avatar-below-640-and-the-JOIN-CTA-never-hides", () => {
		const raw = read(IDENTITY);
		const source = stripComments(raw);

		// 1 — POLARITY.
		expect(
			raw,
			`${IDENTITY}: no \`mobileResponsive = false\` default.`,
		).toMatch(/mobileResponsive\s*=\s*false/);

		// 2 — THE PSEUDONYM SPAN CARRIES THE GATED HIDE. Located by the class that
		// makes it the pseudonym rather than by position: `max-w-40 truncate` is
		// what handles a long pseudonym above 640px and is untouched by this task.
		const pseudoAt = source.indexOf("max-w-40 truncate");
		if (pseudoAt === -1) {
			throw new Error(
				`${IDENTITY}: the pseudonym span's \`max-w-40 truncate\` classes are ` +
					`gone. That is the anchor for this assertion and the mechanism that ` +
					`handles a long pseudonym above 640px — re-derive, do not delete.`,
			);
		}
		const openTag = source.slice(
			source.lastIndexOf("<", pseudoAt),
			source.indexOf(">", pseudoAt),
		);
		expect(
			openTag,
			`${IDENTITY}: the pseudonym <span>'s cn() call carries no ` +
				`\`${GATED_HIDE}\`. ADR-0049 reduces the signed-in chip to the avatar ` +
				`alone below 640px; the avatar stays, the text goes.`,
		).toContain(GATED_HIDE);

		// 3 — A CLOSED ALLOWLIST OVER THE WHOLE FILE, NOT A DENYLIST.
		//
		// ⛔⛔ THIS IS THE INVERTED HALF OF THE OLD GUARD AND IT KEEPS THAT GUARD'S
		// HARDEST-WON PROPERTY. The old one banned the entire variant vocabulary
		// here; the naive inversion is "it now contains max-mobile:hidden", which
		// passes on a file that ALSO gained `max-sm:hidden`, `mobile:flex` or
		// `max-mobile:opacity-0`. An enumeration over what is FORBIDDEN goes stale
		// silently in the passing direction — the same argument this file already
		// makes for `ungatedBreakpointClasses` and for the (auth) mount's half two.
		// So: the file's responsive vocabulary must be EXACTLY ONE token and it
		// must be exactly this one. Everything else reddens, including spellings
		// nobody has thought of.
		//
		// ⚠ The regex matches the variant PREFIX plus its utility, where the old
		// one matched the prefix alone — the whole token is what has to be pinned
		// for "exactly one, and exactly this" to mean anything.
		const VARIANTS =
			/(?:\b(?:max-)?(?:mobile|sm|md|lg|xl|2xl):|\b(?:max|min)-\[[^\]]+\]:)[^\s"'`]*/g;
		const tokens = source.match(VARIANTS) ?? [];
		expect(
			[...tokens].sort(),
			`${IDENTITY}: its responsive vocabulary is [${tokens.join(", ")}]. ` +
				`This file's phone behaviour is RULED, and the allowlist below is the ` +
				`whole of it: ADR-0049 D-1 (the pseudonym text goes) plus ADR-0051 A8 ` +
				`D-5 (the chip becomes a circular avatar). Anything else is a third ` +
				`behaviour nobody ruled on, or one of these two spelled twice.`,
		).toEqual([...RULED_PHONE_VOCABULARY].sort());
		expect(
			ungatedBreakpointClasses(raw),
			`${IDENTITY}: carries a breakpoint class that is not wrapped in ` +
				`\`mobileResponsive && "…"\`. An unconditional hide here reaches the ` +
				`(auth) mount and every future mount at once.`,
		).toEqual([]);

		// 4 — THE JOIN BRANCH CARRIES NO RESPONSIVE TOKEN, EXPLICITLY.
		//
		// ⚠ THIS OBLIGATION USED TO BE HELD BY ACCIDENT. It fell out of the blanket
		// ban being inverted away, so inverting without this line would stop
		// asserting it at all. ADR-0048's whole point is that a phone participant
		// may join: the CTA renders at every width, on every route.
		const joinAt = source.indexOf('href="/sign-in"');
		if (joinAt === -1) {
			throw new Error(
				`${IDENTITY}: the JOIN CTA's \`href="/sign-in"\` is gone.`,
			);
		}
		const joinTag = source.slice(
			source.lastIndexOf("<", joinAt),
			source.indexOf(">", joinAt),
		);
		expect(
			joinTag.match(VARIANTS) ?? [],
			`${IDENTITY}: the signed-out JOIN <Link> carries a responsive token. ` +
				`ADR-0048 supersedes the ADR-0045 carve-out precisely so a phone ` +
				`visitor can join from the surface they are being asked to join from; ` +
				`ADR-0049 reduces the SIGNED-IN chip and touches this branch not at all.`,
		).toEqual([]);

		// 5 — THE AVATAR IS NOT INSIDE THE HIDDEN REGION. This is what makes the
		// test's name ("reduces to the avatar") true of what it does, rather than a
		// claim in its title. `hiddenRegions` is file-agnostic and reused unchanged.
		for (const region of hiddenRegions(raw, IDENTITY)) {
			expect(
				region.includes("<Avatar"),
				`${IDENTITY}: an <Avatar> is INSIDE an element carrying ` +
					`\`${HIDE_BELOW_640}\`, so the chip renders EMPTY below 640px rather ` +
					`than reducing to the avatar. ADR-0049 keeps the avatar — it is the ` +
					`link to the profile where the hidden figures are relocated TO, so ` +
					`hiding it removes the affordance the whole ruling rests on.`,
			).toBe(false);
		}

		// 6 — THE MOUNT: exact literal, and depth zero in the right zone.
		const tag = /<IdentityCluster\b[\s\S]*?\/>/.exec(read(HEADER));
		if (!tag) {
			throw new Error(`${HEADER}: no <IdentityCluster ... /> mount found.`);
		}
		expect(
			tag[0],
			`${HEADER}: <IdentityCluster> is not passed ` +
				`\`mobileResponsive={mobileResponsive}\` as that exact literal.`,
		).toMatch(/mobileResponsive=\{mobileResponsive\}/);
		expect(
			tag[0].includes("max-mobile:"),
			`${HEADER}: the <IdentityCluster> mount carries a \`max-mobile:\` token. ` +
				`The hide belongs on the pseudonym span in ${IDENTITY}; here it would ` +
				`take the avatar and the profile link with it.`,
		).toBe(false);
		expect(
			depthWithin(read(HEADER), HEADER, "justify-self-end", "<IdentityCluster"),
			`${HEADER}: <IdentityCluster> is no longer a DIRECT child of the right ` +
				`zone — something wraps it, and T4 walks direct children.`,
		).toBe(0);
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
	/**
	 * ⚠⚠ RENAMED AT MOBILE-1-HEADER, AND THE RENAME IS THE POINT OF THE EDIT.
	 * This was `…-BrandCluster-DharmaCluster-IdentityCluster-are-never-hidden`.
	 * ADR-0049 rules that below 640px the Đ cluster is not rendered and the
	 * identity chip reduces to its avatar, so two of the five rows below assert a
	 * position the product has reversed. They are RELOCATED — to
	 * `header-mobile::DharmaCluster-hides-below-640-on-its-own-root-with-NO-wrapper`
	 * and
	 * `header-mobile::IdentityCluster-reduces-to-the-avatar-below-640-and-the-JOIN-CTA-never-hides`
	 * — in the ADR-0049 describe block above, where the behaviour now lives.
	 *
	 * ⛔⛔ THEY HAD TO BE MOVED BECAUSE THEY COULD NOT REDDEN. This test reads
	 * ONLY `GlobalHeader.tsx`, and both new hides live on the components' own
	 * roots in their own files. MEASURED at MOBILE-1-HEADER, not predicted: with
	 * the implementation landed and both behaviours reversed, this test was still
	 * GREEN under its old name and its old five rows. A guard promising *never
	 * hidden* passed over two components that are now hidden. ⇒ Renaming it is not
	 * cosmetic — it is what makes the name true of what the body checks.
	 *
	 * ⛔ AND THE FILE-SCOPE HOLE ITSELF IS NOT CLOSED. A hide placed on
	 * `HeaderNav.tsx`'s or `RulesControl.tsx`'s own root — or on
	 * `BrandCluster.tsx`'s root rather than its inner span — still passes here
	 * silently, exactly as `DharmaCluster`'s did. Closing that generally was ruled
	 * OUT of MOBILE-1-HEADER (plan Q4) as a new absence check over files it does
	 * not touch. Stated so the next reader inherits the limit rather than the
	 * impression of coverage.
	 */
	it("header-mobile::HeaderNav-RulesControl-BrandCluster-are-never-hidden", () => {
		const source = read(HEADER);

		// Three separate assertions, three separate messages: each of these is
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
						`mount line. It is one of the THREE components that must render ` +
						`at every width — ${why} ⚠ The list is three, not the five it was ` +
						`before ADR-0049: the Đ cluster and the identity chip's pseudonym ` +
						`now hide below 640px, on their own roots, in their own files.`,
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

	/**
	 * ⚠⚠ `header-mobile::IdentityCluster.tsx-carries-no-responsive-token-at-all`
	 * WAS HERE AND IS NOT DELETED — IT IS INVERTED, AND IT MOVED.
	 *
	 * It banned the ENTIRE responsive vocabulary from `IdentityCluster.tsx`, on
	 * the stated motive that the JOIN CTA it hosts was Phase B's subject and
	 * governed by two conditions ruled there. ADR-0048 superseded that motive (a
	 * phone participant may join, so the CTA must never hide) and ADR-0049
	 * supersedes the ban itself (the signed-in chip reduces to its avatar below
	 * 640px). A blanket ban cannot survive a ruling that requires exactly one
	 * token in the file it bans tokens from.
	 *
	 * ⇒ It is now
	 * `header-mobile::IdentityCluster-reduces-to-the-avatar-below-640-and-the-JOIN-CTA-never-hides`
	 * in the ADR-0049 describe block above — the WARLI-MOUNT precedent ADR-0048
	 * `:82` names: a deleted guard proves nothing in either direction, an inverted
	 * one reddens the moment somebody reverts. Two of its properties are carried
	 * forward deliberately rather than rebuilt: the vocabulary check is still
	 * EXHAUSTIVE (a closed allowlist of exactly one token, not a denylist of
	 * remembered spellings), and the JOIN branch's cleanliness is now asserted
	 * EXPLICITLY, where the ban held it only as a side effect.
	 *
	 * ✅ IT DID ITS JOB ON THE WAY OUT, WHICH IS WHY THIS NOTE IS HERE. Measured
	 * at MOBILE-1-HEADER: it went RED on the implementation — first on the bare
	 * prop name, then on `max-mobile:` — while the never-hidden guard beside it
	 * stayed green through the same change. The un-dodgeable guard fired and the
	 * dodgeable one did not, exactly as ADR-0049 §Guards predicted of each.
	 */
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
 *   (auth)/layout.tsx  →  <GlobalHeader viewer stars           ← ADR-0048:
 *                                       mobileResponsive />      it opts in
 *   GlobalHeader.tsx   →  <RulesControl />                     ← outside the
 *                                                                gated wrapper,
 *                                                                deliberately
 *   RulesControl.tsx   →  <OnboardingDeck context="reshow" …/>
 *
 * ⚠⚠ THE FIRST ARROW READ `← no prop` UNTIL JOB A, AND IT WAS THE FALSEST
 * LINE IN THE FILE — a diagram is read before prose and believed longer. Under
 * ADR-0048 the `(auth)` layout opts in, so the deck DOES reflow when a visitor
 * opens RULES on `/sign-in`, `/sign-in/otp` or `/onboarding`. That is
 * FOUNDER-RATIFIED and intended, not a leak (plan §4, Founder ruling 1): the
 * deck clipped 33px of every body line at 375px, and an auth surface a phone
 * participant is invited to join from has no business rendering it clipped.
 *
 * ⛔ `RulesControl` SITS OUTSIDE THE GATED WRAPPER FOR AN UNRELATED REASON, AND
 * THAT REASON SURVIVES. It is the onboarding deck's only re-show entry point
 * and is present for every viewer, authenticated or not, so it cannot be hidden
 * at any width — a rule this file pins directly (see the negative half in the
 * head docblock) and whose surviving ADR home is ADR-0037. The `SPEC.1 §21.9`
 * citation this diagram used to carry is dropped rather than repointed: §21 is
 * intentionally absent from SPEC.1 2.0.0 (D-29), which REMOVED the ruling
 * rather than relocating it, so there is no live section to cite.
 *
 * ⇒ WHAT THE SEAM CHECK IS FOR, RESTATED. It is no longer "nothing responsive
 * reaches `(auth)`" — ADR-0048 retires that property. It is now the threading
 * discipline itself (AGENTS.md §8): every breakpoint class under `GlobalHeader`
 * is GATED ON THE PROP and the prop is threaded the whole way down, so that
 * which surfaces reflow stays a decision a layout makes, not an accident a
 * class two files away imposes. An unconditional `max-mobile:` class in
 * `OnboardingDeck.tsx` takes that decision away from every present and future
 * mount at once — including any mount that has NOT opted in, which is what the
 * `= false` default exists to protect. Three such classes shipped that way and
 * this is what caught them.
 *
 * ⚠ `context` CANNOT GATE IT, and this is the part worth reading twice. The
 * obvious fix is to key off `context === "reshow"`, and it is wrong: the
 * `(public)` header opens the very same re-show, and `(public)`'s own
 * first-login mount legitimately wants those classes. `context` describes WHICH
 * DECK, never WHICH SURFACE. Only the layout knows the surface, so only a
 * threaded prop can carry the distinction — no `usePathname`, no route
 * special-case, and nothing the deck can work out for itself. ⚠ This holds
 * with FORCE UNCHANGED after ADR-0048, and is worth saying because the obvious
 * inference from "both mounts opt in" is that the distinction stopped
 * mattering. It did not: the two mounts opting in is a fact about today's two
 * call sites, and `context` still cannot tell them apart if a third arrives.
 *
 * ⚠ WHY AN ABSENCE SCAN RATHER THAN A LIST OF EXPECTED CLASSES. An enumeration
 * of today's three classes would go stale the first time a fourth is added —
 * and would go stale SILENTLY, in the passing direction.
 * `ungatedBreakpointClasses` stays true however many there are. ⚠ Its cost is
 * stated in `docs/parked.md` (MOBILE-1 Block D) and is unchanged by this job:
 * an absence scan does not assert the three classes are PRESENT, so deleting
 * them re-breaks the 375px clipping and stays green. A presence pin is owed
 * there, not here.
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
