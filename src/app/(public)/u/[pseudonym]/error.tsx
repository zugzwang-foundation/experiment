// SPDX-License-Identifier: AGPL-3.0-or-later
"use client";

import { ProfileError } from "@/components/profile/states";
import { PageContainer } from "@/components/shell/PageContainer";

/** The profile route's error boundary — the route-boundary family block
 * (canon §10 `C-STATES-1`). `notFound()` is handled separately by
 * `not-found`; this catches a load failure and offers the retry.
 *
 * ⚠ THE INVISIBLE WRAPPER IS GONE (POLISH.5 item 9 / P5-D12). This file used
 * to wrap `<ProfileError />` in a `<button type="button" onClick={reset}
 * className="block w-full text-left">` — an action that worked and looked like
 * nothing. `reset` is now passed as a prop and lands on the block's own visible,
 * focusable, accessible-named control. It also had to go structurally: the
 * block renders its own `<button>`, and a `<button>` cannot nest in a
 * `<button>`.
 *
 * ⛔ NO `className` ON THE `PageContainer` CALL SITE.
 * `tests/unit/shell/page-container.test.ts` asserts class-set EQUALITY against
 * its `SITES` array and this file is entry 7 at the bare `reading` preset. The
 * family puts `text-center` on its container; here it lives INSIDE
 * `ui/error-block.tsx`, which centres itself.
 * ⚠ EVERY MENTION ABOVE IS UNBRACKETED, DELIBERATELY. That guard locates a call
 * site by regex over the raw file TEXT and reads the FIRST match, so an opening
 * `PageContainer` tag written inside a comment is parsed AS the call site and
 * then fails for want of a `preset=`. Prose naming a JSX tag is not a tag.
 * ⚠ `m/[slug]/error.tsx` escapes that guard only because POLISH.3 declared it in
 * a separate `GREENFIELD` array — not a precedent this file may follow.
 *
 * ⚠ NOTHING FROM `error` IS RENDERED. The prop is accepted because Next's
 * contract passes it and is deliberately NOT DESTRUCTURED, so no binding exists
 * to render by accident — structural, not a rule someone has to remember
 * (CLAUDE.md §8 `O-1`).
 *
 * `"use client"` is a Next.js framework requirement for `error.tsx`, not new
 * product logic. */
export default function ProfileRouteError({
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}) {
	return (
		<PageContainer preset="reading">
			<ProfileError onAction={reset} />
		</PageContainer>
	);
}
