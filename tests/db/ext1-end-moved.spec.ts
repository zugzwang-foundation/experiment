import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { markets } from "@/db/schema";
import {
	eventMetadataSchema,
	eventPayloadSchemas,
} from "@/server/events/schemas";

import { testClient, testDb } from "./_fixtures/db";
import liveMarkets from "./_fixtures/ext1-live-markets.json";
import { truncateTables } from "./_fixtures/truncate";

// EXT-1 — migration `0032_ext1_end_moved_to_dec31` (plan §3.3, test plan §5.1).
//
// The migration moves six live markets' `resolution_deadline` from 5 November
// to 2026-12-31T23:45Z, rewrites the date words in their founder-authored text,
// and records each move as one `market.deadline_moved` event. It carries no DDL.
//
// WHAT THIS FILE PROTECTS, lock by lock (plan §2):
//   · "Market wording is the founder's. Only the date words change, exactly as
//     signed off" — every after-state is asserted as the md5 the founder signed
//     (plan §4), read back from the row with Postgres's own `md5()`. The test
//     never re-implements the replacement, so it cannot agree with a wrong one.
//   · "No new capability to extend a deadline" — the move is keyed on six ids
//     and on a November deadline. A bystander market is never touched, a market
//     that is not `Open` is refused, and so is a deadline outside 5 November.
//   · "`events` takes INSERTs only" — exactly six rows are appended, each in the
//     shape `insertEvent` would have written (uuidv7 id, `created_at` derived
//     from it, `payload_version 1`, the seven metadata fields), and each parses
//     with the shipped Zod schemas.
//   · All or nothing — every refusal leaves every market byte-identical and
//     appends no event, because the file is ONE statement in one transaction.
//
// HOW THE MIGRATION IS APPLIED. Drizzle has already run `0032` against this
// database when it was built, and on an empty database it is a no-op (scenario
// 2). Each case below seeds the six markets and then executes the SQL file's
// body again, by hand. One parameterless `unsafe()` call is one simple-query
// message, which Postgres runs as one implicit transaction — the same shape
// both appliers give it.
//
// The before-state is `_fixtures/ext1-live-markets.json`: the six titles and
// descriptions as served on 2026-10-11. `docs/data/*-markets-snapshot.json` is
// NOT a substitute — its text differs from the live text on three markets.

const MIGRATION_PATH = fileURLToPath(
	new URL(
		"../../drizzle/migrations/0032_ext1_end_moved_to_dec31.sql",
		import.meta.url,
	),
);

const CODES = ["BTC", "CHE", "CLA", "GIT", "MAT", "YCP"] as const;
type Code = (typeof CODES)[number];
type LiveMarket = (typeof liveMarkets.markets)[number];

/** The deadline all six carry today (plan §3.3 step 2). */
const OLD_DEADLINE = "2026-11-05T23:45:00.000Z";
/** The end of the experiment (plan §1 ruling 1). */
const NEW_DEADLINE = "2026-12-31T23:45:00.000Z";
/** ⚠ If the D-number changes at landing, this and every after-md5 in the
 * fixture change with it (plan §4). */
const RULING = "D-55";
/** A fixed `created_at`, so "unchanged" compares against a literal as well as
 * against the row's own before-state. */
const SEEDED_CREATED_AT = new Date("2026-10-04T16:58:00.000Z");
/** `media_video_url` is NULL on most markets. Seeding it on two makes
 * "unchanged" a real assertion rather than NULL compared with NULL. */
const VIDEO_URLS: Partial<Record<Code, string>> = {
	BTC: "https://www.youtube.com/watch?v=ext1fixtureA",
	MAT: "https://www.youtube.com/watch?v=ext1fixtureB",
};

function live(code: Code): LiveMarket {
	const market = liveMarkets.markets.find((m) => m.code === code);
	if (!market) throw new Error(`fixture has no market ${code}`);
	return market;
}

function migrationSql(): string {
	return readFileSync(MIGRATION_PATH, "utf8");
}

/** Executes the migration body as ONE statement in one implicit transaction. */
async function applyMigration(): Promise<void> {
	await testClient.unsafe(migrationSql());
}

type SeedOverride = {
	title?: string;
	description?: string;
	status?: "Open" | "Closed";
	deadline?: string;
};

/** Seeds the six live markets in their before-state, minus `omit`. */
async function seedLive(
	overrides: Partial<Record<Code, SeedOverride>> = {},
	omit: readonly Code[] = [],
): Promise<void> {
	for (const code of CODES) {
		if (omit.includes(code)) continue;
		const market = live(code);
		const o = overrides[code] ?? {};
		await testDb.insert(markets).values({
			id: market.id,
			slug: market.slug,
			title: o.title ?? market.title,
			description: o.description ?? market.description,
			status: o.status ?? "Open",
			resolutionDeadline: new Date(o.deadline ?? OLD_DEADLINE),
			mediaVideoUrl: VIDEO_URLS[code] ?? null,
			createdAt: SEEDED_CREATED_AT,
		});
	}
}

type MarketRow = {
	id: string;
	slug: string;
	title: string;
	description: string | null;
	status: string;
	resolution_deadline: Date;
	media_video_url: string | null;
	created_by: string;
	created_at: Date;
	resolved_at: Date | null;
	resolution_outcome: string | null;
	title_md5: string;
	description_md5: string;
	description_chars: number;
};

/** Every market row, whole. The md5s are Postgres's own, over the stored text. */
async function readMarkets(): Promise<MarketRow[]> {
	const rows = await testClient<MarketRow[]>`
		SELECT id, slug, title, description, status::text AS status,
		       resolution_deadline, media_video_url, created_by, created_at,
		       resolved_at, resolution_outcome::text AS resolution_outcome,
		       md5(title) AS title_md5,
		       md5(description) AS description_md5,
		       char_length(description) AS description_chars
		FROM markets
		ORDER BY id
	`;
	// Plain objects in a plain array, so `toEqual` compares rows and nothing
	// the driver hangs off its result list.
	return rows.map((r) => ({ ...r }));
}

function rowOf(rows: readonly MarketRow[], id: string): MarketRow {
	const row = rows.find((r) => r.id === id);
	if (!row) throw new Error(`no market row ${id}`);
	return row;
}

/** The columns the migration has no business with (plan §3.3 step 5). */
function untouched(row: MarketRow) {
	return {
		slug: row.slug,
		status: row.status,
		media_video_url: row.media_video_url,
		created_at: row.created_at,
		created_by: row.created_by,
		resolved_at: row.resolved_at,
		resolution_outcome: row.resolution_outcome,
	};
}

type MovedEvent = {
	event_id: string;
	aggregate_type: string;
	aggregate_id: string;
	payload: unknown;
	payload_version: number;
	metadata: unknown;
	drift_ms: string;
};

/** Every `market.deadline_moved` row. `drift_ms` is the distance between the
 * stored `created_at` and the instant in the event id's first 48 bits — the
 * `insertEvent` contract the migration reproduces by hand (the 0027/0029
 * precedent, asserted the same way in `liquidity-injector.spec.ts`). */
async function readMovedEvents(): Promise<MovedEvent[]> {
	const rows = await testClient<MovedEvent[]>`
		SELECT event_id, aggregate_type, aggregate_id, payload, payload_version,
		       metadata,
		       abs(extract(epoch FROM (created_at - to_timestamp(
		         (('x' || substr(replace(event_id::text, '-', ''), 1, 12))::bit(48)::bigint) / 1000.0
		       ))) * 1000)::text AS drift_ms
		FROM events
		WHERE event_type = 'market.deadline_moved'
		ORDER BY aggregate_id
	`;
	return rows.map((r) => ({ ...r }));
}

async function totalEvents(): Promise<number> {
	const [row] = await testClient<{ n: number }[]>`
		SELECT count(*)::int AS n FROM events
	`;
	// -1 and not 0: an unanswered count must fail an assertion, never satisfy one.
	return row?.n ?? -1;
}

function expectedPayload(marketId: string, previousDeadline: string) {
	return {
		marketId,
		previousDeadline,
		newDeadline: NEW_DEADLINE,
		ruling: RULING,
	};
}

/** All seven fields of `eventMetadataSchema` (plan §3.3 step 6, §6 D-4). */
function expectedMetadata(marketId: string) {
	return {
		request_id: `ext-1:${marketId}`,
		flow_id: "EXT-1",
		user_id: null,
		actor_id: "system",
		idempotency_key: `ext-1:deadline-moved:${marketId}`,
		ip: "migration",
		user_agent: "migration",
	};
}

/** Asserts the six rows carry the signed after-text and the new deadline. */
async function expectAllSixMoved(): Promise<void> {
	const rows = await readMarkets();
	for (const code of CODES) {
		const market = live(code);
		const row = rowOf(rows, market.id);
		expect({
			code,
			descriptionMd5: row.description_md5,
			descriptionChars: row.description_chars,
			titleMd5: row.title_md5,
			deadline: row.resolution_deadline.toISOString(),
		}).toEqual({
			code,
			descriptionMd5: market.after.descriptionMd5,
			descriptionChars: market.after.descriptionChars,
			titleMd5: market.after.titleMd5,
			deadline: NEW_DEADLINE,
		});
	}
}

/**
 * Asserts a refused run changed nothing: every market row is identical to its
 * before-state and no event was appended.
 *
 * ⚠ `code: "P0001"` is what a plpgsql `RAISE EXCEPTION` carries by default, and
 * it is asserted so that a refusal cannot be impersonated — a syntax error in
 * the SQL, or the file being absent, also "rejects", and would otherwise pass
 * every negative case here without the migration having refused anything.
 */
async function expectRefusedAndUnchanged(
	before: readonly MarketRow[],
	message?: string,
): Promise<void> {
	await expect(applyMigration()).rejects.toMatchObject(
		message === undefined
			? { code: "P0001" }
			: { code: "P0001", message: expect.stringContaining(message) },
	);
	expect(await readMarkets()).toEqual(before);
	expect(await readMovedEvents()).toEqual([]);
	expect(await totalEvents()).toBe(0);
}

describe("migration 0032 · the experiment's end moves to 31 December", () => {
	// `events` is Bucket A: its rows leave only by a guarded TRUNCATE.
	//
	// ⚠ BEFORE as well as after. Every case seeds six FIXED ids and counts the
	// whole `events` table, so it needs both to be empty when it starts — and a
	// reset that lives only in a teardown does not protect a file from whatever
	// ran before it.
	beforeEach(async () => {
		await truncateTables(testClient, ["events", "pools", "markets"]);
	});
	afterEach(async () => {
		await truncateTables(testClient, ["events", "pools", "markets"]);
	});

	it("ext1-end-moved::moves-all-six-and-appends-exactly-six-events", async () => {
		await seedLive();
		// A market that is not one of the six, carrying the same November
		// deadline and one of the before-strings. The migration is keyed on ids,
		// so it must come through byte-identical and gain no event.
		const [bystander] = await testDb
			.insert(markets)
			.values({
				slug: "ext1-bystander-not-one-of-the-six",
				title: "TEST FIXTURE · a bystander market, by 5th November?",
				description:
					"TEST FIXTURE criterion. Deadline. 5 November 2026, 23:45 UTC. No extensions.",
				status: "Open",
				resolutionDeadline: new Date(OLD_DEADLINE),
				createdAt: SEEDED_CREATED_AT,
			})
			.returning({ id: markets.id });
		const bystanderId = bystander?.id ?? "";

		const before = await readMarkets();
		// CONTROL — the seed IS the signed before-text. Without this, an
		// after-md5 that matched would say nothing about where it started from.
		expect(before).toHaveLength(7);
		for (const code of CODES) {
			const market = live(code);
			const row = rowOf(before, market.id);
			expect({
				code,
				descriptionMd5: row.description_md5,
				descriptionChars: row.description_chars,
				titleMd5: row.title_md5,
				deadline: row.resolution_deadline.toISOString(),
			}).toEqual({
				code,
				descriptionMd5: market.descriptionMd5,
				descriptionChars: market.descriptionChars,
				titleMd5: market.titleMd5,
				deadline: OLD_DEADLINE,
			});
		}
		expect(await totalEvents()).toBe(0);

		await applyMigration();

		// The signed after-text and the new deadline, on all six.
		await expectAllSixMoved();
		const after = await readMarkets();

		// Only BTC's title has a pair; the other five titles are unchanged.
		for (const code of CODES) {
			const market = live(code);
			expect({
				code,
				titleChanged: rowOf(after, market.id).title_md5 !== market.titleMd5,
			}).toEqual({ code, titleChanged: code === "BTC" });
		}

		// slug, status, media_video_url, created_at — and every other column.
		for (const code of CODES) {
			const market = live(code);
			const row = rowOf(after, market.id);
			expect(untouched(row)).toEqual(untouched(rowOf(before, market.id)));
			expect(untouched(row)).toMatchObject({
				slug: market.slug,
				status: "Open",
				media_video_url: VIDEO_URLS[code] ?? null,
				created_at: SEEDED_CREATED_AT,
			});
		}
		// Non-vacuity on the one column that is usually NULL.
		expect(
			after.filter((r) => r.media_video_url !== null).map((r) => r.id),
		).toHaveLength(2);

		// The bystander: identical, whole row.
		expect(rowOf(after, bystanderId)).toEqual(rowOf(before, bystanderId));

		// EXACTLY six events — six of this type, and six in the table at all.
		const events = await readMovedEvents();
		expect(events).toHaveLength(6);
		expect(await totalEvents()).toBe(6);
		expect(events.map((e) => e.aggregate_id).sort()).toEqual(
			CODES.map((code) => live(code).id).sort(),
		);
		expect(new Set(events.map((e) => e.event_id)).size).toBe(6);

		for (const event of events) {
			const marketId = event.aggregate_id;
			expect(event.aggregate_type).toBe("market");
			expect(event.payload_version).toBe(1);
			// `toEqual` on the whole object: no missing key, and no extra one.
			expect(event.payload).toEqual(expectedPayload(marketId, OLD_DEADLINE));
			expect(event.metadata).toEqual(expectedMetadata(marketId));
			// A uuidv7 id, and `created_at` derived from it rather than `now()`.
			expect(event.event_id[14]).toBe("7");
			expect(Number(event.drift_ms)).toBeLessThan(1);
		}
	});

	it("ext1-end-moved::an-empty-database-is-a-no-op", async () => {
		// The CI and test-database path: none of the six ids is present, so the
		// presence gate returns before it reads or writes anything.
		expect(await readMarkets()).toEqual([]);

		await expect(applyMigration()).resolves.toBeUndefined();

		expect(await readMarkets()).toEqual([]);
		expect(await readMovedEvents()).toEqual([]);
		expect(await totalEvents()).toBe(0);
	});

	it("ext1-end-moved::five-of-six-present-raises-and-changes-nothing", async () => {
		// Some but not all: a database that holds part of the roster is not the
		// one the text was signed against.
		await seedLive({}, ["MAT"]);
		const before = await readMarkets();
		expect(before).toHaveLength(5);

		await expectRefusedAndUnchanged(before);
	});

	// ⚠ Two victims, the first and the last of the six by id. The file is one
	// statement, so a refusal rolls back whatever came before it — but that is
	// only observable if something DID come before it. Whichever order the
	// migration walks the markets in, one of these two is refused after
	// another market has already been processed.
	const ALTERED: readonly { code: Code; from: string; to: string }[] = [
		{
			code: "BTC",
			from: "DEADLINE. Trading closes and settlement occurs at 2026-11-05T23:45:00Z.",
			to: "DEADLINE. Trading closes and settlement occurs at 2026-11-05T23:44:00Z.",
		},
		{
			code: "YCP",
			from: "Deadline. 5 November 2026, 23:45 UTC.",
			to: "Deadline. 5 November 2026, 23:44 UTC.",
		},
	];

	for (const victim of ALTERED) {
		it(`ext1-end-moved::an-altered-before-string-raises-and-rolls-back-every-market (${victim.code})`, async () => {
			const original = live(victim.code).description;
			const altered = original.replace(victim.from, victim.to);
			// CONTROL — the alteration landed, so the before-string really is
			// absent from the seeded row (and its after-string was never there).
			expect(altered).not.toBe(original);
			expect(altered).not.toContain(victim.from);

			const overrides: Partial<Record<Code, SeedOverride>> = {};
			overrides[victim.code] = { description: altered };
			await seedLive(overrides);
			const before = await readMarkets();
			expect(before).toHaveLength(6);
			expect(rowOf(before, live(victim.code).id).description_md5).not.toBe(
				live(victim.code).descriptionMd5,
			);

			// NO market changed — not only the altered one.
			await expectRefusedAndUnchanged(before);
		});
	}

	it("ext1-end-moved::a-closed-market-raises-naming-its-slug", async () => {
		await seedLive({ CLA: { status: "Closed" } });
		const before = await readMarkets();
		expect(rowOf(before, live("CLA").id).status).toBe("Closed");

		await expectRefusedAndUnchanged(before, live("CLA").slug);
	});

	it("ext1-end-moved::a-pre-applied-pair-is-skipped", async () => {
		// One pair already in its after-state on one market: `before` is absent
		// and `after` occurs exactly once, so that pair is skipped and the rest
		// of the run proceeds.
		const original = live("CHE").description;
		const preApplied = original.replace(
			"No extensions.",
			"No further extensions.",
		);
		expect(preApplied).not.toBe(original);

		await seedLive({ CHE: { description: preApplied } });
		// CONTROL — the row starts in a THIRD state: neither the signed before
		// nor the signed after.
		const seeded = rowOf(await readMarkets(), live("CHE").id);
		expect(seeded.description_md5).not.toBe(live("CHE").descriptionMd5);
		expect(seeded.description_md5).not.toBe(live("CHE").after.descriptionMd5);

		await applyMigration();

		await expectAllSixMoved();
		expect(await readMovedEvents()).toHaveLength(6);
		expect(await totalEvents()).toBe(6);
	});

	it("ext1-end-moved::every-event-parses-with-the-shipped-schemas", async () => {
		// ⛔ THE WRITER↔READER BRIDGE. `market.deadline_moved` is written by the
		// migration's plpgsql, not by `insertEvent`, so none of that function's
		// guarantees runs on this path. Parsing the REAL emitted rows through the
		// REAL schemas is what ties the SQL to `schemas.ts`; two hand-copies of a
		// key list with nothing between them is the defect this prevents.
		await seedLive();
		await applyMigration();

		const events = await readMovedEvents();
		expect(events).toHaveLength(6);
		const payloadSchema = eventPayloadSchemas["market.deadline_moved"];
		for (const event of events) {
			// `z.object` STRIPS unknown keys, so equality with the raw row is what
			// proves the row carries the schema's keys and no others.
			expect(payloadSchema.parse(event.payload)).toEqual(event.payload);
			expect(eventMetadataSchema.parse(event.metadata)).toEqual(event.metadata);
		}
	});

	it("ext1-end-moved::a-23:59-deadline-is-accepted-and-recorded-as-read", async () => {
		// The precondition is the whole of 5 November, not one instant: SPEC.1
		// let a market carry 23:59 instead of 23:45. `previousDeadline` is READ
		// FROM THE ROW before the update, never assumed.
		const at2359 = "2026-11-05T23:59:00.000Z";
		await seedLive({ GIT: { deadline: at2359 } });

		await applyMigration();

		await expectAllSixMoved();
		const events = await readMovedEvents();
		expect(events).toHaveLength(6);
		for (const event of events) {
			const previous =
				event.aggregate_id === live("GIT").id ? at2359 : OLD_DEADLINE;
			expect(event.payload).toEqual(
				expectedPayload(event.aggregate_id, previous),
			);
		}
	});

	it("ext1-end-moved::a-deadline-outside-5-November-raises-naming-its-slug", async () => {
		// The other half of the same precondition, and the control for the case
		// above: "23:59 is accepted" is also true of a migration that checks no
		// deadline at all. The first instant of 6 November is the first one
		// outside the window, so this pins the bound as exclusive.
		await seedLive({ GIT: { deadline: "2026-11-06T00:00:00.000Z" } });
		const before = await readMarkets();
		expect(before).toHaveLength(6);

		await expectRefusedAndUnchanged(before, live("GIT").slug);
	});
});

describe("migration 0032 · the file itself (no database)", () => {
	const require = createRequire(import.meta.url);
	// biome-ignore lint/suspicious/noExplicitAny: a CommonJS script without types.
	const tool: any = require(
		fileURLToPath(
			new URL(
				"../../scripts/aws-migration/check-destructive-migrations.cjs",
				import.meta.url,
			),
		),
	);

	it("ext1-end-moved::the-sql-is-one-statement-and-the-pipeline-admits-it", () => {
		const sql = migrationSql();

		// CONTROL — the file is the migration, not an empty or truncated one,
		// which would satisfy both absences below without holding anything.
		expect(sql).toContain("market.deadline_moved");
		for (const code of CODES) {
			expect(sql, `${code} is not in the migration`).toContain(live(code).id);
		}

		// ONE statement: drizzle splits a migration on this marker, and a split
		// file is several statements that can commit apart (plan §3.3).
		expect(sql).not.toContain("--> statement-breakpoint");

		// `deploy-aws.yml` refuses to auto-apply a migration this flags.
		expect(tool.findDestructive(sql)).toEqual([]);
		// CONTROL — the detector was loaded and can fire.
		expect(tool.findDestructive("DELETE FROM markets;")).toEqual([
			"DELETE FROM markets",
		]);
	});
});
