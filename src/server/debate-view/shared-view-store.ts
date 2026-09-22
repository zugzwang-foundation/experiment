import "server-only";

import {
	coalesceSharedBlock,
	readSharedBlock,
	type SharedBlockEntry,
	sharedBlockKey,
	sharedBlockLockKey,
	sharedBlockOversizeKey,
	sharedBlockRemovedKey,
	writeSharedBlock,
} from "@/server/cache/shared-block-store";
import {
	SHARED_VIEW_EXPIRE_SEC,
	SHARED_VIEW_MIN_WINDOW_MS,
} from "@/server/config/limits";
import type { MarketSummary } from "@/server/markets/get-by-slug";

import type { DebateViewModel } from "./load-debate-view";

// CACHE-COALESCE-1 — one debate-view render per market per window, FLEET-WIDE
// (ADR-0051 P1). Since CACHE-COALESCE-2 (P2) the mechanism lives in
// `@/server/cache/shared-block-store` and this file is the debate view's
// binding of it: the `debate-view` block, a `SHARED_VIEW_MIN_WINDOW_MS`
// window, `SHARED_VIEW_EXPIRE_SEC` as the TTL, and the market summary as the
// entry's identity so a lifecycle transition or a title edit misses like a
// window expiry does. The keys are the ones #570 shipped.
//
// `cached-view-contract.test.ts` scans this file for viewer routes: nothing
// viewer-scoped may enter, because the entry is served to every reader.
// Removal lives with the block list: `markMarketTextRemoved` in the store.

const BLOCK = "debate-view";
const EXPIRE_MS = SHARED_VIEW_EXPIRE_SEC * 1000;

export type SharedViewEntry = SharedBlockEntry<DebateViewModel>;

export function sharedViewKey(marketId: string): string {
	return sharedBlockKey(BLOCK, marketId);
}

export function sharedViewLockKey(marketId: string): string {
	return sharedBlockLockKey(BLOCK, marketId);
}

export function sharedViewRemovedKey(marketId: string): string {
	return sharedBlockRemovedKey(BLOCK, marketId);
}

export function sharedViewOversizeKey(marketId: string): string {
	return sharedBlockOversizeKey(BLOCK, marketId);
}

export function readSharedView(
	marketId: string,
): Promise<SharedViewEntry | null> {
	return readSharedBlock<DebateViewModel>(BLOCK, marketId);
}

export function writeSharedView(
	marketId: string,
	entry: SharedViewEntry,
	renderStartedAt: number = entry.renderedAt,
): Promise<boolean> {
	return writeSharedBlock(BLOCK, marketId, entry, EXPIRE_MS, renderStartedAt);
}

export function coalesceDebateView(args: {
	market: MarketSummary;
	render: () => Promise<DebateViewModel>;
	now?: () => number;
	sleep?: (ms: number) => Promise<void>;
}): Promise<DebateViewModel> {
	return coalesceSharedBlock<DebateViewModel>({
		block: BLOCK,
		marketId: args.market.id,
		summary: JSON.stringify(args.market),
		windowMs: SHARED_VIEW_MIN_WINDOW_MS,
		expireMs: EXPIRE_MS,
		render: args.render,
		now: args.now,
		sleep: args.sleep,
	});
}
