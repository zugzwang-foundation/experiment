// Compose the public URL for an identity's PFP.
//
// SPEC.2 §12.7 (line 1308): the frontend composes `${R2_PFP_BASE_URL}/v1/${pfp_filename}`. ⚠ The spec writes that variable as `R2_PFP_BASE_URL`; the name that actually exists in `.env.example` and in Doppler `stg` is `R2_PUBLIC_URL_PFP`, which is what this module reads. Drift recorded rather than "corrected" in either direction — renaming a live secret to match prose is the more expensive mistake. The `v1/` prefix is the version sentinel per ADR-0011 — a future re-bake lands at `v2/` rather than overwriting.
//
// The bucket is public-read on `v1/*` and the objects carry a one-year immutable Cache-Control, so this is a plain long-lived URL with no signing.

// Deliberately permissive about the STEM so the `-<number>` segment ADR-0011 adds later needs no change here, and strict about everything that could leave the `v1/` prefix: no slash, no `..`, no scheme, no query.
const SAFE_FILENAME = /^[a-z0-9][a-z0-9-]*\.webp$/;

/** The silhouette every identity rendered before PFP-1, and the fallback now. */
export const PFP_PLACEHOLDER = "/pfp-placeholder.svg";

/**
 * Build the public PFP URL for a stored `pfp_filename`.
 *
 * Input: the `users.pfp_filename` value, which is NULL for a scrubbed identity (SPEC.1 §23). Output: an absolute R2 URL, or the local placeholder path.
 *
 * Falls back to the placeholder rather than throwing when the bucket base URL is unset — a missing env var should cost an avatar, not a whole profile page.
 */
// Warned once per process, not once per call: this resolves on every rendered avatar, so a busy debate page would otherwise emit hundreds of identical lines.
let warnedMissingBase = false;

export function pfpUrl(pfpFilename: string | null): string {
	if (!pfpFilename) return PFP_PLACEHOLDER;
	const base = process.env.R2_PUBLIC_URL_PFP;
	if (!base) {
		// Failing open is deliberate — a missing avatar must not take down a profile page — but it is otherwise indistinguishable from "this user has no PFP". Without this line a misconfigured deploy renders every identity as a silhouette and reports nothing.
		if (!warnedMissingBase) {
			warnedMissingBase = true;
			console.warn(
				"[pfp-url] R2_PUBLIC_URL_PFP is unset — every PFP is rendering the placeholder. Set it in the Doppler config for this environment.",
			);
		}
		return PFP_PLACEHOLDER;
	}
	if (!SAFE_FILENAME.test(pfpFilename)) {
		// `scripts/seed-identity-pool.ts` parses an operator-supplied CSV straight into this column with no format check, so a malformed row reaches here verbatim. Nothing participant-reachable writes it (`input: false` at auth/index.ts), but a guard here closes the whole class instead of today's instance.
		return PFP_PLACEHOLDER;
	}
	return `${base.replace(/\/+$/, "")}/v1/${pfpFilename}`;
}
