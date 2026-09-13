import { GetObjectCommand } from "@aws-sdk/client-s3";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// Rendered images must be served with a bounded `Cache-Control`, applied via
// the presigned URL's `response-cache-control` parameter rather than stored on
// the object.
//
// WHY THIS GUARD EXISTS. The header was previously set by backfilling the
// bucket, which fixes only objects that already exist. Measured on 2026-09-04: a
// backfill left the `uploads` arm at 41/41 correct, and within three hours 204
// new objects had arrived uncacheable, because nothing on the upload path sets
// the header. Serving it instead covers every object, uploaded whenever — but
// only for as long as the three render seams keep passing it, and nothing about
// a missing argument is visible at runtime. A dropped argument does not throw,
// does not fail a build, and does not change a single pixel; it silently costs
// every visitor a re-download. That is exactly the shape a test has to hold.
//
// The THIRD case is the load-bearing one. `signReadSingleUse` feeds OpenAI's
// fetcher, where no browser cache exists to instruct, so it must NOT carry the
// directive — the same reasoning that keeps that path out of the R2 memo. A
// blanket "every read URL is cached" implementation would pass the first two
// assertions and be wrong; only the negative case can catch it.
//
// `getSignedUrl` is mocked to CAPTURE its command. `@aws-sdk/client-s3` stays
// REAL, so `.input.ResponseCacheControl` is the genuinely bound value. No
// network, in either direction.

const { mockGetSignedUrl, captured } = vi.hoisted(() => {
	const captured: { commands: unknown[] } = { commands: [] };
	return {
		captured,
		mockGetSignedUrl: vi.fn(async (_client: unknown, command: unknown) => {
			captured.commands.push(command);
			return "https://stub.r2.cloudflarestorage.com/get?X-Amz-Signature=stub";
		}),
	};
});

vi.mock("@aws-sdk/s3-request-presigner", () => ({
	getSignedUrl: mockGetSignedUrl,
}));

import { RENDER_IMAGE_CACHE_CONTROL } from "@/server/config/limits";
import { signReadMarketMedia } from "@/server/discovery/media";
import { signRead, signReadSingleUse } from "@/server/storage/sign-read";

beforeAll(() => {
	for (const arm of ["UPLOADS", "MARKET_MEDIA"]) {
		process.env[`R2_ENDPOINT_${arm}`] =
			"https://example.r2.cloudflarestorage.com";
		process.env[`R2_ACCESS_KEY_ID_${arm}`] = `AKIAEXAMPLE${arm.slice(0, 8)}`;
		process.env[`R2_SECRET_ACCESS_KEY_${arm}`] = "0".repeat(64);
		process.env[`R2_BUCKET_${arm}`] = `bucket-${arm.toLowerCase()}`;
	}
});

beforeEach(() => {
	captured.commands.length = 0;
});

/** The memo is keyed on (bucket, key), so every case needs its own key or a
 *  later call is answered from the hold and mints nothing to inspect. */
const freshKey = (label: string) =>
	`u/${label}-${Math.random().toString(36).slice(2)}.png`;

function onlyCommand(): GetObjectCommand {
	expect(captured.commands).toHaveLength(1);
	const command = captured.commands[0];
	if (!(command instanceof GetObjectCommand)) {
		throw new Error("expected a GetObjectCommand to have been signed");
	}
	return command;
}

describe("render read URLs carry a serve-time Cache-Control", () => {
	it("signRead — a render caller passing the directive — serves it", async () => {
		await signRead(
			freshKey("participant"),
			7200,
			3900,
			RENDER_IMAGE_CACHE_CONTROL,
		);

		expect(onlyCommand().input.ResponseCacheControl).toBe(
			RENDER_IMAGE_CACHE_CONTROL,
		);
	});

	it("signRead — a caller passing null — serves NO directive", async () => {
		// This is the ADMIN MODERATION FEED's shape, and it is the case that made
		// the parameter required rather than defaulted. That feed signs a 60-second
		// URL on purpose; an earlier version applied the year-long directive inside
		// `signRead` to every caller, which would have left a reviewing admin's
		// browser holding content it was reviewing precisely because it may be
		// harmful. `null` has to reach R2 as no parameter at all, not as an empty
		// one.
		await signRead(freshKey("admin-feed"), 60, 0, null);

		expect(onlyCommand().input.ResponseCacheControl).toBeUndefined();
	});

	it("signReadMarketMedia — the market-media render path — serves the directive", async () => {
		await signReadMarketMedia(
			freshKey("market"),
			7200,
			3900,
			RENDER_IMAGE_CACHE_CONTROL,
		);

		expect(onlyCommand().input.ResponseCacheControl).toBe(
			RENDER_IMAGE_CACHE_CONTROL,
		);
	});

	it("signReadSingleUse — the moderation hop — serves NO directive", async () => {
		// Not an omission: OpenAI's fetcher is the consumer and holds no browser
		// cache. A directive appearing here means a render path and a server fetch
		// have been conflated.
		await signReadSingleUse(freshKey("moderation"), 60);

		expect(onlyCommand().input.ResponseCacheControl).toBeUndefined();
	});

	it("the directive is a real caching instruction, not an empty string", () => {
		// Guards the constant itself: a blank or `no-cache` value would satisfy
		// every assertion above while serving nothing cacheable.
		expect(RENDER_IMAGE_CACHE_CONTROL).toMatch(/max-age=\d+/);
		expect(RENDER_IMAGE_CACHE_CONTROL).not.toMatch(
			/no-cache|no-store|max-age=0\b/,
		);
	});

	// R2-REPLACE-IN-PLACE — the UPPER bound, and the half this guard used to be
	// missing. It asserted `max-age=\d{4,}` — "long-lived" — and that shape is
	// exactly what shipped `max-age=31536000, immutable`: correct only while no
	// object is ever overwritten at its key. Images were then replaced in place
	// from the R2 dashboard, and every browser that had seen the old bytes kept
	// them until a hard refresh, having been told never to recheck. A lower bound
	// alone cannot see that failure, so the guard now brackets the value.
	//
	// The ceiling is one hour. That is the most a replaced image may stay stale,
	// and it sits comfortably under the ~46-minute signed-URL rotation that
	// already bounds the entry's real life — so the cap costs nothing the
	// rotation had not already spent. Revalidation past it is cheap: R2 answers
	// `If-None-Match` with a zero-byte `304` (measured 2026-09-13).
	it("the directive lets a replaced image refresh — bounded, and never immutable", () => {
		const match = RENDER_IMAGE_CACHE_CONTROL.match(/max-age=(\d+)/);
		if (!match) {
			throw new Error("RENDER_IMAGE_CACHE_CONTROL carries no max-age");
		}
		const maxAge = Number(match[1]);
		expect(maxAge).toBeGreaterThanOrEqual(60);
		expect(maxAge).toBeLessThanOrEqual(3600);
		// `immutable` tells a browser to skip revalidation even on reload, which is
		// the precise mechanism that made a hard refresh the only way through.
		expect(RENDER_IMAGE_CACHE_CONTROL).not.toMatch(/immutable/);
	});
});
