// SPDX-License-Identifier: AGPL-3.0-or-later

import { PositionMarker } from "@/components/debate/badges";
import {
	computeSplitBar,
	displaySplitTotal,
} from "@/components/debate/composer/split-bar";
import { formatDharma } from "@/components/debate/format";
import { REMOVED_STUB_TEXT } from "@/components/debate/placeholders";
import type { BookmarkItem } from "@/server/bookmarks/list";

import { UnbookmarkButton } from "./UnbookmarkButton";

/**
 * HTML-FINISH · BOOKMARKS R2 — THE REPLICA: the selected row's argument, read
 * whole, in the arena's right half.
 *
 * ⚠ THIS IS NEW BUILD, and knowing that mattered. Recon A-1 struck the replica
 * ON PROFILE, so there is NO replica component, NO row selection and NO
 * selection-bound panel anywhere in `src/` to import. What is copied here is the
 * argument-card COMPOSITION from `profile/ArgumentList.tsx` — the head cluster,
 * the separators, the title, the split bar — with every class byte-carried from
 * that file. Nothing is measured off the mockup, a light-mode prototype
 * (DESIGN.B1).
 *
 * ⛔ THREE PARTS ARE DATA-BLOCKED AND RENDER NOTHING. Each was verified at
 * source rather than assumed, and each names its missing field:
 *  1. **The author avatar.** `resolveAuthors` (`resolve-authors.ts:48`) selects
 *     `{ id, pseudonym }` only — no PFP. `BookmarkItem` carries
 *     `authorPseudonym` and no image for the author. Profile can render an
 *     avatar because its page holds a whole `ProfileUser` (`pfpUrl`); this DTO
 *     has no counterpart. Missing field: the author's `pfp_filename`/`pfpUrl`.
 *  2. **The argument image.** `comments.image_uploads_id` EXISTS in the schema
 *     (`db/schema/comments.ts:48`) but `loadBookmarks` never selects it and
 *     neither `BookmarkItem` nor `ProfileArgumentItem` carries any image field.
 *     Surfacing it would mean editing `src/server/bookmarks/list.ts`, which this
 *     round forbids. Missing field: `comments.image_uploads_id`.
 *  3. **The panel header's LIVE PRICE.** ⛔ `priceAtBet` is NOT it. That column
 *     is the frozen effective price of the side the author bought at bet time; a
 *     live price is a read against the current pool reserves, which this DTO
 *     does not carry at all. Substituting one for the other would print a number
 *     that looks live and is not — a silent lie, not an approximation. It
 *     renders NOTHING. (`priceAtBet` still renders where it is honest: inside
 *     the side chip, as `SIDE @ entry%`, which is what canon §6's side-grammar
 *     line means by "side @ entry%".)
 *
 * ⛔ NO SELL MOUNT, ever — ADR-0032 D-5: "there is never a Sell mount (every
 * item is *someone else's* content, by the D-3 guard)". The DTO carries no owner
 * field, so it is structurally impossible here as well as forbidden.
 */
export function BookmarkReplica({
	item,
}: {
	item: BookmarkItem;
}): React.JSX.Element {
	if (item.removed) {
		return (
			<div
				data-testid={`replica-removed-${item.id}`}
				className="flex flex-col gap-2"
			>
				<div className="flex flex-wrap items-center gap-2">
					<AuthorName pseudonym={item.authorPseudonym} />
					<HeadSeparator />
					{/* ⛔⛔ THE SIDE CHIP IS HALTED ON A CENSUS, NOT ON DATA. `side` and
					    `priceAtBet` BOTH carry — this is the one part of the replica head
					    that is blocked by a guard rather than by the DTO.
					    `tests/unit/debate/render/side-badge.test.tsx` pins the sized
					    `SideBadge` call sites as an EXACT per-file map
					    (`toEqual`, `:182`), and a new file wiring one moves that map. That
					    file is outside this round's write allow-list, and its own comment
					    records the precedent: when POLISH.6 became the third surface
					    wiring `profile`, the run "halted at STEP 0.6 before any write and
					    the adoption was ruled". So this renders NOTHING pending the same
					    one-file ruling. ⛔ NOT worked around: hand-rolling a chip here is
					    primitive duplication, which is `PD-0-10`'s recorded root cause,
					    and would redden `side-pole-binding` besides.
					    ⚠ The side is still readable for this item — the table row it was
					    selected from renders it as the word + thumb cluster. */}
					<span className="ml-auto">
						<UnbookmarkButton commentId={item.id} />
					</span>
				</div>
				<p className="text-xs text-n5 italic">{REMOVED_STUB_TEXT}</p>
			</div>
		);
	}

	return (
		<div data-testid={`replica-${item.id}`} className="flex flex-col gap-2">
			{/* THE HEAD CLUSTER — canon §3 item 11: "avatar · name | SIDE @ entry% |
			    stake … `Replies · N` inline with enlarged count". The AVATAR is
			    absent by data block (see the docblock); everything else carries.
			    `gap-2` is `ArgumentList.tsx:143`'s and is also the mockup's
			    `.rchead{gap:8px}` — the same number from both directions. */}
			<div className="flex flex-wrap items-center gap-2">
				<AuthorName pseudonym={item.authorPseudonym} />
				<HeadSeparator />
				{/* A PROP PASS, exactly as `ArgumentList.tsx:155-159` — `SideBadge`
				    already takes `price` and formats it under its own allow-marker, so
				    no formatting happens at this call site (a fourth marker would
				    redden `pct-round-render`, whose count is exact). The stored value
				    is ALREADY the bought side's price; routing it through the PAIRED
				    formatter would print `NO @ 45%` for a NO entry at 55%. */}
				{/* ⛔⛔ THE SIDE CHIP IS HALTED ON A CENSUS, NOT ON DATA. `side` and
					    `priceAtBet` BOTH carry — this is the one part of the replica head
					    that is blocked by a guard rather than by the DTO.
					    `tests/unit/debate/render/side-badge.test.tsx` pins the sized
					    `SideBadge` call sites as an EXACT per-file map
					    (`toEqual`, `:182`), and a new file wiring one moves that map. That
					    file is outside this round's write allow-list, and its own comment
					    records the precedent: when POLISH.6 became the third surface
					    wiring `profile`, the run "halted at STEP 0.6 before any write and
					    the adoption was ruled". So this renders NOTHING pending the same
					    one-file ruling. ⛔ NOT worked around: hand-rolling a chip here is
					    primitive duplication, which is `PD-0-10`'s recorded root cause,
					    and would redden `side-pole-binding` besides.
					    ⚠ The side is still readable for this item — the table row it was
					    selected from renders it as the word + thumb cluster. */}
				<PositionMarker marker={item.marker} />
				{item.kind === "post" && (
					<>
						<HeadSeparator />
						<span
							data-testid={`replica-stake-${item.id}`}
							className="text-n6 text-xs"
						>
							Đ {formatDharma(item.authorStake)}
						</span>
						<HeadSeparator />
						{/* `Replies · N` — N is the sum of the two pole counts, since every
						    reply IS a Support or Counter bet (ADR-0017), so no passthrough
						    field is needed. Both spans keep `ArgumentList.tsx:193-202`'s
						    class strings byte-for-byte. */}
						<span className="text-xs text-n5">
							Replies ·{" "}
							<span
								data-testid={`replica-replies-${item.id}`}
								className="font-[650] text-n6 text-sm"
							>
								{item.aggregate.supportCount + item.aggregate.counterCount}
							</span>
						</span>
					</>
				)}
				{item.kind === "reply" && (
					<>
						<HeadSeparator />
						<span
							data-testid={`replica-stake-${item.id}`}
							className="text-n6 text-xs"
						>
							Đ {formatDharma(item.stake)}
						</span>
					</>
				)}
				{/* The card-actions cluster. On Profile this is DATA-BLOCKED (no
				    `BookmarkAffordance` on `ProfileArgumentItem`); here the surface owns
				    its own write and the shipped control mounts. `ml-auto` pushes it to
				    the right edge — the mockup's `.cardacts` sits there and `ml-auto` is
				    the same topology `PositionsTable.tsx:231` uses for its own
				    right-packed cluster. */}
				<span className="ml-auto">
					<UnbookmarkButton commentId={item.id} />
				</span>
			</div>

			<h2
				data-testid={`replica-title-${item.id}`}
				className="font-medium text-ink"
			>
				{item.title}
			</h2>

			{/* THE BODY, READ WHOLE — this is what the replica is FOR, and it is the
			    one thing the left table cannot show. ⛔ NOT clamped: the panel body
			    scrolls (the arena's height chain), so the argument is read in full
			    rather than truncated. `whitespace-pre-wrap` preserves the author's
			    paragraph breaks; `text-sm text-n6` is `ArgumentList.tsx`'s teaser tier
			    one step up in emphasis for body text, matching `PostCard`'s body. */}
			<p
				data-testid={`replica-body-${item.id}`}
				className="whitespace-pre-wrap text-sm text-n6"
			>
				{item.body}
			</p>

			{item.kind === "reply" && item.repliedToTitle !== null && (
				<p
					data-testid={`replica-reply-context-${item.id}`}
					className="line-clamp-2 text-xs text-n5"
				>
					Replied to {item.repliedToTitle}
				</p>
			)}

			{item.kind === "post" && (
				<SplitBar id={item.id} aggregate={item.aggregate} />
			)}
		</div>
	);
}

/**
 * The `.vsep` upright separator. ⛔ THE GLYPH IS BYTE-CARRIED, NOT TYPED —
 * `0x7C`, U+007C VERTICAL LINE, the byte `ArgumentList.tsx:42` and
 * `HeroPanels.tsx:156-158` both record for this role. `text-n3` is those files'
 * value; the mockup's `.vsep{color:var(--n3)}` is NOT the source, because the
 * ramps are inverted between the light prototype and the shipped dark system.
 *
 * ⚠ ATTRIBUTED DUPLICATION, ROUTED NOT ABSORBED — this is now the THIRD copy
 * (`HeroPanels.tsx`'s private `HeadSeparator`, `ArgumentList.tsx:41-43`, here).
 * `ArgumentList.tsx:34-39` filed the second as a widening and named the third
 * occurrence as the moment to lift it into `ui/**`; `ui/**` mints no new
 * primitive this round either, so it is recorded again rather than done.
 */
function HeadSeparator() {
	return <span className="shrink-0 text-n3">|</span>;
}

/** The head cluster's name. ⛔ The AVATAR that would sit beside it is
 * DATA-BLOCKED (see the file docblock) and renders nothing. `truncate text-sm
 * font-medium` is `ArgumentList.tsx:329` verbatim. */
function AuthorName({ pseudonym }: { pseudonym: string }) {
	return (
		<span data-testid="replica-author" className="truncate text-sm font-medium">
			{pseudonym}
		</span>
	);
}

/**
 * The Support/Counter split bar — design-language §3.2's "label — bar — label,
 * text never inside the bar". Every class is byte-carried from
 * `ArgumentList.tsx:371-425`, which carries them from the shipped
 * `ReplySplitBar.tsx:52-79`.
 *
 * ⚠⚠ THE SIDE-POLE RESIDUAL IS INHERITED AND RECORDED, NOT INTRODUCED. Support
 * takes the POST's side, so on a NO-side post the Support share paints in the
 * YES pole. `ArgumentList.tsx:354-364` records the same exposure and routes the
 * fix as a widening, because a side-keyed expression here would redden
 * `side-pole-binding.test.ts`'s closed inventory and greening it means adding a
 * file to that guard's `PERMITTED_FILES` — a DECISION, and outside this round.
 *
 * `displaySplitTotal`, not `computeSplitBar.totalDharma`: SPEC.1 §10.8 names the
 * split bar's staked total a displayed-space aggregate, so the printed total
 * sums the printed parts. The FILL stays on the exact basis — a proportion is
 * not a Đ value.
 */
function SplitBar({
	id,
	aggregate,
}: {
	id: string;
	aggregate: {
		supportCount: number;
		counterCount: number;
		supportDharma: string;
		counterDharma: string;
	};
}) {
	const { supportPct } = computeSplitBar({
		supportDharma: aggregate.supportDharma,
		counterDharma: aggregate.counterDharma,
	});
	const displayedTotal = displaySplitTotal(
		aggregate.supportDharma,
		aggregate.counterDharma,
	);
	return (
		<div
			data-testid={`replica-split-bar-${id}`}
			className="flex items-center gap-3 text-xs"
			role="img"
			aria-label={`Support Đ ${formatDharma(aggregate.supportDharma)}, Counter Đ ${formatDharma(aggregate.counterDharma)}`}
		>
			<span className="flex items-center gap-1.5">
				<span className="text-n6">Support</span>
				<span className="text-n5">
					Đ {formatDharma(aggregate.supportDharma)}
				</span>
			</span>
			<span className="flex min-w-0 flex-1 flex-col items-center gap-1">
				<span
					className="h-1.5 w-full overflow-hidden rounded-(--r-dot) bg-no"
					aria-hidden="true"
				>
					<span className="block h-full bg-yes" style={{ width: supportPct }} />
				</span>
				<span className="text-n5">
					<b className="text-sm text-ink">Đ {formatDharma(displayedTotal)}</b>{" "}
					staked
				</span>
			</span>
			<span className="flex items-center gap-1.5">
				<span className="text-n5">
					Đ {formatDharma(aggregate.counterDharma)}
				</span>
				<span className="text-n6">Counter</span>
			</span>
		</div>
	);
}
