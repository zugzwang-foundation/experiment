import { beforeEach, describe, expect, it, vi } from "vitest";

import {
	__resetReadUrlMemo,
	DOWNSTREAM_CACHED_MINUTES,
	holdWindowMs,
	memoizedReadUrl,
} from "@/server/storage/read-url-memo";

/**
 * DETERMINISTIC READ URLS — the signature is pinned to a window START, so the
 * same object yields the same URL from any process.
 *
 * WHY THIS EXISTS. The memo is `const memo = new Map()` in one process. Every
 * serverless instance holds its own, a cold start begins empty, and two
 * instances serving one image hand the same visitor two different URLs — which
 * a browser, keying its cache on the URL, treats as two different images. The
 * reuse figure was therefore never "one URL per hold window"; it was "one URL
 * per hold window PER INSTANCE", which across a fleet is close to none.
 *
 * ⚠ THE HOLD BOUNDARY IS THE LOAD-BEARING ASSERTION IN THIS FILE, not the
 * determinism. Pinning the signing date without also moving the hold re-opens
 * C-1 exactly: the signature now starts its life at the window start rather
 * than at mint time, so a `nowMs + holdMs` hold lets a URL be served for up to
 * TWO windows after signing — 2·2750 + 3900 = 9400 against a 7200 s signature,
 * dead for the last thirty-seven minutes, with the mint having succeeded and
 * nothing throwing. The determinism tests would all pass while that was true.
 *
 * Every "same" claim below carries the "different" control the sibling file
 * (`read-url-memo.test.ts`) argues for: an implementation that returned ONE URL
 * for everything would satisfy determinism perfectly and be catastrophic.
 *
 * Pure — no R2, no network. `mint` records the signing date it was handed.
 */

const RENDER = 7200;
const DOWNSTREAM = DOWNSTREAM_CACHED_MINUTES;
const WINDOW_MS = holdWindowMs(RENDER, DOWNSTREAM);

/** Records every signing date the memo passes down. */
function recordingMint() {
	const dates: (Date | undefined)[] = [];
	let n = 0;
	return {
		dates,
		fn: async (signingDate?: Date) => {
			dates.push(signingDate);
			n += 1;
			// Include the date so two different windows yield two different URLs,
			// the way a real signature does.
			return `https://signed.test/${signingDate?.toISOString() ?? "none"}#${n}`;
		},
	};
}

beforeEach(() => {
	__resetReadUrlMemo();
	vi.useFakeTimers();
	vi.setSystemTime(new Date("2026-09-05T00:00:00.000Z"));
});

describe("the signing date is pinned to a window start", () => {
	it("hands the mint a date aligned exactly to the window", async () => {
		vi.setSystemTime(new Date(7 * WINDOW_MS + 1234));
		const mint = recordingMint();

		await memoizedReadUrl("uploads", "u/a.png", RENDER, DOWNSTREAM, mint.fn);

		const [date] = mint.dates;
		expect(date).toBeInstanceOf(Date);
		expect((date as Date).getTime() % WINDOW_MS).toBe(0);
		expect((date as Date).getTime()).toBe(7 * WINDOW_MS);
	});

	it("two SEPARATE instances in the same window sign the same date", async () => {
		vi.setSystemTime(new Date(7 * WINDOW_MS + 10));
		const first = recordingMint();
		const urlA = await memoizedReadUrl(
			"uploads",
			"u/a.png",
			RENDER,
			DOWNSTREAM,
			first.fn,
		);

		// A different instance = an empty memo, and a later moment in the SAME
		// window. This is the whole claim: no shared state, same answer.
		__resetReadUrlMemo();
		vi.setSystemTime(new Date(7 * WINDOW_MS + WINDOW_MS - 1));
		const second = recordingMint();
		const urlB = await memoizedReadUrl(
			"uploads",
			"u/a.png",
			RENDER,
			DOWNSTREAM,
			second.fn,
		);

		// Both halves matter: the DATE is what the signature covers, and the URL
		// is what the browser keys its cache on. Asserting only the date would
		// pass against a signer that ignored it.
		expect(second.dates[0]).toEqual(first.dates[0]);
		expect(urlB).toBe(urlA);
		// …and each instance really did mint (neither was served a shared hold).
		expect(first.dates).toHaveLength(1);
		expect(second.dates).toHaveLength(1);
	});

	it("the NEXT window signs a different date — it still rotates", async () => {
		vi.setSystemTime(new Date(7 * WINDOW_MS));
		const a = recordingMint();
		await memoizedReadUrl("uploads", "u/a.png", RENDER, DOWNSTREAM, a.fn);

		__resetReadUrlMemo();
		vi.setSystemTime(new Date(8 * WINDOW_MS));
		const b = recordingMint();
		await memoizedReadUrl("uploads", "u/a.png", RENDER, DOWNSTREAM, b.fn);

		// The control for the test above: a URL frozen forever would also be
		// "deterministic", and would never expire.
		expect(b.dates[0]).not.toEqual(a.dates[0]);
	});

	it("two DIFFERENT objects still get different URLs in one window", async () => {
		vi.setSystemTime(new Date(7 * WINDOW_MS));
		const mint = recordingMint();

		const one = await memoizedReadUrl(
			"uploads",
			"u/a.png",
			RENDER,
			DOWNSTREAM,
			mint.fn,
		);
		const two = await memoizedReadUrl(
			"uploads",
			"u/b.png",
			RENDER,
			DOWNSTREAM,
			mint.fn,
		);

		// The catastrophic failure this guards: one URL answering for every image
		// would satisfy every determinism assertion above.
		expect(one).not.toBe(two);
		expect(mint.dates).toHaveLength(2);
	});
});

describe("the hold ends at the window boundary, not at now + hold", () => {
	it("a URL minted late in a window is NOT held into the next one", async () => {
		// One second before the window ends.
		vi.setSystemTime(new Date(7 * WINDOW_MS + WINDOW_MS - 1000));
		const mint = recordingMint();
		await memoizedReadUrl("uploads", "u/a.png", RENDER, DOWNSTREAM, mint.fn);
		expect(mint.dates).toHaveLength(1);

		// Two seconds later we are in the NEXT window, so the entry must be dead
		// and the mint must run again with the new window's date.
		//
		// ⛔ UNDER THE OLD `nowMs + holdMs` HOLD THIS WOULD STILL HIT, and would
		// go on hitting for another 45 minutes — serving a signature that began
		// its life a full window earlier. That is the C-1 re-opening; this
		// assertion is the only thing in the suite that can see it.
		vi.setSystemTime(new Date(7 * WINDOW_MS + WINDOW_MS + 1000));
		await memoizedReadUrl("uploads", "u/a.png", RENDER, DOWNSTREAM, mint.fn);

		expect(mint.dates).toHaveLength(2);
		expect(mint.dates[1]).not.toEqual(mint.dates[0]);
	});

	it("still serves from the hold WITHIN the window (it is a cache, after all)", async () => {
		vi.setSystemTime(new Date(7 * WINDOW_MS));
		const mint = recordingMint();
		await memoizedReadUrl("uploads", "u/a.png", RENDER, DOWNSTREAM, mint.fn);

		// The positive control for the test above: if the boundary logic simply
		// never held anything, that test would pass and the memo would be dead.
		vi.setSystemTime(new Date(7 * WINDOW_MS + WINDOW_MS - 1));
		await memoizedReadUrl("uploads", "u/a.png", RENDER, DOWNSTREAM, mint.fn);

		expect(mint.dates).toHaveLength(1);
	});

	it("the shipped window still satisfies window + downstream < ttl", () => {
		// The theorem the whole design rests on, re-derived from live constants
		// rather than asserted as a number.
		expect(WINDOW_MS / 1000 + DOWNSTREAM).toBeLessThan(RENDER);
	});
});

describe("the degenerate arm pins nothing", () => {
	it("passes NO signing date when the downstream window swallows the TTL", async () => {
		const mint = recordingMint();

		// downstream >= ttl ⇒ holdWindowMs is 0 ⇒ there is no window to align to,
		// and aligning anyway would hand out a URL already partway through its
		// life with no hold to cap it.
		await memoizedReadUrl("uploads", "u/a.png", 60, 60, mint.fn);

		expect(mint.dates).toEqual([undefined]);
	});
});
