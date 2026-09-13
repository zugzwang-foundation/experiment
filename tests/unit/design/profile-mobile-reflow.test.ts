import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * MOBILE-1 · JOB B — `/u/[pseudonym]`'s POSITIONS TABLE AT PHONE WIDTH: the
 * table box becomes a stack of cards below 640px, nothing is dropped, and
 * nothing above 640px moves.
 *
 * WHAT THIS GUARD IS FOR. `PositionsTable` is a `table-fixed` table with four
 * declared column widths. RECON measured it on staging at 375×812: the table
 * renders 324px inside a 317px panel body, `Argument` computes to **0px**, the
 * `ARGUMENT` and `CURRENT` headers overprint at the same `left`, and the
 * argument body — a `line-clamp-4` link — is in the DOM at width zero. The
 * Closed tab is the same shape by arithmetic (`96 + 92 + 92 = 280` in 317,
 * leaving ≈37px), never measured, which is why ADR-0048 is owed a second patch
 * record and why the plan insists both tabs are opened.
 *
 * ⛔ THE PROPERTY AT RISK IS A CAPABILITY, NOT A COLUMN. ADR-0048 refused to
 * drop `Sell` on the phone because dropping it removes a participant's ability
 * to EXIT a position. Today that capability is already unreachable: the Sell
 * cell renders inside a table whose content is destroyed. So this is not a
 * cosmetic job, and the way it fails is by moving the exit somewhere a thumb
 * cannot reach.
 *
 * ⇒ The mechanism is four additive tokens on four elements (plan §4.2), which
 * flips the table from a table box to a stack of flex columns below 640px. A
 * flex container BLOCKIFIES its children, so making the `<tr>` a flex column
 * blockifies all six `<td>` variants without opening a single `<td>`; the same
 * rule cascades from the `<table>` down through each `<tbody>`.
 *
 * ⛔⛔ THAT CASCADE IS REASONED FROM CSS DISPLAY 3 AND HAS NEVER BEEN OBSERVED
 * IN THIS TREE (plan F-2, self-critique finding 2 — the plan's own "most likely
 * to fall apart at runtime"). NOTHING IN THIS FILE TESTS IT. See the
 * why-a-source-scan paragraph below before reading any assertion here as
 * evidence that anything stacks.
 *
 * ⚠ WHY A SOURCE SCAN AND NOT A RENDER TEST — and this is the whole of what
 * this file can claim. jsdom performs no layout: no media query, no flex, no
 * blockification, no Tailwind utility, no `table-layout`. A render test
 * structurally cannot see "each position becomes its own block below 640px",
 * cannot see whether the `<td>`s stopped sharing a horizontal band, and cannot
 * see horizontal overflow. **This file proves that four class tokens and two
 * labels are AUTHORED ON THE RIGHT NODES OF THE RIGHT FILE, and nothing else.**
 * Whether the surface then fits 375px is the plan's R1/R5 browser measurement's
 * job and only its job. Every design guard in this repo has this shape
 * (`debate-mobile-reflow.test.ts`, `discovery-height-chain.test.ts:19-24`); it
 * is stated here so the suite is not read as proof of the fix.
 *
 * ⛔ IT OPENS `PositionsTable.tsx` BY NAME, WHICH IS THE POINT (plan F-10).
 * `docs/parked.md` records `MarketHeader.tsx:290` as "guarded by coincidence" —
 * a scan for the STRING finds it in `DebateView.tsx` while no test opens the
 * FILE, so the token can be deleted from `MarketHeader` and stay green. Every
 * assertion below reads one file, named in `TABLE_FILE`.
 *
 * ⛔⛔⛔ NO CLEAN PHONE-VARIANT CLASS LITERAL APPEARS ANYWHERE IN THIS FILE,
 * AND THAT IS LOAD-BEARING RATHER THAN FASTIDIOUS. Tailwind v4's source
 * detection scans `tests/` — not only `docs/` and the root `.md` files
 * `css-compiles.test.ts` already warns about. MEASURED at this file's writing:
 * `opacity-0` under this variant appears in **zero** files under `src/`, in
 * exactly **one** file under `tests/` (`tests/unit/shell/
 * global-header-mobile-reflow.test.ts`), in zero under `docs/` — and it IS in
 * the built stylesheet at `.next/static/chunks/*.css`. A test file emitted a
 * production utility. That is the whole proof.
 *
 * ⇒ Why it matters HERE specifically: the plan's R2 verifies this job's work by
 * grepping the built stylesheet BY CLASS NAME, and unlike Job A this job MINTS
 * utilities — `flex`, `gap-3` and `inline` under this variant were all absent
 * from `src/` and from the built sheet before this job, which is what made R2
 * capable of failing. ⚠ THE SHIPPED SET IS DELIBERATELY NOT ENUMERATED HERE:
 * an earlier draft of this docblock listed twelve tokens, and THIS COMMIT MAKES
 * THAT LIST FIFTEEN — prose carrying a number invalidated by its own change is
 * the failure mode CLAUDE.md §1's ADR-ceiling sentence has now recorded five
 * times. Read it with the command, which cannot go stale:
 *
 *   git grep -ohE 'max-mobile:[a-z0-9-]+(\[[^]"]*\])?' -- 'src/*' | sort -u
 *
 * A clean literal in THIS file would put those three
 * rules in the sheet regardless of what `PositionsTable.tsx` ships, and R2 —
 * the one check written to catch the stale-stylesheet failure that shipped
 * Phase A inert twice — would pass on a class the code does not carry. That is
 * plan F-11, one register over from the `docs/` case the plan already guards.
 *
 * ⇒ So the prefix is ASSEMBLED AT RUNTIME (`VARIANT + SEP` below) and every
 * assertion is written `phone("flex-col")`. **No string in this file matches
 * `/max-mobile:[a-z]/` — check it before editing:**
 *
 *   grep -nE 'max-mobile:[a-z]' tests/unit/design/profile-mobile-reflow.test.ts
 *
 * ⛔ DO NOT "TIDY" THE CONCATENATION BACK INTO LITERALS. It looks like
 * indirection for its own sake and it is not.
 *
 * ⚠ The UNPREFIXED literals below (`w-full`, `table-fixed`, the four `w-[Npx]`
 * widths, the `<thead>` baseline) are safe by a different argument, not by the
 * same one: each is already authored in `src/`, so scanning this file re-emits
 * a rule that already exists, and R2 greps the VARIANT form in any case.
 *
 * ⚠ V-REGISTER DISCIPLINE. This reads the SHIPPED FILE.
 */

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

/** The one file every assertion in this suite opens (plan F-10). */
const TABLE_FILE = "src/components/profile/PositionsTable.tsx";

/**
 * The phone variant, ASSEMBLED — see the ⛔⛔⛔ paragraph above. Split across
 * two constants rather than concatenated literals so that no source token in
 * this file is class-shaped for Tailwind's scanner to find.
 */
const VARIANT = "max-mobile";
const SEP = ":";
const PHONE = VARIANT + SEP;
/** `phone("flex-col")` — the variant-prefixed class token, built at runtime. */
const phone = (utility: string) => PHONE + utility;

/**
 * The UNPREFIXED class tokens each of the four §4.2 elements carries TODAY, read
 * off `PositionsTable.tsx` at `f97657e` and enumerated here so the "adds no
 * unprefixed class" check has something exact to diff against.
 *
 * ⚠ `<tbody>` CARRIES NO `className` AT ALL TODAY — the empty array is the
 * measurement, not a placeholder. Its edit site is an ADD, not an append, which
 * is the one of the four that can fail differently from the others.
 */
const TABLE_BASE = ["w-full", "table-fixed", "text-left", "text-sm"];
const THEAD_BASE = [
	"sticky",
	"top-0",
	"z-10",
	"bg-n0",
	"shadow-[0_calc(var(--spacing)*-3)_0_0_var(--color-n0)]",
	"text-[8.5px]",
	"leading-[1.2]",
	"font-extrabold",
	"tracking-[0.12em]",
	"text-n4",
	"uppercase",
];
const TBODY_BASE: string[] = [];
const TR_BASE = [
	"cursor-pointer",
	"rounded-(--r)",
	"focus-visible:shadow-(--state-focus-ring)",
];

/**
 * The two Closed-tab cells that gain a label (plan §4.3), keyed by the slug
 * their `data-testid` already carries. **The slug is the JOIN between the cell
 * and its column header** — `tile-staked-*` ↔ the `<th>` reading `Staked` — and
 * it is what lets the byte-identity assertion below compare two strings both
 * read from source instead of two copies of a literal typed here.
 */
const LABELLED_CLOSED_CELLS = ["staked", "opened"] as const;

// ── Source readers ───────────────────────────────────────────────────────────

/**
 * Source with `/* *\/` and `//` comments removed.
 *
 * ⛔ LOAD-BEARING, NOT TIDINESS — the same helper, for the same reason, as
 * `debate-mobile-reflow.test.ts` and `global-header-mobile-reflow.test.ts`.
 * `PositionsTable.tsx` documents its layout decisions in prose beside the
 * classes that implement them and names its own tags in that prose: `<thead>`
 * appears on three lines and `<tbody>` on three, of which exactly ONE each is
 * an element. Every uniqueness check below would throw on the documentation
 * without this — and a guard that reddens when somebody writes a comment is a
 * guard that gets deleted rather than fixed.
 *
 * ⚠ Two assumptions, both true of this file today and both verified rather than
 * hoped: no `//` inside a string literal (measured — the file contains no `://`
 * at all, so no URL can truncate a line), and no block-comment OPENER inside a
 * `//` line comment (block-stripping runs first, so a stray opener would
 * swallow everything to the next closer). Both fail LOUDLY here: the uniqueness
 * throws below fire the moment the surviving element set changes shape.
 */
function stripComments(source: string): string {
	return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

/** The index of `needle` in `source`, THROWING unless it occurs exactly once. */
function uniqueIndexOf(source: string, needle: string, what: string): number {
	const hits = source.split(needle).length - 1;
	if (hits === 0) {
		throw new Error(
			`${TABLE_FILE}: no "${needle}" found — ${what}. MOBILE-1 Job B keys its ` +
				`phone-width overrides off this anchor; if the table was restructured, ` +
				`re-derive this guard rather than deleting it.`,
		);
	}
	if (hits > 1) {
		throw new Error(
			`${TABLE_FILE}: "${needle}" occurs ${hits} times, so it no longer ` +
				`identifies one node — ${what}. This guard may be measuring the wrong ` +
				`element. Re-derive the anchor on something unique rather than ` +
				`loosening the assertions.`,
		);
	}
	return source.indexOf(needle);
}

/**
 * The full OPENING TAG of the element whose attributes contain `anchor` — from
 * its `<` to the `>` that closes the opening tag.
 *
 * ⛔ FENCED BY SYMBOL, NEVER BY DISTANCE (O-8). Each of the four elements is
 * located by something it IS — its `data-testid`, its tag name — and not by a
 * line number or a `slice(at, at + N)` character window, O-8's corollary being
 * that a character window is a line number wearing a different unit. The plan's
 * `:839 · :857 · :885 · :1056` are evidence, not the fence; two of them had
 * already moved by ±25 lines between the ADR's reading and this branch's HEAD.
 *
 * ⛔ THE `>` IS FOUND AT BRACE DEPTH ZERO, WHICH IS THE WHOLE DIFFICULTY. Three
 * of these four tags carry arrow-function handlers — `onKeyDown={(e) => …}`,
 * `ref={(el) => …}` — so the FIRST `>` after the anchor belongs to an `=>`
 * inside an attribute expression, and a naive `indexOf(">")` would return a tag
 * that stops before the `className` this file exists to read. Every JSX
 * attribute expression is braced, so depth counting separates them.
 *
 * ⚠ It assumes no unbalanced brace inside a string or template literal in these
 * four tags (true: measured), and it THROWS rather than guessing if depth never
 * returns to zero.
 */
function openingTagOf(source: string, anchor: string, what: string): string {
	const at = uniqueIndexOf(source, anchor, what);
	const open = source.lastIndexOf("<", at);
	if (open === -1 || !/[A-Za-z]/.test(source[open + 1] ?? "")) {
		throw new Error(
			`${TABLE_FILE}: "${anchor}" (${what}) does not sit inside an element's ` +
				`attributes. Re-derive this scan — an occurrence it cannot bound is an ` +
				`occurrence it is not checking.`,
		);
	}
	let depth = 0;
	for (let i = open + 1; i < source.length; i += 1) {
		const c = source[i];
		if (c === "{") depth += 1;
		else if (c === "}") depth -= 1;
		else if (c === ">" && depth === 0) return source.slice(open, i + 1);
	}
	throw new Error(
		`${TABLE_FILE}: the element carrying "${anchor}" (${what}) never closes ` +
			`its opening tag at brace depth zero.`,
	);
}

/** `{ … }` from `openIndex` to its matching close, braces counted. */
function balancedFrom(text: string, openIndex: number): string {
	let depth = 0;
	for (let i = openIndex; i < text.length; i += 1) {
		if (text[i] === "{") depth += 1;
		else if (text[i] === "}") {
			depth -= 1;
			if (depth === 0) return text.slice(openIndex, i + 1);
		}
	}
	throw new Error(`${TABLE_FILE}: unbalanced braces from index ${openIndex}.`);
}

const split = (s: string) => s.split(/\s+/).filter(Boolean);

/**
 * The source anchor for a node whose `data-testid` is a TEMPLATE — e.g.
 * `` data-testid={`position-tile-${tile.key}`} ``. The trailing `${` is what
 * makes the anchor unique: inside `PositionsTable.tsx` the bare prefix
 * `position-tile-` ALSO occurs as a `testidPrefix` option and inside a
 * `querySelectorAll` selector, and either would defeat the uniqueness check
 * every anchor in this file depends on.
 */
const keyedTestid = (prefix: string) => `${prefix}\${`;

/**
 * The class tokens an opening tag declares, or `null` if it declares no
 * `className` at all.
 *
 * ⚠ `null` IS A REAL ANSWER, NOT AN ERROR. The `<tbody>` edit site carries no
 * `className` today, so a helper that threw here would turn this file's most
 * interesting RED — "the per-market group never became a flex column" — into a
 * crash with no assertion message attached.
 *
 * ⛔ TWO FORMS, BECAUSE THE `<tr>` USES THE OTHER ONE. Three of the four
 * elements carry a plain `className="…"`; `TileRow`'s `<tr>` carries a TEMPLATE
 * LITERAL with a `selected ? … : …` interpolation, which a `className="([^"]*)"`
 * regex does not see at all — it would report "no className" on a node that has
 * one, i.e. a wrong RED that a later reader fixes by loosening the guard.
 *
 * ⚠ INTERPOLATIONS ARE STRIPPED, AND THAT IS A DELIBERATE NARROWING. Only the
 * STATIC parts of the template are read, so a token authored inside the
 * `selected ? … : …` branches is invisible here and this file reddens on it.
 * That is correct: a class that applies only while a tile is selected is not
 * "the row stacks below 640px". Both placements the plan's wording admits —
 * appended to the static head, or after the interpolation — survive.
 */
function classTokensOf(tagText: string): string[] | null {
	const quoted = /className="([^"]*)"/.exec(tagText);
	if (quoted) return split(quoted[1] ?? "");
	const at = tagText.indexOf("className={");
	if (at === -1) return null;
	const expr = balancedFrom(tagText, tagText.indexOf("{", at));
	return split(
		expr.replace(/\$\{[\s\S]*?\}/g, " ").replace(/[`{}]/g, " "),
	).filter((t) => t !== "className=");
}

/** The class tokens of the element carrying `anchor`, throwing if it has none. */
function classesOf(source: string, anchor: string, what: string): string[] {
	const tokens = classTokensOf(openingTagOf(source, anchor, what));
	if (tokens === null) {
		throw new Error(
			`${TABLE_FILE}: the element carrying "${anchor}" (${what}) declares no ` +
				`className at all.`,
		);
	}
	return tokens;
}

/**
 * The trimmed inner text of every `<th>` in the `<thead>`, in source order.
 *
 * ⚠ TRIMMED EXACTLY AS `arrangement.test.tsx` TRIMS IT — that suite reads the
 * same six headers through `textContent` and `.trim()`, and two files reading
 * the same strings must normalise them the same way or they can disagree about
 * what is on disk. Nothing else is normalised: no case-folding, no whitespace
 * collapsing inside the string.
 */
function headerTexts(source: string): string[] {
	const open = uniqueIndexOf(source, "<thead", "the column-header row");
	const end = source.indexOf("</thead>", open);
	if (end === -1) {
		throw new Error(`${TABLE_FILE}: <thead> is never closed.`);
	}
	const region = source.slice(open, end);
	return [...region.matchAll(/<th\b[^>]*>([\s\S]*?)<\/th>/g)].map((m) =>
		(m[1] ?? "").trim(),
	);
}

/**
 * The `<th>` string whose lowercased text IS `slug` — the column header a
 * `tile-<slug>-*` cell belongs under.
 *
 * ⛔ THIS IS THE JOIN, AND IT IS WHY NO COPY IS TYPED ON BOTH SIDES OF THE
 * BYTE-IDENTITY ASSERTION. The slug comes from a `data-testid` that already
 * exists in the tree and is not copy; the header string is read from source.
 * So the assertion compares source to source, and a test that hardcoded
 * `"Staked"` in both places would pass on a tree where both had drifted —
 * which is exactly the thing "no copy is authored" is supposed to forbid.
 */
function headerFor(source: string, slug: string): string {
	const matches = headerTexts(source).filter(
		(t) => t.toLowerCase() === slug.toLowerCase(),
	);
	if (matches.length !== 1) {
		throw new Error(
			`${TABLE_FILE}: expected exactly one <th> reading "${slug}" ` +
				`(case-insensitively); found ${matches.length}. The Closed card's ` +
				`labels byte-carry these strings, and the \`tile-${slug}-*\` testid is ` +
				`the join between them. If the column was renamed, re-derive this ` +
				`guard — and note that \`arrangement.test.tsx\`'s ` +
				`\`grid::the-CLOSED-tab-is-Position-Argument-Staked-Opened\` pins the ` +
				`literal copy and will have reddened too.`,
		);
	}
	return matches[0] as string;
}

/** The source of the `<td>` carrying `data-testid={\`tile-<slug>-…\`}`. */
function closedCellWindow(source: string, slug: string): string {
	const marker = keyedTestid(`tile-${slug}-`);
	const at = uniqueIndexOf(source, marker, `the Closed tab's ${slug} cell`);
	const open = source.lastIndexOf("<td", at);
	const end = source.indexOf("</td>", at);
	if (open === -1 || end === -1) {
		throw new Error(`${TABLE_FILE}: could not bound the ${slug} <td>.`);
	}
	const window = source.slice(open, end);
	if (window.slice(3).includes("<td")) {
		throw new Error(
			`${TABLE_FILE}: the ${slug} <td> now contains a nested <td, so the first ` +
				`</td> is no longer its own and this window is unsound. Re-derive the ` +
				`bounds rather than loosening the assertions.`,
		);
	}
	return window;
}

/**
 * The first element inside `window` whose className carries the phone-variant
 * `inline` token, with its inner text — i.e. the hidden column label (plan
 * §4.3), or `null` if the cell has none.
 *
 * ⚠ Assumes the label's own tag carries no `>` after its `className` other than
 * the tag close. True of a `<span>`; loud rather than silent if it stops being.
 */
function gatedLabelIn(
	window: string,
): { classes: string[]; text: string } | null {
	for (const m of window.matchAll(/className="([^"]*)"/g)) {
		const classes = split(m[1] ?? "");
		if (!classes.includes(phone("inline"))) continue;
		const gt = window.indexOf(">", (m.index ?? 0) + m[0].length);
		const lt = window.indexOf("<", gt + 1);
		if (gt === -1) return { classes, text: "" };
		return {
			classes,
			text: window.slice(gt + 1, lt === -1 ? undefined : lt).trim(),
		};
	}
	return null;
}

// ── 1 · The four edit sites (plan §4.2) ──────────────────────────────────────

describe("profile mobile reflow — the positions table stacks below 640px", () => {
	/**
	 * Edit site 1. ⚠⚠ **MOBILE-2e · R-P3 — `gap-3` IS GONE FROM BOTH SITES AND
	 * THIS ROW NOW ASSERTS ITS ABSENCE.** Job B byte-carried a 12px gap from
	 * `ArgumentList.tsx` so two markets sat as far apart as two arguments within
	 * one market — correct for a stack of individually outlined CARDS, which is
	 * what Job B shipped. Round five replaces the cards with a hairline-divided
	 * LIST: the separator moves onto each row's top edge, and 12px of ground
	 * between every pair of hairlines would read as neither a list nor cards.
	 * ⚠ The guard is INVERTED rather than deleted, so a revert to the gap reddens
	 * here instead of passing a looser pattern — these were the developer's
	 * guards and they are this lane's now.
	 */
	it("profile-mobile::the-table-becomes-a-column-of-market-groups-below-640", () => {
		const source = stripComments(read(TABLE_FILE));
		const classes = classesOf(
			source,
			'data-testid="positions-table"',
			"the positions table itself",
		);

		const why =
			`${TABLE_FILE}: the positions <table> never leaves table layout below ` +
			`640px. At 375px it renders 324px of fixed columns inside a 317px panel ` +
			`body, which computes the Argument column to 0px — the argument text is ` +
			`in the DOM at width zero, and the ARGUMENT and CURRENT headers ` +
			`overprint. Append ${phone("flex")}, ${phone("flex-col")} and ` +
			`${phone("flex")} and ${phone("flex-col")} — do not replace ` +
			`\`table-fixed\` or \`w-full\`, and do NOT re-add ${phone("gap-3")}: ` +
			`round five divides rows by a hairline on each row's own top edge, and a ` +
			`gap between them puts ground between every pair of hairlines.`;
		expect(classes, why).toContain(phone("flex"));
		expect(classes, why).toContain(phone("flex-col"));
		expect(classes, why).not.toContain(phone("gap-3"));
	});

	/**
	 * Edit site 2. The column headers are meaningless once each position is its
	 * own block — and they are the elements RECON measured overprinting. What
	 * `Staked` and `Opened` say is carried back into the Closed card by the two
	 * labels asserted further down; `Current` is ruled LOST (plan §4.4, OI-6).
	 */
	it("profile-mobile::the-column-header-row-drops-out-below-640", () => {
		const source = stripComments(read(TABLE_FILE));
		const classes = classesOf(source, "<thead", "the column-header row");

		expect(
			classes,
			`${TABLE_FILE}: the <thead> still renders below 640px. Once the table is ` +
				`a column of cards there are no columns for it to head, and it is the ` +
				`element RECON measured with ARGUMENT and CURRENT overprinting at the ` +
				`same left. Append ${phone("hidden")}.`,
		).toContain(phone("hidden"));
	});

	/**
	 * Edit site 3 — the ADD rather than an append, and the one that can fail
	 * alone. ⚠ MOBILE-2e: its `gap-3` is gone for the same reason as the
	 * table-level one above; the stacking tokens stay, because the `<tbody>`
	 * still has to become a flex column for the rows inside it to be items.
	 */
	it("profile-mobile::each-market-group-stacks-its-own-tiles-below-640", () => {
		const source = stripComments(read(TABLE_FILE));

		// The fence: the per-market `<tbody>` is the one inside `groups.map(`.
		// Uniqueness is checked by `uniqueIndexOf`, so "the tbody after the map"
		// is unambiguous rather than merely first.
		const mapAt = uniqueIndexOf(source, "groups.map(", "the per-market group");
		const bodyAt = uniqueIndexOf(source, "<tbody", "the per-market group body");
		expect(
			bodyAt > mapAt,
			`${TABLE_FILE}: the <tbody> no longer sits inside \`groups.map(\`, so ` +
				`this guard is not reading the per-market group. Re-derive the fence.`,
		).toBe(true);

		const classes = classTokensOf(
			openingTagOf(source, "<tbody", "the per-market group body"),
		);
		const why =
			`${TABLE_FILE}: the per-market <tbody> carries no phone-width override, ` +
			`so the tiles inside one market never become a stack. This site is an ` +
			`ADD, not an append — the element carries no className at all today — ` +
			`which is why it can be missed while the other three land. Add ` +
			`${phone("flex")} and ${phone("flex-col")} — and NOT ${phone("gap-3")}, ` +
			`which round five removed when the row separator became a hairline on ` +
			`each row's own top edge.`;
		expect(classes, why).not.toBeNull();
		expect(classes ?? [], why).toContain(phone("flex"));
		expect(classes ?? [], why).toContain(phone("flex-col"));
		expect(classes ?? [], why).not.toContain(phone("gap-3"));
	});

	/**
	 * Edit site 4 — the load-bearing one, and the one MOBILE-2e turns around.
	 *
	 * ⚠⚠ **JOB B MADE THIS ROW A COLUMN; ROUND FIVE MAKES IT A ROW AGAIN.** Job
	 * B's bet was that `flex-col` on the `<tr>` blockifies all six `<td>`
	 * variants without opening a single cell — which it does, and which is
	 * exactly why every cell then kept its inherited `text-center` and the phone
	 * got a stack of centred tiles. The founder's ruling is that the phone should
	 * read the DESKTOP row: side glyph │ argument │ value │ SELL. So the axis
	 * stays flex and the DIRECTION goes back to row, and the cells ARE opened —
	 * each takes a phone width, because a four-column row inside 278px cannot be
	 * derived from cells that were never given one.
	 *
	 * ⛔ THE SEPARATOR IS ASSERTED HERE TOO, because it is the other half of the
	 * same decision and it is the half that can silently not happen: the outline
	 * must be SUPPRESSED and a top border must take over, or the rows are
	 * individually outlined cards with no space between them — worse than either
	 * shape on its own.
	 */
	it("profile-mobile::a-tile-is-the-DESKTOP-row-below-640-not-a-centred-tile", () => {
		const source = stripComments(read(TABLE_FILE));
		const classes = classesOf(
			source,
			keyedTestid("position-tile-"),
			"the argument tile row",
		);

		const why =
			`${TABLE_FILE}: the tile <tr> is no longer the DESKTOP row at phone ` +
			`width. It must carry ${phone("flex")} WITHOUT ${phone("flex-col")} — ` +
			`round five reverses Job B's axis, because a column of cells inherits ` +
			`each cell's \`text-center\` and produces the centred tile this ` +
			`refinement replaces. The tokens belong in the row's own class string, ` +
			`not inside the \`selected ? … : …\` interpolation, where they would ` +
			`apply only while a tile is selected.`;
		expect(classes, why).toContain(phone("flex"));
		expect(classes, why).not.toContain(phone("flex-col"));
		expect(classes, why).toContain(phone("items-center"));
		// ⛔⛔ AND NOT INSIDE THE ROW'S INTERPOLATION EITHER, which is what the
		// paragraph above already says and what neither reader could see.
		// `classTokensOf` strips the `selected ? … : …` branch BY DESIGN, and the
		// other file's reader splits on whitespace and receives the token with its
		// quote still attached (`"max-mobile:flex-col`), so `toContain` misses it.
		// Two readers, opposite blind spots, one hole — and re-adding the token in
		// the selected branch (a centred tile that returns the moment a reader
		// clicks one) was GREEN across the whole unit suite.
		// ⚠ SCOPED TO THIS ROW'S OPENING TAG, not to the file: the `<table>` and
		// the `<tbody>` ARE columns at phone width, correctly and deliberately, so
		// a file-wide negative here asserts the opposite of what the round ruled.
		expect(
			openingTagOf(
				source,
				keyedTestid("position-tile-"),
				"the argument tile row",
			).includes(phone("flex-col")),
			`${why} ⚠ This form reads the row's WHOLE opening tag, so it fires on ` +
				`the token hidden inside the interpolation too.`,
		).toBe(false);

		const sep =
			`${TABLE_FILE}: the phone row separator is incomplete. Below 640px the ` +
			`outline must be SUPPRESSED (${phone("[outline:none]")}) and a hairline ` +
			`must take over on the row's own top edge ` +
			`(${phone("[border-top:var(--hairline)]")}). Half of this pair is worse ` +
			`than neither: the outline alone leaves individually boxed rows with no ` +
			`gap between them, and the border alone leaves two edges per seam.`;
		expect(classes, sep).toContain(phone("[outline:none]"));
		expect(classes, sep).toContain(phone("[border-top:var(--hairline)]"));
	});

	/**
	 * ⛔ THE CELLS ARE OPENED, AND THAT IS THE LINE JOB B DELIBERATELY DID NOT
	 * CROSS — so it is asserted rather than assumed. A four-column row inside
	 * 278px needs each cell to declare its share; without the widths the row is
	 * four cells fighting over one line and the argument is what loses.
	 */
	it("profile-mobile::each-cell-declares-its-share-of-the-phone-row", () => {
		const source = stripComments(read(TABLE_FILE));
		const side = classesOf(
			source,
			keyedTestid("tile-side-"),
			"the side cell's own span",
		);
		// The cell is the <td> WRAPPING that span, so read the tag before it.
		const at = source.indexOf(keyedTestid("tile-side-"));
		const tdAt = source.lastIndexOf("<td", at);
		const tdClasses = classTokensOf(
			source.slice(tdAt, source.indexOf(">", tdAt) + 1),
		);
		const why =
			`${TABLE_FILE}: the side cell does not claim a width at phone tier, so ` +
			`the argument beside it cannot be the flexible one. It needs a ` +
			`phone-tier width and ${phone("shrink-0")}.`;
		expect(tdClasses ?? [], why).toContain(phone("w-12"));
		expect(tdClasses ?? [], why).toContain(phone("shrink-0"));
		expect(tdClasses ?? [], why).toContain(phone("p-0"));
		// POSITIVE CONTROL — the reader above really does find a class list.
		expect(side, "the side span itself is still readable").not.toBeNull();
	});
});

// ── 2 · Override, never replace (ADR-0045's surviving convention) ─────────────

describe("profile mobile reflow — every desktop declaration survives", () => {
	/**
	 * ⚠ ASSERTED, NOT ASSUMED — the plan says so in those words. "Zero desktop
	 * regression is structural because every token is variant-prefixed" is an
	 * argument about the tokens ADDED; it says nothing about tokens REMOVED, and
	 * a one-character diff that swaps `table-fixed` for the new tokens instead
	 * of appending to them satisfies every assertion in the block above.
	 *
	 * ⛔ `table-fixed` IS WHAT MAKES THE WIDTHS BIND. Without it a `<th>` width
	 * is a hint the auto layout may overrule from cell content — measured once
	 * already on this very surface, where a 118px Current column rendered at
	 * 86px and broke a Đ figure mid-value (AGENTS.md §8).
	 */
	it("profile-mobile::the-table-keeps-w-full-table-fixed-and-its-type-scale", () => {
		const source = stripComments(read(TABLE_FILE));
		const classes = classesOf(
			source,
			'data-testid="positions-table"',
			"the positions table itself",
		);

		expect(
			classes,
			`${TABLE_FILE}: the table lost \`w-full\`, so it no longer fills the ` +
				`panel body at any width.`,
		).toContain("w-full");
		expect(
			classes,
			`${TABLE_FILE}: the table lost \`table-fixed\`. It becomes inert below ` +
				`640px because \`table-layout\` applies only to table boxes — that is ` +
				`not the same as removing it, and removing it un-binds all four ` +
				`column widths at 1440px.`,
		).toContain("table-fixed");
		expect(classes).toContain("text-left");
		expect(classes).toContain("text-sm");
	});

	/**
	 * All four declared widths, INCLUDING BOTH OF THE CLOSED TAB'S. `w-[92px]`
	 * is authored twice — Staked and Opened — and a count is what distinguishes
	 * "both survive" from "one survives"; a `toContain` cannot tell them apart.
	 * ⚠ The Closed tab's 96+92+92 is the arithmetic ADR-0048 never measured and
	 * this job's correction 1 exists for, which is why its two widths get the
	 * count rather than the membership check.
	 */
	it("profile-mobile::all-four-column-widths-survive-including-the-Closed-tabs-two", () => {
		const source = stripComments(read(TABLE_FILE));
		const open = uniqueIndexOf(source, "<thead", "the column-header row");
		const head = source.slice(open, source.indexOf("</thead>", open));

		expect(head).toContain("w-[96px]");
		expect(head).toContain("w-[124px]");
		expect(head).toContain("w-[104px]");
		expect(
			head.split("w-[92px]").length - 1,
			`${TABLE_FILE}: the Closed tab's two 92px widths (Staked and Opened) no ` +
				`longer both appear. They are the widths whose arithmetic — 96 + 92 + ` +
				`92 = 280 inside 317 — leaves the Closed tab's Argument column at ` +
				`≈37px, which is the measurement ADR-0048 never took and this job's ` +
				`correction 1 exists for.`,
		).toBe(2);
	});
});

// ── 3 · The two Closed-tab labels (plan §4.3 / OQ-2) ─────────────────────────

describe("profile mobile reflow — the Closed card labels its two bare figures", () => {
	/**
	 * ⛔ THE POINT OF THIS TEST IS THAT NO COPY IS AUTHORED, AND BYTE-IDENTITY IS
	 * WHAT MAKES THAT CHECKABLE RATHER THAN CLAIMED. The founder's reasoning,
	 * recorded because it is the test a later reader should apply: `Đ 100` above
	 * a bare date is not self-describing; `Đ 227 ↑12%` beside a Sell button is.
	 * So the Closed card gets labels and the Open card does not — and the labels
	 * carry the `<th>` strings the phone just lost rather than new words.
	 *
	 * ⚠ BOTH SIDES ARE READ FROM SOURCE. Neither `Staked` nor `Opened` is typed
	 * in this test. The `<th>` text comes from the `<thead>`; the label text comes
	 * from the `<td>`; the `tile-<slug>-*` testid joins them. A test that typed
	 * the literal on both sides would pass on a tree where both had drifted,
	 * which is the failure "no copy is authored" is about. ⚠ The LITERAL copy is
	 * pinned one file over, by `arrangement.test.tsx`'s
	 * `grid::the-CLOSED-tab-is-Position-Argument-Staked-Opened` — so a joint
	 * drift reddens there, not here, and that division is deliberate.
	 *
	 * ⚠ "Byte-identical" is applied as JSX itself applies it: both sides are
	 * trimmed, exactly as `arrangement.test.tsx` trims the same six headers
	 * through `textContent`. Nothing else is normalised.
	 */
	it("profile-mobile::the-two-labels-byte-carry-their-th-strings-so-no-copy-is-authored", () => {
		const source = stripComments(read(TABLE_FILE));

		for (const slug of LABELLED_CLOSED_CELLS) {
			const header = headerFor(source, slug);
			const label = gatedLabelIn(closedCellWindow(source, slug));

			expect(
				label,
				`${TABLE_FILE}: the Closed tab's \`${slug}\` cell carries no ` +
					`phone-width label. Below 640px the <thead> is hidden, so this cell ` +
					`renders a bare figure with nothing naming it — \`Đ 100\` above a ` +
					`bare date. Add a span inside this <td> carrying ` +
					`${phone("inline")} and the text "${header}", byte-carried from the ` +
					`<th> it replaces. ⛔ Do NOT author new copy, and do NOT add an ` +
					`Open-tab label to rescue the Current InfoTip — that is ruled lost ` +
					`(plan §4.4, OI-6).`,
			).not.toBeNull();

			expect(
				label?.text,
				`${TABLE_FILE}: the \`${slug}\` label reads "${label?.text}" where its ` +
					`own <th> reads "${header}". The label exists precisely so that no ` +
					`copy is authored for the phone: it must carry the column header's ` +
					`string verbatim, not a paraphrase of it.`,
			).toBe(header);
		}
	});

	/**
	 * ⚠ THE GATE IS TWO TOKENS, AND ONLY ONE OF THEM IS THE VARIANT. A `<span>`
	 * is inline by DEFAULT, so the variant token alone is a no-op and the label
	 * would render at every width — printing `Staked Đ 100` under a `<th>`
	 * already reading `Staked` at 1440px, i.e. the desktop regression this whole
	 * convention exists to prevent, shipped by the mechanism meant to prevent it.
	 * The base `hidden` is what gives the variant something to override.
	 *
	 * ⛔ THIS IS THE ONE PLACE JOB B ADDS AN UNPREFIXED CLASS, AND IT IS WHY THE
	 * "no unprefixed class" check below is scoped to the four §4.2 elements
	 * rather than to the file. The label is a NEW element; its base `hidden`
	 * changes nothing that renders today.
	 */
	it("profile-mobile::both-labels-are-hidden-at-640-and-above-where-the-th-already-says-it", () => {
		const source = stripComments(read(TABLE_FILE));

		for (const slug of LABELLED_CLOSED_CELLS) {
			const label = gatedLabelIn(closedCellWindow(source, slug));
			expect(
				label,
				`${TABLE_FILE}: the Closed tab's \`${slug}\` cell carries no element ` +
					`with ${phone("inline")}.`,
			).not.toBeNull();
			expect(
				label?.classes ?? [],
				`${TABLE_FILE}: the \`${slug}\` label carries ${phone("inline")} but ` +
					`no base \`hidden\`, so it renders at EVERY width — a span is inline ` +
					`already, which makes the variant token a no-op and prints the ` +
					`label beside the <th> that already says it at 1440px. If a ` +
					`different mechanism was chosen deliberately, re-derive this ` +
					`assertion rather than dropping it.`,
			).toContain("hidden");
		}
	});

	/**
	 * ⛔ THE `Staked` TIP MUST RIDE THE LABEL, AND NOTHING ELSE HERE PINNED IT.
	 * Plan §4.4 / OQ-3 rules that `GLOSSARY.stakedOwn` survives phone width by
	 * moving onto the new label, because the `<thead>` that carries it is
	 * `display:none` below 640px. The Open tab's `GLOSSARY.currentValue` tip is
	 * ruled LOST in the same breath — so this assertion is what distinguishes the
	 * tip that was KEPT by decision from the one that was DROPPED by decision.
	 *
	 * ⚠ MINTED FROM A MUTATION THAT SHOULD HAVE REDDENED AND DID NOT: deleting
	 * the `<InfoTip>` wrapper from around the Staked label left this suite at
	 * 9/9 green. A ruling nothing asserts is a ruling that survives exactly as
	 * long as nobody edits the file.
	 *
	 * ⚠ IT PINS THE CONTENT REFERENCE, NOT THE TOOLTIP'S BEHAVIOUR. That the tip
	 * OPENS on tap is INFO-1's property and needs a browser; jsdom performs no
	 * layout and this file observes none. What it can check is that the cell
	 * still names the glossary entry, which is the part a careless edit removes.
	 */
	it("profile-mobile::the-Staked-tip-rides-its-new-label-since-the-thead-is-gone", () => {
		const source = stripComments(read(TABLE_FILE));
		const staked = closedCellWindow(source, "staked");
		const opened = closedCellWindow(source, "opened");

		expect(
			staked,
			`${TABLE_FILE}: the Closed tab's staked cell no longer references ` +
				`GLOSSARY.stakedOwn. Below 640px the <thead> that carried that tip is ` +
				`hidden, so plan §4.4 (OQ-3) moves it onto the cell's new label. ` +
				`Without it the phone loses a tip the ruling explicitly KEPT — and the ` +
				`only tip that ruling drops is the Open tab's currentValue.`,
		).toContain("GLOSSARY.stakedOwn");

		// ⚠ The negative half. `Opened` never had a tip on its `<th>`, so adding
		// one here would be authoring a glossary affordance the desktop surface
		// does not have, on the narrower surface.
		expect(
			opened,
			`${TABLE_FILE}: the Closed tab's opened cell now references a GLOSSARY ` +
				`entry. That column's <th> carries no tip, so this adds an affordance ` +
				`the desktop surface never had rather than preserving one.`,
		).not.toContain("GLOSSARY.");
	});
});

// ── 4 · No unprefixed class is added (plan §4.2) ──────────────────────────────

describe("profile mobile reflow — the diff adds no unprefixed class", () => {
	/**
	 * ⛔⛔ READ WHAT THIS COVERS BEFORE TRUSTING IT — it is deliberately NARROWER
	 * than the plan's sentence "this job adds no unprefixed class anywhere", and
	 * writing an assertion that looked as broad as that sentence would be the
	 * worse of the two mistakes available here.
	 *
	 * WHAT IT COVERS: on each of the FOUR elements §4.2 names, the set of class
	 * tokens NOT carrying the phone variant is exactly what it was before this
	 * job. That is both halves of override-never-replace at once — nothing
	 * unprefixed added (so ≥640px is untouched), nothing removed (so the desktop
	 * declarations survive) — on the only four nodes this job is authorised to
	 * open.
	 *
	 * WHAT IT DOES NOT COVER, and each of these is a real hole rather than a
	 * hedge:
	 *   · Any OTHER element in `PositionsTable.tsx`. An unprefixed class added
	 *     to a `<td>`, to `PositionsPanel` or to `InlineSell` passes this.
	 *   · The two NEW label spans, which necessarily carry an unprefixed base
	 *     `hidden` (see the test above) and are excluded by construction.
	 *   · Any other file. This suite opens exactly one.
	 *   · Tokens inside the `<tr>`'s `selected ? … : …` interpolation, which
	 *     `classTokensOf` strips.
	 *
	 * ⚠ AND IT IS A REGRESSION GUARD, NOT A TDD DRIVER — `_probe-*` posture
	 * (AGENTS.md §9). On the pre-implementation tree the delta is empty and this
	 * passes VACUOUSLY. It can only ever fail against an implementation, which is
	 * the whole reason it is written before one exists.
	 */
	it("profile-mobile::the-unprefixed-class-list-of-all-four-elements-is-unchanged", () => {
		const source = stripComments(read(TABLE_FILE));

		const sites: ReadonlyArray<
			readonly [anchor: string, what: string, base: readonly string[]]
		> = [
			['data-testid="positions-table"', "the table", TABLE_BASE],
			["<thead", "the column-header row", THEAD_BASE],
			["<tbody", "the per-market group body", TBODY_BASE],
			[keyedTestid("position-tile-"), "the argument tile row", TR_BASE],
		];

		for (const [anchor, what, base] of sites) {
			const tokens =
				classTokensOf(openingTagOf(source, anchor, what)) ?? ([] as string[]);
			const unprefixed = tokens.filter((t) => !t.startsWith(PHONE));

			expect(
				[...unprefixed].sort(),
				`${TABLE_FILE}: ${what}'s unprefixed class list changed. Every token ` +
					`this job adds must carry the phone variant, which is what makes ` +
					`"zero desktop regression" structural rather than something to ` +
					`re-measure — a variant-prefixed token cannot match at ≥640px, and ` +
					`an unprefixed one applies at every width. Removals fail here too: ` +
					`replacing a desktop declaration instead of appending to it is the ` +
					`same defect from the other side.`,
			).toEqual([...base].sort());
		}
	});
});
