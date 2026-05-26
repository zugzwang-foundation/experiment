"use client";

// useFlag wrapper per AGENTS.md §7:272-278 runtime contract.
//
// Signature MUST require `defaultValue` (not optional, no default) so the
// AGENTS.md §7 "every call site MUST pass an explicit defaultValue"
// discipline is enforced at compile time.
//
// PostHog's `useFeatureFlagEnabled` returns `boolean | undefined`:
//   - `true`/`false` once the flag payload has loaded
//   - `undefined` on the loading-state race (first render before the
//     client has fetched flags)
// We coerce `undefined` to `defaultValue` so callers never observe the
// loading state — the documented mitigation for AGENTS.md §7 ¶"Returns
// `defaultValue` on outage" + the implicit loading-state same-shape rule
// (a flag that hasn't loaded yet IS effectively unavailable from the
// caller's perspective).

import { useFeatureFlagEnabled } from "posthog-js/react";

export function useFlag(name: string, defaultValue: boolean): boolean {
	const enabled = useFeatureFlagEnabled(name);
	return enabled ?? defaultValue;
}
