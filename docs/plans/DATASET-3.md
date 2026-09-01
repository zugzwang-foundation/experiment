# DATASET.3 — the closing pass

**Task** DATASET.3 · deny-by-default payload strip, provenance partition, and the
remaining ratified rulings
**Branch** `feat/dataset-1-export-pipeline` — CONTINUED · **PR** #435, stays OPEN
**Brief** `ZUGZWANG_DATASET-3_overnight-brief_v1_2.md`
**Written** 2026-09-01, after the `origin/main` merge, before slice 1

> This plan exists because CLAUDE.md §5.11 says a subagent that is handed no plan
> re-explores the codebase from scratch, and DATASET.2 had none to pass. It is
> written after the merge and against the merged tree, so every file reference in
> it is a reference to code that exists at `92f30d5`.

---

## 0 · The core idea, in prose

`events.payload` is a `jsonb` column. Its shape is open: anyone adding an event
type, or adding a key to an existing type's payload, extends it. The export
pipeline's payload strip is a **deny-list** — SPEC.2 §19.4.1 names, per event
type, the keys that must be removed, and everything else ships.

Three nights have now found the same defect wearing three costumes, and each was
patched by extending a list: §19.5's six FK paths (Appendix B has ~14),
C3's one recovery path (`comment.placed.payload` rebuilds it by a shorter
route), and §19.4.1's STRIP key names (`payload.client.remoteAddr` is silent in
all four layers because no list spells it).

**The list is the defect.** A deny-list ships an unlisted key by default, and
"unlisted" is the normal state of a key nobody has thought about yet.

The table inventory already got this right one level up: a `pgTable` that is
neither `SHIPPED` nor `NOT_SHIPPED` nor `UNDECIDED` nor `EXCLUDED` fails the
build rather than defaulting either way. Slice 1 extends that property **inward,
to payload keys**: per event type, declare what SHIPS; every other key is
dropped, unread, at any depth and through arrays. A new event type ships nothing
until somebody says what it ships.

That closes the whole class rather than its three known members, and it is why
this is a night rather than an afternoon.

---

## 1 · Ground, as measured (not as the brief states)

| # | Measure | Value |
|---|---|---|
| G1 | branch head, pre-merge | `77bc4281983b8672ba216f8b405c8604ede6754b` |
| G2 | `origin/main` | `4c041633fc98cf4705c2dbef54e980acf016e63d`, 111 behind / 18 ahead, merge-base `acb71cb2` |
| G3 | PR #435 | OPEN, base `main`, one local conflict: `.gitignore` |
| G4 | SPEC.2 | `main` `1.0.27`, branch `1.0.28` (uncontested) ⇒ this task bumps to **`1.0.29`** |
| — | merge commit | `92f30d5`, `.gitignore` resolved by union (82 lines = 71 base + 4 branch + 7 main) |
| — | `EVENT_TYPES` | **24**, read at RUNTIME from the merged tree, never by regex |

---

## 2 · Slices, ordered. The order does not move.

### S1 · Invert the payload strip to a positive allow-list

**Files:** `src/server/export/egress/forbidden-keys.ts` ·
`src/server/export/dataset/strip.ts` · `src/server/export/egress/completeness.ts`

`PAYLOAD_STRIP_KEYS` → **`PAYLOAD_SHIP_KEYS`**, a per-event-type **tree**:

```
type ShipNode = true | { readonly [key: string]: ShipNode };
```

`true` ships a **scalar leaf**. An object or array reached under `true` is a
contract gap and throws — that is the structural core: "ship this subtree
unread" must be unsayable, because it is deny-by-default's opposite. A nested
object is declared by nesting; an array applies its child spec to every element.

`stripPayload` becomes `shipPayload`: build a new object containing only
declared keys, recursing into the declared shape. Everything else is never
read.

**Byte-identity is the proof obligation.** SHIP sets are derived so today's
outcome is preserved exactly: `content_sha256` must be **identical** before and
after. If it moves, name the key and why before proceeding.

⚠ **That proof is weaker than it looks and needs a companion.** Canonical JSON
sorts both sides' keys, so the comparison is blind to ordering — fine — but it is
also blind to **any key the fixture does not carry**. A key that exists in
production and not in the fixture is untested by it. The assertion that CAN
fail: **compare the allow-list against `eventPayloadSchemas`** (the Zod payload
shapes in `src/server/events/schemas.ts`) per event type, and require every
schema key to be *classified* — either declared SHIP or deliberately dropped.
That is a source of truth the fixture cannot launder.

**Guards, each verified by reverting the fix and watching it red:**

| # | Guard | Wrong answer it rejects |
|---|---|---|
| G1 | unlisted key at depth 1 | a key nobody declared shipping because nobody thought to deny it |
| G2 | unlisted key at depth 3 (`payload.client.remoteAddr`) | DATASET.2 owed **E** — silent in all four layers |
| G3 | unlisted key inside an array element | depth handled for objects, not through arrays |
| G4 | new event type with no SHIP declaration | shipping its whole payload; must ship **nothing** and fail CI |
| G5 | `m/` market-media keys still ship | H-1's guaranteed total build failure |
| G6 | `true` over a non-scalar throws | "ship the subtree unread" — the inversion's own escape hatch |
| G7 | every `eventPayloadSchemas` key is classified | a production key the fixture does not carry |

### S2 · S1 (the ruling) — provenance partitions fatality

**Files:** `src/server/export/egress/assertions.ts` · `dataset/build.ts`

Today `EgressSecrets` is ten sets of strings with **no provenance**. A needle
harvested from `User-Agent` and one harvested from a UUIDv7 PK are
indistinguishable, so a participant who sets `User-Agent: Resolved` poisons the
one-shot release build: `Resolved` is `markets.status`, the value scan fires, and
`events` is Bucket A so the row cannot be deleted post-freeze.

**Derive from where the value ENTERS THE SYSTEM, not from a list of field
names.** Each harvest site is tagged at the moment it is read:

- `PARTICIPANT` — the value arrived in an HTTP request the participant controls
  (`User-Agent`, the `x-forwarded-for` first entry, an OTP email, a Google
  display name, a rejected comment body).
- `SYSTEM` — the value was minted server-side and no request can choose it
  (a UUIDv7 `users.id`, an admin `sessionId`, a server-minted R2 key, a Google
  `sub`).

A **VALUE-scan** hit on a `PARTICIPANT` needle is **advisory**; on a `SYSTEM`
needle it stays **fatal**.

⚠ **The KEY-shaped nets stay fatal in both cases, and that is what keeps the
partition from being drawn too wide.** The structural guarantee that
`metadata.ip` never ships is the allow-list, not the value scan — so downgrading
the value scan for participant-sourced needles removes a poisoning surface
without removing a guarantee. Wrong answers to reject in *both* directions are
in §4.

### S3 · S2 · S5 · H

- **S2 ruling** — `bets.idempotency_key` → `STRIP` (Appendix B.5) and
  `metadata.idempotency_key` → stripped (B.13). 255 bytes of participant-chosen
  text moderation never sees.
- **S5** — verify S1's inversion closed the `comment.placed.uploadId` recovery
  path. Under a declared SHIP set, `uploadId` ships only if listed; it must not
  be listed. Deliberate policy delta, measured separately from S1's mechanism
  proof.
- **H** — a `removedBodies` VALUE class, so R1 rests on harvest-and-scan and not
  on one predicate in `stripRow`. The canary must fail if that predicate is
  deleted.

### S4 · I · S6 · B

- **I** — `STRIPPED_COLUMNS` becomes **derived from `COLUMN_TREATMENTS`** (one
  declaration, not two), and the harvest reads a
  `Record<StrippedColumn, keyof EgressSecrets>` map. **The proof is a compile
  error**: add a `STRIP` column to Appendix B without a bucket and `tsc` fails.
- **S6** — full stored timestamp precision. ⚠ The fixture's `AT` is a single
  `…T12:00:00.000Z` constant with no sub-millisecond component, so the test is
  **blind by construction**. Widen the fixture FIRST; then the existing
  round-trip byte comparison becomes the guard, because the live reader
  truncates µs at the driver.
- **B** — one `REPEATABLE READ` `READ ONLY` snapshot for the whole build,
  spanning all sixteen reads **and their `count(*)` reconciliations**. Read-only.
  Does not gate the cron (S4 is a separate task) and does not touch
  `src/server/jobs/`.

### S5 · Four LOWs + the C7 measurement

Advisory paths printed nowhere · `skipped_needles` as a bare count with no rule ·
`manifest.source` unconstrained · `FREE_TEXT_COLUMNS` names a phantom column.
Then C7: **a number** for the artifact size at 100k users over 51 days, and
whether materialising every table three times fits.

### S6 · `/api/dataset/manifest` — CONDITIONAL

**Admitted.** SPEC.2 §19.7 states plainly what it is for — see §3 below.

### S7 · Cascade — `@security-auditor` FIRST, then `@code-reviewer`, then
`@test-writer`, sequentially, effort max. Then the mandatory F-11 re-run.

---

## 3 · Slice 6's admission test, decided against the text

Brief §4 Slice 6 admits the endpoint **only if §19.7 states unambiguously what
it is for**, given that `dataset-release.md` publishes via a GitHub release.

§19.7 (SPEC.2:2084–2109) states, without hedging:

> `GET /api/dataset/manifest`. Public read (no auth). Active **post-2026-11-06
> only** — pre-release the endpoint returns HTTP 503
> `error_dataset_not_yet_released`; post-release it returns the manifest JSON.

> The endpoint is a thin static-file pointer; **it does not serve the tarball
> itself (GitHub release assets serve directly). The endpoint exists to make
> programmatic discovery possible** (researcher tooling can fetch the manifest to
> verify checksums + schema version + table inventory before downloading the
> tarball).

⇒ **UNAMBIGUOUS, and it explicitly anticipates the GitHub-release path** rather
than conflicting with it. The endpoint is built: a `GET`, no auth, no DB, no
build-on-request, cached, with the pre-release state defined by the spec itself.
`@security-auditor` reviews it as a public route.

---

## 4 · Ambiguities resolved in advance, with the rejected alternative

| # | Ambiguity | Chose | Rejected | Why |
|---|---|---|---|---|
| A | Slice 1 must be byte-identical, but S5/F3 says `comment.placed.uploadId` stops shipping | **Two measured steps**: S1 preserves outcomes exactly (identical `content_sha256`), S3 applies S5 as a named policy delta | Fold S5 into S1 | A byte comparison that is *expected* to move proves nothing about the mechanism. Separating them is what makes S1's identity claim falsifiable |
| B | Does `true` ship a subtree? | **No — `true` is scalar-only and throws on a container** | `true` ships whatever is under it | "Ship unread" is the exact property the inversion exists to remove |
| C | Is the partition on the needle's SOURCE or the hit's DESTINATION? | **Source (provenance)** | Destination column (today's `FREE_TEXT_COLUMNS`) | S1 rules it as a property of where the value enters. Destination is what already exists and is what the C-1 attack walks around |
| D | Does the provenance downgrade cover KEY nets too? | **No — key nets stay fatal** | Downgrade everything participant-sourced | A key net is not poisonable: the attacker cannot choose a key NAME. Downgrading it is the "partition drawn too wide" failure |
| E | Where does the S6 timestamp fix live? | **The reader** — cast to text with µs | `escapeField` | The precision is already gone by the time `escapeField` sees a JS `Date`; postgres-js parsed it away at the driver |

---

## 5 · Reviewer-bearing slices

S1 (the inversion) and S2 (the partition) go to `@security-auditor` **first**.
S4 (derived harvest, snapshot, timestamps) and the merge resolution including
`.gitignore` go to `@code-reviewer`. Every guard added tonight goes to
`@test-writer`.

## 6 · Walls honoured

No production or staging Postgres · no `pnpm staging:rebuild` · no push to
`main`/`staging` · no force-push, no rebase · #435 never merged · no document
edited except F1–F5 · no ADR minted, ceiling never read · no widening into
`src/server/jobs/`, the `x-forwarded-for` parse, erasure, or
`src/components/art/warli/` · no write to `system_state` · commit identity
verified mechanically before pushing · `ultracode` / dynamic workflows NOT used.
