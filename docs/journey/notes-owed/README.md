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

## ⚠ Read every body before you attach anything

**That reading is the review this mechanism otherwise has none of.** Each body is byte-identical to
the entry of the same name in [`../08-the-instruments.md`](../08-the-instruments.md), so reviewing
the act reviews these — but read them here too, because here is where they become permanent.

## The eleven, and nothing else

**This list is the work. Do not glob the directory.** A later task that owes its own notes will drop
its files in beside these, and "every file here" would sweep them up and push them unread — which is
the one thing this directory exists to prevent.

| File | Commit | |
|---|---|---|
| `n365-e5e520c.txt` | `e5e520c` | authored commit, block missed |
| `n377-ff1c0f9.txt` | `ff1c0f9` | authored commit, block missed |
| `n394-f7eba3e.txt` | `f7eba3e` | authored commit, block missed |
| `n405-d2e99aa.txt` | `d2e99aa` | merge commit |
| `n406-8153d62.txt` | `8153d62` | merge commit |
| `n407-545c5f8.txt` | `545c5f8` | merge commit |
| `n408-940cdcb.txt` | `940cdcb` | merge commit |
| `n409-2d40a68.txt` | `2d40a68` | merge commit |
| `n410-98e203f.txt` | `98e203f` | merge commit |
| `n411-0366714.txt` | `0366714` | merge commit |
| `n412-b2da687.txt` | `b2da687` | merge commit |

⚠ **Eight of the eleven are merge commits from the same three days, and their short hashes look
alike.** Do not retype them. The filename already carries the commit, so the commands below derive
it — a transposed hash would attach two bodies to the wrong two commits, both would succeed, and
both would be permanent.

## Applying them

**Only after this pull request is reviewed and merged.** Run from the repository root.

```bash
# 1. A plain `git fetch` does NOT update this ref — the remote's fetch refspec covers heads only.
git fetch origin "refs/notes/*:refs/notes/*"

# 2. Attach each body to the commit its own filename names. Nothing is typed twice.
for f in docs/journey/notes-owed/n*.txt; do
  sha="${f##*-}"; sha="${sha%.txt}"
  git notes add -F "$f" "$sha"     # no -f: this REFUSES where a note already exists
done

# 3. Read back what you are about to make permanent, before you make it permanent.
for f in docs/journey/notes-owed/n*.txt; do
  sha="${f##*-}"; sha="${sha%.txt}"
  git notes show "$sha" | diff -u "$f" - && echo "OK   $sha"
done
git notes list | wc -l               # 343 before, 354 after

# 4. Only if every line above said OK and the count reads 354.
git push origin refs/notes/commits    # no --force, ever
```

⛔ **If the push is rejected, it is protecting you.** It means the ref moved since you fetched. Run
step 1 again and redo step 2. **Never `--force` this ref** — it is the only copy of the reasoning
attached to three hundred and forty-three commits, and a forced push silently discards whatever
you had not fetched.

⛔ **If `git notes add` says a note already exists, stop and find out why** rather than reaching for
`-f`. It means that commit was already answered, and `-f` would overwrite the answer.

## When they are applied, delete them

Applied and unapplied look identical on disk otherwise, and the next person cannot tell. Remove the
eleven files in the same commit that pushes them, so the directory empties itself as it is used.

## What is in them

Three ordinary authored commits where the block was simply missed, and eight merge commits — the
contract's text does not discuss merges, and a squash body is authored in the merge dialog, a second
writing surface with nobody watching it.

Two further commits in the same position — `6ebbfcc` and `44924a7` — already carry notes and are
not here. They were remedied before this run and are the precedent for it.
