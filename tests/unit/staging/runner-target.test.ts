import { describe, expect, it } from "vitest";
import { PRODUCTION_PROJECT_REF } from "../../staging/_lib/guards";
import {
	GENERATE_INTENT_ENV,
	GENERATE_INTENT_VALUE,
	resolveRunnerTarget,
	TARGET_MODE_ENV,
} from "../../staging/_lib/target";

// STAGING-PARITY Slice B — the generator/gates target predicate, exhaustively.
//
// The sibling of `reset-guard.test.ts`. `resolveRunnerTarget` admits TWO
// targets where `resolveStagingTarget` admits one, so it carries a strictly
// larger refusal surface and every refusal gets a case. The wrong-target case
// deserves the same weight as the guard-list constant (Ratification Record
// §5 W-B) — a unit-tested predicate, not one row in a failure table.

const STAGING_REF = "abcdefghijklmnopqrst"; // 20 lowercase, a real ref's shape
const STAGING_URL = `postgresql://postgres.${STAGING_REF}:pw@aws-1-ap-south-1.pooler.supabase.com:5432/postgres`;
const LOCAL_URL = "postgresql://postgres:postgres@localhost:54322/postgres";

const WRITE_OK = { requireWriteIntent: true } as const;
const READ_OK = { requireWriteIntent: false } as const;

function stagingEnv(over: Record<string, string | undefined> = {}) {
	return {
		[TARGET_MODE_ENV]: "staging",
		DATABASE_URL_STAGING: STAGING_URL,
		STAGING_PROJECT_REF_FRAGMENT: STAGING_REF,
		ZUGZWANG_ENV: "staging",
		[GENERATE_INTENT_ENV]: GENERATE_INTENT_VALUE,
		...over,
	};
}

function localEnv(over: Record<string, string | undefined> = {}) {
	return {
		[TARGET_MODE_ENV]: "local",
		DATABASE_URL: LOCAL_URL,
		[GENERATE_INTENT_ENV]: GENERATE_INTENT_VALUE,
		...over,
	};
}

/** Every refusal reason must name the problem. A bare `ok:false` is useless
 *  at 2am, and the ADR-0035 driver-4 argument applies here identically. */
function expectRefusal(
	result: ReturnType<typeof resolveRunnerTarget>,
	match: RegExp,
): void {
	expect(result.ok).toBe(false);
	expect(result.ok === false ? result.reason : "").toMatch(match);
}

describe("mode selection", () => {
	it("accepts local", () => {
		const r = resolveRunnerTarget(localEnv(), WRITE_OK);
		expect(r).toEqual({ ok: true, mode: "local", url: LOCAL_URL });
	});

	it("accepts staging", () => {
		const r = resolveRunnerTarget(stagingEnv(), WRITE_OK);
		expect(r).toEqual({ ok: true, mode: "staging", url: STAGING_URL });
	});

	it("refuses an unset mode — there is deliberately no default", () => {
		expectRefusal(
			resolveRunnerTarget(localEnv({ [TARGET_MODE_ENV]: undefined }), WRITE_OK),
			/must be "local" or "staging"[\s\S]*unset/,
		);
	});

	it("refuses an unknown mode", () => {
		expectRefusal(
			resolveRunnerTarget(localEnv({ [TARGET_MODE_ENV]: "prod" }), WRITE_OK),
			/must be "local" or "staging"/,
		);
	});

	it("refuses a mode that differs only by case", () => {
		expectRefusal(
			resolveRunnerTarget(localEnv({ [TARGET_MODE_ENV]: "Local" }), WRITE_OK),
			/must be "local" or "staging"/,
		);
	});
});

describe("write intent", () => {
	it("refuses a write run without the acknowledgement token", () => {
		expectRefusal(
			resolveRunnerTarget(
				localEnv({ [GENERATE_INTENT_ENV]: undefined }),
				WRITE_OK,
			),
			/not set to the acknowledgement value/,
		);
	});

	it("refuses a wrong acknowledgement value", () => {
		expectRefusal(
			resolveRunnerTarget(localEnv({ [GENERATE_INTENT_ENV]: "yes" }), WRITE_OK),
			/not set to the acknowledgement value/,
		);
	});

	it("does NOT require the token for a read-only run", () => {
		// A read-only gates run that demanded a destructive-intent token would
		// train the operator to export it into their shell — the exact decay
		// ADR-0035 Addendum A.1 describes. Gates read; they do not write.
		const r = resolveRunnerTarget(
			stagingEnv({ [GENERATE_INTENT_ENV]: undefined }),
			READ_OK,
		);
		expect(r.ok).toBe(true);
	});
});

describe("local mode", () => {
	it("refuses an unset DATABASE_URL", () => {
		expectRefusal(
			resolveRunnerTarget(localEnv({ DATABASE_URL: undefined }), WRITE_OK),
			/DATABASE_URL is not set/,
		);
	});

	it("accepts 127.0.0.1", () => {
		const url = "postgresql://postgres:pw@127.0.0.1:54322/postgres";
		expect(
			resolveRunnerTarget(localEnv({ DATABASE_URL: url }), WRITE_OK),
		).toEqual({ ok: true, mode: "local", url });
	});

	it("refuses a remote host", () => {
		expectRefusal(
			resolveRunnerTarget(
				localEnv({ DATABASE_URL: "postgresql://u:p@db.example.com:5432/x" }),
				WRITE_OK,
			),
			/requires a loopback DATABASE_URL/,
		);
	});

	it("refuses a Supabase host even if it somehow resolved as local", () => {
		expectRefusal(
			resolveRunnerTarget(
				localEnv({
					DATABASE_URL: `postgresql://u:p@aws-1-ap-south-1.pooler.supabase.com:5432/postgres`,
				}),
				WRITE_OK,
			),
			/loopback|Supabase host/,
		);
	});

	it("refuses the PRODUCTION ref, and says which case it is", () => {
		// Checked FIRST and unconditionally: a prod URL also fails the loopback
		// test, so a later position would report "not loopback" — a true refusal
		// with a misleading reason, on the single input that matters most.
		expectRefusal(
			resolveRunnerTarget(
				localEnv({
					DATABASE_URL: `postgresql://postgres.${PRODUCTION_PROJECT_REF}:pw@localhost:54322/postgres`,
				}),
				WRITE_OK,
			),
			/PRODUCTION project ref[\s\S]*wrong-target/,
		);
	});

	it("refuses an unparseable URL", () => {
		expectRefusal(
			resolveRunnerTarget(localEnv({ DATABASE_URL: "not a url" }), WRITE_OK),
			/not a parseable URL/,
		);
	});

	it("never falls back to DATABASE_URL_STAGING", () => {
		expectRefusal(
			resolveRunnerTarget(
				localEnv({
					DATABASE_URL: undefined,
					DATABASE_URL_STAGING: STAGING_URL,
				}),
				WRITE_OK,
			),
			/DATABASE_URL is not set/,
		);
	});
});

describe("staging mode", () => {
	it("refuses an unset DATABASE_URL_STAGING", () => {
		expectRefusal(
			resolveRunnerTarget(
				stagingEnv({ DATABASE_URL_STAGING: undefined }),
				WRITE_OK,
			),
			/DATABASE_URL_STAGING is not set/,
		);
	});

	it("NEVER falls back to DATABASE_URL", () => {
		// The reset's W-B rule, inherited: the runner must not be able to
		// inherit a connection string from ambient environment, and
		// DATABASE_URL is the variable every other tool in the repo reads.
		expectRefusal(
			resolveRunnerTarget(
				stagingEnv({
					DATABASE_URL_STAGING: undefined,
					DATABASE_URL: LOCAL_URL,
				}),
				WRITE_OK,
			),
			/DATABASE_URL_STAGING is not set/,
		);
	});

	it("refuses the PRODUCTION ref ahead of every lesser check", () => {
		const prodUrl = `postgresql://postgres.${PRODUCTION_PROJECT_REF}:pw@aws-1-ap-south-1.pooler.supabase.com:5432/postgres`;
		expectRefusal(
			resolveRunnerTarget(
				// Also breaks the fragment match and the env match — so if the prod
				// check were not first, the reason would name the wrong problem.
				stagingEnv({
					DATABASE_URL_STAGING: prodUrl,
					ZUGZWANG_ENV: "prod",
					STAGING_PROJECT_REF_FRAGMENT: undefined,
				}),
				WRITE_OK,
			),
			/PRODUCTION project ref/,
		);
	});

	it("refuses an unset fragment", () => {
		expectRefusal(
			resolveRunnerTarget(
				stagingEnv({ STAGING_PROJECT_REF_FRAGMENT: undefined }),
				WRITE_OK,
			),
			/FRAGMENT is not set/,
		);
	});

	it("refuses a short fragment", () => {
		// A fragment of `postgres` makes the URL match vacuously true for every
		// Postgres DSN in existence — the scheme itself contains it.
		expectRefusal(
			resolveRunnerTarget(
				stagingEnv({ STAGING_PROJECT_REF_FRAGMENT: "postgres" }),
				WRITE_OK,
			),
			/at least 16 lowercase alphanumeric/,
		);
	});

	it("refuses a non-alphanumeric fragment", () => {
		expectRefusal(
			resolveRunnerTarget(
				stagingEnv({ STAGING_PROJECT_REF_FRAGMENT: "abcdefghij-klmnopqrst" }),
				WRITE_OK,
			),
			/at least 16 lowercase alphanumeric/,
		);
	});

	it("refuses a fragment absent from the URL", () => {
		expectRefusal(
			resolveRunnerTarget(
				stagingEnv({ STAGING_PROJECT_REF_FRAGMENT: "zzzzzzzzzzzzzzzzzzzz" }),
				WRITE_OK,
			),
			/does not contain STAGING_PROJECT_REF_FRAGMENT/,
		);
	});

	it("refuses unless ZUGZWANG_ENV EQUALS staging — a positive match", () => {
		for (const value of [undefined, "prod", "preview", "unknown", "Staging"]) {
			expectRefusal(
				resolveRunnerTarget(stagingEnv({ ZUGZWANG_ENV: value }), WRITE_OK),
				/ZUGZWANG_ENV must equal "staging"/,
			);
		}
	});
});

describe("the production deny list is real", () => {
	it("is a non-empty Supabase-shaped ref", () => {
		// A blanked constant makes `url.includes(ref)` vacuously TRUE for every
		// URL. The shape assertion catches blanking, truncation and placeholder
		// text; it does NOT catch ROTATION, which is a process control (the
		// runbook docket row) — stated rather than papered over.
		expect(PRODUCTION_PROJECT_REF).toMatch(/^[a-z0-9]{16,}$/);
	});
});
