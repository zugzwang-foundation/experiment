/**
 * WARLI-2 slice 9 — emit the standalone preview.
 *
 *   pnpm tsx scripts/warli-preview.tsx ~/Downloads/zz_WARLI-2_preview_<UTC>.html
 *
 * The preview is the DELIVERABLE of this task, because the component it
 * previews is mounted nowhere: the mount point is the auth surface, which is a
 * named critical path under an active lock in another session. So the only way
 * anyone can judge whether the composition works is a file they can
 * double-click, and that file has to survive with no build, no server and no
 * network.
 *
 * ⚠ IT RENDERS THE REAL COMPONENT. The markup below comes from
 * `renderToStaticMarkup(<WarliHero />)` and the animation CSS is the component's
 * own exported `WARLI_CSS` — not a copy. If the preview and the shipped artwork
 * ever disagree about the drawing, this script is broken, not merely stale.
 *
 * ⚠ THE PLATE IS THE POINT, NOT A NICETY. At hero scale a figure is 58 units in
 * a 1440-unit frame — about twelve pixels — so the thing that distinguishes a
 * scholar from a labourer is a handful of pixels across, and the faces are
 * smaller than that. That is correct for the composition, which is meant to read
 * as a crowd rather than as a census, and it makes every figure and every motif
 * impossible to JUDGE. WARLI-1's single worst mistake was building this plate,
 * glancing at it, and missing a figure whose arms were visibly broken for two
 * hours. When you build an instrument specifically to see something, spend the
 * minute actually reading it.
 *
 * ⚠ ONE THING IS TRANSCRIBED RATHER THAN SHARED, and it is the honest weak
 * point: the pointer interaction. The component's copy lives in a React
 * `useEffect` and is TypeScript; the preview needs plain JS in a `<script>` tag
 * with no build step. Extracting a shared module would mean either shipping the
 * source text through `new Function` — an eval, which is exactly the thing a
 * security review should refuse in an artwork — or emitting a second bundle,
 * which defeats "double-click it". So the ~40 lines are transcribed, the
 * duplication is stated at the top of the generated file, and the arithmetic
 * that actually decides the composition (`../src/components/art/warli/geometry.ts`,
 * `../src/components/art/warli/scene.ts`) is NOT duplicated, because that is the
 * part a divergence would silently corrupt.
 *
 * ⚠ HEX LITERALS ARE PERMITTED IN THE GENERATED FILE ONLY. It is not in the
 * view layer, it is not scanned by `tests/unit/design/no-raw-hex-view-layer.test.ts`,
 * and it must resolve its own tokens because there is no Tailwind to do it. The
 * TOKEN values are transcribed byte-for-byte from `src/app/globals.css`, which
 * this task never edits.
 *
 * ⚠ TWO VALUES ARE NOT TRANSCRIBED AND ARE NOT TOKENS: the guide-circle strokes
 * are invented, and they are the only CHROMATIC colours anywhere in this task.
 * That is deliberate — a dev guide drawn over monochrome artwork has to be
 * distinguishable FROM the artwork, and a grey guide over a grey drawing helps
 * nobody. Saying "transcribed from globals.css" without this note claimed a
 * provenance two of the values do not have.
 */

import { writeFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";

import { MOTIF_RENDERERS } from "../src/components/art/warli/field-layer";
import {
	FIELD_FIGURES,
	Figure,
	type FigureSpec,
	INNER_FIGURES,
	OUTER_FIGURES,
} from "../src/components/art/warli/figures";
import {
	R_INNER,
	R_OUTER,
	VIEW_HEIGHT,
	VIEW_WIDTH,
	WARLI_CSS,
	WarliHero,
} from "../src/components/art/warli/hero";
import { WEIGHT_SPARE } from "../src/components/art/warli/primitives";
import { SCENE_MOTIFS } from "../src/components/art/warli/scene";

const out = process.argv[2];
if (out === undefined) {
	throw new Error("usage: tsx scripts/warli-preview.tsx <output.html>");
}

const art = renderToStaticMarkup(<WarliHero />);

/**
 * Escape a value on its way into raw HTML.
 *
 * ⚠ ONE VALUE IN THIS FILE IS NOT CONSTRAINED BY THE TYPE SYSTEM. Everything
 * else interpolated into the document below is a number, a closed union, or
 * React's own escaped output. `spec.label` is typed plain `string`, so the only
 * thing keeping it inert is that all the call sites happen to pass literals.
 * That is a fact about today's data, not a property of the code, and this is a
 * raw-concatenation sink outside React — so it gets escaped rather than trusted.
 * Cheaper than narrowing the type, and it stays correct if the labels ever come
 * from somewhere else.
 *
 * ⚠ THE RULE IS "EVERY STRING-TYPED VALUE INTERPOLATED INTO HTML HERE IS
 * ESCAPED", not "only the unconstrained ones". `density`, `prop` and `kind` are
 * closed unions or module data and would survive unescaped; escaping the plain
 * `string` and not them would leave a reader re-deriving which values are
 * constrained on every future edit, and getting that derivation wrong once is
 * the whole bug. A uniform rule is greppable; a clever one is not.
 *
 * ⛔ AND THE RULE IS NOT "EVERYTHING", WHICH IS WHAT THIS SENTENCE USED TO SAY.
 * It is false in the direction that misleads. Roughly two dozen interpolations
 * here are NUMBERS and are correctly unescaped — and two of those
 * (`${VIEW_WIDTH}`, `${VIEW_HEIGHT}`) sit inside the `<script>` block, where
 * `esc()` would be the WRONG tool: it is an HTML-entity escaper, and `&amp;` is
 * literal text in JavaScript, not an escape. What keeps those two safe is that
 * they are `export const` numeric literals, which TypeScript pins at literal
 * type — a compile-time guarantee, not an escaping one. A reader who believed
 * the old sentence would either break them by "fixing" them, or add a new
 * script-context string believing it was covered.
 */
const esc = (value: string): string =>
	value.replace(
		/[&<>"']/g,
		(ch) =>
			({
				"&": "&amp;",
				"<": "&lt;",
				">": "&gt;",
				'"': "&quot;",
				"'": "&#39;",
			})[ch] ?? ch,
	);

type Register = "solid" | "dense" | "spare";

const cell = (spec: FigureSpec, density: Register) =>
	`<figure class="plate-cell">
		<svg viewBox="-30 -76 64 84" aria-hidden="true">${renderToStaticMarkup(
			<Figure spec={spec} density={density} />,
		)}</svg>
		<figcaption>${esc(spec.label)}<small>${esc(density)}${spec.prop === "none" ? " · pose" : ` · ${esc(spec.prop)}`}${spec.face === undefined ? "" : " · FACED"}</small></figcaption>
	</figure>`;

/** The four oppositions, each as the pair that sits at 180° across the ring. */
const pairPlate = [0, 1, 2, 3]
	.map((i) => {
		const a = INNER_FIGURES[i];
		const b = INNER_FIGURES[i + 4];
		if (a === undefined || b === undefined) {
			return "";
		}
		return `<div class="plate-pair">${cell(a, "solid")}${cell(b, "solid")}</div>`;
	})
	.join("");

const outerPlate = OUTER_FIGURES.map((spec) => cell(spec, "spare")).join("");

const fieldPlate = FIELD_FIGURES.map((spec, i) =>
	cell(spec, i % 2 === 0 ? "dense" : "spare"),
).join("");

/** Every motif the scene engine can place, once each, at a readable size. */
const motifPlate = [...new Set(SCENE_MOTIFS)]
	.map((kind) => {
		const render = MOTIF_RENDERERS[kind];
		if (render === undefined) {
			return `<figure class="plate-cell motif"><svg viewBox="-24 -40 48 48"></svg><figcaption>${esc(kind)}<small>NO RENDERER</small></figcaption></figure>`;
		}
		return `<figure class="plate-cell motif">
			<svg viewBox="-24 -42 48 50" aria-hidden="true">${renderToStaticMarkup(
				<g>{render(7, WEIGHT_SPARE)}</g>,
			)}</svg>
			<figcaption>${esc(kind)}</figcaption>
		</figure>`;
	})
	.join("");

/** The auth card, at the size §3 of the plan derives every radius from. */
const CARD_W = 416;
const CARD_H = 480;

const html = `<!doctype html>
<html lang="en" data-reduced="false" data-guides="false">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>WARLI-2 — density, character and the legible debate</title>
<!--
  GENERATED by scripts/warli-preview.tsx. Do not hand-edit; regenerate.

  The SVG below is renderToStaticMarkup(<WarliHero />) — the real component.
  The animation CSS is the component's own exported WARLI_CSS.
  The pointer interaction is TRANSCRIBED from the component's useEffect,
  because this file must run with no build step. It is the one part that can
  drift. The geometry and the scene placement are not duplicated anywhere.

  Hex literals appear here and only here: there is no Tailwind in this file to
  resolve --color-ink, so the tokens are declared inline, transcribed from
  src/app/globals.css.
-->
<style>
:root {
	--color-ground: #181818;
	--color-ink: #fafafa;
	--color-n0: #212121;
	--color-n2: #404040;
	--color-n5: #989898;
}
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: var(--color-ground); color: var(--color-ink); }
body {
	font: 13px/1.5 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
	min-height: 100vh;
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 18px;
	padding: 22px 0 60px;
}

.bar {
	display: flex;
	gap: 10px;
	align-items: center;
	flex-wrap: wrap;
	justify-content: center;
	padding: 10px 14px;
	border: 1px solid var(--color-n2);
	border-radius: 6px;
	background: var(--color-n0);
	position: sticky;
	top: 0;
	z-index: 5;
}
.bar b { font-weight: 600; letter-spacing: .02em; }
.bar span { color: var(--color-n5); }
button {
	font: inherit;
	color: var(--color-ink);
	background: transparent;
	border: 1px solid var(--color-n2);
	border-radius: 4px;
	padding: 5px 11px;
	cursor: pointer;
}
button[aria-pressed="true"] { background: var(--color-n2); }

/* The stage is exactly the design frame. It scales to fit the window, and
   because the pointer maths reads a live bounding rect the interaction stays
   correct at any scale. */
.fit { transform-origin: top center; }
.stage {
	position: relative;
	width: ${VIEW_WIDTH}px;
	height: ${VIEW_HEIGHT}px;
	background: var(--color-ground);
}
.stage svg[data-warli-hero] { position: absolute; inset: 0; width: 100%; height: 100%; }

/* The auth card, at its real size, so the composition can be judged against
   the thing that will actually sit there. */
.card {
	position: absolute;
	left: 50%;
	top: 50%;
	transform: translate(-50%, -50%);
	width: ${CARD_W}px;
	height: ${CARD_H}px;
	border: 1px solid var(--color-n2);
	border-radius: 10px;
	background: var(--color-n0);
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	gap: 14px;
	color: var(--color-n5);
	pointer-events: none;
}
.card .slab { width: 264px; height: 40px; border: 1px solid var(--color-n2); border-radius: 4px; }
.card .slab.tall { height: 46px; }
.card .rule { width: 264px; height: 1px; background: var(--color-n2); }

/* Guides: the inner baseline circle and the card's half-diagonal. Off by
   default — they are for checking the clearance claim, not for looking at. */
.guides { position: absolute; inset: 0; pointer-events: none; opacity: 0; }
html[data-guides="true"] .guides { opacity: 1; }

html[data-reduced="true"] .warli-spin { animation: none; }
html[data-reduced="true"] .warli-nudge { transition: none; transform: none; }

/* The plate — every figure and every motif at a size they can be judged at. */
.plate { width: min(1400px, 94vw); }
.plate h2 {
	font-size: 12px; font-weight: 600; letter-spacing: .08em; text-transform: uppercase;
	color: var(--color-n5); margin: 26px 0 12px; padding-bottom: 6px;
	border-bottom: 1px solid var(--color-n2);
}
.plate-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
.plate-flow { display: grid; grid-template-columns: repeat(6, 1fr); gap: 10px; }
.plate-motifs { display: grid; grid-template-columns: repeat(8, 1fr); gap: 10px; }
.plate-pair {
	display: grid;
	grid-template-columns: 1fr 1fr;
	border: 1px solid var(--color-n2);
	border-radius: 6px;
	background: var(--color-n0);
	overflow: hidden;
}
.plate-flow .plate-cell, .plate-motifs .plate-cell {
	border: 1px solid var(--color-n2); border-radius: 6px; background: var(--color-n0);
}
.plate-cell { margin: 0; padding: 10px 6px 8px; text-align: center; color: var(--color-ink); }
.plate-pair .plate-cell + .plate-cell { border-left: 1px solid var(--color-n2); }
.plate-cell svg { width: 100%; height: 128px; display: block; overflow: visible; }
.plate-cell.motif svg { height: 84px; }
.plate-cell figcaption { margin-top: 6px; font-size: 11px; letter-spacing: .03em; }
.plate-cell small { display: block; color: var(--color-n5); font-size: 10px; }

${WARLI_CSS}
</style>
</head>
<body>

<div class="bar">
	<b>WARLI-2</b>
	<span>${VIEW_WIDTH} × ${VIEW_HEIGHT} · inner r=${R_INNER} · outer r=${R_OUTER} · ${INNER_FIGURES.length} faced + ${OUTER_FIGURES.length} crowd + ${FIELD_FIGURES.length} field</span>
	<button id="reduce" type="button" aria-pressed="false">prefers-reduced-motion: off</button>
	<button id="guides" type="button" aria-pressed="false">guides: off</button>
	<button id="zoom" type="button" aria-pressed="true">fit to window</button>
	<span id="phase">move the pointer over the art</span>
</div>

<div class="fit" id="fit">
	<div class="stage" id="stage">
		${art}
		<svg class="guides" viewBox="0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}" aria-hidden="true">
			<circle cx="${VIEW_WIDTH / 2}" cy="${VIEW_HEIGHT / 2}" r="${R_INNER}" fill="none" stroke="#4b8f8f" stroke-width="1" stroke-dasharray="6 6"/>
			<circle cx="${VIEW_WIDTH / 2}" cy="${VIEW_HEIGHT / 2}" r="${R_OUTER}" fill="none" stroke="#4b8f8f" stroke-width="1" stroke-dasharray="6 6"/>
			<circle cx="${VIEW_WIDTH / 2}" cy="${VIEW_HEIGHT / 2}" r="${Math.hypot(CARD_W / 2, CARD_H / 2).toFixed(2)}" fill="none" stroke="#8f6b4b" stroke-width="1" stroke-dasharray="3 5"/>
		</svg>
		<div class="card">
			<div class="slab tall"></div>
			<div class="rule"></div>
			<div class="slab"></div>
			<div class="slab"></div>
			<span>auth card — ${CARD_W} × ${CARD_H}</span>
		</div>
	</div>
</div>

<section class="plate">
	<h2>The four oppositions — the eight FACED positions, each beside the one it sits opposite at 180°</h2>
	<div class="plate-grid">${pairPlate}</div>

	<h2>The outer ring — twelve, faceless, counter-rotating</h2>
	<div class="plate-flow">${outerPlate}</div>

	<h2>The static field — twenty-eight, at work, drawn in both open registers</h2>
	<div class="plate-flow">${fieldPlate}</div>

	<h2>The motif library — every kind the scene engine can place</h2>
	<div class="plate-motifs">${motifPlate}</div>
</section>

<script>
(function () {
	"use strict";

	// ---- transcribed from src/components/art/warli/hero.tsx useEffect ----
	var PHASE_DEG = 22.5;
	var STEP_DEG = 45;

	function currentRotationDeg(el) {
		if (!el) return 0;
		var value = getComputedStyle(el).transform;
		if (!value || value === "none") return 0;
		var m = value.match(/matrix\\(([^)]+)\\)/);
		if (!m || !m[1]) return 0;
		var parts = m[1].split(",").map(parseFloat);
		if (isNaN(parts[0]) || isNaN(parts[1])) return 0;
		return Math.atan2(parts[1], parts[0]) * 180 / Math.PI;
	}
	function wrapSigned(deg) {
		var m = ((deg + 180) % 360 + 360) % 360;
		return m - 180;
	}

	var root = document.querySelector("[data-warli-hero]");
	var innerSpin = document.querySelector('[data-warli-spin="inner"]');
	var outerSpin = document.querySelector('[data-warli-spin="outer"]');
	var innerNudge = innerSpin && innerSpin.querySelector(".warli-nudge");
	var outerNudge = outerSpin && outerSpin.querySelector(".warli-nudge");
	var readout = document.getElementById("phase");
	var frame = null;

	function engage() {
		var rect = root.getBoundingClientRect();
		frame = {
			centreX: rect.left + rect.width / 2,
			centreY: rect.top + rect.height / 2,
			innerPhase: currentRotationDeg(innerSpin),
			outerPhase: currentRotationDeg(outerSpin)
		};
		root.dataset.warliEngaged = "true";
	}
	function move(event) {
		if (!frame) return;
		var dx = event.clientX - frame.centreX;
		var dy = event.clientY - frame.centreY;
		var pointerDeg = Math.atan2(dx, -dy) * 180 / Math.PI;
		var misalign = wrapSigned(frame.outerPhase - frame.innerPhase);
		var settledAt = frame.innerPhase + misalign / 2;
		var nearest = Math.round((pointerDeg - PHASE_DEG - settledAt) / STEP_DEG) * STEP_DEG;
		var toPointer = wrapSigned(pointerDeg - (PHASE_DEG + settledAt + nearest));
		if (innerNudge) innerNudge.style.setProperty("--warli-nudge", (misalign / 2 + toPointer).toFixed(3) + "deg");
		if (outerNudge) outerNudge.style.setProperty("--warli-nudge", (-misalign / 2 + toPointer).toFixed(3) + "deg");
		if (readout) readout.textContent =
			"pointer " + pointerDeg.toFixed(1) + "° · misalign " + misalign.toFixed(1) + "° · rings paused and aligning";
	}
	function release() {
		frame = null;
		delete root.dataset.warliEngaged;
		if (innerNudge) innerNudge.style.setProperty("--warli-nudge", "0deg");
		if (outerNudge) outerNudge.style.setProperty("--warli-nudge", "0deg");
		if (readout) readout.textContent = "rings turning";
	}
	root.addEventListener("pointerenter", engage, { passive: true });
	root.addEventListener("pointermove", move, { passive: true });
	root.addEventListener("pointerleave", release, { passive: true });
	// ---- end transcription ----

	function toggle(id, attr, onLabel, offLabel) {
		var btn = document.getElementById(id);
		btn.addEventListener("click", function () {
			var on = document.documentElement.getAttribute(attr) !== "true";
			document.documentElement.setAttribute(attr, on ? "true" : "false");
			btn.setAttribute("aria-pressed", on ? "true" : "false");
			btn.textContent = on ? onLabel : offLabel;
		});
	}
	toggle("reduce", "data-reduced", "prefers-reduced-motion: ON", "prefers-reduced-motion: off");
	toggle("guides", "data-guides", "guides: ON", "guides: off");

	var fit = document.getElementById("fit");
	var fitting = true;
	function apply() {
		if (!fitting) { fit.style.transform = "none"; fit.style.height = ""; return; }
		var k = Math.min(1, (window.innerWidth - 40) / ${VIEW_WIDTH});
		fit.style.transform = "scale(" + k + ")";
		fit.style.height = (${VIEW_HEIGHT} * k) + "px";
	}
	var zoomBtn = document.getElementById("zoom");
	zoomBtn.addEventListener("click", function () {
		fitting = !fitting;
		zoomBtn.setAttribute("aria-pressed", fitting ? "true" : "false");
		zoomBtn.textContent = fitting ? "fit to window" : "100%";
		apply();
	});
	window.addEventListener("resize", apply);
	apply();
})();
</script>
</body>
</html>
`;

writeFileSync(out, html, "utf8");
process.stdout.write(`${out}\n${html.length} bytes\n`);
