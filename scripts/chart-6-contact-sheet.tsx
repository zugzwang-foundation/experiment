/**
 * CHART-6 — emit the standalone contact sheet.
 *
 *   pnpm build && \
 *   ZUGZWANG_ENV=staging pnpm tsx scripts/chart-6-contact-sheet.tsx \
 *     ~/Downloads/zz_CHART-6_contact-sheet_<UTC>.html
 *
 * ⚠ ONE ARGUMENT, AND THE BUILD IS A PRECONDITION. An earlier version took a
 * woff2 path as a second argument; the fonts come from `.next/static/media` now
 * and that argument is gone. It is called out because the docblock kept
 * describing it after the code stopped reading it, so a caller passing a font
 * path would have had it silently ignored — a refusal-with-the-wrong-cause
 * (`O-3`) in a file that otherwise polices its own diagnostics carefully.
 *
 * ⚠ `ZUGZWANG_ENV=staging` IS LOAD-BEARING, NOT A HABIT. The fixtures below are
 * August-dated, and under the PRODUCTION window (Sep 15 → Nov 5) every one of
 * their instants maps to a negative x: the sheet would render blank plots while
 * its captions went on printing confident numbers. CHART-5 hit this and ruled
 * the same way. The banner prints the resolved window so a reader can see which
 * one they are looking at rather than inferring it.
 *
 * ⛔ IT RENDERS THE REAL COMPONENT. Every chart in the sheet is
 * `renderToStaticMarkup(<MarketPriceChart …/>)` at the product's own measured
 * boxes, with `globals.css`'s token values transcribed. If the sheet and the
 * shipped chart ever disagree about the drawing, this script is broken — not
 * merely stale.
 *
 * ⛔ THE FONT IS THE ONE THE PRODUCT SERVES, INLINED. Every width figure in this
 * sheet is a text advance, and a text advance measured against a fallback face is
 * a fiction shaped exactly like a number — which is why CHART-1 had to pin `YES`
 * at a hand-guessed 26 units and why CHART-2 deleted that pin. Every `.woff2`
 * this build emitted is base64'd into the app's own `@font-face` rules, and the
 * result is CHECKED at runtime: **the banner reads `FONT CHECK PASSED` only if
 * `document.fonts.check` confirms Geist, and every measured figure is withheld
 * until it does.**
 *
 * ⚠ HEX LITERALS ARE PERMITTED IN THE GENERATED FILE ONLY. It is not in the view
 * layer, it is not scanned by the raw-hex guard, and it must resolve its own
 * tokens because there is no Tailwind here. The values are transcribed
 * byte-for-byte from `src/app/globals.css`, which this task never edits.
 */

import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";

import { TERMINAL_PULSE_PEAK_SCALE } from "@/components/debate/chart/geometry";
import { MarketPriceChart } from "@/components/debate/chart/MarketPriceChart";
import {
	MARKET_CHART_WINDOW_END,
	MARKET_CHART_WINDOW_START,
} from "@/server/config/limits";
import type { PricePoint } from "@/server/discovery/price-series";

const [, , outPath] = process.argv;
if (!outPath) {
	throw new Error("usage: tsx scripts/chart-6-contact-sheet.tsx <out.html>");
}

/**
 * THIS BRANCH's COMPILED TAILWIND, INLINED — and the sheet REFUSES TO BUILD
 * without it.
 *
 * ⛔⛔ THE FIRST VERSION OF THIS SHEET SHIPPED WITHOUT IT AND REPORTED THIRTY
 * CONFIDENT FIGURES MEASURED AGAINST A LAYOUT THAT WAS NEVER APPLIED. Every
 * class the component relies on — `absolute`, `inset-0`, `relative`, `flex`,
 * `flex-1`, `-translate-y-1/2`, `-translate-x-full`, `whitespace-nowrap` — was an
 * inert string. Measured in that sheet: the label layer's computed `position` was
 * **`static`**, so its inline `left` did nothing at all, the two labels sat in
 * normal flow at the bottom of the card, and the sheet cheerfully printed
 * "YES 112.86px · NO 136.25px (flipped)". **The banner said FONT CHECK PASSED
 * throughout**, because the font genuinely had loaded — the one thing the sheet
 * was gated on was the one thing that was fine.
 *
 * ⚠ AND THE DEPLOYED APP'S CSS WOULD NOT HAVE FIXED IT. Tailwind emits only the
 * classes it finds in the source it scans, and this branch ADDS
 * `pointer-events-none`, `-translate-x-full` and `whitespace-nowrap` to this
 * component. A sheet built against `origin/main`'s stylesheet would have rendered
 * the labels un-flipped and wrapping — a wrong picture that looks like a right
 * one. So the CSS must come from THIS tree's own build.
 *
 * ⇒ Run `pnpm build` first. The throw below is the whole guard: a sheet is worth
 * nothing if its geometry is a fiction, and "I forgot to build" must not be able
 * to produce one quietly.
 */
function compiledCss(): string {
	// ⚠ `.next/static/chunks/`, NOT `.next/static/css/`. Next 16 with Turbopack
	// emits the app stylesheet alongside the JS chunks; the older `css/` directory
	// does not exist in this build and a lookup there throws ENOENT — which the
	// first version of this function reported as "run pnpm build first" on a tree
	// that HAD just been built. A refusal with a misleading cause is a defect
	// (`O-3`), and this one would have sent a reader to rebuild repeatedly.
	const dir = join(process.cwd(), ".next", "static", "chunks");
	let files: string[];
	try {
		files = readdirSync(dir).filter((f) => f.endsWith(".css"));
	} catch {
		throw new Error(
			`REFUSED — ${dir} does not exist. The contact sheet inlines THIS BRANCH's compiled Tailwind; without it every class is inert and every figure in the sheet is a fiction. Run \`pnpm build\` first.`,
		);
	}
	if (files.length === 0) {
		throw new Error(
			`REFUSED — no .css under ${dir}. Run \`pnpm build\` first.`,
		);
	}
	// Largest file is the app stylesheet; concatenate all of them regardless, so a
	// chunk split cannot silently drop the rules the component needs.
	const css = files.map((f) => readFileSync(join(dir, f), "utf8")).join("\n");
	// Positive control on the read: the classes THIS branch depends on must be in
	// it. Without this, an empty or wrong-chunk read reproduces the exact defect
	// this function was written to end.
	for (const needed of [
		"pointer-events-none",
		"whitespace-nowrap",
		"inset-0",
		"translate-x-full",
	]) {
		if (!css.includes(needed)) {
			throw new Error(
				`REFUSED — the compiled CSS does not contain \`${needed}\`. It is stale or from another tree; rebuild this branch.`,
			);
		}
	}
	// ⛔ THE FONT FILES ARE INLINED INTO THE APP'S OWN `@font-face` RULES, RATHER
	// THAN THOSE RULES BEING REPLACED. This is CHART-5's mechanism, reused — the
	// brief said "via the existing generator" and this session did not look for one
	// before writing its own, which cost two rediscoveries the prior generator had
	// already made (the CSS lives under `chunks/`, not `css/`; and the app's
	// `url(../media/…)` references do not resolve beside a file in `~/Downloads`).
	//
	// ⚠ REWRITING THE URLs BEATS STRIPPING THE RULES, which is what this file tried
	// first. A strip leaves one hand-declared face and silently drops the other four
	// Geist subsets, so a glyph outside latin would render in a fallback while the
	// banner still read PASSED. Rewriting keeps every subset the product ships and
	// needs no network at generation time.
	let withFonts = css;
	let inlined = 0;
	const mediaDir = join(process.cwd(), ".next", "static", "media");
	for (const f of readdirSync(mediaDir).filter((x) => x.endsWith(".woff2"))) {
		const b64 = readFileSync(join(mediaDir, f)).toString("base64");
		const before = withFonts;
		withFonts = withFonts
			.split(`../media/${f}`)
			.join(`data:font/woff2;base64,${b64}`);
		if (withFonts !== before) inlined++;
	}
	// ⛔ THE ASSERTION THAT MAKES THE SHEET SELF-CONTAINED. A surviving non-data
	// `url()` is a network fetch from a file the founder opens offline — and it
	// fails SILENTLY, as a fallback face under a green banner.
	if (/url\((?!data:)/.test(withFonts)) {
		throw new Error(
			"REFUSED — a non-data url() survived; the sheet would fetch the network for a face it claims to have inlined.",
		);
	}
	if (inlined === 0) {
		throw new Error(
			"REFUSED — no font was inlined. The CSS references no ../media/*.woff2, so this is not the app stylesheet.",
		);
	}
	console.log(
		`  inlined ${files.length} stylesheet(s), ${inlined} font file(s), ${withFonts.length} B, newest ${new Date(
			Math.max(...files.map((f) => statSync(join(dir, f)).mtimeMs)),
		).toISOString()}`,
	);
	return withFonts;
}

const APP_CSS = compiledCss();

/**
 * The transcribed pulse must be the SHIPPED pulse.
 *
 * ⛔ THE SHEET OVERRIDES THE REAL RULE, so without this it can show a ring the
 * product no longer draws — silently, under a green banner, in the artifact whose
 * whole job is to be believed. `TERMINAL_PULSE_PEAK_SCALE` is also what
 * `LABEL_GAP_PCT` sizes the label's clearance from, so a drift here would make
 * the sheet's most important measurement (dot ↔ label) describe a different ring
 * than the one on screen. Filed by `@code-reviewer` as a control the class list
 * above had and this transcription did not.
 */
function assertPulseMatches(): void {
	const peak = `scale(${TERMINAL_PULSE_PEAK_SCALE})`;
	if (!APP_CSS.includes(peak)) {
		throw new Error(
			`REFUSED — the compiled CSS does not contain \`${peak}\`. This sheet transcribes the pulse keyframes and overrides the real ones, so a drift would render a ring the product does not draw. Reconcile globals.css with TERMINAL_PULSE_PEAK_SCALE.`,
		);
	}
}
assertPulseMatches();

const START_MS = Date.parse(MARKET_CHART_WINDOW_START);
const END_MS = Date.parse(MARKET_CHART_WINDOW_END);

/** The product's REAL boxes, measured in a pinned 1440 iframe against the
 * deployed build on 2026-09-01. The sheet renders at these and re-measures them
 * in-page, so a caption can never claim a box the sheet did not produce. */
const BOX = {
	collapsed: { w: 316, h: 193.8 },
	expanded: { w: 848, h: 382.25 },
	hero: { w: 624.62, h: 418.75 },
} as const;

type Mode = keyof typeof BOX;
const MODES: Mode[] = ["collapsed", "expanded", "hero"];

/** A series whose last point sits at fraction `f` of the window, walking from
 * 50 % to `end`. Real instants on the resolved window — no invented dates. */
function series(f: number, end: number, n = 10): PricePoint[] {
	return Array.from({ length: n }, (_, i) => {
		const t = (i / (n - 1)) * f;
		return {
			at: new Date(START_MS + (END_MS - START_MS) * t).toISOString(),
			yes: (0.5 + (end - 0.5) * (i / (n - 1))).toFixed(18),
		};
	});
}

function chart(mode: Mode, pts: PricePoint[], isOpen = true): string {
	const b = BOX[mode];
	// ⛔ THE OVERLAY'S HEIGHT IS AUTO, AND THE OTHER TWO ARE PINNED, BECAUSE THAT IS
	// HOW THE PRODUCT SIZES THEM. The collapsed card takes its height from the
	// header rail and the hero from its carousel panel — both are boxes the layout
	// hands down, so pinning them here reproduces the product. The expanded overlay
	// is the one mode whose height is DECLARED, by `C-CHART-1` clause 4's
	// container/viewBox lock: it is a function of its own width. Pinning it fought
	// the lock — measured in the first sheet, the plot came out 405.30 px tall
	// inside a 382.25 px frame and spilled its axis labels and marks outside the
	// card, which reads as a rendering defect and is an artefact of the sheet.
	// ⚠ THAT THE TWO NUMBERS DIFFER IS ITSELF A REAL CONSEQUENCE OF THIS TASK, not
	// only a sheet bug: deleting the label gutter returns ~48.73 px of width to the
	// overlay's plot, and a locked aspect turns width into height. Captioned below.
	const h = mode === "expanded" ? "auto" : `${b.h}px`;
	return `<div class="frame" style="width:${b.w}px;height:${h}" data-mode="${mode}">${renderToStaticMarkup(
		<MarketPriceChart series={pts} mode={mode} isOpen={isOpen} />,
	)}</div>`;
}

function cell(caption: string, body: string, note = ""): string {
	return `<figure class="cell">${body}<figcaption>${caption}${
		note ? `<span class="note">${note}</span>` : ""
	}</figcaption></figure>`;
}

// ── Sections ────────────────────────────────────────────────────────────────

const s1 = MODES.map((m) =>
	cell(
		`<b>${m}</b> — the product's real box`,
		chart(m, series(0.62, 0.68)),
		`declared ${BOX[m].w} × ${BOX[m].h} · <span class="measured" data-measure="${m}-1"></span>`,
	),
).join("");

const ANCHORS = [
	{ f: 0.1, label: "~10 % of the window" },
	{ f: 0.5, label: "~50 % of the window" },
	{ f: 0.95, label: "~95 % of the window" },
];

const s2 = ANCHORS.map(
	(a) =>
		`<div class="row"><h3>series ends ${a.label}</h3>${MODES.map((m) =>
			cell(
				`<b>${m}</b> · ends ${a.label}`,
				chart(m, series(a.f, 0.68)),
				`dot ↔ label: <span class="measured" data-measure="gap-${a.f}-${m}" data-gap="${m}"></span>`,
			),
		).join("")}</div>`,
).join("");

const s3 = MODES.map((m) =>
	cell(
		`<b>${m}</b> — series hard against the right edge`,
		chart(m, series(1, 0.68)),
		`both labels flipped: <span class="measured" data-measure="flip-${m}" data-gap="${m}"></span>`,
	),
).join("");

const s4 = cell(
	"<b>hero</b> — with its Y scale (CHART-6, founder ruling)",
	chart("hero", series(0.62, 0.68)),
	`declared ${BOX.hero.w} × ${BOX.hero.h} · <span class="measured" data-measure="hero-4"></span> · <b>compare the overlay above: 848 × 382.25</b>`,
);

const s5 = [0.49, 0.5, 0.51]
	.map((p) =>
		MODES.map((m) =>
			cell(
				`<b>${m}</b> · YES ${(p * 100).toFixed(0)} % — the collision band`,
				chart(m, series(0.62, p)),
				`label centres: <span class="measured" data-measure="coll-${p}-${m}" data-coll="${m}"></span>`,
			),
		).join(""),
	)
	.join("");

const s6 = MODES.map((m) =>
	cell(
		`<b>${m}</b> — reduced motion`,
		chart(m, series(0.62, 0.68)),
		`dots present: <span class="measured" data-measure="rm-${m}" data-dots="1"></span>`,
	),
).join("");

/**
 * ⭐ SECTION 7 — THE ENDGAME, and it exists because `@code-reviewer` predicted a
 * collision this sheet could not otherwise show.
 *
 * Moving the labels INSIDE the plot box put them in the same rectangle as the
 * SVG date labels, which sit at `y = VIEWBOX_H − 8` along the bottom. While the
 * labels lived in a gutter beside the plot that overlap was structurally
 * impossible. It needs BOTH conditions at once — the series at the window end
 * (so the label's x reaches the `Nov 5` label's x) AND an extreme price (so
 * clause 4's clamp pushes the label's y down onto the axis strip) — and no other
 * cell in this sheet carries both. On 2026-11-05 every market has both.
 *
 * The captions below report the MEASURED overlap rather than asserting there is
 * none: this is the case the founder has to rule on, and it should arrive as a
 * rectangle in pixels.
 */
const s7 = [0.04, 0.5, 0.96]
	.map((p) =>
		MODES.map((m) =>
			cell(
				`<b>${m}</b> · YES ${(p * 100).toFixed(0)} % at the window END`,
				chart(m, series(1, p)),
				`label × date-axis: <span class="measured" data-measure="end-${p}-${m}" data-axis="1"></span>`,
			),
		).join(""),
	)
	.join("");

// ── The document ────────────────────────────────────────────────────────────

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>CHART-6 contact sheet</title>
<style>
/* ── THIS BRANCH'S COMPILED TAILWIND, verbatim ───────────────────────────── */
${APP_CSS}
/* ── the sheet's own chrome, after it so the page frame wins ─────────────── */
:root{
  /* transcribed byte-for-byte from src/app/globals.css */
  --color-ground:#181818; --color-n0:#212121; --color-n1:#2a2a2a; --color-n2:#333333;
  --color-n5:#8f8f8f; --color-ink:#fafafa;
  --graph-yes:#737373; --graph-no:#fafafa; --r:8px;
}
*{box-sizing:border-box}
body{margin:0;background:var(--color-ground);color:var(--color-ink);
     font-family:Geist,system-ui,sans-serif;font-size:13px;line-height:1.5;padding:28px 32px 80px}
h1{font-size:20px;margin:0 0 4px} h2{font-size:15px;margin:34px 0 6px;color:var(--color-n5);
   border-top:1px solid var(--color-n2);padding-top:14px}
h3{font-size:12px;margin:16px 0 6px;color:var(--color-n5);font-weight:400}
#banner{padding:10px 14px;border-radius:var(--r);margin:14px 0 6px;font-weight:700;letter-spacing:.04em}
#banner.pass{background:#1d3a1d;color:#b6e3b6} #banner.fail{background:#3a1d1d;color:#e3b6b6}
#meta{color:var(--color-n5);margin:0 0 8px}
.row{display:flex;gap:18px;flex-wrap:wrap;align-items:flex-start}
.grid{display:flex;gap:18px;flex-wrap:wrap;align-items:flex-start}
.cell{margin:0 0 14px}
.frame{background:var(--color-n0);border:1px solid var(--color-n2);border-radius:var(--r);overflow:visible}
figcaption{margin-top:6px;color:var(--color-n5);font-size:11px;max-width:640px}
.note{display:block;color:#6f6f6f}
.measured{color:var(--color-ink)}
.measured:empty::after{content:"— withheld until FONT CHECK PASSES";color:#8a6d3b}

/* ⛔ TRANSCRIBED FROM src/app/globals.css, AND SECTION 6 IS MEANINGLESS WITHOUT
   IT. ⚠ It is placed AFTER the app's own CSS so it overrides the real rule —
   which means a change to TERMINAL_PULSE_PEAK_SCALE and globals.css would leave
   this sheet quietly showing the OLD ring. assertPulseMatches() checks the
   shipped scale against this transcription before the file is written, so the two
   cannot drift silently.
   (No backticks in this comment: it lives inside a JS template literal, and one
   would end the string here. That has now happened twice in this file, which is
   why both CSS comments say so.) The first version of this sheet omitted the keyframes entirely, so NO
   pulse animated anywhere — and the "reduced motion" section, whose whole job is
   to show that the ring FREEZES while the dot REMAINS, was showing a frozen ring
   next to eleven other frozen rings. A control that cannot differ from its
   subject is not a control. */
@keyframes chart-terminal-pulse{
  0%,100%{opacity:1;transform:scale(1)}
  50%{opacity:.2;transform:scale(2.4)}
}
.chart-terminal-pulse{transform-box:fill-box;transform-origin:center;
  animation:chart-terminal-pulse 1.4s ease-in-out infinite}
/* The reduced-motion posture, applied to section 6 by class so the two states sit
   side by side in one document. animation:none leaves the ring rendered at its
   own static fill-opacity, coincident with the dot. It does NOT hide it.
   (No backticks in this comment: it lives inside a JS template literal, and one
   would end the string here rather than at the end of the document.) */
.rm .chart-terminal-pulse{animation:none!important}
</style></head><body>
<h1>CHART-6 — contact sheet</h1>
<div id="banner" class="fail">FONT CHECK PENDING</div>
<p id="meta">
  window <code>${MARKET_CHART_WINDOW_START}</code> → <code>${MARKET_CHART_WINDOW_END}</code>
  · ZUGZWANG_ENV=<code>${process.env.ZUGZWANG_ENV ?? "(unset)"}</code>
  · every chart below is <code>renderToStaticMarkup(&lt;MarketPriceChart/&gt;)</code> — the real component
</p>

<h2>1 · All three modes, complete, at the product's real boxes</h2>
<div class="grid">${s1}</div>

<h2>2 · ⭐ THE ANCHOR — one market, series ending at ~10 % / ~50 % / ~95 % of the window</h2>
<p id="meta">This is the cell that shows whether the founder's ruling landed. Before CHART-6 the two
labels sat at the far right of every one of these nine plots, whatever the line did.</p>
${s2}

<h2>3 · The flip — series hard against the right edge, both labels</h2>
<div class="grid">${s3}</div>

<h2>4 · The hero with its Y scale, captioned with its measured box</h2>
<div class="grid">${s4}</div>

<h2>5 · Collision across the band, now that the labels share an x</h2>
<div class="grid">${s5}</div>

<h2>6 · Reduced motion — the dots must still be present</h2>
<div class="grid rm">${s6}</div>

<h2>7 · ⭐ THE ENDGAME — series at the window end, price at an extreme</h2>
<p id="meta">The labels moved inside the plot at CHART-6, so they now share a box with the
SVG date labels along the bottom. This is the only combination that brings the two together —
and it is what every market looks like on 2026-11-05. <b>Overlap is measured, not asserted.</b></p>
<div class="grid">${s7}</div>

<script>
(async function () {
  // ⛔ EVERY WIDTH FIGURE IN THIS SHEET IS A TEXT ADVANCE, so nothing is reported
  // until the shipped face is confirmed. A measurement against a fallback is a
  // fiction shaped exactly like a number.
  await document.fonts.ready;
  var ok = document.fonts.check('700 10px Geist') && document.fonts.check('16px Geist');
  var b = document.getElementById('banner');
  b.className = ok ? 'pass' : 'fail';
  b.textContent = ok ? 'FONT CHECK PASSED — Geist, the face the product serves'
                     : 'FONT CHECK FAILED — figures withheld; this sheet is not measuring the shipped face';
  if (!ok) return;

  function box(el){ var r = el.getBoundingClientRect(); return r; }
  function f(n){ return (Math.round(n*100)/100).toFixed(2); }

  // Section 1 + 4: the frame's own measured box, inside this sheet.
  document.querySelectorAll('[data-measure]').forEach(function (span) {
    var fig = span.closest('figure');
    var frame = fig.querySelector('.frame');
    var plot = fig.querySelector('[data-testid="market-price-chart-plot"]');
    var key = span.getAttribute('data-measure');

    if (span.hasAttribute('data-gap')) {
      // dot ↔ label horizontal distance, both read from the RENDERED geometry.
      var out = [];
      ['yes','no'].forEach(function (side) {
        var dot = fig.querySelector('[data-testid="terminal-dot-'+side+'"]');
        var lab = fig.querySelector('[data-testid="terminal-label-'+side+'"]');
        if (!dot || !lab) return;
        var d = box(dot), l = box(lab);
        var dotX = (d.left + d.right) / 2;
        var edge = l.left >= dotX ? l.left : l.right;   // nearest edge
        var gap = Math.abs(edge - dotX);
        var flipped = l.right <= dotX + 1;
        var p = box(plot);
        var overflow = l.right > p.right + 0.5;
        out.push(side.toUpperCase()+' '+f(gap)+'px'+(flipped?' (flipped)':'')+(overflow?' ⛔ OVERFLOWS PLOT':''));
      });
      span.textContent = out.join(' · ');
      return;
    }

    if (span.hasAttribute('data-coll')) {
      var ly = fig.querySelector('[data-testid="terminal-label-yes"]');
      var ln = fig.querySelector('[data-testid="terminal-label-no"]');
      if (!ly || !ln) { span.textContent = 'n/a'; return; }
      var a = box(ly), c = box(ln);
      var sep = Math.abs((a.top+a.bottom)/2 - (c.top+c.bottom)/2);
      var overlap = !(a.bottom <= c.top + 0.5 || c.bottom <= a.top + 0.5);
      span.textContent = f(sep)+'px apart · boxes '+f(a.height)+'px tall · '+(overlap?'⛔ OVERLAP':'clear');
      return;
    }

    if (span.hasAttribute('data-axis')) {
      // ⛔ MEASURED, NOT ASSERTED. Every SVG date label against every end label:
      // the intersection rectangle, in CSS px, or the word "clear".
      var dates = [].slice.call(fig.querySelectorAll('[data-testid^="axis-x-"]'));
      var labels = ['yes','no'].map(function (s) {
        return { side: s, el: fig.querySelector('[data-testid="terminal-label-'+s+'"]') };
      });
      var hits = [];
      dates.forEach(function (dl) {
        labels.forEach(function (lb) {
          if (!lb.el) return;
          var a = dl.getBoundingClientRect(), b = lb.el.getBoundingClientRect();
          var ox = Math.min(a.right, b.right) - Math.max(a.left, b.left);
          var oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
          if (ox > 0 && oy > 0) {
            hits.push('⛔ ' + lb.side.toUpperCase() + ' × ' + dl.getAttribute('data-testid') +
                      ' overlap ' + f(ox) + '×' + f(oy) + 'px');
          }
        });
      });
      span.textContent = dates.length === 0
        ? 'no date axis on this mode'
        : (hits.length ? hits.join(' · ') : 'clear (' + dates.length + ' date labels checked)');
      return;
    }

    if (span.hasAttribute('data-dots')) {
      var n = fig.querySelectorAll('[data-testid^="terminal-dot-"]').length;
      var pulses = fig.querySelectorAll('.chart-terminal-pulse').length;
      span.textContent = n+' dots · '+pulses+' pulse rings (frozen)';
      return;
    }

    var r = box(frame), pr = plot ? box(plot) : null;
    span.textContent = 'measured in this sheet: frame '+f(r.width)+' × '+f(r.height)+
      (pr ? ' · plot '+f(pr.width)+' × '+f(pr.height) : '');
  });
})();
</script>
</body></html>`;

writeFileSync(outPath, html, "utf8");
console.log(
	`wrote ${outPath} (${Buffer.byteLength(html, "utf8")} B) · window ${MARKET_CHART_WINDOW_START} → ${MARKET_CHART_WINDOW_END}`,
);
