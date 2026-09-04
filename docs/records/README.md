# `docs/records/` — what these files are, and how to rebuild them

**Nine records and one index**, replacing — for the purpose of *knowing what exists* — the
**366** documents in `docs/logs/` (236) and `docs/plans/` (130). They replace them for nothing
else: the history is still the history, and the commit log is where it lives.

A session log answers *what happened that night*. These answer *what is true now*, which is the
question an operator has during a live experiment. **Every one can be regenerated**, because
every fact in them comes from code, specs, ADRs or the commit log rather than from prose about
the code. A drifted record is rebuilt, not patched — and that is also what makes it safe to
retire the chat-era close-out corpus afterwards: nothing here depends on it.

## The set

| File | Covers | Lines |
|---|---|--:|
| `../STATE.md` | the index — measured ceilings, what is built, go-live status, open blockers, where the rules live, environments | 150–200 |
| `ENGINE-record.md` | the ENGINE arc — **moved**, not rewritten | — |
| `AUTH-record.md` | sign-in, identity pool, sessions, onboarding, admin auth | 180–250 |
| `DEBATE-record.md` | comments, reply-as-bet, ranking, moderation, removal, the `.md` export | 200–280 |
| `SURFACES-record.md` | every participant screen, the placeholder inventory, removed surfaces | 250–350 |
| `ADMIN-record.md` | Control Centre, market lifecycle, media, moderation, resolution, break-glass | 150–200 |
| `PLATFORM-record.md` | hosting, pooling, caching, limits, observability, deploy, secrets, migrations | 250–350 |
| `SCALE-record.md` | what was measured, what was asserted, and which is which | 150–200 |
| `DATASET-record.md` | the debate export and the public dataset pipeline | 150–200 |

## The six-section shape — identical in all **seven** generated lane records

*(`ENGINE-record.md` is the exception: it was moved, not generated, keeps its own section titles, and is marked do-not-regenerate below.)*

```
# <LANE> — record
**Generated** <date> from origin/main @ <SHA> · **Regenerate** per docs/records/README.md
**Covers** <one line>

## 1 · What this lane is        plain prose, 3–6 sentences; the plain statement before any term of art
## 2 · Feature table            | Feature | Status | Code | Spec | ADR | Proved by | Open |
## 3 · The decisions that shaped it   | Decision | Recorded in | What it changed |  — pointers only
## 4 · Invariants and guards    which invariants, which triggers, which failure posture — each with file:line
## 5 · Work history             | Unit | PR | Merge SHA | Date | What landed |  — from git and gh
## 6 · Known-open               pointers to docs/parked.md rows and ../STATE.md §4 findings
```

`Status ∈ {SHIPPED, PARTIAL, NOT BUILT, REMOVED}` · `Code` is a real path · `Spec` is a section
number · `ADR` is a number or `—` · **`Proved by` is a test path or the word `none`** · `Open`
is a pointer, never restated prose.

⚠ **`none` and `—` are not interchangeable in the `Proved by` column, and the difference is the
point.** `none` means *searched, and there is no coverage*. `—` means *not applicable*. A cell
that takes `—` to avoid saying `none` has hidden a gap behind a dash — which is exactly how five
wrong `none`/`—` cells got into the first draft of this set.

## The four rules

1. **Repository only.** No project-knowledge document, no chat history, no summary. A lane whose
   history exists only outside the repo is **a finding to record**, not a reason to go looking.
2. **No number is copied from prose** — not from a spec's §0, not from `CLAUDE.md`, not from an
   earlier version of one of these files. Measure at the moment of writing; show the command.
   Five consecutive documentation passes have found a copied ceiling stale, including passes
   whose own text carried this rule.
3. **Every negative assertion carries a positive control.** Two live examples from this set:
   `grep -c "server/moderation"` on the admin media route returns **1**, and the hit is the
   comment saying it imports no moderation; `grep -ril egress src/` returns **17 files**, every
   one matching inside **"regression"**.
4. **No hedging.** Either it was measured, or the record says **NOT ESTABLISHED** and names what
   would establish it. A hedge is a fact and a disclaimer in one sentence; the reader keeps
   the fact.

## Regenerating

```bash
git fetch origin && git worktree add ~/code/zugzwang/regen origin/main
cd ~/code/zugzwang/regen && pnpm install --frozen-lockfile && git rev-parse origin/main
```

**Ceilings** (`../STATE.md` §1):

```bash
ls docs/adr/ | sort | tail -3            # read the highest; never count files
ls docs/adr/ | wc -l
grep -m1 '^- \*\*Version:'      docs/specs/SPEC.1.md
grep -m1 '^| \*\*Version\*\* |' docs/specs/SPEC.2.md
grep -m1 '^| \*\*Version\*\* |' docs/specs/cpmm.md
ls drizzle/migrations/*.sql | sort | tail -1
python3 -c "import json;e=json.load(open('drizzle/migrations/meta/_journal.json'))['entries'];print(len(e),e[-1]['tag'])"
awk '/export const EVENT_TYPES = \[/,/\] as const;/' src/server/events/schemas.ts | grep -cE '^\s+"'
find tests -type f \( -name '*.test.ts' -o -name '*.test.tsx' -o -name '*.spec.ts' \) | wc -l
ls tests/invariants/ | wc -l
grep -oE '\*\*O-[0-9]+ ·' CLAUDE.md | sort -u -t- -k2 -n | tail -1
grep -oE '\*\*V-[0-9]+ ·' docs/polish/POLISH-0_data-manifest.md | sort -u -t- -k2 -n | tail -1
grep -oE '\bL-[0-9]+\b'   docs/polish/POLISH-register-ADDITIONS.md | sort -u -t- -k2 -n | tail -1
```

⚠ `V-15` is **deliberately reserved**, and `V-22` appears only inside a sentence saying a row
does **not** take it. A bare token-list grep reports both backwards — read the output in full.

**Environments** (`../STATE.md` §3/§6, `PLATFORM-record.md` §2):

```bash
curl -s https://staging.zugzwangworld.com/api/health
curl -s https://zugzwangworld.com/api/health
doppler run --project zugzwang-experiment --config stg -- pnpm db:check-drift
doppler run --project zugzwang-experiment --config prd -- pnpm db:check-drift
doppler secrets --project zugzwang-experiment --config stg --only-names   # NAMES ONLY
doppler run --config stg --command 'psql "$DATABASE_URL" -X -A -F"|" -q \
  -c "SELECT count(*), count(*) FILTER (WHERE assigned_at IS NULL) FROM identity_pool;" \
  -c "SELECT count(*) FROM users;"    -c "SELECT count(*) FROM markets;" \
  -c "SELECT count(*) FROM comments;" -c "SELECT count(*) FROM bets;"'
```

⛔ **Never print a secret value** — these files are published the moment a PR opens.
⛔ **Never write to a database.** Every statement is a `SELECT`.

**Work history** (every §5):

```bash
gh pr list --state merged --limit 600 --json number,title,mergedAt,headRefName,mergeCommit \
  --jq '.[] | "\(.number)\t\(.mergedAt[0:10])\t\(.mergeCommit.oid[0:7])\t\(.headRefName)\t\(.title)"'
gh pr list --state open --json number,title,headRefName,baseRefName,statusCheckRollup
```

⚠ **`--limit 100` silently truncates.** There are 449 merged PRs; the default returns the cap
and looks complete.

**Per-lane sources**

| Record | Read |
|---|---|
| `AUTH` | `src/server/{auth,identity-pool,onboarding}/**` · `src/app/(auth)/**` · `src/db/schema/auth.ts` · `docs/specs/flows/F-AUTH-*` · ADRs 0004 0010 0011 0016 0033 0037 0043 |
| `DEBATE` | `src/server/{comments,moderation,debate-view,debate-export}/**` · `src/lib/ranking*` · `src/app/api/bets/place/route.ts` · `docs/specs/RANKING.md` · flows `F-COMMENT-*` `F-DEBATE-*` `F-MOD-*` · ADRs 0014 0017 0020 0021 0025 0028 0034 0039 |
| `SURFACES` | `src/app/(public)/**` · `src/components/**` · SPEC.1 §21–§23 · `docs/design/*` · ADRs 0023 0032 0037 0040 0041 0042 0045 |
| `ADMIN` | `src/app/(admin)/**` · `src/server/{admin,resolution,markets}/**` · flows `F-ADMIN-1..5` · ADRs 0010 0021 0026 0027 · `docs/runbooks/BREAK_GLASS.md` |
| `PLATFORM` | `src/app/api/health/route.ts` · `src/server/{upstash,idempotency,middleware,storage,observability,health}/**` · `src/db/index.ts` · `scripts/{migrate-*,check-migration-drift}.ts` · `next.config.ts` · `vercel.json` · `.github/workflows/*` · `docs/runbooks/*` |
| `SCALE` | `tests/scale/**` · `tests/staging/**` · `tests/unit/staging/**` · `docs/plans/S-*` · `docs/logs/{S-*,S4-*}` · ADRs 0035 0036 0038 0043 0044 · open PRs |
| `DATASET` | `src/server/debate-export/**` · `src/app/(public)/m/[slug]/export/route.ts` · `public/zugzwang.md` · `docs/specs/debate-export.md` · `docs/runbooks/dataset-release.md` · ADR-0025 · PR #435 |

**`ENGINE-record.md` — do not regenerate.** It is the ENGINE arc's own record, moved here with
only its self-referencing path line changed. Rebuilding it would be rewriting it.

## What these records are not

Not a summary of any ADR, not a restatement of any register (`V-`/`O-`/`L-space`,
`docs/parked.md`) or of the design contract (`docs/design/design-{canon,language,token-contract}.md`),
not prescriptive, and **not a place to fix anything** — a record that finds an error records it
in `../STATE.md` §4. Fixing it silently makes the record disagree with the document it
describes, and the next reader cannot tell which is wrong.

## Keeping them honest

Regenerate on a SYNC sweep, a phase transition, a promote, or the moment a reader finds a wrong
number. **A record whose numbers have gone stale is not a degraded record — it is a document
that will be trusted while being false**, which is the failure mode the set was built to end.
