// GET /api/_smoke-error — SCAFFOLD.8 EC9 + LD-5 smoke item #9.
//
// Gated test-error route for Sentry routing verification. Returns 404
// on `prod` (observationally indistinguishable from a non-existent
// route — no information leak to a prod scanner); throws a labeled
// error on `staging` / `preview` that the smoke runner queries the
// Sentry API to verify landed in zugzwang-staging AND did NOT land in
// zugzwang-prod.
//
// Error label embeds env + millisecond timestamp so every smoke run
// produces a distinct Sentry fingerprint (per LD-9 issue-grouping
// rationale — avoids issue-regression noise on the staging project).
//
// Security posture:
//   - 404 on prod hides the route's existence.
//   - Label contains ONLY ZUGZWANG_ENV + Date.now() — no DATABASE_URL
//     fragment, no token material, no PII.
//   - Public access is acceptable because the path is throw-only; no
//     DB / Redis / R2 mutation reachable from this handler.

export async function GET(): Promise<Response> {
	if (process.env.ZUGZWANG_ENV === "prod") {
		return new Response("Not Found", { status: 404 });
	}
	const label = `smoke-error-${process.env.ZUGZWANG_ENV}-${Date.now()}`;
	throw new Error(`[smoke-error] ${label}`);
}
