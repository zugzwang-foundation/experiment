# DECISION RECORD — amendment 2.8

**Amends** `RECORD-v2.0.md` · follows every prior amendment · **Opened** 2026-09-18
**Ruling** D-49

---

## D-49 · Six markets, and one pre-launch wipe to get there

**Ruled** 2026-09-18 · **Task** MKT-ROSTER-1 · **Recorded on** ADR-0035 and ADR-0036 by callout, for one run each

### Ruling

1. **Six markets.** MKT-MUM-01 (`mumbai-bmc-pink-october-disclosure`) and MKT-OKT-01
   (`oktoberfest-munich-beer-volume`) are removed from the product. Nothing of either remains in
   either database, in object storage, in any cache, or in code outside `docs/`. The roster is
   MKT-BTC-01, MKT-CHE-01, MKT-CLA-01, MKT-GIT-01, MKT-MAT-01 and MKT-YCP-01.
2. **All data is test data.** The experiment has not launched. The founder reviewed production's
   114 accounts — 100 `@loadtest.example.com` and 14 `@gmail.com` belonging to himself and his
   testers, with 1,507 bets between them — with those numbers in front of him, and ruled them
   disposable.
3. **Method: wipe, then restore.** Each environment is backed up with `pg_dump`; its six market
   definitions and its `identity_pool` are saved; its test data is truncated in one transaction;
   the saved pool goes back unassigned; and the six are re-created through `createMarket` /
   `openMarket` from that environment's own definitions, at the original opening (`p_yes` 0.1,
   tank 100,000). No row is edited or deleted individually. The schema admits no other way:
   every foreign key into `markets` is `RESTRICT`, and Bucket A refuses row deletes.
4. **One production run, then gone.** ADR-0035 holds that no production reset exists; ADR-0036,
   that no operational runner touches production. For this one pre-launch run both give way: a
   production wipe that exactly mirrors the staging batch, and a production restore runner under
   its own opt-in config — each run once, from a branch that is never merged and is closed
   afterwards. Both ADRs stand in full for every other purpose.
5. **No invariant is weakened.** Only the `*_no_truncate` guards are lifted, inside the one
   transaction, and re-enabled within it. `*_no_update`, `*_no_delete` and
   `bucket_b_update_check` are never touched. `system_state`, `liquidity_policy` and
   `drizzle.__drizzle_migrations` are never truncated. The end state satisfies INV-1…INV-4 and
   the full guard catalogue.
6. **Out of scope.** The v3.0 market edits, the six-tile Discovery layout, and any structural or
   architectural change.

### What remains afterward

Git history · the database provider's own backups, until they expire · analytics and error logs ·
X posts · `docs/`. Operational tables outside the truncate set (`admin_sessions`, `cron_alarms`,
`watermark_state`, `liquidity_heartbeat`) are kept; any row in them that names either market is
deleted.

**Enforced at** the MKT-ROSTER-1 one-time tooling (closed unmerged) · the callouts on ADR-0035
and ADR-0036.

---

*End amendment 2.8.*
