import { BookmarksLoading } from "@/components/bookmarks/states";

/** The /bookmarks Suspense fallback (plan §3.3 states) — shows on client
 * navigation to this uncached dynamic route. */
export default function Loading(): React.JSX.Element {
	return (
		<main className="mx-auto w-full max-w-3xl px-4 py-6">
			<BookmarksLoading />
		</main>
	);
}
