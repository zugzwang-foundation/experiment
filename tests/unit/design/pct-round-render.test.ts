import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Static regression guard (PCT.ROUND / SPEC.1 §10.8): every market PRICE
// rendered to a user as a whole percent goes through the paired formatter
// `formatPricePercent(pricing, side)`, so a market's two sides always sum to
// exactly 100. The single-side hatch `formatPercentUnpaired` is allowlisted by
// `pctround-allow:` marker at an EXACT count, so it cannot silently multiply.
//
// Modelled on tests/unit/design/no-raw-dharma-render.test.ts, with two
// deliberate differences:
//   (i)  it ALSO scans `src/server/debate-export` — the ADR-0025 `.md` export
//        is a percent call site, and the DROUND guard does not scan it. That
//        omission was a real gap for this rule, not a stylistic one.
//   (ii) it allowlists EXACTLY TWO lines (the price chart's opening and current
//        YES readouts — two points in TIME, not a pair), where DROUND's guard
//        allowlists exactly one.
//
// It also forbids the FLOAT-percent idiom `Math.round(Number(…) * 100)`, which
// is how the deleted seventh call site (`chart/geometry.ts` `fmtPct`, minted at
// UI.19 slice 1) computed a percent — float math on a price, which that
// module's own docblock forbids (CLAUDE.md §2). This stops it being reborn.

const ROOT = process.cwd();
const SCAN_DIRS = [
	"src/components",
	"src/app/(public)",
	"src/app/(admin)",
	"src/server/debate-export",
];

// The formatter module DEFINES and documents both names — scanning it for them
// is noise, not a leak.
const FORMATTER_MODULE = "src/components/debate/format.ts";

// The number of legitimately single-side price readouts in the tree. Two live
// in `chart/MarketPriceChartCard.tsx` (the OPENING and CURRENT YES prices — two
// points in TIME, not a pair). This is an EXACT count on purpose: a third one
// must be argued for, not merely added.
//
// The THIRD, argued (DISCOVERY-COMPLETE C3): `debate/badges.tsx` renders a
// post's ENTRY PRICE on the side chip. It qualifies for the hatch on the same
// grounds as the other two — it is a single historical value for ONE bet, a
// point in time, not one half of a live pair. It must also be rendered RAW:
// `bets.price_at_bet` stores `computeBuy(...).pEff` for the side BOUGHT
// (bets/place.ts:162 -> cpmm/calculate.ts:73-97, where `a = reserves[side]`),
// so a NO bet already stores the NO price. Routing it through the PAIRED
// `formatPricePercent` would derive `100 - x` from an already-side-scoped
// number and print `NO @ 45%` for an author who entered NO at 55%. That is
// exactly what this guard's exact count exists to force an argument about.
//
// THE FOURTH AND FIFTH, argued (POLISH.3 PR 2 row 8, commit C12, under founder
// ruling R-3 of 2026-08-16): `debate/chart/MarketPriceChartOverlay.tsx` renders
// the SPEC.1 §9 accessible summary the expanded chart lacked — a tier-1
// conformance gap (`PD-3-04`). It names the OPENING and the CURRENT YES price,
// which is the SAME pair of readouts, on the same grounds, as the two in
// `MarketPriceChartCard.tsx`: two points in TIME, not one half of a live pair.
// ⇒ TWO markers, not one, because the summary names two figures.
//
// Routing them through the PAIRED `formatPricePercent` was considered and is
// WRONG for the same reason it is wrong for the card — it would derive `100 - x`
// from a value that is already a single-side price at an instant.
//
// R-3's three conditions, each checked rather than asserted:
//   (1) the OFFENDER PREDICATE passes — verified BEFORE this count moved: the
//       run failed ONLY at `expect(markers).toHaveLength(…)` while
//       `expect(offenders).toEqual([])` on the line above passed. Both new call
//       sites carry a `pctround-allow:` marker; the code was correct and only
//       the census was stale.
//   (2) the addition is NAMED — R-3 names this file explicitly as one of the
//       two it rules on.
//   (3) it lands in the SAME COMMIT as the code that makes it necessary.
// ⛔ THE PLAN WIDENS THE CENSUS, NEVER THE PREDICATE. `UNPAIRED_CALL`,
// `ALLOW_MARKER`, `FLOAT_PERCENT`, `SCAN_DIRS`, the liveness floor and
// `expect(offenders).toEqual([])` are all UNTOUCHED.
const EXPECTED_ALLOW_MARKERS = 5;

const UNPAIRED_CALL = /formatPercentUnpaired\s*\(/;
const ALLOW_MARKER = /pctround-allow:/;

// `Math.round(Number(x) * 100)` — float math on a price. Deliberately keyed on
// `Number(` so it does NOT match the legitimate 2-dp COORDINATE rounders
// (`Math.round(v * 100) / 100`) in the chart / sparkline geometry modules.
const FLOAT_PERCENT = /Math\.round\s*\(\s*Number\s*\(/;

function sourceFilesUnder(dir: string): string[] {
	return readdirSync(join(ROOT, dir), { recursive: true, withFileTypes: true })
		.filter(
			(e) => e.isFile() && (e.name.endsWith(".ts") || e.name.endsWith(".tsx")),
		)
		.map((e) => join(e.parentPath, e.name));
}

const files = SCAN_DIRS.flatMap(sourceFilesUnder);

describe("view layer — price percents are paired, hatch is allowlisted (PCT.ROUND)", () => {
	it("scans a non-empty file set (guard is alive)", () => {
		// Liveness: a broken glob must fail loudly, not pass vacuously.
		expect(files.length).toBeGreaterThan(20);
	});

	it("uses formatPercentUnpaired only at the exact allowlisted single-side readouts", () => {
		const markers: string[] = [];
		const offenders: string[] = [];
		for (const file of files) {
			if (file.endsWith(FORMATTER_MODULE)) {
				continue;
			}
			const lines = readFileSync(file, "utf8").split("\n");
			lines.forEach((line, i) => {
				if (ALLOW_MARKER.test(line)) {
					markers.push(`${file.replace(`${ROOT}/`, "")}:${i + 1}`);
				}
				if (UNPAIRED_CALL.test(line)) {
					// Allowlisted iff a `pctround-allow:` marker sits in the preceding
					// lines (the marker annotates the statement it precedes).
					const window = lines.slice(Math.max(0, i - 5), i + 1).join("\n");
					if (!ALLOW_MARKER.test(window)) {
						offenders.push(`${file.replace(`${ROOT}/`, "")}:${i + 1}`);
					}
				}
			});
		}
		expect(offenders).toEqual([]);
		expect(markers).toHaveLength(EXPECTED_ALLOW_MARKERS);
	});

	it("computes no percent by float multiplication on a price", () => {
		const offenders = files
			.filter((file) => FLOAT_PERCENT.test(readFileSync(file, "utf8")))
			.map((file) => file.replace(`${ROOT}/`, ""));
		expect(offenders).toEqual([]);
	});
});
