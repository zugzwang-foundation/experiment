import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * MOBILE-2c G4 — the touch-handling wall, as a source scan over `phone/`.
 *
 * ⛔⛔ A `touchmove` HANDLER THAT CALLS `preventDefault` IS MOBILE-2c's P0
 * ARRIVING UNDER A NEW NAME. The reported defect was "on Android neither the
 * YES/NO switch nor vertical scrolling works", and it turned out to be one
 * modal being up when the reader did not believe one was: a full-viewport layer
 * over `body{overflow:hidden}` kills vertical scrolling AND swallows the tap on
 * the tabs. A `preventDefault` on a touch move reaches the same end state by a
 * different route — it takes scrolling away from whatever is under the finger,
 * silently, on exactly the device class this tier exists for. So it is forbidden
 * outright rather than reviewed case by case.
 *
 * ⇒ What the tier does instead is DECLARATIVE: the browser is told what each
 * element is for with `touch-action`, which cannot be got wrong by degrees.
 * Those three declarations are pinned below by SYMBOL — the element's own
 * `data-testid` or the component it lives in — never by line (`O-8`).
 *
 * ⚠ THIS FILE IS A SOURCE SCAN BECAUSE jsdom CANNOT ANSWER THE QUESTION.
 * `touch-action` is a CSS property jsdom never computes, and a listener's
 * `preventDefault` has no observable consequence in an environment with no
 * scrolling to prevent. The property is real and nothing but text can see it.
 */
const ROOT = process.cwd();
const PHONE_DIR = "src/components/debate/phone";
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

/**
 * ⛔ COMMENTS STRIPPED BEFORE EVERY NEGATIVE SCAN, line count preserved — and
 * on this file it is the difference between a guard and a joke. `PhoneSheet`'s
 * pointer-handling docblock contains the sentence "NOT ONE `preventDefault` ON A
 * TOUCH EVENT ANYWHERE", `PhoneFeedTrack`'s contains `touchmove` in prose, and
 * the plan that ruled this guard quotes both. Six recorded instances in this
 * repository of a textual guard matching the comment that explains the absence;
 * this would have been the seventh on its first run.
 */
function code(src: string): string {
	return src
		.replace(/\/\*[\s\S]*?\*\//g, (m) =>
			"\n".repeat((m.match(/\n/g) ?? []).length),
		)
		.replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

/** Every `.tsx`/`.ts` under `phone/`, comment-stripped, read once. */
function phoneFiles(): { file: string; src: string }[] {
	return readdirSync(join(ROOT, PHONE_DIR))
		.filter((name) => name.endsWith(".tsx") || name.endsWith(".ts"))
		.map((name) => ({
			file: `${PHONE_DIR}/${name}`,
			src: code(read(`${PHONE_DIR}/${name}`)),
		}));
}

/**
 * The text between `src[at]` (an opening delimiter) and its match, exclusive.
 * String literals are skipped so a brace or paren inside one cannot unbalance
 * the walk.
 */
function balanced(src: string, at: number): { body: string; end: number } {
	const open = src[at] ?? "";
	const close = open === "(" ? ")" : open === "{" ? "}" : "]";
	let depth = 0;
	let quote: string | null = null;
	let i = at;
	for (; i < src.length; i++) {
		const ch = src[i] ?? "";
		if (quote !== null) {
			if (ch === "\\") i++;
			else if (ch === quote) quote = null;
			continue;
		}
		if (ch === '"' || ch === "'" || ch === "`") {
			quote = ch;
			continue;
		}
		if (ch === open) depth++;
		else if (ch === close) {
			depth--;
			if (depth === 0) break;
		}
	}
	return { body: src.slice(at + 1, i), end: i };
}

/** Split an argument list on its top-level commas. */
function splitArgs(args: string): string[] {
	const out: string[] = [];
	let depth = 0;
	let quote: string | null = null;
	let start = 0;
	for (let i = 0; i < args.length; i++) {
		const ch = args[i] ?? "";
		if (quote !== null) {
			if (ch === "\\") i++;
			else if (ch === quote) quote = null;
			continue;
		}
		if (ch === '"' || ch === "'" || ch === "`") {
			quote = ch;
			continue;
		}
		if ("([{".includes(ch)) depth++;
		else if (")]}".includes(ch)) depth--;
		else if (ch === "," && depth === 0) {
			out.push(args.slice(start, i));
			start = i + 1;
		}
	}
	out.push(args.slice(start));
	return out.map((s) => s.trim());
}

/**
 * The body of the declaration named `ident`, by brace/paren matching over the
 * whole statement.
 *
 * ⛔⛔ RESOLVING THE IDENTIFIER IS THE WHOLE GUARD, and a scan that skipped it
 * would miss the shape actually on disk. `PhoneFeedTrack` registers its touch
 * listener as `addEventListener("touchmove", release, { passive: true })` — a
 * NAMED REFERENCE — so `preventDefault` would be added inside `release`, tens of
 * lines away from the word `touchmove`. Any proximity rule wide enough to reach
 * it is a distance fence, and `O-8` records that a character window is a line
 * number wearing a different unit.
 */
function declarationBody(src: string, ident: string): string | null {
	const fn = new RegExp(`function\\s+${ident}\\s*\\(`).exec(src);
	if (fn) {
		const brace = src.indexOf("{", (fn.index ?? 0) + fn[0].length);
		if (brace !== -1) {
			return balanced(src, brace).body;
		}
	}
	const decl = new RegExp(`(?:const|let|var)\\s+${ident}\\s*=`).exec(src);
	if (!decl) {
		return null;
	}
	// Scan to the `;` that ends the statement, at zero nesting depth.
	let depth = 0;
	let quote: string | null = null;
	const from = (decl.index ?? 0) + decl[0].length;
	for (let i = from; i < src.length; i++) {
		const ch = src[i] ?? "";
		if (quote !== null) {
			if (ch === "\\") i++;
			else if (ch === quote) quote = null;
			continue;
		}
		if (ch === '"' || ch === "'" || ch === "`") {
			quote = ch;
			continue;
		}
		if ("([{".includes(ch)) depth++;
		else if (")]}".includes(ch)) depth--;
		else if (ch === ";" && depth === 0) {
			return src.slice(from, i);
		}
	}
	return src.slice(from);
}

/**
 * ⛔ THE RULED PAIR, AND ONLY THE PAIR. `touchstart` and `touchmove` are the two
 * whose default action is SCROLLING — the thing the P0 took away. `touchend` and
 * `touchcancel` suppress click synthesis instead, which is a different defect
 * and is not what this plan ruled on. Stated rather than silently widened: a
 * guard whose coverage is unstated will be read as total.
 */
const NATIVE = ["touchstart", "touchmove"];
const JSX = ["onTouchStart", "onTouchMove"];

/**
 * Every touch-handler body in `src`, as `{ where, body }`. Three shapes are
 * resolved: a JSX prop holding an inline function, a JSX prop holding a named
 * reference, and an `addEventListener` second argument in either form.
 */
function touchHandlerBodies(src: string): { where: string; body: string }[] {
	const found: { where: string; body: string }[] = [];

	const resolve = (where: string, expr: string) => {
		const trimmed = expr.trim();
		if (/^[A-Za-z_$][\w$]*$/.test(trimmed)) {
			const body = declarationBody(src, trimmed);
			found.push({ where: `${where} -> ${trimmed}`, body: body ?? "" });
			return;
		}
		found.push({ where, body: trimmed });
	};

	for (const prop of JSX) {
		let at = src.indexOf(`${prop}=`);
		while (at !== -1) {
			const brace = src.indexOf("{", at);
			if (brace !== -1) {
				resolve(prop, balanced(src, brace).body);
			}
			at = src.indexOf(`${prop}=`, at + 1);
		}
	}

	for (const m of src.matchAll(/addEventListener\s*\(/g)) {
		const paren = src.indexOf("(", m.index ?? 0);
		const args = splitArgs(balanced(src, paren).body);
		const name = (args[0] ?? "").replace(/^["'`]|["'`]$/g, "");
		if (!NATIVE.includes(name)) {
			continue;
		}
		resolve(`addEventListener("${name}")`, args[1] ?? "");
	}

	return found;
}

describe("phone tier — the touch scan reaches a non-empty corpus (G4)", () => {
	/**
	 * ⛔ EVERY NEGATIVE BELOW IS `expect(offenders).toEqual([])`, AND AN EMPTY
	 * FILE SET SATISFIES ALL OF THEM AT ONCE. `phone-market-detail.test.ts`
	 * carries this row for the same reason and records the measurement: pointing
	 * its extension filter at `.jsxx` left four guards green.
	 */
	it("phone-touch::guard-is-alive", () => {
		expect(phoneFiles().length).toBeGreaterThanOrEqual(8);
		// ...and the resolver finds the touch listener that is genuinely there.
		const track = code(read(`${PHONE_DIR}/PhoneFeedTrack.tsx`));
		const bodies = touchHandlerBodies(track);
		expect(
			bodies.map((b) => b.where),
			"the track's own touchmove registration must be found, and found as " +
				"the named reference it is — a resolver that misses it cannot see a " +
				"preventDefault added inside that function",
		).toContain('addEventListener("touchmove") -> release');
		// The resolved body is the real one, not an empty string standing in for a
		// declaration the resolver failed to locate.
		const release = bodies.find(
			(b) => b.where === 'addEventListener("touchmove") -> release',
		);
		expect(release?.body ?? "").toContain("headingForRef");
	});
});

describe("phone tier — not one preventDefault on a touch handler (G4)", () => {
	it("phone-touch::no-preventDefault-inside-any-touchstart-or-touchmove-handler", () => {
		const offenders: string[] = [];
		for (const { file, src } of phoneFiles()) {
			for (const { where, body } of touchHandlerBodies(src)) {
				if (body.includes("preventDefault")) {
					offenders.push(`${file}: ${where}`);
				}
			}
		}
		expect(
			offenders,
			"a preventDefault on a touch move or start takes scrolling away from " +
				"whatever is under the finger — MOBILE-2c's P0 under a new name",
		).toEqual([]);

		/**
		 * ⛔⛔ THE POSITIVE CONTROL IS TWO-PART, AND BOTH PARTS ARE NECESSARY.
		 *
		 * (1) THE NEEDLE EXISTS IN THIS CORPUS. `preventDefault` is called four
		 * times in `PhoneSheet` (Tab containment) and twice in `PhoneSideTabs`
		 * (ArrowLeft/ArrowRight), all on KEYDOWN — so the comment-stripped scan
		 * genuinely sees the word, and the empty list above means "not on a touch
		 * handler" rather than "not in these files".
		 */
		const calls = phoneFiles().flatMap(({ file, src }) =>
			[...src.matchAll(/preventDefault\(\)/g)].map(() => file),
		);
		expect(
			calls.length,
			"the stripped scan must still see the keydown preventDefaults",
		).toBeGreaterThanOrEqual(4);
		expect(calls).toContain(`${PHONE_DIR}/PhoneSheet.tsx`);
		expect(calls).toContain(`${PHONE_DIR}/PhoneSideTabs.tsx`);

		/**
		 * (2) THE RECOGNISER CATCHES EACH SHAPE IT NAMES. Part (1) proves the word
		 * is findable; it says nothing about whether the handler resolution works.
		 * These are synthetic sources — one per shape — so the three arms are
		 * proved to FIRE rather than merely being absent from a directory that
		 * never contained them. Without this, a resolver broken in any of three
		 * ways reports a clean scan.
		 */
		const SAMPLES: [string, string][] = [
			[
				"inline JSX arrow",
				"<div onTouchMove={(e) => { e.preventDefault(); }} />",
			],
			[
				"JSX named reference",
				"const stop = (e) => { e.preventDefault(); };\n" +
					"<div onTouchStart={stop} />;",
			],
			[
				"addEventListener inline",
				'el.addEventListener("touchmove", (e) => { e.preventDefault(); }, { passive: false });',
			],
			[
				"addEventListener named reference",
				"const held = useCallback((e) => {\n\te.preventDefault();\n}, []);\n" +
					'el.addEventListener("touchmove", held, { passive: true });',
			],
		];
		for (const [shape, sample] of SAMPLES) {
			const hits = touchHandlerBodies(sample).filter((h) =>
				h.body.includes("preventDefault"),
			);
			expect(hits.length, `${shape}: the recogniser must catch it`).toBe(1);
		}

		/**
		 * ...AND IT DOES NOT FIRE ON THE SHAPE THAT IS ALLOWED. A keydown handler
		 * calling `preventDefault` beside a touch registration must not be
		 * attributed to it — that would make the rule unsatisfiable and the guard
		 * would be deleted rather than obeyed.
		 */
		const allowed =
			"const onKey = (e) => { e.preventDefault(); };\n" +
			'el.addEventListener("keydown", onKey);\n' +
			'el.addEventListener("touchmove", release, { passive: true });\n' +
			"const release = () => { setMuted(false); };";
		expect(
			touchHandlerBodies(allowed).filter((h) =>
				h.body.includes("preventDefault"),
			),
		).toEqual([]);
	});

	/**
	 * ⚠ THE ENABLING CONDITION, PINNED SEPARATELY. A `preventDefault` inside a
	 * `{ passive: true }` listener is ignored by the browser and logs a console
	 * error; inside `{ passive: false }` it works. So `passive: false` on a touch
	 * listener is the switch that turns the forbidden call from inert into a
	 * scroll-killer, and it is worth rejecting on its own — a future edit adds the
	 * option first and the call second, and this row fires on the first half.
	 */
	it("phone-touch::every-touch-listener-is-registered-passive", () => {
		const offenders: string[] = [];
		for (const { file, src } of phoneFiles()) {
			for (const m of src.matchAll(/addEventListener\s*\(/g)) {
				const paren = src.indexOf("(", m.index ?? 0);
				const args = splitArgs(balanced(src, paren).body);
				const name = (args[0] ?? "").replace(/^["'`]|["'`]$/g, "");
				if (!NATIVE.includes(name)) {
					continue;
				}
				if (!(args[2] ?? "").replace(/\s/g, "").includes("passive:true")) {
					offenders.push(`${file}: ${name} is not registered passive`);
				}
			}
		}
		expect(offenders).toEqual([]);
		// POSITIVE CONTROL — the scan reached at least one touch registration, so
		// the empty list is a verdict rather than an empty loop.
		const registrations = phoneFiles().flatMap(({ src }) =>
			[...src.matchAll(/addEventListener\s*\(\s*"(touch\w+)"/g)].map(
				(m) => m[1],
			),
		);
		expect(registrations.length).toBeGreaterThanOrEqual(1);
	});
});

describe("phone tier — the track and the panes carry NO handler at all (MOBILE-2d)", () => {
	/**
	 * ⛔⛔ NOT "NO `preventDefault`" — **NO HANDLER**. The scan above forbids the
	 * one call that takes scrolling away; this one forbids the listener existing
	 * on the two elements that are now the tier's scrollers at all.
	 *
	 * MOBILE-2d turned the phone tier into a bounded app shell whose momentum,
	 * rubber-band, axis lock and snapping are the BROWSER's. Every one of those
	 * is a behaviour a hand-written handler would have to reimplement, and the
	 * reason this lane has a P0 in its history is that reimplementing them is
	 * where the mistakes live. So the rule is structural rather than behavioural:
	 * there is no handler on the track or the panes, therefore there is nothing
	 * to get wrong.
	 *
	 * ⚠ THE ONE EXCEPTION IS NAMED AND IS NOT A WEAKENING. `PhoneFeedTrack`
	 * registers `pointermove` and `touchmove` on the TRACK — passively, reading
	 * only — to release the observer mute when the reader overrules a
	 * programmatic slide (D-1). It neither prevents nor moves anything. So the
	 * assertion is: the track's listeners are exactly that pair, both passive and
	 * both resolving to the same `release`; and the PANES carry none.
	 */
	const JSX_POINTER = [
		"onTouchStart",
		"onTouchMove",
		"onTouchEnd",
		"onTouchCancel",
		"onPointerDown",
		"onPointerMove",
		"onPointerUp",
		"onPointerCancel",
		"onWheel",
	];

	/** The JSX attributes on the element whose opening tag contains `anchor`. */
	function attrsOfElementWith(src: string, anchor: string): string {
		const at = src.indexOf(anchor);
		if (at === -1) throw new Error(`no anchor \`${anchor}\``);
		// walk back to the `<` that opens this tag, then forward to its `>`
		let open = at;
		while (open > 0 && src[open] !== "<") open--;
		let i = at;
		let depth = 0;
		let quote: string | null = null;
		for (; i < src.length; i++) {
			const ch = src[i] ?? "";
			if (quote !== null) {
				if (ch === "\\") i++;
				else if (ch === quote) quote = null;
				continue;
			}
			if (ch === '"' || ch === "'" || ch === "`") {
				quote = ch;
				continue;
			}
			if (ch === "{") depth++;
			else if (ch === "}") depth--;
			else if (ch === ">" && depth === 0) break;
		}
		return src.slice(open, i);
	}

	it("phone-touch::the-track-and-panes-carry-no-touch-or-pointer-prop", () => {
		const src = code(read(`${PHONE_DIR}/PhoneFeedTrack.tsx`));
		const offenders: string[] = [];
		for (const [label, anchor] of [
			["track", 'data-testid="phone-feed-track"'],
			["pane", "data-pane={pane.key}"],
		] as [string, string][]) {
			const tag = attrsOfElementWith(src, anchor);
			for (const prop of JSX_POINTER)
				if (tag.includes(`${prop}=`)) offenders.push(`${label}: ${prop}`);
		}
		expect(
			offenders,
			"momentum, rubber-band, axis lock and snapping are the browser's on " +
				"this tier; a handler here is the only place they can be got wrong",
		).toEqual([]);

		// POSITIVE CONTROL — the extractor reads a real opening tag, and the
		// recogniser fires on the shape it rejects.
		const trackTag = attrsOfElementWith(src, 'data-testid="phone-feed-track"');
		expect(trackTag).toContain("ref={trackRef}");
		expect(trackTag).toContain("className=");
		const sample =
			'<div data-pane={pane.key} onTouchMove={stop} className="x">';
		expect(
			JSX_POINTER.filter((p) =>
				attrsOfElementWith(sample, "data-pane={pane.key}").includes(`${p}=`),
			),
		).toEqual(["onTouchMove"]);
	});

	it("phone-touch::the-tracks-only-listeners-are-the-passive-mute-release", () => {
		const src = code(read(`${PHONE_DIR}/PhoneFeedTrack.tsx`));
		const regs: { name: string; handler: string; opts: string }[] = [];
		for (const m of src.matchAll(/track\.addEventListener\s*\(/g)) {
			const paren = src.indexOf("(", m.index ?? 0);
			const args = splitArgs(balanced(src, paren).body);
			regs.push({
				name: (args[0] ?? "").replace(/^["'`]|["'`]$/g, ""),
				handler: (args[1] ?? "").trim(),
				opts: (args[2] ?? "").replace(/\s/g, ""),
			});
		}
		expect(
			regs.map((r) => `${r.name}:${r.handler}`).sort(),
			"the track's listeners are exactly the D-1 mute release, on movement, " +
				"both resolving to `release` — anything else is gesture code",
		).toEqual(["pointermove:release", "touchmove:release"]);
		for (const r of regs)
			expect(r.opts, `${r.name} must be passive`).toContain("passive:true");
	});

	it("phone-touch::no-listener-is-registered-on-a-pane", () => {
		// The panes are rendered inside `PhoneFeedTrack`; nothing in `phone/` may
		// reach one and attach to it.
		const offenders: string[] = [];
		for (const { file, src } of phoneFiles()) {
			for (const m of src.matchAll(
				/querySelector(?:All)?\s*\(\s*[`'"][^`'"]*data-pane[^`'"]*[`'"]\s*\)[\s\S]{0,120}?addEventListener/g,
			))
				offenders.push(`${file}: ${String(m[0]).slice(0, 60)}…`);
		}
		expect(offenders).toEqual([]);
		// POSITIVE CONTROL — the pattern fires on the shape it rejects.
		const sample =
			'const p = track.querySelector("[data-pane]");\np.addEventListener("touchmove", f);';
		expect(
			[
				...sample.matchAll(
					/querySelector(?:All)?\s*\(\s*[`'"][^`'"]*data-pane[^`'"]*[`'"]\s*\)[\s\S]{0,120}?addEventListener/g,
				),
			].length,
		).toBe(1);
	});
});

describe("phone tier — the three touch-action declarations (G4)", () => {
	/**
	 * The class token is assembled from its parts at runtime. Tailwind v4's source
	 * detection scans `tests/`, and an arbitrary-property utility written
	 * literally here becomes a real emitted rule whose only origin is a test
	 * (AGENTS.md §8, and the measured `max-mobile:opacity-0` case).
	 */
	const ta = (value: string) => `[touch-action:${value}]`;

	/** The `className="…"` or `className={…}` nearest after an anchor. */
	function classAfter(src: string, anchor: string): string {
		const at = src.indexOf(anchor);
		if (at === -1) {
			throw new Error(`no anchor \`${anchor}\` in source.`);
		}
		const braced = src.indexOf("className={", at);
		const quoted = src.indexOf('className="', at);
		const useBraced =
			braced !== -1 && (quoted === -1 || braced < quoted) ? braced : -1;
		if (useBraced !== -1) {
			return balanced(src, useBraced + "className=".length).body;
		}
		if (quoted === -1) {
			throw new Error(`no className after \`${anchor}\`.`);
		}
		const from = quoted + 'className="'.length;
		return src.slice(from, src.indexOf('"', from));
	}

	/**
	 * ⛔ THE ENCLOSING BACKTICK IS STRIPPED. A braced `className` is a template
	 * literal, so its FIRST token arrives as `` `relative `` — and the first token
	 * is exactly where a `[touch-action:none]` would sit if someone put it at the
	 * head of the panel's class string, at which point the `not.toContain` arm
	 * below would pass against the defect it rejects. Found in the mutation pass
	 * for `phone-sheet-dismissal.test.tsx`, which had the same hole.
	 */
	const tokens = (s: string) =>
		s
			.split(/\s+/)
			.map((t) => t.replace(/^[`'"]+|[`'"]+$/g, ""))
			.filter(Boolean);

	it("phone-touch::the-track-pans-on-both-axes", () => {
		// ⚠ BOTH AXES, DELIBERATELY. Restricting to `pan-x` would hand horizontal
		// panning to the browser and TAKE VERTICAL AWAY — which on a feed of posts
		// means the page cannot be read, i.e. half of the reported P0 reproduced by
		// a one-word change. `PhoneFeedTrack`'s own docblock states it.
		const cls = tokens(
			classAfter(
				code(read(`${PHONE_DIR}/PhoneFeedTrack.tsx`)),
				'data-testid="phone-feed-track"',
			),
		);
		expect(cls).toContain(ta("pan-x_pan-y"));
		// POSITIVE CONTROL — the extraction found the scroller's real class list.
		expect(cls).toContain("snap-mandatory");
		expect(cls).toContain("overflow-x-auto");
	});

	it("phone-touch::the-tier-root-declares-manipulation-below-640-only", () => {
		// ⚠ VARIANT-PREFIXED, so it is inert on the desktop tree. The token is the
		// tap-delay removal for the whole phone subtree; unprefixed it would be a
		// desktop change, which ADR-0051 D-2 does not permit here.
		const V = "max-mobile";
		const S = ":";
		const cls = tokens(
			classAfter(
				code(read(`${PHONE_DIR}/PhoneDebateView.tsx`)),
				'data-testid="phone-debate-view"',
			),
		);
		expect(cls).toContain(`${V}${S}${ta("manipulation")}`);
		// POSITIVE CONTROL — the same read sees the root's gate tokens, so the
		// assertion above is about the root and not about an empty string.
		expect(cls).toContain("hidden");
		expect(cls).toContain(`${V}${S}flex`);
	});

	it("phone-touch::the-handle-is-the-one-element-allowed-touch-action-none", () => {
		/**
		 * ⛔ `none` HERE IS NOT AN EXCEPTION TO THE WALL, AND THE DISTINCTION IS
		 * THE POINT. The wall above forbids `preventDefault` — an imperative call
		 * inside a listener, whose blast radius is whatever is under the finger and
		 * which the browser cannot reason about ahead of time. `touch-action` is a
		 * DECLARATION on one element: the browser is told, before any gesture
		 * starts, that this box is not a scroller.
		 *
		 * And this box genuinely is not one. The handle is a ~36×20px strip whose
		 * whole purpose is the drag; the sheet body beside it keeps
		 * `overflow-y-auto`, and the page behind it is unreachable while a modal is
		 * up. `none` on the PANEL or the BODY would be the defect this file exists
		 * to prevent, so the assertion is scoped to the handle and the two
		 * neighbours are checked for its absence.
		 */
		const src = code(read(`${PHONE_DIR}/PhoneSheet.tsx`));
		expect(
			tokens(classAfter(src, 'data-testid="phone-sheet-handle"')),
		).toContain(ta("none"));
		for (const neighbour of ["phone-sheet-panel", "phone-sheet-body"]) {
			const cls = tokens(classAfter(src, `data-testid="${neighbour}"`));
			expect(
				cls,
				`${neighbour} must not declare touch-action:none — it is a scroller ` +
					"or the parent of one",
			).not.toContain(ta("none"));
			expect(
				cls.length,
				`${neighbour}: the class list was read`,
			).toBeGreaterThan(2);
		}
		// ...and the body keeps the scrolling that makes the ceiling survivable
		// with a keyboard up.
		expect(tokens(classAfter(src, 'data-testid="phone-sheet-body"'))).toContain(
			"overflow-y-auto",
		);
	});
});
