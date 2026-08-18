// SPDX-License-Identifier: AGPL-3.0-or-later

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { ONBOARDING_CARDS } from "@/components/onboarding/cards";
import { FREEZE_INSTANT_UTC } from "@/server/markets/create";

/**
 * O1-DECK — THE COPY-DRIFT GUARD. ⚠ THIS FILE CARRIES NO §17 ROW, BY DESIGN.
 *
 * It is a regression guard in the `_probe-*` class (plan D-3), not an
 * acceptance case, and SPEC.1 §21.9 says so in as many words. SPEC.2 §13.5
 * binds every name in an Acceptance block to the §17 catalogue, so naming this
 * file there would put a name in an Acceptance block with nothing in §17 to
 * match it — the exact build error §13.5 defines.
 *
 * WHAT IT BUYS, honestly graded, because two of the three assertions are real
 * verification and one is a tripwire:
 *
 *   1 · REAL. The card strings are byte-equal to the ratified copy register.
 *       The register is the string source of record and the build copies its
 *       bytes rather than retyping them. An ASCII `'` substituted for U+2019
 *       is a defect that review does not catch — it is invisible at every
 *       font size a human reads a diff at. This is the assertion the register
 *       exists to make possible.
 *   2 · REAL, and it catches a specific bug that was nearly shipped. Card 2's
 *       end date must equal `FREEZE_INSTANT_UTC` formatted IN UTC. The freeze
 *       is 2026-11-05T23:59Z; IST is UTC+5:30, so ANY local-time formatting
 *       on an Indian device renders "6th November 2026" and the card
 *       contradicts the freeze it describes. The plan's own recommendation
 *       was to bind these dates to the constant, and that recommendation was
 *       overturned for exactly this reason.
 *   3 · A TRIPWIRE, not a verification, and the plan says so rather than
 *       implying otherwise. There is no machine-readable market slate to
 *       assert `8` against — `MARKET_COUNT` / `TOTAL_MARKETS` do not exist,
 *       `≤ 8 markets` appears only as a BOUND in two doc comments, and the
 *       test database holds fixtures, so a `COUNT(*)` would compare copy to
 *       fixtures and mean nothing. What it buys is that the literals are
 *       pinned in a named place, so changing the slate forces a deliberate
 *       edit to a test that says why. That is the honest ceiling here.
 */

const REGISTER = join(
	process.cwd(),
	"docs/design/ZUGZWANG-O1-DECK_copy-register_v1_0.md",
);

type RegisterCard = { eyebrow: string; title: string; sub: string };

/**
 * Extract the ratified strings from the register's FENCED blocks.
 *
 * Each `### Card N · \`EYEBROW\` · …` section carries exactly two fenced
 * blocks, in order: the title, then the subtext. Parsing the fences rather
 * than the prose is what lets the register carry annotations and warnings
 * around the strings without either side breaking the other — and it is why
 * the build's own copy-register annotation is required to land OUTSIDE a
 * fence (plan S-13).
 */
function readRegisterCards(): RegisterCard[] {
	const source = readFileSync(REGISTER, "utf8");
	const sections = source.split(/^### Card \d+ · /m).slice(1);
	return sections.map((section, i) => {
		const eyebrow = section.match(/^`([^`]+)`/)?.[1];
		const fences = [...section.matchAll(/^```\n([\s\S]*?)\n```/gm)].map(
			(m) => m[1],
		);
		if (eyebrow === undefined || fences.length < 2) {
			throw new Error(
				`copy register: card ${i + 1} did not parse (eyebrow=${eyebrow}, fences=${fences.length})`,
			);
		}
		return { eyebrow, title: fences[0] as string, sub: fences[1] as string };
	});
}

const MONTHS = [
	"January",
	"February",
	"March",
	"April",
	"May",
	"June",
	"July",
	"August",
	"September",
	"October",
	"November",
	"December",
] as const;

function ordinal(day: number): string {
	if (day % 100 >= 11 && day % 100 <= 13) return `${day}th`;
	if (day % 10 === 1) return `${day}st`;
	if (day % 10 === 2) return `${day}nd`;
	if (day % 10 === 3) return `${day}rd`;
	return `${day}th`;
}

/**
 * ⚠ EVERY FIELD IS A `getUTC*` READ. A `getDate()` here instead of
 * `getUTCDate()` is the whole bug this guard exists to catch, and on a
 * UTC-configured CI machine the two agree — so the assertion below pins the
 * literal as well as the derivation.
 *
 * A month NAME table rather than `toLocaleDateString`: no ICU dependency, no
 * locale in the environment that can change the answer.
 */
function formatUtcOrdinalDate(d: Date): string {
	return `${ordinal(d.getUTCDate())} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

describe("O1-DECK — copy drift against the ratified register", () => {
	it("every card string is BYTE-EQUAL to the copy register", () => {
		const registerCards = readRegisterCards();

		// Guard the guard: a parser that silently matched nothing would make
		// every comparison below vacuous.
		expect(registerCards.length).toBe(7);
		expect(ONBOARDING_CARDS.length).toBe(registerCards.length);

		// Compared as whole arrays so a single failure prints the offending
		// character in context rather than "expected true to be false".
		expect(
			ONBOARDING_CARDS.map((c) => ({
				eyebrow: c.eyebrow,
				title: c.title,
				sub: c.sub,
			})),
		).toEqual(registerCards);
	});

	it("carries the non-ASCII bytes the register warns about", () => {
		// A positive control on the assertion above: if the register itself were
		// ever flattened to ASCII, byte-equality would still pass while the
		// product quietly lost its typography. These are the three codepoints
		// the register's §1 names.
		const all = ONBOARDING_CARDS.map((c) => `${c.title}\n${c.sub}`).join("\n");
		expect(all).toContain("’"); // ’ right single quotation mark
		expect(all).toContain("—"); // — em dash
		expect(all).toContain("·"); // · middle dot, in `K · n > C`
	});

	it("Card 2's end date equals FREEZE_INSTANT_UTC formatted IN UTC", () => {
		const welcome = ONBOARDING_CARDS.find((c) => c.eyebrow === "WELCOME");
		expect(welcome, "the WELCOME card exists").toBeDefined();

		// The literal, pinned — so a formatter that broke would be caught here
		// rather than agreeing with a broken card.
		expect(formatUtcOrdinalDate(FREEZE_INSTANT_UTC)).toBe("5th November 2026");

		// ⛔ AND THE LOCAL-TIME ANSWER IS ASSERTED TO BE THE WRONG ONE. On any
		// timezone east of Greenwich the freeze instant falls on the following
		// day, so this is the string a local-time formatting would have shipped.
		expect(welcome?.sub).not.toContain("6th November 2026");

		expect(welcome?.sub).toContain(formatUtcOrdinalDate(FREEZE_INSTANT_UTC));
	});

	it("pins Card 2's market count and window start as literals (tripwire)", () => {
		const welcome = ONBOARDING_CARDS.find((c) => c.eyebrow === "WELCOME");
		expect((welcome?.sub.match(/8 markets/g) ?? []).length).toBe(2);
		expect(welcome?.sub).toContain("15th September 2026");
	});
});
