// @vitest-environment jsdom

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ArgProfile } from "@/components/debate/ArgProfile";

/**
 * MOBILE-2n · R-1 / R-4 / ADR-0051 A10 D-1 + D-4 — the identity block after the
 * chips move to the meta row, and the name lands on the avatar's centre.
 *
 * ⚠ WHAT THIS FILE OWNS AND WHAT IT DOES NOT. `arg-profile-row.test.tsx` owns
 * the ORDER tokens on the rendered nodes and `phone-identity-block.test.ts`
 * owns the break mechanism; neither is duplicated here. What is here is the
 * founder's explicit "nothing in the meta row is shortened or dropped", the
 * one authorised departure from "same chip style as now", and the three-token
 * relation that centres the name — three claims that no existing guard states.
 *
 * ⛔ jsdom PERFORMS NO LAYOUT. Nothing here proves the row is two lines, that
 * the name's glyph box centres on the avatar's, or that a chip fits at 360.
 * Those are the run's browser measurements (AGENTS.md §9). This file proves the
 * tokens and the text that make those outcomes possible.
 *
 * ⛔ NO PHONE-VARIANT LITERAL IS WRITTEN OUT — Tailwind v4 scans `tests/`, so a
 * class-shaped literal here becomes a real emitted utility. The prefix is
 * assembled at runtime.
 *
 * No jest-dom in this repo (AGENTS.md §9) — plain DOM assertions only.
 */

afterEach(cleanup);

const V = "max-mobile";
const S = ":";
const phone = (utility: string) => V + S + utility;

const CREATED_AT = new Date("2026-09-12T10:00:00.000Z").toISOString();

function row(extra?: { badge?: "Highest Stakes" }) {
	const { container } = render(
		<ArgProfile
			author={{ pseudonym: "CeruleanCapybara00", pfpUrl: "" }}
			side="YES"
			marker="Flipped"
			entryPrice="0.100000000000000000"
			authorStake="0.000000000000000000"
			originalStake="0.000000000000000000"
			sold
			replyCount={0}
			createdAt={CREATED_AT}
			badge={extra?.badge ?? null}
			download={{ ordinal: 1 }}
		/>,
	);
	return container;
}

const tokens = (el: Element | null) =>
	(el?.getAttribute("class") ?? "").split(/\s+/).filter(Boolean);

describe("MOBILE-2n · R-1 / A10 D-1 — the meta row loses nothing to make room", () => {
	it("phone-r1::REPLIES-n-is-byte-identical-and-its-CASE-is-still-a-class", () => {
		// ⛔⛔ THE FOUNDER RULED THIS FIELD EXPLICITLY — "Nothing in the meta row is
		// shortened or dropped; `REPLIES · 0` stays exactly as it is" — because the
		// row gained two chips and abbreviating a field is the obvious way to pay
		// for them. It is the one field on the row that could plausibly be
		// shortened without looking wrong, which is precisely why it is pinned.
		const container = row();
		const field = [...container.querySelectorAll("span")].find((el) =>
			/^Replies\s·/.test((el.textContent ?? "").trim()),
		);
		expect(field, "the replies field is gone from the meta row").toBeDefined();
		expect((field?.textContent ?? "").trim()).toBe("Replies · 0");
		// ⛔ AND THE UPPERCASING IS A CLASS, WHICH NO textContent ASSERTION CAN SEE.
		// `text-transform` never touches `textContent`, so the row above stays
		// green while the field renders `Replies · 0` in sentence case — the
		// mirror of the trap `GitHubStars.tsx` records for `normal-case`. The
		// rendered register is `REPLIES · 0`; the DOM text is not.
		expect(
			tokens(field ?? null),
			"the field lost the class that renders it uppercase, so it now reads " +
				"`Replies · 0` on screen against a ruling that names `REPLIES · 0`.",
		).toContain("uppercase");
		// The count opts back out of the overline's tracking — letter-spacing on a
		// digit reads as a defect — so the two halves are separate nodes and the
		// contiguous text above is what proves they still read as one field.
		expect((field?.querySelector("span")?.textContent ?? "").trim()).toBe("0");
	});

	it("phone-r1::the-chips-spend-the-rulings-2px-allowance-and-NOTHING-else", () => {
		// ⚠ R-1 says "Same chip style as now (11px, sentence case, one register)"
		// and then permits tightening the chip padding by up to 2px if the row
		// overflows. It does — MEASURED at 360 on `/m/sp-m12-fill`: the meta row
		// with both chips needs 330.12px against a 296.03px wrapping area — so the
		// allowance is spent, in full and once: `px-1.5` (6px) → `px-1` (4px) is
		// exactly 2px on each of four chip edges.
		// ⛔ IT BUYS 375 AND NOT 360, and that is recorded rather than papered
		// over: the remaining deficit at 360 is larger than the whole allowance,
		// and every other lever R-1 names is closed by R-1 itself. A founder
		// ruling is owed; see the round's run report.
		const container = row();
		const marker = [...container.querySelectorAll("*")].find(
			(el) => el.textContent === "Flipped",
		);
		const sold = container.querySelector('[data-testid="argstake-sold"]');
		for (const [what, el] of [
			["the position marker", marker ?? null],
			["the Sold chip", sold],
		] as [string, Element | null][]) {
			expect(el, `${what} did not render`).not.toBeNull();
			expect(
				tokens(el),
				`${what} did not take the ruled 2px tightening, so the meta row is ` +
					`8px wider than it needs to be at every phone width.`,
			).toContain(phone("px-1"));
			// ⛔ THE REST OF THE REGISTER IS UNTOUCHED — 11px, sentence case, one
			// register. The allowance is for PADDING and for nothing else, and a
			// size or a case change here would be the round taking a licence it
			// was not given.
			expect(tokens(el), `${what}: the ruled size`).toContain(
				phone("text-[11px]"),
			);
		}
		// The desktop padding survives beside it — ADR-0045's first rule is that a
		// phone token OVERRIDES and never REPLACES, so `px-1.5` must still be
		// declared or the 1440 chip silently tightens too.
		expect(tokens(sold), "the desktop chip padding was replaced").toContain(
			"px-1.5",
		);
	});
});

describe("MOBILE-2n · R-4 / A10 D-4 — the name's line box IS the avatar's box", () => {
	it("phone-r4::the-name-the-floor-and-the-avatar-name-ONE-spacing-step", () => {
		// ⛔⛔ THE THREE TOKENS ARE ONE FACT. `leading-8` on the name makes its LINE
		// BOX the element's box, so the half-leading centres the glyphs in it;
		// `min-h-8` is the floor that box is measured against; `size-8` is the
		// avatar it has to agree with. All three are `calc(var(--spacing) * 8)` —
		// REM, not px — so a reader who enlarges their root font size keeps the
		// alignment instead of watching it drift. `leading-[32px]` would have
		// produced the same pixels today and broken for exactly that reader.
		// ⇒ Asserted as the same STEP rather than as the same number, which is the
		// only form in which "they move together" is checkable.
		const container = row();
		const name = container.querySelector('a[href^="/u/"]');
		const avatar = container.querySelector('[data-slot="avatar"]');
		expect(name, "the pseudonym did not render").not.toBeNull();
		expect(avatar, "the avatar did not render").not.toBeNull();
		expect(tokens(name), "the name's line box").toContain(phone("leading-8"));
		expect(tokens(name), "the floor it is measured against").toContain(
			phone("min-h-8"),
		);
		expect(
			tokens(avatar).join(" "),
			"the avatar is no longer 8 spacing units, so the name now centres on a " +
				"box of a different height and the 1px tolerance is spent by " +
				"arithmetic rather than by rendering.",
		).toContain("size-8");
		// ⛔ AND NO ARBITRARY LEADING CAME BACK BESIDE IT. A `leading-[Npx]` here
		// would agree with the other two today and drift the first time the
		// spacing scale or the root font size moves — which is the whole reason
		// A10 D-4 names a step instead of a value.
		expect(
			tokens(name).some((t) => t.startsWith(phone("leading-["))),
			"the name states an arbitrary leading again (A10 D-4).",
		).toBe(false);
		// >=640px is untouched: the desktop name keeps its own size step.
		expect(tokens(name), "the 1440 size").toContain("text-sm");
	});
});
