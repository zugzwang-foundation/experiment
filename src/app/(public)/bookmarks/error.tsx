// SPDX-License-Identifier: AGPL-3.0-or-later
"use client";

import { PageContainer } from "@/components/shell/PageContainer";
import { ErrorBlock } from "@/components/ui/error-block";

/** The /bookmarks error boundary — the route-boundary family block
 * (canon §10 `C-STATES-1`). Catches a load failure and offers the retry.
 *
 * ⚠ THE INVISIBLE WRAPPER IS GONE (item 6 / PD-6-06). This file used to wrap a
 * bare paragraph in a `button` element carrying `onClick={reset}` and
 * `className="block w-full text-left"` — an action that WORKED and looked like
 * nothing. The retry now lands on the block's own visible, focusable,
 * accessible-named control. It also had to go structurally: flow content
 * nested in a `button` is an invalid HTML content model, and the block renders
 * its own button, which cannot nest inside another.
 *
 * ⚠ THE BODY IS THIS SURFACE'S OWN STRING, and that is variant B′. The heading
 * and the action label are the family's generic ones, carried by the leaf; the
 * body is not. It is a SENTENCE SPLIT of the line this file used to render, at
 * its sentence boundary, with the trailing action phrase routed to
 * `actionLabel` — nothing authored, nothing invented.
 *
 * ⛔ NO `className` ON THE PageContainer CALL SITE.
 * `tests/unit/shell/page-container.test.ts` asserts class-set EQUALITY against
 * its `SITES` array and this file is entry 4 at the bare `reading` preset. The
 * family puts `text-center` on its container; here it lives INSIDE
 * `ui/error-block.tsx`, which centres itself.
 * ⚠ EVERY MENTION ABOVE IS UNBRACKETED, DELIBERATELY. That guard locates a call
 * site by regex over the raw file TEXT and reads the FIRST match, so an opening
 * PageContainer tag written inside a comment is parsed AS the call site and
 * then fails for want of a `preset=`. Prose naming a JSX tag is not a tag.
 *
 * ⚠ NOTHING FROM `error` IS RENDERED. The prop is accepted because Next's
 * contract passes it and is deliberately NOT DESTRUCTURED, so no binding exists
 * to render by accident — structural, not a rule someone has to remember
 * (CLAUDE.md §8 `O-1`).
 *
 * `"use client"` is a Next.js framework requirement for an error boundary, not
 * new product logic. */
export default function BookmarksRouteError({
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}): React.JSX.Element {
	return (
		<PageContainer preset="reading">
			<ErrorBlock
				body="Couldn't load your bookmarks."
				bodyTestId="bookmarks-error"
				actionLabel="Try again"
				onAction={reset}
			/>
		</PageContainer>
	);
}
