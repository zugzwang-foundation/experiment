// SPDX-License-Identifier: AGPL-3.0-or-later

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * POLISH-1b B3 — the sticky header's STACKING CONTRACT.
 *
 * ADR-0023 §Patch 2026-08-03 makes the header sticky and states the
 * consequence: "a `z-index` is required, and every existing overlay must stack
 * above it." That is a whole-tree property — no single component can assert it,
 * and the failure is SILENT: an overlay that loses the stack renders *behind*
 * the header with no error, no type failure, and no test failure. So this
 * scans the source the way the design guards already do
 * (`no-raw-hex-view-layer.test.ts`).
 *
 * The rule: every DOCUMENT-LEVEL layer — anything `fixed` or a portalled dialog
 * — must DECLARE where it sits, and it may do so on exactly one of two sides. An
 * OVERLAY carries a z-index strictly GREATER than the header's. An UNDERLAY
 * carries a NEGATIVE tier, which puts it on the far side of the in-flow content
 * where the header cannot be reached at all. Declaring neither is the silent
 * failure this file exists to catch; declaring both is a layer that has stopped
 * saying which it is. A nested `z-10` inside an already-positioned parent (the
 * avatar badge, each overlay's own inner panel) is a LOCAL stacking context and
 * cannot compete with the header, so those are excluded by requiring `fixed` on
 * the same element.
 *
 * ⚠ THE UNDERLAY SIDE IS A WARLI-MOUNT AMENDMENT, AND IT IS A WIDENING OF THE
 * RULE'S SUBJECT RATHER THAN A WEAKENING OF ITS CLAIM. Until the art layer was
 * mounted, every `fixed` node in this tree was something that covers the page,
 * so "fixed" and "overlay" were the same set and the rule could name either.
 * They are not the same set any more. The overlay branch below is unchanged in
 * intent and still fires on a fixed layer with no tier or with a positive tier
 * at or below the header's — both proved by positive controls in the same test.
 *
 * If the OVERLAY branch fails, do NOT raise the overlay to match. Either the
 * header's tier moved (it should not — 20/30 are free precisely so it never
 * needs to) or a new overlay landed below it and needs its own tier above.
 * If the UNDERLAY branch fails, the answer is almost never a negative tier:
 * ask first whether the layer is really meant to sit beneath the whole page.
 */

const ROOT = process.cwd();
const HEADER_FILE = "src/components/shell/GlobalHeader.tsx";

/**
 * Tailwind `z-<n>`. The `(?<!-)` matters: `-` is a non-word character, so a
 * bare `\bz-` boundary also matches the NEGATIVE utility `-z-10` and would
 * read it as tier 10 — inverting the very comparison this file exists to make.
 */
const Z = /(?<!-)\bz-(\d+)\b/g;

/**
 * Tailwind's NEGATIVE z utility, `-z-<n>`, as a class TOKEN.
 *
 * ⚠ WARLI-MOUNT — THIS EXISTS BECAUSE `fixed` STOPPED MEANING "OVERLAY". Every
 * document-level `fixed` layer in this tree used to be something that covers the
 * page: a chart overlay, a dialog. The art layer is the first that is fixed in
 * order to sit UNDER everything — it is the window the auth card floats in — and
 * the rule above, read literally, demanded it stack above the header, which
 * would put a 1440 × 1000 drawing on top of the sign-in form.
 *
 * ⛔ AND A NEGATIVE TIER IS NOT MERELY A SMALLER NUMBER. It is on the other side
 * of the in-flow content: CSS paints negative-z descendants of a stacking
 * context BEFORE that context's in-flow boxes, and the header is a positioned
 * box painted after them. There is no z value the header could take that an
 * underlay could out-rank, so "strictly above the header" is not a weaker claim
 * here — it is an inapplicable one. That is why this is a second branch and not
 * an exemption list.
 */
const UNDERLAY_TOKEN = /(^|:)-z-(\d+)$/;
const underlayTiers = (classes: string): number[] =>
	classes
		.split(/\s+/)
		.map((c) => UNDERLAY_TOKEN.exec(c))
		.filter((m): m is RegExpExecArray => m !== null)
		.map((m) => Number(m[2]));

/**
 * Directories that can hold a document-level layer. `src/app` is included
 * because a route file could mount one directly (a freeze notice, a cookie
 * banner) — and since WARLI-MOUNT one does: `(auth)/layout.tsx` mounts the art
 * layer there. This stopped being a latch and became load-bearing; drop
 * `src/app` from the scan and the only underlay in the tree goes unseen.
 */
const SCAN_DIRS = ["src/components", "src/app"];

function walk(dir: string, out: string[] = []): string[] {
	for (const entry of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
		const rel = `${dir}/${entry.name}`;
		if (entry.isDirectory()) walk(rel, out);
		else if (/\.tsx$/.test(entry.name)) out.push(rel);
	}
	return out;
}

function headerZ(): number {
	const src = readFileSync(join(ROOT, HEADER_FILE), "utf8");
	const header = src.match(/<header className="([^"]+)"/);
	expect(
		header,
		"GlobalHeader renders a <header> with a class string",
	).not.toBeNull();
	const z = header?.[1].match(/\bz-(\d+)\b/);
	expect(z, "the header declares a z-index tier").not.toBeNull();
	return Number(z?.[1]);
}

/**
 * Every className string on an element that is also `fixed`.
 *
 * MUST match the `cn("…", className)` form, not just a bare literal: every
 * shadcn primitive is written that way, including `ui/dialog.tsx`, whose
 * overlay and content ARE two of the overlays this guard claims to cover. An
 * earlier draft matched only `"…"` and `{"…"}` and so saw two of the four
 * overlay layers while reporting itself healthy (@code-reviewer, POLISH-1b H3).
 *
 * ⚠⚠ PROFILE-FULL — THE DETECTOR IS TOKEN-SCOPED NOW, AND THIS IS A FALSE-POSITIVE
 * FIX, NOT A RELAXATION. It tested `/\bfixed\b/` against the whole class STRING,
 * and `-` is a word boundary — so Tailwind's `table-fixed`, a `table-layout`
 * utility with no positioning behaviour whatsoever, registered as a
 * document-level overlay. It fired the moment the positions table took the
 * mockup's fixed column track, reporting "declares a z-index on its fixed layer:
 * expected 0 to be greater than 0" about a `<table>`.
 * ⇒ The predicate now matches a CLASS TOKEN that IS the positioning utility —
 * exactly `fixed`, or a variant-prefixed `…:fixed` — so `md:fixed` and
 * `group-hover:fixed` still count and `table-fixed` / `inset-fixed` do not.
 * ⛔ IT IS STRICTLY MORE PRECISE. Nothing that was a real overlay stops being
 * one: `EXPECTED_OVERLAY_FILES` below is unchanged and still pinned, so a regex
 * that lost a genuine layer would fail rather than pass on a smaller set — which
 * is the check that makes this tightening safe to make at all.
 */
const FIXED_TOKEN = /(^|:)fixed$/;
const hasFixedToken = (classes: string): boolean =>
	classes.split(/\s+/).some((c) => FIXED_TOKEN.test(c));
function fixedOverlayClassStrings(): { file: string; classes: string }[] {
	const found: { file: string; classes: string }[] = [];
	for (const dir of SCAN_DIRS) {
		for (const file of walk(dir)) {
			const src = readFileSync(join(ROOT, file), "utf8");
			// `className="…"` · `className={"…"}` · `className={cn("…", …)}`
			for (const m of src.matchAll(
				/className=(?:"([^"]+)"|\{\s*(?:cn\(\s*)?"([^"]+)")/g,
			)) {
				const classes = m[1] ?? m[2] ?? "";
				if (hasFixedToken(classes)) found.push({ file, classes });
			}
		}
	}
	return found;
}

/**
 * The overlay layers this guard is known to cover, by file. Pinned so a regex
 * that silently stops matching one of them FAILS rather than going quietly
 * green on a smaller set — partial scan degradation is the failure mode the
 * count-based guard below cannot see.
 */
const EXPECTED_OVERLAY_FILES = [
	"src/components/debate/chart/MarketPriceChartOverlay.tsx",
	// UNWIRE-1 — `profile/graph/ProfileGraphOverlay.tsx` deleted whole (Profile
	// Dharma graph unwired); no replacement entry.
	"src/components/ui/dialog.tsx",
];

/**
 * The UNDERLAY layers, pinned by name for the same reason the overlays are.
 *
 * WARLI-MOUNT — `src/app/(auth)/layout.tsx` mounts the art layer as a
 * full-viewport `fixed` node at `-z-10`. Pinned here so that unmounting it, or a
 * scan that quietly stops reaching `src/app`, FAILS rather than leaving the
 * underlay branch below with nothing to exercise — an unexercised branch is
 * indistinguishable from a correct one.
 */
const EXPECTED_UNDERLAY_FILES = ["src/app/(auth)/layout.tsx"];

describe("B3 — the header is sticky and every fixed layer declares its side", () => {
	it("header-is-sticky-in-flow-at-the-top", () => {
		const src = readFileSync(join(ROOT, HEADER_FILE), "utf8");
		const classes = src.match(/<header className="([^"]+)"/)?.[1] ?? "";
		// sticky, NOT fixed — fixed would drop the header out of flow and force
		// offset compensation on everything below (ADR-0023 §Patch, Mechanism).
		expect(classes).toContain("sticky");
		// ⚠ THE SAME TOKEN PREDICATE the scan uses, not a substring test: a
		// `toContain("fixed")` here would fire on `table-fixed` too, which is the
		// false positive fixed above. The claim is that the header is not
		// POSITIONED fixed.
		expect(hasFixedToken(classes)).toBe(false);
		expect(classes).toContain("top-0");
		// Opaque fill is load-bearing once content passes beneath.
		expect(classes).toContain("bg-n0");
	});

	it("header-sits-on-its-reserved-z-40-tier", () => {
		expect(headerZ()).toBe(40);
	});

	it("the-scan-still-reaches-every-known-overlay-layer", () => {
		// GUARD THE GUARD, by NAME not by count. A count check catches a scan
		// that breaks completely; it cannot catch one that quietly stops matching
		// a single file — and the last regression here did exactly that, dropping
		// ui/dialog.tsx while staying green.
		const seen = new Set(fixedOverlayClassStrings().map((o) => o.file));
		for (const file of EXPECTED_OVERLAY_FILES) {
			expect(seen.has(file), `scan reaches ${file}`).toBe(true);
		}
	});

	it("the-scan-still-reaches-every-known-underlay-layer", () => {
		// Same guard-the-guard as the overlay row above, and it earns its keep
		// harder: there is exactly ONE underlay, so a scan that lost it would
		// leave the negative branch below iterating an empty set and passing.
		const seen = new Set(fixedOverlayClassStrings().map((o) => o.file));
		for (const file of EXPECTED_UNDERLAY_FILES) {
			expect(seen.has(file), `scan reaches ${file}`).toBe(true);
		}
	});

	it("every-fixed-overlay-stacks-strictly-above-the-header", () => {
		const overlays = fixedOverlayClassStrings();
		// Guard the guard: if the scan finds nothing, it is broken, not clean.
		expect(overlays.length).toBeGreaterThan(0);

		// POSITIVE CONTROLS for the two-branch split, on synthetic strings, so the
		// widening is proved to reject what it must still reject. Without these,
		// "or it may be an underlay" is an escape hatch that nothing tests.
		expect(underlayTiers("fixed inset-0"), "no tier at all").toEqual([]);
		expect(
			[..."fixed inset-0 z-10".matchAll(Z)].length,
			"a positive tier is still read as an overlay tier",
		).toBe(1);
		expect(underlayTiers("fixed inset-0 -z-10")).toEqual([10]);
		expect(underlayTiers("fixed inset-0 md:-z-20")).toEqual([20]);
		// `-z-10` must NOT read as the positive tier 10 — the whole point of Z's
		// lookbehind, restated here because this branch depends on it.
		expect([..."fixed -z-10".matchAll(Z)].length).toBe(0);

		const header = headerZ();
		for (const { file, classes } of overlays) {
			const under = underlayTiers(classes);
			const over = [...classes.matchAll(Z)].map((m) => Number(m[1]));

			// UNCHANGED CLAIM: a document-level fixed layer must DECLARE where it
			// sits. Silence is the failure this file was written for.
			expect(
				under.length + over.length,
				`${file} declares a z-index on its fixed layer`,
			).toBeGreaterThan(0);

			// ⛔ AND IT MUST PICK A SIDE. `-z-10 z-50` on one element is a layer
			// claiming to be both under and over; the cascade resolves it to one of
			// them and the source stops saying which. Rejecting it is what keeps
			// the underlay branch from being a way to smuggle an unranked overlay
			// past the loop below.
			expect(
				under.length === 0 || over.length === 0,
				`${file} declares BOTH an underlay (-z-${under[0]}) and an overlay (z-${over[0]}) tier`,
			).toBe(true);

			// Overlays: the original rule, byte-for-byte in its intent.
			for (const tier of over) {
				expect(
					tier,
					`${file} (z-${tier}) must stack above header z-${header}`,
				).toBeGreaterThan(header);
			}
		}
	});

	it("leaves-tiers-20-and-30-free-between-header-and-overlays", () => {
		// Headroom is the point: a future intermediate layer gets a tier without
		// disturbing either end.
		const overlays = fixedOverlayClassStrings();
		// Not independently vacuous: on an empty scan `used` would be empty,
		// `has(20)`/`has(30)` both false and `Math.min()` Infinity, so all three
		// assertions below would pass on a completely broken scan.
		expect(overlays.length).toBeGreaterThan(0);

		const used = new Set(
			overlays.flatMap(({ classes }) =>
				[...classes.matchAll(Z)].map((m) => Number(m[1])),
			),
		);
		expect(used.size).toBeGreaterThan(0);
		expect(used.has(20)).toBe(false);
		expect(used.has(30)).toBe(false);
		expect(headerZ()).toBeLessThan(Math.min(...used));
	});
});
