// @vitest-environment jsdom

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { useFlag } from "@/lib/posthog/use-flag";

/**
 * `_probe-*` — a VENDOR-CONTRACT regression guard (AGENTS.md §9), not a TDD
 * driver. It asserts a `posthog-js/react` shape this repo's flag design depends
 * on, so a dependency bump that changes the shape reddens here rather than in
 * the eighteen composer render suites that would inherit the breakage.
 *
 * ⛔ THE CONTRACT: `useFlag` must return its `defaultValue` when rendered with
 * NO `PostHogProvider` above it and NO initialised `posthog` singleton.
 *
 * WHY THIS IS THE LOAD-BEARING CASE RATHER THAN AN EDGE CASE. Every
 * component render test in this repo mounts its subject bare — no provider,
 * and `instrumentation-client.ts` never runs, so the global singleton is
 * unconfigured. `useFeatureFlagEnabled` resolves its client from
 * `useContext(PostHogContext)`, whose DEFAULT value is a getter returning that
 * unconfigured global (`posthog-js/react/dist/esm/index.js:12-17`), and then
 * calls `client.isFeatureEnabled(flag)` on it plus `client.onFeatureFlags(...)`
 * in an effect. If either throws on an uninitialised instance, then adding a
 * single `useFlag` call to a shared component takes down every suite that
 * renders it — a failure that would look like "the flag broke the composer"
 * rather than "the vendor throws when unconfigured".
 *
 * ⚠ This is the same reason `useFlag` coerces `undefined` to `defaultValue` at
 * all: a flag that has not loaded is indistinguishable, from the caller's
 * position, from a flag that cannot load. The fail-open posture (ADR-0007
 * decision driver 6 — "If PostHog is unreachable, `useFlag()` returns the call
 * site's `defaultValue`") is only true if this probe is green.
 */

function Subject({ fallback }: { fallback: boolean }) {
	const on = useFlag("probe-flag-that-does-not-exist", fallback);
	return <span data-testid="out">{on ? "on" : "off"}</span>;
}

afterEach(() => {
	cleanup();
});

describe("_probe · posthog-js useFlag outside a provider", () => {
	it("_probe::returns-defaultValue-true-without-a-provider", () => {
		const { getByTestId } = render(<Subject fallback={true} />);
		expect(getByTestId("out").textContent).toBe("on");
	});

	/**
	 * The negative control. Without it, a `useFlag` that ignored its argument
	 * and always returned `true` would pass the case above — and `true` is
	 * exactly the value every kill-switch call site passes, so the bug would be
	 * invisible at every real call site too.
	 */
	it("_probe::returns-defaultValue-false-without-a-provider", () => {
		const { getByTestId } = render(<Subject fallback={false} />);
		expect(getByTestId("out").textContent).toBe("off");
	});
});
