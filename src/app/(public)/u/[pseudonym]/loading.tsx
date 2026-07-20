import { ProfileLoading } from "@/components/profile/states";

/** The profile route's Suspense fallback — the W2.11 skeleton kit (§5 matrix).
 * Shows on client navigation to this uncached dynamic route. */
export default function Loading() {
	return (
		<main className="mx-auto w-full max-w-3xl px-4 py-6">
			<ProfileLoading />
		</main>
	);
}
