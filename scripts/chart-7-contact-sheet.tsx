/**
 * CHART-7 — emit the standalone contact sheet.
 *
 *   pnpm build && \
 *   ZUGZWANG_ENV=staging pnpm tsx scripts/chart-7-contact-sheet.tsx \
 *     ~/Downloads/zz_CHART-7_contact-sheet_<UTC>.html
 *
 * ⚠ `ZUGZWANG_ENV=staging` IS LOAD-BEARING for the sheet's own fixtures, and
 * section 4 needs BOTH windows in one document — so this script SPAWNS ITSELF
 * once with the opposite env and embeds what that run renders (`--fragments`).
 * The alternative, passing a window into the component, would mean giving the
 * product a prop that exists only for this sheet.
 *
 * ⛔ IT RENDERS THE REAL COMPONENT. Every chart below is
 * `renderToStaticMarkup(<MarketPriceChart …/>)` at the product's own measured
 * boxes, with this branch's compiled Tailwind and the shipped Geist face inlined.
 * If the sheet and the shipped chart ever disagree about the drawing, this script
 * is broken — not merely stale.
 *
 * ⛔ THE BEFORE COLUMN IS THE PRE-CHANGE COMPONENT'S OWN MARKUP, frozen by
 * `chart-7-ground-probe.tsx` from the base commit and read out of
 * `.chart7-before/`. A before/after sheet whose "before" is a description rather
 * than a render is a sheet nobody can check.
 * ⚠ IT IS STYLED BY THE AFTER STYLESHEET, WHICH IS SAFE ONLY BECAUSE IT WAS
 * MEASURED: Tailwind emits only the classes it finds, and `pl-[6px]` — which the
 * before markup needs and the after source no longer uses on this component — is
 * still emitted because other components use it. **Asserted below, not assumed.**
 *
 * ⛔ THE FONT IS THE ONE THE PRODUCT SERVES, INLINED, and every width figure is
 * withheld until `document.fonts.check` confirms Geist. A text advance measured
 * against a fallback face is a fiction shaped exactly like a number.
 *
 * ⚠ HEX LITERALS ARE PERMITTED IN THE GENERATED FILE ONLY — it is not in the view
 * layer and is not scanned by the raw-hex guard. The values are transcribed
 * byte-for-byte from `src/app/globals.css`, which this task never edits.
 */

import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";

import { TERMINAL_PULSE_PEAK_SCALE } from "@/components/debate/chart/geometry";
import { MarketPriceChart } from "@/components/debate/chart/MarketPriceChart";
import {
	MARKET_CHART_AXIS_ANCHORS,
	MARKET_CHART_WINDOW_END,
	MARKET_CHART_WINDOW_START,
} from "@/server/config/limits";
import type { PricePoint } from "@/server/discovery/price-series";

const [, , outPath, mode] = process.argv;
const FRAGMENTS_ONLY = mode === "--fragments";
if (!outPath && !FRAGMENTS_ONLY) {
	throw new Error("usage: tsx scripts/chart-7-contact-sheet.tsx <out.html>");
}

const START_MS = Date.parse(MARKET_CHART_WINDOW_START);
const END_MS = Date.parse(MARKET_CHART_WINDOW_END);

/** The product's REAL boxes, measured in a pinned 1440 iframe against the
 * deployed build on 2026-09-01 — carried from `chart-6-contact-sheet.tsx` so the
 * two sheets are directly comparable. */
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
	// ⛔ THE OVERLAY'S HEIGHT IS AUTO AND THE OTHER TWO ARE PINNED, because that is
	// how the product sizes them: the card takes its height from the header rail and
	// the hero from its carousel panel, while the overlay's is DECLARED by
	// `C-CHART-1` clause 4's container/viewBox lock and is a function of its width.
	// Pinning it fights the lock.
	const h = mode === "expanded" ? "auto" : `${b.h}px`;
	return `<div class="frame" style="width:${b.w}px;height:${h}" data-mode="${mode}">${renderToStaticMarkup(
		<MarketPriceChart series={pts} mode={mode} isOpen={isOpen} />,
	)}</div>`;
}

// ── Section 4 needs the OTHER environment's window ──────────────────────────
/** The anchor section's three charts, rendered under whichever window this
 * process resolved. */
function anchorFragments(): Record<string, string> {
	return Object.fromEntries(
		MODES.map((m) => [m, chart(m, series(0.62, 0.68))]),
	);
}

if (FRAGMENTS_ONLY) {
	// The child arm: print, do not write a sheet.
	process.stdout.write(
		JSON.stringify({
			window: {
				start: MARKET_CHART_WINDOW_START,
				end: MARKET_CHART_WINDOW_END,
			},
			charts: anchorFragments(),
		}),
	);
	process.exit(0);
}

/**
 * The opposite environment's fragments, rendered by this same script in a child
 * process.
 *
 * ⛔ A CHILD PROCESS AND NOT A SECOND IMPORT, because the window is resolved ONCE
 * at module load from `ZUGZWANG_ENV` (`limits.ts` — SPEC.1 §16.1's "resolved at
 * the constants layer, never branched on inside the derivation or the
 * component"). There is no way to obtain the other window inside one process
 * without defeating exactly the rule that makes the constant trustworthy.
 * ⚠ If the child fails, the section says so rather than silently showing one
 * window twice — which is the failure mode that would make section 4 a lie.
 */
function otherEnvFragments(): {
	env: string;
	window: { start: string; end: string };
	charts: Record<string, string>;
} | null {
	const here = process.env.ZUGZWANG_ENV ?? "prod";
	const other = here === "staging" || here === "preview" ? "prod" : "staging";
	try {
		const raw = execFileSync(
			process.execPath,
			[
				join(process.cwd(), "node_modules", "tsx", "dist", "cli.mjs"),
				join(process.cwd(), "scripts", "chart-7-contact-sheet.tsx"),
				"-",
				"--fragments",
			],
			{
				cwd: process.cwd(),
				env: { ...process.env, ZUGZWANG_ENV: other },
				encoding: "utf8",
				maxBuffer: 64 * 1024 * 1024,
			},
		);
		return { env: other, ...JSON.parse(raw) };
	} catch (e) {
		console.error(`  ⚠ could not render the ${other} window: ${String(e)}`);
		return null;
	}
}

// ── This branch's compiled CSS + the shipped face ───────────────────────────
function compiledCss(): string {
	const dir = join(process.cwd(), ".next", "static", "chunks");
	let files: string[];
	try {
		files = readdirSync(dir).filter((f) => f.endsWith(".css"));
	} catch {
		throw new Error(
			`REFUSED — ${dir} does not exist. This sheet inlines THIS BRANCH's compiled Tailwind; without it every class is inert and every figure is a fiction. Run \`pnpm build\` first.`,
		);
	}
	if (files.length === 0) {
		throw new Error(
			`REFUSED — no .css under ${dir}. Run \`pnpm build\` first.`,
		);
	}
	const css = files.map((f) => readFileSync(join(dir, f), "utf8")).join("\n");
	// Positive control: the classes THIS branch depends on, AND the ones the frozen
	// BEFORE markup depends on. The second list is the one that matters — those
	// classes are no longer used by this component, so nothing but another
	// component's use keeps them in the stylesheet, and if that use ever goes the
	// before column silently renders wrong.
	for (const needed of [
		"pointer-events-none",
		"whitespace-nowrap",
		"inset-0",
		"translate-x-full",
		"pr-\\[6px\\]",
		"shrink-0",
	]) {
		if (!css.includes(needed)) {
			throw new Error(
				`REFUSED — compiled CSS lacks \`${needed}\`; stale tree.`,
			);
		}
	}
	for (const beforeOnly of ["pl-\\[6px\\]"]) {
		if (!css.includes(beforeOnly)) {
			throw new Error(
				`REFUSED — the compiled CSS no longer carries \`${beforeOnly}\`, which the frozen BEFORE markup needs. The before column would render with an inert class — a wrong picture that looks like a right one. Re-render the before capture against the base commit's own build.`,
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
		throw new Error(
			"REFUSED — a non-data url() survived; the sheet would fetch the network for a face it claims to have inlined.",
		);
	}
	if (inlined === 0) {
		throw new Error("REFUSED — no font was inlined.");
	}
	console.log(
		`  inlined ${files.length} stylesheet(s), ${inlined} font file(s)`,
	);
	return withFonts;
}

const APP_CSS = compiledCss();
if (!APP_CSS.includes(`scale(${TERMINAL_PULSE_PEAK_SCALE})`)) {
	throw new Error(
		`REFUSED — the compiled CSS does not contain \`scale(${TERMINAL_PULSE_PEAK_SCALE})\`. This sheet transcribes the pulse keyframes and overrides the real ones, so a drift would render a ring the product does not draw.`,
	);
}

/** The pre-change component's own markup, frozen from the base commit. */
const BEFORE: {
	ordinary: Record<string, string>;
	collapsedMid: string;
	endgame: Record<string, string>;
} = (() => {
	const p = join(process.cwd(), ".chart7-before", "markup.json");
	if (!existsSync(p)) {
		throw new Error(
			`REFUSED — ${p} is missing. Section 2 shows the PRE-CHANGE component's own render; without it the before column would be a description. Re-create it: \`git checkout <base> -- src/components/debate/chart/ && ZUGZWANG_ENV=staging pnpm tsx scripts/chart-7-ground-probe.tsx /tmp/before.html && git checkout HEAD -- src/components/debate/chart/\`.`,
		);
	}
	const parsed = JSON.parse(readFileSync(p, "utf8"));
	// ⛔ A CONTENT CONTROL, NOT A PRESENCE ONE. A before-capture accidentally taken
	// from the CHANGED tree parses fine and looks fine; what tells them apart is
	// that the before markup carries the marks column's OLD padding and the stacked
	// label, and carries none of this task's new testids.
	const blob = JSON.stringify(parsed);
	if (!blob.includes("pl-[6px]") || blob.includes("chart-label-reserve")) {
		throw new Error(
			"REFUSED — .chart7-before/markup.json is not a pre-change capture (it lacks `pl-[6px]` or carries `chart-label-reserve`). It was almost certainly re-frozen from the changed tree.",
		);
	}
	return parsed;
})();

function cell(caption: string, body: string, note = ""): string {
	return `<figure class="cell">${body}<figcaption>${caption}${
		note ? `<span class="note">${note}</span>` : ""
	}</figcaption></figure>`;
}

// ── 1 · all three modes, complete ──────────────────────────────────────────
const s1 = MODES.map((m) =>
	cell(
		`<b>${m}</b> — the product's real box`,
		chart(m, series(0.62, 0.68)),
		`declared ${BOX[m].w} × ${BOX[m].h} · <span class="measured" data-measure="m1-${m}"></span>`,
	),
).join("");

// ── 2 · ⭐ before / after ───────────────────────────────────────────────────
const s2 = MODES.map(
	(m) =>
		`<div class="row"><h3>${m}</h3>${cell(
			"<b>BEFORE</b> — marks right, label stacked, card without 0, dates in the viewBox",
			BEFORE.ordinary[m],
			`<span class="measured" data-measure="b2-${m}" data-cmp="before"></span>`,
		)}${cell(
			"<b>AFTER</b> — marks left, label on one line, card with 0, dates in HTML",
			chart(m, series(0.62, 0.68)),
			`<span class="measured" data-measure="a2-${m}" data-cmp="after"></span>`,
		)}</div>`,
).join("");

// ── 3 · the right reserve ──────────────────────────────────────────────────
const s3 = [0.5, 0.92, 0.99]
	.map(
		(p) =>
			`<div class="row"><h3>series hard against the axis end · YES ${(p * 100).toFixed(0)} %</h3>${MODES.map(
				(m) =>
					cell(
						`<b>${m}</b> · YES ${(p * 100).toFixed(0)} % at the window END`,
						chart(m, series(1, p)),
						`<span class="measured" data-measure="r3-${p}-${m}" data-reserve="1"></span>`,
					),
			).join("")}</div>`,
	)
	.join("");

// ── 4 · the anchors, both windows ──────────────────────────────────────────
const other = otherEnvFragments();
const s4 = `<div class="row"><h3>this run — <code>${
	process.env.ZUGZWANG_ENV ?? "(unset)"
}</code> · window ${MARKET_CHART_WINDOW_START.slice(0, 10)} → ${MARKET_CHART_WINDOW_END.slice(
	0,
	10,
)}</h3>${MODES.map((m) =>
	cell(
		`<b>${m}</b>`,
		chart(m, series(0.62, 0.68)),
		`<span class="measured" data-measure="a4-${m}" data-anchors="1"></span>`,
	),
).join("")}</div>${
	other === null
		? `<p class="warn">⚠ the other environment's window could not be rendered — this section shows ONE window only.</p>`
		: `<div class="row"><h3>the other environment — <code>${other.env}</code> · window ${other.window.start.slice(
				0,
				10,
			)} → ${other.window.end.slice(0, 10)}</h3>${MODES.map((m) =>
				cell(
					`<b>${m}</b>`,
					other.charts[m],
					`<span class="measured" data-measure="o4-${m}" data-anchors="1"></span>`,
				),
			).join("")}</div>`
}`;

// ── 5 · collision across the re-measured band ──────────────────────────────
/** ⛔ THE BAND IS MEASURED IN THE SHEET, NOT CARRIED FROM THE BRIEF. The brief
 * quotes ~46.4–53.6 % before and ~48.2–51.8 % after and says in terms not to carry
 * them forward as fact. The sweep below renders every tenth of a point across
 * 47–53 % and the script reports where the CSS floor actually binds. */
const BAND = Array.from({ length: 61 }, (_, i) => 0.47 + i / 1000);
const s5 = `<div class="sweep" id="band-sweep">${BAND.map((p) =>
	MODES.map(
		(m) =>
			`<div class="tiny" data-band="${m}" data-p="${p.toFixed(3)}">${chart(
				m,
				series(0.62, p),
			)}</div>`,
	).join(""),
).join("")}</div>`;

// ── 6 · reduced motion ─────────────────────────────────────────────────────
const s6 = MODES.map((m) =>
	cell(
		`<b>${m}</b> — reduced motion`,
		chart(m, series(0.62, 0.68)),
		`dots present: <span class="measured" data-measure="rm-${m}" data-dots="1"></span>`,
	),
).join("");

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>CHART-7 contact sheet</title>
<style>
${APP_CSS}
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
.warn{color:#e3b6b6}
.row{display:flex;gap:18px;flex-wrap:wrap;align-items:flex-start}
.grid{display:flex;gap:18px;flex-wrap:wrap;align-items:flex-start}
.cell{margin:0 0 14px}
.frame{background:var(--color-n0);border:1px solid var(--color-n2);border-radius:var(--r);overflow:visible}
figcaption{margin-top:6px;color:var(--color-n5);font-size:11px;max-width:660px}
.note{display:block;color:#6f6f6f}
.measured{color:var(--color-ink)}
.measured:empty::after{content:"— withheld until FONT CHECK PASSES";color:#8a6d3b}
/* The band sweep renders off-screen: it exists to be MEASURED, and 183 charts in
   the page would bury every other section. Its verdict is printed instead. */
.sweep{position:absolute;left:-99999px;top:0;width:4000px}
#band-out{white-space:pre-wrap;font-family:ui-monospace,monospace;font-size:12px;
     background:#111;padding:14px;border-radius:8px;color:#b6e3b6}

/* ⛔ TRANSCRIBED FROM src/app/globals.css, AND SECTION 6 IS MEANINGLESS WITHOUT
   IT. It is placed AFTER the app's own CSS so it overrides the real rule, which
   is why the shipped scale is asserted against this transcription before the file
   is written. (No backticks in this comment: it lives inside a JS template
   literal, and one would end the string here.) */
@keyframes chart-terminal-pulse{
  0%,100%{opacity:1;transform:scale(1)}
  50%{opacity:.2;transform:scale(${TERMINAL_PULSE_PEAK_SCALE})}
}
.chart-terminal-pulse{transform-box:fill-box;transform-origin:center;
  animation:chart-terminal-pulse 1.4s ease-in-out infinite}
.rm .chart-terminal-pulse{animation:none!important}
</style></head><body>
<h1>CHART-7 — contact sheet</h1>
<div id="banner" class="fail">FONT CHECK PENDING</div>
<p id="meta">
  window <code>${MARKET_CHART_WINDOW_START}</code> → <code>${MARKET_CHART_WINDOW_END}</code>
  · ZUGZWANG_ENV=<code>${process.env.ZUGZWANG_ENV ?? "(unset)"}</code>
  · anchors <code>${MARKET_CHART_AXIS_ANCHORS.join(" · ")}</code>
  · every chart is <code>renderToStaticMarkup(&lt;MarketPriceChart/&gt;)</code> — the real component
</p>

<h2>1 · All three modes, complete, at the product's real boxes</h2>
<div class="grid">${s1}</div>

<h2>2 · ⭐ BEFORE / AFTER — the cell that shows whether the five refinements landed</h2>
<p id="meta">The BEFORE column is the pre-change component's own markup, frozen from the base
commit — not a description. Marks right → left · label stacked → one line · the card gains
<code>0</code> and a marks column · the dates leave the stretched viewBox for HTML.</p>
${s2}

<h2>3 · The right reserve — a series ending hard at the axis end</h2>
<p id="meta">At 50 %, 92 % and 99 %. The label must clear the plot's right edge, stay inside
the frame, and not touch the date row. <b>Overlap is measured, not asserted.</b></p>
${s3}

<h2>4 · The anchors — both environments' windows, side by side</h2>
<p id="meta">The same three calendar instants on two different windows. On production they
coincide with the axis ends; on staging they fall inside the plot, because its fixtures predate
the experiment. <b>That is the ruling working, not a defect.</b></p>
${s4}

<h2>5 · Collision across the RE-MEASURED band</h2>
<p id="meta">Swept at every tenth of a point from 47 % to 53 %, on all three modes. The brief's
figures are deliberately not carried forward; what follows is what this sheet measures.</p>
<pre id="band-out">measuring…</pre>
${s5}

<h2>6 · Reduced motion — the dots must still be present</h2>
<div class="grid rm">${s6}</div>

<script>
(async function () {
  await document.fonts.ready;
  var ok = document.fonts.check('700 10px Geist') && document.fonts.check('16px Geist')
        && document.fonts.check('12px Geist');
  var b = document.getElementById('banner');
  b.className = ok ? 'pass' : 'fail';
  b.textContent = ok ? 'FONT CHECK PASSED — Geist, the face the product serves'
                     : 'FONT CHECK FAILED — figures withheld; this sheet is not measuring the shipped face';
  if (!ok) return;

  function R(el){ return el.getBoundingClientRect(); }
  function f(n){ return (Math.round(n*100)/100).toFixed(2); }

  document.querySelectorAll('[data-measure]').forEach(function (span) {
    var fig = span.closest('figure');
    var frame = fig.querySelector('.frame');
    var plot = fig.querySelector('[data-testid="market-price-chart-plot"]');
    var marks = fig.querySelector('[data-testid="chart-y-marks"]');
    var reserve = fig.querySelector('[data-testid="chart-label-reserve"]');
    var fr = R(frame), pr = plot ? R(plot) : null;

    if (span.hasAttribute('data-dots')) {
      span.textContent = fig.querySelectorAll('[data-testid^="terminal-dot-"]').length
        + ' dots · ' + fig.querySelectorAll('.chart-terminal-pulse').length + ' pulse rings (frozen)';
      return;
    }

    if (span.hasAttribute('data-anchors')) {
      var ds = [].slice.call(fig.querySelectorAll('[data-testid^="axis-x-anchor-"]'));
      var ticks = fig.querySelectorAll('[data-testid^="axis-x-tick-"]').length;
      span.textContent = ds.length === 0 ? 'no date axis'
        : ds.map(function (d) {
            var r = R(d);
            return d.textContent + ' @ ' + f(((r.left + r.right) / 2 - pr.left) / pr.width * 100) + '%';
          }).join(' · ') + '  ·  ' + ticks + ' interior tick(s)';
      return;
    }

    if (span.hasAttribute('data-reserve')) {
      var out = [];
      ['yes','no'].forEach(function (side) {
        var lab = fig.querySelector('[data-testid="terminal-label-'+side+'"]');
        var dot = fig.querySelector('[data-testid="terminal-dot-'+side+'"]');
        if (!lab || !dot) return;
        var l = R(lab), d = R(dot);
        var flipped = l.right <= (d.left + d.right) / 2 + 1;
        var overFrame = l.right > fr.right + 0.5;
        out.push(side.toUpperCase() + ' ' + f(l.right - pr.right) + 'px into the reserve'
          + (flipped ? ' (flipped)' : '') + (overFrame ? ' ⛔ LEAVES THE FRAME' : ''));
      });
      // …and against every date label.
      var hits = [];
      [].slice.call(fig.querySelectorAll('[data-testid^="axis-x-anchor-"]')).forEach(function (dl) {
        ['yes','no'].forEach(function (side) {
          var lb = fig.querySelector('[data-testid="terminal-label-'+side+'"]');
          if (!lb) return;
          var a = R(dl), c = R(lb);
          var ox = Math.min(a.right, c.right) - Math.max(a.left, c.left);
          var oy = Math.min(a.bottom, c.bottom) - Math.max(a.top, c.top);
          if (ox > 0 && oy > 0) hits.push('⛔ ' + side.toUpperCase() + ' × ' + dl.textContent + ' ' + f(ox) + '×' + f(oy) + 'px');
        });
      });
      span.textContent = out.join(' · ') + '  ·  date row: ' + (hits.length ? hits.join(' · ') : 'clear');
      return;
    }

    var bits = 'frame ' + f(fr.width) + ' × ' + f(fr.height)
      + (pr ? ' · plot ' + f(pr.width) + ' × ' + f(pr.height) : '')
      + (marks ? ' · marks ' + f(R(marks).width) + 'px ' + (R(marks).right <= pr.left + 0.5 ? 'LEFT' : 'RIGHT') : ' · no marks')
      + (reserve ? ' · reserve ' + f(R(reserve).width) + 'px' : ' · no reserve');
    // The date row's rendered type, which is RF-3's whole subject.
    var d0 = fig.querySelector('[data-testid^="axis-x-anchor-"]');
    if (d0) bits += ' · dates ' + f(R(d0).height) + 'px tall';
    // ⭐ mark ↔ gridline, rendered on BOTH sides — the RF-1 claim, measured where
    // layout exists. Interior marks must land within 1px; the two boundary marks
    // sit at their clamp by design and are reported separately.
    if (marks) {
      var worstIn = 0, worstAt = '', ends = [];
      fig.querySelectorAll('[data-testid^="y-mark-"]').forEach(function (n) {
        var pct = n.getAttribute('data-pct');
        var line = fig.querySelector('[data-testid="chart-gridlines"] line[data-pct="'+pct+'"]');
        if (!line) return;
        var a = R(n), c = R(line);
        var dd = Math.abs((a.top+a.bottom)/2 - (c.top+c.bottom)/2);
        if (pct === '0' || pct === '100') { ends.push(pct + '%→' + f(dd) + 'px'); }
        else if (dd > worstIn) { worstIn = dd; worstAt = pct; }
      });
      bits += ' · ⭐ interior mark↔gridline worst ' + f(worstIn) + 'px (at ' + worstAt + '%)'
            + ' · boundary ' + ends.join(', ') + ' (the clamp)';
    }
    span.textContent = bits;
  });

  // ── section 5: where does the CSS floor actually bind? ────────────────────
  var lines = [];
  ['collapsed','expanded','hero'].forEach(function (mode) {
    var bound = [];
    var seps = {};
    [].slice.call(document.querySelectorAll('[data-band="'+mode+'"]')).forEach(function (w) {
      var p = Number(w.getAttribute('data-p'));
      var a = w.querySelector('[data-testid="terminal-label-yes"]');
      var c = w.querySelector('[data-testid="terminal-label-no"]');
      if (!a || !c) return;
      var ra = R(a), rc = R(c);
      var sep = Math.abs((ra.top+ra.bottom)/2 - (rc.top+rc.bottom)/2);
      var overlap = !(ra.bottom <= rc.top + 0.5 || rc.bottom <= ra.top + 0.5);
      seps[p] = sep;
      // The floor BINDS when the separation is exactly one box — i.e. it has
      // stopped tracking the price and gone flat.
      if (Math.abs(sep - ra.height) < 0.75) bound.push(p);
      if (overlap) bound.push('OVERLAP@'+p);
    });
    var nums = bound.filter(function (x) { return typeof x === 'number'; });
    var bad = bound.filter(function (x) { return typeof x !== 'number'; });
    lines.push(mode + ': floor binds ' +
      (nums.length ? (Math.min.apply(null, nums)*100).toFixed(1) + ' % – ' + (Math.max.apply(null, nums)*100).toFixed(1) + ' %'
                   : 'nowhere in 47–53 %') +
      ' · box ' + f(R(document.querySelector('[data-band="'+mode+'"] [data-testid="terminal-label-yes"]')).height) + 'px' +
      ' · separation at 50 % = ' + f(seps[0.5]) + 'px' +
      (bad.length ? '  ⛔ ' + bad.join(' ') : '  · no overlap anywhere in the band'));
  });
  document.getElementById('band-out').textContent = lines.join('\\n');
})();
</script>
</body></html>`;

writeFileSync(outPath, html, "utf8");
console.log(
	`wrote ${outPath} (${Buffer.byteLength(html, "utf8")} B) · window ${MARKET_CHART_WINDOW_START} → ${MARKET_CHART_WINDOW_END}`,
);
