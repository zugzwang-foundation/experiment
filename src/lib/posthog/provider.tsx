"use client";

// Client-only PostHog provider wrapper. The PostHog singleton is initialised
// at module load by `instrumentation-client.ts`; this provider re-imports the
// same singleton and threads it through React context so `useFlag` (and
// future PostHog hooks) resolve via the live client.

import posthog from "posthog-js";
import { PostHogProvider as PostHogReactProvider } from "posthog-js/react";

export function PostHogProvider({
	children,
}: {
	children: React.ReactNode;
}): React.ReactElement {
	return (
		<PostHogReactProvider client={posthog}>{children}</PostHogReactProvider>
	);
}
