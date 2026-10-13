// ToS / Privacy version identifiers. `acceptTosAction` writes them into
// `users.tos_version_hash` / `privacy_version_hash` as acceptance evidence, and
// `/legal` prints them beneath the documents they identify.
//
// WHAT THEY ARE: SPEC.1 §13 F-AUTH-4 defines each as the "content hash of the
// document the user was shown". So each is the lowercase hex SHA-256 of the
// exact committed bytes of `public/legal/tos.txt` / `public/legal/privacy.txt`
// (Version 1.1 since EXT-1 / D-55, which moved the experiment's end; Version
// 1.0 was installed byte for byte at LEGAL.1, #413) — the files `/legal` reads
// and renders. They are derived from the documents, not chosen. Nobody is
// re-prompted by a new version: the sign-in gate checks only that an
// acceptance exists (`session-gate.ts`), so a 1.0 accepter keeps the 1.0
// hashes as their record.
//
// ⚠ THE RETIRED 1.0 IDENTIFIERS, kept here because this file was the only
// place in the tree that named them and every pre-EXT-1 `users` row and
// `user.tos_accepted` event still carries them:
//   ToS     1.0  68486dee59cc57301a79dd37bef4593fd0a9d647be24158d350d262da9025a27
//   Privacy 1.0  da55d1a88f1b488c0c59bd3d814c3a86f4950aefeec3ff7fb13618b963c9d691
// The bytes they hash are in git, not on disk: `git show
// 8011d379:public/legal/tos.txt` (and `privacy.txt`) reproduces both.
//
// ⛔ FROZEN AS LITERALS, AND GUARDED. The spec asks for hashes frozen at
// deployment; a literal is frozen by construction, and
// `tests/unit/auth/tos-version-hashes.test.ts` recomputes both from the files
// and fails the build if either document changes without its identifier. A
// changed document with an unchanged hash would record acceptance of text the
// participant never saw — the one failure acceptance evidence must not have.

export const TOS_VERSION_HASH =
	"997234f7424091f5bb1a39233a4bdd7643e037628376977c064df7cad97a2e54";
export const PRIVACY_VERSION_HASH =
	"b3bc2f9e3436966238ed618a33a0aadbed0d7023639babd90e29653c228794cf";

// SPEC.1 §13 F-AUTH-4 line 684 verbatim. Load-bearing for the
// `tos::warning-text-matches-spec-1-line-684-verbatim` test — any drift
// (typo, punctuation, spacing) fails the assertion. The onboarding page
// renders this as an emphasised callout separate from and visually
// preceding the ToS body per SPEC.1 line 682 (ii).
export const REID_WARNING_TEXT =
	"Your pseudonym is public and your activity is recorded as a permanent record. Distinctive patterns in your writing or betting may allow others to re-identify you across platforms. If anonymity from de-anonymisation analysis matters to you, do not use this product.";
