import { formatDharma } from "@/components/debate/format";

/**
 * The card/hero stat line — `Đ staked · posts · replies` (design-language
 * §3.2; the committed mockup's attrs grammar: bold value, ` | ` separators).
 * `formatDharma` REUSED from the debate formatters — still no new formatter,
 * which is the point: it is the single shared display formatter for every Đ
 * value rendered to a user (SPEC.1 §10.8), and it both rounds to 0 dp and
 * GROUPS the integer part in threes with a literal ASCII comma.
 *
 * ONE component, TWO surfaces: this line is what both the discovery card and
 * the hero panel render, which is why `market-card.test.tsx:65` and
 * `hero-panels.test.tsx:103` assert the same `Đ 14,260 staked` string off the
 * same `data-testid="stat-line"`.
 *
 * SUPERSEDED, recorded so it cannot be mistaken for governing: this comment
 * previously read "pure string trimming of the NUMERIC(38,18) scale — no new
 * formatter, no thousands separators v1". The trimming half stopped being true
 * at DROUND (the formatter rounds), and "no thousands separators" stopped being
 * true at PRIMITIVES-1 (§10.8 at 1.0.29 groups product-wide). Discovery staked
 * totals rendering ungrouped beside composers that grouped is the exact defect
 * that rule closes.
 */
/**
 * V28 — the mockup sizes this line per surface: `.attrs` is 11.5px with 6px
 * separator margins on the hero (`:133`, `:135`), `.meta` is 11px with 5px on
 * the card (`:157`, `:159`). One component, two presets — the alternative was
 * unifying on one value, which is a divergence from a ratified baseline and
 * only the founder may accept those (POLISH-0 §5, P12).
 */
const SIZE = {
	hero: { text: "text-[11.5px]", sep: "mx-1.5" },
	card: { text: "text-[11px]", sep: "mx-[5px]" },
} as const;

/** V48 — the count and its noun agree. `1 post`, not `1 posts`. Returns the
 * NOUN only: the mockup bolds the value and leaves the noun plain
 * (`<b>28</b> posts`, `:212`), so the two cannot share one element. */
const noun = (n: number, one: string, many: string) => (n === 1 ? one : many);

export function StatLine({
	totals,
	size = "card",
}: {
	totals: { dharmaStaked: string; postCount: number; replyCount: number };
	size?: keyof typeof SIZE;
}) {
	const s = SIZE[size];
	return (
		<p
			data-testid="stat-line"
			data-size={size}
			className={`${s.text} tracking-[0.01em] text-n5`}
		>
			{/* V26 — the emphasis tier is n6/650. Inheriting `text-muted-foreground`
			    (n5) and the UA's default 700 made the emphasised value DIMMER than
			    the label it emphasises. */}
			<b className="font-[650] text-n6">
				Đ {formatDharma(totals.dharmaStaked)}
			</b>{" "}
			staked
			{/* V27 — an explicit n3 separator. `opacity-50` dimmed whatever colour
			    happened to be inherited, so the separator's value drifted with its
			    parent instead of naming a slot. */}
			<span className={`${s.sep} text-n3`}>|</span>
			<b className="font-[650] text-n6">{totals.postCount}</b>{" "}
			{noun(totals.postCount, "post", "posts")}
			<span className={`${s.sep} text-n3`}>|</span>
			<b className="font-[650] text-n6">{totals.replyCount}</b>{" "}
			{noun(totals.replyCount, "reply", "replies")}
		</p>
	);
}
