import { formatDharma } from "@/components/debate/format";

/**
 * The card/hero stat line — `Đ staked · posts · replies` (design-language
 * §3.2; the committed mockup's attrs grammar: bold value, ` | ` separators).
 * `formatDharma` REUSED from the debate formatters (pure string trimming of
 * the NUMERIC(38,18) scale — no new formatter, no thousands separators v1).
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
