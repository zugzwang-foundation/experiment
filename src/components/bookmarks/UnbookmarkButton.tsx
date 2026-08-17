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
		/* ⚠⚠ PROFILE-FULL — THIS SLOT TAKES THE MOCKUP'S BUTTON GEOMETRY, and only
		   its geometry. In the mockup's bookmark mode the row-action slot holds an
		   `.openrow` button — 84×34, 11.5px/800/.1em uppercase, the same box as
		   `.sellbtn` in profile mode (`:305-308` against `:301-304`), measured 84×34
		   against 80×34 — while this shipped a 28×28 icon-only ghost. The slot read
		   as an afterthought beside Profile's, and the two surfaces are supposed to
		   be the same shell.
		   ⛔ THE ACTION IS NOT THE MOCKUP'S, AND IS NOT CHANGED TO MATCH. `OPEN` is
		   struck: it is navigation to a place the row's own title link already
		   goes, so building it would put two controls on one destination — and on
		   Profile the same visitor-only control is struck on tier 1 (recon A-2,
		   SPEC.1 §23's payload law: the owner's only deltas are Sell and
		   Daily-Credit history, so a visitor-only action inverts it). Un-bookmark is
		   this route's own action (ADR-0032 D-5) and the only write A6 owns; it
		   KEEPS the slot and takes the shape.
		   ⚠ SO THE LABEL BECOMES VISIBLE TEXT. An 84px box holding a 16px glyph is
		   worse than either, and `Remove` states what the control does where the
		   icon only implied it. The `aria-label` is kept as the accessible name so
		   no assistive consumer sees a changed control, and the filled bookmark icon
		   stays beside the word — it is what says the row IS bookmarked.
		   ⛔ THE BORDER IS THE EMPHASIS LADDER'S `--ring-active` rung, not the
		   mockup's `1.5px solid var(--n3)`: a ratified composite over a ramp token,
		   the same one Profile's Sell trigger takes, so no new width or colour is
		   introduced. */
		<Button
			type="button"
			variant="outline"
			className="h-auto rounded-(--r) px-[22px] py-[9px] text-[11.5px] leading-normal font-extrabold tracking-[0.1em] uppercase [border:var(--ring-active)]"
			aria-label="Remove bookmark"
			disabled={pending}
			onClick={() =>
				startTransition(async () => {
					// BOOKMARK-ADD-WIRE (OQ-6): branch on the typed result. It was
					// previously discarded, so a returned failure still triggered the
					// refresh and read as a success. `removeBookmarkAction` returns
					// failures and never throws, so on `!ok` the row legitimately still
					// exists — leave it rendered with its filled icon and skip the
					// wasted RSC re-render. No toast, no new copy (C6).
					const result = await removeBookmarkAction(commentId);
					if (result.ok) {
						router.refresh();
					}
				})
			}
		>
			<Bookmark className="fill-current" />
			Remove
		</Button>
	);
}
