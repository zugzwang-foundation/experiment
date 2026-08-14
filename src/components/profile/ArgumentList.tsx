import Link from "next/link";

import { PositionMarker, SideBadge } from "@/components/debate/badges";
import { formatDharma } from "@/components/debate/format";
import { REMOVED_STUB_TEXT } from "@/components/debate/placeholders";
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
						<SideBadge side={item.side} size="profile" />
						<p className="text-xs text-n5 italic">{REMOVED_STUB_TEXT}</p>
					</Card>
				) : (
					<Card
						key={item.id}
						data-testid={`argument-${item.id}`}
						className="gap-2 p-3"
					>
						<div className="flex flex-wrap items-center gap-2">
							{/* Item 3 (P5-D04) — canon §3 item 11's `SIDE @ entry%`. A PROP
							    PASS: `SideBadge` already takes `price` and already renders
							    it, so NO formatting happens here. Formatting it in this
							    component would need a fourth allow-marker and redden
							    `pct-round-render` (its count is exact, deliberately), and
							    routing through the PAIRED formatter would print `NO @ 45%`
							    for an author who entered NO at 55%. ⛔ NEVER on the
							    removed variant at `:49` — it carries no price field, so
							    that is a compile error, which is the guarantee working. */}
							<SideBadge
								side={item.side}
								size="profile"
								price={item.priceAtBet}
							/>
							{/* `PositionMarker` returns null for "none" itself, and
							    supplies the `aria-label="Author Flipped"` the hand-roll
							    lacked (PD-0-10's root cause: primitive duplication). */}
							<PositionMarker marker={item.marker} />
							{/* Item 4 (P5-D06a) — the author's own opening stake, canon §3
							    item 11's head. POST VARIANT ONLY: a reply's `stake` is the
							    §3.6 ranking ruler, a different figure (§0.5). D21 struck
							    the `→ current` half, so the stake ships alone. Routed
							    through `formatDharma` — `authorStake` is a MONEY_ID and a
							    bare `{item.authorStake}` reddens no-raw-dharma-render. */}
							{item.kind === "post" && (
								<span
									data-testid={`argument-stake-${item.id}`}
									className="text-n6 text-xs"
								>
									Đ {formatDharma(item.authorStake)}
								</span>
							)}
						</div>
						<Link
							data-testid={`argument-title-${item.id}`}
							href={`/m/${item.marketSlug}?post=${item.ordinal}`}
							className="font-medium text-ink hover:underline"
						>
							{item.title}
						</Link>
						{/* Item 6 (P5-D08) — the teaser, clamped. ⛔ AM-1: the clamp is
						    CSS-ONLY. NO `title` attribute may carry this text: a native
						    tooltip revealing the whole paragraph is a SECOND read
						    affordance beside the title <Link>, which is what D13 rules
						    out, reached by a different mechanism. The compliant shape is
						    already in this file — the "Replied to …" context below clamps
						    with no `title`. The removed variant carries no `teaser` field
						    at all, so a leak here is a COMPILE error (SC-1). */}
						{item.teaser !== "" && (
							<p
								data-testid={`argument-teaser-${item.id}`}
								className="line-clamp-2 text-xs text-n5"
							>
								{item.teaser}
							</p>
						)}
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
								{/* Canon §3 item 11 — `Replies · N` inline, count enlarged
								    (`.repn`). N is the post's own reply-bets across BOTH
								    poles: every reply IS a Support or Counter bet
								    (ADR-0017), so the two counts already on the DTO sum to
								    the total. No passthrough field is needed (§2.7). */}
								Replies ·{" "}
								<span
									data-testid={`argument-replies-${item.id}`}
									className="font-[650] text-n6 text-sm"
								>
									{item.aggregate.supportCount + item.aggregate.counterCount}
								</span>{" "}
								· Support {item.aggregate.supportCount} : Đ{" "}
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
