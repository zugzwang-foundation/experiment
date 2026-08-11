// @vitest-environment jsdom

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { AuthAlert } from "@/app/(auth)/AuthAlert";

/**
 * POLISH.7a D21 — the §8.2 ZERO-DELTA PROOF for the de-duplicated auth error
 * callout. Consolidating two hand-rolled callouts into one component is a
 * change to a shared thing, and §8.2 requires proving each existing call site
 * is unaffected — BYTE-identical, not visually identical. A first draft
 * elsewhere in this repo once emitted the same classes in a different order and
 * passed by eye.
 *
 * ⚠ THE TWO BASELINES BELOW ARE CAPTURED FROM THE PRE-CHANGE FILES, not
 * re-derived from the component. They are what `git show HEAD~1` renders:
 *
 *   sign-in/page.tsx:147   className="mt-3 rounded-(--r) bg-n1 px-3 py-2 …"
 *   sign-in/otp/page.tsx:152  className="rounded-(--r) bg-n1 px-3 py-2 …"
 *
 * The two differ by a leading `mt-3` and by nothing else, which is why
 * `AuthAlert` PREPENDS `className` rather than merging it: `cn()` runs
 * `twMerge`, and its ordering over arbitrary-property utilities would become a
 * dependency of this assertion. Plain concatenation has no such dependency.
 *
 * N2 — two distinct values plus the absent case, so a constant cannot satisfy
 * this. N3 — the ordering assertion is a positive control on the prepend rule
 * itself: it fails if `className` is ever appended instead.
 */

const OTP_BASELINE =
	"rounded-(--r) bg-n1 px-3 py-2 text-sm text-ink [border:var(--hairline)]";
const SIGN_IN_BASELINE = `mt-3 ${OTP_BASELINE}`;

afterEach(cleanup);

function alertClassOf(node: HTMLElement): string {
	const el = node.querySelector('[role="alert"]');
	expect(el, "AuthAlert renders a role=alert region").not.toBeNull();
	return el?.getAttribute("class") ?? "";
}

describe("AuthAlert — byte-identical to both pre-change call sites", () => {
	it("otp call site (no className) emits the pre-change string exactly", () => {
		const { container } = render(<AuthAlert>otp_invalid</AuthAlert>);
		expect(alertClassOf(container)).toBe(OTP_BASELINE);
	});

	it("sign-in call site (mt-3) emits the pre-change string exactly, mt-3 FIRST", () => {
		const { container } = render(
			<AuthAlert className="mt-3">send_failed</AuthAlert>,
		);
		const cls = alertClassOf(container);
		expect(cls).toBe(SIGN_IN_BASELINE);
		// The prepend rule, asserted as behaviour rather than read off the
		// source: an appended className would still contain every token and
		// still render, and only the order would betray it.
		expect(cls.startsWith("mt-3 ")).toBe(true);
	});

	it("the two call sites differ by exactly the leading mt-3", () => {
		expect(SIGN_IN_BASELINE.replace("mt-3 ", "")).toBe(OTP_BASELINE);
	});

	it("passes the message through unchanged — no code→copy branching", () => {
		// `docs/logs/UI-A7.md:13`: branching on the error code is new logic and
		// was deliberately not built; humanising is AUTH-ERROR-COPY. A component
		// that mapped `otp_invalid` to prose would be that branch smuggled into
		// presentation, so the pass-through is pinned here.
		const { container } = render(<AuthAlert>otp_rate_limited</AuthAlert>);
		expect(container.querySelector('[role="alert"]')?.textContent).toBe(
			"otp_rate_limited",
		);
	});
});
