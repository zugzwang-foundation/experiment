# FOUND.6 — ADR-0001 license choice

**Status:** done
**Date completed:** 2026-04-29
**Time spent:** ~1 hour (single chat session, late evening Apr 28 → 01:40 Apr 29)
**PR / commit:** PR #15 (squash commit `ef2edc7`, signed)
**Chat link:** FOUND.6 chat (archived in Foundation Claude project)

---

## What was built

ADR-0001 at `docs/adr/0001-license-choice.md` ratifying AGPL-3.0-or-later
as the license for the experiment-phase repo. Trimmed format: title +
status + Decision Drivers (D1–D6) + Decision Outcome only. The original
MADR-4 long-form draft (with Considered Options, Pros/Cons, Confirmation,
More Information sections) was deliberately cut down to ~50 lines. CLAUDE.md
§10 license row updated in the same closing PR to fix the stale "matches
Manifold" rationale and align the identifier with the LICENSE file's
"or any later version" clause.

---

## Decisions taken

- **License rationale formally locked: AGPL §13 forecloses closed-source
  SaaS forks.** Replaces the FOUND.2/FOUND.3-era stale "matches Manifold"
  framing (Manifold is MIT-licensed, established in FOUND.3). The §13
  rationale is the thesis-grounded one — the only license clause that
  prevents a closed-source hosted competitor from extracting the codebase's
  value without contributing back.

- **Smart-contract licensing decision deferred to a future ADR, not folded
  into ADR-0001.** Decision spaces don't overlap: app-code licensing is
  AGPL vs MIT/Apache (driven by §13 SaaS-fork foreclosure), contract-code
  licensing is LGPL-3.0 vs AGPL-3.0 vs Apache-2.0 (driven by not chilling
  regulated intermediaries who would otherwise inherit §13 obligations).
  Bundling weakens both. The smart-contract ADR opens later, before SPEC.5
  / ENGINE.1.

- **MADR 4 long form drafted, then deliberately truncated.** Initial draft
  followed MADR 4.0 conventions (YAML front matter, Considered Options,
  per-option Pros/Cons, Confirmation subsection, More Information). Cut
  down to Decision Drivers + Decision Outcome only on the call that the
  AGPL-3.0 decision is fully settled, and the comparative-analysis
  scaffolding is overhead for a ratification ADR. Tracker description's
  "MADR 4 format" claim is therefore aspirational rather than literal.

- **CLAUDE.md §10 row updated in the same PR as the closing log.** Per
  CLAUDE.md §11 maintenance loop and §7 task-log schema: when an ADR is
  accepted, §10 is updated in the same PR as the task that produced it.
  No follow-up. Identifier also corrected from `AGPL-3.0` to
  `AGPL-3.0-or-later` to match the LICENSE file's actual "or any later
  version" clause — incidental fix surfaced during review.

- **Single Foundation operational identity used for the commit.** Author:
  `Zugzwang/world <zugzwangworld@proton.me>`. Matches FOUND.3-onwards
  pattern. Consistent with collective copyright "The Zugzwang Authors" and
  with Bitcoin / go-ethereum precedent. No author-attribution drift.

---

## Deviations from plan

- **Plan-then-execute 2-tab workflow skipped.** Same shape as FOUND.5
  (non-critical-path docs task, ~0.5d). This is the third FOUND task to
  collapse Phase 1 + Phase 2 into a single chat (FOUND.4 design+delivery
  was actually two chats but inside the same task; FOUND.5 explicitly
  skipped; FOUND.6 followed). Pattern surfaced in FOUND.5's log for the
  FOUND-phase-boundary maintenance audit; FOUND.6 reinforces the case for
  a "non-critical-path docs tasks may collapse phases" carve-out in
  `plan-then-execute.md`.

- **Tracker description for FOUND.6 says "MADR 4 format. Accepted state.
  Rationale for AGPL over MIT/Apache."** The shipped artifact is no longer
  MADR 4 format (long-form sections were trimmed). Tracker description is
  now mildly aspirational — Hrishikesh's call to leave as-is rather than
  edit. Recording the drift so it's visible to a future maintenance audit.

- **`gh pr create` failed with "Head sha can't be blank" race condition.**
  Recovery via the GitHub web UI URL printed by `git push`. Squash-merged
  via web UI. No state corruption. Worth surfacing as a future-walkthrough
  caveat: when `gh pr create` fails immediately after push, retry once
  after a few seconds, or fall back to the web URL.

---

## Open items / follow-ups

### Blocking future technical work

- **Smart-contract licensing ADR.** New tracker row needed: an ADR (number
  TBD, likely allocated when the row is added) deciding LGPL-3.0 vs
  AGPL-3.0 vs Apache-2.0 for contract code in the testnet/mainnet repos.
  Must be opened before SPEC.5 / ENGINE.1.

### Non-blocking

- **AGPL §13 production-instance footer obligation.** The hosted
  `zugzwangworld.com` instance must, when it goes live, expose a
  "corresponding source" link from the running app (typically a footer
  link to the GitHub repo). Owner: FOUND.7 (README + public-facing surface)
  or a LAUNCH-phase task. Cut from the ADR's Confirmation subsection
  during the trim; lives only in this log entry now. Without this
  follow-up the obligation has no on-disk record.

- **SPDX header lint enforcement.** Convention is `SPDX-License-Identifier:
  AGPL-3.0-or-later` on new source files going forward. Currently
  unenforced. If files start shipping without headers, a future
  maintenance audit can add a Biome custom rule or a pre-commit check.
  Not urgent.

- **CI checks not running on docs-only PRs.** Carried over from FOUND.5.
  PR #15 also showed Checks: 0. Same gap. Investigate during the next
  maintenance audit or a SCAFFOLD.* task that touches CI. Track risk:
  a code-only PR with bad changes might also bypass checks if the gap is
  on filter logic rather than docs filtering.

- **Tracker description currency.** Hrishikesh's call to leave as-is. If a
  future reader hits the "MADR 4 format" claim and looks at the file
  expecting long form, this log entry is what explains why.

---

## Core file updates needed?

One real item, included in this PR:

1. **CLAUDE.md §10 license row** — rationale + identifier corrected
   (separate commit on the same `chore/found-6-closing` branch).

No changes needed to AGENTS.md, the workflow doc, or the plan template
from this task. The maintenance-audit-trigger pattern (ADR accepted → §10
updated in same PR) worked as designed.

---

## Context to carry forward

The license question is closed for the experiment phase. ADR-0001 is the
canonical document; CLAUDE.md §10 references it; LICENSE file is unchanged
and stays AGPL-3.0-or-later under "The Zugzwang Authors" collective
copyright. The dual-licensing future option is preserved by the choice but
requires no current action — Foundation incorporation, contributor CLAs,
and a buyer would all need to materialise before that path becomes real,
and none of those happen in the experiment phase.

The next foundation task is **FOUND.7** (README.md, public-facing repo
intro) and **FOUND.8** (ADR-0002 — experiment/protocol repo split).
FOUND.7 inherits the §13 footer-link obligation as a deliverable; the
README is the natural public surface for the corresponding-source pointer
(or it can be deferred to a LAUNCH-phase task that adds the footer to the
live application — both are valid). After FOUND.7 and FOUND.8, the
foundation phase closes and **SPEC.1** opens. No non-trivial code lands
before SPEC.1 per project refusal rules.

The smart-contract licensing decision (LGPL-3.0 vs AGPL-3.0 vs Apache-2.0)
remains the one ADR-shaped open item from FOUND.3 / FOUND.5 / FOUND.6.
Tracker row not yet added. Must be opened before SPEC.5 / ENGINE.1; no
fixed earlier deadline. If FOUND.7 / FOUND.8 surface a reason to open it
sooner (e.g., README needs to characterise the protocol's contract
licensing), it lands then.

This is the third FOUND task to skip the 2-tab plan-then-execute workflow
on non-critical-path grounds. The FOUND-phase-boundary maintenance audit
should formalise the carve-out in `plan-then-execute.md` rather than
treating each skip as a one-off deviation. If FOUND.7 and FOUND.8 also
skip, the case is conclusive.
