import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// S-1 · Q1 — the four rows of the `DB_POOLER_MODE` table in `src/db/index.ts`.
//
// The flip to the `:6543` transaction pooler is a one-property change, and the
// property is which SECRET the runtime reads. Two shapes were rejected on the
// way here and this suite exists to keep them rejected:
//
//   `DATABASE_URL_TXN ?? DATABASE_URL` — makes a MISSING secret
//   indistinguishable from deliberate session-mode config. Staging would run
//   session mode silently while every observation taken against it claimed
//   otherwise, with `/api/health` reporting `db: "ok"` throughout.
//
//   An unconditional rename — fails the production BUILD, because this module
//   is imported by effectively every server surface, `next build` collects page
//   data by importing them, and the read is at module scope. `prd` has no
//   `DATABASE_URL_TXN`.
//
// ⚠ The prod-refusal row is the reason this file is not optional. It is a guard
// that never fires in practice, which is exactly the guard nobody notices when
// it regresses — the only thing standing between a config mistake and prod
// connecting through a pooler no record authorises (ADR-0024 P3 #8).
//
// ⛔ BUT BE PRECISE ABOUT WHAT THESE ROWS ESTABLISH, because the obvious reading
// claims more. `ZUGZWANG_ENV` is INLINED AT BUILD TIME by `next.config.ts`'s
// `env` block, so in the deployed artifact the prod half of the guard is a
// constant — it compiles to `"prod" === "prod"` for a production build, and to
// DEAD CODE for any other. Under Vitest no inlining happens and these cases
// mutate `process.env` at runtime. ⇒ they pin the SOURCE rule, NOT the shipped
// artifact.
//
// That is sound today, for a reason recorded outside this file: the promoted
// artifact is a production build (docs/runbooks/deploy-pipeline.md), and
// `vercel promote` swaps an alias over a build that already carried
// ZUGZWANG_ENV=prod — so the guard is live on every artifact that can serve the
// production domain. The residual is forward-looking: if the promote path ever
// promoted a staging- or preview-built artifact, the guard would vanish via
// dead-code elimination and NOTHING HERE WOULD GO RED. A guard whose protection
// rests on a deploy-pipeline property that no test observes is worth knowing the
// shape of, even while the property holds.
//
// Approach: mock `postgres` so the module-load construction is captured rather
// than performed (postgres.js is lazy, but a test must not depend on that), and
// mock the drizzle wrapper so nothing touches a schema. `vi.resetModules()` +
// a dynamic import makes each case a fresh module load, which is the only way
// to observe module-scope behaviour.

const { postgresSpy } = vi.hoisted(() => ({
	postgresSpy: vi.fn((_url: string, _opts?: unknown): unknown => ({})),
}));

vi.mock("postgres", () => ({ default: postgresSpy }));
vi.mock("drizzle-orm/postgres-js", () => ({
	drizzle: vi.fn(() => ({})),
}));

const SESSION_URL =
	"postgresql://u:p@aws-0-ap-south-1.pooler.supabase.com:5432/postgres";
const TXN_URL =
	"postgresql://u:p@aws-0-ap-south-1.pooler.supabase.com:6543/postgres";

// Snapshot only the three keys these cases move, so the suite-wide defaults in
// tests/_setup/env.ts survive intact.
const KEYS = [
	"DB_POOLER_MODE",
	"DATABASE_URL",
	"DATABASE_URL_TXN",
	"ZUGZWANG_ENV",
] as const;
let saved: Partial<Record<(typeof KEYS)[number], string | undefined>> = {};

beforeEach(() => {
	saved = {};
	for (const k of KEYS) {
		saved[k] = process.env[k];
	}
	postgresSpy.mockClear();
	vi.resetModules();
});

afterEach(() => {
	for (const k of KEYS) {
		if (saved[k] === undefined) {
			delete process.env[k];
		} else {
			process.env[k] = saved[k];
		}
	}
});

/** The connection string the shipped client was actually constructed with. */
function connectedWith(): string {
	expect(postgresSpy).toHaveBeenCalledTimes(1);
	return postgresSpy.mock.calls[0]?.[0] as string;
}

describe("DB_POOLER_MODE — the four rows", () => {
	// ROW 1 — `prd`, no flag. The row that must stay byte-identical to what the
	// module did before S-1 touched it: nothing to mint in Doppler `prd`, no
	// build break, no deploy block.
	it("row 1 · prod with no flag reads DATABASE_URL", async () => {
		delete process.env.DB_POOLER_MODE;
		process.env.ZUGZWANG_ENV = "prod";
		process.env.DATABASE_URL = SESSION_URL;
		delete process.env.DATABASE_URL_TXN;

		await import("@/db");

		expect(connectedWith()).toBe(SESSION_URL);
	});

	// ROW 1, the part that makes it load-bearing: prod must not merely PREFER
	// the session URL, it must not REQUIRE the transaction one. An absent
	// DATABASE_URL_TXN in prod is the correct steady state, not a failure.
	it("row 1 · prod does not require DATABASE_URL_TXN to exist", async () => {
		delete process.env.DB_POOLER_MODE;
		process.env.ZUGZWANG_ENV = "prod";
		process.env.DATABASE_URL = SESSION_URL;
		delete process.env.DATABASE_URL_TXN;

		await expect(import("@/db")).resolves.toBeDefined();
	});

	// ROW 2 — staging with the flag set and the secret present: the flip itself.
	it("row 2 · transaction mode on staging reads DATABASE_URL_TXN", async () => {
		process.env.DB_POOLER_MODE = "transaction";
		process.env.ZUGZWANG_ENV = "staging";
		process.env.DATABASE_URL = SESSION_URL;
		process.env.DATABASE_URL_TXN = TXN_URL;

		await import("@/db");

		expect(connectedWith()).toBe(TXN_URL);
		// ⚠ No port assertion here, deliberately. `TXN_URL` is this file's own
		// constant, so asserting it contains ":6543" could only fail if the line
		// above already had — a tautology that reads like a claim about the
		// module. `src/db/index.ts` knows nothing about ports: it picks a
		// VARIABLE, and which port that variable's value names is a property of
		// the secret, set in Doppler. That is exactly why criterion 1 has to be
		// observed against a deployment and cannot be discharged by a unit test.
	});

	// ROW 2 also covers previews — Stage 3's criterion 1 is observed on a
	// PREVIEW of this branch, where ZUGZWANG_ENV is "preview", not "staging".
	// A guard keyed to "staging" alone would have made criterion 1 unreachable.
	//
	// (It formerly read "branch-scoped preview", from the ruling that scoped the
	// flag to one Vercel branch. That was reversed — the flag lives in Doppler
	// stg unscoped, because it is inert on any deployment whose code cannot read
	// it. The preview is still where criterion 1 happens; only the flag's home
	// changed. See docs/plans/S-1.md §2.1.)
	it("row 2 · transaction mode works on a preview, not only staging", async () => {
		process.env.DB_POOLER_MODE = "transaction";
		process.env.ZUGZWANG_ENV = "preview";
		process.env.DATABASE_URL = SESSION_URL;
		process.env.DATABASE_URL_TXN = TXN_URL;

		await import("@/db");

		expect(connectedWith()).toBe(TXN_URL);
	});

	// ROW 3 — the missing secret is LOUD and NAMES ITSELF. This is the assertion
	// that forecloses the `??` fallback: the failure must be impossible to read
	// as "session mode was intended here".
	it("row 3 · transaction mode with no DATABASE_URL_TXN throws, naming the variable", async () => {
		process.env.DB_POOLER_MODE = "transaction";
		process.env.ZUGZWANG_ENV = "staging";
		process.env.DATABASE_URL = SESSION_URL;
		delete process.env.DATABASE_URL_TXN;

		await expect(import("@/db")).rejects.toThrow(/DATABASE_URL_TXN is not set/);
	});

	it("row 3 · does NOT silently fall back to the session URL", async () => {
		process.env.DB_POOLER_MODE = "transaction";
		process.env.ZUGZWANG_ENV = "staging";
		process.env.DATABASE_URL = SESSION_URL;
		delete process.env.DATABASE_URL_TXN;

		await expect(import("@/db")).rejects.toThrow();
		// The real assertion: no client was constructed at all. A fallback would
		// have built one against SESSION_URL and passed a throw-only test.
		expect(postgresSpy).not.toHaveBeenCalled();
	});

	// ROW 4 — the guard that never fires. ADR-0024 P3 decision outcome #8:
	// every environment stays on :5432 except staging.
	it("row 4 · transaction mode in prod is refused at boot, citing the ADR", async () => {
		process.env.DB_POOLER_MODE = "transaction";
		process.env.ZUGZWANG_ENV = "prod";
		process.env.DATABASE_URL = SESSION_URL;
		process.env.DATABASE_URL_TXN = TXN_URL;

		// BOTH halves are asserted, because the title promises both. The citation
		// is not decoration: this guard refuses an entire production deploy at
		// module scope, and the operator who hits it needs the record naming the
		// decision — otherwise the fastest-looking fix is to delete the guard.
		// Asserting only the prose would let the citation be dropped while this
		// test stayed green under a name that had become false.
		await expect(import("@/db")).rejects.toThrow(/not authorised in prod/);
		await expect(import("@/db")).rejects.toThrow(/ADR-0024 P3 #8/);
	});

	it("row 4 · refuses even when the transaction secret IS present", async () => {
		process.env.DB_POOLER_MODE = "transaction";
		process.env.ZUGZWANG_ENV = "prod";
		process.env.DATABASE_URL = SESSION_URL;
		process.env.DATABASE_URL_TXN = TXN_URL;

		await expect(import("@/db")).rejects.toThrow();
		// Refusal means REFUSAL — prod must not connect through :6543 by any
		// path, including the one where someone helpfully minted the secret.
		expect(postgresSpy).not.toHaveBeenCalled();
	});
});

describe("DB_POOLER_MODE — the default", () => {
	// The default is what carries `prd` and every unconfigured environment. An
	// unset flag must mean session mode, never "infer from what exists".
	it("an unset flag means session mode, even where the txn secret exists", async () => {
		delete process.env.DB_POOLER_MODE;
		process.env.ZUGZWANG_ENV = "staging";
		process.env.DATABASE_URL = SESSION_URL;
		process.env.DATABASE_URL_TXN = TXN_URL;

		await import("@/db");

		// Presence of DATABASE_URL_TXN must NOT flip the mode. This is the
		// inverse of the rejected `??` shape and the reason the mode is declared.
		expect(connectedWith()).toBe(SESSION_URL);
	});

	it("an unrecognised flag value falls to session mode rather than guessing", async () => {
		process.env.DB_POOLER_MODE = "Transaction"; // wrong case, deliberately
		process.env.ZUGZWANG_ENV = "staging";
		process.env.DATABASE_URL = SESSION_URL;
		process.env.DATABASE_URL_TXN = TXN_URL;

		await import("@/db");

		expect(connectedWith()).toBe(SESSION_URL);
	});
});
