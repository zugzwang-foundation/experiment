import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { VIEWBOX_W, xPx } from "@/components/debate/chart/geometry";
import {
	MARKET_CHART_WINDOW_END,
	MARKET_CHART_WINDOW_START,
	resolveChartWindow,
} from "@/server/config/limits";

// CHART-3 — the constants layer for SPEC.1 1.0.48 §9's fixed experiment window.
//
// SPEC.1 §17 row proved here (in part):
//   debate-view::price-chart-axis-spans-fixed-window
//
// This file owns the NUMBERS and the ENV RESOLUTION. The render-side rule — that
// the axis is drawn from these and not from the series — is proved in
// `tests/unit/debate/render/price-chart.test.tsx`, which DERIVES its expectations
// from these constants rather than restating them. The split is deliberate: if
// both files derived, nothing would pin the values; if both restated, they would
// drift. One states, one derives.

const REPO_ROOT = join(__dirname, "..", "..", "..");

/** Source with comments removed, so a textual guard cannot be satisfied — or
 * defeated — by prose. ⚠ This repo has caught a negative source-scan matching
 * the COMMENT that explained the absence more than once; stripping first is the
 * cheap fix, and the positive control below proves the stripping did not simply
 * eat everything. */
function strippedSource(relPath: string): string {
	return readFileSync(join(REPO_ROOT, relPath), "utf8")
		.replace(/\/\*[\s\S]*?\*\//g, " ")
		.replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
}

/** Every TypeScript source file under `src/`, repo-relative with forward
 * slashes. Used by the scans below so their SELECTOR is a directory rather
 * than a hand-maintained list — a list is a thing a new file joins only if
 * someone remembers, which is the failure mode a negative assertion cannot
 * survive. */
function walkSrc(): string[] {
	return readdirSync(join(REPO_ROOT, "src"), { recursive: true })
		.map((entry) => `src/${String(entry).split("\\").join("/")}`)
		.filter((rel) => rel.endsWith(".ts") || rel.endsWith(".tsx"))
		.sort();
}

describe("chart-window::the production window is pinned to the experiment", () => {
	it("resolves the production window for prod and for every unrecognised value", () => {
		const PROD_START = "2026-09-15T00:00:00.000Z";
		const PROD_END = "2026-11-05T23:45:00.000Z";

		for (const env of [
			"prod",
			undefined,
			"unknown",
			"",
			"production",
			"STAGING",
		]) {
			const w = resolveChartWindow(env);
			expect(w.start, `env=${String(env)} start`).toBe(PROD_START);
			expect(w.end, `env=${String(env)} end`).toBe(PROD_END);
		}
	});

	it("ends at 23:45, the ratified resolution deadline — not 23:59", () => {
		// ⛔ The same instant is trading close and settlement. A 23:59 axis would
		// run fifteen minutes past the last instant at which anything can happen,
		// and the difference is invisible at chart resolution — which is exactly
		// why it needs an assertion rather than an eyeball.
		const end = new Date(resolveChartWindow("prod").end);
		expect(end.getUTCHours()).toBe(23);
		expect(end.getUTCMinutes()).toBe(45);
		expect(end.getUTCFullYear()).toBe(2026);
		expect(end.getUTCMonth()).toBe(10); // November, 0-indexed
		expect(end.getUTCDate()).toBe(5);
	});
});

describe("chart-window::staging and preview share the fixture window", () => {
	it("resolves the staging window for staging AND for preview", () => {
		// ⚠ `preview` takes the STAGING window because preview deployments read
		// the staging database. Given production's window a preview chart would
		// render as a line crushed against the left edge — broken-looking in the
		// exact surface used to review a chart change.
		// ⚠ CHART-6 — was 2026-08-21T00:00Z, measured from the earliest `bet.placed`.
		// CHART-4's backfilled `market.opened` seeds are four days earlier, and the
		// series starts from that seed, so the old value clipped the genesis point
		// of all eight markets. Now the earliest event of ANY type, floored.
		const STG_START = "2026-08-17T00:00:00.000Z";
		// ⚠ CHART-4 D11 — was 2026-09-10T23:45Z, now production's own end. The
		// start is still staging's (measured from its own data), so the two
		// windows share an end and differ only in where they begin.
		const STG_END = "2026-11-05T23:45:00.000Z";

		for (const env of ["staging", "preview"]) {
			const w = resolveChartWindow(env);
			expect(w.start, `env=${env} start`).toBe(STG_START);
			expect(w.end, `env=${env} end`).toBe(STG_END);
		}
	});

	it("the PRODUCTION window contains every ratified market's resolution deadline", () => {
		// ⛔ THE STAGING ARM IS TIED TO ITS DATA TWO TESTS DOWN; THE PRODUCTION ARM
		// WAS TIED ONLY TO ITS OWN LITERALS. `2026-11-05T23:45:00Z` is the ratified
		// `resolution_deadline` shared by all eight markets — but "shared by all
		// eight" was an assertion in a docblock, not a measurement, and SPEC.1 §9
		// explicitly permits a market to carry `23:59` instead.
		//
		// A market whose deadline sat past this constant would trade its final
		// minutes off the right of the axis, with its terminal dot clipped out of
		// the viewBox entirely — the market's most consequential moments, drawn
		// nowhere, on the surface where stake is committed. Silent, because a
		// clipped dot looks like a chart that simply ends.
		const snapshot: {
			markets: { slug: string; resolution_deadline: string }[];
		} = JSON.parse(
			readFileSync(
				join(REPO_ROOT, "docs/data/staging-markets-snapshot.json"),
				"utf8",
			),
		);
		const slate = snapshot.markets;

		// Non-vacuity: the slate was read, and it is the slate — eight markets,
		// each carrying a deadline. A parse that yielded [] would satisfy the
		// loop below without looking at anything. ⚠ This control has already
		// earned itself once: the first version of this test read the file as a
		// bare array, got `undefined`, and reddened here rather than passing
		// vacuously over nothing.
		expect(slate.length).toBe(8);
		expect(slate.every((m) => typeof m.resolution_deadline === "string")).toBe(
			true,
		);

		const windowEnd = Date.parse(resolveChartWindow("prod").end);
		for (const m of slate) {
			expect(
				Date.parse(m.resolution_deadline),
				`${m.slug} deadline ${m.resolution_deadline} falls outside the production axis`,
			).toBeLessThanOrEqual(windowEnd);
		}

		// ⚠ AND THE MEASUREMENT THAT MAKES THIS GUARD WORTH ITS LINES. The
		// deadline is NOT "shared by all eight markets" — that phrase reached
		// SPEC.1 §16.1 from the CHART-3 brief and the slate contradicts it.
		// SEVEN carry 2026-11-05T23:45Z; `oktoberfest-munich-beer-volume` carries
		// 2026-10-04T21:59:00Z, a month earlier and not on the ratified instant.
		//
		// It changes nothing about the window — Oct 4 is comfortably inside it —
		// but it means the fixed axis has a REAL production case from day one: a
		// market that closes a month before the others and whose series then
		// freezes (**INV-4**) while the axis keeps running to Nov 5. That is the
		// "axis fixed, line not" rendering, in production, not a hypothetical.
		const distinct = new Set(slate.map((m) => m.resolution_deadline));
		expect(distinct.size).toBe(2);
		expect(
			slate.filter((m) => m.resolution_deadline === "2026-11-05T23:45:00.000Z")
				.length,
		).toBe(7);
	});

	it("⏰ EXPIRY ALARM — the staging window has not yet run out", () => {
		// ⛔ THIS TEST IS A DATE-DEPENDENT ALARM, ON PURPOSE, AND IT IS THE ONLY
		// MECHANISM BEHIND AN OWED THAT IS OTHERWISE PROSE IN THREE PLACES.
		//
		// `STAGING_CHART_WINDOW.end` is 2026-11-05T23:45Z since CHART-4 D11 (it
		// was 2026-09-10T23:45Z, which this alarm was about to catch). Staging's
		// markets are permanently `Open`, so `withLiveTail` keeps appending a
		// point at `now`. The moment `now` passes that constant, every staging
		// chart's live tail — and BOTH terminal dots and BOTH pulses, which follow
		// the series — leave the canvas, while the HTML gutter keeps rendering
		// `YES`/`NO` naming marks that are not drawn. Nothing else on disk fires
		// on that date.
		//
		// ⚠ A time-dependent test is normally a defect. Here the CONSTANT is the
		// thing that expires, so a guard that cannot see the calendar cannot see
		// the failure. It fails loudly, with instructions, which is the whole
		// point: the alternative already exists — docblocks saying "owed before
		// <date>" — and it is what silent decay looks like.
		//
		// ⛔ D11 MOVED THE DATE AND DELIBERATELY DID NOT RETIRE THE ALARM. Extending
		// the constant postpones the failure; it does not remove it, and the new
		// end is the same instant production's axis ends, so the day it fires is
		// the day the experiment concludes rather than a quiet Thursday in
		// September. The alarm reads the constant rather than a literal, so it
		// moved with it and needs no edit next time either.
		const stagingEnd = Date.parse(resolveChartWindow("staging").end);
		expect(
			Date.now(),
			"STAGING_CHART_WINDOW.end has passed. Staging charts are now drawing " +
				"their live tail, both terminal dots and both pulses off-canvas. " +
				"FIX: extend `STAGING_CHART_WINDOW.end` in src/server/config/limits.ts " +
				"and move this alarm with it. Do NOT clamp xPx — that draws the live " +
				"price at an instant it did not happen (see the geometry docblock).",
		).toBeLessThan(stagingEnd);
	});

	it("starts no later than staging's earliest measured EVENT, so no real data is clipped", () => {
		// ⛔ MEASURED, NOT CHOSEN — AND THE QUANTITY MEASURED CHANGED AT CHART-6.
		// This asserted the earliest `bet.placed` (2026-08-21T05:29:29.430Z, read at
		// CHART-3) and passed every day for two weeks while the genesis point of all
		// eight markets sat OUTSIDE the window. `replayReserveSeries` walks from the
		// `market.opened` seed, and CHART-4 backfilled those seeds four days earlier
		// than the first bet — so the guard was measuring one of the three event
		// types the chart renders and reporting on all of them.
		//
		// ⇒ The floor is now the earliest event of ANY type on the slate, read
		// 2026-09-01 against the live staging database:
		//   earliest  2026-08-17T20:55:20.712Z  (market.opened, mumbai-bmc-…)
		//   latest    2026-09-01T07:30:30.139Z  (image_upload.sign_requested)
		const EARLIEST_MEASURED_EVENT = Date.parse("2026-08-17T20:55:20.712Z");
		const LATEST_MEASURED_EVENT = Date.parse("2026-09-01T07:30:30.139Z");
		const w = resolveChartWindow("staging");

		expect(Date.parse(w.start)).toBeLessThanOrEqual(EARLIEST_MEASURED_EVENT);
		expect(Date.parse(w.end)).toBeGreaterThanOrEqual(LATEST_MEASURED_EVENT);
	});
});

describe("chart-window::the window CONTAINS ITS DATA — RF-5, against the real constants", () => {
	// ⭐ THE GUARD THAT WOULD HAVE CAUGHT CHART-6's DEFECT, and the reason it is
	// worth its lines is the reason it did not exist: nothing in a 4 249-test suite
	// compared the window to the data. The failure was silent on eight markets
	// across two environments for two weeks and was found by a founder looking at a
	// screen.
	//
	// ⛔ IT ASSERTS THE RENDERED COORDINATE, NOT THE INSTANT. `xPx` is deliberately
	// unclamped in both directions, so an instant outside the window maps outside
	// `0 … VIEWBOX_W` and is cut by the viewBox — which is what "clipped" means
	// here. Comparing two ISO strings would prove the arithmetic; running the real
	// projection proves the picture.
	//
	// ⛔ AND IT USES `resolveChartWindow`, NEVER A FIXTURE WINDOW. A guard written
	// against a made-up start and end is green against any constants at all, which
	// is precisely how this defect survived: the render guards derive from the
	// constants and therefore followed the wrong value without a word.

	/** The genesis instant of every staging market: the `market.opened` seed
	 * `replayReserveSeries` starts its walk from, which CHART-4 backfilled as the
	 * pool's own `created_at`. Verified equal (to the millisecond) against the live
	 * database on 2026-09-01. */
	function stagingGenesisInstants(): { slug: string; at: string }[] {
		const snap: {
			markets: { id: string; slug: string }[];
			pools: { market_id: string; created_at: string }[];
		} = JSON.parse(
			readFileSync(
				join(REPO_ROOT, "docs/data/staging-markets-snapshot.json"),
				"utf8",
			),
		);
		const slugOf = new Map(snap.markets.map((m) => [m.id, m.slug]));
		return snap.pools.map((p) => ({
			slug: slugOf.get(p.market_id) ?? p.market_id,
			at: p.created_at,
		}));
	}

	it("places every staging market's GENESIS point inside the plot — the CHART-6 defect", () => {
		const genesis = stagingGenesisInstants();

		// Non-vacuity: eight markets, eight parseable instants. An empty read would
		// satisfy the loop below while looking at nothing — the failure mode the
		// deadline guard above has already been bitten by once.
		expect(genesis.length).toBe(8);
		expect(genesis.every((g) => !Number.isNaN(Date.parse(g.at)))).toBe(true);

		const w = resolveChartWindow("staging");
		const startMs = Date.parse(w.start);
		const endMs = Date.parse(w.end);

		for (const g of genesis) {
			const x = xPx(g.at, startMs, endMs);
			expect(
				x,
				`${g.slug} genesis ${g.at} maps to x=${x}, LEFT of the plot — its opening price is clipped`,
			).toBeGreaterThanOrEqual(0);
			expect(
				x,
				`${g.slug} genesis ${g.at} maps to x=${x}, RIGHT of the plot`,
			).toBeLessThanOrEqual(VIEWBOX_W);
		}
	});

	it("REDS on the pre-CHART-6 staging start — the control that proves the guard can fire", () => {
		// ⛔ OVN-V2 IN THE FILE RATHER THAN IN A REPORT. The assertion above is
		// written against code that is now correct, so on its own it has never seen
		// the defect and could be asserting something unrelated. This restores the
		// exact superseded constant and requires the SAME projection to reject it.
		//
		// ⚠ It pins the DEFECT, not the fix, so it does not go stale when the
		// staging window moves again — which it will, the next time the fixtures do.
		const SUPERSEDED_START = Date.parse("2026-08-21T00:00:00.000Z");
		const endMs = Date.parse(resolveChartWindow("staging").end);

		const clipped = stagingGenesisInstants().filter(
			(g) => xPx(g.at, SUPERSEDED_START, endMs) < 0,
		);
		expect(
			clipped.length,
			"the superseded window must clip all eight genesis points; if it does not, this guard is measuring the wrong quantity",
		).toBe(8);
	});

	it("places every ratified market's resolution deadline inside the PRODUCTION plot", () => {
		// The right-hand half of the same rule, on the environment whose window is
		// load-bearing. The staging arm above covers the left edge; the deadlines
		// cover the right, and `oktoberfest-munich-beer-volume`'s 2026-10-04 deadline
		// makes that a real case rather than a boundary one.
		const snap: { markets: { slug: string; resolution_deadline: string }[] } =
			JSON.parse(
				readFileSync(
					join(REPO_ROOT, "docs/data/staging-markets-snapshot.json"),
					"utf8",
				),
			);
		expect(snap.markets.length).toBe(8);

		const w = resolveChartWindow("prod");
		const startMs = Date.parse(w.start);
		const endMs = Date.parse(w.end);
		for (const m of snap.markets) {
			const x = xPx(m.resolution_deadline, startMs, endMs);
			expect(
				x,
				`${m.slug} deadline ${m.resolution_deadline} maps to x=${x}, outside the production plot`,
			).toBeLessThanOrEqual(VIEWBOX_W);
			expect(x).toBeGreaterThanOrEqual(0);
		}
	});

	it("states the production START's precondition, and what breaks when it is not met", () => {
		// ⛔ D10 IS CLOSED OPERATIONALLY, NOT BY MOVING THE CONSTANT (CHART-6,
		// founder ruling). Production's start is the experiment's opening instant and
		// is correct PROVIDED the markets are seeded on 15 September. A market opened
		// during the run-up emits `market.opened` before the axis begins, and this
		// arithmetic is what happens to it: exactly the staging failure, in
		// production, on the surface where stake is committed.
		//
		// This is a mechanism, not prose in a docblock: it fails if anyone "fixes"
		// the clip by clamping `xPx`, which is the wrong repair and is rejected in
		// three other places in writing.
		const w = resolveChartWindow("prod");
		const startMs = Date.parse(w.start);
		const endMs = Date.parse(w.end);

		const openedInTheRunUp = "2026-09-14T18:30:00.000Z";
		expect(
			xPx(openedInTheRunUp, startMs, endMs),
			"a market opened before the axis begins must map to a NEGATIVE x; if this is 0 the geometry has been clamped, which draws a price at an instant it did not happen",
		).toBeLessThan(0);

		const seededOnLaunchDay = w.start;
		expect(xPx(seededOnLaunchDay, startMs, endMs)).toBe(0);
	});
});

describe("chart-window::the exported constants are a usable, non-degenerate domain", () => {
	it("exports EXACTLY what resolveChartWindow returns for this environment", () => {
		// ⛔ THE LINK BETWEEN THE FUNCTION EVERY TEST ABOVE EXERCISES AND THE TWO
		// VALUES THE COMPONENT ACTUALLY READS — and until this assertion it did
		// not exist. `resolveChartWindow` is pinned six ways above; the exported
		// constants were pinned only as "a strictly increasing pair", which is
		// true of BOTH windows and of most pairs of dates. So the whole file
		// could be green while `MARKET_CHART_WINDOW_START` was wired to the
		// staging literal, to the wrong field, or to a window nobody resolved —
		// and the render guards, which derive from the constants rather than
		// stating them, would have followed the wrong value without a word.
		//
		// ⚠ WHAT THIS DOES NOT REJECT, stated so the next reader does not
		// over-read it: `CHART_WINDOW = PRODUCTION_CHART_WINDOW` with the env
		// read deleted is green HERE, because the suite runs under
		// `ZUGZWANG_ENV = "prod"` (tests/_setup/env.ts) where the two agree. The
		// source scan's positive control below — `limits` must contain
		// `process.env.ZUGZWANG_ENV` — is what catches that one.
		const env = process.env.ZUGZWANG_ENV;
		// Control: the suite really does pin an environment, so the comparison
		// below is against a resolved window rather than against `undefined`
		// twice over.
		expect(typeof env, "tests/_setup/env.ts must pin ZUGZWANG_ENV").toBe(
			"string",
		);

		expect({
			start: MARKET_CHART_WINDOW_START,
			end: MARKET_CHART_WINDOW_END,
		}).toEqual(resolveChartWindow(env));
	});

	it("exports a strictly increasing pair of parseable instants", () => {
		// The component's degenerate branch keys on `startMs === endMs`. Under a
		// fixed window that must be unreachable, and this is what makes it so.
		const start = Date.parse(MARKET_CHART_WINDOW_START);
		const end = Date.parse(MARKET_CHART_WINDOW_END);
		expect(Number.isNaN(start)).toBe(false);
		expect(Number.isNaN(end)).toBe(false);
		expect(start).toBeLessThan(end);
	});
});

describe("chart-window::the environment branch never leaves the constants layer", () => {
	// ⭐ THE GUARD FOR THE FAILURE MODE THIS DESIGN EXISTS TO PREVENT. SPEC.1
	// §16.1: the window is "resolved from `ZUGZWANG_ENV` at the constants layer;
	// never branched on inside the derivation or the component." A conditional in
	// the read path survives review because each branch looks correct on its own,
	// and it fires only in the environment nobody is testing.
	const DERIVATION_AND_COMPONENTS = [
		"src/server/discovery/price-series.ts",
		"src/server/debate-view/price-chart.ts",
		"src/components/debate/chart/MarketPriceChart.tsx",
		"src/components/debate/chart/MarketPriceChartCard.tsx",
		"src/components/debate/chart/MarketPriceChartHost.tsx",
		"src/components/debate/chart/MarketPriceChartOverlay.tsx",
		"src/components/debate/chart/geometry.ts",
		"src/components/debate/chart/ChartSummary.tsx",
	];

	it("finds ZUGZWANG_ENV in the constants layer — the positive control", () => {
		// Without this, the negatives below are equally consistent with "absent"
		// and "my pattern is wrong", and stripping comments could have eaten the
		// whole file without anyone noticing.
		const limits = strippedSource("src/server/config/limits.ts");
		expect(limits).toContain("process.env.ZUGZWANG_ENV");
		expect(limits).toContain("resolveChartWindow");
	});

	it("finds it in NONE of the derivation or component files", () => {
		for (const rel of DERIVATION_AND_COMPONENTS) {
			const src = strippedSource(rel);
			// Non-vacuity per file: the strip left real code behind.
			expect(src.length, `${rel} stripped to nothing`).toBeGreaterThan(200);
			expect(src, `${rel} branches on the environment`).not.toContain(
				"ZUGZWANG_ENV",
			);
		}
	});

	it("keeps the window's env branch to exactly one site in src/", () => {
		// Belt to the above: `resolveChartWindow` is the only function permitted
		// to read the env for this purpose, and it is called exactly once.
		const limits = strippedSource("src/server/config/limits.ts");
		const calls = limits.match(/resolveChartWindow\(/g) ?? [];
		// One declaration + one invocation.
		expect(calls.length).toBe(2);
	});

	it("names resolveChartWindow in exactly ONE file under src/", () => {
		// ⛔ THE TEST ABOVE CLAIMS "exactly one site in src/" AND MEASURES ONE
		// FILE. It counts occurrences inside `limits.ts` and stops there, so a
		// second call site anywhere else in `src/` — a component resolving its
		// own window from a prop, a route handler resolving one per request —
		// leaves that count at 2 and the guard green while the branch it exists
		// to contain has left the constants layer by the front door.
		const named = walkSrc().filter((rel) =>
			strippedSource(rel).includes("resolveChartWindow"),
		);
		expect(named).toEqual(["src/server/config/limits.ts"]);
	});

	it("finds NO component under src/components/ that branches on the environment", () => {
		// ⛔ THE HAND-WRITTEN LIST ABOVE IS THE HOLE, AND IT IS THE SHAPE THIS
		// REPO KEEPS HITTING: a negative whose SELECTOR is a literal that has to
		// be maintained. `DERIVATION_AND_COMPONENTS` names eight files; the
		// window reaches more than eight. `HeroPanels.tsx` renders this chart in
		// `hero` mode and is not on it — and ambiguity #3 ruled that the hero
		// takes the SAME window precisely so one market cannot be two shapes on
		// two surfaces, which is the ruling an env branch there would break. So
		// would `MarketHeader.tsx`, `MarketCard.tsx`, or any component added
		// tomorrow. A guard that passes because nobody thought to list the file
		// is not distinguishable from one that passes because the code is right.
		//
		// ⇒ SCOPED BY DIRECTORY, NOT BY LIST, and the rule is broader and simpler
		// than the window: NO component branches on the environment, for any
		// reason. Today that set is empty — measured, not assumed — so this needs
		// no allowlist and cannot rot. Adding an env read to a component is then
		// a decision that reddens a named guard, not an edit nobody sees.
		const components = walkSrc().filter((rel) =>
			rel.startsWith("src/components/"),
		);
		// Non-vacuity: the walk found the component tree, not an empty set. A
		// broken glob would otherwise satisfy "no component branches" trivially.
		expect(components.length).toBeGreaterThan(50);
		expect(components).toContain(
			"src/components/debate/chart/MarketPriceChart.tsx",
		);
		expect(components).toContain("src/components/discovery/HeroPanels.tsx");

		const offenders = components.filter((rel) =>
			strippedSource(rel).includes("ZUGZWANG_ENV"),
		);
		expect(offenders).toEqual([]);
	});

	it("finds NO file under src/server/ that branches on the environment, except the four that already own it", () => {
		// ⛔ THE COMPONENT HALF IS DIRECTORY-SCOPED AND THE SERVER HALF WAS STILL
		// A LIST — which is the same hole one directory over. A new derivation
		// module (`src/server/debate-view/chart-window.ts`, say) that read
		// `process.env.ZUGZWANG_ENV` and exported a per-env window would be on no
		// list, under no component directory, and would never call
		// `resolveChartWindow` — so not one assertion above would move, while the
		// branch this whole design exists to contain had left the constants layer
		// by the front door.
		//
		// ⇒ The server tree is scanned whole, against an ALLOWLIST OF THE FILES
		// THAT LEGITIMATELY READ THE ENV TODAY. An allowlist is checkable in a way
		// a denylist is not: adding a name is a visible decision, and every file
		// not on it is covered without anyone remembering to add it.
		//
		// ⚠ The four incumbents have nothing to do with the chart — they key Redis
		// namespaces, tag Sentry, guard the OTP sender and refuse a prod
		// transaction-mode pool. They are listed so this guard stays about the
		// WINDOW's branch rather than becoming a second, weaker rule about env
		// reads in general.
		const ALLOWED = [
			"src/server/auth/email-otp.ts",
			"src/server/config/limits.ts",
			"src/server/upstash/keys.ts",
			"src/server/visitors/counter.ts",
		];
		const server = walkSrc().filter((rel) => rel.startsWith("src/server/"));

		// Non-vacuity: the walk really found the server tree.
		expect(server.length).toBeGreaterThan(50);
		expect(server).toContain("src/server/discovery/price-series.ts");
		expect(server).toContain("src/server/debate-view/price-chart.ts");

		const readers = server.filter((rel) =>
			strippedSource(rel).includes("ZUGZWANG_ENV"),
		);
		// Positive control on the scan itself: the constants layer MUST show up,
		// or the filter is matching nothing and the assertion is vacuous.
		expect(readers).toContain("src/server/config/limits.ts");
		expect(readers.sort()).toEqual(ALLOWED);
	});

	it("strips comments without eating the code it is meant to scan", () => {
		// ⛔ THE STRIP ITSELF IS A NEGATIVE'S BLIND SPOT. `strippedSource` deletes
		// everything between `/*` and the next `*/`; a `/*` appearing inside a
		// string or a regex literal opens a comment that is not one, and the
		// delete runs to the next real `*/` — which in this codebase, where
		// docblocks are longer than the code, could be hundreds of lines later.
		// The per-file `length > 200` floor above does not see that: it is
		// satisfied by whatever survived ELSEWHERE in the file while the region
		// carrying the env branch was swallowed.
		//
		// ⇒ SO ASSERT ON A SENTINEL OF REAL CODE, at the site that matters. If
		// the window's own use in the chart component survives the strip, the
		// strip reached that region and left it readable.
		const chart = strippedSource(
			"src/components/debate/chart/MarketPriceChart.tsx",
		);
		expect(chart).toContain("MARKET_CHART_WINDOW_START");
		expect(chart).toContain("MARKET_CHART_WINDOW_END");
		// …and it really did strip: the component's prose names the env branch's
		// own rule, so an un-stripped read of this file would carry words the
		// scan must never see as code.
		const raw = readFileSync(
			join(REPO_ROOT, "src/components/debate/chart/MarketPriceChart.tsx"),
			"utf8",
		);
		expect(chart.length).toBeLessThan(raw.length / 2);
	});
});
