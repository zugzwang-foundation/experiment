-- 0004_seed_system_state.sql — SCAFFOLD.2 stratum 3.C
-- system_state singleton row mint per SPEC.2 §20.2.
--
-- The row exists from day 1 of the experiment with frozen_at = NULL;
-- the conclusion-event freeze at 2026-11-05 23:59 UTC (per SPEC.2 §20.1)
-- is the single UPDATE that flips frozen_at to a timestamp. The §6.3
-- Bucket-B trigger on system_state forecloses re-firing or thawing
-- (recovery via BREAK_GLASS.md only).
--
-- ON CONFLICT (id) DO NOTHING makes re-apply idempotent — if 0004 has
-- already run, the second invocation is a no-op and does not error.
-- Triggers from 0003 fire on UPDATE / DELETE only; INSERT bypasses them.

INSERT INTO system_state (id, frozen_at) VALUES ('system', NULL)
ON CONFLICT (id) DO NOTHING;
