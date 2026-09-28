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
 * Founder-supplied 2026-09-26 (`…/watch?v=vRjaGgDsWSo&list=PLM84XIPy_bFQ`).
 * Measured the same day through `YT.Player` with RadioSlot's options: the
 * playlist loads (1 video) and every video in it reaches PLAYING. Songs added to
 * the playlist on YouTube play here with no code change — but each one added
 * must itself allow embedding.
 */
export const RADIO_PLAYLIST_ID = "PLM84XIPy_bFQ";

/**
 * The hidden player's size — busdriverplaylist.in's, which plays in practice.
 * Nobody sees it (ADR-0062), so no size here is about the viewer.
 */
export const RADIO_PLAYER_WIDTH = 320;
export const RADIO_PLAYER_HEIGHT = 180;
