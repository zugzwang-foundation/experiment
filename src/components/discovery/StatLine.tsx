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
export function StatLine({
	totals,
}: {
	totals: { dharmaStaked: string; postCount: number; replyCount: number };
}) {
	return (
		<p data-testid="stat-line" className="text-xs text-muted-foreground">
			<b>Đ {formatDharma(totals.dharmaStaked)}</b> staked
			<span className="mx-1.5 opacity-50">|</span>
			<b>{totals.postCount}</b> posts
			<span className="mx-1.5 opacity-50">|</span>
			<b>{totals.replyCount}</b> replies
		</p>
	);
}
