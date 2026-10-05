/**
 * RADIO-1 / ADR-0062 — what the header Radio plays.
 *
 * ⛔ THE PLAYLIST IS FOUNDER CONTENT, NEVER INVENTED — the ID from the playlist
 * URL (`…?list=<ID>`). `tests/unit/shell/radio/playlist.test.ts` rejects an empty
 * or malformed ID, so the gate is that test, not a note somebody has to
 * remember. The playlist must be public or unlisted, and every video in it must
 * allow embedding: nothing skips a video that refuses (ADR-0062).
 *
 * ⛔ A `PL…` playlist someone made — NOT a YouTube Mix (`RD…`, the "Mix" /
 * `start_radio=1` links). Measured 2026-09-26: the embedded player never loads
 * a Mix (error 150, empty playlist), even one seeded by an embeddable video.
 *
 * Founder-supplied 2026-10-05 (`…/playlist?list=PLDLq3RxB4Ue4`), replacing
 * the 2026-09-26 playlist above — not independently re-measured through
 * `YT.Player` the way that one was, so if the embed ever reports a video in
 * it as non-embeddable, check this one specifically rather than assuming
 * the prior measurement still applies.
 */
export const RADIO_PLAYLIST_ID = "PLDLq3RxB4Ue4";

/**
 * The hidden player's size — busdriverplaylist.in's, which plays in practice.
 * Nobody sees it (ADR-0062), so no size here is about the viewer.
 */
export const RADIO_PLAYER_WIDTH = 320;
export const RADIO_PLAYER_HEIGHT = 180;
