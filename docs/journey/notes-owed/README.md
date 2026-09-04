# Note bodies — applied, and kept on disk deliberately

> ## ✅ DONE — nothing in this directory is pending
>
> The eleven note bodies here were applied to `refs/notes/commits` and pushed, **attended, on
> 4 September 2026**. The ref moved `56b12a2f` → **`b41ecbf7`** as a fast-forward, **343 → 354
> notes**. Every one of the eleven is live on the shared ref.
>
> **The files were kept on purpose. Their presence is a record, not a queue.** An earlier version
> of this page told you to delete them once applied; that instruction was withdrawn — see
> [Why these files are still here](#why-these-files-are-still-here).
>
> Check it yourself, without needing this page to be honest:
>
> ```bash
> git ls-remote origin "refs/notes/*"
> ```

Eleven commits on `main` carry no `Instructions for AI` block in their message. The contract that
requires it admits no exemption by type, so each of those is a gap rather than a category — and the
remedy the contract already provides is a **note**: the same block, then the commit's entry, exactly
as every pre-convention commit carries its reasoning. Same words in both places is the whole design,
and a post-convention commit without the block reads identically to a pre-convention one.

This directory holds those eleven note bodies. **They have been applied** — see the status block
above and [Why these files are still here](#why-these-files-are-still-here). What follows is the
record of that, and the route for the next commit that needs a note.

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

*This was done for the eleven before they were pushed, and it stands as the rule for the next batch.*

## The eleven, and nothing else

**This list was the work, and it is what the guard now pins. Do not glob the directory.** A later task that owes its own notes will drop
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

## How they were applied — and the route for the next one

**This is the procedure that ran on 4 September 2026, recorded verbatim.** It is kept because it is
the route for the next commit that needs a note, not because anything here is outstanding. The
counts below are the ones this run actually read: 343 before, 354 after.

⚠ **It runs only after the pull request carrying the bodies is reviewed and merged**, and only
attended. Run from the repository root.

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

## Why these files are still here

**They are applied. They are kept anyway, and that is a decision rather than an oversight.**

This section used to say the opposite: *remove the eleven files in the same commit that pushes
them, so the directory empties itself as it is used.* The reasoning was sound — applied and
unapplied look identical on disk, so a later reader cannot tell which they are looking at. **That
problem is real and it is solved here by saying so, at the top of the page, rather than by deleting
the evidence.**

Three reasons the deletion was withdrawn:

1. **The bodies are the only reviewable copy of what went onto a ref nobody can review.** A note on
   `refs/notes/commits` has no pull request, no diff, and no history a reader can walk. These files
   are the artifact that a reviewer actually read, sitting in a tree that keeps them forever. Delete
   them and the sole auditable record of what was pushed is the push itself.
2. **A guard pins them by name.** `tests/unit/docs/journey-notes-owed.test.ts` asserts this
   directory holds exactly these eleven, and separately that each body is byte-identical to its
   entry in the act file. That second property is the one that broke silently once, after three
   reviews had verified it by hand. Deleting the files retires a live guard against a defect this
   project has already committed.
3. **An empty directory is not a clearer signal than a full one that says it is done.** "Empty"
   reads the same as "never populated", and it cannot tell you the ref, the date, or the count.
   The status block at the top of this page can, and it survives being read cold.

**So: a file in this directory does NOT mean work is pending.** It means a note was written,
reviewed, applied, and kept. If a future task leaves its own bodies here, the guard reds until
somebody deliberately adds them to its list — and that pull request is where the pending-versus-
applied distinction gets stated, in this section, for that batch.

## What is in them

Three ordinary authored commits where the block was simply missed, and eight merge commits — the
contract's text does not discuss merges, and a squash body is authored in the merge dialog, a second
writing surface with nobody watching it.

Two further commits in the same position — `6ebbfcc` and `44924a7` — already carry notes and are
not here. They were remedied before this run and are the precedent for it.
