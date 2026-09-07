import { HeadObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { asc, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// ═══════════════════════════════════════════════════════════════════════════
// THE CONTENT-MARKET SEEDER — LIQ-1-RESTORE
//
// ADR-0035 (guarded staging reset) + ADR-0036 (Vitest-context operational
// runners). READ BOTH BEFORE CHANGING ANYTHING IN THIS FILE.
//
// THIS IS NOT A TEST. It is an operational artifact that borrows the Vitest
// harness for module resolution (ADR-0036 primitive 1), and it WRITES to the
// database it is pointed at. It lives under tests/staging/, which
// vitest.config.ts excludes, so no bare `vitest run` can reach it.
//
// ── WHY IT IS A RUNNER AND NOT THE `scripts/*.ts` THE KICKOFF ASKED FOR ────
// The kickoff specifies `scripts/seed-content-markets.ts`, driving the engine
// through "the SAME server function the admin form calls". Both halves are
// honoured — but a plain `tsx` script cannot reach the engine, and that is
// measured, not assumed (2026-09-07, at HEAD `67ceb6b5`):
//
//   pnpm exec tsx …                       → "This module cannot be imported
//                                            from a Client Component module"
//                                            (`server-only`'s exports map)
//   pnpm exec tsx --conditions=react-server …
//                                         → "No 'exports' main defined in
//                                            node_modules/canonicalize/package.json"
//                                            (ESM-only against a CJS transpile)
//
// — the first two of the three blockers vitest.staging.config.ts's own header
// names. `next/cache`'s `revalidateTag`, which `openMarket` calls, is the
// third kind of problem and has no `tsx` answer at all: it needs a module mock.
//
// So `scripts/seed-content-markets.ts` EXISTS and is the entry point the
// kickoff describes — it parses and validates the flags, refuses `--env prod`,
// and spawns this runner under doppler. The engine driving happens here,
// because here is the only place it can.
//
// ── THE MOCKING BOUNDARY (ADR-0036 primitive 3) ────────────────────────────
// MAY be mocked: next/headers · next/navigation · next/cache · the admin
// session gate. MUST NEVER be mocked: anything that writes a row or moves
// Dharma. `createMarket` and `openMarket` run unmodified — the markets row,
// the market_media rows, the pools row, `market.created` and `market.opened`
// are all the shipped code's, inside the shipped W-4 transaction.
//
// NO ROW IS WRITTEN BY THIS FILE. `@/db` is the write-guarded client, which
// attributes every write to its immediate caller and throws when that caller
// is under tests/ (ADR-0036 primitive 4).
//
// Invocation:  pnpm exec tsx scripts/seed-content-markets.ts --env staging --create
//              pnpm exec tsx scripts/seed-content-markets.ts --env staging --open --price 0.1 --tank 100000
//              pnpm exec tsx scripts/seed-content-markets.ts --env staging --media
// ═══════════════════════════════════════════════════════════════════════════

vi.mock("@sentry/nextjs", () => ({
	captureMessage: vi.fn(),
	captureException: vi.fn(),
	addBreadcrumb: vi.fn(),
}));

vi.mock("next/headers", () => ({
	cookies: () => ({ get: vi.fn(), set: vi.fn(), delete: vi.fn() }),
	headers: () => ({ get: vi.fn() }),
}));

vi.mock("next/navigation", () => ({
	redirect: vi.fn(),
	notFound: vi.fn(),
}));

vi.mock("next/cache", () => ({
	revalidatePath: vi.fn(),
	revalidateTag: vi.fn(),
	updateTag: vi.fn(),
}));

// A PARTIAL MOCK, for the reason the generator's is partial: `canonicalizeAmount18`
// lives in the same module and is a REAL dependency of the open — the admin wire
// canonicalises both amounts before `openMarket` sees them, and an
// over-precision price must be a `seed_invalid` at the boundary rather than a
// silent rounding into a market that opened somewhere else.
vi.mock("@/server/admin/wire", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/server/admin/wire")>();
	return { ...actual, requireAdminSession: vi.fn() };
});

// THE LOAD-BEARING MOCK — the engine writes through the write-guarded client.
vi.mock("@/db", async () => {
	const { guardedDb } = await import("./_lib/client");
	return { db: guardedDb };
});
vi.mock("@/db/index", async () => {
	const { guardedDb } = await import("./_lib/client");
	return { db: guardedDb };
});

import { markets, pools } from "@/db/schema";
import { canonicalizeAmount18 } from "@/server/admin/wire";
import { CpmmDecimal } from "@/server/cpmm/decimal";
import { createMarket } from "@/server/markets/create";
import { openMarket } from "@/server/markets/open";

import {
	assertRunnerLiveConnection,
	closeRunnerConnection,
	describeRunnerTarget,
	forbiddenTableWrites,
	RUNNER_MODE,
	readOnly,
	writeLog,
} from "./_lib/client";
import { resolveRunnerTarget } from "./_lib/target";
import {
	type ContentMarketSpec,
	contentMarketSourceCapturedAt,
	loadContentMarkets,
} from "./content-markets";

// ── THE TARGET GUARD, AT MODULE SCOPE ───────────────────────────────────────
// Before any client exists, and before the first phase runs. `_lib/client.ts`
// resolves the same predicate on import; this call is the one
// tests/unit/staging/runner-gating.test.ts reads, and it must be here rather
// than inherited, because a guard you cannot see in the file you are reading is
// a guard the next editor will not know to keep.
//
// `requireWriteIntent: true` — this run creates markets and opens pools. The
// read-only variant would skip the G-5 analogue entirely.
const target = resolveRunnerTarget(process.env, { requireWriteIntent: true });
if (!target.ok) {
	throw new Error(
		`REFUSED — the content-market seeder target guard did not pass.\n  ${target.reason}\n\n` +
			"Run it as: pnpm exec tsx scripts/seed-content-markets.ts --env staging --create",
	);
}

/** Which of the three phases this invocation runs. Never defaulted. */
const PHASE_ENV = "ZUGZWANG_CONTENT_MARKETS_PHASE";
const PRICE_ENV = "ZUGZWANG_CONTENT_MARKETS_PRICE";
const TANK_ENV = "ZUGZWANG_CONTENT_MARKETS_TANK";

const PHASES = ["create", "open", "media"] as const;
type Phase = (typeof PHASES)[number];

const rawPhase = process.env[PHASE_ENV];
if (!PHASES.includes(rawPhase as Phase)) {
	throw new Error(
		`REFUSED — ${PHASE_ENV} must be one of ${PHASES.join(" | ")} (saw ${
			rawPhase === undefined ? "unset" : JSON.stringify(rawPhase)
		}). There is deliberately no default.`,
	);
}
const PHASE = rawPhase as Phase;

// The open's two amounts are canonicalised by the SHIPPED wire helper, exactly
// as `/admin/markets/[marketId]`'s seed action does — not parsed here. A price
// the wire would reject must be rejected before a pool exists, not rounded into
// one.
const OPEN_PRICE =
	PHASE === "open" ? canonicalizeAmount18(process.env[PRICE_ENV] ?? "") : "";
const OPEN_TANK =
	PHASE === "open" ? canonicalizeAmount18(process.env[TANK_ENV] ?? "") : "";

const SPECS = loadContentMarkets();

/** The §3.7 metadata block for an admin lifecycle flow. Mirrors the generator. */
function adminMetadata(flowId: string) {
	return {
		request_id: "liq-1-restore-content-markets",
		flow_id: flowId,
		user_id: null,
		actor_id: "admin-singleton",
		idempotency_key: null,
		ip: "127.0.0.1",
		user_agent: "zugzwang-content-market-seeder/1",
	};
}

/**
 * HeadObject every media key, so a market is never created pointing at bytes
 * that are not there.
 *
 * `createMarket` validates the key's SHAPE and never touches R2 — the
 * generator's own comment says so, and it deliberately creates markets whose
 * objects do not exist yet. That is right for invented fixtures and wrong here:
 * these eight point at real images that survived the reset (16/16, measured
 * 2026-09-07), and the whole reason for reusing the original market ids is that
 * the surviving keys stay valid. If one has gone, the answer is to find it, not
 * to seed a market that renders a broken carousel.
 *
 * REFUSES in staging mode when the R2 env is absent — an unconfigured arm must
 * not read as a clean check. In `local` mode it reports SKIPPED, because local
 * proving has no R2 and the key shape is all `createMarket` will look at there.
 */
async function verifyMediaObjects(
	specs: readonly ContentMarketSpec[],
): Promise<{ checked: number; skipped: boolean }> {
	const endpoint = process.env.R2_ENDPOINT_MARKET_MEDIA;
	const accessKeyId = process.env.R2_ACCESS_KEY_ID_MARKET_MEDIA;
	const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY_MARKET_MEDIA;
	const Bucket = process.env.R2_BUCKET_MARKET_MEDIA;
	if (!endpoint || !accessKeyId || !secretAccessKey || !Bucket) {
		if (RUNNER_MODE === "staging") {
			throw new Error(
				"REFUSED — the market-media R2 arm is not configured (R2_ENDPOINT_MARKET_MEDIA, " +
					"R2_ACCESS_KEY_ID_MARKET_MEDIA, R2_SECRET_ACCESS_KEY_MARKET_MEDIA, R2_BUCKET_MARKET_MEDIA). " +
					"An unconfigured arm is not a passing media check.",
			);
		}
		console.log(
			"[content-markets] media check SKIPPED — local mode, no R2 arm",
		);
		return { checked: 0, skipped: true };
	}
	const s3 = new S3Client({
		region: "auto",
		endpoint,
		credentials: { accessKeyId, secretAccessKey },
	});
	const missing: string[] = [];
	let checked = 0;
	for (const spec of specs) {
		for (const m of spec.media) {
			checked += 1;
			try {
				await s3.send(new HeadObjectCommand({ Bucket, Key: m.key }));
			} catch {
				missing.push(`${spec.slug}  ${m.key}`);
			}
		}
	}
	if (missing.length > 0) {
		throw new Error(
			`REFUSED — ${missing.length} of ${checked} media object(s) are missing from ${Bucket}:\n` +
				missing.map((m) => `  · ${m}`).join("\n"),
		);
	}
	console.log(
		`[content-markets] media OK — ${checked}/${checked} objects present in ${Bucket}`,
	);
	return { checked, skipped: false };
}

/** slug · status · yes · no · price · opened-at, read back from the database. */
async function printReceipt(
	specs: readonly ContentMarketSpec[],
): Promise<void> {
	const rows = await readOnly
		.select({
			slug: markets.slug,
			status: markets.status,
			yes: pools.yesReserves,
			no: pools.noReserves,
			openedAt: pools.createdAt,
		})
		.from(markets)
		.leftJoin(pools, eq(pools.marketId, markets.id))
		.where(
			inArray(
				markets.slug,
				specs.map((s) => s.slug),
			),
		)
		.orderBy(asc(markets.slug));

	const header = [
		"slug".padEnd(36),
		"status".padEnd(9),
		"yes".padStart(24),
		"no".padStart(24),
		"price".padStart(8),
		"opened-at",
	].join(" | ");
	console.log(`\n${header}\n${"-".repeat(header.length)}`);
	for (const r of rows) {
		// p_yes is the OPPOSITE reserve over the tank (ADR-0047 §B: a side's
		// price is proportional to the other side's reserve). Receipt arithmetic
		// only — the authority for what opened is the reserves themselves, which
		// are printed beside it unrounded.
		const price =
			r.yes !== null && r.no !== null
				? new CpmmDecimal(r.no)
						.div(new CpmmDecimal(r.yes).plus(new CpmmDecimal(r.no)))
						.toFixed(4)
				: "—";
		console.log(
			[
				r.slug.padEnd(36),
				String(r.status).padEnd(9),
				(r.yes ?? "—").padStart(24),
				(r.no ?? "—").padStart(24),
				price.padStart(8),
				r.openedAt?.toISOString() ?? "—",
			].join(" | "),
		);
	}
	console.log("");
}

beforeAll(async () => {
	// G-3 — the live socket, not the config. A throwing beforeAll fails the
	// suite WITHOUT executing it, so nothing below can write.
	await assertRunnerLiveConnection();
	console.log(
		`[content-markets] target ${describeRunnerTarget()} · phase=${PHASE} · ` +
			`source captured ${contentMarketSourceCapturedAt()} · ${SPECS.length} markets`,
	);
});

afterAll(async () => {
	await closeRunnerConnection();
});

describe("content-market seeder", () => {
	it(`runs the ${PHASE} phase`, async () => {
		if (PHASE === "media") {
			await verifyMediaObjects(SPECS);
			await printReceipt(SPECS);
			return;
		}

		if (PHASE === "create") {
			// R2 first: a market must never be created pointing at bytes that
			// are not there. Throws before a single row is written.
			await verifyMediaObjects(SPECS);

			let created = 0;
			let skipped = 0;
			for (const spec of SPECS) {
				try {
					await createMarket({
						marketId: spec.marketId,
						slug: spec.slug,
						title: spec.title,
						description: spec.description,
						resolutionDeadline: spec.resolutionDeadline,
						media: spec.media,
						mediaVideoUrl: spec.mediaVideoUrl,
						now: new Date(),
						metadata: adminMetadata("F-ADMIN-1"),
					});
					created += 1;
				} catch (err) {
					// IDEMPOTENT ON SLUG. `createMarket` pre-checks the slug in-tx
					// and raises MarketSlugTakenError; the unique constraint is the
					// backstop behind it. Either way the market already exists and
					// a re-run is a no-op rather than a duplicate or a crash.
					// Matched by NAME, not by `instanceof`: the error class is
					// imported through the same aliased module graph the engine
					// uses, and a name check cannot be defeated by a second copy of
					// the module.
					if ((err as Error)?.name === "MarketSlugTakenError") {
						skipped += 1;
						continue;
					}
					throw err;
				}
			}
			console.log(
				`[content-markets] create: ${created} created, ${skipped} already present`,
			);
			await printReceipt(SPECS);
			expect(created + skipped).toBe(SPECS.length);
			return;
		}

		// PHASE === "open"
		let opened = 0;
		let skipped = 0;
		for (const spec of SPECS) {
			try {
				await openMarket({
					marketId: spec.marketId,
					openingPriceYes: OPEN_PRICE,
					tank: OPEN_TANK,
					now: new Date(),
					metadata: adminMetadata("F-ADMIN-2"),
				});
				opened += 1;
			} catch (err) {
				// IDEMPOTENT ON STATUS. The W-4 wrapper gates on
				// `expectedStatus: ["Draft"]`, so a market that is already Open
				// raises MarketLifecycleStateError. Skipping it is what makes a
				// half-finished run resumable — and it is the ONLY error swallowed
				// here: a frozen system, a past deadline or a bad amount all
				// still stop the run, because each of those means the open should
				// not have happened at all.
				if ((err as Error)?.name === "MarketLifecycleStateError") {
					skipped += 1;
					continue;
				}
				throw err;
			}
		}
		console.log(
			`[content-markets] open: ${opened} opened at p_yes=${OPEN_PRICE} tank=${OPEN_TANK}, ${skipped} already open`,
		);
		await printReceipt(SPECS);
		expect(opened + skipped).toBe(SPECS.length);
	});

	it("wrote no row of its own (ADR-0036 primitive 4)", () => {
		// The belt, read off the ACTUAL write log rather than promised by the
		// header. Every row this run produced was written by `createMarket` /
		// `openMarket` from a `src/` frame; a write attributed to this file
		// would already have thrown at the moment it was attempted, and the
		// structural guard means there is no handle it could have travelled on.
		//
		// ⚠ `forbiddenTableWrites()` is NOT expected to be empty — `events` and
		// `pools` are in that set and the engine writes both. What must be empty
		// is the subset ATTRIBUTED TO tests/, which is the primitive-4 property.
		//
		// ⚠ AND THERE IS DELIBERATELY NO NON-EMPTY CONTROL, unlike the
		// generator's version of this assertion. This runner is idempotent: a
		// second `--create` skips all eight on MarketSlugTakenError and
		// legitimately writes nothing, and `--media` never writes at all. A
		// `length > 0` control would go red on a correct re-run, which is how a
		// control gets deleted rather than fixed. The phase's own
		// `created + skipped === 8` assertion above is what proves this run did
		// something.
		const offenders = writeLog().filter((w) =>
			w.caller.replace(/\\/g, "/").includes("/tests/"),
		);
		expect(offenders).toEqual([]);
		expect(
			forbiddenTableWrites().filter((w) =>
				w.caller.replace(/\\/g, "/").includes("/tests/"),
			),
		).toEqual([]);
	});
});
