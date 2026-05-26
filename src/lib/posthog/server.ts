import "server-only";

// PostHog server-side SDK instance for future server-evaluated feature flags
// and out-of-band event captures. v1 surface is client-side flags only
// (AGENTS.md §1 + SPEC.2 §0.1 ADR-0007); this module exists so future
// server-side flag checks (e.g., in Server Actions / Route Handlers) reach
// for one canonical instance rather than re-constructing per call site.
//
// `null` when `NEXT_PUBLIC_POSTHOG_KEY` is absent — the SDK constructor
// requires a non-empty string key, so we cannot instantiate without one.
// Callers null-check before use; the absent-key case maps to "no flags
// evaluated server-side", which preserves the call-site default contract.

import { PostHog } from "posthog-node";

const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;

export const posthogServer: PostHog | null = key
	? new PostHog(key, { host: process.env.NEXT_PUBLIC_POSTHOG_HOST })
	: null;
