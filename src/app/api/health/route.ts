import { sql } from "drizzle-orm";

import { db } from "@/db";

// GET /api/health — SCAFFOLD.8 OQ-3 boundary verdict + LD-5 smoke items
// #4 (DB connectivity) and #5 (env + canary echo) + LD-2 routing target
// for the per-env canary.
//
// Hard constraint: this route reads ONLY the two named env vars; NO
// `process.env` enumeration; NO leak of DATABASE_URL,
// BETTER_AUTH_SECRET, RESEND_API_KEY, TURNSTILE_SECRET_KEY, Upstash
// token, OPENAI_API_KEY, or any R2_* credentials. Production-safety:
// the route exists on all three environments; prod returns `env: "prod"`
// (the canary literally is the env name, which leaks nothing).
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
	return Response.json({
		status: "ok",
		env: process.env.ZUGZWANG_ENV ?? null,
		canary: process.env.ZUGZWANG_ENV_CANARY ?? null,
		db: dbStatus,
	});
}
