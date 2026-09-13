import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * MOBILE-2j · ADR-0051 **A6 D-1** — `/u/[pseudonym]`'s positions are full-width
 * tiles of NATURAL height in the page's ordinary scroll below 640px.
 *
 * ⛔⛔ **A6 SUPERSEDES A5 D-1 AND THIS FILE IS WHERE THAT LANDS.** MOBILE-2h made
 * the tile one visual viewport tall and snapped it; the founder walked that build
 * and rejected it. So the rows that asserted the height, the snap alignment, the
 * scroll margin, the distributed gap and the document's snap type are not deleted
 * — they are **INVERTED**. A deleted guard lets the shape come back in silence; a
 * guard that now forbids what it used to require reddens on exactly the revert,
 * which is the only way a withdrawal can be made to hold.
 *
 * WHAT THIS FILE IS FOR, and why it is a separate file from
 * `phone-round-five.test.ts`. That file is MOBILE-2e's contract and some of its
 * rows were superseded at MOBILE-2h; leaving this round's guards inside it would
 * make one file assert a shape and its replacement. Round five keeps the parts of
 * its ruling that survive; this file owns the tile.
 *
 * ⛔⛔ THE PREFIX IS ASSEMBLED AT RUNTIME AND NEVER WRITTEN AS A LITERAL.
 * Tailwind v4's source detection scans `tests/` as well as `src/`, so a
 * class-shaped string in a guard becomes a REAL EMITTED UTILITY — which means a
 * guard that asserts a component uses a class can EMIT that class itself, and a
 * check that greps the built sheet to prove it compiled is self-fulfilling
 * (AGENTS.md §8, measured: `opacity-0` is present in the built sheet, in
 * `tests/`, and in no `src/` file). Every utility below is built from `V` and
 * `S`, so this file carries no scannable token.
 *
 * ⚠ THESE ARE SOURCE SCANS. jsdom performs no layout, so nothing here can see a
 * tile's height, a snap landing or an overflow. Those are measured in a real
 * browser and reported with the run; what a scan CAN hold is that the tokens
 * which produce them are still on the elements that need them.
 */

const ROOT = process.cwd();
const V = "max-mobile";
const S = ":";
/** `max-mobile:<utility>`, assembled so this file emits nothing. */
const phone = (utility: string) => `${V}${S}${utility}`;
/**
 * ⛔⛔ AND THE SNAP FAMILY IS ASSEMBLED TOO, WHICH IT WAS NOT — this file's own
 * header promised "no scannable token" and then wrote `snap​-y`, `snap​-proximity`,
 * `snap​-center` and `snap​-end` as bare literals in two forbid-lists. MEASURED in
 * `.next/static/chunks/*.css`: all four were present in the BUILT STYLESHEET, and
 * `grep -rIl` found them in no `src/` file — their only origin was this file. The
 * round had published the withdrawn mechanism's utilities into production CSS, by
 * means of the guards that exist to keep it withdrawn. `@code-reviewer`, MEDIUM.
 * ⚠ The CSS was inert. The cost is the one AGENTS.md §8 names: the built sheet
 * stops being evidence of what components use.
 */
const SNAP = "snap";
const snap = (kind: string) => `${SNAP}${S === ":" ? "-" : "-"}${kind}`;

const TABLE = "src/components/profile/PositionsTable.tsx";
const SHEET = "src/components/profile/phone/PhoneSellSheet.tsx";
const INLINE = "src/components/profile/InlineSell.tsx";
const ROOT_LAYOUT = "src/app/layout.tsx";
const FEED_TRACK = "src/components/debate/phone/PhoneFeedTrack.tsx";

const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

/**
 * Comments out, line count preserved, so a reported line number still points at
 * the source. ⚠ IT MATTERS MORE HERE THAN USUAL: this file's own prose names
 * every token it forbids, and a scan that could not tell a mention from a use
 * would fire on the paragraph explaining the absence — six recorded instances of
 * that shape in this repository already.
 */
function stripComments(source: string): string {
	return source
		.replace(/\/\*[\s\S]*?\*\//g, (m) => "\n".repeat(m.split("\n").length - 1))
		.replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

/**
 * The opening tag that STARTS at `openAt`, ended at the first `>` that is
 * outside every brace and every quoted string.
 *
 * ⛔⛔ A SYMBOL FENCE, NOT A DISTANCE ONE, AND THE FIRST DRAFT OF THIS FILE USED
 * A DISTANCE. It read the className out of a 900-character window and passed —
 * which is exactly the shape (O-8) that reddened `profile-height-chain` earlier
 * in this same round, when a comment written between a `data-testid` and its
 * className overran that guard's own 400-character window. A window is a bet
 * about how much prose a future editor will write; the tag's end is a fact about
 * the tag. ⚠ The quote tracking is not decoration either: an arbitrary variant
 * containing a closing angle (a child combinator, say) puts that character
 * inside a `className` string, and a scanner that stops at the first one
 * truncates the tag mid-attribute and reports the element as declaring no class
 * at all — measured, on this very file's side cell.
 */
function openingTagFrom(source: string, openAt: number, what: string): string {
	let depth = 0;
	let quote: string | null = null;
	for (let i = openAt + 1; i < source.length; i += 1) {
		const c = source[i];
		if (quote !== null) {
			if (c === quote) quote = null;
			continue;
		}
		if (c === '"' || c === "'" || c === "`") quote = c;
		else if (c === "{") depth += 1;
		else if (c === "}") depth -= 1;
		else if (c === ">" && depth === 0) return source.slice(openAt, i + 1);
	}
	throw new Error(`${what}: the opening tag at ${openAt} never closes.`);
}

/** The class tokens declared by the element whose opening tag contains `anchor`. */
function classesAfter(source: string, anchor: string, what: string): string[] {
	const at = source.indexOf(anchor);
	expect(at, `${what}: anchor ${anchor} not found`).toBeGreaterThan(-1);
	const openAt = source.lastIndexOf("<", at);
	// ⛔⛔ NO DISTANCE FALLBACK. An earlier form of this reader fell back to "the
	// first className within 600 characters" for anchors that are not tags — and a
	// 600-character window is the same bet about future prose the O-8 note above is
	// about, sitting inside the file that makes it. It had exactly one user and 77
	// characters of headroom. An anchor that is not itself a tag now reads the
	// element that FOLLOWS it, so every path here is a symbol fence.
	// `@code-reviewer`, MEDIUM.
	const tagOpen =
		openAt >= 0 && /[A-Za-z]/.test(source[openAt + 1] ?? "")
			? openAt
			: source.indexOf("<", at);
	expect(
		tagOpen,
		`${what}: ${anchor} is not followed by an element, so there is no opening ` +
			`tag to read a className out of. Re-derive this anchor.`,
	).toBeGreaterThan(-1);
	const tag = openingTagFrom(source, tagOpen, what);
	const m = /className=(?:"([^"]*)"|\{`([^`]*)`)/.exec(tag);
	const cls = m?.[1] ?? m?.[2];
	expect(
		cls,
		`${what}: no className on the element carrying ${anchor}`,
	).toBeDefined();
	return (cls ?? "").split(/\s+/).filter(Boolean);
}

/** The tile `<tr>`'s static class template. */
function tileRowClasses(source: string): string[] {
	const m =
		/data-testid={`position-tile-\$\{tile\.key}`}[\s\S]*?className={`([^`]*)`/.exec(
			source,
		);
	expect(
		m?.[1],
		`${TABLE}: the tile row's class template is unreadable`,
	).toBeDefined();
	return (m?.[1] ?? "").split(/\s+/).filter(Boolean);
}

/**
 * The `<td>` that WRAPS the element carrying `anchor`.
 *
 * ⚠ THE WINDOW IS THE `<td>`'s OWN OPENING TAG, in both directions. Two of the
 * four cells carry their own `data-testid` — the Closed tab's Staked and Opened —
 * so their className sits AFTER the anchor rather than before it, and a reader
 * that stopped at the anchor found nothing and reported the cell as declaring no
 * className at all. Both shapes are real and the reader has to admit both.
 */
function cellClassesWrapping(source: string, anchor: string): string[] {
	const at = source.indexOf(anchor);
	expect(at, `${TABLE}: ${anchor} not found`).toBeGreaterThan(-1);
	const tdAt = source.lastIndexOf("<td", at);
	expect(tdAt, `${TABLE}: ${anchor} is not inside a <td>`).toBeGreaterThan(-1);
	const tag = openingTagFrom(
		source,
		tdAt,
		`${TABLE}: the <td> wrapping ${anchor}`,
	);
	const m = /className="([^"]*)"/.exec(tag);
	expect(
		m?.[1],
		`${TABLE}: the <td> wrapping ${anchor} declares no className`,
	).toBeDefined();
	return (m?.[1] ?? "").split(/\s+/).filter(Boolean);
}

// ── 0 · the guards fire at all ───────────────────────────────────────────────

describe("MOBILE-2j — positive controls first", () => {
	it("tile::the-readers-find-something", () => {
		const source = stripComments(read(TABLE));
		expect(tileRowClasses(source).length).toBeGreaterThan(5);
		expect(
			cellClassesWrapping(source, "data-testid={`tile-side-").length,
		).toBeGreaterThan(1);
		expect(stripComments(read(ROOT_LAYOUT)).includes("<html")).toBe(true);
	});

	it("tile::stripComments-really-strips", () => {
		// ⚠ ASSEMBLED, because Tailwind's extractor cannot tell that this string
		// REPRESENTS a comment — it read `max-mobile:snap​-start` out of this fixture
		// and emitted the utility. The one place a test file's own prose about a
		// banned token becomes the token.
		const withComment = `a\n/* ${phone(snap("start"))} */\nb`;
		expect(stripComments(withComment)).not.toContain(snap("start"));
		// and it preserves the line count, so a reported line still points at source
		expect(stripComments(withComment).split("\n")).toHaveLength(3);
	});
});

// ── 1 · the tile is a LIST ROW ───────────────────────────────────────────────

describe("A6 D-1 — a list row of natural height", () => {
	it("tile::the-height-is-NATURAL-and-NO-height-token-survives", () => {
		const cls = tileRowClasses(stripComments(read(TABLE)));
		// ⛔⛔ INVERTED FROM A5, NOT DELETED. This row REQUIRED
		// `min-h-[calc(100dvh-60px-2px)]`; A6 withdraws it, so the row now forbids
		// any phone-tier height token at all — `min-h-`, `h-` or `max-h-`. A guard
		// that was merely removed would let the viewport-tall tile return without a
		// single test going red, on a shape the founder walked and rejected.
		const heightish = cls.filter(
			(c) =>
				c.startsWith(`${V}${S}min-h-`) ||
				c.startsWith(`${V}${S}h-`) ||
				c.startsWith(`${V}${S}max-h-`),
		);
		expect(
			heightish,
			`${TABLE}: the tile declares a phone-tier HEIGHT. A6 D-1 rules it a ` +
				`full-width row of NATURAL height in the page's ordinary scroll — the ` +
				`three lines it renders are what set it, and nothing else. The viewport ` +
				`expression this used to require is exactly what was withdrawn.`,
		).toEqual([]);
	});

	it("tile::it-is-a-grid-with-BOTH-track-lists-and-ONE-gap", () => {
		const cls = tileRowClasses(stripComments(read(TABLE)));
		// ⚠ THE GRID SURVIVES A6 AND THE REASON IS DOM ORDER, NOT HEIGHT. The four
		// `<td>`s are fixed at side · argument · value · Sell and the composition
		// wants the argument BELOW the other three; `flex-wrap` cannot (a wrapped
		// line's cross size comes from `align-content`, which stretches every line
		// equally) and `order` moves items inside lines, not lines.
		const why =
			`${TABLE}: the tile's track lists are incomplete. The column list places ` +
			`side, value and SELL across one line; the ROW list is the only place the ` +
			`two-band structure is written down, and without it the cells' own ` +
			`row-start-2 / col-span-3 name tracks nothing declares.`;
		expect(cls, why).toContain(phone("grid"));
		expect(cls, why).toContain(phone("grid-cols-[auto_1fr_auto]"));
		expect(cls, why).toContain(phone("grid-rows-[auto_1fr]"));
		// ⛔ 7px, AND IT IS THE TILE'S ONLY GAP. The ruling states exactly one
		// distance inside the tile — between the money line and the argument title.
		// The market question sits directly under the title, as it does at every
		// width above 640; `mt-auto`/`pt-3` were the withdrawn distributed gap and
		// are forbidden by their own row below.
		expect(
			cls,
			`${TABLE}: the tile's row gap is not the ruled 7px. A6 D-1 names one gap ` +
				`inside the tile and this is it.`,
		).toContain(phone("gap-y-[7px]"));
	});

	it("tile::it-does-NOT-snap-and-carries-NO-scroll-margin", () => {
		const cls = tileRowClasses(stripComments(read(TABLE)));
		// ⛔⛔ INVERTED FROM A5. These three were REQUIRED at MOBILE-2h.
		for (const token of ["start", "always", "center", "end"].map(snap)) {
			expect(
				cls,
				`${TABLE}: the tile still declares a scroll-snap alignment. A6 D-1 ` +
					`withdraws page-level snapping from this surface entirely — a tile is ` +
					`a row in an ordinary scroll, not a stop.`,
			).not.toContain(phone(token));
		}
		expect(
			cls.some((c) => c.startsWith(`${V}${S}scroll-mt-`)),
			`${TABLE}: the tile carries a scroll margin. Its only purpose was to lift ` +
				`a SNAP landing clear of the sticky header; with no snap it is a margin ` +
				`applied to scrolls nobody makes, and it would displace ` +
				`scrollIntoView({block:"nearest"}) for the keyboard stepper.`,
		).toBe(false);
	});

	it("tile::the-money-line-steps-DOWN-to-18-18-11-and-SELL-to-12", () => {
		// ⚠ THE TYPE IS THE OTHER HALF OF THE REVERT. 24px of value and 18px of
		// title were sized against a screen; at a list row's scale the ruling is
		// 18 / 18 / 11 across the money line, SELL at 12, and the title at 15.
		// ⛔ AND IT IS WHY THE LONG-VALUE RULE DOES NOT FIRE WHERE THE BRIEF EXPECTED:
		// `Đ 14,260` needs 269.3px of a 278px line at these sizes and 328px at the
		// old ones. Bring the sizes back up and `money-line.ts`'s measured constant
		// is wrong without anything saying so.
		const source = stripComments(read(TABLE));
		const side = classesAfter(
			source,
			"data-testid={`tile-side-",
			"the side marker",
		);
		expect(
			side,
			`${TABLE}: the side marker is not at the ruled 18px`,
		).toContain(phone("text-[18px]"));
		expect(
			side,
			`${TABLE}: the side GLYPH did not come down with its word, so an 18px ` +
				`label sits beside a 24px thumb.`,
		).toContain(phone("[&_svg]:size-[18px]"));
		const sell = classesAfter(
			source,
			"data-testid={`tile-sell-",
			"the SELL trigger",
		);
		expect(sell, `${TABLE}: SELL is not at the ruled 12px`).toContain(
			phone("text-[12px]"),
		);
		// ⛔ AND ITS 44px FLOOR IS UNTOUCHED BY THE STEP-DOWN. The label shrinks
		// inside the target; the target does not shrink with the label.
		expect(
			sell,
			`${TABLE}: SELL lost its 44px floor. It is the entry to the one ` +
				`comment-free money action in the product.`,
		).toContain(phone("min-h-11"));
		// the value and the movement chip, read off their own spans
		expect(
			source,
			`${TABLE}: the tile's value is not at the ruled 18px.`,
		).toMatch(/className="text-\[17px\][^"]*max-mobile:text-\[18px\]/);
		// ⛔⛔ EACH ARM IS READ SEPARATELY, AND THE FORM THIS REPLACES IS WHY. It read a
		// 700-CHARACTER WINDOW from the first `tile-pl-` and asked whether 11px appeared
		// anywhere inside it — a fence by DISTANCE (`O-8` in a different unit) wide
		// enough to span BOTH arms, so the moved arm's token satisfied an assertion
		// about the flat one. Measured: putting the flat arm back to 13px SURVIVED the
		// battery.
		// ⛔⛔ AND THE CLOSED TAB'S THREE TYPE SITES, WHICH NOTHING READ AT ALL. Plan
		// R-1 steps them down by name — the `Staked` figure 24 → 18 and both eyebrows
		// 13 → 11 — and reverting all three left 723/723 green. This file congratulates
		// itself a hundred lines up for closing exactly this gap one tab across, for
		// `justify-self-end`; it had reproduced it for the type. `@code-reviewer`,
		// MEDIUM.
		for (const [anchor, want, what] of [
			["data-testid={`tile-staked-", "text-[18px]", "the Closed tab's value"],
			[
				"data-testid={`tile-opened-",
				"text-[11px]",
				"the Closed tab's Opened date",
			],
		] as const) {
			expect(
				cellClassesWrapping(source, anchor),
				`${TABLE}: ${what} is not at the ruled step. The Closed tab shares the ` +
					`tile and takes the same two slots the Open tab gives the value and ` +
					`SELL, so a reader who has learned one tab has learned the other — ` +
					`which stops being true the moment one steps and the other does not.`,
			).toContain(phone(want));
		}
		// the `Staked` eyebrow, read off its own span rather than off its cell
		const stakedAt = source.indexOf("data-testid={`tile-staked-");
		const eyebrow = source.slice(
			stakedAt,
			source.indexOf("</InfoTip>", stakedAt),
		);
		expect(
			eyebrow,
			`${TABLE}: the Closed tab's 'Staked' eyebrow did not step down with its ` +
				`figure, so a carried column name prints as loud as the number it names.`,
		).toContain(phone("text-[11px]"));

		const arms = [...source.matchAll(/data-testid={`tile-pl-/g)].map(
			(m) => m.index,
		);
		expect(
			arms.length,
			`${TABLE}: the movement slot renders ${arms.length} ways and there are TWO ` +
				`— a "—" when the value has not moved, and a glyph-plus-percentage when ` +
				`it has. Re-derive this reader rather than loosening it.`,
		).toBe(2);
		for (const at of arms) {
			const tag = openingTagFrom(
				source,
				source.lastIndexOf("<", at),
				`${TABLE}: a movement arm`,
			);
			expect(
				tag,
				`${TABLE}: a movement arm is not at the ruled 11px. Both are read: they ` +
					`are twelve lines apart and look nothing alike, which is exactly how ` +
					`one gets missed.`,
			).toContain(phone("text-[11px]"));
		}
	});

	it("tile::R-3-no-selected-visual-below-640-and-the-STATE-survives", () => {
		const source = stripComments(read(TABLE));
		const cls = tileRowClasses(source);
		const why =
			`${TABLE}: a tile still paints a selected or hovered background below ` +
			`640px. BOTH arms need overriding: the selected arm carries bg-n1 and the ` +
			`resting arm carries a hover fill. ⚠ MOBILE-2h's R-3 is NOT reverted by ` +
			`A6 — the ruling keeps "no selected visual below 640" in terms.`;
		expect(cls, why).toContain(phone("bg-transparent"));
		expect(cls, why).toContain(phone("hover:bg-transparent"));
		// ⛔⛔ THE POSITIVE CONTROL, AND IT IS THE POINT OF THE ROW. R-3 removes the
		// PAINT and keeps the STATE — the sell sheet is told which position it is
		// selling by exactly this selection. A guard that only checked for the
		// absence of a tint would be satisfied by deleting selection altogether.
		expect(
			source,
			`${TABLE}: the selected tile no longer reports itself. R-3 removes the ` +
				`paint, not the selection.`,
		).toContain('aria-current={selected ? "true" : undefined}');
		expect(
			source,
			`${TABLE}: the selected tile is no longer keyboard-reachable.`,
		).toContain("tabIndex={selected ? 0 : -1}");
	});
});

// ── 2 · the long-value rule ─────────────────────────────────────────────────

describe("A6 D-1 — the movement chip is the one element that yields", () => {
	it("tile::the-rule-is-WIRED-to-both-movement-arms", () => {
		// ⛔⛔ THE PREDICATE HAS ITS OWN UNIT TEST (`tests/unit/profile/money-line`);
		// what THIS row holds is that it reaches the markup, on BOTH arms. The
		// movement slot renders two ways — a `—` when the value has not moved and a
		// glyph-plus-percentage when it has — and wiring only the second leaves the
		// first able to push SELL off a 360px line. They are 12 lines apart and look
		// nothing alike, which is exactly how one gets missed.
		const source = stripComments(read(TABLE));
		expect(
			source,
			`${TABLE}: the money line's fit rule is not imported. A6 D-1 rules the ` +
				`movement chip the one element that yields when the line cannot fit.`,
		).toContain('from "./money-line"');
		const wired = source.match(
			/movementFitsOnPhone \? "" : "max-mobile:hidden"/g,
		);
		expect(
			wired?.length,
			`${TABLE}: the fit rule reaches ${wired?.length ?? 0} of the movement ` +
				`arms and there are TWO — the flat "—" and the moved percentage. The ` +
				`unwired one overflows the line at a long value and the overflow is ` +
				`taken from SELL, which A6 D-1 says never yields.`,
		).toBe(2);
		// ⛔ AND IT IS A CLASS, NOT A BRANCH. Deciding the MARKUP from
		// `useIsPhoneTier()` would render the chip on the server (its server
		// snapshot is false) and remove it on hydration — a visible flicker on the
		// line the reader is looking at — and would also reach the desktop.
		expect(
			source,
			`${TABLE}: the chip is hidden by something other than a max-mobile: ` +
				`class, so the decision is not tier-scoped by construction.`,
		).toContain('"max-mobile:hidden"');
	});
});

// ── 3 · every cell is PLACED, on BOTH tabs ──────────────────────────────────

describe("A6 D-1 — the four cells are placed, on both tabs", () => {
	/**
	 * ⛔ AN UNPLACED GRID ITEM IS AUTO-PLACED INTO THE NEXT FREE CELL, so a
	 * missing coordinate does not error — it silently reflows the tile. That is
	 * why every cell is read rather than a representative one, and why both tabs
	 * are read: round five gave the Open tab's four cells a share and missed the
	 * Closed tab's two entirely, which reproduced the exact defect it existed to
	 * remove, one tab across.
	 */
	const CELLS: ReadonlyArray<readonly [string, string, string]> = [
		["data-testid={`tile-side-", "col-start-1", "row-start-1"],
		["<TileArgumentCell", "col-start-1", "row-start-2"],
		["data-testid={`tile-staked-", "col-start-2", "row-start-1"],
		["data-testid={`tile-opened-", "col-start-3", "row-start-1"],
	];

	for (const [anchor, col, row] of CELLS) {
		it(`tile::${anchor.replace(/[^a-z-]/gi, "")}-declares-its-coordinate`, () => {
			const cls = cellClassesWrapping(stripComments(read(TABLE)), anchor);
			const why =
				`${TABLE}: the cell wrapping ${anchor} declares no grid coordinate, so ` +
				`it is auto-placed. Auto-placement often lands an item where it was ` +
				`going to go anyway, which is why this fails invisibly rather than ` +
				`loudly.`;
			expect(cls, why).toContain(phone(col));
			expect(cls, why).toContain(phone(row));
		});
	}

	it("tile::the-Open-tab-s-value-and-SELL-are-placed-too", () => {
		// ⚠ These two have no testid of their own on the cell, so they are located
		// by the content they wrap rather than by an id — the value cell by the
		// `sold ?` branch it opens, the Sell cell by the trigger inside it.
		const source = stripComments(read(TABLE));
		const value = cellClassesWrapping(source, "{sold ? (");
		const sell = cellClassesWrapping(source, "data-testid={`tile-sell-");
		expect(
			value,
			`${TABLE}: the Open tab's value cell is auto-placed`,
		).toContain(phone("col-start-2"));
		expect(
			value,
			`${TABLE}: the Open tab's value cell is auto-placed`,
		).toContain(phone("row-start-1"));
		// ⛔ AND IT HUGS SELL. The column is 1fr, so without this the figure floats
		// in the middle of the tile and stops forming an edge with the button.
		expect(
			value,
			`${TABLE}: the value cell no longer hugs the SELL button, so the figure ` +
				`drifts in a 1fr column instead of sitting against it.`,
		).toContain(phone("justify-self-end"));
		expect(sell, `${TABLE}: the SELL cell is auto-placed`).toContain(
			phone("col-start-3"),
		);
		expect(sell, `${TABLE}: the SELL cell is auto-placed`).toContain(
			phone("row-start-1"),
		);
	});

	it("tile::the-Closed-tab-s-value-cell-hugs-its-neighbour-TOO", () => {
		// ⚠ The same token, on the same slot, one tab across — and only the Open
		// tab's was asserted. Delete it here and the 24px Staked figure floats at
		// the left of the `1fr` track with `Opened` hard right, on a tab no earlier
		// round ever opened. `@code-reviewer`, MEDIUM.
		const cls = cellClassesWrapping(
			stripComments(read(TABLE)),
			"data-testid={`tile-staked-",
		);
		expect(
			cls,
			`${TABLE}: the Closed tab's value cell no longer hugs the Opened column, ` +
				`so the figure drifts in a 1fr track instead of sitting against it.`,
		).toContain(phone("justify-self-end"));
	});

	it("tile::the-argument-cell-SPANS-the-whole-tile", () => {
		// ⛔⛔ THE TOKEN THE WHOLE COMPOSITION RESTS ON, AND NOTHING ASSERTED IT.
		// Delete the span and the cell is placed at col 1 / row 2 with an implicit
		// span of ONE: the argument title and the complete market question render
		// inside the `auto` track sized to `Yes` plus its glyph — about 70px — while
		// columns 2 and 3 of row 2 stay empty. The tile is destroyed, on both tabs,
		// and the whole suite stays green. `@code-reviewer`, HIGH; it was not among
		// the first battery's thirty mutations either.
		const cls = cellClassesWrapping(
			stripComments(read(TABLE)),
			"<TileArgumentCell",
		);
		expect(
			cls,
			`${TABLE}: the argument cell no longer spans the tile's three columns, so ` +
				`the title and the market question are rendered inside the side ` +
				`marker's own track — about 70px — with two thirds of row 2 empty.`,
		).toContain(phone("col-span-3"));
	});

	it("tile::the-argument-cell-SHRINKS-and-no-longer-STRETCHES", () => {
		const cls = cellClassesWrapping(
			stripComments(read(TABLE)),
			"<TileArgumentCell",
		);
		// ⛔⛔ INVERTED FROM A5. `self-stretch` was REQUIRED at MOBILE-2h: the grid
		// is `items-center`, so row 2's item had to opt back into the 1fr track's
		// height for the distributed `mt-auto` below it to have any slack to take.
		// A6 withdraws the distributed gap, so there is no slack and nothing to opt
		// into — and leaving the token would state a mechanism that no longer runs.
		expect(
			cls,
			`${TABLE}: the argument cell still opts into the stretch. It existed only ` +
				`to hand the 1fr row's leftover height down to the withdrawn mt-auto; ` +
				`with a natural height there is no leftover and this names nothing.`,
		).not.toContain(phone("self-stretch"));
		expect(
			cls,
			`${TABLE}: the argument cell lost min-w-0. A grid item's automatic ` +
				`minimum is its content, and this is the only cell whose content is ` +
				`unbounded — without it the TILE widens instead of the text wrapping.`,
		).toContain(phone("min-w-0"));
	});
});

// ── 4 · the three bands, and the ONE gap ────────────────────────────────────

describe("A6 D-1 — three bands, and the distributed gap is gone", () => {
	it("tile::the-argument-cell-is-a-column-and-is-NOT-full-height", () => {
		const source = stripComments(read(TABLE));
		// ⚠ ANCHORED BY PREFIX, NOT BY THE FULL EXPRESSION. Writing the testid out
		// in full would put a template placeholder inside a plain string, and
		// Biome's `noTemplateCurlyInString` fires on source text being SEARCHED FOR
		// as though it were a template that forgot its backticks — the same
		// accommodation `phone-round-five.test.ts` records for its pill anchor.
		// ⛔ AND THE TWO PREFIXES OVERLAP: `tile-arg-` matches the removed variant
		// too, and the removed branch comes FIRST in source order. So the live one
		// is read from the LAST occurrence, which is what makes the pair exact.
		const ARG = "data-testid={`tile-arg-";
		const REMOVED = "data-testid={`tile-arg-removed-";
		const liveAt = source.lastIndexOf(ARG);
		const removedAt = source.indexOf(REMOVED);
		expect(removedAt, `${TABLE}: the removed stub is gone`).toBeGreaterThan(-1);
		expect(
			liveAt,
			`${TABLE}: the live argument cell no longer follows the removed stub, so ` +
				`this reader is pointing at the wrong one. Re-derive the pair.`,
		).toBeGreaterThan(removedAt);
		for (const anchor of [
			source.slice(liveAt, liveAt + ARG.length + 8),
			REMOVED,
		]) {
			const cls = classesAfter(source, anchor, `${TABLE}: ${anchor}`);
			const why =
				`${TABLE}: ${anchor} is not a column. The title and the market question ` +
				`stack, and this is where that is declared. ⚠ BOTH variants are read: ` +
				`the removed stub is a tile too, and a stub shaped differently from ` +
				`every other tile is the one tile on the surface that cannot say where ` +
				`it came from.`;
			expect(cls, why).toContain(phone("flex"));
			expect(cls, why).toContain(phone("flex-col"));
			// ⛔⛔ INVERTED FROM A5. `h-full` was REQUIRED — it passed the 1fr row's
			// height down so the distributed `mt-auto` had slack. A6 withdraws that
			// gap, and `height: 100%` against an auto-height parent resolves to auto
			// anyway, so the token would be a stated mechanism that computes to
			// nothing. Forbidden rather than dropped, so the tile shape cannot return
			// half-built.
			expect(
				cls,
				`${TABLE}: ${anchor} still claims its parent's full height. That was ` +
					`the pass-down the withdrawn distributed gap needed; with a natural ` +
					`height it resolves to auto and names a mechanism that is gone.`,
			).not.toContain(phone("h-full"));
		}
	});

	it("tile::the-market-question-is-COMPLETE-and-carries-no-distributed-gap", () => {
		const source = stripComments(read(TABLE));
		const cls = classesAfter(source, "const marketLine = (", "the market line");
		// ⛔⛔ INVERTED FROM A5 — BOTH HALVES. `mt-auto` was the tile's distributed
		// gap and `pt-3` was that mechanism's floor; A6 withdraws the gap, and with a
		// natural height an auto margin has nothing to distribute anyway. The
		// question now sits directly under the title, where it sits at every width
		// above 640 and where it sat before MOBILE-2h.
		expect(
			cls,
			`${TABLE}: the market question still takes an auto top margin. A6 D-1 ` +
				`leaves ONE gap in the tile and it is the 7px row gap above the title.`,
		).not.toContain(phone("mt-auto"));
		expect(
			cls.some(
				(c) => c.startsWith(`${V}${S}pt-`) || c.startsWith(`${V}${S}mt-`),
			),
			`${TABLE}: the market question declares its own top spacing. That floor ` +
				`belonged to the withdrawn auto margin; the composition states one gap ` +
				`and this is not it.`,
		).toBe(false);
		expect(
			cls,
			`${TABLE}: the market question is clamped again. A5 D-1 rules it ` +
				`complete and free to wrap; line-clamp-none is what undoes the ` +
				`-webkit-box a line-clamp establishes, which overriding the line count ` +
				`alone does not.`,
		).toContain(phone("line-clamp-none"));
	});

	it("tile::the-argument-title-is-complete-and-steps-to-15px-medium", () => {
		const source = stripComments(read(TABLE));
		const at = source.indexOf("{cell.title}");
		expect(at, `${TABLE}: the title link is gone`).toBeGreaterThan(-1);
		const m = /className="([^"]*)"/.exec(
			source.slice(source.lastIndexOf("<Link", at), at),
		);
		const cls = (m?.[1] ?? "").split(/\s+/).filter(Boolean);
		const why =
			`${TABLE}: the argument title is clamped or at the wrong step. A6 D-1 ` +
			`rules it COMPLETE at 15px medium — complete because the surface's whole ` +
			`job is to show one argument, and 15px because the tile is a list row now ` +
			`rather than a screen (it was 18px at MOBILE-2h, against a 24px value).`;
		expect(cls, why).toContain(phone("line-clamp-none"));
		expect(cls, why).toContain(phone("text-[15px]"));
		expect(cls, why).toContain(phone("font-medium"));
		// ⚠ AGENTS.md §8 — an arbitrary text-[Npx] inherits whatever leading was in
		// scope, so the leading is restated wherever the size is.
		expect(
			cls,
			`${TABLE}: the title states a size without its leading, so it inherits ` +
				`whatever step was in scope (AGENTS.md §8).`,
		).toContain(phone("leading-[1.35]"));
	});
});

// ── 5 · what stands down so the PAGE is the scroller ────────────────────────

describe("A6 D-1 — the list scrolls with the PAGE, and one box contains it", () => {
	it("tile::the-section-KEEPS-its-clip-and-the-BODY-has-no-phone-override", () => {
		const source = stripComments(read(TABLE));
		// ⛔⛔ THE TWO BOXES PART COMPANY UNDER A6, AND EACH FOR ITS OWN REASON.
		// MOBILE-2h released BOTH so viewport-tall tiles could reach the viewport to
		// snap against it. With the snap withdrawn the BODY has nothing to escape and
		// goes back to the `overflow-y-auto` it has carried since the mockup. The
		// SECTION keeps its clip, because that was never about snapping: row 1 is
		// three whitespace-nowrap cells in tracks that cannot shrink below
		// min-content, and MOBILE-2h measured a five-figure figure needing 328px
		// against 278px, with the layout viewport widening 360 → 369 once the clip
		// was gone. The money line still exists at the same width.
		const section = classesAfter(
			source,
			'data-testid="positions-panel"',
			`${TABLE}: the positions section`,
		);
		expect(
			section,
			`${TABLE}: the positions SECTION lost its phone containment. A6 D-1 keeps ` +
				`it by name — it is the backstop that stops a long money line reaching ` +
				`the document as horizontal scroll.`,
		).toContain(phone("overflow-clip"));
		expect(
			section,
			`${TABLE}: the section changes overflow WITHOUT restoring min-w-0. An ` +
				`overflow other than visible also zeroes a box's automatic minimum size, ` +
				`so the two arrived as one decision — measured at MOBILE-2h, the panel ` +
				`went 324px to 533px inside a 360px phone when only half of it landed.`,
		).toContain(phone("min-w-0"));

		const body = classesAfter(
			source,
			'data-testid="positions-panel-body"',
			`${TABLE}: the positions body`,
		);
		// ⛔⛔ INVERTED FROM A5. `max-mobile:overflow-visible` was REQUIRED here.
		expect(
			body.filter((c) => c.startsWith(`${V}${S}overflow-`)),
			`${TABLE}: the positions BODY still carries a phone overflow override. Its ` +
				`only purpose was to leave the snap chain, and there is no snap chain — ` +
				`a token whose stated reason has evaporated is the defect this file ` +
				`exists to catch, not a spare part.`,
		).toEqual([]);
		expect(
			body,
			`${TABLE}: the positions body is a scroll container no more. It must stay ` +
				`overflow-y-auto: that is the desktop's panel-scoped scroll, and below ` +
				`640px nothing gives the box a definite height so it cannot engage.`,
		).toContain("overflow-y-auto");
		// ⛔ AND NO PHONE-TIER TOKEN AT ALL, not merely no overflow one. The row above
		// forbade `max-mobile:overflow-*` by prefix, so restoring `max-mobile:min-w-0`
		// alone passed — and that token only ever existed to pair with the overflow
		// release (an overflow other than `visible` already zeroes a box's automatic
		// minimum, so with `overflow-y-auto` back it names nothing). Half of a
		// withdrawn pair is the shape this file exists to catch. `@code-reviewer`, LOW.
		expect(
			body.filter((c) => c.startsWith(`${V}${S}`)),
			`${TABLE}: the positions body carries a phone-tier override again. It has ` +
				`no phone behaviour of its own under A6 D-1 — it is the desktop's ` +
				`panel-scoped scroller and nothing more.`,
		).toEqual([]);
		// ⛔ AND IT MUST NEVER CLIP. `sticky-header-strip.test.ts` forbids it by name
		// — the sticky <thead>'s negative-offset shadow covers this body's own top
		// padding, and a clipped body cannot scroll under it. Re-asserted here so a
		// reader fixing the section sees the constraint on its sibling.
		for (const forbidden of ["overflow-hidden", "overflow-clip"]) {
			expect(
				body,
				`${TABLE}: the positions body clips. The sticky <thead>'s shadow covers ` +
					`this box's top padding and a clipped body cannot scroll under it.`,
			).not.toContain(forbidden);
		}
	});

	it("tile::the-three-tile-window-cap-is-tier-gated-AND-clears-on-the-way-out", () => {
		const source = stripComments(read(TABLE));
		expect(
			source,
			`${TABLE}: the ROW_WINDOW max-height cap is no longer gated on the tier. ` +
				`Its own gate is "can the document scroll", which read false on a phone ` +
				`page that fitted its viewport and flips TRUE the moment tiles are a ` +
				`screen tall — capping the panel at exactly three screens and putting a ` +
				`max-height on the very box the tiles must escape.`,
		).toMatch(/if\s*\(isPhoneTable\)\s*\{/);
		// ⛔⛔ SCOPED TO THE BRANCH. The string it looks for occurs elsewhere in the
		// effect, so a file-wide match would be satisfied by a line the stand-down
		// never runs — the exact hole `phone-round-five` had to close on the
		// equaliser's twin of this gate.
		const gate = source.indexOf("if (isPhoneTable) {");
		const branch = source.slice(gate, source.indexOf("return;", gate));
		expect(
			branch,
			`${TABLE}: the phone branch returns without clearing the inline ` +
				`max-height, so whatever the cap last wrote outlives the stand-down — ` +
				`and an overflow-visible box with a stale max-height still ends early.`,
		).toMatch(/body\.style\.maxHeight = "";/);
		// and the effect must re-run when the tier changes, or the gate is decided once
		expect(
			source,
			`${TABLE}: the cap's effect does not depend on the tier, so a viewport ` +
				`crossing 640px keeps whichever answer the first run gave.`,
		).toContain("}, [visibleTiles.length, isPhoneTable]);");
	});

	it("tile::the-row-equaliser-is-STILL-gated-round-five-s-half-of-the-pair", () => {
		expect(
			stripComments(read(TABLE)),
			`${TABLE}: RF-10's pair is two mechanisms and both must stand down. This ` +
				`is round five's half, re-asserted here because MOBILE-2h adds the ` +
				`other and a reader fixing one should see both.`,
		).toMatch(/enabled:\s*!isPhoneTable/);
	});
});

// ── 6 · the snap census, now that nothing here snaps ────────────────────────

describe("A6 D-1 — nothing on this surface snaps, at all", () => {
	it("tile::the-root-element-carries-NO-snap-type", () => {
		const cls = classesAfter(
			stripComments(read(ROOT_LAYOUT)),
			"<html",
			ROOT_LAYOUT,
		);
		// ⛔⛔ INVERTED FROM A5. MOBILE-2h armed `snap​-y snap​-proximity` HERE,
		// because the viewport's snap type can only be set on the root — `<body>`
		// does not propagate it and no descendant can reach up to it. A6 withdraws
		// the snap, so the root goes back to the class string it carried before, and
		// this row is what keeps it there: a snap type on `<html>` is GLOBAL, so
		// restoring it silently would arm Discovery, the auth routes and the admin
		// tree the moment anything anywhere declared an alignment.
		for (const token of ["y", "x", "proximity", "mandatory"].map(snap)) {
			expect(
				cls,
				`${ROOT_LAYOUT}: the root element arms a scroll-snap type. A6 D-1 ` +
					`withdraws page-level snapping; and this is the one site from which it ` +
					`would reach EVERY route in the product, not just the one that wanted ` +
					`it.`,
			).not.toContain(phone(token));
		}
	});

	it("tile::the-snap-alignment-census-is-exactly-ONE-file", () => {
		/**
		 * ⛔⛔ THE CENSUS SURVIVES A6 AND SHRINKS BY ONE. MOBILE-2h's version pinned
		 * the set at two — the position tile and `PhoneFeedTrack` — because arming a
		 * global snap type is safe only while the set of targets is known. A6 removes
		 * the snap type AND the tile's alignment, so the set is back to one, and the
		 * brief's acceptance is `grep -rn scroll-snap src/` → zero hits outside it.
		 *
		 * ⚠ `PhoneFeedTrack` is the survivor and is NOT a counter-example: its panes'
		 * nearest scroll container is that track's own horizontal scroller, so the
		 * viewport never sees them. It is the debate surface, which A6 does not touch.
		 *
		 * ⛔ AND IT WALKS THE WHOLE OF `src/`. An earlier form iterated a hard-coded
		 * list of eleven paths, so an alignment added anywhere outside them was
		 * invisible: the list was unchanged, the found set was unchanged, the test was
		 * green. `@code-reviewer` called that an O-3 defect in a stated mechanism at
		 * MOBILE-2h and it is kept fixed here.
		 */
		const EXPECTED = [FEED_TRACK];
		const files: string[] = [];
		const walk = (dir: string): void => {
			for (const entry of readdirSync(join(ROOT, dir), {
				withFileTypes: true,
			})) {
				const rel = `${dir}/${entry.name}`;
				if (entry.isDirectory()) walk(rel);
				else if (/\.tsx?$/.test(entry.name)) files.push(rel);
			}
		};
		walk("src");
		// POSITIVE CONTROL — the walk really reaches the tree, and reaches the file
		// the census is about. A walk that found nothing would pass vacuously.
		expect(
			files.length,
			"the walk found almost no files — it is not reaching src/",
		).toBeGreaterThan(200);
		expect(files, "the walk did not reach the phone feed track").toContain(
			FEED_TRACK,
		);
		expect(files, "the walk did not reach the position tile").toContain(TABLE);

		// ⛔⛔ THE BOUNDARY IS A NEGATIVE LOOKBEHIND, NOT `(?:^|\s|:)`, AND THE
		// DIFFERENCE IS A HOLE THIS ROUND'S OWN MUTATION BATTERY FOUND. The older form
		// required whitespace, a line start or a variant colon before the token — so an
		// alignment written as the FIRST class in a string (`className="snap​-start …"`)
		// is preceded by a QUOTE and matched nothing at all. The census read clean with
		// a second snap target live in the tree: injecting `snap-start` at the head of a
		// `MarketCard.tsx` className SURVIVED the whole battery.
		// ⇒ `(?<![\w-])` admits a quote, a backtick, a brace or a variant colon, and
		// still refuses a token that is merely the tail of a longer word.
		const ALIGN = /(?<![\w-])snap-(?:start|center|end|align-none)\b/;
		const found = files.filter((rel) => {
			const src = stripComments(read(rel));
			return ALIGN.test(src) || src.includes("scrollSnapAlign");
		});
		expect(
			found.sort(),
			`the set of files declaring a scroll-snap ALIGNMENT has changed. A6 D-1 ` +
				`leaves exactly one — the debate's horizontal feed track, whose panes ` +
				`snap inside their OWN scroller and never against the viewport. The ` +
				`profile's tile was the other member and its alignment is withdrawn; if ` +
				`a new one is wanted anywhere, say so here and say which scroller it ` +
				`resolves against.`,
		).toEqual([...EXPECTED].sort());

		// ⛔ AND THE SNAP *TYPE* CENSUS, WHICH IS THE HALF THE BRIEF ASKS FOR BY
		// NAME. An alignment with no container does nothing; a container is what
		// makes one live. `PhoneFeedTrack` declares its own and is the only file that
		// may.
		// Same boundary and the same reason — see the ALIGN note above.
		const TYPE = /(?<![\w-])snap-(?:x|y|both|proximity|mandatory)\b/;
		const typed = files.filter((rel) => TYPE.test(stripComments(read(rel))));
		expect(
			typed.sort(),
			`the set of files declaring a scroll-snap TYPE has changed. Only the ` +
				`debate's feed track may arm one, and it arms it on its own horizontal ` +
				`scroller. A type on <html> or on any page-level box reaches every route ` +
				`in the product.`,
		).toEqual([...EXPECTED].sort());
	});
});

// ── 7 · R-1 · the head on one line ──────────────────────────────────────────

describe("R-1 — the positions head clears itself at 360px", () => {
	it("head::the-filter-button-is-capped-to-its-own-wrapper", () => {
		const cls = classesAfter(
			stripComments(read(TABLE)),
			'data-testid="positions-market-filter"',
			"the market filter trigger",
		);
		const why =
			`${TABLE}: the market filter can still exceed its wrapper. THE WRAPPER IS ` +
			`A PLAIN DIV, so it is display:block and this button is an INLINE-LEVEL ` +
			`box inside it, not a flex item of it — the shrink tokens beside this one ` +
			`name nothing here and the button keeps its whitespace-nowrap intrinsic ` +
			`width. MEASURED at 360px with a market selected: the wrapper shrank to ` +
			`45px and the button rendered 301px, overflowing the panel by 91px and ` +
			`painting under the Open/Closed pills so the counts were unreadable. The ` +
			`max-width cap is what makes the shipped truncate measure against the ` +
			`right box.`;
		expect(cls, why).toContain(phone("max-w-full"));
		expect(cls, why).toContain(phone("min-w-0"));
	});

	it("head::the-pills-keep-their-counts-and-refuse-to-shrink", () => {
		const source = stripComments(read(TABLE));
		const cls = classesAfter(
			source,
			// ⚠ prefix only — see the note on the argument-cell anchors above.
			"data-testid={`positions-status-",
			"the Open/Closed pills",
		);
		expect(
			cls,
			`${TABLE}: the status pills can shrink. The count is the thing this row ` +
				`exists to show and a shrinking pill drops it first — R-1 names ` +
				`"Closed (n) shows its count" as the acceptance.`,
		).toContain("shrink-0");
		expect(
			cls,
			`${TABLE}: the pills did not step down, so the four items on this line ` +
				`have no room to clear each other at 360px.`,
		).toContain(phone("text-[11px]"));
		// the count node itself must survive — it is what the ruling is about
		expect(
			source,
			`${TABLE}: the bracketed count is gone from the status pills.`,
		).toMatch(/\(\{s === "Closed" \? closedCount : openCount}\)/);
	});
});

// ── 8 · R-2 / R-3 · the sheet's amount, and the sheet's type ────────────────

describe("A6 D-2 — the sell sheet's amount IS the number", () => {
	it("sell::the-shared-field-gained-a-variant-that-DEFAULTS-to-the-row", () => {
		const source = stripComments(read(INLINE));
		expect(
			source,
			`${INLINE}: InlineSellAmount's presentation prop is gone or no longer ` +
				`defaults. The default is what makes the desktop untouched BY ` +
				`CONSTRUCTION — the same polarity ADR-0045 gives mobileResponsive, and ` +
				`for the same reason: a caller that forgets it inherits the established ` +
				`render rather than a new one.`,
		).toMatch(/variant\s*=\s*"row"/);
		expect(
			source,
			`${INLINE}: the variant no longer names both presentations, so a typo in ` +
				`a caller is a runtime shrug rather than a type error.`,
		).toMatch(/variant\?:\s*"row"\s*\|\s*"sheet"/);
	});

	it("sell::the-sheet-asks-for-the-sheet-presentation", () => {
		expect(
			stripComments(read(SHEET)),
			`${SHEET}: the sheet mounts the field at the row's presentation, so the ` +
				`48px figure A6 D-2 rules is a 15px one.`,
		).toMatch(/variant="sheet"/);
	});

	it("sell::⛔-the-sheet-s-figure-carries-NO-FRAME-IN-ANY-STATE", () => {
		// ⛔⛔ THE CENTRAL ROW OF R-2, AND IT TAKES FOUR ASSERTIONS BECAUSE THE FRAME
		// IS FOUR THINGS. A border, a radius, padding and a FOCUS RING — and the ring
		// is the one a partial job leaves behind, because it is invisible until
		// somebody taps the field. The ruling is explicit: "no visible frame in any
		// state — focused or not".
		const source = stripComments(read(INLINE));
		// the wrapper's sheet branch, read as the string it is
		const wrapper = /\?\s*"(inline-flex[^"]*)"/.exec(source)?.[1];
		expect(
			wrapper,
			`${INLINE}: the amount wrapper's sheet branch is unreadable — re-derive ` +
				`this anchor rather than loosening it.`,
		).toBeDefined();
		for (const forbidden of [
			"[border:var(--hairline)]",
			"rounded-(--r-chip)",
			"focus-within:shadow-(--state-focus-ring)",
		]) {
			expect(
				wrapper ?? "",
				`${INLINE}: the sheet's amount still draws ${forbidden}. R-2 rules the ` +
					`number ITSELF the input — every mark that says "a field lives here" ` +
					`goes, and the ceiling the border implied is stated in words beneath ` +
					`it instead.`,
			).not.toContain(forbidden);
		}
		// ⛔ EVERY PADDING SPELLING, NOT TWO PREFIXES. The earlier form filtered `px-`
		// and `py-` only, so restoring `p-2`, `pt-*`, `pb-*` or an arbitrary
		// `[padding:…]` satisfied a row whose message claims the box has no padding at
		// all. `@code-reviewer`, MEDIUM.
		expect(
			(wrapper ?? "")
				.split(/\s+/)
				.filter((c) => /^p[trblxy]?-/.test(c) || c.startsWith("[padding")),
			`${INLINE}: the sheet's amount wrapper still has padding, which is the ` +
				`box's last visible edge once the border is gone.`,
		).toEqual([]);
		// ⛔ AND THE FRAME BY FAMILY, NOT BY SPELLING. The `not.toContain` rows above
		// name exact tokens, so a re-bordering as `border`, `border-n3` or `ring-1`
		// passes them. This catches the family instead.
		expect(
			(wrapper ?? "")
				.split(/\s+/)
				.filter(
					(c) =>
						/^(?:border|rounded|ring|shadow|bg-)/.test(c) ||
						c.includes("[border") ||
						c.includes("shadow-(") ||
						c.includes(":shadow"),
				),
			`${INLINE}: the sheet's amount wrapper draws a frame of some kind. R-2 ` +
				`rules the number ITSELF the input — no border, no radius, no ring and ` +
				`no background, in any state.`,
		).toEqual([]);
		// ⛔ AND THE INPUT'S OWN RING. `ui/input.tsx` ships
		// `focus-visible:shadow-(--state-focus-ring)` in its base class; `cn()` is
		// tailwind-merge, so the LATER token replaces it — which means the override
		// has to be present, not merely the base absent.
		const inputAt = source.indexOf("<Input");
		const inputTag = source.slice(inputAt, source.indexOf("/>", inputAt));
		const sheetBranch = /\?\s*"([^"]*text-\[48px\][^"]*)"/.exec(inputTag)?.[1];
		expect(
			sheetBranch,
			`${INLINE}: the input's SHEET branch is not 48px. R-2 rules the figure the ` +
				`largest thing in the sheet, and a 48px token elsewhere in the file does ` +
				`not make it so.`,
		).toBeDefined();
		expect(
			sheetBranch ?? "",
			`${INLINE}: the sheet's field keeps the Input primitive's focus ring, so ` +
				`the frame R-2 removed comes back the moment anybody taps it — the one ` +
				`state in which a half-done job shows.`,
		).toContain("focus-visible:shadow-none");
		expect(
			sheetBranch ?? "",
			`${INLINE}: the sheet's field draws a border`,
		).toContain("[border:none]");
		// ⚠ AGENTS.md §8 — an arbitrary text-[Npx] inherits whatever leading was in
		// scope, so the leading is restated wherever the size is.
		expect(
			sheetBranch ?? "",
			`${INLINE}: the sheet branch states a size without its leading, so a 48px ` +
				`figure clips its own descenders (AGENTS.md §8).`,
		).toContain("leading-[1.2]");
		// ⛔ AND IT IS LEFT-ALIGNED. The width tracks the content with a 2ch floor, so
		// a one-character value leaves a glyph of slack: right-aligned it opens
		// BETWEEN the Đ and the digit and splits the unit; left-aligned it sits after
		// the caret, where a field with no border and no background cannot show it.
		expect(
			sheetBranch ?? "",
			`${INLINE}: the sheet's field is right-aligned, so its floor's slack opens ` +
				`between the Đ and the digits and breaks the single visual unit.`,
		).not.toContain("text-right");
	});

	it("sell::the-Đ-is-the-digits-EQUAL-in-the-sheet-and-is-NOT-in-the-row", () => {
		// ⛔ BOTH ARMS, because "one visual unit" is a claim about a PAIR. Asserting
		// only the sheet's Đ would pass a change that took the row's 11px glyph up
		// with it and quietly restyled the desktop.
		const source = stripComments(read(INLINE));
		const glyph = /\?\s*"(font-mono text-\[48px\][^"]*)"\s*:\s*"([^"]*)"/.exec(
			source,
		);
		expect(
			glyph?.[1],
			`${INLINE}: the sheet's Đ is not the digits' equal. R-2 asks for ONE ` +
				`visual unit and at 48px the ways it used to differ are all visible — ` +
				`size, face and colour.`,
		).toBeDefined();
		expect(glyph?.[1] ?? "").toContain("text-ink");
		expect(glyph?.[1] ?? "").toContain("font-mono");
		expect(
			glyph?.[2],
			`${INLINE}: the ROW's Đ moved with the sheet's. The desktop is untouched ` +
				`by this round and its glyph stays 11px and muted beside a 15px figure.`,
		).toBe("text-[11px] leading-[1.35] text-n5");
	});

	it("sell::the-CEILING-is-stated-beneath-the-figure-and-the-label-above-is-gone", () => {
		const source = stripComments(read(SHEET));
		// ⛔⛔ INVERTED FROM MOBILE-2h, which REQUIRED the `Current` overline above
		// the field. R-2 replaces the framed field with a borderless figure and puts
		// the bound underneath in words; at rest an untouched field shows the whole
		// holding, so keeping both would print `Current` / `Đ 31` / `of Đ 31` — the
		// same fact three times, the middle one forty-eight pixels tall.
		expect(
			source,
			`${SHEET}: the sheet still prints the 'Current' overline above the figure. ` +
				`With the ceiling stated beneath it, that is the same fact twice.`,
		).not.toContain("Current");
		expect(
			source,
			`${SHEET}: the ceiling is not stated. The bordered chip was the only hint ` +
				`that a bound existed at all and R-2 takes the chip away — and ` +
				`useInlineSell's edit() DISCARDS a draft above the seed, so a reader who ` +
				`types too much watches the field snap back with nothing saying why.`,
		).toMatch(/of Đ \{formatDharma\(props\.seedDisplay\)}/);
		// ⛔⛔ THROUGH THE SHARED FORMATTER, AND THE RAW FORM IS FORBIDDEN BY NAME
		// BECAUSE IT SHIPPED FOR A COMMIT. `tile.valueDisplay` is whole-Đ and
		// UNGROUPED — grouping lives in `groupInteger`, private to `format.ts` — so
		// `of Đ {props.seedDisplay}` prints `of Đ 14260` beneath a tile rendering
		// `Đ 14,260`. Invisible in every fixture, because the QA participant's
		// holdings are all under a thousand. `@code-reviewer`, HIGH;
		// `no-raw-dharma-render.test.ts` now carries `seedDisplay` too.
		expect(
			source,
			`${SHEET}: the ceiling line interpolates the display value RAW. It is ` +
				`ungrouped, so above Đ 999 it prints a second display variant beneath a ` +
				`grouped figure — SPEC.1 §10.8's one-formatter property, broken on the ` +
				`one surface where a reader is comparing two numbers.`,
		).not.toMatch(/of Đ \{props\.seedDisplay}/);
		// ⛔ THE DISPLAY VALUE, NOT THE WIRE ONE. `seedExact` carries up to eighteen
		// decimal places; printing it would put `of Đ 31.000000000000000000` under a
		// figure reading `31`.
		expect(
			source,
			`${SHEET}: the ceiling line renders the EXACT seed. That is an 18-decimal ` +
				`string under a rounded figure — the two would visibly disagree.`,
		).not.toMatch(/of Đ \{props\.seedExact}/);
		// ⛔⛔ AND IT IS *BENEATH*, WHICH THIS ROW'S NAME CLAIMED AND NOTHING CHECKED.
		// A6 D-2 names the POSITION — "with the holding stated beneath it as the
		// ceiling" — and moving the span above the field satisfied every other
		// assertion here. `@code-reviewer`, MEDIUM. Source order is the proxy a scan
		// can see; `phone-sell-sheet.test.tsx` asserts it on the rendered DOM.
		const fieldAt = source.indexOf("<InlineSellAmount");
		const ceilingAt = source.indexOf("of Đ {formatDharma");
		expect(
			fieldAt,
			`${SHEET}: the shared amount field is not mounted`,
		).toBeGreaterThan(-1);
		expect(
			ceilingAt,
			`${SHEET}: the ceiling is stated ABOVE the figure. A6 D-2 puts it beneath — ` +
				`a bound printed over a number reads as that number's label, which is ` +
				`what the withdrawn 'Current' overline was.`,
		).toBeGreaterThan(fieldAt);
	});

	it("sell::the-sheet-s-two-context-lines-step-to-17-and-13-and-STAY-clamped", () => {
		const source = stripComments(read(SHEET));
		expect(
			source,
			`${SHEET}: the argument title is not at R-3's 17px.`,
		).toMatch(/line-clamp-2 text-\[17px\]/);
		expect(
			source,
			`${SHEET}: the market question is not at R-3's 13px.`,
		).toMatch(/line-clamp-2 text-\[13px\]/);
		// ⛔ AND BOTH CLAMPS SURVIVE THE SIZE CHANGE, which is the half that can
		// silently not happen. An unbounded participant-or-operator string in a title
		// block on a BOUNDED shell is a denial of view — the class `@security-auditor`
		// named at MOBILE-2d. The profile's read model caps neither string.
		expect(
			(source.match(/line-clamp-2/g) ?? []).length,
			`${SHEET}: one of the sheet's two title blocks lost its clamp. A market ` +
				`question long enough to fill the sheet pushes Confirm below the fold on ` +
				`the one surface where the reader has already decided to act.`,
		).toBe(2);
	});

	it("sell::CONFIRM-keeps-its-width-and-its-height", () => {
		const cls = classesAfter(
			stripComments(read(SHEET)),
			"data-testid={`phone-sell-confirm-",
			"the sheet's Confirm",
		);
		expect(
			cls,
			`${SHEET}: Confirm lost its full width. ADR-0051 A4 rules every block in ` +
				`a phone sheet edge-aligned, and R-2/R-3 change nothing about it.`,
		).toContain("w-full");
		expect(
			cls,
			`${SHEET}: Confirm's height moved. R-3 says CONFIRM unchanged, and h-12 ` +
				`is what MOBILE-2h left it at.`,
		).toContain("h-12");
	});

	it("sell::the-field-is-a-REAL-input-with-the-numeric-keypad-pair", () => {
		const source = stripComments(read(INLINE));
		expect(
			source,
			`${INLINE}: the amount is no longer an input, so tapping it raises no ` +
				`keyboard on that field.`,
		).toMatch(/<Input/);
		// ⛔⛔ THE PAIR, AND IT IS PER-VARIANT. R-2 prescribes Polymarket's shape —
		// `inputmode="numeric"` with `pattern="[0-9]*"`, the two iOS reads together to
		// raise a digits-only keypad. The ROW keeps `decimal`: the desktop has a full
		// keyboard and R-2 is scoped to the sheet, so a single unconditional value
		// would restyle the desktop's behaviour on the way past.
		expect(
			source,
			`${INLINE}: the sheet's field does not ask for the numeric keypad.`,
		).toMatch(/inputMode=\{sheet \? "numeric" : "decimal"}/);
		expect(
			source,
			`${INLINE}: the pattern half of the pair is missing or is not scoped to ` +
				`the sheet. iOS reads inputmode AND pattern together.`,
		).toMatch(/pattern=\{sheet \? "\[0-9\]\*" : undefined}/);
		// ⛔ AND THE MONEY IS UNTOUCHED. This is the ONE assertion here about the
		// wire, so it names the CALL rather than the identifier: an earlier form
		// matched a bare `seedExact`, which occurs six times in this file and
		// therefore could not fail for the reason its own message gave.
		expect(
			source,
			`${INLINE}: the untouched field no longer hands the EXACT seed back on ` +
				`edit, so a field nobody typed in would submit the ROUNDED figure and ` +
				`strand the remainder as unsellable dust.`,
		).toMatch(/onEdit\(e\.target\.value,\s*seedExact\)/);
	});
});
