# ADR-0062 — The Header Radio: a YouTube Link and a Hidden Playlist Player

| | |
|---|---|
| **Status** | proposed |
| **Date** | 2026-09-26 |
| **Deciders** | Hrishikesh Manoj Hundekari |
| **Tracker task** | RADIO-1 |
| **Frame document** | D-54 (`docs/decisions/RECORD-v2.12-amendment.md`); `docs/plans/RADIO-1.md` |
| **Supersedes** | — (D-54 supersedes design-canon DC ruling 5, which was never an ADR) |
| **Superseded-by** | — |
| **Amends** | — |
| **Amended-by** | — |

---

## Context and Problem Statement

`RadioSlot` was an inert placeholder from UI-A1 OQ-3 onward, and its docblock gated any real build on
"§21.5 amendment + ADR before ANY build". SPEC.1 dropped §21 at 2.0.0 (D-29), so no live spec carries
the Radio's rules; this ADR and its tests do. The founder asked for a Radio that plays a YouTube
playlist, with a play/pause button and an animation, and no backend.

A first build put a **visible** YouTube player in a floating card, because YouTube's rules require one.
The founder rejected it — "don't open in website" — and ruled on the shape below, after being told what
it breaks. The rules it breaks, verbatim (fetched 2026-09-26):

- Required Minimum Functionality: *"Embedded players must have a viewport that is at least 200px by
  200px"*; *"You must not display overlays, frames, or other visual elements in front of any part of a
  YouTube embedded player"*.
- Developer Policies §III.I: do not *"separate, isolate, or modify the audio or video components"* (7),
  nor play from *"a background player, meaning a player that is not displayed in the page, tab, or
  screen that the user is viewing"* (9).

The reference the founder pointed at, `busdriverplaylist.in`, is built exactly this way (a `YT.Player`
styled `opacity:0; pointer-events:none; z-index:-1` at 320×180, driven by its own controls).

This ADR does **not** decide:

- The ToS / privacy-policy wording YouTube's §III.A asks for (LEGAL-YT — founder and lawyer).
- The playlist (founder content; `RADIO_PLAYLIST_ID`).
- Any phone presentation (ADR-0051 A13 D-1 rules the phone header row; it has no room).

## Decision Drivers

- The founder's shape: Radio opens YouTube; a play/pause button beside it plays here, with animation, and
  nothing opens on the site.
- No backend, no API key, no new dependency (AGENTS.md §11).
- Nothing contacts YouTube for a visitor who never presses play.
- Production unchanged until the founder switches it on; the founder does not use PostHog.
- The header must not move when playback state changes.

## Considered Options

1. **A link to the playlist on YouTube, plus a play/pause button driving a hidden player** (chosen).
2. **A visible player card** (built first; compliant; rejected by the founder — "don't open in website").
3. **Only a link to YouTube** (compliant, but our button could not pause a player in another tab).
4. **Self-hosted audio on R2 through `<audio>`** (DC ruling 5; the founder chose YouTube).

## Decision Outcome

**Chosen: Option 1.**

- **Radio** is an `<a target="_blank">` to `https://www.youtube.com/playlist?list=<ID>`. Its equaliser
  and `On Air` label follow the hidden player's own `onStateChange` — never a click.
- **▶ / ⏸** beside it: the first press loads the IFrame API, builds the player and plays; later presses
  pause (while YouTube reports `PLAYING` or `BUFFERING`) and resume. Disabled while loading.
- **The player is hidden, knowingly.** A node appended to `body`, `position:fixed; 320×180; opacity:0;
  pointer-events:none; z-index:-1`, and `inert` so no keyboard or screen reader lands in it.
  `host: youtube-nocookie.com`; `playerVars: { listType: "playlist", list, playsinline: 1, loop: 1 }`.
- **Switch:** `NEXT_PUBLIC_RADIO_ENABLED === "true"` at build. Unset, the old inert placeholder renders,
  so production is unchanged until the variable is set in Doppler (`prd`) and the app is rebuilt.
  PostHog was the first choice (ADR-0052's mechanism) and was dropped because the founder does not use
  it; the cost is that switching it off needs a rebuild instead of a toggle.
- **Who can play:** signed-in viewers — a session exists only after the onboarding gate saw
  `tos_accepted_at`. **Signed out, both controls — the playlist link included — open a prompt to
  sign up or log in** (linking `/sign-in`) instead of playing or opening YouTube (RADIO-SIGNIN,
  founder ruling 2026-09-28).
- **Lifetime:** the player lives until the header unmounts (the `(public)` and `(auth)` groups mount
  separate headers) or the viewport drops below 640px, where the controls are hidden and a playing
  player could not be stopped. It keeps playing in a background tab: it is a radio, and the rule a
  pause there would have honoured (§III.I item 9) is broken by the hiding anyway.
- **The loader** resolves only from `onYouTubeIframeAPIReady` with a real `YT.Player`; a 15 s timeout or
  a script error removes both of YouTube's scripts so the next press re-fetches. A failed load returns
  the button to ▶.

### Single-source-of-truth file map

| Concern | File |
|---|---|
| The link, the button, the hidden player's lifecycle | `src/components/shell/RadioSlot.tsx` |
| The loader | `src/components/shell/radio/youtube-iframe-api.ts` |
| Playlist ID and hidden-player size | `src/components/shell/radio/playlist.ts` |
| Motion | `src/app/globals.css` (`radio-eq`, `radio-dot`) |
| Glosses | `src/lib/copy/glossary.ts` (`HEADER_GLOSSARY.radio*`) |
| Guards | `tests/unit/shell/radio/` |

## Consequences

### Positive

- One press plays; nothing opens on the site; the Radio pill opens YouTube for anyone who wants the
  full player. No server, no key, no dependency, and nothing reaches YouTube before the first press.
- Production is untouched until the variable is set.
- The pill never changes width: both labels share one grid cell and the dot's slot is always present.

### Negative

- **It breaks YouTube's embed rules** (RMF 200×200 and "not obscured"; §III.I items 7 and 9). YouTube can
  stop the embed working on this site; the founder accepted that risk on 2026-09-26. The compliant
  alternative (Option 2) is recorded above and was built once, so it can be restored.
- YouTube's §III.A obligations (a Terms link and binding sentence, privacy-policy disclosures) remain
  the founder's to meet in LEGAL-YT before the variable is set in production.
- Music stops at the `(public)`↔`(auth)` boundary and on a reload. Phones get nothing.
- Switching it off in production needs a rebuild.
- Safari may refuse to start sound after the asynchronous load; with no visible player there is no
  YouTube play button to fall back on, so a second press of ▶ is the path. Not measured.
- The `host` option is undocumented; if YouTube drops it the player falls back to `www.youtube.com`.

## Pros and Cons of the Options

- **Option 2 (visible card).** Pro: compliant. Con: a 542×340 card over the page — rejected.
- **Option 3 (link only).** Pro: compliant, trivial. Con: play/pause could only be decoration.
- **Option 4 (R2 audio).** Pro: a compliant one-button radio that works on phones. Con: the founder
  chose YouTube.

## Flow & invariant constraints absorbed

None of CLAUDE.md §1's seven areas is touched: no ledger, no bet path, no auth code, no schema. The
four invariants are untouched.

## More Information

- Measured 2026-09-26 in Chrome through `YT.Player` with these options: the founder's playlist
  `PLM84XIPy_bFQ` loads and every video reaches PLAYING; a YouTube Mix (`RD…`) never loads in an embed
  (error 150) — pinned in `playlist.test.ts`.
- Mutation pass: 20 source mutations, each turned a named test red, every file restored byte-for-byte.
