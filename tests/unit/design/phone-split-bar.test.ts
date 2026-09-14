import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * MOBILE-2l · R-3 — THE SUPPORT/COUNTER SPLIT BAR AT PHONE WIDTH: a 6px track
 * with fully-rounded ends, and three columns each centring its own stake figure.
 *
 * ⛔⛔ GREEN ON THE DAY IT WAS WRITTEN, DELIBERATELY, AND THAT IS THE WHOLE
 * POSTURE OF THIS FILE. The plan's recon measured the shipped build at 360px on
 * `/m/sp-m12-fill` and found R-3 ALREADY SATISFIED:
 *
 *     track height 6.00px (computed 5.99609, border-box, 0.625px hairline
 *       each side) — fill 4.75px
 *     border-radius 8px on a 6px bar ⇒ ends fully rounded
 *     three columns  [78.00, 138.79, 78.00]  centres 63.61 / 180.00 / 296.39
 *     figure centres 63.61 / 180.00 / 296.39  ⇒ Δ 0.00px on all three
 *
 * The brief asked for "6px, up from ~3", and ~3 matches neither the track (6.00)
 * nor the fill (4.75) — the phone height token (broken here so this docblock
 * emits nothing: `max-mobile` `:` `h-[6px]`) landed at MOBILE-2e · R-M2 and the
 * three figures have been centred by `items-center` since HTML-FINISH. So there
 * is NO EDIT to drive and no red to contrive: this is a `_probe-*`-POSTURE
 * REGRESSION GUARD, not a TDD driver (CLAUDE.md §5.6 draws that distinction;
 * MOBILE-2c's five phone-sheet guards are the precedent for writing one and
 * saying so). What it protects is a ruled measurement that nothing currently
 * asserts — and an unasserted measurement is one restyle away from being wrong
 * with no symptom but a bar that stops reading as a proportion.
 *
 * ⛔ WHAT IT IS NOT. It is not evidence that the bar renders at 6px: jsdom
 * performs no layout and this file opens no browser. It proves the tokens are
 * authored on the right node of the right file, and it proves ONE arithmetic
 * relation between two of them. The pixels are the plan's own measurement,
 * quoted above, and belong to it.
 *
 * ⚠ ITS NEIGHBOUR ALREADY OWNS THE DESKTOP HALF. `aggregate-footer-alignment.
 * test.ts` pins the 18px desktop thickness against `PriceBar`'s own declaration,
 * the `rounded-[var(--r)]` family membership, and `overflow-hidden`. Nothing
 * here duplicates those; this file is the PHONE tier's half, plus the
 * height↔radius relation neither file had.
 *
 * ⛔ NO `max-mobile:`-SHAPED LITERAL APPEARS IN THIS FILE — Tailwind v4's source
 * detection scans `tests/`, so a variant-form literal here would emit that
 * utility into the built stylesheet from a test file (AGENTS.md §8). The prefix
 * is ASSEMBLED AT RUNTIME. The unprefixed `h-[6px]` fragment is safe by the
 * other argument: it is already authored in `AggregateFooter.tsx` itself.
 *
 * ⚠ ANCHORED BY SYMBOL, NEVER BY LINE (`O-8`), and every class string is read
 * out of its own `className=` rather than out of the file at large — this
 * component's docblocks name `h-1.5`, `h-[14px]` and `h-[18px]` in prose, so a
 * bare-string scan would be satisfied by the comment recording a superseded
 * value.
 */

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

const FOOTER = "src/components/debate/AggregateFooter.tsx";
const GLOBALS = "src/app/globals.css";

const VARIANT = "max-mobile";
const SEP = ":";
const phone = (utility: string) => VARIANT + SEP + utility;

/** The phone track thickness this round ratifies, in px. */
const PHONE_TRACK_PX = 6;

/**
 * The class tokens declared on the element whose `className=` follows `anchor`.
 * Handles `className="…"` and `className={cn("…", …)}`, skipping the `//`
 * comment lines the `cn(` form puts between the two.
 */
function classesAt(source: string, anchor: string): string[] {
	const at = source.indexOf(anchor);
	expect(at, `anchor not found: ${anchor}`).toBeGreaterThanOrEqual(0);
	const match = /className=\{?(?:cn\()?\s*(?:\/\/[^\n]*\n\s*)*"([^"]*)"/.exec(
		source.slice(at),
	);
	expect(match, `no className after: ${anchor}`).not.toBeNull();
	return (match?.[1] ?? "").split(/\s+/).filter(Boolean);
}

const trackClasses = () =>
	classesAt(read(FOOTER), 'data-testid="aggregate-split-track"');

describe("MOBILE-2l · R-3 — the track is 6px at phone width", () => {
	it("phone-split-bar::the-track-declares-the-phone-thickness", () => {
		expect(trackClasses()).toContain(phone(`h-[${PHONE_TRACK_PX}px]`));
	});

	it("phone-split-bar::the-desktop-thickness-is-OVERRIDDEN-not-replaced", () => {
		// ADR-0045's first rule, at the one site this round touches: desktop stays
		// the unprefixed default and the phone rule is an ADDITIVE token beside it.
		// A build that swapped `h-[18px]` for the phone token would satisfy the row
		// above and silently take 12px off the 1440 render, which no phone
		// measurement would ever see.
		const classes = trackClasses();
		expect(classes, "the 1440 thickness is still declared").toContain(
			"h-[18px]",
		);
		expect(classes, "and the superseded one is still gone").not.toContain(
			"h-1.5",
		);
	});
});

describe("MOBILE-2l · R-3 — the ends are fully rounded at that thickness", () => {
	it("phone-split-bar::the-radius-is-at-least-half-the-phone-track-height", () => {
		// ⛔⛔ THE RELATION, NOT THE NUMBER. "Fully rounded ends" is not a class —
		// it is `border-radius >= height / 2`, at which point each end resolves to
		// a semicircle and any larger radius is clamped to the same shape. The
		// track carries `rounded-[var(--r)]` and `--r` is 8px, so at 6px the ends
		// are pills with 5px of headroom.
		// ⇒ Pinning the relation rather than either value is what makes this fail
		// for the right reason: raise the phone track past 16px, or re-point `--r`
		// below 3px, and the ends stop being round with nothing else changing.
		const classes = trackClasses();
		expect(classes, "the radius comes from the shared token").toContain(
			"rounded-[var(--r)]",
		);

		const declared = /--r:\s*(\d+(?:\.\d+)?)px/.exec(read(GLOBALS))?.[1];
		expect(declared, "`--r` is declared in px in :root").toBeDefined();
		const radius = Number(declared);
		expect(
			radius * 2,
			`a ${PHONE_TRACK_PX}px track needs a radius of at least ${PHONE_TRACK_PX / 2}px to read as a pill`,
		).toBeGreaterThanOrEqual(PHONE_TRACK_PX);
	});
});

describe("MOBILE-2l · R-3 — three columns, each figure centred under its own", () => {
	it("phone-split-bar::all-three-columns-centre-their-own-contents", () => {
		// d5's `.sidewrap` on BOTH flanks plus the centre. The shipped render once
		// flushed the two figures to the card's OUTER edges, so each amount sat
		// under a corner instead of under the pill it belongs to; `items-center` on
		// each column is what puts a figure's centre on its column's centre, which
		// is the measured Δ 0.00px the recon recorded.
		// ⚠ THE CENTRING ITSELF IS A LAYOUT FACT AND THIS IS NOT A MEASUREMENT OF
		// IT. What is asserted is that there are exactly three cross-axis-centring
		// columns in this component and that every one of them centres — so a
		// fourth column, or one that stops, reddens here.
		const source = read(FOOTER);
		const columns = Array.from(
			source.matchAll(/className="([^"]*\bflex-col\b[^"]*)"/g),
		).map((m) => m[1] ?? "");

		expect(columns, "Support · the bar · Counter").toHaveLength(3);
		for (const column of columns) {
			const tokens = column.split(/\s+/).filter(Boolean);
			expect(tokens, `column centres its contents: ${column}`).toContain(
				"items-center",
			);
			expect(tokens, "and stacks the pill over the figure").toContain("flex");
		}

		// The two flanks hold their width and the centre takes the rest — which is
		// what leaves the bar a column of its own for the figure to centre under.
		const flanks = columns.filter((c) => c.includes("shrink-0"));
		expect(
			flanks,
			"the two flanking columns are sized by their pills",
		).toHaveLength(2);
		const middle = columns.find((c) => c.includes("flex-1"));
		expect(middle, "the bar's column takes the remaining width").toBeDefined();
		expect(
			middle?.split(/\s+/),
			"and may shrink below its content, or the row overflows a 360px card",
		).toContain("min-w-0");
	});
});
