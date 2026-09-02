/**
 * RELAY C2 deliverable #2 — the segmented hit-rate report.
 *
 * Read-only. Scans the `cache-metric` keyspace the RELAY C2 counters write
 * (see `src/server/observability/cache-metrics.ts`) and prints, per block and
 * per market: attempts, misses, and the derived hit rate
 * (`1 - misses/attempts`) — plus reserve-walk derivation counts and the last
 * invalidation timestamp per tag.
 *
 * This is the "segmentation by market write-rate" the Day-1 pack's C2 asks
 * for (⭐ requirement #2): NOT new instrumentation, a post-hoc read over the
 * counters the wiring already writes, keyed by marketId. Point it at a
 * designated hot market's id and a zero-write market's id (once C1's volume
 * fixture exists) to see the finding directly — a hot market's hit rate
 * should visibly trail a zero-write market's.
 *
 * Zero writes. Zero DB access. GET/SCAN against Upstash only.
 *
 * Usage:
 *   doppler run --project zugzwang-experiment --config stg -- \
 *     pnpm tsx scripts/cache-hit-rate.ts [marketId ...]
 *
 * With no marketId args, reports every market the counters have seen plus
 * the "global" (non-market-scoped) segment. With one or more marketId args,
 * reports only those — the intended shape for a hot-vs-zero-write
 * side-by-side comparison.
 */
import { redis } from "@/server/upstash/redis";

const ENV = process.env.ZUGZWANG_ENV;
if (!ENV) {
	console.error("ZUGZWANG_ENV is not set — refusing to guess a keyspace.");
	process.exit(1);
}

const PREFIX = `${ENV}:cache-metric:`;

type Row = {
	block: string;
	kind: string;
	marketId: string;
	value: number;
};

async function scanAll(pattern: string): Promise<string[]> {
	const keys: string[] = [];
	let cursor = 0;
	do {
		// eslint-disable-next-line no-await-in-loop -- SCAN is inherently sequential
		const [next, batch] = await redis.scan(cursor, {
			match: pattern,
			count: 200,
		});
		keys.push(...batch);
		cursor = Number(next);
	} while (cursor !== 0);
	return keys;
}

function parseKey(key: string): Omit<Row, "value"> | null {
	// `${env}:cache-metric:${block}:${kind}:${marketId}` — marketId itself may
	// contain no colons (UUIDv7), except the reserve-walk block whose kind is
	// "derivations" and the invalidation block whose marketId slot is a TAG
	// that can itself contain a colon (e.g. "market:<id>") — rsplit is wrong
	// there, so this parser takes the first two colon-delimited segments after
	// the prefix as block/kind and treats everything after as the id/tag verbatim.
	if (!key.startsWith(PREFIX)) return null;
	const rest = key.slice(PREFIX.length);
	const firstColon = rest.indexOf(":");
	const secondColon = rest.indexOf(":", firstColon + 1);
	if (firstColon === -1 || secondColon === -1) return null;
	return {
		block: rest.slice(0, firstColon),
		kind: rest.slice(firstColon + 1, secondColon),
		marketId: rest.slice(secondColon + 1),
	};
}

async function main() {
	const filterIds = new Set(process.argv.slice(2));
	const keys = await scanAll(`${PREFIX}*`);

	if (keys.length === 0) {
		console.log(
			`No cache-metric keys found under "${PREFIX}*" — either no cached render has happened yet, or the counters haven't been exercised in this environment.`,
		);
		return;
	}

	const rows: Row[] = [];
	for (const key of keys) {
		const parsed = parseKey(key);
		if (!parsed) continue;
		if (filterIds.size > 0 && !filterIds.has(parsed.marketId)) continue;
		const raw = await redis.get(key);
		const value = typeof raw === "string" ? Number(raw) : Number(raw ?? 0);
		rows.push({ ...parsed, value: Number.isFinite(value) ? value : 0 });
	}

	// Group by block + marketId for the attempts/misses hit-rate blocks.
	const byBlockMarket = new Map<
		string,
		{ attempts?: number; misses?: number }
	>();
	const derivations = new Map<string, number>();
	const invalidations = new Map<string, number>();

	for (const r of rows) {
		if (r.block === "reserve-walk" && r.kind === "derivations") {
			derivations.set(r.marketId, r.value);
			continue;
		}
		if (r.block === "invalidation" && r.kind === "invalidated-at") {
			invalidations.set(r.marketId, r.value);
			continue;
		}
		const groupKey = `${r.block}::${r.marketId}`;
		const entry = byBlockMarket.get(groupKey) ?? {};
		if (r.kind === "attempts") entry.attempts = r.value;
		if (r.kind === "misses") entry.misses = r.value;
		byBlockMarket.set(groupKey, entry);
	}

	console.log(
		`\ncache-metric report — env=${ENV}, ${keys.length} keys scanned\n`,
	);
	console.log(
		"block".padEnd(16) +
			"market".padEnd(38) +
			"attempts".padEnd(10) +
			"misses".padEnd(8) +
			"hit rate",
	);
	console.log("-".repeat(90));
	for (const [groupKey, { attempts, misses }] of [...byBlockMarket].sort()) {
		const [block, marketId] = groupKey.split("::");
		const a = attempts ?? 0;
		const m = misses ?? 0;
		const hitRate = a > 0 ? `${(((a - m) / a) * 100).toFixed(1)}%` : "n/a";
		console.log(
			(block ?? "").padEnd(16) +
				(marketId ?? "").padEnd(38) +
				String(a).padEnd(10) +
				String(m).padEnd(8) +
				hitRate,
		);
	}

	if (derivations.size > 0) {
		console.log("\nreserve-walk derivations (per minute window, coalesced):");
		for (const [marketId, count] of [...derivations].sort()) {
			console.log(`  ${marketId}: ${count}`);
		}
	}

	if (invalidations.size > 0) {
		console.log("\nlast invalidation timestamp per tag:");
		for (const [tag, ts] of [...invalidations].sort()) {
			console.log(`  ${tag}: ${new Date(ts).toISOString()}`);
		}
	}

	console.log(
		"\nSegmentation reading: compare a designated hot market's row against a\n" +
			"zero-write market's row in the same block. The finding this exists to\n" +
			"surface (Day-1 pack C2 ⭐#2) is the hot market's hit rate trailing the\n" +
			"zero-write market's — invisible in any single-aggregate figure.\n",
	);
}

main().catch((err) => {
	console.error("cache-hit-rate: failed", err);
	process.exit(1);
});
