import { connection } from "next/server";
import { readiness, type WarmUpResult } from "@/server/health/ready";

// GET /api/ready — the ALB target-group health check (AWS-MIGRATION-3).
//
// 503 until this process has finished its one-time warm-up, 200 after. The
// warm is started by the first call, so the ALB's own probing is what warms
// a new task; nothing else has to remember to. `/api/health` is unchanged and
// still the container health check and the deploy canary — liveness and
// readiness are different questions and stay on different paths.
//
// Never blocks: the pending case answers at once. A blocking readiness probe
// would hold an ALB health-check connection open for up to the warm budget
// and be marked unhealthy on the probe timeout instead.
let settled: WarmUpResult | null = null;

export async function GET(): Promise<Response> {
	// READY-REQUEST-TIME (readiness item 18) — request time, never the build.
	// `next build` calls a route's GET once to decide whether it can be a
	// static file; without this, that call ran the warm-up, which queried the
	// build machine's database (11 connection attempts, measured with a trap).
	// The route stayed dynamic only because the warm-up FAILED there. Against a
	// reachable database the build could have frozen this — the ALB's health
	// check — as a static answer. After cutover the build cannot reach the
	// private RDS at all, so it must not depend on reaching it.
	await connection();
	if (settled === null) {
		readiness().then(
			(r) => {
				settled = r;
			},
			() => {
				// warmUp never rejects (failures are counted, not thrown); belt only.
				settled = {
					ready: true,
					warmed: [],
					failed: ["(warm-up threw)"],
					durationMs: 0,
					warmedAt: new Date().toISOString(),
				};
				console.warn("ready: warm-up threw; reporting one failed path");
			},
		);
	}
	if (settled === null) {
		return Response.json(
			{ ready: false },
			{ status: 503, headers: { "cache-control": "no-store" } },
		);
	}
	// Counts only: the path inventory (Open-market slugs, a pseudonym) and the
	// warm timestamp are a deploy oracle to an unauthenticated caller
	// (`@security-auditor` LOW); the deploy gate needs `failed`, nothing else.
	return Response.json(
		{
			ready: true,
			warmed: settled.warmed.length,
			failed: settled.failed.length,
		},
		{ status: 200, headers: { "cache-control": "no-store" } },
	);
}
