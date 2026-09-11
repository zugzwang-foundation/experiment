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
const IMAGE_ATTACH = "src/components/debate/composer/ImageAttach.tsx";
const source = readFileSync(join(ROOT, COMPOSER), "utf8");
const ATTACH = readFileSync(join(ROOT, IMAGE_ATTACH), "utf8");

/**
 * The className string on the field instance labelled `label`.
 *
 * ⚠⚠ THE CHARACTER WINDOW IS GONE, AND IT WENT BECAUSE IT SILENTLY BROKE. Both
 * halves of this used to slice a fixed number of characters forward from the
 * `aria-label` (700 for the body, 1300 for the title, the second already widened
 * once "because the title field's comment block runs longer"). RPLY-3 added four
 * lines to that comment and the window stopped reaching the `className` — the
 * regex matched nothing, the helper returned `[]`, and the guard failed with
 * `expected [] to include 'h-[72px]'` rather than with anything about the
 * property it guards.
 *
 * ⇒ A WINDOW MEASURED IN CHARACTERS IS `O-8` ONE LEVEL DOWN: it fences by
 * distance, which every edit to the prose in between moves. The bound is now the
 * NEXT `aria-label=` in the file — a symbol, and the real end of this element's
 * attribute list, so no amount of commentary inside it can push the target out
 * of range.
 */
function fieldClasses(label: string): string[] {
	const at = source.indexOf(`aria-label="${label}"`);
	if (at === -1) {
		throw new Error(
			`${COMPOSER}: no "${label}" field. If the composer was restructured, ` +
				`re-derive this guard rather than deleting it.`,
		);
	}
	const nextLabel = source.indexOf("aria-label=", at + 1);
	const after = source.slice(at, nextLabel === -1 ? undefined : nextLabel);
	const match = /className=(?:"([^"]*)"|{[\s\S]*?}\n|\n)/.exec(after);
	const rawCls = match?.[1] || match?.[2] || match?.[0] || "";
	const cls = rawCls.replace(/[{}`'"?:\n\r\t]/g, " ");
	if (cls.trim() === "") {
		throw new Error(
			`${COMPOSER}: the "${label}" field declares no className before the next ` +
				`labelled element. Re-derive this guard rather than widening a window.`,
		);
	}
	return cls.split(/\s+/).filter(Boolean);
}

const bodyFieldClasses = () => fieldClasses("Argument body");
const titleFieldClasses = () => fieldClasses("Argument title");

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
		expect(classes.some((c) => /^h-(?:\d+|\[\d+px\])$/.test(c))).toBe(true);
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
		expect(
			titleFieldClasses().some((c) => c === "h-[72px]" || c === "h-[48px]"),
		).toBe(true);
		expect(
			bodyFieldClasses().some((c) => c === "h-32" || c === "h-[80px]"),
		).toBe(true);

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

describe("RPLY-3 · R1 — the argument fields give way; the money row never does", () => {
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

	/** Byte offset of the `.compright` column's own declaration. */
	function rightColumnAt(): number {
		const at = source.indexOf(
			'<div className="flex min-h-0 min-w-0 flex-col gap-2">',
		);
		expect(at, "expected the `.compright` column declaration").toBeGreaterThan(
			-1,
		);
		return at;
	}

	/**
	 * The `className={…}` / `className="…"` attribute whose value CONTAINS
	 * `marker`, returned whole — attribute text and the offset it starts at.
	 *
	 * ⚠⚠ THIS EXISTS BECAUSE THE FIRST DRAFT OF TWO GUARDS BELOW RED FOR THE
	 * WRONG REASON, WHICH IS A DEFECT EVEN WHEN THE COLOUR IS RIGHT (`O-3` —
	 * diagnosis quality is a safety property). Those guards anchored on the
	 * class string VERBATIM, so the mutations written to prove they fire —
	 * re-applying `dimmed` to the footblock, restoring `overflow-y-auto` on the
	 * argument region — changed the very string being searched for. The guard
	 * went red reporting `expected -1 to be greater than -1`, i.e. "I could not
	 * find the element", while the assertion about the PROPERTY never ran at
	 * all. A guard that cannot tell "this element is wrong" from "this element
	 * is gone" will one day report the second when it means the first.
	 *
	 * ⇒ The anchor is now a class TOKEN that survives both the correct and the
	 * mutated form, and the attribute is read outward from it.
	 */
	function classAttrContaining(marker: string): { text: string; at: number } {
		const hit = source.indexOf(marker);
		expect(
			hit,
			`expected a className containing \`${marker}\``,
		).toBeGreaterThan(-1);
		const attrAt = source.lastIndexOf("className=", hit);
		expect(
			attrAt,
			`expected a className= before \`${marker}\``,
		).toBeGreaterThan(-1);
		// To the end of the attribute: a quoted string, or a `{`…`}` expression.
		const valueAt = attrAt + "className=".length;
		let end: number;
		if (source[valueAt] === '"') {
			end = source.indexOf('"', valueAt + 1) + 1;
		} else {
			// ⚠⚠ BRACE-MATCHED, NOT LINE-MATCHED — AND THE FIRST DRAFT WAS THE
			// SECOND, INSIDE THE VERY HELPER MINTED TO END FENCING BY DISTANCE.
			// It ended the `{`-expression arm at the first `}\n`, which the
			// argument region's attribute does not contain: that one ends `}>` on
			// its own line, so the search ran on and returned 195 characters where
			// the attribute is 65 — swallowing the NEXT element's whole opening tag
			// and its text child. Every `not.toContain` over the result was then an
			// assertion about two elements, passing on whatever the following bytes
			// happened to hold, and a `flex-1` added to the ARGUMENT LABEL would
			// have reddened a guard that names the argument region. Counting braces
			// is the only thing that ends where the attribute actually ends.
			// Caught by `@code-reviewer` (MEDIUM), measured rather than argued.
			let depth = 0;
			end = valueAt;
			for (let i = valueAt; i < source.length; i++) {
				if (source[i] === "{") {
					depth++;
				} else if (source[i] === "}") {
					depth--;
					if (depth === 0) {
						end = i + 1;
						break;
					}
				}
			}
			expect(end, `unbalanced className={…} for \`${marker}\``).toBeGreaterThan(
				valueAt,
			);
		}
		return { text: source.slice(attrAt, end), at: attrAt };
	}

	it("composer-fit::G1-the-section-root-carries-min-h-0-so-it-can-shrink-at-all", () => {
		// ⛔ Without this, the composer's own flex-shrink default has nothing to
		// act on — a flex item's automatic minimum size is its content, the same
		// rule `DebateColumn`'s docblock states for `column-scroll`. This is
		// what makes the rest of R1 able to do anything at a short viewport.
		expect(sectionClasses()).toContain("min-h-0");
	});

	it("composer-fit::G1-the-footblock-is-shrink-0-and-lives-INSIDE-the-right-column", () => {
		// ⛔⛔ THE WALL, AND IT MOVED. RPLY-2's brief demanded the footblock be
		// "`shrink-0` AND a direct child of the composer's flex root", which
		// forced the AMOUNT/TO-WIN/`Đ BET` block out of the grid into a
		// full-width section-level row. That was a SPECIFICATION error, not a
		// build error, and RPLY-3 · R1 reverses it: the money row is
		// `.compright`'s third child again, as d5 has it (`:1132`) and as it was
		// before RPLY-2.
		//
		// ⚠ THE `shrink-0` HALF IS UNCHANGED AND IS THE HALF THAT MATTERS. What
		// R1 rules is WHERE it sits, never whether it may be squeezed: it is
		// `shrink-0` within the right column now instead of within the section.
		// ⚠ Anchored via `classAttrContaining` so a mutation that CHANGES this
		// row reds the assertion below rather than an element lookup (`O-3`).
		const foot = classAttrContaining("mt-auto flex shrink-0");
		expect(foot.text).toContain("shrink-0");
		expect(foot.text).toContain("mt-auto");
		const footRowAt = foot.at;

		// ⛔⛔ NESTING IS THE ENTIRE RULING, AND A BYTE ORDERING CANNOT SEE IT.
		// This block previously claimed "an ORDERING against that column's own
		// opening tag AND against the grid's close" and only performed the first
		// half — which a SECTION-LEVEL footblock satisfies just as well, because
		// the hoisted position is also later in the file than `.compright`'s
		// opening tag. `@code-reviewer` proved it: moving the row back out to a
		// direct child of `<section>` left all thirteen tests in this file green.
		// ⇒ The bound is now two-sided. The footblock must sit between the right
		// column's opening tag and the `.fieldscroll` box's own end, which is
		// inside that column — a section-level row is after BOTH and fails.
		expect(footRowAt).toBeGreaterThan(rightColumnAt());
		const gridAt = source.indexOf('<div className="grid min-h-0 grid-cols-');
		expect(gridAt, "expected the `.compgrid` declaration").toBeGreaterThan(-1);
		expect(rightColumnAt()).toBeGreaterThan(gridAt);
		// ⛔⛔ AND THE REAL CHECK IS A DOM ONE, IN ANOTHER FILE, BY DESIGN. A
		// source scan reads a file top to bottom and cannot tell nesting from
		// sequence at all. `composer-grid.test.tsx` asserts on the rendered tree
		// that the money row's PARENT is the right column — it is what actually
		// caught the reviewer's mutation, and it is named here so a later reader
		// does not mistake the ordering above for the guarantee.
		expect(
			readFileSync(
				join(ROOT, "tests/unit/composer/render/composer-grid.test.tsx"),
				"utf8",
			),
		).toContain("expect(stakeRow.parentElement).toBe(right)");

		// ⛔⛔ AND THE HOISTED SHAPE MUST BE GONE, not merely un-referenced. This
		// is the assertion that reds against the build RPLY-3 replaces: RPLY-2's
		// footblock carried its `dimmed` class DIRECTLY, because the hoist had
		// taken it out from under the argument region's dimmed wrapper.
		expect(source).not.toContain("shrink-0 items-stretch gap-3${dimmed");

		// And it must still hold the actual submit button and the notice slot —
		// a passing className check on an EMPTY row would prove nothing.
		//
		// ⚠⚠ BOUNDED BY THE NEXT SYMBOL, NOT BY A CHARACTER COUNT — third time in
		// this one file, and the third is the one that makes it a rule rather
		// than bad luck. This read `footRowAt + 7000` and went red the moment a
		// comment was added between the row and its submit, reporting that the
		// money row does not contain `Đ BET` when what had actually happened was
		// that prose moved. `<ErrorStrip` is the first element after the argument
		// region closes, so it is the real end of this row's subtree.
		const errorStripAt = source.indexOf("<ErrorStrip", footRowAt);
		expect(
			errorStripAt,
			"expected <ErrorStrip> after the footblock",
		).toBeGreaterThan(footRowAt);
		const footRowToSubmit = source.slice(footRowAt, errorStripAt);
		expect(footRowToSubmit).toContain('data-testid="composer-notice-slot"');
		expect(footRowToSubmit).toContain("aria-label={COMPOSER_COPY.submit}");
	});

	it("composer-fit::G1-the-scroll-is-on-the-FIELDS-not-on-the-region-that-holds-the-submit", () => {
		// ⛔⛔ THE MECHANISM THAT MAKES "never pushed off-screen" TRUE BY
		// CONSTRUCTION RATHER THAN BY BUDGET. With the footblock back inside the
		// right column, an `overflow-y-auto` on the argument REGION would put the
		// submit inside a scroll box again — exactly the defect RPLY-2 fixed by
		// hoisting. So the overflow moved DOWN onto the title/body pair's own
		// wrapper, whose sibling the footblock is.
		// ⚠ Anchored on `overflow-y-auto p-0.5` via `classAttrContaining`, so
		// deleting the ring-room padding or adding a class reds the assertions
		// below rather than an element lookup (`O-3`).
		const fieldScroll = classAttrContaining("overflow-y-auto p-0.5");
		expect(fieldScroll.text).toContain("min-h-0");
		expect(fieldScroll.text).toContain("-m-0.5");
		expect(fieldScroll.text).toContain("p-0.5");
		const fieldScrollAt = fieldScroll.at;
		expect(
			fieldScrollAt,
			"expected the `.fieldscroll` wrapper around the title/body pair",
		).toBeGreaterThan(-1);
		// It is inside the right column, and it comes BEFORE the footblock —
		// i.e. the footblock is its sibling, not its content.
		expect(fieldScrollAt).toBeGreaterThan(rightColumnAt());
		const footRowAt = classAttrContaining("mt-auto flex shrink-0").at;
		expect(fieldScrollAt).toBeLessThan(footRowAt);
		// ⛔ Both fields are inside it; the submit is not.
		const fieldScrollBody = source.slice(fieldScrollAt, footRowAt);
		expect(fieldScrollBody).toContain('aria-label="Argument title"');
		expect(fieldScrollBody).toContain('aria-label="Argument body"');
		expect(fieldScrollBody).not.toContain("aria-label={COMPOSER_COPY.submit}");
		// ⛔ NOT `flex-1` — same refusal as every other node in this chain.
		expect(fieldScroll.text).not.toContain("flex-1");
	});

	it("composer-fit::G1-the-argument-region-shrinks-but-no-longer-scrolls", () => {
		// ⛔ `min-h-0` (shrinkable) survives; the `overflow-y-auto` does not, and
		// its ABSENCE here is the point — a second scroll box wrapping the
		// footblock would clip `Đ BET` at exactly the heights R1 exists to fix.
		// Deliberately NOT `flex-1`/flex-grow either: measured at RPLY-2, adding
		// grow here inflated the tall-viewport height with no functional gain.
		//
		// ⚠ Anchored on `${dimmed`, the argument region's own signature, which
		// survives an added `overflow-y-auto` — so restoring that class reds THIS
		// assertion rather than an element lookup. See `classAttrContaining`.
		const decl = classAttrContaining("${dimmed").text;
		expect(decl).toContain("min-h-0");
		expect(decl).not.toContain("overflow-y-auto");
		expect(decl).not.toContain("flex-1");
	});

	it("composer-fit::G1-the-footblock-INHERITS-the-dimming-and-must-not-re-apply-it", () => {
		// ⛔⛔ A CORRECTNESS FIX WEARING A LAYOUT COSTUME, AND THE REASON THIS IS
		// AN ASSERTION RATHER THAN A DELETION NOBODY NOTICES. RPLY-2 gave the
		// hoisted footblock its own `dimmed` class because the hoist had taken it
		// out from under the argument region's dimmed wrapper. R1 puts it back
		// under that wrapper — so a direct copy would COMPOSITE with the
		// ancestor's rather than replace it: `--state-disabled-opacity` is 0.5,
		// and 0.5 × 0.5 = 0.25.
		// ⚠ THAT IS NOT A COSMETIC DIFFERENCE. The notice slot's `text-ink` token
		// was chosen against a MEASURED 5.08:1 contrast at 0.5 opacity (see the
		// slot's own comment); at 0.25 it lands near 1.9:1, on the one sentence
		// that explains why the form is dead — and the WALLS forbid touching that
		// token. Measured in the browser after the move: region 0.5, footblock 1,
		// slot effective 0.5, notice colour rgb(250,250,250).
		//
		// ⚠ Anchored on `mt-auto flex shrink-0` — tokens the footblock row keeps
		// whether or not someone re-applies `dimmed` to it, so the mutation this
		// rejects reds the DIMMING assertion rather than an element lookup.
		// ⛔ NOT `items-stretch gap-3`, which was the first attempt: the GRID
		// carries that same pair and appears earlier in the file, so the helper
		// returned the grid's attribute and the guard failed complaining that a
		// grid has no `mt-auto`. A marker has to be unique to its element, not
		// merely characteristic of it.
		const rowDecl = classAttrContaining("mt-auto flex shrink-0").text;
		expect(rowDecl).toContain("items-stretch");
		// ⛔ THE ASSERTION: the row does not re-apply the class it inherits.
		expect(rowDecl).not.toContain("dimmed");
		// …while the ancestor that DOES carry it still exists, so this is
		// "inherited", not "dropped". A guard that only checked the absence would
		// pass just as well on a composer that had stopped dimming altogether.
		expect(classAttrContaining("${dimmed").text).toContain("min-h-0");
	});
});

describe("RPLY-3 · R1 · G2 — the image cell is the shock absorber", () => {
	/** The `panel` class string — `ImageAttach`'s `<fieldset>` chrome. */
	function panelClasses(): string[] {
		const at = ATTACH.indexOf("const panel =");
		if (at === -1) {
			throw new Error(`${IMAGE_ATTACH}: no \`panel\` declaration.`);
		}
		const cls = /"([^"]*)"/.exec(ATTACH.slice(at, at + 400))?.[1] ?? "";
		return cls.split(/\s+/).filter(Boolean);
	}

	/** The `preview` class string — the artwork/preview box inside the panel. */
	function previewClasses(): string[] {
		const at = ATTACH.indexOf("const preview =");
		if (at === -1) {
			throw new Error(`${IMAGE_ATTACH}: no \`preview\` declaration.`);
		}
		// Wide window: this declaration carries a long calibration comment
		// between the `=` and the string literal.
		const after = ATTACH.slice(at, at + 4000);
		const cls = /"(aspect-\[4\/5\][^"]*)"/.exec(after)?.[1] ?? "";
		return cls.split(/\s+/).filter(Boolean);
	}

	it("composer-fit::G2-the-panel-declares-an-explicit-floor-which-is-what-lets-it-shrink", () => {
		// ⛔⛔ ONE DECLARATION, TWO JOBS, AND THE FIRST ONE IS INVISIBLE. A grid
		// item's automatic minimum size is its CONTENT, so with `min-height:auto`
		// this panel refused to shrink at any viewport: MEASURED at 650px on the
		// post arm, the grid box around it was 117.41px while the panel still
		// measured its full 266.45px and simply overflowed — which is where the
		// founder's clipped `beats capital.` and vanished `Add Image` came from.
		// ANY explicit min-height releases that automatic minimum (`0` and
		// `192px` were measured to release it identically), so the number is free
		// to be a real floor instead of a token zero.
		const classes = panelClasses();
		const floor = classes.find((c) => /^min-h-(\d+|\[\d+px\])$/.test(c));
		expect(
			floor,
			"expected an explicit `min-h-*` floor on the ImageAttach panel",
		).toBeDefined();
		const px = /^min-h-\[(\d+)px\]$/.exec(floor ?? "")
			? Number(/^min-h-\[(\d+)px\]$/.exec(floor ?? "")?.[1])
			: Number(/^min-h-(\d+)$/.exec(floor ?? "")?.[1]) * 4;
		// A floor, not a fixed height: strictly below the panel's own measured
		// natural size (266.45px unstretched), or it would stop being a floor and
		// start being the thing that sets the grid row.
		expect(px).toBeGreaterThan(0);
		expect(px).toBeLessThan(266);
		// …and high enough that the artwork it bounds is still readable at it.
		// Measured at 192px: `Add Image` renders 9.38px, the headline 11.25px.
		// Unfloored at 650px they were 5.63 and 6.25px.
		expect(px).toBeGreaterThanOrEqual(160);
		// ⛔ `h-full` STAYS. The floor bounds how small the panel may get;
		// `h-full` is what makes it take the grid row's height the rest of the
		// time. Without it the floor would become the panel's only height.
		expect(classes).toContain("h-full");
	});

	it("composer-fit::G2-the-floor-is-on-the-PANEL-and-the-artwork-still-declares-min-h-0", () => {
		// ⛔⛔ THE MISUSE THIS REJECTS IS PUTTING THE FLOOR ON THE ARTWORK, and it
		// is a real temptation because that is the element whose legibility the
		// floor protects. It does not work: the panel — released by its own
		// explicit minimum — keeps shrinking underneath a floored `<svg>`, so the
		// drawing spills past the fieldset's border. Add `overflow-hidden` to
		// stop the spill and you have cropped the sentence, which is the defect
		// being fixed. Floor the BOX and the artwork scales into it, because the
		// `<svg>` keeps its `viewBox` and its default
		// `preserveAspectRatio="xMidYMid meet"`.
		expect(previewClasses()).toContain("min-h-0");
		expect(previewClasses().some((c) => /^min-h-(?!0$)/.test(c))).toBe(false);
		// ⛔ And nothing on this path may clip or scroll the decoration — an
		// internal scrollbar on a placeholder is worse than the problem.
		expect(panelClasses()).not.toContain("overflow-hidden");
		expect(panelClasses().some((c) => c.startsWith("overflow-"))).toBe(false);
		expect(previewClasses().some((c) => c.startsWith("overflow-"))).toBe(false);
	});

	it("composer-fit::G4-Add-Image-is-rendered-inside-the-pick-control-and-is-not-clipped", () => {
		// ⛔⛔ THE FUNCTIONAL WALL. `Add Image` is the ONLY entry point to
		// attaching an image to a bet (this file's own docblock: the canon §6
		// caption was deleted and the standalone `Image` label removed, so this
		// line is the sole thing telling a participant the box can be clicked).
		// Losing it is a functional regression wearing a layout costume — and it
		// is what the build RPLY-3 replaces actually did at 750/700/650px.
		//
		// ⚠ jsdom performs no layout, so "not clipped" cannot be measured here;
		// the browser table in the run report carries the geometry at all five
		// heights. What IS pinned is every declaration that produces it.
		//
		// ⚠ MATCHED BY THE COPY KEY, NEVER THE BARE WORDS. `EMPTY_SLOT_COPY`
		// owns the string; a literal here could pass while the module said
		// something else.
		expect(ATTACH).toContain("EMPTY_SLOT_COPY.action");
		// It lives in the figure, and the figure renders in the empty states.
		// ⚠⚠ MOBILE-2 — THE PIN MOVED AND THE WALL DID NOT. The figure now carries
		// `max-mobile:hidden`, because below 640px the founder ruled the empty slot
		// down to the invitation alone: no 4:5 tile, no `K · n > C`, no `THE GOAL`.
		// ⛔ That is precisely where THIS assertion earns its keep — `Add Image` is
		// DRAWN INSIDE the figure (`ImageAttach.tsx:204-230`), so hiding the art
		// hides the only entry point to attaching an image, which is the functional
		// regression this row exists to catch. The phone therefore renders the SAME
		// live constant as text, and both tiers are pinned below rather than one.
		expect(ATTACH).toContain(
			"<EmptySlotFigure className={`${preview} max-mobile:hidden`} />",
		);
		// THE PHONE'S OWN ENTRY POINT — the same `EMPTY_SLOT_COPY.action`, rendered
		// as text in a span that is `display:none` at every desktop width. Asserted
		// as a PAIR with the hide above: either token alone leaves a phone with an
		// image slot nothing tells you to tap.
		expect(ATTACH).toMatch(
			/hidden[^"]*max-mobile:inline"\s*>\s*\{EMPTY_SLOT_COPY\.action\}/,
		);
		// ⛔⛔ AND IT CARRIES THE SAME GATE THE FIGURE DOES. The first cut of the
		// phone label rendered unconditionally, so during `attaching` — and after a
		// decode failure while `attached` — the phone offered `Add Image` directly
		// above the filename of the file already uploading. `attach-preview.test.tsx`
		// caught it; this row is what stops it coming back through a path that file
		// does not watch. `invitesAPick` is the single named condition both tiers
		// read, so a fourth phase cannot re-open the gap by being forgotten in one
		// of two places.
		expect(ATTACH).toContain(
			"const invitesAPick = previewUrl === null && !fileInHand;",
		);
		expect(ATTACH).toMatch(
			/\{invitesAPick \? \(\s*<span className="hidden[^"]*max-mobile:inline"/,
		);
		// ⛔ The `<svg>` keeps the two properties that make it SCALE rather than
		// crop: its own coordinate system, and the DEFAULT `meet` fit. An
		// explicit `preserveAspectRatio="…slice"` would crop it silently.
		expect(ATTACH).toContain('viewBox="0 0 200 250"');
		// ⚠⚠ SCOPED TO THE `<svg>` OPENING TAG, AND IT TOOK TWO TRIES TO GET
		// THERE — recorded because the second try is the one that usually ships.
		// A bare `not.toContain("preserveAspectRatio")` went red against this
		// file's own comment explaining why the attribute is left at its default.
		// The obvious repair — match the ATTRIBUTE SYNTAX `preserveAspectRatio=`
		// — went red too, because the comment QUOTES the attribute with its value
		// (`preserveAspectRatio="xMidYMid meet"`), so the syntax appears verbatim
		// in prose. Syntax-not-word is the right instinct and it is not
		// sufficient: nothing about a comment stops it containing valid syntax.
		// ⇒ The fence is the ELEMENT, read out of the source and scanned alone.
		// That is `O-8` — by symbol — applied to a textual guard rather than to a
		// line number.
		const svgOpenAt = ATTACH.indexOf('<svg viewBox="0 0 200 250"');
		expect(svgOpenAt, "expected the EmptySlotFigure <svg>").toBeGreaterThan(-1);
		const svgTag = ATTACH.slice(svgOpenAt, ATTACH.indexOf(">", svgOpenAt) + 1);
		expect(svgTag).not.toContain("preserveAspectRatio");
		// Non-vacuity: the slice really is the tag, not an empty string.
		expect(svgTag).toContain('aria-hidden="true"');
	});
});
