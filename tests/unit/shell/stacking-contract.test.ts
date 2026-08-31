// SPDX-License-Identifier: AGPL-3.0-or-later

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
	anyOverlayTiers,
	anyUnderlayTiers,
	FIXED_TOKEN,
	overlayTiers,
	underlayTiers,
} from "./_stacking-predicates";

/**
 * WARLI-MOUNT · @test-writer audit — IS THE WIDENED STACKING RULE FALSIFIABLE?
 *
 * `tests/unit/shell/sticky-header.test.ts` grew a second branch at WARLI-MOUNT:
 * a document-level `fixed` layer may now declare EITHER an overlay tier above
 * the header OR a negative underlay tier, and must declare exactly one. The
 * widening is right — a negative tier really is on the far side of the in-flow
 * content, so "stack above the header" is inapplicable to it rather than merely
 * unmet.
 *
 * ⛔ BUT THE RULE ITSELF IS NEVER EXERCISED IN ITS FAILING DIRECTION BY ANYTHING
 * IN THE REPOSITORY, AND THIS FILE IS WHY THAT MATTERS. The guard's loop runs
 * over four real class strings, all of which pass. Its synthetic controls
 * exercise the two HELPERS (`underlayTiers`, `Z`) on their own, never the rule
 * they compose into. Measured by mutation, with the whole guard file re-run
 * after each:
 *
 *   · `under.length === 0 || over.length === 0`  →  `true`         GREEN
 *   · `.toBeGreaterThan(header)`                 →  `(-1)`         GREEN
 *   · `.toBeGreaterThan(0)` on the tier count    →  `(-1)`         GREEN
 *   · `UNDERLAY_TOKEN` anchors dropped           →  `/(-z-)(\d+)/` GREEN
 *
 * Four separate ways to delete the guard's claim, four greens. A rule whose
 * rejections are proved only by hand-mutating `src/` is a fine REGRESSION test
 * and cannot catch the thing actually feared here — a guard quietly widened
 * until it stops catching anything. So the rejections are asserted directly,
 * against synthetic class strings, using the guard's own lifted predicates.
 *
 * ⚠ THE PREDICATES ARE LIFTED, NEVER RETYPED — same reason as
 * `tests/unit/art/mount-scan-reach.test.ts`. A copy drifts and then certifies a
 * pattern nobody ships.
 */

const ROOT = process.cwd();
const HEADER_FILE = "src/components/shell/GlobalHeader.tsx";
const MOUNT_FILE = "src/app/(auth)/layout.tsx";

/**
 * ⛔ THE PREDICATES ARE IMPORTED, NOT LIFTED, AND THE LIFT IS WHY. This file
 * originally pulled the guard's regex literals out of its source TEXT and then
 * re-implemented the surrounding logic locally. That held until the logic
 * changed: the `-z-0` filter and the variant-anchoring landed in the guard, this
 * file kept running the old shape, and three of its rows certified a rule nobody
 * ships — inside one session, which is exactly the drift its own docblock warns
 * about. Both files now import the single definition in
 * `./_stacking-predicates`, so a change to the rule reaches the audit by
 * construction instead of by remembering.
 */
function headerZ(): number {
	const src = readFileSync(join(ROOT, HEADER_FILE), "utf8");
	const z = src.match(/<header className="([^"]+)"/)?.[1]?.match(/\bz-(\d+)\b/);
	if (!z) throw new Error(`${HEADER_FILE} declares no header z tier`);
	return Number(z[1]);
}

const HEADER = headerZ();

type Verdict = "accepted" | "no-tier" | "both-sides" | "not-above-header";

/**
 * The guard's rule, recomposed from its own predicates — the three assertions
 * inside its loop, in order, expressed as a value instead of as expectations so
 * a rejection can be asserted rather than merely observed.
 */
function verdict(classes: string): Verdict {
	// ⚠ TWO PAIRS, IN THE SAME ORDER THE GUARD'S LOOP USES THEM. The UNPREFIXED
	// tiers answer "did it declare a side" and "is that side above the header",
	// because a variant-scoped tier leaves the element unranked at the widths the
	// variant does not cover. The variant-INCLUSIVE pair answers "did it declare
	// both", because `-z-10 md:z-50` really is an underlay below `md` and an
	// overlay above it — calling that an underlay would wave through the exact
	// ambiguity the both-sides rejection exists to catch.
	const under = underlayTiers(classes);
	const over = overlayTiers(classes);
	if (
		anyUnderlayTiers(classes).length > 0 &&
		anyOverlayTiers(classes).length > 0
	)
		return "both-sides";
	if (under.length + over.length === 0) return "no-tier";
	if (over.some((t) => !(t > HEADER))) return "not-above-header";
	return "accepted";
}

describe("stacking-contract — the recomposed rule is the shipped one", () => {
	it("stacking-contract::agrees-with-the-guard-on-every-live-layer", () => {
		// If this file's `verdict()` drifted from the guard's loop, every
		// rejection below would be about a rule nobody runs. The four real fixed
		// layers in the tree all pass the guard today, so all four must be
		// "accepted" here.
		expect(HEADER).toBe(40);
		expect(FIXED_TOKEN.test("fixed")).toBe(true);
		expect(FIXED_TOKEN.test("table-fixed")).toBe(false);
		for (const live of [
			"pointer-events-none fixed inset-0 -z-10 grid place-items-center",
			"fixed inset-0 z-50 flex items-center justify-center",
			"fixed inset-0 z-50 bg-(--overlay) data-[state=open]:animate-in",
			"fixed top-1/2 left-1/2 z-50 grid w-full max-w-lg -translate-x-1/2",
		]) {
			expect(verdict(live), live).toBe("accepted");
		}
	});
});

describe("stacking-contract — the rejections the guard claims but never runs", () => {
	it("stacking-contract::rejects-a-fixed-layer-that-declares-no-tier", () => {
		// The original claim, and the one direction the operator could prove by
		// mutating the real mount. Asserted here so it survives a change to the
		// mount as well.
		expect(verdict("pointer-events-none fixed inset-0")).toBe("no-tier");
		expect(verdict("fixed inset-0 grid place-items-center")).toBe("no-tier");
	});

	it("stacking-contract::rejects-a-positive-tier-at-or-below-the-header", () => {
		expect(verdict("fixed inset-0 z-10")).toBe("not-above-header");
		expect(verdict("fixed inset-0 z-30")).toBe("not-above-header");
		expect(verdict(`fixed inset-0 z-${HEADER}`)).toBe("not-above-header");
		// v4's trailing important modifier does not launder an under-ranked tier.
		expect(verdict("fixed inset-0 z-10!")).toBe("not-above-header");
	});

	it("stacking-contract::rejects-a-layer-that-declares-both-sides", () => {
		// ⛔ THE ASSERTION WITH NO CONTROL AT ALL. Replacing the guard's
		// `under.length === 0 || over.length === 0` with a literal `true` leaves
		// its whole file green — measured. This is the row that makes the newest
		// and least-exercised half of the rule falsifiable, and it matters most
		// because "or it may be an underlay" is otherwise a clause anything can
		// hide behind: `-z-10` next to a positive tier reads as an underlay
		// declaration while the cascade resolves the element to the positive one.
		expect(verdict("fixed inset-0 -z-10 z-30")).toBe("both-sides");
		expect(verdict("fixed inset-0 z-50 -z-10")).toBe("both-sides");
		expect(verdict("fixed inset-0 -z-10 md:z-50")).toBe("both-sides");
	});

	it("stacking-contract::accepts-exactly-the-two-legal-shapes", () => {
		// The other half: a rule that rejected everything would satisfy every row
		// above and be just as useless.
		expect(verdict("pointer-events-none fixed inset-0 -z-10")).toBe("accepted");
		expect(verdict("fixed inset-0 z-50")).toBe("accepted");
		expect(verdict("fixed inset-0 z-50!")).toBe("accepted");
	});

	it("stacking-contract::fails-closed-on-arbitrary-and-important-syntax", () => {
		// ⚠ THESE ARE FALSE POSITIVES AND THAT IS THE POINT. Every one of them is
		// a perfectly good layer that the guard will refuse:
		//
		//   compiled with the installed tailwindcss 4.2.4 —
		//     .-z-\[5\]  { z-index: calc(5 * -1) }            a real underlay
		//     .-z-10\!   { z-index: calc(10 * -1) !important } a real underlay
		//     .z-\[60\]  { z-index: 60 }                       a real overlay
		//
		// The guard reads no tier from any of them and reports "declares a
		// z-index on its fixed layer". A false RED is the safe direction: it
		// stops the layer at review instead of shipping it unranked. Pinned so
		// that a future "let's also accept arbitrary values" edit has to change a
		// stated expectation rather than silently flip the failure direction.
		for (const classes of [
			"fixed inset-0 -z-[5]",
			"fixed inset-0 z-[60]",
			"fixed inset-0 -z-10!",
			"fixed inset-0 !-z-10",
			"fixed inset-0 z-(--tier)",
		]) {
			expect(verdict(classes), classes).toBe("no-tier");
		}
	});

	it("stacking-contract::the-pinned-underlay-really-declares-an-underlay", () => {
		// ⚠ `EXPECTED_UNDERLAY_FILES` pins that the SCAN REACHES the mount file.
		// It does not pin that the file is an underlay — change the mount to
		// `fixed inset-0 z-50` and that row stays green, the main row passes, and
		// the underlay branch is left with nothing in the tree exercising it while
		// the guard's own docblock claims the pin prevents exactly that.
		const src = readFileSync(join(ROOT, MOUNT_FILE), "utf8");
		const classes = [
			...src.matchAll(/className=(?:"([^"]+)"|\{\s*(?:cn\(\s*)?"([^"]+)")/g),
		]
			.map((m) => m[1] ?? m[2] ?? "")
			.filter((c) => c.split(/\s+/).some((t) => FIXED_TOKEN.test(t)));
		expect(classes.length, `${MOUNT_FILE} has a fixed layer`).toBe(1);
		expect(
			underlayTiers(classes.join(" ")).length,
			`${MOUNT_FILE}'s fixed layer declares a NEGATIVE tier, so the underlay branch has something real to run against`,
		).toBeGreaterThan(0);
	});
});

describe("stacking-contract — layers that pass while being unranked", () => {
	/**
	 * ⛔ RED BY DESIGN. A tier that exists only under a variant leaves the BASE
	 * breakpoint with `z-index: auto` on a `fixed` element — which is exactly the
	 * silent failure ADR-0023 §Patch names, since paint order among positioned
	 * boxes then falls to DOM order and the header's `z-40` wins unconditionally.
	 * The guard asks whether a tier appears ANYWHERE in the class string, not
	 * whether one applies at every breakpoint, so all four of these pass.
	 *
	 * ⚠ THE OVERLAY HALF PREDATES WARLI-MOUNT — `md:z-50` passed the old rule too.
	 * The widening did not create this defect; it extended it symmetrically to the
	 * underlay side, where `md:-z-10` is newly accepted because the old rule would
	 * have rejected it for carrying no positive tier. Both halves are listed
	 * together because fixing one without the other would leave the rule saying
	 * two different things on its two sides.
	 */
	it("stacking-contract::rejects-a-tier-that-exists-only-under-a-variant", () => {
		for (const classes of [
			"fixed inset-0 md:-z-10",
			"fixed inset-0 dark:-z-10",
			"fixed inset-0 md:z-50",
			"fixed inset-0 hover:z-50",
		]) {
			expect(
				verdict(classes),
				`${classes} — unranked at the base breakpoint, where a fixed layer with z-index:auto is ordered by DOM position against the header`,
			).not.toBe("accepted");
		}
	});

	/**
	 * ⛔ RED BY DESIGN. `-z-0` is a well-formed Tailwind utility and it is NOT an
	 * underlay. Compiled with the installed tailwindcss 4.2.4:
	 *
	 *     .-z-0 { z-index: calc(0 * -1) }
	 *
	 * `-0` computes to `0`, which puts the fixed layer in the positive/zero band
	 * of the painting order — above the in-flow content it was written to sit
	 * beneath, and ranked against the header rather than exempt from it. The
	 * guard reads the digits and not the sign of the RESULT, so it accepts the one
	 * negative-looking tier that is not negative.
	 */
	it("stacking-contract::rejects--z-0-which-computes-to-zero", () => {
		expect(
			verdict("pointer-events-none fixed inset-0 -z-0"),
			"-z-0 compiles to z-index: calc(0 * -1) = 0 and is not an underlay",
		).not.toBe("accepted");
	});
});
