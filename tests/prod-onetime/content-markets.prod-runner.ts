import { HeadObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { asc, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// ═══════════════════════════════════════════════════════════════════════════
// MKT-ROSTER-1 · ONE-TIME · the PRODUCTION six-market restore.
//
// ⛔⛔ NEVER MERGED. D-49 (`docs/decisions/RECORD-v2.8-amendment.md`) authorises
// ONE pre-launch production run of an operational runner, while every
// production account is a test account. ADR-0036 — "no operational runner
// touches production, now or later" — carries the callout recording it. The
// branch is closed unmerged afterwards and deleted.
//
// ── WHY A RUNNER AND NOT A SCRIPT, AGAIN ───────────────────────────────────
// The same three blockers the staging seeder documents, unchanged by the target:
// `server-only`'s exports map kills plain `tsx`; `canonicalize@3.0.0` is
// ESM-only and kills `tsx --conditions=react-server`; and `openMarket` calls
// `next/cache`'s `revalidateTag`, which needs a module mock `tsx` cannot install.
// So the engine driving happens here and `scripts/_onetime/mkt-roster-1-prod-restore.ts`
// is the CLI.
//
// ⚠ THE FILE IS NOT NAMED `*.test.ts`, DELIBERATELY. `vitest.config.ts` includes
// `tests/**/*.{test,spec}.{ts,tsx}` and excludes only `tests/scale/**` and
// `tests/staging/**` — measured, not assumed — so a `.test.ts` here would be
// collected by a bare `pnpm vitest run`. It cannot be collected by a name it
// does not have. See `vitest.prod-onetime.config.ts`'s header.
//
// ── WHY THE RESTORE DRIVES THE ENGINE ──────────────────────────────────────
// A restore that INSERTed snapshot rows would rebuild the STATE and skip the
// EVENTS, and since ADR-0047 §E a market without its `market.opened` genesis row
// can no longer be settled or voided at all — and `replayReserveSeries` seeds its
// walk from that row, so the chart would render nothing. `I-GENESIS-001` asserts
// exactly this property. The state is a CONSEQUENCE of the engine having run.
//
// ── THE MOCKING BOUNDARY (ADR-0036 primitive 3) ────────────────────────────
// MAY be mocked: next/headers · next/navigation · next/cache · the admin
// session gate. MUST NEVER be mocked: anything that writes a row or moves
// Dharma. `createMarket` and `openMarket` run unmodified.
//
// NO ROW IS WRITTEN BY THIS FILE. `@/db` resolves to the write-guarded client,
// which attributes every write to its immediate caller and throws when that
// caller is under `tests/` — a rule that already covers this directory, with no
// allowance added for it.
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

vi.mock("next/navigation", () => ({ redirect: vi.fn(), notFound: vi.fn() }));

vi.mock("next/cache", () => ({
	revalidatePath: vi.fn(),
	revalidateTag: vi.fn(),
	updateTag: vi.fn(),
}));

// A PARTIAL MOCK. `canonicalizeAmount18` lives in the same module and is a REAL
// dependency of the open — the admin wire canonicalises both amounts before
// `openMarket` sees them, so an over-precision price must be rejected at the
// boundary rather than silently rounded into a market that opened elsewhere.
vi.mock("@/server/admin/wire", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/server/admin/wire")>();
	return { ...actual, requireAdminSession: vi.fn() };
});

// THE LOAD-BEARING MOCK — the engine writes through the write-guarded client.
vi.mock("@/db", async () => {
	const { guardedDb } = await import("./_lib/prod-client");
	return { db: guardedDb };
});
vi.mock("@/db/index", async () => {
	const { guardedDb } = await import("./_lib/prod-client");
	return { db: guardedDb };
});

import { markets, pools } from "@/db/schema";
import { canonicalizeAmount18 } from "@/server/admin/wire";
import { CpmmDecimal } from "@/server/cpmm/decimal";
import { createMarket } from "@/server/markets/create";
import { openMarket } from "@/server/markets/open";

import {
	assertProdLiveConnection,
	closeProdConnection,
	describeProdTarget,
	forbiddenTableWrites,
	readOnly,
	writeLog,
} from "./_lib/prod-client";
import {
	loadProdContentMarkets,
	type ProdMarketSpec,
} from "./prod-content-markets";

const PHASE_ENV = "ZUGZWANG_PROD_RESTORE_PHASE";
const PRICE_ENV = "ZUGZWANG_PROD_RESTORE_PRICE";
const TANK_ENV = "ZUGZWANG_PROD_RESTORE_TANK";
const ACK_ENV = "ZUGZWANG_PROD_RESTORE_ACK";
const ACK_VALUE = "restore-prod-six-markets";

const PHASES = ["create", "open", "media"] as const;
type Phase = (typeof PHASES)[number];

// ── THE INTENT TOKEN, AT MODULE SCOPE ───────────────────────────────────────
// The G-5 analogue. It is checked HERE rather than inherited from the CLI,
// because a guard you cannot see in the file you are reading is a guard the next
// editor will not know to keep.
if (process.env[ACK_ENV] !== ACK_VALUE) {
	throw new Error(
		`REFUSED — ${ACK_ENV} must be ${JSON.stringify(ACK_VALUE)}. This writes to PRODUCTION under a ` +
			"one-time authorisation (D-49); intent is stated or nothing runs.",
	);
}

const rawPhase = process.env[PHASE_ENV];
if (!PHASES.includes(rawPhase as Phase)) {
	throw new Error(
		`REFUSED — ${PHASE_ENV} must be one of ${PHASES.join(" | ")} (saw ${
			rawPhase === undefined ? "unset" : JSON.stringify(rawPhase)
		}). There is deliberately no default.`,
	);
}
const PHASE = rawPhase as Phase;

const OPEN_PRICE =
	PHASE === "open" ? canonicalizeAmount18(process.env[PRICE_ENV] ?? "") : "";
const OPEN_TANK =
	PHASE === "open" ? canonicalizeAmount18(process.env[TANK_ENV] ?? "") : "";

const SPECS = loadProdContentMarkets();

function adminMetadata(flowId: string) {
	return {
		request_id: "mkt-roster-1-prod-restore",
		flow_id: flowId,
		user_id: null,
		actor_id: "admin-singleton",
		idempotency_key: null,
		ip: "127.0.0.1",
		user_agent: "zugzwang-prod-restore/1",
	};
}

/**
 * HeadObject every media key BEFORE a market is created, so a market is never
 * created pointing at bytes that are not there.
 *
 * `createMarket` validates the key's SHAPE and never touches R2. That is right
 * for invented fixtures and wrong here: these six point at real images that must
 * survive the wipe, and the whole reason for reusing the original market ids is
 * that their keys stay valid. If one has gone, the answer is to find it.
 *
 * ⚠ The market-media bucket is SHARED between staging and production. This only
 * ever reads (`HeadObject`), so it cannot harm the other environment — but the
 * keys are market-id-scoped and the id spaces are disjoint, which is what makes
 * a read here unambiguous about which environment's objects it found.
 */
async function verifyMediaObjects(
	specs: readonly ProdMarketSpec[],
): Promise<number> {
	const endpoint = process.env.R2_ENDPOINT_MARKET_MEDIA;
	const accessKeyId = process.env.R2_ACCESS_KEY_ID_MARKET_MEDIA;
	const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY_MARKET_MEDIA;
	const Bucket = process.env.R2_BUCKET_MARKET_MEDIA;
	if (!endpoint || !accessKeyId || !secretAccessKey || !Bucket) {
		throw new Error(
			"REFUSED — the market-media R2 arm is not configured. An unconfigured arm is not a passing media check.",
		);
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
			} catch (err) {
				// O-3 — the REASON travels with the refusal. A `NotFound` and an
				// expired credential both stop this run and want opposite responses.
				missing.push(
					`${spec.slug}  ${m.key}  (${(err as Error)?.name ?? "unknown"})`,
				);
			}
		}
	}
	if (missing.length > 0) {
		throw new Error(
			`REFUSED — ${missing.length} of ${checked} media object(s) did not answer in ${Bucket}. ` +
				"NotFound means the object is gone; anything else means this run learned nothing about whether it is there.\n" +
				missing.map((m) => `  · ${m}`).join("\n"),
		);
	}
	console.log(
		`[prod-restore] media OK — ${checked}/${checked} objects present in ${Bucket}`,
	);
	return checked;
}

/**
 * ⛔⛔ THE PRECONDITION THAT TIES THIS RESTORE TO ITS WIPE (`@code-reviewer`, HIGH).
 *
 * Both write phases are idempotent by swallowing exactly one error each —
 * `MarketSlugTakenError` on create, `MarketLifecycleStateError` on open — which
 * is what makes a half-finished run resumable. It is ALSO what makes a run
 * against a PRE-WIPE production report success having done nothing: all six
 * slugs already exist, all six are already `Open`, every error is swallowed, and
 * `created + skipped === 6` passes.
 *
 * That matters because §B3.3 step 9 deletes MUM/OKT's R2 objects AFTER the
 * restore. A silently-skipped restore is followed by deleting the images of two
 * markets whose rows are still live.
 *
 * ⇒ The table may hold ONLY slugs from the authorised six. Zero of them is a
 * fresh post-wipe database; one to six is a resumed run; ANYTHING ELSE means the
 * wipe has not happened, and the two removed slugs are the loudest possible
 * instance of "anything else".
 */
async function assertRestorePrecondition(
	specs: readonly ProdMarketSpec[],
): Promise<void> {
	const expected = new Set(specs.map((s) => s.slug));
	const rows = await readOnly.select({ slug: markets.slug }).from(markets);
	const foreign = rows.map((r) => r.slug).filter((s) => !expected.has(s));
	if (foreign.length > 0) {
		throw new Error(
			`REFUSED — \`markets\` holds ${foreign.length} slug(s) this restore is not authorised to touch:\n` +
				foreign.map((s) => `  · ${s}`).join("\n") +
				"\n\nThe table should hold only the six being restored (none on a fresh post-wipe\n" +
				"database, some on a resumed run). Anything else means the wipe has not run, and a\n" +
				"restore here would report success having done nothing — after which §B3.3 step 9\n" +
				"deletes the removed markets' R2 objects while their rows are still live.",
		);
	}
	console.log(
		`[prod-restore] precondition OK — \`markets\` holds ${rows.length} row(s), all within the authorised six`,
	);
}

/**
 * The POST-condition for `--open`, which is the one a pre-wipe run cannot fake.
 * A market left over from before the wipe is `Open` with DRIFTED reserves
 * (measured on production 2026-09-18: p_yes 0.187–0.232, not 0.1). Asserting the
 * seed exactly is what turns "six rows are Open" into "six rows this run opened".
 */
async function assertOpenedAtSeed(
	specs: readonly ProdMarketSpec[],
): Promise<void> {
	const rows = await readOnly
		.select({
			slug: markets.slug,
			status: markets.status,
			yes: pools.yesReserves,
			no: pools.noReserves,
		})
		.from(markets)
		.leftJoin(pools, eq(pools.marketId, markets.id))
		.orderBy(asc(markets.slug));
	const bad = rows.filter(
		(r) =>
			r.status !== "Open" ||
			r.yes !== "90000.000000000000000000" ||
			r.no !== "10000.000000000000000000",
	);
	if (rows.length !== specs.length || bad.length > 0) {
		throw new Error(
			`REFUSED — the open phase did not leave ${specs.length} markets at the ratified seed.\n` +
				`  rows: ${rows.length}\n` +
				bad
					.map(
						(r) => `  · ${r.slug} status=${r.status} yes=${r.yes} no=${r.no}`,
					)
					.join("\n") +
				"\n\nDrifted reserves mean these markets predate the wipe and this run skipped them.",
		);
	}
	console.log(
		`[prod-restore] post-condition OK — ${rows.length} markets Open at yes=90000 / no=10000`,
	);
}

async function printReceipt(specs: readonly ProdMarketSpec[]): Promise<void> {
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
	console.log("\n[prod-restore] receipt");
	for (const r of rows) {
		const price =
			r.yes && r.no
				? new CpmmDecimal(r.no)
						.div(new CpmmDecimal(r.yes).plus(new CpmmDecimal(r.no)))
						.toFixed(6)
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
	// G-3' — the live socket, not the config. A throwing beforeAll fails the
	// suite WITHOUT executing it, so nothing below can write.
	await assertProdLiveConnection();
	console.log(
		`[prod-restore] target ${describeProdTarget()} · phase=${PHASE} · ${SPECS.length} markets`,
	);
});

afterAll(async () => {
	await closeProdConnection();
});

describe("MKT-ROSTER-1 production restore", () => {
	it(`runs the ${PHASE} phase`, async () => {
		if (PHASE === "media") {
			await verifyMediaObjects(SPECS);
			await printReceipt(SPECS);
			return;
		}

		if (PHASE === "create") {
			// ⛔ THE PRECONDITION FIRST — before R2, before any write.
			await assertRestorePrecondition(SPECS);
			// R2 next. A market must never be created pointing at bytes that are
			// not there; this throws before a single row is written.
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
					// IDEMPOTENT ON SLUG, and this is the ONLY error swallowed:
					// matched by NAME rather than `instanceof`, because the class is
					// imported through the same aliased module graph the engine uses
					// and a name check cannot be defeated by a second copy of it.
					if ((err as Error)?.name === "MarketSlugTakenError") {
						skipped += 1;
						continue;
					}
					throw err;
				}
			}
			console.log(
				`[prod-restore] create: ${created} created, ${skipped} already present`,
			);
			await printReceipt(SPECS);
			// ⚠ TAUTOLOGY, kept as a shape check only — see the open phase.
			expect(created + skipped).toBe(SPECS.length);
			// The real post-condition: exactly the six exist, and nothing else.
			const after = await readOnly.select({ slug: markets.slug }).from(markets);
			expect(after.length, "create must leave exactly the six").toBe(
				SPECS.length,
			);
			return;
		}

		// PHASE === "open"
		await assertRestorePrecondition(SPECS);
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
				// IDEMPOTENT ON STATUS — the W-4 wrapper gates on
				// `expectedStatus: ["Draft"]`. Skipping an already-Open market is
				// what makes a half-finished run resumable, and it is the only
				// error swallowed: a frozen system, a past deadline or a bad amount
				// all still stop the run, because each means the open should not
				// have happened at all.
				if ((err as Error)?.name === "MarketLifecycleStateError") {
					skipped += 1;
					continue;
				}
				throw err;
			}
		}
		console.log(
			`[prod-restore] open: ${opened} opened at p_yes=${OPEN_PRICE} tank=${OPEN_TANK}, ${skipped} already open`,
		);
		await printReceipt(SPECS);
		// ⚠ `opened + skipped === SPECS.length` is a TAUTOLOGY — every iteration
		// either increments a counter or rethrows — so it is kept only as a shape
		// check. The assertion that proves this run did something is the seed
		// post-condition below.
		expect(opened + skipped).toBe(SPECS.length);
		await assertOpenedAtSeed(SPECS);
	});

	it("wrote no row of its own (ADR-0036 primitive 4)", () => {
		// The belt, read off the ACTUAL write log rather than promised by the
		// header. Every row this run produced was written by `createMarket` /
		// `openMarket` from a `src/` frame; a write attributed to this file would
		// already have thrown when it was attempted, and the structural guard
		// means there is no handle it could have travelled on.
		//
		// ⚠ `forbiddenTableWrites()` IS NOT EXPECTED TO BE EMPTY, and a first
		// draft of this file asserted that it was. `events` and `pools` are in
		// that set and the engine writes both on every open — so the empty
		// assertion would have gone red on a correct run and been "fixed" by
		// deleting it. What must be empty is the subset ATTRIBUTED TO `tests/`,
		// which is the primitive-4 property and nothing weaker.
		//
		// ⚠ AND THERE IS DELIBERATELY NO NON-EMPTY CONTROL. This runner is
		// idempotent: a second `--create` skips all six on MarketSlugTakenError
		// and legitimately writes nothing, and `--media` never writes at all. A
		// `length > 0` control would go red on a correct re-run, which is how a
		// control gets deleted rather than fixed.
		// ⛔ AN EARLIER VERSION OF THIS COMMENT CLAIMED `created + skipped === 6`
		// PROVED THE RUN DID SOMETHING. It proves nothing — every iteration either
		// increments a counter or rethrows, so the sum is 6 by construction, and
		// it was offered as the justification for omitting the control above.
		// `assertRestorePrecondition` and `assertOpenedAtSeed` are what actually
		// tie this run to its wipe (`@code-reviewer`, HIGH/MEDIUM).
		const underTests = (caller: string) =>
			caller.replace(/\\/g, "/").includes("/tests/");
		expect(writeLog().filter((w) => underTests(w.caller))).toEqual([]);
		expect(forbiddenTableWrites().filter((w) => underTests(w.caller))).toEqual(
			[],
		);
	});
});
