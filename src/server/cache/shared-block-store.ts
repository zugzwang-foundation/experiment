import "server-only";

import {
	SHARED_VIEW_EXPIRE_SEC,
	SHARED_VIEW_LOCK_MS,
	SHARED_VIEW_MAX_BYTES,
	SHARED_VIEW_WAIT_MS,
	SHARED_VIEW_WAIT_POLL_MS,
} from "@/server/config/limits";
import { recordCacheMiss } from "@/server/observability/cache-metrics";
import { safeCaptureException } from "@/server/observability/safe-capture";
import { getRedisKey } from "@/server/upstash/keys";
import { redis } from "@/server/upstash/redis";

// CACHE-COALESCE-2 — one render per (block, market) per window, FLEET-WIDE.
//
// CACHE-COALESCE-1 (ADR-0051 P1) built this for the debate view and measured
// it on production: 2,995 per-instance misses became 56 database renders in a
// burst. The same burst then saturated Postgres through the two blocks the
// HOME page reads per market — the price walk and the market data — because
// each was still deduped inside one Vercel instance only (R-16, I-19). This
// is the debate-view store with the block name lifted into a parameter; the
// debate-view keys are byte-identical to what #570 shipped, so the entries
// already in Upstash survive the deploy.
//
// ⛔ FAIL OPEN, ALWAYS. Every Redis failure — a bad `ZUGZWANG_ENV`, which makes
// `getRedisKey` throw, and a malformed market id alike — degrades to "render
// locally", which is exactly what the block did before it was wrapped. A
// cache must never be the reason a page fails to render.
//
// ⚠ AND NOT THE REASON ONE RENDERS SLOWLY, WHICH IS A DIFFERENT PROPERTY. The
// cold-block wait (`waitMs`) is bounded by wall clock PER CALL; a page that
// reads several blocks in series pays it several times. The debate page reads
// one block and keeps the wait; the home page reads two per market for eight
// markets in a serial loop, so its blocks pass `waitMs: 0` and a loser with
// no entry renders locally at once. Gate C (`@code-reviewer`, 2026-09-23)
// measured the alternative at up to ~32 s of serial stall on the surface this
// change exists to speed up.
//
// ⛔ NOTHING VIEWER-SCOPED ENTERS. An entry is shared verbatim by every reader
// of the market across every instance. Each caller's `render` is a
// viewer-independent derivation by construction, and the contract scans
// (`cached-view-contract.test.ts`, `coalesce-wiring.test.ts`) read the
// callers to keep it so.
//
// ⚠ THE ENTRY IS A JSON ROUND TRIP. A block's `T` must survive
// `JSON.parse(JSON.stringify(t))` unchanged — any JSON value: strings,
// numbers, booleans, null, arrays and plain objects; never `undefined`. A `Date` comes back a string with no
// type error anywhere; `toWireWalk` is the one place a `Date` is converted
// before it reaches here, and it is why the walk is stored in wire form.
//
// ⚠ `Date.now()` and `Math.random()` are called inside `'use cache'` bodies
// here, and that is the one place in the tree where that is fine: neither
// value enters the cached result. The clock decides freshness and the random
// half of the lock token decides ownership; the model that is returned and
// stored is `render()`'s alone. `cache-metrics.ts` refuses `Math.random()` in
// a render for the opposite reason — there it could change what is cached.
//
// SC-1 — a block that carries argument text (the debate view, the hero in the
// market data) has to lose a removed body against every race, not only the
// tidy case:
//   1. `markMarketTextRemoved` writes a `removedAt` marker AND deletes the
//      entry, for every text-carrying block, each attempted even if another
//      fails — one Redis timeout must not leave the half nobody is watching.
//   2. A reader ignores any entry rendered at or before the marker.
//   3. A writer whose render STARTED at or before the marker refuses to write.
// A block that carries no text (the reserve walk) is never marked; the marker
// is per block, so marking one never disturbs its siblings.
//
// Size: over `SHARED_VIEW_MAX_BYTES` the entry is not written; an `oversize`
// flag tells every instance to render locally without locking or waiting, so
// the feature degrades to the pre-wrap behaviour rather than into a latency
// tax. ⚠ The flag's TTL is `SHARED_VIEW_EXPIRE_SEC` for EVERY block, not the
// block's own expire — the walk's expire is an hour, and an hour-long flag on
// a walk that only ever grows would switch the single-flight off for good on
// exactly the market that needs it most.

/**
 * The closed set of per-market blocks. A typo here is a compile error, not a
 * second keyspace. Every block is keyed on a market id EXCEPT `market-id`,
 * which is keyed on the slug it resolves (CACHE-COALESCE-3) — see
 * `assertKey`, which checks each against its own shape.
 */
export type SharedBlock =
	| "debate-view"
	| "reserve-walk"
	| "market-data"
	| "market-id"
	| "version-token";

/** The blocks whose entries carry comment text and must honour a removal (SC-1). */
export const TEXT_CARRYING_BLOCKS: readonly SharedBlock[] = [
	"debate-view",
	"market-data",
];

export interface SharedBlockEntry<T> {
	readonly model: T;
	/** `Date.now()` at the render that produced `model`. */
	readonly renderedAt: number;
	/** Caller-defined identity of the inputs; any difference is a stale entry. */
	readonly summary: string;
}

const UUID_RE =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Every key passes through here. The id is a DATABASE-RESOLVED market id at
 * every call site today (`cached-series.ts`'s docblock explains why that is
 * a convention, not a signature); this check makes it structural, so a
 * future route that passed a request parameter straight in could not write
 * arbitrarily many entries into the namespace that also carries idempotency
 * and rate-limit keys. It throws, and every caller's throw is a fail-open.
 */
function assertKey(block: SharedBlock, key: string): void {
	if (block === "market-id") {
		if (key.length > SLUG_MAX_LENGTH || !SLUG_RE.test(key)) {
			throw new Error(`shared-block-store: not a slug: ${key}`);
		}
		return;
	}
	if (!UUID_RE.test(key)) {
		throw new Error(`shared-block-store: not a market id: ${key}`);
	}
}

/**
 * `market-id` is the one block keyed on a REQUEST value — the first place a
 * request value reaches `redis.set` — so its guard is the schema's own slug
 * rule, `markets/create.ts` `SLUG_RE` and `SLUG_MAX_LENGTH` (80), repeated
 * rather than imported so this module keeps no dependency on the write path.
 * `SLUG_RE` admits no `:`, so a slug cannot forge a segment of the
 * colon-joined key. Shape alone does not stop a caller naming a slug that
 * does not exist: the caller's render throws on one, so no ENTRY is written,
 * but the lock key taken before the render is (10 s, released in `finally`).
 * ⚠ The guards are not disjoint — a UUID is also slug-shaped — which is
 * harmless because every block has its own key prefix.
 */
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SLUG_MAX_LENGTH = 80;

export function sharedBlockKey(block: SharedBlock, marketId: string): string {
	assertKey(block, marketId);
	return getRedisKey("cache", block, marketId);
}

export function sharedBlockLockKey(
	block: SharedBlock,
	marketId: string,
): string {
	assertKey(block, marketId);
	return getRedisKey("cache", block, "lock", marketId);
}

export function sharedBlockRemovedKey(
	block: SharedBlock,
	marketId: string,
): string {
	assertKey(block, marketId);
	return getRedisKey("cache", block, "removed", marketId);
}

export function sharedBlockOversizeKey(
	block: SharedBlock,
	marketId: string,
): string {
	assertKey(block, marketId);
	return getRedisKey("cache", block, "oversize", marketId);
}

const OVERSIZE_FLAG_MS = SHARED_VIEW_EXPIRE_SEC * 1000;
const REMOVED_MARKER_MS = SHARED_VIEW_EXPIRE_SEC * 1000;

function parseEntry<T>(raw: unknown): SharedBlockEntry<T> | null {
	if (typeof raw !== "string") return null;
	try {
		const parsed: unknown = JSON.parse(raw);
		if (
			typeof parsed !== "object" ||
			parsed === null ||
			typeof (parsed as SharedBlockEntry<T>).renderedAt !== "number" ||
			typeof (parsed as SharedBlockEntry<T>).summary !== "string" ||
			!("model" in parsed) ||
			(parsed as SharedBlockEntry<T>).model === undefined
		) {
			return null;
		}
		return parsed as SharedBlockEntry<T>;
	} catch {
		return null;
	}
}

function parseStamp(raw: unknown): number | null {
	if (typeof raw !== "string") return null;
	const n = Number(raw);
	return Number.isFinite(n) ? n : null;
}

/**
 * The shared entry, or null when absent, expired, unreadable — or rendered
 * at or before the block's last removal marker (SC-1 rule 2).
 */
export async function readSharedBlock<T>(
	block: SharedBlock,
	marketId: string,
): Promise<SharedBlockEntry<T> | null> {
	const [rawEntry, rawRemoved] = await redis.mget<
		[string | null, string | null]
	>(sharedBlockKey(block, marketId), sharedBlockRemovedKey(block, marketId));
	const entry = parseEntry<T>(rawEntry);
	if (entry === null) return null;
	const removedAt = parseStamp(rawRemoved);
	if (removedAt !== null && entry.renderedAt <= removedAt) return null;
	return entry;
}

/**
 * Write the entry unless (a) a removal marker is newer than the render's
 * start (SC-1 rule 3) or (b) it is too large for the store, in which case the
 * oversize flag is raised instead. Returns whether the entry was written.
 */
export async function writeSharedBlock<T>(
	block: SharedBlock,
	marketId: string,
	entry: SharedBlockEntry<T>,
	expireMs: number,
	renderStartedAt: number = entry.renderedAt,
): Promise<boolean> {
	const removedAt = parseStamp(
		await redis.get<string>(sharedBlockRemovedKey(block, marketId)),
	);
	if (removedAt !== null && renderStartedAt <= removedAt) return false;
	const serialized = JSON.stringify(entry);
	if (serialized.length > SHARED_VIEW_MAX_BYTES) {
		recordCacheMiss(`${block}-oversize`, marketId);
		await redis.set(sharedBlockOversizeKey(block, marketId), "1", {
			px: OVERSIZE_FLAG_MS,
		});
		return false;
	}
	await redis.set(sharedBlockKey(block, marketId), serialized, {
		px: expireMs,
	});
	return true;
}

/**
 * Moderation removal (SC-1 rule 1) for ONE block: stamp the marker, then
 * delete the entry. The marker outlives any entry or in-flight render that
 * could carry the body.
 */
export async function markSharedBlockRemoved(
	block: SharedBlock,
	marketId: string,
): Promise<void> {
	await redis.set(sharedBlockRemovedKey(block, marketId), String(Date.now()), {
		px: REMOVED_MARKER_MS,
	});
	await redis.del(sharedBlockKey(block, marketId));
}

/**
 * Moderation removal for EVERY text-carrying block on the market. Each block
 * is attempted regardless of the others — a timeout on the first must not
 * skip the second — and the first failure is rethrown once all have run, so
 * the caller's best-effort catch still sees it.
 */
export async function markMarketTextRemoved(marketId: string): Promise<void> {
	const results = await Promise.allSettled(
		TEXT_CARRYING_BLOCKS.map((block) =>
			markSharedBlockRemoved(block, marketId),
		),
	);
	const failed = results.find(
		(r): r is PromiseRejectedResult => r.status === "rejected",
	);
	if (failed) throw failed.reason;
}

const defaultSleep = (ms: number) =>
	new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Release only our own lock — a holder that overran PX must not delete its successor's. */
const RELEASE_IF_OWNER =
	"if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) end return 0";

/**
 * Single-flight around `render` for one (block, market).
 *
 *   oversize flag set       → render locally, no lock, no wait
 *   fresh entry             → serve it, no render, no lock
 *   stale/absent, lock won  → render, write (unless removed/oversize), release
 *   stale, lock lost        → serve the stale entry if its summary still matches
 *   absent, lock lost       → poll for the holder's entry for up to `waitMs`
 *                             of WALL CLOCK, then render locally; `waitMs: 0`
 *                             renders locally at once
 *   Redis error anywhere    → render locally
 */
export async function coalesceSharedBlock<T>(args: {
	block: SharedBlock;
	marketId: string;
	/** Identity of the render's inputs beyond the market id; "" when none. */
	summary?: string;
	/** How long an entry is served without a re-render. */
	windowMs: number;
	/** The entry's TTL — the outer bound on serving it stale. */
	expireMs: number;
	/** The cold-block wait; defaults to `SHARED_VIEW_WAIT_MS`. See the docblock on why a multi-block page passes 0. */
	waitMs?: number;
	render: () => Promise<T>;
	now?: () => number;
	sleep?: (ms: number) => Promise<void>;
}): Promise<T> {
	const { block, marketId, render, windowMs, expireMs } = args;
	const summary = args.summary ?? "";
	const waitMs = args.waitMs ?? SHARED_VIEW_WAIT_MS;
	const now = args.now ?? Date.now;
	const sleep = args.sleep ?? defaultSleep;

	let lockKey: string;
	let entry: SharedBlockEntry<T> | null;
	try {
		lockKey = sharedBlockLockKey(block, marketId);
		if (
			(await redis.get<string>(sharedBlockOversizeKey(block, marketId))) !==
			null
		) {
			return render();
		}
		entry = await readSharedBlock<T>(block, marketId);
	} catch (err) {
		safeCaptureException(err, { tags: { kind: "shared-block-read", block } });
		return render();
	}
	if (
		entry !== null &&
		entry.summary === summary &&
		now() - entry.renderedAt < windowMs
	) {
		return entry.model;
	}

	const token = `${now()}-${Math.random().toString(36).slice(2)}`;
	let locked = false;
	try {
		locked =
			(await redis.set(lockKey, token, {
				nx: true,
				px: SHARED_VIEW_LOCK_MS,
			})) === "OK";
	} catch (err) {
		safeCaptureException(err, { tags: { kind: "shared-block-lock", block } });
		return render();
	}

	if (locked) {
		try {
			const renderStartedAt = now();
			const model = await render();
			try {
				await writeSharedBlock(
					block,
					marketId,
					{ model, renderedAt: now(), summary },
					expireMs,
					renderStartedAt,
				);
			} catch (err) {
				safeCaptureException(err, {
					tags: { kind: "shared-block-write", block },
				});
			}
			return model;
		} finally {
			try {
				await redis.eval(RELEASE_IF_OWNER, [lockKey], [token]);
			} catch {
				// The lock's PX expiry releases it; nothing else to do.
			}
		}
	}

	// Another instance is rendering. A stale entry of the SAME inputs beats a
	// second render of the same thing; anything else means this block is cold
	// for the whole fleet, so wait briefly for the holder rather than pile on —
	// bounded by wall clock, because each poll may itself be slow.
	if (entry !== null && entry.summary === summary) return entry.model;
	const deadline = now() + waitMs;
	while (now() < deadline) {
		await sleep(SHARED_VIEW_WAIT_POLL_MS);
		try {
			if (
				(await redis.get<string>(sharedBlockOversizeKey(block, marketId))) !==
				null
			) {
				break;
			}
			const arrived = await readSharedBlock<T>(block, marketId);
			if (arrived !== null && arrived.summary === summary) {
				return arrived.model;
			}
		} catch (err) {
			safeCaptureException(err, { tags: { kind: "shared-block-wait", block } });
			break;
		}
	}
	return render();
}
