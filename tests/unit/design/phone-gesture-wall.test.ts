import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * MOBILE-2d — THE DOORS THE TOUCH SCAN LEAVES OPEN.
 *
 * ⛔⛔ `phone-touch-handlers.test.ts` FORBIDS THREE SHAPES BY NAME AND A
 * HANDLER CAN ARRIVE IN AT LEAST FIVE. Its three rows resolve a JSX
 * `onTouch*`/`onPointer*` prop, an `addEventListener` whose receiver is spelled
 * literally `track`, and a `querySelector` written with a double-quoted
 * `data-pane` selector. Measured by mutation against the whole of
 * `tests/unit/design/` (26 files, 203 tests) on 2026-09-13 — every one of these
 * is GREEN today, and three of them reinstate MOBILE-2c's P0 exactly:
 *
 *   · `track.ontouchmove = (e) => e.preventDefault()` — a DOM property
 *     assignment. It is a NON-passive listener by default, so the
 *     `preventDefault` works, and no rule anywhere looks at it;
 *   · `Object.assign(track, { onwheel: … })` — the same thing, spelled so that
 *     even a `.on… =` scan misses it;
 *   · `const alias = track; alias.addEventListener("wheel", block,
 *     { passive: false })` — the "exactly these two listeners" row is keyed on
 *     the literal receiver name `track`, so an alias is invisible to it, and
 *     `wheel` is outside the `touchstart`/`touchmove` pair the passive rule
 *     covers;
 *   · `{...paneHandlers}` on the pane — a spread carries `onTouchMove` with no
 *     `onTouchMove=` anywhere for the prop scan to find;
 *   · `ref={(el) => el?.addEventListener("pointerdown", stop)}` — `ref` is not
 *     in the forbidden-prop list and `pointerdown` is not in the native pair.
 *
 * ⇒ The four rules below are shaped as CENSUSES rather than prohibitions, for
 * the reason the lane already learned twice: a rule that lists the shapes it
 * forbids is only ever as complete as the imagination of whoever wrote it,
 * while a rule that enumerates what is ALLOWED fails closed on a shape nobody
 * anticipated. A new listener on this tier is a decision; making it red is the
 * point.
 *
 * ⚠ SOURCE SCAN, because the property is textual: `touch-action` is CSS jsdom
 * never computes and a `preventDefault` has no observable consequence in an
 * environment with no scrolling to prevent (AGENTS.md §9).
 */
const ROOT = process.cwd();
const PHONE_DIR = "src/components/debate/phone";
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

/** Comments stripped before every scan, line count preserved. */
function code(src: string): string {
	return src
		.replace(/\/\*[\s\S]*?\*\//g, (m) =>
			"\n".repeat((m.match(/\n/g) ?? []).length),
		)
		.replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

function phoneFiles(): { file: string; src: string }[] {
	return readdirSync(join(ROOT, PHONE_DIR))
		.filter((n) => n.endsWith(".ts") || n.endsWith(".tsx"))
		.map((n) => ({
			file: `${PHONE_DIR}/${n}`,
			src: code(read(`${PHONE_DIR}/${n}`)),
		}));
}

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
 * Every `addEventListener` in `src`, **whatever its receiver is spelled**, as
 * `receiver::event::handler::options`.
 *
 * ⛔ THE RECEIVER IS CAPTURED BUT THE SCAN IS NOT KEYED ON IT. That is the whole
 * difference from the existing row: `/track\.addEventListener/` cannot see
 * `alias.addEventListener`, `node.addEventListener`, `el?.addEventListener` or
 * `paneRef.current.addEventListener`, and each of those is one rename away.
 */
function listeners(src: string): string[] {
	const out: string[] = [];
	for (const m of src.matchAll(/([\w$.?]*?)\.?addEventListener\s*\(/g)) {
		const paren = src.indexOf("(", m.index ?? 0);
		const args = splitArgs(balanced(src, paren).body);
		const receiver = (m[1] ?? "").replace(/\.$/, "") || "<bare>";
		const event = (args[0] ?? "").replace(/^["'`]|["'`]$/g, "");
		const handler = (args[1] ?? "").trim();
		const opts = (args[2] ?? "").replace(/\s/g, "");
		out.push(`${receiver}::${event}::${handler}::${opts}`);
	}
	return out.sort();
}

/**
 * ⛔ THE RATIFIED SET, IN FULL — every listener the phone tier is allowed to
 * register, receiver included. Two of them are `PhoneFeedTrack`'s D-1 mute
 * release: passive, movement-only, reading and never preventing. The third is
 * `PhoneSheet`'s Escape/Tab containment on `document`, which is keyboard rather
 * than gesture and is the one place `preventDefault` is correct here.
 *
 * ⚠ ADDING A ROW IS A DECISION, NOT AN EDIT. Momentum, rubber-band, axis lock
 * and snapping on this tier are the BROWSER's; the reason this lane has a P0 in
 * its history is that reimplementing them is where the mistakes live.
 */
const RATIFIED_LISTENERS = [
	"document::keydown::onKey::",
	"track::pointermove::release::{passive:true}",
	"track::touchmove::release::{passive:true}",
].sort();

/**
 * The JSX attributes of the element whose opening tag contains `anchor`.
 * Pinned by `data-*` symbol, never by line or by character window (`O-8`).
 */
function attrsOfElementWith(src: string, anchor: string): string {
	const at = src.indexOf(anchor);
	if (at === -1) throw new Error(`no anchor \`${anchor}\``);
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

/** The DOM handler properties an assignment could smuggle a gesture in through. */
const HANDLER_PROPS =
	/(?:\.|\b)(ontouch(?:start|move|end|cancel)|onpointer(?:down|move|up|cancel)|onwheel|onscroll|onmousedown|onmousemove|ondrag(?:start|)?)\s*[:=]/g;

describe("phone gesture wall — the scan reaches a non-empty corpus", () => {
	it("phone-gesture::guard-is-alive", () => {
		const files = phoneFiles();
		expect(files.length, "the phone tree was read").toBeGreaterThanOrEqual(8);
		// ...and the receiver-agnostic listener scan really finds the tier's own
		// registrations, in the exact serialisation the rule below compares.
		const all = files.flatMap(({ src }) => listeners(src));
		expect(all.length, "listeners were found at all").toBeGreaterThanOrEqual(3);
		expect(all).toContain("track::touchmove::release::{passive:true}");
	});

	/** Every recogniser, proved to fire on the shape it exists to reject. */
	it("phone-gesture::the-recognisers-fire", () => {
		expect(
			listeners('alias.addEventListener("wheel", block, { passive: false });'),
			"an ALIASED receiver is exactly what a `track.`-keyed scan cannot see",
		).toEqual(["alias::wheel::block::{passive:false}"]);
		expect(
			listeners(
				'p?.addEventListener("pointerdown", stop, { passive: false });',
			),
		).toEqual(["p?::pointerdown::stop::{passive:false}"]);
		expect(
			listeners("paneRef.current.addEventListener('touchmove', stop);"),
		).toEqual(["paneRef.current::touchmove::stop::"]);

		const SPREAD = /\{\s*\.\.\./;
		expect(SPREAD.test("<div data-pane={k} {...paneHandlers} />")).toBe(true);
		expect(SPREAD.test("<div data-pane={k} className={cn(a, b)} />")).toBe(
			false,
		);

		const REF_LISTENER =
			/ref=\{[\s\S]{0,200}?addEventListener|ref=\{\s*([\w$]+)\s*\}/;
		expect(
			REF_LISTENER.test(
				'ref={(el) => { el?.addEventListener("pointerdown", s); }}',
			),
		).toBe(true);

		const props = [
			..."track.ontouchmove = (e) => e.preventDefault();".matchAll(
				HANDLER_PROPS,
			),
		];
		expect(props.map((m) => m[1])).toEqual(["ontouchmove"]);
		expect(
			[
				..."Object.assign(track, { onwheel: (e) => e.preventDefault() });".matchAll(
					HANDLER_PROPS,
				),
			].map((m) => m[1]),
			"the object-literal spelling must be caught too — it is the same " +
				"assignment wearing a different syntax",
		).toEqual(["onwheel"]);
		expect(
			[
				..."const onActiveChangeRef = useRef(onActiveChange);".matchAll(
					HANDLER_PROPS,
				),
			],
			"an ordinary camelCase callback prop is not a DOM handler property",
		).toHaveLength(0);
	});
});

describe("phone gesture wall — the listener set is closed", () => {
	/**
	 * ⛔⛔ AN ALLOWLIST, NOT A DENYLIST, AND RECEIVER-AGNOSTIC. The existing row
	 * asserts the track's listeners are exactly the mute-release pair — which is
	 * the right assertion made through a keyhole: it matches
	 * `/track\.addEventListener/`, so a second reference to the same element
	 * registers as many listeners as it likes without the row moving. Measured: a
	 * `wheel` listener with `{ passive: false }` calling `preventDefault`, added
	 * through a one-line alias, is GREEN under the whole design suite.
	 */
	it("phone-gesture::every-listener-in-the-phone-tree-is-ratified", () => {
		const all = phoneFiles()
			.flatMap(({ file, src }) => listeners(src).map((l) => `${file} ${l}`))
			.map((l) => l.slice(l.indexOf(" ") + 1))
			.sort();
		expect(
			all,
			"the phone tier's listeners are a CLOSED set: two passive movement " +
				"reads on the track (the D-1 mute release) and one keydown on the " +
				"document (Escape and Tab containment). Anything else is gesture code " +
				"reimplementing momentum, rubber-band, axis lock or snapping — which " +
				"is where this lane's P0 came from",
		).toEqual(RATIFIED_LISTENERS);
	});

	/**
	 * ⚠ AND THE ENABLING CONDITION SURVIVES, WIDENED PAST THE NATIVE PAIR. A
	 * `preventDefault` inside `{ passive: true }` is ignored and logs; inside
	 * `{ passive: false }` it kills scrolling. The existing row checks that only
	 * for `touchstart`/`touchmove`, so `wheel` and the pointer family were
	 * outside it — and `wheel` is the one a desktop-minded edit reaches for.
	 */
	it("phone-gesture::no-scroll-bearing-listener-opts-out-of-passive", () => {
		const SCROLL_BEARING = /^(touchstart|touchmove|wheel|mousewheel)$/;
		const offenders: string[] = [];
		for (const { file, src } of phoneFiles()) {
			for (const l of listeners(src)) {
				const [, event = "", , opts = ""] = l.split("::");
				if (!SCROLL_BEARING.test(event)) continue;
				if (!opts.includes("passive:true")) offenders.push(`${file}: ${l}`);
			}
		}
		expect(offenders).toEqual([]);
		// POSITIVE CONTROL — at least one scroll-bearing registration was reached,
		// so the empty list is a verdict rather than an empty loop.
		const reached = phoneFiles().flatMap(({ src }) =>
			listeners(src).filter((l) => SCROLL_BEARING.test(l.split("::")[1] ?? "")),
		);
		expect(reached.length).toBeGreaterThanOrEqual(1);
	});
});

describe("phone gesture wall — the two elements that carry nothing", () => {
	/**
	 * ⛔ A SPREAD IS A PROP LIST THE PROP SCAN CANNOT READ. `{...paneHandlers}`
	 * delivers `onTouchMove` to the pane with the string `onTouchMove=` appearing
	 * nowhere in the tag — measured GREEN. The track and the panes take a fixed,
	 * short, fully-enumerated set of attributes; a spread on either is banned
	 * outright rather than resolved, because resolving it means following an
	 * identifier to an object literal that a later edit can make dynamic.
	 */
	it("phone-gesture::neither-the-track-nor-a-pane-takes-a-spread-prop", () => {
		const src = code(read(`${PHONE_DIR}/PhoneFeedTrack.tsx`));
		const offenders: string[] = [];
		for (const [label, anchor] of [
			["track", 'data-testid="phone-feed-track"'],
			["pane", "data-pane={pane.key}"],
		] as [string, string][]) {
			const tag = attrsOfElementWith(src, anchor);
			if (/\{\s*\.\.\./.test(tag)) offenders.push(`${label}: spread prop`);
		}
		expect(
			offenders,
			"a spread hands these elements props nothing can enumerate — and the " +
				"prop that matters here is the one that must not exist",
		).toEqual([]);
		// POSITIVE CONTROL — the extractor reads a real tag, and the rule fires.
		expect(attrsOfElementWith(src, 'data-testid="phone-feed-track"')).toContain(
			"ref={trackRef}",
		);
		expect(
			/\{\s*\.\.\./.test('<div data-pane={pane.key} {...h} className="x">'),
		).toBe(true);
	});

	/**
	 * ⛔ AND NO `ref` CALLBACK ATTACHES ONE. `ref` is not an event prop, so the
	 * forbidden-prop list never looks at it — but a callback ref is handed the
	 * element and can do anything to it, which makes it the most direct route
	 * back to gesture JS on exactly the two elements that must not have any.
	 * `PhoneFeedTrack`'s own `ref={trackRef}` is an object ref and is untouched.
	 */
	it("phone-gesture::no-ref-callback-in-the-phone-tree-attaches-a-listener", () => {
		const offenders: string[] = [];
		for (const { file, src } of phoneFiles()) {
			for (const m of src.matchAll(/ref=\{/g)) {
				const body = balanced(src, (m.index ?? 0) + "ref=".length).body;
				if (body.includes("addEventListener")) {
					offenders.push(`${file}: ref callback registers a listener`);
				}
			}
		}
		expect(
			offenders,
			"a callback ref is handed the element; attaching a listener there is " +
				"gesture JS arriving through the one prop no rule was watching",
		).toEqual([]);
		// POSITIVE CONTROL — the corpus contains a real `ref={…}` to walk, and the
		// recogniser fires on the shape it rejects.
		const track = code(read(`${PHONE_DIR}/PhoneFeedTrack.tsx`));
		expect([...track.matchAll(/ref=\{/g)].length).toBeGreaterThanOrEqual(1);
		const sample = 'ref={(el) => { el?.addEventListener("pointerdown", s); }}';
		expect(
			balanced(sample, "ref=".length).body.includes("addEventListener"),
		).toBe(true);
	});

	/**
	 * ⛔⛔ AND NOTHING IS ASSIGNED AS A DOM HANDLER PROPERTY. `el.ontouchmove = fn`
	 * registers a NON-PASSIVE listener — the browser's default for a property
	 * assignment — so the `preventDefault` inside it works, and it is MOBILE-2c's
	 * P0 reproduced in one line, in a file whose every `addEventListener` is
	 * audited. `Object.assign(el, { onwheel })` is the same assignment written so
	 * that even a `.on… =` scan misses it, which is why both spellings are here.
	 */
	it("phone-gesture::no-event-handler-is-assigned-as-a-DOM-property", () => {
		const offenders: string[] = [];
		for (const { file, src } of phoneFiles()) {
			for (const m of src.matchAll(HANDLER_PROPS)) {
				offenders.push(`${file}: ${m[1]}`);
			}
		}
		expect(
			offenders,
			"a DOM handler property is a non-passive listener by default, so the " +
				"preventDefault inside it works — the P0 in one line, past every " +
				"addEventListener rule in this directory",
		).toEqual([]);
		// POSITIVE CONTROLS — both spellings fire, and the tier's own camelCase
		// React props do not.
		expect(
			[..."track.ontouchmove = stop;".matchAll(HANDLER_PROPS)].map((m) => m[1]),
		).toEqual(["ontouchmove"]);
		expect(
			[..."Object.assign(el, { onwheel: stop });".matchAll(HANDLER_PROPS)].map(
				(m) => m[1],
			),
		).toEqual(["onwheel"]);
		expect([
			..."onActiveChangeRef.current = onActiveChange;".matchAll(HANDLER_PROPS),
		]).toHaveLength(0);
	});

	/**
	 * ⛔ AND A PANE IS NEVER THE TARGET OF ONE. The existing row requires a
	 * `querySelector` written with a double-quoted `data-pane` selector and an
	 * `addEventListener` within 120 characters — but the shape actually on disk is
	 * `track.querySelector<HTMLElement>(\`[data-pane="${key}"]\`)`, which the
	 * pattern cannot match on either count: the generic breaks `\s*\(`, and the
	 * template literal contains the double quotes its character class excludes.
	 * So the one query form the file really uses is the one the rule cannot see.
	 */
	it("phone-gesture::nothing-attaches-a-listener-to-a-pane-it-looked-up", () => {
		const offenders: string[] = [];
		for (const { file, src } of phoneFiles()) {
			for (const m of src.matchAll(
				/(?:const|let|var)\s+([\w$]+)\s*=[^;]*?querySelector(?:All)?\s*(?:<[^>]*>)?\s*\([^;]*?data-pane/g,
			)) {
				const ident = m[1] ?? "";
				if (new RegExp(`\\b${ident}\\??\\.addEventListener`).test(src)) {
					offenders.push(`${file}: ${ident}.addEventListener`);
				}
			}
		}
		expect(
			offenders,
			"the pane is a PURE SNAP ITEM — the vertical scrolling it appears to " +
				"need belongs to an ancestor, and a listener on it is the nested " +
				"topology arriving as JavaScript instead of as CSS",
		).toEqual([]);
		// POSITIVE CONTROL — the recogniser catches the shape the file really uses.
		const sample =
			'const p = track.querySelector<HTMLElement>(`[data-pane="${key}"]`);\n' +
			'p?.addEventListener("pointerdown", stop);';
		const hits = [
			...sample.matchAll(
				/(?:const|let|var)\s+([\w$]+)\s*=[^;]*?querySelector(?:All)?\s*(?:<[^>]*>)?\s*\([^;]*?data-pane/g,
			),
		];
		expect(hits).toHaveLength(1);
		expect(
			new RegExp(`\\b${hits[0]?.[1]}\\??\\.addEventListener`).test(sample),
		).toBe(true);
		// ...and the tier's own legitimate pane lookups are NOT flagged.
		expect(
			[
				...code(read(`${PHONE_DIR}/PhoneFeedTrack.tsx`)).matchAll(
					/querySelector(?:All)?\s*(?:<[^>]*>)?\s*\([^;]*?data-pane/g,
				),
			].length,
			"the track really does look panes up — so the empty list above is a " +
				"verdict about what it does with them, not about finding none",
		).toBeGreaterThanOrEqual(2);
	});
});
