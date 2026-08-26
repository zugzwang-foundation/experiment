import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
	__resetReadUrlMemo,
	holdWindowMs,
	memoizedReadUrl,
} from "@/server/storage/read-url-memo";

/**
 * R2-MEMO — the held presigned-read-URL memo.
 *
 * ⚠ THE SHAPE OF THIS FILE IS THE POINT. The headline assertion — "the same
 * image returns the same URL" — is a claim that would ALSO pass against a
 * catastrophically broken implementation that returned one URL for *every*
 * image. That is not a hypothetical: it is the single most likely way to get
 * this wrong, and it would leak one participant's image URL onto another's
 * argument.
 *
 * So every "same" assertion below is paired with a "different" one. The suite
 * is not testing that a cache exists; it is testing that the cache
 * discriminates. (V-2: a positive claim needs the control that would catch its
 * plausible failure.)
 *
 * Pure: no DB, no R2, no network. `mint` is a counting stub, so hits and misses
 * are observable directly rather than inferred from timing.
 */

const HOUR = 3600;
const MODERATION = 60;

/** A stub signer that returns a distinguishable URL per call. */
function makeMint(label: string) {
	let calls = 0;
	const fn = async () => {
		calls += 1;
		return `https://signed.test/${label}?sig=${calls}`;
	};
	return { fn, calls: () => calls };
}

beforeEach(() => {
	__resetReadUrlMemo();
	vi.useFakeTimers();
	vi.setSystemTime(new Date("2026-08-26T00:00:00.000Z"));
});

afterEach(() => {
	vi.useRealTimers();
	__resetReadUrlMemo();
});

describe("hold window — derived, never a second constant", () => {
	it("is a fraction of the TTL, so a shorter TTL gets a shorter hold", () => {
		// The whole safety argument. A hardcoded "50 minutes" would be right for
		// the hour TTL and would hand out a URL 49 minutes dead for the 60s one.
		expect(holdWindowMs(HOUR)).toBe(3_000_000); // 50 min of a 60 min TTL
		expect(holdWindowMs(MODERATION)).toBe(50_000); // 50 s of a 60 s TTL
	});

	it("ALWAYS expires strictly before the URL does — at both TTLs", () => {
		// The invariant that makes this change safe at all, asserted directly
		// rather than inferred. If this ever fails, the memo is serving URLs that
		// are already dead.
		for (const ttl of [MODERATION, 300, HOUR, 86_400]) {
			expect(holdWindowMs(ttl)).toBeLessThan(ttl * 1000);
		}
	});
});

describe("holding — the same object returns the same URL", () => {
	it("mints once, then serves the held URL", async () => {
		const mint = makeMint("a");

		const first = await memoizedReadUrl("uploads:a:3600", HOUR, mint.fn);
		const second = await memoizedReadUrl("uploads:a:3600", HOUR, mint.fn);
		const third = await memoizedReadUrl("uploads:a:3600", HOUR, mint.fn);

		expect(second).toBe(first);
		expect(third).toBe(first);
		// The observable proof it was HELD, not re-derived to the same value:
		// the signer ran exactly once.
		expect(mint.calls()).toBe(1);
	});

	it("re-mints once the hold lapses, and before the URL expires", async () => {
		const mint = makeMint("a");
		const first = await memoizedReadUrl("uploads:a:3600", HOUR, mint.fn);

		// One millisecond inside the hold — still the same URL.
		vi.advanceTimersByTime(holdWindowMs(HOUR) - 1);
		expect(await memoizedReadUrl("uploads:a:3600", HOUR, mint.fn)).toBe(first);
		expect(mint.calls()).toBe(1);

		// Past the hold — a fresh mint, while the old URL still had 10 minutes of
		// validity left. That margin is the point: the swap happens early.
		vi.advanceTimersByTime(2);
		const renewed = await memoizedReadUrl("uploads:a:3600", HOUR, mint.fn);
		expect(renewed).not.toBe(first);
		expect(mint.calls()).toBe(2);
	});
});

describe("POSITIVE CONTROLS — the memo discriminates", () => {
	it("DIFFERENT images get DIFFERENT URLs", async () => {
		// The control the whole file exists for. A memo that returned one URL for
		// everything would satisfy every "same" assertion above and would serve
		// one participant's image in place of another's.
		const mint = makeMint("shared");

		const a = await memoizedReadUrl("uploads:image-a:3600", HOUR, mint.fn);
		const b = await memoizedReadUrl("uploads:image-b:3600", HOUR, mint.fn);

		expect(a).not.toBe(b);
		expect(mint.calls()).toBe(2);
	});

	it("the SAME key at DIFFERENT TTLs never shares a URL", async () => {
		// The moderation hazard, isolated. `signRead` serves both the 60s
		// moderation path and the 3600s render path. If the TTL were not part of
		// the key, a render could be handed the 60-second URL and break a minute
		// later — or moderation could be handed an hour-long one.
		const mint = makeMint("same-object");

		const render = await memoizedReadUrl("uploads:k:3600", HOUR, mint.fn);
		const moderation = await memoizedReadUrl(
			"uploads:k:60",
			MODERATION,
			mint.fn,
		);

		expect(render).not.toBe(moderation);
		expect(mint.calls()).toBe(2);
	});

	it("the SAME key in DIFFERENT buckets never shares a URL", async () => {
		// plan §1e keeps the participant `uploads` arm and the admin
		// `market-media` arm separate. Identically-named keys in the two buckets
		// are different objects and must not answer for each other.
		const mint = makeMint("cross-bucket");

		const uploads = await memoizedReadUrl("uploads:k:3600", HOUR, mint.fn);
		const media = await memoizedReadUrl("market-media:k:3600", HOUR, mint.fn);

		expect(uploads).not.toBe(media);
		expect(mint.calls()).toBe(2);
	});
});

describe("failure posture is unchanged", () => {
	it("a throwing mint is NOT held, and the next call retries", async () => {
		// A cached failure would turn one transient R2 blip into 50 minutes of a
		// missing image. The set happens only after the await resolves, so a
		// throw stores nothing.
		let calls = 0;
		const flaky = async () => {
			calls += 1;
			if (calls === 1) {
				throw new Error("r2 unavailable");
			}
			return "https://signed.test/recovered";
		};

		await expect(
			memoizedReadUrl("uploads:flaky:3600", HOUR, flaky),
		).rejects.toThrow("r2 unavailable");

		// The retry reaches the signer rather than a cached failure.
		await expect(
			memoizedReadUrl("uploads:flaky:3600", HOUR, flaky),
		).resolves.toBe("https://signed.test/recovered");
		expect(calls).toBe(2);
	});
});
