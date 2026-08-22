import Link from "next/link";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

import { PositionMarker, SideBadge } from "./badges";
import { formatDharma } from "./format";
import type { AuthorIdentity, Marker, Side } from "./types";

/**
 * A post/reply author header (design-language §3.1 "argprofile"): avatar (PFP
 * placeholder, D8) · pseudonym · frozen SideBadge · live PositionMarker · the
 * author's own stake `a` · reply count.
 * The marker chip sits after the side badge, before the stake (D5).
 *
 * UNWIRE-1 — the `CardActions` cluster (the bookmark trigger + `showActions`,
 * its caller-side gate) is removed: the bookmark module is unwired
 * product-wide. This header no longer renders any action cluster at all.
 * The `@entry%`/`→now` enrichments are deferred (D7) — just the side and `Đ a`,
 * never `YES @ 27%` or `Đ a → Đ now`.
 */
export function ArgProfile({
	author,
	side,
	marker,
	entryPrice,
	authorStake,
	replyCount,
	chipSize,
}: {
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
				{/* HTML-FINISH · MARKET DETAIL row 42 — the pseudonym navigates to that
				    author's Profile. SPEC.1 `:1628` already rules exactly this for the
				    Discovery hero ("an author pseudonym click navigates to that
				    author's **Profile (§23)**"), so this extends a ruled behaviour to
				    the surface that shows the most pseudonyms rather than inventing
				    one. d5 navigates from its author name too (`:1909-1911` →
				    `nav('profile')`).
				    ⚠ ONE CHANGE REACHES EVERY SITE, which is the dividend of rows 12,
				    26 and 33 collapsing four author rows into this one: the post card,
				    the focused post, the reply card and both pop-ups all get it, and
				    none of them can drift away from it.
				    ⚠ `encodeURIComponent` — a pseudonym is user-facing identity, not a
				    slug, and the route takes it as a path segment.
				    ⚠ The accessible name is the pseudonym itself, so no `aria-label`
				    is added: an override would have to CONTAIN the visible text to
				    satisfy WCAG 2.5.3, and the visible text already says it. */}
				<Link
					href={`/u/${encodeURIComponent(author.pseudonym)}`}
					className="truncate text-sm font-medium text-ink hover:underline"
				>
					{author.pseudonym}
				</Link>
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
						{/* `.repmeta` (`d5:580`) — `font-weight:700;letter-spacing:.12em;
						    text-transform:uppercase;color:var(--ink)`, with `.repn`
						    (`:579`) setting the COUNT back to 13px / no tracking. The row
						    read `Replies · 0` in sentence case at the muted weight, which
						    is the one field in this line the mockup deliberately promotes
						    to ink. */}
						<span className="text-[9.5px] font-bold tracking-[0.12em] text-ink uppercase">
							Replies ·{" "}
							<span className="text-[13px] tracking-normal">{replyCount}</span>
						</span>
					</>
				) : null}
			</div>
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
