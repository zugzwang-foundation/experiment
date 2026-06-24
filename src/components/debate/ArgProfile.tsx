import { Bookmark, Download } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

import { PositionMarker, SideBadge } from "./badges";
import { formatDharma } from "./format";
import type { AuthorIdentity, Marker, Side } from "./types";

/**
 * A post/reply author header (design-language §3.1 "argprofile"): avatar (PFP
 * placeholder, D8) · pseudonym · frozen SideBadge · live PositionMarker · the
 * author's own stake `a` · reply count · the DISABLED bookmark/download card
 * actions. The marker chip sits after the side badge, before the stake (D5).
 *
 * The bookmark/download triggers render present-but-disabled (C1 / §7) —
 * `disabled` + `aria-disabled`, no handlers wired. DEBATE.4 builds no write
 * path. The `@entry%`/`→now` enrichments are deferred (D7) — just the side and
 * `Đ a`, never `YES @ 27%` or `Đ a → Đ now`.
 */
export function ArgProfile({
	author,
	side,
	marker,
	authorStake,
	replyCount,
	showActions = true,
}: {
	author: AuthorIdentity;
	side: Side;
	marker: Marker;
	authorStake?: string;
	replyCount?: number;
	showActions?: boolean;
}) {
	return (
		<div className="flex items-start gap-2">
			<Avatar size="sm">
				<AvatarImage src={author.pfpUrl} alt="" />
				<AvatarFallback>
					{author.pseudonym.slice(0, 2).toUpperCase()}
				</AvatarFallback>
			</Avatar>
			<div className="flex min-w-0 flex-col gap-1">
				<div className="flex flex-wrap items-center gap-1.5">
					<span className="truncate text-sm font-medium">
						{author.pseudonym}
					</span>
					<SideBadge side={side} />
					<PositionMarker marker={marker} />
				</div>
				<div className="flex items-center gap-2 text-xs text-muted-foreground">
					{authorStake !== undefined ? (
						<span className="font-mono">Đ{formatDharma(authorStake)}</span>
					) : null}
					{replyCount !== undefined ? (
						<>
							<span aria-hidden="true">·</span>
							<span>Replies · {replyCount}</span>
						</>
					) : null}
				</div>
			</div>
			{showActions ? (
				<div className="ml-auto flex shrink-0 items-center gap-0.5">
					<Button
						variant="ghost"
						size="icon-xs"
						disabled
						aria-disabled="true"
						aria-label="Bookmark — sign in to use"
					>
						<Bookmark />
					</Button>
					<Button
						variant="ghost"
						size="icon-xs"
						disabled
						aria-disabled="true"
						aria-label="Download — sign in to use"
					>
						<Download />
					</Button>
				</div>
			) : null}
		</div>
	);
}
