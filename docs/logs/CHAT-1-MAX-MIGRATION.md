# CHAT-1 — Claude Max + CLI Migration

**Status:** done
**Date completed:** 2026-04-25
**Time spent:** ~90 min (migration execution + memory seeding + close-out planning)
**PR / commit:** n/a (this log is the deliverable)
**Chat link:** n/a (archived in Foundation Claude project)

---

## Scope

Migrate from personal Claude Max (hrishihunde@gmail.com) to Foundation Claude Max (zugzwangworld@proton.me) before personal Max expiry on Apr 25 2026. Covers: new subscription purchase, project setup, memory seeding, Claude Code CLI re-auth, personal cancellation. Per Migration Runbook (24 Apr 2026).

Pre-cursor D (CHAT-0) left migration as the final bootstrap dependency. This closes it.

---

## Final state — what is live

### Foundation Claude Max (web)
- Account: zugzwangworld@proton.me
- Plan: Max (20x-Pro tier)
- 2FA: enabled via Proton Authenticator; backup codes in Proton Pass
- Next renewal: ~2026-05-25
- Project: Zugzwang — created with system prompt + user preferences + knowledge files per Runbook Appendix A/B
- Knowledge files uploaded: paper v4, tracker HTML, playbook, task log, task template, protocol doc, origin photos

### Memory seeded
10 items active in Foundation Claude memory. Items renumbered 1–10 (original seed had gaps at 8 and 9). Covers: three-phase architecture, timeline, scope discipline, core thesis, two-instrument token architecture, canonical paper, formal math core, "no stake, no voice" slogan, debate view rules, working style.

### Claude Code CLI
- Authed to: zugzwangworld@proton.me (Foundation)
- Prior personal auth: `/logout` executed, re-auth via Foundation
- Smoke test post-re-auth: **passed**
- Old session tokens on personal account: **revoked** in Settings → Claude Code
- Proton Pass `[Claude] Foundation` entry: note "CLI authed: 2026-04-25" **added**

### Personal account
- Max subscription: cancelled
- Access continues through 2026-04-25 (today), reverts to Free tier at period end
- Zugzwang project on personal account: preserved as read-only archive (not deleted)

---

## Decisions taken

- **Memory seed renumbered 1–10, not 1–12.** Original seed prompt skipped items 8 and 9; renumbered no-gap per user confirmation.
- **Experiment Build Phase start date: Apr 24 2026.** Resolved contradiction between seed-item 1 (Apr 24) and seed-item 2 ("5-month build + 2-month live"). Timeline rewrote to ~4.75-month build + ~1.75-month live.
- **Experiment Dharma reclassified as dummy/throwaway.** Web2 DB score that ceases to exist post-experiment; does NOT carry forward to testnet. Testnet Dharma launches fresh as soulbound ERC-20. Mainnet Dharma continues from testnet. Memory item 1 updated.
- **Testnet market makers stake dummy Artha.** Real Artha exists only at mainnet as native L1 asset.
- **Stack: single Next.js 16 app (not monorepo).** Playbook authoritative on repo structure (single app); tracker stale on this. Playbook stale on framework version; Next.js 16 confirmed stable since Oct 2025, current LTS 16.2.4 (Apr 15 2026). Next 15 LTS EOLs Oct 21 2026 — 11 days before experiment close — so Next 16 is the safe choice. **Tracker reconciliation defers to next chat.**
- **ORM decision deferred.** Claude recommended Drizzle for event-sourced schema fit (append-only events + projectors per SPEC.5). User's one-word call (Drizzle / Prisma) belongs in the reconciliation chat.
- **This chat's scope = migration only.** FOUND.1 gets its own fresh chat. One-task-per-chat rule enforced.
- **Order for next chats:**
  1. Tracker ↔ Playbook reconciliation (~20 min)
  2. Paper v4 final refurbishment pass
  3. FOUND.1 — pre-registered hypothesis doc
  4. FOUND.2+ — scaffold and beyond

---

## Deviations from runbook

- **Verification tests T1–T8 (Runbook Phase 6) not explicitly executed.** Migration proceeded on implicit verification via live chat interaction (clarifying-question discipline, refusals, memory access, preference adherence all exercised during this chat's flow). Low-risk deviation; gate was not literally run. Can be exercised on-demand if Foundation behavior ever feels off.
- **Paper reference in memory item 6:** `zugzwang_btc_style_v4` (not `zugzwang_btc_style.pdf` as Runbook Appendix A suggested). The v4 version identifier matters for the pending refurbishment pass.
- **Timeline numbers corrected.** Runbook seed said "5-month build + 2-month live"; memory records ~4.75-month build + ~1.75-month live (Apr 24 2026 → Sep 15 2026 → Nov 8 2026).

---

## Open items / follow-ups

| Item | Trigger | Notes |
|---|---|---|
| Commit Pre-cursor D log (CHAT-0) | Immediately | Create `docs/logs/` directory, commit `CHAT-0-PRECURSOR-D-foundation-bootstrap.md`. Don't wait for FOUND.2. |
| Commit this log (CHAT-1) | Immediately | `docs/logs/CHAT-1-MAX-MIGRATION.md` |
| Tracker ↔ Playbook reconciliation | Next chat | Monorepo → single app; Playbook Next 15 → Next 16; Drizzle vs Prisma final call; ADR-0004 cites "Next 15 EOL lands mid-experiment" as deciding factor |
| Paper v4 final refurbishment | After reconciliation | Before FOUND.1 cites paper sections |
| FOUND.1 — hypothesis doc | After refurbishment | OSF/AsPredicted format, `docs/hypothesis.md`, git-commit-locked |
| Runbook T1–T8 verification | Optional | Not blocking; run if behavior feels off |
| Mainnet MM incentive mechanism | Post-Nov 8 | Paper §10.2 (MM paid in Artha via fee-burn-and-mint) vs user verbal (MM paid in Dharma). Tabled as out-of-scope for Experiment. Memory records no decision. |
| Proton 2FA circular dependency | Before Sep 15 / YubiKey arrival | Carried forward from Pre-cursor D |

---

## Memory edits made during session

10 entries added (items 1–10) covering three-phase architecture, timeline, scope discipline, core thesis, two-instrument token architecture, canonical paper, formal math core, "no stake, no voice" slogan, debate view rules, and working style.

Item 1 was replaced once to add: Experiment Dharma as dummy/throwaway (dies post-experiment, does not carry forward); testnet MMs stake dummy Artha.

---

## Context to carry forward

**For the reconciliation chat (next):**
- Tracker edits: FOUND.2 "monorepo scaffold" → "Next.js 16 app scaffold"; FOUND.7 (ADR 0002 monorepo structure) retitled or deleted; SCAFFOLD.2 updated to chosen ORM.
- Playbook §2 edits: Next 15 → Next 16.
- ADR-0004 body must cite "Next 15 LTS EOL 2026-10-21 is 11 days before experiment close" as the deciding factor. Future-you reading the repo in 6 months should not have to re-derive this.
- Drizzle vs Prisma: Claude's recommendation is Drizzle (event-sourced schema fit, smaller runtime, SQL-first skill durability). Prisma VS Code extension was installed in Pre-cursor D but is not evidence of a deliberated choice. Hrishikesh to give one-word answer in the reconciliation chat.

**For paper v4 refurbishment:**
- §10.2 MM incentive paragraph — paper version (MM paid in Artha via fee-burn-and-mint; "sole bridge between the two instruments") is the two-instrument-preserving version. If user verbal diverges in refurbishment discussion, flag rather than silently adopt.
- Five figures in v4. End-to-end refurbishment still pending per original note.

**For FOUND.1:**
- Scope: operationalized, falsifiable, version-locked subset of paper §§1–8. Not a paper condensation.
- Format: OSF/AsPredicted-style pre-registration template (hypotheses, operationalization, sampling plan, analysis plan, stopping rules).
- Location: `docs/hypothesis.md` in experiment repo, version-locked via git commit hash. OSF mirror is optional secondary.
- Paper refurbishment should happen first so §§1–8 is stable when FOUND.1 cites it.

**Git identity for all commits (unchanged from Pre-cursor D):**
- user.name=Chrollo
- user.email=zugzwangworld@proton.me
- SSH signing via id_ed25519_github (SHA256:YSHhSYNEh4KnFEtON/LAeawW76QE7DLhH8buQhFCLMM)

---

## Commit for this log

```
docs(log): add Chat 1 Max migration log (2026-04-25)
```
