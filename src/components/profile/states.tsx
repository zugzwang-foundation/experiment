import { Skeleton } from "@/components/ui/skeleton";

import { PROFILE_COPY } from "./copy";

/**
 * The profile loading state (design-language §4.10 — ships WITH the surface):
 * shadcn `Skeleton` placeholders shaped like the profile bands (identity + tiles
 * + graph + arena) — visual placeholders for the load gap only, NEVER
 * profile-shaped fake content.
 */
export function ProfileLoading(): React.JSX.Element {
	return (
		<div data-testid="profile-loading" className="flex flex-col gap-5">
			<Skeleton className="h-24 w-full rounded-[var(--r)]" />
			<div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
				{["a", "b", "c", "d", "e", "f"].map((k) => (
					<Skeleton key={k} className="h-20 rounded-[var(--r)]" />
				))}
			</div>
			<Skeleton className="h-48 w-full rounded-[var(--r)]" />
			<Skeleton className="h-64 w-full rounded-[var(--r)]" />
		</div>
	);
}

/** The profile error state (W2.11 kit) — the OQ-7 load-error line. */
export function ProfileError(): React.JSX.Element {
	return (
		<p
			data-testid="profile-error"
			className="py-12 text-center text-sm text-n5"
		>
			{PROFILE_COPY.error.load}
		</p>
	);
}
