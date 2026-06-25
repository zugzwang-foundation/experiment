import { sql } from "drizzle-orm";

import { db } from "@/db";
import { migrationDriftStatus } from "@/server/health/migration-drift";

// GET /api/health — SCAFFOLD.8 OQ-3 boundary verdict + LD-5 smoke items
// #4 (DB connectivity) and #5 (env + canary echo) + LD-2 routing target
// for the deployment canary (now the commit SHA — see below).
//
// Hard constraint: this route reads ONLY two named env vars — ZUGZWANG_ENV
// and VERCEL_GIT_COMMIT_SHA (a Vercel-injected system var naming the live
// deployment's commit, NOT a secret); NO `process.env` enumeration; NO leak
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
		db: dbStatus,
		migrations,
	});
}
