// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * HTML-FINISH · BOOKMARKS R2 — THE ARENA PANEL SHELL, both halves.
 *
 * ⛔ EVERY CLASS IS BYTE-CARRIED from `profile/ArgumentList.tsx`'s
 * `ArgumentsPanel` (`:271-298`), itself the byte-for-byte twin of
 * `profile/PositionsTable.tsx`'s `PositionsPanel` (`:525-569`) — see the latter
 * for the per-token trace of each value back to its shipped source
 * (`HeroPanels.tsx`, `DebateColumn.tsx`, this surface's own Card padding).
 * Nothing is measured off `surface_profile_v1_0.html`, a light-mode
 * fixed-desktop prototype (DESIGN.B1).
 *
 *   section  flex min-h-0 flex-col overflow-hidden rounded-[var(--r)] bg-n0
 *            [border:var(--hairline)]        ← ArgumentList.tsx:280
 *   head     relative flex flex-wrap items-center gap-2 p-3
 *            [border-bottom:var(--hairline)] ← ArgumentList.tsx:284 + the
 *                                              `relative` from
 *                                              PositionsTable.tsx:548 (the
 *                                              popover's positioning context)
 *   title    text-xs font-medium text-ink    ← ArgumentList.tsx:286
 *   body     flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3
 *                                            ← ArgumentList.tsx:292
 *
 * ⚠ R2 GENERALISED IT TO TWO HALVES. R1 shipped one panel because it read the
 * arena off the SHIPPED PROFILE, where A-1 had struck the replica and left a
 * list. That strike is surface-bound to `/u/[pseudonym]`: SPEC.1 §23 enumerates
 * the PROFILE page and says of this route only *"This surface hosts a bookmark
 * mode at A6 — specified by A6's own ADR, not here"* (`:1665`). The delegated
 * spec, **ADR-0032 D-5**, says the page *"reuses the Profile surface in
 * forced-visitor mode"*. So the arena is two halves here.
 *
 * ⚠ THE `<h1>` IS THE LEFT TITLE and stays an `<h1>` while taking the panel-
 * title classes: this surface has carried a page heading since UI-A6, and
 * demoting it would delete the document's only heading for no visual gain.
 * Canon §10 `C-STATES-1`'s DOC-1 rider is the precedent — a ratified shared
 * TREATMENT never ratifies a shared FILE SHAPE.
 */
export function BookmarksPanel({
	title,
	titleAs = "span",
	testid,
	controls,
	children,
}: {
	title: string;
	titleAs?: "h1" | "span";
	testid: string;
	controls?: React.ReactNode;
	children: React.ReactNode;
}): React.JSX.Element {
	const Title = titleAs;
	return (
		<section
			data-testid={`${testid}-panel`}
			aria-label={title}
			className="flex min-h-0 flex-col overflow-hidden rounded-[var(--r)] bg-n0 [border:var(--hairline)]"
		>
			{/* `relative` is the market popover's POSITIONING CONTEXT and lives on
			    the BAR, not on the trigger — `PositionsTable.tsx:542-545` records
			    the browser measurement that moved it there (against the trigger the
			    popover sized to a 107px button and every market question wrapped
			    over ~6 lines). */}
			<div
				data-testid={`${testid}-panel-head`}
				className="relative flex flex-wrap items-center gap-2 p-3 [border-bottom:var(--hairline)]"
			>
				<Title className="text-xs font-medium text-ink">{title}</Title>
				{controls}
			</div>
			<div
				data-testid={`${testid}-panel-body`}
				className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3"
			>
				{children}
			</div>
		</section>
	);
}
