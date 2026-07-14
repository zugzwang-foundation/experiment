# BRIDGE — branded token layer → repo · plan v1 · RATIFIED with rulings (web review, 2026-07-14)

> **Task:** DESIGN.B1 close → bridge stage 2 (decision-record v1_0 pipeline). Mirror the
> values-log §3 dump into `src/app/globals.css` against the frozen contract slots; amend
> the CI pin in the same commit; land the mark SVG; enumerate the web-authored doc riders.
> **Scope:** tokens · one test · docs · one SVG — **zero component/layout edits** (blast
> radius verified). One PR, squash-merge. Precision serial, NOT ultracode. No migration.
> **No new ADR** (values-only change under design-token-contract + the ratified CD
> decision record; ADR ceiling verified 0031).
> **Value authority:** values-log v0_3 §3 (provided verbatim in-chat 2026-07-14). Every
> hex below is transcribed literally from the dump — never derived from the repo ramp
> (the CD ramp is inverted vs the repo's; name-based lightness copying is the defect).

## STEP 0 — verified at repo HEAD `074ea31` (clean tree*)

| Check | Result |
|---|---|
| main green | ✓ two latest PR CI runs success; Env Audit green 2026-07-14 |
| Swap absent | ✓ `color-ground\|#181818` → 0 hits in globals.css |
| ADR ceiling | ✓ 0031 highest |
| tokens.json | not on disk — only the appendix skeleton **inside** design-token-contract.md (WI-1 de-alias is a doc-rider edit) |
| `--pole-hairline` / `--border-emphasis` | zero repo occurrences (CD-side names) |
| `--chart-*` consumers | globals.css only — no component reads them |
| Brand-asset convention | none; `public/` flat scaffold → mint `public/brand/` |
| Mark SVG | `zugzwang-logo-dark-transparent.svg` verified: 4 polygons, all `fill="#FFFFFF"`, 682 B |
| `.dark` applied anywhere | no (`layout.tsx` has no `dark` class; no toggler) — block already inert |
| Utility consumers | `bg-n*`/`bg-yes`/`bg-no`/`text-yes`/`text-ink`: only `src/components/debate/PriceBar.tsx` + `badges.tsx`; `var(--hairline)` ×6 debate files; `var(--imgmax/--imgr)`: CommentImage, dialogs — all survive a value swap unchanged |
| *tree note | `.env.example` modified pre-existing (not BRIDGE's — keep out of the PR) |

## T1 — block structure (ratified)

globals.css five blocks: ① `@theme inline` L7–48 (shadcn→Tailwind bridge) · ② `:root`
L50–83 (shadcn semantics) · ③ `.dark` L85–117 · ④ `@theme` L126–147 (the mint) · ⑤
`:root` L155–159 (raw props). Tailwind v4 generates `bg-*`/`text-*` utilities **only
from ④** — the dump's single-`:root` layout is NOT copied; dump = value authority, repo
block layout preserved.

- **④ `@theme`** — utility-generating colour tokens only: re-valued n-ramp + poles,
  **new `--color-ground`** (generates `bg-ground`; outside the census alternation), fonts
  unchanged.
- **② `:root`** — shadcn slots re-pointed to the dump's tier-2 `var(--color-*)` aliases
  (the dump upgrades the contract's noted "flattened literals" to proper var() chains —
  closer to contract §1 intent). `--sidebar-*` (dump-omitted) re-pointed by the
  mechanical mirror rule (T3). `--radius` unchanged.
- **⑤ `:root` raw props** — everything var()-consumed and non-utility: the 24 new
  applied-semantic/state/elevation tokens + 5 item-2 tokens (`--r`, `--r-chip`,
  `--r-dot`, `--avatar-ring`, `--dur-hover`). `--hairline`/`--imgmax` unchanged;
  `--imgr` value unchanged (comment: CD-DEFERRED → ratified, §3 item 2).
- **③ `.dark`** — WI-7 ratified: single dark theme lands in `:root`/`@theme`;
  `.dark` left physically present, **descoped-inert** (never applied), with its two
  chromatic strays neutralized for file-wide achromacity: `--sidebar-primary`
  `oklch(0.488 0.243 264.376)` → `var(--color-n7)` (mirror rule) · `--destructive`
  `oklch(0.704 0.191 22.216)` → `var(--color-n6)`. Contract §3.4 rider records descoped.
- **① `@theme inline`** — untouched (pure var() plumbing; `--font-heading ≡ --font-sans`
  already matches dump item 2).
- `@layer base` untouched — `bg-background text-foreground` resolves to ground/ink via ②.

## Old → new token table (values verbatim from §3; placement per T1)

### ④ `@theme` — census tokens + ground

| Slot | Old | New |
|---|---|---|
| `--color-ground` | — (new) | `#181818` |
| `--color-n0` | `oklch(1 0 0)` | `#212121` |
| `--color-n1` | `oklch(0.971 0 0)` | `#2A2A2A` |
| `--color-n2` | `oklch(0.922 0 0)` | `#404040` |
| `--color-n3` | `oklch(0.871 0 0)` | `#545454` |
| `--color-n4` | `oklch(0.708 0 0)` | `#747474` |
| `--color-n5` | `oklch(0.556 0 0)` | `#989898` |
| `--color-n6` | `oklch(0.371 0 0)` | `#BDBDBD` |
| `--color-n7` | `oklch(0.205 0 0)` | `#E4E4E4` |
| `--color-ink` | `oklch(0.145 0 0)` | `#FAFAFA` |
| `--color-yes` | `oklch(0.145 0 0)` | `#181818` (BLACK = YES; binding untouched, value retune R-1) |
| `--color-no` | `oklch(1 0 0)` | `#FAFAFA` (WHITE = NO) |
| `--font-sans` / `--font-mono` | `var(--font-geist-*)` | unchanged (Geist ratified FINAL — WI-13 comment/doc fix only) |

Comment policy: carry the dump's role comments; strip the CD-export `/* @kind … */`
annotations; pole comment merges the dump's lock language **grafting the pinned string
verbatim** — `NOT Support (design-language §1.3/§2.1)` — and never reintroduces the
banned strings.

### ② `:root` — shadcn semantics (dump tier-2, verbatim aliases)

| Slot | Old | New |
|---|---|---|
| `--background` | `oklch(1 0 0)` | `var(--color-ground)` |
| `--foreground` | `oklch(0.145 0 0)` | `var(--color-ink)` |
| `--card` | `oklch(1 0 0)` | `var(--color-n0)` |
| `--card-foreground` | `oklch(0.145 0 0)` | `var(--color-ink)` |
| `--popover` | `oklch(1 0 0)` | `var(--color-n0)` |
| `--popover-foreground` | `oklch(0.145 0 0)` | `var(--color-ink)` |
| `--primary` | `oklch(0.205 0 0)` | `var(--color-n7)` |
| `--primary-foreground` | `oklch(0.985 0 0)` | `var(--color-ground)` |
| `--secondary` | `oklch(0.97 0 0)` | `var(--color-n1)` |
| `--secondary-foreground` | `oklch(0.205 0 0)` | `var(--color-n7)` |
| `--muted` | `oklch(0.97 0 0)` | `var(--color-n1)` |
| `--muted-foreground` | `oklch(0.556 0 0)` | `var(--color-n5)` |
| `--accent` | `oklch(0.97 0 0)` | `var(--color-n1)` + dump comment (neutral wash, NOT a brand accent) |
| `--accent-foreground` | `oklch(0.205 0 0)` | `var(--color-n7)` |
| `--destructive` | `oklch(0.577 0.245 27.325)` ⚠ red | `var(--color-n6)` (neutralized — WI-11) |
| `--border` | `oklch(0.922 0 0)` | `var(--color-n2)` |
| `--input` | `oklch(0.922 0 0)` | `var(--color-n2)` |
| `--ring` | `oklch(0.708 0 0)` | `var(--color-n4)` |
| `--chart-1…5` | `0.87 / 0.556 / 0.439 / 0.371 / 0.269` | `var(--color-n7)` / `n5` / `n4` / `n3` / `n2` |
| `--radius` | `0.625rem` | unchanged (dump item 2 confirms) |
| `--sidebar` | `oklch(0.985 0 0)` | `var(--color-n0)` ← mirror of `--card` (T3) |
| `--sidebar-foreground` | `oklch(0.145 0 0)` | `var(--color-ink)` |
| `--sidebar-primary` | `oklch(0.205 0 0)` | `var(--color-n7)` |
| `--sidebar-primary-foreground` | `oklch(0.985 0 0)` | `var(--color-ground)` |
| `--sidebar-accent` | `oklch(0.97 0 0)` | `var(--color-n1)` |
| `--sidebar-accent-foreground` | `oklch(0.205 0 0)` | `var(--color-n7)` |
| `--sidebar-border` | `oklch(0.922 0 0)` | `var(--color-n2)` |
| `--sidebar-ring` | `oklch(0.708 0 0)` | `var(--color-n4)` |

**T3 note:** the dump omits the `--sidebar-*` family (8 slots). Names never removed
(contract rule); values re-pointed by the mechanical rule *each `--sidebar-X` mirrors the
dump's `--X`*. These 8 are derived, not dump-verbatim — **ratified as tabled (OQ-8)**.

### ⑤ `:root` raw props — existing + 29 new (dump verbatim)

| Slot | Old | New |
|---|---|---|
| `--hairline` | `1px solid var(--color-n2)` | unchanged — resolves to `1px solid #404040` ≡ dump item 2 exactly |
| `--imgmax` | `160px` | unchanged (WI-5 reconciles at build; shell rule wins) |
| `--imgr` | `6px` | value unchanged; comment CD-DEFERRED → **ratified** (item 2: images/avatars/media/graph panels) |
| `--surface-page` | — | `var(--color-ground)` |
| `--surface-inset` | — | `var(--color-n1)` |
| `--btn-fill` | — | `var(--color-ground)` |
| `--text-primary` | — | `var(--color-ink)` |
| `--text-body` | — | `var(--color-n6)` |
| `--text-meta` | — | `var(--color-n5)` |
| `--text-faint` | — | `var(--color-n4)` |
| `--border-strong` | — | `var(--color-n2)` (dump: kept as alias; old ink-emphasis treatment retired) |
| `--overlay` | — | `rgb(10 10 10 / 0.6)` |
| `--graph-yes` | — | `#737373` (deliberately off-ramp — dump comment carried) |
| `--graph-no` | — | `#FAFAFA` |
| `--state-hover-fill` | — | `var(--color-n1)` |
| `--state-pressed-fill` | — | `#333333` (minted mid-step n1→n2) |
| `--state-hover-border` | — | `var(--color-n3)` |
| `--state-focus-ring` | — | `0 0 0 2px rgb(255 255 255 / 0.32)` |
| `--state-focus-ring-pole` | — | `0 0 0 2px var(--color-n0), 0 0 0 4px rgb(255 255 255 / 0.32)` |
| `--state-hover-glow-pole` | — | `0 0 8px 0 rgb(255 255 255 / 0.22)` |
| `--state-pressed-glow-pole` | — | `0 0 8px 2px rgb(255 255 255 / 0.34)` |
| `--state-disabled-opacity` | — | `0.5` |
| `--elev-0` | — | `none` |
| `--elev-1` | — | `inset 0 1px 0 rgb(255 255 255 / 0.04), 0 1px 2px rgb(0 0 0 / 0.4)` |
| `--elev-2` | — | `inset 0 1px 0 rgb(255 255 255 / 0.06), 0 2px 4px rgb(0 0 0 / 0.4), 0 6px 16px rgb(0 0 0 / 0.5)` |
| `--elev-3` | — | `inset 0 1px 0 rgb(255 255 255 / 0.08), 0 4px 12px rgb(0 0 0 / 0.45), 0 16px 40px rgb(0 0 0 / 0.6)` |
| `--r` | — | `8px` |
| `--r-chip` | — | `4px` |
| `--r-dot` | — | `3px` |
| `--avatar-ring` | — | `1px solid var(--color-n2)` (≡ dump literal `1px solid #404040`; var-alias form ratified — OQ-6) |
| `--dur-hover` | — | `0.12s ease` (ratified — OQ-5) |

**Deliberately NOT minted** (named deviations from the dump file, rationale each):
`--pole-hairline` + `--border-emphasis` — retired aliases "kept for compat" CD-side;
repo has zero consumers and never carried them → **record-only** in the contract rider
(OQ-3, ratified). Type scale / weights / tracking / leading (item 2) — stay
vocabulary-only per contract §2.3 (promotion = separate amendment); builds read the
values-log. Component treatments (engaged-slot backlight `0 0 10px 1px
rgba(255,255,255,0.2)`, Support/Counter pill glows `0.25`/`0.4`, black-pill 0.5px
exception, header cluster geometry) — §3 items 3/5 component specs, **not tokens**;
they ride the provenance doc for the build lane — do not mint token forms for them.

### ③ `.dark` — inert-block hygiene only

| Slot | Old | New |
|---|---|---|
| `--sidebar-primary` | `oklch(0.488 0.243 264.376)` ⚠ blue | `var(--color-n7)` |
| `--destructive` | `oklch(0.704 0.191 22.216)` ⚠ red | `var(--color-n6)` |
| all other `.dark` slots | stock shadcn dark | untouched (descoped-inert) |

## T2 / WI-6 / WI-10 — CI-pin amendment (same commit as the swap)

Current mechanics (quoted from `tests/unit/design/tokens-monochrome.test.ts`): census
regex `/--color-(?:n[0-7]|ink|yes|no):\s*oklch\(\s*[\d.]+\s+([\d.]+)\s+[\d.]+\s*\)/g` +
11 exact-string `toContain("token: value;")` pins + standalone pole pins + the comment
coupling `NOT Support (design-language §1.3/§2.1)` + bans (`--color-brand`,
`/do not consume/i`, `/DESIGN\.7 back-applies/i`). **Proof of non-survival:** the regex
is oklch-literal-anchored — hex matches zero → `toHaveLength(11)` fails; all exact pins
fail on any value change. (The log's WI-6 "census survives" holds only for oklch-form
landing; ratified landing is hex — dump header: "Hex is authoritative" — so mechanics
amend, as the kickoff authorizes.)

Amended test (same file, never deleted — becomes the brand-drift guard):
- `EXPECTED_TOKENS` → the 11 hex pairs from ④ above.
- Census → declaration-anchored hex form: `/^\s*--color-(?:n[0-7]|ink|yes|no):\s*#([0-9A-Fa-f]{6});/gm`,
  assert exactly 11 matches; achromatic check as **R==G==B** per captured hex.
  Closed alternation keeps `--color-ground` outside the count (WI-2).
- New exact pins (ratified): `--color-yes: #181818;` · `--color-no: #FAFAFA;` ·
  `--color-ground: #181818;` · `--graph-yes: #737373;` + `--graph-no: #FAFAFA;`
  (the B1 exit criterion: two unmistakably different lines) and
  `--destructive: var(--color-n6);` (neutralization guard).
- Keep verbatim: the `NOT Support (design-language §1.3/§2.1)` coupling (pins a
  globals.css comment — the merged pole comment retains it), all three bans.
- Header/describe text updated to the BRIDGE era; filename kept.
- Fallback if hex is later rejected: dump's oklch comment-equivalents (WI-10), existing
  regex shape retained with the anchoring fix + new values.

## T4 — no accent

Ratified true-neutral: contract §2.2 stays reserved-empty; contract §5 steps 1–2
(mint accent, re-point `--primary`/`--accent`/`--ring`) are struck for BRIDGE. The
dump's `--accent` is a **neutral wash** (`var(--color-n1)`), not the reserved brand
accent. Census stays 11. Nothing named `--color-accent-*` / `--color-brand` lands.

## WI-8 — doc-amendment POINTS (rider text is web-authored; PAUSE at the commit point and request it — same-commit doctrine)

1. design-language §1.9: "white or near-white, true-neutral ground" → dark-ground
   restatement (`#181818` ground era). **§1.3/§2.1 numbering must not shift** (CI coupling).
2. design-language §3.2 two-line graph: dark-ground mirror — YES = `#737373` grey
   stand-in (black pole can't render on dark), NO = `#FAFAFA`; series-bound.
3. design-language §2.1: landed values restated (hex), provenance bump to the BRIDGE swap.
4. design-canon: monochrome reframing (dark true-neutral era); §11 residual rows for
   `.dark`/`--destructive`/off-ramp greys close via this PR.
5. token-contract: §2.1 ramp re-values + `--color-ground` new primitive row (WI-2);
   §3.1 pole lock text → literals `#181818`/`#FAFAFA` (binding unchanged — R-1);
   §3.4 all three deviations closed (`.dark` descoped-inert; `--destructive`
   neutralized; off-ramp greys superseded by the dump re-point); appendix skeleton:
   `side.*` de-aliased to literal `$value`s (WI-1), `"(placeholder)"` font strings
   fixed (WI-13); new-token census added (WI-11: `--elev-0..3`, `--state-*` ×8,
   `--graph-yes/no`, `--overlay`, `--r`, `--r-chip`, `--r-dot`, `--surface-*` ×2,
   `--btn-fill`, `--text-*` ×4, `--border-strong`, `--avatar-ring`, `--dur-hover`,
   `--color-ground`); retired names `--pole-hairline`/`--border-emphasis` recorded
   as retired; `--chart-*` retained with a "graph consumes `--graph-*`" note;
   version bump v0.2-draft → v0.4 per OQ-7 ruling.
6. Record R-2 (W2.4 timer micro-format: digits-only `45:06:15` in the 2×8 chessboard;
   units + `TO FREEZE` removed) + R-5 (slot-header geometry: values-log §1 item 6
   supersedes mockup px) + R-3 note (W2.13 share-card lockup may shorten).
7. WI-13: Geist + Lucide ratified FINAL — token-contract §2.3 placeholder framing
   fixed (point 5); **AGENTS.md §8** same PR: the "CD-deferred neutral-sans
   placeholder" sentence, the `--imgr` "flagged CD-deferred placeholder" sentence,
   and the token-paragraph rewrite (monochrome-mint description → dark brand system).
8. AGENTS.md §8 "OKLCH only in `@theme` — no hex/HSL/RGB" conflicts with the ratified
   hex landing — amended to the new rule (hex authoritative in @theme, oklch in
   comments, census achromatic = R=G=B) in this PR. AGENTS.md text is CC-authored,
   web-reviewed at the rider pause (OQ-2 ruling).

§6 build-lane rulings (reply-page position strip a·a·a; H2-scrub avatar; PFP pipeline)
carry to the tracker/spec lane via the committed values-log — no BRIDGE code action.

## Files

| File | Action |
|---|---|
| `src/app/globals.css` | the swap (④②⑤ edits + ③ two strays) |
| `tests/unit/design/tokens-monochrome.test.ts` | same-commit amendment |
| `public/brand/zugzwang-mark.svg` | new — byte-copy of `zugzwang-logo-dark-transparent.svg` (fills stay `#FFFFFF`) |
| `docs/design/design-language.md` · `design-canon.md` · `design-token-contract.md` | web-authored riders (points above) |
| `docs/design/ZUGZWANG-BRAND_agenda-and-values-log_v0_3.md` | provenance commit (ratified) |
| `docs/design/ZUGZWANG-CD_branding-handoff-decision-record_v1_0.md` | commits alongside the values-log (OQ-4 ruling) |
| `AGENTS.md` | §8 rewrite (points 7–8) — CC-authored, web-reviewed at the pause |
| `docs/plans/BRIDGE.md` + `docs/logs/BRIDGE.md` | ritual (plan committed in the plan chat; log before PR) |

## Execute sequencing

1. Branch `feat/bridge-branded-tokens`; commit `docs/plans/BRIDGE.md` (ratified text).
   *(Done in the plan chat, 2026-07-14.)*
2. Draft the full swap + test amendment + SVG copy; run gates locally.
3. **PAUSE** — request the web-authored rider text for the three design docs + present
   the CC-authored AGENTS.md §8 text for web review (WI-8; same-commit doctrine: WI-10
   requires contract §3.1 + pins + swap in ONE commit).
4. Single swap commit: globals.css + test + SVG + doc riders + AGENTS.md.
5. Session log commit → PR → squash-merge.

## Verification

`ZUGZWANG_ENV=preview just verify` · `pnpm vitest run tests/unit/design/` (amended pin
green against the new file) · full `pnpm vitest run` (final pre-PR local gate) · visual
smoke `just dev`: dark ground `#181818`, debate badges render `#181818`-on-`#FAFAFA`
inversions, mark serves at `/brand/zugzwang-mark.svg` · grep-verify: no `--color-brand`,
no `do not consume`, no `DESIGN.7 back-applies`, no chromatic oklch outside ③'s
untouched inert slots (expected: zero after stray neutralization). Non-critical path
(no CLAUDE.md §1 dirs) → §5.10/§5.11 not mandatory; `just verify` + full vitest is the gate.

## WI coverage matrix (all 13)

| WI | Disposition |
|---|---|
| WI-1 | poles land as literals in ④; appendix `side.*` de-aliased (doc point 5) |
| WI-2 | `--color-ground: #181818` in ④, outside census, own pin; contract row added |
| WI-3 | CD-closed; bridge lands `--graph-yes/no` (⑤) + contract slots + §3.2 mirror |
| WI-4 | CD-closed; no bridge action |
| WI-5 | no bridge action; `--imgmax` stays; reconcile at build (shell wins) |
| WI-6 | test amended in the swap commit (T2 sketch; hex mechanics ratified) |
| WI-7 | ruling: `:root`/`@theme` as today; `.dark` descoped-inert + 2 strays neutralized (OQ-1) |
| WI-8 | doc points 1–8; design-doc text web-authored, AGENTS.md CC-authored, at the execute PAUSE |
| WI-9 | CD-side discipline; recorded, no bridge action |
| WI-10 | contract §3.1 + CI pins → `#181818`/`#FAFAFA`, same commit; oklch fallback named |
| WI-11 | full census: 29 new tokens minted (24 CSS + 5 item-2) · 2 retired names record-only · `--destructive`→n6 both blocks · `--chart-*` kept + graph-consumption note |
| WI-12 | `public/brand/zugzwang-mark.svg` (transparent variant, `#FFFFFF` fills verified); favicon/OG/verified-badge deferred to deck chat (named); black-square variant stays operator-side |
| WI-13 | contract §2.3/appendix + AGENTS.md §8 fixes; repo globals.css has no Geist comment (verified — no pin collision); ④ gains a ratified-FINAL font comment; `--imgr` comment updated |

## Ratified rulings (web review, 2026-07-14 — verbatim)

- OQ-1: .dark descoped-inert; neutralize its 2 chromatic strays
  (--sidebar-primary → var(--color-n7), --destructive → var(--color-n6)).
  No parallel swap, no deletion.
- OQ-2: hex authoritative; AGENTS.md §8 "OKLCH only" amended to the new
  rule (hex authoritative in @theme, oklch in comments, census achromatic
  = R=G=B) in this PR. AGENTS.md text is CC-authored, web-reviewed at the
  rider pause.
- OQ-3: --pole-hairline / --border-emphasis are record-only in the
  contract rider; NOT minted in globals.css.
- OQ-4: yes — docs/design/ZUGZWANG-CD_branding-handoff-decision-record_v1_0.md
  commits alongside the values-log in this PR.
- OQ-5: mint --dur-hover: 0.12s ease;
- OQ-6: --avatar-ring: 1px solid var(--color-n2);
- OQ-7: repo contract v0.2-draft → v0.4; rider changelog carries the
  stranded PK v0.3 entry (marked "PK-side, landed here") + the v0.4
  bridge entry. Rider text is web-authored at the pause.
- OQ-8: --sidebar-* mechanical mirror ratified exactly as tabled.
- Test additions ratified: exact pins for --color-ground, --graph-yes,
  --graph-no, and the --destructive neutralization guard.

*End BRIDGE plan v1 — ratified 2026-07-14. Execution opens in a fresh chat at
sequencing step 2; the plan-file commit (step 1) landed in the plan chat.*
