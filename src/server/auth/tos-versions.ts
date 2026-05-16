// ToS / Privacy placeholder constants per SCAFFOLD.3 plan §3 + Q4. Used by
// `acceptTosAction` (writes hashes into `users.tos_version_hash` /
// `privacy_version_hash` as acceptance evidence) and by the onboarding page
// (renders REID_WARNING_TEXT in the emphasised callout block).
//
// HARDEN.7 swaps in real legal text + recomputes hashes after the lawyer
// review per plan §8 (out of scope).

export const TOS_VERSION_HASH = "placeholder-tos-v0";
export const PRIVACY_VERSION_HASH = "placeholder-privacy-v0";

// SPEC.1 §13 F-AUTH-4 line 684 verbatim. Load-bearing for the
// `tos::warning-text-matches-spec-1-line-684-verbatim` test — any drift
// (typo, punctuation, spacing) fails the assertion. The onboarding page
// renders this as an emphasised callout separate from and visually
// preceding the ToS body per SPEC.1 line 682 (ii).
export const REID_WARNING_TEXT =
	"Your pseudonym is public and your activity is recorded as a permanent record. Distinctive patterns in your writing or betting may allow others to re-identify you across platforms. If anonymity from de-anonymisation analysis matters to you, do not use this product.";
