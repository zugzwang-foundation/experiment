import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * MOBILE-1 · Phase A — `/m/[slug]` AT PHONE WIDTH: the one-screen band is
 * RELEASED, the two-pole arena STACKS, and neither happens above 640px.
 *
 * WHAT THIS GUARD IS FOR. The debate surface is a FIXED one-screen box —
 * `h-[calc(100dvh-60px-2px)]` with `overflow-hidden`, founder-ruled 2026-08-17
 * — holding a declared headzone band above a two-column arena, with the only
 * scrolling living inside each column. That composition is correct at 1440
 * and unusable at 375: two poles sharing 375px of width, inside a box that may
 * not grow, whose overflow is HIDDEN. A fixed height does not make content fit,
 * it CLIPS it, and clipping to hit a number is a failure rather than a pass
 * (`debate-height-chain.test.ts:72-78`, the same ruling one viewport down).
 *
 * ⇒ So below 640px these declarations are released, all as APPENDED
 * `max-mobile:*` tokens, never as replacements:
 *
 *   PageContainer   max-mobile:h-auto  max-mobile:overflow-visible
 *                   ← the page may grow and scroll again, as every OTHER
 *                     `(public)` surface always could
 *   headzone band   max-mobile:basis-auto  max-mobile:overflow-visible
 *                   ← the band is its content's height, not 24.2% of a phone
 *                     viewport, and stops clipping what it holds
 *   arena band      max-mobile:flex-col
 *                   ← the two poles stack instead of splitting 375px
 *
 * ⚠⚠ THIS LIST IS THE THREE DECLARATIONS **THIS FILE CHECKS**, NOT THE
 * DECLARATIONS THAT SHIPPED ON THIS SURFACE — and it read as the latter until
 * the PR #486 remediation pass, which is the same defect this suite's own
 * `⛔ THE ONE-SCREEN RULING IS NOT REVERSED` paragraph is careful to avoid:
 * a docblock stating a completeness property the assertions below do not have.
 * **Five more `max-mobile:` declarations shipped on `/m/[slug]` in the same
 * commit**, and nothing here opens their files:
 *
 *   MarketHeader.tsx:290       max-mobile:flex-col     ← UNCHECKED HERE
 *   MarketMediaPanel.tsx:128   max-mobile:w-full       ← UNCHECKED HERE
 *   ArgProfile.tsx:225,375     max-mobile:shrink
 *                              max-mobile:flex-wrap    ← UNCHECKED HERE
 *
 * ⛔ `MarketHeader` and `MarketMediaPanel` are ONE MECHANISM — both files'
 * comments say so — and they are NOT pinned together the way
 * `discovery-mobile::hero-and-rail-hide-TOGETHER-never-one-alone` correctly
 * pins its pair, so either can be removed alone and stay green. ⚠ And
 * `MarketHeader`'s token is "guarded" only by coincidence: `DebateView.tsx`
 * carries the same string, so a scan for the STRING finds it while no test
 * opens the FILE.
 *
 * ⇒ Adding those assertions is DEFERRED with a written entry in
 * `docs/parked.md` (PR #486, Block D). What is fixed here is only the claim:
 * the enumeration above no longer reads as the surface's full inventory.
 *
 * ⚠⚠ MOBILE-1 · JOB A (ADR-0048 item 3) ADDS A FOURTH DECLARATION AND DEEPENS
 * THAT BACKLOG RATHER THAN DISCHARGING IT (plan OI-6). Read this before
 * reading the new describe block at the foot of the file as coverage.
 *
 *   PostFocusHeader.tsx  `.hleft`  max-mobile:flex-col   ← CHECKED HERE, and
 *                                                          checked BY FILE
 *
 * ⛔ WHAT IS AND IS NOT DISCHARGED, precisely, because the two are easy to
 * conflate. `PostFocusHeader.tsx` itself is now pinned properly: the guard
 * below opens THAT FILE by name, so its token cannot be deleted and stay green
 * on the strength of a string that lives somewhere else. That is the shape
 * `MarketHeader.tsx:290` lacks and it is not extended to it.
 *
 * ⛔ WHAT DEEPENS. `max-mobile:flex-col` is authored at THREE sites in `src/`
 * today — `DebateView.tsx:1040`, `:1235` and `MarketHeader.tsx:290` — across
 * TWO files; ADR-0048 item 3 makes `PostFocusHeader.tsx`'s `.hleft` row the
 * fourth site and the THIRD file. ⚠ Fenced by SYMBOL, not by line (O-8): the
 * row's line number moved in the very commit that added the token, which is
 * the failure a line citation always has. Measured, not read off the plan:
 *
 *   git grep -n 'max-mobile:flex-col' -- 'src/*'
 *
 * Every one of those sites carries the SAME base string,
 * `flex min-h-0 flex-1 gap-4`, so a census that greps the token gets less
 * informative with each addition, not more: `MarketHeader.tsx:290` stays
 * "guarded by coincidence" and now has one more file to hide behind. ⛔ Fixing
 * that is RULED OUT of this job (plan OQ-5 — "the trigger authorises it" is how
 * a two-item job becomes three). The parked row is updated to record the
 * deepening; it is not closed.
 *
 * ✅ AND ONE MORE COULD HAVE LANDED ON THE SAME SHAPE, AND DID NOT. Had R1 put
 * `max-mobile:w-full` on this header's image arms, that token would have
 * acquired a second authoring site beside `MarketMediaPanel.tsx:128`'s
 * unguarded one — the same string-vs-file trap one token over. R1 ran on
 * 2026-09-07 and came back clean, so no arm token shipped and `max-mobile:
 * w-full` still has exactly one site. Recorded because it is the one way this
 * backlog could have grown further and the reason it did not is a measurement,
 * not a preference.
 *
 * ⛔ THE ONE-SCREEN RULING IS NOT REVERSED — IT IS SCOPED. Every unprefixed
 * token above stays exactly where it is, so 1440px renders byte-identically and
 * `debate-height-chain.test.ts` keeps passing unchanged. This file asserts the
 * SAME desktop tokens that suite already pins, from the other side: there it
 * proves the chain is wired, here it proves MOBILE-1's own diff did not spend
 * any of it. That redundancy is deliberate and is not duplication to remove —
 * the two files fail for different reasons and a reader hitting either one is
 * sent somewhere useful.
 *
 * ⚠ WHY A SOURCE SCAN AND NOT A RENDER TEST. jsdom performs no layout: no media
 * query, no `calc()`, no `dvh`, no flex, no Tailwind utility. A render test
 * structurally cannot see "stacks below 640px" or "unchanged at 1440px", and
 * horizontal overflow is measurable only in a real browser.
 *
 * ⚠ V-REGISTER DISCIPLINE. This reads the SHIPPED FILES.
 */

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

const VIEW = "src/components/debate/DebateView.tsx";
const HEADZONE = "src/components/debate/HeadZone.tsx";
/** ADR-0048 item 3 — the focus-mode header, `/m/[slug]?post=N`. */
const FOCUS = "src/components/debate/PostFocusHeader.tsx";

/**
 * Source with `/* *\/` and `//` comments removed.
 *
 * ⛔ LOAD-BEARING, NOT TIDINESS — verbatim in shape from
 * `tests/unit/shell/global-header-mobile-reflow.test.ts`, for the same reason
 * it exists there. `PostFocusHeader.tsx` documents its layout decisions in
 * prose beside the classes that implement them, quoting the mockup's own CSS
 * (`flex:1 1 auto;min-width:0;display:flex;gap:16px`) inline. A scan that
 * cannot tell a rationale from a class either reddens on documentation or —
 * worse for `soleClassNameWith` below — throws a uniqueness error the first
 * time somebody writes a className into a comment, which is how a guard gets
 * deleted rather than fixed.
 *
 * ⚠ IT MAKES TWO ASSUMPTIONS, NOT ONE, AND THIS COMMENT NAMED ONLY THE FIRST.
 *   1. No `//` inside a string literal in the scanned file — a URL or a
 *      protocol-relative path would truncate the rest of that line.
 *   2. No block-comment OPENER inside a `//` line comment. Block-stripping runs
 *      FIRST, so a stray opener would swallow everything up to the next block
 *      CLOSER — potentially hundreds of lines and several classNames away.
 * Both hold in `PostFocusHeader.tsx` today (`aspect-[16/9]` carries a single
 * slash; there are no URLs and no nested comment openers), and both fail LOUDLY
 * rather than silently: the uniqueness throw below fires when the surviving
 * className set changes shape. ⚠ The second assumption is the nastier one — it
 * can delete a className the scan was supposed to see, and a scan that finds
 * ONE match either way looks exactly the same as a correct one.
 */
function stripComments(source: string): string {
	return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

/**
 * The class list of the ONE literal `className="…"` in `source` carrying
 * `token` as a whole class token. Throws — loudly, with a re-derive
 * instruction — on zero matches or on more than one.
 *
 * ⛔ FENCED BY SYMBOL, NEVER BY DISTANCE (O-8). The element this locates is
 * `.hleft`, the focus-mode header's image-plus-text row, and it is located by
 * something it IS rather than by where it sits: no line number, no character
 * offset, no `slice(at, at + N)` — O-8's corollary being that a character
 * window is a line number wearing a different unit, and prose is what moves.
 * This file's neighbour reads its nodes by `data-testid`; `.hleft` carries
 * none and ⛔ MUST NOT GAIN ONE — that would be a `src/` edit made to suit a
 * test, on a component this job is otherwise adding one class token to.
 *
 * ⚠ AND THE ANCHOR MUST BE UNIQUE TO ITS ELEMENT, WHICH IS THE HALF THAT GETS
 * SKIPPED. `flex min-h-0 flex-1 gap-4` is the obvious anchor and it is the
 * WRONG one to trust silently: that exact string is authored at three further
 * sites in `src/` (`DebateView.tsx:1040`, `:1235`, `MarketHeader.tsx:290`), so
 * it is characteristic of this shape rather than unique to this node — it is
 * only unique here because this scan is bounded to ONE FILE. `gap-4` is the
 * discriminating token WITHIN that file (every other gap here is `gap-3`), and
 * uniqueness is CHECKED at run time rather than asserted in this comment: if a
 * second node ever carries it, this throws instead of quietly measuring the
 * wrong element.
 *
 * ⚠ It survives the diff it guards. Appending a token to the row's className
 * grows the list; it does not move the anchor.
 */
function soleClassNameWith(
	rawSource: string,
	file: string,
	token: string,
): string[] {
	const source = stripComments(rawSource);
	const matches = [...source.matchAll(/className="([^"]*)"/g)]
		.map((m) => (m[1] ?? "").split(/\s+/).filter(Boolean))
		.filter((classes) => classes.includes(token));
	if (matches.length === 0) {
		throw new Error(
			`${file}: no literal className carries the class token "${token}". ` +
				`ADR-0048 item 3 keys the focus-mode row's phone-width override off ` +
				`this node; if the header was restructured, re-derive this guard ` +
				`rather than deleting it.`,
		);
	}
	if (matches.length > 1) {
		throw new Error(
			`${file}: ${matches.length} literal classNames carry the class token ` +
				`"${token}", so it no longer identifies one node and this guard may ` +
				`be measuring the wrong element. Re-derive the anchor on something ` +
				`unique rather than loosening the assertions.`,
		);
	}
	return matches[0];
}

/**
 * Every literal className carried by a node bearing `data-testid="<testid>"`, in
 * source order. Returns one entry per occurrence — the arena band is authored
 * TWICE (once per arm of the market↔post ternary) and both must be wired, so a
 * first-match helper would prove half the surface and pass.
 *
 * ⚠ VERBATIM FROM `debate-height-chain.test.ts:108-121`, deliberately: two
 * files reading the same nodes must read them the same way or they can disagree
 * about what is on disk. Both nodes this file reads (`arena`, `headzone`) carry
 * the className IMMEDIATELY after the testid, so the adjacent form is the right
 * one here; if a comment is ever inserted between them this throws with the
 * message below rather than passing on an empty match.
 */
function bandClasses(source: string, file: string, testid: string): string[][] {
	const re = new RegExp(`"${testid}"\\s+className="([^"]*)"`, "g");
	const found = [...source.matchAll(re)].map((m) =>
		(m[1] ?? "").split(/\s+/).filter(Boolean),
	);
	if (found.length === 0) {
		throw new Error(
			`${file}: no node with data-testid="${testid}" and a literal className. ` +
				`MOBILE-1's phone-width overrides key off this testid; if the frame ` +
				`was restructured, re-derive this guard rather than deleting it.`,
		);
	}
	return found;
}

describe("debate mobile reflow — the one-screen container releases below 640px", () => {
	it("debate-mobile::the-container-keeps-its-one-screen-band-and-releases-it-below-640", () => {
		const source = read(VIEW);

		// No `s` flag — tsconfig targets ES2017 (TS1501), and `[^>]*` already
		// spans newlines. Verbatim from `debate-height-chain.test.ts:155` and
		// `page-container.test.ts`, deliberately: files reading the same tag must
		// read it the same way or they can disagree about what is on disk.
		const tag = /<PageContainer\b[^>]*>/.exec(source);
		if (!tag) {
			throw new Error(`${VIEW}: no PageContainer tag found.`);
		}
		const extras = /className="([^"]*)"/.exec(tag[0])?.[1] ?? "";
		const classes = extras.split(/\s+/).filter(Boolean);

		// ⛔ THE DESKTOP HALF, PINNED BY NAME — the exact five tokens
		// `debate-height-chain.test.ts` already requires. A second, independent
		// proof of the same fact from the file that owns MOBILE-1's diff: if this
		// task's own change had rewritten the height chain instead of appending to
		// it, this is where a reader would look first.
		expect(classes).toContain("h-[calc(100dvh-60px-2px)]");
		expect(classes).toContain("min-h-0");
		expect(classes).toContain("overflow-hidden");
		expect(classes).toContain("flex");
		expect(classes).toContain("flex-col");

		// ⚠ THE MOBILE HALF. `h-auto` releases the declared screen so the page can
		// grow, and `overflow-visible` releases the clip — SEPARATELY, because
		// either alone is worse than neither: a released height with the clip still
		// on is the same box; a released clip with the height still declared spills
		// content out of a box that stopped containing it.
		expect(
			classes,
			`${VIEW}: the debate container never releases its one-screen height ` +
				`below 640px. At 375px the whole surface is locked to ` +
				`\`h-[calc(100dvh-60px-2px)]\` with \`overflow-hidden\`, so anything ` +
				`that does not fit is clipped out of existence rather than scrolled.`,
		).toContain("max-mobile:h-auto");
		expect(
			classes,
			`${VIEW}: the debate container keeps \`overflow-hidden\` at phone ` +
				`width. Releasing the height without releasing the clip leaves the ` +
				`same box under a different name.`,
		).toContain("max-mobile:overflow-visible");
	});
});

describe("debate mobile reflow — the arena stacks below 640px, in BOTH arms", () => {
	it("debate-mobile::BOTH-arms-stack-the-arena-identically-and-keep-the-desktop-row", () => {
		const arenas = bandClasses(read(VIEW), VIEW, "arena");

		// One per arm of the market↔post ternary. If a later change collapses the
		// ternary this count moves and the guard should be re-derived, not
		// loosened.
		expect(arenas).toHaveLength(2);

		for (const classes of arenas) {
			// ⛔ THE DESKTOP HALF. `.arena{flex:1 1 auto;min-height:0}` — takes
			// everything the headzone band left and may shrink below its content.
			// `gap-4` is the gutter between the two poles. All four unchanged.
			expect(classes).toContain("flex");
			expect(classes).toContain("min-h-0");
			expect(classes).toContain("flex-1");
			expect(classes).toContain("gap-4");

			// ⚠ THE MOBILE HALF. Two pole columns splitting 375px is ~180px each
			// before the gutter — narrower than a single card's own content — so
			// the row becomes a stack. ⛔ `flex-col` is APPENDED, not swapped for
			// the base `flex`: the node stays a flex container at every width and
			// only its axis changes.
			expect(
				classes,
				`${VIEW}: an \`arena\` band never stacks below 640px. Both YES and NO ` +
					`pole columns stay side by side at 375px, ~180px each before the ` +
					`gutter.`,
			).toContain("max-mobile:flex-col");
		}

		// ⛔ BOTH ARMS IDENTICAL — the failure this catches is wiring the market
		// arm and leaving the post arm on the old `flex min-h-0 flex-1 gap-4`,
		// which nothing else on the surface would reveal: a reader only reaches
		// the post arm by opening a post. Same equality check as
		// `debate-height-chain.test.ts:328-329`.
		expect(new Set(arenas[0]).size).toBe(new Set(arenas[1]).size);
		expect([...arenas[0]].sort()).toEqual([...arenas[1]].sort());
	});
});

describe("debate mobile reflow — the headzone band stops being a viewport fraction", () => {
	it("debate-mobile::headzone-keeps-its-24.2dvh-band-and-releases-it-below-640", () => {
		const source = read(HEADZONE);

		// ⚠⚠ RE-DERIVED AT THE REBASE ONTO `main`, NOT WEAKENED — this guard's
		// own throw message asked for exactly that. Upstream (HTML-FINISH ·
		// MARKET DETAIL) split this band into two NAMED CONSTANTS selected by the
		// `fit` prop, so the node now reads
		// `className={fit ? BAND_CONTENT_SIZED : BAND_DECLARED}` and carries no
		// literal for `bandClasses` to find. The tokens did not leave the surface;
		// they moved into the constant, so the guard follows them there.
		//
		// ⛔ TWO CLAIMS, because either alone is satisfiable by a broken tree.
		// The constant alone would pass while nothing rendered it; the wiring
		// alone would pass while the constant had lost the mobile half.
		const wiring =
			/"headzone"\s+className=\{fit \? BAND_CONTENT_SIZED : BAND_DECLARED\}/;
		expect(
			wiring.test(source),
			`${HEADZONE}: the headzone node no longer selects between ` +
				`BAND_CONTENT_SIZED and BAND_DECLARED. MOBILE-1's phone-width ` +
				`overrides live on BAND_DECLARED; if the frame was restructured ` +
				`again, re-derive this guard rather than deleting it.`,
		).toBe(true);

		// ⚠ `BAND_DECLARED`, NOT `BAND_CONTENT_SIZED`, and the choice is load-
		// bearing. Only the market arm's band declares `basis-[24.2dvh]` and
		// `overflow-hidden`; the post arm declares neither, so releasing them
		// there would be inert noise. The mobile half is asserted against the one
		// constant it can actually mean anything against.
		const declared = /const BAND_DECLARED =\s*"([^"]*)"/.exec(source);
		if (!declared) {
			throw new Error(
				`${HEADZONE}: BAND_DECLARED is not a single string literal any ` +
					`more. MOBILE-1's phone-width overrides live on it; re-derive ` +
					`this guard rather than deleting it.`,
			);
		}
		// ONE authoring site, as before — the constant is declared exactly once.
		expect(source.match(/const BAND_DECLARED =/g)).toHaveLength(1);
		const classes = (declared[1] ?? "").split(/\s+/).filter(Boolean);

		// ⛔ THE DESKTOP/TABLET HALF, PINNED BY NAME. `shrink-0 basis-[24.2dvh]`
		// is d5's `.headzone{flex:0 0 188px}` expressed as the viewport fraction
		// that literal actually encodes; `overflow-hidden` is UI-QUICK change set
		// 4 §C's containment; `lg:flex-row` is the ≥1024px two-column frame.
		// ⚠ `lg:flex-row` IS ASSERTED AND THE OTHER `lg:*` TOKENS IN THIS FILE ARE
		// NOT. They live on the rail and its spacer, are none of MOBILE-1's
		// business, and are deliberately left alone — the tablet band between 640
		// and 1024 is unchanged by this task.
		expect(classes).toContain("flex");
		expect(classes).toContain("min-h-0");
		expect(classes).toContain("shrink-0");
		expect(classes).toContain("basis-[24.2dvh]");
		expect(classes).toContain("flex-col");
		expect(classes).toContain("gap-5");
		expect(classes).toContain("overflow-hidden");
		expect(classes).toContain("lg:flex-row");

		// ⚠ THE MOBILE HALF, AND THE TWO TOKENS ARE ONE MECHANISM. `basis-auto`
		// makes the band its CONTENT's height instead of 24.2% of a phone
		// viewport — 24.2% of 844px is 204px for a question, a stat line, a price
		// bar and a four-block resolver row. `overflow-visible` is what stops the
		// remainder being clipped: the band's own docblock already records that
		// below ~715px of viewport height the fraction is smaller than the content
		// and the excess is CUT. A phone is permanently in that regime.
		expect(
			classes,
			`${HEADZONE}: the headzone band never releases \`basis-[24.2dvh]\` ` +
				`below 640px, so at phone width it is a fixed fraction of a short ` +
				`viewport holding content that does not fit.`,
		).toContain("max-mobile:basis-auto");
		expect(
			classes,
			`${HEADZONE}: the headzone band keeps \`overflow-hidden\` at phone ` +
				`width. Releasing the basis without releasing the clip leaves the ` +
				`overflow cut at whatever height the content resolves to.`,
		).toContain("max-mobile:overflow-visible");
	});
});

/**
 * MOBILE-1 · JOB A — ADR-0048 ITEM 3: THE FOCUS-MODE ROW BECOMES A COLUMN.
 *
 * ⛔ WHY THIS ROW WAS MISSED AT PHASE A, WHICH IS THE INTERESTING PART.
 * `/m/[slug]?post=N` renders the SAME shape as the three rows Phase A did fix
 * — `flex min-h-0 flex-1 gap-4`, an image arm beside a text stack — and it
 * carried no breakpoint variant at all. It was not caught because the check
 * that cleared `/m/[slug]` was a document-level `scrollWidth` read, and this
 * row sits inside a `<Card>`, whose base carries `overflow-hidden`
 * (`ui/card.tsx`). The card CLIPS INTERNALLY, so document overflow stays
 * EXACTLY 0px while content is destroyed: a true measurement of the wrong box.
 * ADR-0048 re-measured against the clipping ancestor and found eight
 * descendants with `scrollWidth > clientWidth` and two escaping the card
 * outright — a `Counter` button cut 24px, an `Exited` badge cut 33px.
 *
 * ⛔ AND IT DEGRADES IN THE WRONG DIRECTION, which is why the fix is an AXIS
 * change and not a `min-w-0`. Both image arms are `shrink-0`, so the whole
 * deficit lands on the text stack; the placeholder arm's width derives from the
 * ROW'S HEIGHT (`self-stretch` + `aspect-[16/9]`), and in focus mode the band
 * is 473px tall — so it demands ~147px of a 285px row REGARDLESS of viewport
 * width. Narrowing the phone makes it proportionally worse. The text stack is
 * not at fault: it already carries `min-w-0`, shrinks correctly to 122px, and
 * `ArgProfile` already carries Phase A's own overrides.
 *
 * ⚠ WHAT THIS GUARD CANNOT SEE, STATED BECAUSE IT IS EVERYTHING ABOVE. jsdom
 * performs no layout — no media query, no flex, no `aspect-ratio`, no Tailwind
 * utility — so not one number in the two paragraphs above is observable from
 * here. This is a SOURCE SCAN: it proves the token is authored on the right
 * node in the right file, and nothing whatever about whether the row then fits
 * 375px. That is the plan's R1 browser measurement's job and only its job.
 */
describe("debate mobile reflow — the focus-mode row stacks below 640px", () => {
	it("debate-mobile::the-focus-mode-row-stacks-below-640-and-keeps-the-desktop-row", () => {
		// ⛔ SCOPE, RULED: `PostFocusHeader.tsx` ONLY (plan OQ-5). `MarketHeader.tsx`
		// carries the same token and the same base string and is NOT opened here —
		// "the trigger authorises it" is how a two-item job becomes three. Its
		// string-vs-file coincidence is recorded in this file's head docblock and in
		// `docs/parked.md` Block D, and stays open.
		const classes = soleClassNameWith(read(FOCUS), FOCUS, "gap-4");

		// ⛔ THE DESKTOP HALF, PINNED BY NAME. `.hleft` is `flex:1 1 auto;
		// min-width:0;display:flex;gap:16px` in the mockup — a ROW that takes what
		// the card gives it and may shrink below its content. All four tokens are
		// unprefixed and therefore inert at ≥640px, which is what makes "zero
		// desktop regression" structural rather than something to re-measure: this
		// job appends one variant token and removes none of these.
		//
		// ⚠ `gap-4` IS THE ANCHOR, so asserting it is tautological — stated anyway,
		// exactly as the register-divider guard in the shell suite states its own
		// anchor, so that a future refactor which keeps the anchor while reordering
		// or dropping the others still reads as intended here. The other three are
		// live assertions: any of them can be removed without moving the anchor.
		expect(classes).toContain("flex");
		expect(classes).toContain("min-h-0");
		expect(classes).toContain("flex-1");
		expect(classes).toContain("gap-4");

		// ⚠ THE MOBILE HALF. APPENDED, never swapped for the base `flex`: the node
		// stays a flex container at every width and only its axis changes below
		// 640px — override-never-replace (ADR-0045's surviving convention,
		// AGENTS.md §8). Identical token, identical shape, to `DebateView.tsx`'s two
		// arena bands and `MarketHeader.tsx:290`.
		expect(
			classes,
			`${FOCUS}: the focus-mode \`.hleft\` row never stacks below 640px. It ` +
				`is a row at EVERY width and carries no breakpoint variant at all, ` +
				`which is the defect ADR-0048 item 3 scopes: the image arm demands ` +
				`~147px of a 285px row from the row's own HEIGHT, both arms are ` +
				`\`shrink-0\`, and the entire deficit lands on the argument text. ` +
				`\`<Card>\`'s \`overflow-hidden\` then clips it INSIDE the card, so a ` +
				`document-level overflow check reports 0px while the argument, the ` +
				`Counter button and the Exited badge are cut off. Append ` +
				`\`max-mobile:flex-col\` — do not replace the base \`flex\`.`,
		).toContain("max-mobile:flex-col");

		// ⛔⛔ THE IMAGE ARMS — THE SLOT IS EMPTY BECAUSE THE MEASUREMENT SAID SO,
		// NOT BECAUSE IT IS PENDING. Read this before adding anything here.
		//
		// The two arms inside this row — the real-image arm wrapping
		// `CommentImage`, and the `aspect-[16/9] w-auto shrink-0 self-stretch`
		// placeholder arm — MAY have received `max-mobile:w-full`. The decision was
		// never this test's to make: the plan's §4 bounded it to exactly two
		// outcomes, both settled by ONE browser measurement (R1):
		//
		//   R1 finds zero overflowing / escaping descendants
		//       ⇒ `max-mobile:flex-col` alone ships. NO arm token. Ship the minimum.
		//   R1 finds overflow persisting
		//       ⇒ `max-mobile:w-full` on the placeholder arm, and the real-image arm
		//         receives whatever the placeholder arm receives, by symmetry.
		//
		// ✅ R1 RAN — 2026-09-07, production build after `just clean`, served
		// against the staging database, measured in a 375px in-page frame. THE
		// FIRST OUTCOME: zero overflowing and zero escaping descendants inside the
		// `[data-slot="card"]` clipping ancestor, on BOTH worst-available posts
		// (`/m/sp-m12-fill?post=1` — longest title, carries the Exited badge;
		// `/m/sp-m16-fill?post=1` — carries the Counter button; those two badges
		// are ADR-0048's two escaping elements and no single staging post has
		// both). Before, on the same rig: 9 overflowing / 5 escaping and 9
		// overflowing / 2 escaping respectively.
		//
		// ⇒ `max-mobile:flex-col` SHIPPED ALONE. NO ARM TOKEN, ON EITHER ARM. So
		// there is nothing to assert here, and the absence is the recorded result
		// of the rule rather than an unfinished slot.
		//
		// ⚠ WHY THE PLACEHOLDER ARM NEEDED NOTHING, measured rather than argued:
		// in column mode the cross axis is horizontal, `self-stretch` + `w-auto`
		// let the box fill the column, and `aspect-[16/9]` then derives the height
		// from that width. It measured 285px wide — the full row — against 147.2px
		// in row mode, with the text stack going 121.8px → 285px. `max-mobile:
		// w-full` would have been a no-op on a box already filling its column.
		//
		// ⛔ DO NOT ADD AN ARM ASSERTION "FOR SYMMETRY" WITH `MarketMediaPanel.
		// tsx:128`. That file's arm is `w-1/3`, which genuinely does not stretch;
		// this one is `w-auto self-stretch`, which does. The two look alike and
		// resolve differently, and pinning a token here that the tree does not
		// carry would redden this guard against a correct implementation.
		//
		// ⚠ THE ARM TOKEN IS `w-full`, NOT `shrink` — a divergence from ADR-0048's
		// letter (`:63` prescribes releasing `shrink-0`), founder-ruled on this
		// plan's reasoning. Two arguments: once the row is a column, `shrink-0`
		// becomes main-axis-VERTICAL and nothing above imposes a definite height
		// below 640px, so releasing it is plausibly inert; and `max-mobile:w-full`
		// ALREADY EXISTS in the built stylesheet via `MarketMediaPanel.tsx:128`,
		// where Phase A answered this identical shape the same way, while
		// `max-mobile:shrink` would be a NEW utility exposed to the stale-compiled-
		// stylesheet trap (AGENTS.md §9) — the one failure mode that reproduces the
		// exact before-state and reads as "my fix does not work".
		//
		// ⚠ AND THE REAL-IMAGE ARM SHIPS UNMEASURED — construction argument, not
		// measured, in those words (plan OQ-4a, OI-4). No staging post carries an
		// attachment, so no rig can render that arm today. R1 cleared the
		// PLACEHOLDER arm, and the real-image arm inherits that result rather than
		// being observed: `CommentImage` renders `block w-fit` around an image
		// carrying `max-w-full`, and `fit-content` clamps to the AVAILABLE width,
		// which in a stretched column is the column — so the pair that fails to
		// bound the image in ROW mode should bound it here. ⛔ That reasoning has
		// never been observed on this surface in either direction and is NOT a
		// verification. It fails safe in exactly one direction, which is the one
		// taken: the arm ships BARE, which is the smaller claim.
		//
		// ⇒ OI-4 STAYS OPEN. It closes when a staging post carries a real image
		// attachment and R1 is re-run against `/m/<slug>?post=N` for that post.
	});
});
