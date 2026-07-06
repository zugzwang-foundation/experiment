import { describe, expect, it } from "vitest";

import { testClient } from "../_fixtures/db";

// AUDIT-FIX-B7b A31 (RED-first) — the positions.market_id index. The three W-3
// settle/correct/void flows read EVERY position row for a market by
// `WHERE market_id = $1` with NO side filter, and `positions.market_id` is a
// declared FK to `markets.id` with no leading index (the AGENTS.md §6 "FKs
// indexed on the referencing side" gap). A31 adds a PLAIN, NON-unique btree
// index named `positions_market_id_idx` leading on `market_id` (sibling
// precedent: `bets_market_id_idx`, `bet_receipts_market_id_idx`).
//
// RED reason: migration 0023 (which creates the index) does not exist yet on
// disk — the local :54322 is migrated through 0022 only — so the catalog query
// returns ZERO rows and `toHaveLength(1)` fails for the RIGHT reason (index
// absent, not a malformed query). First pg_indexes/pg_index catalog test in the
// suite — mints the `tests/db/indexes/` directory precedent.

describe("AUDIT-FIX-B7b A31 — positions_market_id_idx", () => {
	it("positions-market-id-index::exists-nonunique-btree-leading-market-id", async () => {
		// `indisunique` (uniqueness) + `amname` (access method) come straight from
		// the catalog; the leading key column is read from the NORMALIZED
		// `pg_get_indexdef` (which prints `USING btree (market_id)` — the identifier
		// is only quoted if it needs quoting, so the regex keeps the quote optional).
		const rows = (await testClient.unsafe(
			`SELECT i.indisunique AS is_unique,
			        am.amname AS access_method,
			        pg_get_indexdef(i.indexrelid) AS indexdef
			 FROM pg_class c
			 JOIN pg_index i ON i.indexrelid = c.oid
			 JOIN pg_class t ON t.oid = i.indrelid
			 JOIN pg_am am ON am.oid = c.relam
			 WHERE c.relname = 'positions_market_id_idx'
			   AND t.relname = 'positions'`,
		)) as unknown as Array<{
			is_unique: boolean;
			access_method: string;
			indexdef: string;
		}>;

		// exists
		expect(rows).toHaveLength(1);
		// NON-unique
		expect(rows[0]?.is_unique).toBe(false);
		// btree access method
		expect(rows[0]?.access_method).toBe("btree");
		// leading key column is market_id (plain single-column, no side)
		expect(rows[0]?.indexdef).toMatch(/USING btree \(\s*"?market_id"?[\s,)]/);
	});
});
