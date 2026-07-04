import { afterEach, describe, expect, it } from "vitest";

import { users } from "@/db/schema";
import { DharmaPoolTagError } from "@/server/dharma/errors";
import { appendLedgerRow } from "@/server/dharma/persist";
import { testClient, testDb } from "../../db/_fixtures/db";
import { truncateTables } from "../../db/_fixtures/truncate";

// ENGINE.5 §5.6 tests-first — INV-2 (Dharma non-transferable), SPEC.1 §5:159.
// DB-BACKED: cannot RED locally (local Postgres :54322 is DOWN per PROBE-3;
// ECONNREFUSED is an INFRA failure, NOT an assertion red). First true run is
// CI on the PR, post-implementation. Written type-correct + behaviorally
// complete so CI is green. The greenfield value imports
// (`appendLedgerRow` / `DharmaPoolTagError`) keep this from resolving until
// ENGINE.5 lands.
//
// Three structural / behavioural proofs that Dharma cannot be transferred:
//   (a) NO `dharma_transfer` table exists — CLAUDE.md §3 "no transfer surface"
//       refusal, proven structurally against information_schema.
//   (b) entry_type + user_id are NOT NULL on dharma_ledger — every row is a
//       tagged, owned flow (raw NULL insert → Postgres 23502 not_null).
//   (c) the write path rejects the 2 pool tags — admin↔pool flows can NEVER
//       become a user ledger row (R-2 dormant; DharmaPoolTagError).

describe("INV-2: Dharma non-transferable (no transfer surface)", () => {
	afterEach(async () => {
		await truncateTables(testClient, ["dharma_ledger", "users"]);
	});

	it("dharma-non-transferable::no-dharma-transfer-table-exists", async () => {
		// Structural proof of the CLAUDE.md §3 refusal: there is no table whose
		// name even suggests a user↔user transfer surface.
		const rows = await testClient<{ table_name: string }[]>`
			SELECT table_name
			FROM information_schema.tables
			WHERE table_schema = 'public'
			  AND table_name LIKE '%transfer%'
		`;
		expect(rows.length).toBe(0);
	});

	it("dharma-non-transferable::entry_type-not-null-enforced", async () => {
		const [user] = await testDb
			.insert(users)
			.values({
				name: "NT User A",
				email: "nt-a@example.com",
				pseudonym: "nt-user-a",
			})
			.returning({ id: users.id });

		// Raw insert bypassing the app layer — a NULL entry_type must be
		// rejected by the column NOT NULL (Postgres 23502).
		await expect(
			testClient.unsafe(
				`INSERT INTO dharma_ledger (user_id, entry_type, amount, balance_after)
				 VALUES ($1, NULL, '100', '100')`,
				[user?.id ?? ""],
			),
		).rejects.toMatchObject({ code: "23502" });
	});

	it("dharma-non-transferable::user_id-not-null-enforced", async () => {
		await expect(
			testClient.unsafe(
				`INSERT INTO dharma_ledger (user_id, entry_type, amount, balance_after)
				 VALUES (NULL, 'daily_allowance', '100', '100')`,
			),
		).rejects.toMatchObject({ code: "23502" });
	});

	it("dharma-non-transferable::write-path-rejects-pool_seed", async () => {
		const [user] = await testDb
			.insert(users)
			.values({
				name: "NT User B",
				email: "nt-b@example.com",
				pseudonym: "nt-user-b",
			})
			.returning({ id: users.id });

		await expect(
			testDb.transaction(async (tx) => {
				await appendLedgerRow(tx, {
					userId: user?.id ?? "",
					amount: "100",
					entryType: "pool_seed",
				});
			}),
		).rejects.toThrow(DharmaPoolTagError);
	});

	it("dharma-non-transferable::write-path-rejects-pool_unwind", async () => {
		const [user] = await testDb
			.insert(users)
			.values({
				name: "NT User C",
				email: "nt-c@example.com",
				pseudonym: "nt-user-c",
			})
			.returning({ id: users.id });

		await expect(
			testDb.transaction(async (tx) => {
				await appendLedgerRow(tx, {
					userId: user?.id ?? "",
					amount: "100",
					entryType: "pool_unwind",
				});
			}),
		).rejects.toThrow(DharmaPoolTagError);
	});
});
