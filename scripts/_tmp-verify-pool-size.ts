import postgres from "postgres";

// Read-only probe: open N genuinely separate connections concurrently, each
// holding briefly via pg_sleep, and count how many DISTINCT real Postgres
// backends respond at once. This directly measures how many concurrent
// connections the pooler will actually grant right now — the only way to
// verify a Supabase dashboard setting from outside the dashboard, since no
// Management API token is available here. Purely SELECT + pg_sleep; nothing
// written, nothing held beyond the probe's own lifetime.

const N = 50;
const url = process.env.DATABASE_URL_TXN as string;

async function probeOne(
	i: number,
): Promise<{ i: number; pid: number; ms: number }> {
	const sql = postgres(url, { max: 1, prepare: false });
	const start = Date.now();
	const [row] = await sql`select pg_backend_pid() as pid, pg_sleep(2)`;
	const ms = Date.now() - start;
	await sql.end();
	return { i, pid: row.pid as number, ms };
}

async function main() {
	console.log(`Firing ${N} concurrent connections...`);
	const settled = await Promise.allSettled(
		Array.from({ length: N }, (_, i) => probeOne(i)),
	);
	const results = settled
		.filter(
			(
				r,
			): r is PromiseFulfilledResult<{ i: number; pid: number; ms: number }> =>
				r.status === "fulfilled",
		)
		.map((r) => r.value);
	const rejected = settled.filter((r) => r.status === "rejected");
	const distinctPids = new Set(results.map((r) => r.pid));
	const durations = results.map((r) => r.ms).sort((a, b) => a - b);

	console.log(`\nConnections fired: ${N}`);
	console.log(`Succeeded: ${results.length} · Rejected: ${rejected.length}`);
	if (rejected.length > 0) {
		console.log(
			`First rejection reason: ${String((rejected[0] as PromiseRejectedResult).reason)}`,
		);
	}
	console.log(
		`Distinct backend PIDs observed concurrently: ${distinctPids.size}`,
	);
	if (durations.length > 0) {
		console.log(
			`Duration range: min=${durations[0]}ms max=${durations[durations.length - 1]}ms`,
		);
	}
	console.log(
		`(if all N completed near the ~2000ms pg_sleep, they ran truly concurrently; a duration that grows well past 2000ms per additional connection indicates queuing behind a smaller real pool; outright rejections indicate a hard connection ceiling)`,
	);
}

main().catch((err) => {
	console.error("probe failed:", err);
	process.exit(1);
});
