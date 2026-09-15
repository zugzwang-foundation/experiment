import { captureException } from "@sentry/nextjs";

/**
 * The client-side capture used by every React error boundary in the tree
 * (`global-error.tsx` and the three route-group `error.tsx` files).
 *
 * WHY IT EXISTS AT ALL. `instrumentation.ts` re-exports `onRequestError`, so
 * Sentry already receives everything that throws on the SERVER — Server
 * Components, Route Handlers, Server Actions. It receives NOTHING that a React
 * error boundary catches, because a boundary is the thing that stops the error
 * propagating: it never reaches `window.onerror`, so the browser SDK's default
 * global handlers never see it either. Until a boundary reports explicitly,
 * every client-side and hydration failure on this product is invisible.
 *
 * ⚠ AND THE CLIENT ARM IS THE ONE THAT CARRIES INFORMATION. The three route
 * boundaries' own docblocks make the point for the leak case and it applies
 * unchanged here: in a production build React's Flight client replaces a
 * SERVER-side error with a fixed placeholder before it crosses to the browser,
 * so what a boundary holds after a server throw is a husk plus a `digest` —
 * the real one already went to Sentry from `onRequestError`. An error thrown in
 * the browser or during hydration arrives intact. So this function's yield is
 * almost entirely the client arm, and `digest` is what stitches the husk case
 * back to its server-side event.
 *
 * FAIL-OPEN, for the same reason `server/observability/safe-capture.ts` is
 * (SPEC.2 §17.5: a capture failure must never take down the thing it observes)
 * — but the stake is higher here than at an ordinary call site. This runs
 * INSIDE the boundary that is already handling a failure; a throw out of it has
 * nowhere sane to go, and from `global-error.tsx` there is no boundary above to
 * catch it. Hence the bare catch. It cannot reuse `safe-capture.ts`: that
 * module is `server-only` and importing it from a Client Component is a build
 * error.
 *
 * ⛔ `tags` AND A SENTRY HINT ARE MUTUALLY EXCLUSIVE IN THIS ARGUMENT, so do
 * not "improve" this by adding `mechanism` beside them. The SDK decides which
 * kind of object it was handed by looking for hint-only keys (`mechanism`,
 * `data`, `originalException`, `syntheticException`, …); find one and the
 * WHOLE object is parsed as a hint and every tag here is silently dropped. The
 * shape below is the plain capture-context form the rest of the repo uses.
 */
export function captureBoundaryError(
	error: Error & { digest?: string },
	boundary: "global" | "auth" | "debate" | "profile",
): void {
	try {
		// ⚠ READ ONCE INTO A LOCAL. `error.digest` is a property on a value this
		// module does not own, and the obvious inline form
		// `...(error.digest ? { digest: error.digest } : {})` reads it TWICE.
		// Harmless on a plain `Error`; not harmless as a habit on an object
		// whose accessors are someone else's, and the boundary tests assert the
		// exact read set, so a double read is a real (if small) failure there.
		const digest = error.digest;
		captureException(error, {
			tags: {
				kind: "react_error_boundary",
				boundary,
				// Present only on the server arm. It is the join key to the
				// `onRequestError` event that already carries the real message.
				...(digest ? { digest } : {}),
			},
		});
	} catch {
		// Deliberately swallowed — see the fail-open paragraph above.
	}
}
