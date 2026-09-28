# DECISION RECORD — amendment 2.12

**Amends** `RECORD-v2.0.md` · follows every amendment on disk before it (measured on `origin/main` @ `64d3ea0`) · **Opened** 2026-09-26
**Rulings** D-54

---

## D-54 · The header Radio: Radio opens the playlist on YouTube; ▶/⏸ beside it plays it here

**Ruled:** 2026-09-26 · **Task:** RADIO-1 · **Supersedes:** design-canon DC ruling 5 (Cloudflare R2 self-host)

### Context

The header has carried an inert Radio placeholder since UI-A1 OQ-3. DC ruling 5 (2026-07-02) chose to self-host original music on R2; the amendment it promised never landed, and SPEC.1 dropped §21 at 2.0.0 (D-29). On 26 September the founder asked for the Radio to play a YouTube playlist with a play/pause button and animation, and no backend. A first build put a visible YouTube player in a floating card, because YouTube's rules require one; the founder rejected it: "don't open in website". Told that a hidden player breaks YouTube's embed rules, the founder chose it, and ruled: "add a play/pause button beside Radio; clicking Radio opens the YouTube link."

### Decision

**R1 — Radio is a link** to the playlist on YouTube, opening in a new tab, for every viewer.

**R2 — A ▶/⏸ button beside it plays the playlist on this site through a hidden YouTube player**, with the Radio equaliser and `On Air` label following real playback. Signed-in viewers only; desktop only (≥640px). Technical decision: ADR-0062.

**R3 — The hidden player's breach of YouTube's embed rules is accepted.** The risk is that YouTube stops the player working on this site. The compliant visible-card build is recorded in ADR-0062 as the way back.

**R4 — Off unless `NEXT_PUBLIC_RADIO_ENABLED=true`** at build (Doppler). Production stays as it is until the founder sets it, after LEGAL-YT — the ToS and privacy wording YouTube's §III.A asks for — has landed. PostHog is not used for this switch; the founder does not use it.

**R5 — DC ruling 5 is superseded.** R2 + `<audio>` stays on record as the fallback.

**R6 — The playlist is `PLM84XIPy_bFQ`** (founder-supplied, measured playing). A YouTube Mix (`RD…`) cannot be used: it never loads in an embed.

### Consequences

**Positive.** One press plays, nothing opens on the site, no server and no key, and nothing reaches YouTube before the first press. Production is untouched until the variable is set.

**Negative.** The hidden player breaks YouTube's embed rules, and YouTube can switch it off. Music stops at the `(public)`↔`(auth)` boundary and on a reload; phones get nothing; switching it off in production needs a rebuild.

**Enforced at:** `src/components/shell/RadioSlot.tsx` · `src/components/shell/radio/` · `tests/unit/shell/radio/` · `docs/adr/0062-radio-youtube-playlist-embed.md` · `docs/design/design-canon.md` (the W2.14 row and DC ruling 5).

---

*End amendment 2.12.*
