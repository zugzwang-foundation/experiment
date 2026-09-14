"use client";

// useFlag wrapper — the ADR-0007 §2 `useFlag()` runtime contract.
//
// ⚠ THIS DOCBLOCK CITED "AGENTS.md §7:272-278" AND AN AGENTS.md §7 SENTENCE
// READING "every call site MUST pass an explicit defaultValue" UNTIL FLAGS-1.
// Neither exists: AGENTS.md §7 is the server-stack section, and the file
// contains no occurrence of `useFlag`, `feature flag` or `defaultValue`
// anywhere. Whether it once did is NOT ESTABLISHED (`O-13`) — what is measured
// is that it does not now. The contract itself is real and unchanged; only its
// address was wrong, and it was wrong in the way `O-8` predicts, by naming a
// LINE RANGE in another document. It is repointed at the ADR, which is where
// the rule was ratified and which cannot drift out from under a line number.
//
// Signature MUST require `defaultValue` (not optional, no default) so the
// discipline is enforced at compile time rather than by convention.
//
// PostHog's `useFeatureFlagEnabled` returns `boolean | undefined`:
//   - `true`/`false` once the flag payload has loaded
//   - `undefined` on the loading-state race (first render before the
//     client has fetched flags), when the flag does not exist, and when
//     there is no provider or initialised singleton above the caller
// We coerce `undefined` to `defaultValue` so callers never observe the
// loading state. ADR-0007 §2 names two of those arms explicitly — "If PostHog
// Cloud is unreachable: returns `defaultValue` (fail-open)" and "If the flag is
// undefined in PostHog: returns `defaultValue` (fail-open)" — and the
// loading-state arm is the same shape, because a flag that has not loaded is
// indistinguishable, from the caller's position, from one that cannot load.
//
// The no-provider arm is pinned by `tests/unit/posthog/_probe-useflag-no-
// provider.test.tsx`. It is not a curiosity: EVERY component render suite in
// this repo mounts its subject bare, so that arm is the one they all take.

import { useFeatureFlagEnabled } from "posthog-js/react";

export function useFlag(name: string, defaultValue: boolean): boolean {
	const enabled = useFeatureFlagEnabled(name);
	return enabled ?? defaultValue;
}
