# FEED-2 — session log

**Direct-execute lane, 2026-08-24.** Supersedes FEED-1's confirmation surface.

---

## What landed

**PR [#401](https://github.com/zugzwang-foundation/experiment/pull/401), merged into `staging`
as `1fc741bd6ce6f5281c0ad89cb40c99aa356074c9`.** Branch `feat/feed-2`, one commit `8d311c0`,
signed. Base `2134e0e` (the #400 squash). CI run `32761509553`, `conclusion=success`.

**853 insertions, 1928 deletions.**

| File | Change |
|---|---|
| `src/components/debate/composer/PostedConfirmation.tsx` | deleted |
| `src/components/debate/composer/ComposerSlot.tsx` | restored to its pre-FEED-1 revision — blob hash identical to `06d4178` |
| `src/components/debate/DebateView.tsx` | restored to `b5e6e63` + 123 lines of jump logic; +134/−0 against `06d4178` |
| `src/components/debate/scrollers.tsx` | `focusId` prop on both scrollers; one-shot absolute jump inside `usePagedColumn` |
| `src/components/debate/composer/BetComposer.tsx` | `+props.onClose()`, `−aria-busy` — two executable lines |
| `src/components/debate/composer/copy.ts` | `POSTED_COPY` removed |
| `tests/unit/debate/render/posted-jump.test.tsx` | new, 10 guards |
| `tests/unit/debate/render/posted-confirmation.test.tsx` | deleted, 21 guards dispositioned individually |

Zero files under `src/server/`, `src/db/`, `drizzle/`.

## Decisions made

1. **The jump side is read off the comment, not off the surface** — `sideAtPostTime` for a post,
   `reply.side` for a reply. A composer always opens `opposite()` something, so "the composer's
   column" is the wrong pole in both arms.
2. **The scroller resolves the position from the id**, against the array it already pages.
   `DebateView` computes no index and reads no ordering.
3. **The hold reuses the existing pick** (`pickSide`). No new state, no timer, nothing to
   dismiss, and it does not suspend the poll. Released by the reader's ordinary actions.
4. **Both the jump and the pick are one-shot keyed on the comment id, never the index** — an
   index-keyed guard re-fires when ranking moves the card.
5. **`ComposerSlot` and `DebateView` were restored from their pre-FEED-1 revisions** rather than
   hand-unpicked, so no residue can survive.
6. **Silence is the fallback.** A masked or absent post produces no jump and no message.

## Open questions

1. **The reused pick carries canon §5's column lift.** Existing chrome for an existing state
   which now has one more way to be entered. Founder call; not taken.
2. **No ADR** for the `model !== posted.fromModel` refresh-landed handshake, which survives from
   FEED-1. Still unrouted.
3. `feat/feed-1`'s `fd05bdc` never reached `staging`; verified moot — every construct it
   corrected was deleted by FEED-2.

## Next session starts at

**A browser pass on `staging` (`1fc741b`).** Two items no test in this repo can reach: a
**reply** landing on the reply's own side rather than its composer's column, and the **hold
releasing** on a click elsewhere. Both are jsdom-only today.

## Context to preserve

- **No reviewer cascade ran on FEED-2.** Direct-execute lane; `@code-reviewer`,
  `@security-auditor` and `@test-writer` were not invoked. Every production line is unreviewed
  by anyone but the executing session. FEED-1's cascade does not carry over — it reviewed a
  design this branch deletes.
- **The budget is 2 `router.refresh()` per successful bet**, measured before and after, and
  pinned by `posted-refresh-budget.test.tsx`. Both now fire at the success, as they did
  pre-FEED-1.
- **`findPostedNode`'s fail-closed `removed === false` narrowing survives and matters more**,
  not less: a comment masked between submit and refresh must not be jumped to. All 10 of its
  tests are untouched.
- **The `docs/parked.md` row** for the pop-up / lightbox re-masking gap survived the merge. It
  is the only durable record — its other copy is in gitignored `claude-progress.md`.

## Time

Recon → delete → build → 6 revert-verified guards → PR → Gate C, in one session.
Baseline suite at `2134e0e`: 3579 / 392 files / EXIT 0. FEED-2: 3563 / 392 files / EXIT 0.
