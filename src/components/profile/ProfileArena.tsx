"use client";

import { useState } from "react";

import type { BookmarkAffordance } from "@/components/bookmarks/BookmarkToggle";
import type { ProfileArgumentItem } from "@/server/profile/arguments";
import type { ProfilePositionsPayload } from "@/server/profile/owner-view";
import type { ProfileUser } from "@/server/profile/resolve";

import { ArgumentList } from "./ArgumentList";
import { PositionsTable } from "./PositionsTable";
import type { ProfileSelection } from "./selection";

/**
 * ROUND 4 item 7 — THE ARENA'S TWO PANELS, SHARING ONE SELECTION.
 *
 * Picking a position row FILTERS the argument panel to that row's argument;
 * deselecting returns the full list. The two panels are siblings, so the
 * selection has to live above both — this is that holder, and it is the whole
 * of its job.
 *
 * ⛔ IT RENDERS NO BOX. It returns a fragment, so `PositionsTable` and
 * `ArgumentList` stay DIRECT children of the arena band in `page.tsx` and
 * remain its two grid items. Wrapping them in a div would collapse the
 * two-column grid to one cell and break the height chain
 * (`tests/unit/design/profile-height-chain.test.ts` reads the band's className
 * from `page.tsx`, which is exactly why the band stays there).
 *
 * ⚠ WHY A FILTER AND NOT A REPLACEMENT — the one line that matters. SPEC.1
 * §16.3 D8 and §17 name the §23 argument list as where a complete record lives,
 * and `positions.ts:151-158` drops fully-exited markets from the table, so the
 * list holds arguments the table can never reach. A filter hides; a replacement
 * would delete. The full list is one deselect away, and it is the default.
 *
 * ⚠ `setSelection` IS PASSED DIRECTLY as the callback, deliberately. `useState`
 * setters have a stable identity, and `PositionsTable` reports the selection
 * from an effect keyed on it — an inline arrow would change identity every
 * render and drive that effect in a loop, because the reported value is a fresh
 * object each time and React cannot bail out on it.
 */
export function ProfileArena({
	positions,
	argumentItems,
	owner,
	author,
	bookmarks = null,
	initialMarketSlug,
}: {
	positions: ProfilePositionsPayload;
	argumentItems: ProfileArgumentItem[];
	owner: boolean;
	author: ProfileUser;
	/**
	 * PROFILE REFINEMENT · R4 — the viewer's bookmark affordance, passed straight
	 * through to `ArgumentList`. This holder adds nothing to it; it is here only
	 * because the panels are its children. Defaults to `null` (signed out), the
	 * same honest default `ArgumentList` documents.
	 */
	bookmarks?: BookmarkAffordance;
	initialMarketSlug?: string;
}): React.JSX.Element {
	const [selection, setSelection] = useState<ProfileSelection | null>(null);

	return (
		<>
			<PositionsTable
				payload={positions}
				initialMarketSlug={initialMarketSlug}
				onSelect={setSelection}
			/>
			<ArgumentList
				items={argumentItems}
				owner={owner}
				author={author}
				bookmarks={bookmarks}
				selection={selection}
			/>
		</>
	);
}
