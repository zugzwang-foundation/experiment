# PFP-3 — spread the pseudonym number across 000–999 instead of spending one per pass

**Status:** awaiting sign-off · **Critical path:** yes — `src/server/identity-pool/` (CLAUDE.md §1)

## Why

`generatePoolTuples` sets `number: pass`, where `pass = floor(i / 871)`. Because `consumeIdentityPoolTuple` hands rows out FIFO in seed order, **the first 871 participants all get `000`**, the next 871 all get `001`. `seed-staging.ts` seeds exactly one pass, so every identity on staging today is `000`.

At the experiment's realistic scale — SPEC.1 sizes it at 1K–10K participants — only the first one or two numbers are ever reached. The number then carries no information and reads as a defect: a wall of `RedFox000`, `JadeOwl000`, `SilverZebra000`.

**This is a divergence, not a gap.** SPEC.1 §13 (line 765) already specifies "Numbers: `000`–`999` zero-padded; 10 deterministically-selected per `(colour, animal)` pair via hash-derivation (per ADR-0011)", and ADR-0011 names the properties: reproducible, "visually varied (numbers spread across the range, not clustered)", and collision-free on pool extension. `rotation.ts` shipped a pass counter instead. **No spec amendment is needed; the specs already say the right thing.**

## The change

Per `(colour, animal)` pair, derive an affine permutation of 0–999 from `sha256(colour:animal:version_tag)`:

```
number(pair, pass) = (a * pass + b) mod 1000
```

`b` is a hash-derived offset, which is what spreads the FIRST pass across the whole range rather than parking it on `000`. `a` is drawn from the 400 residues coprime to 1000 (`1000 = 2^3 * 5^3`, so odd and not a multiple of 5 — `phi(1000) = 400`). Coprimality is what makes the map a bijection, so distinct passes of one pair can never collide on a number. **Drawing `a` from a precomputed coprime table makes that hold by construction rather than by argument** — the first draft computed `a` arithmetically, carried a comment asserting it was never a multiple of 5, and produced 6 colliding tuples in 8,710, which the unique index `identity_pool_tuple_idx` would have rejected at seed time.

Verified exhaustively over the whole 871,000-tuple namespace: **0 duplicate `(colour, animal, number)` triples**. First pass yields 595 distinct numbers across 871 rows, spread 70/77/108/94/73/98/74/86/103/88 across the ten decades. First twelve signups read `770 773 303 042 580 896 497 786 068 235 640 708`.

Everything else is untouched: the CRT walk that picks the pair, `variant = pass % PFP_VARIANTS[animal]`, the pfp filename, the 871,000 namespace ceiling, and the purity that makes the generator resumable.

| File | Change |
|---|---|
| `src/server/identity-pool/rotation.ts` | coprime table + per-pair coefficients; `number: pass` becomes the affine draw |
| `tests/unit/identity-pool/rotation.test.ts` | the three assertions that pin `number = pass`; add: bijection per pair over all 1000 passes, no duplicate triple across the namespace, first-pass spread, determinism across runs |
| `docs/adr/0011-pseudonym-pool-design.md` | Patch record — the divergence and its discharge |

No schema change, no migration, no handler, no transaction. The four invariants are untouched — a pseudonym number is not a bet, a ledger row, or a resolution.

## Operational consequence, which is the part to weigh

The pool is **pre-seeded data**, so the fix only reaches identities seeded after it lands. Staging currently holds 1,070 rows, **220 already assigned**, all numbered `000`. Options:

1. **Re-seed staging** (`pnpm staging:reset` — ADR-0035 guarded) so the whole pool is consistent. The 220 assigned identities change pseudonym. SPEC.1 makes pseudonyms permanent, but these are fixtures, and the guarded reset is the sanctioned mechanism.
2. **Leave the assigned rows** and re-seed only the unassigned ones, giving a pool that is part `000` and part spread. Cheaper, permanently untidy.

Prod is clean either way: no pool is seeded there and no PFP bucket exists (PFP-1 open question 5).

## Verification

- `pnpm vitest run tests/unit/identity-pool/` — 30 existing tests plus the new property tests.
- `just verify` with `ZUGZWANG_ENV=preview`.
- Re-seed staging, then read the first page of Discovery and confirm the numbers vary.
