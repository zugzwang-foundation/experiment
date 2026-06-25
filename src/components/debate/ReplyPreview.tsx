"use client";

import { useState } from "react";

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
 */
export function ReplyPreview({ replies }: { replies: ReplyGroups }) {
	const [expanded, setExpanded] = useState(false);
	const all = [...replies.support, ...replies.counter];
	if (all.length === 0) {
		return null;
	}
	const shown = expanded ? all : replies.twoSlot;
	const hasMore = all.length > replies.twoSlot.length;
	return (
		<div className="flex flex-col gap-1.5 border-t pt-2">
			{shown.map((reply) => (
				<ReplyCard key={reply.id} reply={reply} />
			))}
			{hasMore ? (
				<Button
					variant="ghost"
					size="xs"
					className="self-start"
					onClick={() => setExpanded((v) => !v)}
					aria-expanded={expanded}
				>
					{expanded ? "Show fewer replies" : `Show all ${all.length} replies`}
				</Button>
			) : null}
		</div>
	);
}
