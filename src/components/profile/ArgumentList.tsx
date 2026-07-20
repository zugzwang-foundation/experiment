import Link from "next/link";

import { formatDharma } from "@/components/debate/format";
import { REMOVED_STUB_TEXT } from "@/components/debate/placeholders";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { ProfileArgumentItem } from "@/server/profile/arguments";

import { PROFILE_COPY } from "./copy";

/**
 * The profile argument list (SPEC.1 §23) — the user's posts and replies in
 * RANKING.md §3.6 order (server-provided; viewer-independent). Each card is the
 * D5-synced replica: side chip · title (the §9 deep-link target) · marker ·
 * Support/Counter footer (posts); a reply carries the "Replied to …" context. A
 * `content_removed` item renders the stub — the removed union variant carries
 * NO title/body/marker, so no content can leak here. Empty → the OQ-7 copy
 * (owner/visitor).
 */
export function ArgumentList({
	items,
	owner,
}: {
	items: ProfileArgumentItem[];
	owner: boolean;
}): React.JSX.Element {
	if (items.length === 0) {
		return (
			<p
				data-testid="arguments-empty"
				className="py-8 text-center text-sm text-n5"
			>
				{owner
					? PROFILE_COPY.empty.argumentsOwner
					: PROFILE_COPY.empty.argumentsVisitor}
			</p>
		);
	}

	return (
		<div data-testid="argument-list" className="flex flex-col gap-3">
			{items.map((item) =>
				item.removed ? (
					<Card
						key={item.id}
						data-testid={`argument-removed-${item.id}`}
						className="gap-2 p-3"
					>
						<SideChip side={item.side} />
						<p className="text-xs text-n5 italic">{REMOVED_STUB_TEXT}</p>
					</Card>
				) : (
					<Card
						key={item.id}
						data-testid={`argument-${item.id}`}
						className="gap-2 p-3"
					>
						<div className="flex flex-wrap items-center gap-2">
							<SideChip side={item.side} />
							{item.marker !== "none" && (
								<Badge variant="outline">{item.marker}</Badge>
							)}
						</div>
						<Link
							data-testid={`argument-title-${item.id}`}
							href={`/m/${item.marketSlug}?post=${item.ordinal}`}
							className="font-medium text-ink hover:underline"
						>
							{item.title}
						</Link>
						{item.kind === "reply" && item.repliedToTitle !== null && (
							<p
								data-testid={`argument-reply-context-${item.id}`}
								className="line-clamp-2 text-xs text-n5"
							>
								Replied to {item.repliedToTitle}
							</p>
						)}
						{item.kind === "post" && (
							<p className="text-xs text-n5">
								Support {item.aggregate.supportCount} : Đ{" "}
								{formatDharma(item.aggregate.supportDharma)} · Counter{" "}
								{item.aggregate.counterCount} : Đ{" "}
								{formatDharma(item.aggregate.counterDharma)}
							</p>
						)}
					</Card>
				),
			)}
		</div>
	);
}

function SideChip({ side }: { side: "YES" | "NO" }): React.JSX.Element {
	return (
		<Badge variant={side === "YES" ? "default" : "secondary"}>{side}</Badge>
	);
}
