"use client";

import { useState } from "react";

import type { BookmarkItem } from "@/server/bookmarks/list";

import { BookmarkReplicaPanel } from "./BookmarkReplica";
import { BookmarksTable } from "./BookmarksTable";
import { type BookmarkSelection, initialBookmarkSelection } from "./selection";

/**
 * HTML-FINISH · BOOKMARKS round 3 · C6 — THE ARENA'S TWO PANELS, SHARING ONE
 * SELECTION. Mirrors `profile/ProfileArena.tsx`.
 *
 * ⛔ IT RENDERS NO BOX. It returns a fragment, so the table and the replica stay
 * DIRECT children of the arena band in `page.tsx` and remain its two grid items.
 * Wrapping them in a div would collapse the two-column grid to one cell and
 * break the height chain — the band's className is read from `page.tsx` by the
 * C7 guard, which is exactly why the band stays there.
 *
 * ⚠ `setSelection` IS PASSED DIRECTLY as the callback, deliberately. `useState`
 * setters have a stable identity, and `BookmarksTable` reports the selection
 * from an effect keyed on it — an inline arrow would change identity every
 * render and drive that effect in a loop, because the reported value is a fresh
 * object each time and React cannot bail out on it.
 */
export function BookmarksArena({
	items,
}: {
	items: BookmarkItem[];
}): React.JSX.Element {
	// ⚠⚠ PROFILE REFINEMENT · R3 (SSR half) — SEEDED, NOT NULL, for the reason
	// `selection.ts` records: the table's first-row fallback is reported upward by an
	// effect, effects do not run on the server, so a null seed painted an empty
	// replica panel on load and switched after hydration. The seed uses the shared
	// derivation rather than reaching for `items[0]` here.
	// ⚠ THE EFFECT STILL OWNS EVERY LATER CHANGE — this is the initial value only.
	const [selection, setSelection] = useState<BookmarkSelection | null>(() =>
		initialBookmarkSelection(items),
	);

	return (
		<>
			<BookmarksTable items={items} onSelect={setSelection} />
			<BookmarkReplicaPanel items={items} selection={selection} />
		</>
	);
}
