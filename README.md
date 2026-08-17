# experiment
A new world order to solve democracy by shifting power from money to true knowledge.

New to the codebase? The full backend walkthrough is [`docs/handover/EXTAUDIT-05_HANDOVER-DECK.md`](docs/handover/EXTAUDIT-05_HANDOVER-DECK.md).

Deploy / pipeline topology and the prod-promote path: see [`docs/runbooks/deploy-pipeline.md`](docs/runbooks/deploy-pipeline.md).

## Why a commit exists — reading the git notes

Commits predating the `Instructions for AI` convention (`CLAUDE.md` §5.13.1) keep their reasoning in an attached **git note**, because history here is never rewritten. **A default `git clone` does not fetch notes** — you have to ask for them:

```bash
git fetch origin "refs/notes/*:refs/notes/*"   # re-run to pick up notes added since
git log --notes=commits                        # show them inline in the log
```

The same text, read front to back instead of one commit at a time, is [`docs/journey/README.md`](docs/journey/README.md) — an account of the build in eight acts, one entry per commit.
