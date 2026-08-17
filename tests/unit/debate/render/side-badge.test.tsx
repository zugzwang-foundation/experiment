// @vitest-environment jsdom

import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { SideBadge } from "@/components/debate/badges";

/**
 * DISCOVERY-COMPLETE C3 — V10 (entry price on the chip) and V11 (the Discovery
 * hero chip geometry). Both additions are OPT-IN, so the call sites that
 * pass neither prop render exactly what they rendered before.
 *
 * PRIMITIVES-2 commit 1 (D7) re-measured this inventory at ITS head and the
 * zero-delta subject is TWELVE, not the EIGHT this docblock previously claimed.
 *
 * COUNTED INVENTORY, re-measured at POLISH.5 PR A (2026-08-14). `SideBadge` has
 * THIRTEEN render sites across TEN consumer files, plus the definition. THREE
 * pass a `size` — `discovery/HeroPanels.tsx` (`hero`) and `profile/ArgumentList
 * .tsx` ×2 (`profile`, POLISH.5 item 2) — and the other TEN ride `CHIP.base`.
 *
 * ⚠ THAT WAS "ONE sized / TWELVE base" UNTIL 2026-08-14. The count moved
 * because POLISH.5 item 2 adopted the `profile` preset, which this file's own
 * seam assertion forced to be RULED rather than absorbed (POLISH.5 §5 row 19).
 * The paragraphs below are the PRIOR corrections, kept as the record they are.
 *
 * ⚠ That line was `:142` when this paragraph was first written at the branch
 * point `143380b`, and commit 4's `REPLYHEAD_TIER` block shifted it. Corrected
 * at PR head rather than left citing a SHA — the census below is keyed by FILE
 * for exactly this reason, and a docblock that went stale inside its own branch
 * is the failure this paragraph exists to describe (§8.2).
 *
 * ⚠ THE "EIGHT" ABOVE WAS A SUBSET, NOT A COUNT OF THE BASE SITES. It named the
 * sites that pre-existed C3, and so EXCLUDED the four C4/C4b-minted sites
 * (`bookmarks/BookmarkCard.tsx:32,46`, `profile/ArgumentList.tsx:49,59`) — which
 * pass no `size` and DO ride `CHIP.base`. They were "intended changes" only with
 * respect to C3's own diff; to any LATER change of the base preset they are
 * ordinary zero-delta subjects. A zero-delta proof scoped to the eight would
 * have silently exempted four live sites, so the subject is restated as twelve
 * and made mechanical by the census below rather than left to a prose count.
 *
 * (The plan said "9 files / 8 consumers". That was true when the plan was
 * written and is stale at PR head BECAUSE C4/C4b adopted the primitive in this
 * same PR. Corrected here rather than left to drift — counted inventories are
 * load-bearing in this repo, which is C0's whole point.)
 *
 * No jest-dom in this repo (AGENTS.md §9) — plain DOM assertions only.
 */

afterEach(cleanup);

/**
 * The class tail `SideBadge` itself contributes, in the exact order it
 * contributed it before C3. Everything to the left of this is the shadcn
 * `badgeVariants` base, which C3 does not touch and which is deliberately NOT
 * pinned here — pinning it would redden this suite on an unrelated shadcn bump,
 * and a guard that reddens on correct code gets suppressed.
 *
 * The FULL rendered `outerHTML` was proven byte-identical to the component at
 * origin/main aff76b3 during C3, for both poles, by rendering the two versions
 * side by side. That was a one-time proof; this is the standing guard for the
 * part a future SideBadge edit could actually move.
 */
const OWNED_TAIL =
	"rounded-sm px-1.5 font-mono text-[10px] tracking-wide [border:var(--hairline)] bg-yes text-no";

/**
 * The census that makes the base-site count a MEASUREMENT rather than a claim.
 *
 * The two render assertions below exercise the base preset through both poles,
 * which is the whole of what those base sites render — every one of them is
 * `<SideBadge side={…} />` and nothing else. What that pair cannot show is HOW
 * MANY sites it speaks for, and a prose count is exactly what went stale above.
 * So the count is read off the tree here.
 *
 * KEYED BY FILE, NOT BY `file:line`, deliberately. A line-keyed inventory
 * reddens on any unrelated edit that shifts a line in one of these ten files —
 * and a guard that reddens on correct code gets suppressed within a week
 * (`side-pole-binding.test.ts:38`, the same reasoning that keeps its own
 * inventory file-keyed). Per-file COUNTS still catch both directions: a
 * thirteenth base site and a removed one each break set equality.
 */
const ROOT = process.cwd();

const RENDER_SITE = /<SideBadge\b[\s\S]*?\/>/g;

const sideBadgeSites = readdirSync(join(ROOT, "src"), {
	recursive: true,
	withFileTypes: true,
})
	.filter((entry) => entry.isFile() && entry.name.endsWith(".tsx"))
	.map((entry) => join(entry.parentPath, entry.name).replace(`${ROOT}/`, ""))
	.flatMap((file) =>
		[...readFileSync(join(ROOT, file), "utf8").matchAll(RENDER_SITE)].map(
			(match) => ({
				file,
				markup: match[0],
				sized: /\bsize\s*=/.test(match[0]),
			}),
		),
	);

const countByFile = (sites: ReadonlyArray<{ file: string }>) => {
	const counts: Record<string, number> = {};
	for (const { file } of sites) {
		counts[file] = (counts[file] ?? 0) + 1;
	}
	return counts;
};

describe("SideBadge — the CHIP.base call sites are a measured set", () => {
	it("census-is-alive", () => {
		// A glob that silently matched nothing passes vacuously (N1). If this
		// floor ever trips, the matcher broke — not the inventory.
		//
		// ⚠ LOWERED 13 → 12 AT HTML-FINISH · MARKET DETAIL row 33, with grounds,
		// because the inventory genuinely SHRANK: `dialogs.tsx`'s two hand-built
		// badges went away when both pop-ups adopted the shared `ArgProfile`
		// cluster, which owns one badge for all of them. A floor that outruns the
		// real inventory is a guard that reddens on correct code, and this file's
		// own docstring says such a guard "gets suppressed within a week".
		// ⛔ It is still a NON-VACUITY floor, not a count: the set-equality map
		// below is what actually fences membership.
		expect(sideBadgeSites.length).toBeGreaterThanOrEqual(12);
	});

	it("exactly-six-sites-pass-no-size-and-ride-CHIP-base", () => {
		const base = sideBadgeSites.filter((site) => !site.sized);
		// Set equality, never a bare count (N5) — a count of 10 is also satisfied
		// by ten sites in the wrong files.
		//
		// ⚠ THE SUBJECT WAS TWELVE UNTIL 2026-08-14. `ArgumentList.tsx`'s two
		// sites wire `profile` per PD-5-01 — POLISH.5 item 2, tier-4 baseline
		// `surface_profile_v1_0.html:278-279`. Ratified 2026-08-14: the guard
		// fired and the adoption was RULED, not absorbed (POLISH.5 §5 row 19).
		// `detail` remains pinned at zero for POLISH.3 — see the split assertion
		// in the seam-presets block below.
		//
		// ⚠ AND EIGHT UNTIL 2026-08-16. `dialogs.tsx`'s `PostPopup` gains ONE
		// UNSIZED site per PD-3-14 — POLISH.3 PR 2 row 12, commit C6, tier-1
		// baseline INV-3 side binding via POLISH-0.md §7 criterion 2. The pop-up
		// had rendered the side as BARE INTERPOLATED TEXT with no badge at all, so
		// this is the primitive arriving where it was missing, not a re-skin.
		// ⚠ THE WALL THIS FILE PREDICTED IS THE ONE PR 2 HIT. The note below says
		// "POLISH.3 PR 2 must still hit this wall and get its own ruling" — it did,
		// the adoption was RULED at the plan (§9 C6 names this re-key explicitly,
		// §7 measures it as 8 base → 9), and it is recorded here rather than
		// absorbed. `detail` STILL holds its zero: row 12's badge is UNSIZED, which
		// is why only the base map moves and the seam-preset assertion below is
		// untouched.
		//
		// ⚠ AND NINE, THEN EIGHT, ON 2026-08-16 — HTML-FINISH · MARKET DETAIL,
		// two rows in the same PR and for opposite reasons.
		// · Row 13 moved `ArgProfile.tsx`'s ONE site out of `base`: it now varies
		//   the preset by prop (`size={chipSize}`), so the markup classifier reads
		//   it as sized even though it renders `base` at every card and reply site.
		// · Row 26 moved ONE of `ReplyCard.tsx`'s TWO sites out of the census
		//   entirely: the reply card's hand-rolled head was replaced by
		//   `ArgProfile`, which owns the badge now. The REMOVED branch keeps its
		//   own `SideBadge` — a removed reply has no author, so it cannot render
		//   an `ArgProfile` — which is why the count is 1 and not 0.
		//
		// · Row 27 ADDED one back: `dialogs.tsx` gained a second UNSIZED site when
		//   `ReplyPopup` joined `PostPopup` in that file …
		// · … and row 33 then removed BOTH, when the two pop-ups adopted the same
		//   `ArgProfile` cluster the card and the focused post use. `dialogs.tsx`
		//   leaves this map entirely.
		// ⇒ ONE PR moved this map in both directions and then off a file, which is
		//   precisely why the MAP — and never a count — is the fence.
		//
		// ⚠ AND TEN UNTIL 2026-08-15. `BookmarkCard.tsx`'s two sites wire
		// `profile` per PD-6-03 — POLISH.6 item 3, the SAME tier-4 baseline
		// `surface_profile_v1_0.html:278-279`. Ratified 2026-08-15: the guard
		// fired a THIRD time and the adoption was RULED, not absorbed
		// (POLISH.6 HALT-1, raised at STEP 0.6 before any write). `detail` STILL
		// holds its zero: this is a surface-scoped adoption, never a blanket
		// amendment, and POLISH.3 PR 2 must still hit this wall and get its own
		// ruling.
		//
		// ⛔ THE FENCE. POLISH.6 may write the sites ENUMERATED BELOW and nothing
		// else in this file. ⚠ COUNT THE LIST — do not trust a number written
		// beside it. This sentence has now been WRONG TWICE by exactly that
		// mechanism: it said "three maps, one length and this comment" and went
		// stale when a test name joined, then said SIX and went stale when a
		// second name joined. A prose count is an assertion with no guard, so
		// the list is the fence and any count is a reading of it.
		//   · the `countByFile(base)` map
		//   · the `countByFile(sized)` map
		//   · the `countByFile(wiredProfile)` map
		//   · the one `toHaveLength` on `base`
		//   · this comment
		//   · the name of the test that owns the `base` map
		//   · the name of the test that owns the `sized` map
		//
		// ⚠ THE NAMES ARE FENCED BECAUSE A NAME IS AN ASSERTION.
		// `exactly-ten-sites-…` above an `expect(…).toHaveLength(8)` is a FALSE
		// RECEIPT — a reader greps the name, believes it, and never opens the
		// body. PR A set the convention here when it renamed twelve → ten.
		// ⚠⚠ AND THE SECOND NAME PROVES THE SHARPER FORM: it carried NO count,
		// it carried an ENUMERATION ("the discovery hero and the profile list"),
		// and it went stale the moment a third file joined the map. A
		// count-shaped sweep cannot find a count-free name. ⇒ It is not numbers
		// that rot; it is any name making a factual claim.
		expect(countByFile(base)).toEqual({
			"src/components/debate/DebateColumn.tsx": 1,
			"src/components/debate/PostCard.tsx": 1,
			"src/components/debate/PostFocusHeader.tsx": 1,
			"src/components/debate/ReplyCard.tsx": 1,
			"src/components/debate/composer/BetComposer.tsx": 1,
			"src/components/debate/composer/SellModule.tsx": 1,
		});
		expect(base).toHaveLength(6);
	});

	it("the-sized-sites-are-exactly-the-map-below", () => {
		// The positive control beside the assertion above (N3): the classifier
		// does distinguish the two kinds, so "ten unsized" is not just "the
		// matcher never sees a size".
		const sized = sideBadgeSites.filter((site) => site.sized);
		expect(countByFile(sized)).toEqual({
			"src/components/bookmarks/BookmarkCard.tsx": 2,
			"src/components/debate/ArgProfile.tsx": 1,
			"src/components/discovery/HeroPanels.tsx": 1,
			"src/components/profile/ArgumentList.tsx": 2,
		});
	});
});

describe("SideBadge — the CHIP.base call sites have a zero delta", () => {
	it("bare-yes-render-is-unchanged", () => {
		const { container } = render(<SideBadge side="YES" />);
		const badge = container.firstElementChild;
		expect(badge?.textContent).toBe("YES");
		expect(badge?.getAttribute("aria-label")).toBe("YES side");
		// Ends with the owned tail, in order — the hairline did not migrate and
		// the geometry did not change.
		expect(badge?.getAttribute("class")?.endsWith(OWNED_TAIL)).toBe(true);
	});

	it("bare-no-render-is-unchanged", () => {
		const { container } = render(<SideBadge side="NO" />);
		const badge = container.firstElementChild;
		expect(badge?.textContent).toBe("NO");
		expect(badge?.getAttribute("aria-label")).toBe("NO side");
		expect(
			badge
				?.getAttribute("class")
				?.endsWith(
					"rounded-sm px-1.5 font-mono text-[10px] tracking-wide [border:var(--hairline)] bg-no text-yes",
				),
		).toBe(true);
	});

	it("an-explicitly-undefined-size-resolves-to-base-not-to-nothing", () => {
		// D7's one behavioural risk, pinned. `CHIP[size ?? "base"]` differs from
		// the ternary it replaced in exactly one way: a ternary could not produce
		// `undefined`, and a map lookup can. The `??` is what closes that. Written
		// as `CHIP[size as "hero"]` the chip would emit NO geometry classes at
		// all — and the two assertions above would still pass, because a bare
		// render's suffix is then the pole pair alone. Asserted at BOTH poles: a
		// YES-only assertion passes on an inverted NO panel.
		for (const [side, tail] of [
			["YES", OWNED_TAIL],
			[
				"NO",
				"rounded-sm px-1.5 font-mono text-[10px] tracking-wide [border:var(--hairline)] bg-no text-yes",
			],
		] as const) {
			const { container } = render(<SideBadge side={side} size={undefined} />);
			const cls = container.firstElementChild?.getAttribute("class") ?? "";
			expect(cls.endsWith(tail)).toBe(true);
			// The geometry is PRESENT, not merely the pole pair — the half the
			// suffix pin alone cannot distinguish.
			expect(cls).toContain("text-[10px]");
			cleanup();
		}
	});
});

describe("SideBadge — INV-3, the side stays pole-bound whatever else is added", () => {
	it("poles-are-never-semantic-or-neutral-in-any-prop-combination", () => {
		const CASES = [
			{ side: "YES" as const, expected: "bg-yes text-no" },
			{ side: "NO" as const, expected: "bg-no text-yes" },
		];
		for (const { side, expected } of CASES) {
			for (const props of [
				{},
				{ price: "0.270000000000000000" },
				{ size: "hero" as const },
				{ size: "hero" as const, price: "0.270000000000000000" },
				{ size: "detail" as const },
				{ size: "detail" as const, price: "0.270000000000000000" },
				{ size: "profile" as const },
				{ size: "profile" as const, price: "0.270000000000000000" },
			]) {
				const { container } = render(<SideBadge side={side} {...props} />);
				const cls = container.firstElementChild?.getAttribute("class") ?? "";
				expect(cls).toContain(expected);
				// The C0 defect class: a side must never resolve through a shadcn
				// semantic variant or a neutral-ramp token. Matched on EXACT class
				// tokens — `badgeVariants` ships `[a]:hover:bg-primary/80`, which
				// contains the substring "bg-primary" while being a different rule,
				// so a substring assertion here would report a defect that is not
				// there (O-3).
				const tokens = cls.split(/\s+/).filter(Boolean);
				expect(tokens).not.toContain("bg-primary");
				expect(tokens).not.toContain("bg-secondary");
				expect(tokens).not.toContain("bg-ink");
				cleanup();
			}
		}
	});
});

describe("SideBadge — V10, the entry price", () => {
	it("yes-renders-its-entry-price-raw", () => {
		const { container } = render(
			<SideBadge side="YES" price="0.270000000000000000" />,
		);
		expect(container.firstElementChild?.textContent).toBe("YES @ 27%");
	});

	it("no-renders-its-entry-price-RAW-never-a-derived-complement", () => {
		// The load-bearing assertion of V10, and it points the OPPOSITE way to the
		// first draft of this file. `bets.price_at_bet` stores
		// `computeBuy(...).pEff` for the side BOUGHT (bets/place.ts:162 ->
		// cpmm/calculate.ts:73-97, `a = reserves[side]`), so a NO bet ALREADY
		// stores the NO price. Deriving `100 - x` here would print `NO @ 73%` for
		// an author who entered NO at 27% — a factually false figure attributed to
		// a named pseudonym on a public surface, and one that disagrees with the
		// .md export rendering the same field raw (debate-export/serialize.ts:320).
		const { container } = render(
			<SideBadge side="NO" price="0.270000000000000000" />,
		);
		expect(container.firstElementChild?.textContent).toBe("NO @ 27%");
	});

	it("both-poles-render-the-same-stored-value-identically", () => {
		// The side selects the POLE COLOUR, never the number. Two bets that
		// executed at the same effective price read the same, whichever side they
		// were on.
		const P = "0.525000000000000000";
		const { container: yes } = render(<SideBadge side="YES" price={P} />);
		expect(yes.firstElementChild?.textContent).toBe("YES @ 53%");
		cleanup();
		const { container: no } = render(<SideBadge side="NO" price={P} />);
		expect(no.firstElementChild?.textContent).toBe("NO @ 53%");
	});

	it("aria-label-carries-the-side-and-the-price", () => {
		const { container } = render(
			<SideBadge side="YES" price="0.270000000000000000" />,
		);
		expect(container.firstElementChild?.getAttribute("aria-label")).toBe(
			"YES side, entry price 27%",
		);
	});

	it("absent-price-renders-the-bare-side", () => {
		// Sites 7-9 (DebateColumn, BetComposer, SellModule) have no entry price in
		// existence; a required prop would force them to invent one.
		const { container } = render(<SideBadge side="YES" />);
		expect(container.firstElementChild?.textContent).toBe("YES");
		expect(container.firstElementChild?.textContent).not.toContain("@");
	});
});

describe("SideBadge — V11, the Discovery hero geometry", () => {
	it("hero-applies-the-sidechip-md-numbers", () => {
		// `.sidechip.md` — 9px / 2px 7px / .06em / 800 (mockup :115-116).
		const { container } = render(<SideBadge side="YES" size="hero" />);
		const cls = container.firstElementChild?.getAttribute("class") ?? "";
		expect(cls).toContain("text-[9px]");
		expect(cls).toContain("px-[7px]");
		expect(cls).toContain("py-[2px]");
		expect(cls).toContain("tracking-[0.06em]");
		expect(cls).toContain("font-extrabold");
		expect(cls).toContain("rounded-[var(--r)]");
	});

	it("hero-does-not-leak-into-the-default", () => {
		const { container } = render(<SideBadge side="YES" />);
		const cls = container.firstElementChild?.getAttribute("class") ?? "";
		expect(cls).not.toContain("text-[9px]");
		expect(cls).not.toContain("px-[7px]");
		expect(cls).toContain("text-[10px]");
	});

	it("the-hairline-edge-survives-in-both-geometries", () => {
		// Without it the black YES fill is invisible on the n0 card
		// (values-log v0_3 §3).
		for (const size of [undefined, "hero" as const]) {
			const { container } = render(<SideBadge side="YES" size={size} />);
			expect(container.firstElementChild?.getAttribute("class")).toContain(
				"[border:var(--hairline)]",
			);
			cleanup();
		}
	});
});

/**
 * PRIMITIVES-2 D5/D6 — the two seam presets.
 *
 * ⚠ THESE TESTS ARE THE ONLY COVERAGE THESE PRESETS HAVE. Zero call sites wire
 * them by design: the seam lands at this primitive, the adoption is POLISH.3's
 * (`detail`) and POLISH.5's (`profile`). No consumer render exercises them, so
 * nothing else in the suite would notice a wrong value.
 *
 * Asserted as the FLATTENED CASCADE, property by property, because that is the
 * failure mode: the mockups are cascading CSS and this component has none, so a
 * property the modifier inherits from its base is silently dropped unless it is
 * written out. `font-extrabold` is the sharp edge — omit it and the chip lands
 * on shadcn's `font-medium` (500) instead of the mockups' 800, which no
 * geometry assertion would catch.
 */
const PRESETS = [
	{
		size: "detail" as const,
		// surface_d5_v1_0.html — :540 modifier, :538 base, :742 grouped radius.
		expected: [
			"rounded-[var(--r)]",
			"px-[9px]",
			"py-[3px]",
			"text-[10px]",
			"font-extrabold",
			"tracking-[0.1em]",
			"[border:var(--hairline)]",
		],
	},
	{
		size: "profile" as const,
		// surface_profile_v1_0.html — :279 modifier, :278 base.
		expected: [
			"rounded-[var(--r)]",
			"px-[7px]",
			"py-[2px]",
			"text-[8.5px]",
			"font-extrabold",
			"tracking-[0.08em]",
			"[border:var(--hairline)]",
		],
	},
];

describe("SideBadge — the detail and profile seam presets", () => {
	it("each-preset-emits-its-full-flattened-cascade-at-both-poles", () => {
		for (const { size, expected } of PRESETS) {
			// BOTH POLES. A YES-only assertion passes on an inverted NO panel —
			// the mechanism by which the last inversion survived a full PR.
			for (const [side, pole] of [
				["YES", "bg-yes text-no"],
				["NO", "bg-no text-yes"],
			] as const) {
				const { container } = render(<SideBadge side={side} size={size} />);
				const cls = container.firstElementChild?.getAttribute("class") ?? "";
				for (const token of expected) {
					expect(cls).toContain(token);
				}
				expect(cls).toContain(pole);
				cleanup();
			}
		}
	});

	it("neither-preset-inherits-a-shadcn-default-it-was-meant-to-override", () => {
		// The flattening rule's teeth, asserted as ABSENCE. `badgeVariants` ships
		// `text-xs font-medium rounded-4xl px-2 py-0.5`; every one of those is a
		// property the mockup cascade sets, so each must be overridden. Class
		// ORDER puts the preset last, so a stale shadcn token surviving here means
		// the preset never declared its own.
		//
		// TWO of those five are asserted here, not all five: `text-xs`, `px-2`
		// and `py-0.5` are already pinned POSITIVELY by the preceding test, which
		// requires the preset's own `text-[…]`/`px-[…]`/`py-[…]` to be present.
		// `font-medium` and `rounded-4xl` are the two that `twMerge` does NOT
		// resolve away on its own, so absence is the only way to catch them.
		for (const { size } of PRESETS) {
			const { container } = render(<SideBadge side="YES" size={size} />);
			const tokens = (
				container.firstElementChild?.getAttribute("class") ?? ""
			).split(/\s+/);
			expect(tokens).not.toContain("font-medium");
			expect(tokens).not.toContain("rounded-4xl");
			cleanup();
		}
	});

	it("the-two-presets-are-distinct-and-neither-equals-hero-or-base", () => {
		// D6's stale-name trap, pinned as a property rather than as prose: four
		// presets that are meant to differ must actually differ. `detail` is d5's
		// `.md` at 10px and `hero` is Discovery's `.md` at 9px — the same mockup
		// class name, two different numbers, which is exactly why neither is
		// named `md`.
		const emitted = (["base", "hero", "detail", "profile"] as const).map(
			(size) => {
				const { container } = render(
					<SideBadge side="YES" size={size === "base" ? undefined : size} />,
				);
				const cls = container.firstElementChild?.getAttribute("class") ?? "";
				cleanup();
				return cls;
			},
		);
		expect(new Set(emitted).size).toBe(4);
	});

	it("detail-stays-unwired-and-profile-is-wired-only-where-ruled", () => {
		// D5, asserted rather than trusted. The seam lands here; the adoption is
		// POLISH.3's and POLISH.5's. If a later PR wires one, this reddens and the
		// wiring becomes a DECISION — the same mechanism as `PERMITTED_FILES`.
		//
		// ⚠ SPLIT ON 2026-08-14, DELIBERATELY, RATHER THAN RELAXED. POLISH.5
		// item 2 wired `profile` at `ArgumentList.tsx:49`/`:59` (PD-5-01, tier-4
		// baseline `surface_profile_v1_0.html:278-279`) and this assertion is
		// what forced that adoption to be ruled instead of absorbed — POLISH.5
		// §5 row 19, ratified 2026-08-14.
		//
		// ⛔ `detail` IS NOT UNPINNED. A blanket amendment would have spent
		// POLISH.3's gate for free; POLISH.3 PR 2 must hit this same wall and
		// get its OWN ruling. So `detail` keeps its zero and only `profile`
		// moves to an enumerated set — the guard still has teeth in both
		// directions: a THIRD surface wiring `profile` reddens the map below.
		// ⚠⚠ THE ZERO IS SPENT — HTML-FINISH · MARKET DETAIL row 13, ruled at the
		// plan (§4: "wire `size='detail'` at exactly ONE site — the post-focus
		// author row"). The wall this block predicted for POLISH.3 was finally hit
		// by MARKET DETAIL, and the adoption is RULED and enumerated here rather
		// than absorbed.
		//
		// ⛔⛔ AND THE WIRING ARRIVED THROUGH A CHANNEL THIS FILTER COULD NOT SEE,
		// which is the finding worth more than the row. `ArgProfile` owns the
		// badge and varies it by PROP — `<SideBadge size={chipSize} />` — so the
		// literal `detail` lives on `ArgProfile`'s OWN call site
		// (`chipSize="detail"`), not on any `<SideBadge>` tag. The regex below
		// scans `<SideBadge …/>` markup only, so it would have returned `[]` and
		// stayed GREEN while a `detail` chip shipped. Satisfying the letter of a
		// guard while breaking the property it names is not a pass.
		// ⇒ The census now scans BOTH channels. `wiredDetail` keeps the direct
		// one; `wiredDetailIndirect` is the prop channel, enumerated to its one
		// ruled site. A SECOND site in either reddens this.
		const wiredDetail = sideBadgeSites.filter((site) =>
			/size\s*=\s*["{]?\s*["']?detail/.test(site.markup),
		);
		expect(wiredDetail).toEqual([]);

		const wiredDetailIndirect = readdirSync(join(ROOT, "src"), {
			recursive: true,
			withFileTypes: true,
		})
			.filter((e) => e.isFile() && /\.tsx?$/.test(e.name))
			.map((e) => ({
				file: relative(ROOT, join(e.parentPath, e.name)),
				source: readFileSync(join(e.parentPath, e.name), "utf8"),
			}))
			.filter(({ source }) =>
				/chipSize\s*=\s*["{]?\s*["']?detail/.test(source),
			);
		expect(countByFile(wiredDetailIndirect)).toEqual({
			"src/components/debate/PostFocusHeader.tsx": 1,
		});

		const wiredProfile = sideBadgeSites.filter((site) =>
			/size\s*=\s*["{]?\s*["']?profile/.test(site.markup),
		);
		expect(countByFile(wiredProfile)).toEqual({
			"src/components/bookmarks/BookmarkCard.tsx": 2,
			"src/components/profile/ArgumentList.tsx": 2,
		});
	});
});
