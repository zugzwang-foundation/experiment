// SPDX-License-Identifier: AGPL-3.0-or-later

import type { ReactNode } from "react";

/**
 * The ONE error-callout treatment for the `(auth)` screens — POLISH.7a D21.
 *
 * The W2.11 callout was hand-rolled twice: a file-local `AuthError` in
 * `sign-in/page.tsx` and an inline `<p>` in `sign-in/otp/page.tsx`, carrying
 * the same class string modulo one leading `mt-3`. Two implementations of one
 * state is the `PD-0-10` root cause (primitive duplication), and it is the
 * shape that drifts silently — nothing on disk goes red when one copy changes.
 *
 * COLOCATED HERE, DELIBERATELY NOT A `src/components/ui/` PRIMITIVE. A shared
 * primitive is changed by PRESET, with every preset defaulting to today's
 * render and a zero-delta proof across consumers (POLISH-SURFACE-TEMPLATE
 * §4.2 C2) — out of this PR's edit boundary, and halt P5. This has exactly two
 * call sites and both are in this route group.
 *
 * ⚠ `className` is PREPENDED, not merged, and the concatenation is a plain
 * template string rather than `cn()`. The obligation here is §8.2 BYTE-identical
 * output, not visually-identical: the sign-in callout must still emit
 * `mt-3 rounded-(--r) …` in that exact order. `cn()` runs `twMerge`, whose
 * ordering over arbitrary-property utilities (`rounded-(--r)`,
 * `[border:var(--hairline)]`) is a library behaviour this file would then
 * depend on. Concatenation has no such dependency. Both emitted strings are
 * pinned against literals captured from the pre-change files in
 * `tests/unit/auth/auth-alert-byte-identity.test.tsx`.
 *
 * No hooks and no state: the two client pages that import it keep their own
 * boundaries, and the message still flows through from the handler unchanged
 * (no code→copy branching — `docs/logs/UI-A7.md:13`; humanising is
 * AUTH-ERROR-COPY).
 */

const AUTH_ALERT_CLASSES =
	"rounded-(--r) bg-n1 px-3 py-2 text-sm text-ink [border:var(--hairline)]";

export function AuthAlert({
	children,
	className,
}: {
	children: ReactNode;
	className?: string;
}) {
	return (
		<p
			role="alert"
			className={
				className ? `${className} ${AUTH_ALERT_CLASSES}` : AUTH_ALERT_CLASSES
			}
		>
			{children}
		</p>
	);
}
