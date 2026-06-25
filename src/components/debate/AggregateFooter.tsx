import { formatDharma } from "./format";
import type { ReplyAggregate } from "./types";

/**
 * The read-time Support/Counter aggregate footer (design-language §3.1 / D12):
 * `Support (count) : Đ  /  Counter (count) : Đ`. A READ-ONLY aggregate over a
 * post's reply-bets — there is NO vote control (no up/down, no friendly-fire);
 * Support/Counter are computed, never cast (INV / design-language §4.3).
 */
export function AggregateFooter({ aggregate }: { aggregate: ReplyAggregate }) {
	return (
		<div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
			<span>
				Support ({aggregate.supportCount}) : Đ
				{formatDharma(aggregate.supportDharma)}
			</span>
			<span aria-hidden="true">/</span>
			<span>
				Counter ({aggregate.counterCount}) : Đ
				{formatDharma(aggregate.counterDharma)}
			</span>
		</div>
	);
}
