import { describe, expect, it } from "vitest";

import {
	buildPseudonymMap,
	pseudonymColumnName,
	pseudonymizeAggregateId,
	pseudonymizeMetadata,
	pseudonymizeRow,
	pseudonymizeTable,
	REDACTED_ADMIN_SESSION,
} from "@/server/export/dataset/pseudonymize";
import {
	stripMetadata,
	stripPayload,
	stripRow,
	stripTable,
} from "@/server/export/dataset/strip";
import { assertTableClean, type EgressSecrets } from "@/server/export/egress";
import { EgressContractGapError } from "@/server/export/egress/errors";

import {
	ADMIN_SENTINEL,
	DIRTY_EVENT_ROWS,
	DIRTY_TABLE_ROWS,
	FIXTURE_SECRET_VALUES,
	FIXTURE_USER_IDS,
	SYSTEM_SENTINEL,
} from "../../../_fixtures/dataset/dirty-source";

/**
 * DATASET.1 Slices 4 + 5 — the STRIP pipeline and export-time JOIN
 * pseudonymization, verified against the deliberately dirty fixture.
 *
 * ⚠ **Every assertion of absence here runs over rows that provably carried the
 * thing.** That is brief §3's whole argument, and it is why the fixture exists:
 * over real data you cannot know the forbidden key was present pre-strip, so
 * "it is gone" and "it was never there" are indistinguishable.
 */

const secrets: EgressSecrets = {
	userIds: new Set(Object.values(FIXTURE_USER_IDS)),
	ips: new Set(FIXTURE_SECRET_VALUES.ips),
	userAgents: new Set(FIXTURE_SECRET_VALUES.userAgents),
	googleIds: new Set(FIXTURE_SECRET_VALUES.googleIds),
	// ⚠ market_media's key SHIPS (B.16), so it is deliberately NOT a secret.
	// Only the two `u/<userId>/…` keys are.
	r2ObjectKeys: new Set(FIXTURE_SECRET_VALUES.r2ObjectKeys.slice(0, 2)),
	adminSessionIds: new Set(FIXTURE_SECRET_VALUES.adminSessionIds),
	emails: new Set(FIXTURE_SECRET_VALUES.emails),
};

const map = buildPseudonymMap(DIRTY_TABLE_ROWS.users);

/** The full transform, in pipeline order: strip, then pseudonymize. */
function transform(table: string, rows: readonly Record<string, unknown>[]) {
	return pseudonymizeTable(table, stripTable(table, rows), map);
}

// ── Slice 4 · the five named strip guards ─────────────────────────────

describe("Slice 4 · STRIP over events.payload — the five named guards", () => {
	const stripped = stripTable("events", DIRTY_EVENT_ROWS);
	const json = JSON.stringify(stripped);

	const rowFor = (t: string) =>
		stripped.find((r) => r.event_type === t) as Record<string, unknown>;

	it("guard 1 · user.tos_accepted — no ip, no user_agent survives", () => {
		const payload = rowFor("user.tos_accepted").payload as Record<
			string,
			unknown
		>;

		// POSITIVE CONTROL: the SOURCE row carried both.
		const source = DIRTY_EVENT_ROWS.find(
			(r) => r.event_type === "user.tos_accepted",
		);
		expect(source?.payload).toHaveProperty("ip");
		expect(source?.payload).toHaveProperty("user_agent");

		expect(payload).not.toHaveProperty("ip");
		expect(payload).not.toHaveProperty("user_agent");
		// The research keys must SURVIVE — a strip that removed these would
		// pass an absence test while destroying the row's whole value.
		expect(payload).toHaveProperty("tosVersionHash");
	});

	it("guard 2 · user.oauth_signed_in — no googleId survives", () => {
		const source = DIRTY_EVENT_ROWS.find(
			(r) => r.event_type === "user.oauth_signed_in",
		);
		expect(source?.payload).toHaveProperty("googleId"); // control

		expect(rowFor("user.oauth_signed_in").payload).not.toHaveProperty(
			"googleId",
		);
		expect(json).not.toContain(FIXTURE_SECRET_VALUES.googleIds[0]);
	});

	it("guard 3 · image_upload.* — no R2 object key survives", () => {
		for (const t of [
			"image_upload.sign_requested",
			"image_upload.committed",
			"image_upload.blocked",
			"image_upload.orphaned",
		]) {
			const source = DIRTY_EVENT_ROWS.find((r) => r.event_type === t);
			expect(source?.payload, `${t} source must carry key`).toHaveProperty(
				"key",
			);

			expect(rowFor(t).payload, `${t} stripped`).not.toHaveProperty("key");
			// `uploadId` SHIPS — it is the row id, a join key, not PII.
			expect(rowFor(t).payload).toHaveProperty("uploadId");
		}
	});

	it("guard 4 · admin.signed_in — no sessionId, no ip survives", () => {
		const source = DIRTY_EVENT_ROWS.find(
			(r) => r.event_type === "admin.signed_in",
		);
		expect(source?.payload).toHaveProperty("sessionId"); // control
		expect(source?.payload).toHaveProperty("ip");

		const payload = rowFor("admin.signed_in").payload as Record<
			string,
			unknown
		>;
		expect(payload).not.toHaveProperty("sessionId");
		expect(payload).not.toHaveProperty("ip");

		// ⚠ This guard spans BOTH passes, and asserting it against strip-only
		// output was wrong. The session id lives in two places on this row:
		// `payload.sessionId`, which STRIP removes, and `aggregate_id`, which
		// only the pseudonymize pass touches (B.13's SHIP_OR_PSEUDO). A
		// value-level assertion over strip-only output therefore fails for a
		// correct implementation — the value has not reached its handler yet.
		// The absence claim belongs against the FULL transform.
		const full = JSON.stringify(transform("events", DIRTY_EVENT_ROWS));
		for (const sess of FIXTURE_SECRET_VALUES.adminSessionIds) {
			expect(full).not.toContain(sess);
		}
	});

	it("guard 5 · ALL types — no metadata.ip / metadata.user_agent survives", () => {
		// Control: every one of the 24 source rows carried both.
		for (const r of DIRTY_EVENT_ROWS) {
			expect(r.metadata, `${r.event_type} source`).toHaveProperty("ip");
			expect(r.metadata).toHaveProperty("user_agent");
		}

		for (const r of stripped) {
			expect(r.metadata, `${r.event_type} stripped`).not.toHaveProperty("ip");
			expect(r.metadata).not.toHaveProperty("user_agent");
		}
		for (const ip of FIXTURE_SECRET_VALUES.ips) {
			expect(json).not.toContain(ip);
		}
		for (const ua of FIXTURE_SECRET_VALUES.userAgents) {
			expect(json).not.toContain(ua);
		}
	});

	it("strips the seven market.* types' METADATA despite an empty payload rule", () => {
		// The case an empty rule invites you to skip. Payload strip is a
		// no-op here; metadata strip is not, and it is cross-cutting.
		for (const t of ["market.created", "market.opened", "market.voided"]) {
			expect(rowFor(t).metadata).not.toHaveProperty("ip");
			expect(rowFor(t).payload).toHaveProperty("marketId");
		}
	});
});

describe("Slice 4 · strip semantics", () => {
	it("REMOVES the key rather than nulling it", () => {
		// Appendix B.23 prescribes `metadata - 'ip'`. A surviving `ip: null`
		// announces the field existed and was withheld.
		const out = stripMetadata({ request_id: "r", ip: "203.0.113.7" }) as Record<
			string,
			unknown
		>;
		expect("ip" in out).toBe(false);
		expect(out.ip).toBeUndefined();
	});

	it("does not mutate the source row", () => {
		// The rows are read once and fed to several passes; a mutating strip
		// would make the result depend on pass ordering.
		const before = JSON.stringify(DIRTY_EVENT_ROWS[0]);
		stripRow("events", { ...DIRTY_EVENT_ROWS[0] });
		expect(JSON.stringify(DIRTY_EVENT_ROWS[0])).toBe(before);
	});

	it("THE WRONG ANSWER — an unruled event type THROWS, never passes through", () => {
		// Fail-closed. Passing through is the dangerous default and the one a
		// reasonable person writes without thinking.
		expect(() =>
			stripPayload("user.email_changed", { email: "x@example.invalid" }),
		).toThrow(EgressContractGapError);
	});

	it("drops mod_actions.blocked_text and image_r2_key — §19.4 omits both", () => {
		const [row] = stripTable("mod_actions", DIRTY_TABLE_ROWS.mod_actions);

		// Control: the source carried both.
		expect(DIRTY_TABLE_ROWS.mod_actions[0]).toHaveProperty("blocked_text");
		expect(DIRTY_TABLE_ROWS.mod_actions[0]).toHaveProperty("image_r2_key");

		expect(row).not.toHaveProperty("blocked_text");
		expect(row).not.toHaveProperty("image_r2_key");
	});

	it("drops the six users PII columns and KEEPS pfp_filename", () => {
		const [amber] = stripTable("users", DIRTY_TABLE_ROWS.users);

		for (const c of [
			"email",
			"google_id",
			"name",
			"image",
			"tos_acceptance_ip",
			"tos_acceptance_user_agent",
		]) {
			expect(DIRTY_TABLE_ROWS.users[0], `source ${c}`).toHaveProperty(c);
			expect(amber, `stripped ${c}`).not.toHaveProperty(c);
		}

		// ⚠ NULL_IF_ERASED, not STRIP. §19.4's table title says ten columns
		// are dropped and this is one of the ten; its own treatment cell and
		// Appendix B.1 both say it ships.
		expect(amber).toHaveProperty("pfp_filename");
		expect(amber.pfp_filename).toBe("amber-otter-042");
	});

	it("keeps market_media.r2_object_key while dropping image_uploads'", () => {
		const [mm] = stripTable("market_media", DIRTY_TABLE_ROWS.market_media);
		const [iu] = stripTable("image_uploads", DIRTY_TABLE_ROWS.image_uploads);

		expect(mm).toHaveProperty("r2_object_key");
		expect(iu).not.toHaveProperty("r2_object_key");
	});
});

// ── Slice 5 · pseudonymization ────────────────────────────────────────

describe("Slice 5 · export-time JOIN pseudonymization", () => {
	it("renames and rewrites all EIGHT column-level user FKs", () => {
		for (const table of [
			"bets",
			"comments",
			"dharma_ledger",
			"image_uploads",
			"positions",
			"payout_events",
			"user_events",
		] as const) {
			const source = DIRTY_TABLE_ROWS[table];
			// Control: the source row carries a raw users.id.
			expect(source[0], `${table} source`).toHaveProperty("user_id");

			const [out] = transform(table, source);
			expect(out, `${table} out`).not.toHaveProperty("user_id");
			expect(out, `${table} out`).toHaveProperty("user_pseudonym");
			expect(out.user_pseudonym).toMatch(/^(Amber|Basalt|Cinder)/);
		}
	});

	it("mod_actions renames to target_user_pseudonym, NOT user_pseudonym", () => {
		// Appendix B.10. The prefix says WHICH user; flattening it would
		// relabel "the user moderated" as "the user who acted".
		const [out] = transform("mod_actions", DIRTY_TABLE_ROWS.mod_actions);

		expect(out).toHaveProperty("target_user_pseudonym");
		expect(out).not.toHaveProperty("user_pseudonym");
		expect(out).not.toHaveProperty("target_user_id");
		expect(out.target_user_pseudonym).toBe("BasaltHeron117");
	});

	it("THE NESTED JSONB REWRITE — events.metadata.user_id → user_pseudonym", () => {
		// The path the brief names as most likely to be missed, and the only
		// rewrite no column-level loop reaches.
		const out = transform("events", DIRTY_EVENT_ROWS);
		const betPlaced = out.find((r) => r.event_type === "bet.placed");
		const meta = betPlaced?.metadata as Record<string, unknown>;

		// Control: the source metadata carried the raw id.
		const src = DIRTY_EVENT_ROWS.find((r) => r.event_type === "bet.placed");
		expect(src?.metadata.user_id).toBe(FIXTURE_USER_IDS.amber);

		expect(meta).not.toHaveProperty("user_id");
		expect(meta.user_pseudonym).toBe("AmberOtter042");
	});

	it("preserves the 'admin-singleton' and 'system' sentinels verbatim", () => {
		// §19.5: researchers filter on the literal string. Rewriting it would
		// delete the admin-action analysis the dataset promises.
		const out = transform("events", DIRTY_EVENT_ROWS);

		const adminRow = out.find((r) => r.event_type === "admin.signed_in");
		expect((adminRow?.metadata as Record<string, unknown>).actor_id).toBe(
			ADMIN_SENTINEL,
		);

		const sweepRow = out.find((r) => r.event_type === "image_upload.orphaned");
		expect((sweepRow?.metadata as Record<string, unknown>).actor_id).toBe(
			SYSTEM_SENTINEL,
		);

		// And the sentinel-bearing COLUMNS, not just metadata.
		const [market] = transform("markets", DIRTY_TABLE_ROWS.markets);
		expect(market.created_by).toBe(ADMIN_SENTINEL);
	});

	it("rewrites a participant actor_id in place, keeping the KEY", () => {
		// Appendix B.13's value-rewrite case. The key cannot become
		// `actor_pseudonym`, because a CSV column cannot change its name per
		// row and the sentinel rows would then be mislabelled as pseudonyms.
		const out = pseudonymizeMetadata(
			{ actor_id: FIXTURE_USER_IDS.amber, request_id: "r" },
			map,
			"t",
		) as Record<string, unknown>;

		expect(out).toHaveProperty("actor_id");
		expect(out).not.toHaveProperty("actor_pseudonym");
		expect(out.actor_id).toBe("AmberOtter042");
	});

	it("aggregate_id: PSEUDO for user-bearing types, raw for the rest", () => {
		// B.13's SHIP_OR_PSEUDO. A blanket rule either way is wrong.
		expect(
			pseudonymizeAggregateId("user", FIXTURE_USER_IDS.amber, map, "t"),
		).toBe("AmberOtter042");
		expect(
			pseudonymizeAggregateId(
				"dharma_account",
				FIXTURE_USER_IDS.basalt,
				map,
				"t",
			),
		).toBe("BasaltHeron117");

		// A market aggregate_id is a market PK, not a user — pseudonymizing
		// it would corrupt the join AND throw, since it is not in the map.
		const marketId = "0192f3a4-cccc-7000-8000-00000000m001";
		expect(pseudonymizeAggregateId("market", marketId, map, "t")).toBe(
			marketId,
		);

		// admin_session ships raw by explicit decision (B.13).
		// ⚠ admin_session is REDACTED here, diverging from B.13's "SHIPs raw".
		// See REDACTED_ADMIN_SESSION for the full reasoning: §19.4.1 strips
		// this same value from payload.sessionId one field over, and §19.3
		// withholds the whole admin_sessions table as privacy-sensitive.
		const sess = FIXTURE_SECRET_VALUES.adminSessionIds[0];
		expect(pseudonymizeAggregateId("admin_session", sess, map, "t")).toBe(
			REDACTED_ADMIN_SESSION,
		);
	});

	it("users is passed through with its raw id — the ONE exemption", () => {
		const [amber] = pseudonymizeTable("users", DIRTY_TABLE_ROWS.users, map);
		expect(amber.id).toBe(FIXTURE_USER_IDS.amber);
		expect(amber.pseudonym).toBe("AmberOtter042");
	});

	it("THE WRONG ANSWER — an unmapped users.id THROWS, never falls back raw", () => {
		// The tempting fallback (leave the raw value) is the exact failure
		// the wall forbids, and it would fire in the unanticipated case.
		const emptyMap = new Map<string, string>();
		expect(() =>
			pseudonymizeRow("bets", { ...DIRTY_TABLE_ROWS.bets[0] }, emptyMap),
		).toThrow(EgressContractGapError);
	});

	it("pseudonymColumnName handles both prefixes without a lookup table", () => {
		expect(pseudonymColumnName("user_id")).toBe("user_pseudonym");
		expect(pseudonymColumnName("target_user_id")).toBe("target_user_pseudonym");
	});
});

// ── the whole thing, through the Slice 1 egress guards ────────────────

describe("Slices 4+5 · every shipped table passes the egress guards", () => {
	const shippedWithFixtures = Object.keys(
		DIRTY_TABLE_ROWS,
	) as (keyof typeof DIRTY_TABLE_ROWS)[];

	it.each(
		shippedWithFixtures,
	)("%s — transformed output is egress-clean", (table) => {
		const out = transform(table, DIRTY_TABLE_ROWS[table]);
		expect(() =>
			assertTableClean(table, out, secrets, {
				isUsersTable: table === "users",
			}),
		).not.toThrow();
	});

	it("POSITIVE CONTROL — the SAME tables fail before the transform", () => {
		// Without this, the block above is consistent with the guards being
		// no-ops. Every table whose fixture carries a secret must fail
		// untransformed; the ones that legitimately carry none are named.
		// Tables whose fixture legitimately carries no secret at all. Naming
		// them explicitly rather than skipping failures keeps the control
		// honest: if one of these ever gains a PII column, this list is what
		// has to change, and changing it is a decision someone makes.
		const noSecrets = new Set([
			"pools",
			"resolution_events",
			"identity_pool",
			"markets",
			// market_media's r2_object_key SHIPS (B.16) — `m/<marketId>/…`
			// embeds no user id, unlike image_uploads' `u/<userId>/…`.
			"market_media",
		]);

		for (const table of shippedWithFixtures) {
			const check = () =>
				assertTableClean(table, DIRTY_TABLE_ROWS[table], secrets, {
					isUsersTable: false,
				});
			if (noSecrets.has(table)) continue;
			expect(check, `${table} must fail untransformed`).toThrow();
		}
	});

	it("no raw users.id survives ANYWHERE outside the users table", () => {
		// The wall, asserted over the whole transformed corpus at once.
		for (const table of shippedWithFixtures) {
			if (table === "users") continue;
			const json = JSON.stringify(transform(table, DIRTY_TABLE_ROWS[table]));
			for (const id of Object.values(FIXTURE_USER_IDS)) {
				expect(json, `${table} must not contain ${id}`).not.toContain(id);
			}
		}
	});
});
