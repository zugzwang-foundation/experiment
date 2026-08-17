import Link from "next/link";

import { formatDharma } from "@/components/debate/format";
import { REMOVED_STUB_TEXT } from "@/components/debate/placeholders";
import { Card } from "@/components/ui/card";
import type { BookmarkItem } from "@/server/bookmarks/list";

import { BookmarkPresentHead, BookmarkRemovedHead } from "./BookmarkCard";
import type { BookmarkSelection } from "./selection";

/**
 * HTML-FINISH · BOOKMARKS round 3 · C6 — THE ARENA'S RIGHT HALF: the picked
 * bookmark, read whole, in Profile's replica anatomy — head cluster · title ·
 * body · image slot · footer.
 *
 * ⚠⚠ THE EMPTY STATE IS DELIBERATELY NOT PROFILE'S, and the founder ruled the
 * difference. Profile's right panel FILTERS rather than replaces, because
 * SPEC.1 §16.3 D8 and §17 name the §23 argument list as where a complete record
 * lives and `positions.ts` drops exited markets from its table — so on Profile
 * the list must survive a selection. ⛔ THAT CONSTRAINT DOES NOT REACH
 * `/bookmarks`: `C-BOOKMARKS-1` forked this route, and the TABLE already is the
 * complete list — every saved pointer is in it, nothing is dropped. So with
 * nothing picked this panel simply has nothing to show, and nothing is lost.
 *
 * ⛔⛔ THE PLACEHOLDER COPY IS HALTED, NOT AUTHORED — the one element of C6 that
 * does not ship. §5 admits three sources and the mockup's `.rempty` matches
 * none of them:
 *   `surface_profile_v1_0.html:480` reads "Select a position to read its
 *   argument.<br>Sell lives here too — the footer slides into the sell action."
 * Its first clause says POSITION (this surface has none — a bookmark is a
 * pointer at an argument, not a holding) and its second names SELL, which is
 * STRUCTURALLY IMPOSSIBLE here: every bookmark is someone else's argument
 * (ADR-0032 D-3), so there is no owner arm at all. ⚠ Bookmark mode does NOT
 * override it — the mockup's `setsub:'bookmark'` branch (`:765-771`) rewrites
 * only the left colhead title and the view chip, both of which ARE carried.
 * ⇒ The panel renders its frame and an EMPTY body. ⛔ No invented sentence, no
 * repurposed one. Reported for a founder-supplied string.
 */
export function BookmarkReplicaPanel({
	items,
	selection,
}: {
	items: BookmarkItem[];
	selection: BookmarkSelection | null;
}): React.JSX.Element {
	const picked =
		selection === null
			? undefined
			: items.find((i) => i.id === selection.commentId);

	return (
		<ReplicaPanel
			title={selection === null ? "Arguments" : selection.marketTitle}
		>
			{picked === undefined ? null : picked.removed ? (
				/* ⛔ SC-1 BY CONSTRUCTION: the removed variant carries no `title`, no
				   `teaser` and no `body`, so a leak here is a COMPILE error. The head
				   still renders — the identity and frozen side of a removed argument
				   are not the thing that was removed. */
				<Card data-testid="bookmark-replica-removed" className="gap-2 p-3">
					<BookmarkRemovedHead item={picked} />
					<p className="text-xs text-n5 italic">{REMOVED_STUB_TEXT}</p>
				</Card>
			) : (
				<ReplicaCard item={picked} />
			)}
		</ReplicaPanel>
	);
}

/**
 * The replica card — `profile/ArgumentList.tsx`'s `ReplicaCard`, byte-for-byte
 * in every class, with this surface's own head cluster.
 *
 * ⚠ EVERY PART IS ALREADY LOADED — this issues NO new read. `body` is on
 * `BookmarkItem` (it inherits `ProfileArgumentItem`'s non-removed arm whole) and
 * has simply never been rendered on this surface; the head, title and footer are
 * the card list's own fields.
 * ⛔ THE ONE PART NOT BUILT IS THE IMAGE. `comments.imageUploadsId` is never
 * selected by `bookmarks/list.ts` — verified at `main`'s head — so a real image
 * is a NEW SERVER READ PER RENDER. The SLOT ships (the growth region that pins
 * the footer to the bottom) and renders NOTHING: no background, no border, no
 * label. ⛔ Deliberately not a grey box — a permanent placeholder states "an
 * image is missing" on every argument, most of which have none.
 * ⛔ NO `+` AFFORDANCE on the title: A-6 struck its shape and the body is
 * rendered in full here, which is what the mockup's pop-up existed to reach.
 */
function ReplicaCard({
	item,
}: {
	item: Extract<BookmarkItem, { removed: false }>;
}): React.JSX.Element {
	return (
		<Card
			data-testid={`bookmark-replica-${item.id}`}
			className="min-h-0 flex-1 gap-2 p-3"
		>
			<BookmarkPresentHead item={item} />
			<Link
				data-testid={`bookmark-replica-title-${item.id}`}
				href={`/m/${item.marketSlug}?post=${item.ordinal}`}
				className="font-medium text-ink hover:underline"
			>
				{item.title}
			</Link>
			{/* ⛔ NO `line-clamp` — the table clamps nothing and this panel exists to
			    READ the argument. `whitespace-pre-line` preserves the paragraph
			    breaks it was written with; both classes are
			    `profile/ArgumentList.tsx`'s, which are `PostFocusHeader.tsx:90`'s.
			    ⚠ The title appears twice — once as the title, once as the body's
			    first line — because `deriveTitleTeaser` takes the title FROM the
			    body. That is exactly what the shipped focused post does, and
			    diverging would make one comment read differently on two surfaces. */}
			<p
				data-testid={`bookmark-replica-body-${item.id}`}
				className="text-sm whitespace-pre-line"
			>
				{item.body}
			</p>
			{/* The image SLOT — empty by design, see the ⛔ above. It contributes the
			    growth region and nothing else. */}
			<div
				data-testid={`bookmark-replica-image-slot-${item.id}`}
				className="min-h-0 flex-1"
			/>
			{/* The footer, pinned to the bottom by the slot above. A post carries its
			    Support/Counter aggregate; a reply carries its "Replied to …" line.
			    ⚠ THE AGGREGATE IS RENDERED AS THE CARD LIST RENDERED IT, not as
			    Profile's `SplitBar`: the split bar is a two-pole BAR whose fill is
			    ratified against the post's own side, and `BookmarkItem`'s aggregate
			    is the AUTHOR's — porting the bar would restate a side-keyed decision
			    this surface has not been ruled on. The figures are identical; only
			    the shape is the card's. */}
			{item.kind === "post" ? (
				<p
					data-testid={`bookmark-replica-aggregate-${item.id}`}
					className="text-n5 text-xs"
				>
					Support {item.aggregate.supportCount} : Đ{" "}
					{formatDharma(item.aggregate.supportDharma)} · Counter{" "}
					{item.aggregate.counterCount} : Đ{" "}
					{formatDharma(item.aggregate.counterDharma)}
				</p>
			) : (
				item.repliedToTitle !== null && (
					<p
						data-testid={`bookmark-replica-reply-context-${item.id}`}
						className="text-xs text-n5"
					>
						Replied to {item.repliedToTitle}
					</p>
				)
			)}
		</Card>
	);
}

/**
 * The arena's right panel shell — `profile/ArgumentList.tsx`'s `ArgumentsPanel`,
 * byte-for-byte, which is itself `PositionsTable.tsx`'s `PositionsPanel`.
 *
 * ⛔ THE DEFAULT TITLE IS BYTE-CARRIED — `Arguments`, canon §6 verbatim and the
 * exact string Profile's own right panel carries. The FILTERED title is the
 * market question, which is DATA (`markets.title`), not copy.
 * ⚠ THE ACCESSIBLE NAME DOES NOT MOVE WITH THE VISIBLE TITLE: the landmark names
 * the REGION, and renaming it on every pick would make the panel un-findable by
 * name for a screen-reader user. Profile's rule, same reason.
 * ⚠ The `min-h-0` + `flex-col` pair and the body's `flex-1 min-h-0
 * overflow-y-auto` are HEIGHT-CHAIN LINKS — C7 asserts them by name. ⛔ Keep
 * commentary out of the attribute list: the guard reads the className within a
 * fixed window of the `data-testid`.
 */
function ReplicaPanel({
	title,
	children,
}: {
	title: string;
	children: React.ReactNode;
}): React.JSX.Element {
	return (
		<section
			data-testid="bookmarks-replica-panel"
			aria-label="Arguments"
			className="flex min-h-0 flex-col overflow-hidden rounded-[var(--r)] bg-n0 [border:var(--hairline)]"
		>
			{/* ⚠ `min-h-[52px]` — the mockup's `.colhead{min-height:52px}` (`:228`),
			    the fourth of the four heads taking it in this commit. This is the one
			    that needs it most: like Profile's arguments head it holds a bare
			    title, and it measured **41** against the list head's **51** beside it
			    at a pinned 1440×777, signed in. See `ArgumentList.tsx` for the full
			    measurement. */}
			<div
				data-testid="bookmarks-replica-panel-head"
				className="flex min-h-[52px] flex-wrap items-center gap-2 p-3 [border-bottom:var(--hairline)]"
			>
				{/* ⚠⚠ PROFILE-FULL — THE RIGHT HEAD IS `.chttl.mkt`, A DIFFERENT REGISTER
				    FROM THE LEFT ONE. The mockup gives this slot `font-size:13px;
				    font-weight:700; letter-spacing:.01em` with `text-transform:none`
				    (`:229-231`) — deliberately NOT the left head's uppercase overline, because
				    what lands here is a market QUESTION: a sentence, and setting a sentence in
				    an 11px tracked overline would make it unreadable. Two heads, two
				    registers, and that asymmetry is the mockup's point rather than an
				    inconsistency to tidy away.
				    ⛔ THE WRAP STAYS UNCLAMPED. The mockup 2-line-clamps this (`:231`); a
				    clamped market question is one the reader cannot finish, so `min-w-0` on a
				    `flex-wrap` bar is kept instead — the note above this records that call and
				    it is unchanged.
				    ⚠ WHAT THIS SLOT SHOWS IS ALREADY THE MOCKUP'S: the selected row's market
				    title (`selection.marketTitle`, whose own type comment names mockup
				    `:650`). Only its TYPE was still the left head's. */}
				<span
					data-testid="bookmarks-replica-panel-title"
					className="min-w-0 text-[13px] leading-[1.3] font-bold tracking-[0.01em] text-ink"
				>
					{title}
				</span>
			</div>
			<div
				data-testid="bookmarks-replica-panel-body"
				className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3"
			>
				{children}
			</div>
		</section>
	);
}
