// The fence. Refuses to run against anything shared with staging or
// production. Called first, always, before any reset/seed step.
//
// Pure — takes an env record rather than reading `process.env` directly, so
// it is exhaustively unit-testable with no global mutation (the
// `resolveRunnerTarget` shape in tests/staging/_lib/target.ts).
//
// The shared Redis marker matters because UPSTASH_REDIS_REST_URL resolves
// to the SAME instance — host prefix "equal-lemming-124923" — for local,
// stg AND prd alike (E2E-1 report §4.1). A local run must never carry that
// host, even by accident.

// All 12 R2 credential/endpoint/bucket vars actually read in
// src/server/storage/r2.ts, across the three buckets (uploads, pfp,
// market-media). The v1.0 package's guard listed 9 — missing all three
// *_MARKET_MEDIA vars, which would have let a real market-media credential
// slip through the check undetected.
const R2_VARS = [
	"R2_BUCKET_UPLOADS",
	"R2_ACCESS_KEY_ID_UPLOADS",
	"R2_SECRET_ACCESS_KEY_UPLOADS",
	"R2_ENDPOINT_UPLOADS",
	"R2_BUCKET_PFP",
	"R2_ACCESS_KEY_ID_PFP",
	"R2_SECRET_ACCESS_KEY_PFP",
	"R2_ENDPOINT_PFP",
	"R2_BUCKET_MARKET_MEDIA",
	"R2_ACCESS_KEY_ID_MARKET_MEDIA",
	"R2_SECRET_ACCESS_KEY_MARKET_MEDIA",
	"R2_ENDPOINT_MARKET_MEDIA",
] as const;

const SHARED_HOST_MARKERS = [
	"equal-lemming-124923", // the shared Upstash instance — local, stg AND prd
	"supabase.co",
	"pooler.supabase.com",
] as const;

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

export function assertIsolatedEnvironment(
	env: Readonly<Record<string, string | undefined>> = process.env,
): void {
	const fail = (msg: string): never => {
		throw new Error(`E2E ENVIRONMENT GUARD — REFUSING TO RUN\n  ${msg}`);
	};

	// 1. Postgres must be local.
	const db = env.DATABASE_URL ?? "";
	if (!db) fail("DATABASE_URL is unset.");
	let host: string;
	try {
		host = new URL(db.replace(/^postgres(ql)?:\/\//, "http://")).hostname;
	} catch {
		fail("DATABASE_URL is not a parseable URL.");
		return;
	}
	if (!LOOPBACK_HOSTS.has(host)) {
		fail(`DATABASE_URL host is "${host}" — must be localhost.`);
	}

	// 2. Redis must be unreachable, never the shared instance.
	const redis = env.UPSTASH_REDIS_REST_URL ?? "";
	for (const marker of SHARED_HOST_MARKERS) {
		if (redis.includes(marker)) {
			fail(
				`UPSTASH_REDIS_REST_URL points at the SHARED instance ("${marker}").\n` +
					`  That instance is shared by local, staging AND production.\n` +
					`  Set it to http://127.0.0.1:1 for E2E runs.`,
			);
		}
	}

	// 3. R2 must be entirely absent. Any value here is a real credential —
	// there is no local object-store substitute anywhere in this repo.
	const present = R2_VARS.filter((v) => env[v]);
	if (present.length > 0) {
		fail(
			`R2 credentials present: ${present.join(", ")}.\n` +
				`  There is no local R2 substitute — any value here is a real bucket credential.\n` +
				`  Unset them. Upload paths are out of scope for this suite.`,
		);
	}

	// 4. Never point at a deployed app.
	const base = env.BETTER_AUTH_URL ?? "";
	if (base && !base.includes("localhost") && !base.includes("127.0.0.1")) {
		fail(`BETTER_AUTH_URL is "${base}" — must be localhost.`);
	}
}
