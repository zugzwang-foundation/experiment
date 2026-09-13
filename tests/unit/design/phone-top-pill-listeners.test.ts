import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * MOBILE-2k · F-1 — THE PILL CARRIES NO GESTURE CODE. Plan §3 row G6, source
 * half.
 *
 * ⛔⛔ WHAT IS ALREADY COVERED ELSEWHERE, SO THAT THIS FILE IS NOT READ AS THE
 * WHOLE OF G6. `phone-gesture-wall.test.ts` holds the phone tier's
 * `addEventListener` registrations as a CLOSED, receiver-agnostic allowlist —
 * including MOBILE-2k's own new row, `region::scroll::evaluate::{passive:true}`,
 * admitted by founder ruling (ADR-0051 A7 D-1) — and it enforces `{ passive:
 * true }` on every scroll-bearing event across every file in
 * `src/components/debate/phone/`. Those two rules already reach this component,
 * and duplicating them here would be a second copy free to drift from the first.
 *
 * ⛔ WHAT NOTHING COVERED, AND IS THE REASON THIS FILE EXISTS. A React JSX
 * handler PROP is not an `addEventListener` and it is not a DOM handler
 * property: `onTouchMove={(e) => e.preventDefault()}` on this button registers a
 * non-passive listener through React's own system, with the string
 * `addEventListener` nowhere in the file and no lowercase `ontouchmove` for the
 * property scan to find. The one rule in this directory that does read JSX props
 * is scoped to `PhoneFeedTrack.tsx` by name. So the pill — a floating control
 * over the tier's only scroller, the newest element on the surface, and the one
 * most likely to attract "make it swipeable" — was outside every prop rule the
 * lane has.
 *
 * ⇒ The rule below is a CENSUS of the pill's attribute set rather than a list of
 * forbidden props, for the reason this lane learned twice: a rule that names the
 * shapes it forbids is only as complete as the imagination of whoever wrote it,
 * while one that enumerates what is allowed fails closed on a shape nobody
 * anticipated. Adding an attribute to this control is a decision.
 *
 * ⚠ SOURCE SCAN, BECAUSE THE PROPERTY IS TEXTUAL. React props are not DOM
 * attributes, so no render can see whether `onTouchMove` was passed; and a
 * `preventDefault` has no observable consequence in an environment with no
 * scrolling to prevent. The behavioural complement — that a gesture dispatched
 * at the pill comes back un-cancelled — is `phone-top-pill.test.tsx`'s
 * `takes-a-click-and-cancels-no-gesture`.
 *
 * ⚠ COMMENTS ARE STRIPPED BEFORE EVERY SCAN, LINE COUNT PRESERVED. Six previous
 * negative source scans in this repository matched the COMMENT explaining the
 * absence rather than the code — and this component documents its refusal to
 * carry a touch handler in prose, immediately above the tag being scanned.
 */
const ROOT = process.cwd();
const PILL = "src/components/debate/phone/PhoneTopPill.tsx";
const PILL_ANCHOR = 'data-testid="phone-top-pill"';
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

/** Comments stripped, line count preserved. */
function code(src: string): string {
	return src
		.replace(/\/\*[\s\S]*?\*\//g, (m) =>
			"\n".repeat((m.match(/\n/g) ?? []).length),
		)
		.replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

/**
 * The opening tag of the element whose attributes contain `anchor`.
 * Pinned by `data-*` symbol, never by line or character window (`O-8`).
 */
function openingTag(src: string, anchor: string): string {
	const at = src.indexOf(anchor);
	if (at === -1) {
		throw new Error(
			`${PILL}: no anchor \`${anchor}\` — the pill's own test id is gone or ` +
				"renamed, so this census is reading some other element (or nothing)",
		);
	}
	let open = at;
	while (open > 0 && src[open] !== "<") {
		open--;
	}
	let i = at;
	let depth = 0;
	let quote: string | null = null;
	for (; i < src.length; i++) {
		const ch = src[i] ?? "";
		if (quote !== null) {
			if (ch === "\\") {
				i++;
			} else if (ch === quote) {
				quote = null;
			}
			continue;
		}
		if (ch === '"' || ch === "'" || ch === "`") {
			quote = ch;
			continue;
		}
		if (ch === "{") {
			depth++;
		} else if (ch === "}") {
			depth--;
		} else if (ch === ">" && depth === 0) {
			break;
		}
	}
	return src.slice(open, i);
}

/** Every `name=` in an opening tag, in source order. */
function attributeNames(tag: string): string[] {
	return [...tag.matchAll(/(?:^|\s)([A-Za-z_][\w:-]*)\s*=/g)]
		.map((m) => m[1] ?? "")
		.filter(Boolean);
}

/**
 * ⛔ THE PILL'S ATTRIBUTE SET, IN FULL. Six, and every one of them is either
 * identity, the accessible name, the style, or the ONE input this control takes.
 *
 * ⚠ `onClick` IS IN THE SET AND `onTouchStart` IS NOT, WHICH IS THE WHOLE POINT.
 * A click is synthesised by the browser from whatever gesture the platform
 * decided was a tap — it arrives after the browser has already made its own
 * decisions about scroll, momentum and cancellation. A touch handler arrives
 * BEFORE them, which is the only way to break them.
 */
const RATIFIED_PILL_ATTRIBUTES = [
	"aria-label",
	"className",
	"data-phase",
	"data-testid",
	"onClick",
	"type",
].sort();

/** The DOM handler properties an assignment could smuggle a gesture in through. */
const HANDLER_PROPS =
	/(?:\.|\b)(ontouch(?:start|move|end|cancel)|onpointer(?:down|move|up|cancel)|onwheel|onscroll|onmousedown|onmousemove|ondrag(?:start|)?)\s*[:=]/g;

/**
 * Mutate the REAL source in memory, and refuse to proceed if the mutation did
 * not apply.
 *
 * ⛔ THIS IS THE MUTATION CONTROL, AND IT IS STRONGER THAN A HAND-WRITTEN SAMPLE
 * STRING. A recogniser proved against a literal typed in this file proves only
 * that the regex works on that literal; proved against the shipped bytes with
 * one thing changed, it proves the scan would have caught the change. Nothing is
 * written to disk — `src/` is never touched.
 */
function mutate(src: string, from: string, to: string): string {
	if (!src.includes(from)) {
		throw new Error(
			`the mutation control cannot find \`${from}\` in ${PILL} — the shape it ` +
				"alters has moved, so the control below would prove nothing",
		);
	}
	return src.replace(from, to);
}

describe("MOBILE-2k · F-1 — the scan reaches the real pill (controls first)", () => {
	it("phone-top-pill-listeners::guard-is-alive", () => {
		const src = code(read(PILL));
		expect(src.length, "the component was read").toBeGreaterThan(1000);
		const tag = openingTag(src, PILL_ANCHOR);
		expect(
			tag.startsWith("<button"),
			`the anchored element is ${tag.slice(0, 40)}`,
		).toBe(true);
		expect(
			attributeNames(tag).length,
			"the extractor found no attributes at all — an empty set satisfies " +
				"every negative below at once",
		).toBeGreaterThanOrEqual(6);
		// ...and the comments really were stripped: the component's own prose says
		// `ontouchmove` is what MOBILE-2c's P0 looked like, and a scan that read
		// the docblock would report its own explanation as an offence.
		expect(
			read(PILL).includes("TOUCH OR POINTER HANDLER"),
			"the docblock that this stripping protects the scan from is gone — " +
				"re-check that the strip is still doing anything",
		).toBe(true);
	});

	it("phone-top-pill-listeners::the-recognisers-fire", () => {
		const src = code(read(PILL));

		// A JSX touch prop, injected into the real tag.
		const withTouch = mutate(
			src,
			'data-testid="phone-top-pill"',
			'data-testid="phone-top-pill"\n\t\t\tonTouchMove={(e) => e.preventDefault()}',
		);
		expect(
			attributeNames(openingTag(withTouch, PILL_ANCHOR)),
			"the census cannot see a touch prop added to the tag it reads — every " +
				"row below is then decoration",
		).toContain("onTouchMove");

		// A spread, which hands the element props nothing can enumerate.
		const SPREAD = /\{\s*\.\.\./;
		const withSpread = mutate(
			src,
			'data-testid="phone-top-pill"',
			'data-testid="phone-top-pill"\n\t\t\t{...gestureProps}',
		);
		expect(SPREAD.test(openingTag(withSpread, PILL_ANCHOR))).toBe(true);
		expect(
			SPREAD.test(openingTag(src, PILL_ANCHOR)),
			"the shipped tag already carries a spread, so the rule below is green " +
				"on a false premise",
		).toBe(false);

		// A DOM handler property assignment, which is a NON-passive listener.
		const withProperty = mutate(
			src,
			"const onTap = useCallback",
			"region.ontouchmove = (e) => e.preventDefault();\n\tconst onTap = useCallback",
		);
		expect([...withProperty.matchAll(HANDLER_PROPS)].map((m) => m[1])).toEqual([
			"ontouchmove",
		]);

		// A callback ref, which is handed the element and can do anything to it.
		const withRef = mutate(
			src,
			'data-testid="phone-top-pill"',
			'data-testid="phone-top-pill"\n\t\t\tref={(el) => el?.addEventListener("pointerdown", stop)}',
		);
		expect(/ref=\{/.test(withRef)).toBe(true);
		expect(
			/ref=\{/.test(src),
			"the shipped component already takes a `ref`, so the row below is not " +
				"measuring what it says",
		).toBe(false);
	});
});

describe("MOBILE-2k · F-1 — the pill's input surface is closed (G6)", () => {
	/**
	 * ⛔ THE CENSUS. Six attributes, no seventh. A touch or pointer prop here is
	 * MOBILE-2c's P0 arriving on the newest element on the surface — the one that
	 * floats over the tier's only scroller — through the one channel that is
	 * neither an `addEventListener` nor a DOM property, and which no rule in this
	 * directory was watching.
	 */
	it("phone-top-pill-listeners::the-pills-attribute-set-is-exactly-the-ratified-six", () => {
		const tag = openingTag(code(read(PILL)), PILL_ANCHOR);
		expect(
			attributeNames(tag).sort(),
			"this control takes identity, a name, a style and a CLICK. A click is " +
				"synthesised by the browser after it has already decided what the " +
				"gesture was; anything earlier in the chain is how momentum, " +
				"rubber-band and axis lock get broken, and that is where this lane's " +
				"P0 came from",
		).toEqual(RATIFIED_PILL_ATTRIBUTES);
	});

	it("phone-top-pill-listeners::the-pill-takes-no-spread-and-no-callback-ref", () => {
		const src = code(read(PILL));
		const offenders: string[] = [];
		if (/\{\s*\.\.\./.test(openingTag(src, PILL_ANCHOR))) {
			offenders.push("spread prop on the pill");
		}
		for (const m of src.matchAll(/ref=\{/g)) {
			offenders.push(`ref callback at index ${m.index}`);
		}
		expect(
			offenders,
			"a spread delivers props the census cannot enumerate, and a callback " +
				"ref is handed the element itself — the two routes back to gesture " +
				"code that leave the attribute list looking clean",
		).toEqual([]);
	});

	it("phone-top-pill-listeners::no-event-handler-is-assigned-as-a-DOM-property", () => {
		const src = code(read(PILL));
		expect(
			[...src.matchAll(HANDLER_PROPS)].map((m) => m[1]),
			"a DOM handler property is a NON-passive listener by default, so the " +
				"`preventDefault` inside it works — the P0 in one line, past every " +
				"`addEventListener` rule in this directory",
		).toEqual([]);
	});
});
