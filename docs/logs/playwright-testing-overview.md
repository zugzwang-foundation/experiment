# Playwright E2E Testing — Overview

_A plain-language summary of the browser-automation tests added to this project, for anyone who isn't hands-on with the code._

## What Playwright is

Playwright is a tool that opens a real browser and clicks/types/checks things automatically, the way a real person would use the website. It's separate from this project's existing tests (Vitest), which check individual pieces of logic (math, database rules) but never actually open a browser page. Playwright is the layer that checks: **does a real person clicking through the actual website work end-to-end?**

## What's set up

- Installed as a project dependency (`@playwright/test`), with one browser (Chromium) — kept minimal on purpose.
- Config file: `playwright.config.ts` — points tests at `localhost:3000` and can auto-start the dev server.
- Run all tests: `pnpm test:e2e`
- Watch them run live in a visible browser: `pnpm exec playwright test --headed`

## Tests written so far (8 files, 12 tests, all passing)

| # | File | What it checks | Covers |
|---|---|---|---|
| 1 | `tests/e2e/homepage.spec.ts` | The homepage loads and shows market cards | Regular visitor |
| 2 | `tests/e2e/market-detail.spec.ts` | Clicking a market card opens the correct market's detail page, with the right title | Regular visitor |
| 3 | `tests/e2e/admin-login.spec.ts` (2 tests) | (a) Correct admin password logs in successfully; (b) wrong password is correctly rejected | Admin |
| 4 | `tests/e2e/profile.spec.ts` (2 tests) | (a) A real user's profile page shows their correct pseudonym; (b) an unknown pseudonym shows a proper 404 | Regular visitor |
| 5 | `tests/e2e/bookmarks.spec.ts` | Visiting Bookmarks while logged out redirects to the sign-in page | Regular visitor |
| 6 | `tests/e2e/sign-in.spec.ts` | The sign-in page shows both the Google button and the email/code option | Regular visitor |
| 7 | `tests/e2e/debate-export.spec.ts` (2 tests) | (a) Downloading a debate as a Markdown file works and has the right content; (b) an unknown market's export returns 404 | Regular visitor |
| 8 | `tests/e2e/debate-interactions.spec.ts` (2 tests) | (a) Clicking the YES button as a logged-out visitor prompts sign-in instead of opening a bet form; (b) opening a post's "Show more" popup actually shows its content | Regular visitor |

**Note on coverage:** this is now solid coverage of everything a visitor can see and do **without** being logged in — browsing markets, viewing profiles, viewing a debate, exporting it, and getting correctly prompted to sign in when trying to bet or bookmark — plus the admin login path. Actions that require actually being logged in as a real user — placing a bet, writing a comment, following through on a bookmark — are **still not tested**, because regular users sign in via Google, and Playwright cannot realistically automate a real Google login screen (it's designed to block exactly that kind of automated access). Admin, by contrast, has a completely separate login — just a password field, no email or Google involved — which made it straightforward to automate.

Also not yet tested: **admin creating a new market.** The market-creation form requires uploading a real image, and this local setup is currently using the project's real staging file-storage (Cloudflare R2) credentials — so an automated test would upload a real file to shared staging storage every time it ran. We deliberately held off on that one rather than do that silently.

## Two real things this testing work found (not test-writing mistakes — actual system behavior)

1. **`/admin` doesn't show its own page — it redirects.** Visiting `/admin` after logging in immediately forwards you to `/admin/moderation` (that's the intended default landing tab). The first version of the login test assumed the final page was `/admin` itself and failed until this was corrected.

2. **Admin login is rate-limited — 10 attempts per hour, per IP address**, and this app enforces it for real, on the same infrastructure the local dev environment uses. During test debugging, running "wrong password" and "correct password" tests back-to-back repeatedly used up that 10-per-hour budget for real — meaning actual admin login from this machine was temporarily blocked, the same protection a real attacker would hit. This is a deliberate security feature (brute-force protection), not a bug. It self-clears after an hour. The tests were reordered (successful login attempted first, before any failing attempts) to avoid wasting this budget on every run going forward.

## Local environment context (relevant background)

- Local development runs against a **local copy of the database** (Postgres, installed directly on this machine — not the shared staging database), pre-loaded with a one-time, read-only snapshot of real staging data (markets, users, bets, comments) so the site isn't empty.
- Local development uses the **real staging credentials** for supporting services (Google sign-in, file storage, email, moderation, etc.), which is why the admin rate-limit behaved exactly as it would in production — it's hitting real, shared infrastructure, not a fake local copy.

## What a next round of testing would add

- A way to simulate being logged in as a regular user (since real Google login can't be automated), unlocking tests for bet placement, commenting, and bookmarking.
- A market-creation test, once there's a decision on how to avoid uploading real files to shared storage on every run (e.g. a dedicated test bucket).
