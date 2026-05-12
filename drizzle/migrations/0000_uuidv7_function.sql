-- public.uuidv7() — RFC 9562 UUIDv7 generator
-- Copyright (C) The Zugzwang Authors. AGPL-3.0-or-later.
-- Adapted from a community pure-SQL gist (Fabio Lima / kjmph).
-- Source: https://gist.github.com/kjmph/5bd772b2c2df145aa645b837da7eca74
--
-- When Postgres 18 native uuidv7() ships on Supabase, drop this function
-- with `DROP FUNCTION public.uuidv7()` and pg_catalog.uuidv7() takes over
-- with no schema changes required. Per ADR-0016 §2.
--
-- LANGUAGE sql VOLATILE per ADR-0016 §1 (NOT plpgsql; NOT STABLE/IMMUTABLE).
-- clock_timestamp() not now() per ADR-0016 §1 — clock_timestamp() returns
-- wall-clock time at each call, monotonically advancing within a single
-- backend; now() returns transaction-start time and would emit identical
-- millisecond timestamps for back-to-back uuidv7() calls inside one txn.

CREATE OR REPLACE FUNCTION public.uuidv7()
RETURNS uuid
LANGUAGE sql
VOLATILE
AS $$
  SELECT encode(
    set_bit(
      set_bit(
        overlay(uuid_send(gen_random_uuid())
                placing substring(int8send(floor(extract(epoch FROM clock_timestamp()) * 1000)::bigint) from 3)
                from 1 for 6
        ),
        52, 1
      ),
      53, 1
    ),
    'hex'
  )::uuid;
$$;
