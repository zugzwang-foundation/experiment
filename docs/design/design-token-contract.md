# Zugzwang — Design Token Contract (named slots · branded dark values)

> **Doc:** `docs/design/design-token-contract.md`
> **Status:** v0.4 · authored at DC.1 · names frozen (operator-ratified) · values branded at BRIDGE (2026-07-14, values-log v0_3 §3)
> **Authorship:** web Claude (orchestrator) · ratified by operator · committed by Claude Code
> **Grounding:** `src/app/globals.css` (the built system, SHELL/UI.0 mint PR #161 — **full custom-property census recon-verified verbatim, 2026-07-02**) · `design-language.md` v0.5 §2 (vocabulary) · the brand-handover research (DTCG three-tier shape) · `tests/unit/design/tokens-monochrome.test.ts` (the CI pin, read in full) · ZUGZWANG-BRAND_agenda-and-values-log_v0_3.md §3 (the verbatim CD dump — value authority, committed alongside at BRIDGE)
>
> **What this is.** The frozen list of semantic slot names the entire UI binds to, each holding its branded dark value (landed at BRIDGE, 2026-07-14). The branding swap executed exactly as this contract designed it: values re-filled onto the fixed names in one commit, the CI pin amended in the same commit, zero component edits. After ratification: no rename, no removal; additions only by contract amendment (operator-ratified, version-bumped) — v0.4 is such an amendment (the §3.6 census).
>
> **What this is NOT.** Not the brand package's working files — the CD system was disposable (Path B); the values-log §3 dump is the archived value authority, committed alongside. Not a docs-only change this time: v0.4 rides the bridge code commit (same-commit doctrine — swap + CI pin + this amendment together); `globals.css` remains the built truth this contract records.

---

## §1 — Architecture: three tiers, one direction

Per the brand-handover research (industry-consensus DTCG shape):

```
component tokens  →  semantic tokens  →  primitive tokens
      (§4)               (§3)                (§2)
```

- **Primitives** hold raw values (a grey, a px, a family). Named by scale position, never by use.
- **Semantics** hold intent (side, surface, border, focus ring). They alias primitives.
- **Component tokens** hold per-component knobs. They alias semantics or primitives.
- **References point right only** — a component token never invents a literal; a semantic never skips to a hex that isn't a primitive. *(Known flattening in the built CSS: the shadcn `:root`/`.dark` values are written as literals rather than `var()` chains onto the ramp. Acceptable — the swap edits values at named slots either way. New tokens must use `var()` aliases.)*

**The five blocks of `globals.css`** (the complete custom-property census):

| Block (lines) | Role | In-contract tier |
|---|---|---|
| `@theme inline` (7–48) | **alias plumbing** — maps shadcn vars into Tailwind (`--color-background: var(--background)` …), the derived radius scale, `--font-heading` | plumbing (names recorded §2.4/§3.3; values are pure `var()`/`calc()` derivations) |
| `:root` (50–83) | shadcn semantic ramp — light values | §3.2 |
| `.dark` (85–117) | shadcn semantic ramp — dark values | §3.2 (status: unstyled scaffold, see §3.4) |
| `@theme` (126–147) | **the design-token mint** — n-ramp, side poles, fonts | §2.1 / §2.3 / §3.1 |
| `:root` (155–159) | raw structural props — hairline, image knobs | §3.5 / §4 |

**Enforcement.** `tests/unit/design/tokens-monochrome.test.ts` pins the mint in CI. Exact mechanics (load-bearing for B3 — see §5):
- **Exact-string pins**: `toContain("--token: value;")` for all 11 design tokens — any value or whitespace change breaks it.
- **Chroma census**: a regex asserts **exactly 11** file-wide matches of `--color-(n[0-7]|ink|yes|no)` and chroma `0` on each — minting a new token *matching that name pattern* (e.g. an `n8`) breaks the count; tokens outside the pattern (an accent) are **invisible** to it.
- **Name ban**: `--color-brand` anywhere fails. **The accent must never be named `--color-brand`.**
- **Comment couplings**: the strings `NOT Support (design-language §1.3/§2.1)` (must stay), `do not consume` and `DESIGN.7 back-app…` (must never reappear) are pinned — renumbering design-language §1.3/§2.1, or careless CSS comments, break CI. *(design-language v0.5 preserved the numbering — safe.)*
This test is the *monochrome-era* guard: **at B3 it is amended in the same commit as the value swap** to pin the branded values instead. It is never deleted — it becomes the brand-drift guard.

---

## §2 — Tier 1 · Primitives

### §2.1 Neutral ramp + ground — LANDED (frozen names, branded dark values)

9 true-neutral steps + the page ground, hex-authoritative (BRIDGE swap, `@theme` block), achromatic (R=G=B), running dark → bright — **inverted vs the retired light ramp; never copy values across eras by name or lightness.** The ramp is the working palette; the accent question is closed (§2.2 — reserved-empty, permanent this phase).

| Slot (CSS)     | Contract name         | Value (branded) | Status                                                                                          |
|----------------|-----------------------|-----------------|--------------------------------------------------------------------------------------------------|
| --color-ground | primitive.ground      | #181818         | minted at BRIDGE — page ground; outside the 11-token census (closed alternation); own CI pin      |
| --color-n0     | primitive.neutral.0   | #212121         | branded at BRIDGE (values-log v0_3 §3); names never change                                         |
| --color-n1     | primitive.neutral.1   | #2a2a2a         | 〃                                                                                                 |
| --color-n2     | primitive.neutral.2   | #404040         | 〃                                                                                                 |
| --color-n3     | primitive.neutral.3   | #545454         | 〃                                                                                                 |
| --color-n4     | primitive.neutral.4   | #747474         | 〃                                                                                                 |
| --color-n5     | primitive.neutral.5   | #989898         | 〃                                                                                                 |
| --color-n6     | primitive.neutral.6   | #bdbdbd         | 〃                                                                                                 |
| --color-n7     | primitive.neutral.7   | #e4e4e4         | 〃                                                                                                 |
| --color-ink    | primitive.neutral.ink | #fafafa         | 〃                                                                                                 |

*(Any ramp retune must edit the CI pin's exact-string expectations in the same commit — §1/§5. Any new step must NOT match the `n[0-7]` pattern unless the census count is amended; `--color-ground` deliberately sits outside the pattern, with its own pin. Landed hex is lowercase — Biome normalizes; CSS hex is case-insensitive.)*

### §2.2 Accent family — RESERVED (frozen names, **no values until B1/B3**)

Deliberately absent from the built CSS today. The names are frozen **here** so B3 mints values onto known slots instead of inventing names mid-session. Per the research: one accent + a hover/active tint + an on-accent foreground.

| Slot (CSS, minted at B3) | Contract name | Value | Notes |
|---|---|---|---|
| `--color-accent-500` | `primitive.accent.500` | *(B1 decides · B3 mints)* | the one brand accent |
| `--color-accent-600` | `primitive.accent.600` | *(B1/B3)* | hover/active tint |
| `--color-on-accent` | `primitive.accent.on` | *(B1/B3)* | foreground on accent (WCAG AA vs 500) |

*Constraints: never named `--color-brand` (CI ban, §1). Accent discipline (research → every B-track brief): accent on ≤10% of any screen; never on the side poles. These names sit outside the chroma-census pattern, so the mint itself does not trip the count — the census stays 11.*

**Status (BRIDGE, 2026-07-14): reserved-EMPTY, permanently this phase.** B1 ratified true-neutral; no accent was minted and none will be inside experiment scope. The reservation survives purely as name-space protection (the `--color-brand` CI ban; §5's accent steps are superseded). The dump's `--accent` shadcn slot is a neutral wash (`var(--color-n1)`), not this reserved family.

### §2.3 Typography primitives — names frozen, values ratified FINAL (B1)

| Slot (CSS) | Contract name | Value (current) | Swap status |
|---|---|---|---|
| `--font-sans` | `primitive.font.sans` | `var(--font-geist-sans)` | ratified FINAL at B1 (WI-13): Geist carries the system — no longer a placeholder; Lucide icons ratified FINAL alongside. |
| `--font-mono` | `primitive.font.mono` | `var(--font-geist-mono)` | ratified FINAL at B1 (WI-13): Geist carries the system — no longer a placeholder; Lucide icons ratified FINAL alongside. |

Type **scale/weights** (`type.scale.*`, `type.weight.*`) remain *named-in-vocabulary, unminted-in-CSS* (design-language §2.2) — carried by Tailwind utilities in the built surfaces. Promotion to CSS custom properties = contract amendment (DESIGN.SPEC-era, if ever); until then they are **not** contract slots.

### §2.4 Shape primitives + derived radius scale

| Slot (CSS) | Contract name | Value (current) | Notes |
|---|---|---|---|
| `--radius` | `primitive.radius.base` | `0.625rem` | shadcn base; small-or-zero constraint (§1.9) governs any retune |
| `--radius-sm … --radius-xl` | `primitive.radius.sm…xl` | `calc()` derivations of `--radius` (`@theme inline`) | **derived, not independent** — retuning the base moves the whole scale; never assign literals to the derived slots |

Spacing (`space.*`), elevation, and motion stay vocabulary-only (design-language §2.3) — same amendment rule as type scale.

---

## §3 — Tier 2 · Semantics

### §3.1 Side poles — LOCKED (never rebranded)

The thesis-load-bearing pair. The BRIDGE swap retuned the values for the dark era; the binding is untouched (R-1): YES = black, NO = white — encoding SIDE, never the Support/Counter relation.

| Slot (CSS)  | Contract name     | Value               | Alias intent                          |
|-------------|-------------------|---------------------|---------------------------------------|
| --color-yes | semantic.side.yes | #181818 — black, locked | literal — de-aliased at BRIDGE (WI-1) |
| --color-no  | semantic.side.no  | #fafafa — white, locked | literal — de-aliased at BRIDGE (WI-1) |

De-aliased, deliberately. On the dark ground the yes-value coincides with `--color-ground` and the no-value with `--color-ink` — coincidences of value, not of role. The old alias intent (yes ≡ neutral.ink, no ≡ neutral.0) belonged to the light era; carrying name-aliases across inverted eras is exactly the pole-flip trap the bridge existed to kill, so the poles bind by literal and the CI pins them by exact string.

Considered and rejected as slots (stands): on-side foregrounds. Text-on-side resolves through existing values — on-yes = the light end (ink `#fafafa`), on-no = the dark end (`#181818`) — the era-specific mapping lives in the applied layer; no dedicated slots, so the question stays closed. (The light-era mapping "on-yes = neutral.0, on-no = neutral.ink" is retired with the era.)

### §3.2 shadcn semantic ramp — pinned verbatim (light `:root` · dark `.dark`)

The component-consumed layer. Every value below is the live file, verbatim. **Ramp column**: `= nX/ink` marks an exact match to a §2.1 step; **off-ramp** marks an achromatic grey that is *not* a ramp step (stock shadcn defaults left in place at the mint); **⚠ CHROMATIC** marks the two colour values (dispositions in §3.4).

| Slot (CSS) | Contract name | `:root` (light) | Ramp | `.dark` | Ramp (dark) | B3 behaviour |
|---|---|---|---|---|---|---|
| `--background` | `semantic.surface.base` | `oklch(1 0 0)` | = n0 | `oklch(0.145 0 0)` | = ink | stays neutral |
| `--foreground` | `semantic.text.base` | `oklch(0.145 0 0)` | = ink | `oklch(0.985 0 0)` | off-ramp | stays neutral |
| `--card` | `semantic.surface.card` | `oklch(1 0 0)` | = n0 | `oklch(0.205 0 0)` | = n7 | stays neutral |
| `--card-foreground` | `semantic.text.card` | `oklch(0.145 0 0)` | = ink | `oklch(0.985 0 0)` | off-ramp | stays neutral |
| `--popover` | `semantic.surface.popover` | `oklch(1 0 0)` | = n0 | `oklch(0.205 0 0)` | = n7 | stays neutral |
| `--popover-foreground` | `semantic.text.popover` | `oklch(0.145 0 0)` | = ink | `oklch(0.985 0 0)` | off-ramp | stays neutral |
| `--primary` | `semantic.action.primary` | `oklch(0.205 0 0)` | = n7 | `oklch(0.922 0 0)` | = n2 | **re-aliases → `primitive.accent.500`** |
| `--primary-foreground` | `semantic.action.primary-foreground` | `oklch(0.985 0 0)` | off-ramp | `oklch(0.205 0 0)` | = n7 | **re-aliases → `primitive.accent.on`** |
| `--secondary` | `semantic.action.secondary` | `oklch(0.97 0 0)` | off-ramp (≈n1) | `oklch(0.269 0 0)` | off-ramp | stays neutral |
| `--secondary-foreground` | `semantic.action.secondary-foreground` | `oklch(0.205 0 0)` | = n7 | `oklch(0.985 0 0)` | off-ramp | stays neutral |
| `--muted` | `semantic.surface.muted` | `oklch(0.97 0 0)` | off-ramp (≈n1) | `oklch(0.269 0 0)` | off-ramp | stays neutral |
| `--muted-foreground` | `semantic.text.muted` | `oklch(0.556 0 0)` | = n5 | `oklch(0.708 0 0)` | = n4 | stays neutral |
| `--accent` | `semantic.action.accent` | `oklch(0.97 0 0)` | off-ramp (≈n1) | `oklch(0.269 0 0)` | off-ramp | **re-aliases → accent family** |
| `--accent-foreground` | `semantic.action.accent-foreground` | `oklch(0.205 0 0)` | = n7 | `oklch(0.985 0 0)` | off-ramp | **re-aliases → `primitive.accent.on`** |
| `--destructive` | `semantic.status.destructive` | `oklch(0.577 0.245 27.325)` | **⚠ CHROMATIC (red)** | `oklch(0.704 0.191 22.216)` | **⚠ CHROMATIC (red)** | disposition §3.4 |
| `--border` | `semantic.border.base` | `oklch(0.922 0 0)` | = n2 | `oklch(1 0 0 / 10%)` | alpha-white | stays neutral |
| `--input` | `semantic.border.input` | `oklch(0.922 0 0)` | = n2 | `oklch(1 0 0 / 15%)` | alpha-white | stays neutral |
| `--ring` | `semantic.focus.ring` | `oklch(0.708 0 0)` | = n4 | `oklch(0.556 0 0)` | = n5 | **re-aliases → `primitive.accent.500`** |
| `--chart-1` | `semantic.chart.1` | `oklch(0.87 0 0)` | off-ramp (≈n3) | `oklch(0.87 0 0)` | off-ramp | B-track call (neutral vs tint) |
| `--chart-2` | `semantic.chart.2` | `oklch(0.556 0 0)` | = n5 | `oklch(0.556 0 0)` | = n5 | 〃 |
| `--chart-3` | `semantic.chart.3` | `oklch(0.439 0 0)` | off-ramp | `oklch(0.439 0 0)` | off-ramp | 〃 |
| `--chart-4` | `semantic.chart.4` | `oklch(0.371 0 0)` | = n6 | `oklch(0.371 0 0)` | = n6 | 〃 |
| `--chart-5` | `semantic.chart.5` | `oklch(0.269 0 0)` | off-ramp | `oklch(0.269 0 0)` | off-ramp | 〃 |
| `--sidebar` | `semantic.sidebar.base` | `oklch(0.985 0 0)` | off-ramp | `oklch(0.205 0 0)` | = n7 | stays neutral |
| `--sidebar-foreground` | `semantic.sidebar.foreground` | `oklch(0.145 0 0)` | = ink | `oklch(0.985 0 0)` | off-ramp | stays neutral |
| `--sidebar-primary` | `semantic.sidebar.primary` | `oklch(0.205 0 0)` | = n7 | `oklch(0.488 0.243 264.376)` | **⚠ CHROMATIC (blue)** | disposition §3.4 |
| `--sidebar-primary-foreground` | `semantic.sidebar.primary-foreground` | `oklch(0.985 0 0)` | off-ramp | `oklch(0.985 0 0)` | off-ramp | stays neutral |
| `--sidebar-accent` | `semantic.sidebar.accent` | `oklch(0.97 0 0)` | off-ramp (≈n1) | `oklch(0.269 0 0)` | off-ramp | stays neutral |
| `--sidebar-accent-foreground` | `semantic.sidebar.accent-foreground` | `oklch(0.205 0 0)` | = n7 | `oklch(0.985 0 0)` | off-ramp | stays neutral |
| `--sidebar-border` | `semantic.sidebar.border` | `oklch(0.922 0 0)` | = n2 | `oklch(1 0 0 / 10%)` | alpha-white | stays neutral |
| `--sidebar-ring` | `semantic.sidebar.ring` | `oklch(0.708 0 0)` | = n4 | `oklch(0.556 0 0)` | = n5 | stays neutral |

### §3.3 Semantic type slot

| Slot (CSS) | Contract name | Value (current) | Notes |
|---|---|---|---|
| `--font-heading` | `semantic.type.heading` | `var(--font-sans)` (`@theme inline`) | the display/heading alias — one-sans rule (§1.9) makes it ≡ body today; B1 may re-point it if the brand adopts a second family (a §7 "may revisit" decision, not a default) |

### §3.4 Known off-system values — CLOSED at BRIDGE (2026-07-14)

The three deviations recorded at DC.1 are dispositioned; kept here with their closures so history stays governed:

1. **`--destructive` chromatic red — CLOSED.** Neutralized to `var(--color-n6)` in BOTH blocks (`:root` + `.dark`); the `:root` form is CI-pinned (`--destructive: var(--color-n6);`). The "adopt a status red" option was not taken (true-neutral ratified at B1).
2. **`.dark` `--sidebar-primary` chromatic blue — CLOSED.** Neutralized to `var(--color-n7)` (the sidebar mirror rule, OQ-8). The file is achromatic end-to-end (grep-verified at the bridge).
3. **Off-ramp achromatic greys — CLOSED for `:root`.** The tier-2 re-point replaced the stock literals with `var(--color-*)` chains, so no off-ramp greys remain on the live path. `.dark`'s remaining stock values persist inert under the descope below.

**`.dark` block status — DECIDED (OQ-1, BRIDGE).** The single dark theme lives in `:root`/`@theme`; `.dark` is descoped-inert — physically present (names never removed), never applied (no toggler; `layout.tsx` carries no dark class), its two chromatic strays neutralized. Any future second theme is a new contract amendment, not a `.dark` revival.

### §3.5 Structural semantics (raw custom properties)

| Slot (CSS) | Contract name | Value (current) | Notes |
|---|---|---|---|
| `--hairline` | `semantic.border.hairline` | `1px solid var(--color-n2)` | the separation treatment (design-language §1.9). The 1px is locked; the grey may retune within the neutral ramp only. |

### §3.6 Minted at BRIDGE (v0.4) — applied-semantic · state · elevation · radius · misc

New slots minted by the BRIDGE amendment (values-log v0_3 §3, verbatim; ⑤ raw-props `:root` unless noted). Frozen on landing: no rename, no removal; retunes are values-only under §5.

| Slot                      | Value (landed)                                                                                     | Note                                                                                   |
|---------------------------|-----------------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------|
| --surface-page            | var(--color-ground)                                                                                   | page background alias                                                                  |
| --surface-inset           | var(--color-n1)                                                                                       | inset wells / input grounds                                                            |
| --btn-fill                | var(--color-ground)                                                                                   | button fill on card surfaces                                                           |
| --text-primary            | var(--color-ink)                                                                                      | headline / primary text                                                                |
| --text-body               | var(--color-n6)                                                                                       | body text                                                                              |
| --text-meta               | var(--color-n5)                                                                                       | metadata text                                                                          |
| --text-faint              | var(--color-n4)                                                                                       | faint / near-disabled text                                                             |
| --border-strong           | var(--color-n2)                                                                                       | kept as alias; the old ink-emphasis border treatment is retired                        |
| --overlay                 | rgb(10 10 10 / 0.6)                                                                                   | scrim under modals/popovers                                                            |
| --graph-yes               | #737373                                                                                               | deliberately off-ramp; series-bound grey stand-in for the black pole; CI-pinned        |
| --graph-no                | #fafafa                                                                                               | series-bound; CI-pinned                                                                |
| --state-hover-fill        | var(--color-n1)                                                                                       |                                                                                        |
| --state-pressed-fill      | #333333                                                                                               | minted mid-step between n1 and n2                                                      |
| --state-hover-border      | var(--color-n3)                                                                                       |                                                                                        |
| --state-focus-ring        | 0 0 0 2px rgb(255 255 255 / 0.32)                                                                     |                                                                                        |
| --state-focus-ring-pole   | 0 0 0 2px var(--color-n0), 0 0 0 4px rgb(255 255 255 / 0.32)                                          | on-pole variant                                                                        |
| --state-hover-glow-pole   | 0 0 8px 0 rgb(255 255 255 / 0.22)                                                                     |                                                                                        |
| --state-pressed-glow-pole | 0 0 8px 2px rgb(255 255 255 / 0.34)                                                                   |                                                                                        |
| --state-disabled-opacity  | 0.5                                                                                                   |                                                                                        |
| --elev-0                  | none                                                                                                  |                                                                                        |
| --elev-1                  | inset 0 1px 0 rgb(255 255 255 / 0.04), 0 1px 2px rgb(0 0 0 / 0.4)                                     |                                                                                        |
| --elev-2                  | inset 0 1px 0 rgb(255 255 255 / 0.06), 0 2px 4px rgb(0 0 0 / 0.4), 0 6px 16px rgb(0 0 0 / 0.5)        |                                                                                        |
| --elev-3                  | inset 0 1px 0 rgb(255 255 255 / 0.08), 0 4px 12px rgb(0 0 0 / 0.45), 0 16px 40px rgb(0 0 0 / 0.6)     |                                                                                        |
| --r                       | 8px                                                                                                   | base radius                                                                            |
| --r-chip                  | 4px                                                                                                   | side-chip radius                                                                       |
| --r-dot                   | 3px                                                                                                   | dot radius                                                                             |
| --avatar-ring             | 1px solid var(--color-n2)                                                                             | ≡ dump literal `1px solid #404040` (var-alias form, OQ-6)                              |
| --dur-hover               | 0.12s ease                                                                                            | hover transition (OQ-5)                                                                |

28 slots here + `--color-ground` (§2.1) = the **29 minted at BRIDGE**.

**Retired names (recorded, never minted repo-side):** `--pole-hairline`, `--border-emphasis` — CD-internal compat aliases; zero repo consumers ever (OQ-3). Do not mint. **`--chart-1..5`** are retained (shadcn names-never-removed), re-pointed to ramp aliases; the price graph consumes `--graph-*`, never `--chart-*` — they are not the same system.

**Deliberately not tokenized** (component treatments, values-log §3 items 3/5 — they live in the committed values-log for the build lane): the engaged-slot backlight (`0 0 10px 1px rgba(255,255,255,0.2)`), the Support/Counter pill glows (`0.25`/`0.4`), the black-pill 0.5px hairline exception, the header cluster geometry. Do not mint token forms for these without a contract amendment.

---

## §4 — Tier 3 · Component tokens

Grows additively as surfaces build. Rule: **every new component token aliases a semantic or primitive — never a literal.** Current census:

| Slot (CSS) | Contract name | Value (current) | Notes |
|---|---|---|---|
| `--imgmax` | `component.comment-media.max` | `160px` | tunable; consumed by the debate render (DEBATE.4) |
| `--imgr` | `component.comment-media.radius` | `6px` | **CD-DEFERRED placeholder** per the in-code comment — value open, name frozen |

---

## §5 — The B3 swap runbook (what "pure value-swap" means, exactly)

> **SUPERSEDED IN PART at BRIDGE (2026-07-14):** the steps that mint an accent and re-point `--primary`/`--accent`/`--ring` to it DO NOT APPLY — B1 ratified true-neutral; §2.2 stays reserved-empty. The executed swap shape (values-only onto frozen names + same-commit CI-pin amendment + doc riders, one commit) is the precedent for any future retune.

One commit, zero per-screen edits:

1. **Mint the accent primitives** (§2.2 names — never `--color-brand`, CI ban) with B1's ratified values into the `@theme` design-token block.
2. **Re-point the swap trio**: `--primary`/`--primary-foreground`, `--accent`/`--accent-foreground`, `--ring` from their grey literals to `var(--color-accent-*)` (both `:root` and, per the `.dark` decision, `.dark`).
3. **Disposition the §3.4 deviations**: `--destructive` neutralize-or-ratify; `.dark` blue per the `.dark` call; off-ramp greys optionally snapped to ramp.
4. **Retune (only if B1 requires)** neutral-ramp values and/or `--chart-*` — same names, new values.
5. **Fill the type placeholders**: `--font-sans`/`--font-mono` (and `--font-heading` if a second family is ratified) → the brand family (licensing verified *before* the CD session, per the research's threshold rule).
6. **Amend the CI pin in the same commit** — exact-string expectations for any retuned value; chroma-census count if the token-name pattern set changes; keep the `NOT Support (design-language §1.3/§2.1)` coupling intact; never reintroduce the banned strings. The test survives as the brand-drift guard.
7. **Do not touch**: `--color-yes`, `--color-no`, any slot *name*, `--hairline`'s 1px, the derived radius scale's `calc()` structure, any component markup.

Anything a B1 asset needs that has no slot here → contract amendment first (v0.x bump, operator-ratified), then the CD session.

---

## Appendix — DTCG `tokens.json` skeleton (B3 fills nulls; generated 1:1 from this contract)

```json
{
  "primitive": {
    "neutral": {
      "0":  { "$value": "oklch(1 0 0)",     "$type": "color" },
      "1":  { "$value": "oklch(0.971 0 0)", "$type": "color" },
      "2":  { "$value": "oklch(0.922 0 0)", "$type": "color" },
      "3":  { "$value": "oklch(0.871 0 0)", "$type": "color" },
      "4":  { "$value": "oklch(0.708 0 0)", "$type": "color" },
      "5":  { "$value": "oklch(0.556 0 0)", "$type": "color" },
      "6":  { "$value": "oklch(0.371 0 0)", "$type": "color" },
      "7":  { "$value": "oklch(0.205 0 0)", "$type": "color" },
      "ink":{ "$value": "oklch(0.145 0 0)", "$type": "color" }
    },
    "accent": {
      "500": { "$value": null, "$type": "color" },
      "600": { "$value": null, "$type": "color" },
      "on":  { "$value": null, "$type": "color" }
    },
    "font": {
      "sans": { "$value": "Geist Sans", "$type": "fontFamily" },
      "mono": { "$value": "Geist Mono", "$type": "fontFamily" }
    },
    "radius": { "base": { "$value": "0.625rem", "$type": "dimension" } }
  },
  "semantic": {
    "side": {
      "yes": { "$value": "#181818", "$type": "color", "$description": "LOCKED — never rebranded; literal since BRIDGE (WI-1, §3.1)" },
      "no":  { "$value": "#fafafa", "$type": "color", "$description": "LOCKED — never rebranded; literal since BRIDGE (WI-1, §3.1)" }
    },
    "surface": {
      "base":    { "$value": "{primitive.neutral.0}",   "$type": "color" },
      "card":    { "$value": "{primitive.neutral.0}",   "$type": "color" },
      "popover": { "$value": "{primitive.neutral.0}",   "$type": "color" },
      "muted":   { "$value": "oklch(0.97 0 0)",         "$type": "color", "$description": "off-ramp shadcn grey — §3.4.3" }
    },
    "text": {
      "base":  { "$value": "{primitive.neutral.ink}", "$type": "color" },
      "muted": { "$value": "{primitive.neutral.5}",   "$type": "color" }
    },
    "action": {
      "primary":            { "$value": "{primitive.neutral.7}", "$type": "color", "$description": "B3 → {primitive.accent.500}" },
      "primary-foreground": { "$value": "oklch(0.985 0 0)",      "$type": "color", "$description": "B3 → {primitive.accent.on}" },
      "accent":             { "$value": "oklch(0.97 0 0)",       "$type": "color", "$description": "B3 → accent family" }
    },
    "status": { "destructive": { "$value": "oklch(0.577 0.245 27.325)", "$type": "color", "$description": "⚠ chromatic — §3.4.1 disposition" } },
    "border": {
      "base":     { "$value": "{primitive.neutral.2}", "$type": "color" },
      "input":    { "$value": "{primitive.neutral.2}", "$type": "color" },
      "hairline": { "$value": "1px solid {primitive.neutral.2}", "$type": "border" }
    },
    "focus": { "ring": { "$value": "{primitive.neutral.4}", "$type": "color", "$description": "B3 → {primitive.accent.500}" } },
    "chart": { "$description": "chart.1–5 per §3.2; B-track call on tinting" },
    "sidebar": { "$description": "sidebar.* per §3.2; ⚠ .dark sidebar-primary chromatic — §3.4.2" },
    "type": { "heading": { "$value": "{primitive.font.sans}", "$type": "fontFamily" } }
  },
  "component": {
    "comment-media": {
      "max":    { "$value": "160px", "$type": "dimension" },
      "radius": { "$value": "6px",  "$type": "dimension", "$description": "CD-deferred placeholder" }
    }
  }
}
```

---

> **Changelog.**
> v0.4 (2026-07-14, BRIDGE): the brand value-swap amendment — ramp re-valued to the branded dark system (hex-authoritative, lowercase-normalized by Biome; dark → bright, inverted vs the light era); `--color-ground` minted (§2.1, outside the census, own pin); §3.1 poles de-aliased to literals `#181818`/`#fafafa` (binding unchanged, R-1; alias-intent column retired; on-side foreground mapping restated for the dark era); §3.4 all three deviations CLOSED + `.dark` DECIDED descoped-inert (OQ-1); §3.6 minted-at-BRIDGE census added (29 tokens); retired names recorded (`--pole-hairline`, `--border-emphasis`); §2.2 reserved-empty made permanent-this-phase; §5 accent steps superseded; §2.3 + appendix Geist finalized (WI-13) and `side.*` de-aliased (WI-1). CI pin amended in the same commit (hex census R=G=B, ground/graph/destructive pins). Source: values-log v0_3 §3 + docs/plans/BRIDGE.md, operator-ratified 2026-07-14.
> v0.3 (PK-side, 2026-07-03 — landed here): body-freeze framing for the CI pin + branding-session grounding; existed only as the PK lineage label during the CD sessions, no separate repo landing — its intent is subsumed by v0.4. Recorded so values-log / session-doc references to "v0.3" stay coherent.
> **v0.2-draft (2026-07-02, DC.1):** shadcn layer pinned **verbatim** from `globals.css` (`:root` + `.dark`, every slot, light+dark values, ramp-mapping annotations); full five-block census recorded incl. the `@theme inline` plumbing, `--font-heading`, and the derived radius scale; **§3.4 added** — the three off-system deviations (chromatic `--destructive`, chromatic `.dark --sidebar-primary`, off-ramp shadcn greys) recorded with dispositions, plus the `.dark` open call; §5 runbook rewritten against the CI pin's exact mechanics (exact-string pins, 11-count chroma census, `--color-brand` ban, comment-string couplings); appendix semantic layer filled. Source: CC micro-recon #2 verbatims, 2026-07-02.
> **v0.1-draft (2026-07-02, DC.1):** initial contract — built system recorded (n-ramp, side poles, fonts, radius, hairline, imgmax/imgr), accent family reserved, shadcn names mapped with values ⟂, B3 swap runbook + CI-pin amendment rule, on-side-foreground non-slot decision.

*End token contract v0.4. Names frozen; values branded (BRIDGE, 2026-07-14). Values live under §5; the next amendment bumps the version.*
