import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * UI-QUICK change set 6 §1 — THE SPLIT TRACK ALIGNS TO THE PILLS BESIDE IT.
 *
 * WHAT THIS GUARD IS FOR. `AggregateFooter` lays its three columns out with
 * `items-start`, so every column's FIRST child shares one top edge. The
 * Support/Counter columns lead with a ~25px pill; the centre column leads with a
 * 6px track. Two different first-child heights on one top edge put the bar 9.5px
 * above the controls it belongs to — measured on staging at 1440×777 (track
 * centre 696.00 · Support 705.50 · Counter 706.00).
 *
 * The fix is that the track sits inside a box the same height as the pill and
 * centres in it. This file pins that box, because it is the only thing standing
 * between the strip and a silent return to the old alignment.
 *
 * ⚠⚠ WHY A SOURCE SCAN. jsdom performs no layout — no `h-6`, no flexbox, no
 * computed centre — so a render test structurally cannot see this. The four
 * height chains say the same thing for the same reason. What CAN be pinned is
 * the declaration that produces the alignment, and a browser measurement proves
 * it composes (recorded in the change-set file: after, at both 1440×777 and a
 * shorter viewport).
 *
 * ⛔ FENCE BY SYMBOL, NEVER BY LINE (O-8). Everything below names a `data-testid`
 * or a class token; no line number is load-bearing.
 *
 * ⚠ THIS IS THE FIRST GEOMETRIC GUARD OVER THIS STRIP. The recon's 4e found that
 * nothing under `tests/unit/design/` referenced `aggregate-footer` or
 * `aggregate-split` at all — the four height chains stop at `column-scroll`, and
 * the strip's existing tests are content/copy only. So a regression here was
 * invisible to the whole suite.
 */

const ROOT = process.cwd();
const FOOTER = "src/components/debate/AggregateFooter.tsx";
const source = readFileSync(join(ROOT, FOOTER), "utf8");

/**
 * The class string of the element WRAPPING the split track — the node whose
 * height defines where the track's centre lands. Found by walking back from the
 * track's own testid to the opening tag before it.
 */
function trackWrapperClasses(): string[] {
	const at = source.indexOf('data-testid="aggregate-split-track"');
	if (at === -1) {
		throw new Error(
			`${FOOTER}: no aggregate-split-track. If the strip was restructured, ` +
				`re-derive this guard rather than deleting it.`,
		);
	}
	// The wrapper is the nearest `<span` opening BEFORE the track's own `<span`.
	const ownTag = source.lastIndexOf("<span", at);
	const wrapperTag = source.lastIndexOf("<span", ownTag - 1);
	const slice = source.slice(wrapperTag, ownTag);
	const cls = /className="([^"]*)"/.exec(slice)?.[1] ?? "";
	return cls.split(/\s+/).filter(Boolean);
}

describe("the aggregate footer — the track aligns to the pills", () => {
	it("aggregate-footer::the-track-sits-in-a-pill-height-box-and-centres-in-it", () => {
		const classes = trackWrapperClasses();

		// ⛔ THE THREE DECLARATIONS THAT PRODUCE THE ALIGNMENT. `h-6` is the pill's
		// own specified box (`text-xs` 16px line + `py-1` 8px); `items-center`
		// centres the 6px track inside it; `flex` is what makes `items-center`
		// mean anything at all.
		expect(classes).toContain("flex");
		expect(classes).toContain("h-6");
		expect(classes).toContain("items-center");
		// The track is `w-full` and needs its wrapper to span the column, or the
		// bar would shrink to its content and stop being a proportion of anything.
		expect(classes).toContain("w-full");
	});

	it("aggregate-footer::the-row-still-top-aligns-its-columns", () => {
		// ⛔ THE ROW IS DELIBERATELY UNCHANGED, and pinning that is the point.
		// `items-start` → `items-center` is the obvious-looking fix and it does NOT
		// work: it centres the COLUMNS while the track stays its column's first
		// child, landing ~2px off — better than 9.5px, still outside the 1px bar.
		// If a later reader "simplifies" the wrapper away in favour of that swap,
		// this assertion is what tells them it was already tried.
		// ⛔⛔ THE READER TOLERATES `cn(...)`, AND IT HAD TO LEARN TO AT MOBILE-2m.
		// This anchor read `className="([^"]*)"` and went RED the moment R-1 gave
		// the row a conditional band — not because the property broke, but because
		// the row stopped being a bare string literal. That is the failure mode a
		// source scan has that a render does not: it asserts a SPELLING and calls
		// it a property. The alternation reads the first `cn` argument, which is
		// where this file's own convention puts the unconditional base classes.
		// ⚠ It deliberately does NOT read the later arguments: a token that only
		// applies under a condition is not "on the row", and matching it here
		// would let a conditional `items-start` satisfy a guard about the
		// unconditional one.
		const m =
			/data-testid="aggregate-footer"\s+className=(?:"([^"]*)"|\{cn\(\s*"([^"]*)")/.exec(
				source,
			);
		const row = m?.[1] ?? m?.[2];
		if (!row) {
			throw new Error(`${FOOTER}: no aggregate-footer row with a className.`);
		}
		expect(row.split(/\s+/)).toContain("items-start");
	});

	it("aggregate-footer::the-track-matches-the-market-level-bar-thickness", () => {
		// ⚠⚠ change set 10 §6a — MEASURED BEFORE CHANGING: the S/C track was
		// `h-1.5` (6px) while `PriceBar`'s `detail` size — the market-level YES/NO
		// split bar on this same surface — is `h-[14px]`. One screen, two split
		// bars, and one of them read as a hairline beside the other.
		// ⚠ `detail`, not `hero` (22px) or `card` (16px): those render on the
		// Discovery surfaces, and the comparison a reader actually makes is
		// against the bar in the same viewport.
		// ⛔ PINNED AGAINST `PriceBar`'S OWN DECLARATION, not against a copied
		// literal. If the market bar is re-sized, this reddens and the two are
		// re-decided together rather than drifting apart in silence.
		const bar = readFileSync(
			join(ROOT, "src/components/debate/PriceBar.tsx"),
			"utf8",
		);
		const detail = /detail:\s*\{\s*bar:\s*"h-\[(\d+)px\]"/.exec(bar)?.[1];
		expect(detail).toBeDefined();

		const at = source.indexOf('data-testid="aggregate-split-track"');
		const cls =
			/className=\{cn\(\s*(?:\/\/[^\n]*\n\s*)*"([^"]*)"/.exec(
				source.slice(at, at + 4000),
			)?.[1] ?? "";
		expect(cls).toContain(`h-[${detail}px]`);
		// The superseded thickness, pinned as gone.
		expect(cls).not.toContain("h-1.5");

		// ⚠⚠ change set 11 §2 — THE RADIUS TRAVELS WITH THE THICKNESS. At 6px the
		// corner treatment was invisible; at 14px a 3px radius read as a RECTANGLE
		// beside a market bar that is a pill. `design-language` names these ONE
		// split-bar family — two variants of one construction — so they must not
		// diverge in shape.
		// ⛔ READ OFF `PriceBar` TOO, so a change to the market bar takes BOTH or
		// NEITHER. A literal here would let the two drift apart the moment that
		// component is restyled, which is the whole failure this pins against.
		const barRadius = /rounded-\[var\(--r\)\]/.test(bar);
		expect(barRadius).toBe(true);
		expect(cls).toContain("rounded-[var(--r)]");
		expect(cls).not.toContain("rounded-(--r-dot)");
		// The clip is half the shape: PriceBar's fills carry no radius of their
		// own and rely on the track clipping them. Mirrored here.
		expect(cls).toContain("overflow-hidden");
	});

	it("aggregate-footer::ONE-component-serves-every-mount", () => {
		// The alignment is fixed in one place because there IS one place. Three
		// call sites — PostCard's removed branch, PostCard's present branch, and
		// the post pop-up — all render this component, so they move together.
		const card = readFileSync(
			join(ROOT, "src/components/debate/PostCard.tsx"),
			"utf8",
		);
		const dialogs = readFileSync(
			join(ROOT, "src/components/debate/dialogs.tsx"),
			"utf8",
		);
		const mounts =
			(card.match(/<AggregateFooter\b/g) ?? []).length +
			(dialogs.match(/<AggregateFooter\b/g) ?? []).length;
		expect(mounts).toBe(3);
		// …and there is exactly ONE definition of the strip, so no second copy can
		// drift out of alignment behind this guard's back.
		expect(
			(source.match(/data-testid="aggregate-split-track"/g) ?? []).length,
		).toBe(1);
	});
});
