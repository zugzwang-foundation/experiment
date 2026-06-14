import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

// ENGINE.16 §5.6 tests-first (charter row (e)) — the §20.3 structural guard. The
// freeze read-guard `isFrozen()` is wired onto EXACTLY the two state-mutating
// surfaces (participant bet endpoints via the shared `runBetEndpoint`, and the
// automated W-4 close-due cron) and onto NOTHING else: admin paths (resolve /
// correct / void), the W-3/W-4 transaction wrappers, and read/auth paths stay
// UNGATED (§20.3). This is a SOURCE-GREP guard — it reads the files as TEXT via
// `node:fs` (never imports the modules), so it makes no IO and has no DB.
//
// The "present in the two gated surfaces" assertions are the TEETH: they fail
// now (zero `isFrozen` occurrences anywhere in src/ today — P0 recon) → RED,
// and go green when S2 wires the two gates. The "absent from the ungated paths"
// assertions PASS now and pin the §20.3 contract against future over-gating.

function src(relativeFromRepoRoot: string): string {
	const url = new URL(`../../../${relativeFromRepoRoot}`, import.meta.url);
	return readFileSync(fileURLToPath(url), "utf8");
}

// The two gated surfaces — `isFrozen` MUST appear (the wiring).
const GATED = [
	"src/server/bets/endpoint.ts",
	"src/app/api/cron/close-due-markets/route.ts",
];

// The ungated paths — `isFrozen` MUST NOT appear (§20.3 admin/read/auth
// exemption + the W-3/W-4 lock-order isolation).
const UNGATED = [
	"src/server/resolution/settle.ts",
	"src/server/resolution/correct.ts",
	"src/server/resolution/void.ts",
	"src/server/resolution/transaction.ts",
	"src/server/markets/transaction.ts",
	"src/server/markets/close.ts",
	"src/server/markets/create.ts",
	"src/server/markets/open.ts",
	"src/server/admin/wire.ts",
	"src/server/auth/index.ts",
];

describe("ENGINE.16 (e) — isFrozen() wiring surface (§20.3 structural guard)", () => {
	for (const path of GATED) {
		it(`freeze-surface::isFrozen-present-on-gated-${path}`, () => {
			expect(src(path)).toMatch(/isFrozen/);
		});
	}

	for (const path of UNGATED) {
		it(`freeze-surface::isFrozen-absent-from-ungated-${path}`, () => {
			expect(src(path)).not.toMatch(/isFrozen/);
		});
	}
});
