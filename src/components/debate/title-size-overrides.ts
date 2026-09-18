/**
 * Per-market type-size overrides for the market-detail question heading.
 *
 * **FOUNDER-RULED, PER MARKET. THIS IS NOT A LENGTH RULE AND MUST NOT BECOME
 * ONE.** A map keyed on slug is the whole point: a market is added here only by
 * ruling, and removing one is the same single line. The obvious alternative —
 * "step the size down when the title is longer than N characters" — is a rule
 * nobody ruled, it would move the other headings the moment a title is edited,
 * and it would decide typography from a character count on a proportional face,
 * where the same count is 549px of ink in one title and 694px in another (the
 * table below has both).
 *
 * ⛔ **NOT AN INLINE CONDITIONAL IN THE JSX EITHER.** `MarketHeader` renders every
 * market and should know about none of them; a `slug === "…"` in the class string
 * is the same exception spread across a component that has no other reason to name
 * a market.
 *
 * ## ⛔⛔ THE MAP IS EMPTY, AND THAT IS A RULING RATHER THAN A DELETION
 *
 * It held exactly one entry, for the one market MKT-ROSTER-1 (2026-09-18,
 * **D-49**) removed from the roster — a 19px size paired with a 1.24 leading.
 * ⚠ THE SLUG IS DELIBERATELY NOT WRITTEN HERE: D-49 requires that nothing of
 * either removed market survives in code outside `docs/`, and the decision
 * record is where its identity lives.
 * ⚠ The retired class string is described rather than quoted, so that a reader
 * restoring an exception has to re-measure and re-rule it instead of pasting a
 * value fitted to a title that no longer exists. ⛔ NOT a Tailwind-emission
 * argument: both of its utilities are independently live elsewhere in `src/`
 * (`text-[19px]` in the composer's `PositionStrip` and `SlotHeader`, the 1.24
 * leading on `MarketHeader.tsx:463`'s own base class), so quoting them here
 * would have emitted nothing that is not already emitted. Measured before
 * writing this, because the obvious reason was the wrong one.
 *
 * The entry went with its market; the map, the export and its typing stay,
 * because what this file encodes is the RULE that a
 * size exception is per-market and ruled, and that rule outlives the one market
 * that needed it. An empty map is the correct expression of "no market currently
 * overflows", and `MarketHeader.tsx` indexes it unchanged.
 *
 * ## The measurement
 *
 * Taken on the live staging build (`/api/health` canary `7e4cb3e0`,
 * `env:staging`) in a frame pinned to 1440px in-page, fonts confirmed loaded,
 * each market page loaded in turn and each heading measured in its own
 * container. Available width
 * is the `headzone-stack` column, **666.67px on every market**. Text width is the
 * un-clipped run, cross-checked two ways (a `Range` over the live text node and a
 * `max-content` clone) which agreed to the hundredth of a pixel.
 *
 * ```
 *   title                                   chars    ink @21px   margin
 *   Claude · Will Anthropic reply …            64      660.06     +6.61
 *   YCombinator · Will YC reply …              62      652.75    +13.92
 *   Bitcoin · Will BTC ever go below …         57      610.73    +55.94
 *   Math · Will 3 Erdős problems …             55      588.17    +78.50
 *   Chess · Will FIDE answer …                 54      573.91    +92.76
 *   GitHub · Will the Zugzwang repo …          52      549.51   +117.16
 * ```
 *
 * **Every remaining title fits at the base `text-[21px]`.** The one that did not
 * is the one that was removed: it measured 694.21px against the 666.67px column,
 * a margin of −27.54px, and the tail it lost to `truncate` was `ts?` — the
 * characters that make the heading read as a question at all. That was the cost
 * the ruling paid to remove, not the aesthetics of a clipped line.
 *
 * ## ⛔⛔ D-50 — FOUR OF THOSE SIX TITLES ARE GONE, AND ONE OF THE NEW ONES DOES
 * ## NOT FIT
 *
 * The table above is **anchored, not rewritten** — it is a measurement of titles
 * that shipped, and re-deriving its rows for copy that has changed would
 * fabricate history. What follows is a SECOND measurement, of the v3.0 titles,
 * taken the same way and reported beside it.
 *
 * ⚠ Read on **production**, canary `207a6155…`, `env:prod`, in the live
 * `headzone-stack` column — `clientWidth` **667** (the stack's own box is
 * 666.67; the heading's content box rounds to 667, which is the number the fit
 * is actually against). A clone of the real `<h1>` at `width:max-content`, so
 * weight 700, Geist and `tracking:normal` are inherited rather than restated.
 * ⛔ **THE FOUR SURVIVING v2.2 ROWS WERE RE-MEASURED FIRST AS A POSITIVE
 * CONTROL AND ALL FOUR REPRODUCED TO THE HUNDREDTH OF A PIXEL** — 573.91,
 * 652.75, 588.17, 549.51 against the table above. That is what makes the rows
 * below measurements rather than estimates; a probe that cannot reproduce a
 * known figure is not measuring the thing it claims to.
 *
 * ```
 *   v3.0 title                              chars    ink @21px   margin
 *   Math · Will 3 Erdős problems … on Z…       67      728.19    −61.19   ⛔ CLIPS
 *   Chess · Will Vishy Anand answer …          61      654.57    +12.43
 *   Claude · Will Anthropic reply 👍 …         61      635.94    +31.06   (unchanged)
 *   YCombinator · Will Zugzwang get into …     60      637.20    +29.80
 *   GitHub · Will the Zugzwang repo … 50,…     51      539.33   +127.67
 * ```
 *
 * ⛔ **`math-erdos-solved-on-zugzwang` IS THE FIRST TENANT THIS MAP HAS EVER
 * HAD, AND IT EARNS THE ENTRY THE SAME WAY THE REMOVED ONE DID.** At 21px it
 * overflows by 61.19px and `truncate` eats **`mber?`** — the question mark
 * included, which is the exact failure the paragraph above describes as the cost
 * of the removed market. 19px is the largest ratified scale step (15 · 17 · 19 ·
 * 22 · 24) that fits, at 658.84px, clearing the column by **8.16px** — above the
 * same 8px bar the old ruling used to choose 19 over 20. So the entry is not a
 * new judgement: it is this file's own precedent applied to the one title that
 * now needs it.
 * ⚠ **THE OTHER FOUR NEED NOTHING AND MUST NOT BE GIVEN ANYTHING.** `Chess` is
 * now the tightest heading on the roster at **+12.43px** — tighter than the
 * +13.92 that row above records for the old YCP title — and it still clears the
 * 8px bar, so it fits at the base size. An override added "to be safe" would
 * shrink a heading that does not need shrinking, and this file's whole argument
 * is that an entry is added by measurement rather than by inference.
 * ⚠ The **21 → 19** step is paired with `leading-[1.24]` for the reason the
 * arbitrary-leading warning below gives; the two are written as one literal so
 * they cannot be separated by omission.
 *
 * ⚠ **THE TIGHTEST SURVIVOR IS BELOW THE BAR THE OLD RULING USED, AND THAT IS A
 * MEASUREMENT AND NOT A LICENCE.** The removed entry stepped 21 → 19 because 19
 * was the largest ratified scale step (… 15 · 17 · 19 · 22 · 24) clearing an 8px
 * margin; 20px would have cleared by 5.51px and is off-scale. `claude-bundle-response`
 * clears by **6.61px**, which is under that same 8px bar — it FITS, it does not
 * clip, and nothing here changes it. Recorded so the next reader does not have to
 * re-measure to discover it, and so that an entry, if one is ever wanted, is added
 * by ruling rather than by inference from this paragraph.
 *
 * ⚠ **THE TABLE IS STAGING'S TITLES, AND PRODUCTION'S ARE NOT ALL IDENTICAL.**
 * Measured 2026-09-18: `claude-bundle-response`'s title is 64 characters on
 * staging and **61 on production** (md5 `afbe8cd4…` vs `e890d44e…`); the other
 * five agree byte-for-byte across both. Production's tightest heading is therefore
 * shorter than the row above, never longer, so the fit conclusion holds on both
 * environments — but a future measurement must say which environment it read.
 *
 * ⚠ **THE CLAMP IS UNTOUCHED.** The heading stays a single line with an ellipsis
 * (D5-02 / v0.9).
 *
 * ⚠ **A VALUE MUST CARRY ITS OWN LEADING, AND THAT IS NOT DECORATION.** An arbitrary
 * `text-[Npx]` does not reset the line-height the surrounding `text-*` step brought
 * with it (AGENTS.md §8), so a size-only override would silently keep whatever
 * leading was in scope. The removed entry paired its size with a unitless 1.24
 * leading, so the leading scaled with the new size, and any future entry must
 * do the same — the pairing is what stops the two being separated by omission.
 *
 * ⛔ **A CLASS FRAGMENT, NOT A NUMBER, BECAUSE TAILWIND SCANS SOURCE TEXT.** A map
 * of `19` built into `text-[${n}px]` at runtime emits no utility at all: the
 * scanner never sees the string, the class lands in the DOM, and the heading
 * renders at its inherited size with nothing erroring. The literal is what makes
 * the rule real.
 *
 * ⚠ **RE-MEASURE BEFORE ADDING AN ENTRY** — the media panel's `w-1/3`, the stack's
 * gaps, or the page container would each change the 666.67px this table is against.
 * The figures are about one composition at one width, and nothing in the type
 * system knows that.
 *
 * ⚠ Measured at **1440**, which is the width the ruling names. Below it the column
 * narrows and more titles clip at 21px; that is pre-existing, unchanged by this
 * file, and not this override's to fix. The phone tier does not read this map at
 * all — `/m/[slug]` renders `PhoneTitleStrip` below 640px, a different heading.
 */
/**
 * Slug → the type classes that replace the heading's default size.
 *
 * Composed with `cn()`, so an entry wins the font-size and line-height groups and
 * the heading's other classes are untouched. A slug that is absent reads
 * `undefined` and the heading keeps its `text-[21px]`.
 * ⚠ "Every slug is absent today" was true until D-50 and is corrected here
 * rather than left standing beside an entry that contradicts it (§8 O-5). **One
 * slug is present**; the other five markets read `undefined` and keep 21px.
 *
 * ⚠ The value type is explicitly `| undefined`: `noUncheckedIndexedAccess` is not
 * set in this repo (AGENTS.md §4), so a bare `Record<string, string>` would tell
 * every caller it always gets a string when only one market gets anything.
 */
export const MARKET_TITLE_SIZE_OVERRIDES: Readonly<
	Record<string, string | undefined>
> = {
	// D-50 · 67 characters is 728.19px against a 667px column — it clips `mber?`,
	// the question mark included. 19px is the largest ratified step that fits
	// (658.84px, +8.16px), which is the same bar the removed entry cleared. The
	// leading travels WITH the size as one literal: an arbitrary `text-[Npx]`
	// does not reset the line-height the surrounding step brought with it
	// (AGENTS.md §8), and a literal is what Tailwind's scanner can actually see.
	"math-erdos-solved-on-zugzwang": "text-[19px] leading-[1.24]",
};
