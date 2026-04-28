# FOUND.3 — AGPL-3.0 license + governance docs

**Status:** done
**Date started:** 2026-04-27
**Date completed:** 2026-04-27
**Duration:** ~1 day (single chat session)
**Session type:** Tracker task
**PR / commit:** PR #6 (LICENSE header), PR #7 (CODE_OF_CONDUCT.md), PR #8 (SECURITY.md)
**Chat link:** FOUND.3 chat (archived in Foundation Claude project)

---

## Scope

Per the tracker, FOUND.3 was scoped as four files: `LICENSE`,
`CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`. Final delivery
shipped three: LICENSE header (added to existing body), CoC, SECURITY.
CONTRIBUTING and TRADEMARK both deferred during chat — see Deviations.

---

## Final state — what is live

### LICENSE
- Canonical AGPL-3.0 body shipped silently in FOUND.2's initial commit
  (`4f4d746`); FOUND.3 prepended the FSF-recommended project header.
- Copyright line: `Copyright (C) 2026 The Zugzwang Authors` (Bitcoin /
  go-ethereum collective pattern).
- "or any later version" clause included (FSF default).
- GitHub sidebar correctly identifies repo as AGPL-3.0.

### CODE_OF_CONDUCT.md
- Contributor Covenant v2.1 verbatim.
- Enforcement contact: `foundation@zugzwangworld.com`.
- GitHub Community Standards "Code of Conduct" check green.

### SECURITY.md
- Disclosure policy scoped explicitly to experiment phase (web2, no
  funds, no chain).
- Single contact: `foundation@zugzwangworld.com`.
- Coordinated disclosure model, 90-day default for low-severity.
- No bug bounty during experiment phase; explicit "may introduce in
  later phases."
- Good-faith researcher safe-harbour language.

### Brand architecture (locked, applied across files)
- **Zugzwang** — protocol/codebase, permanent root identity.
- **Zugzwang Foundation** — non-profit legal entity, in formation,
  exists from testnet phase.
- **Zugzwang World** — consumer-facing app brand (`zugzwangworld.com`
  owned). Email `foundation@zugzwangworld.com` already operational.
- Ethereum analog: Zugzwang ↔ Ethereum, Zugzwang Foundation ↔ Ethereum
  Foundation, Zugzwang World ↔ ethereum.org / consumer apps.

### GitHub Community Standards
- License: green
- Code of Conduct: green
- Security policy: green
- Description / README / Contributing / issue templates / PR template:
  not green (deferred to SPEC.1 or other tasks).

### Repo architecture decision (applied to LICENSE/SECURITY language)
- `zugzwang-foundation/experiment` (current repo) is a permanent web2
  artifact, **archived (not renamed) Nov 8 2026** at experiment close.
- `zugzwang-foundation/testnet` opens as a fresh sibling repo for
  phase 2.
- Mainnet repo name TBD.
- Foundation governance repos created post-Foundation incorporation.

---

## Decisions taken

- **License: AGPL-3.0 confirmed and locked.** Initial assumption was
  "AGPL because it matches Manifold." Research during this chat showed
  Manifold is actually MIT-licensed, not AGPL. Decision stands but
  rationale shifted to thesis alignment: AGPL § 13 forecloses closed-
  source SaaS forks, which fits "knowledge × n > C" cleanly. Formal
  ADR rationale to be captured in FOUND.6.

- **Copyright collective phrasing: "The Zugzwang Authors."** Bitcoin /
  go-ethereum pattern. Forward-compatible with future contributors;
  doesn't require Foundation to exist; doesn't require explicit
  assignment from contributors. Hrishikesh's full legal name appears
  in git history (signed commits) and will appear in TRADEMARK.md when
  written, **not** in LICENSE.

- **"Or any later version" clause included** in LICENSE header. FSF
  standard. Allows downstream users to upgrade if AGPL-4.0 ships.

- **Single contact email for security and CoC enforcement.**
  `foundation@zugzwangworld.com` for both during experiment phase. A
  dedicated `security@zugzwangworld.com` alias was discussed but
  deferred — adds discoverability but introduces misrouting risk for a
  one-person team.

- **No CLA, no DCO during experiment phase.** Decided after research
  surfaced that no external contributors are expected during the
  experiment. Will be revisited if/when the contributions discussion
  resumes.

- **No domain expansion.** `zugzwang.com` and `zugzwang.io` are held by
  speculators at premium pricing (~$70k and ~$2.1k respectively).
  Adjacent TLDs (`.app`, `.foundation`, `.xyz`) are available at normal
  prices but not blocking. Stay on `zugzwangworld.com` for the
  experiment; revisit at Foundation incorporation.

- **Trademark posture: Linux/PSF-permissive (when written).** When
  TRADEMARK.md eventually ships, it will follow the Linux Mark
  Institute / Python Software Foundation pattern — nominative use
  free, prefixed names allowed, only the unmodified wordmark + logo
  reserved for official use. Mastodon-style restrictive posture
  explicitly rejected because it would suppress the builder
  propagation the thesis requires.

- **Smart-contract licensing decision deferred** to a conscious choice
  before SPEC.5 / ENGINE.1. Research recommended LGPL-3.0 on contracts
  (vs AGPL-3.0 on application code) to avoid chilling regulated
  intermediaries who would otherwise face § 13 obligations from
  interacting with the protocol.

---

## Deviations from plan

- **CONTRIBUTING.md deferred.** Tracker scoped it for FOUND.3. Decided
  during chat to defer until external contribution model is settled.
  Hrishikesh has a different approach in mind that hasn't been
  discussed yet.

- **TRADEMARK.md deferred.** Was added to scope mid-chat after research
  surfaced the Foundation/World brand architecture, then cut after
  deciding to defer all formal trademark work to Foundation
  incorporation. No public assertion of common-law trademark rights
  was made during this task. Git history serves as evidentiary first-
  use record.

- **LICENSE work shrank from "create" to "add header."** The canonical
  AGPL-3.0 body was already on `main` from FOUND.2's initial commit
  without explicit task scope. FOUND.3 prepended the project header
  rather than creating the file from scratch.

- **Scope expanded mid-chat with research passes.** Two extended-
  research passes ran during this chat (governance design, trademark
  clearance). Findings inform decisions made above and will inform
  future tasks (FOUND.6, eventual TRADEMARK.md, Foundation-phase
  work). Reports preserved in chat transcript; consider committing as
  `docs/research/` artifacts in a future task.

---

## Open items / follow-ups

### Blocking future technical work

- **Smart-contract licensing decision (LGPL-3.0 vs AGPL-3.0).** Must be
  resolved before SPEC.5 / ENGINE.1. Conscious decision needed; not
  accidental.

- **CONTRIBUTING.md content + CLA infrastructure.** Blocks any
  external-contribution work. Resolution depends on the deferred
  contributions discussion.

- **Foundation incorporation.** Blocks formal trademark filings, dual-
  license commercial-exit option, and any structural governance
  change. Should begin Q3 2026 to match testnet timing.

### Non-blocking

- **TRADEMARK.md.** Deferred to Foundation incorporation. Foundation
  will file actual trademarks (US/EU/UK/Singapore) per earlier
  research; written trademark policy follows from filings.

- **`security@zugzwangworld.com` alias.** Set up as a forward to
  `foundation@zugzwangworld.com` whenever convenient. Update
  SECURITY.md to list both addresses (preferred + fallback) once alias
  is live. Tiny PR.

- **`AUTHORS` file.** Deferred until contributor #2 lands at testnet
  phase. Git log is the authoritative author list per Bitcoin
  convention until then.

- **Domain decisions.** `zugzwang.foundation`, `zugzwang.app`,
  `zugzwang.xyz` available at normal prices today; could be grabbed
  for ~$50/yr total as squatter-defense. Not urgent. Revisit at
  Foundation incorporation or if a press mention forces the issue.

- **SPDX header convention.** Every source file going forward gets
  `SPDX-License-Identifier: AGPL-3.0-or-later` (syntax adjusted per
  language). No mass retrofit of existing FOUND.2 scaffold files; add
  as files get touched. Convention to be reflected in CLAUDE.md
  (FOUND.4).

- **Two extended-research reports preserved in chat history.**
  Governance design (12-file recommendation, hybrid ecosystem shape,
  Cayman foundation structure) and trademark clearance (mostly clean
  for prediction-market niche, Moldovan Zugzwang Labs as adjacent-
  niche concern). Both will inform FOUND.6 and future tasks; consider
  committing as `docs/research/` artifacts when the directory is
  created.

- **Local `git log --show-signature` warning.** Reports `cannot run
  gpg: No such file or directory`. Commits are SSH-signed correctly
  and verified on GitHub; only local verification needs `gpg`. Fix
  with `brew install gnupg` whenever convenient.

---

## Context to carry forward

The experiment-phase repo has its public legal posture in place: AGPL-
3.0 licensed with project header, Contributor Covenant 2.1 enforced,
security disclosure channel documented. Three of eight GitHub Community
Standards rows green; the remaining five (description, README content,
contributing, issue templates, PR template) are deferred or owned by
SPEC.1 / UI.* tasks.

The brand architecture is locked: **Zugzwang** is the permanent
protocol/project identity, **Zugzwang Foundation** is the future
steward (not yet incorporated), **Zugzwang World** is the consumer-app
brand. All three appear in TRADEMARK.md when written; only "The
Zugzwang Authors" appears in LICENSE.

`zugzwang-foundation/experiment` is a permanent historical artifact —
archived (not renamed) Nov 8 2026, fresh `zugzwang-foundation/testnet`
repo opens for phase 2. All FOUND.3 decisions assume that arc.

The next foundation task is **FOUND.4** — extend `CLAUDE.md` with
Playbook §3 Zugzwang-specific content, preserving the existing
`@AGENTS.md` import line. After FOUND.4, **SPEC.1** opens (product
spec) as the first non-foundation task. No non-trivial code lands
before SPEC.1 per project refusal rules.

Three deferred decisions block downstream work: smart-contract
licensing (before SPEC.5/ENGINE.1), CONTRIBUTING.md + CLA (blocks
external contributions), Foundation incorporation (blocks formal
trademark filings and dual-license optionality). All three should be
visible in tracker state going into FOUND.4.