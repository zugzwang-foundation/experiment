import { Skeleton } from "@/components/ui/skeleton";

/**
 * The /bookmarks loading state (plan §3.3 states) — shadcn `Skeleton`
 * placeholders shaped like the bookmark cards; visual placeholders for the load
 * gap only, never fake content.
 */
export function BookmarksLoading(): React.JSX.Element {
	return (
		<div data-testid="bookmarks-loading" className="flex flex-col gap-3">
			{["a", "b", "c"].map((k) => (
				<Skeleton key={k} className="h-24 w-full rounded-[var(--r)]" />
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
