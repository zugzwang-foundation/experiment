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

⚠ **The blocks below contain no comments, deliberately.** An interactive `zsh` — the shell this
repository is operated from — does not treat `#` as a comment, so an explanatory line pasted into a
command block becomes an argument, and an apostrophe inside one swallows everything after it. A
block that cannot be pasted forces improvisation, and this is the one procedure in the project
where improvisation lands on a ref no pull request can see. Every explanation is out here, in prose.

**Step 1 — bring the ref up to date and record where it starts.** A plain `git fetch` does not
touch it; the remote's fetch refspec covers heads only. The count should read **343**.

```bash
git fetch origin "+refs/notes/*:refs/notes/*"
git notes list | wc -l
```

**Step 2 — attach the eleven, by name.** The list is written out rather than globbed. A glob is
evaluated against the directory at run time, so a later task that leaves its own bodies here would
have them attached and pushed unread — and the read-back in step 3 could not catch it, because a
file that created a note matches that note by construction. The hash comes from the filename, so
nothing is retyped.

```bash
set -- n365-e5e520c n377-ff1c0f9 n394-f7eba3e n405-d2e99aa n406-8153d62 n407-545c5f8        n408-940cdcb n409-2d40a68 n410-98e203f n411-0366714 n412-b2da687
for b in "$@"; do git notes add -F "docs/journey/notes-owed/$b.txt" "${b##*-}"; done
```

`git notes add` without `-f` refuses where a note already exists. If it refuses, **stop** — that
commit was already answered, and `-f` would overwrite the answer. Go to Recovery.

**Step 3 — read back what you are about to make permanent.** Eleven `OK` lines, no `FAIL`, and a
count of **354**.

```bash
for b in "$@"; do git notes show "${b##*-}" | diff -q "docs/journey/notes-owed/$b.txt" - > /dev/null && echo "OK $b" || echo "FAIL $b"; done
git notes list | wc -l
```

**Step 4 — only if step 3 was eleven `OK`s and 354.** This is the irreversible one, and it is a
separate block so that pasting steps 1–3 cannot run it.

```bash
git push origin refs/notes/commits
```

## Recovery, if the push is rejected

**A rejection is protecting you: the ref moved since you fetched.** Do **not** reach for `--force`
— it is the only copy of the reasoning attached to three hundred and forty-three commits, and it
discards whatever you had not fetched.

Re-running step 1 will not help on its own: that refspec cannot fast-forward a diverged local ref.
Reset the local ref to the remote and start again. **This is safe here and only here**, because
every note you were adding comes from a file in this directory — discarding the local ref loses
nothing that is not on disk.

```bash
git fetch origin "+refs/notes/commits:refs/notes/commits"
git notes list | wc -l
```

Then repeat steps 2, 3 and 4. If the new count is not 343, one or more of the eleven was answered
by somebody else while you were working; read those notes before doing anything further.

## When they are applied, delete them

Applied and unapplied look identical on disk otherwise, and the next person cannot tell. Remove the
eleven files in the same commit that pushes them, so the directory empties itself as it is used.

## What is in them

Three ordinary authored commits where the block was simply missed, and eight merge commits — the
contract's text does not discuss merges, and a squash body is authored in the merge dialog, a second
writing surface with nobody watching it.

Two further commits in the same position — `6ebbfcc` and `44924a7` — already carry notes and are
not here. They were remedied before this run and are the precedent for it.
