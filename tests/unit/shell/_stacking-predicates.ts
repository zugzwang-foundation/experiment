// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * The stacking contract's predicates — ONE definition, imported by both files
 * that need them.
 *
 * ⛔ THIS MODULE EXISTS BECAUSE THE TWO COPIES ALREADY DRIFTED, INSIDE A SINGLE
 * SESSION. `sticky-header.test.ts` owns the rule; `stacking-contract.test.ts`
 * audits it by asserting the rejections the rule claims but never runs against
 * anything real. The audit originally LIFTED these regexes out of the guard's
 * source text and then re-implemented the surrounding logic locally — which held
 * for exactly as long as nobody changed the logic. The moment `underlayTiers`
 * gained a `.filter(n => n > 0)` (the `-z-0` fix) and `UNDERLAY_TOKEN` lost its
 * variant prefix, the audit was still running the old shape and certifying a rule
 * nobody ships. Its own docblock forbids precisely that: *"a copy drifts and then
 * certifies a pattern nobody ships."*
 *
 * ⇒ A shared module makes the drift unrepresentable rather than merely
 * discouraged (O-1: structural beats procedural). Neither file may re-declare
 * these; `stacking-contract.test.ts` asserts that the guard imports them from
 * here, so re-inlining a copy reddens.
 */

/**
 * A POSITIVE Tailwind `z-<n>` tier, as an unprefixed class token.
 *
 * ⚠ The lookbehind excludes three things and each one matters. `-` so the
 * NEGATIVE utility `-z-10` is never read as tier 10 — inverting the very
 * comparison this contract makes. `:` so a VARIANT-scoped `md:z-50` is not read
 * as an unconditional declaration: below that breakpoint the element is `fixed`
 * with `z-index: auto`, ordered against the header by DOM position alone, which
 * is the unranked state the contract exists to reject. `\w` so a token merely
 * ending in `z-<n>` cannot match.
 */
export const Z = /(?<![-:\w])z-(\d+)\b/g;

/**
 * A NEGATIVE Tailwind `-z-<n>` tier, anchored whole and unprefixed.
 *
 * ⚠ Anchored at BOTH ends, so `md:-z-10` does not match — same variant reasoning
 * as `Z`, applied to the same rule's other side. An asymmetric rule is harder to
 * reason about than either symmetric one.
 */
export const UNDERLAY_TOKEN = /^-z-(\d+)$/;

/**
 * The positioning utility `fixed`, or a variant-prefixed `…:fixed`.
 *
 * ⚠ A CLASS TOKEN, never a substring: `-` is a word boundary, so `\bfixed\b`
 * against a whole class string matches Tailwind's `table-fixed` — a
 * `table-layout` utility with no positioning behaviour — and reports a `<table>`
 * as a document-level overlay. That false positive was live once.
 */
export const FIXED_TOKEN = /(^|:)fixed$/;

export const hasFixedToken = (classes: string): boolean =>
	classes.split(/\s+/).some((c) => FIXED_TOKEN.test(c));

/**
 * The negative tiers a class string declares.
 *
 * ⛔ STRICTLY NEGATIVE — `-z-0` IS NOT AN UNDERLAY, and omitting this filter was
 * a real weakening of the guard. Tailwind compiles the negative utility as
 * `z-index: calc(N * -1)`, so `-z-0` emits `calc(0 * -1)`, which computes to
 * **0**: a positioned layer that creates a stacking context, paints ABOVE
 * in-flow content, and sits BELOW the header. That is the silent failure the
 * whole contract exists to catch. Zero is the boundary and it belongs on the
 * overlay side of it.
 */
export const underlayTiers = (classes: string): number[] =>
	classes
		.split(/\s+/)
		.map((c) => UNDERLAY_TOKEN.exec(c))
		.filter((m): m is RegExpExecArray => m !== null)
		.map((m) => Number(m[1]))
		.filter((n) => n > 0);

/** The positive tiers a class string declares UNCONDITIONALLY. */
export const overlayTiers = (classes: string): number[] =>
	[...classes.matchAll(Z)].map((m) => Number(m[1]));

/**
 * The same two, but counting VARIANT-SCOPED tiers as well.
 *
 * ⛔ THE DISTINCTION IS LOAD-BEARING AND ONE RULE CANNOT USE A SINGLE PAIR.
 * A variant-scoped tier is not *sufficient* to declare a side — `fixed md:z-50`
 * leaves the element at `z-index: auto` below the breakpoint, unranked against
 * the header, which is the state this contract rejects. But it is still a real
 * declaration at the widths where it applies, so it absolutely counts when
 * asking whether a layer has put itself on BOTH sides: `fixed -z-10 md:z-50` is
 * an underlay below `md` and an overlay above it, and calling that "an underlay"
 * because the overlay half carries a prefix would wave through the exact
 * ambiguity the both-sides check exists to catch.
 *
 * ⇒ "Does it declare a side?" and "is its declared tier above the header?" ask
 * the UNPREFIXED pair. "Has it declared both sides?" asks these.
 */
const ANY_Z = /(?<![-\w])z-(\d+)\b/g;
const ANY_UNDERLAY_TOKEN = /(^|:)-z-(\d+)$/;

export const anyOverlayTiers = (classes: string): number[] =>
	[...classes.matchAll(ANY_Z)].map((m) => Number(m[1]));

export const anyUnderlayTiers = (classes: string): number[] =>
	classes
		.split(/\s+/)
		.map((c) => ANY_UNDERLAY_TOKEN.exec(c))
		.filter((m): m is RegExpExecArray => m !== null)
		.map((m) => Number(m[2]))
		.filter((n) => n > 0);
