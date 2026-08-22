# RANK-2 — session log

**Time:** 2026-08-22, 09:28 → ~13:0x IST (autonomous, three ordered steps)
**Plan:** `docs/plans/RANK-2.md`
**Worktree:** `/Users/hrishikesh/code/zugzwang/wt-rank2`, branch
`fix/rank-2-self-reply-attraction`, cut from `origin/main` `4c64e40`

---

## What landed

**Two operational changes with no PR, and one PR.**

| Step | Outcome |
|---|---|
| **1 · the 0025 hash drift** | Corrected on the **local** test DB and on **staging**. `/api/health` `migrations`: **`drift` → `ok`**. Production untouched (it never applied the pre-edit text). |
| **2 · staging → main** | `origin/staging` `b851858` → **`4c64e40`**. Staging Migrate success; health `env=staging, db=ok, canary=4c64e40, migrations=ok`; **8 markets, 0 `sp-*`**. |
| **3 · the count lanes** | PR — self-authored replies excluded from the count lanes and the attracted-value aggregates. |

New file: `scripts/fix-migration-hash-drift.ts` (guarded, committed, repeatable).
Changed: the four aggregate SQL sites, `src/lib/ranking.ts` (contract docs),
ADR-0039 (**patch record P2**), RANKING.md, SPEC.2 §5.4, two test files.

## Decisions made

1. **Re-derived the 0025 safety claim rather than trusting the brief.** Three
   independent methods agreed: empty diff of the executable remainder, identical
   MD5 both sides, 0 non-comment changed lines of 27. Also checked for `/* */`
   block comments so no comment form was missed. The security auditor later
   re-derived it a *fourth* way, stripping differently and getting a different
   MD5 — both showing identity, which is the point.
2. **The predicate lives in the `ON` clause, never the `WHERE`.** In a `WHERE` it
   would drop any post whose only replies are self-replies out of the result set
   entirely. Pinned by a two-part regex in the parity test.
3. **`reply-substrate.ts` deliberately NOT filtered**, asserted *positively*. A
   future reader applying the predicate "consistently" to all five sites would
   silently delete a participant's own arguments from their lane.
4. **`profile/tiles.ts` left alone** — a per-user display tile, not a ranking
   input, already docketed. Merging two decisions into one PR is how a ruling
   gets applied where nobody ruled it.
5. **The ruling text was NOT edited; the measurement was recorded beside it.**
   The founder-authored residual-risk sentence prices multi-account capture at
   "six accounts … Turnstile … rate limits". Measured: **one** account, **five**
   replies, **≈ 3 attoDharma**, no Turnstile on the Google path. The words stay;
   the price is now on the record next to them.

## Open questions

| # | Question | Owner |
|---|---|---|
| **RANK-2-D1** | **The rendered footer and the lane now disagree.** `supportCount`/`supportDharma` are simultaneously ranking inputs and the rendered "Replies · N" / split bar. A post with six self-replies renders `Replies · 0` above six visible replies; the `.md` export prints `replies: 6` in front matter and `0 support, 0 counter` on the post. Does the ruling's exclusion govern the *displayed* figure, or only the lane inputs? | founder |
| **RANK-2-D2** | **A new SC-1 differential.** `loadReplySubstrate` is unfiltered and includes removed replies; the aggregate is filtered. Their difference *is* the self-reply count, and both render on the same surface — including the **public, signed-out `/m/[slug]/export`**. An observer can attribute a removed reply to a named pseudonym. Recommended resolution: an additive self-inclusive `totalReplyCount` (fixes D1 too). | founder — **before merge** |
| **RANK-2-D3** | **Residual capture is 6× cheaper than the ruling states**: one sybil, five replies, ~0 Đ, permanent, and free against any market where no post clears a lane — which is every quiet market and every market's first days. Levers if the price should be raised: `COUNT(DISTINCT rc.user_id)` for traction, or a per-`(user, parent)` reply cap. Both are ranking-semantics rulings. | founder |
| **RANK-2-D4** | `profile/tiles.ts` now has **two** reasons to be wrong, not one: it still sums frozen stake (**RANK-1-D3**) *and* self-replies still inflate it, while the per-post footers on the same page read zero. Rule on both together. | founder |
| **RANK-2-D5** | The write-capable staging script has no **intent-token** guard (the ADR-0035 G-5 analogue that `lots-1-staging-wipe.ts` carries), and no ADR. Does a committed write-capable script warrant one under §5.12? | founder / ops |
| **SURPRISE** | Every per-IP rate limit takes `xff.split(",")[0]`. If Vercel *appends* to a client-supplied `X-Forwarded-For` rather than replacing it, every per-IP cap — including the admin-login brute-force cap — is attacker-controlled. Unverified from inside the repo; the check is `x-vercel-forwarded-for` vs `x-forwarded-for` on a live preview. **Separate task.** | ops |

## Next session starts at

**Rule on RANK-2-D2 before merging the PR** — it is a masking leak this change
introduces, and it is the only finding that argues against merging as-is. D1 has
the same resolution. Everything else is docket.

## Context to preserve

- **`scripts/fix-migration-hash-drift.ts` now takes THREE positional arguments**
  (`<old-sha256> <new-sha256> <folderMillis>`). Staging was corrected with the
  earlier two-argument form; that run is verified and idempotent, so nothing is
  owed. The third argument exists because a hash alone does not name a
  migration — a mistyped old hash that matched a different migration's current
  hash would have rewritten *that* row.
- **`/api/health` and `db:check-drift` are NOT the same gauge.** `check-drift`
  compares the `created_at` head and count (ADR-0022) and was **green throughout
  this drift**; `/api/health` does a per-hash multiset compare (ADR-0024 §6) and
  was the only thing that could see it. Do not cite either as "the" check.
- **`zz_rank1` (the local isolated DB from RANK-1) is still current** and was
  reused here. Safe to drop: `DROP DATABASE zz_rank1;`.
- ⚠ **ADR-0035's G-3 guard hard-codes `current_database() = "postgres"`**, so
  `tests/integration/staging-reset-mechanism.integration.test.ts` (3 assertions)
  refuses any isolated database. Run that one file separately against the default
  DB: **49/49**.
- ⚠ **Two zsh bugs bit this session, both in my own commands, both caught by
  reading output rather than an exit code**: unquoted `$VAR` does not word-split
  (a loop ran once over 53 filenames and reported a false HALT), and `$VAR:refs/…`
  applies the `:r` *modifier* (a push refspec silently lost four characters and
  failed closed). Use `while IFS= read -r` and `${VAR}` in this shell.
- The reproduction test `tests/server/lots/self-reply-capture.test.ts` was RED on
  `4c64e40`, and its over-exclusion control was **mutation-tested**: flipping the
  predicate to `rc.user_id <> rc.user_id` leaves the exploit test green and turns
  the control red. That is the silent failure it exists for.
