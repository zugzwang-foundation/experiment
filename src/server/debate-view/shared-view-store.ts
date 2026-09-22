import "server-only";

import {
	SHARED_VIEW_EXPIRE_SEC,
	SHARED_VIEW_LOCK_MS,
	SHARED_VIEW_MAX_BYTES,
	SHARED_VIEW_MIN_WINDOW_MS,
	SHARED_VIEW_WAIT_MS,
	SHARED_VIEW_WAIT_POLL_MS,
} from "@/server/config/limits";
import type { MarketSummary } from "@/server/markets/get-by-slug";
import { recordCacheMiss } from "@/server/observability/cache-metrics";
import { safeCaptureException } from "@/server/observability/safe-capture";
import { getRedisKey } from "@/server/upstash/keys";
import { redis } from "@/server/upstash/redis";

import type { DebateViewModel } from "./load-debate-view";

// CACHE-COALESCE-1 — one debate-view render per market per window, FLEET-WIDE.
//
// `'use cache'` (cached-view.ts) dedupes renders inside ONE Vercel instance.
// Measured on production at 5,000 readers: ~3,800 renders/min against a 15 s
// window that should cost 4/min/market — the fleet was paying
// instances × markets × 4/min, and a burst cold-started every instance at once
// (load-test I-07/I-17/I-18). This store puts the shared entry in Upstash and a
// lock in front of the render: when the window has passed, ONE instance renders
// and every other instance serves the previous entry until the new one lands.
//
// ⛔ FAIL OPEN, ALWAYS. Every Redis failure — and a bad `ZUGZWANG_ENV`, which
// makes `getRedisKey` throw — degrades to "render locally", which is exactly
// what the page did before this file existed. A cache must never be the reason
// a page fails to render, and it must never be the reason one renders SLOWLY
// either: the cold-market wait is bounded by wall clock, not by sleep count.
//
// ⛔ NOTHING VIEWER-SCOPED ENTERS. The entry is shared verbatim by every reader
// of the market; the render callback is `loadDebateView`, which is viewer-
// independent by construction (ADR-0034). The poster bypass stays at the page.
// `cached-view-contract.test.ts` scans this file for viewer routes too.
//
// SC-1 — the entry holds comment bodies, so a removal has to win against every
// race, not only the tidy case:
//   1. `markSharedViewRemoved` writes a `removedAt` marker AND deletes the entry.
//   2. A reader ignores any entry rendered before the marker — so an entry that
//      survived the delete (or was re-promoted into an instance's L1 between the
//      delete and the tag) is never served.
//   3. A writer whose render STARTED before the marker refuses to write — so a
//      render in flight when the removal committed cannot resurrect the body.
//
// Size: a `DebateViewModel` over a few hundred comments approaches Upstash's
// value limit. An oversize render is not written; instead an `oversize` flag
// tells every instance to render locally without locking or waiting, so the
// feature degrades to the pre-patch behaviour rather than into a latency tax.

export interface SharedViewEntry {
	readonly model: DebateViewModel;
	/** `Date.now()` at the render that produced `model`. */
	readonly renderedAt: number;
	/** `JSON.stringify(market)` at render time; any difference is a stale entry. */
	readonly summary: string;
}

export function sharedViewKey(marketId: string): string {
	return getRedisKey("cache", "debate-view", marketId);
}

export function sharedViewLockKey(marketId: string): string {
	return getRedisKey("cache", "debate-view", "lock", marketId);
}

export function sharedViewRemovedKey(marketId: string): string {
	return getRedisKey("cache", "debate-view", "removed", marketId);
}

export function sharedViewOversizeKey(marketId: string): string {
	return getRedisKey("cache", "debate-view", "oversize", marketId);
}

const EXPIRE_MS = SHARED_VIEW_EXPIRE_SEC * 1000;

function summaryOf(market: MarketSummary): string {
	return JSON.stringify(market);
}

function parseEntry(raw: unknown): SharedViewEntry | null {
	if (typeof raw !== "string") return null;
	try {
		const parsed: unknown = JSON.parse(raw);
		if (
			typeof parsed !== "object" ||
			parsed === null ||
			typeof (parsed as SharedViewEntry).renderedAt !== "number" ||
			typeof (parsed as SharedViewEntry).summary !== "string" ||
			typeof (parsed as SharedViewEntry).model !== "object"
		) {
			return null;
		}
		return parsed as SharedViewEntry;
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
 * before the market's last removal marker (SC-1 rule 2).
 */
export async function readSharedView(
	marketId: string,
): Promise<SharedViewEntry | null> {
	const [rawEntry, rawRemoved] = await redis.mget<
		[string | null, string | null]
	>(sharedViewKey(marketId), sharedViewRemovedKey(marketId));
	const entry = parseEntry(rawEntry);
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
export async function writeSharedView(
	marketId: string,
	entry: SharedViewEntry,
	renderStartedAt: number = entry.renderedAt,
): Promise<boolean> {
	const removedAt = parseStamp(
		await redis.get<string>(sharedViewRemovedKey(marketId)),
	);
	if (removedAt !== null && renderStartedAt <= removedAt) return false;
	const serialized = JSON.stringify(entry);
	if (serialized.length > SHARED_VIEW_MAX_BYTES) {
		recordCacheMiss("debate-view-oversize", marketId);
		await redis.set(sharedViewOversizeKey(marketId), "1", { px: EXPIRE_MS });
		return false;
	}
	await redis.set(sharedViewKey(marketId), serialized, { px: EXPIRE_MS });
	return true;
}

/**
 * Moderation removal (SC-1 rule 1): stamp the marker, then delete the entry.
 * The marker outlives any entry or in-flight render that could carry the body.
 */
export async function markSharedViewRemoved(marketId: string): Promise<void> {
	await redis.set(sharedViewRemovedKey(marketId), String(Date.now()), {
		px: EXPIRE_MS,
	});
	await redis.del(sharedViewKey(marketId));
}

function isFresh(
	entry: SharedViewEntry,
	summary: string,
	now: number,
): boolean {
	return (
		entry.summary === summary &&
		now - entry.renderedAt < SHARED_VIEW_MIN_WINDOW_MS
	);
}

const defaultSleep = (ms: number) =>
	new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Release only our own lock — a holder that overran PX must not delete its successor's. */
const RELEASE_IF_OWNER =
	"if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) end return 0";

/**
 * Single-flight around `render`.
 *
 *   oversize flag set       → render locally, no lock, no wait
 *   fresh entry             → serve it, no render, no lock
 *   stale/absent, lock won  → render, write (unless removed/oversize), release
 *   stale, lock lost        → serve the stale entry if its summary still matches
 *   absent, lock lost       → poll for the holder's entry until SHARED_VIEW_WAIT_MS
 *                             of WALL CLOCK has passed, then render locally
 *   Redis error anywhere    → render locally
 */
export async function coalesceDebateView(args: {
	market: MarketSummary;
	render: () => Promise<DebateViewModel>;
	now?: () => number;
	sleep?: (ms: number) => Promise<void>;
}): Promise<DebateViewModel> {
	const { market, render } = args;
	const now = args.now ?? Date.now;
	const sleep = args.sleep ?? defaultSleep;
	const summary = summaryOf(market);

	let lockKey: string;
	let entry: SharedViewEntry | null;
	try {
		lockKey = sharedViewLockKey(market.id);
		if ((await redis.get<string>(sharedViewOversizeKey(market.id))) !== null) {
			return render();
		}
		entry = await readSharedView(market.id);
	} catch (err) {
		safeCaptureException(err, { tags: { kind: "shared-view-read" } });
		return render();
	}
	if (entry !== null && isFresh(entry, summary, now())) {
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
		safeCaptureException(err, { tags: { kind: "shared-view-lock" } });
		return render();
	}

	if (locked) {
		try {
			const renderStartedAt = now();
			const model = await render();
			try {
				await writeSharedView(
					market.id,
					{ model, renderedAt: now(), summary },
					renderStartedAt,
				);
			} catch (err) {
				safeCaptureException(err, { tags: { kind: "shared-view-write" } });
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

	// Another instance is rendering. A stale entry of the SAME market summary
	// beats a second render of the same thing; anything else means this market
	// is cold for the whole fleet, so wait briefly for the holder rather than
	// pile on — bounded by wall clock, because each poll may itself be slow.
	if (entry !== null && entry.summary === summary) return entry.model;
	const deadline = now() + SHARED_VIEW_WAIT_MS;
	while (now() < deadline) {
		await sleep(SHARED_VIEW_WAIT_POLL_MS);
		try {
			if (
				(await redis.get<string>(sharedViewOversizeKey(market.id))) !== null
			) {
				break;
			}
			const arrived = await readSharedView(market.id);
			if (arrived !== null && arrived.summary === summary) {
				return arrived.model;
			}
		} catch (err) {
			safeCaptureException(err, { tags: { kind: "shared-view-wait" } });
			break;
		}
	}
	return render();
}
