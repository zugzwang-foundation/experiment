// STAGING-PARITY Slice B — the operator's real Google identities, captured
// BEFORE the first reset. NEVER import this from src/**, and NEVER commit the
// file it reads.
//
// ═══════════════════════════════════════════════════════════════════════════
// THE HAZARD THIS CLOSES (plan Q2, manifest §2.2 P-owner)
//
// The reset truncates `users` and `accounts`. If the generator then seeds
// P-owner with a FABRICATED Google `sub`, the operator's next real staging
// sign-in finds no matching `accounts` row, Better Auth tries to create a new
// user, and the INSERT collides on the `users_email_idx` UNIQUE. That is a hard
// sign-in failure with no recovery short of a manual DB edit — on the one
// environment POLISH runs against, for the eight weeks it runs.
//
// So the real `email` + `accountId` (the Google `sub`) are read from a
// machine-local capture and fed to the generator verbatim. Slice A's STEP 0
// captured THREE Google-linked accounts, not one: all three carry the same
// hazard, so all three are seeded.
//
// WHY NOT DOPPLER. Q2 says "held in the Doppler `stg` config". A local JSON file
// is used instead for one reason: the LOCAL proving run (STEPs 2/3/5) must
// exercise the same code path, and it runs OUTSIDE the `doppler run --config
// stg` wrapper. Reading the same file in both modes keeps one path rather than
// a staging path and a local lookalike — manifest §5's first discipline.
//
// NEVER LOGGED. These are real personal email addresses. The loader returns
// them; nothing in this repo prints them.

import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { z } from "zod";

/** Override for the capture location. Default is the machine-local path. */
export const CAPTURE_PATH_ENV = "ZUGZWANG_CAPTURED_IDENTITIES_PATH";

const DEFAULT_CAPTURE_PATH = join(
	homedir(),
	".claude",
	"zz-p-owner-identity.json",
);

/** The three fields that carry the collision hazard. Nothing else is used. */
const identitySchema = z.object({
	email: z.string().min(3).includes("@"),
	providerId: z.string().min(1),
	accountId: z.string().min(1),
});

const captureSchema = identitySchema.extend({
	otherGoogleAccounts: z.array(identitySchema).default([]),
});

export interface CapturedIdentity {
	readonly email: string;
	readonly providerId: string;
	readonly accountId: string;
}

export function capturePath(
	env: Readonly<Record<string, string | undefined>> = process.env,
): string {
	return env[CAPTURE_PATH_ENV] ?? DEFAULT_CAPTURE_PATH;
}

/**
 * Every captured Google-linked identity, primary first.
 *
 * THROWS if the file is missing, unparseable, or any field is empty. Fails
 * closed deliberately: generating without these values is the case that breaks
 * the operator's sign-in, and it breaks it silently — the run would look
 * perfectly green and the damage would surface days later at a sign-in prompt.
 */
export function loadCapturedIdentities(
	env: Readonly<Record<string, string | undefined>> = process.env,
): readonly CapturedIdentity[] {
	const path = capturePath(env);
	let raw: string;
	try {
		raw = readFileSync(path, "utf8");
	} catch (err) {
		throw new Error(
			`REFUSED — the captured-identity file is unreadable at ${path}. ` +
				"Generating without it seeds P-owner with a fabricated Google sub, and the operator's " +
				"next staging sign-in then fails on a users_email_idx collision, unrecoverably. " +
				`(${String(err)})`,
		);
	}
	let parsedJson: unknown;
	try {
		parsedJson = JSON.parse(raw);
	} catch (err) {
		throw new Error(
			`REFUSED — the captured-identity file at ${path} is not valid JSON (${String(err)})`,
		);
	}
	const result = captureSchema.safeParse(parsedJson);
	if (!result.success) {
		// The issue paths name FIELDS, never values — no email reaches a log.
		throw new Error(
			`REFUSED — the captured-identity file at ${path} is missing or empty fields: ${result.error.issues
				.map((i) => i.path.join("."))
				.join(", ")}`,
		);
	}
	const { otherGoogleAccounts, ...primary } = result.data;
	return [
		{
			email: primary.email,
			providerId: primary.providerId,
			accountId: primary.accountId,
		},
		...otherGoogleAccounts.map((a) => ({
			email: a.email,
			providerId: a.providerId,
			accountId: a.accountId,
		})),
	];
}
