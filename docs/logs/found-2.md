# FOUND.2 — Next.js scaffold + toolchain

**Status:** done
**Date completed:** 2026-04-27
**Time spent:** ~2 days (Apr 25–27, three working sessions across CHAT-2 / CHAT-3 / CHAT-4)
**PR / commit:** [#4](https://github.com/zugzwang-foundation/experiment/pull/4) — merged via squash to main as `1a9ad3e`
**Chat link:** n/a (Foundation Claude project, archived)

---

## What was built

Standing scaffold for the Zugzwang experiment: Next.js 16.2.4 application with TypeScript, App Router, Tailwind CSS 4, and `src/` layout. Toolchain pinned across mise (Node 24, pnpm 10, just 1), Biome (2.4.13, recommended preset), and Lefthook (2.1.6, pre-commit + pre-push). 10-recipe `justfile` wraps the verification chain. Stub homepage renders build SHA + ISO timestamp inlined at build via `next.config.ts` env block. End-to-end verified: typecheck, biome, build, dev server smoke test all green.

---

## Final state — what is live on main

### Repo
- Origin: `github.com/zugzwang-foundation/experiment`
- Branch protection on `main`: signed commits required
- Single Next.js app at repo root (NOT a monorepo, per Playbook §3)
- Squash commit `1a9ad3e` represents all of FOUND.2 on main; per-commit history preserved on PR #4

### Toolchain (pinned exact)
- Node 24 + pnpm 10 + just 1 via `mise.toml`
- Biome v2.4.13 (`-E` exact pin) — `biome.json` with recommended preset, tab indent, double-quote JS, organize-imports on, Tailwind directives recognized
- Lefthook v2.1.6 (`-E` exact pin) — `lefthook.yml` defines pre-commit (biome check --write on staged files, auto-stage fixes) and pre-push (typecheck + full-repo biome check, parallel)
- Both hooks skip on merge/rebase to avoid blocking conflict resolution

### Application
- Next.js 16.2.4 (Turbopack default in 16, no `--turbopack` flag needed)
- App Router under `src/app/` with `@/*` import alias
- Tailwind 4 wired via `@tailwindcss/postcss` and `@import 'tailwindcss'` in `globals.css`
- `next.config.ts` injects `BUILD_TIMESTAMP` and `BUILD_GIT_SHA` via `env` block, computed at config load (Date.toISOString + `git rev-parse --short HEAD` with try/catch fallback)
- `src/app/page.tsx` renders minimal Tailwind-styled stub: name, tagline, "coming soon", build metadata footer. Pure server component, zero client JS shipped
- Default `<title>Create Next App</title>` in `layout.tsx` — TODO before launch

### Task runner
- `justfile` with 10 recipes: `default`, `list`, `dev`, `build`, `typecheck`, `check`, `format`, `verify`, `setup`, `clean`
- `just --list` is the discoverable entry point
- `just verify` chains typecheck + biome check + build for pre-push sanity
- `just setup` is the fresh-clone bootstrap (mise install + pnpm install + lefthook install)

### Verification (all green on clean tree)
- `just typecheck` — pnpm tsc --noEmit, silent success
- `just check` — Biome over 10 files, no fixes applied
- `just build` — Next.js production build with Turbopack, ~2.3s, all routes static
- `pnpm dev` + `curl /` — HTTP 200, build SHA `4073e42` and ISO timestamp inlined in returned HTML

### AI agent integration
- `AGENTS.md` (Vercel-maintained, included by scaffold) — Next.js framework guidance
- `CLAUDE.md` is a one-line stub that imports AGENTS.md via `@AGENTS.md`
- FOUND.4 will EXTEND CLAUDE.md with Playbook §3 Zugzwang-specific content (NOT replace — must preserve `@AGENTS.md` import)

### Editor
- `.vscode/settings.json` and `.vscode/extensions.json` configured for Biome + recommended extensions
- VS Code's GitHub PR extension auto-activated; Biome and Git overcaution prompts dismissed

### Signing
- All 7 source commits signed locally via SSH key `SHA256:YSHhSY...`
- GitHub-side SSH signing key registered (separate from auth key)
- Squash commit `1a9ad3e` on main signed by GitHub web-flow key (verified)

---

## Decisions taken

- **Stack: single Next.js app at repo root, not a monorepo.** Playbook §3 authoritative; tracker stale on this. Keeps experiment lean.
- **Node 24, not Playbook §2's stale "22".** Node 24 is current LTS, Next 16 requires ≥20.9. Playbook §2 needs revision in next housekeeping pass.
- **Tool pinning major-only in `mise.toml`** (`node = "24"`, `pnpm = "10"`, `just = "1"`). Renovate will tighten patch versions later.
- **Biome over ESLint+Prettier.** Single tool, faster, modern. Scaffold ran with `--no-eslint`; Biome added separately in commit 4.
- **JSON formatting via Biome wins over Pre-cursor D's editorconfig 2-space.** Consistency over preservation. `.editorconfig` updated to match.
- **React Compiler: opt-out (deferred).** Stable in 16 but unnecessary for FOUND.
- **Build-time env injection via `next.config.ts` `env` block** (not `.env` files). `Date()` and `execSync()` need expression evaluation; `.env` is static text.
- **Squash merge to main, not rebase.** Branch protection requires signed commits; GitHub cannot auto-sign rebased commits. Squash produces one commit signed by GitHub web-flow. Per-commit history preserved on PR record.
- **Direct merge by author, no review.** Solo dev workflow; PR ceremony for the audit trail, not gatekeeping.
- **Stub homepage stays minimal.** SPEC.1 will replace it entirely. Polish is wasted before specs.

---

## Deviations from plan

- **Three working sessions, not one.** Tracker estimated FOUND.2 as a single contiguous task. Reality: scaffold-and-toolchain was big enough to span CHAT-2 (Apr 25, .gitignore + mise + scaffold setup), CHAT-3 (Apr 26, Biome + Lefthook + justfile), and CHAT-4 (Apr 27, homepage + verify + push + merge). Tracker estimate was light by ~1.5x.
- **macOS Terminal+zsh paste-buffer cap (~1KB) caused 3 separate failures** during CHAT-4 (heredoc, multi-line printf, multi-line `git commit -m`). Recovery via VS Code editor for files >1KB and `git commit -F /tmp/file` for multi-line messages. Banked as Claude memory rule for future tasks.
- **iCloud-synced `~/Desktop/` caused `.next/` duplicate-suffix files** (`d 2.ts` etc.) that broke pre-push typecheck once. `just clean` fixed it. Banked as Claude memory; long-term fix (move project out of iCloud) deferred.
- **Default `<title>Create Next App`** still in `layout.tsx`. Should become "Zugzwang" before any public surface. Deferred to housekeeping or first metadata task.

---

## Open items / follow-ups

- **`<title>` and metadata sweep** — replace scaffold defaults in `src/app/layout.tsx`. Small task, ~15 min. Add to tracker as `FOUND.2.5` or fold into FOUND.4.
- **Playbook §2 revision** — currently says Node 22; should say Node 24 (or just "current LTS"). 5-min edit; do during next playbook touch.
- **Tracker stale on monorepo question** — tracker still implies multi-package layout in places. Audit when FOUND.4 lands.
- **iCloud + `.next/` duplication** — workaround works (`just clean`); proper fix is moving project to `~/code/` or excluding `.next/` from iCloud. Defer until it bites again.
- **VS Code workspace-level settings** — consider committing `files.insertFinalNewline: true` to `.vscode/settings.json` so all contributors get POSIX-clean files automatically. Tiny change; do in next housekeeping commit.
- **CI workflows not yet wired** — `.github/workflows/ci.yml` is in Playbook §3 directory tree but doesn't exist on disk. Belongs in a later FOUND task (FOUND.5 or similar) once we have a Vercel project to point at.
- **`docs/specs/` and `docs/adr/` directories empty** — SPEC.1 and ADR-0001 will create them.

---

## Context to carry forward

The next chat starts from a working Next.js 16 scaffold on `main` at SHA `1a9ad3e`. Toolchain is end-to-end verified; do not re-litigate Biome/Lefthook/just/mise choices — they are settled. The repo is `github.com/zugzwang-foundation/experiment`, single Next.js app at root (NOT monorepo). Local clone is at `~/Desktop/zugzwang/experiment/` (iCloud-synced — be aware `.next/` may duplicate, fix is `just clean`).

Branch protection on `main` requires signed commits. Local git config has `gpg.format=ssh` with key `~/.ssh/id_ed25519_github`, fingerprint `SHA256:YSHhSYNEh4KnFEtON/LAeawW76QE7DLhH8buQhFCLMM`. Same key is registered on GitHub as both auth key AND signing key. Every commit gets signed automatically. Rebase merges are blocked by branch protection (GitHub can't sign rebased commits); use squash for PRs going forward.

For Claude Code or future chats issuing CLI walkthroughs: macOS Terminal+zsh has ~1KB paste-buffer cap. Files >1KB go via VS Code editor (`code <path>`, Cmd+A/Delete/Cmd+V/Cmd+S). Multi-line commit messages use `git commit -F /tmp/commit-msg.txt`. Never prescribe heredocs or multi-line `-m "..."` strings.

CLAUDE.md currently is a one-line `@AGENTS.md` import. FOUND.4 must EXTEND it with Playbook §3 content, not replace — preserve the import.

Stub homepage at `src/app/page.tsx` renders project name + build metadata. Will be replaced entirely by SPEC.1 / UI.* tasks. Don't polish design now.

Next likely task is **FOUND.3** (per tracker) — verify dependency before starting. After FOUND.3 and FOUND.4, the natural next step is **SPEC.1** (CPMM specification, the first non-foundation task). Until SPEC.1 is written, no non-trivial code lands per project refusal rules.
