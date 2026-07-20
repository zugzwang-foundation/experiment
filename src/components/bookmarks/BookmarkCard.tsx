import Link from "next/link";

import { formatDharma } from "@/components/debate/format";
import { REMOVED_STUB_TEXT } from "@/components/debate/placeholders";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { BookmarkItem } from "@/server/bookmarks/list";

import { UnbookmarkButton } from "./UnbookmarkButton";

/**
 * One /bookmarks card — the A5 argument-card PATTERN in forced-visitor mode
 * (ADR-0032 D-5; plan §3.3): side chip · marker · the author head (this is
 * SOMEONE ELSE's argument) · title deep-link · Support/Counter footer (posts) or
 * "Replied to …" context (replies) · the author's Đa/Đb figures · the active
 * un-bookmark icon. NO Sell mount ever — the DTO carries no owner field, so a
 * Sell affordance is structurally impossible here. A `content_removed` item
 * renders the stub — the removed union variant carries NO title/body/marker/
 * figures (compile-enforced), so no content can leak; the author head + active
 * icon still render so the row keeps its slot and stays un-bookmarkable.
 */
export function BookmarkCard({
	item,
}: {
	item: BookmarkItem;
}): React.JSX.Element {
	if (item.removed) {
		return (
			<Card data-testid={`bookmark-removed-${item.id}`} className="gap-2 p-3">
				<div className="flex items-center justify-between gap-2">
					<div className="flex flex-wrap items-center gap-2">
						<SideChip side={item.side} />
						<AuthorHead pseudonym={item.authorPseudonym} />
					</div>
					<UnbookmarkButton commentId={item.id} />
				</div>
				<p className="text-n5 text-xs italic">{REMOVED_STUB_TEXT}</p>
			</Card>
		);
	}

	return (
		<Card data-testid={`bookmark-${item.id}`} className="gap-2 p-3">
			<div className="flex items-center justify-between gap-2">
				<div className="flex flex-wrap items-center gap-2">
					<SideChip side={item.side} />
					{item.marker !== "none" && (
						<Badge variant="outline">{item.marker}</Badge>
					)}
					<AuthorHead pseudonym={item.authorPseudonym} />
				</div>
				<UnbookmarkButton commentId={item.id} />
			</div>
			<Link
				data-testid={`bookmark-title-${item.id}`}
				href={`/m/${item.marketSlug}?post=${item.ordinal}`}
				className="font-medium text-ink hover:underline"
			>
				{item.title}
			</Link>
			{item.kind === "reply" && item.repliedToTitle !== null && (
				<p className="line-clamp-2 text-n5 text-xs">
					Replied to {item.repliedToTitle}
				</p>
			)}
			{item.kind === "post" && (
				<p className="text-n5 text-xs">
					Support {item.aggregate.supportCount} : Đ{" "}
					{formatDharma(item.aggregate.supportDharma)} · Counter{" "}
					{item.aggregate.counterCount} : Đ{" "}
					{formatDharma(item.aggregate.counterDharma)}
				</p>
			)}
			<p
				data-testid={`bookmark-figures-${item.id}`}
				className="text-n5 text-xs"
			>
				Staked Đ {formatDharma(item.staked)} · Value Đ{" "}
				{formatDharma(item.current)}
			</p>
		</Card>
	);
}

function AuthorHead({ pseudonym }: { pseudonym: string }): React.JSX.Element {
	return <span className="text-n5 text-xs">by {pseudonym}</span>;
}

function SideChip({ side }: { side: "YES" | "NO" }): React.JSX.Element {
	return (
		<Badge variant={side === "YES" ? "default" : "secondary"}>{side}</Badge>
	);
}
