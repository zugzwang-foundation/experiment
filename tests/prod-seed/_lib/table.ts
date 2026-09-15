// SEED-1-DUMMY — the seed table: its shape and the rules every row must meet.
// NEVER import this from src/**. See docs/adr/0053-production-dummy-seed-runner.md.
//
// PURE: no database, no `@/server` engine import, no clock. The generator
// (scripts/seed/generate-table.ts), the runner (seed.prod-seed.test.ts) and the
// unit tests all call the same `validateTable`, so a table that passes here is
// the table that runs — there is no second copy of the rules to drift.
//
// The rules are SEED-1 §4.3's seven plus the route-layer checks `place()` does
// not enforce itself (body length, idempotency-key shape). A failing row is
// REJECTED, never clamped: a table that silently shrank a stake would run green
// and land somewhere the table does not describe.

import { createHash } from "node:crypto";
import { z } from "zod";

import {
	BET_MAX_STAKE,
	BET_MIN_STAKE_POST,
	BET_MIN_STAKE_REPLY,
	COMMENT_MAX_LENGTH,
} from "../../../src/server/config/limits";

export type SeedKind = "post" | "support" | "counter";
export type SeedSide = "YES" | "NO";

export interface SeedRow {
	/** Deterministic bet idempotency key — `rowKey(runId, marketIdx, seq)`. */
	readonly key: string;
	/** Market slug; must appear in `SeedTable.markets`. */
	readonly market: string;
	/** Execution order within the market, 1-based and contiguous. */
	readonly seq: number;
	/** Which post this row belongs to (a reply carries its parent's number). */
	readonly postNo: number;
	readonly kind: SeedKind;
	/** Resolved side: a support takes its parent's side, a counter the opposite. */
	readonly side: SeedSide;
	/** Whole-Dharma decimal string, e.g. "25". */
	readonly stake: string;
	/** Author label, e.g. "A0017". One label = one seeded account. */
	readonly author: string;
	readonly body: string;
	/** The parent post's key for a reply; null for a post. */
	readonly parentKey: string | null;
	/** Image filename in the images folder (posts only), or null. */
	readonly image: string | null;
	/** Milliseconds after run start this row becomes due. Non-decreasing. */
	readonly dueOffsetMs: number;
}

export interface SeedTable {
	readonly runId: string;
	readonly markets: readonly string[];
	readonly rows: readonly SeedRow[];
}

/** SEED-1 §4.3 rule 5 — no account looks all-in: total spend per author. */
export const AUTHOR_SPEND_CAP = 500;

/** `src/server/idempotency/types.ts` — the key shape the place route ACCEPTS. */
export const IDEMPOTENCY_KEY_RE = /^[A-Za-z0-9_-]{1,255}$/;

/**
 * The seed key shape: `seed.<runId>.<marketIdx>.<seq>`. The `.` separator is
 * deliberately OUTSIDE the route's alphabet (security-auditor M-2): both unique
 * key indexes are global, so a participant who could send a seed key would own
 * it — wedging the run and landing in its manifest. No participant request can
 * carry a `.`; the columns are plain text and the engine does not re-check.
 */
export const SEED_KEY_RE = /^seed\.[a-z0-9]{8,40}\.\d+\.\d+$/;

/**
 * Lowercase letters and digits only, 8+ characters. Lowercase because the
 * account email is derived from it and emails compare case-insensitively. No
 * separator characters, so one run's key prefix `seed.<runId>.` never covers
 * another run's. The generator mints it from a CSPRNG by default.
 */
export const RUN_ID_RE = /^[a-z0-9]{8,40}$/;
export const AUTHOR_RE = /^A\d{4,}$/;

/** Extensions accepted for seed images, mapped to the MIME the upload signs. */
export const IMAGE_MIME_BY_EXT: Readonly<Record<string, string>> = {
	png: "image/png",
	jpg: "image/jpeg",
	jpeg: "image/jpeg",
	webp: "image/webp",
	gif: "image/gif",
	avif: "image/avif",
};

const rowSchema = z
	.object({
		key: z.string(),
		market: z.string(),
		seq: z.number().int(),
		postNo: z.number().int(),
		kind: z.enum(["post", "support", "counter"]),
		side: z.enum(["YES", "NO"]),
		stake: z.string(),
		author: z.string(),
		body: z.string(),
		parentKey: z.string().nullable(),
		image: z.string().nullable(),
		dueOffsetMs: z.number().int(),
	})
	.strict();

const tableSchema = z
	.object({
		runId: z.string(),
		markets: z.array(z.string()),
		rows: z.array(rowSchema),
	})
	.strict();

/** Parse untrusted JSON into a table SHAPE; the rules are `validateTable`'s. */
export function parseTable(json: unknown): SeedTable {
	const parsed = tableSchema.safeParse(json);
	if (!parsed.success) {
		throw new Error(
			`seed table has the wrong shape: ${parsed.error.issues
				.slice(0, 10)
				.map((i) => `${i.path.join(".")}: ${i.message}`)
				.join("; ")}`,
		);
	}
	return parsed.data;
}

/**
 * The row's content fingerprint, stored as the bet receipt's `body_fingerprint`.
 * A resume compares it, so a receipt under this key that was written for a
 * different row — a regenerated table, or somebody else's bet — is refused
 * rather than silently skipped.
 */
export function rowFingerprint(row: SeedRow): string {
	const canonical = JSON.stringify([
		row.key,
		row.market,
		row.kind,
		row.side,
		row.stake,
		row.author,
		row.body,
		row.parentKey,
		row.image,
	]);
	return `seed-sha256-${createHash("sha256").update(canonical).digest("hex")}`;
}

export function rowKey(runId: string, marketIdx: number, seq: number): string {
	return `seed.${runId}.${marketIdx}.${seq}`;
}

export function imageExt(filename: string): string {
	return filename.slice(filename.lastIndexOf(".") + 1).toLowerCase();
}

/** Stakes in a table are whole numbers, so integer comparison is exact. */
function stakeValue(stake: string): number | null {
	return /^[1-9]\d*$/.test(stake) ? Number(stake) : null;
}

/**
 * Every rule violation in `table`, in row order. Empty means the table may run.
 */
export function validateTable(table: SeedTable): string[] {
	const errors: string[] = [];
	const fail = (at: string, msg: string) => errors.push(`${at}: ${msg}`);

	if (!RUN_ID_RE.test(table.runId)) {
		fail(
			"table",
			`runId ${JSON.stringify(table.runId)} must match ${RUN_ID_RE}`,
		);
	}
	if (table.markets.length === 0) fail("table", "no markets");
	if (new Set(table.markets).size !== table.markets.length) {
		fail("table", "duplicate market slug");
	}
	if (table.rows.length === 0) fail("table", "no rows");

	const postFloor = Number(BET_MIN_STAKE_POST);
	const replyFloor = Number(BET_MIN_STAKE_REPLY);
	const ceiling = Number(BET_MAX_STAKE);

	const seen = new Map<string, SeedRow>();
	const lastSeq = new Map<string, number>();
	const heldSide = new Map<string, SeedSide>();
	const spend = new Map<string, number>();
	const images = new Set<string>();
	let prev: SeedRow | null = null;

	for (const row of table.rows) {
		const at = row.key;
		const marketIdx = table.markets.indexOf(row.market);

		if (marketIdx === -1) fail(at, `market ${row.market} is not in the table`);
		if (seen.has(row.key)) fail(at, "duplicate key");
		if (!SEED_KEY_RE.test(row.key) || IDEMPOTENCY_KEY_RE.test(row.key)) {
			fail(at, "key shape (must be seed.<runId>.<market>.<seq>)");
		}
		if (
			marketIdx !== -1 &&
			row.key !== rowKey(table.runId, marketIdx, row.seq)
		) {
			fail(at, "key does not match runId/market/seq");
		}
		const expectedSeq = (lastSeq.get(row.market) ?? 0) + 1;
		if (row.seq !== expectedSeq) {
			fail(at, `seq ${row.seq}, expected ${expectedSeq} for ${row.market}`);
		}
		lastSeq.set(row.market, row.seq);
		if (!AUTHOR_RE.test(row.author)) fail(at, `author label ${row.author}`);

		// Rule 1 — floors and the per-bet ceiling.
		const stake = stakeValue(row.stake);
		const floor = row.kind === "post" ? postFloor : replyFloor;
		if (stake === null)
			fail(at, `stake ${JSON.stringify(row.stake)} is not a whole number`);
		else if (stake < floor || stake > ceiling) {
			fail(at, `${row.kind} stake ${stake} outside ${floor}-${ceiling}`);
		}

		// Body — the route's rules, which `place()` does not repeat.
		if (row.body.trim().length === 0) fail(at, "empty body");
		if (row.body.length > COMMENT_MAX_LENGTH) fail(at, "body too long");

		if (row.kind === "post") {
			if (row.parentKey !== null) fail(at, "post carries a parentKey");
		} else {
			// Rule 2 — the parent exists, earlier, as a post in the same market.
			const parent =
				row.parentKey === null ? undefined : seen.get(row.parentKey);
			if (!parent)
				fail(at, `reply parent ${row.parentKey} does not precede it`);
			else {
				if (parent.kind !== "post") fail(at, "reply parent is not a post");
				if (parent.market !== row.market)
					fail(at, "reply parent is in another market");
				if (parent.postNo !== row.postNo)
					fail(at, "postNo differs from parent");
				const want =
					row.kind === "support"
						? parent.side
						: parent.side === "YES"
							? "NO"
							: "YES";
				if (row.side !== want)
					fail(at, `${row.kind} side ${row.side}, expected ${want}`);
				// Rule 3 — nobody supports or counters themselves.
				if (parent.author === row.author)
					fail(at, "reply author is the post author");
			}
			if (row.image !== null) fail(at, "reply carries an image");
		}

		// Rule 4 — one held side per author per market.
		const holdKey = `${row.author}|${row.market}`;
		const held = heldSide.get(holdKey);
		if (held !== undefined && held !== row.side) {
			fail(at, `${row.author} already holds ${held} on ${row.market}`);
		}
		heldSide.set(holdKey, row.side);

		// Rule 5 — cumulative spend cap, checked in execution order.
		const spent = (spend.get(row.author) ?? 0) + (stake ?? 0);
		if (spent > AUTHOR_SPEND_CAP)
			fail(at, `${row.author} spend ${spent} > ${AUTHOR_SPEND_CAP}`);
		spend.set(row.author, spent);

		// Rule 6 — no author in two consecutive rows.
		if (prev !== null && prev.author === row.author)
			fail(at, "same author as previous row");

		// Rule 7 — image names are unique and of an accepted type.
		if (row.image !== null) {
			if (images.has(row.image)) fail(at, `image ${row.image} used twice`);
			images.add(row.image);
			if (!Object.hasOwn(IMAGE_MIME_BY_EXT, imageExt(row.image)))
				fail(at, `image type ${row.image}`);
			if (/[\\/]/.test(row.image)) fail(at, "image must be a bare filename");
		}

		if (!Number.isInteger(row.dueOffsetMs) || row.dueOffsetMs < 0)
			fail(at, "dueOffsetMs");
		if (prev !== null && row.dueOffsetMs < prev.dueOffsetMs)
			fail(at, "dueOffsetMs decreases");

		seen.set(row.key, row);
		prev = row;
	}

	return errors;
}

/** Distinct author labels, in first-appearance order. */
export function authorsOf(table: SeedTable): string[] {
	return [...new Set(table.rows.map((r) => r.author))];
}
