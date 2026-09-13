// Compose the public URL for an identity's PFP.
//
// SPEC.2 §12.7 (line 1308): the frontend composes `${R2_PFP_BASE_URL}/v1/${pfp_filename}`. ⚠ The spec writes that variable as `R2_PFP_BASE_URL`; the name that actually exists in `.env.example` and in Doppler `stg` is `R2_PUBLIC_URL_PFP`, which is what this module reads. Drift recorded rather than "corrected" in either direction — renaming a live secret to match prose is the more expensive mistake. The `v1/` prefix is the version sentinel per ADR-0011 — a future re-bake lands at `v2/` rather than overwriting.
//
// The bucket is public-read on `v1/*` and the objects carry a one-year immutable Cache-Control, so this is a plain long-lived URL with no signing.

// R2-REPLACE-IN-PLACE — why the URL now carries `?v=`. That one-year immutable header is stored ON THE OBJECTS (ADR-0011), so no code can shorten it: a browser that has seen a PFP keeps it for a year and never rechecks, even on reload. That was harmless while ADR-0011's rule held — a re-bake lands at `v2/`, never over `v1/`. PFPs were then replaced in place at their existing keys, R2 served the new bytes immediately, and every browser that had seen the old ones kept showing them until a hard refresh. A browser cache is keyed on the URL, so the only thing that can reach a copy already cached is a DIFFERENT URL.

// Deliberately permissive about the STEM so the `-<number>` segment ADR-0011 adds later needs no change here, and strict about everything that could leave the `v1/` prefix: no slash, no `..`, no scheme, no query.
const SAFE_FILENAME = /^[a-z0-9][a-z0-9-]*\.webp$/;

/** The silhouette every identity rendered before PFP-1, and the fallback now. */
export const PFP_PLACEHOLDER = "/pfp-placeholder.svg";

/**
 * Cache-busting version appended to every PFP URL.
 *
 * ⛔ BUMP THIS WHENEVER A PFP IS REPLACED IN PLACE IN THE BUCKET. Changing it changes every PFP URL, so every browser fetches the current bytes once and then caches them for a year as before. Leaving it unchanged after an in-place replacement ships exactly the defect this exists for, and nothing turns red.
 *
 * ⚠ ONE VALUE FOR THE WHOLE SET, deliberately, rather than per object. Per-object versions need a column or a HEAD request per avatar, and this resolves on every rendered avatar — hundreds per debate page. A global bump costs each visitor one re-download of ~5 KB per identity they see, and only when an operator chose to replace images.
 *
 * ⚠ The preferred path is still ADR-0011's: upload changed art under a new filename (`-v<N>`) and update `pfp_filename`, which needs no bump. This constant is for when that did not happen. Format is a UTC date, `YYYYMMDD`, so a reader can tell when the set last changed.
 */
export const PFP_ASSET_VERSION = "20260913";

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
	return `${base.replace(/\/+$/, "")}/v1/${pfpFilename}?v=${PFP_ASSET_VERSION}`;
}
