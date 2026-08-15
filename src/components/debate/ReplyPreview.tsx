"use client";

import { useState } from "react";

import type { BookmarkAffordance } from "@/components/bookmarks/BookmarkToggle";
import { Button } from "@/components/ui/button";

import { ReplyCard } from "./ReplyCard";
import type { ReplyGroups } from "./types";

/**
 * A post card's reply section (RANKING.md §7.1) — the two-slot default (top
 * Support + top Counter, computed server-side) with an in-place expand to the
 * full stake-sorted list. Edge cases ride `twoSlot`: one side empty → two from
 * the other; a single reply → it alone, no expand; zero → the widget is not
 * rendered. Each reply carries its own frozen side badge (D3 placement is by own
 * side). This is the "two-slot expand" read affordance (§7); the per-side
 * paged reply-scroller is the post-view surface.
 *
 * ⚠ RULED CONSEQUENCE OF THE ROW-13 PARTITION (POLISH.3 PR 2 C7, founder-ruled
 * 2026-08-16 — RECORDED, NOT FIXED). Expanding changes the TYPE at position 0
 * of the container. Both branches reconcile to a Fragment fiber (collapsed a
 * mapped array, expanded an explicit `<>`), so the mismatch lands ONE LEVEL
 * DOWN: keyed `ReplyCard`s on one side against unkeyed `<ul>`s on the other,
 * which React cannot match — so every reply card REMOUNTS on expand. `BookmarkToggle` seeds its
 * `useState` at mount from the page-load prop, so a bookmark placed on a
 * default-slot reply reads as UNSAVED after expanding.
 *
 * ✅ DATA IS UNAFFECTED — `addBookmarkAction` is `onConflictDoNothing` and
 * returns `{ok:true}`, so one click restores the display and nothing is lost or
 * double-written.
 *
 * ⚠ This is a new INSTANCE of a divergence class D5 already ratified for v1:
 * paging triggers no server render, so client-seeded state does not survive a
 * remount. It is the same law `CardActions`' `key={commentId}` exists to
 * exploit in the other direction.
 *
 * ⛔ THE HALF FIX WAS REASONED THROUGH AND REJECTED — reasoned, not measured;
 * no test or observation records it, and calling it "measured" would be the
 * same O-3 slip this file's neighbours were corrected for. Wrapping the
 * collapsed branch so slot 0 keeps a Fragment above two `<ul>`s would preserve
 * the reconciliation path, but the lists still differ:
 * collapsed position 0 is [top support, top counter] and expanded position 0 is
 * [top support, support tail]. The support reply's key matches and survives;
 * the counter reply moves lists and remounts anyway. ⇒ It would preserve one
 * side's state and drop the other, making the defect INTERMITTENT — harder to
 * find and easier to disbelieve than a consistent one.
 *
 * ⇒ The REAL cause is `BookmarkToggle` seeding `useState` at mount, so ANY
 * remount loses optimistic state. That is docketed to ADR-0032 / UI-A6's lane,
 * not fixed here.
 */
export function ReplyPreview({
	replies,
	bookmarks,
}: {
	replies: ReplyGroups;
	/** BOOKMARK-ADD-WIRE — pass-through to each listed `ReplyCard`. */
	bookmarks: BookmarkAffordance;
}) {
	const [expanded, setExpanded] = useState(false);
	// Row 13 (PD-3-10) — TIER 1, SPEC.1 §9 F-DEBATE-1: the affordance expands
	// "EACH SIDE'S full stake-sorted list".
	//
	// ⛔ THE DEFECT WAS AT THE SOURCE, NOT AT THE RENDER. The build computed
	// `all = [...support, ...counter]` and then rendered THAT, so every consumer
	// downstream of the concatenation was side-BLIND and the two sides were
	// indistinguishable as lists. Counting is not the fix: a flat list renders all
	// four replies and satisfies any "everything is present" assertion, which is
	// exactly why the guard asserts the PARTITION.
	//
	// ⚠ A side-blind expansion on the reply-as-bet surface is a THESIS-ADJACENT
	// defect, not a layout one — Support and Counter are read-time aggregates over
	// SIDE, and flattening them erases the distinction the affordance exists to
	// show.
	//
	// ⚠ The read model ALREADY carries them apart (`ReplyGroups` exposes `support`,
	// `counter` and `twoSlot` separately), so this partitions what is already
	// there and adds NO `DebateViewModel` field — ADR-0034 D-1 does not fire.
	const total = replies.support.length + replies.counter.length;
	if (total === 0) {
		return null;
	}
	const hasMore = total > replies.twoSlot.length;
	return (
		<div className="flex flex-col gap-1.5 border-t pt-2">
			{expanded ? (
				<>
					{replies.support.length > 0 ? (
						<ul
							data-testid="reply-group-support"
							aria-label="Support replies"
							className="flex flex-col gap-1.5"
						>
							{replies.support.map((reply) => (
								<li key={reply.id}>
									<ReplyCard reply={reply} bookmarks={bookmarks} />
								</li>
							))}
						</ul>
					) : null}
					{replies.counter.length > 0 ? (
						<ul
							data-testid="reply-group-counter"
							aria-label="Counter replies"
							className="flex flex-col gap-1.5"
						>
							{replies.counter.map((reply) => (
								<li key={reply.id}>
									<ReplyCard reply={reply} bookmarks={bookmarks} />
								</li>
							))}
						</ul>
					) : null}
				</>
			) : (
				/* The two-slot default is SPEC-MANDATED and §2 explicitly does NOT
				   remove it. Its edge cases ride `twoSlot` unchanged: one side empty →
				   two from the other; a single reply → it alone, no expand. */
				replies.twoSlot.map((reply) => (
					<ReplyCard key={reply.id} reply={reply} bookmarks={bookmarks} />
				))
			)}
			{hasMore ? (
				<Button
					variant="ghost"
					size="xs"
					className="self-start"
					onClick={() => setExpanded((v) => !v)}
					aria-expanded={expanded}
				>
					{expanded ? "Show fewer replies" : `Show all ${total} replies`}
				</Button>
			) : null}
		</div>
	);
}
