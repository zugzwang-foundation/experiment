# S-1 · Stage 3 prep — session log

**Task:** S-1 — transaction pooler migration. This session: verify the Q1 work, reconcile the
plan to the Gate C route, apply the two Stage 3 reversals, publish the branch.
**Ritual:** CC-LIGHT, gated. `ultracode` FORBIDDEN, not used. No subagents invoked (the
cascade is step 3 of the sequence and has not run).
**Ground:** `origin/main` @ `193d95a`.

> Continues `docs/logs/S-1.md` (the recon + Stage 2 session). That file is not amended.

---

## What landed

| Commit | Files | Content |
|---|---|---|
| `74c3400` | `src/db/index.ts`, `tests/unit/db/pooler-mode.test.ts`, `scripts/ci-env-parity.ts`, `scripts/s1-criterion6-control.ts`, `docs/plans/S-1.md`, `docs/adr/0038…md` | Q1 verified; six operative plan sections reconciled to the advance route (O-5) |
| `4b97f0a` | `docs/plans/S-1.md`, `scripts/ci-env-parity.ts`, `scripts/verify-pooler-mode.ts` | the two Gate C reversals; parity file restored to `main`; control script renamed and reclassified as shipping |
| *(this commit)* | `docs/logs/S-1-stage3.md` | this log |

---

## ⚠ THE FORCE-PUSH — pre/post SHAs on the record

Recorded so the tree-hash question does not reopen. Force-push was granted at the Gate C
relay *(and, per that relay, had been granted the round before — see Open questions)*.

| | SHA |
|---|---|
| **Remote before** | `0efd1d513a55b8dd9dd9f6a984ab20335919c2a5` |
| **Remote after** | `4b97f0a7cdfa77988cb261a04b46d07dd3a564c8` |
| Rebase landing (prior session, local only) | `7e48af2` onto `193d95a` |

**Pushed with `--force-with-lease=refs/heads/fix/pool-transaction-mode:0efd1d5`** — an
unconditional `--force` was available and not used. The lease names the SHA the remote was
expected to hold, so a push landing on anything else fails instead of overwriting it. On a
branch whose tree-hash provenance was itself the question, that distinction is the whole point.

⚠ **The three-dot contribution is NO LONGER the `+692 / −3` recorded at the rebase, and saying
so matters.** That figure was evidence the *rebase* changed nothing. Two commits have landed
since, deliberately, so the contribution is now **7 files, +1411 / −7**. The rebase-invariance
claim stands for the rebase; it is not a claim about the branch today.

**Lefthook pre-push ran `biome-check-all` + `typecheck`, both green** — which before this
session's line-ending fix could not have happened at all (see below).

---

## Decisions made

1. **`core.autocrlf` fixed; `just verify` recovered.** The gate was structurally dead on this
   machine and is now live — see the next section.
2. **The parity file was NOT deleted, against the literal instruction.** `scripts/ci-env-parity.ts`
   pre-exists on `main` and `.github/workflows/env-audit.yml:51` runs it via `pnpm ci-env-parity`.
   Deleting it would have removed the scheduled Doppler↔Vercel audit rather than this task's
   addition to it. **Reverted to `origin/main` byte-identical instead**, and flagged in the reply
   rather than absorbed.
3. **The Doppler `stg` placement was verified before being relied on.** `ci-env-parity.ts` has
   exactly two finding classes — orphans and `missingRequired` over a four-name `REQUIRED_KEYS`
   — and **no cross-config parity check**, so a key in `stg` and absent from `prd` produces no
   finding. The reversal is safe with no script change.
4. **The A/B confound is removed, not accepted** — sample A is taken after the advance and
   *before* the flag is set, so both samples run one SHA. Written into §4.3 as a property being
   relied on, with an explicit warning that it holds only while the default is `session`.
5. **The control script ships** as `scripts/verify-pooler-mode.ts`, named for the measurement
   rather than a criterion of a task that closes, with **S-5** named in its docblock.
6. **The §1 file-set widening is dated, not backfilled** — recorded as a ratification made this
   session, because a widening written as though it always followed is indistinguishable from
   one nobody noticed.

---

## ⚠ The local gate was dead, and the fix is two minutes

`core.autocrlf=true` came from the **Git for Windows SYSTEM config** — not global, not local,
which is why it survived inspection of the obvious places. Every file checked out CRLF while
Biome expects LF.

| | before | after |
|---|---|---|
| `biome check .` | **743 errors / 743 files** | **0 errors** (6 warnings, 4 infos — pre-existing) |
| `vitest run tests/unit` | 12 files failed | **8 files failed** |
| `just verify` legs 1–2 | unusable | **exit 0** |

Fix: `git config core.autocrlf input`, then `git rm --cached -r . && git reset --hard` in each
worktree. Applied to **both** `experiment` and `experiment-b`.

**The four tests that stopped failing are exactly the four diagnosed as CRLF artifacts** before
the fix was applied — the prediction was made from an LF worktree and then confirmed by the fix,
rather than read off afterwards.

⚠ **The remaining 8 are pre-existing on `origin/main` and are a programme finding, not S-1's:**
Windows path-portability in source-scan tests — doubled absolute paths, backslash separators
failing `src/…` includes, one test needing a live Postgres, and `write-guard`'s caller
attribution failing to parse Windows stack frames. **A dev on Windows cannot run the unit suite
clean.** Carry to the programme close-out.

⚠ **`.gitattributes` does not exist in this repo.** That is the durable fix — the local config
change repairs two clones and nothing else, so the next clone on any Windows machine starts
dead again. **Flagged as a separate one-line PR, deliberately not bundled here.**

---

## Open questions

- **⛔ CI HAS NO BUILD LEG.** `ci.yml` runs install → biome → tsc → `drizzle-kit check` → strip
  pg_cron → migrate → `db:check-drift` → `vitest run`. **No `next build`.** So `just verify`'s
  third leg is gated by nothing in this repository, and the draft-PR route cannot close it.
  **The preview deployment is the build leg instead** (§3.1) — better evidence, since Vercel
  builds with real secrets on the platform prod runs on. *A finding about CI, not about S-1.*
- **`CLAUDE.md` §5.10 cascade exemption — a one-line statement was requested and given:** *it
  would add to §5.10 a rule that a waived reviewer cascade is scoped to the task that waived it
  and never becomes standing precedent; it blocks nothing mechanically, but without it LOTS-1's
  three unreviewed critical-path PRs (#371 / #373 / #375) stand as de facto precedent with
  nothing on `main` contradicting them.* Fourth session; anchor `### 5.10 Pre-PR self-audit`
  re-verified unique, so a ratified pass costs one edit.
- **The relay defect is real and worth knowing about.** Force-push permission was granted at the
  previous round and did not reach this session; it was re-requested and re-granted. One round
  of latency on a step that gates everything downstream.
- **`identity_pool` empty on staging** and **the Dev C R2-corruption warning unsent** — both
  carried forward from the prior log, both still outstanding, neither S-1's to close.

---

## Next session starts at

**Step 7 of the ratified sequence — the PREVIEW.** The exact next action is **the founder's
Doppler write (F-1b): `DB_POOLER_MODE=transaction` into Doppler `stg`, unscoped.** Nothing in
Stage 3 proceeds before it, and it is the only step in the sequence that is not mine.

Then, in order: preview → criteria 1, 2, 3a, 3b, 4, 5, 6 → cascade (`@test-writer` →
`@code-reviewer` → `@security-auditor`) → draft PR → Gate C → merge → advance (flag unset, code
inert) → sample A → set flag → redeploy → sample B → criterion 7 → close-out.

---

## Context to preserve

- **The merge deliberately carries no live behaviour change.** The code lands inert on its
  `?? "session"` default. Anyone changing that default converts the advance from a safe merge
  into a live flip and invalidates the A/B — §4.3 says so at the site.
- **Branch commits are unsigned and always were.** `required_signatures` is satisfied by
  GitHub's own PGP signature applied at squash time; the documented "signed commits (SSH,
  ED25519)" describes a local setup that does not exist. Next SYNC sweep, not a task.
- Worktree: `C:/Users/anupa/zugzwang/experiment-b` on `fix/pool-transaction-mode`. The primary
  tree `C:/Users/anupa/zugzwang/experiment` sits on `chore/s-1-log` at `7832f5a` — **stale, and
  unused by this session.**

---

## Time

Session ran 2026-08-22, roughly 14:50–16:10 IST. Ground `193d95a`. Three commits on
`fix/pool-transaction-mode`, force-pushed once with lease.
