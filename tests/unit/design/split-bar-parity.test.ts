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
 *
 * ⚠⚠ BLOCK-3 §2 — THE "CARD DID NOT MOVE" HALF IS NOW HISTORICAL, NOT STANDING.
 * It proved RPLY-1 (the reply-bar port) didn't touch `AggregateFooter` — true
 * then and still true of THAT event. BLOCK-3 §2 moves `AggregateFooter`'s track
 * for an unrelated reason (redistributing height freed by the resolution-block
 * row, cascaded from `PriceBar`'s `detail` bar), and `ReplySplitBar.tsx` moves
 * WITH it to hold the three-way parity this file's header names. The three
 * literals this used to hardcode as `"14px"` (once at each of `trackWrapper`'s
 * anchor, the reply assertion, and the card assertion) are the reason this
 * chain broke silently at that resize — they are now READ OFF `PriceBar.tsx`'s
 * `detail.bar`, the same pattern `aggregate-footer-alignment.test.ts` already
 * uses, so the NEXT resize reddens here instead of drifting unnoticed.
 */

const ROOT = process.cwd();
const CARD = "src/components/debate/AggregateFooter.tsx";
const REPLY = "src/components/debate/composer/ReplySplitBar.tsx";
const PRICE_BAR = "src/components/debate/PriceBar.tsx";
const card = readFileSync(join(ROOT, CARD), "utf8");
const reply = readFileSync(join(ROOT, REPLY), "utf8");
const priceBar = readFileSync(join(ROOT, PRICE_BAR), "utf8");

/**
 * The canonical thickness, READ OFF `PriceBar`'s `detail.bar` rather than
 * hardcoded — the same pattern `aggregate-footer-alignment.test.ts` uses, and
 * for the same reason: a copied literal drifts silently the next time `detail`
 * is re-sized, and a re-derived one reddens instead.
 */
const DETAIL_PX = /detail:\s*\{\s*bar:\s*"h-\[(\d+)px\]"/.exec(priceBar)?.[1];
if (!DETAIL_PX) {
	throw new Error(`${PRICE_BAR}: no detail.bar declaration found`);
}
const TRACK_CLASS = `h-[${DETAIL_PX}px]`;

/** The class string of the element WRAPPING a bar's track, in either file. */
function trackWrapper(source: string, testid: string | null): string[] {
	const at =
		testid === null
			? source.indexOf(`${TRACK_CLASS} w-full overflow-hidden`)
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
	it("split-bar-parity::the-reply-track-matches-PriceBar-detail-with-the-card-radius-and-clip", () => {
		// ⛔ THE THREE THAT MOVED, asserted on the reply bar. Before: `h-1.5`
		// (6px) and `rounded-(--r-dot)` (3px) — a hairline with a square corner
		// beside a market bar that is a pill.
		expect(reply).toContain(TRACK_CLASS);
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
		// ⚠ ANCHORED ON THE ROW'S OWN `data-testid`, and the unanchored version is
		// recorded as the defect it was. This read
		// `/<div className="(flex items-[a-z]+ gap-\d[^"]*)">/` — the FIRST match of
		// an extremely common shape. `expect(row).toBeDefined()` proves *a* match,
		// never the *right* one, so any future edit introducing an earlier
		// `flex items-… gap-…` div would silently re-point this assertion and free
		// the real row to drift back to `items-center` — the ~2px misalignment the
		// port exists to remove. The card half already anchors on
		// `data-testid="aggregate-footer"`; this now matches it (OVN-V5).
		const row = /data-testid="reply-split-bar"\s+className="([^"]*)"/.exec(
			reply,
		)?.[1];
		expect(row).toBeDefined();
		expect(row?.split(/\s+/)).toContain("items-start");
		expect(row?.split(/\s+/)).not.toContain("items-center");
		expect(row?.split(/\s+/)).toContain("gap-2");
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

describe("R5 — the market card's own track still matches PriceBar's detail size", () => {
	// ⚠⚠ BLOCK-3 §2 — RENAMED FROM "the MARKET CARD did not move". That title
	// asserted a historical negative (RPLY-1's reply-bar port left the card's
	// OWN literals untouched), which stayed true across that event but reads
	// as false the moment a later task — this one — DOES move the card, for a
	// reason RPLY-1 never had to consider. The assertions below already read
	// the card's thickness against `TRACK_CLASS` (itself derived from
	// `PriceBar.tsx`), so they never actually pinned "no change, ever" — only
	// "in parity with the market bar" — and the describe title now says that
	// instead of the narrower claim it used to make.
	it("split-bar-parity::the-card-keeps-radius-and-clip-in-parity-with-PriceBar-detail", () => {
		const at = card.indexOf('data-testid="aggregate-split-track"');
		expect(at).toBeGreaterThan(-1);
		const cls =
			/className=\{cn\(\s*(?:\/\/[^\n]*\n\s*)*"([^"]*)"/.exec(
				card.slice(at, at + 4000),
			)?.[1] ?? "";
		expect(cls).toContain(TRACK_CLASS);
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
