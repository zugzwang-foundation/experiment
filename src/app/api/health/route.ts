import { sql } from "drizzle-orm";

import { db } from "@/db";
import { migrationDriftStatus } from "@/server/health/migration-drift";

// GET /api/health — SCAFFOLD.8 OQ-3 boundary verdict + LD-5 smoke items
// #4 (DB connectivity) and #5 (env + canary echo) + LD-2 routing target
// for the deployment canary (now the commit SHA — see below).
//
// Hard constraint: this route reads ONLY three named env vars — ZUGZWANG_ENV,
// VERCEL_GIT_COMMIT_SHA and VERCEL_REGION (the latter two are Vercel-injected
// system vars naming the live deployment's commit and its executing region,
// NOT secrets); NO `process.env` enumeration; NO leak
// of DATABASE_URL, BETTER_AUTH_SECRET, RESEND_API_KEY, TURNSTILE_SECRET_KEY,
// Upstash token, OPENAI_API_KEY, or any R2_* credentials. Production-safety:
// the route exists on all three environments; prod returns `env: "prod"` and
// `canary` is the deployment's commit SHA (identifies which build is live,
// leaks nothing). ADR-0024 supersedes ADR-0022's "two named env vars" line
// (SPEC.2 §22).
//
// Runtime: Node (ADR-0003 — no `runtime = 'edge'` export); auth: public
// (no session gate, no Origin allowlist); cache: none (AGENTS.md §5
// uncached-by-default; no `'use cache'`).

export async function GET(): Promise<Response> {
	let dbStatus: "ok" | "error" = "ok";
	try {
		await db.execute(sql`SELECT 1`);
	} catch {
		dbStatus = "error";
	}
	// Migration drift guard: surface "code ahead of/behind schema" as a status
	// string only (no migration heads or secrets leaked). Checked only when the
	// DB is reachable; reported as "error" otherwise so a DB outage is not
	// mistaken for schema drift.
	const migrations =
		dbStatus === "ok" ? await migrationDriftStatus(db) : "error";
	return Response.json({
		status: "ok",
		env: process.env.ZUGZWANG_ENV ?? null,
		canary: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
		// PERF-1 — the missing control. ADR-0006 ratified `bom1` on 2026-05-05
		// and the project ran `iad1` for three months because NOTHING read the
		// deployed region back and compared it to the decision. Every existing
		// control watches for CHANGE; none watched for a decision that never
		// landed, and `vercel.json` was SILENT rather than wrong, so it looked
		// identical to a correct file in every diff, CI run and review.
		//
		// `VERCEL_REGION` is a Vercel SYSTEM env var, injected per invocation
		// with "the ID of the Region where the app is running" — it is not a
		// value this project sets, and setting `ZUGZWANG_ENV`-style config
		// wrongly cannot make it lie. `null` off-platform (local, CI) is the
		// honest answer, not a default: there is no region to report there.
		//
		// The truthfulness proof is NOT that this field exists. It is that its
		// value equals the COMPUTE half of `x-vercel-id` (`<ingress>::<compute>`)
		// on the SAME response — a header the edge generates independently of
		// this function's environment. Two independent sources agreeing is what
		// makes this non-vacuous; see the ADR-0006 patch record and
		// `tests/server/health/region.test.ts`.
		region: process.env.VERCEL_REGION ?? null,
		db: dbStatus,
		migrations,
	});
}
