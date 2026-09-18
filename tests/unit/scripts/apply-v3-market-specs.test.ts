import { describe, expect, it } from "vitest";

import {
	ENVIRONMENTS,
	type Environment,
	loadTargets,
} from "../../../scripts/apply-v3-market-specs";

// ═══════════════════════════════════════════════════════════════════════════
// D-50 · the guards on the one artifact in this lane that writes to PRODUCTION.
//
// ⛔⛔ THIS FILE EXISTS BECAUSE THE SCRIPT EXPORTED NOTHING AND THEREFORE HAD NO
// TEST. `loadTargets` and the environment table were module-private, so the
// only way to exercise guard 4 — or any of its six refusals — was to run the
// script against a live database, which is the one thing a guard should not
// require. Its strictly-lower-risk, staging-only predecessor
// `scripts/rename-ycp01-artifact.ts` exports its pure transform and carries
// `tests/unit/scripts/rename-ycp01-artifact.test.ts`; the argument is stronger
// for the script that can reach production, not weaker (`@code-reviewer`).
//
// ⚠ NO DATABASE IS TOUCHED HERE and none can be: `loadTargets` reads a JSON
// file and returns rows. The connection, the transaction, the precondition and
// the compare-and-swap are all downstream of it and are not reachable from this
// file — which is the honest limit of what this guard covers. What it DOES
// cover is the half that decides WHAT gets written and to WHICH environment,
// and that half was untested.
//
// ⚠ THE FIXTURES ARE THE REAL COMMITTED SNAPSHOTS. A synthetic one would test
// the parser against a copy of the thing it is supposed to be checking.
// ═══════════════════════════════════════════════════════════════════════════

const PROD = ENVIRONMENTS.prod as Environment;
const STAGING = ENVIRONMENTS.staging as Environment;

describe("the environment table", () => {
	it("apply-v3::names exactly staging and prod, and nothing else", () => {
		expect(Object.keys(ENVIRONMENTS).sort()).toEqual(["prod", "staging"]);
	});

	it("apply-v3::each environment REQUIRES its own ref and FORBIDS the other's", () => {
		// ⛔ THE LOAD-BEARING SYMMETRY. Guard 3 reads these two fields off the
		// DSN's own bytes, so if `requiredRef` and `forbiddenRef` were ever the
		// same value — or swapped — the guard would pass on a cross-environment
		// connection while printing that it had verified the target.
		expect(PROD.requiredRef).toBe(STAGING.forbiddenRef);
		expect(STAGING.requiredRef).toBe(PROD.forbiddenRef);
		expect(PROD.requiredRef).not.toBe(PROD.forbiddenRef);
		expect(STAGING.requiredRef).not.toBe(STAGING.forbiddenRef);
	});

	it("apply-v3::each environment reads its OWN snapshot and its OWN DSN var", () => {
		expect(PROD.snapshot).toBe("prod-markets-snapshot.json");
		expect(STAGING.snapshot).toBe("staging-markets-snapshot.json");
		expect(PROD.dsnVar).toBe("DATABASE_URL_PROD");
		expect(STAGING.dsnVar).toBe("DATABASE_URL_STAGING");
		expect(PROD.dopplerConfig).toBe("prd");
		expect(STAGING.dopplerConfig).toBe("stg");
		// ⚠ Doppler's configs are `stg`/`prd` and never `staging`/`production`
		// (CLAUDE.md Gotchas). A wrong value here sends the operator to a config
		// that does not exist, which reads as a credentials problem.
		expect([PROD.dopplerConfig, STAGING.dopplerConfig]).not.toContain(
			"production",
		);
	});
});

describe("loadTargets, against the real committed snapshots", () => {
	it.each([
		["prod", PROD],
		["staging", STAGING],
	])("apply-v3::%s yields the five ruled markets, by that file's OWN ids", (_n, env) => {
		const rows = loadTargets(env);
		expect(rows).toHaveLength(5);
		expect(rows.map((r) => r.slug).sort()).toEqual([
			"chess-fide-tiebreak-response",
			"claude-bundle-response",
			"github-zugzwang-repo-stars",
			"math-erdos-solved-on-zugzwang",
			"yc-w27-acceptance",
		]);
		// ⛔ MKT-BTC-01 must never be a target — D-50 ruling 4.
		expect(rows.map((r) => r.slug)).not.toContain("bitcoin-price-50k");
		for (const r of rows) {
			expect(r.id).toMatch(
				/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
			);
			expect(r.title.length).toBeGreaterThan(0);
			expect(r.description.length).toBeGreaterThan(400);
		}
	});

	it("apply-v3::the two environments' target ids overlap NOWHERE", () => {
		// ⛔⛔ THE ASSERTION THAT MAKES "by id, never by slug" SAFE. Production was
		// built fresh rather than restored from staging, so the id sets are
		// disjoint — which is exactly why each environment must read its own
		// snapshot, and why a crossed snapshot would match zero rows rather than
		// silently editing the wrong database's markets.
		const prodIds = new Set(loadTargets(PROD).map((r) => r.id));
		const stgIds = new Set(loadTargets(STAGING).map((r) => r.id));
		expect(prodIds.size).toBe(5);
		expect(stgIds.size).toBe(5);
		for (const id of prodIds) expect(stgIds.has(id)).toBe(false);
	});

	it("apply-v3::both environments' targets carry IDENTICAL wording — ruling 3", () => {
		// The same property `market-spec-snapshot-parity.test.ts` asserts against
		// the spec files; here it is asserted through the loader the SCRIPT uses,
		// so a divergence cannot reach the write path even if the snapshots were
		// somehow checked and the loader then picked a different field.
		const byslug = (env: Environment) =>
			new Map(loadTargets(env).map((r) => [r.slug, r]));
		const p = byslug(PROD);
		const s = byslug(STAGING);
		let checked = 0;
		for (const [slug, pr] of p) {
			const sr = s.get(slug);
			expect(sr, `staging has no target ${slug}`).toBeDefined();
			if (!sr) throw new Error("unreachable — narrowing");
			expect({ slug, title: pr.title, description: pr.description }).toEqual({
				slug,
				title: sr.title,
				description: sr.description,
			});
			checked += 1;
		}
		expect(checked).toBe(5);
	});

	it("apply-v3::REFUSES a snapshot whose source names the wrong environment", () => {
		// ⛔ GUARD 4's decisive arm, and the only way to reach it without a
		// database. Seeding production from the staging capture would write
		// staging's ids and — worse — could write staging's wording, and EVERY
		// OTHER assertion in the script would still pass, because both files hold
		// six markets. `loadTargets` calls `process.exit(1)` on refusal, so the
		// observable is the exit, not a thrown value.
		const crossed: Environment = { ...PROD, snapshot: STAGING.snapshot };
		const exit = process.exit;
		const err = console.error;
		let code: number | undefined;
		// ⚠ The refusal banner is swallowed into a sink rather than an empty
		// arrow: an empty block needs a `biome-ignore`, and a MULTI-LINE
		// `biome-ignore` does not attach to the statement below it — biome reports
		// the suppression itself as having no effect and the rule stays live. (The
		// same shape is a pre-existing warning at `DebateView.tsx:114`.) Keeping
		// the lines is also better than suppressing them: on an unexpected
		// refusal they are the only evidence of WHICH guard fired.
		const banner: string[] = [];
		console.error = (...args: unknown[]) => {
			banner.push(args.map(String).join(" "));
		};
		process.exit = ((c?: number) => {
			code = c;
			throw new Error("__exited__");
		}) as typeof process.exit;
		try {
			expect(() => loadTargets(crossed)).toThrow("__exited__");
			expect(code).toBe(1);
			// ⛔ AND THE REFUSAL MUST SAY WHICH GUARD FIRED. A run that exits 1 for
			// some other reason would satisfy the assertion above; this pins the
			// message to the source check rather than to any refusal at all.
			expect(banner.join("\n")).toContain("does not record prod as its source");
		} finally {
			process.exit = exit;
			console.error = err;
		}
		// ⛔ POSITIVE CONTROL — the same harness must let a CORRECT environment
		// through, or the arm above would pass against a loader that refuses
		// everything.
		expect(loadTargets(PROD)).toHaveLength(5);
	});
});
