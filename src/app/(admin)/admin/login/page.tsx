import type { Metadata } from "next";
import { adminLoginAction } from "@/server/auth/admin/login";

// F-AUTH-ADMIN login page per plan §4 + SPEC.1 §13 + SPEC.2 §8.4.
// Single password field, no Turnstile (Q1 — SPEC.1 line 609). URL not
// linked from any public surface; robots.txt Disallow + noindex below.

export const metadata: Metadata = {
	robots: {
		index: false,
		follow: false,
	},
};

// Server Action wrapper: discards the `{ ok: false, code }` return shape
// so the form's `action` prop accepts it (form actions are typed
// `(formData) => Promise<void>` — Next.js doesn't propagate return
// values to the browser without useActionState). Failure surfaces as a
// page re-render with the identical-401 error message visible via flash
// state in a future iteration; for the SCAFFOLD.3 scope the
// adminLoginAction's side effects (cookie set on success, redirect) are
// the user-facing signal.
async function submitAdminLogin(formData: FormData): Promise<void> {
	"use server";
	await adminLoginAction(formData);
}

export default function AdminLoginPage(): React.ReactElement {
	return (
		<main>
			<h1>Admin sign-in</h1>
			<form action={submitAdminLogin}>
				<label>
					Password:
					<input
						type="password"
						name="password"
						required
						autoComplete="current-password"
					/>
				</label>
				<button type="submit">Sign in</button>
			</form>
		</main>
	);
}
