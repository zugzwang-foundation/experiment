import { describe, expect, it } from "vitest";

import { formatCountdown } from "@/components/shell/countdown-format";
import { FREEZE_INSTANT_UTC } from "@/server/markets/create";

// The countdown consumes the BUILT freeze pin (F2) — no duplicate constant.
// SPEC.1 §6/§12/§15 pin the instant with timezone: 2026-11-05 23:59 UTC.
const TARGET = FREEZE_INSTANT_UTC.getTime();

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe("formatCountdown — the header freeze countdown (values-log R-2, OQ-8)", () => {
	it("pins the imported freeze instant (F2 — the single source, no duplicate)", () => {
		expect(TARGET).toBe(Date.UTC(2026, 10, 5, 23, 59, 0, 0));
	});

	it("renders the in-window 8-char shape (days < 100 → 8 cells)", () => {
		// The values-log worked example: 45d 06h 15m out → `45:06:15`.
		const now = TARGET - (45 * DAY + 6 * HOUR + 15 * MINUTE);
		expect(formatCountdown(now, TARGET)).toBe("45:06:15");
		expect(formatCountdown(now, TARGET)).toHaveLength(8);
	});

	it("renders the pre-launch >99d 9-char shape (ratified 9-cell row, OQ-8)", () => {
		const now = TARGET - (112 * DAY + 6 * HOUR + 15 * MINUTE);
		expect(formatCountdown(now, TARGET)).toBe("112:06:15");
		expect(formatCountdown(now, TARGET)).toHaveLength(9);
	});

	it("flips 9 → 8 cells exactly at the 100-day boundary (~Jul 29)", () => {
		// At exactly 100d remaining the string is still 9 chars…
		expect(formatCountdown(TARGET - 100 * DAY, TARGET)).toBe("100:00:00");
		// …one minute later (99d 23h 59m) it is the 8-char shape. The boundary
		// instant is 2026-07-28T23:59Z — the plan's "~Jul 29".
		expect(formatCountdown(TARGET - (100 * DAY - MINUTE), TARGET)).toBe(
			"99:23:59",
		);
		expect(TARGET - 100 * DAY).toBe(Date.UTC(2026, 6, 28, 23, 59, 0, 0));
	});

	it("clamps to 00:00:00 at the freeze instant", () => {
		expect(formatCountdown(TARGET, TARGET)).toBe("00:00:00");
	});

	it("clamps to 00:00:00 after the freeze instant (no negatives)", () => {
		expect(formatCountdown(TARGET + MINUTE, TARGET)).toBe("00:00:00");
		expect(formatCountdown(TARGET + 365 * DAY, TARGET)).toBe("00:00:00");
	});

	it("floors sub-minute remainders across the UTC minute boundary", () => {
		// Minute granularity: a full minute out reads 00:00:01; anything under
		// a minute floors to 00:00:00 (the final minute reads as zero — the
		// display never overstates the time left).
		expect(formatCountdown(TARGET - MINUTE, TARGET)).toBe("00:00:01");
		expect(formatCountdown(TARGET - (MINUTE - 1), TARGET)).toBe("00:00:00");
		// Mid-minute drift never changes the printed minute.
		const now = TARGET - (45 * DAY + 6 * HOUR + 15 * MINUTE);
		expect(formatCountdown(now + MINUTE - 1, TARGET)).toBe("45:06:14");
	});

	it("zero-pads days below 10 (the 8-cell shape holds to the end)", () => {
		const now = TARGET - (9 * DAY + 3 * HOUR + 7 * MINUTE);
		expect(formatCountdown(now, TARGET)).toBe("09:03:07");
	});
});
