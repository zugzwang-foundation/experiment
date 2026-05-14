# PRECURSOR.5 — close-out

> Task-level close-out per CLAUDE.md §5.9. Surgical doc + tooling sweep — no
> `/plan` ritual per CLAUDE.md §5.1 trivial-work exception (doc-only + config
> edits, kickoff explicit).

- **Task:** PRECURSOR.5 — CLAUDE.md / SPEC.2 / tooling drift sweep
- **Closed:** 2026-05-14
- **Branch:** `chore/precursor-5`
- **PR:** TBD (this commit + log commit + PR open)
- **Plan ritual:** SKIPPED per §5.1 (kickoff explicit)

---

## What landed

7 surgical edits across 4 files. No source code touched.

- **EDIT 2 — `justfile` dotenv-load.** Added `set dotenv-load := true` near
  the top of `justfile`. `db-migrate`, `test-db`, `verify` now source
  `.env.local` automatically. Removes the manual `DATABASE_URL=... <cmd>`
  workaround used in every SCAFFOLD.2 stratum.
- **EDIT 3 — `.gitignore` additions.** Added `supabase/` (CLI runtime state:
  `.branches/`, `.temp/`, `snippets/`) and `claude-progress.md` (CC
  working-note convention). Inline comment flags that future
  `supabase/migrations/` (RLS policies per AGENTS.md §3) will need a
  `!supabase/migrations/` whitelist when it lands.
- **EDIT 4 — tracker v6 → v7 (live refs only).** 2 live ops references in
  `docs/specs/SPEC.2.md` updated (§23 body L2116, §23 trace table L2195).
  3 historical refs preserved as v6 (SPEC.2.md:42 change-log entry;
  plans/SCAFFOLD.2.md:1094 + logs/SCAFFOLD.2.md:121 — closed-task knowledge
  tables). 1 historical `tracker_v5` ref at SPEC.2.md:41 also preserved
  (frozen change-log row).
- **EDIT 5 — SPEC.8 → PRECURSOR.4 (live body refs).** 6 live body
  references in `docs/specs/SPEC.2.md` updated (§1 L60, §2 L86, §3 L114,
  BLOCKER register L148/L179/L185). 2 canonical rename-callouts preserved
  at SPEC.2.md:2067 (§22 SPEC.x→ADR mapping explanation) and SPEC.2.md:2132
  (§23 trace table) — they document the rename itself, can't be erased
  without losing the explanation. 3 historical change-log entries preserved
  (SPEC.1.md:1270, SPEC.2.md:41, SPEC.2.md:44 — frozen historical record).
- **EDIT 6 — VISUAL phase decision log entry.** Minted `### Decision log`
  subsection at end of CLAUDE.md §7 (immediately before §8 Closing rule)
  with the 2026-05-14 VISUAL phase mint entry. Placement chosen via user
  AskUserQuestion (Option 1 of 3) — co-locates with EDIT 7's cleanup
  absorption rule.
- **EDIT 7 — Cleanup absorption rule.** Added `### Cleanup absorption rule`
  subsection to CLAUDE.md §7. Drift fixes <2h absorbed by surfacing stratum
  in-PR. >2h drift mints a real task with its own kickoff (not a backlog
  row). Out-of-scope items park in `docs/parked.md`. **PRECURSOR.5 named
  explicitly as the last PRECURSOR-N task.** Future drift rolls into the
  stratum that surfaced it.
- **EDIT 1 — Reviewer-call reframe.** Full rewrite of CLAUDE.md §5.11
  ("Subagent invocation" → "Reviewer-call invocation") and §6 ("Subagents,
  skills, hooks" → "Review roles, skills, hooks") to drop the named-subagent
  fiction. §5.11 documents the general-purpose-with-role-baking pattern:
  three required prompt elements (explicit role briefing pointer at
  `.claude/agents/<role>.md`, plan path `@docs/plans/<TASK-ID>.md`,
  tool-scope constraints in prompt body). §6 reframes each role from
  "MUST BE USED auto-invocation" to "role briefings invoked via §5.11."
  `.claude/agents/*.md` role-briefing files unchanged per kickoff — they
  stay as reference material, no longer claimed auto-discoverable.

  **Consistency updates absorbed in-EDIT** for doc coherence: §1
  critical-paths line (`subagent review` → `reviewer call`), §5.6
  tests-first line (`@test-writer` / `@code-reviewer` → role-briefing
  reviewer calls), §5.10 audit-vs-subagent disambiguation line, §7 audit
  triggers line (`new subagent/skill/hook` → `new role briefing / skill /
  hook`), and footer revision line (bumped to PRECURSOR.5 May 14 2026).
  Two intentional `subagent` occurrences remain post-edit: §6 intro
  ("NOT auto-discovered runtime subagents" — refutation) and footer
  revision note ("subagent → reviewer-call reframe" — describes the
  revision).

---

## Decisions made

- **EDIT 6 placement** — user confirmed Option 1 via `AskUserQuestion`:
  new `### Decision log` subsection at end of CLAUDE.md §7 (mints the
  container that AGENTS.md L5 already names as decision-log home).
- **EDIT 4 historical-vs-live tracker refs** — 2 live updated, 3 historical
  preserved per kickoff guidance ("historical references in SCAFFOLD.2 logs
  should stay as historical"). The `tracker_v5` ref at SPEC.2.md:41 (v0.1
  change-log) also preserved — not in v6 grep target, frozen change-log.
- **EDIT 5 SPEC.8 categorization** — body refs updated; canonical
  rename-callouts preserved because they ARE the rename explanation;
  change-log entries preserved as frozen historical record.
- **EDIT 1 scope expansion to §1/§5.6/§5.10/§7/footer** — kickoff named
  §5.11 + §6 explicitly; consistency updates to adjacent lines absorbed
  in-session because leaving "subagent" / `@test-writer` references would
  contradict the new framing within the same doc on the same revision.
  ~5 1-line touches; aligned with the broader "drop the fiction" intent.

---

## PRECURSOR.5 backlog NOT addressed (9 of 12 items)

Per EDIT 7's new cleanup absorption rule, these roll into the stratum that
surfaces them going forward (NOT minted as a future "PRECURSOR.6"):

1. **SPEC.2 Appendix B.1 users column gap** (4 Better Auth core columns
   absent; `email` nullability mismatch). Surfaced 3.B. Absorb in
   SCAFFOLD.3 (auth wiring).
2. **SPEC.2 Appendix B.2 `markets.status` 3-state vs SPEC.1 §6.1's
   7-state.** Absorb in next markets-touching task.
3. **SPEC.2 Appendix B.15 `identity_pool.number` 1-9 vs SPEC.1 §13 /
   ADR-0011's 0-999.** Absorb in SCAFFOLD.17 (identity_pool data load).
4. **SPEC.2 Appendix B.7 `dharma_ledger.entry_type` mentions deprecated
   `bet_settle` (canonical: `bet_payout`).** Absorb in ENGINE.6 / ENGINE.7.
5. **AGENTS.md §10 `pnpm-workspace.yaml` "not used" line + pnpm 10/11
   drift.** Bundle as a single §10 amendment in next AGENTS.md-touching
   task.
6. **`block-main-commits.sh` referenced in CLAUDE.md §6 but neither script
   nor `lefthook.yml` rule exists.** Either ship the hook or trim the
   reference. Absorb in next hooks-touching task.
7. **`src/db/schema/events.ts` composite-PK alignment to
   `(event_id, created_at)`.** Schema-only type-layer fix. Absorb in
   ENGINE.6 (events insert helper) or as a 1-line schema-touching edit.
8. **ADR ghost references** — `docs/adr/` has only `0001-license-choice.md`;
   ADRs 0003–0016 are ghost references throughout. Architectural call:
   either land the files OR consistently point at SPEC.2 absorptions.
   Mint as its own task (>2h scope per cleanup rule).
9. **Master plan §3.E verification chain expectations imprecise** on
   step 3 (events partitions visible as base tables per
   `information_schema.tables`) and step 4 (missed named-PK carve-outs).
   Annotation-only fix — absorb in next master-plan-touching task.

---

## Open questions

- **AGENTS.md footer L421** (`Last revised PRECURSOR.5 (May 2026)`) was
  pre-marked stale BEFORE this PR (commit `304681b` likely; that PR
  changed AGENTS.md). The pre-mark is now factually correct after this
  PR lands, but the date "May 2026" is imprecise (should be "May 14,
  2026"). Not in 7-edit scope; leaving alone. Trivial 1-line touch for
  next AGENTS.md-touching task.
- **`docs/logs/chat_close_2026-05-14_visual-phase-mint_v7-tracker.md`**
  referenced from CLAUDE.md §7 Decision log is NOT present in the repo
  as of this PR. The user kickoff noted the log lives in project
  knowledge if not in repo. Reference dangles on disk until the file
  is added or the reference is repointed.
- **`just verify` runs `pnpm build`** (justfile L34); AGENTS.md §2 still
  says "Do not run `pnpm build` during agent sessions." SCAFFOLD.2
  close-out shows `just verify` ran clean and was accepted as the
  canonical pre-PR check, so the AGENTS.md prose is stale. Not in
  7-edit scope; absorb in next AGENTS.md-touching task per the new
  cleanup absorption rule.

---

## Next session starts at

**SCAFFOLD.3 — Auth wiring.** Better Auth participant path (Google OAuth
+ Email-OTP) + admin hand-rolled static-password path. Per ADR-0004 +
ADR-0010 + AGENTS.md §1. New session, new web Claude chat, `/clear`
between.

When SCAFFOLD.3 lands, surface PRECURSOR.5 backlog item 1 (SPEC.2 B.1
users column gap) for in-stratum absorption per the cleanup absorption
rule.

---

## Context to preserve

- **EDIT 7 names PRECURSOR.5 as the last PRECURSOR-N task.** No
  "PRECURSOR.6 cleanup sweep" should ever exist. Future drift absorbs into
  the surfacing stratum (or parks if genuinely out-of-scope).
- **Reviewer-call invocation pattern** (new CLAUDE.md §5.11 + §6): every
  reviewer call needs three prompt elements — explicit role briefing
  pointer (`.claude/agents/<role>.md`), plan path
  (`@docs/plans/<TASK-ID>.md`), tool-scope constraints in prompt body.
  Runtime agent type used is `general-purpose`; default tool access is
  full, so the prompt must constrain tool scope. `.claude/agents/*.md`
  files unchanged this PR.
- **`just verify` clean** on `.env.local`-sourced env post-edit: Next.js
  16.2.4 Turbopack build, 4.3s compile, 40 files biome-checked, 4 static
  pages prerendered.
- **Two intentional `subagent` occurrences remain** in CLAUDE.md post-edit:
  §6 intro (fiction refutation) + footer (revision documentation). Not
  drift.
- **9 backlog items deliberately left for absorption elsewhere** (see
  section above). Each is named with a suggested home stratum.

---

## Time

~half-day session. No plan ritual. Single PR (one changes commit + one log
commit).
