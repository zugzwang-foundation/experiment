import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * WHERE THE LEFTOVER HEIGHT GOES WHEN THE SCREEN IS TALLER THAN THE COMPOSER.
 *
 * WHAT THIS GUARD IS FOR. The arena is `h-[calc(100dvh-60px-2px)]` and the
 * composer slot is `flex-1`, so both grow with the viewport; `BetComposer`'s
 * section root is `shrink-0` and content-sized and deliberately refuses
 * `flex-1`. A flex column with no `justify-content` packs to the start, so on a
 * screen taller than the ladder the composer was measured against — 1280×800
 * and 900/800/750/700/650 — the slack landed underneath it as dead space.
 * REPORTED from a 15" laptop at roughly 350px; the same gap is ~95px at the
 * pinned 1440×777, which is why it read as padding for so long.
 *
 * ⛔⛔ THE ASSERTION THAT MATTERS IS THE `safe` ONE, AND IT GUARDS AGAINST THE
 * OBVIOUS FIX RATHER THAN AGAINST THE ORIGINAL DEFECT. Plain `justify-center`
 * removes the same dead space and looks correct on the screen the author is
 * using — then, on every SHORT viewport, it centres a composer that is taller
 * than its slot and overflows it in BOTH directions, pushing the title field out
 * of the clip rect where no scroll can reach it. `safe center` centres only
 * while the content fits and falls back to `flex-start` the moment it would
 * overflow, so the entire short-viewport ladder is unchanged byte for byte.
 * A browser with no `safe` support drops the declaration and also lands on the
 * old behaviour — the change cannot regress what it does not improve.
 *
 * ⚠⚠ THE TOKEN IS ASSEMBLED AT RUNTIME AND THAT IS NOT STYLE (AGENTS.md §9).
 * Tailwind v4's source detection scans `tests/` as well as `src/`, so a
 * class-shaped literal in this file becomes a real emitted utility — which
 * would make a grep of the built stylesheet self-fulfilling and hide the exact
 * failure this guard exists to catch, a utility that never compiled from source.
 * `profile-mobile-reflow.test.ts` does the same for the same reason.
 *
 * ⛔ FENCE BY SYMBOL, NEVER BY LINE (O-8). The anchor is the `className=`
 * assignment inside `ComposerSlot`, not a line number.
 *
 * ⚠⚠ WATCHED FAILING BEFORE IT WAS TRUSTED (V-2). With the token removed the
 * first case goes RED; with it swapped for plain `justify-center` the second
 * goes RED. A guard nobody has seen fail is a guard nobody has tested.
 */

const ROOT = process.cwd();
const SLOT = "src/components/debate/composer/ComposerSlot.tsx";
const source = readFileSync(join(ROOT, SLOT), "utf8");

// Assembled, never written whole — see the docblock.
const PROP = "justify-content";
const SAFE = `safe${"_"}center`;
const TOKEN = `[${PROP}:${SAFE}]`;

/**
 * The slot's own `className` string — the one carrying `flex-1`, which is the
 * growing box. Anchored on that class rather than on a line range so the
 * animation tokens beside it can change without re-deriving this guard.
 */
function slotClassName(): string {
	const match = /className="([^"]*\bflex-1\b[^"]*)"/.exec(source);
	if (!match?.[1]) {
		throw new Error(
			`${SLOT}: no \`className\` carrying \`flex-1\`. If the slot stopped ` +
				`being the growing box, re-derive this guard rather than deleting ` +
				`it — the defect it answers is dead space under a composer on a ` +
				`tall screen.`,
		);
	}
	return match[1];
}

describe("the composer slot — a tall screen leaves no dead space below", () => {
	it("composer-slot::leftover-height-is-centred-not-packed-to-the-start", () => {
		// Remove the token and the slack goes back under the composer: ~350px of
		// it at 1080p, which is the reported defect.
		expect(slotClassName()).toContain(TOKEN);
	});

	it("composer-slot::the-centring-is-SAFE-so-short-viewports-never-clip-the-top", () => {
		const className = slotClassName();

		// ⛔ THE REGRESSION THIS FILE REALLY GUARDS. `justify-center` without
		// `safe` clips the top of the form on every viewport the composer was
		// actually tuned for, and it does it silently — the form still renders,
		// it just starts above the visible area.
		expect(className).not.toMatch(/\bjustify-center\b/);
		expect(className).toContain(SAFE);
	});

	it("composer-slot::the-slot-still-grows", () => {
		// The centring is only meaningful while the slot is the box absorbing the
		// arena's leftover height. Lose `flex-1` and there is nothing to centre
		// within, and this guard would be pinning a no-op.
		const className = slotClassName();
		expect(className).toContain("flex-1");
		expect(className).toContain("min-h-0");
	});
});
