// ENGINE.15 S1 RED scaffold — GET /api/cron/close-due-markets. STUB returns
// HTTP 501 + a sentinel body so every cron-route assertion (401 bad bearer,
// 500 missing secret, 200 {status:"locked"}, 200 {status:"ok",closed}, 200
// {status:"error"}) fails on ASSERTION, not on module resolution. S2 wires the
// A-2 mirror per D-15.g (Bearer CRON_SECRET constant-time compare → distributed
// lock `getRedisKey("cron-lock","close-due-markets")` TTL CLOSE_SWEEP_LOCK_TTL_SECONDS
// → `closeDueMarkets({ now, metadata })` → in-body status + Sentry capture),
// mirroring src/app/api/cron/r2-orphan-sweep/route.ts.
export async function GET(_request: Request): Promise<Response> {
	return new Response(JSON.stringify({ status: "stub" }), {
		status: 501,
		headers: { "content-type": "application/json" },
	});
}
