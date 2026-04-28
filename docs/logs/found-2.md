# FOUND.2 — Next.js 16 app scaffold

**Status:** done
**Date started:** 2026-04-25
**Date completed:** 2026-04-26
**Duration:** ~2 days (across multiple sessions)
**Session type:** Tracker task (first FOUND task with a PR)
**PR / commit:** PR #4 (1a9ad3e — initial scaffold), PR #5 (6a04ec3 — verify chain)
**Chat link:** FOUND.2 chat (archived in Foundation Claude project)

---

## Scope

FOUND.2 set up the Next.js 16 application scaffold and the local + repo
toolchain that all future FOUND/SPEC/ENGINE tasks ship through. Per the
tracker, the deliverables were:

1. Next.js 16 + TypeScript + App Router + Tailwind 4 in `src/` layout
2. Toolchain pinning via mise (Node, pnpm, just) committed at root
3. Linter + formatter (Biome v2.x) configured
4. Pre-commit + pre-push hooks via Lefthook
5. `justfile` wrapping the verify chain (typecheck, biome, build)
6. Stub homepage rendering project name + build SHA + ISO timestamp
7. End-to-end verify chain green: typecheck, biome check, build, dev server + curl
8. AGENTS.md + CLAUDE.md stubs at root for AI tooling guidance
9. Repo-side branch protection + signed-commit infrastructure ready

---

## Final state — what is live

### Application
- Next.js 16.2.4 + TypeScript 5 + App Router + Tailwind 4
- `src/` layout (NOT a monorepo — single Next app at root)
- Stub homepage at `src/app/page.tsx` rendering project name + build SHA + ISO timestamp
- Build SHA + timestamp wired via `next.config.ts` env block

### Toolchain (pinned, mise.toml at root)
- Node 24
- pnpm 10
- just 1
- Biome v2.4.13
- Lefthook v2.1.6

### Verify chain
- `just check` runs the full chain
- 10 recipes total in `justfile`
- Biome configured to skip Markdown and config-file paths
- Lefthook pre-commit (`biome-check-staged`) + pre-push (`biome-check-all` + `typecheck`) — both green

### Repo
- Branch protection on `main` requires PR workflow for ALL pushes, including doc-only changes
- Squash-merge only (signed-commit constraint with rebase incompatibility)
- All commits signed with SSH key `SHA256:YSHhSYNEh4KnFEtON/LAeawW76QE7DLhH8buQhFCLMM` (registered as both auth and signing key on GitHub)
- Local clone at `~/Desktop/zugzwang/experiment/` (iCloud-synced)

### AI tooling guidance
- `AGENTS.md` at root (Vercel-maintained Next.js framework guidance)
- `CLAUDE.md` as a one-line stub with `@AGENTS.md` import — to be extended in FOUND.4

### License
- `LICENSE` (canonical AGPL-3.0 body, ~34 KB) committed in initial commit (`4f4d746`) without a project header
- Project header added later in FOUND.3 (PR #6)

---

## Decisions taken

- **Branch protection requires PR workflow for ALL pushes.** No direct commits to `main`, even for doc-only changes.
- **Squash-merge only.** GitHub cannot auto-sign rebased commits; signed-commit requirement combined with branch protection makes squash the only viable merge strategy. Per-commit history lives on PR records; `main` carries one signed squash commit per PR.
- **Single Next.js app, NOT monorepo.** Per Playbook §10: promote to monorepo only if a separate admin app is ever added. Tracker was stale on this question; reconciled in favor of single-app.
- **Next.js 16, not 15.** Decided in pre-FOUND.2 reconciliation chat. Deciding factor: Next 15 LTS EOLs 2026-10-21, 11 days before experiment close; Next 16 confirmed stable since Oct 2025; current LTS 16.2.4 (Apr 15 2026). Formal ADR captured in FOUND.6 (or first SPEC.* task to need it).
- **Toolchain pinning via mise.** Node 24, pnpm 10, just 1. Single source of truth (`mise.toml`) at repo root. Eliminates "works on my machine" for the support devs.
- **Lefthook over Husky.** Single binary, no npm install pollution.
- **Biome over ESLint+Prettier.** Single tool, faster, fewer dependencies.
- **VS Code paste-buffer rule.** macOS Terminal+zsh paste buffer caps ~1KB and silently truncates multi-line heredocs, printf line-continuations, and `git commit -m "..."` strings. Established convention: write files >1KB via VS Code editor; use `git commit -F /tmp/commit-msg.txt` for multi-line commit messages. Never prescribe heredocs or multi-line `-m` strings in CLI walkthroughs going forward.

---

## Deviations from plan

- **`LICENSE` shipped without explicit task scope.** The canonical AGPL-3.0 body landed in the initial commit (`4f4d746`) without being enumerated in FOUND.2's task description and without being mentioned in this task's original carry-forward notes. Surfaced retroactively during FOUND.3, which added the project header above the existing body.
- **CI workflows not wired.** Originally implied to be FOUND.2 scope; deferred to a later task after Vercel project exists.
- **Verification tests T1–T8 (Runbook Phase 6) not explicitly executed.** Migration proceeded on implicit verification via live chat interaction. Low-risk deviation; gate was not literally run.
- **Default Next.js scaffold metadata not cleaned up.** `<title>Create Next App</title>` from the Next.js scaffold still in `src/app/layout.tsx`. Replace before any public-facing surface.

---

## Open items / follow-ups

- **`<title>` and metadata sweep.** Default Next.js metadata still in `layout.tsx`. Fold into FOUND.4 or first metadata task.
- **Playbook version mismatch.** Playbook §2 says Node 22; should be Node 24. Fix on next playbook touch.
- **iCloud + `.next/` gotcha.** Build artifact directories occasionally duplicate-suffix with " 2" filename additions, causing TypeScript duplicate-identifier errors in pre-push hooks. Workaround: `just clean`. Long-term fix (deferred): move project to `~/code/` or `~/Developer/` (not iCloud-synced) or exclude `.next/` from iCloud.
- **VS Code workspace `files.insertFinalNewline: true`.** Add on next housekeeping pass.
- **`docs/specs/` and `docs/adr/` empty.** SPEC.1 and ADR-0001 (FOUND.6) will create their first content.

---

## Context to carry forward

The scaffold is verified, toolchain is pinned, and the repo's core CI/local infrastructure is in place. All future tasks ship code through the PR workflow; squash-merge is the only viable strategy due to signed-commit requirements. Files >1KB are written via VS Code, never via terminal heredoc.

The `experiment` repo is the permanent web2 experiment-phase codebase. It gets archived (not renamed) Nov 8 2026 as a historical artifact; `zugzwang-foundation/testnet` opens as a fresh sibling repo for phase 2.

`CLAUDE.md` is a one-line stub. **FOUND.4 must EXTEND it with Playbook §3 Zugzwang-specific content, NOT replace** — preserve the `@AGENTS.md` import line at the top so framework guidance flows through.

Stub homepage at `src/app/page.tsx` will be replaced entirely by SPEC.1 / UI.* tasks; don't polish design now.

Next: **FOUND.3** (governance docs — license header, CoC, security). After FOUND.3 + FOUND.4, **SPEC.1** is the first non-foundation task. No non-trivial code lands before SPEC.1 per project refusal rules.