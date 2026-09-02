# AIMODE-1 — session log

POLISH lane · branch `polish/aimode-1`, cut from `origin/main` `4b98453`.

---

## What landed

The ADR-0025 debate `.md` export control is now labelled **`AI mode`** and
renders as a button-styled pill instead of a grey text link.

| File | Change |
|---|---|
| `src/components/debate/MarketHeader.tsx` | the one render site — label, accessible name, `buttonVariants` styling, Lucide `download` glyph |
| `src/lib/copy/glossary.ts` | `downloadMd` gloss replaced with the ratified string |
| `tests/unit/copy/glossary.test.ts` | length exemption + ratified-text pin (below) |
| `tests/unit/debate/render/market-header.test.tsx` | 3 selectors updated; **5 new guards** for the presentation contract |
| `tests/unit/debate/render/head-zone.test.tsx` | row-9 arm-scoping guard updated |

Commits (all SSH-signed `G`, author `Zugzwang/world`, no `Co-authored-by`, each
carrying the §5.13.1 `Instructions for AI` block):

```
15494e2  feat(debate):     the .md export becomes the AI mode button
faf90c9  refactor(debate): pin lucide's conditional aria-hidden as a vendor contract
16a685f  fix(debate):      correct a docblock that claimed an a11y path it does not have
+ this log, + the reviewer-cascade corrections
```

PR: opened against `main` — number recorded at close.

**Zero** files under `src/server/`, `src/db/`, `drizzle/`, `src/app/`, `public/`
or `docs/specs/`. No migration. The export route, serializer, `zugzwang.md`,
filename and `.md` extension are untouched — verified as *context lines* in the
diff hunk, not changed lines.

---

## Decisions made

**D-1 · The control stays an `<a download>`.** "Rendered as a button" was read
as a claim about appearance, satisfied by `buttonVariants`. An anchor is what
fetches a resource; a `<button>` would re-implement the download in JS and lose
the no-JS / pre-hydration path. ⚠ My first justification for this was **wrong** —
it claimed a `<button>` would introduce "a client boundary in a server
component". `MarketHeader` is already client-side (`DebateView` is
`"use client"` and passes it a function prop). Right answer, wrong mechanism;
corrected in both the component and the test that mirrored it.

**D-2 · Geometry pinned to `LifecycleBadge`, not to `size="xs"`.**
`cn(buttonVariants({variant:"outline", size:"xs"}), "h-5 rounded-4xl")` collapses
to the badge's exact box (`h-5 · gap-1 · rounded-4xl · px-2 · text-xs`, svg
`size-3`). Row height delta **zero** — `size="xs"` alone is `h-6` and would have
grown a `basis-[24.2dvh] overflow-hidden` band whose budget is fully allocated.

**D-3 · The glossary floor was not raised.** The ratified gloss is 89 chars
against `MAX_LEN = 80`. Rather than loosening the floor for ~25 strings to admit
one, a per-key `EXACT_LEN_EXEMPT = { downloadMd: 89 }` pins the budget *exactly*
(not `<=`), plus a `RATIFIED_TEXT` pin on the string itself, plus a test that
makes the exemption expire when it stops being needed.

**D-4 · The stock button fill was left alone.** It resolves
`--btn-fill → --color-ground → #181818`, the same hex as `--color-yes`. Reached
through the **ground** token, as every Button in the product does — overriding it
would break the ratified one-button system (values-log §3 item 3 / R-6) for one
control. No side-pole token appears in the diff, and a guard pins that.

---

## Surprises caught + fixed in-session

1. **A test that could not fail.** The first version passed
   `<Download aria-hidden="true" />`; mutation M5 removed it and everything
   stayed green. Reading `lucide-react@1.14.0` `Icon.mjs:36` showed lucide adds
   the attribute itself — but *conditionally* (`!children && !hasA11yProp`).
   The prop was redundant **and** diverged from the two sibling call sites. It
   was removed and the assertion re-framed as a vendor pin; `M5b` (handing the
   glyph an a11y prop, which revokes the default) now reds.

2. **A docblock claiming an a11y path that does not exist.** It said the gloss
   reaches AT as a description via `aria-describedby`. Measured: while closed,
   that id resolves to **`null`** — Radix mounts Popover content only when open
   while `InfoTip` sets the attribute unconditionally. On touch the description
   is unreachable without activating the control, which starts the download.

3. **Two mutation-harness artifacts that produced false verdicts** — an
   ANSI-defeated `grep` detector reporting GREEN on a genuinely red run, and a
   `perl` mutation that hit my own docblock instead of the JSX. Both switched to
   instruments that cannot lie (exit codes; line-targeted edits).

4. **`git checkout --` ate an uncommitted refinement mid-harness.** The mutation
   harness must run against committed work; the vendor-pin change was committed
   before round two rather than after.

---

## Open questions

**OQ-1 · WCAG 2.4.4 (Level A) — the accessible name names no file.**
`aria-label="AI mode"` was ratified in the kickoff. On the touch branch (the
default for every unknown) nothing else conveys that activating it downloads.
The old label said so outright, so this is a regression, not a pre-existing gap.
Remedy is one line and is a **copy decision, not taken here**: prefix the
ratified name onto a short statement that a Markdown file downloads. Founder's
call.

**OQ-2 · SPEC.1 §21.3 now disagrees with the build.** `docs/specs/SPEC.1.md:1699`
still reads *"Every debate carries a **"download as `.md`"** button, beside the
market question"*. Both halves are now stale — the label, and "beside the market
question" (RESO-1 · R-3 moved it into the attrs row, before this task). **Not
edited: prescriptive docs are web-authored.** An amendment is owed to the spec
lane. §17 pins nothing — swept, zero rows.

**OQ-3 · Action and status now look near-identical at rest.** Matching the badge
exactly means the only rest-state difference between "status readout" and
"button you can press" is the 12px glyph. Landed as specified; surfaced because
this is a public campaign surface.

**OQ-4 · Three out-of-scope SURPRISEs** from the security pass are in
`claude-progress.md` — the export route being the only uncached, unrate-limited
public DB read (**HIGH**, and this PR amplifies it); unescaped participant text
flowing into the file the new gloss tells users to paste into an LLM
(**MEDIUM**); and a `robots.txt` the admin page claims exists but does not
(**LOW**).

---

## Next session starts at

**Founder rulings on OQ-1 (the accessible name) and OQ-2 (the SPEC.1 §21.3
amendment).** Neither is CC's to take. If OQ-1 is granted, the change is one
line in `MarketHeader.tsx` plus the two assertions in `market-header.test.tsx`
and `head-zone.test.tsx` that pin the name.

---

## Context to preserve

- ⚠ **The kickoff's `Open` control does not exist.** `Open` is `LifecycleBadge`
  — a `Badge`, not a Button, not an action. `docs/plans/RESO-1.md:152` records
  the identical misreading as its ambiguity A-1; the DOM text of that row reads
  `OpenDownload .md`, which is what makes two elements look like one.
- ⚠ **`variant="outline"` buys no de-emphasis here.** `default` and `outline`
  are byte-identical in `buttonVariants` (one-button system). The lighter
  treatments are `ghost` and `secondary`.
- ⚠ **PR #420 is CLOSED and unmerged**, and never selected on the old string.
  No `tests/e2e/` or `playwright*` exists on `main`.
- The out-of-scope §21.2 JPEG affordance now lives at `ArgProfile.tsx:278-296`
  (`aria-label="Download post image"`), **not** at `BookmarkToggle.tsx::CardActions`
  — that was unwired at UNWIRE-1. It shares no string and no glossary key with
  the renamed control (`downloadMd` vs `downloadStub`); it does now share the
  Lucide glyph.

---

## Time

Session of 2026-09-03 (IST), ~01:11 → close. Full suite ~185 s per run.
