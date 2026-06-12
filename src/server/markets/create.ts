import "server-only";

import { eq } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";

import { markets } from "@/db/schema";
import { assertAdminActor } from "@/server/admin/actor";
import { insertEvent } from "@/server/events/insert";

import {
	MarketContentRequiredError,
	MarketDeadlineCeilingError,
	MarketDeadlineInPastError,
	MarketSlugInvalidError,
	MarketSlugTakenError,
} from "./errors";
import {
	type LifecycleEventMetadata,
	runLifecycleTransaction,
} from "./transaction";

/**
 * R-14.6: the SPEC.1 §12.1 deadline ceiling — the J10 conclusion-freeze
 * instant, a FIXED date, not a tuning value. Service guard only (`==`
 * passes per §12.1 "≤"); the DB CHECK is a HARDEN candidate (CF-2).
 */
export const FREEZE_INSTANT_UTC = new Date("2026-11-05T23:59:00.000Z");

/** D-14.a: kebab slug, length 3–80, caller-supplied (no auto-slugify). */
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SLUG_MIN_LENGTH = 3;
const SLUG_MAX_LENGTH = 80;

/**
 * F-ADMIN-1 — market creation into `Draft` (SPEC.1 §15 :861-867). Content
 * mapping per R-14.4: question → `title`, resolution criterion →
 * `description` (service-required; the column stays nullable). W-4 create
 * branch: NO row lock (§Wrapper (c)); in-tx slug pre-check → typed
 * `MarketSlugTakenError` (D-14.a; a surfaced 23505 is a logic bug, OQ-7).
 * Emits `market.created` with payload `{ marketId, resolutionDeadline }` —
 * `seedAmount` rides `market.opened` (R-14.1). Zero `dharma_ledger` rows.
 */
export async function createMarket(args: {
	slug: string;
	title: string;
	description: string;
	resolutionDeadline: Date;
	/** D-14.e: the clock is an argument — never read internally. */
	now: Date;
	metadata: LifecycleEventMetadata;
	/** Gate ruling: supplied → used verbatim; absent → minted at entry. */
	eventId?: string;
}): Promise<{
	marketId: string;
	slug: string;
	status: "Draft";
	createdEventId: string;
}> {
	// Validation order per plan §Flows (1)–(5).
	assertAdminActor(args.metadata);
	if (
		!SLUG_RE.test(args.slug) ||
		args.slug.length < SLUG_MIN_LENGTH ||
		args.slug.length > SLUG_MAX_LENGTH
	) {
		throw new MarketSlugInvalidError(
			`invalid market slug ${JSON.stringify(args.slug)} (kebab-case, 3-80 chars)`,
		);
	}
	if (args.title.trim() === "") {
		throw new MarketContentRequiredError("market title is required");
	}
	if (args.description.trim() === "") {
		throw new MarketContentRequiredError(
			"market description (the resolution criterion) is required",
		);
	}
	if (args.resolutionDeadline.getTime() <= args.now.getTime()) {
		throw new MarketDeadlineInPastError(
			`resolution deadline ${args.resolutionDeadline.toISOString()} is not after now ${args.now.toISOString()}`,
		);
	}
	if (args.resolutionDeadline.getTime() > FREEZE_INSTANT_UTC.getTime()) {
		throw new MarketDeadlineCeilingError(
			`resolution deadline ${args.resolutionDeadline.toISOString()} exceeds the freeze ceiling ${FREEZE_INSTANT_UTC.toISOString()}`,
		);
	}

	// Resolved ONCE at entry, closed over across retries (ADR-0016 D1).
	const createdEventId = args.eventId ?? uuidv7();

	return runLifecycleTransaction(
		{ marketId: null, flow: "F-ADMIN-1", expectedStatus: null },
		async ({ tx }) => {
			const existing = await tx
				.select({ id: markets.id })
				.from(markets)
				.where(eq(markets.slug, args.slug));
			if (existing.length > 0) {
				throw new MarketSlugTakenError(
					`market slug already taken: ${args.slug}`,
				);
			}

			const inserted = await tx
				.insert(markets)
				.values({
					slug: args.slug,
					title: args.title,
					description: args.description,
					resolutionDeadline: args.resolutionDeadline,
				})
				.returning({ id: markets.id });
			const marketId = inserted[0]?.id;
			if (marketId === undefined) {
				throw new Error("createMarket: markets INSERT returned no row");
			}

			await insertEvent(tx, {
				eventId: createdEventId,
				eventType: "market.created",
				aggregateType: "market",
				aggregateId: marketId,
				payload: {
					marketId,
					// The S1 M2 pin: UTC Z form via toISOString().
					resolutionDeadline: args.resolutionDeadline.toISOString(),
				},
				metadata: args.metadata,
			});

			return {
				marketId,
				slug: args.slug,
				status: "Draft" as const,
				createdEventId,
			};
		},
	);
}
