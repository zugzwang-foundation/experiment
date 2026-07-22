import { afterEach, describe, expect, it } from "vitest";
import {
	countdownParts,
	formatCountdown,
} from "@/app/(admin)/admin/markets/_components/countdown";
import { markets } from "@/db/schema";
import { loadAdminMarketsOverview } from "@/server/admin/markets/overview";
import { FREEZE_INSTANT_UTC } from "@/server/markets/create";

import { testClient, testDb } from "../../db/_fixtures/db";
import { truncateTables } from "../../db/_fixtures/truncate";

// UI.6 S1 tests-first (§2.S1) — the Markets tab's needs-resolution count +
// freeze countdown. The count is the §6.1 pre-freeze obligation surface: the
// number of `Closed` markets still awaiting a terminal Resolve/Void. The
// countdown is derived purely from the pinned `FREEZE_INSTANT_UTC` constant.
// DB-BACKED (:54322) for the count; pure for the countdown.

const DEADLINE = new Date("2026-10-01T00:00:00.000Z");

async function seed(
	slug: string,
	status: "Draft" | "Open" | "Closed" | "Resolved" | "Voided",
): Promise<void> {
	await testDb.insert(markets).values({
		slug,
		title: "PLACEHOLDER — not a real market",
		description: "PLACEHOLDER criterion",
		status,
		resolutionDeadline: DEADLINE,
	});
}

describe("loadAdminMarketsOverview — needs-resolution count (S1)", () => {
	afterEach(async () => {
		await truncateTables(testClient, ["events", "pools", "markets"]);
	});

	it("needs-resolution::zero-when-no-closed-markets", async () => {
		await seed("nr-open-1", "Open");
		await seed("nr-draft-1", "Draft");
		await seed("nr-resolved-1", "Resolved");

		const overview = await loadAdminMarketsOverview();
		expect(overview.needsResolutionCount).toBe(0);
	});

	it("needs-resolution::one-closed-market", async () => {
		await seed("nr-closed-1", "Closed");
		await seed("nr-open-2", "Open");

		const overview = await loadAdminMarketsOverview();
		expect(overview.needsResolutionCount).toBe(1);
	});

	it("needs-resolution::counts-all-closed-and-only-closed", async () => {
		await seed("nr-closed-a", "Closed");
		await seed("nr-closed-b", "Closed");
		await seed("nr-closed-c", "Closed");
		await seed("nr-open-3", "Open");
		await seed("nr-resolved-2", "Resolved");
		await seed("nr-voided-1", "Voided");

		const overview = await loadAdminMarketsOverview();
		// Exactly the Closed cardinality — Resolved / Voided / Open excluded.
		expect(overview.needsResolutionCount).toBe(3);
		expect(overview.rows.length).toBe(6);
	});
});

describe("freeze countdown — derived from FREEZE_INSTANT_UTC (S1)", () => {
	it("countdown::freeze-instant-is-the-pinned-conclusion-instant", () => {
		// The countdown target is the immutable conclusion-freeze instant. Pin it
		// so a stray redefinition (STOP trigger #10) is caught here.
		expect(FREEZE_INSTANT_UTC.toISOString()).toBe("2026-11-05T23:59:00.000Z");
	});

	it("countdown::parts-decompose-remaining-ms", () => {
		const ms = ((2 * 24 + 3) * 60 * 60 + 4 * 60 + 5) * 1000; // 2d 3h 4m 5s
		expect(countdownParts(ms)).toEqual({
			reached: false,
			days: 2,
			hours: 3,
			minutes: 4,
			seconds: 5,
		});
	});

	it("countdown::reached-at-or-past-the-instant", () => {
		expect(countdownParts(0).reached).toBe(true);
		expect(countdownParts(-5000).reached).toBe(true);
		expect(formatCountdown(-1)).toBe("freeze reached");
	});

	it("countdown::formats-relative-to-the-freeze-instant", () => {
		// A remaining span computed against the constant renders as a d/h/m/s label.
		const remaining =
			FREEZE_INSTANT_UTC.getTime() -
			new Date("2026-11-04T23:59:00.000Z").getTime();
		expect(formatCountdown(remaining)).toBe("1d 00h 00m 00s");
	});
});
