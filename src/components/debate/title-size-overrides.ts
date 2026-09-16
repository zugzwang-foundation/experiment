/**
 * Per-market type-size overrides for the market-detail question heading.
 *
 * **FOUNDER-RULED, PER MARKET. THIS IS NOT A LENGTH RULE AND MUST NOT BECOME
 * ONE.** A map keyed on slug is the whole point: a market is added here only by
 * ruling, and removing one is the same single line. The obvious alternative —
 * "step the size down when the title is longer than N characters" — is a rule
 * nobody ruled, it would move seven other headings the moment a title is edited,
 * and it would decide typography from a character count on a proportional face,
 * where the same count is 549px of ink in one title and 694px in another (the
 * table below has both).
 *
 * ⛔ **NOT AN INLINE CONDITIONAL IN THE JSX EITHER.** `MarketHeader` renders every
 * market and should know about none of them; a `slug === "…"` in the class string
 * is the same exception spread across a component that has no other reason to name
 * a market.
 *
 * ## The measurement
 *
 * Taken on the live staging build (`/api/health` canary `7e4cb3e0`, `env:staging`)
 * in a frame pinned to 1440px in-page, fonts confirmed loaded, all eight market
 * pages loaded in turn and each heading measured in its own container. Available
 * width is the `headzone-stack` column, **666.67px on all eight**. Text width is
 * the un-clipped run, cross-checked two ways (a `Range` over the live text node
 * and a `max-content` clone) which agreed to the hundredth of a pixel.
 *
 * ```
 *   title                                   chars    ink @21px   margin
 *   Mumbai · Will BMC report 10,000 …          65      694.21    −27.54  ✗ CLIPPED
 *   Claude · Will Anthropic reply …            64      660.06     +6.61
 *   YCombinator · Will YC reply …              62      652.75    +13.92
 *   Oktoberfest · Will the 7.5M litre …        64      645.38    +21.29
 *   Bitcoin · Will BTC ever go below …         57      610.73    +55.94
 *   Math · Will 3 Erdős problems …             55      588.17    +78.50
 *   Chess · Will FIDE answer …                 54      573.91    +92.76
 *   GitHub · Will the Zugzwang repo …          52      549.51   +117.16
 * ```
 *
 * **One market overflows, and it is the one ruled here.** The heading is
 * `truncate`, so what the reader loses is the tail — and the tail of this title is
 * `ts?`, which means the question stops reading as a question. That is the cost
 * the ruling is paying to remove, not the aesthetics of a clipped line.
 *
 * ## Why 19
 *
 * The base is `text-[21px]`, taken from the locked mockup
 * (`surface_d5_v1_0.html:463`, `.question{font-size:21px;font-weight:700;
 * line-height:1.24}`) — which is **off the ratified type scale** (… 15 · 17 · 19 ·
 * 22 · 24), sitting between two steps. Stepping down lands on **19**, and the
 * override takes the scale step rather than minting a value:
 *
 * ```
 *   21px → 694.21   margin −27.54   clipped
 *   20px → 661.16   margin  +5.51   fits, but under the 8px bar — and off-scale
 *   19px → 628.09   margin +38.58   ✓ shipped
 *   17px → 561.98   margin +104.69
 * ```
 *
 * 19 is the **largest** step that clears the 8px bar; 20 would clear the line by
 * 5.51px and is not a scale value. The mockup anticipated exactly this — its own
 * v1.5 note records the question already nudged 25 → 21px as the media widened,
 * and says "Question/resolution can squeeze more on request." This is that request,
 * scoped to one market.
 *
 * ⚠ **THE CLAMP IS UNTOUCHED.** The heading stays a single line with an ellipsis
 * (D5-02 / v0.9). 19px fits the full 65 characters on that one line, so nothing
 * here needs a second one.
 *
 * ⚠ **THE VALUE CARRIES ITS OWN LEADING, AND THAT IS NOT DECORATION.** An arbitrary
 * `text-[Npx]` does not reset the line-height the surrounding `text-*` step brought
 * with it (AGENTS.md §8), so a size-only override would silently keep whatever
 * leading was in scope. `1.24` is unitless and therefore scales with the new size —
 * the value pairs them so a future entry cannot separate them by omission.
 *
 * ⛔ **A CLASS FRAGMENT, NOT A NUMBER, BECAUSE TAILWIND SCANS SOURCE TEXT.** A map
 * of `19` built into `text-[${n}px]` at runtime emits no utility at all: the
 * scanner never sees the string, the class lands in the DOM, and the heading
 * renders at its inherited size with nothing erroring. The literal is what makes
 * the rule real.
 *
 * ⚠ **RE-MEASURE BEFORE ADDING AN ENTRY, AND RE-MEASURE THE EXISTING ONE IF THE
 * COLUMN MOVES** — the media panel's `w-1/3`, the stack's gaps, or the page
 * container would each change the 666.67px this table is against. The figures are
 * about one composition at one width, and nothing in the type system knows that.
 *
 * ⚠ Measured at **1440**, which is the width the ruling names. Below it the column
 * narrows and more titles clip at 21px; that is pre-existing, unchanged by this
 * file, and not this override's to fix. The phone tier does not read this map at
 * all — `/m/[slug]` renders `PhoneTitleStrip` below 640px, a different heading.
 */
/**
 * Slug → the type classes that replace the heading's default size.
 *
 * Composed with `cn()`, so the entry wins the font-size and line-height groups and
 * the heading's other classes are untouched. A slug that is absent reads
 * `undefined` and the heading keeps its `text-[21px]`.
 *
 * ⚠ The value type is explicitly `| undefined`: `noUncheckedIndexedAccess` is not
 * set in this repo (AGENTS.md §4), so a bare `Record<string, string>` would tell
 * every caller it always gets a string when seven markets in eight get nothing.
 */
export const MARKET_TITLE_SIZE_OVERRIDES: Readonly<
	Record<string, string | undefined>
> = {
	"mumbai-bmc-pink-october-disclosure": "text-[19px] leading-[1.24]",
};
