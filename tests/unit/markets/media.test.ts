import { v4 as uuidv4, v7 as uuidv7 } from "uuid";
import { describe, expect, it } from "vitest";

// MEDIA.1 §7 tests-first (unit, IO-free) — the pure media-validation helpers in
// the greenfield `@/server/markets/media` module + the four new error classes
// in `@/server/markets/errors`. RED at COLLECTION until those land (the VALUE
// imports resolve against nothing today). Pins:
//   - the Q3 client-supplied-PK UUIDv7 guard (`isUuidV7`),
//   - the SPEC.1 §15 service invariant — ≥1 image + exactly-one-default
//     (`validateMediaManifest`),
//   - the outbound-YouTube-only video-URL normaliser (`normalizeMediaVideoUrl`).
// No DB, no IO — these are pure functions (CLAUDE.md §5.6 unit surface).

import {
	DefaultMediaRequiredError,
	MarketVideoUrlInvalidError,
	MediaRequiredError,
} from "@/server/markets/errors";
import {
	isUuidV7,
	type MarketMediaInput,
	normalizeMediaVideoUrl,
	validateMediaManifest,
} from "@/server/markets/media";

/** A manifest entry with the given default flag (id/key are valid filler). */
function item(isDefault: boolean): MarketMediaInput {
	const mediaId = uuidv7();
	return {
		mediaId,
		key: `m/${uuidv7()}/${mediaId}.jpg`,
		displayOrder: 0,
		isDefault,
	};
}

describe("isUuidV7", () => {
	it("media-uuid::accepts-a-real-uuidv7", () => {
		// The version nibble (id[14]) of a `v7()` is "7".
		expect(isUuidV7(uuidv7())).toBe(true);
	});

	it("media-uuid::rejects-a-uuidv4", () => {
		// A canonical v4 carries version nibble "4" — must be rejected.
		expect(isUuidV7(uuidv4())).toBe(false);
	});

	it("media-uuid::rejects-non-uuid-and-empty", () => {
		expect(isUuidV7("not-a-uuid")).toBe(false);
		expect(isUuidV7("")).toBe(false);
	});

	it("media-uuid::rejects-v7-shaped-but-malformed", () => {
		// id[14] === "7" (version position) but a non-hex tail char (Z) means it
		// is not a canonical UUID — the guard must reject, not just sniff id[14].
		expect(isUuidV7("01234567-89ab-7def-8123-456789abcdeZ")).toBe(false);
	});
});

describe("validateMediaManifest", () => {
	it("media-manifest::empty-throws-media-required", () => {
		expect(() => validateMediaManifest([])).toThrow(MediaRequiredError);
	});

	it("media-manifest::exactly-one-default-passes", () => {
		expect(() =>
			validateMediaManifest([item(true), item(false), item(false)]),
		).not.toThrow();
	});

	it("media-manifest::zero-defaults-throws-default-required", () => {
		expect(() => validateMediaManifest([item(false), item(false)])).toThrow(
			DefaultMediaRequiredError,
		);
	});

	it("media-manifest::two-defaults-throws-default-required", () => {
		expect(() => validateMediaManifest([item(true), item(true)])).toThrow(
			DefaultMediaRequiredError,
		);
	});
});

describe("normalizeMediaVideoUrl", () => {
	it("media-video::null-undefined-empty-whitespace-return-null", () => {
		expect(normalizeMediaVideoUrl(null)).toBeNull();
		expect(normalizeMediaVideoUrl(undefined)).toBeNull();
		expect(normalizeMediaVideoUrl("")).toBeNull();
		expect(normalizeMediaVideoUrl("   ")).toBeNull();
	});

	it("media-video::valid-https-youtube-urls-round-trip", () => {
		// All four accepted hosts: youtube.com, www., m., and youtu.be.
		const urls = [
			"https://www.youtube.com/watch?v=dQw4w9WgXcQ",
			"https://youtube.com/watch?v=dQw4w9WgXcQ",
			"https://m.youtube.com/watch?v=dQw4w9WgXcQ",
			"https://youtu.be/dQw4w9WgXcQ",
		];
		for (const url of urls) {
			expect(normalizeMediaVideoUrl(url)).toBe(url);
		}
	});

	it("media-video::non-youtube-https-throws", () => {
		expect(() => normalizeMediaVideoUrl("https://vimeo.com/76979871")).toThrow(
			MarketVideoUrlInvalidError,
		);
	});

	it("media-video::malformed-throws", () => {
		expect(() => normalizeMediaVideoUrl("not a url at all")).toThrow(
			MarketVideoUrlInvalidError,
		);
	});

	it("media-video::non-https-youtube-throws", () => {
		// The contract requires an HTTPS YouTube URL — http must reject.
		expect(() =>
			normalizeMediaVideoUrl("http://www.youtube.com/watch?v=dQw4w9WgXcQ"),
		).toThrow(MarketVideoUrlInvalidError);
	});
});
