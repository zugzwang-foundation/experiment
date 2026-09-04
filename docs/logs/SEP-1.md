# SEP-1 — session log

**Date:** 2026-09-04 · **Branch:** `fix/author-row-separator` · **Base:** `origin/main` = `f435ea2b`
**Plan:** none — a founder-briefed one-shot UI fix (§5.1 trivial-work exemption: one component, three call-site rewires, one test file).

---

## What landed

| file | change |
|---|---|
| `src/components/ui/field-separator.tsx` | **new** — `FieldSeparator`, the author row's `.vsep` pipe as one shared primitive. States its own `text-xs leading-none text-n3`, carries `aria-hidden` and `data-field-separator` |
| `src/components/debate/ArgProfile.tsx` | private `Sep` deleted; the divider **restored before the timestamp**, placed INSIDE group B as its leading element (the wrap decision) |
| `src/components/discovery/HeroPanels.tsx` | private `HeadSeparator` deleted; three call sites rewired |
| `src/components/profile/ArgumentList.tsx` | private `HeadSeparator` deleted; five call sites rewired |
| `tests/unit/debate/render/arg-profile-row.test.tsx` | the `NO-separator-…` assertion **inverted** (superseded reasoning kept in place); reply-row child count 1 → 2; **new** guard that every pipe on the row is the shared primitive, U+007C, `aria-hidden` |
| `AGENTS.md` | `components/ui/` inventory 15 → 16 files, SIX → SEVEN project-authored |

---

## Decisions made

**1 · The divider comes back by PLACEMENT, not by reversal of the reason it went.**
PR #470 removed it because a pipe between group A and group B dangles at the end
of line 1 the moment group B wraps. That was true. Restoring it as a sibling of
group B would reintroduce exactly that. It is restored as group B's FIRST CHILD,
so it travels with the timestamp: on wrap, line 2 reads `| 14d ago  [badge]`.
Founder-ruled and accepted; no measurement, observer or badge-conditional render
was added to hide it.

**2 · Convergence is ONE SHARED ELEMENT, not three matched by eye.** Three private
copies existed and had already drifted in two ways nobody had recorded: only
`ArgProfile`'s carried `aria-hidden` (so Discovery and the profile were reading
their pipes aloud), and each inherited its font-size from whatever row it landed
in — **12px / 9.5px / card-base**. Lifting was already ruled: `ArgumentList`'s own
docblock said "the third occurrence would be the moment to lift it", and this was
the third.

**3 · The primitive states its SIZE, inverting `RelativeTime`'s split.** That leaf
takes size from the caller because the three rows run at three sizes. A separator
is not a field but the seam between fields, and a seam that changes size per
surface is the drift being ended. Consequence, stated because it is a real cost:
Discovery's hero head now renders 12px pipes on a 9.5px row. PD-2-36 records that
row as Discovery's binding horizontal-overflow constraint — measured after: **0px
overflow on both panels**.

**4 · The alignment fix is the pinned font-size, and the reasoning matters more
than the fix.** Under `items-center` a blockified inline's baseline sits
`(ascent − descent) / 2` above its box centre — a quantity that scales with
font-size and is **independent of line-height**. So leading never moved this glyph
and a margin would have cancelled the symptom at one size only. Font-size was the
sole varying input. The glyph stays typeset rather than becoming a drawn 1px rule
for the same reason: the bar is centred on the lowercase band by the typeface, so
it aligns by construction; a box-centred rule ignores font metrics and lands
~0.11em low.

---

## Verification

`tsc --noEmit` clean · `biome check .` exit 0 · **`vitest run` 456 files / 4576
tests, 0 failed** · `next build` exit 0.

Browser measurement at a pinned **1440** against the **compiled production build**
(prod `.next` served from a directory with no `.env.local`, so Doppler `stg`
supplies the staging read models — real markets, real arguments). Suspense
boundaries revealed by hand; `stillHidden === 0`, `fonts.status === "loaded"`,
`fonts.check('12px Geist') === true`, non-zero boxes on every measured element.

Eight rows across the five surfaces — debate post card, reply card, post-focus
header, Discovery hero panel, profile argument row:

| property | value | distinct values |
|---|---|---|
| `color` | `rgb(84, 84, 84)` (`--color-n3`) | **1** |
| `font-size` | `12px` | **1** |
| `font-weight` | `400` | **1** |
| `line-height` | `12px` | **1** |
| `margin-left` / `margin-right` | `0px` / `0px` | **1** |
| border box | `3.17 × 12` px | **1** |
| optical-centre delta vs the age beside it | `−0.552px` (four surfaces) · `−0.612px` (Discovery, whose age is 9.5px) | max `0.61px`, **≤ 1px** |
| baseline delta | `0.000px` · `0.625px` (Discovery) | — |

Optical centre is the **ink** centre: canvas `actualBoundingBox{Ascent,Descent}`
for the rendered face, referred to a baseline computed from the element's own
line box and `fontBoundingBox` metrics. It is not the box centre, which would
have flattered the result.

**Wrap case** — the badged post (`chess-fide-tiebreak-response` ordinal 2,
`01a0519a-11cc-…`, `Contested`), post-focus header:

| viewport | group A | group B | pipe |
|---|---|---|---|
| 1440 | `x 375.7 → 704`, y 95 | y 95 — **does not wrap** | `x 710`, leading group B on line 1 |
| 1200 | `x 375.7 → 704`, y 95 | y **119** — wrapped | `x 375.7`, **first element of line 2**, leading `5d ago  Contested` |

Nothing dangles on line 1 at either width; group A still ends at `Replies · 6`.

---

## Open questions

**OQ-1 · The parent row gap is not converged, deliberately.** The separator's own
margins are `0px` everywhere, but the rows it sits in run `gap-1.5` (6px) on
debate and Discovery and `gap-2` (8px) on the profile. Converging them means
changing a ROW's gap, which moves every field on it — including the three
separators the brief put out of scope. Left as measured and reported.

**OQ-2 · This row still has no guard counting its own pipes.** Both sibling rows
pin their separator count against a governing document; `ArgProfile` does not, so
a composition change here is invisible to CI. The new guard pins that the pipe
leads group B and that every pipe is the shared primitive — not a count against
canon. Minting that count would pin a third composition against canon §3 item 11
and is a decision, not a side effect of this pass.

**OQ-3 · Canon §3 item 11 is no longer owed the amendment PR #470 left it owing.**
#470's report flagged that removing this divider put the code at odds with the
document. Restoring it closes that item rather than amending it. Worth confirming
the docket row is retired rather than left open.

---

## Next session starts at

Nothing pending from this lane. Staging advanced to the merged SHA and gated.

---

## Context to preserve

**Measuring a UI change against real content locally:** `next build` in the repo,
then serve the built `.next` from a copy in a scratch directory that has **no
`.env.local`** (`next start <dir>` is not enough — Next loads `.env.local` from
the process CWD and its values win over inherited env, which is why the first two
attempts kept reading the empty local database). With cwd inside the copy,
`doppler run --config stg` becomes authoritative and the local production build
renders staging's markets. `ZUGZWANG_ENV` is inlined at build time and keeps
reporting `preview` from `/api/health`; `DATABASE_URL` is **not**, which is the
distinction that makes this work.

---

## Time

One session, ~1h including two full suite runs and two production builds.
