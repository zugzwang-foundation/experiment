"use client";

import { Bookmark } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { Button } from "@/components/ui/button";
import { removeBookmarkAction } from "@/server/bookmarks/remove";

/**
 * The /bookmarks in-page un-bookmark control (ADR-0032 D-5; plan §3.3) — the
 * ONLY interactive write A6 owns (add is the BOOKMARK-ADD-WIRE follow-on, §11).
 * The icon is ACTIVE (filled) because every card on /bookmarks is, by
 * definition, bookmarked. Clicking calls `removeBookmarkAction` (idempotent,
 * scoped to the session user) then `router.refresh()` — the dynamic RSC re-runs
 * `loadBookmarks`, which no longer includes the removed row, so the item drops
 * (revalidate-the-route arm of plan §3.3; the last item dropping → empty state).
 */
export function UnbookmarkButton({
	commentId,
}: {
	commentId: string;
}): React.JSX.Element {
	const router = useRouter();
	const [pending, startTransition] = useTransition();

	return (
		<Button
			type="button"
			variant="ghost"
			size="icon-sm"
			aria-label="Remove bookmark"
			disabled={pending}
			onClick={() =>
				startTransition(async () => {
					await removeBookmarkAction(commentId);
					router.refresh();
				})
			}
		>
			<Bookmark className="fill-current" />
		</Button>
	);
}
