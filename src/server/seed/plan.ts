// SEED-STAGING-1 — how a validated sheet is split across markets, and the
// deterministic identities that make re-running the same sheet a no-op.
//
// Everything a run writes is keyed off `batchId`, a hash of the rows
// themselves. Uploading the same sheet again therefore reaches the same
// participants (by email) and the same bets (by idempotency key), and the
// engine's existing once-only backstop (`bet_receipts`, I-IDEM-ONCE-001)
// turns the repeat into a skip. No job table is needed to remember progress.

import { createHash } from "node:crypto";

import type { SeedEnvironment } from "./gate";
import type { SeedRow } from "./types";

export type SeedMarketGroup = { marketSlug: string; rows: SeedRow[] };

/**
 * Marks every event this tool causes, so seeded activity stays identifiable,
 * and names the environment it was seeded in. ⚠ Staging's values are the
 * pre-SEED-PROD-1 ones, BYTE-FOR-BYTE: a label reaches the same participant by
 * email across uploads, and the user agent is written into append-only events
 * (`user.tos_accepted`, `dharma.granted`), so changing a staging value would
 * split staging's synthetic participants into two populations with two tells.
 * Every field is per environment so that no production row carries a staging
 * label either.
 */
export const SEED_LABELS: Record<
	SeedEnvironment,
	{
		requestIdPrefix: string;
		emailDomain: string;
		tosUserAgent: string;
		oauthTokenPrefix: string;
	}
> = {
	staging: {
		requestIdPrefix: "seed-staging:",
		emailDomain: "seed.staging.invalid",
		tosUserAgent:
			"SYNTHETIC-FIXTURE-NO-USER-AGENT-WAS-RECORDED (ZugzwangSeedStaging)",
		oauthTokenPrefix: "seed-staging",
	},
	prod: {
		requestIdPrefix: "seed-production:",
		emailDomain: "seed.production.invalid",
		tosUserAgent:
			"SYNTHETIC-FIXTURE-NO-USER-AGENT-WAS-RECORDED (ZugzwangSeedProduction)",
		oauthTokenPrefix: "seed-production",
	},
};

/** `metadata.request_id` for every event of one batch. */
export function seedRequestId(env: SeedEnvironment, batchId: string): string {
	return `${SEED_LABELS[env].requestIdPrefix}${batchId.slice(0, 16)}`;
}

/**
 * Groups rows by market in first-appearance order, keeping sheet order within
 * each market. Sheet order is safe to keep: validation guarantees a reply's
 * parent is an earlier row of the same market.
 */
export function planSeedBatch(rows: readonly SeedRow[]): SeedMarketGroup[] {
	const groups = new Map<string, SeedRow[]>();
	for (const row of rows) {
		const group = groups.get(row.marketSlug);
		if (group) group.push(row);
		else groups.set(row.marketSlug, [row]);
	}
	return [...groups].map(([marketSlug, groupRows]) => ({
		marketSlug,
		rows: groupRows,
	}));
}

/** sha256 over the rows in order, field order fixed — same sheet, same id. */
export function computeBatchId(rows: readonly SeedRow[]): string {
	const canonical = JSON.stringify(
		rows.map((r) => [
			r.rowNumber,
			r.marketSlug,
			r.userLabel,
			r.side,
			r.stake,
			r.body,
			r.replyToRow,
		]),
	);
	return createHash("sha256").update(canonical).digest("hex");
}

export function seedIdempotencyKey(batchId: string, rowNumber: number): string {
	return `seed-${batchId.slice(0, 16)}-r${rowNumber}`;
}

/**
 * A labelled participant is the same person across uploads; an unlabelled
 * row is its own participant, scoped to this batch. `.invalid` is reserved
 * (RFC 2606), so no such address can ever belong to a real person.
 */
export function seedParticipantEmail(
	batchId: string,
	row: SeedRow,
	env: SeedEnvironment,
): string {
	const local =
		row.userLabel === null
			? `seed-${batchId.slice(0, 12)}-r${row.rowNumber}`
			: `seed-${row.userLabel.toLowerCase()}`;
	return `${local}@${SEED_LABELS[env].emailDomain}`;
}
