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
