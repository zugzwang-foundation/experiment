// SPDX-License-Identifier: AGPL-3.0-or-later

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * PERF-1 close-out — `/api/health` reports the executing region.
 *
 * WHY THIS CONTROL EXISTS. ADR-0006 ratified `bom1` on 2026-05-05; the project
 * ran `iad1` for three months. Nothing read the deployed region back and
 * compared it to the decision, and `vercel.json` was SILENT rather than wrong —
 * so it looked identical to a correct file in every diff, every CI run and every
 * review. Every control this project has watches for CHANGE; none watched for a
 * decision that never landed.
 *
 * ⚠ WHAT THIS FILE CAN AND CANNOT PROVE (V-2 — a test that a field EXISTS is
 * not a test that it reports the TRUTH). Two layers, and only together:
 *
 *   LAYER 1 — HERE. The field tracks `process.env.VERCEL_REGION` and NOTHING
 *   else. Proved by injecting an arbitrary sentinel and reading it back, so a
 *   hardcoded literal, a value derived from `ZUGZWANG_ENV`, or a constant would
 *   all FAIL. Plus the absent case → `null`, so a default can never masquerade
 *   as a reading.
 *
 *   LAYER 2 — NOT HERE, and it cannot be. Whether `VERCEL_REGION` is itself
 *   truthful is Vercel's contract, not this repo's, and no unit test can settle
 *   it. It is proved LIVE by cross-checking this field against the COMPUTE half
 *   of `x-vercel-id` (`<ingress>::<compute>`) on the SAME response — a header
 *   the edge generates independently of this function's environment. Two
 *   independently-produced sources agreeing is the actual proof. The observed
 *   result is recorded in the ADR-0006 patch record and the PERF-1 close-out.
 *
 * A reader who takes Layer 1 as the whole proof has made exactly the V-2 error
 * this comment exists to prevent.
 *
 * The DB is mocked: this file covers the response shape only, not connectivity
 * (that is `migration-drift.test.ts`' subject).
 */

vi.mock("@/db", () => ({
	db: { execute: vi.fn(async () => undefined) },
}));

vi.mock("@/server/health/migration-drift", () => ({
	migrationDriftStatus: vi.fn(async () => "ok"),
}));

const ORIGINAL = process.env.VERCEL_REGION;

beforeEach(() => {
	vi.resetModules();
});

afterEach(() => {
	if (ORIGINAL === undefined) {
		delete process.env.VERCEL_REGION;
	} else {
		process.env.VERCEL_REGION = ORIGINAL;
	}
});

async function readHealth(): Promise<Record<string, unknown>> {
	const { GET } = await import("@/app/api/health/route");
	return (await (await GET()).json()) as Record<string, unknown>;
}

describe("PERF-1 — /api/health reports the executing region", () => {
	it("health-region::tracks-VERCEL_REGION-verbatim", async () => {
		// A sentinel no real region shares. A hardcoded "bom1", a value derived
		// from ZUGZWANG_ENV, or any constant fails this outright — which is the
		// point: it pins the WIRING, not the presence of a key.
		process.env.VERCEL_REGION = "zzz9-sentinel";

		const body = await readHealth();

		expect(body.region).toBe("zzz9-sentinel");
	});

	it("health-region::second-distinct-value-also-tracks", async () => {
		// One sentinel could be satisfied by a fixture. Two distinct values
		// read back distinctly cannot be satisfied by anything but the read.
		process.env.VERCEL_REGION = "iad1";
		expect((await readHealth()).region).toBe("iad1");

		vi.resetModules();
		process.env.VERCEL_REGION = "bom1";
		expect((await readHealth()).region).toBe("bom1");
	});

	it("health-region::null-off-platform-never-a-default", async () => {
		// Local and CI have no region. `null` is the honest answer; a fallback
		// string here would be a control that reports a region it never read —
		// the precise failure mode that let iad1 survive three months.
		delete process.env.VERCEL_REGION;

		expect((await readHealth()).region).toBeNull();
	});

	it("health-region::does-not-disturb-the-existing-contract", async () => {
		process.env.VERCEL_REGION = "bom1";

		const body = await readHealth();

		// The four fields the deploy runbook's gates already read (§1, §2.2, §3).
		expect(body.status).toBe("ok");
		expect(body.db).toBe("ok");
		expect(body.migrations).toBe("ok");
		expect(body).toHaveProperty("env");
		expect(body).toHaveProperty("canary");
		// And no accidental widening — the route's own docblock pins the read
		// surface to three named env vars; a fifth key would mean it grew one.
		expect(Object.keys(body).sort()).toEqual([
			"canary",
			"db",
			"env",
			"migrations",
			"region",
			"status",
		]);
	});
});
