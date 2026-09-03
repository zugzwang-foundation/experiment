import { InfoTip } from "@/components/ui/info-tip";

import { formatDharma, formatDharmaCompact } from "./format";

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
	const compact = formatDharmaCompact(value);
	const exact = formatDharma(value);
	const figure = (
		<span data-testid={testId} className={className}>
			Đ {compact}
		</span>
	);
	if (compact === exact) {
		return figure;
	}
	return (
		<InfoTip content={`Đ ${exact}`} asChild>
			{figure}
		</InfoTip>
	);
}
