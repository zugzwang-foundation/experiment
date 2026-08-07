# STAGING-PARITY — close-out DRAFT

> ✅ **PROMOTED — this draft is SUPERSEDED. The close-out is
> [`STAGING-PARITY-closeout.md`](./STAGING-PARITY-closeout.md) (D.5, 2026-08-08).**
>
> D.4's walkthrough ran and its outcome is recorded there: **6 of 10 routes
> failed**, diagnosed as POOL-1 / PERF-1 and **ruled application defects the
> fixture set surfaced**, not fixture defects.
>
> **Kept, not deleted.** The four rulings below are the primary record of
> decisions made *before* the walkthrough reported, and the close-out cites
> them rather than restating them — V-5's full argument in particular lives here
> (it was numbered "L-8" at the time; see §1).
> Read this for the arguments; read the close-out for the state.
>
> **Status:** closed. Opened 2026-08-07 IST after Slices C+D merged (`5547727`,
> PR #301); promoted 2026-08-08.

---

## Ratified at D.4 prep — four items

### 1 · V-5 · negative controls must SPAN failure classes, not accumulate within one

**Standing verification lesson. Successor to V-1 and V-2.** *(Carried as "L-8"
when this draft was written; renumbered into V-space at SYNC-1, 2026-08-08, per
the D.4 ruling. Canonical text: `docs/polish/POLISH-0_data-manifest.md` §5.)*

> Negative controls must **span failure classes**, not accumulate within one.

**The evidence, from Slice C/D.** Three negative controls were run against the
new gates, and each one did what it was built to do:

| Control | Injected | Caught by |
|---|---|---|
| NC-1 | a `bet.placed` payload's `stake` corrupted | G1.6 |
| NC-2 | a market's `status` flipped | gate 4 |
| NC-3 | a `positions.quantity` shrunk | G5.5 · G5.6 |

All three passed. All three were **magnitude corruptions** — a value changed to
a different value. So the set was three samples of one failure class wearing
three gate names, and **none of them could have caught a scoping error**: a
probe that asks "does *anyone* hold an open position" instead of "does *this
user* hold one" fails only when a specific subject's row is missing while
another's survives, which no magnitude corruption produces.

`@code-reviewer` found exactly that defect in four gate-4 probes (HIGH-1),
*after* the three controls had all reported green. The controls were not weak
individually; the **set** was, and its weakness was invisible from inside it —
adding a fourth magnitude corruption would have raised confidence without
raising coverage.

**The rule this yields.** Before trusting a control set, enumerate the failure
CLASSES the artifact can exhibit — wrong value · wrong subject · missing row ·
wrong count · stale read · right answer for the wrong reason — and check the set
spans them. *Three green controls* is a statement about how many were run, not
about what they reach.

**Why it succeeds V-1 and V-2.** V-1 (a test that reassembles a lookalike proves
nothing about the shipped one — used twice in `STAGING-PARITY-A.md`, once
against its own author) and V-2 (a negative assertion needs a positive control)
are both about a control being weaker than it looks. V-5 is the same failure at
the level of the SET rather than the individual control: every member sound, the
collection still blind.

---

### 2 · Gate 5's SQL / shipped-reader split — **ACCEPTED**

Manifest §4 gate 5 says the assertions run "as SQL against the generated data".
Slice C implemented the AGGREGATE criteria (G5.1, G5.3, G5.4) as raw SQL and the
DERIVED criteria (G5.2, G5.5, G5.6) as calls to the **shipped readers**
(`getHeaderBalance`, `getHeaderPortfolio`, `loadProfilePositions`,
`loadProfileTiles`) against the live database.

**Ruled: accepted, and stronger than the manifest specified.** Reading through
the shipped reader proves **the surface renders the figure**, not merely that
the data contains it — which is what a gate about *Đ-rendering surface classes*
is actually for. Restating Đb or `netProfitLoss` in SQL would have satisfied
gate 5's letter by violating gate 2's *"do not re-derive the identity in the
test"*, and the ENGINE.10 pool-cash-vs-reserve-sum precedent shows which way
that goes wrong.

The manifest's prohibition targets *"unit assertions over hand-built objects"* —
fabricated inputs. Neither shape fabricates an input.

*(No manifest amendment was raised for this. Unlike the gate-3 wording
correction, which became v1.3 C1, this interpretation is recorded here and in
the gate's own header rather than in §4.)*

---

### 3 · `staging-coverage.json` committed — **ACCEPTED**

Plan Q4 says the coverage list is "emitted as a build artifact per run, **not**
committed as a fixed file". It is committed.

**Ruled: accepted.** Q4's stated rationale is that "UUIDv7 primary keys and all
timestamps" are non-deterministic — and **the artifact carries neither**. It
holds ids, slugs, pseudonyms, probe SQL and prose, all stable by construction,
which is why two cold rebuilds produced it byte-identical (md5 `2b6b0bc4`).

The deviation also buys something the plan could not: because the file is
committed, gate 4 **compares against it and fails RED on drift**, which turns
constraint 3's re-runnability from a property verified by hand once into an
assertion that runs on every rebuild. Demonstrated live during the review pass —
the probe changes drift-failed the gate before the new artifact was committed.

---

### 4 · Inherited setup cost for POLISH — the local proving loop

**Carry this into POLISH.0's environment notes.** The loop documented in
`STAGING-PARITY-CD.md` now needs **two things Slice B's did not**:

- **R2 credentials**, because C7 performs a real presigned `PUT`. A local run
  without them fails at the image step, not at the database.
- **a loopback `DATABASE_URL` override**, because `doppler run --config stg`
  sets `DATABASE_URL` to *staging*, and local mode refuses a non-loopback host
  (fail-closed, correctly).

```
doppler run --project zugzwang-experiment --config stg -- env \
  DATABASE_URL=postgresql://postgres:postgres@localhost:54322/postgres \
  ZUGZWANG_STAGING_TARGET=local \
  ZUGZWANG_STAGING_WRITE_ACK=generate-staging-fixtures \
  pnpm vitest run --config vitest.staging.config.ts tests/staging/<runner>
```

⚠ It also needs a **serially seeded** local `identity_pool` for pseudonyms to
match staging — see the `docs/parked.md` docket row on the missing FIFO
tiebreak. `pnpm seed:identity-pool:dev` does **not** work (it imports the
`@/db` → `server-only` chain and throws under `tsx`); the 200 tuples have to be
inserted one statement at a time.

---

## Still open at the time of writing

- **D.4** — the operator walkthrough. Nine URLs, `RedFox000`. Not yet run.
- **D.5** — the real close-out, which records D.4's outcome. Blocked on it.
- Two `superseded` rows are pre-recorded (**PD-0-17**, **PD-0-18**) so the
  walkthrough does not spend a founder review-hour on known-correct behaviour.
