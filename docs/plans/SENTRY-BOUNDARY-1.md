# SENTRY-BOUNDARY-1 — the React error boundaries report to Sentry

**Surface:** ordinary work. Touches none of the seven CLAUDE.md §1 critical areas — four
`error.tsx`-family Client Components, one new `src/lib/` leaf, and tests. No schema, no
migration, no server handler, no Dharma, no moderation. Branch → review → merge.

**Scope ruled by the operator in-session** after the premise was corrected (below): close the
one genuine SDK gap, and nothing else.

---

## 1. The premise this task started from was wrong, and the correction is the plan

The task arrived as *"do all the SDK implementations of sentry in all the codes"*. **Sentry is
already implemented here, and thoroughly.** Measured on disk before any edit:

| Present | Where |
|---|---|
| `Sentry.init` × 3 runtimes | `instrumentation-client.ts` · `sentry.server.config.ts` · `sentry.edge.config.ts` |
| `onRequestError` (server throws) | `instrumentation.ts:75` |
| `onRouterTransitionStart` | `instrumentation-client.ts:34` |
| Source maps + release tagging | `next.config.ts` → `withSentryConfig` |
| Boot-time DSN assertion | `instrumentation.ts:38` (prod + staging throw) |
| Fail-open capture wrappers | `src/server/observability/safe-capture.ts`, used across ~20 modules |
| Routing verification route | `src/app/api/_smoke-error/route.ts` |

So "add the SDK everywhere" was not the remaining work. **The remaining work was one thing.**

## 2. The gap

**None of the four React error boundaries reported.** `global-error.tsx`, `(auth)/error.tsx`,
`m/[slug]/error.tsx`, `u/[pseudonym]/error.tsx` each accepted `error` and never touched it.

`onRequestError` does not cover them, and neither does the browser SDK's default global-handler
integration — **a boundary is by definition the thing that stops the error propagating**, so it
never reaches `window.onerror`. Every client-side and hydration failure on the product rendered
an apology and went nowhere.

⚠ **And the client arm is the one carrying information.** The boundaries' own docblocks make the
point for the leak case: in a production build React's Flight client replaces a SERVER error with
a fixed placeholder before it crosses to the browser, so after a server throw the boundary holds a
husk plus a `digest` — the real one already went to Sentry from `onRequestError`. An error thrown
in the browser or during hydration arrives intact. **The yield of this change is almost entirely
the arm that was invisible.**

## 3. What landed

- `src/lib/boundary-capture.ts` — client-side fail-open capture. Cannot reuse
  `server/observability/safe-capture.ts`: that module is `server-only` and importing it from a
  Client Component is a build error.
- All four boundaries call it from a `useEffect` keyed `[error]`.
- Tags: `kind: react_error_boundary`, `boundary`, and `digest` when present.
- `docs/adr/0007-observability.md` — Patch record (decision unchanged, consumer surface scoped;
  CLAUDE.md §5.12).

## 4. The cost, and why the guards were inverted rather than deleted

The three route boundaries held a **structural** no-leak guarantee: `error` was deliberately never
destructured, so no binding existed — and NO BINDING IMPLIES NO READ, of any kind, on any node, in
any portal, for any event. `@security-auditor` minted that at POLISH.3 R7 with a source assertion
that covered what seven behavioural probes could not.

**Reporting requires a binding. There is no version of this that keeps both.**

⇒ The two guards in `market-error-boundary.test.tsx` were **inverted, not removed**:

| Was | Now |
|---|---|
| `reads` after mount is `[]` | `reads` is **exactly** `["digest"]` — an equality, so widening the read set fails |
| body never names `error` | body names it **only inside the capture effect**; excise that block and any surviving `error` fails |

The handler sweep is unchanged and still asserts **zero** reads from any handler — the "Show
details" affordance the original docblock feared is still forbidden.

**Mutation-tested, because a guard rewritten to permit something can permit everything:**

| Mutation | Result |
|---|---|
| `{error.message}` into JSX | **3 red** (leak, read-log, source) |
| handler sets `document.title = error.message` | **2 red** (read-log, source) |
| `void error.message` beside the capture | **1 red** (read-log only — the source guard excises that block; the two are complementary and neither closes it alone) |
| baseline restored | **green** |

## 5. Verification

- `ZUGZWANG_ENV=preview just verify` — typecheck → biome → `next build`. **All checks passed.**
- `vitest run tests/unit/` — **282 files, 3893 tests, all pass.**
- New: `tests/unit/observability/boundary-capture.test.tsx`, 18 tests.
- `pnpm test:invariants` / `test:integration` not run — CLAUDE.md §5.7 requires them for
  critical-path work, and this touches none of the seven areas.

## 6. Deliberately NOT in scope — each its own ruling

`Sentry.setUser` identification and session replay (ADR-0007 §5 keeps replay off; both cross the
SPEC.1 §16.3 privacy floor), `tunnelRoute`, `beforeSend` scrubbing, env-scoped `tracesSampleRate`
(prod ships `1.0`), and converting the ~10 bare `captureException` sites — **AUDIT-FIX-B1 ruling
#8 explicitly left those alone**, and several sit on §1 critical paths.
