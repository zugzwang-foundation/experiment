import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { FORBIDDEN_DIRECT_WRITE_TABLES } from "../../staging/_lib/write-guard";

// ═══════════════════════════════════════════════════════════════════════════
// ADR-0036 PRIMITIVE 4 — THE SOURCE TRIPWIRE
//
// The generator writes NO rows directly. Gate 1 asserts every `bets` row has a
// matching `bet.placed` event; if the GENERATOR could write both halves, gate 1
// would pass BECAUSE the generator wrote them. A verification satisfiable by
// the thing it verifies is not a verification (Ratification Record §5 W-G).
// This assertion is what keeps gate 1 non-vacuous, and it must not be
// simplified away in review.
//
// ── THIS IS THE WEAK FORM, AND IT IS DELIBERATELY THE SECOND CONTROL ────────
// Manifest §5: "a source match reads text ABOUT a file rather than what the
// file DOES, and it false-alarms on correct code" — QK-c proved it false-alarms
// on a pure reformat. So the STRONG control is behavioural and lives in
// `tests/staging/_lib/write-guard.ts`: it attributes every write the real run
// issues to its immediate caller and THROWS when that caller is under `tests/`.
// A third, structural control sits underneath both — `_lib/client.ts` hands the
// generator no write-capable handle at all.
//
// This file is the cheap tripwire that runs in CI on every PR, where the
// behavioural one cannot (it needs a database).
//
// ── THE FOUR CONTROLS MANIFEST §5 REQUIRES OF IT ────────────────────────────
//   1 POSITIVE CONTROL PER PATTERN — a negative assertion passes when its
//     pattern matches nothing, which is exactly what a rename produces.
//   2 NON-EMPTY FILE SET — a loop over an empty array asserts nothing.
//   3 WHITESPACE TOLERANCE — a needle dies the moment a formatter wraps a call.
//   4 MUTATION CONTROL AT AUTHORING TIME — a real `db.insert()` was added to
//     the generator, RED confirmed, reverted, GREEN confirmed. The verdict is
//     recorded in docs/logs/STAGING-PARITY-B.md.
// ═══════════════════════════════════════════════════════════════════════════

const STAGING_DIR = fileURLToPath(new URL("../../staging/", import.meta.url));

/**
 * Every `.ts` under `tests/staging/`, runners and helpers alike.
 *
 * Scoped to the WHOLE directory rather than the generator file, because a
 * direct write moved into a helper is the same defect wearing a different hat —
 * and `_lib/` is where it would go if anyone tried to make one look tidy.
 */
function collectSources(dir: string, acc: string[] = []): string[] {
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const full = `${dir}${entry.name}`;
		if (entry.isDirectory()) collectSources(`${full}/`, acc);
		else if (entry.name.endsWith(".ts")) acc.push(full);
	}
	return acc;
}

const FILES = collectSources(STAGING_DIR).sort();

/**
 * Blank out comments, preserving every character offset.
 *
 * LOAD-BEARING, not hygiene. The generator's header DISCUSSES `INSERT INTO` and
 * `.insert(` at length — it has to, since explaining the rule requires naming
 * what the rule forbids. A scan that did not strip comments would fail on the
 * documentation of the very property it is checking. The reset's
 * `runner-gating.test.ts` hit the same shape with `it(`.
 */
function stripComments(text: string): string {
	let out = "";
	let i = 0;
	while (i < text.length) {
		if (text.startsWith("//", i)) {
			const end = text.indexOf("\n", i);
			const stop = end === -1 ? text.length : end;
			out += " ".repeat(stop - i);
			i = stop;
		} else if (text.startsWith("/*", i)) {
			const end = text.indexOf("*/", i + 2);
			const stop = end === -1 ? text.length : end + 2;
			out += text.slice(i, stop).replace(/[^\n]/g, " ");
			i = stop;
		} else {
			out += text[i];
			i += 1;
		}
	}
	return out;
}

/** snake_case table name -> the camelCase drizzle binding it is imported as. */
function camel(table: string): string {
	return table.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
}

/**
 * The two patterns ADR-0036 primitive 4 names, per table.
 *
 * WHITESPACE TOLERANCE IS THE POINT (control 3). Biome wraps a long call across
 * lines the moment its arguments grow, so `.insert(bets)` becomes
 * `.insert(\n\t\tbets,\n\t)` on a reformat — and a literal `indexOf(".insert(bets)")`
 * would then match nothing and report clean. `\s*` everywhere a formatter can
 * insert a break, and a trailing-comma allowance.
 *
 * ⚠ WHAT THESE PATTERNS DO NOT CATCH, so a later reader does not over-trust
 * them (@code-reviewer, Slice B): `.insert(schema.bets)` and an import alias
 * (`bets as betsTable`) both defeat the binding match, and a table name built
 * by string concatenation defeats the SQL match. That is inherent to a source
 * match and is why it is the WEAK form. The BEHAVIOURAL guard catches all three
 * — it reads the table off the object drizzle was actually handed — and the
 * import allowlist below closes the remaining route. Defence in depth; this
 * layer is the cheap tripwire, not the control.
 */
function patternsFor(table: string): { label: string; re: RegExp }[] {
	const binding = camel(table);
	return [
		{
			label: `INSERT INTO ${table}`,
			re: new RegExp(`insert\\s+into\\s+"?${table}"?\\b`, "i"),
		},
		{
			label: `.insert(${binding})`,
			re: new RegExp(`\\.\\s*insert\\s*\\(\\s*${binding}\\s*,?\\s*\\)`),
		},
	];
}

describe("the file set is real", () => {
	// CONTROL 2 — a loop over an empty array asserts nothing. If a directory
	// rename ever emptied this list, every per-file assertion below would pass
	// while examining zero bytes.
	it("finds the generator and its helpers", () => {
		expect(FILES.length).toBeGreaterThan(0);
		const names = FILES.map((f) => f.slice(STAGING_DIR.length));
		expect(names).toContain("generate.staging.test.ts");
		expect(names).toContain("fixtures.ts");
		expect(names.some((n) => n.startsWith("_lib/"))).toBe(true);
	});

	it("reads non-empty bodies", () => {
		for (const file of FILES) {
			expect({ file, empty: readFileSync(file, "utf8").length === 0 }).toEqual({
				file,
				empty: false,
			});
		}
	});

	it("covers every table the ADR names", () => {
		expect(FORBIDDEN_DIRECT_WRITE_TABLES).toEqual([
			"bets",
			"comments",
			"events",
			"dharma_ledger",
			"positions",
			"pools",
			"resolution_events",
			"payout_events",
			"mod_actions",
			"bet_receipts",
			// Bucket C, emits no event, and a direct insert would be two lines
			// shorter and look harmless — which is exactly why it is listed.
			"bookmarks",
		]);
	});
});

describe("every pattern actually matches something", () => {
	// CONTROL 1 — one positive control PER PATTERN. Without these the whole
	// suite is green when the matchers are broken, which is indistinguishable
	// from green when the code is clean.
	for (const table of FORBIDDEN_DIRECT_WRITE_TABLES) {
		const binding = camel(table);
		for (const { label, re } of patternsFor(table)) {
			it(`fires on a synthetic violation: ${label}`, () => {
				const violation = label.startsWith("INSERT")
					? `await client.unsafe("INSERT INTO ${table} (id) VALUES ($1)", [id]);`
					: `await db.insert(${binding}).values({});`;
				expect(violation).toMatch(re);
			});
		}
	}

	// CONTROL 3 — the reformat case, stated as its own assertion rather than
	// trusted to the regex. QK-c's finding was that a source match false-alarms
	// on a pure reformat; the mirror failure is a source match that goes SILENT
	// on one.
	it("survives a formatter wrapping the call across lines", () => {
		const wrapped = "await db\n\t.insert(\n\t\tbets,\n\t)\n\t.values({});";
		const { re } = patternsFor("bets")[1] as { re: RegExp };
		expect(wrapped).toMatch(re);
	});

	it("survives extra whitespace inside INSERT INTO", () => {
		const spaced = 'await client.unsafe(`INSERT   INTO\n  "events" (id)`);';
		const { re } = patternsFor("events")[0] as { re: RegExp };
		expect(spaced).toMatch(re);
	});

	it("does not fire on an unrelated table", () => {
		// The matchers are table-scoped; a legitimate write elsewhere must not
		// register, or the suite becomes noise and gets disabled.
		const benign = "await db.insert(someOtherTable).values({});";
		for (const table of FORBIDDEN_DIRECT_WRITE_TABLES) {
			for (const { re } of patternsFor(table)) {
				expect({ table, hit: re.test(benign) }).toEqual({ table, hit: false });
			}
		}
	});
});

describe("the comment stripper does work", () => {
	it("blanks comments without moving offsets", () => {
		const raw = readFileSync(`${STAGING_DIR}generate.staging.test.ts`, "utf8");
		const stripped = stripComments(raw);
		expect(stripped).toHaveLength(raw.length);
		// The generator's header genuinely names the forbidden patterns — proof
		// the stripper is doing work rather than matching nothing.
		expect(raw).toMatch(/^\s*\/\/.*INSERT INTO/m);
		expect(stripComments(raw)).not.toMatch(/^\s*\/\/.*INSERT INTO/m);
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// THE IMPORT ALLOWLIST — the hole the two patterns above cannot see
//
// @code-reviewer, Slice B. Caller attribution allows any `/src/` frame, and
// `src/` contains THIN WRITE HELPERS that perform an insert on the caller's
// behalf: `insertEvent(tx, …)` runs `tx.execute(sql\`INSERT INTO events …\`)`,
// and `appendLedgerRow(tx, …)` runs `tx.insert(dharmaLedger)`. The generator
// legitimately holds a `tx`. So:
//
//     await guardedDb.transaction(async (tx) => {
//       await insertEvent(tx, { eventType: "bet.placed", aggregateId: someBetId, … });
//     });
//
// …passes ALL THREE controls — the handle is the sanctioned one, the attributed
// frame is `src/server/events/insert.ts`, and the text contains neither
// `INSERT INTO events` nor `.insert(events)`. That is EXACTLY the circularity
// W-G names: the generator emitting a `bet.placed` for a row it also caused,
// making gate 1 pass because the generator wrote both halves.
//
// The shipped generator does not do it. But the ADR says primitive 4 is
// "enforced rather than promised", and Slice C adds roughly ten more call sites
// to the same file. So the ENTRYPOINTS are pinned: the generator may import
// from `@/server/**` only what the Ratification Record §7 deviation ratifies.
// Adding a name here is a decision, not an edit — the same shape as
// `runner-gating.test.ts`'s closed predicate set.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * The engine entrypoints Ratification Record §7 ratifies, plus the two PURE
 * shell helpers Q1 requires the generator to call itself (`assertStakeFloor`,
 * because the two-floor validator lives in the endpoint; `canonicalizeAmount18`,
 * because "the generator must canonicalize seedAmount itself since that step
 * lived in the wire"). Neither writes a row.
 */
const RATIFIED_SERVER_IMPORTS = new Set([
	// Ratification Record §7 — the real engine functions.
	"@/server/auth/index", // auth.$context.internalAdapter.createOAuthUser
	"@/server/auth/tos-accept", // acceptTosAction
	"@/server/markets/create", // createMarket
	"@/server/markets/open", // openMarket
	"@/server/markets/close", // closeMarket
	"@/server/bets/place", // place
	"@/server/bets/sell", // sell
	"@/server/bets/transaction", // runBetTransaction — the W-1 spine
	"@/server/resolution/trigger", // triggerResolution
	"@/server/resolution/settle", // settleMarket
	"@/server/resolution/void", // voidMarket
	"@/server/admin/moderation/act", // moderateComment
	"@/server/bookmarks/add", // addBookmarkAction
	// ── C7, THE PARTICIPANT IMAGE CHAIN — added at Slice C ──────────────────
	// Ratification Record §7 enumerates the engine functions as they stood when
	// C7 was still flagged "most expensive shape, see OQ-1". Slice B's STEP 8b
	// probe resolved OQ-1 (the whole R2 chain works on staging), and the Slice C
	// kickoff names these three explicitly: "signUploadAndInsert -> real PUT ->
	// verifyUploadedObject -> place({ image })". So this is an operator-ruled
	// widening, recorded here rather than an edit made in passing.
	//
	// They are the SAME functions `app/api/uploads/sign/route.ts` orchestrates,
	// in the same order. The generator adds no write of its own — the
	// `image_uploads` row and the `image_upload.sign_requested` event are both
	// `signUploadAndInsert`'s.
	"@/server/storage/sign-upload", // signUploadAndInsert
	"@/server/storage/verify-object", // verifyUploadedObject
	"@/server/storage/r2", // mintPutUrl (HTTP, outside the tx — ADR-0014)
	// Pure, write-free, and required by Q1's shell-skip table.
	"@/server/bets/floors", // assertStakeFloor
	"@/server/admin/wire", // canonicalizeAmount18 + the mocked requireAdminSession
	"@/server/config/limits", // PUT_URL_TTL_SECONDS — a constant, not a writer
	// Pure value/verification helpers the GATES use. No writes.
	"@/server/dharma/conservation",
	"@/server/dharma/tags",
	"@/server/bets/replay",
	"@/server/cpmm/decimal",
	// ── GATE 5's SHIPPED READERS — added at Slice C ─────────────────────────
	// Every one is READ-ONLY (a `select` chain and in-memory arithmetic; none
	// carries an insert/update/delete), and gate 5 calls them rather than
	// restating their identities in SQL. Đb is `computeSell(quantity).proceeds`
	// and `netProfitLoss` is `wallet + Σ Đb(open) − Σ issuance`; a SQL
	// re-derivation of either would be a second implementation of the thing
	// being verified — the error gate 2's header exists to warn about.
	"@/server/dharma/header-balance", // getHeaderBalance
	"@/server/dharma/header-portfolio", // getHeaderPortfolio
	"@/server/profile/positions", // loadProfilePositions
	"@/server/profile/tiles", // loadProfileTiles
]);

/** Every `@/server/...` module specifier a file imports. */
function serverImportsOf(body: string): string[] {
	return [...body.matchAll(/from\s+["'](@\/server\/[^"']+)["']/g)].map(
		(m) => m[1] as string,
	);
}

describe("the generator imports only ratified engine entrypoints", () => {
	it("recognises a server import (positive + negative control)", () => {
		expect(
			serverImportsOf('import { x } from "@/server/events/insert";'),
		).toEqual(["@/server/events/insert"]);
		// Whitespace tolerance, matching the rest of this file.
		expect(
			serverImportsOf('import {\n\tx,\n} from\n\t"@/server/dharma/persist";'),
		).toEqual(["@/server/dharma/persist"]);
		expect(serverImportsOf('import { x } from "./local";')).toEqual([]);
	});

	it("pins the two known write helpers as NOT ratified", () => {
		// The positive control for the allowlist itself: these are exactly the
		// modules the bypass would import, and they must not be permitted.
		expect(RATIFIED_SERVER_IMPORTS.has("@/server/events/insert")).toBe(false);
		expect(RATIFIED_SERVER_IMPORTS.has("@/server/dharma/persist")).toBe(false);
		expect(RATIFIED_SERVER_IMPORTS.has("@/server/positions/persist")).toBe(
			false,
		);
	});

	for (const file of FILES) {
		const relative = file.slice(STAGING_DIR.length);
		const body = stripComments(readFileSync(file, "utf8"));
		const imports = serverImportsOf(body);
		const unratified = imports.filter((i) => !RATIFIED_SERVER_IMPORTS.has(i));

		it(`${relative} · imports no unratified @/server module`, () => {
			expect({ file: relative, unratified }).toEqual({
				file: relative,
				unratified: [],
			});
		});
	}

	it("the runners actually import SOMETHING from @/server", () => {
		// Non-empty control: an allowlist over zero imports permits everything.
		const total = FILES.flatMap((f) =>
			serverImportsOf(stripComments(readFileSync(f, "utf8"))),
		);
		expect(total.length).toBeGreaterThan(0);
	});
});

describe("no operational runner writes a forbidden table directly", () => {
	for (const file of FILES) {
		const relative = file.slice(STAGING_DIR.length);
		const body = stripComments(readFileSync(file, "utf8"));

		for (const table of FORBIDDEN_DIRECT_WRITE_TABLES) {
			for (const { label, re } of patternsFor(table)) {
				it(`${relative} · no ${label}`, () => {
					expect({
						file: relative,
						pattern: label,
						hit: re.test(body),
					}).toEqual({ file: relative, pattern: label, hit: false });
				});
			}
		}
	}
});
