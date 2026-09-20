import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * ADR-0051 A13 D-4 — THE FIT LADDER, PINNED AT ITS LANDING VALUES.
 *
 * ⛔⛔ WHY A SOURCE SCAN AND NOT A MEASUREMENT, STATED FIRST BECAUSE IT IS THE
 * LIMIT. jsdom performs no layout, so nothing in this repo's test tree can
 * assert that the phone header FITS. The fit is a browser measurement and lives
 * in the round's report: at 360 signed out the row's natural content width is
 * 338.40px against a 336px content box — a 2.40px deficit the brand mark absorbs
 * (45.60px rather than 48), with the document reporting zero overflow; signed in
 * the deficit is 7.13px and the mark renders 40.87px. At 375 and above both arms
 * fit with the mark at its full 48px.
 *
 * ⇒ What a scan CAN hold is the input to that measurement: the five reductions
 * A13 D-4 names, at the values the ladder actually landed on. Any of them
 * growing back re-opens a deficit nothing in CI would otherwise see, because the
 * only symptom is a brand mark that silently squashes (ADR-0049 OI-A) — no
 * error, no scrollbar, and `document.scrollWidth === clientWidth` throughout.
 *
 * ⚠ THE NUMBERS ARE A RECORD OF A MEASUREMENT, NOT A DESIGN. Each is the rung
 * the ladder stopped on, and each is also stated in A13 D-4's own list. Changing
 * one is a decision that needs its own measurement at 360 — not an edit.
 *
 * ⛔ NO PHONE-VARIANT LITERAL APPEARS IN THIS FILE. Tailwind v4 scans `tests/`,
 * so a class-shaped literal here becomes a real emitted utility (AGENTS.md §8).
 * Every prefix and every utility is ASSEMBLED AT RUNTIME.
 */

const read = (p: string) => readFileSync(p, "utf8");
const HEADER = "src/components/shell/GlobalHeader.tsx";
const IDENTITY = "src/components/shell/IdentityCluster.tsx";
const RULES = "src/components/shell/RulesControl.tsx";
/**
 * ⚠ THE DESKTOP PILL REGISTER MOVED OUT OF `RulesControl.tsx` AT
 * MKT-ROSTER-1-P3, so the ≥640 half of the RULES row below reads THIS file
 * instead. `HEADER_PILL_BUTTON` is the byte-identical string RULES declared
 * privately, lifted so the new `X` control can wear the same pill — the same
 * move `HEADER_ICON_BUTTON` made out of `HeaderNav.tsx` at MOBILE-2n.
 * ⛔ THE ROW IS RE-POINTED, NOT RELAXED: `px-[13px]` is still asserted as a
 * literal, still against a shipped source file, and the phone half still reads
 * `RulesControl.tsx` because that is where the `max-mobile:` override lives.
 * Deleting the desktop half on the grounds that "it moved" is what would make
 * A13 D-4's additivity unguarded.
 */
const PILL = "src/components/shell/header-control.ts";
const DIGITS = "src/components/shell/CountdownDigits.tsx";

const V = "max-mobile";
const S = ":";
const phone = (utility: string) => V + S + utility;

/** `h-` + `[28px]` — never written as one scannable token. */
const util = (prefix: string, value: string) => `${prefix}-${value}`;
const px = (n: string) => `[${n}px]`;

describe("A13 D-4 — the ladder's five reductions are on disk at their landed values", () => {
	it("phone-a13::JOIN-yields-first—28px-tall-5px-sides-10px-type", () => {
		const source = read(IDENTITY);
		for (const token of [
			phone(util("h", px("28"))),
			phone(util("px", px("5"))),
			phone(util("text", px("10"))),
			// An arbitrary text size keeps the leading of the step it displaces
			// (AGENTS.md §8), so the box grows back without this.
			phone("leading-none"),
		]) {
			expect(
				source,
				`${IDENTITY}: the JOIN CTA no longer declares \`${token}\`. A13 D-4 ` +
					`makes this control the ladder's FIRST rung — "JOIN yields first" — ` +
					`and it is worth ~30px of the row at 360.`,
			).toContain(token);
		}
	});

	it("phone-a13::JOIN-keeps-a-44px-target-after-the-shrink", () => {
		// ⛔ B7. A 28px painted box is 16px under the floor, and this control is
		// the conversion button: it may get smaller to the EYE and never to the
		// THUMB. The region is bought at the hit-testing layer, so the painted box
		// stays 28px — measured at 45.00 × 56.27px by `elementFromPoint` in the
		// round's run, which is the number a scan cannot produce.
		const source = read(IDENTITY);
		expect(source).toContain(phone("relative"));
		expect(source).toContain(phone(`after${S}absolute`));
		expect(source).toContain(phone(`after${S}-inset-${px("8")}`));
		expect(
			source.includes(phone(`after${S}content-`)),
			`${IDENTITY}: the JOIN CTA's \`::after\` has no \`content\`, so the ` +
				`pseudo-element is never generated and the hit region silently ` +
				`collapses back to the 28px box.`,
		).toBe(true);
	});

	it("phone-a13::the-row-gap-is-5px-and-it-is-the-ONLY-gap-declared", () => {
		const source = read(HEADER);
		expect(
			source,
			`${HEADER}: the phone row gap is not 5px. A13 D-4 lands it there, and ` +
				`the row carries four gaps — each px is worth four.`,
		).toContain(phone(util("gap", px("5"))));
		// …and the wrappers stay flattened, which is what makes that ONE number
		// govern every gap in the row rather than one of three that agree by hand.
		expect(
			(source.match(new RegExp(phone("contents"), "g")) ?? []).length,
			`${HEADER}: the row no longer flattens BOTH zone wrappers. With either ` +
				`one a box, its children take that box's gap and the row's gap ` +
				`applies only between zones — "all gaps equal" then needs two numbers ` +
				`kept in step by whoever edits next.`,
		).toBe(2);
	});

	it("phone-a13::RULES-gives-3px-a-side-and-the-desktop-keeps-13", () => {
		// The phone override stays where the control is — it is `RulesControl`'s
		// own `cn()` arm, gated on `mobileResponsive`.
		expect(read(RULES)).toContain(phone(util("px", px("10"))));
		// …and the ≥640 value now lives in the shared register (see PILL above).
		expect(
			read(PILL),
			`${PILL}: the desktop tab lost its 13px sides. A13 D-4 is ADDITIVE — ` +
				`the ≥640 control takes zero diff (AGENTS.md §8). ⚠ This register was ` +
				`private to ${RULES} until MKT-ROSTER-1-P3 lifted it so the X control ` +
				`could wear the same pill; the assertion followed the string.`,
		).toContain(util("px", px("13")));
		// ⛔ AND THE CONTROL STILL WEARS IT. Re-pointing the scan to the register
		// proves the VALUE survived; this proves RULES is still the thing wearing
		// it, which the two halves apart could not say.
		expect(
			read(RULES),
			`${RULES}: the RULES tab no longer reads the shared pill register, so ` +
				`the 13px asserted above is a value nothing on this control uses.`,
		).toContain("HEADER_PILL_BUTTON");
	});

	it("phone-a13::the-countdown-cell-is-13x17-at-9.5px-and-the-desktop-cell-is-untouched", () => {
		const source = read(DIGITS);
		for (const token of [
			util("h", px("17")),
			util("w", px("13")),
			util("text", px("9.5")),
		]) {
			expect(
				source,
				`${DIGITS}: the phone scale no longer declares \`${token}\`. Eight ` +
					`cells means every px of cell width is worth 8px of row.`,
			).toContain(token);
		}
		expect(
			source,
			`${DIGITS}: the header scale's 20px cell is gone. The phone scale is a ` +
				`SEPARATE mount; the desktop chessboard's row 2 is dimensioned ` +
				`against \`Wordmark scale="header"\` and takes zero diff.`,
		).toContain("size-5");
		expect(source).toContain(util("text", px("13")));
	});

	it("phone-a13::every-one-of-those-tokens-is-GATED-on-the-prop", () => {
		// ⛔ THE GATE IS THE PROP CHAIN, NOT THE FILE BOUNDARY (AGENTS.md §8). An
		// ungated phone class in any of these three files reaches the `(auth)`
		// mount and every future mount at once — the failure recorded for
		// `OnboardingDeck`, which shipped three of them.
		// ⚠ `CountdownDigits` is deliberately NOT in this list and that is not an
		// oversight: its phone scale is chosen by a `scale` PROP, and the tokens
		// land on a node whose wrapper is `hidden` above 640. There is no
		// breakpoint class in that file to gate.
		// ⛔⛔ COMMENTS ARE REMOVED BEFORE THE SCAN, AND THIS IS NOT HOUSEKEEPING.
		// Written without it, the first thing this guard caught was `GlobalHeader`'s
		// own docblock sentence EXPLAINING that a hidden child is `display:none` —
		// prose containing the token, three lines from no gate. AGENTS.md records
		// six instances of exactly this: a source-scan negative catching the comment
		// that explains the absence. Strip first, match syntax, never a bare word.
		// ⚠ The blank-line replacement keeps line NUMBERS honest, so the failure
		// message still points at the real line in the real file.
		const strip = (src: string) =>
			src
				.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
				.replace(
					/(^|[^:])\/\/[^\n]*/g,
					(m, p1: string) => p1 + m.slice(p1.length).replace(/./g, " "),
				);
		for (const file of [HEADER, IDENTITY, RULES]) {
			const lines = strip(read(file)).split("\n");
			for (let i = 0; i < lines.length; i++) {
				const line = lines[i] ?? "";
				if (!line.includes(V + S)) continue;
				const window = lines.slice(Math.max(0, i - 4), i + 1).join("\n");
				expect(
					window.includes("mobileResponsive &&"),
					`${file}:${i + 1} carries a \`${V}${S}\` class that is not inside a ` +
						`\`mobileResponsive && "…"\` arm:\n  ${line.trim()}`,
				).toBe(true);
			}
		}
	});
});
