"use client";

import { BookmarksError } from "@/components/bookmarks/states";
import { PageContainer } from "@/components/shell/PageContainer";

/** The /bookmarks error boundary (plan §3.3 states) — catches a load failure
 * and offers the retry line. */
export default function BookmarksRouteError({
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}): React.JSX.Element {
	return (
		<PageContainer preset="reading">
			<button type="button" onClick={reset} className="block w-full text-left">
				<BookmarksError />
			</button>
		</PageContainer>
	);
}
