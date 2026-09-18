/**
 * MKT-ROSTER-1 · ONE-TIME — print the wipe batch, so it can be READ before it runs.
 *
 * ⛔ IT IS GENERATED, NEVER RETYPED. `buildResetBatch(TRUNCATE_SET)` is the same
 * function the shipped staging reset calls, imported read-only. Transcribing 52
 * statements by hand into a production tool is the single cheapest way to
 * disable a guard nobody meant to disable, and this makes that impossible: there
 * is no second copy to differ from the first.
 *
 * Writes nothing and connects to nothing. `pnpm exec tsx scripts/_onetime/mkt-roster-1-print-batch.ts`
 */
import {
	DISABLED_TRUNCATE_GUARDS,
	EXPECTED_GUARD_CATALOG_ROWS,
	NEVER_DISABLED_GUARD_NAMES,
	TRUNCATE_EXCLUSIONS,
	TRUNCATE_SET,
} from "../../tests/staging/_lib/guards";
import { buildResetBatch } from "../../tests/staging/_lib/reset";

const batch = buildResetBatch(TRUNCATE_SET);
const lines = batch.split("\n");

console.log(batch);
console.log("\n-- ── SHAPE, MEASURED FROM THE STRING ABOVE ──");
console.log(`-- statements                  ${lines.length}`);
console.log(`-- tables truncated            ${TRUNCATE_SET.length}`);
console.log(
	`-- guards disabled/re-enabled  ${DISABLED_TRUNCATE_GUARDS.length} each way`,
);
console.log(
	`-- NEVER disabled              ${NEVER_DISABLED_GUARD_NAMES.join(", ")}`,
);
console.log(`-- never truncated             ${TRUNCATE_EXCLUSIONS.join(", ")}`);
console.log(`-- guard catalogue expected    ${EXPECTED_GUARD_CATALOG_ROWS}`);

// The refusals worth proving hold before the batch is trusted, not after.
const disabledNames = new Set(DISABLED_TRUNCATE_GUARDS.map(([, t]) => t));
const overlap = NEVER_DISABLED_GUARD_NAMES.filter((n) => disabledNames.has(n));
if (overlap.length > 0) {
	throw new Error(
		`REFUSED — the batch disables a NEVER-disabled guard: ${overlap.join(", ")}`,
	);
}
const excluded = TRUNCATE_EXCLUSIONS.filter((t) => TRUNCATE_SET.includes(t));
if (excluded.length > 0) {
	throw new Error(
		`REFUSED — the batch truncates an EXCLUDED table: ${excluded.join(", ")}`,
	);
}
// ⛔ A REFUSAL, NOT A LOG. The two checks above `throw`; this one only printed a
// ✅ when it passed and printed NOTHING when it failed, in a file whose stated job
// is "the refusals worth proving hold before the batch is trusted"
// (`@code-reviewer`, LOW).
if (batch.includes("lots_no_delete")) {
	throw new Error(
		"REFUSED — the batch names `lots_no_delete`. `lots` is Bucket C: it is emptied by " +
			"TRUNCATE bets CASCADE and its row-level DELETE guard is deliberately outside the " +
			"bucket_% family, so it must never be disabled.",
	);
}
console.log(
	"-- ✅ lots_no_delete is NOT in the batch — `lots` is Bucket C, emptied by TRUNCATE bets CASCADE",
);
console.log(
	"-- ✅ no NEVER-disabled guard is touched; no excluded table is truncated",
);
