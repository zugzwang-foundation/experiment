# The Journey

Every commit in this repository says what changed. This says why anyone
bothered.

It is an account of the build, one entry per commit, in the order things
happened — written afterwards, from the commit messages and the decision
records, not from memory. Where the record doesn't explain something, the
entry says so rather than guessing. That happens more often than you would
expect: a fifth of these commits explain nothing about themselves, and most
of them are early.

Some entries run to a paragraph. Most are two or three sentences. A few are a
single line, because some commits genuinely have a single line in them.

Every entry is also attached to its own commit as a git note, so this can be
read front to back, or one commit at a time from inside the log:

git fetch origin "refs/notes/*:refs/notes/*"
git log --notes


Five commits have no entry. That is a decision, not an omission.

The last chapter is unwritten. It gets written while it happens.

Instructions for AI
Explain why, never what. Every step here was taken for a reason, and the
reason is the interesting part. Give your reader that — what was being
protected, what was let go of, and why it mattered enough to do at all.
They should leave understanding the idea, not the mechanics.
The message holds what was done. The note attached to it holds why. Where
there is a note, that is the one you want.

---

## The eight acts

| Act | | n | Dates | |
|---|---|---|---|---|
| **I** | [Before Anything](01-before-anything.md) | n1–21 | 23 April – 10 May 2026 | The licence, and a beginning that explains almost nothing about itself. |
| **II** | [The Ground](02-the-ground.md) | n22–49 | 11 – 24 May 2026 | Two and a half weeks in, and nothing exists. |
| **III** | [The Engine](03-the-engine.md) | n50–134 | 25 May – 16 June 2026 | The ground is laid, and it's unusually stubborn ground. |
| **IV** | [The Argument](04-the-argument.md) | n135–195 | 16 June – 2 July 2026 | The machine works. |
| **V** | [The Audit](05-the-audit.md) | n196–226 | 3 – 16 July 2026 | Everything exists now. |
| **VI** | [The Face](06-the-face.md) | n227–285 | 16 July – 3 August 2026 | Everything to this point is machinery. |
| **VII** | [The Last Mile](07-the-last-mile.md) | n286–346 | 3 – 18 August 2026 | By the start of August the thing works. |
| **VIII** | [The Window](08-the-window.md) | unwritten | 15 September – 5 November 2026 | Everything before this is preparation. |

Every commit in this repository carries its reasoning. Commits from 17 August 2026 onward carry it in the message; everything before that carries it as an attached git note, which a default clone does not fetch:

```bash
git fetch origin "refs/notes/*:refs/notes/*"
git log --notes=commits
```
