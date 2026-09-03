# Note bodies owed, written but not applied

Eleven commits on `main` carry no `Instructions for AI` block in their message. The contract that
requires it admits no exemption by type, so each of those is a gap rather than a category — and the
remedy the contract already provides is a **note**: the same block, then the commit's entry, exactly
as every pre-convention commit carries its reasoning. Same words in both places is the whole design,
and a post-convention commit without the block reads identically to a pre-convention one.

This directory holds those eleven note bodies, ready to apply. **It does not apply them.**

## Why they are files and not notes

`refs/notes/commits` is a shared, unlocked ref with **no review surface**. A pushed note is live the
instant it lands; no pull request sees it, no reviewer can catch it, and nothing on the receiving end
distinguishes a considered note from a mistaken one. Every other change this repository makes arrives
through a pull request that somebody reads first. A note push routes around that entirely.

So these were written by a session that was not permitted to push them, in a run whose whole safety
model is that it ends at an open, unmerged pull request. Writing them as files puts them where the
same review that reads the rest of the diff reads them too.

## Applying them

After this pull request is reviewed and merged, for each file here:

```bash
git notes add -F docs/journey/notes-owed/<file> <sha>
```

then, once all of them are attached and read back:

```bash
git push origin refs/notes/commits
```

The filename carries both the position and the short SHA, so no lookup is needed. Read a body before
attaching it — that is the review this mechanism otherwise has none of.

## What is in them

| | |
|---|---|
| Three ordinary authored commits | the block was simply missed |
| Eight merge commits | the contract's text does not discuss merges, and none of the eight carries a block |

Two further commits in the same position — `6ebbfcc` and `44924a7` — already carry notes and are not
here. They were remedied before this run and are the precedent for it.
