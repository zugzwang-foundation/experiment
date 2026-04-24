# Chat 0 — Pre-cursor D: Foundation Bootstrap

**Date:** 2026-04-23 (session start) → 2026-04-24 01:30 IST (session end)
**Duration:** ~9 hours (across one overnight session + earlier chat on Steps 1–4)
**Session type:** Pre-cursor to tracker (FOUND.1 has not yet started)
**Outcome:** Foundation-level infrastructure bootstrap complete. Ready for FOUND.1 (Pre-registered hypothesis document) to begin post-Apr 25 Claude Max migration.

---

## Scope

Pre-cursor D covered Steps 1–8 of the foundation bootstrap plan:

1. GitHub organization (zugzwang-foundation)
2. Experiment repository creation with branch protection
3. SSH signing configuration (pivoted from gitsign)
4. End-to-end signing test
5. Domain + DNS + email (Namecheap, Proton, DMARC, DNSSEC)
6. Proton Pass vault setup (Zugzwang vault, credential backfill, 2FA backup codes)
7. Local toolchain (Homebrew, Node 24 LTS, pnpm 10, CLI tools, Claude Code, VS Code, extensions, repo editor config)
8. This log

Steps 1–4 completed in prior chat (context limit hit). Steps 5–8 completed in this session.

---

## Final state — what is live

### Identity & accounts

- **GitHub org:** github.com/zugzwang-foundation (free plan, display name "zugzwang/world")
- **Personal GitHub handle:** Zugzwang-world (owner of the org)
- **Billing email:** zugzwangworld@proton.me
- **Domain:** zugzwangworld.com (Namecheap, registered Mar 2 2026 – Mar 2 2031, auto-renew on, WHOIS privacy via WithheldforPrivacy)
- **Email:** foundation@zugzwangworld.com (Proton Mail custom domain, send + receive)
- **Pseudonym for git commits:** Chrollo (HxH reference)

### Repository

- **Repo:** github.com/zugzwang-foundation/experiment
- **License:** AGPL-3.0
- **Default branch:** main
- **Current HEAD:** d78e320 (merge of chore/editor-config PR #1)
- **Branch protection on main:**
  - PR required ✓
  - Approvals required: 0 (was 1, relaxed due to solo-dev self-approval block — see "Known deferrals")
  - Signed commits required ✓
  - Linear history required ✓
  - Conversation resolution required ✓
  - No force pushes ✓
  - No deletions ✓
  - Bypassing disabled ✓

### Signing

- **Method:** SSH signing (pivoted from gitsign mid-Step 3 because Sigstore's Unverified badge on GitHub was cosmetically unacceptable)
- **Key:** ~/.ssh/id_ed25519_github, fingerprint SHA256:YSHhSYNEh4KnFEtON/LAeawW76QE7DLhH8buQhFCLMM
- **Key registered on GitHub twice:** once as Authentication Key, once as Signing Key
- **Passphrase storage:** macOS Keychain (--apple-use-keychain) + mirrored to Proton Pass as `[SSH] id_ed25519_github passphrase`
- **git config:**
  - gpg.format=ssh
  - commit.gpgsign=true, tag.gpgsign=true
  - user.name=Chrollo
  - user.email=zugzwangworld@proton.me
  - user.signingkey=/Users/hrishikesh/.ssh/id_ed25519_github.pub

### DNS (at Namecheap PremiumDNS)

Active records on zugzwangworld.com:
- CNAME protonmail._domainkey → protonmail.domainkey.drz7kchvhwo6dpjm3ecttcfwdz...
- CNAME protonmail2._domainkey → protonmail2.domainkey...
- CNAME protonmail3._domainkey → protonmail3.domainkey...
- TXT @ → protonmail-verification=978238765ffcf7e249aa05cf27c...
- TXT @ → v=spf1 include:_spf.protonmail.ch ~all
- TXT _dmarc → v=DMARC1; p=quarantine; rua=mailto:foundation@zugzwangworld.com; adkim=s; aspf=s
- MX @ priority 10 → mail.protonmail.ch
- MX @ priority 20 → mailsec.protonmail.ch
- DNSSEC: **enabled** (ECDSA P-256 SHA-256, algo 13, key 35701)

### Proton Pass

- **Vault:** Zugzwang (separate from Personal)
- **Convention:** [Service] title prefix, title-cased
- **Items backfilled:**
  - [Proton] root account
  - [SSH] id_ed25519_github passphrase
  - [Namecheap] registrar login
  - [GitHub] Zugzwang-world personal account
  - [GitHub] zugzwang-foundation org
  - [2FA-backup] Proton recovery codes (encrypted note)
  - [2FA-backup] Namecheap recovery codes
  - [2FA-backup] GitHub recovery codes

### Toolchain (local MacBook Air, macOS 15.7.3 Sequoia)

- Xcode CLT 17.0 / clang-1700.0.13.5 (max for Sequoia)
- Homebrew: healthy, tier 2 configuration (known harmless)
- Node: **24.15.0 LTS** (brew install node@24, linked with --overwrite)
- pnpm: **10.33.2** (Homebrew)
- Global CLIs: gh 2.91.0, jq 1.7.1-apple, ripgrep 15.1.0, fd 10.4.2
- Claude Code CLI: 2.1.87 (standalone installer path ~/.local/bin/claude)
- VS Code: 1.114.0, `code` command linked to /usr/local/bin/code
- VS Code extensions: biomejs.biome, bradlc.vscode-tailwindcss, Prisma.prisma, github.vscode-pull-request-github, usernamehw.errorlens, eamodio.gitlens, tamasfe.even-better-toml (7 total)
- GitHub Copilot: uninstalled (conflicts with Claude Code workflow)
- gh CLI authenticated as Zugzwang-world only (hrishihunde logged out — see "Key security decisions")

### Repo editor config (committed via PR #1, squash-merged as d78e320)

- `.editorconfig` (UTF-8, LF, 2-space indent, final newline, trim trailing whitespace; .md keeps trailing whitespace; Makefile uses tabs)
- `.nvmrc` (24)
- `.vscode/settings.json` (Biome as formatter for JS/TS/JSON, format on save, organize imports on save, Error Lens tuned to errors+warnings)
- `.vscode/extensions.json` (recommends the 7 extensions + anthropic.claude-code)

---

## Key security decisions (logged explicitly)

### 1. SSH signing over gitsign
gitsign produces valid Sigstore signatures but GitHub doesn't trust Sigstore CAs by default. Badge showed "Unverified." Pivoted to SSH signing for GitHub-native Verified badges. Do not revive gitsign.

### 2. Two-GitHub-account separation
User's machine previously had gh CLI authenticated as "hrishihunde" (personal Gmail-linked account). Explicitly logged that account out (gh auth logout --user hrishihunde). Only Zugzwang-world remains authenticated.

### 3. Foundation/personal DMARC alignment
DMARC configured with strict alignment (adkim=s, aspf=s) and p=quarantine policy. Reporting address foundation@zugzwangworld.com. Self-domain reporting avoids cross-domain DNS authorization complexity.

### 4. Proton Pass scope
2FA codes themselves stored in Proton Authenticator (separate app). 2FA *backup/recovery* codes stored in Pass as encrypted notes. This avoids single-point-of-failure if Proton account compromised.

### 5. Branch protection relaxation
"Approvals required" changed from 1 to 0 due to GitHub's hard rule blocking self-approval. Solo-dev reality required this. When a collaborator joins, re-enable.

---

## Known deferrals (MUST REVISIT)

| Item | Trigger for revisit | Notes |
|---|---|---|
| Proton account 2FA circular dependency | Before Sep 15 OR on YubiKey purchase | Proton Authenticator 2FA lives inside Proton account; if Proton compromised, both password + 2FA lost. Mitigation options: Apple Passwords (Tier 1, free), YubiKey (Tier 2, ~₹4200), paper seed (Tier 3, free). |
| Claude Code account migration | Apr 25 (personal Claude Max expiry) | Currently authenticated as hrishihunde@gmail.com. Migrate to zugzwangworld@proton.me with new Claude Max subscription. ~15 min task. Not blocking for FOUND.1 (writing task). |
| Tahoe macOS upgrade | Post-Nov 8 (experiment conclusion) | Will unlock CLT 26.3. Deferred for stability during experiment. |
| Sequoia 15.7.5 point update | Any maintenance hour | 1.9 GB security patch. Not urgent. |
| Branch protection "1 approval required" | When 2nd collaborator joins | Re-enable approvals=1 with code owners rule once there's a reviewer who isn't the author. |
| `.zshrc` dead pnpm block | Any maintenance hour | Cosmetic. PNPM_HOME block points at deleted ~/Library/pnpm directory. Harmless but ugly. |
| Solidity VS Code extension | ENGINE.1 (per tracker) | Out of FOUND scope. Install when thin Zugzwang Market contract work begins. |
| iCloud sync on ~/Desktop/zugzwang folder | User preference | iCloud cloud icon appeared on zugzwang folder during session. User may want to exclude from iCloud sync if local-only preferred. |
| Foundation legal entity (Section 8 trust / non-profit) | Funding event or formal launch | Current "Foundation" is a naming convention only, not a legal entity. |

---

## Technical gotchas encountered (for future reference)

1. **Namecheap PremiumDNS vs Cloudflare migration** — plan started aiming at Cloudflare, pivoted to stay on PremiumDNS once Proton custom domain was discovered already configured (would have required migrating 6+ email DNS records with non-trivial risk). Saved the Cloudflare migration cost.

2. **macOS CLT version mismatch with Homebrew** — `brew doctor` warns about CLT 26.3 availability, but only Tahoe supports 26.3. Current CLT 17.0 is max for Sequoia. Warning is cosmetic noise; safe to ignore.

3. **Homebrew `brew install node` defaults to Current, not LTS** — use `node@24` formula explicitly for LTS. Initial attempt with `brew upgrade node` installed Node 25, which is Current (six-month lifecycle). Recovered via uninstall + versioned install.

4. **Two pnpm installations conflicted** — standalone installer at ~/Library/pnpm was winning over Homebrew's. Resolved by `rm -rf ~/Library/pnpm` and attempting to clean .zshrc PATH additions.

5. **gh CLI default account was wrong** — gh was authed as hrishihunde by default, causing first PR creation to fail with "must be a collaborator" error. Required full logout + re-login as Zugzwang-world.

6. **GitHub blocks self-approval on PRs** — hard rule, not a branch protection setting. Solo devs must relax approval requirement on branch protection rules. Documented explicitly above.

7. **zsh interprets `#` in pasted commands as literal command, not comment** — causes harmless "command not found: #" errors when pasting annotated command blocks. Not a real error.

---

## Memory edits made during session

- Added memory #8: Zugzwang timeline (5-month build phase Apr 24 – Sep 15, then ~2-month live phase Sep 15 – Nov 6-8). Rejects proactive tooling for post-Nov 8 scope unless explicitly rediscussed.

---

## What comes next

- **Apr 25:** Personal Claude Max expires. Migrate Claude Code auth to Foundation account on zugzwangworld@proton.me. ~15 min.
- **Apr 26 (tentative):** FOUND.1 begins. Pre-registered hypothesis document. Writing task, does not require Claude Code CLI.
- **FOUND.2 triggers:** Monorepo scaffold. At this point, create docs/logs/ directory structure, commit this log file into it.
- **Pre-cursor D is CLOSED. No further work belongs in this log.**

---

## Commit for this log

Once FOUND.2 creates docs/logs/, this file should move to docs/logs/CHAT-0-PRECURSOR-D-foundation-bootstrap.md with commit message:

> docs(log): add Chat 0 / Pre-cursor D foundation bootstrap log

Until then, this file lives at ~/Desktop/zugzwang-chat0-logs/.
