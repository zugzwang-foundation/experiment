import { LoadingBlock } from "@/components/ui/loading-block";

/**
 * The /bookmarks loading state (plan §3.3 states) — P7 `LoadingBlock`
 * placeholders shaped like the bookmark cards; visual placeholders for the load
 * gap only, never fake content.
 *
 * ⚠ ADOPTS THE PRIMITIVE (item 5 / PD-6-05). It was three raw shadcn skeleton
 * elements hand-carrying the `--r` radius as a class of their own. The radius
 * now comes from the leaf, which composes it over any passed className — so
 * this call site states only what is SURFACE-SPECIFIC, the card-shaped height.
 * ⚠ The class literal is deliberately NOT written in this prose: a reader
 * grepping the file for it to check the adoption must get ZERO, and a mention
 * inside a comment would read as a hand-carried class.
 *
 * ⛔ THE COUNT STAYS A LITERAL, AND THAT IS A KNOWINGLY ACCEPTED PARTIAL
 * (S-6, ruled OD-3). Canon §10's P7 requires the count come from the surface's
 * own constant — Discovery has `DISCOVERY_GRID_SIZE`. `/bookmarks` has no
 * equivalent because `loadBookmarks` is UNPAGINATED, and minting one would be
 * new server API for a single consumer (§5.2). Item 5 discharges P7's
 * PRIMITIVE clause and deliberately NOT its COUNT clause; the partial is
 * recorded at the close-out rather than papered over here.
 */
export function BookmarksLoading(): React.JSX.Element {
	return (
		<div data-testid="bookmarks-loading" className="flex flex-col gap-3">
			{["a", "b", "c"].map((k) => (
				<LoadingBlock key={k} className="h-24 w-full" />
			))}
		</div>
	);
}

/** The /bookmarks error state (plan §3.3 states) — the load-error retry line. */
export function BookmarksError(): React.JSX.Element {
	return (
		<p
			data-testid="bookmarks-error"
			className="py-12 text-center text-n5 text-sm"
		>
			Couldn't load your bookmarks. Tap to retry.
		</p>
	);
}
