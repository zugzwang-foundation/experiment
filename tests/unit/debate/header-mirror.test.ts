import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * UI-QUICK change set 8 §5 — BOTH HEADERS READ THE COMPOSING SIDE, AND THE
 * MIRRORED CONTROLS BIND TO IT.
 *
 * ⚠⚠ WHY THIS GUARD IS THE PRICE OF THE FEATURE. Until now, a composer bound to
 * the wrong side would have been visible: the panel said one pole and the header
 * above it said the other, and the contradiction was the evidence. This change
 * removes that contradiction on purpose — both headers now read the composing
 * side — so a wrongly-bound control would look CORRECT. §0c traced the chain
 * clean and `side-identity.test.tsx` keeps it clean below the composer; this
 * file is the same obligation for the header.
 *
 * ⛔⛔ THE BINDING RULE: the mirrored BUY and SELL bind to the COMPOSING side,
 * NEVER to the column they sit in. Both headers read NO ⇒ both BUYs are NO ⇒
 * both SELLs are NO's. `SlotHeader` derives its percent, its to-win, its
 * position readout, its Buy handler and its Sell gate from the ONE `side` prop
 * it is handed, so the whole binding reduces to a single question: is that prop
 * `headerSide` or `side`? That is what these assertions ask.
 *
 * ⚠⚠ WHY A SOURCE SCAN. Proving it by render means mounting `DebateView`, which
 * drags in `BetComposer`, the bet server actions, the quote reader and the R2
 * chain — a mock deep enough to host that would be proving the mock.
 * `head-zone.test.tsx` and `debate-view-freeze.test.ts` state the same limit for
 * the same reason. What is asserted here IS a claim about the source: which
 * identifier reaches which prop.
 *
 * ⛔ FENCE BY SYMBOL, NEVER BY LINE (O-8).
 */

const ROOT = process.cwd();
const VIEW = "src/components/debate/DebateView.tsx";
const HEADER = "src/components/debate/composer/SlotHeader.tsx";
const source = readFileSync(join(ROOT, VIEW), "utf8");

/** The market arm's `<SlotHeader …/>` tag, props included. */
function slotHeaderTag(): string {
	const at = source.indexOf("<SlotHeader");
	if (at === -1) {
		throw new Error(
			`${VIEW}: no <SlotHeader>. If the header was restructured, re-derive ` +
				`this guard rather than deleting it.`,
		);
	}
	const end = source.indexOf("/>", at);
	return source.slice(at, end + 2);
}

describe("§5 the header mirrors the composing side", () => {
	it("header-mirror::headerSide-is-the-composing-side-while-open-and-the-column-otherwise", () => {
		// `openSide ?? side` — the composing side when one is open, the column's
		// own pole when none is. ⛔ This single expression is what makes BOTH
		// columns agree while open and restore on close: with `openSide` null it
		// collapses to the identity, so nothing to "revert" can be forgotten.
		expect(source).toContain("const headerSide = openSide ?? side;");
	});

	it("header-mirror::EVERY-side-keyed-header-prop-reads-headerSide-not-the-column", () => {
		const tag = slotHeaderTag();

		// ⛔⛔ THE BINDING RULE, ASSERTED PROP BY PROP.
		expect(tag).toContain("side={headerSide}");
		// The Buy handler — the control that opens/closes a bet on a side.
		expect(tag).toContain("onToggleEntry={() => toggleEntry(headerSide)}");
		// 3a — the open state. Both headers must show the SAME open fill, so this
		// compares against the mirrored side, not the column.
		expect(tag).toContain("composerOpen={openSide === headerSide}");

		// ⛔ AND THE COLUMN'S OWN POLE MUST NOT LEAK BACK IN. `side={side}` here
		// would bind the mirrored Buy, the Sell gate and the percent to the host
		// column — the defect this file exists for, and one that would now look
		// correct on screen.
		expect(tag).not.toContain("side={side}");
		expect(tag).not.toContain("toggleEntry(side)");
		expect(tag).not.toContain("openSide === side");
	});

	it("header-mirror::SlotHeader-derives-everything-from-its-ONE-side-prop", () => {
		// The reason the assertions above are sufficient: there is no second
		// side-ish input to `SlotHeader`. Percent, to-win, the position readout and
		// the Sell gate all key off the same prop, so binding it correctly binds
		// all of them. If a future edit adds a second side input, this reddens and
		// the binding must be re-derived rather than assumed.
		const header = readFileSync(join(ROOT, HEADER), "utf8");
		expect(header).toContain("formatPricePercent(pricing, side)");
		expect(header).toContain('unitToWin[side === "YES" ? "yes" : "no"]');
		expect(header).toContain("viewer.position.side === side");
	});

	it("header-mirror::3c-SELL-keeps-the-same-anchor-and-the-same-href", () => {
		// The mirror is the same control, not a re-implementation: still a `Link`,
		// still to the viewer's own profile with this market preselected, still
		// rendered only for a viewer holding a position on the header's side.
		const header = readFileSync(join(ROOT, HEADER), "utf8");
		expect(header).toContain('data-testid="w210c-sell-link"');
		// ⚠ Asserted as a REGEX, not a string: a literal `${` inside quotes trips
		// biome's `noTemplateCurlyInString` (a real rule — it catches a template
		// that forgot its backticks). Escaping it in a pattern says the same thing
		// without the false positive, and without a suppression.
		expect(header).toMatch(
			/href=\{`\/u\/\$\{encodeURIComponent\(ownPseudonym\)\}\?market=\$\{encodeURIComponent\(slug\)\}`\}/,
		);
		expect(header).toContain(
			"viewer?.position && viewer.position.side === side",
		);
	});

	it("header-mirror::3d-each-header-is-a-LABELLED-GROUP-so-the-two-are-distinguishable", () => {
		// ⛔ Two controls now carry the SAME accessible name, because they are the
		// same action — renaming one would make them disagree about that. The
		// context disambiguates instead: each header is a group labelled with the
		// COLUMN it physically occupies, so a screen reader announces
		// "YES column, Buy NO, button".
		// ⚠ `${side} column`, NOT `${headerSide}` — this label names WHERE the
		// control is, which is the whole point; labelling it with the mirrored side
		// would make both groups announce identically and disambiguate nothing.
		// ⚠ A native `<fieldset>` carries the group role, so biome's
		// `useSemanticElements` is satisfied without a suppression. The
		// disambiguation is unchanged — only the element expressing it.
		expect(source).toContain("<fieldset");
		expect(source).toMatch(/aria-label=\{`\$\{side\} column`\}/);
		expect(source).toContain("data-header-side={headerSide}");
	});
});
