"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import type { ProfileArgumentItem } from "@/server/profile/arguments";
import type { ProfilePositionsPayload } from "@/server/profile/owner-view";
import type { ProfileUser } from "@/server/profile/resolve";

import { ArgumentList } from "./ArgumentList";
import { initialProfileSelection, type ProfileSelection } from "./selection";

/**
 * ⚠ THE `loading` IS WHAT CREATES THE SUSPENSE BOUNDARY, and its absence was a
 * defect rather than a default. Next resolves
 * `hasSuspenseBoundary = !opts.ssr || !!opts.loading`
 * (`next/dist/shared/lib/lazy-dynamic/loadable.js`), so `ssr: true` with no
 * `loading` — the shape this file shipped with — yields a Fragment and NO local
 * boundary. The suspension then escaped to the route segment, so a client-side
 * navigation showed the WHOLE-PAGE skeleton until this one chunk arrived, and
 * every sibling waited on a chunk none of them needed.
 *
 * ⛔ WHY THE FALLBACK IS WRITTEN OUT HERE INSTEAD OF IMPORTED. The real shell is
 * `PositionsPanel`, which lives INSIDE `PositionsTable.tsx`. Importing it would
 * pull that entire module back into the initial chunk and undo the split this
 * boundary exists to make safe. The class strings below are therefore a
 * deliberate third copy. ⚠ The ROOT BOX and BODY strings are byte-identical
 * across `PositionsTable`, `ArgumentList` and here; the HEADER is NOT —
 * `PositionsPanel` carries `relative` and `ArgumentsPanel` does not, so those
 * two already disagree and both files claim byte-identity they do not have.
 * This copy follows `PositionsPanel`, the panel it stands in for. Extracting the
 * shell to its own module would collapse all three and end the drift; it reaches
 * `ArgumentList`, which this task was not scoped to touch.
 *
 * ⚠ IT RESERVES NO PIXEL HEIGHT, BECAUSE THERE IS NONE TO RESERVE. The height
 * chain runs viewport-downward — `<main>` `min-h-[calc(100vh-60px-2px)]` → the
 * arena band `flex-1 min-h-0` → both panels `min-h-0` → both bodies `flex-1
 * min-h-0 overflow-y-auto`. A panel never sizes to its rows; the body scrolls
 * inside whatever the band gives it. The only height literal in the panel is the
 * header band's `min-h-[52px]`, carried below so the chrome does not jump when
 * the real panel arrives.
 *
 * What actually broke without this was NOT a collapsed height. `ProfileArena`
 * returns a fragment, so both panels are direct children of the page's
 * `grid ... lg:grid-cols-2`; a fallback rendering nothing leaves the grid with
 * ONE child, and `ArgumentList` moves into column one. The fallback's job is to
 * occupy the cell.
 *
 * The body is deliberately empty rather than skeleton rows. P7 requires a
 * placeholder's COUNT to come from the host surface's own constant, never a
 * literal — and this panel has no such constant, so there is nothing to derive
 * rows from. (P7 does ask placeholders to be content-SHAPED; it is the count,
 * not the shaping, that rules them out here. An earlier draft of this comment
 * cited P7 for the opposite and was wrong.) The head carries its real overline
 * so the chrome is stable; only the rows are absent.
 */
const PositionsTable = dynamic(
	() => import("./PositionsTable").then((mod) => mod.PositionsTable),
	{
		ssr: true,
		loading: () => (
			<section
				aria-busy="true"
				aria-label="Positions"
				data-testid="positions-panel-loading"
				className="flex min-h-0 flex-col overflow-hidden rounded-[var(--r)] bg-n0 [border:var(--hairline)]"
			>
				<div className="relative flex min-h-[52px] flex-wrap items-center gap-2 p-3 [border-bottom:var(--hairline)]">
					<span className="text-[11px] leading-[1.2] font-extrabold tracking-[0.12em] text-ink uppercase">
						Positions
					</span>
				</div>
				<div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3" />
			</section>
		),
	},
);

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
	positionsValue,
	argumentItems,
	owner,
	author,
	initialMarketSlug,
}: {
	positions: ProfilePositionsPayload;
	/**
	 * POSREV-1 RF-15 level 1 — the §23 Positions-value tile's EXACT figure,
	 * passed straight through so the group headers are allocated from the very
	 * string the tile renders. This band holds no opinion about it; it is here
	 * only because the tile and the table live in different halves of the page
	 * and one number has to reach both.
	 */
	positionsValue: string;
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
				positionsValue={positionsValue}
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
