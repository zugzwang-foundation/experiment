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
	const after = source.slice(at, at + 700);
	const cls = /className="([^"]*)"/.exec(after)?.[1] ?? "";
	return cls.split(/\s+/).filter(Boolean);
}

/** The className string on the `Argument title` textarea instance. */
function titleFieldClasses(): string[] {
	const at = source.indexOf('aria-label="Argument title"');
	if (at === -1) {
		throw new Error(
			`${COMPOSER}: no "Argument title" field. If the composer was restructured, ` +
				`re-derive this guard rather than deleting it.`,
		);
	}
	// ⚠ Wider window than the body field's: the title field's comment block
	// (RPLY-2 · R1's rationale for its floor) runs longer.
	const after = source.slice(at, at + 1300);
	const cls = /className="([^"]*)"/.exec(after)?.[1] ?? "";
	return cls.split(/\s+/).filter(Boolean);
}

describe("the composer fits without scrolling", () => {
	it("composer-fit::the-description-cannot-grow-by-content-or-by-drag", () => {
		const classes = bodyFieldClasses();

		// ⛔ FIXED, NOT UNBOUNDED — and asserted as the PROPERTY rather than as
		// one value. It read `toContain("h-24")`, which reddened at CS11 §1 when
		// the description grew to `h-32` to take the restored height. The number
		// was never the point: `field-sizing-content` (the primitive's default,
		// overridden below) lets CONTENT push the box taller, and a drag handle
		// lets the POINTER push it taller — `h-*` plus `resize-none` plus
		// `field-sizing-fixed` is what forecloses both, independent of whether a
		// `min-h-*` FLOOR also exists (RPLY-2 · R1 added one — see below).
		expect(classes.some((c) => /^h-\d+$/.test(c))).toBe(true);
		// The drag handle — the founder's actual report was dragging it.
		expect(classes).toContain("resize-none");
		// ⛔ The PRIMITIVE ships `field-sizing-content`, so the instance must
		// override it or the field still grows with typing even at a fixed height.
		// This is the half that is invisible in a screenshot and only shows up
		// once someone types a long argument.
		expect(classes).toContain("field-sizing-fixed");
	});

	it("composer-fit::RPLY-2-R1-the-textareas-shrink-toward-a-floor-below-their-fixed-height", () => {
		// ⛔⛔ THE OTHER HALF OF R1 — a `min-h-*` here is now DELIBERATE, not the
		// regression the test above used to reject outright (it asserted
		// `not.toContain("min-h-")` before this task; a bare min-height with no
		// ceiling was the old bug — CONTENT could push the box past it forever).
		// What makes THIS min-height safe is that it is paired with the definite
		// `h-*` above as a CEILING the field still declares: a flex item's
		// default `flex-shrink: 1` can compress a definite height down to its
		// `min-height` under real pressure from a short viewport, and no further
		// — a fundamentally different mechanism from `field-sizing-content`
		// (which has no ceiling at all). The browser measurement that proves the
		// shrink actually reaches usable numbers at 900/800/750/700/650px is
		// recorded in the run report, exactly as the file docblock says jsdom
		// cannot do this part.
		// Tailwind's bare `h-N` is the spacing SCALE (N × 4px); the bracket form
		// `h-[Npx]` is a literal — the two ceilings below use one of each, so
		// both conversions are exercised rather than assumed to agree.
		expect(titleFieldClasses()).toContain("h-[72px]");
		expect(bodyFieldClasses()).toContain("h-32"); // 32 × 4px = 128px

		const floorOf = (classes: string[]) => {
			const floorClass = classes.find((c) => /^min-h-\d+$/.test(c));
			expect(floorClass, "expected a min-h-* floor").toBeDefined();
			return Number(/^min-h-(\d+)$/.exec(floorClass ?? "")?.[1]) * 4;
		};
		// The floor must be strictly below the ceiling, or it isn't a floor — it
		// would just override the height outright.
		expect(floorOf(titleFieldClasses())).toBeGreaterThan(0);
		expect(floorOf(titleFieldClasses())).toBeLessThan(72);
		expect(floorOf(bodyFieldClasses())).toBeGreaterThan(0);
		expect(floorOf(bodyFieldClasses())).toBeLessThan(128);
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

describe("RPLY-2 · R1 — the argument region gives way; the money row never does", () => {
	/** The composer's outer `<section>` — its className string. */
	function sectionClasses(): string[] {
		const at = source.indexOf("<section");
		if (at === -1) {
			throw new Error(`${COMPOSER}: no <section>.`);
		}
		const cls =
			/className="([^"]*)"/.exec(source.slice(at, at + 900))?.[1] ?? "";
		return cls.split(/\s+/).filter(Boolean);
	}

	it("composer-fit::G1-the-section-root-carries-min-h-0-so-it-can-shrink-at-all", () => {
		// ⛔ Without this, the composer's own flex-shrink default has nothing to
		// act on — a flex item's automatic minimum size is its content, the same
		// rule `DebateColumn`'s docblock states for `column-scroll`. This is
		// what makes the rest of R1 able to do anything at a short viewport.
		expect(sectionClasses()).toContain("min-h-0");
	});

	it("composer-fit::G1-the-footblock-is-shrink-0-and-a-direct-child-of-the-section", () => {
		// ⛔⛔ THE WALL. The AMOUNT/notice block and the submit button must never
		// be the thing that gives when the column is short — they are pulled OUT
		// of the argument grid (where they used to live via `mt-auto`) to sit as
		// a sibling of the header and the argument region, both shrink-0.
		const footRowAt = source.indexOf("shrink-0 items-stretch gap-3${dimmed");
		expect(
			footRowAt,
			"expected the footblock row's shrink-0 flex declaration",
		).toBeGreaterThan(-1);
		// It must come AFTER the argument region's own closing, i.e. it is NOT
		// nested inside the scrollable region — `mt-auto` (the old positioning
		// trick, now meaningless outside a taller non-scrolling column) is gone.
		expect(source).not.toContain('<div className="mt-auto">');
		// And it must still hold the actual submit button and the notice slot —
		// a passing className check on an EMPTY row would prove nothing.
		const argRegionAt = source.indexOf(
			"flex min-h-0 -m-0.5 flex-col overflow-y-auto p-0.5${dimmed",
		);
		expect(argRegionAt).toBeGreaterThan(-1);
		expect(footRowAt).toBeGreaterThan(argRegionAt);
		const footRowToSubmit = source.slice(footRowAt, footRowAt + 7000);
		expect(footRowToSubmit).toContain('data-testid="composer-notice-slot"');
		expect(footRowToSubmit).toContain("aria-label={COMPOSER_COPY.submit}");
	});

	it("composer-fit::G2-the-argument-region-is-the-one-thing-that-shrinks-and-scrolls", () => {
		// ⛔ `min-h-0` (shrinkable) + `overflow-y-auto` (catches what shrinking
		// alone cannot) — deliberately NOT `flex-1`/flex-grow: measured, adding
		// grow here inflated the tall-viewport height with no functional gain
		// (see the file's own comment at this element for the arithmetic).
		const at = source.indexOf("overflow-y-auto p-0.5${dimmed");
		expect(
			at,
			"expected the argument-region wrapper's conditional dimmed className",
		).toBeGreaterThan(-1);
		const decl = source.slice(Math.max(0, at - 120), at + 40);
		expect(decl).toContain("flex min-h-0 -m-0.5 flex-col overflow-y-auto");
		expect(decl).not.toContain("flex-1");
	});

	it("composer-fit::G2-the-notice-slots-dimming-still-carries-through-to-the-footblock", () => {
		// ⛔ The footblock moved out from under the argument region's `dimmed`
		// ANCESTOR wrapper (RPLY-2 · R1), so it now needs the SAME class applied
		// directly, or the floor-above-balance (C2) state would dim the argument
		// but not the money row beside it — a form half-dead and half-not.
		const footblockDeclAt = source.indexOf("items-stretch gap-3${dimmed");
		expect(
			footblockDeclAt,
			"expected the footblock row's own conditional dimmed className",
		).toBeGreaterThan(-1);
	});
});
