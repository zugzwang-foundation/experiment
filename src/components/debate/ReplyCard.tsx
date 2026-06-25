import { PositionMarker, SideBadge } from "./badges";
import { formatDharma } from "./format";
import { RemovedPlaceholder } from "./placeholders";
import type { DebateReply } from "./types";

/**
 * A depth-1 reply row (design-language §3.1 "Reply"): frozen side badge · live
 * position marker · reply stake · argument text + author pseudonym. A removed
 * reply renders only its frozen side + the "removed by moderator" placeholder —
 * its body/author/marker/stake were withheld server-side (§6), so they are
 * absent from `reply` at the type level. No vote control anywhere (§4.3).
 */
export function ReplyCard({ reply }: { reply: DebateReply }) {
	if (reply.removed) {
		return (
			<div className="flex flex-col gap-1 rounded-md p-2 [border:var(--hairline)]">
				<SideBadge side={reply.side} />
				<RemovedPlaceholder />
			</div>
		);
	}
	return (
		<div className="flex flex-col gap-1.5 rounded-md p-2 [border:var(--hairline)]">
			<div className="flex items-center gap-1.5">
				<SideBadge side={reply.side} />
				<PositionMarker marker={reply.marker} />
				<span className="ml-auto font-mono text-xs text-muted-foreground">
					Đ{formatDharma(reply.stake)}
				</span>
			</div>
			<p className="text-sm whitespace-pre-line">{reply.body}</p>
			<span className="text-xs text-muted-foreground">
				{reply.author.pseudonym}
			</span>
		</div>
	);
}
