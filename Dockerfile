# Zugzwang — production container image (AWS-MIGRATION).
#
# ⚠ THE IMAGE BELONGS TO ONE ENVIRONMENT, and that is not a packaging choice —
# it follows from the app. `next.config.ts` inlines `ZUGZWANG_ENV` into the
# bundle, `instrumentation.ts` refuses to boot in staging/prod without
# `NEXT_PUBLIC_SENTRY_DSN`, and `BETTER_AUTH_URL` is read at build time. So a
# staging image can NEVER be promoted to production: each environment builds its
# own, and the tag carries the environment name to make that visible.
#
# Two images come out of this file:
#   --target runner   the app         (default)
#   --target migrate  the migrations  (needs dev deps: tsx + drizzle-kit)
#
# Build:
#   docker build --target runner \
#     --build-arg ZUGZWANG_ENV=staging \
#     --build-arg APP_COMMIT_SHA=$(git rev-parse --short HEAD) \
#     --build-arg NEXT_PUBLIC_SENTRY_DSN=... \
#     --build-arg BETTER_AUTH_URL=https://staging.zugzwangworld.com \
#     --secret id=build_env,src=<env file> \
#     -t zugzwang:staging-$(git rev-parse --short HEAD) .
#
# The env file is produced by:
#   doppler secrets download --no-file --format env --config stg > build.env

# ── deps ─────────────────────────────────────────────────────────────────────
FROM node:24-alpine AS deps
WORKDIR /app
# libc6-compat: sharp's prebuilt binaries expect glibc symbols on Alpine.
RUN apk add --no-cache libc6-compat
RUN corepack enable
COPY package.json pnpm-lock.yaml .npmrc* ./
# The full tree, dev dependencies included — the build needs them, and so does
# the migrate image below.
RUN pnpm install --frozen-lockfile

# ── build ────────────────────────────────────────────────────────────────────
FROM node:24-alpine AS build
WORKDIR /app
RUN apk add --no-cache libc6-compat
RUN corepack enable
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Everything below is baked into the bundle. Missing values do not fail the
# build — they fail at RUNTIME, which is worse — so the runner stage asserts the
# two that matter.
ARG ZUGZWANG_ENV
ARG APP_COMMIT_SHA
ARG BETTER_AUTH_URL
ARG NEXT_PUBLIC_SENTRY_DSN
ARG NEXT_PUBLIC_POSTHOG_KEY
ARG NEXT_PUBLIC_POSTHOG_HOST
ARG NEXT_PUBLIC_TURNSTILE_SITE_KEY
ARG SENTRY_ORG
ARG SENTRY_PROJECT
ARG SENTRY_AUTH_TOKEN
ENV ZUGZWANG_ENV=$ZUGZWANG_ENV \
	APP_COMMIT_SHA=$APP_COMMIT_SHA \
	BETTER_AUTH_URL=$BETTER_AUTH_URL \
	NEXT_PUBLIC_SENTRY_DSN=$NEXT_PUBLIC_SENTRY_DSN \
	NEXT_PUBLIC_POSTHOG_KEY=$NEXT_PUBLIC_POSTHOG_KEY \
	NEXT_PUBLIC_POSTHOG_HOST=$NEXT_PUBLIC_POSTHOG_HOST \
	NEXT_PUBLIC_TURNSTILE_SITE_KEY=$NEXT_PUBLIC_TURNSTILE_SITE_KEY \
	SENTRY_ORG=$SENTRY_ORG \
	SENTRY_PROJECT=$SENTRY_PROJECT \
	SENTRY_AUTH_TOKEN=$SENTRY_AUTH_TOKEN \
	NEXT_TELEMETRY_DISABLED=1 \
	# The one switch that turns on `output: 'standalone'` (next.config.ts).
	BUILD_TARGET=docker

# ⚠ THE BUILD NEEDS A REACHABLE DATABASE, which is neither obvious nor
# optional. With `cacheComponents` on, Next prerenders each route's static
# shell at build time, and the home page's shell runs a cached read — so
# page-data collection opens a connection. Without it the build fails at
# "Failed to collect page data" pointing at a cron route, which looks nothing
# like its cause.
#
# ⛔ A SECRET MOUNT, NEVER AN `ARG`. An ARG is recorded in the image history,
# so the credential would ship inside the image. A mounted secret exists only
# for this one RUN and lands in no layer. The RUNTIME value is a different
# thing entirely: ECS injects it from Secrets Manager when the task starts.
# ⚠ THE WHOLE RUNTIME ENVIRONMENT IS MOUNTED, not just the database URL, and
# the reason is worth stating: collecting page data EVALUATES every route's
# modules, and several read their configuration at import time —
# `src/db/index.ts` throws without DATABASE_URL, the auth module throws
# without BETTER_AUTH_SECRET, and so on down a list nobody has enumerated.
# Naming them here would mean rediscovering that list every time a route
# gains an import.
#
# ⛔ STILL A SECRET MOUNT, so none of it reaches a layer: the file exists only
# for this RUN. CI produces it with `doppler secrets download --no-file
# --format env`. What the app uses at RUNTIME comes from Secrets Manager, not
# from here.
RUN --mount=type=secret,id=build_env \
	sh -c 'set -a; . /run/secrets/build_env; set +a; pnpm exec next build'

# ── runner ───────────────────────────────────────────────────────────────────
FROM node:24-alpine AS runner
WORKDIR /app
RUN apk add --no-cache libc6-compat curl
ENV NODE_ENV=production \
	NEXT_TELEMETRY_DISABLED=1 \
	PORT=3000 \
	HOSTNAME=0.0.0.0
# Never root.
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

# `standalone` carries the server and the minimal node_modules it traced;
# `static` and `public` are not included in it and must be copied beside it.
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=build --chown=nextjs:nodejs /app/public ./public
# ⚠ `/api/health` hashes every file under drizzle/migrations to report migration
# drift. Without this copy the endpoint reports drift against an empty set —
# which is the deploy gate lying in the safe-looking direction.
COPY --from=build --chown=nextjs:nodejs /app/drizzle ./drizzle
# AWS-MIGRATION-3: sets headersTimeout above the keep-alive Next reads from
# KEEP_ALIVE_TIMEOUT; a no-op when that variable is unset.
COPY --chown=root:root scripts/docker/server-timeouts.cjs ./server-timeouts.cjs

USER nextjs
EXPOSE 3000

# Fails the container rather than serving half-dead. ECS restarts it; the ALB
# stops sending traffic first.
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
	CMD curl -fsS http://127.0.0.1:3000/api/health || exit 1

# `server.js` is what `output: 'standalone'` emits.
CMD ["node", "--require", "./server-timeouts.cjs", "server.js"]

# ── migrate ──────────────────────────────────────────────────────────────────
# A SEPARATE image, because migrations run through `tsx scripts/migrate-*.ts`
# and the runner above deliberately has no dev dependencies. Run as a one-off
# task BEFORE the service is updated (ADR-0024 migrate-before-serve).
FROM node:24-alpine AS migrate
WORKDIR /app
RUN apk add --no-cache libc6-compat
# ⚠ `corepack enable` alone leaves pnpm as a SHIM that downloads the real binary
# on FIRST USE — at task start, inside the VPC, where a staging task has no
# route to the registry. Measured at AWS-MIGRATION-2: the migration task died
# on `UND_ERR_CONNECT_TIMEOUT` fetching pnpm before it touched the database.
# `corepack prepare --activate` resolves the `packageManager` pin from
# package.json and caches the binary in the image at BUILD time, where the
# network exists. `COREPACK_ENABLE_NETWORK=0` then makes any later attempt to
# download fail loudly instead of hanging.
COPY package.json ./
RUN corepack enable && corepack prepare --activate
ENV COREPACK_ENABLE_NETWORK=0
ENV NODE_ENV=production \
	NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY package.json pnpm-lock.yaml ./
COPY drizzle ./drizzle
COPY scripts ./scripts
COPY src ./src
COPY tsconfig.json drizzle.config.ts ./
# Overridden per environment by the ECS task definition
# (`pnpm db:migrate:staging` / `pnpm db:migrate:prod`).
CMD ["pnpm", "db:migrate:prod"]
