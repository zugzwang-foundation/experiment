"use client";

import { useState } from "react";

import type { ProfileArgumentItem } from "@/server/profile/arguments";
import type { ProfilePositionsPayload } from "@/server/profile/owner-view";
import type { ProfileUser } from "@/server/profile/resolve";

import { ArgumentList } from "./ArgumentList";
import { PositionsTable } from "./PositionsTable";
import { initialProfileSelection, type ProfileSelection } from "./selection";

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
 * and the list holds arguments the table cannot reach — one made on a market the
 * participant never took a position in. A filter hides; a replacement would
 * delete.
 * ⚠ THE GAP THIS CLAUSE NAMED IS NARROWER THAN IT WAS, and the sentence is
 * corrected rather than left standing: it read "`positions.ts:151-158` drops
 * fully-exited markets from the table". POSREV-1 RF-13 widened that domain, so a
 * fully-exited market now has a row and its arguments are reachable there. The
 * conclusion holds on what remains; the premise it rested on does not.
 * ⛔ "The full list is one deselect away" is ALSO gone — PROFILE REFINEMENT R3
 * retired deselect, as `PositionsTable`'s `pick` records. The full list renders
 * when there is no selection to pass, which is not the same thing as a way back.
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
	initialMarketSlug,
}: {
	positions: ProfilePositionsPayload;
	argumentItems: ProfileArgumentItem[];
	owner: boolean;
	author: ProfileUser;
	initialMarketSlug?: string;
}): React.JSX.Element {
	// ⚠⚠ PROFILE REFINEMENT · R3 (SSR half) — SEEDED, NOT NULL. `PositionsTable`
	// falls back to the first visible row in its RENDER and reports it upward in an
	// EFFECT — and effects do not run on the server, so a `null` seed here made the
	// SSR paint carry the full argument LIST and the header word `Arguments`, with
	// the replica appearing only after hydration. MEASURED in the served markup:
	// `argument-list` present, `argument-replica` absent. A rail of stubs on load is
	// exactly the defect R3 removes, and one frame of it is still it.
	// ⛔ THE SEED USES THE SHARED DERIVATION, never a local copy — `selection.ts`
	// owns "which row is first at mount", including the `?market=` preselect and the
	// DERIVED status default, and `PositionsTable` initialises its own filters from
	// the same two helpers. One definition, so the highlighted row and the panel
	// cannot disagree.
	// ⚠ THE EFFECT STILL OWNS EVERY LATER CHANGE. This is the initial value only; a
	// pick, a filter change or an arrow step all still flow up through `onSelect`.
	const [selection, setSelection] = useState<ProfileSelection | null>(() =>
		initialProfileSelection(positions.rows, initialMarketSlug),
	);

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
				selection={selection}
			/>
		</>
	);
}
