// SPDX-License-Identifier: AGPL-3.0-or-later
"use client";

import { PageContainer } from "@/components/shell/PageContainer";

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
 * `digest`, not `cause`. The prop is accepted because Next's contract passes it
 * and is deliberately NOT DESTRUCTURED, so no binding exists to render by
 * accident. Structural, not a rule someone has to remember (CLAUDE.md §8 O-1).
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
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}): React.JSX.Element {
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
