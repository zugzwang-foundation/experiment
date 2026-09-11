# Runbook — stub moderation endpoint for write-path load testing

> **What this is for:** letting a write-path load test (bet placement, signup, mixed traffic) run without spending real, metered OpenAI money on every request. **What this is not:** a way to disable moderation generally, permanently, or in production. Read this whole file before touching `OPENAI_BASE_URL` anywhere.

---

## Why this exists, in one paragraph

Every bet in this app carries mandatory commentary, and every comment is checked by a real OpenAI moderation call before it commits (`src/server/moderation/precommit.ts` → `openai.ts`). A write-path load test at any real concurrency means real vendor spend on every single request, with no budget cap named anywhere in this repo. This runbook describes the one safe way to avoid that cost: a stub server (`scripts/loadtest/stub-moderation-worker.js`) that mimics OpenAI's response shape, deployed on Cloudflare Workers, that staging is pointed at **only** for the duration of a load-test run.

**Nothing about the app's moderation code changes.** The `openai` npm package already reads `process.env.OPENAI_BASE_URL` when present — this capability is a deployment-config trick, not a code change, and it is reversed by removing one environment variable.

---

## Before you do anything: preconditions

- [ ] The Worker is deployed (`cd scripts/loadtest && wrangler deploy`) and its secret is set (`wrangler secret put LOADTEST_AUTH_TOKEN`) — this only needs doing once, not per load-test run.
- [ ] You have tested the Worker directly first (curl it with a fake moderation request, confirm the response shape) — see the plan's verification steps.
- [ ] You have tested it against a **preview** Vercel deployment first — never staging as the first place this is tried.
- [ ] You know exactly when this load-test session ends, because turning this off is not optional cleanup — it's the whole safety model.

---

## Turning it ON (immediately before a write-load run)

1. Go to Vercel → your project → **Settings → Environment Variables → Staging** (the custom environment, not Production, not Preview).
2. Add `OPENAI_BASE_URL` = `<your deployed Worker's URL>` (e.g. `https://zugzwang-loadtest-stub-moderation.<subdomain>.workers.dev`).
   - **Set this directly in Vercel. Do NOT add it to Doppler `stg`.** This is deliberate, not an oversight — Doppler is this repo's normal single source of truth, but keeping this one variable Vercel-only means it's maximally visible (anyone checking Vercel's env var list sees it immediately) and structurally cannot leak into another environment through Doppler's sync. A variable this dangerous should be the loudest thing in the room, not folded into the shared secrets store.
3. Trigger a redeploy of staging (env var changes don't take effect on already-running instances).
4. Confirm the flip actually happened **before** starting real load: place one ordinary test bet on staging, then check the Worker's live log (`wrangler tail` from `scripts/loadtest/`, or the Cloudflare dashboard) for the corresponding `[stub-moderation]` line. If you don't see it, the app is still calling real OpenAI — do not proceed until you do.
5. Now run the write-load test.

## Turning it OFF (immediately after — not "later", not "at the end of the day")

1. Go back to Vercel → Staging environment variables → **remove** `OPENAI_BASE_URL` entirely (don't just blank it — remove the key).
2. Redeploy staging again.
3. Confirm the reversal: place one more ordinary test bet, confirm the Worker log stays **quiet** for it (no new `[stub-moderation]` line), which means the call went to real OpenAI again.
4. Only then is the session actually closed out.

**If you are ever unsure whether staging is currently pointed at the stub or at real OpenAI:** check Vercel's staging environment variables directly. The presence or absence of `OPENAI_BASE_URL` there is the entire answer — that's the point of keeping it Vercel-only and out of Doppler.

---

## What this does NOT authorize

- Never set `OPENAI_BASE_URL` on **Production**. Full stop, no exception, no "just for a quick check."
- Never leave it set on staging between sessions. A forgotten override means every real person testing on staging afterward is posting content with zero moderation, silently.
- Never treat the stub's shared-secret token as low-stakes — it's a public HTTPS URL by necessity (Vercel calls out over the open internet), and the token is the only thing stopping anyone who finds it from probing it. Rotate it (`wrangler secret put LOADTEST_AUTH_TOKEN` again) if you have any reason to think it leaked.

---

## The marker strings, if you need to exercise the flagged path

The stub always returns "pass" (`flagged: false`) unless the comment/bet text contains one of two fixed markers, letting a write-load run also cover the app's flagged-content branches without needing real flaggable content:

- `__LOADTEST_FLAG_SEXUAL_MINORS__` → routes to `track_a` (the same path a real `sexual/minors` verdict takes)
- `__LOADTEST_FLAG_HARASSMENT__` → routes to `track_b` (the same path any other flagged category takes)
