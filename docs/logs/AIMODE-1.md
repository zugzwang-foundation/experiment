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

---

# AIMODE-1 · addendum — session log

Same branch `polish/aimode-1`. **PR #466** — the number *What landed* above left as
"recorded at close". Two sessions sit under this heading, both on 2026-09-03: the
**addendum**, which applied the founder's rulings on OQ-1 and OQ-2, and the **final**, which
re-authored one table cell and wrote this section. Everything the section above left for the
next session has been answered.

## What landed — addendum

| Commit | File | Change |
|---|---|---|
| `b089ab0` | `src/components/debate/MarketHeader.tsx` | `aria-label` gains the purpose suffix; the docblock above the anchor rewritten |
| `b089ab0` | `tests/unit/debate/render/market-header.test.tsx` | 3 locators + the M1 literal re-pointed; **the containment/prefix assertion added**; guard renamed |
| `b089ab0` | `tests/unit/debate/render/head-zone.test.tsx` | row-9 arm-scoping guard's full-attribute string; the cross-reference to the renamed guard |
| `e8188ad` | `docs/specs/SPEC.1.md` | §21.3 sentence · §0 → 1.0.49 / 2026-09-03 · one §20 changelog row |
| `HEAD` | `docs/specs/SPEC.1.md` | the 1.0.49 row's **Rationale cell only** — founder text replaces the placeholder |
| `HEAD` | `docs/logs/AIMODE-1.md` | this section |

**OQ-1 · the accessible name now names the file.**

```
- aria-label="AI mode"
+ aria-label="AI mode — download this debate as Markdown"
```

The dash was **measured** as U+2014, not asserted. The **visible** label is untouched — only
the accessible name moved — so no design-canon row and no `GLOSSARY.downloadMd` string
changed, and nothing in the copy register needed a ruling.

**Five assertions were pinned to the new string**: three locators plus the M1 `toBe` pin in
`market-header.test.tsx`, and the full-attribute string at `head-zone.test.tsx:257`. ⚠ The
three locators were updated **in place** rather than re-pointed at `a[href$="/export"]`.
Re-pointing would have decoupled three layout guards from the copy — tidier — and would have
cut the M1 mutation's blast radius from **5 tests to 2**. An uglier guard that still fires
beats a cleaner one that stopped.

**One assertion was added, and it is the point of the ruling** — the *relation*, which
nothing in the repo had ever held:

```ts
expect(accessibleName).toContain(visibleLabel);
expect(accessibleName.startsWith(visibleLabel)).toBe(true);
```

Both `toBe` literals above it can stay valid while the relation breaks: reorder the halves,
or paraphrase the prefix, and the string pins still pass. Only this reddens. That is WCAG
2.5.3 (Label in Name) — the visible words stay a **leading** substring, so a speech-input
user can still say them and match from the first character.

**The docblock had to move with the code — O-5, not tidying.** The `{/* … */}` block above
the anchor stated the superseded position in operative prose: it opened *"THE ACCESSIBLE NAME
IS "AI mode" AND SO NAMES NO FILE"* and closed the OQ with *"⇒ OPEN, founder's call, NOT taken
here"*. Shipping the fix under that would have left the file's most emphatic sentence
contradicting the line forty characters below it. So the correction was written **into** the
block, not appended to it: it now opens on the relation rather than the string, says CLOSED
HERE, and **keeps the measured `aria-describedby` finding unchanged** — that finding is not
history, it is the reason the suffix has to live in the name. The restraint about never
quoting the string in attribute syntax was kept and its *reason replaced*: the old reason
(an unshipped literal is the one a source scan would match) is discharged now that the string
ships; the live reason is the mirror — a second copy in a comment can drift from the JSX
silently, and every guard that owns this claim reads the rendered DOM, so none would see it.
The `TARGET SIZE` paragraph (WCAG 2.5.8, `h-5` = 20px against the 24px floor) is untouched,
being a separate and still-true cost.

⚠ **O-5, not O-4 — a citation corrected here.** The addendum run report cites this as
**O-4** twice (its §2.2 heading and its closing-ritual section), and the final session's
kickoff inherited the number. `CLAUDE.md:320` is *"O-4 · Staging reflects `main`"*;
`CLAUDE.md:322` is *"O-5 · A durable amendment is applied at every site that states the
superseded position … write the correction INTO each operative section."* **O-5 is the rule
that fired.** The mis-citation is the exact class §8 exists to end, so it is corrected in the
repo-side record rather than repeated — and the report in `~/Downloads` is left as staged.

**The measurement, and the thing it reproduced unasked.** A throwaway probe rendered
`MarketHeader` in jsdom, read the anchor and was **deleted in the same shell command that ran
it** (`git status --porcelain` after the run showed only the three intended modifications).

```
aria-labelledby         : null      <- so accname §5.2 step 2B resolves to aria-label
VISIBLE LABEL           : "AI mode"
ACCESSIBLE NAME         : "AI mode — download this debate as Markdown"
STARTS WITH it (prefix) : true      index of visible label: 0
aria-describedby        : "info-tip-rl850u"
aria-describedby TARGET RESOLVES : null      <- the id DANGLES
```

`aria-labelledby` was **asserted null, not assumed** — had it been present, the accessible
name would come from the referenced nodes and the `aria-label` would be ignored, making the
whole measurement one of a string nothing announces.

⚠ **The dangling `aria-describedby` is the best evidence OQ-1 was a real defect, and it
arrived unprompted.** `getElementById("info-tip-rl850u")` returns `null`: Radix's Popover
mounts its content only when open while `InfoTip` sets the attribute unconditionally. The
component docblock had claimed exactly this from a measurement taken the day before in a
different harness, and it held. Before this commit a touch AT user met a two-word name that
named no file, pointing at a description **that was not in the document** — and the only way
to open that description is to activate the control, which starts the download.
⚠ **Scope caveat, stated because the harness is not the platform:** this is jsdom, not a real
assistive technology. What is proven is that the id has no target in the DOM. What an
individual screen reader does with a dangling `aria-describedby` is **not measured here and
is not claimed.**

**OQ-2 · SPEC.1 §21.3 stops describing a button that moved.** Both stale halves went in one
pass — the label, and *"beside the market question"*, which `RESO-1 · R-3` had already
falsified before AIMODE-1 existed. `§0` was **read off the file at HEAD** rather than carried:
Version `1.0.48` → `1.0.49`, Last updated `2026-08-31` → `2026-09-03`. One `§20` row appended.
Three hunks, one file, nothing else moved.

⚠ **§17 was swept before the "nothing moves" claim was allowed to stand, and the sweep needed
care.** A naive search appears to find **25** conformance rows; all 25 are `RANKING.md`
matching on the substring `.md`. Word-bounded and with `RANKING.md` excluded the answer is
**zero** — and an empty grep is silence, not an answer, so it carries a positive control: the
same pattern returns 26 hits elsewhere in the file, proving it finds things. ADR-0025 is
untouched on the same principle — it names the button generically, so nothing in it became
false, and amending a correct document buys only a second thing to keep in step.

**The final session** replaced that row's **Rationale cell** with the founder's supplied text
and changed nothing else in the file — one line, one hunk, Change / Date / Version / Section
/ ADR all untouched. The predecessor had authored a one-line placeholder there and flagged it
as the only text in the amendment it had written itself; this discharges that.

## Decisions made — addendum

**D-1 · The M1 guard's test id was renamed.**
`market-header::AIMODE-label-and-accessible-name-are-both-AI-mode` →
`market-header::AIMODE-visible-label-is-the-PREFIX-of-the-accessible-name`. The old title
asserts the exact opposite of what its own body now asserts — the two strings are deliberately
no longer the same. A test name is a claim, and a false one sitting on top of the assertion
that falsifies it is the failure class §8 exists for. Swept first, found exactly two
references, both moved in the same commit (`market-header.test.tsx:338`, the `it(...)` title;
`head-zone.test.tsx:255`, a comment cross-reference). Zero behaviour change; the old id is
recorded in a comment at the site so the next reader can find it.

**D-2 · `expect(aria-label).not.toContain("Download")` was KEPT, not weakened.** It does not
red — the new name carries `download` in **lower case** and this bans capital-`D` `Download`.
But it now passes *because of case alone*, which was not true before, so the guard has quietly
become case-dependent. It was **not** relaxed: the capital-`D` form is strictly stronger,
still true, and still catches exactly what it was written for — the pre-AIMODE-1 label
returning. What was added is a comment saying the capital `D` is now load-bearing, so the next
person to hit it reads a fact instead of inferring a bug. Surfaced rather than silently
adjusted.

**D-3 · The founder's Rationale text was joined onto one line, and its outer quotation marks
are delimiters rather than content.** SPEC.1 changelog cells are single physical lines — a
newline inside one breaks the table — so the supplied line-wrapping was joined on single
spaces and checked by machine, not by eye: **82 words and 480 characters on both sides,
identical after whitespace normalisation**. The wrapping quotes were read as delimiters and
dropped, on three grounds: **no Rationale cell in this table is quote-wrapped** — measured,
62 data rows, 56 of which carry the column at all (six from June 2026 omit it entirely;
pre-existing, untouched, not this task's to fix) and **zero** of the 56 quoted; the text's own
internal quoting is already marked `*"…"*`, so a second layer would nest; and the supplied
words reproduce this column's house form exactly (*"Operator ruling — Hrishikesh, 2026-08-31
(REGISTER-1). Ground: …"*). Recorded as a decision, not slipped in.

## Open questions — addendum

**OQ-1 and OQ-2 are CLOSED.** Both were founder-ruled and both are applied.

Still open, and none of them touched here — the final kickoff's NOT-DOING list names each:

- **OQ-3** · action and status still look near-identical at rest; the only rest-state
  difference between the badge and the button is the 12px glyph.
- **OQ-4** · the three out-of-scope security SURPRISEs in `claude-progress.md` — the export
  route as the only uncached, unrate-limited public DB read (**HIGH**, amplified by this PR),
  unescaped participant text flowing into the file (**MEDIUM**), and the absent `robots.txt`
  the admin page claims exists (**LOW**).
- **WCAG 2.5.8 target size** · `h-5` is 20px against the 24px AA floor; `size="xs"` alone
  would have been exactly 24px. Named in the component docblock, unchanged, still owed a
  ruling — it is a geometry decision (execute-session D-2), not an accessibility oversight.

## Next session starts at — addendum

**The founder's merge decision on PR #466.** Nothing in AIMODE-1 is owed by CC: both OQs are
closed, the gate is green and CI is green on the head SHA. This session was instructed
explicitly **not to merge**. On merge, the standing **O-4** step applies — `staging` reflects
`main` by mechanism, and staging currency is read off `GET /api/health` → `canary`, never
recalled.

## Context to preserve — addendum

- ⚠ **The docblock-correction rule is O-5, not O-4.** See above; the addendum report and the
  final kickoff both carry the wrong number.
- ⚠ **The capital `D` in `not.toContain("Download")` is load-bearing** (D-2). Lower-casing the
  assertion would silently make it vacuous against the shipped name.
- ⚠ **`aria-describedby` on this anchor dangles whenever the tip is closed.** That is a
  property of `InfoTip` setting the attribute unconditionally against a Radix Popover that
  mounts content only when open — it is **not** specific to this control, and any future
  surface leaning on `InfoTip` for an accessible *description* inherits it.
- The **visible** label never changed at OQ-1, so the design canon's `AI mode` entry and the
  `GLOSSARY.downloadMd` gloss both still describe what ships.
- Two run reports are staged in `~/Downloads` and are the long-form record:
  `zz_AIMODE-1_addendum_2026-09-03T1145.md` and `zz_AIMODE-1_final_2026-09-03T1219.md`.
- ⚠ **The addendum kickoff's `§22` was drift and is worth remembering as a shape.** It said
  *"add a §22 changelog row"*; SPEC.1 §22 is **Discovery**, and the changelog is **§20** — the
  only such table in the file. The likely origin is SPEC.**2**, whose ADR Index *is* at §22.
  Applied where the table exists, surfaced once, not blocked (CLAUDE.md §4; precedence is
  spec > ADR > tracker > kickoff, and the kickoff ranks lowest).

## Time — addendum

Addendum session of 2026-09-03 (IST), ~11:45 → 12:13 (report stamp → last write); commits at
11:53 and 11:58. Final session from ~12:19.

**Gate — addendum, four commands in four separate shells**, exit captured on the line after
each, nothing piped to `tail`:

| Gate | Command | Exit |
|---|---|---|
| typecheck | `pnpm tsc --noEmit` | **0** |
| lint/format | `pnpm biome check .` | **0** |
| build | `ZUGZWANG_ENV=preview pnpm next build` | **0** |
| full suite | `pnpm vitest run` | **0** — 450 files passed / 1 skipped; 4477 passed / 1 skipped / 4 todo; 186.32 s |

⚠ **The four shells are not ceremony:** an exported `ZUGZWANG_ENV` leaks into vitest through a
`??=` in the test env setup and produces phantom failures in files nobody touched, so `next
build` got its value inline and never exported.

⚠ **The test count moved 4476 → 4477 against the execute report and was chased, not waved
past.** The addendum's own net `it()` delta is **zero** — one removed, one added, the M1
rename. The `+1` came from `a254d4c`, which landed after the execute report was written and
before the addendum began. Fully accounted for.

**CI — addendum**, read via `gh run view <id> --json status,conclusion,jobs`, polled to
terminal (`gh pr checks` lags the real run state on this repo):

```
run id     : 33723739095
headSha    : e8188adb238708f44586e514948f81bde22c7392   == local HEAD
status     : completed        conclusion : success       all 18 steps green
```

`headSha` was compared to local `HEAD` **in the same read** — that is CI's verdict on this
tree, not on a predecessor. ⚠ Standing caveat, not a finding: this repository has **no branch
protection on any branch**, so `ci` is not a required check and green is a thing to *check* at
the moment of merging, never a gate to lean on.

The **final** session's own gate and CI verdict cannot live in the commit that creates this
file — they are in `~/Downloads/zz_AIMODE-1_final_2026-09-03T1219.md`, against the head SHA
that commit produces.
