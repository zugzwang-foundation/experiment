"use client";

import { ProfileError } from "@/components/profile/states";
import { PageContainer } from "@/components/shell/PageContainer";

/** The profile route's error boundary — the W2.11 error state (§5 matrix).
 * `notFound()` is handled separately by `not-found`; this catches a load
 * failure and offers the retry line. */
export default function ProfileRouteError({
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}) {
	return (
		<PageContainer preset="reading">
			<button type="button" onClick={reset} className="block w-full text-left">
				<ProfileError />
			</button>
		</PageContainer>
	);
}
