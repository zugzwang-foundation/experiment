import { describe, expect, it } from "vitest";

import { RADIO_PLAYLIST_ID } from "@/components/shell/radio/playlist";

/**
 * RADIO-1 G2 — what the Radio plays.
 *
 * ⛔ THE FIRST CASE IS THE GATE ON THE PLAYLIST ID. The ID is founder content
 * and is never invented; this test was red until the founder supplied it, and
 * it stops the radio shipping with an empty or malformed one (O-1) rather than
 * leaving that to a note somebody has to remember. `PL` alone is the prefix
 * every playlist ID shares, not an ID, and is rejected by name.
 */
describe("RADIO-1 G2 — the playlist", () => {
	it("RADIO_PLAYLIST_ID is a real playlist ID (founder-supplied)", () => {
		expect(RADIO_PLAYLIST_ID, "supply the ID from the playlist URL").not.toBe(
			"",
		);
		expect(RADIO_PLAYLIST_ID).not.toBe("PL");
		expect(RADIO_PLAYLIST_ID).toMatch(/^[A-Za-z0-9_-]{12,}$/);
	});

	it("is not a YouTube Mix (RD…) — the embedded player never loads one", () => {
		// Measured 2026-09-26 in Chrome through `YT.Player` with RadioSlot's
		// options: `list=RDeyDmlnExccE` and `list=RDM7lc1UVf-VE` (a Mix seeded by
		// an embeddable video) both returned error 150 with `getPlaylist()` null,
		// while a `PL…` playlist loaded 16 videos and reached PLAYING, and the
		// seed video `M7lc1UVf-VE` alone played — so the harness was sound and it
		// is the Mix that the embed refuses.
		expect(RADIO_PLAYLIST_ID).not.toMatch(/^RD/);
	});
});
