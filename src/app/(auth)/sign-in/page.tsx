// F-AUTH-1 + F-AUTH-2 sign-in landing per plan §4 page inventory.
// Server Component (no client-side hooks needed at this scaffold layer;
// the Turnstile widget will be a client island once DESIGN.* lands).
// Visual treatment (typography, spacing, brand colors) deferred to
// DESIGN.1 + DESIGN.7 per plan §8 out-of-scope.

export default function SignInPage(): React.ReactElement {
	return (
		<main>
			<h1>Sign in to Zugzwang</h1>

			{/* F-AUTH-1 — Google OAuth. Better Auth's catch-all at
			    /api/auth/sign-in/social handles the OAuth redirect; the form
			    POSTs JSON via Better Auth's client wrapper in production.
			    Placeholder simple form here. */}
			<section>
				<h2>Sign in with Google</h2>
				<form action="/api/auth/sign-in/social" method="post">
					<input type="hidden" name="provider" value="google" />
					<button type="submit">Continue with Google</button>
				</form>
			</section>

			{/* F-AUTH-2 — Email + OTP. Turnstile widget mounts client-side
			    once DESIGN.* lands; placeholder form here issues directly to
			    Better Auth's email-otp send endpoint. The `hooks.before`
			    matcher in src/server/auth/index.ts gates this path with
			    Turnstile + rate-limit. */}
			<section>
				<h2>Sign in with email</h2>
				<form action="/api/auth/email-otp/send-verification-otp" method="post">
					<label>
						Email:
						<input type="email" name="email" required />
					</label>
					{/* TODO(DESIGN.*): Cloudflare Turnstile widget client-side. */}
					<input
						type="hidden"
						name="turnstileToken"
						value="placeholder-token"
					/>
					<button type="submit">Send code</button>
				</form>
			</section>
		</main>
	);
}
