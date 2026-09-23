import "server-only";

import { eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { comments, markets, modActions, pools } from "@/db/schema";
import {
	coalesceSharedBlock,
	readSharedBlock,
} from "@/server/cache/shared-block-store";
import {
	MARKET_SERIES_MIN_WINDOW_MS,
	SHARED_VIEW_EXPIRE_SEC,
	VERSION_MIN_WINDOW_MS,
} from "@/server/config/limits";
import {
	recordCacheAttempt,
	recordCacheMiss,
} from "@/server/observability/cache-metrics";
import { safeCaptureException } from "@/server/observability/safe-capture";

import { getMarketBySlug } from "./get-by-slug";
import type { MarketStatus } from "./transitions";

// CACHE-COALESCE-3 — the version poll's token, served from the fleet-wide
// store so a poll opens a Postgres connection only when it is the one caller
// fleet-wide re-deriving a market's token for the window.
//
// ⚠ WHY THIS ROUTE, AND WHY IT MATTERED MORE THAN ITS OWN ERRORS. R-18 logged
// 1,000 `/m/[slug]/version` 500s in thirteen seconds, every one
// `(EMAXCONN) max client connections reached, limit: 200` from Supavisor —
// the pooler's CLIENT cap, with Postgres itself nearly idle. A failed poll
// only costs a reader one skipped refresh (`DebatePoll` reads any non-200 as
// "no change"), so the route's own 500s were the smaller harm. The larger one
// is that this route runs as its own Vercel function, so its instances held
// pooler slots the PAGE then could not get — and a page that loses that race
// renders its error boundary under a status already sent as 200. Taking the
// poll off the pooler is what frees those slots.
//
// Two blocks, because the two halves change at different speeds:
//   - `market-id`, keyed on the slug: slug → id is immutable (slug unique, id
//     fixed, no market returns to Draft), so it is served for its whole hour.
//     Only a POSITIVE result is ever written — the render throws on an unknown
//     slug, so a request cannot mint an ENTRY. ⚠ It can still mint a LOCK key
//     for the length of one render: the store takes its lock before rendering.
//     Those expire in `SHARED_VIEW_LOCK_MS` and are released in `finally`.
//   - `version-token`, keyed on the id: the token itself, re-derived at most
//     once per `VERSION_MIN_WINDOW_MS` fleet-wide.
//
// ⛔ THE TOKEN MEANS EXACTLY WHAT IT MEANT. Status, reserves and the
// moderation count, hashed with the same FNV-1a over the same string. The
// moderation count is the SC-1 half: a removal moves no money, and without it
// a removed body would sit on every open tab until the next bet. It is read
// inside the render, so a removal reaches the token within one window.
//
// ⛔ FAIL OPEN, IN TWO DIRECTIONS. Redis down → the store derives directly,
// which is the pre-patch behaviour. Database down → most callers never see
// it: while one caller holds the lock the rest are served the entry already
// in the store, whatever its age. Only a caller that took the lock and failed
// reaches `unavailable`, answered with the last token the store holds, or
// with nothing, which the route answers with 503 and never with 500. That
// cover lasts as long as the token entry: `TOKEN_EXPIRE_MS`, one minute.
//
// ⛔ NEITHER BLOCK WAITS FOR ANOTHER CALLER (`waitMs: 0`). A waiter polls for
// an ENTRY and cannot see the holder fail, so a render that throws — an
// unknown slug, a database outage — made every waiter burn the whole
// `SHARED_VIEW_WAIT_MS` before answering: two seconds held and ~43 Redis
// commands per 404 on a public route (Gate C, measured). Without the wait a
// cold loser renders at once, which is what the route did before the store;
// the collapse comes from the entry, which exists within the first render and
// then serves every caller for its whole window.

export type VersionInputs = {
	status: MarketStatus;
	yes: string | null;
	no: string | null;
	/** `count(*)` arrives as a string from postgres.js; kept as the value it is. */
	moderations: string | number | null;
};

export type VersionResult =
	| { kind: "token"; token: string }
	| { kind: "not-found" }
	| { kind: "unavailable"; lastToken: string | null };

export type VersionDeps = {
	findMarketId: (slug: string) => Promise<string | null>;
	readInputs: (marketId: string) => Promise<VersionInputs | null>;
};

/**
 * The pre-patch token: FNV-1a over `status:yes:no:moderations`, same string,
 * same constants, same defaults.
 *
 * ⚠ ONE STRUCTURAL DIFFERENCE, UNREACHABLE. The old query read `from pools`,
 * so a market with no pool row returned no row and `moderations` fell to the
 * `?? 0` default; the new one joins from `markets`, so the real count is used.
 * A non-Draft market always has a pool row — `openMarket` inserts it in the
 * same transaction as `Draft → Open`, nothing deletes one, and
 * `getMarketBySlug` excludes Draft — so no live token moves.
 */
export function hashVersion(inputs: VersionInputs): string {
	const input = `${inputs.status}:${inputs.yes ?? "0"}:${inputs.no ?? "0"}:${inputs.moderations ?? 0}`;
	let hash = 0x811c9dc5;
	for (let i = 0; i < input.length; i++) {
		hash ^= input.charCodeAt(i);
		hash = Math.imul(hash, 0x01000193) >>> 0;
	}
	return hash.toString(36);
}

const DB_DEPS: VersionDeps = {
	findMarketId: async (slug) => (await getMarketBySlug(db, slug))?.id ?? null,
	readInputs: async (marketId) => {
		const [row] = await db
			.select({
				status: markets.status,
				yes: pools.yesReserves,
				no: pools.noReserves,
				// I-03: both tables aliased — the unaliased form was an ambiguous
				// "id" and 500'd every call (#556).
				moderations: sql<string>`(
					select count(*) from ${modActions} as ma
					join ${comments} as c on c.id = ma.target_comment_id
					where c.market_id = ${marketId}
				)`,
			})
			.from(markets)
			.leftJoin(pools, eq(pools.marketId, markets.id))
			.where(eq(markets.id, marketId))
			.limit(1);
		return row ?? null;
	},
};

/** Thrown from inside a render so that a miss is never written to the store. */
class MarketNotFound extends Error {}

/** One hour — and the window too, because the mapping never changes. */
const MARKET_ID_EXPIRE_MS = MARKET_SERIES_MIN_WINDOW_MS * 60;
/** One minute: the outer bound on serving a token, and so on the fail-open cover. */
const TOKEN_EXPIRE_MS = SHARED_VIEW_EXPIRE_SEC * 1000;

async function lastToken(slug: string): Promise<string | null> {
	try {
		const id = await readSharedBlock<{ id: string }>("market-id", slug);
		if (id === null) return null;
		const token = await readSharedBlock<string>("version-token", id.model.id);
		return token?.model ?? null;
	} catch {
		return null;
	}
}

export async function getVersionToken(
	slug: string,
	deps: VersionDeps = DB_DEPS,
	clock: { now?: () => number; sleep?: (ms: number) => Promise<void> } = {},
): Promise<VersionResult> {
	recordCacheAttempt("version-token", null);
	try {
		const { id } = await coalesceSharedBlock<{ id: string }>({
			block: "market-id",
			marketId: slug,
			windowMs: MARKET_ID_EXPIRE_MS,
			expireMs: MARKET_ID_EXPIRE_MS,
			waitMs: 0,
			render: async () => {
				recordCacheMiss("market-id-render", null);
				const found = await deps.findMarketId(slug);
				if (found === null) throw new MarketNotFound();
				return { id: found };
			},
			...clock,
		});
		const token = await coalesceSharedBlock<string>({
			block: "version-token",
			marketId: id,
			windowMs: VERSION_MIN_WINDOW_MS,
			expireMs: TOKEN_EXPIRE_MS,
			waitMs: 0,
			render: async () => {
				recordCacheMiss("version-token-render", id);
				const inputs = await deps.readInputs(id);
				if (inputs === null) throw new MarketNotFound();
				return hashVersion(inputs);
			},
			...clock,
		});
		return { kind: "token", token };
	} catch (err) {
		if (err instanceof MarketNotFound) return { kind: "not-found" };
		safeCaptureException(err, { tags: { kind: "version-token" } });
		return { kind: "unavailable", lastToken: await lastToken(slug) };
	}
}
