import { InfoTip } from "@/components/ui/info-tip";

import {
	COMPACT_FROM_MARKET_TOTAL,
	dharmaExactHint,
	formatDharmaCompact,
} from "./format";

/**
 * UI-OVERNIGHT entry 1a — ONE HEADER-STAKE FIGURE, rendered once and shared by
 * every card head that carries one: the debate surface's `ArgProfile` (post
 * card, focused post, reply card and both pop-ups) and the profile surface's
 * `PresentHead` (list card and replica). It prints the ABBREVIATED spelling and
 * carries the exact figure as its tooltip.
 *
 * ⛔ A COMPONENT RATHER THAN A CALL-SITE PATTERN, for the reason this repo has
 * already paid for twice: the two head clusters had drifted apart before (no
 * avatar, no entry price, a differently-placed cluster), and every rule that
 * lives at a call site is a rule the next call site can miss. "Abbreviate, then
 * attach the exact value, but only when the two differ" is three decisions; one
 * implementation is what keeps four render sites agreeing on all three.
 *
 * ⚠ THE TOOLTIP IS CONDITIONAL, and that is the point of it. A figure that
 * already renders exactly needs no second copy of itself — an unconditional
 * tooltip would put `Đ 550` on top of `Đ 550` on most cards on the surface and
 * teach the reader that the affordance means nothing.
 *
 * ⚠ `InfoTip`, NOT A NATIVE `title`. Two reasons, and the first is the binding
 * one: `tests/unit/design/relative-time-placement.test.tsx` bans the literal
 * `title=` from `ArgProfile.tsx` and `HeroPanels.tsx` — the files likeliest to
 * spell an absolute timestamp into a tooltip — and that exemption is sized to a
 * measurement, so widening it for an unrelated feature would open the hole it
 * was narrowed to close. Second, `title` does not open on tap at all (INFO-1),
 * so on a phone the exact figure would be unreachable rather than merely
 * inconvenient.
 *
 * ⚠ `asChild` — the tip MERGES onto the figure and introduces no DOM node.
 * `tests/unit/debate/render/dharma-spacing.test.tsx` asserts this element's own
 * `innerHTML` holds the contiguous string `Đ 1,500` (PD-3-07), so the glyph and
 * the number have to stay one uninterrupted pair of text nodes inside one span.
 */
export function CompactDharmaFigure({
	value,
	className,
	testId,
}: {
	/** A NUMERIC(38,18) Đ string — the canonical server value, never a display one. */
	value: string;
	className?: string;
	testId?: string;
}) {
	const figure = (
		<span data-testid={testId} className={className}>
			Đ {formatDharmaCompact(value)}
		</span>
	);
	// ⚠ THE "ONLY WHERE THE SHORT FORM HIDES SOMETHING" RULE MOVED TO
	// `dharmaExactHint` and is not re-decided here. It was a call-site pattern for
	// exactly as long as there was one call site; the market stat line is the
	// second, and a rule spelled twice is a rule that drifts once.
	const hint = dharmaExactHint(value);
	if (hint === null) {
		return figure;
	}
	return (
		<InfoTip content={hint} asChild>
			{figure}
		</InfoTip>
	);
}

/**
 * The market stat line's staked TOTAL — the number ALONE, with no `Đ` glyph, and
 * the same conditional exact-value tooltip `CompactDharmaFigure` carries.
 *
 * ⛔ NO GLYPH, AND THAT IS WHY THIS IS A SECOND COMPONENT RATHER THAN A PROP ON
 * THE FIRST. All three stat-line surfaces already own their `Đ`: `StatLine` hangs
 * the `GLOSSARY.dharma` gloss on it, and `FocusMarketCard` spells it inline
 * inside a `Đ … staked` phrase. Swallowing the glyph here would either delete a
 * wired info affordance or split a phrase that reads as one.
 *
 * ⚠⚠ IT RENDERS NO ELEMENT AT ALL WHEN THERE IS NOTHING TO REVEAL, and that is
 * deliberate rather than incidental. Below the threshold the compact and exact
 * spellings agree, so a wrapper would buy nothing and cost something real: the
 * surrounding phrase stops being one contiguous run of text nodes, which is what
 * `getByText("Đ 150 staked")` and every `innerHTML` ordering assertion in
 * `market-header.test.tsx` match on. A fragment keeps the small case
 * byte-identical to what shipped and confines the new markup to the large one.
 *
 * ⚠ `COMPACT_FROM_MARKET_TOTAL`, not the header-stake threshold — see the two
 * constants' own docblock for why a total abbreviates a decade earlier than a
 * stake does.
 */
export function MarketTotalDharma({ value }: { value: string }) {
	const compact = formatDharmaCompact(value, COMPACT_FROM_MARKET_TOTAL);
	const hint = dharmaExactHint(value, COMPACT_FROM_MARKET_TOTAL);
	if (hint === null) {
		return <>{compact}</>;
	}
	return (
		<InfoTip content={hint} asChild>
			<span>{compact}</span>
		</InfoTip>
	);
}
