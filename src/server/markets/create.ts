import "server-only";

import { eq } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";

import { marketMedia, markets } from "@/db/schema";
import { assertAdminActor } from "@/server/admin/actor";
import { insertEvent } from "@/server/events/insert";

import {
	MarketContentRequiredError,
	MarketDeadlineCeilingError,
	MarketDeadlineInPastError,
	MarketIdConflictError,
	MarketSlugInvalidError,
	MarketSlugTakenError,
} from "./errors";
import {
	isUuidV7,
	type MarketMediaInput,
	normalizeMediaVideoUrl,
	validateMediaManifest,
} from "./media";
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

/** A 23505 unique-violation's constraint name, or null if `err` isn't one.
 * Reads `.constraint_name` from `.cause` first then top-level (the W-1/W-4
 * `.cause.code ?? .code` extraction shape; `as` at the trust boundary). */
function uniqueViolationConstraint(err: unknown): string | null {
	const e = err as {
		code?: unknown;
		constraint_name?: unknown;
		cause?: { code?: unknown; constraint_name?: unknown };
	};
	const code = e.cause?.code ?? e.code;
	if (code !== "23505") return null;
	const constraint = e.cause?.constraint_name ?? e.constraint_name;
	return typeof constraint === "string" ? constraint : "";
}

/**
 * F-ADMIN-1 — market creation into `Draft` (SPEC.1 §15 :861-867). Content
 * mapping per R-14.4: question → `title`, resolution criterion →
 * `description` (service-required; the column stays nullable). W-4 create
 * branch: NO row lock (§Wrapper (c)); in-tx slug pre-check → typed
 * `MarketSlugTakenError` (D-14.a).
 *
 * MEDIA.1 (ADR-0026 / ADR-0027): the admin sets the market-media pool at
 * create. `marketId` is REQUIRED — the client pre-generates the UUIDv7 PK so
 * media bytes can upload out-of-band to `m/<marketId>/` BEFORE the row exists
 * (Q3 trust boundary). The INSERT is STRICT INSERT-ONLY (no onConflict): a
 * supplied existing id → `MarketIdConflictError` (never an upsert), so it
 * cannot touch any existing market's data. `media` (≥1, exactly one default)
 * + the optional outbound `mediaVideoUrl` are service-required VALIDATION (the
 * §15 invariant), NOT moderation. The market_media rows + the payload-extended
 * `market.created` commit in the SAME tx as the markets row. NO external HTTP
 * in the tx (no moderation hop — ADR-0027). Zero `dharma_ledger` rows.
 */
export async function createMarket(args: {
	/** MEDIA.1: client-pre-generated UUIDv7 PK (inserted verbatim, insert-only). */
	marketId: string;
	slug: string;
	title: string;
	description: string;
	resolutionDeadline: Date;
	/** MEDIA.1: at-create media manifest — ≥1 image, exactly one isDefault. */
	media: readonly MarketMediaInput[];
	/** MEDIA.1: optional outbound YouTube URL; null/absent when unset. */
	mediaVideoUrl?: string | null;
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
	// Validation order per plan §Flows (1)–(5) + the MEDIA.1 additions.
	assertAdminActor(args.metadata);
	// Defensive: the wire zod-validates the client-supplied PK is a UUIDv7
	// before this runs (a malformed id → validation_error there). A non-v7 id
	// reaching the service is a caller bug — guard so a bad id never hits the
	// uuid column as a raw driver error.
	if (!isUuidV7(args.marketId)) {
		throw new Error(
			`createMarket: marketId must be a UUIDv7 (got ${JSON.stringify(args.marketId)})`,
		);
	}
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
	// MEDIA.1 service invariant (§15): ≥1 image + exactly one is_default.
	validateMediaManifest(args.media);
	// MEDIA.1 (Q3 R2 facet, defense-in-depth): every submitted media key MUST
	// match the EXACT server-minted shape `m/<marketId>/<mediaId>.<ext>` for THIS
	// market. The sign route generates the key server-side; a key that deviates
	// is tampering / a bug — reject (→ error_internal + Sentry via toActionError)
	// so a market_media row can never point display at another market's (or an
	// arbitrary) R2 object. An EXACT match (not a `startsWith` prefix) is
	// load-bearing: a prefix check passes `m/<marketId>/../<other>/x.jpg`, which
	// normalizes to a FOREIGN prefix; the single-segment pattern below rejects any
	// `/` or `..` after the namespace. `args.marketId` is a validated UUIDv7
	// (above) so it is regex-safe to interpolate. Makes the §5 "row-driven display
	// cannot surface foreign media" guarantee hold by construction.
	const keyRe = new RegExp(`^m/${args.marketId}/[0-9a-f-]{36}\\.[a-z0-9]+$`);
	for (const m of args.media) {
		if (!keyRe.test(m.key)) {
			throw new Error(
				`createMarket: media key ${JSON.stringify(m.key)} is not the m/${args.marketId}/<mediaId>.<ext> form`,
			);
		}
	}
	// MEDIA.1: normalize/validate the optional outbound video URL (or null).
	const normalizedVideoUrl = normalizeMediaVideoUrl(args.mediaVideoUrl);
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
	const marketId = args.marketId;

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

			// STRICT INSERT-ONLY under the client-supplied PK (Q3): a plain
			// INSERT with NO onConflict. A PK collision (supplied id already
			// exists) raises 23505 → caught → typed MarketIdConflictError (never
			// a raw 500, never an upsert). The slug-unique 23505 is normally
			// pre-empted above (or surfaces as 40001 under SSI and retries); the
			// constraint check keeps it typed as a belt.
			try {
				await tx.insert(markets).values({
					id: marketId,
					slug: args.slug,
					title: args.title,
					description: args.description,
					resolutionDeadline: args.resolutionDeadline,
					mediaVideoUrl: normalizedVideoUrl,
				});
			} catch (err) {
				const constraint = uniqueViolationConstraint(err);
				if (constraint !== null) {
					if (constraint.includes("slug")) {
						throw new MarketSlugTakenError(
							`market slug already taken: ${args.slug}`,
						);
					}
					throw new MarketIdConflictError(
						`market id already exists: ${marketId}`,
					);
				}
				throw err;
			}

			// MEDIA.1: the market_media rows ride the SAME tx (create atomicity).
			// created_by defaults to 'admin-singleton'; the partial unique index
			// is the exactly-one-default backstop (the service already enforced it).
			await tx.insert(marketMedia).values(
				args.media.map((m) => ({
					marketId,
					r2ObjectKey: m.key,
					displayOrder: m.displayOrder,
					isDefault: m.isDefault,
				})),
			);

			await insertEvent(tx, {
				eventId: createdEventId,
				eventType: "market.created",
				aggregateType: "market",
				aggregateId: marketId,
				payload: {
					marketId,
					// The S1 M2 pin: UTC Z form via toISOString().
					resolutionDeadline: args.resolutionDeadline.toISOString(),
					// MEDIA.1 (OD-2): the media manifest rides the existing event —
					// object key + carousel order + default flag (no mediaId).
					media: args.media.map((m) => ({
						key: m.key,
						displayOrder: m.displayOrder,
						isDefault: m.isDefault,
					})),
					mediaVideoUrl: normalizedVideoUrl,
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
