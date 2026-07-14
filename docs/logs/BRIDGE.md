# BRIDGE — branded dark token layer (session log)

One-PR arc: the single swap commit + this log commit ride `feat/bridge-branded-tokens`.
Plan authority: `docs/plans/BRIDGE.md` (ratified with rulings, web review 2026-07-14).
Rider authority: `BRIDGE_riders_2026-07-14.md` (web-authored, operator-delivered via
~/Downloads; applied in full; stays operator-side — not a plan-named commit artifact).

## 1. What landed (files + PR#)

**Swap commit** — branch SHA `8111004` (ephemeral; canonical = the squash SHA on `main`
at merge), 9 files, one commit per the same-commit doctrine (swap + CI pin + contract
amendment + provenance together):

- `src/app/globals.css` — the full ④②⑤ re-value + ③'s two strays (values-log v0_3 §3
  transcribed from the plan tables; file-wide achromatic; hex lowercase per D4).
- `tests/unit/design/tokens-monochrome.test.ts` — T2 amendment: 11 hex pins,
  declaration-anchored census regex (R==G==B), ground/graph/destructive pins, the
  `NOT Support (design-language §1.3/§2.1)` coupling + all three bans kept; filename kept.
- `public/brand/zugzwang-mark.svg` — byte-copy (md5 `e5887b5b…`, 682 B, 4× `#FFFFFF`).
- `docs/design/design-language.md` — rider §1 (8 amendments) → **v0.7-draft**.
- `docs/design/design-canon.md` — rider §2 (5 amendments) → **v1.1-draft**.
- `docs/design/design-token-contract.md` — rider §3 (14 amendments) → **v0.4**.
- `AGENTS.md` — §8 bullets 2+3 replaced (approved verbatim; OQ-2 hex rule + branded-dark
  token paragraph).
- `docs/design/ZUGZWANG-BRAND_agenda-and-values-log_v0_3.md` — provenance, byte-verbatim
  (md5 `90f767b6c550c04ccfa711167c97dcc2` verified at placement, stage, and post-commit).
- `docs/design/ZUGZWANG-CD_branding-handoff-decision-record_v1_0.md` — provenance,
  byte-verbatim (md5 `712fffc4efb6c385863bb339d90c6486`, same three-point verification).

**This log commit** — `docs/logs/BRIDGE.md`. The PR opens immediately after it
(checklist order): `feat/bridge-branded-tokens → main`, title "BRIDGE: branded dark
token layer (values-log v0_3 §3)"; the PR number lands on the squash line. **Operator
merges** after the web diff-read + green CI — CC does not merge.

Gates (re-run post-riders, all green): design vitest 8/8 · `ZUGZWANG_ENV=preview just
verify` · full `pnpm vitest run` 196 files / 1319 tests (3 pre-existing skips) ·
grep-verify zero bans + zero chromatic oklch · serve smoke (mark 200 + md5-identical;
compiled CSS emits ground/poles/graph/destructive chains).

## 2. Decisions made

- **D1–D5 rulings** (riders §0) applied: plan restore-from-HEAD accepted · SVG
  Downloads-sourcing accepted · provenance files placed + md5-pinned (D3) · **lowercase
  hex ratified, no formatter suppression** (D4 — empirically a Biome *formatter* error,
  not lint; uppercase cannot survive `just check`/pre-commit) · role comments deferred
  to the web diff-read (D5).
- **Rider application policy** (anchors quote disk with inline emphasis stripped; NEW
  TEXT is verbatim-final): anchors verified word-level against disk — all matched;
  NEW TEXT pasted as authored, preserving only document *structure*: heading `###`
  prefixes, list indentation (§1.9 bullets), blockquote `>` markers, header-label bolds
  (`> **Status:**` on the contract), and footer/table-note italic wraps (contract +
  design-language closing lines, §2.1 post-table note).
- **Named calls under rider latitude** (each web-reviewable in the diff):
  **1.** canon closing line bumped v1.0→v1.1-draft — rider §2 omitted the instruction;
  applied under the §0 version ruling ("clean bump").
  **2.** contract §2.3 *heading* "values are build placeholders" → "values ratified
  FINAL (B1)" under §3.8's softer rule (the rider quoted only the two row notes; both
  rows got the ratified-FINAL note verbatim). Recorded per §3.8.
  **3.** canon §10 entries formatted to the log's numbered bold-lead convention
  (rider-authorized "match the log's existing entry format"); numbered 4–6.
  **4.** design-language §1.3-conditional met: constraint 5 still said deferred →
  appended "(Resolved at B1: no accent — see §2.1.)" exactly as instructed.
  **5.** rider §3.10 landed as contract §3.6 exactly as expected (last §3 subsection
  was §3.5) — no renumbering.
- Swap-commit hygiene: `.env.example` (pre-existing stray) excluded; no Co-authored-by
  trailer; commit identity `Zugzwang/world`.

## 3. Open questions

- **D5 verdict pending**: CC-authored globals.css role comments (dump role comments
  were not transcribable pre-D3) — corrections ride the PR review round.
- **Stale-residue flags for the web diff-read** (deliberately NOT touched — outside the
  rider's amendment list): design-language header division-of-labour + §2-intro tail
  still say type values "blank"/accent "deferred"; §1 constraint 4's "future-colour
  placeholder" framing; canon §13 supersession map still cites "design-language v0.5 ·
  design-token-contract v0.2" (historical framing); contract §1's five-block line
  numbers + "known flattening" note (the `:root` literals are now var() chains) and
  §3.2's "every value below is the live file, verbatim" (now the *retired light*
  values — historical snapshot). If the web wants these restated, that is a follow-up
  rider, not this PR.

## 4. Next session starts at

Operator merges the PR after the web diff-read + green CI. Next session: post-merge
close-out — read the squash SHA via `gh pr view <N> --json mergeCommit` (never relay),
prove the tree (`git diff 8111004 origin/main -- <the 9 paths>` empty), delete the
branch if auto-delete didn't fire (`git ls-remote`), then the next branding-lane task
(WI-12 names favicon/OG/verified-badge for the deck chat; the component build lane
reads values-log §3 items 3/5 for engaged-slot/pill treatments).

## 5. Context to preserve

- **Value authority**: the committed values-log §3 dump (uppercase hex); landed form is
  lowercase (Biome formatter, D4-ratified); CSS hex is case-insensitive.
- The CI pin file is the brand-drift guard: 11-token hex census (R==G==B,
  `--color-ground` outside via closed alternation), exact pins incl.
  `--destructive: var(--color-n6);`, comment coupling pins design-language §1.3/§2.1
  numbering — renumbering those sections breaks CI.
- `bg-ground` generates but nothing consumes it yet; the graph consumes `--graph-*`,
  never `--chart-*` (contract §3.6 note).
- `.dark` is descoped-inert (OQ-1): never applied, names frozen, two strays neutralized;
  any second theme is a contract amendment, not a `.dark` revival.
- Browser-level visual smoke rides the operator's PR read (curl-level smoke done).
- `.env.example` modification remains in the working tree, uncommitted (not BRIDGE's).

## 6. Time

2026-07-14 ~21:15 IST → 2026-07-15 ~00:20 IST (~3h wall, including the rider pause);
implementation ~1h · riders application + gates ~1h · commit/log/PR ritual the rest.
