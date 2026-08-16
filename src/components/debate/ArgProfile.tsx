import {
	type BookmarkAffordance,
	CardActions,
} from "@/components/bookmarks/BookmarkToggle";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

import { PositionMarker, SideBadge } from "./badges";
import { formatDharma } from "./format";
import type { AuthorIdentity, Marker, Side } from "./types";

/**
 * A post/reply author header (design-language §3.1 "argprofile"): avatar (PFP
 * placeholder, D8) · pseudonym · frozen SideBadge · live PositionMarker · the
 * author's own stake `a` · reply count · the bookmark card action.
 * The marker chip sits after the side badge, before the stake (D5).
 *
 * BOOKMARK-ADD-WIRE: the bookmark trigger is now LIVE — `CardActions` owns the
 * full icon matrix (signed-out disabled / own-argument absent / active
 * outline-or-filled). ⛔ The download trigger was REMOVED at POLISH.3 PR 2
 * row 7 (`PD-3-15`).
 * The `@entry%`/`→now` enrichments are deferred (D7) — just the side and `Đ a`,
 * never `YES @ 27%` or `Đ a → Đ now`.
 *
 * `showActions` semantics are UNCHANGED: it gates the ENTIRE cluster, so it is
 * deliberately NOT the own-suppression hook. Own-suppression is a condition
 * inside `BookmarkToggle`. ⚠ The original reason for that separation was that
 * `showActions` would also strip the DOWNLOAD trigger from the viewer's own
 * arguments; row 7 removed that trigger, but the separation stands on its own
 * — `showActions` is a caller-side layout switch and own-ness is a viewer
 * fact, and collapsing them would re-couple two unrelated decisions.
 */
export function ArgProfile({
	commentId,
	author,
	side,
	marker,
	entryPrice,
	authorStake,
	replyCount,
	bookmarks,
	chipSize,
	showActions = true,
}: {
	/** The comment this header belongs to — the bookmark target (`post.id`). */
	commentId: string;
	author: AuthorIdentity;
	side: Side;
	marker: Marker;
	/**
	 * HTML-FINISH · MARKET DETAIL row 13 — the author's ENTRY PRICE, rendered ON
	 * the side chip as `YES @ 27%` (d5's `.sidechip`). ⛔ RAW, never `100 − x`:
	 * `bets.price_at_bet` is already the price of THE SIDE THE AUTHOR BOUGHT, so
	 * deriving the complement would print `NO @ 45%` for an author who entered NO
	 * at 55% — and would disagree with the shipped `.md` export, which renders the
	 * same field unmodified. `SideBadge` states this at length; it is repeated
	 * here because this is the site that supplies the value.
	 */
	entryPrice?: string;
	authorStake?: string;
	replyCount?: number;
	/** Viewer bookmark state for this market; `null` when signed out. */
	bookmarks: BookmarkAffordance;
	/**
	 * HTML-FINISH · MARKET DETAIL row 13 — the chip's geometry preset, and it is
	 * wired at EXACTLY ONE site: the post-focus author row (`d5:964`, the only
	 * `.sidechip.md` in scope). ⛔ Card and reply chips stay on `base`, because
	 * d5's card (`:1071`) and reply (`:1547`) chips are `.sm`, and `.sm` carries
	 * CONTEXTUAL radius overrides (`:882`, `:911`) that a flattened preset has no
	 * cascade to express — `badges.tsx` records this in terms. Reusing `profile`
	 * there would silently render `var(--r)` where the mockup ratified 4px, and
	 * minting a d5-`.sm` preset would be TAKING A VALUE from the mockup.
	 * ⚠ Row 13's SUBSTANCE — `YES @ 27%` — lands at all three sites regardless,
	 * via `entryPrice`. Only the geometry is site-scoped.
	 *
	 * ⚠ THE TYPE IS `"detail"` OR NOTHING, deliberately (O-1: structural beats
	 * procedural). `base` is `SideBadge`'s `?? "base"` DEFAULT rather than a
	 * member, so omitting the prop IS the card/reply geometry — and "wire some
	 * other preset at this seam" is not expressible rather than merely
	 * discouraged.
	 */
	chipSize?: "detail";
	showActions?: boolean;
}) {
	return (
		<div className="flex items-center gap-2">
			<Avatar size="sm">
				<AvatarImage src={author.pfpUrl} alt="" />
				<AvatarFallback>
					{author.pseudonym.slice(0, 2).toUpperCase()}
				</AvatarFallback>
			</Avatar>
			{/* HTML-FINISH · MARKET DETAIL row 12 — ONE LINE, pipe-separated:
			    avatar · pseudonym | chip | staked | Replies · N (d5 `:960-968`).
			    ⛔ NO VARIANT PROP, and that is a decision rather than an omission:
			    d5 renders the IDENTICAL row at the post-focus author row (`:960-968`)
			    and on the card (`:1067-1074`). The mockup does not ask for two
			    shapes, so a variant prop would be an abstraction over a difference
			    that does not exist (CLAUDE.md §5.2). The chip's GEOMETRY is the one
			    thing that varies, and it varies through `chipSize`. */}
			<div className="flex min-w-0 flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
				<span className="truncate text-sm font-medium text-ink">
					{author.pseudonym}
				</span>
				<Sep />
				<SideBadge side={side} price={entryPrice} size={chipSize} />
				<PositionMarker marker={marker} />
				{authorStake !== undefined ? (
					<>
						<Sep />
						<span className="font-mono">Đ {formatDharma(authorStake)}</span>
					</>
				) : null}
				{replyCount !== undefined ? (
					<>
						<Sep />
						<span>Replies · {replyCount}</span>
					</>
				) : null}
			</div>
			{showActions ? (
				<CardActions commentId={commentId} bookmarks={bookmarks} />
			) : null}
		</div>
	);
}

/**
 * d5's `.vsep` — the pipe between the author row's fields. Byte-carried from the
 * shipped separator at `discovery/HeroPanels.tsx` and `profile/ArgumentList.tsx`
 * so the three surfaces render one separator, not three.
 * `aria-hidden`: it is punctuation, and announcing "vertical line" between every
 * field would make the row unlistenable.
 */
function Sep() {
	return (
		<span aria-hidden="true" className="shrink-0 text-n3">
			|
		</span>
	);
}
