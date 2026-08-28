/**
 * The closed `events.event_type` value set, extracted from `schemas.ts`.
 *
 * ## Why this is its own module
 *
 * `schemas.ts` opens with `import "server-only"`, whose non-`react-server`
 * export condition is a bare `throw`. That is correct for the Zod payload
 * schemas beside it, which exist to validate writes on the server.
 *
 * But `EVENT_TYPES` is a frozen string tuple with no runtime, no IO and no
 * secret, and it is the source of truth two offline consumers must read at
 * RUNTIME rather than re-declare:
 *
 *   · `src/server/export/egress/completeness.ts` — mechanizes
 *     `dataset-release.md` step 2, failing the build when an event type has
 *     no SPEC.2 §19.4.1 strip rule. Re-declaring the list here would give
 *     that guard a second copy to agree with, which is precisely the drift
 *     it exists to detect.
 *   · `scripts/build-dataset.ts` — an operational `tsx` script.
 *
 * AGENTS.md §7 forbids a `tsx` script delegating into the `server-only`
 * chain, and reserves `--conditions=react-server` to a single named control.
 * Splitting the constant out is what lets the dataset script obey that rule
 * as written instead of arguing for a second exemption — the flag is gone,
 * not justified.
 *
 * ⚠ `schemas.ts` re-exports both symbols, so every existing import site is
 * unchanged. Import from THERE unless you are one of the offline consumers
 * above; this module exists to be reachable without `server-only`, not to
 * become a second front door.
 */

export const EVENT_TYPES = [
	// image_upload domain (4)
	"image_upload.sign_requested",
	"image_upload.committed",
	"image_upload.blocked",
	"image_upload.orphaned",
	// user domain (5)
	"user.oauth_signed_in",
	"user.otp_signed_in",
	"user.pseudonym_assigned",
	"user.tos_accepted",
	"user.signed_out",
	// admin domain (2)
	"admin.signed_in",
	"admin.signed_out",
	// market domain (7) — ENGINE.0 + ENGINE.9 (resolving); lifecycle
	// (created→opened→closed→resolving) + settlement (resolved/corrected/
	// voided). All ride aggregate_type "market".
	"market.created",
	"market.opened",
	"market.closed",
	"market.resolving",
	"market.resolved",
	"market.corrected",
	"market.voided",
	// bet domain (2) — ENGINE.0
	"bet.placed",
	"bet.sold",
	// comment domain (1) — ENGINE.0 (SPEC.2 §13.1 canonical name)
	"comment.placed",
	// dharma domain (2) — ENGINE.0 + ENGINE.13
	"dharma.credited",
	"dharma.granted",
	// moderation domain (1) — AUDIT-FIX-B5 (A13): the gate-block consequence emit
	"moderation.blocked",
] as const;

export type EventType = (typeof EVENT_TYPES)[number];
