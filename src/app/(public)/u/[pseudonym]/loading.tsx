import { ProfileLoading } from "@/components/profile/states";
import { PageContainer } from "@/components/shell/PageContainer";

/** The profile route's Suspense fallback — the W2.11 skeleton kit (§5 matrix).
 * Shows on client navigation to this uncached dynamic route. */
export default function Loading() {
	return (
		<PageContainer preset="reading">
			<ProfileLoading />
		</PageContainer>
	);
}
