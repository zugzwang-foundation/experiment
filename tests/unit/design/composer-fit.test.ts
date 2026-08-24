import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * UI-QUICK change set 7 §3 — THE COMPOSER FITS ITS SLOT WITHOUT SCROLLING.
 *
 * WHAT THIS GUARD IS FOR. The description textarea could grow two ways: by
 * CONTENT (`ui/textarea.tsx` ships `field-sizing-content`) and by DRAG (the
 * browser's default resize handle). Either one pushes AMOUNT / TO WIN / PLACE Đ
 * BET below the fold and makes the column scroll.
 *
 * ⛔⛔ THE WALL THIS PROTECTS IS NOT "NO SCROLLING" — IT IS THAT THE SUBMIT
 * CONTROL IS NEVER UNREACHABLE. A scroll is an annoyance; a submit a
 * participant cannot reach means they cannot bet at all, which on this surface
 * also means they cannot post an argument (mandatory commentary — the two are
 * one action). That is why the fields are pinned to fixed heights rather than
 * merely capped.
 *
 * ⚠⚠ WHY A SOURCE SCAN, stated rather than glossed. jsdom performs NO layout:
 * no `h-24`, no flexbox, no `scrollHeight`. A render test structurally cannot
 * measure a fit — the four height chains and `aggregate-footer-alignment` say
 * the same thing for the same reason. What a source scan CAN pin is the set of
 * declarations that produce the fit; the browser measurement that proves they
 * compose is recorded in the change-set file (scrollHeight vs clientHeight at
 * three viewports).
 *
 * ⛔ FENCE BY SYMBOL, NEVER BY LINE (O-8).
 */

const ROOT = process.cwd();
const COMPOSER = "src/components/debate/composer/BetComposer.tsx";
const TEXTAREA = "src/components/ui/textarea.tsx";
const source = readFileSync(join(ROOT, COMPOSER), "utf8");

/** The className string on the `Argument body` textarea instance. */
function bodyFieldClasses(): string[] {
	const at = source.indexOf('aria-label="Argument body"');
	if (at === -1) {
		throw new Error(
			`${COMPOSER}: no "Argument body" field. If the composer was restructured, ` +
				`re-derive this guard rather than deleting it.`,
		);
	}
	const after = source.slice(at, at + 400);
	const cls = /className="([^"]*)"/.exec(after)?.[1] ?? "";
	return cls.split(/\s+/).filter(Boolean);
}

describe("the composer fits without scrolling", () => {
	it("composer-fit::the-description-cannot-grow-by-content-or-by-drag", () => {
		const classes = bodyFieldClasses();

		// ⛔ FIXED, not a floor. `min-h-24` let content push the box taller; `h-24`
		// does not. This is the single most load-bearing token in the file.
		expect(classes).toContain("h-24");
		expect(classes).not.toContain("min-h-24");
		// The drag handle — the founder's actual report was dragging it.
		expect(classes).toContain("resize-none");
		// ⛔ The PRIMITIVE ships `field-sizing-content`, so the instance must
		// override it or the field still grows with typing even at a fixed height.
		// This is the half that is invisible in a screenshot and only shows up
		// once someone types a long argument.
		expect(classes).toContain("field-sizing-fixed");
	});

	it("composer-fit::the-shared-textarea-primitive-is-NOT-edited", () => {
		// ⛔ The override is per-INSTANCE. `ui/textarea.tsx` is shared by every
		// textarea in the app, and making the composer's problem the primitive's
		// rule would change fields this task never looked at.
		const primitive = readFileSync(join(ROOT, TEXTAREA), "utf8");
		expect(primitive).toContain("field-sizing-content");
		expect(primitive).not.toContain("resize-none");
	});

	it("composer-fit::the-submit-is-never-clipped-and-keeps-a-usable-target", () => {
		// ⛔⛔ THE WALL. The submit grew in §4 to take the space above it; it must
		// not have shrunk below a usable hit target in the process, and it must not
		// be given a fixed height that could clip its own two-line label.
		const at = source.indexOf("aria-label={COMPOSER_COPY.submit}");
		expect(at).toBeGreaterThan(-1);
		const cls =
			/className="([^"]*)"/.exec(source.slice(at, at + 400))?.[1] ?? "";
		const classes = cls.split(/\s+/).filter(Boolean);
		// `h-auto` + a MIN height: the box grows to its label, never crops it.
		expect(classes).toContain("h-auto");
		expect(classes.some((c) => /^min-h-\[\d+px\]$/.test(c))).toBe(true);
		const min = Number(/min-h-\[(\d+)px\]/.exec(cls)?.[1] ?? "0");
		// Comfortably above the 24px floor a pointer target should never go under,
		// and above the 34px it carried before §4.
		expect(min).toBeGreaterThanOrEqual(44);
	});

	it("composer-fit::the-argument-field-is-still-REQUIRED", () => {
		// ⛔ THESIS INVARIANT, asserted here because §3 edits the very field that
		// carries it: no bet without a comment. Nothing in a layout change may
		// introduce a comment-free buy path, so the field keeps its length cap and
		// its gate rather than becoming optional.
		expect(source).toContain('aria-label="Argument body"');
		expect(source).toContain("maxLength={extendedMax}");
	});
});
