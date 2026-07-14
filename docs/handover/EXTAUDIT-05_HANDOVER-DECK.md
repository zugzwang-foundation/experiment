# EXTAUDIT-05 — Backend Handover Deck

**Audience:** the two-person external review team holding the EXTAUDIT package
(`EXTAUDIT-00_START-HERE.md` · `EXTAUDIT-01_CHARTER.md` · `EXTAUDIT-02_OPERATING-MANUAL.md` ·
`EXTAUDIT-03_MATH-BODY.md` · `EXTAUDIT-04_DEBATE-BODY.md` + `EXTAUDIT_BRIEFING.html`).
**Prepared:** 2026-07-14, by the repo's own build harness (Claude Code lane), operator-relayed.
**Repo:** [zugzwang-foundation/experiment](https://github.com/zugzwang-foundation/experiment) — AGPL-3.0-or-later.

| Pin | Value |
|---|---|
| **PIN_SHA** | [`31d8965`](https://github.com/zugzwang-foundation/experiment/commit/31d8965fbc2585b58c0e3736bdc01f255d3cdc25) — `origin/main` HEAD at authoring, the #219 squash (2026-07-07) |
| Commit census | **218 first-parent commits** = root `4f4d746` + 217 squash-merged PRs (#1–#219; #58 and #146 closed unmerged; census identical to the ratified plan — zero strays) |
| Doc canon at pin | SPEC.1 **1.0.14** · SPEC.2 **1.0.17** · cpmm.md **2.0.0** · RANKING.md **v1.0.0-draft** · 29 ADR files (0001 + 0003–0031) |
| Volatile sections | C1 and C7 carry their own **as-of stamps**; everything else is stable at PIN_SHA |

## How to read this deck

> **TL;DR for the room:** Part A is the map — read it first and you can navigate the repo
> unaided. Part B is the chronicle — all 218 commits that exist, each exactly once,
> product-tied, with deep dives where the thesis lives. Part C is the ops manual — how the
> thing deploys, tests, and fails. This deck **complements** the EXTAUDIT package you already
> hold: it explains and sequences; the charter and stratum bodies own the verification
> methodology. Where the two meet, this deck cross-references (`EXTAUDIT-01 §3`) rather than
> duplicates.

Three parts:

- **Part A — The system map.** Thesis, stack, architecture, the four hard-locked
  invariants, the repo file map, and the reading conventions the repo itself enforces.
- **Part B — The build chronicle.** Fourteen chapters in phase order. The ledger contract:
  **every one of the 218 first-parent commits on `main` appears exactly once in Part B**, as
  a ledger line. Deep-dive blocks sit at load-bearing commits only.
- **Part C — Operating it.** Environments (live-probed, not narrated from docs), topology,
  CI/CD, crons and runbooks, the test estate, security posture, and forward state.

Ledger-line grammar (machine-verified by `scripts/verify-handover-links.sh`):

```
- [`short`](…/commit/<full-sha>) · [#N](…/pull/N) — squash subject — product tie
```

Every referenced commit carries both hyperlinks — the commit SHA and the PR. Squash-merge
discipline makes these 1:1 (§A6). SHAs and PR numbers in ledger lines are script-extracted
from `git log --first-parent`, never hand-typed. Code excerpts are ≤25 lines each and cite
`path:line` at PIN_SHA; they are illustrative, never full files.

One honesty rule, stated once: where the built system and a spec sentence disagree, this
deck describes **what is on disk at PIN_SHA** and names the drift — the same convention the
repo's own AGENTS.md follows. Known doc-drift items the audience should not re-discover as
findings are collected in the chapters that own them (A4, B13, C6) and cross-referenced to
EXTAUDIT-01 §6.

## Part A — The system map

> **TL;DR for the room:** A prediction market where the stake is reputation, not money, and
> you cannot bet without arguing. Web2 only, one Postgres, event-sourced, four invariants
> hard-locked at the storage layer. The whole backend is built and internally audited; what
> remains before launch is UI, tuning, and the gated prod promote.

### A1 — Thesis and the product loop

The Zugzwang Experiment is a **Reputation Market** — a platform for debate over contested
questions where participants stake reputation rather than capital (SPEC.1 §1). The wager,
verbatim from the spec:

> "Zugzwang's wager is that this combination — reputation as the staked unit, argument as a
> precondition for staking, an immutable record as the substrate — produces a price signal
> in which the informed-and-staking population dominates noise, capital, and inertia."
> — SPEC.1 §1

Every debate has the same shape (SPEC.1 §4): a **Ruling Party** commits to one side of a
binary question and stakes reputation; an **Opposition** stakes the other; an **Audience**
reads and may cross into either side. The mechanism is a CPMM prediction market
(constant-product, fee-less, single market-maker — lifted from Manifold with attribution);
the staked unit is **Dharma**, a soulbound `NUMERIC(38,18)` reputation balance that can
never move user-to-user.

The product loop, end to end:

1. **Signup** — Google OAuth or email OTP; a pseudonym + PFP is consumed FIFO from a
   pre-generated `identity_pool` (`RedFox001`-style; permanent, never user-chosen).
2. **Initial grant** — a one-time Dharma grant at first ToS acceptance (`I-GRANT-ONCE-001`).
3. **Daily Credit** — a flat per-UTC-day allowance, paid lazily **inside the first
   commented bet of the day**, use-or-lose (ADR-0018; `I-DAILY-ONCE-001`).
4. **Bet + comment, atomically** — no bet without a comment, no comment without a bet
   (INV-1). A top-level bet is a *post*; a reply **is itself a bet** on the replier's side —
   Support if it matches the parent's frozen side, Counter if it opposes (ADR-0017;
   depth capped at 1).
5. **The price moves** — the CPMM pool re-prices on every buy/sell; slippage is shown
   pre-confirm; a user holds at most one side per market (single-side rule) and must exit
   fully to switch.
6. **Comments are side-bound** — each comment freezes its author's side at post time
   (INV-3); if the author later flips or exits, the debate view shows a **Flipped/Exited**
   marker instead of rewriting history.
7. **Resolution** — the admin resolves YES/NO (or voids); payouts are pro-rata against the
   final pool; every settlement is an append-only `resolution_events` + `payout_events`
   chain — corrections are *new rows*, never updates (INV-4).
8. **Conclusion freeze** — at 2026-11-05 23:59 UTC the system freezes
   (`system_state.frozen_at`, a one-shot NULL→timestamp transition); the public dataset is
   dated 2026-11-06 and is the **only** place the thesis metric K_eff(t) is ever derived.
   There is deliberately no in-product K_eff dashboard.

Boundary facts the audience should hold: the experiment window is **15 Sep – 5 Nov 2026**,
concluding at Devcon 8, Mumbai (Nov 6–8). Scope is **pure web2** — no chain, no contracts,
no tokens; the transferable instrument (**Artha**) belongs to a future testnet repo and is
named here only so nobody reaches for it. Admin (the operator) is the market-maker and
moderator but **cannot participate**: there is no admin `users` row, so no position, bet,
or comment can structurally exist for the admin (SPEC.1 §2 "Admin / MM").

### A2 — The stack, and why each piece

Live versions at PIN_SHA (from `package.json` / AGENTS.md §1):

| Layer | Choice (pinned version) | Why — decision record |
|---|---|---|
| Runtime | Node 24 (`mise.toml`, `.nvmrc`) | current LTS; Vercel default |
| Framework | Next.js `16.2.4`, App Router, React `19.2.4`, TypeScript strict | ADR-0003 — server components by default; one deploy target |
| Database | Postgres 17 on Supabase (ap-south-1, session pooler) | ADR-0005 — one relational store, event-sourced; ADR-0006 — Mumbai single-region |
| ORM | Drizzle ORM `0.45` + `drizzle-kit 0.30` + `drizzle-zod 0.7` | ADR-0008 — typed SQL without a query DSL wall; schemas derive zod validators |
| Auth | Better Auth `1.6.11` (Google OAuth + email-OTP via Resend + Turnstile) | ADR-0004 — vendor auth, custom identity assignment; admin auth is a separate hand-rolled path (ADR-0010) |
| Money math | decimal.js `10.6.0` (literal pin), precision 50 | cpmm.md §10 — exact decimal arithmetic; **no JS floats anywhere near balances** |
| Storage | Cloudflare R2 via `@aws-sdk/client-s3` + presigner | ADR-0006 — three bucket arms: participant uploads, PFPs, market media |
| Cache / limits | Upstash Redis (`@upstash/ratelimit 2.0.8`) | ADR-0015 — rate-limit + idempotency window + moderation reservation |
| Moderation | OpenAI omni-moderation (`openai 6.39`) | ADR-0014 — pre-commit gate, outside the DB transaction, fail-closed |
| Email | Resend `6.12` | OTP + transactional |
| Observability | Sentry `10.53` + PostHog | ADR-0007 — two-vendor, no Axiom |
| Validation | zod `3.25` everywhere at trust boundaries | AGENTS.md §5 — no naked form data into the DB |
| Tests | Vitest `3` + fast-check `4.8.0` | §C5 — property suites over the CPMM and ledger |
| Tooling | pnpm `10.33.2`, Biome `2.4.13`, Lefthook, `just`, tsx | one-command gates (`just verify`) |

Dependency discipline: new vendor deps land as **literal patch pins** (`"X.Y.Z"`, never
caret) — the AWS-SDK convention applied repo-wide.

### A3 — Architecture: the event-sourced spine and the write wrappers

**Event sourcing (ADR-0005).** Every state change appends to `events`, projected into read
models, idempotent by `event_id`, replayable. The `events` table is hand-partitioned
(`PARTITION BY RANGE (created_at)`) in raw SQL and deliberately excluded from drizzle-kit
(`tablesFilter: ["!events"]`) — the DDL in `drizzle/migrations/0002_events_partitioning.sql`
is the storage truth (excerpted in B6). `events.event_type` is `text`, not a pgEnum; the
closed set lives in the TS const `EVENT_TYPES` with a compile-guarded Zod payload schema per
type. **At PIN_SHA the const holds 24 values** (`src/server/events/schemas.ts:54-89`):
4 `image_upload.*` + 5 `user.*` + 2 `admin.*` + 7 `market.*` + 2 `bet.*` + 1 `comment.*` +
2 `dharma.*` + 1 `moderation.*`. (That figure is counted live at the pin; one internal doc
still says 23 — known drift, flagged for the next descriptive sweep.)

**The write wrappers.** All multi-write user actions run inside `db.transaction(...)`;
the three hot paths get named wrappers with a shared retry spine:

- **W-1 — bets** (`src/server/bets/transaction.ts`): one SERIALIZABLE transaction, pool row
  locked `SELECT … FOR NO KEY UPDATE`, full-jitter retry on SQLSTATE `40001`/`40P01`
  (ADR-0013). The entire bet spine — comment, bet, ledger, position, events, receipt —
  commits or rolls back as one (INV-1).
- **W-3 — resolution** (`src/server/resolution/transaction.ts`): the settle/correct/void
  trio, same retry spine, feeding append-only `resolution_events` + `payout_events`.
- **W-4 — market lifecycle** (`src/server/markets/transaction.ts`): create/open/close +
  the close-due sweep, admin-actor-guarded.

**Append-only buckets.** Storage-layer immutability is bucketed (SPEC.2 §6):

| Bucket | Contract | Tables |
|---|---|---|
| **A** — fully append-only | UPDATE, DELETE and TRUNCATE all rejected by triggers | 10: `events`, `dharma_ledger`, `bets`, `comments`, `resolution_events`, `payout_events`, `mod_actions`, `admin_events`, `user_events`, `bet_receipts` |
| **B** — one whitelisted transition | a single one-shot `NULL→value` column flip permitted; everything else rejected | 3: `identity_pool` (claim), `image_uploads` (`terminal_state`+`terminal_at` together), `system_state` (`frozen_at`) |
| **C** — mutable | ordinary rows | `positions` (net holdings), `market_media` (admin-owned, no `user_id`) |

The trigger SQL (`0003_append_only_triggers.sql`, extended by `0021`/`0022` for
statement-level TRUNCATE, ADR-0030) is the ground truth; handler-layer checks are advisory.

**Failure postures (memorize these three):** rate-limiting fails **open** (an Upstash
outage never blocks a bet); idempotency fails **closed** (an unverifiable replay is a 503,
never a double-spend); moderation fails **closed** on terminal errors (an unverifiable
comment never posts) — ADR-0014/0015, hardened by the audit campaign (B13).

**The money rule.** Every balance, price, share and stake is `NUMERIC(38,18)` in Postgres
and a `CpmmDecimal` (decimal.js clone, precision 50) in TypeScript — serialized as 18-dp
strings at module boundaries with per-quantity-class rounding direction. JS `number` never
touches money.

### A4 — The four hard-locked invariants (and the one deliberate gap)

These are the product's non-negotiables (SPEC.1 §5; CLAUDE.md §2). They map 1:1 onto the
"attack targets" your charter names in EXTAUDIT-01 §3.

| ID | Rule | Enforcement | Canonical test |
|---|---|---|---|
| **INV-1** | Bet ↔ comment atomicity — no bet without a comment, no comment without a bet | one SERIALIZABLE W-1 tx wraps both inserts; `bets.comment_id NOT NULL` (schema half) | `tests/invariants/I-ATOMICITY-001.bet-comment-atomic.spec.ts` |
| **INV-2** | Dharma non-transferable; no overdraft | **no transfer table exists, by design**; every ledger row is single-user; `CHECK (balance_after >= 0)` | `I-NO-OVERDRAFT-001` |
| **INV-3** | Comment side frozen at post time | `comments.side_at_post_time` immutable post-INSERT (Bucket A); flips surface as read-time markers, never rewrites | `I-SIDE-BIND-001` |
| **INV-4** | Resolutions append-only | `resolution_events` + `payout_events` Bucket A; corrections are new rows chained by `corrects_event_id` | `I-APPEND-ONLY-001` |

Six further invariant-class spec rules ride the same test convention: `I-DAILY-ONCE-001`
(one daily credit per UTC day), `I-GRANT-ONCE-001` (one initial grant ever),
`I-NO-OVERSELL-001` (position quantity never negative), `I-RESOLVE-ONCE-001` (a market
terminates exactly once — partial unique index backstop), `I-SINGLE-SIDE-001` (one held
side per user per market), `I-IDEM-ONCE-001` (one committed bet/sell per idempotency key —
durable `bet_receipts` backstop, ADR-0031).

The storage-layer teeth, verbatim from the migration that installs them
(`drizzle/migrations/0003_append_only_triggers.sql:21-27`):

```sql
CREATE OR REPLACE FUNCTION enforce_bucket_a_no_update()
RETURNS TRIGGER AS $$
BEGIN
	RAISE EXCEPTION 'append-only violation on table %.%: UPDATE not permitted',
		TG_TABLE_SCHEMA, TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;
```

…attached `BEFORE UPDATE` / `BEFORE DELETE` to every Bucket-A table (plus `BEFORE TRUNCATE
… FOR EACH STATEMENT` guards from migrations `0021`/`0022`). Thirteen per-table trigger
spec files under `tests/db/triggers/` assert the rejection from the database's own mouth.

**The one deliberate spec↔schema gap — do not file it as a bug.** `comments.bet_id` EXISTS
and is **nullable by design**; the populated FK direction is `bets.comment_id NOT NULL`.
The pair is circular (`comments` ↔ `bets`); the comment row must be inserted before its bet
exists, and Bucket-A append-only forbids back-filling the comment afterwards. INV-1 is
therefore enforced by `bets.comment_id NOT NULL` + W-1 atomicity — not by `comments.bet_id`,
and there is **no pending NOT-NULL migration** (ADR-0017 reconciliation; DEBATE.8). Your
charter's known-state list (EXTAUDIT-01 §6) carries the same warning.

**Refusal surfaces** — asks the build harness is contracted to refuse, because each would
break the experiment's integrity (CLAUDE.md §3): any user↔user Dharma transfer endpoint;
any comment-free bet or bet-free comment; any admin participation path (no `role` column,
no `is_admin` — admin auth is a structurally separate table); invented market content
(questions and resolution criteria are operator-authored); any live K_eff surface; any
conclusion-freeze bypass; any external HTTP inside a DB transaction.

### A5 — The repo, mapped

```
experiment/
├── src/app/            # Next.js App Router
│   ├── (admin)/admin/  # admin login + market/moderation pages (cookie Path=/admin)
│   ├── (auth)/         # sign-in, sign-in/otp, onboarding
│   ├── (public)/       # participant shell + m/[slug] (+ /m/[slug]/export)
│   └── api/            # route handlers (below)
├── src/components/ui/  # shadcn primitives
├── src/db/             # drizzle client + schema (12 files, path alias @/db)
├── src/lib/            # errors, ranking, utils, posthog
├── src/server/         # 22 business-logic domains (server-only)
├── drizzle/migrations/ # 24 files, 0000–0023 — append-only, never edited
├── tests/              # dedicated tree: unit · server · integration · invariants · db · scale
├── docs/               # adr (29) · specs · logs (117) · plans · runbooks (5) · sync · parked.md
├── scripts/            # tsx operational scripts (seed, migrate-staging, smoke)
└── .github/workflows/  # ci.yml · env-audit.yml · staging-migrate.yml
```

The 22 `src/server/` domains: `admin`, `auth` (+ `auth/admin`), `bets`, `comments`,
`config`, `cpmm`, `debate-export`, `debate-view`, `dharma`, `events`, `health`,
`idempotency`, `identity-pool`, `markets`, `middleware`, `moderation`, `observability`,
`positions`, `resolution`, `storage`, `system`, `upstash`.

Schema: **22 drizzle-declared tables** across 10 domain files (plus `_enums.ts` and the
`index.ts` barrel); the SPEC.2 §5.1 inventory counts **24** — the extra two
(`watermark_state`, `cron_alarms`) are pg_cron-migration-only tables with no drizzle
declaration. `events` is declared for type inference but excluded from drizzle-kit.
The full inventory, with bucket classifications (A4):

| Table (schema file) | Bucket | Purpose |
|---|---|---|
| `events` (events.ts) | A | event-source spine; hand-partitioned BY RANGE |
| `resolution_events` (events.ts) | A | settlement chain — resolve/void/correct rows |
| `payout_events` (events.ts) | A | per-user payout legs |
| `bets` (bets.ts) | A | stakes; `comment_id NOT NULL` (INV-1 half) |
| `positions` (bets.ts) | **C** | mutable net holding per (user, market) |
| `bet_receipts` (bets.ts) | A | durable idempotency receipts (ADR-0031) |
| `comments` (comments.ts) | A | arguments; `side_at_post_time` frozen (INV-3) |
| `dharma_ledger` (dharma.ts) | A | reputation ledger; `CHECK(balance_after>=0)` (INV-2); `seq` total order |
| `mod_actions` (audit.ts) | A | moderation audit; `actor_id` is text, not a users FK |
| `admin_events` / `user_events` (audit.ts) | A | admin / participant action audit |
| `markets` (markets.ts) | — | binary question + lifecycle status |
| `pools` (markets.ts) | — | 1:1 CPMM reserves (UNIQUE FK to market) |
| `market_media` (markets.ts) | C | admin media pool — deliberately no `user_id` (ADR-0026) |
| `identity_pool` (identity.ts) | B | pseudonym+PFP bank; one-shot claim |
| `image_uploads` (image-uploads.ts) | B | upload lifecycle; one-shot terminal transition |
| `system_state` (system.ts) | B | singleton; `frozen_at` one-shot (the freeze) |
| `users` (auth.ts) | — | Better Auth participant — **no `role`, no `is_admin`** |
| `sessions` / `accounts` / `verifications` (auth.ts) | — | Better Auth infrastructure |
| `admin_sessions` (auth.ts) | — | admin identity — separate table, **no users FK** |

HTTP surface (participant routes under `/api/`, admin routes under `/admin/` — the admin
session cookie is scoped `Path=/admin`, so an admin handler under `/api/admin/` would never
see it; this is a load-bearing routing rule):

| Route | Method | Purpose |
|---|---|---|
| `/api/bets/place` | POST | comment-bearing bet (post or reply): validate → moderate (outside tx) → W-1 |
| `/api/bets/sell` | POST | sell a position back to the pool |
| `/api/auth/[...all]` | GET/POST | Better Auth catch-all |
| `/api/uploads/sign` | POST | participant R2 presign (write-once arming) |
| `/api/health` | GET | env + canary SHA + db + per-hash migration drift (§C1) |
| `/api/cron/close-due-markets` | GET | Open→Closed sweep past deadline (every minute) |
| `/api/cron/alarms-drain` | GET | pg_cron alarm queue drain (every 5 min) |
| `/api/cron/r2-orphan-sweep` | GET | reap uncommitted uploads (6-hourly) |
| `/admin/markets/media/sign` | POST | admin market-media presign (ADR-0027) |
| `/m/[slug]/export` | GET | read-only debate `.md` export (ADR-0025) |

Admin *mutations* are Server Actions, not route handlers: the market lifecycle lives in
`src/server/admin/markets/{create,close,correct,resolve,void,seed}.ts`.

Test estate at PIN_SHA: **220 `.ts` files under `tests/`, of which 207 are runnable
`*.test.ts`/`*.spec.ts`** (the rest are fixtures, `_setup`, harness and arbitraries) —
tiered in §C5.

### A6 — How to read this repo (conventions that explain the history)

- **Source-of-truth precedence:** SPEC.1/SPEC.2/ADRs are canonical; the external tracker is
  planning-only; on conflict the spec wins and the drift gets noted, not blocked on.
- **Squash ritual:** every PR squash-merges to exactly one commit on `main` — so *1 PR = 1
  first-parent commit*, and the **canonical SHA for any landed work is the squash SHA on
  `main`** (branch SHAs are ephemeral). This is why Part B's ledger can be a clean 1:1
  enumeration.
- **Plan → execute → log cadence:** critical work lands as a ratified plan commit, an
  execute commit, and a session-log commit (`docs/logs/`, 117 files at the pin — the
  forensic trail). The ledger's many `plan`/`log session` lines are that discipline, not
  noise.
- **Same-commit doctrine:** an architectural change and its ADR land in the same commit;
  spec amendments ride the code PR that motivates them (grep any migration PR for its
  paired SPEC.2 §5 edit).
- **ADR census:** 29 files on disk = 0001 + 0003–0031. 0002 was never authored; 0012 is
  in-flight with no file. Substance for the early range lives in SPEC.2 §0.1 change-log
  entries — the files were backfilled at the SYNC arc (B4).
- **Chronology convention (read before questioning the order):** chapters are
  phase-grouped and near-chronological *across* the deck, and strictly main-order *within*
  a chapter; the two lanes that interleaved with their neighbours on `main` — FIX-AUTH and
  SHELL/UI — are told as their own chapters (B8, B9) with a merge-order footnote, so a
  reader following `git log --first-parent` will find history regrouped, never reordered.

## Part B — The build chronicle: how to read it

> **TL;DR for the room:** 218 commits, 14 chapters, nothing missing and nothing twice —
> a verifier script enforces that claim. Deep dives sit where the thesis lives: the market
> engine (B6), the debate/moderation layer (B7), and the deploy arc (B10). Everything else
> is a fast, product-tied ledger.

The chronicle partitions the full first-parent history at PIN_SHA — root `4f4d746` plus
217 squash PRs — into fourteen phase chapters. The partition is exact by construction and
machine-checked two ways (`scripts/verify-handover-links.sh` check 3): every SHA in
`git log --first-parent` appears in exactly one ledger line, and every ledger line's SHA is
on `main`.

| Ch | Phase | Commits | Weight |
|---|---|---|---|
| B1 | Bootstrap & foundation (root + FOUND) | 18 | touch |
| B2 | The specification lane (SPEC + PRECURSOR) | 7 | touch |
| B3 | Scaffold: the platform substrate | 35 | touch + 4 mini-dives |
| B4 | Sync & cold-review interludes | 8 | touch |
| B5 | Design backbone | 4 | ledger-only (out of scope) |
| B6 | **The market engine** | 64 | **deep** |
| B7 | **The debate & moderation layer** | 21 | **deep** |
| B8 | Auth hardening (FIX-AUTH) | 3 | medium |
| B9 | Participant shell (SHELL/UI) | 3 | ledger-only (out of scope) |
| B10 | **The deploy arc** | 17 | **deep** |
| B11 | Export & media | 8 | medium |
| B12 | Descriptive-canon reconciliation (BC) | 7 | touch |
| B13 | The internal audit campaign | 20 | touch + 5 dives |
| B14 | Deploy-proof & sweep close-out | 3 | touch |

Two commits are interleaves absorbed into their surrounding chapter: #101 (the harness
moves to a new model, mid-ENGINE → B6) and #178 (the post-deploy model-contract reconcile
→ B10). Frontend, design-system and branding work is **out of scope for this review** —
B5 and B9 carry ledger lines only, so the census stays complete without pulling you into
surfaces you are not auditing.

## B1 — Bootstrap & foundation (18 commits)

> **TL;DR for the room:** Day zero to a governed repo: license (AGPL-3.0-or-later),
> conduct/security policy, the Next.js 16 scaffold, and — most consequentially — the
> CLAUDE.md/AGENTS.md operating contract that makes the remaining 200 commits follow one
> discipline.

The foundation phase establishes the two things everything else leans on: the **legal
frame** (AGPL-3.0-or-later, chosen in ADR-0001 specifically to foreclose closed-source
forks of the experiment) and the **operating contract** — CLAUDE.md (the *what cannot
bend*: invariants, refusal triggers) + AGENTS.md (the *how*: stack patterns), born at #11
and already being tightened by #17. The forensic-log discipline that lets this deck cite a
session log for nearly every stratum starts at #2, before any product code exists.

### Ledger — 18 commits

- [`4f4d746`](https://github.com/zugzwang-foundation/experiment/commit/4f4d746581d17fe2f724c0f304f4600df88eecd0) — Initial commit — day zero — the empty repository the whole chronicle builds on *(pre-PR-flow root; no PR)*
- [`d78e320`](https://github.com/zugzwang-foundation/experiment/commit/d78e320b898303ab3a00cabc4b64e0035e41e6b4) · [#1](https://github.com/zugzwang-foundation/experiment/pull/1) — chore: add editor config for experiment repo — editor baseline so every later diff is format-stable
- [`9d3ce25`](https://github.com/zugzwang-foundation/experiment/commit/9d3ce25304d9b33804fe5b8d30f7cf024dae7029) · [#2](https://github.com/zugzwang-foundation/experiment/pull/2) — docs(log): add Chat 0 / Pre-cursor D foundation bootstrap log — the forensic-log discipline starts before the code does
- [`507f9bb`](https://github.com/zugzwang-foundation/experiment/commit/507f9bb4a78be67fd3a14bfe5e64a52526bb015f) · [#3](https://github.com/zugzwang-foundation/experiment/pull/3) — docs(log): add Chat 0 and Chat 1 migration logs — bootstrap/migration logs — Chat 0/1 provenance
- [`1a9ad3e`](https://github.com/zugzwang-foundation/experiment/commit/1a9ad3e5e85db0aef5c2fb9859f1d380b60573a3) · [#4](https://github.com/zugzwang-foundation/experiment/pull/4) — FOUND.2: Next.js 16 scaffold + toolchain + verification — the app substrate: Next.js 16 + toolchain the product runs on
- [`6a04ec3`](https://github.com/zugzwang-foundation/experiment/commit/6a04ec32616da0d40cb41edd5470c0b229544f1d) · [#5](https://github.com/zugzwang-foundation/experiment/pull/5) — docs(log): close FOUND.2 — Next.js scaffold + toolchain (#4) — FOUND.2 close log
- [`00bcef4`](https://github.com/zugzwang-foundation/experiment/commit/00bcef4a59de26135f92a75e19a4098b4a78b9d6) · [#6](https://github.com/zugzwang-foundation/experiment/pull/6) — FOUND.3: add project header to AGPL-3.0 LICENSE — AGPL-3.0 header — the license that forecloses closed forks (ADR-0001)
- [`6327bc9`](https://github.com/zugzwang-foundation/experiment/commit/6327bc9a69b89b83aa363a9b483cb1d5c7a28c0b) · [#7](https://github.com/zugzwang-foundation/experiment/pull/7) — FOUND.3: add Contributor Covenant 2.1 Code of Conduct — community conduct baseline
- [`3dc7468`](https://github.com/zugzwang-foundation/experiment/commit/3dc746861f9615a56eadd3dc9657a2c53276a2c0) · [#8](https://github.com/zugzwang-foundation/experiment/pull/8) — FOUND.3: add security disclosure policy — responsible-disclosure channel for the security surface
- [`704473f`](https://github.com/zugzwang-foundation/experiment/commit/704473fd1650cd92a7877411f4d63727ff56c2aa) · [#9](https://github.com/zugzwang-foundation/experiment/pull/9) — FOUND.2: backfill task log — FOUND.2 backfill log
- [`8c87b79`](https://github.com/zugzwang-foundation/experiment/commit/8c87b7919eec971df01e75b100cef6650f15f001) · [#10](https://github.com/zugzwang-foundation/experiment/pull/10) — FOUND.3: log task closeout — FOUND.3 close log
- [`15b0fdb`](https://github.com/zugzwang-foundation/experiment/commit/15b0fdbb47bbb9d92c68dbf21e62aff30680a1a4) · [#11](https://github.com/zugzwang-foundation/experiment/pull/11) — feat(found.4): land CLAUDE.md, AGENTS.md, workflow, maintenance, plan template — birth of the operating contract (CLAUDE.md/AGENTS.md) that governs every later commit
- [`66400a0`](https://github.com/zugzwang-foundation/experiment/commit/66400a0551e5726bd033647afb5ecb2feabb3cb6) · [#12](https://github.com/zugzwang-foundation/experiment/pull/12) — docs(log): close FOUND.4 with task log entry — FOUND.4 close log
- [`0f35ce8`](https://github.com/zugzwang-foundation/experiment/commit/0f35ce8dee44ffa048268a287777656390f7d926) · [#13](https://github.com/zugzwang-foundation/experiment/pull/13) — docs(references): add Manifold reference index for FOUND.5 — Manifold attribution index — the CPMM's licensed lineage
- [`dc5f6f1`](https://github.com/zugzwang-foundation/experiment/commit/dc5f6f1d95b10b37ebc1a47b765bcd8d8179bdcb) · [#14](https://github.com/zugzwang-foundation/experiment/pull/14) — chore(logs): add FOUND.5 task log — FOUND.5 close log
- [`ef2edc7`](https://github.com/zugzwang-foundation/experiment/commit/ef2edc742f2f154aa66ac2a17beaa7eb5e336847) · [#15](https://github.com/zugzwang-foundation/experiment/pull/15) — docs(adr): add ADR-0001 license choice (AGPL-3.0-or-later) — ADR-0001 — license decision recorded as the first ADR
- [`2630855`](https://github.com/zugzwang-foundation/experiment/commit/263085555d5b9b5c70d68a861749ba9a6e37159b) · [#16](https://github.com/zugzwang-foundation/experiment/pull/16) — Chore/found 6 closing — FOUND.6 close
- [`9f99e21`](https://github.com/zugzwang-foundation/experiment/commit/9f99e21f50be45a5791256f90b2e4d034649a1e8) · [#17](https://github.com/zugzwang-foundation/experiment/pull/17) — docs(CLAUDE.md): trim to coding-contract scope; remove product-strategy dilution — contract trimmed to coding scope — strategy lives in specs, not CLAUDE.md

## B2 — The specification lane (7 commits)

> **TL;DR for the room:** The product canon (SPEC.1) and technical canon (SPEC.2) are
> born, iterated, and then **locked to v1.0** at PRECURSOR.4 — from that point on, spec
> changes ride code PRs as same-commit amendments, which is why you can trust the specs to
> describe the built system.

SPEC.1 arrives as a v1.0-draft at #18 and matures through PRECURSOR.5 (#19, which also
introduces SPEC.2). The load-bearing commit is the **spec lock**:

**#63 — the PRECURSOR.4 spec lock.** SPEC.1 and SPEC.2 are promoted to v1.0 together.
After this commit the specs stop being aspirational documents and become the review
baseline: every schema table traces to the SPEC.2 §5 inventory, every flow to a SPEC.1 §F
identifier, and drift becomes a bug with a named owner (the BC arc, B12, exists to pay
that debt down). The lock is also what makes the invariant tests meaningful — INV-1..4 are
spec citations, not aspirations. #65 immediately exercises the new regime: a patch record
reconciling ADR-0017 after friendly-fire removal, in-place, without re-litigating the
decision.

### Ledger — 7 commits

- [`16d0eea`](https://github.com/zugzwang-foundation/experiment/commit/16d0eea682f9dba3e57eb2f7425e3c71256f98a1) · [#18](https://github.com/zugzwang-foundation/experiment/pull/18) — docs(spec): SPEC.1 v1.0-draft (2026-05-03) — SPEC.1 v1.0-draft — the product canon is born
- [`46c58fe`](https://github.com/zugzwang-foundation/experiment/commit/46c58fefdd221c49cfcf42ee06e6e155a3d777ee) · [#19](https://github.com/zugzwang-foundation/experiment/pull/19) — docs: PRECURSOR.5 — refresh CLAUDE.md + AGENTS.md, ship SPEC.1 v1.8.0 + SPEC.2 v0.3-draft — PRECURSOR.5 — SPEC.1 1.8.0 + SPEC.2 v0.3-draft: the technical canon appears
- [`5685a16`](https://github.com/zugzwang-foundation/experiment/commit/5685a168f414c661ca2a758b11d8f27ffe324924) · [#20](https://github.com/zugzwang-foundation/experiment/pull/20) — Delete docs/specs/SPEC.1.pdf — canon is markdown — the stray PDF leaves
- [`e0ef868`](https://github.com/zugzwang-foundation/experiment/commit/e0ef868f3aa21f322e59531a8d299e23229d2af6) · [#32](https://github.com/zugzwang-foundation/experiment/pull/32) — chore(precursor-5): doc + tooling sweep — PRECURSOR.5 doc + tooling sweep
- [`e381d1f`](https://github.com/zugzwang-foundation/experiment/commit/e381d1feb8df87246996ec3d12c2dca3a318733f) · [#63](https://github.com/zugzwang-foundation/experiment/pull/63) — docs(spec): promote SPEC.1 + SPEC.2 to v1.0 (PRECURSOR.4 lock) — PRECURSOR.4 — the spec lock: SPEC.1 + SPEC.2 promoted to v1.0
- [`d622044`](https://github.com/zugzwang-foundation/experiment/commit/d6220449a8a7b9276bc46fe928efc096a4a812e8) · [#64](https://github.com/zugzwang-foundation/experiment/pull/64) — docs(log): PRECURSOR.4 spec-lock-review close-out — PRECURSOR.4 close log
- [`b135d0d`](https://github.com/zugzwang-foundation/experiment/commit/b135d0d3d00e47bfe2f61ffcae63abc734de8fe7) · [#65](https://github.com/zugzwang-foundation/experiment/pull/65) — docs(adr): ADR-0017 P1 patch record — friendly-fire removal reconciliation (PRECURSOR.4) — ADR-0017 P1 patch record — friendly-fire removal reconciled

## B3 — Scaffold: the platform substrate (35 commits)

> **TL;DR for the room:** Everything the engine will later assume: the 21-table schema
> with append-only triggers, auth with a structurally separate admin path, Upstash
> rate-limit/idempotency, R2 storage, the identity pool, observability, CI with a real
> Postgres, and a staging environment. The four mini-dives below are the four substrates
> the audit campaign later stress-tested hardest.

SCAFFOLD.2 (#21–#31) is the schema arc: 3.A plumbing, 3.B the 21-table schema across 10
domains, 3.C the hand-written SQL (events partitioning + the append-only triggers A4
excerpts), 3.D the 51 trigger test cases proving the storage layer rejects
UPDATE/DELETE — INV-4 enforced before any business logic exists to violate it.

**#38 — auth wiring (SCAFFOLD.3).** Six Better Auth flows (Google OAuth, email OTP,
sign-out, ToS, onboarding, session), the session-deferral hook that delays session creation
until onboarding completes, and the **two-layer admin middleware** — the admin path is a
separate login/validate pair with its own cookie, not a role on `users`. The
structural-separation invariant (A4) is born here as architecture, not policy. Auth's
long tail (the FIX-AUTH chapter, B8) traces back to what this commit could not know about
vendor internals.

**#47 — R2 storage substrate (SCAFFOLD.15).** Presigned-URL uploads
(`/api/uploads/sign`), scoped per user, with the orphan-sweep cron reaping uploads that
never reach a committed comment. The write-once arming pattern established here is what
AUDIT-FIX-A1 (#197) later tightens into byte-identity binding (ADR-0028) — the moderated
bytes are provably the served bytes.

**#50 — the identity pool (SCAFFOLD.17).** Pseudonym + PFP tuples pre-generated and
FIFO-consumed at signup (Bucket B: a one-shot claim transition), with a pg_cron
low-watermark alarm. This is the product's anonymity guarantee: participants get
`RedFox001`, never a chosen handle, so arguments carry reputation weight only.

**#54 — CI grows teeth (SCAFFOLD.18).** The PR gate gains a real `postgres:17` service and
applies every migration on every run — with `cron.schedule()` statements stripped (the CI
substrate has no pg_cron; the strip step survives to this day, §C3). From here on, a
migration that cannot replay from zero fails CI, which is what keeps 24 migrations
replayable at PIN_SHA.

### Ledger — 35 commits

- [`c36c7fe`](https://github.com/zugzwang-foundation/experiment/commit/c36c7fe96c9d2e7765852680e2344d4a8a15e96b) · [#21](https://github.com/zugzwang-foundation/experiment/pull/21) — docs(plans): add SCAFFOLD.2 execution plan — SCAFFOLD.2 plan gate
- [`97d3cdb`](https://github.com/zugzwang-foundation/experiment/commit/97d3cdb75902bcaf3a1c2082c7e77c88b8fb57d4) · [#22](https://github.com/zugzwang-foundation/experiment/pull/22) — feat(scaffold-2): a — drizzle + supabase + flow skeletons — 3.A — drizzle + supabase plumbing and flow skeletons
- [`7f8198d`](https://github.com/zugzwang-foundation/experiment/commit/7f8198d048c8df04989fea1b2ec4c3a24423a35f) · [#23](https://github.com/zugzwang-foundation/experiment/pull/23) — chore(claude-md): rewrite with plan mode, /clear, per-session logs, handoff ritual — workflow contract rewrite: plan mode, /clear, per-session logs
- [`1ced8c2`](https://github.com/zugzwang-foundation/experiment/commit/1ced8c2ad056b8a4366b657987364914a1e0f601) · [#24](https://github.com/zugzwang-foundation/experiment/pull/24) — chore(scaffold-2): log session — 3.A merged — 3.A session log
- [`e6a136a`](https://github.com/zugzwang-foundation/experiment/commit/e6a136a83920aeec20e7b65fa06fb06ea15dd3bc) · [#25](https://github.com/zugzwang-foundation/experiment/pull/25) — feat(scaffold-2): b — drizzle schemas (21 tables, 10 domains, 11 files) — 3.B — the schema is born: 21 tables across 10 domains
- [`304681b`](https://github.com/zugzwang-foundation/experiment/commit/304681b0812d86a1f70aba7ae811fff43091a435) · [#26](https://github.com/zugzwang-foundation/experiment/pull/26) — chore(claude-md): replace post-PR soak with pre-PR self-audit + subagent invocation policy — pre-PR self-audit + subagent review enter the contract
- [`6079452`](https://github.com/zugzwang-foundation/experiment/commit/6079452aa1dca69a08ccc32d7f4c04b59919a5d2) · [#27](https://github.com/zugzwang-foundation/experiment/pull/27) — chore(scaffold-2): log session — stratum 3.B complete — 3.B session log
- [`7552d15`](https://github.com/zugzwang-foundation/experiment/commit/7552d15eaa4da68744301a9fb6205fd2436d5e8b) · [#28](https://github.com/zugzwang-foundation/experiment/pull/28) — feat/scaffold 2 stratum c — 3.C — hand-written SQL: events PARTITION BY RANGE + append-only triggers
- [`e443260`](https://github.com/zugzwang-foundation/experiment/commit/e443260d7737c9c63753d7d54c159e5e8144795a) · [#29](https://github.com/zugzwang-foundation/experiment/pull/29) — docs(logs): SCAFFOLD.2-3C session log — 3.C session log
- [`b4fc1d7`](https://github.com/zugzwang-foundation/experiment/commit/b4fc1d79ffe83e764c922e480e1925ea0f722ab4) · [#30](https://github.com/zugzwang-foundation/experiment/pull/30) — feat(scaffold-2): d — trigger tests (14 files, 51 cases) + INV-4 — 3.D — 51 trigger cases prove the storage layer rejects UPDATE/DELETE (INV-4)
- [`04f5324`](https://github.com/zugzwang-foundation/experiment/commit/04f53249c7fb5b0e249894537427f934d577f4ab) · [#31](https://github.com/zugzwang-foundation/experiment/pull/31) — chore(scaffold-2): e — close-out + log — 3.E close-out
- [`e9e1378`](https://github.com/zugzwang-foundation/experiment/commit/e9e1378db39118bddafee1762b1a6c101238773d) · [#33](https://github.com/zugzwang-foundation/experiment/pull/33) — feat(scaffold-1): Tailwind v4 + shadcn/ui + Turbopack plumbing — SCAFFOLD.1 — Tailwind v4 + shadcn, the styling substrate
- [`61157a9`](https://github.com/zugzwang-foundation/experiment/commit/61157a9360e8df540b9be3a4b71b677638a6ad3f) · [#34](https://github.com/zugzwang-foundation/experiment/pull/34) — chore(scaffold-1): log session — SCAFFOLD.1 close — SCAFFOLD.1 close log
- [`774aad4`](https://github.com/zugzwang-foundation/experiment/commit/774aad411a4389af5e3d58eb7d14e5e8ea6d8eeb) · [#35](https://github.com/zugzwang-foundation/experiment/pull/35) — feat(scaffold-14): auth vendor env wiring (9 keys) — SCAFFOLD.14 — auth vendor env wiring (9 keys)
- [`c7936e1`](https://github.com/zugzwang-foundation/experiment/commit/c7936e1e5cb30612bdf3f77c2bc0c4ef9b120630) · [#36](https://github.com/zugzwang-foundation/experiment/pull/36) — chore(scaffold-14): log session — SCAFFOLD.14 close — SCAFFOLD.14 close log
- [`825e18b`](https://github.com/zugzwang-foundation/experiment/commit/825e18b3e21b493e3dc789c7e1c77d0573891901) · [#37](https://github.com/zugzwang-foundation/experiment/pull/37) — feat(scaffold-4): Upstash Redis substrate (rate-limit middleware + idempotency cache) — SCAFFOLD.4 — Upstash substrate: rate-limit middleware + idempotency cache
- [`62cd299`](https://github.com/zugzwang-foundation/experiment/commit/62cd29913e33fe13555c5fe101ad5da52203dd8b) · [#38](https://github.com/zugzwang-foundation/experiment/pull/38) — feat(scaffold-3): auth wiring — 6 flows + session-deferral hook + admin two-layer middleware + dev-seed — SCAFFOLD.3 — auth wiring: 6 flows, session-deferral hook, admin two-layer middleware
- [`82bee48`](https://github.com/zugzwang-foundation/experiment/commit/82bee481ee36867e8662d3fd16dfa84fef580db8) · [#39](https://github.com/zugzwang-foundation/experiment/pull/39) — chore(tracker): v8 → v9 sweep — SCAFFOLD.3 close + 13 MAINT rows + SCAFFOLD.13 promotion — tracker v8→v9 sweep
- [`7167397`](https://github.com/zugzwang-foundation/experiment/commit/716739774a0749075a4e71ba0278a990806d5949) · [#40](https://github.com/zugzwang-foundation/experiment/pull/40) — feat(scaffold-13-a): Vercel DATABASE_URL wired to Supabase Pro — SCAFFOLD.13-A — Vercel wired to Supabase Pro
- [`15551b2`](https://github.com/zugzwang-foundation/experiment/commit/15551b22109bb7af96e8fdd7779a80d07a453796) · [#41](https://github.com/zugzwang-foundation/experiment/pull/41) — chore(scaffold-13-b): promote plan — SCAFFOLD.13-B promote plan
- [`c8e8e7e`](https://github.com/zugzwang-foundation/experiment/commit/c8e8e7e5fb30658a611f3f221e0fc6253ea9ccc6) · [#42](https://github.com/zugzwang-foundation/experiment/pull/42) — plan(scaffold-13-b): amend15 — B5c clean-slate + B0 yield cascades + Q9 pre-commit [SCAFFOLD.13-B] — SCAFFOLD.13-B plan amendment
- [`2fb9091`](https://github.com/zugzwang-foundation/experiment/commit/2fb9091bf304caed1b8e2c87e76a1574e4289173) · [#43](https://github.com/zugzwang-foundation/experiment/pull/43) — chore(scaffold-13-b): execute close-out + maintenance.md routing extension — SCAFFOLD.13-B close-out
- [`7362e46`](https://github.com/zugzwang-foundation/experiment/commit/7362e460e8f41b15f9fd8491d9429de748e424e7) · [#44](https://github.com/zugzwang-foundation/experiment/pull/44) — chore(scaffold-12): zugzwangworld.com domain cutover — SCAFFOLD.12 — zugzwangworld.com cutover: the product gets its domain
- [`3a737c6`](https://github.com/zugzwang-foundation/experiment/commit/3a737c65ec8dbb7467945dba00e678fa23dfc834) · [#45](https://github.com/zugzwang-foundation/experiment/pull/45) — fix(scaffold-3-followup-1): Better Auth 415 + captcha coverage — auth follow-up: Better Auth 415 + captcha coverage
- [`f546053`](https://github.com/zugzwang-foundation/experiment/commit/f5460533cfaea07cc5631a42d59090ea9ae4df83) · [#46](https://github.com/zugzwang-foundation/experiment/pull/46) — docs(scaffold-3-followup-1): execute-phase close-out log — SCAFFOLD.3-FOLLOWUP-1 close log
- [`660f193`](https://github.com/zugzwang-foundation/experiment/commit/660f193ad160b94f02996a7fb5c58ff092adf985) · [#47](https://github.com/zugzwang-foundation/experiment/pull/47) — feat(scaffold-15): R2 storage substrate + signed-URL endpoint + orphan-sweep — SCAFFOLD.15 — R2 storage substrate: presigned uploads + orphan sweep
- [`8723fa5`](https://github.com/zugzwang-foundation/experiment/commit/8723fa557629fe5a05c58c5a2ea1b7829a3ca5d0) · [#48](https://github.com/zugzwang-foundation/experiment/pull/48) — docs(scaffold-15): operator-substrate clearance + execute review close-out — SCAFFOLD.15 close log
- [`d5be518`](https://github.com/zugzwang-foundation/experiment/commit/d5be5180b5839b34a88f2a45f222386ba96eab0a) · [#50](https://github.com/zugzwang-foundation/experiment/pull/50) — feat(scaffold-17): identity-pool seed + pg_cron low-watermark + verification — SCAFFOLD.17 — identity pool seeded; pg_cron low-watermark alarm
- [`6a6b04b`](https://github.com/zugzwang-foundation/experiment/commit/6a6b04b0cdcc3628d7b7d1885f54ed63f8fd5219) · [#51](https://github.com/zugzwang-foundation/experiment/pull/51) — chore: SCAFFOLD.17 post-merge log + tracker entries — SCAFFOLD.17 close log
- [`45b35e1`](https://github.com/zugzwang-foundation/experiment/commit/45b35e1b1ed7350b31703d3c3b20a3b7763bd6bf) · [#52](https://github.com/zugzwang-foundation/experiment/pull/52) — feat(scaffold-16): LD-3 text/image Track A carve-out + F-γ-thin §15 F-ADMIN-4 extension + 17 §F SPEC amendments — SCAFFOLD.16 — moderation Track-A carve-out + 17 §F SPEC amendments
- [`e6de02a`](https://github.com/zugzwang-foundation/experiment/commit/e6de02ad4bb5cf301706ae3b7be678b6ae777c05) · [#53](https://github.com/zugzwang-foundation/experiment/pull/53) — feat(scaffold-finish-bundle-1): observability stack (SCAFFOLD.5 + .6 + .7) — SCAFFOLD.5/6/7 — Sentry + PostHog observability stack
- [`e080dab`](https://github.com/zugzwang-foundation/experiment/commit/e080dabe1632c7df78b4f1ebcddf85f72ad38025) · [#54](https://github.com/zugzwang-foundation/experiment/pull/54) — feat(ci): expand CI with Postgres service + migration apply (SCAFFOLD.18) — SCAFFOLD.18 — CI grows a Postgres service and applies migrations
- [`e26d198`](https://github.com/zugzwang-foundation/experiment/commit/e26d19874f79886cc4d41c886552e6ba3caf5a25) · [#55](https://github.com/zugzwang-foundation/experiment/pull/55) — docs(scaffold-8): land brief + plan + plan-mode review log — SCAFFOLD.8 brief + plan
- [`9a42b8a`](https://github.com/zugzwang-foundation/experiment/commit/9a42b8aeccb34b0a27522000cd4ca7bbc5a2f6d2) · [#56](https://github.com/zugzwang-foundation/experiment/pull/56) — chore(logs): SCAFFOLD.18 execute review session log — SCAFFOLD.18 session log
- [`92b7c47`](https://github.com/zugzwang-foundation/experiment/commit/92b7c47f265ed36874b1fd38add20fa52262cb71) · [#57](https://github.com/zugzwang-foundation/experiment/pull/57) — feat(scaffold-8): staging environment — SCAFFOLD.8 — the staging environment exists

## B4 — Sync & cold-review interludes (8 commits)

> **TL;DR for the room:** The repo periodically stops and reconciles itself: ADRs
> backfilled to disk (#59), a cold outside-in review (#61), spec/tracker sweeps (#62, #66,
> #106). Boring by design — this is the maintenance muscle that keeps the docs you are
> reading trustworthy.

The SYNC arc is where the ADR catalogue became real files: #59 backfills ADRs 0003–0019
from SPEC.2 §0.1 change-log substance (they were accepted decisions already — the backfill
is bookkeeping, not re-litigation). #61 is a cold repo review that, among small fixes,
added the `comments.bet_id` index — the reviewer-facing half of the deliberate-gap story
in A4. The two later sweeps (#66, #106) are the recurring pattern this deck itself follows:
verify live state, reconcile citations, bump versions, log it.

### Ledger — 8 commits

- [`7a53341`](https://github.com/zugzwang-foundation/experiment/commit/7a53341a5bef074b350487c3fbf0a629424dec8a) · [#59](https://github.com/zugzwang-foundation/experiment/pull/59) — docs(adr): backfill ADRs 0003-0019 and ADR template — SYNC — ADRs 0003–0019 backfilled to disk
- [`5d65804`](https://github.com/zugzwang-foundation/experiment/commit/5d658042d402308690a20b261ab3072b8c09e625) · [#60](https://github.com/zugzwang-foundation/experiment/pull/60) — docs(logs): backfill SYNC-arc session logs + gitignore recon scratch — SYNC-arc log backfill
- [`5d7b527`](https://github.com/zugzwang-foundation/experiment/commit/5d7b52772f55490ff988f0142b34cd057f9e3a92) · [#61](https://github.com/zugzwang-foundation/experiment/pull/61) — chore(review): cold repo review + comments.betId index — cold repo review + the comments.bet_id index
- [`809179f`](https://github.com/zugzwang-foundation/experiment/commit/809179f307496d54fac4b4708a9d03aa5aa59aee) · [#62](https://github.com/zugzwang-foundation/experiment/pull/62) — docs(sync): SYNC.10 — canonical spec/meta/log bundle — SYNC.10 — canonical spec/meta/log bundle
- [`fa9235a`](https://github.com/zugzwang-foundation/experiment/commit/fa9235a75ee403d5c308e22642403c4dbb7c441c) · [#66](https://github.com/zugzwang-foundation/experiment/pull/66) — docs(spec): tracker sweep — SPEC.2 §23/§0 + SPEC.1 status reconciled to v11 (1.0.1) — tracker-v11 sweep — SPEC.2 §23/§0 reconciled (1.0.1)
- [`7021c8c`](https://github.com/zugzwang-foundation/experiment/commit/7021c8caec16fb448a38fb3fba108b752c74e7bc) · [#67](https://github.com/zugzwang-foundation/experiment/pull/67) — chore(spec): log session — tracker-sweep-v11 §23/§0 reconciliation closed — tracker-sweep close log
- [`5e75f5f`](https://github.com/zugzwang-foundation/experiment/commit/5e75f5f818ee0425da9fd05c029121321f40305d) · [#106](https://github.com/zugzwang-foundation/experiment/pull/106) — chore(sweep): reconciliation 2026-06 — SPEC.2 §19.4.1 riders + doc truth-up + HARDEN.5 cites — 2026-06 reconciliation — SPEC.2 §19.4.1 riders + doc truth-up
- [`3720935`](https://github.com/zugzwang-foundation/experiment/commit/37209355b90347bc79b497f39258b1ecde5fe544) · [#107](https://github.com/zugzwang-foundation/experiment/pull/107) — chore(sweep): log session — reconciliation sweep 2026-06 merged (#106) — reconciliation-sweep close log

## B5 — Design backbone (4 commits — out-of-scope pointer)

> **TL;DR for the room:** The visual/design lane exists and has its own canon (design
> language, token contract, mockups). It is **out of scope for this review** — these four
> ledger lines keep the census complete, and B9 carries the only shipped participant
> surface.

Design work runs as its own lane: the VISUAL backbone (#68, #70) and the DC.3 design canon
(#195–#196, which also minted the `!docs/design/mockups` Biome exclusion — the precedent
this deck's own `!docs/handover` rider follows). Interactive UI build-out is queued behind
the branding series (§C7 roadmap); nothing here touches the backend you are auditing.

### Ledger — 4 commits

- [`5b19a13`](https://github.com/zugzwang-foundation/experiment/commit/5b19a1325922bea50ae167f79ea5f41c4361ac9f) · [#68](https://github.com/zugzwang-foundation/experiment/pull/68) — docs(design): add VISUAL backbone — language, workflow, handoff, planner — VISUAL backbone — design language/workflow/handoff (out-of-scope lane)
- [`2e26b52`](https://github.com/zugzwang-foundation/experiment/commit/2e26b5217d2af73af8a44cfc4bc2630a03d7da6d) · [#70](https://github.com/zugzwang-foundation/experiment/pull/70) — docs(design): bump design backbone to v0.2 — fold in CD high-fidelity research (Research_Report_v2) — design backbone v0.2 — CD research folded
- [`5b28c49`](https://github.com/zugzwang-foundation/experiment/commit/5b28c4985c5843cd4112341bad98847cc4ce4376) · [#195](https://github.com/zugzwang-foundation/experiment/pull/195) — docs(design): DC.3 — commit design canon, token contract, design-language v0.5, per-surface mockups (+ archival-mockup lint exclusion) — DC.3 — design canon + token contract + the biome mockup-exclusion precedent this deck's rider follows
- [`16bb728`](https://github.com/zugzwang-foundation/experiment/commit/16bb728e460400d4b33fc5fd328d7724b7596ec9) · [#196](https://github.com/zugzwang-foundation/experiment/pull/196) — chore(docs): log session — DC.3 close-out (PR #195 squash 5b28c49) — DC.3 close log

## B6 — The market engine (64 commits)

> **TL;DR for the room:** Eighteen ENGINE strata build the money path: a pure CPMM module
> property-tested against its own math spec, an append-only Dharma ledger, a SERIALIZABLE
> bet transaction that writes the whole bet spine or nothing, lazy issuance, an append-only
> resolution trio, and a conclusion freeze — closed by a correctness-at-scale gate. This is
> the chapter your MATH stratum (EXTAUDIT-03) probes; the deep dives below tell you where
> each probe target came from.

The engine was built strictly plan→execute→log, one stratum per session — the ledger's
alternating `plan`/`feat`/`log` triplets are that cadence. Stratum IDs are not merge-order:
E.6 landed early (events were needed by SCAFFOLD consumers), and E.16 (freeze) landed
before E.10 (scale gate) — the consolidated phase record (#133) carries the same errata.
One non-engine interlude (#101, a harness/model contract move) merged mid-phase and is
absorbed here.

### The event spine first (E.6, E.0)

**#49 — ENGINE.6, merged mid-SCAFFOLD.** The `insertEvent` helper + per-event-type Zod
payload schemas, retrofitted onto 6 existing emission sites. Idempotency is storage-level:
`ON CONFLICT (event_id, created_at) DO NOTHING`, with `created_at` derived
deterministically from the UUIDv7 millisecond prefix so a retried insert reuses both key
halves. **#69 — ENGINE.0** then locks the vocabulary: +10 event types with a
`numericString` payload primitive (money in payloads is a string, never a JS number —
the A3 money rule applied to telemetry).

The `events` table itself is the hand-written DDL from B3
(`drizzle/migrations/0002_events_partitioning.sql:12-31`):

```sql
CREATE TABLE events (
	event_id uuid NOT NULL DEFAULT uuidv7(),
	event_type text NOT NULL,
	aggregate_type text NOT NULL,
	aggregate_id uuid NOT NULL,
	payload jsonb NOT NULL,
	payload_version smallint NOT NULL,
	metadata jsonb NOT NULL,
	created_at timestamptz NOT NULL DEFAULT now(),
	PRIMARY KEY (event_id, created_at)
) PARTITION BY RANGE (created_at);
```

Postgres requires the partition column inside the PK — hence the composite key; the
uniqueness the product relies on is still `event_id` (dedupe above). The closed value set
for `event_type` is the compile-guarded TS const (`src/server/events/schemas.ts:54-61`,
head of 24 values at PIN_SHA):

```ts
export const EVENT_TYPES = [
	// image_upload domain (4)
	"image_upload.sign_requested",
	"image_upload.committed",
	"image_upload.blocked",
	"image_upload.orphaned",
	// user domain (5)
	"user.oauth_signed_in",
	…
] as const;
```

Adding a type without its Zod payload schema fails `tsc` — the `as const satisfies
Record<EventType, z.ZodObject<…>>` clause is the enum-hygiene contract.

### The math lane (E.1 → E.2 → E.3)

**#71 — ENGINE.1: cpmm.md v1.0.0.** The math is specified before it is implemented: pool
seeding, price, buy, sell (the quadratic small-root proceeds), resolved unwind, the
precision/rounding contract (§10) and five worked examples (§12, E1–E5). The module is
lifted from Manifold's `calculate-cpmm.ts` with attribution — the reference is pinned as a
fork tag in `docs/references/manifold.md`, **not vendored as runnable TS** (which is
exactly why EXTAUDIT-03 §3 makes vendoring it for a differential harness your priority
task). At PIN_SHA the spec sits at **2.0.0** after the B8 audit riders (#216).

**#75 — ENGINE.2: the pure module.** `src/server/cpmm/` — no IO, no imports from the app;
five exported functions (`seedPool`, `getPrices`, `computeBuy`, `computeSell`,
`computeResolvedUnwind`). All arithmetic flows through one cloned constructor
(`src/server/cpmm/decimal.ts:21-24`):

```ts
export const CpmmDecimal = Decimal.clone({
	precision: 50,
	rounding: Decimal.ROUND_HALF_EVEN,
});
```

precision 50 gives headroom over every `NUMERIC(38,18)` intermediate; boundary quantizers
serialize every exported quantity to exactly 18dp with a per-class direction — user-credited
quantities floor (`floor18`), reserves round half-even. The buy quote in full
(`src/server/cpmm/calculate.ts:73-91`):

```ts
	const opp = opposite(side);
	const S = requirePositive(stake, "stake");
	const a = requirePositive(reserves[side], `reserves.${side}`);
	const b = requirePositive(reserves[opp], `reserves.${opp}`);

	const aPrimeExact = a.times(b).dividedBy(b.plus(S));
	const sExact = a.plus(S).minus(aPrimeExact);
	const shares = floor18(sExact);
	const sR = new CpmmDecimal(shares);
	const aPrime = a.plus(S).minus(sR);
	const bPrime = b.plus(S);

	const p0Exact = b.dividedBy(a.plus(b));
	const p1Exact = bPrime.dividedBy(aPrimeExact.plus(bPrime));
```

Constant-product with the stake entering both reserves, shares floored in the user's
disfavour, reserves re-derived from the *floored* shares so the invariant k′ ≥ k holds by
construction — pool rounding dust always favours the pool, never the user.

**#79 — ENGINE.3: the property suite.** fast-check generators drive `computeBuy`/
`computeSell` through randomized reserve/stake space asserting k-conservation (k′ ≥ k),
price bounds (0 < p < 1), buy→sell round-trip never profits, and determinism;
`tests/unit/cpmm/vectors.test.ts` pins the five cpmm.md §12 worked examples as fixed
vectors. Note for your probes: this is self-consistency against the repo's own spec — the
independent cross-check against Manifold's implementation is the EXTAUDIT-03 §3 harness.

### State machines and ledgers (E.4, E.5, E.11)

**#83 — ENGINE.4: the market state machine.** Pure functions over a compile-guarded edge
table (`src/server/markets/transitions.ts:34-42`):

```ts
const LEGAL_TRANSITIONS = {
	Draft: ["Open"],
	Open: ["Closed", "Voided"],
	Closed: ["Resolving", "Voided"],
	Resolving: ["Resolved"],
	Resolved: ["Frozen"],
	Voided: ["Frozen"],
	Frozen: [],
} as const satisfies Record<MarketStatus, readonly MarketStatus[]>;
```

Seven states, eight legal edges, `Frozen` absorbing. Illegal edges are negative tests, not
runtime surprises; the single clock-guarded edge (`closeOnDeadline`, Open→Closed) takes
`now` as an argument so time is testable.

**#87 — ENGINE.5: the Dharma ledger.** Append-only rows carrying `amount` +
`balance_after`; the computation is pure and the floor is double-enforced — app-side
*and* storage-side (`CHECK (balance_after >= 0)`, INV-2). The whole rule fits in one
excerpt (`src/server/dharma/ledger.ts:57-73`):

```ts
	if (entryType === "uncollectable") {
		if (new CpmmDecimal(amount).greaterThan(0)) {
			throw new DharmaInputError(
				`uncollectable amount must be <= 0 (A9 sign guard): ${amount}`,
			);
		}
		return { amount, balanceAfter: previousBalance };
	}

	const balanceAfter = new CpmmDecimal(previousBalance).plus(amount);
	if (balanceAfter.lessThan(0)) {
		throw new DharmaOverdraftError(
			`balance_after < 0 (overdraft): ${previousBalance} + ${amount}`,
		);
	}

	return { amount, balanceAfter: balanceAfter.toFixed(18) };
}
```

Ten `entry_type` values cover every legal flow (`bet_stake`, `bet_payout`,
`daily_allowance`, `initial_grant`, `void_refund`, `correction_*`, `uncollectable`, and
the two v1-dormant pool flows); none of them moves value user→user —
**non-transferability is the absence of a primitive, not a check**. `uncollectable` is
the one deliberate oddity: it records a debt that cannot be collected with
`balance_after = previous_balance`, keeping the chain arithmetic honest (and its sign
guard was an audit-campaign hardening, B13). The pool tags are rejected outright at this
layer — pool flows live in `events` + reserve deltas in v1 (R-2), so the user ledger
stays a pure single-user record.

**#91 — ENGINE.11: positions.** The one mutable money table (Bucket C): net holding per
(user, market), recomputed from bets by pure `compute.ts`, upserted in-tx, guarded by the
single-side rule, and **reconciled nightly by a pg_cron drift check** (migration `0011`)
that recomputes positions from the bet ledger and alarms on any divergence — the read
model is allowed to be mutable precisely because an append-only source of truth can always
re-derive it.

### The write spine (E.7 → E.8) — where INV-1 lives

**#95 — ENGINE.7: the W-1 wrapper.** One SERIALIZABLE transaction; the pool row locked
`SELECT … FOR NO KEY UPDATE`; a bounded full-jitter retry loop — bases 50/100/200 ms, four
attempts total, ADR-0013 *decision parameters, not tunables*
(`src/server/bets/transaction.ts:115-128`):

```ts
	for (let attempt = 0; attempt <= BACKOFF_BASES_MS.length; attempt++) {
		try {
			return await db.transaction(
				async (tx) => {
					await applyTxTimeouts(tx);
					const pool = await lockPool(tx, args.marketId);
					await assertMarketOpen(tx, args.marketId);
					return await callback({ tx, pool });
				},
				{ isolationLevel: "serializable" },
			);
		} catch (err) {
			const sqlstate = retryableSqlstate(err);
```

Only `40001`/`40P01` retry; everything else bubbles immediately. Exhaustion emits a
Sentry alarm and a typed product error — fail-safe direction: a lost retry, never a silent
commit.

**#99 — ENGINE.8: the handlers.** `/api/bets/place` and `/api/bets/sell` share one
endpoint spine: zod-validate → rate-limit (fails **open**) → idempotency reserve (fails
**closed**) → moderation precommit (outside the tx, fails **closed**) → W-1 → wire
envelope. The ordered writes inside `place()` are the INV-1 mechanism itself
(`src/server/bets/place.ts:138-165`, abridged):

```ts
	const [comment] = await tx
		.insert(comments)
		.values({
			…
			sideAtPostTime: side, // INV-3 — the REPLIER's side, frozen at post time
			betId: null, // Bucket-A circular pair; stays null in v1
		})
		.returning({ id: comments.id });
	…
	const [bet] = await tx
		.insert(bets)
		.values({
			…
			commentId: comment.id, // INV-1 schema half (comment-before-bet, FK)
			idempotencyKey: params.idempotencyKey,
		})
		.returning({ id: bets.id });
```

Comment first (its `bet_id` deliberately null — the A4 gap), then the bet pointing back
`NOT NULL`, then ledger debit, position upsert, `bet.placed` + `comment.placed` events,
and (post-audit) the durable receipt — all in the one W-1 transaction. The canonical
invariant test drives a mid-spine fault and asserts *every* table rolled back
(`tests/invariants/I-ATOMICITY-001.bet-comment-atomic.spec.ts:122-214`, abridged):

```ts
	it("bet-comment-atomicity::mid-spine-abort-rolls-back-all-tables", async () => {
		…
		expect(poolRow?.yesReserves).toBe(SEED_RESERVES);
		expect(positionRows.length).toBe(0);
		expect(ledgerRows.some((r) => r.entryType === "bet_stake")).toBe(false);
		expect(commentRows.length).toBe(0);
		expect(betRows.length).toBe(0);
		expect(eventRows.length).toBe(0);
	});
```

Idempotency is two-layered (post-#202). The hot path is a Redis SETNX reserve/lookup
window whose failure mode is deliberately pessimistic — if the cache state cannot be
observed, the request is a 503, never a guessed "miss"
(`src/server/idempotency/cache.ts:168-180`):

```ts
	const existing = await redis.get<string>(redisKey);
	if (existing === null || existing === undefined) {
		// Race: key expired between our SET NX and our GET. Retry the
		// reserve-or-lookup once. SETNX wins-or-losses converge.
		if (allowRaceRetry) {
			return tryReserveOrLookup(redisKey, bodyFingerprint, false);
		}
		// Two-attempt convergence failed. Treat as unreachable so the
		// caller surfaces a clean 503 rather than fabricating a 'miss'
		// arm (which would be unsound — we couldn't observe the cache
		// state).
		throw new Error(
			"idempotencyLookupOrReserve: SETNX race-retry exhausted; …",
		);
	}
```

The correctness layer is durable: the `bet_receipts` pre-check + the tx-level unique —
replay resolution keys on exactly two constraints, and any *other* `23505` is a genuine
bug, not a replay (`src/server/bets/replay.ts:17-25`). A replay after a crash, a Redis
flush, or the cache TTL still returns the original committed result (`I-IDEM-ONCE-001`).

**#101 — interlude.** The build harness moved to a new model family mid-phase (pins +
effort policy). No product surface; it sits in this chapter because it sits in this span
of `main`.

### Issuance (E.12, E.13)

**#104 — ENGINE.12: Daily Credit, lazily.** No cron mints allowance. The accrual runs
*inside* the user's first commented bet of the UTC day, as the first writes of the W-1
spine — and the atomicity is the *product rule* (`src/server/dharma/accrual.ts:125-131`,
doc contract):

```ts
 * Atomicity delivers ADR-0018's conditionality for free: any in-tx failure
 * rolls back credit + cursor together — "paid only on placing a commented
 * bet" is enforced by rollback, not by a check. The cursor is a derivable
 * projection (ADR-0005): reconstructible as
 * `max((timezone('UTC', created_at))::date)` over the user's
 * `daily_allowance` rows — mutating it in place is the SPEC-named
 * idempotency-cursor pattern, not state-in-place drift.
```

An already-paid day is a pure read (no lock added to the hot path); the write order is
ruled so a same-user race hits the retryable `40001` before the terminal `23505`.
At-most-once is storage-backed regardless: the partial unique index
`dharma_ledger_daily_allowance_day_uq` makes a double-credit impossible, not just
unlikely (`I-DAILY-ONCE-001`). Use-or-lose: no bet, no credit, no accumulation
(ADR-0018).

**#110 — ENGINE.13: the initial grant.** One-time Dharma at first ToS acceptance, same
pattern one level up: partial unique index `dharma_ledger_initial_grant_user_uq`, spec'd
as `I-GRANT-ONCE-001` — at most one `initial_grant` row per user, *ever*, enforced where
UPDATE cannot reach (the ledger is Bucket A).

### Resolution and lifecycle (E.9, E.14)

**#114 — ENGINE.9: the resolution trio.** `settle` / `correct` / `void` under the W-3
wrapper. Settlement computes per-bet pro-rata payout bases and appends
`resolution_events` + one `payout_events` leg per position — INV-4's surface. The
allocation primitive is deterministic to the last 18th decimal
(`src/server/resolution/basis.ts:25-47`, head):

```ts
export function prorate(args: {
	rows: readonly { id: string; weight: string }[];
	total: string;
}): { id: string; amount: string }[] {
	const total = new CpmmDecimal(args.total);
	if (total.lessThan(0)) {
		throw new Error(`prorate: negative total ${args.total}`);
	}
	…
	const sorted = [...args.rows].sort((a, b) =>
		a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
	);
```

— rows sorted by id, every leg floored, and the *last* row takes the exact remainder, so
the legs always sum to the pool being distributed (conservation by construction; the
`resolution-conservation` integration suite asserts it against a real database).
Two storage backstops land in the same stratum (migrations `0014`/`0015`): the **terminal
singleton** partial unique index `resolution_events_terminal_market_uq` (a second
resolve/void on the same market is a `23505` — `I-RESOLVE-ONCE-001`), while `correct`
rows chain by `corrects_event_id` and keep history append-only. Corrections are new rows
that *reverse and re-apply* (`correction_reverse` / `correction_apply` ledger pairs) —
nothing is ever edited, so a corrected market's full audit trail survives (INV-4).

**#118 — ENGINE.14: lifecycle writes.** W-4 wraps `create` (market + pool seed in one tx),
`open`, `close`, and the `closeDueMarkets` sweep; every admin mutation passes
`assertAdminActor` (`src/server/admin/actor.ts`) — `actor_id === 'admin-singleton'` AND
`user_id === null`, the runtime belt on top of the structural separation (admin has no
`users` row to act from).

### Wiring, freeze, and the scale gate (E.15, E.16, E.10)

**#122 — ENGINE.15: the engine becomes reachable.** Admin Server Actions + pages
(create/open/close/resolve/void/seed), the `close-due-markets` cron route (minutely,
`CRON_SECRET`-gated, timing-safe compare), and the resolution actor belt — plus the SPEC
riders that keep canon in lock-step (→ SPEC.1 1.0.5). Also mints the route-handler test
convention (`tests/server/cron/close-due-markets`).

**#127 — ENGINE.16: the conclusion freeze read-guard.** `isFrozen()` consults the
`system_state` singleton (Bucket B: `frozen_at` flips NULL→timestamp exactly once);
participant writes get `410 Gone` post-freeze; crons degrade to no-op `200`s. The freeze
is the experiment's data-integrity endgame: after 2026-11-05 23:59 UTC the dataset is
immutable because the *write paths themselves* refuse.

**#131 — ENGINE.10: the correctness-at-scale exit gate.** `tests/scale/` — 8 Vitest-driven
in-process concurrency suites (hot-row contention, idempotency dedup under race, freeze
under load, money-math determinism, reconciliation, daily-credit race, side-bind,
two-spine interaction). **Deliberately excluded from the default `vitest run`**
(`vitest.config.ts` exclude) — auditors must opt in explicitly (`pnpm vitest run
tests/scale/ --…`) or they will silently skip the concurrency evidence; §C5 repeats this.
The build-gate report rode the close-out log (#132). The engine phase closes with the
consolidated record (#133/#134) — the single narrative doc for everything this chapter
just walked.

### Ledger — all 64 commits

- [`42baa8b`](https://github.com/zugzwang-foundation/experiment/commit/42baa8b5ef66313952e69edc36f4e154597f23f1) · [#49](https://github.com/zugzwang-foundation/experiment/pull/49) — feat(engine-6): events helper + per-event-type Zod schemas + 6-site emission migration — ENGINE.6 lands early: events helper + per-type Zod schemas + 6 emission sites
- [`4dc16d7`](https://github.com/zugzwang-foundation/experiment/commit/4dc16d719d78646a5f83472768a4624bf18bf7ff) · [#69](https://github.com/zugzwang-foundation/experiment/pull/69) — feat(events): ENGINE.0 — event-type vocabulary expansion (+10 schemas, numericString) — ENGINE.0 — event-type vocabulary expansion (+10 schemas)
- [`e7362fc`](https://github.com/zugzwang-foundation/experiment/commit/e7362fc9c9bb1337a1e58b201346ecf22865cc27) · [#71](https://github.com/zugzwang-foundation/experiment/pull/71) — docs(specs): ENGINE.1 — cpmm.md v1.0.0 + third-party notices + SPEC.1 1.0.2 glossary fix — ENGINE.1 — cpmm.md v1.0.0: the math spec the module is built against
- [`48ca6d0`](https://github.com/zugzwang-foundation/experiment/commit/48ca6d0d792fd72e57be73f1feecbb342b2783ec) · [#72](https://github.com/zugzwang-foundation/experiment/pull/72) — chore(spec): log session — ENGINE.1 session B (cpmm.md landing) closed — ENGINE.1 close log
- [`d6af030`](https://github.com/zugzwang-foundation/experiment/commit/d6af0302b7e6b8960ad7c888a5866aa5e041d402) · [#73](https://github.com/zugzwang-foundation/experiment/pull/73) — docs(plans): ENGINE.2 — CPMM module implementation plan (founder-ratified) — ENGINE.2 plan gate
- [`5cdeebd`](https://github.com/zugzwang-foundation/experiment/commit/5cdeebd75b395b5d0226397aa686b736962cd7f0) · [#74](https://github.com/zugzwang-foundation/experiment/pull/74) — chore(engine): log session — ENGINE.2 plan ratified + merged (#73) — ENGINE.2 plan log
- [`2a8d888`](https://github.com/zugzwang-foundation/experiment/commit/2a8d888f405a6a822850f5478801a0db43862c43) · [#75](https://github.com/zugzwang-foundation/experiment/pull/75) — feat(cpmm): ENGINE.2 — pure CPMM module (cpmm.md §13 surface) — ENGINE.2 — the pure CPMM module (cpmm.md §13 surface)
- [`130ddba`](https://github.com/zugzwang-foundation/experiment/commit/130ddba81aa7b72640eda18444459051dac760e3) · [#76](https://github.com/zugzwang-foundation/experiment/pull/76) — chore(engine): log session — ENGINE.2 execute merged — ENGINE.2 close log
- [`945b764`](https://github.com/zugzwang-foundation/experiment/commit/945b764e4401ac70790ab7da20f27ee96767a7a7) · [#77](https://github.com/zugzwang-foundation/experiment/pull/77) — docs(plans): ENGINE.3 — CPMM property-suite plan (founder-ratified) — ENGINE.3 plan gate
- [`34fe68a`](https://github.com/zugzwang-foundation/experiment/commit/34fe68a5ac31dc148981f70420b2c9c8ffda165e) · [#78](https://github.com/zugzwang-foundation/experiment/pull/78) — chore(engine): log session — ENGINE.3 plan ratified + merged (#77) — ENGINE.3 plan log
- [`d8e9159`](https://github.com/zugzwang-foundation/experiment/commit/d8e9159de7cb4e64f469ab41b2ba74351be34d52) · [#79](https://github.com/zugzwang-foundation/experiment/pull/79) — test(cpmm): ENGINE.3 — CPMM property suite (fast-check) — ENGINE.3 — fast-check property suite over the CPMM
- [`88b2a02`](https://github.com/zugzwang-foundation/experiment/commit/88b2a0297822deecf9d3aa68951b79f4880baf5b) · [#80](https://github.com/zugzwang-foundation/experiment/pull/80) — chore(engine): log session — ENGINE.3 execute merged (#79) — ENGINE.3 close log
- [`3148020`](https://github.com/zugzwang-foundation/experiment/commit/314802034c76a3f76594ebbe801718a24bea2ea1) · [#81](https://github.com/zugzwang-foundation/experiment/pull/81) — plan: ENGINE.4 — market state machine (reviewed) — ENGINE.4 plan gate
- [`0be2f16`](https://github.com/zugzwang-foundation/experiment/commit/0be2f16ec25cde1c24a1ac5b1f58bd0be38a0663) · [#82](https://github.com/zugzwang-foundation/experiment/pull/82) — chore(engine): log session — ENGINE.4 plan merged (#81) — ENGINE.4 plan log
- [`c976222`](https://github.com/zugzwang-foundation/experiment/commit/c9762224940d3a34e35a947c29b6501e8d1098d6) · [#83](https://github.com/zugzwang-foundation/experiment/pull/83) — feat(markets): ENGINE.4 — market state machine — ENGINE.4 — the market state machine (illegal edges = negative tests)
- [`671c484`](https://github.com/zugzwang-foundation/experiment/commit/671c484884b8b8420561be8a92d78fe94c28f9ab) · [#84](https://github.com/zugzwang-foundation/experiment/pull/84) — chore(engine): log session — ENGINE.4 execute merged (#83) — ENGINE.4 close log
- [`c7acc1b`](https://github.com/zugzwang-foundation/experiment/commit/c7acc1bd010a376b4c0b53723c1b4bec9777c824) · [#85](https://github.com/zugzwang-foundation/experiment/pull/85) — plan: ENGINE.5 — Dharma append-only ledger (reviewed) — ENGINE.5 plan gate
- [`0b69dd6`](https://github.com/zugzwang-foundation/experiment/commit/0b69dd6da0aab4e481b7a43c58aec16da32a7014) · [#86](https://github.com/zugzwang-foundation/experiment/pull/86) — chore(engine): log session — ENGINE.5 plan merged (#85) — ENGINE.5 plan log
- [`da4618d`](https://github.com/zugzwang-foundation/experiment/commit/da4618d4bc26b5007aeae321165cf0e1267656ed) · [#87](https://github.com/zugzwang-foundation/experiment/pull/87) — feat(dharma): ENGINE.5 — Dharma append-only ledger — ENGINE.5 — the Dharma append-only ledger (INV-2 in code)
- [`9ea737b`](https://github.com/zugzwang-foundation/experiment/commit/9ea737b3854b0d72c373a4d3bc736fbb89fefa16) · [#88](https://github.com/zugzwang-foundation/experiment/pull/88) — chore(engine): log session — ENGINE.5 execute merged (#87) — ENGINE.5 close log
- [`10b9aa8`](https://github.com/zugzwang-foundation/experiment/commit/10b9aa8da3283c7c4492c914b14fc3fd40517e65) · [#89](https://github.com/zugzwang-foundation/experiment/pull/89) — plan: ENGINE.11 — Position layer logic (reviewed) — ENGINE.11 plan gate
- [`c825730`](https://github.com/zugzwang-foundation/experiment/commit/c825730fdaa0bba2d3a68d02d2a817463b30f28c) · [#90](https://github.com/zugzwang-foundation/experiment/pull/90) — chore(engine): log session — ENGINE.11 plan merged (#89) — ENGINE.11 plan log
- [`deb0c76`](https://github.com/zugzwang-foundation/experiment/commit/deb0c7602c6f39e5539486c9cbc3d5ab9f6a91bd) · [#91](https://github.com/zugzwang-foundation/experiment/pull/91) — feat(positions): ENGINE.11 — position layer (compute · persist · read · drift cron) + constraints + CI strip — ENGINE.11 — the position layer (Bucket-C read model + drift cron)
- [`2667140`](https://github.com/zugzwang-foundation/experiment/commit/2667140e86817e296b332c3fc904cc1edb19219c) · [#92](https://github.com/zugzwang-foundation/experiment/pull/92) — chore(engine): log session — ENGINE.11 execute merged (#91) — ENGINE.11 close log
- [`7dc22d8`](https://github.com/zugzwang-foundation/experiment/commit/7dc22d84f3a39bd0cf69f791fe65675c2d5aff40) · [#93](https://github.com/zugzwang-foundation/experiment/pull/93) — plan(engine-7): W-1 bet-transaction wrapper — reviewed plan — ENGINE.7 plan gate
- [`7949fbc`](https://github.com/zugzwang-foundation/experiment/commit/7949fbc06c6bbbde5b6afac8968cb5837309548b) · [#94](https://github.com/zugzwang-foundation/experiment/pull/94) — chore(engine): log session — ENGINE.7 plan merged (#93) — ENGINE.7 plan log
- [`37dae5a`](https://github.com/zugzwang-foundation/experiment/commit/37dae5a7ae490e22ec8923127387dbed8de2aec3) · [#95](https://github.com/zugzwang-foundation/experiment/pull/95) — feat(bets): ENGINE.7 — W-1 bet-transaction wrapper (transaction.ts + errors.ts) — ENGINE.7 — W-1: the SERIALIZABLE bet-transaction wrapper (ADR-0013)
- [`cf461e8`](https://github.com/zugzwang-foundation/experiment/commit/cf461e85520c84fcc58be7a1b9dbdca1b5fb2a60) · [#96](https://github.com/zugzwang-foundation/experiment/pull/96) — chore(engine): log session — ENGINE.7 execute merged (#95) — ENGINE.7 close log
- [`c87eb9a`](https://github.com/zugzwang-foundation/experiment/commit/c87eb9aa4bc49f0681f20c274bfcaa70408122b8) · [#97](https://github.com/zugzwang-foundation/experiment/pull/97) — plan(engine-8): bet-flow handlers + §3.1 stack — reviewed plan — ENGINE.8 plan gate
- [`34b6c9a`](https://github.com/zugzwang-foundation/experiment/commit/34b6c9a7c3dcd2f50a3cc5b4cbbba97afa1882eb) · [#98](https://github.com/zugzwang-foundation/experiment/pull/98) — chore(engine): log session — ENGINE.8 plan reviewed — ENGINE.8 plan log
- [`66fa532`](https://github.com/zugzwang-foundation/experiment/commit/66fa532814cd9600c9d0c60fdbf2d559958251c4) · [#99](https://github.com/zugzwang-foundation/experiment/pull/99) — feat(bets): ENGINE.8 — F-BET bet-flow handlers (place/sell + §3.1 stack) — ENGINE.8 — F-BET handlers: place/sell + the §3.1 middleware stack
- [`1a1cd84`](https://github.com/zugzwang-foundation/experiment/commit/1a1cd845532ff8100cac151fa5b880f094b53665) · [#100](https://github.com/zugzwang-foundation/experiment/pull/100) — chore(engine): log session — ENGINE.8 execute merged (#99) — ENGINE.8 close log
- [`c2c7af1`](https://github.com/zugzwang-foundation/experiment/commit/c2c7af1e3de762172e5d9fef2b744f804d93a612) · [#101](https://github.com/zugzwang-foundation/experiment/pull/101) — chore: move CC harness to Claude Fable 5 (model pins, effort policy, contract docs) — harness interlude — CC moves to Fable 5 (model pins, effort policy)
- [`ca790ca`](https://github.com/zugzwang-foundation/experiment/commit/ca790ca24201995bb43280cec1c96f7c3d94aebc) · [#102](https://github.com/zugzwang-foundation/experiment/pull/102) — docs(plan): ENGINE.12 daily-credit accrual — founder-ratified plan — ENGINE.12 plan gate
- [`6540382`](https://github.com/zugzwang-foundation/experiment/commit/654038231601545807d4527e24bad258d6388d75) · [#103](https://github.com/zugzwang-foundation/experiment/pull/103) — docs(log): ENGINE.12 plan-session log — ENGINE.12 plan log
- [`af61ce5`](https://github.com/zugzwang-foundation/experiment/commit/af61ce5cf8d090819ddec10acc1444008407037f) · [#104](https://github.com/zugzwang-foundation/experiment/pull/104) — feat(dharma): ENGINE.12 — Daily Credit lazy accrual (place() tx + I-DAILY-ONCE-001) — ENGINE.12 — Daily Credit lazy accrual inside the bet tx (I-DAILY-ONCE-001)
- [`cdd882f`](https://github.com/zugzwang-foundation/experiment/commit/cdd882f06dea4c069d7f900698d0975098119c9d) · [#105](https://github.com/zugzwang-foundation/experiment/pull/105) — chore(engine): log session — ENGINE.12 execute merged (#104) — ENGINE.12 close log
- [`7f3214c`](https://github.com/zugzwang-foundation/experiment/commit/7f3214ca09d41efc30c8ee5f89418d7b92da420e) · [#108](https://github.com/zugzwang-foundation/experiment/pull/108) — ENGINE.13 plan — initial grant at first ToS acceptance (docs-only) — ENGINE.13 plan gate
- [`b62ec12`](https://github.com/zugzwang-foundation/experiment/commit/b62ec12536d66307b9b39309af7f92765c35c880) · [#109](https://github.com/zugzwang-foundation/experiment/pull/109) — ENGINE.13 plan — session log (docs-only) — ENGINE.13 plan log
- [`76877e6`](https://github.com/zugzwang-foundation/experiment/commit/76877e6bc99e4a78ea518abfd10941ea5f63e262) · [#110](https://github.com/zugzwang-foundation/experiment/pull/110) — feat(dharma): ENGINE.13 — initial grant at first ToS acceptance (F-AUTH-4 tx + I-GRANT-ONCE-001) — ENGINE.13 — initial grant at first ToS acceptance (I-GRANT-ONCE-001)
- [`28a8305`](https://github.com/zugzwang-foundation/experiment/commit/28a830551316b381b682af61f88d303008e5dda1) · [#111](https://github.com/zugzwang-foundation/experiment/pull/111) — chore(engine): log session — ENGINE.13 execute merged (#110) — ENGINE.13 close log
- [`6e0e55b`](https://github.com/zugzwang-foundation/experiment/commit/6e0e55b511d725aed43844b894fad45801c5cdf5) · [#112](https://github.com/zugzwang-foundation/experiment/pull/112) — ENGINE.9 plan — resolution trio + F-ADMIN-3 trigger (docs-only) — ENGINE.9 plan gate
- [`4206eb0`](https://github.com/zugzwang-foundation/experiment/commit/4206eb0838b4b6ac1e4563e1e77dbbc92a9aa965) · [#113](https://github.com/zugzwang-foundation/experiment/pull/113) — ENGINE.9 plan — session log (docs-only) — ENGINE.9 plan log
- [`af28566`](https://github.com/zugzwang-foundation/experiment/commit/af2856603f87d2a4dcb1594ae897879b83cad38a) · [#114](https://github.com/zugzwang-foundation/experiment/pull/114) — ENGINE.9 — resolution trio (settle/correct/void) + F-ADMIN-3 trigger, W-3 wrapper, migrations 0014/0015 — ENGINE.9 — the resolution trio (settle/correct/void) + W-3 + F-ADMIN-3
- [`b047563`](https://github.com/zugzwang-foundation/experiment/commit/b04756392caaa0b63bf3239152b117b27672cf27) · [#115](https://github.com/zugzwang-foundation/experiment/pull/115) — ENGINE.9 execute — session log (docs-only) — ENGINE.9 execute log
- [`b5e87df`](https://github.com/zugzwang-foundation/experiment/commit/b5e87dfd22a0e4cc46705c4bb2fe7c53988c4bae) · [#116](https://github.com/zugzwang-foundation/experiment/pull/116) — ENGINE.14 plan — market lifecycle writes (docs-only) — ENGINE.14 plan gate
- [`dbfbef4`](https://github.com/zugzwang-foundation/experiment/commit/dbfbef4f21391aaadda50889c37e1b3199b5be7d) · [#117](https://github.com/zugzwang-foundation/experiment/pull/117) — ENGINE.14 plan — session log (docs-only) — ENGINE.14 plan log
- [`a29ef7e`](https://github.com/zugzwang-foundation/experiment/commit/a29ef7e2a7daed6ef78fb221e43c5f4cbe204b37) · [#118](https://github.com/zugzwang-foundation/experiment/pull/118) — feat(engine-14): market lifecycle writes — W-4 wrapper + create/open/close + sweep + admin actor guard — ENGINE.14 — market lifecycle writes: W-4 + create/open/close + admin actor guard
- [`5a58883`](https://github.com/zugzwang-foundation/experiment/commit/5a58883a85d462987894ba2c6b5a077708575883) · [#119](https://github.com/zugzwang-foundation/experiment/pull/119) — chore(logs): log session — ENGINE.14 execute complete — ENGINE.14 close log
- [`d367ef1`](https://github.com/zugzwang-foundation/experiment/commit/d367ef1ff6b4f502567b5876ea84dccddc0d9090) · [#120](https://github.com/zugzwang-foundation/experiment/pull/120) — ENGINE.15 plan — HTTP/cron/admin wiring (docs-only) — ENGINE.15 plan gate
- [`6641eff`](https://github.com/zugzwang-foundation/experiment/commit/6641eff481cbcdef9bbcaa7d5e43209bf25ca8b7) · [#121](https://github.com/zugzwang-foundation/experiment/pull/121) — ENGINE.15 plan — session log (docs-only) — ENGINE.15 plan log
- [`b8d4ee4`](https://github.com/zugzwang-foundation/experiment/commit/b8d4ee4efeceb40cc5327e6a7298ca671cc92fd6) · [#122](https://github.com/zugzwang-foundation/experiment/pull/122) — feat(engine-15): HTTP/cron/admin wiring — admin actions + pages + close-due cron + resolution actor belt + SPEC/AGENTS riders (→1.0.5) — ENGINE.15 — HTTP/cron/admin wiring: the engine becomes reachable
- [`bf31417`](https://github.com/zugzwang-foundation/experiment/commit/bf3141751e2719391d03c171831cd1cd5f487583) · [#123](https://github.com/zugzwang-foundation/experiment/pull/123) — chore(engine-15): execute session log — ENGINE.15 execute log
- [`62206cf`](https://github.com/zugzwang-foundation/experiment/commit/62206cf5e935dd6cd4a36d839fa5cf4e885eacc2) · [#124](https://github.com/zugzwang-foundation/experiment/pull/124) — docs(engine-15): fix deviation-tally numbering in execute log — log-rendering fix (ordered-list renumbering bite)
- [`43c1632`](https://github.com/zugzwang-foundation/experiment/commit/43c1632f47f849de1e368958357279bd5d13af59) · [#125](https://github.com/zugzwang-foundation/experiment/pull/125) — docs(engine-16): plan — conclusion-freeze read-guard (participant-only gate + cron) — ENGINE.16 plan gate
- [`03006d1`](https://github.com/zugzwang-foundation/experiment/commit/03006d1a26e6d897597a097b1e51a1275ac6e241) · [#126](https://github.com/zugzwang-foundation/experiment/pull/126) — chore(engine-16): plan session log (docs-only) — ENGINE.16 plan log
- [`f7d1ab2`](https://github.com/zugzwang-foundation/experiment/commit/f7d1ab2dba385d20ecc562efbc2d6272734e7f05) · [#127](https://github.com/zugzwang-foundation/experiment/pull/127) — feat(engine-16): conclusion-freeze read-guard — isFrozen() + bet 410 + cron 200 — ENGINE.16 — conclusion-freeze read-guard: isFrozen() + bet 410
- [`5c624c4`](https://github.com/zugzwang-foundation/experiment/commit/5c624c4c555c06f3e9267e2f371131427f431411) · [#128](https://github.com/zugzwang-foundation/experiment/pull/128) — chore(engine-16): execute session log (docs-only) — ENGINE.16 execute log
- [`aa3f72d`](https://github.com/zugzwang-foundation/experiment/commit/aa3f72d1117c9421300644a942618b31254aaffb) · [#129](https://github.com/zugzwang-foundation/experiment/pull/129) — docs(engine-10): plan — correctness-at-scale exit gate + SPEC.2 §3 rider — ENGINE.10 plan gate (+ SPEC.2 §3 rider)
- [`96aed40`](https://github.com/zugzwang-foundation/experiment/commit/96aed40419216fe8272d6b8c8495d6a2b5247d95) · [#130](https://github.com/zugzwang-foundation/experiment/pull/130) — chore(engine-10): plan session log (docs-only) — ENGINE.10 plan log
- [`239ecb9`](https://github.com/zugzwang-foundation/experiment/commit/239ecb94983513eaaf931e926ab17fca05618cb7) · [#131](https://github.com/zugzwang-foundation/experiment/pull/131) — feat(engine-10): correctness-at-scale exit-gate harness (tests/scale) — ENGINE.10 — the correctness-at-scale exit gate (tests/scale)
- [`e715882`](https://github.com/zugzwang-foundation/experiment/commit/e7158822b5caf0309413d760e8d049f7571b1ee6) · [#132](https://github.com/zugzwang-foundation/experiment/pull/132) — chore(engine-10): execute session log + build-gate report (docs-only) — ENGINE.10 execute log + build-gate report
- [`7b3c61a`](https://github.com/zugzwang-foundation/experiment/commit/7b3c61aaf33a015126d542d1c0e349e99d64e219) · [#133](https://github.com/zugzwang-foundation/experiment/pull/133) — docs(logs): add consolidated ENGINE-phase record — the consolidated ENGINE-phase record
- [`c6dffa6`](https://github.com/zugzwang-foundation/experiment/commit/c6dffa666b32d750c174e5cc0900fc97ad51719a) · [#134](https://github.com/zugzwang-foundation/experiment/pull/134) — docs(logs): add forward-contract section to ENGINE record — forward-contract section added to the ENGINE record

## B7 — The debate & moderation layer (21 commits)

> **TL;DR for the room:** The product's second thesis pillar: a reply IS a bet
> (Support/Counter, depth 1), sides freeze at post time, ranking is read-time math over
> stake-backed aggregates, and every byte of content passes a fail-closed moderation gate
> BEFORE the write transaction opens. This is EXTAUDIT-04's stratum; the safety-critical
> honesty items (CSAM seam, route-layer gate) are stated plainly below.

*Merge-order footnote:* #159 (the DEBATE.9 close-out) merged **after** the SHELL/UI.0 pair
(#160/#161, told in B9) — the ledger below stays in true `main` order, so you will see
that close-out land "late". Nothing is reordered.

### Reply-as-bet and the frozen side (DEBATE.1–.3)

**#136 — the reply-as-bet write path (INV-1 becomes code).** One write path serves posts
and replies: a reply is a bet whose comment carries `parent_comment_id`. Validation walks
the parent (`src/server/comments/reply-validate.ts`): cross-market or absent →
`ParentCommentNotFoundError`; parent already at depth → `ReplyDepthExceededError` —
`REPLY_DEPTH_MAX = 1`, flat by design (ADR-0017): a reply cannot be replied to, so debate
depth is bounded and every reply's stake meets the *reply floor* (ADR-0018's higher
minimum — the economic lever on reply-spam). Support vs Counter is **not stored**: it is
derived at read time from the reply's side against the parent's frozen side. There is no
standalone vote of any kind — every signal in the debate view costs Dharma.

The schema half is the circular pair from A4, in the flesh
(`src/db/schema/bets.ts:50-52` · `src/db/schema/comments.ts:51-53`):

```ts
// bets.ts — the populated, enforced direction
commentId: uuid("comment_id")
	.notNull()
	.references((): AnyPgColumn => comments.id, { onDelete: "restrict" }),

// comments.ts — the deliberately-nullable back-pointer
sideAtPostTime: sideEnum("side_at_post_time").notNull(),
betId: uuid("bet_id").references((): AnyPgColumn => bets.id, {
```

**#137** closes the image seam in the same stratum: an attached image must sit in a
non-terminal `image_uploads` state, re-asserted with a CAS inside `place()` — no comment
can adopt an orphaned or moderation-blocked upload.

**#139 — DEBATE.3: INV-3 ratified in storage.** `comments` joins Bucket A;
`side_at_post_time` becomes trigger-immutable, and `I-SIDE-BIND-001` pins the product
meaning: sell out, cross sides, re-enter — your old arguments stay attributed to the side
you held when you made them. The debate record cannot be laundered.

### The moderation pipeline (DEBATE.7 — safety-critical)

**#141 — ADR-0021: reactive moderation, no held queue.** The earlier three-option held
queue (ADR-0020, #140) is superseded before it ships: the pre-commit gate returns
block/pass only; everything that passes is live immediately; the admin reviews *live*
content reactively (Remove / Ban). Crucially, **no moderation action ever touches a
position** — money outcomes and content outcomes are decoupled (the #140 decoupling is the
part that survived).

**#143 — the consequence wiring.** The gate's verdicts become durable consequences in
`mod_actions` (Bucket A), split across three tracks (SPEC.1 §2):

| Track | Categories | Consequence | Admin in loop? |
|---|---|---|---|
| **A** | CSAM / sexual-minors / NSFW imagery | block + **auto-ban** | no — automatic |
| **B** | graphic violence, threats, hate, harassment | block + flag for review | yes — reactive (Remove/Ban) |
| **C** | below threshold | posts normally | — |

A ban freezes participation, not money: existing positions ride to resolution (no
confiscation — moderation actions never touch a position, the ADR-0021 rule). The gate
itself (`src/server/moderation/precommit.ts:120-131`) fails closed by contract:

```ts
		let result: Awaited<ReturnType<typeof moderate>>;
		try {
			result = await moderate({ text, imageUrl });
		} catch (err) {
			// … precommit always fails CLOSED as ModerationUnavailableError,
			// regardless of source.
			throw new ModerationUnavailableError(err);
		}
```

Sequencing is the ADR-0014 rule from A3: OpenAI omni-moderation runs **before** the W-1
transaction opens, guarded by a Redis SETNX reservation (no double-spend of a verdict);
a terminal moderation failure is a 503 — the comment never posts, the bet never opens.

Two honesty items your charter already carries (EXTAUDIT-01 §6), restated where they
belong:

- **CSAM handling is a seam, not a shipped pipeline.** OpenAI omni is the *sole* vendor at
  PIN_SHA; a `sexual/minors` + image verdict fires a Sentry `csam_auto_report_pending`
  signal. PhotoDNA/Safer and NCMEC CyberTipline reporting are explicitly parked
  (`docs/parked.md`, "SCAFFOLD.16 §6" entries) — pre-launch register work (§C7). Spec
  prose that says "PhotoDNA + classifier" describes the target, not the build.
- **Non-bypassability is route-layer, not structural.** The only content-persisting route
  calls the gate before the tx, and no other caller of `place()` exists — but nothing at
  the DB layer *forces* moderation. A future in-repo caller could skip it; there is no
  such caller today. (Mandatory commentary, by contrast, IS structural — the schema
  enforces it.)

### Markers, ranking, and the read model (DEBATE.5, .8, .9, .4)

**#152 — DEBATE.5: Flipped/Exited markers.** The read-loader computes, per comment, the
divergence between the author's *current* position and the comment's *frozen* side:
opposite side → **Flipped**; no position → **Exited**; still holding → no marker. This is
INV-3's product payoff — position changes annotate history instead of rewriting it.

**#155 — DEBATE.8: ranking lands as read-time math.** `src/lib/ranking.ts` (pure, 405
lines) + an aggregate query; no projection table, no cached score. The default **Top**
mode is a multi-lane composite — a post leads because it *decisively dominates* traction,
stake, or split by a qualified margin (`src/lib/ranking.ts:119-126`):

```ts
// ── Qualified margin: ratio-to-#2 over an absolute floor (RANKING.md §3.3) ──
// A lane margin is one of three rank CLASSES so the ordering
// `BELOW_FLOOR < any real ratio < SENTINEL_MAX` is total (§3.3)

const RANK_BELOW = 0 as const;
const RANK_REAL = 1 as const;
const RANK_SENTINEL = 2 as const;
```

Every ranking input (support/counter counts, Dharma totals, author stake, age) costs
committed Dharma to generate — there is no free-signal lane to game. The same commit drops
`comments.stake_at_post_time` (migration `0017`) — the ranking model reads live position
data, so the frozen copy was dead weight. **Caveat for your probes:** RANKING.md is
`v1.0.0-draft`; the *shape* is locked, the numeric constants pin at the 2026-09-01 tuning
pass (§C7) — any ranking output you compute today is provisional by declaration.

**#157 — DEBATE.9** deletes the orphaned `friendly_fire_events` table (migration `0018`)
and the F-COMMENT-6/7/8 flows — the last remnants of the pre-ADR-0017 standalone-vote
design. After this commit the schema and the reply-as-bet spec agree everywhere except
the one deliberate gap (A4).

**#163 — DEBATE.4: the debate view.** `loadDebateView` produces a masked, serializable
view-model (removed content renders as a `{ removed: true }` variant carrying no
body/author/stake); `(public)/m/[slug]/page.tsx` renders it server-side. Masking at the
view-model boundary is what the export lane (B11) later inherits for free.

### Ledger — all 21 commits

- [`39c281a`](https://github.com/zugzwang-foundation/experiment/commit/39c281a28e59e83a8162fa18835cdaba902d9379) · [#135](https://github.com/zugzwang-foundation/experiment/pull/135) — plan(DEBATE.2): INV-1 atomicity + reply-as-bet write path (DEBATE.1+.2) — DEBATE.1+.2 plan gate
- [`334d742`](https://github.com/zugzwang-foundation/experiment/commit/334d742b0d4d018e64ff371de0e9d759890972ca) · [#136](https://github.com/zugzwang-foundation/experiment/pull/136) — feat(debate): reply-as-bet write path + INV-1 atomicity (DEBATE.1+.2) — DEBATE.1+.2 — reply-as-bet write path: INV-1 becomes code
- [`b292b36`](https://github.com/zugzwang-foundation/experiment/commit/b292b3615ec13a61eae3e4662349695267dacc44) · [#137](https://github.com/zugzwang-foundation/experiment/pull/137) — fix(comments): image-attach terminal_state guard + place() CAS assertion (DEBATE.2) — DEBATE.2 — image-attach terminal_state guard + place() CAS assertion
- [`233c3e0`](https://github.com/zugzwang-foundation/experiment/commit/233c3e0c5e125ebac39cd786b359434f256ec5b6) · [#138](https://github.com/zugzwang-foundation/experiment/pull/138) — docs(logs): DEBATE.1+.2 execute-session close-out — DEBATE.1+.2 close log
- [`520c388`](https://github.com/zugzwang-foundation/experiment/commit/520c38808a492ba16618cc2674a9d64608638284) · [#139](https://github.com/zugzwang-foundation/experiment/pull/139) — chore(debate): DEBATE.3 — INV-3 side-freeze ratified (comments Bucket-A) + I-SIDE-BIND-001 column assertion — DEBATE.3 — INV-3 side-freeze ratified; comments enter Bucket A
- [`dd698ea`](https://github.com/zugzwang-foundation/experiment/commit/dd698ea21657f3ed9d21ae263ecafaec9bf294eb) · [#140](https://github.com/zugzwang-foundation/experiment/pull/140) — docs(spec): decouple content removal + admin-dashboard IA (ADR-0020, SPEC.1 1.0.6) — ADR-0020 — decoupled content removal (held queue later superseded)
- [`3467acf`](https://github.com/zugzwang-foundation/experiment/commit/3467acf1709edd80e75f435bfd2c0926c490a4a8) · [#141](https://github.com/zugzwang-foundation/experiment/pull/141) — docs: ADR-0021 reactive moderation; SPEC.1/SPEC.2 -> v1.0.7 — ADR-0021 — reactive moderation replaces the held queue
- [`890996d`](https://github.com/zugzwang-foundation/experiment/commit/890996de255e9bf1c0ef19f5a5686e2c872deed0) · [#142](https://github.com/zugzwang-foundation/experiment/pull/142) — docs(debate): DEBATE.7 plan — wire reactive-moderation consequences + mod_actions foundation — DEBATE.7 plan gate
- [`02f87ac`](https://github.com/zugzwang-foundation/experiment/commit/02f87ac49ed75a1c96425d02a20777f1450c362c) · [#143](https://github.com/zugzwang-foundation/experiment/pull/143) — feat(moderation): wire reactive-moderation gate consequences + mod_actions foundation — DEBATE.7 — gate-consequence wiring + the mod_actions foundation
- [`e61a733`](https://github.com/zugzwang-foundation/experiment/commit/e61a733ef27e0e17aca101535869ec983080a4c7) · [#144](https://github.com/zugzwang-foundation/experiment/pull/144) — docs(debate): DEBATE.7 close-out — moderation smoke-test runbook + session log — DEBATE.7 close-out — moderation smoke runbook + log
- [`07f6972`](https://github.com/zugzwang-foundation/experiment/commit/07f697208a24b097a777f772e3b20efb62c81e65) · [#151](https://github.com/zugzwang-foundation/experiment/pull/151) — docs: DEBATE.7 smoke close-out + session doc sweep — DEBATE.7 smoke close-out + doc sweep
- [`0ab5f4b`](https://github.com/zugzwang-foundation/experiment/commit/0ab5f4b088da0175472dd45004b0598899cf6c79) · [#152](https://github.com/zugzwang-foundation/experiment/pull/152) — feat(debate-view): DEBATE.5 — three-state Flipped/Exited marker read-loader — DEBATE.5 — Flipped/Exited marker read-loader
- [`36d7806`](https://github.com/zugzwang-foundation/experiment/commit/36d780665c0895c1053b35b92958d66fefc6d421) · [#153](https://github.com/zugzwang-foundation/experiment/pull/153) — chore(debate): session log — DEBATE.5 — DEBATE.5 session log
- [`bed52b8`](https://github.com/zugzwang-foundation/experiment/commit/bed52b846399cbb64c4771737520eb42d760d338) · [#154](https://github.com/zugzwang-foundation/experiment/pull/154) — docs(ranking): DEBATE.8 — author RANKING.md + reconcile SPEC.1/SPEC.2/ADR-0017/CLAUDE/AGENTS to the ratified model — DEBATE.8 — RANKING.md authored; canon reconciled to the ratified model
- [`193f1c2`](https://github.com/zugzwang-foundation/experiment/commit/193f1c2f4a705e0715aa7b0cc1b023c02aea1eea) · [#155](https://github.com/zugzwang-foundation/experiment/pull/155) — feat(ranking): DEBATE.8 — read-time ranking model (ranking.ts + aggregate query) + drop stake_at_post_time — DEBATE.8 — read-time ranking lands; stake_at_post_time dropped (0017)
- [`c70face`](https://github.com/zugzwang-foundation/experiment/commit/c70facee6271efc2e87ea16713e60adafa4630eb) · [#156](https://github.com/zugzwang-foundation/experiment/pull/156) — chore(debate): session log — DEBATE.8 — DEBATE.8 session log
- [`c5b0410`](https://github.com/zugzwang-foundation/experiment/commit/c5b0410a5eb46c36108fae5c124b7d5dc8d0f73d) · [#157](https://github.com/zugzwang-foundation/experiment/pull/157) — chore(debate): DEBATE.9 — drop orphaned friendly_fire_events schema (migration 0018) + strip refs + delete F-COMMENT-6/7/8 + doc truth-up — DEBATE.9 — friendly_fire_events dropped (0018); F-COMMENT-6/7/8 deleted
- [`9332562`](https://github.com/zugzwang-foundation/experiment/commit/9332562ae70f1f148f82298829d2c5da27c19f4e) · [#158](https://github.com/zugzwang-foundation/experiment/pull/158) — chore(debate): session log — DEBATE.9 — DEBATE.9 session log
- [`6da061d`](https://github.com/zugzwang-foundation/experiment/commit/6da061dc7caa59cd9e88c694d17b85997a4cda55) · [#159](https://github.com/zugzwang-foundation/experiment/pull/159) — docs(debate): DEBATE.9 close-out — §D framing fixes + session-log close-out — DEBATE.9 close-out (merged after #160/#161 — see the chapter footnote)
- [`1db9df2`](https://github.com/zugzwang-foundation/experiment/commit/1db9df226ecb86bc0f477d984a70d2752e057cce) · [#162](https://github.com/zugzwang-foundation/experiment/pull/162) — docs(plan): DEBATE.4 — participant debate view (read-only render) plan — DEBATE.4 plan gate
- [`4d83231`](https://github.com/zugzwang-foundation/experiment/commit/4d8323171e2cc4d085852d671e540c5dda3d12e8) · [#163](https://github.com/zugzwang-foundation/experiment/pull/163) — feat(debate-view): DEBATE.4 — participant debate view (read-only render) — DEBATE.4 — the participant debate view (read-only render)

## B8 — Auth hardening (3 commits)

> **TL;DR for the room:** Three vendor-reality fixes, two of them the classic "worked in
> the mock, failed against the real vendor" class: email-OTP short-circuited by a captcha
> hook, custom signup fields silently stripped, and a session-cookie ceiling that 500'd
> returning users. All three are FIX-AUTH interleaves told here with their merge positions
> preserved.

*Merge-order footnote:* these three PRs merged interleaved with DEBATE work (#147 between
#145 and #149's era on `main`) — grouped here as one story, positions untouched in the
ledger below.

**#149 — the silent-strip signup bug.** Better Auth's drizzle adapter persists only fields
declared in its user model: the identity hook was writing `pseudonym`/`pfpFilename`/
`googleId`, the adapter stripped them pre-INSERT, and signup died as a NOT-NULL `23502`
(surfacing as `unable_to_create_user`). Fix: declare them in `user.additionalFields` with
`input:false` — which also blocks client-side identity spoofing at the parse layer.
Vendor lesson now pinned in AGENTS.md §7.

**#150 — the 400-day cookie cap.** `session.expiresIn` feeds the session-cookie `Max-Age`
directly, and the cookie serializer throws above 34,560,000s (400 days) — at
*serialization time on sign-in*, so first-time signup (deferred by the onboarding gate)
masked it while every *returning* user 500'd. Fix: cap at 400 days (browsers clamp there
anyway). Both fixes carry `_probe-*` vendor-contract regression tests so an upgrade that
changes the behaviour fails loudly.

### Ledger — 3 commits

- [`c7deba5`](https://github.com/zugzwang-foundation/experiment/commit/c7deba5243f60ac452432c0fa7a470c1690f30d7) · [#147](https://github.com/zugzwang-foundation/experiment/pull/147) — fix(auth): email-OTP send no longer short-circuited by Turnstile before-hook (AUTH-OTP-GATE) — email-OTP send un-blocked from the Turnstile before-hook
- [`52ed64d`](https://github.com/zugzwang-foundation/experiment/commit/52ed64d96808135cdcddc09b80e0f974920c926e) · [#149](https://github.com/zugzwang-foundation/experiment/pull/149) — fix(auth): declare user.additionalFields so signup persists pseudonym/pfp/googleId — additionalFields declared — the silent-strip signup bug dies
- [`3f82371`](https://github.com/zugzwang-foundation/experiment/commit/3f82371577dbf8b27ad3320b871f51a48d21404b) · [#150](https://github.com/zugzwang-foundation/experiment/pull/150) — fix(auth): cap session expiresIn at 400 days (cookie Max-Age limit) — session expiresIn capped at 400 days (cookie Max-Age ceiling)

## B9 — Participant shell (3 commits — out-of-scope pointer)

> **TL;DR for the room:** The only shipped participant UI: a server-component shell, the
> monochrome design-token mint, and `/m/[slug]` rendering the debate view read-only. UI
> build-out is post-handover roadmap (§C7). Backend reviewers can treat this as a thin
> consumer of `loadDebateView` and move on.

UI.6 (#145) came first on `main`: the read-only **admin** moderation audit viewer
(F-ADMIN-5) — an admin page, but told here with the UI lane. SHELL/UI.0 (#160/#161) then
bootstrapped the `(public)/` route group: placeholder shell layout, the DESIGN.7 monochrome
token mint (OKLCH grey ramp; YES = black pole, NO = white pole), and the `/m/[slug]`
scaffold over `getMarketBySlug` (Draft excluded). Interactive surfaces (bet composer,
reply forms, market list) are the UI lane in §C7's roadmap.

### Ledger — 3 commits

- [`1a18fd5`](https://github.com/zugzwang-foundation/experiment/commit/1a18fd548bd19e1ca532ab4fa883ad48ddf86031) · [#145](https://github.com/zugzwang-foundation/experiment/pull/145) — feat(admin): read-only moderation audit viewer (UI.6 / F-ADMIN-5) — UI.6 — read-only admin moderation audit viewer (F-ADMIN-5)
- [`55c3cb5`](https://github.com/zugzwang-foundation/experiment/commit/55c3cb57070a2264ff389a6af8f2aaf0c85a71dd) · [#160](https://github.com/zugzwang-foundation/experiment/pull/160) — docs(plan): SHELL/UI.0 — participant shell bootstrap + DESIGN.7 token mint plan — SHELL/UI.0 plan gate (+ DESIGN.7 token-mint plan)
- [`e067c16`](https://github.com/zugzwang-foundation/experiment/commit/e067c1654b4e5b739a2c5caa2fa81cdd270fe780) · [#161](https://github.com/zugzwang-foundation/experiment/pull/161) — feat(ui): SHELL/UI.0 — participant shell + DESIGN.7 token mint + /m/[slug] — SHELL/UI.0 — participant shell + monochrome token mint + /m/[slug]

## B10 — The deploy arc (17 commits)

> **TL;DR for the room:** The pipeline earns its rules the hard way: a health endpoint that
> refuses to trust migration exit codes, staging rebuilt as a prod replica, CI promoted to
> a required check, the first gated promote — and one real prod-drift incident that
> vindicated the whole design. The operative doctrine: **migrate-before-serve, and the
> per-hash `/api/health` gauge is the only promote authority.**

The arc runs ADR-0022 → ADR-0024 → D1–D6 → incident. One interlude (#178, the post-deploy
harness/model reconcile) is absorbed here.

**#148 — ADR-0022: the first prod migration strategy.** Per-migration-transaction
`db:migrate:prod`, an env-fragment guard (the script refuses to run unless the DB URL
matches the intended project ref), and the first drift check. Partially superseded by
ADR-0024, but its core survives: migrations are applied deliberately, never as a deploy
side-effect.

**#164 — ADR-0024: the pipeline decision.** Staging-as-prod-replica; a `staging` branch
that auto-deploys + auto-migrates; production behind a **manual, gated promote**; two
Supabase projects; per-hash drift detection on `/api/health`. SPEC.2 §22 is caught up in
the same commit (same-commit doctrine, A6).

**#165 — D1: the gauge.** `/api/health` gains the per-hash migration-drift field
(`src/server/health/migration-drift.ts`): the sha256 multiset of committed migration files
compared against `drizzle.__drizzle_migrations` — `ok` / `drift` / `error`. The reason it
exists is drizzle-orm issue #5769: `drizzle-kit migrate` can exit `0` with a migration
silently skipped, so **exit codes are not promote evidence; the serving deployment's own
hash comparison is.**

**#167 — D2: CI becomes a required check.** Branch protection now requires the `ci` status
(squash + signed commits were already server-enforced); CI itself gains `drizzle-kit
check` (journal integrity) and `db:check-drift`. The scheduled `env-audit.yml`
(Doppler↔Vercel parity) and an inert `staging-migrate.yml` land alongside — armed at D3.

**#170 — D3: staging un-shadowed.** The `staging` branch becomes a true replica lane: push
→ GitHub Actions applies migrations to the staging Supabase (Doppler `stg` config) while
Vercel auto-deploys `staging.zugzwangworld.com`. Production auto-serve is switched **OFF**
(`autoAssignCustomDomains` disabled) — from this commit on, a `main` merge only *stages* a
prod build; nothing serves until promoted.

**#176 — D6: the gated promote goes live.** The runbook §3 banner flips to ACTIVE with the
first real promote (SHA `61abb04`, 2026-06-28): merge → staged build → migrate prod DB →
curl the *staged* build's `/api/health` until `migrations:"ok"` → `vercel promote --scope
<team>` → post-promote health on the domain. Two operational gotchas are pinned in
CLAUDE.md from this arc: `vercel promote` without `--scope` errors or hits the wrong
project, and health-not-exit-codes (above).

**#194 — the incident that proved it.** Migration `0019` reached `main` while prod was
serving an older build; the prod DB briefly sat behind the journal — caught by exactly the
drift gauge D1 built, remediated by the D5 verify-before-serve path, and written down as
an incident log with a runbook fix. C1 presents today's staging/prod divergence through
this same lens: the pipeline *working as designed*, holding prod back until the gate is
run (DP.2, §C7).

### Ledger — all 17 commits

- [`bdb4e71`](https://github.com/zugzwang-foundation/experiment/commit/bdb4e71cbec97ea2152229c6c7c2914661d342ab) · [#148](https://github.com/zugzwang-foundation/experiment/pull/148) — feat(ops): prod migrate path (per-migration-tx) + schema-drift guard + staging runbook — ADR-0022 — per-migration-tx prod migrate path + drift guard
- [`68de89a`](https://github.com/zugzwang-foundation/experiment/commit/68de89a0accf76d5f90ae166e53a2b840d340710) · [#164](https://github.com/zugzwang-foundation/experiment/pull/164) — ADR-0024 — deploy pipeline + migration sequencing (+ SPEC.2 §22 catch-up, D1 plan) — ADR-0024 — the deploy pipeline decision (staging-as-prod-replica)
- [`c509d75`](https://github.com/zugzwang-foundation/experiment/commit/c509d75a444221888fcd3be5064f52530b207453) · [#165](https://github.com/zugzwang-foundation/experiment/pull/165) — fix(health): D1 #2/#3 — per-hash migration drift on /api/health + prepare:false — D1 — per-hash migration drift lands on /api/health
- [`34bf50c`](https://github.com/zugzwang-foundation/experiment/commit/34bf50cebfc6240437dd155246c6f2657e5968ae) · [#166](https://github.com/zugzwang-foundation/experiment/pull/166) — docs(adr): ADR-0024 errata + D1.md §3 addendum — D1 close (executed mechanism + recon premise corrections) — D1 close — ADR-0024 errata + addendum
- [`d4a07e2`](https://github.com/zugzwang-foundation/experiment/commit/d4a07e24658c5523d2cd3ec1d4b2baa4f037fd5c) · [#167](https://github.com/zugzwang-foundation/experiment/pull/167) — feat(ci): D2 — CI required-check gate + journal/drift checks + env-parity audit + inert staging-migrate — D2 — ci promoted to a required check; journal/drift gates + env-parity audit
- [`9bbf785`](https://github.com/zugzwang-foundation/experiment/commit/9bbf785a107e9a1c627ccf239be9284133157988) · [#168](https://github.com/zugzwang-foundation/experiment/pull/168) — fix(ci): D2 env-audit descope — drop sync-health (c)+(d); two config-scoped Doppler tokens — D2 env-audit descope (two config-scoped Doppler tokens)
- [`2ffd929`](https://github.com/zugzwang-foundation/experiment/commit/2ffd929c4ea2f7d87a4feeceae9d205bd7cc3a8b) · [#169](https://github.com/zugzwang-foundation/experiment/pull/169) — fix(ci): D2 env-audit — exempt 3 Sentry↔Vercel integration keys (intentional-manual membership) — D2 env-audit — 3 Sentry↔Vercel keys exempted
- [`41311bc`](https://github.com/zugzwang-foundation/experiment/commit/41311bc9ceac494d01abd9b2458774f856e46cd6) · [#170](https://github.com/zugzwang-foundation/experiment/pull/170) — docs(deploy): D3 — staging-as-replica pipeline (plan + deploy-pipeline runbook) — D3 — staging-as-replica pipeline un-shadowed (runbook)
- [`9ccdcde`](https://github.com/zugzwang-foundation/experiment/commit/9ccdcded8e3c66f7113713d05234ba49e131c322) · [#171](https://github.com/zugzwang-foundation/experiment/pull/171) — chore(deploy): log session — D3 staging-as-replica un-shadowing EXECUTED — D3 execute log
- [`fc1870c`](https://github.com/zugzwang-foundation/experiment/commit/fc1870ce0ace3f8a90d9412dc7b79e4d31030a4f) · [#172](https://github.com/zugzwang-foundation/experiment/pull/172) — docs(deploy): fold web-authored prod-promote section into deploy-pipeline runbook — web-authored prod-promote section folded into the runbook
- [`48ac08c`](https://github.com/zugzwang-foundation/experiment/commit/48ac08cca7a643e7340361ba8adede3e5f72ee97) · [#173](https://github.com/zugzwang-foundation/experiment/pull/173) — chore(deploy): fix stale bare-SHA canary assertions in smoke-staging + sibling drifts — stale bare-SHA canary assertions fixed in smoke-staging
- [`ba484f0`](https://github.com/zugzwang-foundation/experiment/commit/ba484f05a18470e364d5bbc96bc713f13d99576b) · [#174](https://github.com/zugzwang-foundation/experiment/pull/174) — chore(deploy): log session — D3 OD-1 stale-canary chore MERGED (#173) — D3 OD-1 close log
- [`41b2190`](https://github.com/zugzwang-foundation/experiment/commit/41b2190833df2731398138a9b2a7eddfaf6f8aba) · [#175](https://github.com/zugzwang-foundation/experiment/pull/175) — docs(plan): D5 ratified — prod-DB drift remediation + verify-before-serve gate — D5 ratified — prod-DB drift remediation + verify-before-serve gate
- [`61abb04`](https://github.com/zugzwang-foundation/experiment/commit/61abb0485e5ec7b251426932704aabd09f367abf) · [#176](https://github.com/zugzwang-foundation/experiment/pull/176) — docs(deploy): activate prod-promote runbook §3 banner (D6) — D6 — the prod-promote runbook §3 banner goes ACTIVE
- [`a9a0d45`](https://github.com/zugzwang-foundation/experiment/commit/a9a0d450e83c92da82facb7669e302dff53c8fe7) · [#177](https://github.com/zugzwang-foundation/experiment/pull/177) — chore(deploy): log session — D5 prod migrate + first gated promote (#176 → prod) — D5 log — prod migrated + the first gated promote
- [`b724094`](https://github.com/zugzwang-foundation/experiment/commit/b724094533f8960f7236c8d5c5c69dc77ecba6e5) · [#178](https://github.com/zugzwang-foundation/experiment/pull/178) — docs: reconcile pipeline-workflow + CC model contract (Fable→Opus) after D1–D6 — post-D6 reconcile — pipeline workflow + CC model contract (Fable→Opus)
- [`7d2bd75`](https://github.com/zugzwang-foundation/experiment/commit/7d2bd751885475e880931485e9304e76fedc3107) · [#194](https://github.com/zugzwang-foundation/experiment/pull/194) — chore(docs): incident log — prod migration drift (0019) + runbook §0 head fix — the prod-drift incident (0019) written down + runbook head fix

## B11 — Export & media (8 commits)

> **TL;DR for the room:** Two participant-facing capabilities, both spec-first: a
> read-only debate `.md` export that can never leak moderated content (it serializes the
> already-masked view-model), and an admin-only market-media pool with a third R2 bucket —
> including the one routing rule every future admin endpoint must obey.

**#180 — EXPORT.1 (ADR-0025).** `GET /m/[slug]/export` renders the debate as a single
text-only `.md`, on demand, read-only. The safety property is inherited, not re-implemented:
serialization consumes `loadDebateView`'s masked variants, so a moderator-removed argument
*cannot* serialize — the removed union variant carries no body, title, author or stake to
leak. Every renderer falls through the same way
(`src/server/debate-export/serialize.ts:182-195`):

```ts
function topArgumentSentence(
	model: DebateViewModel,
	side: "YES" | "NO",
): string {
	const onSide = model.posts.filter((p) => p.sideAtPostTime === side);
	if (onSide.length === 0) {
		return `No ${side} argument has been posted yet.`;
	}
	const top = onSide.find((p): p is NonRemovedPost => !p.removed);
	if (top === undefined) {
		return `The leading ${side} argument was removed by a moderator.`;
	}
	return `The most heavily backed ${side} argument is "${top.title}" …`;
}
```

A version-pinned `zugzwang.md` context block is prepended so an exported debate carries
its own reading rules — the export is designed to be handed to an LLM or an archivist
whole, with provenance intact.

**#184 — MEDIA.1 (ADR-0026/0027).** Admin-curated per-market media: a `market_media` pool
table (Bucket C, deliberately no `user_id`), a third R2 bucket arm (`m/<marketId>/`),
comments referencing pool assets via `comments.market_media_id` with a not-both-set CHECK
against direct uploads, and `markets.media_video_url` as an outbound YouTube link
(new-tab, never embedded). Admin direct upload is unmoderated by decision (ADR-0027 — the
uploader is the moderator); the participant *pick* path serves only pre-vetted assets.
Migration `0019` — the last migration prod has applied at the C1 probes, as it happens.
The stratum also minted a load-bearing routing rule (via a security-audit catch): the
media-sign endpoint planned at `/api/admin/...` had to live at `/admin/markets/media/sign`
because the admin cookie is scoped `Path=/admin` — an `/api/admin/` handler would 401 the
real admin while unit mocks hid it (now the A5 routing rule + an AGENTS.md pattern).

### Ledger — all 8 commits

- [`d728293`](https://github.com/zugzwang-foundation/experiment/commit/d728293109b082c69a44a522ce8cb7002e7a8be2) · [#179](https://github.com/zugzwang-foundation/experiment/pull/179) — docs(spec): debate .md export (ADR-0025) + §21.6 descope — ADR-0025 — debate .md export decided (+ §21.6 descope)
- [`93cdd6b`](https://github.com/zugzwang-foundation/experiment/commit/93cdd6b15ff33a50b38cb98313258076e91956db) · [#180](https://github.com/zugzwang-foundation/experiment/pull/180) — feat(debate-export): GET /m/[slug]/export — debate .md export (EXPORT.1) — EXPORT.1 — GET /m/[slug]/export ships (masking inherited)
- [`af4a909`](https://github.com/zugzwang-foundation/experiment/commit/af4a9090a39426cf6a936885a995215bf71302c9) · [#181](https://github.com/zugzwang-foundation/experiment/pull/181) — chore(export): log session — EXPORT.1 debate .md export build (PR #180) — EXPORT.1 close log
- [`4819352`](https://github.com/zugzwang-foundation/experiment/commit/4819352791b80a0b3285ac1c7e71fe1c2c3adab0) · [#182](https://github.com/zugzwang-foundation/experiment/pull/182) — docs: ADR-0026 market media + SPEC.1/SPEC.2 riders — ADR-0026 — market media decided + SPEC riders
- [`f8f4fe9`](https://github.com/zugzwang-foundation/experiment/commit/f8f4fe9bd02a863aeed6af849751a33f4cc824d6) · [#183](https://github.com/zugzwang-foundation/experiment/pull/183) — docs: ADR-0026 close-out + CLAUDE/AGENTS ADR-ceiling -> 0026 — ADR-0026 close-out (ceiling → 0026)
- [`a08fc46`](https://github.com/zugzwang-foundation/experiment/commit/a08fc464c551275c98fe275bf8b2c79ea66d5200) · [#184](https://github.com/zugzwang-foundation/experiment/pull/184) — feat(markets): MEDIA.1 — admin market-media creation (ADR-0026/0027) — MEDIA.1 — admin market-media creation (ADR-0026/0027)
- [`3f325be`](https://github.com/zugzwang-foundation/experiment/commit/3f325be1812a5c9287c96a553eb3177c4e4fe778) · [#185](https://github.com/zugzwang-foundation/experiment/pull/185) — docs: MEDIA.1 footprint into canon (market_id_conflict, admin-media rate-limit surface, real route, admin-route-path rule) — MEDIA.1 canon footprint (incl. the /admin route-path rule)
- [`248e02f`](https://github.com/zugzwang-foundation/experiment/commit/248e02fa0e594daa76744f2f272c4f3ea2ead230) · [#186](https://github.com/zugzwang-foundation/experiment/pull/186) — chore: MEDIA.1 close-out + ADR ceiling → 0027 — MEDIA.1 close-out (ceiling → 0027)

## B12 — Descriptive-canon reconciliation (7 commits)

> **TL;DR for the room:** A four-task arc with one job: make the documents describe the
> repo that exists. One real code change fell out (dead rate-limiter removal); one task
> concluded "premise not held" and shipped only its write-up — which is the discipline
> working, not failing.

BC.1 (#187) reconciles the descriptive docs (AGENTS.md et al.) to `main`; BC.2 (#189/#190)
does the prescriptive specs and leaves a drift ledger; BC.3 (#191) is the arc's one code
diff — removing vestigial write-budget/write-burst limiters that documentation claimed and
code no longer used; BC.4 (#193) investigated a suspected drift, found the premise false,
and landed a no-op-with-writeup. The BC pattern (verify live, fix docs, log the delta) is
the same one the SYNC-SWEEP (B14) and this deck follow.

### Ledger — 7 commits

- [`3979ccb`](https://github.com/zugzwang-foundation/experiment/commit/3979ccb24d4015417bca7d8df128beb3741fd45c) · [#187](https://github.com/zugzwang-foundation/experiment/pull/187) — docs: BC.1 — reconcile descriptive docs to main — BC.1 — descriptive docs reconciled to main
- [`9aed84b`](https://github.com/zugzwang-foundation/experiment/commit/9aed84b9e205e6d8b6509e7433c022268314352b) · [#188](https://github.com/zugzwang-foundation/experiment/pull/188) — chore(docs): log session — BC.1 close-out (PR #187 squash 3979ccb) — BC.1 close log
- [`abf0d79`](https://github.com/zugzwang-foundation/experiment/commit/abf0d79ed5cd2bad94cdecb544f6095aa73b261f) · [#189](https://github.com/zugzwang-foundation/experiment/pull/189) — docs: BC.2 — reconcile prescriptive specs + drift ledger — BC.2 — prescriptive specs reconciled + drift ledger
- [`f0a033e`](https://github.com/zugzwang-foundation/experiment/commit/f0a033e56c396bd9bbd5544b1481f56ee2c8dbf0) · [#190](https://github.com/zugzwang-foundation/experiment/pull/190) — docs: BC.2.1 — finish §22 ADR-index range (0001, 0003–0027) — BC.2.1 — §22 ADR-index range finished
- [`b6e1aea`](https://github.com/zugzwang-foundation/experiment/commit/b6e1aea1152966dd202a4c7871289a3483a7a7f3) · [#191](https://github.com/zugzwang-foundation/experiment/pull/191) — refactor(rate-limit): remove vestigial write-budget/write-burst limiters (BC.3) — BC.3 — vestigial write-budget limiters removed
- [`096189c`](https://github.com/zugzwang-foundation/experiment/commit/096189c7bb6055b830744344875f7476a8677881) · [#192](https://github.com/zugzwang-foundation/experiment/pull/192) — chore(docs): log session — BC.3 close-out (PR #191 squash b6e1aea) — BC.3 close log
- [`a61859a`](https://github.com/zugzwang-foundation/experiment/commit/a61859ae92362d20fab27174bf8c842b555505bb) · [#193](https://github.com/zugzwang-foundation/experiment/pull/193) — chore(docs): log session — BC.4 close-out (no-op-with-writeup; premise not held) — BC.4 — no-op-with-writeup (premise not held)

## B13 — The internal audit campaign (20 commits)

> **TL;DR for the room:** Before asking you to audit it, the project audited itself:
> twenty PRs across ~six weeks remediating findings from an internal review campaign —
> byte-identity binding for moderated images, a total-ordered ledger, TRUNCATE guards,
> durable idempotency receipts, oversell rejection, fail-open belts closed. Your charter's
> "known state" list (EXTAUDIT-01 §6) is largely this chapter's output. Ledger lines
> below; five dives where the schema or the money path changed.

The campaign ran as `AUDIT-FIX-A*` (single findings) and `AUDIT-FIX-B*` (bundles), each
with the full plan→execute→log ritual. Everything here is *hardening of existing
invariant surfaces* — no new product capability landed in this chapter.

**#197 — byte-identity binding (ADR-0028).** The bytes OpenAI moderated are provably the
bytes served: HeadObject verification before moderation + write-once arming at sign time.
Closes the swap-after-moderation window on image uploads.

**#201 — ledger total order + TRUNCATE (ADR-0029/0030).** `dharma_ledger.seq` gives the
ledger a total order independent of timestamps (migration `0020`); statement-level
`BEFORE TRUNCATE` guards extend Bucket-A protection to the one verb row triggers miss
(migration `0021`). After this, the append-only story has no asterisks.

**#202 — durable idempotency + oversell (ADR-0031).** The `bet_receipts` table (Bucket A,
migration `0022`): a UNIQUE `idempotency_key` receipt written as the *last* statement of
the W-1 transaction, making replay-once durable across crash, Redis flush, or cache-window
expiry — the Redis layer becomes a fast path, not a correctness dependency
(`I-IDEM-ONCE-001`). The same PR turns sell-path oversell into a clean product `400`
(`I-NO-OVERSELL-001` backstop) and guards the reserve-release path so a failed release
can never fail open.

**#205 — the gate leaves a trace.** A blocked comment now emits `moderation.blocked`
(EVENT_TYPES value #24 — the one that post-dates the internal docs' "23"), with an
event-id-reuse payload guard implemented as a fused data-modifying CTE — the observability
read rides the INSERT statement itself, because a separate post-`ON CONFLICT` SELECT
can abort an otherwise-committable transaction.

**#213 + #216 — the long tail.** #213 normalizes the §4.4 wire envelope onto the two
presign routes and adds the `positions(market_id)` index (migration `0023` — the current
head, W-3's settle-read path). #216 lands the web-authored spec riders and bumps
**cpmm.md to 2.0.0** — the math spec your EXTAUDIT-03 predates by three days; the
differential-harness task is unaffected (the §13 surface is unchanged; the riders are
documentation-lane).

For everything else the one-line ledger suffices — the finding-by-finding detail is
already in your package's known-state appendix, and re-verifying those closures is
precisely your §6 charter instruction.

### Ledger — all 20 commits

- [`4350406`](https://github.com/zugzwang-foundation/experiment/commit/4350406be80317b1b4139fce5200dffd9f194862) · [#197](https://github.com/zugzwang-foundation/experiment/pull/197) — fix(moderation): AUDIT-FIX-A1 — moderated-image byte-identity binding (+A10) — AUDIT-FIX-A1 — moderated-image byte-identity binding (ADR-0028)
- [`f4416e7`](https://github.com/zugzwang-foundation/experiment/commit/f4416e743ef5ba2672ec47f9f885e601f2811180) · [#198](https://github.com/zugzwang-foundation/experiment/pull/198) — chore(docs): log session — AUDIT-FIX-A1 close-out (PR #197 squash 4350406) — A1 close log
- [`72ce26c`](https://github.com/zugzwang-foundation/experiment/commit/72ce26c3423d50f9dff4f67a1c42e849fe3fb683) · [#199](https://github.com/zugzwang-foundation/experiment/pull/199) — fix(observability): AUDIT-FIX-B1 — finish SCAFFOLD.5 (A5, A6, A7, A17, A18-DSN) — AUDIT-FIX-B1 — SCAFFOLD.5 observability finished (A5–A7, A17, A18)
- [`912a244`](https://github.com/zugzwang-foundation/experiment/commit/912a244a2b645dac3d3625c9cbe8a0674403ed58) · [#200](https://github.com/zugzwang-foundation/experiment/pull/200) — chore(docs): parked — next SYNC sweep owes A1+B1 spec/ADR-index/footer reconciliation (4 targets) — parked note — SYNC sweep owes the A1+B1 reconciliation
- [`7fc4c60`](https://github.com/zugzwang-foundation/experiment/commit/7fc4c60fc3fcb8f1517f26101a16c663c2be6a7e) · [#201](https://github.com/zugzwang-foundation/experiment/pull/201) — fix(dharma): AUDIT-FIX-B2 — ledger total order (A2 seq) + TRUNCATE guard (A20) — AUDIT-FIX-B2 — ledger total order (seq, ADR-0029) + TRUNCATE guards (ADR-0030)
- [`6244dce`](https://github.com/zugzwang-foundation/experiment/commit/6244dce332c652e0d063013036ec55b1bb2142cc) · [#202](https://github.com/zugzwang-foundation/experiment/pull/202) — fix(bets): AUDIT-FIX-B3 — oversell 400 (A3) + guarded release (A4) + durable idempotency receipts (A9) — AUDIT-FIX-B3 — oversell 400 + guarded release + durable receipts (ADR-0031)
- [`e3f0569`](https://github.com/zugzwang-foundation/experiment/commit/e3f05694aae2704a29911543f9cbf5f4dbe043f6) · [#203](https://github.com/zugzwang-foundation/experiment/pull/203) — fix(moderation): AUDIT-FIX-A21 — verdict-mapper fail-open belt (flagged-with-no-mapped-category → 503) — AUDIT-FIX-A21 — verdict-mapper fail-open belt closed
- [`77943dc`](https://github.com/zugzwang-foundation/experiment/commit/77943dc3502cdd489afe76802cdbca62080b4ccc) · [#204](https://github.com/zugzwang-foundation/experiment/pull/204) — chore(docs): log session — AUDIT-FIX-A21 close-out (PR #203 squash e3f0569) — A21 close log
- [`01a9d0c`](https://github.com/zugzwang-foundation/experiment/commit/01a9d0c63468d6aa062ffbf62642c007d4707947) · [#205](https://github.com/zugzwang-foundation/experiment/pull/205) — fix(moderation): AUDIT-FIX-B5 — moderation.blocked event emit (A13) + event-id-reuse payload guard (A30) — AUDIT-FIX-B5 — moderation.blocked emit + the fused-CTE payload guard
- [`edff5ff`](https://github.com/zugzwang-foundation/experiment/commit/edff5ff39c50a735f89a3acaa864c3b131e86d6d) · [#206](https://github.com/zugzwang-foundation/experiment/pull/206) — chore(events): log session — AUDIT-FIX-B5 close-out (#205 squash 01a9d0c) + A30 PII key-name future-work guard comment — B5 close log (+ PII key-name guard comment)
- [`b15a7f5`](https://github.com/zugzwang-foundation/experiment/commit/b15a7f530cccf5f4c4f93c8fc7d73dcccb052d54) · [#207](https://github.com/zugzwang-foundation/experiment/pull/207) — fix(auth): AUDIT-FIX-A22 — signup/sign-in event completeness (§8.8) + §3.5 spec-vs-built reconciliation — AUDIT-FIX-A22 — signup/sign-in event completeness (§8.8)
- [`c3e42e9`](https://github.com/zugzwang-foundation/experiment/commit/c3e42e9fec5c5daa217731c1315550fd105214fd) · [#208](https://github.com/zugzwang-foundation/experiment/pull/208) — chore(auth): log session — AUDIT-FIX-A22 close-out (PR #207 squash b15a7f5) + FU-1/FU-2 parked + AGENTS.md phantom-identity greenfield fix — A22 close log (+ FU-1/FU-2 parked)
- [`ae489a6`](https://github.com/zugzwang-foundation/experiment/commit/ae489a6eac15328deb66f77607f4311f146180cb) · [#209](https://github.com/zugzwang-foundation/experiment/pull/209) — docs(specs): AUDIT-FIX-B7 — A26 freeze accepted-window ruling (§20.2 insert + §19.1/§19.2 build-point riders) — AUDIT-FIX-B7-A26 — freeze accepted-window ruling into SPEC.1
- [`2853835`](https://github.com/zugzwang-foundation/experiment/commit/2853835022184bb584d5dedbba27fe88a1f2969c) · [#210](https://github.com/zugzwang-foundation/experiment/pull/210) — chore(docs): log session — AUDIT-FIX-B7-A26 close-out (PR #209 squash ae489a6) + dataset-release.md freeze-code drift fix — B7-A26 close log
- [`7dabdc9`](https://github.com/zugzwang-foundation/experiment/commit/7dabdc90efff5137a55dae41f259927fb40c77fe) · [#211](https://github.com/zugzwang-foundation/experiment/pull/211) — fix(bets): AUDIT-FIX-B7a — Upstash transport bounding (A14) + whitespace comment semantics (A24) — AUDIT-FIX-B7a — Upstash transport bounding + whitespace semantics
- [`8ef34d4`](https://github.com/zugzwang-foundation/experiment/commit/8ef34d49fc554fed0a3207b96ab30ee9210d8e94) · [#212](https://github.com/zugzwang-foundation/experiment/pull/212) — chore(bets): log session — AUDIT-FIX-B7a close-out (PR #211 squash 7dabdc9) + parked.md sweep extensions + AGENTS.md §9 drift fix — B7a close log (+ AGENTS.md §9 drift fix)
- [`a66d359`](https://github.com/zugzwang-foundation/experiment/commit/a66d359ee30f8c79daa381df18e336c46ec00c0a) · [#213](https://github.com/zugzwang-foundation/experiment/pull/213) — fix(storage): AUDIT-FIX-B7b — A29 §4.4 envelope on the two sign routes + A31 positions index + A32/A33/A35 — AUDIT-FIX-B7b — §4.4 envelope on the sign routes + positions index
- [`ef62d73`](https://github.com/zugzwang-foundation/experiment/commit/ef62d73bd0f3a8b9bb9db30bb17048c86da94eed) · [#214](https://github.com/zugzwang-foundation/experiment/pull/214) — chore(storage): log session — AUDIT-FIX-B7b close-out (PR #213 squash a66d359) + parked.md XFF entry — B7b close log (+ parked XFF entry)
- [`1258147`](https://github.com/zugzwang-foundation/experiment/commit/125814739474d2fd0a2b3dee05390230596debdf) · [#215](https://github.com/zugzwang-foundation/experiment/pull/215) — chore(docs): log session — AUDIT-INV-A12 close-out (A12 = G3) + parked.md XFF site-count fix — AUDIT-INV-A12 close-out (A12 = G3)
- [`f0be380`](https://github.com/zugzwang-foundation/experiment/commit/f0be3803c2a3afd511f84ab07cf8cdbfb7817cb0) · [#216](https://github.com/zugzwang-foundation/experiment/pull/216) — docs(specs): AUDIT-FIX-B8 — web-authored riders D1–D4 + §16.3⇄§17.6/A17 reconciliation (cpmm.md → 2.0.0) — AUDIT-FIX-B8 — web riders D1–D4 + cpmm.md → 2.0.0

## B14 — Deploy-proof & sweep close-out (3 commits)

> **TL;DR for the room:** The final three commits before PIN_SHA: proof that migrations
> 0020–0023 apply cleanly and health-verify on staging (DP.1 — the rehearsal for the prod
> promote), and the SYNC-SWEEP that paid down every parked doc-reconciliation debt and
> minted the v16 ceilings baseline this deck cites. The census delta between the ratified
> plan and execution was **zero** — no strays landed.

DP.1 (#217) is the staging half of the promote discipline: the four audit-campaign
migrations applied to the staging DB via the armed workflow, then proven by the per-hash
gauge going `ok` on the staging domain — exactly the evidence C1's probes replay. The
SYNC-SWEEP (#218) closed seven parked reconciliation tasks across four doc targets; its
close-out log (#219) — the v16 ceilings baseline — **is PIN_SHA**: the deck you are
reading pins to the commit that pinned the repo's own self-description.

### Ledger — 3 commits

- [`2d1c62d`](https://github.com/zugzwang-foundation/experiment/commit/2d1c62d26f21c680d96e8e5856e3cf410729d205) · [#217](https://github.com/zugzwang-foundation/experiment/pull/217) — chore(deploy): log session — DP.1 close-out — DP.1 close log — staging migrations 0020–0023 health-proven
- [`681e0b1`](https://github.com/zugzwang-foundation/experiment/commit/681e0b1aea8e8d70f6d518cbda90140cde7508cb) · [#218](https://github.com/zugzwang-foundation/experiment/pull/218) — docs(sync): SYNC-SWEEP — pay the parked spec/doc reconciliation debt (7 tasks, 4 targets + 2 strays) — SYNC-SWEEP — the parked spec/doc reconciliation debt paid
- [`31d8965`](https://github.com/zugzwang-foundation/experiment/commit/31d8965fbc2585b58c0e3736bdc01f255d3cdc25) · [#219](https://github.com/zugzwang-foundation/experiment/pull/219) — chore(docs): log session — SYNC-SWEEP close-out (PR #218 squash 681e0b1) + v16 ceilings baseline — SYNC-SWEEP close log + the v16 ceilings baseline (= PIN_SHA)

## Part C — Operating it

> **TL;DR for the room:** Two environments probed live for this deck (not narrated from
> docs): staging serves the latest substantive commit with all 24 migrations proven; prod
> deliberately holds a 12-day-older build behind the gated promote, healthy and
> self-consistent — the discipline working, not debt. CI is a required check against a
> real Postgres; 207 runnable specs in six tiers; the security posture is structural
> first, and the known seams are named rather than discovered.

### C1 — Environments: the live picture *(as of 2026-07-14; probes 10:52 UTC)*

Both domains were probed at execution time per the runbook's own instruction
(deploy-pipeline.md §1: the `/api/health` gauge is authoritative; migrate exit codes are
not). Verbatim payloads:

**Staging** — `GET https://staging.zugzwangworld.com/api/health`, captured 2026-07-14
10:52:29 UTC:

```json
{"status":"ok","env":"staging","canary":"f0be3803c2a3afd511f84ab07cf8cdbfb7817cb0","db":"ok","migrations":"ok"}
```

**Production** — `GET https://zugzwangworld.com/api/health`, captured 2026-07-14
10:52:47 UTC:

```json
{"status":"ok","env":"prod","canary":"a61859ae92362d20fab27174bf8c842b555505bb","db":"ok","migrations":"ok"}
```

The `canary` field is the bare git SHA the deployment serves (ADR-0024 item 7); the
`migrations` field is the per-hash drift verdict of the **serving build's own journal**
against the connected database — sha256 multiset equality, order-independent
(`src/server/health/migration-drift.ts:41-53`):

```ts
function codeMigrationHashes(): string[] {
	return readMigrationFiles({ migrationsFolder: MIGRATIONS_FOLDER }).map(
		(m) => m.hash,
	);
}

// Applied hash set — every hash row in `drizzle.__drizzle_migrations`.
async function appliedMigrationHashes(db: DriftDbClient): Promise<string[]> {
	const rows = (await db.execute(
		sql`select hash from drizzle.__drizzle_migrations`,
	)) as unknown as Array<{ hash: string }>;
	return rows.map((r) => r.hash);
}
```

Behind-by figures computed from the probed canaries against PIN_SHA
(`git rev-list --count <probed>..<PIN_SHA>`):

| Env | Serving (probed) | Behind PIN_SHA | Migration state |
|---|---|---|---|
| staging | [`f0be380`](https://github.com/zugzwang-foundation/experiment/commit/f0be3803c2a3afd511f84ab07cf8cdbfb7817cb0) — the #216 squash, 2026-07-07 | **3 commits** — all three are docs/log commits (#217, #218, #219); zero code delta | journal `0000–0023` (all 24), `migrations:"ok"` — the DP.1 proof, live |
| production | [`a61859a`](https://github.com/zugzwang-foundation/experiment/commit/a61859ae92362d20fab27174bf8c842b555505bb) — the #193 squash, 2026-07-02 | **26 commits** | serving build's journal ends at `0019`; `migrations:"ok"` — the prod DB is exactly consistent with what it serves; migrations `0020–0023` await the promote |

Read this table through the pipeline's rules (B10), not as a defect list:

- **Prod is healthy and self-consistent.** `migrations:"ok"` on prod means the applied-hash
  multiset equals the serving build's journal — no drift *for the code that is live*. The
  post-D5 rule ("a prod `drift` reading is a real failure") is satisfied.
- **The 26-commit gap is the gate doing its job.** Production auto-serve is OFF (D3);
  every `main` merge since #193 has produced a *staged* build only. The pending promote is
  **DP.2** on the operator roadmap (§C7), sequenced after the staging soak that is running
  now — migrate-before-serve means prod's DB takes `0020–0023` first, then the staged
  build is health-verified per-hash, then the alias moves. Nothing serves untested.
- **Staging is the rehearsal, already passed.** The four pending migrations were applied
  and health-proven on staging at DP.1 (#217) — the exact sequence prod will replay.
- One record-keeping note: the ratified plan's grounding table carried "prod ≈ 3
  doc-commits behind" from earlier deploy-arc docs; the probes above adjudicate (26). This
  deck reports the probed truth — per its own C1 rule, prod state is never narrated from
  documents.

### C2 — Topology: every external surface

| Surface | Facts |
|---|---|
| **Vercel** | one project; prod domain `zugzwangworld.com`, custom `staging` environment (`branchMatcher: staging`) on `staging.zugzwangworld.com`; **production auto-serve OFF** (`autoAssignCustomDomains` disabled, D3); promote is manual `vercel promote --scope <team-slug>` (the `--scope` is load-bearing) |
| **Supabase** (×2) | staging `rwfdoqzsghqhhdapxafg` / production `zbvprdcyxhlguxbostdj`; Postgres 17, ap-south-1 (Mumbai, ADR-0006); app + scripts connect via the **session pooler** (`…pooler.supabase.com:5432` — the direct host is IPv6-only); both have real pg_cron |
| **Doppler** | secrets canon; configs are `stg` / `prd` (never "staging"/"production"); auto-synced to Vercel; parity watched by the scheduled `env-audit.yml` |
| **Cloudflare R2** | three bucket arms: participant uploads (`u/<userId>/`), PFPs, market media (`m/<marketId>/`, ADR-0026) — presigned puts only, write-once arming |
| **Upstash Redis** | rate-limit counters (fail-open), idempotency window (fail-closed), moderation SETNX reservation; transport-bounded post-#211 |
| **Auth vendors** | Google OAuth + Resend (email OTP) + Cloudflare Turnstile (captcha); Better Auth orchestrates; admin auth bypasses all of it (separate hand-rolled path, ADR-0010) |
| **OpenAI** | omni-moderation, pre-commit gate only (ADR-0014) — the single moderation vendor at PIN_SHA (B7's seam note) |
| **Sentry + PostHog** | two-vendor observability (ADR-0007); Sentry owns alarms (serialization exhaustion, CSAM-pending, drift), PostHog owns product analytics |
| **Local dev** | `supabase start` on :54322 + `.env.local`; the DB-only test tiers run secret-free against it — the engine/invariant layer is auditable without any SaaS credential |

### C3 — CI/CD: the gates as they actually run

`ci.yml` — the **required** PR gate (branch protection: PRs only, squash-only, signed
commits, `ci` must pass; required reviews 0 — the review ritual lives in the build harness
instead). Steps in order, against a real `postgres:17` service
(`.github/workflows/ci.yml`):

```
Checkout → Setup pnpm → Setup Node (.nvmrc) → pnpm install --frozen-lockfile
→ Biome (lint+format, --reporter=github)
→ tsc --noEmit
→ drizzle-kit check          # journal integrity
→ strip pg_cron statements   # CI substrate has no pg_cron ext
→ drizzle-kit migrate        # every migration replays from zero
→ pnpm db:check-drift        # timestamp+count drift check
→ pnpm vitest run            # 199 runnable specs (scale tier excluded)
```

Two more workflows: `env-audit.yml` (scheduled Doppler↔Vercel key-parity — an alarm, not
a merge gate) and `staging-migrate.yml` (push to `staging` → apply migrations to the
staging DB via Doppler `stg`; the Vercel staging deploy races it by design — staging
tolerates the window, §C1). **CI never runs on `main` push** — it is PR-gated only, which
is why "is `main` green?" is answered by the *tip PR's* check (SUCCESS at PIN_SHA).

Local mirrors: `just verify` = typecheck → Biome → `next build` (needs
`ZUGZWANG_ENV=preview`); Lefthook pre-push runs `tsc` + Biome; the full local gate for
critical paths is `pnpm vitest run` against local Postgres :54322.

### C4 — Crons & runbooks

Five scheduled jobs, two substrates:

| Job | Substrate | Schedule | Does |
|---|---|---|---|
| `close-due-markets` | Vercel cron → `/api/cron/close-due-markets` | every minute | Open→Closed sweep past deadline (the state machine's only clock edge) |
| `alarms-drain` | Vercel cron → `/api/cron/alarms-drain` | every 5 min | drains pg_cron-queued alarms to Sentry (Redis-locked) |
| `r2-orphan-sweep` | Vercel cron → `/api/cron/r2-orphan-sweep` | every 6 h | reaps uploads that never reached a committed comment |
| identity-pool low-watermark | pg_cron (migration `0007`) | in-DB | alarms when unclaimed identities run low |
| position drift check | pg_cron (migration `0011`) | nightly | recomputes positions from the bet ledger; alarms on divergence (B6/E.11) |

All three Vercel cron routes are `CRON_SECRET`-gated with timing-safe comparison, and all
degrade to no-op `200` post-freeze (E.16). Runbooks on disk (`docs/runbooks/`):
`deploy-pipeline.md` (the promote bible — §3 is the active gated-promote sequence),
`BREAK_GLASS.md` (the only sanctioned freeze-recovery path), `dataset-release.md` (the
2026-11-06 public dataset), `DEBATE.7-moderation-smoke.md` (the moderation smoke ritual),
`staging-provisioning.md`.

### C5 — The test estate

220 `.ts` files under `tests/`; **207 runnable** `*.test.ts` / `*.spec.ts` (the rest:
fixtures, `_setup`, the scale `_harness`, property arbitraries). By tier:

| Tier | Runnable | What it proves |
|---|---|---|
| `tests/server/` | 113 | handler/service behaviour: bets (atomicity, concurrency, replay, oversell, moderation-outside-tx), auth (incl. `_probe-*` vendor pins), resolution, moderation, storage, admin, cron |
| `tests/unit/` | 39 | pure logic: cpmm (calculate/validate/**vectors vs cpmm.md §12**/property), ranking inputs, transitions, floors, dharma canonicalization |
| `tests/integration/` | 20 | real-Postgres service flows: idempotency, rate-limit, sign→moderate→commit, dharma-ledger, resolution conservation, nightly drift |
| `tests/db/` | 17 | storage ground truth: **13 per-table append-only trigger specs** + statement-level TRUNCATE rejection + index catalog asserts + identity-pool |
| `tests/invariants/` | 10 | the named invariant specs (below) |
| `tests/scale/` | 8 | in-process concurrency (the ENGINE.10 exit gate): `reconciliation`, `two-spine-interaction`, `freeze-under-load`, `hot-row-contention`, `money-math-determinism`, `idempotency-dedup`, `side-bind`, `daily-credit-race` — **excluded from the default `vitest run`; opt in explicitly** |

The ten invariant specs, `I-<AREA>-NNN.<slug>.spec.ts`: `I-ATOMICITY-001` (INV-1),
`I-NO-OVERDRAFT-001` (INV-2), `I-SIDE-BIND-001` (INV-3), `I-APPEND-ONLY-001` (INV-4), plus
`I-DAILY-ONCE-001`, `I-GRANT-ONCE-001`, `I-NO-OVERSELL-001`, `I-RESOLVE-ONCE-001`,
`I-SINGLE-SIDE-001`, `I-IDEM-ONCE-001`. Each pairs a product-path assertion with its
storage backstop (partial unique index or trigger), usually by driving the backstop
directly with a fixture bypass and expecting the database to refuse.

Conventions worth knowing before you run anything: property suites are
`*.property.test.ts` (fast-check 4.8.0, 8 files); `_probe-*.test.ts` are vendor-contract
regression pins, not TDD artifacts; **the scale tier will silently not run unless you name
it** (`vitest.config.ts` excludes `tests/scale/**`); the DB tiers default to local
Postgres `:54322` and run secret-free.

### C6 — Security posture (and where it is *not* yet hardened)

**Structural before procedural.** The admin cannot participate because no admin `users`
row exists — `admin_sessions` has no FK to `users`, admin cookies are scoped `Path=/admin`,
and every admin mutation passes `assertAdminActor` (`actor_id === 'admin-singleton' &&
user_id === null`). There is no `role` column to escalate. Participants, conversely, can
never reach admin surfaces: separate table, separate cookie, separate middleware.

**The write path is defended in depth** (B6/B7): zod at the boundary → rate-limit
(fail-open) → idempotency (fail-closed, durable receipts) → moderation (fail-closed,
outside the tx, SETNX-reserved) → SERIALIZABLE W-1 → append-only storage with trigger +
TRUNCATE guards → CHECK constraints as the last line. RLS is deliberately out of scope
(ADR-0019): the DB has exactly one application-facing role and no client-side access, so
enforcement lives server-side by design.

**The internal audit campaign** (B13) closed ~40 findings across #197–#216 before this
external review was commissioned; your EXTAUDIT-01 §6 known-state list is the
do-not-refile digest of it.

**Named seams, open by choice (tracked, not hidden)** — the pre-launch Harden register
(§C7 roadmap + `docs/parked.md`):

- CSAM: single-vendor + Sentry-pending seam (B7); PhotoDNA/Safer + NCMEC reporting parked.
- Moderation non-bypassability is route-layer (B7) — no DB-level gate on `place()`.
- `extractIp()` trusts leftmost `X-Forwarded-For` — a spoofable rate-limit key + log
  field; a 7-site sweep is parked.
- First-request CSRF gap on three auth endpoints (parked with analysis).
- The app connects as the DB owner role; a non-owner runtime role split is parked
  (pre-Sep-15 register).
- Resend still sends from the onboarding domain (sender flip parked).

For your verification passes: EXTAUDIT-01 §3 maps these surfaces to attack targets;
EXTAUDIT-03 §5 and EXTAUDIT-04 §4 define the minimum probe sets. This deck deliberately
adds no verification methodology on top of those.

### C7 — Forward state *(as of PIN_SHA; roadmap dated 2026-07-14)*

**The v16 ceilings baseline** — the repo's own live-verified self-description at PIN_SHA
(`docs/logs/SYNC-SWEEP.md` §6): SPEC.1 **1.0.14** · SPEC.2 **1.0.17** · cpmm.md **2.0.0** ·
ADR ceiling **0031** (29 files: 0001 + 0003–0031; 0002 never authored, 0012 in-flight) ·
migration head **0023** · EVENT_TYPES **24** · schema **24 tables** in the SPEC.2 §5.1
inventory = 22 drizzle-declared + 2 pg_cron-only.

**The parked register** (`docs/parked.md`, 18 dated entries at PIN_SHA, one marked PAID)
is the honest backlog: the §C6 security seams, plus preview-env auth values, the Manifold differential
prerequisite you own (EXTAUDIT-03 §3), two auth-transaction follow-ups (pool-consumption
atomicity, isolation level), and the deferred second moderation vendor.

**Dates that bound everything:** deferred economic constants (ranking numerics, floors)
lock at the **2026-09-01 number-tuning pass** · launch window **15 Sep – 5 Nov 2026** ·
conclusion freeze **2026-11-05 23:59 UTC** (`system_state.frozen_at`) · public dataset
**2026-11-06** · Devcon 8 Mumbai **Nov 6–8**, then the repo archives.

**Operator roadmap as of 2026-07-14 (external tracker v16) — sequencing snapshot, not a
spec:**

| Lane | Item | State / target |
|---|---|---|
| Testing | TESTING.0 operator sandbox pass on staging (doubles as DP.2 soak) | active |
| Deploy | DP.2 gated prod promote (re-verify autoAssignCustomDomains OFF first) | P0 · after soak |
| Design | Branding series B1→B3 → DESIGN.SPEC (2nd design commit) → DESIGN.HANDOVER | active / next |
| Design | DC.2 open rulings W2.7 + W2.10 (gate two UI surfaces) | pending founder |
| UI | Per-surface UI build lane, incl. market-list | after handover |
| Media | MEDIA.2 (gated by W2.9 design) · MEDIA.3 · MEDIA.4 | backlog |
| Harden | Non-owner runtime DB role (pre-Sep-15) · Resend sender flip · 7-site XFF sweep · freeze cron · request_id log field | register |
| Economy | Number-tuning pass locks deferred constants | ~2026-09-01 |
| Launch | LAUNCH.1–.8 → live window | Sep 15 – Nov 5 2026 |
| Close | Conclusion Devcon 8 Mumbai + dataset release; repo archived | Nov 6–8 2026 |

## Epilogue — provenance & refresh

This deck was authored at PIN_SHA
[`31d8965`](https://github.com/zugzwang-foundation/experiment/commit/31d8965fbc2585b58c0e3736bdc01f255d3cdc25)
on 2026-07-14, from the live repository — every census counted, every excerpt read, both
environments probed at authoring time. The canonical file is the `.md`; the `.html` is
generated from it and never edited independently. `scripts/verify-handover-links.sh`
machine-checks (1) every commit link resolves and is on `main`, (2) every ledger PR is
merged and the ledger PR-set equals the census set, (3) the Part-B ledger multiset equals
`git log --first-parent` at PIN_SHA exactly — no commit missing, none twice, and (4)
`.md`↔`.html` heading parity. Re-run it after any refresh.

The deck's own PR — [#220](https://github.com/zugzwang-foundation/experiment/pull/220) —
is outside PIN_SHA history by construction; its squash SHA is recorded in the follow-up
session log, not here. **Refresh policy:** if `main` moves materially before the live
session (especially DP.2), re-pin and refresh the volatile sections (C1, C7) plus a B14
census delta in a dated PR; the as-of stamps bound staleness meanwhile.
