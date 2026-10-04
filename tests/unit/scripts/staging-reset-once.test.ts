import { describe, expect, it } from "vitest";

import {
	fragmentCode,
	snapshotFrom,
	verdict,
} from "../../../scripts/staging-reset-once";

/**
 * STAGING-RESET-AWS-1 (ONE-OFF, removed after the run) — the orchestrator's two
 * pure parts: the target verdict it makes before any child runs, and the step-0
 * capture it hands the content-market seeder.
 */

const STAGING_RDS =
	"zugzwang-staging-database-postgres1a2b3c4d.c9abcdefghij.ap-south-1.rds.amazonaws.com";
const FRAGMENT = "database-postgres1a2b3c4d";
const ok = {
	DATABASE_URL_STAGING: `postgres://zugzwang:pw@${STAGING_RDS}:5432/zugzwang`,
	STAGING_PROJECT_REF_FRAGMENT: FRAGMENT,
	ZUGZWANG_ENV: "staging",
};

describe("verdict", () => {
	it("accepts the staging RDS target", () => {
		expect(verdict(ok)).toEqual({ ok: true, host: STAGING_RDS });
	});

	it("refuses production RDS, a missing fragment, and a non-staging env", () => {
		expect(
			verdict({
				...ok,
				DATABASE_URL_STAGING: ok.DATABASE_URL_STAGING.replace(
					"staging",
					"production",
				),
			}).ok,
		).toBe(false);
		expect(verdict({ ...ok, STAGING_PROJECT_REF_FRAGMENT: undefined }).ok).toBe(
			false,
		);
		expect(verdict({ ...ok, ZUGZWANG_ENV: "production" }).ok).toBe(false);
	});
});

const market = (i: number) => ({
	id: `00000000-0000-7000-8000-00000000000${i}`,
	slug: `market-${i}`,
	title: `Market ${i}`,
	description: `Description ${i}`,
	status: "Open",
	resolution_deadline: new Date("2026-11-05T23:45:00Z"),
	media_video_url: null,
});
const media = (i: number) => ({
	market_id: market(i).id,
	r2_object_key: `m/${market(i).id}/a.webp`,
	display_order: 0,
	is_default: true,
});

describe("snapshotFrom (step 0)", () => {
	const six = [1, 2, 3, 4, 5, 6];

	it("writes the shape the content-market parser reads, verbatim", () => {
		const { json, problems } = snapshotFrom(
			six.map(market),
			six.map(media),
			"2026-10-04T00:00:00.000Z",
			STAGING_RDS,
		);
		expect(problems).toEqual([]);
		const parsed = JSON.parse(json);
		expect(parsed.markets).toHaveLength(6);
		expect(parsed.markets[0]).toEqual({
			id: market(1).id,
			slug: "market-1",
			title: "Market 1",
			description: "Description 1",
			status: "Open",
			resolution_deadline: "2026-11-05T23:45:00.000Z",
			media_video_url: null,
		});
		expect(parsed.market_media[0]).toEqual(media(1));
	});

	it("refuses a deadline createMarket would refuse (past, or after the freeze)", () => {
		for (const d of ["2020-01-01T00:00:00Z", "2026-12-01T00:00:00Z"]) {
			expect(
				snapshotFrom(
					six.map((i) =>
						i === 2
							? { ...market(i), resolution_deadline: new Date(d) }
							: market(i),
					),
					six.map(media),
					"t",
					STAGING_RDS,
				).problems,
			).toHaveLength(1);
		}
	});

	it("refuses anything but six markets with one default image each", () => {
		expect(
			snapshotFrom(six.slice(1).map(market), six.map(media), "t", STAGING_RDS)
				.problems,
		).toHaveLength(1);
		expect(
			snapshotFrom(
				six.map(market),
				six.map((i) => ({ ...media(i), is_default: i !== 3 })),
				"t",
				STAGING_RDS,
			).problems,
		).toHaveLength(1);
	});
});

describe("fragmentCode — the exit code that says why, without the value", () => {
	const url = ok.DATABASE_URL_STAGING;

	it("a fragment in the instance id sets every bit", () => {
		expect(fragmentCode(FRAGMENT, url)).toBe(64 + 1 + 2 + 4 + 8 + 16 + 32);
	});

	it("an absent fragment is 64; the account hash is in the host but not the instance id", () => {
		expect(fragmentCode(undefined, url)).toBe(64);
		expect(fragmentCode("c9abcdefghij.ap-south-1", url)).toBe(
			64 + 1 + 2 + 4 + 8 + 16,
		);
	});

	it("a failing verdict carries the code", () => {
		const v = verdict({ ...ok, STAGING_PROJECT_REF_FRAGMENT: "short" });
		expect(v.ok).toBe(false);
		if (!v.ok) expect(v.code).toBe(fragmentCode("short", url));
	});
});

describe("snapshotFrom — the exit code names the failing rule", () => {
	const six = [1, 2, 3, 4, 5, 6];

	it("a count mismatch encodes roster-found and the database total", () => {
		const r = snapshotFrom(
			[1, 2, 3, 4, 5].map(market),
			[1, 2, 3, 4, 5].map(media),
			"t",
			STAGING_RDS,
			9,
		);
		expect(r.code).toBe(128 + 16 * 5 + 9);
	});

	it("a deadline problem is 21, a default-image problem 22, all clean is 0", () => {
		expect(
			snapshotFrom(
				six.map((i) =>
					i === 1
						? {
								...market(i),
								resolution_deadline: new Date("2020-01-01T00:00:00Z"),
							}
						: market(i),
				),
				six.map(media),
				"t",
				STAGING_RDS,
			).code,
		).toBe(21);
		expect(
			snapshotFrom(
				six.map(market),
				six.map((i) => ({ ...media(i), is_default: i !== 4 })),
				"t",
				STAGING_RDS,
			).code,
		).toBe(22);
		expect(
			snapshotFrom(six.map(market), six.map(media), "t", STAGING_RDS).code,
		).toBe(0);
	});
});
