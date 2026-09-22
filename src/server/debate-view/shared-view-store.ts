import "server-only";

import {
	SHARED_VIEW_EXPIRE_SEC,
	SHARED_VIEW_LOCK_MS,
	SHARED_VIEW_MIN_WINDOW_MS,
	SHARED_VIEW_WAIT_MS,
	SHARED_VIEW_WAIT_POLL_MS,
} from "@/server/config/limits";
import type { MarketSummary } from "@/server/markets/get-by-slug";
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
// ⛔ FAIL OPEN, ALWAYS. Every Redis failure degrades to "render locally", which
// is exactly what the page did before this file existed. A cache must never be
// the reason a page fails to render.
//
// ⛔ NOTHING VIEWER-SCOPED ENTERS. The entry is shared verbatim by every reader
// of the market; the render callback is `loadDebateView`, which is viewer-
// independent by construction (ADR-0034). The poster bypass stays at the page.
//
// SC-1 — the entry holds comment bodies. Moderation removal calls
// `deleteSharedView` beside its `updateTag`, so a removed body cannot be served
// from here past the removal; the store test asserts the BODY's absence.

export interface SharedViewEntry {
	readonly model: DebateViewModel;
	/** `Date.now()` at the render that produced `model`. */
	readonly renderedAt: number;
	/** `market.status` at render time; a mismatch is a stale entry. */
	readonly status: string;
}

export function sharedViewKey(marketId: string): string {
	return getRedisKey("cache", "debate-view", marketId);
}

export function sharedViewLockKey(marketId: string): string {
	return getRedisKey("cache", "debate-view", "lock", marketId);
}

/** The shared entry, or null when absent, expired or unreadable. */
export async function readSharedView(
	marketId: string,
): Promise<SharedViewEntry | null> {
	const raw = await redis.get<string>(sharedViewKey(marketId));
	if (typeof raw !== "string") return null;
	try {
		const parsed: unknown = JSON.parse(raw);
		if (
			typeof parsed !== "object" ||
			parsed === null ||
			typeof (parsed as SharedViewEntry).renderedAt !== "number" ||
			typeof (parsed as SharedViewEntry).status !== "string" ||
			typeof (parsed as SharedViewEntry).model !== "object"
		) {
			return null;
		}
		return parsed as SharedViewEntry;
	} catch {
		return null;
	}
}

export async function writeSharedView(
	marketId: string,
	entry: SharedViewEntry,
): Promise<void> {
	await redis.set(sharedViewKey(marketId), JSON.stringify(entry), {
		px: SHARED_VIEW_EXPIRE_SEC * 1000,
	});
}

/** Moderation removal: the entry must not outlive the content it holds. */
export async function deleteSharedView(marketId: string): Promise<void> {
	await redis.del(sharedViewKey(marketId));
}

function isFresh(
	entry: SharedViewEntry,
	market: MarketSummary,
	now: number,
): boolean {
	return (
		entry.status === market.status &&
		now - entry.renderedAt < SHARED_VIEW_MIN_WINDOW_MS
	);
}

const defaultSleep = (ms: number) =>
	new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Single-flight around `render`.
 *
 *   fresh entry            → serve it, no render, no lock
 *   stale/absent, lock won → render, write, release, serve the new model
 *   stale, lock lost       → serve the stale entry (≤ SHARED_VIEW_EXPIRE_SEC old)
 *   absent, lock lost      → poll for the holder's entry up to SHARED_VIEW_WAIT_MS,
 *                            then render locally rather than fail
 *   Redis error anywhere   → render locally
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
	const lockKey = sharedViewLockKey(market.id);

	let entry: SharedViewEntry | null;
	try {
		entry = await readSharedView(market.id);
	} catch (err) {
		safeCaptureException(err, { tags: { kind: "shared-view-read" } });
		return render();
	}
	if (entry !== null && isFresh(entry, market, now())) {
		return entry.model;
	}

	let locked = false;
	try {
		locked =
			(await redis.set(lockKey, "1", { nx: true, px: SHARED_VIEW_LOCK_MS })) ===
			"OK";
	} catch (err) {
		safeCaptureException(err, { tags: { kind: "shared-view-lock" } });
		return render();
	}

	if (locked) {
		try {
			const model = await render();
			try {
				await writeSharedView(market.id, {
					model,
					renderedAt: now(),
					status: market.status,
				});
			} catch (err) {
				safeCaptureException(err, { tags: { kind: "shared-view-write" } });
			}
			return model;
		} finally {
			try {
				await redis.del(lockKey);
			} catch {
				// The lock's PX expiry releases it; nothing else to do.
			}
		}
	}

	// Another instance is rendering. A stale entry is better than a second
	// render of the same thing; no entry at all means this market is cold for
	// the whole fleet, so wait briefly for the holder rather than pile on.
	if (entry !== null) return entry.model;
	let waited = 0;
	while (waited < SHARED_VIEW_WAIT_MS) {
		await sleep(SHARED_VIEW_WAIT_POLL_MS);
		waited += SHARED_VIEW_WAIT_POLL_MS;
		try {
			const arrived = await readSharedView(market.id);
			if (arrived !== null && arrived.status === market.status) {
				return arrived.model;
			}
		} catch (err) {
			safeCaptureException(err, { tags: { kind: "shared-view-wait" } });
			break;
		}
	}
	return render();
}
