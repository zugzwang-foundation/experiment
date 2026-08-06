import { describe, expect, it } from "vitest";

import {
	createWriteGuard,
	DirectWriteForbiddenError,
	FORBIDDEN_DIRECT_WRITE_TABLES,
	isEngineCaller,
} from "../../staging/_lib/write-guard";

// ═══════════════════════════════════════════════════════════════════════════
// ADR-0036 PRIMITIVE 4 — THE BEHAVIOURAL CONTROL, UNIT-TESTED
//
// The write guard is the STRONG half of primitive 4: it attributes every write
// the generator's real run issues to its immediate caller and refuses one whose
// caller is the runner itself. The generator asserts, over its actual write
// log, that no write originated in `tests/` — a NEGATIVE assertion, and a
// negative assertion passes when its pattern matches nothing, which is exactly
// what a BROKEN guard produces (manifest §5).
//
// This file is that positive control. It lives here rather than in the runner
// for a reason worth recording: the control must ATTEMPT a direct write to
// prove the refusal fires, and an attempted direct write is textually
// indistinguishable from the defect — so the source tripwire flagged it, on the
// first run, correctly. Rather than exempt the runner from the tripwire (which
// would blunt it for every future file), the control moved here. It needs no
// database, and it covers more than it did in the runner.
//
// WHAT THIS CANNOT PROVE, stated rather than implied: the ALLOW path. Producing
// a genuine `/src/` stack frame from a unit test would mean shipping a caller
// under `src/` whose only purpose is to be called by a test — which is worse
// than the gap. The allow path is proven by the generator's own local run: 436
// engine writes, every one attributed and permitted. `isEngineCaller` is
// exported and exhaustively tested below, so the DECISION is covered here even
// though the stack capture is not.
// ═══════════════════════════════════════════════════════════════════════════

/** A minimal stand-in for the drizzle handle. Records what it was asked to do. */
function fakeDb() {
	const calls: string[] = [];
	return {
		calls,
		insert: (t: unknown) => {
			calls.push(`insert:${String(t)}`);
			return "inserted";
		},
		update: (t: unknown) => {
			calls.push(`update:${String(t)}`);
			return "updated";
		},
		delete: (t: unknown) => {
			calls.push(`delete:${String(t)}`);
			return "deleted";
		},
		execute: (q: unknown) => {
			calls.push(`execute:${String(q)}`);
			return "executed";
		},
		select: () => "selected",
		transaction: async (cb: (tx: unknown) => unknown) =>
			cb({
				insert: (t: unknown) => {
					calls.push(`tx-insert:${String(t)}`);
					return "tx-inserted";
				},
				select: () => "tx-selected",
			}),
	};
}

describe("isEngineCaller", () => {
	it("permits engine code under /src/", () => {
		expect(isEngineCaller("/Users/x/repo/src/server/bets/place.ts")).toBe(true);
	});

	it("permits library code under /node_modules/", () => {
		// Better Auth's drizzle adapter issues the users/accounts INSERTs during
		// createOAuthUser, so its frame IS the immediate caller there. Refusing it
		// would refuse participant creation itself.
		expect(
			isEngineCaller("/Users/x/repo/node_modules/better-auth/dist/adapter.mjs"),
		).toBe(true);
	});

	it("REFUSES a caller under /tests/", () => {
		expect(
			isEngineCaller("/Users/x/repo/tests/staging/generate.staging.test.ts"),
		).toBe(false);
	});

	it("refuses /tests/ even when the path also contains /src/", () => {
		// The refusal is checked FIRST and wins, so a runner living under a path
		// that happens to match an allowed substring cannot slip through.
		expect(isEngineCaller("/Users/x/repo/tests/src/helper.ts")).toBe(false);
		expect(isEngineCaller("/Users/x/src/repo/tests/helper.ts")).toBe(false);
	});

	it("refuses an origin it has never seen — a positive match, not a blocklist", () => {
		expect(isEngineCaller("/Users/x/repo/scripts/seed.ts")).toBe(false);
		expect(isEngineCaller("/tmp/anything.ts")).toBe(false);
		expect(isEngineCaller("")).toBe(false);
	});

	it("normalises Windows separators", () => {
		expect(isEngineCaller("C:\\repo\\src\\server\\bets\\place.ts")).toBe(true);
		expect(isEngineCaller("C:\\repo\\tests\\staging\\generate.ts")).toBe(false);
	});
});

describe("the proxy refuses a write issued from this test file", () => {
	// THE POSITIVE CONTROL. This file is under tests/, so every write below has
	// a tests/ immediate caller and must be refused.
	for (const verb of ["insert", "update", "delete", "execute"] as const) {
		it(`refuses .${verb}()`, () => {
			const guard = createWriteGuard(fakeDb());
			expect(() =>
				(guard.db as unknown as Record<string, (a: unknown) => unknown>)[
					verb
				]?.("bets"),
			).toThrow(DirectWriteForbiddenError);
		});
	}

	it("refuses before the underlying handle is touched", () => {
		// A guard that threw AFTER delegating would have already written the row.
		const target = fakeDb();
		const guard = createWriteGuard(target);
		expect(() =>
			(guard.db as unknown as { insert: (t: unknown) => unknown }).insert(
				"bets",
			),
		).toThrow(DirectWriteForbiddenError);
		expect(target.calls).toEqual([]);
	});

	it("names the table and the offending file in the refusal", () => {
		const guard = createWriteGuard(fakeDb());
		let message = "";
		try {
			(guard.db as unknown as { insert: (t: unknown) => unknown }).insert(
				"bets",
			);
		} catch (err) {
			message = String(err);
		}
		expect(message).toMatch(/DIRECT WRITE REFUSED/);
		expect(message).toMatch(/write-guard\.test\.ts/);
		expect(message).toMatch(/primitive 4/);
	});

	it("refuses inside a transaction callback too", async () => {
		// Guarding only the top-level handle would guard nothing that matters:
		// the engine writes through the `tx` drizzle hands its callback.
		const guard = createWriteGuard(fakeDb());
		const tx = guard.db as unknown as {
			transaction: (cb: (t: unknown) => unknown) => Promise<unknown>;
		};
		await expect(
			tx.transaction((inner) =>
				(inner as { insert: (t: unknown) => unknown }).insert("bets"),
			),
		).rejects.toThrow(DirectWriteForbiddenError);
	});

	it("does NOT intercept reads", () => {
		// A guard that refused selects would be unusable, and the generator's own
		// verification reads go through the same object in the real run.
		const guard = createWriteGuard(fakeDb());
		expect((guard.db as unknown as { select: () => string }).select()).toBe(
			"selected",
		);
	});

	it("records nothing when every write was refused", () => {
		const guard = createWriteGuard(fakeDb());
		try {
			(guard.db as unknown as { insert: (t: unknown) => unknown }).insert(
				"bets",
			);
		} catch {
			/* expected */
		}
		expect(guard.writes()).toEqual([]);
		expect(guard.forbiddenTableWrites()).toEqual([]);
	});
});

describe("the forbidden table set", () => {
	it("is exactly the eleven ADR-0036 primitive 4 names", () => {
		expect([...FORBIDDEN_DIRECT_WRITE_TABLES].sort()).toEqual(
			[
				"bet_receipts",
				"bets",
				"bookmarks",
				"comments",
				"dharma_ledger",
				"events",
				"mod_actions",
				"payout_events",
				"pools",
				"positions",
				"resolution_events",
			].sort(),
		);
	});

	it("is non-empty", () => {
		// `forbiddenTableWrites()` filters against this list; an emptied list
		// would make that filter return nothing and every check pass.
		expect(FORBIDDEN_DIRECT_WRITE_TABLES.length).toBe(11);
	});
});
