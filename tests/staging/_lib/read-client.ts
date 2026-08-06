// STAGING-PARITY Slice B — the GATES runner's database handle.
// NEVER import this from src/**.
//
// Separate from `_lib/client.ts` for one reason: that module resolves its
// target with `requireWriteIntent: true` at MODULE SCOPE, because it is the
// generator's handle and the generator writes. The gates only read, and
// demanding a destructive-intent token for a read-only run would train the
// operator to export the token into their shell — the exact decay ADR-0035
// Addendum A.1 describes. So the gates resolve the same predicate with the
// intent requirement off, and everything else about the contract is identical:
// no default mode, loopback-only for local, the full G-1/G-2 contract for
// staging, and the production ref refused first in both.
//
// This hands out an UNPROXIED drizzle client, unlike the generator's. That is
// deliberate and narrow: `loadDurableReplay` (gate 3) takes a real `DbClient`,
// and wrapping it in the write guard would buy nothing — the gates issue no
// writes, and `tests/unit/staging/generator-no-direct-writes.test.ts` scans
// this directory including the gates runner.

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/db/schema";
import { assertLiveConnection } from "./reset";
import { resolveRunnerTarget } from "./target";

const target = resolveRunnerTarget(process.env, { requireWriteIntent: false });
if (!target.ok) {
	throw new Error(
		`REFUSED — the staging gates target guard did not pass.\n  ${target.reason}\n\n` +
			"Run it as: pnpm staging:gates",
	);
}

export const GATES_MODE = target.mode;
const TARGET_URL = target.url;

const client = postgres(TARGET_URL, { max: 5, prepare: false });

/** Drizzle handle for the gates. Reads only. */
export const gatesDb = drizzle(client, { schema });

/** Raw handle, for the SQL the gates are specified as (manifest §4). */
export const gatesClient = client;

/**
 * G-3 for the GATES — the same live-socket assertion the reset and the
 * generator use, reusing the reset's own function so the three cannot drift
 * (@code-reviewer, Slice B). Staging mode only.
 *
 * The gates only read, so a wrong target here misreports rather than
 * mis-writes — but a gate run that silently verified the WRONG database would
 * report four greens for a fixture set nobody built, which is a worse failure
 * than a refusal.
 */
export async function assertGatesLiveConnection(): Promise<void> {
	if (GATES_MODE !== "staging") return;
	const fragment = process.env.STAGING_PROJECT_REF_FRAGMENT;
	if (!fragment) {
		throw new Error(
			"G-3 failed: STAGING_PROJECT_REF_FRAGMENT is unset at connection time; refusing",
		);
	}
	await assertLiveConnection(client, fragment);
}

export async function closeGatesConnection(): Promise<void> {
	await client.end({ timeout: 10 });
}

export function describeGatesTarget(): string {
	try {
		return `${GATES_MODE} · ${new URL(TARGET_URL).host}`;
	} catch {
		return `${GATES_MODE} · (unparseable host)`;
	}
}
