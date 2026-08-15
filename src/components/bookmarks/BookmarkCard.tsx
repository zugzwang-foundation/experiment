import Link from "next/link";

import { PositionMarker, SideBadge } from "@/components/debate/badges";
import { formatDharma } from "@/components/debate/format";
import { REMOVED_STUB_TEXT } from "@/components/debate/placeholders";
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
					<BookmarkRemovedHead item={item} />
					<UnbookmarkButton commentId={item.id} />
				</div>
				<p className="text-n5 text-xs italic">{REMOVED_STUB_TEXT}</p>
			</Card>
		);
	}

	return (
		<Card data-testid={`bookmark-${item.id}`} className="gap-2 p-3">
			<div className="flex items-center justify-between gap-2">
				<BookmarkPresentHead item={item} />
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
				Staked Đ {formatDharma(item.staked)} · Current Đ{" "}
				{formatDharma(item.current)}
			</p>
		</Card>
	);
}

function AuthorHead({ pseudonym }: { pseudonym: string }): React.JSX.Element {
	return <span className="text-n5 text-xs">by {pseudonym}</span>;
}

/**
 * ⚠⚠ EXTRACTED AT HTML-FINISH · BOOKMARKS round 3, AND A CENSUS GUARD IS WHY.
 * C6's replica needs the same head cluster this card renders. Copying it would
 * take `SideBadge size="profile"` in the bookmarks tree from TWO call sites to
 * FOUR and redden `tests/unit/debate/render/side-badge.test.tsx`, which pins
 * `BookmarkCard.tsx: 2` exactly and is a file this round may not edit. Round 2
 * reddened it exactly that way.
 * ⇒ THE FIX IS TO HAVE ONE SITE PER VARIANT, NOT TO MOVE THE SITES. Both heads
 * stay in THIS file, the card keeps rendering them, and the replica imports
 * them — so the census still counts two here, and the card and the replica
 * cannot drift in what they show.
 *
 * The removed head ships the SUBSET the union permits: the removed variant
 * carries no `priceAtBet` and no `marker`, so reaching for either is a COMPILE
 * error rather than a judgement call (SC-1 working, not remembered).
 */
export function BookmarkRemovedHead({
	item,
}: {
	item: Extract<BookmarkItem, { removed: true }>;
}): React.JSX.Element {
	return (
		<div className="flex flex-wrap items-center gap-2">
			<SideBadge side={item.side} size="profile" />
			<AuthorHead pseudonym={item.authorPseudonym} />
		</div>
	);
}

/** The present-variant head — see `BookmarkRemovedHead` for why both live here.
 *
 * Item 1 (PD-6-01) — canon §3 item 11's `SIDE @ entry%`, the same PROP PASS
 * POLISH.5 item 3 made at `ArgumentList.tsx:72-76`. `SideBadge` already takes
 * `price` and already formats it under its own allow-marker, so NO formatting
 * happens here: doing it at this call site would need a fourth marker and redden
 * `pct-round-render` (its count is exact, deliberately). The stored value is
 * ALREADY the bought side's price — routing it through the PAIRED formatter
 * would print `NO @ 45%` for an author who entered NO at 55%.
 * `PositionMarker` returns null for "none" itself, and supplies the
 * `aria-label="Author Flipped"` the hand-roll lacked (PD-0-10's root cause was
 * primitive duplication, not styling). */
export function BookmarkPresentHead({
	item,
}: {
	item: Extract<BookmarkItem, { removed: false }>;
}): React.JSX.Element {
	return (
		<div className="flex flex-wrap items-center gap-2">
			<SideBadge side={item.side} size="profile" price={item.priceAtBet} />
			<PositionMarker marker={item.marker} />
			<AuthorHead pseudonym={item.authorPseudonym} />
		</div>
	);
}
