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
// ── WHY THIS FILE IS SHAPED THE WAY IT IS ──────────────────────────────────
//
// It runs on TWO substrates that disagree about which roles exist. Supabase
// ships `anon` / `authenticated`; CI's vanilla `postgres:17` does not. A test
// that simply skipped on the second would be green on CI for the whole life of
// the branch while asserting nothing — so the guarantee is carried by the
// PUBLIC block, which holds identically on both, and the role-scoped block is
// additive.
//
// Every block carries its own control, because each has a way of passing while
// measuring nothing:
//
//   · the PUBLIC detector can read `proacl` as NULL and see an empty ACL —
//     which is exactly CI's shape, and exactly the case where PUBLIC DOES hold
//     the default EXECUTE grant. `coalesce(proacl, acldefault(...))` is the fix
//     and the probe function is the proof it works.
//   · `has_function_privilege` returning false proves nothing unless the same
//     probe can be shown returning true.
//   · `postgres` is a superuser on the CI substrate, so `has_function_privilege`
//     answers true for it there whatever the ACL says. The owner assertion
//     therefore reads the ACL ENTRY, which no superuser bypass can manufacture.

const FUNCTIONS = [
	"run_liquidity_injection()",
	"check_liquidity_alarms()",
	"zz_add_liquidity(numeric,numeric,numeric)",
] as const;

/** The PostgREST-reachable roles. Present on Supabase, absent on CI. */
const APP_ROLES = ["anon", "authenticated"] as const;

/**
 * Two probes, never one. Each control needs a function in a KNOWN grant state,
 * and the PUBLIC control ends by revoking — so sharing a name would make the
 * second control depend on the first one's execution order.
 */
const PROBE_PUBLIC = "zz_liquidity_grants_probe_public";
const PROBE_ROLES = "zz_liquidity_grants_probe_roles";

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

afterAll(async () => {
	await testClient.unsafe(`DROP FUNCTION IF EXISTS ${PROBE_PUBLIC}()`);
	await testClient.unsafe(`DROP FUNCTION IF EXISTS ${PROBE_ROLES}()`);
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
		await testClient.unsafe(
			`CREATE OR REPLACE FUNCTION ${PROBE_PUBLIC}() RETURNS int LANGUAGE sql AS 'SELECT 1'`,
		);
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

describe("migration 0030 · anon and authenticated hold no EXECUTE", () => {
	it("answers false for every (app role, function) pair that exists", async () => {
		const present = await rolesPresent();

		// The substrate is RECORDED, never inferred. On CI this list is empty and
		// the loop below is a no-op — which is why the PUBLIC block above, not
		// this one, is where the guarantee lives. Printing it lets a reader of a
		// CI log tell "skipped" from "passed".
		console.log(
			`[0030] app roles present on this substrate: ${
				present.length > 0 ? present.join(", ") : "(none — vanilla postgres)"
			}`,
		);

		const holders: string[] = [];
		let checked = 0;
		for (const role of present) {
			for (const fn of FUNCTIONS) {
				checked += 1;
				if (await canExecute(role, fn)) holders.push(`${role} → ${fn}`);
			}
		}

		expect(holders).toEqual([]);
		// The pair count is asserted so a query that silently returned nothing
		// cannot masquerade as a clean sweep.
		expect(checked).toBe(present.length * FUNCTIONS.length);
	});

	it("CONTROL · the same probe answers true where a grant exists", async () => {
		const present = await rolesPresent();

		// A function nobody revoked. On Supabase it carries the explicit
		// anon/authenticated grants that `ALTER DEFAULT PRIVILEGES` installs; on
		// any substrate it carries PUBLIC's. Either way it is the state the three
		// liquidity functions were in before 0030 — measured then as
		// `{=X/postgres,…,anon=X/postgres,authenticated=X/postgres,…}` — so the
		// falses above are a difference this migration made, not a property of
		// the roles.
		await testClient.unsafe(
			`CREATE OR REPLACE FUNCTION ${PROBE_ROLES}() RETURNS int LANGUAGE sql AS 'SELECT 1'`,
		);

		if (present.length === 0) {
			// Vanilla substrate: no app role exists to interrogate, so the probe is
			// exercised against the owner. It still proves the call can return
			// true, which is all this control is for.
			expect(
				await canExecute(await ownerOf(`${PROBE_ROLES}()`), `${PROBE_ROLES}()`),
			).toBe(true);
			return;
		}

		for (const role of present) {
			expect({
				role,
				canCallUnrevoked: await canExecute(role, `${PROBE_ROLES}()`),
			}).toEqual({ role, canCallUnrevoked: true });
		}
	});
});
