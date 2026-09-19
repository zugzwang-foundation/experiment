/**
 * The topic separator the live titles are written with — a MIDDLE DOT
 * (U+00B7) with a space either side, not a hyphen and not a bullet.
 */
const TITLE_SEPARATOR = " · ";

/**
 * `Math · Will 3 Erdős problems be solved by 5th November?` → its topic and
 * its question.
 *
 * ⛔ THE SPLIT LIVES HERE, NOT IN ANY RENDERER, and that is the same rule the
 * export's display strings follow: a renderer receives finished strings and
 * never parses one. A topic derived inside the JSX would be a second place
 * that knows what a title looks like, and the one that nothing tests.
 *
 * ⚠ `indexOf`, SO ONLY THE FIRST SEPARATOR SPLITS. A question is free to
 * contain its own middle dot — `Bitcoin · Will BTC ever go below $60,000` is
 * one topic and one question however many dots follow, and splitting on the
 * last would hand the chip a sentence.
 *
 * ⚠ `at <= 0` COVERS TWO CASES WITH ONE COMPARISON: no separator at all
 * (`-1`), and a title that OPENS with one (`0`), which would otherwise mint an
 * empty chip. Both pass the title through untouched, which is the safe
 * direction — a missing chip loses a word, a wrong split loses the question.
 *
 * ⛔⛔ IT LIVES IN `src/lib/` RATHER THAN IN THE EXPORT, AND THAT IS THE WHOLE
 * REASON THIS FILE EXISTS. It was `compose.ts`'s, and `compose.ts` imports
 * `FREEZE_INSTANT_UTC` from `@/server/markets/create` — a VALUE, not a type —
 * so reaching for the splitter from `MarketCard` (which ships in the client
 * graph via the carousel) would have pulled the `server-only` chain into the
 * browser bundle. Moving it is what keeps there being exactly ONE splitter:
 * the alternative was a second copy in the component, which is the failure
 * the paragraph above is written against. The export imports it from here and
 * behaves identically; `splitMarketTag` in `PositionsTable.tsx` is a
 * DIFFERENT function (it keeps the separator on `rest`) and is untouched.
 */
export function splitMarketTitle(title: string): {
	category: string | null;
	question: string;
} {
	const at = title.indexOf(TITLE_SEPARATOR);
	if (at <= 0) {
		return { category: null, question: title };
	}
	return {
		category: title.slice(0, at),
		question: title.slice(at + TITLE_SEPARATOR.length),
	};
}
