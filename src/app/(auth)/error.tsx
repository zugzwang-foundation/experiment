// SPDX-License-Identifier: AGPL-3.0-or-later
"use client";

/**
 * The `(auth)` route-group error boundary — POLISH.7a D20, ruled at R-C.
 *
 * WHAT IT CLOSES. Before this file, an uncaught throw anywhere under
 * `/sign-in`, `/sign-in/otp` or `/onboarding` had no boundary of its own and
 * escalated to `src/app/global-error.tsx` — the WHOLE-DOCUMENT boundary, which
 * replaces the root layout and therefore takes the branded header, the ground
 * and the shell with it. `/onboarding` is an async server component that reads
 * a cookie, verifies it, hits the DB and reads two files before its first byte,
 * so it is the likeliest thrower on the surface, and it is a first-login
 * screen: blanking the document is the worst available failure there.
 *
 * This boundary renders INSIDE `(auth)/layout.tsx`, so it inherits
 * `GlobalHeader` and `PageContainer preset="auth"` and must NOT declare a
 * container of its own — the box is POLISH.1's and is already around it.
 *
 * `"use client"` is a Next.js framework requirement for `error.tsx`, not new
 * product logic. It does not engage `UI-A7.md:76`'s no-new-client-boundary
 * ruling, which is scoped to `/onboarding`'s card staying a pure RSC — that
 * page is untouched.
 *
 * ⚠ NOTHING FROM `error` IS RENDERED — not `message`, not `stack`, not
 * `digest`, not `cause`. On a signed-out auth surface the thrown value can
 * carry a DB error, a cookie-verification detail or a Better Auth internal, and
 * none of that is the visitor's. The prop is accepted because Next's contract
 * passes it; it is deliberately unused.
 *
 * Copy and treatment follow the established state family — `global-error.tsx`
 * and `(public)/not-found.tsx` — with W2.11's generic-error title vocabulary
 * ("Something went wrong"). Template §11: the states must feel like one family.
 *
 * ⚠ NO `loading.tsx` LANDS BESIDE THIS — R-C. A route-group `loading.tsx` would
 * blanket `/sign-in` and `/sign-in/otp`, two client pages that render
 * instantly; that is POLISH.2's own reasoning for keeping Discovery's Suspense
 * in-page (`(public)/page.tsx:28-30`). If `/onboarding`'s DB read ever wants a
 * fallback it belongs in-page as `<Suspense>`, which is a different task.
 */
export default function AuthError({
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}): React.JSX.Element {
	return (
		<div data-testid="auth-error" className="my-auto text-center">
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
		</div>
	);
}
