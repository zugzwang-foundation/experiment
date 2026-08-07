import { BookmarksLoading } from "@/components/bookmarks/states";
import { PageContainer } from "@/components/shell/PageContainer";

/** The /bookmarks Suspense fallback (plan §3.3 states) — shows on client
 * navigation to this uncached dynamic route. */
export default function Loading(): React.JSX.Element {
	return (
		<PageContainer preset="reading">
			<BookmarksLoading />
		</PageContainer>
	);
}
