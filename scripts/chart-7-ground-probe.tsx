/**
 * CHART-7 — GROUND PROBE, and the BEFORE-CAPTURE generator.
 *
 *   ZUGZWANG_ENV=staging pnpm tsx scripts/chart-7-ground-probe.tsx <out.html>
 *
 * ⚠ IT WAS WRITTEN AS A THROWAWAY AND IS KEPT, WHICH IS A CORRECTION RATHER THAN
 * A CHANGE OF MIND. `chart-7-contact-sheet.tsx` REFUSES to build without
 * `.chart7-before/markup.json`, and this script is the only thing that produces
 * it — from the BASE commit's own component, which is why it cannot be folded into
 * the sheet. Deleting it would leave a generator whose refusal message names a
 * recipe nobody can run. To re-create the capture:
 *
 *   git checkout <base> -- src/components/debate/chart/
 *   ZUGZWANG_ENV=staging pnpm tsx scripts/chart-7-ground-probe.tsx /tmp/before.html
 *   git checkout HEAD -- src/components/debate/chart/
 *
 * ⚠ `git checkout HEAD --`, NOT `git checkout --`. The first form restores from
 * the commit; the second restores from the INDEX, which `git checkout <base> --`
 * has just written the base version into — so it restores the very thing you were
 * undoing. This run made that mistake and it cost a slice of work.
 *
 * Renders the component AS IT STANDS, with this branch's compiled Tailwind and
 * the shipped Geist face inlined, and measures the seven quantities §2 and the
 * two ⭐ items of the CHART-7 brief demand BEFORE any edit:
 *
 *   1 where the numeric marks sit, and how wide their column is (per mode)
 *   2 where the axis date labels come from, and their RENDERED px
 *   3 the current right-gutter width
 *   4 the current label composition and its measured box
 *   5 the collapsed gridline set
 *   6 ⭐ the widest label the chart can produce — `YES 100%` — measured BOTH in
 *     today's two-line composition and in RF-2's one-line one, because the
 *     reserve is sized from the second and only the first exists yet
 *   7 ⭐ the pulse ring's maximum extent, in CSS px, per mode
 *
 * It also writes the rendered markup + the compiled CSS to `.next/chart7-before/`
 * so the contact sheet's before/after column can show the PRE-CHANGE component
 * rather than a description of it. ⚠ The CSS is saved because Tailwind emits only
 * the classes it finds in the source it scans: after the marks move, `pl-[6px]`
 * may no longer be emitted, and a frozen before-fragment styled by the AFTER
 * stylesheet is a wrong picture that looks like a right one.
 *
 * The font/CSS mechanism is `scripts/chart-6-contact-sheet.tsx`'s, reused rather
 * than rediscovered.
 */

import {
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";

import {
	SVG_W,
	TERMINAL_PULSE_MAX_R,
	TERMINAL_PULSE_PEAK_SCALE,
	VIEWBOX_H,
} from "@/components/debate/chart/geometry";
import { MarketPriceChart } from "@/components/debate/chart/MarketPriceChart";
import {
	MARKET_CHART_WINDOW_END,
	MARKET_CHART_WINDOW_START,
} from "@/server/config/limits";
import type { PricePoint } from "@/server/discovery/price-series";

const [, , outPath] = process.argv;
if (!outPath) {
	throw new Error("usage: tsx scripts/chart-7-ground-probe.tsx <out.html>");
}

function compiledCss(): string {
	const dir = join(process.cwd(), ".next", "static", "chunks");
	const files = readdirSync(dir).filter((f) => f.endsWith(".css"));
	if (files.length === 0) throw new Error("REFUSED — run `pnpm build` first.");
	const css = files.map((f) => readFileSync(join(dir, f), "utf8")).join("\n");
	for (const needed of [
		"pointer-events-none",
		"whitespace-nowrap",
		"inset-0",
	]) {
		if (!css.includes(needed)) {
			throw new Error(
				`REFUSED — compiled CSS lacks \`${needed}\`; stale tree.`,
			);
		}
	}
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
	if (/url\((?!data:)/.test(withFonts)) {
		throw new Error("REFUSED — a non-data url() survived.");
	}
	if (inlined === 0) throw new Error("REFUSED — no font inlined.");
	console.log(`  inlined ${files.length} css, ${inlined} fonts`);
	return withFonts;
}

const APP_CSS = compiledCss();
if (!APP_CSS.includes(`scale(${TERMINAL_PULSE_PEAK_SCALE})`)) {
	throw new Error(
		"REFUSED — pulse scale drift between globals.css and geometry.",
	);
}

const START_MS = Date.parse(MARKET_CHART_WINDOW_START);
const END_MS = Date.parse(MARKET_CHART_WINDOW_END);

/** The product's REAL boxes, measured in a pinned 1440 iframe against the
 * deployed build on 2026-09-01 — carried from `chart-6-contact-sheet.tsx`. */
const BOX = {
	collapsed: { w: 316, h: 193.8 },
	expanded: { w: 848, h: 382.25 },
	hero: { w: 624.62, h: 418.75 },
} as const;
type Mode = keyof typeof BOX;
const MODES: Mode[] = ["collapsed", "expanded", "hero"];

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
	const h = mode === "expanded" ? "auto" : `${b.h}px`;
	return `<div class="frame" style="width:${b.w}px;height:${h}" data-mode="${mode}" data-probe="${mode}">${renderToStaticMarkup(
		<MarketPriceChart series={pts} mode={mode} isOpen={isOpen} />,
	)}</div>`;
}

// The three modes at a mid-window, mid-price series — the ordinary rendering.
const ORDINARY = MODES.map((m) => chart(m, series(0.62, 0.68))).join("");
// The endgame: series at the window end, price at an extreme. The CHART-6
// date-row overlap lives here and nowhere else.
const ENDGAME = MODES.map(
	(m) =>
		`<div class="endgame" data-endgame="${m}">${chart(m, series(1, 0.96))}</div>`,
).join("");

// Freeze the pre-change render for the contact sheet's before column.
// ⛔ ONCE, AND NEVER AGAIN. This script is re-run against the CHANGED tree to take
// the after-measurements, and a second write would silently replace the
// pre-change markup with the post-change markup — leaving a before/after sheet
// whose two columns are the same picture, under captions saying they differ.
// ⛔ OUTSIDE `.next`, AND THAT IS A CORRECTION RATHER THAN A PREFERENCE. It was
// `.next/chart7-before`, and `pnpm build` CLEANS `.next` — so the rebuild taken to
// measure the after-state destroyed the before-capture, and the re-run then froze
// the AFTER markup under the before name. The guard below was written for a second
// run and could not survive a wipe between them. A capture whose whole purpose is
// to outlive a rebuild must not live where the rebuild sweeps.
const beforeDir = join(process.cwd(), ".chart7-before");
mkdirSync(beforeDir, { recursive: true });
if (existsSync(join(beforeDir, "markup.json"))) {
	console.log(`  before-capture already present — NOT overwritten`);
} else {
	writeFileSync(
		join(beforeDir, "markup.json"),
		JSON.stringify(
			{
				ordinary: Object.fromEntries(
					MODES.map((m) => [m, chart(m, series(0.62, 0.68))]),
				),
				collapsedMid: chart("collapsed", series(0.62, 0.52)),
				endgame: Object.fromEntries(
					MODES.map((m) => [m, chart(m, series(1, 0.96))]),
				),
			},
			null,
			"\t",
		),
		"utf8",
	);
	writeFileSync(join(beforeDir, "app.css"), APP_CSS, "utf8");
	console.log(`  froze pre-change markup + css into ${beforeDir}`);
}

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>CHART-7 ground probe</title>
<style>
${APP_CSS}
:root{--color-ground:#181818;--color-n0:#212121;--color-n1:#2a2a2a;--color-n2:#333333;
      --color-n5:#8f8f8f;--color-ink:#fafafa;--graph-yes:#737373;--graph-no:#fafafa;--r:8px;}
*{box-sizing:border-box}
body{margin:0;background:var(--color-ground);color:var(--color-ink);
     font-family:Geist,system-ui,sans-serif;font-size:13px;padding:24px}
.frame{background:var(--color-n0);border:1px solid var(--color-n2);border-radius:var(--r);
       overflow:visible;margin:0 0 26px}
#out{white-space:pre-wrap;font-family:ui-monospace,monospace;font-size:12px;
     background:#111;padding:14px;border-radius:8px;color:#b6e3b6}
@keyframes chart-terminal-pulse{0%,100%{opacity:1;transform:scale(1)}
  50%{opacity:.2;transform:scale(${TERMINAL_PULSE_PEAK_SCALE})}}
.chart-terminal-pulse{transform-box:fill-box;transform-origin:center;
  animation:chart-terminal-pulse 1.4s ease-in-out infinite}
/* ⛔ The one-line probes reproduce the label layer's OWN type declarations
   verbatim from MarketPriceChart's className — 10px / leading-none / bold /
   tracking-[0.1em] on the name, 16px / tracking-normal / tabular-nums on the
   value. A probe that guesses the type measures a label the product never
   renders. */
.probe{position:absolute;left:-9999px;top:0;white-space:nowrap;}
</style></head><body>
<h1>CHART-7 — ground probe</h1>
<p>window <code>${MARKET_CHART_WINDOW_START}</code> → <code>${MARKET_CHART_WINDOW_END}</code>
   · ZUGZWANG_ENV=<code>${process.env.ZUGZWANG_ENV ?? "(unset)"}</code>
   · SVG_W=${SVG_W} VIEWBOX_H=${VIEWBOX_H} TERMINAL_PULSE_MAX_R=${TERMINAL_PULSE_MAX_R}</p>

<h2>ordinary</h2>${ORDINARY}
<h2>endgame — series at window end, YES 96 %</h2>${ENDGAME}

<div id="probes" class="text-[10px] leading-none font-bold tracking-[0.1em]">
  <span class="probe" id="p-oneline-widest"><span>YES</span><span class="tracking-normal tabular-nums" style="font-size:16px;margin-left:4px">100%</span></span>
  <span class="probe" id="p-oneline-widest-g0"><span>YES</span><span class="tracking-normal tabular-nums" style="font-size:16px">100%</span></span>
  <span class="probe" id="p-oneline-widest-g2"><span>YES</span><span class="tracking-normal tabular-nums" style="font-size:16px;margin-left:2px">100%</span></span>
  <span class="probe" id="p-oneline-widest-g6"><span>YES</span><span class="tracking-normal tabular-nums" style="font-size:16px;margin-left:6px">100%</span></span>
  <span class="probe" id="p-oneline-typical"><span>NO</span><span class="tracking-normal tabular-nums" style="font-size:16px;margin-left:4px">52%</span></span>
  <span class="probe" id="p-name-only-yes"><span>YES</span></span>
  <span class="probe" id="p-name-only-no"><span>NO</span></span>
  <span class="probe" id="p-twoline-widest"><span class="block">YES</span><span class="block tracking-normal tabular-nums" style="font-size:16px;margin-top:2px">100%</span></span>
  <span class="probe" id="p-marks-sizer"><span class="tabular-nums">100</span></span>
</div>

<h2>MEASURED</h2>
<pre id="out">measuring…</pre>
<script>
(async function () {
  await document.fonts.ready;
  var fontOk = document.fonts.check('700 10px Geist') && document.fonts.check('16px Geist');
  var L = [];
  function f(n){ return (Math.round(n*100)/100).toFixed(2); }
  function R(el){ return el.getBoundingClientRect(); }
  L.push('FONT CHECK ' + (fontOk ? 'PASSED — Geist' : 'FAILED — figures are fiction'));
  if (!fontOk) { document.getElementById('out').textContent = L.join('\\n'); return; }

  // ── 6 ⭐ label widths, in the shipped face ───────────────────────────────
  L.push('');
  L.push('== 6 ⭐ LABEL WIDTHS (shipped Geist) ==');
  [['p-oneline-widest','one-line YES 100% (gap 4px)'],
   ['p-oneline-widest-g0','one-line YES 100% (gap 0)'],
   ['p-oneline-widest-g2','one-line YES 100% (gap 2px)'],
   ['p-oneline-widest-g6','one-line YES 100% (gap 6px)'],
   ['p-oneline-typical','one-line NO 52% (gap 4px)'],
   ['p-name-only-yes','name only YES'],
   ['p-name-only-no','name only NO'],
   ['p-twoline-widest','TWO-line YES/100% (today)'],
   ['p-marks-sizer','marks sizer "100"']].forEach(function(p){
    var r = R(document.getElementById(p[0]));
    L.push('  ' + p[1] + ': ' + f(r.width) + ' x ' + f(r.height) + 'px');
  });

  // ── per-mode geometry ───────────────────────────────────────────────────
  ['collapsed','expanded','hero'].forEach(function(mode){
    var frame = document.querySelector('[data-probe="'+mode+'"]');
    if (!frame) return;
    var plot = frame.querySelector('[data-testid="market-price-chart-plot"]');
    var svg  = frame.querySelector('[data-testid="market-price-chart"]');
    var marks= frame.querySelector('[data-testid="chart-y-marks"]');
    var flexRow = frame.querySelector('[data-testid="market-price-chart-frame"]');
    var fr = R(frame), pr = R(plot), sr = R(svg);
    var sx = sr.width / ${SVG_W}, sy = sr.height / ${VIEWBOX_H};
    L.push('');
    L.push('== ' + mode.toUpperCase() + ' ==');
    L.push('  frame ' + f(fr.width)+' x '+f(fr.height) + ' · plot ' + f(pr.width)+' x '+f(pr.height) +
           ' · svg ' + f(sr.width)+' x '+f(sr.height));
    L.push('  scaleX ' + sx.toFixed(5) + ' · scaleY ' + sy.toFixed(5) +
           ' · anisotropy ' + (sx/sy).toFixed(4));
    // 1 + 3 — the marks column: which side, and how wide
    if (marks) {
      var mr = R(marks);
      var side = mr.left >= pr.right - 0.5 ? 'RIGHT of the plot'
               : (mr.right <= pr.left + 0.5 ? 'LEFT of the plot' : 'OVERLAPPING the plot');
      var cs = getComputedStyle(marks);
      L.push('  Y MARKS: ' + side + ' · column ' + f(mr.width) + 'px wide (pl ' + cs.paddingLeft +
             ', pr ' + cs.paddingRight + ') · font ' + cs.fontSize + ' · align ' + cs.textAlign);
      var ns = frame.querySelectorAll('[data-testid^="y-mark-"]');
      var pcts = []; ns.forEach(function(n){ pcts.push(n.getAttribute('data-pct')); });
      L.push('  marks rendered: [' + pcts.join(', ') + '] (' + ns.length + ')');
      // mark ↔ gridline alignment, rendered on both sides
      var worst = 0, worstAt = '';
      ns.forEach(function(n){
        var pct = n.getAttribute('data-pct');
        var line = frame.querySelector('[data-testid="chart-gridlines"] line[data-pct="'+pct+'"]');
        if (!line) return;
        var a = R(n), b = R(line);
        var d = Math.abs((a.top+a.bottom)/2 - (b.top+b.bottom)/2);
        if (d > worst) { worst = d; worstAt = pct; }
      });
      L.push('  mark<->gridline worst delta: ' + f(worst) + 'px (at ' + worstAt + '%)');
    } else {
      L.push('  Y MARKS: none on this mode');
      L.push('  RIGHT GUTTER: none — the plot is the last flex child (' +
             f(fr.width - pr.width) + 'px of frame is border/padding)');
    }
    // 5 — the gridline set
    var gl = frame.querySelectorAll('[data-testid="chart-gridlines"] line');
    var gp = []; gl.forEach(function(g){ gp.push(g.getAttribute('data-pct')); });
    L.push('  gridlines: [' + gp.join(', ') + '] (' + gl.length + ')');
    // 2 — the date labels: testids, text, rendered box, declared size
    var dates = frame.querySelectorAll('[data-testid^="axis-x-"]');
    if (dates.length === 0) { L.push('  DATE LABELS: none on this mode'); }
    dates.forEach(function(d){
      var r = R(d), cs = getComputedStyle(d);
      L.push('  DATE ' + d.getAttribute('data-testid') + ' "' + d.textContent +
             '" declared ' + cs.fontSize + ' · RENDERED bbox ' + f(r.width) + ' x ' + f(r.height) +
             'px · declared x scaleY = ' + f(parseFloat(cs.fontSize) * sy) + 'px');
    });
    // 4 — the label composition
    ['yes','no'].forEach(function(side){
      var lab = frame.querySelector('[data-testid="terminal-label-'+side+'"]');
      if (!lab) return;
      var r = R(lab);
      var val = lab.querySelector('[data-testid="terminal-value-'+side+'"]');
      var kids = lab.children.length;
      L.push('  LABEL ' + side + ': box ' + f(r.width) + ' x ' + f(r.height) +
             'px · ' + kids + ' child span(s) · value line ' + (val ? 'YES ('+val.textContent+')' : 'absent') +
             ' · text "' + lab.textContent.replace(/\\s+/g,' ') + '"');
    });
    // 7 ⭐ pulse ring extent, rendered
    L.push('  ⭐ PULSE RING max extent: ' + f(${TERMINAL_PULSE_MAX_R} * sx) + 'px horizontally (' +
           f(${TERMINAL_PULSE_MAX_R} * sy) + 'px vertically)');
    // dot -> label gap and overflow
    var dot = frame.querySelector('[data-testid="terminal-dot-yes"]');
    var lab = frame.querySelector('[data-testid="terminal-label-yes"]');
    if (dot && lab) {
      var dr = R(dot), lr = R(lab);
      var dotX = (dr.left + dr.right)/2;
      L.push('  dot->label(YES) nearest-edge gap ' + f(Math.abs((lr.left >= dotX ? lr.left : lr.right) - dotX)) +
             'px · label right ' + f(lr.right - pr.right) + 'px past plot edge');
    }
  });

  // ── endgame: the CHART-6 date-row overlap, re-measured ──────────────────
  L.push('');
  L.push('== ENDGAME (series at window end, YES 96 %) — label x date-row ==');
  ['collapsed','expanded','hero'].forEach(function(mode){
    var wrap = document.querySelector('[data-endgame="'+mode+'"]');
    if (!wrap) return;
    var dates = [].slice.call(wrap.querySelectorAll('[data-testid^="axis-x-"]'));
    var hits = [];
    ['yes','no'].forEach(function(s){
      var lb = wrap.querySelector('[data-testid="terminal-label-'+s+'"]');
      if (!lb) return;
      dates.forEach(function(dl){
        var a = R(dl), b = R(lb);
        var ox = Math.min(a.right,b.right) - Math.max(a.left,b.left);
        var oy = Math.min(a.bottom,b.bottom) - Math.max(a.top,b.top);
        if (ox > 0 && oy > 0) hits.push(s.toUpperCase()+' x '+dl.getAttribute('data-testid')+' = '+f(ox)+'x'+f(oy)+'px');
      });
    });
    L.push('  ' + mode + ': ' + (dates.length === 0 ? 'no date axis' :
      (hits.length ? '⛔ ' + hits.join(' · ') : 'clear (' + dates.length + ' date labels checked)')));
  });

  document.getElementById('out').textContent = L.join('\\n');
})();
</script></body></html>`;

writeFileSync(outPath, html, "utf8");
console.log(`wrote ${outPath} (${Buffer.byteLength(html, "utf8")} B)`);
