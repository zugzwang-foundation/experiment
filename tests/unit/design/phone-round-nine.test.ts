import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * MOBILE-2m · ADR-0051 A9 — THE DECLARATION HALF OF ROUND NINE: the feed card
 * without its box (D-1), the split bar's groove (D-2), the header without a Back
 * button and a mark on its own axis (D-3), the 14px pseudonym (D-4), and the
 * filter pill returned to the tabs' own box (D-5).
 *
 * ⚠ SOURCE SCAN, AND IT CLAIMS ONLY WHAT A SOURCE SCAN CAN. jsdom performs no
 * layout — no media query, no Tailwind utility, no flex, no `border-bottom`. So
 * "the card reaches the screen edge at 360", "the groove is one step down from
 * the band" and "the pill is the same height as the tab" are BROWSER
 * measurements and belong to the round's own run. What is pinned here is that
 * the ruled tokens are AUTHORED ON THE RIGHT NODE OF THE RIGHT FILE, which is
 * the half a later edit silently removes. The COMPOSITION half — that the tokens
 * survive `cn`/twMerge and reach the rendered element — is
 * `tests/unit/debate/render/phone-round-nine-card.test.tsx`'s, and the header's
 * is `tests/unit/shell/phone-round-nine-header.test.tsx`'s.
 *
 * ⛔⛔ NO PHONE-VARIANT LITERAL APPEARS IN THIS FILE, AND THAT IS LOAD-BEARING
 * RATHER THAN FASTIDIOUS. Tailwind v4's source detection scans `tests/` as well
 * as `src/` and `docs/` (AGENTS.md §8), so a class-shaped literal written here
 * becomes a REAL emitted utility in the production stylesheet — at which point
 * the built sheet stops being evidence of what components use, and any check
 * that greps it is proving its own literal. Measured precedent: one utility under
 * this variant is in `.next/static/chunks/*.css` with NO `src/` origin, emitted
 * by a test file. ⇒ The prefix is ASSEMBLED AT RUNTIME (`V + S` below), every
 * assertion is written `phone("…")`, and even the regexes that match on the
 * prefix are built from the same two constants.
 * ⛔ Do not "tidy" the concatenation back into literals. Check it before editing
 * — the pattern below is itself broken across two fragments, because a scanner
 * does not know a regex in a comment from a class in a component:
 *
 *   grep -nE "max-mobile""$(printf ':')""[a-zA-Z[]" tests/unit/design/phone-round-nine.test.ts
 *
 * ⚠ The UNPREFIXED literals below (`p-3`, `pt-2.5`, `text-sm`,
 * `[border-bottom:var(--hairline)]`) are safe by a DIFFERENT argument, not the
 * same one: each is already authored in `src/`, so scanning this file re-emits a
 * rule that already exists.
 *
 * ⛔⛔ EVERY SCAN RUNS ON COMMENT-STRIPPED SOURCE. This tree documents each
 * breakpoint decision in prose beside the class that implements it —
 * `PostCard.tsx`'s docblock argues `[border:none]` against `border-0`,
 * `PositionsTable.tsx` names `h-11` and `-my-2.5` four times in the paragraph
 * explaining their REMOVAL, and `AggregateFooter.tsx` names `h-1.5` and
 * `h-[14px]` as superseded values. This repo has shipped the same defect six
 * times: a negative assertion matches the COMMENT that explains the absence and
 * passes for the wrong reason. Strip first, then match a class TOKEN inside a
 * quoted `className`, never a bare word in a file.
 *
 * ⚠ ANCHORED BY SYMBOL, NEVER BY LINE OR BY DISTANCE (`O-8`). Opening tags are
 * bounded by counting braces to their own `>`, so no assertion can silently read
 * a neighbour's class string when a prop is added between — and a character
 * window would be a line number in another unit.
 *
 * ⚠ V-REGISTER DISCIPLINE. This reads the SHIPPED FILES.
 */

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

const POST_CARD = "src/components/debate/PostCard.tsx";
const PHONE_VIEW = "src/components/debate/phone/PhoneDebateView.tsx";
const FOOTER = "src/components/debate/AggregateFooter.tsx";
const ARG_PROFILE = "src/components/debate/ArgProfile.tsx";
const POSITIONS = "src/components/profile/PositionsTable.tsx";
const HEADER = "src/components/shell/GlobalHeader.tsx";
const HEADER_NAV = "src/components/shell/HeaderNav.tsx";
const BUTTON = "src/components/ui/button.tsx";
const CARD = "src/components/ui/card.tsx";
const SCROLLERS = "src/components/debate/scrollers.tsx";

/** The phone variant, never written as one literal. See the ⛔⛔ paragraph. */
const V = "max-mobile";
const S = ":";
const PHONE = V + S;
const phone = (utility: string) => PHONE + utility;
/**
 * ⛔⛔ THE SUFFIX HAS TO BE ASSEMBLED TOO, AND THIS ROUND LEARNED IT THE HARD WAY.
 * `phone()` above keeps the `max-mobile:` PREFIX out of the file — but Tailwind's
 * scanner reads `tests/` for ordinary candidates as well, so `phone(HALF)`
 * still leaves a bare `w-1​/2!` here and emits it into the production stylesheet.
 * Measured with `@tailwindcss/oxide`'s own Scanner and found by `@code-reviewer`:
 * this round's three new suffixes were all being emitted UNPREFIXED with no
 * `src/` origin at all.
 * ⚠ The standing justification for the bare literals this file already keeps —
 * `p-3`, `flex-1`, `text-sm` — is that each is ALREADY authored in `src/`. That is
 * a property of ANOTHER file, which can change without touching this one, so
 * anything this round introduced is assembled rather than trusted.
 * `phone-split-bar.test.ts` minted exactly that rule two rounds ago.
 */
const CHANNEL = "bg-" + "(--surface-inset)";
const HALF = "w-1" + "/" + "2" + "!";
/** MOBILE-2o — A11 D-1's edge and A11 D-3's dim, assembled for the same reason. */
const HAIRLINE = "[border:var(--hairline)]";
const DIM = "disabled:opacity-" + "4" + "0";
const DESKTOP_DIM = "disabled:opacity-(--state-disabled-opacity)";
/** A phone-variant matcher, assembled for the same reason `phone()` is. */
const phoneRe = (tail: string) => new RegExp(`^${V}${S}${tail}`);

/** ADR-0051 **A10 D-2**'s ruled phone track thickness, in px — A9 D-2's 8 and
 * MOBILE-2e's 6 before it. Third move; derive, never restate. */
const PHONE_TRACK_PX = 14;

// ── readers ──────────────────────────────────────────────────────────────────

/**
 * Source with block and line comments removed. See the ⛔⛔ paragraph above —
 * every reader below takes its input from here.
 *
 * ⚠ Its one assumption: no `//` OPENING A LINE inside a string literal in the
 * scanned files. True today, and the failure mode is loud — a truncated line
 * makes an anchor throw, never pass.
 */
function code(path: string): string {
	return read(path)
		.replace(/\/\*[\s\S]*?\*\//g, " ")
		.replace(/^\s*\/\/.*$/gm, " ");
}

/**
 * The full text of the opening tag beginning at `at` — up to the first `>` that
 * is NOT inside a JSX expression container.
 *
 * ⛔ BRACE-COUNTED RATHER THAN WINDOWED. `onReplyToPost={(id, relation) => { … }}`
 * alone puts three `>` characters inside one of these tags, so a naive
 * `indexOf(">")` stops in the middle of an arrow function and every assertion
 * after it reads a truncated tag while reporting green.
 */
function openingTagAt(source: string, file: string, at: number): string {
	let depth = 0;
	for (let i = at; i < source.length; i += 1) {
		const ch = source[i];
		if (ch === "{") depth += 1;
		else if (ch === "}") depth -= 1;
		else if (ch === ">" && depth === 0) return source.slice(at, i + 1);
	}
	throw new Error(`${file}: opening tag at offset ${at} never closes.`);
}

/** Every opening tag mounting `<Name` in `source`, in source order. */
function mounts(source: string, file: string, name: string): string[] {
	const found: string[] = [];
	const needle = `<${name}`;
	let at = source.indexOf(needle);
	while (at !== -1) {
		// Guard against `<CardHeader` matching a search for `<Card`.
		if (!/[A-Za-z0-9_]/.test(source[at + needle.length] ?? "")) {
			found.push(openingTagAt(source, file, at));
		}
		at = source.indexOf(needle, at + needle.length);
	}
	if (found.length === 0) {
		throw new Error(`${file}: no <${name} mount found.`);
	}
	return found;
}

/**
 * The opening tag of the nearest ENCLOSING `<tagName` at or before `anchor`.
 * Used for the two elements this round touches that carry no `data-testid`.
 */
function tagAround(
	source: string,
	file: string,
	anchor: string,
	tagName: string,
): string {
	const at = source.indexOf(anchor);
	if (at === -1) {
		throw new Error(
			`${file}: anchor not found: ${anchor}. If the element was restructured, ` +
				`RE-DERIVE this guard rather than deleting it.`,
		);
	}
	const open = source.lastIndexOf(`<${tagName}`, at);
	if (open === -1) {
		throw new Error(`${file}: no enclosing <${tagName} before ${anchor}.`);
	}
	return openingTagAt(source, file, open);
}

/** The class tokens of the first `className` inside `tag`. */
function classesIn(tag: string, file: string): string[] {
	const m = /className=\{?(?:cn\(\s*)?"([^"]*)"|className=\{`([^`$]*)/.exec(
		tag,
	);
	if (!m) {
		throw new Error(`${file}: no className in tag: ${tag.slice(0, 120)}…`);
	}
	return (m[1] ?? m[2] ?? "").split(/\s+/).filter(Boolean);
}

/**
 * The class tokens of the first `className` FOLLOWING `anchor` — handling
 * `className="…"`, `className={cn("…", …)}` and the template-literal form.
 *
 * ⛔ IT THROWS ON A MISS RATHER THAN RETURNING `[]`. An anchor that has stopped
 * matching silently returns an empty token list, and every `not.toContain`
 * downstream then passes on nothing at all — the exact shape of a guard that has
 * stopped guarding while reporting green.
 */
function classesAfter(source: string, file: string, anchor: string): string[] {
	const at = source.indexOf(anchor);
	if (at === -1) {
		throw new Error(
			`${file}: anchor not found: ${anchor}. If the element was restructured, ` +
				`RE-DERIVE this guard rather than deleting it.`,
		);
	}
	return classesIn(source.slice(at + anchor.length), file);
}

/**
 * The class tokens of the single string literal a `flag && "…"` conditional
 * guards, WITHIN a bounded region — never "somewhere later in the file".
 *
 * ⛔ THE BOUND IS THE POINT. `GlobalHeader.tsx` carries four separate
 * `mobileResponsive && "…"` conditionals; an unbounded search from the brand
 * cluster's mount finds the VISITOR COUNTER's, five nodes down, and reports a
 * green centring guard on a class string that has nothing to do with the mark.
 */
function gatedClassesIn(region: string, file: string, flag: string): string[] {
	const m = new RegExp(`${flag}\\s*&&\\s*(?:!\\w+\\s*&&\\s*)?"([^"]*)"`).exec(
		region,
	);
	if (!m) {
		throw new Error(
			`${file}: no \`${flag} && "…"\` conditional in this region. A9's phone ` +
				`tokens are GATED — an ungated class reaches every mount of the ` +
				`component at once.`,
		);
	}
	return (m[1] ?? "").split(/\s+/).filter(Boolean);
}

/** The region from `anchor` to the end of the enclosing JSX expression. */
function regionAfter(source: string, file: string, anchor: string): string {
	const at = source.indexOf(anchor);
	if (at === -1) {
		throw new Error(`${file}: anchor not found: ${anchor}`);
	}
	return source.slice(at);
}

// ─────────────────────────────────────────────────────────────────────────────
// R-1 / A9 D-1 — the feed card stops being a box
// ─────────────────────────────────────────────────────────────────────────────

/** `PostCard`'s one unboxing token set, read off its own declaration. */
function unboxedTokens(): string[] {
	const m = /const UNBOXED_CARD\s*=\s*"([^"]*)"/.exec(code(POST_CARD));
	if (!m) {
		throw new Error(
			`${POST_CARD}: no \`const UNBOXED_CARD = "…"\`. The unboxing set is ` +
				`declared ONCE so the present and the removed branch cannot drift ` +
				`into two answers; if it moved, re-derive rather than scanning the ` +
				`two call sites separately.`,
		);
	}
	return (m[1] ?? "").split(/\s+/).filter(Boolean);
}

describe("MOBILE-2m · R-1 / A9 D-1 — the post card carries no box below 640", () => {
	it("phone-r1::the-card-drops-its-BORDER-below-640", () => {
		// ⛔ `[border:none]`, NOT `border-0`, and the spelling IS the mechanism.
		// `Card`'s edge is the arbitrary-property SHORTHAND
		// `[border:var(--hairline)]`; `border-0` sets `border-width` alone and
		// leaves the shorthand's colour and style standing. Only a shorthand
		// overrides a shorthand — the same finding `CommentImage.tsx` already
		// records on its own phone arm, measured in the compiled sheet rather than
		// inferred.
		expect(unboxedTokens()).toContain(phone("[border:none]"));
		expect(
			unboxedTokens(),
			"`border-0` sets border-WIDTH; the base declaration is a shorthand and " +
				"survives it, so the card keeps a hairline no jsdom test can see.",
		).not.toContain(phone("border-0"));
	});

	it("phone-r1::the-card-drops-its-RADIUS-below-640", () => {
		expect(unboxedTokens()).toContain(phone("rounded-none"));
	});

	it("phone-r1::and-the-ELEVATION-goes-with-them", () => {
		// ⛔ THE ORPHAN THIS CHANGE CREATES RATHER THAN SCOPE CREEP. `--elev-1`
		// carries `inset 0 1px 0 rgb(255 255 255 / 0.04)` — a one-pixel pale line
		// across the TOP of the card. On a boxed card that is the lit edge of a
		// raised surface; on a full-bleed band it is a second horizontal rule a
		// pixel below the hairline that separates the posts, and A9 D-1 says posts
		// are separated by ONE hairline. Leaving it ships two.
		expect(unboxedTokens()).toContain(phone("shadow-none"));
	});

	it("phone-r1::the-unboxing-set-is-a-CLOSED-list-of-exactly-those-three", () => {
		// ⛔⛔ CLOSED, NOT MERELY NON-EMPTY, AND THIS IS THE ROW THE 9:16 PORTRAIT
		// CASE TURNS ON. The attachment's height chain is `Card (min-h-0 flex-1)` →
		// the `.argimg` cell → `CommentImage`'s button → the `<img>`, and
		// `PostCard.tsx`'s own docblock says breaking any link silently reverts the
		// image to its intrinsic size. A fourth token quietly added here — a
		// `min-h-0`, an `overflow-visible`, a `p-0` — would cut that chain at the
		// top with no symptom any assertion in this round could see. A closed
		// allowlist reddens on spellings nobody has thought of; a denylist goes
		// stale silently in the PASSING direction.
		expect([...unboxedTokens()].sort()).toEqual(
			[
				phone("[border:none]"),
				phone("rounded-none"),
				phone("shadow-none"),
			].sort(),
		);
	});

	it("phone-r1::BOTH-card-branches-take-it-and-neither-hard-codes-it", () => {
		// The present branch and the removed branch are two `<Card>`s. A removed
		// post is still a post in the feed, so an unboxed feed with a boxed
		// tombstone in it is the "stray box" A9 D-1 names as the thing to avoid.
		const cards = mounts(code(POST_CARD), POST_CARD, "Card");
		expect(cards, "the present branch and the removed branch").toHaveLength(2);
		for (const tag of cards) {
			expect(
				tag,
				"unboxing is conditional, never written onto the Card",
			).toContain("unboxed && UNBOXED_CARD");
		}
	});

	it("phone-r1::the-desktop-declarations-are-OVERRIDDEN-not-REPLACED", () => {
		// ADR-0045's first rule at the site this round touches: the desktop stays
		// the unprefixed default and the phone rule is an ADDITIVE token beside it.
		// A build that deleted `Card`'s own edge instead of overriding it would
		// satisfy every row above and silently take the border off the 1440 render,
		// which no phone measurement would ever see.
		const base = classesAfter(code(CARD), CARD, 'data-slot="card"');
		expect(base, "the 1440 edge").toContain("[border:var(--hairline)]");
		expect(base, "the 1440 corner").toContain("rounded-(--r)");
		expect(base, "the 1440 elevation").toContain("shadow-(--elev-1)");
		for (const token of unboxedTokens()) {
			expect(
				token.startsWith(PHONE),
				`${token} is not phone-scoped, so it reaches the desktop card too.`,
			).toBe(true);
		}
	});

	it("phone-r1::ONLY-the-feed-mount-asks-for-it", () => {
		// ⛔⛔ THE PROP'S WHOLE REASON. `PostCard` has THREE mounts: the phone feed,
		// the phone PARENT-POST SHEET, and the desktop scroller. A9 D-1 rules the
		// FEED. A sheet is a box by definition — backdrop, handle, close control —
		// so a card that unboxed itself there would dissolve into the sheet's own
		// ground and lose the one edge that says where the argument stops.
		const phoneMounts = mounts(code(PHONE_VIEW), PHONE_VIEW, "PostCard");
		expect(phoneMounts, "the feed and the parent-post sheet").toHaveLength(2);
		const asking = phoneMounts.filter((tag) => /\bunboxed\b/.test(tag));
		expect(asking, "exactly one mount unboxes").toHaveLength(1);
		expect(
			asking[0],
			"the mount that unboxes is the FEED's (`post={post}`), not the sheet's " +
				"(`post={focused}`).",
		).toContain("post={post}");

		for (const tag of mounts(code(SCROLLERS), SCROLLERS, "PostCard")) {
			expect(
				/\bunboxed\b/.test(tag),
				"the desktop scroller must never unbox — every token is phone-scoped, " +
					"so this is inert today and a trap the day one is not.",
			).toBe(false);
		}
	});

	it("phone-r1::the-prop-DEFAULTS-OFF-so-a-third-mount-is-safe-by-omission", () => {
		// The polarity `GlobalHeader`'s `mobileResponsive` already ships (AGENTS.md
		// §8): a mount that says nothing keeps the box, and unboxing is something a
		// caller has to ASK for.
		expect(code(POST_CARD)).toContain("unboxed = false");
	});
});

describe("MOBILE-2m · R-1 / A9 D-1 — one full-width hairline between posts", () => {
	it("phone-r1::the-seam-lives-on-the-WRAPPER-and-the-last-one-drops-it", () => {
		// ⛔ ON THE WRAPPER, NOT ON THE CARD. A9 D-1 says the card carries no border
		// of its own; a `border-b` written onto the card would be exactly that, and
		// the next reader would have to hold two contradictory sentences at once.
		// This element already exists as the R-2 jump anchor and spans the full
		// column, so a rule on it is unambiguously a SEPARATOR rather than an edge
		// belonging to either post.
		const wrapper = classesAfter(
			code(PHONE_VIEW),
			PHONE_VIEW,
			"data-phone-post-id={post.id}",
		);
		expect(wrapper).toContain("[border-bottom:var(--hairline)]");
		// ⚠ "Separated by" is a relation between TWO posts. A rule under the final
		// card separates it from nothing and reads as a floor the feed does not
		// have — the column continues into 140px of scroll runway.
		expect(wrapper).toContain("last:[border-bottom:none]");
	});

	it("phone-r1::the-column-gives-up-its-own-inset-AND-its-gap", () => {
		// ⛔ BOTH, AND THEY ARE ONE DECISION. The card kept `p-3` and the column
		// dropped `px-3`, so 24px of DOUBLED inset becomes 12px carried once: the
		// content box widens by exactly 24px and the card's edges land on the
		// screen's — which is what makes the separator full width with no negative
		// margin anywhere. And the gap goes because a hairline in the middle of one
		// is not a seam: at `gap-2.5` the rule floats 10px from the card above and
		// 0px from the one below, reading as a rule belonging to the lower post.
		const pane = classesAfter(code(PHONE_VIEW), PHONE_VIEW, "const feedPane");
		expect(pane, "the doubled horizontal inset is gone").not.toContain("px-3");
		expect(pane, "a gap the seam would float inside").not.toContain("gap-2.5");
		// CONTROL — the VERTICAL padding stays. It is the distance from the tabs
		// and from the bottom bar, not the distance between posts, so an edit that
		// stripped the whole class string reddens here rather than passing.
		expect(pane, "clearance from the side tabs").toContain("pt-2.5");
		expect(pane, "the bottom bar's runway").toContain("pb-[140px]");
		expect(pane).toContain("flex");
		expect(pane).toContain("flex-col");
	});

	it("phone-r1::the-empty-CTA-takes-the-inset-BACK-explicitly", () => {
		// ⚠ IT IS THE ONE CHILD HERE THAT IS NOT A FULL-BLEED CARD, and a centred
		// call to action running into both screen edges is not what A9 D-1 rules.
		// Asserted so the removal above reads as MOVED rather than deleted.
		expect(
			tagAround(code(PHONE_VIEW), PHONE_VIEW, "<EmptySideCTA", "div"),
			"the CTA must be wrapped in the tier's horizontal padding — the column " +
				"no longer supplies it.",
		).toContain('className="px-3"');
	});
});

describe("MOBILE-2m · R-1 / A9 D-1 — the Support/Counter band", () => {
	/**
	 * ⛔⛔ THE FOOTER ROOT'S OWN `className`, AND THE SCOPE IS THE WHOLE POINT
	 * SINCE A10 D-3. This read `gatedClassesIn(regionAfter(…), "band")`, i.e. the
	 * first `band && "…"` conditional ANYWHERE after the footer's testid — which
	 * was the root's while the root had one. A10 D-3 takes the root's conditional
	 * away, so that search now runs on past it and finds the TRACK's channel
	 * three hundred lines down: a "the row has no ground" assertion would then be
	 * reading the split bar's ground and failing on the wrong node.
	 * ⇒ Anchored on the root's own attribute and stopped at the end of its tag.
	 */
	const bandTokens = () => {
		const src = code(FOOTER);
		const at = src.indexOf('data-testid="aggregate-footer"');
		expect(at, `${FOOTER}: the footer root's testid is gone`).toBeGreaterThan(
			0,
		);
		const tag = src.slice(at, src.indexOf(">", at));
		// ⛔ WITHOUT THIS THE WHOLE `describe` IS VACUOUS UNDER AN ATTRIBUTE
		// REORDER. The slice starts at the testid, so a `className` written BEFORE
		// it leaves no class string in the window — the loops below then iterate
		// over nothing and every "the row has no ground" negative passes on an
		// empty array. `@code-reviewer`, LOW.
		expect(
			tag,
			`${FOOTER}: the footer root's \`className\` is not inside the window this ` +
				`guard reads — most likely it now precedes \`data-testid\` on the tag.`,
		).toContain("className");
		// Every quoted run inside the root's own tag — so a plain
		// `className="…"` and a `className={cn("…", "…")}` are both read, and
		// neither can reach past the tag it belongs to.
		return (tag.match(/"[^"]*"/g) ?? [])
			.flatMap((quoted) => quoted.slice(1, -1).split(/\s+/))
			.filter(Boolean);
	};

	it("phone-r1::and-NO-BORDER-anywhere-in-it", () => {
		// ⛔⛔ THE RULED NEGATIVE (A9 D-1: "a lighter ground and no border, so the
		// bet control reads as one band INSIDE the card"). An edge here would draw
		// a second box inside a card that has just given its own up — a stray
		// rectangle on a surface whose whole point this round is that it has none.
		// ⚠ MATCHED AS A CLASS TOKEN INSIDE THE GATED STRING, never as a word in
		// the file: this component's prose names `[border:var(--hairline)]` twice
		// in the paragraph arguing the TRACK keeps its edge, so a bare-string scan
		// would be satisfied by the comment and could never fail.
		const edge = new RegExp(
			`^${V}${S}(?:\\[border|border-|divide-|ring-|outline-)`,
		);
		for (const token of bandTokens()) {
			expect(
				edge.test(token),
				`the band declares an edge (\`${token}\`). A9 D-1 gives it a ground ` +
					`and nothing else.`,
			).toBe(false);
		}
	});

	it("phone-r1::the-band-is-the-CARDS-decision-and-arrives-as-a-prop", () => {
		// ⚠ THE TWO DECISIONS TRAVEL TOGETHER AND CANNOT BE SET APART. The band
		// only reads as a band because the card around it lost its border and its
		// radius; on a BOXED card the same ground is a lighter rectangle inside a
		// darker one. So `PostCard` passes its own `unboxed` through, at BOTH
		// branches, and this footer never decides for itself.
		expect(code(FOOTER), "and it defaults off").toContain("band = false");
		const footers = mounts(code(POST_CARD), POST_CARD, "AggregateFooter");
		expect(footers, "the present branch and the removed branch").toHaveLength(
			2,
		);
		for (const tag of footers) {
			expect(tag).toContain("band={unboxed}");
		}
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// R-2 / A9 D-2 — the split bar's thickness and its groove
// ─────────────────────────────────────────────────────────────────────────────

describe("MOBILE-2n · R-2 / A10 D-2 — the track is 14px with rounded ends", () => {
	const trackTokens = () =>
		classesAfter(code(FOOTER), FOOTER, 'data-testid="aggregate-split-track"');

	it("phone-r2::the-track-declares-the-ruled-phone-thickness", () => {
		// ⚠ THE DESKTOP HALF IS DELIBERATELY NOT DUPLICATED HERE.
		// `split-bar-parity.test.ts` and `aggregate-footer-alignment.test.ts` both
		// RE-DERIVE the 18px literal from `PriceBar.tsx`'s `detail.bar` and read it
		// out of this same class string, so the 1440 thickness already reddens in
		// two places if it moves. This row owns the phone token and only that.
		expect(trackTokens()).toContain(phone(`h-[${PHONE_TRACK_PX}px]`));
	});

	it("phone-r2::the-ends-are-declared-ROUND-rather-than-inherited-round", () => {
		// ⛔ `rounded-full` RATHER THAN LEANING ON `--r`. At 8px tall an 8px radius
		// already clamps to 4px and looks identical today, which is exactly the
		// problem: the shape would be a coincidence of two numbers free to move
		// apart, and the day `--r` is re-pointed the ends stop being ends with
		// nothing else changing. A9 D-2 rules ENDS, so the declaration says ends.
		expect(trackTokens()).toContain(phone("rounded-full"));
	});
});

describe("MOBILE-2o · A11 D-2 — the channel is gated on Đ 0; the fill is the share", () => {
	it("phone-r2::the-channel-is-the-ZERO-state-and-the-fill-carries-no-override", () => {
		// ⛔⛔ WHY THE FLAG AND NOT THE PERCENTAGE. `computeSplitBar`'s own docblock
		// says `supportPct` is `"0%"` both when nothing has been staked and when
		// everything staked is Counter, "and those are opposite facts". A footer
		// keying on the percentage alone paints the two identically.
		// ⛔⛔ REVERSED FROM A10 D-2, AND THE PARAGRAPH BELOW IS THE RECORD OF WHAT
		// IS REVERSED. A9 D-2 gated the groove on `!hasStake`; A10 D-2 made it
		// UNCONDITIONAL and ruled that "the Counter share IS the exposed channel",
		// and this row then asserted the gate had moved to the FILL as a 50% width.
		// A11 D-2 corrects A10: the side rule — black = YES, white = NO — holds on
		// BOTH halves of the bar, so the remainder is Counter's own pole and the
		// channel can only be the Đ 0 / Đ 0 state. The gate comes back to the track
		// and the fill's override is gone.
		// ⚠ THE BEHAVIOURAL HALF cannot be seen in a source scan and is
		// `phone-round-nine-card.test.tsx`'s two-aggregate render, which asserts the
		// channel present at Đ 0 and ABSENT once there is stake.
		const src = code(FOOTER);
		expect(
			src,
			"the footer must still READ the flag — it is what tells Đ 0 / Đ 0 apart " +
				"from an all-Counter bar, and those are opposite facts.",
		).toContain("hasStake");

		const trackRegion = regionAfter(
			src,
			FOOTER,
			'data-testid="aggregate-split-track"',
		);
		expect(
			gatedClassesIn(trackRegion, FOOTER, "band && !hasStake"),
			"the channel is the design language's own recessed surface, and it is " +
				"the Đ 0 / Đ 0 state rather than the track's standing ground.",
		).toContain(phone(CHANNEL));

		// ⛔ THE FILL CARRIES NOTHING. Scoped to the fill's own region so the
		// negative cannot be satisfied by the track's conditional above it.
		const fillRegion = regionAfter(
			src,
			FOOTER,
			'data-testid="aggregate-split-fill"',
		);
		expect(
			fillRegion.slice(0, fillRegion.indexOf("/>")),
			"a phone width override is authored on the fill, so the bar's " +
				"proportion is a presentation fact rather than the share.",
		).not.toContain(HALF);
	});

	it("phone-r2::the-superseded-A9-groove-is-not-authored-beside-the-channel", () => {
		// ⛔ `bg-n0` WAS A9 D-2's groove and is the CARD's own ground, so a track
		// still carrying it would be invisible rather than recessed. Cheap tripwire
		// against the two tokens being authored side by side; the real absence is
		// asserted on the RENDERED node, across both aggregates, in
		// `phone-round-nine-card.test.tsx`. Named as a tripwire rather than left
		// reading like the guard (`@code-reviewer`, LOW — carried forward from the
		// row this replaces, because the reasoning is unchanged).
		expect(
			gatedClassesIn(
				regionAfter(
					code(FOOTER),
					FOOTER,
					'data-testid="aggregate-split-track"',
				),
				FOOTER,
				"band && !hasStake",
			),
		).not.toContain(phone("bg-n0"));
	});
});

describe("MOBILE-2o · A11 D-1 / D-3 — the black edge and the refusal, in the source", () => {
	it("phone-r2::the-hairline-is-declared-on-the-BLACK-branch-of-the-pole-ternary", () => {
		// ⛔ THE RENDER GUARD OWNS THE BEHAVIOUR; THIS ROW OWNS THE SHAPE. A render
		// proves the token reaches the right element after `twMerge`; only the source
		// shows WHICH BRANCH of the pole ternary declares it, and the branch is the
		// whole of A11 D-1 — the edge belongs to the black side, and to the black
		// side only.
		const src = code(FOOTER);
		const ternary =
			/resultingSide === "YES"\s*\?\s*"([^"]*)"\s*:\s*"([^"]*)"/.exec(src);
		expect(ternary, `${FOOTER}: the pole ternary is gone`).not.toBeNull();
		const [black, white] = [ternary?.[1] ?? "", ternary?.[2] ?? ""];
		expect(
			black.split(/\s+/),
			"the black pole has no phone hairline",
		).toContain(phone(HAIRLINE));
		expect(
			white.split(/\s+/),
			"the white pole took the black side's edge, which is A11 D-1 applied to " +
				"the relation instead of to the side.",
		).not.toContain(phone(HAIRLINE));
		// ⛔ ADDITIVE, NOT A REPLACEMENT. The desktop declaration stays; replacing it
		// would be a desktop edit, and this round's wall is a desktop diff of
		// exactly nothing.
		expect(
			black.split(/\s+/),
			"the desktop border declaration was replaced rather than overridden.",
		).toContain("border-n2");
	});

	it("phone-r2::the-refusal-is-an-ADDITIVE-opacity-and-never-a-ground", () => {
		// ⛔ A11 D-3 — the refused side is its own colour dimmed. The negative is the
		// half that matters: a `disabled:bg-…` anywhere in this file would satisfy
		// "it looks different" and destroy the one thing the colour carries.
		const src = code(FOOTER);
		expect(
			src,
			"the phone refusal opacity is not authored on the trigger",
		).toContain(phone(DIM));
		expect(
			src,
			"the desktop refusal opacity was replaced rather than overridden.",
		).toContain(DESKTOP_DIM);
		expect(
			src,
			"a disabled BACKGROUND is authored somewhere in this footer, which is " +
				"the grey fill A11 D-3 exists to forbid.",
		).not.toMatch(/disabled:bg-/);
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// R-3 / A9 D-3 — the header's Back button, and the mark's own axis
// ─────────────────────────────────────────────────────────────────────────────

describe("MOBILE-2m · R-3 / A9 D-3 — Back does not render below 640", () => {
	it("phone-r3::the-hide-sits-on-the-BACK-control-and-is-GATED", () => {
		// ⛔⛔ THE GATE IS THE PROP CHAIN, NOT THE FILE BOUNDARY (AGENTS.md §8).
		// `HeaderNav` is a STATIC child of `GlobalHeader`, which BOTH layouts
		// mount — so an unconditional hide here reaches `(auth)` exactly as surely
		// as `(public)`, which is how three ungated classes once shipped onto
		// `/sign-in` through `RulesControl` → `OnboardingDeck`. Both mounts opt in
		// today, so the rendered outcome is the same either way; what the gate buys
		// is that a THIRD mount inherits the desktop header by omission.
		expect(
			gatedClassesIn(
				tagAround(code(HEADER_NAV), HEADER_NAV, 'aria-label="Back"', "button"),
				HEADER_NAV,
				"mobileResponsive",
			),
		).toContain(phone("hidden"));
	});

	it("phone-r3::and-NOTHING-in-this-file-hides-UNGATED", () => {
		// ⛔ THE HALF THAT ACTUALLY PROTECTS `(auth)`. The row above proves a gated
		// hide EXISTS; it cannot see a SECOND, ungated one added beside it. Count
		// every occurrence of the token and require each to sit inside a
		// `mobileResponsive && "…"` string.
		const src = code(HEADER_NAV);
		const token = phone("hidden");
		const total = src.split(token).length - 1;
		const gated = [...src.matchAll(/mobileResponsive\s*&&\s*"([^"]*)"/g)]
			.flatMap((m) => (m[1] ?? "").split(/\s+/))
			.filter((t) => t === token).length;
		expect(total, "the hide is declared at all").toBeGreaterThan(0);
		expect(
			gated,
			"an occurrence of the hide sits OUTSIDE a `mobileResponsive &&` " +
				"conditional, so it reaches /sign-in, /sign-in/otp and /onboarding.",
		).toBe(total);
	});

	it("phone-r3::the-header-THREADS-the-prop-down-to-it", () => {
		// ⚠ THE PAIR IS THE POINT. A gate nobody feeds is a control that never
		// hides, and the row above would still pass.
		const nav = mounts(code(HEADER), HEADER, "HeaderNav");
		expect(nav, "one HeaderNav, in the header's left zone").toHaveLength(1);
		expect(nav[0]).toContain("mobileResponsive={mobileResponsive}");
	});

	it("phone-r3::HIDDEN-never-UNMOUNTED", () => {
		// ⛔ A PAINT DECISION, NOT A STRUCTURAL ONE. The button, its handler and its
		// `history.length` probe are untouched, so nothing about the desktop
		// control's behaviour is reachable from this change and a resize across the
		// tier restores it with its state intact. A conditional render would also
		// make `header-nav-back.test.tsx`'s three disabled-state rows unreachable
		// at phone width, for no reason A9 asks for. The DOM half is
		// `phone-round-nine-header.test.tsx`'s.
		expect(
			/\{\s*!?mobileResponsive\s*&&\s*\(?\s*<button/.test(code(HEADER_NAV)),
			"Back is rendered CONDITIONALLY on the tier prop. A9 D-3 rules that it " +
				"does not render below 640 — the mechanism ruled is the class, not " +
				"the tree.",
		).toBe(false);
	});
});

describe("MOBILE-2m · R-3 / A9 D-3 — the mark is centred on the header's own axis", () => {
	const brandCell = () =>
		tagAround(code(HEADER), HEADER, "<BrandCluster", "div");

	it("phone-r3::the-cell-LEAVES-THE-GRID-and-takes-the-headers-midpoint", () => {
		// ⛔⛔ POSITIONED AGAINST THE HEADER, NOT AGAINST THE SPACE THE BUTTONS
		// LEAVE — that distinction is the whole item. `1fr` is `minmax(auto, 1fr)`,
		// so once the LEFT zone freezes at its own min-content every remaining
		// pixel lands on the right and the `auto` centre track is pushed off true
		// centre. MEASURED at the floor, signed in: the mark's centre sits at a
		// CONSTANT 223.13px at every phone width — +43.13px at 360, +35.63 at 375,
		// +28.13 at 390, +8.13 at 430. Taking Back away does NOT fix that; it moves
		// the constant, leaving the mark off centre by a DIFFERENT number at every
		// width.
		// ⛔ ALL THREE TOKENS OR NONE. `absolute` alone leaves the cell at its
		// static position; `left-1/2` alone does nothing to a grid item; and
		// without the translate the mark's LEFT EDGE sits on the midpoint rather
		// than its centre — half a mark off, which looks like a near miss instead
		// of a missing rule.
		const tokens = gatedClassesIn(brandCell(), HEADER, "mobileResponsive");
		expect(tokens).toContain(phone("absolute"));
		expect(tokens).toContain(phone("left-1/2"));
		expect(tokens).toContain(phone("-translate-x-1/2"));
	});

	it("phone-r3::the-desktop-cell-is-UNTOUCHED", () => {
		// ADR-0045's first rule again: the grid placement stays the unprefixed
		// default, so at and above 640 the mark is still a grid item in the `auto`
		// track and still this row's shock absorber.
		expect(brandCell()).toContain('"justify-self-center"');
	});

	it("phone-r3::the-HEADER-is-the-containing-block-the-centring-resolves-against", () => {
		// ⛔⛔ THE LINK THAT MAKES THE TWO TOKENS ABOVE MEAN "CENTRED". An absolute
		// child resolves against its nearest POSITIONED ancestor; the grid row
		// between is static, so the answer is `<header>` — and only because
		// `<header>` is `sticky`, which IS a positioned element. Drop that one
		// class and `left-1/2` resolves against the initial containing block
		// instead, silently, with no error and no other failing assertion in this
		// round.
		// ⚠ `sticky-header.test.ts` also pins this class, for its STACKING claim.
		// This is a second guard on the same declaration from inside the task that
		// could break it, asserting a DIFFERENT property of it — the same shape
		// `global-header-mobile-reflow.test.ts` already uses for the `h-[60px]`
		// row, and not a duplicate.
		const header = /<header className="([^"]*)"/.exec(code(HEADER))?.[1] ?? "";
		expect(header.split(/\s+/)).toContain("sticky");
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// R-4 / A9 D-4 — the pseudonym steps down to 14px
// ─────────────────────────────────────────────────────────────────────────────

describe("MOBILE-2m · R-4 / A9 D-4 — the pseudonym is 14px with its own leading", () => {
	const pseudonym = () =>
		classesAfter(
			code(ARG_PROFILE),
			ARG_PROFILE,
			"encodeURIComponent(author.pseudonym)",
		);
	const phoneToken = (prefix: string) =>
		pseudonym().find((t) => t.startsWith(phone(prefix)));

	it("phone-r4::the-name-declares-the-ruled-size", () => {
		expect(pseudonym()).toContain(phone("text-[14px]"));
	});

	it("phone-r4::and-STATES-ITS-LEADING-BESIDE-IT", () => {
		// ⛔⛔ THE DEFECT IS A SIZE WITHOUT A LEADING, NOT A WRONG SIZE. An
		// arbitrary `text-[Npx]` does NOT reset the paired line-height (AGENTS.md
		// §8, measured on staging at PROFILE-FULL): the arbitrary form inherits
		// whatever step was in scope, so a 14px name keeps the 22px line box the
		// 17px name shipped with — the type shrinks and the row does not, which is
		// the one outcome A9 D-4 cannot want. State the leading whenever you state
		// an arbitrary size.
		// ⚠⚠ THE LEADING IS NO LONGER AN ARBITRARY px VALUE, AND ADR-0051 A10 D-4
		// IS WHY. A9 D-4's 18px held the shipped 17/22 ratio at the new size, which
		// is a correct thing to preserve and the wrong thing to solve for: an 18px
		// line box inside a 32px `min-h-8` element sits at the TOP of it, so the
		// name's glyphs landed 7.25px above the avatar's centre (measured at
		// 360/375/390/412/430 — the same figure at every width, because it is set
		// by two box heights and not by the width).
		// ⇒ `leading-8` makes the LINE BOX the element's box, so the half-leading
		// centres the glyphs in it. The relation that must hold is now between the
		// leading and the FLOOR rather than between the leading and the size, and
		// it is asserted as the same spacing step rather than as a number: this
		// token, `min-h-8` beside it and the avatar's own `size-8` are all
		// `calc(var(--spacing) * 8)`, so they move together under a changed root
		// font size instead of drifting apart.
		const sizeToken = phoneToken("text-[");
		expect(sizeToken, "the name still states its size").toBeDefined();
		expect(
			phoneToken("leading-["),
			"the name states an ARBITRARY leading again. A10 D-4 pairs the line box " +
				"with the avatar's own box by NAME (`leading-8` / `min-h-8` / " +
				"`size-8`); a px literal here agrees today and drifts the first time " +
				"the spacing scale or the root font size moves.",
		).toBeUndefined();
		expect(
			pseudonym(),
			"the name's line box is not the avatar's box, so its glyphs sit at the " +
				"top of a 32px element instead of centred in it (A10 D-4).",
		).toContain(phone("leading-8"));
	});

	it("phone-r4::the-ROW-does-not-get-shorter-with-the-type", () => {
		// ⚠ A9 D-4 says the pseudonym is 14px and nothing else in the block moves.
		// That is only true because the name's row is FLOORED at 32px to match the
		// avatar beside it — the type steps down INSIDE a box whose height is set
		// by something else. Drop this and the identity block loses height for a
		// reason the ruling never asked for.
		expect(pseudonym()).toContain(phone("min-h-8"));
	});

	it("phone-r4::at-and-above-640px-the-name-is-UNTOUCHED", () => {
		// Both tokens are phone-scoped, so UI-OVERNIGHT rule 8 still governs the
		// desktop row it was written for.
		expect(pseudonym(), "the 1440 size").toContain("text-sm");
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// R-5 / A9 D-5 — the filter pill returns to the tabs' own box
// ─────────────────────────────────────────────────────────────────────────────

describe("MOBILE-2m · R-5 / A9 D-5 — the market filter matches the Open/Closed tab", () => {
	const pill = () =>
		classesAfter(
			code(POSITIONS),
			POSITIONS,
			'data-testid="positions-market-filter"',
		);
	const tab = () =>
		classesAfter(code(POSITIONS), POSITIONS, "aria-pressed={status === s}");

	it("phone-r5::the-44px-PAINTED-box-is-gone", () => {
		// ⛔⛔ WHAT ROUND EIGHT GOT RIGHT AND WHAT IT DID NOT WEIGH. 2l reasoned
		// about the MARGIN box — `h-11` up, `-my-2.5` back down — and that
		// arithmetic is correct. What it missed is that `variant="outline"` puts a
		// real hairline and a real fill on this control, so `h-11` renders a
		// 44px-TALL BORDERED PILL eight pixels from a 24px tab. MEASURED at the
		// floor, 360px: pill height 44 at y 322.84, Open tab height 24 at y 332.09.
		// ⚠ MATCHED AS TOKENS IN THE PILL'S OWN `className`, NEVER AS WORDS IN THE
		// FILE. `PositionsTable.tsx` names both `h-11` and `-my-2.5` four times in
		// the comment explaining their removal, so a bare-string negative here
		// would match the prose and could never fail — this repo's six-times
		// defect, one file over.
		expect(pill()).not.toContain(phone("h-11"));
		expect(pill()).not.toContain(phone("-my-2.5"));
	});

	it("phone-r5::the-two-controls-take-their-HEIGHT-from-the-same-declaration", () => {
		// ⛔ THE PARITY IS DERIVED, NEVER COPIED. A9 D-5 rules them EQUAL in
		// height, and a source scan cannot compute 24px == 24px — but it can read
		// BOTH declarations and require them to agree. The tab declares its own
		// box; the pill inherits `buttonVariants`' `xs`. A literal `h-6` typed
		// twice here is the thing that drifts.
		const xs = /\bxs:\s*"([^"]*)"/.exec(code(BUTTON))?.[1] ?? "";
		const xsHeight = xs.split(/\s+/).find((t) => /^h-/.test(t));
		const tabHeight = tab().find((t) => /^h-/.test(t));
		expect(xsHeight, "`buttonVariants` xs declares a height").toBeDefined();
		expect(tabHeight, "the tab declares a height").toBeDefined();
		expect(
			xsHeight,
			"the filter pill's size variant and the tab no longer share a box.",
		).toBe(tabHeight);
		// …and the pill must not re-declare one at phone width, which is exactly
		// what A9 D-5 undoes.
		const phoneHeight = phoneRe("h-");
		for (const token of pill()) {
			expect(
				phoneHeight.test(token),
				`the pill re-declares a phone height (\`${token}\`).`,
			).toBe(false);
		}
	});

	it("phone-r5::and-the-same-TYPE", () => {
		// ⚠ READ OFF THE TAB, NOT TYPED. The 11px is the tab's own phone token; the
		// pill takes THAT token rather than a matching literal, so the two cannot
		// disagree about one row. MEASURED before this round: 12px against 11px.
		const tabType = tab().find((t) => t.startsWith(phone("text-[")));
		expect(tabType, "the tab declares a phone type size").toBeDefined();
		expect(pill(), "the pill's phone type does not match the tab's.").toContain(
			tabType,
		);
	});

	it("phone-r5::the-44px-TARGET-returns-as-a-pseudo-element", () => {
		// ⛔⛔ A HIT REGION THAT PAINTS NOTHING AND LISTENS TO NOTHING, which is
		// only possible because `overflow-hidden` left with `h-11`. 2l rejected
		// `::after` because the overlay must escape the button's box while
		// `overflow-hidden` was here as half of the MOBILE-2h clip — and that was
		// never the load-bearing half: `max-w-full` caps the button at its
		// wrapper's resolved width, and the label span's own `truncate` carries the
		// clip.
		// ⛔⛔ 11px, NOT 10px — CORRECTED AT THE `@code-reviewer` PASS AND CONFIRMED
		// BY MEASUREMENT. This guard and the source both said "10px UP AND 10px DOWN
		// ON A 24px BOX IS 44", and the shipped region was **42px**: an absolutely
		// positioned element resolves its insets against its ancestor's PADDING box
		// (CSS 2.1 §10.1), and the button is `h-6` with a 1px hairline top and
		// bottom, so the box is 22px and 22 + 10 + 10 = 42. Measured on the live
		// build by painting the pseudo-element: `::after` computed height `42px`.
		// 22 + 11 + 11 = 44. ⚠ The guard could not have caught this — it asserts
		// the TOKEN, and jsdom performs no layout — which is exactly why the figure
		// in the comment is the part that had to be re-derived rather than trusted.
		// It stays
		// inside a filter head that is 51.99px around a 24px child.
		const tokens = pill();
		expect(
			tokens,
			"the positioning context the ::after resolves against",
		).toContain(phone("relative"));
		expect(tokens).toContain(phone("after:absolute"));
		expect(tokens).toContain(phone("after:inset-x-0"));
		expect(tokens).toContain(phone("after:-top-[11px]"));
		expect(tokens).toContain(phone("after:-bottom-[11px]"));
		// ⛔ WITHOUT `content` A PSEUDO-ELEMENT IS NOT GENERATED AT ALL, so the
		// other five tokens describe a box that never exists and the target is
		// silently back to 24px with every other assertion here still green.
		expect(tokens).toContain(phone("after:content-['']"));
	});

	it("phone-r5::the-CLIP-that-had-to-survive-the-removal-is-still-declared", () => {
		// ⛔ THE ONE THING THE `overflow-hidden` REMOVAL COULD HAVE BROKEN. At 375px
		// before MOBILE-2h the label ended mid-word — `All market` — with the caret
		// gone and no ellipsis. `max-w-full` is what caps the button at its
		// wrapper's resolved width; without it the button keeps its
		// `whitespace-nowrap` intrinsic width (301px measured at 360) and paints
		// under the Open/Closed pills.
		expect(pill()).toContain(phone("max-w-full"));
		expect(pill()).toContain(phone("min-w-0"));
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// Adversarial — the Đ 14,260 money line in an unbounded card at 360
// ─────────────────────────────────────────────────────────────────────────────

describe("MOBILE-2m — the money-line rule is out of this round's reach", () => {
	it("phone-r1::the-money-line-rule-lives-on-the-PROFILE-and-nowhere-else", () => {
		// ⛔⛔ THE ADVERSARIAL CASE, ANSWERED STRUCTURALLY RATHER THAN BY ARGUMENT.
		// "A `Đ 14,260` money line in the unbounded card at 360" describes two
		// surfaces that do not meet. `phoneMoneyLineFitsMovement` is the OPEN tab's
		// six-character threshold on `/u/[pseudonym]`'s position tiles; R-1 widens
		// the content box of `/m/[slug]`'s FEED CARD. Different route, different
		// component, no shared box.
		// ⇒ R-1 CANNOT reach it, and the reason is a containment fact rather than a
		// judgement: the rule has exactly one consumer. This row is what makes that
		// checkable — move the money line onto the debate surface and it reddens.
		// ⚠ THE THRESHOLD'S OWN BEHAVIOUR IS NOT RE-TESTED HERE.
		// `tests/unit/profile/money-line.test.ts` already pins it at the boundary
		// in both directions and names `14260` explicitly; a second copy would be
		// noise, and it would pin a MEASUREMENT that file deliberately refuses to
		// pin as a literal.
		// ⚠ WHAT THIS DOES NOT COVER: R-5 edits `PositionsTable.tsx`, which is the
		// rule's one consumer. It changes the FILTER PILL in the section HEAD —
		// not the money line's type sizes, not SELL's padding, not the tile's
		// horizontal padding and not the panel's, which are the four inputs
		// `money-line.ts` names as re-measure triggers. That is a reading of the
		// diff, not something this file asserts.
		const consumers = [
			POSITIONS,
			POST_CARD,
			PHONE_VIEW,
			FOOTER,
			ARG_PROFILE,
		].filter((file) => read(file).includes("phoneMoneyLineFitsMovement"));
		expect(
			consumers,
			"the phone money-line rule has reached a second surface. Its threshold " +
				"was measured against ONE composition (the profile tile's 278px line " +
				"at 360px) and means nothing anywhere else.",
		).toEqual([POSITIONS]);
	});
});
