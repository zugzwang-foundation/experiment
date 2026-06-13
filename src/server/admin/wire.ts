import "server-only";

import { captureException } from "@sentry/nextjs";
import { cookies, headers } from "next/headers";
import type { z } from "zod";
import { AdminActorError } from "@/server/admin/actor";
import { validateAdminSession } from "@/server/auth/admin/validate";
import type { eventMetadataSchema } from "@/server/events/schemas";
import {
	LifecycleSerializationExhaustedError,
	MarketContentRequiredError,
	MarketDeadlineCeilingError,
	MarketDeadlineInPastError,
	MarketDeadlineNotReachedError,
	MarketLifecycleStateError,
	MarketSeedInvalidError,
	MarketSlugInvalidError,
	MarketSlugTakenError,
} from "@/server/markets/errors";
import type { LifecycleFlow } from "@/server/markets/transaction";
import {
	CorrectionOutcomeError,
	ResolutionSerializationExhaustedError,
	ResolutionStateError,
} from "@/server/resolution/errors";
import type { ResolutionFlow } from "@/server/resolution/transaction";

// ENGINE.15 S2 — the shared admin-wire module (D-15.b), sibling to actor.ts.
// requireAdminSession (Layer-2 gate, SA-I-1) · buildAdminMetadata (the §3.7
// 7-key block, SA-M-1 admin actor) · canonicalizeAmount18 (CR-3/SA-I-3) ·
// toActionError (the §Wire-error map, SA-L-3 typed codes only — never raw
// `.message`). NOT a "use server" module: it exports non-action helpers; the
// action wrappers under markets/ import from here.

/** SPEC.2 §4.4 Server-Action return envelope. */
export type ActionResult<T> =
	| { ok: true; data: T }
	| {
			ok: false;
			error: {
				code: string;
				message: string;
				field_errors?: Record<string, string[]>;
			};
	  };

/** Both LifecycleEventMetadata and ResolutionEventMetadata are this shape. */
type AdminEventMetadata = z.infer<typeof eventMetadataSchema>;

type AdminFlow = LifecycleFlow | ResolutionFlow;

/**
 * SA-I-1 — the Layer-2 admin session gate at every action entry. Wraps
 * `validateAdminSession(await cookies())` (the CVE-2025-29927 boundary; Layer-1
 * proxy.ts is UX-only). Returns the session or null; the caller maps null to
 * the `admin_session_required` envelope with ZERO writes.
 */
export async function requireAdminSession(): Promise<{
	sessionId: string;
} | null> {
	return validateAdminSession(await cookies());
}

/**
 * Replicated x-forwarded-for parse (mirrors `auth/admin/login.ts` + the §7
 * convention). NOT imported from login.ts — that module is `"use server"`, so
 * its helpers cannot be re-exported. Takes a header getter so the same code
 * serves both Server Actions (`await headers()`) and the cron Route Handler
 * (`request.headers`, the D-15.g call site).
 */
function getClientIp(get: (name: string) => string | null): string {
	const fwd = get("x-forwarded-for");
	if (fwd) {
		const first = fwd.split(",")[0]?.trim();
		if (first) return first;
	}
	return "unknown";
}

/**
 * D-15.b — the §3.7 metadata block: EXACTLY the 7 `eventMetadataSchema` keys.
 * `actor_id: 'admin-singleton'` + `user_id: null` is the admin-actor surface
 * (also satisfies `assertAdminActor`, SA-M-1); `idempotency_key: null` (admin
 * actions carry no Idempotency-Key header). `ip`/`user_agent`/`request_id` come
 * from `next/headers` (or the passed `request` for the cron route). No event
 * id is ever derived here — ids are minted in the action wrappers (B-8/SA-M-1).
 */
export async function buildAdminMetadata(args: {
	flowId: AdminFlow;
	request?: Request;
}): Promise<AdminEventMetadata> {
	const headerStore = args.request ? args.request.headers : await headers();
	const get = (name: string): string | null => headerStore.get(name);
	return {
		request_id: get("x-vercel-id") ?? "unknown",
		flow_id: args.flowId,
		user_id: null,
		actor_id: "admin-singleton",
		idempotency_key: null,
		ip: getClientIp(get),
		user_agent: get("user-agent") ?? "unknown",
	};
}

const POSITIVE_DECIMAL_RE = /^\d+(?:\.\d+)?$/;
const FRACTION_DIGITS = 18;
/** NUMERIC(38,18) → 38 − 18 = 20 integer digits. */
const MAX_INTEGER_DIGITS = 20;

/**
 * CR-3/SA-I-3 — canonicalize a wire amount string to the exact
 * `^[0-9]+\.[0-9]{18}$` NUMERIC(38,18) form: one integer digit minimum (leading
 * zeros stripped), exactly 18 fractional digits (right-padded), value > 0.
 * Pure string math — no float, no rounding (money never rounds at the wire), so
 * a >18-dp input is REJECTED, never truncated. Sign / exponent / empty / bare
 * trailing-dot / zero all reject. Throws `MarketSeedInvalidError` (mapped to
 * `seed_invalid`); the canonical string is what `openMarket` stores verbatim
 * and what the `market.opened` payload records.
 */
export function canonicalizeAmount18(input: string): string {
	if (!POSITIVE_DECIMAL_RE.test(input)) {
		throw new MarketSeedInvalidError(
			`invalid amount ${JSON.stringify(input)} (positive decimal string, no sign/exponent)`,
		);
	}
	const [intPartRaw, fracPartRaw = ""] = input.split(".");
	if (fracPartRaw.length > FRACTION_DIGITS) {
		throw new MarketSeedInvalidError(
			`amount ${JSON.stringify(input)} exceeds 18 decimal places (money never rounds at the wire)`,
		);
	}
	const intPart = (intPartRaw ?? "").replace(/^0+(?=\d)/, "");
	if (intPart.length > MAX_INTEGER_DIGITS) {
		throw new MarketSeedInvalidError(
			`amount ${JSON.stringify(input)} exceeds the NUMERIC(38,18) integer range`,
		);
	}
	const fracPart = fracPartRaw.padEnd(FRACTION_DIGITS, "0");
	if (intPart === "0" && /^0+$/.test(fracPart)) {
		throw new MarketSeedInvalidError(
			`amount ${JSON.stringify(input)} must be greater than zero`,
		);
	}
	return `${intPart}.${fracPart}`;
}

function err(
	code: string,
	message: string,
): { ok: false; error: { code: string; message: string } } {
	return { ok: false, error: { code, message } };
}

/** The `admin_session_required` envelope (SA-I-1 gate reject). */
export function adminSessionRequired(): {
	ok: false;
	error: { code: string; message: string };
} {
	return err("admin_session_required", "Admin session required.");
}

/** Zod failure → `validation_error` + per-field messages (SA-L-1 ceilings). */
export function validationError(zodError: z.ZodError): {
	ok: false;
	error: {
		code: string;
		message: string;
		field_errors: Record<string, string[]>;
	};
} {
	const fieldErrors: Record<string, string[]> = {};
	for (const [key, messages] of Object.entries(
		zodError.flatten().fieldErrors,
	)) {
		if (messages && messages.length > 0) fieldErrors[key] = messages;
	}
	return {
		ok: false,
		error: {
			code: "validation_error",
			message: "One or more fields are invalid.",
			field_errors: fieldErrors,
		},
	};
}

/**
 * The §Wire-error map (R-15.5) — typed codes only, fixed display templates
 * (SA-L-3: never raw `.message`). Supplies the code for every class EXCEPT
 * `ResolutionSerializationExhaustedError`, whose `code` static it reads off the
 * class. `MarketLifecycleStateError` keys off the calling action's flow (the
 * error carries no observed field, B-7): seed → `market_not_draft`, close →
 * `market_not_open`. `AdminActorError` (a fired belt = wire bug) and any
 * unrecognized error are Sentry-captured.
 */
export function toActionError(
	error: unknown,
	flow: AdminFlow,
): { ok: false; error: { code: string; message: string } } {
	if (error instanceof MarketSlugInvalidError) {
		return err("slug_invalid", "Slug must be kebab-case, 3–80 characters.");
	}
	if (error instanceof MarketSlugTakenError) {
		return err("slug_taken", "That slug is already taken.");
	}
	if (error instanceof MarketContentRequiredError) {
		return err(
			"content_required",
			"Title and resolution criterion are required.",
		);
	}
	if (error instanceof MarketDeadlineInPastError) {
		return err(
			"deadline_in_past",
			"Resolution deadline must be in the future.",
		);
	}
	if (error instanceof MarketDeadlineCeilingError) {
		return err(
			"deadline_ceiling",
			"Resolution deadline cannot be after the conclusion freeze.",
		);
	}
	if (error instanceof MarketSeedInvalidError) {
		return err(
			"seed_invalid",
			"Seed amount must be a positive number with at most 18 decimal places.",
		);
	}
	if (error instanceof MarketDeadlineNotReachedError) {
		return err(
			"deadline_not_reached",
			"The market's resolution deadline has not been reached yet.",
		);
	}
	if (error instanceof MarketLifecycleStateError) {
		return flow === "F-ADMIN-2"
			? err("market_not_draft", "Market is not in the Draft state.")
			: err("market_not_open", "Market is not Open.");
	}
	if (error instanceof LifecycleSerializationExhaustedError) {
		return err(
			"lifecycle_serialization_exhausted",
			"The system is busy; please try again.",
		);
	}
	if (error instanceof ResolutionSerializationExhaustedError) {
		return err(
			ResolutionSerializationExhaustedError.code,
			"The system is busy; please try again.",
		);
	}
	if (error instanceof ResolutionStateError) {
		return err(
			"illegal_edge",
			"That action is not legal for the market's current state.",
		);
	}
	if (error instanceof CorrectionOutcomeError) {
		return err(
			"correction_same_outcome",
			"The correction must differ from the current resolved outcome.",
		);
	}
	if (error instanceof AdminActorError) {
		captureException(error, { tags: { kind: "admin_actor_belt_fired" } });
		return err("admin_actor", "Admin actor assertion failed.");
	}
	captureException(error, { tags: { kind: "admin_wire_internal" } });
	return err("error_internal", "An internal error occurred.");
}
