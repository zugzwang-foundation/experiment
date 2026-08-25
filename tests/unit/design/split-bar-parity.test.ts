import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * RPLY-1 · R5 · G7 — THE TWO SPLIT BARS AGREE, AND THE CARD DID NOT MOVE.
 *
 * ⚠⚠ THEY ARE NOT ONE COMPONENT, WHICH IS THE WHOLE PROBLEM THIS PINS.
 * `AggregateFooter` (the market-view card) and `composer/ReplySplitBar.tsx` (the
 * focused post) are separate files with separate file-private `TriggerPill`s.
 * The card's geometry was corrected across CS6 (the track's alignment box), CS10
 * §6a (6px → 14px, matched to `PriceBar`'s `detail`) and CS11 §2 (the radius
 * travelling with the thickness). The focused post's copy received none of it —
 * not by oversight, but because that file was allow-list-EXCLUDED for writing at
 * the time, which its own guard records. RPLY-1 lifts the exclusion and PORTS
 * the geometry.
 *
 * ⛔⛔ UNIFYING THEM IS DELIBERATELY NOT DONE. It is docketed in-source on
 * `AggregateFooter`, and it is a refactor across TWO surfaces — one of which
 * (the market card) this task does not touch and nobody is reviewing tonight.
 * So the two files stay two files, and this guard is what stops them drifting
 * apart again in the meantime.
 *
 * ⛔ HALF OF THIS FILE EXISTS TO PROVE A NEGATIVE: that porting INTO the reply
 * bar did not move the CARD. A port that "fixed" both would change a surface the
 * founder never asked about, and the diff would look intentional.
 *
 * ⚠ SOURCE SCAN, and the reason is the usual one: jsdom performs no layout, so
 * the alignment these declarations produce cannot be observed in a render test.
 * The browser measurement is in the run log (track centre −11.99px against the
 * pill centres before, −0.6px after). What is pinned here is the set of
 * declarations that produce it. ⛔ FENCE BY SYMBOL, NEVER BY LINE (O-8).
 */

const ROOT = process.cwd();
const CARD = "src/components/debate/AggregateFooter.tsx";
const REPLY = "src/components/debate/composer/ReplySplitBar.tsx";
const card = readFileSync(join(ROOT, CARD), "utf8");
const reply = readFileSync(join(ROOT, REPLY), "utf8");

/** The class string of the element WRAPPING a bar's track, in either file. */
function trackWrapper(source: string, testid: string | null): string[] {
	const at =
		testid === null
			? source.indexOf("h-[14px] w-full overflow-hidden")
			: source.indexOf(`data-testid="${testid}"`);
	if (at === -1) {
		throw new Error("no track found — if a bar was restructured, re-derive");
	}
	const ownTag = source.lastIndexOf("<span", at);
	const wrapperTag = source.lastIndexOf("<span", ownTag - 1);
	const cls = /className="([^"]*)"/.exec(source.slice(wrapperTag, ownTag))?.[1];
	return (cls ?? "").split(/\s+/).filter(Boolean);
}

describe("R5 — the focused post's bar carries the card's geometry", () => {
	it("split-bar-parity::the-reply-track-is-14px-with-the-card-radius-and-clip", () => {
		// ⛔ THE THREE THAT MOVED, asserted on the reply bar. Before: `h-1.5`
		// (6px) and `rounded-(--r-dot)` (3px) — a hairline with a square corner
		// beside a market bar that is a 14px pill.
		expect(reply).toContain("h-[14px]");
		expect(reply).toContain("rounded-[var(--r)]");
		expect(reply).toContain("overflow-hidden");
		// …and the superseded pair pinned GONE, so a revert reddens here rather
		// than passing a looser pattern.
		expect(reply).not.toContain("h-1.5");
		expect(reply).not.toContain("rounded-(--r-dot)");
	});

	it("split-bar-parity::the-reply-track-sits-in-the-same-pill-height-box", () => {
		const w = trackWrapper(reply, null);
		// `h-6` is the pill's own box; `items-center` centres the track in it;
		// `flex` is what makes `items-center` mean anything; `w-full` is what stops
		// the bar shrinking to its content and ceasing to be a proportion.
		expect(w).toContain("flex");
		expect(w).toContain("h-6");
		expect(w).toContain("items-center");
		expect(w).toContain("w-full");
	});

	it("split-bar-parity::the-reply-row-TOP-aligns-its-columns-like-the-card", () => {
		// ⛔⛔ THE DECLARATION THE PORT LIST DID NOT NAME, AND WITHOUT WHICH THE BOX
		// ABOVE DOES NOTHING. `AggregateFooter`'s own comment records that
		// `items-center` was tried and lands ~2px off, because it centres the
		// COLUMNS while the track stays its column's first child. MEASURED here on
		// the real compiled CSS: `items-center` would leave −2.0px and
		// `items-start` leaves −0.6px, against −11.99px before the port.
		const row = /<div className="(flex items-[a-z]+ gap-\d[^"]*)">/.exec(
			reply,
		)?.[1];
		expect(row).toBeDefined();
		expect(row?.split(/\s+/)).toContain("items-start");
		expect(row?.split(/\s+/)).not.toContain("items-center");
	});

	it("split-bar-parity::both-flanks-STACK-the-figure-under-its-pill", () => {
		// `.sidewrap` on BOTH sides (`d5:585-586`). Two occurrences, because a
		// single one would mean only one flank was ported and the row would read
		// lopsided — which is exactly what a partial port looks like.
		const flanks =
			reply.match(/flex shrink-0 flex-col items-center gap-1/g) ?? [];
		expect(flanks).toHaveLength(2);
		// The superseded inline form, pinned gone on both flanks.
		expect(reply).not.toContain("flex items-center gap-1.5");
	});

	it("split-bar-parity::the-total-label-carries-the-cards-overline-treatment", () => {
		expect(reply).toContain('<span className="tracking-[0.1em] uppercase">');
		// The card is the source of that treatment — asserted present there too, so
		// this is parity rather than a value invented on the reply side.
		expect(card).toContain('<span className="tracking-[0.1em] uppercase">');
	});
});

describe("R5 — the MARKET CARD did not move", () => {
	it("split-bar-parity::the-card-keeps-its-own-track-declarations", () => {
		// ⛔⛔ THE NEGATIVE HALF. If the port had "helpfully" touched the card, the
		// founder would find a changed surface he never asked about.
		const at = card.indexOf('data-testid="aggregate-split-track"');
		expect(at).toBeGreaterThan(-1);
		const cls =
			/className=\{cn\(\s*(?:\/\/[^\n]*\n\s*)*"([^"]*)"/.exec(
				card.slice(at, at + 4000),
			)?.[1] ?? "";
		expect(cls).toContain("h-[14px]");
		expect(cls).toContain("rounded-[var(--r)]");
		expect(cls).toContain("overflow-hidden");
		expect(cls).toContain("[border:var(--hairline)]");
	});

	it("split-bar-parity::the-card-keeps-items-start-on-its-row", () => {
		const row = /data-testid="aggregate-footer"\s+className="([^"]*)"/.exec(
			card,
		)?.[1];
		expect(row).toBeDefined();
		expect(row?.split(/\s+/)).toContain("items-start");
		expect(row?.split(/\s+/)).toContain("gap-2");
	});

	it("split-bar-parity::the-cards-track-box-is-unchanged", () => {
		const w = trackWrapper(card, "aggregate-split-track");
		expect(w).toContain("flex");
		expect(w).toContain("h-6");
		expect(w).toContain("items-center");
		expect(w).toContain("w-full");
	});
});

describe("R5 — the shared decision functions are still shared", () => {
	it("split-bar-parity::both-bars-import-the-SAME-split-math-and-side-derivation", () => {
		// ⛔ These are shared ON PURPOSE so the two surfaces cannot disagree about
		// one market. A port that inlined a second copy of `computeSplitBar` would
		// be the `PLURAL-NOUN-DUP` genus, and the two bars could then show
		// different totals for the same post.
		for (const [name, src] of [
			["card", card],
			["reply", reply],
		] as const) {
			expect(src, name).toContain("computeSplitBar");
			expect(src, name).toContain("displaySplitTotal");
			expect(src, name).toContain("deriveReplySide");
			expect(src, name).toContain("isEntryDisabled");
			expect(src, name).toContain("c3OppositeSide");
			// …and neither re-implements the split: no local arithmetic on the two
			// Dharma figures.
			expect(src, name).not.toContain("supportDharma +");
		}
	});
});
