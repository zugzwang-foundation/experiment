import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * MOBILE-2l · R-4 — THE IDENTITY BLOCK IS TWO LINES AT PHONE WIDTH, WITH BOTH
 * CHIPS PRESENT AND A 20-CHARACTER PSEUDONYM.
 *
 * The ruled shape:
 *   line 1 — pseudonym · position chips · the export affordance
 *   line 2 — the meta row (side badge · Đ stake · Replies · age)
 * The PSEUDONYM is the element that yields (`min-width:0` + an ellipsis); the
 * chips and the icon never shrink; and `Flipped`/`Exited` and `Sold` read as ONE
 * chip style at phone — same size, same case, same weight, same tracking, same
 * padding, same ground.
 *
 * ⛔⛔ WHY THIS IS A SOURCE SCAN AND NOT A RENDER TEST, AND WHAT THAT COSTS.
 * "At most two lines" is a LAYOUT fact and jsdom performs no layout: no media
 * query, no flex, no wrapping, no Tailwind utility, no text measurement. A
 * render test structurally cannot count the lines this block occupies, cannot
 * see an ellipsis, and cannot see a chip being squeezed. **This file proves that
 * the tokens which produce that shape are authored on the right nodes of the
 * right files, and nothing else.** Whether a 20-character pseudonym beside two
 * chips then fits one line at 360px is a browser measurement and belongs to the
 * plan's B-series. Every design guard in this repo has this shape
 * (`profile-mobile-reflow.test.ts`, the three height chains); it is stated here
 * so the suite is not read as proof of the fix.
 *
 * ⛔ NO `max-mobile:`-SHAPED LITERAL APPEARS IN THIS FILE. Tailwind v4's source
 * detection scans `tests/`, so a variant-form literal here would EMIT that
 * utility into the built stylesheet and any later check that greps the sheet to
 * prove a component compiled would be self-fulfilling (AGENTS.md §8, measured:
 * `opacity-0` under this variant reached the built sheet from a test file and
 * from no `src/` file). The prefix is therefore ASSEMBLED AT RUNTIME below.
 * ⚠ The UNPREFIXED names (`truncate`, `min-w-0`, `shrink-0`, `normal-case`,
 * `font-normal`, `tracking-normal`, `text-[11px]`) are safe by a DIFFERENT
 * argument, not the same one: each is already authored in `src/` — measured at
 * this file's writing, 27 / 29 / 49 / 4 / 5 / 8 / 29 files — so scanning this
 * file re-emits a rule that already exists. Re-measure with:
 *
 *   git grep -l -- '<name>' -- 'src/*' | wc -l
 *
 * ⚠⚠ A CLASS STRING IS READ OUT OF ITS OWN `className=` ATTRIBUTE, NEVER OUT OF
 * THE FILE AT LARGE. `ArgProfile.tsx` is dense with docblocks that NAME these
 * tokens — including one that says a token "IS GONE FROM HERE" — so a scan for
 * the bare string would be satisfied by the comment explaining the absence. Six
 * source-scan guards in this repo have been bitten that way. `classesAt` below
 * anchors on a unique SYMBOL and then reads the first `className=` string after
 * it, which a comment cannot inhabit.
 *
 * ⚠ ANCHORED BY SYMBOL, NEVER BY LINE OR BY CHARACTER WINDOW (`O-8`): the slice
 * runs from the anchor to the end of the file, so nothing here fences by
 * distance.
 *
 * ⛔ THIS REVERSES A WRITTEN RULING AND THE RULING'S OWN SITE STILL STATES IT.
 * `ArgProfile.tsx`'s pseudonym carries a docblock reading "UI-OVERNIGHT entry 1b
 * rule 8 — NEVER TRUNCATED … a pseudonym is the one field on this row that IS a
 * person, and half of one identifies nobody. Group A may overflow a narrow card
 * instead; that is the trade, made deliberately." MOBILE-2l's R-4 makes the
 * pseudonym the yielding element, which is the opposite trade. The plan takes
 * that decision; this file tests it; and the superseded paragraph must be
 * rewritten at its own site in the same commit rather than left contradicting
 * the code beneath it (`O-5`, `O-9`).
 */

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

const ARG_PROFILE = "src/components/debate/ArgProfile.tsx";
const BADGES = "src/components/debate/badges.tsx";
const DOWNLOAD = "src/components/debate/DownloadPostImage.tsx";
/** ⚠ The shadcn PRIMITIVE, which is a different file from `debate/badges.tsx`. */
const BADGE_PRIMITIVE = "src/components/ui/badge.tsx";

/**
 * The phone variant, ASSEMBLED — see the ⛔ paragraph above. Two constants
 * rather than one literal so no token in this file is class-shaped for
 * Tailwind's scanner to find.
 */
const VARIANT = "max-mobile";
const SEP = ":";
/** `phone("truncate")` — the variant-prefixed class token, built at runtime. */
const phone = (utility: string) => VARIANT + SEP + utility;

/**
 * The class tokens on the element whose declaration FOLLOWS `anchor`.
 *
 * Handles both spellings this tree uses — `className="…"` and
 * `className={cn("…", …)}` — by taking the first quoted string after the
 * attribute, skipping any `//` lines between the two (the `cn(` form puts them
 * there).
 */
function classesAt(source: string, anchor: string): string[] {
	const at = source.indexOf(anchor);
	expect(at, `anchor not found: ${anchor}`).toBeGreaterThanOrEqual(0);
	const after = source.slice(at);
	const match = /className=\{?(?:cn\()?\s*(?:\/\/[^\n]*\n\s*)*"([^"]*)"/.exec(
		after,
	);
	expect(match, `no className after: ${anchor}`).not.toBeNull();
	return (match?.[1] ?? "").split(/\s+/).filter(Boolean);
}

/**
 * The first quoted class string after `anchor` — for declarations that are not
 * `className=` attributes at all (`cva("…")`, a variant map's `secondary: "…"`).
 */
function tokensAfter(source: string, anchor: string): string[] {
	const at = source.indexOf(anchor);
	expect(at, `anchor not found: ${anchor}`).toBeGreaterThanOrEqual(0);
	const match = /"([^"]*)"/.exec(source.slice(at + anchor.length));
	expect(match, `no class string after: ${anchor}`).not.toBeNull();
	return (match?.[1] ?? "").split(/\s+/).filter(Boolean);
}

/** The `Badge` primitive's base class string — what every variant starts from. */
const badgeBase = () => tokensAfter(read(BADGE_PRIMITIVE), "cva(");

/**
 * ⚠ A CHIP'S CLASSES ARE THE UNION OF ITS OWN DECLARATION AND ITS CALL SITE,
 * because `PositionMarker` takes an additive `className` (minted MOBILE-2e ·
 * R-Q1 so the caller can place the chip) and either end is a legitimate home
 * for a phone token. Asserting on one alone would forbid an implementation for
 * a reason this contract does not have.
 */
function positionMarkerClasses(): string[] {
	return [
		...classesAt(read(BADGES), "export function PositionMarker"),
		// ⚠ ANCHORED ON THE SYMBOL, NOT ON A SPELLING (`O-8`). This read
		// `"<PositionMarker marker={marker}"` and went red the moment the call
		// site became multi-line — a formatting change, not a behavioural one.
		// A guard that a `biome format` can redden is fencing by distance in
		// another unit. The component NAME is the durable anchor.
		...classesAt(read(ARG_PROFILE), "<PositionMarker"),
	];
}

function soldChipClasses(): string[] {
	return classesAt(read(ARG_PROFILE), 'data-testid="argstake-sold"');
}

function pseudonymClasses(): string[] {
	return classesAt(read(ARG_PROFILE), "encodeURIComponent(author.pseudonym)");
}

/** One arbitrary size, stated with its own leading — AGENTS.md §8's rule. */
const CHIP_SIZE = phone("text-[11px]");
const statesALeading = (classes: string[]) =>
	classes.some((c) => c.startsWith(phone("leading-[")));

describe("MOBILE-2l · R-4 — the pseudonym is the element that yields", () => {
	it("phone-identity::the-pseudonym-takes-min-width-0-and-an-ellipsis", () => {
		// ⛔ BOTH TOKENS OR NEITHER. A flex item's `min-width` is `auto` by
		// default, which is the item's own min-content size — so `truncate`
		// (`overflow:hidden` + `text-overflow:ellipsis` + `white-space:nowrap`)
		// alone cannot make the pseudonym narrower than its longest word, and the
		// chips beside it get squeezed instead. `min-w-0` is what lets the box
		// shrink at all; the ellipsis is what makes the shrinking readable.
		const classes = pseudonymClasses();
		expect(classes).toContain(phone("min-w-0"));
		expect(classes).toContain(phone("truncate"));
	});

	it("phone-identity::the-pseudonym-still-sits-on-line-1-with-the-avatar's-inset", () => {
		// CONTROL — the tokens that already place it. If R-4's edit replaced
		// rather than appended, these would go with it and the block would reflow
		// somewhere nobody asked for.
		const classes = pseudonymClasses();
		expect(classes, "ordered onto line 1").toContain(phone("-order-2"));
		expect(classes, "the absolute avatar's reserved 32 + 8").toContain(
			phone("ps-10"),
		);
	});
});

describe("MOBILE-2l · R-4 — the chips and the icon never shrink", () => {
	it("phone-identity::the-Sold-chip-does-not-shrink-at-phone-width", () => {
		// ⛔ IT NEEDS ITS OWN TOKEN, and the reason is one level up: the chip's
		// wrapper is `contents` at phone width, so the wrapper's `shrink-0` stops
		// applying to it and the chip becomes a bare flex item of the wrapping
		// area at the default `flex-shrink: 1`.
		expect(soldChipClasses()).toContain(phone("shrink-0"));
	});

	it("phone-identity::the-position-marker-does-not-shrink-at-phone-width", () => {
		// ⚠ THE PROPERTY, NOT THE SPELLING. `Badge`'s base already carries an
		// UNPREFIXED `shrink-0`, which is live at every width — so demanding the
		// variant form would force a redundant class. Either spelling discharges
		// it; neither does not.
		const own = badgeBase().concat(positionMarkerClasses());
		expect(
			own.includes("shrink-0") || own.includes(phone("shrink-0")),
			"the marker chip holds its width",
		).toBe(true);
	});

	it("phone-identity::the-export-affordance-does-not-shrink-at-phone-width", () => {
		// CONTROL, and it is already true: `DownloadPostImage`'s root span
		// declares an unprefixed `shrink-0`. Pinned so the export mark cannot be
		// squeezed out of line 1 by a later edit to that file.
		const root = classesAt(read(DOWNLOAD), "export function DownloadPostImage");
		expect(
			root.includes("shrink-0") || root.includes(phone("shrink-0")),
			"the export mark holds its width",
		).toBe(true);
		expect(root, "and stays on the row's trailing edge").toContain("ml-auto");
	});
});

describe("MOBILE-2l · R-4 — one chip style at phone width", () => {
	it("phone-identity::Sold-drops-to-the-position-marker's-register", () => {
		// The three properties that differ today. `Sold` is `uppercase`,
		// `font-bold`, `tracking-[0.08em]`; `Flipped`/`Exited` are sentence case,
		// `font-normal`, no tracking. Two chips an inch apart in two registers
		// read as two different kinds of thing.
		const sold = soldChipClasses();
		expect(sold).toContain(phone("normal-case"));
		expect(sold).toContain(phone("font-normal"));
		expect(sold).toContain(phone("tracking-normal"));
	});

	it("phone-identity::both-chips-take-the-same-size-with-a-stated-leading", () => {
		// ⚠ AN ARBITRARY `text-[Npx]` DOES NOT RESET THE PAIRED LINE-HEIGHT
		// (AGENTS.md §8, measured on staging at PROFILE-FULL): the arbitrary form
		// inherits whatever step was in scope, so an 11px chip would keep a 16px
		// leading and stand taller than the line it is supposed to join. State the
		// leading whenever you state an arbitrary size.
		const sold = soldChipClasses();
		const marker = positionMarkerClasses();
		expect(sold, "the Sold chip's phone size").toContain(CHIP_SIZE);
		expect(marker, "the marker chip's phone size").toContain(CHIP_SIZE);
		expect(statesALeading(sold), "Sold states its leading").toBe(true);
		expect(statesALeading(marker), "the marker states its leading").toBe(true);
	});

	it("CONTROL — the two chips already share their padding and their ground", () => {
		// ⛔ THIS HALF OF THE CONTRACT IS ALREADY SATISFIED, and saying so is the
		// point: it keeps the edit to the three register tokens and the size,
		// rather than inviting a restyle of two chips that already agree.
		// Padding: both declare `px-1.5` over `Badge`'s `py-0.5`.
		const sold = soldChipClasses();
		const marker = positionMarkerClasses();
		expect(sold).toContain("px-1.5");
		expect(marker).toContain("px-1.5");
		expect(sold).toContain("py-0.5");
		expect(
			badgeBase(),
			"the marker inherits its vertical padding from the primitive",
		).toContain("py-0.5");

		// Ground: `bg-n1` and `bg-secondary` are ONE colour under two names —
		// `--secondary: var(--color-n1)` in `:root`. Resolved rather than asserted,
		// so a future re-point of `--secondary` reddens here instead of silently
		// splitting the pair.
		const css = read("src/app/globals.css");
		expect(
			/--secondary:\s*var\(--color-n1\)/.test(css),
			"the two chip grounds resolve to one token",
		).toBe(true);
		expect(sold).toContain("bg-n1");
		expect(
			tokensAfter(read(BADGE_PRIMITIVE), "secondary:"),
			"the marker's variant ground",
		).toContain("bg-secondary");
	});
});

describe("MOBILE-2l · R-4 — the two-line mechanism", () => {
	it("CONTROL — line 1's membership and the explicit break are still authored", () => {
		// ⛔ THE MECHANISM, NOT THE OUTCOME. Flexbox has no "break before this
		// item", so the block's two lines are produced by exactly two things: the
		// line-1 members carry a negative `order`, and a zero-height `basis-full`
		// item ordered between them and the rest fills the line and ends it.
		// jsdom cannot see the lines; it can see whether the mechanism is present,
		// and an R-4 edit that dropped either half would leave the chips stranded
		// on line 2 with the pseudonym alone above them.
		const source = read(ARG_PROFILE);
		const brk = classesAt(source, 'data-testid="argprofile-line-break"');
		expect(brk, "the break is not in the layout at all above 640px").toContain(
			"hidden",
		);
		expect(brk).toContain(phone("-order-1"));
		expect(brk).toContain(phone("basis-full"));
		expect(brk, "and claims no height of its own").toContain(phone("h-0"));

		// The three line-1 members sit AHEAD of the break.
		expect(pseudonymClasses()).toContain(phone("-order-2"));
		expect(positionMarkerClasses()).toContain(phone("-order-2"));
		expect(soldChipClasses()).toContain(phone("-order-2"));
		expect(
			classesAt(source, "<LaneBadge badge="),
			"the lane badge joins line 1 too",
		).toContain(phone("-order-2"));
	});

	it("CONTROL — the groups dissolve so the ordering can reach across them", () => {
		// `order` is a property of flex ITEMS. Until the two nested group boxes
		// dissolve, a chip is a child of a nested row and reordering moves it only
		// within that row. `contents` at phone width is what makes every field a
		// direct item of the wrapping area — the precondition for every `-order-*`
		// token above, and the thing most likely to be "tidied" away by someone who
		// reads it as redundant.
		const source = read(ARG_PROFILE);
		const dissolving = source
			.split("\n")
			.filter((line) => line.includes("className="))
			.filter((line) => line.includes(phone("contents"))).length;
		expect(
			dissolving,
			"the group boxes and the chip wrappers dissolve at phone width",
		).toBeGreaterThanOrEqual(4);
	});
});
