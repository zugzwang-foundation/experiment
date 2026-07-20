"use client";

import { BookmarksError } from "@/components/bookmarks/states";

/** The /bookmarks error boundary (plan §3.3 states) — catches a load failure
 * and offers the retry line. */
export default function BookmarksRouteError({
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}): React.JSX.Element {
	return (
		<main className="mx-auto w-full max-w-3xl px-4 py-6">
			<button type="button" onClick={reset} className="block w-full text-left">
				<BookmarksError />
			</button>
		</main>
	);
}
