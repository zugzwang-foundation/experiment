import { afterAll, describe, expect, it } from "vitest";

import { testClient } from "./_fixtures/db";

// L-10 — migration `0030_liquidity_revoke_app_roles`.
//
// ⛔ THE FUNCTION THAT MUTATES POOL RESERVES MUST NOT BE CALLABLE BY A ROLE A
// BROWSER CAN HOLD. ADR-0019 rules RLS out of scope on the premise that no
// browser holds a database connection, and names a public Data API as its own
// tripwire. A Supabase project's Data API is on by default, which makes the
// premise a thing to check. Whether the HOSTED projects expose it is still NOT
// ESTABLISHED (`O-13`); what this file pins is that even if they do, the three
// functions LIQ-1 added are not reachable through `anon` or `authenticated`.
//
// ⚠ IT PINS THE FUNCTION ARM ONLY. `anon` still holds `arwdDxtm` on `pools`,
// `bets`, `events` and `dharma_ledger`, so `UPDATE pools` remains directly
// reachable without calling anything here. 0030 narrows the vector; it does not
// remove it, and `docs/parked.md` LIQ-1 L-10 stays OPEN on that table arm.
//
// ── WHY THIS FILE IS SHAPED THE WAY IT IS ──────────────────────────────────
//
// It runs on TWO substrates that disagree about which roles exist. Supabase
// ships `anon` / `authenticated`; CI's vanilla `postgres:17` does not. A test
// that simply skipped on the second would be green on CI for the whole life of
// the branch while asserting nothing — so the guarantee is carried by the
// PUBLIC and CATALOG blocks, which hold identically on both, and the
// role-scoped block is additive.
//
// Every block carries its own control, because each has a way of passing while
// measuring nothing. Four such surfaces are closed here and three of the four
// were found by review rather than by writing the test:
//
//   · the PUBLIC detector can read `proacl` as NULL and see an empty ACL —
//     which is exactly CI's shape, and exactly the case where PUBLIC DOES hold
//     the default EXECUTE grant. `coalesce(proacl, acldefault(...))` is the fix
//     and the probe function is the proof it works.
//   · a HARDCODED signature list cannot see the failure mode 0030's own header
//     calls most likely — the default privilege is untouched, so a NEW function
//     or an ADDED OVERLOAD takes fresh `anon` / `authenticated` grants and a
//     three-entry list keeps passing on the old rows. The catalog block matches
//     on `proname`, so an overload reddens it.
//   · `has_function_privilege` returning false proves nothing unless the same
//     probe is shown returning true AND then flipping. It is exercised against
//     a throwaway NON-SUPERUSER role, because `postgres` is a superuser on the
//     CI substrate and answers true there whatever the ACL says — a probe stuck
//     at true would sail through a control built on it.
//   · `postgres` being a superuser is the same reason the owner assertion reads
//     the ACL ENTRY rather than asking `has_function_privilege`.

const FUNCTION_NAMES = [
	"run_liquidity_injection",
	"check_liquidity_alarms",
	"zz_add_liquidity",
] as const;

const FUNCTIONS = [
	"run_liquidity_injection()",
	"check_liquidity_alarms()",
	"zz_add_liquidity(numeric,numeric,numeric)",
] as const;

/** The PostgREST-reachable roles. Present on Supabase, absent on CI. */
const APP_ROLES = ["anon", "authenticated"] as const;

/**
 * Two probe functions and a probe role.
 *
 * ⛔ EACH IS DROPPED BEFORE IT IS CREATED, AND THE REASON IS THIS FILE'S OWN
 * SUBJECT. `CREATE OR REPLACE FUNCTION` PRESERVES THE ACL — that is the
 * property `0030` relies on so a later replacement of the three real functions
 * inherits the revoked state. Here it works against us: the PUBLIC control ends
 * by revoking, so a run that dies before `afterAll` leaves a probe whose ACL
 * already has PUBLIC stripped, and the next run's `CREATE OR REPLACE` inherits
 * it and reds the control on a database where nothing is wrong. Worse, it reds
 * pointing at the detector, so the first hypothesis a reader forms is
 * "`acldefault` broke" rather than "the last run crashed". `DROP` then `CREATE`
 * is the only verb pair that guarantees the default ACL this control needs.
 */
const PROBE_PUBLIC = "zz_liquidity_grants_probe_public";
const PROBE_ROLES = "zz_liquidity_grants_probe_roles";
const PROBE_ROLE = "zz_liquidity_grants_probe_role";

/**
 * Grantees holding EXECUTE, read the way Postgres itself resolves them.
 *
 * ⚠ `coalesce(proacl, acldefault('f', proowner))` IS THE WHOLE POINT. A
 * function nobody has ever GRANTed or REVOKEd on carries `proacl = NULL`,
 * which means "the defaults apply" — and the default for a function INCLUDES
 * `EXECUTE TO PUBLIC`. Reading the raw column would explode NULL into zero
 * rows and report the most permissive state there is as the safest one.
 * `grantee = 0` is PUBLIC, which is why the join is a LEFT join.
 */
async function granteesOf(signature: string): Promise<string[]> {
	const rows = await testClient<{ who: string }[]>`
		SELECT coalesce(r.rolname, 'PUBLIC') AS who
		FROM pg_proc p
		CROSS JOIN aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
		LEFT JOIN pg_roles r ON r.oid = a.grantee
		WHERE p.oid = ${signature}::regprocedure
			AND a.privilege_type = 'EXECUTE'
		ORDER BY 1
	`;
	return rows.map((r) => r.who);
}

async function canExecute(role: string, signature: string): Promise<boolean> {
	const [row] = await testClient<{ can: boolean }[]>`
		SELECT has_function_privilege(${role}, ${signature}, 'EXECUTE') AS can
	`;
	// `?? true` and not `?? false`: an unanswered probe must fail the assertion,
	// never satisfy it.
	return row?.can ?? true;
}

async function rolesPresent(): Promise<string[]> {
	const rows = await testClient<{ rolname: string }[]>`
		SELECT rolname FROM pg_roles
		WHERE rolname = ANY(${[...APP_ROLES]})
		ORDER BY 1
	`;
	return rows.map((r) => r.rolname);
}

async function ownerOf(signature: string): Promise<string> {
	const [row] = await testClient<{ owner: string }[]>`
		SELECT pg_get_userbyid(proowner) AS owner
		FROM pg_proc WHERE oid = ${signature}::regprocedure
	`;
	if (!row?.owner) throw new Error(`no owner for ${signature}`);
	return row.owner;
}

/** DROP-then-CREATE, never CREATE OR REPLACE — see the PROBE_* docblock. */
async function mintProbe(name: string): Promise<void> {
	await testClient.unsafe(`DROP FUNCTION IF EXISTS ${name}()`);
	await testClient.unsafe(
		`CREATE FUNCTION ${name}() RETURNS int LANGUAGE sql AS 'SELECT 1'`,
	);
}

afterAll(async () => {
	await testClient.unsafe(`DROP FUNCTION IF EXISTS ${PROBE_PUBLIC}()`);
	await testClient.unsafe(`DROP FUNCTION IF EXISTS ${PROBE_ROLES}()`);
	await testClient.unsafe(`DROP ROLE IF EXISTS ${PROBE_ROLE}`);
});

describe("migration 0030 · the liquidity functions are not PUBLIC", () => {
	it("grants EXECUTE to no PUBLIC on any of the three", async () => {
		for (const fn of FUNCTIONS) {
			const grantees = await granteesOf(fn);
			// The grantee list travels with the assertion so a failure names WHO
			// holds it, not merely that someone does.
			expect({ fn, public: grantees.includes("PUBLIC"), grantees }).toEqual({
				fn,
				public: false,
				grantees,
			});
		}
	});

	it("CONTROL · the same detector sees PUBLIC on an un-revoked function", async () => {
		// Non-vacuity, aimed at the exact trap above: a freshly created function
		// is the NULL-`proacl` case on a vanilla substrate. If the detector could
		// not see PUBLIC through that, the assertion above would stay green on a
		// database where all three functions were wide open.
		await mintProbe(PROBE_PUBLIC);
		expect(await granteesOf(`${PROBE_PUBLIC}()`)).toContain("PUBLIC");

		// And it goes away when revoked — so the detector tracks the ACL rather
		// than reporting a constant.
		await testClient.unsafe(
			`REVOKE EXECUTE ON FUNCTION ${PROBE_PUBLIC}() FROM PUBLIC`,
		);
		expect(await granteesOf(`${PROBE_PUBLIC}()`)).not.toContain("PUBLIC");
	});

	it("keeps EXECUTE for the owner — the revoke did not over-reach", async () => {
		// Read as an ACL ENTRY, not through `has_function_privilege`: `postgres`
		// is a superuser on the CI substrate and would answer true there whatever
		// the grants said. An entry in `proacl` is a fact the bypass cannot fake.
		const owner = await ownerOf(FUNCTIONS[0]);
		for (const fn of FUNCTIONS) {
			const grantees = await granteesOf(fn);
			expect({ fn, ownerHasExecute: grantees.includes(owner) }).toEqual({
				fn,
				ownerHasExecute: true,
			});
		}
	});
});

describe("migration 0030 · no liquidity function is reachable, by NAME", () => {
	// ⛔ THIS IS THE BLOCK THAT SURVIVES THE NEXT MIGRATION. Everything above
	// interrogates three hardcoded signatures, which is precisely what cannot
	// see the failure `0030:38-40` names as most likely: the default privilege
	// is deliberately untouched, so a function created in `public` later — or an
	// OVERLOAD of one of these three, which is a new `pg_proc` row, not a
	// replacement — takes fresh `anon`/`authenticated` grants while the
	// signature list keeps passing on the old rows. Matching on `proname` is
	// what makes an overload red. It is the `EXPECTED_GUARD_CATALOG_ROWS`
	// pattern the repo already uses for triggers, applied to functions.
	it("finds no app-role or PUBLIC grant on ANY overload of the three names", async () => {
		const rows = await testClient<{ sig: string; who: string }[]>`
			SELECT p.oid::regprocedure::text AS sig,
			       coalesce(r.rolname, 'PUBLIC')  AS who
			FROM pg_proc p
			JOIN pg_namespace n ON n.oid = p.pronamespace
			CROSS JOIN aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
			LEFT JOIN pg_roles r ON r.oid = a.grantee
			WHERE n.nspname = 'public'
				AND p.proname = ANY(${[...FUNCTION_NAMES]})
				AND a.privilege_type = 'EXECUTE'
				AND (a.grantee = 0 OR r.rolname = ANY(${[...APP_ROLES]}))
			ORDER BY 1, 2
		`;
		expect(rows.map((r) => `${r.sig} → ${r.who}`)).toEqual([]);
	});

	it("CONTROL · the three names resolve to functions that actually exist", async () => {
		// Without this the block above is satisfied by a typo. A name that
		// matches nothing contributes no rows, and an empty result is what the
		// assertion is looking for.
		const [row] = await testClient<{ n: number }[]>`
			SELECT count(*)::int AS n
			FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
			WHERE n.nspname = 'public' AND p.proname = ANY(${[...FUNCTION_NAMES]})
		`;
		expect(row?.n).toBeGreaterThanOrEqual(FUNCTION_NAMES.length);
	});
});

describe("migration 0030 · anon and authenticated hold no EXECUTE", () => {
	it("answers false for every (app role, function) pair that exists", async () => {
		const present = await rolesPresent();

		// The substrate is RECORDED, never inferred. On CI this list is empty and
		// the loop below is a no-op — which is why the two blocks above, not this
		// one, are where the guarantee lives. Printing it lets a reader of a CI
		// log tell "skipped" from "passed".
		console.log(
			`[0030] app roles present on this substrate: ${
				present.length > 0 ? present.join(", ") : "(none — vanilla postgres)"
			}`,
		);

		// ⚠ THE SUBSTRATE HAS TWO LEGAL SHAPES AND NO THIRD, and asserting that
		// is what replaced a tautology. This line used to compare a loop counter
		// against `present.length * FUNCTIONS.length` — both driven by the same
		// two arrays, so it measured the loop and never the database. The case it
		// claimed to catch (a query silently returning nothing) was the one case
		// it certified, because `present = []` makes `0 === 0` true. A PARTIAL
		// answer from a Supabase substrate — one role visible, one not — is the
		// real shape of that failure, and it reds here.
		expect([[], [...APP_ROLES]]).toContainEqual(present);

		const holders: string[] = [];
		for (const role of present) {
			for (const fn of FUNCTIONS) {
				if (await canExecute(role, fn)) holders.push(`${role} → ${fn}`);
			}
		}
		expect(holders).toEqual([]);
	});

	it("CONTROL · the probe answers true on a grant, and FLIPS when it is revoked", async () => {
		// ⚠ A THROWAWAY NON-SUPERUSER ROLE, and the "non-superuser" is the whole
		// point. The earlier version of this control asked about `postgres` on
		// the CI substrate, where `postgres` is a superuser and
		// `has_function_privilege` answers true by bypass — so a probe that had
		// silently stuck at true would have passed the control written to catch
		// exactly that. This role holds nothing but what PUBLIC gives it, so the
		// flip below is a real measurement on either substrate.
		await mintProbe(PROBE_ROLES);
		await testClient.unsafe(`DROP ROLE IF EXISTS ${PROBE_ROLE}`);
		await testClient.unsafe(`CREATE ROLE ${PROBE_ROLE} NOLOGIN`);

		expect(await canExecute(PROBE_ROLE, `${PROBE_ROLES}()`)).toBe(true);
		await testClient.unsafe(
			`REVOKE EXECUTE ON FUNCTION ${PROBE_ROLES}() FROM PUBLIC, ${PROBE_ROLE}`,
		);
		expect(await canExecute(PROBE_ROLE, `${PROBE_ROLES}()`)).toBe(false);

		// And the real functions answer false to the same probe in the same run,
		// which is the comparison the whole file exists to make.
		for (const fn of FUNCTIONS) {
			expect({ fn, reachable: await canExecute(PROBE_ROLE, fn) }).toEqual({
				fn,
				reachable: false,
			});
		}

		await testClient.unsafe(`DROP ROLE IF EXISTS ${PROBE_ROLE}`);
	});
});
