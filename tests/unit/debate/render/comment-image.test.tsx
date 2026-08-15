// @vitest-environment jsdom

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { CommentImage } from "@/components/debate/CommentImage";

/**
 * POLISH.3 PR 2 · C1 — the post-image geometry guard (plan §7; §6 row T2,
 * Tier B-2).
 *
 * Row T2 (C4) — `CommentImage.tsx:28 (CommentImage → img className)` vs
 * `d5:648-654 (.argimg/.media)`. RULED at §17 `H-T2`, 2026-08-13:
 * **ASPECT-RESPECTING WITHIN A MAX BOX** — natural aspect, bounded by
 * `--imgmax` on HEIGHT and 100% on width, corners `--imgr`.
 * ⛔ No fixed box ⇒ the `object-fit` question does not arise.
 *
 * ⚠ NOTE THE AXIS CHANGE, WHICH IS THE ROW'S WHOLE SUBSTANCE. The build binds
 * `max-w-[var(--imgmax)]`; this ruling moves the bound to HEIGHT with width at
 * 100%. A guard that only asserted "an `--imgmax` bound exists" would pass on
 * the unfixed build.
 *
 * ⚠ THE ONLY BUILD DECISION IN THE PLAN, and deliberately not bucket D. The
 * mockup DECLINES to rule: it carries two aspects on purpose (`d5:1079
 * .media.land` 220:96 on YES, `d5:1242 .media.rdt` 640:586 on NO) and files the
 * choice OPEN at `d5:241-244`. Neither answer can be filed as "the mockup is
 * superseded", because the mockup never decided. `"Shown whole · any
 * orientation"` is a PROMISE TO THE AUTHOR (composer hint, canon §107), and a
 * fixed 640:586 box keeps it literally while breaking it practically.
 *
 * ⚠ THE COST, RECORDED: card heights vary, so the two columns read less
 * regularly than a fixed box would give. That is the price of the promise,
 * accepted knowingly. Card-height variance is the CAROUSEL's problem, and the
 * carousel is deferred.
 *
 * ⚠ `--imgmax: 160px` / `--imgr: 6px` at `globals.css:179-180 (:root)`, both
 * re-verified EXACT at the branch point. Asserted BY TOKEN — a raw hex or a
 * literal `160px` here would also redden Ruling A's `no-raw-hex-view-layer`.
 *
 * No jest-dom in this repo (AGENTS.md §9) — plain DOM only.
 */

afterEach(cleanup);

const noop = () => {};

function renderImage() {
	const { container } = render(
		<CommentImage url="https://example.invalid/fixture-image" onOpen={noop} />,
	);
	const img = container.querySelector("img");
	expect(img).not.toBeNull();
	return img as HTMLImageElement;
}

describe("POLISH.3 PR 2 — T2, the post image is aspect-respecting in a max box", () => {
	it("comment-image::the-imgmax-bound-is-on-HEIGHT", () => {
		// The ruled half. `--imgmax` governs the HEIGHT axis after T2.
		const img = renderImage();

		expect(img.getAttribute("class")).toContain("max-h-[var(--imgmax)]");
	});

	it("comment-image::the-superseded-WIDTH-bound-is-gone", () => {
		// The axis CHANGE, asserted as a change. Without this the fix could add
		// a height bound and leave the width bound in place, which is a fixed
		// box in all but name — the thing H-T2 ruled against.
		const img = renderImage();

		expect(img.getAttribute("class")).not.toContain("max-w-[var(--imgmax)]");
	});

	it("comment-image::width-is-BOUNDED-at-100-percent-not-stretched", () => {
		// "100% width" — the second half of the ruled recipe, and §17 phrases it
		// as "BOUNDED BY `--imgmax` on height AND 100% on width". Both are max-*
		// BOUNDS, which is precisely why the ruling can say "no fixed box ⇒ the
		// `object-fit` question does not arise": with no pinned axis the UA keeps
		// the intrinsic aspect on its own.
		//
		// ⛔ TIGHTENED at C4 (@code-reviewer LOW-6). The original assertion read
		// `toContain("w-full")`, which "max-w-full" satisfies as a SUBSTRING — so
		// it could not tell a bound from a stretch. A bare `w-full` would force
		// width to 100% and then clamp height at `--imgmax`, BREAKING the aspect:
		// the one outcome H-T2 exists to forbid. Asserted on the token list, not
		// on a substring.
		const tokens = (renderImage().getAttribute("class") ?? "").split(/\s+/);

		expect(tokens).toContain("max-w-full");
		expect(tokens).not.toContain("w-full");
	});

	it("comment-image::corners-ride-the-ratified-imgr-token", () => {
		// `--imgr` is RATIFIED (values-log §3 item 2: images, avatars, media,
		// graph panels). Carried through the change, not re-decided.
		const img = renderImage();

		expect(img.getAttribute("class")).toContain("rounded-[var(--imgr)]");
	});
});
