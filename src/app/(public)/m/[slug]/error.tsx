// SPDX-License-Identifier: AGPL-3.0-or-later
"use client";

import { useEffect } from "react";

import { PageContainer } from "@/components/shell/PageContainer";
import { captureBoundaryError } from "@/lib/boundary-capture";

/**
 * The `/m/[slug]` error boundary — POLISH.3 D4 / PD-3-11, following the
 * ratified `PD-7a-04` / R-C precedent exactly.
 *
 * WHAT IT CLOSES. Before this file the debate route had no boundary of its own:
 * an uncaught throw in `page.tsx`, in `loadDebateView`, or anywhere under
 * `DebateView` escalated past `(public)/layout.tsx` to `src/app/global-error.tsx`
 * — the WHOLE-DOCUMENT boundary, which replaces the root layout and therefore
 * takes the branded header, the ground and the shell with it.
 * `(public)/not-found.tsx` one level up already catches this route's
 * `notFound()` throw (ADR-0023's "unknown or Draft slug"), but only that one.
 *
 * IT DECLARES A CONTAINER AND `(auth)/error.tsx` DOES NOT, and the difference
 * is not inconsistency. The rule the repo actually supports is "declare one iff
 * your layout does not": `(auth)/layout.tsx` wraps its boundary in
 * `PageContainer preset="auth"`, while `(public)/layout.tsx` supplies no
 * container at all. `debate` is this route's own preset — read the class
 * literal off `CONTAINER_PRESETS` in `PageContainer.tsx`, never off a plan.
 * ⚠ Flagged for Gate C under template §4.2 B3: `(auth)/error.tsx` was read as
 * required and is SILENT on which preset an error boundary takes, so the tie
 * was genuinely unbroken by the repo. This is a judgement recorded, not a
 * precedent found.
 *
 * ⚠ NOTHING FROM `error` IS RENDERED — not `message`, not `stack`, not
 * `digest`, not `cause`.
 *
 * ⚠⚠ AND THE GUARANTEE BEHIND THAT SENTENCE IS WEAKER THAN IT USED TO BE. SAY
 * SO PLAINLY RATHER THAN LET THE NEXT READER INHERIT THE OLD ONE. This block
 * read: *the prop is deliberately NOT DESTRUCTURED, so no binding exists to
 * render by accident — structural, not a rule someone has to remember
 * (CLAUDE.md §8 O-1)*. That was true and it was the strongest form available:
 * no binding implies no read, of any kind, on any node, in any portal, for any
 * event, forever, and `market-error-boundary.test.tsx` proved it with one
 * source assertion where seven behavioural probes had not managed it.
 *
 * It is gone, deliberately, and O-1 is the reason to be uncomfortable about it
 * rather than a reason it did not happen. A boundary is the thing that stops a
 * client-side throw propagating, so nothing else in the stack can report it —
 * not `onRequestError`, which sees only the server, and not the browser SDK's
 * global handlers, which never receive an error React has already caught.
 * Reporting requires a binding. There is no version of this that keeps both.
 *
 * WHAT REPLACES IT, since a procedural rule needs stating where a structural
 * one did not: `error` may reach `captureBoundaryError` and NOTHING ELSE. Not
 * JSX, not a handler closure, not `document.title`, not a second call. The
 * source guard in `market-error-boundary.test.tsx` was inverted rather than
 * deleted — it now pins that single permitted read and fails on a second one —
 * and the behavioural sweep still asserts no HANDLER on this surface touches
 * the error, which is the edit the old docblock was really worried about (a
 * "Show details" affordance) and which is still forbidden.
 *
 * ⚠ AND THE ARM THAT PROTECTS IS NOT THE ONE YOU WOULD GUESS. In a production
 * build React's Flight client already replaces a SERVER-side error with a fixed
 * placeholder before it reaches the browser — "the specific message is omitted
 * in production builds" — so for server throws this file has nothing left to
 * leak. What it genuinely guards is the CLIENT arm: an error thrown in the
 * browser or during hydration arrives here as the REAL, unsanitized `Error` in
 * production too. Anyone later "improving" this to show `error.message` will
 * check a server throw, see a placeholder, conclude production is safe — and be
 * wrong for the arm that matters. Do not render it.
 *
 * ⚠ NO `loading.tsx` LANDS BESIDE THIS — R-C, stated in the very file D4 names
 * (`(auth)/error.tsx`). A route-level fallback would blanket the whole debate
 * surface on every navigation; if a specific read ever wants one it belongs
 * in-page as `<Suspense>`, which is a different task.
 *
 * Copy and treatment follow the established state family — `(auth)/error.tsx`
 * and `(public)/not-found.tsx` — with W2.11's generic-error title vocabulary.
 * Template §11: the states must feel like one family.
 *
 * `"use client"` is a Next.js framework requirement for `error.tsx`, not new
 * product logic.
 */
export default function DebateRouteError({
	error,
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}): React.JSX.Element {
	useEffect(() => {
		captureBoundaryError(error, "debate");
	}, [error]);

	return (
		<PageContainer
			preset="debate"
			data-testid="debate-error"
			className="text-center"
		>
			<h1 className="font-medium text-ink text-lg">Something went wrong.</h1>
			<p className="mt-2 text-n5 text-sm">
				An unexpected error stopped this page from loading.
			</p>
			<button
				type="button"
				onClick={reset}
				className="mt-6 inline-block font-medium text-ink text-sm underline-offset-4 outline-none hover:underline focus-visible:shadow-(--state-focus-ring)"
			>
				Try again
			</button>
		</PageContainer>
	);
}
