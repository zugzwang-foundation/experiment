import "server-only";

// Cross-cutting Origin-allowlist middleware per SPEC.2 §4.1 (SCAFFOLD.15
// amendment) + ADR-0003 §D3 CSRF defense. Codified at SCAFFOLD.15 alongside
// the first consumer (`POST /api/uploads/sign`); future bet + admin
// Route Handlers reach for this helper rather than re-inventing per-endpoint
// Origin checks.
//
// Allowlist derivation: from `BETTER_AUTH_URL` env var. The http→https
// variant is included so a `BETTER_AUTH_URL=https://prd.example.com` value
// also accepts `http://prd.example.com` (typical for the dev → prd
// boundary) without forcing operators to declare two env vars. The dev
// case (`http://localhost:3000`) similarly admits the https variant.
//
// Missing-Origin requests are admitted — server-to-server callers (including
// future bot integrations + cron) don't carry a browser Origin. The CSRF
// threat model is specifically browser-originated requests, which ALWAYS
// present an Origin header.

let cachedAllowlist: readonly string[] | null = null;

function getAllowlist(): readonly string[] {
	if (cachedAllowlist) return cachedAllowlist;
	const base = process.env.BETTER_AUTH_URL;
	if (!base) {
		throw new Error(
			"BETTER_AUTH_URL not set — origin allowlist cannot derive (see .env.example).",
		);
	}
	const trimmed = base.replace(/\/+$/, "");
	const variants = new Set<string>([trimmed]);
	if (trimmed.startsWith("http://")) {
		variants.add(`https://${trimmed.slice("http://".length)}`);
	} else if (trimmed.startsWith("https://")) {
		variants.add(`http://${trimmed.slice("https://".length)}`);
	}
	cachedAllowlist = Array.from(variants);
	return cachedAllowlist;
}

/**
 * Returns `true` iff the request's `Origin` header is missing OR matches one
 * of the allowed origins derived from `BETTER_AUTH_URL`. Caller decides
 * HTTP response on `false` (typically HTTP 403 `error_origin_rejected`).
 */
export function checkOrigin(request: Request): boolean {
	const origin = request.headers.get("origin");
	if (!origin) return true;
	const trimmed = origin.replace(/\/+$/, "");
	return getAllowlist().includes(trimmed);
}
