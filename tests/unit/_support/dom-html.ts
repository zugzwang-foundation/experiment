// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * INFO-1 — normalizes Radix's own internally-generated ids out of a captured
 * `innerHTML` string before a byte-identity comparison.
 *
 * Radix's Popover/Tooltip trigger-content pairing links the two with its own
 * `aria-controls="radix-_r_<n>_"` (and a matching `id` on the content), built
 * on React's `useId()` UNDER Radix's own hood — a call this repo's code never
 * makes and cannot pass a stable value into. `useId()` prefixes by REACT
 * ROOT, so two independently-mounted `render()` calls of an otherwise
 * byte-identical tree disagree on this one substring, which breaks this
 * repo's established "does a 404 degrade to identical markup" idiom
 * (`market-thumb.test.tsx` and its siblings) the moment either render passes
 * through an `InfoTip`.
 *
 * Scoped to the literal `radix-_r_` prefix rather than a broad `id="..."`
 * strip: this repo's OWN generated ids (`InfoTip`'s `info-tip-<hash>`, a hash
 * of the fixed GLOSSARY content) are already deterministic across roots and
 * must NOT be normalized away — doing so would silently stop verifying that
 * this task's own id-generation is stable, which is the property that
 * actually matters here.
 *
 * ⚠ Currently a no-op for the touch/Popover branch these two tests exercise
 * (jsdom has no `matchMedia`, so both default there): `InfoTip` stopped using
 * `Popover.Trigger` — which stamped `type`/`aria-haspopup`/`aria-controls`
 * onto non-button hosts, a real bug — in favour of `Popover.Anchor` + a
 * manual `Slot` clone, and nothing on that path calls `useId()` anymore.
 * Left in place rather than removed: the pointer/Tooltip branch still relies
 * on Radix's own `useId()`-based `aria-describedby` by design (§ `info-tip.tsx`
 * — that one is correct to keep, unlike Popover's former `aria-controls`),
 * and any future byte-identity test exercising THAT branch would need this
 * same normalization. A one-line guard against a class of failure that
 * hasn't disappeared, only moved.
 */
export function normalizeRadixIds(html: string): string {
	return html.replace(/radix-_r_[a-z0-9]+_/gi, "radix-_ID_");
}
